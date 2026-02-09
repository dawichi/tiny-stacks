/**
 * HTTP request methods
 */
export enum RequestMethod {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
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
 * A simulated request flowing through the service graph
 */
export interface SimRequest {
    id: string;
    method: RequestMethod;
    resource: string;
    status: 'traveling' | 'queued' | 'processing' | 'completed' | 'failed';
    direction: 'forward' | 'response';
    currentServiceId: string;
    originServiceId: string;
    connectionId: string | null;
    travelProgress: number;
    spawnedAtTick: number;
    totalLatency: number;
    routeHistory: string[];
}

/**
 * Traffic pattern configuration for an Origin service
 */
export interface TrafficPattern {
    requestsPerSecond: number;
    distribution: { method: RequestMethod; resource: string; weight: number }[];
}

/**
 * Runtime state for a single service during simulation
 */
export interface ServiceRuntimeState {
    serviceId: string;
    queue: SimRequest[];
    processing: SimRequest[];
    processingProgress: Map<string, number>;
}

/**
 * Cache performance statistics for a single Cache service
 */
export interface CacheStats {
    hitCount: number;
    missCount: number;
    cachedResources: number;
}
