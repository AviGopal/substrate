# Context Requirements as Hints - Implementation Plan

**Architecture**: Inject activity context requirements into session memory agent

---

## Current Flow

```
User Message
  ↓
TurnLifecycle: memory-management hook (priority 10)
  ↓
Execute manage-session-memory activity template
  ↓
Task 1: analyze-intent (analyzes user message)
  ↓
Task 2: create-impulses (creates impulses)
  ↓
Task 3: review-context-space (loads impulses)
  ↓
Task 4: optimize-if-needed (compresses if needed)
  ↓
Task 5: finalize-context (summary)
  ↓
Main Agent Executes
```

## New Flow (With Activity Context Requirements)

```
User Message
  ↓
TurnLifecycle: memory-management hook (priority 10)
  ↓
CHECK: Is there an active activity for this session?
  ├─ YES → Get activity.contextRequirements
  └─ NO  → contextRequirements = []
  ↓
Execute manage-session-memory activity template
  WITH VARIABLES:
    - userMessage: ctx.promptText
    - activityContextHints: JSON.stringify(contextRequirements)  ← NEW
  ↓
Task 1: analyze-intent (sees activity hints in prompt)
  ↓
Task 2: create-impulses (wires up impulses matching hints)
  ↓
... rest of flow unchanged ...
```

---

## Implementation Steps

### Step 1: Update turn-lifecycle-hooks.ts

**Location**: `packages/opencode/src/session/turn-lifecycle-hooks.ts` line 59

**Before**:
```typescript
// Execute the manage-session-memory template
const result = await TemplateExecutor.execute({
  templateId: "manage-session-memory",
  variables: {
    userMessage: ctx.promptText,
  },
  reason: `Prepare context for user message: "${ctx.promptText.slice(0, 100)}..."`,
})
```

**After**:
```typescript
// Check if there's an active activity with context requirements
const { Activity } = await import("./activity")
const activityId = Activity.getActivityForSession(ctx.sessionID)
let activityContextHints = ""

if (activityId) {
  try {
    const activity = await Activity.get(activityId)
    const template = await Activity.getTemplate(activity.templateId)
    
    if (template?.contextRequirements && template.contextRequirements.length > 0) {
      activityContextHints = JSON.stringify(template.contextRequirements, null, 2)
      
      log.info("activity context hints detected", {
        sessionID: ctx.sessionID,
        activityId,
        requirementCount: template.contextRequirements.length,
      })
    }
  } catch (error) {
    log.warn("failed to get activity context hints", { error })
  }
}

// Execute the manage-session-memory template
const result = await TemplateExecutor.execute({
  templateId: "manage-session-memory",
  variables: {
    userMessage: ctx.promptText,
    activityContextHints, // ← NEW: Pass context requirements as JSON string
  },
  reason: `Prepare context for user message: "${ctx.promptText.slice(0, 100)}..."`,
})
```

### Step 2: Update manage-session-memory.json template

**Location**: `packages/opencode/templates/built-in/manage-session-memory.json`

**Add new variable** (line 31, after `userMessage`):
```json
{
  "name": "activityContextHints",
  "type": "string",
  "required": false,
  "description": "Activity context requirements (if any) to use as hints for impulse creation"
}
```

**Update Task 1 prompt** (line 22, add section after "## User Message"):
```
## User Message

{{userMessage}}

{{#if activityContextHints}}
## Activity Context Hints

The current activity has requested the following context types as hints:

{{activityContextHints}}

These are SUGGESTIONS, not requirements. Wire up impulses that match these hints if they seem relevant to the user's message. The activity will use whatever context you prepare.

For each hint:
- **key**: Logical name for the context
- **hint**: Human-readable description of what's needed
- **impulseTypes**: Preferred impulse types (file, component, bashOutput, memo, etc.)
- **required**: Whether this is strongly recommended (true) or optional (false)
- **budgetRange**: Suggested token budget [min, max]

Examples of how to fulfill hints:
- "project structure" → bashOutput with `find src -type f | head -50`
- "error context" → file with error file path
- "related components" → component impulses
- "recent changes" → bashOutput with `git log --oneline -10`
{{/if}}

## Your Task
```

### Step 3: Remove gatherContext() call from activity.ts

**Location**: `packages/opencode/src/tool/activity.ts` lines 467-500

**REMOVE entire block**:
```typescript
// Context gathering (if required by template)
if (template.contextRequirements && template.contextRequirements.length > 0) {
  log.info("gathering context for activity", { ... })
  try {
    const impulses = await SessionMemoryAgent.gatherContext({ ... })
    activity.impulses = impulses
    await Activity.save(activity)
  } catch (error) {
    log.error("failed to gather context", { error })
    throw new Error(...)
  }
}
```

**REPLACE with**:
```typescript
// Context requirements handled by session memory agent
// The turn lifecycle hook will pass contextRequirements to manage-session-memory
// which will wire up impulses as hints (not hard requirements)
log.info("activity has context requirements", {
  activityId: activity.id,
  requirementCount: template.contextRequirements?.length || 0,
  hint: "session memory agent will prepare context as hints",
})
```

### Step 4: Update Activity.getTemplate() (if needed)

**Location**: Check if `Activity.getTemplate()` exists in `packages/opencode/src/session/activity.ts`

If it doesn't exist, add:
```typescript
/**
 * Get template for an activity
 */
export async function getTemplate(templateId: string): Promise<ActivityTemplate.Schema | null> {
  try {
    const { ActivityTemplate } = await import("./activity-template")
    return await ActivityTemplate.get(templateId)
  } catch (error) {
    log.warn("failed to get activity template", { templateId, error })
    return null
  }
}
```

---

## Benefits of This Approach

### 1. Unified Context Management ✅
- All context flows through session memory agent
- No duplicate context gathering code
- Activities don't special-case their own context

### 2. Context Requirements as Hints ✅
- Requirements are suggestions, not hard requirements
- Memory agent decides what to wire up based on relevance
- Non-fatal if requirements can't be satisfied

### 3. Leverages Existing Architecture ✅
- Uses existing `manage-session-memory` template
- No new infrastructure needed
- Fits naturally into turn lifecycle

### 4. Better User Experience ✅
- Activities start immediately (no blocking context gathering)
- Context prepared in background (turn lifecycle)
- Graceful degradation if context unavailable

### 5. Observability ✅
- All context decisions logged by memory agent
- Can see which hints were fulfilled
- Easy to debug context issues

---

## Testing Plan

### Test 1: Activity with Context Requirements

```typescript
// Create activity with context requirements
const activity = await Activity.create({
  templateId: "test-with-context-requirements",
  variables: {},
  reason: "Test context hints flow"
})

// Verify:
// 1. Activity starts immediately (doesn't block)
// 2. Turn lifecycle runs manage-session-memory
// 3. Memory agent sees activityContextHints variable
// 4. Impulses created matching hints
// 5. Activity task receives context via impulses
```

### Test 2: Activity Without Context Requirements

```typescript
// Create activity without context requirements
const activity = await Activity.create({
  templateId: "minimal-test-template",
  variables: {},
  reason: "Test without context hints"
})

// Verify:
// 1. Activity starts normally
// 2. activityContextHints is empty string
// 3. Memory agent ignores hints section
// 4. Standard intent analysis used
```

### Test 3: Invalid Context Requirements

```typescript
// Create activity with broken context requirements
const activity = await Activity.create({
  templateId: "activity-with-invalid-hints",
  variables: {},
  reason: "Test error handling"
})

// Verify:
// 1. Activity doesn't crash
// 2. Error logged but non-fatal
// 3. Memory agent proceeds without hints
// 4. Activity continues execution
```

---

## Migration Path

### Phase 1: Add Context Hints (Non-Breaking)
1. Update turn-lifecycle-hooks.ts to pass activityContextHints
2. Update manage-session-memory.json to accept new variable
3. Deploy - existing activities work (activityContextHints is optional)

### Phase 2: Remove gatherContext() (Breaking)
1. Update activity.ts to remove gatherContext() call
2. Test all activities with context requirements
3. Deploy - activities now rely on session memory agent

### Phase 3: Cleanup (Optional)
1. Remove SessionMemoryAgent.gatherContext() function
2. Remove analyzeContextNeeds() function
3. Clean up imports

---

## Rollback Plan

If issues arise:

1. **Immediate**: Revert activity.ts changes, restore gatherContext() call
2. **Quick**: Add feature flag to turn-lifecycle-hooks.ts:
   ```typescript
   const USE_CONTEXT_HINTS = false // Set to true to enable
   if (USE_CONTEXT_HINTS && activityId) {
     // ... get context hints ...
   }
   ```
3. **Safe**: Keep both systems running in parallel for one release

---

## Files to Modify

1. `packages/opencode/src/session/turn-lifecycle-hooks.ts` (~15 lines added)
2. `packages/opencode/templates/built-in/manage-session-memory.json` (~20 lines added)
3. `packages/opencode/src/tool/activity.ts` (~30 lines removed, 5 added)
4. `packages/opencode/src/session/activity.ts` (~10 lines added if getTemplate() missing)

**Total**: ~50 lines changed across 4 files

---

## Next Session Actions

1. ✅ Review this plan
2. ⬜ Implement Phase 1 (add context hints)
3. ⬜ Test with test-with-context-requirements
4. ⬜ Implement Phase 2 (remove gatherContext)
5. ⬜ Test all previously failing activities
6. ⬜ Deploy to production

---

**END OF PLAN**
