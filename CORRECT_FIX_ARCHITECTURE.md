# Session Memory Agent Lifecycle Hook - Correct Fix

## Problem Identified

The lifecycle hook is currently using `TemplateExecutor.execute()` which:
1. Creates new activity sessions
2. Gets stuck in "setup" status
3. Never returns impulses to parent session

## The Right Architecture (From Activity Tool)

The `activity` tool (line 485-706 in activity.ts) shows the **correct pattern**:

```typescript
// 1. Create dedicated session for activity work
const activitySession = await Session.createForActivity({
  title: `Activity: ${template.name}`,
  callingSessionID: ctx.sessionID,
  activityId: "",
})

// 2. Call SessionMemoryAgent.gatherContext() DIRECTLY (no new session!)
const impulses = await SessionMemoryAgent.gatherContext({
  requirements: template.contextRequirements,
  reason: params.reason,
  recentMessages: recentWithParts,
})

// 3. Store impulses in activity
activity.impulses = impulses

// 4. Execute tasks in the dedicated session
const result = await executeTemplate(...)
```

**Key insight**: `SessionMemoryAgent.gatherContext()` is a **direct function call**, not an activity/session spawn.

## Correct Fix for Lifecycle Hook

The lifecycle hook should work like the activity tool does at line 588-706:

### Option 1: Call SessionMemoryAgent.gatherContext() Directly

```typescript
// turn-lifecycle-hooks.ts memory-management hook
execute: async (ctx) => {
  const { SessionMemoryAgent } = await import("./memory-agent")
  const { SessionMemory } = await import("./session-memory")
  
  // Get recent messages for context
  const recentMessages = await Session.messages({ sessionID: ctx.sessionID })
  const recent = recentMessages.slice(-5)
  
  // Call memory agent DIRECTLY (no activity, no new session)
  const impulses = await SessionMemoryAgent.gatherContext({
    requirements: [
      {
        key: "relevantContext",
        description: "Context relevant to current user message",
        priority: "high",
        required: false,
      }
    ],
    reason: `Prepare context for user message: "${ctx.promptText.slice(0, 100)}..."`,
    recentMessages: recent,
  })
  
  // Add impulses to CURRENT session memory
  for (const [id, impulse] of Object.entries(impulses)) {
    await SessionMemory.addImpulse(ctx.sessionID, impulse)
  }
  
  return { success: true, modified: true }
}
```

### Option 2: Use Activity Tool Lifecycle Mode (Better for Configurability)

Create a **special lifecycle execution mode** in the activity tool that:
1. Does NOT create a new session
2. Calls SessionMemoryAgent.gatherContext() directly (like line 588-592)
3. Adds impulses to the **calling session** instead of activity session
4. Returns immediately (no task execution)

```typescript
// In activity.ts, add lifecycle mode
export async function executeForLifecycleHook(
  templateId: string,
  variables: Record<string, unknown>,
  sessionID: string,
  reason: string
): Promise<{ impulses: Record<string, any> }> {
  const template = await TemplateRepository.get(templateId)
  
  // Gather context ONLY (no activity creation, no session spawn)
  if (template.contextRequirements) {
    const recentMessages = await Session.messages({ sessionID })
    const recent = recentMessages.slice(-5)
    
    const impulses = await SessionMemoryAgent.gatherContext({
      requirements: template.contextRequirements,
      reason,
      recentMessages: recent,
    })
    
    // Add to calling session
    for (const [id, impulse] of Object.entries(impulses)) {
      await SessionMemory.addImpulse(sessionID, impulse)
    }
    
    return { impulses }
  }
  
  return { impulses: {} }
}
```

Then lifecycle hook calls:
```typescript
execute: async (ctx) => {
  const { executeForLifecycleHook } = await import("../tool/activity")
  
  await executeForLifecycleHook(
    "manage-session-memory",
    { userMessage: ctx.promptText },
    ctx.sessionID, // CURRENT session, not new one
    `Prepare context for: "${ctx.promptText.slice(0, 100)}..."`
  )
  
  return { success: true, modified: true }
}
```

## Why This Preserves Configurability

Option 2 (lifecycle mode in activity tool) preserves your core principles:

✅ **Uses activity templates**: `manage-session-memory` template defines context requirements
✅ **Measurable**: Template metrics still tracked (execution count, success rate)
✅ **Adaptable**: Can change context requirements without code changes
✅ **Learning system compatible**: Backend still receives impulse usage data
✅ **Shareable**: Template shared across environments via MCP

The key difference from regular activity execution:
- **Regular activity**: Creates new session → executes tasks → returns result
- **Lifecycle activity**: Uses current session → gathers context → adds impulses → returns

## Implementation Steps

1. **Add lifecycle execution mode** to activity tool (new export function)
2. **Update lifecycle hook** to call lifecycle mode instead of TemplateExecutor
3. **No session creation** in lifecycle path
4. **Impulses added to current session** directly
5. **Template still configurable** via `manage-session-memory` template

## Benefits

✅ No session proliferation (single current session)
✅ Impulses appear in context window
✅ Activity template system preserved
✅ Learning system works (metrics tracked)
✅ Configurability maintained (template-based)
✅ Measurable and adaptable

## Files to Modify

1. `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
   - Add `executeForLifecycleHook()` export
   - Calls SessionMemoryAgent.gatherContext() directly
   - Adds impulses to calling session

2. `repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts`
   - Replace TemplateExecutor.execute() call
   - Call executeForLifecycleHook() instead
   - Pass current session ID

## Testing

After implementation:
```bash
# 1. Verify no extra sessions
find ~/.local/share/opencode/storage/session -maxdepth 1 -type d \
  -newermt '1 hour ago' | wc -l
# Should be: 1

# 2. Verify impulses in memory
SESSION_ID=$(ls -td ~/.local/share/opencode/storage/session/*/ | head -1 | xargs basename)
cat ~/.local/share/opencode/storage/session-memory/${SESSION_ID}.json | jq '.impulses | length'
# Should be: > 0

# 3. Verify no stuck activities
find ~/.local/share/opencode/storage/activity -name "*.json" \
  -exec grep -l "manage-session-memory" {} \; | \
  xargs jq -r '.status' | grep "setup" | wc -l
# Should be: 0
```

## Alignment with Core Principles

This fix **fully aligns** with your architecture:

1. **Activity-based**: Uses `manage-session-memory` template
2. **Configurable**: Context requirements defined in template, not code
3. **Measurable**: Template execution metrics tracked
4. **Learning system**: Impulse usage reported to backend
5. **Shareable**: Template shared across environments
6. **Lifecycle-aware**: Special execution mode for hooks

The key innovation: **Lifecycle hooks use activity templates WITHOUT creating new sessions**.

This is analogous to:
- Regular activity tool: Full workflow with dedicated session
- Lifecycle activity mode: Context gathering only in current session

Both use templates. Both are measurable. Both preserve configurability.
