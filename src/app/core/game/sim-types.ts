/**
 * HTTP request methods
 */
export enum RequestMethod {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
}

export const ALL_METHODS: readonly RequestMethod[] = [
    RequestMethod.GET,
    RequestMethod.POST,
    RequestMethod.PUT,
    RequestMethod.DELETE,
];

export const WRITE_METHODS: readonly RequestMethod[] = [RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE];

export function isWrite(method: RequestMethod): boolean {
    return method !== RequestMethod.GET;
}

/**
 * Colors associated with each request method (for packet rendering)
 */
export const REQUEST_METHOD_COLORS: Record<RequestMethod, string> = {
    [RequestMethod.GET]: '#87CEEB',
    [RequestMethod.POST]: '#A8E6CF',
    [RequestMethod.PUT]: '#FFE5A0',
    [RequestMethod.DELETE]: '#FFCBA4',
};

/**
 * A simulated request flowing through the service graph.
 *
 * `client` requests come from an Origin and are what the player is measured on.
 * `async` requests are Message Queue deliveries: the producer was already acknowledged,
 * so they never count as client completions or failures.
 */
export interface SimRequest {
    id: string;
    kind: 'client' | 'async';
    method: RequestMethod;
    resource: string;
    status: 'traveling' | 'queued' | 'processing' | 'backlogged' | 'waiting' | 'completed' | 'failed';
    direction: 'forward' | 'response';
    currentServiceId: string;
    originServiceId: string;
    connectionId: string | null;
    travelProgress: number;
    /** Accounted latency: network per hop + queue wait + processing (ms) */
    totalLatency: number;
    /** Connections traversed forward, popped while the response travels back */
    routeHistory: string[];
    /** Caches that missed for this GET: they store the resource when the response passes back */
    cacheMisses: string[];
    /** Message Queue whose consumer slot this request holds while being delivered */
    mqSlot: string | null;
}

/**
 * One step of a scripted traffic timeline
 */
export interface TrafficPhase {
    /** Shown in the HUD while the phase runs, e.g. "Spike" */
    label: string;
    durationMs: number;
    requestsPerSecond: number;
}

/**
 * Traffic pattern configuration for an Origin service.
 * `requestsPerSecond` is the baseline used while building; `phases` (optional) script a deploy run.
 */
export interface TrafficPattern {
    requestsPerSecond: number;
    distribution: { method: RequestMethod; resource: string; weight: number }[];
    phases?: TrafficPhase[];
}

/**
 * A scripted incident during a deploy run
 */
export interface SimOutage {
    serviceId: string;
    atMs: number;
    durationMs: number;
}

/**
 * Runtime state for a single service during simulation
 */
export interface ServiceRuntimeState {
    serviceId: string;
    queue: SimRequest[];
    processing: SimRequest[];
    processingProgress: Map<string, number>;
    /** Message Queue only: accepted messages waiting for a consumer */
    backlog: SimRequest[];
    /** Cache only: reads waiting for a fetch of the same resource that is already in flight */
    waiting: SimRequest[];
    /** Message Queue only: deliveries currently in flight downstream */
    consumersBusy: number;
    /** Sim time of the last failure at this service (for the overload pulse) */
    lastFailureAt: number;
}

/**
 * Per-connection routing filter
 */
export interface ConnectionFilter {
    methods: RequestMethod[]; // empty = all methods allowed
    weight: number; // 1-100, default 100
}

/**
 * Cache performance statistics for a single Cache service
 */
export interface CacheStats {
    hitCount: number;
    missCount: number;
    cachedResources: number;
}

/**
 * Global simulation metrics (live, windowed)
 */
export interface SimMetrics {
    totalCompleted: number;
    totalFailed: number;
    activeRequests: number;
    /** Mean latency of the last completions (ms) */
    avgLatency: number;
    /** 95th percentile latency of the last completions (ms) */
    p95Latency: number;
    /** Completions per second over the last few seconds */
    throughput: number;
    /** Failed / finished requests over the last few seconds (%) */
    errorRate: number;
    /** Spend per second over the last few seconds */
    costPerSecond: number;
    /** Message Queue messages waiting or in flight */
    asyncPending: number;
    /** Message Queue deliveries that failed and were retried */
    asyncRetries: number;
    /** Messages lost because a queue's backlog was full */
    asyncDropped: number;
}

/**
 * Results of a scripted deploy run, measured over the run only
 */
export interface RunSummary {
    durationMs: number;
    completed: number;
    failed: number;
    /** % of client requests that failed */
    errorRate: number;
    avgLatency: number;
    p95Latency: number;
    /** Completions per second */
    throughput: number;
    /** Total spend over the run (infrastructure + database operations) */
    cost: number;
    /** Requests the Database(s) processed */
    dbOperations: number;
}

/**
 * Progress of a scripted deploy run
 */
export interface RunState {
    durationMs: number;
    elapsedMs: number;
    phaseLabel: string;
    /** True after traffic stopped and in-flight requests drained (or timed out) */
    finished: boolean;
    summary: RunSummary | null;
}
