# Activity Tool Issue Analysis

**Date:** 2026-02-12  
**Issue:** Activity tool appears to be creating activities instead of executing them  
**Status:** 🔍 Under Investigation

---

## Problem Statement

When we executed the "Hello World Test" activity (`infrastructure-ea49acdc`), we observed:

1. **Activity completed immediately** (0.0s duration, $0 cost)
2. **No tasks appeared to execute** (empty task list in output)
3. **New activity was created** (`infrastructure-fa3ee69b`) - same name as the executed one
4. **Template count increased** from 17 to 18

This suggests the activity tool might be:
- Creating/registering new activities instead of executing existing ones
- OR the Hello World template has no actual tasks and just registers itself
- OR there's confusion between "activity execution" and "activity creation"

---

## Expected Behavior

When calling the `activity` tool with an `activityId`:
1. Should **execute the template** identified by that ID
2. Should run each task in the template sequentially
3. Should return results from task execution
4. Should **NOT create new activities** (unless that's what the template does)

Creating new activities should **only** happen when:
1. Using the "Activity Create" template (`INFRASTRUCTURE-0013e379`)
2. The Activity Create template explicitly creates and registers a new template
3. Via the `register_activity_template` MCP tool (not `activity` tool)

---

## Investigation Path

### 1. Activity Tool Flow (OpenCode)

**File:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Execution Flow:**
```typescript
activity({
  activityId: "infrastructure-ea49acdc",
  variables: { greeting_target: "..." },
  reason: "..."
})
  ↓
ActivityTool.execute()
  ↓
TemplateRepository.get(templateId) // Fetch template
  ↓
validateTemplateVariables() // Validate variables
  ↓
MetabobCLI.startExecution() // Start via MCP
  ↓
Loop: getNextStep() → executeStep() → reportStepResult()
  ↓
Return formatted result
```

### 2. MCP Tool Implementation (metabob-cli)

**File:** `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

**Found:** `start_activity_execution_tool` function

**Need to check:**
- What does `start_activity_execution` actually do?
- Does it execute the template or create a new activity?
- Is there confusion between execution and registration?

### 3. Backend API

**Endpoint:** `POST /v2/activities/executions/start`

**Need to verify:**
- What this endpoint does
- Whether it creates new templates or executes existing ones
- Whether the Hello World template has actual tasks

---

## Observations

### Hello World Template

**Activity ID:** `infrastructure-ea49acdc`
**Name:** "Hello World Test"
**Description:** "Simple test activity that prints hello world message"

**From search_activities:**
```json
{
  "id": "infrastructure-ea49acdc",
  "tasks": 3,
  "variables": ["greeting_target"]
}
```

**Expected:** Template should have 3 tasks that print hello world

**Actual Result:**
```
## Activity: Hello World Test ✅
**Status:** Completed
**Template:** infrastructure-ea49acdc vundefined

### Tasks:
(empty)

### Summary:
- Total Duration: 0.0s
- Total Cost: $0.0000
```

**Analysis:** 
- Template has 3 tasks (according to backend)
- But execution shows 0 tasks executed
- Completed instantly (0.0s)
- This suggests execution didn't actually run the tasks

### New Activity Created

**Before execution:** 17 templates
**After execution:** 18 templates

**New Template:**
```json
{
  "id": "infrastructure-fa3ee69b",
  "name": "Hello World Test",
  "description": "Simple test activity that prints hello world message",
  "category": "infrastructure",
  "tasks": 0
}
```

**Analysis:**
- Same name as executed template
- Different ID (`fa3ee69b` vs `ea49acdc`)
- Has 0 tasks (vs original 3 tasks)
- This looks like a new registration, not execution

---

## Hypothesis

### Hypothesis 1: Hello World Template is a Meta-Template
The `infrastructure-ea49acdc` template might be designed to:
1. Register itself as a new template
2. Not actually execute tasks
3. This would be a "bootstrap" or "self-registration" template

**Evidence:**
- New template created with same name
- Instant completion (no actual execution)
- Zero cost (no LLM calls made)

**Counterevidence:**
- Backend shows 3 tasks in original template
- Would be confusing design (why make users execute to register?)

### Hypothesis 2: MCP start_activity_execution Creates Instead of Executes
The MCP tool `start_activity_execution` might be:
1. Misnamed or misused
2. Actually creating a new activity registration
3. Not executing the template tasks

**Evidence:**
- New activity appeared after execution
- No tasks were executed
- Backend endpoint might be POST /activities (create) not /executions (execute)

**Need to verify:**
- Check `start_activity_execution_tool` implementation
- Check what backend endpoint it calls
- Check if endpoint naming is correct

### Hypothesis 3: Template Has No Executable Tasks
The template might have:
1. Task definitions that are empty or invalid
2. Tasks that can't be executed (missing required fields)
3. Meta-tasks that just register the template

**Need to verify:**
- Fetch full template JSON from backend
- Check task structure and content
- Verify tasks have executable content

---

## Next Steps

### Immediate Investigation
1. **Read `start_activity_execution_tool` implementation** in `tools.py`
2. **Check what backend endpoint it actually calls**
3. **Fetch full template JSON** for `infrastructure-ea49acdc`
4. **Check task definitions** to see what they should do

### Testing
1. **Try a different template** with known executable tasks (e.g., Feature Impl)
2. **Check backend logs** for what API calls were made
3. **Verify getNextStep** is returning actual tasks
4. **Check if tasks are in task_steps vs tasks field**

### Fixes
Once we understand the issue:
1. **If MCP tool is wrong:** Fix the tool to execute instead of create
2. **If template structure is wrong:** Fix template to have executable tasks
3. **If it's a meta-template:** Document this clearly and test with real template

---

## Key Questions

1. **What does `start_activity_execution` MCP tool actually do?**
   - Execute template tasks?
   - Register new activity?
   - Something else?

2. **Why did a new template get created?**
   - Is this intentional behavior?
   - Is the Hello World template a bootstrap template?
   - Is there a bug in the execution flow?

3. **Where are the 3 tasks?**
   - Backend says 3 tasks exist
   - Execution showed 0 tasks
   - Are they in different fields (task_steps vs tasks)?

4. **Is the Activity Create template even needed?**
   - If execution creates activities, why have a separate create template?
   - What's the difference between executing and creating?

---

## Related Files

### OpenCode (Consumer)
- `packages/opencode/src/tool/activity.ts` - Activity tool
- `packages/opencode/src/util/metabob.ts` - MCP client
- `packages/opencode/src/session/template-executor.ts` - Direct execution

### metabob-cli (MCP Server)
- `src/metabob_cli/mcp/tools.py` - MCP tool definitions
- `src/metabob_cli/mcp/activity_tools.py` - Activity-specific tools (if exists)
- `src/metabob_cli/mcp/activity_manager.py` - Activity management (if exists)

### Backend (API)
- Endpoint: `/v2/activities/executions/start`
- Endpoint: `/v2/activities/templates`
- Need to verify which is being called

---

## Status

**Current State:** 🔍 Investigation in progress

**Blocker:** Need to understand what `start_activity_execution` does

**Next Action:** Read the MCP tool implementation and check backend API calls

**Priority:** High - This is blocking Activity Create template testing
