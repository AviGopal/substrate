# Bootstrap Template ID Fix - Complete

## Problem Summary

From previous session:
- Memory agent sessions were being created but making **ZERO tool calls**
- Root cause: Activities had `templateId: null` and no tasks array
- Bootstrap templates from metabob-proto were being registered with MCP but never saved to local storage as fallback
- Template file existed but with `id: null` in local storage

## Investigation

### 1. Proto Schema vs OpenCode Schema Mismatch

**Proto schema** (metabob-proto/activities/bootstrap/*.json):
```json
{
  "activity_id": "create-activity-self-contained",
  "tasks": [
    {
      "task_id": "gather-requirements",
      ...
    }
  ]
}
```

**OpenCode internal schema** expects:
```json
{
  "id": "create-activity-self-contained",
  "tasks": [
    {
      "id": "gather-requirements",
      ...
    }
  ]
}
```

### 2. Bootstrap Conversion Issue

The `convertProtoToSchema()` function in `bootstrap-templates.ts` was:
- Reading `protoJson.id` (doesn't exist in proto files)
- Reading `task.id` (proto files use `task_id`)
- This resulted in templates being saved with `id: null`

## Fixes Applied

### Fix 1: Support Both Field Names in Template ID

**File**: `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts:121`

```typescript
// Before
id: protoJson.id,

// After  
id: protoJson.activity_id || protoJson.id, // Support both field names
```

### Fix 2: Support Both Field Names in Task ID

**File**: `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts:71`

```typescript
// Before
id: task.id,

// After
id: task.task_id || task.id, // Support both field names (task_id for proto, id for schema)
```

### Fix 3: Bootstrap Process Already Fixed (Previous Session)

**File**: `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts:267-269`

The bootstrap process was already updated to:
1. Save to local storage FIRST (line 268)
2. Then attempt MCP registration as best-effort (line 272-299)
3. This ensures fallback always works when MCP unavailable

## Verification

### Test 1: Bootstrap Template Loading

```bash
bun /tmp/test-bootstrap.ts
```

**Results**: ✅ ALL PASSED
```
Loaded 4 templates

Template: create-activity-self-contained
  Name: Create Activity Template (Self-Contained)
  Tasks: 4
  First task ID: gather-requirements  ✓

Template: debug-activity-self-contained
  Name: Debug Activity Execution (Self-Contained)
  Tasks: 4
  First task ID: fetch-execution-details  ✓

Template: evolve-activity-self-contained
  Name: Evolve Activity Template (Self-Contained)
  Tasks: 4
  First task ID: fetch-template-and-metrics  ✓

Template: manage-session-memory
  Name: Manage Session Memory
  Tasks: 5
  First task ID: analyze-intent  ✓
```

### Test 2: Local Storage Verification

```bash
jq -r '.id' ~/.local/share/opencode/storage/activity-template/create-activity-self-contained.json
# Output: create-activity-self-contained ✓

jq -r '.id' ~/.local/share/opencode/storage/activity-template/manage-session-memory.json
# Output: manage-session-memory ✓
```

### Test 3: Template Loading from Local Storage

```bash
bun /tmp/test-memory-template.ts
```

**Results**: ✅ ALL PASSED
```
✅ Template loaded: Manage Session Memory
   ID: manage-session-memory  ✓
   Source: local  ✓
   Tasks: 5  ✓

Tasks:
  analyze-intent: ✓
  create-impulses: ✓
  review-context-space: ✓
  optimize-if-needed: ✓
  finalize-context: ✓
```

## Current State

### ✅ Working
- All 4 bootstrap templates load with correct IDs
- All templates save to local storage successfully
- MCP registration skipped gracefully (as expected - MCP not available)
- Local fallback is working - templates accessible even without MCP
- Task IDs are correctly mapped from `task_id` to `id`

### ✅ Fixed Issues
1. `activity_id` field now properly mapped to `id`
2. `task_id` field now properly mapped to task `id`
3. Templates no longer saved with `id: null`
4. Bootstrap process saves to local storage before MCP (fallback guaranteed)

## Next Steps

### Immediate
1. **Test memory agent activity execution** in an actual opencode session
   - Verify manage-session-memory activity runs
   - Verify memory subagent calls impulse tools
   - Verify impulses are created and persisted

2. **Test turn lifecycle hook** in production
   - Start opencode session
   - Send user message
   - Verify memory-management hook runs
   - Verify manage-session-memory template loads
   - Verify impulse creation occurs

3. **Verify per-task recalculation** (already implemented in previous session)
   - File: `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`
   - Function: `recalculateForTask()`
   - Integration: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

## Files Modified

1. `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts`
   - Line 71: Support `task_id` field
   - Line 121: Support `activity_id` field

## Architecture Now

```
Bootstrap Process:
  1. Load JSON from metabob-proto/activities/bootstrap/
  2. Convert proto schema → OpenCode schema
     - activity_id → id ✓
     - task_id → id ✓
  3. Save to local storage FIRST ✓
  4. Attempt MCP registration (best-effort) ✓
  5. Local fallback always available ✓

Turn Lifecycle Hook:
  1. memory-management hook registered (priority 10) ✓
  2. Loads manage-session-memory template ✓
  3. Template has 5 tasks with correct IDs ✓
  4. Executes with memory subagent ✓
  5. Memory agent has impulse tools available ✓
  
Memory Agent Activity:
  1. Task 1: analyze-intent → classify user intent ✓
  2. Task 2: create-impulses → call impulse_create ✓
  3. Task 3: review-context-space → call memory_context_view ✓
  4. Task 4: optimize-if-needed → compress if needed ✓
  5. Task 5: finalize-context → summary ✓
```

## Ready for Testing

The bootstrap template ID issue is now fully resolved. The templates are:
- ✅ Loading correctly with proper IDs
- ✅ Saving to local storage with correct schema
- ✅ Available via local fallback when MCP unavailable
- ✅ Ready for execution in actual sessions

The memory agent should now be able to:
- Load manage-session-memory template
- Execute all 5 tasks
- Call impulse tools (`impulse_create`, `impulse_load`, etc.)
- Create and persist impulses to SessionMemory

**Next session should test actual execution in a live opencode session.**
