import { computed, DestroyRef, Injectable, inject, signal } from '@angular/core';
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

    // Cache state
    private cacheContents = new Map<string, Set<string>>();
    private _cacheStats = new Map<string, { hits: number; misses: number }>();

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
        const now = performance.now();
        const recentTimestamps = this._throughputTimestamps.filter((t) => now - t < THROUGHPUT_WINDOW_MS);
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
        this.tickCount = 0;
        this.spawnAccumulators.clear();
        this.resetMetrics();
        this.intervalId = setInterval(() => this.tick(), TICK_MS);
    }

    stop(): void {
        this.running.set(false);
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this._requests.set([]);
        this._runtimeStates.set(new Map());
        this.cacheContents.clear();
        this._cacheStats.clear();
        this.resetMetrics();
    }

    // ── Private: Metrics ──────────────────────────────────────────────
    private resetMetrics(): void {
        this._completedCount = 0;
        this._failedCount = 0;
        this._latencyWindow = [];
        this._throughputTimestamps = [];
        this._metricsVersion.set(0);
    }

    private recordCompletion(latency: number): void {
        this._completedCount++;
        this._throughputTimestamps.push(performance.now());
        this._latencyWindow.push(latency);
        if (this._latencyWindow.length > LATENCY_WINDOW_SIZE) {
            this._latencyWindow.shift();
        }
    }

    private recordFailure(): void {
        this._failedCount++;
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
                if (outgoing.length > 0) {
                    const conn = outgoing[Math.floor(Math.random() * outgoing.length)];
                    req.status = 'traveling';
                    req.connectionId = conn.id;
                    req.travelProgress = 0;
                    req.routeHistory.push(conn.id);
                } else {
                    // No downstream — respond with miss data
                    this.beginResponse(req);
                }
            }
        } else {
            // POST, PUT, DELETE: invalidate cached resource, forward normally
            cached.delete(req.resource);

            const outgoing = connections.filter((c) => c.source.serviceId === cacheServiceId);
            if (outgoing.length > 0) {
                const conn = outgoing[Math.floor(Math.random() * outgoing.length)];
                req.status = 'traveling';
                req.connectionId = conn.id;
                req.travelProgress = 0;
                req.routeHistory.push(conn.id);
            } else {
                this.beginResponse(req);
            }
        }
    }

    // ── Private: Tick Loop ─────────────────────────────────────────────
    private tick(): void {
        if (!this.running()) return;

        const simDelta = TICK_MS * this.speed();
        this.tickCount++;

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
                this.recordFailure();
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
                    if (outgoing.length > 0) {
                        const conn = outgoing[Math.floor(Math.random() * outgoing.length)];
                        req.status = 'traveling';
                        req.connectionId = conn.id;
                        req.travelProgress = 0;
                        req.routeHistory.push(conn.id);
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

        this._requests.set(requests);
        this._runtimeStates.set(runtimeStates);
        this._metricsVersion.update((v) => v + 1);
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

            const traffic = DEFAULT_TRAFFIC;
            const accumulator = (this.spawnAccumulators.get(origin.id) ?? 0) + simDelta;
            const msPerRequest = 1000 / traffic.requestsPerSecond;
            let remaining = accumulator;

            while (remaining >= msPerRequest) {
                remaining -= msPerRequest;

                // Pick method/resource from weighted distribution
                const { method, resource } = this.pickFromDistribution(traffic);

                // Pick a random outgoing connection
                const conn = outgoing[Math.floor(Math.random() * outgoing.length)];

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
