# Unfinished Work

The repository-local queue is authoritative for unfinished work unless a future project decision explicitly adopts another tracker. The standards assessment is complete; these items track the remaining gaps it found.

### [TINY-003] [P1] [security] Protect releases and establish dependency response

- **Status:** Proposed
- **Origin:** standards assessment
- **Goal:** Make production delivery and dependency vulnerability response deliberate and observable.
- **Why now:** The `main` branch is unprotected while pushes deploy production automatically. GitHub vulnerability alerts and automated security updates are disabled. The 2026-10-11 `bun audit` reported 80 advisories after compatible upgrades (28 high, 46 moderate, 6 low, no critical); the affected paths are in the build, test, and CLI dependency tree.
- **Scope:** Choose whether production changes require pull requests and passing checks; configure the matching GitHub/Vercel release controls; enable appropriate dependency alerts; define triage ownership and severity policy; review and record dispositions for remaining advisories; add an automated scan with a threshold that matches that policy.
- **Non-goals:** Pushing changes or changing production during this work; blindly ignoring advisories or adding blanket exceptions.
- **Acceptance criteria:**
  - The maintainer's release policy is recorded.
  - A failed required check cannot silently pass into production, or a scoped exception is documented.
  - Dependency alerts and scan results have an owner, a review cadence, and a documented response path.
  - Current high and moderate findings have a recorded disposition.
- **Verification:** Inspect GitHub repository settings, Vercel production-branch settings, and a successful scan/release check.
- **Affected areas:** GitHub repository settings, Vercel project settings, `.github/workflows/ci.yml`, `docs/operations/deployment.md`, `docs/project-standards.yml`.
- **Dependencies:** Maintainer decision on PR-based release gating versus accepting direct-to-main automatic deployment.
- **Risks:** Branch protection changes the release workflow; automated audit failure thresholds can block routine work while a known backlog remains.
- **Blocker or question:** Choose whether main production releases must require a pull request and passing CI.
- **Next action:** Decide the release policy, then configure platform controls and dependency monitoring.
- **Owner:** Project maintainer.
- **Last updated:** 2026-10-11

### [TINY-004] [P1] [accessibility] Make critical game journeys keyboard-accessible

- **Status:** Proposed
- **Origin:** standards assessment
- **Goal:** Let players complete the essential tutorial, sandbox, and challenge journeys without a mouse and provide a retained frontend quality baseline.
- **Why now:** Placing services, connecting ports, and selecting connections are pointer-driven. Some pages lack a main landmark, some icon-only buttons lack accessible names, and there is no documented manual or rendered-page audit.
- **Scope:** Add keyboard operation and visible focus to essential board interactions; correct page landmarks and accessible names; review dialog focus and status announcements; perform keyboard and assistive-technology checks; audit representative routes with Lighthouse or an equivalent tool; document pre-release and periodic review cadence.
- **Non-goals:** Expanding the product's declared desktop-only support to mobile unless separately decided.
- **Acceptance criteria:**
  - A keyboard-only player can complete tutorial, sandbox build/edit, and a challenge journey.
  - Essential controls have accessible names, focus is visible and logical, and dialogs/status changes are announced appropriately.
  - Home, tutorial, sandbox, challenge list, and challenge detail receive representative rendered-page review.
  - Manual findings and prioritized remediation are retained in the repository.
- **Verification:** Keyboard-only journey review, accessibility-tree inspection, and retained Lighthouse or equivalent reports from a production-like build.
- **Affected areas:** `src/app/features/`, `src/styles.css`, `.github/workflows/ci.yml`, `docs/operations/`, `docs/work/TODO.md`.
- **Dependencies:** None.
- **Risks:** Keyboard interaction changes affect the core game controls and need user-flow review.
- **Blocker or question:** None.
- **Next action:** Design keyboard interaction patterns for service placement, port connection, movement, and selection.
- **Owner:** Project maintainer.
- **Last updated:** 2026-10-11

### [TINY-005] [P2] [quality] Test persisted-state boundaries and critical journeys

- **Status:** Proposed
- **Origin:** standards assessment
- **Goal:** Cover browser persistence validation and the most important visible player journeys with repeatable tests.
- **Why now:** The app sanitizes versioned localStorage state, but no tests cover malformed, legacy, duplicate, or out-of-range saved values; the current suite is limited to tutorial and challenge service behavior.
- **Scope:** Add focused tests for `sanitizeBoard`, `sanitizeSandboxState`, and `sanitizeProgress`; cover legacy v0, current v1, unknown versions, malformed entries, and recovery; add a controlled integration or end-to-end test for a representative tutorial/sandbox/challenge journey.
- **Non-goals:** Replacing Vitest or introducing an external backend.
- **Acceptance criteria:**
  - Valid current and legacy state is restored as documented.
  - Malformed, duplicate, unknown, and out-of-range values are rejected or safely normalized.
  - At least one complete player journey is tested at the user-visible boundary.
  - The suite runs in GitHub Actions.
- **Verification:** Run focused tests repeatedly and confirm the CI test job executes them.
- **Affected areas:** `src/app/core/storage/`, `src/app/core/game/`, `src/app/features/`, `src/app/core/**/*.spec.ts`, `.github/workflows/ci.yml`.
- **Dependencies:** TINY-003 for confirmation of the protected CI path.
- **Risks:** Browser-driven end-to-end coverage may need a browser dependency and a bounded CI runtime.
- **Blocker or question:** None.
- **Next action:** Add sanitizer unit tests before selecting a browser-based journey tool.
- **Owner:** Project maintainer.
- **Last updated:** 2026-10-11

### [TINY-006] [P3] [maintenance] Adopt remaining TypeScript compiler checks

- **Status:** Proposed
- **Origin:** standards assessment
- **Goal:** Make missing indexed values and unused code explicit through the existing compiler.
- **Why now:** The app already enables strict checking, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noImplicitReturns`, and `noFallthroughCasesInSwitch`, but does not enable `noUncheckedIndexedAccess`, `noUnusedLocals`, or `noUnusedParameters`.
- **Scope:** Enable the three remaining checks, resolve resulting diagnostics, and assess whether `exactOptionalPropertyTypes` improves the persisted and domain models.
- **Non-goals:** Changing runtime behavior or weakening current strict options to avoid migration work.
- **Acceptance criteria:**
  - The selected compiler checks are enabled in the committed tsconfig.
  - `bun run build`, `bun run test`, and `bun run check` pass.
  - Any intentionally retained suppression or optional-property exception is narrow and documented.
- **Verification:** Run the full local CI-equivalent validation and inspect compiler output.
- **Affected areas:** `tsconfig*.json`, `src/app/`, `docs/project-standards.yml`.
- **Dependencies:** None.
- **Risks:** Existing indexed reads and unused declarations may need explicit narrowing or cleanup.
- **Blocker or question:** None.
- **Next action:** Make a dry-run migration by enabling one compiler option at a time and reviewing diagnostics.
- **Owner:** Project maintainer.
- **Last updated:** 2026-10-11
