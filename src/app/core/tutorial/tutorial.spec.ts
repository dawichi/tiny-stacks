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

    const removeOriginToDB = () => {
        const origin = mustFind(gameState.services(), (s) => s.type === ServiceType.ORIGIN, 'Origin');
        const connection = gameState
            .connections()
            .find((c) => c.source.serviceId === origin.id && c.target.serviceId === db().id);
        if (!connection) throw new Error('Origin→DB backdoor not found');
        gameState.removeConnection(connection.id);
    };
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
    // ── Initial state ────────────────────────────────────────────────────

    describe('initial state after init()', () => {
        it('places 3 services (Origin, REST, Database)', () => {
            expect(gameState.services()).toHaveLength(3);
        });

        it('pre-draws 3 connections, including the Origin→DB backdoor', () => {
            expect(gameState.connections()).toHaveLength(3);
            expect(tutorial.step1()).toBe(false);
        });

        it('starts at step index 0 with no steps complete', () => {
            expect(tutorial.currentStepIndex()).toBe(0);
            expect(tutorial.step1()).toBe(false);
            expect(tutorial.isComplete()).toBe(false);
        });
    });

    // ── Step 1: remove Origin → Database backdoor ────────────────────────

    describe('step 1:remove Origin → Database backdoor', () => {
        it('completes and advances to index 1 when the backdoor is removed', () => {
            removeOriginToDB();
            expect(tutorial.step1()).toBe(true);
            expect(tutorial.currentStepIndex()).toBe(1);
        });

        it('does not complete if the backdoor is still connected', () => {
            expect(tutorial.step2()).toBe(false);
        });
    });

    // ── Step 2: place Cache ──────────────────────────────────────────────

    describe('step 2:place Cache', () => {
        beforeEach(() => removeOriginToDB());

        it('completes and advances to index 2 when Cache is placed', () => {
            placeCache();
            expect(tutorial.step2()).toBe(true);
            expect(tutorial.currentStepIndex()).toBe(2);
        });

        it('stops at index 2:does not auto-advance without a connection', () => {
            placeCache();
            expect(tutorial.step3()).toBe(false);
        });

        it('does not complete without Cache placed first (guard)', () => {
            // Re-init to get a clean state without Cache
            tutorial.init();
            expect(tutorial.step2()).toBe(false);
        });
    });

    // ── Step 3: connect REST → Cache ────────────────────────────────────

    describe('step 3:connect REST → Cache', () => {
        beforeEach(() => {
            removeOriginToDB();
            placeCache();
        });

        it('completes and advances to index 3 when REST output connects to Cache input', () => {
            connectRestToCache();
            expect(tutorial.step3()).toBe(true);
            expect(tutorial.currentStepIndex()).toBe(3);
        });

        it('stops at index 3 without Cache→Database', () => {
            connectRestToCache();
            expect(tutorial.step4()).toBe(false);
        });
    });

    // ── Step 4: connect Cache → Database ────────────────────────────────

    describe('step 4:connect Cache → Database', () => {
        beforeEach(() => {
            removeOriginToDB();
            placeCache();
            connectRestToCache();
        });

        it('completes and advances to index 4 when Cache connects to Database', () => {
            connectCacheToDB();
            expect(tutorial.step4()).toBe(true);
            expect(tutorial.currentStepIndex()).toBe(4);
        });

        it('reverts to index 3 if Cache→Database is removed', () => {
            connectCacheToDB();
            const connection = gameState
                .connections()
                .find((c) => c.source.serviceId === cache().id && c.target.serviceId === db().id);
            if (!connection) throw new Error('Cache→DB connection not found');
            gameState.removeConnection(connection.id);
            expect(tutorial.step4()).toBe(false);
            expect(tutorial.currentStepIndex()).toBe(3);
        });

        it('does not complete step 4 if earlier steps are skipped', () => {
            // A Cache→Database connection alone does not satisfy the earlier steps.
            tutorial.init();
            placeCache();
            connectCacheToDB();
            expect(tutorial.step4()).toBe(false);
        });
    });

    // ── Step 5: GET-only route rule on REST → Cache ──────────────────────

    describe('step 5:set GET-only route rule on REST → Cache', () => {
        beforeEach(() => {
            removeOriginToDB();
            placeCache();
            connectRestToCache();
            connectCacheToDB();
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
            const conn = mustFind(
                gameState.connections(),
                (c) => c.source.serviceId === rest().id && c.target.serviceId === cache().id,
                'REST→Cache connection',
            );
            gameState.updateConnectionFilter(conn.id, { methods: [RequestMethod.POST], weight: 100 });
            expect(tutorial.step5()).toBe(false);
        });

        it('does not complete with GET + POST filter (must be GET exclusively)', () => {
            const conn = mustFind(
                gameState.connections(),
                (c) => c.source.serviceId === rest().id && c.target.serviceId === cache().id,
                'REST→Cache connection',
            );
            gameState.updateConnectionFilter(conn.id, {
                methods: [RequestMethod.GET, RequestMethod.POST],
                weight: 100,
            });
            expect(tutorial.step5()).toBe(false);
        });

        it('does not complete if step 4 is not done (guard)', () => {
            // Re-init to get a fresh board without step 4 complete
            tutorial.init();
            removeOriginToDB();
            placeCache();
            connectRestToCache();
            setGetOnlyOnRestToCache();
            expect(tutorial.step5()).toBe(false);
        });
    });

    // ── Full walkthrough ─────────────────────────────────────────────────

    describe('full walkthrough', () => {
        it('advances step index 0 → 5 through all actions in sequence', () => {
            expect(tutorial.currentStepIndex()).toBe(0);

            removeOriginToDB();
            expect(tutorial.currentStepIndex()).toBe(1);

            placeCache();
            expect(tutorial.currentStepIndex()).toBe(2);

            connectRestToCache();
            expect(tutorial.currentStepIndex()).toBe(3);

            connectCacheToDB();
            expect(tutorial.currentStepIndex()).toBe(4);

            setGetOnlyOnRestToCache();
            expect(tutorial.currentStepIndex()).toBe(5);
            expect(tutorial.isComplete()).toBe(true);
        });
    });
});
