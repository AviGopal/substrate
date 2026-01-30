# Activity Execution Debugging - Quick Reference

## One-Minute Overview

```typescript
// Create debugger
const debugger = new ActivityExecutionDebugger('act_id', 'feature');

// Track phases
debugger.enterPhase(ExecutionPhase.EXECUTION);
  // ... do work ...
debugger.exitPhase(ExecutionState.SUCCESS);

// Validate with checkpoints
const cp = debugger.checkpoint('cp_id', 'Validate something');
debugger.assert('condition_name', expected, actual, 'reason');
cp.complete(ExecutionState.SUCCESS);

// Finalize and report
debugger.finalize();
console.log(debugger.generateReport());
debugger.saveReport('text');
debugger.saveReport('json');
```

## Execution Phases

| Phase | Purpose | When to Use |
|-------|---------|------------|
| `INITIALIZATION` | Setup & validation | Start of activity |
| `DISCOVERY` | Find templates/patterns | Before planning |
| `PLANNING` | Create task plan | Before execution |
| `EXECUTION` | Run tasks | Main work |
| `VALIDATION` | Quality checks | After execution |
| `COMPLETION` | Finalize (commit, etc) | Before ending |
| `ERROR_RECOVERY` | Handle errors | On failure |

## Execution States

| State | Meaning | Symbol |
|-------|---------|--------|
| `PENDING` | Not started | ⏹️ |
| `IN_PROGRESS` | Running | ⏳ |
| `SUCCESS` | Completed OK | ✅ |
| `WARNING` | Completed with warnings | ⚠️ |
| `FAILED` | Failed | ❌ |
| `SKIPPED` | Skipped | ⊘ |

## Common Patterns

### Pattern 1: Simple Execution
```typescript
const debug = new ActivityExecutionDebugger('act_1', 'feature');

debug.enterPhase(ExecutionPhase.EXECUTION);
const cp = debug.checkpoint('cp_work', 'Do work');
const result = await doWork();
debug.assertTrue('success', result.success);
cp.complete(ExecutionState.SUCCESS);
debug.exitPhase(ExecutionState.SUCCESS);

debug.finalize();
console.log(debug.generateReport());
```

### Pattern 2: Task Loop
```typescript
for (const task of tasks) {
  const cp = debug.checkpoint(`cp_${task.id}`, task.name);
  const result = await executeTask(task);
  debug.assertTrue(`${task.id}_ok`, result.success);
  cp.metrics({ duration_ms: Date.now() - start });
  cp.complete(result.success ? ExecutionState.SUCCESS : ExecutionState.FAILED);
}
```

### Pattern 3: Error Handling
```typescript
try {
  // ... execution ...
} catch (error) {
  debug.enterPhase(ExecutionPhase.ERROR_RECOVERY);
  // ... recovery ...
  debug.exitPhase(ExecutionState.SUCCESS);
} finally {
  debug.finalize();
}
```

### Pattern 4: Multiple Phases
```typescript
// Init
debug.enterPhase(ExecutionPhase.INITIALIZATION);
// ... setup ...
debug.exitPhase(ExecutionState.SUCCESS);

// Execute
debug.enterPhase(ExecutionPhase.EXECUTION);
// ... work ...
debug.exitPhase(ExecutionState.SUCCESS);

// Validate
debug.enterPhase(ExecutionPhase.VALIDATION);
// ... checks ...
debug.exitPhase(ExecutionState.SUCCESS);

// Complete
debug.enterPhase(ExecutionPhase.COMPLETION);
// ... finalize ...
debug.exitPhase(ExecutionState.SUCCESS);

debug.finalize();
```

## Assertion Methods

```typescript
// Assert equality
debug.assert('name', expected, actual, 'reason');

// Assert truthiness
debug.assertTrue('name', condition, 'reason');

// Assert inequality
debug.assertNotEqual('name', unexpected, actual, 'reason');

// Assert equals (shorthand)
debug.assertEqual('name', expected, actual, 'reason');
```

## Checkpoint API

```typescript
const cp = debug.checkpoint('cp_id', 'description');

// Chain assertions
cp.assert('condition', expected, actual)
  .metrics({ duration_ms: 100, count: 5 })
  .complete(ExecutionState.SUCCESS);

// Or use separate calls
debug.assert('condition1', true, value1);
debug.assert('condition2', 'string', value2);
cp.metrics({ time: 100 });
cp.complete(ExecutionState.SUCCESS);
```

## Recording Metrics

```typescript
// Simple metrics
cp.metrics({
  'execution_time_ms': 1234,
  'memory_used_mb': 256,
  'files_processed': 42,
  'success_rate': 0.98,
});

// Or via assert context
debug.recordMetrics({
  'metric_name': value,
});
```

## Timed Operations

```typescript
// Time operation with optional threshold
await debug.timeOperation(
  'operation_name',
  async () => {
    return await doSomething();
  },
  5000  // Warn if exceeds 5 seconds
);
```

## Getting Results

```typescript
debug.finalize();

// Get diagnostic data
const diagnostic = debug.getDiagnostic();
// {
//   activityId: 'act_id',
//   type: 'feature',
//   duration: 15234,
//   checkpoints: [...],
//   failures: [...],
//   rootCause: {...}
// }

// Get root cause if failed
const rootCause = debug.analyzeRootCause();
// {
//   failurePoint: 'cp_id',
//   immediateReason: 'Assertion failed',
//   contributingFactors: [...],
//   preventionStrategies: [...],
//   diagnosticCommands: [...]
// }

// Check if successful
const ok = debug.isSuccessful();

// Get failures
const failures = debug.getFailures();

// Generate report
const report = debug.generateReport();
const json = debug.exportJSON();

// Save report
debug.saveReport('text');   // .debug/activity-act_id-timestamp.txt
debug.saveReport('json');   // .debug/activity-act_id-timestamp.json
```

## Events

```typescript
debug.on('phase_enter', ({ phase, description }) => {});
debug.on('phase_exit', ({ phase, state, duration }) => {});
debug.on('assertion_failed', ({ assertion, checkpoint }) => {});
debug.on('failure_recorded', (failure) => {});
debug.on('warning_recorded', (warning) => {});
```

## Root Cause Analysis

When execution fails, automatically identifies:

```typescript
debug.finalize();
const rca = debug.analyzeRootCause();

if (rca) {
  console.log('Failure Point:', rca.failurePoint);
  console.log('Reason:', rca.immediateReason);
  console.log('Contributing Factors:', rca.contributingFactors);
  console.log('Prevention Strategies:', rca.preventionStrategies);
  console.log('Diagnostic Commands:', rca.diagnosticCommands);
}
```

## Report Output

### Text Report Structure
```
SUMMARY
  - Activity ID, Type, Duration
  - Checkpoint count, Failure count, Warning count

EXECUTION TIMELINE
  - Chronological events with timestamps and significance

CHECKPOINTS
  - Each checkpoint with:
    - State (✅/❌/⚠️)
    - Assertions and results
    - Metrics

FAILURES
  - Detailed failure information
  - Context and stack traces

ROOT CAUSE ANALYSIS (if failures)
  - Failure point
  - Immediate reason
  - Contributing factors
  - Prevention strategies
  - Diagnostic commands
```

### JSON Report Structure
```json
{
  "activityId": "...",
  "type": "...",
  "startTime": 0,
  "endTime": 0,
  "duration": 0,
  "checkpoints": [...],
  "failures": [...],
  "warnings": [...],
  "rootCause": {
    "failurePoint": "...",
    "immediateReason": "...",
    "contributingFactors": [...],
    "preventionStrategies": [...],
    "timeline": [...]
  }
}
```

## Integration with Activity System

### In Activity.execute()
```typescript
export async function executeWithDebugging(
  activityId: string,
  template: ActivityTemplate
) {
  const debug = new ActivityExecutionDebugger(activityId, template.type);

  try {
    // Instrumented execution
    debug.enterPhase(ExecutionPhase.EXECUTION);
    // ... actual execution code ...
    debug.exitPhase(ExecutionState.SUCCESS);

    debug.finalize();
    return { success: true, diagnostic: debug.getDiagnostic() };
  } catch (error) {
    debug.finalize();
    console.error(debug.generateReport());
    debug.saveReport('text');
    throw error;
  }
}
```

### In CLI
```bash
# Run with debugging
npm run activity:execute -- --activity-id act_12345 --debug

# View report
cat .debug/activity-act_12345-*.txt

# View JSON
cat .debug/activity-act_12345-*.json | jq '.rootCause'
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No checkpoints in report | Not created or not completed | Call `cp.complete()` |
| Assertions not recorded | Created outside checkpoint | Create checkpoint first |
| No root cause | Not finalized | Call `debug.finalize()` |
| Empty metrics | Not recorded | Call `cp.metrics({...})` |
| Phase shows no duration | Not exited | Call `debug.exitPhase()` |

## Best Practices

✅ **DO:**
- Use meaningful checkpoint IDs
- Include context in assertion messages
- Record relevant metrics
- Always finalize before reporting
- Save reports for analysis
- Use fluent API for readability

❌ **DON'T:**
- Skip finalize()
- Call assert() without active checkpoint
- Use generic assertion names
- Ignore root cause analysis
- Leave debug reports unsaved

## Files

- `lib/activity-execution-debugger.ts` - Main debugger (700+ lines)
- `lib/activity-execution-debugger-integration.ts` - Executor helper (400+ lines)
- `ACTIVITY_EXECUTION_DEBUGGING_GUIDE.md` - Complete guide
- `ACTIVITY_EXECUTION_DEBUGGING_SUMMARY.md` - Detailed summary

## Key Takeaway

**Make every failure immediately visible and understandable.**

Every activity execution should be instrumented to capture:
- What was supposed to happen (checkpoints)
- What was expected (assertions)
- What actually happened (metrics)
- Why it failed (root cause analysis)

This makes debugging trivial and problem-solving fast.
