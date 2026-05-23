# Tasks: Cost-Weighted Posteriors

## Phase 1 — Trace schema additions

- [ ] 1.1 Audit existing `activity_execution_traces.cost_usd` coverage
  on canary. Verify field is populated on all recent rows; backfill
  zeros to nulls if necessary.
- [ ] 1.2 Add `cost_observed_confidence: number` to schema, default
  1.0, range [0, 1]. Migration follows the same idempotent pattern as
  signal-confidence-weighting Phase 1.
- [ ] 1.3 Update `activity_execution_trace_write` impulse body schema
  + REST endpoint to accept the new field, optional, default 1.0.

## Phase 2 — Joint posterior

- [ ] 2.1 Extend `variant_performance_metrics` schema with `cost_mean`,
  `cost_variance`, `cost_observations_count`. Migration adds with
  default 0 / 0 / 0.
- [ ] 2.2 `applyOutcomeToPosteriors` extended to update the cost
  posterior. Running mean / variance via Welford's online algorithm.
  Increment `cost_observations_count` only when
  `cost_observed_confidence ≥ 0.5` to avoid heuristic noise dominating.
- [ ] 2.3 `propagateCreditAlongChain` propagates cost updates with
  same γ-discount as α/β. Ancestor cost posteriors reflect their share
  of the chain's spend.

## Phase 3 — Cost-weighted sampling rule

- [ ] 3.1 New resolver `cost-weighted-thompson`. Samples
  `expected_alpha = Beta(α, β).sample()`,
  `expected_cost = max(cost_mean, MIN_COST_FLOOR)`, returns
  `expected_alpha / expected_cost` as the candidate score.
  `MIN_COST_FLOOR` = 0.01 USD to avoid division-by-zero.
- [ ] 3.2 Extend `POST /v2/activities/recommend` with optional
  `cost_weighted: boolean` (default false) and
  `available_budget_usd: number` (default unset). When true,
  candidates are ranked by α/cost; budget filter rejects candidates
  with `expected_cost > available_budget_usd`.
- [ ] 3.3 Cold start: activities with `cost_observations_count < 3`
  use `MIN_COST_FLOOR` as expected cost, ensuring they remain
  explorable during the cold-start phase.

## Phase 4 — Policy selector

- [ ] 4.1 Draft four policy resolvers: `linear`, `quadratic_penalty`,
  `budget_cap`, `knapsack_bandit`. Each implements the candidate
  scoring function for one policy.
- [ ] 4.2 `cost-weighting-policy` selector resolver Thompson-samples
  among the four per problem class (derived from goal tags).
- [ ] 4.3 Policy α/β updates are derived from the **long-run α-per-dollar**
  metric over a 7-day rolling window: at end of each window, each
  policy that was active gets α/β credit proportional to its
  α-per-dollar delta vs the substrate's median.
- [ ] 4.4 Policy bootstrap via substrate-forge: spawn 4 forks, one per
  policy, each running for a 24h evaluation window; outcomes feed the
  initial policy posteriors.

## Phase 5 — Reporting

- [ ] 5.1 Workbench `ExecutionHistoryPanel` adds a cost column with
  per-row cost_usd + cost_observed_confidence badge.
- [ ] 5.2 Workbench `ExecutionFlameGraph` adds a cost overlay mode
  (toggle between time / cost coloring).
- [ ] 5.3 Phase 19 reuse-validation harness adds **α-per-dollar** as
  a new column in weekly reports.
- [ ] 5.4 New impulse shape `costWeightingReport` emitted weekly with
  per-policy α-per-dollar, per-activity cost variance, and
  identified high-cost-low-α activities for ribosome attention
  (distillation candidates per sibling spec).

## Phase 6 — Recursive policy selection

- [ ] 6.1 The policy-selector is itself a Thompson-managed activity.
  The selection-of-selection-policy is a single-level recursion
  bottoming at Beta(1,1).
- [ ] 6.2 Depth cap (1): no further meta-policies above the
  policy-of-policies. This is principled — past depth 1, the benefit
  drops below noise.
- [ ] 6.3 Bootstrap: the first selection-of-selection is a uniform
  prior; the substrate learns over time.

## Phase 7 — IAL integration

- [ ] 7.1 Amend IAL §27.3.g with §27.3.g.8: cost posteriors populated
  and reported on canary; cost-weighted recommend available.
- [ ] 7.2 Update CLAUDE.md "Execution Trace Model" with the new fields
  and the α-per-dollar metric.

## Phase 8 — Canary validation

- [ ] 8.1 Pre-deployment baseline: capture Phase 19 reuse-harness
  output. Note current MRR, improvise_share, reuse_rate.
- [ ] 8.2 Deploy with cost-weighted DISABLED by default. Confirm zero
  drift on baseline metrics.
- [ ] 8.3 Enable cost-weighted on a subset of recommend calls (10%
  traffic). Compare α-per-dollar; expect ≥10% improvement on
  cost-sensitive problem classes.
- [ ] 8.4 Scale to 100% traffic if metrics improve; otherwise narrow
  to the subsets where improvement was observed.
