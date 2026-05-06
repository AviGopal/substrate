# Design: Closing the Activity-Reuse RL Loop

**Change ID**: `2026-05-06-activity-reuse-rl-loop`

---

## 1. The system as an RL graph agent

The impulse-activity system is a **contextual-bandit-over-a-typed-shape-graph** that approximates a full graph-RL agent. Mapping the conceptual model onto the deployed components:

| RL element | Implementation |
|---|---|
| **State** | Current impulse pool, captured as `presentShapesPre` in `lifecycle:task:preBinding` events |
| **Action** | Activity (variant) dispatch — selecting one node from a graph of typed activities |
| **Transition** | Output impulse set, captured as `output_impulse_ids` per task and `output_shapes` per activity |
| **Reward** | `task.success` per step; `goal_verification` outcome at episode end; `failure_mode.type` for structured negative reward |
| **Policy** | Thompson Sampling over `activity_metrics.thompson_alpha` / `thompson_beta` |
| **Value function** | `compositionSuccess` edge weights — the empirical success rate of activity → activity transitions |
| **Graph** | Bipartite: activity nodes ↔ shape nodes, with directed produces/consumes edges and activity→activity composition edges |
| **Topology learning** | Ribosome creates new activity nodes from successful improvise walks |
| **Representation** | Static `all-MiniLM-L6-v2` text embeddings + tag hierarchy + Thompson posteriors as node features |
| **Attention / retrieval** | RRF over BM25 + dense + (proposed) tags FTS, gated by shape compatibility |

Two structural gaps remain in the loop:

1. **Thompson is currently global**, not state-conditioned. `context-bucketed-thompson-sampling` (already spec'd, partially deployed) closes this.
2. **Credit assignment terminates at the leaf activity**. A composition chain `A → B → C` that succeeds attributes the success only to `C`. There is no backward propagation. This change adds it.

A third structural concern — that Thompson updates treat all failures identically — is addressed by `failure-mode-stratified-updates` in this change.

---

## 2. Multi-signal relevance: how the signals compose

Six independent relevance signals exist; one is missing (tags); none subsumes the others. The coherent retrieval pipeline:

```
Goal text + impulse_state_space + pointer_state_space
  │
  ├── BM25(name)        ──┐
  ├── BM25(description) ──┼── lexical signal
  └── BM25(tags) [NEW]    ─┘
  │
  └── dense(goal + pool) ──── semantic signal       (dense-semantic-search)
  │
  └── shape compatibility ─── structural signal     (state-space-aware-recommendations)
  │
  └── composition edge ────── contextual signal     (compositionSuccess)
  │
  └── irrelevance score ──── negative signal       (irrelevance-score-feedback)
  │
RRF fusion of ranked lists
  │
Thompson re-ranking using context-bucketed posteriors  (context-bucketed-thompson-sampling)
  │
Selected activity → execute → trace
```

**Key design choice**: signals are rank-fused, not score-fused. Each signal produces an ordering; RRF combines orderings without normalising disparate score scales. Thompson is applied as the final re-ranker over the top-K fused candidates so the policy posterior sees the full retrieval shortlist, not a pre-filtered subset. This matches the structure already in `mergeByRRF` (`paradigm.ts`) — we extend the input set, not the algorithm.

**Tags as the third FTS signal.** `bugfix.auth.tokens`, `feature.vessel.state`, `refactor.test` — these encode hierarchical intent. The existing `activity_analyzer` (camel + class + blank tokenizers, snowball stemming) handles dot-separated tags well: `bugfix.auth.tokens` tokenizes into `bugfix`, `auth`, `tokens`. A FTS index on tags gives users a search dimension that BM25-on-name misses (template names rarely include tag terms verbatim) and that dense embeddings handle inconsistently (semantic distance between "auth bug" and "bugfix.auth" is not zero).

---

## 3. Knowledge accumulation from traces

Traces feed five learning loops at different timescales:

### 3.1 Per-task (immediate)

On every `lifecycle:task:completed`:
- `activityFeedback_write` updates Thompson α (success) or β (failure) on the variant
- `impulse_relevance_metrics` records `(activity_id, shape, present, succeeded)` tuples
- `tool_argument_pattern` records `(tool, args_signature, succeeded)` for PreValidationResolver

### 3.2 Per-execution (epoch)

On `lifecycle:execution:succeeded` / `lifecycle:execution:failed`:
- Ribosome extracts the task graph of successful improvise executions into new template candidates
- `composition_chain` is denormalized for read-time traversal
- Goal-verification produces `goal_verification_labels` rows feeding the oracle corpus

### 3.3 Per-chain (NEW: this change)

On execution completion, **propagate fractional credit backward through `composition_chain`**:
- Direct parent: `α += 0.5` on success / `β += 0.5` on failure
- Grandparent: `α += 0.25` / `β += 0.25`
- Decay factor `γ = 0.5`, capped at 4 levels deep
- Update path: same atomic `+=` operator as P1 in `surrealdb-rl-layer`

This is Monte Carlo return estimation: each ancestor activity gets credit proportional to how recently it preceded the outcome. It mirrors the n-step return in TD(λ) at λ=0 (no bootstrapping, full episode return).

### 3.4 Per-classification cycle (every 6h)

Existing `learning-track-classifier` job evaluates `trace_digest` signal profiles and transitions activities between `unclassified → learning → system`. System-track activities route to `execution_system_traces` so Thompson posteriors aren't diluted by meta-activity self-invocations. No changes needed; this loop is already wired.

### 3.5 Per-validation-campaign (NEW: this change)

The `activity-reuse-validation-harness` runs a fixed benchmark suite weekly (or on-demand), captures retrieval ranks + Thompson posteriors + reuse rates, and emits a longitudinal report. This is *measurement of the loop*, not a new learning signal — but without it we cannot quantitatively answer "is the system improving?"

---

## 4. Pointer/impulse state space → outcomes

The plumbing is in place; the connection is the design intent of this change.

### 4.1 What the trace already records

Every `lifecycle:task:completed` event carries:
```
{
  taskId, activityId, resolverId, resolverTier,
  input_impulse_ids: string[],         // shapes consumed
  output_impulse_ids: string[],        // shapes produced
  presentShapesPre: string[],          // state before
  success: boolean,
  failure_mode: FailureMode | null,    // structured negative reward
  cost_usd: number, duration_ms: number,
}
```

This is `(state, action, reward, next_state)` plus structured failure information. Each task is a transition tuple in MDP terms. The `executionTraceWithSignatures` endpoint exposes them with deterministic per-impulse signatures so downstream learners do not need to re-resolve content.

### 4.2 What this change adds

Two specific connections from state to outcome:

**(a) Failure-mode-stratified updates** (capability spec in this change). Today β increments uniformly on failure. With this change:
- `verifier_negative` (output shapes wrong): lowers `relevance_score` for the activity in `impulse_relevance_metrics` for the input shape set; β += 1 on Thompson posterior
- `budget_exhausted`: β += 0.5 on Thompson; raises `cost_per_success` running average; lowers Thompson prior only when sampled in high-cost contexts
- `safety_breach` (cycle, depth-cap): β += 1 plus marks the (activity, parent_activity) composition edge as `safety_failed`
- `cascading`: β += 0 on this activity (failure was upstream), full β on the upstream activity's `composition_chain` ancestor
- `user_abort`: no posterior change (human override is not negative reward against the activity)

**(b) Composition-chain credit propagation** (capability spec in this change). On every execution outcome:
```
for (i, ancestor_id) in enumerate(composition_chain[-4:]):
    delta = 0.5 ** (depth - i)        // γ-discounted
    if success: alpha[ancestor_id] += delta
    else:       beta[ancestor_id]  += delta
```

Together these two changes mean each trace updates O(N) posteriors (where N = chain depth + 1), each with a structured update rule appropriate to the outcome type. Today each trace updates exactly one posterior with one binary signal.

### 4.3 What is intentionally not done

- **Learned state representations.** Mean-pooling shape embeddings is tempting but premature: shape vocabulary is open-ended and we lack labelled examples. Static `all-MiniLM-L6-v2` plus the tag FTS gives sufficient retrieval signal.
- **Off-policy correction.** Thompson Sampling is on-policy by construction. We do not introduce importance sampling or behaviour-policy correction.
- **Continuous reward.** Reward stays binary success/failure plus the structured failure taxonomy. Cost and duration feed running averages but not Thompson directly.

---

## 5. Validation: how we know it works

The `activity-reuse-validation-harness` (capability spec in this change) defines four observable success criteria, each with a measurement:

### 5.1 Reuse rate over time

**Metric**: `reused_template_executions / total_executions` over a rolling 7-day window, where "reused" means an executed template id existed in the registry at least 24h before the execution and is not the catch-all `improvise`.

**Measurement**: SQL aggregation over `trace_digest`. Baseline established at the first run; report deltas weekly.

**Success criterion**: reuse rate trends upward over 4 consecutive weeks, with `improvise`-share trending downward.

### 5.2 Retrieval quality on a labelled benchmark

**Metric**: Mean Reciprocal Rank (MRR) of the correct activity in the recommend response, computed over a fixed set of `(goal_text, expected_activity_id)` pairs.

**Measurement**: The harness runs the benchmark suite, calls `POST /v2/activities/recommend` for each goal, computes MRR. The benchmark set lives in `validation/activity-reuse-benchmark.json` and is versioned.

**Success criterion**: MRR ≥ 0.6 on the baseline set; +0.05 improvement after enabling tags FTS; +0.10 cumulative after dense search re-enabled.

### 5.3 Thompson convergence

**Metric**: For each known-good activity in the benchmark set, confidence interval width on its Thompson posterior. Narrower CI = more confident estimate.

**Measurement**: The harness pulls `(alpha, beta)` per activity, computes the Beta(α, β) 95% CI width.

**Success criterion**: Top-10 reused templates have CI width < 0.2 after 4 weeks of operation.

### 5.4 Credit propagation correctness

**Metric**: When a multi-step composed activity succeeds, parent activity α counters increment by the expected fractional amount.

**Measurement**: Integration test in the harness — execute a known 3-level composition, snapshot α/β before and after, assert parent receives `0.5`, grandparent `0.25`.

**Success criterion**: Test passes deterministically; no posterior drift from the expected total update budget.

---

## 6. Reference connections to existing specs

This change does **not** redo or supersede any of these. It depends on them.

| Existing spec | Status | Role in this change |
|---|---|---|
| `context-bucketed-thompson-sampling` | Drafted, partial impl | Provides state-conditioned policy; this change's credit-propagation writes go to context-bucketed posteriors when the bucket is computable |
| `dense-semantic-search` | Drafted, blocked on ONNX model in image | Provides the third retrieval rank-list (joining BM25-name, BM25-desc, BM25-tags, dense) |
| `irrelevance-score-feedback` | Drafted, partial impl | Provides the symmetric negative signal — `failure-mode-stratified-updates` writes to `impulse_relevance_metrics` on `verifier_negative` |
| `state-space-aware-recommendations` | Drafted | Provides the impulse-pool / pointer-pool inputs to retrieval; this change's reuse harness uses them to set the recommendation context |
| `surrealdb-rl-layer` (P1, P5A) | Drafted | Provides atomic `α/β +=` and BM25 score fix — credit propagation MUST land on top of P1 to be safe under concurrency |
| `tags-first-classification` | Shipped | Already established `tags: string[]` as canonical; this change indexes that field |

---

## 7. Implementation order

1. **`tags-fts-index`** (smallest, lowest risk) — one migration, one schema update. Lands first to start collecting retrieval-quality data with the new signal.
2. **`failure-mode-stratified-updates`** — server-side update path; no schema change. Lands second; immediately improves posterior quality.
3. **`composition-chain-credit-propagation`** — depends on `surrealdb-rl-layer` P1 (atomic +=). If P1 is not yet shipped, ships them together.
4. **`activity-reuse-validation-harness`** — measurement infrastructure. Can run in parallel with steps 1-3; baselines should be captured *before* step 1 so we can measure the effect of each subsequent change.

---

## 8. Risk and mitigation

**Risk**: Credit propagation amplifies bad activities along long chains (a successful execution propagates credit to ancestors that may have been unrelated). **Mitigation**: γ=0.5 decay caps total propagated credit per outcome at 1.0; depth cap of 4 prevents unbounded propagation; `cascading` failure mode prevents downstream failures from credit-stealing upstream.

**Risk**: Tags FTS index doubles the index footprint on the `activity` table. **Mitigation**: SurrealDB FTS index size is roughly proportional to vocabulary; tags are a small vocabulary (<500 distinct tokens at current scale). Monitor with `INFO FOR INDEX`.

**Risk**: Validation harness adds ongoing run cost. **Mitigation**: Benchmark set capped at 20 prompts; runs weekly, not per-deploy; total cost <$5/week at current minibob cost-per-run.

**Risk**: Failure-mode-stratified updates require all failure modes to be classified upstream. Current code paths still emit `failure_mode: null` for some failure routes. **Mitigation**: Default `null` to `verifier_negative` semantics (the most conservative penalty) and log a warning so we can backfill the classifier coverage.
