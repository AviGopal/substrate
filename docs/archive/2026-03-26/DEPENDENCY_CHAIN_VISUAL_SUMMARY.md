# Activity Template Scope Isolation - Visual Dependency Summary

**Feature**: activity-template-scope-isolation  
**Date**: 2026-03-01

---

## 🔗 CREATE Flow (5 Components)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CREATE TEMPLATE FLOW                              │
└──────────────────────────────────────────────────────────────────────────┘

HTTP POST /v2/activities/templates
Headers: Authorization: Bearer <token>
Body: { scope: "org", name: "...", task_steps: [...] }
    │
    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. create_activity_template (routes/activity.py:165)                    │
│    • Extract scope from body (default='org')                            │
│    • Extract org_id from Bearer token                                   │
│    • Pass to business logic                                             │
│                                                                          │
│    Input:  Dict[str, Any] + HTTPAuthorizationCredentials                │
│    Output: Dict[str, Any] (created template)                            │
└────────────────────────────┬─────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. session_id_from_token (actions/auth.py:100)                          │
│    • Base64 decode Bearer token                                         │
│    • Skip "sessions:" prefix (9 chars)                                  │
│    • Return remainder as org_id                                         │
│                                                                          │
│    Input:  "c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0Mjcz..."│
│    Output: "3135883c-8be3-4b2b-bdd8-dbe2e427358f:default:5f887203-..."  │
└────────────────────────────┬─────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. create_template (actions/activity.py:275)                            │
│    • Generate variant_id, template_id, content_hash                     │
│    • Check Redis for existing variant (idempotency)                     │
│    • Build template dict WITH scope and org_id                          │
│    • Write to SurrealDB FIRST (source of truth)                         │
│    • Cache in Redis (TTL=1hr)                                           │
│    • Initialize Thompson Sampling metrics                               │
│                                                                          │
│    Input:  template_data, scope="org", org_id="uuid"                    │
│    Output: { variant_id, scope, org_id, genealogy, ... }                │
└────────────────────────────┬─────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. create_template_record (db/operations/template_data.py:26)           │
│    • Add created_at, updated_at timestamps                              │
│    • Generate record_id: "activity_template:{variant_id}"               │
│    • Write to SurrealDB with deterministic ID                           │
│                                                                          │
│    Input:  { variant_id, scope, org_id, ... }                           │
│    Output: SurrealDB record                                             │
└────────────────────────────┬─────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. SurrealDBClient.create (db/surrealdb_client.py:26)                   │
│    • Execute CREATE query on SurrealDB                                  │
│    • Schema enforces: scope (string, default='org'), org_id (string)    │
│    • Index: activity_template_org_idx on org_id                         │
│                                                                          │
│    Query: CREATE activity_template:variant_id SET {...}                 │
│    Result: { id: "activity_template:...", scope, org_id, ... }          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 LIST Flow (4 Components)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          LIST TEMPLATES FLOW                              │
└──────────────────────────────────────────────────────────────────────────┘

HTTP GET /v2/activities/templates?category=feature&limit=50
Headers: Authorization: Bearer <token> (OPTIONAL)
    │
    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. list_activity_templates (routes/activity.py:65)                      │
│    • Extract query params (category, limit)                             │
│    • Extract org_id from Bearer token (if provided)                     │
│    • Pass filters to business logic                                     │
│                                                                          │
│    WITH token:    Returns global + org-scoped templates                 │
│    WITHOUT token: Returns only global templates                         │
└────────────────────────────┬─────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. list_templates (actions/activity.py:87)                              │
│    • Check Redis cache ("activity:templates:list" set)                  │
│    • If cache miss → Query SurrealDB with org_id filter                 │
│    • Load template details from Redis                                   │
│    • Apply in-memory filtering (category, scope, org_id)                │
│    • Load Thompson Sampling metrics                                     │
│    • Calculate expected_value, sort by best first                       │
│                                                                          │
│    Filtering Logic:                                                      │
│    • scope='org' → Only visible to users with matching org_id           │
│    • scope='project' → Skip (future)                                    │
│    • scope=null or 'global' → Visible to all                            │
└────────────────────────────┬─────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. list_all_templates (db/operations/template_data.py:95)               │
│    • Build parameterized SurrealDB query                                │
│    • WITH org_id: Filter by global + org-scoped templates               │
│    • WITHOUT org_id: Filter by global templates only                    │
│    • Use index: activity_template_org_idx                               │
│                                                                          │
│    Query (WITH org_id):                                                  │
│    SELECT * FROM activity_template                                       │
│    WHERE scope IS NULL OR scope = 'global'                               │
│       OR (scope = 'org' AND org_id = $org_id)                           │
│    ORDER BY created_at DESC LIMIT $limit                                 │
└────────────────────────────┬─────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. SurrealDBClient.query (db/surrealdb_client.py:26)                    │
│    • Execute parameterized SELECT query                                 │
│    • Return filtered results from SurrealDB                             │
│                                                                          │
│    Result: [ { id, variant_id, scope, org_id, ... }, ... ]              │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Type Transformations

### CREATE Flow

```
HTTP Request
{ scope: "org", name: "test", ... }
         ↓
Route Handler
{ template_data: {...}, scope: "org", org_id: "3135883c-..." }
         ↓
Business Logic
{ variant_id: "test-abc123", scope: "org", org_id: "3135883c-...", genealogy: {...} }
         ↓
Database Write
CREATE activity_template:test-abc123 SET { scope: "org", org_id: "3135883c-...", ... }
         ↓
SurrealDB Record
{ id: "activity_template:test-abc123", scope: "org", org_id: "3135883c-...", ... }
```

### LIST Flow

```
HTTP Request
GET /v2/activities/templates (with Bearer token)
         ↓
Route Handler
{ category: null, limit: 50, org_id: "3135883c-..." }
         ↓
Business Logic (Cache Check)
Redis.smembers("activity:templates:list") → [variant_ids...]
         ↓
Cache Miss → Database Query
SELECT * FROM activity_template WHERE scope IS NULL OR scope = 'global'
   OR (scope = 'org' AND org_id = '3135883c-...')
         ↓
In-Memory Filtering
Filter by: category, scope, org_id (multi-tenant isolation)
         ↓
Enrichment
Add: expected_value, success_rate, total_selections (from Redis metrics)
         ↓
HTTP Response
{ templates: [ { variant_id, scope, org_id, expected_value, ... }, ... ] }
```

---

## 🔐 Security Isolation Points

| Layer | Enforcement Mechanism | Purpose |
|-------|----------------------|---------|
| **Route Handler** | Bearer token extraction | Extracts org_id from authenticated session |
| **Business Logic** | In-memory filtering | Filters templates by scope and org_id after cache load |
| **Database Query** | WHERE clause filtering | Queries only global + org-scoped templates for user's org |
| **SurrealDB Schema** | Index on org_id | Efficient query performance for multi-tenant filtering |

---

## ⚡ Performance Optimizations

1. **Cache-Aside Pattern**: Redis cache checked first (fast), SurrealDB queried on miss
2. **Index Usage**: `activity_template_org_idx` on org_id for efficient filtering
3. **Redis TTL**: Templates cached for 1 hour (3600s), reduces DB load
4. **Thompson Sampling Metrics**: Pre-calculated in Redis for fast ranking

---

## 🎯 Key Dependencies

| Component | Depends On | Purpose |
|-----------|------------|---------|
| **create_activity_template** | session_id_from_token, create_template | Route handler orchestration |
| **create_template** | create_template_record, Redis | Business logic orchestration |
| **create_template_record** | get_surreal_client | Database persistence |
| **list_templates** | list_all_templates, Redis | Cache-aside pattern |
| **list_all_templates** | get_surreal_client | Database query with filtering |

---

## 📋 Summary Stats

- **CREATE Flow Depth**: 5 layers (Route → Auth → Logic → DB Ops → DB Client)
- **LIST Flow Depth**: 4 layers (Route → Logic → DB Ops → DB Client)
- **Data Transformations**: 6 major transformations from HTTP request to SurrealDB
- **Security Layers**: 2 (Database query filtering + In-memory filtering)
- **Cache Strategy**: Cache-aside with 1-hour TTL
- **Index Count**: 1 (activity_template_org_idx on org_id)

