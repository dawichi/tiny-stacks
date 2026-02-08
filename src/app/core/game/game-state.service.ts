import { computed, Injectable, signal } from '@angular/core';
import { getServiceConfig, ServiceType } from './service-types.config';

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
 * Game state management using Angular Signals
 */
@Injectable({
    providedIn: 'root',
})
export class GameStateService {
    // Grid configuration
    readonly gridConfig = signal<GridConfig>({
        width: 20,
        height: 14,
        cellSize: 48,
    });

    // Placed services
    readonly services = signal<PlacedService[]>([]);

    // Selected service for inspector
    readonly selectedServiceId = signal<string | null>(null);

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
     * Remove a service from the grid
     */
    removeService(id: string): void {
        this.services.update((services) => services.filter((s) => s.id !== id));
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
     * Select a service
     */
    selectService(id: string | null): void {
        this.selectedServiceId.set(id);
    }

    /**
     * Clear all services
     */
    clearAll(): void {
        this.services.set([]);
        this.selectedServiceId.set(null);
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
}
