import { TestBed } from '@angular/core/testing';
import { GameStateService } from '../game/game-state.service';
import { ServiceType } from '../game/service-types.config';
import { RequestMethod } from '../game/sim-types';
import { TickEngineService } from '../game/tick-engine.service';
import { StorageService } from '../storage/storage.service';
import { ChallengeService } from './challenge.service';
import { mustAt, mustConnect, mustFind, mustPlace, runTicks } from './challenge-test-helpers';

const mockStorage = { getItem: () => null, setItem: () => {} };

describe('Level 6: Scale + Cache:star evaluation', () => {
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

        challengeService.loadChallenge('level-6');
    });

    afterEach(() => {
        TestBed.resetTestingModule();
    });

    it('earns 0 stars initially (no LB or Cache placed, Origin not connected)', () => {
        runTicks(tickEngine, 1000);
        expect(challengeService.starStatus()).toEqual([false, false, false]);
    });

    it('earns 1 star when LB routes to both backends but no Cache placed', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const rests = gameState.services().filter((s) => s.type === ServiceType.REST_SERVICE);
        const rest1 = mustAt(rests, 0, 'first REST service');
        const rest2 = mustAt(rests, 1, 'second REST service');
        const lb = mustPlace(gameState, ServiceType.LOAD_BALANCER, 4, 5);

        // Both backends through LB; pre-drawn REST→DB connections already exist
        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: lb.id, portIndex: 0 });
        gameState.addConnection({ serviceId: lb.id, portIndex: 1 }, { serviceId: rest1.id, portIndex: 0 });
        gameState.addConnection({ serviceId: lb.id, portIndex: 2 }, { serviceId: rest2.id, portIndex: 0 });

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(false);
        expect(stars[2]).toBe(false);
    });

    it('earns 2 stars when both REST instances route through the shared Cache', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const rests = gameState.services().filter((s) => s.type === ServiceType.REST_SERVICE);
        const rest1 = mustAt(rests, 0, 'first REST service');
        const rest2 = mustAt(rests, 1, 'second REST service');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const lb = mustPlace(gameState, ServiceType.LOAD_BALANCER, 4, 5);
        const cache = mustPlace(gameState, ServiceType.CACHE, 12, 5);

        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: lb.id, portIndex: 0 });
        gameState.addConnection({ serviceId: lb.id, portIndex: 1 }, { serviceId: rest1.id, portIndex: 0 });
        gameState.addConnection({ serviceId: lb.id, portIndex: 2 }, { serviceId: rest2.id, portIndex: 0 });
        gameState.addConnection({ serviceId: rest1.id, portIndex: 1 }, { serviceId: cache.id, portIndex: 0 });
        gameState.addConnection({ serviceId: rest2.id, portIndex: 1 }, { serviceId: cache.id, portIndex: 0 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(true);
        expect(stars[2]).toBe(false);
    });

    it('earns 3 stars when both backends use shared Cache with GET-only filter', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const rests = gameState.services().filter((s) => s.type === ServiceType.REST_SERVICE);
        const rest1 = mustAt(rests, 0, 'first REST service');
        const rest2 = mustAt(rests, 1, 'second REST service');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const lb = mustPlace(gameState, ServiceType.LOAD_BALANCER, 4, 5);
        const cache = mustPlace(gameState, ServiceType.CACHE, 12, 5);

        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: lb.id, portIndex: 0 });
        gameState.addConnection({ serviceId: lb.id, portIndex: 1 }, { serviceId: rest1.id, portIndex: 0 });
        gameState.addConnection({ serviceId: lb.id, portIndex: 2 }, { serviceId: rest2.id, portIndex: 0 });

        const cacheConn0 = mustConnect(
            gameState,
            { serviceId: rest1.id, portIndex: 1 },
            { serviceId: cache.id, portIndex: 0 },
        );
        gameState.updateConnectionFilter(cacheConn0.id, { methods: [RequestMethod.GET], weight: 100 });

        const cacheConn1 = mustConnect(
            gameState,
            { serviceId: rest2.id, portIndex: 1 },
            { serviceId: cache.id, portIndex: 0 },
        );
        gameState.updateConnectionFilter(cacheConn1.id, { methods: [RequestMethod.GET], weight: 100 });

        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        for (const rest of [rest1, rest2]) {
            const directDbConnection = gameState
                .connections()
                .find((connection) => connection.source.serviceId === rest.id && connection.target.serviceId === db.id);
            if (!directDbConnection) throw new Error('REST→Database connection not found');
            gameState.updateConnectionFilter(directDbConnection.id, {
                methods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
                weight: 100,
            });
        }

        runTicks(tickEngine, 1000);
        expect(challengeService.starStatus()).toEqual([true, true, true]);
    });
});
