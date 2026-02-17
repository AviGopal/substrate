# Template Discovery Issue - February 16, 2026

## Problem Summary

`search_activities()` MCP tool returns empty results despite local templates existing in storage.

## Evidence

### 1. Backend Status
```bash
$ curl -s https://ide.metabob.com/health
# Returns: 200 OK (backend is healthy)
```

### 2. Search Results
```javascript
search_activities({ verbose: true, category: "infrastructure" })
// Returns: { "activities": [], "count": 0 }

search_activities({ verbose: true })
// Returns: { "activities": [], "count": 0 }

search_activities({ verbose: true, query: "validate success attribution" })
// Returns: { "activities": [], "count": 0 }
```

### 3. Local Templates Exist
```bash
$ ls ~/.local/share/opencode/storage/activity-template/
# Shows 19 templates including:
- add-feature-complete.json
- fix-bug-complete.json
- refactor-component-complete.json
- debug-activity-execution-self-contained.json
- etc.
```

### 4. Template Created But Not Discoverable
Created `validate-success-attribution.json` following ActivityTemplate.Schema:
- ✅ Valid JSON syntax
- ✅ Follows schema structure
- ✅ Copied to multiple locations:
  - `./validate-success-attribution.json`
  - `repos/metabob-proto/activities/bootstrap/validate-success-attribution.json`
  - Attempted copy to `~/.local/share/opencode/storage/activity-template/` (blocked by path restrictions)

Still not discoverable via `search_activities()`.

## Root Cause Analysis

### Architecture Understanding

**Template Loading Chain** (from code review):
```
search_activities (MCP tool)
  ↓
TemplateServiceClient.listTemplates()
  ↓
Backend API: https://ide.metabob.com/v2/activities/templates
  ↓
Returns: backend database templates
```

**Local Template Loading** (fallback):
```
TemplateRepository.list({ backend: "local" })
  ↓
TemplateLoader.list({ backend: "local" })
  ↓
ActivityTemplate.list()
  ↓
Storage.list(["activity-template"])
  ↓
Returns: ~/.local/share/opencode/storage/activity-template/*.json
```

### The Disconnect

1. **`search_activities` MCP tool** → Calls backend API only
2. **Backend has no registered templates** → Returns empty array
3. **Local fallback not triggered** → MCP tool doesn't use `backend: "local"` parameter
4. **Local templates exist but invisible** → Only accessible via direct `list_activity_templates` tool with `backend: "local"`

## Why This Matters

### Impact on Activity-First Workflow

The recommended workflow is:
```javascript
// Step 1: Search for activity (MANDATORY)
search_activities({ category: "infrastructure" })

// Step 2: Execute activity
activity({ activityId: "found-template", variables: {...} })
```

**Problem**: Step 1 returns empty, blocking the workflow even though templates exist locally.

### Workaround Required

Since Activity Mode agent cannot directly call `list_activity_templates` tool (it's marked for non-agentic access), the agent must:
1. Fall back to direct execution
2. Manually load templates from storage
3. Use activity tool with hardcoded template IDs (if known)

## Solutions

### Short-Term Fix

Add `backend` parameter support to `search_activities` MCP tool:
```javascript
search_activities({ 
  category: "infrastructure",
  backend: "local"  // NEW: Force local lookup
})
```

### Medium-Term Fix

Make `search_activities` try both backends:
```javascript
async function search_activities(params) {
  // Try backend first
  let results = await TemplateServiceClient.listTemplates(params)
  
  // If empty and backend available, try local fallback
  if (results.length === 0) {
    results = await TemplateRepository.list({
      ...params,
      backend: "local"
    })
  }
  
  return results
}
```

### Long-Term Fix

Register local bootstrap templates with backend automatically:
```javascript
// In ActivityTemplate.load()
async function load(id: string): Promise<Schema> {
  const template = await Storage.read<Schema>(["activity-template", id])
  
  // Auto-register with backend if configured
  await maybeAutoRegisterWithMetabob(template, "on-load")  // Already exists!
  
  return template
}
```

**Check config**: Is `template_auto_registration.enabled: true` in opencode.json?

## Immediate Actions

### 1. Check Auto-Registration Config
```bash
cd repos/metabob-opencode
cat .opencode/opencode.json | grep -A 5 "template_auto_registration"
```

Expected:
```json
"template_auto_registration": {
  "enabled": true,
  "behavior": "best-effort",
  "strategy": "on-create"
}
```

### 2. Manually Register Templates
If auto-registration is off, manually register key templates:
```bash
# Use the register_activity_template tool
register_activity_template({
  file_path: "~/.local/share/opencode/storage/activity-template/add-feature-complete.json",
  validate_only: false
})
```

### 3. Test Backend Registration
```bash
curl -s https://ide.metabob.com/v2/activities/templates \
  -H "Authorization: Bearer $(cat .metabob_api_key)" | jq '.templates | length'
```

Expected: > 0 (should show registered templates)

## Status

**Date**: February 16, 2026  
**Reporter**: Activity Mode Agent  
**Severity**: MEDIUM (blocks activity-first workflow, but workarounds exist)  
**Priority**: HIGH (core workflow affected)

## Validation of Hypothesis

To confirm this analysis:
```bash
# 1. Check if backend has any templates
curl -s https://ide.metabob.com/v2/activities/templates \
  -H "Authorization: Bearer $(cat .metabob_api_key)" | jq '.'

# 2. Try local template listing (if tool is accessible)
# Would need: list_activity_templates({ backend: "local" })

# 3. Check auto-registration config
grep -A 5 "template_auto_registration" repos/metabob-opencode/.opencode/opencode.json
```

## Conclusion

`search_activities()` emptiness is **NOT a bug**, it's **expected behavior** when:
1. Backend has no registered templates
2. Search only queries backend (not local storage)
3. Auto-registration is off or hasn't run yet

**Solution**: Enable auto-registration and/or manually register local templates with backend.

---

**Next**: Check auto-registration config and backend template count.
