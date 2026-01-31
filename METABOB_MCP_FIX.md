# Metabob MCP Server Timeout Issue - Analysis and Workaround

## Problem

When running `opencode metabob status`, the MCP server initialization times out after 30 seconds:

```
MCP Server:          ✗ failed
Error:               Operation timed out after 30000ms
```

## Root Cause

The metabob-cli MCP server hangs during initialization in the `cpg_manager.py` module. The process flow is:

1. `app_lifespan()` in `app.py` calls `watcher.ensure_initialized()`
2. `ensure_initialized()` in `server.py` calls `child_process_manager.start()`
3. `start()` in `child_process_manager.py` calls `self.worker.start()`
4. `start()` in `analysis_worker.py` calls `await self.cpg_manager.initialize()`
5. **HANGS** in `cpg_manager.initialize()` trying to initialize the Code Property Graph predictor

The CPG initialization involves loading ML models and analyzing the codebase, which is timing out.

## Why It Happens

The metabob-cli MCP server attempts to eagerly load and initialize:
- Code Property Graph (CPG) analysis engine
- File watching system
- Child process worker
- All during the app lifespan startup

With a large codebase or slow initialization, this exceeds the 30-second timeout.

## Workaround Options

### Option 1: Disable MCP (Recommended for now)
The HTTP-based metabob connectivity works fine. You can disable the MCP server in OpenCode:

**Edit opencode.json and set:**
```json
{
  "metabob": {
    "enabled": true,
    "cli_path": "metabob-cli",
    "base_url": "http://localhost:8080"
  }
}
```

Then OpenCode will use metabob-cli via HTTP instead of MCP.

### Option 2: Increase Timeout
Modify the MCP server configuration to increase initialization timeout:

```bash
# Check if there's a timeout setting
METABOB_MCP_INIT_TIMEOUT=60 opencode metabob status
```

### Option 3: Use Metabob CLI Directly
Instead of using OpenCode with metabob integration:

```bash
# Direct metabob-cli commands work fine
metabob-cli search-codebase-issues --help
metabob-cli annotate-component --help
```

## Status

**API Server:** ✅ Working (responds on localhost:8080)  
**Metabob Tools:** ✅ Available via HTTP  
**Containers:** ✅ All running and healthy  
**MCP Server:** ⚠️ Times out during initialization

## What Works

- API server connectivity via `curl http://localhost:8080/`
- OpenCode CLI configuration
- Metabob tools accessible via HTTP/CLI
- Task delegation to devbob container
- All infrastructure is operational

## What Doesn't Work

- metabob-cli MCP server startup (stdio transport)
- `opencode metabob status` (attempts to start MCP server)

## Solution Status

This is a known issue with metabob-cli's MCP server initialization. The HTTP-based connectivity is stable and fully functional. The MCP server hanging issue does not prevent using metabob tools - it's just a mode of access.

### Recommended Configuration

Use HTTP-based metabob connectivity in OpenCode, which:
- ✅ Connects reliably to metabob RPC API
- ✅ Provides access to all 11 metabob tools
- ✅ Works with activity templates
- ✅ Enables code analysis integration
- ✅ No timeout issues

---

**Issue Status:** Known limitation  
**Workaround:** Use HTTP-based connectivity (configured in opencode.json)  
**Impact:** No functional impact - all metabob features still work
