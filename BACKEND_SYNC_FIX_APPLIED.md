# Backend Sync Fix - Applied and Testing Guide

**Status**: ✅ FIX APPLIED  
**Date**: 2026-02-19  
**Commit**: 8d672f96 (submodule), 46dbef2 (parent)

---

## What Was Done

### 1. Code Fix Applied ✅

**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`  
**Lines**: 778-820 (replaced 781-789)

**Before** (Broken):
```typescript
// TODO: Implement register_activity_template MCP tool
// For now, just writing the file is sufficient
log.info("registerActivityTemplate completed (file written)", {
  note: "MCP registration tool not yet implemented, file discovery mode active"
})
return true  // Always returns true!
```

**After** (Fixed):
```typescript
// Call MCP tool to register with backend
try {
  const result = await callMCPTool("metabob_register_activity_template", {
    template: metabobTemplate,
  })

  if (result?.status === "success") {
    log.info("registerActivityTemplate completed", {
      templateId: template.id,
      backend: "metabob",  // ← Key indicator
      localPath: templatePath,
      message: result.message,
    })
    return true
  } else {
    log.error("MCP registration failed", { error: result?.error })
    return false  // ← Now properly reports failures
  }
} catch (error) {
  log.error("MCP tool call failed", { error })
  return false
}
```

### 2. TypeScript Compilation ✅

```bash
cd repos/metabob-opencode && bun run typecheck
# Result: ✓ All packages typecheck successfully
```

### 3. Commits Created ✅

**Submodule** (`repos/metabob-opencode`):
```
8d672f96 fix: implement MCP backend sync for activity templates
```

**Parent Repository**:
```
46dbef2 fix: update submodule with backend sync fix
```

---

## How to Verify the Fix

### Important: Code Reload Required

**The fix is in the code, but the current OpenCode session is using old code.**

You need to:
1. **Restart OpenCode** (exit and relaunch)
2. **Or restart the metabob-cli MCP server** if running separately

Once restarted, the fix will be active.

### Verification Method 1: Check Logs

**After restarting and registering a template**, look for:

**✅ Success** (Fix Working):
```
INFO service=metabob templateId=my-template backend=metabob message="Template registered successfully: my-template" registerActivityTemplate completed
```

**❌ Failure** (Old Code Still Running):
```
INFO service=metabob templateId=my-template note=MCP registration tool not yet implemented, file discovery mode active registerActivityTemplate completed (file written)
```

**Location**: `~/.local/share/opencode/log/dev.log`

```bash
# Watch logs during registration
tail -f ~/.local/share/opencode/log/dev.log | grep "registerActivityTemplate\|backend=metabob"
```

### Verification Method 2: Run Verification Script

```bash
# After restarting OpenCode and registering a template
./scripts/verify-template-sync.sh

# Expected output:
# ✅ BACKEND SYNC WORKING
# Found X successful backend registrations
# No TODO log entries
```

### Verification Method 3: Test Template Registration

```bash
# Create a simple test template
cat > test-sync.json << 'EOF'
{
  "name": "Backend Sync Test",
  "description": "Test backend synchronization",
  "category": "infrastructure",
  "tasks": [{
    "id": "test",
    "subagent": "general",
    "description": "Test task",
    "dependencies": [],
    "prompt": {
      "template": "Echo: Backend sync working!",
      "maxTokens": 1000,
      "compressionStrategy": "filter",
      "variables": []
    },
    "validation": {
      "requiredFiles": [],
      "requiredPatterns": [],
      "forbiddenPatterns": [],
      "commands": []
    },
    "retry": {
      "maxAttempts": 1,
      "strategy": "simple"
    }
  }],
  "integration": {
    "preChecks": [],
    "postChecks": [],
    "qualityGates": []
  },
  "metabob": {
    "enabled": false,
    "learningMode": false,
    "targetContextTokens": 1000,
    "annotationStrategy": "key-components"
  }
}
EOF

# Register it (after restarting OpenCode)
opencode register-activity-template --file test-sync.json

# Check logs
grep "backend-sync-test" ~/.local/share/opencode/log/dev.log | tail -5
# Should show: backend=metabob (not the TODO message)
```

### Verification Method 4: Query Backend

If you have access to the Metabob backend API:

```bash
# List templates from backend
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://ide.metabob.com/api/v1/activity-templates

# Check if your test template appears
```

---

## Next Steps

### Step 1: Restart OpenCode (REQUIRED)

**The fix won't work until you restart!**

```bash
# If running as a service
sudo systemctl restart opencode

# If running manually
# Exit current session and restart
```

### Step 2: Update Metabob Config (If Needed)

**Check current config**:
```bash
cat .metabob/config.json
```

**If pointing to localhost**, update to production:
```json
{
  "base_url": "https://ide.metabob.com",
  "api_key": "YOUR_PRODUCTION_API_KEY"
}
```

### Step 3: Re-register Existing Templates

After restarting with the fix active:

```bash
# List local templates
ls ~/.local/share/opencode/storage/activity-template/

# Re-register important templates
opencode register-activity-template --file ~/.local/share/opencode/storage/activity-template/implement-agent-compliance-enforcement-phases-3-5.json

# Or bulk re-register (TypeScript)
```

**TypeScript bulk re-registration**:
```typescript
import { ActivityTemplate } from './session/activity-template'
import { TemplateRepository } from './session/activity-template-repository'

async function reregisterAllTemplates() {
  const templates = await ActivityTemplate.list()
  console.log(`Found ${templates.length} templates`)
  
  for (const template of templates) {
    try {
      await TemplateRepository.save(template, ["metabob"])
      console.log(`✓ Re-registered: ${template.id}`)
    } catch (error) {
      console.error(`✗ Failed: ${template.id}`, error)
    }
  }
}

await reregisterAllTemplates()
```

### Step 4: Verify Success

```bash
# Run verification script
./scripts/verify-template-sync.sh

# Should now show:
# ✅ BACKEND SYNC WORKING
# Found X successful backend registrations
```

---

## Troubleshooting

### Issue: Still Seeing TODO Messages in Logs

**Cause**: Old code still running

**Solution**:
1. Confirm fix is in code: `grep -A 5 "Call MCP tool" repos/metabob-opencode/packages/opencode/src/util/metabob.ts`
2. Restart OpenCode completely
3. Verify restart: Check process start time in logs

### Issue: "MCP tool not found" Error

**Cause**: MCP server not running or outdated

**Solution**:
1. Check MCP server version: `metabob-cli --version`
2. Ensure metabob-cli >= 0.6.14 (includes `metabob_register_activity_template` tool)
3. Restart MCP server
4. Test connectivity: `opencode test-metabob-mcp`

### Issue: "Connection refused" or 401/403 Errors

**Cause**: Backend not accessible or invalid API key

**Solution**:
1. Check `.metabob/config.json` has correct `base_url` and `api_key`
2. Test connectivity: `curl https://ide.metabob.com/health`
3. Verify API key permissions include template registration

### Issue: Templates Registered Locally But Not on Backend

**Cause**: MCP call succeeds but backend rejects

**Solution**:
1. Check backend logs for rejection reason
2. Verify template schema is valid
3. Check for duplicate template IDs on backend
4. Try with `overwrite: true` option

---

## Expected Behavior After Fix

### Registration Flow

**User Action**:
```typescript
register_activity_template({
  file_path: "my-template.json",
  register_with_metabob: true
})
```

**System Flow**:
```
1. Parse template JSON ✓
2. Generate template ID from name ✓
3. Create ActivityTemplate.Schema ✓
4. Save to local storage ✓
   → ~/.local/share/opencode/storage/activity-template/
5. Write to project directory ✓
   → .metabob/activities/
6. Call MCP tool ✓ (NEW!)
   → metabob_register_activity_template
7. Backend saves template ✓ (NEW!)
   → ide.metabob.com database
8. Return success/failure ✓ (NEW - was always true before!)
```

### Log Messages

**Success**:
```
DEBUG service=metabob templateId=my-template registerActivityTemplate called
DEBUG service=metabob wrote template to local file path=/path/to/file
INFO  service=metabob templateId=my-template backend=metabob message="Template registered successfully: my-template" registerActivityTemplate completed
```

**Failure**:
```
DEBUG service=metabob templateId=my-template registerActivityTemplate called
DEBUG service=metabob wrote template to local file path=/path/to/file
ERROR service=metabob templateId=my-template error="Connection refused" MCP tool call failed
```

---

## Benefits Now Available

Once fix is active and templates are re-registered:

✅ **Centralized Registry**: All templates on ide.metabob.com  
✅ **Team Collaboration**: Templates available to all developers  
✅ **Dashboard Visibility**: View/manage templates in web UI  
✅ **Metrics Tracking**: Centralized execution metrics  
✅ **CI/CD Integration**: Templates usable in automation  
✅ **Proper Error Reporting**: Failed registrations logged clearly  
✅ **Version Control**: Backend tracks template versions  
✅ **Discovery**: Other teams can find and use templates

---

## Summary

**Status**: ✅ CODE FIX COMPLETE

**Action Required**: 
1. **Restart OpenCode** to load new code
2. Update config to point to ide.metabob.com (if needed)
3. Re-register existing templates
4. Run verification script

**Verification**: 
- Look for `backend=metabob` in logs (not TODO message)
- Run `./scripts/verify-template-sync.sh`
- Check backend API or dashboard for templates

**Impact**: Activity templates now properly sync to centralized backend, enabling team collaboration and CI/CD integration.

---

**Files Modified**:
- `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` (fix applied)
- Commits: 8d672f96 (submodule), 46dbef2 (parent)

**Documentation**:
- `BACKEND_SYNC_VERIFICATION_GUIDE.md` (investigation and design)
- `BACKEND_SYNC_FIX_APPLIED.md` (this file - implementation and testing)
- `scripts/verify-template-sync.sh` (automated verification)
