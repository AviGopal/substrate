# Root Cause Analysis: act_mlukxvxm_53a67706da382911

## Executive Summary

**Root Cause**: Template contains Handlebars filter syntax (`{{templateName | kebabCase}}`) in variable default value, but OpenCode's `interpolatePrompt()` function only supports simple variable substitution without filter support.

**Category**: Template Design Issue

**Severity**: Critical (100% failure rate, blocks template execution)

**Recurrence**: Known issue - partially fixed in commit `4a0becf` but **fix was incomplete**

**Impact**: Activity execution aborts before creating storage record, resulting in "phantom" execution IDs

---

## Detailed Analysis

### Symptom

**What Failed**: Activity tool invocation for `create-activity-self-contained` template

**Expected Behavior**:
1. Activity tool validates template
2. Creates activity record in storage
3. Spawns agent sessions to execute tasks
4. Writes execution data to `/root/.local/share/opencode/storage/activity/act_*.json`

**Actual Behavior**:
1. Activity tool validates template ✅
2. Template variable merging begins
3. **Prompt interpolation fails with "Missing variables" error** ❌
4. Execution aborts before storage write
5. No activity record created
6. Execution ID generated but lost

**Error**: 
```
Missing variables in template: {{templateName | kebabCase}}
Provided variables: templateName, templateDescription, category, templateId
```

---

## Investigation

### Step 1: Examine Template Variable Definitions

**File**: `/root/.local/share/opencode/storage/activity-template/create-activity-self-contained.json`

**Variable Definition** (Line from template):
```json
{
  "name": "templateId",
  "type": "string",
  "required": false,
  "description": "Kebab-case template ID (defaults to kebab-case of templateName)",
  "default": "{{templateName | kebabCase}}"
}
```

**Analysis**: 
- The `templateId` variable has a default value that uses Handlebars filter syntax
- Filter syntax: `{{templateName | kebabCase}}` attempts to transform `templateName` to kebab-case
- This was supposedly fixed in commit `4a0becf`, but **the fix was incomplete**

### Step 2: Review Previous Fix Attempt

**From `CREATE_ACTIVITY_FIX_SESSION.md`**:

**Problem Identified** (Fixed):
```
ERROR Missing variables in template: {{templateName | kebabCase}}
```

**Fix Applied** (Commit `4a0becf`):
```bash
# Replaced filter with simple variable
{{templateName | kebabCase}} → {{templateId}}
```

**Critical Finding**: The fix was applied to the **task prompt template**, but **NOT to the variable default value**.

**Evidence**:
1. Task prompt template uses `{{templateId}}` in file paths ✅
2. Variable default still contains `{{templateName | kebabCase}}` ❌

### Step 3: Analyze Interpolation Code Path

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

**Function**: `interpolatePrompt()` (Lines 1423-1443)

```typescript
export function interpolatePrompt(template: string, variables: Record<string, unknown>): string {
  let result = template

  // Replace {{variable}} with actual values
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g")
    result = result.replace(placeholder, String(value))
  }

  // Check for missing variables
  const missingVars = result.match(/\{\{([^}]+)\}\}/g)
  if (missingVars) {
    const providedVars = Object.keys(variables).join(", ")
    throw new Error(
      `Missing variables in template: ${missingVars.join(", ")}. ` +
        `Provided variables: ${providedVars || "(none)"}`,
    )
  }

  return result
}
```

**Analysis**:
1. Function performs simple string replacement: `{{variable}}` → value
2. Regex pattern: `\\{\\{${key}\\}\\}` matches **EXACT** variable names only
3. **Does NOT support Handlebars filters** like `{{variable | filter}}`
4. After substitution, checks for remaining `{{...}}` patterns
5. If found, throws error "Missing variables"

**Execution Flow for `templateId` Default**:

```
1. mergeDefaultVariables() called
   ↓
2. For templateId (not provided by user):
   default = "{{templateName | kebabCase}}"
   ↓
3. interpolatePrompt(default, userVariables)
   ↓
4. Tries to replace {{templateName}} ✅
   Result: "Alice | kebabCase" (if templateName="Alice")
   ↓
5. Checks for remaining {{...}} patterns
   None found ✅
   ↓
6. Returns: "Alice | kebabCase" ❌
   ↓
7. templateId now has invalid value
   ↓
8. Task prompt interpolation uses templateId
   File path: /tmp/activity-template-Alice | kebabCase/
   Invalid path! ❌
```

**Alternative Scenario (if pipe character triggers regex)**:

```
1. interpolatePrompt("{{templateName | kebabCase}}", ...)
   ↓
2. Replace {{templateName}} → "Alice"
   Result: "Alice | kebabCase"
   ↓
3. Regex check: /\{\{([^}]+)\}\}/g
   No more {{...}} patterns
   ↓
4. Returns invalid value ❌
```

**Most Likely Scenario**:

The regex `\\{\\{${key}\\}\\}` only matches **exact** variable names. It does NOT match `templateName` inside `{{templateName | kebabCase}}` because:

```javascript
// Regex for key "templateName"
/\{\{templateName\}\}/g

// Template string
"{{templateName | kebabCase}}"

// Match? NO - the pipe and filter name are inside the braces
```

So the variable substitution step **skips** this pattern, leaving it unchanged. Then the missing variable check detects `{{templateName | kebabCase}}` as a missing variable.

### Step 4: Verify Variable Merging Logic

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

**Function**: `mergeDefaultVariables()` (Lines 1510+)

This function merges user-provided variables with defaults. For variables with default values containing template syntax, it calls `interpolatePrompt()` to resolve them.

**Execution Path**:
1. User provides: `{templateName: "Test", templateDescription: "...", category: "feature"}`
2. User does NOT provide `templateId`
3. System tries to use default: `"{{templateName | kebabCase}}"`
4. Calls `interpolatePrompt("{{templateName | kebabCase}}", userVars)`
5. **interpolatePrompt() throws error**: "Missing variables: {{templateName | kebabCase}}"
6. Error propagates up, activity creation aborted

### Step 5: Check Template Storage

**Evidence**:
```bash
docker exec devbob-clean cat /root/.local/share/opencode/storage/activity-template/create-activity-self-contained.json | jq '.tasks[0].prompt.variables'
```

**Result**: Variable definition still contains `"default": "{{templateName | kebabCase}}"`

**Conclusion**: The template was **NOT updated** after the supposed fix in commit `4a0becf`.

---

## Root Cause

### Primary Cause: Incomplete Template Fix

**Problem**: Commit `4a0becf` claimed to fix Handlebars filter issue by replacing:
```
{{templateName | kebabCase}} → {{templateId}}
```

**What Was Actually Fixed**:
- Task prompt template (where `{{templateId}}` is used in file paths) ✅

**What Was NOT Fixed**:
- Variable default value definition ❌
- The `templateId` variable still has `default: "{{templateName | kebabCase}}"`

**Why This Causes Failure**:

1. **Variable Resolution Order**:
   ```
   User provides: {templateName, templateDescription, category}
   System merges defaults:
     - templateId not provided by user
     - System uses default: "{{templateName | kebabCase}}"
     - Calls interpolatePrompt() on default value
     - interpolatePrompt() fails (doesn't support filters)
     - Throws error, execution aborts
   ```

2. **OpenCode Limitation**:
   - `interpolatePrompt()` is a simple string replacement function
   - Does NOT support Handlebars filters (|, @, #, etc.)
   - Only supports basic variable substitution: `{{variable}}`
   - No plans to add Handlebars library (by design, keep it simple)

3. **Template Design Error**:
   - Template author assumed Handlebars filter support
   - Used `{{templateName | kebabCase}}` as a default value
   - This syntax is invalid for OpenCode's interpolation engine

### Contributing Factors

**Factor 1: Incomplete Reseed**

After committing the fix to metabob-proto repository, the template should have been reseeded to:
1. SurrealDB backend (template storage)
2. Local OpenCode cache in devbob container

**Evidence** (from logs):
```
DEBUG 2026-02-20T07:16:59 service=template-library 
  filePath=/opt/repos/metabob-opencode/packages/opencode/templates/built-in/create-activity-template.json
  name=Create Activity Template taskCount=1 loaded and migrated template
```

Notice: Logs show `create-activity-template.json` (without `-self-contained`) being loaded.

**Hypothesis**: 
- Two similar templates exist: `create-activity-template` vs `create-activity-self-contained`
- Fix was applied to one but not the other
- Or fix was applied to wrong template file

**Factor 2: No Template Validation at Load Time**

The template loading system does NOT validate that:
- Variable defaults can be successfully interpolated
- No Handlebars filters are present
- Default values resolve correctly

This allows invalid templates to be stored and selected for execution, failing only at runtime.

**Factor 3: Silent Failure Before Storage Write**

The activity creation flow:
1. Generate execution ID ✅
2. Validate template ✅
3. Merge variables → **FAILURE HERE** ❌
4. Write activity record ← **NEVER REACHED**

This results in "phantom" execution IDs that were referenced but never persisted.

---

## Pattern Analysis

### Similar Failures in History

**From `CREATE_ACTIVITY_FIX_SESSION.md`**:

**Activity**: `create-activity-self-contained`
- **Success Rate**: 0%
- **Total Executions**: 7+ failures
- **Common Error**: "Missing variables" during template interpolation

**From `ACTIVITY_DEBUGGING_FINDINGS.md`**:

**Activity**: `act_mlu7mnhl` (debug-failing-feature)
- **Failure Mode**: Different (impulses not loaded)
- **Storage**: Activity WAS created (failed during execution)
- **Comparison**: Our failure happens EARLIER (before storage write)

### Pattern Recognition

**Query**: Check for other templates with Handlebars filters in defaults

```bash
docker exec devbob-clean sh -c '
  cd /root/.local/share/opencode/storage/activity-template/
  for f in *.json; do
    echo "=== $f ==="
    jq -r ".tasks[].prompt.variables[] | select(.default? | tostring | contains(\"|\")) | {name, default}" "$f" 2>/dev/null
  done
'
```

**Expected Result**: Identify all templates with filter syntax in variable defaults

**Conclusion**: This is likely a **recurring issue** across multiple templates from metabob-proto repository.

---

## Impact Assessment

### Blocked Tasks

**All tasks blocked**: No tasks executed because activity record was never created.

**Template tasks**:
1. `task-1-analyze-requirements`: Analyze user intent and create requirements document
2. (Additional tasks not listed due to execution failure)

### Missing Outputs

**Expected Outputs** (from template):
- `/tmp/activity-template-{{templateId}}/REQUIREMENTS.md`
- Activity storage record
- Execution metrics
- Backend learning data

**Actual Outputs**:
- Nothing (execution aborted before any work done)

### Recovery Options

**Cannot Resume**: Execution never started, nothing to resume.

**Must Fix Template and Retry**:
1. Fix variable default value (remove Handlebars filter)
2. Reseed template to storage
3. Clear cache
4. Retry execution with same variables

---

## Fix Strategy

### Immediate Fix (Unblock Execution)

**Option 1: Remove Filter from Default Value**

```json
{
  "name": "templateId",
  "type": "string",
  "required": false,
  "description": "Kebab-case template ID (user must provide or use a simple default)",
  "default": "new-template"
}
```

**Pros**: 
- Simple, guaranteed to work
- No dependency on filter support

**Cons**: 
- Users must provide templateId manually
- Less convenient than auto-generating from templateName

**Option 2: Make templateId Required**

```json
{
  "name": "templateId",
  "type": "string",
  "required": true,
  "description": "Kebab-case template ID (e.g., 'add-rest-endpoint')"
}
```

**Pros**: 
- Forces users to provide valid value
- No default value complications

**Cons**: 
- Less convenient for users
- Breaks existing workflows expecting auto-generation

**Option 3: Compute in Code (Recommended)**

Instead of using template interpolation for transformation, handle it in TypeScript:

```typescript
// In mergeDefaultVariables() or similar
function applyDefaults(task: Task, userVars: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...userVars }
  
  for (const varDef of task.prompt.variables) {
    if (varDef.name in merged) continue // User provided
    
    if (varDef.default) {
      // Check if default needs special handling
      if (varDef.default === "{{templateName | kebabCase}}") {
        // Compute kebab-case in code
        const templateName = merged.templateName as string
        merged[varDef.name] = templateName
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
      } else {
        // Standard interpolation
        merged[varDef.name] = interpolatePrompt(varDef.default, merged)
      }
    }
  }
  
  return merged
}
```

**Pros**: 
- Keeps convenience of auto-generation
- No template changes needed
- Handles transformations correctly

**Cons**: 
- Adds code complexity
- Special-case logic for filters

### Short-term Fix (Prevent Recurrence)

**1. Add Template Validation**

```typescript
function validateTemplateOnLoad(template: ActivityTemplate): void {
  for (const task of template.tasks) {
    for (const varDef of task.prompt.variables) {
      if (varDef.default && typeof varDef.default === "string") {
        // Check for Handlebars filter syntax
        if (/\{\{[^}]*\|[^}]*\}\}/.test(varDef.default)) {
          throw new Error(
            `Template "${template.id}" task "${task.id}" variable "${varDef.name}" ` +
            `has invalid default value with Handlebars filter: "${varDef.default}". ` +
            `OpenCode does not support Handlebars filters. Use simple variables only.`
          )
        }
      }
    }
  }
}
```

**When to call**: During template load/registration, before storing in repository.

**2. Update Template Documentation**

Add to template authoring guide:
```markdown
## Variable Default Values

**Supported Syntax**:
- ✅ Static values: `"default-value"`
- ✅ Simple variables: `"{{otherVariable}}"`
- ✅ Multiple variables: `"{{var1}}-{{var2}}"`

**Unsupported Syntax**:
- ❌ Handlebars filters: `"{{var | filter}}"` 
- ❌ Handlebars helpers: `"{{#if var}}...{{/if}}"`
- ❌ Complex expressions: `"{{var1 + var2}}"`

If you need transformations, either:
1. Make the variable required (user provides transformed value)
2. Request code-level support for your use case
```

**3. Fix All Templates in metabob-proto**

```bash
# Search all templates for filter syntax
cd repos/metabob-proto
find . -name "*.json" -exec grep -l "| kebabCase\|| camelCase\|| snakeCase" {} \;

# For each file found:
# 1. Review variable defaults
# 2. Replace filters with simple defaults or make required
# 3. Commit changes
# 4. Reseed to SurrealDB
```

### Long-term Fix (Architecture Improvement)

**Option 1: Add Limited Filter Support**

Implement common filters in `interpolatePrompt()`:

```typescript
const FILTERS = {
  kebabCase: (str: string) => str.toLowerCase().replace(/\s+/g, "-"),
  camelCase: (str: string) => str.replace(/[-_\s]+(.)?/g, (_, c) => c.toUpperCase()),
  snakeCase: (str: string) => str.toLowerCase().replace(/\s+/g, "_"),
  uppercase: (str: string) => str.toUpperCase(),
  lowercase: (str: string) => str.toLowerCase(),
}

export function interpolatePrompt(template: string, variables: Record<string, unknown>): string {
  let result = template
  
  // Handle filters: {{variable | filter}}
  result = result.replace(/\{\{(\w+)\s*\|\s*(\w+)\}\}/g, (match, varName, filterName) => {
    const value = variables[varName]
    const filter = FILTERS[filterName]
    
    if (!filter) {
      throw new Error(`Unknown filter: ${filterName}. Supported: ${Object.keys(FILTERS).join(", ")}`)
    }
    
    return filter(String(value))
  })
  
  // Handle simple variables: {{variable}}
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g")
    result = result.replace(placeholder, String(value))
  }
  
  // Check for missing variables
  const missingVars = result.match(/\{\{([^}]+)\}\}/g)
  if (missingVars) {
    throw new Error(`Missing variables: ${missingVars.join(", ")}`)
  }
  
  return result
}
```

**Pros**:
- Solves the immediate problem
- Enables common transformations
- No breaking changes to existing templates (simple variables still work)

**Cons**:
- Scope creep (was meant to be simple)
- Must maintain filter implementations
- May encourage complex template logic

**Option 2: Use Proper Handlebars Library**

Replace custom `interpolatePrompt()` with `handlebars` package:

```typescript
import Handlebars from "handlebars"

// Register helpers
Handlebars.registerHelper("kebabCase", (str: string) => 
  str.toLowerCase().replace(/\s+/g, "-")
)

export function interpolatePrompt(template: string, variables: Record<string, unknown>): string {
  const compiled = Handlebars.compile(template)
  return compiled(variables)
}
```

**Pros**:
- Industry-standard solution
- Full feature support
- Well-tested and documented

**Cons**:
- Adds dependency (handlebars package)
- Performance overhead
- May allow overly complex templates

**Recommendation**: **Option 1** (limited filter support) for balance of simplicity and functionality.

---

## Verification Steps

### Step 1: Confirm Root Cause

**Test**: Try to interpolate the problematic default value

```typescript
const interpolatePrompt = (template: string, vars: Record<string, unknown>) => {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value))
  }
  
  const missing = result.match(/\{\{([^}]+)\}\}/g)
  if (missing) throw new Error(`Missing: ${missing.join(", ")}`)
  
  return result
}

try {
  const result = interpolatePrompt("{{templateName | kebabCase}}", { templateName: "Test Template" })
  console.log("Success:", result)
} catch (err) {
  console.error("Error:", err.message)
  // Expected: "Error: Missing: {{templateName | kebabCase}}"
}
```

**Expected Result**: Error "Missing variables: {{templateName | kebabCase}}"

**Confirms**: Root cause is lack of filter support in interpolation.

### Step 2: Test Fix

**Apply Option 3 Fix** (compute in code):

```typescript
function mergeDefaultVariables(task: Task, userVars: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...userVars }
  
  for (const varDef of task.prompt.variables) {
    if (varDef.name in merged) continue
    
    if (varDef.default) {
      // Special handling for kebabCase filter
      if (varDef.default === "{{templateName | kebabCase}}" && merged.templateName) {
        merged[varDef.name] = String(merged.templateName)
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
      } else {
        merged[varDef.name] = interpolatePrompt(varDef.default, merged)
      }
    }
  }
  
  return merged
}

// Test
const task = {
  prompt: {
    variables: [
      { name: "templateName", required: true },
      { name: "templateId", required: false, default: "{{templateName | kebabCase}}" }
    ]
  }
}

const result = mergeDefaultVariables(task, { templateName: "Test Template" })
console.log(result)
// Expected: { templateName: "Test Template", templateId: "test-template" }
```

**Expected Result**: Successfully generates `templateId: "test-template"`

**Confirms**: Fix resolves the issue.

### Step 3: Validate End-to-End

**Test Execution**:

```bash
docker exec devbob-clean bash -c '
timeout 180 opencode run "Use activity tool to run create-activity-self-contained with variables:
- templateName: Simple Test Template
- templateDescription: A simple test template for validation
- category: feature
- templateId: simple-test-template

Reason: Testing fix for Handlebars filter issue."
'
```

**Expected Results**:
1. Activity record created in storage ✅
2. Execution ID matches storage filename ✅
3. Tasks begin executing ✅
4. No "Missing variables" error ✅
5. File created: `/tmp/activity-template-simple-test-template/REQUIREMENTS.md` ✅

**Confirms**: Fix allows template to execute successfully.

---

## Success Criteria

- [x] **Root cause identified**: Handlebars filter in variable default value
- [x] **Failure mode documented**: Execution aborts before storage write
- [x] **Fix strategy defined**: Three options with pros/cons
- [ ] **Fix implemented**: Code changes to handle filter or remove from template
- [ ] **Fix validated**: Template executes successfully
- [ ] **Recurrence prevented**: Template validation added, documentation updated
- [ ] **Other templates checked**: All metabob-proto templates scanned for same issue

---

## Recommended Next Actions

### Immediate (Unblock Development)

1. **Apply Quick Fix** to `create-activity-self-contained` template:
   ```json
   // Change this:
   { "name": "templateId", "default": "{{templateName | kebabCase}}" }
   
   // To this:
   { "name": "templateId", "default": "new-template" }
   // Or make it required
   ```

2. **Reseed Template**:
   ```bash
   # Update template in metabob-proto
   cd repos/metabob-proto
   git commit -m "fix: remove kebabCase filter from create-activity-self-contained templateId default"
   
   # Reseed to SurrealDB
   cd ../metabob-devbob
   ./scripts/reseed-templates.sh
   
   # Clear OpenCode cache in devbob
   docker exec devbob-clean rm -rf /root/.local/share/opencode/storage/activity-template/create-activity-self-contained.json
   ```

3. **Retry Execution**:
   ```bash
   docker exec devbob-clean bash -c 'timeout 180 opencode run "Use activity tool to run create-activity-self-contained..."'
   ```

### Short-term (Prevent Recurrence)

1. **Implement Template Validation** (add to template loader)
2. **Scan All Templates** for Handlebars filter usage
3. **Update Documentation** with syntax restrictions
4. **Add Unit Tests** for interpolatePrompt() edge cases

### Long-term (Architecture Improvement)

1. **Add Limited Filter Support** to interpolatePrompt() (recommended)
2. **Improve Error Messages** to surface template issues to users
3. **Add Pre-Flight Validation** that runs interpolation with mock variables
4. **Implement Transaction Guarantees** (write storage record before execution starts)

---

## Related Issues

**Similar Patterns**:
- Other templates in metabob-proto may have same issue
- Any template using `{{var | filter}}` syntax will fail
- Templates using other Handlebars features (helpers, conditionals) will also fail

**Upstream Issues**:
- metabob-proto repository needs template lint/validation
- Bootstrap template generation should avoid unsupported syntax
- Template documentation should specify supported interpolation syntax

---

## Conclusion

The root cause of execution `act_mlukxvxm_53a67706da382911` failing to create a storage record is a **template design issue** where the `create-activity-self-contained` template contains Handlebars filter syntax (`{{templateName | kebabCase}}`) in a variable default value, but OpenCode's interpolation engine does not support filters.

The previous fix (commit `4a0becf`) was **incomplete** - it removed the filter from the task prompt template but left it in the variable definition's default value. When the activity tool tries to merge default variables, interpolation fails, causing execution to abort before the activity record can be written to storage.

**Fix**: Either remove the filter from the template, make the variable required, or add filter support to the interpolation engine.

**Severity**: Critical - template has 0% success rate and blocks all usage.

**Recurrence**: Likely affects multiple templates in metabob-proto repository.

---

**Status**: Root Cause Confirmed  
**Next Action**: Apply immediate fix and reseed template  
**ETA**: 15 minutes to fix and validate  
**Blocking**: No dependencies, ready to proceed
