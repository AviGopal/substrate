# Session Memory Agent Lifecycle Hook - Architecture Correction

## The Real Problem

After deep investigation, I found the root cause:

### Problem 1: TemplateExecutor is for CLI, Not Lifecycle Hooks

The lifecycle hook is calling `TemplateExecutor.execute()` which:
- **Line 108**: Passes `parentSessionID: undefined` to `executeTasks()`
- Was designed for **CLI execution** (standalone activities)
- Does NOT work in parent/child session model
- Activities created have `callingSessionId: null`

### Problem 2: SessionMemoryAgent.gatherContext() Not Working

You're right - `SessionMemoryAgent.gatherContext()` doesn't work because:
- It's meant for activity tool's contextRequirements
- NOT designed as standalone lifecycle hook
- Requires activity session context to function

### The Correct Architecture: Activities Run in Child Sessions

From `Session.createForActivity()` and the activity tool (line 485-706):

```typescript
// Activity tool creates CHILD session
const activitySession = await Session.createForActivity({
  title: `Activity: ${template.name}`,
  callingSessionID: ctx.sessionID,  // Parent session!
  activityId: activity.id,
})

// Execute template IN THE CHILD SESSION
const result = await executeTemplate(
  template,
  activity,
  params.variables,
  sessionID,  // Child session ID
  ctx.abort,
  parentModel,
  {
    parentSessionID: ctx.sessionID,  // Parent session for context
  }
)
```

**This is the right pattern**: 
- Main session → spawns child activity session → executes tasks → returns to main session
- Enables activity composition (activities calling activities)
- Child sessions are tracked and measurable

## Why Activities Are Stuck in "setup"

The lifecycle hook code:
```typescript
const result = await TemplateExecutor.execute({
  templateId: "manage-session-memory",
  variables: { userMessage: ctx.promptText },
  reason: `...`,
  parentSessionID: ctx.sessionID,  // ❌ This parameter doesn't exist!
})
```

`TemplateExecutor.execute()` signature:
```typescript
export const ExecutionOptions = z.object({
  templateId: z.string(),
  variables: z.record(z.string(), z.unknown()),
  branch: z.string().optional(),
  dryRun: z.boolean().optional(),
  callingSessionId: z.string().optional(),  // ← Should use this
  reason: z.string().optional(),
})
```

The lifecycle hook passes `parentSessionID` but the executor expects `callingSessionId`! And even if fixed, `TemplateExecutor` is the wrong execution path.

## The Right Fix: Use Activity Tool's Execution Path

The lifecycle hook should use the **same execution path as the activity tool**, not TemplateExecutor:

### Step 1: Extract Activity Execution Logic

The activity tool (line 485-950) has the correct execution flow. We need to expose it for lifecycle hooks:

```typescript
// In activity.ts - new export for lifecycle hooks
export async function executeActivityInline(
  templateId: string,
  variables: Record<string, unknown>,
  parentSessionID: string,
  reason: string,
  parentMessageID: string
): Promise<{
  impulses: Record<string, any>
  success: boolean
}> {
  // Load template
  const template = await TemplateRepository.get(templateId)
  
  // Create child session (JUST LIKE ACTIVITY TOOL DOES)
  const activitySession = await Session.createForActivity({
    title: `Lifecycle: ${template.name}`,
    callingSessionID: parentSessionID,
    activityId: "",  // Will be set after activity creation
  })
  
  // Create activity tracking
  const activity = await Activity.create({
    directory: process.cwd(),
    branch: "lifecycle-hook",
    baseCommit: "HEAD",
    title: template.name,
  })
  
  activity.templateId = template.id
  activity.variables = variables
  activity.reason = reason
  activity.callingSessionId = parentSessionID  // ✅ Set parent!
  activity.status = "executing"
  
  // Update session with activity ID
  await Session.update(activitySession.id, (draft) => {
    draft.activityId = activity.id
  })
  
  await Activity.save(activity)
  
  // Execute tasks IN CHILD SESSION (like activity tool)
  const result = await executeTemplate(
    template,
    activity,
    variables,
    activitySession.id,  // Child session
    AbortSignal.timeout(30000),
    await Provider.defaultModel(),
    {
      onStatusUpdate: () => {}, // No UI updates for lifecycle
      parentSessionID: parentSessionID,
    }
  )
  
  // Mark activity complete
  activity.status = result.success ? "done" : "failed"
  activity.completedAt = Date.now()
  await Activity.save(activity)
  
  // Return impulses created in activity session
  return {
    impulses: activity.impulses || {},
    success: result.success,
  }
}
```

### Step 2: Lifecycle Hook Calls Inline Execution

```typescript
// turn-lifecycle-hooks.ts memory-management hook
execute: async (ctx) => {
  const { executeActivityInline } = await import("../tool/activity")
  const { SessionMemory } = await import("./session-memory")
  
  // Execute activity in child session (CORRECT PATTERN)
  const result = await executeActivityInline(
    "manage-session-memory",
    { userMessage: ctx.promptText },
    ctx.sessionID,  // Parent session
    `Prepare context for: "${ctx.promptText.slice(0, 100)}..."`,
    ctx.messageID
  )
  
  // Transfer impulses from activity to PARENT SESSION
  for (const [id, impulse] of Object.entries(result.impulses)) {
    await SessionMemory.addImpulse(ctx.sessionID, impulse)
  }
  
  return { success: result.success, modified: true }
}
```

## Why This Preserves Your Principles

✅ **Uses activity templates**: `manage-session-memory` template executes fully
✅ **Child session model**: Activity runs in child session, not parent
✅ **Enables composition**: Activities can call other activities (same pattern)
✅ **Measurable**: All activity metrics tracked (execution count, success rate, cost)
✅ **Learnable**: Backend receives full activity execution data
✅ **Shareable**: Template shared via MCP, works across environments
✅ **No session proliferation**: Child sessions are properly tracked and closed

## Key Architectural Points

1. **Activities ALWAYS run in child sessions**
   - This enables composition (activities calling activities)
   - Provides isolation and context management
   - Allows proper metrics tracking

2. **Lifecycle hooks use same execution path**
   - Not TemplateExecutor (CLI path)
   - Not SessionMemoryAgent.gatherContext() (too narrow)
   - Same as activity tool (proven working pattern)

3. **Impulse transfer is explicit**
   - Activity creates impulses in its session
   - Lifecycle hook transfers to parent session
   - Clear data flow, measurable at each step

4. **Session hierarchy**:
   ```
   Main session (user interaction)
     ↓
   Before-turn hook (lifecycle)
     ↓
   Activity child session (manage-session-memory)
     ↓
   Memory agent tasks execute
     ↓
   Impulses created in activity session
     ↓
   Hook transfers impulses to main session
     ↓
   Main agent sees impulses in context
   ```

## Testing After Fix

```bash
# 1. Verify child session created but closed properly
find ~/.local/share/opencode/storage/session -name "*.json" \
  -exec jq -r 'select(.activityId != null) | .id' {} \; | wc -l
# Should show activity sessions exist

# 2. Verify impulses in PARENT session
SESSION_ID=$(ls -td ~/.local/share/opencode/storage/session/*/ | head -1 | xargs basename)
cat ~/.local/share/opencode/storage/session-memory/${SESSION_ID}.json | jq '.impulses | length'
# Should be > 0

# 3. Verify activities complete (not stuck in setup)
find ~/.local/share/opencode/storage/activity -name "*.json" \
  -exec grep -l "manage-session-memory" {} \; | \
  xargs jq -r '.status' | sort | uniq -c
# Should show "done" or "failed", NOT "setup"

# 4. Verify parent session ID is set
find ~/.local/share/opencode/storage/activity -name "*.json" \
  -exec grep -l "manage-session-memory" {} \; | head -1 | \
  xargs jq '.callingSessionId'
# Should show parent session ID, NOT null
```

## Implementation Summary

**What to fix**:
1. Create `executeActivityInline()` in `activity.ts`
2. Update lifecycle hook to call `executeActivityInline()`
3. Transfer impulses from activity session to parent session

**What NOT to change**:
- ❌ Don't remove child session creation (it's correct!)
- ❌ Don't use TemplateExecutor (it's for CLI)
- ❌ Don't call SessionMemoryAgent.gatherContext() directly (wrong abstraction)

**The pattern**:
- Lifecycle hook → executeActivityInline() → child session → execute tasks → transfer impulses → parent session

This preserves activity-based architecture while making lifecycle hooks work correctly!
