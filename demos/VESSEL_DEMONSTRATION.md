# Vessel Self-Improvement Demonstration

## Overview

This demonstration shows **a real vessel (MiniBob) improving itself** through activity execution. Not a simulation - actual execution with observable results.

## What Gets Demonstrated

1. **Vessel self-analysis** - MiniBob examines its own activities
2. **Improvement identification** - Finds optimization opportunities
3. **Bootstrap activity execution** - Runs meta-activities on itself
4. **Cross-vessel execution** - Calls other vessels via discovery
5. **Observable results** - Traces, Thompson Sampling, dashboard

## Files Created

### `vessel-self-improvement.sh`
Interactive demonstration walking through:
- Current vessel state
- Bootstrap activity execution
- Cross-vessel routing
- Progressive determinism evolution
- Real improvement plan generation
- Observable results locations

**Run it**:
```bash
./demos/vessel-self-improvement.sh
```

### `example-vessel-improvement.json`
A **real, executable activity** that:
- Scans MiniBob's own activity directory
- Analyzes patterns and identifies optimizations
- Creates concrete improvement roadmap
- Saves tracking dashboard
- Suggests next bootstrap activities to run

**Execute it**:
```bash
cd repos/minibob
bun run index.ts --activity-file ../demos/example-vessel-improvement.json
```

## Step-by-Step: See a Vessel Improve Itself

### Step 1: Run the Self-Analysis Activity

```bash
cd repos/minibob

# Execute the vessel self-analysis activity as a goal
bun run index.ts --single "Execute the vessel self-analysis activity in ../demos/example-vessel-improvement.json: scan activities directory, analyze patterns, generate improvement roadmap, save to /tmp/minibob-self-improvement/, and create tracking dashboard"
```

**Alternative**: Register the template first, then execute by ID:
```bash
# Register template (one-time)
minibob doctor tutor ../demos/example-vessel-improvement.json

# Execute by template ID
minibob --template demo:vessel-self-analysis
```

**What happens**:
1. Activity scans MiniBob's `activities/` directory
2. Analyzes patterns (bash via LLM, sequential tasks, etc.)
3. Identifies optimization opportunities
4. Creates improvement roadmap
5. Saves to `/tmp/minibob-self-improvement/roadmap-*.md`

**Expected output**:
```
Executing activity: demo:vessel-self-analysis
Task 1/5: scan-own-activities
  ✓ Found 60 activity files
Task 2/5: analyze-activity-patterns
  ✓ Identified 3 optimization patterns
Task 3/5: generate-improvement-roadmap
  ✓ Created roadmap with priorities
Task 4/5: save-roadmap
  ✓ Saved to /tmp/minibob-self-improvement/roadmap-1745678901.md
Task 5/5: create-tracking-dashboard
  ✓ Created improvement tracker

Execution complete!
Execution ID: exec_self_analysis_001
Duration: 25s
Cost: $0.15
```

### Step 2: Review the Improvement Roadmap

```bash
cat /tmp/minibob-self-improvement/roadmap-*.md
```

**Example output**:
```markdown
# MiniBob Self-Improvement Roadmap

## Executive Summary
- Current state: 60 activities, 40% deterministic
- Potential improvements: 3 high-priority
- Expected impact: -60% cost, +200% speed

## Priority 1: Extract Bash Deterministic Resolver
**Current**: 12 activities use LLM to execute bash commands
**Action**: Run system:extract-deterministic-resolver
**Expected**: $50/month savings, 50x faster
**Command**:
```bash
bun run index.ts --activity system:extract-deterministic-resolver \
  --vars '{"impulseShape":"bash_command","minExecutions":10}'
```

## Priority 2: Parallelize Test Execution
**Current**: Test suites run serially (120s total)
**Action**: Run system:optimize-composition
**Expected**: 4x faster execution
**Command**:
```bash
bun run index.ts --activity system:optimize-composition \
  --vars '{"targetMetric":"duration","minExecutions":5}'
```

## Execution Plan
1. Run extract-deterministic-resolver (Week 1)
2. Run optimize-composition (Week 2)
3. Monitor Thompson Sampling for 2 weeks
4. Measure actual vs expected improvements
```

### Step 3: Execute the Suggested Bootstrap Activity

Follow the roadmap's first suggestion:

```bash
cd repos/minibob

# Extract deterministic resolver for bash commands
bun run index.ts --activity system:extract-deterministic-resolver \
  --vars '{
    "impulseShape": "bash_command",
    "minExecutions": 10,
    "minSuccessRate": 0.90
  }'
```

**What happens**:
1. Queries backend for tool usage patterns
2. Finds: 95% of `bash_command` resolutions use `bash("command")`
3. Generates `BashCommandResolver.ts` code
4. Creates extraction report with cost/speed projections
5. Returns: Resolver code + savings estimate

**Expected output**:
```
Executing: system:extract-deterministic-resolver

Task 1/4: fetch-tool-usage-patterns
  ✓ Found 100 executions of bash_command
  ✓ 95 used consistent pattern: bash("...")

Task 2/4: identify-deterministic-patterns
  ✓ Pattern identified: bash command direct execution
  ✓ Success rate: 98%
  ✓ Cost savings: $0.05 → $0.00 per call
  ✓ Speed improvement: 5000ms → 100ms

Task 3/4: generate-resolver-code
  ✓ Created BashCommandResolver.ts

Task 4/4: create-extraction-report
  ✓ Report generated

Expected monthly savings: $500
Expected speed improvement: 50x
```

### Step 4: Observe the Results

#### 4a. Check Execution Trace

```bash
# View the trace from the self-analysis activity
curl https://activity.metabob.com/v2/activities/execution-traces?limit=1 | jq

# Example output:
{
  "execution_id": "exec_self_analysis_001",
  "activity_id": "demo:vessel-self-analysis",
  "success": true,
  "duration_ms": 25000,
  "cost_usd": 0.15,
  "impulse_resolutions": [
    {
      "impulse_id": "activity_list",
      "resolver_id": "bash",
      "resolver_tier": "deterministic",
      "vessel_id": "minibob-local",
      "latency_ms": 50,
      "cost_usd": 0.00
    },
    {
      "impulse_id": "pattern_analysis",
      "resolver_id": "llm",
      "resolver_tier": "llm",
      "vessel_id": "minibob-local",
      "latency_ms": 12000,
      "cost_usd": 0.10
    }
  ],
  "resolved_by_vessels": ["minibob-local"],
  "templates_created": null,
  "metadata": {
    "demonstrates": "vessel_self_improvement"
  }
}
```

#### 4b. Monitor Thompson Sampling

```bash
# Watch alpha/beta evolution
watch -n 5 "curl -s https://activity.metabob.com/v2/activities/templates | \
  jq '.[] | select(.id | contains(\"demo:vessel\")) | {name, alpha, beta}'"

# Initial state:
{
  "name": "Vessel Self-Analysis",
  "alpha": 2,  # One successful execution
  "beta": 1    # No failures yet
}

# After 10 more executions (9 success, 1 failure):
{
  "name": "Vessel Self-Analysis",
  "alpha": 11,  # 10 successes + 1 prior
  "beta": 2     # 1 failure + 1 prior
}
# Success rate: 11/(11+2) = 84.6%
```

#### 4c. View in Dashboard

Access: `https://internal.metabob.com`

**What to see**:
- **Execution Timeline**: Shows `demo:vessel-self-analysis` running
- **Template Performance**: Thompson scores updating in real-time
- **Impulse Flow**: Which impulses were loaded/created
- **Cost Tracking**: See actual vs. expected savings

#### 4d. Check Improvement Metrics

```bash
# Before improvement
curl https://activity.metabob.com/v2/activities/templates | \
  jq '.[] | {
    name,
    avg_cost: .metrics.avg_cost_usd,
    avg_duration: .metrics.avg_duration_ms,
    deterministic_ratio: .metadata.learningProgression.deterministicRatio
  }'

# After running extract-deterministic-resolver
# Watch deterministic_ratio increase from 0.4 to 0.6+
# Watch avg_cost decrease from $0.05 to $0.01
# Watch avg_duration decrease from 5000ms to 500ms
```

### Step 5: Let It Run Autonomously

Enable boredom mode - MiniBob will continuously improve itself:

```bash
cd repos/minibob

# Start in idle/bored state
bun run index.ts --idle
```

**What happens**:
1. Boredom system activates after 1 minute of idle
2. Checks boredom queue or backend for tasks
3. Finds improvement activities (debug-activity, optimize-composition, etc.)
4. Executes them autonomously
5. Traces recorded, Thompson Sampling updated
6. Process repeats continuously

**Monitor it**:
```bash
# Watch logs
tail -f ~/.minibob/minibob.log | grep -E "(Boredom|Executing)"

# Watch improvement
watch -n 10 "curl -s https://activity.metabob.com/v2/activities/templates | \
  jq '[.[] | {deterministic: .metadata.learningProgression.deterministicRatio}] | add / length'"
```

## Cross-Vessel Demonstration

### Scenario: MiniBob Calls Analysis-API

Create an activity that requires code analysis:

```bash
cd repos/minibob

cat > /tmp/cross-vessel-demo.json <<'EOF'
{
  "id": "demo:cross-vessel-analysis",
  "name": "Cross-Vessel Code Analysis",
  "tasks": [
    {
      "id": "analyze-code",
      "description": "Analyze code quality via analysis-api",
      "inputImpulses": ["source_code"],
      "resolver": "impulse",
      "config": {
        "impulse_type": "problem_detection",
        "shape_required": "problem_detection"
      }
    }
  ]
}
EOF

# Execute - MiniBob will discover and call analysis-api
bun run index.ts --activity-file /tmp/cross-vessel-demo.json
```

**What happens**:
1. MiniBob tries to resolve `problem_detection` locally → NOT FOUND
2. Queries discovery: "Who resolves problem_detection?"
3. Discovery responds: `analysis-api @ http://analysis-api:8080`
4. MiniBob calls: `POST http://analysis-api:8080/resolve`
5. Analysis-API resolves using Metabob analyzer
6. MiniBob receives result and continues
7. Trace shows: `resolved_by_vessels: ["minibob-local", "analysis-api"]`

**View the trace**:
```bash
curl https://activity.metabob.com/v2/activities/execution-traces?limit=1 | \
  jq '.impulse_resolutions[] | select(.vessel_id != "minibob-local")'

# Output shows cross-vessel resolution:
{
  "impulse_id": "code_analysis",
  "resolver_id": "metabob_analyzer",
  "vessel_id": "analysis-api",     # Different vessel!
  "latency_ms": 8000,
  "cost_usd": 0.02
}
```

## Progressive Determinism Example

### Watch LLM Operations Become Fast Resolvers

```bash
# Week 1: All executions use LLM
curl https://activity.metabob.com/v2/activities/tool-usage?impulse_shape=source_code | jq '
  .patterns[] | select(.tool == "llm") | {
    executions: .count,
    cost_per_call: .avg_cost_usd,
    avg_duration: .avg_duration_ms
  }
'
# Output: {executions: 100, cost_per_call: 0.05, avg_duration: 5000}

# Run extract-deterministic-resolver
bun run index.ts --activity system:extract-deterministic-resolver \
  --vars '{"impulseShape":"source_code"}'

# Week 2: Deterministic resolver deployed
curl https://activity.metabob.com/v2/activities/tool-usage?impulse_shape=source_code | jq '
  .patterns[] | select(.tool == "bash") | {
    executions: .count,
    cost_per_call: .avg_cost_usd,
    avg_duration: .avg_duration_ms
  }
'
# Output: {executions: 95, cost_per_call: 0.00, avg_duration: 100}

# Thompson Sampling now prefers bash resolver 95% of time!
```

## Expected Outcomes

After running through this demonstration:

### Immediate (Minutes)

- ✓ Self-analysis activity executed successfully
- ✓ Improvement roadmap created with concrete steps
- ✓ Execution trace captured in backend
- ✓ Thompson Sampling initialized (α=2, β=1)

### Short-term (Hours)

- ✓ Bootstrap activities executed (extract-resolver, optimize-composition)
- ✓ Deterministic resolvers created
- ✓ Composition optimizations applied
- ✓ Multiple execution traces showing improvement

### Medium-term (Days)

- ✓ Thompson Sampling prefers optimized variants
- ✓ Average cost decreases (-40-60%)
- ✓ Average duration decreases (-50-80%)
- ✓ Success rate increases (+10-15%)
- ✓ Deterministic ratio increases (0.4 → 0.7+)

### Long-term (Weeks)

- ✓ Autonomous improvement via boredom system
- ✓ Continuous template extraction (ribosome)
- ✓ Variant creation and natural selection
- ✓ Cross-vessel collaboration patterns emerge
- ✓ System becomes significantly more efficient

## Key Metrics to Track

### Before Improvement
```bash
curl https://activity.metabob.com/v2/activities/templates | jq '
  .[] | {
    templates: length,
    avg_cost: ([.[] | .metrics.avg_cost_usd] | add / length),
    avg_duration: ([.[] | .metrics.avg_duration_ms] | add / length),
    avg_deterministic_ratio: ([.[] | .metadata.learningProgression.deterministicRatio] | add / length)
  }
'
```

**Baseline**:
- Templates: 60
- Avg cost: $0.05
- Avg duration: 5000ms
- Deterministic ratio: 0.4 (40%)

### After Improvement
**Target** (after 2 weeks):
- Templates: 75 (+25% from ribosome)
- Avg cost: $0.02 (-60%)
- Avg duration: 2000ms (-60%)
- Deterministic ratio: 0.7 (70%)

## Troubleshooting

### Activity Execution Fails

**Issue**: Activity needs backend but it's not accessible

**Solution**: Activities gracefully degrade. They'll create example outputs locally and show what WOULD happen with backend access.

### No Thompson Sampling Updates

**Issue**: Backend not receiving traces

**Solution**: Check MiniBob logs for API call failures. Verify `METABOB_ENDPOINT` is set correctly.

### Cross-Vessel Routing Fails

**Issue**: Discovery vessel not found

**Solution**: Set `DISCOVERY_ENABLED=false` for local-only mode. Activities will use direct MCP backend delegation instead.

## Summary

This demonstration shows **a real vessel improving itself**:

1. ✓ **Self-analysis**: Vessel examines its own activities
2. ✓ **Optimization**: Creates concrete improvement plan
3. ✓ **Execution**: Runs bootstrap activities on itself
4. ✓ **Learning**: Thompson Sampling tracks what works
5. ✓ **Evolution**: Better variants survive naturally
6. ✓ **Autonomy**: Continues improving without human intervention

**The key insight**: The vessel doesn't "know" it's improving itself. It just executes activities. The activities happen to operate on the vessel's own templates. This is **"activities all the way down"** in practice.

Run the demonstration:
```bash
./demos/vessel-self-improvement.sh
```

Then execute the real self-analysis activity:
```bash
cd repos/minibob
bun run index.ts --activity-file ../demos/example-vessel-improvement.json
```

Watch the vessel improve itself!
