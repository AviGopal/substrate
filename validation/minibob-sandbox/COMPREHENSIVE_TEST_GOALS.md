# Comprehensive Test Goals - Resolver Validation

This document consolidates all test goal scenarios for exercising MiniBob's resolvers and collecting meaningful execution traces.

## Overview

We have two complementary test suites:

1. **Existing Validation Tests** (`validation-tests.json`) - 12 tests covering core functionality
2. **New Comprehensive Tests** (`test-goals.json`) - 26 tests with detailed validation criteria

Together they provide comprehensive coverage of all resolvers, execution patterns, and edge cases.

## Test Suite Comparison

### Existing Tests (validation-tests.json)

**Focus:** Core functionality validation
**Total:** 12 tests
**Categories:**
- Simple goals (1)
- Complex goals (1)
- Bootstrap (1)
- Improvisation (1)
- Composition (1)
- State navigation (1)
- Conditional execution (1)
- Parallel execution (1)
- Error recovery (1)
- Ribosome (1)
- Thompson Sampling (1)
- Metadata reasoning (1)

**Strengths:**
- Existing infrastructure (setup.sh, run-validation.ts)
- Integrated with backend trace collection
- Outcome validation framework
- Report generation

### New Tests (test-goals.json)

**Focus:** Comprehensive resolver coverage and edge cases
**Total:** 26 tests
**Categories:**
- Simple goals (4)
- Complex goals (4)
- Bootstrap scenarios (3)
- Composition scenarios (3)
- State navigation (2)
- Edge cases (4)
- Integration scenarios (3)
- Performance tests (2)
- Learning scenarios (2)

**Strengths:**
- Detailed validation criteria per test
- Edge case coverage (cycles, depth limits, failures)
- Integration scenarios (bootstrap + compose, state → activity)
- Performance benchmarks
- Learning loop validation (Thompson Sampling + Ribosome)

## Unified Execution Strategy

### Phase 1: Run Existing Tests

Execute existing validation tests to verify core functionality:

```bash
cd repos/minibob/sandbox
./setup.sh
bun run run-validation.ts high
```

**Expected Results:**
- All high-priority tests pass
- Traces submitted to backend
- Report generated with resolver coverage

### Phase 2: Execute New Comprehensive Tests

Run comprehensive test goals through MiniBob:

```bash
# All tests
bun run execute-test-goals.ts --all

# By category
bun run execute-test-goals.ts --category simple
bun run execute-test-goals.ts --category edge
bun run execute-test-goals.ts --category integration
```

**Expected Results:**
- 26 test executions
- Traces with resolver chain metadata
- Coverage across all resolver types

### Phase 3: Analyze Traces

Validate traces against expected criteria:

```bash
# Analyze all traces
bun run analyze-traces.ts --all

# Summary report
bun run analyze-traces.ts --summary

# Specific test
bun run analyze-traces.ts simple-list-files
```

**Expected Results:**
- Resolver chain validation
- Composition edge verification
- Impulse evolution tracking
- Coverage report

## Resolver Coverage Matrix

| Resolver | Existing Tests | New Tests | Total Coverage |
|----------|---------------|-----------|----------------|
| GoalAnalysisResolver | 4 | 19 | 23 invocations |
| ImproviserResolver | 1 | 7 | 8 invocations |
| TemplateSearchResolver | 2 | 10 | 12 invocations |
| ActivityExecutorResolver | 3 | 9 | 12 invocations |
| ImpulseStateAnalysisResolver | 1 | 2 | 3 invocations |
| BootstrapResolver | 1 | 2 | 3 invocations |
| StateNavigator | 1 | 1 | 2 invocations |
| CompositionDetector | 1 | 5 | 6 invocations |
| FileResolver | 2 | 4 | 6 invocations |
| BashResolver | 3 | 6 | 9 invocations |
| DirectoryTreeResolver | 2 | 3 | 5 invocations |
| GitResolver | 1 | 2 | 3 invocations |
| RibosomeExtractor | 1 | 1 | 2 invocations |
| ThompsonSampler | 1 | 1 | 2 invocations |
| RetryHandler | 0 | 1 | 1 invocation |
| CycleDetector | 0 | 1 | 1 invocation |
| DepthLimiter | 0 | 1 | 1 invocation |
| ParallelExecutor | 1 | 1 | 2 invocations |

## Category-Specific Details

### Simple Goals (4 new + 1 existing)

**Purpose:** Test basic exploration and read-only operations

**Tests:**
1. **simple-list-files** - List TypeScript files
   - Resolver: GoalAnalysisResolver → ImproviserResolver
   - Tools: bash
   - Duration: < 5s

2. **simple-find-pattern** - Grep for console.log
   - Resolver: GoalAnalysisResolver → ImproviserResolver
   - Tools: bash (grep)
   - Duration: < 5s

3. **simple-show-file** - Read single file
   - Resolver: GoalAnalysisResolver → ImproviserResolver
   - Tools: read
   - Duration: < 2s

4. **simple-count-files** - Count test files
   - Resolver: GoalAnalysisResolver → ImproviserResolver
   - Tools: bash
   - Duration: < 5s

5. **test-001-simple-goal** (existing) - Create hello.txt
   - Resolver: GoalAnalysisResolver → FileResolver
   - Tools: write
   - Duration: < 30s

**Key Validation:**
- Complexity classified as "simple"
- Improvisation approach (no templates)
- Max 1-2 turns
- No impulses created (read-only)
- Fast execution (< 5s for new, < 30s for existing)

### Complex Goals (4 new + 1 existing)

**Purpose:** Test multi-step tasks requiring activity templates

**Tests:**
1. **complex-add-feature** - Add /health/detailed endpoint
   - Resolver: GoalAnalysisResolver → TemplateSearchResolver → ActivityExecutorResolver
   - Template: feature-implementation
   - Min tasks: 3

2. **complex-fix-bug** - Fix impulse resolution bug
   - Resolver: GoalAnalysisResolver → TemplateSearchResolver → ActivityExecutorResolver
   - Template: bug-fix
   - Impulses: activityExecutionTrace
   - Min tasks: 2

3. **complex-refactor** - Extract ImpulseResolver class
   - Resolver: GoalAnalysisResolver → TemplateSearchResolver → ActivityExecutorResolver
   - Template: refactoring
   - Min tasks: 4

4. **complex-add-tests** - Add GoalProcessor tests
   - Resolver: GoalAnalysisResolver → TemplateSearchResolver → ActivityExecutorResolver
   - Template: test-creation
   - Min tasks: 3

5. **test-002-complex-goal** (existing) - Add square method + test
   - Resolver: GoalAnalysisResolver → ActivityExecutorResolver
   - Files: src/lib/calculator.ts, tests/calculator.test.ts
   - Duration: < 60s

**Key Validation:**
- Complexity classified as "complex"
- Template search occurs
- Thompson Sampling for selection
- Activity execution with min task count
- State tracking enabled
- Success metrics recorded

### Bootstrap Scenarios (3 new + 1 existing)

**Purpose:** Test context acquisition when impulse state insufficient

**Tests:**
1. **bootstrap-no-context** - Debug with no impulses
   - Resolver: ImpulseStateAnalysisResolver → BootstrapResolver
   - Actions: fetch_error_logs, scan_codebase
   - Impulses created: activityExecutionTrace, directoryTree

2. **bootstrap-missing-traces** - Optimize without execution history
   - Resolver: ImpulseStateAnalysisResolver → BootstrapResolver
   - Actions: fetch_execution_traces, fetch_metrics
   - Impulses created: activityExecutionTrace, activityMetrics

3. **bootstrap-error-analysis** - Investigate CI failures
   - Resolver: ImpulseStateAnalysisResolver → BootstrapResolver
   - Actions: fetch_error_logs, get_git_context
   - Impulses created: activityExecutionTrace, gitDiff

4. **test-003-bootstrap-scenario** (existing) - Codebase summary (cold start)
   - Resolver: ImpulseStateAnalysisResolver → DirectoryTreeResolver
   - Context: No prior impulses
   - Duration: < 45s

**Key Validation:**
- ImpulseStateAnalysisResolver detects insufficient context
- BootstrapResolver executes required actions
- Expected bootstrap actions performed
- Context impulses created
- Processing continues with new context

### Composition Scenarios (3 new + 1 existing)

**Purpose:** Test multi-activity workflows and composition edge recording

**Tests:**
1. **composition-debug-fix-test** - Three-stage workflow
   - Resolver: GoalAnalysisResolver → ActivityExecutorResolver → CompositionDetector
   - Pattern: sequential
   - Sequence: debug → fix → test
   - Edges: 2

2. **composition-implement-test** - Feature + test
   - Resolver: GoalAnalysisResolver → ActivityExecutorResolver → CompositionDetector
   - Pattern: sequential or parallel
   - Sequence: feature → test
   - Edges: 1

3. **composition-refactor-test-deploy** - Complex pipeline
   - Resolver: GoalAnalysisResolver → ActivityExecutorResolver → CompositionDetector
   - Pattern: sequential
   - Sequence: refactor → test → deploy
   - Edges: 2

4. **test-005-activity-composition** (existing) - check-codebase-health
   - Resolver: ActivityExecutorResolver → BashResolver → FileResolver
   - Template: check-codebase-health
   - Duration: < 60s

**Key Validation:**
- CompositionDetector identifies multi-activity goal
- Expected number of composition edges created
- Composition pattern matches (sequential/parallel/conditional)
- Activity sequence matches expected order
- Impulse state flows between activities

### State Navigation (2 new + 1 existing)

**Purpose:** Test procedural path generation from state configurations

**Tests:**
1. **state-navigation-target** - Create files + pass tests
   - Resolver: StateNavigator → ProceduralGenerator
   - Target: filesExist, testsPass, typeCheckPasses
   - Transitions: files_created, tests_written, validation_passed

2. **state-navigation-fix** - Achieve passing validation
   - Resolver: StateNavigator → ProceduralGenerator
   - Target: testsPass, lintPass, typeCheckPasses
   - Transitions: tests_fixed, lint_fixed, types_fixed

3. **test-006-state-space-navigation** (existing) - Fix linting errors
   - Resolver: StateNavigator → BashResolver
   - Context: Dynamic impulse filtering
   - Duration: < 45s

**Key Validation:**
- StateNavigator parses target state
- ProceduralGenerator creates transition path
- State transitions recorded in order
- Target state achieved
- Hybrid execution if matching activity found

### Edge Cases (4 new + 1 existing)

**Purpose:** Test error handling, fallbacks, and limits

**Tests:**
1. **edge-no-templates** - Novel task (quantum entanglement)
   - Resolver: GoalAnalysisResolver → TemplateSearchResolver → ImproviserResolver
   - Fallback: no_matching_templates
   - Ribosome extraction: true

2. **edge-activity-fails** - Broken test triggers retry
   - Resolver: GoalAnalysisResolver → ActivityExecutorResolver → RetryHandler
   - Expected failures: 1
   - Expected retries: 1
   - Recovery: next_template

3. **edge-cycle-detection** - Self-referential goal
   - Resolver: GoalAnalysisResolver → CycleDetector
   - Cycle detected: true
   - Max depth: 5
   - Termination: cycle_detected

4. **edge-depth-limit** - Deep recursive composition
   - Resolver: GoalAnalysisResolver → CompositionDetector → DepthLimiter
   - Max depth: 10
   - Termination: depth_limit_reached
   - Partial completion: true

5. **test-009-error-recovery** (existing) - Read nonexistent file
   - Resolver: FileResolver
   - Validation: allowFailure, requireErrorTrace
   - Duration: < 15s

**Key Validation:**
- Fallback mechanisms trigger correctly
- Retry logic on failures
- Cycle detection prevents infinite loops
- Depth limiting prevents stack overflow
- Error traces captured for learning

### Integration Scenarios (3 new)

**Purpose:** Test full pipeline with multiple subsystems

**Tests:**
1. **integration-full-pipeline** - Feature + test + docs
   - Resolvers: GoalAnalysisResolver → TemplateSearchResolver → ActivityExecutorResolver → CompositionDetector
   - Activities: feature → test → docs
   - Thompson Sampling: rewards recorded
   - Composition edges: 2

2. **integration-bootstrap-compose** - Bootstrap then multi-activity
   - Resolvers: ImpulseStateAnalysisResolver → BootstrapResolver → CompositionDetector
   - Bootstrap actions: fetch_error_logs, fetch_execution_traces
   - Activities: debug → fix
   - Composition edges: 1

3. **integration-state-to-activity** - State navigation finds activity
   - Resolvers: StateNavigator → ProceduralGenerator → ActivityExecutorResolver
   - Target state: filesExist, testsPass
   - Hybrid: procedural_to_activity
   - State transitions: files_created, tests_written

**Key Validation:**
- Complete resolver chain exercised
- Multiple learning mechanisms active
- State flows correctly through pipeline
- All subsystems cooperate
- Metrics recorded at each stage

### Performance Tests (2 new + 1 existing)

**Purpose:** Test efficiency and scalability

**Tests:**
1. **performance-large-codebase** - Scan large project
   - Resolver: GoalAnalysisResolver → ImproviserResolver
   - Max duration: 5s
   - Max tokens: 2000
   - Tool: bash (grep/find)

2. **performance-parallel-composition** - Parallel test execution
   - Resolver: GoalAnalysisResolver → ParallelExecutor
   - Concurrency: 3
   - Max duration: 30s

3. **test-008-parallel-execution** (existing) - Type check + lint
   - Resolver: ActivityExecutorResolver → BashResolver
   - Duration: < 20s (less than sequential sum)

**Key Validation:**
- Duration under thresholds
- Token usage optimized
- Parallelism utilized when applicable
- No redundant operations
- Performance warnings (not failures)

### Learning Scenarios (2 new + 2 existing)

**Purpose:** Test Thompson Sampling and Ribosome extraction

**Tests:**
1. **learning-thompson-update** - Template selection + reward
   - Resolver: GoalAnalysisResolver → TemplateSearchResolver → ThompsonSampler
   - Selection logged: true
   - Probability recorded: true
   - Reward calculated: true
   - Posterior updated: true

2. **learning-ribosome-extract** - Improvisation → template
   - Resolver: GoalAnalysisResolver → ImproviserResolver → RibosomeExtractor
   - Extraction: true
   - New template category: feature
   - State tracking: true
   - Validation rules: true

3. **test-010-ribosome-extraction** (existing) - URL validator + tests
   - Resolver: ImproviserResolver → RibosomeResolver
   - Validation: checkRibosomeExtraction
   - Duration: < 90s

4. **test-011-thompson-sampling** (existing) - Fix TypeScript errors
   - Resolver: GoalAnalysisResolver → ActivityExecutorResolver
   - Validation: checkThompsonMetadata
   - Duration: < 60s

**Key Validation:**
- Thompson Sampling: selection probability, reward, posterior update
- Ribosome: extraction flag, new template ID, category, state tracking
- Learning loop integration verified
- Templates become available for future use

## Execution Timeline

### Full Test Suite Execution

**Estimated Duration:** 30-45 minutes
**Estimated Cost:** $1.50-$3.00 (depending on LLM usage)

**Order:**
1. Simple goals (5 tests, ~2 min, $0.05)
2. Complex goals (5 tests, ~10 min, $0.50)
3. Bootstrap (4 tests, ~5 min, $0.20)
4. Composition (4 tests, ~8 min, $0.40)
5. State navigation (3 tests, ~3 min, $0.15)
6. Edge cases (5 tests, ~6 min, $0.20)
7. Integration (3 tests, ~5 min, $0.30)
8. Performance (3 tests, ~2 min, $0.10)
9. Learning (4 tests, ~6 min, $0.30)

**Total:** 36 tests across both suites

### Incremental Execution

**High Priority Only** (~15 tests, 15-20 min, $0.80-$1.20):
- All simple goals
- Complex goals (feature, bug, test)
- Bootstrap (no-context)
- Composition (debug-fix-test)
- Integration (full-pipeline)
- Learning (Thompson, Ribosome)

**Category-Specific** (varies by category):
```bash
# Simple goals only (~2 min)
bun run execute-test-goals.ts --category simple

# Edge cases only (~6 min)
bun run execute-test-goals.ts --category edge

# Learning scenarios only (~6 min)
bun run execute-test-goals.ts --category learning
```

## Expected Outcomes

### Trace Collection

**Expected trace count:** 36 (100% coverage)
**Trace submission rate:** 100% (all traces submitted to backend)
**Failed executions:** 2-4 (edge cases designed to fail)

### Resolver Coverage

**Primary resolvers:**
- GoalAnalysisResolver: 23 invocations (64%)
- ActivityExecutorResolver: 12 invocations (33%)
- ImproviserResolver: 8 invocations (22%)
- TemplateSearchResolver: 12 invocations (33%)

**Secondary resolvers:**
- BashResolver: 9 invocations
- FileResolver: 6 invocations
- DirectoryTreeResolver: 5 invocations
- CompositionDetector: 6 invocations

**Specialized resolvers:**
- ImpulseStateAnalysisResolver: 3 invocations
- BootstrapResolver: 3 invocations
- StateNavigator: 2 invocations
- ThompsonSampler: 2 invocations
- RibosomeExtractor: 2 invocations
- RetryHandler: 1 invocation
- CycleDetector: 1 invocation
- DepthLimiter: 1 invocation

### Composition Patterns

- Sequential: 8 occurrences
- Parallel: 2 occurrences
- Conditional: 1 occurrence (if implemented)

### Impulse Types Created

- activityTemplate: 12 times
- activityExecutionTrace: 15 times
- activityMetrics: 8 times
- directoryTree: 6 times
- gitDiff: 3 times
- file: 10 times
- memo: 5 times

### Learning Outcomes

**Thompson Sampling:**
- Template selections: 12
- Rewards recorded: 12
- Posterior updates: 12

**Ribosome Extraction:**
- Improvisations: 8
- Successful extractions: 2
- New templates created: 2

## Validation Criteria

See `VALIDATION_CRITERIA.md` for complete validation rules.

**Summary:**
- Each test has expected resolver chain
- Each test has expected approach (improvise/template/composition/bootstrap/procedural)
- Duration, cost, token thresholds defined
- Tool usage patterns expected
- Impulse evolution tracked
- Composition edges validated
- Learning integration verified

## Reporting

### Existing Framework Reports

Generated by `run-validation.ts`:
```json
{
  "timestamp": "...",
  "totalTests": 12,
  "passed": 10,
  "failed": 2,
  "results": [...],
  "summary": {
    "byPriority": {...},
    "byResolver": {...},
    "traceCollection": {...}
  }
}
```

### New Framework Reports

Generated by `analyze-traces.ts`:
```
=== COVERAGE REPORT ===

Total test goals: 26
Executed goals: 26 (100.0%)
Passed goals: 24 (92.3%)

Category Breakdown:
  simple               4/4 executed (100.0%), 4 passed (100.0%)
  complex              4/4 executed (100.0%), 4 passed (100.0%)
  ...

Resolver Coverage:
  GoalAnalysisResolver           23 invocations
  ImproviserResolver              8 invocations
  ...

Impulse Types Created:
  activityTemplate, activityExecutionTrace, ...
```

## Integration with CI/CD

```yaml
# .github/workflows/minibob-resolver-tests.yml
name: MiniBob Resolver Tests

on:
  push:
    branches: [dev, main]
  pull_request:

jobs:
  test-resolvers:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1

      - name: Run existing validation tests
        run: |
          cd repos/minibob/sandbox
          ./setup.sh
          bun run run-validation.ts high

      - name: Run comprehensive test goals
        run: |
          cd repos/minibob/sandbox
          bun run execute-test-goals.ts --category simple
          bun run execute-test-goals.ts --category complex
          bun run execute-test-goals.ts --category learning

      - name: Analyze traces
        run: |
          cd repos/minibob/sandbox
          bun run analyze-traces.ts --summary

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: repos/minibob/sandbox/reports/
```

## Next Steps

1. **Execute existing tests** - Validate core functionality
2. **Execute new comprehensive tests** - Full resolver coverage
3. **Analyze traces** - Validate against criteria
4. **Review failures** - Investigate and fix issues
5. **Iterate on resolvers** - Improve based on test results
6. **Extract patterns** - Use Thompson Sampling and Ribosome
7. **Repeat** - Continuous improvement through testing

The test suites themselves improve through the learning loop - successful patterns become templates for future development.
