<p align="center">
  <img src="public/logo.svg" alt="tiny-stacks logo" width="120" />
</p>

<h1 align="center">tiny-stacks</h1>

<p align="center">
  A browser game for building microservice architectures and seeing how traffic moves through them.
</p>

<p align="center">
  <a href="https://tiny-stacks.dawichi.dev">Play it live</a> ·
  <a href="#screenshots">Screenshots</a> ·
  <a href="#how-to-play">How to play</a>
</p>

[![CI](https://github.com/dawichi/tiny-stacks/actions/workflows/ci.yml/badge.svg)](https://github.com/dawichi/tiny-stacks/actions/workflows/ci.yml)

---

## What is this?

tiny-stacks turns backend architecture into a visual puzzle. Place REST services, databases, caches, load balancers,
message queues, and gateways on a grid. Connect their ports, then watch animated requests reveal how the system handles
normal traffic, a peak, or a service outage.

The game runs entirely in your browser. It has no backend; boards and progress are saved in local storage.

## Screenshots

<p align="center">
  <img src="public/screenshots/tiny-stacks-demo.gif" alt="Sandbox demo showing a healthy 30 req/s baseline followed by a 5× traffic spike and REST Service overload" width="640" />
</p>

<p align="center">
  <a href="https://tiny-stacks.dawichi.dev/screenshots/tiny-stacks-demo.mp4">Watch the 9-second MP4</a>
</p>

<p align="center">
  <img src="public/screenshots/home-page.png" alt="Home page with the optional tutorial, Sandbox, and Challenges" width="720" />
</p>

<p align="center">
  <img src="public/screenshots/challenges.png" alt="Progressive architecture challenges with star ratings" width="720" />
</p>

## How to play

**Core loop:** Place → Connect → Watch → Optimize

- **Place** services from the palette onto the grid.
- **Connect** an output port to an input port.
- **Configure** route rules to send selected HTTP methods down each connection.
- Select and delete a service or connection to remove it.

### Game modes

| Mode | Description |
|------|-------------|
| **Tutorial** | Recommended, optional walkthrough of the core mechanics. |
| **Sandbox** | An editable example system, live metrics, adjustable Origin traffic, and no goals. |
| **Challenges** | Eight deploy scenarios. The first is open immediately; later levels unlock as you earn stars. |

### Services

| Service | What it does |
|---------|-------------|
| **Origin** | Generates HTTP requests. In Sandbox, select an Origin to set its rate from 1 to 200 requests per second or trigger a temporary 5× spike. |
| **API Gateway** | Provides a low-latency entry point for routing. |
| **REST Service** | Runs application logic and becomes a bottleneck under load. |
| **Database** | Stores data with limited concurrency and a cost per operation. |
| **Cache** | Serves repeated reads quickly, expires entries, and invalidates them after writes reach its backing database. |
| **Message Queue** | Acknowledges writes, then delivers them asynchronously. Reads sent to a queue fail because it cannot return data. |
| **Load Balancer** | Routes requests to the least busy healthy backend. |

## Repository structure

- `src/app/core/` contains board rules, simulation, storage, tutorial, and challenge logic.
- `src/app/features/` contains the routed screens and game UI.
- `docs/` contains architecture, gameplay, design, operating, and agent handoff documentation.

See the [project documentation index](docs/README.md) for the source of truth on architecture, simulation, challenge calibration, UI layout, and deployment.

## Tech stack

- Angular 21 with Signals, standalone components, and the new control flow syntax
- TailwindCSS v4
- SVG connections, packets, and animations
- Bun, Biome, and Vitest

## Running locally

```sh
bun install
bun start
```

The dev server runs at `http://localhost:4200`.

```sh
bun run build
bun run check
bun run test
```

The production site is [tiny-stacks.dawichi.dev](https://tiny-stacks.dawichi.dev). See
[Development and Deployment](docs/operations/deployment.md) for CI, deployment, and recovery details.

## License

[MIT](LICENSE)
