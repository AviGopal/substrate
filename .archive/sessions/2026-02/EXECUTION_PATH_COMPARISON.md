# Execution Path Comparison: Direct vs MCP Tool

## Direct Python Call (< 1 second)

```python
# test_activity_create.py
import asyncio
from metabob_cli.mcp.tools import search_activities_tool

result = await search_activities_tool(query='', limit=3)
# Returns in < 1 second
```

**Environment:**
- Runs in main process context
- No MCP server running
- Direct module import
- Config already loaded at import time

## MCP Tool Call (16 seconds)

```javascript
// MCP protocol call
{
  "method": "tools/call",
  "params": {
    "name": "search_activities",
    "arguments": {"query": "", "limit": 3}
  }
}
```

**Environment:**
- Runs in MCP server process
- Server is initializing analysis engine in background
- Called through FastMCP routing
- Multiple concurrent tasks running

## Key Differences

### 1. Module Import Timing

**Direct Call:**
```python
# Import happens BEFORE call
import metabob_cli.mcp.tools  # ← Happens once at script start
result = await search_activities_tool(...)  # ← Function already loaded
```

**MCP Tool Call:**
```python
# Function decorated with @mcp.tool()
@mcp.tool(name="search_activities", ...)
async def search_activities_tool(...):
    from .activity_manager import get_activity_manager  # ← Import happens HERE
    from .server import get_config_manager  # ← And HERE
```

**HYPOTHESIS 1:** The imports inside the function are blocking!

### 2. get_config_manager() Context

**Direct Call:**
- Config module already loaded
- FileStateManager already initialized
- State file already read

**MCP Tool Call:**
- Config might be cold/uninitialized
- FileStateManager created fresh
- State file read for first time in this context

**HYPOTHESIS 2:** `get_config_manager()` is doing expensive initialization

### 3. Concurrent Tasks

**Direct Call:**
- Single async task
- No other I/O happening
- Event loop dedicated to this one operation

**MCP Tool Call:**
- Analysis engine initializing (16 seconds)
- File watching starting
- CPG cache loading
- Multiple async tasks competing for event loop

**HYPOTHESIS 3:** Event loop is starved by analysis engine initialization

### 4. Import-Time Side Effects

Let's check what happens when these modules are imported:

**activity_manager.py:**
```python
# Does this module have import-time side effects?
from metabob_cli.mcp.activity_manager import get_activity_manager
```

**server.py:**
```python
# Does get_config_manager trigger initialization?
from .server import get_config_manager
```

## Testing Each Hypothesis

### Test 1: Move imports to module level

Instead of importing inside function, import at module level:

```python
# At top of tools.py
from .activity_manager import get_activity_manager
from .server import get_config_manager

@mcp.tool(...)
async def search_activities_tool(...):
    # No imports here - already loaded
    config = get_config_manager()
    ...
```

**Expected:** If imports are the issue, this should be fast

### Test 2: Check what get_config_manager() does

Add timing around EVERY line in get_config_manager():

```python
def get_config_manager() -> ConfigDict:
    t0 = time.time()
    if config is None:
        config = load_config(...)
    print(f"Config load: {time.time()-t0}s")
    
    t1 = time.time()
    fsm = FileStateManager(state_file)
    print(f"FileStateManager init: {time.time()-t1}s")
    
    t2 = time.time()
    session_token = fsm.get_session_token()
    print(f"get_session_token: {time.time()-t2}s")
```

### Test 3: Check for blocking synchronous operations

Look for any synchronous I/O or CPU-intensive operations:
- File reads without await
- Synchronous HTTP calls
- Heavy computation
- Lock contention

## Most Likely Culprit

Looking at the code, I suspect **HYPOTHESIS 1** (imports) combined with **HYPOTHESIS 3** (event loop starvation).

### Why imports might block:

When Python imports a module for the first time, it:
1. Compiles the source to bytecode
2. Executes all module-level code
3. Initializes module-level variables
4. Registers decorators

If `activity_manager.py` or `server.py` have expensive module-level initialization, the import will block.

### Why event loop starvation matters:

The analysis engine initialization is doing:
- File system scanning
- CPG cache loading  
- Database operations

Even though it's "background", if it's not properly yielding to the event loop, it can starve other tasks.

## Next Steps

1. **Move imports to module level** - easiest fix
2. **Profile get_config_manager()** - add detailed timing
3. **Check for synchronous I/O** - audit the call chain
4. **Test with analysis disabled** - verify it's the culprit

