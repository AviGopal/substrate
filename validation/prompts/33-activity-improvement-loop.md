# Prompt 33: Activity improvement loop — fetch trace → diagnose → propose → submit new trace

This prompt runs a complete activity improvement cycle using ONLY the backend learning loop.
It verifies that minibob can use Thompson Sampling recommendations (with real α/β from F-V36 fix),
diagnose a real failing template, write a concrete improved variant, and record the full cycle
as a new execution trace — proving the learning loop advances.

**What to verify:**
- `activityTemplateRecommendation` returns real α/β values (F-V36 fix confirmed)
- Real failing traces are retrieved and diagnosed from activity-api
- An improved activity template is produced based on trace evidence
- The improved template has a concrete structural change (not just renaming)
- The improvement cycle itself is recorded as a trace via `activityExecutionTrace_write`
- `activityMetrics` shape returns Thompson posterior for the analysed template
- Multiple vessels used: activity-api (traces, templates, metrics, write), discovery-vessel (capability queries)

---

You are running a self-improvement cycle. Minibob will analyse its own past executions, identify
a weak activity template, propose a concrete improvement, and record the work as a learning signal.

## Step 1 — Get Thompson-recommended template for improvement work

Use `load_impulse` with pointer:
```json
{
  "type": "activityTemplateRecommendation",
  "goal": "diagnose failing activity templates and propose structural improvements"
}
```

The response MUST include `alpha` and `beta` fields per template. Record:
- Top 3 recommended template IDs
- Their α, β, and sample_count values
- Whether they are prior (sample_count = 0) or posterior (sample_count > 0)

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 2 — Retrieve failing traces for the most-failed template

Use `load_impulse` with pointer:
```json
{"type": "executionTraceList", "limit": 50, "success_only": false}
```

From the list:
- Count failures per `activity_id`
- Identify the `activity_id` with the most failures (call it TARGET_TEMPLATE)
- Pick the most recent failure's `execution_id` (call it TARGET_EXECUTION)

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 3 — Fetch the failing trace in detail

Use `load_impulse` with pointer:
```json
{
  "type": "activityExecutionTrace",
  "executionId": "<TARGET_EXECUTION>"
}
```

Extract:
- Which task(s) failed and their descriptions
- `failure_mode.type` and `failure_mode.reason` (or "not recorded")
- The resolver used for the failing task(s)
- `input_impulse_ids` and `output_impulse_ids` for the failing task (if present)

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 4 — Fetch the template's current structure and metrics

Run these two in parallel (both are `load_impulse` calls):

**4a.** Template structure:
```json
{"type": "activityTemplate", "templateId": "<TARGET_TEMPLATE>"}
```

**4b.** Template metrics (Thompson posterior):
```json
{"type": "activityMetrics", "templateId": "<TARGET_TEMPLATE>"}
```

Record from 4b: `thompson_alpha`, `thompson_beta`, `success_rate`, `total_executions`.

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 5 — Produce improved template and diagnosis

Based on evidence from Steps 3 and 4, write two files:

### `/workspace/improvement-diagnosis.md`

Document:
- TARGET_TEMPLATE id and its metrics (α, β, success_rate, total_executions)
- TARGET_EXECUTION id and what failed (task id, description, resolver, failure_mode)
- Root cause analysis: WHY did this task fail? (be specific — vague prompt? wrong resolver? missing validation? no output_shapes?)
- Proposed fix: exactly what structural change will improve it

### `/workspace/improved-template.json`

Write the improved activity template as valid JSON. Requirements:
- `id`: TARGET_TEMPLATE + `-v2` or `-improved` suffix
- At minimum ONE of these structural changes based on the root cause:
  - Change the resolver for the failing task (e.g. `"resolver": "llm"` → `"resolver": "bash"`)
  - Add a `validation` block with `requiredFiles` or `requiredPatterns`
  - Add missing `output_shapes` to the task or template
  - Make a vague task description precise by adding `config` fields
  - Add a `retry` block if the failure was transient
- Keep all tasks from the original; only change what the diagnosis indicates

## Step 6 — Record impulse relevance for the shapes used

Use `load_impulse` with pointer:
```json
{
  "type": "impulseRelevance_write",
  "relevanceData": {
    "activity_variant_id": "<TARGET_TEMPLATE>",
    "impulse_shape": "activityExecutionTrace",
    "was_relevant": true,
    "relevance_score": 0.9,
    "context": "trace analysis for activity improvement loop"
  }
}
```

Record whether this succeeded.

## Step 7 — Submit a trace for this improvement cycle

Use `load_impulse` with pointer:
```json
{
  "type": "activityExecutionTrace_write",
  "traceData": {
    "execution_id": "exec_phase33_<unix_timestamp_ms>",
    "template_id": "activity-improvement-loop",
    "success": true,
    "duration_ms": <actual_ms>,
    "tasks": [
      {"id": "recommend", "description": "Get Thompson recommendation", "resolver": "impulse-resolve", "success": true, "duration_ms": 800},
      {"id": "fetch-traces", "description": "Retrieve failing trace list", "resolver": "impulse-resolve", "success": true, "duration_ms": 600},
      {"id": "fetch-failing-trace", "description": "Fetch detailed failing trace", "resolver": "impulse-resolve", "success": true, "duration_ms": 700},
      {"id": "fetch-template", "description": "Fetch template structure and metrics", "resolver": "impulse-resolve", "success": true, "duration_ms": 900},
      {"id": "produce-improvement", "description": "Write diagnosis and improved template", "resolver": "llm", "success": true, "duration_ms": 3000},
      {"id": "record-relevance", "description": "Write impulse relevance signal", "resolver": "impulse-resolve", "success": true, "duration_ms": 400}
    ]
  }
}
```

Record the returned execution ID.

## Step 8 — Write /workspace/improvement-loop-summary.md

### Thompson Sampling Verification (F-V36)
- Top recommended template ID
- α value: (must be a real number ≥ 1, not a placeholder)
- β value: (must be a real number ≥ 1, not a placeholder)
- sample_count: (prior = 0, posterior > 0)
- VERDICT: `F-V36 CONFIRMED` if α/β are real numbers, `STILL BROKEN` if missing

### Improvement Cycle
| step | shape resolved | vessel | result |
|------|---------------|--------|--------|
| 1 | activityTemplateRecommendation | activity-api | SUCCESS/FAIL |
| 2 | executionTraceList | activity-api | SUCCESS/FAIL |
| 3 | activityExecutionTrace | activity-api | SUCCESS/FAIL |
| 4a | activityTemplate | activity-api | SUCCESS/FAIL |
| 4b | activityMetrics | activity-api | SUCCESS/FAIL |
| 6 | impulseRelevance_write | activity-api | SUCCESS/FAIL |
| 7 | activityExecutionTrace_write | activity-api | SUCCESS/FAIL |

### Improvement Produced
- TARGET_TEMPLATE: ...
- Structural change made: ...
- Expected impact: ...

### Execution Trace Submitted
- Execution ID: exec_phase33_...
- Status: SUCCESS/FAIL

## Acceptance criteria

1. `activityTemplateRecommendation` returns REAL α and β values (not null, not missing) — F-V36 confirmed
2. `/workspace/improvement-diagnosis.md` documents a real execution ID and specific failure analysis
3. `/workspace/improved-template.json` is valid JSON with a real template ID and at least one structural change
4. `impulseRelevance_write` succeeds (HTTP 201 or 200 returned)
5. `activityExecutionTrace_write` succeeds with an `exec_phase33_*` execution ID
6. `[Impulse] Resolved via vessel discovery` appears in stderr for at least 4 distinct shapes
7. Lifecycle hook lines appear: at least one `lifecycle:task:preBinding` or `lifecycle:task:completed`
8. `/workspace/improvement-loop-summary.md` states `F-V36 CONFIRMED`
