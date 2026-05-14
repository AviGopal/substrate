## ADDED Requirements

### Requirement: An execution_exemplar table SHALL hold curated representative traces per activity

`execution_exemplar` SHALL store at most `N` rows per `activity_id` (default `N = 20`, tunable via env `EXEMPLAR_N`). Each row carries `activity_id`, `execution_id`, `success`, `digest_id` (pointer into `trace_digest`), `selected_at`, and `org_id`. The selector SHALL clear and re-populate the table per activity per cycle so every row reflects the current selection.

#### Scenario: Selection replaces prior exemplars
- **WHEN** the selector runs twice for the same activity
- **THEN** rows from the first cycle are gone after the second cycle and only the second cycle's rows remain

#### Scenario: Exemplar count is bounded by N
- **WHEN** `N = 20` and the activity has 1000 historical traces
- **THEN** `execution_exemplar` contains at most 20 rows for that activity

### Requirement: Selection SHALL adaptively balance success and failure exemplars by ev

For each activity the selector SHALL read `activity_template.ev` (the COMPUTED field deployed under `2026-04-29-surrealdb-rl-layer`) and compute `n_success = round(N * (1 - ev))`, `n_failure = round(N * ev)`. The selector SHALL then take the most-recent `n_success` rows from `trace_digest` with `success = true` and the most-recent `n_failure` rows with `success = false`. The rationale: the rarer outcome class (relative to the current posterior) carries more information for the next learning step.

#### Scenario: High-ev activity selects mostly failure exemplars
- **WHEN** an activity has `ev = 0.9` and `N = 20`
- **THEN** the selector picks 2 success rows and 18 failure rows

#### Scenario: Low-ev activity selects mostly success exemplars
- **WHEN** an activity has `ev = 0.1` and `N = 20`
- **THEN** the selector picks 18 success rows and 2 failure rows

#### Scenario: ev exactly 0.5 produces a balanced split
- **WHEN** an activity has `ev = 0.5` and `N = 20`
- **THEN** the selector picks 10 success rows and 10 failure rows

#### Scenario: Insufficient rows in a cohort yields whatever is available
- **WHEN** `n_failure = 18` is requested but only 5 failure rows exist in `trace_digest`
- **THEN** the selector inserts 5 failure rows and the corresponding number of success rows; the activity's exemplar count is below `N`

### Requirement: Selection SHALL run on a schedule and on burst threshold

The selector SHALL run on a nightly cron at low-traffic hours. Additionally, after every batch of `N` new executions for the same `activity_id`, the selector SHALL re-run for that activity. The burst counter SHALL live in Redis and reset on each selection.

#### Scenario: Burst trigger runs selection per activity
- **WHEN** 20 new executions land for `activity_id = X` since the last selection
- **THEN** the selector runs for `X` and the Redis counter for `X` resets to zero

#### Scenario: Nightly cron runs selection across all active activities
- **WHEN** the cron fires
- **THEN** `selectExemplarsForAllActiveActivities` is invoked and returns counts of processed and failed activity selections
