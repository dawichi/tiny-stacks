import { TestBed } from '@angular/core/testing';
import { mustConnect, mustFind, mustPlace } from '../challenges/challenge-test-helpers';
import { GameStateService } from '../game/game-state.service';
import { ServiceType } from '../game/service-types.config';
import { RequestMethod } from '../game/sim-types';
import { StorageService } from '../storage/storage.service';
import { TutorialService } from './tutorial.service';

const mockStorage = { getItem: () => null, setItem: () => {} };

describe('TutorialService:step detection', () => {
    let tutorial: TutorialService;
    let gameState: GameStateService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [TutorialService, GameStateService, { provide: StorageService, useValue: mockStorage }],
        });

        tutorial = TestBed.inject(TutorialService);
        gameState = TestBed.inject(GameStateService);

        tutorial.init();
    });

    afterEach(() => {
        TestBed.resetTestingModule();
    });

    // ── Helpers ──────────────────────────────────────────────────────────

    const rest = () => mustFind(gameState.services(), (s) => s.type === ServiceType.REST_SERVICE, 'REST');
    const db = () => mustFind(gameState.services(), (s) => s.type === ServiceType.DATABASE, 'DB');
    const cache = () => mustFind(gameState.services(), (s) => s.type === ServiceType.CACHE, 'Cache');

    const placeCache = () => mustPlace(gameState, ServiceType.CACHE, 10, 5);
    const connectRestToCache = () =>
        mustConnect(gameState, { serviceId: rest().id, portIndex: 1 }, { serviceId: cache().id, portIndex: 0 });
    const connectCacheToDB = () =>
        mustConnect(gameState, { serviceId: cache().id, portIndex: 1 }, { serviceId: db().id, portIndex: 0 });
    const setGetOnlyOnRestToCache = () => {
        const conn = gameState
            .connections()
            .find((c) => c.source.serviceId === rest().id && c.target.serviceId === cache().id);
        if (!conn) throw new Error('REST→Cache connection not found');
        gameState.updateConnectionFilter(conn.id, { methods: [RequestMethod.GET], weight: 100 });
    };
    const removeRestToDB = () => {
        const conn = gameState
            .connections()
            .find((c) => c.source.serviceId === rest().id && c.target.serviceId === db().id);
        if (!conn) throw new Error('REST→DB connection not found');
        gameState.removeConnection(conn.id);
    };

    // ── Initial state ────────────────────────────────────────────────────

    describe('initial state after init()', () => {
        it('places 3 services (Origin, REST, Database)', () => {
            expect(gameState.services()).toHaveLength(3);
        });

        it('pre-draws 2 connections (Origin→REST, REST→DB)', () => {
            expect(gameState.connections()).toHaveLength(2);
        });

        it('starts at step index 0 with no steps complete', () => {
            expect(tutorial.currentStepIndex()).toBe(0);
            expect(tutorial.step1()).toBe(false);
            expect(tutorial.isComplete()).toBe(false);
        });
    });

    // ── Step 1: place Cache ──────────────────────────────────────────────

    describe('step 1:place Cache', () => {
        it('completes and advances to index 1 when Cache is placed', () => {
            placeCache();
            expect(tutorial.step1()).toBe(true);
            expect(tutorial.currentStepIndex()).toBe(1);
        });

        it('stops at index 1:does not auto-advance without a connection', () => {
            placeCache();
            expect(tutorial.step2()).toBe(false);
        });
    });

    // ── Step 2: connect REST → Cache ─────────────────────────────────────

    describe('step 2:connect REST → Cache', () => {
        beforeEach(() => placeCache());

        it('completes and advances to index 2 when REST output connects to Cache input', () => {
            connectRestToCache();
            expect(tutorial.step2()).toBe(true);
            expect(tutorial.currentStepIndex()).toBe(2);
        });

        it('stops at index 2:does not auto-advance without Cache→DB', () => {
            connectRestToCache();
            expect(tutorial.step3()).toBe(false);
        });

        it('does not complete without Cache placed first (guard)', () => {
            // Re-init to get a clean state without Cache
            tutorial.init();
            expect(tutorial.step2()).toBe(false);
        });
    });

    // ── Step 3: connect Cache → Database ────────────────────────────────

    describe('step 3:connect Cache → Database', () => {
        beforeEach(() => {
            placeCache();
            connectRestToCache();
        });

        it('completes and advances to index 3 when Cache output connects to Database', () => {
            connectCacheToDB();
            expect(tutorial.step3()).toBe(true);
            expect(tutorial.currentStepIndex()).toBe(3);
        });

        it('stops at index 3:bypass still exists, step 4 not yet done', () => {
            connectCacheToDB();
            expect(tutorial.step4()).toBe(false);
        });
    });

    // ── Step 4: remove REST → Database bypass ────────────────────────────

    describe('step 4:remove REST → Database bypass', () => {
        beforeEach(() => {
            placeCache();
            connectRestToCache();
            connectCacheToDB();
        });

        it('completes and advances to index 4 when REST→DB is deleted', () => {
            removeRestToDB();
            expect(tutorial.step4()).toBe(true);
            expect(tutorial.currentStepIndex()).toBe(4);
        });

        it('reverts to index 3 if REST→DB is re-added after removal', () => {
            removeRestToDB();
            expect(tutorial.step4()).toBe(true);

            gameState.addConnection({ serviceId: rest().id, portIndex: 1 }, { serviceId: db().id, portIndex: 0 });
            expect(tutorial.step4()).toBe(false);
            expect(tutorial.currentStepIndex()).toBe(3);
        });

        it('does not complete step 4 if prior steps are skipped', () => {
            // Fresh board: only pre-placed services, remove REST→DB immediately
            tutorial.init();
            removeRestToDB();
            expect(tutorial.step4()).toBe(false);
        });
    });

    // ── Step 5: GET-only route rule on REST → Cache ──────────────────────

    describe('step 5:set GET-only route rule on REST → Cache', () => {
        beforeEach(() => {
            placeCache();
            connectRestToCache();
            connectCacheToDB();
            removeRestToDB();
        });

        it('completes and marks isComplete when REST→Cache filter is GET only', () => {
            setGetOnlyOnRestToCache();
            expect(tutorial.step5()).toBe(true);
            expect(tutorial.isComplete()).toBe(true);
            expect(tutorial.currentStepIndex()).toBe(5);
        });

        it('does not complete with no filter set (all methods allowed by default)', () => {
            expect(tutorial.step5()).toBe(false);
        });

        it('does not complete with POST-only filter', () => {
            const conn = gameState
                .connections()
                .find((c) => c.source.serviceId === rest().id && c.target.serviceId === cache().id)!;
            gameState.updateConnectionFilter(conn.id, { methods: [RequestMethod.POST], weight: 100 });
            expect(tutorial.step5()).toBe(false);
        });

        it('does not complete with GET + POST filter (must be GET exclusively)', () => {
            const conn = gameState
                .connections()
                .find((c) => c.source.serviceId === rest().id && c.target.serviceId === cache().id)!;
            gameState.updateConnectionFilter(conn.id, {
                methods: [RequestMethod.GET, RequestMethod.POST],
                weight: 100,
            });
            expect(tutorial.step5()).toBe(false);
        });

        it('does not complete if step 4 is not done (guard)', () => {
            // Re-init to get a fresh board without step 4 complete
            tutorial.init();
            placeCache();
            connectRestToCache();
            connectCacheToDB();
            // REST→DB still exists:step 4 not done
            setGetOnlyOnRestToCache();
            expect(tutorial.step5()).toBe(false);
        });
    });

    // ── Full walkthrough ─────────────────────────────────────────────────

    describe('full walkthrough', () => {
        it('advances step index 0 → 5 through all actions in sequence', () => {
            expect(tutorial.currentStepIndex()).toBe(0);

            placeCache();
            expect(tutorial.currentStepIndex()).toBe(1);

            connectRestToCache();
            expect(tutorial.currentStepIndex()).toBe(2);

            connectCacheToDB();
            expect(tutorial.currentStepIndex()).toBe(3);

            removeRestToDB();
            expect(tutorial.currentStepIndex()).toBe(4);

            setGetOnlyOnRestToCache();
            expect(tutorial.currentStepIndex()).toBe(5);
            expect(tutorial.isComplete()).toBe(true);
        });
    });
});
