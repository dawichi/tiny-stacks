import { Injectable, NgZone, signal } from '@angular/core';
import * as THREE from 'three';

@Injectable({
  providedIn: 'root'
})
export class GameEngineService {
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationFrameId: number | null = null;

  // Expose scene for components that need to add objects
  readonly isInitialized = signal(false);

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

    this.renderer?.dispose();
    this.scene?.clear();
    this.isInitialized.set(false);
  }

  /**
   * Handle window resize
   */
  onResize(width: number, height: number): void {
    if (!this.camera || !this.renderer) return;

    const aspect = width / height;
    const frustumSize = 10;

    this.camera.left = -frustumSize * aspect / 2;
    this.camera.right = frustumSize * aspect / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  private createScene(): void {
    this.scene = new THREE.Scene();
    // Soft gradient background - off-white
    this.scene.background = new THREE.Color(0xFAF9F6);
  }

  private createCamera(container: HTMLElement): void {
    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = 10;

    // Orthographic camera for isometric view
    this.camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
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
    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0xE8E4E0, // Slightly warm off-white
      roughness: 0.9,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Rounded cube (using RoundedBoxGeometry approach with bevel)
    // Since Three.js doesn't have built-in rounded box, we'll use BoxGeometry
    // with a custom approach - for now, standard box with beveled edges effect
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2, 4, 4, 4);
    this.applyRoundedEdges(cubeGeometry, 0.15);

    // Clay-like material - Soft Teal (API Gateway color)
    const cubeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x88D8D8, // Soft teal
      roughness: 0.4,
      metalness: 0.0,
      clearcoat: 0.2,
      clearcoatRoughness: 0.8,
    });

    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.y = 0.5;
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.name = 'helloWorldCube';
    this.scene.add(cube);
  }

  /**
   * Apply rounded edges effect to box geometry by displacing corner vertices
   */
  private applyRoundedEdges(geometry: THREE.BoxGeometry, radius: number): void {
    const positions = geometry.attributes['position'];
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i);

      // Calculate how much to "round" based on distance from center axes
      const absX = Math.abs(vertex.x);
      const absY = Math.abs(vertex.y);
      const absZ = Math.abs(vertex.z);

      // Only affect corner vertices (where all three coords are near max)
      const maxCoord = 1; // Half of box size (2/2)
      const threshold = maxCoord - radius;

      if (absX > threshold && absY > threshold && absZ > threshold) {
        // Normalize and scale back for rounded effect
        const factor = 0.85;
        vertex.normalize().multiplyScalar(maxCoord * Math.sqrt(3) * factor);
        positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
    }

    geometry.attributes['position'].needsUpdate = true;
    geometry.computeVertexNormals();
  }

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    // Rotate the cube for "Hello World" demo
    const cube = this.scene.getObjectByName('helloWorldCube');
    if (cube) {
      cube.rotation.y += 0.01;
      cube.rotation.x += 0.005;
    }

    this.renderer.render(this.scene, this.camera);
  };
}
