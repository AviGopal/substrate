# Activity Execution Debugging System - Complete Guide

## Overview

The **Activity Execution Debugging System** provides transparent, step-by-step visibility into activity execution with instant failure diagnosis. It makes failure causes immediately apparent through:

- **Phase-based Execution Tracking** - Track each phase of execution
- **Checkpoint System** - Named checkpoints with assertions
- **Automatic Root Cause Analysis** - Identify why things failed
- **Comprehensive Reporting** - Text and JSON reports
- **Real-time Event Monitoring** - Subscribe to execution events

## Quick Start

### 1. Import and Initialize

```typescript
import ActivityExecutionDebugger, {
  ExecutionPhase,
  ExecutionState,
} from './lib/activity-execution-debugger';

const debugger = new ActivityExecutionDebugger(
  'act_12345',    // Activity ID
  'feature',      // Activity type
  './.debug'      // Output directory
);
```

### 2. Wrap Execution in Phases

```typescript
// Phase 1: Initialization
debugger.enterPhase(ExecutionPhase.INITIALIZATION, 'Setup');
try {
  // Initialization code
  debugger.checkpoint('cp_init', 'Verify prerequisites')
    .assert('env_ready', true, environmentReady)
    .complete(ExecutionState.SUCCESS);
} catch (error) {
  // Handle error
} finally {
  debugger.exitPhase(ExecutionState.SUCCESS);
}

// Phase 2: Execution
debugger.enterPhase(ExecutionPhase.EXECUTION, 'Execute tasks');
try {
  // Execution code
} finally {
  debugger.exitPhase(ExecutionState.SUCCESS);
}
```

### 3. Finalize and Get Results

```typescript
debugger.finalize();

// Check if successful
if (debugger.isSuccessful()) {
  console.log('✅ Execution successful!');
} else {
  console.log('❌ Execution failed!');
  console.log(debugger.generateReport());
  debugger.saveReport('text');
  debugger.saveReport('json');
}
```

## Architecture

### Execution Phases

Activities flow through distinct phases:

```
INITIALIZATION
    ↓
DISCOVERY
    ↓
PLANNING
    ↓
EXECUTION
    ↓
VALIDATION
    ↓
COMPLETION
    ↓
[ERROR_RECOVERY if needed]
```

### Execution States

Each step has a state:

- **PENDING** - Not started
- **IN_PROGRESS** - Currently running
- **SUCCESS** - Completed successfully
- **WARNING** - Completed with warnings
- **FAILED** - Failed
- **SKIPPED** - Skipped

### Checkpoint Structure

```typescript
ActivityCheckpoint {
  id: string;                    // Unique identifier
  timestamp: number;             // When checkpoint was created
  phase: ExecutionPhase;         // Which phase it belongs to
  description: string;           // Human-readable description
  state: ExecutionState;         // Current state
  assertions: CheckpointAssertion[];  // Validation results
  metrics?: Record<string, number | string | boolean>;  // Performance metrics
}
```

### Root Cause Analysis

When execution fails, the system automatically analyzes:

```typescript
RootCauseAnalysis {
  failurePoint: string;           // Where it failed
  immediateReason: string;        // Why it failed
  contributingFactors: string[];  // What led to the failure
  preventionStrategies: string[]; // How to prevent it
  diagnosticCommands: string[];   // What to run to debug
  timeline: TimelineEvent[];      // Chronological sequence
}
```

## Core Concepts

### 1. Phases (High-Level Structure)

Phases represent major stages of execution:

```typescript
debugger.enterPhase(ExecutionPhase.DISCOVERY, 'Searching for templates');
// ... do discovery work ...
debugger.exitPhase(ExecutionState.SUCCESS);
```

**When to use:**
- Starting a major stage of execution
- Transitioning between logical steps
- Grouping related work

### 2. Checkpoints (Validation Points)

Checkpoints are named points where assertions are validated:

```typescript
const checkpoint = debugger.checkpoint(
  'cp_discovery',
  'Verify templates discovered'
);

checkpoint
  .assert('templates_found', true, templates.length > 0)
  .assert('correct_type', 'feature', templates[0].type)
  .metrics({
    'template_count': templates.length,
    'discovery_time_ms': 1234,
  })
  .complete(ExecutionState.SUCCESS);
```

**When to use:**
- After significant work is complete
- Before major transitions
- When validating preconditions
- When recording metrics

### 3. Assertions (Validation Rules)

Assertions validate that expected conditions are met:

```typescript
// Assert equality
debugger.assert('name', expectedValue, actualValue, 'reason');

// Assert truthiness
debugger.assertTrue('condition', value === true, 'reason');

// Assert inequality
debugger.assertNotEqual('name', unexpectedValue, actualValue, 'reason');
```

**When to use:**
- Validating output
- Checking preconditions
- Verifying side effects
- Confirming state changes

### 4. Metrics (Measurement Points)

Record quantitative data about execution:

```typescript
checkpoint.metrics({
  'execution_time_ms': 1234,
  'memory_used_mb': 256,
  'files_processed': 42,
  'success_rate': 0.98,
});
```

**When to use:**
- Recording performance data
- Tracking resource usage
- Counting operations
- Measuring efficiency

### 5. Timed Operations (Performance Tracking)

Track duration of async operations with optional thresholds:

```typescript
await debugger.timeOperation(
  'template_execution',
  async () => {
    return await executeTemplate(template);
  },
  5000  // Warn if exceeds 5 seconds
);
```

**When to use:**
- Long-running operations
- Performance-critical sections
- Finding bottlenecks
- Tracking total execution time

## Usage Patterns

### Pattern 1: Simple Linear Flow

```typescript
const debugger = new ActivityExecutionDebugger('act_1', 'feature');

debugger.enterPhase(ExecutionPhase.INITIALIZATION);
const cp1 = debugger.checkpoint('cp_init', 'Initialize');
debugger.assertTrue('ready', isReady);
cp1.complete(ExecutionState.SUCCESS);
debugger.exitPhase(ExecutionState.SUCCESS);

debugger.enterPhase(ExecutionPhase.EXECUTION);
const cp2 = debugger.checkpoint('cp_exec', 'Execute');
const result = await doWork();
debugger.assertTrue('success', result.success);
cp2.complete(ExecutionState.SUCCESS);
debugger.exitPhase(ExecutionState.SUCCESS);

debugger.finalize();
console.log(debugger.generateReport());
```

### Pattern 2: With Error Handling

```typescript
const debugger = new ActivityExecutionDebugger('act_2', 'feature');

try {
  debugger.enterPhase(ExecutionPhase.EXECUTION);
  // ... execution code ...
  debugger.exitPhase(ExecutionState.SUCCESS);
} catch (error) {
  debugger.exitPhase(ExecutionState.FAILED);
  
  debugger.enterPhase(ExecutionPhase.ERROR_RECOVERY);
  // ... recovery code ...
  debugger.exitPhase(ExecutionState.SUCCESS);
} finally {
  debugger.finalize();
  console.error(debugger.generateReport());
}
```

### Pattern 3: With Task Loop

```typescript
const debugger = new ActivityExecutionDebugger('act_3', 'feature');

debugger.enterPhase(ExecutionPhase.EXECUTION, 'Execute tasks');

for (const task of tasks) {
  const cp = debugger.checkpoint(`cp_${task.id}`, `Execute: ${task.name}`);
  
  const startTime = Date.now();
  try {
    const result = await executeTask(task);
    const duration = Date.now() - startTime;
    
    debugger.assertTrue(`${task.id}_success`, result.success);
    cp.metrics({ 'duration_ms': duration }).complete(ExecutionState.SUCCESS);
  } catch (error) {
    cp.complete(ExecutionState.FAILED);
    throw error;
  }
}

debugger.exitPhase(ExecutionState.SUCCESS);
debugger.finalize();
```

### Pattern 4: With Custom Validators

```typescript
const debugger = new ActivityExecutionDebugger('act_4', 'feature');

debugger.registerValidator('cp_quality', (checkpoint) => {
  const coverage = checkpoint.metrics?.['coverage'] as number;
  if (coverage < 80) {
    throw new Error(`Coverage ${coverage}% is below 80%`);
  }
});

const cp = debugger.checkpoint('cp_quality', 'Check quality');
cp.metrics({ 'coverage': 85 });
cp.complete(ExecutionState.SUCCESS);

debugger.finalize();
```

## Real-World Example: Feature Activity

```typescript
async function executeFeatureActivity(
  templateId: string,
  variables: Record<string, string>
) {
  const debugger = new ActivityExecutionDebugger(
    `act_${Date.now()}`,
    'feature'
  );

  try {
    // ===== INITIALIZATION =====
    debugger.enterPhase(ExecutionPhase.INITIALIZATION, 'Setup environment');
    
    const cp_init = debugger.checkpoint('cp_init', 'Verify prerequisites');
    const env = await loadEnvironment();
    const template = await loadTemplate(templateId);
    
    debugger
      .assertTrue('env_loaded', env != null)
      .assertTrue('template_loaded', template != null)
      .assertTrue('template_valid', template?.tasks?.length > 0);
    
    cp_init.metrics({
      'env_vars': Object.keys(env).length,
      'template_tasks': template.tasks.length,
    });
    cp_init.complete(ExecutionState.SUCCESS);
    debugger.exitPhase(ExecutionState.SUCCESS);

    // ===== DISCOVERY =====
    debugger.enterPhase(ExecutionPhase.DISCOVERY, 'Find related templates');
    
    const cp_discovery = debugger.checkpoint(
      'cp_discovery',
      'Search template library'
    );
    
    const startTime = Date.now();
    const similarTemplates = await debugger.timeOperation(
      'search_similar',
      () => searchActivities({ category: template.category }),
      3000
    );
    const searchDuration = Date.now() - startTime;
    
    debugger.assertTrue('patterns_found', similarTemplates.length > 0);
    
    cp_discovery.metrics({
      'similar_count': similarTemplates.length,
      'search_duration_ms': searchDuration,
    });
    cp_discovery.complete(ExecutionState.SUCCESS);
    debugger.exitPhase(ExecutionState.SUCCESS);

    // ===== PLANNING =====
    debugger.enterPhase(ExecutionPhase.PLANNING, 'Create task plan');
    
    const cp_plan = debugger.checkpoint('cp_plan', 'Build execution plan');
    
    const plan = createExecutionPlan(template, variables);
    const resolvedTasks = resolveDependencies(plan.tasks);
    
    debugger
      .assertTrue('plan_created', plan != null)
      .assertEqual('all_tasks_resolved', plan.tasks.length, resolvedTasks.length);
    
    cp_plan.metrics({
      'task_count': resolvedTasks.length,
      'dependency_count': plan.dependencies.size,
    });
    cp_plan.complete(ExecutionState.SUCCESS);
    debugger.exitPhase(ExecutionState.SUCCESS);

    // ===== EXECUTION =====
    debugger.enterPhase(ExecutionPhase.EXECUTION, 'Execute tasks');
    
    const taskResults = [];
    for (const task of resolvedTasks) {
      const cp_task = debugger.checkpoint(
        `cp_task_${task.id}`,
        `Execute: ${task.description}`
      );
      
      const taskStart = Date.now();
      const taskResult = await debugger.timeOperation(
        `task_${task.id}`,
        () => executeTask(task),
        30000
      );
      const taskDuration = Date.now() - taskStart;
      
      debugger.assertTrue(`${task.id}_success`, taskResult.success);
      
      if (taskResult.error) {
        debugger.assertEqual(`${task.id}_error`, null, taskResult.error);
      }
      
      cp_task.metrics({
        'duration_ms': taskDuration,
        'status': taskResult.success ? 'SUCCESS' : 'FAILED',
      });
      cp_task.complete(
        taskResult.success ? ExecutionState.SUCCESS : ExecutionState.FAILED
      );
      
      taskResults.push(taskResult);
    }
    
    debugger.exitPhase(ExecutionState.SUCCESS);

    // ===== VALIDATION =====
    debugger.enterPhase(ExecutionPhase.VALIDATION, 'Validate output');
    
    const cp_validation = debugger.checkpoint(
      'cp_validation',
      'Run quality checks'
    );
    
    const coverage = await getTestCoverage();
    const metabobIssues = await runMetabobChecks();
    const buildResult = await runBuild();
    
    const criticalIssues = metabobIssues.filter(i => i.severity === 'CRITICAL');
    
    debugger
      .assertTrue('build_success', buildResult.success)
      .assertEqual('no_build_errors', 0, buildResult.errors.length)
      .assertTrue('coverage_adequate', coverage >= 80, `Coverage ${coverage}% >= 80%`)
      .assertEqual('no_critical_issues', 0, criticalIssues.length);
    
    cp_validation.metrics({
      'coverage_percent': coverage,
      'critical_issues': criticalIssues.length,
      'high_issues': metabobIssues.filter(i => i.severity === 'HIGH').length,
    });
    cp_validation.complete(ExecutionState.SUCCESS);
    
    debugger.exitPhase(ExecutionState.SUCCESS);

    // ===== COMPLETION =====
    debugger.enterPhase(ExecutionPhase.COMPLETION, 'Finalize activity');
    
    const cp_completion = debugger.checkpoint('cp_completion', 'Commit changes');
    
    const commitResult = await debugger.timeOperation(
      'commit_changes',
      () => commitAllChanges(template.name),
      5000
    );
    
    debugger.assertTrue('commit_success', commitResult.success);
    
    cp_completion.metrics({
      'files_committed': commitResult.filesChanged,
      'commit_hash': commitResult.hash,
    });
    cp_completion.complete(ExecutionState.SUCCESS);
    
    debugger.exitPhase(ExecutionState.SUCCESS);

    // ===== SUCCESS =====
    debugger.finalize();
    
    console.log('\n✅ Feature activity completed successfully!\n');
    console.log(debugger.generateReport());
    
    debugger.saveReport('text');
    debugger.saveReport('json');

    return {
      success: true,
      diagnostic: debugger.getDiagnostic(),
    };

  } catch (error) {
    // ===== ERROR RECOVERY =====
    console.error('\n❌ Feature activity failed!\n');
    
    debugger.enterPhase(ExecutionPhase.ERROR_RECOVERY, 'Handle error');
    
    const cp_error = debugger.checkpoint('cp_error', 'Error recovery');
    
    // Rollback changes
    try {
      await rollbackChanges();
      cp_error.complete(ExecutionState.SUCCESS);
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
      cp_error.complete(ExecutionState.FAILED);
    }
    
    debugger.exitPhase(ExecutionState.FAILED);
    
    // Analyze and report
    debugger.finalize();
    
    console.error('\n' + debugger.generateReport());
    
    debugger.saveReport('text');
    debugger.saveReport('json');

    const rootCause = debugger.analyzeRootCause();
    if (rootCause) {
      console.error('\nROOT CAUSE ANALYSIS:');
      console.error(`  Failure Point: ${rootCause.failurePoint}`);
      console.error(`  Reason: ${rootCause.immediateReason}`);
      console.error('  Prevention Strategies:');
      rootCause.preventionStrategies.forEach(s => {
        console.error(`    - ${s}`);
      });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      diagnostic: debugger.getDiagnostic(),
      rootCause,
    };
  }
}
```

## Report Generation

### Text Report

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
Failures: 0
Warnings: 0

EXECUTION TIMELINE
────────────────────────────────────────
  ✅ [2026-01-30T06:19:23.100Z] Verify prerequisites (LOW)
  ✅ [2026-01-30T06:19:23.200Z] Search template library (MEDIUM)
  ✅ [2026-01-30T06:19:24.500Z] Build execution plan (LOW)
  ✅ [2026-01-30T06:19:24.600Z] Execute: Task 1 (HIGH)
  ✅ [2026-01-30T06:19:26.750Z] Execute: Task 2 (HIGH)
  ✅ [2026-01-30T06:19:27.100Z] Run quality checks (MEDIUM)
  ✅ [2026-01-30T06:19:38.200Z] Commit changes (LOW)

CHECKPOINTS
────────────────────────────────────────
  ✅ cp_init: Verify prerequisites
     ✅ env_loaded
     ✅ template_loaded
     ✅ template_valid
     📊 Metrics: {"env_vars":5,"template_tasks":3}

... more checkpoints ...
```

### JSON Report

Programmatic access to diagnostic data:

```json
{
  "activityId": "act_12345",
  "type": "feature",
  "startTime": 1704009563100,
  "endTime": 1704009578334,
  "duration": 15234,
  "checkpoints": [
    {
      "id": "cp_init",
      "timestamp": 1704009563100,
      "phase": "initialization",
      "description": "Verify prerequisites",
      "state": "success",
      "assertions": [
        {
          "name": "env_loaded",
          "expected": true,
          "actual": true,
          "passed": true
        }
      ],
      "metrics": {
        "env_vars": 5,
        "template_tasks": 3
      }
    }
  ],
  "failures": [],
  "warnings": [],
  "rootCause": null
}
```

## Monitoring and Events

Subscribe to execution events:

```typescript
const debugger = new ActivityExecutionDebugger(activityId, activityType);

// Phase events
debugger.on('phase_enter', ({ phase, description }) => {
  console.log(`→ ${phase}: ${description}`);
});

debugger.on('phase_exit', ({ phase, state, duration }) => {
  console.log(`← ${phase} completed in ${duration}ms`);
});

// Assertion events
debugger.on('assertion_failed', ({ assertion, checkpoint }) => {
  console.error(`Assertion failed: ${assertion.name}`);
});

// Failure events
debugger.on('failure_recorded', (failure) => {
  console.error(`Failure at checkpoint: ${failure.checkpoint}`);
});

// Warning events
debugger.on('warning_recorded', (warning) => {
  console.warn(`${warning.severity}: ${warning.message}`);
});
```

## Troubleshooting

### Report shows no checkpoints

Ensure checkpoints are created and completed:

```typescript
// ❌ Wrong - checkpoint not completed
const cp = debugger.checkpoint('cp_test', 'Test');
// Missing: cp.complete(ExecutionState.SUCCESS);

// ✅ Correct
const cp = debugger.checkpoint('cp_test', 'Test');
cp.complete(ExecutionState.SUCCESS);
```

### Assertions not recorded

Ensure assertions are called while checkpoint is active:

```typescript
// ❌ Wrong - no active checkpoint
debugger.assert('something', true, value);

// ✅ Correct
const cp = debugger.checkpoint('cp_test', 'Test');
debugger.assert('something', true, value);
```

### Root cause analysis empty

Call finalize() before accessing root cause:

```typescript
// ❌ Wrong
const rootCause = debugger.analyzeRootCause();

// ✅ Correct
debugger.finalize();
const rootCause = debugger.analyzeRootCause();
```

## Best Practices

### 1. Meaningful IDs and Descriptions

```typescript
// ❌ Bad
debugger.checkpoint('cp1', 'Step 1');

// ✅ Good
debugger.checkpoint('cp_template_discovery', 'Discover and validate templates');
```

### 2. Include Context in Assertions

```typescript
// ❌ Bad
debugger.assert('result', expected, actual);

// ✅ Good
debugger.assert(
  'output_matches_expected',
  expectedOutput,
  actualOutput,
  `Expected ${JSON.stringify(expectedOutput)} but got ${JSON.stringify(actualOutput)}`
);
```

### 3. Record Meaningful Metrics

```typescript
// ❌ Bad
debugger.recordMetrics({ value: 100 });

// ✅ Good
debugger.recordMetrics({
  'execution_time_ms': 1234,
  'files_processed': 42,
  'coverage_percent': 85,
});
```

### 4. Always Finalize

```typescript
try {
  // ... execution code ...
} finally {
  debugger.finalize();
}
```

### 5. Save Reports for Analysis

```typescript
debugger.finalize();
debugger.saveReport('text');
debugger.saveReport('json');
```

## Integration Examples

### With Activity Executor

```typescript
class DebuggedActivityExecutor {
  constructor(activityId: string, activityType: string) {
    this.debugger = new ActivityExecutionDebugger(activityId, activityType);
  }

  async executePhase(
    phase: ExecutionPhase,
    description: string,
    fn: () => Promise<void>
  ) {
    this.debugger.enterPhase(phase, description);
    try {
      await fn();
      this.debugger.exitPhase(ExecutionState.SUCCESS);
    } catch (error) {
      this.debugger.exitPhase(ExecutionState.FAILED);
      throw error;
    }
  }
}
```

### With CLI

```typescript
const program = new Command();

program
  .command('activity:execute')
  .option('--activity-id <id>')
  .option('--activity-type <type>')
  .option('--debug', 'Enable debugging')
  .action(async (options) => {
    if (options.debug) {
      const debugger = new ActivityExecutionDebugger(
        options.activityId,
        options.activityType
      );
      // ... instrumented execution ...
      debugger.saveReport('text');
      debugger.saveReport('json');
    }
  });
```

## Next Steps

1. **Integrate with Activity.execute()** - Wrap all activity executions
2. **Add to CLI** - Add `--debug` flag to commands
3. **Setup Monitoring** - Create real-time dashboard
4. **Build Analytics** - Analyze patterns across executions
5. **Create Alerts** - Alert on critical failures
