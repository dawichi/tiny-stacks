import { computed, effect, Injectable, signal } from '@angular/core';
import { getServiceConfig, PortDirection, ServiceType } from './service-types.config';

const STORAGE_KEY = 'tiny-stacks-state';

/**
 * Represents a placed service on the grid
 */
export interface PlacedService {
    id: string;
    type: ServiceType;
    gridX: number;
    gridY: number;
}

/**
 * Grid configuration
 */
export interface GridConfig {
    width: number;
    height: number;
    cellSize: number; // in pixels
}

/**
 * Reference to a specific port on a specific service
 */
export interface PortRef {
    serviceId: string;
    portIndex: number;
}

/**
 * A connection between two service ports
 */
export interface Connection {
    id: string;
    source: PortRef;
    target: PortRef;
}

/**
 * Game state management using Angular Signals
 */
@Injectable({
    providedIn: 'root',
})
export class GameStateService {
    constructor() {
        this.loadState();

        // Auto-save when services or connections change
        effect(() => {
            const services = this.services();
            const connections = this.connections();
            this.saveState(services, connections);
        });
    }

    // Grid configuration
    readonly gridConfig = signal<GridConfig>({
        width: 20,
        height: 14,
        cellSize: 48,
    });

    // Placed services
    readonly services = signal<PlacedService[]>([]);

    // Connections between service ports
    readonly connections = signal<Connection[]>([]);

    // Selected service for inspector
    readonly selectedServiceId = signal<string | null>(null);

    // Selected connection for deletion
    readonly selectedConnectionId = signal<string | null>(null);

    // Currently dragged service type (for placement preview)
    readonly draggingType = signal<ServiceType | null>(null);

    // Derived: get selected service
    readonly selectedService = computed(() => {
        const id = this.selectedServiceId();
        if (!id) return null;
        return this.services().find((s) => s.id === id) ?? null;
    });

    // Derived: occupied cells (for collision detection)
    readonly occupiedCells = computed(() => {
        const cells = new Set<string>();
        for (const service of this.services()) {
            const config = getServiceConfig(service.type);
            for (let dx = 0; dx < config.gridWidth; dx++) {
                for (let dy = 0; dy < config.gridHeight; dy++) {
                    cells.add(`${service.gridX + dx},${service.gridY + dy}`);
                }
            }
        }
        return cells;
    });

    /**
     * Add a service to the grid
     */
    addService(type: ServiceType, gridX: number, gridY: number): PlacedService | null {
        if (!this.canPlaceService(type, gridX, gridY)) {
            return null;
        }

        const service: PlacedService = {
            id: `service_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            type,
            gridX,
            gridY,
        };

        this.services.update((services) => [...services, service]);
        return service;
    }

    /**
     * Remove a service from the grid (also removes its connections)
     */
    removeService(id: string): void {
        this.services.update((services) => services.filter((s) => s.id !== id));
        this.connections.update((conns) => conns.filter((c) => c.source.serviceId !== id && c.target.serviceId !== id));
        if (this.selectedServiceId() === id) {
            this.selectedServiceId.set(null);
        }
    }

    /**
     * Check if a service can be placed at a position
     */
    canPlaceService(type: ServiceType, gridX: number, gridY: number): boolean {
        const config = getServiceConfig(type);
        const grid = this.gridConfig();

        // Check bounds
        if (gridX < 0 || gridY < 0) return false;
        if (gridX + config.gridWidth > grid.width) return false;
        if (gridY + config.gridHeight > grid.height) return false;

        // Check for collisions
        const occupied = this.occupiedCells();
        for (let dx = 0; dx < config.gridWidth; dx++) {
            for (let dy = 0; dy < config.gridHeight; dy++) {
                if (occupied.has(`${gridX + dx},${gridY + dy}`)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Add a connection between two ports
     */
    addConnection(source: PortRef, target: PortRef): Connection | null {
        if (!this.canConnect(source, target)) {
            return null;
        }

        const connection: Connection = {
            id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            source,
            target,
        };

        this.connections.update((conns) => [...conns, connection]);
        return connection;
    }

    /**
     * Remove a connection
     */
    removeConnection(id: string): void {
        this.connections.update((conns) => conns.filter((c) => c.id !== id));
        if (this.selectedConnectionId() === id) {
            this.selectedConnectionId.set(null);
        }
    }

    /**
     * Check if a connection between two ports is valid
     */
    canConnect(source: PortRef, target: PortRef): boolean {
        // No self-connections
        if (source.serviceId === target.serviceId) return false;

        const srcService = this.services().find((s) => s.id === source.serviceId);
        const tgtService = this.services().find((s) => s.id === target.serviceId);
        if (!srcService || !tgtService) return false;

        const srcConfig = getServiceConfig(srcService.type);
        const tgtConfig = getServiceConfig(tgtService.type);
        const srcPort = srcConfig.ports[source.portIndex];
        const tgtPort = tgtConfig.ports[target.portIndex];
        if (!srcPort || !tgtPort) return false;

        // Source must be OUTPUT or BIDIRECTIONAL
        if (srcPort.direction === PortDirection.INPUT) return false;
        // Target must be INPUT or BIDIRECTIONAL
        if (tgtPort.direction === PortDirection.OUTPUT) return false;

        // No duplicate connections
        const exists = this.connections().some(
            (c) =>
                c.source.serviceId === source.serviceId &&
                c.source.portIndex === source.portIndex &&
                c.target.serviceId === target.serviceId &&
                c.target.portIndex === target.portIndex,
        );
        if (exists) return false;

        return true;
    }

    /**
     * Select a service
     */
    selectService(id: string | null): void {
        this.selectedServiceId.set(id);
    }

    /**
     * Clear all services and connections
     */
    clearAll(): void {
        this.services.set([]);
        this.connections.set([]);
        this.selectedServiceId.set(null);
        this.selectedConnectionId.set(null);
    }

    /**
     * Add demo services for initial display
     */
    addDemoServices(): void {
        this.addService(ServiceType.API_GATEWAY, 8, 1);
        this.addService(ServiceType.REST_SERVICE, 5, 5);
        this.addService(ServiceType.CACHE, 10, 5);
        this.addService(ServiceType.DATABASE, 8, 9);
        this.addService(ServiceType.MESSAGE_QUEUE, 2, 4);
        this.addService(ServiceType.LOAD_BALANCER, 14, 5);
    }

    /**
     * Save current state to LocalStorage
     */
    private saveState(services: PlacedService[], connections: Connection[]): void {
        try {
            const state = JSON.stringify({ services, connections });
            localStorage.setItem(STORAGE_KEY, state);
        } catch {
            // Silently fail if storage is unavailable
        }
    }

    /**
     * Load state from LocalStorage
     */
    private loadState(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;

            const state = JSON.parse(raw) as { services?: PlacedService[]; connections?: Connection[] };
            if (Array.isArray(state.services)) {
                this.services.set(state.services);
            }
            if (Array.isArray(state.connections)) {
                this.connections.set(state.connections);
            }
        } catch {
            // Silently fail if data is corrupted
        }
    }
}
