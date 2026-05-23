import { TestBed } from '@angular/core/testing';
import { GameStateService } from '../game/game-state.service';
import { ServiceType } from '../game/service-types.config';
import { RequestMethod } from '../game/sim-types';
import { TickEngineService } from '../game/tick-engine.service';
import { StorageService } from '../storage/storage.service';
import { ChallengeService } from './challenge.service';
import { mustConnect, mustFind, mustPlace, runTicks } from './challenge-test-helpers';

const mockStorage = { getItem: () => null, setItem: () => {} };

describe('Level 7: Two Paths:star evaluation', () => {
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

        challengeService.loadChallenge('level-7');
    });

    afterEach(() => {
        TestBed.resetTestingModule();
    });

    it('earns 0 stars initially (pre-drawn Origin→REST₁ and Origin→REST₂, no downstream paths)', () => {
        runTicks(tickEngine, 1000);
        expect(challengeService.starStatus()).toEqual([false, false, false]);
    });

    it('earns 1 star when both downstream paths are built with no route rules', () => {
        const rests = gameState.services().filter((s) => s.type === ServiceType.REST_SERVICE);
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const cache = mustPlace(gameState, ServiceType.CACHE, 10, 2);
        const mq = mustPlace(gameState, ServiceType.MESSAGE_QUEUE, 10, 9);

        gameState.addConnection({ serviceId: rests[0].id, portIndex: 1 }, { serviceId: cache.id, portIndex: 0 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });
        gameState.addConnection({ serviceId: rests[1].id, portIndex: 1 }, { serviceId: mq.id, portIndex: 0 });
        gameState.addConnection({ serviceId: mq.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(false);
        expect(stars[2]).toBe(false);
    });

    it('earns 2 stars when origin traffic is split by method', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const rests = gameState.services().filter((s) => s.type === ServiceType.REST_SERVICE);
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const cache = mustPlace(gameState, ServiceType.CACHE, 10, 2);
        const mq = mustPlace(gameState, ServiceType.MESSAGE_QUEUE, 10, 9);

        gameState.addConnection({ serviceId: rests[0].id, portIndex: 1 }, { serviceId: cache.id, portIndex: 0 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });
        gameState.addConnection({ serviceId: rests[1].id, portIndex: 1 }, { serviceId: mq.id, portIndex: 0 });
        gameState.addConnection({ serviceId: mq.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        // Filter the pre-drawn Origin→REST connections
        const originConns = gameState.connections().filter((c) => c.source.serviceId === origin.id);
        const toRest0 = originConns.find((c) => c.target.serviceId === rests[0].id);
        const toRest1 = originConns.find((c) => c.target.serviceId === rests[1].id);
        if (toRest0) gameState.updateConnectionFilter(toRest0.id, { methods: [RequestMethod.GET], weight: 100 });
        if (toRest1)
            gameState.updateConnectionFilter(toRest1.id, {
                methods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
                weight: 100,
            });

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(true);
        expect(stars[2]).toBe(false);
    });

    it('earns 3 stars with double-ruling: origin + downstream both filtered', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const rests = gameState.services().filter((s) => s.type === ServiceType.REST_SERVICE);
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const cache = mustPlace(gameState, ServiceType.CACHE, 10, 2);
        const mq = mustPlace(gameState, ServiceType.MESSAGE_QUEUE, 10, 9);

        const cacheConn = mustConnect(
            gameState,
            { serviceId: rests[0].id, portIndex: 1 },
            { serviceId: cache.id, portIndex: 0 },
        );
        gameState.updateConnectionFilter(cacheConn.id, { methods: [RequestMethod.GET], weight: 100 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        const mqConn = mustConnect(
            gameState,
            { serviceId: rests[1].id, portIndex: 1 },
            { serviceId: mq.id, portIndex: 0 },
        );
        gameState.updateConnectionFilter(mqConn.id, {
            methods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
            weight: 100,
        });
        gameState.addConnection({ serviceId: mq.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        const originConns = gameState.connections().filter((c) => c.source.serviceId === origin.id);
        const toRest0 = originConns.find((c) => c.target.serviceId === rests[0].id);
        const toRest1 = originConns.find((c) => c.target.serviceId === rests[1].id);
        if (toRest0) gameState.updateConnectionFilter(toRest0.id, { methods: [RequestMethod.GET], weight: 100 });
        if (toRest1)
            gameState.updateConnectionFilter(toRest1.id, {
                methods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
                weight: 100,
            });

        runTicks(tickEngine, 1000);
        expect(challengeService.starStatus()).toEqual([true, true, true]);
    });
});
