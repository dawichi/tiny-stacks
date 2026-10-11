import { ServiceType } from '../game/service-types.config';
import { RequestMethod } from '../game/sim-types';
import type { ChallengeDefinition } from './challenge.model';
import { filtered, metric, noPath, path, paths, phase, READS, WRITES } from './challenge-conditions';

const { ORIGIN, API_GATEWAY: GW, REST_SERVICE: REST, DATABASE: DB, CACHE, MESSAGE_QUEUE: MQ } = ServiceType;
const LB = ServiceType.LOAD_BALANCER;
const { GET, POST, PUT, DELETE } = RequestMethod;

/**
 * All challenge definitions. Pure data, no logic.
 *
 * Each level: the build phase runs `requestsPerSecond`; Deploy runs the traffic `phases`
 * (and `outages`), then every star needs its topology AND its thresholds.
 * Per-level design notes and calibration numbers live in `docs/challenges.md`.
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
            "It's 9am on a Monday and the dashboards are lighting up. " +
            'Your REST Service sends every request straight to the Database, and most of them are the same few reads. ' +
            'At peak the Database can only handle about 20 requests per second, so requests start failing. ' +
            'Put a Cache in front of it so repeat reads never reach the Database. ' +
            'Writes still have to land in the Database: decide how they get there.',
        services: [
            { type: ORIGIN, gridX: 0, gridY: 6 },
            { type: REST, gridX: 4, gridY: 5 },
            { type: DB, gridX: 14, gridY: 5 },
        ],
        connections: [
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 1, targetPortIndex: 0 },
            { sourceIndex: 1, sourcePortIndex: 1, targetIndex: 2, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 15,
                    distribution: [
                        { method: GET, resource: 'users', weight: 45 },
                        { method: GET, resource: 'products', weight: 30 },
                        { method: POST, resource: 'orders', weight: 15 },
                        { method: PUT, resource: 'users', weight: 10 },
                    ],
                    phases: [phase('Warm-up', 8, 15), phase('Morning peak', 12, 32), phase('Cool-down', 5, 15)],
                },
            },
        ],
        availableResources: [{ type: CACHE, count: 1 }],
        stars: [
            {
                label: 'Cache in the pipeline',
                conditions: [path(REST, CACHE, DB), path(REST, DB)],
                thresholds: [metric('errorRate', '<', 5)],
            },
            {
                label: 'No direct DB access',
                conditions: [path(REST, CACHE, DB), noPath(REST, DB)],
                thresholds: [metric('errorRate', '<', 1), metric('p95Latency', '<', 900)],
            },
            {
                label: 'Smart read/write routing',
                conditions: [path(REST, CACHE, DB), filtered(REST, CACHE, READS), filtered(REST, DB, WRITES)],
                thresholds: [metric('errorRate', '<', 1), metric('p95Latency', '<', 800)],
            },
        ],
    },

    // ── Level 2: Two Backends ────────────────────────────────────────
    {
        id: 'level-2',
        name: 'Two Backends',
        description: 'Both backends will crash during the deploy. Keep the site up anyway.',
        briefing:
            'Ops warned you: the hosts behind your REST Services are unstable today. ' +
            'During the deploy, REST 1 will go down for a few seconds, and later REST 2 will too. ' +
            'Right now every request goes to REST 1, so when it crashes, everything fails. ' +
            'Wiring Origin to both backends spreads the traffic, but a random split still sends half the requests to whichever one is down. ' +
            'A Load Balancer checks health and only sends traffic to backends that are up.',
        services: [
            { type: ORIGIN, gridX: 0, gridY: 6 },
            { type: REST, gridX: 9, gridY: 3 },
            { type: REST, gridX: 9, gridY: 9 },
            { type: DB, gridX: 14, gridY: 5 },
        ],
        connections: [
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 1, targetPortIndex: 0 },
            { sourceIndex: 1, sourcePortIndex: 1, targetIndex: 3, targetPortIndex: 0 },
            { sourceIndex: 2, sourcePortIndex: 1, targetIndex: 3, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 12,
                    distribution: [
                        { method: GET, resource: 'users', weight: 40 },
                        { method: GET, resource: 'products', weight: 20 },
                        { method: POST, resource: 'orders', weight: 20 },
                        { method: PUT, resource: 'users', weight: 10 },
                        { method: DELETE, resource: 'orders', weight: 10 },
                    ],
                    phases: [phase('Steady traffic', 28, 12)],
                },
            },
        ],
        outages: [
            { serviceIndex: 1, atMs: 5000, durationMs: 8000 },
            { serviceIndex: 2, atMs: 18000, durationMs: 3000 },
        ],
        availableResources: [{ type: LB, count: 1 }],
        stars: [
            {
                label: 'Wire up the idle backend',
                conditions: [paths(2, ORIGIN, REST, DB), noPath(ORIGIN, LB)],
                thresholds: [metric('errorRate', '<', 26)],
            },
            {
                label: 'LB added but hedged',
                conditions: [path(ORIGIN, LB, REST, DB), path(ORIGIN, REST)],
                thresholds: [metric('errorRate', '<', 18)],
            },
            {
                label: 'Health-checked entry point',
                conditions: [paths(2, ORIGIN, LB, REST, DB), noPath(ORIGIN, REST)],
                thresholds: [metric('errorRate', '<', 3)],
            },
        ],
    },

    // ── Level 3: Smart Routes ────────────────────────────────────────
    {
        id: 'level-3',
        name: 'Smart Routes',
        description: 'The cache is there, but half the reads walk right past it.',
        briefing:
            'Your team wired up a Cache last sprint but left the old REST to Database connection in place, with no route rules. ' +
            'REST picks between the two at random, so half of the reads skip the cache and hit the Database anyway. ' +
            'At peak that is more than the Database can take. ' +
            'Fix the routing: no new services, just connections and route rules. ' +
            'Route rules are how real API gateways and service meshes decide where each request goes.',
        services: [
            { type: ORIGIN, gridX: 0, gridY: 6 },
            { type: REST, gridX: 4, gridY: 5 },
            { type: CACHE, gridX: 10, gridY: 3 },
            { type: DB, gridX: 14, gridY: 5 },
        ],
        connections: [
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 1, targetPortIndex: 0 },
            { sourceIndex: 1, sourcePortIndex: 1, targetIndex: 2, targetPortIndex: 0 },
            { sourceIndex: 2, sourcePortIndex: 1, targetIndex: 3, targetPortIndex: 0 },
            { sourceIndex: 1, sourcePortIndex: 1, targetIndex: 3, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 15,
                    distribution: [
                        { method: GET, resource: 'products', weight: 45 },
                        { method: GET, resource: 'users', weight: 25 },
                        { method: POST, resource: 'orders', weight: 20 },
                        { method: DELETE, resource: 'orders', weight: 10 },
                    ],
                    phases: [phase('Warm-up', 8, 15), phase('Peak', 12, 36), phase('Cool-down', 5, 15)],
                },
            },
        ],
        availableResources: [],
        stars: [
            {
                label: 'Everything through the cache',
                conditions: [path(REST, CACHE, DB), noPath(REST, DB)],
                thresholds: [metric('errorRate', '<', 1), metric('p95Latency', '<', 600)],
            },
            {
                label: 'Writes bypass the cache',
                conditions: [path(REST, CACHE, DB), filtered(REST, DB, WRITES)],
                thresholds: [metric('errorRate', '<', 1), metric('p95Latency', '<', 600)],
            },
            {
                label: 'Fully controlled routes',
                conditions: [path(REST, CACHE, DB), filtered(REST, CACHE, READS), filtered(REST, DB, WRITES)],
                thresholds: [metric('errorRate', '<', 1), metric('p95Latency', '<', 600)],
            },
        ],
    },

    // ── Level 4: Write Buffer ────────────────────────────────────────
    {
        id: 'level-4',
        name: 'Write Buffer',
        description: 'Holiday sale just went live. Orders are flooding in.',
        briefing:
            "It's December 25th, 8am, and the order rush has started. " +
            'Every POST, PUT and DELETE waits on the Database, and the same slow Database also has to answer every read. ' +
            'Place a Message Queue for the writes: it confirms each order at once and feeds the Database at a pace it can handle. ' +
            'Careful with reads: a queue cannot answer a GET, so a read sent through it waits in line behind every order.',
        services: [
            { type: ORIGIN, gridX: 0, gridY: 6 },
            { type: REST, gridX: 4, gridY: 5 },
            { type: DB, gridX: 14, gridY: 5 },
        ],
        connections: [
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 1, targetPortIndex: 0 },
            { sourceIndex: 1, sourcePortIndex: 1, targetIndex: 2, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 15,
                    distribution: [
                        { method: POST, resource: 'orders', weight: 35 },
                        { method: PUT, resource: 'inventory', weight: 20 },
                        { method: DELETE, resource: 'orders', weight: 15 },
                        { method: GET, resource: 'products', weight: 20 },
                        { method: GET, resource: 'users', weight: 10 },
                    ],
                    phases: [phase('Warm-up', 6, 15), phase('Order rush', 12, 32), phase('Cool-down', 8, 12)],
                },
            },
        ],
        availableResources: [{ type: MQ, count: 1 }],
        stars: [
            {
                label: 'Plug in the queue',
                conditions: [path(REST, MQ, DB), path(REST, DB)],
                thresholds: [metric('errorRate', '<', 20)],
            },
            {
                label: 'Queue accepts writes',
                conditions: [path(REST, MQ, DB), path(REST, DB), filtered(REST, MQ, WRITES)],
                thresholds: [metric('errorRate', '<', 1), metric('p95Latency', '<', 800)],
            },
            {
                label: 'Smart split',
                conditions: [path(MQ, DB), filtered(REST, MQ, WRITES), filtered(REST, DB, READS)],
                thresholds: [metric('errorRate', '<', 1), metric('p95Latency', '<', 500)],
            },
        ],
    },

    // ── Level 5: The Gateway ─────────────────────────────────────────
    {
        id: 'level-5',
        name: 'The Gateway',
        description: 'Security audit: backends are directly exposed. Single entry point required.',
        briefing:
            'Your compliance review came back with a red flag: Origin connects straight to the REST Service, ' +
            'with no rate limiting, no auth layer and no single point of control. ' +
            'Place an API Gateway and route all traffic through it, then remove the direct Origin to REST connection. ' +
            'The audit also flagged slow reads at peak: the Database cannot keep up with the repeat reads. ' +
            'For full marks, add a Cache on the read path too.',
        services: [
            { type: ORIGIN, gridX: 0, gridY: 6 },
            { type: REST, gridX: 7, gridY: 5 },
            { type: DB, gridX: 14, gridY: 5 },
        ],
        connections: [
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 1, targetPortIndex: 0 },
            { sourceIndex: 1, sourcePortIndex: 1, targetIndex: 2, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 15,
                    distribution: [
                        { method: GET, resource: 'users', weight: 45 },
                        { method: GET, resource: 'products', weight: 35 },
                        { method: POST, resource: 'orders', weight: 12 },
                        { method: PUT, resource: 'users', weight: 5 },
                        { method: DELETE, resource: 'orders', weight: 3 },
                    ],
                    phases: [phase('Warm-up', 8, 15), phase('Peak', 10, 28), phase('Cool-down', 6, 15)],
                },
            },
        ],
        availableResources: [
            { type: GW, count: 1 },
            { type: CACHE, count: 1 },
        ],
        stars: [
            {
                label: 'Gateway online',
                conditions: [path(ORIGIN, GW, REST), path(ORIGIN, REST)],
                thresholds: [metric('errorRate', '<', 20)],
            },
            {
                label: 'Single entry point',
                conditions: [path(ORIGIN, GW, REST), noPath(ORIGIN, REST)],
                thresholds: [metric('errorRate', '<', 20)],
            },
            {
                label: 'Gateway + cache',
                conditions: [path(ORIGIN, GW, REST), noPath(ORIGIN, REST), path(REST, CACHE, DB)],
                thresholds: [metric('errorRate', '<', 1), metric('p95Latency', '<', 800)],
            },
        ],
    },

    // ── Level 6: Scale + Cache ───────────────────────────────────────
    {
        id: 'level-6',
        name: 'Scale + Cache',
        description: 'You just hit the front page. Traffic is about to triple.',
        briefing:
            'The post went live an hour ago and the traffic graph is going vertical. ' +
            'Two REST Services are already wired to the Database, but Origin has no way in yet. ' +
            'One REST Service handles about 40 requests per second; the peak is more than that. ' +
            'Place a Load Balancer to spread traffic across both backends, ' +
            'and a Cache to keep the flood of repeated reads away from the Database. ' +
            'For the cleanest architecture, both backends share the Cache and only send it reads.',
        services: [
            { type: ORIGIN, gridX: 0, gridY: 6 },
            { type: REST, gridX: 9, gridY: 2 },
            { type: REST, gridX: 9, gridY: 9 },
            { type: DB, gridX: 16, gridY: 5 },
        ],
        connections: [
            { sourceIndex: 1, sourcePortIndex: 1, targetIndex: 3, targetPortIndex: 0 },
            { sourceIndex: 2, sourcePortIndex: 1, targetIndex: 3, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 15,
                    distribution: [
                        { method: GET, resource: 'products', weight: 50 },
                        { method: GET, resource: 'users', weight: 25 },
                        { method: POST, resource: 'orders', weight: 15 },
                        { method: PUT, resource: 'products', weight: 5 },
                        { method: DELETE, resource: 'orders', weight: 5 },
                    ],
                    phases: [phase('Warm-up', 8, 15), phase('Front page', 12, 46), phase('Cool-down', 6, 15)],
                },
            },
        ],
        availableResources: [
            { type: LB, count: 1 },
            { type: CACHE, count: 1 },
        ],
        stars: [
            {
                label: 'Just scale',
                conditions: [paths(2, ORIGIN, LB, REST, DB)],
                thresholds: [metric('throughput', '>=', 15)],
            },
            {
                label: 'Scale + shared cache',
                conditions: [paths(2, ORIGIN, LB, REST, CACHE, DB)],
                thresholds: [metric('errorRate', '<', 1), metric('p95Latency', '<', 1000)],
            },
            {
                label: 'Cache for reads only',
                conditions: [
                    paths(2, ORIGIN, LB, REST, CACHE, DB),
                    filtered(REST, CACHE, READS),
                    filtered(REST, DB, WRITES),
                ],
                thresholds: [metric('errorRate', '<', 1), metric('p95Latency', '<', 900)],
            },
        ],
    },

    // ── Level 7: Two Paths ───────────────────────────────────────────
    {
        id: 'level-7',
        name: 'Two Paths',
        description: 'Reads and writes are fighting over the same backends.',
        briefing:
            'Both REST Services send traffic straight to the same Database, where reads and writes compete for capacity. ' +
            'Build a shared read path with a Cache and a write path with a Message Queue. ' +
            'At first, Origin still splits requests randomly, so some reads can land on the queue side and fail. ' +
            'Route reads to the backend connected to the Cache and writes to the backend connected to both paths. ' +
            'For full marks, add downstream rules too: the shared backend should send reads to Cache and writes to the Queue.',
        services: [
            { type: ORIGIN, gridX: 0, gridY: 6 },
            { type: REST, gridX: 5, gridY: 2 },
            { type: REST, gridX: 5, gridY: 10 },
            { type: DB, gridX: 16, gridY: 5 },
        ],
        connections: [
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 1, targetPortIndex: 0 },
            { sourceIndex: 0, sourcePortIndex: 0, targetIndex: 2, targetPortIndex: 0 },
            { sourceIndex: 1, sourcePortIndex: 1, targetIndex: 3, targetPortIndex: 0 },
            { sourceIndex: 2, sourcePortIndex: 1, targetIndex: 3, targetPortIndex: 0 },
        ],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 15,
                    distribution: [
                        { method: GET, resource: 'products', weight: 40 },
                        { method: GET, resource: 'users', weight: 20 },
                        { method: POST, resource: 'orders', weight: 20 },
                        { method: PUT, resource: 'products', weight: 10 },
                        { method: DELETE, resource: 'orders', weight: 10 },
                    ],
                    phases: [phase('Warm-up', 6, 15), phase('Peak', 12, 36), phase('Cool-down', 6, 15)],
                },
            },
        ],
        availableResources: [
            { type: CACHE, count: 1 },
            { type: MQ, count: 1 },
        ],
        stars: [
            {
                label: 'Both paths built',
                conditions: [path(REST, CACHE, DB), path(REST, MQ, DB), noPath(REST, DB)],
                thresholds: [metric('errorRate', '<', 20)],
            },
            {
                label: 'Traffic split at the source',
                conditions: [
                    path(REST, CACHE, DB),
                    path(REST, MQ, DB),
                    noPath(REST, DB),
                    filtered(ORIGIN, REST, READS),
                    filtered(ORIGIN, REST, WRITES),
                ],
                thresholds: [metric('errorRate', '<', 1), metric('p95Latency', '<', 1500)],
            },
            {
                label: 'Ruled end to end',
                conditions: [
                    path(REST, CACHE, DB),
                    path(REST, MQ, DB),
                    noPath(REST, DB),
                    filtered(ORIGIN, REST, READS),
                    filtered(ORIGIN, REST, WRITES),
                    filtered(REST, CACHE, READS),
                    filtered(REST, MQ, WRITES),
                ],
                thresholds: [metric('errorRate', '<', 1), metric('p95Latency', '<', 800)],
            },
        ],
    },

    // ── Level 8: Full Stack ──────────────────────────────────────────
    {
        id: 'level-8',
        name: 'Full Stack',
        description: 'Greenfield project. You have an Origin, a Database, and a blank canvas.',
        briefing:
            'New company, new system, and the investors want a demo in an hour. ' +
            'All you have is an Origin generating traffic and a Database to persist it. ' +
            'The palette has a Gateway for access control, a Load Balancer for scale, ' +
            'two REST Services for business logic, a Cache for reads and a Message Queue for writes. ' +
            'The launch peak is more than one backend can take. Build something you would be proud to put in production.',
        services: [
            { type: ORIGIN, gridX: 0, gridY: 6 },
            { type: DB, gridX: 17, gridY: 5 },
        ],
        connections: [],
        traffic: [
            {
                originIndex: 0,
                pattern: {
                    requestsPerSecond: 15,
                    distribution: [
                        { method: GET, resource: 'products', weight: 45 },
                        { method: GET, resource: 'users', weight: 20 },
                        { method: POST, resource: 'orders', weight: 20 },
                        { method: PUT, resource: 'products', weight: 8 },
                        { method: DELETE, resource: 'orders', weight: 7 },
                    ],
                    phases: [phase('Warm-up', 6, 15), phase('Launch', 12, 55), phase('Cool-down', 6, 15)],
                },
            },
        ],
        availableResources: [
            { type: GW, count: 1 },
            { type: LB, count: 1 },
            { type: REST, count: 2 },
            { type: CACHE, count: 1 },
            { type: MQ, count: 1 },
        ],
        stars: [
            {
                label: 'Minimal demo',
                conditions: [path(ORIGIN, GW, REST, DB), noPath(ORIGIN, GW, LB)],
                thresholds: [metric('throughput', '>=', 15)],
            },
            {
                label: 'Use everything',
                conditions: [paths(2, ORIGIN, GW, LB, REST), path(REST, CACHE, DB), path(REST, MQ, DB)],
                thresholds: [metric('errorRate', '<', 20)],
            },
            {
                label: 'Production ready',
                conditions: [
                    paths(2, ORIGIN, GW, LB, REST),
                    path(REST, CACHE, DB),
                    path(REST, MQ, DB),
                    filtered(REST, CACHE, READS),
                    filtered(REST, MQ, WRITES),
                ],
                thresholds: [metric('errorRate', '<', 1), metric('p95Latency', '<', 1000)],
            },
        ],
    },
];
