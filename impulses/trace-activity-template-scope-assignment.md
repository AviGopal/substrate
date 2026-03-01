# Trace Analysis: Activity Template Scope Assignment

**Specification ID**: activity-template-scope-assignment  
**Created**: 2026-03-01  
**Type**: Data Flow Analysis  
**Budget**: 5000 tokens  

## Specification Summary

When a user registers an activity template via POST /v2/activities/templates with `scope` and `org_id` fields in the JSON payload, the RPC API backend MUST extract these fields and persist them to SurrealDB. Currently, templates are saved with `scope=null` and `org_id=null` regardless of input values.

### Requirements
1. Extract scope field from request body (default to 'org' if not provided)
2. Extract org_id from the authenticated user's Bearer token context
3. Store both fields in the activity_templates table in SurrealDB

### Expected Behavior
After registering a template with explicit `scope='org'`, querying `GET /v2/activities/templates/<template-id>` should return the template with `scope='org'` and `org_id=<user's org UUID>` populated in the response JSON.

---

## Traced Components

### Entry Point
- **File**: `repos/metabob-rpc-api/server/routes/activity.py`
- **Line**: 144
- **Endpoint**: `POST /v2/activities/templates`
- **Handler**: `create_activity_template`
- **Current Behavior**: Accepts `template_data: Dict[str, Any]` but does not extract scope or org_id from request body or auth context
- **Desired Behavior**: Should extract scope from request body (default='org') and org_id from Bearer token

---

## Data Flow Analysis

### Step 1: FastAPI Route Handler
**File**: `repos/metabob-rpc-api/server/routes/activity.py:144`  
**Function**: `create_activity_template`

**Current Behavior**:
- Receives template_data dict and passes it directly to `create_template()` action
- No scope extraction from request body
- No org_id extraction from Bearer token

**Desired Behavior**:
1. Extract `scope` from `template_data` with default='org'
2. Extract `org_id` from Bearer token (HTTPAuthorizationCredentials)
3. Add scope and org_id to template_data before passing to `create_template()`

**Gap**: Missing scope and org_id extraction logic

---

### Step 2: Business Logic Layer
**File**: `repos/metabob-rpc-api/server/actions/activity.py:253`  
**Function**: `create_template`

**Current Behavior**:
- Builds template dict with variant_id, activity_id, task_steps, etc.
- Does NOT include scope or org_id fields
- Template dict (lines 323-341) omits these fields

**Desired Behavior**:
- Accept scope and org_id parameters in function signature
- Include scope and org_id in the template dict

**Gap**: Function signature doesn't accept scope/org_id, template dict doesn't include these fields

---

### Step 3: SurrealDB Write Operation
**File**: `repos/metabob-rpc-api/server/db/operations/template_data.py:26`  
**Function**: `create_template_record`

**Current Behavior**:
- Accepts template_data dict and writes it to SurrealDB as-is
- Since scope and org_id are not in the dict, they are not persisted

**Desired Behavior**:
- No changes needed - this function correctly persists whatever fields are in template_data

**Gap**: None - this layer is correct, but receives incomplete data from upstream

---

### Step 4: SurrealDB Schema
**File**: `scripts/init-surrealdb-devbob-schema.sql:21`  
**Table**: `activity_template`

**Current Behavior**:
- Schema does NOT define scope or org_id fields
- Schema is SCHEMAFULL, so undefined fields may be rejected or ignored

**Desired Behavior**:
```sql
DEFINE FIELD scope ON activity_template TYPE string DEFAULT 'org';
DEFINE FIELD org_id ON activity_template TYPE string;
DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;
```

**Gap**: Missing scope and org_id field definitions in schema

---

### Step 5: Read Path (GET endpoint)
**File**: `repos/metabob-rpc-api/server/routes/activity.py:103`  
**Endpoint**: `GET /v2/activities/templates/{template_id}`

**Current Behavior**:
- Returns template dict from Redis cache or SurrealDB
- Since scope and org_id are never stored, they are not returned

**Desired Behavior**:
- Should return scope and org_id fields if they exist in the stored template

**Gap**: None - this layer is correct, but data was never stored in the first place

---

## Root Cause Analysis

### Primary Cause
POST /v2/activities/templates route handler does not extract:
- `scope` from request body
- `org_id` from Bearer token

### Secondary Cause
`create_template()` function does not:
- Accept scope/org_id parameters in signature
- Include scope/org_id in template dict construction

### Tertiary Cause
SurrealDB schema does not define scope and org_id fields (SCHEMAFULL mode may reject undefined fields)

---

## Fix Requirements

### 1. Update SurrealDB Schema
**File**: `scripts/init-surrealdb-devbob-schema.sql`

**Changes**:
```sql
-- Add to activity_template table definition (after line 44)
DEFINE FIELD scope ON activity_template TYPE string DEFAULT 'org';
DEFINE FIELD org_id ON activity_template TYPE string;

-- Add index for org_id lookups (after line 49)
DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;
```

---

### 2. Update Route Handler
**File**: `repos/metabob-rpc-api/server/routes/activity.py`  
**Function**: `create_activity_template` (line 144)

**Changes**:
```python
@router.post("/templates", status_code=201)
async def create_activity_template(
    template_data: Dict[str, Any],
    redis: StrictRedis = Depends(get_redis_connection),
    credentials: Optional[HTTPAuthorizationCredentials] = Security(SESSION_TOKEN),  # ADD THIS
) -> Dict[str, Any]:
    """Create new activity template or variant."""
    try:
        # Extract scope from request body (default='org')
        scope = template_data.get("scope", "org")
        
        # Extract org_id from Bearer token
        org_id = None
        if credentials:
            # TODO: Decode JWT token to get org_id
            # For now, extract from token or use placeholder
            org_id = extract_org_id_from_token(credentials.credentials)
        
        # Pass scope and org_id to create_template
        template = create_template(redis, template_data, scope=scope, org_id=org_id)
        return template
    except Exception as e:
        logger.error(f"create_template failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
```

---

### 3. Update Business Logic
**File**: `repos/metabob-rpc-api/server/actions/activity.py`  
**Function**: `create_template` (line 253)

**Changes**:
```python
def create_template(
    redis: StrictRedis, 
    template_data: Dict[str, Any],
    scope: str = "org",  # ADD THIS
    org_id: Optional[str] = None,  # ADD THIS
) -> Dict[str, Any]:
    """Create activity template or variant (auto-variant on duplicate)."""
    
    # ... existing code ...
    
    # Build ActivityVariant proto format (line 323)
    template = {
        "variant_id": variant_id,
        "activity_id": template_id,
        "variant_name": template_data.get("name", name),
        "description": template_data.get("description", ""),
        "version": generation + 1,
        "task_steps": template_data.get("task_steps", []),
        "variables": template_data.get("variables", {}),
        "context_requirements": template_data.get("context_requirements", []),
        "expected_duration_ms": template_data.get("expected_duration_ms", 10000),
        "expected_cost": template_data.get("expected_cost", 0.01),
        "expected_quality_score": template_data.get("expected_quality_score", 0.5),
        "scope": scope,  # ADD THIS
        "org_id": org_id,  # ADD THIS
        "created_at": datetime.utcnow().isoformat(),
        "genealogy": {
            "content_hash": content_hash,
            "parent_hash": parent_hash,
            "generation": generation,
        },
    }
    
    # ... rest of function ...
```

---

## Current State vs Desired State

### Current State
**Request Flow**:
```
POST /v2/activities/templates with {scope: 'org'}
  ↓
create_activity_template() ignores scope
  ↓
create_template() builds template without scope
  ↓
create_template_record() stores template without scope
  ↓
scope=null in database
```

**Schema State**: `activity_template` table does not define scope or org_id fields

**Auth Context**: Bearer token is NOT extracted or used anywhere in template creation flow

---

### Desired State
**Request Flow**:
```
POST /v2/activities/templates with {scope: 'org'}
  ↓
create_activity_template() extracts scope + org_id from token
  ↓
create_template() includes scope and org_id in template dict
  ↓
create_template_record() stores template with scope and org_id
  ↓
scope='org', org_id='uuid-123' in database
```

**Schema State**: `activity_template` table defines scope (string, default='org') and org_id (string) fields with index

**Auth Context**: Bearer token is extracted and decoded to get org_id for template isolation

---

## Validation Checklist

After implementing the fixes, verify:

1. ✅ SurrealDB schema includes scope and org_id fields
2. ✅ POST /v2/activities/templates accepts scope in request body
3. ✅ POST /v2/activities/templates extracts org_id from Bearer token
4. ✅ Templates are stored with scope and org_id in SurrealDB
5. ✅ GET /v2/activities/templates/{id} returns scope and org_id in response
6. ✅ Multi-tenant isolation works (org A cannot see org B's templates)

---

## Related Files

- `repos/metabob-rpc-api/server/routes/activity.py` (route handler)
- `repos/metabob-rpc-api/server/actions/activity.py` (business logic)
- `repos/metabob-rpc-api/server/db/operations/template_data.py` (database operations)
- `scripts/init-surrealdb-devbob-schema.sql` (database schema)

---

**End of Trace Analysis**
