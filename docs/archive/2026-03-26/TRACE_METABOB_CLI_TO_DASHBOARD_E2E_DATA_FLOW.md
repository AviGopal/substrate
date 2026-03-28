# End-to-End Data Flow Trace: metabob-cli-to-dashboard

**Status**: 100% Implementation Complete | E2E Validation Pending  
**Generated**: 2026-03-12  
**Impulse ID**: trace-metabob-cli-to-dashboard-e2e-data-flow

---

## Executive Summary

All 4 gaps for metabob-cli to dashboard integration have been successfully deployed:

- ✅ **Gap 1**: CLI project registration (commit 28da1c375)
- ✅ **Gap 2**: Session-project linking via POST /v2/submit
- ✅ **Gap 3**: SurrealDB persistence with dual-write (Redis + SurrealDB)
- ✅ **Gap 4**: Project API endpoints (POST/GET /auth/orgs/{org_id}/projects)

**Critical Finding**: Dashboard query endpoint for problems is NOT documented/verified. This blocks complete E2E validation.

---

## Data Flow Diagram

```
CLI Analysis Request
    ↓
1. register_project()
    → POST /auth/orgs/{org_id}/projects
    → project_ops.create_project()
    → SurrealDB projects table
    ← project_id
    ↓
2. submit_files(project_id)
    → POST /v2/submit (with project_id form field)
    → Redis: hset(session:{session_id}, "project_id", project_id)
    → Celery queue
    ↓
3. run_analysis (Celery task)
    → Redis: hget(session:{session_id}, "org_id", "project_id")
    → Detection model analyzes files
    → _store_results()
        → Redis: problems (7-day TTL)
        → SurrealDB: bulk_create_problems() (permanent)
    ↓
4. Dashboard Query (UNKNOWN ENDPOINT)
    → GET /auth/orgs/{org_id}/projects (list projects)
    → ??? (query problems by project_id)
    → problem_ops.list_problems_by_project()
    → Display problems grouped by component
```

---

## Component Inventory

### Gap 1: CLI Project Registration

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| register_project() | repos/metabob-cli/src/metabob_cli/core/analysis_api_client.py | ~450-550 | ✅ DEPLOYED |
| Engine integration | repos/metabob-cli/src/metabob_cli/core/analysis_engine.py | 119-120, ~170-190 | ✅ DEPLOYED |

**Implementation Details**:
- Extracts `org_id` from JWT token using `jwt.decode()` (no verification, trusted session)
- Computes `git_root_hash` via `git rev-parse HEAD` in project root
- Calls `POST /auth/orgs/{org_id}/projects` with payload: `{name, repository_url, branch, git_root_hash}`
- Returns `project_id` for session linking
- Idempotent: returns existing project if already created

**Validation Needed**:
- E2E test: CLI calls register_project, verify project exists in SurrealDB with correct org_id

---

### Gap 2: Session-Project Linking

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| POST /v2/submit | repos/metabob-rpc-api/server/routes/analysis.py | 109-207 | ✅ DEPLOYED |

**Implementation Details**:
- Accepts `project_id` as `Form` parameter (multipart/form-data)
- Stores in Redis: `redis.hset(f"session:{session_id}", "project_id", project_id)`
- JWT authentication required (`validate_session` dependency)
- Submits files to Celery queue with session metadata

**Validation Needed**:
- E2E test: Verify project_id stored in Redis session:{session_id}
- E2E test: Verify project_id retrievable by Celery tasks

---

### Gap 3: SurrealDB Persistence

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| _store_results() | repos/metabob-rpc-api/tasks/jobs/analysis.py | 181-299 | ✅ DEPLOYED |
| _persist_to_surrealdb_sync() | repos/metabob-rpc-api/tasks/jobs/analysis.py | 302-323 | ✅ DEPLOYED |
| bulk_create_problems() | repos/metabob-rpc-api/server/db/operations/problem_ops.py | 83-122 | ✅ DEPLOYED |

**Implementation Details**:
- Dual-write architecture: Redis (7-day TTL) + SurrealDB (permanent)
- Extracts `org_id` and `project_id` from Redis session
- Calls `bulk_create_problems()` with schema:
  ```python
  {
      "problem_id": str,
      "session_id": str,
      "project_id": str,  # Gap 2 integration
      "org_id": str,      # Gap 2 integration
      "file_path": str,
      "start_line": int,
      "end_line": int,
      "category": str,
      "severity": str,
      "description": str,
      "recommendation": str | None,
      "context": str,
      "problem_hash": str,
      "status": "open",
      "metadata": dict,
      "created_at": ISO8601,
      "updated_at": ISO8601
  }
  ```
- Uses async event loop wrapper to call async SurrealDB operations from sync Celery context
- Graceful degradation: logs error but doesn't fail task if SurrealDB write fails

**Validation Needed**:
- E2E test: Verify problems persist to SurrealDB with correct org_id, project_id, timestamps
- Performance test: Verify event loop creation/cleanup doesn't leak resources in Celery worker

---

### Gap 4: Project API Endpoints

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| POST /auth/orgs/{org_id}/projects | repos/metabob-rpc-api/server/routes/projects.py | 21-118 | ✅ DEPLOYED |
| GET /auth/orgs/{org_id}/projects | repos/metabob-rpc-api/server/routes/projects.py | 121-206 | ✅ DEPLOYED |
| create_project() | repos/metabob-rpc-api/server/db/operations/project_ops.py | 17-63 | ✅ DEPLOYED |
| list_projects_by_org() | repos/metabob-rpc-api/server/db/operations/project_ops.py | 90-114 | ✅ DEPLOYED |

**Implementation Details**:
- Separate FastAPI router (fixes registration conflict)
- JWT authentication via `get_current_user` dependency
- POST creates projects with idempotent handling (returns existing on duplicate)
- GET lists projects with stats: `{total_sessions, total_activities, total_problems_found, total_problems_fixed}`
- Protected by org_id verification (current_user.org_id must match requested org_id)

**Schema**:
```python
{
    "project_id": str (UUID),
    "org_id": str (UUID),
    "name": str,
    "git_root_hash": str | None,
    "repository_url": str | None,
    "branch": str (default: "main"),
    "settings": dict,
    "stats": {
        "total_sessions": int,
        "total_activities": int,
        "total_problems_found": int,
        "total_problems_fixed": int
    },
    "created_at": ISO8601,
    "updated_at": ISO8601
}
```

**Validation Needed**:
- E2E test: CLI creates project, dashboard retrieves it with stats
- E2E test: Verify stats update correctly when problems are persisted

---

## Schema Compliance

### projects Table

| Field | Type | Purpose | Status |
|-------|------|---------|--------|
| project_id | UUID (unique) | Primary key | ✅ |
| org_id | UUID | Organization hierarchy | ✅ |
| name | string | Project display name | ✅ |
| git_root_hash | string | Git commit tracking | ✅ |
| repository_url | string | Repo identification | ✅ |
| branch | string | Branch tracking | ✅ |
| settings | object | Project configuration | ✅ |
| stats | object | Aggregated metrics | ✅ |
| created_at | ISO8601 | Temporal tracking | ✅ |
| updated_at | ISO8601 | Temporal tracking | ✅ |

### problems Table

| Field | Type | Purpose | Status |
|-------|------|---------|--------|
| problem_id | UUID (unique) | Primary key | ✅ |
| session_id | UUID | Session linkage | ✅ |
| project_id | UUID | Project hierarchy | ✅ |
| org_id | UUID | Organization hierarchy | ✅ |
| file_path | string | Component grouping | ✅ |
| start_line | int | Location tracking | ✅ |
| end_line | int | Location tracking | ✅ |
| category | string | Problem classification | ✅ |
| severity | string | Priority ranking | ✅ |
| description | string | Problem details | ✅ |
| recommendation | string | Fix suggestions | ✅ |
| context | string | Code context | ✅ |
| problem_hash | string | Deduplication | ✅ |
| status | string | Workflow tracking | ✅ |
| metadata | object | Extensibility | ✅ |
| created_at | ISO8601 | Temporal tracking | ✅ |
| updated_at | ISO8601 | Temporal tracking | ✅ |

**Temporal Query Support**:
- `ORDER BY created_at DESC` for temporal trends
- ISO 8601 timestamps for date range queries
- `updated_at` for modification tracking

---

## Integration Points

| Source | Destination | Endpoint | Auth | Status |
|--------|-------------|----------|------|--------|
| metabob-cli | rpc-api | POST /auth/orgs/{org_id}/projects | JWT | ✅ DEPLOYED |
| metabob-cli | rpc-api | POST /v2/submit | JWT | ✅ DEPLOYED |
| rpc-api | Redis | hset(session:{session_id}, project_id) | - | ✅ DEPLOYED |
| Celery | Redis | hget(session:{session_id}, org_id/project_id) | - | ✅ DEPLOYED |
| Celery | SurrealDB | bulk_create_problems() | - | ✅ DEPLOYED |
| dashboard | rpc-api | GET /auth/orgs/{org_id}/projects | JWT | ✅ DEPLOYED |
| dashboard | rpc-api | ??? (problem query) | JWT | ❌ MISSING |

---

## Validation Checklist

| ID | Description | Test | Status |
|----|-------------|------|--------|
| V1 | CLI creates project before analysis | Run metabob-cli analyze → verify POST /auth/orgs/{org_id}/projects → verify project in SurrealDB | ⏳ PENDING |
| V2 | Project ID links to analysis session | Verify project_id in Redis session:{session_id} → verify passed to POST /v2/submit | ⏳ PENDING |
| V3 | Problems persist to SurrealDB | Run analysis → verify problems table has correct org_id, project_id, timestamps | ⏳ PENDING |
| V4 | Dashboard can query problems by project | Login → select project → verify problems display grouped by component | 🚫 BLOCKED |
| V5 | Temporal tracking works | Run multiple sessions → verify date range queries → verify ORDER BY created_at DESC | ⏳ PENDING |
| V6 | Stats update correctly | Run analysis → verify project stats increment → verify dashboard displays counts | ⏳ PENDING |

---

## Critical Gaps

### DASHBOARD_QUERY_ENDPOINT

**Severity**: CRITICAL  
**Status**: MISSING

**Description**:
Dashboard API endpoint for querying problems by project_id is not documented or verified. The database operation `list_problems_by_project()` exists in `problem_ops.py` but the REST endpoint that calls it is unknown.

**Expected Implementation**:
```python
@router.get("/auth/orgs/{org_id}/projects/{project_id}/problems")
async def get_project_problems(
    org_id: str,
    project_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    # Verify user has access to org
    if current_user.org_id != org_id:
        raise HTTPException(403)
    
    # Query problems by project_id
    problems = await list_problems_by_project(project_id, limit=100)
    
    # Group by component (file_path)
    # Calculate temporal statistics
    
    return {"problems": problems, ...}
```

**Impact**:
Cannot complete E2E validation without knowing how dashboard retrieves problem data.

**Recommendation**:
1. Search dashboard codebase for problem query implementation
2. If missing, implement new REST endpoint in rpc-api
3. Update dashboard frontend to call new endpoint

---

## Deployment Verification

### metabob-cli
- **Commit**: 28da1c375
- **Changes**: analysis_api_client.py (register_project), analysis_engine.py (project_id integration)
- **Status**: ✅ DEPLOYED

### rpc-api
- **Files**: server/routes/projects.py, server/routes/analysis.py, tasks/jobs/analysis.py, server/db/operations/project_ops.py, server/db/operations/problem_ops.py
- **Status**: ✅ DEPLOYED

### SurrealDB Schema
- **Tables**: projects, problems
- **Status**: ⚠️ ASSUMED (verify with DB inspection)

### Dashboard
- **Status**: ❓ UNKNOWN (cannot verify without dashboard codebase access)

---

## Next Steps

1. **Locate Dashboard Problem Query Endpoint**
   - Search dashboard backend for problem retrieval API
   - Verify it calls `problem_ops.list_problems_by_project()`
   - Document endpoint specification

2. **Execute E2E Validation Tests (V1-V6)**
   - Test CLI project registration flow
   - Test session-project linking
   - Test SurrealDB persistence
   - Test dashboard problem display (if endpoint found)
   - Test temporal tracking
   - Test stats updates

3. **Performance Testing**
   - Verify event loop creation/cleanup in Celery worker
   - Test bulk insert performance with large problem sets
   - Test Redis → SurrealDB sync latency

4. **Production Readiness**
   - Enable SurrealDB monitoring
   - Configure error alerting for failed dual-writes
   - Document operational runbooks

---

## References

- **Specification**: metabob-cli-to-dashboard-e2e-data-flow
- **Impulse**: trace-metabob-cli-to-dashboard-e2e-data-flow (5000 token budget)
- **CLI Commit**: 28da1c375 (Gap 1 implementation)
- **Related Docs**: Gap 1-4 implementation summaries
