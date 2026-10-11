import {
    type Board,
    canConnectOnBoard,
    canPlaceOnBoard,
    createConnectionId,
    createServiceId,
    GRID_CONFIG,
} from '../game/game-state.service';
import { getServiceConfig, PortDirection, ServiceType } from '../game/service-types.config';
import { seedFromString } from '../game/sim-random';
import { type RequestMethod, WRITE_METHODS } from '../game/sim-types';
import { Simulation } from '../game/simulation';
import type { ChallengeDefinition, DeployResult } from './challenge.model';
import { CHALLENGE_DEFINITIONS } from './challenge-definitions';
import { buildChallengeSetup, scoreDeploy } from './challenge-evaluation';

/**
 * Reference solutions for every level, as data: a list of edits applied to the level's initial board.
 * Tests deploy each one and assert the exact star count (see `challenge-levels.spec.ts`).
 *
 * Services are referenced by their index in the level definition, or by the name given when placed.
 */
type Ref = number | string;

export type FixtureOp =
    | { place: ServiceType; as: string; at: [number, number] }
    | { connect: [Ref, Ref]; methods?: readonly RequestMethod[]; fromPort?: number }
    | { disconnect: [Ref, Ref] }
    | { rule: [Ref, Ref]; methods: readonly RequestMethod[] };

export interface LevelFixtures {
    oneStar: FixtureOp[];
    twoStars: FixtureOp[];
    threeStars: FixtureOp[];
}

const GET_ONLY = ['GET'] as readonly RequestMethod[];
const WRITES = WRITE_METHODS;

export const LEVEL_FIXTURES: Record<string, LevelFixtures> = {
    'level-1': {
        oneStar: [
            { place: ServiceType.CACHE, as: 'cache', at: [9, 3] },
            { connect: [1, 'cache'] },
            { connect: ['cache', 2] },
        ],
        twoStars: [
            { place: ServiceType.CACHE, as: 'cache', at: [9, 3] },
            { connect: [1, 'cache'] },
            { connect: ['cache', 2] },
            { disconnect: [1, 2] },
        ],
        threeStars: [
            { place: ServiceType.CACHE, as: 'cache', at: [9, 3] },
            { connect: [1, 'cache'], methods: GET_ONLY },
            { connect: ['cache', 2] },
            { rule: [1, 2], methods: WRITES },
        ],
    },
    'level-2': {
        oneStar: [{ connect: [0, 2] }],
        twoStars: [
            { place: ServiceType.LOAD_BALANCER, as: 'lb', at: [5, 6] },
            { connect: [0, 'lb'] },
            { connect: ['lb', 1] },
            { connect: ['lb', 2], fromPort: 2 },
        ],
        threeStars: [
            { place: ServiceType.LOAD_BALANCER, as: 'lb', at: [5, 6] },
            { disconnect: [0, 1] },
            { connect: [0, 'lb'] },
            { connect: ['lb', 1] },
            { connect: ['lb', 2], fromPort: 2 },
        ],
    },
    'level-3': {
        oneStar: [{ disconnect: [1, 3] }],
        twoStars: [{ rule: [1, 3], methods: WRITES }],
        threeStars: [
            { rule: [1, 3], methods: WRITES },
            { rule: [1, 2], methods: GET_ONLY },
        ],
    },
    'level-4': {
        oneStar: [
            { place: ServiceType.MESSAGE_QUEUE, as: 'mq', at: [9, 1] },
            { connect: [1, 'mq'] },
            { connect: ['mq', 2] },
        ],
        twoStars: [
            { place: ServiceType.MESSAGE_QUEUE, as: 'mq', at: [9, 1] },
            { connect: [1, 'mq'], methods: WRITES },
            { connect: ['mq', 2] },
        ],
        threeStars: [
            { place: ServiceType.MESSAGE_QUEUE, as: 'mq', at: [9, 1] },
            { connect: [1, 'mq'], methods: WRITES },
            { connect: ['mq', 2] },
            { rule: [1, 2], methods: GET_ONLY },
        ],
    },
    'level-5': {
        oneStar: [
            { place: ServiceType.API_GATEWAY, as: 'gw', at: [3, 2] },
            { connect: [0, 'gw'] },
            { connect: ['gw', 1] },
        ],
        twoStars: [
            { place: ServiceType.API_GATEWAY, as: 'gw', at: [3, 2] },
            { disconnect: [0, 1] },
            { connect: [0, 'gw'] },
            { connect: ['gw', 1] },
        ],
        threeStars: [
            { place: ServiceType.API_GATEWAY, as: 'gw', at: [3, 2] },
            { place: ServiceType.CACHE, as: 'cache', at: [11, 2] },
            { disconnect: [0, 1] },
            { connect: [0, 'gw'] },
            { connect: ['gw', 1] },
            { connect: [1, 'cache'], methods: GET_ONLY },
            { connect: ['cache', 2] },
            { rule: [1, 2], methods: WRITES },
        ],
    },
    'level-6': {
        oneStar: [
            { place: ServiceType.LOAD_BALANCER, as: 'lb', at: [4, 6] },
            { connect: [0, 'lb'] },
            { connect: ['lb', 1] },
            { connect: ['lb', 2], fromPort: 2 },
        ],
        twoStars: [
            { place: ServiceType.LOAD_BALANCER, as: 'lb', at: [4, 6] },
            { place: ServiceType.CACHE, as: 'cache', at: [13, 4] },
            { connect: [0, 'lb'] },
            { connect: ['lb', 1] },
            { connect: ['lb', 2], fromPort: 2 },
            { connect: [1, 'cache'] },
            { connect: [2, 'cache'] },
            { connect: ['cache', 3] },
            { disconnect: [1, 3] },
            { disconnect: [2, 3] },
        ],
        threeStars: [
            { place: ServiceType.LOAD_BALANCER, as: 'lb', at: [4, 6] },
            { place: ServiceType.CACHE, as: 'cache', at: [13, 4] },
            { connect: [0, 'lb'] },
            { connect: ['lb', 1] },
            { connect: ['lb', 2], fromPort: 2 },
            { connect: [1, 'cache'], methods: GET_ONLY },
            { connect: [2, 'cache'], methods: GET_ONLY },
            { connect: ['cache', 3] },
            { rule: [1, 3], methods: WRITES },
            { rule: [2, 3], methods: WRITES },
        ],
    },
    'level-7': {
        oneStar: [
            { place: ServiceType.CACHE, as: 'cache', at: [10, 3] },
            { place: ServiceType.MESSAGE_QUEUE, as: 'mq', at: [10, 9] },
            { disconnect: [1, 3] },
            { disconnect: [2, 3] },
            { connect: [1, 'cache'] },
            { connect: [2, 'cache'] },
            { connect: ['cache', 3] },
            { connect: [2, 'mq'] },
            { connect: ['mq', 3] },
        ],
        twoStars: [
            { place: ServiceType.CACHE, as: 'cache', at: [10, 3] },
            { place: ServiceType.MESSAGE_QUEUE, as: 'mq', at: [10, 9] },
            { disconnect: [1, 3] },
            { disconnect: [2, 3] },
            { connect: [1, 'cache'] },
            { connect: [2, 'cache'] },
            { connect: ['cache', 3] },
            { connect: [2, 'mq'] },
            { connect: ['mq', 3] },
            { rule: [0, 1], methods: GET_ONLY },
            { rule: [0, 2], methods: WRITES },
        ],
        threeStars: [
            { place: ServiceType.CACHE, as: 'cache', at: [10, 3] },
            { place: ServiceType.MESSAGE_QUEUE, as: 'mq', at: [10, 9] },
            { disconnect: [1, 3] },
            { disconnect: [2, 3] },
            { connect: [1, 'cache'], methods: GET_ONLY },
            { connect: [2, 'cache'] },
            { connect: ['cache', 3] },
            { connect: [2, 'mq'], methods: WRITES },
            { connect: ['mq', 3] },
            { rule: [0, 1], methods: GET_ONLY },
            { rule: [0, 2], methods: WRITES },
            { rule: [2, 'cache'], methods: GET_ONLY },
        ],
    },
    'level-8': {
        oneStar: [
            { place: ServiceType.API_GATEWAY, as: 'gw', at: [3, 6] },
            { place: ServiceType.REST_SERVICE, as: 'rest1', at: [10, 3] },
            { connect: [0, 'gw'] },
            { connect: ['gw', 'rest1'] },
            { connect: ['rest1', 1] },
        ],
        twoStars: [
            { place: ServiceType.API_GATEWAY, as: 'gw', at: [3, 6] },
            { place: ServiceType.LOAD_BALANCER, as: 'lb', at: [7, 6] },
            { place: ServiceType.REST_SERVICE, as: 'rest1', at: [10, 3] },
            { place: ServiceType.REST_SERVICE, as: 'rest2', at: [10, 10] },
            { place: ServiceType.CACHE, as: 'cache', at: [13, 2] },
            { place: ServiceType.MESSAGE_QUEUE, as: 'mq', at: [13, 9] },
            { connect: [0, 'gw'] },
            { connect: ['gw', 'lb'] },
            { connect: ['lb', 'rest1'] },
            { connect: ['lb', 'rest2'], fromPort: 2 },
            { connect: ['rest1', 'cache'] },
            { connect: ['rest1', 'mq'] },
            { connect: ['rest2', 'cache'] },
            { connect: ['rest2', 'mq'] },
            { connect: ['cache', 1] },
            { connect: ['mq', 1] },
        ],
        threeStars: [
            { place: ServiceType.API_GATEWAY, as: 'gw', at: [3, 6] },
            { place: ServiceType.LOAD_BALANCER, as: 'lb', at: [7, 6] },
            { place: ServiceType.REST_SERVICE, as: 'rest1', at: [10, 3] },
            { place: ServiceType.REST_SERVICE, as: 'rest2', at: [10, 10] },
            { place: ServiceType.CACHE, as: 'cache', at: [13, 2] },
            { place: ServiceType.MESSAGE_QUEUE, as: 'mq', at: [13, 9] },
            { connect: [0, 'gw'] },
            { connect: ['gw', 'lb'] },
            { connect: ['lb', 'rest1'] },
            { connect: ['lb', 'rest2'], fromPort: 2 },
            { connect: ['rest1', 'cache'], methods: GET_ONLY },
            { connect: ['rest1', 'mq'], methods: WRITES },
            { connect: ['rest2', 'cache'], methods: GET_ONLY },
            { connect: ['rest2', 'mq'], methods: WRITES },
            { connect: ['cache', 1] },
            { connect: ['mq', 1] },
        ],
    },
};

function firstPort(type: ServiceType, accepts: (d: PortDirection) => boolean): number {
    const index = getServiceConfig(type).ports.findIndex((p) => accepts(p.direction));
    if (index < 0) throw new Error(`Fixture: ${type} has no suitable port`);
    return index;
}

/** Apply fixture edits to a board, enforcing the same rules as the game (and the level's palette) */
export function applyFixture(def: ChallengeDefinition, board: Board, serviceIds: string[], ops: FixtureOp[]): Board {
    let services = [...board.services];
    let connections = [...board.connections];
    const named = new Map<string, string>();
    const placed = new Map<ServiceType, number>();

    const resolve = (ref: Ref): string => {
        const id = typeof ref === 'number' ? serviceIds[ref] : named.get(ref);
        if (!id) throw new Error(`Fixture: unknown service ${ref}`);
        return id;
    };
    const typeOf = (id: string): ServiceType => {
        const svc = services.find((s) => s.id === id);
        if (!svc) throw new Error(`Fixture: missing service ${id}`);
        return svc.type;
    };
    const between = (from: Ref, to: Ref) => {
        const source = resolve(from);
        const target = resolve(to);
        const conn = connections.find((c) => c.source.serviceId === source && c.target.serviceId === target);
        if (!conn) throw new Error(`Fixture: no connection ${from} -> ${to}`);
        return conn;
    };

    for (const op of ops) {
        if ('place' in op) {
            const used = (placed.get(op.place) ?? 0) + 1;
            const allowed = def.availableResources.find((r) => r.type === op.place)?.count ?? 0;
            if (used > allowed) throw new Error(`Fixture: ${def.id} has no ${op.place} left`);
            if (!canPlaceOnBoard(services, GRID_CONFIG, op.place, op.at[0], op.at[1])) {
                throw new Error(`Fixture: cannot place ${op.place} at ${op.at}`);
            }
            placed.set(op.place, used);
            const id = createServiceId();
            named.set(op.as, id);
            services = [...services, { id, type: op.place, gridX: op.at[0], gridY: op.at[1] }];
        } else if ('connect' in op) {
            const sourceId = resolve(op.connect[0]);
            const targetId = resolve(op.connect[1]);
            const source = {
                serviceId: sourceId,
                portIndex: op.fromPort ?? firstPort(typeOf(sourceId), (d) => d !== PortDirection.INPUT),
            };
            const target = {
                serviceId: targetId,
                portIndex: firstPort(typeOf(targetId), (d) => d !== PortDirection.OUTPUT),
            };
            if (!canConnectOnBoard(services, connections, source, target)) {
                throw new Error(`Fixture: cannot connect ${op.connect[0]} -> ${op.connect[1]}`);
            }
            const filter = op.methods ? { methods: [...op.methods], weight: 100 } : undefined;
            connections = [...connections, { id: createConnectionId(), source, target, ...(filter ? { filter } : {}) }];
        } else if ('disconnect' in op) {
            const conn = between(op.disconnect[0], op.disconnect[1]);
            connections = connections.filter((c) => c !== conn);
        } else {
            const conn = between(op.rule[0], op.rule[1]);
            connections = connections.map((c) =>
                c === conn ? { ...c, filter: { methods: [...op.methods], weight: c.filter?.weight ?? 100 } } : c,
            );
        }
    }
    return { services, connections };
}

/** Deploy a board for a level exactly as the game does, and score it */
export function deployLevel(def: ChallengeDefinition, ops: FixtureOp[] = []): DeployResult {
    const setup = buildChallengeSetup(def);
    const board = applyFixture(def, setup.board, setup.serviceIds, ops);
    const sim = new Simulation(seedFromString(def.id));
    sim.setTraffic(setup.traffic);
    sim.startRun(setup.outages);
    const stepMs = 1000 / 60;
    for (let i = 0; i < 60 * 120; i++) {
        sim.step(board, stepMs);
        const run = sim.runState();
        if (run?.finished && run.summary) return scoreDeploy(def, board, run.summary);
    }
    throw new Error(`Deploy of ${def.id} did not finish`);
}

export function levelDefinition(id: string): ChallengeDefinition {
    const def = CHALLENGE_DEFINITIONS.find((d) => d.id === id);
    if (!def) throw new Error(`Unknown level ${id}`);
    return def;
}
