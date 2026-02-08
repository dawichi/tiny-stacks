# tiny-stacks - AI Project Context

> Long-Term Memory for AI assistants working on this project

---

## Project Status

**Phase:** 2D Refactor Complete
**Milestone:** Basic 2D Grid with Services
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
- [x] Demo services rendering

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
│   │       └── service-types.config.ts # Service definitions
│   ├── features/
│   │   ├── board/
│   │   │   └── game-board.component.ts # CSS Grid game board
│   │   └── services/
│   │       └── service.component.ts    # 2D service rendering
│   └── app.ts (root component)
├── styles.scss (TailwindCSS + CSS variables)
└── ai/
    └── project-context.md (this file)
```

### State Management
```typescript
// GameStateService uses Signals
readonly services = signal<PlacedService[]>([]);
readonly selectedServiceId = signal<string | null>(null);
readonly occupiedCells = computed(() => /* collision detection */);

// Methods
addService(type, gridX, gridY)
removeService(id)
canPlaceService(type, gridX, gridY)
```

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
1. Service palette UI (drag source)
2. Drag-drop placement
3. Connection lines between services (SVG paths)
4. Service inspector panel

### Future
- Animated request packets (CSS animations on SVG paths)
- Cascading failure visualization
- Challenge mode
- Save/Load with LocalStorage

---

## Vibe Check

### Visual Style
- 2D top-down grid (Shapez-like)
- Pastel colored service blocks
- Lucide icons for service types
- Subtle grid lines
- Soft shadows on services

### Grid
- Default size: 20x14 cells
- Cell size: 48px
- Grid lines: slate-400 @ 30% opacity

### Port Colors
- Input: #22c55e (green-500)
- Output: #3b82f6 (blue-500)
- Bidirectional: #f97316 (orange-500)

---

## Notes

- **Bundle size: ~230KB** (down from 730KB with Three.js)
- Audio: Deferred to post-MVP
- Mobile: Desktop-only for v1

---

*This file should be updated with every significant change.*
