# Prompt 17: Cross-vessel impulse resolution proof

This prompt requires minibob to exercise the formal impulse-based cross-vessel resolution path.
The goal is to prove that `loadImpulse` routes non-local shapes through vessel discovery to
activity-api, rather than the improvise LLM making direct HTTP calls.

The `trace-analysis-with-feedback` embedded activity template exists specifically for this
validation — it uses `resolver: "impulse-resolve"` for both the `executionTraceList` read
and the `impulseRelevance_write`, ensuring both go through `loadImpulse` → discovery → activity-api.

---

Using the `trace-analysis-with-feedback` activity, perform a trace-driven analysis with
relevance feedback:

## Step 1 — Fetch traces via impulse system

Run the `trace-analysis-with-feedback` activity with default variables (limit=10). The
`fetch_traces` task in this activity uses `resolver: "impulse-resolve"` with
`pointer.type = "executionTraceList"` — this MUST route through vessel discovery to
activity-api, not via a direct HTTP call.

## Step 2 — Classify and analyse

The LLM tasks in the activity classify each trace, identify the slowest or most-failed
activity, and prepare the relevance write pointer.

## Step 3 — Write relevance feedback via impulse system

The `write_relevance_feedback` task uses `resolver: "impulse-resolve"` with
`pointerFromImpulse: "relevance_pointer"` — the pointer is a JSON object with
`type = "impulseRelevance_write"` produced by the LLM step. This MUST also route
through vessel discovery to activity-api.

## Step 4 — Produce analysis.md

The `write_analysis_file` task writes `/workspace/analysis.md`. The file must contain:
- A table of all traces (columns: execution_id, activity_id, status, duration_ms)
- A Failure Summary section
- A Relevance Update section confirming that the impulse relevance write was dispatched
  through the impulse resolution system (NOT via a direct HTTP call)

## Acceptance criteria

The goal is complete when:
1. `/workspace/analysis.md` exists and contains real trace data from activity-api
2. The resolution log `[Impulse] Resolved via vessel discovery` appears in stderr
   (i.e. `loadImpulse` was invoked for `executionTraceList`)
3. The impulse relevance write reached activity-api (new record in relevance table)
