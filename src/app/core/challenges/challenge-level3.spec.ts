import { TestBed } from '@angular/core/testing';
import { GameStateService } from '../game/game-state.service';
import { ServiceType } from '../game/service-types.config';
import { TickEngineService } from '../game/tick-engine.service';
import { StorageService } from '../storage/storage.service';
import { ChallengeService } from './challenge.service';
import { mustFind, mustPlace, runTicks } from './challenge-test-helpers';

const mockStorage = { getItem: () => null, setItem: () => {} };

describe('Level 3: Two Backends — star evaluation', () => {
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

        challengeService.loadChallenge('level-3');
    });

    afterEach(() => {
        TestBed.resetTestingModule();
    });

    it('earns 0 stars initially (Origin→REST₁ and both REST→DB pre-drawn)', () => {
        runTicks(tickEngine, 6000);
        expect(challengeService.starStatus()).toEqual([false, false, false]);
    });

    it('earns 1 star when LB is placed and a full path through it exists (bypass still present)', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const lb = mustPlace(gameState, ServiceType.LOAD_BALANCER, 4, 5);

        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: lb.id, portIndex: 0 });
        gameState.addConnection({ serviceId: lb.id, portIndex: 1 }, { serviceId: rest.id, portIndex: 0 });

        // Origin→REST₁ pre-drawn bypass still exists
        runTicks(tickEngine, 1000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(false);
        expect(stars[2]).toBe(false);
    });

    it('earns 2 stars when LB path exists and direct Origin→REST bypass is removed', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const lb = mustPlace(gameState, ServiceType.LOAD_BALANCER, 4, 5);

        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: lb.id, portIndex: 0 });
        gameState.addConnection({ serviceId: lb.id, portIndex: 1 }, { serviceId: rest.id, portIndex: 0 });

        // Remove the pre-drawn Origin→REST bypass
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

    it('earns all 3 stars after bypass removed and 5s of zero errors', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        const lb = mustPlace(gameState, ServiceType.LOAD_BALANCER, 4, 5);

        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: lb.id, portIndex: 0 });
        gameState.addConnection({ serviceId: lb.id, portIndex: 1 }, { serviceId: rest.id, portIndex: 0 });

        const bypass = gameState
            .connections()
            .find((c) => c.source.serviceId === origin.id && c.target.serviceId === rest.id);
        if (bypass) gameState.removeConnection(bypass.id);

        runTicks(tickEngine, 6000);
        expect(challengeService.starStatus()).toEqual([true, true, true]);
    });

    it('earns 0 stars when LB is placed but bypass is removed without wiring LB through to DB', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const rest = mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'rest');
        mustPlace(gameState, ServiceType.LOAD_BALANCER, 4, 5);

        // Remove bypass without connecting LB at all — system is broken
        const bypass = gameState
            .connections()
            .find((c) => c.source.serviceId === origin.id && c.target.serviceId === rest.id);
        if (bypass) gameState.removeConnection(bypass.id);

        runTicks(tickEngine, 6000);
        expect(challengeService.starStatus()).toEqual([false, false, false]);
    });

    it('both REST instances can be connected to LB outputs for full distribution', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const rests = gameState.services().filter((s) => s.type === ServiceType.REST_SERVICE);
        expect(rests.length).toBe(2);
        const lb = mustPlace(gameState, ServiceType.LOAD_BALANCER, 4, 5);

        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: lb.id, portIndex: 0 });
        gameState.addConnection({ serviceId: lb.id, portIndex: 1 }, { serviceId: rests[0].id, portIndex: 0 });
        gameState.addConnection({ serviceId: lb.id, portIndex: 2 }, { serviceId: rests[1].id, portIndex: 0 });

        const bypass = gameState
            .connections()
            .find((c) => c.source.serviceId === origin.id && c.target.serviceId === rests[0].id);
        if (bypass) gameState.removeConnection(bypass.id);

        runTicks(tickEngine, 6000);
        expect(challengeService.starStatus()).toEqual([true, true, true]);
    });
});
