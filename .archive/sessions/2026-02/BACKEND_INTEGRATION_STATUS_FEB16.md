# Backend Integration Status Report

**Date**: February 16, 2026  
**Status**: 🟢 Backend Operational, ⚠️ Authentication Configuration Needed  

---

## Executive Summary

The production backend (metabob-rpc-api) is **running and operational** with templates successfully registered. However, client applications (metabob-cli and metabob-opencode) require configuration updates to connect to the backend.

### Key Findings

✅ **Backend Status**: Running (Docker container `api-server-dev`)  
✅ **Database**: SurrealDB connected (`metabob/metabob`)  
✅ **Templates**: 15 activities, 44 variants registered  
⚠️  **API Keys**: No active keys configured (authentication will fail)  
⚠️  **Client Configuration**: Applications point to wrong URLs  

---

## Backend Configuration

### Current Setup (Docker Compose)

```yaml
Service: api-server-dev
Container: metabobapp/metabob-rpc-api:0.16.12
Ports: 0.0.0.0:8080->8080/tcp
Status: Up 43 minutes (healthy)

Database: metabob-surreal  
Connection: ws://surreal:8000
Namespace: metabob
Database: metabob
Credentials: root/root
```

### Verified Endpoints

| Endpoint | Status | Purpose |
|----------|--------|---------|
| `http://localhost:8080/health` | ✅ 200 OK | Health check |
| `http://localhost:8080/docs` | ✅ 200 OK | OpenAPI docs (Swagger UI) |
| `http://localhost:8080/v2/activities/templates` | ⚠️ 401 Unauthorized | List activity templates (requires auth) |

### Database State

```
Activities: 15
Variants: 44  
API Keys: 0 (none configured)
Projects: Unknown (table may not exist yet)
```

**Note**: The 44 variants indicate A/B testing is configured (multiple variants per activity for optimization).

---

## Client Application Analysis

### 1. metabob-cli

**Current Configuration**:
```python
# repos/metabob-cli/src/metabob_cli/core/config.py (line 54)
base_url: str = "https://ide.metabob.com"  # ❌ Wrong URL

# Local config (repos/metabob-opencode/.metabob/config.json)
{
  "base_url": "http://host.docker.internal:8080",  # ⚠️ Docker-specific
  "api_key": "mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ"
}
```

**Environment Variable Overrides**:
- `METABOB_BASE_URL` - Override base URL
- `METABOB_API_URL` - Alternative API URL  
- `METABOB_MCP_URL` - MCP server URL (default: http://localhost:8000)
- `METABOB_API_KEY` - API key for authentication

**Issue**: CLI defaults to `ide.metabob.com` which is a remote service, not the local production backend.

### 2. metabob-opencode

**Current Configuration**:
```typescript
// repos/metabob-opencode/packages/opencode/src/config/schemas/metabob.ts (line 50)
base_url: z.string().default("https://ide.metabob.com")  // ❌ Wrong URL

// Local configs found:
repos/metabob-opencode/.metabob/config.json:
  → "base_url": "http://host.docker.internal:8080"

repos/metabob-opencode/packages/opencode/.metabob/config.json:
  → "base_url": "http://localhost:8080"
```

**Issue**: 
- Default schema points to `ide.metabob.com`
- Multiple config files with conflicting URLs
- `host.docker.internal` only works inside Docker containers

### 3. MCP Integration

metabob-opencode integrates with metabob-cli via **Model Context Protocol (MCP)**:

```
metabob-opencode (MCP client)
       ↓
metabob-cli (MCP server at localhost:8000)
       ↓  
metabob-rpc-api (Backend at localhost:8080)
       ↓
SurrealDB (Database at localhost:8000)
```

**Configuration Chain**:
1. opencode.json contains `mcp.metabob` section
2. Points to metabob-cli MCP server
3. metabob-cli forwards requests to backend API
4. Backend queries SurrealDB for templates

---

## Critical Issues

### 🔴 Issue 1: API Authentication Not Configured

**Problem**: No API keys exist in database

**Impact**: All `/v2/activities/*` endpoints return 401 Unauthorized

**Test**:
```bash
curl http://localhost:8080/v2/activities/templates
# Returns: {"error": "Authentication required. Provide Authorization: Bearer <token>"}

curl -H "Authorization: Bearer mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ" \
     http://localhost:8080/v2/activities/templates
# Returns: {"error": "Invalid or expired session token"}
```

**Root Cause**: 
- API key found in config files (`mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ`)
- Key does NOT exist in `api_keys` table in database
- Query result: `SELECT count() FROM api_keys WHERE active = true → 0`

**Solution**: Register API keys in database (see remediation plan below)

### 🟡 Issue 2: Client Configuration Mismatch

**Problem**: Applications point to wrong backend URLs

**Impact**: Clients cannot reach local production backend with registered templates

**Current State**:
- metabob-cli → `https://ide.metabob.com` (remote service)
- metabob-opencode → `https://ide.metabob.com` (remote service)
- Some local configs → `http://localhost:8080` ✅ (correct but not used by default)

**Solution**: Update configurations (see remediation plan below)

### 🟢 Issue 3: Inconsistent Configuration Files

**Problem**: Multiple `.metabob/config.json` files with different values

**Impact**: Confusion about which backend is being used

**Files Found**:
```
repos/metabob-opencode/.metabob/config.json
  → base_url: "http://host.docker.internal:8080" (Docker-specific)

repos/metabob-opencode/packages/opencode/.metabob/config.json
  → base_url: "http://localhost:8080" (correct for localhost)
```

**Solution**: Consolidate to single source of truth (see remediation plan below)

---

## Remediation Plan

### Step 1: Create API Key in Database ⚡ HIGH PRIORITY

**Option A: Use Existing Key from Config**

Run this script to register the API key found in config files:

```python
#!/usr/bin/env python3
import asyncio, sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd() / "repos" / "metabob-rpc-api"))
from server.config import Settings
from server.utils.surreal_client import SurrealDBClient

async def create_api_key():
    config = Settings(
        SURREAL_URL="ws://localhost:8000",
        SURREAL_USER="root",
        SURREAL_PASS="root",
        SURREAL_NAMESPACE="metabob",
        SURREAL_DATABASE="metabob"
    )
    
    db = SurrealDBClient(config)
    await db.connect()
    
    # Create API key record
    api_key = "mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ"
    
    result = await db.query("""
        CREATE api_keys CONTENT {
            key: $key,
            org_id: 'devbob',
            active: true,
            created_at: time::now(),
            expires_at: time::from::secs(time::unix() + 31536000)
        }
    """, {"key": api_key})
    
    print(f"✅ API key created: {api_key[:30]}...")
    print(f"   Organization: devbob")
    print(f"   Expires: 1 year from now")
    
    await db.disconnect()

asyncio.run(create_api_key())
```

**Option B: Generate New API Key**

```bash
# Generate secure API key
python3 -c "import secrets; print('mb_' + secrets.token_urlsafe(32))"

# Add to database using Option A script above
```

### Step 2: Update Client Configurations

**metabob-cli Configuration**:

```bash
# Option 1: Environment variables (recommended for development)
export METABOB_BASE_URL="http://localhost:8080"
export METABOB_API_KEY="mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ"

# Option 2: Update local config file
cat > repos/metabob-cli/.metabob/config.json << JSON
{
  "base_url": "http://localhost:8080",
  "api_key": "mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ",
  "state_directory": ".metabob",
  "watch_files": true,
  "batch_size": 5
}
JSON
```

**metabob-opencode Configuration**:

```bash
# Update main config (used by packages/opencode)
cat > repos/metabob-opencode/.metabob/config.json << JSON
{
  "base_url": "http://localhost:8080",
  "api_key": "mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ",
  "state_directory": ".metabob"
}
JSON

# Update package-level config (if used)
cat > repos/metabob-opencode/packages/opencode/.metabob/config.json << JSON
{
  "base_url": "http://localhost:8080",
  "state_directory": ".metabob"
}
JSON
```

### Step 3: Verify End-to-End Integration

```bash
# 1. Test backend health
curl http://localhost:8080/health
# Expected: {"status":"ok","timestamp":"...","version":"0.16.0"}

# 2. Test template list (with authentication)
curl -H "Authorization: Bearer mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ" \
     http://localhost:8080/v2/activities/templates | jq '.templates | length'
# Expected: 15 (or number of registered activities)

# 3. Test metabob-cli
cd repos/metabob-cli
python -m metabob_cli --help
# Should show CLI commands without errors

# 4. Test metabob-opencode MCP integration  
cd repos/metabob-opencode/packages/opencode
npm test -- --grep "metabob.*mcp" || echo "MCP tests may need setup"
```

### Step 4: Validate Template Access

```python
#!/usr/bin/env python3
# validate_template_access.py

import requests

BASE_URL = "http://localhost:8080"
API_KEY = "mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ"

headers = {"Authorization": f"Bearer {API_KEY}"}

# Test 1: List templates
response = requests.get(f"{BASE_URL}/v2/activities/templates", headers=headers)
print(f"Template List: {response.status_code}")
if response.status_code == 200:
    templates = response.json().get('templates', [])
    print(f"  Found {len(templates)} templates")
    for tmpl in templates[:3]:
        print(f"    - {tmpl.get('id')}: {tmpl.get('name')}")
else:
    print(f"  Error: {response.text}")

# Test 2: Get specific template
if response.status_code == 200 and templates:
    template_id = templates[0]['id']
    response = requests.get(
        f"{BASE_URL}/v2/activities/templates/{template_id}", 
        headers=headers
    )
    print(f"\nTemplate Detail: {response.status_code}")
    if response.status_code == 200:
        print(f"  Template: {response.json().get('name')}")
```

---

## Success Criteria

- [x] Backend is running and accessible
- [x] Database contains templates (15 activities, 44 variants)
- [ ] API keys are registered in database
- [ ] metabob-cli can list templates
- [ ] metabob-opencode MCP integration works
- [ ] End-to-end activity execution completes

---

## Architecture Reference

### Template Registration Flow (Completed ✅)

```
scripts/register_bootstrap_prod.py
  ↓
metabob-rpc-api /v2/activities/register endpoint
  ↓
SurrealDB: activities table (15 records)
SurrealDB: activity_variants table (44 records)
```

### Client → Backend → Database Flow (Needs Configuration ⚠️)

```
metabob-opencode (User)
  ↓ MCP protocol
metabob-cli (MCP Server)
  ↓ HTTP + API key
metabob-rpc-api (Backend API)
  ↓ WebSocket
SurrealDB (Database)
```

**Current Blocker**: API key not in database (Step 1 of remediation plan)

---

## Next Actions

1. **IMMEDIATE**: Run Step 1 script to create API key in database
2. **QUICK WIN**: Update client configs (Step 2) using environment variables
3. **VALIDATION**: Run Step 3 verification commands
4. **OPTIONAL**: Consolidate config files to remove duplicates

**Estimated Time**: 15-30 minutes

---

## Additional Notes

### Docker Compose vs Kubernetes

- Previous session summary mentioned Kubernetes (`kubectl` commands)
- **Actual deployment**: Docker Compose (verified via `docker ps`)
- All `kubectl` commands timeout - they don't apply to this environment
- Use `docker exec api-server-dev` instead of `kubectl exec`

### Database Naming

- Previous summary said `production` database
- **Actual database**: `metabob` database
- Confirmed via backend environment: `SURREAL_DATABASE=metabob`

### Template System Status

From previous session:
- Template Inheritance: IMPLEMENTED ✅
- Template Registration: COMPLETE ✅
- Database Bootstrap: COMPLETE ✅

**Current session focus**: Ensure applications can ACCESS the registered templates

---

## References

- Backend Integration Verification Plan: `BACKEND_INTEGRATION_VERIFICATION.md`
- Previous Session Summary: (provided at session start)
- Backend Config: `repos/metabob-rpc-api/server/config.py`
- CLI Config: `repos/metabob-cli/src/metabob_cli/core/config.py`
- OpenCode Config: `repos/metabob-opencode/packages/opencode/src/config/schemas/metabob.ts`

