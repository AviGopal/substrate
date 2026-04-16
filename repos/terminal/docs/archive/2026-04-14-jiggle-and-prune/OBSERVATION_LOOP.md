# Terminal Vessel Development with Observation Loop

This document explains how to use the observation/learning loop while developing the terminal vessel.

## Overview

Instead of developing in the traditional way (write code → test → fix), we **observe** the development process itself, capturing:
- What works and what doesn't
- How long things take
- Which patterns succeed
- Which approaches fail

This data feeds Thompson Sampling, which learns to recommend better approaches over time.

## Setup

### 1. Configure MiniBob

```bash
# Install MiniBob (if not already installed)
curl -fsSL https://minibob.dev/install.sh | sh

# Configure with your API key
minibob configure \
  --endpoint https://activity.metabob.com \
  --api-key $METABOB_API_KEY
```

### 2. Register Observation Activities

```bash
# Register all terminal vessel observation activities
for activity in repos/terminal/activities/*.json; do
  curl -X POST https://activity.metabob.com/v2/activities/templates \
    -H "Authorization: ApiKey $METABOB_API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$activity"
done
```

## Usage

### Run the Complete Observation Loop

```bash
cd repos/terminal
./scripts/observe-development.sh
```

This will:
1. Execute test observation activity
2. Capture state before/during/after tests
3. Post trace to activity API
4. Analyze recent traces for patterns
5. Generate improvement suggestions
6. Show Thompson Sampling scores

### Observe Individual Activities

#### Observe Tests

```bash
minibob --single "execute activity: terminal-observe-test-run"

# Get the trace ID
TRACE_ID=$(minibob get-last-trace-id)

# Query the trace
curl "https://activity.metabob.com/v2/activities/execution-traces/$TRACE_ID" \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq .
```

#### Observe Feature Development

```bash
# Create a feature request impulse
FEATURE_IMPULSE=$(cat <<EOF
{
  "id": "feature-$(date +%s)",
  "pointer": {
    "type": "memo",
    "content": "Add session timeout feature to terminal vessel"
  },
  "metadata": { "shape": "goal" }
}
EOF
)

# Execute feature development with observation
minibob --single "execute activity: terminal-observe-feature-development with impulse: $FEATURE_IMPULSE"
```

#### Analyze Traces

```bash
minibob --single "execute activity: terminal-analyze-development-traces"

# Check for suggestions
cat /tmp/terminal-suggestions.txt
```

## Understanding the Data

### Trace Structure

Every execution creates a trace like this:

```typescript
{
  activity_id: "terminal-observe-test-run",
  execution_id: "exec-abc123",
  status: "completed" | "failed",
  duration_ms: 5430,

  // What state changed
  state_transition: {
    before: {
      "repos/terminal/src/index.ts": "hash-abc"
    },
    after: {
      "repos/terminal/src/index.ts": "hash-def",  // Modified
      "/tmp/terminal-test-output.txt": "hash-ghi"  // Created
    }
  },

  // Task-by-task execution
  tasks: [
    {
      task_id: "capture-pre-test-state",
      status: "completed",
      duration_ms: 123,
      tool_calls: [...]
    },
    // ...
  ],

  // Impulses used
  input_impulses: [
    { id: "test_files", shape: "test_suite", ... }
  ]
}
```

### Thompson Sampling Scores

Query the success rate:

```bash
curl "https://activity.metabob.com/v2/activities/thompson-sampling/score?activity_id=terminal-observe-test-run" \
  -H "Authorization: ApiKey $METABOB_API_KEY"
```

Returns:

```json
{
  "alpha": 15,    // Successes
  "beta": 3,      // Failures
  "success_rate": 0.833,
  "confidence": "high"
}
```

**Interpretation:**
- `α/(α+β)` = success rate
- High α, low β = reliable activity
- Low α, high β = unreliable, consider variant
- Low α, low β = not enough data

### Pattern Detection

The analysis activity detects:

1. **High failure rate** (success < 70%)
   - Action: Create activity variant
   - Creates GitHub issue

2. **Common failure points** (same task fails repeatedly)
   - Action: Flag for investigation
   - Creates GitHub issue

3. **Duration anomalies** (execution > mean + 2σ)
   - Action: Flag for performance review
   - Creates GitHub issue

## Integration with CI/CD

The GitHub Actions workflow automatically:

1. **On push to dev/main**:
   - Executes test observation activity
   - Posts trace to activity API
   - Checks Thompson Sampling score
   - Blocks if success rate < 50%
   - Warns if success rate < 70%

2. **Every 6 hours**:
   - Analyzes all recent traces
   - Detects patterns
   - Creates GitHub issues for problems
   - Suggests activity variants

3. **After deployment**:
   - Posts CI result to activity API
   - Updates Thompson Sampling α/β
   - Learns from deployment success/failure

## Decision Points

### WHERE to Act

| Layer | When | Action |
|-------|------|--------|
| **Activity tasks** | During execution | Conditional rollback, checkpoints |
| **CI/CD steps** | After tests/deployment | Block, warn, create issues |
| **Backend triggers** | Trace patterns detected | Auto-create variants |
| **Periodic analysis** | Every 6 hours | Suggest improvements |

### WHEN to Act

| Trigger | Threshold | Action |
|---------|-----------|--------|
| **Immediate** | Single execution fails | Log, report |
| **Per-deployment** | Success rate < 50% | BLOCK deployment |
| **Per-deployment** | Success rate < 70% | WARN + create variant |
| **Batched** | Pattern in 10+ traces | Create GitHub issue |
| **Periodic** | Analysis finds anomaly | Suggest variant |

## Examples

### Example 1: Tests Start Failing

1. **You push code** → CI runs observation activity
2. **Test fails** → Trace shows `status: "failed"`
3. **CI posts result** → Thompson Sampling updates β
4. **Next push** → If success rate < 70%, CI creates issue
5. **Analysis runs** → Detects pattern, suggests variant

### Example 2: Slow Test Execution

1. **Normal test**: 500ms
2. **Anomaly**: 5000ms (>2σ from mean)
3. **Analysis detects** → Creates performance issue
4. **Developer investigates** → Finds N+1 query problem
5. **Fix deployed** → Future traces show improved duration

### Example 3: Feature Development Pattern

1. **Execute feature observation** → Captures implementation
2. **Feature succeeds** → Thompson Sampling: α++
3. **Similar feature** → Same impulses loaded
4. **Fails** → Pattern detector suggests missing impulse
5. **Add impulse** → Future similar features succeed

## Querying Traces

### Get Recent Terminal Traces

```bash
curl "https://activity.metabob.com/v2/activities/execution-traces?repository=terminal-vessel&limit=20" \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq .
```

### Filter by Activity

```bash
curl "https://activity.metabob.com/v2/activities/execution-traces?activity_id=terminal-observe-test-run&limit=50" \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq .
```

### Filter by Status

```bash
curl "https://activity.metabob.com/v2/activities/execution-traces?repository=terminal-vessel&status=failed" \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq .
```

### Analyze Patterns Locally

```bash
# Get failures
curl -s "https://activity.metabob.com/v2/activities/execution-traces?repository=terminal-vessel&limit=50" \
  -H "Authorization: ApiKey $METABOB_API_KEY" | \
  jq '[.traces[] | select(.status == "failed")] | group_by(.tasks[] | select(.status == "failed") | .task_id) | map({task: .[0].tasks[] | select(.status == "failed") | .task_id, count: length})'
```

## Next Steps

1. **Run the observation loop** for a few development cycles
2. **Accumulate traces** (need ~20 for meaningful patterns)
3. **Review Thompson Sampling scores** weekly
4. **Create variants** for low-performing activities
5. **Let the system learn** which approaches work best

## Philosophy

**Traditional development:**
```
Write code → Test → Fix → Repeat
```

**Observation-driven development:**
```
Observe process → Capture traces → Detect patterns → Learn → Improve
                      ↑                                        ↓
                      └────────────── Continuous ─────────────┘
```

The key difference: **The system learns from every execution**, not just from your manual reflection. Over time, it discovers which approaches succeed and recommends them automatically.
