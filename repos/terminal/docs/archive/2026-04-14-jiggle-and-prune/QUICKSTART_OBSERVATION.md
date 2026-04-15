# Quick Start: Observation Loop for Terminal Vessel

## TL;DR

```bash
# 1. Observe tests running
cd repos/terminal
minibob --single "observe terminal tests"

# 2. Check what happened
curl "https://activity.metabob.com/v2/activities/execution-traces?limit=1" \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq .

# 3. See success rate
curl "https://activity.metabob.com/v2/activities/thompson-sampling/score?activity_id=terminal-observe-test-run" \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq .
```

## Step-by-Step Example

### 1. Create a Simple Observation Activity (Deterministic Only)

```json
{
  "id": "terminal-simple-test-observe",
  "name": "Simple Terminal Test Observation",
  "category": "observation",

  "tasks": [
    {
      "id": "run-tests",
      "description": "Run tests and capture output",
      "prompt": {
        "template": "cd repos/terminal && bun test 2>&1 | tee /tmp/test-output.txt; echo $? > /tmp/test-exitcode.txt"
      }
    },
    {
      "id": "report-result",
      "description": "Report success or failure",
      "prompt": {
        "template": "if [ $(cat /tmp/test-exitcode.txt) -eq 0 ]; then echo 'Tests passed'; else echo 'Tests failed'; fi"
      }
    }
  ]
}
```

### 2. Register the Activity

```bash
curl -X POST https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "terminal-simple-test-observe",
    "name": "Simple Terminal Test Observation",
    "category": "observation",
    "tasks": [
      {
        "id": "run-tests",
        "description": "Run tests and capture output",
        "prompt": {
          "template": "cd repos/terminal && bun test 2>&1 | tee /tmp/test-output.txt; echo $? > /tmp/test-exitcode.txt"
        }
      }
    ]
  }'
```

### 3. Execute It

```bash
minibob --single "execute activity: terminal-simple-test-observe"
```

**What happens:**
1. MiniBob executes the activity
2. Tests run and output is captured
3. State before/after is recorded
4. Trace is posted to activity API
5. Thompson Sampling α or β is updated

### 4. Query the Trace

```bash
# Get the most recent trace
TRACE=$(curl -s "https://activity.metabob.com/v2/activities/execution-traces?activity_id=terminal-simple-test-observe&limit=1" \
  -H "Authorization: ApiKey $METABOB_API_KEY")

echo "$TRACE" | jq '{
  execution_id,
  status,
  duration_ms,
  files_changed: (.state_transition.after | keys | length) - (.state_transition.before | keys | length)
}'
```

### 5. Check Learning

```bash
# Get Thompson Sampling score
curl -s "https://activity.metabob.com/v2/activities/thompson-sampling/score?activity_id=terminal-simple-test-observe" \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq '{
  alpha,
  beta,
  success_rate: (.alpha / (.alpha + .beta))
}'
```

## Real-World Example: Track Test Reliability

Let's observe tests over multiple runs to see if they're flaky:

```bash
# Run observation 10 times
for i in {1..10}; do
  echo "Run $i..."
  minibob --single "execute activity: terminal-simple-test-observe"
  sleep 2
done

# Check success rate
curl -s "https://activity.metabob.com/v2/activities/thompson-sampling/score?activity_id=terminal-simple-test-observe" \
  -H "Authorization: ApiKey $METABOB_API_KEY" | \
  jq '{
    total_runs: (.alpha + .beta),
    successes: .alpha,
    failures: .beta,
    success_rate: (.alpha / (.alpha + .beta)),
    verdict: (if (.alpha / (.alpha + .beta)) >= 0.9 then "Reliable" elif (.alpha / (.alpha + .beta)) >= 0.7 then "Acceptable" else "Flaky - investigate" end)
  }'
```

**Expected output:**
```json
{
  "total_runs": 10,
  "successes": 10,
  "failures": 0,
  "success_rate": 1,
  "verdict": "Reliable"
}
```

## Integrate with Git Workflow

Add a pre-push hook that observes tests:

```bash
# .git/hooks/pre-push
#!/bin/bash

echo "🔬 Observing test execution..."

# Execute observation activity
minibob --single "execute activity: terminal-simple-test-observe"

# Get result
TRACE=$(curl -s "https://activity.metabob.com/v2/activities/execution-traces?activity_id=terminal-simple-test-observe&limit=1" \
  -H "Authorization: ApiKey $METABOB_API_KEY")

STATUS=$(echo "$TRACE" | jq -r '.status')

if [ "$STATUS" != "completed" ]; then
  echo "❌ Tests failed - push blocked"
  exit 1
fi

echo "✅ Tests passed - push allowed"
exit 0
```

## Use Cases

### 1. Detect When Tests Become Flaky

```bash
# Run tests frequently, observe patterns
watch -n 300 'minibob --single "execute activity: terminal-simple-test-observe"'

# After a few days, check reliability
curl -s "https://activity.metabob.com/v2/activities/thompson-sampling/score?activity_id=terminal-simple-test-observe" \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq .
```

### 2. Compare Test Performance Across Branches

```bash
# On branch A
git checkout feature-branch-a
minibob --single "execute activity: terminal-simple-test-observe"
TRACE_A=$(minibob get-last-trace-id)

# On branch B
git checkout feature-branch-b
minibob --single "execute activity: terminal-simple-test-observe"
TRACE_B=$(minibob get-last-trace-id)

# Compare durations
curl -s "https://activity.metabob.com/v2/activities/execution-traces?execution_id=$TRACE_A,$TRACE_B" \
  -H "Authorization: ApiKey $METABOB_API_KEY" | \
  jq '.traces[] | {execution_id, duration_ms}'
```

### 3. Automatic Issue Creation for Test Failures

```bash
# In CI/CD
TRACE=$(curl -s "https://activity.metabob.com/v2/activities/execution-traces?limit=1" \
  -H "Authorization: ApiKey $METABOB_API_KEY")

STATUS=$(echo "$TRACE" | jq -r '.traces[0].status')

if [ "$STATUS" = "failed" ]; then
  ERROR=$(echo "$TRACE" | jq -r '.traces[0].error')

  gh issue create \
    --title "Test failure in terminal vessel" \
    --body "Trace ID: $(echo "$TRACE" | jq -r '.traces[0].execution_id')\nError: $ERROR" \
    --label "automated-detection,tests,terminal-vessel"
fi
```

## Key Principles

1. **Every execution is captured** - Even if tests pass, record it
2. **No LLM needed** - Pure deterministic observation
3. **Learning happens automatically** - Thompson Sampling updates
4. **Patterns emerge over time** - Need ~20 traces for meaningful insights
5. **Act on patterns** - Block, warn, or create variants based on data

## Next Steps

1. Run `./scripts/observe-development.sh` to see the full loop
2. Push code and watch CI execute observations
3. Review Thompson Sampling scores after ~20 executions
4. Let the system suggest improvements

## Troubleshooting

**Q: Activity execution fails**
```bash
# Check MiniBob logs
minibob --debug --single "execute activity: terminal-simple-test-observe"
```

**Q: Traces not appearing**
```bash
# Verify API connection
curl https://activity.metabob.com/health

# Check authentication
curl "https://activity.metabob.com/v2/activities/execution-traces?limit=1" \
  -H "Authorization: ApiKey $METABOB_API_KEY"
```

**Q: Thompson Sampling shows NaN**
```bash
# Need at least 1 execution
# α and β start at 1,1 (uniform prior)
# First execution updates to either 2,1 or 1,2
```
