# Trace Complete: metabob-cli-to-dashboard-data-flow

**Status:** ✅ COMPLETE  
**Activity:** trace-data-flow-single-feature  
**Duration:** 1385 seconds (23 minutes)  
**Cost:** $2.16  
**Trace ID:** trace-metabob-cli-to-dashboard-data-flow

---

## Executive Summary

The complete data flow from metabob-cli code analysis through RPC API to SurrealDB storage and dashboard display has been traced. The flow is **PARTIALLY IMPLEMENTED** with **4 CRITICAL GAPS** blocking end-to-end functionality.

### Current State vs Desired State

**Working Segments (4/8):**
1. ✅ CLI → RPC API authentication and file upload
2. ✅ RPC API → Redis storage for files and sessions  
3. ✅ Celery task orchestration and ML model inference
4. ✅ Problem deduplication and Redis storage

**Broken Segments (4/8):**
1. ❌ CLI → Backend project registration (MISSING)
2. ❌ Redis → SurrealDB persistence (MISSING)
3. ❌ Dashboard → Backend API route (404 Not Found)
4. ❌ Backend → SurrealDB query (function exists but unused)

---

## Component Gap Analysis

### Gap 1: CLI Project Registration (CRITICAL)
**File:** repos/metabob-cli/src/metabob_cli/commands.py  
**Component:** `analyze()`  
**Current:** Parses CLI args, loads config, runs analysis, sends to RPC API  
**Desired:** Should also register project with backend before analysis  
**Gap:** Missing project registration call - projects table remains empty  
**Priority:** P0  
**Effort:** 1-2 days

### Gap 2: Session-Project Linking (CRITICAL)
**File:** repos/metabob-rpc-api/server/routes/analysis.py  
**Component:** `post_analysis_v2()`  
**Current:** Validates session, stores files in Redis, spawns Celery tasks  
**Desired:** Should accept project_id and link session to project  
**Gap:** No project_id in session context - cannot filter by project  
**Priority:** P0  
**Effort:** 1 day

### Gap 3: SurrealDB Persistence (CRITICAL)
**File:** repos/metabob-rpc-api/tasks/jobs/analysis.py  
**Component:** `_store_results()`  
**Current:** Stores analysis results only in Redis (ephemeral, 7-day TTL)  
**Desired:** Should also persist to SurrealDB for long-term storage  
**Gap:** No SurrealDB persistence layer - data lost after session expires  
**Priority:** P0  
**Effort:** 2-3 days

### Gap 4: Projects API Route (CRITICAL)
**File:** repos/metabob-rpc-api/server/routes/cloud_auth.py  
**Component:** `get_org_projects()`  
**Current:** Route does not exist - returns 404  
**Desired:** Should call list_projects_by_org() and return JSON  
**Gap:** API route not implemented - dashboard cannot fetch projects  
**Priority:** P0  
**Effort:** 1-2 days

### Gap 5: Database Operations Integration (HIGH)
**File:** repos/metabob-rpc-api/server/db/operations/project_ops.py  
**Component:** `list_projects_by_org()`  
**Current:** Function exists but never called (dead code)  
**Desired:** Should be called by GET /auth/orgs/{org_id}/projects route  
**Gap:** No integration with API routes - function unused  
**Priority:** P1  
**Effort:** Included in Gap 4

### Gap 6: Dashboard API Integration (CRITICAL)
**File:** repos/metabob-dashboard/src/cloud/api/ProjectApi.js  
**Component:** `getProjects`  
**Current:** Calls GET /auth/orgs/{org_id}/projects - receives 404  
**Desired:** Should receive paginated list of projects with stats  
**Gap:** Backend API route missing - breaks dashboard UI  
**Priority:** P0  
**Effort:** Fixed by Gap 4

---

## Complete Data Flow

```
CLI Entry Point
  repos/metabob-cli/src/metabob_cli/commands.py:analyze()
  ↓ Parse Args, Load Config

File Collection
  repos/metabob-cli/src/metabob_cli/core/analysis_engine.py:_process_priority_files()
  ↓ Read files from disk → dict[str, bytes]

HTTP POST to Backend
  repos/metabob-cli/src/metabob_cli/core/analysis_api_client.py:submit_files()
  ↓ multipart/form-data + session token

Session Validation
  repos/metabob-rpc-api/server/routes/analysis.py:post_analysis_v2()
  ↓ Validate JWT, query Redis for session

Redis Storage (Files)
  repos/metabob-rpc-api/server/actions/analysis.py:submit_files()
  ↓ HSET session:{id}:files

Celery Task Spawn
  repos/metabob-rpc-api/server/actions/analysis.py:analyze()
  ↓ Create job_id, spawn 3 parallel tasks

ML Model Inference
  repos/metabob-rpc-api/tasks/jobs/analysis.py:run_analysis()
  ↓ ClassificationRequest → model.classification_stream()

Confidence Filtering
  ↓ Filter predictions by confidence > 0.75

Deduplication
  ↓ Hash = md5(path + category + lines + context)

Redis Storage (Problems)
  repos/metabob-rpc-api/tasks/jobs/analysis.py:_store_results()
  ↓ HSET session:{id}:problems
  ↓ Preserve problem IDs via hash-based deduplication

❌ [MISSING: SurrealDB Persistence Layer]
  ↓ Should copy results to problems table
  ↓ Link to project_id and session_id

❌ [MISSING: Dashboard API Route]
  repos/metabob-rpc-api/server/routes/cloud_auth.py
  ↓ GET /auth/orgs/{org_id}/projects → 404

❌ [BROKEN: UI Display]
  repos/metabob-dashboard/src/cloud/api/ProjectApi.js:getProjects
  ↓ Cannot fetch projects, shows empty state
```

---

## Architectural Boundaries

### Boundary 1: CLI → RPC API (HTTP REST)
- **Contract:** POST /v2/submit with multipart/form-data
- **Coupling:** Medium (session management, file formats)
- **Resilience:** Retry with exponential backoff, session refresh on 401
- **Status:** ✅ WORKING

### Boundary 2: RPC API → Celery Workers (Message Queue)
- **Contract:** Celery task with session_id, job_id parameters
- **Coupling:** Medium-Tight (shared Redis state, task signatures)
- **Resilience:** No task retry, acks_late=False (task loss risk)
- **Status:** ✅ WORKING (but risky)

### Boundary 3: RPC API → Redis (Data Store)
- **Contract:** Redis hashes (session:{id}:files, session:{id}:problems)
- **Coupling:** Tight (hardcoded key names, no abstraction)
- **Resilience:** No error handling, no retry on connection failure
- **Status:** ✅ WORKING (but fragile)

### Boundary 4: RPC API → SurrealDB (Data Store)
- **Contract:** SurrealQL queries on projects/problems tables
- **Coupling:** Medium (repository pattern, SurrealQL vendor lock-in)
- **Resilience:** Singleton connection, no reconnection on disconnect
- **Status:** ❌ BROKEN - Database exists but NOT USED for analysis results

### Boundary 5: Dashboard → RPC API (HTTP REST)
- **Contract:** GET /auth/orgs/{org_id}/projects (expected)
- **Coupling:** Loose (RESTful, JWT, JSON)
- **Resilience:** RTK Query caching and retry
- **Status:** ❌ BROKEN - Route returns 404

---

## Critical Risks

### Risk 1: Data Loss on Worker Crash (HIGH)
- **Location:** repos/metabob-rpc-api/tasks/jobs/analysis.py
- **Issue:** acks_late=False means tasks acknowledged before processing
- **Impact:** Analysis results lost if worker crashes during execution
- **Mitigation:** Set acks_late=True, add task retry, implement dead-letter queue

### Risk 2: Memory Exhaustion (HIGH)
- **Location:** Multiple components
- **Issue:** No file size limits, all files loaded into memory
- **Impact:** Worker could crash processing large codebases
- **Mitigation:** Add file size limits (10MB/file, 100MB total), stream processing

### Risk 3: Redis Data Loss (HIGH)
- **Location:** All Redis storage points
- **Issue:** Redis is ephemeral, data lost on restart or eviction
- **Impact:** Users lose analysis history after 7 days, cannot query past results
- **Mitigation:** Copy to SurrealDB, add Redis persistence (AOF/RDB), archival job

### Risk 4: No Error Handling (HIGH)
- **Location:** repos/metabob-rpc-api/server/actions/analysis.py
- **Issue:** Redis operations have no try-except blocks
- **Impact:** Uncaught exceptions crash requests, no graceful degradation
- **Mitigation:** Add try-except around Redis calls, retry on transient errors

---

## Key Design Decisions

### Decision 1: Confidence Threshold = 0.75
- **Location:** repos/metabob-rpc-api/tasks/jobs/analysis.py:run_analysis()
- **Rationale:** Balance false positives vs false negatives
- **Tradeoff:** Hardcoded (cannot tune), some valid issues filtered out
- **Alternative:** Make configurable per-user/per-project (rejected: complexity)

### Decision 2: Hash-Based Deduplication
- **Location:** repos/metabob-rpc-api/tasks/jobs/analysis.py:_store_results()
- **Formula:** md5(path + category + start_line + end_line + context)
- **Rationale:** Stable problem IDs across re-analyses, preserve user feedback
- **Tradeoff:** Line number shifts → new problem, hash collisions possible

### Decision 3: Redis for Ephemeral Storage
- **Location:** repos/metabob-rpc-api/server/actions/analysis.py:submit_files()
- **Rationale:** Fast in-memory, Celery workers can access, natural TTL
- **Tradeoff:** Data lost on restart, memory pressure, no historical analysis
- **Critical Issue:** No migration path to SurrealDB for long-term storage

### Decision 4: Celery for Async Processing
- **Location:** repos/metabob-rpc-api/server/actions/analysis.py:analyze()
- **Rationale:** Non-blocking API, parallel execution, scalable workers
- **Tradeoff:** Complexity, task loss risk, no retry on failure

---

## Required Fixes (Priority Order)

### Phase 1: Restore End-to-End Functionality (P0)
**Goal:** Dashboard displays projects and analysis results  
**Effort:** 3-5 days

**Tasks:**
1. Implement GET /auth/orgs/{org_id}/projects route in cloud_auth.py
2. Add CLI project registration in commands.py:analyze()
3. Link sessions to projects (add project_id to session context)
4. Test end-to-end flow: CLI → API → Dashboard

### Phase 2: Add Data Persistence (P1)
**Goal:** Analysis results stored permanently in SurrealDB  
**Effort:** 2-3 days

**Tasks:**
1. Create problems table schema in SurrealDB
2. Implement persistence layer in tasks/jobs/analysis.py:_store_results()
3. Update project stats after analysis (total_problems_found, etc.)
4. Add archival job for expiring sessions

### Phase 3: Improve Resilience (P1)
**Goal:** Service handles failures gracefully, no data loss  
**Effort:** 2-3 days

**Tasks:**
1. Set acks_late=True on Celery tasks
2. Add task retry on failure (max 3 attempts)
3. Add error handling around Redis operations (try-except)
4. Implement SurrealDB reconnection logic
5. Add file size limits (10MB/file, 100MB total)

---

## Reusable Patterns Identified

### Pattern 1: Async Processing Pipeline
- **Flow:** CLI → API Client → Session Validation → Task Queue → Worker → Dual Storage → Query → Display
- **Reusable:** Yes, could be activity template "async-processing-pipeline"
- **Variables:** entry_point, processing_function, storage_destination, result_endpoint

### Pattern 2: Deduplication by Hash
- **Flow:** Compute hash → Build hash→ID mapping → Reuse/Generate IDs → Store
- **Reusable:** Yes, applicable to any content-based identity

### Pattern 3: Retry with Exponential Backoff
- **Flow:** Try → Catch transient error → Wait (exponential) → Retry → Max attempts
- **Reusable:** Yes, standard for HTTP, database, message queue ops

### Pattern 4: Session Management with Redis
- **Flow:** Credentials → Create session + JWT → Store with TTL → Token in requests → Validate
- **Reusable:** Yes, standard session pattern

---

## Key Files Reference

| Component | File | Function |
|-----------|------|----------|
| CLI Entry | repos/metabob-cli/src/metabob_cli/commands.py | analyze() |
| Config Load | repos/metabob-cli/src/metabob_cli/core/config.py | load_config() |
| File Collection | repos/metabob-cli/src/metabob_cli/core/analysis_engine.py | _process_priority_files() |
| API Client | repos/metabob-cli/src/metabob_cli/core/analysis_api_client.py | submit_files() |
| API Route | repos/metabob-rpc-api/server/routes/analysis.py | post_analysis_v2() |
| Actions | repos/metabob-rpc-api/server/actions/analysis.py | submit_files(), analyze() |
| Task Handler | repos/metabob-rpc-api/tasks/jobs/analysis.py | run_analysis(), _store_results() |
| DB Operations | repos/metabob-rpc-api/server/db/operations/project_ops.py | list_projects_by_org() |
| Dashboard API | repos/metabob-dashboard/src/cloud/api/ProjectApi.js | getProjects |

---

## Documentation Artifacts

1. **Full Flow Documentation:** docs/data-flows/metabob-cli-to-dashboard-data-flow-flow.md
2. **JSON Summary:** /tmp/trace-analysis-summary.json
3. **Impulse Content:** /tmp/trace-impulse-content.md
4. **Impulse Metadata:** /tmp/create-trace-impulse.json

---

## Impulse Information

**Impulse ID:** trace-metabob-cli-to-dashboard-data-flow  
**Type:** memo  
**Budget:** 5000 tokens  
**Status:** Created  
**Purpose:** Store complete trace analysis for downstream validation and enforcement tasks

The impulse contains:
- Complete data flow from entry to exit
- Component-by-component gap analysis
- Architectural boundaries and their status
- Critical risks and mitigation strategies
- Required fixes in priority order
- Reusable patterns identified

---

## Next Actions for Calling Agent

1. **Use this trace** to inform enforcement tasks
2. **Prioritize P0 fixes** in Phase 1 (restore end-to-end functionality)
3. **Reference impulse** (trace-metabob-cli-to-dashboard-data-flow) in downstream activities
4. **Validate fixes** against documented current vs desired state
5. **Update documentation** as gaps are closed

---

**Trace Completed:** 2026-03-11  
**Total Duration:** 1385 seconds (23 minutes)  
**Total Cost:** $2.16  
**Activity:** trace-data-flow-single-feature  
**Status:** ✅ SUCCESS
