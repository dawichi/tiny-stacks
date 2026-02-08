import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { GameStateService } from './game-state.service';

/**
 * Request types with associated colors
 */
export enum RequestType {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
}

const REQUEST_COLORS: Record<RequestType, string> = {
    [RequestType.GET]: '#87CEEB',
    [RequestType.POST]: '#A8E6CF',
    [RequestType.PUT]: '#FFE5A0',
    [RequestType.DELETE]: '#FFCBA4',
};

const REQUEST_TYPES = Object.values(RequestType);

/**
 * A packet traveling along a connection
 */
export interface Packet {
    id: string;
    connectionId: string;
    progress: number; // 0 → 1
    color: string;
}

const TRAVEL_DURATION = 2000; // ms to traverse a connection
const SPAWN_INTERVAL_MIN = 300; // ms between spawns
const SPAWN_INTERVAL_MAX = 800;

@Injectable({
    providedIn: 'root',
})
export class SimulationService {
    // ── Injected Services ──────────────────────────────────────────────
    private readonly gameState = inject(GameStateService);
    private readonly destroyRef = inject(DestroyRef);

    // ── State ──────────────────────────────────────────────────────────
    readonly packets = signal<Packet[]>([]);
    readonly running = signal(false);

    private rafId: number | null = null;
    private lastFrameTime = 0;
    private nextSpawnTime = 0;
    private packetCounter = 0;

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
        this.lastFrameTime = performance.now();
        this.nextSpawnTime = this.lastFrameTime + this.randomSpawnDelay();
        this.tick(this.lastFrameTime);
    }

    stop(): void {
        this.running.set(false);
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    // ── Private Methods ────────────────────────────────────────────────
    private tick = (now: number): void => {
        if (!this.running()) return;

        const deltaTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        // Advance existing packets
        const connections = this.gameState.connections();
        const connectionIds = new Set(connections.map((c) => c.id));

        let updatedPackets = this.packets().map((p) => ({
            ...p,
            progress: p.progress + deltaTime / TRAVEL_DURATION,
        }));

        // Remove completed packets and packets on deleted connections
        updatedPackets = updatedPackets.filter((p) => p.progress < 1 && connectionIds.has(p.connectionId));

        // Spawn new packets
        if (now >= this.nextSpawnTime && connections.length > 0) {
            const conn = connections[Math.floor(Math.random() * connections.length)];
            const type = REQUEST_TYPES[Math.floor(Math.random() * REQUEST_TYPES.length)];

            updatedPackets.push({
                id: `pkt_${this.packetCounter++}`,
                connectionId: conn.id,
                progress: 0,
                color: REQUEST_COLORS[type],
            });

            this.nextSpawnTime = now + this.randomSpawnDelay();
        }

        this.packets.set(updatedPackets);
        this.rafId = requestAnimationFrame(this.tick);
    };

    private randomSpawnDelay(): number {
        return SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
    }
}
