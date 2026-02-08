# tiny-stacks - AI Project Context

> Long-Term Memory for AI assistants working on this project

---

## Project Status

**Phase:** Initial Scaffolding
**Milestone:** Hello World Scene
**Last Updated:** 2026-02-08

### Current Progress
- [x] Angular 21.1.0 initialized
- [x] TailwindCSS v4.1.18 configured
- [x] Three.js 0.182.0 installed
- [x] Lucide Angular icons installed
- [ ] GameEngineService created
- [ ] GameCanvasComponent created
- [ ] Hello World scene rendering

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
│   │       └── game-engine.service.ts  # Three.js scene management
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

---

## Todo List

### Immediate (Current Session)
1. Create `GameEngineService` with Three.js basics
2. Create `GameCanvasComponent`
3. Render Hello World: spinning pastel cube with rounded edges

### Next Up
4. Implement isometric orthographic camera
5. Add soft lighting with shadows (PCFSoftShadowMap)
6. Create ground plane
7. Apply clay-like MeshPhysicalMaterial

### Future
- Grid system
- Service palette UI
- Drag-drop placement
- Port-based connections
- Request packet animation

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
- Directional light: intensity ~1.0, casting soft shadows
- Ambient light: intensity ~0.4
- Shadow map: PCFSoftShadowMap

### Camera (Isometric)
```typescript
// Orthographic camera at isometric angle
// Rotation: 45° Y, 35.264° X (atan(1/√2))
camera.position.set(10, 10, 10);
camera.lookAt(0, 0, 0);
```

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
