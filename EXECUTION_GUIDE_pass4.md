# Pass 4 Execution Guide: Dynamic Activity Creation DevBob Execution Tracking

## Overview

This guide documents how to execute Pass 4, which **actually invokes meta-templates** in the devbob pod and tracks the complete lifecycle through logs and database records.

**Critical Context**: Previous passes (1-3) deployed infrastructure, created validation scripts, and verified deployment readiness, but **never actually executed** the meta-templates. Pass 4 closes this gap.

## Execution Methods

You have **two** execution options:

### Option 1: Bash Script (Standalone)

**File**: `execute-meta-templates-pass4.sh`

**Advantages**:
- Self-contained, no TypeScript dependencies
- Real-time log monitoring
- Detailed audit trail generation
- Step-by-step execution with progress indicators

**Usage**:
```bash
./execute-meta-templates-pass4.sh
```

**What it does**:
1. Pre-flight checks (pods ready, CLI available, env vars)
2. Execute create-activity via kubectl exec
3. Monitor devbob pod logs (grep for trailblazing, lifecycle hooks)
4. Monitor RPC API logs (grep for HTTP requests)
5. Query SurrealDB for activity records
6. Execute evolve-activity with parent reference
7. Execute debug-activity with error context
8. Generate execution results JSON and audit trail

**Output**:
- `logs/pass4-execution-<timestamp>/devbob-logs.txt` - DevBob pod logs
- `logs/pass4-execution-<timestamp>/rpc-api-logs.txt` - RPC API logs
- `logs/pass4-execution-<timestamp>/surrealdb-queries.txt` - Database queries
- `logs/pass4-execution-<timestamp>/audit-trail.md` - Complete execution flow
- `logs/pass4-execution-<timestamp>/execution-results.json` - Validation results

### Option 2: TypeScript Validation Harness (Full Validation)

**File**: `tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass2-harness.ts`

**Advantages**:
- Comprehensive validation with structured output
- Schema validation with Zod
- Pass/fail criteria checking
- Already created in Pass 2 (just needs execution)

**Usage**:
```bash
./run-validation-harness-pass4.sh
```

Or directly:
```bash
npx tsx tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass2-harness.ts
```

**What it does**:
1. Execute create-activity, evolve-activity, debug-activity
2. Analyze DevBob logs for trailblazing and lifecycle patterns
3. Analyze RPC API logs for HTTP requests
4. Query SurrealDB and validate record structure
5. Check for recovery_attempts and state_delta fields
6. Return pass/fail with detailed error messages

**Output**:
- Console output with validation results
- Exit code 0 (pass) or 1 (fail)

## Prerequisites

Before running either script, ensure:

1. **Kubernetes cluster accessible**:
   ```bash
   kubectl cluster-info
   ```

2. **DevBob pod running** in `metabob` namespace:
   ```bash
   kubectl get pods -n metabob -l app.kubernetes.io/name=devbob
   ```

3. **RPC API pod running**:
   ```bash
   kubectl get pods -n metabob -l app.kubernetes.io/name=metabob-rpc-api
   ```

4. **SurrealDB pod running**:
   ```bash
   kubectl get pods -n metabob -l app.kubernetes.io/name=surrealdb
   ```

5. **opencode CLI available in DevBob pod**:
   ```bash
   kubectl exec -n metabob <devbob-pod-name> -- which opencode
   ```

6. **Environment variables configured** (check with):
   ```bash
   kubectl exec -n metabob <devbob-pod-name> -- env | grep ACTIVITY
   ```

## Expected Results

### Critical Success Criteria

After successful execution, you should observe:

1. **create-activity executed** with activity_id extracted (e.g., `act_create_1234567890`)
2. **kubectl logs show**:
   - "isMetaTemplate returned true"
   - "auto-enabling trailblazing for meta-template"
   - "memory management hook: starting execution"
3. **RPC API logs show**: "POST /activity-execution/content"
4. **SurrealDB contains**: Activity record with activity_id, template_id, metadata
5. **recovery_attempts field** present in database (even if empty)
6. **state_delta field** present in database
7. **At least 3 activities** in database (create + evolve + debug)

### Non-Critical Observations

These may or may not appear depending on execution:

- Cost tracking logs (only if trailblazing triggered by failure)
- Recovery attempts (only if tasks failed and retried)
- Specific trailblazing patterns (depends on execution path)

## Troubleshooting

### Pod Not Found

**Error**: DevBob/RPC API/SurrealDB pod not found

**Solution**: Check pod labels match:
```bash
kubectl get pods -n metabob --show-labels
```

Update script labels if needed:
- `K8S_NAMESPACE` in bash script
- `DEVBOB_POD_LABEL`, `RPC_API_POD_LABEL`, `SURREALDB_POD_LABEL`

### opencode CLI Not Found

**Error**: `opencode: command not found` in DevBob pod

**Solution**: Build and deploy DevBob with opencode CLI included, or install opencode in pod:
```bash
kubectl exec -n metabob <devbob-pod-name> -- npm install -g @metabob/opencode
```

### Environment Variables Missing

**Error**: No ACTIVITY_BACKEND_URL or similar env vars

**Solution**: Update DevBob deployment with environment variables:
```yaml
env:
  - name: ACTIVITY_BACKEND_URL
    value: "http://metabob-rpc-api:8000"
  - name: SURREALDB_URL
    value: "http://surrealdb:8000"
```

### Meta-templates Not Registered

**Error**: Template not found: create-activity-self-contained

**Solution**: Bootstrap templates in DevBob pod:
```bash
kubectl exec -n metabob <devbob-pod-name> -- opencode activity search-activities
```

If empty, register meta-templates or install template library.

### SurrealDB Connection Failed

**Error**: Cannot connect to SurrealDB

**Solution**: Check SurrealDB service and credentials:
```bash
kubectl get svc -n metabob surrealdb
kubectl exec -n metabob <surrealdb-pod-name> -- surreal version
```

Adjust SurrealDB query command in script if needed.

## Comparison with Previous Passes

| Aspect | Pass 1 | Pass 2 | Pass 3 | Pass 4 (This Pass) |
|--------|--------|--------|--------|---------------------|
| Infrastructure | ✅ Deployed | ✅ Running | ✅ Verified ready | ✅ Running |
| Validation Scripts | ❌ N/A | ✅ Created | ✅ Created | ✅ **EXECUTED** |
| Meta-template Execution | ❌ No | ❌ No | ❌ No | ✅ **YES** |
| Log Observation | ❌ No | ❌ No | ❌ No | ✅ **YES** |
| Database Verification | ❌ No | ❌ No | ❌ No | ✅ **YES** |
| Audit Trail | ❌ No | ❌ No | ❌ No | ✅ **YES** |

**Key Difference**: Pass 4 is the **first pass to actually execute meta-templates** and observe real behavior.

## Next Steps After Execution

1. **Review Audit Trail**:
   ```bash
   cat logs/pass4-execution-<timestamp>/audit-trail.md
   ```

2. **Analyze DevBob Logs**:
   ```bash
   grep -E "isMetaTemplate|trailblazing|lifecycle" logs/pass4-execution-<timestamp>/devbob-logs.txt
   ```

3. **Check RPC API Logs**:
   ```bash
   grep "POST" logs/pass4-execution-<timestamp>/rpc-api-logs.txt
   ```

4. **Verify Database Records**:
   ```bash
   cat logs/pass4-execution-<timestamp>/surrealdb-queries.txt
   ```

5. **Analyze Results**:
   ```bash
   cat logs/pass4-execution-<timestamp>/execution-results.json | jq .
   ```

6. **Create Enforcement Summary**:
   - Document observed behavior
   - Compare with expected behavior
   - Identify any gaps remaining
   - Create impulse with findings

## Files Created in Pass 4

| File | Purpose | Status |
|------|---------|--------|
| `execute-meta-templates-pass4.sh` | Standalone bash execution script | ✅ Created |
| `run-validation-harness-pass4.sh` | TypeScript harness wrapper | ✅ Created |
| `EXECUTION_GUIDE_pass4.md` | This guide | ✅ Created |
| `logs/pass4-execution-<timestamp>/*` | Execution logs and results | 🔄 Generated at runtime |

## Documentation References

- **Trace Document**: `TRACE_dynamic-activity-creation-devbob-execution-tracking.md`
- **Trace Summary**: `trace-pass4-summary.json`
- **Pass 2 Validation Harness**: `tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass2-harness.ts`
- **Pass 2 Enforcement**: `ENFORCEMENT_COMPLETE_dynamic-activity-creation-with-trailblazing-pass2.md`

---

**Last Updated**: 2026-03-03  
**Status**: Ready for execution  
**Pass Number**: 4
