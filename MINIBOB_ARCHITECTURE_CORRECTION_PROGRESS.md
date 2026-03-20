# Minibob Architecture Correction - Progress Report

## Summary

We've made significant progress on correcting the architectural mismatch between OpenCode and Minibob. The goal is to transform minibob from a simple activity executor into a **goal-driven orchestrator** that handles activity recommendation and execution loops.

---

## What Was Accomplished

### 1. GoalProcessor in Minibob ✅

**File**: `repos/minibob/src/goal-processor.ts`

**What it does**:
- Parses user goals into structured format (type, intent, context)
- Manages goal-seeking execution loop
- Checks goal completion after each activity
- Tracks costs and enforces limits

**Key methods**:
```typescript
class GoalProcessor {
  parseGoal(message: string, context?: Record<string, unknown>): Goal
  getRecommendations(goal: Goal, ...): Promise<ActivityRecommendation[]> // Placeholder
  isGoalComplete(executions: ActivityExecution[]): { complete: boolean, reason: string }
  executeGoal(message: string, ...): Promise<GoalResult>
}
```

**Exported from**: `repos/minibob/src/lib.ts`

**Commit**: `ae84380` - "feat: Add GoalProcessor for goal-driven activity execution"

---

### 2. MinibobIntegration.submitGoal() API ✅

**File**: `repos/metabob-opencode/packages/opencode/src/minibob-integration/index.ts`

**What it does**:
- Public API for submitting goals to minibob
- Creates GoalProcessor instance
- Calls `executeGoalWithBackend()` for actual orchestration
- Uses `MetabobCLI.recommendActivities()` for backend Thompson Sampling

**Key flow**:
```
submitGoal(sessionID, "Add subtract function", context)
  → GoalProcessor.parseGoal()
  → executeGoalWithBackend():
      Loop:
        → MetabobCLI.recommendActivities() // Backend Thompson Sampling!
        → Load template
        → executor.execute()
        → Check completion
        → Repeat until complete or limits reached
  → Return GoalResult
```

**Commit**: `5e179e81` - "feat(minibob): Add submitGoal API for goal-driven execution"

---

## Architecture: Before vs. After

### ❌ BEFORE (Incorrect)

```
User: "Add subtract function"
  → OpenCode TUI
    → OpenCode creates activity (activity tool)
    → OpenCode runs SessionMemoryAgent
    → OpenCode calls MinibobIntegration.executeActivity()
      → Minibob executes pre-created activity
      → Returns result
```

**Problems**:
- OpenCode doing orchestration (should be minibob)
- Duplicate SessionMemoryAgent in opencode
- Activity creation separated from execution
- No goal-driven loop

### ✅ AFTER (Correct)

```
User: "Add subtract function"
  → OpenCode TUI
    → MinibobIntegration.submitGoal("Add subtract function", context)
      → Minibob GoalProcessor.executeGoal()
        → Backend recommends activities (Thompson Sampling)
        → SessionMemoryAgent runs (via lifecycle hooks)
        → Execute activity
        → Check goal completion
        → Repeat if needed
      → Return GoalResult
```

**Benefits**:
- Minibob orchestrates everything
- Backend handles recommendations
- Goal-driven loop built-in
- Every activity has execution record

---

## What Remains (Next Steps)

### 1. Update Activity Tool (Optional - Backward Compatibility)

**Current state**: Activity tool still creates and executes activities directly.

**Options**:

**Option A**: Keep backward compatibility (RECOMMENDED)
- Leave activity tool as-is for explicit template execution
- Add new `goal` tool that uses `submitGoal()`
- Users can choose: explicit (activity tool) or goal-driven (goal tool)

**Option B**: Replace activity tool completely
- Modify activity tool to call `submitGoal()` instead
- Breaking change for existing workflows
- Simpler architecture (only one path)

### 2. Remove Duplicate SessionMemoryAgent

**File to delete**: `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`

**Why**: Minibob now has SessionMemoryAgent in `repos/minibob/src/memory-agent.ts` which runs via lifecycle hooks. OpenCode's copy is redundant.

**Impact**: Check for any imports in opencode:
```bash
cd repos/metabob-opencode
grep -r "from.*session/memory-agent" packages/opencode/src/
```

**Action**: Remove file and update imports to use `@metabob/minibob`'s SessionMemoryAgent if needed.

### 3. Add MCP Backend Recommendation Method

**File**: `repos/minibob/src/mcp.ts`

**What's needed**: Add `recommendActivities()` method to MCPClient:

```typescript
export class MCPClient {
  async recommendActivities(
    taskDescription: string,
    category?: string,
    loadedImpulseIds?: string[],
    limit?: number
  ): Promise<Array<{ template_id: string; selection_metadata: any }>> {
    // Call metabob-activity-api /recommend endpoint
    // Backend uses Thompson Sampling + historical data
  }
}
```

**Current workaround**: `executeGoalWithBackend()` uses `MetabobCLI.recommendActivities()` directly from opencode. This works but creates coupling.

**Better approach**: Add method to minibob's MCPClient so GoalProcessor can call backend directly.

### 4. Enhance Goal Completion Detection

**Current**: Simple heuristic (if last activity succeeded, goal complete)

**Future**: 
- LLM-based evaluation (ask Claude: "Did we accomplish the goal?")
- Backend goal tracking (metabob-activity-api tracks goal state)
- Multi-activity goals (goal requires 3 activities, track progress)

### 5. Test End-to-End

**Test file**: `test-minibob-e2e/test-goal-driven-flow.ts` (to create)

**Test case**:
```typescript
// Submit goal
const result = await MinibobIntegration.submitGoal(
  sessionID,
  "Add subtract and divide functions to calculator.ts",
  { files: ["calculator.ts"] }
)

// Verify:
// - Multiple activities executed (add-subtract, add-divide)
// - Backend recommendations used
// - Goal marked complete
// - All executions recorded
```

---

## Files Changed

### Minibob

- ✅ `src/goal-processor.ts` - NEW (330 lines)
- ✅ `src/lib.ts` - Exported GoalProcessor

### OpenCode

- ✅ `packages/opencode/src/minibob-integration/index.ts` - Added submitGoal() (226 lines)

---

## Key Architectural Principles

### 1. Minibob is the Orchestrator

**Minibob owns**:
- Goal parsing and understanding
- Activity recommendation (via backend)
- Execution loop management
- Goal completion detection
- SessionMemoryAgent invocation (via hooks)

**OpenCode provides**:
- TUI interface
- User input
- Session management
- Result display

### 2. Backend Handles Recommendations

**metabob-activity-api owns**:
- Thompson Sampling
- Historical execution data
- Success rate tracking
- Activity ranking

**Why**: Learning system needs centralized data, can't live in minibob library.

### 3. Every Activity Has Execution Record

**Old way**: Create template → maybe execute later → orphaned templates

**New way**: Goal → backend recommends → execute → record result → next recommendation

**Benefit**: Complete execution history for learning loop.

---

## Testing Strategy

### Unit Tests

- `goal-processor.test.ts` - Test goal parsing, completion detection
- `minibob-integration.test.ts` - Test submitGoal API

### Integration Tests

- `test-goal-driven-flow.ts` - End-to-end goal submission
- `test-backend-recommendations.ts` - Verify backend integration

### E2E Tests

- Submit real goal via TUI
- Verify multiple activities executed
- Check backend metrics recorded

---

## Migration Path (for Users)

### Phase 1: Backward Compatible (Current)

- Activity tool still works (explicit template execution)
- submitGoal() available as new API
- Users can try goal-driven flow without breaking existing workflows

### Phase 2: Goal Tool (Recommended Next)

- Add `goal` tool that uses submitGoal()
- Document migration guide
- Encourage goal-driven approach

### Phase 3: Deprecate Activity Tool (Future)

- Mark activity tool as deprecated
- All users migrated to goal-driven flow
- Remove duplicate logic

---

## Benefits of New Architecture

### 1. Simplified User Experience

**Before**: User must know template IDs, provide exact variables
```
activity({ 
  templateId: "add-feature-complete",
  variables: { featureName: "...", files: [...], ... }
})
```

**After**: User states intent naturally
```
"Add a subtract function to calculator.ts"
```

### 2. Better Learning Loop

- Backend sees all goal → execution mappings
- Can learn: "Goal X typically needs activities A, B, C"
- Thompson Sampling improves over time

### 3. Reduced Code Duplication

- No duplicate SessionMemoryAgent
- No activity creation logic in opencode
- Minibob owns entire flow

### 4. Proper Separation of Concerns

- **OpenCode**: UI, sessions, user interaction
- **Minibob**: Activity orchestration, execution
- **Backend**: Recommendations, learning, metrics

---

## Next Session TODO

1. **Create goal tool** (new file: `src/tool/goal.ts`)
   - Uses `MinibobIntegration.submitGoal()`
   - Schema: `{ goal: string, context?: Record<string, unknown> }`
   - Returns GoalResult with execution summary

2. **Remove duplicate SessionMemoryAgent**
   - Delete `src/session/memory-agent.ts`
   - Update any imports to use `@metabob/minibob`

3. **Add recommendation method to minibob MCPClient**
   - Implement `MCPClient.recommendActivities()`
   - Remove dependency on MetabobCLI in minibob integration

4. **Test end-to-end**
   - Create `test-goal-driven-flow.ts`
   - Submit real goal, verify executions
   - Check backend metrics

5. **Document for users**
   - Write migration guide
   - Add examples to README
   - Create demo video/walkthrough

---

## Conclusion

We've completed the foundation for goal-driven architecture:

✅ GoalProcessor in minibob  
✅ submitGoal API in MinibobIntegration  
✅ Backend integration for recommendations  

The core orchestration logic is in place. Next steps are:
1. Create user-facing `goal` tool
2. Remove duplicate code
3. Test and document

**Estimated effort**: 2-3 hours to complete remaining work

**Impact**: Transforms minibob from executor → intelligent orchestrator
