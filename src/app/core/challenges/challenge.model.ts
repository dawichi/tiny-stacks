import type { ServiceType } from '../game/service-types.config';
import type { ConnectionFilter, RequestMethod, RunSummary, TrafficPattern } from '../game/sim-types';

// ── Win Condition Types ──────────────────────────────────────────────

export type ConditionOperator = '>=' | '<=' | '<' | '>' | '==';

/** Topology checks, evaluated on the board as the player builds it */
export type TopologyMetric = 'pathExists' | 'pathNotExists' | 'filteredPathExists';

/** Outcome checks, evaluated on the results of a deploy run */
export type RunMetric = keyof Pick<
    RunSummary,
    'errorRate' | 'avgLatency' | 'p95Latency' | 'throughput' | 'cost' | 'dbOperations'
>;

/** A topology condition: purely declarative, JSON-serializable */
export interface TopologyCondition {
    metric: TopologyMetric;
    operator: ConditionOperator;
    value: number;
    /** Ordered service type chain, hop by hop */
    path: ServiceType[];
    /** For 'filteredPathExists': the hop's route rule must allow EXACTLY these methods */
    requiredMethods?: RequestMethod[];
}

/** A threshold on a deploy run metric */
export interface MetricCondition {
    metric: RunMetric;
    operator: ConditionOperator;
    value: number;
}

/**
 * Star tier: the board must match every topology condition (the pattern being taught)
 * and the deploy run must meet every threshold (proof that it works).
 */
export interface StarTier {
    label: string; // achievement name shown to the player
    conditions: TopologyCondition[];
    thresholds: MetricCondition[];
}

// ── Challenge Layout Types ───────────────────────────────────────────

/** A service pre-placed on the board (serializable, no runtime ID). Pre-placed services are locked. */
export interface ChallengeService {
    type: ServiceType;
    gridX: number;
    gridY: number;
}

/** A pre-placed connection (references services by array index). Always editable. */
export interface ChallengeConnection {
    sourceIndex: number;
    sourcePortIndex: number;
    targetIndex: number;
    targetPortIndex: number;
    filter?: ConnectionFilter;
}

/** Per-origin traffic configuration (references service by array index) */
export interface ChallengeTraffic {
    originIndex: number;
    pattern: TrafficPattern;
}

/** A scripted incident during the deploy run (references service by array index) */
export interface ChallengeOutage {
    serviceIndex: number;
    atMs: number;
    durationMs: number;
}

// ── Challenge Definition ─────────────────────────────────────────────

/** Full challenge definition: pure data, JSON-serializable */
export interface ChallengeDefinition {
    id: string;
    name: string;
    description: string;
    briefing: string;
    services: ChallengeService[];
    connections: ChallengeConnection[];
    /** `requestsPerSecond` drives the build phase; `phases` script the deploy run */
    traffic: ChallengeTraffic[];
    outages?: ChallengeOutage[];
    /** Services the player can place, with per-type quantity limits */
    availableResources: { type: ServiceType; count: number }[];
    stars: [StarTier, StarTier, StarTier];
}

// ── Results ──────────────────────────────────────────────────────────

export interface ThresholdResult {
    condition: MetricCondition;
    actual: number;
    passed: boolean;
}

export interface TierResult {
    label: string;
    topologyPassed: boolean;
    thresholds: ThresholdResult[];
    earned: boolean;
}

/** Outcome of one deploy run */
export interface DeployResult {
    summary: RunSummary;
    stars: number;
    tiers: TierResult[];
}

// ── Player Progress ──────────────────────────────────────────────────

/** Persisted player progress per challenge */
export interface ChallengeProgressEntry {
    starsEarned: number; // 0-3
    /** Best p95 latency (ms) measured in a deploy run */
    bestP95?: number;
    /** Best error rate (%) measured in a deploy run */
    bestErrorRate?: number;
    /** Lowest cost measured in a deploy run */
    bestCost?: number;
}

export type ChallengeProgress = Record<string, ChallengeProgressEntry>;
