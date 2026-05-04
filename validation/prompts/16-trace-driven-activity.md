# Prompt 16: Trace-driven activity analysis (cross-vessel + learning-loop test)

This prompt requires minibob to:
1. Retrieve execution trace data from activity-api via the impulse system
2. Use that data to drive a meaningful follow-on activity (failure pattern analysis)
3. Write impulse relevance feedback back to the backend

The goal proves the full loop: cross-vessel resolution → data-driven reasoning → relevance update.

---

Using the activity registry backend, perform a failure pattern analysis:

## Step 1 — Retrieve traces

Fetch the 10 most recent execution traces using the `executionTraceList` impulse shape.
This shape is owned by activity-api; resolve it through the impulse system (not a direct
HTTP call).

## Step 2 — Classify outcomes

For each trace, record:
- `execution_id`
- `activity_id`
- `status` (success or failed)
- `duration_ms`
- `failure_mode` (if present)

## Step 3 — Identify the most-failed activity

Find which `activity_id` appears most in **failed** traces. If no failures exist, use the
activity with the highest average `duration_ms` as the "slow path" candidate.

## Step 4 — Write relevance feedback

For the most-failed (or slowest) activity template, emit an impulse relevance update using
the `impulseRelevance_write` shape. The body should include:
- `activity_variant_id`: the activity_id from step 3
- `relevance_score`: a value between 0.0 and 0.5 (signal that this needs improvement)
- `context`: `"validation-phase-16-failure-pattern"`

Resolve this write through the impulse system, not a direct HTTP call.

## Step 5 — Write analysis file

Create `/workspace/analysis.md` containing:
- A table of all 10 traces (columns: execution_id, activity_id, status, duration_ms)
- A "Failure Summary" section: which activity failed most and how many times
- A "Relevance Update" section: confirming the impulse relevance write was emitted and the
  shape/resolver used

The goal is complete when `/workspace/analysis.md` exists with real backend data AND the
relevance write has been dispatched through the impulse system.
