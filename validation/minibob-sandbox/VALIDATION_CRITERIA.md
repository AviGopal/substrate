# Test Goal Validation Criteria

This document defines the validation criteria for each test goal scenario and explains how to interpret the results.

## Overall Validation Framework

Each test goal is validated against:

1. **Resolver Chain** - Which resolvers were invoked and in what order
2. **Approach** - How the goal was processed (improvise, template, composition, bootstrap, procedural)
3. **Complexity** - Goal complexity classification (simple, complex)
4. **Execution Metrics** - Duration, cost, tokens, success rate
5. **Tool Usage** - Which tools were called during execution
6. **Impulse Evolution** - Which impulse types were created and consumed
7. **Composition Edges** - Activity relationships and patterns
8. **Learning Integration** - Thompson Sampling and Ribosome extraction

## Category-Specific Criteria

### Simple Goals

**Purpose:** Test basic exploration and read-only operations that should trigger improvisation.

**Expected Behavior:**
- Complexity: `simple`
- Approach: `improvise`
- Resolver chain: `GoalAnalysisResolver → ImproviserResolver`
- Max turns: 1-2
- No templates searched
- No composition edges
- Minimal token usage

**Validation Checks:**
- ✅ GoalAnalysisResolver classifies as simple
- ✅ ImproviserResolver handles execution
- ✅ No TemplateSearchResolver or ActivityExecutorResolver invoked
- ✅ Execution completes within turn limit
- ✅ Expected tools used (bash, read)
- ✅ No impulses created (read-only)

**Examples:**
- `simple-list-files`: List TypeScript files
- `simple-find-pattern`: Grep for console.log
- `simple-show-file`: Read a single file
- `simple-count-files`: Count test files

### Complex Goals

**Purpose:** Test multi-step tasks that should find and execute activity templates.

**Expected Behavior:**
- Complexity: `complex`
- Approach: `template`
- Resolver chain: `GoalAnalysisResolver → TemplateSearchResolver → ActivityExecutorResolver`
- Min tasks: 2-4 depending on goal
- Template selection via Thompson Sampling
- Success metrics recorded
- State tracking enabled

**Validation Checks:**
- ✅ GoalAnalysisResolver classifies as complex
- ✅ TemplateSearchResolver finds matching templates
- ✅ Thompson Sampling used for template selection
- ✅ ActivityExecutorResolver executes template
- ✅ Minimum task count met
- ✅ Expected tools used (edit, write, bash)
- ✅ Activity-related impulses created (activityTemplate, activityMetrics)
- ✅ Success/failure recorded with reward calculation

**Examples:**
- `complex-add-feature`: Add new endpoint
- `complex-fix-bug`: Fix impulse resolution bug
- `complex-refactor`: Extract class
- `complex-add-tests`: Add test coverage

### Bootstrap Scenarios

**Purpose:** Test context acquisition when impulse state is insufficient.

**Expected Behavior:**
- Approach: `bootstrap` or `bootstrap_then_compose`
- Resolver chain: `ImpulseStateAnalysisResolver → BootstrapResolver → ...`
- Bootstrap actions executed (fetch_error_logs, scan_codebase, fetch_execution_traces)
- Impulses created from bootstrap actions
- Transition to normal processing after bootstrap

**Validation Checks:**
- ✅ ImpulseStateAnalysisResolver detects insufficient context
- ✅ BootstrapResolver executes required actions
- ✅ Expected bootstrap actions performed
- ✅ Context impulses created (activityExecutionTrace, directoryTree, gitDiff)
- ✅ Processing continues with new context

**Bootstrap Actions:**
- `fetch_error_logs`: Get recent execution failures
- `scan_codebase`: Create directory tree impulse
- `fetch_execution_traces`: Load execution history
- `fetch_metrics`: Load performance data
- `get_git_context`: Load git diff and status

**Examples:**
- `bootstrap-no-context`: Debug with no impulses
- `bootstrap-missing-traces`: Optimize without execution history
- `bootstrap-error-analysis`: Investigate CI failures

### Composition Scenarios

**Purpose:** Test multi-activity workflows and composition edge recording.

**Expected Behavior:**
- Approach: `composition`
- Resolver chain: `GoalAnalysisResolver → ActivityExecutorResolver → CompositionDetector`
- Multiple activities executed in sequence or parallel
- Composition edges recorded with pattern
- Each activity's output becomes next activity's input

**Validation Checks:**
- ✅ CompositionDetector identifies multi-activity goal
- ✅ Expected number of composition edges created
- ✅ Composition pattern matches expectation (sequential, parallel, conditional)
- ✅ Activity sequence matches expected order
- ✅ Impulse state flows between activities
- ✅ Each edge includes timestamp and pattern

**Composition Patterns:**
- `sequential`: Activities execute in order (debug → fix → test)
- `parallel`: Activities execute concurrently (test multiple files)
- `conditional`: Next activity depends on previous result
- `iterative`: Activity repeats until condition met

**Examples:**
- `composition-debug-fix-test`: Three-stage workflow
- `composition-implement-test`: Feature + test
- `composition-refactor-test-deploy`: Complex pipeline

### State Navigation Scenarios

**Purpose:** Test procedural path generation from state configurations.

**Expected Behavior:**
- Approach: `procedural` or `procedural_to_activity`
- Resolver chain: `StateNavigator → ProceduralGenerator → ...`
- Goal defined as target state, not instructions
- State transitions recorded
- May switch to activity execution if matching template found

**Validation Checks:**
- ✅ StateNavigator parses target state
- ✅ ProceduralGenerator creates transition path
- ✅ State transitions recorded in order
- ✅ Target state achieved
- ✅ Hybrid execution if matching activity found

**State Properties:**
- `filesExist`: List of files that must exist
- `testsPass`: Test suite passes
- `typeCheckPasses`: TypeScript compilation succeeds
- `lintPass`: Linting succeeds
- `gitClean`: No uncommitted changes

**Examples:**
- `state-navigation-target`: Create files and pass tests
- `state-navigation-fix`: Achieve passing validation state

### Edge Case Scenarios

**Purpose:** Test error handling, fallbacks, and limits.

**Expected Behavior (varies by scenario):**
- Improvisation fallback when no templates match
- Retry logic on activity failure
- Cycle detection on self-referential goals
- Depth limiting on recursive composition
- Graceful degradation on resource constraints

**Validation Checks:**

**No Matching Templates:**
- ✅ TemplateSearchResolver finds no matches
- ✅ Falls back to ImproviserResolver
- ✅ Fallback reason recorded
- ✅ Ribosome extraction occurs if successful
- ✅ New template created from improvisation

**Activity Failure:**
- ✅ ActivityExecutorResolver detects failure
- ✅ RetryHandler invoked
- ✅ Retry count incremented
- ✅ Next template tried or fallback to improvisation
- ✅ Recovery strategy recorded

**Cycle Detection:**
- ✅ CompositionDetector identifies circular dependency
- ✅ Execution terminates before infinite loop
- ✅ Cycle detected flag set
- ✅ Partial results preserved

**Depth Limit:**
- ✅ Composition depth tracked
- ✅ Terminates at max depth (default: 10)
- ✅ Termination reason recorded
- ✅ Partial completion status set

**Examples:**
- `edge-no-templates`: Novel task requires improvisation
- `edge-activity-fails`: Broken test triggers retry
- `edge-cycle-detection`: Self-referential goal
- `edge-depth-limit`: Deep recursive composition

### Integration Scenarios

**Purpose:** Test full pipeline with multiple subsystems.

**Expected Behavior:**
- Multiple resolver types invoked
- Bootstrap + composition combined
- State navigation + activity execution hybrid
- Thompson Sampling updates recorded
- Ribosome extraction from improvisation
- Composition edges with patterns

**Validation Checks:**
- ✅ Complete resolver chain exercised
- ✅ Multiple learning mechanisms active
- ✅ State flows correctly through pipeline
- ✅ All subsystems cooperate
- ✅ Metrics recorded at each stage

**Examples:**
- `integration-full-pipeline`: Feature + test + docs
- `integration-bootstrap-compose`: Bootstrap then multi-activity
- `integration-state-to-activity`: State navigation finds matching activity

### Performance Scenarios

**Purpose:** Test efficiency and scalability.

**Expected Behavior:**
- Duration within acceptable limits
- Token usage optimized
- Parallel execution when possible
- Resource budgets respected

**Validation Checks:**
- ✅ Duration under max threshold
- ✅ Token count reasonable
- ✅ Parallelism utilized if applicable
- ✅ No redundant operations
- ⚠️ Performance warnings (not failures)

**Examples:**
- `performance-large-codebase`: Scan large project
- `performance-parallel-composition`: Parallel activity execution

### Learning Scenarios

**Purpose:** Test Thompson Sampling and Ribosome extraction.

**Expected Behavior:**
- Template selection logged with probability
- Execution reward calculated
- Posterior distribution updated
- Successful improvisations extracted
- New templates created with metadata

**Validation Checks:**

**Thompson Sampling:**
- ✅ Template selection logged
- ✅ Selection probability recorded
- ✅ Execution tracked
- ✅ Reward calculated (1.0 for success, decay for failure)
- ✅ Posterior updated (alpha/beta)
- ✅ Next selection uses updated distribution

**Ribosome Extraction:**
- ✅ Improvisation detected as extractable
- ✅ State tracking enabled during execution
- ✅ Input/output state captured
- ✅ Validation rules inferred
- ✅ New template created with tasks
- ✅ Template category assigned
- ✅ Template available for future use

**Examples:**
- `learning-thompson-update`: Template selection and reward
- `learning-ribosome-extract`: Improvisation → template

## Metric Interpretations

### Duration
- **Simple goals:** < 5 seconds
- **Complex goals:** < 30 seconds
- **Composition:** < 60 seconds
- **Warning threshold:** 2x expected duration

### Cost
- **Simple goals:** < $0.01
- **Complex goals:** < $0.10
- **Composition:** < $0.25
- **Warning threshold:** 3x expected cost

### Tokens
- **Simple goals:** < 2,000 tokens
- **Complex goals:** < 10,000 tokens
- **Composition:** < 20,000 tokens
- **Warning threshold:** Exceeding maxTokens in validation

### Success Rate
- **Expected:** 100% for passing tests
- **Acceptable:** ≥80% for complex multi-task goals
- **Warning:** <80% indicates task failures

## Trace Structure Requirements

Every trace must include:

```typescript
{
  id: string                    // Unique trace ID
  activity_id: string           // Activity that was executed
  activity_name: string         // Human-readable name
  timestamp: string             // ISO 8601
  duration_ms: number           // Total execution time
  success: boolean              // Overall success/failure
  total_cost: number            // USD cost
  total_tokens: number          // Total tokens consumed
  tasks: TaskTrace[]            // Individual task executions

  // Optional but recommended
  composition_edges?: CompositionEdge[]
  impulse_state?: {
    before: ImpulseSnapshot[]   // Impulses at start
    after: ImpulseSnapshot[]    // Impulses at end
  }

  // Required for validation
  metadata: {
    resolver_chain: string[]    // Resolvers invoked in order
    goal: string                // Original goal text or JSON
    approach: string            // How goal was processed
    complexity?: string         // Goal complexity
    bootstrap_actions?: string[]
    state_transitions?: string[]
    failure_reason?: string
    retry_count?: number
    cycle_detected?: boolean
    depth_reached?: number

    thompson_sampling?: {
      template_id: string
      selection_probability: number
      reward: number
    }

    ribosome_extraction?: {
      extracted: boolean
      new_template_id?: string
      category?: string
    }
  }
}
```

## Running Validation

### Execute All Test Goals

```bash
# Run all test goals through MiniBob
bun run sandbox/execute-test-goals.ts

# Analyze results
bun run sandbox/analyze-traces.ts --all
```

### Execute Single Goal

```bash
# Run specific goal
bun run sandbox/execute-test-goals.ts simple-list-files

# Analyze specific result
bun run sandbox/analyze-traces.ts simple-list-files
```

### Summary Report

```bash
# Coverage summary only
bun run sandbox/analyze-traces.ts --summary
```

## Expected Coverage Targets

### Resolver Coverage
- GoalAnalysisResolver: 100% (all non-bootstrap goals)
- ImproviserResolver: ≥30% (simple goals + fallbacks)
- TemplateSearchResolver: ≥40% (complex goals)
- ActivityExecutorResolver: ≥40% (complex goals + composition)
- ImpulseStateAnalysisResolver: ≥15% (bootstrap scenarios)
- BootstrapResolver: ≥15% (bootstrap scenarios)
- StateNavigator: ≥10% (state navigation scenarios)
- CompositionDetector: ≥20% (composition scenarios)

### Category Coverage
- Simple: 100% of simple goals executed
- Complex: 100% of complex goals executed
- Bootstrap: 100% of bootstrap scenarios executed
- Composition: 100% of composition scenarios executed
- State: 100% of state navigation scenarios executed
- Edge: ≥80% of edge cases executed (some may be hard to trigger)
- Integration: 100% of integration scenarios executed
- Performance: ≥80% (performance tests may be flaky)
- Learning: 100% of learning scenarios executed

### Impulse Type Coverage
Expected impulse types created across all tests:
- `activityTemplate`
- `activityExecutionTrace`
- `activityMetrics`
- `activityCompositionGraph`
- `directoryTree`
- `gitDiff`
- `file`
- `memo`

### Composition Pattern Coverage
- Sequential: ≥5 occurrences
- Parallel: ≥1 occurrence (if implemented)
- Conditional: ≥1 occurrence (if implemented)

### Learning Coverage
- Thompson Sampling updates: ≥10 (all complex goals)
- Ribosome extractions: ≥2 (improvisation fallbacks)
- New templates created: ≥2

## Troubleshooting Failed Validations

### Missing Resolvers
**Symptom:** `shouldInclude` resolver not in chain

**Possible Causes:**
- Resolver not registered in GoalProcessor
- Goal classification incorrect
- Bootstrap skipped when needed

**Debug:**
1. Check resolver registration
2. Verify goal complexity classification
3. Check impulse state before execution

### Unexpected Resolvers
**Symptom:** `shouldNotInclude` resolver invoked

**Possible Causes:**
- Fallback triggered incorrectly
- Template search when should improvise
- Composition detection on single-task goal

**Debug:**
1. Check goal complexity threshold
2. Verify template matching logic
3. Review composition detection heuristics

### Wrong Approach
**Symptom:** Expected `template`, got `improvise`

**Possible Causes:**
- No templates match the goal
- Template search failed
- Complexity misclassified

**Debug:**
1. Check available templates
2. Verify template search query
3. Review goal text for clarity

### Missing Composition Edges
**Symptom:** Expected edges not recorded

**Possible Causes:**
- CompositionDetector not invoked
- Activities executed sequentially without detection
- Edge recording failed

**Debug:**
1. Check CompositionDetector registration
2. Verify multi-activity goal structure
3. Check backend edge storage

### Missing Impulses
**Symptom:** Expected impulse type not created

**Possible Causes:**
- Resolver didn't create impulse
- Impulse creation failed
- Wrong resolver invoked

**Debug:**
1. Check impulse state snapshots
2. Verify resolver implementation
3. Check impulse creation errors

### Performance Issues
**Symptom:** Duration or tokens exceed limits

**Possible Causes:**
- Inefficient tool usage
- Excessive LLM calls
- Retry loops

**Debug:**
1. Review tool call sequence
2. Check LLM call count per task
3. Look for retry patterns
4. Optimize prompt size

## Continuous Improvement

As the system evolves:

1. **Add new test goals** for new resolvers or patterns
2. **Update validation criteria** when behavior changes
3. **Adjust thresholds** based on actual performance
4. **Document anomalies** for future investigation
5. **Extract successful patterns** into templates via Ribosome

The test suite itself should improve through Thompson Sampling - goals that consistently pass with high efficiency should influence future template selection.
