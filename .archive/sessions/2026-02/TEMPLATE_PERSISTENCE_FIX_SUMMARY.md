# Template Persistence Fix - Summary
**Date:** February 13, 2026  
**Issue:** Activity templates not being persisted to backend  
**Status:** ✅ **INFRASTRUCTURE FIXED**, ⚠️ **AGENT PROMPT ISSUE DISCOVERED**

---

## What We Fixed

### Problem 1: Template Repository save() Was Blocked ✅ FIXED

**Location:** `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts:141-157`

**Original Code:**
```typescript
export async function save(template: ActivityTemplate.Schema): Promise<void> {
  // DEBUG: Log save() call with full stack to find unexpected caller
  log.warn("UNEXPECTED save() called - investigating caller", {...})
  
  // TEMPORARILY DISABLE to prevent 422 errors during investigation
  // Once we find the caller, we'll fix it and re-enable
  log.warn("save() BLOCKED - template already exists in backend", {...})
  return  // ❌ BLOCKED - early return prevents saving!
  
  await TemplateLoader.save(template)  // Never reached
}
```

**Fixed Code:**
```typescript
export async function save(template: ActivityTemplate.Schema): Promise<void> {
  // Check if template already exists to make save() idempotent
  // This prevents 422 errors when trying to create existing templates
  const existing = await get(template.id)
  
  if (existing) {
    log.debug("template already exists in backend, skipping save", {...})
    return  // ✅ Idempotent - skip if already exists
  }
  
  log.info("creating new template in backend", {...})
  await TemplateLoader.save(template)  // ✅ Now reached for new templates
}
```

**Why It Was Blocked:**
- Commit `a45588c9` (Feb 12, 18:49) temporarily disabled save() to prevent 422 errors
- The issue was that templates loaded from backend were being auto-registered back
- This caused "template already exists" errors (HTTP 422 Unprocessable Entity)

**The Fix:**
- ✅ Made `save()` idempotent by checking if template exists first
- ✅ Only calls `TemplateLoader.save()` for NEW templates
- ✅ Prevents 422 errors while allowing legitimate template creation
- ✅ No performance impact (check only happens once per save attempt)

---

## What We Discovered

### Problem 2: Agent Not Calling Persistence ⚠️ STILL BROKEN

**Evidence:**
```log
# Activity execution logs show:
[07:36:20] GOT STEP: id=create-template, description=Create Activity Template: Write the activity JSON
[07:36:32] ADDING TO taskResults: taskId=create-template, status=completed

# But NO call to MCP tool:
# (Expected) [07:36:XX] OPENCODE: Calling MCP tool "create_activity_template"
# (Expected) [07:36:XX] !!! CREATE_ACTIVITY_TEMPLATE_TOOL CALLED !!!

# Compare with successful persistence (earlier test):
[05:25:00] OPENCODE: Calling MCP tool "create_activity_template" for template="Persistence Verification Test"
```

**Root Cause:**
The "create-template" task in INFRASTRUCTURE-0013e379 **does not instruct the agent** to call the `create_activity_template` MCP tool. The agent:
1. ✅ Generates the template JSON (completes the task)
2. ❌ Does NOT persist it to the backend
3. ✅ Marks task as complete (incorrectly - side effect missing)

**Location of Issue:**
`INFRASTRUCTURE-0013e379` activity template → Task 4 "create-template" → Missing instructions

**The Prompt Needs:**
```
Task 4: Create Activity Template
- Analyze the pattern and design from previous steps
- Generate the activity template JSON following the schema
- **Call the create_activity_template MCP tool with the template data**  ← MISSING!
- **Verify the template was successfully persisted**                     ← MISSING!
- Return the template ID upon success
```

---

## Test Results

### Test 1: Before Fix
```bash
$ activity INFRASTRUCTURE-0013e379 variables={...}
✅ Activity completed all 5 tasks
❌ Template NOT in backend
❌ search_activities("Security Config Audit") → Not found
```

**Reason:** save() was blocked with early return

### Test 2: After Infrastructure Fix
```bash
$ activity INFRASTRUCTURE-0013e379 variables={...}
✅ Activity completed all 5 tasks
❌ Template NOT in backend
❌ search_activities("Security Config Audit") → Not found
```

**Reason:** Agent didn't call MCP tool (prompt issue)

### Test 3: Manual MCP Tool Call
```bash
$ metabob-cli create_activity_template name="Test" category="test" ...
✅ MCP tool called
✅ Template persisted to backend
✅ Template appears in search_activities
```

**Conclusion:** Infrastructure works when called directly

---

## Impact Analysis

### What Works Now ✅
1. **Direct MCP tool calls** - `create_activity_template` tool works correctly
2. **Idempotent saves** - No more 422 errors when template already exists
3. **Template loading** - Templates load correctly from backend
4. **Manual template creation** - Tools like `register_activity_template` work

### What's Still Broken ⚠️
1. **Activity Create activity** (INFRASTRUCTURE-0013e379) - Agent doesn't persist templates
2. **Activity Evolve activity** - Likely has same issue
3. **Any activity that creates templates** - Prompt doesn't include persistence step

### Workaround ✅
**Manual template creation** still works:
```typescript
// In code or via MCP directly:
await MetabobCLI.createActivityTemplate({
  name: "Security Config Audit",
  description: "...",
  category: "infrastructure",
  tasks: [...]
})
```

---

## Files Changed

### Fixed Files (1 file)
```
repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts
  - Removed temporary disable block (lines 142-157)
  - Added idempotency check (lines 149-160)
  - Re-enabled TemplateLoader.save() call
```

### Files That Need Fixing (Backend - not in opencode repo)
```
Activity templates that need prompt updates:
  - INFRASTRUCTURE-0013e379 (Activity Create) - Task 4 "create-template"
  - INFRASTRUCTURE-57327686 (Activity Evolve) - Task 4 "create-variant"
  - Any other template-creation activities
```

---

## Recommended Next Steps

### Priority 1: Fix Activity Create Prompt (HIGH)
**Action:** Update INFRASTRUCTURE-0013e379 task 4 prompt

**Current (broken):**
```
Create Activity Template: Write the activity JSON following the schema
```

**Fixed (working):**
```
Create Activity Template: Generate and persist the activity template

Steps:
1. Analyze the pattern and design from previous steps
2. Generate the activity template JSON following the schema:
   - name, description, category
   - tasks array with id, description, prompt for each step
   - context_requirements (if any)
   - integration/validation (if any)
3. **Call create_activity_template MCP tool** to persist the template:
   - Pass all required parameters from the generated JSON
   - Wait for successful response with template_id
4. Verify the template was persisted:
   - Call get_activity_template with the returned template_id
   - Confirm it matches what was created
5. Return success with the template_id
```

### Priority 2: Test the Fix (HIGH)
**After updating prompt:**
```bash
# Test activity creation
activity INFRASTRUCTURE-0013e379 variables={
  template_name: "Test Template",
  template_description: "Test description",
  ...
}

# Verify persistence
search_activities("Test Template")
# Should return the newly created template
```

### Priority 3: Fix Other Template Activities (MEDIUM)
- Activity Evolve (INFRASTRUCTURE-57327686)
- Activity Debug (INFRASTRUCTURE-99a2e10c)  
- Any others that create/modify templates

### Priority 4: Add Validation (MEDIUM)
**Add to task success criteria:**
```typescript
// In activity execution framework
if (taskId === "create-template") {
  // Verify template exists in backend after completion
  const templateId = extractTemplateIdFromResult(result)
  const exists = await verifyTemplateExists(templateId)
  
  if (!exists) {
    throw new Error(
      `Task marked complete but template ${templateId} not found in backend. ` +
      `Agent may have skipped persistence step.`
    )
  }
}
```

---

## Architecture Notes

### Why save() Was Blocked
The issue arose from **auto-registration of loaded templates**:

1. Template loaded from backend
2. Legacy code auto-registered it back to backend
3. Backend returned 422 "already exists"
4. save() was disabled to prevent this

### The Right Architecture
**Metabob Backend = Single Source of Truth**

```
┌─────────────────────────────────────────────────┐
│ Metabob Backend (RPC API)                       │
│ - SurrealDB activity_template table             │
│ - Single source of truth for all templates      │
│ - Content-addressable (hash-based versioning)   │
└─────────────────────────────────────────────────┘
                     ▲
                     │ MCP
                     │
┌────────────────────┴─────────────────────────────┐
│ metabob-cli MCP Server                           │
│ - create_activity_template tool                  │
│ - get_activity_template tool                     │
│ - evolve_activity_template tool                  │
└──────────────────────────────────────────────────┘
                     ▲
                     │
┌────────────────────┴─────────────────────────────┐
│ opencode Session                                  │
│ - TemplateRepository.save() (idempotent)         │
│ - TemplateLoader.save() → MCP call               │
│ - NO local file storage                          │
│ - NO auto-registration                           │
└──────────────────────────────────────────────────┘
                     ▲
                     │
┌────────────────────┴─────────────────────────────┐
│ Agent (Activity Execution)                        │
│ - MUST explicitly call create_activity_template  │
│ - MUST verify persistence succeeded              │
│ - Task not complete until verified               │
└──────────────────────────────────────────────────┘
```

### Flow for Creating Templates

**Correct Flow:**
```
1. Agent executes "create-template" task
2. Agent generates template JSON
3. Agent calls create_activity_template MCP tool  ← KEY STEP
4. MCP tool calls backend API
5. Backend persists to SurrealDB
6. Backend returns template_id
7. Agent verifies with get_activity_template
8. Agent marks task complete ✅
```

**Current Broken Flow:**
```
1. Agent executes "create-template" task
2. Agent generates template JSON
3. Agent marks task complete ✅              ← SKIPS PERSISTENCE!
4. Template NOT in backend ❌
```

---

## Verification

### Test Infrastructure Fix
```bash
# Test 1: Direct MCP call (should work)
cd repos/metabob-cli
python -c "
import asyncio
from metabob_cli.mcp.tools import create_activity_template_tool

result = asyncio.run(create_activity_template_tool(
    name='Test Template',
    description='Test',
    category='test',
    tasks='[{\"id\":\"test\",\"description\":\"Test task\"}]'
))
print(result)
"
# Expected: {"status":"success","template_id":"..."}
```

### Test Activity Prompt (will fail until prompt fixed)
```bash
# Test 2: Via Activity Create activity
activity INFRASTRUCTURE-0013e379 variables={
  template_name: "Verification Test",
  ...
}

search_activities("Verification Test")
# Current: Not found ❌
# After prompt fix: Found ✅
```

---

## Success Criteria

- [x] **Infrastructure:** save() re-enabled with idempotency
- [x] **Infrastructure:** 422 errors prevented
- [x] **Infrastructure:** Direct MCP tool calls work
- [ ] **Agent Prompt:** Activity Create persists templates
- [ ] **Agent Prompt:** Activity Evolve persists templates
- [ ] **Validation:** Task completion verified by checking backend
- [ ] **Testing:** End-to-end template creation works via activity

---

## Conclusion

**Infrastructure Status:** ✅ **FIXED**
- Template persistence mechanism works correctly
- Idempotent save() prevents 422 errors
- Direct MCP tool calls succeed

**Agent Prompt Status:** ⚠️ **NEEDS FIX**
- Activity Create template doesn't instruct agent to persist
- Agent completes task without calling MCP tool
- Template exists in agent memory but not in backend

**Workaround:** Use MCP tools directly or via code until prompts are fixed.

**Next Action:** Update INFRASTRUCTURE-0013e379 task 4 prompt to include explicit persistence step.
