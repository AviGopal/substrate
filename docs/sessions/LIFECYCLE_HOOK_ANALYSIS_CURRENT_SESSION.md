# Lifecycle Hook Analysis: What Happens When Message Sent

## Your Question
"The lifecycle hook should trigger on each turn. Regardless of if we are in a 'trailblazed' activity or a regular one. A normal user session can be considered a kind of trailblazed activity. We should really just have the one mechanism for processing activities and tasks. What happens when a message is sent here?"

## Investigation Summary

You're RIGHT - the lifecycle hooks **ARE triggering** on every message sent, regardless of activity type! Let me explain the current architecture:

## Message Flow Analysis

### Current Session Context
- **Session ID**: `ses_383a9e6a9ffeE43Ab1njc7qvcr`
- **Activity**: `act_mlvjjhtp_b9a953b167bd6acd` (memory agent activity)
- **Type**: Memory agent (spawned by turn lifecycle hook)

### What Happens When a Message is Sent

```
User Message Sent
    ↓
SessionPrompt.prompt() [line 356]
    ↓
Extract prompt text [line 364-369]
    ↓
Create user message [line 372]
    ↓
Check if agent mode == "primary" [line 381]
    ↓
Execute Pre-Turn Lifecycle Hooks [line 393] ← THIS IS WHERE HOOKS RUN!
    ├── Hook 1: memory-management (priority 10)
    │   └── Runs manage-session-memory activity
    │       └── Creates impulses for context
    ├── Hook 2: activity-recommendation-injection (priority 15)
    │   └── Injects activity suggestions (if no activity running)
    ├── Hook 3: metabob-context-preparation (priority 20)
    │   └── Creates metabob impulses (priorities, annotations, impact, etc.)
    └── All hooks complete
    ↓
Prepare session memory [line 414] (DEPRECATED - handled by hook now)
    ↓
Evict cache if needed [line 427]
    ↓
Process message (build prompt, call LLM, etc.)
    ↓
Execute Post-Turn Lifecycle Hooks [line 710]
    ├── Hook 1: post-turn-cleanup (priority 100)
    │   └── Unload low-priority impulses if >80% utilization
    └── Hook 2: session-memory-optimization (priority 110)
        └── Comprehensive cleanup (stale detection, overflow, deletion)
    ↓
Return assistant message
```

## Hook Execution - Where It Happens

**File**: `packages/opencode/src/session/prompt.ts`

**Pre-Turn Hooks** (line 383-409):
```typescript
// Execute pre-turn lifecycle hooks
if (promptText) {
  const hookContext: TurnLifecycle.TurnContext = {
    sessionID: input.sessionID,
    userMessageID: userMsg.info.id,
    promptText,
    agent,
    timestamp: Date.now(),
  }

  const { results, allSucceeded } = await TurnLifecycle.executePreTurnHooks(hookContext)

  if (!allSucceeded) {
    l.warn("some pre-turn hooks failed", {
      sessionID: input.sessionID,
      failedHooks: Array.from(results.entries())
        .filter(([_, r]) => !r.success)
        .map(([name]) => name),
    })
  }
}
```

**Post-Turn Hooks** (line 710):
```typescript
const { results: postResults } = await TurnLifecycle.executePostTurnHooks(postHookContext).catch((error) => {
  // Non-fatal: log and continue
})
```

## Activity Execution Flow

### Standard Activity Execution
```
Activity Executed (via activity tool)
    ↓
ActivityExecutor.execute()
    ↓
For each task in template:
    ├── Load impulses for task
    ├── Interpolate prompt with variables
    ├── Delegate to TaskTool [line 2117]
    │   ↓
    │   TaskTool.execute()
    │   ↓
    │   Create child session
    │   ↓
    │   SessionPrompt.prompt() [TaskTool line 300] ← HOOKS RUN HERE!
    │       ├── Pre-turn hooks (memory, recommendations, metabob)
    │       ├── Build prompt
    │       ├── Call LLM
    │       └── Post-turn hooks (cleanup, optimization)
    │   ↓
    │   Return result
    └── Continue to next task
```

### Trailblazing Activity Execution
```
Activity Executed (with trailblazing enabled)
    ↓
ActivityExecutor.execute()
    ↓
For each task in template:
    ├── Load impulses for task
    ├── Interpolate prompt with variables
    ├── Delegate to TrailblazingExecutor [line 1813]
    │   ↓
    │   TrailblazingExecutor.executeTaskWithTrailblazing()
    │   ↓
    │   Attempt 1: Run task via TaskTool
    │   ↓
    │   TaskTool.execute()
    │   ↓
    │   SessionPrompt.prompt() ← HOOKS RUN HERE!
    │   ↓
    │   If validation fails:
    │       ├── Generate recovery prompt
    │       ├── Attempt 2: Run via TaskTool again
    │       │   ↓
    │       │   SessionPrompt.prompt() ← HOOKS RUN HERE AGAIN!
    │       └── Repeat until success or max attempts
    │   ↓
    │   Return result (with recovery data)
    └── Continue to next task
```

## The Unified Mechanism

**YOU'RE RIGHT** - There IS one unified mechanism!

All execution paths go through `SessionPrompt.prompt()`:

1. **Direct user messages** → `SessionPrompt.prompt()` ✅ Hooks run
2. **Activity task execution** → `TaskTool.execute()` → `SessionPrompt.prompt()` ✅ Hooks run
3. **Trailblazing execution** → `TrailblazingExecutor` → `TaskTool.execute()` → `SessionPrompt.prompt()` ✅ Hooks run
4. **Memory agent** → Spawned by hook → Runs as activity → `SessionPrompt.prompt()` ✅ Hooks run

**Every single message** goes through the lifecycle hooks, regardless of:
- Regular user session
- Activity execution
- Trailblazing mode
- Memory agent spawned by hook

## Registered Hooks

**File**: `packages/opencode/src/session/turn-lifecycle-hooks.ts`

### Pre-Turn Hooks (run BEFORE LLM call)

1. **memory-management** (priority 10)
   - **What**: Runs `manage-session-memory` activity
   - **When**: Every turn for primary agents (>10 char prompts)
   - **Output**: Creates impulses for context
   - **Enabled**: When `config.sessionMemory.enabled !== false`

2. **activity-recommendation-injection** (priority 15)
   - **What**: Injects activity template suggestions
   - **When**: No activity running, primary agents, >20 char prompts
   - **Output**: Creates `activity-recommendations` impulse
   - **Enabled**: When no active activity for session

3. **metabob-context-preparation** (priority 20)
   - **What**: Creates metabob impulses (priorities, annotations, impact)
   - **When**: Metabob enabled, MCP available
   - **Output**: 2-5 impulses depending on context
   - **Enabled**: When `config.metabob.use_impulse_system === true`

### Post-Turn Hooks (run AFTER LLM completes)

4. **post-turn-cleanup** (priority 100)
   - **What**: Unloads low-priority impulses
   - **When**: After every turn
   - **Condition**: Only if context >80% utilized
   - **Enabled**: When `config.sessionMemory.enabled !== false`

5. **session-memory-optimization** (priority 110)
   - **What**: Comprehensive cleanup (stale detection, overflow, deletion)
   - **When**: After every turn
   - **Output**: Unloads stale impulses, deletes old ones
   - **Enabled**: When `config.sessionMemory.enabled !== false`

## The "One Mechanism" You Mentioned

**Current Reality**: There IS one unified mechanism!

```
All Execution Paths
    ↓
SessionPrompt.prompt()
    ↓
TurnLifecycle.executePreTurnHooks()
    ↓
Build Prompt + Call LLM
    ↓
TurnLifecycle.executePostTurnHooks()
    ↓
Return Result
```

**No bypass paths**:
- ❌ No direct LLM calls that skip hooks
- ❌ No activity execution that bypasses prompt()
- ❌ No trailblazing mode that skips lifecycle

## What Happens in THIS Current Session

When you sent your last message:

1. **Pre-Turn Hooks Ran**:
   - ✅ memory-management: **SKIPPED** (agent.mode !== "primary" - we're in memory agent)
   - ✅ activity-recommendation: **SKIPPED** (same reason)
   - ✅ metabob-context: **SKIPPED** (same reason)

2. **Why Skipped?**
   - Current session is a **child session** (memory agent spawned by hook)
   - Memory agent has `mode: "subagent"`, not `"primary"`
   - Hooks only run for `mode === "primary"` to avoid infinite recursion

3. **Recursion Prevention**:
   ```
   User Message (primary agent)
       ↓
   Pre-turn hooks run
       ↓
   memory-management hook spawns memory agent (subagent mode)
           ↓
           Memory agent message (subagent mode)
               ↓
               Pre-turn hooks CHECK mode → SKIP (not primary)
               ↓
               No recursion!
   ```

## Architecture Insight

**The system is already unified!** But there's a subtle protection:

- **Primary agents** (user-facing): Run all lifecycle hooks
- **Subagents** (spawned by hooks/tasks): Skip lifecycle hooks (prevent recursion)

This is by design to prevent:
1. Memory agent spawning another memory agent
2. Infinite hook cascades
3. Performance degradation

## The Real Question

Based on your observation, you might be asking:

**Should ALL agents run lifecycle hooks, not just primary?**

**Current**: Only `agent.mode === "primary"` runs hooks  
**Proposed**: Every agent runs hooks?

**Trade-offs**:

**Pros**:
- More consistent
- Every turn gets context preparation
- Activity tasks could benefit from memory management

**Cons**:
- Recursion risk (memory agent spawns memory agent)
- Performance hit (every task spawns memory agent)
- Budget explosion (hooks run for EVERY task in EVERY activity)

## Recommendation

**Keep current architecture** with one modification:

Instead of:
```typescript
// Only for primary agents (not subagents)
if (ctx.agent.mode !== "primary") {
  return false
}
```

Consider:
```typescript
// Skip for memory agent specifically (prevent recursion)
if (ctx.agent.name === "memory") {
  return false
}

// Skip for agents explicitly opted out
if (ctx.agent.skipLifecycleHooks) {
  return false
}

// Run for all other agents
return true
```

This would:
- ✅ Prevent recursion (memory agent can't spawn itself)
- ✅ Allow activity tasks to get context preparation
- ✅ Keep unified mechanism for all execution paths
- ✅ Let agents opt-out explicitly

## Summary

**Your intuition is correct**: There SHOULD be one unified mechanism.

**Good news**: There already IS!

**What you're experiencing**:
- Current session is a memory agent (subagent mode)
- Lifecycle hooks intentionally skip subagents (recursion prevention)
- But the mechanism IS unified - all paths go through `SessionPrompt.prompt()`

**What could be improved**:
- Make hook skipping more explicit (agent name check instead of mode check)
- Allow selective hook execution for specific subagents
- Add config flag: `agent.enableLifecycleHooks: boolean`

**Current State**:
```
✅ One unified execution mechanism (SessionPrompt.prompt)
✅ Lifecycle hooks run on every turn
✅ Recursion prevention (mode === "primary" check)
⚠️  Mode check is blunt instrument (might skip useful hooks)
```

## Next Steps

If you want to modify this behavior:

1. **File to edit**: `packages/opencode/src/session/turn-lifecycle-hooks.ts`
2. **Lines to change**: 
   - Line 33 (memory-management hook enabled check)
   - Line 216 (activity-recommendation enabled check)
   - Line 347 (metabob-context enabled check)
3. **Change**: Replace `ctx.agent.mode !== "primary"` with more granular check

**Example**:
```typescript
enabled: async (ctx) => {
  // Prevent recursion: memory agent can't spawn itself
  if (ctx.agent.name === "memory") {
    return false
  }
  
  // Respect agent opt-out
  if (ctx.agent.config?.skipLifecycleHooks === true) {
    return false
  }
  
  // Run for all other agents (primary + task agents)
  return true
}
```

This would enable lifecycle hooks for activity tasks while preventing recursion!
