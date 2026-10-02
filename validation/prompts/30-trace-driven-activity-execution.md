# Prompt 30: Trace-driven activity execution — minibob works on backend traces using activities

This is the integration proof: minibob fetches real execution traces from the backend via impulse
resolution, selects an activity template appropriate for trace analysis via Thompson Sampling,
executes that activity against the trace data, and submits a new trace for its own work —
completing the full learning loop.

**What to verify:**
- Real execution traces are retrieved from activity-api via vessel discovery
- An activity template is selected for the analysis work via `activityTemplateRecommendation`
- The selected activity is executed, firing lifecycle hooks throughout
- The analysis produces a meaningful artifact (improvement proposal or diagnostic report)
- A new execution trace is submitted for the analysis work itself
- `[Impulse] Resolved via vessel discovery` appears for at least three distinct shapes
- No unexpected ERROR lines in stderr

---

You are running a trace-driven improvement cycle. You will retrieve real execution data from the
backend, diagnose failure patterns using an activity, produce a concrete improvement, and record
your own work as a trace.

## Step 1 — Retrieve recent traces including failures

Use `load_impulse` with pointer `{"type": "executionTraceList", "limit": 30, "success_only": false}` to get recent traces. From the list:
- Count how many traces have `status: "failed"` or `status: "error"`
- Find the `activity_id` with the most failures
- Record the `execution_id` of the most recent failure

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 2 — Get a Thompson-recommended activity for trace analysis

Use `load_impulse` with pointer:

```json
{
  "type": "activityTemplateRecommendation",
  "goal": "analyse execution traces to identify failure patterns and propose improvements"
}
```

Record:
- The recommended `template_id`
- Its `alpha` and `beta` at recommendation time
- Whether the recommendation is based on Thompson Sampling (sample_count > 0) or prior

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 3 — Fetch the full failing trace

Use `load_impulse` with pointer:

```json
{
  "type": "activityExecutionTrace",
  "executionId": "<the failed execution_id from Step 1>"
}
```

From the trace, extract:
- Which task(s) failed (task id and description)
- `failure_mode.type` (if present)
- `failure_mode.reason` (if present)
- Which resolver was used for the failing task
- The activity template id that was executing

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 4 — Fetch the template that was failing

Use `load_impulse` with pointer `{"type": "activityTemplate", "templateId": "<activity_id from the trace>"}` to get the full template structure. Record its `tasks` array structure, `input_shapes`, and `output_shapes`.

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 5 — Produce a diagnostic + improvement proposal

Based on the trace analysis (Steps 3 and 4), write two files:

### `/workspace/trace-diagnosis.md`
Document:
- The failing activity ID and its Thompson state (α, β from variantMetricsSummary if you fetched it)
- The execution ID analysed
- Which task failed and why
- The failure_mode type and reason (or "not recorded" if absent)
- The resolver involved

### `/workspace/improvement-proposal.json`
Write a valid activity template JSON that addresses the failure pattern. The improved template MUST:
- Use the same base `id` with `-improved` or `-v2` suffix
- Have at least one structural change addressing the root cause:
  - If the failure was a resolver mismatch → change the resolver
  - If validation was missing → add a validation block
  - If a task was vague → add precise `config` fields or tighten the prompt
  - If output_shapes were missing → declare them
- Be valid JSON following the activity template schema

## Step 6 — Submit a trace for this analysis work

Use `load_impulse` with pointer:

```json
{
  "type": "activityExecutionTrace_write",
  "traceData": {
    "execution_id": "exec_phase30_<unix_timestamp_ms>",
    "template_id": "<recommended template_id from Step 2>",
    "success": true,
    "duration_ms": <actual duration>,
    "tasks": [
      {
        "id": "fetch-traces",
        "description": "Retrieve execution trace list via impulse resolution",
        "resolver": "impulse-resolve",
        "success": true,
        "duration_ms": 1000
      },
      {
        "id": "analyse-failure",
        "description": "Analyse failing trace and fetch template structure",
        "resolver": "llm",
        "success": true,
        "duration_ms": 2000
      },
      {
        "id": "write-proposal",
        "description": "Write diagnostic report and improvement proposal",
        "resolver": "bash",
        "success": true,
        "duration_ms": 500
      }
    ]
  }
}
```

Record the execution ID returned.

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 7 — Write /workspace/loop-summary.md

Write a markdown file summarising the full trace-driven loop:

### Section 1: Traces Retrieved
- Total traces fetched (limit 30)
- Number of failures found
- Most-failed activity_id

### Section 2: Activity Selected for Analysis
- Template ID recommended by Thompson Sampling
- α, β, sample_count at recommendation time
- Whether prior or posterior (sample_count > 0 = posterior)

### Section 3: Trace Analysed
- Execution ID of the failure diagnosed
- Failing task and failure_mode details
- Resolver involved

### Section 4: Improvement Produced
- Path to improvement-proposal.json
- Key structural changes made

### Section 5: Trace Submitted
- Execution ID of this run's trace
- Success or error from activityExecutionTrace_write

### Section 6: Vessel Discovery Usage
A table of all `[Impulse] Resolved via vessel discovery` lines observed:
`shape | vessel | result`

## Acceptance criteria

1. `/workspace/trace-diagnosis.md` documents a real execution ID (not a placeholder)
2. `/workspace/improvement-proposal.json` is valid JSON with a real template ID (no `<placeholders>`)
3. `/workspace/loop-summary.md` exists with real numeric α/β values
4. `[Impulse] Resolved via vessel discovery` appears in stderr for at least three distinct shapes
5. An `activityExecutionTrace_write` was submitted for this run's own work (execution ID starts with `exec_phase30_`)
6. At least one lifecycle hook line appears in stderr (`lifecycle:task:preBinding` or `lifecycle:task:completed`)
