# Metabob CLI Development Management Solution

## Problem Statement

When developing **metabob-cli** alongside **metabob-opencode**, the workflow is fragmented:
1. CLI changes require `pip install -e .` to take effect
2. MCP server (spawned by OpenCode) needs restart to load new CLI code
3. ActivityManager singleton caches templates - needs process restart to clear
4. No easy way to reload just the MCP server without restarting all of OpenCode

## Current Architecture

```
OpenCode Process (bun)
  └─> Spawns MCP Server Process
       └─> Command: metabob-cli mcp --transport stdio
       └─> Uses: Installed Python package (editable or not)
       └─> Singleton: ActivityManager with template cache
```

## Solution Options

### Option 1: **Hot Reload Script** (Recommended for Development)

Create a dev helper script that manages the MCP server lifecycle:

**File**: `repos/metabob-cli/scripts/dev-reload.sh`

```bash
#!/usr/bin/env bash
# Hot reload metabob-cli MCP server during development

set -e

echo "🔄 Metabob CLI Development Reload"
echo "================================="

# 1. Find and kill existing MCP server processes
echo "1. Stopping MCP server processes..."
pkill -f "metabob-cli mcp" || echo "  No MCP server running"

# 2. Reinstall CLI from source (editable)
echo "2. Reinstalling metabob-cli from source..."
cd "$(dirname "$0")/.."
pip install -e . --quiet

# 3. Verify installation
echo "3. Verifying installation..."
python3 -c "import metabob_cli; print(f'  ✓ Version: {metabob_cli.__version__}')"
python3 -c "from metabob_cli.mcp.activity_manager import ActivityManager; print('  ✓ ActivityManager imported')"

# 4. Clear state/cache if requested
if [[ "$1" == "--clear-cache" ]]; then
    echo "4. Clearing CLI cache..."
    rm -rf ~/.metabob/cache
    echo "  ✓ Cache cleared"
fi

echo ""
echo "✅ CLI reloaded! OpenCode will spawn new MCP server on next tool call."
echo ""
echo "💡 Tips:"
echo "   - MCP server will auto-start on next Metabob tool use"
echo "   - Use --clear-cache flag to reset template cache"
echo "   - If issues persist, restart OpenCode"
```

**Usage**:
```bash
# After making CLI changes:
cd repos/metabob-cli
./scripts/dev-reload.sh

# With cache clear:
./scripts/dev-reload.sh --clear-cache
```

### Option 2: **Development Mode in opencode.json**

Add a dev flag to use a wrapper script that auto-reloads:

**File**: `.opencode/opencode.json`
```json
{
  "metabob": {
    "cli_path": "./repos/metabob-cli/scripts/dev-wrapper.sh",
    "api_key": "...",
    "base_url": "http://localhost:8080"
  }
}
```

**File**: `repos/metabob-cli/scripts/dev-wrapper.sh`
```bash
#!/usr/bin/env bash
# Development wrapper that ensures latest CLI code is used

# Reinstall from source on every invocation (slow but safe)
cd "$(dirname "$0")/.."
pip install -e . --quiet 2>&1 > /dev/null

# Forward to actual CLI
exec metabob-cli "$@"
```

**Pros**: Automatic, no manual intervention
**Cons**: Slower (reinstall on every MCP call), but acceptable for dev

### Option 3: **Python Path Override** (Cleanest)

Instead of installing, add the source directory to PYTHONPATH:

**File**: `.opencode/opencode.json`
```json
{
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "environment": {
        "PYTHONPATH": "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src",
        "METABOB_API_KEY": "...",
        "METABOB_API_URL": "http://localhost:8080"
      },
      "enabled": true
    }
  }
}
```

**Pros**: 
- No reinstall needed
- Changes take effect on next MCP server spawn
- Clean separation of dev/prod

**Cons**:
- Still requires MCP server restart (kill process)
- Might have import issues if package structure is complex

### Option 4: **Cache-Aware MCP Server** (Long-term Fix)

Modify the CLI to detect file changes and clear cache automatically:

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

```python
import os
import time
from pathlib import Path

class ActivityManager:
    def __init__(self, ...):
        self._activity_cache = {}
        self._cache_timestamps = {}
        self._dev_mode = os.getenv("METABOB_DEV_MODE") == "1"
        
    async def get_activity(self, activity_id: str) -> dict:
        # In dev mode, check if cache is stale (> 30 seconds old)
        if self._dev_mode:
            cache_time = self._cache_timestamps.get(activity_id, 0)
            if time.time() - cache_time > 30:
                # Invalidate cache entry
                self._activity_cache.pop(activity_id, None)
        
        # ... rest of method
```

**Enable in opencode.json**:
```json
{
  "mcp": {
    "metabob": {
      "environment": {
        "METABOB_DEV_MODE": "1"
      }
    }
  }
}
```

## Recommended Development Workflow

### Setup (Once)

1. **Install CLI in editable mode**:
   ```bash
   cd repos/metabob-cli
   pip install -e .
   ```

2. **Configure OpenCode for development**:
   ```bash
   cd repos/metabob-opencode/.opencode
   # Add to opencode.json:
   {
     "metabob": {
       "cli_path": "metabob-cli",  # Uses editable install
     },
     "mcp": {
       "metabob": {
         "environment": {
           "METABOB_DEV_MODE": "1"  # Enable dev features
         }
       }
     }
   }
   ```

3. **Create reload alias**:
   ```bash
   echo 'alias reload-cli="pkill -f \"metabob-cli mcp\" && echo \"MCP server killed. Will restart on next use.\""' >> ~/.bashrc
   ```

### Daily Development

1. **Make CLI changes** in `repos/metabob-cli/src/`

2. **Reload** (choose one):
   ```bash
   # Quick: Kill MCP server (auto-restarts with new code)
   reload-cli
   
   # OR: Use hot reload script
   cd repos/metabob-cli && ./scripts/dev-reload.sh
   
   # OR: Restart OpenCode (if major changes)
   # Ctrl+C in OpenCode terminal, then `bun run dev`
   ```

3. **Test** - Next Metabob tool call spawns fresh MCP server

## Implementation Plan

1. **Immediate** (5 minutes):
   - Create `dev-reload.sh` script
   - Add to `.opencode/opencode.json`: `METABOB_DEV_MODE=1`
   - Create `reload-cli` alias

2. **Short-term** (30 minutes):
   - Implement cache TTL in `ActivityManager` when `METABOB_DEV_MODE=1`
   - Add file watching for template changes
   - Log cache hits/misses in dev mode

3. **Long-term** (Future PR):
   - Hot reload support in MCP protocol
   - Dev dashboard showing MCP server status
   - Auto-restart on file changes

## Testing the Solution

```bash
# 1. Make a change to ActivityManager
echo "# Test change" >> repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py

# 2. Reload
reload-cli

# 3. Trigger MCP call in OpenCode
# (Run any activity or metabob tool)

# 4. Verify new code is loaded
# (Check logs or add print statement to confirm)
```

## Advantages

✅ **Fast feedback loop** - Changes active in < 5 seconds  
✅ **No full OpenCode restart** - Keep your session state  
✅ **Cache management** - Dev mode auto-invalidates stale cache  
✅ **Clear workflow** - Single command to reload  
✅ **Backward compatible** - Production uses stable installed version  

## Files to Create

1. `repos/metabob-cli/scripts/dev-reload.sh`
2. `repos/metabob-cli/scripts/dev-wrapper.sh` (optional)
3. Update `.opencode/opencode.json` with dev config
4. Add dev mode detection to `ActivityManager`

Ready to implement?
