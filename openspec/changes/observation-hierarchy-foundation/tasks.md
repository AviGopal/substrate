## 1. Architecture Documentation

- [ ] 1.1 Create `docs/architecture/OBSERVATION_HIERARCHY.md` — document the multi-scale observation model (layers 0-5+), inter-layer signaling via impulses, alignment as layer coherence, convince/coerce/kill governance framework, and Eigen threshold as design constraint
- [ ] 1.2 Create `docs/architecture/GOVERNANCE_MODEL.md` — document the convince-based governance model, why observation replaces enforcement, the relationship between Thompson Sampling and distributed coordination, and the role of the circuit breaker as apoptosis
- [ ] 1.3 Update `CLAUDE.md` — add section referencing the observation hierarchy as a core design principle, link to new architecture docs, update development focus to reflect observation infrastructure priorities
- [ ] 1.4 Consolidate relevant content from `CORTEX_ANALOGY_THREE_STATE_DYNAMICS.md`, `CONSCIOUSNESS_AS_HIGHEST_PATTERN_LAYER.md`, `MAPPING_SYNTHESIS_CONVICE_COERCE_KILL.md` into the formal architecture docs, keeping originals as historical conversation artifacts

## 2. Fix Thompson Sampling

- [ ] 2.1 Implement `betaSample(alpha, beta)` function using Gamma variate method in `repos/minibob/src/tools.ts` or a shared utility module
- [ ] 2.2 Replace `alpha / (alpha + beta)` with `betaSample(alpha, beta)` in the recommendation logic in `repos/metabob-activity-api/src/routes/activities.ts`
- [ ] 2.3 Add `deterministic: boolean` parameter to the recommendation endpoint for testing — uses expected value when true, actual sampling when false (default)
- [ ] 2.4 Add unit test: verify that with sufficient iterations, a template with alpha=3, beta=1 occasionally beats a template with alpha=100, beta=5
- [ ] 2.5 Add unit test: verify deterministic mode produces reproducible ordering

## 3. Multi-Scale Trace Recording (MiniBob)

- [ ] 3.1 Add `TaskPattern` interface to `repos/minibob/src/types.ts` — `taskId`, `toolSequence`, `toolCallCount`, `retryCount`, `inputTokens`, `outputTokens`
- [ ] 3.2 Add `ActivityPattern` extension to execution trace in `repos/minibob/src/types.ts` — `impulsePointersConsumed`, `impulsePointersProduced`, `dominantToolSequence`, `stateTransitionHash`
- [ ] 3.3 Add `CompositionContext` interface to `repos/minibob/src/types.ts` — `goalId`, `positionInChain`, `predecessorExecutionId`, `successorExecutionId`, `goalCompletedAfterThis`
- [ ] 3.4 Update `ActivityExecutor` in `repos/minibob/src/activity.ts` to aggregate `TaskPattern` entries from tool call records after each task completes
- [ ] 3.5 Update `ActivityExecutor` to compute `stateTransitionHash` from before/after file hashes at end of execution
- [ ] 3.6 Update `ActivityExecutor` to track `impulsePointersConsumed` and `impulsePointersProduced` during execution
- [ ] 3.7 Update `GoalProcessor` in `repos/minibob/src/goal-processor.ts` to populate `CompositionContext` — set `goalId`, `positionInChain`, predecessor/successor IDs, and `goalCompletedAfterThis`
- [ ] 3.8 Add unit test: verify task patterns are correctly aggregated including tool sequences and retry counts
- [ ] 3.9 Add unit test: verify composition context is populated for goal-mediated executions and absent for standalone executions

## 4. Shadow Sampling (MiniBob)

- [ ] 4.1 Update `GoalProcessor.getRecommendations()` to request K=3 samples from backend and record all samples in the execution trace as `shadowSamples`
- [ ] 4.2 Add `ShadowSample` type to `repos/minibob/src/types.ts` — `variantId`, `sampledScore`
- [ ] 4.3 Update execution trace storage to include shadow samples when sending to backend
- [ ] 4.4 Add unit test: verify shadow samples are recorded when goal processor selects a variant

## 5. Convergence Verification (MiniBob)

- [ ] 5.1 Add high-stakes detection heuristic to `GoalProcessor` — configurable thresholds for estimated file modifications and cost
- [ ] 5.2 Implement parallel execution path: when high-stakes, execute top 2 Thompson samples on isolated working copies (git worktree or temp directory)
- [ ] 5.3 Implement state transition comparison: hash-compare modified files across parallel executions, compute convergence score
- [ ] 5.4 Create `convergence_divergence` impulse when parallel executions diverge beyond threshold
- [ ] 5.5 Add unit test: verify high-stakes threshold correctly triggers parallel execution
- [ ] 5.6 Add unit test: verify convergent parallel executions are accepted with high convergence score
- [ ] 5.7 Add unit test: verify divergent parallel executions create anomaly impulse

## 6. Backend Aggregation Endpoints

- [ ] 6.1 Create `repos/metabob-activity-api/src/routes/metrics.ts` with Hono router
- [ ] 6.2 Implement `GET /v2/metrics/system-health?window={1h|24h|7d}` — query execution traces and compute aggregate metrics
- [ ] 6.3 Implement `GET /v2/metrics/tool-patterns?window=Xd&min_frequency=N` — aggregate tool call sequences by frequency and success rate
- [ ] 6.4 Implement `GET /v2/metrics/composition-patterns?window=Xd` — aggregate activity composition chains by frequency and success rate
- [ ] 6.5 Implement `GET /v2/metrics/shadow-patterns?window=Xd` — analyze shadow sample data to identify consistently-sampled-but-not-executed variants
- [ ] 6.6 Create hourly aggregation job (SurrealDB scheduled function or Bun cron) to compute and store `system_health` records
- [ ] 6.7 Register metrics routes in `repos/metabob-activity-api/src/index.ts`

## 7. Template Lifecycle (Backend)

- [ ] 7.1 Add `generationDepth` field to template schema — default 0 for new templates, incremented on ribosome extraction
- [ ] 7.2 Update ribosome extraction endpoint to set `generationDepth = parent.generationDepth + 1` on extracted templates
- [ ] 7.3 Implement daily Thompson score decay job — multiply all alpha and beta by configurable decay factor (default 0.995)
- [ ] 7.4 Implement weekly template pruning job — archive templates with `alpha+beta > 20` and `alpha/(alpha+beta) < 0.3`, archive templates with 0 executions and age > 30 days
- [ ] 7.5 Add generation depth penalty to Thompson Sampling recommendation — reduce effective score by `depth * penalty_factor` (default 0.02 per depth level)
- [ ] 7.6 Implement population cap enforcement — when active template count exceeds max (default 500), archive lowest-scoring template with sufficient observations
- [ ] 7.7 Add template lifecycle configuration endpoint: `GET/PUT /v2/system/template-lifecycle-config`
- [ ] 7.8 Add unit test: verify score decay reduces alpha/beta correctly
- [ ] 7.9 Add unit test: verify pruning archives low-performers and unused templates
- [ ] 7.10 Add unit test: verify generation depth penalty reduces effective Thompson score

## 8. Circuit Breaker

- [ ] 8.1 Create `system_health` SurrealDB table for aggregate health metrics with appropriate indexes
- [ ] 8.2 Create `circuit_breaker_state` SurrealDB table for current pause/active state, reason, timestamp
- [ ] 8.3 Implement `POST /v2/system/circuit-breaker` endpoint — pause/resume with reason
- [ ] 8.4 Implement `GET /v2/system/circuit-breaker` endpoint — return current state and reason
- [ ] 8.5 Add automatic pause trigger logic to health aggregation job — check thresholds after computing metrics
- [ ] 8.6 Update MiniBob `BoredomTaskExecutor` in `repos/minibob/src/boredom.ts` to check circuit breaker state before each polling cycle
- [ ] 8.7 Add unit test: verify manual pause/resume works via API
- [ ] 8.8 Add unit test: verify automatic pause triggers on low success rate
- [ ] 8.9 Add unit test: verify boredom system respects paused state

## 9. Peer Comparison (Backend)

- [ ] 9.1 Create `behavioral_metrics` SurrealDB table for per-resolver and per-activity running statistics grouped by peer category
- [ ] 9.2 Update execution trace storage to compute and store behavioral metrics after each execution
- [ ] 9.3 Implement peer group anomaly detection — after metric update, compare against peer group, create `peer_anomaly` impulse if deviation > 2 standard deviations
- [ ] 9.4 Implement `GET /v2/metrics/peer-anomalies?window=Xd` endpoint — return anomaly history
- [ ] 9.5 Implement `GET /v2/metrics/peer-anomalies?entity_id=X&window=Xd` endpoint — return anomaly trend for specific entity
- [ ] 9.6 Add unit test: verify anomaly detection fires for significant deviation
- [ ] 9.7 Add unit test: verify anomaly detection does not fire for normal variation
- [ ] 9.8 Add unit test: verify anomaly detection skips peer groups with insufficient members

## 10. Integration Testing

- [ ] 10.1 End-to-end test: MiniBob executes activity → trace includes task patterns, activity patterns, state transition hash
- [ ] 10.2 End-to-end test: Goal processor chain → composition context populated with correct predecessor/successor IDs
- [ ] 10.3 End-to-end test: Backend aggregation returns correct system health for time window
- [ ] 10.4 End-to-end test: Circuit breaker pauses boredom when success rate drops
- [ ] 10.5 End-to-end test: Template decay + pruning lifecycle works over simulated time
- [ ] 10.6 Verify `bun test` passes in `repos/minibob`
- [ ] 10.7 Verify `bun test` passes in `repos/metabob-activity-api`
