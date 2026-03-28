# Trace Analysis: Enable Hot-Reload for MCP Clients in Development Mode

**Specification ID**: Enable Hot-Reload for MCP Clients in Development Mode  
**Analysis Date**: 2026-03-09  
**Impulse ID**: trace-mcp-hot-reload  

## Executive Summary

**Problem**: MCP clients are initialized once at startup via `Instance.state()` and never reconnected. When developing metabob-cli as an MCP vessel, code changes cannot be tested without restarting the entire opencode session.

**Root Cause**: Config reload infrastructure exists (`config/reload.ts`) but only disposes state without explicitly reloading MCP clients. MCP module has no reload/reconnect functionality.

**Solution**: Add `MCP.reload()` function to close and re-initialize clients, integrate with config reload system, and provide CLI command for manual reload.

---

## Component Analysis

### 1. MCP Module State Management
**File**: `repos/metabob-opencode/packages/opencode/src/mcp/index.ts:153-188`

**Current Behavior**:
```typescript
const state = Instance.state(
  async () => {
    const cfg = await Config.get()
    const config = cfg.mcp ?? {}
    const clients: Record<string, MCPClient> = {}
    const status: Record<string, Status> = {}
    
    await Promise.all(
      Object.entries(config).map(async ([key, mcp]) => {
        const result = await create(key, mcp).catch(() => undefined)
        if (!result) return
        
        status[key] = result.status
        if (result.mcpClient) {
          clients[key] = result.mcpClient
        }
      }),
    )
    return { status, clients }
  },
  async (state) => {
    await Promise.all(
      Object.values(state.clients).map((client) =>
        client.close().catch((error) => {
          log.error("Failed to close MCP client", { error })
        }),
      ),
    )
  },
)
```

- Clients initialized lazily on first `state()` call
- Cached by `Instance.state()` mechanism
- Only disposed when `Instance.dispose()` is called
- No reload/reconnect functionality

**Desired Behavior**:
- Add `MCP.reload()` export function
- Function should:
  1. Get current state via `await state()`
  2. Close all existing clients gracefully
  3. Re-read config via `Config.get()`
  4. Re-initialize clients using existing `create()` function
  5. Update state with new clients
  6. Return status per client

**Gap**: No reload function exists

---

### 2. MCP.create() Function
**File**: `repos/metabob-opencode/packages/opencode/src/mcp/index.ts:217-357`

**Current Behavior**:
- Handles both local (stdio) and remote (HTTP/SSE) MCP clients
- Connects transport with timeout
- Lists tools to verify connection
- Returns `{ mcpClient, status }` tuple
- Gracefully handles connection failures

**Desired Behavior**: No changes needed - already reusable

**Gap**: None

---

### 3. MCP Client Disposal
**File**: `repos/metabob-opencode/packages/opencode/src/mcp/index.ts:177-187`

**Current Behavior**:
- Disposal callback in `Instance.state()` closes all clients
- Triggered by `Instance.dispose()` (full state reset)

**Desired Behavior**:
- `MCP.reload()` should have selective disposal
- Close only MCP clients without disposing entire Instance state
- Preserve other cached state (config, tools, etc.)

**Gap**: Need selective disposal logic in reload function

---

### 4. Config Reload Orchestration
**File**: `repos/metabob-opencode/packages/opencode/src/config/reload.ts:63-95`

**Current Behavior**:
```typescript
export async function reload(options: ReloadOptions = {}): Promise<ReloadResult> {
  const { force = false, deferIfUnsafe = true } = options
  
  const isSafe = await canReloadSafely()
  
  if (!isSafe && !force) {
    if (deferIfUnsafe) {
      await deferReload()
      return {
        reloaded: false,
        deferred: true,
        reason: "Config reload deferred to next session (active operations detected)",
      }
    } else {
      return {
        reloaded: false,
        deferred: false,
        reason: "Config reload skipped (unsafe and defer disabled)",
      }
    }
  }
  
  // Reload is safe (or forced) - invalidate cache
  await Instance.dispose()
  
  return {
    reloaded: true,
    deferred: false,
    reason: "Config reloaded successfully",
  }
}
```

- Checks safety via `canReloadSafely()`
- Calls `Instance.dispose()` to clear all cached state
- MCP clients disposed but not re-initialized until next access

**Desired Behavior**:
- After `Instance.dispose()`, explicitly call `MCP.reload()`
- Ensure MCP clients re-initialized immediately (not lazily)

**Gap**: Missing `await MCP.reload()` after line 88

---

### 5. Safety Checks
**File**: `repos/metabob-opencode/packages/opencode/src/config/reload.ts:33-52`

**Current Behavior**:
```typescript
export async function canReloadSafely(): Promise<boolean> {
  // TODO: Implement actual safety checks
  // For now, assume it's safe if we're not in a critical section
  
  // Check 1: No active MCP operations
  // Check 2: No running activities
  // Check 3: No open sub-sessions
  
  // Conservative default: always safe in current implementation
  return true
}
```

- Always returns `true`
- No actual safety checks implemented

**Desired Behavior**:
- Check: No active MCP tool calls in progress
- Check: No running activities using MCP tools
- Check: No open sub-sessions with MCP context
- For MVP: existing behavior acceptable (manual reload only)

**Gap**: Safety checks not implemented (not blocking for MVP)

---

### 6. MCP Impact Detection
**File**: `repos/metabob-opencode/packages/opencode/src/config/impact-analysis.ts:84-96`

**Current Behavior**:
- `analyzeKeyModification()` detects MCP config changes
- Adds warnings about server restarts
- Identifies which MCP servers affected

**Desired Behavior**: No changes needed

**Gap**: None - already functional

---

### 7. MCP CLI Commands
**File**: `repos/metabob-opencode/packages/opencode/src/cli/cmd/mcp.ts:7-80`

**Current Behavior**:
```typescript
export const McpCommand = cmd({
  command: "mcp",
  builder: (yargs) => yargs.command(McpAddCommand).demandCommand(),
  async handler() {},
})

export const McpAddCommand = cmd({
  command: "add",
  describe: "add an MCP server",
  async handler() {
    // Interactive MCP server configuration
  },
})
```

- Only has `mcp add` command
- No reload command

**Desired Behavior**:
- Add `McpReloadCommand`:
  1. Check if reload is safe
  2. Call `MCP.reload()`
  3. Report success/failure per client
  4. Show updated client status

**Gap**: No `mcp reload` command

---

### 8. MCP Health Check Tool
**File**: `repos/metabob-opencode/packages/opencode/src/tool/test-metabob-mcp.ts:20-230`

**Current Behavior**:
- Tests Metabob MCP connectivity
- Lists available tools
- Tests `search_activities` functionality
- Good for verifying reload worked

**Desired Behavior**: No changes needed (sufficient for testing)

**Gap**: No generic health check for all clients (not critical)

---

### 9. Config State Management
**File**: `repos/metabob-opencode/packages/opencode/src/config/config.ts`

**Current Behavior**:
- Lines 32-100: `state = Instance.state(async () => {...})` loads config once
- Line 1227: `Config.get()` returns cached state
- `Config.update()` writes file and calls `Instance.dispose()`

**Desired Behavior**: No changes needed

**Gap**: None

---

## Data Flow Analysis

### Current Flow
```
User edits opencode.json
  → Instance.state() cache remains stale
  → MCP clients use old config
  → Requires full opencode restart to pick up changes
```

### Desired Flow (Manual Reload)
```
User edits opencode.json
  → User runs: opencode mcp reload
  → canReloadSafely() check passes
  → MCP.reload():
      1. Get current state
      2. Close old clients
      3. Config.get() re-reads opencode.json
      4. create() initializes new clients
      5. Update state
  → Return status report
  → New MCP tools/behavior active
```

### Desired Flow (Automatic Reload)
```
User edits opencode.json
  → config/reload.ts detects change
  → canReloadSafely() check
  → Instance.dispose() clears all state
  → MCP.reload() re-initializes clients
  → New clients ready
```

### Key Functions
1. **MCP.reload()** - NEW function to add
2. **MCP.create()** - Reusable client initialization
3. **Config.get()** - Re-reads config
4. **Instance.dispose()** - Clears all cached state
5. **canReloadSafely()** - Safety checks (currently stub)

---

## Implementation Plan

### Step 1: Add MCP.reload() Function
**File**: `repos/metabob-opencode/packages/opencode/src/mcp/index.ts`  
**Complexity**: Medium

Add export function after existing exports (~line 471):

```typescript
export async function reload(): Promise<{
  success: boolean
  clients: Record<string, Status>
  errors: string[]
}> {
  log.info("reloading mcp clients")
  
  const errors: string[] = []
  
  try {
    // Step 1: Get current state
    const s = await state()
    
    // Step 2: Close all existing clients
    await Promise.all(
      Object.entries(s.clients).map(async ([name, client]) => {
        try {
          await client.close()
          log.info("closed mcp client", { name })
        } catch (error) {
          const msg = `Failed to close client '${name}': ${error instanceof Error ? error.message : String(error)}`
          errors.push(msg)
          log.error("failed to close mcp client", { name, error })
        }
      })
    )
    
    // Step 3: Clear current state
    s.clients = {}
    s.status = {}
    
    // Step 4: Re-read config
    const cfg = await Config.get()
    const config = cfg.mcp ?? {}
    
    // Step 5: Re-initialize clients
    await Promise.all(
      Object.entries(config).map(async ([key, mcp]) => {
        try {
          const result = await create(key, mcp)
          if (!result) {
            const msg = `Failed to create client '${key}': unknown error`
            errors.push(msg)
            return
          }
          
          s.status[key] = result.status
          
          if (result.mcpClient) {
            s.clients[key] = result.mcpClient
            log.info("reloaded mcp client", { key, status: result.status.status })
          } else {
            log.warn("mcp client not available after reload", { key, status: result.status })
          }
        } catch (error) {
          const msg = `Failed to reload client '${key}': ${error instanceof Error ? error.message : String(error)}`
          errors.push(msg)
          log.error("failed to reload mcp client", { key, error })
        }
      })
    )
    
    log.info("mcp reload complete", { 
      clientCount: Object.keys(s.clients).length,
      errorCount: errors.length 
    })
    
    return {
      success: errors.length === 0,
      clients: s.status,
      errors,
    }
  } catch (error) {
    const msg = `MCP reload failed: ${error instanceof Error ? error.message : String(error)}`
    errors.push(msg)
    log.error("mcp reload failed", { error })
    
    return {
      success: false,
      clients: {},
      errors,
    }
  }
}
```

---

### Step 2: Update Config Reload
**File**: `repos/metabob-opencode/packages/opencode/src/config/reload.ts`  
**Complexity**: Low

Add import at top:
```typescript
import { MCP } from "../mcp"
```

Update `reload()` function after `Instance.dispose()` (line 88):
```typescript
// Reload is safe (or forced) - invalidate cache
await Instance.dispose()

// Explicitly reload MCP clients
try {
  const mcpResult = await MCP.reload()
  if (!mcpResult.success) {
    log.warn("MCP reload had errors", { errors: mcpResult.errors })
  } else {
    log.info("MCP clients reloaded successfully")
  }
} catch (error) {
  log.error("Failed to reload MCP clients", { error })
}

return {
  reloaded: true,
  deferred: false,
  reason: "Config reloaded successfully",
}
```

---

### Step 3: Add CLI Command
**File**: `repos/metabob-opencode/packages/opencode/src/cli/cmd/mcp.ts`  
**Complexity**: Low

Add import:
```typescript
import { MCP } from "../../mcp"
```

Update `McpCommand` builder:
```typescript
export const McpCommand = cmd({
  command: "mcp",
  builder: (yargs) => 
    yargs
      .command(McpAddCommand)
      .command(McpReloadCommand)
      .demandCommand(),
  async handler() {},
})
```

Add new command:
```typescript
export const McpReloadCommand = cmd({
  command: "reload",
  describe: "reload MCP client connections",
  async handler() {
    UI.empty()
    prompts.intro("Reload MCP Clients")
    
    const spinner = prompts.spinner()
    spinner.start("Reloading MCP clients...")
    
    try {
      const result = await MCP.reload()
      
      spinner.stop("MCP reload complete")
      
      if (result.success) {
        prompts.log.success("All MCP clients reloaded successfully")
      } else {
        prompts.log.warn(`MCP reload completed with ${result.errors.length} error(s)`)
      }
      
      // Display status per client
      prompts.log.info("\nClient Status:")
      for (const [name, status] of Object.entries(result.clients)) {
        const statusEmoji = status.status === "connected" ? "✓" : "✗"
        const statusText = status.status === "connected" 
          ? "Connected" 
          : status.status === "failed" 
          ? `Failed: ${status.error}`
          : "Disabled"
        prompts.log.info(`  ${statusEmoji} ${name}: ${statusText}`)
      }
      
      // Display errors if any
      if (result.errors.length > 0) {
        prompts.log.warn("\nErrors:")
        for (const error of result.errors) {
          prompts.log.warn(`  - ${error}`)
        }
      }
      
      prompts.outro(result.success ? "✓ Reload successful" : "⚠ Reload completed with errors")
    } catch (error) {
      spinner.stop("MCP reload failed")
      prompts.log.error(`Failed to reload MCP clients: ${error instanceof Error ? error.message : String(error)}`)
      prompts.outro("✗ Reload failed")
    }
  },
})
```

---

### Step 4: Test Reload Functionality
**Complexity**: Low

Test Scenario:
1. Start metabob-opencode with metabob-cli as MCP vessel
2. Modify metabob-cli code (e.g., add logging to `search_activities` tool)
3. Restart metabob-cli vessel (to pick up code changes)
4. Run `opencode mcp reload` command
5. Verify new logging appears when calling `metabob_search_activities`
6. Verify `test_metabob_mcp` tool shows updated state

Verification Commands:
```bash
# In opencode session
opencode mcp reload

# Test connectivity
test_metabob_mcp

# Test actual tool (should show new behavior)
search_activities { "query": "", "limit": 5 }
```

---

## Critical Insights

### Instance.state() Pattern
- Provides per-instance caching with lazy initialization
- Dispose callback runs when `Instance.dispose()` called
- State keyed by instance directory
- Not a simple variable - requires understanding State pattern

### Disposal vs Reload
- `Instance.dispose()` clears ALL state (config, MCP, tools, etc.)
- `MCP.reload()` should be selective - only MCP clients
- Need to directly manipulate state object, not call dispose

### Circuit Breaker State
- Lines 70: Circuit breaker tracks tool failures
- Lives outside Instance.state() - shared across all instances
- Consider: Should circuit breaker state be reset on reload?
- Decision: Preserve circuit breaker state (failures still relevant)

### Create Function Reusability
- Lines 217-357: `create()` already well-structured
- Handles both local and remote transports
- Graceful error handling
- Can be directly reused in reload without modification

---

## Success Criteria

### Functional Requirements
- [ ] `MCP.reload()` function exists and works
- [ ] `opencode mcp reload` CLI command exists
- [ ] Config reload automatically triggers MCP reload
- [ ] Reload closes old connections gracefully
- [ ] Reload re-initializes clients with new config
- [ ] Reload returns detailed status per client
- [ ] Logging at each reload step

### Test Requirements
- [ ] Change metabob-cli code
- [ ] Restart metabob-cli vessel
- [ ] Run reload in opencode
- [ ] Verify new code behavior active
- [ ] Verify no crashes or connection leaks
- [ ] Verify test_metabob_mcp shows updated state

### Non-Functional Requirements
- [ ] Reload completes in <5 seconds
- [ ] No memory leaks from old connections
- [ ] Graceful handling of reload failures
- [ ] Existing clients remain functional if reload fails
- [ ] Clear error messages on failure

---

## Risks & Mitigations

### Risk: State Manipulation Complexity
**Impact**: High  
**Probability**: Medium  
**Mitigation**: Follow Instance.state() pattern carefully. Test thoroughly.

### Risk: Connection Leaks
**Impact**: High  
**Probability**: Low  
**Mitigation**: Ensure all clients closed before re-initialization. Add timeout.

### Risk: Breaking Active Operations
**Impact**: High  
**Probability**: Medium  
**Mitigation**: For MVP, only support manual reload (user controls timing). Future: implement safety checks.

### Risk: Circuit Breaker Reset
**Impact**: Low  
**Probability**: Low  
**Mitigation**: Preserve circuit breaker state across reload (correct behavior).

---

## Related Files

- `repos/metabob-opencode/packages/opencode/src/mcp/index.ts` - MCP module
- `repos/metabob-opencode/packages/opencode/src/config/reload.ts` - Config reload
- `repos/metabob-opencode/packages/opencode/src/config/config.ts` - Config management
- `repos/metabob-opencode/packages/opencode/src/project/instance.ts` - Instance state
- `repos/metabob-opencode/packages/opencode/src/cli/cmd/mcp.ts` - MCP CLI commands
- `repos/metabob-opencode/packages/opencode/src/tool/test-metabob-mcp.ts` - Health check

---

## Impulse Reference

**Impulse ID**: trace-mcp-hot-reload  
**Location**: `/impulses/trace-mcp-hot-reload.json`  
**Budget**: 5000 tokens  
**Type**: templateDefinition  

This impulse contains the complete trace analysis and can be used by downstream validation and enforcement tasks.

