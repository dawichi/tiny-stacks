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
    // ── Level 1: Cache Layer ─────────────────────────────────────────
    {
        id: 'level-1',
        name: 'Cache Layer',
        description: 'Monday morning peak. The database is drowning in repeated reads.',
        briefing:
            "It's 9am on a Monday and the analytics dashboard is lighting up. " +
            'Your REST Service is hammering the Database with the same catalog queries — over and over. ' +
            'Every GET for /users and /products goes all the way to disk. ' +
            'A Cache would serve the repeat reads instantly and take the pressure off. ' +
            'Add one and route reads through it — then commit: remove the direct REST → Database shortcut once the cache path is live.',
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
                label: 'Cache in the pipeline',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★2 — committed to cache: bypass removed, all traffic through cache (even writes)
                label: 'No direct DB access',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                    {
                        metric: 'pathNotExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★3 — optimal: reads cached (GET filter), writes skip cache entirely (write filter on REST→DB)
                // Mutually exclusive with ★2: REST→DB reintroduced with a write-only filter
                label: 'Smart read/write routing',
                conditions: [
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE],
                        requiredMethods: [RequestMethod.GET],
                        sustainMs: 0,
                    },
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.DATABASE],
                        requiredMethods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
                        sustainMs: 0,
                    },
                ],
            },
        ],
    },

    // ── Level 2: Two Backends ────────────────────────────────────────
    {
        id: 'level-2',
        name: 'Two Backends',
        description: 'Black Friday is 48 hours away. One backend will not survive the spike.',
        briefing:
            'The sale starts at midnight in two days. Traffic projections say 3× normal load. ' +
            "One REST Service won't handle it — but you have a second one sitting idle, already wired to the Database. " +
            'Place a Load Balancer in front of both backends, connect them up, ' +
            'then cut the direct Origin → REST shortcut. ' +
            'When the spike hits, both backends share the load instead of one dying alone.',
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
                label: 'Load Balancer connected',
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
                    },
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★2 — bypass removed: all traffic through LB (may route to only one REST instance)
                label: 'Traffic centralized',
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
                    },
                    {
                        metric: 'pathNotExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★3 — true distribution: LB routes to BOTH REST instances, bypass removed
                label: 'True load distribution',
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
                    },
                    {
                        metric: 'pathNotExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE],
                        sustainMs: 0,
                    },
                ],
            },
        ],
    },

    // ── Level 3: Smart Routes ────────────────────────────────────────
    {
        id: 'level-3',
        name: 'Smart Routes',
        description: 'Reads and writes share the same path. The cache is poisoning itself.',
        briefing:
            'Your team shipped a Cache last sprint — but forgot to set up routing rules. ' +
            'POST and PUT requests are flowing into it alongside GETs, poisoning the cached data with stale writes. ' +
            'Connect paths to both the Cache and the Database. ' +
            'Then click each connection and set a method filter: ' +
            'GET reads belong in the Cache, writes belong direct to the Database. ' +
            'Route rules are how real API gateways work — nginx, Envoy, and Kong all use this pattern.',
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
                label: 'Both paths wired',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★2 — reads filtered: GET filter on REST→Cache, write path to DB also connected
                label: 'Reads routed to cache',
                conditions: [
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE],
                        requiredMethods: [RequestMethod.GET],
                        sustainMs: 0,
                    },
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★3 — both paths fully filtered: reads cached (GET), writes direct (POST/PUT/DELETE)
                label: 'Traffic fully separated',
                conditions: [
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE],
                        requiredMethods: [RequestMethod.GET],
                        sustainMs: 0,
                    },
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.DATABASE],
                        requiredMethods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
                        sustainMs: 0,
                    },
                ],
            },
        ],
    },

    // ── Level 4: Write Buffer ────────────────────────────────────────
    {
        id: 'level-4',
        name: 'Write Buffer',
        description: 'Christmas sale just went live. Orders are flooding in 10× faster than usual.',
        briefing:
            "It's December 25th, 8am, and your on-call phone is already ringing. " +
            'Orders are pouring in — every POST, PUT, and DELETE hitting the Database synchronously. ' +
            'The same slow DB that handles all your reads is now drowning in writes too. ' +
            'Place a Message Queue and route writes through it: the Database processes them at its own pace, ' +
            'and your REST Service stops waiting on every order confirmation. ' +
            'The pre-drawn REST → Database path still handles reads — your job is to buffer the writes.',
        services: [
            { type: ServiceType.ORIGIN, gridX: 0, gridY: 6, locked: true },
            { type: ServiceType.REST_SERVICE, gridX: 4, gridY: 5, locked: true },
            { type: ServiceType.DATABASE, gridX: 14, gridY: 5, locked: true },
        ],
        connections: [
            // Origin(out:0) → REST(in:0) — pre-drawn
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 1, targetPortIndex: 0 },
            // REST(out:1) → Database(bidir:0) — pre-drawn; player adds MQ path for writes
            { sourceIndex: 1, sourcePortIndex: 1, targetIndex: 2, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 110,
                    distribution: [
                        { method: RequestMethod.POST, resource: 'orders', weight: 35 },
                        { method: RequestMethod.PUT, resource: 'inventory', weight: 20 },
                        { method: RequestMethod.DELETE, resource: 'orders', weight: 15 },
                        { method: RequestMethod.GET, resource: 'products', weight: 20 },
                        { method: RequestMethod.GET, resource: 'users', weight: 10 },
                    ],
                },
            },
        ],
        availableResources: [{ type: ServiceType.MESSAGE_QUEUE, count: 1 }],
        stars: [
            {
                // ★1 — MQ added but no filter: reads + writes both flow through it
                label: 'Queue connected',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.MESSAGE_QUEUE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★2 — writes buffered via MQ with filter; reads still use pre-drawn REST→DB
                label: 'Writes buffered',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.MESSAGE_QUEUE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.MESSAGE_QUEUE],
                        requiredMethods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★3 — hard separation: writes only via MQ, reads only via DB (both filtered)
                label: 'Hard read/write separation',
                conditions: [
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.MESSAGE_QUEUE],
                        requiredMethods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
                        sustainMs: 0,
                    },
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.DATABASE],
                        requiredMethods: [RequestMethod.GET],
                        sustainMs: 0,
                    },
                ],
            },
        ],
    },

    // ── Level 5: The Gateway ─────────────────────────────────────────
    {
        id: 'level-5',
        name: 'The Gateway',
        description: 'Security audit: backends are directly exposed. Single entry point required.',
        briefing:
            'Your compliance review came back with a red flag: Origin connects straight to the REST Service — ' +
            'no rate limiting, no auth layer, no single point of control. ' +
            'Every service is one hop from the outside world. ' +
            'Place an API Gateway and route all traffic through it, then remove the direct Origin → REST connection. ' +
            'For full marks, also add a Cache on the read path — the audit flagged uncached repeat reads too.',
        services: [
            { type: ServiceType.ORIGIN, gridX: 0, gridY: 6, locked: true },
            { type: ServiceType.REST_SERVICE, gridX: 7, gridY: 5, locked: true },
            { type: ServiceType.DATABASE, gridX: 14, gridY: 5, locked: true },
        ],
        connections: [
            // Origin(out:0) → REST(in:0) — pre-drawn; player must reroute through GW
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 1, targetPortIndex: 0 },
            // REST(out:1) → Database(bidir:0) — pre-drawn
            { sourceIndex: 1, sourcePortIndex: 1, targetIndex: 2, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 25,
                    distribution: [
                        { method: RequestMethod.GET, resource: 'users', weight: 45 },
                        { method: RequestMethod.GET, resource: 'products', weight: 25 },
                        { method: RequestMethod.POST, resource: 'orders', weight: 15 },
                        { method: RequestMethod.PUT, resource: 'users', weight: 10 },
                        { method: RequestMethod.DELETE, resource: 'orders', weight: 5 },
                    ],
                },
            },
        ],
        availableResources: [
            { type: ServiceType.API_GATEWAY, count: 1 },
            { type: ServiceType.CACHE, count: 1 },
        ],
        stars: [
            {
                // ★1 — GW added but bypass still present
                label: 'Gateway online',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.API_GATEWAY, ServiceType.REST_SERVICE],
                        sustainMs: 0,
                    },
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★2 — GW is sole entry point, bypass removed
                label: 'Single entry point',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.API_GATEWAY, ServiceType.REST_SERVICE],
                        sustainMs: 0,
                    },
                    {
                        metric: 'pathNotExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★3 — GW as sole entry AND cache on the read path
                label: 'Gateway + cache',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.API_GATEWAY, ServiceType.REST_SERVICE],
                        sustainMs: 0,
                    },
                    {
                        metric: 'pathNotExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE],
                        sustainMs: 0,
                    },
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                ],
            },
        ],
    },

    // ── Level 6: Scale + Cache ───────────────────────────────────────
    {
        id: 'level-6',
        name: 'Scale + Cache',
        description: 'You just got HackerNews front page. Traffic is 50× normal.',
        briefing:
            'The post went live an hour ago and your on-call is paging. ' +
            'Two REST Services are pre-wired to the Database for writes — but Origin has no path in yet. ' +
            'Place a Load Balancer to split traffic across both backends, ' +
            'and a Cache to absorb the flood of repeated product reads. ' +
            'For the cleanest architecture, make sure both backends share the Cache — and lock it to GET requests only.',
        services: [
            { type: ServiceType.ORIGIN, gridX: 0, gridY: 6, locked: true },
            { type: ServiceType.REST_SERVICE, gridX: 9, gridY: 2, locked: true },
            { type: ServiceType.REST_SERVICE, gridX: 9, gridY: 9, locked: true },
            { type: ServiceType.DATABASE, gridX: 16, gridY: 5, locked: true },
        ],
        connections: [
            // REST₁(out:1) → Database(bidir:0) — pre-wired for writes
            { sourceIndex: 1, sourcePortIndex: 1, targetIndex: 3, targetPortIndex: 0 },
            // REST₂(out:1) → Database(bidir:0) — pre-wired for writes
            { sourceIndex: 2, sourcePortIndex: 1, targetIndex: 3, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 35,
                    distribution: [
                        { method: RequestMethod.GET, resource: 'products', weight: 50 },
                        { method: RequestMethod.GET, resource: 'users', weight: 20 },
                        { method: RequestMethod.POST, resource: 'orders', weight: 15 },
                        { method: RequestMethod.PUT, resource: 'products', weight: 10 },
                        { method: RequestMethod.DELETE, resource: 'orders', weight: 5 },
                    ],
                },
            },
        ],
        availableResources: [
            { type: ServiceType.LOAD_BALANCER, count: 1 },
            { type: ServiceType.CACHE, count: 1 },
        ],
        stars: [
            {
                // ★1 — LB and Cache both in use, but only one REST connected to LB
                label: 'Scaling with cache',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [
                            ServiceType.ORIGIN,
                            ServiceType.LOAD_BALANCER,
                            ServiceType.REST_SERVICE,
                            ServiceType.CACHE,
                            ServiceType.DATABASE,
                        ],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★2 — both REST instances route through the shared Cache
                label: 'Both backends cached',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 2,
                        path: [
                            ServiceType.ORIGIN,
                            ServiceType.LOAD_BALANCER,
                            ServiceType.REST_SERVICE,
                            ServiceType.CACHE,
                            ServiceType.DATABASE,
                        ],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★3 — both backends cached AND Cache is GET-only; writes fall through to pre-drawn REST→DB
                label: 'Cache GET-only',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 2,
                        path: [
                            ServiceType.ORIGIN,
                            ServiceType.LOAD_BALANCER,
                            ServiceType.REST_SERVICE,
                            ServiceType.CACHE,
                            ServiceType.DATABASE,
                        ],
                        sustainMs: 0,
                    },
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE],
                        requiredMethods: [RequestMethod.GET],
                        sustainMs: 0,
                    },
                ],
            },
        ],
    },

    // ── Level 7: Two Paths ───────────────────────────────────────────
    {
        id: 'level-7',
        name: 'Two Paths',
        description: 'Reads are slow. Writes are unreliable. They are fighting over the same resources.',
        briefing:
            'Your two REST Services are receiving all traffic with no separation — reads and writes mixed together. ' +
            "GETs are slow because they're queued behind heavy write operations. " +
            "POSTs are unreliable because they're sharing a path that wasn't designed for them. " +
            'Build a Cache path on one side for reads, and a Message Queue path on the other for writes. ' +
            'Then set route rules at Origin so each traffic type knows exactly where to go. ' +
            'For maximum stars, also filter the downstream connections.',
        services: [
            { type: ServiceType.ORIGIN, gridX: 0, gridY: 6, locked: true },
            { type: ServiceType.REST_SERVICE, gridX: 5, gridY: 2, locked: true },
            { type: ServiceType.REST_SERVICE, gridX: 5, gridY: 10, locked: true },
            { type: ServiceType.DATABASE, gridX: 16, gridY: 5, locked: true },
        ],
        connections: [
            // Origin(out:0) → REST₁(in:0) — pre-drawn, unruled
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 1, targetPortIndex: 0 },
            // Origin(out:0) → REST₂(in:0) — pre-drawn, unruled
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 2, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 30,
                    distribution: [
                        { method: RequestMethod.GET, resource: 'products', weight: 40 },
                        { method: RequestMethod.GET, resource: 'users', weight: 20 },
                        { method: RequestMethod.POST, resource: 'orders', weight: 20 },
                        { method: RequestMethod.PUT, resource: 'products', weight: 10 },
                        { method: RequestMethod.DELETE, resource: 'orders', weight: 10 },
                    ],
                },
            },
        ],
        availableResources: [
            { type: ServiceType.CACHE, count: 1 },
            { type: ServiceType.MESSAGE_QUEUE, count: 1 },
        ],
        stars: [
            {
                // ★1 — both downstream paths built, no route rules anywhere
                label: 'Both paths built',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.MESSAGE_QUEUE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★2 — origin connections filtered to split reads and writes at the source
                label: 'Origin traffic split',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.MESSAGE_QUEUE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE],
                        requiredMethods: [RequestMethod.GET],
                        sustainMs: 0,
                    },
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE],
                        requiredMethods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★3 — double-ruled: origin and service level both filtered
                label: 'Double-ruled paths',
                conditions: [
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE],
                        requiredMethods: [RequestMethod.GET],
                        sustainMs: 0,
                    },
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.REST_SERVICE],
                        requiredMethods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
                        sustainMs: 0,
                    },
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE],
                        requiredMethods: [RequestMethod.GET],
                        sustainMs: 0,
                    },
                    {
                        metric: 'filteredPathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.MESSAGE_QUEUE],
                        requiredMethods: [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE],
                        sustainMs: 0,
                    },
                ],
            },
        ],
    },

    // ── Level 8: Full Stack ──────────────────────────────────────────
    {
        id: 'level-8',
        name: 'Full Stack',
        description: 'Greenfield project. You have an Origin, a Database, and a blank canvas.',
        briefing:
            'New company, new system — the investors want a demo in an hour. ' +
            'All you have is an Origin generating traffic and a Database to persist it. ' +
            'The palette has everything you need: a Gateway for access control, a Load Balancer for scale, ' +
            'two REST Services for business logic, a Cache for read performance, and a Message Queue for write resilience. ' +
            'Build something you would be proud to put in production.',
        services: [
            { type: ServiceType.ORIGIN, gridX: 0, gridY: 6, locked: true },
            { type: ServiceType.DATABASE, gridX: 17, gridY: 5, locked: true },
        ],
        connections: [],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 40,
                    distribution: [
                        { method: RequestMethod.GET, resource: 'products', weight: 40 },
                        { method: RequestMethod.GET, resource: 'users', weight: 20 },
                        { method: RequestMethod.POST, resource: 'orders', weight: 20 },
                        { method: RequestMethod.PUT, resource: 'products', weight: 10 },
                        { method: RequestMethod.DELETE, resource: 'orders', weight: 10 },
                    ],
                },
            },
        ],
        availableResources: [
            { type: ServiceType.API_GATEWAY, count: 1 },
            { type: ServiceType.LOAD_BALANCER, count: 1 },
            { type: ServiceType.REST_SERVICE, count: 2 },
            { type: ServiceType.CACHE, count: 1 },
            { type: ServiceType.MESSAGE_QUEUE, count: 1 },
        ],
        stars: [
            {
                // ★1 — full pipeline exists: Origin → GW → LB → REST → DB
                label: 'Full pipeline',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [
                            ServiceType.ORIGIN,
                            ServiceType.API_GATEWAY,
                            ServiceType.LOAD_BALANCER,
                            ServiceType.REST_SERVICE,
                            ServiceType.DATABASE,
                        ],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★2 — both backends active AND Cache on at least one read path
                // pathExists stops at REST (not REST→DB) because backends may route through Cache/MQ
                label: 'Both backends + optimisation',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 2,
                        path: [
                            ServiceType.ORIGIN,
                            ServiceType.API_GATEWAY,
                            ServiceType.LOAD_BALANCER,
                            ServiceType.REST_SERVICE,
                        ],
                        sustainMs: 0,
                    },
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                ],
            },
            {
                // ★3 — full production: both backends, Cache AND MQ both in use
                label: 'Production ready',
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 2,
                        path: [
                            ServiceType.ORIGIN,
                            ServiceType.API_GATEWAY,
                            ServiceType.LOAD_BALANCER,
                            ServiceType.REST_SERVICE,
                        ],
                        sustainMs: 0,
                    },
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.MESSAGE_QUEUE, ServiceType.DATABASE],
                        sustainMs: 0,
                    },
                ],
            },
        ],
    },
];
