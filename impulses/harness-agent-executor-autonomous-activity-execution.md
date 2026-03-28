# Validation Harness: Agent-Executor Autonomous Activity Execution

**Harness ID**: harness-agent-executor-autonomous-activity-execution

**Specification**: agent-executor-autonomous-activity-execution

**File**: `tests/validation-harnesses/agent-executor-autonomous-activity-execution-harness.ts`

**Purpose**: Comprehensive validation of try-create-retry pattern with goal-seeking fallback

## Overview

This validation harness tests the agent-executor autonomous activity execution pattern end-to-end:
1. Triggers autonomous recovery by requesting non-existent templates
2. Verifies goal inference from error context
3. Verifies template creation via goal-seeking
4. Verifies retry succeeds with newly created template
5. Verifies cache hit on second attempt (fast path)

## Test Strategy

### Phase 1: Autonomous Recovery
- Call TemplateSelector.select() with non-existent template ID
- Enable autonomous recovery: `enableAutonomousRecovery: true`
- Expected: Execution succeeds after autonomous recovery (~5-30s)

### Phase 2: Goal Inference Validation
- Verify GoalInferenceEngine inferred correct category
- Expected: Category matches template ID pattern (fix → bugfix, add → feature, refactor → refactor)

### Phase 3: Template Creation Validation
- Verify template created and registered to backend
- Expected: Template retrievable from TemplateRepository

### Phase 4: Cache Hit Validation
- Request same template ID again
- Expected: Cached template returned immediately (<1s)

### Phase 5: Performance Validation
- First execution: ~5-30s (autonomous recovery overhead)
- Second execution: <1s (cached template)

## Test Cases

### Case 1: Bugfix - SQL Injection
- **Template ID**: `fix-sql-injection-auth`
- **Expected Category**: bugfix
- **Impulse**: validation-agent-executor-autonomous-activity-execution-case-1

### Case 2: Feature - User Registration
- **Template ID**: `add-user-registration-feature`
- **Expected Category**: feature
- **Impulse**: validation-agent-executor-autonomous-activity-execution-case-2

### Case 3: Refactor - Authentication Module
- **Template ID**: `refactor-auth-module-di`
- **Expected Category**: refactor
- **Impulse**: validation-agent-executor-autonomous-activity-execution-case-3

## Success Criteria

All test cases must pass:
- ✅ Goal inference succeeds (correct category)
- ✅ Template creation succeeds (registered to backend)
- ✅ Retry succeeds (first execution completes)
- ✅ Cache hit succeeds (second execution uses cached template)
- ✅ Performance within bounds (first <30s, second <1s)

## Running the Harness

### Standalone Execution
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
npx tsx tests/validation-harnesses/agent-executor-autonomous-activity-execution-harness.ts
```

### Programmatic Usage
```typescript
import { runAllValidations } from "./tests/validation-harnesses/agent-executor-autonomous-activity-execution-harness"

const summary = await runAllValidations()
console.log(`Passed: ${summary.passed}/${summary.totalTests}`)
console.log(`Success Rate: ${(summary.passed / summary.totalTests * 100).toFixed(1)}%`)
```

### Single Test Case
```typescript
import { runValidation } from "./tests/validation-harnesses/agent-executor-autonomous-activity-execution-harness"

const testCase = {
  name: "Bugfix - SQL Injection",
  input: {
    templateId: "fix-sql-injection-auth",
    reason: "Fix SQL injection in auth module",
    variables: { file: "auth.ts" },
    enableAutonomousRecovery: true
  },
  expected: {
    goalCategory: "bugfix",
    templateCreated: true,
    retrySucceeds: true,
    cacheHitOnSecondAttempt: true,
    firstExecutionMaxDuration: 30000,
    secondExecutionMaxDuration: 1000
  }
}

const result = await runValidation(testCase)
console.log(`Result: ${result.pass ? "PASS" : "FAIL"}`)
```

## Expected Output

```
================================================================================
AGENT-EXECUTOR AUTONOMOUS ACTIVITY EXECUTION - VALIDATION HARNESS
================================================================================

=== Test Case: Bugfix - SQL Injection ===
Input: {
  "templateId": "fix-sql-injection-auth",
  "reason": "Fix SQL injection vulnerability in authentication module",
  ...
}

[Phase 1] First execution - autonomous recovery
✅ First execution succeeded in 8542ms
Selected template: fix-sql-injection-auth

[Phase 2] Verify goal inference
✅ Goal inference succeeded (category: bugfix)

[Phase 3] Verify template creation
✅ Template created and registered: fix-sql-injection-auth
   Name: Fix SQL Injection Auth
   Category: bugfix
   Tasks: 3

[Phase 4] Second execution - cached template (fast path)
✅ Second execution succeeded in 127ms
Selected template: fix-sql-injection-auth
✅ Cache hit confirmed (same template ID)

[Phase 5] Verify performance
✅ First execution within expected duration: 8542ms
✅ Second execution within expected duration: 127ms

=== Validation Result ===
Status: ✅ PASS
Errors: 0

================================================================================
SUMMARY
================================================================================
Total Tests: 3
Passed: 3 ✅
Failed: 0
Success Rate: 100.0%
```

## Integration with CI/CD

Add to CI pipeline:
```yaml
- name: Validate Agent-Executor Autonomous Activity Execution
  run: |
    npx tsx tests/validation-harnesses/agent-executor-autonomous-activity-execution-harness.ts
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Budget

**Token Budget**: 2000 tokens (stored as impulse for validation harness reference)

## Related Impulses

- `trace-agent-executor-autonomous-activity-execution`: Trace analysis
- `enforcement-agent-executor-autonomous-activity-execution`: Enforcement summary
- `validation-agent-executor-autonomous-activity-execution-case-1`: Test case 1
- `validation-agent-executor-autonomous-activity-execution-case-2`: Test case 2
- `validation-agent-executor-autonomous-activity-execution-case-3`: Test case 3
