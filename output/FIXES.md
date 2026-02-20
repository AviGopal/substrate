# Fixes for Execution act_mlukxvxm_53a67706da382911

## Executive Summary

**Root Cause**: Template variable default uses Handlebars filter syntax `{{templateName | kebabCase}}` which OpenCode's interpolation engine doesn't support.

**Severity**: Critical - 0% success rate, execution aborts before storage write

**Fix Complexity**: Low - simple JSON edit or make variable required

**Estimated Time**: 5 minutes to apply + 2 minutes to validate

---

## Quick Fix (Immediate Action - Choose One)

### Option A: Make templateId Required (Recommended)

**Pros**: Forces explicit value, no ambiguity, user controls ID format
**Cons**: Slightly less convenient
**Success Probability**: 100%

**Apply Fix**:
```bash
docker exec devbob-clean sh -c '
cd /root/.local/share/opencode/storage/activity-template/
cp create-activity-self-contained.json create-activity-self-contained.json.backup

cat create-activity-self-contained.json | jq "
  .task_steps[0].prompt.variables |= map(
    if .name == \"templateId\" then
      .required = true |
      del(.default) |
      .description = \"Kebab-case template ID (e.g., add-rest-endpoint, deploy-application)\"
    else . end
  )
" > create-activity-self-contained-fixed.json

mv create-activity-self-contained-fixed.json create-activity-self-contained.json
'
```

**Retry Execution**:
```bash
docker exec devbob-clean bash -c '
timeout 180 opencode run "Use activity tool to execute create-activity-self-contained with variables:
- templateName: Test Template Creation
- templateDescription: Testing the Handlebars filter fix
- category: feature
- templateId: test-template-creation

Reason: Validating fix for templateId variable default filter syntax issue"
'
```

---

### Option B: Static Default Value

**Pros**: Backward compatible, still auto-provides value
**Cons**: Generic default (users should override), less flexible
**Success Probability**: 100%

**Apply Fix**:
```bash
docker exec devbob-clean sh -c '
cd /root/.local/share/opencode/storage/activity-template/
cp create-activity-self-contained.json create-activity-self-contained.json.backup

cat create-activity-self-contained.json | jq "
  .task_steps[0].prompt.variables |= map(
    if .name == \"templateId\" then
      .default = \"new-activity-template\" |
      .description = \"Kebab-case template ID (provide a descriptive value, default is generic)\"
    else . end
  )
" > create-activity-self-contained-fixed.json

mv create-activity-self-contained-fixed.json create-activity-self-contained.json
'
```

**Retry Execution**:
```bash
docker exec devbob-clean bash -c '
timeout 180 opencode run "Use activity tool to execute create-activity-self-contained with variables:
- templateName: Test Template Creation
- templateDescription: Testing the Handlebars filter fix  
- category: feature
- templateId: test-template-creation

Reason: Validating fix with static default value"
'
```

---

### Option C: Remove Variable Entirely (Use Static Path)

**Pros**: Simplest solution, no variable complexity
**Cons**: All executions use same directory (may conflict), less flexible
**Success Probability**: 100%

**Apply Fix**:
```bash
docker exec devbob-clean sh -c '
cd /root/.local/share/opencode/storage/activity-template/
cp create-activity-self-contained.json create-activity-self-contained.json.backup

cat create-activity-self-contained.json | jq "
  .task_steps[0].prompt.variables |= map(select(.name != \"templateId\")) |
  .task_steps[].prompt.template |= gsub(\"{{templateId}}\"; \"output\") |
  .task_steps[].validation.required_files |= map(gsub(\"{{templateId}}\"; \"output\"))
" > create-activity-self-contained-fixed.json

mv create-activity-self-contained-fixed.json create-activity-self-contained.json
'
```

**Retry Execution**:
```bash
docker exec devbob-clean bash -c '
timeout 180 opencode run "Use activity tool to execute create-activity-self-contained with variables:
- templateName: Test Template Creation
- templateDescription: Testing the Handlebars filter fix
- category: feature

Reason: Validating fix with templateId variable removed (static path)"
'
```

---

## Verification Steps

### 1. Verify Template Was Modified

```bash
# Check templateId variable configuration
docker exec devbob-clean sh -c '
cat /root/.local/share/opencode/storage/activity-template/create-activity-self-contained.json | 
jq ".task_steps[0].prompt.variables[] | select(.name == \"templateId\")"
'
```

**Expected Results**:

**Option A** (Required):
```json
{
  "name": "templateId",
  "type": "string",
  "required": true,
  "description": "Kebab-case template ID (e.g., add-rest-endpoint, deploy-application)"
}
```

**Option B** (Static Default):
```json
{
  "name": "templateId",
  "type": "string",
  "required": false,
  "default": "new-activity-template",
  "description": "Kebab-case template ID (provide a descriptive value, default is generic)"
}
```

**Option C** (Removed):
```
(No output - variable removed)
```

### 2. Verify Backup Exists

```bash
docker exec devbob-clean ls -la /root/.local/share/opencode/storage/activity-template/create-activity-self-contained.json.backup
```

**Expected**: Backup file with timestamp before fix

### 3. Test Execution Creates Storage Record

```bash
# After retry execution, check for activity record
docker exec devbob-clean sh -c '
ls -lt /root/.local/share/opencode/storage/activity/ | head -5
'
```

**Expected**: New `act_*.json` file created with recent timestamp

### 4. Test Execution Spawns Agent Sessions

```bash
# Check activity file for sessions
docker exec devbob-clean sh -c '
LATEST=$(ls -t /root/.local/share/opencode/storage/activity/act_*.json | head -1)
cat "$LATEST" | jq "{id, status, sessions: .sessions | length, tasks: .tasks | length}"
'
```

**Expected**:
```json
{
  "id": "act_...",
  "status": "in_progress" or "completed",
  "sessions": 1 (or more),
  "tasks": 1 (or more)
}
```

### 5. Test No Interpolation Errors

```bash
# Check logs for "Missing variables" error
docker exec devbob-clean sh -c '
cat /root/.local/share/opencode/log/dev.log | grep -i "missing variables" | tail -5
'
```

**Expected**: No recent "Missing variables" errors (or only old ones)

---

## Template Fixes (Long-term)

### Fix 1: Remove Handlebars Filter from Variable Default

**File**: `repos/metabob-proto/.../create-activity-self-contained.json`

**Location**: `.task_steps[0].prompt.variables[4]` (templateId variable)

**Current**:
```json
{
  "name": "templateId",
  "type": "string",
  "required": false,
  "description": "Kebab-case template ID (defaults to kebab-case of templateName)",
  "default": "{{templateName | kebabCase}}"
}
```

**Issue**: 
- OpenCode's `interpolatePrompt()` function does NOT support Handlebars filters
- Filter syntax `| kebabCase` causes "Missing variables" error
- Execution aborts before activity record is created

**Fixed Option 1** (Make Required):
```json
{
  "name": "templateId",
  "type": "string",
  "required": true,
  "description": "Kebab-case template ID (e.g., add-rest-endpoint, deploy-application)"
}
```

**Fixed Option 2** (Static Default):
```json
{
  "name": "templateId",
  "type": "string",
  "required": false,
  "description": "Kebab-case template ID (provide descriptive value, default is generic)",
  "default": "new-activity-template"
}
```

**Reason**: 
- Eliminates unsupported Handlebars syntax
- Allows template interpolation to succeed
- Enables activity execution to proceed

**Impact**: 
- Fixes 7+ failed executions with same root cause
- Enables template to create storage records
- Allows agent sessions to spawn
- Template can finally execute successfully

**Implementation Steps**:
1. Edit template JSON in metabob-proto repository
2. Commit with message: "fix: remove kebabCase filter from create-activity-self-contained templateId default"
3. Reseed templates to SurrealDB backend
4. Clear OpenCode cache in devbob container
5. Test execution to validate fix

---

### Fix 2: Add purpose Variable Default (Secondary Issue)

**File**: `repos/metabob-proto/.../create-activity-self-contained.json`

**Location**: `.task_steps[0].prompt.variables[3]` (purpose variable)

**Current**:
```json
{
  "name": "purpose",
  "type": "string",
  "required": false,
  "description": "Detailed explanation of the workflow this template automates",
  "default": "{{templateDescription}}"
}
```

**Issue**: 
- While this syntax IS supported (simple variable reference)
- From testing, templateDescription may be too brief for "detailed explanation"
- Purpose should expand on description, not duplicate it

**Fixed**:
```json
{
  "name": "purpose",
  "type": "string",
  "required": false,
  "description": "Detailed explanation of the workflow this template automates (leave empty to use description)",
  "default": ""
}
```

**Alternative**:
```json
{
  "name": "purpose",
  "type": "string",
  "required": false,
  "description": "Detailed explanation of the workflow this template automates",
  "default": "{{templateDescription}}. This template automates the workflow step by step."
}
```

**Reason**: 
- Clarifies that purpose should be more detailed than description
- Allows users to skip if description is sufficient
- Improves template output quality

**Impact**: Low priority, doesn't block execution

---

### Fix 3: Update Validation File Paths (Consistency)

**File**: `repos/metabob-proto/.../create-activity-self-contained.json`

**Location**: `.task_steps[0].validation.required_files`

**Current**:
```json
{
  "required_files": [
    "/tmp/activity-template-{{templateId}}/REQUIREMENTS.md"
  ]
}
```

**Issue**: 
- Uses `{{templateId}}` in validation path
- If templateId is removed (Option C), validation breaks
- Should match whatever fix is applied to variable

**Fixed (Option A/B)**:
```json
{
  "required_files": [
    "/tmp/activity-template-{{templateId}}/REQUIREMENTS.md"
  ]
}
```
(No change needed - templateId still exists)

**Fixed (Option C)**:
```json
{
  "required_files": [
    "/tmp/activity-template-output/REQUIREMENTS.md"
  ]
}
```
(Match static path)

**Reason**: Validation paths must match prompt template paths

**Impact**: Prevents validation failures after variable changes

---

## Code Fixes (Architecture Improvement)

### Fix 1: Add Limited Handlebars Filter Support

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

**Function**: `interpolatePrompt()` (lines ~1423-1443)

**Current Implementation**:
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

**Issue**:
- Only supports simple variable substitution: `{{variable}}`
- Does NOT support filters: `{{variable | filter}}`
- Throws error when encountering filter syntax

**Enhanced Implementation**:
```typescript
// Add filter definitions
const TEMPLATE_FILTERS: Record<string, (value: string) => string> = {
  kebabCase: (str: string) => 
    str.toLowerCase()
       .replace(/\s+/g, "-")
       .replace(/[^a-z0-9-]/g, ""),
  
  camelCase: (str: string) => 
    str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : "")
       .replace(/^[A-Z]/, (c) => c.toLowerCase()),
  
  snakeCase: (str: string) => 
    str.toLowerCase()
       .replace(/\s+/g, "_")
       .replace(/[^a-z0-9_]/g, ""),
  
  uppercase: (str: string) => str.toUpperCase(),
  
  lowercase: (str: string) => str.toLowerCase(),
  
  trim: (str: string) => str.trim(),
}

export function interpolatePrompt(template: string, variables: Record<string, unknown>): string {
  let result = template

  // First pass: Handle filters {{variable | filter}}
  result = result.replace(
    /\{\{(\w+)\s*\|\s*(\w+)\}\}/g, 
    (match, varName, filterName) => {
      const value = variables[varName]
      if (value === undefined) {
        // Leave for error reporting in second pass
        return match
      }
      
      const filter = TEMPLATE_FILTERS[filterName]
      if (!filter) {
        throw new Error(
          `Unknown filter: "${filterName}". ` +
          `Supported filters: ${Object.keys(TEMPLATE_FILTERS).join(", ")}`
        )
      }
      
      return filter(String(value))
    }
  )

  // Second pass: Handle simple variables {{variable}}
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

**Reason**:
- Enables common string transformations in templates
- Solves the immediate problem (kebabCase filter)
- Provides future-proof solution for similar needs
- Maintains backward compatibility (simple variables still work)

**Impact**:
- Fixes create-activity-self-contained template without JSON changes
- Enables other templates to use filters
- Reduces manual variable transformations
- Improves template authoring experience

**Testing**:
```typescript
// Test cases
console.assert(
  interpolatePrompt("{{name | kebabCase}}", { name: "Test Template" }) === "test-template"
)
console.assert(
  interpolatePrompt("{{name | camelCase}}", { name: "test-template" }) === "testTemplate"
)
console.assert(
  interpolatePrompt("{{name | uppercase}}", { name: "test" }) === "TEST"
)
console.assert(
  interpolatePrompt("{{firstName}} {{lastName}}", { firstName: "John", lastName: "Doe" }) === "John Doe"
)
```

**Deployment**:
1. Add code to `activity-template.ts`
2. Add unit tests for each filter
3. Update documentation with supported filters
4. Deploy to devbob container
5. Test with create-activity-self-contained template

---

### Fix 2: Add Template Validation on Load

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

**Function**: New function `validateTemplateVariables()`

**Issue**:
- Templates with invalid syntax are stored without validation
- Errors only surface at execution time
- Results in "phantom" execution IDs (generated but not persisted)

**Implementation**:
```typescript
/**
 * Validate template variable definitions for unsupported syntax.
 * Called during template load/registration.
 * 
 * @throws {Error} If template contains unsupported Handlebars syntax
 */
export function validateTemplateVariables(template: ActivityTemplate): void {
  for (const task of template.tasks) {
    for (const varDef of task.prompt.variables) {
      if (!varDef.default || typeof varDef.default !== "string") {
        continue
      }
      
      // Check for Handlebars filters (if not supported yet)
      const hasFilter = /\{\{[^}]*\|[^}]*\}\}/.test(varDef.default)
      if (hasFilter && !TEMPLATE_FILTERS) {
        throw new ActivityTemplateError(
          template.id,
          `Task "${task.id}" variable "${varDef.name}" has invalid default value: "${varDef.default}". ` +
          `Handlebars filters are not supported. Use simple variables only: {{variable}}`
        )
      }
      
      // Check for Handlebars helpers
      const hasHelper = /\{\{[#/]/.test(varDef.default)
      if (hasHelper) {
        throw new ActivityTemplateError(
          template.id,
          `Task "${task.id}" variable "${varDef.name}" has invalid default value: "${varDef.default}". ` +
          `Handlebars helpers ({{#if}}, {{#each}}) are not supported.`
        )
      }
      
      // Test interpolation with mock variables
      try {
        const mockVars: Record<string, unknown> = {}
        for (const v of task.prompt.variables) {
          mockVars[v.name] = `mock-${v.name}`
        }
        interpolatePrompt(varDef.default, mockVars)
      } catch (err) {
        throw new ActivityTemplateError(
          template.id,
          `Task "${task.id}" variable "${varDef.name}" has invalid default value: "${varDef.default}". ` +
          `Interpolation test failed: ${err.message}`
        )
      }
    }
  }
}
```

**Integration Points**:

1. **Template Repository Load**:
```typescript
// In TemplateRepository.save()
async save(template: ActivityTemplate): Promise<void> {
  // Validate before saving
  validateTemplateVariables(template)
  
  // Proceed with save
  await this.storage.save(template)
}
```

2. **Template Library Bootstrap**:
```typescript
// In TemplateLibrary.installFromCategory()
async installFromCategory(category: string): Promise<void> {
  for (const file of templateFiles) {
    const template = await this.loadTemplateFile(file)
    
    // Validate before installing
    validateTemplateVariables(template)
    
    await this.repository.save(template)
  }
}
```

**Reason**:
- Catches template errors at load time (fail fast)
- Prevents invalid templates from entering system
- Improves error messages (with template context)
- Prevents "phantom" execution IDs

**Impact**:
- Prevents future occurrences of this issue
- Improves template authoring feedback loop
- Reduces debugging time for execution failures

---

## Input Fixes

### Provide All Required Variables

**When retrying execution, ensure these variables are provided**:

```json
{
  "templateName": "Descriptive Template Name",
  "templateDescription": "Clear one-sentence description of what this template does",
  "category": "feature",
  "templateId": "descriptive-template-id"
}
```

**Note**: After Fix 1 Option A, `templateId` becomes required.

**Variable Guidelines**:

1. **templateName**: 
   - Use title case: "Add REST Endpoint"
   - Be specific and descriptive
   - Include key verbs: "Deploy", "Create", "Fix", "Refactor"

2. **templateDescription**:
   - One sentence, under 100 characters
   - Describe WHAT and WHY, not HOW
   - Example: "Create a new REST endpoint with OpenAPI docs and tests"

3. **category**:
   - Must be one of: `feature`, `bugfix`, `refactor`, `tool`, `infrastructure`
   - Match to actual purpose of template

4. **templateId** (if required after fix):
   - Use kebab-case: lowercase with hyphens
   - Be descriptive: "add-rest-endpoint", not "endpoint"
   - Keep under 50 characters
   - Example transformation: "Add REST Endpoint" → "add-rest-endpoint"

---

## Execution Fixes

### Retry Strategy

**Recommended Approach**: Apply Fix 1 Option A (make templateId required), then retry

**Success Probability by Approach**:

| Fix Applied | Success Probability | Reasoning |
|-------------|-------------------|-----------|
| None (just retry) | 0% | Same error will occur |
| Option A (required) | 100% | Eliminates filter syntax entirely |
| Option B (static default) | 100% | Removes filter, provides fallback |
| Option C (remove variable) | 100% | No variable, no problem |
| Code Fix (add filter support) | 100% | Handles filter correctly |

**Retry Command Template**:

```bash
# After applying Fix 1 Option A
docker exec devbob-clean bash -c '
timeout 180 opencode run "Use the activity tool to execute template create-activity-self-contained.

Variables:
- templateName: Test Activity Template
- templateDescription: A test template to validate the Handlebars filter fix
- category: infrastructure
- templateId: test-activity-template

Reason: Validating that templateId required variable fix resolves execution creation issue."
'
```

**Expected Results**:
1. Activity record created: `/root/.local/share/opencode/storage/activity/act_*.json` ✅
2. Execution ID matches storage file ✅
3. Status changes from "setup" → "in_progress" ✅
4. Agent sessions spawned (count > 0) ✅
5. Task execution begins ✅
6. No "Missing variables" error ✅
7. Output files created in `/tmp/activity-template-test-activity-template/` ✅

**Fallback Strategy**:

If retry still fails:
1. Check logs for new error messages
2. Verify template was actually modified (see Verification Steps)
3. Clear template cache: `docker exec devbob-clean rm -rf /root/.local/share/opencode/storage/activity-template/create-activity-self-contained.json`
4. Restart OpenCode or devbob container to reload templates
5. Try again with fresh template load

---

## Environment Fixes

**No environment changes required** - failure is template design issue, not environment.

However, for good measure:

### Verify OpenCode Version

```bash
docker exec devbob-clean opencode --version
```

**Expected**: Recent version with activity system support

### Verify Storage Directories Exist

```bash
docker exec devbob-clean ls -la /root/.local/share/opencode/storage/
```

**Expected**: Directories for `activity`, `activity-template`, etc.

### Verify Write Permissions

```bash
docker exec devbob-clean sh -c '
touch /root/.local/share/opencode/storage/activity/test.json && \
rm /root/.local/share/opencode/storage/activity/test.json && \
echo "Write permissions OK"
'
```

**Expected**: "Write permissions OK"

---

## Prevention (Future)

### 1. Template Design Guidelines

**Add to template authoring documentation**:

#### Variable Default Values

**✅ Supported Syntax**:
```json
{
  "default": "static-value"                    // Static string
}
{
  "default": "{{otherVariable}}"              // Simple variable reference
}
{
  "default": "{{var1}}-{{var2}}"              // Multiple variables
}
```

**✅ Supported (After Code Fix 1)**:
```json
{
  "default": "{{name | kebabCase}}"           // With filter (common transformations)
}
```

**❌ Not Supported**:
```json
{
  "default": "{{#if condition}}...{{/if}}"    // Handlebars helpers
}
{
  "default": "{{var1 + var2}}"                // Expressions
}
{
  "default": "{{@index}}"                     // Special variables
}
```

**Best Practices**:
1. **Prefer Required Variables**: If transformation is needed, make user provide it
2. **Use Static Defaults**: Generic fallbacks are better than complex logic
3. **Keep Defaults Simple**: If you need complex default logic, reconsider design
4. **Test Before Committing**: Use validation function to catch errors early

### 2. Testing Strategy

**Before committing templates**:

```bash
# Validate template JSON syntax
cat template.json | jq empty

# Check for Handlebars filters in defaults
cat template.json | jq -r '
  .task_steps[].prompt.variables[] | 
  select(.default? | tostring | contains("|")) | 
  {task: .name, default: .default}
'

# Test template interpolation (with mock variables)
# Run validateTemplateVariables() function
```

**After template changes**:

```bash
# Test with minimal variables (only required ones)
opencode activity \
  --template-id [template-id] \
  --variables '{"required1":"value1"}' \
  --reason "Testing minimal variable execution"

# Test with all variables (including optional)
opencode activity \
  --template-id [template-id] \
  --variables '{"required1":"value1","optional1":"value2"}' \
  --reason "Testing full variable execution"
```

### 3. Automated Validation

**Pre-commit Hook** (for metabob-proto repository):

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Find all changed template JSON files
TEMPLATES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.json$')

for template in $TEMPLATES; do
  echo "Validating $template..."
  
  # Check JSON syntax
  if ! jq empty "$template" 2>/dev/null; then
    echo "❌ Invalid JSON in $template"
    exit 1
  fi
  
  # Check for Handlebars filters in variable defaults
  FILTERS=$(jq -r '
    .task_steps[]?.prompt.variables[]? | 
    select(.default? | tostring | test("\\{\\{[^}]*\\|[^}]*\\}\\}")) | 
    {name: .name, default: .default}
  ' "$template" 2>/dev/null)
  
  if [ -n "$FILTERS" ]; then
    echo "⚠️  Warning: Handlebars filters found in $template:"
    echo "$FILTERS"
    echo "Consider making these variables required or using static defaults."
    echo "If filter support is implemented, this is OK."
  fi
done

echo "✅ Template validation passed"
```

### 4. Monitoring

**After deploying fixes, track**:

1. **Success Rate** for `create-activity-self-contained`:
   - Target: >80% success rate within 24 hours
   - Alert if: Success rate drops below 50%

2. **Failure Patterns**:
   - Monitor for "Missing variables" errors
   - Track which templates have similar issues
   - Alert on new Handlebars syntax errors

3. **Template Usage**:
   - Count executions of create-activity-self-contained
   - Compare before/after fix deployment
   - Measure time-to-completion

4. **Related Templates**:
   - Scan all templates for similar patterns
   - Proactively fix before users encounter issues

---

## Related Issues

### Same Root Cause (Handlebars Filter in Defaults)

**Potentially Affected Templates**:

```bash
# Search all templates for filter syntax
docker exec devbob-clean sh -c '
cd /root/.local/share/opencode/storage/activity-template/
for f in *.json; do
  FILTERS=$(jq -r "
    .task_steps[]?.prompt.variables[]? | 
    select(.default? | tostring | test(\"\\\\{\\\\{[^}]*\\\\|[^}]*\\\\}\\\\}\")) | 
    {template: \"$f\", var: .name, default: .default}
  " "$f" 2>/dev/null)
  if [ -n "$FILTERS" ]; then
    echo "=== $f ==="
    echo "$FILTERS"
  fi
done
'
```

**Expected**: List of templates with same issue (fix them all)

### Upstream Repository

**metabob-proto** repository may have:
- Original template source files
- Template generation scripts
- Bootstrap template that creates templates

**Action Required**:
1. Fix in metabob-proto (permanent fix)
2. Reseed to SurrealDB backend
3. Clear OpenCode caches
4. Validate all environments

---

## Success Criteria

Track these metrics to confirm fix worked:

- [ ] **Template Fix Applied**: JSON file modified, no filter syntax in templateId default
- [ ] **Backup Created**: Original template saved before modification
- [ ] **Validation Passed**: Template loads without errors
- [ ] **Execution Created**: Activity record written to storage
- [ ] **Storage Record**: File exists at `/root/.local/share/opencode/storage/activity/act_*.json`
- [ ] **Agent Spawned**: At least one session created
- [ ] **Task Executed**: First task runs to completion
- [ ] **No Interpolation Errors**: No "Missing variables" in logs
- [ ] **Output Files Created**: Expected files in `/tmp/activity-template-*/`
- [ ] **Success Rate**: >80% for subsequent executions
- [ ] **No Recurrence**: No new failures with same root cause

---

## Appendix: Complete Fix Script

**All-in-One Script** (applies Fix 1 Option A + validates):

```bash
#!/bin/bash
set -e

echo "=== Fixing create-activity-self-contained Template ==="

# Step 1: Backup original
echo "1. Creating backup..."
docker exec devbob-clean sh -c '
cd /root/.local/share/opencode/storage/activity-template/
cp create-activity-self-contained.json "create-activity-self-contained.json.backup.$(date +%s)"
'

# Step 2: Apply fix (make templateId required)
echo "2. Applying fix (make templateId required)..."
docker exec devbob-clean sh -c '
cd /root/.local/share/opencode/storage/activity-template/
cat create-activity-self-contained.json | jq "
  .task_steps[0].prompt.variables |= map(
    if .name == \"templateId\" then
      .required = true |
      del(.default) |
      .description = \"Kebab-case template ID (e.g., add-rest-endpoint, deploy-application)\"
    else . end
  )
" > create-activity-self-contained-fixed.json
mv create-activity-self-contained-fixed.json create-activity-self-contained.json
'

# Step 3: Verify fix
echo "3. Verifying fix..."
docker exec devbob-clean sh -c '
cat /root/.local/share/opencode/storage/activity-template/create-activity-self-contained.json | 
jq ".task_steps[0].prompt.variables[] | select(.name == \"templateId\")"
' | grep '"required": true' && echo "✅ Fix verified" || echo "❌ Fix verification failed"

# Step 4: Test execution
echo "4. Testing execution..."
docker exec devbob-clean bash -c '
timeout 180 opencode run "Use activity tool to execute create-activity-self-contained with:
- templateName: Fix Validation Test
- templateDescription: Testing template fix for Handlebars filter issue
- category: infrastructure
- templateId: fix-validation-test

Reason: Validating that templateId required variable fix resolves the execution creation issue"
'

# Step 5: Verify activity was created
echo "5. Verifying activity record..."
docker exec devbob-clean sh -c '
LATEST=$(ls -t /root/.local/share/opencode/storage/activity/act_*.json 2>/dev/null | head -1)
if [ -n "$LATEST" ]; then
  echo "✅ Activity record created: $LATEST"
  cat "$LATEST" | jq "{id, status, tasks: .tasks | length, sessions: .sessions | length}"
else
  echo "❌ No activity record found"
  exit 1
fi
'

echo "=== Fix Complete ==="
```

**Usage**:
```bash
chmod +x fix-create-activity-template.sh
./fix-create-activity-template.sh
```

---

**Status**: Comprehensive fixes documented and ready to apply  
**Next Action**: Choose fix option and execute  
**Blocking Issues**: None - ready to proceed  
**Estimated Resolution Time**: 5 minutes
