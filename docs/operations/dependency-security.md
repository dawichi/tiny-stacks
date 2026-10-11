# Dependency Security Response

## Ownership and monitoring

The project maintainer owns vulnerability triage and remediation. GitHub vulnerability alerts and Dependabot security updates are enabled for `dawichi/tiny-stacks`. GitHub Actions runs the locked dependency scan on pushes, pull requests, manual dispatch, and weekly.

CI runs `bun audit --audit-level=critical` and fails when a critical advisory is present. The complete report remains available through `bun audit`; CI uses the critical-only threshold because the current lockfile contains an acknowledged high/moderate backlog. Advisories are not ignored or suppressed.

## Severity targets

Review new alerts at least weekly and record a fix, mitigation, or explicit exception in the work queue.

| Severity | Target response |
|---|---|
| Critical | Start triage immediately; fix or mitigate within 24 hours. If production exposure is plausible, stop releases or roll back while it is assessed. |
| High | Fix or mitigate within 7 days. |
| Moderate | Fix or mitigate within 30 days. |
| Low | Fix or mitigate within 90 days. |

If a fixed version is unavailable or incompatible, inspect the dependency path with `bun pm why <package>`, check whether the affected code is present or reachable in the static production bundle, and choose a tested upstream update, narrow override, replacement, or dated exception. Do not add a blanket audit ignore.

## Current scan and disposition

The 2026-10-11 scan used Bun `1.3.4` against `bun.lock` after `bun update` confirmed there were no compatible lockfile updates available. It found 80 advisories: 28 high, 46 moderate, 6 low, and no critical. The complete advisory IDs, titles, severity, affected package versions, and source links are retained in [dependency-audit-2026-10-11.json](dependency-audit-2026-10-11.json).

All current high and moderate findings have the same temporary disposition: **acknowledged and awaiting a tested upstream fix; not ignored**. `bun pm why` confirms representative findings such as Hono and `@hono/node-server` enter through Angular CLI's Model Context Protocol tooling, `fast-uri` through Angular DevKit/AJV, Rollup through Vite, and `ws` through jsdom. Vercel serves a static frontend and the repository has no application server. This reduces the relevance of server-adapter findings to the deployed app, but it does not prove every advisory unreachable; each remains tracked by its GHSA in the retained scan and GitHub alert feed.

The existing findings are accepted as a time-bounded maintenance backlog while automated alerts and security updates are active. The critical-only CI threshold does not treat the existing high/moderate findings as fixed; the maintainer reviews them weekly against the response targets above. Re-run `bun audit` before a release when dependency files change and retain an updated scan whenever the finding counts or dispositions change.

## Release boundary

The maintainer has chosen direct pushes to `main`; GitHub does not require pull requests or status checks before a push. Vercel deploys on that push, so CI runs after deployment and cannot prevent a failing build or audit from briefly reaching production. This is an explicit project exception documented in the [deployment guide](deployment.md). Run local validation before each push, inspect GitHub Actions and Vercel immediately afterward, and fix forward or roll back if either reports a release failure.
