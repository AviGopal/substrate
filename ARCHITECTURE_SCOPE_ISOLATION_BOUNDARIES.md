# Activity Template Scope Isolation - Architectural Boundaries Analysis

**Feature**: activity-template-scope-isolation  
**Date**: 2026-03-01  
**Purpose**: Validate architectural soundness for deployment

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  HTTP/REST Client (OpenCode CLI, Web UI, External Services)     │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓ HTTP/REST (FastAPI)
┌─────────────────────────────────────────────────────────────────┐
│                      ROUTE HANDLER LAYER                         │
│  repos/metabob-rpc-api/server/routes/activity.py                │
│  • HTTP request parsing                                          │
│  • Authentication/authorization                                  │
│  • Input validation (Pydantic)                                   │
│  • Error handling (HTTPException)                                │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓ Function Call (Internal)
┌─────────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                          │
│  repos/metabob-rpc-api/server/actions/activity.py               │
│  • Template variant management                                   │
│  • Thompson Sampling algorithms                                  │
│  • Genealogy tracking                                            │
│  • Cache orchestration (Redis)                                   │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓ Function Call (Internal)
┌─────────────────────────────────────────────────────────────────┐
│                   DATA ACCESS LAYER                              │
│  repos/metabob-rpc-api/server/db/operations/template_data.py    │
│  • CRUD operations                                               │
│  • Query building                                                │
│  • SurrealDB client management                                   │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓ Database Protocol
┌─────────────────────────────────────────────────────────────────┐
│                    DATA STORE LAYER                              │
│  ┌─────────────────────┐     ┌──────────────────────────┐       │
│  │ SurrealDB (PRIMARY) │     │ Redis (CACHE)            │       │
│  │ TCP/HTTP Connection │     │ In-memory key-value      │       │
│  │ Port: 8000          │     │ Port: 6379               │       │
│  └─────────────────────┘     └──────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Boundary Analysis

### **Boundary 1: HTTP/REST API Boundary**

**Type**: Service Boundary (External)

**Location**: Client → Route Handler Layer (routes/activity.py)

**Contract**:
```python
# POST /v2/activities/templates
Request Headers:
  Authorization: Bearer <base64-encoded-session-token> (OPTIONAL)
Request Body (JSON):
  {
    "name": str,
    "description": str,
    "category": str,
    "scope": "org" | "project" | "global" (optional, default='org'),
    "task_steps": List[Dict],
    "variables": Dict,
    "context_requirements": List[str]
  }
Response (201 Created):
  {
    "variant_id": str,
    "activity_id": str,
    "scope": str,
    "org_id": str | null,
    "genealogy": {...}
  }

# GET /v2/activities/templates
Request Headers:
  Authorization: Bearer <base64-encoded-session-token> (OPTIONAL)
Query Params:
  category: str (optional)
  limit: int (default=50, max=100)
Response (200 OK):
  {
    "templates": [
      {"variant_id": str, "scope": str, "org_id": str | null, ...}
    ]
  }
```

**Coupling**: Loose (REST/HTTP, JSON, versioned API)

**Resilience**:
- Error handling: try/except with HTTPException (status 500)
- Validation errors: HTTPException status 400
- Optional authentication (auto_error=False)
- No rate limiting ⚠️

---

### **Boundary 2: Route Handler → Business Logic**

**Type**: Layer Boundary (Internal)

**Location**: routes/activity.py → actions/activity.py

**Contract**:
```python
from server.actions.activity import (
    list_templates,
    create_template,
    get_template_by_id,
    ...
)

# Function signatures:
def list_templates(
    redis: StrictRedis,
    category: Optional[str] = None,
    limit: int = 50,
    org_id: Optional[str] = None,
) -> List[Dict[str, Any]]

def create_template(
    redis: StrictRedis,
    template_data: Dict[str, Any],
    scope: str = "org",
    org_id: Optional[str] = None,
) -> Dict[str, Any]
```

**Coupling**: Tight (direct Python calls, shared data structures)

**Resilience**:
- Route layer catches all exceptions from business logic
- HTTPException raised with status 500 on business logic errors
- Logging with exc_info=True for stack traces

---

### **Boundary 3: Business Logic → Data Access**

**Type**: Layer Boundary (Internal)

**Location**: actions/activity.py → db/operations/template_data.py

**Contract**:
```python
from server.db.operations import (
    create_template_record,
    get_template_by_variant_id,
    list_all_templates,
    create_metrics,
    ...
)

# Function signatures:
def create_template_record(template_data: Dict[str, Any]) -> Dict[str, Any]
def list_all_templates(limit: int = 100, org_id: Optional[str] = None) -> List[Dict[str, Any]]

# Constants:
TEMPLATE_CACHE_TTL = 3600  # 1 hour
METRICS_CACHE_TTL = 300    # 5 minutes
```

**Coupling**: Medium (Python calls, no shared state, stateless functions)

**Resilience**:
- SurrealDB write failure: raise (propagate to route layer)
- Redis cache write failure: log warning, don't raise (non-fatal)
- Cache-aside pattern: SurrealDB FIRST, then Redis cache

---

### **Boundary 4: Data Access → SurrealDB**

**Type**: Data Store Boundary (External)

**Location**: db/operations/template_data.py → SurrealDB Server (TCP/HTTP)

**Contract**:
```sql
-- Database schema
DEFINE TABLE IF NOT EXISTS activity_template SCHEMAFULL;
DEFINE FIELD scope ON activity_template TYPE string DEFAULT 'org';
DEFINE FIELD org_id ON activity_template TYPE string;
DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;

-- Client connection
from surrealdb import Surreal
url: "http://localhost:8000"
namespace: "devbob"
database: "activity_learning"
```

**Coupling**: Loose (HTTP/WebSocket protocol, SurrealQL, schema-enforced)

**Resilience**:
- Singleton connection (lazy initialization)
- Parameterized queries (SQL injection protection)
- No connection retry logic ⚠️
- No circuit breaker ⚠️
- No connection pooling ⚠️

---

### **Boundary 5: Business Logic → Redis**

**Type**: Data Store Boundary (External)

**Location**: actions/activity.py → Redis Server (TCP)

**Contract**:
```python
# Redis client
from redis import StrictRedis
uri: "redis://localhost:6379/0"

# Cache keys:
activity:template:{variant_id} → JSON (TTL: 3600s)
activity:templates:list → Set[variant_id] (no TTL ⚠️)
activity:metrics:{variant_id} → JSON (TTL: 300s)
```

**Coupling**: Loose (TCP, key-value, JSON, synchronous client)

**Resilience**:
- Cache write failure: log warning, don't raise (non-fatal)
- Cache read failure: treat as cache miss, fallback to SurrealDB
- TTL-based expiration (passive invalidation)
- No connection retry logic ⚠️
- No connection pooling ⚠️

---

## 🔐 Security Boundaries

### **Multi-Tenant Isolation**

**Enforcement Points**:
1. HTTP Layer (routes/activity.py): Extract org_id from Bearer token
2. Database Layer (template_data.py): SQL WHERE clause filtering
3. Business Logic (activity.py): In-memory filtering (defense-in-depth)

**Trust Boundary**:
- Trusted: Internal layers (routes, actions, db)
- Untrusted: HTTP clients, Bearer tokens

**Token Format**:
```
Raw: c2Vzc2lvbnM6MzEzNTg4M2MtOGJlMy00YjJiLWJkZDgtZGJlMmU0MjczNThmOmRlZmF1bHQ6NWY4ODcyMDMtZDEwZi00YTQ5LTlmMGEtMGY5OTRkZTQ4YWEw
Decoded: sessions:3135883c-8be3-4b2b-bdd8-dbe2e427358f:default:5f887203-d10f-4a49-9f0a-0f994de48aa0
org_id: 3135883c-8be3-4b2b-bdd8-dbe2e427358f:default:5f887203-d10f-4a49-9f0a-0f994de48aa0
```

---

## 📊 Dependency Summary

### **External Dependencies**

| Package | Version | Purpose | Boundary |
|---------|---------|---------|----------|
| fastapi | 0.115.12 | HTTP server | HTTP API |
| pydantic | 2.11.3 | Validation | HTTP API |
| redis | 5.2.1 | Cache client | Redis |
| surrealdb | 1.0.8 | DB client | SurrealDB |

### **Internal Dependencies**

```
routes/activity.py
  ↓
actions/activity.py
  ↓
db/operations/template_data.py
  ↓
db/surrealdb_client.py
```

**Dependency Direction**: ✅ Correct (no circular dependencies)

---

## 🎯 Architectural Patterns

1. **Layered Architecture** ✅ (Clear separation: routes → actions → db)
2. **Cache-Aside Pattern** ✅ (SurrealDB primary, Redis cache)
3. **Dependency Injection** ✅ (FastAPI Depends)
4. **Singleton Pattern** ⚠️ (Redis/SurrealDB connections, no pooling)

---

## 🚨 Risks & Recommendations

### **High Priority** 🔴

1. **No Circuit Breaker for SurrealDB**
   - Risk: Repeated failures block all writes
   - Fix: Implement circuit breaker (pybreaker)

2. **Error Messages Expose Internal Details**
   - Risk: Information disclosure
   - Fix: Return generic errors to clients

3. **No Rate Limiting**
   - Risk: DOS attacks
   - Fix: Implement rate limiting (slowapi)

### **Medium Priority** 🟡

4. **No Connection Pooling**
   - Risk: Single connection bottleneck
   - Fix: Implement connection pools

5. **Hardcoded Cache TTLs**
   - Risk: Cannot adjust without code changes
   - Fix: Move to configuration

6. **Redis list Set Has No TTL**
   - Risk: Unbounded memory growth
   - Fix: Add periodic cleanup

### **Low Priority** 🟢

7. **No API Versioning Strategy**
   - Risk: Breaking changes affect all clients
   - Fix: Document versioning policy

8. **No Health Check Endpoint**
   - Risk: Cannot detect failures
   - Fix: Add /health endpoint

---

## ✅ Assessment

**For MVP**: ✅ READY
- Core functionality works
- Multi-tenant isolation enforced
- Graceful cache degradation

**For Production**: ⚠️ NEEDS WORK
- Add circuit breaker
- Implement rate limiting
- Add health checks
- Improve error handling
- Configure connection pooling

---

**Overall**: Architecture is **sound for MVP** but requires **hardening for production**. Layer separation is clean, cache-aside pattern is correct, multi-tenant isolation is enforced. Main concerns are resilience and operational visibility.

---

**End of Analysis**
