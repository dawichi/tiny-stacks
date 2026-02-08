# tiny-stacks - Project Specification

> The "Factorio" of DevOps - A 2D Microservices Simulation Game

**Version:** 2.0.0
**Type:** Portfolio-Ready Web Experience
**URL Structure:** Single Page Application (SPA) - No Backend (LocalStorage only)

---

## 1. Executive Summary

**tiny-stacks** is a clean, 2D top-down simulation game where players design and manage microservice architectures. Think Shapez meets DevOps - players place services on a grid, connect them with lines, and watch requests flow through their system as animated packets. The goal is to create a portfolio-ready web experience that showcases technical mastery and product vision.

**Note:** Originally designed as 3D isometric, refactored to 2D for simplicity and focus on UI/UX.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Framework** | Angular 21+ | Signals, Standalone Components |
| **Rendering** | Pure HTML/CSS/SVG | No canvas/WebGL - DOM-based |
| **Styling** | TailwindCSS v4 | Utility-first styling |
| **Icons** | Lucide-Angular | SVG icons for services |
| **Build** | Angular CLI | Default configuration |
| **Package Manager** | Bun | For all installs and scripts |
| **State Management** | Pure Angular Signals | Lightweight, reactive |
| **Linting** | Biome | Replaces ESLint + Prettier |

---

## 3. Visual Aesthetic ("The Vibe")

### 3.1 Core Style
- **Visual Language:** Clean 2D / Flat design with soft shadows
- **View:** Top-down grid (Shapez-like)
- **Background:** Soft slate gradient

### 3.2 Layout
- CSS Grid for game board
- Services as styled divs with SVG icons
- Connection lines as SVG paths
- Subtle grid lines for cell boundaries

### 3.3 Color Palette (Mixed Pastels)
| Category | Colors |
|----------|--------|
| **Warm** | Peach (#FFCBA4), Coral (#FF8B8B), Cream (#FFF5E1), Soft Gold (#FFE5A0) |
| **Cool** | Mint (#A8E6CF), Lavender (#D4A5FF), Sky Blue (#87CEEB), Soft Teal (#88D8D8) |
| **Neutrals** | Slate (#708090), Soft Gray (#B8C4CE), Off-White (#FAF9F6) |

### 3.4 Service Styling
- Rounded corners (rounded-lg)
- Pastel background colors
- Lucide icons centered
- Soft drop shadows
- Hover scale effect

---

## 4. Asset Strategy

**SVG-BASED APPROACH**

- Lucide icons for service types (globe, server, database, etc.)
- SVG paths for connection lines
- CSS animations for request packets
- No external image files needed

---

## 5. Game Mechanics

### 5.1 Core Loop
1. **Place** services on the grid (drag from palette)
2. **Connect** services via port-based connections
3. **Watch** requests flow as animated packets
4. **Optimize** to handle load and prevent cascading failures
5. **Iterate** - delete, rearrange, improve

### 5.2 Grid System

| Property | Value |
|----------|-------|
| **Type** | 2D top-down square grid |
| **Size** | 20x14 cells (default), 48px per cell |
| **Visibility** | Subtle lines (slate @ 30% opacity) |
| **Placement Feedback** | Green = valid, Red = invalid |

### 5.3 Service Types (DevOps Classic)

| Service | Grid Size | Color | Icon | Description |
|---------|-----------|-------|------|-------------|
| **API Gateway** | 3x2 | #88D8D8 (Teal) | globe | Entry point, routes requests |
| **REST Service** | 2x2 | #87CEEB (Sky Blue) | server | Processes business logic |
| **Database** | 3x3 | Lavender | Persistent storage, slow but reliable |
| **Cache** | 2x1 | Mint | Fast lookup, limited capacity |
| **Message Queue** | 2x3 | Peach | Async processing, buffers requests |
| **Load Balancer** | 2x2 | Soft Gold | Distributes load across services |

*Each service has a **designated connection cell** where all ports (input/output) are located.*

### 5.4 Connections

| Property | Implementation |
|----------|----------------|
| **Creation** | Port-based: click-drag from output port to input port |
| **Appearance** | 3D rounded tubes (cylindrical, matches clay aesthetic) |
| **Routing** | Pathfinding to designated connection cell |

### 5.5 Request Flow Visualization

**Animated Packets** travel through connection tubes:

| Packet State | Visual |
|--------------|--------|
| **Outbound request** | Muted/desaturated color based on request type |
| **Success response** | Same color but vibrant/glowing + smooth travel |
| **Error response** | Red color + slight "angry wobble" animation |
| **Timeout** | Packet fades out mid-journey (dramatic!) |

**Request Type Colors:**
- GET: Blue tones
- POST: Green tones
- PUT: Yellow tones
- DELETE: Orange tones

### 5.6 Failure System (Cascading)

When a service becomes overloaded:
1. Service visual indicator turns stressed (color shift, subtle shake)
2. Processing slows down
3. Upstream services begin queuing
4. If queue overflows → upstream services also fail
5. Creates dramatic "domino effect" the player must fix

---

## 6. User Interface

### 6.1 Layout Philosophy
**Minimal Floating Panels** - The 3D scene is the star

```
┌─────────────────────────────────────────────────┐
│ [Metrics]                              [Speed]  │  ← Top corners
│                                                 │
│                                                 │
│              3D CANVAS (HERO)                   │
│                                                 │
│                                                 │
│ [Palette]                         [Inspector]→  │  ← Floating panels
└─────────────────────────────────────────────────┘
```

### 6.2 Panel Descriptions

| Panel | Position | Behavior |
|-------|----------|----------|
| **Service Palette** | Bottom-left floating | Collapsible, shows available services to drag |
| **Inspector** | Right-side slide-in | Appears when service selected, shows stats/config |
| **Metrics** | Top-left floating | Req/sec, latency, error rate (game-ified presentation) |
| **Speed Control** | Top-right floating | Pause / Play / Fast (2x) buttons |

### 6.3 Visual Style
- **Glassmorphism** for all panels
- Subtle backdrop blur
- Soft borders
- Consistent with clay aesthetic

### 6.4 Metrics Display
Real DevOps metrics presented in a friendly/game-like way:
- Requests/sec → "Traffic" with animated icon
- Avg Latency → "Speed" with color indicator
- Error Rate → "Health" with heart/warning icon
- Uptime % → "Stability" score

---

## 7. Game Modes

### 7.1 Homepage / Landing

**Live Canvas Experience:**
- 3D scene runs in background with a pre-built demo system
- Animated packets flowing, services processing
- Title overlay with glassmorphism

**Call-to-Action Buttons:**
1. **"Sandbox"** → Smooth transition INTO the demo scene (no loading!)
2. **"Challenges"** → Modal/page with challenge list

*User enters sandbox with the demo architecture already placed - they can explore, modify, or delete everything.*

### 7.2 Sandbox Mode
- **Grid Size:** 20x20 (default, could be configurable)
- **Objective:** None - pure creative building
- **Features:** Full service palette, unlimited placement

### 7.3 Challenge Mode
- **Grid Size:** Varies per challenge (small → large)
- **Objectives:** Specific goals with 3-star rating system
- **Star System:**
  - 1 Star: Complete primary objective
  - 2 Stars: Complete + bonus goal 1
  - 3 Stars: Complete + both bonus goals

**Example Challenges:**

| Challenge | Grid | Primary Goal | Bonus Goals |
|-----------|------|--------------|-------------|
| "First Contact" | 10x10 | Connect Gateway to Database | <500ms latency, 0 errors |
| "Traffic Jam" | 15x15 | Handle 100 req/s | Use only 1 DB, <200ms latency |
| "Cascade Crisis" | 20x20 | Fix saturated DB (pre-placed broken system) | No service deletions, <30 seconds |

---

## 8. Camera & Controls

### 8.1 Camera
| Property | Value |
|----------|-------|
| **Type** | Orthographic (isometric) |
| **Angle** | Fixed isometric (~45° rotation, ~35.264° tilt) |
| **Controls** | Pan + Zoom only (no orbit) |

### 8.2 Input Controls

| Action | Input |
|--------|-------|
| **Pan** | Middle-click drag OR Arrow keys |
| **Zoom** | Scroll wheel |
| **Place service** | Drag from palette to grid |
| **Select service** | Left-click |
| **Delete service** | Select → Delete key OR inspector button |
| **Create connection** | Click-drag from output port to input port |
| **Undo** | Ctrl+Z (basic, last few actions) |

---

## 9. Simulation Engine

### 9.1 Speed Controls
| Mode | Simulation Rate |
|------|-----------------|
| **Pause** | 0x - Build without pressure |
| **Play** | 1x - Normal speed |
| **Fast** | 2x - Accelerated for testing |

### 9.2 Request Simulation
- Requests spawn at entry points (API Gateway)
- Each service has processing time (based on type + load)
- Capacity limits per service
- Queue overflow triggers failure state

### 9.3 Performance Target
- **60 FPS** consistent
- Render loop runs **outside Angular Zone** (`NgZone.runOutsideAngular`)
- Estimated max entities: ~50 services + 200 active packets

---

## 10. Persistence (LocalStorage)

### 10.1 Save System
| Feature | Implementation |
|---------|----------------|
| **Auto-save** | Continuous save to "current" slot |
| **Named saves** | User can create snapshots with custom names |
| **Load** | Dropdown to select from saved states |

### 10.2 Data Structure
```typescript
interface SaveState {
  id: string;
  name: string;
  timestamp: number;
  gridSize: { width: number; height: number };
  services: ServiceState[];
  connections: ConnectionState[];
  camera: { x: number; y: number; zoom: number };
}
```

---

## 11. Technical Architecture

### 11.1 Core Services

```
src/
├── app/
│   ├── core/
│   │   ├── engine/
│   │   │   ├── game-engine.service.ts    # Three.js scene, camera, renderer
│   │   │   ├── render-loop.service.ts    # RAF outside NgZone
│   │   │   └── input.service.ts          # Mouse/keyboard handling
│   │   ├── simulation/
│   │   │   ├── simulation.service.ts     # Game tick, request processing
│   │   │   ├── request.model.ts          # Request/packet state
│   │   │   └── service-types.config.ts   # Service definitions
│   │   └── state/
│   │       ├── game-state.signal.ts      # Central state with Signals
│   │       └── persistence.service.ts    # LocalStorage save/load
│   ├── features/
│   │   ├── canvas/
│   │   │   └── game-canvas.component.ts  # Main 3D viewport
│   │   ├── ui/
│   │   │   ├── palette/                  # Service palette panel
│   │   │   ├── inspector/                # Service inspector panel
│   │   │   ├── metrics/                  # Metrics display
│   │   │   └── controls/                 # Speed controls
│   │   ├── home/                         # Landing page
│   │   └── challenges/                   # Challenge selection & goals
│   └── shared/
│       ├── components/                   # Reusable UI components
│       └── utils/                        # Helper functions
├── ai/
│   └── project-context.md               # AI Long-Term Memory (CRITICAL)
└── assets/                              # (empty - no external assets)
```

### 11.2 Key Patterns

**Render Loop (Outside Zone):**
```typescript
constructor(private ngZone: NgZone) {
  this.ngZone.runOutsideAngular(() => {
    this.animate();
  });
}

private animate() {
  requestAnimationFrame(() => this.animate());
  // Update + Render
}
```

**State with Signals:**
```typescript
// Central game state
export const gameState = signal<GameState>(initialState);

// Derived computeds
export const activeServices = computed(() =>
  gameState().services.filter(s => !s.failed)
);
```

---

## 12. Documentation Rule (CRITICAL)

**File:** `/ai/project-context.md`

This file acts as **Long-Term Memory** for the project. It MUST be updated with every significant change.

**Required Sections:**
1. **Project Status** - Current phase/milestone
2. **Tech Stack Decisions** - Why we chose X over Y
3. **Current Architecture** - Brief explanation of game loop & state
4. **Todo List** - Next immediate steps
5. **Vibe Check** - Color codes, material settings, aesthetic notes

---

## 13. Future Considerations (Post-MVP)

*Not in scope for v1, but noted for potential expansion:*

- [ ] **Ambient Audio** - Background music + SFX (muted by default)
- [ ] **Service Upgrades** - Tier system (Basic → Pro → Enterprise)
- [ ] **Mobile View** - Read-only demo with "best on desktop" message
- [ ] **Export/Share** - Share architecture as image or link
- [ ] **Custom Services** - User-defined service types
- [ ] **Multiplayer** - View others' architectures

---

## 14. Success Criteria

**The project is complete when:**

1. Landing page shows live animated demo system
2. Smooth transition into sandbox mode
3. All 6 service types placeable and functional
4. Port-based connections with rounded tube visuals
5. Animated request packets with color-coded states
6. Cascading failure system working
7. At least 3 playable challenges with star ratings
8. Auto-save + named saves functional
9. Consistent 60 FPS performance
10. Looks STUNNING in portfolio screenshots

---

## 15. First Implementation Task

**Goal:** Initial scaffolding with "Hello World" isometric scene

1. Initialize Angular 21 application named `tiny-stacks` (using Bun)
2. Configure TailwindCSS v4
3. Create `/ai/project-context.md` with initial context
4. Create `GameEngineService` with Three.js scene, camera, renderer
   - Render loop MUST run outside Angular Zone
5. Create `GameCanvasComponent` that initializes the engine
6. Render: Spinning pastel cube with rounded edges on a plane
   - Isometric orthographic camera
   - Soft directional lighting with shadows
   - Clay-like material

---

*Specification authored collaboratively. Let's build something beautiful.*
