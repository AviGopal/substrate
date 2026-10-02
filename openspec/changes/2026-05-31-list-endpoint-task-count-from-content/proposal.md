# activity-api LIST execution-traces: source task_count from execution_trace_content

## Problem

Migration 118 moved `tasks`, `state_snapshot`, `impulse_resolutions`, and
`output_impulses` out of `activity_execution_traces` (AET) into the
sibling table `execution_trace_content`. The single-trace GET handler
(`/v2/activities/execution-traces/:id`) was updated to consult both
tables (`content_source: "split"`). The LIST handler
(`/v2/activities/execution-traces`) was NOT — it still computes:

```sql
array::len(tasks ?? []) AS task_count
```

against AET only. Post-migration this returns `0` for every trace
(field is gone), independent of the real task count.

Observed 2026-05-31: 491/500 successful list rows have `task_count=0`,
including healthy multi-task validator-dispatch executions whose
single-GET response confirms 5 tasks via the split-content union.

This invalidated the development-vessel `phantom_trace_scan` detector,
which read task_count from the list and emitted 50 substrateGap impulses
(all false positives) before the detector was patched to confirm via
single-GET. The underlying "9367 phantoms" claim driving the
substrate-self-detection pattern (concept_9ldsmRgqSTd5) is likely a
list-side artefact of the same root cause, not engine-level
pre-flight rejection (the F25 signature concept_qcctOLBT5-CL).

## Why fix in activity-api rather than only in the detector

The detector workaround (single-GET per candidate) is correct but costs
N+1 round-trips. The list endpoint is the canonical observability
surface — any client reading task_count there (workbench
ExecutionHistoryPanel, future analytics, other detectors) faces the
same artefact. The list query should source task_count from a place
where it remains accurate post-migration-118.

## Proposed change

Two options, ranked:

### Option A (preferred): JOIN content table for task_count summary

Change the list SELECT to project task_count from `execution_trace_content`
keyed by `execution_id`, e.g.:

```sql
SELECT
  id, execution_id, ...,
  (SELECT array::len(tasks ?? []) FROM execution_trace_content
    WHERE execution_id = $parent.execution_id LIMIT 1)[0] AS task_count,
  ...
FROM activity_execution_traces
...
```

(Adjust to SurrealDB 3.x syntax — sub-SELECT or LET-correlation
depending on driver behaviour.)

Failure mode: a trace whose split-content row never landed (the
fire-and-forget `insertTraceContent` dual-write at execution-traces.ts:1893
swallowed an error) returns null task_count — should be treated as
"unknown," not "0."

### Option B (cheaper): denormalize task_count onto AET at write time

Add `task_count` as a first-class field on AET set at INSERT time
from `body.execution_trace.tasks.length` (already logged on line 1881).
Backfill existing rows via migration 137 that reads
`execution_trace_content.tasks` and writes the count back.

Trade-off: extra column, must keep in sync on tasks-array edits;
denormalisation drift if content updates without AET rewrite.

## Out of scope

- Migrating the dev-vessel `phantom_trace_scan` resolver: already
  patched to confirm via single-GET. After the list endpoint is fixed,
  the resolver's confirmation step becomes redundant but is safe to
  keep as defence-in-depth.
- Invalidating the 50 false-positive gaps already in
  `scripts/substrate/workspace/gaps/gaps.json`: separate cleanup task.
- The F25 phantom-success pattern (concept_qcctOLBT5-CL) is a different
  failure class — engine pre-flight rejection — and may still occur,
  but is not what the current 9367 phantom claim measures.

## Acceptance

- A GET `/v2/activities/execution-traces?limit=N` request on the live
  substrate returns task_count > 0 for at least 95% of successful
  validator-dispatch traces from the past 7 days.
- The development-vessel `phantom_trace_scan` resolver reports
  `list_candidates_rejected_after_confirm` ≈ 0 because the list pre-
  filter no longer treats every trace as a candidate.
