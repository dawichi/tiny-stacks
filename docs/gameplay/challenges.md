# Challenge Goals and Calibration

Challenge definitions are the source of truth for starting boards, traffic, outages, resources, topology conditions, and deploy thresholds. A star requires both its topology and every metric threshold for that tier. Runs use a fixed seed per level so a retry repeats the traffic and routing choices.

The table records intended baseline pressure, progression between tiers, and encoded pass thresholds. Thresholds are design targets, not measured benchmark results. Recheck `src/app/core/challenges/challenge-definitions.ts`, `challenge-evaluation.ts`, and the reference fixtures whenever challenge behavior or traffic changes.

| Level | Baseline pressure | Star progression | Deploy thresholds |
|-------|------------------|------------------|------------------|
| 1 · Cache Layer | Database receives a 32 req/s peak against roughly 20 req/s of capacity. | Cache alongside the direct route → remove the bypass → route reads through Cache and writes to DB. | ★1 errors < 5%; ★2 errors < 1%, P95 < 900 ms; ★3 errors < 1%, P95 < 800 ms. |
| 2 · Two Backends | REST 1 and then REST 2 have scheduled outages. Direct fan-out still sends traffic to a backend that is down. | Split traffic across both REST services → add an LB while keeping the bypass → make the healthy-aware LB the only entry point. | ★1 errors < 26%; ★2 errors < 18%; ★3 errors < 3%. |
| 3 · Smart Routes | At a 36 req/s peak, random routing between Cache and the direct Database keeps too many reads on the DB path. | Commit all requests to Cache → route writes directly to DB → use explicit GET and write rules on both paths. | Each tier requires errors < 1% and P95 < 600 ms. |
| 4 · Write Buffer | A 32 req/s order rush overloads the Database; GET requests cannot be answered by a Message Queue. | Add a queue beside DB → restrict the queue path to writes → send reads to DB and writes through the queue. | ★1 errors < 20%; ★2 errors < 1%, P95 < 800 ms; ★3 errors < 1%, P95 < 500 ms. |
| 5 · The Gateway | Peak traffic reaches 28 req/s. Origin initially bypasses the Gateway and reads do not use a Cache. | Add a Gateway but keep the bypass → remove the bypass → add a Cache for reads. | ★1 and ★2 errors < 20%; ★3 errors < 1%, P95 < 800 ms. |
| 6 · Scale + Cache | The REST backends are present, but Origin has no route into the system; the front-page peak is 46 req/s. | Add an LB across both REST services → put both behind the shared Cache → restrict Cache to reads and keep writes on DB paths. | ★1 throughput ≥ 15 req/s; ★2 errors < 1%, P95 < 1000 ms; ★3 errors < 1%, P95 < 900 ms. |
| 7 · Two Paths | Both REST services send reads and writes directly to the same Database at a 36 req/s peak. | Build shared Cache and Queue paths → split reads and writes at Origin → add downstream route rules to keep Cache on reads and Queue on writes. | ★1 errors < 20%; ★2 errors < 1%, P95 < 1500 ms; ★3 errors < 1%, P95 < 800 ms. |
| 8 · Full Stack | The board starts with only Origin and Database and no connections; the launch peak is 55 req/s. | Create a minimal Gateway-to-REST path → assemble the full stack → route reads to Cache and writes to Queue. | ★1 throughput ≥ 15 req/s; ★2 errors < 20%; ★3 errors < 1%, P95 < 1000 ms. |

## Scoring and editing

- Scoring checks the highest star tier first; earning a higher tier also grants the lower stars.
- The first challenge is open immediately. Each later level unlocks after earning at least one star on the previous level.
- Pre-placed services are locked. Connections can be edited.
- During Deploy the board is read-only. Results offer a retry or a return to building.

## Level 7 topology note

The level begins with both REST-to-Database bypasses visible. The reference solutions remove those bypasses, connect both REST services to the shared Cache, and connect the shared backend to the Message Queue. Without Origin rules, GET traffic can reach the Queue and fail. Splitting methods at Origin fixes that failure. The final tier also filters the shared backend's Cache and Queue links; routing writes through the Queue returns an acknowledgement before asynchronous Database delivery finishes.

Shared routing, queue, cache, and metric behavior is described in the [Simulation Model](../architecture/simulation.md).
