import { type Board, createConnectionId, createServiceId } from '../game/game-state.service';
import type { ServiceType } from '../game/service-types.config';
import type { RequestMethod, RunSummary, SimOutage, TrafficPattern } from '../game/sim-types';
import type {
    ChallengeDefinition,
    ConditionOperator,
    DeployResult,
    MetricCondition,
    TopologyCondition,
} from './challenge.model';

/**
 * Pure challenge rules: building a level's board, checking topology, scoring a deploy run.
 * No Angular here, so the same code runs in the game and in fixture tests.
 */

/** A challenge's board with runtime ids, plus the lookups needed to run it */
export interface ChallengeSetup {
    board: Board;
    /** Runtime id of each pre-placed service, by definition index */
    serviceIds: string[];
    traffic: Map<string, TrafficPattern>;
    outages: SimOutage[];
}

export function buildChallengeSetup(def: ChallengeDefinition): ChallengeSetup {
    const serviceIds = def.services.map(() => createServiceId());
    const getServiceId = (index: number, relation: string): string => {
        const serviceId = serviceIds[index];
        if (serviceId === undefined) {
            throw new RangeError(`Invalid challenge definition: ${relation} references service index ${index}.`);
        }
        return serviceId;
    };
    const services = def.services.map((svc, i) => ({
        id: getServiceId(i, 'service'),
        type: svc.type,
        gridX: svc.gridX,
        gridY: svc.gridY,
    }));
    const connections = def.connections.map((conn) => ({
        id: createConnectionId(),
        source: { serviceId: getServiceId(conn.sourceIndex, 'connection source'), portIndex: conn.sourcePortIndex },
        target: { serviceId: getServiceId(conn.targetIndex, 'connection target'), portIndex: conn.targetPortIndex },
        ...(conn.filter ? { filter: { ...conn.filter, methods: [...conn.filter.methods] } } : {}),
    }));
    const traffic = new Map(def.traffic.map((t) => [getServiceId(t.originIndex, 'traffic origin'), t.pattern]));
    const outages = (def.outages ?? []).map((o) => ({
        serviceId: getServiceId(o.serviceIndex, 'outage'),
        atMs: o.atMs,
        durationMs: o.durationMs,
    }));
    return { board: { services, connections }, serviceIds, traffic, outages };
}

// ── Topology ─────────────────────────────────────────────────────────

/**
 * Counts distinct paths matching the ordered service-type sequence.
 * Returns >= 1 if any path exists, >= 2 for two distinct paths, etc.
 */
export function countPaths(board: Board, path: ServiceType[]): number {
    if (path.length < 2) return 1;
    const byId = new Map(board.services.map((s) => [s.id, s]));

    const countFrom = (serviceId: string, index: number): number => {
        if (index >= path.length) return 1;
        const expectedType = path[index];
        if (expectedType === undefined) return 0;
        let sum = 0;
        for (const conn of board.connections) {
            if (conn.source.serviceId !== serviceId) continue;
            const target = byId.get(conn.target.serviceId);
            if (target?.type === expectedType) sum += countFrom(target.id, index + 1);
        }
        return sum;
    };

    return board.services.filter((s) => s.type === path[0]).reduce((sum, s) => sum + countFrom(s.id, 1), 0);
}

/** A direct `path[0] → path[1]` connection whose route rule allows exactly `methods` */
export function hasFilteredHop(board: Board, path: ServiceType[], methods: RequestMethod[]): boolean {
    const [sourceType, targetType] = path;
    if (sourceType === undefined || targetType === undefined) return false;
    const byId = new Map(board.services.map((s) => [s.id, s]));
    const required = [...methods].sort();
    return board.connections.some((conn) => {
        if (byId.get(conn.source.serviceId)?.type !== sourceType) return false;
        if (byId.get(conn.target.serviceId)?.type !== targetType) return false;
        const actual = [...(conn.filter?.methods ?? [])].sort();
        return actual.length === required.length && actual.every((m, i) => m === required[i]);
    });
}

export function compare(value: number, operator: ConditionOperator, target: number): boolean {
    switch (operator) {
        case '>=':
            return value >= target;
        case '<=':
            return value <= target;
        case '>':
            return value > target;
        case '<':
            return value < target;
        case '==':
            return value === target;
        default:
            return false;
    }
}

export function topologyPasses(board: Board, cond: TopologyCondition): boolean {
    switch (cond.metric) {
        case 'pathExists':
            return compare(countPaths(board, cond.path), cond.operator, cond.value);
        case 'pathNotExists':
            return countPaths(board, cond.path) === 0;
        case 'filteredPathExists':
            return hasFilteredHop(board, cond.path, cond.requiredMethods ?? []);
        default:
            return false;
    }
}

/**
 * Highest star tier (1-3) whose topology the board matches, or 0.
 * Hierarchical: ★3 is checked first; matching it implies the lower tiers.
 */
export function topologyTier(def: ChallengeDefinition, board: Board): number {
    for (let tier = def.stars.length; tier >= 1; tier--) {
        if (def.stars[tier - 1]?.conditions.every((cond) => topologyPasses(board, cond))) return tier;
    }
    return 0;
}

// ── Deploy Scoring ───────────────────────────────────────────────────

export function metricPasses(summary: RunSummary, cond: MetricCondition): boolean {
    return compare(summary[cond.metric], cond.operator, cond.value);
}

/**
 * Stars for a deploy run: the highest tier, up to the board's topology tier,
 * whose thresholds the run met. A ★3 topology that misses ★3 thresholds can still earn ★2.
 */
export function scoreDeploy(def: ChallengeDefinition, board: Board, summary: RunSummary): DeployResult {
    const maxTier = topologyTier(def, board);
    const tiers = def.stars.map((tier, i) => ({
        label: tier.label,
        topologyPassed: i + 1 <= maxTier,
        thresholds: tier.thresholds.map((condition) => ({
            condition,
            actual: summary[condition.metric],
            passed: metricPasses(summary, condition),
        })),
        earned: false,
    }));

    let stars = 0;
    for (let tier = maxTier; tier >= 1; tier--) {
        if (tiers[tier - 1]?.thresholds.every((t) => t.passed)) {
            stars = tier;
            break;
        }
    }
    for (let i = 0; i < stars; i++) {
        const tier = tiers[i];
        if (tier) tier.earned = true;
    }

    return { summary, stars, tiers };
}
