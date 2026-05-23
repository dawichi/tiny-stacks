import { TestBed } from '@angular/core/testing';
import { GameStateService } from '../game/game-state.service';
import { ServiceType } from '../game/service-types.config';
import { RequestMethod } from '../game/sim-types';
import { TickEngineService } from '../game/tick-engine.service';
import { StorageService } from '../storage/storage.service';
import { ChallengeService } from './challenge.service';
import { mustConnect, mustFind, mustPlace, runTicks } from './challenge-test-helpers';

const mockStorage = { getItem: () => null, setItem: () => {} };

describe('Level 2: Cache Layer:star evaluation', () => {
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

        challengeService.loadChallenge('level-1');
    });

    afterEach(() => {
        TestBed.resetTestingModule();
    });

    it('earns 0 stars initially (no cache connected, bypass still present)', () => {
        runTicks(tickEngine, 1000);
        expect(challengeService.starStatus()).toEqual([false, false, false]);
    });

    it('earns 0 stars when cache is placed but not connected to REST or DB', () => {
        mustPlace(gameState, ServiceType.CACHE, 8, 6);
        runTicks(tickEngine, 1000);
        expect(challengeService.starStatus()).toEqual([false, false, false]);
    });

    it('earns 1 star when cache path exists and bypass still present (parallel routing)', () => {
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const cache = mustPlace(gameState, ServiceType.CACHE, 8, 6);

        gameState.addConnection({ serviceId: rest.id, portIndex: 1 }, { serviceId: cache.id, portIndex: 0 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });
        // Pre-drawn REST→DB bypass still present

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(false);
        expect(stars[2]).toBe(false);
    });

    it('earns 2 stars when cache path exists and bypass is removed (committed to cache)', () => {
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const cache = mustPlace(gameState, ServiceType.CACHE, 8, 6);

        gameState.addConnection({ serviceId: rest.id, portIndex: 1 }, { serviceId: cache.id, portIndex: 0 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        const bypass = gameState
            .connections()
            .find((c) => c.source.serviceId === rest.id && c.target.serviceId === db.id);
        if (bypass) gameState.removeConnection(bypass.id);

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(true);
        expect(stars[2]).toBe(false);
    });

    it('earns 3 stars with GET filter on REST→Cache and write filter on REST→DB (optimal split)', () => {
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const cache = mustPlace(gameState, ServiceType.CACHE, 8, 6);

        // Read path: REST→Cache (GET-only) → Cache→DB
        const cacheConn = mustConnect(
            gameState,
            { serviceId: rest.id, portIndex: 1 },
            { serviceId: cache.id, portIndex: 0 },
        );
        gameState.updateConnectionFilter(cacheConn.id, { methods: [RequestMethod.GET], weight: 100 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        // Write path: use the pre-drawn REST→DB and update its filter to writes-only
        const bypass = gameState
            .connections()
            .find((c) => c.source.serviceId === rest.id && c.target.serviceId === db.id);
        if (bypass) {
            gameState.updateConnectionFilter(bypass.id, {
                methods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
                weight: 100,
            });
        }

        runTicks(tickEngine, 1000);
        expect(challengeService.starStatus()).toEqual([true, true, true]);
    });

    it('★3 topology (filtered split) does not satisfy ★2 conditions (mutually exclusive)', () => {
        // ★2 requires pathNotExists([REST, DB]). ★3 keeps REST→DB (with write filter). Verify hierarchical eval awards ★3.
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const cache = mustPlace(gameState, ServiceType.CACHE, 8, 6);

        const cacheConn = mustConnect(
            gameState,
            { serviceId: rest.id, portIndex: 1 },
            { serviceId: cache.id, portIndex: 0 },
        );
        gameState.updateConnectionFilter(cacheConn.id, { methods: [RequestMethod.GET], weight: 100 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        const bypass = gameState
            .connections()
            .find((c) => c.source.serviceId === rest.id && c.target.serviceId === db.id);
        if (bypass) {
            gameState.updateConnectionFilter(bypass.id, {
                methods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
                weight: 100,
            });
        }

        runTicks(tickEngine, 1000);
        // Hierarchical eval: ★3 checked first → passes → all 3 stars awarded
        expect(challengeService.starStatus()).toEqual([true, true, true]);
    });
});
