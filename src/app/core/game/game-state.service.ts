import { computed, Injectable, signal } from '@angular/core';
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
 * A full board: what the undo stack snapshots and what modes load
 */
export interface Board {
    services: PlacedService[];
    connections: Connection[];
}

/** Options for mutations that may skip the undo history (e.g. live slider drags) */
export interface MutationOptions {
    recordHistory?: boolean;
}

export const GRID_CONFIG: GridConfig = { width: 20, height: 14, cellSize: 48 };

export function createServiceId(): string {
    return `service_${crypto.randomUUID()}`;
}

export function createConnectionId(): string {
    return `conn_${crypto.randomUUID()}`;
}

/**
 * Game state management using Angular Signals.
 *
 * Holds the board shared by every mode. It does not persist anything on its own:
 * the sandbox owns its persistence, and challenges / the tutorial load their boards with `loadBoard`.
 */
@Injectable({
    providedIn: 'root',
})
export class GameStateService {
    // Grid configuration
    readonly gridConfig = signal<GridConfig>(GRID_CONFIG);

    // Placed services
    readonly services = signal<PlacedService[]>([]);

    // Connections between service ports
    readonly connections = signal<Connection[]>([]);

    // Pre-placed services that can't be moved or deleted (challenges, tutorial)
    readonly lockedServiceIds = signal<ReadonlySet<string>>(new Set());

    // While false, every board mutation is rejected (e.g. during a challenge deploy run)
    readonly editable = signal(true);

    // Selected service for inspector
    readonly selectedServiceId = signal<string | null>(null);

    // Selected connection for deletion
    readonly selectedConnectionId = signal<string | null>(null);

    // Currently dragged service type (for placement preview)
    readonly draggingType = signal<ServiceType | null>(null);

    // True when placement was started by keyboard activation in the palette.
    readonly keyboardPlacementActive = signal(false);

    // Undo/Redo stacks
    private readonly undoStack = signal<Board[]>([]);
    private readonly redoStack = signal<Board[]>([]);
    private readonly pendingFilterEdits = new Map<string, Board>();
    readonly canUndo = computed(() => this.editable() && this.undoStack().length > 0);
    readonly canRedo = computed(() => this.editable() && this.redoStack().length > 0);

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
     * Replace the whole board without recording history. Used by every mode when it starts,
     * so undo can never walk back into another mode's board or remove pre-placed services.
     */
    loadBoard(board: Board, lockedServiceIds: Iterable<string> = []): void {
        this.services.set(board.services);
        this.connections.set(board.connections);
        this.lockedServiceIds.set(new Set(lockedServiceIds));
        this.selectedServiceId.set(null);
        this.selectedConnectionId.set(null);
        this.draggingType.set(null);
        this.keyboardPlacementActive.set(false);
        this.editable.set(true);
        this.resetHistory();
    }

    /** Empty the board and forget its history (used when leaving a mode) */
    reset(): void {
        this.loadBoard({ services: [], connections: [] });
    }

    resetHistory(): void {
        this.undoStack.set([]);
        this.redoStack.set([]);
        this.pendingFilterEdits.clear();
    }

    isLocked(serviceId: string): boolean {
        return this.lockedServiceIds().has(serviceId);
    }

    /** How many services of this type the player placed (pre-placed, locked ones don't count) */
    placedByPlayer(type: ServiceType): number {
        const locked = this.lockedServiceIds();
        return this.services().filter((s) => s.type === type && !locked.has(s.id)).length;
    }

    /**
     * Add a service to the grid
     */
    addService(type: ServiceType, gridX: number, gridY: number): PlacedService | null {
        if (!this.editable() || !this.canPlaceService(type, gridX, gridY)) {
            return null;
        }
        this.pushSnapshot();

        const service: PlacedService = { id: createServiceId(), type, gridX, gridY };

        this.services.update((services) => [...services, service]);
        return service;
    }

    /**
     * Remove a service from the grid (also removes its connections). Locked services are ignored.
     */
    removeService(id: string): void {
        if (!this.editable() || this.isLocked(id)) return;
        if (!this.services().some((s) => s.id === id)) return;
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
        return canPlaceOnBoard(this.services(), this.gridConfig(), type, gridX, gridY, excludeId);
    }

    /**
     * Move a service to a new grid position. Locked services can't move.
     */
    moveService(id: string, gridX: number, gridY: number): boolean {
        if (!this.editable() || this.isLocked(id)) return false;
        const service = this.services().find((s) => s.id === id);
        if (!service) return false;
        if (service.gridX === gridX && service.gridY === gridY) return false;
        if (!this.canPlaceServiceExcluding(service.type, gridX, gridY, id)) return false;
        this.pushSnapshot();

        this.services.update((services) => services.map((s) => (s.id === id ? { ...s, gridX, gridY } : s)));
        return true;
    }

    /**
     * Add a connection between two ports
     */
    addConnection(source: PortRef, target: PortRef): Connection | null {
        if (!this.editable() || !this.canConnect(source, target)) {
            return null;
        }
        this.pushSnapshot();

        const connection: Connection = { id: createConnectionId(), source, target };

        this.connections.update((conns) => [...conns, connection]);
        return connection;
    }

    /**
     * Update a connection's routing filter. Pass `recordHistory: false` for intermediate
     * values of a continuous gesture (slider drag) so one gesture produces one undo entry.
     */
    updateConnectionFilter(id: string, filter: ConnectionFilter, options: MutationOptions = {}): void {
        if (!this.editable()) return;
        const current = this.connections().find((c) => c.id === id);
        if (!current) return;
        if (current.filter?.weight === filter.weight && sameMethods(current.filter?.methods ?? [], filter.methods))
            return;
        if (options.recordHistory ?? true) this.pushSnapshot();
        this.connections.update((conns) => conns.map((c) => (c.id === id ? { ...c, filter } : c)));
    }

    /** Capture the board at the start of one continuous route-weight gesture. */
    beginConnectionFilterEdit(id: string): void {
        if (!this.editable() || !this.connections().some((c) => c.id === id)) return;
        if (!this.pendingFilterEdits.has(id)) this.pendingFilterEdits.set(id, this.snapshot());
    }

    /** Commit all live slider values as one undoable action. */
    commitConnectionFilterEdit(id: string): void {
        const before = this.pendingFilterEdits.get(id);
        this.pendingFilterEdits.delete(id);
        if (!before || !this.editable() || sameBoard(before, this.snapshot())) return;
        this.pushSnapshot(before);
    }

    /**
     * Remove a connection
     */
    removeConnection(id: string): void {
        if (!this.editable()) return;
        if (!this.connections().some((c) => c.id === id)) return;
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
        return canConnectOnBoard(this.services(), this.connections(), source, target);
    }

    /**
     * Select a service
     */
    selectService(id: string | null): void {
        this.selectedServiceId.set(id);
    }

    /**
     * Clear every unlocked service and all connections (records history, so it can be undone)
     */
    clearAll(): void {
        if (!this.editable()) return;
        this.pushSnapshot();
        const locked = this.lockedServiceIds();
        this.services.update((services) => services.filter((s) => locked.has(s.id)));
        this.connections.set([]);
        this.selectedServiceId.set(null);
        this.selectedConnectionId.set(null);
    }

    /**
     * Undo the last action
     */
    undo(): void {
        if (!this.canUndo()) return;
        const stack = this.undoStack();
        const snapshot = stack[stack.length - 1];
        if (!snapshot) return;
        this.undoStack.update((s) => s.slice(0, -1));
        this.redoStack.update((s) => [...s, this.snapshot()]);
        this.restore(snapshot);
    }

    /**
     * Redo the last undone action
     */
    redo(): void {
        if (!this.canRedo()) return;
        const stack = this.redoStack();
        const snapshot = stack[stack.length - 1];
        if (!snapshot) return;
        this.redoStack.update((s) => s.slice(0, -1));
        this.undoStack.update((s) => [...s, this.snapshot()]);
        this.restore(snapshot);
    }

    private snapshot(): Board {
        return { services: this.services(), connections: this.connections() };
    }

    private restore(board: Board): void {
        this.services.set(board.services);
        this.connections.set(board.connections);
        const ids = new Set(board.services.map((s) => s.id));
        const selected = this.selectedServiceId();
        if (selected && !ids.has(selected)) this.selectedServiceId.set(null);
        const selectedConn = this.selectedConnectionId();
        if (selectedConn && !board.connections.some((c) => c.id === selectedConn)) {
            this.selectedConnectionId.set(null);
        }
    }

    private pushSnapshot(snapshot: Board = this.snapshot()): void {
        this.undoStack.update((stack) => [...stack.slice(-(MAX_UNDO_STACK - 1)), snapshot]);
        this.redoStack.set([]);
    }
}

function sameMethods(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((method) => right.includes(method));
}

function sameBoard(left: Board, right: Board): boolean {
    if (left.services !== right.services && JSON.stringify(left.services) !== JSON.stringify(right.services))
        return false;
    return JSON.stringify(left.connections) === JSON.stringify(right.connections);
}

// ── Pure board rules (shared with persistence validation) ─────────────

export function canPlaceOnBoard(
    services: PlacedService[],
    grid: GridConfig,
    type: ServiceType,
    gridX: number,
    gridY: number,
    excludeId: string | null = null,
): boolean {
    const config = getServiceConfig(type);
    if (!config) return false;
    if (!Number.isInteger(gridX) || !Number.isInteger(gridY)) return false;

    // Check bounds
    if (gridX < 0 || gridY < 0) return false;
    if (gridX + config.gridWidth > grid.width) return false;
    if (gridY + config.gridHeight > grid.height) return false;

    // Check for collisions (axis-aligned rectangle overlap)
    return !services.some((service) => {
        if (service.id === excludeId) return false;
        const other = getServiceConfig(service.type);
        return (
            gridX < service.gridX + other.gridWidth &&
            service.gridX < gridX + config.gridWidth &&
            gridY < service.gridY + other.gridHeight &&
            service.gridY < gridY + config.gridHeight
        );
    });
}

export function canConnectOnBoard(
    services: PlacedService[],
    connections: Connection[],
    source: PortRef,
    target: PortRef,
): boolean {
    // No self-connections
    if (source.serviceId === target.serviceId) return false;

    const srcService = services.find((s) => s.id === source.serviceId);
    const tgtService = services.find((s) => s.id === target.serviceId);
    if (!srcService || !tgtService) return false;

    const srcPort = getServiceConfig(srcService.type).ports[source.portIndex];
    const tgtPort = getServiceConfig(tgtService.type).ports[target.portIndex];
    if (!srcPort || !tgtPort) return false;

    // Source must be OUTPUT or BIDIRECTIONAL
    if (srcPort.direction === PortDirection.INPUT) return false;
    // Target must be INPUT or BIDIRECTIONAL
    if (tgtPort.direction === PortDirection.OUTPUT) return false;

    // No duplicate connections
    return !connections.some(
        (c) =>
            c.source.serviceId === source.serviceId &&
            c.source.portIndex === source.portIndex &&
            c.target.serviceId === target.serviceId &&
            c.target.portIndex === target.portIndex,
    );
}

export function isServiceType(value: unknown): value is ServiceType {
    return typeof value === 'string' && (Object.values(ServiceType) as string[]).includes(value);
}
