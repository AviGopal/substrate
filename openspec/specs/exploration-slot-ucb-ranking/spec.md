# exploration-slot-ucb-ranking Specification

## Purpose

Accelerate relevance learning in `POST /v2/activities/recommend` by (1) guaranteeing that at least
one "exploration slot" in every recommendation response is reserved for an under-explored or
potentially-invalid candidate, (2) ranking the full result list by UCB score so callers receive a
principled ordering that surfaces candidates the system knows the least about, and (3) providing an
explicit feedback endpoint so rejection of an exploration candidate records negative signal rather
than silence.

Thompson Sampling already has implicit exploration via Beta-distribution variance, but that variance
is uncontrolled: in a list of three recommendations all three slots can be won by well-observed
templates when their sampled draws happen to cluster high. The exploration slot guarantees diversity
within every response and the feedback endpoint closes the signal loop when the caller discards an
experimental candidate.

---

## Background: existing state

The `POST /v2/activities/recommend` handler (lines 3659–4137 of `src/routes/activities.ts`):

- Accepts `task_description`, `category`, `impulse_shapes`, `expected_output_shapes`, `limit`,
  and `exclude_activities` in the request body.
- Scores each candidate with `betaSample(alpha + heuristic_boost, beta)` and sorts descending by
  that sample.
- Returns `recommendations[]`, each carrying `selection_metadata` with `method`, `alpha`, `beta`,
  `sample`, `score`, boost breakdown, and an output-shape analysis block.
- Records `thompson_selection_log` rows and increments `total_selections` in
  `variant_performance_metrics` as fire-and-forget side effects.

The `ActivityScore` interface in `src/db/paradigm.ts` (lines 184–199) exposes `total_executions`,
`alpha`, `beta`, `successes`, `failures`, `avg_duration_ms`, `avg_cost_usd`, and
`last_executed_at`. UCB computation uses `successes`, `failures`, and `total_executions`.

---

## Requirements

### Requirement: `exploration_config` field in recommend request

`POST /v2/activities/recommend` SHALL accept an optional `exploration_config` object:

```
exploration_config?: {
  exploration_ratio: number   // 0.0–1.0, default 0.2
  min_observations_threshold: number  // default 5
}
```

`exploration_ratio` controls what fraction of the top-`limit` slots are reserved for exploration
candidates. A value of `0.2` with `limit = 5` yields 1 reserved slot (floor(5 * 0.2) = 1);
`limit = 10` yields 2 slots. The minimum reserved count is 1 whenever `exploration_ratio > 0`.
A value of `0.0` disables the exploration slot entirely and preserves the current ranking behavior.

`min_observations_threshold` sets the observation count below which a candidate is classified as
an exploration candidate. A template with `total_executions < min_observations_threshold` for the
calling org is an exploration candidate. A template that has `total_executions = 0` (never run by
this org) is always an exploration candidate regardless of threshold.

Both fields are optional and independently defaultable: omitting `exploration_config` entirely
behaves as `{ exploration_ratio: 0.2, min_observations_threshold: 5 }`.

#### Scenario: Default exploration config applied when field absent

- **WHEN** a caller sends `POST /v2/activities/recommend` with no `exploration_config` field
- **THEN** the handler applies `exploration_ratio: 0.2` and `min_observations_threshold: 5` as
  defaults, exactly as if the caller had specified those values explicitly

#### Scenario: Caller disables exploration slot

- **WHEN** `exploration_config: { exploration_ratio: 0.0 }` is sent
- **THEN** no slot is reserved for exploration; the response list is ordered by UCB score with no
  forced exploration entries; all `selection_metadata.exploration_slot` values are `false`

#### Scenario: High exploration ratio reserves multiple slots

- **WHEN** `exploration_config: { exploration_ratio: 0.4 }` is sent with `limit: 5`
- **THEN** 2 slots (floor(5 * 0.4) = 2) are reserved for exploration candidates; if fewer than
  2 exploration candidates exist among the fetched templates, the remaining reserved slots are
  filled by the highest-UCB non-exploration candidates

#### Scenario: Unknown fields in exploration_config are ignored

- **WHEN** `exploration_config` contains unrecognised keys alongside `exploration_ratio`
- **THEN** the handler does not return a 400 error; the extra keys are silently discarded

---

### Requirement: UCB score computed per candidate and used for response ordering

For every candidate in the fetched template pool the handler SHALL compute:

```
total_org_executions = sum of total_executions across all org templates (or 1 if zero)
n = candidate.total_executions  (0 means never run)
mean_success_rate = candidate.successes / max(n, 1)
ucb_score = mean_success_rate + sqrt(2 * ln(total_org_executions) / max(n, 1))
```

When `n = 0` the UCB term resolves to `sqrt(2 * ln(total_org_executions))`, which is large; new
templates naturally sort near the top of UCB ordering even with zero success signal.

The heuristic boosts (tag match, shape compatibility, recency, etc.) continue to adjust `alpha`
and `beta` before the Thompson draw. They are NOT added to `ucb_score`; UCB is computed from raw
observation counts only so that the ordering reflects epistemic uncertainty, not prior preferences.

The response list SHALL be ordered by `ucb_score` descending, not by Thompson sample. Thompson
Sampling remains the mechanism for selecting the single template that MiniBob actually executes;
UCB is used only to order the recommendation list seen by callers.

`selection_metadata` SHALL carry both values: `ucb_score` (new) and `sample` (existing Thompson
draw, kept for backward compatibility).

#### Scenario: UCB score present on every recommendation entry

- **WHEN** `POST /v2/activities/recommend` returns recommendations
- **THEN** every entry in `recommendations[]` has `selection_metadata.ucb_score` as a
  non-negative float

#### Scenario: Recommendations ordered by UCB descending

- **WHEN** template A has `total_executions: 2` and template B has `total_executions: 50`
  with equal success rates, and `total_org_executions` is large
- **THEN** template A appears before template B in the response list because its UCB score
  is higher (fewer observations → larger uncertainty term)

#### Scenario: Never-run template sorts before well-observed template of equal success rate

- **WHEN** template C has `total_executions: 0` and template D has `total_executions: 30`
  with `success_rate: 0.8` for both
- **THEN** template C appears before template D in the ordered list

#### Scenario: High success rate still matters when both templates are observed

- **WHEN** template E has `total_executions: 40, success_rate: 0.95` and template F has
  `total_executions: 38, success_rate: 0.30`
- **THEN** the UCB scores are compared and template E may rank higher despite more observations,
  because the mean term dominates when observation counts are similar

---

### Requirement: Exploration slot reserved and flagged in response

After computing UCB scores, the handler SHALL partition candidates into:

- **Exploration pool**: templates where `total_executions < min_observations_threshold` for the
  calling org, OR `total_executions = 0`
- **Exploitation pool**: all remaining templates

Assembly of the final `recommendations[]` list (length = `limit`):

1. Sort exploitation pool by UCB score descending.
2. Sort exploration pool by UCB score descending (fewest observations + highest uncertainty first).
3. Reserve `max(1, floor(limit * exploration_ratio))` tail slots for the exploration pool when
   `exploration_ratio > 0`.
4. Fill head slots (limit - reserved_count) from the exploitation pool.
5. Fill tail slots from the exploration pool. If the exploration pool has fewer entries than
   `reserved_count`, fill remaining tail slots from the exploitation pool.
6. The final list preserves UCB ordering within each segment.

Each item in `recommendations[]` SHALL include `selection_metadata.exploration_slot: boolean`.
Items drawn from the exploration pool have `exploration_slot: true`; all others have
`exploration_slot: false`.

The `correlation_id` generation and `thompson_selection_log` persistence are unchanged; every
recommended entry (exploration or not) gets a `correlation_id`.

#### Scenario: Exploration candidate flagged at tail position

- **WHEN** `limit: 3`, `exploration_ratio: 0.2` (1 slot), and one template has
  `total_executions: 2` (below threshold)
- **THEN** the response contains 3 entries; the last entry has `selection_metadata.exploration_slot: true`
  and corresponds to the low-observation template; the first two entries have `exploration_slot: false`

#### Scenario: Multiple exploration candidates when ratio is high

- **WHEN** `limit: 5`, `exploration_ratio: 0.4` (2 slots), and three templates qualify as
  exploration candidates
- **THEN** the two exploration candidates with the highest UCB scores among the exploration pool
  occupy the last two slots; both carry `exploration_slot: true`

#### Scenario: No exploration candidates found — response degrades gracefully

- **WHEN** every template in the fetched pool has `total_executions >= min_observations_threshold`
- **THEN** the reserved exploration slots are filled from the exploitation pool (highest UCB
  among remaining exploitation candidates); those fill-in entries carry `exploration_slot: false`

#### Scenario: Exploration slot excluded from within-session blacklist

- **WHEN** `exclude_activities` contains the ID of a template that would otherwise qualify as
  an exploration candidate
- **THEN** that template does not appear in the response (blacklist takes precedence over
  exploration slot selection)

#### Scenario: Exploration slot consistent with output-shape gate

- **WHEN** `expected_output_shapes` filtering is active and the exploration candidate's
  `output_shapes` do not cover any expected shape
- **THEN** the exploration candidate is excluded from consideration before the slot-filling step,
  consistent with the existing output-shape gating behavior

---

### Requirement: `selection_metadata` backward-compatible extension

The existing `selection_metadata` shape is extended with two new fields:

```
selection_metadata: {
  // existing fields (unchanged)
  method: "thompson_sampling"
  score_source: "shape_conditioned" | "global" | "legacy"
  alpha: number
  beta: number
  original_beta: number
  sample: number
  score: number
  tag_match_quality: number
  heuristic_boost: number
  boost_breakdown: { ... }
  output_shape_analysis: { ... } | null
  impulse_analysis: { ... } | null

  // new fields
  ucb_score: number           // UCB ranking score (epistemic uncertainty + mean)
  exploration_slot: boolean   // true if this entry filled a reserved exploration slot
}
```

No existing field is removed or renamed. Callers that do not read the new fields are unaffected.

> **Phase 9 note**: `selection_metadata.alpha`, `selection_metadata.beta`, and `selection_metadata.sample`
> are currently returned inline in REST responses. Phase 9 of the impulse-activity-loop spec will
> expose these posterior parameters as a resolvable `thompson_posterior` impulse shape so that
> minibob and other vessels can obtain them through the standard impulse-resolution path rather than
> parsing `selection_metadata` directly. When Phase 9 lands, callers should prefer resolving
> `thompson_posterior` over reading the inline fields; the inline fields will be kept for backward
> compatibility but are considered the legacy access path from that point forward.

#### Scenario: Response schema is backward-compatible

- **WHEN** a caller reads only the pre-existing `selection_metadata` fields (`method`, `alpha`,
  `beta`, `sample`, `score`)
- **THEN** all those fields are present and have the same type and semantics as before;
  no breaking change occurs

---

### Requirement: `POST /v2/activities/relevance-feedback` endpoint

A new endpoint SHALL be added:

```
POST /v2/activities/relevance-feedback
Authorization: ApiKey <key>

{
  template_id: string          // required
  was_selected: boolean        // required — true if run, false if rejected
  context_bucket?: string      // optional — caller-supplied context key (e.g. goal hash)
  reason?: string              // optional — free-text reason for rejection
  correlation_id?: string      // optional — ties feedback to a specific recommend response
}
```

Response on success: `204 No Content`.

When `was_selected = false` the endpoint SHALL:

1. Increment β (failures + 1) in `variant_performance_metrics` for `template_id` scoped to the
   calling org.
2. If `context_bucket` is provided, also increment β in the context-bucketed Thompson parameters
   for that `(template_id, context_bucket)` pair (via the `context_bucketed_thompson_params`
   table or equivalent, consistent with the context-bucketed-thompson-sampling spec).
3. Write a `relevance_feedback` record with fields: `template_id`, `org_id`, `was_selected`,
   `context_bucket`, `reason`, `correlation_id`, `created_at`.

When `was_selected = true` the endpoint SHALL:

1. Increment α (successes + 1) in `variant_performance_metrics`.
2. If `context_bucket` is provided, increment α in context-bucketed params.
3. Write a `relevance_feedback` record as above.

The β-update path is the primary new behavior; the α path is included for symmetry so callers can
use a single endpoint for all feedback directions.

All database writes are fire-and-forget (non-blocking); endpoint returns 204 immediately after
enqueueing the writes. Auth errors still return synchronously.

#### Scenario: Rejection of exploration candidate records negative signal

- **WHEN** a caller sends `{ template_id: "X", was_selected: false, correlation_id: "sel_abc" }`
- **THEN** the response is 204; β for template "X" is incremented in
  `variant_performance_metrics` for the calling org within the next DB write cycle

#### Scenario: Rejection with context bucket updates bucketed params

- **WHEN** `{ template_id: "X", was_selected: false, context_bucket: "goal:fix-tests" }` is sent
- **THEN** β is incremented in both global and context-bucketed Thompson params for
  `(template_id="X", context_bucket="goal:fix-tests")`

#### Scenario: Selection records positive signal

- **WHEN** `{ template_id: "Y", was_selected: true }` is sent
- **THEN** α for template "Y" is incremented in `variant_performance_metrics`; no β change

#### Scenario: Missing required fields returns 400

- **WHEN** the request body omits `was_selected`
- **THEN** the endpoint returns `400 Bad Request` with an error message identifying the
  missing field

#### Scenario: Unknown template_id returns 204 without error

- **WHEN** `template_id` does not match any known template for the calling org
- **THEN** the endpoint still returns 204; the fire-and-forget DB write produces no rows
  updated (no error surfaced to caller)

#### Scenario: Unauthenticated request is rejected

- **WHEN** the request carries no `Authorization` header
- **THEN** the endpoint returns `401 Unauthorized`

---

### Requirement: `total_org_executions` computed without extra round-trip

To avoid a separate DB query to sum executions across all org templates, the handler SHALL derive
`total_org_executions` from the scores already loaded in `scoresMap`:

```
total_org_executions = max(1, sum of score.total_executions for all entries in scoresMap)
```

This makes UCB computation O(n) over the already-fetched score set with no additional DB query.

#### Scenario: Single template org still computes valid UCB

- **WHEN** `scoresMap` contains exactly one template with `total_executions: 7`
- **THEN** `total_org_executions = 7`; UCB is computed as
  `mean + sqrt(2 * ln(7) / 7)` for that template, which is a valid positive float

#### Scenario: All templates have zero executions (fresh org)

- **WHEN** `scoresMap` is empty or all `total_executions` are 0
- **THEN** `total_org_executions` is clamped to 1; `ln(1) = 0` so the UCB uncertainty term is 0;
  all templates score equal UCB and the ordering falls back to natural sort order (e.g., creation
  date descending from the DB query)

---

### Requirement: `thompson_selection_log` records exploration_slot

The fire-and-forget `thompson_selection_log` write SHALL include the new `exploration_slot` field
alongside existing fields so the learning-loop audit trail captures which recommendations were
experimental.

#### Scenario: Selection log captures exploration flag

- **WHEN** a recommendation response is generated with one exploration slot
- **THEN** the `thompson_selection_log` row for that entry has `exploration_slot: true`; all other
  rows in the same response have `exploration_slot: false`

---

## Out of scope

- Adaptive tuning of `exploration_ratio` over time (e.g., decay as the template pool matures) —
  the ratio is caller-controlled for now.
- Multi-armed bandit regret tracking or exploration audit reports.
- UI surface for reviewing exploration decisions in the workbench — callers interact with the
  exploration slot via the `exploration_slot` flag in `selection_metadata`.
- Context bucket auto-derivation from `task_description` inside `relevance-feedback` — the caller
  must supply `context_bucket` explicitly.
