import { TestBed } from '@angular/core/testing';
import { GameStateService } from '../game/game-state.service';
import { ServiceType } from '../game/service-types.config';
import { RequestMethod } from '../game/sim-types';
import { TickEngineService } from '../game/tick-engine.service';
import { StorageService } from '../storage/storage.service';
import { ChallengeService } from './challenge.service';
import { mustConnect, mustFind, mustPlace, runTicks } from './challenge-test-helpers';

const mockStorage = { getItem: () => null, setItem: () => {} };

describe('Level 8: Full Stack:star evaluation', () => {
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

        challengeService.loadChallenge('level-8');
    });

    afterEach(() => {
        TestBed.resetTestingModule();
    });

    it('earns 0 stars initially (only Origin and DB pre-placed, nothing connected)', () => {
        runTicks(tickEngine, 1000);
        expect(challengeService.starStatus()).toEqual([false, false, false]);
    });

    it('earns 1 star with minimal demo: Origin → GW → REST → DB (no LB)', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const gw = mustPlace(gameState, ServiceType.API_GATEWAY, 3, 5);
        const rest = mustPlace(gameState, ServiceType.REST_SERVICE, 9, 5);

        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: gw.id, portIndex: 0 });
        gameState.addConnection({ serviceId: gw.id, portIndex: 1 }, { serviceId: rest.id, portIndex: 0 });
        gameState.addConnection({ serviceId: rest.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(false);
        expect(stars[2]).toBe(false);
    });

    it('earns 2 stars with all components wired but no method filters', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const gw = mustPlace(gameState, ServiceType.API_GATEWAY, 3, 5);
        const lb = mustPlace(gameState, ServiceType.LOAD_BALANCER, 7, 5);
        const rest1 = mustPlace(gameState, ServiceType.REST_SERVICE, 11, 3);
        const rest2 = mustPlace(gameState, ServiceType.REST_SERVICE, 11, 8);
        const cache = mustPlace(gameState, ServiceType.CACHE, 14, 2);
        const mq = mustPlace(gameState, ServiceType.MESSAGE_QUEUE, 14, 7);

        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: gw.id, portIndex: 0 });
        gameState.addConnection({ serviceId: gw.id, portIndex: 1 }, { serviceId: lb.id, portIndex: 0 });
        gameState.addConnection({ serviceId: lb.id, portIndex: 1 }, { serviceId: rest1.id, portIndex: 0 });
        gameState.addConnection({ serviceId: lb.id, portIndex: 2 }, { serviceId: rest2.id, portIndex: 0 });
        // rest1 → Cache → DB (unfiltered)
        gameState.addConnection({ serviceId: rest1.id, portIndex: 1 }, { serviceId: cache.id, portIndex: 0 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });
        // rest2 → MQ → DB (unfiltered)
        gameState.addConnection({ serviceId: rest2.id, portIndex: 1 }, { serviceId: mq.id, portIndex: 0 });
        gameState.addConnection({ serviceId: mq.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(true);
        expect(stars[2]).toBe(false);
    });

    it('earns 3 stars with both backends, Cache GET-only and MQ write-only', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const gw = mustPlace(gameState, ServiceType.API_GATEWAY, 3, 5);
        const lb = mustPlace(gameState, ServiceType.LOAD_BALANCER, 7, 5);
        const rest1 = mustPlace(gameState, ServiceType.REST_SERVICE, 11, 3);
        const rest2 = mustPlace(gameState, ServiceType.REST_SERVICE, 11, 9);
        const cache = mustPlace(gameState, ServiceType.CACHE, 14, 2);
        const mq = mustPlace(gameState, ServiceType.MESSAGE_QUEUE, 14, 8);

        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: gw.id, portIndex: 0 });
        gameState.addConnection({ serviceId: gw.id, portIndex: 1 }, { serviceId: lb.id, portIndex: 0 });
        gameState.addConnection({ serviceId: lb.id, portIndex: 1 }, { serviceId: rest1.id, portIndex: 0 });
        gameState.addConnection({ serviceId: lb.id, portIndex: 2 }, { serviceId: rest2.id, portIndex: 0 });
        // rest1 → Cache (GET-only) → DB
        const cacheConn = mustConnect(
            gameState,
            { serviceId: rest1.id, portIndex: 1 },
            { serviceId: cache.id, portIndex: 0 },
        );
        gameState.updateConnectionFilter(cacheConn.id, { methods: [RequestMethod.GET], weight: 100 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });
        // rest2 → MQ (write-only) → DB
        const mqConn = mustConnect(
            gameState,
            { serviceId: rest2.id, portIndex: 1 },
            { serviceId: mq.id, portIndex: 0 },
        );
        gameState.updateConnectionFilter(mqConn.id, {
            methods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
            weight: 100,
        });
        gameState.addConnection({ serviceId: mq.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        runTicks(tickEngine, 1000);
        expect(challengeService.starStatus()).toEqual([true, true, true]);
    });
});
