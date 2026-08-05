# Resolver Tracking Architecture

## Overview

The execution host records which resolver served each impulse, so selection can be learned rather than configured. The tier vocabulary below is the durable part: it is carried as `resolverTier` on the task record in the executor's ontology, written to traces as the `resolver_tier` field, and rolled up by development-vessel's advertised `resolver_tier_cost_summary` shape.

> **Foundation alignment:** Resolver-tracking is the data feed for the **forward arm of the two-direction learning duality** (`P(success | activity X resolves pointer of shape Y)`). It complements the reverse arm (slot-binding / Thompson recommendation writes). Both arms must update consistently — see [`IMPULSE_ACTIVITY_FOUNDATION.md`](IMPULSE_ACTIVITY_FOUNDATION.md#two-direction-learning-duality).

## Architecture

```
Activity Execution
  ↓
Load Impulses
  ↓
For each impulse:
  ├─ Try resolver (bash, git, file, discovery, etc.)
  ├─ Measure: startTime, endTime, success
  ├─ Calculate: latency_ms, cost_usd
  └─ Record: {impulse_id, resolver_id, resolver_tier, vessel_id, ...}
       ↓
Store in taskResult.metadata.resolverData
  ↓
Aggregate into execution.impulse_resolutions[]
  ↓
Send to Activity-API backend
  ↓
Store in execution table
  ↓
Enable learning:
  ├─ Which resolvers work best for which shapes
  ├─ Which vessels are fastest
  ├─ Cost optimization opportunities
  └─ Thompson Sampling for resolver selection
```

## Resolver Tiers

| Tier | Description | Example |
|------|-------------|---------|
| `deterministic` | No LLM, fast, zero cost | bash, git, file |
| `pattern` | Pattern matching from history | PreValidationResolver |
| `llm` | LLM reasoning required | LLMResolver with tool calling |

> **Canonical reframe.** These three tiers are **coarse bins of one
> continuous quantity** — the resolver's *directional certainty*: the (inverse)
> expected uncertainty that its output lies along the goal-coplanar tangent of the
> shape hypersurface. `deterministic` = sharp on-manifold direction; `llm` = high
> directional uncertainty. The operative quantity is learnable per-`(resolver,
> signature)` (the forward arm already estimates it), so a resolver's effective
> tier is signature-dependent, not a fixed label. Full treatment:
> [`SUBSTRATE_AS_SOFTWARE.md`](SUBSTRATE_AS_SOFTWARE.md) §4. Note: the
> `LOCAL / CUSTOM / DISCOVERY / MCP / FALLBACK / ERROR` set recorded elsewhere in
> this doc is the **dispatch pathway** (which leg of resolution served the
> impulse), a different field from `resolver_tier` — do not conflate them.

### Per-model LLM sub-resolvers

LLM-tier resolvers are moving toward per-model sub-resolver identifiers stored in the `resolver_id` field: `llmText@haiku`, `llmText@sonnet`, `llmText@opus` (and equivalent per-provider variants when multiple providers are configured). Each sub-resolver accrues its own α/β posterior, cost distribution, and resolver-tier metadata. Traces already record which model was invoked; the sub-resolver identifier promotes that fact to a first-class Thompson key so the substrate can learn which model suffices for which `(resolver, problem-class)` combination.

Routine tasks — keyword extraction, simple validation, slot filling — converge to cheaper models as their posteriors accumulate. Novel or high-stakes tasks — decomposition, cross-domain compliance, security checks — converge to more capable models because cheaper models fail more often and drive β up. The selection mechanism is identical to activity variant selection; no new infrastructure is required. Sub-resolver ids are plain strings in the existing `resolver_id` field, so legacy traces that recorded only `"llm"` remain valid and continue to feed a coarse-grained posterior alongside the per-model ones.

## Data Model

### TaskResult.metadata.resolverData

```typescript
{
  name: string           // Resolver ID
  vesselId: string       // Executing vessel
  tier: string           // Tier (deterministic/pattern/llm)
  inputShapes: string[]  // Required shapes
  outputShapes: string[] // Produced shapes
  duration: number       // Execution duration (ms)
  config: object         // Resolver configuration
}
```

### Execution.impulse_resolutions

```typescript
[{
  impulse_id: string     // Which impulse
  resolver_id: string    // Which resolver
  resolver_tier: string  // Which tier
  vessel_id: string      // Which vessel
  latency_ms: number     // How long
  cost_usd: number       // How much
}]
```

## Learning Applications

### 1. Resolver Selection Optimization

**Goal**: Choose the best resolver for each impulse shape based on historical performance.

**Method**:
- Track success rate per resolver per shape
- Apply Thompson Sampling to select best resolver
- Prefer faster resolvers when multiple options

**Example**:
```typescript
// For shape "activityExecutionTrace"
const resolverStats = {
  'discovery-vessel': { success: 0.95, avgLatency: 120 },
  'mcp-backend': { success: 0.90, avgLatency: 250 },
  'local-cache': { success: 0.60, avgLatency: 10 }
};

// Thompson Sampling selects: discovery-vessel (best balance)
```

### 2. Vessel Performance Tracking

**Goal**: Route requests to healthy, fast vessels.

**Method**:
- Measure latency per vessel
- Detect performance degradation
- Route to faster vessels

**Example**:
```typescript
// Vessel performance over time
const vesselMetrics = {
  'activity-api-pod-1': { avgLatency: 150, p95: 300 },
  'activity-api-pod-2': { avgLatency: 450, p95: 800 }, // degraded!
  'activity-api-pod-3': { avgLatency: 160, p95: 320 }
};

// Route future requests to pod-1 or pod-3
```

### 3. Cost Optimization

**Goal**: Minimize execution cost while maintaining quality.

**Method**:
- Identify expensive patterns
- Prefer deterministic resolvers when available
- Budget allocation decisions

**Example**:
```typescript
// Cost analysis per resolver tier
const costStats = {
  deterministic: { avgCost: 0.000, count: 1500 },
  pattern: { avgCost: 0.002, count: 300 },
  llm: { avgCost: 0.015, count: 50 }
};

// Savings from preferring deterministic: $0.75 per execution
```

### 4. Pattern Recognition

**Goal**: Learn which resolvers work well together.

**Method**:
- Composition optimization
- Prefetching strategies
- Dependency tracking

**Example**:
```typescript
// Common resolver sequences
const patterns = [
  ['git', 'file', 'bash'],           // High success rate
  ['discovery', 'mcp-backend'],      // Fallback chain
  ['local-cache', 'discovery']       // Cache-then-fetch
];
```

### 5. Deterministic Distillation

**Goal**: Replace LLM resolvers with deterministic equivalents on inputs where the LLM output has become predictable.

**Method**: When an LLM resolver consistently produces semantically equivalent outputs for inputs sharing a stable signature — same shape, similar content fingerprint, identical output structure across N executions — the ribosome extracts a deterministic equivalent resolver and registers it as a sibling under the same shape. The distilled resolver starts with a conservative prior (lower α than the LLM resolver) and earns its way up via Thompson as it accumulates its own success traces.

Under cost-weighted selection, the distilled resolver dominates the LLM resolver on routine inputs because its per-call cost is near zero. Over time the LLM call rate for that shape decreases as patterns are extracted. Each successful distillation is an observable substrate self-improvement event: the ratio of `deterministic` to `llm` resolver calls for a shape is a direct readout of how much that problem class has been learned.

**Invariant**: The LLM resolver is never removed — it remains the fallback for inputs that fall outside the distilled resolver's input signature. The distillation is additive, not a replacement.

## Implementation

### The execution host

The executor's ontology (`repos/ias-executor-ts/src/ontology.ts`) carries
`resolverId` and an optional `resolverTier` on each task record, so the identity
and tier of whatever served a task are part of the task's own data rather than a
side channel. Everything downstream is a mapping of those two fields.

Two adapters do that mapping. The trace sink and the activity-api provider
(`repos/ias-executor-ts/src/adapters/activity-api-trace-sink.ts` and
`activity-api-provider.ts`) both project each task to the wire body with
`resolver_id: t.resolverId` and `resolver_tier: t.resolverTier` at the *top* of
the task object — not nested — because that is where activity-api's persisted-task
reader looks. Nesting them stored rows with undefined ids, which broke
learning-loop attribution; flat placement is a contract, not a style
choice. The provider additionally stamps `vessel_id` and `resolved_by_vessel_id`
from the executor's own vessel id and POSTs to
`/v2/activities/execution-traces`, retrying a bounded number of times with
exponential backoff when the request throws or the response is 429/5xx; other
non-OK statuses are logged and the trace dropped rather than aborting execution.
Discarding the parent trace on a transient failure while its
already-posted children survive is what orphans compositions, so the retry is
load-bearing for the composition graph.

Per-impulse resolution rows are emitted by the vessel daemon
(`repos/ias-executor-ts/src/hosts/vessel-daemon.ts`), which publishes a
`task.completed` event carrying an `impulse_resolutions` array whose entries hold
`impulse_id`, `resolver_id`, `resolver_tier`, `vessel_id`, `shape`, `latency_ms`,
and `cost_usd`. A daemon-served resolve is recorded at the `deterministic` tier
with zero cost.

### Activity-API

**Schema**: `repos/activity-api/sql/migrations/067-add-resolver-tracking.surql`
adds the two execution-level rollup fields and their indexes:

```sql
DEFINE FIELD IF NOT EXISTS resolved_by_vessel_id ON execution TYPE option<string>
  COMMENT "Vessel ID that resolved impulses for this execution";
DEFINE FIELD IF NOT EXISTS resolver_tier ON execution TYPE option<string>;

DEFINE INDEX IF NOT EXISTS idx_execution_vessel ON execution FIELDS resolved_by_vessel_id;
DEFINE INDEX IF NOT EXISTS idx_execution_tier ON execution FIELDS resolver_tier;
```

The per-impulse `impulse_resolutions` array needs no field definition of its own:
it rides inside the execution's flexible trace content, so its row shape is a
contract between writer and reader rather than a schema constraint. That is why
the writers above must agree on field names exactly — SurrealDB will not reject a
misspelled key.

**Storage**: `repos/activity-api/src/routes/execution-traces.ts` serves
`POST /v2/activities/execution-traces` (the router is mounted at that path, so
the handler itself is registered on `/`). The handler persists
`impulse_resolutions` only when the incoming trace actually carries it — the
field is appended to the insert conditionally rather than defaulted to an empty
array, so a trace that never resolved an impulse is distinguishable from one
whose resolver data was lost in transit. Trace content of any size (the
multi-KB `tasks`, `impulse_resolutions`, and `composition_chain` arrays) is
stored apart from the row that queries scan, and read back by execution id when a
caller asks for the full trace.

**Retrieval**: resolver and vessel performance are derived by aggregating over
`impulse_resolutions` rather than stored pre-computed, so a new grouping (by
resolver, by vessel, by tier, by shape) costs a query and not a migration.

## Metrics

Track:
- **Resolver usage distribution**: Which resolvers are used most
- **Average latency per resolver**: Performance comparison
- **Success rate per resolver-shape pair**: Reliability tracking
- **Cost per resolver tier**: Budget optimization
- **Vessel performance variance**: Health monitoring

## Example Dashboard Query

```sql
-- Resolver performance summary
SELECT
  resolver_id,
  resolver_tier,
  count() AS usage_count,
  math::mean(latency_ms) AS avg_latency,
  math::sum(cost_usd) AS total_cost,
  count(WHERE success = true) / count() AS success_rate
FROM (
  SELECT
    value.resolver_id AS resolver_id,
    value.resolver_tier AS resolver_tier,
    value.latency_ms AS latency_ms,
    value.cost_usd AS cost_usd,
    true AS success
  FROM execution
  SPLIT impulse_resolutions
)
GROUP BY resolver_id, resolver_tier
ORDER BY usage_count DESC;
```

## Related Documentation

- [Impulse Resolution Sequence](./sequences/02-impulse-resolution.md)
- [Resolver Processing Sequence](./sequences/03-resolver-processing.md)
- [Activity Execution Foundation](./IMPULSE_ACTIVITY_FOUNDATION.md)
- [The substrate as software](./SUBSTRATE_AS_SOFTWARE.md) — §4.1 reframes
  `resolver_tier` as directional certainty; §3 walks the trace through every lens.
