import { computed, Injectable, inject, signal } from '@angular/core';
import { type Board, createConnectionId, createServiceId, GameStateService } from '../game/game-state.service';
import { ServiceType } from '../game/service-types.config';
import { RequestMethod } from '../game/sim-types';
import { StorageKeys, StorageService } from '../storage/storage.service';
import { TUTORIAL_STEPS } from './tutorial.model';

@Injectable({ providedIn: 'root' })
export class TutorialService {
    private readonly gameState = inject(GameStateService);
    private readonly storage = inject(StorageService);

    readonly steps = TUTORIAL_STEPS;

    readonly isTutorialComplete = signal(this.storage.getItem(StorageKeys.TUTORIAL_COMPLETE) === true);

    // IDs of pre-placed services, set during init()
    private readonly _originId = signal<string | null>(null);
    private readonly _restId = signal<string | null>(null);
    private readonly _dbId = signal<string | null>(null);

    // The Cache service is player-placed, detect by type
    private readonly _cacheId = computed(
        () => this.gameState.services().find((s) => s.type === ServiceType.CACHE)?.id ?? null,
    );

    // ── Step completion (sequential) ───────────────────────────────────

    /** Step 1: the Origin → Database backdoor is gone */
    readonly step1 = computed(() => {
        const originId = this._originId();
        const dbId = this._dbId();
        if (!originId || !dbId) return false;
        return !this.hasConnection(originId, dbId);
    });

    /** Step 2: Cache has been placed on the grid */
    readonly step2 = computed(() => this.step1() && this._cacheId() !== null);

    /** Step 3: REST → Cache connection exists */
    readonly step3 = computed(() => this.step2() && this.hasConnection(this._restId(), this._cacheId()));

    /** Step 4: Cache → Database connection exists */
    readonly step4 = computed(() => this.step3() && this.hasConnection(this._cacheId(), this._dbId()));

    /** Step 5: REST → Cache connection has a GET-only route rule */
    readonly step5 = computed(() => {
        if (!this.step4()) return false;
        const restId = this._restId();
        const cacheId = this._cacheId();
        const conn = this.gameState
            .connections()
            .find((c) => c.source.serviceId === restId && c.target.serviceId === cacheId);
        const methods = conn?.filter?.methods ?? [];
        return methods.length === 1 && methods[0] === RequestMethod.GET;
    });

    /** 0-indexed step the player is currently on (0-4). 5 = all complete. */
    readonly currentStepIndex = computed(() => {
        const done = [this.step1(), this.step2(), this.step3(), this.step4(), this.step5()];
        const next = done.indexOf(false);
        return next < 0 ? done.length : next;
    });

    readonly isComplete = computed(() => this.step5());

    /** Resources the palette offers during the tutorial */
    readonly availableResources: { type: ServiceType; count: number }[] = [{ type: ServiceType.CACHE, count: 1 }];

    // ── Board setup ────────────────────────────────────────────────────

    /** Load the tutorial board: Origin, REST and Database are locked; cables stay editable */
    init(): void {
        const origin = { id: createServiceId(), type: ServiceType.ORIGIN, gridX: 1, gridY: 6 };
        const rest = { id: createServiceId(), type: ServiceType.REST_SERVICE, gridX: 5, gridY: 5 };
        const db = { id: createServiceId(), type: ServiceType.DATABASE, gridX: 14, gridY: 4 };
        const board: Board = {
            services: [origin, rest, db],
            connections: [
                this.cable(origin.id, 0, rest.id, 0),
                this.cable(rest.id, 1, db.id, 0),
                // The backdoor the player removes in step 1
                this.cable(origin.id, 0, db.id, 0),
            ],
        };
        this.gameState.loadBoard(board, [origin.id, rest.id, db.id]);
        this._originId.set(origin.id);
        this._restId.set(rest.id);
        this._dbId.set(db.id);
    }

    complete(): void {
        this.storage.setItem(StorageKeys.TUTORIAL_COMPLETE, true);
        this.isTutorialComplete.set(true);
    }

    cleanup(): void {
        this.gameState.reset();
        this._originId.set(null);
        this._restId.set(null);
        this._dbId.set(null);
    }

    private cable(sourceId: string, sourcePort: number, targetId: string, targetPort: number) {
        return {
            id: createConnectionId(),
            source: { serviceId: sourceId, portIndex: sourcePort },
            target: { serviceId: targetId, portIndex: targetPort },
        };
    }

    private hasConnection(sourceId: string | null, targetId: string | null): boolean {
        if (!sourceId || !targetId) return false;
        return this.gameState
            .connections()
            .some((c) => c.source.serviceId === sourceId && c.target.serviceId === targetId);
    }
}
