# tiny-stacks - AI Project Context

> Long-Term Memory for AI assistants working on this project

---

## Game Vision

**tiny-stacks** is a 2D top-down simulation game ("The Factorio of DevOps"). Players design microservice architectures on a grid: place services, connect them with lines, and watch request packets flow through the system. Pure HTML/CSS/SVG Angular SPA, no backend — state in LocalStorage.

**Core Loop:** Place → Connect → Watch → Optimize → Iterate

**Game Modes (planned):**
- **Sandbox** — unlimited creative building
- **Challenges** — specific goals with 3-star rating (e.g. "handle 100 req/s", "fix a broken system in <30s")

**Simulation design**: See `ai/simulation-design.md` for the full design of the tick-based simulation engine, service behaviors, request lifecycle, and challenge system.

---

## Project Status

**Phase:** Simulation Engine (Phase 3 complete)
**Milestone:** Response Paths + Cache Hit/Miss
**Last Updated:** 2026-02-09

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
- [x] ~~Animated request packets (visual-only, RAF loop)~~ → replaced by tick engine
- [x] Tick-based simulation engine (60 tps, real request lifecycle)
- [x] Origin service type (traffic source, cloud icon, 1x1)
- [x] Response paths (packets travel back to Origin after reaching terminal services)
- [x] Cache hit/miss mechanics (resource tracking, GET hit/miss, POST/PUT/DELETE invalidation)
- [x] Cache stats in inspector (hit rate, hit/miss counts, cached resources)
- [x] Failed packet pop animation (expanding red X that fades out at overloaded services)
- [x] Example setup button (Origin → Gateway → REST → Cache → Database)
- [x] Save/Load with LocalStorage (auto-save via effect, auto-load on init)
- [x] Typed StorageService wrapper for localStorage
- [x] Service drag-to-move on the grid
- [x] Undo/Redo system (Ctrl+Z / Ctrl+Shift+Z, toolbar buttons, snapshot-based)

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
│   │   ├── game/
│   │   │   ├── game-state.service.ts    # State (Signals) + undo/redo + persistence
│   │   │   ├── tick-engine.service.ts   # Tick-based simulation engine (60 tps)
│   │   │   ├── sim-types.ts             # SimRequest, TrafficPattern, ServiceRuntimeState
│   │   │   ├── service-types.config.ts  # Service definitions (types, sizes, colors, ports)
│   │   │   └── port-utils.ts            # Port position math & Bezier curves
│   │   └── storage/
│   │       └── storage.service.ts       # Typed localStorage wrapper
│   ├── features/
│   │   ├── board/
│   │   │   └── game-board.component.ts  # Board + drag-drop + connections + packets + toolbar
│   │   ├── connections/
│   │   │   └── connection-layer.component.ts  # SVG Bezier paths + packets
│   │   ├── inspector/
│   │   │   └── service-inspector.component.ts # Right-side detail panel
│   │   ├── palette/
│   │   │   └── service-palette.component.ts   # Bottom-left service palette
│   │   └── services/
│   │       └── service.component.ts     # Service tile + port interaction + drag-to-move
│   └── app.ts (root component)
├── styles.scss (TailwindCSS + CSS variables)
└── ai/
    └── project-context.md (this file)
```

### State Management
```typescript
// GameStateService — Signals + auto-save + undo/redo
readonly services = signal<PlacedService[]>([]);
readonly connections = signal<Connection[]>([]);
readonly selectedServiceId / selectedConnectionId / draggingType
readonly occupiedCells = computed(/* collision detection */);
readonly canUndo / canRedo = computed(/* stack lengths */);

// Mutations (all push undo snapshots)
addService(type, gridX, gridY)
removeService(id)              // cascades to connections
moveService(id, gridX, gridY)  // drag-to-move
addConnection(source, target)
removeConnection(id)
clearAll()
undo() / redo()                // snapshot-based, max 50 entries

// Persistence: StorageService wraps localStorage with typed keys (StorageKeys enum)
// Auto-save via effect(), auto-load in constructor
```

### Simulation System
- `TickEngineService` — `setInterval`-based tick loop at 60 tps, replaces old decorative `SimulationService`
- **Request lifecycle:** Origin spawns → travel along connection (300ms hop) → queue at service → process (respects `baseProcessingTime`, `maxConcurrency`) → forward via outgoing connections → response travels back to Origin
- **Response paths:** Requests track `routeHistory` (connection IDs). At terminal services, direction flips to `'response'` and packets travel back along the same connections in reverse. Response packets skip queues at intermediate services.
- **Cache hit/miss:** Cache services track cached resources per `resource` name. GET + cached = HIT (immediate response). GET + not cached = MISS (caches resource, forwards to downstream). POST/PUT/DELETE invalidate the cached resource. Stats (hits/misses/cached count) exposed via `ServiceVisualState.cacheStats`.
- **Origin service:** Traffic source (10 req/s default), weighted distribution of GET/POST/PUT/DELETE
- **Queue overflow:** requests fail when `queue + processing >= queueSize + maxConcurrency`
- **Types:** `SimRequest` (with `direction`, `routeHistory`, `originServiceId`), `TrafficPattern`, `ServiceRuntimeState`, `CacheStats` in `sim-types.ts`
- Color-coded by method: GET (#87CEEB), POST (#A8E6CF), PUT (#FFE5A0), DELETE (#FFCBA4)
- Response packets: smaller radius (4px) with white stroke ring
- Positioned via parametric cubic Bezier evaluation (`evaluateBezier(t, curve)` in `port-utils.ts`); response packets use `1-t` for reverse direction

### Connection System
- **Model:** `Connection { id, source: PortRef, target: PortRef }` where `PortRef { serviceId, portIndex }`
- **Rendering:** SVG Bezier curves via `ConnectionLayerComponent`, layered between grid and services
- **Interaction:** mousedown on port → mousemove shows dashed preview → mouseup on target port creates connection
- **Validation:** OUTPUT/BIDIRECTIONAL → INPUT/BIDIRECTIONAL only, no self-connections, no duplicates
- **Utilities:** `port-utils.ts` provides `getPortAbsolutePosition()`, `computeBezierPath()`, `computePreviewPath()`

### Service Types
| Type | Size | Color | Icon |
|------|------|-------|------|
| Origin | 1x1 | #FF8B8B (Coral) | cloud |
| API Gateway | 3x2 | #88D8D8 (Teal) | globe |
| REST Service | 2x2 | #87CEEB (Sky Blue) | server |
| Database | 3x3 | #D4A5FF (Lavender) | database |
| Cache | 2x1 | #A8E6CF (Mint) | zap |
| Message Queue | 2x3 | #FFCBA4 (Peach) | mail |
| Load Balancer | 2x2 | #FFE5A0 (Gold) | split |

---

## Todo List

### Immediate (Next Steps)
1. Phase 4: Overload visuals (pile-up, red packets), batch rendering
2. Responsive grid (zoom/pan)
3. Challenge mode
4. Per-connection routing filters (method filter + percentage slider)

### Future
- Landing page with live demo scene
- Challenge mode with star ratings
- Cascading failure visualization (domino effect)
- Metrics dashboard (throughput, latency, error rate)
- Service configuration editing (processing time, queue size)
- Import/export layouts
- Ambient audio (muted by default)
- Service upgrades (Basic → Pro → Enterprise)

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
