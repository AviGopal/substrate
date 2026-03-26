# Memory Agent Architecture Restoration

## Problem

The session memory agent is not properly creating impulses because:

1. Turn lifecycle hook exists but template may not be loading
2. Memory agent not running as subagent session during activities
3. Memory agent not recalculating impulse space on each activity task turn

## Original Architecture (Correct Design)

### How it SHOULD work:

1. **Turn Lifecycle Hook** (`turn-lifecycle-hooks.ts:20-106`)
   - Runs before every primary agent turn (priority: 10)
   - Executes `manage-session-memory` activity template
   - Template ID: `"manage-session-memory"`

2. **manage-session-memory Activity** (`metabob-proto/activities/bootstrap/`)
   - 5 tasks run with `subagent: "memory"`
   - Tasks:
     1. analyze-intent - Classify user intent, suggest impulses
     2. create-impulses - Call `impulse_create` tool for each suggestion
     3. review-context-space - Call `memory_context_view`, decide what to load
     4. optimize-if-needed - Compress/reorder if > 75% utilization
     5. finalize-context - Summary and confirmation

3. **Memory Agent Mode** (`agent.ts:438-552`)
   - Has access to ALL impulse tools:
     - `impulse_create`, `impulse_load`, `impulse_unload`
     - `impulse_delete`, `impulse_list`, `impulse_update`
     - `memory_outline`, `memory_budget`, `memory_optimize`
   - Mode: `"subagent"`
   - Runs as actual session with tool access

4. **Activity Task Execution** (SHOULD invoke memory agent per-task)
   - Before each task, memory agent recalculates impulse space
   - Loads relevant impulses for that specific task
   - Unloads irrelevant impulses from previous tasks

## What Went Wrong

### Investigation Timeline:

**Git History Analysis:**
- `ec97485b` - Original implementation (Jan 2026) - Used `generateObject()` directly
- `01760ea4` - Added `manage-session-memory` to bootstrap templates (Feb 19 04:17)
- `64d961d1` - Refactored to enforce MCP Gateway Architecture (Feb 19 04:29)
  - Removed built-in templates from filesystem
  - Updated to load via MCP
  - **Template may not be accessible via MCP**

**Current State:**
- ✅ Turn lifecycle hook registered and enabled
- ✅ manage-session-memory template exists in metabob-proto
- ✅ Memory agent mode defined with correct tools
- ❌ Template loading may be failing (MCP connection issue?)
- ❌ Activity task execution doesn't invoke memory agent per-task
- ❌ No evidence of memory agent session creation in logs

### Root Cause:

The session you showed had **NO impulse tool calls** because:

1. The memory agent runs via `generateObject()` in the original `analyzeIntent()` function
2. It SHOULD be running as an activity template with actual tool access
3. The turn lifecycle hook tries to run the activity, but it may be failing silently

## Minimal Fixes Needed

### Fix 1: Ensure manage-session-memory template is loadable

**File:** `packages/opencode/src/session/bootstrap-templates.ts`

Verify the template is being registered with MCP properly. If MCP is unavailable, fall back to local loading.

### Fix 2: Add logging to turn lifecycle hook

**File:** `packages/opencode/src/session/turn-lifecycle-hooks.ts:45-105`

Add detailed logging to see if:
- Hook is being invoked
- Template loading succeeds/fails
- Activity execution succeeds/fails

### Fix 3: Invoke memory agent before each activity task

**File:** `packages/opencode/src/session/template-executor.ts`

Before executing each task (line ~400-420), invoke memory agent to recalculate impulse space:

```typescript
// Before task execution
if (!dryRun) {
  await SessionMemoryAgent.recalculateForTask({
    sessionID: session.id,
    taskId: task.id,
    taskDescription: task.description,
    impulseReferences: task.impulseReferences,
  })
}
```

### Fix 4: Ensure activity task sessions have parentID

**File:** `packages/opencode/src/session/template-executor.ts:375`

Session creation already has `parentID: parentSessionID` - verify it's being passed correctly.

## Testing Plan

1. Enable verbose logging in turn lifecycle hook
2. Test with simple user message: "Fix bug in auth.ts"
3. Verify:
   - Hook is invoked
   - manage-session-memory activity runs
   - Memory subagent creates impulses via tools
   - Impulses appear in SessionMemory
4. Test activity execution with manage-session-memory running before each task

## Expected Behavior After Fix

**User sends message:**
```
"Fix the authentication bug"
```

**Turn Lifecycle:**
1. memory-management hook runs (priority 10)
2. Executes manage-session-memory activity
3. Memory subagent analyzes intent
4. Memory subagent calls `impulse_create` for:
   - error-file (auth.ts)
   - metabob-priority-issues
   - conversation-history
5. Memory subagent calls `impulse_load` for HIGH priority
6. Hook completes, main agent turn begins

**Activity Execution:**
1. Activity starts, creates session with parentID
2. Before Task 1: memory agent recalculates
3. Task 1 executes with optimized impulse set
4. Before Task 2: memory agent recalculates
5. Task 2 executes with updated impulse set
6. Activity completes

**Result:**
- Impulses are created and managed properly
- Context stays relevant per task
- Memory usage is optimized
- Agent has the right context at the right time
