# Prompt 18: load_impulse tool — vessel discovery path

This prompt verifies that the `load_impulse` tool routes through vessel discovery (not bash/curl) when fetching shapes owned by external vessels.

**What to verify:**
- The `load_impulse` tool resolves `executionTraceList` through discovery → activity-api
- The log `[Impulse] Resolved via vessel discovery` appears in stderr
- Lifecycle hooks (slot-binding, validator-dispatch) continue to fire
- Impulse relevance records are written

---

Fetch recent execution traces using the impulse system and write a trace analysis report.

## Step 1 — Fetch traces using load_impulse

Call the `load_impulse` tool with pointer `{"type": "executionTraceList", "limit": 10}` to retrieve recent execution traces from activity-api.

You MUST use `load_impulse` for this — do NOT use bash, curl, or any direct HTTP call to vessel endpoints. The `load_impulse` tool resolves `executionTraceList` through vessel discovery to activity-api automatically.

## Step 2 — Analyse the traces

From the resolved traces, extract:
- A table of execution IDs, activity IDs, statuses, and durations
- Which activities succeeded vs failed
- The most expensive or slowest execution

## Step 3 — Fetch one trace detail

Pick the execution_id of the most interesting trace (slowest, failed, or most tasks). Call `load_impulse` with `{"type": "activityExecutionTrace", "executionId": "<id>"}` to get the full detail.

Again: use `load_impulse`, not bash/curl.

## Step 4 — Write analysis.md

Write `/workspace/analysis.md` containing:
- A table of all traces (columns: execution_id, activity_id, status, duration_ms, cost_usd)
- A "Most Interesting Trace" section with detail from Step 3
- A "Data Source" section confirming that both fetches used `load_impulse`, not direct HTTP calls

## Acceptance criteria

1. `/workspace/analysis.md` exists with real trace data (execution IDs must look like `act_...`)
2. `[Impulse] Resolved via vessel discovery` appears in stderr at least once
3. New impulse-relevance records are written by lifecycle hooks during the run
