import * as THREE from "three";

export interface CameraControlsConfig {
    panSpeed: number;
    zoomSpeed: number;
    minZoom: number;
    maxZoom: number;
    keyPanSpeed: number;
}

const DEFAULT_CONFIG: CameraControlsConfig = {
    panSpeed: 0.01,
    zoomSpeed: 0.5,
    minZoom: 5, // Closest zoom (smaller frustum = closer)
    maxZoom: 30, // Farthest zoom (larger frustum = farther)
    keyPanSpeed: 0.3,
};

/**
 * Camera controls for isometric view
 * - Pan: Middle-click drag or Arrow keys
 * - Zoom: Scroll wheel
 * - Isometric angle is fixed
 */
export class CameraControls {
    private camera: THREE.OrthographicCamera;
    private domElement: HTMLElement;
    private config: CameraControlsConfig;

    private isPanning = false;
    private panStart = new THREE.Vector2();
    private targetOffset = new THREE.Vector3(0, 0, 0);
    private currentZoom: number;

    // Track pressed keys for smooth movement
    private keysPressed = new Set<string>();
    private readonly ISOMETRIC_ANGLE = Math.PI / 4; // 45 degrees

    constructor(camera: THREE.OrthographicCamera, domElement: HTMLElement, config: Partial<CameraControlsConfig> = {}) {
        this.camera = camera;
        this.domElement = domElement;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.currentZoom = 10; // Initial frustum size

        this.bindEvents();
    }

    private bindEvents(): void {
        // Mouse events
        this.domElement.addEventListener("mousedown", this.onMouseDown);
        this.domElement.addEventListener("mousemove", this.onMouseMove);
        this.domElement.addEventListener("mouseup", this.onMouseUp);
        this.domElement.addEventListener("mouseleave", this.onMouseUp);
        this.domElement.addEventListener("wheel", this.onWheel, { passive: false });

        // Keyboard events
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);

        // Prevent context menu on right-click
        this.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    private onMouseDown = (event: MouseEvent): void => {
        // Middle-click (button 1) for panning
        if (event.button === 1) {
            event.preventDefault();
            this.isPanning = true;
            this.panStart.set(event.clientX, event.clientY);
            this.domElement.style.cursor = "grabbing";
        }
    };

    private onMouseMove = (event: MouseEvent): void => {
        if (!this.isPanning) return;

        const deltaX = event.clientX - this.panStart.x;
        const deltaY = event.clientY - this.panStart.y;

        // Calculate pan in world space (accounting for isometric rotation)
        const panX = -deltaX * this.config.panSpeed * this.currentZoom * 0.1;
        const panZ = -deltaY * this.config.panSpeed * this.currentZoom * 0.1;

        // Apply isometric rotation to pan direction
        const cos45 = Math.cos(this.ISOMETRIC_ANGLE);
        const sin45 = Math.sin(this.ISOMETRIC_ANGLE);

        this.targetOffset.x += panX * cos45 + panZ * sin45;
        this.targetOffset.z += -panX * sin45 + panZ * cos45;

        this.panStart.set(event.clientX, event.clientY);
        this.updateCamera();
    };

    private onMouseUp = (): void => {
        if (this.isPanning) {
            this.isPanning = false;
            this.domElement.style.cursor = "default";
        }
    };

    private onWheel = (event: WheelEvent): void => {
        event.preventDefault();

        const delta = event.deltaY > 0 ? 1 : -1;
        this.currentZoom += delta * this.config.zoomSpeed;
        this.currentZoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, this.currentZoom));

        this.updateCameraProjection();
    };

    private onKeyDown = (event: KeyboardEvent): void => {
        // Ignore if user is typing in an input
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
            return;
        }

        this.keysPressed.add(event.key);
    };

    private onKeyUp = (event: KeyboardEvent): void => {
        this.keysPressed.delete(event.key);
    };

    /**
     * Update camera based on keyboard input (call in animation loop)
     */
    update(): void {
        let panX = 0;
        let panZ = 0;
        const speed = this.config.keyPanSpeed;

        if (this.keysPressed.has("ArrowLeft") || this.keysPressed.has("a")) panX -= speed;
        if (this.keysPressed.has("ArrowRight") || this.keysPressed.has("d")) panX += speed;
        if (this.keysPressed.has("ArrowUp") || this.keysPressed.has("w")) panZ -= speed;
        if (this.keysPressed.has("ArrowDown") || this.keysPressed.has("s")) panZ += speed;

        if (panX !== 0 || panZ !== 0) {
            // Apply isometric rotation to key pan direction
            const cos45 = Math.cos(this.ISOMETRIC_ANGLE);
            const sin45 = Math.sin(this.ISOMETRIC_ANGLE);

            this.targetOffset.x += panX * cos45 + panZ * sin45;
            this.targetOffset.z += -panX * sin45 + panZ * cos45;

            this.updateCamera();
        }
    }

    private updateCamera(): void {
        // Base isometric position (distance 15 at 45° angle)
        const distance = 15;
        this.camera.position.set(distance + this.targetOffset.x, distance, distance + this.targetOffset.z);

        // Look at the offset point
        this.camera.lookAt(this.targetOffset.x, 0, this.targetOffset.z);
    }

    private updateCameraProjection(): void {
        const aspect = this.domElement.clientWidth / this.domElement.clientHeight;

        this.camera.left = (-this.currentZoom * aspect) / 2;
        this.camera.right = (this.currentZoom * aspect) / 2;
        this.camera.top = this.currentZoom / 2;
        this.camera.bottom = -this.currentZoom / 2;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Reset camera to center
     */
    reset(): void {
        this.targetOffset.set(0, 0, 0);
        this.currentZoom = 10;
        this.updateCamera();
        this.updateCameraProjection();
    }

    /**
     * Get current camera bounds for culling
     */
    getBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
        const halfWidth = (this.currentZoom * (this.domElement.clientWidth / this.domElement.clientHeight)) / 2;
        const halfHeight = this.currentZoom / 2;

        return {
            minX: this.targetOffset.x - halfWidth,
            maxX: this.targetOffset.x + halfWidth,
            minZ: this.targetOffset.z - halfHeight,
            maxZ: this.targetOffset.z + halfHeight,
        };
    }

    /**
     * Handle window resize
     */
    onResize(): void {
        this.updateCameraProjection();
    }

    /**
     * Clean up event listeners
     */
    dispose(): void {
        this.domElement.removeEventListener("mousedown", this.onMouseDown);
        this.domElement.removeEventListener("mousemove", this.onMouseMove);
        this.domElement.removeEventListener("mouseup", this.onMouseUp);
        this.domElement.removeEventListener("mouseleave", this.onMouseUp);
        this.domElement.removeEventListener("wheel", this.onWheel);
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
    }
}
