# Rapid Validation Workflow

Quick iteration and trace collection workflow for validating resolver implementations and Thompson Sampling learning.

## Overview

This workflow enables rapid iteration cycles:
1. **Execute** goals in batches (3-20 parallel)
2. **Collect** traces automatically
3. **Validate** trace completeness
4. **Submit** to activity.metabob.com
5. **Analyze** metrics and patterns

**Target**: 100+ traces in < 10 minutes

## Setup (One-Time)

### 1. Environment Variables

Create `.env` file in `repos/minibob/`:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
METABOB_API_KEY=your-metabob-api-key

# Optional
METABOB_ENDPOINT=https://activity.metabob.com
MINIBOB_PROVIDER=anthropic
MINIBOB_MODEL=claude-sonnet-4-20250514
```

### 2. Workspace Setup

```bash
cd repos/minibob
bun sandbox/setup.sh
```

This creates:
- `sandbox/workspace/` - Execution workspace
- `sandbox/logs/` - Log files
- `sandbox/reports/` - Generated reports

### 3. Verify Connection

```bash
bun sandbox/auto-validate.sh --check-backend
```

Should output:
```
✓ Backend connectivity: OK
✓ Authentication: OK
✓ API version: v2
```

## Test Iteration Loop

### Quick Start (< 5 minutes)

```bash
# Run simple scenario (5 goals, 3 parallel)
bun sandbox/rapid-test.ts --scenario simple

# Check results
cat sandbox/reports/latest-report.json | jq '.summary'
```

### Full Iteration Cycle

#### 1. Select Test Scenario

Available scenarios:

| Scenario | Goals | Focus | Duration |
|----------|-------|-------|----------|
| `simple` | 5 | Basic resolvers (file, git, bash) | ~1 min |
| `complex` | 5 | Analysis, multi-step operations | ~3 min |
| `bootstrap` | 4 | Activity creation and execution | ~2 min |
| `resolver` | 4 | Resolver composition patterns | ~1 min |
| `state_navigation` | 4 | State space navigation | ~2 min |

**Custom goals**:
```bash
bun sandbox/rapid-test.ts --goals "goal1,goal2,goal3"
```

#### 2. Run Batch

```bash
# Run with progress tracking
bun sandbox/rapid-test.ts --scenario complex --concurrency 5 --output sandbox/reports/run-001.json
```

**Output**:
```
============================================================
Progress: 3/5
Succeeded: 2 | Failed: 1
Rate: 0.8 goals/sec | ETA: 3s
============================================================
```

#### 3. Collect Traces

Traces are auto-submitted if `traceCollection.autoSubmit` is enabled in `sandbox.config.json`.

**Manual collection**:
```bash
bun sandbox/trace-pipeline.ts --batch sandbox/reports/run-001.json --output sandbox/reports/traces-001.json
```

#### 4. Review Metrics

```bash
# Generate metrics report
bun sandbox/validation-metrics.ts --traces sandbox/reports/traces-001.json --report sandbox/reports/metrics-001.txt

# View in terminal
cat sandbox/reports/metrics-001.txt
```

**Key metrics**:
- Resolver coverage (% of resolvers invoked)
- Success rates per resolver
- Composition patterns discovered
- Thompson Sampling score evolution

#### 5. Identify Issues

Look for:

**Failed resolvers**:
```json
{
  "resolvers": [
    {
      "name": "git",
      "successRate": 0.0,  // ← PROBLEM
      "invocations": 3
    }
  ]
}
```

**Missing traces**:
```json
{
  "validation": {
    "complete": false,
    "missingFields": ["beforeSnapshot", "afterSnapshot"]
  }
}
```

**Low Thompson Sampling scores**:
```json
{
  "thompsonSampling": [
    {
      "templateId": "act_123",
      "alpha": 1.0,
      "beta": 5.0,  // ← Many failures
      "successRate": 0.17
    }
  ]
}
```

#### 6. Fix & Iterate

**Common fixes**:

1. **Resolver implementation**: Edit `src/resolvers/*.ts`
2. **Activity template**: Edit `activities/*.json`
3. **Impulse pointer**: Edit impulse definitions
4. **Configuration**: Edit `sandbox.config.json`

**After fixing**:
```bash
# Rebuild (if needed)
bun run build

# Re-run same scenario
bun sandbox/rapid-test.ts --scenario complex --concurrency 5 --output sandbox/reports/run-002.json

# Compare results
diff sandbox/reports/run-001.json sandbox/reports/run-002.json
```

#### 7. Repeat

Continue iteration until:
- [ ] All resolvers invoked successfully
- [ ] Traces submitted to backend
- [ ] Thompson Sampling scores update
- [ ] Composition edges recorded
- [ ] State navigation works
- [ ] No regressions in existing features

## Validation Gates

Before marking iteration complete:

### Gate 1: Resolver Coverage

```bash
bun sandbox/validation-metrics.ts --traces report.json | grep "Coverage:"
```

**Required**: `Coverage: 100%` (all expected resolvers invoked)

### Gate 2: Trace Submission

```bash
curl https://activity.metabob.com/v2/activities/execution-traces \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq '.count'
```

**Required**: Count increases by number of goals executed

### Gate 3: Thompson Sampling

```bash
curl https://activity.metabob.com/v2/activities/templates/<template-id> \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq '.thompson_sampling'
```

**Required**: `alpha` and `beta` values update after execution

### Gate 4: Composition Learning

```bash
curl https://activity.metabob.com/v2/activities/composition/edges \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq '.'
```

**Required**: New edges appear in composition graph

### Gate 5: No Regressions

```bash
# Run full test suite
bun test

# Check existing functionality
bun sandbox/rapid-test.ts --scenario simple
```

**Required**: All tests pass, simple scenario succeeds

## Automated Validation

For CI/CD or full validation:

```bash
bun sandbox/auto-validate.sh
```

**Includes**:
1. Backend compatibility check
2. Rapid test suite (all scenarios)
3. Trace collection and validation
4. Metrics analysis
5. Validation gate checks
6. Report generation

**Exit codes**:
- `0` - All validations passed
- `1` - One or more validations failed

## Common Scenarios

### Scenario 1: Testing New Resolver

```bash
# 1. Add resolver implementation
vim src/resolvers/my-resolver.ts

# 2. Create test activity
vim activities/test-my-resolver.json

# 3. Run focused test
bun sandbox/rapid-test.ts --goals "test my new resolver"

# 4. Check resolver was invoked
bun sandbox/validation-metrics.ts --traces ... | grep "my-resolver"
```

### Scenario 2: Debugging Failed Activity

```bash
# 1. Identify failure
bun sandbox/rapid-test.ts --scenario complex
# → Output shows activity "analyze-codebase" failed

# 2. Run with detailed logging
LOG_LEVEL=debug bun sandbox/trace-pipeline.ts --goal "analyze the codebase"

# 3. Inspect trace
cat sandbox/logs/execution.log | grep "ERROR"

# 4. Fix and retry
vim activities/analyze-codebase.json
bun sandbox/trace-pipeline.ts --goal "analyze the codebase"
```

### Scenario 3: Validating Thompson Sampling

```bash
# 1. Run activity multiple times
for i in {1..10}; do
  bun sandbox/rapid-test.ts --goals "simple test goal"
done

# 2. Check Thompson scores evolved
bun sandbox/validation-metrics.ts --traces sandbox/reports/latest.json | grep -A 5 "THOMPSON SAMPLING"

# 3. Verify backend state
curl https://activity.metabob.com/v2/activities/templates/<id> \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq '.thompson_sampling'
```

### Scenario 4: Stress Testing

```bash
# Run 100 goals with high concurrency
bun sandbox/rapid-test.ts \
  --goals "$(seq 1 100 | xargs -I {} echo 'test goal {}')" \
  --concurrency 10 \
  --output sandbox/reports/stress-test.json

# Check for failures
jq '.summary.failed' sandbox/reports/stress-test.json
```

## Performance Targets

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| Trace collection | < 5 min for 100 goals | < 10 min | > 15 min |
| Resolver success rate | > 95% | > 85% | < 75% |
| Trace completeness | 100% | > 90% | < 80% |
| Backend submission | 100% | > 95% | < 90% |
| Thompson update latency | < 1 sec | < 5 sec | > 10 sec |

## Troubleshooting

### Backend Connection Issues

```bash
# Check connectivity
curl -I https://activity.metabob.com/health

# Verify API key
curl https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY"
```

### Trace Validation Failures

Check `sandbox/logs/execution.log` for:
- Missing snapshot capture
- Incomplete task metadata
- Failed impulse resolution

### Slow Execution

Common causes:
- Too many parallel goals (reduce `--concurrency`)
- Large impulse payloads (increase budgets)
- Network latency (check backend endpoint)

### Thompson Sampling Not Updating

Verify:
1. Traces are being submitted (`submission.success = true`)
2. Execution ID matches template ID
3. Backend is processing traces (check logs)
4. No schema validation errors

## Tips

1. **Start small**: Run `simple` scenario first
2. **Iterate quickly**: Fix one issue, re-run immediately
3. **Use concurrency**: 3-5 parallel goals is optimal
4. **Monitor logs**: `tail -f sandbox/logs/execution.log`
5. **Save reports**: Name by timestamp or iteration number
6. **Compare runs**: Use `diff` or `jq` to spot changes
7. **Check backend**: Verify traces appear in dashboard

## Next Steps

After validation passes:

1. **Document patterns**: Add successful compositions to docs
2. **Extract templates**: Run ribosome on successful traces
3. **Update metrics**: Record baseline performance
4. **Deploy to canary**: Push changes to `dev` branch
5. **Monitor production**: Watch Thompson Sampling evolution

## Related Files

- `sandbox/rapid-test.ts` - Batch executor
- `sandbox/trace-pipeline.ts` - Trace collection pipeline
- `sandbox/validation-metrics.ts` - Metrics analysis
- `sandbox/auto-validate.sh` - Automated validation
- `sandbox/sandbox.config.json` - Configuration
