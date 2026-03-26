# Memory Agent Fix Analysis

## Root Cause Found ✅

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
**Line**: 2006
**Problem**:

```typescript
const taskResult = await taskToolDef.execute(
  {
    description: task.description,
    prompt: prompt,
    subagent_type: task.subagent,
  },
  {
    sessionID: sessionID,
    abort: abortSignal,
    messageID: Identifier.ascending("message"),
    agent: agent.name,
    parentSessionID: options?.parentSessionID,
    extra: {}, // ← THIS IS THE BUG!
    metadata: (update: any) => { ... },
  },
)
```

The `extra` object is **empty**! The comment says "TaskTool will detect activity context automatically" but that's not true.

## How Impulse Tools Work

All impulse management tools check for `activityId` in this order:

```typescript
const activityId =
  (context.extra?.["activityId"] as string | undefined) || 
  Activity.getActivityForSession(context.sessionID)
```

**Problem**: 
1. `context.extra.activityId` is undefined (extra is empty `{}`)
2. `Activity.getActivityForSession(sessionID)` returns undefined for sub-sessions

**Result**: Tools cannot find the activity context and fail with:
```
impulse_create requires session or activity context
```

## The Fix

### Option 1: Pass activityId in extra (CORRECT FIX)

```typescript
extra: {
  activityId: _activity.id  // ← Pass activity ID to tools!
},
```

This makes impulse tools work because they check `context.extra.activityId` first.

### Option 2: Register sub-session with activity (Alternative)

Update `Activity.getActivityForSession` to track sub-sessions, but this is more complex and less direct.

## Why This Wasn't Caught

1. **Tests use direct tool execution** with `extra: { activityId: testActivity.id }` ✅
2. **Real activity execution** passes `extra: {}` ❌
3. **Gap between test pattern and production code**

## Implementation

Change line 2006 in `activity.ts`:

```diff
- extra: {}, // TaskTool will detect activity context automatically
+ extra: {
+   activityId: _activity.id,
+ },
```

This will make all impulse management tools accessible to the memory agent during task execution.

## Expected Outcome

After this fix:
- ✅ Task 1 (analyze-intent): Works (already working)
- ✅ Task 2 (create-impulses): `impulse_create` tool will work
- ✅ Task 3 (review-context-space): `memory_context_view`, `impulse_load` will work
- ✅ Task 4 (optimize-if-needed): `memory_budget`, `memory_compress` will work
- ✅ Task 5 (finalize-context): `memory_budget`, `memory_context_view` will work

Impulses will be created and loaded into session memory! 🎉
