# Challenge goals and calibration

Challenge definitions are the source of truth for starting boards, traffic, outages, resources, topology rules, and
deploy thresholds. A star requires both its topology and every metric threshold for that tier. Runs use a fixed seed per
level so a retry repeats the traffic and routing choices.

The table records the intended baseline pressure, the progression between tiers, and the encoded pass thresholds. The
thresholds are design targets, not measured benchmark results. Recheck the reference fixtures in
`src/app/core/challenges/challenge-fixtures.ts` whenever simulation behavior or traffic changes.

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

## Simulation rules that affect challenge outcomes

- Database writes invalidate entries in every Cache upstream of that Database. Cache entries also expire after the configured
  TTL, so an unused or stale entry cannot live forever.
- A Message Queue acknowledges write methods to its producer and delivers them asynchronously. A GET sent to a Queue fails
  because a queue cannot return a data response.
- A Load Balancer chooses the least busy healthy target. Other services select among the outgoing connections that accept
  the request method, using their configured weights.
- Deploy P95 latency and error rate are calculated from the scripted run, separately from the rolling live Sandbox metrics.
- Infrastructure and Database-operation costs are included in Deploy results and shown beside the thresholds.

## Level 7 topology note

The level begins with both REST-to-Database bypasses visible. Each reference solution removes those bypasses, connects both
REST services to the shared Cache, and connects the shared backend to the Message Queue. Without Origin rules, GET traffic
can reach the Queue and fail. Splitting methods at Origin fixes that failure. The final tier also filters the shared
backend's Cache and Queue links; routing writes through the Queue reduces client latency by returning the acknowledgement
before the asynchronous Database delivery finishes.
