# tiny-stacks - AI Project Context

> Long-Term Memory for AI assistants working on this project

---

## Project Status

**Phase:** Core Systems
**Milestone:** Grid System Complete
**Last Updated:** 2026-02-08

### Current Progress
- [x] Angular 21.1.0 initialized
- [x] TailwindCSS v4.1.18 configured
- [x] Three.js 0.182.0 installed
- [x] Lucide Angular icons installed
- [x] GameEngineService created
- [x] GameCanvasComponent created
- [x] Hello World scene (spinning cube)
- [x] Isometric orthographic camera
- [x] Soft lighting with shadows (PCFSoftShadowMap)
- [x] Ground plane with grid overlay
- [x] GridHelper with cell highlighting

---

## Tech Stack Decisions

| Technology | Version | Why |
|------------|---------|-----|
| **Angular** | 21.1.0 | Latest bleeding edge, Signals for state, standalone components |
| **Three.js** | 0.182.0 | Vanilla - no wrappers for full control |
| **TailwindCSS** | 4.1.18 | v4 with PostCSS, utility-first styling |
| **Lucide** | 0.563.0 | Rounded icon style matches aesthetic |
| **Bun** | Runtime | Fast package manager and runtime |

### Key Architectural Choices
1. **No Three.js wrappers** - We manage the canvas manually for full control
2. **Pure Signals** - No NgRx, using Angular 21 Signals for reactive state
3. **Render loop outside NgZone** - Critical for 60 FPS performance
4. **Procedural assets only** - No external .gltf/.obj/.png files

---

## Current Architecture

```
src/
├── app/
│   ├── core/
│   │   └── engine/
│   │       ├── game-engine.service.ts  # Three.js scene management
│   │       └── helpers/
│   │           └── grid.helper.ts       # Grid system with highlighting
│   ├── features/
│   │   └── canvas/
│   │       └── game-canvas.component.ts
│   └── app.ts (root component)
├── styles.scss (TailwindCSS + CSS variables)
└── ai/
    └── project-context.md (this file)
```

### Game Loop Pattern
```typescript
// Runs OUTSIDE Angular Zone for performance
ngZone.runOutsideAngular(() => {
  const animate = () => {
    requestAnimationFrame(animate);
    // Update simulation
    // Render scene
  };
  animate();
});
```

### Grid System
```typescript
// GridHelper provides:
// - Subtle grid lines (opacity 0.15, slate gray)
// - Cell highlighting (green=valid, red=invalid)
// - Multi-cell highlighting for larger services
// - World <-> Grid coordinate conversion
// - Screen <-> Grid raycasting

gridHelper.highlightCell(5, 5, true);      // Single cell
gridHelper.highlightCells([...], false);   // Multi-cell
gridHelper.setLineOpacity(0.4);            // Emphasize on drag
```

---

## Todo List

### Immediate (Next Steps)
1. Camera controls (pan + zoom)
2. First service mesh (API Gateway as multi-cell example)
3. Service palette UI (floating panel)
4. Drag-drop placement with grid snapping

### Future
- Port-based connections
- Connection tubes (rounded 3D)
- Request packet animation
- Cascading failure system
- Challenge mode

---

## Vibe Check

### Materials
```typescript
new THREE.MeshPhysicalMaterial({
  color: 0x88D8D8,      // Soft teal
  roughness: 0.4,
  metalness: 0.0,
  clearcoat: 0.2,
  clearcoatRoughness: 0.8,
})
```

### Lighting
- Directional light: intensity 1.2, casting soft shadows
- Ambient light: intensity 0.5
- Fill light: intensity 0.3 (opposite direction)
- Shadow map: PCFSoftShadowMap, 2048x2048

### Camera (Isometric)
```typescript
// Orthographic camera at isometric angle
camera.position.set(15, 15, 15);
camera.lookAt(0, 0, 0);
```

### Grid
- Default size: 20x20 cells
- Cell size: 1 unit
- Line color: Slate (#708090)
- Line opacity: 0.15 (subtle), 0.4 (emphasized)
- Highlight valid: Mint (#A8E6CF)
- Highlight invalid: Coral (#FF8B8B)

### Color Palette (CSS Variables)
| Name | Hex | Use |
|------|-----|-----|
| Peach | #FFCBA4 | Message Queue |
| Coral | #FF8B8B | Errors |
| Cream | #FFF5E1 | Backgrounds |
| Soft Gold | #FFE5A0 | Load Balancer |
| Mint | #A8E6CF | Cache, Success |
| Lavender | #D4A5FF | Database |
| Sky Blue | #87CEEB | REST Service |
| Soft Teal | #88D8D8 | API Gateway |
| Off-White | #FAF9F6 | Canvas bg |

---

## Notes

- Audio: Deferred to post-MVP (noted for future)
- Mobile: Desktop-only for v1
- No upgrades system - focus on architecture not RPG mechanics

---

*This file should be updated with every significant change.*
