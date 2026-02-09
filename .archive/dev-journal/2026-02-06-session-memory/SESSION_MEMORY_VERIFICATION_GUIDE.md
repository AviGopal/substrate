# Session Memory Agent - Verification & Monitoring Guide

## How to Verify the System is Working

### Overview

The session memory agent runs automatically on every turn. Here's how to observe it in action.

---

## 1. Log Trail Verification

### Expected Log Sequence (Every Turn)

When a user sends a message, you should see this sequence in the logs:

#### Step 1: Hook Invocation

```
[turn-lifecycle] executing pre-turn hooks {sessionID, agent, hookCount, promptLength}
[turn-lifecycle] executing hook {hook: "session-memory-preparation", sessionID, priority: 10}
```

**Source**: `src/session/turn-lifecycle.ts:95-121`

**What It Means**: The lifecycle system is triggering the memory preparation hook.

---

#### Step 2: Memory Preparation Starts

```
[session.prompt] prepareSessionMemory() starting {sessionID, promptLength, agent}
```

**Source**: `src/session/prompt.ts:2426`

**What It Means**: The hook successfully called `prepareSessionMemory()`.

---

#### Step 3: Hint Extraction (if activity active)

```
[session.prompt] extracted activity context hints {sessionID, templateId, requirementCount: 2}
```

**Source**: `src/session/prompt.ts:2470`

**What It Means**: Found an active activity with context requirements.

**If NOT seen**: No active activity, or activity has no contextRequirements. This is normal for non-activity sessions.

---

#### Step 4: Budget Check

```
[session-memory-agent] budget status checked {sessionID, utilization: "15.2%", usedTokens: 3500, availableTokens: 88500}
```

**Source**: `src/session/memory-agent.ts:147` (NEW - we just added this)

**What It Means**: Memory agent checked current budget before suggesting impulses.

---

#### Step 5: Intent Analysis

```
[session-memory-agent] analyzeIntent() starting {sessionID, promptLength, model: "haiku"}
[session-memory-agent] analyzeIntent() LLM call completed {hasResult: true, elapsed: 850}
[session-memory-agent] analyzeIntent() completed {type: "code_fix", confidence: 0.95, suggestedImpulsesCount: 3}
```

**Source**: `src/session/memory-agent.ts:124, 356, 398`

**What It Means**: 
- LLM analyzed intent successfully
- Suggested 3 impulses to create
- Took 850ms

---

#### Step 6: Intent Log

```
[session.prompt] intent analyzed {type: "code_fix", confidence: 0.95, suggestedImpulses: 3}
```

**Source**: `src/session/prompt.ts:2494`

**What It Means**: prepareSessionMemory received intent back from memory agent.

---

#### Step 7: Impulse Creation & Loading

```
[session-memory-agent] impulse created {sessionID, impulseId: "errorFile", priority: "high", budget: 2000, willLoadNow: true, loadReason: "high-priority"}
[session-memory-agent] impulse loaded {sessionID, impulseId: "errorFile", loadReason: "high-priority", tokenCount: 1847, budget: 2000, withinBudget: true}
[session-memory-agent] impulse created {sessionID, impulseId: "relatedTests", priority: "medium", budget: 1500, willLoadNow: true, loadReason: "required-context"}
[session-memory-agent] impulse loaded {sessionID, impulseId: "relatedTests", loadReason: "required-context", tokenCount: 965, budget: 1500, withinBudget: true}
```

**Source**: `src/session/memory-agent.ts:912, 930`

**What It Means**: 
- Created 2 impulses
- Both loaded immediately (one high-priority, one required context)
- Total: 2812 tokens loaded

---

#### Step 8: Preparation Complete

```
[session-memory-agent] prepare() completed {sessionID, created: 2, loaded: 2, unloaded: 0, totalTokens: 2812, skipped: 1, hintsProvided: 2, hintsAddressed: "yes", elapsed: 1250}
```

**Source**: `src/session/memory-agent.ts:949`

**What It Means**:
- 2 impulses created
- 2 impulses loaded (not empty!)
- 2 hints were provided by activity
- Hints were addressed ("yes")
- Took 1.25 seconds total

---

#### Step 9: Memory Preparation Done

```
[session.prompt] session memory prepared {created: 2, loaded: 2, unloaded: 0, tokens: 2812, elapsed: 1250}
```

**Source**: `src/session/prompt.ts:2508`

**What It Means**: prepareSessionMemory completed successfully.

---

#### Step 10: Hook Completion

```
[turn-lifecycle-hooks] session memory preparation completed {sessionID, duration: 1280}
[turn-lifecycle] hook completed {hook: "session-memory-preparation", sessionID, success: true, modified: true, duration: 1280}
```

**Source**: `src/session/turn-lifecycle-hooks.ts:58, src/session/turn-lifecycle.ts:131`

**What It Means**: Hook executed successfully and modified state (created impulses).

---

#### Step 11: All Pre-Turn Hooks Done

```
[session.prompt] pre-turn hooks completed {sessionID, hookCount: 3, totalDuration: 2450}
```

**Source**: `src/session/prompt.ts:419`

**What It Means**: All pre-turn hooks finished (memory preparation + others).

---

#### Step 12: Post-Turn Optimization (After Main Agent)

```
[turn-lifecycle] executing post-turn hooks {sessionID}
[turn-lifecycle] executing hook {hook: "session-memory-optimization", sessionID, priority: 110}
[session-memory-lifecycle] optimized session memory for turn {turn: 15, unloaded: 1, deleted: 0, warnings: 0, elapsed: 45}
[session-memory-agent] annotated component interactions {sessionID, annotated: 2, turnNumber: 15}
[turn-lifecycle] hook completed {hook: "session-memory-optimization", sessionID, success: true, modified: true, duration: 180}
```

**Source**: Various locations in turn-lifecycle-hooks.ts and memory-lifecycle.ts

**What It Means**:
- Post-turn optimization ran
- Unloaded 1 stale impulse
- Annotated 2 components
- System automatically cleaned up

---

## 2. Enable Debug Logging

### Check Current Log Level

```bash
# Look for log configuration
grep -r "log\.level\|LOG_LEVEL" repos/metabob-opencode/
```

### Enable Verbose Logging

**Method 1: Environment Variable**

```bash
# Set before running opencode
export DEBUG="*"
# Or specific services:
export DEBUG="session-memory-agent,turn-lifecycle,session.prompt"

opencode chat
```

**Method 2: Check Flag System**

```typescript
// src/flag/flag.ts
export namespace Flag {
  export const OPENCODE_DEBUG = Bun.env.OPENCODE_DEBUG === "true"
  export const OPENCODE_ACTIVITY_DEBUG = Bun.env.OPENCODE_ACTIVITY_DEBUG === "true"
}
```

Set:
```bash
export OPENCODE_DEBUG=true
export OPENCODE_ACTIVITY_DEBUG=true
```

---

## 3. Observable Behaviors

### Behavior 1: Impulses Are Loaded (Not Empty)

**Check in TUI**:
- Open session sidebar
- Look at impulses section
- Should show: `1847/2000 tokens` (not `0/2000`)

**Check in logs**:
```bash
grep "impulse loaded" ~/.local/share/opencode/log/dev.log
# Should show: tokenCount > 0
```

**Check in storage**:
```bash
# Impulses stored at:
cat ~/.local/share/opencode/storage/session-memory-{sessionID}
# Should see: "tokenCount": 1847 (not undefined or 0)
```

---

### Behavior 2: Budget-Aware Suggestions

**In high-utilization session**:

```bash
# Logs should show:
"budget status checked" {utilization: "78.5%"}

# System prompt should contain (check via debug):
"⚠️ WARNING: Budget at 78%"
"Be conservative with impulses (2-3 maximum)"

# Result: LLM suggests fewer impulses
"intent analyzed" {suggestedImpulses: 2}  # Not 5!
```

**Test**:
```typescript
// Create many impulses to hit 70%+ utilization
// Next turn should see conservative suggestions
```

---

### Behavior 3: Automatic Cleanup

**After 5+ turns**:

```bash
grep "optimized session memory" ~/.local/share/opencode/log/dev.log
# Should show:
"optimized session memory for turn" {turn: 15, unloaded: 2, deleted: 1}
"Budget overflow: unloaded 3 impulses to free 4500 tokens"
```

**What triggers cleanup**:
- Stale impulses (not used in 5 turns)
- Budget overflow (total > 10k tokens)
- Very old low-priority (> 10 turns old)

---

### Behavior 4: Component Annotations

**Check metabob state**:

```bash
# Annotations stored in metabob-cli state
cat ~/.metabob/state | grep "SESSION MEMORY"

# Should show entries like:
{
  "file_path": "src/session/memory-agent.ts",
  "component_name": "analyzeIntent",
  "component_type": "function",
  "reason": "SESSION MEMORY: Loaded 1847 tokens\nPriority: high\nTurn: 15\n..."
}
```

**Check metabob-cli logs**:

```bash
tail -f ~/.local/share/metabob-cli/log/mcp.log | grep annotate
# Should show:
"[ANNOTATE] Annotating function 'analyzeIntent' in src/session/memory-agent.ts"
```

---

## 4. Diagnostic Commands

### Check Hook Registration

```typescript
// In opencode console or test:
import { TurnLifecycle } from "./session/turn-lifecycle"

const hooks = TurnLifecycle.getHooks()
console.log(hooks.map(h => ({name: h.name, priority: h.priority})))

// Expected output:
[
  {name: "session-memory-preparation", priority: 10},
  {name: "activity-recommendation", priority: 15},
  {name: "metabob-context", priority: 20},
  {name: "post-turn-cleanup", priority: 100},
  {name: "session-memory-optimization", priority: 110}
]
```

---

### Check Session Memory State

```typescript
import { SessionMemory } from "./session/session-memory"

// Get all impulses
const impulses = await SessionMemory.listImpulses(sessionID)
console.log("Total impulses:", impulses.length)
console.log("Loaded:", impulses.filter(i => i.tokenCount > 0).length)

// Get budget stats
const stats = await SessionMemory.getBudgetStats(sessionID)
console.log("Budget stats:", stats)
// {total: 10000, used: 2812, available: 7188, utilization: 28.1}
```

---

### Check Context Space

```typescript
import { SessionMemoryManager } from "./session/memory-manager"

const space = await SessionMemoryManager.getContextSpace(sessionID)
console.log("Utilization:", space.stats.utilization.toFixed(1) + "%")
console.log("Loaded impulses:", space.stats.loadedCount)
console.log("Priority breakdown:", space.byPriority)
```

---

## 5. Quick Verification Checklist

### ✅ System is Working If:

1. **Hooks Execute**
   ```bash
   grep "executing hook.*session-memory-preparation" logs
   # Found: Hook is triggering
   ```

2. **Function Runs**
   ```bash
   grep "prepareSessionMemory() starting" logs
   # Found: Function is called
   ```

3. **Hints Extracted** (when activity active)
   ```bash
   grep "extracted activity context hints" logs
   # Found: Hints are extracted
   # Not found: No active activity (normal)
   ```

4. **Budget Checked**
   ```bash
   grep "budget status checked" logs
   # Found: Budget awareness active
   ```

5. **Impulses Loaded**
   ```bash
   grep "impulse loaded.*tokenCount" logs
   # Found with tokenCount > 0: Success!
   # Found with tokenCount = 0: Problem
   ```

6. **Optimization Runs**
   ```bash
   grep "optimized session memory for turn" logs
   # Found: Post-turn cleanup running
   ```

7. **Annotations Created**
   ```bash
   grep "annotated component interactions" logs
   # Found: Learning is happening
   ```

---

## 6. Monitoring Commands

### Real-Time Monitoring

```bash
# Watch all session memory activity
tail -f ~/.local/share/opencode/log/dev.log | grep -E "session-memory|turn-lifecycle|impulse"

# Watch specifically memory agent actions
tail -f ~/.local/share/opencode/log/dev.log | grep "session-memory-agent"

# Watch budget status
tail -f ~/.local/share/opencode/log/dev.log | grep "budget\|utilization"

# Watch annotations
tail -f ~/.local/share/opencode/log/dev.log | grep "annotated component"
```

---

### Session Analysis

```bash
# Count hooks executed in a session
grep "hook completed.*session-memory" logs | wc -l
# Should match turn count

# Check impulse creation rate
grep "impulse created" logs | wc -l
# Should be multiple per turn

# Check loading rate
grep "impulse loaded.*tokenCount: [1-9]" logs | wc -l
# Should show loaded impulses (tokenCount > 0)

# Check cleanup frequency
grep "optimized session memory" logs | wc -l
# Should run after every turn
```

---

## 7. Debug Mode

### Enable Full Debug Output

**Set environment variables**:

```bash
export DEBUG="*"
export OPENCODE_DEBUG=true
export OPENCODE_ACTIVITY_DEBUG=true
export LOG_LEVEL=debug
```

**Then run**:

```bash
opencode chat --agent activity
```

**Expected Output**:
- Every hook execution logged
- Every impulse operation logged
- Every budget check logged
- Every annotation logged

---

## 8. Test Scenarios

### Scenario 1: Normal Session (Healthy Budget)

**Setup**: New session, no existing impulses

**Send**: "Fix the bug in memory-agent.ts"

**Expected Logs**:
```
[turn-lifecycle] executing hook {hook: "session-memory-preparation"}
[session-memory-agent] budget status checked {utilization: "0.0%"}
[session-memory-agent] intent analyzed {type: "code_fix", suggestedImpulses: 3}
[session-memory-agent] impulse loaded {tokenCount: 1847}
[session-memory-agent] prepare() completed {created: 3, loaded: 2, hintsProvided: 0}
```

**Verification**:
- ✅ Hook executed
- ✅ Budget healthy (0%)
- ✅ 3 impulses suggested (normal)
- ✅ 2 loaded (high-priority)

---

### Scenario 2: High Utilization (Budget Limited)

**Setup**: Session with 8 loaded impulses (~8000 tokens)

**Send**: "Add a new feature"

**Expected Logs**:
```
[session-memory-agent] budget status checked {utilization: "78.5%"}
[session-memory-agent] intent analyzed {type: "feature_request", suggestedImpulses: 2}
[session-memory-agent] prepare() completed {created: 2, loaded: 1}
```

**Verification**:
- ✅ Budget warning (78%)
- ✅ Only 2 impulses suggested (not 5!)
- ✅ Conservative loading

---

### Scenario 3: Budget Overflow

**Setup**: Session at 11k tokens (over 10k budget)

**Expected Logs**:
```
[session-memory-optimization] optimizing session memory after turn {turnNumber: 25}
[session-memory-lifecycle] Budget overflow: unloaded 3 impulses to free 4500 tokens
[session-memory-optimization] session memory optimized {unloaded: 3, warnings: 1}
```

**Verification**:
- ✅ Overflow detected
- ✅ Automatic eviction occurred
- ✅ Brought back under budget

---

### Scenario 4: Activity with Context Requirements

**Setup**: Execute activity with contextRequirements

**Send**: Start "bug-fix" activity

**Expected Logs**:
```
[session.prompt] extracted activity context hints {templateId: "bug-fix", requirementCount: 2}
[session-memory-agent] impulse created {loadReason: "required-context"}
[session-memory-agent] prepare() completed {hintsProvided: 2, hintsAddressed: "yes"}
```

**Verification**:
- ✅ Hints extracted from template
- ✅ Impulses created matching requirements
- ✅ Required context loaded

---

### Scenario 5: Component Annotations

**Setup**: Complete any turn with loaded impulses

**Expected Logs**:
```
[turn-lifecycle] executing hook {hook: "session-memory-optimization", priority: 110}
[session-memory-optimization] annotated component interactions {sessionID, annotated: 2, turnNumber: 15}
```

**Check storage**:
```bash
cat ~/.metabob/state | python -m json.tool | grep -A10 "SESSION MEMORY"
```

**Verification**:
- ✅ Annotations created
- ✅ Stored in metabob backend
- ✅ Available for future sessions

---

## 9. Verification Script

Create a test script to verify the system:

```typescript
// verify-session-memory.ts

import { SessionMemory } from "./src/session/session-memory"
import { SessionMemoryManager } from "./src/session/memory-manager"
import { TurnLifecycle } from "./src/session/turn-lifecycle"

async function verify(sessionID: string) {
  console.log("=== Session Memory Verification ===\n")
  
  // Check 1: Hooks registered
  const hooks = TurnLifecycle.getHooks()
  const memHook = hooks.find(h => h.name === "session-memory-preparation")
  const optHook = hooks.find(h => h.name === "session-memory-optimization")
  
  console.log("✓ Hook Registration:")
  console.log(`  - session-memory-preparation: ${memHook ? "REGISTERED" : "MISSING"} (priority ${memHook?.priority})`)
  console.log(`  - session-memory-optimization: ${optHook ? "REGISTERED" : "MISSING"} (priority ${optHook?.priority})`)
  console.log()
  
  // Check 2: Impulses exist and loaded
  const impulses = await SessionMemory.listImpulses(sessionID)
  const loaded = impulses.filter(i => i.tokenCount && i.tokenCount > 0)
  
  console.log("✓ Impulse Status:")
  console.log(`  - Total impulses: ${impulses.length}`)
  console.log(`  - Loaded impulses: ${loaded.length}`)
  console.log(`  - Empty impulses: ${impulses.length - loaded.length}`)
  console.log()
  
  // Check 3: Budget tracking
  const stats = await SessionMemory.getBudgetStats(sessionID)
  
  console.log("✓ Budget Status:")
  console.log(`  - Used: ${stats.used} tokens`)
  console.log(`  - Total: ${stats.total} tokens`)
  console.log(`  - Utilization: ${stats.utilization.toFixed(1)}%`)
  console.log()
  
  // Check 4: Context space
  const space = await SessionMemoryManager.getContextSpace(sessionID)
  
  console.log("✓ Context Space:")
  console.log(`  - Available: ${space.stats.availableTokens} tokens`)
  console.log(`  - Utilization: ${space.stats.utilization.toFixed(1)}%`)
  console.log(`  - High priority: ${space.byPriority.high.loaded} loaded`)
  console.log(`  - Medium priority: ${space.byPriority.medium.loaded} loaded`)
  console.log(`  - Low priority: ${space.byPriority.low.loaded} loaded`)
  console.log()
  
  // Summary
  const allGood = (
    memHook !== undefined &&
    optHook !== undefined &&
    loaded.length > 0 &&
    stats.utilization <= 100
  )
  
  console.log(allGood ? "✅ System is WORKING" : "❌ Issues detected")
}

// Usage:
// bun run verify-session-memory.ts <sessionID>
```

---

## 10. Common Issues & Solutions

### Issue: Hook Not Executing

**Symptom**: No logs showing "executing hook"

**Check**:
```bash
grep "hook registered.*session-memory-preparation" logs
```

**If not found**: Import not triggered. Check that `turn-lifecycle-hooks.ts` is imported by `prompt.ts`:
```typescript
// In prompt.ts (line 62):
import "./turn-lifecycle-hooks"
```

---

### Issue: Function Not Called

**Symptom**: Hook executes but prepareSessionMemory never runs

**Check**:
```bash
grep "prepareSessionMemory() starting" logs
```

**If not found**: Export missing or import failed. Check:
```typescript
// In prompt.ts:
export async function prepareSessionMemory(...)

// In turn-lifecycle-hooks.ts:
const Prompt = await import("./prompt")
await Prompt.SessionPrompt.prepareSessionMemory({...})
```

---

### Issue: Hints Not Extracted

**Symptom**: `hintsProvided: 0` in logs

**Possible Causes**:
1. No active activity (expected for non-activity sessions)
2. Activity has no contextRequirements (check template)
3. Template metadata fetch failed (check for warnings)

**Verify**:
```bash
# Check if activity is active
grep "getActivityForSession" logs

# Check if template has requirements
grep "contextRequirements" activity-template.json
```

---

### Issue: Impulses Stay Empty

**Symptom**: `tokenCount: 0` or `undefined`

**Check**:
```bash
grep "impulse created.*willLoadNow: false" logs
# These impulses won't load immediately (expected)

grep "impulse loaded" logs
# Should show some loaded impulses

grep "failed to load impulse" logs
# Check for loading errors
```

**If many failures**: Check file paths, permissions, or ImpulseResolver issues.

---

### Issue: No Annotations

**Symptom**: No "annotated component interactions" logs

**Check**:
```bash
# Is metabob MCP client available?
grep "metabob.*client" logs

# Are there loaded impulses to annotate?
grep "impulse loaded.*tokenCount: [1-9]" logs
```

**If metabob client missing**: Check MCP configuration:
```bash
cat ~/.config/opencode/mcp.json
# Should have metabob server configured
```

---

## 11. Performance Benchmarks

### Expected Timings

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Budget check | < 50ms | < 200ms |
| Intent analysis | < 1000ms | < 3000ms |
| Impulse creation | < 100ms | < 500ms |
| Impulse loading | < 500ms | < 2000ms |
| Total preparation | < 2000ms | < 5000ms |
| Post-turn optimization | < 100ms | < 500ms |
| Annotations | < 500ms | < 2000ms |

### Check Actual Timings

```bash
# From logs:
grep "elapsed:" logs | grep -E "session-memory|prepare\(\)"

# Should show:
"prepare() completed" {elapsed: 1250}  # 1.25 seconds - good!
"session memory optimized" {duration: 180}  # 180ms - excellent!
```

---

## 12. Success Indicators

### System is Working Correctly If:

1. ✅ **Hook logs appear** - "executing hook.*session-memory-preparation"
2. ✅ **Function logs appear** - "prepareSessionMemory() starting"
3. ✅ **Budget checked** - "budget status checked" with utilization
4. ✅ **Impulses created** - "impulse created" multiple times
5. ✅ **Impulses loaded** - "impulse loaded" with tokenCount > 0
6. ✅ **Hints tracked** - "hintsProvided: N, hintsAddressed: yes" (when activity active)
7. ✅ **Optimization runs** - "optimized session memory for turn" after each turn
8. ✅ **Annotations created** - "annotated component interactions" (when impulses loaded)

### Red Flags

1. ❌ No "executing hook" logs - Hook not registered
2. ❌ No "prepareSessionMemory" logs - Function not called
3. ❌ All impulses have tokenCount: 0 - Loading not working
4. ❌ No "budget status checked" - Budget awareness not active
5. ❌ "hintsProvided: N, hintsAddressed: no" - Hints not being used

---

## 13. Example: Complete Session Log

```
Turn 1:
[turn-lifecycle] executing pre-turn hooks {hookCount: 3}
[turn-lifecycle] executing hook {hook: "session-memory-preparation", priority: 10}
[session.prompt] prepareSessionMemory() starting
[session-memory-agent] budget status checked {utilization: "0.0%"}
[session-memory-agent] analyzeIntent() completed {suggestedImpulses: 2}
[session-memory-agent] impulse loaded {impulseId: "errorFile", tokenCount: 1847}
[session-memory-agent] prepare() completed {created: 2, loaded: 1, totalTokens: 1847}
[turn-lifecycle] hook completed {hook: "session-memory-preparation", success: true}
[Main agent executes...]
[turn-lifecycle] executing post-turn hooks
[turn-lifecycle] executing hook {hook: "session-memory-optimization", priority: 110}
[session-memory-lifecycle] optimized session memory for turn {unloaded: 0, deleted: 0}
[session-memory-optimization] annotated component interactions {annotated: 1}
[turn-lifecycle] hook completed {hook: "session-memory-optimization", success: true}

Turn 15 (high utilization):
[turn-lifecycle] executing hook {hook: "session-memory-preparation"}
[session-memory-agent] budget status checked {utilization: "75.3%"}
[session-memory-agent] analyzeIntent() completed {suggestedImpulses: 2}  ← Fewer!
[session-memory-agent] prepare() completed {created: 2, loaded: 1}
[Main agent executes...]
[session-memory-lifecycle] optimized session memory {unloaded: 2, warnings: 1}
[session-memory-lifecycle] Budget overflow: unloaded 2 impulses

Turn 30 (critical utilization):
[session-memory-agent] budget status checked {utilization: "87.2%"}
[session-memory-agent] analyzeIntent() completed {suggestedImpulses: 1}  ← Minimal!
[session-memory-lifecycle] optimized session memory {unloaded: 5, warnings: 1}
```

---

## Summary

### To Verify System is Working:

**Quick Check** (30 seconds):
```bash
tail -100 ~/.local/share/opencode/log/dev.log | grep -E "session-memory-preparation|impulse loaded|optimized session memory"
```

**Expected Output**:
- "executing hook...session-memory-preparation"
- "impulse loaded" with tokenCount > 0
- "optimized session memory for turn"

**If all three present**: System is working ✅

**Detailed Check** (5 minutes):
- Follow all 7 checkboxes in section 5
- Run verification script in section 9
- Check metabob state for annotations

**Result**: Complete confidence that:
- Hooks trigger every turn
- Memory agent creates targeted impulses
- Budget is managed proactively
- Cleanup happens automatically
- Learning accumulates via annotations
