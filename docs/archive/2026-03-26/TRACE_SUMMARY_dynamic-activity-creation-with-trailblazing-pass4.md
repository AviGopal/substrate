# Trace Summary: dynamic-activity-creation-with-trailblazing-pass4

**Analysis Date**: 2026-03-04  
**Pass Number**: 4  
**Previous Status**: Pass 3 - 90% validation (9/10 tests), code complete locally  
**Current Goal**: Fix remaining issues to achieve 100% validation in K8s devbob environment

---

## Executive Summary

Pass 4 completes the dynamic activity creation with trailblazing implementation by addressing 3 critical gaps from Pass 3:

1. **CLI Argument Parsing Error** (CRITICAL) - Blocks all activity execution in K8s
2. **Filesystem Dependency** (HIGH) - Violates environment-agnostic constraint
3. **K8s Deployment Gap** (CRITICAL) - Pass 3 fixes exist locally but not deployed

**Current Status**: 9/10 tests passing locally, 0/10 in K8s (blocked by CLI error)  
**Target Status**: 10/10 tests passing in both host and K8s environments

---

## Critical Blockers

### 1. CLI Argument Parsing Error (CRITICAL)

**Evidence**: 
```
ERROR 2026-03-03T13:28:11 +236ms service=default message=Unknown arguments: variables, reason, create-activity
```

**Impact**: Prevents ALL activity execution in K8s devbob pod

**Root Cause**: CLI parser in `repos/metabob-opencode/packages/opencode/src/cli/cmd/activity.ts` doesn't recognize:
```bash
opencode activity create-activity --variables {...} --reason "..."
```

**Fix**: Update CLI parser to accept template-id as positional argument

**Verification**: Run command locally without "Unknown arguments" error

---

### 2. Filesystem Dependency (HIGH)

**Evidence**:
- `templates/bootstrap/debug-activity-self-contained.json:56` - `required_files: ["/tmp/debug-{{activityId}}/DIAGNOSIS.md"]`
- `templates/bootstrap/evolve-activity-self-contained.json:77` - `required_files: ["/tmp/evolve-{{templateId}}/ANALYSIS.md"]`

**Impact**: Violates environment-agnostic constraint; templates fail in restricted filesystem environments

**Root Cause**: Templates validate file creation instead of returning markdown in prompt output

**Fix**: 
- Remove `required_files` from all task validations
- Update prompts to return markdown directly
- Keep `activity_error_inspector` tool usage (MCP abstraction)

**Verification**: Execute templates and confirm no `/tmp` writes

---

### 3. K8s Deployment Gap (CRITICAL)

**Evidence**: Pass 3 fixes exist in local codebase but devbob pod runs old version

**Impact**: Cannot validate fixes in target environment; blocks end-to-end testing

**Root Cause**: Docker image not rebuilt with Pass 3 fixes, deployment not executed

**Fix**:
1. Build Docker image with CLI fix + Pass 3 fixes
2. Deploy to K8s devbob namespace via helm/helmfile
3. Verify pod health and version

**Verification**: `kubectl exec -n metabob <pod> -- opencode activity create-activity --help` shows usage

---

## Component Analysis

### ✅ COMPLETE Components (Pass 3 Achievements)

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| isMetaTemplate() | activity-template.ts | 1852-1860 | ✅ Includes 'create-activity' |
| Auto-Trailblazing | tool/activity.ts | 976-991 | ✅ Implemented |
| Context Injection | tool/activity.ts | 993-1050 | ✅ Implemented |
| MCP Timeout | - | - | ✅ 15s timeout |
| Lifecycle Hooks | - | - | ✅ All registered |
| Bootstrap Templates | templates/bootstrap/ | - | ✅ Files exist |

### ❌ BROKEN Components (Pass 4 Fixes Required)

| Component | File | Issue | Priority |
|-----------|------|-------|----------|
| CLI Parser | cli/cmd/activity.ts | Unknown arguments error | CRITICAL |
| debug-activity | templates/bootstrap/ | Filesystem writes | HIGH |
| evolve-activity | templates/bootstrap/ | Filesystem writes | HIGH |
| K8s Deployment | devbob pod | Old code version | CRITICAL |

### ⚠️ INCOMPLETE Components (Future Work)

| Component | File | Status | Priority |
|-----------|------|--------|----------|
| searchSimilarActivities | template-service-client.ts | Returns empty array | LOW |
| Backend API | metabob-cli RPC | Endpoint not implemented | LOW |

---

## Data Flow

```
User: opencode activity create-activity --variables {...} --reason "..."
  ↓
CLI Parser (activity.ts)
  ↓ [❌ BLOCKS HERE: "Unknown arguments"]
Activity Tool (tool/activity.ts)
  ↓
isMetaTemplate('create-activity') → true [✅ WORKS]
  ↓
Auto-enable trailblazing [✅ WORKS]
  ↓
searchSimilarActivities() → [] [⚠️ Empty but non-blocking]
  ↓
Create impulse 'similar-activities-{id}' [✅ WORKS]
  ↓
Execute with trailblazing [❌ NOT REACHED]
  ↓
Generate tasks turn-by-turn [❌ NOT REACHED]
  ↓
POST to backend → SurrealDB [❌ NOT REACHED]
  ↓
Observable logs [❌ NOT REACHED]
```

**Current Blocker**: Step 1 - CLI parsing error prevents flow from proceeding

---

## Validation Test Results

| # | Test Case | Expected | Actual | Status | Gap |
|---|-----------|----------|--------|--------|-----|
| 1 | CLI syntax | Executes successfully | Unknown arguments error | ❌ FAIL | CLI parser |
| 2 | Meta-template detection | Logs show auto-enable | Not reached | 🚫 BLOCKED | CLI error |
| 3 | Context injection | searchSimilarActivities called | Not reached | 🚫 BLOCKED | CLI error |
| 4 | Trailblazing execution | Tasks generated | Not reached | 🚫 BLOCKED | CLI error |
| 5 | Database tracking | SurrealDB record exists | No record | 🚫 BLOCKED | CLI error |
| 6 | Bootstrap templates | Files exist and valid | Files exist ✓ | ✅ PASS | None |
| 7 | No filesystem | No /tmp writes | debug/evolve write files | ❌ FAIL | Template validation |
| 8 | K8s deployment | Latest code deployed | Old code | ❌ FAIL | Deployment gap |
| 9 | ACP delegation | Executes successfully | CLI error | 🚫 BLOCKED | CLI + deployment |
| 10 | Observable proof | Logs show events | Partial (hooks only) | ⚠️ PARTIAL | CLI blocks execution |

**Current Score**: 1/10 passing (Case 6 only)  
**Target Score**: 10/10 passing

---

## Action Items (Ordered by Priority)

### CRITICAL (Blocking)

1. **Fix CLI Argument Parsing** (30-60 min)
   - Update `repos/metabob-opencode/packages/opencode/src/cli/cmd/activity.ts`
   - Accept template-id as positional argument with --variables and --reason flags
   - Verify: `opencode activity create-activity --variables {...} --reason "test"` executes

2. **Build Docker Image** (15 min) - *After CLI fix*
   - Include CLI fix + Pass 3 fixes (isMetaTemplate, timeout)
   - Tag with Pass 4 identifier
   - Verify: `docker run <image> opencode activity create-activity --help` works

3. **Deploy to K8s** (30 min) - *After Docker build*
   - Update helm values with new image tag
   - Deploy to devbob namespace
   - Verify: `kubectl exec -n metabob <pod> -- opencode --version` shows new version

### HIGH (Quality)

4. **Remove Filesystem Dependency - debug-activity** (30 min)
   - Edit `templates/bootstrap/debug-activity-self-contained.json`
   - Remove `required_files` from all tasks
   - Update prompts to return markdown in output
   - Verify: Execute without /tmp writes

5. **Remove Filesystem Dependency - evolve-activity** (45 min)
   - Edit `templates/bootstrap/evolve-activity-self-contained.json`
   - Remove `required_files` from all tasks
   - Update prompts to return markdown/JSON in output
   - Verify: Execute without /tmp writes

### MEDIUM (Validation)

6. **Run Validation Harness** (10 min) - *After deployment*
   - Execute `run-validation-harness-pass4.sh`
   - Capture results in JSON
   - Verify: 10/10 tests passing

7. **Test ACP Delegation** (20 min) - *After validation*
   - Use `acp_delegate` to invoke devbob agent
   - Execute create-activity, debug-activity, evolve-activity
   - Verify: SurrealDB records, logs show observability

### LOW (Future Work)

8. **Implement searchSimilarActivities Backend** (2-4 hours) - *Non-blocking*
   - Add POST /v2/activities/search-similar to metabob-cli RPC API
   - Return execution history based on template ID and variables
   - Note: System works with empty results

---

## Risk Assessment

**Overall Risk**: MEDIUM

**Risks**:
- CLI fix straightforward (yargs/commander configuration)
- Deployment routine (existing scripts and helm charts)
- Filesystem fix simple (JSON template edit)

**Mitigations**:
- Test CLI fix locally before Docker build
- Verify Docker image before K8s deployment
- Run validation harness after each fix
- Keep audit trail of all changes

**Estimated Effort**: 3-4 hours total

---

## Observable Proof Required (After Fixes)

### Logs Must Show:
```
✅ INFO auto-enabling trailblazing for meta-template templateId=create-activity
✅ INFO injecting similar activity context for meta-template
✅ DEBUG searchSimilarActivities called templateId=create-activity limit=3
✅ WARN searchSimilarActivities not yet implemented in backend API (expected)
✅ INFO activity starting activityId=<id> templateId=create-activity
```

### SurrealDB Must Contain:
```sql
SELECT * FROM activity WHERE template_id = 'create-activity'
-- Returns record with:
-- ✅ name, category, tasks, created_at, metadata fields
-- ✅ Proper schema validation
```

### Execution Must Succeed:
```bash
# From host
✅ opencode activity create-activity --variables {...} --reason "..."
   # Returns activity ID, no CLI error

# From K8s via ACP
✅ acp_delegate(target: "docker://devbob-...", prompt: "create activity...")
   # Executes successfully, returns template JSON

# Meta-templates
✅ No files created in /tmp/debug-*/ or /tmp/evolve-*/
✅ All output returned in prompt response
```

---

## Impulse Created

**ID**: `trace-dynamic-activity-creation-with-trailblazing-pass4`  
**Type**: `templateDefinition`  
**Budget**: 5000 tokens  
**Content**: Full trace analysis with components, data flow, validation gaps, and action items

This impulse will be used by downstream enforcement and validation activities.

---

## Next Steps

1. ✅ Trace complete (this document)
2. ⏭️ Fix CLI parsing error
3. ⏭️ Remove filesystem dependencies
4. ⏭️ Build and deploy to K8s
5. ⏭️ Run validation harness
6. ⏭️ Verify 100% validation achieved
7. ⏭️ Document completion with audit trail

**Pass 4 Success Criteria**: All 10 validation tests passing in both host and K8s environments with observable proof in logs and database.
