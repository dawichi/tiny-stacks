import type { Board, Connection, PlacedService } from './game-state.service';
import { CACHE_TTL_MS, DB_OPERATION_COST, getServiceConfig, ServiceType } from './service-types.config';
import { MetricsCollector, RunCollector } from './sim-metrics';
import { createRandom } from './sim-random';
import {
    type CacheStats,
    isWrite,
    REQUEST_METHOD_COLORS,
    RequestMethod,
    type RunState,
    type RunSummary,
    type ServiceRuntimeState,
    type SimMetrics,
    type SimOutage,
    type SimRequest,
    type TrafficPattern,
} from './sim-types';

// ── Constants ────────────────────────────────────────────────────────

/** Time a packet takes to cross one connection on screen. Cosmetic: it keeps packets readable. */
export const HOP_MS = 250;

/** Network latency accounted per hop (what the metrics see, independent of the animation) */
export const NETWORK_LATENCY_MS = 5;

/** After a run's traffic stops, in-flight requests get this long to finish before they count as timeouts */
export const RUN_DRAIN_MS = 5000;

/** Run length when no Origin defines traffic phases */
const DEFAULT_RUN_MS = 20000;

/** A cache stops waiting for an in-flight fetch after this long and fetches again */
const CACHE_FILL_TIMEOUT_MS = 2000;

const FAILED_POP_MS = 500;
const RECENT_FAILURE_MS = 1000;
const OVERLOAD_RATIO = 0.8;

/** Sandbox "Spike" button: multiply an Origin's rate for a few seconds */
export const SPIKE_FACTOR = 5;
export const SPIKE_MS = 5000;

/** Traffic used by any Origin without an explicit pattern */
export const DEFAULT_TRAFFIC: TrafficPattern = {
    requestsPerSecond: 10,
    distribution: [
        { method: RequestMethod.GET, resource: 'users', weight: 40 },
        { method: RequestMethod.GET, resource: 'products', weight: 30 },
        { method: RequestMethod.POST, resource: 'users', weight: 15 },
        { method: RequestMethod.DELETE, resource: 'products', weight: 10 },
        { method: RequestMethod.PUT, resource: 'users', weight: 5 },
    ],
};

// ── Render Types ─────────────────────────────────────────────────────

/** A request traveling along a connection, as the board draws it */
export interface Packet {
    id: string;
    connectionId: string;
    progress: number;
    color: string;
    direction: 'forward' | 'response';
    /** Message Queue delivery (drawn differently: nobody is waiting for it) */
    async: boolean;
}

/** A failed request shown as a fading red pop at a service */
export interface FailedPacket {
    id: string;
    serviceId: string;
    remainingMs: number;
}

/** Per-service visual state derived from runtime simulation data */
export interface ServiceVisualState {
    queueRatio: number;
    processingRatio: number;
    isOverloaded: boolean;
    isDown: boolean;
    queueCount: number;
    processingCount: number;
    queueCapacity: number;
    maxConcurrency: number;
    /** Message Queue only */
    backlogCount?: number;
    backlogCapacity?: number;
    cacheStats?: CacheStats;
}

// ── Internal Types ───────────────────────────────────────────────────

/** Lookups built once per step */
interface StepContext {
    services: Map<string, PlacedService>;
    connections: Map<string, Connection>;
    outgoing: Map<string, Connection[]>;
    /** Forward requests currently traveling towards each service (load balancer input) */
    inTransit: Map<string, number>;
}

interface ActiveRun {
    durationMs: number;
    elapsedMs: number;
    outages: SimOutage[];
    collector: RunCollector;
    finished: boolean;
    summary: RunSummary | null;
}

function accepts(conn: Connection, method: RequestMethod): boolean {
    const methods = conn.filter?.methods ?? [];
    return methods.length === 0 || methods.includes(method);
}

function weightOf(conn: Connection): number {
    return conn.filter?.weight ?? 100;
}

/**
 * The simulation itself: plain TypeScript, no Angular. `TickEngineService` drives it on a timer;
 * tests drive it directly with `step()`.
 *
 * Request lifecycle: an Origin spawns a request, it travels along a connection, waits in the target's
 * queue, is processed, then is forwarded downstream or answered. Answers travel back along the same
 * connections without queueing. Latency counts network hops, queue wait and processing.
 */
export class Simulation {
    private now = 0;
    private requests: SimRequest[] = [];
    private readonly runtime = new Map<string, ServiceRuntimeState>();
    private readonly cacheEntries = new Map<string, Map<string, number>>();
    private readonly cacheStats = new Map<string, { hits: number; misses: number }>();
    /** Per cache: resources being fetched from downstream right now, and when the fetch started */
    private readonly cacheFills = new Map<string, Map<string, number>>();
    private readonly spawnAccumulators = new Map<string, number>();
    private readonly spikes = new Map<string, number>();
    private traffic: ReadonlyMap<string, TrafficPattern> = new Map();
    private failedPops: FailedPacket[] = [];
    private readonly metricsCollector = new MetricsCollector();
    private run: ActiveRun | null = null;
    private seedValue: number;
    private random: () => number;
    private requestCounter = 0;
    private popCounter = 0;

    constructor(seed = 1) {
        this.seedValue = seed;
        this.random = createRandom(seed);
    }

    // ── Configuration ────────────────────────────────────────────────

    seed(seed: number): void {
        this.seedValue = seed;
        this.random = createRandom(seed);
    }

    setTraffic(traffic: ReadonlyMap<string, TrafficPattern>): void {
        this.traffic = traffic;
    }

    trafficFor(originId: string): TrafficPattern {
        return this.traffic.get(originId) ?? DEFAULT_TRAFFIC;
    }

    /** Temporarily multiply an Origin's rate (free-running mode only) */
    spike(originId: string): void {
        this.spikes.set(originId, this.now + SPIKE_MS);
    }

    /** Forget every request, queue, cache entry and metric. Restarts the random sequence. */
    reset(): void {
        this.now = 0;
        this.requests = [];
        this.runtime.clear();
        this.cacheEntries.clear();
        this.cacheStats.clear();
        this.cacheFills.clear();
        this.spawnAccumulators.clear();
        this.spikes.clear();
        this.failedPops = [];
        this.metricsCollector.reset();
        this.run = null;
        this.requestCounter = 0;
        this.popCounter = 0;
        this.random = createRandom(this.seedValue);
    }

    /**
     * Start a scripted run from an empty system: Origins follow their traffic phases,
     * outages fire on schedule, and results are measured over the run only.
     */
    startRun(outages: SimOutage[] = []): void {
        this.reset();
        let durationMs = 0;
        for (const pattern of this.traffic.values()) {
            const total = (pattern.phases ?? []).reduce((sum, p) => sum + p.durationMs, 0);
            durationMs = Math.max(durationMs, total);
        }
        this.run = {
            durationMs: durationMs || DEFAULT_RUN_MS,
            elapsedMs: 0,
            outages,
            collector: new RunCollector(),
            finished: false,
            summary: null,
        };
    }

    /** Leave run mode and go back to free-running baseline traffic */
    endRun(): void {
        this.run = null;
    }

    // ── Snapshots ────────────────────────────────────────────────────

    get simTimeMs(): number {
        return this.now;
    }

    metrics(): SimMetrics {
        let client = 0;
        let async = 0;
        for (const req of this.requests) {
            if (req.kind === 'client') client++;
            else async++;
        }
        return this.metricsCollector.snapshot(client, async);
    }

    packets(): Packet[] {
        const packets: Packet[] = [];
        for (const req of this.requests) {
            if (req.status !== 'traveling' || req.connectionId === null) continue;
            packets.push({
                id: req.id,
                connectionId: req.connectionId,
                progress: Math.min(1, req.travelProgress),
                color: REQUEST_METHOD_COLORS[req.method],
                direction: req.direction,
                async: req.kind === 'async',
            });
        }
        return packets;
    }

    failedPackets(): FailedPacket[] {
        return [...this.failedPops];
    }

    runState(): RunState | null {
        const run = this.run;
        if (!run) return null;
        return {
            durationMs: run.durationMs,
            elapsedMs: run.elapsedMs,
            phaseLabel: this.phaseLabel(run),
            finished: run.finished,
            summary: run.summary,
        };
    }

    visuals(services: readonly PlacedService[]): Map<string, ServiceVisualState> {
        const result = new Map<string, ServiceVisualState>();
        for (const svc of services) {
            if (svc.type === ServiceType.ORIGIN) continue;
            const state = this.runtime.get(svc.id);
            if (!state) continue;

            const config = getServiceConfig(svc.type);
            const queueRatio = config.queueSize > 0 ? state.queue.length / config.queueSize : 0;
            const backlogCapacity = config.backlogSize ?? 0;
            const backlogRatio = backlogCapacity > 0 ? state.backlog.length / backlogCapacity : 0;
            const recentFailure = state.lastFailureAt >= 0 && this.now - state.lastFailureAt < RECENT_FAILURE_MS;

            const visual: ServiceVisualState = {
                queueRatio,
                processingRatio: config.maxConcurrency > 0 ? state.processing.length / config.maxConcurrency : 0,
                isOverloaded: Math.max(queueRatio, backlogRatio) > OVERLOAD_RATIO || recentFailure,
                isDown: this.isDown(svc.id),
                queueCount: state.queue.length,
                processingCount: state.processing.length,
                queueCapacity: config.queueSize,
                maxConcurrency: config.maxConcurrency,
            };

            if (svc.type === ServiceType.MESSAGE_QUEUE) {
                visual.backlogCount = state.backlog.length;
                visual.backlogCapacity = backlogCapacity;
            }

            if (svc.type === ServiceType.CACHE) {
                const stats = this.cacheStats.get(svc.id) ?? { hits: 0, misses: 0 };
                visual.cacheStats = {
                    hitCount: stats.hits,
                    missCount: stats.misses,
                    cachedResources: this.freshEntries(svc.id),
                };
            }

            result.set(svc.id, visual);
        }
        return result;
    }

    // ── Step ─────────────────────────────────────────────────────────

    /** Advance the simulation by `dt` simulated milliseconds */
    step(board: Board, dt: number): void {
        this.now += dt;
        const ctx = this.buildContext(board);

        this.syncRuntime(ctx);
        this.dropOrphans(ctx);
        this.applyOutages(ctx);
        this.spawn(ctx, dt);
        this.advanceTravel(dt);
        this.deliverArrivals(ctx);
        this.processServices(ctx, dt);
        this.dispatchBacklogs(ctx);
        this.accrueInfrastructureCost(ctx, dt);
        this.removeFinished();
        this.decayPops(dt);
        this.metricsCollector.prune(this.now);
        this.advanceRun(dt);
    }

    private buildContext(board: Board): StepContext {
        const services = new Map(board.services.map((s) => [s.id, s]));
        const connections = new Map<string, Connection>();
        const outgoing = new Map<string, Connection[]>();
        for (const conn of board.connections) {
            if (!services.has(conn.source.serviceId) || !services.has(conn.target.serviceId)) continue;
            connections.set(conn.id, conn);
            const list = outgoing.get(conn.source.serviceId);
            if (list) list.push(conn);
            else outgoing.set(conn.source.serviceId, [conn]);
        }

        const inTransit = new Map<string, number>();
        for (const req of this.requests) {
            if (req.status !== 'traveling' || req.direction !== 'forward' || !req.connectionId) continue;
            const target = connections.get(req.connectionId)?.target.serviceId;
            if (target) inTransit.set(target, (inTransit.get(target) ?? 0) + 1);
        }

        return { services, connections, outgoing, inTransit };
    }

    /** Create runtime state for new services and forget removed ones */
    private syncRuntime(ctx: StepContext): void {
        for (const svc of ctx.services.values()) {
            if (this.runtime.has(svc.id)) continue;
            this.runtime.set(svc.id, {
                serviceId: svc.id,
                queue: [],
                processing: [],
                processingProgress: new Map(),
                backlog: [],
                waiting: [],
                consumersBusy: 0,
                lastFailureAt: -1,
            });
        }
        for (const id of [...this.runtime.keys()]) {
            if (ctx.services.has(id)) continue;
            this.runtime.delete(id);
            this.cacheEntries.delete(id);
            this.cacheStats.delete(id);
            this.cacheFills.delete(id);
            this.spawnAccumulators.delete(id);
            this.spikes.delete(id);
        }
    }

    /** Requests on deleted connections or at deleted services vanish */
    private dropOrphans(ctx: StepContext): void {
        this.requests = this.requests.filter((req) => {
            if (!ctx.services.has(req.currentServiceId)) return false;
            if (req.status === 'traveling' && (!req.connectionId || !ctx.connections.has(req.connectionId))) {
                return false;
            }
            return true;
        });
    }

    /** A service that is down drops everything it was holding */
    private applyOutages(ctx: StepContext): void {
        if (!this.run || this.run.finished) return;
        for (const svc of ctx.services.values()) {
            if (!this.isDown(svc.id)) continue;
            const state = this.runtime.get(svc.id);
            if (!state || state.queue.length + state.processing.length === 0) continue;
            const stranded = [...state.queue, ...state.processing];
            state.queue = [];
            state.processing = [];
            state.processingProgress.clear();
            for (const req of stranded) this.fail(req, svc.id, true);
        }
    }

    // ── Spawning ─────────────────────────────────────────────────────

    private spawn(ctx: StepContext, dt: number): void {
        for (const origin of ctx.services.values()) {
            if (origin.type !== ServiceType.ORIGIN) continue;
            const outgoing = ctx.outgoing.get(origin.id) ?? [];
            const rps = this.currentRps(origin.id);
            if (rps <= 0) {
                this.spawnAccumulators.set(origin.id, 0);
                continue;
            }

            const pattern = this.trafficFor(origin.id);
            const msPerRequest = 1000 / rps;
            let accumulated = (this.spawnAccumulators.get(origin.id) ?? 0) + dt;
            while (accumulated >= msPerRequest) {
                accumulated -= msPerRequest;
                const { method, resource } = this.pickFromDistribution(pattern);
                const req = this.createRequest('client', method, resource, origin.id);
                this.requests.push(req);
                if (outgoing.length === 0) {
                    this.fail(req, origin.id, false);
                } else {
                    const conn = this.pickConnection(origin, outgoing, method, ctx);
                    if (conn) this.send(req, conn, ctx);
                    else this.fail(req, origin.id, false);
                }
            }
            this.spawnAccumulators.set(origin.id, accumulated);
        }
    }

    private currentRps(originId: string): number {
        const pattern = this.trafficFor(originId);
        const run = this.run;
        if (run) {
            if (run.finished || run.elapsedMs >= run.durationMs) return 0;
            if (!pattern.phases?.length) return pattern.requestsPerSecond;
            let start = 0;
            for (const phase of pattern.phases) {
                if (run.elapsedMs < start + phase.durationMs) return phase.requestsPerSecond;
                start += phase.durationMs;
            }
            return 0;
        }
        const spikeEnd = this.spikes.get(originId);
        const factor = spikeEnd !== undefined && spikeEnd > this.now ? SPIKE_FACTOR : 1;
        return pattern.requestsPerSecond * factor;
    }

    private pickFromDistribution(pattern: TrafficPattern): { method: RequestMethod; resource: string } {
        const total = pattern.distribution.reduce((sum, d) => sum + d.weight, 0);
        let roll = this.random() * total;
        for (const entry of pattern.distribution) {
            roll -= entry.weight;
            if (roll < 0) return entry;
        }
        const fallback = pattern.distribution.at(-1);
        if (!fallback) throw new Error('Traffic pattern distribution must contain at least one entry.');
        return fallback;
    }

    private createRequest(
        kind: SimRequest['kind'],
        method: RequestMethod,
        resource: string,
        serviceId: string,
    ): SimRequest {
        return {
            id: `req_${this.requestCounter++}`,
            kind,
            method,
            resource,
            status: 'traveling',
            direction: 'forward',
            currentServiceId: serviceId,
            originServiceId: serviceId,
            connectionId: null,
            travelProgress: 0,
            totalLatency: 0,
            routeHistory: [],
            cacheMisses: [],
            mqSlot: null,
        };
    }

    // ── Travel ───────────────────────────────────────────────────────

    private advanceTravel(dt: number): void {
        for (const req of this.requests) {
            if (req.status === 'traveling') req.travelProgress += dt / HOP_MS;
        }
    }

    private deliverArrivals(ctx: StepContext): void {
        for (const req of [...this.requests]) {
            if (req.status !== 'traveling' || req.travelProgress < 1 || !req.connectionId) continue;
            const conn = ctx.connections.get(req.connectionId);
            if (!conn) continue;
            req.totalLatency += NETWORK_LATENCY_MS;
            req.connectionId = null;
            req.travelProgress = 0;

            if (req.direction === 'response') {
                // Answers travel against the connection and skip queues
                req.currentServiceId = conn.source.serviceId;
                const missIndex = req.cacheMisses.indexOf(conn.source.serviceId);
                if (missIndex >= 0) {
                    req.cacheMisses.splice(missIndex, 1);
                    this.fillCache(conn.source.serviceId, req.resource);
                }
                this.continueResponse(req);
                continue;
            }

            const targetId = conn.target.serviceId;
            const target = ctx.services.get(targetId);
            const state = this.runtime.get(targetId);
            if (!target || !state || this.isDown(targetId)) {
                this.fail(req, targetId, true);
                continue;
            }
            const config = getServiceConfig(target.type);
            if (state.queue.length + state.processing.length >= config.queueSize + config.maxConcurrency) {
                this.fail(req, targetId, true);
                continue;
            }
            req.status = 'queued';
            req.currentServiceId = targetId;
            state.queue.push(req);
        }
    }

    // ── Processing ───────────────────────────────────────────────────

    private processServices(ctx: StepContext, dt: number): void {
        for (const svc of ctx.services.values()) {
            if (svc.type === ServiceType.ORIGIN) continue;
            const state = this.runtime.get(svc.id);
            if (!state) continue;
            const config = getServiceConfig(svc.type);

            this.startProcessing(state, config.maxConcurrency, []);

            if (svc.type === ServiceType.CACHE) this.retryAbandonedWaits(svc, state, ctx);

            // Waiting counts as latency (only for requests someone is waiting on)
            for (const req of state.queue) req.totalLatency += dt;
            for (const req of state.waiting) req.totalLatency += dt;
            for (const req of state.backlog) {
                if (req.kind === 'client') req.totalLatency += dt;
            }

            const done: SimRequest[] = [];
            const leftovers: number[] = [];
            for (const req of state.processing) {
                const progress = (state.processingProgress.get(req.id) ?? 0) + dt;
                state.processingProgress.set(req.id, progress);
                req.totalLatency += dt;
                if (progress >= config.baseProcessingTime) {
                    done.push(req);
                    leftovers.push(progress - config.baseProcessingTime);
                }
            }

            for (const req of done) {
                state.processing.splice(state.processing.indexOf(req), 1);
                state.processingProgress.delete(req.id);
                this.complete(svc, req, ctx);
            }

            // Freed slots pick up the next request right away, with the time left in this step
            this.startProcessing(state, config.maxConcurrency, leftovers);
        }
    }

    private startProcessing(state: ServiceRuntimeState, maxConcurrency: number, headStart: number[]): void {
        while (state.processing.length < maxConcurrency && state.queue.length > 0) {
            const req = state.queue.shift();
            if (!req) break;
            const progress = headStart.shift() ?? 0;
            req.status = 'processing';
            req.totalLatency += progress;
            state.processing.push(req);
            state.processingProgress.set(req.id, progress);
        }
    }

    /** A service finished processing a forward request */
    private complete(svc: PlacedService, req: SimRequest, ctx: StepContext): void {
        switch (svc.type) {
            case ServiceType.CACHE:
                this.completeAtCache(svc, req, ctx);
                return;
            case ServiceType.MESSAGE_QUEUE:
                this.completeAtQueue(svc, req);
                return;
            case ServiceType.DATABASE:
                this.recordDatabaseOperation(svc, req, ctx);
                this.forwardOrRespond(svc, req, ctx);
                return;
            default:
                this.forwardOrRespond(svc, req, ctx);
        }
    }

    /**
     * The routing rule shared by every service: no outgoing connections means this service is the
     * end of the line and answers; otherwise the request needs a connection that accepts its method.
     */
    private forwardOrRespond(svc: PlacedService, req: SimRequest, ctx: StepContext): void {
        if ((ctx.outgoing.get(svc.id) ?? []).length === 0) {
            this.respond(req);
            return;
        }
        this.forward(svc, req, ctx);
    }

    /** Send downstream; fails when nothing downstream accepts the method */
    private forward(svc: PlacedService, req: SimRequest, ctx: StepContext): boolean {
        const conn = this.pickConnection(svc, ctx.outgoing.get(svc.id) ?? [], req.method, ctx);
        if (!conn) {
            this.fail(req, svc.id, false);
            return false;
        }
        this.send(req, conn, ctx);
        return true;
    }

    /**
     * Cache-aside: fresh GET hits answer here; misses and writes need a backing store downstream.
     * Misses store the resource when the answer passes back through; writes evict it.
     */
    private completeAtCache(svc: PlacedService, req: SimRequest, ctx: StepContext): void {
        const entries = this.entriesOf(svc.id);
        const stats = this.statsOf(svc.id);

        if (req.method === RequestMethod.GET) {
            const storedAt = entries.get(req.resource);
            if (storedAt !== undefined && this.now - storedAt < CACHE_TTL_MS) {
                stats.hits++;
                this.respond(req);
                return;
            }
            entries.delete(req.resource);
            const fills = this.fillsOf(svc.id);
            const fetchStarted = fills.get(req.resource);
            if (fetchStarted !== undefined && this.now - fetchStarted < CACHE_FILL_TIMEOUT_MS) {
                // Someone already asked downstream for this resource: wait for that answer
                req.status = 'waiting';
                this.runtime.get(svc.id)?.waiting.push(req);
                return;
            }
            stats.misses++;
            if (this.forward(svc, req, ctx)) {
                req.cacheMisses.push(svc.id);
                fills.set(req.resource, this.now);
            }
            return;
        }

        entries.delete(req.resource);
        this.forward(svc, req, ctx);
    }

    /**
     * Writes are acknowledged at once and become messages delivered later by the consumers.
     * Reads can't be answered by a queue: they wait in line for a reply (request-reply).
     */
    private completeAtQueue(svc: PlacedService, req: SimRequest): void {
        const state = this.runtime.get(svc.id);
        if (!state) return;
        const full = state.backlog.length >= (getServiceConfig(svc.type).backlogSize ?? 0);

        if (req.kind === 'async') {
            // A message handed over by an upstream queue: this broker now owns it
            req.mqSlot = null;
            if (full) {
                this.drop(req, svc.id);
                return;
            }
            this.toBacklog(req, svc.id);
            state.backlog.push(req);
            return;
        }

        if (isWrite(req.method)) {
            if (full) {
                this.fail(req, svc.id, false);
                return;
            }
            const message = this.createRequest('async', req.method, req.resource, svc.id);
            this.toBacklog(message, svc.id);
            this.requests.push(message);
            state.backlog.push(message);
            this.respond(req);
            return;
        }

        // A queue acknowledges commands, not data reads. A GET sent here has no response path.
        this.fail(req, svc.id, false);
    }

    private recordDatabaseOperation(db: PlacedService, req: SimRequest, ctx: StepContext): void {
        this.metricsCollector.recordCost(this.now, DB_OPERATION_COST);
        if (this.runActive && this.run) {
            this.run.collector.dbOperations++;
            this.run.collector.cost += DB_OPERATION_COST;
        }
        if (!isWrite(req.method)) return;

        // Invalidate every upstream Cache that can eventually read from this Database.
        const upstream = new Map<string, string[]>();
        for (const conn of ctx.connections.values()) {
            const list = upstream.get(conn.target.serviceId);
            if (list) list.push(conn.source.serviceId);
            else upstream.set(conn.target.serviceId, [conn.source.serviceId]);
        }
        const visited = new Set<string>();
        const pending = [db.id];
        while (pending.length > 0) {
            const targetId = pending.pop();
            if (!targetId || visited.has(targetId)) continue;
            visited.add(targetId);
            for (const sourceId of upstream.get(targetId) ?? []) {
                if (ctx.services.get(sourceId)?.type === ServiceType.CACHE) {
                    this.cacheEntries.get(sourceId)?.delete(req.resource);
                }
                pending.push(sourceId);
            }
        }
    }

    // ── Message Queue Delivery ───────────────────────────────────────

    private dispatchBacklogs(ctx: StepContext): void {
        const busy = new Map<string, number>();
        for (const req of this.requests) {
            if (req.mqSlot) busy.set(req.mqSlot, (busy.get(req.mqSlot) ?? 0) + 1);
        }

        for (const svc of ctx.services.values()) {
            if (svc.type !== ServiceType.MESSAGE_QUEUE || this.isDown(svc.id)) continue;
            const state = this.runtime.get(svc.id);
            const outgoing = ctx.outgoing.get(svc.id) ?? [];
            if (!state || outgoing.length === 0) continue;

            const consumers = getServiceConfig(svc.type).consumerConcurrency ?? 1;
            let inFlight = busy.get(svc.id) ?? 0;
            while (inFlight < consumers && state.backlog.length > 0) {
                const req = state.backlog.shift();
                if (!req) break;
                const conn = this.pickConnection(svc, outgoing, req.method, ctx);
                if (!conn) {
                    this.fail(req, svc.id, false);
                    continue;
                }
                req.mqSlot = svc.id;
                inFlight++;
                this.send(req, conn, ctx);
            }
            state.consumersBusy = inFlight;
        }
    }

    private toBacklog(req: SimRequest, queueId: string): void {
        req.status = 'backlogged';
        req.direction = 'forward';
        req.currentServiceId = queueId;
        req.originServiceId = queueId;
        req.connectionId = null;
        req.travelProgress = 0;
        req.routeHistory = [];
        req.cacheMisses = [];
        req.mqSlot = null;
    }

    // ── Routing ──────────────────────────────────────────────────────

    /**
     * Pick an outgoing connection that accepts the method. Load Balancers send to the least busy
     * healthy target; every other service picks at random, proportionally to connection weights.
     */
    private pickConnection(
        svc: PlacedService,
        outgoing: Connection[],
        method: RequestMethod,
        ctx: StepContext,
    ): Connection | null {
        const eligible = outgoing.filter((c) => accepts(c, method));
        if (eligible.length === 0) return null;
        if (svc.type === ServiceType.LOAD_BALANCER) return this.leastLoaded(eligible, ctx);

        const total = eligible.reduce((sum, c) => sum + weightOf(c), 0);
        let roll = this.random() * total;
        for (const conn of eligible) {
            roll -= weightOf(conn);
            if (roll < 0) return conn;
        }
        return eligible.at(-1) ?? null;
    }

    private leastLoaded(eligible: Connection[], ctx: StepContext): Connection | null {
        let best: Connection | null = null;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const conn of eligible) {
            const targetId = conn.target.serviceId;
            const target = ctx.services.get(targetId);
            const state = this.runtime.get(targetId);
            if (!target || !state || this.isDown(targetId)) continue;
            const capacity = Math.max(1, getServiceConfig(target.type).maxConcurrency);
            const load = state.queue.length + state.processing.length + (ctx.inTransit.get(targetId) ?? 0);
            const score = (load + 1) / (capacity * weightOf(conn));
            if (score < bestScore) {
                bestScore = score;
                best = conn;
            }
        }
        return best;
    }

    private send(req: SimRequest, conn: Connection, ctx: StepContext): void {
        req.status = 'traveling';
        req.direction = 'forward';
        req.connectionId = conn.id;
        req.travelProgress = 0;
        req.routeHistory.push(conn.id);
        const targetId = conn.target.serviceId;
        ctx.inTransit.set(targetId, (ctx.inTransit.get(targetId) ?? 0) + 1);
    }

    // ── Outcomes ─────────────────────────────────────────────────────

    /** The request reached the end of its path: answer it (messages just finish) */
    private respond(req: SimRequest): void {
        req.mqSlot = null;
        if (req.kind === 'async') {
            req.status = 'completed';
            return;
        }
        req.direction = 'response';
        this.continueResponse(req);
    }

    private continueResponse(req: SimRequest): void {
        const connId = req.routeHistory.pop();
        if (connId === undefined) {
            req.status = 'completed';
            this.metricsCollector.recordCompletion(this.now, req.totalLatency);
            if (this.runActive) this.run?.collector.recordCompletion(req.totalLatency);
            return;
        }
        req.status = 'traveling';
        req.connectionId = connId;
        req.travelProgress = 0;
    }

    /**
     * A request failed at a service. Client failures are what the player is measured on.
     * Messages are retried from their queue when the failure is transient (`retry`), otherwise lost.
     */
    private fail(req: SimRequest, serviceId: string, retry: boolean): void {
        req.mqSlot = null;
        this.markFailure(serviceId);
        // A failed fetch will never fill these caches: whoever waits on it fetches again
        for (const cacheId of req.cacheMisses) this.cacheFills.get(cacheId)?.delete(req.resource);
        req.cacheMisses = [];

        if (req.kind === 'async') {
            const queue = this.runtime.get(req.originServiceId);
            const capacity = queue ? (getServiceConfig(ServiceType.MESSAGE_QUEUE).backlogSize ?? 0) : 0;
            if (retry && queue && queue.backlog.length < capacity) {
                this.toBacklog(req, req.originServiceId);
                queue.backlog.push(req);
                this.metricsCollector.asyncRetries++;
                return;
            }
            this.metricsCollector.asyncDropped++;
            req.status = 'failed';
            return;
        }

        req.status = 'failed';
        this.metricsCollector.recordFailure(this.now);
        if (this.runActive) this.run?.collector.recordFailure();
    }

    private drop(req: SimRequest, serviceId: string): void {
        this.markFailure(serviceId);
        this.metricsCollector.asyncDropped++;
        req.status = 'failed';
    }

    private markFailure(serviceId: string): void {
        const state = this.runtime.get(serviceId);
        if (state) state.lastFailureAt = this.now;
        this.failedPops.push({ id: `fail_${this.popCounter++}`, serviceId, remainingMs: FAILED_POP_MS });
    }

    // ── Bookkeeping ──────────────────────────────────────────────────

    private accrueInfrastructureCost(ctx: StepContext, dt: number): void {
        let perSecond = 0;
        for (const svc of ctx.services.values()) perSecond += getServiceConfig(svc.type).costPerSecond;
        const amount = (perSecond * dt) / 1000;
        this.metricsCollector.recordCost(this.now, amount);
        if (this.runActive && this.run && this.run.elapsedMs < this.run.durationMs) {
            this.run.collector.cost += amount;
        }
    }

    private removeFinished(): void {
        this.requests = this.requests.filter((r) => r.status !== 'completed' && r.status !== 'failed');
        for (const state of this.runtime.values()) {
            state.queue = state.queue.filter((r) => r.status === 'queued');
            state.processing = state.processing.filter((r) => r.status === 'processing');
            state.backlog = state.backlog.filter((r) => r.status === 'backlogged');
            state.waiting = state.waiting.filter((r) => r.status === 'waiting');
            if (state.processingProgress.size > state.processing.length) {
                const live = new Set(state.processing.map((r) => r.id));
                for (const id of [...state.processingProgress.keys()]) {
                    if (!live.has(id)) state.processingProgress.delete(id);
                }
            }
        }
    }

    private decayPops(dt: number): void {
        if (this.failedPops.length === 0) return;
        this.failedPops = this.failedPops
            .map((pop) => ({ ...pop, remainingMs: pop.remainingMs - dt }))
            .filter((pop) => pop.remainingMs > 0);
    }

    /** Close the run once traffic stopped and every client request finished (or timed out) */
    private advanceRun(dt: number): void {
        const run = this.run;
        if (!run || run.finished) return;
        run.elapsedMs += dt;
        if (run.elapsedMs < run.durationMs) return;

        const waiting = this.requests.filter((r) => r.kind === 'client');
        if (waiting.length > 0 && run.elapsedMs < run.durationMs + RUN_DRAIN_MS) return;

        for (const req of waiting) {
            req.status = 'failed';
            run.collector.recordFailure();
            this.metricsCollector.recordFailure(this.now);
        }
        run.finished = true;
        run.summary = run.collector.summarize(run.durationMs);
        this.removeFinished();
    }

    private get runActive(): boolean {
        return this.run !== null && !this.run.finished;
    }

    private isDown(serviceId: string): boolean {
        const run = this.run;
        if (!run || run.finished) return false;
        return run.outages.some(
            (o) => o.serviceId === serviceId && run.elapsedMs >= o.atMs && run.elapsedMs < o.atMs + o.durationMs,
        );
    }

    private phaseLabel(run: ActiveRun): string {
        if (run.finished) return 'Done';
        if (run.elapsedMs >= run.durationMs) return 'Draining';
        for (const pattern of this.traffic.values()) {
            let start = 0;
            for (const phase of pattern.phases ?? []) {
                if (run.elapsedMs < start + phase.durationMs) return phase.label;
                start += phase.durationMs;
            }
        }
        return 'Live traffic';
    }

    /** An answer for a missed resource passed back through the cache: store it and answer everyone waiting */
    private fillCache(cacheId: string, resource: string): void {
        const state = this.runtime.get(cacheId);
        if (!state) return;
        this.entriesOf(cacheId).set(resource, this.now);
        this.cacheFills.get(cacheId)?.delete(resource);
        const stats = this.statsOf(cacheId);
        for (const waiter of state.waiting) {
            if (waiter.status !== 'waiting' || waiter.resource !== resource) continue;
            stats.hits++;
            this.respond(waiter);
        }
        state.waiting = state.waiting.filter((r) => r.status === 'waiting');
    }

    /** Reads waiting on a fetch that failed or timed out go fetch for themselves */
    private retryAbandonedWaits(svc: PlacedService, state: ServiceRuntimeState, ctx: StepContext): void {
        if (state.waiting.length === 0) return;
        const fills = this.fillsOf(svc.id);
        const abandoned = state.waiting.filter((req) => {
            const started = fills.get(req.resource);
            return started === undefined || this.now - started >= CACHE_FILL_TIMEOUT_MS;
        });
        if (abandoned.length === 0) return;
        state.waiting = state.waiting.filter((req) => !abandoned.includes(req));
        for (const req of abandoned) {
            if (fills.has(req.resource) && this.now - (fills.get(req.resource) ?? 0) >= CACHE_FILL_TIMEOUT_MS) {
                fills.delete(req.resource);
            }
            this.completeAtCache(svc, req, ctx);
        }
    }

    private fillsOf(cacheId: string): Map<string, number> {
        let fills = this.cacheFills.get(cacheId);
        if (!fills) {
            fills = new Map();
            this.cacheFills.set(cacheId, fills);
        }
        return fills;
    }

    private entriesOf(cacheId: string): Map<string, number> {
        let entries = this.cacheEntries.get(cacheId);
        if (!entries) {
            entries = new Map();
            this.cacheEntries.set(cacheId, entries);
        }
        return entries;
    }

    private statsOf(cacheId: string): { hits: number; misses: number } {
        let stats = this.cacheStats.get(cacheId);
        if (!stats) {
            stats = { hits: 0, misses: 0 };
            this.cacheStats.set(cacheId, stats);
        }
        return stats;
    }

    private freshEntries(cacheId: string): number {
        let count = 0;
        for (const storedAt of this.cacheEntries.get(cacheId)?.values() ?? []) {
            if (this.now - storedAt < CACHE_TTL_MS) count++;
        }
        return count;
    }
}
