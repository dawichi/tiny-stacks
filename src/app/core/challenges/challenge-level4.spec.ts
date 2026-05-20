import { TestBed } from '@angular/core/testing';
import { GameStateService } from '../game/game-state.service';
import { ServiceType } from '../game/service-types.config';
import { RequestMethod } from '../game/sim-types';
import { TickEngineService } from '../game/tick-engine.service';
import { StorageService } from '../storage/storage.service';
import { ChallengeService } from './challenge.service';
import { mustConnect, mustFind, runTicks } from './challenge-test-helpers';

const mockStorage = { getItem: () => null, setItem: () => {} };

describe('Level 4: Smart Routes — star evaluation', () => {
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

        challengeService.loadChallenge('level-4');
    });

    afterEach(() => {
        TestBed.resetTestingModule();
    });

    it('earns 0 stars with only the pre-drawn Origin→REST connection', () => {
        runTicks(tickEngine, 6000);
        expect(challengeService.starStatus()).toEqual([false, false, false]);
    });

    it('earns 0 stars when only the read path (REST→Cache→DB) is connected but write path is missing', () => {
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const cache = mustFind(gameState.services(), (s) => s.type === ServiceType.CACHE, 'cache');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');

        gameState.addConnection({ serviceId: rest.id, portIndex: 1 }, { serviceId: cache.id, portIndex: 0 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        runTicks(tickEngine, 1000);
        // ★1 requires BOTH paths (REST→Cache→DB AND REST→DB direct)
        expect(challengeService.starStatus()[0]).toBe(false);
    });

    it('earns 1 star when both paths are connected (naive solution, no filters)', () => {
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const cache = mustFind(gameState.services(), (s) => s.type === ServiceType.CACHE, 'cache');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');

        gameState.addConnection({ serviceId: rest.id, portIndex: 1 }, { serviceId: cache.id, portIndex: 0 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });
        gameState.addConnection({ serviceId: rest.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(false);
        expect(stars[2]).toBe(false);
    });

    it('earns 2 stars after setting GET-only filter on REST→Cache', () => {
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const cache = mustFind(gameState.services(), (s) => s.type === ServiceType.CACHE, 'cache');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');

        const cacheConn = mustConnect(
            gameState,
            { serviceId: rest.id, portIndex: 1 },
            { serviceId: cache.id, portIndex: 0 },
        );
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });
        gameState.addConnection({ serviceId: rest.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });
        gameState.updateConnectionFilter(cacheConn.id, { methods: [RequestMethod.GET], weight: 100 });

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(true);
        expect(stars[2]).toBe(false);
    });

    it('earns all 3 stars with both filters set and zero errors for 5s', () => {
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const cache = mustFind(gameState.services(), (s) => s.type === ServiceType.CACHE, 'cache');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');

        const cacheConn = mustConnect(
            gameState,
            { serviceId: rest.id, portIndex: 1 },
            { serviceId: cache.id, portIndex: 0 },
        );
        gameState.updateConnectionFilter(cacheConn.id, { methods: [RequestMethod.GET], weight: 100 });

        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        const dbConn = mustConnect(gameState, { serviceId: rest.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });
        gameState.updateConnectionFilter(dbConn.id, {
            methods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
            weight: 100,
        });

        runTicks(tickEngine, 6000);
        expect(challengeService.starStatus()).toEqual([true, true, true]);
    });
});
