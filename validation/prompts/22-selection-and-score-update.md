# Prompt 22: Selection and score update — Thompson posterior reflects actual outcome

This prompt proves that Thompson Sampling selection happens during activity execution, and that the α or β for the selected variant changes by exactly 1 after the run — matching the actual outcome (success → Δα=+1, failure → Δβ=+1).

**What to verify:**
- `load_impulse({"type": "variantMetricsSummary"})` fetches live Thompson state before and after a run
- `load_impulse({"type": "activityTemplateRecommendation", ...})` returns a specific variant selected by Thompson Sampling
- After executing the recommended activity, α or β updates by exactly 1
- `[Impulse] Resolved via vessel discovery` appears for both the metrics fetch and the recommendation
- The actual task (write hello.txt) succeeds so the path is a success update (Δα=+1)

---

You are verifying the Thompson Sampling feedback loop. You will snapshot scores before a run, execute an activity, and then confirm the scores updated to reflect the outcome.

## Step 1 — Snapshot scores before the run

Use `load_impulse` with pointer `{"type": "variantMetricsSummary"}` to get current Thompson state for all template families.

Find a template family where at least one variant has `sample_count > 0` (it has been executed before). Record the variant ids and their current `alpha`, `beta`, and `sample_count` values. This is your **pre-run snapshot**.

If no variant has `sample_count > 0`, pick any family — record the initial priors as the baseline.

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 2 — Get a recommendation

Use `load_impulse` with pointer:

```json
{
  "type": "activityTemplateRecommendation",
  "goal": "write a hello world program to /workspace/hello.txt and verify it exists"
}
```

This asks activity-api to Thompson-sample over its template registry and recommend the best template for this goal. Record:
- The recommended `template_id` (or `variant_id`)
- Its `alpha` and `beta` at recommendation time (should match your snapshot from Step 1)

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 3 — Write hello.txt AND submit a success trace

First, write the string `Hello, world!` followed by a newline to `/workspace/hello.txt` using bash or write_file. Verify the file exists and contains that text.

Then immediately submit a success execution trace for the recommended variant using `load_impulse`:

```json
{
  "type": "activityExecutionTrace_write",
  "trace": {
    "activity_id": "<the template_id from Step 2>",
    "success": true,
    "duration_ms": 500,
    "tasks": [
      {
        "id": "write-hello",
        "description": "Write Hello, world! to /workspace/hello.txt",
        "resolver": "bash",
        "success": true,
        "duration_ms": 500
      }
    ]
  }
}
```

This is the mechanism that triggers Thompson score updates — the activity-api updates α when a success trace is submitted for the variant. Record the execution ID returned (or note if submission failed).

You MUST use `load_impulse` for the trace write — do NOT use bash or curl.

## Step 4 — Snapshot scores after the trace write

Use `load_impulse` again with pointer `{"type": "variantMetricsSummary"}` to fetch the updated Thompson state. This should reflect the trace submitted in Step 3.

Find the same variant from Step 1 in the new results. Record its updated `alpha`, `beta`, and `sample_count`.

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 5 — Write /workspace/score-update-report.md

Write a markdown file at `/workspace/score-update-report.md` containing:

### Section 1: Variant Tracked
- Variant ID (or template ID) that was recommended and executed
- Family it belongs to (root template id if known)

### Section 2: Score Delta Table
A table with columns: `metric | before | after | delta`

Rows:
- `alpha` — α before and after, Δα = after − before
- `beta` — β before and after, Δβ = after − before
- `sample_count` — before and after, Δ = after − before

### Section 3: Outcome Interpretation
State:
- The task outcome: SUCCESS (hello.txt was written) or FAILURE
- Expected update: success → Δα should be +1, Δβ should be 0; failure → Δα should be 0, Δβ should be +1
- Actual update: whether α or β changed as expected
- Verdict: `SCORE_UPDATED_CORRECTLY` or `SCORE_MISMATCH` with explanation

### Section 4: Execution Reference
- The execution ID returned by the `activityExecutionTrace_write` call (or the error if it failed)
- Confirmation that all three `load_impulse` calls (pre-snapshot, trace write, post-snapshot) used vessel discovery

## Acceptance criteria

1. `/workspace/score-update-report.md` exists with real variant IDs (not placeholders) and numeric α/β values
2. `/workspace/hello.txt` exists and contains `Hello, world!`
3. Either α or β changed between the pre-run and post-run snapshots (delta is non-zero for exactly one of them)
4. `[Impulse] Resolved via vessel discovery` appears in stderr for the `variantMetricsSummary` fetch and/or the `activityTemplateRecommendation` fetch
