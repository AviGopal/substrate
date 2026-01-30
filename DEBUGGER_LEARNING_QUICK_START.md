# Quick Start: Using Debugger with Learning System

## The Three-Minute Version

**Goal**: Use Activity Execution Debugger to improve activities through learning

**Process**:
1. Execute activity with debugger attached
2. Debugger captures every step (checkpoints, assertions, metrics)
3. Send diagnostic to learning system
4. Learning system tracks what works/doesn't work
5. Next activity recommendation improves based on what was learned

---

## For Activity Developers

### When You Create a New Activity

**Before** (guessing):
```typescript
export async function myActivity(variables) {
  // Hope this works...
  const result = await doSomething();
  return result;
}
```

**After** (with debugging):
```typescript
export async function myActivity(variables, executor: ActivityExecutionDebugger) {
  executor.enterPhase(ExecutionPhase.INITIALIZATION);
  
  // Validate setup
  const cp_init = executor.checkpoint('cp_init', 'Validate setup');
  executor.assertTrue('env_ready', checkEnvironment());
  cp_init.complete(ExecutionState.SUCCESS);
  
  executor.exitPhase(ExecutionState.SUCCESS);
  
  // Execute
  executor.enterPhase(ExecutionPhase.EXECUTION);
  const cp_exec = executor.checkpoint('cp_exec', 'Do work');
  
  const result = await doSomething();
  executor.assertTrue('result_valid', result != null);
  cp_exec.metrics({ duration: Date.now() - start });
  cp_exec.complete(ExecutionState.SUCCESS);
  
  executor.exitPhase(ExecutionState.SUCCESS);
  
  // Validate
  executor.enterPhase(ExecutionPhase.VALIDATION);
  const cp_valid = executor.checkpoint('cp_valid', 'Validate output');
  
  executor.assertTrue('output_correct', validateOutput(result));
  cp_valid.complete(ExecutionState.SUCCESS);
  
  executor.exitPhase(ExecutionState.SUCCESS);
  
  return result;
}
```

**Result**: 
- ✅ Each checkpoint shows exactly where it might fail
- ✅ Metrics show performance at each step
- ✅ Assertions validate preconditions and postconditions
- ✅ Learning system sees all of this

### When an Activity Fails

**Without Debugging**:
```
Activity failed
Error: Something went wrong
Debug time: 30+ minutes
```

**With Debugging**:
```
CHECKPOINT FAILED: cp_file_write
ASSERTION: file_created = true
REASON: Directory does not exist
ROOT CAUSE: No directory creation before write
PREVENTION: Create directory in planning phase
```

---

## For Learning System Integration

### Step 1: Wrap Activity Execution

```typescript
// In your activity executor
import ActivityExecutionDebugger, { ExecutionPhase, ExecutionState } from './lib/activity-execution-debugger';

async function executeActivity(activityId, activityType, variables) {
  // Create debugger
  const executor = new ActivityExecutionDebugger(activityId, activityType);
  
  try {
    // Execute activity with debugging
    const result = await myActivity(variables, executor);
    executor.finalize();
    
    // Return diagnostic
    return {
      success: executor.isSuccessful(),
      result: result,
      diagnostic: executor.getDiagnostic(),
    };
  } catch (error) {
    executor.finalize();
    return {
      success: false,
      error: error.message,
      diagnostic: executor.getDiagnostic(),
    };
  }
}
```

### Step 2: Send Diagnostic to Learning System

```typescript
// After activity execution
async function recordActivityOutcome(executionResult, impressionId) {
  const { diagnostic, success, result } = executionResult;
  
  // Convert diagnostic to feedback
  const feedback = {
    impression_id: impressionId,
    outcome: success ? 'success' : 'failure',
    
    // Metrics from diagnostic
    metrics: {
      duration_ms: diagnostic.duration,
      checkpoints: diagnostic.checkpoints.length,
      assertions: diagnostic.checkpoints.reduce((sum, cp) => sum + cp.assertions.length, 0),
      failures: diagnostic.failures.length,
    },
    
    // Diagnostic data for learning
    diagnostic_data: {
      checkpoints: diagnostic.checkpoints,
      root_cause: diagnostic.rootCause,
      failures: diagnostic.failures,
    },
    
    // Activity result
    result_data: result,
  };
  
  // Send to learning system
  const response = await fetch('/api/v1/feedback/record', {
    method: 'POST',
    body: JSON.stringify(feedback),
  });
  
  return response.json();
}
```

### Step 3: Use Diagnostics for Validation Gates

```typescript
// Before committing activity result
async function validateBeforeCommit(diagnostic) {
  const gates = {
    no_failures: diagnostic.failures.length === 0,
    all_assertions_passed: diagnostic.checkpoints.every(
      cp => cp.assertions.every(a => a.passed)
    ),
    acceptable_duration: diagnostic.duration < 60000, // 60 seconds
    root_cause_understood: diagnostic.rootCause ? true : false,
  };
  
  if (!gates.no_failures) {
    throw new Error('Activity has failures - cannot commit');
  }
  
  if (!gates.all_assertions_passed) {
    throw new Error('Some assertions failed - cannot commit');
  }
  
  if (!gates.acceptable_duration) {
    throw new Error('Activity too slow - check for bottlenecks');
  }
  
  return gates;
}
```

---

## For Agents Using Activities

### Getting a Recommendation

```typescript
// 1. Describe your task
const task = 'Add new user profile API endpoint';

// 2. Get recommendation from learning system
const recommendation = await getRecommendation({
  task: task,
  component_ids: ['src/api/users.ts'],
});

// Returns:
// {
//   recommended_activity: 'add-feature-complete',
//   context_impulses: [
//     { impulse_id: 'pattern_rest_endpoints', content: '...' },
//     { impulse_id: 'pattern_error_handling', content: '...' }
//   ],
//   impression_id: 'imp_12345'
// }

// 3. Execute recommended activity
const executor = new ActivityExecutionDebugger(
  recommendation.impression_id,
  recommendation.recommended_activity
);

const result = await executeActivity(
  executor,
  recommendation.recommended_activity,
  {
    endpoint: '/api/users/:id/profile',
    method: 'GET',
    returnType: '{ id, name, email, avatar }',
    context: recommendation.context_impulses,
  }
);

// 4. Send feedback
await recordFeedback(recommendation.impression_id, {
  outcome: result.success ? 'success' : 'failure',
  diagnostic: result.diagnostic,
});
```

---

## Common Use Cases

### Use Case 1: Improve Activity Success Rate

**Problem**: Activity succeeds 60% of the time

**Solution**:
1. Collect diagnostics from failed executions
2. Learning system analyzes failure patterns
3. Identify common checkpoint failures
4. Update activity to add pre-validation
5. Test with updated activity
6. Success rate improves to 85%

```typescript
// Learning system identifies patterns
const failurePatterns = await analyzeFailed('add-feature-complete');
// Returns: [
//   {
//     checkpoint: 'cp_test_coverage',
//     failure_rate: 0.4,
//     reason: 'Coverage < 80%',
//     suggestion: 'Add cp_edge_case_tests checkpoint'
//   }
// ]

// Update activity
const improved = updateActivity('add-feature-complete', {
  new_checkpoint: {
    id: 'cp_edge_case_tests',
    description: 'Test edge cases',
  },
});
```

### Use Case 2: Learn Best Context for Tasks

**Problem**: Don't know which impulses help most

**Solution**:
1. Track which impulses correlate with success
2. Learning system learns associations
3. Next recommendation includes best impulses
4. Success rate of same task improves

```typescript
// Learning system tracks associations
const associations = await getAssociations('src/api/users.ts');
// Returns: [
//   { impulse: 'rest_endpoint_pattern', success_rate: 0.95 },
//   { impulse: 'error_handling', success_rate: 0.88 },
//   { impulse: 'auth_validation', success_rate: 0.82 },
// ]

// Next recommendation for similar task includes these impulses
// in order of effectiveness
```

### Use Case 3: Detect When Activity Doesn't Apply

**Problem**: Activity fails 80% of the time for certain inputs

**Solution**:
1. Diagnostics show consistent failure pattern
2. Learning system clusters failures
3. Identify precondition that must be met
4. Thompson Sampling reduces recommending for that case
5. Different activity used for edge case

```typescript
// Learning system identifies failure clusters
const clusters = await identifyFailureClusters('fix-bug-complete');
// Returns: [
//   {
//     cluster: 'Async race conditions',
//     failure_rate: 0.75,
//     precondition: 'Component uses async/await',
//     recommendation: 'Use fix-async-race-complete instead'
//   }
// ]
```

---

## Integration Checklist

### For Activity Developers

- [ ] Add `executor` parameter to activity function
- [ ] Wrap major steps in phases (INITIALIZATION, EXECUTION, VALIDATION)
- [ ] Create checkpoints at validation points
- [ ] Add assertions for preconditions and postconditions
- [ ] Record metrics at each checkpoint
- [ ] Call `executor.finalize()` at end
- [ ] Return diagnostic with result

### For Learning System

- [ ] Add feedback endpoint (`/api/v1/feedback/record`)
- [ ] Store diagnostics in SurrealDB
- [ ] Update Thompson parameters on feedback
- [ ] Track association weights
- [ ] Generate analytics (internal)
- [ ] Create recommendation endpoint
- [ ] Implement activity variant selection

### For Quality Gates

- [ ] Check `no failures` in diagnostic
- [ ] Verify `all assertions passed`
- [ ] Validate `acceptable duration`
- [ ] Understand `root cause` if failed
- [ ] Block commit if gates fail

### For Monitoring

- [ ] Setup dashboard for analytics
- [ ] Track activity success rates
- [ ] Monitor failure patterns
- [ ] Alert on degradation
- [ ] Log all recommendations and outcomes

---

## Example: Complete Flow

### 1. Agent Task

```
"Add user profile endpoint that returns {id, name, email, avatar}"
```

### 2. System Recommendation

```
GET /recommendations
{
  "recommended_activity": "add-feature-complete",
  "context_impulses": ["rest_endpoint_pattern", "json_response"],
  "impression_id": "imp_abc123"
}
```

### 3. Activity Execution (with debugging)

```
PHASE: INITIALIZATION
  ✓ cp_init: Environment ready
    
PHASE: EXECUTION
  ✓ cp_plan: Create implementation plan
  ✓ cp_code: Write endpoint code
  ✓ cp_tests: Write tests
  ✓ cp_integrate: Integrate with existing code
  
PHASE: VALIDATION
  ✓ cp_quality: Run quality checks
    - Coverage: 85%
    - Tests: 8/8 passing
    - Issues: 0
    
METRICS
  - Duration: 2500ms
  - Files changed: 3
  - Tests added: 8
```

### 4. Feedback to Learning System

```
POST /feedback/record
{
  "impression_id": "imp_abc123",
  "outcome": "success",
  "metrics": {
    "duration_ms": 2500,
    "checkpoints": 5,
    "assertions": 12,
    "failures": 0
  },
  "diagnostic_data": {
    "checkpoints": [...],
    "root_cause": null
  }
}
```

### 5. Learning System Updates (background)

```
- Update Thompson alpha for add-feature-complete: 24 → 25
- Update context associations: rest_endpoint_pattern weight +0.01
- Decrease recommendation for unrelated impulses
- Note: Similar tasks in future will prefer this activity
```

### 6. Next Similar Task (learns from previous)

```
"Add product catalog endpoint"

GET /recommendations
{
  "recommended_activity": "add-feature-complete",  ← Same as before!
  "context_impulses": ["rest_endpoint_pattern", "json_response"],  ← Same!
  "impression_id": "imp_def456"
}

Expected: Higher success rate (based on previous success)
```

---

## Troubleshooting

### "Activity is failing at checkpoint X"

**Diagnostic tells you**:
```
CHECKPOINT FAILED: cp_write
ASSERTION: file_written = true
REASON: Directory does not exist
ROOT CAUSE: No directory creation before write
```

**What to do**:
1. Read the reason
2. Check the contributing factors
3. Implement the prevention strategy
4. Test again
5. Share result with learning system

### "Success rate decreased after update"

**Diagnostic tells you**:
```
FAILURE CLUSTER: Low test coverage
- Failure rate: 40%
- Checkpoints failing: cp_test_coverage
- Suggestion: Add edge case testing
```

**What to do**:
1. Identify the failing checkpoint
2. Add earlier validation or pre-check
3. Update activity template
4. Retest
5. Learning system will improve recommendation

### "Same activity never recommended"

**Diagnostic tells you**:
```
Thompson parameters for activity:
- Alpha: 5 (successes + 1)
- Beta: 8 (failures + 1)
- Success rate: 38%
```

**What to do**:
1. Fix the underlying issues
2. Ensure diagnostics show success
3. Send positive feedback
4. Alpha will increase, Beta won't
5. Recommendation probability will improve

---

## Next Steps

1. **Add Debugger to Your Activities**
   - Review ACTIVITY_EXECUTION_DEBUGGING_GUIDE.md
   - Instrument your activity code
   - Test locally

2. **Connect to Learning System**
   - Implement feedback endpoint
   - Setup SurrealDB
   - Test diagnostic storage

3. **Setup Monitoring**
   - Create analytics dashboard
   - Track success rates
   - Monitor failure patterns

4. **Start Learning**
   - Execute activities
   - Send feedback
   - Watch recommendations improve

---

**Key Insight**: The debugger makes every execution transparent. The learning system makes every execution educational. Together they create self-improving activities.

