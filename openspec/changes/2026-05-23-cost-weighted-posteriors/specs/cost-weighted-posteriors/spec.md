# Capability: cost-weighted-posteriors

## Definition

The Thompson posterior over each `(activity, shape)` pair is extended
from a Beta(α, β) over success-probability to a joint posterior over
`(success_probability, cost_distribution)`. Activity recommendation
optimizes for marginal α per dollar, not marginal α. Multiple cost-
weighting policies (linear, quadratic_penalty, budget_cap,
knapsack_bandit) are Thompson-managed as siblings; the substrate learns
which policy yields best long-run α-per-dollar per problem class.

## Schema additions

### `activity_execution_traces` (existing)

| Field | Type | Default | Range |
|---|---|---|---|
| `cost_usd` (existing) | number | 0 | [0, ∞) |
| `cost_observed_confidence` (new) | number | 1.0 | [0, 1] |

### `variant_performance_metrics` (existing)

| Field | Type | Default | Notes |
|---|---|---|---|
| `cost_mean` (new) | number | 0 | running mean (Welford) |
| `cost_variance` (new) | number | 0 | running variance (Welford) |
| `cost_observations_count` (new) | number | 0 | counts only observations with confidence ≥ 0.5 |

## Sampling rules

### `linear` (default)

```
expected_alpha = Beta(α, β).sample()
expected_cost = max(cost_mean, MIN_COST_FLOOR)
score = expected_alpha / expected_cost
```

### `quadratic_penalty`

```
score = expected_alpha / (expected_cost^2)
```

Favors cheap activities more aggressively. Useful under tight budgets.

### `budget_cap`

```
if expected_cost > available_budget_usd: REJECT
else: score = Beta(α, β).sample()  // standard Thompson within budget
```

Useful when the budget is hard rather than soft.

### `knapsack_bandit`

UCB1-style scoring with cost incorporated as a divisor of the upper
confidence bound. Theoretically optimal for the budgeted MAB problem.
See Tran-Thanh et al., "Knapsack-based Optimal Policies for
Budget-Limited Multi-Armed Bandits", 2012.

## Policy selector

`cost-weighting-policy` resolver Thompson-samples among the four
policies per problem class. Policy α/β updates derived from end-of-
window α-per-dollar metric: at end of each 7-day window, each policy
that was active gets α/β credit proportional to its
`(α_observed - α_median) / dollars_spent` vs the substrate's median
that window.

## Self-application invariants

1. **No new primitive** — cost is already on trace bodies; this
   capability adds resolvers and posterior fields, no new shape kinds.
2. **Closure-bound** — cost-weighting is substrate-resident.
   `closure-audit --without=operator-shell` covers it.
3. **Confidence-weighted** — `cost_observed_confidence` mirrors
   `signal_confidence_weight`. Updates to the cost posterior are
   confidence-weighted via Welford with a confidence multiplier.
4. **Recursive bandit** — the policy selector is itself an activity
   subject to cost-weighted Thompson, but bounded to one level of
   recursion. The selection-of-selection-of-policy is fixed at
   Beta(1,1) prior to prevent depth explosions.
5. **Bootstrap is forge-mediated** — initial policy posteriors are
   established by `substrate-forge-vessel` spawning one fork per
   policy and running a 24h evaluation. After bootstrap, the policy
   selector runs in the canonical substrate.

## API surface

`POST /v2/activities/recommend` accepts:

```json
{
  "input_shapes": [...],
  "output_shapes": [...],
  "cost_weighted": false,              // default false (backward-compatible)
  "available_budget_usd": null,        // optional hard budget
  "weighting_policy": null              // optional manual override; null → Thompson-selected
}
```

Response includes per-candidate `expected_cost_usd` and
`cost_observations_count` alongside the existing α/β fields.

## Reporting surface

- **Workbench**: `ExecutionHistoryPanel` cost column;
  `ExecutionFlameGraph` cost overlay; cost-confidence badges per
  trace.
- **Phase 19 harness**: weekly `α-per-dollar` column.
- **`costWeightingReport` impulse**: weekly, body
  `{ per_policy_alpha_per_dollar, per_activity_cost_variance,
  distillation_candidates: [...] }`.

## Acceptance

1. **Schema migrations applied** on canary; trace + metrics fields
   populated.
2. **Cost posteriors populated** for activities with ≥3 trace observations.
3. **Cost-weighted sampling demonstrably cost-aware**: a benchmark
   with two activities (α=10/β=2 cost=$0.05 vs α=10/β=2 cost=$5.00)
   returns the cheap one ≥95% of the time under `cost_weighted: true`.
4. **Policy learning**: after 100 dispatches across varied budgets,
   policy-selector posteriors are informative (CI width ≤0.4) for at
   least one problem class.
5. **Zero regression** with `cost_weighted: false`: Phase 19 baseline
   metrics within ±2%.
6. **α-per-dollar improvement**: on cost-sensitive problem classes,
   `cost_weighted: true` yields ≥10% improvement in α-per-dollar over
   `cost_weighted: false` after 4 weeks of operation.
7. **Closure**: `closure-audit --without=operator-shell` zero failures
   for cost-weighting machinery.

## Status

Post signal-confidence-weighting. Pre full distillation: the
`distillation_candidates` field in `costWeightingReport` feeds the
sibling distillation spec.
