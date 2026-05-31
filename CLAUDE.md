# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Game Vision

**tiny-stacks** is a 2D top-down microservices simulation game ("The Factorio of DevOps"). Players place services on a grid, connect them, and watch request packets flow through the system. Pure HTML/CSS/SVG Angular SPA — no backend, state in LocalStorage.

**Core Loop:** Place → Connect → Watch → Optimize → Iterate

**Game Modes:**
- **Tutorial** (`/tutorial`) — mandatory interactive walkthrough; teaches all 4 player verbs before Sandbox and Challenges unlock
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
│   │   ├── challenge-level1.spec.ts      # Integration tests — L1 Cache Layer
│   │   ├── challenge-level2.spec.ts      # Integration tests — L2 Two Backends
│   │   └── challenge-level3.spec.ts      # Integration tests — L3 Smart Routes
│   ├── tutorial/
│   │   ├── tutorial.model.ts             # TutorialStep type — title, description, hint, realWorldNote
│   │   ├── tutorial.service.ts           # Step sequencing (computed signals), board init, completion tracking
│   │   └── tutorial.spec.ts             # Integration tests for all 5 step detection signals
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
│   │   └── board-toolbar.component.ts/.html # Undo/redo
│   ├── challenges/
│   │   ├── challenges-page.component.ts  # Level selection grid
│   │   └── challenge-page.component.ts/.html # Challenge play view: HUD, briefing, objectives, toasts
│   ├── connections/
│   │   └── connection-layer.component.ts # SVG Bezier paths + animated packets
│   ├── home/home-page.component.ts       # Mode selection (Tutorial / Sandbox / Challenges); gates Sandbox+Challenges behind tutorial completion
│   ├── inspector/
│   │   ├── service-inspector.component.ts   # Thin host — renders service-panel or connection-panel
│   │   ├── service-panel.component.ts/.html # Selected service details + live stats
│   │   └── connection-panel.component.ts    # Selected connection route-rule UI
│   ├── palette/service-palette.component.ts # Service palette (availableResources limits)
│   ├── sandbox/sandbox-page.component.ts    # Sandbox mode wrapper
│   ├── services/service.component.ts        # Service tile + ports + drag-to-move
│   └── tutorial/
│       └── tutorial-page.component.ts/.html # Interactive tutorial: step-by-step guided board
├── app.routes.ts                            # Routes: /, /tutorial, /sandbox, /challenges, /challenges/:id
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
- **Message Queue:** Async ACK semantics — when a forward request finishes processing at an MQ, the original request begins its response immediately (producer unblocked). A separate fire-and-forget request is spawned to continue downstream. This models real queue decoupling: the producer doesn't wait for the consumer.
- **Metrics:** `throughput`, `avgLatency`, `totalCompleted`, `totalFailed` — calculated over a rolling 3s window using simulated time (`_simTimeMs`, not `performance.now()`, so tests are deterministic).
- **Testing:** `tickOnce(simDeltaMs)` drives the simulation synchronously. Shared helpers in `challenge-test-helpers.ts`.
- Types: `SimRequest`, `TrafficPattern`, `ConnectionFilter`, `CacheStats` in `sim-types.ts`.

### Connection System

- **Model:** `Connection { id, source: PortRef, target: PortRef, filter?: ConnectionFilter }`
- **Route rules:** Per-connection method toggles (GET/POST/PUT/DELETE) + weight (1–100). Evaluated via `pickConnection()` in tick engine. UI calls these "route rules" (not "filters") — the concept is that a configured route only carries traffic matching its rule, exactly as API gateways and service meshes work in production.
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
- Player verbs: **place** a service, **connect** two ports, **set a route rule** on a connection (per-method toggles)
- Each level defines exactly **3 solution topologies** of increasing quality. The player builds one; the system recognises which tier it is.
- Stars are **hierarchical**: `ChallengeService` checks ★3 conditions first, then ★2, then ★1. The highest matching tier wins. Building the ★3 topology automatically awards all 3 stars.
- Each star tier must require a **meaningfully different topology or configuration** from the tier below — never use `sustainMs` as the sole difference between two tiers.
- `availableResources` must include enough components to build any of the 3 topologies. The palette is the puzzle hint.

**Star quality model:**
- ★1 = "barely works" — correct components present, but naive wiring (missing the key architectural insight)
- ★2 = "works correctly" — the key insight applied: bypass removed, route rule set, or component used as intended
- ★3 = "works optimally" — the most sophisticated topology: all components at full purpose, method-level route rules applied

**9-level progression (3×3 grid):**

> L1 (Hello Backend) removed — its role as mechanic teacher is now the `/tutorial`.
> Cache Layer kept as the first challenge (L1): while the topology mirrors the tutorial, the
> star system adds route-rule filtering on top — a distinct puzzle. Old L3–L9 renumbered L2–L8.

Row 1 — Learn (place one component, then commit):
| # | Name | Pre-placed | Pre-drawn | Player places |
|---|------|------------|-----------|---------------|
| 1 ✅ | Cache Layer | Origin, REST, DB | Origin→REST, REST→DB | 1 Cache |
| 2 ✅ | Two Backends | Origin, REST₁, REST₂, DB | Origin→REST₁, REST₁→DB, REST₂→DB | 1 LB |
| 3 ✅ | Smart Routes | Origin, REST, Cache, DB | Origin→REST | — (connect + set route rules) |

Row 2 — Combine patterns:
| # | Name | Pre-placed | Pre-drawn | Player places |
|---|------|------------|-----------|---------------|
| 4 | Write Buffer | Origin, REST, DB | Origin→REST, REST→DB | 1 MQ |
| 5 | The Gateway | Origin, REST, DB | Origin→REST, REST→DB | 1 GW, 1 Cache |
| 6 | Scale + Cache | Origin, REST₁, REST₂, DB | REST₁→DB, REST₂→DB | 1 LB, 1 Cache |

Row 3 — Advanced:
| # | Name | Pre-placed | Pre-drawn | Player places |
|---|------|------------|-----------|---------------|
| 7 | Two Paths | Origin, REST₁, REST₂, DB | Origin→REST₁, Origin→REST₂ | 1 Cache, 1 MQ |
| 8 | Full Stack | Origin, DB | — | 1 GW, 1 LB, 2 REST, 1 Cache, 1 MQ |
| 9 | TBD | — | — | — |

**Per-level solution topologies:**

The system checks ★3 first; the first matching tier wins. ★2 and ★3 may be mutually exclusive topologies — that is fine; hierarchical evaluation handles it.

> **L1 — Cache Layer** ✅ *(implemented)*
> - ★1 "Cache in the pipeline": `pathExists([REST, Cache, DB])` + `pathExists([REST, DB])` direct bypass still present
> - ★2 "No direct DB access": `pathExists([REST, Cache, DB])` + `pathNotExists([REST, DB])`
> - ★3 "Smart read/write routing": `filteredPathExists([REST, Cache], [GET])` + `filteredPathExists([REST, DB], [POST,PUT,DELETE])`

> **L2 — Two Backends** ✅ *(implemented)*
> - ★1 "Load Balancer connected": `pathExists([Origin, LB, REST, DB])` + `pathExists([Origin, REST])` bypass still present
> - ★2 "Traffic centralized": `pathExists([Origin, LB, REST, DB])` + `pathNotExists([Origin, REST])`
> - ★3 "True load distribution": `pathExists([Origin, LB, REST, DB]) >= 2` + `pathNotExists([Origin, REST])`

> **L3 — Smart Routes** ✅ *(implemented)*
> - ★1 "Both paths wired": `pathExists([REST, Cache, DB])` + `pathExists([REST, DB])`
> - ★2 "Reads routed to cache": `filteredPathExists([REST, Cache], [GET])` + `pathExists([REST, DB])`
> - ★3 "Traffic fully separated": `filteredPathExists([REST, Cache], [GET])` + `filteredPathExists([REST, DB], [POST,PUT,DELETE])`

> **L4 — Write Buffer**
> Pre-drawn REST→DB ensures reads always reach DB; the puzzle is about writes.
> - ★1 "Queue connected": `pathExists([REST, MQ, DB])` — MQ in path, no route rule (reads + writes flow through it)
> - ★2 "Writes buffered": `pathExists([REST, MQ, DB])` + `filteredPathExists([REST, MQ], [POST,PUT,DELETE])`
> - ★3 "Hard read/write separation": `filteredPathExists([REST, MQ], [POST,PUT,DELETE])` + `filteredPathExists([REST, DB], [GET])`

> **L5 — The Gateway**
> Pre-drawn REST→DB ensures the system works before GW is inserted. Player can also add Cache for ★3.
> - ★1 "Gateway online": `pathExists([Origin, GW, REST])` + `pathExists([Origin, REST])` direct — bypass still present
> - ★2 "Single entry point": `pathExists([Origin, GW, REST])` + `pathNotExists([Origin, REST])`
> - ★3 "Gateway + cache": ★2 + `pathExists([REST, Cache, DB])`

> **L6 — Scale + Cache**
> Pre-drawn REST₁→DB and REST₂→DB handle writes. Player adds LB + Cache for reads.
> - ★1 "Scaling with cache": `pathExists([Origin, LB, REST, Cache, DB])` — LB and Cache in use, one backend
> - ★2 "Both backends cached": `pathExists([LB, REST₁, Cache, DB])` + `pathExists([LB, REST₂, Cache, DB])`
> - ★3 "Cache GET-only": ★2 + `filteredPathExists([REST, Cache], [GET])`

> **L7 — Two Paths**
> Pre-drawn Origin→REST₁ and Origin→REST₂ are unruled; the puzzle is building and then ruling both paths.
> - ★1 "Both paths built": `pathExists([REST₁, Cache, DB])` + `pathExists([REST₂, MQ, DB])`
> - ★2 "Origin traffic split": ★1 + `filteredPathExists([Origin, REST₁], [GET])` + `filteredPathExists([Origin, REST₂], [POST,PUT,DELETE])`
> - ★3 "Double-ruled": ★2 + `filteredPathExists([REST₁, Cache], [GET])` + `filteredPathExists([REST₂, MQ], [POST,PUT,DELETE])`

> **L8 — Full Stack**
> - ★1 "Full pipeline": `pathExists([Origin, GW, LB, REST, DB]) >= 1` — GW and LB present, at least one direct path to DB
> - ★2 "Both backends + optimisation": `pathExists([Origin, GW, LB, REST]) >= 2` + `pathExists([REST, Cache, DB])` — two backends through LB, Cache in use (REST may route through Cache/MQ, not directly to DB)
> - ★3 "Production ready": ★2 conditions + `pathExists([REST, MQ, DB])` — Cache AND MQ both in use

> **L9** — TBD (design pending)

### Tutorial System

Interactive, step-by-step introduction to all 4 player verbs. Uses the Cache Layer topology as its teaching scenario (same as old Challenge 2 — the simplest setup that requires every mechanic).

**Steps (in order — each step is auto-detected from game state; the panel advances when the condition becomes true):**
1. **Place** — drag the Cache service from the palette onto the grid
2. **Connect** — draw a connection from REST output → Cache input
3. **Connect** — draw a connection from Cache output → DB input
4. **Disconnect** — remove the existing REST → DB connection (click it, press Delete)
5. **Route rule** — click REST → Cache connection, set method filter to GET only in the panel

**Mechanic:** A fixed step panel (top-right) shows the current step title, description, hint, and a real-world note. Progress dots track completion. All other interactions remain possible — no hard locks. Step detection is purely computed from `GameStateService` signals (no tick engine needed).

**Completion:** Brief celebration overlay, then routes to home with Sandbox and Challenges unlocked. Progress stored in `StorageKeys.TUTORIAL_COMPLETE`.

**Home page gating:** If `TUTORIAL_COMPLETE` is not set, Sandbox and Challenges cards are shown as locked with a "Complete the tutorial first" tooltip. The Tutorial card is always accessible.

### Insight Pills

A two-layer contextual learning system. Surfaces real-world concepts at the moment they're relevant — never interrupts flow.

**Layer 1 — Inspector "About" section**
When any service or connection is selected, a collapsed "About" section appears below the live stats panel. Always available, zero friction.
- For services: real-world name, canonical examples (Redis, RabbitMQ, nginx/Envoy), one-line concept
- For connections with a route rule active: "This is how API gateways route traffic — nginx, Envoy, and Kong all work this way"

**Layer 2 — Discovery toasts**
First-time pattern recognition triggers a brief toast (3s, dismissible). Only fires once per pattern per player session (tracked in localStorage via `InsightService`).

Trigger examples:
- First cache HIT → explain hit rate and why it matters at scale
- Queue overflow → "This is backpressure — your DB can't keep up with write load"
- Completing a recognizable pattern (read-through cache, pub-sub, load-balanced cluster) → name the pattern + one real-world context sentence
- First route rule set → "Route rules like this power API gateways — Netflix's Zuul routes millions of requests this way"

**Content lives in** `core/insights/insight-definitions.ts` — pure data, keyed by trigger ID. `InsightService` evaluates triggers from game events and emits new `InsightDefinition` objects to subscribers.

**Categories:** `service` · `pattern` · `mechanic` · `failure`

### Service Types

| Type | Size | Color | Behavior |
|------|------|-------|----------|
| Origin | 2×2 | #FF8B8B Coral | Traffic source — spawns requests at configurable req/s; tile displays the rps count |
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
1. **Challenges L4–L8** — implement Write Buffer, The Gateway, Scale+Cache, Two Paths, Full Stack per the topologies above; add spec files for each
2. **Insight Pills** — Inspector "About" section + discovery toasts; `InsightService` + `insight-definitions.ts` in `core/insights/`
3. Service configuration editing (processing time, queue size per service)
4. Batch rendering at high throughput (one ball = N requests)

### Simulation Engine Improvements
- **Load Balancer routing strategies** — currently LB uses the same weighted-random `pickConnection()` as all services. Add LB-specific algorithms (round-robin, least-connections) so players can learn the difference. Low priority since current challenges test LB *topology*, not algorithm.
- **`filteredPathExists` multi-hop support** — `resolveFilteredPathExists` in `challenge.service.ts` only checks the first hop's filter. Extend to verify filters along an entire path chain if future challenges need it.
- **Immutable tick processing** — `SimRequest` objects are mutated in place during `processSimulation`. No bug (ticks are synchronous), but prevents replay/serialization of mid-tick state. Revisit if adding time-travel debugging or multiplayer.
- **Queue sync optimization** — `requests.includes(r)` in runtime state cleanup is O(n×m). Replace with a Set-based lookup if request volume grows past ~200 active requests.

### Future
- Responsive grid (zoom/pan)
- Cascading failure visualization (domino effect)
- Landing page with live demo
- Import/export sandbox layouts
- Service upgrades (Basic → Pro → Enterprise)
- Ambient audio (muted by default)
