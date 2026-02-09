# Activity Orchestration Issue - Analysis

## The Problem

The primary agent is not reliably:
1. Selecting activities to run
2. Running activities in sequence
3. Using create-activity for new patterns

**Instead**: Defaulting to direct execution instead of activity templates.

---

## What Exists (Infrastructure is There)

### 1. Bootstrap Activities ✅

Located in `repos/metabob-proto/activities/bootstrap/`:
- `activity-create.json` - Create new activity templates
- `bug-fix.json` - Fix bugs
- `feature-impl.json` - Implement features
- `refactor.json` - Refactor code
- `code-analysis.json` - Analyze code
- `activity-debug.json` - Debug activities
- `activity-evolve.json` - Evolve templates
- `boredom-task-processor.json` - Process backlog tasks
- `jiggle-documentation.json` - Document features

### 2. Activity Recommendation Hook ✅

**Hook**: `activity-recommendation-injection` (priority 15)

**Location**: `turn-lifecycle-hooks.ts:112-210`

**What it does**:
- Runs before main agent turn
- Searches for relevant activities
- Creates impulse with recommendations
- Injects into session memory

**But from logs**:
```
DEBUG turn-lifecycle hook=activity-recommendation-injection hook disabled
```

**Hook is being disabled!**

### 3. Agent Prompt Instructions ✅

**File**: `agent/activity.txt`

**Instructions**:
```
1. CHECK SESSION MEMORY FIRST - Look for "Available Activities"
2. If activities recommended → USE ONE with activity tool
3. If no recommendations → search_activities({ category })
4. Pattern recognition: Does request match add-feature, fix-bug, etc?
5. If activity found → USE IT
6. Direct execution ONLY for trivial 1-line changes
```

**Activity-first mandate**: "YOU MUST USE ACTIVITY TEMPLATES FOR 80%+ OF TASKS"

---

## Why It's Not Working

### Issue 1: Recommendation Hook Disabled

**From logs**:
```
DEBUG hook=activity-recommendation-injection hook disabled
```

**Why disabled** (from turn-lifecycle-hooks.ts:116-130):

```typescript
enabled: async (ctx) => {
  // Check if there's an active activity
  const currentActivity = Activity.getActivityForSession(ctx.sessionID)
  
  if (currentActivity) {
    // Activity running - don't inject recommendations
    return false  // ← Hook disabled when activity active
  }
  
  // Only enable if NO active activity
  return true
}
```

**Problem**: Hook only runs when NO activity is active.

**But**: If we're already in an activity, we don't get recommendations for what to do next!

### Issue 2: Agent Not Following Instructions

**Despite prompt saying**:
- "MANDATORY: search_activities first"
- "NEVER skip search_activities"
- "Activity-first by default"

**Agent might be**:
- Skipping search
- Going straight to direct execution
- Not checking session memory

**Why?**
- Prompt not strong enough
- Examples show direct execution too much
- No enforcement mechanism
- search_activities might be slow/timeout

### Issue 3: create-activity Not Reliable

**The `activity-create` template exists** but might not be discovered or used.

**Possible issues**:
- Not showing up in search results
- Agent doesn't know when to use it
- Template might have errors
- Execution might fail

---

## Root Causes

### 1. Hook Disabling Logic

**Current logic**:
```
IF activity active → disable recommendations
```

**Problem**: This prevents recommendations during activities!

**Better logic**:
```
IF activity active AND activity not requesting subtasks → disable
IF activity active AND looking for next steps → enable
```

### 2. Weak Enforcement

**Current**: Prompt instructs to use activities

**Reality**: Agent ignores, goes direct

**Need**: Stronger enforcement or guardrails

**Options**:
- Tool visibility (hide write/edit unless activity running)
- Workflow checker (warn if skipping search)
- Metrics (track activity usage rate)

### 3. Search Not Happening

**Check logs**:
```bash
grep "search_activities\|metabob_search_activities" logs | wc -l
```

**If low**: Agent not searching

**Why not?**
- Timeout issues
- MCP connection issues
- Agent skipping step

---

## Proposed Fixes

### Fix 1: Always Inject Recommendations (Even During Activities)

**File**: `turn-lifecycle-hooks.ts:116-130`

**Change from**:
```typescript
if (currentActivity) {
  // Activity running - don't inject
  return false
}
```

**To**:
```typescript
// Always provide recommendations unless explicitly suppressed
// Activities can benefit from knowing what's available for subtasks
return true
```

**Impact**: Recommendations always available, even during activities.

### Fix 2: Add Activity Decision Enforcement

**New hook**: `activity-decision-check` (priority 5, before memory preparation)

**Purpose**: Check if agent is considering activities before proceeding

```typescript
TurnLifecycle.registerHook({
  name: "activity-decision-check",
  priority: 5,  // Before memory preparation
  
  enabled: async (ctx) => {
    // Only for activity mode
    return ctx.agent.name === "activity"
  },
  
  execute: async (ctx) => {
    // Check if this looks like a non-trivial task
    const isTrivial = ctx.promptText.length < 50 || 
                      ctx.promptText.match(/^(hi|hello|ok|thanks)/i)
    
    if (!isTrivial) {
      // Add reminder to session memory
      await SessionMemory.addImpulse(ctx.sessionID, {
        id: "activity-reminder",
        sessionID: ctx.sessionID,
        scope: "session",
        type: "memo",
        description: "Activity workflow reminder",
        pointer: {
          type: "memo",
          content: `REMINDER: Check if this task matches an activity template:
          
1. Check session memory for recommended activities
2. Run search_activities({ category }) to find templates
3. Only use direct execution if truly trivial (1-line change)

This is a NON-TRIVIAL task - strongly consider using an activity!`
        },
        budget: 300,
        priority: "high"
      })
    }
    
    return { success: true, modified: !isTrivial, duration: 5 }
  }
})
```

### Fix 3: Make search_activities More Prominent

**Update agent prompt** to make it even more mandatory:

```markdown
## CRITICAL FIRST STEP - BEFORE ANYTHING ELSE

🛑 **STOP** - Before doing ANYTHING, you MUST:

1. Look at <session_memory> for "Available Activities" or "Recommended Activities"
   - If found: **USE IT** immediately with the activity tool
   
2. If no pre-loaded recommendations: **REQUIRED**: search_activities({ category })
   - category: "feature" | "bugfix" | "refactor" | "infrastructure" | "testing"
   - This is MANDATORY, not optional
   
3. ONLY after searching and finding NO match: Consider direct execution

❌ **NEVER** skip to direct execution without checking for activities first
✅ **ALWAYS** search_activities before implementing
```

---

## Testing Plan

### Test 1: Verify Hook Runs

**Send message**: "Add a new feature to track user sessions"

**Check logs for**:
```
INFO turn-lifecycle executing hook {activity-recommendation-injection}
INFO injecting activity recommendations
INFO activity recommendations injected {impulseId: "activity-recommendations"}
```

**If "hook disabled"**: Fix is needed

### Test 2: Verify Agent Sees Recommendations

**Check session memory impulse**:
```bash
cat ~/.local/share/opencode/storage/session-memory/ses_xxx.json | \
  jq '.impulses["activity-recommendations"]'
```

**Should contain**: List of relevant activities

### Test 3: Verify Agent Uses Activities

**Send**: "Fix the bug in memory-agent.ts"

**Expected**:
```
Agent: I'll search for a bug-fix activity...
[searches]
Agent: Found bug-fix template, executing...
[runs activity]
```

**If instead**:
```
Agent: Let me read the file and fix it...
[direct execution]
```

**Then**: Agent is ignoring activities

---

## Quick Win: Document for User

Create a user-facing guide:

**How to ensure activities are used**:

1. **Explicitly request**: "Use an activity to fix this bug"
2. **Reference by name**: "Run the bug-fix activity"
3. **Check what's available**: "What activities can help with this?"
4. **Report when skipped**: "Why didn't you use an activity?"

---

## Summary

**Infrastructure exists**:
- ✅ Activity templates (9 bootstrap templates)
- ✅ Recommendation hook (but gets disabled)
- ✅ Agent instructions (but not enforced)
- ✅ search_activities tool (but not consistently used)

**Issues**:
- ❌ Recommendation hook disabled during activities
- ❌ Agent not reliably searching/using activities
- ❌ No enforcement mechanism
- ❌ create-activity not being used

**Fixes needed**:
1. Always enable recommendation hook
2. Strengthen prompt enforcement
3. Add activity decision checker
4. Make search more visible/mandatory

Would you like me to implement these fixes to make activity orchestration more reliable?
