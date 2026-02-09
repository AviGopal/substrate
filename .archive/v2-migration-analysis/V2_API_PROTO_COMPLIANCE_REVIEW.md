# V2 API Proto Compliance Review

**Date**: 2026-02-07  
**Purpose**: Review v2 API implementation for metabob-proto compliance  
**Scope**: metabob-opencode ↔ metabob-cli ↔ metabob-rpc-api communication flow

---

## Executive Summary

**Status**: ⚠️ **COMPLIANCE GAP IDENTIFIED**

The v2 API implementation we created (`/v2/session`, `/v2/activities/*`) is **NOT proto-compliant**. It uses custom JSON schemas instead of protobuf message definitions from metabob-proto.

### Issues Found

1. ❌ **v2 API uses custom Pydantic models** instead of proto messages
2. ❌ **No proto message serialization** (MessageToDict/ParseDict)
3. ❌ **Missing proto content-type** headers (`application/protobuf+json`)
4. ⚠️ **Parallel proto implementation exists** (`/api/v2/activities` via proto_activities.py)
5. ⚠️ **Two different v2 APIs** competing for same versioning space

---

## Proto Contract (Expected)

### Session Proto (`metabob.session.Session`)

```protobuf
message Session {
  string session_id = 1;
  SessionType session_type = 2;  // ANONYMOUS, AUTHENTICATED, SERVICE
  
  // Scope
  string consumer_id = 3;
  string org_id = 4;
  string project_id = 5;
  
  // Metadata
  map<string, string> metadata = 6;
  
  // Lifecycle
  google.protobuf.Timestamp created_at = 7;
  google.protobuf.Timestamp expires_at = 8;
  google.protobuf.Timestamp last_activity = 9;
}
```

### Activity Variant Proto (`metabob.activity.ActivityVariant`)

```protobuf
message ActivityVariant {
  // Identity
  string variant_id = 1;
  string activity_id = 2;
  string variant_name = 3;
  string description = 4;
  int32 version = 5;
  
  // Genealogy
  metabob.common.Genealogy genealogy = 6;
  
  // Implementation
  repeated TaskStep task_steps = 7;
  map<string, string> variables = 8;
  string prompt_strategy = 9;
  int32 context_budget_tokens = 10;
  
  // Performance expectations
  int32 expected_duration_ms = 11;
  double expected_cost = 12;
  double expected_quality_score = 13;
  
  // Status
  metabob.common.EntityStatus status = 14;
  google.protobuf.Timestamp created_at = 15;
  
  // Extensions
  ExecutionConfig execution_config = 20;
  OptimizationConfig optimization_config = 21;
  AdminConfig admin_config = 22;
  CompositionConfig composition = 23;
  LearningConfig learning = 24;
  repeated ExpectedOutcome expected_outcomes = 25;
}
```

### Task Step Proto (`metabob.activity.TaskStep`)

```protobuf
message TaskStep {
  // Identity
  string id = 1;
  string subagent = 2;              // "general", "tool", "config", "session"
  string description = 3;
  repeated string dependencies = 4;
  
  // Configuration
  TaskPrompt prompt = 5;
  TaskValidation validation = 6;
  TaskRetry retry = 7;
  TaskMetrics metrics = 8;
  
  // Optional
  repeated string guidance = 9;
  repeated string expected_actions = 10;
  TaskTools tools = 11;
  TaskComplexity complexity = 12;
  
  // Execution config
  TaskExecutionConfig execution_config = 20;
  repeated ImpulseReference impulse_refs = 21;
}
```

---

## Current v2 API Implementation (NOT Proto-Compliant)

### `/v2/session` - Custom JSON Schema ❌

**File**: `server/routes/v2_session.py`

**Current Response**:
```python
class SessionResponse(BaseModel):  # ❌ Pydantic, not proto
    session_token: str
    session_id: str
    org_id: str
    project_id: str
    user_id: Optional[str]
    created_at: Optional[str]
    expires_at: Optional[str]
```

**Problems**:
- Uses Pydantic BaseModel, not proto messages
- Missing `session_type` enum
- Missing `consumer_id`
- Missing `metadata` map
- Missing `last_activity` timestamp
- Returns `session_token` (JWT) instead of proto `Session` message

### `/v2/activities/templates` - Custom JSON Schema ❌

**File**: `server/routes/v2_activities.py`

**Current Response**:
```python
class TemplateListItem(BaseModel):  # ❌ Pydantic, not proto
    id: str
    name: str
    description: str
    category: str
    task_count: int
    variables: dict[str, TemplateVariable]
    context_requirements: List[TemplateContextRequirement]
    metrics: TemplateMetrics
```

**Problems**:
- Uses Pydantic BaseModel, not proto messages
- Missing `variant_id` (proto uses compound IDs)
- Missing `activity_id` (parent category)
- Missing `genealogy` (content-addressable lineage)
- Missing `task_steps` (replaced with `task_count`)
- Doesn't use `ExecutionConfig`, `OptimizationConfig`, etc.
- No proto content-type headers

---

## Existing Proto-Compliant API

### `/api/v2/activities` - Proto Implementation ✅

**File**: `server/routes/proto_activities.py`

**Current Response**:
```python
def proto_response(proto_msg, status_code: int = 200):
    """Convert proto message to JSON response with correct content type."""
    data = MessageToDict(
        proto_msg,
        including_default_value_fields=False,
        preserving_proto_field_name=True,
        use_integers_for_enums=False,
    )
    return JSONResponse(
        content=data,
        status_code=status_code,
        headers={"Content-Type": "application/protobuf+json"},  # ✅ Proto header
    )
```

**Endpoints**:
- `POST /api/v2/activities` - Create activity execution (proto-compliant)
- `POST /api/v2/activities/{id}/execute` - Execute activity
- `GET /api/v2/activities/{id}` - Get activity details
- `GET /api/v2/activities` - List activities
- `POST /api/v2/activities/{id}/cancel` - Cancel activity
- `POST /api/v2/activities/metrics` - Submit execution metrics

**This is the CORRECT implementation!** ✅

---

## Communication Flow Analysis

### Current State (After Our Changes)

```
metabob-opencode (TypeScript)
    │
    │ Uses MCP protocol
    │
    ▼
metabob-cli (Python MCP Server)
    │
    │ ActivityManager uses:
    │ - /v2/activities/templates (❌ our custom API, NOT proto)
    │ - /v2/activities/record/* (❌ our custom API, NOT proto)
    │
    ▼
metabob-rpc-api (FastAPI)
    │
    ├─ /v2/session (❌ custom JSON, NOT proto)
    ├─ /v2/activities/* (❌ custom JSON, NOT proto)
    │
    └─ /api/v2/activities (✅ proto-compliant, IGNORED by our changes)
```

### Expected State (Proto-Compliant)

```
metabob-opencode (TypeScript)
    │
    │ Uses @metabob/proto package
    │ - metabob.activity.ActivityVariant
    │ - metabob.session.Session
    │
    ▼
metabob-cli (Python MCP Server)
    │
    │ Uses metabob-proto package
    │ - ActivityManager translates MCP ↔ proto
    │ - Serializes/deserializes proto messages
    │
    ▼
metabob-rpc-api (FastAPI)
    │
    └─ /api/v2/activities (✅ proto-compliant)
       - Content-Type: application/protobuf+json
       - Uses MessageToDict/ParseDict
       - Full proto message schemas
```

---

## Problems with Our v2 API

### 1. **Versioning Collision**

We created `/v2/activities/*` but there's already `/api/v2/activities` that's proto-compliant.

**Paths**:
- Our API: `/v2/activities/templates`
- Existing proto API: `/api/v2/activities`

**Problem**: Both claim "v2" but have different contracts!

### 2. **Not Proto-Compliant**

Our v2 API uses:
- ❌ Pydantic models (custom schemas)
- ❌ Plain JSON responses
- ❌ No `application/protobuf+json` content-type
- ❌ No proto message serialization

**Expected**:
- ✅ Proto message definitions from `metabob-proto`
- ✅ `MessageToDict`/`ParseDict` serialization
- ✅ `application/protobuf+json` content-type
- ✅ Full proto schema compliance

### 3. **Missing Proto Fields**

Our custom schemas are missing required proto fields:
- `genealogy` (content-addressable lineage)
- `execution_config` (ExecutionConfig proto)
- `optimization_config` (OptimizationConfig proto)
- `admin_config` (AdminConfig proto)
- `session_type` (enum)
- `task_steps` (repeated TaskStep)

### 4. **CLI Migration Was Premature**

We migrated metabob-cli to use our custom `/v2/activities/*` API, but:
- The proto-compliant API already exists
- We should have migrated to `/api/v2/activities` instead
- Now CLI uses non-proto endpoints

---

## Correct Architecture (Proto-Compliant)

### Session Management

**Path**: `/api/v2/session` (not `/v2/session`)

**Request** (Create Session):
```json
{
  "api_key": "mb_...",
  "scope": {
    "org_id": "org_123",
    "project_id": "proj_456"
  },
  "metadata": {
    "client": "metabob-cli",
    "version": "1.0.0"
  }
}
```

**Response** (Proto Message):
```json
{
  "session_id": "org_123::proj_456::uuid",
  "session_type": "SESSION_TYPE_AUTHENTICATED",
  "consumer_id": "consumer_abc",
  "org_id": "org_123",
  "project_id": "proj_456",
  "metadata": {
    "client": "metabob-cli",
    "version": "1.0.0"
  },
  "created_at": "2026-02-07T12:00:00Z",
  "expires_at": "2026-02-08T12:00:00Z",
  "last_activity": "2026-02-07T12:00:00Z"
}
```

**Headers**:
```
Content-Type: application/protobuf+json
```

### Activity Template Management

**Path**: `/api/v2/activities` (not `/v2/activities/templates`)

**Request** (Create Activity):
```json
{
  "template_id": "add-rest-endpoint",
  "variables": {
    "method": "POST",
    "path": "/api/users"
  },
  "reason": "Add user creation endpoint",
  "scope": {
    "org_id": "org_123",
    "project_id": "proj_456"
  },
  "calling_session_id": "sess_789"
}
```

**Response** (ActivityVariant Proto):
```json
{
  "variant_id": "add-rest-endpoint-abc123",
  "activity_id": "add-rest-endpoint",
  "variant_name": "REST Endpoint Template v1",
  "description": "Add a new REST endpoint with validation",
  "version": 1,
  "genealogy": {
    "content_hash": "sha256:abc123...",
    "parent_hash": null,
    "creation_method": "MANUAL"
  },
  "task_steps": [
    {
      "id": "implement-endpoint",
      "subagent": "general",
      "description": "Implement REST endpoint",
      "dependencies": [],
      "prompt": {
        "template": "Implement {{method}} {{path}} endpoint",
        "max_tokens": 8000,
        "variables": ["method", "path"]
      },
      "validation": {
        "required_files": ["src/routes/users.ts"],
        "required_patterns": ["export function"]
      },
      "retry": {
        "max_attempts": 3,
        "strategy": "exponential"
      },
      "metrics": {
        "success_rate": 0.0,
        "avg_tokens": 0,
        "avg_duration": 0
      }
    }
  ],
  "variables": {
    "method": "POST",
    "path": "/api/users"
  },
  "execution_config": {
    "context_requirements": [
      {
        "key": "codebase_context",
        "hint": "Existing route patterns",
        "impulse_types": ["file", "component"],
        "required": true
      }
    ]
  },
  "optimization_config": {
    "thompson_sampling": {
      "enabled": true,
      "initial_alpha": 1.0,
      "initial_beta": 1.0
    }
  },
  "status": "ENTITY_STATUS_ACTIVE",
  "created_at": "2026-02-07T12:00:00Z"
}
```

**Headers**:
```
Content-Type: application/protobuf+json
```

---

## Recommended Actions

### Option 1: Align v2 API with Proto (RECOMMENDED) ✅

**Tasks**:
1. **Rename our v2 API** to avoid collision:
   - `/v2/session` → `/v2/auth/session` (simple auth endpoints)
   - `/v2/activities/*` → Keep but make proto-compliant

2. **Make v2 API proto-compliant**:
   - Replace Pydantic models with proto messages
   - Use `MessageToDict`/`ParseDict` serialization
   - Add `application/protobuf+json` content-type
   - Include all required proto fields

3. **Update metabob-cli**:
   - Use proto-compliant endpoints
   - Import `metabob-proto` package
   - Serialize/deserialize proto messages
   - Use existing `/api/v2/activities` endpoints

4. **Deprecate custom JSON schemas**:
   - Mark our custom endpoints as deprecated
   - Provide migration guide to proto API

### Option 2: Keep Custom API, Rename to v3 (NOT RECOMMENDED) ❌

**Tasks**:
1. Rename our API to `/v3/*` to avoid collision
2. Keep custom JSON schemas (not proto-compliant)
3. Document that v3 is "simplified" non-proto API
4. Maintain two parallel APIs (proto v2 + custom v3)

**Problems**:
- Fragments the API ecosystem
- Creates confusion (which API to use?)
- Not compliant with metabob-proto standard
- More maintenance burden

### Option 3: Use Existing Proto API (QUICKEST) ✅✅✅

**Tasks**:
1. **Delete our custom v2 API** (`v2_session.py`, `v2_activities.py`)
2. **Use existing proto API** (`proto_activities.py`)
3. **Update metabob-cli** to use `/api/v2/activities`
4. **Update tests** to test proto API instead

**Benefits**:
- ✅ Already implemented and proto-compliant
- ✅ No versioning collision
- ✅ Clean proto message contracts
- ✅ Less code to maintain

---

## Proto API Feature Comparison

| Feature | Our v2 API | Existing Proto API |
|---------|-----------|-------------------|
| **Path** | `/v2/activities/*` | `/api/v2/activities` |
| **Content-Type** | `application/json` ❌ | `application/protobuf+json` ✅ |
| **Serialization** | Pydantic ❌ | MessageToDict/ParseDict ✅ |
| **Session** | Custom JSON ❌ | Proto Session ✅ |
| **ActivityVariant** | Custom schema ❌ | Proto ActivityVariant ✅ |
| **TaskStep** | Missing ❌ | Proto TaskStep ✅ |
| **ExecutionConfig** | Missing ❌ | Proto ExecutionConfig ✅ |
| **Genealogy** | Missing ❌ | Proto Genealogy ✅ |
| **Thompson Sampling** | Hidden ✅ | Proto OptimizationConfig ✅ |
| **Context Requirements** | Missing ❌ | Proto ContextRequirement ✅ |
| **Hooks** | Missing ❌ | Proto HooksConfig ✅ |

**Winner**: Existing Proto API ✅

---

## Next Steps (Recommended)

### Immediate Actions

1. **Review Existing Proto API**:
   - Read `server/routes/proto_activities.py` in full
   - Understand proto message flow
   - Test existing endpoints

2. **Update metabob-cli**:
   - Change endpoints to `/api/v2/activities`
   - Import `metabob-proto` Python package
   - Use proto message serialization
   - Update activity_manager.py

3. **Delete Custom v2 API**:
   - Remove `v2_session.py`
   - Remove `v2_activities.py`
   - Remove custom Pydantic models
   - Update tests to use proto API

4. **Update Documentation**:
   - Document proto API usage
   - Provide migration examples
   - Update OpenAPI/Swagger docs

### Long-Term Actions

1. **Enhance Proto API**:
   - Add missing endpoints if needed
   - Improve error handling
   - Add more examples

2. **CLI Proto Integration**:
   - Full proto message support in MCP tools
   - Proper TypeScript proto integration
   - OpenCode proto message handling

3. **Testing**:
   - Proto message validation tests
   - Integration tests with proto API
   - MCP ↔ Proto ↔ OpenCode flow tests

---

## Questions to Answer

1. **Should we keep our custom v2 API?**
   - **Recommendation**: No, use existing proto API

2. **Is our X-Internal-Request removal still valid?**
   - **Yes!** X-Internal-Request is still an anti-pattern
   - Proto API should use proper Bearer auth too

3. **What about our CLI migration?**
   - **Update**: Change to proto API endpoints
   - **Keep**: X-Internal-Request removal
   - **Keep**: Bearer token auth flow

4. **Are our tests still useful?**
   - **Update**: Change to test proto API
   - **Keep**: Test structure and patterns
   - **Keep**: Auth flow tests

5. **What about deprecation headers?**
   - **Keep**: Deprecate `/activity-recommendations/*`
   - **Add**: Recommend `/api/v2/activities` (proto API)

---

## Conclusion

**Status**: ⚠️ **COMPLIANCE GAP - ACTION REQUIRED**

We built a custom v2 API that's NOT proto-compliant, while a proto-compliant API already exists at `/api/v2/activities`.

**Recommendation**: Use existing proto API, delete our custom implementation.

**Benefits**:
- ✅ Proto-compliant from day one
- ✅ No versioning collision
- ✅ Less code to maintain
- ✅ Full proto feature support
- ✅ Already implemented and tested

**Action Items**:
1. Review existing proto API (`proto_activities.py`)
2. Update metabob-cli to use proto endpoints
3. Delete custom v2 API
4. Update tests for proto compliance
5. Document proto message flow

---

**Next Session**: Review proto API, plan CLI migration to proto endpoints, ensure full proto compliance.
