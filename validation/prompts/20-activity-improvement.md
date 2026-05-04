# Prompt 20: activity improvement via core-activity-audit and trace-driven update

This prompt verifies that minibob can run the activity registry quality pipeline to audit, select, and improve existing activities based on real execution traces from the backend.

**What to verify:**
- `load_impulse(activityExecutionTrace)` fetches real traces from activity-api via discovery
- `load_impulse(activityTemplate)` fetches the template under review
- minibob executes the `core-activity-audit` or equivalent activity to identify improvement candidates
- An improved variant is produced (written to `/workspace/improved-activity.json`)
- `[Impulse] Resolved via vessel discovery` appears for activity-api shapes
- Lifecycle hooks fire; impulse relevance records are updated

---

You have access to a live activity registry with thousands of execution traces. Your goal is to audit one activity and produce an improved variant.

## Step 1 — Audit the registry

Use `load_impulse` with pointer `{"type": "executionTraceList", "limit": 20, "success_only": false}` to get recent traces.

From the list, identify:
- The activity_id that appears most frequently
- Whether it has any failures

## Step 2 — Fetch the activity template

Use `load_impulse` with pointer `{"type": "activityTemplate", "templateId": "<the-most-frequent-id>"}` to retrieve the full template. Note: the field is `templateId`, not `activityId`.

## Step 3 — Fetch a failed trace for that activity

If there are failures, use `load_impulse` with pointer `{"type": "activityExecutionTrace", "executionId": "<failed-execution-id>"}` to get details on what went wrong.

## Step 4 — Produce an improved variant

Based on what you see in the template and the failure trace (or the most interesting execution), write an improved version of the activity template to `/workspace/improved-activity.json`. The improvements should address:
- Any missing output_shapes declarations
- Task descriptions that are vague or missing resolver fields
- Any patterns from the failure trace

The JSON must be valid and follow the activity template schema (id, name, description, tags, input_shapes, output_shapes, tasks[]).

## Step 5 — Write audit.md

Write `/workspace/audit.md` containing:
- The activity_id audited and its current Thompson α/β if visible
- Summary of what was wrong or could be improved
- What changes were made in the improved variant
- Confirmation that all data was fetched via `load_impulse`

## Acceptance criteria

1. `/workspace/improved-activity.json` is valid JSON with a real activity id from the backend
2. `/workspace/audit.md` documents real trace data (real execution IDs)
3. `[Impulse] Resolved via vessel discovery` appears in stderr for `executionTraceList` and/or `activityTemplate`
4. New impulse-relevance records written during the run
