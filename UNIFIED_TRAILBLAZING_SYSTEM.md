# Unified Trailblazing Recovery System

## Overview

Successfully unified two complementary trailblazing approaches into a coordinated recovery system.

## Architecture

### Two Recovery Layers

1. **Phase 1: AI Continuation (TrailblazingExecutor)**
   - Location: `repos/metabob-opencode/packages/opencode/src/session/trailblazing-executor.ts`
   - Used by: `activity.ts` (lines 882-1008)
   - Strategy: Quick, single-turn recovery with better context
   - Best for: Prompt/context issues, logical errors, missing information

2. **Phase 2: Recovery Tasks (generateRecoveryTasks)**
   - Location: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts` (lines 527-781, 873-933)
   - Used by: `template-executor.ts` after AI continuation fails
   - Strategy: Multi-step structural fixes with new tasks
   - Best for: Schema errors, registration failures, complex issues

## Coordination Flow

```
Task Execution
    ↓
  Fails?
    ↓ Yes
  ┌───────────────────────────────────────┐
  │ Phase 1: AI Continuation              │
  │ (TrailblazingExecutor)                │
  │ - Generate continuation prompt        │
  │ - Retry with better context           │
  │ - Up to maxRecoveryAttempts           │
  └───────────────────────────────────────┘
    ↓
  Still fails?
    ↓ Yes
  ┌───────────────────────────────────────┐
  │ Phase 2: Recovery Tasks               │
  │ (generateRecoveryTasks)               │
  │ - Analyze error type                  │
  │ - Generate fix tasks                  │
  │ - Append to template                  │
  │ - Continue execution                  │
  └───────────────────────────────────────┘
    ↓
  Success or final failure
```

## When Each Approach is Used

### AI Continuation (Phase 1)
Triggered by: `trailblazingOptions.enabled === true` in activity.ts

Use cases:
- Task needs clarification on requirements
- Incorrect assumptions about context
- Missing information from original prompt
- Logical errors in approach
- Validation failures requiring different strategy

Example:
```typescript
// In activity.ts
if (trailblazingEnabled && options?.trailblazingOptions) {
  const result = await TrailblazingExecutor.executeTaskWithTrailblazing({
    task,
    variables,
    sessionID,
    trailblazingOptions,
    // ...
  })
}
```

### Recovery Tasks (Phase 2)
Triggered by: `task.retry?.strategy === "trailblazing"` AND task failed

Use cases:
- Schema validation errors → `fix-schema-errors` + `retry-registration`
- Registration failures → `debug-registration` + `retry`
- Generic errors → `recover-from-failure` + `retry-original-task`

Example:
```typescript
// In template-executor.ts
if (execution.status === "failed" && task.retry?.strategy === "trailblazing") {
  const recoveryTasks = await generateRecoveryTasks({
    failedTask: task,
    error: execution.error,
    template,
    activity,
  })
  
  template.tasks.push(...recoveryTasks)
  // Continue with new tasks
}
```

## Key Design Decisions

### Why Both Approaches?

1. **Complementary Strengths**:
   - AI continuation: Fast, adaptive, context-aware
   - Recovery tasks: Structured, thorough, repeatable

2. **Your Guidance**: "Better context" = "creating a better agent"
   - AI continuation: Better context through smarter prompts
   - Recovery tasks: Better agent through specialized sub-tasks

3. **Sequential Fallback**:
   - Try fast approach first (AI continuation)
   - Fall back to thorough approach (recovery tasks)
   - Both can work together without conflict

### No Duplication

These are NOT duplicate systems:
- AI continuation: Changes the **prompt** for same task
- Recovery tasks: Creates **new tasks** for structural fixes

They solve different problems:
- AI: "The task needs better instructions"
- Recovery: "The task needs prerequisites fixed first"

## Implementation Changes

### 1. template-executor.ts (lines 873-933)
Added clear comments explaining:
- This is Phase 2 of unified system
- AI continuation (Phase 1) was already attempted
- Recovery tasks handle structural issues
- Both can work together

### 2. activity.ts (lines 878-882)
Added clear comments explaining:
- This is Phase 1 of unified system
- AI continuation tries quick fixes first
- If fails, Phase 2 (recovery tasks) takes over

### 3. trailblazing-executor.ts (top of file)
Added comprehensive documentation:
- Role in unified system
- When to use AI continuation
- When it falls back to recovery tasks
- Coordination with template-executor.ts

## Error Type → Recovery Strategy

| Error Type | Detection | Recovery Strategy |
|------------|-----------|-------------------|
| Schema/Validation | `error.includes("schema")` or `"validation"` | fix-schema-errors → retry-registration |
| Registration/Backend | `error.includes("registration")` or `"backend"` | debug-registration → retry |
| Generic | All other errors | recover-from-failure → retry-original-task |

Each strategy generates 2 tasks:
1. Fix task (analyzes and fixes issue)
2. Retry task (attempts original operation)

## Success Criteria ✓

- [x] No conflicts between AI continuation and recovery tasks
- [x] Clear execution path: AI continuation → Recovery tasks
- [x] Both systems work independently or together
- [x] TypeScript compiles (no new errors introduced)
- [x] Clear documentation of coordination strategy
- [x] Comments explain when each approach is used

## Usage Example

### Template with Trailblazing
```json
{
  "id": "register-template",
  "tasks": [
    {
      "id": "validate-and-register",
      "retry": {
        "maxAttempts": 3,
        "strategy": "trailblazing"
      }
    }
  ]
}
```

### Execution with AI Continuation
```typescript
// In activity.ts, enable AI continuation
await executeTemplate(template, activity, variables, sessionID, abortSignal, model, {
  trailblazingOptions: {
    enabled: true,
    maxRecoveryAttempts: 3,
    maxCostPerTask: 1.0,
    maxTotalCost: 5.0
  }
})
```

### Result Flow
1. Task fails validation
2. AI continuation generates better prompt → Retry (Phase 1)
3. Still fails with schema error
4. Recovery tasks generate fix-schema-errors + retry (Phase 2)
5. Schema fixed, retry succeeds

## Benefits

1. **Flexible**: Choose fast or thorough recovery based on error type
2. **Efficient**: Try quick fixes before expensive multi-step recovery
3. **Comprehensive**: Can handle both simple and complex failures
4. **Coordinated**: Both approaches work together, not in conflict
5. **Clear**: Well-documented execution flow and decision points

## Future Enhancements

1. **Cost-Based Selection**: Choose AI vs recovery based on cost estimates
2. **Learning**: Track which approach works for which error types
3. **Hybrid**: Combine AI continuation with recovery tasks in single attempt
4. **Metrics**: Record success rates for each recovery strategy

---

**Implementation Status**: ✅ Complete
**TypeScript Compilation**: ✅ No new errors
**Documentation**: ✅ Comprehensive inline comments
**Coordination**: ✅ Clear sequential fallback strategy
