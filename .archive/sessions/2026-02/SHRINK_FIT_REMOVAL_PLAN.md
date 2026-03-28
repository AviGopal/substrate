# Shrink-Fit Removal Plan

**Date**: February 12, 2026  
**Status**: Ready for Execution  
**Method**: Observed execution tracing → Identified unused paths → Targeted removal

---

## Executive Summary

We traced activity execution end-to-end and identified **unused/alternative code paths** that can be safely removed to shrink-fit the implementation.

### Trace Results
- **Trace Duration**: 98.82ms
- **Events Logged**: 13
- **Backend Calls**: 1 (GET /v2/activities/templates/{id})
- **Unused Endpoints**: 2 (POST /record/start, POST /record/step)

---

## Active Code Paths (KEEP)

These paths were observed in the execution trace and are **actively used**:

### Client (metabob-cli)
```
1. activity_manager.py::start_execution()
   └─ Creates ActivityExecution in-memory
   └─ Duration: 0.16ms

2. activity_manager.py::get_next_step()
   └─ GET /v2/activities/templates/{id} (first call only, then cached)
   └─ Duration: 82.29ms
   
3. activity_manager.py::report_step_result()
   └─ Stores StepResult in-memory
   └─ Duration: 15.92ms
   
4. activity_manager.py::_check_completion()
   └─ Validates execution state
   └─ Duration: 0.01ms
   
5. activity_manager.py::_record_outcome()  
   └─ POST /v2/activities/record/complete (on validation success)
   └─ Duration: TBD (async, not visible in trace)
```

### Backend (metabob-rpc-api)
```
1. GET /v2/activities/templates/{id}
   └─ routes/v2_activities.py::get_template()
   └─ actions/activity_variants.py::get_variant()
   └─ SurrealDB query: activity_variants table

2. POST /v2/activities/record/complete
   └─ routes/v2_activities.py::record_execution_complete()
   └─ actions/activities.py::record_execution()
   └─ SurrealDB insert: activity_executions table
```

---

## Inactive Code Paths (REMOVE)

These paths exist but were **never called** during execution:

### 1. POST /record/start ❌ REMOVE

**Location**: 
- Backend: `repos/metabob-rpc-api/server/routes/v2_activities.py::record_execution_start()`
- Client: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` (lines 522-541, COMMENTED OUT)

**Status**: **Disabled due to backend bug**

**Evidence**:
```python
# CLI code (activity_manager.py:522-541):
# DISABLED: Backend /record/start endpoint has bug that creates templates instead of recording
# TODO: Re-enable once backend is fixed to only record executions, not create templates
# try:
#     client = await self._get_client()
#     await client.post(
#         "/v2/activities/record/start",
#         json={
#             "template_id": activity_id,
#             "variables": variables or {},
#             "session_id": session_id,
#             "execution_id": execution_id,
#         },
#     )
#     logger.info(f"Recorded execution start via v2 API: {execution_id}")
# except Exception as e:
#     logger.debug(f"Failed to record execution start: {e}")
logger.info(
    f"Backend recording DISABLED (backend bug - creates templates instead of recording)"
)
```

**Backend Bug (commit 97e700d)**:
```
fix: disable backend /record/start call that creates templates

The /record/start endpoint was incorrectly creating new activity templates
instead of just recording execution start. Disabled until backend is fixed.
```

**Removal Plan**:
1. **Option A**: Remove endpoint entirely (if never fixing bug)
2. **Option B**: Fix backend bug, then re-enable (if need start recording)

**Decision**: **Remove endpoint entirely** (Option A)

**Reasoning**:
- We have bulk recording via `/record/complete` which works
- Start recording provides minimal value (can calculate from first step timestamp)
- Fixing the bug adds complexity without clear benefit
- Simpler system with one recording endpoint

**Files to Change**:
```
repos/metabob-rpc-api/server/routes/v2_activities.py
  - Remove: record_execution_start() function
  - Remove: POST /record/start route

repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py
  - Remove: Commented-out /record/start code (lines 522-541)
  - Remove: DISABLED log message
```

### 2. POST /record/step ❌ REMOVE

**Location**:
- Backend: `repos/metabob-rpc-api/server/routes/v2_activities.py::record_execution_step()`
- Client: Never called (uses in-memory storage)

**Status**: **Endpoint exists but never used**

**Evidence**:
```
Client trace shows:
  • report_step_result() stores results in-memory (ActivityExecution.step_results list)
  • No HTTP POST to /record/step
  • Bulk recording happens at end via /record/complete
```

**Alternative**: Real-time step recording

**Current Flow** (in-memory):
```
report_step_result() 
  └─ execution.step_results.append(StepResult(...))  # In-memory
  └─ (No backend call)

_record_outcome()
  └─ POST /record/complete with all step_results  # Bulk
```

**Alternative Flow** (real-time):
```
report_step_result()
  └─ POST /record/step  # Per-step backend call
  
_record_outcome()
  └─ POST /record/complete  # Just final status
```

**Decision**: **Keep in-memory bulk recording, remove /record/step endpoint**

**Reasoning**:
- Bulk recording is simpler (1 HTTP call vs N calls)
- Faster (no network latency per step)
- Step results are already available in /record/complete payload
- Real-time recording would require schema changes (execution_steps table)

**Files to Change**:
```
repos/metabob-rpc-api/server/routes/v2_activities.py
  - Remove: record_execution_step() function
  - Remove: POST /record/step route
```

### 3. Old Activity Routes ⚠️ AUDIT NEEDED

**Location**:
- `repos/metabob-rpc-api/server/routes/activities.py` (V1 routes?)
- `repos/metabob-rpc-api/server/routes/proto_activities.py` (Proto-based routes?)

**Status**: Unknown if used

**Audit Required**:
```bash
# Check if V1 routes are imported
rg "from.*routes.activities import\|import routes.activities" repos/metabob-rpc-api

# Check if proto routes are used
rg "from.*routes.proto_activities import\|import routes.proto_activities" repos/metabob-rpc-api

# Check which routes are registered
rg "app.include_router.*activities" repos/metabob-rpc-api
```

**Decision**: **Audit first, then remove if unused**

### 4. OpenCode Activity Tool ⚠️ AUDIT NEEDED

**Location**:
- `repos/metabob-opencode/packages/opencode/src/tools/activity/` (if exists)

**Status**: Not assessed

**Questions**:
- Does OpenCode have its own activity execution logic?
- Is it duplicate of metabob-cli activity_manager.py?
- Or does it delegate to metabob-cli via MCP?

**Audit Required**:
```bash
# Find OpenCode activity tool implementation
find repos/metabob-opencode -name "*activity*" -type f

# Check if it calls metabob-cli MCP or duplicates logic
rg "activity.*mcp\|activityManager" repos/metabob-opencode
```

**Decision**: **Audit first, determine if duplicate or complementary**

### 5. Devbob Container Agents ⚠️ CONDITIONAL REMOVAL

**Location**:
- `docker-compose.yaml`: devbob-opencode, devbob-rpc-api, devbob-dashboard, devbob-cli

**Status**: Not running in our tests

**Current Architecture**:
```
Host Execution (what we're using):
  OpenCode (host) → metabob-cli MCP (host) → Backend (container)

Container Execution (defined but unused):
  Host → ACP → devbob-opencode (container)
            └─> OpenCode → metabob-cli → Backend
```

**Evidence**:
- `docker ps` shows devbob-opencode exited (config error)
- All our testing uses host-based execution
- Containers not started in normal workflow

**Decision**: **Keep containers but document they're for multi-agent workflows**

**Reasoning**:
- Containers enable isolated agent execution
- Useful for parallel multi-agent coordination
- Not needed for single-agent activity execution
- Keep for future multi-agent use cases

**Action**: Document when to use containers vs host execution

---

## Execution Flow Simplification

### Before Shrink-Fit (3 recording endpoints)
```
start_execution()
  ├─> [DISABLED] POST /record/start
  └─> Create ActivityExecution in-memory

get_next_step()
  └─> GET /templates/{id} (cached)

report_step_result()
  ├─> Store in-memory
  └─> [UNUSED] POST /record/step

_check_completion()
  └─> POST /record/complete (bulk)
```

### After Shrink-Fit (1 recording endpoint)
```
start_execution()
  └─> Create ActivityExecution in-memory

get_next_step()
  └─> GET /templates/{id} (cached)

report_step_result()
  └─> Store in-memory

_check_completion()
  └─> POST /record/complete (bulk)
```

**Simplification**: Removed 2 unused recording endpoints, single canonical recording path

---

## Removal Checklist

### Phase 1: Safe Removals (No Risk)

- [ ] **Remove /record/start endpoint** (backend)
  - File: `repos/metabob-rpc-api/server/routes/v2_activities.py`
  - Function: `record_execution_start()`
  - Route: `@router.post("/record/start")`
  - Lines: ~200-250 (estimate)

- [ ] **Remove /record/start commented code** (client)
  - File: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`
  - Lines: 522-541
  - Remove commented-out code and DISABLED log message

- [ ] **Remove /record/step endpoint** (backend)
  - File: `repos/metabob-rpc-api/server/routes/v2_activities.py`
  - Function: `record_execution_step()`
  - Route: `@router.post("/record/step")`
  - Lines: ~250-300 (estimate)

### Phase 2: Audits Required

- [ ] **Audit V1 activity routes**
  - File: `repos/metabob-rpc-api/server/routes/activities.py`
  - Check if imported/used
  - Remove if unused

- [ ] **Audit proto activity routes**
  - File: `repos/metabob-rpc-api/server/routes/proto_activities.py`
  - Check relationship with v2_activities.py
  - Consolidate if duplicate

- [ ] **Audit OpenCode activity tool**
  - Directory: `repos/metabob-opencode/packages/opencode/src/tools/activity/`
  - Check if duplicate of metabob-cli
  - Remove or consolidate

### Phase 3: Documentation

- [ ] **Document single recording path**
  - Update: `REPO_ALIGNMENT_ASSESSMENT.md`
  - Note: Only `/record/complete` is used

- [ ] **Document container usage**
  - Update: `docker-compose.yaml` comments
  - Clarify: Containers for multi-agent, host for single-agent

- [ ] **Update execution flow docs**
  - Update: `ACTIVITY_EXECUTION_GUIDE.md`
  - Remove references to /record/start and /record/step

---

## Testing After Removal

### Test 1: Basic Execution Still Works
```bash
python3 trace_activity_execution.py 2>/dev/null > test_trace.jsonl
python3 analyze_execution_trace.py
# Verify: execution_completed event present
```

### Test 2: Recording Endpoint Still Works
```bash
# Check backend logs for /record/complete call
docker logs api-server-dev --tail 100 | grep "record/complete"
# Should show POST /v2/activities/record/complete
```

### Test 3: No 404 Errors
```bash
# Verify removed endpoints don't cause errors
docker logs api-server-dev --tail 500 | grep "404\|record/start\|record/step"
# Should be empty
```

### Test 4: Template Creation Still Works
```bash
curl -X POST http://localhost:8080/v2/activities/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{...}'
# Should still work (template creation unrelated to recording)
```

---

## Rollback Plan

If removal causes issues:

1. **Revert commits**:
   ```bash
   cd repos/metabob-rpc-api
   git revert HEAD
   
   cd repos/metabob-cli
   git revert HEAD
   ```

2. **Rebuild backend**:
   ```bash
   ./devbob rebuild api-server-dev
   ```

3. **Verify restoration**:
   ```bash
   curl http://localhost:8080/v2/activities/record/start
   # Should return method info, not 404
   ```

---

## Expected Outcomes

### Lines of Code Removed
- Backend: ~150 lines (2 endpoint functions)
- Client: ~25 lines (commented code)
- Total: ~175 lines

### Endpoints Reduced
- Before: 4 activity recording endpoints
- After: 1 activity recording endpoint
- Reduction: 75%

### Complexity Reduced
- Before: 3 recording paths (start, step, complete)
- After: 1 recording path (complete only)
- Cognitive load: Significantly reduced

### Clarity Improved
- Single canonical recording path
- No confusion about which endpoint to use
- No disabled/commented code
- Clean execution flow

---

## Success Metrics

- [ ] All tests pass after removal
- [ ] Activity execution still works end-to-end
- [ ] No 404 errors in logs
- [ ] Execution trace identical (except removed calls)
- [ ] Documentation updated
- [ ] Code review approved

---

## Next Steps

1. **Execute Phase 1 removals** (safe, no risk)
2. **Run test suite** (verify no regressions)
3. **Execute Phase 2 audits** (determine what else to remove)
4. **Update documentation** (reflect single recording path)
5. **Commit and tag** (shrink-fit-v1)

---

**Status**: Ready for execution  
**Risk Level**: Low (removing unused code only)  
**Estimated Time**: 2 hours (removal + testing)
