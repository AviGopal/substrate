# API Cleanup Plan: Clean v2 Interface

## Current State Analysis

### Consumers & Their Needs

#### 1. **metabob-cli (MCP Server)**
**Purpose**: Provide activity templates to OpenCode agents

**Current Endpoints Used**:
- `POST /activity-recommendations/recommendations` - Search activities
- `GET /activity-recommendations/variants/{id}/details` - Get activity details
- `POST /activity-recommendations/selections` - Record selection
- `POST /activity-recommendations/conversions` - Record outcome
- `POST /activity-recommendations/variants` - Create template
- `POST /activity-recommendations/variants/{id}/derive` - Derive template
- `GET /activity-recommendations/variants/{id}/lineage` - Get lineage

**What metabob-cli ACTUALLY needs**:
- ✅ Search/list activity templates
- ✅ Get template details (with tasks/steps)
- ✅ Create new templates
- ✅ Derive from existing templates
- ✅ Get template lineage
- ❌ Thompson Sampling (not CLI's concern)
- ❌ CTR/conversion tracking (not CLI's concern)
- ❌ Impression/selection phase (not CLI's concern)

#### 2. **Dashboard (Web UI)**
**Purpose**: Visualize activity performance, manage sessions

**Current Endpoints**:
- Various `/activities/*` endpoints for logging
- `/session` endpoints for auth
- `/auth/*` endpoints

**Needs**:
- Session management
- Activity performance metrics (future)
- User/org/project management

#### 3. **Backend Internal**
**Purpose**: Template learning, A/B testing, optimization

**What backend needs**:
- Template variant management
- Performance tracking
- A/B testing infrastructure
- Thompson Sampling for recommendations

---

## Problem: Over-Engineered Interface

The `/activity-recommendations/*` API exposes:
- **Advertising funnel** (impression → selection → conversion)
- **CTR optimization** (Thompson Sampling, multi-armed bandits)
- **A/B testing** (variant experiments)
- **Consumer tracking** (agent behavior analytics)

**None of this complexity is needed by metabob-cli!**

metabob-cli just wants:
1. "Give me activity templates that match this query"
2. "Give me the full details of this template"
3. "Save this new template I created"

---

## Proposed Clean v2 API

### **Principle**: Simple CRUD for templates, internal complexity hidden

### New Structure

```
/v2/
  /session          - Session management (auth)
  /activities/
    /templates      - Template CRUD (what metabob-cli needs)
    /executions     - Execution tracking (already in proto_activities.py)
```

### Endpoint Design

#### **Session Management** (`/v2/session`)

```
POST   /v2/session              - Create session (current: /session)
GET    /v2/session              - Get current session (current: /session)
DELETE /v2/session              - Delete session (current: /session)
```

**Auth**: 
- Accepts `X-Internal-Request: true` for agent-to-agent
- Accepts `Authorization: Bearer <token>` for dashboard
- Accepts `X-API-Key: <key>` for CLI with API key

#### **Activity Templates** (`/v2/activities/templates`)

```
GET    /v2/activities/templates              - List/search templates
POST   /v2/activities/templates              - Create new template
GET    /v2/activities/templates/{id}         - Get template details
PUT    /v2/activities/templates/{id}         - Update template
DELETE /v2/activities/templates/{id}         - Delete template
POST   /v2/activities/templates/{id}/derive  - Derive new template from parent
GET    /v2/activities/templates/{id}/lineage - Get template ancestry
```

**Query Parameters for LIST**:
- `?query=<text>` - Search by name/description
- `?category=<feature|bugfix|refactor|tool>` - Filter by category
- `?limit=<int>` - Max results (default: 20)
- `?offset=<int>` - Pagination offset

**Response for LIST**:
```json
{
  "templates": [
    {
      "id": "feature-impl-v1",
      "name": "Feature Implementation",
      "description": "Implement a new feature following conventions",
      "category": "feature",
      "task_count": 5,
      "context_requirements": [
        {"type": "codebase_context", "required": true},
        {"type": "user_requirements", "required": true}
      ],
      "variables": {
        "feature_name": {"type": "string", "required": true},
        "feature_description": {"type": "string", "required": true}
      },
      "created_at": "2026-02-07T12:00:00Z",
      "updated_at": "2026-02-07T12:00:00Z"
    }
  ],
  "total": 8,
  "limit": 20,
  "offset": 0
}
```

**Response for GET**:
```json
{
  "id": "feature-impl-v1",
  "name": "Feature Implementation",
  "description": "Implement a new feature following conventions",
  "category": "feature",
  "tasks": [
    {
      "order": 1,
      "type": "agent_task",
      "agent_mode": "implementation",
      "prompt_template": "Implement {{feature_name}} with description: {{feature_description}}",
      "validation": {
        "type": "test_execution",
        "required": true
      }
    }
  ],
  "context_requirements": [...],
  "variables": {...},
  "parent_id": null,
  "lineage": [],
  "metrics": {
    "executions": 15,
    "success_rate": 0.87,
    "avg_duration_ms": 180000,
    "avg_cost": 0.25
  }
}
```

**Hidden from CLI**:
- Thompson Sampling scores
- CTR predictions
- Impression/selection IDs
- A/B experiment assignments
- Consumer tracking data

**Backend Implementation**:
- Template storage in SurrealDB
- List/search queries templates table
- Learning system runs in background, updates `metrics` field
- A/B testing happens transparently (backend selects variant)
- CLI gets "best variant" without knowing it's an experiment

---

## Migration Plan

### Phase 1: Create Clean v2 Routes (New File)

Create `server/routes/v2_activities.py`:

```python
"""
Clean v2 Activity Template API

Provides simple CRUD interface for activity templates.
Hides internal complexity (Thompson Sampling, A/B testing, CTR optimization).
"""

router = APIRouter(prefix="/v2/activities/templates", tags=["activities-v2"])

@router.get("")
async def list_templates(
    query: str = "",
    category: str = Query(None, regex="^(feature|bugfix|refactor|tool)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    request: Request = None,
    db: SurrealDBClient = Depends(get_surreal_connection),
) -> dict:
    """List/search activity templates (simple, no ML complexity)"""
    # Auth: Support X-Internal-Request or session
    auth = await get_session_or_internal(request, db)
    
    # Backend: Query templates table
    # Background: Learning system updates metrics asynchronously
    # Return: Simple list of templates with basic metrics
    
    templates = await db.query("""
        SELECT id, name, description, category, task_count,
               context_requirements, variables, metrics
        FROM activity_templates
        WHERE (name CONTAINS $query OR description CONTAINS $query)
          AND ($category IS NULL OR category = $category)
        ORDER BY metrics.success_rate DESC
        LIMIT $limit START $offset
    """, {"query": query, "category": category, "limit": limit, "offset": offset})
    
    return {
        "templates": templates,
        "total": len(templates),
        "limit": limit,
        "offset": offset,
    }

@router.get("/{template_id}")
async def get_template(
    template_id: str,
    request: Request,
    db: SurrealDBClient = Depends(get_surreal_connection),
) -> dict:
    """Get full template details including tasks"""
    auth = await get_session_or_internal(request, db)
    
    # Backend selects best variant transparently
    template = await _get_best_variant(db, template_id)
    
    if not template:
        raise HTTPException(404, "Template not found")
    
    return template

@router.post("")
async def create_template(
    template_data: dict,
    request: Request,
    db: SurrealDBClient = Depends(get_surreal_connection),
) -> dict:
    """Create new template"""
    auth = await get_session_or_internal(request, db)
    
    # Validate and create
    template = await db.create("activity_templates", template_data)
    
    # Background: Initialize in learning system
    await _init_learning_system(template["id"])
    
    return template

# ... other endpoints
```

### Phase 2: Create v2 Session Routes

Create `server/routes/v2_session.py`:

```python
"""Clean v2 Session API"""

router = APIRouter(prefix="/v2/session", tags=["session-v2"])

@router.post("")
async def create_session(...):
    """Create session (supports X-Internal-Request)"""
    # Same logic as /session but with v2 response format
    
@router.get("")
async def get_session(...):
    """Get current session"""
    
@router.delete("")
async def delete_session(...):
    """Delete session"""
```

### Phase 3: Update metabob-cli to Use v2

Update `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`:

```python
async def search_activities(...) -> list[dict]:
    """Search for activity templates (v2 API)"""
    client = await self._get_client()
    
    # Use clean v2 endpoint
    response = await client.get(
        "/v2/activities/templates",
        params={
            "query": query,
            "category": category,
            "limit": limit,
        },
    )
    
    if response.status_code == 200:
        data = response.json()
        return data["templates"]
    
    return []

async def get_activity(self, activity_id: str) -> Optional[dict]:
    """Get full template details (v2 API)"""
    client = await self._get_client()
    
    response = await client.get(f"/v2/activities/templates/{activity_id}")
    
    if response.status_code == 200:
        return response.json()
    
    return None

# Remove all:
# - /activity-recommendations/* calls
# - impression/selection/conversion tracking
# - Thompson Sampling client-side logic
```

### Phase 4: Keep Backend Learning Internal

The backend STILL does all the smart stuff, but internally:

```python
# server/services/activity_learning.py

class ActivityLearningService:
    """Internal service for template optimization (not exposed to CLI)"""
    
    async def get_best_variant(self, template_id: str) -> dict:
        """
        Use Thompson Sampling to select best variant.
        CLI calls /v2/activities/templates/{id}, backend uses this internally.
        """
        # Thompson Sampling happens here
        # A/B testing happens here  
        # Variant selection happens here
        # CLI just gets "the template" (doesn't know it's an experiment)
        
    async def record_execution_outcome(self, template_id: str, success: bool, ...):
        """
        Record execution result for learning.
        Called internally when execution completes.
        """
        # Update CTR, conversion, quality metrics
        # Update Thompson Sampling priors
        # Adjust variant scores
        
    async def background_learning_loop(self):
        """Periodic job to update template metrics"""
        # Calculate success rates
        # Update expected values
        # Prune underperforming variants
```

### Phase 5: Deprecate Old Routes

1. Add deprecation warnings to `/activity-recommendations/*`
2. Keep old routes for 1 release cycle (backward compat)
3. Remove in next major version

---

## Benefits

### For metabob-cli
✅ **Simple interface**: Just CRUD operations on templates
✅ **No ML complexity**: Thompson Sampling hidden in backend
✅ **Cleaner code**: Remove 500+ lines of tracking logic
✅ **Faster**: No extra roundtrips for impression/selection

### For Backend
✅ **Same intelligence**: Learning system still works, just internal
✅ **Better separation**: API layer vs intelligence layer
✅ **Easier testing**: Template CRUD is simple, learning is isolated
✅ **Flexible**: Can change learning algorithm without breaking CLI

### For Future
✅ **Dashboard can add metrics UI**: `/v2/activities/metrics` endpoint later
✅ **API versioning**: Old `/activity-recommendations` deprecated cleanly
✅ **OpenAPI docs**: Clean, understandable API surface

---

## Implementation Checklist

### Step 1: Backend Routes
- [ ] Create `server/routes/v2_session.py`
- [ ] Create `server/routes/v2_activities.py`
- [ ] Add `get_session_or_internal()` auth helper
- [ ] Implement template LIST endpoint
- [ ] Implement template GET endpoint (with variant selection)
- [ ] Implement template POST/PUT/DELETE endpoints
- [ ] Implement template DERIVE and LINEAGE endpoints
- [ ] Register routers in `server/app.py`

### Step 2: Backend Services
- [ ] Create `server/services/activity_learning.py`
- [ ] Move Thompson Sampling logic from routes to service
- [ ] Move variant selection to service
- [ ] Create background job for metric updates
- [ ] Add execution outcome recording (internal)

### Step 3: metabob-cli Migration
- [ ] Update `ActivityManager.search_activities()` to use v2
- [ ] Update `ActivityManager.get_activity()` to use v2
- [ ] Update `ActivityManager.create_template()` to use v2
- [ ] Remove impression/selection/conversion tracking
- [ ] Remove Thompson Sampling client code
- [ ] Test with OpenCode

### Step 4: Testing & Validation
- [ ] Test template search works
- [ ] Test template details load correctly
- [ ] Test template creation
- [ ] Test learning system still updates metrics
- [ ] Test A/B testing still works (transparently)
- [ ] Test auth works (X-Internal-Request and Bearer)

### Step 5: Deprecation
- [ ] Add deprecation headers to old `/activity-recommendations/*`
- [ ] Update API docs
- [ ] Keep old routes for 1 release
- [ ] Remove in v3.0

---

## File Changes Summary

### New Files
- `repos/metabob-rpc-api/server/routes/v2_session.py`
- `repos/metabob-rpc-api/server/routes/v2_activities.py`
- `repos/metabob-rpc-api/server/services/activity_learning.py`

### Modified Files
- `repos/metabob-rpc-api/server/routes/__init__.py` - Add v2 routers
- `repos/metabob-rpc-api/server/app.py` - Register v2 routers
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` - Use v2 API
- `repos/metabob-cli/src/metabob_cli/mcp/tools.py` - Update tool descriptions

### Deprecated Files (Keep for 1 release)
- `repos/metabob-rpc-api/server/routes/activity_recommendations.py`

### Eventually Removed
- All `/activity-recommendations/*` endpoints (after migration)

---

## Success Criteria

1. ✅ metabob-cli can search/get/create templates via clean v2 API
2. ✅ Backend learning system continues optimizing templates
3. ✅ CLI code is 500+ lines shorter
4. ✅ API is documented and understandable
5. ✅ Auth works for both agents (X-Internal-Request) and dashboard (Bearer)
6. ✅ No breaking changes for existing OpenCode sessions
7. ✅ Migration path is clear and tested

---

## Timeline

- **Week 1**: Implement v2 backend routes + services
- **Week 2**: Migrate metabob-cli to v2
- **Week 3**: Test with OpenCode, fix issues
- **Week 4**: Deprecate old routes, update docs
- **Future**: Remove old routes in next major version
