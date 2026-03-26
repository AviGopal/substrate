# Dashboard Activity History Viewing Flow - Trace Summary

**Status**: ✅ TRACE COMPLETED  
**Activity**: trace-data-flow-single-feature  
**Date**: 2026-03-04  
**Impulse ID**: trace-Dashboard_Activity_History_Viewing_Flow

---

## Executive Summary

The Dashboard Activity History Viewing Flow has been comprehensively traced using the `trace-data-flow-single-feature` activity template. The analysis reveals a **critical architectural gap**: the write path is fully functional, but the read path is completely broken due to a missing backend endpoint.

### Key Findings

| Aspect | Status | Details |
|--------|--------|---------|
| **Write Path** | ✅ FULLY FUNCTIONAL | OpenCode → Backend → SurrealDB working as expected |
| **Read Path** | ❌ COMPLETELY BROKEN | Dashboard → Backend returns 404 (endpoint missing) |
| **Critical Blocker** | 🔴 P0 - CRITICAL | `GET /auth/orgs/{org_id}/activity` NOT IMPLEMENTED |
| **Security Issues** | 🟡 P1 - HIGH | Exception leakage, no rate limiting, debug auth bypass |
| **Performance Issues** | 🟠 P2 - MEDIUM | No connection pooling, singleton DB connection |

---

## Component Analysis

### ✅ Working Components (Write Path)

1. **OpenCode CLI** (`tool/activity.ts`)
   - Creates activity objects
   - Captures initial state snapshot
   - Stores activity content to backend
   - Status: WORKING AS EXPECTED

2. **Activity Client** (`activity-client.ts`)
   - HTTP POST to `/v2/activities/content`
   - Retry logic with exponential backoff
   - Non-blocking on failure
   - Status: WORKING AS EXPECTED

3. **Backend Storage Endpoint** (`activity.py`)
   - Validates required fields
   - Calls insert operation
   - Stores to SurrealDB
   - Status: WORKING (needs type safety improvements)

4. **Database Operations** (`activity_content.py`)
   - Adds timestamp enrichment
   - Inserts to SurrealDB
   - Auto-generates record ID
   - Status: WORKING (needs idempotency check)

### ❌ Missing/Broken Components (Read Path)

1. **Backend Retrieval Endpoint** (`cloud_auth.py`)
   - Expected: `GET /auth/orgs/{org_id}/activity`
   - Current: DOES NOT EXIST (404)
   - Impact: Entire read path broken
   - Priority: P0 - CRITICAL

2. **Database Query Operations** (`activity_execution.py`)
   - Expected: Query activity_executions table
   - Current: DOES NOT EXIST
   - Impact: Cannot retrieve data
   - Priority: P0 - CRITICAL

3. **Frontend API Client** (`OrganizationApi.js`)
   - Polls endpoint every 60s
   - Receives 404 errors
   - Sets isError=true
   - Status: WORKING (blocked by missing backend)

4. **Dashboard Component** (`RecentActivity.js`)
   - Shows empty state on error
   - Cannot render activities
   - Status: WORKING (blocked by missing backend)

---

## Data Flow

### Write Path (WORKING) ✅

```
OpenCode CLI
  → Activity.create()
  → captureInitialState()
  → storeActivityContent()
  → HTTP POST /v2/activities/content
  → store_activity_content()
  → insert_activity_content()
  → SurrealDB activity_content table
```

### Read Path (BROKEN) ❌

```
Dashboard UI
  → useGetOrganizationActivityQuery
  → HTTP GET /auth/orgs/{org_id}/activity
  → 404 NOT FOUND
  → isError=true
  → Shows "No Recent Activity"
```

### Expected Read Path (NOT IMPLEMENTED) 🔴

```
Dashboard UI
  → RTK Query Hook
  → HTTP GET /auth/orgs/{org_id}/activity
  → JWT validation
  → Query activity_executions WHERE org_id
  → Join users table for actor email
  → Transform to activity events
  → JSON response with pagination
  → Redux cache
  → Component render
```

---

## Critical Gaps

### P0 - Critical (Feature Blocking)

**Issue**: Missing Backend Endpoint  
**Files**:
- `repos/metabob-rpc-api/server/routes/cloud_auth.py`
- `repos/metabob-rpc-api/server/db/operations/activity_execution.py`

**Description**: The `GET /auth/orgs/{org_id}/activity` endpoint does not exist, causing the entire read path to return 404 errors.

**Impact**: Dashboard cannot display activity history - feature is completely unusable.

**Implementation Required**:
1. Add route handler in `cloud_auth.py`
2. Implement database query in `activity_execution.py`
3. Query activity_executions table filtered by org_id
4. Join with users table for actor email
5. Transform records to activity event objects
6. Return paginated JSON response

**Estimated Effort**: 2-3 days

**Reference**: See section 3.4.1 in full flow documentation for implementation details.

---

### P1 - High (Security Vulnerabilities)

**Issue**: Security Vulnerabilities  
**Files**:
- `repos/metabob-rpc-api/server/routes/activity.py`
- `repos/metabob-rpc-api/server/routes/cloud_auth.py`

**Description**:
- Exception details leaked in 500 responses (information disclosure)
- Authentication optional in DEBUG mode (bypass vulnerability)
- No rate limiting (DoS vulnerability)

**Impact**: Security breaches possible, information leakage, DoS attacks.

**Implementation Required**:
1. Sanitize error messages before returning to clients
2. Remove debug mode authentication bypass
3. Add rate limiting middleware (slowapi)
4. Add request timeout handling

**Estimated Effort**: 3-5 days

---

### P2 - Medium (Type Safety)

**Issue**: Weak Type Safety  
**Files**:
- `repos/metabob-rpc-api/server/routes/activity.py`
- `repos/metabob-rpc-api/server/models/activity.py` (create)

**Description**: Backend uses `Dict[str, Any]` instead of Pydantic models, no runtime validation.

**Impact**: Runtime errors possible, schema drift, poor developer experience.

**Implementation Required**:
1. Create Pydantic models for ActivityContent
2. Create Pydantic models for ActivityEvent
3. Update route handlers to use models
4. Add validation for required fields

**Estimated Effort**: 2-3 days

---

### P2 - Medium (Performance)

**Issue**: Performance Bottleneck  
**Files**:
- `repos/metabob-rpc-api/server/db/surrealdb_client.py`
- `repos/metabob-rpc-api/server/db/connection_pool.py` (create)

**Description**: Singleton SurrealDB connection, no connection pooling, requests serialize.

**Impact**: Poor concurrency, no horizontal scaling, connection failure affects all requests.

**Implementation Required**:
1. Implement connection pool with semaphore
2. Add pool configuration (size, timeout)
3. Update get_surreal_client() to use pool
4. Add connection health checks

**Estimated Effort**: 5-7 days

---

## Kubernetes Access

### Switch Context
```bash
kubectx devbob-k8s
kubectl cluster-info
```

### Port-Forward Services
```bash
# Dashboard
kubectl port-forward -n metabob svc/metabob-dashboard 3000:80

# Backend API
kubectl port-forward -n metabob svc/metabob-rpc-api 8081:8081

# SurrealDB
kubectl port-forward -n metabob svc/surrealdb 8000:8000
```

### Access URLs
- Dashboard: http://app.metabob.local (or http://localhost:3000)
- RPC API: http://localhost:8081
- SurrealDB: http://localhost:8000

### View Logs
```bash
# Dashboard logs
kubectl logs -n metabob deployment/metabob-dashboard --tail=100 -f

# Backend logs
kubectl logs -n metabob deployment/metabob-rpc-api --tail=100 -f

# SurrealDB logs
kubectl logs -n metabob deployment/surrealdb --tail=100 -f
```

---

## Implementation Roadmap

### Phase 1: Unblock Feature (P0) - 2-3 days
1. ✅ Implement `GET /auth/orgs/{org_id}/activity` endpoint
2. ✅ Add database query operation
3. ✅ Add user email lookup (join)
4. ✅ Transform to activity events
5. ✅ Test end-to-end flow

### Phase 2: Security Hardening (P1) - 3-5 days
1. ✅ Add Pydantic models
2. ✅ Sanitize exception messages
3. ✅ Remove debug auth bypass
4. ✅ Add rate limiting
5. ✅ Add request timeout

### Phase 3: Performance & Resilience (P2) - 5-7 days
1. ✅ Implement connection pooling
2. ✅ Add circuit breaker pattern
3. ✅ Replace broad exception catching
4. ✅ Add correlation IDs
5. ✅ Add idempotency checks

**Total Estimated Effort**: 12-22 days

---

## Artifacts Created

### Documentation
- **Full Flow Documentation**: `docs/data-flows/Dashboard-Activity-History-Viewing-Flow-flow.md` (2133 lines)
  - Complete mermaid diagrams
  - Component-by-component analysis
  - Data transformations documented
  - Architectural boundaries mapped
  - Implementation roadmap
  - Testing strategy
  - Troubleshooting guide

### Impulse
- **Impulse File**: `impulses/trace-Dashboard_Activity_History_Viewing_Flow.json`
  - ID: `trace-Dashboard_Activity_History_Viewing_Flow`
  - Type: `dataFlowTrace`
  - Points to: Full flow documentation
  - Budget: 10000 tokens
  - Metadata: Summary, components, gaps, effort estimates

### Summary
- **Trace Summary**: `TRACE_SUMMARY_Dashboard_Activity_History.md` (this file)
  - Executive summary
  - Component status
  - Data flow diagrams
  - Critical gaps
  - Kubernetes access
  - Implementation roadmap

---

## Next Steps

### Immediate Actions (P0)
1. **Implement Missing Endpoint** (2-3 days)
   - File: `repos/metabob-rpc-api/server/routes/cloud_auth.py`
   - Add `get_organization_activity()` route handler
   - Implement database query and transformation
   - Test with curl and Postman
   - Verify dashboard displays activities

### Follow-up Actions (P1)
2. **Security Hardening** (3-5 days)
   - Add Pydantic models
   - Sanitize errors
   - Add rate limiting
   - Remove debug bypass

3. **Performance Improvements** (P2)
   - Implement connection pooling
   - Add circuit breaker
   - Add correlation IDs

---

## Testing Checklist

### End-to-End Test
- [ ] Execute activity via OpenCode CLI
- [ ] Verify activity stored in SurrealDB
- [ ] Login to dashboard (http://app.metabob.local)
- [ ] Navigate to dashboard page
- [ ] Wait for activity to appear (< 70s)
- [ ] Verify activity details displayed
- [ ] Verify actor email shown
- [ ] Verify relative timestamp shown

### Component Tests
- [ ] Unit tests for storage endpoint
- [ ] Unit tests for retrieval endpoint
- [ ] Unit tests for data transformations
- [ ] Integration tests for write path
- [ ] Integration tests for read path
- [ ] E2E Playwright tests

---

## Success Criteria

✅ **Feature Launch Criteria**:
- Dashboard displays activity history within 60 seconds of execution
- Authentication working (JWT validation)
- Pagination working (limit + hasMore)
- Actor attribution showing (user emails)
- Relative time formatting ("2 hours ago")
- Empty state handling (no activities yet)
- Error state handling (backend unreachable)

📊 **Performance Criteria**:
- Storage endpoint: < 200ms p95 latency
- Retrieval endpoint: < 500ms p95 latency
- Database queries: < 100ms p95 latency
- Dashboard page load: < 2s p95

🔒 **Security Criteria**:
- No exception details exposed
- Authentication always required
- Rate limiting active
- No HIGH vulnerabilities in scan

---

## References

- Full Flow Documentation: `docs/data-flows/Dashboard-Activity-History-Viewing-Flow-flow.md`
- Impulse: `impulses/trace-Dashboard_Activity_History_Viewing_Flow.json`
- Activity Template: `trace-data-flow-single-feature`
- Activity Cost: $2.94, 1458s duration, 656k input tokens, 33k output tokens

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-04  
**Status**: Complete - Ready for Validation & Enforcement  
**Next Action**: Execute validation and enforcement activities using this trace as reference
