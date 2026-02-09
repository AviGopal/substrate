# V2 API Proto Compliance Fix Plan

**Date**: 2026-02-07  
**Status**: 🔧 **FIX REQUIRED**  
**Goal**: Make `/v2/*` API fully proto-compliant with metabob-proto

---

## Situation

We implemented `/v2/session` and `/v2/activities/*` but they are **NOT proto-compliant**. We need to fix them to use metabob-proto message definitions.

**Current State**: Custom Pydantic models, plain JSON ❌  
**Required State**: Proto messages, `application/protobuf+json` ✅

---

## Fix Strategy

### Phase 1: Proto Infrastructure Setup
1. Import proto messages from metabob-proto
2. Add proto serialization helpers (MessageToDict/ParseDict)
3. Add proto response wrapper with correct content-type

### Phase 2: Update v2_session.py
1. Replace Pydantic models with proto Session message
2. Use proto serialization for requests/responses
3. Add all required proto fields (session_type, consumer_id, metadata, timestamps)
4. Set `Content-Type: application/protobuf+json`

### Phase 3: Update v2_activities.py
1. Replace Pydantic models with proto ActivityVariant message
2. Use proto TaskStep for task definitions
3. Add ExecutionConfig, OptimizationConfig, etc.
4. Add Genealogy for lineage tracking
5. Use proto serialization throughout

### Phase 4: Update metabob-cli
1. Handle proto message responses
2. Deserialize proto messages properly
3. Extract fields correctly from proto format

### Phase 5: Testing & Validation
1. Update tests to validate proto format
2. Test proto message serialization/deserialization
3. Verify all proto fields are present
4. Test integration with metabob-opencode

---

## Implementation Details

### 1. Proto Imports Setup

**File**: `server/routes/v2_session.py`

```python
from google.protobuf.json_format import MessageToDict, ParseDict, ParseError
from google.protobuf.timestamp_pb2 import Timestamp
from server.models.proto_adapter import session_pb2  # metabob.session
from fastapi.responses import JSONResponse

def proto_response(proto_msg, status_code: int = 200):
    """Convert proto message to JSON response with correct content type."""
    data = MessageToDict(
        proto_msg,
        including_default_value_fields=False,
        preserving_proto_field_name=True,
        use_integers_for_enums=False,  # Use enum names in JSON
    )
    return JSONResponse(
        content=data,
        status_code=status_code,
        headers={"Content-Type": "application/protobuf+json"},
    )
```

### 2. v2_session.py Proto Compliance

**Before** (Custom JSON):
```python
class SessionResponse(BaseModel):  # ❌ Pydantic
    session_token: str
    session_id: str
    org_id: str
    project_id: str
    user_id: Optional[str]
```

**After** (Proto):
```python
@router.post("", summary="Create session")
async def create_session(
    request: Request,
    body: Optional[dict] = Body(None),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    redis: StrictRedis = Depends(get_redis_connection),
    surreal: SurrealDBClient = Depends(get_surreal_connection),
):
    """Create session - returns proto Session message."""
    
    # Validate API key
    api_key = x_api_key or (body.get("api_key") if body else None)
    if not api_key:
        raise HTTPException(400, "Must provide X-API-Key header or api_key in body")
    
    # Validate API key and get user info
    from server.actions.auth_db import validate_api_key
    api_key_data = await validate_api_key(surreal, api_key)
    if not api_key_data:
        raise HTTPException(401, "Invalid API key")
    
    # Create session
    project_id = (body.get("project_id") if body else "default") or "default"
    (token, session_data) = await create_session_model(
        redis, surreal, api_key=api_key, project_id=project_id, user_id=api_key_data.user_id
    )
    
    # Build proto Session message
    session = session_pb2.Session()
    session.session_id = session_data.session_id
    session.session_type = session_pb2.SESSION_TYPE_AUTHENTICATED  # ✅ Proto enum
    session.consumer_id = f"cli:{api_key_data.user_id}"  # ✅ Required proto field
    session.org_id = session_data.org_id
    session.project_id = session_data.project_id
    
    # Add metadata ✅
    if body and "meta" in body:
        session.metadata.update(body["meta"])
    session.metadata["session_token"] = token  # Include token in metadata
    
    # Add timestamps ✅
    now = Timestamp()
    now.GetCurrentTime()
    session.created_at.CopyFrom(now)
    
    expires = Timestamp()
    expires.FromSeconds(int(now.ToSeconds() + 86400))  # 24 hours
    session.expires_at.CopyFrom(expires)
    
    session.last_activity.CopyFrom(now)
    
    return proto_response(session)  # ✅ Proto response
```

### 3. v2_activities.py Proto Compliance

**File**: `server/routes/v2_activities.py`

```python
from google.protobuf.json_format import MessageToDict, ParseDict
from server.models.proto_adapter import activity_pb2, types_pb2
from google.protobuf.timestamp_pb2 import Timestamp

@router.get("/templates", summary="List activity templates")
async def list_templates(
    query: str = Query("", description="Search query"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    credentials: HTTPAuthorizationCredentials = Security(SESSION_TOKEN),
    redis: StrictRedis = Depends(get_redis_connection),
    db: SurrealDBClient = Depends(get_surreal_connection),
):
    """List activity templates - returns proto ActivityVariant messages."""
    
    session = await get_session_from_token(request, redis, credentials)
    
    # Get variants from backend
    variants = await list_variants(db, limit=limit, offset=offset)
    
    # Convert to proto messages
    proto_variants = []
    for variant_dict in variants:
        proto_variant = activity_pb2.ActivityVariant()
        
        # Identity ✅
        proto_variant.variant_id = variant_dict.get("id", "")
        proto_variant.activity_id = variant_dict.get("activity_id", variant_dict.get("category", ""))
        proto_variant.variant_name = variant_dict.get("name", "")
        proto_variant.description = variant_dict.get("description", "")
        proto_variant.version = variant_dict.get("version", 1)
        
        # Genealogy ✅
        if "genealogy" in variant_dict:
            proto_variant.genealogy.CopyFrom(
                ParseDict(variant_dict["genealogy"], types_pb2.Genealogy())
            )
        else:
            # Default genealogy
            proto_variant.genealogy.content_hash = variant_dict.get("id", "")
            proto_variant.genealogy.creation_method = types_pb2.CREATION_METHOD_MANUAL
        
        # Task steps ✅
        for task_dict in variant_dict.get("tasks", []):
            task_step = proto_variant.task_steps.add()
            task_step.id = task_dict.get("id", f"task-{task_dict.get('order', 0)}")
            task_step.subagent = task_dict.get("agent_mode", "general")
            task_step.description = task_dict.get("prompt_template", "")
            
            # Task prompt ✅
            task_step.prompt.template = task_dict.get("prompt_template", "")
            task_step.prompt.max_tokens = task_dict.get("max_tokens", 8000)
            
            # Task validation ✅
            if "validation" in task_dict:
                val = task_dict["validation"]
                if "required_files" in val:
                    task_step.validation.required_files.extend(val["required_files"])
                if "required_patterns" in val:
                    task_step.validation.required_patterns.extend(val["required_patterns"])
            
            # Task retry ✅
            task_step.retry.max_attempts = 3
            task_step.retry.strategy = "exponential"
            
            # Task metrics ✅
            metrics = variant_dict.get("metrics", {})
            task_step.metrics.success_rate = metrics.get("success_rate", 0.0)
            task_step.metrics.avg_tokens = metrics.get("avg_tokens", 0)
            task_step.metrics.avg_duration = metrics.get("avg_duration_ms", 0)
        
        # Variables ✅
        if "variables" in variant_dict:
            proto_variant.variables.update(variant_dict["variables"])
        
        # Execution config ✅
        if "execution_config" in variant_dict:
            proto_variant.execution_config.CopyFrom(
                ParseDict(variant_dict["execution_config"], activity_pb2.ExecutionConfig())
            )
        
        # Optimization config ✅
        if "optimization_config" in variant_dict:
            proto_variant.optimization_config.CopyFrom(
                ParseDict(variant_dict["optimization_config"], activity_pb2.OptimizationConfig())
            )
        else:
            # Default Thompson Sampling config
            proto_variant.optimization_config.thompson_sampling.enabled = True
            proto_variant.optimization_config.thompson_sampling.initial_alpha = 1.0
            proto_variant.optimization_config.thompson_sampling.initial_beta = 1.0
        
        # Performance expectations ✅
        metrics = variant_dict.get("metrics", {})
        proto_variant.expected_duration_ms = metrics.get("avg_duration_ms", 0)
        proto_variant.expected_cost = metrics.get("avg_cost", 0.0)
        proto_variant.expected_quality_score = metrics.get("success_rate", 0.0)
        
        # Status ✅
        proto_variant.status = types_pb2.ENTITY_STATUS_ACTIVE
        
        # Timestamps ✅
        if "created_at" in variant_dict:
            created = Timestamp()
            created.FromJsonString(variant_dict["created_at"])
            proto_variant.created_at.CopyFrom(created)
        
        proto_variants.append(proto_variant)
    
    # Build response
    response_data = {
        "templates": [MessageToDict(v, preserving_proto_field_name=True) for v in proto_variants],
        "total": len(proto_variants),
        "limit": limit,
        "offset": offset,
    }
    
    return JSONResponse(
        content=response_data,
        headers={"Content-Type": "application/protobuf+json"},
    )
```

### 4. metabob-cli Proto Handling

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

```python
async def search_activities(self, query: str, category: str = None, limit: int = 10):
    """Search for activity templates - handles proto responses."""
    
    response = await self.client.get(
        "/v2/activities/templates",
        headers={"Authorization": f"Bearer {self.session_token}"},
        params={"query": query, "category": category, "limit": limit}
    )
    
    if response.status_code == 200:
        # Response is proto format (application/protobuf+json)
        data = response.json()
        
        # Extract templates from proto response
        templates = data.get("templates", [])
        
        # Templates are already in dict format (proto JSON)
        # Proto fields available:
        # - variant_id, activity_id, variant_name, description
        # - task_steps (array of TaskStep protos)
        # - variables (map), execution_config, optimization_config
        # - genealogy, status, timestamps
        
        return templates
    
    return []

async def get_activity(self, activity_id: str) -> Optional[dict]:
    """Get full template details - handles proto ActivityVariant."""
    
    response = await self.client.get(
        f"/v2/activities/templates/{activity_id}",
        headers={"Authorization": f"Bearer {self.session_token}"}
    )
    
    if response.status_code == 200:
        # Response is proto ActivityVariant message
        template = response.json()
        
        # Proto fields available:
        # - variant_id, activity_id, variant_name, description
        # - task_steps (array with: id, subagent, prompt, validation, retry, metrics)
        # - variables (map<string, string>)
        # - execution_config (with context_requirements, hooks, etc.)
        # - optimization_config (Thompson Sampling config)
        # - genealogy (content_hash, parent_hash, creation_method)
        # - expected_duration_ms, expected_cost, expected_quality_score
        # - status (enum), created_at (timestamp)
        
        return template
    
    return None
```

---

## Proto Field Mapping

### Session Proto → v2/session Response

| Proto Field | Source | Notes |
|------------|--------|-------|
| `session_id` | `session_data.session_id` | ✅ |
| `session_type` | `SESSION_TYPE_AUTHENTICATED` | ✅ Enum |
| `consumer_id` | `f"cli:{user_id}"` | ✅ New |
| `org_id` | `session_data.org_id` | ✅ |
| `project_id` | `session_data.project_id` | ✅ |
| `metadata` | `body.meta + session_token` | ✅ New |
| `created_at` | `Timestamp.GetCurrentTime()` | ✅ New |
| `expires_at` | `created_at + 24h` | ✅ New |
| `last_activity` | `created_at` | ✅ New |

### ActivityVariant Proto → v2/activities Response

| Proto Field | Source | Notes |
|------------|--------|-------|
| `variant_id` | `variant.id` | ✅ |
| `activity_id` | `variant.category` or `activity_id` | ✅ |
| `variant_name` | `variant.name` | ✅ |
| `description` | `variant.description` | ✅ |
| `version` | `variant.version` or `1` | ✅ |
| `genealogy` | `Genealogy proto` | ✅ New |
| `task_steps` | `TaskStep proto array` | ✅ Expanded |
| `variables` | `variant.variables` | ✅ |
| `prompt_strategy` | Default `"guided"` | ✅ New |
| `context_budget_tokens` | Default `10000` | ✅ New |
| `expected_duration_ms` | `metrics.avg_duration_ms` | ✅ |
| `expected_cost` | `metrics.avg_cost` | ✅ |
| `expected_quality_score` | `metrics.success_rate` | ✅ |
| `status` | `ENTITY_STATUS_ACTIVE` | ✅ Enum |
| `created_at` | `Timestamp` | ✅ |
| `execution_config` | `ExecutionConfig proto` | ✅ New |
| `optimization_config` | `OptimizationConfig proto` | ✅ New |

### TaskStep Proto Fields

| Proto Field | Source | Notes |
|------------|--------|-------|
| `id` | `task.id` or generated | ✅ |
| `subagent` | `task.agent_mode` | ✅ |
| `description` | `task.prompt_template` | ✅ |
| `dependencies` | `[]` (default) | ✅ |
| `prompt.template` | `task.prompt_template` | ✅ |
| `prompt.max_tokens` | `8000` (default) | ✅ |
| `validation.required_files` | `task.validation.required_files` | ✅ |
| `validation.required_patterns` | `task.validation.required_patterns` | ✅ |
| `retry.max_attempts` | `3` (default) | ✅ |
| `retry.strategy` | `"exponential"` (default) | ✅ |
| `metrics.success_rate` | `metrics.success_rate` | ✅ |
| `metrics.avg_tokens` | `metrics.avg_tokens` | ✅ |
| `metrics.avg_duration` | `metrics.avg_duration_ms` | ✅ |

---

## Implementation Checklist

### Phase 1: Proto Infrastructure ✅
- [ ] Import proto messages (`session_pb2`, `activity_pb2`, `types_pb2`)
- [ ] Add `proto_response()` helper function
- [ ] Add proto error response helper
- [ ] Import `MessageToDict`, `ParseDict`, `Timestamp`

### Phase 2: v2_session.py Proto Compliance ✅
- [ ] Replace `SessionResponse` Pydantic model with proto `Session`
- [ ] Add `session_type` enum (AUTHENTICATED)
- [ ] Add `consumer_id` field
- [ ] Add `metadata` map (include session_token)
- [ ] Add `created_at`, `expires_at`, `last_activity` timestamps
- [ ] Return `proto_response()` with correct content-type
- [ ] Update all session endpoints (POST, GET, DELETE)

### Phase 3: v2_activities.py Proto Compliance ✅
- [ ] Replace Pydantic models with proto `ActivityVariant`
- [ ] Convert tasks to proto `TaskStep` array
- [ ] Add `genealogy` (Genealogy proto)
- [ ] Add `execution_config` (ExecutionConfig proto)
- [ ] Add `optimization_config` (OptimizationConfig proto)
- [ ] Add `admin_config`, `composition`, `learning` (if needed)
- [ ] Set all enum fields properly (status, session_type)
- [ ] Add timestamps (created_at)
- [ ] Return `proto_response()` for all endpoints
- [ ] Update list, get, create, update, delete, derive endpoints

### Phase 4: metabob-cli Proto Handling ✅
- [ ] Update `activity_manager.py` to parse proto responses
- [ ] Handle proto field names (snake_case)
- [ ] Extract proto nested fields correctly
- [ ] Handle proto enums (strings, not ints)
- [ ] Update error handling for proto error format
- [ ] Test proto message deserialization

### Phase 5: Testing & Validation ✅
- [ ] Update tests to validate proto format
- [ ] Test `Content-Type: application/protobuf+json` header
- [ ] Verify all proto fields are present
- [ ] Test proto enums (use strings, not ints)
- [ ] Test proto timestamps (RFC3339 format)
- [ ] Test proto nested messages (genealogy, execution_config)
- [ ] Integration test with metabob-cli
- [ ] Integration test with metabob-opencode

---

## Success Criteria

1. ✅ `/v2/session` returns proto `Session` message
2. ✅ `/v2/activities/templates` returns proto `ActivityVariant` messages
3. ✅ All responses have `Content-Type: application/protobuf+json`
4. ✅ All proto required fields are present
5. ✅ Enum fields use string names (not integers)
6. ✅ Timestamps are properly formatted (RFC3339)
7. ✅ metabob-cli can parse proto responses
8. ✅ No breaking changes to API contract
9. ✅ All tests pass with proto validation
10. ✅ Full compliance with metabob-proto schemas

---

## Next Steps

1. **Start with proto infrastructure** - Add imports and helpers
2. **Fix v2_session.py** - Make it proto-compliant
3. **Fix v2_activities.py** - Make it proto-compliant  
4. **Update metabob-cli** - Handle proto responses
5. **Update tests** - Validate proto format
6. **Integration test** - Verify end-to-end flow

**Estimated Time**: 4-6 hours of focused work

---

## Questions to Address

1. **Where are proto Python packages?**
   - Should be in `metabob-proto` repo with generated Python code
   - Need to import: `metabob.session.session_pb2`, `metabob.activity.variant_pb2`, etc.

2. **How to handle existing data?**
   - Backend database has existing variant data
   - Need to map existing fields to proto fields
   - Some proto fields may be new (default values)

3. **What about missing proto fields?**
   - Provide sensible defaults (e.g., `prompt_strategy="guided"`)
   - Mark optional fields as such
   - Document which fields are populated

4. **Backward compatibility?**
   - Keep old `/activity-recommendations/*` deprecated but working
   - Proto v2 API is the new standard
   - Update all clients to use proto format

---

**Status**: Ready to begin implementation  
**Priority**: HIGH - Proto compliance is critical  
**Owner**: Activity Mode agent

