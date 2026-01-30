# Integration: Activity Execution Debugger + Double-Blind Learning System

## Overview

This document shows how to combine the **Activity Execution Debugging System** with the **Double-Blind Learning Architecture** to create a self-improving system for activities, code, and tools.

**Key Insight**: Debugging data becomes learning data.

---

## Architecture Relationship

### The Stack (Bottom to Top)

```
┌─────────────────────────────────────────────────────────────┐
│  Agent Tasks (Human/Claude)                                 │
│  ↓ Execute activity with debugger                           │
├─────────────────────────────────────────────────────────────┤
│  Activity Execution Debugger (NEW)                          │
│  - Phase tracking                                           │
│  - Checkpoints & assertions                                │
│  - Metrics recording                                        │
│  - Root cause analysis (on failure)                        │
│  ↓ Emits diagnostic data                                   │
├─────────────────────────────────────────────────────────────┤
│  Learning System (Double-Blind Learning)                    │
│  - Thompson Sampling variant assignment                     │
│  - Impression tracking                                      │
│  - Feedback recording                                       │
│  - Parameter updates (background)                           │
│  ↓ Updates activity recommendations                        │
├─────────────────────────────────────────────────────────────┤
│  RPC API + SurrealDB                                        │
│  - Stores diagnostic data                                   │
│  - Learns activity effectiveness                            │
│  - Provides recommendations                                 │
│  ↓ Serves agents and humans                                │
├─────────────────────────────────────────────────────────────┤
│  Metabob MCP (CPG analysis)                                 │
│  - Code structure analysis                                  │
│  - Component relationships                                  │
│  - Change impact analysis                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Debugger → Learning System

### Phase 1: Activity Execution with Debugging

```typescript
// Agent executes activity with debugger
const executor = new ActivityExecutionDebugger(activityId, activityType);

try {
  // Phase 1: INITIALIZATION
  executor.enterPhase(ExecutionPhase.INITIALIZATION, 'Setup');
  const cp_init = executor.checkpoint('cp_init', 'Verify environment');
  debugger.assertTrue('environment_ready', isReady);
  cp_init.complete(ExecutionState.SUCCESS);
  executor.exitPhase(ExecutionState.SUCCESS);

  // Phase 2: EXECUTION
  executor.enterPhase(ExecutionPhase.EXECUTION, 'Execute activity');
  const cp_exec = executor.checkpoint('cp_exec', 'Run main work');
  const result = await doWork();
  debugger.assertTrue('work_success', result.success);
  cp_exec.metrics({
    duration_ms: Date.now() - startTime,
    files_changed: result.filesChanged,
    tests_passed: result.testsCount,
  });
  cp_exec.complete(ExecutionState.SUCCESS);
  executor.exitPhase(ExecutionState.SUCCESS);

  // Phase 3: VALIDATION
  executor.enterPhase(ExecutionPhase.VALIDATION, 'Validate output');
  const cp_valid = executor.checkpoint('cp_valid', 'Run quality checks');
  const quality = await runQualityChecks();
  debugger.assertTrue('quality_acceptable', quality.passed);
  cp_valid.metrics({
    coverage: quality.coverage,
    issues: quality.issueCount,
  });
  cp_valid.complete(ExecutionState.SUCCESS);
  executor.exitPhase(ExecutionState.SUCCESS);

} catch (error) {
  executor.enterPhase(ExecutionPhase.ERROR_RECOVERY);
  // ... recovery code ...
  executor.exitPhase(ExecutionState.FAILED);
} finally {
  executor.finalize();
}

// Generate diagnostic
const diagnostic = executor.getDiagnostic();
```

### Phase 2: Send Diagnostic to Learning System

```typescript
// After activity execution completes
const diagnostic = executor.getDiagnostic();

// Convert diagnostic to feedback
const feedback = {
  impression_id: diagnostic.activityId,  // Or from recommendation
  activity_type: diagnostic.type,
  outcome: diagnostic.failures.length === 0 ? 'success' : 'failure',
  
  // Diagnostic data as metrics
  metrics: {
    duration_ms: diagnostic.duration,
    checkpoint_count: diagnostic.checkpoints.length,
    assertion_count: diagnostic.checkpoints.reduce(
      (sum, cp) => sum + cp.assertions.length, 
      0
    ),
    failure_count: diagnostic.failures.length,
    
    // Phase-specific metrics
    phases: diagnostic.checkpoints.reduce((acc, cp) => {
      if (!acc[cp.phase]) acc[cp.phase] = [];
      acc[cp.phase].push(cp.metrics);
      return acc;
    }, {}),
    
    // Root cause if failed
    root_cause: diagnostic.rootCause ? {
      failure_point: diagnostic.rootCause.failurePoint,
      immediate_reason: diagnostic.rootCause.immediateReason,
      contributing_factors: diagnostic.rootCause.contributingFactors,
    } : null,
  },
  
  // Diagnostic data for analysis
  diagnostic_data: {
    checkpoints: diagnostic.checkpoints,
    failures: diagnostic.failures,
    warnings: diagnostic.warnings,
  },
};

// Send to learning system
const response = await fetch('/api/v1/feedback/record', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(feedback),
});
```

### Phase 3: Learning System Processes Feedback

```
Learning System (RPC API):
1. Receive feedback with diagnostic data
2. Look up variant assignment (impression_id)
3. Identify which activity was recommended
4. Record success/failure outcome
5. Update Thompson Sampling parameters:
   - If success: alpha++ (increment successes)
   - If failure: beta++ (increment failures)
6. Update association weights:
   - Component ↔ Activity mapping
   - Component ↔ Context impulse mapping
7. Store complete diagnostic in SurrealDB
8. Trigger Celery task for parameter batch updates
```

---

## Integration Points

### 1. Activity Recommendation Request

**Before**: Activity chosen arbitrarily  
**After**: Get recommendation from learning system

```typescript
// Agent: "I need to fix a memory leak in session management"

// Step 1: Use Metabob to find component
const issues = await metabob_search_codebase_issues("memory leak");
// Returns: [{ component_id: "src/session/index.ts::messages" }]

// Step 2: Get recommendation from learning system
const recommendation = await fetch('/api/v1/recommendations/get', {
  method: 'POST',
  body: JSON.stringify({
    task: 'Fix memory leak in session management',
    component_ids: ['src/session/index.ts::messages'],
  }),
}).then(r => r.json());

// Response includes:
// {
//   recommended_activity: "fix-bug-complete",
//   context_impulses: [
//     { impulse_id: 'imp_xyz', type: 'pattern', content: 'Session memory fixes...' }
//   ],
//   impression_id: 'imp_abc123'  // Track this for feedback
// }

// Step 3: Execute recommended activity with debugging
const executor = new ActivityExecutionDebugger(
  recommendation.impression_id,  // Use impression_id
  recommendation.recommended_activity
);

// ... execute activity with full debugging ...

const diagnostic = executor.getDiagnostic();

// Step 4: Send feedback to learning system
await recordFeedback(recommendation.impression_id, diagnostic);
```

### 2. Activity System Integration

**File**: `src/session/activity-executor-with-learning.ts`

```typescript
import ActivityExecutionDebugger, {
  ExecutionPhase,
  ExecutionState,
} from './lib/activity-execution-debugger';

export class LearningActivityExecutor {
  constructor(
    private learningSystemUrl: string,
    private activityId: string,
    private activityType: string
  ) {}

  /**
   * Execute activity with debugging and learning
   */
  async executeWithLearning(
    variables: Record<string, any>,
    impressionId?: string
  ): Promise<{
    success: boolean;
    diagnostic: ExecutionDiagnostic;
    feedback: Record<string, any>;
  }> {
    const executor = new ActivityExecutionDebugger(
      impressionId || this.activityId,
      this.activityType
    );

    try {
      // Execute activity with full debugging
      const result = await this.executeActivity(executor, variables);
      executor.finalize();

      // Convert diagnostic to feedback
      const diagnostic = executor.getDiagnostic();
      const feedback = this.createFeedback(diagnostic, result);

      // Send to learning system
      if (impressionId) {
        await this.sendFeedback(impressionId, feedback);
      }

      return {
        success: executor.isSuccessful(),
        diagnostic,
        feedback,
      };
    } catch (error) {
      executor.finalize();
      const diagnostic = executor.getDiagnostic();

      // Send failure feedback
      if (impressionId) {
        await this.sendFeedback(impressionId, {
          impression_id: impressionId,
          outcome: 'failure',
          error: error instanceof Error ? error.message : String(error),
          diagnostic_data: {
            checkpoints: diagnostic.checkpoints,
            failures: diagnostic.failures,
            root_cause: diagnostic.rootCause,
          },
        });
      }

      throw error;
    }
  }

  /**
   * Create feedback from diagnostic
   */
  private createFeedback(
    diagnostic: ExecutionDiagnostic,
    result: any
  ): Record<string, any> {
    return {
      impression_id: diagnostic.activityId,
      activity_type: diagnostic.type,
      outcome: diagnostic.failures.length === 0 ? 'success' : 'failure',
      
      metrics: {
        duration_ms: diagnostic.duration,
        checkpoint_count: diagnostic.checkpoints.length,
        assertion_count: diagnostic.checkpoints.reduce(
          (sum, cp) => sum + cp.assertions.length,
          0
        ),
        failure_count: diagnostic.failures.length,
        phase_breakdown: this.analyzePhases(diagnostic),
      },

      diagnostic_data: {
        checkpoints: diagnostic.checkpoints.map(cp => ({
          id: cp.id,
          phase: cp.phase,
          state: cp.state,
          assertions: cp.assertions,
          metrics: cp.metrics,
        })),
        failures: diagnostic.failures,
        root_cause: diagnostic.rootCause,
      },

      result_data: result,
    };
  }

  /**
   * Analyze phase execution for feedback
   */
  private analyzePhases(
    diagnostic: ExecutionDiagnostic
  ): Record<string, any> {
    const phases: Record<string, any> = {};

    for (const cp of diagnostic.checkpoints) {
      if (!phases[cp.phase]) {
        phases[cp.phase] = {
          checkpoints: 0,
          assertions: 0,
          passed: 0,
          failed: 0,
        };
      }

      phases[cp.phase].checkpoints++;
      const assertionCount = cp.assertions.length;
      const passedCount = cp.assertions.filter(a => a.passed).length;

      phases[cp.phase].assertions += assertionCount;
      phases[cp.phase].passed += passedCount;
      phases[cp.phase].failed += assertionCount - passedCount;
    }

    return phases;
  }

  /**
   * Send feedback to learning system
   */
  private async sendFeedback(
    impressionId: string,
    feedback: Record<string, any>
  ): Promise<void> {
    const response = await fetch(`${this.learningSystemUrl}/api/v1/feedback/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        impression_id: impressionId,
        ...feedback,
      }),
    });

    if (!response.ok) {
      console.warn('Failed to send feedback to learning system:', response.statusText);
    }
  }

  /**
   * Execute the actual activity
   */
  private async executeActivity(
    executor: ActivityExecutionDebugger,
    variables: Record<string, any>
  ): Promise<any> {
    // Override in subclass for specific activity execution
    throw new Error('executeActivity must be implemented');
  }
}
```

### 3. Validation Gates Using Debugging

**File**: `src/validation/activity-quality-gates.ts`

```typescript
import ActivityExecutionDebugger, {
  ExecutionPhase,
  ExecutionState,
} from './lib/activity-execution-debugger';

export class ActivityQualityGates {
  /**
   * Validate activity output before commit
   */
  async validateBeforeCommit(
    diagnostic: ExecutionDiagnostic,
    options: {
      minCoverage?: number;
      maxDuration?: number;
      requiredPhases?: ExecutionPhase[];
    } = {}
  ): Promise<{
    passed: boolean;
    failures: string[];
    warnings: string[];
  }> {
    const failures: string[] = [];
    const warnings: string[] = [];

    // Gate 1: All phases completed successfully
    const phases = new Set(diagnostic.checkpoints.map(cp => cp.phase));
    const requiredPhases = options.requiredPhases || [
      ExecutionPhase.EXECUTION,
      ExecutionPhase.VALIDATION,
    ];

    for (const required of requiredPhases) {
      if (!phases.has(required)) {
        failures.push(`Missing phase: ${required}`);
      }
    }

    // Gate 2: No critical failures
    if (diagnostic.failures.length > 0) {
      failures.push(`${diagnostic.failures.length} critical failures detected`);

      for (const failure of diagnostic.failures) {
        failures.push(`  - ${failure.checkpoint}: ${failure.assertion?.reason}`);
      }
    }

    // Gate 3: All assertions passed
    const totalAssertions = diagnostic.checkpoints.reduce(
      (sum, cp) => sum + cp.assertions.length,
      0
    );
    const failedAssertions = diagnostic.checkpoints.reduce(
      (sum, cp) => sum + cp.assertions.filter(a => !a.passed).length,
      0
    );

    if (failedAssertions > 0) {
      failures.push(
        `${failedAssertions}/${totalAssertions} assertions failed`
      );
    }

    // Gate 4: Performance threshold
    if (options.maxDuration && diagnostic.duration > options.maxDuration) {
      warnings.push(
        `Execution time ${diagnostic.duration}ms exceeds threshold ${options.maxDuration}ms`
      );
    }

    // Gate 5: Root cause analysis if failed
    if (diagnostic.rootCause) {
      warnings.push(`Root cause: ${diagnostic.rootCause.immediateReason}`);
      for (const factor of diagnostic.rootCause.contributingFactors) {
        warnings.push(`  - ${factor}`);
      }
    }

    return {
      passed: failures.length === 0,
      failures,
      warnings,
    };
  }
}
```

---

## Learning Scenarios

### Scenario 1: Improve Activity Template

**Problem**: "fix-bug-complete" has 60% success rate

**Solution**: Learning system identifies that failures happen when:
- Checkpoint "cp_test_coverage" < 80%
- Root cause: "Missing test coverage for edge cases"

**Improvement**: Update activity to include "cp_edge_case_tests"

```typescript
// RPC API analyzes failure patterns
const failurePatterns = await analyzeFailures('fix-bug-complete');
// Returns: [
//   {
//     pattern: 'Low test coverage',
//     success_rate: 0.3,
//     cases: 12,
//     suggested_improvement: 'Add edge case test checkpoint'
//   }
// ]

// Auto-update activity
const improved = updateActivityTemplate('fix-bug-complete', {
  new_checkpoint: {
    id: 'cp_edge_case_tests',
    description: 'Test edge cases and error conditions',
    assertions: [
      'edge_cases_covered',
      'error_handling_tested',
    ],
  },
});

// Template version increments, learning system tracks improvement
```

### Scenario 2: Context Selection Improves

**Problem**: Activity recommender doesn't know which impulses help

**Solution**: Learning system tracks which context impulses lead to success

```typescript
// RPC API learns associations
const associations = await getComponentImpulseAssociations('src/session/index.ts::messages');
// Returns: [
//   { impulse: 'memory_leak_pattern', success_rate: 0.92 },
//   { impulse: 'cache_optimization', success_rate: 0.85 },
//   { impulse: 'session_lifecycle', success_rate: 0.78 },
// ]

// Next recommendation includes top associations
const recommendation = await getRecommendation({
  task: 'Fix session memory leak',
  components: ['src/session/index.ts::messages'],
});
// Now includes impulses sorted by success_rate
```

### Scenario 3: Detect Failing Patterns

**Problem**: Activity works 80% of the time, fails on 20%

**Solution**: Learning system clusters failures by characteristics

```typescript
// RPC API identifies failure clusters
const failureClusters = await analyzeClusters('add-feature-complete');
// Returns: [
//   {
//     cluster: 'Complex async operations',
//     failure_rate: 0.4,
//     examples: [
//       { checkpoint: 'cp_execute', reason: 'Race condition in async' }
//     ],
//     recommendation: 'Add explicit await points checkpoint'
//   }
// ]

// Create variant activity for async-heavy features
const asyncVariant = createVariant('add-feature-complete-async', {
  base_activity: 'add-feature-complete',
  modifications: [
    { checkpoint: 'cp_execute', add_assertion: 'async_properly_sequenced' }
  ],
});
```

---

## Learning Flow Complete Example

### Step 1: Get Activity Recommendation

```typescript
// Agent needs to add a feature
const recommendation = await getRec('add feature to user dashboard');

// Learning system recommends "add-feature-complete" activity
// (based on past success with similar tasks)
```

### Step 2: Execute with Debugging

```typescript
const executor = new ActivityExecutionDebugger(
  recommendation.impression_id,
  recommendation.recommended_activity
);

// Execute all 6 phases with full debugging
const result = await executeActivity(executor, recommendation.context_impulses);
executor.finalize();
const diagnostic = executor.getDiagnostic();
```

### Step 3: Send Feedback

```typescript
// Record success/failure
await recordFeedback(recommendation.impression_id, {
  outcome: diagnostic.failures.length === 0 ? 'success' : 'failure',
  metrics: {
    duration: diagnostic.duration,
    checkpoints: diagnostic.checkpoints.length,
    assertions_passed: countPassedAssertions(diagnostic),
  },
  diagnostic: diagnostic, // Full diagnostic for analysis
});
```

### Step 4: Learning System Updates (Background)

```
Celery Beat (every 15 minutes):
1. Load feedback since last update
2. Update Thompson Sampling parameters
   - Success: alpha++, beta unchanged
   - Failure: alpha unchanged, beta++
3. Recalculate activity probabilities
4. Update context impulse associations
5. Identify failure patterns
6. Suggest activity template improvements
7. Store analytics (visible to humans only)
```

### Step 5: Next Execution Better

```typescript
// Next time agent needs similar task:
const recommendation2 = await getRec('add feature to settings panel');

// Learning system now recommends based on:
// - Historical success with add-feature-complete (learned from last time)
// - Optimal context impulses (learned from feedback)
// - Confidence score from Thompson Sampling (learned parameter)
// → Same activity more likely to succeed
```

---

## Monitoring & Analytics

### Human-Facing Dashboard (Internal Only)

```typescript
// Visible to humans, NOT to agents
const analytics = {
  activity_performance: {
    'add-feature-complete': {
      impressions: 127,
      conversions: 107,
      success_rate: 0.843,
      thompson_alpha: 108,
      thompson_beta: 20,
    },
    'fix-bug-complete': {
      impressions: 89,
      conversions: 53,
      success_rate: 0.596,
      thompson_alpha: 54,
      thompson_beta: 35,
    },
  },
  
  context_effectiveness: {
    'memory_leak_pattern': {
      success_with: 23,
      failure_with: 2,
      weight: 0.92,
    },
  },
  
  failure_patterns: [
    {
      activity: 'fix-bug-complete',
      pattern: 'Low test coverage',
      cases: 12,
      recommendation: 'Add edge case testing checkpoint',
    },
  ],
};
```

### Diagnostic Storage (SurrealDB)

```sql
-- Store all diagnostics for analysis
CREATE activity_execution_diagnostics {
  impression_id: 'imp_abc123',
  activity_id: 'fix-bug-complete',
  activity_type: 'bugfix',
  start_time: 2026-01-30T10:15:00Z,
  end_time: 2026-01-30T10:22:30Z,
  duration_ms: 450000,
  
  phases: [
    { phase: 'INITIALIZATION', checkpoints: 2, status: 'SUCCESS' },
    { phase: 'EXECUTION', checkpoints: 5, status: 'SUCCESS' },
    { phase: 'VALIDATION', checkpoints: 3, status: 'SUCCESS' },
  ],
  
  checkpoints: [...full checkpoint data...],
  assertions: [...all assertions...],
  failures: [],
  root_cause: null,
  
  outcome: 'success',
  metrics: { duration: 450000, coverage: 85 },
};
```

---

## Implementation Roadmap

### Week 1: Integration Foundation
- [ ] Add feedback endpoint to RPC API
- [ ] Store diagnostics in SurrealDB
- [ ] Create LearningActivityExecutor class
- [ ] Map diagnostic → feedback schema

### Week 2: Learning Flow
- [ ] Connect activity execution to feedback
- [ ] Thompson Sampling parameter updates
- [ ] Association weight updates
- [ ] Test end-to-end flow

### Week 3: Quality Gates
- [ ] Implement validation gates using diagnostics
- [ ] Pre-commit checks (no failures allowed)
- [ ] Performance thresholds
- [ ] Root cause analysis for blockers

### Week 4: Monitoring
- [ ] Diagnostic storage in SurrealDB
- [ ] Analytics dashboard (internal only)
- [ ] Failure pattern detection
- [ ] Activity improvement recommendations

### Week 5: Evolution
- [ ] Auto-update activity templates
- [ ] Create activity variants
- [ ] Learn optimal context for tasks
- [ ] Continuous improvement cycle

---

## Key Principles

### 1. Transparency Without Bias
- ✅ Agents see: What to do (activity) + Context (impulses)
- ❌ Agents see: Scores, probabilities, or reasoning
- ✅ Humans see: Analytics (internal dashboard only)

### 2. Debugging as Learning Data
- Every diagnostic becomes a training signal
- Failures are opportunities to improve
- Success patterns are captured for reuse

### 3. Continuous Evolution
- Activities improve based on real execution data
- Context selection learns what helps
- Templates adapt to common failure patterns

### 4. Zero Bias
- Double-blind assignment prevents gaming
- Thompson Sampling handles exploration
- No visible metrics to optimize for

---

## Success Metrics

### After 100 Activity Executions

- **Activity Success Rate**: 85%+ (vs 60% baseline)
- **First-Attempt Success**: 80%+ (vs 50% baseline)
- **Average Duration**: Stable or improving
- **Root Causes Identified**: 100% of failures
- **Learning Velocity**: Activities improving each week

### Business Impact

- **Fewer Retries**: 50% fewer failed attempts
- **Less Manual Work**: 30% reduction in debugging time
- **Better Context**: Optimal impulses selected automatically
- **Continuous Improvement**: System learns from every execution

---

## Conclusion

The Activity Execution Debugger provides the foundation for a self-improving system:

1. **Execution** produces diagnostic data (checkpoints, assertions, metrics)
2. **Feedback** converts diagnostics into learning signals
3. **Thompson Sampling** decides which activities work
4. **Continuous Updates** improve recommendations over time
5. **Analytics** show humans what's working

**Result**: Activities automatically improve based on real execution data, without biasing agent decisions.

---

## Next Steps

1. **Review Integration**: Ensure logging and feedback match learning schema
2. **Implement Connector**: Create bridge from executor to learning system
3. **Test End-to-End**: Verify diagnostic → feedback → parameter update flow
4. **Deploy Monitoring**: Setup dashboard for human analytics
5. **Start Learning**: Execute activities and collect diagnostic data

**Expected Timeline**: 4-5 weeks to production

