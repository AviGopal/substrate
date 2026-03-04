# Validation Harness: Dynamic Activity Creation with Trailblazing Pass 4

## Overview

This validation harness tests the complete end-to-end workflow for meta-templates (create-activity, evolve-activity, debug-activity) with trailblazing functionality in both Kubernetes and host environments.

## Test Coverage

### Validated Features

1. **Trailblazing Auto-Enable**
   - Meta-template detection
   - Auto-enabling trailblazing with correct parameters
   - Turn-by-turn task execution

2. **Context Injection**
   - searchSimilarActivities() stub returning sample data
   - Historical execution patterns provided to LLM
   - Similar activity recommendations

3. **Memory Hook Execution**
   - memory-management hook triggers before turns
   - manage-session-memory activity executes
   - Context prediction for meta-templates

4. **SurrealDB Activity Tracking**
   - Activity content stored in database
   - Task execution recorded
   - Queryable activity records

5. **Filesystem Independence**
   - Templates execute without /tmp dependencies
   - No file not found errors
   - Works in container environments

6. **Template Registration Performance**
   - Registration completes within 30s timeout
   - No MCP timeout errors

## Test Cases

### Case 1: K8s Trailblazing Auto-Enable
**Environment**: Kubernetes devbob pod
**Input**: create-activity-self-contained with test variables
**Expected**: Logs show "auto-enabling trailblazing for meta-template"

### Case 2: Host Filesystem Independence
**Environment**: Host machine
**Input**: create-activity-self-contained from host CLI
**Expected**: No filesystem errors, execution completes successfully

### Case 3: K8s Context Injection
**Environment**: Kubernetes devbob pod
**Input**: create-activity-self-contained
**Expected**: Logs show sample activity IDs and patterns (e.g., "sample-exec-create-activity-self-contained-1")

### Case 4: K8s Memory Hook
**Environment**: Kubernetes devbob pod
**Input**: create-activity-self-contained
**Expected**: Logs show "memory management hook" and "manage-session-memory"

### Case 5: K8s Database Tracking
**Environment**: Kubernetes devbob pod
**Input**: create-activity-self-contained
**Expected**: Activity record exists in SurrealDB with correct template_id

## Prerequisites

1. **Kubernetes Access**
   ```bash
   kubectl get pods -n metabob -l app=devbob
   # Should show running devbob pod
   ```

2. **SurrealDB Access**
   ```bash
   kubectl get pods -n metabob -l app=surrealdb
   # Should show running surrealdb pod
   ```

3. **Bun Runtime** (for host tests)
   ```bash
   bun --version
   ```

4. **Recent Deployment**
   Ensure devbob container has latest code with Pass 4 changes:
   ```bash
   cd repos/metabob-opencode && bun run build
   cd ../.. && docker build -t devbob:latest -f docker/devbob/Dockerfile .
   kubectl delete pod -n metabob -l app=devbob
   # Wait for new pod to start
   ```

## Usage

### Run All Tests
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass4-harness.ts
```

### Expected Output
```
================================================================================
VALIDATION HARNESS: dynamic-activity-creation-with-trailblazing-pass4
================================================================================

▶ Running: K8s: Create activity with trailblazing auto-enabled
  Environment: kubernetes
  Template: create-activity-self-contained
  Executing in K8s: opencode activity create-activity-self-contained ...
  ✓ PASS

▶ Running: Host: Create activity without filesystem dependencies
  Environment: host
  Template: create-activity-self-contained
  Executing in host
  ✓ PASS

▶ Running: K8s: Context injection provides sample activities
  Environment: kubernetes
  Template: create-activity-self-contained
  Executing in K8s: opencode activity create-activity-self-contained ...
  ✓ PASS

▶ Running: K8s: Memory hook execution
  Environment: kubernetes
  Template: create-activity-self-contained
  Executing in K8s: opencode activity create-activity-self-contained ...
  ✓ PASS

▶ Running: K8s: SurrealDB activity tracking
  Environment: kubernetes
  Template: create-activity-self-contained
  Executing in K8s: opencode activity create-activity-self-contained ...
  ✓ PASS

================================================================================
RESULTS: 5/5 tests passed
================================================================================

✅ Validation PASSED
```

## Manual Verification

### Check Logs for Trailblazing
```bash
kubectl logs -n metabob <devbob-pod> --tail=500 | grep -i "auto-enabling trailblazing"
```

### Check Logs for Context Injection
```bash
kubectl logs -n metabob <devbob-pod> --tail=500 | grep -i "searchSimilarActivities using stub data"
```

### Query SurrealDB
```bash
kubectl exec -n metabob <surrealdb-pod> -- surreal sql \
  --conn http://localhost:8000 --user root --pass root \
  --ns metabob --db metabob \
  "SELECT * FROM activity_executions WHERE template_id = 'create-activity-self-contained' ORDER BY created_at DESC LIMIT 5;"
```

## Troubleshooting

### K8s Tests Skipped
**Issue**: "Devbob pod not found in K8s. Skipping K8s tests."
**Solution**: 
```bash
kubectl get pods -n metabob -l app=devbob
# If no pod, check deployment:
kubectl get deployment -n metabob devbob
# Restart pod:
kubectl rollout restart deployment -n metabob devbob
```

### Filesystem Errors
**Issue**: Logs show "file not found" or "/tmp" errors
**Solution**: Verify templates have empty required_files arrays:
```bash
grep -A 5 "required_files" templates/bootstrap/create-activity-self-contained.json
# Should show: "required_files": []
```

### Context Injection Not Working
**Issue**: Logs show "searchSimilarActivities not yet implemented"
**Solution**: Verify stub implementation in template-service-client.ts:
```bash
grep -A 20 "searchSimilarActivities" repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts
# Should show stub returning sample data
```

### Database Queries Fail
**Issue**: SurrealDB queries return empty or error
**Solution**:
1. Verify SurrealDB pod running
2. Check backend endpoints are configured correctly
3. Verify activity-client.ts is posting to backend

## Test Case Impulses

All test cases are stored as impulses in:
```
impulses/validation-cases/validation-dynamic-activity-creation-with-trailblazing-pass4-case-N.json
```

Each impulse contains:
- Test input (environment, template, variables)
- Expected output (log patterns, database checks)
- Validation method

## Harness Impulse

The harness itself is stored as an impulse:
```json
{
  "id": "harness-dynamic-activity-creation-with-trailblazing-pass4",
  "type": "file",
  "pointer": {
    "type": "file",
    "path": "tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass4-harness.ts"
  },
  "budget": 2000
}
```

## Integration with CI/CD

Add to your CI pipeline:
```yaml
- name: Run Pass 4 Validation
  run: |
    cd /path/to/metabob-devbob
    bun run tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass4-harness.ts
  continue-on-error: false
```

Exit codes:
- `0`: All tests passed
- `1`: One or more tests failed

## Success Criteria

For validation to PASS, all of the following must be true:

- ✅ Meta-template detection logs present
- ✅ Trailblazing auto-enabled with correct parameters
- ✅ Context injection provides sample historical data
- ✅ Memory hook executes before turns
- ✅ Activity records stored in SurrealDB
- ✅ No filesystem dependency errors
- ✅ Template registration completes within 30s

## Next Steps After Validation

1. **If tests PASS**: 
   - Document completion
   - Mark specification as validated
   - Move to production deployment

2. **If tests FAIL**:
   - Review failure messages
   - Check prerequisites
   - Verify recent deployments
   - Review logs for root cause
   - Fix issues and re-run

## Related Documentation

- Trace Analysis: `TRACE_ANALYSIS_pass4.json`
- Enforcement Summary: `ENFORCEMENT_SUMMARY_pass4.json`
- Specification: Dynamic Activity Creation with Trailblazing Pass 4
