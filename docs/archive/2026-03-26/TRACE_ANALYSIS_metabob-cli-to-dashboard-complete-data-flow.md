# Trace Analysis: metabob-cli-to-dashboard-complete-data-flow

## Executive Summary

**Status**: PARTIALLY IMPLEMENTED - Critical deployment blocker  
**Root Cause**: Systematic SurrealDB HTTP client persistence bug  
**Impact**: Data written to database doesn't persist (POST succeeds but GET returns empty)  
**Fixes**: 1 coded (project_ops.py), 12 remaining instances across 8 files  

---

## Current State vs Desired State

### ✅ WORKING (Deployed)
- **Authentication Flow**: User registration and login (commit d61fa57)
- **Dashboard Access**: Login page → Projects page navigation
- **API Routing**: FastAPI endpoints defined and accessible
- **Database Schema**: Tables created with temporal tracking fields

### ⚠️ PARTIALLY WORKING (Coded but Not Deployed)
- **Project Creation**: Fix coded in commit adb858a but blocked on Docker registry access
- **Project Retrieval**: Code correct, but queries return empty due to persistence bug

### ❌ BROKEN (Needs Fix)
- **Problem Creation**: 3 instances in problem_ops.py using db.create()/db.insert()
- **Organization Creation**: 1 instance in organization_ops.py
- **API Key Management**: 1 instance in api_key_ops.py
- **User Operations**: 2 additional instances in user_ops.py

---

## Data Flow Architecture

### E2E Flow (Intended)
```
metabob-cli (Python)
  → POST /api/auth/orgs/{org_id}/projects
    → FastAPI Router (projects.py:21)
      → project_ops.create_project()
        → SurrealDB SQL INSERT ✅ FIXED
          → SurrealDB persistence layer
            → GET /api/auth/orgs/{org_id}/projects
              → project_ops.list_projects_by_org()
                → Dashboard UI displays projects
```

### Problem Data Flow (Currently Broken)
```
metabob-cli analyze
  → POST /api/problems
    → problem_ops.create_problem() ❌ Uses db.create()
      → [DATA LOST - not persisted]
        → GET /api/auth/orgs/{org_id}/projects/{project_id}/problems
          → Returns empty list
```

### Data Hierarchy
```
users (temporal: created_at)
  ├─ user_organizations (temporal: joined_at)
  └─ organizations (temporal: created_at)
       └─ projects (temporal: created_at, updated_at) ✅ FIXED
            └─ problems (temporal: created_at, updated_at) ❌ BROKEN
```

---

## Component Analysis

### 1. project_ops.py - ✅ FIXED (Deployment Blocked)

**File**: `repos/metabob-rpc-api/server/db/operations/project_ops.py`  
**Lines**: 46-97  
**Status**: CODED_NOT_DEPLOYED

**Current Implementation** (Lines 48-74):
```python
# Use direct SQL INSERT to ensure persistence (surrealdb-py HTTP client bug workaround)
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

**Evidence of Fix**:
- Temporal tracking: Lines 43-44 (ISO 8601 with 'Z' suffix)
- Result parsing: Lines 78-84 (handles multiple response formats)
- Fallback response: Lines 87-97 (ensures consistent API response)
- Comment references commit d61fa57 (proven pattern)

**Gap**: Deployment blocked due to Docker registry access

---

### 2. problem_ops.py - ❌ BROKEN (3 Instances)

**File**: `repos/metabob-rpc-api/server/db/operations/problem_ops.py`  
**Status**: NEEDS_FIX

**Instance 1: create_problem (Line 78)**
```python
# BROKEN CODE
result = await db.create("problems", data)
```

**Instance 2: bulk_create_problems (Line 103)**
```python
# BROKEN CODE
result = await db.insert("problems", problems)
```

**Instance 3: bulk_create_problems fallback (Line 116)**
```python
# BROKEN CODE (fallback loop)
record = await db.create("problems", problem)
```

**Required Fix**: Convert all 3 to SQL INSERT pattern
```python
# FIXED PATTERN (from project_ops.py)
sql = """
    INSERT INTO problems {
        problem_id: $problem_id,
        session_id: $session_id,
        project_id: $project_id,
        org_id: $org_id,
        file_path: $file_path,
        start_line: $start_line,
        end_line: $end_line,
        category: $category,
        severity: $severity,
        description: $description,
        recommendation: $recommendation,
        context: $context,
        problem_hash: $problem_hash,
        status: $status,
        metadata: $metadata,
        created_at: $created_at,
        updated_at: $updated_at
    }
"""
result = await db.query(sql, params)
```

**Impact**: Critical - Blocks metabob-cli → Dashboard problem visualization

---

### 3. projects.py (API Routes) - ✅ WORKING

**File**: `repos/metabob-rpc-api/server/routes/projects.py`  
**Status**: WORKING_PENDING_DEPLOYMENT

**Endpoints Defined**:
1. **POST /{org_id}/projects** (Lines 21-118)
   - Authentication: JWT required
   - Authorization: Verifies org_id matches user's org
   - Idempotency: Checks existing project before create
   - Calls: `create_project()` from project_ops

2. **GET /{org_id}/projects** (Lines 121-206)
   - Pagination: limit (max 100), offset
   - Authorization: org_id verification
   - Returns: projects list, total count, hasMore flag
   - Calls: `list_projects_by_org()` from project_ops

3. **GET /{org_id}/projects/{project_id}/problems** (Lines 290-430)
   - Filters: severity_filter (HIGH/MEDIUM/LOW)
   - Pagination: limit (max 1000), offset
   - Grouping: By component (file_path), severity distribution
   - Calls: `list_problems_by_project()` from problem_ops ❌ Returns empty

**Gap**: None in code - blocked on deployment and problem_ops.py fix

---

### 4. Other Affected Files (Audit Findings)

**organization_ops.py** (1 instance)
- Line: Unknown (needs review)
- Pattern: `await db.create("organizations", data)`
- Impact: Medium (org creation less frequent than projects/problems)

**api_key_ops.py** (1 instance)
- Line: Unknown
- Pattern: `await db.create("api_keys", data)`
- Impact: Low (API key creation rare)

**user_ops.py** (2 instances)
- Line: Unknown (registration fix deployed, but 2 more remain)
- Pattern: `await db.create()` or `await db.create("user_organizations", data)`
- Impact: High (user operations critical)

---

## Temporal Tracking Implementation

### Requirements
All entities must have:
- `created_at`: ISO 8601 format with 'Z' suffix (UTC)
- `updated_at`: ISO 8601 format, updated on modifications

### Implementation Status

**✅ Projects** (project_ops.py:43-44)
```python
created_at = datetime.utcnow().isoformat() + "Z"
updated_at = created_at
```

**✅ Problems** (problem_ops.py:74-75)
```python
"created_at": datetime.utcnow().isoformat(),
"updated_at": datetime.utcnow().isoformat(),
```
Note: Missing 'Z' suffix - should add for consistency

**✅ Users** (per commit d61fa57)
- Verified in deployed authentication flow

**⚠️ Organizations** (needs verification)
- Audit required to confirm temporal fields

---

## Deployment Pipeline Status

### Docker Image
- **Tag**: `metabobapp/metabob-rpc-api:0.28.3-project-persistence-fix`
- **Build**: ✅ Completed locally
- **Push**: ❌ Blocked - No Docker registry credentials/access
- **Size**: Not recorded

### Kubernetes Deployment
- **Namespace**: metabob
- **Deployment**: metabob-rpc-api
- **Current Image**: 0.28.2 (or earlier)
- **Target Image**: 0.28.3-project-persistence-fix
- **Helm Chart**: Updated in `repos/platform/.../default.metabob-rpc-api.values.yaml`

### Validation Commands
```bash
# Check current deployment
kubectl get deployment metabob-rpc-api -n metabob -o jsonpath='{.spec.template.spec.containers[0].image}'

# After deployment: Verify fix in pod
kubectl exec -n metabob $(kubectl get pods -n metabob -l app=metabob-rpc-api -o name | head -1) \
  -- grep -c "Use direct SQL INSERT" /src/app/server/db/operations/project_ops.py
```

---

## Testing Evidence

### Playwright E2E Tests (Baseline Established)

**Test User**: `dashboard-ui-test-1773331483@example.com`  
**Credentials**: Stored in `/tmp/e2e-test-creds.sh`

| Test | Result | Evidence |
|------|--------|----------|
| Navigate to app.metabob.local | ✅ Pass | Homepage screenshot |
| Fill login form | ✅ Pass | Credentials filled |
| Submit login | ✅ Pass | No errors, JWT received |
| Dashboard accessible | ✅ Pass | Dashboard screenshot |
| Projects page loads | ✅ Pass | Shows "0 active, 0 archived" |

**Conclusion**: Authentication fix (commit d61fa57) is deployed and working

### API Tests (Manual)

**Test Credentials**: JWT token, ORG_ID stored in `/tmp/e2e-test-creds.sh`

| Test | Result | Details |
|------|--------|---------|
| POST /api/auth/orgs/{org_id}/projects | ✅ 201 CREATED | Returns project object with ID |
| GET /api/auth/orgs/{org_id}/projects | ❌ Empty list | `{"projects": [], "total": 0}` |
| SurrealDB direct query | ⏳ Not tested | Would confirm record doesn't exist |

**Conclusion**: Confirms persistence bug - API success doesn't persist data

---

## Bug Pattern Analysis

### Symptom
```
POST /api/auth/orgs/{org_id}/projects
  Response: 201 CREATED
  Body: {"project_id": "uuid", "name": "Test", ...}

GET /api/auth/orgs/{org_id}/projects
  Response: 200 OK
  Body: {"projects": [], "total": 0, "hasMore": false}
```

### Root Cause
**surrealdb-py HTTP client** methods don't persist records:
- `db.create(table, data)` → Returns success, doesn't persist
- `db.insert(table, data)` → Returns success, doesn't persist

### Proof
1. **Commit d61fa57**: Fixed user registration with SQL INSERT → Authentication works
2. **Commit adb858a**: Fixed project creation with SQL INSERT → Code ready
3. **Pattern**: Identical problem, identical solution

### Platform Impact
**Total**: 13 instances across 8 files  
**Fixed**: 1 (project_ops.py)  
**Remaining**: 12

**Critical Path**:
- problem_ops.py (3) - CRITICAL for E2E
- organization_ops.py (1) - HIGH
- user_ops.py (2) - HIGH
- api_key_ops.py (1) - MEDIUM
- activity_execution.py (1) - MEDIUM
- impulse_learning.py (2) - LOW
- task_execution.py (1) - LOW
- template_data.py (1) - LOW

---

## Architecture Decision Record

### Title
SurrealDB HTTP Client Workaround - Mandatory SQL INSERT Pattern

### Decision
**ALL database write operations MUST use SQL INSERT/UPDATE statements.**  
**NEVER use `db.create()` or `db.insert()` methods.**

### Context
- surrealdb-py HTTP client has unresolved persistence bug
- Methods return success but records don't persist
- Discovered in production deployment (authentication flow)
- Affects all table writes across platform

### Pattern to Use
```python
# ❌ NEVER USE
result = await db.create("table", data)
result = await db.insert("table", data)

# ✅ ALWAYS USE
sql = """
    INSERT INTO table {
        field1: $param1,
        field2: $param2,
        created_at: $created_at,
        updated_at: $updated_at
    }
"""
params = {
    "param1": value1,
    "param2": value2,
    "created_at": datetime.utcnow().isoformat() + "Z",
    "updated_at": datetime.utcnow().isoformat() + "Z",
}
result = await db.query(sql, params)

# Handle result parsing (multiple formats possible)
if result and len(result) > 0:
    if isinstance(result[0], dict) and "result" in result[0]:
        records = result[0]["result"]
        if records and len(records) > 0:
            return sanitize_record(records[0])
    elif isinstance(result[0], list) and len(result[0]) > 0:
        return sanitize_record(result[0][0])
```

### Enforcement
- **Code Review**: Check all *_ops.py files
- **Pre-commit Hook**: Grep for db.create/db.insert (future)
- **Documentation**: Add to developer guidelines

### References
- E2E_DATA_FLOW_PROJECT_PERSISTENCE_BUG.md
- SURREALDB_PERSISTENCE_BUG_AUDIT.md
- Commit d61fa57 (user registration fix)
- Commit adb858a (project creation fix)

---

## Critical Path Forward

### Phase 1: Deploy Existing Fix (CRITICAL)
**Priority**: P0 - Blocks all testing  
**Effort**: Low (code ready)  
**Blocker**: Docker registry access

**Steps**:
1. Obtain Docker Hub credentials OR set up local registry
2. Push image: `docker push metabobapp/metabob-rpc-api:0.28.3-project-persistence-fix`
3. Deploy to k8s: `kubectl set image deployment/metabob-rpc-api ...`
4. Verify deployment: `kubectl rollout status deployment/metabob-rpc-api -n metabob`

**Validation**:
```bash
source /tmp/e2e-test-creds.sh
curl -X POST http://app.metabob.local/api/auth/orgs/$ORG_ID/projects \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"name": "Test Project"}'
  
curl -X GET http://app.metabob.local/api/auth/orgs/$ORG_ID/projects \
  -H "Authorization: Bearer $JWT_TOKEN"
# Should return: {"projects": [{"name": "Test Project", ...}], "total": 1}
```

### Phase 2: Fix problem_ops.py (CRITICAL)
**Priority**: P0 - Required for metabob-cli E2E  
**Effort**: Medium (3 instances)  

**Files to Modify**:
- repos/metabob-rpc-api/server/db/operations/problem_ops.py

**Changes**:
1. Line 78: Convert `create_problem()` to SQL INSERT
2. Line 103: Convert `bulk_create_problems()` to SQL INSERT (batch)
3. Line 116: Remove fallback loop (no longer needed)

**Validation**:
```bash
# metabob-cli integration test
metabob-cli analyze --project-id $PROJECT_ID --org-id $ORG_ID
curl -X GET http://app.metabob.local/api/auth/orgs/$ORG_ID/projects/$PROJECT_ID/problems \
  -H "Authorization: Bearer $JWT_TOKEN"
# Should return problems with correct counts
```

### Phase 3: E2E Validation (HIGH)
**Priority**: P1 - Confirms complete fix  
**Effort**: Low (tests ready)  

**Tests**:
1. **Playwright E2E**:
   - Login to dashboard
   - Navigate to Projects page
   - Verify project appears with count > 0
   - Click project → View problems
   - Verify problems displayed with severity

2. **API Integration**:
   - Create project via API
   - Verify in GET /projects
   - Create problems via metabob-cli
   - Verify in GET /projects/{id}/problems
   - Check temporal ordering (ORDER BY created_at DESC)

3. **SurrealDB Direct Query**:
   ```bash
   kubectl exec -n metabob surrealdb-pod -- \
     surreal sql --conn http://localhost:8000 --user root --pass root \
     "SELECT * FROM projects WHERE org_id = '$ORG_ID'"
   ```

### Phase 4: Fix Remaining Files (MEDIUM)
**Priority**: P2 - Platform consistency  
**Effort**: High (9 instances across 5 files)  

**Files**:
1. organization_ops.py (1 instance) - HIGH
2. api_key_ops.py (1 instance) - MEDIUM
3. user_ops.py (2 instances) - HIGH
4. activity_execution.py (1 instance) - MEDIUM
5. impulse_learning.py (2 instances) - LOW
6. task_execution.py (1 instance) - LOW
7. template_data.py (1 instance) - LOW

**Approach**: Same pattern as project_ops.py and problem_ops.py

---

## Validation Criteria

### Project Persistence
- [x] Code written with SQL INSERT pattern
- [ ] Deployed to Kubernetes
- [ ] POST /projects returns 201 CREATED
- [ ] GET /projects returns created project
- [ ] Dashboard displays project in list
- [ ] Project count > 0 shown in UI

### Problem Persistence
- [ ] Code written with SQL INSERT pattern
- [ ] Deployed to Kubernetes
- [ ] metabob-cli analyze completes
- [ ] GET /projects/{id}/problems returns problems
- [ ] Dashboard displays problems by file
- [ ] Severity distribution accurate

### Temporal Tracking
- [ ] created_at populated on INSERT
- [ ] updated_at matches created_at initially
- [ ] updated_at changes on UPDATE
- [ ] ORDER BY created_at DESC works
- [ ] Timestamps queryable in SurrealDB

### Data Hierarchy
- [ ] Users link to organizations
- [ ] Organizations link to projects
- [ ] Projects link to problems
- [ ] Orphaned records don't exist
- [ ] CASCADE deletes work (if implemented)

---

## References

### Commits
- **d61fa57**: Fixed user registration persistence (authentication fix)
- **adb858a**: Fixed project creation persistence (this feature)
- **8016e08**: Fixed SurrealDB query result parsing
- **df63d83**: Fixed temporal field names (created_at vs joined_at)

### Documentation
- **E2E_DATA_FLOW_PROJECT_PERSISTENCE_BUG.md**: Detailed bug analysis
- **SURREALDB_PERSISTENCE_BUG_AUDIT.md**: Platform-wide audit (13 instances)
- **DEPLOYMENT_BLOCKER_IMAGE_REGISTRY.md**: Docker registry access issue
- **SESSION_FINAL_SUMMARY.md**: Previous session summary

### Test Artifacts
- **/tmp/e2e-test-creds.sh**: JWT_TOKEN, ORG_ID, PROJECT_ID, EMAIL
- **Playwright screenshots**: Login, dashboard, projects pages
- **Docker image**: metabobapp/metabob-rpc-api:0.28.3-project-persistence-fix (built, not pushed)

### Quick Commands
```bash
# Load test credentials
source /tmp/e2e-test-creds.sh

# Check deployment status
kubectl get deployment metabob-rpc-api -n metabob -o jsonpath='{.spec.template.spec.containers[0].image}'

# Test project creation
curl -X POST http://app.metabob.local/api/auth/orgs/$ORG_ID/projects \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Trace Test Project", "repository_url": "https://github.com/test/repo", "branch": "main"}'

# Verify project appears
curl -X GET http://app.metabob.local/api/auth/orgs/$ORG_ID/projects \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

## Trace Impulse Metadata

**Impulse ID**: trace-metabob-cli-to-dashboard-complete-data-flow  
**Type**: templateDefinition  
**Budget**: 5000 tokens  
**Purpose**: Comprehensive trace for downstream enforcement and validation tasks  
**Created**: 2026-03-12  
**Status**: Complete - Ready for use in trace-enforce-validate loop  

---

**End of Trace Analysis**
