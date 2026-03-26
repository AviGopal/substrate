# Activity Template Scope Isolation - Data Transformations Analysis

**Feature**: activity-template-scope-isolation  
**Date**: 2026-03-01  
**Purpose**: Document every data transformation in the scope isolation flow

---

## 📋 CREATE Flow Transformations

### **Transformation 1: HTTP Request → Route Handler**

**Component**: `create_activity_template` (routes/activity.py:165)

**What**:
- Extracts `scope` field from request body with default value
- Extracts `org_id` from Bearer token authorization header
- Passes extracted values to business logic layer

**Type Conversions**:
- `HTTPAuthorizationCredentials` → `str` (Bearer token string)
- `Dict[str, Any]` (request body) → remains `Dict[str, Any]`
- `scope`: defaults to `"org"` if not provided

**Validations**:
- None at this layer (FastAPI handles schema validation)
- Bearer token is OPTIONAL (credentials can be None)

**Business Logic**:
```python
# Line 232: Extract scope with default
scope = template_data.get("scope", "org")

# Lines 237-248: Extract org_id from Bearer token
org_id = None
if credentials and credentials.credentials:
    session_id = session_id_from_token(credentials.credentials)
    if session_id:
        org_id = session_id  # Using session_id as org_id placeholder
```

**Why This Transformation Exists**:
- **Business Requirement**: Support multi-tenant template isolation
- **Default Behavior**: Org-scoped templates by default (safe default)
- **MVP Approach**: Uses session_id as org_id placeholder until proper org model exists
- **Optional Auth**: Allows unauthenticated template creation (global templates)

**Side Effects**:
- None (pure extraction, no mutations)

**Alternative Approaches Evident**:
```python
# TODO comment at line 235:
# "Implement proper JWT token decoding or session lookup"
# 
# TODO comment at line 246:
# "Extend SessionData model to include org_id"
```
*Future: Extract org_id from JWT claims or SessionData model instead of using session_id*

**Input Example**:
```json
POST /v2/activities/templates
Authorization: Bearer c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw

{
  "name": "test-template",
  "description": "Test template",
  "task_steps": [...]
}
```

**Output to Next Layer**:
```python
{
  "redis": <StrictRedis instance>,
  "template_data": {...},
  "scope": "org",
  "org_id": "3135883c-8be3-4b2b-bdd8-dbe2e427358f:default:5f887203-d10f-4a49-9f0a-0f994de48aa0"
}
```

---

### **Transformation 2: Bearer Token → org_id**

**Component**: `session_id_from_token` (actions/auth.py:100)

**What**:
- Base64 decodes Bearer token string
- Strips "sessions:" prefix (first 9 characters)
- Returns remainder as session_id (used as org_id)

**Type Conversions**:
- `str` (base64 encoded) → `str` (decoded session path)
- Handles encoding errors gracefully (returns None)

**Validations**:
```python
try:
    token = standard_b64decode(session_token).decode()
except (UnicodeDecodeError, binascii.Error):
    return None  # Invalid token format
```

**Business Logic**:
```python
# Line 102: Base64 decode
token = standard_b64decode(session_token).decode()

# Line 105: Skip "sessions:" prefix
return token[9:]
```

**Why This Transformation Exists**:
- **Technical Requirement**: Session tokens are base64-encoded paths
- **Token Format**: `"sessions:{org_id}:{project}:{session_id}"`
- **Extraction Logic**: Strip prefix to get `"{org_id}:{project}:{session_id}"`
- **MVP Simplification**: Use full remainder as org_id (includes project + session)

**Side Effects**:
- None (pure function, no state mutations)

**Constraints Enforced**:
- Returns `None` on invalid base64 encoding (graceful failure)
- Assumes token format: `sessions:...` (hardcoded prefix length of 9)

**Token Decoding Example**:
```
Input:  "c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"

Step 1 (base64 decode):
"sessions:3135883c-8be3-4b2b-bdd8-dbe2e427358f:default:5f887203-d10f-4a49-9f0a-0f994de48aa0"

Step 2 (skip 9 chars):
"3135883c-8be3-4b2b-bdd8-dbe2e427358f:default:5f887203-d10f-4a49-9f0a-0f994de48aa0"

Output: "3135883c-8be3-4b2b-bdd8-dbe2e427358f:default:5f887203-d10f-4a49-9f0a-0f994de48aa0"
```

**Alternative Approaches Evident**:
- *Production: Parse token to extract only org_id portion (first UUID)*
- *Future: Use JWT with org_id claim instead of session path encoding*

---

### **Transformation 3: Request Data → Template Dict**

**Component**: `create_template` (actions/activity.py:275)

**What**:
- Generates deterministic IDs (template_id, content_hash, variant_id)
- Checks Redis for existing variant (idempotency)
- Determines genealogy (generation number, parent hash)
- Builds complete template dict with scope and org_id
- Adds timestamps and metadata

**Type Conversions**:
- `template_data: Dict[str, Any]` → `template: Dict[str, Any]` (enriched)
- `name: str` → `template_id: str` (normalized)
- `task_steps + description` → `content_hash: str` (SHA256 hash)
- `scope: str` → unchanged (passed through)
- `org_id: Optional[str]` → unchanged (passed through)

**Validations**:
- None (assumes valid input from route handler)
- Implicit validation: `template_data.get("name", "unknown-template")`

**Business Logic**:

**Step 1: ID Generation** (lines 298-301)
```python
name = template_data.get("name", "unknown-template")
template_id = generate_template_id(name)          # "Add Feature" → "add-feature"
content_hash = generate_content_hash(template_data)  # SHA256 of task_steps + description
variant_id = generate_variant_id(template_id, content_hash)  # "add-feature-a1b2c3d4"
```

**Why**: 
- `template_id`: Human-readable, grouped by template family
- `content_hash`: Content-addressable, detects identical variants
- `variant_id`: Unique identifier for this specific variant

**Step 2: Idempotency Check** (lines 303-307)
```python
existing = redis.get(f"activity:template:{variant_id}")
if existing:
    return json.loads(existing)  # Return existing variant (idempotent)
```

**Why**: Prevent duplicate variants with identical content

**Step 3: Genealogy Calculation** (lines 309-345)
```python
generation = 0
parent_hash = None

if existing_variant_keys:
    # Find max generation among existing variants
    max_generation = max(variant["genealogy"]["generation"] for variant in existing_variants)
    generation = max_generation + 1
    parent_hash = first_variant["genealogy"]["content_hash"]
```

**Why**: Track template evolution and variant lineage

**Step 4: Template Dict Construction** (lines 347-368)
```python
template = {
    "variant_id": variant_id,                    # Generated ID
    "activity_id": template_id,                  # Template family ID
    "variant_name": template_data.get("name", name),
    "description": template_data.get("description", ""),
    "version": generation + 1,                   # Human-readable version
    "task_steps": template_data.get("task_steps", []),
    "variables": template_data.get("variables", {}),
    "context_requirements": template_data.get("context_requirements", []),
    "expected_duration_ms": template_data.get("expected_duration_ms", 10000),
    "expected_cost": template_data.get("expected_cost", 0.01),
    "expected_quality_score": template_data.get("expected_quality_score", 0.5),
    "scope": scope,                               # ← SCOPE FIELD ADDED HERE
    "org_id": org_id,                            # ← ORG_ID FIELD ADDED HERE
    "created_at": datetime.utcnow().isoformat(),
    "genealogy": {
        "content_hash": content_hash,
        "parent_hash": parent_hash,
        "generation": generation,
    },
}
```

**Why This Transformation Exists**:
- **Business Requirement**: Rich template metadata for variant management
- **Idempotency**: Content-addressable IDs prevent duplicate creation
- **Genealogy**: Track template evolution for lineage visualization
- **Defaults**: Provide reasonable defaults for optional fields
- **Scope Isolation**: Add scope and org_id fields for multi-tenancy

**Side Effects**:
- **Redis Read**: Check for existing variant (line 304)
- **Redis Keys Scan**: Find existing variants for genealogy (line 311)
- **Later in function**: SurrealDB write, Redis cache write (lines 370-390)

**Constraints Enforced**:
- `variant_id` uniqueness (content-addressable)
- `generation` increments monotonically
- `parent_hash` links to first variant in family
- `created_at` timestamp in ISO 8601 format

**Alternative Approaches Evident**:
- *Currently: Uses Redis for idempotency check*
- *Alternative: Could check SurrealDB directly (slower but more reliable)*

**Input Example**:
```python
{
  "name": "test-template",
  "description": "Test template",
  "task_steps": [{"id": "task-1", ...}],
  "scope": "org",
  "org_id": "3135883c-..."
}
```

**Output Example**:
```python
{
  "variant_id": "test-template-a1b2c3d4",
  "activity_id": "test-template",
  "variant_name": "test-template",
  "description": "Test template",
  "version": 1,
  "task_steps": [{"id": "task-1", ...}],
  "variables": {},
  "context_requirements": [],
  "expected_duration_ms": 10000,
  "expected_cost": 0.01,
  "expected_quality_score": 0.5,
  "scope": "org",
  "org_id": "3135883c-...",
  "created_at": "2026-03-01T12:00:00.000000",
  "genealogy": {
    "content_hash": "a1b2c3d4",
    "parent_hash": null,
    "generation": 0
  }
}
```

---

### **Transformation 4: Template Dict → SurrealDB Record**

**Component**: `create_template_record` (db/operations/template_data.py:26)

**What**:
- Validates variant_id presence
- Adds/overwrites timestamps (created_at, updated_at)
- Generates deterministic SurrealDB record ID
- Writes to SurrealDB with schema enforcement

**Type Conversions**:
- `template_data: Dict[str, Any]` → SurrealDB record (Dict returned)
- `variant_id: str` → `record_id: str` (prefixed with table name)

**Validations**:
```python
# Line 50-52: Require variant_id
variant_id = template_data.get("variant_id")
if not variant_id:
    raise ValueError("variant_id is required for template creation")
```

**Business Logic**:
```python
# Lines 54-56: Add/overwrite timestamps
template_data["created_at"] = datetime.utcnow().isoformat()
template_data["updated_at"] = datetime.utcnow().isoformat()

# Line 61: Generate deterministic record ID
record_id = f"activity_template:{variant_id}"

# Line 62: Write to SurrealDB
result = db.create(record_id, template_data)
```

**Why This Transformation Exists**:
- **Database Requirement**: SurrealDB requires table-prefixed record IDs
- **Deterministic IDs**: Enable idempotent lookups by variant_id
- **Timestamp Enforcement**: Ensure created_at and updated_at are always set
- **Schema Enforcement**: SurrealDB validates scope and org_id fields

**SurrealDB Schema Constraints** (from init-surrealdb-devbob-schema.sql):
```sql
DEFINE FIELD scope ON activity_template TYPE string
  DEFAULT 'org';

DEFINE FIELD org_id ON activity_template TYPE string;

DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;
```

**Why These Constraints**:
- `scope` has DEFAULT 'org' → Ensures scope is never null (safe default)
- `org_id` is string (no default) → Can be null for global templates
- Index on `org_id` → Efficient multi-tenant queries

**Side Effects**:
- **SurrealDB Write**: Creates record in `activity_template` table
- **Index Update**: Updates `activity_template_org_idx` index
- **Timestamp Mutation**: Overwrites any existing created_at/updated_at

**Constraints Enforced**:
- `variant_id` is required (raises ValueError if missing)
- `record_id` format: `"activity_template:{variant_id}"`
- `created_at` and `updated_at` in ISO 8601 format
- `scope` defaults to 'org' if not provided (database level)
- `org_id` can be null (for global templates)

**Alternative Approaches Evident**:
- *Currently: Uses deterministic record IDs*
- *Alternative: Could use auto-generated IDs and create separate index*
- *Trade-off: Deterministic IDs enable idempotent creates but prevent variant history*

**Input Example**:
```python
{
  "variant_id": "test-template-a1b2c3d4",
  "scope": "org",
  "org_id": "3135883c-...",
  "task_steps": [...],
  "created_at": "2026-03-01T12:00:00.000000"  # Will be overwritten
}
```

**SurrealDB CREATE Query**:
```sql
CREATE activity_template:test-template-a1b2c3d4 SET {
  variant_id: "test-template-a1b2c3d4",
  activity_id: "test-template",
  scope: "org",
  org_id: "3135883c-...",
  task_steps: [...],
  created_at: "2026-03-01T12:00:00.123456",
  updated_at: "2026-03-01T12:00:00.123456",
  ...
}
```

**Output Example**:
```python
{
  "id": "activity_template:test-template-a1b2c3d4",
  "variant_id": "test-template-a1b2c3d4",
  "scope": "org",
  "org_id": "3135883c-...",
  "created_at": "2026-03-01T12:00:00.123456",
  "updated_at": "2026-03-01T12:00:00.123456",
  ...
}
```

---

## 📋 LIST Flow Transformations

### **Transformation 5: HTTP Request → Route Handler (LIST)**

**Component**: `list_activity_templates` (routes/activity.py:65)

**What**:
- Extracts query parameters (category, limit)
- Extracts optional org_id from Bearer token
- Validates limit parameter (max 100)
- Passes filters to business logic

**Type Conversions**:
- `category: Optional[str]` → remains `Optional[str]`
- `limit: int` → validated and bounded (default 50, max 100)
- `HTTPAuthorizationCredentials` → `Optional[str]` (org_id)

**Validations**:
```python
# Line 67: FastAPI Query validation
limit: int = Query(50, le=100, description="Maximum number of templates to return")
```

**Why**: Prevent excessive result sets (DOS protection)

**Business Logic**:
```python
# Lines 106-114: Extract org_id from Bearer token (same as CREATE flow)
org_id = None
if credentials and credentials.credentials:
    session_id = session_id_from_token(credentials.credentials)
    if session_id:
        org_id = session_id  # Using session_id as org_id placeholder
```

**Why This Transformation Exists**:
- **Multi-Tenant Filtering**: org_id determines which templates user can see
- **Optional Auth**: Unauthenticated requests only see global templates
- **Query Limits**: Protect against excessive memory usage

**Side Effects**:
- None (pure extraction)

**Constraints Enforced**:
- `limit` ≤ 100 (enforced by FastAPI)
- `limit` ≥ 1 (implicit, FastAPI default)
- `org_id` extracted from Bearer token if present

**Multi-Tenant Behavior**:
- **WITH Bearer Token**: Returns global + org-scoped templates for user's org
- **WITHOUT Bearer Token**: Returns only global templates

**Input Example**:
```
GET /v2/activities/templates?category=feature&limit=50
Authorization: Bearer c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw
```

**Output to Next Layer**:
```python
{
  "redis": <StrictRedis instance>,
  "category": "feature",
  "limit": 50,
  "org_id": "3135883c-8be3-4b2b-bdd8-dbe2e427358f:default:5f887203-d10f-4a49-9f0a-0f994de48aa0"
}
```

---

### **Transformation 6: Cache Check → Database Query**

**Component**: `list_templates` (actions/activity.py:87)

**What**:
- Checks Redis cache for template list
- On cache miss, queries SurrealDB with org_id filtering
- Populates Redis cache with results
- Applies in-memory filtering (category, scope, org_id)
- Enriches with Thompson Sampling metrics
- Sorts by expected value

**Type Conversions**:
- `template_ids_bytes: Set[bytes]` → `template_ids: List[str]` (decoded)
- `template_json: str` → `template: Dict[str, Any]` (JSON parsed)
- `metrics_json: str` → `metrics: Dict[str, Any]` (JSON parsed)

**Validations**:
- None (assumes valid data from cache/database)

**Business Logic**:

**Step 1: Cache Check** (lines 111-114)
```python
template_ids_bytes = redis.smembers("activity:templates:list")

if not template_ids_bytes or len(template_ids_bytes) == 0:
    # CACHE MISS - Load from SurrealDB
```

**Step 2: Database Query on Cache Miss** (lines 115-153)
```python
templates_from_db = list_all_templates(limit=limit * 2, org_id=org_id)

# Populate cache for future reads
for tmpl in templates_from_db:
    variant_id = tmpl["variant_id"]
    redis.setex(f"activity:template:{variant_id}", TEMPLATE_CACHE_TTL, json.dumps(tmpl))
    redis.sadd("activity:templates:list", variant_id)
```

**Why**: Cache-aside pattern reduces database load

**Step 3: Load Template Details** (lines 155-170)
```python
for template_id_bytes in template_ids_bytes:
    template_id = template_id_bytes.decode() if isinstance(template_id_bytes, bytes) else template_id_bytes
    template_json = redis.get(f"activity:template:{template_id}")
    template = json.loads(template_json)
```

**Step 4: Multi-Tenant Filtering** (lines 171-188)
```python
# Filter by category
if category and template.get("activity_id") != category:
    continue

# Filter by scope and org_id (multi-tenant isolation)
template_scope = template.get("scope")
template_org_id = template.get("org_id")

if template_scope == "org":
    # Org-scoped template: only visible to users in that org
    if not org_id or template_org_id != org_id:
        continue
elif template_scope == "project":
    # Project-scoped template: skip for now (future implementation)
    continue
# else: scope is None or 'global' -> visible to all users
```

**Why This Transformation Exists**:
- **Performance**: Cache-aside pattern reduces database queries
- **Security**: Multi-tenant filtering enforced at application level
- **Flexibility**: In-memory filtering allows complex logic
- **Ranking**: Thompson Sampling prioritizes successful templates

**Step 5: Metrics Enrichment** (lines 190-211)
```python
metrics_json = redis.get(f"activity:metrics:{template_id}")
if metrics_json:
    metrics = json.loads(metrics_json)
    alpha = metrics.get("thompson_alpha", 1.0)
    beta = metrics.get("thompson_beta", 1.0)
    
    success_rate = alpha / (alpha + beta)  # Mean of Beta distribution
    quality_score = template.get("expected_quality_score", 0.5)
    expected_value = success_rate * quality_score
    
    template["expected_value"] = expected_value
    template["success_rate"] = success_rate
    template["total_selections"] = metrics.get("total_selections", 0)
else:
    # No metrics yet (new variant)
    template["expected_value"] = 0.5
    template["success_rate"] = 0.5
    template["total_selections"] = 0
```

**Why**: Thompson Sampling ranks templates by expected success

**Step 6: Sorting** (lines 215-218)
```python
templates.sort(key=lambda t: t.get("expected_value", 0), reverse=True)
return templates[:limit]
```

**Why**: Return best-performing templates first

**Side Effects**:
- **Redis Read**: Multiple reads for template details and metrics
- **Redis Write**: Populate cache on database query (cache miss)
- **SurrealDB Query**: Only on cache miss
- **In-Memory Filtering**: Modifies templates list

**Constraints Enforced**:
- Only return templates matching user's org_id (if org-scoped)
- Only return templates matching category (if specified)
- Skip project-scoped templates (not yet implemented)
- Return at most `limit` templates (sorted by expected_value)

**Alternative Approaches Evident**:
```python
# TODO comment at line 186:
# "Add project_id filtering when project context available"
```
*Future: Support project-scoped templates with project_id filtering*

**Input Example**:
```python
{
  "redis": <StrictRedis instance>,
  "category": "feature",
  "limit": 50,
  "org_id": "3135883c-..."
}
```

**Output Example**:
```python
[
  {
    "variant_id": "add-feature-a1b2c3d4",
    "activity_id": "add-feature",
    "scope": "org",
    "org_id": "3135883c-...",
    "expected_value": 0.85,
    "success_rate": 0.90,
    "total_selections": 15,
    ...
  },
  {
    "variant_id": "fix-bug-xyz789",
    "scope": "global",
    "org_id": null,
    "expected_value": 0.75,
    "success_rate": 0.80,
    "total_selections": 10,
    ...
  }
]
```

---

### **Transformation 7: Database Query with Multi-Tenant Filtering**

**Component**: `list_all_templates` (db/operations/template_data.py:95)

**What**:
- Builds parameterized SurrealDB query with org_id filtering
- Executes query with LIMIT and ORDER BY
- Returns filtered results

**Type Conversions**:
- `limit: int` → SQL parameter `$limit`
- `org_id: Optional[str]` → SQL parameter `$org_id`
- SurrealDB result: `List[List[Dict]]` → `List[Dict]` (unwrapped)

**Validations**:
- None (assumes valid parameters from caller)

**Business Logic**:

**Branch 1: WITH org_id** (lines 120-130)
```sql
SELECT * FROM activity_template
WHERE scope IS NULL 
   OR scope = 'global' 
   OR (scope = 'org' AND org_id = $org_id)
ORDER BY created_at DESC
LIMIT $limit
```

**Why**: Returns global + org-scoped templates for authenticated user

**Branch 2: WITHOUT org_id** (lines 131-139)
```sql
SELECT * FROM activity_template
WHERE scope IS NULL OR scope = 'global'
ORDER BY created_at DESC
LIMIT $limit
```

**Why**: Returns only global templates for unauthenticated user

**Why This Transformation Exists**:
- **Security**: Database-level multi-tenant filtering (first line of defense)
- **Performance**: Uses `activity_template_org_idx` index for efficient queries
- **Compliance**: Enforces scope-based access control at source of truth

**Side Effects**:
- **SurrealDB Query**: Reads from `activity_template` table
- **Index Scan**: Uses `activity_template_org_idx` index (on org_id column)

**Constraints Enforced**:
- Global templates (scope=null or 'global') visible to all users
- Org-scoped templates visible only to users in matching org
- Results ordered by creation date (newest first)
- Results limited to `limit` parameter

**Query Plan**:
1. Index scan on `activity_template_org_idx` (if org_id provided)
2. Filter by scope condition
3. Sort by created_at DESC
4. Limit results

**Input Example**:
```python
{
  "limit": 50,
  "org_id": "3135883c-8be3-4b2b-bdd8-dbe2e427358f"
}
```

**SurrealDB Query**:
```sql
SELECT * FROM activity_template
WHERE scope IS NULL 
   OR scope = 'global' 
   OR (scope = 'org' AND org_id = '3135883c-8be3-4b2b-bdd8-dbe2e427358f')
ORDER BY created_at DESC
LIMIT 50
```

**Output Example**:
```python
[
  {
    "id": "activity_template:add-feature-a1b2c3d4",
    "variant_id": "add-feature-a1b2c3d4",
    "scope": "org",
    "org_id": "3135883c-...",
    "created_at": "2026-03-01T12:00:00.000000",
    ...
  },
  {
    "id": "activity_template:global-template-xyz789",
    "variant_id": "global-template-xyz789",
    "scope": "global",
    "org_id": null,
    "created_at": "2026-02-28T10:00:00.000000",
    ...
  }
]
```

---

## 📊 Summary of Transformations

| Transformation | Component | Key Changes | Purpose |
|----------------|-----------|-------------|---------|
| **1. HTTP → Route** | create_activity_template | Extract scope (default='org'), extract org_id from token | Multi-tenant input extraction |
| **2. Token → org_id** | session_id_from_token | Base64 decode, strip "sessions:" prefix | Extract org identifier from session |
| **3. Request → Template Dict** | create_template | Generate IDs, add genealogy, add scope/org_id | Enrich with metadata and identifiers |
| **4. Dict → SurrealDB** | create_template_record | Add timestamps, generate record_id, write to DB | Persist to database with schema enforcement |
| **5. HTTP → Route (LIST)** | list_activity_templates | Extract query params, extract org_id from token | Multi-tenant query setup |
| **6. Cache → Templates** | list_templates | Cache check, DB query, filtering, metrics enrichment | Cache-aside with multi-tenant filtering |
| **7. Params → DB Query** | list_all_templates | Build parameterized query with scope/org_id filtering | Database-level security enforcement |

---

## 🔐 Security Transformations

### **Defense-in-Depth: Multi-Tenant Isolation**

**Layer 1: Database Query Filtering** (list_all_templates)
```sql
WHERE scope IS NULL OR scope = 'global' 
   OR (scope = 'org' AND org_id = $org_id)
```
**Why**: First line of defense, prevents unauthorized data from leaving database

**Layer 2: Application Filtering** (list_templates)
```python
if template_scope == "org":
    if not org_id or template_org_id != org_id:
        continue  # Skip this template
```
**Why**: Second line of defense, protects against cache poisoning or DB misconfiguration

**Layer 3: Index Enforcement** (SurrealDB schema)
```sql
DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;
```
**Why**: Efficient queries, prevents full table scans

---

## ⚡ Performance Transformations

### **Cache-Aside Pattern**

**Step 1: Check Cache**
```python
template_ids_bytes = redis.smembers("activity:templates:list")
```

**Step 2: Query Database on Miss**
```python
if not template_ids_bytes:
    templates_from_db = list_all_templates(limit=limit * 2, org_id=org_id)
```

**Step 3: Populate Cache**
```python
for tmpl in templates_from_db:
    redis.setex(f"activity:template:{variant_id}", TEMPLATE_CACHE_TTL, json.dumps(tmpl))
```

**Why**: Reduces database load, improves response time

**TTL**: 1 hour (3600 seconds) - balances freshness and performance

---

## 🔄 ID Generation Transformations

### **Template ID Generation**
```python
def generate_template_id(name: str) -> str:
    return name.lower().replace(" ", "-").replace("_", "-")
```
**Input**: `"Add Feature"`  
**Output**: `"add-feature"`  
**Why**: Human-readable, URL-safe, groups variants by template family

### **Content Hash Generation**
```python
def generate_content_hash(content: Dict[str, Any]) -> str:
    hashable = {
        "task_steps": content.get("task_steps", []),
        "description": content.get("description", ""),
    }
    content_str = json.dumps(hashable, sort_keys=True)
    return hashlib.sha256(content_str.encode()).hexdigest()[:8]
```
**Input**: `{ "task_steps": [...], "description": "..." }`  
**Output**: `"a1b2c3d4"`  
**Why**: Content-addressable, detects duplicate variants, enables idempotency

### **Variant ID Generation**
```python
def generate_variant_id(template_id: str, content_hash: str) -> str:
    return f"{template_id}-{content_hash}"
```
**Input**: `template_id="add-feature"`, `content_hash="a1b2c3d4"`  
**Output**: `"add-feature-a1b2c3d4"`  
**Why**: Unique identifier combining family and content

---

## 📋 Validation Rules

| Field | Validation | Enforced By | Why |
|-------|-----------|-------------|-----|
| **scope** | Default to 'org' | Route handler, SurrealDB schema | Safe default for multi-tenancy |
| **org_id** | Optional (can be null) | Route handler | Support global templates |
| **variant_id** | Required | create_template_record | Primary identifier |
| **limit** | ≤ 100 | FastAPI Query validation | Prevent DOS attacks |
| **Bearer token** | Base64 decodable | session_id_from_token | Graceful handling of invalid tokens |
| **template_id** | Derived from name | generate_template_id | Ensures consistency |
| **content_hash** | SHA256 of content | generate_content_hash | Cryptographically secure |

---

## 🎯 Business Requirements Satisfied

1. **Multi-Tenant Isolation**:
   - org_id extracted from Bearer token
   - Templates filtered by scope and org_id
   - Defense-in-depth (database + application filtering)

2. **Template Variant Management**:
   - Content-addressable IDs prevent duplicates
   - Genealogy tracks template evolution
   - Idempotent creation returns existing variant

3. **Performance**:
   - Cache-aside pattern reduces database load
   - Indexed org_id enables efficient queries
   - Thompson Sampling ranks templates by success rate

4. **Security**:
   - Optional authentication supports global templates
   - Scope-based access control at database level
   - Graceful handling of invalid tokens

5. **Scalability**:
   - Deterministic IDs enable distributed creation
   - Redis cache reduces read latency
   - Query limits prevent resource exhaustion

---

**End of Data Transformations Analysis**
