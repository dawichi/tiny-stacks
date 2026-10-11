/**
 * Service type identifiers
 */
export enum ServiceType {
    ORIGIN = 'origin',
    API_GATEWAY = 'api_gateway',
    REST_SERVICE = 'rest_service',
    DATABASE = 'database',
    CACHE = 'cache',
    MESSAGE_QUEUE = 'message_queue',
    LOAD_BALANCER = 'load_balancer',
}

/**
 * Port direction for connections
 */
export enum PortDirection {
    INPUT = 'input',
    OUTPUT = 'output',
    BIDIRECTIONAL = 'bidirectional',
}

/**
 * Port configuration for a service
 */
export interface PortConfig {
    /** Relative position within the service footprint (0-based) */
    cellOffsetX: number;
    cellOffsetY: number;
    /** Which edge of the cell the port is on */
    edge: 'north' | 'south' | 'east' | 'west';
    /** Port direction */
    direction: PortDirection;
}

/**
 * Configuration for a service type
 */
export interface ServiceTypeConfig {
    type: ServiceType;
    name: string;
    description: string;
    /** Grid footprint size (in cells) */
    gridWidth: number;
    gridHeight: number;
    /** CSS color for the service */
    color: string;
    /** Lucide icon name */
    icon: string;
    /** Connection ports */
    ports: PortConfig[];
    /** Simulation properties */
    baseProcessingTime: number; // ms per request
    maxConcurrency: number; // max simultaneous requests
    queueSize: number; // max queued requests
    /** Running cost per second while placed on the board */
    costPerSecond: number;
    /** Message Queue only: max accepted messages waiting for delivery */
    backlogSize?: number;
    /** Message Queue only: deliveries in flight downstream at once (consumer workers) */
    consumerConcurrency?: number;
}

/** Cost of every request a Database processes (on top of its running cost) */
export const DB_OPERATION_COST = 0.1;

/** Cached entries expire after this long (simulated ms) */
export const CACHE_TTL_MS = 8000;

/**
 * All service type configurations
 */
export const SERVICE_CONFIGS: Record<ServiceType, ServiceTypeConfig> = {
    [ServiceType.ORIGIN]: {
        type: ServiceType.ORIGIN,
        name: 'Origin',
        description: 'Traffic source. Generates requests that flow through the system.',
        gridWidth: 2,
        gridHeight: 2,
        color: '#FF8B8B', // Coral
        icon: 'cloud',
        ports: [{ cellOffsetX: 1, cellOffsetY: 1, edge: 'east', direction: PortDirection.OUTPUT }],
        baseProcessingTime: 0,
        maxConcurrency: 0,
        queueSize: 0,
        costPerSecond: 0,
    },

    [ServiceType.API_GATEWAY]: {
        type: ServiceType.API_GATEWAY,
        name: 'API Gateway',
        description: 'Single entry point in front of your services. Fast, high capacity routing.',
        gridWidth: 3,
        gridHeight: 2,
        color: '#88D8D8', // Soft Teal
        icon: 'globe',
        ports: [
            { cellOffsetX: 0, cellOffsetY: 0, edge: 'west', direction: PortDirection.INPUT },
            { cellOffsetX: 2, cellOffsetY: 1, edge: 'east', direction: PortDirection.OUTPUT },
        ],
        baseProcessingTime: 5,
        maxConcurrency: 20,
        queueSize: 100,
        costPerSecond: 3,
    },

    [ServiceType.REST_SERVICE]: {
        type: ServiceType.REST_SERVICE,
        name: 'REST Service',
        description: 'Business logic. Handles about 40 req/s before requests start queueing.',
        gridWidth: 2,
        gridHeight: 2,
        color: '#87CEEB', // Sky Blue
        icon: 'server',
        ports: [
            { cellOffsetX: 0, cellOffsetY: 0, edge: 'west', direction: PortDirection.INPUT },
            { cellOffsetX: 1, cellOffsetY: 1, edge: 'east', direction: PortDirection.OUTPUT },
        ],
        baseProcessingTime: 50,
        maxConcurrency: 2,
        queueSize: 20,
        costPerSecond: 2,
    },

    [ServiceType.DATABASE]: {
        type: ServiceType.DATABASE,
        name: 'Database',
        description: 'Persistent storage. Slow: about 20 req/s, and every operation costs money.',
        gridWidth: 3,
        gridHeight: 3,
        color: '#D4A5FF', // Lavender
        icon: 'database',
        ports: [{ cellOffsetX: 1, cellOffsetY: 0, edge: 'north', direction: PortDirection.BIDIRECTIONAL }],
        baseProcessingTime: 100,
        maxConcurrency: 2,
        queueSize: 20,
        costPerSecond: 4,
    },

    [ServiceType.CACHE]: {
        type: ServiceType.CACHE,
        name: 'Cache',
        description:
            'Fast in-memory reads. A miss fetches from downstream; entries expire after a few seconds and writes evict them.',
        gridWidth: 2,
        gridHeight: 1,
        color: '#A8E6CF', // Mint
        icon: 'zap',
        ports: [
            { cellOffsetX: 0, cellOffsetY: 0, edge: 'west', direction: PortDirection.INPUT },
            { cellOffsetX: 1, cellOffsetY: 0, edge: 'east', direction: PortDirection.OUTPUT },
        ],
        baseProcessingTime: 5,
        maxConcurrency: 20,
        queueSize: 50,
        costPerSecond: 1,
    },

    [ServiceType.MESSAGE_QUEUE]: {
        type: ServiceType.MESSAGE_QUEUE,
        name: 'Message Queue',
        description:
            'Acknowledges writes instantly and delivers them downstream at a steady pace. Reads must wait for a reply.',
        gridWidth: 2,
        gridHeight: 3,
        color: '#FFCBA4', // Peach
        icon: 'mail',
        ports: [
            { cellOffsetX: 0, cellOffsetY: 0, edge: 'north', direction: PortDirection.INPUT },
            { cellOffsetX: 1, cellOffsetY: 2, edge: 'south', direction: PortDirection.OUTPUT },
        ],
        baseProcessingTime: 5,
        maxConcurrency: 10,
        queueSize: 50,
        costPerSecond: 1,
        backlogSize: 300,
        consumerConcurrency: 6,
    },

    [ServiceType.LOAD_BALANCER]: {
        type: ServiceType.LOAD_BALANCER,
        name: 'Load Balancer',
        description: 'Sends each request to the least busy healthy target. Skips services that are down.',
        gridWidth: 2,
        gridHeight: 2,
        color: '#FFE5A0', // Soft Gold
        icon: 'split',
        ports: [
            { cellOffsetX: 0, cellOffsetY: 0, edge: 'west', direction: PortDirection.INPUT },
            { cellOffsetX: 1, cellOffsetY: 0, edge: 'east', direction: PortDirection.OUTPUT },
            { cellOffsetX: 1, cellOffsetY: 1, edge: 'east', direction: PortDirection.OUTPUT },
        ],
        baseProcessingTime: 2,
        maxConcurrency: 50,
        queueSize: 50,
        costPerSecond: 1,
    },
};

/**
 * Get service config by type
 */
export function getServiceConfig(type: ServiceType): ServiceTypeConfig {
    return SERVICE_CONFIGS[type];
}

/**
 * Get all service types
 */
export function getAllServiceTypes(): ServiceType[] {
    return Object.values(ServiceType);
}
