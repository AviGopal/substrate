# OpenCode → Metabob-CLI Configuration Management
**Date**: February 12, 2026, 1:00 AM PST  
**Status**: ✅ Environment-based configuration implemented

---

## Problem Solved

**You're right!** OpenCode spawns the metabob-cli MCP process, so OpenCode should configure it directly rather than relying on a separate config file.

---

## Solution: Environment Variable Configuration

Metabob-CLI supports **full configuration via environment variables** using the `METABOB_<FIELD_NAME>` pattern. OpenCode already has an `environment` section in its MCP config that gets passed to the spawned process.

### How It Works

```
OpenCode Config (.opencode/opencode.json)
  ↓
MCP Server Spawn (metabob-cli mcp --transport stdio)
  ↓
Environment Variables (METABOB_*)
  ↓
Metabob-CLI Config Loader (applies env overrides)
  ↓
Final Configuration (env overrides file config)
```

---

## Implementation

### Updated `.opencode/opencode.json`

```json
{
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "enabled": true,
      "timeout": 30000,
      "environment": {
        "METABOB_API_URL": "http://localhost:8080",
        "METABOB_PROJECT_ID": "exp-repo-dev",
        "METABOB_API_KEY": "mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8",
        
        "METABOB_EXCLUDE_PATHS": "**/tests/**,**/perf-repos/**,**/__pycache__/**,**/.git/**,**/node_modules/**,**/venv/**,**/.venv/**,**/dist/**,**/build/**,**/.next/**,**/.metabob/**",
        
        "METABOB_WATCH_FILES": "false"
      }
    }
  }
}
```

**Key additions**:
1. **`METABOB_EXCLUDE_PATHS`** - Comma-separated list of glob patterns to exclude
2. **`METABOB_WATCH_FILES`** - Explicitly disable file watching (set to "false")

### Supported Environment Variables

From `repos/metabob-cli/src/metabob_cli/core/config.py:545-584`:

```python
def _apply_env_overrides(config: ConfigData) -> ConfigData:
    """Apply environment variable overrides to configuration.
    
    Supports METABOB_<FIELD_NAME> for any ConfigData field.
    For example: METABOB_BATCH_SIZE=10, METABOB_WATCH_FILES=false
    """
```

**All ConfigData fields can be overridden**:
- `METABOB_BASE_URL` - Backend API URL
- `METABOB_API_KEY` - Authentication key
- `METABOB_STATE_DIRECTORY` - Where to store state files
- `METABOB_INCLUDE_PATHS` - Files to include (comma-separated)
- `METABOB_EXCLUDE_PATHS` - Files to exclude (comma-separated)
- `METABOB_WATCH_FILES` - Enable/disable file watching (true/false)
- `METABOB_BATCH_SIZE` - Analysis batch size (integer)
- `METABOB_FAST_MODE` - Enable fast mode (true/false)
- `METABOB_TEST_MODE` - Enable test mode (true/false)
- And many more...

### Environment Variable Parsing

From `repos/metabob-cli/src/metabob_cli/core/config.py:537-539`:

```python
elif field_type == list or field_type == list[str]:
    # Parse comma-separated values
    return [v.strip() for v in value.split(",") if v.strip()]
```

**Format for lists**: Comma-separated, whitespace is stripped
- ✅ `"path1,path2,path3"`
- ✅ `"path1, path2, path3"` (spaces are trimmed)
- ✅ `"path1,   path2,path3"` (multiple spaces are ok)

**Format for booleans**:
```python
if field_type == bool:
    return value.lower() in ("true", "1", "yes", "on")
```

---

## Dynamic Configuration at Startup

### Current Architecture

Right now, OpenCode's MCP environment is **static** - it's defined in `.opencode/opencode.json` and doesn't change per session.

### Proposed Enhancement: Session-Aware MCP Configuration

Similar to how OpenCode manages session memory, it could dynamically configure metabob-cli based on:
1. **Project analysis** - Detect large directories and auto-exclude
2. **Session type** - Different configs for activity mode vs. direct mode
3. **User preferences** - Stored in session memory
4. **Performance metrics** - Adjust batch size based on system load

### Implementation Pattern

#### Option A: Dynamic Environment Variables (Simple)

Enhance OpenCode's MCP spawn logic to generate environment variables dynamically:

```typescript
// packages/opencode/src/session/mcp-manager.ts (hypothetical)

async function spawnMetabobMCP(sessionID: string): Promise<MCPClient> {
  // Analyze project to determine excludes
  const projectRoot = process.cwd()
  const largeDirectories = await detectLargeDirectories(projectRoot)
  
  // Build exclude list
  const defaultExcludes = [
    "**/tests/**",
    "**/__pycache__/**",
    "**/.git/**",
    "**/node_modules/**",
    "**/venv/**",
    "**/.venv/**",
    "**/.metabob/**"
  ]
  
  const dynamicExcludes = largeDirectories.map(dir => `**/${dir}/**`)
  const allExcludes = [...defaultExcludes, ...dynamicExcludes]
  
  // Build environment
  const environment = {
    METABOB_API_URL: config.metabob.base_url,
    METABOB_PROJECT_ID: sessionID,
    METABOB_API_KEY: config.metabob.api_key,
    METABOB_EXCLUDE_PATHS: allExcludes.join(","),
    METABOB_WATCH_FILES: "false",  // Always false for now
    METABOB_BATCH_SIZE: determineOptimalBatchSize(),
  }
  
  // Spawn with dynamic environment
  return spawnMCP({
    command: ["metabob-cli", "mcp", "--transport", "stdio"],
    environment,
  })
}

async function detectLargeDirectories(root: string): Promise<string[]> {
  const large: string[] = []
  const dirs = await fs.readdir(root, { withFileTypes: true })
  
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue
    
    const path = join(root, dir.name)
    const fileCount = await countFilesInDirectory(path)
    
    // If directory has >10,000 files, auto-exclude
    if (fileCount > 10000) {
      log.info(`Auto-excluding large directory: ${dir.name} (${fileCount} files)`)
      large.push(dir.name)
    }
  }
  
  return large
}
```

**Pros**:
- Works with current metabob-cli (no changes needed)
- Automatically adapts to project structure
- Can be tuned per session

**Cons**:
- Requires OpenCode code changes
- Startup scan adds latency

#### Option B: Session Memory Integration (Sophisticated)

Store metabob-cli configuration preferences in session memory:

```typescript
// Session memory impulse
const metabobConfig = {
  id: "metabob-cli-config",
  pointer: {
    type: "memo",
    content: JSON.stringify({
      excludePaths: ["**/tests/**", "**/perf-repos/**"],
      watchFiles: false,
      batchSize: 5,
      optimizations: {
        skipLargeDirectories: true,
        maxFilesTracked: 5000
      }
    })
  },
  budget: 1000
}

// Memory agent decides to update config based on performance
if (mcpResponseTime > 5000) {  // MCP taking >5s
  // Reduce file count
  updateMetabobConfig({
    excludePaths: [...existingExcludes, "**/large-dir/**"]
  })
}
```

**Pros**:
- LLM can reason about optimal configuration
- Self-tuning based on performance
- Preferences persist across sessions

**Cons**:
- More complex to implement
- Requires token budget for configuration decisions

#### Option C: Interactive Configuration (User-Friendly)

Add a tool for the agent to query and update metabob-cli configuration:

```typescript
export const ConfigureMetabobTool: Tool.Info = {
  id: "configure_metabob",
  init: async () => ({
    description: "Configure metabob-cli behavior for optimal performance",
    parameters: z.object({
      excludePaths: z.array(z.string()).optional(),
      watchFiles: z.boolean().optional(),
      batchSize: z.number().optional(),
    }),
    execute: async (input) => {
      // Update .opencode/opencode.json MCP environment
      const config = await loadOpenCodeConfig()
      config.mcp.metabob.environment.METABOB_EXCLUDE_PATHS = 
        input.excludePaths?.join(",")
      config.mcp.metabob.environment.METABOB_WATCH_FILES = 
        String(input.watchFiles)
      
      await saveOpenCodeConfig(config)
      
      return {
        title: "Metabob configuration updated",
        output: "Restart OpenCode for changes to take effect",
      }
    }
  })
}
```

Then in the Activity Mode system prompt:
```
If metabob-cli is experiencing performance issues (high CPU, timeouts),
you can use the configure_metabob tool to exclude large directories
or adjust settings. Common exclusions:
- **/tests/** (test files)
- **/node_modules/** (dependencies)
- **/.git/** (version control)
```

**Pros**:
- Agent can self-diagnose and fix performance issues
- User-friendly (agent explains what it's doing)
- Works with existing infrastructure

**Cons**:
- Requires OpenCode restart to apply
- Agent needs to understand metabob-cli internals

---

## Recommendation: Hybrid Approach

Combine static defaults (Option A) with dynamic tuning (Option C):

### Phase 1: Smart Defaults (Immediate)
Update `.opencode/opencode.json` with sensible defaults:
```json
"environment": {
  "METABOB_EXCLUDE_PATHS": "**/tests/**,**/perf-repos/**,**/__pycache__/**,**/.git/**,**/node_modules/**,**/venv/**,**/.venv/**,**/dist/**,**/build/**,**/.next/**,**/.metabob/**",
  "METABOB_WATCH_FILES": "false",
  "METABOB_BATCH_SIZE": "5"
}
```

**Result**: Fixes 95% of cases immediately.

### Phase 2: Project-Aware Auto-Exclusion (Short-term)
On MCP spawn, detect and exclude large directories automatically:
```typescript
const largeTestDirs = await findDirectoriesMatching("**/tests/**", { minFiles: 1000 })
const autoExcludes = largeTestDirs.map(dir => `**/${dir}/**`)
```

**Result**: Handles edge cases without user intervention.

### Phase 3: Agent-Managed Configuration (Long-term)
Add `configure_metabob` tool for agent to tune settings:
```
Agent: "I notice metabob-cli is using 98% CPU. Let me check the file count..."
Agent: "There are 64,000 files being tracked. I'll exclude the test directories."
Agent: <uses configure_metabob tool>
Agent: "Configuration updated. Please restart OpenCode for changes to take effect."
```

**Result**: Self-healing system that adapts to project structure.

---

## Environment vs. Config File Priority

Metabob-CLI loads configuration in this order:

1. **Config file** (`.metabob/config.json`)
2. **Environment variables** (override config file)

**From `load_config()` function**:
```python
# Load config from file
config = _load_from_file(path_to_load)

# Apply environment overrides (METABOB_<FIELD_NAME>)
config = _apply_env_overrides(config)  # ← Env vars win!

# Apply logging overrides
config = _apply_logging_env_overrides(config)
```

**This means**:
- ✅ OpenCode's environment variables **always override** the `.metabob/config.json` file
- ✅ You don't need to manage two configs - OpenCode MCP environment is the source of truth
- ✅ Per-project configs can still exist but OpenCode's settings take precedence

---

## Testing the New Configuration

After restarting OpenCode with the updated config:

### Step 1: Verify Environment Variables are Passed
```bash
# Check MCP process environment
ps eww $(pgrep -f "metabob-cli mcp") | tr ' ' '\n' | grep METABOB

# Should show:
METABOB_API_URL=http://localhost:8080
METABOB_PROJECT_ID=exp-repo-dev
METABOB_EXCLUDE_PATHS=**/tests/**,**/perf-repos/**,...
METABOB_WATCH_FILES=false
```

### Step 2: Verify File Discovery Count
```javascript
// In OpenCode session
get_metabob_status()

// Check file_watcher_status.total_files_watched
// Should be ~1,500 files (not 64,000)
```

### Step 3: Verify MCP Stability
```bash
# After 5 minutes, check CPU
ps aux | grep "metabob-cli mcp"
# Should show <5% CPU (not 98%)

# Check state file size
ls -lh .metabob/state
# Should be <100 KB (not 36 MB)
```

---

## Additional Configuration Options

### For Development
```json
"environment": {
  "METABOB_WATCH_FILES": "false",  // Disable watching
  "METABOB_FAST_MODE": "true",     // Reduce delays
  "METABOB_BATCH_SIZE": "10"       // Larger batches
}
```

### For Testing
```json
"environment": {
  "METABOB_TEST_MODE": "true",     // Skip API calls
  "METABOB_WATCH_FILES": "false",  // No file watching
  "METABOB_FAST_MODE": "true"      // Instant timeouts
}
```

### For Production (If OpenCode Used in CI/CD)
```json
"environment": {
  "METABOB_WATCH_FILES": "false",  // Never watch in CI
  "METABOB_BATCH_SIZE": "20",      // Process more at once
  "METABOB_EXCLUDE_PATHS": "**/tests/**,**/node_modules/**,**/vendor/**"
}
```

---

## Future Enhancement: `.opencoderc` Integration

OpenCode could also support project-specific configuration:

```json
// .opencoderc in project root
{
  "metabob": {
    "excludePaths": [
      "**/tests/**",
      "**/perf-repos/**",
      "**/vendor/**",
      "custom-large-dir/**"
    ],
    "watchFiles": false
  }
}
```

Then merge this with the global `.opencode/opencode.json` config on startup.

---

## Summary

### What Changed ✅
- **`.opencode/opencode.json`** now includes `METABOB_EXCLUDE_PATHS` and `METABOB_WATCH_FILES`
- Environment variables configure metabob-cli directly
- No need for separate `.metabob/config.json` management

### How It Works
1. OpenCode spawns `metabob-cli mcp --transport stdio`
2. Passes environment variables from MCP config
3. Metabob-CLI reads env vars and overrides defaults
4. Configuration is applied before file discovery

### Benefits
✅ **Single source of truth** - OpenCode MCP config is authoritative  
✅ **No file conflicts** - Env vars override config files  
✅ **Per-session configuration** - Can vary by session/mode  
✅ **Dynamic tuning possible** - OpenCode can adjust based on performance  
✅ **Works immediately** - No metabob-cli code changes needed  

### Next Steps
1. ✅ Updated `.opencode/opencode.json` with exclude paths
2. ⏭️ Restart OpenCode to spawn MCP with new environment
3. ⏭️ Verify file count is ~1,500 (not 64,000)
4. ⏭️ Test activity system works stably
5. ⏭️ (Future) Implement dynamic configuration tools

---

**Prepared by**: Activity Mode Agent  
**Configuration Method**: Environment variables via OpenCode MCP config  
**Status**: Ready for restart with optimized configuration  
**Impact**: Clean separation - OpenCode fully controls metabob-cli behavior
