# Verifying Ontological Alignment: Using Execution Traces

## Overview

The execution trace system now captures the **complete three-state transformation cycle**, allowing us to verify that the system is aligned with the ontological model:

```
VESSEL (Instructional) → BECOMING (Transient) → INSTANCE (Functional) → Learning → VESSEL (Improved)
```

## Quick Start: Trace a Recent Execution

### 1. Find a Recent Execution

```bash
# Get the most recent successful execution
curl -s 'http://api.minibob.local/v2/activities/execution-traces?limit=1&success=true' | \
  jq '.executions[0] | {execution_id, variant_id, success, duration_ms}'
```

**Example Output:**
```json
{
  "execution_id": "act_1774256614259_hezr73",
  "variant_id": "diagnose-problem-v1",
  "success": true,
  "duration_ms": 41987
}
```

### 2. Trace the Intention Flow

```bash
# Run the tracing activity
cd repos/minibob
bun run index.ts templates/trace-intention-flow.json '{
  "execution_id": "act_1774256614259_hezr73"
}'
```

This will:
1. ✅ Fetch the complete execution trace
2. ✅ Analyze Vessel → Becoming transition
3. ✅ Analyze Becoming → Instance transition
4. ✅ Generate alignment report

### 3. Review the Alignment Report

The activity creates `ALIGNMENT_REPORT_act_*.md` with:
- Vessel identity and instantiation context
- Task sequence and tool usage analysis
- State transition verification
- Learning loop status
- Overall alignment assessment
- Recommendations for improvement

## Manual Verification Queries

### Query 1: Verify Vessel Instantiation

**Check if the right context was loaded:**

```bash
curl -s 'http://api.minibob.local/v2/activities/execution-traces/act_1774256614259_hezr73' | \
  jq '{
    vessel: {
      variant_id: .variant_id,
      activity_id: .activity_id
    },
    instantiation: {
      impulses: .impulses_used,
      variables: .state_snapshot.input_state.variables,
      environment: .state_snapshot.input_state.environment
    }
  }'
```

**What to Check:**
- ✅ Do impulses match the activity's needs?
- ✅ Do variables capture the goal correctly?
- ✅ Is the environment configured properly?

### Query 2: Verify Becoming Transformation

**Check if tasks executed correctly:**

```bash
curl -s 'http://api.minibob.local/v2/activities/execution-traces/act_1774256614259_hezr73' | \
  jq '.tasks[] | {
    task_id,
    description,
    status,
    duration_ms,
    tools: [.tool_calls[]?.tool] | unique
  }'
```

**What to Check:**
- ✅ Did tasks execute in logical order?
- ✅ Were appropriate tools used for each task?
- ✅ Did all tasks complete successfully?
- ✅ Are durations reasonable?

### Query 3: Verify Instance Actualization

**Check if the right files were modified:**

```bash
curl -s 'http://api.minibob.local/v2/activities/execution-traces/act_1774256614259_hezr73' | \
  jq '{
    output_state: .state_snapshot.output_state,
    metrics: {
      success: .success,
      duration_ms: .duration_ms,
      cost: .cost,
      tokens: .tokens
    }
  }'
```

**What to Check:**
- ✅ Were only intended files modified?
- ✅ Were expected files created?
- ✅ Is exitCode 0 for successful executions?
- ✅ Are metrics within expected ranges?

### Query 4: Verify Learning Loop

**Check if the execution fed back into learning:**

```bash
# Get variant performance after this execution
curl -s 'http://api.minibob.local/v2/activities/templates/diagnose-problem-v1/metrics' | \
  jq '{
    total_executions,
    successful_executions,
    success_rate,
    thompson_sampling: {
      alpha: .thompson_alpha,
      beta: .thompson_beta
    }
  }'
```

**What to Check:**
- ✅ Did total_executions increment?
- ✅ Did successful_executions increment (if success=true)?
- ✅ Did thompson_alpha increment (if success=true)?
- ✅ Did thompson_beta increment (if success=false)?

## Ontological Alignment Checklist

Use this checklist to verify alignment:

### ✅ Vessel (Instructional State)
- [ ] Activity template is well-defined
- [ ] Tasks have clear prompts and validations
- [ ] Impulses are specified correctly
- [ ] Variables capture all necessary context
- [ ] Template is versioned and stored

### ✅ Becoming (Transient State)
- [ ] Execution traces are being captured
- [ ] Task sequence is recorded
- [ ] Tool calls are logged with timing
- [ ] State transitions are tracked
- [ ] Impulses are loaded and used appropriately

### ✅ Instance (Functional State)
- [ ] Execution completes with clear status
- [ ] Files are modified/created as intended
- [ ] Metrics are recorded (duration, cost, tokens)
- [ ] Exit code reflects actual outcome
- [ ] Artifacts are persisted

### ✅ Learning Loop (Continuous)
- [ ] Thompson Sampling is updated
- [ ] Ribosome extracts patterns from successes
- [ ] New variants are created when appropriate
- [ ] Failed executions trigger trailblazing
- [ ] The cycle continues without manual intervention

## Common Misalignment Patterns

### Pattern 1: Context Mismatch
**Symptom:** Execution fails because needed files aren't available

**Diagnosis:**
```bash
curl -s 'http://api.minibob.local/v2/activities/execution-traces/act_xyz' | \
  jq '{
    files_available: .state_snapshot.input_state.filesAvailable,
    files_needed: .state_snapshot.output_state.filesModified,
    missing: [.state_snapshot.output_state.filesModified[] |
      select(. as $f | .state_snapshot.input_state.filesAvailable | index($f) == null)]
  }'
```

**Fix:** Add missing files to impulses or filesAvailable

### Pattern 2: Tool Misuse
**Symptom:** Wrong tool used for task (e.g., using bash instead of read)

**Diagnosis:**
```bash
curl -s 'http://api.minibob.local/v2/activities/execution-traces/act_xyz' | \
  jq '.tasks[] | select(.tool_calls[]?.tool == "bash") |
    {task_id, description, tools: [.tool_calls[]?.tool]}'
```

**Fix:** Review task prompts to guide better tool selection

### Pattern 3: Broken Learning Loop
**Symptom:** Executions run but Thompson Sampling doesn't update

**Diagnosis:**
```bash
# Check if executions are being reported
curl -s 'http://api.minibob.local/v2/activities/executions?variant_id=xyz&limit=5' | \
  jq '{total: .total, executions: [.executions[].execution_id]}'

# Check if metrics are being updated
curl -s 'http://api.minibob.local/v2/activities/templates/xyz/metrics' | \
  jq '{total_executions, thompson_alpha, thompson_beta}'
```

**Fix:** Verify backend API is receiving execution reports

### Pattern 4: State Transition Anomalies
**Symptom:** Files modified that shouldn't have been

**Diagnosis:**
```bash
curl -s 'http://api.minibob.local/v2/activities/execution-traces/act_xyz' | \
  jq '{
    state_transition: .state_snapshot.stateTransition,
    unexpected: [.state_snapshot.output_state.filesModified[] |
      select(. as $f | .state_snapshot.input_state.filesAvailable | index($f) == null)]
  }'
```

**Fix:** Add guards in prompts to prevent unintended modifications

## Continuous Verification

To maintain alignment, run these checks regularly:

### Daily: Execution Health
```bash
# Check success rates across all variants
curl -s 'http://api.minibob.local/v2/activities/templates' | \
  jq '[.templates[] | {
    variant_id,
    success_rate: .metrics.success_rate,
    total_executions: .metrics.total_executions
  }] | sort_by(.success_rate)'
```

### Weekly: Learning Loop Audit
```bash
# Verify Thompson Sampling is tracking correctly
curl -s 'http://api.minibob.local/v2/activities/templates' | \
  jq '[.templates[] | {
    variant_id,
    alpha: .metrics.thompson_alpha,
    beta: .metrics.thompson_beta,
    expected_success_rate: (.metrics.thompson_alpha /
      (.metrics.thompson_alpha + .metrics.thompson_beta))
  }]'
```

### Monthly: State Transition Audit
```bash
# Check for anomalous state transitions
curl -s 'http://api.minibob.local/v2/activities/execution-traces?limit=100' | \
  jq '[.executions[] | select(.state_snapshot.output_state.exitCode != 0
    and .success == true)] | length'
# Should be 0 - success should match exitCode
```

## Integration with Dashboard

The execution traces are now available in the Activity Dashboard at `http://dashboard.minibob.local`:

- **Execution History Tab**: View all executions with state transitions
- **Vessel Status Tab**: See which templates are being used
- **Thompson Sampling Tab**: Monitor learning loop health
- **Trace Viewer**: Deep-dive into individual executions

## Next Steps

1. ✅ **Run trace-intention-flow** on recent executions
2. ✅ **Review alignment reports** to identify issues
3. ✅ **Fix misalignments** by updating templates or impulses
4. ✅ **Monitor learning loop** to ensure continuous improvement
5. ✅ **Build dashboard visualizer** for real-time verification

This creates a **self-observing system** where the process-of-becoming can verify its own alignment with the ontological model.
