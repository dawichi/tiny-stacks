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

## Architecture

### Tech Stack
- **Angular 21** (Signals, standalone components, new control flow syntax)
- **TailwindCSS v4** (PostCSS-based)
- **Lucide Angular** for SVG icons
- **Biome** for linting/formatting (replaces ESLint + Prettier)
- **Vitest** for testing

### Source Structure
```
src/app/
├── core/
│   ├── game/
│   │   ├── game-state.service.ts    # State (Signals) + undo/redo + persistence
│   │   ├── tick-engine.service.ts   # Tick-based simulation engine (60 tps)
│   │   ├── sim-types.ts             # SimRequest, TrafficPattern, ServiceRuntimeState
│   │   ├── service-types.config.ts  # Service definitions (types, sizes, colors, ports)
│   │   └── port-utils.ts            # Port position math & Bezier curves
│   └── storage/
│       └── storage.service.ts       # Typed localStorage wrapper
├── features/
│   ├── board/game-board.component.ts       # Board + drag-drop + toolbar (undo/redo, play/pause)
│   ├── connections/connection-layer.component.ts  # SVG Bezier paths + packets
│   ├── inspector/service-inspector.component.ts   # Right-side detail panel
│   ├── palette/service-palette.component.ts       # Bottom-left service palette
│   └── services/service.component.ts              # Service tile + ports + drag-to-move
└── app.ts                                         # Root component
```

### State Management
`GameStateService` uses pure Angular Signals — no NgRx. Key signals: `services`, `connections`, `selectedServiceId`, `selectedConnectionId`, `draggingType`, `occupiedCells` (computed), `canUndo`/`canRedo` (computed). All mutations push undo snapshots. Auto-saves to localStorage via `StorageService` (typed wrapper with `StorageKeys` enum).

### Rendering
Pure DOM-based — no canvas or WebGL. Game board uses CSS background gradients for grid lines, absolutely-positioned divs for service tiles, SVG overlay for Bezier connection paths and animated packets. Services display Lucide icons and colored port dots (green=input, blue=output, orange=bidirectional).

## Code Conventions

**Always read `.cursor/rules/conventions/*` files before making code changes.**

### Angular Patterns
- **All components must be standalone** (`standalone: true`)
- **Use `inject()` function**, not constructor injection
- **Use new control flow**: `@if`, `@for`, `@switch` — never `*ngIf`/`*ngFor`
- **Use Angular Signals** for reactive state (`signal()`, `computed()`)
- **Explicit visibility modifiers on all properties**: `private` (default) → `protected` (template access) → `public` (rare)

### Component Structure
Organize component classes with section separators:
```
Injected Services → Inputs → Outputs → Properties → Lifecycle → Public Methods → Private Methods
```

### Naming
- **File names**: kebab-case (`game-board.component.ts`)
- **Classes**: PascalCase (`GameBoardComponent`)
- **Selectors**: `app-` prefix, kebab-case (`app-game-board`)
- **Component type before specificity**: `card-user` not `user-card`

### TypeScript
- Strict mode enabled — avoid `any` (add `TODO` comment if unavoidable)
- Inline styles use SCSS (configured in `angular.json`)

### Biome Formatting Rules
- 4-space indent, 120-char line width
- Single quotes, trailing commas, semicolons always
- HTML files excluded from Biome (handled by Angular)

## Workflow Requirements

1. **Before code changes**: Read `ai/project-context.md` and `.cursor/rules/conventions/*`
2. **After significant changes**: Run `bun run check` to confirm lint + format pass
3. **Before committing**: Present a summary of changed files with short descriptions and get approval
4. **Update `ai/project-context.md`** when making significant architectural changes

## Key References
- `ai/project-context.md` — current project status, todo list, and architectural notes
- `styles.scss` — CSS custom properties for the pastel color palette
