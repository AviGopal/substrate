# Quick Start - Test Goal Execution

Fast reference for running MiniBob test goals and validating resolvers.

## NEW: Rapid Validation Workflow (< 10 minutes)

**For quick iteration and trace collection:**

```bash
# 1. Quick test (1 min)
bun sandbox/rapid-test.ts --scenario simple

# 2. Full validation (5 min)
./sandbox/auto-validate.sh

# 3. View results
cat sandbox/reports/report-*.txt
```

**See [VALIDATION_WORKFLOW.md](VALIDATION_WORKFLOW.md) for complete guide.**

---

## Original Test Suite (Legacy)

## Setup (One-Time)

```bash
cd repos/minibob/sandbox

# Set API keys
export METABOB_API_KEY="your-metabob-api-key"
export ANTHROPIC_API_KEY="your-anthropic-api-key"

# Run setup script
./setup.sh
```

## Execute Tests

### Run All Tests

```bash
# Existing tests (12 tests, ~10 min)
bun run run-validation.ts

# New comprehensive tests (26 tests, ~30 min)
bun run execute-test-goals.ts --all

# Both suites (36 tests, ~45 min)
bun run run-validation.ts && bun run execute-test-goals.ts --all
```

### Run by Priority

```bash
# High priority only (~15 tests, ~15 min)
bun run run-validation.ts high
bun run execute-test-goals.ts --category simple
bun run execute-test-goals.ts --category complex
```

### Run by Category

```bash
# Simple goals (4 tests, ~2 min)
bun run execute-test-goals.ts --category simple

# Complex goals (4 tests, ~10 min)
bun run execute-test-goals.ts --category complex

# Bootstrap scenarios (3 tests, ~5 min)
bun run execute-test-goals.ts --category bootstrap

# Composition workflows (3 tests, ~8 min)
bun run execute-test-goals.ts --category composition

# Edge cases (4 tests, ~6 min)
bun run execute-test-goals.ts --category edge

# Learning scenarios (2 tests, ~6 min)
bun run execute-test-goals.ts --category learning
```

### Run Single Test

```bash
# Existing test
bun run run-validation.ts test-001-simple-goal

# New test
bun run execute-test-goals.ts simple-list-files
```

## Analyze Results

### View Coverage Report

```bash
# Summary only
bun run analyze-traces.ts --summary

# All details
bun run analyze-traces.ts --all

# Specific test
bun run analyze-traces.ts simple-list-files
```

### Check Reports

```bash
# Existing test results
cat reports/validation-report.json | jq '.summary'

# New test results
cat test-results.json | jq '.'

# View execution logs
tail -f logs/execution.log
```

## Common Workflows

### Quick Smoke Test (Simple Goals Only)

```bash
bun run execute-test-goals.ts --category simple
bun run analyze-traces.ts --summary
```

**Expected:**
- 4 tests executed
- All pass
- Duration: ~2 min
- Cost: < $0.05

### Full Validation (All Tests)

```bash
# Execute
bun run run-validation.ts
bun run execute-test-goals.ts --all

# Analyze
bun run analyze-traces.ts --all
```

**Expected:**
- 36 tests executed
- Pass rate: > 90%
- Duration: ~45 min
- Cost: $1.50-$3.00

### Resolver-Specific Testing

Test specific resolver:

```bash
# Test GoalAnalysisResolver
bun run execute-test-goals.ts simple-list-files
bun run execute-test-goals.ts complex-add-feature

# Test ImproviserResolver
bun run execute-test-goals.ts simple-show-file
bun run execute-test-goals.ts edge-no-templates

# Test BootstrapResolver
bun run execute-test-goals.ts --category bootstrap

# Test CompositionDetector
bun run execute-test-goals.ts --category composition
```

### Learning Loop Testing

Test Thompson Sampling and Ribosome:

```bash
# Execute learning scenarios
bun run execute-test-goals.ts --category learning
bun run run-validation.ts test-010-ribosome-extraction
bun run run-validation.ts test-011-thompson-sampling

# Verify learning data
bun run analyze-traces.ts --all | grep -A5 "Learning"
```

### Performance Benchmarking

```bash
# Run performance tests
bun run execute-test-goals.ts performance-large-codebase
bun run execute-test-goals.ts performance-parallel-composition

# Check metrics
bun run analyze-traces.ts --summary | grep -A5 "Performance"
```

## Dry Run (Preview)

See what tests would run without executing:

```bash
# Preview all tests
bun run execute-test-goals.ts --all --dry-run

# Preview category
bun run execute-test-goals.ts --category edge --dry-run
```

## Verbose Output

Enable detailed logging:

```bash
# Show execution details
VERBOSE=true bun run execute-test-goals.ts simple-list-files

# Show trace submission
VERBOSE=true bun run run-validation.ts high
```

## Troubleshooting

### Backend Connection Failed

```bash
# Verify API key
echo $METABOB_API_KEY

# Test connectivity
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/health
```

### Tests Failing

```bash
# Check MiniBob works
cd repos/minibob
bun run index.ts --version

# Check dependencies
bun install

# Review error logs
tail -100 logs/execution.log
```

### No Traces Found

```bash
# Verify trace collection enabled
cat sandbox.config.json | jq '.traceCollection'

# Check backend
curl https://activity.metabob.com/v2/activities/execution-traces?limit=10 \
  -H "Authorization: ApiKey $METABOB_API_KEY"
```

### Performance Issues

```bash
# Run subset only
bun run execute-test-goals.ts --category simple

# Skip slow tests
# (edit test-goals.json to remove performance tests)

# Reduce token limits
# (edit validation criteria in tests)
```

## Expected Results

### Coverage Targets

- **Total tests:** 36 (12 existing + 26 new)
- **Pass rate:** > 90% (32+ tests)
- **Resolver coverage:** All resolvers invoked
- **Trace collection:** 100% (all executions)
- **Duration:** 30-45 minutes (full suite)
- **Cost:** $1.50-$3.00 (full suite)

### Resolver Invocation Counts

- GoalAnalysisResolver: 23
- ActivityExecutorResolver: 12
- ImproviserResolver: 8
- TemplateSearchResolver: 12
- BashResolver: 9
- FileResolver: 6
- CompositionDetector: 6
- DirectoryTreeResolver: 5
- ImpulseStateAnalysisResolver: 3
- BootstrapResolver: 3
- StateNavigator: 2
- ThompsonSampler: 2
- RibosomeExtractor: 2

### Impulse Types Created

- activityTemplate: 12
- activityExecutionTrace: 15
- activityMetrics: 8
- directoryTree: 6
- gitDiff: 3
- file: 10
- memo: 5

## Files and Directories

```
sandbox/
├── test-goals.json                    # New comprehensive tests (26)
├── validation-tests.json              # Existing tests (12)
├── execute-test-goals.ts              # New test runner
├── run-validation.ts                  # Existing test runner
├── analyze-traces.ts                  # Trace analysis tool
├── VALIDATION_CRITERIA.md             # Validation rules
├── COMPREHENSIVE_TEST_GOALS.md        # Full documentation
├── QUICK_START.md                     # This file
├── setup.sh                           # Environment setup
├── workspace/                         # Test workspace
├── reports/                           # Test reports
└── logs/                              # Execution logs
```

## Environment Variables

```bash
# Required
export METABOB_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"

# Optional
export METABOB_ENDPOINT="https://activity.metabob.com"  # Backend URL
export VERBOSE=true                    # Detailed output
export MINIBOB_TRACE_ENABLED=true      # Enable tracing
```

## Test Goal IDs

### Existing Tests
- test-001-simple-goal
- test-002-complex-goal
- test-003-bootstrap-scenario
- test-004-improvisation-fallback
- test-005-activity-composition
- test-006-state-space-navigation
- test-007-conditional-execution
- test-008-parallel-execution
- test-009-error-recovery
- test-010-ribosome-extraction
- test-011-thompson-sampling
- test-012-impulse-metadata-reasoning

### New Tests
- simple-list-files
- simple-find-pattern
- simple-show-file
- simple-count-files
- complex-add-feature
- complex-fix-bug
- complex-refactor
- complex-add-tests
- bootstrap-no-context
- bootstrap-missing-traces
- bootstrap-error-analysis
- composition-debug-fix-test
- composition-implement-test
- composition-refactor-test-deploy
- state-navigation-target
- state-navigation-fix
- edge-no-templates
- edge-activity-fails
- edge-cycle-detection
- edge-depth-limit
- integration-full-pipeline
- integration-bootstrap-compose
- integration-state-to-activity
- performance-large-codebase
- performance-parallel-composition
- learning-thompson-update
- learning-ribosome-extract

## Next Steps

1. **Run setup:** `./setup.sh`
2. **Quick test:** `bun run execute-test-goals.ts --category simple`
3. **Analyze:** `bun run analyze-traces.ts --summary`
4. **Full suite:** `bun run execute-test-goals.ts --all`
5. **Review:** Check `reports/` and `test-results.json`

## Related Documentation

- `VALIDATION_CRITERIA.md` - Detailed validation rules
- `COMPREHENSIVE_TEST_GOALS.md` - Complete test documentation
- `README.md` - Sandbox overview
- `../CLAUDE.md` - MiniBob development guidelines
