# Learning-Rate Mechanism 3: Background Trace Replay for New Templates

**Status:** proposal
**Date:** 2026-06-04
**Parent concept:** `concept_TbN0eSf7U_hM` (learning_rate_improvement_mechanisms)
**Anchor concept:** `concept_YinkepAheImS` (background_trace_replay_for_new_templates)
**Gate concept:** `concept_7mzv7SQN_7JB` (4-primitive / 3-scope refinement rule)
**Sibling change:** `openspec/changes/2026-06-04-learning-rate-1-embedding-conditioned-posterior/`

## Substrate concept anchors

The substrate already encodes the mechanism this change ships, as a `derived_from`
child of `learning_rate_improvement_mechanisms`:

- `concept_YinkepAheImS` (shape: `background_trace_replay_for_new_templates`)
  — "When new template authored, replay historical traces whose input shapes
  match its input_shapes set. Counterfactually evaluate task graph on recorded
  inputs; write α/β updates from replay outcomes at weight 0.3 of live. HER-style;
  uses already-paid trace cost."

Related anchors:

- `concept_TbN0eSf7U_hM` — parent; the 8-mechanism index. Gate concept
  `concept_7mzv7SQN_7JB` restricts each child to refine the existing
  primitives (impulse / activity / signature / Thompson / scope). This change
  refines **Thompson** (off-policy α/β updates) and **execution traces**
  (counterfactual reuse), introducing **no** new tier or category.
- `concept_uTVZPoaxMmo2` (concept_conditioned_thompson_prior) and
  `concept_vugylIHzIMvk` (embedding_conditioned_thompson_posterior) cover the
  *prior* side of cold-start. Trace replay covers the *update* side: even
  with a good prior, sample-count remains zero until traffic arrives. Replay
  generates that first batch of samples from sunk-cost data.
- `concept_5d70xCyICRt5` (architectural_pattern_principle: "every execution is
  traced") — the foundation that makes replay possible. Without recorded
  `input_impulse_shapes`, `output_impulse_shapes`, `tasks[].input_impulse_ids`,
  and `tasks[].output_impulse_ids` (`repos/metabob-activity-api/src/routes/execution-traces.ts:249`,
  `:613`, `:1618-1619`), there is nothing to replay against.
- `concept_W9CzngXfixvh` ("concept_learning_currently_cold_start_dominated") —
  the empirical justification: live validation shows nearly all cells have
  zero non-cold-start signal. New templates inherit this pathology by default.

## Problem

Newly-authored templates (operator-written, drafter-emitted, or ribosome-extracted
via `repos/ribosome-vessel/src/index.ts`) start with Beta(1,1) priors on every
`(state_signature, template, task)` cell. Until live dispatch routes traffic
through them — typically days, sometimes never, on the long tail — the
posterior carries no information, Thompson selection is uniform-random over
the new template vs. incumbents, and the substrate cannot tell a useful new
template from a useless one. This is the **sample-per-cell bottleneck** named
in `concept_TbN0eSf7U_hM`.

Meanwhile, the trace store contains thousands of historical executions whose
`input_impulse_shapes` overlap the new template's `input_shapes`. Each is a
sunk-cost sample of "what inputs were available, what outcome occurred under
the *incumbent* template." The new template was not run against them, but its
task graph is small, declarative, and cheap to *counterfactually* evaluate.

## Mechanism

When a new template is registered (or substantially updated), spawn a
**background replay job** that:

1. Queries `activity_execution_traces` for traces whose
   `input_impulse_shapes ⊇ new_template.input_shapes` (subset-match — the
   replay run has at least the inputs it needs; extra inputs are dropped).
2. For each match (up to a cap, e.g. 50 traces by recency-weighted
   stratified sample), reconstructs the impulse pool from
   `executionTraceWithSignatures` (`repos/metabob-activity-api/src/routes/execution-trace-with-signatures.ts`),
   which already hydrates per-task `input_impulse_ids` + `output_impulse_ids`
   into an `impulses_by_id` map.
3. Issues **one LLM judgement call** through `llm-resolver-vessel`
   (`repos/llm-resolver-vessel/src/index.ts:60` — `llm_completion` resolver)
   asking: "given these recorded inputs and this proposed task graph
   `<new_template.tasks>`, would the new template have produced an outcome
   that satisfies the goal-shape contract? Score 0..1; cite which task
   would have differed."
4. Writes a Thompson posterior update through `impulseRelevance_write`
   (`repos/metabob-activity-api/src/routes/impulses.ts:2421-2427`) and
   `activityFeedback_write` with a **replay weight w_replay = 0.3** instead
   of the 1.0 used for live traces.

The mechanism is **Hindsight Experience Replay** (Andrychowicz et al. 2017,
arXiv:1707.01495) adapted to a structured, discrete action space:
- HER's "imagined goal relabeling" → our "counterfactual template substitution
  on recorded inputs".
- HER's "off-policy update" → our weighted α/β increment with w<1.

## Math: why importance-weight 0.3 (and what to do better)

**Off-policy correction.** Let π_live denote the live-dispatch policy and
π_replay the replay policy (which deterministically picks the new template
on every shape-match). The unbiased off-policy estimator for the reward of
π_replay against trace distribution induced by π_live uses importance
weight ρ = π_replay(a|s) / π_live(a|s). For shape-matched traces ρ is
typically >> 1 (live almost never picked the not-yet-existing template),
producing high variance. A standard variance-reduction is **truncated
importance sampling** (Ionides 2008): clip ρ at some τ. The 0.3 figure in
`concept_YinkepAheImS` is a uniform clip-and-shrink: treat every replay
sample as worth 0.3 live samples, regardless of true ρ.

**Why 0.3 rather than 1.0:**

- *LLM-judge error.* Counterfactual evaluation is itself an LLM call;
  it has its own error rate (call it ε_judge ≈ 0.1-0.2 on structured
  scoring). Treating its output as ground truth biases the posterior.
  Shrinking by ~0.3 budgets ~3 replay samples ≈ 1 live sample.
- *Covariate shift.* The recorded inputs were collected under π_live,
  which preferentially routes to high-success incumbents — the *easy*
  inputs are over-represented. A new template that scores well on
  easy inputs may not generalise. Shrinkage limits the damage of this
  selection bias.
- *Replay-replay correlation.* All replays for a given template are
  judged by one LLM model; their errors are correlated, not independent.
  Effective sample size is < N_replays.

**Defensible default:** start with w_replay = 0.3 as the anchor specifies.
Treat it as a tunable hyperparameter on the `(replay_weight, replay_cap)`
2D grid. **Better long-term default** (out-of-scope for this change but
flagged in tasks): per-trace weight w_i = clamp(ρ_i, 0, τ) · (1 - ε_judge_i)
where ρ_i is the true importance ratio from
`activity_recommendation.thompson_alpha` at the time of the original trace,
and ε_judge_i is a calibration-curve lookup against
`goal_verification_labels` (migration 101). This produces an *adaptive*
schedule that approaches 1.0 once the LLM judge is calibrated, and falls
to 0.0 for traces whose original distribution is too far from π_replay.

**Risk of replay bias vs. live signal:**

| Risk | Mitigation |
|---|---|
| LLM judge systematically over-scores new templates | Replay weight cap; periodic re-calibration vs. `goal_verification_labels` |
| Replay samples crowd out live samples in posterior | w_replay = 0.3 hard cap; live updates remain weight 1.0 |
| Replays for *bad* templates damage incumbents via `impulseRelevance_write` β-side | Per-template replay budget; abort if Δβ exceeds Δα by 3x within the run |
| Selection bias toward easy inputs | Stratified sample over `context_bucket` (already computed in `execution-traces.ts:2428`) |
| Substrate citizens read replay-weighted posteriors as if they were live | Add a `posterior_replay_fraction` field to the recommendation response so consumers can downweight if they want pure-live |

## Existing surface this change leans on

**Trace storage and shape indexing** (`repos/metabob-activity-api/src/routes/execution-traces.ts`):
- `input_impulse_shapes?: string[]` on the persisted trace
  (`execution-traces.ts:249`, written at `:1618-1619`, indexed-style query at
  `:2387-2391`).
- `output_impulse_shapes` written alongside (`:613`).
- `context_bucket` derived from `input_impulse_shapes` + task description
  (`execution-traces.ts:2428`, `:2498-2506`) — already-computed
  stratification axis.

**Hydrated read path** (`repos/metabob-activity-api/src/routes/execution-trace-with-signatures.ts`):
- Returns `impulses_by_id` map and per-task `input_impulse_ids` +
  `output_impulse_ids`. Replay can reconstruct the input pool deterministically.
- Already advertised as a registered shape:
  `repos/metabob-activity-api/src/config.ts:266`.

**Discover-by-shapes** (`repos/metabob-activity-api/src/routes/activities.ts:5266`):
- `POST /v2/activities/discover-by-shapes` already runs the reverse query
  (templates → matching shapes). The forward query (shapes → matching traces)
  is currently only available implicitly via `execution-traces.ts:2387-2391`
  and needs a small read endpoint or query helper. Tasks below add it.

**Template-write event** (`repos/metabob-activity-api/src/routes/activities.ts:903` —
`POST /templates`, and `repos/metabob-activity-api/src/routes/impulses.ts:2395-2401` —
`activityTemplate_write` impulse resolver):
- The `template_created` WebSocket event is documented in
  `repos/metabob-activity-api/docs/API_REFERENCE.md:2093` but **not currently
  emitted** in src/ (verified via `grep -rn 'template_created'
  repos/metabob-activity-api/src/`). This change wires the emission as a
  prerequisite.
- The wider WebSocket surface (`broadcaster` at
  `repos/metabob-activity-api/src/websocket/broadcaster.ts:239`) already
  handles task.completed / impulse.resolved at scale — reusing it is cheap.

**LLM call surface** (`repos/llm-resolver-vessel/src/index.ts:60` —
`llm_completion` resolver, port 8220):
- Decoupled credential surface; one HTTP call per replay-judgement is
  already the pattern the substrate uses for all LLM resolution.
- The advertised shape is `llm_completion` (`src/index.ts:307`, `:335`); no
  new shape needed.

**Thompson write paths**:
- `impulseRelevance_write` impulse: `repos/metabob-activity-api/src/routes/impulses.ts:2421`.
- `activityFeedback_write`: `:2375-2380`.
- `activityVariant_write`: `:2410`.
- Both already accept per-call weight fields adjacent to α/β deltas;
  this change requires adding an optional `replay_weight` field to the
  request schema and threading it into the SurrealDB UPDATE.

## Implementation: observer or new background activity?

Two natural homes:

**Option A — new activity `replay-traces-for-new-template` in the development-vessel**,
dispatched by a boredom goal or by a lifecycle hook on `template_created`.
Pros: substrate-citizen pattern, traces of replay runs are themselves logged,
recursive learning applies. Cons: yet another systemd-resident vessel
process; boredom-vessel cadence (5min) is too coarse for "new template
authored *now*"; dispatching from a lifecycle hook requires the very
`template_created` event we're adding.

**Option B (recommended) — observer in ribosome-vessel**.
`repos/ribosome-vessel/src/index.ts:141` is already a long-lived WebSocket
subscriber to activity-api/ws. It already runs an extraction pipeline when
executions close. Subscribing to a new `template_created` event in the same
loop costs nothing structural: one more case in the switch at
`ribosome-vessel/src/index.ts:173`-area, plus a new background-job queue
that drains independently of the task-completed pipeline.

Replay is a *consumer* of templates much like ribosome is a *producer* of
them; bundling them in the same vessel makes the "templates in, templates
out, traces consumed" boundary explicit. The vessel is also already
authenticated and discovery-registered, so adding a new task type does not
expand the deployment surface.

**Recommendation:** Option B. Implement as a new module inside ribosome-vessel
with its own bounded concurrency (default: 2 concurrent replay-judgement
LLM calls), its own queue (drop-oldest if queue > 100), and its own
health surface in `/health`. If ribosome-vessel later splits, the replay
module is one file.

## Architecture

```
template_created (WS, new event)
    │
    ▼
ribosome-vessel TemplateReplayObserver
    │
    ├─ 1. Read new template.input_shapes
    │
    ├─ 2. Query activity-api:
    │     GET /v2/activities/execution-traces?input_shapes_contains=<shapes>
    │     &limit=50&stratify_by=context_bucket
    │     (NEW endpoint; thin wrapper over existing index)
    │
    ├─ 3. For each matching trace:
    │     GET /v2/impulses/resolve { type: "executionTraceWithSignatures",
    │                                trace_id }
    │     → impulses_by_id + per-task arrays
    │
    ├─ 4. Build counterfactual prompt:
    │     "TEMPLATE: <new_template.tasks json>
    │      RECORDED INPUTS: <impulses subset matching input_shapes>
    │      RECORDED OUTCOME: <trace.success, output_impulse_shapes>
    │      Q1: would TEMPLATE plausibly produce the recorded outcome shapes?
    │      Q2: confidence 0..1?
    │      Q3: which task would have differed?"
    │     POST llm-resolver-vessel/resolve/llm { type: "llm_completion", ... }
    │
    ├─ 5. Parse {score: 0..1, confidence: 0..1, divergent_task?: id}
    │
    └─ 6. POST /v2/impulses/resolve
          { type: "impulseRelevance_write",
            relevanceData: {
              activity_variant_id: <new_template>,
              alpha_delta: score * replay_weight * confidence,
              beta_delta: (1-score) * replay_weight * confidence,
              source: "background_replay",
              replay_trace_id: <trace_id>,
              replay_weight: 0.3
            }
          }
```

Replay weight applied at the **delta** layer, not as a post-hoc multiplier
on the posterior, so the audit trail in `impulse_relevance_metrics` carries
the provenance (`source: "background_replay"`) per row.

## Acceptance

**Primary observable (push-away correlate):**
**replay-success-rate** — the fraction of replays for which the LLM
judge scored ≥ 0.7 — per template, per window. From
`docs/architecture/LITERATURE_COMPARISON.md:367` (§9.3): "Push-away ↔
replay-success correlation" predicts that templates with higher
replay-success on imported / historical inputs correspond to substrate-side
adversarial-refusal capability. Tracking replay-success directly gives an
early observable for push-away, weeks before the IAL S2→S3 window can be
counted.

**Acceptance gates:**

1. *Coverage.* For every new template registered after deployment, at least
   one replay attempt is logged within 60s (subject to shape-match
   availability). Templates whose `input_shapes` match zero historical traces
   are logged as `replay_no_matches` (this is also a signal: new shape
   territory).
2. *Posterior reaches non-cold-start.* For new templates with ≥10 successful
   replay matches, posterior α+β ≥ 3.0 (weighted) on day 1, vs. baseline
   ~1.0 (the Beta(1,1) prior). Measured via
   `GET /v2/activities/variant-metrics-summary`.
3. *Live-data agreement.* Once a replay-seeded template accumulates ≥10
   *live* dispatches, the live-only posterior should not be more than 0.2
   away from the replay+live posterior in success-rate units, for templates
   above replay-success 0.5. (Calibration check: if disagreement is large,
   replay weight should be reduced.)
4. *No regression on incumbents.* β-deltas applied to incumbent templates
   by replay (i.e. when a new template's replay-judgement implicitly
   negatively-scores the incumbent's prior choice on the same inputs)
   must remain bounded: aggregate weekly β-delta to incumbents from replay
   sources < 10% of live β-deltas. Enforced by the abort-on-imbalance guard
   in §math.
5. *Cost ceiling.* LLM-call budget for replay does not exceed 5% of total
   substrate LLM spend per week (configurable; default cap 1000 replays/week
   at ~1 call each).

**Secondary observables:**

- Replay-success distribution per template (input to §9.3 push-away tracking).
- Replays-per-shape-tuple histogram (long tail expected; tail is where
  cold-start matters most).
- LLM-judge calibration vs. `goal_verification_labels` oracle (migration 101)
  — drift detector.
- Mean time from template-write to first non-cold-start posterior (target:
  < 60s).

## Out of scope (this change)

- **Adaptive per-trace weighting** (clipped importance ratio + judge
  calibration). Default 0.3 first; adapt after one window of data.
- **Re-replay on template *update*** vs. write. Initial scope: write/create
  only. Updates to existing templates trigger replay only if `input_shapes`
  changes — a heuristic that may miss task-graph changes; revisit.
- **Cross-org / cross-account replay.** Replay strictly scoped to the
  org/account of the new template; no information leakage across scope
  boundaries (consistent with the 3-scope primitive in
  `concept_7mzv7SQN_7JB`).
- **Replay of non-LLM tier outcomes via deterministic simulation.** The
  `tier_restricted_bandit_skipping_deterministic` mechanism
  (`concept_SDerP4GcuhGm`) suggests deterministic-tier cells should be
  skipped entirely — including by replay. Implementation may skip replay
  for `resolver_tier=deterministic` task graphs.
- **Self-referential replay** (replaying a template against its *own* prior
  traces). Allowed only when version bumps; otherwise tautological.
- **Concept-db neighbour borrowing for prior + replay.** Mechanism 2
  (`concept_uTVZPoaxMmo2`) handles priors; this change handles updates.
  Composition is left to a future change.
