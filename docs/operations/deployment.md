# Development and Deployment

## Local development

The project uses Bun `1.3.4` (`packageManager` in `package.json`). Install from the committed lockfile and run the app with:

```sh
bun install --frozen-lockfile
bun start
```

The development server uses `http://localhost:4200`.

| Purpose | Command |
|---------|---------|
| Lint and format check | `bun run check` |
| Type-check app and tests | `bun run typecheck` |
| Production build | `bun run build` |
| Unit tests | `bun run test` |
| Dependency audit | `bun audit` |

## Continuous integration

GitHub Actions runs on pushes, pull requests, manual dispatch, and weekly. It uses Ubuntu, Bun `1.3.4`, and `bun install --frozen-lockfile`, then runs `bun run typecheck`, `bun run check`, `bun audit --audit-level=critical`, `bun run test`, and `bun run build`.

The test command runs the repository's Vitest suite. Run `bun run test` locally to execute the same test step used in CI.

The full dependency report is produced with `bun audit`. CI fails for critical advisories; the accepted current baseline has no critical findings but contains high and moderate build/test dependency advisories. GitHub vulnerability alerts and Dependabot security updates are enabled. The maintainer reviews new alerts weekly; target remediation is seven days for high, 30 days for moderate, and 90 days for low severity. See the [dependency security guide](dependency-security.md) for the current scan and triage policy.

## Production deployment

- Production URL: [tiny-stacks.dawichi.dev](https://tiny-stacks.dawichi.dev).
- Vercel project: `tiny-stacks`, configured with the Angular framework.
- Source: `dawichi/tiny-stacks` on GitHub.
- Vercel deploys automatically through its Git integration when changes are pushed to `main`. The Vercel deployment history inspected for this documentation work showed production deployments from that repository and branch.
- The maintainer has chosen to keep direct pushes to `main`; pull requests are not required and CI is not a pre-deployment gate. A push may reach production before its GitHub Actions run completes. This is an explicit, scoped release exception: run the full local validation before pushing, then inspect CI and Vercel immediately after the push. If CI fails, fix forward or roll back the deployment.
- Vercel's project inspection reported no custom root directory, install command, build command, or output directory override. Project settings are managed in Vercel and are not stored in this repository.
- There is no checked-in Vercel configuration file or deployment workflow. Vercel builds and serves the frontend.

Treat a push to `main` as a production release. Direct-to-main release is authorized for this project; otherwise, do not push or change production without an explicit user request.

## Inspecting and recovering deployments

The Vercel CLI is not a project dependency. If it is unavailable globally, invoke it with Bun:

```sh
bunx --yes vercel project inspect tiny-stacks
bunx --yes vercel inspect https://tiny-stacks.dawichi.dev
bunx --yes vercel list tiny-stacks --limit 10
```

Rollback command syntax is:

```sh
bunx --yes vercel rollback <deployment-id-or-url>
```

Inspect the deployment and confirm the target with the user before running rollback; it changes production traffic. Vercel serves the frontend, while player progress remains in each browser's local storage and is unaffected by a deployment rollback.

## Failure boundaries

- A frontend build or deployment failure is handled through GitHub Actions and Vercel deployment history.
- The application has no backend service, database, or server-side progress backup.
- Vercel project settings and GitHub integration credentials remain external to this repository.
