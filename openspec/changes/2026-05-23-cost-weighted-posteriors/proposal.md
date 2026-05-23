# Proposal: Cost-Weighted Posteriors

## Why

The committed `2026-05-23-signal-confidence-weighting` adds
`signal_confidence_weight` to traces, multiplied into α/β updates. The
resulting Thompson posteriors track P(success | activity selected),
weighted by confidence. **They do not track cost.**

Under canary K8s deployment, cost was dominated by cluster
infrastructure — a roughly constant tax across activities. Local
single-container substrate development inverts this: infrastructure
cost approaches zero, and **per-activity LLM API spend becomes the
dominant variable**. An activity with α=10, β=2 averaging $0.05 per
invocation is structurally different from one with α=10, β=2 averaging
$5.00 per invocation, but today's selection treats them identically.

The Thompson selection rule must extend to optimize for
**marginal α per dollar**, not marginal α. The substrate's running
posteriors already track per-activity cost (`activity_execution_traces.cost_usd`
+ per-resolver cost in resolver-tier metadata); the missing piece is a
selection rule that weights expected success by inverse expected cost
and learns the cost distribution alongside the success distribution.

This is also exactly the construction that the multi-armed-bandit
literature calls **knapsack bandit** or **budgeted MAB** (CSALE/MAB
families). The substrate's existing Beta posteriors generalise to a
joint posterior over `(success, cost)` with a budget-constrained
sampling rule.

## Self-application

The cost-weighting machinery is itself an activity catalog and resolver
set; it MUST be subject to the same conditions as every other learning
signal:

- **Foundation alignment** — cost is an impulse property (it's already
  recorded on trace bodies). Cost-weighting is a resolver over existing
  impulses; it adds no new primitive.
- **Closure** — the cost-weighting policy is substrate-resident, not
  operator-pinned. The choice of policy (linear weighting, quadratic
  penalty, budget-cap-style, knapsack-bandit) is Thompson-managed: the
  substrate runs multiple policies in parallel via
  substrate-forge-vessel and learns which yields best long-run
  α-per-dollar.
- **Confidence weighting** — cost-weighting respects existing
  `signal_confidence_weight`. A high-confidence cost observation (real
  LLM API receipt) weights more than a low-confidence one (estimated
  cost from a token-count heuristic).
- **Recursive cost-weighting** — the cost-weighting policy selector is
  itself an activity, with its own α/β tracked under cost-weighted
  Thompson. The selection-of-selection-policy is its own bandit. This
  bottoms out at a Beta(1,1) prior over policies; the depth is bounded
  by the substrate's own composition-chain cycle detection.
- **Explicit vessel** — cost-weighting logic lives in activity-api's
  posterior-update path; no new vessel. Its operation is observable
  through the same impulse / trace / discovery surface as every other
  resolver.

## What Changes

1. **Cost on trace records**: ensure every trace records
   `cost_usd: number` (already present per Phase 18; verify on canary).
   Also record `cost_observed_confidence: number ∈ [0, 1]` —
   1.0 for real API receipts, 0.5 for token-count estimates, 0.2 for
   heuristic guesses. Defaults to 1.0 for in-substrate writes today.
2. **Joint posterior**: extend `variant_performance_metrics` with
   `cost_mean: number`, `cost_variance: number`, and
   `cost_observations_count: number`. Updates derived from trace cost
   columns. The cost posterior is a running estimate, not a Beta.
3. **Cost-weighted sampling rule**: a new resolver
   `cost-weighted-thompson` extends the existing recommend path. Given
   activity candidates, samples expected success from the Beta posterior
   and divides by expected cost from the cost posterior, returning the
   candidate maximizing α/cost ratio. Equivalent to **knapsack-bandit
   sampling** under a per-call cost constraint.
4. **Policy selector**: a `cost-weighting-policy` resolver Thompson-samples
   among policies:
   - `linear` — expected_α / expected_cost (the default).
   - `quadratic_penalty` — expected_α / expected_cost² (favors cheap
     activities more aggressively).
   - `budget_cap` — Beta sampling normalized; rejects candidates above
     a per-call ceiling.
   - `knapsack_bandit` — full UCB-style cost-aware exploration.
   Different policies suit different regimes (long-horizon learning
   vs. tight budget vs. exploration phase). The substrate Thompson-tracks
   `(policy, problem_class) → α/β` based on **long-run α-per-dollar**
   over a 7-day rolling window.
5. **Budget context**: the recommend handler accepts an optional
   `available_budget_usd: number` in its request body. When set, the
   cost-weighted sampler rejects candidates whose expected cost exceeds
   the budget, falling back to cheaper alternatives.
6. **Reporting**: workbench `ExecutionHistoryPanel` adds a cost column;
   `ExecutionFlameGraph` adds a cost overlay. Phase 19 reuse-harness
   adds a new metric: **α-per-dollar** per benchmark window.
7. **Trace write contract**: `activity_execution_trace_write` schema
   gains `cost_observed_confidence` field, optional, default 1.0.

## Success criteria

1. **Joint posterior populated**: `variant_performance_metrics` rows
   have `cost_mean`, `cost_variance`, `cost_observations_count`
   populated for activities with ≥10 traces.
2. **Cost-weighted sampling active**: `POST /v2/activities/recommend`
   with `cost_weighted: true` returns rankings that respect cost. A
   benchmark with two activities (α=10/β=2 cost=$0.05 vs α=10/β=2
   cost=$5.00) returns the cheap one ≥95% of the time.
3. **Policy selector learning**: after 100 recommend dispatches under
   varied budget conditions, the policy-selector posteriors are
   informative for at least one problem class.
4. **α-per-dollar reported**: Phase 19 weekly harness includes the
   new metric. Baseline established within one week of deployment.
5. **No regression**: with `cost_weighted: false`, recommend behavior
   is identical to pre-deployment (Phase 19 MRR, improvise_share,
   reuse_rate within ±2% of baseline).
6. **Closure**: `closure-audit --without=operator-shell` reports zero
   failures for cost-weighting activities.

## Capabilities

### New Capabilities

- `cost-weighted-posteriors` — joint (success, cost) posterior over
  activities; cost-weighted Thompson sampling rule;
  Thompson-managed policy selector across linear / quadratic_penalty /
  budget_cap / knapsack_bandit policies; budget-aware recommendation
  surface. Spec: `specs/cost-weighted-posteriors/spec.md`.

### Modified Capabilities

- `signal-confidence-weighting` extended with `cost_observed_confidence`
  field as a sibling to `signal_confidence_weight`. Both fields default
  to 1.0; both have the same range and semantics.
- IAL Phase 27.3.g (explicit vessel coverage) gains §27.3.g.8: cost
  posteriors populated and reported; cost-weighted recommend available.

## Dependencies

- `2026-05-23-signal-confidence-weighting` (committed) — confidence
  field is the precedent pattern for the new cost-confidence field.
- `2026-05-23-substrate-forge-vessel` — the substrate uses forge to
  run multiple cost-weighting policies in parallel during the
  policy-learning bootstrap.

## Out of scope

- **Cost prediction for unknown activities**. Cold-start cost prior is
  `Beta(1,1)`-style uniform until ≥3 observations. Predicted cost from
  activity description (an LLM resolver) is itself a candidate
  technique but lives in a separate spec.
- **Cross-org budget pooling**. Budget enforcement is per-org per-substrate;
  multi-org budget pooling requires federation work.
- **Real-time spend rate-limiting**. The governor in
  `substrate-forge-vessel` covers fork-level rate-limiting; broader
  substrate-wide rate-limiting is its own concern.
