# Trace Complete: metabob-cli-to-dashboard-complete-with-deployment

**Specification**: metabob-cli-to-dashboard-complete-with-deployment  
**Date**: 2026-03-12  
**Progress**: 50% (2/4 gaps closed)  
**Deployment Status**: BLOCKED - Python module cache issue  
**Critical Path**: Deploy → Implement Gaps 1-3 → Validate

---

## Executive Summary

Previous trace-enforce-validate-loop session implemented 50% of metabob-cli-to-dashboard integration:
- ✅ Backend API routes for projects (Gap 4)
- ✅ Database operations for problems (Gap 5)
- ❌ Deployment blocked (Python cache)
- ⏳ CLI project registration (Gap 1)
- ⏳ Session-project linking (Gap 2)
- ⏳ SurrealDB persistence (Gap 3)

**Key Achievement**: Backend code complete but not deployed - routes return 404 despite existing in source.

**Critical Blocker**: Docker Python module caching prevents new routes from being served. Solution: Full rebuild from source (in progress).

---

## Component Analysis

### ✅ COMPLETED Components (2/4 Gaps)

#### repos/metabob-rpc-api/server/routes/cloud_auth.py

**create_org_project()** (lines 737-835)
- **Current**: Implemented idempotent project creation with multi-tenant isolation
- **Desired**: Same, but must be deployed and accessible
- **Gap**: Deployment blocked - returns 404 despite code existing
- **Status**: Complete but not deployed

**get_org_projects()** (lines 838-930)
- **Current**: Implemented paginated project listing with stats
- **Desired**: Same, but must be deployed and accessible
- **Gap**: Deployment blocked - returns 404 despite code existing
- **Status**: Complete but not deployed

#### repos/metabob-rpc-api/server/db/operations/problem_ops.py

**bulk_create_problems()** (lines 83-140)
- **Current**: Batch insertion with fallback to individual inserts
- **Desired**: Should be called by analysis tasks
- **Gap**: Function exists but unused - no integration
- **Status**: Complete but unused

**Other Operations**: create_problem(), list_problems_by_project(), etc.
- **Status**: Complete but unused

---

### ❌ REMAINING Components (2/4 Gaps + Deployment)

#### Gap 1: CLI Project Registration (P0, 4-6 hours)

**repos/metabob-cli/src/metabob_cli/commands.py:analyze()**
- **Current**: Runs analysis, sends files to backend
- **Desired**: Register project before analysis via POST /auth/orgs/{org_id}/projects
- **Gap**: Missing project registration call
- **Implementation**:
  1. Add register_project() to AnalysisApiClient
  2. Extract org_id from JWT token
  3. Compute git_root_hash from git
  4. Call endpoint before submit_files()
  5. Handle errors and retry

**repos/metabob-cli/src/metabob_cli/core/analysis_api_client.py:AnalysisApiClient**
- **Current**: Only has submit_files() method
- **Desired**: Should also have register_project() method
- **Gap**: Missing method

#### Gap 2: Session-Project Linking (P0, 2-3 hours)

**repos/metabob-rpc-api/server/routes/analysis.py:post_analysis_v2()**
- **Current**: Creates session, stores files, spawns tasks
- **Desired**: Accept and store project_id parameter
- **Gap**: No project_id in session context
- **Implementation**:
  1. Add project_id to SessionData model
  2. Accept project_id form field
  3. Store in Redis session:{id}
  4. Pass to Celery tasks
  5. Update CLI to send project_id

#### Gap 3: SurrealDB Persistence (P0, 3-4 hours)

**repos/metabob-rpc-api/tasks/jobs/analysis.py:_store_results()**
- **Current**: Stores only in Redis (7-day TTL)
- **Desired**: Persist to both Redis and SurrealDB
- **Gap**: No SurrealDB persistence - data lost
- **Implementation**:
  1. Extract org_id/project_id from session
  2. Create sync wrapper for async bulk_create_problems()
  3. Persist to both Redis and SurrealDB
  4. Handle SurrealDB unavailability gracefully
  5. Update project stats

#### Deployment Blocker (P0, 15-20 minutes)

**Issue**: Python module caching in Docker
- **Root Cause**: Layered Dockerfile doesn't force module reload
- **Attempted**: Pod restart, cache clearing, image rebuild
- **Solution**: Full Docker rebuild from source
- **Impact**: Cannot validate until deployment succeeds

---

## Data Flow Trace

**Current State**: CLI → RPC API → Redis (7-day TTL) ⚠️ Data lost

**Target State**: CLI → Register Project → Create Session → Analysis → Dual Storage → Dashboard

### Step-by-Step Flow

| Step | Name | Entry Point | Action | Exit | Status |
|------|------|-------------|--------|------|--------|
| 1 | CLI Project Registration | repos/metabob-cli/.../commands.py:analyze() | POST /auth/orgs/{org_id}/projects | Project in SurrealDB | ❌ NOT_IMPL |
| 2 | Session-Project Link | repos/metabob-cli/.../analysis_api_client.py:submit_files() | POST /v2/submit?project_id=X | Session in Redis | ❌ NOT_IMPL |
| 3 | Analysis Execution | repos/metabob-rpc-api/tasks/jobs/analysis.py:run_analysis() | ML inference → dedup | Problems w/ IDs | ✅ WORKING |
| 4 | Dual Storage | repos/metabob-rpc-api/tasks/jobs/analysis.py:_store_results() | Redis + SurrealDB | Queryable problems | 🟡 PARTIAL |
| 5 | Dashboard Query | repos/metabob-dashboard/.../ProjectApi.js:getProjects | GET /auth/orgs/{org_id}/projects | Display projects | ❌ BLOCKED |

---

## Architectural Boundaries

| Boundary | Contract | Status | Resilience |
|----------|----------|--------|------------|
| CLI → RPC API | HTTP REST multipart | ✅ WORKING | Retry + backoff |
| RPC API → Celery | Message queue | ✅ WORKING | ⚠️ No retry |
| RPC API → Redis | Hash storage | ✅ WORKING | ⚠️ No error handling |
| RPC API → SurrealDB | SurrealQL | ❌ BROKEN | ⚠️ No reconnect |
| Dashboard → RPC API | HTTP REST JSON | ❌ BLOCKED | ✅ RTK Query retry |

---

## Critical Risks

### Risk 1: Data Loss on Worker Crash (HIGH)
- **Location**: repos/metabob-rpc-api/tasks/jobs/analysis.py
- **Issue**: acks_late=False - tasks acked before processing
- **Impact**: Results lost if worker crashes
- **Mitigation**: Set acks_late=True, add retry, dead-letter queue

### Risk 2: Memory Exhaustion (HIGH)
- **Location**: Multiple components
- **Issue**: No file size limits
- **Impact**: Worker crash on large codebases
- **Mitigation**: Add limits (10MB/file, 100MB total)

### Risk 3: Redis Data Loss (HIGH)
- **Location**: All Redis storage
- **Issue**: Ephemeral storage
- **Impact**: History lost after 7 days
- **Mitigation**: SurrealDB persistence (Gap 3)

---

## Next Actions (Priority Order)

### P0: Resolve Deployment Blocker (15-20 min, BLOCKER)
1. Complete Docker rebuild from source
2. Deploy: kubectl set image deployment/metabob-rpc-api
3. Verify: Run test-backend-endpoints-v2.sh
4. Check: /openapi.json shows project routes

### P0: Implement Gap 1 - CLI Project Registration (4-6 hours)
- **Depends**: Deployment blocker resolved
- **Tasks**: Add register_project(), extract org_id, compute git hash, call endpoint

### P0: Apply SurrealDB Schema Migration (1 hour)
- **Depends**: Deployment blocker resolved
- **Tasks**: Create problems table, add indexes

### P0: Implement Gap 2 - Session-Project Linking (2-3 hours)
- **Depends**: Gap 1 implemented
- **Tasks**: Add project_id to model, update endpoint, update CLI

### P0: Implement Gap 3 - SurrealDB Persistence (3-4 hours)
- **Depends**: Gap 2 + Schema migration
- **Tasks**: Add helpers, create wrapper, modify _store_results()

### P1: End-to-End Validation (1 hour)
- **Depends**: All gaps implemented
- **Tasks**: Run full flow, verify tracking, run harness

---

## Key Files Reference

| File | Function | Role | Status |
|------|----------|------|--------|
| repos/metabob-cli/src/metabob_cli/commands.py | analyze() | CLI entry | Gap 1 |
| repos/metabob-cli/src/metabob_cli/core/analysis_api_client.py | AnalysisApiClient | HTTP client | Gap 1 |
| repos/metabob-rpc-api/server/routes/cloud_auth.py | create_org_project(), get_org_projects() | Project CRUD | Not deployed |
| repos/metabob-rpc-api/server/routes/analysis.py | post_analysis_v2() | Analysis endpoint | Gap 2 |
| repos/metabob-rpc-api/tasks/jobs/analysis.py | _store_results() | Task handler | Gap 3 |
| repos/metabob-rpc-api/server/db/operations/problem_ops.py | bulk_create_problems() | DB ops | Unused |
| repos/metabob-dashboard/src/cloud/api/ProjectApi.js | getProjects | Dashboard API | Waiting |

---

## Testing Plan

### Deployment Validation (test-backend-endpoints-v2.sh)
1. Register test user
2. Create project (POST)
3. Fetch projects (GET)
4. Verify response structure

### Unit Tests (Planned)
- test_create_org_project_idempotent()
- test_get_org_projects_pagination()
- test_get_org_projects_forbidden()
- test_bulk_create_problems()
- test_list_problems_by_project()

### Integration Tests
- E2E Test 1: CLI register → verify SurrealDB
- E2E Test 2: Dashboard listing → verify UI
- E2E Test 3: Full flow → CLI → SurrealDB → Dashboard

---

## Reusable Patterns

### Pattern 1: Async Processing Pipeline
Flow: CLI → API → Queue → Worker → Dual Storage → Query → Display  
Reusable: Yes, activity template "async-processing-pipeline"

### Pattern 2: Deduplication by Hash
Flow: Compute hash → Map IDs → Reuse/Generate → Store  
Reusable: Yes, content-based identity

### Pattern 3: Idempotent API Design
Flow: Check exists → Return 200 OR Create 201  
Reusable: Yes, resource registration

---

## Impulse Information

**Impulse ID**: trace-metabob-cli-to-dashboard-complete-with-deployment  
**Type**: memo  
**Budget**: 5000 tokens  
**Content**: Full trace analysis with current vs desired state, gaps, deployment blocker, data flow, risks, and next actions  
**Purpose**: Comprehensive context for deployment, implementation, and validation tasks

---

## Summary

**Trace Date**: 2026-03-12  
**Progress**: 50% (2/4 gaps)  
**Status**: Partial - deployment blocked  
**Next Session**: Resolve deployment, implement gaps 1-3, validate end-to-end

**Critical Success Factors**:
1. Deploy backend changes (resolve Python cache issue)
2. Implement CLI project registration
3. Link sessions to projects
4. Persist problems to SurrealDB
5. Validate complete data flow

---

**Trace Complete**
