import type { ServiceType } from '../game/service-types.config';
import type { ConnectionFilter, RequestMethod, TrafficPattern } from '../game/sim-types';

// ── Win Condition Types ──────────────────────────────────────────────

/** Metric sources that win conditions can reference */
export type ConditionMetric =
    | 'throughput'
    | 'errorRate'
    | 'avgLatency'
    | 'totalCompleted'
    | 'serviceCount'
    | 'pathExists'
    | 'pathNotExists'
    | 'filteredPathExists';

export type ConditionOperator = '>=' | '<=' | '<' | '>' | '==';

/** A single win condition:purely declarative, JSON-serializable */
export interface WinCondition {
    metric: ConditionMetric;
    operator: ConditionOperator;
    value: number;
    sustainMs?: number; // must hold true for this duration (default 0 = instant)
    /** Required for metric === 'pathExists' | 'filteredPathExists': ordered service type chain */
    path?: ServiceType[];
    /** Required for metric === 'filteredPathExists': the connection must allow EXACTLY these methods */
    requiredMethods?: RequestMethod[];
}

/** Star tier:all conditions must pass to earn this star */
export interface StarTier {
    label: string; // achievement name shown to the player
    conditions: WinCondition[];
}

// ── Challenge Layout Types ───────────────────────────────────────────

/** A service pre-placed on the board (serializable, no runtime ID) */
export interface ChallengeService {
    type: ServiceType;
    gridX: number;
    gridY: number;
    locked?: boolean; // player can't move or delete
}

/** A pre-placed connection (references services by array index) */
export interface ChallengeConnection {
    sourceIndex: number;
    sourcePortIndex: number;
    targetIndex: number;
    targetPortIndex: number;
    filter?: ConnectionFilter;
    locked?: boolean;
}

/** Per-origin traffic configuration (references service by array index) */
export interface ChallengeTraffic {
    originIndex: number;
    pattern: TrafficPattern;
}

// ── Challenge Definition ─────────────────────────────────────────────

/** Full challenge definition:pure data, JSON-serializable */
export interface ChallengeDefinition {
    id: string;
    name: string;
    description: string;
    briefing: string;
    services: ChallengeService[];
    connections: ChallengeConnection[];
    traffic: ChallengeTraffic[];
    /** Services the player can place, with per-type quantity limits */
    availableResources: { type: ServiceType; count: number }[];
    stars: [StarTier, StarTier, StarTier];
    gridSize?: { width: number; height: number };
}

// ── Player Progress ──────────────────────────────────────────────────

/** Persisted player progress per challenge */
export interface ChallengeProgressEntry {
    starsEarned: number; // 0-3
    bestLatency?: number;
    bestThroughput?: number;
}

export type ChallengeProgress = Record<string, ChallengeProgressEntry>;
