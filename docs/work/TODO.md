# Unfinished Work

The repository-local queue is authoritative for unfinished work unless a future project decision explicitly adopts another tracker.

### [TINY-001] [P2] [quality] Run the unit-test suite in CI

- **Status:** Proposed
- **Origin:** standards review
- **Goal:** Make the existing Vitest suite part of the automated validation path.
- **Why now:** `bun run test` and test files exist, but GitHub Actions currently runs only `bun run check` and `bun run build` (`TEST-006`, `CI-002`).
- **Scope:** Add the test command to CI and address failures required to make the current suite reliable.
- **Non-goals:** Changing game behavior or adding a new test framework.
- **Acceptance criteria:**
  - GitHub Actions runs `bun run test` on pushes and pull requests.
  - The test command passes in the supported CI environment.
  - README and operations docs match the workflow.
- **Verification:** Run `bun run test` and inspect a successful GitHub Actions run.
- **Affected areas:** `.github/workflows/ci.yml`, `package.json`, `README.md`, `docs/operations/deployment.md`.
- **Dependencies:** None.
- **Risks:** Existing tests may expose failures that are currently invisible to CI.
- **Blocker or question:** None.
- **Next action:** Review the current Vitest suite and add its command to the CI job.
- **Owner:** Project maintainer.
- **Last updated:** 2026-10-11

### [TINY-002] [P3] [standards] Complete the remaining standards assessment

- **Status:** Proposed
- **Origin:** standards bootstrap
- **Goal:** Complete rule-by-rule compliance assessment for the selected standards and Angular profile.
- **Why now:** This session established and assessed the documentation package plus directly verified test, CI, data ownership, security-context, Angular-boundary, and deployment rules. Other applicable rules remain unassessed.
- **Scope:** Review the remaining TypeScript, security, dependency, CI/CD, operations, data, styling, web-accessibility, and Angular rules; update `docs/project-standards.yml` with evidence, gaps, and actions.
- **Non-goals:** Applying broad code, dependency, or UX changes during the audit.
- **Acceptance criteria:**
  - Each applicable selected rule has an explicit compliance state and evidence.
  - Each gap has a remediation work item or a documented exception.
  - Inapplicable rules have a short applicability reason.
- **Verification:** Review the completed standards contract against the pinned standards revision.
- **Affected areas:** `docs/project-standards.yml`, `docs/work/TODO.md`, and relevant project documentation.
- **Dependencies:** None.
- **Risks:** The assessment may identify code, accessibility, or delivery gaps beyond the current documentation scope.
- **Blocker or question:** None.
- **Next action:** Assess the remaining rule IDs in the standards contract.
- **Owner:** Project maintainer.
- **Last updated:** 2026-10-11
