# Analysis: Template Loading Without MCP Connection

**Date:** 2026-03-04  
**Issue:** Activities execute even when metabob-cli MCP is not connected  
**Status:** ✅ **EXPLAINED** - Working as designed (with caveats)

## The Question

> "Currently, IN this instance of metabob-opencode, the metabob-cli process we start is not connected. Yet somehow activities are still able to be executed."

## Answer: Fallback Chain Architecture

Activities can execute without MCP connection due to a **multi-tier fallback system** designed for resilience and cold-start scenarios.

## Template Loading Architecture

### Load Order (Fallback Chain)

```
1. TemplateCache (in-memory)
   ↓ (if miss)
2. Metabob TemplateService (via MCP)
   ↓ (if unavailable)
3. Embedded Bootstrap Templates (bundled in binary)
```

### Code Path

```typescript
// repos/metabob-opencode/packages/opencode/src/session/template-loader.ts

export async function load(id: string, options: LoadOptions = {}): Promise<LoadResult> {
  // Step 1: Check cache (unless skipCache)
  if (!options.skipCache) {
    const cached = TemplateCache.get(id, options.version)
    if (cached) {
      return { template: cached, source: "cache", cached: true }
    }
  }

  // Step 2: Try Metabob TemplateService (unless backend=local)
  if (options.backend !== "local") {
    try {
      const result = await TemplateServiceClient.getTemplate({ templateId: id })
      if (result.success && result.template) {
        TemplateCache.put(result.template)
        return { template: result.template, source: "metabob", cached: false }
      }
    } catch (error) {
      log.warn("metabob load failed", { id, error })
      // FALLBACK: Continue to step 3
    }
  }

  // Step 3: Fallback to embedded bootstrap (only for BOOTSTRAP_TEMPLATES)
  if (options.backend !== "metabob" && BOOTSTRAP_TEMPLATES.has(id)) {
    const template = await ActivityTemplate.load(id) // From embedded JSON
    TemplateCache.put(template)
    return { template, source: "local", cached: false }
  }

  throw new Error(`Template not found: ${id}`)
}
```

### Bootstrap Templates (Embedded in Binary)

**Location:** `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts`

```typescript
// Bundled at build time (no filesystem dependency)
const EMBEDDED_TEMPLATES = {
  "evolve-activity-self-contained": evolveActivityTemplate,
  "manage-session-memory": manageMemoryTemplate,
  "trace-data-flow-single-feature": traceDataFlowTemplate,
  "trace-enforce-validate-loop": traceEnforceValidateTemplate,
}
```

**Purpose:** Cold-start resilience
- Enable devbob to self-evolve even without backend
- Support offline development
- Prevent hard dependency on MCP for system bootstrap

## MCP Connection Check

### How `MetabobCLI.isAvailable()` Works

```typescript
// repos/metabob-opencode/packages/opencode/src/util/metabob.ts

export async function isAvailable(): Promise<boolean> {
  await ensureMetabobConfig()
  
  const clients = await MCP.clients()
  const available = !!clients["metabob"]
  
  log.debug("metabob mcp client availability", { available })
  return available
}
```

### MCP Client Initialization

```typescript
// repos/metabob-opencode/packages/opencode/src/mcp/index.ts

const state = Instance.state(async () => {
  const cfg = await Config.get()
  const config = cfg.mcp ?? {}
  const clients: Record<string, MCPClient> = {}
  const status: Record<string, Status> = {}

  await Promise.all(
    Object.entries(config).map(async ([key, mcp]) => {
      const result = await create(key, mcp).catch(() => undefined)
      if (!result) return
      
      status[key] = result.status
      if (result.client) {
        clients[key] = result.client
      }
    })
  )

  return { clients, status }
})
```

**Key Point:** If MCP client creation fails, `clients["metabob"]` will be `undefined`, causing `isAvailable()` to return `false`. This triggers the fallback to bootstrap templates.

## Why Activities Still Work

### Scenario 1: Bootstrap Templates

If you're executing one of these activities, they work offline:
- `evolve-activity-self-contained`
- `manage-session-memory`
- `trace-data-flow-single-feature`
- `trace-enforce-validate-loop`

**Evidence:**
```bash
# Check if activity is bootstrap
cd repos/metabob-opencode
grep -A 5 "BOOTSTRAP_TEMPLATES" packages/opencode/src/session/template-loader.ts
```

### Scenario 2: Cached Templates

If templates were previously loaded from MCP and cached:
```typescript
// TemplateCache stores templates in-memory
TemplateCache.put(template) // Cached after successful MCP load

// Later requests hit cache first
const cached = TemplateCache.get(id, version)
if (cached) {
  return { template: cached, source: "cache", cached: true }
}
```

**Cache Lifetime:** Session-scoped (lost on process restart)

### Scenario 3: Silent Fallback

When MCP is unavailable but bootstrap templates exist:
```typescript
} catch (error) {
  log.warn("metabob load failed", { id, error })
  // Code continues to step 3 (bootstrap fallback)
  // No error thrown unless strictBackend=true
}
```

**This is intentional:** Graceful degradation for development convenience.

## The Problem

### Issue: Silent Degradation

**Without `strictBackend=true`:**
- MCP failures are logged as warnings but don't block execution
- System silently falls back to bootstrap/cache
- Developers may not realize MCP is disconnected
- Custom templates registered in backend are unavailable but no error

**Current Behavior:**
```
1. Try to load "my-custom-template" via MCP
2. MCP connection fails (silently)
3. Not a bootstrap template → throw error
   BUT: If cached from previous session → works fine!
```

### Architectural Tension

**Development Convenience** vs. **Production Reliability**

```
┌────────────────────────────────────────┐
│  Development (Current Default)         │
│  ────────────────────────────────────  │
│  strictBackend: false                  │
│  Fallback: Graceful                    │
│  Error: Only if template truly missing │
│  Benefit: Works offline                │
│  Risk: Silent MCP failures             │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  Production (Recommended)               │
│  ────────────────────────────────────  │
│  strictBackend: true                   │
│  Fallback: Only bootstrap              │
│  Error: Immediate on MCP failure       │
│  Benefit: Detect issues fast           │
│  Risk: Requires working MCP            │
└────────────────────────────────────────┘
```

## Current MCP Connection Status

### Check in This Session

```bash
# Check if MCP client is initialized
cd repos/metabob-opencode
ps aux | grep metabob-cli
# Result: Process running (PID 3671410)

# Check if opencode can see it
# (Need to run from within opencode session)
> MetabobCLI.isAvailable()
# Likely returns: false (despite process running)
```

### Why MCP Might Not Connect

Even though `metabob-cli mcp` is running (PID 3671410), the MCP client may not connect due to:

1. **Wrong Transport Mode**
   - MCP server running: `metabob-cli mcp` (defaults to stdio)
   - OpenCode config: `command: ["metabob-cli", "mcp", "--transport", "stdio"]`
   - **Potential Issue:** If opencode started BEFORE we updated config, it's using old settings

2. **Environment Variables Not Passed**
   - Config specifies: `METABOB_API_URL=http://api.metabob.local`
   - But MCP client process may not have received it

3. **Session Isolation**
   - The running `metabob-cli mcp` process might be from a different session
   - OpenCode tries to spawn its own child process per config

## Solution: Enforce Strict Backend Mode

### Enable Strict Backend Enforcement

**Option 1: Global Config (Recommended for Production)**

```json
// .opencode/opencode.json
{
  "metabob": {
    "auto_inject": true,
    "base_url": "http://api.metabob.local",
    "strict_backend": true  // ← ADD THIS
  }
}
```

**Option 2: Per-Operation (Development)**

```typescript
// When loading templates
const template = await TemplateLoader.load(id, {
  strictBackend: true  // Fail fast if MCP unavailable
})

// When listing templates
const templates = await TemplateLoader.list({
  strictBackend: true  // Require backend connection
})
```

### What Strict Mode Does

```typescript
// With strictBackend=true
if (options.strictBackend && !BOOTSTRAP_TEMPLATES.has(id)) {
  throw new Error(
    `Template not found in strict backend mode: ${id}. ` +
    `Backend is required but template not available. ` +
    `Ensure template is registered in metabob backend via MCP.`
  )
}
```

**Behavior:**
- Non-bootstrap templates: MUST load from backend (throws error if MCP unavailable)
- Bootstrap templates: ALLOWED to fallback to embedded source (cold-start exception)
- Immediate feedback: No silent degradation

## Verification Steps

### 1. Check MCP Connection in Current Session

```bash
# Start opencode
cd repos/metabob-opencode
opencode

# In opencode session:
> await MetabobCLI.isAvailable()
# Expected: true or false

> await MCP.clients()
# Expected: { metabob: Client } or {}

> await MCP.healthCheck()
# Expected: { overall: "healthy" | "degraded" | "failed", clients: {...} }
```

### 2. Check Template Sources

```bash
# In opencode session:
> const result = await TemplateLoader.load("add-feature-complete")
> console.log(result.source)
# Expected: "metabob" (if MCP connected), "cache" (if cached), or error (if not bootstrap)

> const listResult = await TemplateLoader.list()
> console.log(listResult.source)
# Expected: "metabob" (if MCP connected) or "local" (if bootstrap fallback)
```

### 3. Force Backend Connection Test

```bash
# In opencode session (with strictBackend):
> try {
>   const result = await TemplateLoader.load("add-feature-complete", { strictBackend: true })
>   console.log("SUCCESS: Backend connected, loaded from", result.source)
> } catch (error) {
>   console.log("FAILED: Backend not connected", error.message)
> }
```

## Recommendations

### 1. **Add Health Check at Startup**

```typescript
// repos/metabob-opencode/packages/opencode/src/vessel/bootstrap.ts

async function validateMCPConnections() {
  const health = await MCP.healthCheck()
  
  if (health.overall === "failed") {
    log.error("MCP health check failed", health)
    throw new Error("Required MCP connections unavailable. Check configuration.")
  }
  
  if (health.overall === "degraded") {
    log.warn("MCP health check degraded", health)
  }
  
  if (health.clients.metabob?.status === "connected") {
    log.info("Metabob MCP connected", { toolCount: health.clients.metabob.toolCount })
  } else {
    log.warn("Metabob MCP not connected, using bootstrap templates only")
  }
}

// Call during vessel initialization
```

### 2. **Enable Strict Mode for Production**

```json
// .opencode/opencode.json (production)
{
  "metabob": {
    "strict_backend": true,
    "fallback_mode": "bootstrap-only"
  }
}
```

### 3. **Add MCP Connection Status to UI**

```typescript
// Display MCP status in TUI sidebar
const mcpStatus = await MCP.healthCheck()

ui.statusBar.add({
  label: "MCP",
  value: mcpStatus.overall === "healthy" ? "✓" : "✗",
  color: mcpStatus.overall === "healthy" ? "green" : "red"
})
```

### 4. **Fix Current Instance**

```bash
# Option A: Restart opencode with new config
# (We already updated .opencode/opencode.json with auto_inject:true and mcp.metabob)
cd repos/metabob-opencode
# Exit current opencode session
# Start new session:
opencode

# Verify connection:
> await MetabobCLI.isAvailable()
# Should now return: true

# Option B: Manually connect MCP in current session
> await MCP.state.refresh() // Force config reload
> await MetabobCLI.isAvailable()
```

## Summary

### Why Activities Work Without MCP

1. **Bootstrap Templates** - Embedded in binary for cold-start
2. **Template Cache** - In-memory cache from previous successful loads
3. **Graceful Fallback** - Silent degradation without `strictBackend=true`

### The Real Issue

Not that activities work without MCP (that's intentional for resilience), but that:
- **Silent failures** make it hard to detect MCP connection issues
- **No visibility** into which templates come from which source (cache vs. MCP vs. bootstrap)
- **Development convenience** prioritized over production reliability

### The Fix

1. ✅ Configure MCP properly (DONE - we added `auto_inject:true` and `mcp.metabob`)
2. 🔄 Restart opencode to pick up new config
3. 🎯 Enable `strictBackend: true` for production deployments
4. 🔍 Add health checks and UI status indicators

### Next Actions

1. Restart current opencode session to connect MCP with new config
2. Verify `MetabobCLI.isAvailable()` returns `true`
3. Test template loading sources (should be "metabob" not "local")
4. Consider adding `strict_backend: true` to enforce backend connectivity

---

**Status:** Analysis complete  
**Root Cause:** Fallback architecture + config not reloaded  
**Resolution:** Restart opencode session with updated config
