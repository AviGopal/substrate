# Metabob CLI Subprocess Configuration Architecture

**Date**: Feb 15, 2026  
**Purpose**: Enable parent processes (metabob-opencode, agents) to configure metabob-cli behavior when running as MCP subprocess

---

## Architecture Transformation

### Old Architecture (Polling/Bootstrap)
```
┌─────────────────┐
│ metabob-cli     │ ──┐
│  - Bootstrap    │   │ Continuously polls
│  - File watcher │   │ and submits files
│  - Job queue    │   ▼
└─────────────────┘  ┌──────────────────┐
                     │ metabob-rpc-api  │
┌─────────────────┐  │  - Celery tasks  │
│ metabob-opencode│◄─┤  - Job queue     │
│  - MCP client   │  └──────────────────┘
└─────────────────┘
```

**Problems**:
- Metabob-cli bootstraps independently, unaware of parent context
- Submits all files to backend, overwhelming job queue
- No coordination between CLI and parent process
- Parent has no control over CLI behavior

---

### New Architecture (Push/Activity-Based)
```
┌─────────────────────────────────┐
│ metabob-rpc-api                 │
│  - Activity orchestrator        │
│  - Policy engine                │
│  - Task distribution            │
└────────────┬────────────────────┘
             │
             │ Push tasks via activities/impulses
             ▼
┌─────────────────────────────────┐
│ metabob-opencode (parent)       │
│  - Receives tasks from backend  │
│  - Configures metabob-cli       │
│  - Manages subprocess lifecycle │
└────────────┬────────────────────┘
             │
             │ MCP + configuration
             ▼
┌─────────────────────────────────┐
│ metabob-cli (subprocess)        │
│  - Accepts parent configuration │
│  - No bootstrap (unless told)   │
│  - Provides tools on-demand     │
│  - Minimal file submission      │
└─────────────────────────────────┘
```

**Benefits**:
- Backend orchestrates work through activities
- Parent controls CLI behavior via configuration
- CLI is passive tool provider, not active agent
- Coordinated analysis based on actual work context

---

## Configuration API Design

### 1. MCP Extension: `configure` Tool

Add new MCP tool to metabob-cli:

```typescript
{
  name: "configure",
  description: "Configure metabob-cli behavior from parent process",
  inputSchema: {
    type: "object",
    properties: {
      bootstrap: {
        type: "object",
        properties: {
          enabled: { type: "boolean", default: false },
          batch_size: { type: "number", default: 5 },
          max_files: { type: "number", default: 100 }
        }
      },
      file_submission: {
        type: "object",
        properties: {
          auto_submit: { type: "boolean", default: false },
          submit_on_tool_call: { type: "boolean", default: true },
          max_concurrent: { type: "number", default: 1 }
        }
      },
      cpg: {
        type: "object",
        properties: {
          auto_build: { type: "boolean", default: true },
          incremental: { type: "boolean", default: true },
          watch_files: { type: "boolean", default: false }
        }
      },
      tools: {
        type: "object",
        properties: {
          timeout_ms: { type: "number", default: 5000 },
          cache_results: { type: "boolean", default: true }
        }
      }
    }
  }
}
```

**Usage from parent**:
```typescript
// On MCP subprocess startup, configure it
await metabobClient.callTool({
  name: "configure",
  arguments: {
    bootstrap: { enabled: false }, // Disable bootstrap!
    file_submission: { auto_submit: false }, // Don't submit files automatically
    cpg: { auto_build: true, watch_files: false }, // Build CPG on-demand
    tools: { timeout_ms: 5000, cache_results: true }
  }
})
```

---

### 2. Environment Variable Override

Allow parent to configure via environment variables when spawning subprocess:

```typescript
// In metabob-opencode, when spawning metabob-cli
const mcpProcess = spawn("metabob-cli", ["mcp", "--transport", "stdio"], {
  env: {
    ...process.env,
    METABOB_BOOTSTRAP_ENABLED: "false",
    METABOB_AUTO_SUBMIT: "false",
    METABOB_CPG_AUTO_BUILD: "true",
    METABOB_PARENT_PROCESS: "metabob-opencode",
    METABOB_WORKING_DIR: projectRoot
  }
})
```

**Priority order**:
1. `configure` tool call (highest priority)
2. Environment variables
3. Config file (`.metabob/config.json`)
4. Defaults

---

### 3. Configuration State Management

In metabob-cli, maintain configuration state:

```typescript
// src/config/runtime-config.ts
export class RuntimeConfig {
  private static instance: RuntimeConfig
  private config: Config
  private overrides: Partial<Config> = {}

  static getInstance(): RuntimeConfig {
    if (!this.instance) {
      this.instance = new RuntimeConfig()
    }
    return this.instance
  }

  // Load from file + env vars
  private constructor() {
    this.config = this.loadFromFile()
    this.applyEnvironmentOverrides()
  }

  // Apply configuration from parent via MCP tool
  applyParentConfig(overrides: Partial<Config>): void {
    this.overrides = { ...this.overrides, ...overrides }
    log.info("Applied parent configuration", { overrides })
  }

  // Get effective config (file < env < parent)
  get(key: string): any {
    // Priority: overrides > env > file > defaults
    return this.overrides[key] 
      ?? this.getEnvOverride(key)
      ?? this.config[key]
      ?? DEFAULTS[key]
  }

  // Check if running as subprocess
  isSubprocess(): boolean {
    return !!process.env.METABOB_PARENT_PROCESS
  }
}
```

---

## Implementation Changes

### In metabob-cli

#### 1. Add `configure` MCP Tool

**File**: `src/mcp/tools/configure.ts`
```typescript
import { RuntimeConfig } from "../../config/runtime-config"

export const configureTool = {
  name: "configure",
  description: "Configure metabob-cli behavior from parent process",
  inputSchema: { /* schema above */ },

  handler: async (args: any) => {
    const config = RuntimeConfig.getInstance()
    config.applyParentConfig(args)

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          applied_config: args,
          effective_config: config.getAll()
        })
      }]
    }
  }
}
```

Register in `src/mcp/server.ts`:
```typescript
import { configureTool } from "./tools/configure"

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    configureTool,
    searchCodebaseIssuesTool,
    listFileComponentsTool,
    // ... other tools
  ]
}))
```

#### 2. Disable Bootstrap When Configured

**File**: `src/bootstrap/bootstrap-manager.ts`
```typescript
import { RuntimeConfig } from "../config/runtime-config"

export class BootstrapManager {
  async start() {
    const config = RuntimeConfig.getInstance()
    
    // Don't bootstrap if disabled by parent
    if (!config.get("bootstrap.enabled")) {
      log.info("Bootstrap disabled by parent configuration")
      return
    }

    // If running as subprocess, use minimal bootstrap
    if (config.isSubprocess()) {
      log.info("Running as subprocess, using minimal bootstrap")
      await this.minimalBootstrap()
      return
    }

    // Normal bootstrap
    await this.fullBootstrap()
  }

  private async minimalBootstrap() {
    // Only build local CPG, don't submit to backend
    await this.cpgBuilder.build({ incremental: true })
    log.info("Minimal bootstrap complete (CPG only)")
  }
}
```

#### 3. Conditional File Submission

**File**: `src/file-watcher/submission-manager.ts`
```typescript
import { RuntimeConfig } from "../config/runtime-config"

export class SubmissionManager {
  async submitFile(filePath: string) {
    const config = RuntimeConfig.getInstance()

    // Don't auto-submit if disabled
    if (!config.get("file_submission.auto_submit")) {
      log.debug("Auto-submit disabled, skipping", { filePath })
      return
    }

    // Check concurrent limit
    const maxConcurrent = config.get("file_submission.max_concurrent")
    if (this.activeSubmissions.size >= maxConcurrent) {
      log.debug("Max concurrent submissions reached", { maxConcurrent })
      return
    }

    // Submit
    await this.doSubmit(filePath)
  }

  async submitOnDemand(filePath: string) {
    // Always submit when explicitly requested by tool call
    await this.doSubmit(filePath)
  }
}
```

---

### In metabob-opencode

#### 1. Configure Subprocess on Startup

**File**: `packages/opencode/src/mcp/metabob-client.ts`
```typescript
export class MetabobMCPClient {
  private configured = false

  async initialize() {
    await this.connect()
    await this.configureSubprocess()
  }

  private async configureSubprocess() {
    if (this.configured) return

    log.info("Configuring metabob-cli subprocess...")

    try {
      const result = await this.callTool({
        name: "configure",
        arguments: {
          bootstrap: { 
            enabled: false  // Disable bootstrap entirely
          },
          file_submission: { 
            auto_submit: false,  // Only submit on tool call
            submit_on_tool_call: true,
            max_concurrent: 1
          },
          cpg: { 
            auto_build: true,  // Build CPG incrementally
            incremental: true,
            watch_files: false  // Don't watch, we'll trigger updates
          },
          tools: { 
            timeout_ms: 5000,
            cache_results: true
          }
        }
      })

      this.configured = true
      log.info("Metabob-cli configured successfully", { result })

    } catch (error) {
      log.warn("Failed to configure metabob-cli, continuing anyway", { error })
      // Non-fatal: continue even if configuration fails
    }
  }
}
```

#### 2. Pass Environment Variables

**File**: `packages/opencode/src/mcp/spawn-metabob.ts`
```typescript
import { spawn } from "child_process"
import { projectRoot } from "../config"

export function spawnMetabobCli() {
  const process = spawn(
    "metabob-cli", 
    ["mcp", "--transport", "stdio"],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        METABOB_BOOTSTRAP_ENABLED: "false",
        METABOB_AUTO_SUBMIT: "false",
        METABOB_CPG_AUTO_BUILD: "true",
        METABOB_PARENT_PROCESS: "metabob-opencode",
        METABOB_WORKING_DIR: projectRoot,
        METABOB_LOG_LEVEL: "info"
      }
    }
  )

  return process
}
```

---

## Migration Path

### Phase 1: Add Configuration API (Week 1)
1. ✅ Reset metabob-cli state
2. ⏳ Implement `RuntimeConfig` class
3. ⏳ Add `configure` MCP tool
4. ⏳ Add environment variable support
5. ⏳ Test configuration priority order

### Phase 2: Disable Bootstrap (Week 1)
1. ⏳ Make bootstrap conditional on config
2. ⏳ Implement minimal bootstrap mode
3. ⏳ Disable auto file submission
4. ⏳ Test CLI with bootstrap disabled

### Phase 3: Parent Configuration (Week 2)
1. ⏳ Update metabob-opencode to configure subprocess
2. ⏳ Pass environment variables on spawn
3. ⏳ Call `configure` tool on initialization
4. ⏳ Test full integration

### Phase 4: Backend Task Push (Week 3-4)
1. ⏳ Design activity-based task distribution
2. ⏳ Implement task receiver in metabob-opencode
3. ⏳ Remove celery task submission
4. ⏳ Implement policy-guided analysis

---

## Configuration Examples

### Example 1: Activity Mode (Default)
```typescript
// metabob-opencode spawns metabob-cli for activity execution
configure({
  bootstrap: { enabled: false },
  file_submission: { auto_submit: false },
  cpg: { auto_build: true, incremental: true }
})

// Later, when activity needs analysis:
await metabobClient.callTool({
  name: "list_file_components",
  arguments: { file_path: "src/feature.ts" }
})
// CLI submits this file on-demand, returns cached CPG data
```

### Example 2: Interactive Mode
```typescript
// User running metabob-cli directly for exploration
// No parent process, so bootstrap is enabled
configure({
  bootstrap: { enabled: true, batch_size: 10 },
  file_submission: { auto_submit: true },
  cpg: { auto_build: true, watch_files: true }
})
```

### Example 3: Testing Mode
```typescript
// Agent running tests, needs fresh CPG
configure({
  bootstrap: { enabled: false },
  file_submission: { auto_submit: false },
  cpg: { auto_build: true, incremental: false }, // Full rebuild
  tools: { timeout_ms: 10000, cache_results: false }
})
```

---

## Success Criteria

- ✅ Metabob-cli can be configured via MCP `configure` tool
- ✅ Environment variables override config file
- ✅ Bootstrap can be disabled entirely
- ✅ File submission only happens on-demand
- ✅ Metabob-opencode configures subprocess on startup
- ✅ No more bootstrap loops in subprocess mode
- ✅ Tools return results in <5 seconds
- ✅ CPU usage <5% when idle

---

## Testing Checklist

- [ ] `configure` tool returns success
- [ ] Bootstrap disabled when `bootstrap.enabled: false`
- [ ] Files not auto-submitted when `auto_submit: false`
- [ ] CPG builds on-demand when tool called
- [ ] Metabob-opencode successfully configures subprocess
- [ ] Multiple configuration sources work (env + tool call)
- [ ] Configuration persists across tool calls
- [ ] Tools work normally after configuration

---

## Files to Modify

### metabob-cli
- `src/config/runtime-config.ts` (NEW)
- `src/mcp/tools/configure.ts` (NEW)
- `src/mcp/server.ts` (register tool)
- `src/bootstrap/bootstrap-manager.ts` (conditional bootstrap)
- `src/file-watcher/submission-manager.ts` (conditional submission)

### metabob-opencode
- `packages/opencode/src/mcp/metabob-client.ts` (configure on init)
- `packages/opencode/src/mcp/spawn-metabob.ts` (env vars)

---

## Related Documents

- `METABOB_TOOL_HANG_DIAGNOSIS.md` - Root cause analysis
- `ACTIVITY_SYSTEM_OPERATIONAL_FEB15.md` - Activity system overview
- `ARCHITECTURE_ALIGNMENT_PLAN.md` - Architecture principles
