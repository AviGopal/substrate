# Activity Template Scope Isolation - Dependency Chain Analysis

**Feature**: activity-template-scope-isolation  
**Date**: 2026-03-01  
**Analysis Method**: Manual code tracing (Metabob service unavailable)

---

## 🔗 Complete Dependency Chain

### **CREATE Flow Chain** (POST /v2/activities/templates)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. create_activity_template (Route Handler)                     │
│    repos/metabob-rpc-api/server/routes/activity.py:165          │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: HTTP endpoint handler for template creation            │
│ Input:   Dict[str, Any] + HTTPAuthorizationCredentials          │
│ Output:  Dict[str, Any] (created template)                      │
├─────────────────────────────────────────────────────────────────┤
│ Data Transformations:                                            │
│ • Extracts scope from request body (default='org')              │
│ • Extracts org_id from Bearer token via session_id_from_token() │
│ • Passes template_data, scope, org_id to business logic         │
├─────────────────────────────────────────────────────────────────┤
│ Dependencies:                                                    │
│ → session_id_from_token() [auth.py:100]                         │
│ → create_template() [activity.py:275]                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. session_id_from_token (Auth Helper)                          │
│    repos/metabob-rpc-api/server/actions/auth.py:100             │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Decode Bearer token to extract org_id                  │
│ Input:   str (base64-encoded token)                             │
│ Output:  str (session_id, used as org_id placeholder)           │
├─────────────────────────────────────────────────────────────────┤
│ Data Transformations:                                            │
│ • Base64 decode token                                            │
│ • Skip "sessions:" prefix (9 chars)                             │
│ • Return remainder as session_id (org_id placeholder)           │
├─────────────────────────────────────────────────────────────────┤
│ Token Format:                                                    │
│ Raw: c2Vzc2lvbnM6MzEzNTg4...                                    │
│ Decoded: sessions:3135883c-8be3-4b2b-bdd8-dbe2e427358f:...      │
│ Result: 3135883c-8be3-4b2b-bdd8-dbe2e427358f:default:...        │
├─────────────────────────────────────────────────────────────────┤
│ Dependencies: None (pure function)                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. create_template (Business Logic)                             │
│    repos/metabob-rpc-api/server/actions/activity.py:275         │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Orchestrate template creation with scope/org_id        │
│ Input:   StrictRedis, Dict[str, Any], scope, org_id             │
│ Output:  Dict[str, Any] (complete template with genealogy)      │
├─────────────────────────────────────────────────────────────────┤
│ Data Transformations:                                            │
│ • Generate template_id from name                                 │
│ • Generate content_hash from task_steps + description           │
│ • Generate variant_id = template_id + content_hash              │
│ • Check Redis for existing variant (idempotency)                │
│ • Determine generation number and parent_hash                    │
│ • Build ActivityVariant dict with scope and org_id fields       │
│ • Write to SurrealDB FIRST (source of truth)                    │
│ • Write to Redis cache (with TTL)                               │
│ • Initialize Thompson Sampling metrics                          │
├─────────────────────────────────────────────────────────────────┤
│ Template Dict Structure:                                         │
│ {                                                                │
│   variant_id: "template-name-abc123",                           │
│   activity_id: "template-name",                                 │
│   scope: "org",           ← ADDED HERE                           │
│   org_id: "uuid",         ← ADDED HERE                           │
│   task_steps: [...],                                             │
│   genealogy: {...},                                              │
│   created_at: "ISO8601"                                          │
│ }                                                                │
├─────────────────────────────────────────────────────────────────┤
│ Dependencies:                                                    │
│ → create_template_record() [template_data.py:26]                │
│ → Redis.setex() (cache write)                                   │
│ → create_metrics() (Thompson Sampling init)                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. create_template_record (Database Write)                      │
│    repos/metabob-rpc-api/server/db/operations/template_data.py:26│
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Persist template to SurrealDB (source of truth)        │
│ Input:   Dict[str, Any] (template with scope + org_id)          │
│ Output:  Dict[str, Any] (created record from SurrealDB)         │
├─────────────────────────────────────────────────────────────────┤
│ Data Transformations:                                            │
│ • Add created_at timestamp (ISO 8601)                           │
│ • Add updated_at timestamp (ISO 8601)                           │
│ • Generate record_id: "activity_template:{variant_id}"          │
│ • Write to SurrealDB with deterministic ID                      │
├─────────────────────────────────────────────────────────────────┤
│ SurrealDB Record:                                                │
│ {                                                                │
│   id: "activity_template:template-name-abc123",                 │
│   variant_id: "template-name-abc123",                           │
│   scope: "org",                                                  │
│   org_id: "3135883c-8be3-4b2b-bdd8-dbe2e427358f",               │
│   task_steps: [...],                                             │
│   created_at: "2026-03-01T12:00:00Z",                           │
│   updated_at: "2026-03-01T12:00:00Z"                            │
│ }                                                                │
├─────────────────────────────────────────────────────────────────┤
│ Dependencies:                                                    │
│ → get_surreal_client() [surrealdb_client.py:396]                │
│ → SurrealDBClient.create() (native DB operation)                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. SurrealDBClient.create (Database Client)                     │
│    repos/metabob-rpc-api/server/db/surrealdb_client.py:26       │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Execute CREATE query on SurrealDB                       │
│ Input:   record_id: str, data: Dict[str, Any]                   │
│ Output:  Dict[str, Any] (created record)                         │
├─────────────────────────────────────────────────────────────────┤
│ Data Transformations: None (direct pass-through to DB)          │
├─────────────────────────────────────────────────────────────────┤
│ SurrealDB Query:                                                 │
│ CREATE activity_template:template-name-abc123 SET {             │
│   variant_id: "template-name-abc123",                           │
│   scope: "org",                                                  │
│   org_id: "3135883c-...",                                        │
│   ...                                                            │
│ }                                                                │
├─────────────────────────────────────────────────────────────────┤
│ Schema Constraints:                                              │
│ • scope FIELD TYPE string DEFAULT 'org'                         │
│ • org_id FIELD TYPE string                                      │
│ • INDEX activity_template_org_idx ON org_id                     │
├─────────────────────────────────────────────────────────────────┤
│ Dependencies: SurrealDB connection (TCP/HTTP)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

### **LIST Flow Chain** (GET /v2/activities/templates)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. list_activity_templates (Route Handler)                      │
│    repos/metabob-rpc-api/server/routes/activity.py:65           │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: HTTP endpoint handler for template listing             │
│ Input:   Query params (category, limit) + Optional Bearer token │
│ Output:  Dict[str, Any] (list of templates)                     │
├─────────────────────────────────────────────────────────────────┤
│ Data Transformations:                                            │
│ • Extract category and limit from query params                   │
│ • Extract org_id from Bearer token (if provided)                │
│ • Pass filters to business logic                                │
├─────────────────────────────────────────────────────────────────┤
│ Multi-Tenant Behavior:                                           │
│ • WITH Bearer Token: Returns global + org-scoped templates       │
│ • WITHOUT Bearer Token: Returns only global templates            │
├─────────────────────────────────────────────────────────────────┤
│ Dependencies:                                                    │
│ → session_id_from_token() [auth.py:100]                         │
│ → list_templates() [activity.py:87]                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. list_templates (Business Logic)                              │
│    repos/metabob-rpc-api/server/actions/activity.py:87          │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Orchestrate template listing with caching & filtering  │
│ Input:   StrictRedis, category, limit, org_id                   │
│ Output:  List[Dict[str, Any]] (filtered templates)              │
├─────────────────────────────────────────────────────────────────┤
│ Data Flow:                                                       │
│ 1. Check Redis set "activity:templates:list"                    │
│ 2. If cache miss → Query SurrealDB with org_id filter           │
│ 3. Populate Redis cache with results                            │
│ 4. Load template details from Redis cache                       │
│ 5. Apply in-memory filtering (category, scope, org_id)          │
│ 6. Load Thompson Sampling metrics from Redis                    │
│ 7. Calculate expected value for ranking                         │
│ 8. Sort by expected value (best first)                          │
├─────────────────────────────────────────────────────────────────┤
│ Filtering Logic:                                                 │
│ • scope='org' → Only visible to users with matching org_id      │
│ • scope='project' → Skip (future implementation)                │
│ • scope=null or 'global' → Visible to all users                 │
├─────────────────────────────────────────────────────────────────┤
│ Dependencies:                                                    │
│ → Redis.smembers() (get template list set)                      │
│ → list_all_templates() [template_data.py:95]                    │
│ → Redis.get() (load template details)                           │
│ → Redis.get() (load metrics)                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. list_all_templates (Database Query)                          │
│    repos/metabob-rpc-api/server/db/operations/template_data.py:95│
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Query SurrealDB with multi-tenant filtering            │
│ Input:   limit: int, org_id: Optional[str]                      │
│ Output:  List[Dict[str, Any]] (filtered templates from DB)      │
├─────────────────────────────────────────────────────────────────┤
│ Query Logic:                                                     │
│                                                                  │
│ IF org_id provided (authenticated user):                        │
│   SELECT * FROM activity_template                               │
│   WHERE scope IS NULL                                            │
│      OR scope = 'global'                                         │
│      OR (scope = 'org' AND org_id = $org_id)                    │
│   ORDER BY created_at DESC                                       │
│   LIMIT $limit                                                   │
│                                                                  │
│ IF org_id NOT provided (unauthenticated):                       │
│   SELECT * FROM activity_template                               │
│   WHERE scope IS NULL OR scope = 'global'                       │
│   ORDER BY created_at DESC                                       │
│   LIMIT $limit                                                   │
├─────────────────────────────────────────────────────────────────┤
│ Index Usage: activity_template_org_idx (on org_id column)       │
├─────────────────────────────────────────────────────────────────┤
│ Dependencies:                                                    │
│ → get_surreal_client() [surrealdb_client.py:396]                │
│ → SurrealDBClient.query() (parameterized query)                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. SurrealDBClient.query (Database Client)                      │
│    repos/metabob-rpc-api/server/db/surrealdb_client.py:26       │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Execute parameterized SELECT query on SurrealDB        │
│ Input:   query: str, params: Dict[str, Any]                     │
│ Output:  List[List[Dict[str, Any]]] (query results)             │
├─────────────────────────────────────────────────────────────────┤
│ Data Transformations: None (direct pass-through to DB)          │
├─────────────────────────────────────────────────────────────────┤
│ Query Example:                                                   │
│ SELECT * FROM activity_template                                 │
│ WHERE scope IS NULL OR scope = 'global'                         │
│    OR (scope = 'org' AND org_id = '3135883c-...')               │
│ ORDER BY created_at DESC                                         │
│ LIMIT 50                                                         │
├─────────────────────────────────────────────────────────────────┤
│ Result Set Example:                                              │
│ [                                                                │
│   [                                                              │
│     {                                                            │
│       id: "activity_template:global-template-xyz",              │
│       scope: "global",                                           │
│       org_id: null,                                              │
│       ...                                                        │
│     },                                                           │
│     {                                                            │
│       id: "activity_template:org-template-abc",                 │
│       scope: "org",                                              │
│       org_id: "3135883c-8be3-4b2b-bdd8-dbe2e427358f",           │
│       ...                                                        │
│     }                                                            │
│   ]                                                              │
│ ]                                                                │
├─────────────────────────────────────────────────────────────────┤
│ Dependencies: SurrealDB connection (TCP/HTTP)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Component Summary Table

| Component | File:Line | Type | Purpose | Dependencies |
|-----------|-----------|------|---------|--------------|
| **create_activity_template** | routes/activity.py:165 | Route | HTTP POST handler | session_id_from_token, create_template |
| **session_id_from_token** | actions/auth.py:100 | Util | Decode Bearer token | None (pure function) |
| **create_template** | actions/activity.py:275 | Logic | Orchestrate creation | create_template_record, Redis |
| **create_template_record** | db/operations/template_data.py:26 | DB | Persist to SurrealDB | get_surreal_client |
| **SurrealDBClient.create** | db/surrealdb_client.py:26 | Client | Execute CREATE query | SurrealDB connection |
| **list_activity_templates** | routes/activity.py:65 | Route | HTTP GET handler | session_id_from_token, list_templates |
| **list_templates** | actions/activity.py:87 | Logic | Cache-aside pattern | list_all_templates, Redis |
| **list_all_templates** | db/operations/template_data.py:95 | DB | Query with filtering | get_surreal_client |
| **SurrealDBClient.query** | db/surrealdb_client.py:26 | Client | Execute SELECT query | SurrealDB connection |

---

## 🔄 Data Type Flow

### **Input Types (Request → Database)**

```typescript
// HTTP Request
POST /v2/activities/templates
Headers: {
  Authorization: "Bearer c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"
}
Body: {
  name: string,
  description: string,
  category: string,
  scope: "org" | "project" | "global",  // Optional, default='org'
  task_steps: TaskStep[],
  variables: Record<string, any>,
  context_requirements: string[]
}

↓ (Route Handler transforms)

// Business Logic Input
create_template(
  redis: StrictRedis,
  template_data: Dict[str, Any],
  scope: "org",
  org_id: "3135883c-8be3-4b2b-bdd8-dbe2e427358f"
)

↓ (Business Logic enriches)

// Database Input
create_template_record({
  variant_id: "template-name-abc123",
  activity_id: "template-name",
  scope: "org",
  org_id: "3135883c-8be3-4b2b-bdd8-dbe2e427358f",
  task_steps: [...],
  genealogy: {
    content_hash: "abc123",
    parent_hash: null,
    generation: 0
  },
  created_at: "2026-03-01T12:00:00Z",
  updated_at: "2026-03-01T12:00:00Z"
})

↓ (Database persists)

// SurrealDB Record
CREATE activity_template:template-name-abc123 SET {
  variant_id: "template-name-abc123",
  scope: "org",
  org_id: "3135883c-8be3-4b2b-bdd8-dbe2e427358f",
  ...
}
```

### **Output Types (Database → Response)**

```typescript
// SurrealDB Query Result
[
  [
    {
      id: "activity_template:template-name-abc123",
      variant_id: "template-name-abc123",
      scope: "org",
      org_id: "3135883c-8be3-4b2b-bdd8-dbe2e427358f",
      task_steps: [...],
      created_at: "2026-03-01T12:00:00Z"
    }
  ]
]

↓ (Business Logic enriches)

// Business Logic Output
{
  variant_id: "template-name-abc123",
  activity_id: "template-name",
  scope: "org",
  org_id: "3135883c-8be3-4b2b-bdd8-dbe2e427358f",
  expected_value: 0.75,
  success_rate: 0.85,
  total_selections: 10,
  ...
}

↓ (Route Handler formats)

// HTTP Response
200 OK
{
  templates: [
    {
      variant_id: "template-name-abc123",
      scope: "org",
      org_id: "3135883c-8be3-4b2b-bdd8-dbe2e427358f",
      ...
    }
  ]
}
```

---

## 🔍 Data Transformations Per Component

### **1. create_activity_template (Route Handler)**

**Input**:
```python
template_data: Dict[str, Any]
credentials: HTTPAuthorizationCredentials
```

**Transformations**:
- Extract `scope` from body → `scope = template_data.get("scope", "org")`
- Decode Bearer token → `session_id = session_id_from_token(credentials.credentials)`
- Use session_id as org_id → `org_id = session_id`

**Output**:
```python
{
  "template_data": {...},
  "scope": "org",
  "org_id": "3135883c-8be3-4b2b-bdd8-dbe2e427358f"
}
```

---

### **2. session_id_from_token (Auth Helper)**

**Input**:
```python
session_token: "c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw"
```

**Transformations**:
- Base64 decode → `sessions:3135883c-8be3-4b2b-bdd8-dbe2e427358f:default:5f887203-d10f-4a49-9f0a-0f994de48aa0`
- Skip "sessions:" prefix (9 chars) → `3135883c-8be3-4b2b-bdd8-dbe2e427358f:default:5f887203-d10f-4a49-9f0a-0f994de48aa0`

**Output**:
```python
"3135883c-8be3-4b2b-bdd8-dbe2e427358f:default:5f887203-d10f-4a49-9f0a-0f994de48aa0"
```

---

### **3. create_template (Business Logic)**

**Input**:
```python
template_data: Dict[str, Any]
scope: "org"
org_id: "3135883c-8be3-4b2b-bdd8-dbe2e427358f"
```

**Transformations**:
- Generate `template_id` from name → `"template-name"`
- Generate `content_hash` from task_steps → `"abc123"`
- Generate `variant_id` → `"template-name-abc123"`
- Determine genealogy (generation, parent_hash)
- Build complete template dict with scope and org_id

**Output**:
```python
{
  "variant_id": "template-name-abc123",
  "activity_id": "template-name",
  "scope": "org",
  "org_id": "3135883c-8be3-4b2b-bdd8-dbe2e427358f",
  "genealogy": {
    "content_hash": "abc123",
    "parent_hash": null,
    "generation": 0
  },
  "created_at": "2026-03-01T12:00:00Z"
}
```

---

### **4. create_template_record (Database Write)**

**Input**:
```python
template_data: Dict[str, Any]  # From create_template
```

**Transformations**:
- Add `created_at` timestamp
- Add `updated_at` timestamp
- Generate SurrealDB record_id → `"activity_template:template-name-abc123"`

**Output** (to SurrealDB):
```python
record_id: "activity_template:template-name-abc123"
data: {
  "variant_id": "template-name-abc123",
  "scope": "org",
  "org_id": "3135883c-8be3-4b2b-bdd8-dbe2e427358f",
  "created_at": "2026-03-01T12:00:00Z",
  "updated_at": "2026-03-01T12:00:00Z"
}
```

---

### **5. list_templates (Business Logic)**

**Input**:
```python
category: Optional[str]
limit: int
org_id: Optional[str]
```

**Transformations**:
- Check Redis cache (`activity:templates:list` set)
- If cache miss → Query SurrealDB with `list_all_templates(org_id)`
- Load template details from Redis
- Apply in-memory filtering:
  - Filter by category
  - Filter by scope and org_id (multi-tenant isolation)
- Load Thompson Sampling metrics from Redis
- Calculate `expected_value = success_rate * quality_score`
- Sort by `expected_value` DESC

**Output**:
```python
[
  {
    "variant_id": "template-name-abc123",
    "scope": "org",
    "org_id": "3135883c-8be3-4b2b-bdd8-dbe2e427358f",
    "expected_value": 0.75,
    "success_rate": 0.85,
    "total_selections": 10
  }
]
```

---

### **6. list_all_templates (Database Query)**

**Input**:
```python
limit: int
org_id: Optional[str]
```

**Transformations**:
- Build parameterized SurrealDB query with org_id filtering
- Execute query with parameters
- Extract result array from nested response

**SurrealDB Query**:
```sql
SELECT * FROM activity_template
WHERE scope IS NULL 
   OR scope = 'global' 
   OR (scope = 'org' AND org_id = $org_id)
ORDER BY created_at DESC
LIMIT $limit
```

**Output**:
```python
[
  {
    "id": "activity_template:template-name-abc123",
    "variant_id": "template-name-abc123",
    "scope": "org",
    "org_id": "3135883c-8be3-4b2b-bdd8-dbe2e427358f",
    ...
  }
]
```

---

## 🛡️ Security & Isolation Enforcement Points

| Layer | Enforcement Mechanism | What It Does |
|-------|----------------------|--------------|
| **Route Handler** | Bearer token extraction | Extracts org_id from authenticated session |
| **Business Logic** | In-memory filtering | Filters templates by scope and org_id after cache load |
| **Database Query** | WHERE clause filtering | Queries only global + org-scoped templates for user's org |
| **SurrealDB Schema** | Index on org_id | Efficient query performance for multi-tenant filtering |

---

## 📈 Cache Flow Diagram

```
USER REQUEST (with Bearer token)
       ↓
[Route Handler] extracts org_id from token
       ↓
[Business Logic] checks Redis cache
       ↓
   ┌─────────────────┐
   │ Cache Hit?      │
   └────┬────────┬───┘
        │ YES    │ NO
        ↓        ↓
   [Redis]    [SurrealDB] ← Query with org_id filter
        ↓        ↓
        └────┬───┘
             ↓
   [In-Memory Filter] ← Apply scope + org_id filtering
             ↓
   [Load Metrics from Redis]
             ↓
   [Calculate Expected Value]
             ↓
   [Sort by Expected Value]
             ↓
   [Return Filtered Templates]
```

---

## 🔗 External Dependencies

| Dependency | Type | Purpose | Configuration |
|------------|------|---------|---------------|
| **SurrealDB** | Database | Primary storage for templates | TCP/HTTP connection |
| **Redis** | Cache | Template cache + metrics | StrictRedis client |
| **FastAPI Security** | Auth | Bearer token extraction | HTTPBearer dependency |
| **base64** | Stdlib | Token decoding | Built-in Python module |

---

## ✅ Validation Points

| Component | Validation | Location |
|-----------|-----------|----------|
| **create_activity_template** | Requires Bearer token for org_id | routes/activity.py:238 |
| **create_template_record** | Requires variant_id field | template_data.py:50 |
| **list_all_templates** | Filters by scope and org_id | template_data.py:122 |
| **list_templates** | In-memory scope filtering | activity.py:180 |

---

## 📝 Key Findings

1. **Dependency Chain Depth**: 5 layers (Route → Auth → Logic → DB Ops → DB Client)

2. **Data Transformation Count**: 6 major transformations from HTTP request to SurrealDB record

3. **Scope Isolation Enforced At**:
   - Database query level (WHERE clause filtering)
   - Application level (in-memory filtering in business logic)
   - Both levels provide defense-in-depth

4. **org_id Extraction**: Uses session_id as placeholder (MVP), should be extended to proper JWT or SessionData model

5. **Cache-Aside Pattern**: Redis cache checked first, SurrealDB queried on miss, results cached for future requests

6. **Multi-Tenant Filtering**: Two-tiered approach:
   - SurrealDB query filters at source (efficient)
   - In-memory filtering provides additional safety net

7. **Security Gap**: GET /v2/activities/templates/{template_id} does NOT filter by org_id (identified in previous analysis)

---

**End of Dependency Chain Analysis**
