# Impulse Learning System - Schema Fix Complete

## Summary
Fixed schema mismatch between OpenCode frontend and backend for execution step reporting. OpenCode now sends data in the format expected by `ExecutionStepRequest` in the backend learning system.

## Changes Made

### 1. Updated Function Signature - `metabob.ts`
**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`

**Changed from nested schema** (lines 844-856):
```typescript
export async function reportExecutionStep(stepData: {
  executionId: string
  stepIndex: number              // ❌ Wrong field name
  impulsesLoaded: string[]
  impulsesCreated: string[]
  contextSummary: {              // ❌ Nested structure not expected
    totalTokens?: number
    promptTokens?: number
    completionTokens?: number
    duration?: number
    cost?: number
  }
}): Promise<boolean>
```

**Changed to flattened schema**:
```typescript
export async function reportExecutionStep(stepData: {
  executionId: string
  stepOrder: number              // ✅ Correct field name
  success: boolean               // ✅ Added
  output?: string | null         // ✅ Added
  durationMs: number             // ✅ Flattened from contextSummary
  cost: number                   // ✅ Flattened from contextSummary
  tokens: number                 // ✅ Flattened (total tokens)
  impulsesLoaded: string[]
  impulsesCreated: string[]
}): Promise<boolean>
```

**MCP call updated** (lines 872-882):
```typescript
await callMCPTool("report_execution_step", {
  execution_id: stepData.executionId,
  step_order: stepData.stepOrder,        // ✅ Renamed from step_index
  success: stepData.success,             // ✅ Added
  output: stepData.output,               // ✅ Added
  duration_ms: stepData.durationMs,      // ✅ Flattened
  cost: stepData.cost,                   // ✅ Flattened
  tokens: stepData.tokens,               // ✅ Flattened
  impulses_loaded: stepData.impulsesLoaded,
  impulses_created: stepData.impulsesCreated,
})
```

### 2. Updated Trailblazing Path Call Site - `activity.ts`
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` (lines 1187-1227)

**Before**:
```typescript
await MetabobCLI.reportExecutionStep({
  executionId: _activity.id,
  stepIndex,                     // ❌ Wrong field name
  impulsesLoaded: task.impulseReferences || [],
  impulsesCreated,
  contextSummary: {              // ❌ Nested
    totalTokens: result.tokens.input + result.tokens.output,
    promptTokens: result.tokens.input,
    completionTokens: result.tokens.output,
    duration: result.duration,
    cost: result.cost,
  },
})
```

**After**:
```typescript
await MetabobCLI.reportExecutionStep({
  executionId: _activity.id,
  stepOrder,                     // ✅ Correct field name
  success: true,                 // ✅ Added
  output: null,                  // ✅ Added
  durationMs: result.duration,   // ✅ Flattened
  cost: result.cost,             // ✅ Flattened
  tokens: result.tokens.input + result.tokens.output,  // ✅ Flattened
  impulsesLoaded: task.impulseReferences || [],
  impulsesCreated,
})
```

### 3. Updated Standard Execution Path Call Site - `activity.ts`
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` (lines 1482-1520)

**Before**:
```typescript
await MetabobCLI.reportExecutionStep({
  executionId: _activity.id,
  stepIndex,                     // ❌ Wrong field name
  impulsesLoaded: task.impulseReferences || [],
  impulsesCreated,
  contextSummary: {              // ❌ Nested
    totalTokens: tokens.input + tokens.output,
    promptTokens: tokens.input,
    completionTokens: tokens.output,
    duration,
    cost,
  },
})
```

**After**:
```typescript
await MetabobCLI.reportExecutionStep({
  executionId: _activity.id,
  stepOrder,                     // ✅ Correct field name
  success: true,                 // ✅ Added
  output: null,                  // ✅ Added
  durationMs: duration,          // ✅ Flattened
  cost,                          // ✅ Flattened
  tokens: tokens.input + tokens.output,  // ✅ Flattened
  impulsesLoaded: task.impulseReferences || [],
  impulsesCreated,
})
```

## Backend Schema (ExecutionStepRequest)
The backend expects this structure (from `activity_endpoints.py`):

```python
class ExecutionStepRequest(BaseModel):
    execution_id: str
    step_order: int           # 0-based index in topological sort
    success: bool             # Whether step succeeded
    output: Optional[str]     # Step output (optional)
    duration_ms: int          # Execution time in milliseconds
    cost: float               # Execution cost
    tokens: int               # Total tokens used
    impulses_loaded: List[str]
    impulses_created: List[str]
```

OpenCode now sends data matching this exact schema.

## Data Flow

```
Activity Execution (activity.ts)
  ↓
1. Capture impulse state before task
   impulsesBeforeTask = new Set(Object.keys(_activity.impulses))
  ↓
2. Execute task (TaskTool or trailblazing)
   taskResult = await task.execute(...)
  ↓
3. Detect newly created impulses
   impulsesAfterTask = new Set(Object.keys(_activity.impulses))
   impulsesCreated = impulsesAfterTask - impulsesBeforeTask
  ↓
4. Report step data to backend
   MetabobCLI.reportExecutionStep({
     executionId, stepOrder, success, output,
     durationMs, cost, tokens,
     impulsesLoaded, impulsesCreated
   })
  ↓
Backend (metabob.ts)
  ↓
5. Call MCP tool
   callMCPTool("report_execution_step", {
     execution_id, step_order, success, output,
     duration_ms, cost, tokens,
     impulses_loaded, impulses_created
   })
  ↓
MCP Server (activity_endpoints.py)
  ↓
6. Validate request against ExecutionStepRequest
   ✅ Schema matches!
  ↓
7. Persist to execution_steps table
   INSERT INTO execution_steps (...)
  ↓
Learning System
  ↓
8. Update impulse effectiveness in impulse_registry
   UPDATE impulse_registry SET success_rate = ...
```

## Key Design Decisions

### 1. Field Naming
- **stepOrder** (not stepIndex): Matches backend convention
- **durationMs** (not duration): Explicit milliseconds unit
- **tokens** (not totalTokens): Backend expects single integer

### 2. Success Field
- Always `true` in current implementation
- Future: Set to `false` in catch blocks for failed steps
- Enables learning system to distinguish successful vs failed uses

### 3. Output Field
- Currently `null` for all steps
- Future: Could extract task output from TaskTool result
- Useful for debugging and understanding what each step produces

### 4. Non-Blocking Design
- Step reporting wrapped in try/catch
- Errors logged but don't fail activity execution
- Ensures learning system issues don't break user workflows

## Testing Status

### ✅ Compilation
- TypeScript compilation successful
- All platforms built (linux, darwin, windows)
- 13 templates bundled for each platform

### ⏳ End-to-End Testing (Next Step)
Need to verify:
1. Run an activity with impulses
2. Check that data reaches `execution_steps` table
3. Verify `impulse_registry` updates with success rates
4. Confirm no errors in logs

## Next Steps

### 1. End-to-End Testing
```bash
# Run activity with impulses
cd repos/metabob-opencode
bun run opencode activity search

# Check backend logs for step reporting
docker logs devbob-metabob-backend

# Query execution_steps table
docker exec devbob-postgres psql -U metabob -d metabob \
  -c "SELECT * FROM execution_steps ORDER BY created_at DESC LIMIT 5;"

# Query impulse_registry for updates
docker exec devbob-postgres psql -U metabob -d metabob \
  -c "SELECT * FROM impulse_registry WHERE success_rate IS NOT NULL;"
```

### 2. Add Failure Tracking
Update both call sites to set `success: false` in catch blocks:

```typescript
} catch (error) {
  const duration = Date.now() - startTime
  
  // Report failed step
  try {
    await MetabobCLI.reportExecutionStep({
      executionId: _activity.id,
      stepOrder,
      success: false,  // ✅ Track failures
      output: error instanceof Error ? error.message : String(error),
      durationMs: duration,
      cost: 0,  // Failed steps have no cost
      tokens: 0,
      impulsesLoaded: task.impulseReferences || [],
      impulsesCreated: [],
    })
  } catch (reportError) {
    // Non-blocking
  }
  
  throw error
}
```

### 3. Extract Task Output (Optional)
If TaskTool result includes output, extract and send:

```typescript
const output = taskResult.output 
  ? JSON.stringify(taskResult.output).substring(0, 1000)  // Limit size
  : null

await MetabobCLI.reportExecutionStep({
  // ...
  output,
})
```

### 4. Monitor Learning System
- Watch for impulse success rates updating
- Verify templates with high-success impulses get recommended
- Check that low-success impulses trigger warnings

## Files Modified
1. `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` - Function signature + MCP call
2. `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` - Both call sites (trailblazing + standard)

## Architecture Notes

### Impulse Lifecycle
1. **Creation**: Agent creates impulse with pointer (file/bashOutput/memo/url)
2. **Storage**: Impulse stored in activity.impulses map
3. **Loading**: Task specifies impulseReferences to load
4. **Detection**: Compare before/after impulse maps to find newly created
5. **Reporting**: Send loaded + created to backend
6. **Learning**: Backend updates success rates in impulse_registry
7. **Recommendation**: High-success impulses recommended for similar tasks

### Success Rate Calculation
Backend calculates:
```python
success_rate = successful_uses / total_uses
```

Where:
- `successful_uses = COUNT(*) WHERE success = true`
- `total_uses = COUNT(*)`

Learning system uses this to:
- Recommend effective impulses
- Warn about ineffective patterns
- Evolve templates automatically

## Status
✅ **Schema fix complete**  
✅ **TypeScript compilation passing**  
⏳ **End-to-end testing pending**

---
*Last updated: 2026-02-16*
*Session: Impulse Learning System Integration (Continued)*
