# MiniBob Architecture: Goal-Only Interface

**Date**: 2026-03-20  
**Status**: Architecture refinement needed  
**Current**: Dual interface (goal + activity tools)  
**Target**: Single interface (goal tool only)

---

## Executive Summary

**Current Problem**: We have **two ways** to interact with MiniBob:
1. `goal` tool - Submit natural language goals, MiniBob handles everything
2. `activity` tool - Directly execute specific activity templates

**Correct Architecture**: **Only the `goal` tool should exist**. MiniBob should handle all activity selection, creation, and execution internally.

**Why This Matters**:
- **Separation of concerns**: OpenCode = UI/UX, MiniBob = activity orchestration
- **Flexibility**: MiniBob can create activities on-the-fly if none exist
- **Simplicity**: Single interface, easier to understand and maintain
- **Future-proof**: All intelligence lives in MiniBob, not OpenCode

---

## Current State Analysis

### What We Built (Phases 1-3)

**Phase 1**: Migrated `activity` tool to use MiniBob
- **Problem**: We're still exposing template-level execution
- **Issue**: OpenCode decides WHICH activity to run (template selection)
- **Wrong layer**: Activity selection should be MiniBob's responsibility

**Phase 2**: TUI displays MiniBob state
- **Good**: Shows goal and activity progress
- **Issue**: Still shows "activity execution" as user-facing concept

**Phase 3**: MCP tool forwarding
- **Good**: MiniBob has access to all tools
- **Correct**: This enables MiniBob to be fully autonomous

### Current Tool Inventory

**Goal-Related** (✅ Keep):
```
goal.ts - Submit goals to MiniBob
goal.txt - Tool description
```

**Activity-Related** (❌ Remove or deprecate):
```
activity.ts - Direct activity execution (REDUNDANT)
activity-legacy.ts.backup - Old implementation backup
activity-minibob.ts - MiniBob delegation version
activity.txt - Tool description
activity-replay.ts - Replay failed activities
activity-error-inspector.ts - Debug activity failures
```

**Template Management** (⚠️  Discussion needed):
```
list-activity-templates.ts - List available templates
register-activity-template.ts - Register new templates
create-activity-goal-seeking.ts - Create templates from goals
get-activity-template.ts - Fetch template details
post-activity-result.ts - Report execution results
```

---

## Correct Architecture

### Single Interface: Goal Tool Only

```
User (LLM Agent)
  ↓
  "Add a subtract function to calculator.ts"
  ↓
goal tool (OpenCode)
  ↓
MinibobIntegration.submitGoal()
  ↓
@metabob/minibob GoalProcessor
  ↓
  ├─> Parse goal intent
  ├─> Check if suitable activity template exists
  │   ├─> YES: Use existing template
  │   └─> NO: Create template on-the-fly
  ├─> Execute activity with template
  ├─> Check goal completion
  └─> Repeat until complete or limits reached
  ↓
Return result to user
```

**Key Principle**: User never specifies "which activity" or "which template". They only specify WHAT they want (goal). MiniBob figures out HOW (activities/templates).

---

## What Should Change

### 1. Deprecate `activity` Tool ❌

**Current**: Users can call `activity({ templateId: "add-feature", ... })`

**Problem**:
- Exposes internal implementation (template selection)
- Bypasses goal-driven workflow
- Requires users to know template IDs
- Duplicates logic that should live in MiniBob

**Action**: 
- Mark `activity` tool as deprecated
- Update system prompt to only mention `goal` tool
- Eventually remove from tool registry

**Migration Path**:
```typescript
// OLD (deprecated)
activity({
  templateId: "add-feature-complete",
  variables: { featureName: "subtract", files: ["calc.ts"] },
  reason: "User requested subtract function"
})

// NEW (correct)
goal({
  goal: "Add a subtract function to calculator.ts",
  context: { files: ["calc.ts"] }
})
```

---

### 2. Template Management Tools - Keep or Remove?

**Question**: Should users/agents be able to:
- List available templates?
- Register new templates?
- Create templates from goals?

**Arguments FOR Keeping**:
- Template introspection useful for debugging
- Manual template registration needed for edge cases
- Goal-seeking template creation is a power feature

**Arguments FOR Removing**:
- Violates separation of concerns (MiniBob owns templates)
- Template management should be backend concern
- Users shouldn't need to think about templates

**Recommendation**: **Keep but limit exposure**
- Keep `list_activity_templates` for debugging/introspection
- Keep `register_activity_template` for advanced users
- Keep `create_activity_goal_seeking` (goal → template is valid use case)
- Remove from default system prompt (advanced tools only)

---

### 3. Activity Debugging Tools - Keep or Remove?

**Tools**:
- `activity_error_inspector` - Debug failed activities
- `activity_replay` - Retry failed activities

**Arguments FOR Keeping**:
- Debugging is essential
- Replay is useful for recovery

**Arguments FOR Removing**:
- Should be automatic (MiniBob handles retries)
- Exposes internal implementation details

**Recommendation**: **Keep but make internal**
- Useful for development/debugging
- Not exposed in default system prompt
- MiniBob should handle retries internally (no manual replay needed)

---

### 4. System Prompt Changes

**Current System Prompt** (Activity Mode):
```
You have access to:
- activity tool - Execute activity templates
- goal tool - Submit goals for execution
- search_activities - Find templates
- ...
```

**New System Prompt** (Goal-Only Mode):
```
You have ONE tool for execution:
- goal tool - Submit natural language goals

MiniBob handles:
- Activity selection
- Activity creation (if needed)
- Task execution
- Retries and error handling

You should ALWAYS use the goal tool, never directly execute activities.

Example:
goal({
  goal: "Add authentication to the API with JWT tokens",
  context: { files: ["src/api/auth.ts"] },
  maxActivities: 5,
  maxCost: 10.0
})
```

---

## Benefits of Goal-Only Architecture

### 1. Simplicity ✅
- **Single interface**: Only one way to do work
- **Less cognitive load**: User thinks in goals, not templates
- **Easier onboarding**: "Use goal tool for everything"

### 2. Flexibility ✅
- **Dynamic templates**: MiniBob creates templates as needed
- **No template gaps**: If no template exists, MiniBob generates one
- **Adaptive**: MiniBob can chain multiple activities without user intervention

### 3. Separation of Concerns ✅
- **OpenCode**: UI, session management, tool forwarding
- **MiniBob**: Activity orchestration, template selection, execution
- **Clean boundary**: No leaky abstractions

### 4. Future-Proof ✅
- **Intelligence in MiniBob**: All decision-making logic centralized
- **OpenCode is thin client**: Just passes goals and displays results
- **Easy to swap**: Could replace MiniBob with different backend

---

## Migration Plan

### Immediate (High Priority)

**1. Update System Prompts**
- Remove `activity` tool from default prompt
- Emphasize `goal` tool as primary interface
- Add examples of goal usage

**2. Deprecate Activity Tool**
- Add deprecation warning to `activity.ts`
- Log warning when tool is used
- Point users to `goal` tool instead

```typescript
// src/tool/activity.ts
export const ActivityTool = Tool.define("activity", async () => {
  return {
    description: "⚠️ DEPRECATED: Use 'goal' tool instead.\n\n" + DESCRIPTION,
    async execute(params, ctx) {
      log.warn("activity tool is deprecated, use goal tool instead", {
        templateId: params.templateId,
        sessionID: ctx.sessionID,
      })
      
      // Still execute for backwards compatibility
      // ...
    }
  }
})
```

**3. Update Documentation**
- README: Remove activity tool examples
- Migration guide: goal tool is the way
- API docs: Mark activity as deprecated

---

### Short Term (Medium Priority)

**4. Hide Activity Tool from Agent**
- Remove from tool registry (or mark hidden)
- Only expose via explicit opt-in flag
- Default to goal-only mode

**5. Test Goal-Only Workflow**
- Execute common tasks using only goal tool
- Verify MiniBob handles all cases
- Document any gaps or issues

**6. Update Activity Mode System Prompt**
```diff
- You default to activity templates for structured, repeatable workflows
- Use direct execution ONLY for trivial one-off changes
+ You use the goal tool for ALL implementation work
+ MiniBob handles activity selection, creation, and execution automatically
```

---

### Long Term (Low Priority)

**7. Remove Activity Tool Entirely**
- Delete `activity.ts`, `activity-minibob.ts`
- Remove from tool registry
- Clean up related code

**8. Simplify Template Tools**
- Make template management internal-only
- Remove from user-facing documentation
- Keep for debugging/advanced use

---

## Open Questions

### 1. Should users ever specify template IDs?

**Current**: Users can say "use add-feature-complete template"

**Option A**: Never - MiniBob always decides
- Pro: True separation of concerns
- Con: Users lose control

**Option B**: Sometimes - Allow template hints in goal context
```typescript
goal({
  goal: "Add subtract function",
  context: { 
    files: ["calc.ts"],
    preferredTemplate: "add-feature-complete" // Hint, not requirement
  }
})
```

**Recommendation**: Option B - hints allowed but not required

---

### 2. How does MiniBob create templates on-the-fly?

**Current**: `create_activity_goal_seeking` tool exists

**Options**:
- A. MiniBob calls OpenCode's `create_activity_goal_seeking` tool (current)
- B. MiniBob has internal template creation logic
- C. MiniBob asks backend API to create template

**Recommendation**: Option A for now, migrate to B/C later

---

### 3. What about activity replay for failures?

**Current**: `activity_replay` tool for retrying failed activities

**Options**:
- A. Remove - MiniBob handles retries internally
- B. Keep - Useful for manual recovery
- C. Make automatic - MiniBob retries without user intervention

**Recommendation**: Option C - automatic retries with configurable limits

---

## Implementation Checklist

### Phase 1: Deprecation (Immediate)
- [ ] Add deprecation warning to `activity` tool
- [ ] Update system prompts to emphasize `goal` tool
- [ ] Add migration examples to documentation
- [ ] Test goal-only workflow with common tasks

### Phase 2: Removal (Short Term)
- [ ] Hide `activity` tool from default tool registry
- [ ] Remove activity tool from agent system prompt
- [ ] Update Activity Mode philosophy to goal-first
- [ ] Validate all common workflows work with goal tool only

### Phase 3: Cleanup (Long Term)
- [ ] Delete `activity.ts` and related files
- [ ] Simplify tool inventory
- [ ] Update all documentation
- [ ] Remove activity-centric language from codebase

---

## Success Metrics

### ✅ Correct Architecture When:
1. Users **never call** `activity` tool directly
2. All work flows through `goal` tool
3. MiniBob handles **all** activity selection/creation
4. OpenCode is **thin client** (just passes goals)
5. Template management is **internal detail**

### ❌ Wrong Architecture When:
1. Users manually select templates
2. Multiple ways to execute activities
3. OpenCode has activity orchestration logic
4. Template IDs appear in user-facing docs

---

## Summary

**Core Issue**: We built a great MiniBob integration (Phases 1-3) but kept the wrong interface. We should have **only the `goal` tool**, not both `goal` and `activity`.

**Correct Flow**:
```
User → goal tool → MiniBob → (templates, activities, tasks) → Result
```

**Not**:
```
User → activity tool → MiniBob → (execute specific template) → Result
```

**Action Plan**:
1. **Deprecate** `activity` tool immediately
2. **Update** system prompts to goal-only
3. **Test** that goal tool handles all workflows
4. **Remove** activity tool eventually

**Timeline**: Can deprecate in 1 commit, full removal in 1-2 weeks after validation.

---

## Recommendation

**Next Commit**: Deprecate activity tool and update system prompts

This clarifies the architecture and moves us toward the correct goal-only interface without breaking existing functionality.
