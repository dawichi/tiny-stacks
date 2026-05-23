import { TestBed } from '@angular/core/testing';
import { GameStateService } from '../game/game-state.service';
import { ServiceType } from '../game/service-types.config';
import { TickEngineService } from '../game/tick-engine.service';
import { StorageService } from '../storage/storage.service';
import { ChallengeService } from './challenge.service';
import { mustFind, mustPlace, runTicks } from './challenge-test-helpers';

const mockStorage = { getItem: () => null, setItem: () => {} };

describe('Level 5: The Gateway — star evaluation', () => {
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

        challengeService.loadChallenge('level-5');
    });

    afterEach(() => {
        TestBed.resetTestingModule();
    });

    it('earns 0 stars initially (pre-drawn Origin→REST bypass, no GW)', () => {
        runTicks(tickEngine, 1000);
        expect(challengeService.starStatus()).toEqual([false, false, false]);
    });

    it('earns 1 star when GW path exists and bypass still present', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const gw = mustPlace(gameState, ServiceType.API_GATEWAY, 3, 5);

        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: gw.id, portIndex: 0 });
        gameState.addConnection({ serviceId: gw.id, portIndex: 1 }, { serviceId: rest.id, portIndex: 0 });
        // Origin→REST pre-drawn bypass still present

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(false);
        expect(stars[2]).toBe(false);
    });

    it('earns 2 stars when GW is sole entry point (bypass removed)', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const gw = mustPlace(gameState, ServiceType.API_GATEWAY, 3, 5);

        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: gw.id, portIndex: 0 });
        gameState.addConnection({ serviceId: gw.id, portIndex: 1 }, { serviceId: rest.id, portIndex: 0 });

        const bypass = gameState
            .connections()
            .find((c) => c.source.serviceId === origin.id && c.target.serviceId === rest.id);
        if (bypass) gameState.removeConnection(bypass.id);

        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(true);
        expect(stars[2]).toBe(false);
    });

    it('earns 3 stars when GW is sole entry AND Cache is on the read path', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const db = mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'database');
        const gw = mustPlace(gameState, ServiceType.API_GATEWAY, 3, 5);
        const cache = mustPlace(gameState, ServiceType.CACHE, 11, 3);

        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: gw.id, portIndex: 0 });
        gameState.addConnection({ serviceId: gw.id, portIndex: 1 }, { serviceId: rest.id, portIndex: 0 });

        const bypass = gameState
            .connections()
            .find((c) => c.source.serviceId === origin.id && c.target.serviceId === rest.id);
        if (bypass) gameState.removeConnection(bypass.id);

        gameState.addConnection({ serviceId: rest.id, portIndex: 1 }, { serviceId: cache.id, portIndex: 0 });
        gameState.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        runTicks(tickEngine, 1000);
        expect(challengeService.starStatus()).toEqual([true, true, true]);
    });
});
