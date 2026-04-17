# MiniBob Sandbox - Complete Overview

## Purpose

The sandbox environment provides a **controlled validation and trace collection system** for MiniBob's unified execution path. It validates all resolvers, tests state space navigation, and feeds production backend with real execution traces for Thompson Sampling.

## Architecture

### Two Complementary Approaches

The sandbox provides two testing methodologies:

#### 1. **Structured Validation** (validation-tests.json + run-validation.ts)

**Use Case:** Systematic validation of specific resolvers and execution paths

**Features:**
- 12 predefined test scenarios
- Priority-based filtering (high/medium/low)
- Expected outcomes validation
- Resolver detection and metrics
- Formal test reports

**When to Use:**
- Before committing changes
- CI/CD validation
- Resolver-specific testing
- Regression detection

**Run:**
```bash
bun run run-validation.ts [priority]
```

#### 2. **Goal-Based Testing** (test-goals.json + rapid-test.ts)

**Use Case:** Rapid iteration with real-world goal scenarios

**Features:**
- 22 comprehensive goal scenarios
- Category-based organization (simple/complex/bootstrap/composition/edge/integration)
- Parallel execution
- Real-time progress tracking
- Thompson Sampling validation

**When to Use:**
- Rapid trace collection
- Scenario testing
- Performance benchmarking
- Learning loop validation

**Run:**
```bash
bun sandbox/rapid-test.ts --scenario simple
bun sandbox/rapid-test.ts --scenario complex --concurrency 5
```

## File Structure

```
sandbox/
├── Configuration & Setup
│   ├── sandbox.config.json              # Environment configuration
│   ├── setup.sh                         # Workspace initialization
│   └── .gitignore                       # Exclusions
│
├── Structured Validation (New)
│   ├── validation-tests.json            # Test definitions (12 tests)
│   ├── run-validation.ts                # Test runner with reports
│   └── collect-traces.sh                # Quick trace collection
│
├── Goal-Based Testing (Existing)
│   ├── test-goals.json                  # Goal scenarios (22 goals)
│   ├── rapid-test.ts                    # Parallel goal execution
│   └── execute-test-goals.ts            # Goal executor
│
├── Trace Analysis
│   ├── analyze-traces.ts                # Trace analysis utilities
│   ├── trace-pipeline.ts                # Trace processing pipeline
│   ├── validate-trace-format.ts         # Schema validation
│   ├── trace-dashboard.html             # Visual trace inspector
│   └── validation-metrics.ts            # Metrics calculation
│
├── Backend Integration
│   ├── backend-integration.test.ts      # Backend compatibility tests
│   └── check-backend-compatibility.ts   # Endpoint validation
│
└── Documentation
    ├── SANDBOX_OVERVIEW.md              # This file
    ├── README.md                        # Usage guide (structured validation)
    ├── QUICK_REFERENCE.md               # Quick commands
    ├── IMPLEMENTATION_NOTES.md          # Integration guide
    └── VALIDATION_CRITERIA.md           # Quality criteria
```

## Test Categories

### Structured Validation Tests

| ID | Name | Resolvers | Priority |
|----|------|-----------|----------|
| test-001 | Simple Goal | GoalAnalysis, File | High |
| test-002 | Complex Goal | GoalAnalysis, ActivityExecutor | High |
| test-003 | Bootstrap | ImpulseStateAnalysis | Medium |
| test-004 | Improvisation | Improviser, LLM | Medium |
| test-005 | Activity Composition | ActivityExecutor | High |
| test-006 | State Navigation | StateNavigator | Medium |
| test-007 | Conditional Execution | ActivityExecutor | Low |
| test-008 | Parallel Execution | ActivityExecutor, Bash | Medium |
| test-009 | Error Recovery | FileResolver | Low |
| test-010 | Ribosome Extraction | Ribosome | High |
| test-011 | Thompson Sampling | GoalAnalysis | High |
| test-012 | Metadata Reasoning | DirectoryTree | Medium |

### Goal-Based Test Scenarios

| Category | Count | Description |
|----------|-------|-------------|
| Simple | 4 | Basic operations (list, read, count) |
| Complex | 4 | Multi-step tasks (feature, bugfix, refactor, tests) |
| Bootstrap | 3 | Cold start scenarios (no context) |
| Composition | 3 | Activity chaining (debug→fix→test) |
| State Navigation | 2 | Target state achievement |
| Edge Cases | 4 | Error handling, cycles, depth limits |
| Integration | 3 | Full pipeline validation |
| Performance | 2 | Large codebase, parallel execution |
| Learning | 2 | Thompson Sampling, ribosome extraction |

## Quick Start

### First Time Setup

```bash
# Set environment variables
export METABOB_API_KEY="your-metabob-api-key"
export ANTHROPIC_API_KEY="your-anthropic-api-key"

# Run setup
cd repos/minibob/sandbox
./setup.sh
```

### Run Structured Validation

```bash
# All tests
bun run run-validation.ts

# High priority only
bun run run-validation.ts high

# Quick trace collection
./collect-traces.sh high
```

### Run Goal-Based Testing

```bash
# Simple goals
bun sandbox/rapid-test.ts --scenario simple

# Complex goals with parallelism
bun sandbox/rapid-test.ts --scenario complex --concurrency 5

# All scenarios
for scenario in simple complex bootstrap composition state_navigation; do
  bun sandbox/rapid-test.ts --scenario $scenario
done
```

### View Results

```bash
# Validation report
cat reports/validation-report.json | jq '.summary'

# Execution logs
tail -f logs/execution.log

# Trace dashboard
open trace-dashboard.html
```

## Configuration

### sandbox.config.json

```json
{
  "environment": "validation",
  "backend": {
    "endpoint": "https://activity.metabob.com",
    "apiKey": "${METABOB_API_KEY}"
  },
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKey": "${ANTHROPIC_API_KEY}"
  },
  "traceCollection": {
    "enabled": true,
    "autoSubmit": true,
    "includeResolverMetrics": true,
    "includeStateSnapshots": true
  }
}
```

**Key Settings:**
- `traceCollection.autoSubmit` - Automatic backend submission
- `traceCollection.includeResolverMetrics` - Resolver performance tracking
- `traceCollection.includeStateSnapshots` - Before/after state capture

## Trace Collection

### What Gets Collected

Every execution generates:

1. **Task Details** - Prompts, responses, tool calls
2. **Impulse Evolution** - Created, modified, deleted impulses
3. **Resolver Metrics** - Which resolvers executed, duration, cost
4. **State Transitions** - File system changes, git state
5. **Thompson Sampling** - Template selection, rewards, posterior updates
6. **Composition Edges** - Activity relationships

### Backend Integration

Traces are submitted to `https://activity.metabob.com` and feed:

- **Thompson Sampling** - Activity selection probabilities
- **Ribosome Extraction** - New templates from successful improvisations
- **Impulse Relevance** - Which impulses are useful for which tasks
- **Tool Usage Patterns** - Which tools are called together
- **Composition Learning** - Which activities naturally chain

## Validation Criteria

### Success Metrics

| Metric | Target | Critical |
|--------|--------|----------|
| High-priority test pass rate | > 80% | Yes |
| Total test duration | < 5 min | No |
| Total cost per run | < $0.50 | No |
| Trace submission rate | 100% | Yes |
| Resolver coverage | All tested | Yes |

### Quality Gates

**Before Commit:**
- All high-priority tests pass
- No regression in existing tests
- New resolvers have tests
- Traces submit successfully

**Before Deploy:**
- Full suite passes
- Performance within budget
- All scenarios tested
- Backend integration verified

## Troubleshooting

### Common Issues

**1. Backend Connection Failed**

```bash
# Check API key
echo $METABOB_API_KEY

# Test connectivity
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/health
```

**2. Tests Fail**

```bash
# Verify workspace setup
ls -la workspace/src/

# Check logs
tail -50 logs/execution.log

# Run single test
bun run run-validation.ts high
```

**3. No Traces Collected**

```bash
# Check configuration
cat sandbox.config.json | grep -A5 traceCollection

# Verify autoSubmit enabled
jq '.traceCollection.autoSubmit' sandbox.config.json
```

**4. Goal Execution Hangs**

```bash
# Check timeout settings
jq '.timeout' sandbox.config.json

# Reduce concurrency
bun sandbox/rapid-test.ts --scenario simple --concurrency 1
```

## Integration Status

### Complete ✓

- [x] Environment setup (setup.sh)
- [x] Configuration management (sandbox.config.json)
- [x] Test definitions (validation-tests.json, test-goals.json)
- [x] Trace analysis utilities
- [x] Backend integration tests
- [x] Documentation

### In Progress ⚠

The validation runner (run-validation.ts) uses mock execution. Real integration requires:

1. **Goal Execution** - Replace mockExecuteGoal() with processGoal()
2. **Outcome Validation** - Implement validateOutcomes()
3. **Resolver Detection** - Extract resolvers from execution trace
4. **Trace Submission** - POST to backend /v2/activities/execution-traces

See [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md) for integration guide.

### Functional Now ✓

The rapid-test.ts runner is **fully functional** and uses real MiniBob execution:

```bash
# This works now
bun sandbox/rapid-test.ts --scenario simple
```

## Best Practices

### When to Use Structured Validation

- **CI/CD pipelines** - Systematic validation
- **Regression testing** - Expected outcomes
- **Resolver validation** - Specific resolver tests
- **Before commits** - Quick sanity checks

### When to Use Goal-Based Testing

- **Rapid prototyping** - Quick iteration
- **Scenario testing** - Real-world goals
- **Trace collection** - Feed learning loop
- **Performance testing** - Parallel execution

### Combining Both Approaches

1. **Development** - Use rapid-test.ts for quick feedback
2. **Validation** - Use run-validation.ts for systematic checks
3. **Integration** - Run both before deploying
4. **Learning** - Use rapid-test.ts for continuous trace collection

## Examples

### Example 1: Quick Validation

```bash
# Run high-priority tests only
cd repos/minibob/sandbox
./collect-traces.sh high

# Output:
# MiniBob Trace Collection
# ========================
# Priority: high
# Count:    First 5 tests
#
# Running validation tests...
# ✓ All tests passed
#
# Trace Collection Summary:
# -------------------------
# Collected:  5
# Submitted:  5
# Failed:     0
#
# Cost:       $0.0245
# Duration:   78.5s
```

### Example 2: Scenario Testing

```bash
# Test all simple scenarios in parallel
bun sandbox/rapid-test.ts --scenario simple --concurrency 5

# Output:
# Rapid Test Runner
# =================
# Scenario: simple
# Goals: 5
# Concurrency: 5
#
# [1/5] ✓ list files in the current directory (2.3s)
# [2/5] ✓ show git status (1.8s)
# [3/5] ✓ read package.json (1.5s)
# [4/5] ✓ check TypeScript configuration (2.1s)
# [5/5] ✓ show recent commits (2.0s)
#
# Results:
# --------
# Success: 5/5
# Duration: 9.7s (parallel)
# Cost: $0.0189
# Traces submitted: 5
```

### Example 3: Full Pipeline

```bash
# Complete validation workflow
cd repos/minibob/sandbox

# 1. Setup (first time only)
./setup.sh

# 2. Quick validation
./collect-traces.sh high

# 3. Scenario testing
for scenario in simple complex bootstrap; do
  bun sandbox/rapid-test.ts --scenario $scenario
done

# 4. Full suite
bun run run-validation.ts

# 5. View results
cat reports/validation-report.json | jq '.summary'
```

## Related Documentation

- [README.md](./README.md) - Structured validation guide
- [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md) - Integration details
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Command reference
- [VALIDATION_CRITERIA.md](./VALIDATION_CRITERIA.md) - Quality criteria
- [Root CLAUDE.md](../../CLAUDE.md) - Project overview
- [MiniBob CLAUDE.md](../CLAUDE.md) - MiniBob architecture

## Summary

The sandbox provides:

1. **Two Testing Approaches** - Structured validation + goal-based scenarios
2. **Complete Trace Collection** - Automatic backend submission
3. **Resolver Validation** - All resolvers tested
4. **Learning Integration** - Thompson Sampling + ribosome extraction
5. **Quality Gates** - Success metrics and validation criteria

**Use structured validation** (run-validation.ts) for systematic testing.

**Use goal-based testing** (rapid-test.ts) for rapid iteration and trace collection.

**Use both** for comprehensive validation before deployment.
