# irrelevance-score-feedback Specification

## Purpose

`impulse_relevance_metrics` already tracks `times_not_loaded_succeeded` and `times_not_loaded_failed`, from which an `irrelevance_score` is computed and persisted. The score answers: "when this impulse was absent, did execution still succeed?" A high `irrelevance_score` is evidence that the impulse is noise for this activity. Currently this signal is computed but never used — it does not feed back into impulse loading decisions or activity recommendations. This spec closes that loop.

**Foundation alignment note:** `irrelevance_score` is the symmetric counterpart to `relevance_score` in the two-direction learning duality. Both are forward-arm posteriors — `relevance_score` accumulates evidence that loading an impulse correlates with success; `irrelevance_score` accumulates evidence that *not* loading it also correlates with success. Together they form a balanced signal: neither direction can dominate without sufficient observations. `net_value_score` is the combined view, not a replacement for either component.

Three changes are required:

1. **`net_value_score` field** — a combined signal (`relevance_score - irrelevance_score * 0.5`) stored alongside existing metrics so downstream consumers do not have to recompute it.
2. **`discoverMissingImpulses` ranking** — rank missing impulse suggestions by `net_value_score` (per-activity average) rather than by `relevance_score` alone, so highly-irrelevant impulses are not surfaced as loading suggestions even when their raw relevance is moderate.
3. **MiniBob skip-loading gate** — before loading an impulse, MiniBob checks the `impulseRelevance` impulse type for the shape+activity pair. If `irrelevance_score > 0.7` AND `relevance_score < 0.4` AND the pair has at least `min_observations` recorded executions, the impulse is marked `skip_loading = true` and the load is skipped with a structured log entry.

---

## Requirements

### Requirement: net_value_score stored on every impulse_relevance_metrics write

On every write to `impulse_relevance_metrics` (both CREATE and UPDATE paths in `POST /v2/activities/impulse-relevance`), the backend SHALL compute and persist `net_value_score = relevance_score - irrelevance_score * 0.5`. The value SHALL be stored in the `net_value_score` column alongside `relevance_score` and `irrelevance_score`. The formula uses a 0.5 discount on the irrelevance term because irrelevance evidence (absence observations) is statistically weaker than presence observations and should not fully cancel a moderate relevance signal.

#### Scenario: net_value_score computed on first write
- **WHEN** `POST /v2/activities/impulse-relevance` creates a new row (no prior record exists)
- **THEN** the created row has `net_value_score = relevance_score - irrelevance_score * 0.5` computed from the initial scores

#### Scenario: net_value_score updated on subsequent writes
- **WHEN** `POST /v2/activities/impulse-relevance` updates an existing row
- **THEN** the updated row has `net_value_score` recomputed from the post-update `relevance_score` and `irrelevance_score`

#### Scenario: net_value_score clamped to [-1.0, 1.0]
- **WHEN** the raw formula produces a value outside `[-1.0, 1.0]` (due to floating-point edge cases)
- **THEN** the persisted `net_value_score` is clamped to that range

#### Scenario: existing rows without net_value_score remain valid
- **WHEN** a row predating this change is queried and has no `net_value_score` column
- **THEN** callers treat a missing `net_value_score` as `relevance_score - irrelevance_score * 0.5` computed at read time (no backfill required for correctness; backfill is out of scope)

---

### Requirement: net_value_score included in impulseRelevance resolver response

The `impulseRelevance` impulse resolver (`POST /v2/impulses/resolve` with `pointer.type = "impulseRelevance"`) SHALL include `net_value_score` and `irrelevance_score` in every row it returns. Callers (including MiniBob's skip-loading gate) depend on these fields being present without performing a second query.

#### Scenario: Resolver response includes irrelevance_score and net_value_score
- **WHEN** `POST /v2/impulses/resolve` is called with `pointer.type = "impulseRelevance"` and matching rows exist
- **THEN** each row in the response contains `irrelevance_score`, `relevance_score`, and `net_value_score`

#### Scenario: Resolver response includes observation count for cold-start guard
- **WHEN** the resolver returns rows
- **THEN** each row includes `times_not_loaded_succeeded + times_not_loaded_failed` as `not_loaded_observations` so callers can apply a minimum-observation threshold without a secondary query

#### Scenario: Rows without net_value_score fall back to computed value
- **WHEN** a row exists in the database without a `net_value_score` column (pre-migration row)
- **THEN** the resolver computes it inline as `relevance_score - irrelevance_score * 0.5` before returning, so the response is always well-formed

---

### Requirement: discoverMissingImpulses ranks by net_value_score

`discoverMissingImpulses` in `src/utils/impulse-relevancy.ts` SHALL rank missing impulse suggestions using `net_value_score` (the per-activity average across candidate activities) instead of the raw `relevance_score - irrelevance_score` difference. An impulse with `relevance_score = 0.6` but `irrelevance_score = 0.65` (net_value ≈ 0.275) SHALL rank below an impulse with `relevance_score = 0.55` and `irrelevance_score = 0.1` (net_value ≈ 0.5), even though the first impulse has nominally higher raw relevance.

#### Scenario: High-irrelevance impulse suppressed in missing-impulse suggestions
- **WHEN** `discoverMissingImpulses` evaluates a candidate impulse with `relevance_score = 0.65` and `irrelevance_score = 0.7`
- **THEN** `net_value_score = 0.65 - 0.7 * 0.5 = 0.30` and the impulse ranks below a candidate with `net_value_score = 0.45`

#### Scenario: Zero-irrelevance impulse retains full relevance weight
- **WHEN** an impulse has `relevance_score = 0.5` and `irrelevance_score = 0.0`
- **THEN** `net_value_score = 0.5` and the impulse is ranked normally

#### Scenario: Negative net_value_score impulses excluded from suggestions
- **WHEN** an impulse has `net_value_score <= 0` (irrelevance evidence outweighs relevance evidence)
- **THEN** the impulse is not included in the `discoverMissingImpulses` result regardless of raw `relevance_score`

#### Scenario: Missing-impulse suggestion output unchanged in structure
- **WHEN** `discoverMissingImpulses` returns results
- **THEN** the returned objects still have the existing fields (`impulse_id`, `reason`, `unlocks_activities`, `avg_relevance_boost`); `avg_relevance_boost` is now populated from `net_value_score` rather than the raw difference

#### Scenario: Fallback when net_value_score column absent
- **WHEN** a row retrieved by `discoverMissingImpulses` has no `net_value_score` column
- **THEN** the function computes `net_value_score` inline from the row's `relevance_score` and `irrelevance_score` before ranking

---

### Requirement: MiniBob skip-loading gate consults impulseRelevance before loading

Before MiniBob's `ImpulseStore.load()` performs local resolution or routes to a backend vessel, it SHALL query the `impulseRelevance` impulse type for the shape+activity pair being loaded. If the result satisfies all three skip conditions simultaneously, the load SHALL be skipped and the impulse SHALL be marked with `skip_loading: true`.

**Skip conditions (all three must hold):**
- `irrelevance_score > SKIP_IRRELEVANCE_THRESHOLD` (default `0.7`)
- `relevance_score < SKIP_RELEVANCE_THRESHOLD` (default `0.4`)
- `not_loaded_observations >= MIN_OBSERVATIONS` (default `10`)

The thresholds SHALL be configurable via `.metabob/config.json` under `impulseLoading.skipThresholds`. Environment variables `MINIBOB_SKIP_IRRELEVANCE_THRESHOLD`, `MINIBOB_SKIP_RELEVANCE_THRESHOLD`, and `MINIBOB_SKIP_MIN_OBSERVATIONS` SHALL override config-file values.

#### Scenario: Impulse with high irrelevance and low relevance is skipped
- **WHEN** `irrelevance_score = 0.82`, `relevance_score = 0.25`, `not_loaded_observations = 15` for shape `"error_log"` + activity `"fix-bug"`
- **THEN** `ImpulseStore.load()` skips resolution, sets `skip_loading: true` on the stored impulse, and emits a structured log entry: `{ event: "impulse_skip_loading", impulse_id, shape, activity_id, irrelevance_score, relevance_score, not_loaded_observations, reason: "high_irrelevance" }`

#### Scenario: Impulse with high irrelevance but also high relevance is NOT skipped
- **WHEN** `irrelevance_score = 0.75`, `relevance_score = 0.6`, `not_loaded_observations = 20`
- **THEN** `ImpulseStore.load()` proceeds normally (the activity often succeeds both with and without this impulse — ambiguous signal)

#### Scenario: Cold-start guard prevents skip with insufficient observations
- **WHEN** `irrelevance_score = 0.9`, `relevance_score = 0.1`, but `not_loaded_observations = 5`
- **THEN** `ImpulseStore.load()` proceeds normally regardless of the scores (not enough data to trust)

#### Scenario: Skip gate is bypassed when impulseRelevance query fails
- **WHEN** the `impulseRelevance` resolver call throws (network error, backend unavailable)
- **THEN** `ImpulseStore.load()` proceeds as if the gate returned no data — no impulse is silently dropped due to an infrastructure failure

#### Scenario: Skip gate is bypassed when no metrics exist for the pair
- **WHEN** no `impulse_relevance_metrics` row exists for the shape+activity combination
- **THEN** the impulse is loaded normally (no cold-start skip)

#### Scenario: Thresholds configurable per deployment
- **WHEN** `.metabob/config.json` sets `impulseLoading.skipThresholds.irrelevance = 0.85`
- **THEN** the skip gate uses `0.85` as the irrelevance threshold, not the default `0.7`

#### Scenario: skip_loading flag propagates to impulse record
- **WHEN** an impulse is skipped by the gate
- **THEN** the in-memory `Impulse` object has `skip_loading: true` and `loaded: false`, and is NOT injected into the prompt context assembled for the LLM task

#### Scenario: Skipped impulse contributes to next relevance recording
- **WHEN** an impulse is skipped and the execution subsequently succeeds
- **THEN** MiniBob's post-execution relevance recording sends `was_loaded: false, execution_succeeded: true` for this impulse, increasing `times_not_loaded_succeeded` and reinforcing the existing irrelevance signal

---

### Requirement: skip_loading threshold configuration has safe defaults

The default thresholds SHALL be conservative enough to avoid discarding potentially-useful impulses on early deployments. The defaults (`irrelevance > 0.7`, `relevance < 0.4`, `min_observations >= 10`) SHALL require a strong, statistically-grounded irrelevance signal before any impulse is suppressed. Lowering thresholds (making the gate more aggressive) is an operator opt-in via config; no automatic threshold adjustment is in scope.

#### Scenario: Default thresholds applied when config is absent
- **WHEN** neither config file nor environment variables specify skip thresholds
- **THEN** `SKIP_IRRELEVANCE_THRESHOLD = 0.7`, `SKIP_RELEVANCE_THRESHOLD = 0.4`, `MIN_OBSERVATIONS = 10` are in effect

#### Scenario: Environment variable overrides config-file value
- **WHEN** `MINIBOB_SKIP_MIN_OBSERVATIONS=20` is set and config file sets `minObservations: 10`
- **THEN** `MIN_OBSERVATIONS = 20` is used (environment takes priority)

---

## Out of Scope

- Automatic threshold tuning from traces (thresholds are static operator configuration in this change).
- Backfilling `net_value_score` on existing `impulse_relevance_metrics` rows.
- Per-task granularity for the skip gate (the gate operates at shape+activity level, not shape+activity+task).
- UI surface for skip decisions (skip events are logged; no dashboard widget is added here).
- Skip-loading for impulses with shapes not resolvable via `impulseRelevance` (the gate only applies when the backend returns a known metric row).
