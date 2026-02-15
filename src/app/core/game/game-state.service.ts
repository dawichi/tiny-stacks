import { computed, effect, Injectable, inject, signal } from '@angular/core';
import { StorageKeys, StorageService } from '../storage/storage.service';
import { getServiceConfig, PortDirection, ServiceType } from './service-types.config';
import type { ConnectionFilter } from './sim-types';

const MAX_UNDO_STACK = 50;

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
    filter?: ConnectionFilter;
}

/**
 * Game state management using Angular Signals
 */
@Injectable({
    providedIn: 'root',
})
export class GameStateService {
    private readonly storage = inject(StorageService);

    constructor() {
        this.loadState();

        // Auto-save when services or connections change
        effect(() => {
            const services = this.services();
            const connections = this.connections();
            this.storage.setItem(StorageKeys.GAME_STATE, { services, connections });
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

    // Undo/Redo stacks
    private readonly undoStack = signal<{ services: PlacedService[]; connections: Connection[] }[]>([]);
    private readonly redoStack = signal<{ services: PlacedService[]; connections: Connection[] }[]>([]);
    readonly canUndo = computed(() => this.undoStack().length > 0);
    readonly canRedo = computed(() => this.redoStack().length > 0);

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
        this.pushSnapshot();

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
        this.pushSnapshot();
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
        return this.canPlaceServiceExcluding(type, gridX, gridY, null);
    }

    /**
     * Check if a service can be placed at a position, optionally excluding a service from collision detection.
     * Used during drag-to-move so the service being moved doesn't collide with itself.
     */
    canPlaceServiceExcluding(type: ServiceType, gridX: number, gridY: number, excludeId: string | null): boolean {
        const config = getServiceConfig(type);
        const grid = this.gridConfig();

        // Check bounds
        if (gridX < 0 || gridY < 0) return false;
        if (gridX + config.gridWidth > grid.width) return false;
        if (gridY + config.gridHeight > grid.height) return false;

        // Build occupied cells, excluding the service being moved
        const occupied = new Set<string>();
        for (const service of this.services()) {
            if (service.id === excludeId) continue;
            const sConfig = getServiceConfig(service.type);
            for (let dx = 0; dx < sConfig.gridWidth; dx++) {
                for (let dy = 0; dy < sConfig.gridHeight; dy++) {
                    occupied.add(`${service.gridX + dx},${service.gridY + dy}`);
                }
            }
        }

        // Check for collisions
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
     * Move a service to a new grid position
     */
    moveService(id: string, gridX: number, gridY: number): boolean {
        const service = this.services().find((s) => s.id === id);
        if (!service) return false;
        if (!this.canPlaceServiceExcluding(service.type, gridX, gridY, id)) return false;
        this.pushSnapshot();

        this.services.update((services) => services.map((s) => (s.id === id ? { ...s, gridX, gridY } : s)));
        return true;
    }

    /**
     * Add a connection between two ports
     */
    addConnection(source: PortRef, target: PortRef): Connection | null {
        if (!this.canConnect(source, target)) {
            return null;
        }
        this.pushSnapshot();

        const connection: Connection = {
            id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            source,
            target,
        };

        this.connections.update((conns) => [...conns, connection]);
        return connection;
    }

    /**
     * Update a connection's routing filter
     */
    updateConnectionFilter(id: string, filter: ConnectionFilter): void {
        this.pushSnapshot();
        this.connections.update((conns) => conns.map((c) => (c.id === id ? { ...c, filter } : c)));
    }

    /**
     * Remove a connection
     */
    removeConnection(id: string): void {
        this.pushSnapshot();
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
        this.pushSnapshot();
        this.services.set([]);
        this.connections.set([]);
        this.selectedServiceId.set(null);
        this.selectedConnectionId.set(null);
    }

    /**
     * Undo the last action
     */
    undo(): void {
        const stack = this.undoStack();
        if (stack.length === 0) return;

        const snapshot = stack[stack.length - 1];
        this.undoStack.update((s) => s.slice(0, -1));
        this.redoStack.update((s) => [...s, { services: this.services(), connections: this.connections() }]);
        this.services.set(snapshot.services);
        this.connections.set(snapshot.connections);
    }

    /**
     * Redo the last undone action
     */
    redo(): void {
        const stack = this.redoStack();
        if (stack.length === 0) return;

        const snapshot = stack[stack.length - 1];
        this.redoStack.update((s) => s.slice(0, -1));
        this.undoStack.update((s) => [...s, { services: this.services(), connections: this.connections() }]);
        this.services.set(snapshot.services);
        this.connections.set(snapshot.connections);
    }

    /**
     * Load an example architecture: Origin → Gateway → REST → Cache → Database
     * Demonstrates response paths and cache hit/miss mechanics.
     */
    loadExampleSetup(): void {
        this.clearAll();

        const origin = this.addService(ServiceType.ORIGIN, 0, 6);
        const gateway = this.addService(ServiceType.API_GATEWAY, 2, 5);
        const rest = this.addService(ServiceType.REST_SERVICE, 6, 5);
        const cache = this.addService(ServiceType.CACHE, 9, 6);
        const db = this.addService(ServiceType.DATABASE, 12, 5);

        if (!origin || !gateway || !rest || !cache || !db) return;

        // Origin(output:0) → Gateway(input:0)
        this.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: gateway.id, portIndex: 0 });
        // Gateway(output:1) → REST(input:0)
        this.addConnection({ serviceId: gateway.id, portIndex: 1 }, { serviceId: rest.id, portIndex: 0 });
        // REST(output:1) → Cache(input:0)
        this.addConnection({ serviceId: rest.id, portIndex: 1 }, { serviceId: cache.id, portIndex: 0 });
        // Cache(output:1) → Database(bidirectional:0)
        this.addConnection({ serviceId: cache.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });
    }

    /**
     * Load a stress-test architecture: 12 Origins → Gateway → Database
     * 120 req/s overwhelms the Database (100 req/s capacity), triggering queue overflow failures.
     */
    loadStressTestSetup(): void {
        this.clearAll();

        const gateway = this.addService(ServiceType.API_GATEWAY, 3, 5);
        const db = this.addService(ServiceType.DATABASE, 7, 5);

        if (!gateway || !db) return;

        // Gateway(output:1) → Database(bidirectional:0)
        this.addConnection({ serviceId: gateway.id, portIndex: 1 }, { serviceId: db.id, portIndex: 0 });

        // Stack 12 Origins in a column, all connecting to Gateway
        for (let i = 0; i < 12; i++) {
            const origin = this.addService(ServiceType.ORIGIN, 0, i + 1);
            if (!origin) continue;
            this.addConnection({ serviceId: origin.id, portIndex: 0 }, { serviceId: gateway.id, portIndex: 0 });
        }
    }

    private pushSnapshot(): void {
        const snapshot = { services: this.services(), connections: this.connections() };
        this.undoStack.update((stack) => [...stack.slice(-(MAX_UNDO_STACK - 1)), snapshot]);
        this.redoStack.set([]);
    }

    private loadState(): void {
        const state = this.storage.getItem(StorageKeys.GAME_STATE);
        if (!state) return;

        if (Array.isArray(state.services)) {
            this.services.set(state.services);
        }
        if (Array.isArray(state.connections)) {
            this.connections.set(state.connections);
        }
    }
}
