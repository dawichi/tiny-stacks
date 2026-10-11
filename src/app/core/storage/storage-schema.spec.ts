import { ServiceType } from '../game/service-types.config';
import { RequestMethod } from '../game/sim-types';
import { SANDBOX_STATE_VERSION } from './storage.service';
import { sanitizeBoard, sanitizeProgress, sanitizeSandboxState } from './storage-schema';

const origin = { id: 'origin-1', type: ServiceType.ORIGIN, gridX: 0, gridY: 0 };
const rest = { id: 'rest-1', type: ServiceType.REST_SERVICE, gridX: 4, gridY: 0 };

describe('sanitizeBoard', () => {
    it('keeps valid services and connections, clamps route weights, and drops malformed entries', () => {
        const board = sanitizeBoard({
            services: [
                origin,
                rest,
                { ...rest, gridX: 8 },
                { id: 'unknown-type', type: 'worker', gridX: 8, gridY: 0 },
                { id: 'outside', type: ServiceType.DATABASE, gridX: 19, gridY: 0 },
                { id: 'fractional', type: ServiceType.CACHE, gridX: 1.5, gridY: 5 },
                { id: 'overlap', type: ServiceType.CACHE, gridX: 1, gridY: 1 },
                { id: '', type: ServiceType.CACHE, gridX: 10, gridY: 8 },
            ],
            connections: [
                {
                    id: 'valid',
                    source: { serviceId: origin.id, portIndex: 0 },
                    target: { serviceId: rest.id, portIndex: 0 },
                    filter: { methods: [RequestMethod.GET, 'INVALID', RequestMethod.GET], weight: 500 },
                },
                {
                    id: 'duplicate-route',
                    source: { serviceId: origin.id, portIndex: 0 },
                    target: { serviceId: rest.id, portIndex: 0 },
                },
                {
                    id: 'dangling',
                    source: { serviceId: origin.id, portIndex: 0 },
                    target: { serviceId: 'missing', portIndex: 0 },
                },
                {
                    id: 'invalid-port',
                    source: { serviceId: origin.id, portIndex: 0.5 },
                    target: { serviceId: rest.id, portIndex: 0 },
                },
                {
                    id: 'wrong-direction',
                    source: { serviceId: rest.id, portIndex: 0 },
                    target: { serviceId: origin.id, portIndex: 0 },
                },
            ],
        });

        expect(board.services.map((service) => service.id)).toEqual(['origin-1', 'rest-1']);
        expect(board.connections).toHaveLength(1);
        expect(board.connections[0]?.filter).toEqual({ methods: [RequestMethod.GET], weight: 100 });
    });

    it('uses a safe default for non-finite connection weights and tolerates non-array data', () => {
        const board = sanitizeBoard({
            services: [origin, rest],
            connections: [
                {
                    id: 'nan-weight',
                    source: { serviceId: origin.id, portIndex: 0 },
                    target: { serviceId: rest.id, portIndex: 0 },
                    filter: { methods: [], weight: Number.NaN },
                },
            ],
        });

        expect(board.connections[0]?.filter?.weight).toBe(100);
        expect(sanitizeBoard({ services: {}, connections: 'invalid' })).toEqual({ services: [], connections: [] });
    });
});

describe('sanitizeSandboxState', () => {
    it('migrates legacy saves and clamps origin rates for known origin services', () => {
        const state = sanitizeSandboxState({
            services: [origin],
            connections: [],
            originRps: { [origin.id]: 999, unknown: 40 },
        });

        expect(state).toEqual({
            version: SANDBOX_STATE_VERSION,
            services: [origin],
            connections: [],
            originRps: { [origin.id]: 200 },
        });
    });

    it('keeps current saves and rejects malformed or unknown versions', () => {
        expect(sanitizeSandboxState({ version: SANDBOX_STATE_VERSION, services: [], connections: [] })?.version).toBe(
            SANDBOX_STATE_VERSION,
        );
        expect(sanitizeSandboxState({ version: 999, services: [], connections: [] })).toBeNull();
        expect(sanitizeSandboxState(null)).toBeNull();
        expect(sanitizeSandboxState([])).toBeNull();
    });
});

describe('sanitizeProgress', () => {
    it('clamps star counts and discards malformed or non-finite progress fields', () => {
        expect(
            sanitizeProgress({
                tooManyStars: { starsEarned: 7, bestP95: 120, bestErrorRate: Number.NaN },
                negativeStars: { starsEarned: -2, bestCost: -10 },
                infiniteStars: { starsEarned: Number.POSITIVE_INFINITY },
                malformed: { starsEarned: '3' },
                '': { starsEarned: 2 },
                invalid: null,
            }),
        ).toEqual({
            tooManyStars: { starsEarned: 3, bestP95: 120 },
            negativeStars: { starsEarned: 0 },
        });
    });

    it('returns empty progress for malformed roots', () => {
        expect(sanitizeProgress(null)).toEqual({});
        expect(sanitizeProgress(['not', 'a', 'record'])).toEqual({});
    });
});
