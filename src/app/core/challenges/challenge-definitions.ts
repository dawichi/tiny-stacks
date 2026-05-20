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
        description: 'Build a proper backend: connect Origin → REST → Database.',
        briefing:
            'Your first architecture! An Origin is sending 25 requests per second. ' +
            'You have one REST Service and one Database to place. Build the pipeline: ' +
            'connect Origin → REST Service → Database. ' +
            'Each star guides you through the next step.',
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

    // ── Level 2: Cache It ────────────────────────────────────────────
    {
        id: 'level-2',
        name: 'Cache It',
        description: 'The DB is overloaded — add a cache to reduce read load.',
        briefing:
            'This architecture is struggling! 30 requests per second are flooding the Database, ' +
            'which can only handle 10 concurrent requests. Most traffic is GET requests. ' +
            'Place a Cache between the REST Service and Database to absorb the read load. ' +
            'The Cache will automatically serve cached GET responses without hitting the DB.',
        services: [
            { type: ServiceType.ORIGIN, gridX: 0, gridY: 6, locked: true },
            { type: ServiceType.API_GATEWAY, gridX: 2, gridY: 5, locked: true },
            { type: ServiceType.REST_SERVICE, gridX: 6, gridY: 5, locked: true },
            { type: ServiceType.DATABASE, gridX: 14, gridY: 5, locked: true },
        ],
        connections: [
            // Origin(out:0) → Gateway(in:0)
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 1, targetPortIndex: 0 },
            // Gateway(out:1) → REST(in:0)
            { sourceIndex: 1, sourcePortIndex: 1, targetIndex: 2, targetPortIndex: 0 },
            // REST(out:1) → Database(bidir:0) — player should reroute this through Cache
            { sourceIndex: 2, sourcePortIndex: 1, targetIndex: 3, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 30,
                    distribution: [
                        { method: RequestMethod.GET, resource: 'users', weight: 50 },
                        { method: RequestMethod.GET, resource: 'products', weight: 30 },
                        { method: RequestMethod.POST, resource: 'users', weight: 10 },
                        { method: RequestMethod.PUT, resource: 'products', weight: 5 },
                        { method: RequestMethod.DELETE, resource: 'users', weight: 5 },
                    ],
                },
            },
        ],
        availableResources: [{ type: ServiceType.CACHE, count: 1 }],
        stars: [
            {
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.REST_SERVICE, ServiceType.CACHE, ServiceType.DATABASE],
                        sustainMs: 0,
                        label: 'Route REST → Cache → Database',
                    },
                ],
            },
            {
                conditions: [
                    {
                        metric: 'avgLatency',
                        operator: '<=',
                        value: 200,
                        sustainMs: 10000,
                        label: 'Avg latency ≤ 200ms for 10s',
                    },
                ],
            },
            {
                conditions: [
                    {
                        metric: 'errorRate',
                        operator: '<=',
                        value: 0,
                        sustainMs: 15000,
                        label: 'Zero errors for 15s',
                    },
                ],
            },
        ],
    },

    // ── Level 3: Scale Out ───────────────────────────────────────────
    {
        id: 'level-3',
        name: 'Scale Out',
        description: "A single REST service can't keep up — scale horizontally.",
        briefing:
            '40 requests per second are overwhelming your single REST Service, ' +
            'which maxes out at 20 concurrent requests. You need to scale horizontally: ' +
            'add a Load Balancer to distribute traffic across multiple REST Service instances. ' +
            'Each new REST Service adds 20 more concurrent capacity.',
        services: [
            { type: ServiceType.ORIGIN, gridX: 0, gridY: 6, locked: true },
            { type: ServiceType.REST_SERVICE, gridX: 4, gridY: 6, locked: true },
            { type: ServiceType.DATABASE, gridX: 14, gridY: 5, locked: true },
        ],
        connections: [
            // Origin(out:0) → REST(in:0)
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 1, targetPortIndex: 0 },
            // REST(out:1) → Database(bidir:0)
            { sourceIndex: 1, sourcePortIndex: 1, targetIndex: 2, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 40,
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
        availableResources: [
            { type: ServiceType.REST_SERVICE, count: 3 },
            { type: ServiceType.LOAD_BALANCER, count: 1 },
        ],
        stars: [
            {
                conditions: [
                    {
                        metric: 'pathExists',
                        operator: '>=',
                        value: 1,
                        path: [ServiceType.ORIGIN, ServiceType.LOAD_BALANCER, ServiceType.REST_SERVICE],
                        sustainMs: 0,
                        label: 'Route traffic through a Load Balancer',
                    },
                ],
            },
            {
                conditions: [
                    {
                        metric: 'throughput',
                        operator: '>=',
                        value: 30,
                        sustainMs: 10000,
                        label: 'Handle 30 req/s for 10s',
                    },
                ],
            },
            {
                conditions: [
                    {
                        metric: 'errorRate',
                        operator: '<=',
                        value: 0,
                        sustainMs: 15000,
                        label: 'Zero errors for 15s',
                    },
                ],
            },
        ],
    },
];
