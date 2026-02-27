# CLI-Mediated Communication Implementation Plan

**Status:** Ready for Execution  
**Created:** 2026-02-27  
**Estimated Effort:** 4-6 hours

## Overview

This plan implements the CLI-mediated communication architectural boundary, ensuring all metabob-opencode → backend communication goes through metabob-cli MCP tools.

**Current State:**
- ✅ Specification complete (`docs/architectural-boundaries/CLI_MEDIATED_COMMUNICATION.md`)
- ✅ Validation script created (`scripts/validate-architectural-boundaries.sh`)
- ❌ 3 violations in `bootstrap.ts`: direct `fetch()` to RPC API

**Goal State:**
- ✅ All backend communication through CLI MCP tools
- ✅ 0 violations in validation script
- ✅ Framework testable without real backend

---

## Implementation Sequence

### Phase 1: Implement CLI MCP Tools (metabob-cli)

**Location:** `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

#### Task 1.1: Implement `vessel_register` MCP Tool

**Pattern:** Follow existing MCP tool pattern in `tools.py`

```python
@mcp.tool(
    description="""Register vessel with backend and return vessel_id.
    
    This tool mediates vessel registration, ensuring the framework doesn't
    directly access the backend API. Part of CLI-mediated communication boundary.
    
    Args:
        vessel_name: Pod name (e.g., "devbob-0")
        environment_type: Workspace environment ("clean", "mounted-codebase", "cloned-repo")
        workspace_path: Path to workspace directory
        
    Returns:
        vessel_id: Unique vessel identifier
        registered_at: ISO 8601 timestamp
    """
)
async def vessel_register(
    vessel_name: str,
    environment_type: str,
    workspace_path: str,
    ctx: Context | None = None,
) -> str:
    """Register vessel with backend via CLI MCP layer."""
    try:
        server = _get_server()
        config = server.get_config_manager()
        backend_url = config.get("backend_url", "http://localhost:8080")
        
        # Make HTTP call to backend (CLI knows backend URL, framework doesn't)
        import httpx
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{backend_url}/api/vessels/register",
                json={
                    "vessel_name": vessel_name,
                    "environment": environment_type,
                    "workspace_path": workspace_path,
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise Exception(f"Registration failed: HTTP {response.status_code}")
            
            data = response.json()
            vessel_id = data.get("vessel_id") or data.get("id")
            registered_at = data.get("registered_at") or datetime.now().isoformat()
            
            result = {
                "vessel_id": vessel_id,
                "registered_at": registered_at,
                "backend_url": backend_url
            }
            
            logger.info(f"Vessel registered successfully: {vessel_id}")
            
            return json.dumps(result, indent=2)
            
    except Exception as e:
        logger.error(f"Vessel registration failed: {e}")
        return json.dumps({
            "error": str(e),
            "vessel_name": vessel_name
        }, indent=2)
```

**Testing:**
```bash
# Test with opencode MCP client
opencode mcp call metabob vessel_register \
  '{"vessel_name": "test-vessel", "environment_type": "clean", "workspace_path": "/workspace"}'
```

---

#### Task 1.2: Implement `vessel_get_config` MCP Tool

```python
@mcp.tool(
    description="""Fetch vessel configuration from backend.
    
    Retrieves role-specific configuration for the vessel after registration.
    Part of CLI-mediated communication boundary.
    
    Args:
        vessel_id: Vessel identifier from registration
        
    Returns:
        config: Configuration object with MCP servers, feature flags, etc.
    """
)
async def vessel_get_config(
    vessel_id: str,
    ctx: Context | None = None,
) -> str:
    """Fetch vessel configuration via CLI MCP layer."""
    try:
        server = _get_server()
        config = server.get_config_manager()
        backend_url = config.get("backend_url", "http://localhost:8080")
        
        import httpx
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{backend_url}/api/vessels/{vessel_id}/config",
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise Exception(f"Config fetch failed: HTTP {response.status_code}")
            
            data = response.json()
            
            result = {
                "vessel_id": vessel_id,
                "config": data.get("config", {}),
                "fetched_at": data.get("fetched_at") or datetime.now().isoformat()
            }
            
            logger.info(f"Vessel config fetched successfully: {vessel_id}")
            
            return json.dumps(result, indent=2)
            
    except Exception as e:
        logger.error(f"Vessel config fetch failed: {e}")
        return json.dumps({
            "error": str(e),
            "vessel_id": vessel_id
        }, indent=2)
```

---

#### Task 1.3: Implement `backend_health_check` MCP Tool

```python
@mcp.tool(
    description="""Check backend health status.
    
    Verifies backend availability before attempting other operations.
    Part of CLI-mediated communication boundary.
    
    Returns:
        healthy: Boolean indicating backend availability
        response_time_ms: Health check response time
    """
)
async def backend_health_check(
    ctx: Context | None = None,
) -> str:
    """Check backend health via CLI MCP layer."""
    try:
        import time
        import httpx
        
        server = _get_server()
        config = server.get_config_manager()
        backend_url = config.get("backend_url", "http://localhost:8080")
        
        start_time = time.time()
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{backend_url}/health",
                timeout=10.0
            )
            
            response_time_ms = int((time.time() - start_time) * 1000)
            
            result = {
                "healthy": response.status_code == 200,
                "status_code": response.status_code,
                "response_time_ms": response_time_ms,
                "backend_url": backend_url,
                "checked_at": datetime.now().isoformat()
            }
            
            logger.info(f"Backend health check: {'OK' if result['healthy'] else 'FAIL'}")
            
            return json.dumps(result, indent=2)
            
    except Exception as e:
        logger.error(f"Backend health check failed: {e}")
        return json.dumps({
            "healthy": False,
            "error": str(e),
            "backend_url": backend_url if 'backend_url' in locals() else "unknown"
        }, indent=2)
```

---

### Phase 2: Refactor Framework Code (metabob-opencode)

**Location:** `repos/metabob-opencode/packages/opencode/src/vessel/bootstrap.ts`

#### Task 2.1: Refactor `registerVessel()` Function

**Before (Direct fetch):**
```typescript
const response = await fetch(`${backend_url}/api/vessels/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
  signal: controller.signal
})

const data = await response.json()
return {
  vessel_id: data.vessel_id,
  registered_at: data.registered_at,
  backend_url
}
```

**After (CLI MCP tool):**
```typescript
import { MCP } from "../mcp"

export async function registerVessel(
  vessel_name: string,
  environment: string,
  workspace_path: string
): Promise<VesselRegistration> {
  logger.info("Registering vessel via CLI MCP", { vessel_name })
  
  try {
    const clients = await MCP.clients()
    const metabobClient = clients["metabob"]
    
    if (!metabobClient) {
      throw new Error("Metabob CLI MCP client not available")
    }
    
    const result = await metabobClient.callTool({
      name: "vessel_register",
      arguments: {
        vessel_name,
        environment_type: environment,
        workspace_path
      }
    })
    
    // Parse MCP result
    const textContent = result.content
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text)
      .join("\n")
    
    const data = JSON.parse(textContent)
    
    if (data.error) {
      throw new Error(data.error)
    }
    
    const registration: VesselRegistration = {
      vessel_id: data.vessel_id,
      registered_at: data.registered_at,
      backend_url: data.backend_url
    }
    
    logger.info("Vessel registered successfully", { vessel_id: registration.vessel_id })
    
    return registration
    
  } catch (error) {
    logger.error("Vessel registration failed", { error })
    throw new Error(`Failed to register vessel: ${error.message}`)
  }
}
```

**Key Changes:**
- ❌ Removed `backend_url` parameter from function signature
- ❌ Removed direct `fetch()` call
- ✅ Added MCP client usage
- ✅ Added proper error handling

---

#### Task 2.2: Refactor `fetchConfig()` Function

**Before:**
```typescript
const response = await fetch(`${backend_url}/api/vessels/${vessel_id}/config`, {
  method: "GET",
  headers: { "Content-Type": "application/json" },
  signal: controller.signal
})

const data = await response.json()
return {
  vessel_id: data.vessel_id,
  config: data.config,
  fetched_at: data.fetched_at
}
```

**After:**
```typescript
export async function fetchConfig(
  vessel_id: string
): Promise<BootstrapConfig> {
  logger.info("Fetching vessel config via CLI MCP", { vessel_id })
  
  try {
    const clients = await MCP.clients()
    const metabobClient = clients["metabob"]
    
    if (!metabobClient) {
      throw new Error("Metabob CLI MCP client not available")
    }
    
    const result = await metabobClient.callTool({
      name: "vessel_get_config",
      arguments: { vessel_id }
    })
    
    const textContent = result.content
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text)
      .join("\n")
    
    const data = JSON.parse(textContent)
    
    if (data.error) {
      throw new Error(data.error)
    }
    
    const config: BootstrapConfig = {
      vessel_id: data.vessel_id,
      config: data.config,
      fetched_at: data.fetched_at
    }
    
    logger.info("Vessel config fetched successfully", { vessel_id })
    
    return config
    
  } catch (error) {
    logger.error("Config fetch failed", { error })
    throw new Error(`Failed to fetch config: ${error.message}`)
  }
}
```

---

#### Task 2.3: Refactor `healthCheck()` Function

**Before:**
```typescript
const response = await fetch(`${backend_url}/health`, {
  method: "GET",
  headers: { "Content-Type": "application/json" },
  signal: controller.signal
})

return response.ok
```

**After:**
```typescript
export async function healthCheck(): Promise<boolean> {
  logger.info("Checking backend health via CLI MCP")
  
  try {
    const clients = await MCP.clients()
    const metabobClient = clients["metabob"]
    
    if (!metabobClient) {
      logger.warn("Metabob CLI MCP client not available")
      return false
    }
    
    const result = await metabobClient.callTool({
      name: "backend_health_check",
      arguments: {}
    })
    
    const textContent = result.content
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text)
      .join("\n")
    
    const data = JSON.parse(textContent)
    
    logger.info("Backend health check result", { healthy: data.healthy })
    
    return data.healthy
    
  } catch (error) {
    logger.warn("Backend health check failed (non-blocking)", { error })
    return false
  }
}
```

---

#### Task 2.4: Update `bootstrap()` Function Signature

**Remove `backend_url` parameter:**

```typescript
// Before:
export async function bootstrap(options: BootstrapOptions = {}): Promise<BootstrapResult> {
  const {
    workspace_path = "/workspace",
    backend_url = process.env.METABOB_API_URL || "http://localhost:8000",  // ❌ Remove this
    vessel_name = process.env.HOSTNAME || "unknown-vessel",
    // ...
  } = options

// After:
export async function bootstrap(options: BootstrapOptions = {}): Promise<BootstrapResult> {
  const {
    workspace_path = "/workspace",
    vessel_name = process.env.HOSTNAME || "unknown-vessel",
    tracking_file = "/workspace/.bootstrapped",
    force_bootstrap = false,
    skip_registration = false,
    timeout_ms = 30000,
    registry = new NoOpVesselRegistry()
  } = options
  
  // No backend_url needed - CLI MCP tools handle it
```

**Update call sites:**

```typescript
// Before:
const registration = await registerVessel(environment, backend_url, vessel_name, timeout_ms)
const config = await fetchConfig(vessel_id, backend_url, timeout_ms)
const healthy = await healthCheck(backend_url)

// After:
const registration = await registerVessel(vessel_name, environment.type, workspace_path)
const config = await fetchConfig(vessel_id)
const healthy = await healthCheck()
```

---

### Phase 3: Validation & Testing

#### Task 3.1: Run Validation Script

```bash
./scripts/validate-architectural-boundaries.sh
```

**Expected Output:**
```
✅ PASS: No docker-exec in framework
✅ PASS: No SurrealDB imports in framework
✅ PASS: No registerVesselInSurrealDB function
✅ PASS: No direct fetch() to RPC API
✅ PASS: No hardcoded backend URLs in fetch()
✅ PASS: MCP tools are used (25+ references)
✅ PASS: VesselRegistry interface exists
✅ PASS: VesselRegistry interface is used

✅ ALL BOUNDARIES ENFORCED
```

---

#### Task 3.2: Integration Testing

**Test 1: Vessel Registration**
```bash
# Start backend
cd repos/metabob-rpc-api
python -m uvicorn main:app --port 8080

# Test MCP tool directly
cd repos/metabob-cli
python -m metabob_cli.mcp.test_tools vessel_register \
  '{"vessel_name": "test-vessel", "environment_type": "clean", "workspace_path": "/workspace"}'
```

**Test 2: Bootstrap Flow**
```bash
# In metabob-opencode
cd repos/metabob-opencode
bun test packages/opencode/src/vessel/bootstrap.test.ts
```

**Test 3: End-to-End**
```bash
# Full bootstrap in Docker container
docker exec devbob-0 opencode bootstrap --workspace /workspace
```

---

## Success Criteria

### Automated Validation
- ✅ `validate-architectural-boundaries.sh` exits with code 0
- ✅ 0 direct `fetch()` calls to RPC API in framework
- ✅ 0 `backend_url` parameters in framework functions
- ✅ MCP tools implemented and callable

### Manual Validation
- ✅ Vessel registration works via CLI MCP tool
- ✅ Config fetch works via CLI MCP tool
- ✅ Health check works via CLI MCP tool
- ✅ Bootstrap completes successfully using MCP tools
- ✅ Framework code has no knowledge of backend URLs

### Code Quality
- ✅ All functions have proper error handling
- ✅ Logging added for debugging
- ✅ TypeScript types preserved
- ✅ Python type hints added

---

## Rollback Plan

If issues arise:

1. **Revert framework changes:**
   ```bash
   cd repos/metabob-opencode
   git revert HEAD~3..HEAD
   ```

2. **Keep CLI MCP tools** (they're additive, no breaking changes)

3. **Re-enable direct fetch temporarily** while debugging

---

## Estimated Timeline

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| Phase 1: CLI MCP Tools | 3 tools | 2 hours |
| Phase 2: Framework Refactor | 4 refactors | 2 hours |
| Phase 3: Validation & Testing | 3 tests | 1-2 hours |
| **Total** | 10 tasks | **4-6 hours** |

---

## Next Actions

1. **Implement CLI MCP tools** (Tasks 1.1-1.3)
   - Add to `repos/metabob-cli/src/metabob_cli/mcp/tools.py`
   - Test each tool independently
   - Commit: "feat(mcp): Add vessel management CLI tools"

2. **Refactor framework code** (Tasks 2.1-2.4)
   - Update `repos/metabob-opencode/packages/opencode/src/vessel/bootstrap.ts`
   - Remove `backend_url` parameters
   - Use MCP tools for backend communication
   - Commit: "refactor(bootstrap): Use CLI MCP tools for backend communication"

3. **Validate & test** (Tasks 3.1-3.2)
   - Run validation script
   - Run integration tests
   - Document any issues
   - Commit: "test: Validate CLI-mediated communication boundary"

---

**Status:** ✅ **READY FOR EXECUTION**  
**Blockers:** None  
**Dependencies:** metabob-cli, metabob-opencode, metabob-rpc-api (running)
