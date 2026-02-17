# Sequence Break Identified

## The Break Point

**Location**: MCP Server Startup → OpenCode listTools() timeout

## Timeline (from logs)

```
19:26:52.625 - MCP server starts
19:26:52.625 - "Starting MCP server (initialization will happen in background)..."
19:27:01.507 - Shutdown signal received (9 seconds later)
19:27:01.507 - Server killed by OpenCode
```

## What Happens

1. **OpenCode starts** at 18:43
2. **OpenCode spawns MCP server** via stdio
3. **MCP server begins startup**:
   - Imports modules
   - Creates FastMCP server task
   - **BLOCKS on `await _ensure_session()`** ← PROBLEM!
   - Starts analysis engine initialization
4. **OpenCode connects** and calls `client.listTools()`
5. **MCP server can't respond** (blocked on session creation)
6. **OpenCode timeout** (10 seconds) triggers
7. **OpenCode kills MCP client**
8. **MCP server receives SIGTERM** and shuts down
9. **No MCP client available** for tools

## Why Direct Python Works

```python
# Direct Python test
python test.py
  → No OpenCode timeout
  → Server has time to initialize
  → Session creation completes
  → listTools() works
  → Tools work ✅
```

## Why OpenCode Fails

```
OpenCode → MCP server
  → Server blocked on session creation
  → listTools() times out (10s)
  → OpenCode kills server ❌
  → No tools available
```

## The Root Cause

**Line 861 in server.py:**
```python
await _ensure_session()  # BLOCKS the main async flow!
```

This blocking call prevents FastMCP from responding to `listTools()` quickly.

## Evidence

**From logs:**
- Server starts: 19:26:52.625
- Server killed: 19:27:01.507
- **Duration: 9 seconds** (just under 10s timeout)

**What took 9 seconds:**
- Module imports: ~1s
- Session creation: ~6-7s (HTTP call to backend)
- Analysis engine start: ~1s
- **Total: ~9s** → Timeout!

## Solutions

### Option 1: Defer Session Creation
```python
# Start server immediately
server_task = asyncio.create_task(MetabobMCP.run_stdio_async())

# Create session in background (don't await)
session_task = asyncio.create_task(_ensure_session())

# Start analysis in background
init_task = watcher.start_initialization_background()

# Server can now respond to listTools() immediately!
```

### Option 2: Increase OpenCode Timeout
```typescript
// In OpenCode config.ts
const toolsTimeout = mcp.timeout ?? 30_000  // 30s instead of 10s
```

### Option 3: Make Session Creation Lazy
Only create session when first tool needs it, not at startup.

## Recommended Fix

**Option 1** (defer session creation) is best because:
- Server responds to `listTools()` immediately
- Session creation happens in background
- No timeout needed
- Works for all tools that don't need session yet

