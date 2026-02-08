# Simulation Engine Design

> Detailed design for the request simulation, service behaviors, and challenge system.
> This document serves as the implementation roadmap for transitioning from visual-only packets to a full simulation engine.

---

## 1. Core Concept

The simulation tracks real requests flowing through the player's architecture. Each request is a tracked entity with a type, resource, position, and accumulated latency. Services process requests based on their type-specific behavior, queue capacity, and player-configured routing. Challenges define traffic patterns and win conditions that test the player's architectural decisions.

---

## 2. Traffic Source — The "Origin"

A special service type representing external traffic (the internet, clients, users).

- **Icon**: cloud or globe with waves
- **Behavior**: generates requests at a configurable rate (req/s)
- **Ports**: output only (sends traffic, never receives)
- **Challenge-defined**: each challenge pre-places Origin(s) with specific traffic patterns
- **Sandbox**: player can place and configure Origins freely

### Traffic Pattern Definition

Each Origin has a traffic profile:
```
{
  requestsPerSecond: 50,
  distribution: [
    { method: GET,    resource: 'users',    weight: 0.5 },
    { method: GET,    resource: 'products', weight: 0.3 },
    { method: POST,   resource: 'orders',   weight: 0.15 },
    { method: DELETE,  resource: 'orders',   weight: 0.05 },
  ]
}
```

---

## 3. Request Model

Each request is a tracked entity throughout its entire lifecycle.

```typescript
interface SimRequest {
    id: string;
    method: RequestMethod;      // GET, POST, PUT, DELETE
    resource: string;           // 'users', 'products', 'orders', etc.
    status: RequestStatus;      // pending, processing, queued, success, failed, timeout
    currentServiceId: string;   // where the request currently is
    originServiceId: string;    // which Origin spawned it
    spawnedAtTick: number;      // for latency calculation
    totalLatency: number;       // accumulated ms across all hops
    routeHistory: string[];     // service IDs visited (for debugging/visualization)
}
```

### Request Lifecycle

```
Origin spawns request
  → travels to connected service (hop latency)
  → enters service queue (may wait if busy)
  → service processes request (processing time)
  → service decides next action:
      a) Respond back upstream (success/error)
      b) Forward to downstream service (e.g. REST → Cache)
      c) Fail (queue overflow, timeout)
  → response travels back along the same path
  → reaches Origin = request complete
```

### Visual Representation

- At low throughput: individual balls, one per request
- At high throughput: batched balls (one ball = N requests), ball size scales with batch size
- Ball color = request method (GET blue, POST green, PUT yellow, DELETE orange)
- Ball shape/label = resource type (small icon or letter)
- Response balls travel back along the same path
- Failed requests: ball turns red, visual "pop" or fade

---

## 4. Service Behaviors

Each service type has hardcoded core behavior + player-configurable parameters.

### 4.1 API Gateway

| Property | Value |
|----------|-------|
| **Role** | Entry point, routes requests to backend services |
| **Processing time** | Very low (just routing) |
| **Behavior** | Forwards all incoming requests to connected services based on routing rules |
| **Player config** | Route by method and/or resource to specific output ports |

### 4.2 REST Service

| Property | Value |
|----------|-------|
| **Role** | Business logic orchestrator |
| **Processing time** | Medium |
| **Behavior** | Receives requests, may check Cache first, then DB. Orchestrates the full request lifecycle |
| **Player config** | Per-connection routing: "send GET to Cache (80%)", "send POST to DB (100%)" |
| **Key mechanic** | Hub/bottleneck — handles orchestration, so high traffic makes it a pressure point |

### 4.3 Database

| Property | Value |
|----------|-------|
| **Role** | Persistent storage, source of truth |
| **Processing time** | High (slow but reliable) |
| **Behavior** | Handles all request types. Always returns data (never misses). |
| **Player config** | Max connections slider |
| **Key mechanic** | Slow + limited concurrency = the classic bottleneck players need to solve |

### 4.4 Cache

| Property | Value |
|----------|-------|
| **Role** | Fast read-only lookup |
| **Processing time** | Very low |
| **Behavior** | Stores results per resource. First GET for a resource = MISS (responds to caller with miss). Subsequent GETs for the same resource = HIT (responds with data). POST/PUT/DELETE invalidate the cached resource. |
| **Player config** | Which resources to cache (toggle per resource type) |
| **Key mechanic** | Miss/hit dynamics. Cold start means first requests are slow. Writes invalidate cache. |

#### Cache Flow (via REST as orchestrator)

```
Cache HIT:  Origin → Gateway → REST → Cache (hit!) → REST → Gateway → Origin
Cache MISS: Origin → Gateway → REST → Cache (miss) → REST → DB → REST → Gateway → Origin
```

The ball bounces back to REST between each step. REST decides "check cache first, if miss then hit DB." Visually you see the short path (hit) vs the long path (miss).

### 4.5 Message Queue

| Property | Value |
|----------|-------|
| **Role** | Async buffer, decouples producers from consumers |
| **Processing time** | Near-zero (just enqueue) |
| **Behavior** | Accepts requests immediately (fast response to upstream). Delivers to consumers at their own pace. Smooths traffic bursts. |
| **Player config** | Queue size limit |
| **Key mechanic** | Absorbs bursts — 100 req/s spike gets smoothed to 20 req/s steady. But adds latency. |

### 4.6 Load Balancer

| Property | Value |
|----------|-------|
| **Role** | Distributes traffic across multiple downstream instances |
| **Processing time** | Very low |
| **Behavior** | Round-robin or weighted distribution across connected output services |
| **Player config** | Weight slider per output connection (e.g. 70/30 split) |
| **Key mechanic** | Only useful with multiple downstream instances. Enables horizontal scaling. |

---

## 5. Service Configuration Panel

Inspired by Factorio/Satisfactory machine panels — simple sliders and toggles, not a programming interface.

### Per-Connection Configuration

When two services are connected, the connection has configurable routing:
- **Method filter**: which HTTP methods to forward (checkboxes: GET, POST, PUT, DELETE)
- **Percentage slider**: what % of matching requests to forward (0-100%)
- Example: "Forward 80% of GETs to Cache, 100% of POSTs to DB"

### Per-Service Configuration

Each service type has type-specific settings in the inspector panel:
- **Cache**: toggle which resource types to cache (e.g. [x] users [x] products [ ] orders)
- **Load Balancer**: weight slider per output (drag to adjust 70/30 split)
- **Message Queue**: queue size limit slider
- **Database**: max concurrent connections slider
- **REST Service**: processing time indicator (read-only, shows current load)

---

## 6. Simulation Tick Engine

Tick-based simulation for deterministic behavior. Visual layer interpolates between ticks.

### Tick Model

- **Tick rate**: 60 ticks/second (configurable speed: 0.5x, 1x, 2x)
- **Pause**: tick rate = 0, player can build freely
- **Each tick**:
  1. Origins spawn new requests based on their rate
  2. Services process their queues (one unit of work per concurrency slot per tick)
  3. Completed requests forward to next service or respond upstream
  4. Track metrics: throughput, latency, error rate, queue depths
  5. Check win conditions (if in challenge mode)

### Latency Model

Total request latency = sum across all services touched:
- **Hop latency**: small fixed cost per connection traversal (e.g. 5ms per hop)
- **Queue wait time**: time spent waiting in a service's queue (variable, depends on load)
- **Processing time**: service-specific (DB ~50ms, Cache ~5ms, REST ~20ms, etc.)

Grid distance does NOT affect latency — focus is on architecture, not spatial optimization.

### Overload / Failure Mechanics

```
Service receives request
  → Queue has space? → enqueue, wait for processing slot
  → Queue full? → REQUEST FAILS (error response back to caller)

When a service is overloaded:
  1. Queue fills up → visual: balls pile up around the service
  2. Processing slows (queue wait time increases) → visual: balls move slower
  3. Queue overflow → balls turn red, "pop" animation
  4. Upstream services receive errors → may cascade if they can't handle it
  5. Creates visible "traffic jam" the player must solve
```

---

## 7. Win Conditions & Challenge System

### Condition Types

| Type | Example | What it tests |
|------|---------|---------------|
| **Throughput** | "Handle 50 req/s for 5 seconds" | System capacity |
| **Error rate** | "< 5% failure rate" | Resilience |
| **Latency** | "Average response < 200ms" | Efficiency |
| **Budget** | "Use at most 4 services" | Creativity |
| **Fix-it** | "Fix the broken system (no deletions allowed)" | Diagnosis |

### 3-Star Rating

- **Star 1**: Basic goal (just make it work)
- **Star 2**: Efficiency goal (latency or budget constraint)
- **Star 3**: Perfect run (zero errors + both constraints)

### Challenge Definition

```typescript
interface ChallengeDefinition {
    id: string;
    name: string;
    description: string;
    gridSize: { width: number; height: number };
    preplacedServices: PlacedService[];       // pre-placed services (including Origin)
    preplacedConnections: Connection[];        // pre-placed connections
    availableServiceTypes: ServiceType[];      // which types the player can place
    trafficPatterns: TrafficPattern[];         // Origin traffic configuration
    winConditions: WinCondition[];             // 1 per star
    duration: number;                          // seconds to sustain for success
}
```

### Progressive Unlocking

Early challenges introduce one concept at a time:

| Level | New concept | Puzzle |
|-------|-------------|--------|
| 1 | REST + DB | "Connect them and handle basic traffic" |
| 2 | Cache | "DB is overloaded — add a cache to reduce read load" |
| 3 | Load Balancer | "Single REST can't handle the load — scale horizontally" |
| 4 | Message Queue | "Traffic spikes are crashing the system — buffer with a queue" |
| 5 | API Gateway | "Multiple endpoints need routing to different backends" |
| 6+ | Combinations | Complex multi-service architectures with mixed traffic |

---

## 8. Implementation Phases

### Phase 1: Tick-Based Simulation Engine
- Create `TickEngine` service (replaces current RAF-based `SimulationService`)
- Tick loop: spawn, process, forward, track metrics
- Request model with full lifecycle tracking
- Service behavior interfaces

### Phase 2: Origin Service Type
- New service type: `Client` / `Origin`
- Traffic pattern configuration
- Request spawning per tick

### Phase 3: Service Behaviors
- Implement processing logic for each service type
- Cache miss/hit mechanics with resource tracking
- Queue overflow and failure mechanics
- Response flow (requests travel back along same path)

### Phase 4: Visual Integration
- Replace decorative packets with real tracked requests
- Batch rendering at high throughput
- Overload visuals (pile-up, red balls, pop animation)
- Response balls traveling back

### Phase 5: Service Configuration Panel
- Per-connection routing (method filter + percentage slider)
- Per-service settings (cache toggles, LB weights, queue size)
- Factorio-inspired simple UI

### Phase 6: Challenge System
- Challenge definition format
- Win condition evaluator (runs each tick)
- Level selection UI
- Progressive unlocking
- 3-star rating display

---

*This document should be updated as implementation progresses and design decisions evolve.*
