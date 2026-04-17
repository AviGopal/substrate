# MiniBob Sandbox - Validation Environment

A controlled environment for rapidly collecting execution traces with the unified execution path. Tests all resolvers, validates state space navigation, and feeds Thompson Sampling with real execution data.

## Purpose

The sandbox provides:

1. **Controlled Environment** - Isolated workspace with predictable state
2. **Trace Collection** - Automated submission to production backend (activity.metabob.com)
3. **Resolver Validation** - Tests all resolvers in the unified execution path
4. **Learning Feedback** - Traces feed Thompson Sampling for activity selection
5. **Performance Metrics** - Duration, cost, and success rate tracking

## Quick Start

### 1. Setup Environment Variables

```bash
export METABOB_API_KEY="your-metabob-api-key"
export ANTHROPIC_API_KEY="your-anthropic-api-key"
```

These are required for backend communication and LLM execution.

### 2. Run Setup Script

```bash
cd repos/minibob/sandbox
./setup.sh
```

This will:
- Validate prerequisites (git, bun, API keys)
- Create workspace directory structure
- Initialize git repository
- Create sample files for testing
- Validate configuration
- Test backend connectivity

### 3. Execute Validation Tests

```bash
# Run all tests
bun run run-validation.ts

# Run only high-priority tests
bun run run-validation.ts high

# Run specific test priority
bun run run-validation.ts medium
```

### 4. Review Results

```bash
# View latest report
cat reports/validation-report.json

# View execution logs
tail -f logs/execution.log
```

## Configuration

### sandbox.config.json

Main configuration file with environment settings:

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
  "workingDirectory": "./sandbox/workspace",
  "traceCollection": {
    "enabled": true,
    "autoSubmit": true,
    "includeResolverMetrics": true,
    "includeStateSnapshots": true
  }
}
```

**Key Settings:**

- `traceCollection.autoSubmit` - Automatically submit traces to backend
- `traceCollection.includeResolverMetrics` - Capture resolver performance
- `traceCollection.includeStateSnapshots` - Capture before/after state
- `validation.collectFailureTraces` - Submit failed execution traces

## Validation Tests

### Test Structure

Each test in `validation-tests.json` defines:

```json
{
  "id": "test-001-simple-goal",
  "name": "Simple Goal - File Operation",
  "description": "Test GoalAnalysisResolver with simple goal",
  "type": "goal",
  "goal": "Create a file called hello.txt",
  "expectedOutcomes": ["File hello.txt is created"],
  "validation": {
    "requiredFiles": ["hello.txt"]
  },
  "expectedResolvers": ["GoalAnalysisResolver", "FileResolver"],
  "priority": "high"
}
```

### Test Types

1. **Goal Tests** (`type: "goal"`)
   - Test goal-seeking execution path
   - Trigger GoalAnalysisResolver
   - May involve activity recommendation and selection

2. **Activity Tests** (`type: "activity"`)
   - Direct activity template execution
   - Test ActivityExecutorResolver
   - Validate task composition

3. **Bootstrap Tests** (`type: "bootstrap"`)
   - Cold start scenarios (no prior impulses)
   - Test ImpulseStateAnalysisResolver
   - Validate impulse creation from scratch

### Priority Levels

- **High**: Core functionality, must pass
- **Medium**: Important but not blocking
- **Low**: Edge cases, experimental features

## Test Scenarios

### Included Tests

| ID | Test Name | Description | Resolvers Tested |
|----|-----------|-------------|------------------|
| test-001 | Simple Goal | Basic file operation | GoalAnalysisResolver, FileResolver |
| test-002 | Complex Goal | Multi-step activity | GoalAnalysisResolver, ActivityExecutorResolver |
| test-003 | Bootstrap | Cold start scenario | ImpulseStateAnalysisResolver |
| test-004 | Improvisation | Fallback to LLM | ImproviserResolver |
| test-005 | Composition | Activity chaining | ActivityExecutorResolver |
| test-006 | State Navigation | Dynamic impulse filtering | StateNavigator |
| test-007 | Conditional | Task branching | ActivityExecutorResolver |
| test-008 | Parallel | Concurrent execution | ActivityExecutorResolver, BashResolver |
| test-009 | Error Recovery | Graceful failure | FileResolver |
| test-010 | Ribosome | Template extraction | RibosomeResolver |
| test-011 | Thompson | Activity selection | GoalAnalysisResolver |
| test-012 | Metadata | Metadata-first reasoning | DirectoryTreeResolver |

### Adding Custom Tests

Create a new test in `validation-tests.json`:

```json
{
  "id": "test-custom",
  "name": "Your Test Name",
  "description": "What this test validates",
  "type": "goal",
  "goal": "Your goal description",
  "expectedOutcomes": ["Outcome 1", "Outcome 2"],
  "validation": {
    "requiredFiles": ["file1.ts"],
    "requireOutput": true
  },
  "expectedResolvers": ["ResolverName"],
  "expectedDuration": "< 30s",
  "priority": "medium"
}
```

## Validation Report

### Report Structure

After running tests, a JSON report is generated:

```json
{
  "timestamp": 1713456789000,
  "totalTests": 12,
  "passed": 10,
  "failed": 2,
  "totalDuration": 45000,
  "totalCost": 0.15,
  "results": [...],
  "summary": {
    "byPriority": {...},
    "byResolver": {...},
    "traceCollection": {
      "collected": 12,
      "submitted": 12,
      "failed": 0
    }
  }
}
```

### Metrics Tracked

**Per Test:**
- Success/failure status
- Duration (ms)
- Cost (USD)
- Token usage (input/output)
- Resolvers used
- Execution and trace IDs

**Summary:**
- Success rate by priority
- Success rate by resolver
- Total duration and cost
- Trace collection stats

## Trace Collection

### What Gets Collected

Each execution trace includes:

1. **Tasks Executed** - Full task details with prompts and responses
2. **Tool Calls** - All tool invocations with arguments and results
3. **Impulses** - Created impulses with shapes and pointers
4. **State Transitions** - Before/after file system state
5. **Resolver Metrics** - Which resolvers were used and how
6. **Cost and Duration** - Per-task and total metrics

### Trace Submission

Traces are submitted to `https://activity.metabob.com` automatically if:
- `traceCollection.enabled = true`
- `traceCollection.autoSubmit = true`
- Execution completed (success or failure, if `collectFailureTraces = true`)

### Backend Integration

Submitted traces:
- Feed Thompson Sampling for activity selection
- Enable ribosome extraction of successful improvisations
- Build impulse relevance scores
- Track tool usage patterns
- Support composition learning

## Workspace Structure

```
sandbox/
├── sandbox.config.json       # Configuration
├── validation-tests.json     # Test definitions
├── setup.sh                  # Environment setup
├── run-validation.ts         # Test runner
├── README.md                 # This file
├── workspace/                # Test workspace
│   ├── src/                  # Sample source code
│   ├── tests/                # Sample tests
│   └── README.md             # Workspace info
├── logs/                     # Execution logs
│   └── execution.log         # Detailed execution log
└── reports/                  # Test reports
    ├── validation-report.json              # Latest report
    └── validation-report-2026-04-16T*.json # Timestamped reports
```

## Troubleshooting

### Backend Connection Failed

**Symptom:** Setup script reports backend health check failure

**Solutions:**
1. Verify METABOB_API_KEY is set and valid
2. Check network connectivity to activity.metabob.com
3. Confirm API key has correct permissions

### Test Execution Fails

**Symptom:** Tests fail with "Invalid API key" or similar

**Solutions:**
1. Verify both METABOB_API_KEY and ANTHROPIC_API_KEY are set
2. Check config placeholders are being replaced (no `${...}` in logs)
3. Ensure API keys have correct format

### No Traces Collected

**Symptom:** traceCollection.collected = 0 in report

**Solutions:**
1. Check `traceCollection.enabled = true` in config
2. Verify executions are completing (not erroring early)
3. Check logs/execution.log for trace submission errors

### Validation Outcomes Not Met

**Symptom:** Tests fail with "Missing outcomes"

**Solutions:**
1. Check workspace/ directory was set up correctly
2. Verify sample files exist (run setup.sh again)
3. Review test expectations - may need actual MiniBob integration

## Integration with MiniBob

### Current State

The validation runner is currently a **mock implementation**. It:
- Loads tests correctly
- Validates configuration
- Generates reports
- But uses mock execution instead of real MiniBob

### TODO: Real Integration

To integrate with actual MiniBob:

1. **Replace mockExecuteGoal()** with real goal processor:
   ```typescript
   import { processGoal } from "../src/goal-processor";

   async function executeGoal(test: ValidationTest, config: SandboxConfig) {
     return await processGoal(test.goal, {
       workingDirectory: config.workingDirectory,
       // ... other options
     });
   }
   ```

2. **Add resolver detection** in extractResolversUsed():
   ```typescript
   function extractResolversUsed(execution: ActivityExecution): string[] {
     // Extract from execution.executionTrace.tasks[].metadata.resolver
     return execution.executionTrace?.tasks
       .map(t => t.metadata?.resolver)
       .filter(Boolean) || [];
   }
   ```

3. **Implement outcome validation** in validateOutcomes():
   ```typescript
   async function validateOutcomes(test, execution) {
     // Check requiredFiles exist
     // Check requiredPatterns match
     // Check custom validation logic
   }
   ```

## Best Practices

### When to Run

- **Before committing** - Validate changes don't break resolvers
- **After adding resolver** - Test new resolver integration
- **Daily** - Collect traces for Thompson Sampling
- **Before production** - Full validation of all priorities

### What to Monitor

- **Success Rate** - Should be > 80% for high-priority tests
- **Duration** - Tests should complete within expected time
- **Cost** - Monitor total cost, optimize expensive tests
- **Trace Submission** - Should be 100% successful
- **Resolver Coverage** - All resolvers should be tested

### Extending Tests

When adding new resolvers:
1. Create high-priority test exercising the resolver
2. Add medium-priority test for edge cases
3. Add low-priority test for error handling
4. Run full suite to ensure no regressions

## Example Session

```bash
# Setup (first time only)
cd repos/minibob/sandbox
export METABOB_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
./setup.sh

# Run high-priority tests
bun run run-validation.ts high

# Output:
# MiniBob Sandbox Validation Runner
# ==================================
#
# Environment: validation
# Backend:     https://activity.metabob.com
# Model:       claude-sonnet-4-20250514
#
# Loaded 12 validation tests
# Filtered to 5 tests (priority: high)
#
# ▶ Running: Simple Goal - File Operation
#   Test GoalAnalysisResolver with a simple file operation goal
#   ✓ PASSED (15.2s)
#
# [... more tests ...]
#
# ========================================
# Validation Summary
# ========================================
# Total Tests:    5
# Passed:         5 ✓
# Failed:         0 ✗
# Duration:       78.5s
# Total Cost:     $0.0245
#
# Trace Collection:
#   Collected:    5
#   Submitted:    5
# ========================================

# Review report
cat reports/validation-report.json | jq '.summary'
```

## Backend Integration Tests

In addition to the validation environment above, this directory contains dedicated backend integration tests and monitoring tools.

### Backend Integration Test Suite

**`backend-integration.test.ts`** - Comprehensive integration tests for backend API

Tests all backend integration points:
- Thompson Sampling queries and recommendations
- Trace submission with resolver metrics
- Template storage and registration
- Composition edge recording
- Impulse relevance tracking
- State space navigation
- Tool usage patterns
- Error handling

```bash
bun test backend-integration.test.ts
```

### Backend Compatibility Checker

**`check-backend-compatibility.ts`** - Validates backend API compatibility

Checks:
- Backend health and connectivity
- Authentication with API key
- All required endpoints exist
- Response format compatibility
- Rate limiting headers

```bash
bun run check-backend-compatibility.ts
```

### Trace Format Validator

**`validate-trace-format.ts`** - Validates execution trace structure

Ensures traces include:
- Resolver invocations with metadata
- State snapshots (before/after)
- Composition metadata
- Thompson Sampling context
- Budget tracking
- Git state

```bash
bun run validate-trace-format.ts trace.json
```

### Monitoring Dashboard

**`trace-dashboard.html`** - Real-time trace monitoring

Interactive dashboard showing:
- Execution statistics and success rates
- Resolver usage distribution
- Thompson Sampling scores by template
- State space navigation data
- Composition graphs

```bash
open trace-dashboard.html
```

### Integration Validation Report

**`INTEGRATION_VALIDATION_REPORT.md`** - Complete documentation

Detailed documentation of:
- Test suite architecture
- Expected trace format
- Common issues and solutions
- CI/CD integration
- Metrics and monitoring

## Rapid Validation Workflow (NEW)

For quick iteration and trace collection, see the new rapid validation workflow:

### Quick Commands

```bash
# Run rapid test suite (100+ traces in < 10 min)
bun sandbox/rapid-test.ts --scenario simple
bun sandbox/rapid-test.ts --scenario complex --concurrency 5

# Run trace collection pipeline
bun sandbox/trace-pipeline.ts --goal "test goal"
bun sandbox/trace-pipeline.ts --batch goals.json

# Analyze validation metrics
bun sandbox/validation-metrics.ts --traces report.json

# Automated validation (CI/CD)
./sandbox/auto-validate.sh
```

### Files

| File | Purpose |
|------|---------|
| `rapid-test.ts` | Batch goal executor (3-20 parallel) |
| `trace-pipeline.ts` | 6-stage trace collection pipeline |
| `validation-metrics.ts` | Metrics analysis and reporting |
| `auto-validate.sh` | Automated validation script |
| `VALIDATION_WORKFLOW.md` | Complete workflow documentation |
| `example-goals.json` | Sample goals for batch testing |

### Documentation

See [VALIDATION_WORKFLOW.md](VALIDATION_WORKFLOW.md) for:
- Complete iteration workflow
- Test scenarios (simple, complex, bootstrap, resolver, state_navigation)
- Validation gates
- Performance targets
- Troubleshooting guide

## Related Documentation

- [VALIDATION_WORKFLOW.md](VALIDATION_WORKFLOW.md) - Rapid validation workflow
- [INTEGRATION_VALIDATION_REPORT.md](INTEGRATION_VALIDATION_REPORT.md) - Backend integration tests
- [UNIFIED_EXECUTION_PATH.md](../docs/UNIFIED_EXECUTION_PATH.md) - Execution architecture
- [STATE_SPACE_NAVIGATION.md](../docs/STATE_SPACE_NAVIGATION.md) - State management
- [RESOLVER_SPECIFICATION.md](../docs/RESOLVER_SPECIFICATION.md) - Resolver design
- [Root CLAUDE.md](../../CLAUDE.md) - Project overview
