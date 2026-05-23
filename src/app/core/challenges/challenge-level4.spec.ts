import { TestBed } from '@angular/core/testing';
import { GameStateService } from '../game/game-state.service';
import { ServiceType } from '../game/service-types.config';
import { RequestMethod } from '../game/sim-types';
import { TickEngineService } from '../game/tick-engine.service';
import { StorageService } from '../storage/storage.service';
import { ChallengeService } from './challenge.service';
import { mustConnect, mustFind, mustPlace, runTicks } from './challenge-test-helpers';

const mockStorage = { getItem: () => null, setItem: () => {} };

describe('Level 4: Write Buffer — star evaluation', () => {
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

    it('earns 0 stars initially (pre-drawn bypass only, no MQ connected)', () => {
        runTicks(tickEngine, 1000);
        expect(challengeService.starStatus()).toEqual([false, false, false]);
    });

    it('earns 1 star when MQ path exists with no filter (reads + writes both flow through it)', () => {
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const mq = mustPlace(gameState, ServiceType.MESSAGE_QUEUE, 9, 4);

        gameState.addConnection({ serviceId: rest.id, portIndex: 1 }, { serviceId: mq.id, portIndex: 0 });
        gameState.addConnection({ serviceId: mq.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(false);
        expect(stars[2]).toBe(false);
    });

    it('earns 2 stars when MQ path exists and write-only filter is applied', () => {
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const mq = mustPlace(gameState, ServiceType.MESSAGE_QUEUE, 9, 4);

        const mqConn = mustConnect(gameState, { serviceId: rest.id, portIndex: 1 }, { serviceId: mq.id, portIndex: 0 });
        gameState.updateConnectionFilter(mqConn.id, {
            methods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
            weight: 100,
        });
        gameState.addConnection({ serviceId: mq.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(true);
        expect(stars[2]).toBe(false);
    });

    it('earns 3 stars with write filter on REST→MQ and GET filter on REST→DB', () => {
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const mq = mustPlace(gameState, ServiceType.MESSAGE_QUEUE, 9, 4);

        const mqConn = mustConnect(gameState, { serviceId: rest.id, portIndex: 1 }, { serviceId: mq.id, portIndex: 0 });
        gameState.updateConnectionFilter(mqConn.id, {
            methods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
            weight: 100,
        });
        gameState.addConnection({ serviceId: mq.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        // Apply GET filter on the pre-drawn REST→DB connection
        const dbConn = gameState
            .connections()
            .find((c) => c.source.serviceId === rest.id && c.target.serviceId === db.id);
        if (dbConn) {
            gameState.updateConnectionFilter(dbConn.id, { methods: [RequestMethod.GET], weight: 100 });
        }

        runTicks(tickEngine, 1000);
        expect(challengeService.starStatus()).toEqual([true, true, true]);
    });
});
