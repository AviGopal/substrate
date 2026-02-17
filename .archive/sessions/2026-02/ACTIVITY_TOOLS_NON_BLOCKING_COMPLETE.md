# Activity Tools Non-Blocking Fix - COMPLETE

**Date**: February 11, 2026  
**Status**: ✅ FIXED AND COMMITTED

## Problem Summary

Activity tools were taking 16+ seconds to respond when called via MCP protocol, even though:
- ✅ Backend API worked (17 activities available)
- ✅ Direct Python calls completed in < 1 second  
- ✅ MCP server started successfully

## Root Cause

**Internal imports inside async tool functions were blocking the event loop.**

When activity tools imported modules during execution:
```python
async def search_activities_tool(...):
    from .activity_manager import get_activity_manager  # ← BLOCKS HERE
    from .server import get_config_manager  # ← AND HERE
```

These imports competed with the analysis engine initialization (which takes ~16 seconds) and blocked until initialization completed.

## Why Direct Calls Worked

**Direct Python test:**
```python
# Import happens ONCE at script start
from metabob_cli.mcp.tools import search_activities_tool
result = await search_activities_tool(...)  # Fast - no imports during execution
```

**MCP tool call:**
```python
# Imports happen DURING EACH TOOL CALL
async def search_activities_tool(...):
    from .activity_manager import ...  # ← Blocks for 16s
```

## Solution

### 1. Move Imports to Module Level

**Before:**
```python
# tools.py
async def search_activities_tool(...):
    from .activity_manager import get_activity_manager
    from .server import get_config_manager
    # Tool logic...
```

**After:**
```python
# tools.py (top of file)
from metabob_cli.mcp.activity_manager import get_activity_manager

def _get_server():
    from metabob_cli.mcp import server
    return server

# Tool functions - no imports
async def search_activities_tool(...):
    config = _get_server().get_config_manager()
    # Tool logic...
```

### 2. Avoid Circular Dependency

Used lazy `_get_server()` helper to avoid circular import between `tools.py` ↔ `server.py`.

### 3. Remove All Internal Imports

Removed internal imports from:
- search_activities_tool
- get_activity_tool  
- start_activity_execution_tool
- get_execution_state_tool
- activity_tool
- create_activity_template_tool
- evolve_activity_template_tool
- get_template_lineage_tool
- And 7 more activity/template tools

## Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| search_activities | 16.6s | 0.6s | **27x faster** |
| Tool availability | Blocked | Immediate | **Non-blocking** |
| Event loop | Starved | Responsive | **Fixed** |

## Testing Evidence

**Before Fix:**
```bash
$ node test_import_fix.mjs
[timeout after 10s]
```

**After Fix:**
```bash
$ node test_import_fix.mjs
[2088ms] Initialized - calling search_activities
[2564ms] ✓ SUCCESS: activities returned!
✓✓✓ FIX WORKS - Tool responded in < 5 seconds!
# Tool execution time: 476ms (2564-2088)
```

## Commits

### metabob-cli
```
commit 63341cf72
fix: make activity tools non-blocking by moving imports to module level

- Move get_activity_manager to module level
- Create lazy _get_server() for circular dependency
- Remove all internal imports from tool bodies  
- 27x performance improvement
```

### metabob-opencode  
```
commit bbf65545
fix: make metabob MCP auto-configuration unconditional

- Simplified MCP config logic
- Made metabob-cli required (not optional)
- Clearer architecture
```

## Technical Details

### Why Python Imports Block

When Python imports a module:
1. Searches sys.path for the module
2. Compiles source to bytecode (if needed)
3. **Executes ALL module-level code** ← This can be slow!
4. Caches the module

Module-level imports happen once at startup. Function-level imports happen on every call.

### Event Loop Starvation

The analysis engine initialization:
- Scans filesystem
- Loads CPG cache
- Initializes watchers
- Takes 16+ seconds

When tool imports happen during this initialization, they compete for the event loop and block.

## Files Changed

**metabob-cli:**
- `src/metabob_cli/mcp/tools.py` - Module-level imports, lazy server access
- `src/metabob_cli/mcp/server.py` - Timing instrumentation

**metabob-opencode:**
- `packages/opencode/src/config/config.ts` - Unconditional MCP auto-config

## Verification

✅ Minimal tool responds immediately  
✅ Activity tools respond in < 1s
✅ No circular import errors
✅ All tool functionality preserved
✅ Both repos committed

## Next Steps

1. **Restart OpenCode** to load updated metabob-cli
2. **Test activity system** via OpenCode tools:
   ```javascript
   search_activities({ verbose: true })  // Should return 17 activities quickly
   ```
3. **Execute activities** to demonstrate end-to-end functionality

---

**Status**: ✅ COMPLETE - Ready for testing in OpenCode
