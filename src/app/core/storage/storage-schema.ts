import type { ChallengeProgress, ChallengeProgressEntry } from '../challenges/challenge.model';
import {
    type Board,
    type Connection,
    canConnectOnBoard,
    canPlaceOnBoard,
    GRID_CONFIG,
    isServiceType,
    type PlacedService,
} from '../game/game-state.service';
import { ServiceType } from '../game/service-types.config';
import { RequestMethod } from '../game/sim-types';
import { SANDBOX_STATE_VERSION, type SandboxState } from './storage.service';

/**
 * Validation for data read back from localStorage. Anything that doesn't match the current
 * rules (unknown service types, overlapping tiles, dangling connections, bad ports) is dropped
 * instead of crashing the app on load.
 */

const METHODS = Object.values(RequestMethod) as string[];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Rebuild a board keeping only services and connections that are valid under the current rules */
export function sanitizeBoard(raw: { services?: unknown; connections?: unknown }): Board {
    const services: PlacedService[] = [];
    for (const item of Array.isArray(raw.services) ? raw.services : []) {
        if (!isRecord(item)) continue;
        const { id, type, gridX, gridY } = item;
        if (typeof id !== 'string' || !isServiceType(type)) continue;
        if (typeof gridX !== 'number' || typeof gridY !== 'number') continue;
        if (services.some((s) => s.id === id)) continue;
        if (!canPlaceOnBoard(services, GRID_CONFIG, type, gridX, gridY)) continue;
        services.push({ id, type, gridX, gridY });
    }

    const connections: Connection[] = [];
    for (const item of Array.isArray(raw.connections) ? raw.connections : []) {
        if (!isRecord(item) || typeof item['id'] !== 'string') continue;
        const source = item['source'];
        const target = item['target'];
        if (!isRecord(source) || !isRecord(target)) continue;
        if (typeof source['serviceId'] !== 'string' || typeof source['portIndex'] !== 'number') continue;
        if (typeof target['serviceId'] !== 'string' || typeof target['portIndex'] !== 'number') continue;
        const conn: Connection = {
            id: item['id'],
            source: { serviceId: source['serviceId'], portIndex: source['portIndex'] },
            target: { serviceId: target['serviceId'], portIndex: target['portIndex'] },
        };
        if (connections.some((c) => c.id === conn.id)) continue;
        if (!canConnectOnBoard(services, connections, conn.source, conn.target)) continue;

        const filter = item['filter'];
        if (isRecord(filter) && Array.isArray(filter['methods'])) {
            const methods = filter['methods'].filter((m): m is RequestMethod => METHODS.includes(m as string));
            const weight = typeof filter['weight'] === 'number' ? Math.min(100, Math.max(1, filter['weight'])) : 100;
            conn.filter = { methods: [...new Set(methods)], weight };
        }
        connections.push(conn);
    }

    return { services, connections };
}

/**
 * Parse the persisted sandbox. Legacy saves (no version field) are migrated; unknown versions are discarded.
 */
export function sanitizeSandboxState(raw: unknown): SandboxState | null {
    if (!isRecord(raw)) return null;
    const version = raw['version'] ?? 0;
    if (version !== 0 && version !== SANDBOX_STATE_VERSION) return null;

    const board = sanitizeBoard(raw);
    const originRps: Record<string, number> = {};
    const rawRps = raw['originRps'];
    if (isRecord(rawRps)) {
        for (const svc of board.services) {
            const rps = rawRps[svc.id];
            if (svc.type === ServiceType.ORIGIN && typeof rps === 'number' && Number.isFinite(rps)) {
                originRps[svc.id] = Math.min(200, Math.max(1, Math.round(rps)));
            }
        }
    }

    return { version: SANDBOX_STATE_VERSION, ...board, originRps };
}

/** Parse persisted challenge progress, clamping star counts and dropping malformed entries */
export function sanitizeProgress(raw: unknown): ChallengeProgress {
    const progress: ChallengeProgress = {};
    if (!isRecord(raw)) return progress;

    for (const [id, value] of Object.entries(raw)) {
        if (!isRecord(value) || typeof value['starsEarned'] !== 'number') continue;
        const entry: ChallengeProgressEntry = {
            starsEarned: Math.min(3, Math.max(0, Math.floor(value['starsEarned']))),
        };
        for (const key of ['bestP95', 'bestErrorRate', 'bestCost'] as const) {
            const stat = value[key];
            if (typeof stat === 'number' && Number.isFinite(stat)) entry[key] = stat;
        }
        progress[id] = entry;
    }
    return progress;
}
