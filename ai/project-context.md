# tiny-stacks - AI Project Context

> Long-Term Memory for AI assistants working on this project

---

## Project Status

**Phase:** Core Interactions
**Milestone:** Service Placement + Connections
**Last Updated:** 2026-02-08

### Current Progress
- [x] Angular 21.1.0 initialized
- [x] TailwindCSS v4.1.18 configured
- [x] Lucide Angular icons
- [x] Biome linting/formatting
- [x] **2D REFACTOR** - Removed Three.js, now pure HTML/CSS/SVG
- [x] CSS Grid game board
- [x] 2D service components with Lucide icons
- [x] Game state management with Signals
- [x] Service palette UI (drag source, glassmorphism panel)
- [x] Drag-drop placement with green/red preview
- [x] SVG connection lines between service ports (Bezier curves)
- [x] Port-to-port drag interaction (mousedown→mousemove→mouseup)
- [x] Service inspector panel (right-side, glassmorphism)
- [x] Connection selection + Delete key deletion

---

## Tech Stack Decisions

| Technology | Version | Why |
|------------|---------|-----|
| **Angular** | 21.1.0 | Latest, Signals for state, standalone components |
| **TailwindCSS** | 4.1.18 | v4 with PostCSS, utility-first styling |
| **Lucide** | 0.563.0 | SVG icons for services |
| **Bun** | Runtime | Fast package manager and runtime |
| **Biome** | 2.3.14 | Linting and formatting |

### Key Architectural Choices
1. **Pure HTML/CSS/SVG** - No canvas/WebGL, simpler and lighter
2. **CSS Grid** for game board layout
3. **Pure Signals** - No NgRx, using Angular 21 Signals for reactive state
4. **Lucide icons** for service visuals (SVG-based)
5. **Native HTML5 drag-drop** for palette→board placement (no CDK)
6. **Raw mouse events** for port-to-port connections (separate from drag API)

### Code Conventions

**IMPORTANT:** Check `.cursor/rules/conventions/` for detailed coding standards.

**Formatting & Linting (Biome):**
```bash
bun run lint        # Check for lint errors
bun run format      # Format code
bun run check       # Check both lint + format
bun run check:fix   # Fix all auto-fixable issues
```

---

## Current Architecture

```
src/
├── app/
│   ├── core/
│   │   └── game/
│   │       ├── game-state.service.ts   # State management with Signals
│   │       ├── service-types.config.ts # Service definitions
│   │       └── port-utils.ts           # Port position math & Bezier paths
│   ├── features/
│   │   ├── board/
│   │   │   └── game-board.component.ts # CSS Grid board + drag-drop + connection wiring
│   │   ├── connections/
│   │   │   └── connection-layer.component.ts # SVG overlay for connection Bezier paths
│   │   ├── palette/
│   │   │   └── service-palette.component.ts  # Floating draggable service palette
│   │   └── services/
│   │       └── service.component.ts    # 2D service rendering + port interaction
│   └── app.ts (root component)
├── styles.scss (TailwindCSS + CSS variables)
└── ai/
    └── project-context.md (this file)
```

### State Management
```typescript
// GameStateService uses Signals
readonly services = signal<PlacedService[]>([]);
readonly connections = signal<Connection[]>([]);
readonly selectedServiceId = signal<string | null>(null);
readonly draggingType = signal<ServiceType | null>(null);
readonly occupiedCells = computed(() => /* collision detection */);

// Methods
addService(type, gridX, gridY)
removeService(id)         // also removes associated connections
canPlaceService(type, gridX, gridY)
addConnection(source, target)
removeConnection(id)
canConnect(source, target) // validates port directions, duplicates, self-connections
```

### Connection System
- **Model:** `Connection { id, source: PortRef, target: PortRef }` where `PortRef { serviceId, portIndex }`
- **Rendering:** SVG Bezier curves via `ConnectionLayerComponent`, layered between grid and services
- **Interaction:** mousedown on port → mousemove shows dashed preview → mouseup on target port creates connection
- **Validation:** OUTPUT/BIDIRECTIONAL → INPUT/BIDIRECTIONAL only, no self-connections, no duplicates
- **Utilities:** `port-utils.ts` provides `getPortAbsolutePosition()`, `computeBezierPath()`, `computePreviewPath()`

### Service Types
| Type | Size | Color | Icon |
|------|------|-------|------|
| API Gateway | 3x2 | #88D8D8 (Teal) | globe |
| REST Service | 2x2 | #87CEEB (Sky Blue) | server |
| Database | 3x3 | #D4A5FF (Lavender) | database |
| Cache | 2x1 | #A8E6CF (Mint) | zap |
| Message Queue | 2x3 | #FFCBA4 (Peach) | mail |
| Load Balancer | 2x2 | #FFE5A0 (Gold) | split |

---

## Todo List

### Immediate (Next Steps)
1. Animated request packets (CSS animations on SVG paths)
2. Save/Load with LocalStorage

### Future
- Cascading failure visualization
- Challenge mode

---

## Vibe Check

### Visual Style
- 2D top-down grid (Shapez-like)
- Pastel colored service blocks
- Lucide icons for service types
- Subtle grid lines
- Soft shadows on services
- Glassmorphism panels (palette)

### Grid
- Default size: 20x14 cells
- Cell size: 48px
- Grid lines: slate-400 @ 30% opacity

### Port Colors
- Input: #22c55e (green-500)
- Output: #3b82f6 (blue-500)
- Bidirectional: #f97316 (orange-500)

### Connection Colors
- Default: #94a3b8 (slate-400), stroke-width 3
- Hover: #64748b (slate-500), stroke-width 4
- Preview: #3b82f6 (blue-500), dashed, opacity 0.7

---

## Notes

- **Bundle size: ~250KB** (pure HTML/CSS/SVG, no canvas)
- Audio: Deferred to post-MVP
- Mobile: Desktop-only for v1

---

*This file should be updated with every significant change.*
