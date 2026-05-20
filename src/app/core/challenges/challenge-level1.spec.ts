import { TestBed } from '@angular/core/testing';
import { GameStateService } from '../game/game-state.service';
import { ServiceType } from '../game/service-types.config';
import { TickEngineService } from '../game/tick-engine.service';
import { StorageService } from '../storage/storage.service';
import { ChallengeService } from './challenge.service';
import { mustFind, mustPlace, runTicks } from './challenge-test-helpers';

const mockStorage = { getItem: () => null, setItem: () => {} };

describe('Level 1: Hello Backend — star evaluation', () => {
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

    it('earns 0 stars when nothing is connected', () => {
        runTicks(tickEngine, 6000);
        expect(challengeService.starStatus()).toEqual([false, false, false]);
    });

    it('earns 0 stars with wrong topology: origin → database directly', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const db = mustPlace(gameState, ServiceType.DATABASE, 5, 4);

        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: db.id, portIndex: 0 });

        runTicks(tickEngine, 6000);
        expect(challengeService.starStatus()).toEqual([false, false, false]);
    });

    it('earns exactly 1 star with partial topology: origin → rest only (no database)', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const rest = mustPlace(gameState, ServiceType.REST_SERVICE, 4, 5);

        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: rest.id, portIndex: 0 });

        runTicks(tickEngine, 6000);
        const stars = challengeService.starStatus();
        expect(stars[0]).toBe(true);
        expect(stars[1]).toBe(false);
        expect(stars[2]).toBe(false);
    });

    it('earns all 3 stars with correct topology: origin → rest → database', () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'origin');
        const rest = mustPlace(gameState, ServiceType.REST_SERVICE, 4, 5);
        const db = mustPlace(gameState, ServiceType.DATABASE, 9, 4);

        gameState.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: rest.id, portIndex: 0 });
        gameState.addConnection({ serviceId: rest.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        // Run 6s of simulated time to satisfy the 5s zero-error sustain on star 3
        runTicks(tickEngine, 6000);
        expect(challengeService.starStatus()).toEqual([true, true, true]);
    });
});
