# Direct Activity Execution Test

Test the deadlock fix by executing an activity via OpenCode's activity tool directly.

## Template: demo-315bfaf1 (Hello World Demo)

This is a simple 2-task template that should complete quickly.

## Expected Result

✅ Execution completes without hanging
✅ Both tasks execute successfully  
✅ Output contains "Hello World"

## Test Command

Execute via activity tool:
```
activity({
  activityId: "demo-315bfaf1",
  variables: {},
  reason: "Test deadlock fix - verify TaskTool creates child session"
})
```

## What Should Happen

1. OpenCode loads template
2. Validates variables (none required)
3. Calls MCP start_execution
4. Gets first step
5. Calls TaskTool.execute() with the step
6. **TaskTool creates CHILD session** (not reusing parent) ← THE FIX
7. SessionPrompt.prompt() acquires lock on child session ← NO DEADLOCK
8. Step executes
9. Reports result
10. Gets next step
11. Repeats
12. Execution completes

## Deadlock Fix Applied

File: `repos/metabob-opencode/packages/opencode/src/tool/task.ts`
Lines: 74-91

**Before (BROKEN - caused deadlock)**:
```typescript
const shouldReuseSession = !!activityId
if (shouldReuseSession) {
  sessionID = ctx.sessionID  // ← REUSES LOCKED SESSION
}
```

**After (FIXED)**:
```typescript
// CRITICAL: Always create child session to avoid deadlock
const session = await Session.create({
  parentID: ctx.sessionID,
  title: params.description + ` (@${effectiveAgentConfig.name} subagent)`,
})
const sessionID = session.id  // ← ALWAYS NEW SESSION
```

Binary version with fix: `0.0.0-fix/mcp-activity-integration-202602150716`
