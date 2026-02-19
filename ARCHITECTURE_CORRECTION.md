# Architecture Correction: Backend vs Local Cache

**Date**: 2026-02-19  
**Status**: ⚠️ CRITICAL CORRECTION

## The Mistake

In previous documentation (BACKEND_FIRST_TEMPLATE_ARCHITECTURE.md, etc.), I incorrectly identified:

```
❌ WRONG: ~/.metabob/activities/ = "Backend storage"
❌ WRONG: metabob-cli = "Backend"
```

## The Correct Architecture

```
✅ CORRECT: metabob-rpc-api (api-server-dev) = Backend (source of truth)
✅ CORRECT: metabob-cli = Client that queries the API  
✅ CORRECT: ~/.metabob/activities/ = Local cache (NOT backend)
```

### Actual Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CORRECT ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────┘

1. BACKEND (Source of Truth):
   ┌──────────────────────────────────────┐
   │  metabob-rpc-api (api-server-dev)    │
   │  - Container: api-server-dev:8080    │
   │  - Proto-based API (v2)              │
   │  - Stores activity variants          │
   │  - Serves to all clients             │
   └──────────┬───────────────────────────┘
              │
              ▼
2. CLIENT (Queries Backend):
   ┌──────────────────────────────────────┐
   │  metabob-cli                         │
   │  - ActivityManager class             │
   │  - Connects to API via HTTP          │
   │  - Authenticates with session token  │
   │  - Queries: GET /v2/activities       │
   └──────────┬───────────────────────────┘
              │
              ▼
3. LOCAL CACHE (Optional Performance Layer):
   ┌──────────────────────────────────────┐
   │  ~/.metabob/activities/*.json        │
   │  - Local JSON files                  │
   │  - NOT the source of truth           │
   │  - May be stale or missing           │
   │  - Should be synced from API         │
   └──────────────────────────────────────┘
```

## What I Got Wrong

### Documentation Issues

1. **BACKEND_FIRST_TEMPLATE_ARCHITECTURE.md**
   - Incorrectly said: "metabob-cli Backend Storage: `~/.metabob/activities/`"
   - Should say: "metabob-rpc-api Backend API: `http://api-server-dev:8080/v2/activities`"

2. **CREATE_ACTIVITY_TEMPLATE_IMPROVEMENTS.md**
   - Incorrectly said: "Backend: metabob-cli MCP"
   - Should say: "Backend: metabob-rpc-api (queried via metabob-cli)"

3. **TEMPLATE_CREATION_NO_GIT_STATE_SUMMARY.md**
   - Incorrectly said: "Template stored in backend (`~/.metabob/activities/`)"
   - Should say: "Template stored in backend (metabob-rpc-api) and cached locally"

4. **ACTIVITY_SYSTEM_TEST_SUCCESS.md**
   - Incorrectly identified "Backend storage: `/root/.metabob/activities/`"
   - Should identify "Local cache: `/root/.metabob/activities/`"

### Code Understanding Issues

I was looking at `activity_templates.py` which manages LOCAL cache, not the backend API.

The actual backend interaction is in `activity_manager.py`:
```python
class ActivityManager:
    """
    Manages activity specifications and executions.
    
    All activity specs come through this manager via the backend API.
    """
    
    def __init__(self, base_url: str, session_token: str = ""):
        self.base_url = base_url.rstrip("/")  # http://api-server-dev:8080
```

## How It Actually Works

### Template Registration (Correct Flow)

```
1. Agent creates template definition
2. Calls metabob_register_activity_template MCP tool
3. Tool sends to metabob-cli ActivityManager
4. ActivityManager posts to metabob-rpc-API:
   POST /v2/activities/variants
   {
     "activity_id": "my-template",
     "task_steps": [...],
     ...
   }
5. API stores in database (source of truth)
6. Optional: Local cache updated at ~/.metabob/activities/
```

### Template Discovery (Correct Flow)

```
1. Agent calls search_activities
2. OpenCode queries metabob-cli MCP
3. metabob-cli ActivityManager queries API:
   GET /v2/activities?category=infrastructure
4. API returns variants from database
5. Optional: Results cached locally
6. Results returned to agent
```

### Template Execution (Correct Flow)

```
1. Agent calls activity tool with templateId
2. Activity executor queries metabob-cli
3. ActivityManager fetches from API:
   GET /v2/activities/variants/{variant_id}
4. API returns full activity spec
5. Executor runs tasks
6. Results reported back to API:
   POST /v2/activities/executions/{execution_id}/results
```

## Environment Configuration

### devbob-clean Container

```bash
$ docker exec devbob-clean env | grep METABOB
METABOB_API_URL=http://api-server-dev:8080
METABOB_PROJECT_ID=devbob-test
METABOB_API_KEY=mb_devbob_test_simple_2026_v2
```

**Correct Understanding**:
- `METABOB_API_URL` = Backend API server (source of truth)
- metabob-cli connects to THIS URL for all activity operations
- Local `.metabob/` directories are just cache

### API Server Container

```bash
$ docker ps --filter name=api-server-dev
api-server-dev: Up 9 hours (healthy)
```

**This is the actual backend** that should be storing activity templates.

## What Needs to be Fixed

### 1. Documentation

All previous docs need clarification:
- Replace "backend storage" with "local cache" when referring to `.metabob/`
- Replace "metabob-cli backend" with "metabob-rpc-api backend"
- Add clear distinction between:
  - **Backend**: metabob-rpc-api (API server, database, source of truth)
  - **Client**: metabob-cli (queries backend, manages local cache)
  - **Cache**: `~/.metabob/activities/` (optional, may be stale)

### 2. Template Registration Flow

The `metabob_register_activity_template` MCP tool should:
1. Accept template JSON
2. POST to metabob-rpc-api: `/v2/activities/variants`
3. NOT just write to local `.metabob/activities/` files
4. Optionally update local cache after successful API registration

### 3. Testing Approach

The previous test (ACTIVITY_SYSTEM_TEST_SUCCESS.md) was incomplete:
- ✅ Proved file isolation works (/tmp)
- ✅ Proved git independence works (no git repo)
- ❌ Did NOT prove backend integration (just used local cache)
- ❌ Did NOT test cross-container template sharing via API

### 4. Hook Implementation

The hooks need to sync with **metabob-rpc-api**, not just local cache:

```typescript
// CORRECT: Query backend API
async function syncTemplatesFromBackend() {
  const apiUrl = config.get('metabob.api_url'); // http://api-server-dev:8080
  const templates = await fetch(`${apiUrl}/v2/activities?project_id=${projectId}`);
  // Update local cache for performance
  await cacheTemplatesLocally(templates);
}

// WRONG: Only read from local cache
async function syncTemplatesFromBackend() {
  const templates = await readdir('~/.metabob/activities/'); // ❌ NOT backend!
}
```

## Correct Next Steps

### 1. Verify API Server

```bash
# Check API server is running
docker ps --filter name=api-server

# Check if it has activities endpoint
# (need to use proper tool, curl not available in container)
```

### 2. Test Backend Integration

Need to test that:
1. Template registration actually hits metabob-rpc-api
2. Template discovery queries metabob-rpc-api
3. Templates can be shared across containers via API
4. Local cache is secondary to API

### 3. Update MCP Tools

Verify `metabob_register_activity_template` actually posts to API:
```python
# Check: repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py
# Should have:
async def register_template(self, template: dict) -> str:
    # POST to API, not just write to local file
    response = await client.post(
        f"{self.base_url}/v2/activities/variants",
        json=template
    )
```

### 4. Correct Documentation

Create updated versions of:
- BACKEND_FIRST_TEMPLATE_ARCHITECTURE.md (with API as backend)
- Activity system test (proving API integration, not just local cache)
- Implementation guide (showing correct registration flow)

## Summary

**The Key Mistake**: Treating local JSON cache as "backend storage"

**The Reality**: 
- metabob-rpc-api (api-server-dev:8080) = Backend
- metabob-cli = Client
- ~/.metabob/activities/ = Local cache

**Impact**: 
- Previous tests only validated local file operations
- Did not prove backend-first architecture
- Templates are not actually shared across containers unless API is used

**Next Actions**:
1. Verify api-server-dev has activities API
2. Test template registration to API
3. Test template discovery from API
4. Test cross-container sharing via API
5. Update all documentation with correct architecture

