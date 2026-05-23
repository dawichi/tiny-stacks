import { computed, Injectable, inject, signal } from '@angular/core';
import { GameStateService } from '../game/game-state.service';
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
    private readonly _restId = signal<string | null>(null);
    private readonly _dbId = signal<string | null>(null);

    // The Cache service is player-placed, detect by type
    private readonly _cacheId = computed(
        () => this.gameState.services().find((s) => s.type === ServiceType.CACHE)?.id ?? null,
    );

    // ── Step completion (sequential) ───────────────────────────────────

    /** Step 1: Cache has been placed on the grid */
    readonly step1 = computed(() => this._cacheId() !== null);

    /** Step 2: REST → Cache connection exists */
    readonly step2 = computed(() => {
        if (!this.step1()) return false;
        const restId = this._restId();
        const cacheId = this._cacheId();
        if (!restId || !cacheId) return false;
        return this.gameState
            .connections()
            .some((c) => c.source.serviceId === restId && c.target.serviceId === cacheId);
    });

    /** Step 3: Cache → DB connection exists */
    readonly step3 = computed(() => {
        if (!this.step2()) return false;
        const cacheId = this._cacheId();
        const dbId = this._dbId();
        if (!cacheId || !dbId) return false;
        return this.gameState.connections().some((c) => c.source.serviceId === cacheId && c.target.serviceId === dbId);
    });

    /** Step 4: No direct REST → DB connection remains */
    readonly step4 = computed(() => {
        if (!this.step3()) return false;
        const restId = this._restId();
        const dbId = this._dbId();
        if (!restId || !dbId) return false;
        return !this.gameState.connections().some((c) => c.source.serviceId === restId && c.target.serviceId === dbId);
    });

    /** Step 5: REST → Cache connection has GET-only route rule */
    readonly step5 = computed(() => {
        if (!this.step4()) return false;
        const restId = this._restId();
        const cacheId = this._cacheId();
        if (!restId || !cacheId) return false;
        const conn = this.gameState
            .connections()
            .find((c) => c.source.serviceId === restId && c.target.serviceId === cacheId);
        const methods = conn?.filter?.methods ?? [];
        return methods.length === 1 && methods[0] === RequestMethod.GET;
    });

    /** 0-indexed step the player is currently on (0–4). 5 = all complete. */
    readonly currentStepIndex = computed(() => {
        if (this.step5()) return 5;
        if (this.step4()) return 4;
        if (this.step3()) return 3;
        if (this.step2()) return 2;
        if (this.step1()) return 1;
        return 0;
    });

    readonly isComplete = computed(() => this.step5());

    /** Resources the palette offers during the tutorial */
    readonly availableResources: { type: ServiceType; count: number }[] = [{ type: ServiceType.CACHE, count: 1 }];

    // ── Board setup ────────────────────────────────────────────────────

    init(): void {
        this.gameState.clearAll();
        this._restId.set(null);
        this._dbId.set(null);

        const origin = this.gameState.addService(ServiceType.ORIGIN, 1, 6);
        const rest = this.gameState.addService(ServiceType.REST_SERVICE, 5, 5);
        const db = this.gameState.addService(ServiceType.DATABASE, 14, 4);

        if (!origin || !rest || !db) return;

        this._restId.set(rest.id);
        this._dbId.set(db.id);

        // Origin → REST (permanent, player should not remove)
        this.gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: rest.id, portIndex: 0 });
        // REST → DB (player will remove this in step 4)
        this.gameState.addConnection({ serviceId: rest.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });
    }

    complete(): void {
        this.storage.setItem(StorageKeys.TUTORIAL_COMPLETE, true);
        this.isTutorialComplete.set(true);
    }

    cleanup(): void {
        this.gameState.clearAll();
        this._restId.set(null);
        this._dbId.set(null);
    }
}
