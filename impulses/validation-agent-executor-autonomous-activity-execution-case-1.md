# Validation Test Case 1: Bugfix - SQL Injection

**Test Name**: Bugfix - SQL Injection

**Specification**: agent-executor-autonomous-activity-execution

**Purpose**: Verify autonomous recovery for bugfix templates with SQL injection scenario

## Input

```json
{
  "templateId": "fix-sql-injection-auth",
  "reason": "Fix SQL injection vulnerability in authentication module using parameterized queries",
  "variables": {
    "file": "auth.ts",
    "vulnerability": "SQL injection"
  },
  "enableAutonomousRecovery": true
}
```

## Expected Output

```json
{
  "goalCategory": "bugfix",
  "templateCreated": true,
  "retrySucceeds": true,
  "cacheHitOnSecondAttempt": true,
  "firstExecutionMaxDuration": 30000,
  "secondExecutionMaxDuration": 1000
}
```

## Validation Steps

1. **Phase 1**: First execution triggers autonomous recovery
   - TemplateSelector.select() called with non-existent template ID
   - enableAutonomousRecovery: true activates try-create-retry pattern
   - Expected: Execution succeeds after autonomous recovery

2. **Phase 2**: Verify goal inference
   - GoalInferenceEngine infers goal from error context
   - Expected category: "bugfix" (from "fix-sql-injection-auth")
   - Expected: Category matches input expectation

3. **Phase 3**: Verify template creation
   - CreateActivityGoalSeekingTool creates template with preferComposition: true
   - Template registered to backend
   - Expected: Template found in TemplateRepository

4. **Phase 4**: Second execution uses cached template (fast path)
   - Same template ID requested again
   - Expected: Template already exists, no autonomous recovery
   - Expected: Same template ID returned (cache hit)

5. **Phase 5**: Verify performance
   - First execution: ~5-30s (LLM + goal-seeking + template creation + retry)
   - Second execution: <1s (cached template lookup)
   - Expected: Both within performance thresholds

## Expected Metrics

- `goalInferenceSuccess`: true
- `templateCreationSuccess`: true
- `retrySuccess`: true
- `cacheHitSuccess`: true
- `firstExecutionDuration`: < 30000ms
- `secondExecutionDuration`: < 1000ms

## Success Criteria

- All phases complete successfully
- No errors thrown
- Template created with correct category (bugfix)
- Cache hit on second attempt
- Performance within expected bounds
