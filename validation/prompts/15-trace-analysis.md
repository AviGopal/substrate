# Prompt 15: Backend trace analysis (cross-vessel resolution test)

This prompt verifies that minibob routes impulse resolution through discovery to
activity-api for shapes it does not own locally. The task **requires** reading
execution trace data from the backend — there is no local file that can substitute.

---

Using the activity registry backend, analyze recent execution history:

1. Fetch the 5 most recent successful execution traces using the `executionTraceList`
   or `activityExecutionTrace` impulse shape. These shapes are resolved by activity-api,
   not locally — use the impulse system, not a direct HTTP call.

2. For each trace, record:
   - `execution_id`
   - `activity_id`
   - `duration_ms`
   - `vessel_id`
   - `task_count`

3. Identify which activity_id appeared most often across the 5 traces.

4. Write a file `/workspace/analysis.md` containing:
   - A table of the 5 traces (columns: execution_id, activity_id, duration_ms, vessel_id)
   - A one-sentence conclusion: "The most common activity was X, appearing N times."
   - A note on how the data was retrieved (which impulse shape and which resolver)

The goal is complete when `/workspace/analysis.md` exists and contains the table
populated with real data from the backend (not placeholder values).
