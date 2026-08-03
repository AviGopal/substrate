# Resolver Tracking Architecture

## Overview

The execution host records which resolver served each impulse, so selection can be learned rather than configured. The tier vocabulary below is the durable part: it is carried as `resolverTier` in the executor's ontology and advertised as `resolver_tier` by development-vessel.

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

> **Canonical reframe (2026-06).** These three tiers are **coarse bins of one
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


**Function**: `executeWithResolver()` (line 2915+)

```typescript
async function executeWithResolver(impulse: Impulse, resolver: Resolver): Promise<ResolverResult> {
  const startTime = Date.now();

  try {
    const result = await resolver.resolve(impulse);
    const endTime = Date.now();

    // Track resolver metadata
    const resolverData = {
      name: resolver.id,
      vesselId: resolver.vesselId || 'local',
      tier: resolver.tier,
      inputShapes: [impulse.pointer.type],
      outputShapes: result.shapes || [],
      duration: endTime - startTime,
      config: resolver.config || {}
    };

    // Store in task result
    taskResult.metadata.resolverData = taskResult.metadata.resolverData || [];
    taskResult.metadata.resolverData.push(resolverData);

    return result;
  } catch (error) {
    // Track failure
    const endTime = Date.now();
    // ... error handling ...
  }
}
```

**Function**: `execute()` - Aggregate and send to backend

```typescript
async function execute(activity: Activity): Promise<ExecutionResult> {
  // ... execute tasks ...

  // Aggregate resolver data from all tasks
  const impulseResolutions = [];

  for (const taskResult of taskResults) {
    if (taskResult.metadata?.resolverData) {
      for (const resolverData of taskResult.metadata.resolverData) {
        impulseResolutions.push({
          impulse_id: resolverData.inputShapes[0], // Simplified
          resolver_id: resolverData.name,
          resolver_tier: resolverData.tier,
          vessel_id: resolverData.vesselId,
          latency_ms: resolverData.duration,
          cost_usd: calculateCost(resolverData.tier, resolverData.duration)
        });
      }
    }
  }

  // Include in execution trace
  const trace = {
    // ... other trace fields ...
    impulse_resolutions: impulseResolutions,
    resolved_by_vessel_id: getPrimaryVesselId(impulseResolutions)
  };

  // Send to backend
  await mcp.storeExecutionTrace(trace);

  return result;
}
```

### Activity-API

**Schema**: `sql/064-add-resolver-tracking.surql`

```sql
DEFINE FIELD impulse_resolutions ON TABLE execution TYPE option<array<object>>;
DEFINE FIELD resolved_by_vessel_id ON TABLE execution TYPE option<string>;

-- Index for querying by vessel
DEFINE INDEX idx_execution_vessel ON TABLE execution COLUMNS resolved_by_vessel_id;
```

**Storage**: `src/routes/execution-traces.ts`

```typescript
app.post('/v2/activities/execution-traces', async (c) => {
  const trace = await c.req.json();

  // Store trace with resolver data
  const result = await db.create('execution', {
    ...trace,
    impulse_resolutions: trace.impulse_resolutions || [],
    resolved_by_vessel_id: trace.resolved_by_vessel_id || null
  });

  return c.json({ id: result.id }, 201);
});
```

**Queries**: `src/db/paradigm.ts`

```typescript
// Get resolver performance by shape
async function getResolverPerformance(shape: string) {
  const query = `
    SELECT
      impulse_resolutions[WHERE impulse_id CONTAINS $shape] AS resolutions
    FROM execution
    WHERE impulse_resolutions IS NOT NULL
  `;

  const results = await db.query(query, { shape });

  // Aggregate stats
  const stats = {};
  for (const result of results) {
    for (const resolution of result.resolutions) {
      if (!stats[resolution.resolver_id]) {
        stats[resolution.resolver_id] = {
          count: 0,
          totalLatency: 0,
          totalCost: 0
        };
      }
      stats[resolution.resolver_id].count += 1;
      stats[resolution.resolver_id].totalLatency += resolution.latency_ms;
      stats[resolution.resolver_id].totalCost += resolution.cost_usd;
    }
  }

  return stats;
}

// Get vessel performance
async function getVesselPerformance(vesselId: string) {
  const query = `
    SELECT
      impulse_resolutions[WHERE vessel_id = $vesselId] AS resolutions
    FROM execution
    WHERE resolved_by_vessel_id = $vesselId
  `;

  const results = await db.query(query, { vesselId });

  // Calculate metrics
  const latencies = results.flatMap(r => r.resolutions.map(res => res.latency_ms));

  return {
    count: latencies.length,
    avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    p50: percentile(latencies, 0.5),
    p95: percentile(latencies, 0.95),
    p99: percentile(latencies, 0.99)
  };
}
```

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
- [CLAUDE.md Trace Model](../../CLAUDE.md#execution-trace-model)
- [Activity Execution Foundation](./IMPULSE_ACTIVITY_FOUNDATION.md)
