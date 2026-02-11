# Next Steps: Integrate metabob-cli with V2 API

## Current Status

✅ **Backend (metabob-rpc-api)**: V2 API deployed and operational
- All v2 endpoints registered and responding
- Proto-compliant JSON format implemented
- No import errors, server stable

⏳ **Frontend (metabob-cli)**: Needs updates to use v2 API
- Currently using old `/activity-recommendations/*` endpoints
- Needs to switch to `/v2/activities/templates` endpoints
- Needs to parse new proto JSON format

## Priority 1: Update metabob-cli Session Management

### Current Implementation
File: `repos/metabob-cli/src/metabob_cli/core/session_manager.py`

**Problem**: Expects `session_token` at root level
```python
# Current code (WRONG for v2):
session_token = response.get("session_token")
```

**New v2 Format**: Token is in `metadata.session_token`
```json
{
  "session_id": "org:project:uuid",
  "session_type": "SESSION_TYPE_AUTHENTICATED",
  "metadata": {
    "session_token": "eyJ..."  // <-- Token is here now!
  }
}
```

**Fix Needed**:
```python
# New code (CORRECT for v2):
metadata = response.get("metadata", {})
session_token = metadata.get("session_token")
```

### Files to Update
1. `repos/metabob-cli/src/metabob_cli/core/session_manager.py`
   - Update `create_session()` method
   - Update token extraction logic
   - Test with v2 endpoint

## Priority 2: Update metabob-cli Activity Manager

### Current Implementation
File: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

**Problem**: Uses old `/activity-recommendations/*` endpoints

**Current Endpoints**:
- `POST /activity-recommendations/recommendations` → Search activities
- `GET /activity-recommendations/variants/{id}/details` → Get details
- `POST /activity-recommendations/selections` → Record selection
- `POST /activity-recommendations/conversions` → Record outcome

**New v2 Endpoints**:
- `GET /v2/activities/templates?query=...&category=...` → Search activities
- `GET /v2/activities/templates/{id}` → Get details
- `POST /v2/activities/record/start` → Start execution
- `POST /v2/activities/record/complete` → Record outcome

### Migration Plan

#### Step 1: Update `search_activities()`
```python
# OLD (remove):
async def search_activities(self, query: str, category: str = None) -> list:
    response = await self.client.post(
        "/activity-recommendations/recommendations",
        json={"query": query, "category": category}
    )
    return response.json().get("recommendations", [])

# NEW (implement):
async def search_activities(self, query: str, category: str = None, limit: int = 20) -> list:
    params = {"query": query, "limit": limit}
    if category:
        params["category"] = category
    
    response = await self.client.get(
        "/v2/activities/templates",
        params=params
    )
    
    if response.status_code == 200:
        data = response.json()
        return data.get("templates", [])
    
    return []
```

#### Step 2: Update `get_activity()`
```python
# OLD (remove):
async def get_activity(self, activity_id: str) -> dict | None:
    response = await self.client.get(
        f"/activity-recommendations/variants/{activity_id}/details"
    )
    return response.json() if response.status_code == 200 else None

# NEW (implement):
async def get_activity(self, activity_id: str) -> dict | None:
    response = await self.client.get(
        f"/v2/activities/templates/{activity_id}"
    )
    return response.json() if response.status_code == 200 else None
```

#### Step 3: Update `create_template()`
```python
# NEW (add):
async def create_template(self, template_data: dict) -> dict | None:
    response = await self.client.post(
        "/v2/activities/templates",
        json=template_data
    )
    return response.json() if response.status_code == 201 else None
```

#### Step 4: Remove Old Tracking Methods
```python
# REMOVE (no longer needed in v2):
async def record_impression(...)  # Backend handles internally
async def record_selection(...)   # Backend handles internally
async def record_conversion(...)  # Use record_execution_complete() instead
```

#### Step 5: Add New Execution Tracking
```python
# NEW (add):
async def record_execution_start(
    self, 
    template_id: str, 
    variables: dict,
    session_id: str,
    execution_id: str
) -> dict:
    response = await self.client.post(
        "/v2/activities/record/start",
        json={
            "template_id": template_id,
            "variables": variables,
            "session_id": session_id,
            "execution_id": execution_id
        }
    )
    return response.json()

async def record_execution_complete(
    self,
    execution_id: str,
    success: bool,
    duration_ms: float,
    cost: float,
    tokens: int,
    outcome: str
) -> dict:
    response = await self.client.post(
        "/v2/activities/record/complete",
        json={
            "execution_id": execution_id,
            "success": success,
            "duration_ms": duration_ms,
            "cost": cost,
            "tokens": tokens,
            "outcome": outcome
        }
    )
    return response.json()
```

## Priority 3: Update metabob-opencode MCP Tools

### Current Implementation
File: `repos/metabob-opencode/src/metabob_opencode/mcp/tools/activity.py`

**Problem**: Relies on metabob-cli's old API methods

**Update**: Once metabob-cli is updated, OpenCode MCP tools will automatically use v2 API through the CLI.

**No changes needed** if we update metabob-cli correctly.

## Testing Plan

### Step 1: Test Session Management
```bash
# Create test script
cat > test_v2_session.py << 'PYTHON'
import asyncio
from metabob_cli.core.session_manager import SessionManager

async def test():
    manager = SessionManager(
        api_url="http://localhost:8080",
        api_key="test_key_123"
    )
    
    # Test session creation
    session = await manager.create_session(project_id="test-project")
    print(f"Session: {session}")
    print(f"Token: {session.get('metadata', {}).get('session_token')}")

asyncio.run(test())
PYTHON

# Run test
cd repos/metabob-cli
python test_v2_session.py
```

### Step 2: Test Activity Search
```bash
cat > test_v2_activities.py << 'PYTHON'
import asyncio
from metabob_cli.mcp.activity_manager import ActivityManager

async def test():
    manager = ActivityManager(
        api_url="http://localhost:8080",
        session_token="valid_token_here"
    )
    
    # Test search
    results = await manager.search_activities(
        query="REST endpoint",
        category="feature"
    )
    print(f"Found {len(results)} templates")
    
    # Test get details
    if results:
        details = await manager.get_activity(results[0]["variant_id"])
        print(f"Template: {details['variant_name']}")

asyncio.run(test())
PYTHON

cd repos/metabob-cli
python test_v2_activities.py
```

### Step 3: Integration Test with OpenCode
```bash
# Start OpenCode with MCP server
cd repos/metabob-opencode
opencode mcp

# In another terminal, test MCP tools
opencode chat
> List available activity templates for adding a REST endpoint
```

## Implementation Checklist

### Session Management
- [ ] Update `session_manager.py` to extract `metadata.session_token`
- [ ] Update endpoint URL from `/session` to `/v2/session`
- [ ] Test session creation with valid API key
- [ ] Test session refresh
- [ ] Verify token extraction works

### Activity Management
- [ ] Update `search_activities()` to use `/v2/activities/templates`
- [ ] Update `get_activity()` to use `/v2/activities/templates/{id}`
- [ ] Add `create_template()` method
- [ ] Add `record_execution_start()` method
- [ ] Add `record_execution_complete()` method
- [ ] Remove old impression/selection/conversion methods
- [ ] Test search with various queries
- [ ] Test template retrieval

### MCP Tools (metabob-opencode)
- [ ] Verify tools work with updated CLI
- [ ] Test `search_activities` MCP tool
- [ ] Test `get_activity` MCP tool
- [ ] Test activity execution via OpenCode

### Documentation
- [ ] Update CLI README with v2 API usage
- [ ] Add migration guide for v2 API
- [ ] Document new proto JSON format
- [ ] Add examples of v2 API responses

## Timeline Estimate

**Phase 1: Session Management (30 min)**
- Update session_manager.py
- Test with v2 endpoint
- Verify token extraction

**Phase 2: Activity Manager (1-2 hours)**
- Update all activity methods
- Remove old tracking code
- Add new execution tracking
- Test each method

**Phase 3: Integration Testing (30 min)**
- Test with OpenCode
- Verify MCP tools work
- End-to-end activity execution test

**Total: 2-3 hours**

## Success Criteria

✅ metabob-cli successfully creates sessions using `/v2/session`
✅ metabob-cli can search activity templates using `/v2/activities/templates`
✅ metabob-cli can retrieve template details
✅ OpenCode MCP tools work with updated CLI
✅ Activity execution tracking works end-to-end
✅ No references to old `/activity-recommendations/*` endpoints

## Current Task

**Let's start with Priority 1: Update Session Management**

Would you like me to:
1. Update `session_manager.py` to use v2 API?
2. Create test scripts to verify it works?
3. Then move on to Activity Manager updates?

