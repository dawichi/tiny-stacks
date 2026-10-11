import { Injectable } from '@angular/core';
import type { ChallengeProgress } from '../challenges/challenge.model';
import type { Connection, PlacedService } from '../game/game-state.service';

// -----------------------------------------------------
// Keys enum - storage's available keys
// -----------------------------------------------------
export enum StorageKeys {
    GAME_STATE = 'tiny-stacks-state',
    CHALLENGE_PROGRESS = 'tiny-stacks-challenge-progress',
    TUTORIAL_COMPLETE = 'tiny-stacks-tutorial-complete',
}

/** Current version of the persisted sandbox board. Bump when the shape changes. */
export const SANDBOX_STATE_VERSION = 1;

/** Persisted sandbox board */
export interface SandboxState {
    version: number;
    services: PlacedService[];
    connections: Connection[];
    /** Requests per second per Origin id */
    originRps?: Record<string, number>;
}

// -----------------------------------------------------
// Type mapping - {key -> structure} associations
// -----------------------------------------------------
type StorageSchema = {
    [StorageKeys.GAME_STATE]: SandboxState;
    [StorageKeys.CHALLENGE_PROGRESS]: ChallengeProgress;
    [StorageKeys.TUTORIAL_COMPLETE]: true;
};

/**
 * Typed localStorage wrapper.
 * Provides compile-time type safety based on the key used. Values read back are untrusted:
 * callers must validate them (see `storage-schema.ts`).
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
    getItem<K extends StorageKeys>(key: K): StorageSchema[K] | null {
        const raw = localStorage.getItem(key);
        if (!raw) return null;

        try {
            return JSON.parse(raw) as StorageSchema[K];
        } catch {
            this.removeItem(key);
            return null;
        }
    }

    setItem<K extends StorageKeys>(key: K, value: StorageSchema[K]): void {
        localStorage.setItem(key, JSON.stringify(value));
    }

    removeItem(key: StorageKeys): void {
        localStorage.removeItem(key);
    }

    /** Remove every key owned by tiny-stacks (leaves other data on the same origin alone) */
    clearAll(): void {
        for (const key of Object.values(StorageKeys)) {
            localStorage.removeItem(key);
        }
    }
}
