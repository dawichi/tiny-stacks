import { Injectable, NgZone, signal } from "@angular/core";
import * as THREE from "three";
import { CameraControls } from "./helpers/camera-controls.helper";
import { GridConfig, GridHelper } from "./helpers/grid.helper";
import { ServiceMeshFactory } from "./services/service-mesh.factory";
import { ServiceType } from "./services/service-types.config";

@Injectable({
    providedIn: "root",
})
export class GameEngineService {
    private scene!: THREE.Scene;
    private camera!: THREE.OrthographicCamera;
    private renderer!: THREE.WebGLRenderer;
    private animationFrameId: number | null = null;
    private gridHelper!: GridHelper;
    private cameraControls!: CameraControls;

    // Expose scene for components that need to add objects
    readonly isInitialized = signal(false);

    // Grid configuration (can be overridden for challenges)
    private gridConfig: Partial<GridConfig> = {
        width: 20,
        height: 20,
        cellSize: 1,
    };

    constructor(private ngZone: NgZone) {}

    /**
     * Initialize the Three.js engine with the given canvas container
     */
    initialize(container: HTMLElement): void {
        this.createScene();
        this.createCamera(container);
        this.createRenderer(container);
        this.createLights();
        this.createHelloWorldScene();

        // Initialize camera controls (pan + zoom)
        this.cameraControls = new CameraControls(this.camera, this.renderer.domElement);

        // Start render loop OUTSIDE Angular Zone for 60 FPS
        this.ngZone.runOutsideAngular(() => {
            this.animate();
        });

        this.isInitialized.set(true);
    }

    /**
     * Clean up resources when component is destroyed
     */
    dispose(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        this.cameraControls?.dispose();
        this.gridHelper?.dispose();
        this.renderer?.dispose();
        this.scene?.clear();
        this.isInitialized.set(false);
    }

    /**
     * Handle window resize
     */
    onResize(width: number, height: number): void {
        if (!this.camera || !this.renderer) return;

        this.renderer.setSize(width, height);
        this.cameraControls?.onResize();
    }

    private createScene(): void {
        this.scene = new THREE.Scene();
        // Soft gradient background - off-white
        this.scene.background = new THREE.Color(0xfaf9f6);
    }

    private createCamera(container: HTMLElement): void {
        const aspect = container.clientWidth / container.clientHeight;
        const frustumSize = 10;

        // Orthographic camera for isometric view
        this.camera = new THREE.OrthographicCamera(
            (-frustumSize * aspect) / 2,
            (frustumSize * aspect) / 2,
            frustumSize / 2,
            -frustumSize / 2,
            0.1,
            1000,
        );

        // Isometric camera position
        // Standard isometric: 45° rotation, ~35.264° tilt (atan(1/√2))
        const distance = 15;
        this.camera.position.set(distance, distance, distance);
        this.camera.lookAt(0, 0, 0);
    }

    private createRenderer(container: HTMLElement): void {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
        });

        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Enable shadows with soft shadow mapping
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Tone mapping for better colors
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        container.appendChild(this.renderer.domElement);
    }

    private createLights(): void {
        // Soft ambient light for fill
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // Main directional light (sun-like) with shadows
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;

        // Shadow configuration for soft shadows
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -15;
        directionalLight.shadow.camera.right = 15;
        directionalLight.shadow.camera.top = 15;
        directionalLight.shadow.camera.bottom = -15;
        directionalLight.shadow.bias = -0.0001;
        directionalLight.shadow.radius = 4; // Soft shadow blur

        this.scene.add(directionalLight);

        // Secondary fill light from opposite direction
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-5, 10, -5);
        this.scene.add(fillLight);
    }

    private createHelloWorldScene(): void {
        // Ground plane (slightly below grid to avoid z-fighting)
        const { width, height, cellSize } = this.gridConfig;
        const groundSize = Math.max(width!, height!) * cellSize! + 2;
        const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0xe8e4e0, // Slightly warm off-white
            roughness: 0.9,
            metalness: 0.0,
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        ground.name = "ground";
        this.scene.add(ground);

        // Create the grid overlay
        this.gridHelper = new GridHelper(this.scene, this.gridConfig);

        // Demo: Add sample services to showcase the mesh system
        this.createDemoServices();
    }

    /**
     * Create demo services to showcase the service mesh system
     */
    private createDemoServices(): void {
        const gridWidth = this.gridConfig.width!;
        const gridHeight = this.gridConfig.height!;

        // API Gateway (3x2) - Center top
        const gateway = ServiceMeshFactory.createServiceMesh(
            ServiceType.API_GATEWAY,
            8,
            2,
            gridWidth,
            gridHeight,
        );
        this.scene.add(gateway);

        // REST Service (2x2) - Below gateway left
        const restService = ServiceMeshFactory.createServiceMesh(
            ServiceType.REST_SERVICE,
            6,
            6,
            gridWidth,
            gridHeight,
        );
        this.scene.add(restService);

        // Cache (2x1) - Next to REST service
        const cache = ServiceMeshFactory.createServiceMesh(ServiceType.CACHE, 10, 6, gridWidth, gridHeight);
        this.scene.add(cache);

        // Database (3x3) - Bottom center
        const database = ServiceMeshFactory.createServiceMesh(ServiceType.DATABASE, 8, 10, gridWidth, gridHeight);
        this.scene.add(database);

        // Message Queue (2x3) - Left side
        const queue = ServiceMeshFactory.createServiceMesh(ServiceType.MESSAGE_QUEUE, 3, 5, gridWidth, gridHeight);
        this.scene.add(queue);

        // Load Balancer (2x2) - Right side
        const loadBalancer = ServiceMeshFactory.createServiceMesh(
            ServiceType.LOAD_BALANCER,
            14,
            6,
            gridWidth,
            gridHeight,
        );
        this.scene.add(loadBalancer);
    }

    // ============ Grid API ============

    /**
     * Get the grid helper for external manipulation
     */
    getGrid(): GridHelper {
        return this.gridHelper;
    }

    /**
     * Highlight a grid cell (used during drag operations)
     */
    highlightGridCell(gridX: number, gridZ: number, isValid: boolean): void {
        this.gridHelper.highlightCell(gridX, gridZ, isValid);
    }

    /**
     * Highlight multiple grid cells (for multi-cell services)
     */
    highlightGridCells(cells: Array<{ gridX: number; gridZ: number }>, isValid: boolean): void {
        this.gridHelper.highlightCells(cells, isValid);
    }

    /**
     * Clear grid highlight
     */
    clearGridHighlight(): void {
        this.gridHelper.clearHighlight();
    }

    /**
     * Set grid line emphasis (0.15 = subtle, 0.4 = emphasized during drag)
     */
    setGridEmphasis(emphasized: boolean): void {
        this.gridHelper.setLineOpacity(emphasized ? 0.4 : 0.15);
    }

    /**
     * Reset camera to center position
     */
    resetCamera(): void {
        this.cameraControls?.reset();
    }

    /**
     * Convert screen coordinates to grid coordinates
     */
    screenToGrid(
        screenX: number,
        screenY: number,
        containerWidth: number,
        containerHeight: number,
    ): { gridX: number; gridZ: number } | null {
        // Normalize screen coords to NDC (-1 to 1)
        const ndcX = (screenX / containerWidth) * 2 - 1;
        const ndcY = -(screenY / containerHeight) * 2 + 1;

        // Create raycaster
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

        // Find intersection with ground plane
        const ground = this.scene.getObjectByName("ground");
        if (!ground) return null;

        const intersects = raycaster.intersectObject(ground);
        if (intersects.length === 0) return null;

        const point = intersects[0].point;
        return this.gridHelper.worldToGrid(point.x, point.z);
    }

    private animate = (): void => {
        this.animationFrameId = requestAnimationFrame(this.animate);

        // Update camera controls (for keyboard pan)
        this.cameraControls?.update();

        this.renderer.render(this.scene, this.camera);
    };
}
