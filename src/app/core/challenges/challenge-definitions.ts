import { ServiceType } from '../game/service-types.config';
import { RequestMethod } from '../game/sim-types';
import type { ChallengeDefinition } from './challenge.model';

/**
 * All challenge definitions — pure data, no logic.
 *
 * Port indices reference (from service-types.config.ts):
 *   Origin:         [0] east OUTPUT
 *   API Gateway:    [0] west INPUT,  [1] east OUTPUT
 *   REST Service:   [0] west INPUT,  [1] east OUTPUT
 *   Database:       [0] north BIDIRECTIONAL
 *   Cache:          [0] west INPUT,  [1] east OUTPUT
 *   Message Queue:  [0] north INPUT, [1] south OUTPUT
 *   Load Balancer:  [0] west INPUT,  [1] east OUTPUT, [2] east OUTPUT
 */
export const CHALLENGE_DEFINITIONS: ChallengeDefinition[] = [
    // ── Level 1: Hello, Backend ──────────────────────────────────────
    {
        id: 'level-1',
        name: 'Hello, Backend',
        description: 'Requests are piling up with nowhere to go. Build your first backend.',
        briefing:
            'The Origin on your board generates traffic from the outside world. ' +
            'A REST Service handles your business logic. ' +
            'A Database stores what needs to persist. ' +
            'Wire them together and watch the system come to life. ' +
            'The objectives panel on the left will guide you.',
        services: [{ type: ServiceType.ORIGIN, gridX: 0, gridY: 6, locked: true }],
        connections: [],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 25,
                    distribution: [
                        { method: RequestMethod.GET, resource: 'users', weight: 50 },
                        { method: RequestMethod.GET, resource: 'products', weight: 25 },
                        { method: RequestMethod.POST, resource: 'users', weight: 15 },
                        { method: RequestMethod.PUT, resource: 'products', weight: 10 },
                    ],
                },
            },
        ],
        availableResources: [
            { type: ServiceType.REST_SERVICE, count: 1 },
            { type: ServiceType.DATABASE, count: 1 },
        ],
        stars: [
            {
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE],
                        sustainMs: 0,
                        label: 'Connect Origin → REST Service',
                    },
                ],
            },
            {
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE, ServiceType.DATABASE],
                        sustainMs: 0,
                        label: 'Connect REST Service → Database',
                    },
                ],
            },
            {
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE, ServiceType.DATABASE],
                        sustainMs: 0,
                        label: 'Full pipeline connected',
                    },
                    {
                        metric: 'errorRate',
                        operator: '<=',
                        value: 0,
                        sustainMs: 5000,
                        label: 'Zero errors for 5s',
                    },
                ],
            },
        ],
    },

    // ── Level 2: Cache Layer ─────────────────────────────────────────
    {
        id: 'level-2',
        name: 'Cache Layer',
        description: 'The Database is being hit by every request. Add a Cache — and commit to it.',
        briefing:
            'Your REST Service is already connected to the Database, but every request hits it directly — ' +
            'including repeat GETs for the same data. The Database is slow (100ms per query). ' +
            'Place a Cache and route traffic through it. ' +
            'A Cache only helps if all reads flow through it: once the cache path is wired up, ' +
            'remove the direct REST → Database connection.',
        services: [
            { type: ServiceType.ORIGIN, gridX: 0, gridY: 6, locked: true },
            { type: ServiceType.REST_SERVICE, gridX: 4, gridY: 5, locked: true },
            { type: ServiceType.DATABASE, gridX: 14, gridY: 5, locked: true },
        ],
        connections: [
            // Origin(out:0) → REST(in:0) — pre-drawn
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 1, targetPortIndex: 0 },
            // REST(out:1) → Database(bidir:0) — pre-drawn; player must reroute through Cache and remove this
            { sourceIndex: 1, sourcePortIndex: 1, targetIndex: 2, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 25,
                    distribution: [
                        { method: RequestMethod.GET, resource: 'users', weight: 50 },
                        { method: RequestMethod.GET, resource: 'products', weight: 25 },
                        { method: RequestMethod.POST, resource: 'users', weight: 15 },
                        { method: RequestMethod.PUT, resource: 'products', weight: 10 },
                    ],
                },
            },
        ],
        availableResources: [{ type: ServiceType.CACHE, count: 1 }],
        stars: [
            {
                // ★1 — cache added in parallel: cache path exists AND direct bypass still present
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE, ServiceType.DATABASE],
                        sustainMs: 0,
                        label: 'Route traffic through Cache',
                    },
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.DATABASE],
                        sustainMs: 0,
                        label: 'Direct REST → Database bypass still present',
                    },
                ],
            },
            {
                // ★2 — committed to cache: bypass removed, all traffic through cache (even writes)
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE, ServiceType.DATABASE],
                        sustainMs: 0,
                        label: 'Cache is the only path to Database',
                    },
                    {
                        metric: 'pathNotExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.DATABASE],
                        sustainMs: 0,
                        label: 'Remove direct REST → Database connection',
                    },
                ],
            },
            {
                // ★3 — optimal: reads cached (GET filter), writes skip cache entirely (write filter on REST→DB)
                // Mutually exclusive with ★2: REST→DB reintroduced with a write-only filter
                conditions: [
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE],
                        requiredMethods: [RequestMethod.GET],
                        sustainMs: 0,
                        label: 'Cache handles reads only (GET-only filter on REST → Cache)',
                    },
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.DATABASE],
                        requiredMethods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
                        sustainMs: 0,
                        label: 'Database receives writes only (write-only filter on REST → Database)',
                    },
                ],
            },
        ],
    },

    // ── Level 3: Two Backends ────────────────────────────────────────
    {
        id: 'level-3',
        name: 'Two Backends',
        description: 'All traffic hits one REST Service directly. Introduce a Load Balancer and distribute the load.',
        briefing:
            'Origin is connected straight to one REST Service — no distribution. ' +
            'A second REST Service is already wired to the Database but receives no traffic. ' +
            'Place a Load Balancer between Origin and both REST instances, ' +
            'then remove the old direct connection so all traffic routes through the Load Balancer.',
        services: [
            { type: ServiceType.ORIGIN, gridX: 0, gridY: 6, locked: true },
            { type: ServiceType.REST_SERVICE, gridX: 9, gridY: 3, locked: true },
            { type: ServiceType.REST_SERVICE, gridX: 9, gridY: 9, locked: true },
            { type: ServiceType.DATABASE, gridX: 14, gridY: 5, locked: true },
        ],
        connections: [
            // Origin(out:0) → REST₁(in:0) — the direct connection player must reroute
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 1, targetPortIndex: 0 },
            // REST₁(out:1) → Database(bidir:0) — pre-wired
            { sourceIndex: 1, sourcePortIndex: 1, targetIndex: 3, targetPortIndex: 0 },
            // REST₂(out:1) → Database(bidir:0) — pre-wired, receives no traffic yet
            { sourceIndex: 2, sourcePortIndex: 1, targetIndex: 3, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 25,
                    distribution: [
                        { method: RequestMethod.GET, resource: 'users', weight: 40 },
                        { method: RequestMethod.GET, resource: 'products', weight: 20 },
                        { method: RequestMethod.POST, resource: 'orders', weight: 20 },
                        { method: RequestMethod.PUT, resource: 'users', weight: 10 },
                        { method: RequestMethod.DELETE, resource: 'orders', weight: 10 },
                    ],
                },
            },
        ],
        availableResources: [{ type: ServiceType.LOAD_BALANCER, count: 1 }],
        stars: [
            {
                // ★1 — LB introduced: path through LB exists AND direct bypass still present
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [
                            ServiceType.ORIGIN,
                            ServiceType.LOAD_BALANCER,
                            ServiceType.REST_SERVICE,
                            ServiceType.DATABASE,
                        ],
                        sustainMs: 0,
                        label: 'Route traffic through Load Balancer',
                    },
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE],
                        sustainMs: 0,
                        label: 'Direct Origin → REST bypass still present',
                    },
                ],
            },
            {
                // ★2 — bypass removed: all traffic through LB (may route to only one REST instance)
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [
                            ServiceType.ORIGIN,
                            ServiceType.LOAD_BALANCER,
                            ServiceType.REST_SERVICE,
                            ServiceType.DATABASE,
                        ],
                        sustainMs: 0,
                        label: 'Load Balancer path is active',
                    },
                    {
                        metric: 'pathNotExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE],
                        sustainMs: 0,
                        label: 'Remove direct Origin → REST connection',
                    },
                ],
            },
            {
                // ★3 — true distribution: LB routes to BOTH REST instances, bypass removed
                // value: 2 means at least 2 distinct paths through the sequence
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 2,
                        path: [
                            ServiceType.ORIGIN,
                            ServiceType.LOAD_BALANCER,
                            ServiceType.REST_SERVICE,
                            ServiceType.DATABASE,
                        ],
                        sustainMs: 0,
                        label: 'Load Balancer distributes to both REST instances',
                    },
                    {
                        metric: 'pathNotExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE],
                        sustainMs: 0,
                        label: 'All traffic routes through Load Balancer',
                    },
                ],
            },
        ],
    },

    // ── Level 4: Smart Routes ────────────────────────────────────────
    {
        id: 'level-4',
        name: 'Smart Routes',
        description: 'Not all requests are equal — route reads through the Cache, writes directly to the Database.',
        briefing:
            'Your REST Service handles reads (GET) and writes (POST, PUT, DELETE). ' +
            'Connect paths to both the Cache and the Database — even without filters the system will work. ' +
            'Then refine it: click each connection to open the filter panel ' +
            'and restrict which methods are allowed through. ' +
            'Reads benefit from caching; writes must reach the Database directly.',
        services: [
            { type: ServiceType.ORIGIN, gridX: 0, gridY: 6, locked: true },
            { type: ServiceType.REST_SERVICE, gridX: 4, gridY: 5, locked: true },
            { type: ServiceType.CACHE, gridX: 10, gridY: 3, locked: true },
            { type: ServiceType.DATABASE, gridX: 14, gridY: 5, locked: true },
        ],
        connections: [
            // Origin(out:0) → REST(in:0) — pre-drawn
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 1, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 25,
                    distribution: [
                        { method: RequestMethod.GET, resource: 'users', weight: 40 },
                        { method: RequestMethod.GET, resource: 'products', weight: 20 },
                        { method: RequestMethod.POST, resource: 'orders', weight: 20 },
                        { method: RequestMethod.PUT, resource: 'users', weight: 10 },
                        { method: RequestMethod.DELETE, resource: 'orders', weight: 10 },
                    ],
                },
            },
        ],
        availableResources: [],
        stars: [
            {
                // ★1 — naive solution: both paths exist, system works (filters not required yet)
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE, ServiceType.DATABASE],
                        sustainMs: 0,
                        label: 'Read path connected: REST → Cache → Database',
                    },
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.DATABASE],
                        sustainMs: 0,
                        label: 'Write path connected: REST → Database',
                    },
                ],
            },
            {
                // ★2 — reads filtered: GET filter on REST→Cache, write path to DB also connected
                conditions: [
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE],
                        requiredMethods: [RequestMethod.GET],
                        sustainMs: 0,
                        label: 'Route GET requests through Cache (GET-only filter)',
                    },
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.DATABASE],
                        sustainMs: 0,
                        label: 'Write path to Database connected',
                    },
                ],
            },
            {
                // ★3 — both paths fully filtered: reads cached (GET), writes direct (POST/PUT/DELETE)
                conditions: [
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE],
                        requiredMethods: [RequestMethod.GET],
                        sustainMs: 0,
                        label: 'Route GET requests through Cache (GET-only filter)',
                    },
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.DATABASE],
                        requiredMethods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
                        sustainMs: 0,
                        label: 'Route write requests directly to Database (writes-only filter)',
                    },
                ],
            },
        ],
    },
];
