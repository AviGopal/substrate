# Activity Template Scope Isolation - Data Transformations Summary

**Feature**: activity-template-scope-isolation  
**Date**: 2026-03-01

---

## 🎯 Quick Reference

### **CREATE Flow (7 Transformations)**

| Step | Transformation | Key Change | Purpose |
|------|---------------|------------|---------|
| 1 | HTTP → Route Handler | Extract scope (default='org'), org_id from token | Multi-tenant input |
| 2 | Bearer Token → org_id | Base64 decode, strip "sessions:" | Extract org identifier |
| 3 | Request → Template Dict | Generate IDs, add genealogy, scope/org_id | Enrich with metadata |
| 4 | Dict → SurrealDB | Add timestamps, record_id, write to DB | Persist with schema |
| 5 | (Cache Write) | Template → Redis (TTL=1hr) | Performance optimization |
| 6 | (Metrics Init) | Create Thompson Sampling metrics | Template ranking |
| 7 | Response Formatting | Template Dict → JSON response | Return to client |

### **LIST Flow (6 Transformations)**

| Step | Transformation | Key Change | Purpose |
|------|---------------|------------|---------|
| 1 | HTTP → Route Handler | Extract query params, org_id from token | Multi-tenant query setup |
| 2 | Cache Check | Redis lookup for template list | Performance optimization |
| 3 | DB Query (on miss) | SurrealDB query with scope/org_id filter | Security enforcement |
| 4 | Cache Population | DB results → Redis cache | Future performance |
| 5 | In-Memory Filtering | Filter by category, scope, org_id | Defense-in-depth |
| 6 | Metrics Enrichment | Load metrics, calculate expected_value | Template ranking |
| 7 | Sorting & Response | Sort by expected_value, format JSON | Return to client |

---

## 🔐 Security Transformations

### **Multi-Tenant Isolation (Defense-in-Depth)**

**Layer 1: Bearer Token Extraction** (routes/activity.py)
```python
session_id = session_id_from_token(credentials.credentials)
org_id = session_id  # MVP: using session_id as org_id
```
**Why**: Extract user's organization context from authenticated session

**Layer 2: Database Query Filtering** (template_data.py)
```sql
WHERE scope IS NULL OR scope = 'global' 
   OR (scope = 'org' AND org_id = $org_id)
```
**Why**: First line of defense, prevents unauthorized data from leaving DB

**Layer 3: Application Filtering** (activity.py)
```python
if template_scope == "org":
    if not org_id or template_org_id != org_id:
        continue  # Skip this template
```
**Why**: Second line of defense, protects against cache poisoning

---

## ⚡ Performance Transformations

### **Cache-Aside Pattern**

**Write Path** (create_template):
```python
# 1. Write to SurrealDB FIRST (source of truth)
create_template_record(template)

# 2. Cache in Redis (with TTL)
redis.setex(f"activity:template:{variant_id}", 3600, json.dumps(template))
```

**Read Path** (list_templates):
```python
# 1. Check Redis cache
template_ids = redis.smembers("activity:templates:list")

# 2. On miss: Query SurrealDB
if not template_ids:
    templates = list_all_templates(org_id=org_id)
    # 3. Populate cache for future reads
    for tmpl in templates:
        redis.setex(f"activity:template:{variant_id}", 3600, json.dumps(tmpl))
```

**Why**: Reduces database load, improves response time (1hr TTL balances freshness/performance)

---

## 🔄 ID Generation Transformations

### **Template ID** (Human-Readable)
```python
"Add Feature" → "add-feature"
```
**Algorithm**: Lowercase, replace spaces/underscores with hyphens  
**Why**: URL-safe, groups variants by template family

### **Content Hash** (Content-Addressable)
```python
{ task_steps: [...], description: "..." } → "a1b2c3d4"
```
**Algorithm**: SHA256 of task_steps + description (first 8 chars)  
**Why**: Detect duplicate variants, enable idempotency

### **Variant ID** (Unique Identifier)
```python
template_id="add-feature" + content_hash="a1b2c3d4" → "add-feature-a1b2c3d4"
```
**Algorithm**: Concatenate with hyphen  
**Why**: Unique identifier combining family and content

---

## 📊 Type Conversions

### **CREATE Flow**

```
HTTP Request (JSON)
  → Dict[str, Any] (FastAPI parsing)
  → scope: str (extracted with default)
  → org_id: Optional[str] (from Bearer token)
  → template: Dict[str, Any] (enriched with IDs, timestamps, genealogy)
  → SurrealDB record (persisted with schema enforcement)
  → Redis cache (JSON serialized, TTL=1hr)
  → HTTP Response (JSON)
```

### **LIST Flow**

```
HTTP Request (query params)
  → category: Optional[str], limit: int (validated)
  → org_id: Optional[str] (from Bearer token)
  → Redis check: Set[bytes] → List[str] (decoded)
  → SurrealDB query (if cache miss)
  → Templates: List[Dict] (filtered by scope/org_id)
  → Metrics: Dict (JSON parsed from Redis)
  → Enriched templates: List[Dict] (with expected_value, success_rate)
  → HTTP Response (JSON)
```

---

## ✅ Validation Rules

| Field | Rule | Layer | Reason |
|-------|------|-------|--------|
| **scope** | Default 'org' | Route + DB | Safe default for multi-tenancy |
| **org_id** | Optional (can be null) | Route | Support global templates |
| **variant_id** | Required | DB write | Primary identifier |
| **limit** | ≤ 100 | FastAPI | Prevent DOS attacks |
| **Bearer token** | Base64 decodable | Auth helper | Graceful error handling |
| **created_at** | ISO 8601 timestamp | DB write | Consistent format |
| **content_hash** | SHA256 (8 chars) | ID generation | Cryptographically secure |

---

## 🎨 Business Logic Transformations

### **Genealogy Calculation**

```python
# Check for existing variants
existing_variants = redis.keys(f"activity:template:{template_id}-*")

if existing_variants:
    # NEW VARIANT of existing template
    max_generation = max(v["genealogy"]["generation"] for v in existing_variants)
    generation = max_generation + 1
    parent_hash = first_variant["genealogy"]["content_hash"]
else:
    # FIRST VARIANT (generation 0)
    generation = 0
    parent_hash = None
```

**Why**: Track template evolution, enable lineage visualization, support variant rollback

### **Thompson Sampling Metrics**

```python
# Calculate success rate (mean of Beta distribution)
success_rate = alpha / (alpha + beta)

# Calculate expected value (combines success and quality)
expected_value = success_rate * quality_score

# Sort templates by expected value
templates.sort(key=lambda t: t["expected_value"], reverse=True)
```

**Why**: Prioritize templates with proven success, balance exploration/exploitation

---

## 🚨 Side Effects

### **CREATE Flow**

1. **Redis Read** (line 304): Check for existing variant (idempotency)
2. **Redis Keys Scan** (line 311): Find existing variants (genealogy)
3. **SurrealDB Write** (line 372): Persist template (primary storage)
4. **Redis Write** (line 380): Cache template (performance)
5. **Redis Write** (line 418): Cache metrics (Thompson Sampling)
6. **Index Update**: SurrealDB updates `activity_template_org_idx`

### **LIST Flow**

1. **Redis Read** (line 112): Check template list cache
2. **SurrealDB Query** (line 118, on miss): Load templates from DB
3. **Redis Write** (line 127, on miss): Populate cache
4. **Redis Read** (line 164): Load template details
5. **Redis Read** (line 191): Load metrics

---

## 🔍 Alternative Approaches (from TODOs)

### **org_id Extraction**
```python
# Current (MVP):
org_id = session_id  # Full session path

# TODO (Production):
# 1. Implement proper JWT token decoding
# 2. Extract org_id from JWT claims
# 3. OR: Extend SessionData model to include org_id field
```

### **Idempotency Check**
```python
# Current:
existing = redis.get(f"activity:template:{variant_id}")  # Redis cache

# Alternative:
# Check SurrealDB directly (slower but more reliable)
# Trade-off: Performance vs. reliability
```

### **Project-Scoped Templates**
```python
# Current:
if template_scope == "project":
    continue  # Skip for now

# TODO:
# Add project_id filtering when project context available
```

---

## 📋 Constraints Enforced

### **Database Schema** (SurrealDB)

```sql
DEFINE FIELD scope ON activity_template TYPE string DEFAULT 'org';
DEFINE FIELD org_id ON activity_template TYPE string;
DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;
```

**Constraints**:
- `scope` defaults to 'org' (safe default)
- `org_id` can be null (global templates)
- Index on `org_id` for efficient queries

### **Application Logic**

- Template IDs are deterministic (idempotent creation)
- Content hashes detect duplicate variants
- Genealogy tracks template evolution
- Multi-tenant filtering at DB and application layers
- Cache TTL prevents stale data (1 hour)

---

## 🎯 Business Requirements Satisfied

| Requirement | Implementation | Validation |
|-------------|---------------|------------|
| **Multi-Tenant Isolation** | scope + org_id fields, defense-in-depth filtering | ✅ Tested |
| **Template Variants** | Content-addressable IDs, genealogy tracking | ✅ Tested |
| **Idempotency** | Check existing variant before creation | ✅ Tested |
| **Performance** | Cache-aside pattern, indexed queries | ✅ Tested |
| **Security** | Optional auth, scope-based access control | ✅ Tested |
| **Scalability** | Deterministic IDs, distributed-friendly | ✅ Tested |

---

**Related Documentation**:
- ACTIVITY_TEMPLATE_SCOPE_DATA_TRANSFORMATIONS.md (detailed analysis)
- ACTIVITY_TEMPLATE_SCOPE_DEPENDENCY_CHAIN.md (dependency chain)
- ACTIVITY_TEMPLATE_SCOPE_ISOLATION_ENTRY_POINTS.md (entry points)

