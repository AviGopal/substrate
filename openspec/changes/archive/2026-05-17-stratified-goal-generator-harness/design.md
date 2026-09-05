# Design: Stratified Goal-Generator Harness

## Context

The current measurement surface is the Phase 19 two-metric harness
(`openspec/changes/2026-05-06-recommendation-validation-v2/design.md:1`). It is sound
for what it measures: retrieval-vs-ranking attribution on a curated 20-prompt benchmark
plus four behavioral health signals (`improvise_health`, `executability`,
`resolver_coverage`, `reuse_trajectory`). It is insufficient for the claim the
foundation requires.

The foundation says (`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`, and restated
in `2026-04-26-impulse-activity-loop/design.md:25`): "the purpose of the impulse-activity
loop is to discover and continuously refine the topology of the composition graph for
any arbitrary goal — not to execute known recipes." Measuring against 20 fixed prompts
samples a tiny subregion of the reachable subgraph and gives no purchase on
universality. Every weekly report under `validation/results/` since 2026-05-13 reflects
the system's behavior on the same Thompson-pool-anchored set; once the system overfits
that set, the numbers become decoupled from arbitrary-goal performance.

The five reporting dimensions (universality, reuse efficiency, optimality gap,
refinement events, false-positive resistance) are the minimum required to make the
foundation claim measurable. Decision-record completeness is the introspectability
multiplier: without it, none of the other dimensions are debuggable when they regress.

---

## A. Goal-Generator Architecture

### A.1 Stratification axes

The generator emits goals stratified along four orthogonal axes:

**Axis 1 — Shape-signature novelty.** A "shape signature" is the unordered set
`(input_shapes, output_shapes)` of a target solution path. The signature pool is
populated by scanning the `executionTraceWithSignatures` shape (defined in `CLAUDE.md`
"impulses" → activity-api read resolvers, fields `impulses_by_id`, per-task
`input_impulse_ids`/`output_impulse_ids`). Each trace contributes one observed
signature. Levels:

- `seen` — signature occurred in ≥ 5 traces in the last 30 days.
- `rare` — signature occurred in 1–4 traces in the last 30 days.
- `novel` — signature has never co-occurred in any trace.

**Axis 2 — Decomposition depth required.** The shortest path that produces all of the
goal's `expected_output_shapes` starting from `seed_impulse_pool` measured in number of
`create-shape-provider-goal` escalations. Levels: `0` (all output shapes producible
directly), `1`, `2`, `3+`. Determined statically by walking the discovery-vessel shape
registry plus the activity-template `output_shapes` index.

**Axis 3 — Topology-gap band (Scenarios A/B/C/D).** Borrowed from Phase 22's design
language (`2026-04-26-impulse-activity-loop/design.md:1184`):

- **A — Rich topology**: every required shape has ≥ 1 known producer with `α/(α+β) > 0.5`.
- **B — Sparse topology**: at least one required shape has a producer but with
  `total_executions ≤ 2` (cold posterior).
- **C — Missing activity, extant vessel**: no template produces the shape but a
  connected vessel advertises a resolver for it (discovery-vessel registry contains
  the shape but no `activity_template` outputs it).
- **D — Missing vessel, forge required**: no connected vessel advertises the shape.
  Requires Phase 22 to be deployed; until then, generator marks these
  `gated_on_phase_22`.

**Axis 4 — Adversarial perturbation.** A boolean. When `true`, the generator takes a
passing prompt from a prior report and mutates it to require a slightly different
shape signature. Two perturbation modes:

- `swap_output_shape`: replace one shape in `expected_output_shapes` with a sibling
  shape (same parent tag in the hierarchy).
- `narrow_constraint`: keep the same shapes but add a content-level constraint
  ("...and the diff must touch exactly two files") that the verifier will check.

Perturbation mode uses an LLM call (one per generated goal, seeded prompt) — the only
LLM usage at generation time. The seed and the LLM model id are recorded in the report.

### A.2 Cell taxonomy

The cross-product of the four axes is 3 × 4 × 4 × 2 = 96 cells. Many are sparse or
infeasible (e.g. `(novel, depth=0, scenario A)` is rare by definition). The harness
collapses this to a **24-cell working grid**: `(novelty ∈ {seen, rare, novel}) × (depth
∈ {0, 1, 2+}) × (scenario ∈ {A, B, C∪D})` × no adversarial split (adversarial entries
are run alongside but reported as a separate slice rather than another grid axis). The
collapse is mechanical and documented in the spec; future expansion is a versioned
change to the grid definition.

### A.3 Seed reproducibility

The generator is invoked as:

```
bun run validation/scripts/goal-generator.ts \
  --seed <uint64> \
  --count 50 \
  --novelty-mix 0.4,0.4,0.2 \    # fractions for seen/rare/novel
  --depth-mix 0.5,0.3,0.2 \      # fractions for 0/1/2+
  --scenario-mix 0.6,0.2,0.2 \   # fractions for A/B/C∪D
  --adversarial-fraction 0.1 \
  --output validation/generated/<seed>-<date>.json
```

Same seed + same canary state (shape registry snapshot hash) → same 50 prompts. The
shape-registry-snapshot hash is computed at the start of the run by hashing the
sorted list of `(shape, owning_vessel_id)` tuples from discovery-vessel and is
written into every emitted goal. Two runs with the same seed but different snapshot
hashes are NOT comparable; the harness flags this in the report.

### A.4 Quarterly rotation

The generator is reproducible-on-demand, so a quarterly rotation procedure is:
"drop the cached generated suite under `validation/generated/`, pick a new seed,
re-run." There is no migration burden — the old generated suites stay on disk as
historical artefacts for retrospective comparison.

---

## B. Coverage-Matrix Schema

Reported as `coverage_matrix` in the JSON output, keyed by cell:

```json
"coverage_matrix": {
  "seen|depth0|A": {
    "sample_count": 8,
    "success_rate": 0.875,
    "cost_p50_usd": 0.012,
    "reuse_efficiency": 0.81,
    "improvise_share": 0.0,
    "decision_record_completeness": 0.93,
    "witness_disagreement": 0.0,
    "floor_pass": true
  },
  "novel|depth2|C∪D": {
    "sample_count": 3,
    "success_rate": 0.0,
    "cost_p50_usd": null,
    "reuse_efficiency": null,
    "improvise_share": null,
    "decision_record_completeness": null,
    "witness_disagreement": null,
    "floor_pass": false,
    "floor_status": "gated_on_phase_22"
  },
  ...
}
```

Per-cell floors (initial; tunable):

| metric                          | floor   | direction                          |
|---------------------------------|---------|------------------------------------|
| `success_rate`                  | ≥ 0.30  | per-cell, sample ≥ 3               |
| `reuse_efficiency`              | ≥ 0.40  | per-cell, sample ≥ 3 and depth ≥ 1 |
| `decision_record_completeness`  | ≥ 0.80  | per-cell, sample ≥ 3               |
| `witness_disagreement`          | ≤ 0.15  | per-cell, sample ≥ 3               |

`floor_pass = AND(all applicable floors)`. The report's top-level field
`universality_pass` is `AND(floor_pass over all cells where sample_count ≥ 3 and
floor_status != "gated_on_phase_22")`.

---

## C. Reuse-Efficiency Formula

Per goal trace, walk `composition_chain` plus per-task records:

```
total_cost          = Σ tasks[i].cost_usd
reused_task_cost    = Σ tasks[i].cost_usd
                        where tasks[i].activity_id ∈ thompson_pool_ids
                        AND tasks[i].activity_id NOT contains "improvise"
                        AND template_created_at < (executed_at - 24h)
reuse_efficiency    = reused_task_cost / total_cost   (0 if total_cost == 0)
```

`thompson_pool_ids` is the set of activity IDs appearing in the Thompson snapshot
(captured by `captureThompsonSnapshot` in `reuse-harness.ts:36`). The 24-hour template
recency guard matches the existing `activity-reuse-validation-harness` definition
(`activity-reuse-validation-harness/spec.md:56`).

The cell-level metric is the **mean over goals in the cell**, NOT the cost-weighted
mean across cells (small cells would otherwise be invisible).

---

## D. Optimality-Gap Tracking

### D.1 Cache location

`validation/state/shortest-paths.json`. Schema:

```json
{
  "cell_id": {
    "shortest_cost_usd": 0.034,
    "shortest_chain": ["activity:goal-resolve", "activity:⟨validator-dispatch⟩"],
    "shortest_observed_at": "2026-05-17T...",
    "observation_count": 7
  }
}
```

`cell_id` here is the goal-class key (`<novelty>|depth<n>|<scenario>` plus a
content-stable hash of the goal's `expected_output_shapes` to differentiate
shape-distinct goals within a cell).

### D.2 Update rule

After each successful trace:

```
if cell_id not in cache:
  cache[cell_id] = { shortest_cost_usd: this_cost, shortest_chain: this_chain,
                     shortest_observed_at: now, observation_count: 1 }
elif this_cost < cache[cell_id].shortest_cost_usd:
  cache[cell_id].shortest_cost_usd = this_cost
  cache[cell_id].shortest_chain = this_chain
  cache[cell_id].shortest_observed_at = now
  cache[cell_id].observation_count += 1
else:
  cache[cell_id].observation_count += 1
```

### D.3 Eviction

Any entry with `shortest_observed_at` older than 90 days AND `observation_count < 3`
is evicted on the next run start. This prevents stale paths from pinning the gap
when the topology has changed beneath them.

### D.4 Reporting

Per cell:

```
optimality_ratio = mean(this_run_cost / cache.shortest_cost_usd)
                   over successful traces in the cell
```

The cell is flagged `closing` if the ratio in the current run is < ratio in the prior
run by ≥ 5%, `stable` if within ±5%, `regressing` if > 5% larger.

---

## E. Refinement-Event Detection

Three signature-shift detectors run pairwise between the current run's traces and the
prior run's traces for the same `cell_id` (matched by stable shape-hash within the
cell).

### E.1 Compression event

Trigger: median chain length over successful traces in the cell decreased by ≥ 1, AND
median `success_rate` did NOT decrease.

```json
{ "type": "compression", "cell_id": "...",
  "median_chain_length_prior": 4, "median_chain_length_current": 2,
  "success_rate_prior": 0.80, "success_rate_current": 0.85 }
```

### E.2 Tier-descent event

For each task position in the chain (matched by output_shape produced), check if
`resolver_tier` changed in the descent direction `llm → pattern → deterministic`. A
cell-level event fires when ≥ 30% of tasks at a given chain position descended.

```json
{ "type": "tier_descent", "cell_id": "...", "chain_position": 1,
  "prior_tier_distribution": {"llm": 0.7, "pattern": 0.2, "deterministic": 0.1},
  "current_tier_distribution": {"llm": 0.3, "pattern": 0.4, "deterministic": 0.3} }
```

### E.3 CI-narrowing event

For the dominant activity in the cell's chain (most-frequent `activity_id`), check
`ci_width_delta` from the Thompson snapshot (field defined in
`activity-reuse-validation-harness/spec.md:46`). Trigger: `ci_width` decreased by
≥ 0.05 across consecutive runs AND `total_executions` grew by ≥ 5 in the same window
(so the narrowing reflects new evidence, not numerical noise).

### E.4 Output

Events are written to `validation/results/<date>-refinement-events.json`. The
top-level report includes `refinement_event_count` (total) and
`refinement_event_density` (events / total traces in the run).

---

## F. Decision-Record Schema

### F.1 Persisted shape

Per task in a trace, the recommendation handler MUST emit a `decision_record` field:

```json
"decision_record": {
  "candidates": [
    { "activity_id": "...", "fts_rank": 1, "dense_rank": 3, "rrf_score": 0.84,
      "thompson_alpha": 14.2, "thompson_beta": 3.1, "thompson_sample": 0.81,
      "shape_compatible": true },
    { "activity_id": "...", "fts_rank": 2, "dense_rank": 1, "rrf_score": 0.79,
      "thompson_alpha": 8.0, "thompson_beta": 5.0, "thompson_sample": 0.62,
      "shape_compatible": true },
    ...
  ],
  "selected_activity_id": "...",
  "rationale_tier": "thompson_sample" | "shape_constraint" | "fallback_improvise",
  "fallback_tier": "fts_hybrid" | "dense_only" | null
}
```

Today the `selection_metadata` field on the **winning** recommendation already carries
`alpha`, `beta`, and `sample` (`reuse-harness.ts:37`). The new requirement is to
persist the **loser** rows as well. This is a one-field addition in the activity-api
recommend handler.

### F.2 Completeness metric

A task's decision-record is "complete" iff `decision_record.candidates.length ≥ 3`
(or the recommend response returned < 3 candidates, in which case we accept N) AND
every candidate has all six fields (`fts_rank`, `dense_rank`, `rrf_score`,
`thompson_alpha`, `thompson_beta`, `thompson_sample`) populated AND `rationale_tier`
is non-null.

The cell metric is `complete_tasks / sampled_tasks`. Sampling: up to 5 tasks per
trace, ordered by decreasing `cost_usd` (LLM-tier tasks are the ones we most need
to introspect).

---

## G. Differential-Solve Protocol

### G.1 When to force a second run

For 10% of generated goals per run, sampled deterministically by seed (so the
"witness budget" is stable across runs), the harness:

1. Captures the activity_id chosen by Thompson sampling on the first run.
2. Re-dispatches the same goal with `?exclude_variant=<first_activity_id>` on the
   recommend endpoint (new flag — minor handler change). The second run runs against
   the second-best Thompson-elected variant.
3. Records both traces.

### G.2 Output normalization

Two output sets agree iff:

- They produce the same set of `output_shapes` (set equality).
- For each produced shape, the body normalises to the same value under a per-shape
  normaliser (e.g. for `fileEdit`, compare the resulting file content hash after
  applying the diff; for `validation_result`, compare the `passed` boolean and the
  `failure_mode.type`).

The per-shape normalisers live in `validation/lib/output-normalizers.ts`. Shapes
without a registered normaliser fall back to JSON-canonical string equality.

### G.3 Disagreement-rate computation

```
disagreement_rate = differing_witness_pairs / total_witness_pairs
```

Reported per cell and aggregate.

### G.4 Oracle-corpus arm

In addition to differential-solve, for goals tagged with an `oracle_label_id` (linking
to a row in `goal_verification_labels`, migration 101), the harness compares the
trace's `output_shapes` against the labelled expected output. Disagreement with the
oracle is reported as a **separate** rate: `oracle_disagreement_rate`.

### G.5 Validator-consensus arm

The `validator-dispatch` meta-activity (see Phase 18.3 references in the umbrella
tasks) emits a `validation_result` impulse on every task completion. The harness
reads these from the trace and computes `validator_disagreement_rate = fraction of
successful traces where validator-dispatch returned passed=false`.

The three disagreement rates form the false-positive picture.

---

## H. Held-Out Suite Rotation

### H.1 Generation cadence

Each weekly run, the generator emits an additional `--count 8 --held-out` suite using
the weekly seed `(YYYY_WW_held_out_v1)`. This suite is run **first** and its results
are written to a distinct file `<date>-held-out-report.json`.

### H.2 Contamination check

After the held-out suite runs, the harness compares:

```
contamination_delta = mean(success_rate over rolling-pool cells)
                       - mean(success_rate over held-out cells)
```

A delta > 0.15 is flagged as `contamination_suspected`. The interpretation: the
system performs better on prompts it has seen before than on freshly generated ones —
which is fine for short-term productivity but means the rolling-pool numbers
overstate universality.

### H.3 Promotion

After one week of observation, the held-out suite is folded into the rolling pool
for subsequent runs. This keeps the rolling pool growing; the held-out slot stays
freshly generated.

---

## I. Reporting JSON Schema

```json
{
  "harness_version": "<commit-sha>",
  "generator_seed": 1234567890,
  "shape_registry_snapshot_hash": "sha256:...",
  "ran_at": "2026-05-17T09:00:00Z",
  "baseline_ref": "validation/results/2026-05-10-stratified-report.json",
  "summary": {
    "total_goals": 50,
    "successful_goals": 38,
    "universality_pass": false,
    "cells_below_floor": ["novel|depth2|C∪D", "rare|depth1|B"],
    "cells_gated_on_phase_22": ["novel|depth1|C∪D", "novel|depth2|C∪D"],
    "reuse_efficiency_mean": 0.62,
    "optimality_ratio_mean": 1.34,
    "refinement_event_count": 7,
    "refinement_event_density": 0.14,
    "decision_record_completeness": 0.71,
    "witness_disagreement_rate": 0.06,
    "oracle_disagreement_rate": 0.03,
    "validator_disagreement_rate": 0.04,
    "contamination_delta": 0.08
  },
  "coverage_matrix": { ... },
  "shortest_paths": { ... },
  "refinement_events": [ ... ],
  "goals": [ { /* per-goal traces, decision records, witnesses */ } ]
}
```

---

## J. Worked Example

A single synthetic goal traced end-to-end through the harness.

**Generator output (seed=42, goal #17):**

```json
{
  "id": "gen-42-017",
  "cell_id": "rare|depth1|B",
  "shape_signature": {
    "input": ["file", "directoryTree"],
    "output": ["fileEdit", "validation_result"]
  },
  "goal_text": "rename the helper used in src/util/string-trim.ts to camelCase and update all call sites",
  "expected_output_shapes": ["fileEdit", "validation_result"],
  "seed_impulse_pool": ["file:src/util/string-trim.ts", "directoryTree:src"],
  "adversarial": false,
  "oracle_label_id": null
}
```

**Live trace (cost $0.018, 4 tasks):**

```
task 0: resolver=bash         tier=deterministic  cost=$0.001  output=directoryTree
task 1: resolver=llm          tier=llm            cost=$0.012  output=fileEdit
task 2: resolver=bash         tier=deterministic  cost=$0.002  output=fileEdit
task 3: resolver=validation   tier=pattern        cost=$0.003  output=validation_result
composition_chain = ["activity:goal-resolve", "activity:⟨rename-symbol-and-update-callers⟩"]
```

**Decision-record (sampled task 1):**

```json
{
  "candidates": [
    {"activity_id": "activity:⟨rename-symbol-and-update-callers⟩",
     "fts_rank": 1, "dense_rank": 2, "rrf_score": 0.87,
     "thompson_alpha": 6.0, "thompson_beta": 2.0, "thompson_sample": 0.73,
     "shape_compatible": true},
    {"activity_id": "activity:⟨bulk-find-replace⟩",
     "fts_rank": 3, "dense_rank": 1, "rrf_score": 0.81,
     "thompson_alpha": 4.0, "thompson_beta": 4.0, "thompson_sample": 0.51,
     "shape_compatible": true},
    {"activity_id": "activity:improvise",
     "fts_rank": null, "dense_rank": null, "rrf_score": null,
     "thompson_alpha": 22.0, "thompson_beta": 18.0, "thompson_sample": 0.49,
     "shape_compatible": true}
  ],
  "selected_activity_id": "activity:⟨rename-symbol-and-update-callers⟩",
  "rationale_tier": "thompson_sample",
  "fallback_tier": "fts_hybrid"
}
```

**Metric outputs for this goal:**

1. **Coverage matrix contribution** — `rare|depth1|B`: `success_rate++`,
   `cost_p50` updated, `reuse_efficiency = 0.83` ((0.001+0.002+0.003)/0.018 = 0.33
   for the *non-LLM* portion; but reuse-efficiency counts task cost in templates
   that exist in the Thompson pool — both tasks 0,2,3 used templates in the pool →
   $0.006/$0.018 = 0.33; tweak: if we also count the chain-level reuse,
   `rename-symbol-and-update-callers` is itself in the pool so its cost-share counts
   as reused → reuse_efficiency = 1.0). The harness uses the **chain-level** rule
   (an activity whose template is in the pool counts as reused; the activity's
   sub-tasks aren't double-counted).
2. **Optimality gap** — `cache["rare|depth1|B|<shape_hash>"]` was 0.024 from a prior
   run; this run is 0.018; ratio = 0.018/0.024 = 0.75, cell flagged `closing`.
3. **Refinement event** — across cell `rare|depth1|B`, median chain length was 5 last
   week and is 4 this week with success_rate held; **compression event emitted**.
4. **Decision-record completeness** — task 1's record is complete (3 candidates, all
   six fields, rationale_tier set). Cell contribution: 1/1 sampled task complete.
5. **Witness disagreement** — this goal was selected for differential-solve. Second
   run used `activity:⟨bulk-find-replace⟩`. Both produced `fileEdit` +
   `validation_result`. The resulting file content hashes matched; the
   `validation_result.passed` matched. **No disagreement.**

---

## Invariants

1. **Same seed + same shape_registry_snapshot_hash → same goals.** The generator MUST
   refuse to run if the snapshot hash differs from a baseline's hash without an
   explicit `--allow-snapshot-drift` flag.
2. **Adversarial-perturbation LLM calls are seeded.** Temperature 0, model id and
   prompt hash recorded in the report.
3. **Loser candidates persisted on every recommend call** once decision-record
   completeness is required. The activity-api recommend handler must NOT silently
   drop the loser list when the response is large; if truncation is needed, top-K
   losers (K=5) are kept.
4. **Cells gated on Phase 22 do NOT count against universality_pass** until the forge
   ships. The report explicitly enumerates them in `summary.cells_gated_on_phase_22`.
5. **The held-out suite is run BEFORE the rolling pool** so the Thompson posterior is
   not warmed by rolling-pool runs in the same session.
