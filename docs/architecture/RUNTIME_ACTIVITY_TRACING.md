# Runtime Activity Tracing

**Status:** Implemented (Phase 1–2 shipping)
**Created:** 2026-04-20
**Last updated:** 2026-06-24 (actor prose realigned: minibob → goal-host-vessel / substrate)
**Supersedes:** N/A (new capability)

> **Phase 8 migration note (2026-05-24):** The client-side tracer that previously lived at `repos/minibob/src/activity-tracer.ts` moved to the substrate vessels in Phase 8. `ActivityTracer` and the L1/L2 meta-trace emission now live in `goal-host-vessel` (wrapping `GoalHost` from `ias-executor-ts`). The architecture described in this document — L1/L2 meta-trace types, `RUNTIME_TRACING_ENABLED`, `ACTIVITY_TRACER_ENABLED`, and the sampling strategy — remains conceptually valid. The server-side middleware at `repos/activity-api/src/middleware/runtime-tracing.ts` is unchanged.

**Implementation landing:**
- `repos/activity-api/src/middleware/runtime-tracing.ts` — request/resolver-level HTTP middleware (server side). Exports `runtimeTracingMiddleware`, `withResolver`, `RuntimeTracingConfig`. Toggled by `RUNTIME_TRACING_ENABLED`.
- `repos/goal-host-vessel/` — client-side tracer (moved from `repos/minibob/src/activity-tracer.ts` in Phase 8, 2026-05-24). Exports `ActivityTracer` interface via `GoalHost` from `ias-executor-ts`. Toggled by `ACTIVITY_TRACER_ENABLED`. L1 `goal_resolve` and L2 `activity_execute` meta-trace types emit alongside resolver traces.
- See [`IMPULSE_ACTIVITY_FOUNDATION.md`](./IMPULSE_ACTIVITY_FOUNDATION.md) for the foundational tracing model.

## Meta-Trace Types (L1/L2)

The goal-host-vessel-side `ActivityTracer` emits two meta-trace levels on top of per-resolver traces:

- **L1 `goal_resolve`** — one trace per user-facing goal. Wraps the entire goal-seeking flow, including template recommendation, activity selection, and execution. Lets the learning loop correlate cost/outcome with the originating goal without walking resolver-level detail.
- **L2 `activity_execute`** — one trace per activity invocation. Wraps all task executions and their resolver calls, and carries the `composition_chain` so nested activity-of-activities flows remain reconstructable. The parent L1 trace is referenced via `parent_execution_id`.

Per-resolver `impulse_resolutions` entries remain the L3/leaf layer, as described below.

## Overview

Extend the activity/impulse model from **development-time** (the substrate writing code) to **runtime** (applications executing code). Use the same trace storage and learning infrastructure to discover hot paths, performance bottlenecks, and optimization opportunities.

## The Core Insight

**Applications are vessels executing activities.**

When the substrate runs a goal, it:
- Receives a goal (input impulse)
- Executes an activity (sequence of resolvers)
- Produces artifacts (output impulses)
- Records a trace for learning

When Activity-API handles a request, it:
- Receives HTTP request (input impulse)
- Executes route handler (sequence of resolvers: auth, DB query, serialization)
- Returns HTTP response (output impulse)
- **Could record a trace for learning** ← THIS IS NEW

Same model. Same infrastructure. Different timescale (milliseconds vs minutes).

## Why This Matters

### 1. Unified Observability
One system for:
- Development activities (goal-host-vessel, the autonomous self-dev loop)
- Runtime activities (API requests, background jobs)
- Infrastructure activities (deployments, health checks)

All visible in the **same dashboard**. All feeding the **same learning loop**.

### 2. Continuous Optimization
The system learns:
- Which code paths are executed frequently (hot paths)
- Which resolvers are slow (bottlenecks)
- Which impulse shapes cause errors (failure patterns)
- Which functions are reused across activities (refactoring targets)

Then suggests:
- "Cache fetch_templates (called in 87% of executions)"
- "Optimize thompson_sampling (200ms avg, hot path)"
- "Add validation for file impulses with path > 100 chars (15% failure rate)"

### 3. Evidence-Based Refactoring
Instead of guessing what to optimize:
```
Query: "Which resolvers are slow AND frequently called?"
Result: surrealdb_query (500ms avg, 60% of traces)
Action: Add connection pooling, batch writes
Measure: Latency drops to 50ms, trace volume confirms
```

The same Thompson Sampling that improves activity templates can **A/B test code optimizations**.

## Architecture

### Tracing Levels

**Level 1: Request-Level (Low Overhead)**
- Trace entire HTTP requests as single activities
- Input: Request headers, body, params
- Output: Response status, body
- Resolvers: Route handler (black box)

**Level 2: Function-Level (Medium Overhead)**
- Trace key functions as resolvers
- Example: `parseRoute`, `validateAuth`, `queryDatabase`
- Selective instrumentation of hot paths

**Level 3: Full Instrumentation (High Overhead)**
- Trace every function call
- Build complete impulse transformation graph
- Enable in dev/staging only

### Sampling Strategy

**Production:**
- Sample 1% of requests for full tracing
- Always trace errors
- Always trace slow requests (>1s)
- Batch writes to backend (async, non-blocking)

**Canary:**
- Sample 10% of requests
- Trace all error paths
- Used for A/B testing optimizations

**Local:**
- Trace everything (low volume)
- Immediate feedback for development

### Storage

**Reuse existing schema:**
```sql
-- Runtime traces use the same execution table
INSERT INTO execution {
  id: "req_abc123",
  activity_template_id: "http_post_activities",  -- Runtime activity template
  vessel_id: "activity-api-pod-7f8c9d",          -- Pod ID
  impulse_resolutions: [
    {
      impulse_id: "http_request",
      resolver_id: "parse_json_body",
      resolver_tier: "deterministic",
      latency_ms: 5,
      cost_usd: 0
    },
    {
      impulse_id: "auth_token",
      resolver_id: "validate_jwt",
      resolver_tier: "deterministic",
      latency_ms: 12,
      cost_usd: 0
    },
    {
      impulse_id: "activity_query",
      resolver_id: "surrealdb_query",
      resolver_tier: "deterministic",
      latency_ms: 487,  -- BOTTLENECK DETECTED
      cost_usd: 0.0001
    }
  ],
  duration_ms: 504,
  success: true
};
```

**No schema changes needed.** Runtime traces are just execution traces with:
- `activity_template_id` = runtime activity type (e.g., "http_get_templates")
- `vessel_id` = instance/pod ID
- `impulse_resolutions` = function calls with timing

### Learning Queries

**Same queries that learn from development activities work for runtime:**

```sql
-- Hot paths (most frequent activities)
SELECT
  activity_template_id,
  COUNT() as execution_count,
  AVG(duration_ms) as avg_duration
FROM execution
WHERE vessel_id LIKE 'activity-api-%'  -- Runtime vessel
GROUP BY activity_template_id
ORDER BY execution_count DESC;

-- Resolver performance
SELECT
  resolver_id,
  COUNT() as call_count,
  AVG(latency_ms) as avg_latency,
  PERCENTILE(latency_ms, 0.95) as p95_latency
FROM (
  SELECT
    ->impulse_resolution->resolver_id as resolver_id,
    ->impulse_resolution->latency_ms as latency_ms
  FROM execution
)
GROUP BY resolver_id
ORDER BY call_count * avg_latency DESC;  -- Highest total time

-- Error patterns by impulse shape
SELECT
  ->impulse_resolutions->impulse_id.metadata.shape as impulse_shape,
  ->impulse_resolutions->resolver_id as resolver_id,
  COUNT() as total_calls,
  SUM(success = false) as failures,
  (failures / total_calls * 100) as failure_rate
FROM execution
GROUP BY impulse_shape, resolver_id
HAVING failures > 0
ORDER BY failure_rate DESC;

-- Reuse opportunities (functions called from many activities)
SELECT
  resolver_id,
  COUNT(DISTINCT activity_template_id) as used_in_activities,
  COUNT() as total_calls,
  total_calls / used_in_activities as reuse_factor
FROM (
  SELECT
    id as execution_id,
    activity_template_id,
    ->impulse_resolutions->resolver_id as resolver_id
  FROM execution
)
GROUP BY resolver_id
HAVING used_in_activities > 5
ORDER BY reuse_factor DESC;
```

## Implementation Plan

### Phase 1: Request-Level Tracing (Week 1)
**Goal:** Trace HTTP requests in Activity-API

1. Add middleware to capture request/response
2. Store as execution traces (existing schema)
3. Create dashboard view for runtime activities
4. Validate: "Can we see which endpoints are called most?"

**Deliverable:** Dashboard shows runtime request patterns

### Phase 2: Resolver-Level Tracing (Week 2)
**Goal:** Track individual function calls within requests

1. Create `withResolver()` wrapper (see example-runtime-activity-tracing.ts)
2. Instrument key functions: auth, DB queries, serialization
3. Build impulse transformation graph
4. Validate: "Can we see which DB queries are slow?"

**Deliverable:** Performance bottlenecks visible in dashboard

### Phase 3: Learning Integration (Week 3)
**Goal:** Use runtime traces to optimize code

1. Add queries for hot path detection
2. Add queries for bottleneck identification
3. Create refactoring suggestions based on traces
4. Validate: "Can Thompson Sampling A/B test code variants?"

**Deliverable:** Automated optimization suggestions

### Phase 4: Feedback Loop (Week 4)
**Goal:** Runtime traces inform development activities

1. Create activities that optimize based on runtime data
   - "Optimize function X (hot path, slow)"
   - "Add caching for resolver Y (called in 90% of requests)"
2. Deploy optimizations to canary
3. Compare runtime traces before/after
4. Thompson Sampling selects winning variant

**Deliverable:** Self-optimizing codebase

## Dashboard Integration

### New Views

**Runtime Activity Stream**
```
POST /v2/activities/templates          487ms   [====        ] 60%
GET  /v2/activities/recommend          234ms   [===         ] 30%
POST /v2/impulses/resolve              156ms   [==          ] 10%
```

**Resolver Performance Heatmap**
```
Resolver                 Calls    Avg Latency   P95    Bottleneck?
surrealdb_query          1,245    487ms        892ms   🔴 YES
validate_jwt             2,103    12ms         18ms    ✅ OK
parse_json_body          2,103    5ms          9ms     ✅ OK
thompson_sampling        423      201ms        387ms   🟡 WATCH
```

**Impulse Transformation Graph**
```
http_request (JSON, 2KB)
  └─> auth_token (JWT, 512B)
       └─> user_record (DB row, 1KB)
            └─> activity_query (SQL, 256B)
                 └─> template_list (JSON[], 15KB)
                      └─> http_response (JSON, 15KB)
```

**Reuse Opportunities**
```
Function               Used In   Total Calls   Reuse Factor   Suggestion
fetchTemplates         23        1,847        80.3x          Cache (hot data)
validateJWT            18        2,103        116.8x         Optimize (hot path)
formatResponse         15        987          65.8x          Standardize signature
```

## Alignment with Foundation

From `IMPULSE_ACTIVITY_FOUNDATION.md`:

| Principle | How Runtime Tracing Aligns |
|-----------|---------------------------|
| **Impulses are universal data** | ✅ HTTP requests, DB rows, function params are all impulses |
| **Activities constrain search** | ✅ Runtime activities (request handlers) are constrained workflows |
| **Resolvers live where data lives** | ✅ Functions in the codebase are resolvers |
| **Metadata first, content later** | ✅ Track function signatures, types before tracing full payloads |
| **Record everything** | ✅ Same execution trace schema, same storage |
| **Learn from traces** | ✅ Thompson Sampling, pattern recognition work unchanged |
| **LLMs are tools, not controllers** | ✅ Runtime analysis is deterministic (no LLM needed) |

**This is not a new system.** It's using the existing activity/impulse infrastructure for a new timescale.

## Performance Considerations

### Overhead

**Instrumentation:**
- Function wrapper: ~0.5-1ms per resolver (timestamp capture)
- Impulse creation: ~0.1ms per impulse (metadata only, content lazy)
- Trace storage: Async, non-blocking (batched writes)

**Total overhead:** <5% for Level 2 (function-level) tracing with sampling

### Mitigation Strategies

1. **Sampling:** Trace 1% in production, 10% in canary
2. **Async storage:** Non-blocking trace writes
3. **Lazy impulse loading:** Metadata-only until content needed
4. **Selective instrumentation:** Only hot paths, not every function
5. **Retention policies:** Aggregate old traces, keep recent detailed

### Memory

**Per trace:**
- Request-level (Level 1): ~2KB (request + response metadata)
- Function-level (Level 2): ~10KB (5-10 resolvers with impulses)
- Full instrumentation (Level 3): ~100KB (full call graph)

**Daily volume (Activity-API, 10K req/day, 10% sampling):**
- 1,000 traces/day × 10KB = 10MB/day = 300MB/month

**Sustainable:** Current SurrealDB handles 10GB+ comfortably

## Use Cases

### 1. Performance Regression Detection
**Scenario:** New deployment slows down `/v2/activities/recommend`

**Without runtime tracing:**
- Users report slowness
- Manual investigation with APM
- Unclear which function changed

**With runtime tracing:**
- Dashboard alerts: "thompson_sampling latency increased 2x"
- Trace diff shows new code path added DB query in loop
- Automatic rollback or fix

### 2. Refactoring Guidance
**Scenario:** Want to improve code reuse

**Without runtime tracing:**
- Code review finds duplicated logic
- Manual refactoring
- Hope it works

**With runtime tracing:**
```sql
-- Find functions with high reuse factor
SELECT resolver_id, used_in_activities, reuse_factor
FROM runtime_reuse_metrics
WHERE reuse_factor > 50
ORDER BY total_calls DESC;
```

Result: "validateJWT is called 116× more than activities using it → extract to shared module"

### 3. A/B Testing Code Variants
**Scenario:** Two implementations of Thompson Sampling

**Strategy:**
1. Deploy both variants (V1 and V2)
2. Random 50/50 routing
3. Runtime traces capture: latency, accuracy, cost
4. Thompson Sampling learns which variant performs better
5. Automatic rollout of winner

**Same Thompson Sampling that optimizes activity templates now optimizes the code itself.**

### 4. Cost Optimization
**Scenario:** Want to reduce infrastructure costs

**Query:**
```sql
SELECT
  resolver_id,
  SUM(cost_usd) as total_cost,
  COUNT() as call_count,
  AVG(latency_ms) as avg_latency
FROM execution_resolutions
WHERE timestamp > time::now() - 7d
GROUP BY resolver_id
ORDER BY total_cost DESC;
```

Result: "LLM-based resolvers cost $127/week but only used in 3% of activities → replace with pattern matching"

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Performance overhead** | Slower requests | Sampling, async storage, selective instrumentation |
| **Trace volume explosion** | Storage costs | Retention policies, aggregation, sampling |
| **Privacy/security** | Sensitive data in traces | Metadata-only mode, PII filtering, hash-based IDs |
| **False bottleneck detection** | Misleading optimization | Statistical significance checks, min sample size |
| **Complexity** | Harder to debug | Tracing can be disabled per-environment |

## Success Criteria

### Week 1 (Request-Level)
- [ ] Dashboard shows runtime activity patterns
- [ ] Can identify most-called endpoints
- [ ] Trace volume <10MB/day

### Week 2 (Resolver-Level)
- [ ] Dashboard shows resolver performance
- [ ] Can identify bottlenecks (slow + frequent)
- [ ] Overhead <5% (measured via canary comparison)

### Week 3 (Learning)
- [ ] Automated refactoring suggestions
- [ ] Thompson Sampling for code variants works
- [ ] Can compare traces before/after optimization

### Week 4 (Feedback Loop)
- [ ] The substrate creates optimization activities from runtime data
- [ ] Canary deployment shows improvement
- [ ] Winning variants promoted to production

## Future Extensions

### Cross-Vessel Tracing
Track impulse flows **between vessels**:
```
goal-host-vessel (goal received)
  └─> activity-api (fetch templates)
       └─> SurrealDB (query)
            └─> activity-api (return templates)
                 └─> goal-host-vessel (execute activity)
```

Distributed tracing = impulse lineage across vessel boundaries.

### Predictive Optimization
Use ML on runtime traces to predict:
- Which functions will become hot paths
- Which impulse shapes will cause errors
- Optimal cache sizes, connection pool limits

### Self-Healing
When runtime traces detect failures:
1. Create activity: "Debug failure in resolver X"
2. The substrate investigates (reads traces, error logs)
3. Proposes fix
4. Deploys to canary
5. Runtime traces validate fix
6. Auto-promote if successful

**The system debugs itself.**

## Conclusion

Runtime activity tracing extends the process-of-becoming from **development activities** (writing code) to **runtime activities** (executing code).

**Key benefits:**
- Same infrastructure, new timescale
- Unified observability (dev + runtime)
- Evidence-based optimization
- Self-improving codebase

**Alignment with foundation:**
- ✅ Treats runtime data as impulses
- ✅ Uses activities for constrained workflows
- ✅ Resolvers live in application code
- ✅ Records traces for learning
- ✅ No unnecessary LLM usage

**The application becomes a vessel that learns how to optimize itself through continuous execution and trace analysis.**

---

**Next Steps:**
1. Review this proposal
2. Implement Phase 1 (request-level tracing in Activity-API)
3. Validate overhead and trace volume
4. Proceed to resolver-level tracing if successful
