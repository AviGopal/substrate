# Validation Harness: Agent-Executor Autonomous Activity Execution

## Overview

This validation harness tests the **try-create-retry pattern** with **goal-seeking fallback** for autonomous activity execution. It verifies that the system can autonomously create missing templates on-the-fly and retry execution without manual intervention.

## What This Tests

The agent-executor autonomous activity execution pattern enables **self-healing behavior**:
1. **Trigger**: Attempt to execute a non-existent activity template
2. **Catch**: Template not found error
3. **Infer**: Use GoalInferenceEngine to determine user's goal
4. **Create**: Use goal-seeking to create the missing template
5. **Retry**: Execute with the newly created template
6. **Cache**: Second execution uses cached template (fast path)

## Test Cases

### Case 1: Bugfix - SQL Injection
- **Template ID**: `fix-sql-injection-auth`
- **Expected**: Goal inference identifies "bugfix" category
- **Validation**: Template created with SQL injection fix tasks

### Case 2: Feature - User Registration
- **Template ID**: `add-user-registration-feature`
- **Expected**: Goal inference identifies "feature" category
- **Validation**: Template created with registration + email verification tasks

### Case 3: Refactor - Authentication Module
- **Template ID**: `refactor-auth-module-di`
- **Expected**: Goal inference identifies "refactor" category
- **Validation**: Template created with dependency injection refactoring tasks

## Running the Harness

### Standalone (Command Line)

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
npx tsx tests/validation-harnesses/agent-executor-autonomous-activity-execution-harness.ts
```

### Programmatic (TypeScript)

```typescript
import { runAllValidations, runValidation } from "./tests/validation-harnesses/agent-executor-autonomous-activity-execution-harness"

// Run all test cases
const summary = await runAllValidations()
console.log(`Passed: ${summary.passed}/${summary.totalTests}`)
console.log(`Success Rate: ${(summary.passed / summary.totalTests * 100).toFixed(1)}%`)

// Run single test case
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

### CI/CD Integration

Add to `.github/workflows/validation.yml`:

```yaml
name: Validation - Agent-Executor Autonomous Activity Execution

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run validation harness
        run: npx tsx tests/validation-harnesses/agent-executor-autonomous-activity-execution-harness.ts
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Expected Output

### Success Case

```
================================================================================
AGENT-EXECUTOR AUTONOMOUS ACTIVITY EXECUTION - VALIDATION HARNESS
================================================================================

=== Test Case: Bugfix - SQL Injection ===
Input: {
  "templateId": "fix-sql-injection-auth",
  "reason": "Fix SQL injection vulnerability in authentication module using parameterized queries",
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

... (repeat for other test cases) ...

================================================================================
SUMMARY
================================================================================
Total Tests: 3
Passed: 3 ✅
Failed: 0
Success Rate: 100.0%
```

### Failure Case

If autonomous recovery fails:

```
[Phase 1] First execution - autonomous recovery
❌ First execution failed: Template not found: fix-sql-injection-auth. Auto-creation failed: LLM timeout

[Phase 2] Verify goal inference
❌ Cannot verify goal inference - first execution failed

=== Validation Result ===
Status: ❌ FAIL
Errors: 2
Error details:
  1. First execution failed: Template not found: fix-sql-injection-auth. Auto-creation failed: LLM timeout
  2. Cannot verify goal inference - first execution failed
```

## Validation Phases

### Phase 1: Autonomous Recovery
- **Test**: Call TemplateSelector.select() with non-existent template ID and `enableAutonomousRecovery: true`
- **Expected**: Execution succeeds after autonomous recovery
- **Duration**: 5-30s (LLM + goal-seeking + template creation)

### Phase 2: Goal Inference
- **Test**: Verify GoalInferenceEngine inferred correct category from template ID
- **Expected**: Category matches pattern (fix → bugfix, add → feature, refactor → refactor)

### Phase 3: Template Creation
- **Test**: Verify template created and registered to backend
- **Expected**: Template retrievable from TemplateRepository

### Phase 4: Cache Hit
- **Test**: Request same template ID again
- **Expected**: Cached template returned immediately (<1s)

### Phase 5: Performance
- **Test**: Verify execution times within expected bounds
- **Expected**: First <30s, second <1s

## Success Criteria

All phases must pass for each test case:
- ✅ Goal inference succeeds (correct category)
- ✅ Template creation succeeds (registered to backend)
- ✅ Retry succeeds (first execution completes)
- ✅ Cache hit succeeds (second execution uses cached template)
- ✅ Performance within bounds (first <30s, second <1s)

## Troubleshooting

### Issue: "Template not found" error even with enableAutonomousRecovery: true

**Cause**: Feature flag disabled in code (default: false)

**Fix**: Update `ActivityTool.execute()` to enable autonomous recovery:

```typescript
// In repos/metabob-opencode/packages/opencode/src/tool/activity.ts
const selectionResult = await TemplateSelector.select(params.templateId, undefined, {
  reason: params.reason,
  variables: params.variables,
  enableAutonomousRecovery: true, // Change from false to true
})
```

### Issue: Goal inference fails (category: "feature" instead of "bugfix")

**Cause**: GoalInferenceEngine keyword matching may not cover all patterns

**Fix**: Update keyword patterns in `goal-inference-engine.ts`:

```typescript
// Add more keywords for bugfix detection
if (
  lowerTemplateId.includes("fix") ||
  lowerTemplateId.includes("bug") ||
  lowerTemplateId.includes("patch") ||
  lowerTemplateId.includes("vulnerability") // Add this
) {
  return "bugfix"
}
```

### Issue: Performance test fails (first execution too slow)

**Cause**: LLM latency or network issues

**Fix**: Increase performance threshold in test case:

```typescript
firstExecutionMaxDuration: 60000, // Increase from 30s to 60s
```

## Related Documentation

- [Trace Analysis](../../impulses/trace-agent-executor-autonomous-activity-execution.md)
- [Enforcement Summary](../../impulses/enforcement-agent-executor-autonomous-activity-execution.md)
- [Test Case 1](../../impulses/validation-agent-executor-autonomous-activity-execution-case-1.md)
- [Test Case 2](../../impulses/validation-agent-executor-autonomous-activity-execution-case-2.md)
- [Test Case 3](../../impulses/validation-agent-executor-autonomous-activity-execution-case-3.md)
- [Harness Impulse](../../impulses/harness-agent-executor-autonomous-activity-execution.md)

## Next Steps

After validation passes:
1. Enable feature flag in production (`enableAutonomousRecovery: true`)
2. Monitor autonomous recovery attempts in logs
3. Collect metrics (success rate, latency, cost)
4. Gradual rollout to users
5. Add observability dashboards

## Support

For issues or questions:
- Check logs for autonomous recovery attempts
- Review GoalInferenceEngine output
- Verify template registration to backend
- Confirm cache behavior on second attempt
