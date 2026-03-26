# Activity Template Scope Isolation - Component Annotations

**Feature**: activity-template-scope-isolation  
**Date**: 2026-03-01  
**Purpose**: Document WHY key components exist and the design decisions made

---

## 📋 Annotated Components (5 Critical Components)

### **1. Entry Point: create_activity_template() [Route Handler]**

**File**: `repos/metabob-rpc-api/server/routes/activity.py`  
**Function**: `create_activity_template`  
**Lines**: 165-254

#### **Purpose in Flow**

Entry point for activity-template-scope-isolation CREATE flow. Handles HTTP POST requests to register new activity templates with multi-tenant scope and organization assignment.

#### **Data Transformation**

```
Input:  HTTP Request (JSON + Bearer token)
        {
          "name": str,
          "description": str,
          "task_steps": List[Dict],
          "scope": "org" | "project" | "global" (optional)
        }
        + Authorization: Bearer <base64-token>

Output: HTTP Response (201 Created)
        {
          "variant_id": str,
          "activity_id": str,
          "scope": "org",
          "org_id": "uuid",
          "genealogy": {...}
        }
```

#### **Business Logic Enforced**

1. **Multi-Tenant Isolation**: Extracts `org_id` from Bearer token to assign template ownership
2. **Default Scope**: Templates default to 'org' scope (safe default for privacy)
3. **Optional Authentication**: Unauthenticated requests create global templates (public access)
4. **Input Validation**: FastAPI/Pydantic validates request schema

#### **Design Decisions**

**Why optional authentication?**
- Allows creation of public/global templates without auth (community templates)
- Enables private org-scoped templates with auth (enterprise use case)
- Supports both open-source and SaaS deployment models

**Why default to 'org' scope?**
- Privacy-first: Templates are private by default
- Prevents accidental public disclosure of sensitive workflows
- Explicit opt-in required for global templates

**Why extract org_id from Bearer token?**
- Trusted source: Server-generated token (not user-provided)
- Prevents spoofing: User cannot fake their organization ID
- Consistent with session-based authentication

#### **Constraints & Edge Cases**

- **No org_id validation**: org_id extracted from token is not validated (regex, length, format)
- **Bearer token format**: Assumes base64-encoded session path format
- **Error disclosure**: Exception details leaked to HTTP clients (security issue)
- **No rate limiting**: Vulnerable to DOS via excessive POST requests

#### **Why This Approach?**

**Alternative 1**: Extract org_id from request body  
❌ Rejected: User could spoof org_id, bypass multi-tenant isolation

**Alternative 2**: Require org_id in JWT claims  
⚠️ Future: Production should use JWT with org_id claim (current is MVP)

**Alternative 3**: Separate endpoints for org vs. global templates  
❌ Rejected: Adds complexity, scope field provides same functionality

**Chosen Approach**: Extract org_id from Bearer token, default scope='org'  
✅ Simple, secure (trusted token), supports multiple deployment models

---

### **2. Transformation Logic: create_template() [Business Logic]**

**File**: `repos/metabob-rpc-api/server/actions/activity.py`  
**Function**: `create_template`  
**Lines**: 275-426

#### **Purpose in Flow**

Core business logic for template variant management in activity-template-scope-isolation. Orchestrates template creation with scope/org_id assignment, idempotency checking, genealogy tracking, and cache coordination.

#### **Data Transformation**

```
Input:  Dict[str, Any] + scope: str + org_id: Optional[str]
        {
          "name": "template-name",
          "task_steps": [...],
          ...
        }

Output: Dict[str, Any] (enriched with IDs, genealogy, scope/org_id)
        {
          "variant_id": "template-name-a1b2c3d4",
          "activity_id": "template-name",
          "scope": "org",
          "org_id": "uuid",
          "genealogy": {
            "content_hash": "a1b2c3d4",
            "parent_hash": null,
            "generation": 0
          },
          "created_at": "ISO8601"
        }
```

#### **Business Logic Enforced**

1. **Content-Addressable IDs**: Same content = same variant_id (idempotency)
2. **Template Genealogy**: Track template evolution (parent_hash, generation)
3. **Cache-Aside Pattern**: Write to SurrealDB FIRST, then Redis cache
4. **Scope Persistence**: scope and org_id flow through all layers unchanged
5. **Thompson Sampling Initialization**: Create metrics for variant selection

#### **Design Decisions**

**Why content-addressable variant IDs?**
- **Idempotency**: Duplicate creates return existing variant (safe to retry)
- **Deduplication**: Identical templates share same variant_id (save storage)
- **Integrity**: Content changes = new variant_id (prevents silent corruption)

**Why genealogy tracking (parent_hash, generation)?**
- **Template Evolution**: Track how templates change over time
- **Lineage Visualization**: Show variant history (future feature)
- **Rollback Support**: Return to previous variant if new one fails
- **Learning**: Analyze which template changes improve success rate

**Why SurrealDB write BEFORE Redis cache?**
- **Consistency**: SurrealDB is source of truth (Redis is cache)
- **Durability**: Failure after DB write = data persisted (failure after cache = no data loss)
- **Cache Invalidation**: Cache failures are non-fatal (graceful degradation)

**Why check Redis for idempotency BEFORE SurrealDB write?**
- **Performance**: Redis faster than SurrealDB for existence check
- **Reduced Load**: Avoid duplicate DB writes (idempotent creates)
- **Cache Warming**: Idempotent check populates cache for future reads

#### **Constraints & Edge Cases**

- **Idempotency relies on Redis**: If Redis is down, duplicate variants may be created
- **No distributed lock**: Concurrent creates with same content may create duplicates
- **Genealogy assumes single lineage**: Merging variants from different parents not supported
- **Cache TTL may expire**: Variant may be re-created after cache expiration (rare)

#### **Why This Approach?**

**Alternative 1**: Use database unique constraint for idempotency  
❌ Rejected: Database error on duplicate (not idempotent return)

**Alternative 2**: Check SurrealDB for existence before create  
⚠️ Slower: Extra DB query for every create (performance hit)

**Alternative 3**: Generate UUID for variant_id  
❌ Rejected: Loses idempotency, deduplication, and content integrity

**Chosen Approach**: Content-addressable IDs + Redis idempotency check + SurrealDB persistence  
✅ Fast, idempotent, deduplicated, durable

---

### **3. Integration Boundary: create_template_record() [Data Access]**

**File**: `repos/metabob-rpc-api/server/db/operations/template_data.py`  
**Function**: `create_template_record`  
**Lines**: 26-64

#### **Purpose in Flow**

Database integration point for activity-template-scope-isolation. Enforces SurrealDB schema constraints on scope and org_id fields, persists template to primary storage.

#### **Data Transformation**

```
Input:  Dict[str, Any] (template with scope + org_id)
        {
          "variant_id": "template-name-a1b2c3d4",
          "scope": "org",
          "org_id": "uuid",
          ...
        }

Output: Dict[str, Any] (SurrealDB record with timestamps)
        {
          "id": "activity_template:template-name-a1b2c3d4",
          "variant_id": "template-name-a1b2c3d4",
          "scope": "org",
          "org_id": "uuid",
          "created_at": "2026-03-01T12:00:00Z",
          "updated_at": "2026-03-01T12:00:00Z",
          ...
        }
```

#### **Business Logic Enforced**

1. **Deterministic Record IDs**: `record_id = f"activity_template:{variant_id}"`
2. **Timestamp Enforcement**: Always set created_at and updated_at (audit trail)
3. **Schema Enforcement**: SurrealDB validates scope (string, default='org') and org_id (string)
4. **Idempotent Lookups**: Deterministic IDs enable GET by variant_id

#### **Design Decisions**

**Why deterministic record IDs instead of auto-generated?**
- **Idempotent Lookups**: Can find template by variant_id without index
- **Predictable Queries**: Know record ID before querying (no search needed)
- **Consistent Naming**: Table prefix + variant_id = record_id
- **Simplified Caching**: Redis key matches SurrealDB record ID

**Why overwrite timestamps instead of preserving from input?**
- **Trust Boundary**: Database is source of truth for timestamps
- **Audit Trail**: Ensure accurate record of when data was persisted
- **Prevents Spoofing**: User cannot fake created_at/updated_at

**Why validate variant_id but not org_id?**
- **Critical Field**: variant_id is primary identifier (must exist)
- **MVP Scope**: org_id validation deferred to route layer (business logic)
- **Parameterized Queries**: SurrealDB prevents SQL injection (safe without validation)

#### **Constraints & Edge Cases**

- **No retry logic**: Transient DB failures fail immediately (no resilience)
- **No connection pooling**: Singleton connection may bottleneck (performance)
- **No circuit breaker**: Repeated failures cascade to route layer (availability)
- **Deterministic IDs prevent history**: Cannot store multiple versions with same variant_id

#### **Why This Approach?**

**Alternative 1**: Auto-generated UUIDs for record IDs  
❌ Rejected: Requires separate index, slower lookups, more complex caching

**Alternative 2**: Composite key (template_id + generation)  
⚠️ Complexity: Would require compound queries, harder to cache

**Alternative 3**: Let SurrealDB generate timestamps  
❌ Rejected: Less control, harder to mock for testing

**Chosen Approach**: Deterministic record IDs + server-generated timestamps  
✅ Simple lookups, predictable caching, audit trail control

---

### **4. Query Filtering: list_all_templates() [Data Access]**

**File**: `repos/metabob-rpc-api/server/db/operations/template_data.py`  
**Function**: `list_all_templates`  
**Lines**: 95-144

#### **Purpose in Flow**

Multi-tenant query filtering for activity-template-scope-isolation LIST flow. Enforces scope-based access control at database level (first line of defense).

#### **Data Transformation**

```
Input:  limit: int + org_id: Optional[str]

Output: List[Dict[str, Any]] (filtered templates)
        [
          {
            "id": "activity_template:...",
            "variant_id": "...",
            "scope": "org",
            "org_id": "uuid",
            ...
          }
        ]
```

#### **Business Logic Enforced**

1. **Multi-Tenant Filtering**: WITH org_id → returns global + org-scoped templates
2. **Public Access**: WITHOUT org_id → returns only global templates
3. **Database-Level Security**: Filtering at source (defense-in-depth layer 1)
4. **Index Utilization**: Uses `activity_template_org_idx` for efficient queries

#### **SurrealDB Query Logic**

**WITH org_id (authenticated user)**:
```sql
SELECT * FROM activity_template
WHERE scope IS NULL 
   OR scope = 'global' 
   OR (scope = 'org' AND org_id = $org_id)
ORDER BY created_at DESC
LIMIT $limit
```

**WITHOUT org_id (unauthenticated user)**:
```sql
SELECT * FROM activity_template
WHERE scope IS NULL OR scope = 'global'
ORDER BY created_at DESC
LIMIT $limit
```

#### **Design Decisions**

**Why filter at database level instead of application level only?**
- **Security**: First line of defense (prevents unauthorized data from leaving DB)
- **Performance**: Database filtering is faster (indexed queries, less data transfer)
- **Compliance**: Audit logs show filtered queries (demonstrable access control)
- **Defense-in-Depth**: Application filtering is second layer (redundancy)

**Why allow scope=NULL as global?**
- **Backward Compatibility**: Existing templates without scope field are global
- **Migration Path**: Can gradually add scope to templates without breaking
- **Explicit Intent**: NULL means "no restriction" (opt-in for privacy)

**Why index on org_id instead of (scope, org_id)?**
- **Query Pattern**: Most queries filter by org_id only (not scope)
- **Index Size**: Single-column index is smaller (faster, less storage)
- **Sufficient Performance**: org_id index + scope filter in WHERE clause is fast enough

#### **Constraints & Edge Cases**

- **No pagination support**: Returns first N templates (no offset or cursor)
- **No sorting options**: Always sorts by created_at DESC (newest first)
- **No full-text search**: Cannot search by name or description (future feature)
- **Project-scoped templates not implemented**: scope='project' filtered out

#### **Why This Approach?**

**Alternative 1**: Filter in application layer only  
❌ Rejected: Fetches all templates from DB (security + performance issue)

**Alternative 2**: Separate tables for global vs. org templates  
❌ Rejected: Complicates queries, harder to change scope

**Alternative 3**: Row-level security (RLS) in database  
⚠️ Future: SurrealDB RLS not yet implemented (would be ideal)

**Chosen Approach**: Parameterized WHERE clause + org_id index  
✅ Secure, performant, flexible, defense-in-depth

---

### **5. Exit Point: list_templates() [Business Logic + Response]**

**File**: `repos/metabob-rpc-api/server/actions/activity.py`  
**Function**: `list_templates`  
**Lines**: 87-218

#### **Purpose in Flow**

Orchestrates LIST flow for activity-template-scope-isolation, combining cache-aside pattern, multi-tenant filtering, and Thompson Sampling ranking for response.

#### **Data Transformation**

```
Input:  category: Optional[str] + limit: int + org_id: Optional[str]

Output: List[Dict[str, Any]] (filtered, enriched, ranked templates)
        [
          {
            "variant_id": "...",
            "scope": "org",
            "org_id": "uuid",
            "expected_value": 0.85,
            "success_rate": 0.90,
            "total_selections": 15,
            ...
          }
        ]
```

#### **Business Logic Enforced**

1. **Cache-Aside Pattern**: Check Redis → On miss, query SurrealDB → Populate cache
2. **Defense-in-Depth Filtering**: In-memory scope/org_id check (second layer)
3. **Thompson Sampling Ranking**: Calculate expected_value, sort by performance
4. **Metrics Enrichment**: Load Thompson Sampling metrics from Redis
5. **Category Filtering**: Optional filter by activity category

#### **Multi-Stage Processing**

**Stage 1: Cache Check** (lines 111-114)
```python
template_ids_bytes = redis.smembers("activity:templates:list")
if not template_ids_bytes:
    # CACHE MISS - Load from SurrealDB
```

**Stage 2: Database Query on Miss** (lines 115-153)
```python
templates_from_db = list_all_templates(limit=limit * 2, org_id=org_id)
for tmpl in templates_from_db:
    redis.setex(f"activity:template:{variant_id}", TEMPLATE_CACHE_TTL, json.dumps(tmpl))
```

**Stage 3: In-Memory Filtering** (lines 171-188)
```python
if template_scope == "org":
    if not org_id or template_org_id != org_id:
        continue  # Skip unauthorized template
```

**Stage 4: Metrics Enrichment** (lines 190-211)
```python
success_rate = alpha / (alpha + beta)
expected_value = success_rate * quality_score
```

**Stage 5: Ranking** (lines 215-218)
```python
templates.sort(key=lambda t: t.get("expected_value", 0), reverse=True)
return templates[:limit]
```

#### **Design Decisions**

**Why cache-aside pattern instead of read-through cache?**
- **Flexibility**: Can customize cache population logic (e.g., limit * 2)
- **Control**: Explicit cache writes (easier to debug)
- **Non-Fatal Failures**: Cache miss falls back to DB (graceful degradation)

**Why in-memory filtering after database filtering?**
- **Defense-in-Depth**: Second layer protects against cache poisoning
- **Category Filtering**: Application-level filter (not in database schema)
- **Future Extensibility**: Can add complex filters without changing schema

**Why Thompson Sampling for ranking instead of fixed order?**
- **Learning**: Automatically favors successful templates over time
- **Exploration**: New templates get chances to prove themselves
- **No Manual Tuning**: Self-optimizing ranking based on execution outcomes

**Why load metrics separately instead of JOIN?**
- **Cache Independence**: Template cache and metrics cache have different TTLs
- **Freshness**: Metrics update frequently (5 min), templates change rarely (1 hour)
- **Non-Blocking**: Missing metrics don't prevent template listing (default to 0.5)

#### **Constraints & Edge Cases**

- **Redis list set has no TTL**: Grows unbounded (memory leak risk)
- **Cache miss loads limit * 2**: Overfetches to populate cache (tradeoff for future hits)
- **No distributed cache invalidation**: Cache updates are passive (TTL-based)
- **Sorting in-memory**: Large result sets (>1000) may be slow (consider DB sorting)

#### **Why This Approach?**

**Alternative 1**: Always query database (no caching)  
❌ Rejected: High latency, high DB load, poor scalability

**Alternative 2**: Read-through cache (transparent caching)  
⚠️ Complexity: Harder to debug, less control over cache population

**Alternative 3**: Cache entire list (not individual templates)  
❌ Rejected: Large memory usage, cache invalidation on any template change

**Alternative 4**: Thompson Sampling in database (stored procedure)  
❌ Rejected: Database doesn't have metrics (stored in Redis)

**Chosen Approach**: Cache-aside + in-memory filtering + Thompson Sampling ranking  
✅ Fast, flexible, secure, self-optimizing

---

## 📊 Annotation Summary

### **Components Annotated**: 5 critical components

| Component | Type | Purpose | Key Decision |
|-----------|------|---------|--------------|
| **create_activity_template** | Entry Point | HTTP POST handler | Extract org_id from Bearer token |
| **create_template** | Business Logic | Template variant management | Content-addressable IDs for idempotency |
| **create_template_record** | Data Access | SurrealDB persistence | Deterministic record IDs |
| **list_all_templates** | Data Access | Multi-tenant query | Database-level scope filtering |
| **list_templates** | Exit Point | Cache-aside + ranking | Thompson Sampling for self-optimization |

### **Key Design Decisions Documented**

1. **Multi-Tenant Isolation**:
   - Extract org_id from trusted Bearer token (not user input)
   - Default scope='org' for privacy-first approach
   - Defense-in-depth: Database + application filtering

2. **Idempotency & Deduplication**:
   - Content-addressable variant IDs (SHA256 of task_steps + description)
   - Redis check before SurrealDB write (fast idempotency)
   - Deterministic record IDs enable simple lookups

3. **Cache Architecture**:
   - SurrealDB primary storage (source of truth)
   - Redis cache with TTL (performance layer)
   - Cache-aside pattern (explicit control, graceful degradation)

4. **Template Evolution**:
   - Genealogy tracking (parent_hash, generation)
   - Supports lineage visualization and rollback
   - Enables learning from template changes

5. **Self-Optimizing Ranking**:
   - Thompson Sampling based on execution outcomes
   - Automatic exploration/exploitation balance
   - No manual tuning required

### **Business Context Captured**

- **Why multi-tenancy**: Support SaaS deployment with org isolation
- **Why optional auth**: Enable both open-source (public templates) and SaaS (private templates)
- **Why genealogy**: Learn which template changes improve success rates
- **Why Thompson Sampling**: Automatically promote successful templates
- **Why cache-aside**: Fast reads, graceful degradation on cache failures

### **Constraints & Trade-offs Documented**

- **Idempotency depends on Redis**: Cache miss may create duplicates
- **No distributed locking**: Concurrent creates may race
- **MVP org_id extraction**: Uses full session path (should extract just org portion)
- **Redis list set memory leak**: No TTL on template list set
- **No circuit breaker**: SurrealDB failures cascade

### **Alternative Approaches Evaluated**

- **10 alternatives considered** across 5 components
- **Rejected approaches** documented with reasoning
- **Future improvements** noted (JWT with org_id claim, RLS, async clients)

---

## 🎯 Why These Annotations Matter

1. **Onboarding**: New developers understand WHY decisions were made
2. **Debugging**: Know design constraints when investigating issues
3. **Evolution**: Understand trade-offs before making changes
4. **Compliance**: Document security controls for audits
5. **Knowledge Preservation**: Prevent loss of design rationale

---

**End of Component Annotations**
