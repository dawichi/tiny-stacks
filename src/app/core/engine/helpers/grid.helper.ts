import * as THREE from "three";

export interface GridConfig {
    width: number;
    height: number;
    cellSize: number;
    lineColor: number;
    lineOpacity: number;
    highlightValidColor: number;
    highlightInvalidColor: number;
}

const DEFAULT_CONFIG: GridConfig = {
    width: 20,
    height: 20,
    cellSize: 1,
    lineColor: 0x708090, // Slate gray
    lineOpacity: 0.15, // Very subtle
    highlightValidColor: 0xa8e6cf, // Mint green
    highlightInvalidColor: 0xff8b8b, // Coral red
};

/**
 * Creates and manages an isometric grid for the game world
 */
export class GridHelper {
    private gridLines: THREE.LineSegments;
    private highlightMesh: THREE.Mesh | null = null;
    private config: GridConfig;
    private scene: THREE.Scene;

    constructor(scene: THREE.Scene, config: Partial<GridConfig> = {}) {
        this.scene = scene;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.gridLines = this.createGridLines();
        this.scene.add(this.gridLines);
    }

    /**
     * Create the grid lines geometry
     */
    private createGridLines(): THREE.LineSegments {
        const { width, height, cellSize } = this.config;
        const halfWidth = (width * cellSize) / 2;
        const halfHeight = (height * cellSize) / 2;

        const points: THREE.Vector3[] = [];

        // Vertical lines (along Z axis)
        for (let i = 0; i <= width; i++) {
            const x = -halfWidth + i * cellSize;
            points.push(new THREE.Vector3(x, 0.01, -halfHeight));
            points.push(new THREE.Vector3(x, 0.01, halfHeight));
        }

        // Horizontal lines (along X axis)
        for (let i = 0; i <= height; i++) {
            const z = -halfHeight + i * cellSize;
            points.push(new THREE.Vector3(-halfWidth, 0.01, z));
            points.push(new THREE.Vector3(halfWidth, 0.01, z));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: this.config.lineColor,
            transparent: true,
            opacity: this.config.lineOpacity,
        });

        const lines = new THREE.LineSegments(geometry, material);
        lines.name = "gridLines";
        return lines;
    }

    /**
     * Highlight a cell at the given grid coordinates
     * @param gridX Grid X coordinate (0 to width-1)
     * @param gridZ Grid Z coordinate (0 to height-1)
     * @param isValid Whether the placement is valid (green) or invalid (red)
     */
    highlightCell(gridX: number, gridZ: number, isValid: boolean): void {
        this.clearHighlight();

        const { width, height, cellSize } = this.config;
        const halfWidth = (width * cellSize) / 2;
        const halfHeight = (height * cellSize) / 2;

        // Convert grid coords to world position (center of cell)
        const worldX = -halfWidth + gridX * cellSize + cellSize / 2;
        const worldZ = -halfHeight + gridZ * cellSize + cellSize / 2;

        const geometry = new THREE.PlaneGeometry(cellSize * 0.95, cellSize * 0.95);
        const material = new THREE.MeshBasicMaterial({
            color: isValid ? this.config.highlightValidColor : this.config.highlightInvalidColor,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
        });

        this.highlightMesh = new THREE.Mesh(geometry, material);
        this.highlightMesh.rotation.x = -Math.PI / 2;
        this.highlightMesh.position.set(worldX, 0.02, worldZ);
        this.highlightMesh.name = "gridHighlight";
        this.scene.add(this.highlightMesh);
    }

    /**
     * Highlight multiple cells (for multi-cell services)
     * @param cells Array of {gridX, gridZ} coordinates
     * @param isValid Whether all placements are valid
     */
    highlightCells(cells: Array<{ gridX: number; gridZ: number }>, isValid: boolean): void {
        this.clearHighlight();

        const { width, height, cellSize } = this.config;
        const halfWidth = (width * cellSize) / 2;
        const halfHeight = (height * cellSize) / 2;

        const group = new THREE.Group();
        group.name = "gridHighlight";

        cells.forEach(({ gridX, gridZ }) => {
            const worldX = -halfWidth + gridX * cellSize + cellSize / 2;
            const worldZ = -halfHeight + gridZ * cellSize + cellSize / 2;

            const geometry = new THREE.PlaneGeometry(cellSize * 0.95, cellSize * 0.95);
            const material = new THREE.MeshBasicMaterial({
                color: isValid ? this.config.highlightValidColor : this.config.highlightInvalidColor,
                transparent: true,
                opacity: 0.4,
                side: THREE.DoubleSide,
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(worldX, 0.02, worldZ);
            group.add(mesh);
        });

        this.scene.add(group);
        this.highlightMesh = group as unknown as THREE.Mesh;
    }

    /**
     * Clear the current cell highlight
     */
    clearHighlight(): void {
        if (this.highlightMesh) {
            this.scene.remove(this.highlightMesh);
            if (this.highlightMesh instanceof THREE.Group) {
                this.highlightMesh.children.forEach((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                        (child.material as THREE.Material).dispose();
                    }
                });
            } else {
                this.highlightMesh.geometry.dispose();
                (this.highlightMesh.material as THREE.Material).dispose();
            }
            this.highlightMesh = null;
        }
    }

    /**
     * Convert world coordinates to grid coordinates
     */
    worldToGrid(worldX: number, worldZ: number): { gridX: number; gridZ: number } | null {
        const { width, height, cellSize } = this.config;
        const halfWidth = (width * cellSize) / 2;
        const halfHeight = (height * cellSize) / 2;

        const gridX = Math.floor((worldX + halfWidth) / cellSize);
        const gridZ = Math.floor((worldZ + halfHeight) / cellSize);

        // Check bounds
        if (gridX < 0 || gridX >= width || gridZ < 0 || gridZ >= height) {
            return null;
        }

        return { gridX, gridZ };
    }

    /**
     * Convert grid coordinates to world coordinates (center of cell)
     */
    gridToWorld(gridX: number, gridZ: number): { worldX: number; worldZ: number } {
        const { width, height, cellSize } = this.config;
        const halfWidth = (width * cellSize) / 2;
        const halfHeight = (height * cellSize) / 2;

        return {
            worldX: -halfWidth + gridX * cellSize + cellSize / 2,
            worldZ: -halfHeight + gridZ * cellSize + cellSize / 2,
        };
    }

    /**
     * Check if grid coordinates are within bounds
     */
    isInBounds(gridX: number, gridZ: number): boolean {
        return gridX >= 0 && gridX < this.config.width && gridZ >= 0 && gridZ < this.config.height;
    }

    /**
     * Set grid line visibility (for emphasizing during drag)
     */
    setLineOpacity(opacity: number): void {
        const material = this.gridLines.material as THREE.LineBasicMaterial;
        material.opacity = opacity;
    }

    /**
     * Get grid dimensions
     */
    getDimensions(): { width: number; height: number; cellSize: number } {
        return {
            width: this.config.width,
            height: this.config.height,
            cellSize: this.config.cellSize,
        };
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.clearHighlight();
        this.scene.remove(this.gridLines);
        this.gridLines.geometry.dispose();
        (this.gridLines.material as THREE.Material).dispose();
    }
}
