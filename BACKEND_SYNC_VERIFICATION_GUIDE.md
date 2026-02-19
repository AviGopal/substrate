# Backend Synchronization Verification Guide

**Problem**: How can we ensure activity templates created/registered locally are properly synced to the configured Metabob backend (ide.metabob.com)?

**Date**: 2026-02-19  
**Status**: Investigation Complete + Solution Provided

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [The Problem](#the-problem)
3. [Solution: Enable MCP Registration](#solution-enable-mcp-registration)
4. [Verification Methods](#verification-methods)
5. [Configuration Guide](#configuration-guide)

---

## Current State Analysis

### What We Discovered

**Location**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` (Line 762-790)

```typescript
export async function registerActivityTemplate(template: ActivityTemplate.Schema): Promise<boolean> {
  log.debug("registerActivityTemplate called", { templateId: template.id })

  // Convert to Metabob format
  const metabobTemplate = ActivitySchemaAdapter.fromCanonical(template)

  // Write template file locally
  const activitiesDir = path.join(Instance.directory, ".metabob/activities")
  const templatePath = path.join(activitiesDir, `${template.id}.json`)
  
  await Bun.write(templatePath, JSON.stringify(metabobTemplate, null, 2))

  // ⚠️  TODO: Implement register_activity_template MCP tool
  // For now, just writing the file is sufficient
  log.info("registerActivityTemplate completed (file written)", {
    templateId: template.id,
    path: templatePath,
    note: "MCP registration tool not yet implemented, file discovery mode active"
  })

  return true  // ← Always returns true even if MCP call not made!
}
```

### Current Behavior

**When you register a template**:

1. ✅ **Local Storage**: Template saved to `~/.local/share/opencode/storage/activity-template/`
2. ✅ **Project Directory**: Template written to `.metabob/activities/`
3. ❌ **Backend (ide.metabob.com)**: **NOT SYNCED** - MCP call not implemented

**Result**: Templates exist locally but are **NOT available on ide.metabob.com** for other developers or the web dashboard!

---

## The Problem

### Registration Flow (Current - Incomplete)

```
User Calls:
  register_activity_template(file_path="template.json", register_with_metabob=true)
    ↓
TemplateRepository.save(template, ["local", "metabob"])
    ↓
TemplateLoader.save(template, { backend: "auto" })
    ↓
TemplateServiceClient.registerTemplate(options)
    ↓
MetabobCLI.registerActivityTemplate(template)
    ↓
⚠️  WRITES TO .metabob/activities/ ONLY
❌ DOES NOT CALL MCP TOOL
❌ DOES NOT SYNC TO ide.metabob.com
```

### Why This Is A Problem

**Scenario**: Developer A creates activity template on their machine

- ✅ Works on their machine (local storage)
- ❌ Developer B cannot see it (not on backend)
- ❌ Web dashboard doesn't show it (not on backend)
- ❌ CI/CD cannot use it (not on backend)
- ❌ Template metrics not centralized (not on backend)

**Backend shows**: Only templates synced via file discovery or manual registration

---

## Solution: Enable MCP Registration

### Good News: MCP Tool Exists!

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

```python
@mcp.tool(name="metabob_register_activity_template", ...)
async def metabob_register_activity_template(
    template: dict,
    ctx: Context = None,
):
    """Register a new activity template."""
    try:
        template_id = activity_templates.save_template(template)
        
        return {
            "status": "success",
            "template_id": template_id,
            "message": f"Template registered successfully: {template_id}",
        }
    except Exception as e:
        return {
            "status": "error",
            "error": f"Failed to register template: {str(e)}",
        }
```

**The tool exists and works!** We just need to call it from TypeScript.

### Implementation Fix

**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`

**Replace** lines 762-790 with:

```typescript
export async function registerActivityTemplate(template: ActivityTemplate.Schema): Promise<boolean> {
  log.debug("registerActivityTemplate called", { templateId: template.id })

  // Convert to Metabob format
  const metabobTemplate = ActivitySchemaAdapter.fromCanonical(template)

  // Write template file locally (for offline/backup)
  const activitiesDir = path.join(Instance.directory, ".metabob/activities")
  const templatePath = path.join(activitiesDir, `${template.id}.json`)
  
  // Ensure directory exists
  if (!fs.existsSync(activitiesDir)) {
    fs.mkdirSync(activitiesDir, { recursive: true })
  }

  await Bun.write(templatePath, JSON.stringify(metabobTemplate, null, 2))
  log.debug("wrote template to local file", { path: templatePath })

  // Call MCP tool to register with backend
  try {
    const result = await callMCPTool<{
      status: string
      template_id?: string
      message?: string
      error?: string
    }>("metabob_register_activity_template", {
      template: metabobTemplate
    })

    if (result?.status === "success") {
      log.info("registerActivityTemplate completed", {
        templateId: template.id,
        backend: "metabob",
        localPath: templatePath,
        message: result.message
      })
      return true
    } else {
      log.error("MCP registration failed", {
        templateId: template.id,
        error: result?.error || "Unknown error",
        status: result?.status
      })
      
      // Return false so TemplateServiceClient reports failure
      return false
    }
  } catch (error) {
    log.error("MCP tool call failed", {
      templateId: template.id,
      error: error instanceof Error ? error.message : String(error)
    })
    
    // Return false so TemplateServiceClient reports failure
    return false
  }
}
```

### Why This Fix Works

1. **Preserves local file**: Still writes to `.metabob/activities/` for offline use
2. **Calls MCP tool**: Actually syncs to backend using `metabob_register_activity_template`
3. **Proper error handling**: Returns false on failure so tool reports it
4. **Backwards compatible**: Doesn't break existing behavior

---

## Verification Methods

### Method 1: Check Registration Logs

**During registration**, look for these log messages:

**✅ Success**:
```
INFO  registerActivityTemplate completed backend=metabob template_id=my-template message="Template registered successfully: my-template"
```

**❌ Failure (Current State)**:
```
INFO  registerActivityTemplate completed (file written) note="MCP registration tool not yet implemented, file discovery mode active"
```

**Location**: `~/.local/share/opencode/log/dev.log`

```bash
# Watch logs during registration
tail -f ~/.local/share/opencode/log/dev.log | grep -i "registerActivityTemplate\|metabob_register"
```

### Method 2: Check Local vs Backend Templates

**List local templates**:
```bash
ls -la ~/.local/share/opencode/storage/activity-template/
```

**List backend templates** (via MCP):
```typescript
// In OpenCode
const templates = await metabob_list_activity_templates()
console.log(templates.map(t => t.id))
```

**Compare**: Local templates should match backend templates

### Method 3: Query Backend API Directly

**If you have API access to ide.metabob.com**:

```bash
# Get all activity templates from backend
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://ide.metabob.com/api/v1/activity-templates
```

**Check if your template ID appears in response**

### Method 4: Web Dashboard Check

**If ide.metabob.com has a dashboard**:

1. Navigate to Activity Templates section
2. Search for your template by name/ID
3. Check creation timestamp matches local registration

### Method 5: Test Activity Execution

**Best verification** - try to execute the template:

```typescript
// On a DIFFERENT machine (or clean cache)
const result = await activity({
  templateId: "my-new-template",
  variables: {},
  reason: "Testing backend sync"
})
```

**If it works**: Template is on backend ✅  
**If it fails**: Template not synced ❌

---

## Configuration Guide

### Step 1: Update Metabob Config

**Check your config**: `.metabob/config.json`

**Current**:
```json
{
  "base_url": "http://localhost:8080",
  "api_key": "..."
}
```

**Production**:
```json
{
  "base_url": "https://ide.metabob.com",
  "api_key": "YOUR_PRODUCTION_API_KEY"
}
```

### Step 2: Verify MCP Connection

```typescript
// Test MCP connectivity
const tools = await test_metabob_mcp()
console.log(tools)

// Should show:
// {
//   status: "connected",
//   tools: ["metabob_register_activity_template", ...],
//   searchResults: [...]
// }
```

### Step 3: Apply the Fix

**Option A: Manual Fix**
1. Edit `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`
2. Replace `registerActivityTemplate` function with code from above
3. Run `cd repos/metabob-opencode && bun run typecheck`
4. Commit changes

**Option B: Create Activity to Fix**
1. Create activity template `fix-template-backend-sync`
2. Task: Implement MCP call in registerActivityTemplate
3. Run activity

### Step 4: Re-register Existing Templates

**After applying fix**, re-register your templates:

```bash
# List local templates
ls ~/.local/share/opencode/storage/activity-template/

# Re-register each one
for template in ~/.local/share/opencode/storage/activity-template/*.json; do
  echo "Re-registering: $template"
  # Call register_activity_template tool with file_path
done
```

**Or via TypeScript**:
```typescript
const templates = await ActivityTemplate.list()
for (const template of templates) {
  await TemplateRepository.save(template, ["metabob"])
  console.log(`✓ Re-registered: ${template.id}`)
}
```

---

## Verification Checklist

After applying the fix, verify:

- [ ] **Code Change**: `registerActivityTemplate` calls `callMCPTool("metabob_register_activity_template", ...)`
- [ ] **TypeScript Compiles**: `bun run typecheck` passes
- [ ] **MCP Tool Available**: `test_metabob_mcp()` shows tool in list
- [ ] **Registration Succeeds**: Log shows "backend=metabob" message
- [ ] **Backend Has Template**: Query backend API or check dashboard
- [ ] **Other Machines Can Access**: Test from clean environment
- [ ] **Metrics Sync**: Template execution updates centralized metrics

---

## Expected Results After Fix

### Registration Flow (Fixed)

```
User Calls:
  register_activity_template(file_path="template.json", register_with_metabob=true)
    ↓
TemplateRepository.save(template, ["local", "metabob"])
    ↓
TemplateLoader.save(template, { backend: "auto" })
    ↓
TemplateServiceClient.registerTemplate(options)
    ↓
MetabobCLI.registerActivityTemplate(template)
    ↓
✅ WRITES TO .metabob/activities/ (local backup)
✅ CALLS callMCPTool("metabob_register_activity_template", ...)
✅ SYNCS TO ide.metabob.com
✅ RETURNS true/false based on success
```

### Benefits

1. **✅ Centralized Registry**: All templates on ide.metabob.com
2. **✅ Team Collaboration**: Templates available to all developers
3. **✅ Dashboard Visibility**: View templates in web UI
4. **✅ Metrics Tracking**: Centralized execution metrics
5. **✅ CI/CD Integration**: Templates usable in automation
6. **✅ Proper Error Reporting**: Failed registrations logged

---

## Troubleshooting

### Issue: "MCP tool not found"

**Symptom**: Error about `metabob_register_activity_template` not available

**Solution**:
1. Check metabob-cli version: `metabob-cli --version`
2. Ensure MCP server is running
3. Verify `.metabob/config.json` points to correct backend
4. Test with `test_metabob_mcp()`

### Issue: "Authentication failed"

**Symptom**: Registration returns 401/403

**Solution**:
1. Check API key in `.metabob/config.json`
2. Verify API key has template registration permissions
3. Test with `metabob_get_metabob_status()`

### Issue: "Template already exists"

**Symptom**: Backend rejects registration (duplicate ID)

**Solution**:
1. Use `overwrite: true` option in registration
2. Or delete existing template first
3. Or version the template (change ID)

---

## Summary

**Current State**: ❌ Templates not synced to backend (TODO comment in code)

**Solution**: ✅ Implement MCP tool call in `registerActivityTemplate()`

**Impact**: 🎯 Templates become centralized, shareable, and trackable

**Implementation Time**: 30 minutes (code change + testing)

**Verification**: Multiple methods (logs, API query, execution test)

**Recommendation**: **Apply fix immediately** to enable proper backend synchronization
