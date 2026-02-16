# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**tiny-stacks** is a 2D top-down microservices simulation game ("The Factorio of DevOps"). Players place services on a grid, connect them, and watch request packets flow through the system. It's a pure HTML/CSS/SVG Angular SPA with no backend — state is stored in LocalStorage.

AI long-term memory: `ai/project-context.md`

## Commands

```bash
bun start             # Dev server at localhost:4200
bun run build         # Production build → dist/
bun run test          # Unit tests (Vitest)
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
- **Vitest** for testing

## Architecture

### Source Structure
```
src/app/
├── core/
│   ├── challenges/
│   │   ├── challenge.model.ts          # Pure types (ChallengeDefinition, WinCondition, etc.)
│   │   ├── challenge-definitions.ts    # Challenge levels (pure data, JSON-serializable)
│   │   └── challenge.service.ts        # Runtime: load, evaluate, persist progress
│   ├── game/
│   │   ├── game-state.service.ts       # State (Signals) + undo/redo + persistence
│   │   ├── tick-engine.service.ts      # Tick-based simulation engine (60 tps)
│   │   ├── sim-types.ts                # SimRequest, TrafficPattern, ConnectionFilter
│   │   ├── service-types.config.ts     # Service definitions (types, sizes, colors, ports)
│   │   └── port-utils.ts              # Port position math & Bezier curves
│   └── storage/
│       └── storage.service.ts          # Typed localStorage wrapper
├── features/
│   ├── board/game-board.component.ts          # Board + drag-drop + toolbar
│   ├── challenges/
│   │   ├── challenges-page.component.ts       # Level selection grid
│   │   └── challenge-page.component.ts        # Individual challenge play view
│   ├── connections/connection-layer.component.ts  # SVG Bezier paths + packets
│   ├── home/home-page.component.ts            # Mode selection (Sandbox/Challenges)
│   ├── inspector/service-inspector.component.ts   # Service + connection inspector
│   ├── palette/service-palette.component.ts       # Service palette (filterable)
│   ├── sandbox/sandbox-page.component.ts      # Sandbox mode wrapper
│   └── services/service.component.ts          # Service tile + ports + drag-to-move
├── app.routes.ts                              # Routes: /, /sandbox, /challenges, /challenges/:id
└── app.ts                                     # Root: router-outlet
```

### State Management
`GameStateService` uses pure Angular Signals — no NgRx. Key signals: `services`, `connections`, `selectedServiceId`, `selectedConnectionId`, `draggingType`, `occupiedCells` (computed), `canUndo`/`canRedo` (computed). All mutations push undo snapshots. Auto-saves to localStorage via `StorageService` (typed wrapper with `StorageKeys` enum).

### Rendering
Pure DOM-based — no canvas or WebGL. Game board uses CSS background gradients for grid lines, absolutely-positioned divs for service tiles, SVG overlay for Bezier connection paths and animated packets. Services display Lucide icons and colored port dots (green=input, blue=output, orange=bidirectional).

## Code Conventions

**Always read `.cursor/rules/conventions/*` files before making code changes.** All Angular patterns, component structure, naming, and TypeScript rules are defined there.

## Workflow Requirements

1. **Before code changes**: Read `ai/project-context.md` and `.cursor/rules/conventions/*`
2. **After significant changes**: Run `bun run check` to confirm lint + format pass
3. **Before committing**: Present a summary of changed files with short descriptions and get approval
4. **Update `ai/project-context.md`** when making significant architectural changes

## Key References
- `ai/project-context.md` — current project status, todo list, and architectural notes
- `styles.scss` — CSS custom properties for the pastel color palette
