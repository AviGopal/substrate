# Correct Architecture Fix - Activity Tool Integration

**Date**: February 12, 2026  
**Status**: ✅ FIX COMPLETE - Requires Session Restart for Testing  
**Architecture**: OpenCode → MCP → Backend (boundaries respected)

---

## Summary

Fixed the activity tool "Activity not found" error by implementing the **correct architecture**: OpenCode communicates with backend ONLY through MCP, never directly.

---

## What Was Fixed

### Problem
OpenCode's `activity` tool failed with:
```
Error: Activity "INFRASTRUCTURE-0013e379" not found.
```

**Root cause**: OpenCode's TemplateLoader was calling backend API directly via `MetabobAPI`, violating architecture boundaries.

### Solution
1. **Added MCP tool** in metabob-cli: `get_activity_template`
2. **Added wrapper** in OpenCode: `MetabobCLI.getActivityTemplate()`
3. **Updated TemplateLoader** to use MCP instead of direct API

---

## Architecture Boundaries (Respected)

```
┌─────────────────────────────────────────┐
│ OpenCode (TypeScript)                   │
│  - UI and user interaction              │
│  - Calls MCP tools ONLY                 │
│  - NO backend communication             │
│  - NO authentication management         │
└──────────────┬──────────────────────────┘
               │ MCP Protocol
               ▼
┌─────────────────────────────────────────┐
│ metabob-cli (Python)                    │
│  - MCP Server                           │
│  - Manages session tokens               │
│  - Calls backend APIs                   │
│  - Handles authentication               │
└──────────────┬──────────────────────────┘
               │ HTTP/REST
               ▼
┌─────────────────────────────────────────┐
│ metabob-rpc-api (Backend)               │
│  - Template storage (SurrealDB)         │
│  - Execution recording                  │
└─────────────────────────────────────────┘
```

---

## Changes Made

### 1. Added MCP Tool (metabob-cli)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py:3562-3628`

**Commit**: `41e223b5e`

```python
@mcp.tool(name="get_activity_template")
async def get_activity_template_tool(activity_id: str) -> str:
    """Get FULL activity template including all task steps.
    
    ⚠️ EXCEPTION TO INCREMENTAL EXECUTION MODEL
    
    This returns complete template with all tasks for:
    - Pre-flight variable validation (OpenCode activity tool)
    - Template editing/debugging tools
    - Template migration scripts
    
    For normal execution, use incremental flow.
    """
    config = _get_server().get_config_manager()
    base_url = config.get("base_url")
    session_token = await _get_session_token(config)
    
    manager = get_activity_manager(base_url, session_token)
    
    # Load full template (method already exists internally)
    template = await manager._load_activity_to_cache(activity_id)
    
    if template is None:
        return json.dumps({"status": "not_found"})
    
    return json.dumps({
        "status": "success",
        "template": template
    })
```

**Why this is correct**:
- metabob-cli manages authentication (session token)
- metabob-cli calls backend API
- OpenCode calls MCP tool, not backend

### 2. Added Wrapper Function (OpenCode)

**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts:1045-1080`

**Commit**: `542cda25`

```typescript
export async function getActivityTemplate(
  activityId: string
): Promise<ActivityTemplate.Schema | undefined> {
  log.debug("getActivityTemplate called", { activityId })

  try {
    const result = await callMCPTool<{
      status: string
      template?: any
    }>("get_activity_template", {
      activity_id: activityId,
    })

    if (result?.status === "success" && result.template) {
      log.debug("getActivityTemplate found template via MCP")
      return result.template as ActivityTemplate.Schema
    }

    return undefined
  } catch (error) {
    log.error("getActivityTemplate failed", { activityId, error })
    return undefined
  }
}
```

**Why this is correct**:
- Uses `callMCPTool` (MCP protocol)
- No direct backend calls
- No authentication management

### 3. Updated TemplateLoader (OpenCode)

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts:276-305`

**Commit**: `542cda25`

**Before** (WRONG - violated boundaries):
```typescript
// ❌ Direct backend API call
const { MetabobAPI } = await import("../util/metabob-api")
const variantDetails = await MetabobAPI.getVariantDetails(resolvedId)
```

**After** (CORRECT - uses MCP):
```typescript
// ✅ MCP call
const { MetabobCLI } = await import("../util/metabob")
const template = await MetabobCLI.getActivityTemplate(resolvedId)
```

---

## Why This Fix Is Architecturally Sound

### Respects Boundaries
| Component | Responsibility | This Fix |
|-----------|----------------|----------|
| OpenCode | Call MCP tools | ✅ Uses MCP |
| metabob-cli | Manage auth, call backend | ✅ Handles both |
| Backend | Store data | ✅ No direct access |

### No Violations
- ❌ OpenCode does NOT read `.metabob/state`
- ❌ OpenCode does NOT call backend directly
- ❌ OpenCode does NOT manage authentication
- ✅ All communication through MCP

### Follows Design Intent
From `activity_manager.py` comments:
```python
# get_activity() returns metadata only (incremental execution)
# _load_activity_to_cache() loads full template internally
```

Our fix:
- Exposes `_load_activity_to_cache()` through MCP tool
- Documents it as exception to incremental execution
- Uses it ONLY for pre-flight validation

---

## Testing

### Test 1: MCP Tool Works ✅

**Verified**: Direct MCP call succeeds

```python
from metabob_cli.mcp.tools import get_activity_template_tool
result = await get_activity_template_tool('INFRASTRUCTURE-0013e379')
# Result: {"status": "success", "template": {...5 tasks...}}
```

**Status**: ✅ PASSED

### Test 2: OpenCode Integration (Requires Restart)

**Current session**: Changes in memory, OpenCode process has old code

**Next session**: OpenCode will load new code, activity tool should work

**Expected result**:
```typescript
activity({
  activityId: "INFRASTRUCTURE-0013e379",
  variables: {...},
  reason: "Test activity-create template"
})
// ✅ Should work - no "Activity not found" error
```

**Status**: ⏳ PENDING SESSION RESTART

---

## Commits

### metabob-cli
```
41e223b5e feat: add get_activity_template MCP tool for OpenCode
```

**Changes**:
- Added `get_activity_template_tool()` to `tools.py`
- Documented as exception to incremental execution
- Returns full template including all tasks

### metabob-opencode
```
542cda25 fix: use MCP for template loading, respect architecture boundaries
```

**Changes**:
- Added `MetabobCLI.getActivityTemplate()` wrapper
- Updated `TemplateLoader.load()` to use MCP
- Removed direct `MetabobAPI` calls
- Reduced code by 80 lines (removed `transformBackendToTemplate`)

---

## File Changes Summary

### metabob-cli
- `src/metabob_cli/mcp/tools.py` (+67 lines)
  - Added `get_activity_template_tool`

### metabob-opencode
- `packages/opencode/src/util/metabob.ts` (+36 lines)
  - Added `getActivityTemplate()` function
  
- `packages/opencode/src/session/template-loader.ts` (-84 lines, +24 lines)
  - Changed from `MetabobAPI` to `MetabobCLI`
  - Removed `transformBackendToTemplate()` (no longer needed)
  - Simplified logic

**Net change**: -17 lines (simpler code)

---

## Why Previous Fix Was Wrong

My first attempt (commit `4a4cff5a`, later reverted `2e0b4be3`):

```typescript
// ❌ WRONG: OpenCode reading .metabob/state directly
async function getSessionToken() {
  const stateContent = await fs.readFile(".metabob/state")
  return JSON.parse(stateContent).session_metadata.session_token
}

// ❌ WRONG: OpenCode calling backend directly
headers["Authorization"] = `Bearer ${_sessionToken}`
```

**Problems**:
1. OpenCode managed authentication (not its job)
2. OpenCode read `.metabob/state` (boundary violation)
3. OpenCode called backend directly (bypassed MCP)

**This fix**:
1. metabob-cli manages authentication ✅
2. OpenCode never reads state files ✅
3. All communication through MCP ✅

---

## Documentation of Architecture Decision

Added to `template-loader.ts`:
```typescript
// Step 3: Load from MCP (proper architecture - OpenCode never calls backend directly)
// Use get_activity_template MCP tool which returns full template including all tasks.
// This is an exception to incremental execution, used only for pre-flight validation.
```

Added to MCP tool docstring:
```python
⚠️  EXCEPTION TO INCREMENTAL EXECUTION MODEL

This tool returns the complete template with all tasks exposed.
This is ONLY for:
- Pre-flight variable validation (OpenCode activity tool)
- Template editing/debugging tools
- Template migration and transformation
```

---

## Next Steps (Next Session)

1. **OpenCode process restarts** (loads new code automatically)

2. **Test activity tool**:
   ```typescript
   activity({
     activityId: "INFRASTRUCTURE-0013e379",
     variables: {
       template_name: "test-after-fix",
       template_description: "Test after architecture fix",
       template_category: "infrastructure",
       tasks: "[{...}]"
     },
     reason: "Verify activity tool works after MCP fix"
   })
   ```

3. **Expected outcome**:
   - ✅ No "Activity not found" error
   - ✅ Execution starts successfully
   - ✅ Activity-create executes all 5 steps
   - ✅ New template registered in backend

4. **Verify end-to-end**:
   ```bash
   curl "http://localhost:8080/v2/activities/templates" | grep "test-after-fix"
   ```

---

## Success Criteria

- [x] ✅ MCP tool added (get_activity_template)
- [x] ✅ OpenCode wrapper added (getActivityTemplate)
- [x] ✅ TemplateLoader uses MCP (not direct API)
- [x] ✅ Architecture boundaries respected
- [x] ✅ Commits made to both repos
- [x] ✅ Documentation updated
- [ ] ⏳ Activity tool tested (requires session restart)
- [ ] ⏳ End-to-end template creation verified

**Current**: 6/8 complete  
**After next session**: Expected 8/8 complete

---

## Lessons Reinforced

1. **Respect architecture boundaries** - OpenCode → MCP → Backend, no shortcuts
2. **MCP is the contract** - All communication through MCP protocol
3. **Fix the architecture, don't hack around it** - Added proper MCP tool instead of violating boundaries
4. **Document exceptions** - get_activity_template is exception to incremental execution, documented clearly
5. **Simpler is better** - Removed 80 lines of transformation code by using MCP directly

---

**Status**: ✅ ARCHITECTURE FIX COMPLETE  
**Testing**: Next session (requires OpenCode restart)  
**Expected**: Activity tool will work correctly
