# CLI-Mediated Communication Architectural Boundary

**Status:** ENFORCING  
**Version:** 1.0  
**Last Updated:** 2026-02-27

## Overview

All communication from `metabob-opencode` to instance-invariant storage (metabob-rpc-api, SurrealDB) **MUST** go through the `metabob-cli` MCP layer. Direct HTTP calls, database clients, or SDK usage from opencode to backend services is **PROHIBITED**.

## Core Principle

**"Framework code communicates with backend services ONLY through CLI MCP tools"**

This enforces:
- **Instance Invariance:** Storage operations go through centralized CLI layer
- **Deployment Flexibility:** Backend URLs can change without touching framework code
- **Testability:** MCP tools can be mocked without changing framework code
- **Permission Control:** CLI mediates all external service access
- **Observability:** All backend calls are traceable through MCP layer

---

## Architectural Layers

```
┌──────────────────────────────────────────────────────────┐
│ metabob-opencode (Framework)                             │
│  - Activity execution                                    │
│  - Session management                                    │
│  - Impulse resolution                                    │
│  ❌ NO direct fetch() to RPC API                        │
│  ❌ NO direct SurrealDB client                          │
│  ✅ ONLY calls MCP tools                                │
└────────────────────┬─────────────────────────────────────┘
                     │
                     │ MCP Protocol
                     ▼
┌──────────────────────────────────────────────────────────┐
│ metabob-cli (MCP Server)                                 │
│  - Exposes MCP tools for backend operations              │
│  - vessel_register()                                     │
│  - vessel_get_config()                                   │
│  - activity_report_execution()                           │
│  - template_get_metrics()                                │
│  ✅ Mediates ALL backend access                         │
└────────────────────┬─────────────────────────────────────┘
                     │
                     │ HTTP/WebSocket
                     ▼
┌──────────────────────────────────────────────────────────┐
│ metabob-rpc-api + SurrealDB (Backend)                    │
│  - /api/vessels/register                                 │
│  - /api/vessels/:id/config                               │
│  - /api/activities/execution                             │
│  - /api/templates/:id/metrics                            │
│  - Redis, SurrealDB storage                              │
└──────────────────────────────────────────────────────────┘
```

---

## Violations (PROHIBITED)

### ❌ Violation 1: Direct fetch() to RPC API

**Location:** `repos/metabob-opencode/packages/opencode/src/vessel/bootstrap.ts`

**Problem:**
```typescript
// ❌ BAD: Framework code makes direct HTTP calls to backend
const response = await fetch(`${backend_url}/api/vessels/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
  signal: controller.signal
})

const data = await response.json()
const vessel_id = data.vessel_id
```

**Why It's Wrong:**
- Framework code knows about RPC API URL structure (`/api/vessels/register`)
- Hardcodes HTTP headers, methods, request/response schemas
- Cannot be mocked or tested without real backend
- Bypasses CLI MCP layer (violates instance-invariant storage pattern)
- Makes framework dependent on backend API contract

**Correct Approach:**
```typescript
// ✅ GOOD: Framework calls CLI MCP tool
const clients = await MCP.clients()
const cliClient = clients["cli"]

const result = await cliClient.callTool({
  name: "vessel_register",
  arguments: {
    vessel_name,
    environment_type,
    workspace_path
  }
})

const vessel_id = result.metadata.vessel_id
```

---

### ❌ Violation 2: Direct fetch() to Get Vessel Config

**Location:** `repos/metabob-opencode/packages/opencode/src/vessel/bootstrap.ts`

**Problem:**
```typescript
// ❌ BAD: Direct HTTP call to fetch config
const response = await fetch(`${backend_url}/api/vessels/${vessel_id}/config`, {
  method: "GET",
  headers: { "Content-Type": "application/json" },
  signal: controller.signal
})

const config = await response.json()
```

**Why It's Wrong:**
- Framework knows about `/api/vessels/:id/config` endpoint structure
- Cannot test without real backend
- Bypasses CLI MCP mediation layer

**Correct Approach:**
```typescript
// ✅ GOOD: Framework calls CLI MCP tool
const clients = await MCP.clients()
const cliClient = clients["cli"]

const result = await cliClient.callTool({
  name: "vessel_get_config",
  arguments: { vessel_id }
})

const config = result.metadata.config
```

---

### ❌ Violation 3: Direct fetch() to Health Check

**Location:** `repos/metabob-opencode/packages/opencode/src/vessel/bootstrap.ts`

**Problem:**
```typescript
// ❌ BAD: Direct HTTP call to health check endpoint
const response = await fetch(`${backend_url}/health`, {
  method: "GET",
  headers: { "Content-Type": "application/json" },
  signal: controller.signal
})

return response.ok
```

**Why It's Wrong:**
- Framework knows about `/health` endpoint
- Bypasses CLI MCP layer

**Correct Approach:**
```typescript
// ✅ GOOD: Framework calls CLI MCP tool (or skips health check)
const clients = await MCP.clients()
const cliClient = clients["cli"]

const result = await cliClient.callTool({
  name: "backend_health_check",
  arguments: {}
})

return result.metadata.healthy
```

**Alternative:** Remove health check from framework entirely - CLI bootstraps vessel and handles backend availability

---

## Correct Implementation Pattern

### Example 1: Vessel Registration

**Framework Code (opencode):**
```typescript
// packages/opencode/src/vessel/bootstrap.ts
import { MCP } from "../mcp"

export async function registerVessel(
  vessel_name: string,
  environment_type: string,
  workspace_path: string
): Promise<{ vessel_id: string; registered_at: string }> {
  logger.info("Registering vessel via CLI MCP", { vessel_name })
  
  try {
    const clients = await MCP.clients()
    const cliClient = clients["cli"]
    
    if (!cliClient) {
      throw new Error("CLI MCP client not available")
    }
    
    const result = await cliClient.callTool({
      name: "vessel_register",
      arguments: {
        vessel_name,
        environment_type,
        workspace_path
      }
    })
    
    // MCP result format: { content: [{text: "..."}], metadata: {...} }
    const vessel_id = result.metadata.vessel_id
    const registered_at = result.metadata.registered_at
    
    logger.info("Vessel registered successfully", { vessel_id })
    
    return { vessel_id, registered_at }
  } catch (error) {
    logger.error("Vessel registration failed", { error })
    throw new Error(`Failed to register vessel: ${error.message}`)
  }
}
```

**CLI MCP Tool (metabob-cli):**
```typescript
// packages/cli/src/mcp/tools/vessel-register.ts
export const vesselRegisterTool = {
  name: "vessel_register",
  description: "Register vessel with backend and return vessel_id",
  inputSchema: {
    type: "object",
    properties: {
      vessel_name: { type: "string" },
      environment_type: { type: "string" },
      workspace_path: { type: "string" }
    },
    required: ["vessel_name", "environment_type", "workspace_path"]
  },
  
  async handler(args: { vessel_name: string; environment_type: string; workspace_path: string }) {
    const backend_url = process.env.METABOB_API_URL || "http://localhost:8000"
    
    // CLI makes the HTTP call
    const response = await fetch(`${backend_url}/api/vessels/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vessel_name: args.vessel_name,
        environment: args.environment_type,
        workspace_path: args.workspace_path
      })
    })
    
    if (!response.ok) {
      throw new Error(`Registration failed: HTTP ${response.status}`)
    }
    
    const data = await response.json()
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            vessel_id: data.vessel_id,
            registered_at: data.registered_at
          })
        }
      ],
      metadata: {
        vessel_id: data.vessel_id,
        registered_at: data.registered_at
      }
    }
  }
}
```

---

### Example 2: Activity Execution Reporting

**Framework Code (opencode):**
```typescript
// packages/opencode/src/session/template-metrics-client.ts
export async function reportExecution(data: ActivityExecutionData): Promise<void> {
  try {
    const clients = await MCP.clients()
    const metabobClient = clients["metabob"]  // ✅ Uses metabob MCP, not direct fetch
    
    if (!metabobClient) {
      log.debug("metabob mcp client not available")
      return
    }
    
    await metabobClient.callTool({
      name: "metabob_post_activity_result",
      arguments: {
        activity_id: data.activity_id,
        result: {
          success: data.success,
          duration: data.duration,
          cost: data.cost,
          tokens: data.tokens
        }
      }
    })
    
    log.info("Activity execution reported via MCP")
  } catch (error) {
    log.warn("Metrics reporting failed (graceful degradation)", { error })
  }
}
```

**CLI MCP Tool (metabob-cli):**
```typescript
// packages/cli/src/mcp/tools/post-activity-result.ts
export const postActivityResultTool = {
  name: "metabob_post_activity_result",
  description: "Report activity execution result to backend",
  inputSchema: {
    type: "object",
    properties: {
      activity_id: { type: "string" },
      result: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          duration: { type: "number" },
          cost: { type: "number" },
          tokens: { type: "object" }
        },
        required: ["success", "duration", "cost"]
      }
    },
    required: ["activity_id", "result"]
  },
  
  async handler(args: { activity_id: string; result: any }) {
    const backend_url = process.env.METABOB_API_URL || "http://localhost:8000"
    
    // CLI makes HTTP call to backend
    const response = await fetch(`${backend_url}/api/activities/execution`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activity_id: args.activity_id,
        ...args.result
      })
    })
    
    if (!response.ok) {
      throw new Error(`Reporting failed: HTTP ${response.status}`)
    }
    
    return {
      content: [{ type: "text", text: "Activity execution reported successfully" }],
      metadata: { success: true }
    }
  }
}
```

---

## Required CLI MCP Tools

The following MCP tools must be implemented in `metabob-cli` to support framework operations:

### Vessel Management

| Tool Name | Purpose | Arguments | Returns |
|-----------|---------|-----------|---------|
| `vessel_register` | Register vessel with backend | `vessel_name`, `environment_type`, `workspace_path` | `vessel_id`, `registered_at` |
| `vessel_get_config` | Fetch vessel configuration | `vessel_id` | `config` (object) |
| `vessel_unregister` | Unregister vessel (graceful shutdown) | `vessel_id` | `success` (boolean) |
| `backend_health_check` | Check backend availability | (none) | `healthy` (boolean) |

### Activity Metrics

| Tool Name | Purpose | Arguments | Returns |
|-----------|---------|-----------|---------|
| `metabob_post_activity_result` | Report execution result | `activity_id`, `result` | `success` (boolean) |
| `metabob_get_template_metrics` | Get template performance metrics | `template_id` | `metrics` (object) |
| `metabob_get_promotion_recommendation` | Get template promotion recommendation | `template_id` | `recommendation` (object) |
| `metabob_promote_template` | Promote candidate to stable | `candidate_id`, `reason` | `promotion_response` (object) |

### Storage Operations (Future)

| Tool Name | Purpose | Arguments | Returns |
|-----------|---------|-----------|---------|
| `storage_save_impulse` | Save impulse to SurrealDB | `impulse_id`, `impulse_data` | `success` (boolean) |
| `storage_get_impulse` | Retrieve impulse from SurrealDB | `impulse_id` | `impulse_data` (object) |
| `storage_save_activity` | Save activity to SurrealDB | `activity_id`, `activity_data` | `success` (boolean) |
| `storage_get_activity` | Retrieve activity from SurrealDB | `activity_id` | `activity_data` (object) |

---

## Benefits of CLI-Mediated Communication

### 1. Instance Invariance ✅

**Problem:** Direct framework→backend calls break instance-invariant storage pattern
**Solution:** All storage operations funnel through CLI MCP layer

```
// ❌ WRONG: Framework writes directly to backend (instance-specific)
Framework → HTTP fetch → RPC API → SurrealDB

// ✅ CORRECT: Framework goes through CLI (instance-invariant)
Framework → MCP Tool → CLI → HTTP fetch → RPC API → SurrealDB
```

### 2. Deployment Flexibility ✅

**Problem:** Framework hardcodes backend URLs (`http://localhost:8000`)
**Solution:** CLI reads environment variables, framework is URL-agnostic

```typescript
// ❌ WRONG: Framework knows backend URL
const backend_url = process.env.METABOB_API_URL || "http://localhost:8000"
const response = await fetch(`${backend_url}/api/vessels/register`, { ... })

// ✅ CORRECT: CLI knows backend URL, framework doesn't care
const clients = await MCP.clients()
const result = await clients["cli"].callTool({ name: "vessel_register", ... })
```

### 3. Testability ✅

**Problem:** Framework tests require real backend running
**Solution:** Mock MCP tools, test framework without backend

```typescript
// Test setup with mocked MCP
const mockMCP = {
  clients: async () => ({
    cli: {
      callTool: async ({ name, arguments }) => {
        if (name === "vessel_register") {
          return {
            metadata: {
              vessel_id: "test-vessel-123",
              registered_at: "2026-02-27T00:00:00Z"
            }
          }
        }
      }
    }
  })
}

// Framework code works with mock, no real backend needed
```

### 4. Permission Control ✅

**Problem:** Framework has unrestricted access to backend
**Solution:** CLI mediates and can enforce permissions/quotas

```typescript
// CLI MCP tool can check permissions before allowing backend access
async handler(args) {
  // Check if vessel has permission to register
  const allowed = await checkPermission(args.vessel_name)
  if (!allowed) {
    throw new Error("Permission denied: vessel not authorized")
  }
  
  // Proceed with backend call
  const response = await fetch(...)
}
```

### 5. Observability ✅

**Problem:** Direct fetch calls are hard to trace/log
**Solution:** All backend calls go through MCP tools (automatic tracing)

```
// MCP protocol includes built-in request/response logging
opencode → MCP Tool: vessel_register { vessel_name: "devbob-0" }
CLI → Backend: POST /api/vessels/register { vessel_name: "devbob-0" }
Backend → CLI: 200 OK { vessel_id: "vessel_abc123" }
MCP Tool → opencode: { metadata: { vessel_id: "vessel_abc123" } }

// All calls are traceable through MCP layer
```

---

## Enforcement Strategy

### Static Analysis (Automated)

```bash
#!/bin/bash
# validate-cli-mediated-communication.sh

echo "Checking for direct fetch() calls to backend in framework..."
cd repos/metabob-opencode

# Check for direct fetch to RPC API endpoints
rg "fetch.*\/api\/vessels|fetch.*\/api\/activities|fetch.*\/api\/templates" packages/opencode/src/ \
  && echo "❌ FAIL: Direct fetch() to RPC API found" \
  || echo "✅ PASS: No direct fetch() to RPC API"

# Check for hardcoded backend URLs
rg "localhost:8000|METABOB_API_URL.*fetch|backend_url.*fetch" packages/opencode/src/ \
  && echo "❌ FAIL: Hardcoded backend URLs in fetch() calls" \
  || echo "✅ PASS: No hardcoded backend URLs in fetch()"

# Check for direct SurrealDB client usage
rg "import.*surrealdb|new Surreal\(\)" packages/opencode/src/ \
  && echo "❌ FAIL: Direct SurrealDB client usage" \
  || echo "✅ PASS: No direct SurrealDB clients"

# Check that MCP tools are used instead
rg "MCP\.clients|callTool.*vessel_register|callTool.*metabob_" packages/opencode/src/ \
  && echo "✅ PASS: MCP tools are used" \
  || echo "⚠️  WARNING: No MCP tool usage detected"

echo "✅ CLI-mediated communication validation complete"
```

### Manual Review Checklist

**For each HTTP call in `packages/opencode/src/`:**
- [ ] Does it call `fetch()` with a backend URL?
- [ ] Does it know about RPC API endpoint structure?
- [ ] Does it read `METABOB_API_URL` or `backend_url`?
- [ ] Can it be replaced with an MCP tool call?
- [ ] If YES to any above → **REFACTOR to use CLI MCP tool**

---

## Migration Plan

### Phase 1: Identify Violations (CURRENT)
1. ✅ Search for direct `fetch()` calls to backend
2. ✅ Document all violations in bootstrap.ts
3. ✅ Create CLI-mediated communication specification

### Phase 2: Create CLI MCP Tools
1. ⏳ Implement `vessel_register` MCP tool in metabob-cli
2. ⏳ Implement `vessel_get_config` MCP tool
3. ⏳ Implement `backend_health_check` MCP tool (or remove from framework)
4. ⏳ Test MCP tools with harnesses

### Phase 3: Refactor Framework Code
1. ⏳ Update `bootstrap.ts` to use `vessel_register` MCP tool
2. ⏳ Update `bootstrap.ts` to use `vessel_get_config` MCP tool
3. ⏳ Remove direct `fetch()` calls to backend
4. ⏳ Remove `backend_url` parameter from framework functions

### Phase 4: Validation
1. ⏳ Run static analysis script
2. ⏳ Test with mocked MCP tools
3. ⏳ Test with real backend via CLI
4. ⏳ Verify no direct backend access remains

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Direct `fetch()` calls to RPC API in framework | 3 | 0 |
| Hardcoded backend URLs in framework | 5 | 0 |
| Framework functions taking `backend_url` parameter | 3 | 0 |
| CLI MCP tools for backend operations | 4 | 7+ |
| Framework code testable without real backend | ❌ | ✅ |
| All backend calls traceable through MCP | ❌ | ✅ |

---

## References

- **Instance-Invariant Storage Pattern:** See `VESSEL_SELF_CONFIGURATION.md`
- **VesselRegistry Abstraction:** See `METABOB_OPENCODE_ARCHITECTURAL_BOUNDARIES.md`
- **MCP Protocol:** https://modelcontextprotocol.io/
- **TemplateMetricsClient (CORRECT):** `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`

---

## Violations Summary

| File | Function | Violation | Status |
|------|----------|-----------|--------|
| `vessel/bootstrap.ts` | `registerVessel()` | Direct `fetch()` to `/api/vessels/register` | 🔴 ACTIVE |
| `vessel/bootstrap.ts` | `fetchConfig()` | Direct `fetch()` to `/api/vessels/:id/config` | 🔴 ACTIVE |
| `vessel/bootstrap.ts` | `healthCheck()` | Direct `fetch()` to `/health` | 🔴 ACTIVE |

**Total Violations:** 3  
**Status:** 🔴 **NOT ENFORCED** (Phase 2-4 pending)

---

**Next Action:** Implement `vessel_register`, `vessel_get_config`, `backend_health_check` MCP tools in metabob-cli, then refactor bootstrap.ts to use them.
