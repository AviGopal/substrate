# Ripple Analysis: metabob-cli-to-dashboard-data-flow

**Specification**: metabob-cli-to-dashboard-data-flow  
**Status**: Enforcement In Progress (Blocked on Deployment)  
**Date**: 2026-03-12

---

## Executive Summary

Backend enforcement for metabob-cli-to-dashboard data flow is complete at the code level (2/4 gaps closed), but deployment is blocked by a Python module caching issue. Once deployment completes, ripple changes will propagate through CLI, session management, and persistence layers.

---

## Components Already Updated (Committed)

### 1. server/routes/cloud_auth.py (+140 lines)

**Changes Made**:
- Added `POST /auth/orgs/{org_id}/projects` endpoint
- Added `GET /auth/orgs/{org_id}/projects` endpoint

**Ripple Impact**:
- ✅ Dashboard ProjectsTable component will be able to fetch projects
- ✅ CLI will be able to register projects before analysis
- ⏳ Requires CLI changes (Gap 1) to call this endpoint
- ⏳ Requires session linking (Gap 2) to associate sessions with projects

**Dependencies**:
- Calls: `project_ops.create_project()`, `project_ops.list_projects_by_org()`
- Validates: User org_id matches requested org_id (multi-tenant isolation)
- Returns: Paginated project list with stats

**Cross-Spec Implications**:
- None identified (new functionality, no conflicts)

---

### 2. server/db/operations/problem_ops.py (+275 lines, NEW FILE)

**Changes Made**:
- Created full CRUD module for problems table
- Functions: `create_problem()`, `bulk_create_problems()`, `get_problem()`, `list_problems_by_session()`, etc.

**Ripple Impact**:
- ⏳ Requires integration in `tasks/jobs/analysis.py` (Gap 3)
- ⏳ Requires SurrealDB schema migration (problems table)
- ✅ Enables temporal tracking and trend analysis
- ✅ Replaces ephemeral Redis-only storage

**Dependencies**:
- Calls: `surrealdb_client.get_surreal_client()`
- Uses: `sanitize_record()` for consistent response format
- Requires: problems table in SurrealDB (not yet created)

**Cross-Spec Implications**:
- None identified (isolated database operations layer)

---

## Components Requiring Ripple Changes

### 3. metabob-cli: commands.py (Gap 1 - NOT STARTED)

**Location**: `repos/metabob-cli/src/metabob_cli/commands.py`

**Required Changes**:
```python
# In analyze_from_config() function
def analyze_from_config(config_path, ...):
    # Existing: Load config, prepare files
    config = load_config(config_path)
    
    # NEW: Register project before analysis
    project_metadata = {
        "name": config.get("project_name") or os.path.basename(config["project_root"]),
        "repository_url": get_git_remote_url(config["project_root"]),
        "branch": get_git_branch(config["project_root"]),
        "git_root_hash": get_git_commit_hash(config["project_root"]),
    }
    
    org_id = extract_org_id_from_token(api_token)
    project = api_client.register_project(org_id, project_metadata)
    
    # Existing: Submit files for analysis
    session_id = api_client.submit_files(..., project_id=project["project_id"])
```

**Ripple Impact**:
- ✅ Projects auto-created when CLI runs analysis
- ✅ Establishes org→project→session data hierarchy
- ⏳ Requires API client method: `register_project()`
- ⏳ Requires git utilities: `get_git_remote_url()`, `get_git_branch()`, `get_git_commit_hash()`
- ⏳ Requires JWT parsing: `extract_org_id_from_token()`

**Estimated Effort**: 4-6 hours

**Validation**:
- Unit test: `test_register_project_before_analysis()`
- Integration test: Run `metabob-cli analyze` and verify project created in SurrealDB

---

### 4. server/routes/analysis.py (Gap 2 - NOT STARTED)

**Location**: `repos/metabob-rpc-api/server/routes/analysis.py`

**Required Changes**:
```python
# In post_analysis_v2() endpoint
@router.post("/v2/submit")
async def post_analysis_v2(
    files: List[UploadFile],
    project_id: Optional[str] = Form(None),  # NEW parameter
    ...
):
    # Existing: Create session
    session_id = generate_session_id()
    
    # NEW: Store project_id in session
    session_data = {
        "session_id": session_id,
        "project_id": project_id,  # NEW field
        "org_id": current_user.org_id,
        ...
    }
    redis.hset(f"session:{session_id}", mapping=session_data)
    
    # Existing: Spawn Celery tasks
    celery_task.apply_async(..., kwargs={"project_id": project_id})
```

**Ripple Impact**:
- ✅ Sessions linked to projects (enables org→project→session hierarchy)
- ✅ Celery tasks receive project_id for downstream persistence
- ⏳ Requires SessionData model update (add project_id field)
- ⏳ Requires CLI to send project_id in POST form data

**Estimated Effort**: 2-3 hours

**Validation**:
- Unit test: `test_session_stores_project_id()`
- Integration test: Submit analysis and verify project_id in Redis session

---

### 5. tasks/jobs/analysis.py (Gap 3 - NOT STARTED)

**Location**: `repos/metabob-rpc-api/tasks/jobs/analysis.py`

**Required Changes**:
```python
# In _store_results() function
def _store_results(session_id, results, redis):
    # Existing: Store in Redis
    problems_name = f"session:{session_id}:problems"
    for key, value in results.items():
        redis.hset(problems_name, key, value)
    
    # NEW: Also persist to SurrealDB
    try:
        from server.db.operations.problem_ops import bulk_create_problems
        
        # Get context from session
        session = redis.hgetall(f"session:{session_id}")
        org_id = session.get("org_id")
        project_id = session.get("project_id")
        
        # Transform Redis problems to SurrealDB format
        problems_data = []
        for problem_id, problem_json in results.items():
            problem = json.loads(problem_json)
            problems_data.append({
                "problem_id": problem_id,
                "session_id": session_id,
                "project_id": project_id,
                "org_id": org_id,
                "severity": problem["severity"],
                "category": problem["category"],
                "file_path": problem["file_path"],
                "line_start": problem["line_start"],
                "line_end": problem["line_end"],
                "description": problem["description"],
                "recommendation": problem["recommendation"],
            })
        
        # Bulk insert (single transaction)
        asyncio.run(bulk_create_problems(problems_data))
        logger.info(f"Persisted {len(results)} problems to SurrealDB")
        
        # Update project stats
        from server.db.operations.project_ops import update_project_stats
        asyncio.run(update_project_stats(project_id, {
            "total_problems_found": len(results)
        }))
        
    except Exception as e:
        # Don't fail task if SurrealDB unavailable
        logger.error(f"SurrealDB persistence failed: {e}")
        # Redis is still source of truth for active sessions
```

**Ripple Impact**:
- ✅ Analysis problems persist permanently (not just 7-day Redis TTL)
- ✅ Enables temporal tracking and trend analysis
- ✅ Dashboard can query historical problems
- ⏳ Requires async-to-sync wrapper (`asyncio.run()`)
- ⏳ Requires problems table in SurrealDB
- ⏳ Graceful degradation if SurrealDB unavailable

**Estimated Effort**: 3-4 hours

**Validation**:
- Unit test: `test_problems_persisted_to_surrealdb()`
- Integration test: Run analysis and verify problems in SurrealDB `problems` table

---

### 6. SurrealDB Schema Migration (Gap 3 Dependency)

**Location**: `sql/migrations/` or init scripts

**Required Changes**:
```sql
-- Create problems table
DEFINE TABLE problems SCHEMAFULL;

DEFINE FIELD problem_id ON problems TYPE string ASSERT $value != NONE;
DEFINE FIELD session_id ON problems TYPE string ASSERT $value != NONE;
DEFINE FIELD project_id ON problems TYPE string ASSERT $value != NONE;
DEFINE FIELD org_id ON problems TYPE string ASSERT $value != NONE;
DEFINE FIELD severity ON problems TYPE string ASSERT $value IN ["HIGH", "MEDIUM", "LOW"];
DEFINE FIELD category ON problems TYPE string ASSERT $value != NONE;
DEFINE FIELD file_path ON problems TYPE string ASSERT $value != NONE;
DEFINE FIELD line_start ON problems TYPE int ASSERT $value >= 0;
DEFINE FIELD line_end ON problems TYPE int ASSERT $value >= $this.line_start;
DEFINE FIELD description ON problems TYPE string;
DEFINE FIELD recommendation ON problems TYPE string;
DEFINE FIELD status ON problems TYPE string DEFAULT "open" ASSERT $value IN ["open", "fixed", "ignored"];
DEFINE FIELD created_at ON problems TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON problems TYPE datetime DEFAULT time::now();

-- Indexes for common queries
DEFINE INDEX problems_session_idx ON problems FIELDS session_id;
DEFINE INDEX problems_project_idx ON problems FIELDS project_id;
DEFINE INDEX problems_org_idx ON problems FIELDS org_id;
DEFINE INDEX problems_severity_idx ON problems FIELDS severity;

-- Relationships
DEFINE FIELD project ON problems TYPE record<projects>;
DEFINE FIELD session ON problems TYPE record<sessions>;
```

**Ripple Impact**:
- ✅ Enables problem persistence in SurrealDB
- ✅ Supports efficient querying by session, project, org
- ✅ Enforces data integrity (schema validation)
- ⏳ Requires application of migration before Gap 3 implementation

**Estimated Effort**: 1 hour

**Validation**:
- Schema test: `INFOR TABLE problems` returns correct schema
- Insert test: Create sample problem and verify constraints

---

## Validation Status

### Current State

**This Spec (metabob-cli-to-dashboard-data-flow)**:
- Code: ✅ 50% complete (2/4 gaps)
- Deployment: ❌ Blocked (Python module cache issue)
- Validation: ⏸️ Pending deployment

**Conflicting Specs**: None identified

### Validation Plan

Once deployment completes:

1. **Unit Tests**:
   - `test_create_org_project_idempotent()`
   - `test_get_org_projects_pagination()`
   - `test_get_org_projects_forbidden()`
   - `test_bulk_create_problems()`
   - `test_list_problems_by_project()`

2. **Integration Tests**:
   - CLI register project → verify in SurrealDB
   - Dashboard fetch projects → verify 200 response
   - Analysis with project_id → verify session linkage

3. **End-to-End Test** (Validation Harness):
   ```bash
   ts-node tests/validation-harnesses/metabob-cli-to-dashboard-data-flow-harness.ts
   ```

   **Expected Flow**:
   1. Register test user/org ✓
   2. CLI analyze → POST /auth/orgs/{org_id}/projects ✓
   3. Verify project in SurrealDB ✓
   4. Verify session linked to project ⏳ (requires Gap 2)
   5. Verify problems persisted ⏳ (requires Gap 3)
   6. Dashboard displays projects ✓
   7. Temporal tracking works ⏳ (requires Gap 3)

---

## Functional State Transition

### Before Enforcement
```
metabob-cli → RPC API → Redis (ephemeral) → ❌ Dashboard (404 on projects)
                                           ↓
                                     Lost after 7 days
```

**Problems**:
- Dashboard can't list projects (404 error)
- No org→project→session→problems hierarchy
- Analysis results lost after Redis TTL
- No temporal tracking or trend analysis

### After Partial Enforcement (Current)
```
metabob-cli → RPC API → Redis (ephemeral)
                      ↓
                 SurrealDB (projects table) → ⏸️ Dashboard (endpoints exist but not deployed)
```

**Status**:
- ✅ Project CRUD endpoints coded
- ✅ problem_ops module created
- ❌ Endpoints not accessible (deployment blocked)
- ⏳ CLI, session linking, persistence pending

### After Full Enforcement (Target)
```
metabob-cli → POST /auth/orgs/{org_id}/projects
           → POST /v2/submit (with project_id)
           → Celery tasks
           → Redis (active sessions) + SurrealDB (permanent)
           → GET /auth/orgs/{org_id}/projects
           → Dashboard (projects list, trend analysis)
```

**Benefits**:
- ✓ Dashboard displays organization projects
- ✓ Projects auto-created by CLI
- ✓ Full org→project→session→problems hierarchy
- ✓ Permanent problem storage (no data loss)
- ✓ Temporal tracking and trend analysis
- ✓ Multi-tenant isolation enforced

---

## Deployment Blocker Resolution

### Issue
Python module caching prevents new routes from being served even after:
- ✓ Code committed to git
- ✓ Docker image rebuilt
- ✓ Kubernetes pod restarted
- ✓ Python bytecode cache cleared

### Root Cause
Layered Dockerfile (`FROM base; COPY files`) doesn't force uvicorn workers to reload modules.

### Solution In Progress
Full Docker image rebuild from source:
```bash
cd repos/metabob-rpc-api
docker build -f docker/Dockerfile.server -t metabob-rpc-api:0.25.1-projects-clean .
```

**Status**: Build in progress (~10 minutes)

Once complete:
1. Deploy new image to Kubernetes
2. Verify endpoints via OpenAPI spec
3. Run backend test script
4. Proceed with Gaps 1-3 implementation

---

## Next Steps (Priority Order)

### Immediate (Unblock)
1. ⏳ Complete Docker build (~5 min remaining)
2. ⏳ Deploy to Kubernetes (1 min)
3. ⏳ Verify endpoints work (2 min)

### Short-term (Complete Enforcement)
4. ⏳ Implement Gap 1: CLI project registration (4-6 hours)
5. ⏳ Apply SurrealDB schema migration (1 hour)
6. ⏳ Implement Gap 2: Session-project linking (2-3 hours)
7. ⏳ Implement Gap 3: SurrealDB persistence (3-4 hours)

### Validation
8. ⏳ Run validation harness (30 min)
9. ⏳ Fix any failures
10. ⏳ Mark specification as ENFORCED

**Total Remaining Effort**: 11-15 hours

---

## Cross-Specification Impact

### Analyzed Specifications
- None (first enforcement in this data flow)

### Potential Future Conflicts
- If another spec modifies session schema, must preserve project_id field
- If another spec changes SurrealDB schema, must maintain problems table
- If another spec modifies CLI analyze flow, must preserve project registration

### Mitigation Strategy
- Document project_id as required session field
- Add integration tests to detect schema breakage
- Use metabob_annotate_component to mark critical components

---

**Ripple Analysis Complete**  
**Status**: Ready for deployment and Gap 1-3 implementation  
**Blocker**: Docker build in progress

