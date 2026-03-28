# Trace Impulse: metabob-cli-to-dashboard-complete-data-flow

## Metadata
- **Impulse ID**: trace-metabob-cli-to-dashboard-complete-data-flow
- **Type**: templateDefinition
- **Budget**: 5000 tokens
- **Status**: Complete
- **Created**: 2026-03-12
- **Purpose**: Comprehensive implementation trace for enforcement and validation

---

## Specification Summary

**Name**: metabob-cli-to-dashboard-complete-data-flow  
**Goal**: Complete E2E data flow ensuring metabob-cli analysis results persist in SurrealDB and appear in Dashboard UI  
**Current Status**: PARTIALLY IMPLEMENTED  
**Critical Blocker**: Deployment + problem_ops.py fix

---

## Implementation Status

### ✅ WORKING (Deployed)
- Authentication flow (user registration, login)
- Dashboard access (JWT-based)
- API routing (FastAPI endpoints defined)
- Database schema (tables with temporal tracking)

### ⚠️ CODED BUT NOT DEPLOYED
- Project persistence fix (commit adb858a)
- SQL INSERT pattern for project_ops.py

### ❌ BROKEN (Needs Fix)
- Problem persistence (3 instances in problem_ops.py)
- Organization creation (1 instance)
- API key management (1 instance)
- User operations (2 additional instances)

---

## Root Cause Analysis

**Bug**: surrealdb-py HTTP client `.create()` and `.insert()` methods don't persist records

**Symptom**:
```
POST /api/auth/orgs/{org_id}/projects → 201 CREATED
GET /api/auth/orgs/{org_id}/projects → [] (empty list)
```

**Evidence**: Commits d61fa57 (auth fix) and adb858a (project fix) prove SQL INSERT pattern works

**Platform Impact**: 13 instances across 8 files (1 fixed, 12 remaining)

---

## Component Trace

### 1. project_ops.py (✅ FIXED - Not Deployed)
**File**: repos/metabob-rpc-api/server/db/operations/project_ops.py  
**Lines**: 46-97  
**Fix Type**: SQL INSERT pattern with temporal tracking  
**Status**: CODED_NOT_DEPLOYED  
**Blocker**: Docker registry access

**Implementation**:
```python
# Lines 48-74: SQL INSERT with parameterized query
sql = """
    INSERT INTO projects {
        project_id: $project_id,
        org_id: $org_id,
        name: $name,
        git_root_hash: $git_root_hash,
        repository_url: $repository_url,
        branch: $branch,
        settings: $settings,
        created_at: $created_at,
        updated_at: $updated_at
    }
"""
result = await db.query(sql, params)
```

**Validation**: Lines 78-97 handle result parsing and fallback

---

### 2. problem_ops.py (❌ BROKEN - 3 Instances)
**File**: repos/metabob-rpc-api/server/db/operations/problem_ops.py  
**Status**: NEEDS_FIX

**Instance 1** (Line 78):
```python
# BROKEN
result = await db.create("problems", data)
```

**Instance 2** (Line 103):
```python
# BROKEN
result = await db.insert("problems", problems)
```

**Instance 3** (Line 116):
```python
# BROKEN (fallback)
record = await db.create("problems", problem)
```

**Required Fix**: Convert all 3 to SQL INSERT pattern (same as project_ops.py)

**Impact**: CRITICAL - Blocks metabob-cli → Dashboard problem visualization

---

### 3. projects.py (✅ WORKING - Pending Deployment)
**File**: repos/metabob-rpc-api/server/routes/projects.py  
**Status**: WORKING_PENDING_DEPLOYMENT

**Endpoints**:
- POST /{org_id}/projects (Lines 21-118) - Authentication + idempotency
- GET /{org_id}/projects (Lines 121-206) - Pagination + filtering
- GET /{org_id}/projects/{project_id}/problems (Lines 290-430) - Problem list with grouping

**Gap**: None in code - blocked on deployment + problem_ops.py fix

---

## Data Flow Chain

### Current Flow (Broken)
```
metabob-cli → POST /projects → project_ops.create_project() → db.create() 
  → [DATA LOST] → GET /projects → []
```

### Fixed Flow (project_ops.py)
```
metabob-cli → POST /projects → project_ops.create_project() → SQL INSERT 
  → SurrealDB persists → GET /projects → [project data] ✅
```

### Problem Flow (Broken)
```
metabob-cli analyze → POST /problems → problem_ops.create_problem() 
  → db.create() → [DATA LOST] → GET /problems → []
```

### Target Flow (After All Fixes)
```
metabob-cli (Python)
  ↓
POST /api/auth/orgs/{org_id}/projects
  ↓
FastAPI Router (projects.py:21)
  ↓
project_ops.create_project() → SQL INSERT → SurrealDB persists
  ↓
GET /api/auth/orgs/{org_id}/projects
  ↓
project_ops.list_projects_by_org() → Returns project data
  ↓
Dashboard UI displays projects with counts
  ↓
metabob-cli analyze → POST /problems
  ↓
problem_ops.create_problem() → SQL INSERT → SurrealDB persists
  ↓
GET /projects/{id}/problems → Returns problem data
  ↓
Dashboard UI displays problems grouped by file/severity
```

---

## Architecture Decision

**Title**: SurrealDB HTTP Client Workaround

**Decision**: ALL database writes MUST use SQL INSERT/UPDATE statements. NEVER use db.create() or db.insert().

**Pattern**:
```python
# ❌ NEVER USE
result = await db.create("table", data)
result = await db.insert("table", data)

# ✅ ALWAYS USE
sql = "INSERT INTO table { field: $value, created_at: $created_at, updated_at: $updated_at }"
result = await db.query(sql, params)
```

**Scope**: Platform-wide (all *_ops.py files)

**Enforcement**: Code review + future pre-commit hook

---

## Temporal Tracking

**Requirement**: All entities must have created_at and updated_at in ISO 8601 format with 'Z' suffix

**Implementation Status**:
- ✅ Projects (project_ops.py:43-44): `datetime.utcnow().isoformat() + "Z"`
- ✅ Problems (problem_ops.py:74-75): `datetime.utcnow().isoformat()` (missing 'Z')
- ✅ Users (commit d61fa57): Verified in deployed auth flow
- ⚠️ Organizations: Needs verification

---

## Deployment Pipeline

**Docker Image**: metabobapp/metabob-rpc-api:0.28.3-project-persistence-fix  
**Build Status**: ✅ Built locally  
**Push Status**: ❌ Blocked - No registry access  
**K8s Deployment**: ⏳ Pending image push  

**Validation Command**:
```bash
kubectl get deployment metabob-rpc-api -n metabob -o jsonpath='{.spec.template.spec.containers[0].image}'
```

---

## Testing Evidence

### Playwright E2E (Baseline Established)
- ✅ Login successful
- ✅ Dashboard accessible
- ✅ Projects page loads (shows "0 active, 0 archived")
- ⚠️ Confirms persistence bug (no projects despite API POST success)

### API Tests
- ✅ POST /projects → 201 CREATED
- ❌ GET /projects → [] (empty list)

**Test Credentials**: /tmp/e2e-test-creds.sh

---

## Critical Path

### Phase 1: Deploy Existing Fix (P0 - CRITICAL)
**Blocker**: Docker registry access  
**Steps**:
1. Push image to registry
2. Deploy to Kubernetes
3. Validate project persistence

**Validation**:
```bash
source /tmp/e2e-test-creds.sh
curl -X POST http://app.metabob.local/api/auth/orgs/$ORG_ID/projects \
  -H "Authorization: Bearer $JWT_TOKEN" -d '{"name": "Test"}'
curl -X GET http://app.metabob.local/api/auth/orgs/$ORG_ID/projects \
  -H "Authorization: Bearer $JWT_TOKEN"
# Expected: {"projects": [...], "total": 1}
```

### Phase 2: Fix problem_ops.py (P0 - CRITICAL)
**Effort**: Medium (3 instances)  
**Files**: repos/metabob-rpc-api/server/db/operations/problem_ops.py  
**Changes**: Convert lines 78, 103, 116 to SQL INSERT pattern  

**Validation**:
```bash
metabob-cli analyze --project-id $PROJECT_ID
curl -X GET http://app.metabob.local/api/auth/orgs/$ORG_ID/projects/$PROJECT_ID/problems \
  -H "Authorization: Bearer $JWT_TOKEN"
# Expected: {"problems": [...], "total": N}
```

### Phase 3: E2E Validation (P1 - HIGH)
- Playwright: Login → Projects page → Verify count > 0
- API: Create project → Verify persists → Create problems → Verify persists
- Dashboard: View projects with accurate counts and problem lists

### Phase 4: Fix Remaining Files (P2 - MEDIUM)
- organization_ops.py (1 instance) - HIGH
- api_key_ops.py (1 instance) - MEDIUM
- user_ops.py (2 instances) - HIGH
- activity_execution.py (1 instance) - MEDIUM
- impulse_learning.py (2 instances) - LOW
- task_execution.py (1 instance) - LOW
- template_data.py (1 instance) - LOW

---

## Validation Criteria

### Project Persistence
- [x] Code written with SQL INSERT
- [ ] Deployed to Kubernetes
- [ ] POST returns 201, GET returns project
- [ ] Dashboard displays project

### Problem Persistence
- [ ] Code written with SQL INSERT
- [ ] Deployed to Kubernetes
- [ ] metabob-cli analyze completes
- [ ] GET /problems returns data
- [ ] Dashboard displays problems

### Temporal Tracking
- [ ] created_at populated on INSERT
- [ ] updated_at matches created_at
- [ ] updated_at changes on UPDATE
- [ ] ORDER BY created_at DESC works

### Data Hierarchy
- [ ] Users → Orgs → Projects → Problems linkage intact
- [ ] No orphaned records
- [ ] Temporal queries work

---

## References

**Commits**:
- d61fa57: User registration persistence fix (authentication)
- adb858a: Project creation persistence fix (this feature)
- 8016e08: Query result parsing fix
- df63d83: Temporal field naming fix

**Documentation**:
- E2E_DATA_FLOW_PROJECT_PERSISTENCE_BUG.md
- SURREALDB_PERSISTENCE_BUG_AUDIT.md
- DEPLOYMENT_BLOCKER_IMAGE_REGISTRY.md
- SESSION_FINAL_SUMMARY.md

**Test Artifacts**:
- /tmp/e2e-test-creds.sh (JWT_TOKEN, ORG_ID, PROJECT_ID)
- Playwright screenshots (login, dashboard, projects)

---

## JSON Trace Data

```json
{
  "specificationName": "metabob-cli-to-dashboard-complete-data-flow",
  "status": "PARTIALLY_IMPLEMENTED",
  "rootCause": "SurrealDB HTTP client persistence bug",
  "components": [
    {
      "file": "repos/metabob-rpc-api/server/db/operations/project_ops.py",
      "component": "create_project",
      "status": "CODED_NOT_DEPLOYED",
      "gap": "Deployment blocked on Docker registry access"
    },
    {
      "file": "repos/metabob-rpc-api/server/db/operations/problem_ops.py",
      "component": "create_problem, bulk_create_problems",
      "status": "NEEDS_FIX",
      "gap": "3 instances need SQL INSERT conversion (lines 78, 103, 116)"
    },
    {
      "file": "repos/metabob-rpc-api/server/routes/projects.py",
      "component": "Project CRUD endpoints",
      "status": "WORKING_PENDING_DEPLOYMENT",
      "gap": "None - blocked on deployment"
    }
  ],
  "dataFlow": "metabob-cli → POST /projects → SQL INSERT → SurrealDB → GET /projects → Dashboard",
  "criticalPath": [
    "Deploy project_ops.py fix (P0)",
    "Fix problem_ops.py (P0)",
    "E2E validation (P1)",
    "Fix remaining 9 instances (P2)"
  ],
  "testingEvidence": {
    "authentication": "✅ WORKING (deployed)",
    "projectPersistence": "⚠️ Coded but not deployed",
    "problemPersistence": "❌ Broken (needs fix)"
  }
}
```

---

**Impulse Complete - Ready for Enforcement and Validation**
