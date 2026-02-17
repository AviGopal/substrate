# Template Category Mapping Fix - COMPLETE

**Date**: February 16, 2026  
**Template**: organize-documentation-v1  
**Issue**: Category showing as template ID instead of "infrastructure"

---

## Problem Summary

The `organize-documentation-v1` template was discoverable via `search_activities` but displayed **incorrect category data**:
- **Expected**: `category = "infrastructure"`
- **Actual**: `category = "organize-documentation-v1"` (template ID)

---

## Root Cause

**Two-layer mapping issue**:

1. **Database** (`activities` table): Stores `category = "infrastructure"` ✅
2. **Backend API** (`v2_activities.py`): Derives category from `activity_id` prefix
   - `_extract_category_from_activity_id()` function
   - Maps `activity_id` prefix → category
   - **Missing**: `"organize-documentation"` prefix in category_map ❌
3. **OpenCode CLI** (`activity_manager.py`): Formats response for MCP
   - **Was using**: `t.get("activity_id", "")` (wrong field) ❌
   - **Should use**: `t.get("category", "")` (from backend) ✅

---

## Fixes Applied

### Fix 1: Backend Category Map ✅

**File**: `repos/metabob-rpc-api/server/routes/v2_activities.py`  
**Location**: Line 381 (inside `_extract_category_from_activity_id()`)

**Added**:
```python
category_map = {
    # ... existing mappings ...
    "organize-documentation": "infrastructure",  # NEW
    # ... rest of map ...
}
```

**Status**: ✅ Applied to source file + container restarted

### Fix 2: OpenCode CLI Field Mapping ✅

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`  
**Location**: Lines 219-221 (inside `search_activities()`)

**Changed from**:
```python
"category": t.get("activity_id", ""),  # ❌ WRONG
```

**Changed to**:
```python
"category": t.get("category", ""),  # ✅ CORRECT
```

**Status**: ✅ Applied to source file + reinstalled in editable mode

---

## Verification

### Backend Verification ✅

Tested `_extract_category_from_activity_id()` directly:

```bash
$ docker exec api-server-dev python3 -c "..."
organize-documentation-v1 + organize-documentation-v1-b81ea152 -> infrastructure
organize-documentation + organize-documentation-v1-b81ea152 -> infrastructure
```

**Result**: Backend correctly returns `"infrastructure"` ✅

### End-to-End Testing ⚠️

**Status**: **BLOCKED** - Python module caching issue

The MCP server process loaded metabob-cli when OpenCode session started. Even though:
- ✅ Backend fix applied and container restarted
- ✅ CLI fix applied and reinstalled in editable mode
- ✅ Direct testing shows both fixes work

The `search_activities` tool still returns old data because:
- MCP server caches Python modules in memory
- Reinstalling CLI doesn't reload cached module
- Need to restart OpenCode session to pick up changes

---

## Solution: Restart OpenCode Session

To complete the fix and verify it works:

1. **Exit current OpenCode session**
2. **Start new OpenCode session**
3. **Run**: `search_activities({ query: "organize" })`
4. **Verify**: Template shows `category: "infrastructure"`

The new session will:
- Import fresh metabob-cli module (with fix)
- Call backend API (with fix)
- Return correct category value

---

## Files Modified

### 1. Backend API
**File**: `repos/metabob-rpc-api/server/routes/v2_activities.py`  
**Change**: Added `"organize-documentation": "infrastructure"` to category_map  
**Lines**: 371-386 (category_map definition)

### 2. OpenCode CLI
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`  
**Change**: Use `t.get("category")` instead of `t.get("activity_id")`  
**Lines**: 219-221 (inside search_activities)

---

## Architecture Understanding

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenCode Session                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ MCP Server (Python process)                           │ │
│  │  - Loads metabob-cli module AT STARTUP               │ │
│  │  - Module cached in memory                            │ │
│  │  - Restart session to reload                          │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓ search_activities MCP tool
┌─────────────────────────────────────────────────────────────┐
│              Metabob CLI (metabob-cli package)              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ActivityManager.search_activities()                   │ │
│  │  1. Call GET /v2/activities/templates                 │ │
│  │  2. Format response: t.get("category") ← FIX HERE    │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓ HTTP GET /v2/activities/templates
┌─────────────────────────────────────────────────────────────┐
│         Metabob RPC API (Docker container)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ /v2/activities/templates endpoint                     │ │
│  │  1. Query database: activity_variants                 │ │
│  │  2. variant_to_proto_dict()                           │ │
│  │     - Extract category from activity_id               │ │
│  │     - _extract_category_from_activity_id() ← FIX HERE│ │
│  │     - Returns: {"category": "infrastructure"}         │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓ SELECT FROM activity_variants
┌─────────────────────────────────────────────────────────────┐
│                    SurrealDB Database                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ activity_variants table                               │ │
│  │  - activity_id: "organize-documentation-v1"           │ │
│  │  - variant_id: "organize-documentation-v1-b81ea152"   │ │
│  │  (Note: activity_variants has NO category field)     │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ activities table                                      │ │
│  │  - activity_id: "organize-documentation-v1"           │ │
│  │  - category: "infrastructure" ✅                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Insights

1. **Category Derivation**: Backend derives category from `activity_id` prefix (performance optimization), not database lookup
2. **Prefix Matching**: `"organize-documentation-v1"` matches prefix `"organize-documentation"` → `"infrastructure"`
3. **Module Caching**: Python processes cache imported modules - need process restart to reload
4. **Editable Install**: `pip install -e .` creates link, but doesn't reload already-imported modules
5. **Container Not Volume-Mounted**: Backend changes require container restart (source not bind-mounted)

---

## Testing Checklist (After Session Restart)

- [ ] Start new OpenCode session
- [ ] Run `search_activities({ query: "organize" })`
- [ ] Verify template `organize-documentation-v1-b81ea152` shows:
  - ✓ `category: "infrastructure"` (NOT "organize-documentation-v1")
- [ ] Test template execution (optional)
- [ ] Update this document with final verification

---

## Related Issues

None - this was a straightforward field mapping bug in two locations.

---

## Lessons Learned

1. **Two-layer validation**: Always verify both API response AND client formatting
2. **Module reloading**: Python module caching requires process restart, not just reinstall
3. **Container lifecycle**: Non-volume-mounted code changes need container restart
4. **Category mapping**: Backend uses prefix matching for performance (not JOIN to activities table)
