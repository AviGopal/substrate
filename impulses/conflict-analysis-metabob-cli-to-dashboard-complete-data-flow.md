# Conflict Analysis: metabob-cli-to-dashboard-complete-data-flow

## Metadata
- **Impulse ID**: conflict-analysis-metabob-cli-to-dashboard-complete-data-flow
- **Type**: memo
- **Budget**: 3000 tokens
- **Analysis Date**: 2026-03-12
- **Status**: ANALYZED

## Specification Overview

**Name**: metabob-cli-to-dashboard-complete-data-flow  
**Goal**: Fix SurrealDB persistence bug for project and problem data  
**Commits**: adb858a (project_ops.py), d5420bf (problem_ops.py)  
**Approach**: Replace `db.create()`/`db.insert()` with SQL INSERT statements

---

## Other Specifications Analyzed

Searched 20+ validation results in the system. Key related specifications found:

1. **surrealdb-official-library-integration**
   - Goal: Replace custom SurrealDB adapter with official surrealdb-py library
   - Status: PARTIAL_PASS (6/8 tests, 75%)
   - Deployment: Phase 1 code complete, Phase 3 (v3.0 upgrade) pending

2. **complete-architecture-separation**
   - Goal: Separate metabob-cli from rpc-api database operations
   - Status: Related to data flow architecture

3. **impulse-learning-storage-complete**
   - Goal: Store impulse learning data in SurrealDB
   - Status: May use db.create() (needs verification)

4. **context-optimization-endpoint-complete**
   - Goal: Optimize context fetching from SurrealDB
   - Status: May interact with persistence layer

5. **surrealdb-primary-redis-cache**
   - Goal: Use SurrealDB as primary store with Redis cache
   - Status: Architecture decision about storage layer

---

## Conflicts Detected

### Conflict 1: SurrealDB Library Migration vs SQL INSERT Workaround

**Type**: APPROACH_DIVERGENCE  
**Severity**: MEDIUM  

**Spec 1**: metabob-cli-to-dashboard-complete-data-flow  
- Approach: Use SQL INSERT statements to work around db.create() bug
- Pattern: `await db.query("INSERT INTO table {...}", params)`
- Rationale: db.create() doesn't persist with HTTP client

**Spec 2**: surrealdb-official-library-integration  
- Approach: Replace custom adapter with official surrealdb-py library
- Pattern: Use official library methods (db.create, db.insert, db.merge)
- Rationale: Official library more stable, better maintained

**Shared Components**:
- repos/metabob-rpc-api/server/db/surrealdb_client.py
- repos/metabob-rpc-api/server/db/operations/*.py (all operations files)

**Conflict Description**:
The official library integration aims to use native methods (db.create, db.insert), but the persistence fix explicitly avoids these methods due to HTTP client bugs. If the official library is deployed, it may reintroduce the persistence bug.

**Evidence**:
- Spec 1 validation shows db.create() doesn't persist (confirmed)
- Spec 2 validation shows official library not yet installed (deployment pending)
- Both touch same database operations layer

**Resolution Options**:

**Option A: Wait for Official Library Deployment (RECOMMENDED)**
- Complete surrealdb-official-library-integration deployment
- Upgrade SurrealDB to v3.0+ (fixes HTTP client bug?)
- Test if db.create() persists with new library
- If yes: Revert SQL INSERT workarounds
- If no: Keep SQL INSERT pattern

**Option B: Keep SQL INSERT Pattern Regardless**
- SQL INSERT is explicit and reliable
- Works with any SurrealDB version
- No dependency on library implementation
- Trade-off: Less idiomatic, more verbose

**Option C: Conditional Pattern Based on Library**
- Add library version check
- Use native methods if official library installed
- Fall back to SQL INSERT if custom adapter
- Complexity: Higher maintenance

**Recommendation**: Option A - Wait for official library deployment and test. Official library may fix HTTP client persistence issue.

---

### Conflict 2: Problem Endpoint Path Discrepancy

**Type**: API_DEFINITION_MISMATCH  
**Severity**: HIGH  

**Spec 1**: metabob-cli-to-dashboard-complete-data-flow  
- Expected: POST /api/problems
- Actual: 405 Method Not Allowed

**Spec 2**: (Unknown - API design not documented)  
- Possible path: /api/auth/orgs/{org_id}/projects/{project_id}/problems

**Shared Component**:
- repos/metabob-rpc-api/server/routes/*.py (problem routes)

**Conflict Description**:
Validation harness expects problem creation at /api/problems, but this returns 405. Endpoint may be at a different path or not implemented yet.

**Resolution**:
1. Search routes for problem creation endpoint
2. Update validation harness with correct path
3. If endpoint doesn't exist, create it
4. Document API path in specification

**Action Required**: Investigate repos/metabob-rpc-api/server/routes/ for problem endpoints

---

### Non-Conflict: Temporal Tracking

**Spec 1**: metabob-cli-to-dashboard-complete-data-flow  
- Requires: ISO 8601 timestamps with 'Z' suffix
- Implementation: `datetime.utcnow().isoformat() + "Z"`

**Other Specs**: No conflicts found  
- Temporal tracking is additive (doesn't break existing functionality)
- Standard format improves interoperability

**Status**: ✅ NO CONFLICT

---

## Shared Components Analysis

### Component 1: surrealdb_client.py

**File**: repos/metabob-rpc-api/server/db/surrealdb_client.py  

**Affected By Specs**:
1. metabob-cli-to-dashboard-complete-data-flow (SQL INSERT pattern)
2. surrealdb-official-library-integration (official library migration)

**Current State**:
- Custom adapter using HTTP client
- AsyncSurrealDBClient class implemented
- Official library import added (line 24) but not fully integrated

**Recommendation**:
- Complete official library integration first
- Test persistence with official library
- If persistence works: Remove SQL INSERT workarounds
- If persistence fails: Keep SQL INSERT pattern with official library

**Priority**: HIGH - Core database abstraction layer

---

### Component 2: project_ops.py

**File**: repos/metabob-rpc-api/server/db/operations/project_ops.py  

**Affected By Specs**:
1. metabob-cli-to-dashboard-complete-data-flow (SQL INSERT fix at lines 48-74)
2. surrealdb-official-library-integration (would use db.create)

**Current State**:
- Fixed with SQL INSERT (commit adb858a)
- NOT deployed yet (in Docker image 0.28.4-persistence-fix-complete)

**Conflict Resolution**:
- Deploy current fix first (SQL INSERT)
- After official library deployed: Test and potentially migrate
- Keep SQL INSERT if library has same bug

**Priority**: CRITICAL - Project creation is core functionality

---

### Component 3: problem_ops.py

**File**: repos/metabob-rpc-api/server/db/operations/problem_ops.py  

**Affected By Specs**:
1. metabob-cli-to-dashboard-complete-data-flow (SQL INSERT fix at lines 78, 103, 116)
2. surrealdb-official-library-integration (would use db.create/db.insert)

**Current State**:
- Fixed with SQL INSERT (commit d5420bf)
- NOT deployed yet (in Docker image 0.28.4-persistence-fix-complete)

**Conflict Resolution**:
- Same as project_ops.py
- Deploy fix, then evaluate library migration

**Priority**: CRITICAL - Problem creation is core functionality

---

### Component 4: Other *_ops.py Files

**Files**:
- organization_ops.py (1 db.create instance)
- api_key_ops.py (1 db.create instance)
- user_ops.py (2 db.create instances)
- activity_execution.py (1 db.create instance)
- impulse_learning.py (2 db.create instances)
- task_execution.py (1 db.create instance)
- template_data.py (1 db.create instance)

**Affected By Specs**:
- metabob-cli-to-dashboard-complete-data-flow (out of scope but same bug)
- surrealdb-official-library-integration (all would use official library)

**Recommendation**:
- Fix critical files first (project_ops, problem_ops) - IN PROGRESS
- Fix remaining files after official library decision
- Platform-wide consistency required

**Priority**: MEDIUM to HIGH depending on file usage

---

## Cross-Reference with Code Property Graph

### Related Changes Analysis

Based on specification requirements, the following files are interconnected:

**Database Layer**:
- surrealdb_client.py (core client)
- operations/*.py (all database operations)

**API Layer**:
- routes/projects.py (project CRUD)
- routes/cloud_auth.py (authentication - already working)
- routes/problems.py (problem CRUD - needs verification)

**Potential Ripple Effects**:
1. Changing surrealdb_client.py affects all operations files
2. Changing operation patterns affects all API routes
3. Library migration affects entire persistence layer

### Change Impact Summary

**IF** official library is deployed:
- ✅ May fix HTTP client persistence bug
- ⚠️ May require reverting SQL INSERT workarounds
- ⚠️ Requires regression testing of all CRUD operations
- ⚠️ May affect 20+ files across operations layer

**IF** SQL INSERT pattern is kept:
- ✅ Proven to work (authentication deployed successfully)
- ✅ Explicit and reliable
- ⚠️ More verbose than native methods
- ⚠️ Requires updating ~12 more files for consistency

---

## Deployment Dependencies

### Dependency Chain

```
1. metabob-cli-to-dashboard-complete-data-flow
   → Requires: Docker image deployed
   → Blocks: Dashboard data visibility
   → Status: Ready (image built)

2. surrealdb-official-library-integration (Phase 1)
   → Requires: pip install surrealdb
   → Blocks: Official library usage
   → Status: Code complete, deployment pending

3. surrealdb-official-library-integration (Phase 3)
   → Requires: SurrealDB v3.0+ deployment
   → Blocks: Full library compatibility
   → Status: Not started

4. Problem endpoint creation
   → Requires: Route definition and implementation
   → Blocks: Problem persistence testing
   → Status: Needs investigation
```

### Safe Deployment Order

**Phase 1: Deploy Immediate Fixes**
1. Deploy metabob-cli-to-dashboard-complete-data-flow (0.28.4-persistence-fix-complete)
2. Validate project and problem persistence
3. Document problem endpoint path issue

**Phase 2: Complete Official Library Integration**
4. Complete surrealdb-official-library-integration Phase 1 (pip install)
5. Test persistence with official library
6. Compare with SQL INSERT pattern

**Phase 3: Decide on Long-Term Pattern**
7. If official library works: Migrate SQL INSERT → native methods
8. If official library fails: Keep SQL INSERT pattern
9. Update remaining 9 files consistently

**Phase 4: SurrealDB v3.0 Upgrade (if needed)**
10. Upgrade SurrealDB deployment to v3.0+
11. Re-test all persistence operations
12. Final validation of complete stack

---

## Conflict Resolution Matrix

| Conflict | Severity | Resolution | Owner | Status |
|----------|----------|------------|-------|--------|
| SQL INSERT vs Official Library | MEDIUM | Wait for library deployment, test, decide | DevOps | PENDING |
| Problem endpoint 405 | HIGH | Investigate routes, fix path | Backend | NEEDS_ACTION |
| Timestamp format | LOW | No conflict - additive | Backend | RESOLVED |
| db.create in other files | MEDIUM | Fix after library decision | Backend | DEFERRED |

---

## Recommendations

### Immediate Actions (This Week)

1. **Deploy metabob-cli-to-dashboard-complete-data-flow**
   - Image: 0.28.4-persistence-fix-complete
   - Blocker: Docker registry access
   - Priority: P0 - Critical

2. **Investigate Problem Endpoint**
   - Search repos/metabob-rpc-api/server/routes/ for problem routes
   - Document correct API path
   - Update validation harness
   - Priority: P0 - Blocking validation

3. **Complete surrealdb-official-library-integration Phase 1**
   - Run: pip install -r requirements.txt in deployment
   - Verify official library works
   - Priority: P1 - Enables testing

### Short-Term Actions (Next 2 Weeks)

4. **Test Official Library Persistence**
   - Create test project with official library
   - Check if db.create() persists
   - Document findings
   - Priority: P1 - Informs decision

5. **Decide on Long-Term Pattern**
   - If official library works: Plan SQL INSERT → native migration
   - If official library fails: Plan platform-wide SQL INSERT adoption
   - Document architectural decision
   - Priority: P1 - Strategic

### Long-Term Actions (Next Month)

6. **SurrealDB v3.0 Upgrade**
   - Plan deployment
   - Test compatibility
   - Execute upgrade
   - Priority: P2 - Improvement

7. **Platform-Wide Consistency**
   - Fix remaining 9 db.create instances
   - Consistent pattern across all files
   - Priority: P2 - Technical debt

---

## Summary

**Conflicts Found**: 2 (1 medium, 1 high)

**Conflict 1**: SQL INSERT workaround vs official library migration
- **Impact**: May need to revert workarounds if library fixes bug
- **Resolution**: Test official library first, then decide
- **Risk**: MEDIUM - May require code changes

**Conflict 2**: Problem endpoint path discrepancy
- **Impact**: Blocks problem persistence validation
- **Resolution**: Investigate and fix endpoint
- **Risk**: HIGH - Blocks E2E testing

**Non-Conflicts**: Temporal tracking (additive, no breaking changes)

**Shared Components**: 4 critical (surrealdb_client.py, project_ops.py, problem_ops.py, routes)

**Deployment Strategy**: Phased approach - deploy fixes first, then evaluate library migration

---

**Conflict Analysis Complete - Ready for Resolution Planning**
