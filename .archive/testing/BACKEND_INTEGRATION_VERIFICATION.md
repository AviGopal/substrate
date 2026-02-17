# Backend Integration Verification Plan

**Date**: February 16, 2026  
**Status**: 🟡 In Progress  
**Goal**: Verify metabob-opencode and metabob-cli work with production backend

---

## Current Backend Configuration

### Production Backend (metabob-rpc-api)
- **Namespace**: `metabob`
- **Database**: `production` (SurrealDB at `ws://surrealdb:8000`)
- **Pod**: `metabob-rpc-api-56b4c5dd6b-rzf68`
- **Service**: `metabob-rpc-api` (internal Kubernetes service)
- **API Version**: v0.16.13
- **Templates Registered**: 16/16 ✅
- **Activities**: 14 activities with 16 variants

### API Endpoints
- `/v2/agent/execute` - Execute agent workflows
- `/v2/activities/list` - List available activity templates
- `/v2/activities/get/<id>` - Get specific template
- `/health` - Health check

---

## Application Configuration Analysis

### 1. metabob-cli Configuration

**Default Configuration** (`repos/metabob-cli/src/metabob_cli/core/config.py`):
```python
base_url: str = "https://ide.metabob.com"  # Line 54
```

**Environment Variable Overrides**:
- `METABOB_BASE_URL` - Override base URL
- `METABOB_API_URL` - Alternative API URL
- `METABOB_MCP_URL` - MCP server URL (default: `http://localhost:8000`)
- `METABOB_API_KEY` - API key for authentication

**MCP Server URLs** (`repos/metabob-cli/src/metabob_cli/commands.py`):
```python
def _get_mcp_server_url() -> str:
    return os.environ.get("METABOB_MCP_URL", "http://localhost:8000")
```

**Local Config Files** (checked):
- `repos/metabob-opencode/.metabob/config.json`:
  ```json
  {
    "base_url": "http://host.docker.internal:8080",
    "api_key": "mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ"
  }
  ```
- `repos/metabob-opencode/packages/opencode/.metabob/config.json`:
  ```json
  {
    "base_url": "http://localhost:8080"
  }
  ```

### 2. metabob-opencode Configuration

**Default Configuration** (`repos/metabob-opencode/packages/opencode/src/config/schemas/metabob.ts`):
```typescript
base_url: z.string().default("https://ide.metabob.com")  // Line 50
```

**MCP Integration**:
- Uses `@modelcontextprotocol/sdk` for MCP client
- Metabob tools exposed via MCP server (metabob-cli)
- Configuration in `opencode.json` under `mcp.metabob` section

---

## Issues Identified

### 🔴 CRITICAL: Backend URL Mismatch

**Problem**: Applications default to `https://ide.metabob.com`, but we need them to point to:
- **Production backend**: Kubernetes service at `http://metabob-rpc-api:8080` (internal)
- **Local development**: `http://localhost:8080` (port-forward)

**Current State**:
1. **metabob-cli**: Defaults to `https://ide.metabob.com`
2. **metabob-opencode**: Defaults to `https://ide.metabob.com`
3. **Local configs**: Point to `localhost:8080` or `host.docker.internal:8080`

**Impact**: Applications cannot reach production backend with registered templates

### 🟡 WARNING: Configuration Files Not Aligned

**Problem**: Multiple configuration files with different base URLs:
- `repos/metabob-opencode/.metabob/config.json` → `http://host.docker.internal:8080`
- `repos/metabob-opencode/packages/opencode/.metabob/config.json` → `http://localhost:8080`

**Impact**: Confusion about which backend is being used

### 🟢 INFO: Authentication

**Current**: API key-based authentication
- Key found in `repos/metabob-opencode/.metabob/config.json`
- Key: `mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ`

**Verification Needed**: Does this key exist in production database?

---

## Verification Steps

### Step 1: Check Backend Accessibility

```bash
# Try kubectl commands to verify backend is running
kubectl -n metabob get pods -l app=metabob-rpc-api
kubectl -n metabob get svc metabob-rpc-api

# Port-forward to access locally
kubectl -n metabob port-forward svc/metabob-rpc-api 8080:8080 &

# Test health endpoint
curl http://localhost:8080/health

# Test templates endpoint
curl http://localhost:8080/v2/activities/list
```

### Step 2: Verify API Key in Database

```bash
POD=$(kubectl -n metabob get pods -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}')

kubectl -n metabob exec $POD -c rpc-api -- python3 << 'PYTHON'
import asyncio
from server.config import Settings
from server.utils.surreal_client import SurrealDBClient

async def main():
    config = Settings()
    db = SurrealDBClient(config)
    await db.connect()
    
    # Check for API key
    result = await db.query("""
        SELECT * FROM api_keys 
        WHERE key = 'mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ'
    """)
    
    print(f"API Key exists: {len(result) > 0 and len(result[0]) > 0}")
    if result and result[0]:
        print(f"Key details: {result[0][0]}")
    
    await db.disconnect()

asyncio.run(main())
PYTHON
```

### Step 3: Test metabob-cli Connection

```bash
# Set environment to use local backend
export METABOB_BASE_URL="http://localhost:8080"
export METABOB_API_KEY="mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ"

# Navigate to metabob-cli
cd repos/metabob-cli

# Test basic command (if available)
python -m metabob_cli --help

# Test template listing (if endpoint exists)
# This depends on what commands are available in the CLI
```

### Step 4: Test metabob-opencode MCP Integration

```bash
# Check MCP configuration in opencode
cat repos/metabob-opencode/.opencode/opencode.json | jq '.mcp'

# Test if MCP server can be started
cd repos/metabob-opencode/packages/opencode
# Run MCP test if available
npm test -- --grep "metabob.*mcp"
```

### Step 5: End-to-End Activity Execution Test

```bash
# With port-forward active and correct env vars set
# Try to execute a simple activity through the CLI

# Example (syntax depends on actual CLI implementation)
cd repos/metabob-cli
python -m metabob_cli execute-activity \
  --activity-id "bug-fix-v1" \
  --variables '{"bug_description": "test bug"}' \
  --base-url "http://localhost:8080"
```

---

## Remediation Plan

### Option A: Update Configuration Files (Recommended)

**Approach**: Update local configuration files to point to production backend via port-forward

**Steps**:
1. Start port-forward: `kubectl -n metabob port-forward svc/metabob-rpc-api 8080:8080`
2. Update configuration files:
   ```bash
   # Update metabob-cli config
   cat > repos/metabob-cli/.metabob/config.json << 'JSON'
   {
     "base_url": "http://localhost:8080",
     "api_key": "mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ",
     "state_directory": ".metabob"
   }
   JSON
   
   # Update metabob-opencode config
   cat > repos/metabob-opencode/.metabob/config.json << 'JSON'
   {
     "base_url": "http://localhost:8080",
     "api_key": "mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ",
     "state_directory": ".metabob"
   }
   JSON
   ```

### Option B: Use Environment Variables

**Approach**: Use environment variables to override configuration

**Steps**:
```bash
# Add to shell profile or .envrc
export METABOB_BASE_URL="http://localhost:8080"
export METABOB_API_KEY="mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ"
export METABOB_MCP_URL="http://localhost:8000"
```

### Option C: Create Kubernetes Ingress/Service

**Approach**: Expose backend externally with proper DNS/load balancer

**Steps**: (More complex, requires cluster admin)
1. Create Ingress resource for metabob-rpc-api
2. Configure DNS to point to cluster
3. Update configs to use external URL

---

## Success Criteria

- [ ] Backend health check returns 200 OK
- [ ] API key is validated by backend
- [ ] Template list endpoint returns 16 templates
- [ ] metabob-cli can connect and list templates
- [ ] metabob-opencode MCP integration can call Metabob tools
- [ ] End-to-end activity execution completes successfully
- [ ] Both applications use consistent backend configuration

---

## Next Steps

1. **Run verification steps** above to understand current state
2. **Choose remediation approach** based on verification results
3. **Implement configuration updates** 
4. **Test end-to-end workflow** with both applications
5. **Document final configuration** for future reference

---

## Notes

- Kubernetes commands may timeout - this was observed in previous session
- Alternative: Use `docker` commands if running in Docker Compose instead
- Check if backend is accessible via `docker network` if using containers
- Verify firewall/network policies allow traffic to backend
