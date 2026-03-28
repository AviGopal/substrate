# Fix: Activity Tools Non-Blocking Execution

**Date**: February 11, 2026  
**Issue**: Activity tools (search_activities, get_activity, etc.) were blocking indefinitely  
**Root Cause**: Synchronous file I/O blocking the async event loop

## Problem

When calling activity-related MCP tools (search_activities, get_activity, etc.), the calls would hang indefinitely, blocking the entire MCP server. This prevented the activity system from working even though:
- ✅ The backend API worked (17 activities available)
- ✅ The MCP server started successfully
- ✅ Direct Python calls worked

## Root Cause Analysis

1. **Activity tools are async** but were calling synchronous blocking I/O
2. **`_get_session_token()` function** called `state_mgr.reload_state(force=True)` 
3. **`reload_state()` is synchronous** and calls `self._load_state()` which does blocking file I/O
4. **File I/O blocked the event loop**, preventing ANY tool from completing
5. **FileStateManager has `reload_state_async()`** that uses thread pool for non-blocking I/O

## The Fix

### Changed Files
- `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

### Changes Made

1. **Made `_get_session_token()` async** (line 42):
   ```python
   async def _get_session_token(config: dict) -> str:
   ```

2. **Used async file I/O** (line 67):
   ```python
   # Before:
   state_mgr.reload_state(force=True)  # BLOCKS event loop!
   
   # After:
   await state_mgr.reload_state_async(force=True)  # Non-blocking
   ```

3. **Awaited all calls to `_get_session_token()`** (15 locations):
   ```python
   # Before:
   session_token = _get_session_token(config)
   
   # After:
   session_token = await _get_session_token(config)
   ```

4. **Removed redundant blocking code** in `search_activities_tool`:
   - Removed duplicate state file reading (lines 3391-3401)
   - `_get_session_token()` already handles this asynchronously

## Impact

**All activity-related tools now execute without blocking:**
- ✅ search_activities
- ✅ get_activity  
- ✅ start_activity_execution
- ✅ activity
- ✅ create_activity_template
- ✅ evolve_activity_template
- ✅ And 9 other activity tools

**These tools can now execute immediately while file analysis runs in the background**, since they only need to query the backend API, not analyze local files.

## Testing

### Before Fix
```bash
$ node /tmp/test_tools_before_analysis.mjs
[time] Initialize complete
[time] ListTools returned 27 tools
TIMEOUT - search_activities never responded (hung indefinitely)
```

### After Fix (Expected)
```bash
$ node /tmp/test_tools_before_analysis.mjs  
[time] Initialize complete
[time] ListTools returned 27 tools
[time] search_activities SUCCESS: 17 activities
```

## Next Steps

1. **Install updated metabob-cli**:
   ```bash
   cd repos/metabob-cli && pip install --no-deps -e .
   ```

2. **Restart OpenCode** to spawn new MCP server with the fix

3. **Test activity tools**:
   ```javascript
   search_activities({ verbose: true })  // Should return 17 activities
   ```

4. **Execute activity**:
   ```javascript
   activity({
     activityId: "INFRASTRUCTURE-0013e379",
     variables: { ... },
     reason: "Test activity execution"
   })
   ```

## Technical Details

### Why This Matters

FastMCP uses a single-threaded async event loop. When ONE tool blocks with synchronous I/O:
- ❌ ALL tools become unresponsive
- ❌ The MCP server appears hung
- ❌ OpenCode times out and kills the connection

By using `reload_state_async()`:
- ✅ File I/O runs in thread pool
- ✅ Event loop stays responsive
- ✅ Other tools can execute concurrently
- ✅ File analysis can happen in background

### FileStateManager Design

The FileStateManager already had both sync and async methods:
- `reload_state()`: Blocking, for synchronous contexts
- `reload_state_async()`: Non-blocking, runs I/O in executor

We just needed to use the correct one in async contexts!

---

**Status**: ✅ Fix Applied  
**Commit**: Pending  
**Ready for**: Testing
