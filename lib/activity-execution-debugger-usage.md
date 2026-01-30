# Activity Execution Debugger - Usage Guide

## Overview

The **Activity Execution Debugger** provides transparent, step-by-step tracking of activity execution with instant failure diagnosis. It instruments your activity code to make failure causes immediately visible through structured logging, assertions, and root cause analysis.

## Core Concepts

### 1. **Execution Phases**
Activities move through distinct phases. The debugger tracks each phase transition and validates state changes.

```typescript
enum ExecutionPhase {
  INITIALIZATION = 'initialization',  // Setup & preparation
  DISCOVERY = 'discovery',             // Finding templates & patterns
  PLANNING = 'planning',               // Task planning
  EXECUTION = 'execution',             // Running tasks
  VALIDATION = 'validation',           // Quality checks
  COMPLETION = 'completion',           // Finalization
  ERROR_RECOVERY = 'error_recovery'    // Handling failures
}
```

### 2. **Execution States**
Every step has a clear state showing what happened.

```typescript
enum ExecutionState {
  PENDING = 'pending',      // Not started
  IN_PROGRESS = 'in_progress',  // Currently running
  SUCCESS = 'success',      // Completed successfully
  WARNING = 'warning',      // Completed with warnings
  FAILED = 'failed',        // Failed
  SKIPPED = 'skipped'       // Skipped
}
```

### 3. **Checkpoints**
Named points in execution where assertions are validated. They capture:
- State at that point
- Assertion results
- Metrics
- Context information

### 4. **Root Cause Analysis**
Automatic analysis that identifies:
- Where failure occurred
- Why it failed
- Contributing factors
- Prevention strategies
- Diagnostic commands to run

## Basic Usage

### Initialize Debugger

```typescript
import ActivityExecutionDebugger from './lib/activity-execution-debugger';

// Create debugger instance
const debugger = new ActivityExecutionDebugger(
  'act_12345',           // Activity ID
  'feature',             // Activity type
  './.debug'             // Output directory
);

// Listen for events
debugger.on('assertion_failed', (data) => {
  console.error('Assertion failed:', data);
});

debugger.on('failure_recorded', (failure) => {
  console.error('Failure recorded:', failure);
});
```

### Phase Management

```typescript
// Enter a phase
debugger.enterPhase(ExecutionPhase.DISCOVERY, 'Searching for templates');

// Do work...
const templates = await searchActivities();

// Exit phase
debugger.exitPhase(ExecutionState.SUCCESS);
```

### Checkpoint with Assertions

```typescript
// Create checkpoint with assertions
const discovery = debugger.checkpoint(
  'cp_discovery',
  'Verify templates discovered',
  ExecutionPhase.DISCOVERY
);

// Add assertions
debugger.assert('template_found', true, templates.length > 0, 'At least one template must exist');
debugger.assert('template_type', 'feature', templates[0]?.type, 'First template should be feature type');

// Record metrics
debugger.recordMetrics({
  'templates_found': templates.length,
  'discovery_time_ms': Date.now() - startTime,
});

// Complete checkpoint
discovery.complete(ExecutionState.SUCCESS);
```

### Fluent Checkpoint API

```typescript
const checkpoint = debugger.checkpoint('cp_execution', 'Execute template');

checkpoint
  .assert('task_started', true, taskStarted)
  .assert('task_completed', true, taskCompleted)
  .metrics({
    'execution_time_ms': 1234,
    'memory_peak_mb': 256,
  })
  .complete(ExecutionState.SUCCESS);
```

## Advanced Patterns

### 1. Timed Operations with Thresholds

```typescript
await debugger.timeOperation(
  'template_execution',
  async () => {
    return await executeTemplate(template);
  },
  5000  // Warn if exceeds 5 seconds
);
```

### 2. Custom Validators

```typescript
debugger.registerValidator('cp_validation', (checkpoint) => {
  if (!checkpoint.metrics?.['tests_passed']) {
    throw new Error('Tests must pass before completion');
  }

  const coverage = checkpoint.metrics['coverage_percent'] as number;
  if (coverage < 80) {
    throw new Error(`Coverage ${coverage}% is below 80% threshold`);
  }
});

const validation = debugger.checkpoint('cp_validation', 'Run validation');
// Validator will run automatically
```

### 3. Assertion Chains

```typescript
const execution = debugger.checkpoint('cp_execution', 'Execute activity');

// Chain multiple assertions
let allPassed = true;
allPassed &= debugger.assert('files_created', expectedFiles, actualFiles);
allPassed &= debugger.assert('tests_passing', true, testsPassed);
allPassed &= debugger.assert('coverage_met', true, coverageMet);
allPassed &= debugger.assert('no_errors', 0, errorCount);

execution.complete(allPassed ? ExecutionState.SUCCESS : ExecutionState.FAILED);
```

### 4. Context-Aware Assertions

```typescript
const checkpoint = debugger.checkpoint('cp_memory', 'Verify memory');

const initialMemory = process.memoryUsage().heapUsed;

// Do work...
await processLargeDataset();

const finalMemory = process.memoryUsage().heapUsed;
const increase = finalMemory - initialMemory;

debugger.assert(
  'memory_increase_reasonable',
  true,
  increase < 100 * 1024 * 1024,  // < 100MB
  `Memory increased by ${Math.round(increase / 1024 / 1024)}MB`
);
```

## Complete Example: Activity Execution

```typescript
async function executeActivityWithDebugger(
  activityId: string,
  activityType: string,
  template: ActivityTemplate
): Promise<ExecutionDiagnostic> {
  const debugger = new ActivityExecutionDebugger(activityId, activityType);

  try {
    // INITIALIZATION PHASE
    debugger.enterPhase(ExecutionPhase.INITIALIZATION, 'Setup execution environment');
    const cp_init = debugger.checkpoint('cp_init', 'Verify template');
    
    debugger.assert('template_valid', true, template != null);
    debugger.assert('template_has_tasks', true, template.tasks?.length > 0, 'Template must have tasks');
    cp_init.complete(ExecutionState.SUCCESS);
    
    debugger.exitPhase(ExecutionState.SUCCESS);

    // DISCOVERY PHASE
    debugger.enterPhase(ExecutionPhase.DISCOVERY, 'Discover templates and patterns');
    const cp_discovery = debugger.checkpoint('cp_discovery', 'Search for similar patterns');
    
    const templates = await debugger.timeOperation(
      'search_templates',
      () => searchActivities({ type: template.category }),
      3000
    );
    
    debugger.assert('patterns_found', true, templates.length > 0);
    cp_discovery.metrics({ 'pattern_count': templates.length });
    cp_discovery.complete(ExecutionState.SUCCESS);
    
    debugger.exitPhase(ExecutionState.SUCCESS);

    // PLANNING PHASE
    debugger.enterPhase(ExecutionPhase.PLANNING, 'Plan execution sequence');
    const cp_planning = debugger.checkpoint('cp_planning', 'Create execution plan');
    
    const plan = createExecutionPlan(template);
    debugger.assert('plan_created', true, plan != null);
    debugger.assert('tasks_sequenced', true, plan.tasks.length === template.tasks?.length);
    
    cp_planning.metrics({
      'task_count': plan.tasks.length,
      'dependencies': plan.dependencies.size,
    });
    cp_planning.complete(ExecutionState.SUCCESS);
    
    debugger.exitPhase(ExecutionState.SUCCESS);

    // EXECUTION PHASE
    debugger.enterPhase(ExecutionPhase.EXECUTION, 'Execute tasks');
    
    for (const task of plan.tasks) {
      const cp_task = debugger.checkpoint(
        `cp_task_${task.id}`,
        `Execute task: ${task.description}`
      );

      const startTime = Date.now();
      const result = await executeTask(task);
      const duration = Date.now() - startTime;

      debugger.assert(`task_${task.id}_success`, true, result.success);
      debugger.assert(`task_${task.id}_no_errors`, 0, result.errors?.length || 0);
      
      cp_task.metrics({
        'duration_ms': duration,
        'status': result.success ? 'SUCCESS' : 'FAILED',
        'error_count': result.errors?.length || 0,
      });

      if (result.success) {
        cp_task.complete(ExecutionState.SUCCESS);
      } else {
        cp_task.complete(ExecutionState.FAILED);
        throw new Error(`Task ${task.id} failed: ${result.errors?.join(', ')}`);
      }
    }
    
    debugger.exitPhase(ExecutionState.SUCCESS);

    // VALIDATION PHASE
    debugger.enterPhase(ExecutionPhase.VALIDATION, 'Validate activity output');
    const cp_validation = debugger.checkpoint('cp_validation', 'Run quality checks');
    
    const coverage = await runTestCoverage();
    const issues = await runMetabobChecks();
    const buildResult = await runBuild();

    debugger.assert('build_success', true, buildResult.success);
    debugger.assert('tests_passing', 0, buildResult.failedTests.length);
    debugger.assert('coverage_threshold', true, coverage >= 80, `Coverage ${coverage}% >= 80%`);
    debugger.assert('no_critical_issues', 0, issues.filter(i => i.severity === 'CRITICAL').length);

    cp_validation.metrics({
      'test_coverage': coverage,
      'critical_issues': issues.filter(i => i.severity === 'CRITICAL').length,
      'high_issues': issues.filter(i => i.severity === 'HIGH').length,
    });
    
    cp_validation.complete(ExecutionState.SUCCESS);
    debugger.exitPhase(ExecutionState.SUCCESS);

    // COMPLETION PHASE
    debugger.enterPhase(ExecutionPhase.COMPLETION, 'Finalize activity');
    const cp_completion = debugger.checkpoint('cp_completion', 'Commit changes');
    
    const commitResult = await commitChanges();
    debugger.assert('commit_created', true, commitResult.success);
    
    cp_completion.metrics({
      'files_changed': commitResult.filesChanged,
      'commit_hash': commitResult.hash,
    });
    cp_completion.complete(ExecutionState.SUCCESS);
    
    debugger.exitPhase(ExecutionState.SUCCESS);

    // Success!
    debugger.finalize();
    return debugger.getDiagnostic();

  } catch (error) {
    // ERROR RECOVERY PHASE
    debugger.enterPhase(ExecutionPhase.ERROR_RECOVERY, 'Handle failure');
    
    const cp_error = debugger.checkpoint('cp_error', 'Error recovery');
    
    console.error('Activity execution failed:', error);
    debugger.assert('error_handled', false, true, error instanceof Error ? error.message : String(error));
    
    cp_error.complete(ExecutionState.FAILED);
    debugger.exitPhase(ExecutionState.FAILED);

    // Analyze root cause
    debugger.finalize();
    const diagnostic = debugger.getDiagnostic();
    const rootCause = debugger.analyzeRootCause();

    // Print report
    console.error('\n' + debugger.generateReport());

    // Save diagnostic
    debugger.saveReport('text');
    debugger.saveReport('json');

    throw error;
  }
}
```

## Reporting

### Text Report

```typescript
const report = debugger.generateReport();
console.log(report);

// Or save to file
debugger.saveReport('text');
// → .debug/activity-act_12345-2026-01-30T06-19-23-000Z.txt
```

### JSON Report

```typescript
const json = debugger.exportJSON();
debugger.saveReport('json');
// → .debug/activity-act_12345-2026-01-30T06-19-23-000Z.json
```

### Root Cause Analysis

```typescript
debugger.finalize();

const rootCause = debugger.analyzeRootCause();
if (rootCause) {
  console.log('Root Cause Analysis:');
  console.log('  Failure Point:', rootCause.failurePoint);
  console.log('  Immediate Reason:', rootCause.immediateReason);
  console.log('  Contributing Factors:', rootCause.contributingFactors);
  console.log('  Prevention Strategies:', rootCause.preventionStrategies);
  console.log('  Diagnostic Commands:', rootCause.diagnosticCommands);
}
```

## Example Report Output

```
════════════════════════════════════════════════════════════════════════════════
ACTIVITY EXECUTION DIAGNOSTIC REPORT
════════════════════════════════════════════════════════════════════════════════

SUMMARY
────────────────────────────────────────
Activity ID: act_12345
Type: feature
Start Time: 2026-01-30T06:19:23.000Z
Duration: 15234ms
Checkpoints: 7
Failures: 1
Warnings: 2

EXECUTION TIMELINE
────────────────────────────────────────
  ✅ [2026-01-30T06:19:23.100Z] Verify template (LOW)
  ✅ [2026-01-30T06:19:23.200Z] Search for similar patterns (MEDIUM)
  ✅ [2026-01-30T06:19:24.500Z] Create execution plan (LOW)
  ⏳ [2026-01-30T06:19:24.600Z] Execute task: Implement feature (MEDIUM)
  ❌ [2026-01-30T06:19:26.750Z] Failure: cp_task_impl_1 (CRITICAL)
  ✅ [2026-01-30T06:19:27.100Z] Run quality checks (HIGH)
  ✅ [2026-01-30T06:19:38.200Z] Commit changes (LOW)

CHECKPOINTS
────────────────────────────────────────
  ✅ cp_init: Verify template
     ✅ template_valid
     ✅ template_has_tasks
     📊 Metrics: {"init_time_ms":100}

  ✅ cp_discovery: Search for similar patterns
     ✅ patterns_found
     📊 Metrics: {"pattern_count":3,"discovery_time_ms":1400}

  ✅ cp_planning: Create execution plan
     ✅ plan_created
     ✅ tasks_sequenced
     📊 Metrics: {"task_count":3,"dependencies":2}

  ❌ cp_task_impl_1: Execute task: Implement feature
     ❌ task_impl_1_success
        Expected: true
        Actual: false
        Reason: Task execution failed
     📊 Metrics: {"duration_ms":2150,"status":"FAILED","error_count":1}

FAILURES
────────────────────────────────────────
  ❌ cp_task_impl_1 (Phase: execution)
     Assertion: task_impl_1_success
     Reason: Task execution failed
     Context: {
       "currentPhase": "execution",
       "checkpointStack": ["cp_init", "cp_discovery", "cp_planning", "cp_task_impl_1"],
       "timestamp": "2026-01-30T06:19:26.750Z",
       "error": "Cannot find file: src/feature.ts"
     }

ROOT CAUSE ANALYSIS
────────────────────────────────────────
Failure Point: cp_task_impl_1
Immediate Reason: Task execution failed

Contributing Factors:
  • File system issue: src/feature.ts not found
  • No pre-execution file validation

Prevention Strategies:
  • Add file existence check before task execution
  • Validate file paths in planning phase
  • Implement file creation if missing

Diagnostic Commands:
  $ npm run debug:activity:files
  $ npm run debug:activity:fs

════════════════════════════════════════════════════════════════════════════════
```

## Integration with Activity System

### Integrate with Activity.execute()

```typescript
// In activity.ts
export async function executeWithDiagnostics(
  activityId: string,
  template: ActivityTemplate,
  variables: Record<string, any>
): Promise<ActivityResult> {
  const debugger = new ActivityExecutionDebugger(
    activityId,
    template.category || 'unknown'
  );

  try {
    debugger.enterPhase(ExecutionPhase.INITIALIZATION);
    // ... execution code ...
    debugger.exitPhase(ExecutionState.SUCCESS);

    debugger.finalize();
    return { success: true, activityId };
  } catch (error) {
    debugger.finalize();
    console.error(debugger.generateReport());
    debugger.saveReport('text');
    throw error;
  }
}
```

### CLI Integration

```bash
# Run with debugging enabled
npm run activity:execute -- \
  --activity-id act_12345 \
  --debug \
  --debug-output .debug

# Show report
cat .debug/activity-act_12345-*.txt

# JSON format for parsing
cat .debug/activity-act_12345-*.json | jq '.rootCause'
```

## Monitoring and Events

```typescript
const debugger = new ActivityExecutionDebugger(activityId, activityType);

// Monitor assertion failures
debugger.on('assertion_failed', ({ assertion, checkpoint }) => {
  console.error(`Assertion failed at ${checkpoint.id}: ${assertion.name}`);
});

// Monitor phase transitions
debugger.on('phase_enter', ({ phase, description }) => {
  console.log(`→ Entering ${phase}: ${description}`);
});

debugger.on('phase_exit', ({ phase, state, duration }) => {
  console.log(`← Exiting ${phase} (${duration}ms): ${state}`);
});

// Monitor failures
debugger.on('failure_recorded', (failure) => {
  console.error(`Failure recorded at ${failure.checkpoint}`);
});

// Monitor warnings
debugger.on('warning_recorded', (warning) => {
  console.warn(`Warning: ${warning.message}`);
});
```

## Best Practices

### 1. Use Meaningful Checkpoint IDs

```typescript
// ❌ Bad
debugger.checkpoint('cp1', 'Step 1');

// ✅ Good
debugger.checkpoint('cp_template_discovery', 'Discover and validate templates');
```

### 2. Include Context in Assertions

```typescript
// ❌ Bad
debugger.assert('files_match', expected, actual);

// ✅ Good
debugger.assert(
  'modified_files_match_expected',
  expectedFiles,
  actualFiles,
  `Expected ${expectedFiles.length} files but got ${actualFiles.length}`
);
```

### 3. Record Meaningful Metrics

```typescript
// ❌ Bad
debugger.recordMetrics({ value: 100 });

// ✅ Good
debugger.recordMetrics({
  'test_count': testCount,
  'test_coverage_percent': coveragePercent,
  'execution_time_ms': executionTime,
  'memory_peak_mb': memoryPeak,
});
```

### 4. Finalize Before Exiting

```typescript
// Always finalize to capture end time and analyze root causes
try {
  // ... execution ...
} finally {
  debugger.finalize();
}
```

### 5. Save Reports for Analysis

```typescript
debugger.finalize();

// Always save for troubleshooting
debugger.saveReport('text');
debugger.saveReport('json');

// Print to console for immediate feedback
console.log(debugger.generateReport());
```

## Troubleshooting

### Report shows "no failures" but execution failed

Check that you're properly marking checkpoint state:

```typescript
// ❌ Wrong
const cp = debugger.checkpoint('cp_test', 'Test execution');
// Missing complete() call

// ✅ Correct
const cp = debugger.checkpoint('cp_test', 'Test execution');
cp.complete(ExecutionState.FAILED);
```

### Assertions not being recorded

Ensure checkpoint is active when calling assert:

```typescript
// ❌ Wrong - no active checkpoint
debugger.assert('something', true, value);

// ✅ Correct - checkpoint is active
const cp = debugger.checkpoint('cp_test', 'Test');
debugger.assert('something', true, value);
```

### Root cause analysis is empty

Make sure to call finalize after all execution:

```typescript
// ❌ Wrong
const diagnostic = debugger.getDiagnostic();

// ✅ Correct
debugger.finalize();
const diagnostic = debugger.getDiagnostic();
const rootCause = diagnostic.rootCause;
```

## Next Steps

1. **Integrate with Activity.execute()** - Wrap all activity executions
2. **Add to CLI** - Add `--debug` flag to activity commands
3. **Setup Monitoring** - Create dashboard for real-time execution tracking
4. **Build Alerting** - Alert on critical failures
5. **Create Analysis Tools** - Parse reports and identify patterns
