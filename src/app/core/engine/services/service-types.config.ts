/**
 * Service type identifiers
 */
export enum ServiceType {
    API_GATEWAY = "api_gateway",
    REST_SERVICE = "rest_service",
    DATABASE = "database",
    CACHE = "cache",
    MESSAGE_QUEUE = "message_queue",
    LOAD_BALANCER = "load_balancer",
}

/**
 * Port direction for connections
 */
export enum PortDirection {
    INPUT = "input",
    OUTPUT = "output",
    BIDIRECTIONAL = "bidirectional",
}

/**
 * Port configuration for a service
 */
export interface PortConfig {
    /** Relative position within the service footprint (0-based) */
    cellOffsetX: number;
    cellOffsetZ: number;
    /** Which edge of the cell the port is on */
    edge: "north" | "south" | "east" | "west";
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
    /** Grid footprint size */
    gridWidth: number;
    gridHeight: number;
    /** Visual properties */
    color: number;
    /** Height of the mesh (in world units) */
    meshHeight: number;
    /** Connection ports */
    ports: PortConfig[];
    /** Simulation properties */
    baseProcessingTime: number; // ms per request
    maxConcurrency: number; // max simultaneous requests
    queueSize: number; // max queued requests
}

/**
 * All service type configurations
 */
export const SERVICE_CONFIGS: Record<ServiceType, ServiceTypeConfig> = {
    [ServiceType.API_GATEWAY]: {
        type: ServiceType.API_GATEWAY,
        name: "API Gateway",
        description: "Entry point for all requests. Routes traffic to appropriate services.",
        gridWidth: 3,
        gridHeight: 2,
        color: 0x88d8d8, // Soft Teal
        meshHeight: 1.2,
        ports: [
            { cellOffsetX: 0, cellOffsetZ: 0, edge: "west", direction: PortDirection.INPUT },
            { cellOffsetX: 2, cellOffsetZ: 1, edge: "east", direction: PortDirection.OUTPUT },
        ],
        baseProcessingTime: 10,
        maxConcurrency: 100,
        queueSize: 500,
    },

    [ServiceType.REST_SERVICE]: {
        type: ServiceType.REST_SERVICE,
        name: "REST Service",
        description: "Processes business logic. Handles API requests.",
        gridWidth: 2,
        gridHeight: 2,
        color: 0x87ceeb, // Sky Blue
        meshHeight: 1.0,
        ports: [
            { cellOffsetX: 0, cellOffsetZ: 0, edge: "west", direction: PortDirection.INPUT },
            { cellOffsetX: 1, cellOffsetZ: 1, edge: "east", direction: PortDirection.OUTPUT },
        ],
        baseProcessingTime: 50,
        maxConcurrency: 20,
        queueSize: 100,
    },

    [ServiceType.DATABASE]: {
        type: ServiceType.DATABASE,
        name: "Database",
        description: "Persistent data storage. Slower but reliable.",
        gridWidth: 3,
        gridHeight: 3,
        color: 0xd4a5ff, // Lavender
        meshHeight: 1.5,
        ports: [{ cellOffsetX: 1, cellOffsetZ: 0, edge: "north", direction: PortDirection.BIDIRECTIONAL }],
        baseProcessingTime: 100,
        maxConcurrency: 10,
        queueSize: 50,
    },

    [ServiceType.CACHE]: {
        type: ServiceType.CACHE,
        name: "Cache",
        description: "Fast in-memory storage. Limited capacity.",
        gridWidth: 2,
        gridHeight: 1,
        color: 0xa8e6cf, // Mint
        meshHeight: 0.8,
        ports: [{ cellOffsetX: 0, cellOffsetZ: 0, edge: "west", direction: PortDirection.BIDIRECTIONAL }],
        baseProcessingTime: 5,
        maxConcurrency: 50,
        queueSize: 200,
    },

    [ServiceType.MESSAGE_QUEUE]: {
        type: ServiceType.MESSAGE_QUEUE,
        name: "Message Queue",
        description: "Async processing buffer. Handles bursts of traffic.",
        gridWidth: 2,
        gridHeight: 3,
        color: 0xffcba4, // Peach
        meshHeight: 1.3,
        ports: [
            { cellOffsetX: 0, cellOffsetZ: 0, edge: "north", direction: PortDirection.INPUT },
            { cellOffsetX: 1, cellOffsetZ: 2, edge: "south", direction: PortDirection.OUTPUT },
        ],
        baseProcessingTime: 20,
        maxConcurrency: 1,
        queueSize: 1000,
    },

    [ServiceType.LOAD_BALANCER]: {
        type: ServiceType.LOAD_BALANCER,
        name: "Load Balancer",
        description: "Distributes requests across multiple services.",
        gridWidth: 2,
        gridHeight: 2,
        color: 0xffe5a0, // Soft Gold
        meshHeight: 1.0,
        ports: [
            { cellOffsetX: 0, cellOffsetZ: 0, edge: "west", direction: PortDirection.INPUT },
            { cellOffsetX: 1, cellOffsetZ: 0, edge: "east", direction: PortDirection.OUTPUT },
            { cellOffsetX: 1, cellOffsetZ: 1, edge: "east", direction: PortDirection.OUTPUT },
        ],
        baseProcessingTime: 2,
        maxConcurrency: 200,
        queueSize: 100,
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
