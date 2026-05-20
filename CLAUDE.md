# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Game Vision

**tiny-stacks** is a 2D top-down microservices simulation game ("The Factorio of DevOps"). Players place services on a grid, connect them, and watch request packets flow through the system. Pure HTML/CSS/SVG Angular SPA — no backend, state in LocalStorage.

**Core Loop:** Place → Connect → Watch → Optimize → Iterate

**Game Modes:**
- **Sandbox** (`/sandbox`) — unlimited creative building, no goals
- **Challenges** (`/challenges`) — progressive puzzles with 3-star rating and declarative win conditions

## Commands

```bash
bun start             # Dev server at localhost:4200
bun run build         # Production build → dist/
bun run test          # Integration tests (Vitest via Angular builder)
bun run lint          # Biome lint check
bun run format        # Biome format (auto-fix)
bun run check         # Biome lint + format check
bun run check:fix     # Biome lint + format auto-fix
```

Package manager is **Bun** — use `bun install`, not npm/yarn.

## Tech Stack

- **Angular 21** (Signals, standalone components, new control flow syntax)
- **TailwindCSS v4** (PostCSS-based)
- **Lucide Angular** for SVG icons
- **Biome** for linting/formatting (replaces ESLint + Prettier)
- **Vitest** for testing (via `@angular/build:unit-test`)

## Architecture

### Source Structure

```
src/app/
├── core/
│   ├── challenges/
│   │   ├── challenge.model.ts            # Pure types (ChallengeDefinition, WinCondition, etc.)
│   │   ├── challenge-definitions.ts      # Challenge levels (pure data, JSON-serializable)
│   │   ├── challenge.service.ts          # Runtime: load, evaluate, persist progress
│   │   ├── challenge-test-helpers.ts     # Shared test utilities (runTicks, mustFind, mustPlace)
│   │   └── challenge-level1.spec.ts      # Integration tests for level 1 star evaluation
│   ├── game/
│   │   ├── game-state.service.ts         # State (Signals) + undo/redo + persistence
│   │   ├── tick-engine.service.ts        # Tick-based simulation engine (60 tps)
│   │   ├── sim-types.ts                  # SimRequest, TrafficPattern, ConnectionFilter
│   │   ├── service-types.config.ts       # Service definitions (types, sizes, colors, ports)
│   │   └── port-utils.ts                 # Port position math & Bezier curves
│   └── storage/
│       └── storage.service.ts            # Typed localStorage wrapper
├── features/
│   ├── board/
│   │   ├── game-board.component.ts/.html # Board canvas: drag-drop, connections, packets
│   │   └── board-toolbar.component.ts/.html # Metrics, speed, undo/redo, play/pause
│   ├── challenges/
│   │   ├── challenges-page.component.ts  # Level selection grid
│   │   └── challenge-page.component.ts/.html # Challenge play view: HUD, briefing, objectives, toasts
│   ├── connections/
│   │   └── connection-layer.component.ts # SVG Bezier paths + animated packets
│   ├── home/home-page.component.ts       # Mode selection (Sandbox / Challenges)
│   ├── inspector/
│   │   ├── service-inspector.component.ts   # Thin host — renders service-panel or connection-panel
│   │   ├── service-panel.component.ts/.html # Selected service details + live stats
│   │   └── connection-panel.component.ts    # Selected connection filter UI
│   ├── palette/service-palette.component.ts # Service palette (availableResources limits)
│   ├── sandbox/sandbox-page.component.ts    # Sandbox mode wrapper
│   └── services/service.component.ts        # Service tile + ports + drag-to-move
├── app.routes.ts                            # Routes: /, /sandbox, /challenges, /challenges/:id
└── app.ts                                   # Root: router-outlet only
```

### State Management

`GameStateService` — pure Angular Signals, no NgRx.
- `services`, `connections`, `selectedServiceId`, `selectedConnectionId`, `draggingType`
- `occupiedCells`, `canUndo`, `canRedo` (computed)
- All mutations push undo snapshots (max 50). Auto-saves to localStorage via `effect()`.
- `StorageService` is a typed wrapper with `StorageKeys` enum.

### Simulation

All simulation logic lives in `tick-engine.service.ts` (60 tps, configurable 0.5×/1×/2×).

- **Request lifecycle:** Origin spawns → hop along connection (300ms) → queue at service → process → forward downstream or respond back upstream
- **Response paths:** Requests track `routeHistory` (connection IDs). At terminal services, direction flips to `'response'` — packets travel back in reverse, skipping queues.
- **Queue overflow:** Request fails when `queue + processing >= queueSize + maxConcurrency`. Triggers red pop animation.
- **Cache:** GET + cached resource = HIT (instant). GET + miss = forwards to DB and caches result. POST/PUT/DELETE invalidate the resource.
- **Metrics:** `throughput`, `avgLatency`, `totalCompleted`, `totalFailed` — calculated over a rolling 5s window using simulated time (`_simTimeMs`, not `performance.now()`, so tests are deterministic).
- **Testing:** `tickOnce(simDeltaMs)` drives the simulation synchronously. Shared helpers in `challenge-test-helpers.ts`.
- Types: `SimRequest`, `TrafficPattern`, `ConnectionFilter`, `CacheStats` in `sim-types.ts`.

### Connection System

- **Model:** `Connection { id, source: PortRef, target: PortRef, filter?: ConnectionFilter }`
- **Routing filters:** Per-connection method toggles (GET/POST/PUT/DELETE) + weight (1–100). Evaluated via `pickConnection()` in tick engine.
- **Port rules:** OUTPUT/BIDIRECTIONAL → INPUT/BIDIRECTIONAL only. No self-connections, no duplicates.
- **Rendering:** SVG Bezier curves (`ConnectionLayerComponent`), layered between grid and services.
- **Interaction:** mousedown on port → mousemove shows dashed preview → mouseup on target port creates connection.

### Challenge System

Defined in `challenge-definitions.ts` — pure data, JSON-serializable, no logic.

- Each star tier = a distinct player architectural choice (not auto-earned performance metrics)
- `pathExists` metric enforces correct topology: DFS over connection graph, requires `path: ServiceType[]`
- `availableResources: { type, count }[]` limits what the player can place (enforced by palette)
- `sustainMs` on a condition = must hold true continuously for that duration (resets on failure)
- Level N+1 unlocks when level N has ≥ 1 star
- Progress persisted to localStorage via `StorageKeys.CHALLENGE_PROGRESS`

**Challenge design rules:**
- Player verbs: **place** a service, **connect** two ports, **filter** a connection (per-method toggles)
- Every star rewards one of those three actions — never a raw metric the player can't control
- Stars are topology confirmations (`pathExists`) or direct consequences of correct topology (zero errors)

**9-level progression (3×3 grid):**

Row 1 — Learn the components (one new service per level):
| Level | Name | Given (locked) | Player places | Key move | Stars |
|-------|------|----------------|---------------|----------|-------|
| 1 | Hello Backend | Origin, REST, DB — no connections | — | Wire them up in order | origin→REST \| REST→DB \| zero errors 5s |
| 2 | Cache Layer | Origin, REST, DB — Origin→REST pre-drawn | 1 Cache | Insert Cache between REST and DB; remove direct bypass | REST→Cache \| Cache→DB \| no REST→DB bypass |
| 3 | Two Backends | Origin, REST₁, REST₂, DB — REST₁→DB + REST₂→DB pre-drawn | 1 Load Balancer | Place LB, route Origin through it to both REST instances | Origin→LB \| LB→REST₁ \| LB→REST₂ |

Row 2 — Learn routing (connection filters as core mechanic):
| Level | Name | Given (locked) | Player places | Key move | Stars |
|-------|------|----------------|---------------|----------|-------|
| 4 | Smart Routes | Origin, REST, DB, Cache — all placed, no connections | — | Route GETs through Cache, writes direct to DB; set filters on both | REST→Cache (GET-only filter) \| REST→DB (write-only filter) \| Cache→DB connected |
| 5 | Write Buffer | Origin, REST, DB — Origin→REST pre-drawn | 1 Message Queue | Buffer writes async through MQ; reads bypass it | REST→MQ connected \| REST→MQ filter (POST/PUT/DELETE) \| MQ→DB connected |
| 6 | The Gateway | Origin, REST, DB, Cache — REST→Cache→DB pre-drawn | 1 API Gateway | Insert GW at entry between Origin and REST | Origin→GW \| GW→REST \| full path works |

Row 3 — Combine two patterns:
| Level | Name | Given (locked) | Player places | Key move | Stars |
|-------|------|----------------|---------------|----------|-------|
| 7 | Scale + Cache | Origin, REST₁, REST₂, DB | 1 LB + 1 Cache | LB distributes across 2 REST; both share one Cache before DB | Origin→LB→REST₁ \| Origin→LB→REST₂ \| REST→Cache→DB |
| 8 | Two Paths | Origin, REST₁, REST₂, DB | 1 Cache + 1 MQ | Read path (REST₁→Cache→DB) + write path (REST₂→MQ→DB); filter origin connections to split traffic | origin→REST₁ read filter \| origin→REST₂ write filter \| both paths reach DB |
| 9 | Full Stack | Origin, DB | 1 GW + 1 LB + 2 REST + 1 Cache + 1 MQ | Build entire production architecture from scratch | GW at entry \| LB distributing to both REST \| Cache + MQ both in use reaching DB |

**Star quality model:**
Stars rate the quality of a solution, not steps toward it:
- ★1 = "it works" — a valid complete solution (even naive)
- ★2 = "it works cleanly" — the obvious shortcut or bypass is deliberately removed
- ★3 = "it works optimally" — the service is used to its full potential, proven under load
_(L1 is the tutorial exception — its stars are intentionally step-by-step to guide first-time players)_

**Expected UX sequences (actions → stars):**

Each entry shows the exact player action sequence for a full 3-star run. Use this as the reference during manual UX review.

> L1 — Hello Backend _(tutorial: step-by-step intentional)_
> 1. Drag REST Service onto grid
> 2. Connect Origin → REST Service ★ star 1
> 3. Drag Database onto grid
> 4. Connect REST Service → Database ★ star 2
> 5. Wait ~5s ★ star 3

> L2 — Cache Layer _(quality model: insert → commit → prove)_
> Initial state: Origin→REST and REST→DB pre-drawn (system works but slow)
> 1. Drag Cache onto grid
> 2. Connect REST → Cache, then Cache → Database ★ star 1 (cache path exists, bypass still present)
> 3. Click + delete the pre-drawn REST → Database connection ★ star 2 (committed to cache)
> 4. Wait ~10s ★ star 3 (zero errors with cache-only routing)

> L3 — Two Backends _(quality model: introduce → commit → prove)_
> Initial state: Origin→REST₁ and both REST→DB pre-drawn (single-path, unbalanced)
> 1. Drag Load Balancer onto grid
> 2. Connect Origin → LB, then LB → REST₁ ★ star 1 (LB path exists, bypass still present)
> 3. Click + delete the pre-drawn Origin → REST₁ connection ★ star 2 (all traffic through LB)
> 4. _(bonus: connect LB second output → REST₂ for actual distribution)_
> 5. Wait ~5s ★ star 3 (zero errors with LB-only routing)

> L4 — Smart Routes _(quality model: connect → filter reads → filter writes)_
> Initial state: Origin→REST pre-drawn; Cache and DB locked in place
> 1. Connect REST → Cache, Cache → Database, REST → Database (naive: all paths, no filters) ★ star 1
> 2. Click REST → Cache connection → set GET-only filter ★ star 2 (reads optimized)
> 3. Click REST → Database connection → set writes-only filter (POST/PUT/DELETE) ★ star 3 opportunity
> 4. Wait ~5s ★ star 3 (optimal routing + zero errors)

### Service Types

| Type | Size | Color | Behavior |
|------|------|-------|----------|
| Origin | 1×1 | #FF8B8B Coral | Traffic source — spawns requests at configurable req/s |
| API Gateway | 3×2 | #88D8D8 Teal | Entry point — low latency routing |
| REST Service | 2×2 | #87CEEB Sky | Business logic hub — main bottleneck at high load |
| Database | 3×3 | #D4A5FF Lavender | Slow + limited concurrency — the classic scaling problem |
| Cache | 2×1 | #A8E6CF Mint | Fast reads — HIT/MISS mechanics with resource-level invalidation |
| Message Queue | 2×3 | #FFCBA4 Peach | Async buffer — absorbs bursts, adds latency |
| Load Balancer | 2×2 | #FFE5A0 Gold | Distributes across downstream instances — enables horizontal scaling |

Port colors: Input `#22c55e` · Output `#3b82f6` · Bidirectional `#f97316`

Packet colors by method: GET `#87CEEB` · POST `#A8E6CF` · PUT `#FFE5A0` · DELETE `#FFCBA4`

## Code Conventions

Read `.cursor/rules/conventions/*` for the full coding standards (do not modify those files). Key rules:

- **Standalone components only**, `inject()` not constructor DI
- **New control flow** (`@if`, `@for`), not structural directives
- **Visibility:** `private` default, `protected` for template-accessed members, `public` rarely
- **Naming: type-first** — `card-user` not `user-card`
- **Templates:** `templateUrl` for components with 100+ lines of HTML; inline `template:` for smaller ones. Styles always inline.
- **Biome:** 4-space indent, 120 char line width, single quotes, trailing commas

## Workflow Requirements

1. **Before code changes**: Read this file and the relevant source files
2. **After changes**: Run `bun run check` to confirm lint + format pass
3. **Before committing**: Present a summary of changed files and get approval
4. **Update this file** when making significant architectural changes

## Periodic Maintenance

Do these at the end of a long session or every ~10 commits:

1. **Docs audit** — check `CLAUDE.md` for stale references (renamed APIs, removed fields, outdated file paths). Update anything that no longer matches the code.

2. **Component size review** — run `wc -l src/app/**/*.ts` and `wc -l src/app/**/*.html`. Flag any `.ts` file over ~400 lines (too much logic) or `.html` file over ~200 lines (too much UI). Consider extracting sub-components.

3. **Shared code extraction** — look for copy-pasted helpers, types, or logic across files. Common candidates: test helpers in spec files, repeated template blocks, utility functions.

## Visual Style

- 2D top-down grid (Shapez-like), 20×14 cells, 48px each
- Pastel colored service blocks, Lucide icons, subtle grid lines, soft shadows
- Glassmorphism panels (palette, inspector, overlays)
- `styles.scss` — TailwindCSS + CSS custom properties for the color palette

## Roadmap

### Next
1. Levels 2–9: implement per the 9-level progression table above
2. Service configuration editing (processing time, queue size per service)
3. Batch rendering at high throughput (one ball = N requests)
4. Responsive grid (zoom/pan)

### Future
- Cascading failure visualization (domino effect)
- Landing page with live demo
- Import/export sandbox layouts
- Service upgrades (Basic → Pro → Enterprise)
- Ambient audio (muted by default)
