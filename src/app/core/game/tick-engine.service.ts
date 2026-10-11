import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { GameStateService } from './game-state.service';
import type { RunState, SimMetrics, SimOutage, TrafficPattern } from './sim-types';
import { DEFAULT_TRAFFIC, type FailedPacket, type Packet, type ServiceVisualState, Simulation } from './simulation';

export { DEFAULT_TRAFFIC, type FailedPacket, type Packet, type ServiceVisualState } from './simulation';

const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

export type SimSpeed = 1 | 2 | 4;
export const SIM_SPEEDS: readonly SimSpeed[] = [1, 2, 4];

type TickListener = (simDeltaMs: number) => void;

const EMPTY_METRICS: SimMetrics = {
    totalCompleted: 0,
    totalFailed: 0,
    activeRequests: 0,
    avgLatency: 0,
    p95Latency: 0,
    throughput: 0,
    errorRate: 0,
    costPerSecond: 0,
    asyncPending: 0,
    asyncRetries: 0,
    asyncDropped: 0,
};

/**
 * Angular wrapper around `Simulation`: runs it on a 60 tps timer against the current board
 * and publishes a snapshot of its state as signals after every tick.
 */
@Injectable({
    providedIn: 'root',
})
export class TickEngineService {
    // ── Injected Services ──────────────────────────────────────────────
    private readonly gameState = inject(GameStateService);

    // ── State ──────────────────────────────────────────────────────────
    private readonly simulation = new Simulation();
    private readonly listeners = new Set<TickListener>();
    private intervalId: ReturnType<typeof setInterval> | null = null;

    readonly running = signal(false);

    /** Simulation steps per real tick: fast-forward without changing results */
    readonly speed = signal<SimSpeed>(1);

    /** Per-origin traffic patterns. Origins not listed use `DEFAULT_TRAFFIC`. */
    readonly trafficOverrides = signal<ReadonlyMap<string, TrafficPattern>>(new Map());
    readonly sandboxMode = signal(false);

    private readonly _metrics = signal<SimMetrics>(EMPTY_METRICS);
    private readonly _packets = signal<Packet[]>([]);
    private readonly _failedPackets = signal<FailedPacket[]>([]);
    private readonly _serviceVisuals = signal<Map<string, ServiceVisualState>>(new Map());
    private readonly _run = signal<RunState | null>(null);

    readonly metrics = this._metrics.asReadonly();
    readonly packets = this._packets.asReadonly();
    readonly failedPackets = this._failedPackets.asReadonly();
    readonly serviceVisuals = this._serviceVisuals.asReadonly();
    /** Scripted run in progress (or just finished); null while free-running */
    readonly run = this._run.asReadonly();

    constructor() {
        inject(DestroyRef).onDestroy(() => this.stop());
    }

    // ── Public Methods ─────────────────────────────────────────────────

    start(): void {
        if (this.running()) return;
        this.running.set(true);
        this.intervalId = setInterval(() => this.advance(TICK_MS, this.speed()), TICK_MS);
    }

    /** Stop the timer and clear every request, queue and metric */
    stop(): void {
        this.pause();
        this.simulation.reset();
        this.publish();
    }

    /** Stop the timer while preserving the current simulation snapshot and run results. */
    pause(): void {
        this.running.set(false);
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /** Execute a single step synchronously with a given simulated delta. For tests. */
    tickOnce(simDeltaMs: number): void {
        this.advance(simDeltaMs, 1);
    }

    /** Seed the random generator (routing and traffic mix). Takes effect on the next reset or run. */
    seed(seed: number): void {
        this.simulation.seed(seed);
    }

    /** Start a scripted run from an empty system (see `Simulation.startRun`) */
    startRun(outages: SimOutage[] = []): void {
        this.simulation.setTraffic(this.trafficOverrides());
        this.simulation.startRun(outages);
        this.publish();
    }

    /** Back to free-running baseline traffic */
    endRun(): void {
        this.simulation.endRun();
        this.publish();
    }

    /** Multiply an Origin's rate for a few seconds (sandbox) */
    spike(originId: string): void {
        this.simulation.spike(originId);
    }

    setOriginRps(originId: string, requestsPerSecond: number): void {
        const current = this.trafficOverrides();
        const updated = new Map(current);
        const pattern = current.get(originId) ?? DEFAULT_TRAFFIC;
        updated.set(originId, {
            ...pattern,
            requestsPerSecond: Math.min(200, Math.max(1, Math.round(requestsPerSecond))),
        });
        this.trafficOverrides.set(updated);
    }

    trafficFor(originId: string): TrafficPattern {
        this.simulation.setTraffic(this.trafficOverrides());
        return this.simulation.trafficFor(originId);
    }

    /** Subscribe to ticks. Returns the unsubscribe function. */
    onTick(listener: TickListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    // ── Private Methods ────────────────────────────────────────────────

    private advance(dt: number, steps: number): void {
        const board = { services: this.gameState.services(), connections: this.gameState.connections() };
        this.simulation.setTraffic(this.trafficOverrides());
        for (let i = 0; i < steps; i++) this.simulation.step(board, dt);
        this.publish();
        for (const listener of [...this.listeners]) listener(dt * steps);
    }

    private publish(): void {
        this._metrics.set(this.simulation.metrics());
        this._packets.set(this.simulation.packets());
        this._failedPackets.set(this.simulation.failedPackets());
        this._serviceVisuals.set(this.simulation.visuals(this.gameState.services()));
        this._run.set(this.simulation.runState());
    }
}
