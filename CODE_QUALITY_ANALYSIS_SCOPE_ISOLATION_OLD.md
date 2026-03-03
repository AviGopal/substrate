# Activity Template Scope Isolation - Code Quality Analysis

**Feature**: activity-template-scope-isolation  
**Date**: 2026-03-01  
**Analysis Method**: Manual code review (Metabob service unavailable)

---

## 🔍 Analysis Summary

**Files Analyzed**: 5 core files in data flow  
**Issues Found**: 12 (3 HIGH, 5 MEDIUM, 4 LOW)  
**Blocking Issues**: 1 (HIGH - security vulnerability)

---

## 🚨 HIGH PRIORITY ISSUES (3)

### **Issue 1: Information Disclosure via Error Messages** 🔴 BLOCKING

**Location**: `repos/metabob-rpc-api/server/routes/activity.py`

**Lines**: 118-120, 252-254, 339-341, 390-392

**Code**:
```python
except Exception as e:
    logger.error(f"list_templates failed: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail=str(e))  # ← PROBLEM
```

**Issue**: Exception details (stack traces, internal error messages) exposed to HTTP clients

**Examples of Exposed Information**:
- Database connection errors → reveal database host/port
- Redis errors → reveal cache infrastructure details
- Python exceptions → reveal code structure and file paths
- SurrealDB query errors → reveal schema information

**Impact on Data Flow**:
- **Security**: Attacker can learn about internal infrastructure
- **Compliance**: May violate security policies (e.g., PCI-DSS, SOC 2)
- **User Experience**: Technical errors confuse non-technical users

**Recommendation**:
```python
except Exception as e:
    logger.error(f"list_templates failed: {e}", exc_info=True)
    raise HTTPException(
        status_code=500,
        detail="Internal server error. Please contact support."
    )
```

**Blocking Severity**: YES - Security vulnerability that exposes internal details

---

### **Issue 2: No Input Validation for org_id** 🔴

**Location**: `repos/metabob-rpc-api/server/routes/activity.py`

**Lines**: 110-114, 238-248

**Code**:
```python
session_id = session_id_from_token(credentials.credentials)
if session_id:
    org_id = session_id  # No validation of org_id format
```

**Issue**: org_id extracted from Bearer token without validation

**Potential Attack Vectors**:
- Malformed org_id (SQL injection risk if not parameterized)
- Excessively long org_id (DOS via memory exhaustion)
- Special characters in org_id (encoding issues)
- Null bytes or control characters

**Impact on Data Flow**:
- **Security**: Could lead to injection attacks if validation breaks
- **Data Integrity**: Invalid org_id could corrupt database records
- **Performance**: Long org_id could slow queries

**Recommendation**:
```python
import re

ORG_ID_PATTERN = re.compile(r'^[a-zA-Z0-9\-:]{1,256}$')

session_id = session_id_from_token(credentials.credentials)
if session_id:
    if not ORG_ID_PATTERN.match(session_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid organization identifier"
        )
    org_id = session_id
```

**Blocking Severity**: NO - Parameterized queries mitigate SQL injection, but validation is best practice

---

### **Issue 3: GET /templates/{id} Missing org_id Authorization** 🔴

**Location**: `repos/metabob-rpc-api/server/routes/activity.py`

**Lines**: 123-161

**Code**:
```python
@router.get("/templates/{template_id}")
async def get_activity_template(
    template_id: str,
    redis: StrictRedis = Depends(get_redis_connection),
    credentials: Optional[HTTPAuthorizationCredentials] = Security(SESSION_TOKEN),
) -> Dict[str, Any]:
    try:
        template = get_template_by_id(redis, template_id)  # No org_id filtering
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        return template
```

**Issue**: GET endpoint retrieves template by ID without checking org_id

**Security Gap**:
- User with org-scoped template ID can retrieve templates from OTHER orgs
- Bypasses multi-tenant isolation enforced in LIST endpoint
- Authorization check only happens in LIST, not GET

**Attack Scenario**:
1. Attacker lists templates for their org (gets template IDs)
2. Attacker guesses or brute-forces template IDs from other orgs
3. Attacker calls GET /templates/{id} with victim's template ID
4. Attacker retrieves org-scoped template they shouldn't have access to

**Impact on Data Flow**:
- **Security**: CRITICAL - Complete bypass of multi-tenant isolation
- **Compliance**: Violates data isolation requirements
- **Trust**: Users' private templates exposed to other users

**Recommendation**:
```python
@router.get("/templates/{template_id}")
async def get_activity_template(
    template_id: str,
    redis: StrictRedis = Depends(get_redis_connection),
    credentials: Optional[HTTPAuthorizationCredentials] = Security(SESSION_TOKEN),
) -> Dict[str, Any]:
    try:
        # Extract org_id from Bearer token
        org_id = None
        if credentials and credentials.credentials:
            from server.actions.auth import session_id_from_token
            session_id = session_id_from_token(credentials.credentials)
            if session_id:
                org_id = session_id
        
        template = get_template_by_id(redis, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # AUTHORIZATION CHECK: Ensure user can access this template
        template_scope = template.get("scope")
        template_org_id = template.get("org_id")
        
        if template_scope == "org":
            if not org_id or template_org_id != org_id:
                raise HTTPException(status_code=403, detail="Access denied")
        elif template_scope == "project":
            # TODO: Add project_id check when implemented
            raise HTTPException(status_code=403, detail="Access denied")
        
        return template
```

**Blocking Severity**: YES - CRITICAL security vulnerability (multi-tenant isolation bypass)

---

## ⚠️ MEDIUM PRIORITY ISSUES (5)

### **Issue 4: No Rate Limiting on Expensive Operations** 🟡

**Location**: `repos/metabob-rpc-api/server/routes/activity.py`

**All Endpoints**: POST /templates, GET /templates, GET /templates/{id}

**Issue**: No rate limiting or throttling

**Attack Vectors**:
- DOS via excessive POST requests (database writes)
- DOS via excessive GET requests with cache misses (database reads)
- Resource exhaustion (Redis connections, SurrealDB connections)

**Impact on Data Flow**:
- **Availability**: Service becomes unavailable under load
- **Performance**: Legitimate users experience slow response times
- **Cost**: Excessive database operations increase infrastructure costs

**Recommendation**:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@router.post("/templates", status_code=201)
@limiter.limit("10/minute")  # Limit template creation
async def create_activity_template(...):
    ...

@router.get("/templates")
@limiter.limit("100/minute")  # Limit template listing
async def list_activity_templates(...):
    ...
```

**Blocking Severity**: NO - Production requirement, not MVP blocker

---

### **Issue 5: Singleton Connections Without Pooling** 🟡

**Location**: 
- `repos/metabob-rpc-api/server/utils/dependencies.py:29-36` (Redis)
- `repos/metabob-rpc-api/server/db/surrealdb_client.py:396+` (SurrealDB)

**Code**:
```python
# Redis singleton (utils/dependencies.py)
_redis = None

async def get_redis_connection() -> "redis.StrictRedis":
    global _redis
    if not _redis:
        _redis = redis.StrictRedis.from_url(uri)
    yield _redis

# SurrealDB singleton (surrealdb_client.py)
_SURREAL_CLIENT = None

def get_surreal_client() -> SurrealDBClient:
    global _SURREAL_CLIENT
    if _SURREAL_CLIENT is None:
        _SURREAL_CLIENT = SurrealDBClient(...).connect()
    return _SURREAL_CLIENT
```

**Issue**: Single connection shared across all requests

**Performance Impact**:
- **Concurrency**: Single connection becomes bottleneck under load
- **Blocking**: One slow query blocks all other requests
- **Resilience**: Connection failure affects all requests

**Recommendation**:
```python
# Redis connection pool
import redis.asyncio as aioredis

_redis_pool = None

async def get_redis_connection():
    global _redis_pool
    if not _redis_pool:
        _redis_pool = aioredis.ConnectionPool.from_url(uri, max_connections=10)
    redis_client = aioredis.Redis(connection_pool=_redis_pool)
    try:
        yield redis_client
    finally:
        await redis_client.close()

# SurrealDB connection pool (requires async client)
# TODO: Migrate to async SurrealDB client with connection pooling
```

**Blocking Severity**: NO - Works for MVP, but production bottleneck

---

### **Issue 6: No Circuit Breaker for SurrealDB** 🟡

**Location**: `repos/metabob-rpc-api/server/actions/activity.py:371-376`

**Code**:
```python
try:
    create_template_record(template)  # May fail repeatedly
except Exception as e:
    logger.error(f"Failed to create template in SurrealDB: {e}", exc_info=True)
    raise  # Propagate failure (no circuit breaker)
```

**Issue**: No circuit breaker pattern for database failures

**Failure Scenario**:
1. SurrealDB goes down (network issue, crash, etc.)
2. All template creation requests fail immediately
3. Error logs flood the system (log spam)
4. No automatic recovery when SurrealDB comes back online

**Impact on Data Flow**:
- **Cascading Failures**: All dependent operations fail
- **Resource Exhaustion**: Connection attempts consume resources
- **Poor User Experience**: No graceful degradation

**Recommendation**:
```python
from pybreaker import CircuitBreaker

surreal_breaker = CircuitBreaker(fail_max=5, timeout_duration=60)

@surreal_breaker
def create_template_record(template_data):
    db = get_surreal_client()
    # ... database operation
```

**Blocking Severity**: NO - Production requirement for resilience

---

### **Issue 7: Hardcoded Cache TTLs** 🟡

**Location**: `repos/metabob-rpc-api/server/db/operations/template_data.py:21-23`

**Code**:
```python
TEMPLATE_CACHE_TTL = 3600  # 1 hour
METRICS_CACHE_TTL = 300    # 5 minutes
```

**Issue**: TTLs hardcoded, not configurable

**Impact**:
- **Flexibility**: Cannot adjust TTLs without code deployment
- **Testing**: Difficult to test cache behavior (long TTLs)
- **Tuning**: Cannot optimize TTLs based on production metrics

**Recommendation**:
```python
from server.config import settings

conf = settings()
TEMPLATE_CACHE_TTL = conf.TEMPLATE_CACHE_TTL or 3600
METRICS_CACHE_TTL = conf.METRICS_CACHE_TTL or 300
```

**Blocking Severity**: NO - Technical debt, not blocking

---

### **Issue 8: Redis List Set No TTL (Memory Leak)** 🟡

**Location**: `repos/metabob-rpc-api/server/actions/activity.py:122, 387`

**Code**:
```python
# Adding to list set (no TTL)
redis.sadd("activity:templates:list", variant_id)
```

**Issue**: `activity:templates:list` set grows unbounded

**Memory Leak Scenario**:
1. Templates created over time (variants accumulate)
2. Set grows indefinitely (never expires)
3. Redis memory usage increases
4. Eventually: Redis OOM (out of memory) errors

**Impact on Data Flow**:
- **Memory**: Unbounded memory growth
- **Performance**: Large sets slow down SMEMBERS operation
- **Availability**: Redis OOM kills service

**Recommendation**:
```python
# Option 1: Use sorted set with timestamp (allows pruning)
redis.zadd("activity:templates:list", {variant_id: time.time()})
# Prune old entries periodically:
redis.zremrangebyscore("activity:templates:list", 0, time.time() - 86400)

# Option 2: Use individual keys with TTL
redis.setex(f"activity:template:{variant_id}", TEMPLATE_CACHE_TTL, json.dumps(template))
# Don't maintain separate list - query SurrealDB on cache miss

# Option 3: Scheduled cleanup job
# Remove entries older than X hours from set
```

**Blocking Severity**: NO - Slow leak, not immediate concern

---

## 🟢 LOW PRIORITY ISSUES (4)

### **Issue 9: No Request ID for Tracing** 🟢

**Location**: All route handlers

**Issue**: No correlation ID for distributed tracing

**Impact**: Difficult to debug issues across multiple requests

**Recommendation**:
```python
import uuid
from fastapi import Request

@router.get("/templates")
async def list_activity_templates(
    request: Request,
    ...
):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    logger.info(f"[{request_id}] list_activity_templates called")
    # ... business logic
```

---

### **Issue 10: No Health Check Endpoint** 🟢

**Location**: N/A (missing feature)

**Issue**: Cannot monitor service health

**Recommendation**:
```python
@router.get("/health")
async def health_check(
    redis: StrictRedis = Depends(get_redis_connection),
):
    try:
        redis.ping()
        db = get_surreal_client()
        db.query("SELECT * FROM activity_template LIMIT 1")
        return {"status": "healthy", "dependencies": ["redis", "surrealdb"]}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Unhealthy: {e}")
```

---

### **Issue 11: MVP org_id Implementation** 🟢

**Location**: `repos/metabob-rpc-api/server/routes/activity.py:112-114, 244-246`

**Code**:
```python
org_id = session_id  # Using session_id as org_id placeholder (MVP)
# TODO: Extend SessionData model to include org_id field
```

**Issue**: org_id is placeholder (full session path, not just org ID)

**Impact**: 
- Works for MVP (unique per org)
- Not production-ready (should extract just org portion)

**Recommendation**:
```python
# Extract only org_id portion from session token
# Token format: sessions:org-id:project:session-id
parts = session_id.split(":")
org_id = parts[0] if len(parts) > 0 else session_id
```

---

### **Issue 12: No API Versioning Strategy** 🟢

**Location**: All routes (prefix="/v2/activities")

**Issue**: No documented versioning policy

**Impact**: Future breaking changes will affect all clients

**Recommendation**: Document versioning policy in API docs
- Semantic versioning (v1, v2, v3)
- Deprecation timeline (6 months warning)
- Sunset process (graceful shutdown)

---

## 📊 Issue Summary by Category

| Category | HIGH | MEDIUM | LOW | Total |
|----------|------|--------|-----|-------|
| **Security** | 3 | 0 | 0 | 3 |
| **Performance** | 0 | 3 | 0 | 3 |
| **Resilience** | 0 | 2 | 0 | 2 |
| **Operations** | 0 | 0 | 3 | 3 |
| **Technical Debt** | 0 | 0 | 1 | 1 |
| **Total** | 3 | 5 | 4 | **12** |

---

## 🎯 Impact on Data Flow

### **CREATE Flow Impact**

| Issue | Impact |
|-------|--------|
| Issue 1 (Error disclosure) | Exposes database errors to attackers |
| Issue 2 (No org_id validation) | Could corrupt org_id field in database |
| Issue 5 (Singleton connections) | Bottleneck during concurrent creates |
| Issue 6 (No circuit breaker) | All creates fail if SurrealDB down |

### **LIST Flow Impact**

| Issue | Impact |
|-------|--------|
| Issue 1 (Error disclosure) | Exposes query errors to attackers |
| Issue 4 (No rate limiting) | DOS via excessive list requests |
| Issue 5 (Singleton connections) | Bottleneck during concurrent lists |
| Issue 8 (Memory leak) | Large sets slow down listing |

### **GET Flow Impact**

| Issue | Impact |
|-------|--------|
| Issue 3 (Missing auth) | **CRITICAL** - Multi-tenant isolation bypass |
| Issue 4 (No rate limiting) | DOS via excessive GET requests |
| Issue 5 (Singleton connections) | Bottleneck during concurrent GETs |

---

## 🚨 Blocking Concerns

### **MUST FIX BEFORE PRODUCTION** 🔴

1. **Issue 3: GET /templates/{id} Missing org_id Authorization**
   - **Severity**: CRITICAL
   - **Risk**: Complete bypass of multi-tenant isolation
   - **Exploitation**: Trivial (just call GET with known template ID)
   - **Fix Effort**: Low (add org_id check to GET handler)

2. **Issue 1: Information Disclosure via Error Messages**
   - **Severity**: HIGH
   - **Risk**: Reveals internal infrastructure details
   - **Exploitation**: Easy (trigger errors, read responses)
   - **Fix Effort**: Low (return generic errors)

### **SHOULD FIX BEFORE PRODUCTION** 🟡

3. **Issue 4: No Rate Limiting**
   - **Severity**: MEDIUM
   - **Risk**: DOS attacks, resource exhaustion
   - **Fix Effort**: Medium (integrate slowapi or similar)

4. **Issue 6: No Circuit Breaker**
   - **Severity**: MEDIUM
   - **Risk**: Cascading failures, poor resilience
   - **Fix Effort**: Medium (integrate pybreaker)

---

## 📋 Related Files to Review

Based on identified issues, these files should be reviewed:

1. **repos/metabob-rpc-api/server/routes/activity.py**
   - **Reason**: Contains 3 HIGH issues (error disclosure, missing auth)
   - **Action**: Add org_id check to GET endpoint, return generic errors

2. **repos/metabob-rpc-api/server/actions/auth.py**
   - **Reason**: Token decoding logic, org_id extraction
   - **Action**: Add org_id validation, proper error handling

3. **repos/metabob-rpc-api/server/utils/dependencies.py**
   - **Reason**: Connection management (singleton pattern)
   - **Action**: Implement connection pooling for Redis

4. **repos/metabob-rpc-api/server/db/surrealdb_client.py**
   - **Reason**: Database connection management
   - **Action**: Implement connection pooling, circuit breaker

5. **repos/metabob-rpc-api/server/actions/activity.py**
   - **Reason**: Business logic, cache management
   - **Action**: Fix Redis list set memory leak, add circuit breaker

6. **repos/metabob-rpc-api/server/config.py**
   - **Reason**: Configuration management
   - **Action**: Add configurable cache TTLs, rate limit settings

---

## ✅ Recommendations Summary

### **Immediate Actions** (Before Production)

1. ✅ Fix Issue 3: Add org_id authorization to GET /templates/{id}
2. ✅ Fix Issue 1: Return generic error messages to clients
3. ✅ Fix Issue 2: Validate org_id format before use

### **Short-Term Actions** (Production Hardening)

4. ⚠️ Fix Issue 4: Implement rate limiting (slowapi)
5. ⚠️ Fix Issue 6: Add circuit breaker for SurrealDB (pybreaker)
6. ⚠️ Fix Issue 5: Implement connection pooling (async clients)

### **Medium-Term Actions** (Production Optimization)

7. 🔧 Fix Issue 8: Redis list set cleanup (prevent memory leak)
8. 🔧 Fix Issue 7: Make cache TTLs configurable
9. 🔧 Add Issue 10: Health check endpoint
10. 🔧 Add Issue 9: Request ID tracing

### **Long-Term Actions** (Technical Debt)

11. 📝 Fix Issue 11: Proper org_id extraction (not full session path)
12. 📝 Document Issue 12: API versioning strategy

---

**Overall Code Quality**: The core data flow logic is **sound** but has **security vulnerabilities** (Issue 3) and **operational gaps** (rate limiting, circuit breaker) that must be addressed before production deployment.

---

**End of Code Quality Analysis**
