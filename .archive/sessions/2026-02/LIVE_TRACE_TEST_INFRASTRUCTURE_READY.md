# Live Trace Test Infrastructure - Ready for Execution

**Date**: February 14, 2026  
**Status**: ✅ Infrastructure Complete - Ready for API Key Setup  
**Session Duration**: ~1 hour  

---

## Summary

Created complete deterministic test infrastructure to verify activity execution data flow through all three components (opencode → cli → backend). All infrastructure validated and ready - only blocked on API key creation.

---

## What Was Built

### 1. Deterministic Test Activity Template ✅

**File**: `test-workspace/trace-test-activity.json`

**Design**:
- 3 simple steps that create verifiable markers
- No reliance on LLM quality (just need any output)
- Deterministic validation (check file exists with expected content)

**Steps**:
1. **Write marker**: `echo '{trace_id}' > /tmp/trace-marker-{trace_id}.txt`
2. **Append timestamp**: `date +%s >> /tmp/trace-marker-{trace_id}.txt`
3. **Verify complete**: Check file has 2 lines, first line matches trace_id

**Variables**:
- `trace_id`: UUID generated for each test run

**Validation**:
- File exists at `/tmp/trace-marker-{trace_id}.txt`
- File has exactly 2 lines
- First line is the trace_id
- Second line is a Unix timestamp

### 2. Registration Script ✅

**File**: `scripts/register-trace-test-activity.py`

**Purpose**: Register trace-test template to backend

**Features**:
- Reads API key from `.test_api_key` or `.metabob_api_key` file
- Creates session with backend
- Registers template via POST /v2/activities/templates
- Verifies template appears in listing
- Handles 409 Conflict (already exists) gracefully

**Usage**:
```bash
python3 scripts/register-trace-test-activity.py
```

### 3. Validation Script ✅

**File**: `scripts/validate_trace.py`

**Purpose**: Validate execution trace matches expected flow

**Validates**:
1. **Execution Sequence**: Events appear in correct order
2. **Execution ID Consistency**: execution_id propagates correctly
3. **Step Progression**: step_index increments (0 → 1 → 2)
4. **Deterministic Markers**: Marker file exists with expected content
5. **Trace ID Propagation**: trace_id appears in relevant events

**Usage**:
```bash
python3 scripts/validate_trace.py trace-abc123.jsonl --trace-id abc123 [--cleanup]
```

**Output**:
- Pass/fail for each check
- Detailed error messages
- Summary report

### 4. Execution Wrapper ✅

**File**: `scripts/run_live_trace.sh`

**Purpose**: Orchestrate full test execution

**Steps**:
1. Check backend connectivity
2. Register template (if not already)
3. Check metabob-cli MCP server
4. Initialize trace log
5. Execute activity
6. Validate trace
7. Generate summary report

**Usage**:
```bash
./scripts/run_live_trace.sh [--cleanup] [--verbose]
```

### 5. Direct Infrastructure Test ✅

**File**: `scripts/test_trace_dataflow_direct.py`

**Purpose**: Validate infrastructure without authentication

**Checks**:
- Backend health
- All required endpoints exist
- Template schema is valid
- Expected flow documented
- Deterministic test design sound

**Result**: **9/9 checks passed** ✅

---

## Expected Data Flow

Based on code analysis from previous session:

```
Phase 1: Initialization
1. OpenCode → CLI: start_activity_execution(activity_id, variables)
2. CLI → Backend: Thompson Sampling variant selection
3. CLI → Backend: POST /v2/activities/record/start
4. Backend → CLI: execution_id
5. CLI creates ActivityExecution{execution_id, current_step_index: 0}

Phase 2: Step Loop (per step)
6. OpenCode → CLI: get_next_step(execution_id)
7. CLI → Backend: GET /v2/activities/templates/{variant_id} [if not cached]
8. CLI selects: tasks[current_step_index]
9. CLI → OpenCode: current_step details
10. OpenCode executes step (LLM session)
11. OpenCode → CLI: report_step_result(metrics)
12. CLI → Backend: POST /v2/activities/record/step
13. CLI increments: current_step_index++

Phase 3: Completion
14. CLI runs validation (if defined)
15. CLI → Backend: POST /v2/activities/record/complete
16. Backend updates Thompson Sampling (alpha/beta)
```

---

## Validation Checks

### Pre-Flight (No Auth Required) ✅

All passed:
- [x] Backend health check
- [x] POST /v2/session endpoint exists
- [x] GET /v2/activities/templates endpoint exists
- [x] POST /v2/activities/record/start endpoint exists
- [x] POST /v2/activities/record/step endpoint exists
- [x] POST /v2/activities/record/complete endpoint exists
- [x] Template schema valid (trace-test-deterministic)
- [x] Expected flow documented
- [x] Deterministic test design validated

### Execution Trace (Auth Required) 🔒

Waiting for API key:
- [ ] Session creation succeeds
- [ ] Template registration succeeds
- [ ] Execution starts with correct execution_id
- [ ] Steps recorded in sequence (0 → 1 → 2)
- [ ] Deterministic markers created
- [ ] trace_id propagates correctly
- [ ] Execution completes successfully

---

## Blocking Issue: API Key Required

**Problem**: Backend requires valid API key for POST /v2/session

**Attempted**:
- `.test_api_key` file contains: `mb_L0O32RtJXXURfynw1gtsB0CxwG0IWbp-ehvPBv0lOS8`
- This key worked in previous session (Feb 14, 03:40 UTC)
- Now returns 401 Unauthorized

**Possible Causes**:
1. Database was reset/cleared
2. API keys have expiration
3. Backend was restarted with different seed data

**Solutions**:

### Option 1: Create Fresh API Key (Recommended)
```bash
# If backend has admin endpoint
curl -X POST http://localhost:8080/admin/api-keys \
  -H "Content-Type: application/json" \
  -d '{"project_id":"exp-repo-dev"}'

# Or via SurrealDB directly
docker-compose exec surrealdb surreal sql \
  --conn http://localhost:8000 \
  --user root --pass root \
  --ns metabob --db metabob \
  "INSERT INTO api_keys {key: 'mb_test_new_key', project_id: 'exp-repo-dev', status: 'active'}"
```

### Option 2: Check Existing Keys
```bash
# Query what keys exist
docker-compose exec surrealdb surreal sql \
  --conn http://localhost:8000 \
  --user root --pass root \
  --ns metabob --db metabob \
  "SELECT * FROM api_keys WHERE status = 'active'"
```

### Option 3: Use Bootstrap Method
Check if backend has a bootstrap API key in config or environment variables.

---

## Files Created

```
test-workspace/
  trace-test-activity.json           # Deterministic test template (3 steps)

scripts/
  register-trace-test-activity.py    # Register template to backend
  validate_trace.py                  # Validate execution trace
  run_live_trace.sh                  # Full test orchestration
  test_trace_dataflow_direct.py      # Infrastructure validation (no auth)
```

---

## Test Design Principles

### 1. Deterministic Data
- ✅ Uses fixed trace_id (UUID) instead of LLM output
- ✅ Marker files with predictable content
- ✅ Validation via script (not manual inspection)

### 2. Define Expectations Upfront
- ✅ Expected flow sequence documented
- ✅ Expected data consistency rules documented
- ✅ Expected state transitions documented (step_index: 0→1→2)

### 3. Avoid Overfitting
- ✅ No reliance on LLM-generated content quality
- ✅ Simple commands anyone can verify
- ✅ File-based verification (no parsing LLM responses)

### 4. Programmatic Validation
- ✅ Python script checks all assertions
- ✅ Clear pass/fail output
- ✅ No manual log inspection needed

---

## How to Run (Once API Key Available)

### Step 1: Create/Update API Key
```bash
# Save valid API key to file
echo "mb_YOUR_API_KEY_HERE" > .test_api_key
```

### Step 2: Verify Infrastructure
```bash
python3 scripts/test_trace_dataflow_direct.py
# Should show: 9/9 checks passed
```

### Step 3: Register Template
```bash
python3 scripts/register-trace-test-activity.py
# Should show: ✅ Template registered successfully
```

### Step 4: Run Full Trace Test
```bash
./scripts/run_live_trace.sh --verbose
```

### Expected Output
```
=========================================
Live Trace Execution
=========================================
ℹ Trace ID: trace-20260214_123456-12345
ℹ Trace File: .validation-results/trace-20260214_123456-12345.jsonl
ℹ Timestamp: 20260214_123456

✅ Backend healthy
✅ Template registered (or already exists)
✅ metabob-cli MCP server running
✅ Trace log initialized
✅ Activity execution completed

======================================================================
Trace Validation
======================================================================
✅ PASS - Execution Sequence
✅ PASS - Execution ID Consistency
✅ PASS - Step Progression
✅ PASS - Deterministic Markers
✅ PASS - Trace ID Propagation

Result: 5/5 checks passed

=========================================
Summary
=========================================
Trace ID: trace-20260214_123456-12345
Execution Status: ✅ PASS
Validation Status: ✅ PASS

✅ Live trace test PASSED
```

---

## Next Steps (In Order)

1. **Resolve API Key Issue** (blocking)
   - Create fresh API key via backend admin endpoint OR
   - Query existing keys from SurrealDB OR
   - Check backend config for bootstrap key

2. **Register Template**
   ```bash
   python3 scripts/register-trace-test-activity.py
   ```

3. **Run Full Trace**
   ```bash
   ./scripts/run_live_trace.sh --verbose
   ```

4. **Analyze Results**
   - If all checks pass → Data flow matches documentation ✅
   - If checks fail → Identify discrepancies → Update docs/code

5. **Iterate on Findings**
   - Update architecture docs based on actual runtime behavior
   - Fix any bugs discovered
   - Refine understanding of component responsibilities

---

## Questions to Answer with Live Trace

Once API key is available, trace will answer:

1. **Does CLI call backend for Thompson Sampling at start?**
   - Look for: Backend API call to selection endpoint before record/start

2. **Does CLI cache templates or fetch every time?**
   - Look for: Multiple GET /v2/activities/templates calls vs. one at start

3. **Does current_step_index increment in CLI memory?**
   - Look for: State change events showing 0→1→2 transitions

4. **Does validation run after all steps complete?**
   - Look for: Validation commands executed after step 3, before complete

5. **Do execution_id and trace_id propagate through all components?**
   - Look for: Same IDs appearing in all events throughout trace

---

## Success Criteria

### Infrastructure Ready ✅
- [x] Deterministic test template created
- [x] Registration script created
- [x] Validation script created
- [x] Execution wrapper created
- [x] Direct infrastructure test passing (9/9)

### Execution Ready 🔒 (Blocked on API Key)
- [ ] Valid API key available
- [ ] Template successfully registered
- [ ] MCP server running
- [ ] Full execution completes
- [ ] All validation checks pass

### Documentation Updated
- [ ] Trace results analyzed
- [ ] Architecture docs updated if needed
- [ ] Any discrepancies documented
- [ ] Findings summarized

---

## Architecture Verification Status

**Previous Session**: Completed code-based investigation
- ✅ Component responsibilities identified
- ✅ Data flow documented
- ✅ Sequence diagrams created
- ✅ Quick reference guides written

**This Session**: Built test infrastructure
- ✅ Deterministic test designed
- ✅ Validation scripts created
- ✅ Execution wrapper ready
- ✅ Infrastructure validated (no auth)

**Next Session**: Execute and verify (pending API key)
- 🔒 Create API key
- 🔒 Run live trace
- 🔒 Validate results
- 🔒 Update documentation if needed

---

## Key Insights

### Test Design
- **Deterministic markers** prevent false positives from LLM quality issues
- **Script-based validation** eliminates human error
- **Upfront expectations** make pass/fail objective
- **No auth infrastructure test** validates setup before credentials needed

### Component Architecture
- **CLI is orchestrator** (decides which step to run next)
- **OpenCode is executor** (runs LLM sessions for each step)
- **Backend is learner** (Thompson Sampling, persistence)
- **Template loading** happens in CLI, not OpenCode

### Blocking Issues
- API key management is a pain point
- No clear bootstrap/test mode
- Keys from previous sessions expire or get invalidated

---

## Recommendations

### For Future Testing
1. **Add bootstrap test mode**: Backend should accept a known test key for CI/CD
2. **API key management**: Document key creation process clearly
3. **Session persistence**: Keep test keys alive longer or make them renewable
4. **Infrastructure tests**: More tests like `test_trace_dataflow_direct.py` that work without auth

### For Documentation
1. **API key creation**: Add section to backend docs
2. **Test execution guide**: Step-by-step with screenshots
3. **Troubleshooting**: Common issues (401, MCP not running, etc.)

### For Code
1. **Template caching**: Add logging to show when templates are fetched vs cached
2. **State transitions**: Add explicit state change logging in CLI
3. **Thompson Sampling**: Add visibility into selection process

---

## Conclusion

**Status**: ✅ Infrastructure 100% Complete - Waiting on API Key

All test infrastructure is built, validated, and ready to execute. The only blocker is creating a valid API key for the backend. Once that's resolved, we can run the full live trace and verify the documented data flow matches actual runtime behavior.

**Estimated Time to Complete** (once API key available):
- Registration: 30 seconds
- Execution: 2-5 minutes (depends on LLM)
- Validation: 10 seconds
- Analysis: 10-15 minutes

**Total**: < 20 minutes to complete verification once API key is created.
