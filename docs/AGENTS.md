# tiny-stacks Agent Instructions

This is the canonical project-specific instruction file for AI agents working in this repository.

## Read first

1. Read the root [README](../README.md) for the product and local quick start.
2. Read the [documentation index](README.md) and [standards contract](project-standards.yml).
3. Read the architecture, gameplay, design, or operations documents related to the change.
4. Check the [work queue](work/TODO.md) for unfinished work.
5. Inspect the relevant code and configuration before changing behavior.

## Sources of truth

- Public purpose, player-facing modes, and quick start: root [README](../README.md).
- Current architecture, state ownership, and trust boundaries: [architecture overview](architecture/overview.md).
- Simulation behavior: [simulation model](architecture/simulation.md) and `src/app/core/game/`.
- Challenge definitions and scoring: `src/app/core/challenges/challenge-definitions.ts` and `challenge-evaluation.ts`; the [challenge guide](gameplay/challenges.md) is the human-readable calibration reference.
- Fixed game-screen layout: [UI layout map](design/ui-layout.md).
- Local development, CI, Vercel deployment, and recovery: [deployment guide](operations/deployment.md).
- Unfinished work: [work queue](work/TODO.md).
- Effective shared engineering guidance and assessed compliance: [standards contract](project-standards.yml), pinned to the revision recorded there.
- Selected standards: documentation, testing, TypeScript, security, dependencies, CI/CD, operations, data, styling, and web quality; selected profile: Angular application. The contract assesses every rule in the pinned revision and records accepted limitations and exceptions. Put actionable unfinished work in the work queue.
- Implementation is authoritative for current behavior. Update the relevant documentation when behavior or architecture changes.

## Working rules

- Keep the app browser-only unless the user approves a product and architecture change. It has no backend API or account system.
- Treat local storage as untrusted input. Preserve validation in `src/app/core/storage/storage-schema.ts` when changing persisted state.
- Keep simulation rules in the framework-independent core, separate from Angular view components.
- Use Bun and the committed lockfile. Follow current Angular, TypeScript, and Biome patterns in the repository.
- Do not recreate the removed `.cursor/` rules. The standards contract and these project instructions are the shared guidance.
- Keep one source of truth per topic. Update this index when maintained documentation moves or is added.
- Use `docs/work/TODO.md` for unfinished implementation, review, and standards work. Record new discoveries there if they are not resolved in the current session.
- Create an ADR when a consequential project decision needs durable context and trade-offs. Do not use ADRs for temporary tasks or status updates.

## Validation commands

| Purpose | Command |
|---------|---------|
| Install dependencies | `bun install --frozen-lockfile` |
| Run locally | `bun start` |
| Type-check app and test TypeScript | `bun run typecheck` |
| Lint and format check | `bun run check` |
| Production build | `bun run build` |
| Unit tests | `bun run test` |
| Dependency audit | `bun audit` |

GitHub Actions runs the locked install, `bun run typecheck`, `bun run check`, `bun audit --audit-level=critical`, `bun run test`, and `bun run build`. It also runs weekly. Dependency alerts, the severity policy, and the direct-to-production exception are documented in [operations](operations/deployment.md) and the [security response guide](operations/dependency-security.md).

## Safe change boundaries

- A push to `main` triggers the Vercel production deployment. Do not push, roll back, or otherwise change production unless the user explicitly asks.
- Vercel project settings and Git integration are managed outside this repository; `vercel.json` pins the dependency install to Bun `1.3.4`. Do not invent or commit environment values or credentials.
- There is no server-side user data to back up. Sandbox state and progress live in the player's browser storage.
- Do not add authentication, a backend, telemetry, or new external services without an explicit product decision.
