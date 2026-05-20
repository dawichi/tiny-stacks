import { computed, DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { Connection } from './game-state.service';
import { GameStateService } from './game-state.service';
import { getServiceConfig, ServiceType } from './service-types.config';
import {
    type CacheStats,
    REQUEST_METHOD_COLORS,
    RequestMethod,
    type ServiceRuntimeState,
    type SimRequest,
    type TrafficPattern,
} from './sim-types';

/** Simulation constants */
const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE;
const HOP_DURATION = 300; // ms to travel along a connection
const LATENCY_WINDOW_SIZE = 100;
const THROUGHPUT_WINDOW_MS = 3000;

/** Default traffic pattern for Origin services */
const DEFAULT_TRAFFIC: TrafficPattern = {
    requestsPerSecond: 10,
    distribution: [
        { method: RequestMethod.GET, resource: 'users', weight: 40 },
        { method: RequestMethod.GET, resource: 'products', weight: 30 },
        { method: RequestMethod.POST, resource: 'users', weight: 15 },
        { method: RequestMethod.DELETE, resource: 'products', weight: 10 },
        { method: RequestMethod.PUT, resource: 'users', weight: 5 },
    ],
};

/**
 * Global simulation metrics
 */
export interface SimMetrics {
    totalCompleted: number;
    totalFailed: number;
    activeRequests: number;
    avgLatency: number;
    throughput: number;
}

/**
 * Per-service visual state derived from runtime simulation data
 */
export interface ServiceVisualState {
    queueRatio: number;
    processingRatio: number;
    isOverloaded: boolean;
    queueCount: number;
    processingCount: number;
    queueCapacity: number;
    maxConcurrency: number;
    cacheStats?: CacheStats;
}

/**
 * Packet shape matching the old SimulationService for board compatibility
 */
export interface Packet {
    id: string;
    connectionId: string;
    progress: number;
    color: string;
    direction: 'forward' | 'response';
}

/**
 * A failed request shown as a fading red pop at a service
 */
export interface FailedPacket {
    id: string;
    serviceId: string;
    remainingMs: number;
}

const FAILED_PACKET_DURATION = 500; // ms for the pop animation

/**
 * Tick-based simulation engine.
 *
 * Replaces the decorative SimulationService with a real request lifecycle:
 * Origin spawns → travel along connections → queue at services → process → forward or complete.
 */
@Injectable({
    providedIn: 'root',
})
export class TickEngineService {
    // ── Injected Services ──────────────────────────────────────────────
    private readonly gameState = inject(GameStateService);
    private readonly destroyRef = inject(DestroyRef);

    // ── State ──────────────────────────────────────────────────────────
    readonly running = signal(false);
    readonly speed = signal(1);

    /** Per-origin traffic pattern overrides (set by ChallengeService) */
    readonly trafficOverrides = signal<Map<string, TrafficPattern>>(new Map());

    /** Callback invoked each tick (used by ChallengeService for evaluation) */
    onTickCallback: ((simDelta: number) => void) | null = null;

    private readonly _requests = signal<SimRequest[]>([]);
    private readonly _runtimeStates = signal<Map<string, ServiceRuntimeState>>(new Map());
    private readonly _metricsVersion = signal(0);

    private intervalId: ReturnType<typeof setInterval> | null = null;
    private tickCount = 0;
    private requestCounter = 0;
    private spawnAccumulators = new Map<string, number>();

    // Metrics tracking
    private _completedCount = 0;
    private _failedCount = 0;
    private _latencyWindow: number[] = [];
    private _throughputTimestamps: number[] = [];
    /** Accumulated simulated time in ms — used for throughput window instead of wall-clock */
    private _simTimeMs = 0;

    // Cache state
    private cacheContents = new Map<string, Set<string>>();
    private _cacheStats = new Map<string, { hits: number; misses: number }>();

    // Failed packet animations
    private readonly _failedPackets = signal<FailedPacket[]>([]);
    readonly failedPackets = this._failedPackets.asReadonly();
    private failedCounter = 0;

    // ── Computed: packets for board rendering ──────────────────────────
    readonly packets = computed<Packet[]>(() => {
        const requests = this._requests();
        return requests
            .filter(
                (r): r is SimRequest & { connectionId: string } => r.status === 'traveling' && r.connectionId !== null,
            )
            .map((r) => ({
                id: r.id,
                connectionId: r.connectionId,
                progress: r.travelProgress,
                color: REQUEST_METHOD_COLORS[r.method],
                direction: r.direction,
            }));
    });

    // ── Computed: per-service visual state ───────────────────────────
    readonly serviceVisuals = computed<Map<string, ServiceVisualState>>(() => {
        const states = this._runtimeStates();
        const services = this.gameState.services();
        const result = new Map<string, ServiceVisualState>();

        for (const svc of services) {
            if (svc.type === ServiceType.ORIGIN) continue;

            const state = states.get(svc.id);
            if (!state) continue;

            const config = getServiceConfig(svc.type);
            const queueRatio = config.queueSize > 0 ? state.queue.length / config.queueSize : 0;
            const processingRatio = config.maxConcurrency > 0 ? state.processing.length / config.maxConcurrency : 0;

            const visual: ServiceVisualState = {
                queueRatio,
                processingRatio,
                isOverloaded: queueRatio > 0.8,
                queueCount: state.queue.length,
                processingCount: state.processing.length,
                queueCapacity: config.queueSize,
                maxConcurrency: config.maxConcurrency,
            };

            if (svc.type === ServiceType.CACHE) {
                const stats = this._cacheStats.get(svc.id);
                if (stats) {
                    visual.cacheStats = {
                        hitCount: stats.hits,
                        missCount: stats.misses,
                        cachedResources: this.cacheContents.get(svc.id)?.size ?? 0,
                    };
                }
            }

            result.set(svc.id, visual);
        }

        return result;
    });

    // ── Computed: global simulation metrics ────────────────────────────
    readonly metrics = computed<SimMetrics>(() => {
        this._metricsVersion();
        const simNow = this._simTimeMs;
        const recentTimestamps = this._throughputTimestamps.filter((t) => simNow - t < THROUGHPUT_WINDOW_MS);
        const throughput = recentTimestamps.length > 0 ? (recentTimestamps.length / THROUGHPUT_WINDOW_MS) * 1000 : 0;
        const avgLatency =
            this._latencyWindow.length > 0
                ? this._latencyWindow.reduce((sum, l) => sum + l, 0) / this._latencyWindow.length
                : 0;

        return {
            totalCompleted: this._completedCount,
            totalFailed: this._failedCount,
            activeRequests: this._requests().length,
            avgLatency,
            throughput,
        };
    });

    constructor() {
        this.destroyRef.onDestroy(() => this.stop());
    }

    // ── Public Methods ─────────────────────────────────────────────────
    toggle(): void {
        if (this.running()) {
            this.stop();
        } else {
            this.start();
        }
    }

    start(): void {
        if (this.running()) return;
        this.running.set(true);
        this.resetMetrics();
        this.intervalId = setInterval(() => this.tick(), TICK_MS);
    }

    /** Execute a single tick synchronously with a given simulated delta — for testing. */
    tickOnce(simDeltaMs: number): void {
        this.tickCount++;
        this.processSimulation(simDeltaMs);
    }

    /**
     * Capture a debug snapshot of the full simulation state for diagnostics.
     */
    debugSnapshot(): string {
        const services = this.gameState.services();
        const connections = this.gameState.connections();
        const requests = this._requests();
        const states = this._runtimeStates();

        const requestsByStatus: Record<string, number> = {};
        for (const r of requests) {
            const key = `${r.direction}:${r.status}`;
            requestsByStatus[key] = (requestsByStatus[key] ?? 0) + 1;
        }

        const serviceStates = services.map((svc) => {
            const config = getServiceConfig(svc.type);
            const state = states.get(svc.id);
            const outgoing = connections.filter((c) => c.source.serviceId === svc.id).length;
            const incoming = connections.filter((c) => c.target.serviceId === svc.id).length;
            const cacheStats = this._cacheStats.get(svc.id);
            const cachedResources = this.cacheContents.get(svc.id)?.size ?? 0;

            return {
                name: config.name,
                type: svc.type,
                queue: state ? `${state.queue.length}/${config.queueSize}` : '-',
                processing: state ? `${state.processing.length}/${config.maxConcurrency}` : '-',
                processingTime: `${config.baseProcessingTime}ms`,
                connections: `in:${incoming} out:${outgoing}`,
                ...(cacheStats
                    ? { cache: `hits:${cacheStats.hits} misses:${cacheStats.misses} cached:${cachedResources}` }
                    : {}),
            };
        });

        const snapshot = {
            tick: this.tickCount,
            speed: this.speed(),
            metrics: this.metrics(),
            requestsByStatus,
            totalRequests: requests.length,
            failedPacketAnims: this._failedPackets().length,
            services: serviceStates,
        };

        return JSON.stringify(snapshot, null, 2);
    }

    stop(): void {
        this.running.set(false);
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this._requests.set([]);
        this._runtimeStates.set(new Map());
        this._failedPackets.set([]);
        this.cacheContents.clear();
        this._cacheStats.clear();
        this.tickCount = 0;
        this.requestCounter = 0;
        this.spawnAccumulators.clear();
        this.resetMetrics();
    }

    // ── Private: Metrics ──────────────────────────────────────────────
    private resetMetrics(): void {
        this._completedCount = 0;
        this._failedCount = 0;
        this._latencyWindow = [];
        this._throughputTimestamps = [];
        this._simTimeMs = 0;
        this._metricsVersion.set(0);
    }

    private recordCompletion(latency: number): void {
        this._completedCount++;
        this._throughputTimestamps.push(this._simTimeMs);
        this._latencyWindow.push(latency);
        if (this._latencyWindow.length > LATENCY_WINDOW_SIZE) {
            this._latencyWindow.shift();
        }
    }

    private recordFailure(serviceId?: string): void {
        this._failedCount++;
        if (serviceId) {
            this._failedPackets.update((fps) => [
                ...fps,
                { id: `fail_${this.failedCounter++}`, serviceId, remainingMs: FAILED_PACKET_DURATION },
            ]);
        }
    }

    // ── Private: Response Path ──────────────────────────────────────────
    private beginResponse(req: SimRequest): void {
        req.direction = 'response';
        const nextConnId = req.routeHistory.pop();
        if (!nextConnId) {
            req.status = 'completed';
            this.recordCompletion(req.totalLatency);
            return;
        }
        req.status = 'traveling';
        req.connectionId = nextConnId;
        req.travelProgress = 0;
    }

    private continueResponse(req: SimRequest): void {
        const nextConnId = req.routeHistory.pop();
        if (!nextConnId) {
            req.status = 'completed';
            this.recordCompletion(req.totalLatency);
            return;
        }
        req.status = 'traveling';
        req.connectionId = nextConnId;
        req.travelProgress = 0;
    }

    // ── Private: Cache Logic ────────────────────────────────────────────
    private handleCacheCompletion(
        req: SimRequest,
        cacheServiceId: string,
        connections: ReturnType<GameStateService['connections']>,
    ): void {
        if (!this.cacheContents.has(cacheServiceId)) {
            this.cacheContents.set(cacheServiceId, new Set());
        }
        if (!this._cacheStats.has(cacheServiceId)) {
            this._cacheStats.set(cacheServiceId, { hits: 0, misses: 0 });
        }

        const cached = this.cacheContents.get(cacheServiceId);
        const stats = this._cacheStats.get(cacheServiceId);
        if (!cached || !stats) return;

        if (req.method === RequestMethod.GET) {
            if (cached.has(req.resource)) {
                // CACHE HIT: respond immediately
                stats.hits++;
                this.beginResponse(req);
            } else {
                // CACHE MISS: cache the resource, then forward to downstream
                stats.misses++;
                cached.add(req.resource);

                const outgoing = connections.filter((c) => c.source.serviceId === cacheServiceId);
                const conn = this.pickConnection(outgoing, req.method);
                if (conn) {
                    req.status = 'traveling';
                    req.connectionId = conn.id;
                    req.travelProgress = 0;
                    req.routeHistory.push(conn.id);
                } else {
                    this.beginResponse(req);
                }
            }
        } else {
            // POST, PUT, DELETE: invalidate cached resource, forward normally
            cached.delete(req.resource);

            const outgoing = connections.filter((c) => c.source.serviceId === cacheServiceId);
            const conn = this.pickConnection(outgoing, req.method);
            if (conn) {
                req.status = 'traveling';
                req.connectionId = conn.id;
                req.travelProgress = 0;
                req.routeHistory.push(conn.id);
            } else {
                this.beginResponse(req);
            }
        }
    }

    // ── Private: Filter-Aware Routing ──────────────────────────────────
    private pickConnection(outgoing: Connection[], method: RequestMethod): Connection | null {
        const eligible = outgoing.filter((c) => {
            if (!c.filter || c.filter.methods.length === 0) return true;
            return c.filter.methods.includes(method);
        });
        if (eligible.length === 0) return null;

        const totalWeight = eligible.reduce((sum, c) => sum + (c.filter?.weight ?? 100), 0);
        let roll = Math.random() * totalWeight;
        for (const conn of eligible) {
            roll -= conn.filter?.weight ?? 100;
            if (roll <= 0) return conn;
        }
        return eligible[eligible.length - 1];
    }

    // ── Private: Tick Loop ─────────────────────────────────────────────
    private tick(): void {
        if (!this.running()) return;
        this.tickCount++;
        this.processSimulation(TICK_MS * this.speed());
    }

    private processSimulation(simDelta: number): void {
        this._simTimeMs += simDelta;

        const services = this.gameState.services();
        const connections = this.gameState.connections();
        const connectionIds = new Set(connections.map((c) => c.id));

        let requests = [...this._requests()];
        const runtimeStates = new Map(this._runtimeStates());

        // Ensure runtime state exists for each service
        for (const svc of services) {
            if (!runtimeStates.has(svc.id)) {
                runtimeStates.set(svc.id, {
                    serviceId: svc.id,
                    queue: [],
                    processing: [],
                    processingProgress: new Map(),
                });
            }
        }

        // Clean up runtime states for removed services
        for (const key of runtimeStates.keys()) {
            if (!services.some((s) => s.id === key)) {
                runtimeStates.delete(key);
            }
        }

        // Remove requests on deleted connections or orphaned requests
        requests = requests.filter((r) => {
            if (r.status === 'traveling' && r.connectionId && !connectionIds.has(r.connectionId)) {
                return false;
            }
            if (!services.some((s) => s.id === r.currentServiceId)) {
                return false;
            }
            return true;
        });

        // 1. Origins spawn new requests
        this.spawnRequests(services, connections, requests, simDelta);

        // 2. Advance traveling requests
        for (const req of requests) {
            if (req.status === 'traveling' && req.connectionId) {
                req.travelProgress += simDelta / HOP_DURATION;
                req.totalLatency += simDelta;
            }
        }

        // 3. Deliver arrived requests
        const arrivedRequests = requests.filter((r) => r.status === 'traveling' && r.travelProgress >= 1);
        for (const req of arrivedRequests) {
            const conn = connections.find((c) => c.id === req.connectionId);
            if (!conn) {
                req.status = 'failed';
                this.recordFailure();
                continue;
            }

            if (req.direction === 'response') {
                // Response packet: arrives at the source side of the connection (traveling in reverse)
                const arrivalServiceId = conn.source.serviceId;
                req.currentServiceId = arrivalServiceId;
                req.connectionId = null;
                req.travelProgress = 0;

                if (arrivalServiceId === req.originServiceId) {
                    req.status = 'completed';
                    this.recordCompletion(req.totalLatency);
                } else {
                    this.continueResponse(req);
                }
                continue;
            }

            // Forward packet: enqueue at target service
            const targetServiceId = conn.target.serviceId;
            const targetService = services.find((s) => s.id === targetServiceId);
            if (!targetService) {
                req.status = 'failed';
                this.recordFailure();
                continue;
            }

            const targetConfig = getServiceConfig(targetService.type);
            const state = runtimeStates.get(targetServiceId);
            if (!state) {
                req.status = 'failed';
                this.recordFailure();
                continue;
            }

            // Check queue capacity
            if (state.queue.length + state.processing.length >= targetConfig.queueSize + targetConfig.maxConcurrency) {
                req.status = 'failed';
                this.recordFailure(targetServiceId);
            } else {
                req.status = 'queued';
                req.currentServiceId = targetServiceId;
                req.connectionId = null;
                req.travelProgress = 0;
                state.queue.push(req);
            }
        }

        // 4. Services process queued requests
        for (const svc of services) {
            if (svc.type === ServiceType.ORIGIN) continue;

            const config = getServiceConfig(svc.type);
            const state = runtimeStates.get(svc.id);
            if (!state) continue;

            // Move from queue to processing if concurrency allows
            while (state.processing.length < config.maxConcurrency && state.queue.length > 0) {
                const req = state.queue.shift();
                if (!req) break;
                req.status = 'processing';
                state.processing.push(req);
                state.processingProgress.set(req.id, 0);
            }

            // Advance processing
            const completed: SimRequest[] = [];
            for (const req of state.processing) {
                const progress = (state.processingProgress.get(req.id) ?? 0) + simDelta;
                state.processingProgress.set(req.id, progress);
                req.totalLatency += simDelta;

                if (progress >= config.baseProcessingTime) {
                    completed.push(req);
                }
            }

            // 5. Completed requests: forward, cache logic, or begin response
            for (const req of completed) {
                state.processing = state.processing.filter((r) => r.id !== req.id);
                state.processingProgress.delete(req.id);

                // Cache-specific behavior
                if (svc.type === ServiceType.CACHE && req.direction === 'forward') {
                    this.handleCacheCompletion(req, svc.id, connections);
                    continue;
                }

                if (req.direction === 'forward') {
                    const outgoing = connections.filter((c) => c.source.serviceId === svc.id);
                    const conn = this.pickConnection(outgoing, req.method);
                    if (conn) {
                        req.status = 'traveling';
                        req.connectionId = conn.id;
                        req.travelProgress = 0;
                        req.routeHistory.push(conn.id);
                    } else if (outgoing.length > 0) {
                        // Connections exist but none match this method → fail
                        req.status = 'failed';
                        this.recordFailure(svc.id);
                    } else {
                        this.beginResponse(req);
                    }
                } else {
                    this.continueResponse(req);
                }
            }
        }

        // Remove completed/failed requests
        requests = requests.filter((r) => r.status !== 'completed' && r.status !== 'failed');

        // Sync runtime state queue/processing references
        for (const state of runtimeStates.values()) {
            state.queue = state.queue.filter((r) => requests.includes(r));
            state.processing = state.processing.filter((r) => requests.includes(r));
        }

        // Decay failed packet animations
        const failedPackets = this._failedPackets().map((fp) => ({
            ...fp,
            remainingMs: fp.remainingMs - simDelta,
        }));
        this._failedPackets.set(failedPackets.filter((fp) => fp.remainingMs > 0));

        this._requests.set(requests);
        this._runtimeStates.set(runtimeStates);
        this._metricsVersion.update((v) => v + 1);

        // Notify challenge evaluator (if active)
        this.onTickCallback?.(simDelta);
    }

    private spawnRequests(
        services: ReturnType<GameStateService['services']>,
        connections: ReturnType<GameStateService['connections']>,
        requests: SimRequest[],
        simDelta: number,
    ): void {
        const origins = services.filter((s) => s.type === ServiceType.ORIGIN);

        for (const origin of origins) {
            // Find outgoing connections from this origin
            const outgoing = connections.filter((c) => c.source.serviceId === origin.id);
            if (outgoing.length === 0) continue;

            const traffic = this.trafficOverrides().get(origin.id) ?? DEFAULT_TRAFFIC;
            const accumulator = (this.spawnAccumulators.get(origin.id) ?? 0) + simDelta;
            const msPerRequest = 1000 / traffic.requestsPerSecond;
            let remaining = accumulator;

            while (remaining >= msPerRequest) {
                remaining -= msPerRequest;

                // Pick method/resource from weighted distribution
                const { method, resource } = this.pickFromDistribution(traffic);

                // Pick outgoing connection based on method filter + weight
                const conn = this.pickConnection(outgoing, method);
                if (!conn) continue;

                requests.push({
                    id: `req_${this.requestCounter++}`,
                    method,
                    resource,
                    status: 'traveling',
                    direction: 'forward',
                    currentServiceId: origin.id,
                    originServiceId: origin.id,
                    connectionId: conn.id,
                    travelProgress: 0,
                    spawnedAtTick: this.tickCount,
                    totalLatency: 0,
                    routeHistory: [conn.id],
                });
            }

            this.spawnAccumulators.set(origin.id, remaining);
        }
    }

    private pickFromDistribution(traffic: TrafficPattern): { method: RequestMethod; resource: string } {
        const totalWeight = traffic.distribution.reduce((sum, d) => sum + d.weight, 0);
        let roll = Math.random() * totalWeight;

        for (const entry of traffic.distribution) {
            roll -= entry.weight;
            if (roll <= 0) {
                return { method: entry.method, resource: entry.resource };
            }
        }

        // Fallback
        const last = traffic.distribution[traffic.distribution.length - 1];
        return { method: last.method, resource: last.resource };
    }
}
