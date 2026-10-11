# tiny-stacks

Guidance for working in this repository. The project is a browser-only Angular game for building microservice graphs and simulating HTTP traffic through them.

## Game modes

- **Tutorial** (`/tutorial`) — optional, recommended interactive walkthrough. Sandbox and Challenges are available without completing it.
- **Sandbox** (`/sandbox`) — open board, saved locally, with a prebuilt example and live traffic controls.
- **Challenges** (`/challenges`, `/challenges/:id`) — eight progressive build/deploy scenarios. Later levels unlock after earning a star in the previous level.

The main loop is place services, connect ports, watch traffic, and improve the design with route rules.

## Commands

```sh
bun start             # Development server at localhost:4200
bun run build         # Production build to dist/
bun run test          # Existing Vitest suite via Angular's unit-test builder
bun run lint          # Biome lint
bun run format        # Biome format and write
bun run check         # Biome lint and format checks
```

Use Bun (`bun.lock`), not npm or yarn. The expected Bun version is in `package.json`.

## Tech stack

- Angular 21, standalone components, Signals, and the new control-flow syntax
- TailwindCSS v4 through PostCSS
- Lucide Angular icons
- Biome for linting and formatting
- Vitest through the Angular build system

## Source map

```text
src/app/
├── core/
│   ├── challenges/
│   │   ├── challenge.model.ts          # Challenge, topology, threshold, result, progress types
│   │   ├── challenge-conditions.ts     # Data helpers for declarative level definitions
│   │   ├── challenge-definitions.ts    # Eight levels: boards, traffic, rules, thresholds
│   │   ├── challenge-evaluation.ts     # Setup boards, match topology, score deployment runs
│   │   ├── challenge-fixtures.ts       # Reference board edits and deterministic deploy helper
│   │   └── challenge.service.ts        # Build/deploy/results lifecycle and saved progress
│   ├── game/
│   │   ├── game-state.service.ts       # Shared board signals, placement rules, undo/redo
│   │   ├── simulation.ts               # Plain TypeScript request and service simulation
│   │   ├── tick-engine.service.ts      # 60-tick Angular timer, run controls, published snapshots
│   │   ├── sim-types.ts                # Requests, traffic patterns, metrics, and run types
│   │   ├── sim-metrics.ts              # Rolling live metrics and per-deploy summaries
│   │   ├── sim-random.ts               # Seeded pseudo-random generator
│   │   ├── service-types.config.ts     # Service geometry, ports, capacity, TTL, and costs
│   │   └── port-utils.ts               # Port positions and connection curves
│   ├── storage/
│   │   ├── storage.service.ts          # Typed localStorage wrapper and versioned sandbox shape
│   │   └── storage-schema.ts           # Validation and migration of saved boards/progress
│   └── tutorial/
│       ├── tutorial.model.ts           # Five tutorial steps and copy
│       └── tutorial.service.ts         # Guided board and step completion signals
├── features/
│   ├── board/                          # Grid, toolbar, drag/drop, connections, packet rendering
│   ├── challenges/                     # Challenge list and Build/Deploy/Results UI
│   ├── connections/                    # SVG connection layer
│   ├── home/                           # Optional tutorial and immediately available modes
│   ├── inspector/                      # Selected service/connection details and route rules
│   ├── palette/                        # Service palette with challenge resource limits
│   ├── sandbox/                        # Sandbox lifecycle, example board, metrics, persistence
│   ├── screen-guard/                   # Minimum viewport notice
│   ├── services/                       # Service tiles, ports, and live state
│   ├── settings/                       # Local progress reset
│   └── tutorial/                       # Walkthrough screen and completion panel
├── app.routes.ts
└── app.ts
```

See [`docs/challenges.md`](docs/challenges.md) for the level map and thresholds, and [`docs/ui-zones.md`](docs/ui-zones.md) for fixed screen positions.

## State and persistence

`GameStateService` owns the shared board and undo/redo history. Loading a mode replaces the board and resets history, so undo cannot return to another mode or remove a locked service. Board mutations are rejected while a challenge deploy is running.

The Sandbox owns persistence. It loads and saves a versioned board and per-Origin traffic rates. `storage-schema.ts` validates service types, placement, connections, filters, rates, and challenge progress before use. Tutorial and Challenges never write the Sandbox board.

`StorageService.clearAll()` removes only keys owned by this app.

## Simulation behavior

`Simulation` is framework-free. `TickEngineService` advances it at 60 ticks per second and publishes immutable signal snapshots. Speed control is 1×, 2×, or 4×. Challenge traffic uses named phases and scheduled outages; each level uses a stable seed, and deployment summaries are measured independently of the live rolling metrics.

- Requests travel through the service graph, enter service queues, and return on the reverse route.
- If a service has downstream connections but none accepts a request method, that request fails. REST and Database
  services with no downstream connection are terminal and answer; a Cache miss without a backing route fails.
- Cache entries expire after the configured TTL. Writes invalidate matching entries in upstream Caches connected to the same Database.
- Message Queues acknowledge writes and deliver them asynchronously. GET requests reaching a queue fail because the queue cannot return data.
- Load Balancers select the least busy healthy target. Other services choose among eligible outgoing connections by route weight.
- Service and database-operation costs contribute to live metrics and challenge results.

## Challenge rules

Challenge definitions contain a starting board, scripted traffic, optional outages, palette limits, topology conditions, and deploy metric thresholds. A star requires its tier's full topology and all metric thresholds. Scoring checks from the highest tier down; earning a higher tier grants the lower stars as well. Challenges remain progressively locked, but the Tutorial is not a prerequisite.

Pre-placed services are locked in both the Tutorial and Challenges. Connections can be edited. During Deploy, the board is read-only; results offer retry or a return to building.

## Code conventions

Read `.cursor/rules/conventions/*` for the repository's complete style rules; do not edit those files. Key conventions:

- Standalone Angular components and `inject()`
- Signals for reactive state; `protected` for template members and `private` by default
- `@if` / `@for` instead of structural directives
- 4-space indentation, single quotes, trailing commas, and Biome formatting
- Keep simulation logic out of Angular components

## Workflow

Use `bun run check` and `bun run build` before handing off a code change. Do not push changes to GitHub unless the user asks. No deployment configuration is present in this repository.

## Visual style

A 20×14 grid with 48px cells, pastel service tiles, SVG connections and packets, glass-style panels, and Lucide icons. Keep motion subtle and respect reduced-motion preferences when adding animations.
