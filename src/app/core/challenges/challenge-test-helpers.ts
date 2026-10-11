import type { GameStateService, PlacedService } from '../game/game-state.service';
import type { ServiceType } from '../game/service-types.config';
import type { TickEngineService } from '../game/tick-engine.service';

const TICK_MS = 1000 / 60;

export function runTicks(engine: TickEngineService, durationMs: number): void {
    const count = Math.ceil(durationMs / TICK_MS);
    for (let i = 0; i < count; i++) {
        engine.tickOnce(TICK_MS);
    }
}

export function mustFind<T>(items: T[], pred: (item: T) => boolean, label: string): T {
    const found = items.find(pred);
    if (!found) throw new Error(`Test setup: ${label} not found`);
    return found;
}

export function mustAt<T>(items: readonly T[], index: number, label: string): T {
    const item = items[index];
    if (item === undefined) throw new Error(`Test setup: ${label} missing at index ${index}`);
    return item;
}

export function mustPlace(gameState: GameStateService, type: ServiceType, x: number, y: number): PlacedService {
    const placed = gameState.addService(type, x, y);
    if (!placed) throw new Error(`Test setup: could not place ${type} at (${x},${y})`);
    return placed;
}

export function mustConnect(
    gameState: GameStateService,
    source: { serviceId: string; portIndex: number },
    target: { serviceId: string; portIndex: number },
): ReturnType<GameStateService['addConnection']> & {} {
    const conn = gameState.addConnection(source, target);
    if (!conn)
        throw new Error(
            `Test setup: could not connect ${source.serviceId}:${source.portIndex} → ${target.serviceId}:${target.portIndex}`,
        );
    return conn;
}
