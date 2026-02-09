# MCP Activity Execution Implementation Summary

## ✅ Completed: Step 1 - MCP Wrapper Methods

Added 4 new methods to `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`:

### 1. `startExecution()`
- **Purpose**: Creates execution tracking in SurrealDB backend
- **MCP Tool**: `start_activity_execution`
- **Returns**: `{ execution_id, state, activity_id, variant_id }`
- **Usage**: Call before executing any activity tasks

### 2. `getNextStep()`
- **Purpose**: Incremental step delivery (one step at a time)
- **MCP Tool**: `get_next_step`
- **Returns**: `{ current_step?, complete, trailblazing }`
- **Key Feature**: Agent does NOT see all future steps upfront

### 3. `reportStepResult()`
- **Purpose**: Metrics collection for Thompson Sampling learning
- **MCP Tool**: `report_step_result`  
- **Parameters**: `{ executionId, stepId, success, cost, tokens, toolCalls, ... }`
- **Returns**: `{ continue, next_step_index, validation_passed }`
- **Impact**: Enables alpha/beta updates in backend for learning

### 4. `getExecutionState()`
- **Purpose**: Progress tracking and debugging
- **MCP Tool**: `get_execution_state`
- **Returns**: `{ execution_id, state, current_step_index, total_cost, total_tokens, step_results }`
- **Usage**: Check current execution progress

## Implementation Details

### Error Handling
- All methods throw errors if MCP call fails
- Follows existing pattern from `searchActivities()` and `getActivity()`
- Graceful error messages for debugging

### Logging
- Debug logs for all method calls
- Info logs for successful operations
- Includes key parameters and results in logs

### Type Safety
- Fully typed TypeScript interfaces
- Validates MCP response status
- Type-safe return values

## 📝 Test Script Created

Created `repos/metabob-opencode/test-mcp-activity-execution.ts`:

### Test Flow
1. Check Metabob MCP availability
2. Search for activities (existing method)
3. Start execution (NEW)
4. Get next step (NEW)
5. Report step result (NEW)
6. Get execution state (NEW)

### Verification Steps
```bash
# Run test
cd repos/metabob-opencode
bun run test-mcp-activity-execution.ts

# Verify in SurrealDB
./admin-cli.sh db query "SELECT * FROM executions WHERE id = 'exec_xxx'"
```

## 🔄 Next Step: Template Executor Integration

### Current Flow (Direct Execution)
```typescript
// template-executor.ts:794
async function executeTasks(template, activity, variables, ...) {
  // Creates ONE session for entire activity
  // Executes all tasks directly
  // No MCP calls = no metrics = no learning
}
```

### Proposed Flow (MCP Integration)
```typescript
async function executeTasks(template, activity, variables, useMCP = false, ...) {
  if (useMCP) {
    // NEW: MCP-based incremental execution
    return await executeTasksViaMCP(template, activity, variables, ...)
  } else {
    // EXISTING: Direct execution (backward compatibility)
    return await executeTasksDirect(template, activity, variables, ...)
  }
}
```

### Benefits of This Approach
1. **Backward Compatibility**: Existing code continues to work
2. **Gradual Rollout**: Can enable MCP per-activity or via config
3. **Testing**: Easy to A/B test MCP vs direct execution
4. **Fallback**: If MCP fails, can fall back to direct execution

## Architecture Alignment

### Before (Current)
```
OpenCode ActivityTool
  → TemplateExecutor.execute()
    → executeTasks() [direct execution]
      → executeTaskWithRetry()
        → executeTask() [runs task in session]
          → NO METRICS COLLECTED
```

### After (With MCP)
```
OpenCode ActivityTool
  → TemplateExecutor.execute(useMCP: true)
    → executeTasks(useMCP: true)
      → executeTasksViaMCP()
        → MetabobCLI.startExecution() [create tracking]
        → LOOP:
          → MetabobCLI.getNextStep() [get current step only]
          → executeTask() [run step]
          → MetabobCLI.reportStepResult() [send metrics]
        → METRICS COLLECTED = LEARNING ENABLED
```

## Implementation Strategy

### Phase 1: Add `executeTasksViaMCP()` Function ✅
- Add new function to template-executor.ts
- Implement incremental step loop
- Use existing `executeTask()` for actual execution
- Report metrics after each step

### Phase 2: Add Configuration Flag
- Add `useMCP` parameter to `TemplateExecutor.execute()`
- Add config option in `opencode.json`:
  ```json
  {
    "metabob": {
      "useMCPExecution": true
    }
  }
  ```

### Phase 3: Update ActivityTool
- Check config flag in `ActivityTool.execute()`
- Pass `useMCP` flag to TemplateExecutor
- Add try-catch to fall back to direct execution if MCP fails

### Phase 4: Testing & Validation
- Run existing activity tests (should pass with useMCP: false)
- Run new MCP tests (with useMCP: true)
- Verify metrics in SurrealDB
- Confirm Thompson Sampling updates

## Key Design Decisions

### 1. Optional vs Required
**Decision**: Make MCP execution **optional** with flag
**Reason**: Backward compatibility, gradual rollout, easier testing

### 2. Fallback Strategy
**Decision**: Fall back to direct execution if MCP unavailable
**Reason**: Resilience, development without backend running

### 3. Session Management
**Decision**: Keep existing session management (one session per activity)
**Reason**: Minimal changes, preserve existing behavior

### 4. Step Execution
**Decision**: Reuse existing `executeTask()` function
**Reason**: Don't duplicate logic, maintain consistency

## Success Criteria

- [x] 4 MCP wrapper methods implemented
- [x] Test script created and documented
- [ ] `executeTasksViaMCP()` function added
- [ ] Config flag added
- [ ] ActivityTool updated to use flag
- [ ] Test passes with MCP enabled
- [ ] Execution_id created in SurrealDB
- [ ] Metrics recorded (cost, tokens, duration)
- [ ] Thompson Sampling alpha/beta updated
- [ ] Existing tests still pass

## Documentation Updates Needed

1. Update `ACTIVITY_WORKFLOW_QUICK_REFERENCE.md` with MCP flow
2. Add config examples to `opencode.json` docs
3. Update activity template documentation
4. Add troubleshooting guide for MCP issues

## Related Files

### Modified
- `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` (4 new methods)

### To Modify
- `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts` (add MCP flow)
- `repos/metabob-opencode/packages/opencode/src/config/config.ts` (add config flag)

### Test Files
- `repos/metabob-opencode/test-mcp-activity-execution.ts` (new test script)

## Benefits of This Implementation

### For Learning
- ✅ Metrics collected after each step
- ✅ Thompson Sampling learns from outcomes
- ✅ Activity rankings improve over time
- ✅ Cost and duration predictions become accurate

### For Debugging
- ✅ Execution state tracked in backend
- ✅ Can query SurrealDB for execution history
- ✅ Step-by-step progress visible
- ✅ Failed steps logged with error details

### For Evolution
- ✅ Trailblazing can learn from past fixes
- ✅ Variant performance compared automatically
- ✅ Template evolution based on metrics
- ✅ Best practices emerge from data

## Next Actions

1. Implement `executeTasksViaMCP()` in template-executor.ts
2. Add config flag support
3. Update ActivityTool to use flag
4. Run comprehensive tests
5. Verify end-to-end flow with backend
