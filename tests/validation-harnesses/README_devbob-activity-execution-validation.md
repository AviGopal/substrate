# Validation Harness: devbob-activity-execution-validation

**Specification**: devbob-activity-execution-validation  
**Created**: 2026-03-07  
**Type**: End-to-end integration test (k8s environment)

## Purpose

Validates the complete activity recommendation and learning loop by executing activities FROM the DevBob container in Kubernetes and following execution through the metabob-rpc-api backend.

This harness tests the **entire data flow**:
```
DevBob OpenCode CLI → MCP Client → metabob-rpc-api (k8s service DNS) 
→ MCP Server → Backend API → SurrealDB → Thompson Sampling → Learning Loop Closure
```

## What It Tests

### Critical Validations (Must Pass)
1. ✅ **DevBob MCP Configuration** - Verifies opencode.json uses k8s service DNS
2. ✅ **Thompson Sampling Recommendations** - metabob_recommend_activities returns alpha/beta/sample
3. ✅ **Template Metrics Update** - Alpha/beta values exist and are valid
4. ✅ **Learning Loop Closure** - Thompson Sampling data refreshed after execution
5. ✅ **All MCP Tools Available** - 5 critical tools accessible from DevBob

### Non-Critical Validations (Informational)
6. ℹ️ **Activity Execution** - Runs activity (may fail, validates execution flow)
7. ℹ️ **Backend Log Monitoring** - Checks for execution recording in logs

## Prerequisites

- DevBob pod running in k8s namespace `metabob`
- metabob-rpc-api pod running in k8s namespace `metabob`
- kubectl access to the cluster
- Backend accessible at `http://metabob-rpc-api.metabob.svc.cluster.local:8080`
- Bun or Node.js with TypeScript support

## Usage

### Run the Harness

```bash
# Using Bun (recommended)
bun run tests/validation-harnesses/devbob-activity-execution-validation-harness.ts

# Using Node.js with tsx
npx tsx tests/validation-harnesses/devbob-activity-execution-validation-harness.ts

# Using compiled JavaScript
npx tsc tests/validation-harnesses/devbob-activity-execution-validation-harness.ts
node tests/validation-harnesses/devbob-activity-execution-validation-harness.js
```

### Expected Output

```
Starting devbob-activity-execution-validation harness...

Step 1: Verifying DevBob MCP configuration...
  ✅ DevBob correctly configured to use k8s service DNS

Step 2: Testing metabob_recommend_activities MCP tool...
  ✅ Received 3 recommendations with Thompson Sampling metadata

Step 3: Executing activity add-rest-endpoint...
  ✅ Activity executed successfully. Session: act_abc123def

Step 4: Monitoring backend logs...
  ✅ Backend logs show execution recording activity

Step 5: Verifying template_metrics update...
  ✅ Metrics found: alpha=5.0, beta=2.0

Step 6: Verifying learning loop closure...
  ✅ Learning loop functional: Thompson Sampling data present

Step 7: Testing all 5 critical MCP tools...
  ✅ All 5 MCP tools available in DevBob

================================================================================
VALIDATION SUMMARY
================================================================================
✅ All 7 validation steps passed
Total: 7 | Passed: 7 | Failed: 0
================================================================================
```

### Exit Codes

- **0**: All validation steps passed
- **1**: One or more validation steps failed

## Test Cases

### Case 1: DevBob MCP Configuration
**Input**: Read `/workspace/.opencode/opencode.json` or `/root/.opencode/opencode.json`  
**Expected**: `mcp.metabob.url = "http://metabob-rpc-api.metabob.svc.cluster.local:8080"`

### Case 2: MCP Tool - metabob_recommend_activities
**Input**: `opencode activity search "Add REST endpoint" --category feature --limit 3`  
**Expected**: JSON with 1-5 recommendations, each with Thompson Sampling metadata (alpha, beta, sample)

### Case 3: Activity Execution
**Input**: `opencode activity run <template-id> --variables '{}' --reason "Validation test"`  
**Expected**: Execution output with session_id

### Case 4: Backend Log Monitoring
**Input**: `kubectl logs <rpc-api-pod> -n metabob --tail=100 --since=10s`  
**Expected**: Logs contain `POST /api/v1/learning-loop/executions` and `update_metrics`

### Case 5: Template Metrics Update
**Input**: `curl http://metabob-rpc-api.metabob.svc.cluster.local:8080/api/v1/learning-loop/metrics/<template-id>`  
**Expected**: JSON with `thompson_alpha > 0`, `thompson_beta > 0`, `total_executions > 0`

### Case 6: Learning Loop Closure
**Input**: Re-run `opencode activity search` after execution  
**Expected**: Valid Thompson Sampling metadata (ranking may or may not change)

### Case 7: All MCP Tools Available
**Input**: `opencode mcp list`  
**Expected**: All 5 tools listed:
- metabob_recommend_activities
- metabob_post_activity_result
- metabob_create_activity_variant
- metabob_recommend_impulses
- metabob_fetch_boredom_activities

## Troubleshooting

### DevBob Pod Not Found
```
Error: DevBob pod not found in metabob namespace
```
**Solution**: Check pod status: `kubectl get pods -n metabob -l app=devbob`

### MCP Configuration Not Found
```
Step 1 FAIL: Config file not found
```
**Solution**: 
1. Check config location in DevBob: `kubectl exec <devbob-pod> -n metabob -- find / -name opencode.json 2>/dev/null`
2. Verify MCP config: `kubectl exec <devbob-pod> -n metabob -- cat /workspace/.opencode/opencode.json`

### No Recommendations Returned
```
Step 2 FAIL: No recommendations found
```
**Solution**:
1. Check backend health: `curl http://metabob-rpc-api.metabob.svc.cluster.local:8080/health`
2. Verify templates exist in backend: `kubectl exec <devbob-pod> -n metabob -- opencode activity list`
3. Check backend logs: `kubectl logs -f <rpc-api-pod> -n metabob`

### Activity Execution Fails
```
Step 3 FAIL: Activity execution failed
```
**Solution**: This is non-critical. The harness tests execution flow, not activity success. Check that execution produces output (session_id).

### Metrics Not Updated
```
Step 5 FAIL: Missing Thompson Sampling metrics
```
**Solution**:
1. Verify backend processed execution: `kubectl logs <rpc-api-pod> -n metabob | grep update_metrics`
2. Check SurrealDB connection: Backend may have database connectivity issues
3. Wait longer: Metrics may take a few seconds to propagate

## Integration with CI/CD

```yaml
# .github/workflows/validate-devbob.yml
name: DevBob Activity Execution Validation

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure kubectl
        run: |
          echo "${{ secrets.KUBECONFIG }}" | base64 -d > ~/.kube/config
      
      - name: Install Bun
        run: curl -fsSL https://bun.sh/install | bash
      
      - name: Run Validation Harness
        run: |
          bun run tests/validation-harnesses/devbob-activity-execution-validation-harness.ts
```

## Historical Reference

This harness can be executed repeatedly without LLM assistance. All expected values are hardcoded based on the specification requirements. Results are deterministic (pass/fail) and suitable for automated regression testing.

## Related Files

- **Specification Trace**: `TRACE_devbob-activity-execution-validation.md`
- **Enforcement Summary**: `ENFORCEMENT_devbob-activity-execution-validation.md`
- **Harness Metadata**: `VALIDATION_HARNESS_devbob-activity-execution-validation.json`

## Maintenance

When specification changes, update:
1. Expected values in test cases (e.g., MCP URL, tool list)
2. Validation logic in step functions
3. This README

**Last Updated**: 2026-03-07  
**Specification Version**: 1.0
