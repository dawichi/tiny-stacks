import * as THREE from "three";
import { getServiceConfig, PortConfig, PortDirection, ServiceType, ServiceTypeConfig } from "./service-types.config";

/**
 * Factory for creating 3D service meshes
 */
export class ServiceMeshFactory {
    private static readonly CELL_SIZE = 1;
    private static readonly PORT_RADIUS = 0.12;
    private static readonly PORT_HEIGHT = 0.15;

    /**
     * Create a 3D mesh group for a service
     */
    static createServiceMesh(
        type: ServiceType,
        gridX: number,
        gridZ: number,
        gridWidth: number = 20,
        gridHeight: number = 20,
    ): THREE.Group {
        const config = getServiceConfig(type);
        const group = new THREE.Group();
        group.name = `service_${type}_${Date.now()}`;

        // Create the main body
        const body = ServiceMeshFactory.createBody(config);
        group.add(body);

        // Create connection ports
        config.ports.forEach((port, index) => {
            const portMesh = ServiceMeshFactory.createPort(port, config);
            portMesh.name = `port_${index}`;
            group.add(portMesh);
        });

        // Position the group on the grid
        const worldPos = ServiceMeshFactory.gridToWorld(gridX, gridZ, config, gridWidth, gridHeight);
        group.position.set(worldPos.x, 0, worldPos.z);

        // Store metadata on the group
        group.userData = {
            serviceType: type,
            gridX,
            gridZ,
            config,
        };

        return group;
    }

    /**
     * Create the main body mesh with rounded edges
     */
    private static createBody(config: ServiceTypeConfig): THREE.Mesh {
        const width = config.gridWidth * ServiceMeshFactory.CELL_SIZE;
        const depth = config.gridHeight * ServiceMeshFactory.CELL_SIZE;
        const height = config.meshHeight;

        // Create geometry with subdivisions for rounding
        const geometry = new THREE.BoxGeometry(
            width - 0.1, // Slightly smaller than grid for visual gap
            height,
            depth - 0.1,
            4,
            4,
            4,
        );

        // Apply rounded corners
        ServiceMeshFactory.applyRoundedEdges(geometry, 0.08);

        // Create clay-like material
        const material = new THREE.MeshPhysicalMaterial({
            color: config.color,
            roughness: 0.4,
            metalness: 0.0,
            clearcoat: 0.2,
            clearcoatRoughness: 0.8,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = height / 2; // Sit on ground
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = "body";

        return mesh;
    }

    /**
     * Create a connection port indicator
     */
    private static createPort(port: PortConfig, config: ServiceTypeConfig): THREE.Group {
        const portGroup = new THREE.Group();

        // Port cylinder
        const geometry = new THREE.CylinderGeometry(
            ServiceMeshFactory.PORT_RADIUS,
            ServiceMeshFactory.PORT_RADIUS,
            ServiceMeshFactory.PORT_HEIGHT,
            16,
        );

        // Color based on direction
        let color: number;
        switch (port.direction) {
            case PortDirection.INPUT:
                color = 0x4caf50; // Green for input
                break;
            case PortDirection.OUTPUT:
                color = 0x2196f3; // Blue for output
                break;
            case PortDirection.BIDIRECTIONAL:
                color = 0xff9800; // Orange for bidirectional
                break;
        }

        const material = new THREE.MeshPhysicalMaterial({
            color,
            roughness: 0.3,
            metalness: 0.1,
            emissive: color,
            emissiveIntensity: 0.2,
        });

        const cylinder = new THREE.Mesh(geometry, material);
        cylinder.castShadow = true;

        // Position based on edge
        const cellX =
            (port.cellOffsetX + 0.5) * ServiceMeshFactory.CELL_SIZE -
            (config.gridWidth * ServiceMeshFactory.CELL_SIZE) / 2;
        const cellZ =
            (port.cellOffsetZ + 0.5) * ServiceMeshFactory.CELL_SIZE -
            (config.gridHeight * ServiceMeshFactory.CELL_SIZE) / 2;
        const edgeOffset = 0.45; // How far from center to edge

        let x = cellX;
        let z = cellZ;
        let rotationZ = 0;

        switch (port.edge) {
            case "north":
                z = cellZ - edgeOffset;
                rotationZ = 0;
                break;
            case "south":
                z = cellZ + edgeOffset;
                rotationZ = 0;
                break;
            case "east":
                x = cellX + edgeOffset;
                rotationZ = Math.PI / 2;
                break;
            case "west":
                x = cellX - edgeOffset;
                rotationZ = Math.PI / 2;
                break;
        }

        cylinder.rotation.z = rotationZ;
        cylinder.position.set(x, config.meshHeight * 0.5, z);

        portGroup.add(cylinder);

        // Add a small glow ring around the port
        const ringGeometry = new THREE.RingGeometry(
            ServiceMeshFactory.PORT_RADIUS + 0.02,
            ServiceMeshFactory.PORT_RADIUS + 0.06,
            16,
        );
        const ringMaterial = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, config.meshHeight * 0.5 + ServiceMeshFactory.PORT_HEIGHT / 2 + 0.01, z);

        // Rotate ring based on edge
        if (port.edge === "east" || port.edge === "west") {
            ring.rotation.x = 0;
            ring.rotation.y = Math.PI / 2;
        }

        portGroup.add(ring);

        return portGroup;
    }

    /**
     * Apply rounded edges to box geometry
     */
    private static applyRoundedEdges(geometry: THREE.BoxGeometry, radius: number): void {
        const positions = geometry.attributes["position"];
        const vertex = new THREE.Vector3();

        // Get the half-sizes from the geometry
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const halfX = (box.max.x - box.min.x) / 2;
        const halfY = (box.max.y - box.min.y) / 2;
        const halfZ = (box.max.z - box.min.z) / 2;

        for (let i = 0; i < positions.count; i++) {
            vertex.fromBufferAttribute(positions, i);

            const absX = Math.abs(vertex.x);
            const absY = Math.abs(vertex.y);
            const absZ = Math.abs(vertex.z);

            // Check if this vertex is near a corner
            const nearX = absX > halfX - radius;
            const nearY = absY > halfY - radius;
            const nearZ = absZ > halfZ - radius;

            if ((nearX && nearY) || (nearY && nearZ) || (nearX && nearZ)) {
                // Move corner vertices slightly inward for a beveled look
                const factor = 0.9;
                if (nearX) vertex.x *= factor;
                if (nearY) vertex.y *= factor;
                if (nearZ) vertex.z *= factor;
                positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
            }
        }

        geometry.attributes["position"].needsUpdate = true;
        geometry.computeVertexNormals();
    }

    /**
     * Convert grid coordinates to world position for a service
     */
    static gridToWorld(
        gridX: number,
        gridZ: number,
        config: ServiceTypeConfig,
        gridWidth: number,
        gridHeight: number,
    ): { x: number; z: number } {
        const halfGridWidth = (gridWidth * ServiceMeshFactory.CELL_SIZE) / 2;
        const halfGridHeight = (gridHeight * ServiceMeshFactory.CELL_SIZE) / 2;

        // Center of the service footprint
        const worldX =
            -halfGridWidth +
            gridX * ServiceMeshFactory.CELL_SIZE +
            (config.gridWidth * ServiceMeshFactory.CELL_SIZE) / 2;
        const worldZ =
            -halfGridHeight +
            gridZ * ServiceMeshFactory.CELL_SIZE +
            (config.gridHeight * ServiceMeshFactory.CELL_SIZE) / 2;

        return { x: worldX, z: worldZ };
    }

    /**
     * Get the cells occupied by a service at a grid position
     */
    static getOccupiedCells(gridX: number, gridZ: number, type: ServiceType): Array<{ gridX: number; gridZ: number }> {
        const config = getServiceConfig(type);
        const cells: Array<{ gridX: number; gridZ: number }> = [];

        for (let dx = 0; dx < config.gridWidth; dx++) {
            for (let dz = 0; dz < config.gridHeight; dz++) {
                cells.push({ gridX: gridX + dx, gridZ: gridZ + dz });
            }
        }

        return cells;
    }

    /**
     * Check if a service placement is valid (within bounds)
     */
    static isValidPlacement(
        gridX: number,
        gridZ: number,
        type: ServiceType,
        gridWidth: number,
        gridHeight: number,
    ): boolean {
        const config = getServiceConfig(type);

        // Check if the service fits within the grid
        if (gridX < 0 || gridZ < 0) return false;
        if (gridX + config.gridWidth > gridWidth) return false;
        if (gridZ + config.gridHeight > gridHeight) return false;

        return true;
    }
}
