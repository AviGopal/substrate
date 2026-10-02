# Prompt 29: Lifecycle hooks fire + impulse score update during activity execution

This prompt verifies that when minibob executes an activity, the full lifecycle event pipeline
fires: `lifecycle:task:preBinding` before each task, `lifecycle:task:completed` after each task,
and that the resulting impulse relevance feedback is written to activity-api.

**What to verify:**
- `lifecycle:task:preBinding` appears in stderr during an activity execution
- `lifecycle:task:completed` appears in stderr after each task
- An `impulseRelevance_write` or `activityExecutionTrace_write` is dispatched via vessel discovery
- The Thompson posterior for the selected activity variant reflects the outcome (α or β changed)
- `[Impulse] Resolved via vessel discovery` appears for at least two distinct shapes

---

You are verifying the lifecycle and learning loop. Your goal is to execute a small practical task
as an activity (not just raw LLM work), observe that lifecycle hooks fire, and confirm the
learning system records the outcome.

## Step 1 — Snapshot Thompson scores before the run

Use `load_impulse` with pointer `{"type": "variantMetricsSummary"}` to fetch current Thompson
Sampling state. Find any template family where `sample_count > 0`. Record:
- The template id and variant id (if known separately)
- Current `alpha`, `beta`, `sample_count`

This is your **pre-run baseline**.

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 2 — Execute a practical task and write the result

Perform this task: write a file `/workspace/fibonacci.py` that implements a `fibonacci(n: int) -> int`
function using memoisation, then run it with `fibonacci(10)` and verify the result is `55`.

Use whatever tools are available (bash, write_file). Record:
- Whether the file was written successfully
- Whether `fibonacci(10)` returns 55

This task should trigger an activity execution in minibob, causing lifecycle events to fire.

## Step 3 — Submit a trace for the work done

Use `load_impulse` with pointer:

```json
{
  "type": "activityExecutionTrace_write",
  "traceData": {
    "execution_id": "exec_phase29_<unix_timestamp_ms>",
    "template_id": "fibonacci-implementation",
    "success": true,
    "duration_ms": 1000,
    "tasks": [
      {
        "id": "write-fibonacci",
        "description": "Write fibonacci.py with memoisation and verify output",
        "resolver": "bash",
        "success": true,
        "duration_ms": 500
      }
    ]
  }
}
```

Use the actual unix timestamp in milliseconds. Record the execution ID returned (or error if submission failed).

You MUST use `load_impulse` for the trace write — do NOT use bash or curl.

## Step 4 — Snapshot Thompson scores after the run

Use `load_impulse` with pointer `{"type": "variantMetricsSummary"}` again. Find the same
template family from Step 1 and record its updated `alpha`, `beta`, `sample_count`.

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 5 — Also write impulse relevance feedback

Use `load_impulse` with pointer:

```json
{
  "type": "impulseRelevance_write",
  "relevanceData": {
    "activity_variant_id": "fibonacci-implementation",
    "impulse_type": "bash_output",
    "was_useful": true,
    "context": "fibonacci(10) = 55, correct output confirmed"
  }
}
```

Record whether this succeeded or returned an error.

You MUST use `load_impulse` — do NOT use bash or curl.

## Step 6 — Write /workspace/lifecycle-report.md

Write a markdown file at `/workspace/lifecycle-report.md` with:

### Section 1: Practical Task Result
- Was `fibonacci.py` written? (yes/no)
- Does `fibonacci(10)` return 55? (yes/no)
- First 10 lines of the file (for verification)

### Section 2: Lifecycle Events Observed
List which lifecycle events appeared in stderr during the run. For each event type found,
note approximately how many times it fired:
- `lifecycle:task:preBinding` — count
- `lifecycle:task:completed` — count
- `lifecycle:task:started` — count
- Any other `lifecycle:*` events seen

### Section 3: Thompson Score Delta
A table: `metric | before | after | delta`
- alpha — before/after/delta
- beta — before/after/delta
- sample_count — before/after/delta

State the outcome interpretation: success → Δα=+1, failure → Δβ=+1.

### Section 4: Impulse Writes
- `activityExecutionTrace_write`: execution ID returned, or error
- `impulseRelevance_write`: success or error

### Section 5: Vessel Discovery Usage
Confirm which shapes were resolved via vessel discovery (list each `[Impulse] Resolved via vessel discovery` line seen for this run).

## Acceptance criteria

1. `/workspace/fibonacci.py` exists and `fibonacci(10)` returns `55`
2. `/workspace/lifecycle-report.md` exists with real numeric α/β values (not placeholders)
3. At least one of `lifecycle:task:preBinding` or `lifecycle:task:completed` appears in stderr
4. `[Impulse] Resolved via vessel discovery` appears in stderr for at least two distinct shapes
5. Either `activityExecutionTrace_write` OR `impulseRelevance_write` succeeded (returned a record ID or 200)
