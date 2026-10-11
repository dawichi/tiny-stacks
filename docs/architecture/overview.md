# Architecture Overview

tiny-stacks is a browser-only Angular game. Vercel serves the built frontend; the application has no backend API, account system, or server-side game state. The game graph, simulation, and progress run in the player's browser.

## Routes and modes

| Route | Mode | State behavior |
|-------|------|----------------|
| `/` | Home | Links to the optional tutorial, Sandbox, and Challenges. |
| `/tutorial` | Tutorial | Loads its guided board; completion is stored locally. |
| `/sandbox` | Sandbox | Loads an editable example or the player's saved board and Origin rates. |
| `/challenges` | Challenge list | Shows eight progressively unlocked levels. |
| `/challenges/:id` | Challenge | Loads a challenge-owned board; deploy locks editing and scores the scripted run. |

Tutorial is recommended and optional. Sandbox and the first Challenge are available without completing it.

## Application boundaries

- `src/app/core/game/` owns board rules, the simulation model, tick engine, service configuration, routing, and metrics.
- `src/app/core/storage/` owns typed local-storage access and validation of values read from storage.
- `src/app/core/challenges/` owns challenge definitions, board setup, topology evaluation, deploy scoring, and progress.
- `src/app/core/tutorial/` owns tutorial steps and completion state.
- `src/app/features/` contains routed screens and UI components grouped by feature.
- `src/app/app.routes.ts` defines the public routes.

`Simulation` is framework-independent. Angular services own the interactive board and coordinate game modes around it. See [Simulation Model](simulation.md) for request, time, and metrics behavior.

## State and persistence

`GameStateService` owns the active board and undo/redo history. Loading a mode replaces the board and resets history. Challenge boards also identify pre-placed services that cannot be moved or deleted; connections remain editable.

`StorageService` writes only app-owned keys in origin-scoped `localStorage`:

| Key | Owner | Contents |
|-----|-------|----------|
| `tiny-stacks-state` | Sandbox | Versioned board and per-Origin requests-per-second rates. |
| `tiny-stacks-challenge-progress` | Challenges | Stars and best recorded deployment metrics by challenge. |
| `tiny-stacks-tutorial-complete` | Tutorial | Completion flag. |

Sandbox board state has a version number. `sanitizeSandboxState` accepts the current shape and the legacy unversioned shape, drops unknown versions, and sanitizes services, connections, filters, and traffic rates. Challenge progress is separately sanitized. `StorageService.clearAll()` removes only these three keys; it leaves unrelated storage on the same origin alone.

The player owns this browser data. It is not synchronized to a server or backed up by the project. Clearing browser storage or switching browsers can remove progress.

## Trust boundaries

- The public browser bundle contains no application secrets and performs no authenticated server operations.
- Browser storage is runtime-controlled input. JSON parsing alone does not validate it; storage schemas must remain in place.
- GitHub stores the source repository and runs CI. Vercel builds and serves the public frontend through its Git integration.
- Vercel account credentials and project settings are managed externally and must not be copied into this repository.

## Current design rationale

- A plain TypeScript simulation separates request behavior from Angular rendering and lets tests advance simulated time directly.
- Sandbox-owned board persistence prevents Tutorial and Challenges from overwriting a player's sandbox.
- Challenge definitions are data-driven, and seeded runs make retries repeatable.

These are current implementation choices documented in the code and project README. Create an ADR when a future change needs an explicit decision record with supported alternatives and consequences.
