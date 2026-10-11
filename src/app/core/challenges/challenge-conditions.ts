import type { ServiceType } from '../game/service-types.config';
import { RequestMethod, type TrafficPhase, WRITE_METHODS } from '../game/sim-types';
import type { ConditionOperator, MetricCondition, RunMetric, TopologyCondition } from './challenge.model';

/**
 * Builders for challenge definitions. They only return plain objects,
 * so definitions stay JSON-serializable data.
 */

/** At least one path following these service types, hop by hop */
export function path(...types: ServiceType[]): TopologyCondition {
    return { metric: 'pathExists', operator: '>=', value: 1, path: types };
}

/** At least `count` distinct paths (e.g. both outputs of a Load Balancer in use) */
export function paths(count: number, ...types: ServiceType[]): TopologyCondition {
    return { metric: 'pathExists', operator: '>=', value: count, path: types };
}

/** No path following these service types */
export function noPath(...types: ServiceType[]): TopologyCondition {
    return { metric: 'pathNotExists', operator: '>=', value: 1, path: types };
}

/** A direct connection `from → to` whose route rule allows exactly `methods` */
export function filtered(from: ServiceType, to: ServiceType, methods: readonly RequestMethod[]): TopologyCondition {
    return { metric: 'filteredPathExists', operator: '>=', value: 1, path: [from, to], requiredMethods: [...methods] };
}

/** A threshold on a deploy run metric */
export function metric(name: RunMetric, operator: ConditionOperator, value: number): MetricCondition {
    return { metric: name, operator, value };
}

export const READS: readonly RequestMethod[] = [RequestMethod.GET];
export const WRITES: readonly RequestMethod[] = WRITE_METHODS;

/** Shorthand for a traffic phase */
export function phase(label: string, seconds: number, requestsPerSecond: number): TrafficPhase {
    return { label, durationMs: seconds * 1000, requestsPerSecond };
}
