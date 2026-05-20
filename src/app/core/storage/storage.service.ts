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

// -----------------------------------------------------
// Type mapping - {key -> structure} associations
// -----------------------------------------------------
type StorageSchema = {
    [StorageKeys.GAME_STATE]: {
        services: PlacedService[];
        connections: Connection[];
    };
    [StorageKeys.CHALLENGE_PROGRESS]: ChallengeProgress;
    [StorageKeys.TUTORIAL_COMPLETE]: true;
};

/**
 * Typed localStorage wrapper.
 * Provides compile-time type safety based on the key used.
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

    clearAll(): void {
        localStorage.clear();
    }
}
