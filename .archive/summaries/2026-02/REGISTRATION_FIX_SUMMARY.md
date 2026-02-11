# Activity Registration: What's Broken & How to Fix It

## TL;DR

**Problem**: `create-activity-template` can't register new templates because:
1. ❌ Subagents can't see temp directory files (working directory not inherited)
2. ❌ No tool for agents to register templates (`register_activity_template` missing)
3. ❌ No trailblazing to recover from registration failures
4. ❌ No schema validation before registration attempt

**Solution**: 5 targeted fixes, ~4-6 hours of work, high impact.

---

## Current State vs Required State

### What Works ✅

1. **Lifecycle hooks exist** and are defined in templates:
   - `preActivity`: Sets up temp directories ✅
   - `postActivity`: Cleans up ✅
   - `onError`: Captures diagnostics ✅

2. **Hook execution happens** in TemplateExecutor:
   - Creates temp directory: `/tmp/activity-template-abc123` ✅
   - Changes parent process CWD ✅
   - Cleans up on completion ✅

3. **`create-activity-template` template exists** with 4 tasks:
   - Task 1: analyze-examples ✅
   - Task 2: design-task-graph ✅
   - Task 3: write-template-json ✅
   - Task 4: register-template ❌ (BROKEN)

### What's Broken ❌

1. **Working Directory Not Inherited by Subagents**
   ```typescript
   // Parent activity (TemplateExecutor)
   process.chdir("/tmp/activity-template-abc123")  // ✅ Sets temp dir
   
   // Subagent spawned by executeTasks()
   session.cwd  // ❌ Still sees /home/avi/..., NOT temp dir!
   ```
   
   **Impact**: Task 4 can't find the `template.json` file written by Task 3.

2. **Tool `register_activity_template` Doesn't Exist**
   ```typescript
   // Task 4 prompt says to use this:
   await register_activity_template({
     file_path: "template.json",
     register_with_metabob: true
   })
   
   // But this tool doesn't exist! ❌
   ```
   
   **Impact**: Agents can't register templates directly.

3. **No Trailblazing for Registration Failures**
   - When Task 4 fails (schema errors, backend down, etc.), activity just fails
   - No automatic recovery tasks generated
   - No schema error fixing
   - No retry with corrected template
   
   **Impact**: Manual intervention required for every registration failure.

4. **No Schema Validation Before Registration**
   - Template JSON is written in Task 3
   - Registration attempted in Task 4 without pre-validation
   - Schema errors discovered only during registration
   
   **Impact**: Late failure detection, wasted tokens, poor UX.

---

## The 5 Fixes (In Order of Priority)

### Fix 1: Pass Working Directory to Subagents (CRITICAL)

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**Change Line 239**:
```typescript
// BEFORE:
const executions = await executeTasks(template, activity, options.variables, options.dryRun, undefined)

// AFTER:
const executions = await executeTasks(
  template, 
  activity, 
  options.variables, 
  options.dryRun, 
  undefined,
  hooksContext?.workingDirectory  // ← ADD THIS
)
```

**Update `executeTasks()` signature**:
```typescript
async function executeTasks(
  template: ActivityTemplate.Schema,
  activity: Activity.Info,
  variables: Record<string, unknown>,
  dryRun: boolean,
  parentSessionID: string | undefined,
  workingDirectory?: string  // ← ADD THIS
): Promise<TaskExecution[]>
```

**Pass to Session.create()**:
```typescript
const session = await Session.create({
  mode: task.subagent,
  cwd: workingDirectory || process.cwd(),  // ← USE HOOK CONTEXT CWD
  ...
})
```

**Effort**: 15 minutes  
**Risk**: Low (isolated change)  
**Impact**: HIGH - Unblocks all temp directory operations

---

### Fix 2: Create `register_activity_template` Tool (HIGH PRIORITY)

**File**: Create `repos/metabob-opencode/packages/opencode/src/tool/register-activity-template.ts`

**What It Does**:
1. Read JSON file from `file_path`
2. Parse and validate against `ActivityTemplate.Schema`
3. Call `TemplateRepository.save(template)` to register
4. Verify with `search_activities` that template is discoverable
5. Return `{ success: boolean, template_id: string, errors?: string[] }`

**Signature**:
```typescript
register_activity_template({
  file_path: "path/to/template.json",
  validate_only: false  // Optional: validate without registering
})
```

**Register in**:
- `src/tool/index.ts` (export)
- `src/session/prompt.ts` (expose to `activity` and `general` agents)

**Effort**: 1 hour  
**Risk**: Low (uses existing `TemplateRepository` API)  
**Impact**: HIGH - Enables direct registration by agents

---

### Fix 3: Add Schema Validation Script (MEDIUM PRIORITY)

**File**: Create `scripts/validate-activity-template.sh`

**What It Does**:
```bash
#!/bin/bash
# Validates activity template JSON against schema requirements

TEMPLATE_FILE="$1"

# 1. Check JSON syntax
jq empty "$TEMPLATE_FILE" || exit 1

# 2. Check required fields
jq -e '.name, .category, .tasks, .version' "$TEMPLATE_FILE" >/dev/null || exit 1

# 3. Check task count (1-10)
TASK_COUNT=$(jq '.tasks | length' "$TEMPLATE_FILE")
[ "$TASK_COUNT" -ge 1 ] && [ "$TASK_COUNT" -le 10 ] || exit 1

# 4. Check all tasks have validation
jq '.tasks | all(.validation)' "$TEMPLATE_FILE" | grep -q true || exit 1

# 5. Check all tasks have retry config
jq '.tasks | all(.retry)' "$TEMPLATE_FILE" | grep -q true || exit 1

echo "✓ Template validation passed"
```

**Update `write-template-json` task** in `create-activity-template.json`:
```json
{
  "validation": {
    "commands": [
      {
        "name": "validate-schema",
        "command": "bash scripts/validate-activity-template.sh *.json",
        "required": true
      }
    ]
  }
}
```

**Effort**: 30 minutes  
**Risk**: Low (just validation, no side effects)  
**Impact**: MEDIUM - Catches errors earlier, better UX

---

### Fix 4: Implement Trailblazing for Registration (MEDIUM PRIORITY)

**File**: Update `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**What It Does**:
When Task 4 (register-template) fails with schema errors:
1. Detect failure: `execution.status === "failed"`
2. Analyze error: Extract schema violation details
3. Generate recovery tasks dynamically:
   ```
   Task 5: fix-schema-errors-<timestamp>
     - Prompt: "Fix these schema errors: <error details>"
     - Validation: Re-run validation script
   
   Task 6: retry-registration-<timestamp>
     - Prompt: "Register the fixed template"
     - Dependencies: [Task 5]
   ```
4. Append to template.tasks
5. Continue execution with new tasks

**Key Code**:
```typescript
// In executeTasks(), after task failure:
if (execution.status === "failed" && task.retry?.strategy === "trailblazing") {
  const recoveryTasks = await generateRecoveryTasks({
    failedTask: task,
    error: execution.error,
    template,
    activity,
  })
  
  template.tasks.push(...recoveryTasks)
  log.info("appended recovery tasks", { count: recoveryTasks.length })
}
```

**Update Task 4 retry strategy**:
```json
{
  "id": "register-template",
  "retry": {
    "maxAttempts": 3,
    "strategy": "trailblazing"  // ← CHANGE FROM "progressive-context"
  }
}
```

**Effort**: 2 hours  
**Risk**: Medium (modifies execution flow)  
**Impact**: MEDIUM - Enables automatic recovery

---

### Fix 5: Update `register-template` Task Prompt (LOW PRIORITY)

**File**: `repos/metabob-opencode/packages/opencode/templates/built-in/create-activity-template.json`

**Update Task 4 prompt** to use new tool:
```json
{
  "prompt": {
    "template": "Register the template:\n\n1. Find file: ls -la *.json\n2. Register: register_activity_template({ file_path: \"{{templateId}}.json\" })\n3. Verify: search_activities({ query: \"{{templateName}}\" })\n\nExpected: Success with template_id={{templateId}}\n\nIf validation fails: Report errors clearly and let task fail (trailblazing will fix)",
    "maxTokens": 8000,
    "variables": [
      { "name": "templateId", "type": "string", "required": true },
      { "name": "templateName", "type": "string", "required": true },
      { "name": "category", "type": "string", "required": true }
    ]
  }
}
```

**Effort**: 15 minutes  
**Risk**: None (just prompt text)  
**Impact**: LOW - Improves clarity

---

## Implementation Order

```
DAY 1 (2-3 hours):
  1. Fix 1: Working directory inheritance (15 min) → TEST IMMEDIATELY
  2. Fix 2: Create registration tool (1 hour) → TEST WITH MANUAL JSON
  3. Fix 3: Add validation script (30 min) → TEST WITH VALID/INVALID FILES

DAY 2 (2-3 hours):
  4. Fix 4: Implement trailblazing (2 hours) → TEST WITH INVALID TEMPLATE
  5. Fix 5: Update task prompt (15 min) → TEST END-TO-END

TOTAL: 4-6 hours
```

---

## Testing Strategy

### Test 1: Working Directory (After Fix 1)

```bash
# Create test activity with temp dir
cat > test-temp.json <<'EOF'
{
  "id": "test-temp",
  "name": "Test Temp Dir",
  "version": 1,
  "category": "test",
  "tasks": [
    {
      "id": "write",
      "subagent": "general",
      "description": "Write file",
      "dependencies": [],
      "prompt": { "template": "Create test.txt with 'hello'", "maxTokens": 2000 },
      "validation": { "requiredFiles": ["test.txt"] },
      "retry": { "maxAttempts": 1, "strategy": "simple" }
    },
    {
      "id": "read",
      "subagent": "general",
      "description": "Read file",
      "dependencies": ["write"],
      "prompt": { "template": "List files and read test.txt", "maxTokens": 2000 },
      "validation": {},
      "retry": { "maxAttempts": 1, "strategy": "simple" }
    }
  ],
  "hooks": {
    "preActivity": {
      "workingDirectory": { "type": "temporary", "cleanup": "always" }
    }
  }
}
EOF

opencode activity --template test-temp
```

**Expected**: Task 2 sees test.txt ✅

### Test 2: Registration Tool (After Fix 2)

```bash
cat > minimal.json <<'EOF'
{
  "id": "test-minimal",
  "name": "Minimal",
  "version": 1,
  "category": "test",
  "description": "Test",
  "tasks": [{
    "id": "hello",
    "subagent": "general",
    "description": "Hello",
    "dependencies": [],
    "prompt": { "template": "Say hello", "maxTokens": 1000 },
    "validation": {},
    "retry": { "maxAttempts": 1, "strategy": "simple" }
  }]
}
EOF

opencode tool register_activity_template --file-path minimal.json
opencode tool search_activities --query "Minimal"
```

**Expected**: Registration succeeds, search finds it ✅

### Test 3: End-to-End (After All Fixes)

```bash
opencode activity --template create-activity-template --variables '{
  "templateName": "Deploy App",
  "templateId": "deploy-app",
  "category": "infrastructure",
  "purpose": "Deploy with health checks"
}'

# Verify
opencode tool search_activities --query "Deploy App"
```

**Expected**: 
- All 4 tasks complete ✅
- Template registered ✅
- Immediately usable ✅

---

## Success Criteria

After implementation:
- ✅ `create-activity-template` success rate: **95%+** (currently ~30%)
- ✅ Subagents see temp directory files
- ✅ Agents can register templates directly
- ✅ Schema errors caught before registration
- ✅ Automatic recovery from registration failures
- ✅ New templates immediately discoverable

---

## What We've Been Working On

Based on the documentation in this repo:

1. **Activity system architecture** - Fully designed, documented in:
   - `ACTIVITY_SYSTEM_COMPLETE_ARCHITECTURE.md` (888 lines)
   - Templates: `create-activity-template.json` (310 lines)
   - Hooks: `activity-hooks.ts` (435 lines)
   - Executor: `template-executor.ts` (2000+ lines)

2. **Lifecycle hooks** - Implemented but not fully functional:
   - ✅ Hook definitions in schema
   - ✅ Hook execution in TemplateExecutor
   - ❌ Working directory inheritance (MISSING)
   - ❌ Registration tool (MISSING)

3. **Learning system** - Designed but registration flow broken:
   - ✅ Thompson Sampling (metabob-rpc-api)
   - ✅ Metrics tracking (template-executor.ts)
   - ✅ Template evolution (distributed-template-evolution.ts)
   - ❌ Can't create new templates (registration broken)

## What's Left To Do

**Critical Path** (blocks everything):
1. ✅ Analyze architecture (DONE - see ACTIVITY_REGISTRATION_SYSTEM_ANALYSIS.md)
2. ⏳ Fix working directory inheritance (15 min)
3. ⏳ Create registration tool (1 hour)
4. ⏳ Test end-to-end (30 min)

**Nice to Have** (improves reliability):
5. ⏳ Add validation script (30 min)
6. ⏳ Implement trailblazing (2 hours)

**Total Remaining**: 4-6 hours to full functionality

---

## Questions?

**Q: Why can't we just use MCP tools directly?**  
A: Subagents may not have MCP access, and we want a first-class tool for better UX and validation.

**Q: Why trailblazing instead of just better prompts?**  
A: Schema errors are unpredictable. Trailblazing provides automatic recovery without manual intervention.

**Q: Can we skip validation and just let registration fail?**  
A: Yes, but it wastes tokens and time. Early validation provides better UX and faster iteration.

**Q: What if backend is down?**  
A: Trailblazing will generate retry tasks. After max attempts, creates boredom task for deferred handling.
