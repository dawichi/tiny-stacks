import { TestBed } from '@angular/core/testing';
import { GameStateService } from '../game/game-state.service';
import { ServiceType } from '../game/service-types.config';
import { TickEngineService } from '../game/tick-engine.service';
import { StorageService } from '../storage/storage.service';
import { ChallengeService } from './challenge.service';
import { mustFind, mustPlace, runTicks } from './challenge-test-helpers';

const mockStorage = { getItem: () => null, setItem: () => {} };

describe('Level 2: Cache Layer — star evaluation', () => {
    let challengeService: ChallengeService;
    let tickEngine: TickEngineService;
    let gameState: GameStateService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                ChallengeService,
                TickEngineService,
                GameStateService,
                { provide: StorageService, useValue: mockStorage },
            ],
        });

        challengeService = TestBed.inject(ChallengeService);
        tickEngine = TestBed.inject(TickEngineService);
        gameState = TestBed.inject(GameStateService);

        challengeService.loadChallenge('level-2');
    });

    afterEach(() => {
        TestBed.resetTestingModule();
    });

    it('earns 0 stars initially (Origin→REST and REST→DB pre-drawn, no cache)', () => {
        runTicks(tickEngine, 6000);
        expect(challengeService.starStatus()).toEqual([false, false, false]);
    });

    it('earns 1 star when cache path is established but direct REST→DB bypass still exists', () => {
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const cache = mustPlace(gameState, ServiceType.CACHE, 8, 6);

        gameState.addConnection({ serviceId: rest.id, portIndex: 1 }, { serviceId: cache.id, portIndex: 0 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        // ★1 earned (REST→Cache→DB path exists), ★2 not earned (bypass still exists)
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(false);
        expect(stars[2]).toBe(false);
    });

    it('earns 2 stars when cache path exists and direct REST→DB bypass is removed', () => {
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const cache = mustPlace(gameState, ServiceType.CACHE, 8, 6);

        gameState.addConnection({ serviceId: rest.id, portIndex: 1 }, { serviceId: cache.id, portIndex: 0 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        // Remove the pre-drawn REST→DB bypass
        const bypass = gameState
            .connections()
            .find((c) => c.source.serviceId === rest.id && c.target.serviceId === db.id);
        if (bypass) gameState.removeConnection(bypass.id);

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        // ★2 earned (bypass gone), ★3 not yet (needs 10s of zero errors)
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(true);
        expect(stars[2]).toBe(false);
    });

    it('earns all 3 stars after bypass is removed and 10s of zero errors', () => {
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const cache = mustPlace(gameState, ServiceType.CACHE, 8, 6);

        gameState.addConnection({ serviceId: rest.id, portIndex: 1 }, { serviceId: cache.id, portIndex: 0 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        const bypass = gameState
            .connections()
            .find((c) => c.source.serviceId === rest.id && c.target.serviceId === db.id);
        if (bypass) gameState.removeConnection(bypass.id);

        runTicks(tickEngine, 11000);
        expect(challengeService.starStatus()).toEqual([true, true, true]);
    });

    it('earns 0 stars when cache is placed but not in the path (no REST→Cache connection)', () => {
        mustPlace(gameState, ServiceType.CACHE, 8, 6);
        runTicks(tickEngine, 6000);
        expect(challengeService.starStatus()).toEqual([false, false, false]);
    });
});
