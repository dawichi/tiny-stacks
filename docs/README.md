# Project Documentation

This directory contains tiny-stacks' current architecture, gameplay references, operating guidance, and AI-agent handoff material.

## Start here

- [Agent instructions](AGENTS.md) — reading order, sources of truth, safe boundaries, and validation commands.
- [Standards contract](project-standards.yml) — pinned Engineering Standards source, selected standards, completed rule-by-rule assessment, and recorded compliance gaps.
- [Work system](work/README.md) and [work queue](work/TODO.md) — unfinished project and standards work.

## Project references

- [Architecture overview](architecture/overview.md) — browser runtime, application boundaries, state ownership, and persistence.
- [Simulation model](architecture/simulation.md) — ticks, deterministic runs, request routing, and metrics.
- [Challenge goals and calibration](gameplay/challenges.md) — level progression, scoring thresholds, and reference topology.
- [UI layout map](design/ui-layout.md) — fixed panels, overlays, and z-index rules.
- [Development and deployment](operations/deployment.md) — Bun commands, CI behavior, Vercel deployment, and recovery.
- [Dependency security response](operations/dependency-security.md) — monitoring, remediation targets, current audit evidence, and the direct-push exception.
- [Accessibility review](operations/accessibility-review.md) — retained route scan, keyboard journeys, findings, and review cadence.
- [ADR index](adr/README.md) — durable project decisions.

## Documentation rules

Project facts belong in this repository. Keep the root README concise and player-facing; keep detailed development and agent guidance here. Link to a topic's source of truth instead of copying its content into another document.
