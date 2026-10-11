# Simulation Model

`src/app/core/game/simulation.ts` is the framework-independent simulation engine. `TickEngineService` supplies the active board and traffic settings, advances the engine, and publishes immutable Angular signal snapshots.

## Time and runs

- The normal engine advances at 60 ticks per second.
- Speed controls run 1, 2, or 4 simulation steps per real tick. They change simulation speed without changing the model's per-step behavior.
- Simulation time drives traffic phases, outages, queue processing, cache expiry, and metrics. Results do not depend on wall-clock time.
- Challenge runs seed routing and traffic from the challenge ID. Retrying the same level uses the same seed.
- A deployment summary is measured for the scripted run. Sandbox metrics are rolling live metrics and are separate from challenge scoring.

## Request flow

Requests move through the board's directed service graph and return along the recorded route. Service queues, processing capacity, hop latency, outages, and service-specific behavior affect completion and latency.

- If a service has outgoing connections but none accepts the request method, the request fails. REST and Database services with no downstream connection act as terminal services.
- A Cache serves hits quickly, sends misses to its backing route, caches returned reads, expires entries after its TTL, and invalidates upstream entries after writes reach the associated Database.
- A Message Queue acknowledges write requests and delivers them asynchronously. GET requests sent to a Queue fail because a queue cannot return a read response.
- A Load Balancer selects the least busy healthy target. Other services select among eligible outgoing connections using configured weights.
- Queue delivery failures may be retried; messages are dropped when the configured backlog is full.

## Metrics

Live metrics include completions, failures, active requests, average and P95 latency, throughput, error rate, estimated cost, and asynchronous queue state. Challenge deployment results separately include run duration, completed and failed client requests, latency, throughput, total cost, and Database operations.

Challenge thresholds and level calibration are documented in [Challenge Goals and Calibration](../gameplay/challenges.md). Recheck the simulation tests and fixtures when changing routing, capacity, time, or metrics.
