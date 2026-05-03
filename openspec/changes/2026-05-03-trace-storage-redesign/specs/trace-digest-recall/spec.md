## ADDED Requirements

### Requirement: A trace_digest table SHALL hold a slim per-execution summary

Every non-system execution trace SHALL produce one row in `trace_digest` keyed by `execution_id`. The digest SHALL carry `activity_id`, `success`, `duration_ms`, `cost_usd`, `failure_mode_type`, `output_impulse_shapes`, `task_summaries` (per-task `(id, status, duration_ms, resolver_tier)` micro-tuples), `executed_at`, `org_id`, and `project_id`. The digest SHALL be written atomically with the parent metadata row.

#### Scenario: Digest row is created alongside the parent
- **WHEN** a non-system trace is stored
- **THEN** exactly one row exists in `trace_digest` with `execution_id` matching the parent

#### Scenario: Failure mode type is recorded on the digest
- **WHEN** the trace carries `failure_mode: { type: "verifier_negative", ... }`
- **THEN** `trace_digest.failure_mode_type` equals `"verifier_negative"`

#### Scenario: Per-task summaries are micro-tuples not full task objects
- **WHEN** the trace contains five task entries each ~2KB
- **THEN** `trace_digest.task_summaries` contains five objects, each carrying only `id`, `status`, `duration_ms`, `resolver_tier`
- **AND** the total digest row size remains under 2KB

### Requirement: A recall endpoint SHALL surface curated exemplars per activity

`GET /v2/activities/exemplars?activity_id=<id>` SHALL return up to `N` curated exemplar rows for the activity by joining `execution_exemplar` with `trace_digest` on `digest_id`. When no exemplars are yet selected for the activity, the endpoint SHALL fall back to a digest-only scan ordered by `executed_at DESC LIMIT 20` and SHALL tag the response `source: "digest_fallback"`. When exemplars are available the response SHALL be tagged `source: "exemplar"`.

#### Scenario: Selected exemplars are returned when available
- **WHEN** the selector has run and `execution_exemplar` contains 20 rows for `activity_id`
- **THEN** the endpoint returns those 20 rows joined with their digests
- **AND** the response is tagged `source: "exemplar"`

#### Scenario: Fallback to digest scan when no exemplars exist
- **WHEN** the selector has not yet run for `activity_id` but `trace_digest` has rows
- **THEN** the endpoint returns up to 20 most-recent digest rows ordered by `executed_at DESC`
- **AND** the response is tagged `source: "digest_fallback"`

#### Scenario: Empty result for unknown activity
- **WHEN** neither `execution_exemplar` nor `trace_digest` has rows for the activity
- **THEN** the endpoint returns an empty array

### Requirement: Recall median latency SHALL be bounded under the slim path

When the response is served from `execution_exemplar` joined with `trace_digest`, the median end-to-end response time SHALL be at most 25ms on the canary corpus. The full-trace recall path through `activity_execution_traces` for the same activity is observed at ~200ms today; the slim path is the SLO target for the binding-layer recommendation hot path.

#### Scenario: Slim path stays under target latency
- **WHEN** the endpoint is called 100 times for an activity with selected exemplars
- **THEN** the median response latency is at most 25ms
