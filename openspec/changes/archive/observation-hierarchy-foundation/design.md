## Context

The system implements a self-modifying activity execution architecture where activities create activities, resolvers produce resolvers, and Thompson Sampling selects what runs based on historical success. The governance model is observation-based: each layer of the hierarchy observes patterns in the layer below over progressively longer timescales and adjusts conditions that influence lower-layer behavior.

Currently, the only observation layer that functions is single-execution Thompson Sampling — did this activity succeed or fail? There is no infrastructure for detecting patterns across timescales. The Thompson Sampling implementation uses expected value (`alpha/(alpha+beta)`) instead of actual Beta distribution samples, disabling exploration. Templates accumulate indefinitely with no pruning, decay, or generation depth tracking. There is no circuit breaker for autonomous boredom activity. Execution success is self-reported with no structural verification.

The `impulse-pointer-mvp` change (proposed, not yet implemented) provides the foundation: impulse metadata, pointer chains with `producedBy` lineage, resolver registry, and `process_impulse` tool. This change builds the observation infrastructure on top of that foundation.

Architecture documentation currently describes the three-state ontology (vessel/becoming/instance), the cortex analogy, and the convince/coerce/kill governance model, but these exist as standalone markdown files outside the formal architecture directory. The observation hierarchy model — layers, timescales, inter-layer signaling via impulses, alignment as layer coherence — is not documented.

## Goals / Non-Goals

**Goals:**
- Document the observation hierarchy framework in formal architecture docs so it guides all future development
- Implement multi-scale trace recording so higher observation layers can emerge from data accumulation
- Fix Thompson Sampling to use actual Beta distribution samples (restore exploration)
- Add template lifecycle management (pruning, score decay, generation depth) to enforce the Eigen error-catastrophe threshold
- Add convergence-based execution verification using redundant parallel sampling and structural comparison of state transitions
- Add a circuit breaker for autonomous boredom activity
- Add peer comparison infrastructure for behavioral anomaly detection across resolvers and activities

**Non-Goals:**
- Implementing layers 4-5+ of the observation hierarchy directly (these should emerge from data, not be designed)
- Gossip protocol / distributed database (future change, depends on this foundation)
- Changes to the LLM provider or model selection logic
- Automated fitness function discovery (future — requires observation data to accumulate first)
- Changes to repos/metabob-mcp or repos/metabob-analysis-api

## Decisions

### 1. Documentation structure: formal architecture docs + CLAUDE.md updates

**Decision:** Create `docs/architecture/OBSERVATION_HIERARCHY.md` as the primary reference and update `CLAUDE.md` to reference the observation model as a core design principle. Move relevant content from standalone files (`CORTEX_ANALOGY_THREE_STATE_DYNAMICS.md`, `CONSCIOUSNESS_AS_HIGHEST_PATTERN_LAYER.md`, `MAPPING_SYNTHESIS_CONVICE_COERCE_KILL.md`) into structured architecture docs.

**Rationale:** The existing standalone files contain the right ideas but are conversation artifacts, not architectural references. Formalizing them in `docs/architecture/` makes them discoverable by LLM agents (including MiniBob) that read `CLAUDE.md` and follow links to architecture docs. This is itself an example of impulse-based inter-layer signaling — the documentation is an impulse pointer that gives future agents the metadata to understand the system's governance model without loading the full philosophical conversations.

### 2. Multi-scale trace recording via nested trace structure

**Decision:** Extend the execution trace schema with nested observation windows rather than separate tables per timescale.

```typescript
interface MultiScaleTrace {
  // Layer 0: Tool calls (existing, captured per-call)
  toolCalls: ToolCallRecord[]
  
  // Layer 1: Task patterns (NEW — aggregated per-task)
  taskPatterns: {
    taskId: string
    toolSequence: string[]         // ordered tool names
    toolCallCount: number
    retryCount: number
    inputTokens: number
    outputTokens: number
  }[]
  
  // Layer 2: Activity patterns (existing success/cost/duration, EXTENDED)
  activityPattern: {
    templateId: string
    variantId: string
    taskCount: number
    taskSuccessRate: number
    dominantToolSequence: string[]  // most common tool pattern
    impulsePointersConsumed: string[]
    impulsePointersProduced: string[]
    stateTransitionHash: string     // hash of before→after file states
  }
  
  // Layer 3: Composition context (NEW — what goal/chain this is part of)
  compositionContext?: {
    goalId: string
    positionInChain: number         // 1st, 2nd, 3rd activity in goal
    predecessorExecutionId?: string
    successorExecutionId?: string
    goalCompletedAfterThis: boolean
  }
}
```

**Rationale:** A single trace structure with nested layers keeps the data co-located for efficient querying. Layer 4+ metrics (system health over days) are computed by backend aggregation queries over these traces, not stored per-trace. This avoids designing the higher layers — they emerge from queries over the accumulated data.

### 3. Convergence verification via parallel Thompson samples

**Decision:** When the goal processor requests activity recommendations, sample K variants (default K=3) from the actual Beta distributions. Execute the top-ranked variant as primary. Store the other K-1 as "shadow samples" — they are not executed but their Thompson parameters are recorded. When the primary execution completes, compare its state transition hash against what would be expected for the shadow variants (based on historical traces for those variants).

For high-stakes operations (detected by cost threshold or file mutation count), execute 2 variants in parallel on isolated branches and compare state transitions structurally.

```
Standard execution (K=3):
  Sample 3 from Beta distributions → Execute top 1
  Record: which 3 were sampled, which executed, outcome
  Layer 3 can later observe: "When variant X is sampled but Y executes,
  does Y produce outcomes consistent with X's historical profile?"

High-stakes execution (parallel):
  Sample 3 → Execute top 2 in parallel on separate branches
  Compare: state transition hashes, files modified, test results
  Divergence beyond threshold → flag for Layer 4 observation
```

**Rationale:** Full parallel execution of all K samples is expensive. Shadow sampling costs nothing (just recording which were considered) and provides data for higher layers to detect patterns. Parallel execution only kicks in for high-stakes operations where the cost of verification is justified by the cost of undetected error. This mirrors biology: most cell divisions aren't externally verified, but high-stakes processes (DNA replication) have dedicated proofreading mechanisms.

**Alternative considered:** Execute all K in parallel always. Rejected — cost scales linearly with K, and most operations don't warrant it. The shadow sampling approach provides observation data at zero additional execution cost.

### 4. Fix Thompson Sampling: actual Beta distribution samples

**Decision:** Replace `alpha / (alpha + beta)` with `betaSample(alpha, beta)` using the Jinks-Walker method for generating Beta-distributed random variates.

```typescript
function betaSample(alpha: number, beta: number): number {
  // Generate Gamma variates
  const x = gammaSample(alpha, 1)
  const y = gammaSample(beta, 1)
  return x / (x + y)
}
```

**Rationale:** The current expected-value implementation disables exploration entirely. A template with alpha=100, beta=5 always scores 0.952. With actual sampling, it sometimes scores 0.88 and sometimes 0.97 — allowing templates with fewer observations but high potential to occasionally "win." This is the mathematical foundation for the observation hierarchy's exploration capacity. Without it, the system converges prematurely and cannot discover better alternatives.

### 5. Eigen threshold enforcement via template lifecycle

**Decision:** Three mechanisms operating at different timescales:

**Score decay (daily):** Multiply all Thompson alpha and beta values by a decay factor (default 0.995 per day). This means a template with alpha=100 after 100 days of no execution has alpha≈60. The template must continue to demonstrate success to maintain its score. Templates that worked historically but haven't been tested recently lose confidence — exploration naturally increases.

**Pruning (weekly):** Templates with `alpha + beta > 20` (sufficient observations) and `alpha/(alpha+beta) < 0.3` (persistently poor) are archived. They remain in the database for historical reference but are excluded from Thompson Sampling recommendations. Templates with `total_executions = 0` and `age > 30 days` are also archived (never used).

**Generation depth (always):** Each template tracks `generation_depth` — 0 for manually created, +1 for each ribosome extraction. Templates with `generation_depth > 5` require higher Thompson scores to be recommended (selection pressure increases with distance from original). This prevents the photocopying-a-photocopy degradation the distributed systems reviewer identified.

**Rationale:** Eigen's error catastrophe theorem shows that information lost through mutation must be less than information gained through selection. Without these mechanisms, the template library grows without bound, Thompson Sampling effectiveness degrades (too many variants dilute selection pressure), and copied-from-copied templates accumulate errors. Score decay ensures the system tests assumptions rather than relying on historical performance. Pruning bounds library size. Generation depth limits drift.

### 6. Circuit breaker for boredom system

**Decision:** Add a `system_health` table in SurrealDB with aggregate metrics computed hourly. When metrics cross anomaly thresholds, the boredom system pauses.

```typescript
interface SystemHealth {
  timestamp: string
  window: "1h" | "24h" | "7d"
  metrics: {
    overallSuccessRate: number      // across all executions in window
    templateCreationRate: number    // new templates per hour
    averageCost: number             // avg cost per execution
    uniqueTemplatesUsed: number     // diversity measure
    failureCorrelation: number      // are failures correlated or independent?
  }
  status: "healthy" | "degraded" | "paused"
}
```

**Thresholds (configurable):**
- `overallSuccessRate < 0.3` for 24h window → pause boredom
- `templateCreationRate > 10/hour` sustained for 6 hours → pause boredom (runaway replication)
- `failureCorrelation > 0.8` → pause boredom (correlated failures indicate systematic issue)
- Manual pause via `POST /v2/system/circuit-breaker` endpoint

**Resume:** Manual only for first implementation. Future: auto-resume after metrics return to healthy range for 2x the anomaly duration.

**Rationale:** This is apoptosis — the system's ability to stop its own self-modification when observation indicates degradation. The boredom system is the primary source of autonomous activity creation. Pausing it bounds the damage rate during anomalous periods. This directly addresses the philosopher's speed-differential concern: even if higher observation layers take days to detect a problem, the circuit breaker can halt autonomous modification within hours.

### 7. Peer comparison via behavioral metrics

**Decision:** For each resolver and activity template, maintain running statistics on behavioral metrics: median execution duration, median cost, median metadata size, median token count, tool call diversity (unique tools / total calls). Flag any resolver/template whose metrics deviate more than 2 standard deviations from the peer group mean for the same pointer type or goal category.

Flags don't trigger automatic action — they're impulses stored for higher-layer observation. A flag is: `{ type: "peer_anomaly", entity_id: "...", metric: "metadata_size", deviation: 3.2, peer_group: "sql_query resolvers" }`.

**Rationale:** This provides the observation data for detecting the "works correctly but does something unusual" pattern discussed at length. The system doesn't need to know what "unusual" means — it just needs to record deviations. Higher observation layers (currently human, eventually automated) can examine flagged entities and determine whether the deviation is benign or concerning. This is the learned immunity pattern: not a predefined threat database, but anomaly detection that accumulates patterns over time.

## Risks / Trade-offs

**[Risk] Score decay could demote genuinely good templates during low-activity periods** → Decay rate is tunable. Default 0.995/day means a template retains 83% of its score after 100 days. Templates with very high alpha (well-proven) are resistant to decay — they need many days of inactivity before exploration catches up. If the system is active, successful re-executions counteract the decay.

**[Risk] Parallel execution for convergence verification doubles cost for high-stakes operations** → High-stakes threshold is configurable. Default: only operations that modify >5 files or cost >$0.50. Shadow sampling (recording which alternatives were considered without executing them) is free and provides most of the observation value.

**[Risk] Circuit breaker could be triggered by legitimate exploration (new templates naturally fail more)** → The `failureCorrelation` metric distinguishes correlated failures (systematic problem) from independent failures (normal exploration). High exploration produces many independent failures with low correlation. A systematic problem produces correlated failures — same tools fail, same error patterns, same affected files.

**[Risk] Peer comparison generates too many false-positive anomaly flags** → Flags are impulses for observation, not triggers for action. High false-positive rate is tolerable because the flags are just data — higher layers determine which matter. Over time, correlation between flags and actual problems (or lack thereof) is itself observable data.

**[Risk] Multi-scale trace recording increases storage requirements** → Layer 0-2 data is already captured. Layers 1-2 add aggregated summaries (~200 bytes per task, ~500 bytes per activity). Layer 3 composition context adds ~100 bytes. At 1000 executions/day, this is ~800KB/day additional storage. Negligible.

**[Risk] Dependency on impulse-pointer-mvp for convergence verification** → Convergence verification uses impulse pointer chains (`producedBy` lineage, state transition hashes) that are defined in the impulse-pointer-mvp change. If that change is not implemented first, convergence verification degrades to simple success/failure comparison without structural consistency checking. The rest of this change (documentation, Thompson fix, lifecycle, circuit breaker, peer comparison) has no dependency on impulse-pointer-mvp.
