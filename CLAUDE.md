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

- `pathExists` metric: DFS over connection graph — checks that an ordered sequence of service types is reachable hop by hop
- `pathNotExists`: inverse — the sequence must NOT be reachable
- `filteredPathExists`: like `pathExists` for a single hop, but also requires the connection's `filter.methods` to match `requiredMethods` exactly
- `availableResources: { type, count }[]` limits what the player can place (enforced by palette); must cover all components needed for any of the 3 solution topologies, not just the optimal one
- `sustainMs`: only valid when a condition genuinely must hold over time — never the sole differentiator between two star tiers
- Level N+1 unlocks when level N has ≥ 1 star
- Progress persisted to localStorage via `StorageKeys.CHALLENGE_PROGRESS`

**Challenge design rules:**
- Player verbs: **place** a service, **connect** two ports, **filter** a connection (per-method toggles)
- Each level defines exactly **3 solution topologies** of increasing quality. The player builds one; the system recognises which tier it is.
- Stars are **hierarchical**: `ChallengeService` checks ★3 conditions first, then ★2, then ★1. The highest matching tier wins. Building the ★3 topology automatically awards all 3 stars.
- Each star tier must require a **meaningfully different topology or configuration** from the tier below — never use `sustainMs` as the sole difference between two tiers.
- `availableResources` must include enough components to build any of the 3 topologies. The palette is the puzzle hint.

**Star quality model:**
- ★1 = "barely works" — correct components present, but naive wiring (missing the key architectural insight)
- ★2 = "works correctly" — the key insight applied: bypass removed, filter set, or component used as intended
- ★3 = "works optimally" — the most sophisticated topology: all components at full purpose, method-level filters applied
_(L1 is the tutorial exception: stars are step-by-step to teach the UI, not to model solution quality)_

**9-level progression (3×3 grid):**

Row 1 — Learn the components:
| # | Name | Locked | Pre-drawn | Player places |
|---|------|--------|-----------|---------------|
| 1 | Hello Backend | Origin | — | 1 REST, 1 DB |
| 2 | Cache Layer | Origin, REST, DB | Origin→REST, REST→DB | 1 Cache |
| 3 | Two Backends | Origin, REST₁, REST₂, DB | Origin→REST₁, REST₁→DB, REST₂→DB | 1 LB |

Row 2 — Learn routing (filters as core mechanic):
| # | Name | Locked | Pre-drawn | Player places |
|---|------|--------|-----------|---------------|
| 4 | Smart Routes | Origin, REST, Cache, DB | Origin→REST | — (connect + filter) |
| 5 | Write Buffer | Origin, REST, DB | Origin→REST, REST→DB | 1 MQ |
| 6 | The Gateway | Origin, REST, DB | Origin→REST, REST→DB | 1 GW, 1 Cache |

Row 3 — Combine two patterns:
| # | Name | Locked | Pre-drawn | Player places |
|---|------|--------|-----------|---------------|
| 7 | Scale + Cache | Origin, REST₁, REST₂, DB | REST₁→DB, REST₂→DB | 1 LB, 1 Cache |
| 8 | Two Paths | Origin, REST₁, REST₂, DB | Origin→REST₁, Origin→REST₂ | 1 Cache, 1 MQ |
| 9 | Full Stack | Origin, DB | — | 1 GW, 1 LB, 2 REST, 1 Cache, 1 MQ |

**Per-level solution topologies:**

The system checks ★3 first; the first matching tier wins. ★2 and ★3 may be mutually exclusive topologies — that is fine; hierarchical evaluation handles it.

> **L1 — Hello Backend** *(tutorial exception: step-by-step UI introduction)*
> - ★1: `pathExists([Origin, REST])`
> - ★2: `pathExists([Origin, REST, DB])`
> - ★3: ★2 + `errorRate = 0` *(only level allowed to use a time-based condition as the ★3 differentiator)*

> **L2 — Cache Layer**
> - ★1: `pathExists([REST, Cache, DB])` + `pathExists([REST, DB])` — cache added in parallel, bypass still present
> - ★2: `pathExists([REST, Cache, DB])` + `pathNotExists([REST, DB])` — bypass removed, all traffic through cache (even writes, suboptimally)
> - ★3: `filteredPathExists([REST, Cache], [GET])` + `filteredPathExists([REST, DB], [POST,PUT,DELETE])` — reads cached, writes skip the cache entirely
> *(★2 removes REST→DB; ★3 reintroduces it with a write filter — mutually exclusive topologies)*

> **L3 — Two Backends**
> - ★1: `pathExists([Origin, LB, REST, DB])` + `pathExists([Origin, REST])` direct — LB introduced, bypass still exists
> - ★2: `pathExists([Origin, LB, REST, DB])` + `pathNotExists([Origin, REST])` — all traffic through LB, bypass removed (may route to one REST only)
> - ★3: `pathExists([LB, REST₁, DB])` + `pathExists([LB, REST₂, DB])` + `pathNotExists([Origin, REST])` — true distribution, both backends receiving traffic

> **L4 — Smart Routes**
> - ★1: `pathExists([REST, Cache, DB])` + `pathExists([REST, DB])` — both paths wired, no filters
> - ★2: `filteredPathExists([REST, Cache], [GET])` + `pathExists([REST, DB])` — reads filtered through cache
> - ★3: `filteredPathExists([REST, Cache], [GET])` + `filteredPathExists([REST, DB], [POST,PUT,DELETE])` — both paths fully filtered

> **L5 — Write Buffer**
> Pre-drawn REST→DB ensures reads always reach DB; the puzzle is about writes.
> - ★1: `pathExists([REST, MQ, DB])` — MQ in path, no filter (reads + writes both flow through it)
> - ★2: `pathExists([REST, MQ, DB])` + `filteredPathExists([REST, MQ], [POST,PUT,DELETE])` — writes buffered; reads still go via REST→DB (pre-drawn, unfiltered)
> - ★3: `filteredPathExists([REST, MQ], [POST,PUT,DELETE])` + `filteredPathExists([REST, DB], [GET])` — hard separation: writes only through MQ, reads only through DB

> **L6 — The Gateway**
> Pre-drawn REST→DB ensures the system works before GW is inserted. Player can also add Cache for ★3.
> - ★1: `pathExists([Origin, GW, REST])` + `pathExists([Origin, REST])` direct — GW inserted but bypass still present
> - ★2: `pathExists([Origin, GW, REST])` + `pathNotExists([Origin, REST])` — all traffic through GW, bypass removed
> - ★3: ★2 + `pathExists([REST, Cache, DB])` — GW as sole entry AND Cache on the read path

> **L7 — Scale + Cache**
> Pre-drawn REST₁→DB and REST₂→DB handle writes. Player adds LB + Cache for reads.
> - ★1: `pathExists([Origin, LB, REST, Cache, DB])` — LB and Cache both in use, but only one REST connected to LB
> - ★2: `pathExists([LB, REST₁, Cache, DB])` + `pathExists([LB, REST₂, Cache, DB])` — both REST instances through shared Cache
> - ★3: ★2 + `filteredPathExists([REST, Cache], [GET])` — Cache is GET-only; writes fall through to pre-drawn REST→DB

> **L8 — Two Paths**
> Pre-drawn Origin→REST₁ and Origin→REST₂ are unfiltered; the puzzle is building and then filtering both paths.
> - ★1: `pathExists([REST₁, Cache, DB])` + `pathExists([REST₂, MQ, DB])` — both paths built, no filtering anywhere
> - ★2: ★1 + `filteredPathExists([Origin, REST₁], [GET])` + `filteredPathExists([Origin, REST₂], [POST,PUT,DELETE])` — origin traffic split at source
> - ★3: ★2 + `filteredPathExists([REST₁, Cache], [GET])` + `filteredPathExists([REST₂, MQ], [POST,PUT,DELETE])` — double filtering: origin and service level both set

> **L9 — Full Stack**
> - ★1: `pathExists([Origin, GW, LB, REST, DB])` — GW and LB both present, complete path
> - ★2: ★1 + `pathExists([LB, REST₁, DB])` + `pathExists([LB, REST₂, DB])` + one of `pathExists([REST, Cache, DB])` or `pathExists([REST, MQ, DB])` — both backends active, at least one optimisation layer
> - ★3: ★2 + both `pathExists([REST, Cache, DB])` AND `pathExists([REST, MQ, DB])` — full production architecture: Cache and MQ both in use

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
