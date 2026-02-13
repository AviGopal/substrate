# Data Flow Timing Analysis

## Observed Timeline (from logs)

```
T+0.000s  : MCP server process starts
T+0.526s  : "Starting background initialization" 
T+0.984s  : CallToolRequest received by MCP server
T+0.984s  : [TOOL_START] search_activities
T+17.125s : [TOOL_COMPLETE] search_activities (16.6s elapsed)
```

## Expected Code Flow

### 1. Server Startup (`server.py:stdio_main()`)

**Line 834-836**: Start heartbeat task (background)
```python
start_time = time.time()
heartbeat_task = asyncio.create_task(_stdio_heartbeat_task(start_time))
```

**Line 850**: Start MCP server task
```python
server_task = asyncio.create_task(MetabobMCP.run_stdio_async())
```
- This creates a task that runs FastMCP's stdio server
- Should be non-blocking (it's a task)
- Server should be ready to accept requests immediately

**Line 855**: Session creation
```python
await _ensure_session()  # This is AWAITED - blocks until complete
```
- Takes ~0.5s (from T+0.000s to T+0.526s based on logs)
- Creates session with backend via HTTP

**Line 862**: Background initialization
```python
init_task = watcher.start_initialization_background()
```
- Returns immediately (doesn't await)
- Initialization happens in background
- Takes ~16 seconds total

### 2. Tool Request Arrives (T+0.984s)

FastMCP receives `CallToolRequest` for `search_activities`

**Question**: Where does FastMCP route this request?

### 3. Tool Execution Path

**tools.py:Line ~3418**: `search_activities_tool()` function

```python
@mcp.tool(...)
async def search_activities_tool(...):
    try:
        config = get_config_manager()           # ← How long?
        session_token = await _get_session_token(config)  # ← How long?
        manager = get_activity_manager(...)     # ← How long?
        results = await manager.search_activities(...)  # ← How long?
```

**Expected timing**:
- `get_config_manager()`: Should be instant (reads cached config)
- `_get_session_token()`: Should be instant (reads cached state)
- `get_activity_manager()`: Instant (just creates object)
- HTTP call: ~0.1-0.5s

**Total expected**: < 1 second

**Actual timing**: 16.6 seconds

## The Gap: 16 seconds unaccounted for

**Hypothesis**: Something in this call chain is waiting for initialization

## Investigation Points

### A. Does `get_config_manager()` block?

**server.py:Line ~88-105**:
```python
def get_config_manager() -> ConfigDict:
    """Get metabob configuration."""
    # Lazy-load config
    if config is None:
        config = load_config(config_path=config_path)
    
    # Load session token from state
    try:
        fsm = FileStateManager(state_file)
        # NOTE: We removed reload_state() call here
        session_token = fsm.get_session_token()
    except Exception as e:
        logger.debug(f"Could not load session token: {e}")
```

**Potential issues**:
- `FileStateManager.__init__()` - does it do blocking I/O?
- `fsm.get_session_token()` - does it implicitly load state?

### B. Does `_get_session_token()` block?

**tools.py:Line ~42-73**:
```python
async def _get_session_token(config: dict) -> str:
    session_token = config.get("session_token", "")
    
    if not session_token:
        state_mgr = FileStateManager(state_file)
        await state_mgr.reload_state_async(force=True)  # ← ASYNC, shouldn't block
        session_token = state_mgr.get_session_token()
```

**Potential issues**:
- `FileStateManager.__init__()` again
- Is `reload_state_async()` actually async or does it block?

### C. Does FastMCP have middleware/hooks that block?

**Check**:
- Does FastMCP call `ensure_initialized()` before tool execution?
- Is there a global lock or semaphore?
- Are all tools executed sequentially?

### D. Is the tool decorator adding blocking behavior?

**tools.py:Line ~118-142**: Our instrumentation wrapper
```python
def _instrumented_tool(*args, **kwargs):
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*func_args, **func_kwargs):
            start_time = time_module.time()
            logger.info(f"[TOOL_START] {tool_name}...")
            result = await func(*func_args, **func_kwargs)  # ← Does await block here?
            logger.info(f"[TOOL_COMPLETE]...")
```

## Next Steps

1. **Verify FileStateManager.__init__() is non-blocking**
   - Check if it calls `_load_state()` synchronously

2. **Add timing BEFORE tool function body**
   - Add logging at the FastMCP level to see delay between request receipt and function call

3. **Check if FastMCP is waiting for something**
   - Review FastMCP source or add logging to understand its request handling

4. **Test with minimal tool**
   - Create a simple tool that just returns immediately
   - See if it also takes 16 seconds

