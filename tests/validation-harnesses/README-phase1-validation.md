# Phase 1 Impulse Binding E2E Validation Harness

## Overview

External validation harness for Phase 1 impulse binding implementation. Tests complete communication flow from metabob-cli → metabob-rpc-api → SurrealDB.

**Specification**: phase1-impulse-binding-e2e-validation  
**Implementation Commits**: 
- metabob-rpc-api: `4307538`
- metabob-cli: `581e2d48f`
- integration: `ad8b188`

## Validation Strategy

**External Validation**: Runs in devbob container with access to metabob-rpc-api k8s service

### Flow
1. Deploy latest code: `cd repos/platform/metabob-apps && helmfile apply`
2. Wait for rollout: `kubectl rollout status deployment/metabob-rpc-api -n metabob`
3. Copy harness to devbob pod
4. Run validation script in devbob
5. Follow logs: `kubectl logs -f metabob-rpc-api-xxx -n metabob`
6. Retrieve validation report

## Test Cases

### Case 1: testResults Passing Tests
- **Input**: Random test data (pytest, 30-100 tests passed, 0-5 skipped)
- **Expected**: HTTP 201, data integrity preserved, all fields match

### Case 2: testResults Failing Tests  
- **Input**: Random test data (npm test, exit_code=1, passed=false)
- **Expected**: HTTP 201, exit_code and passed fields preserved correctly

### Case 3: taskSummary
- **Input**: Random task metrics (duration 1-30s, cost 0.001-0.5, tokens 500-10k)
- **Expected**: HTTP 201, all numeric fields preserved exactly

### Case 4: scriptArtifact
- **Input**: Random script (bash/python/js/ts, random path)
- **Expected**: HTTP 201, file_path, language, executable preserved

### Case 5: Error Handling
- **Input**: Invalid testResults (missing required fields)
- **Expected**: HTTP 400 with validation error

## Usage

### Automated Deployment & Execution

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
./scripts/run-phase1-validation-in-devbob.sh

# With log following
./scripts/run-phase1-validation-in-devbob.sh --follow-logs
```

### Manual Execution in DevBob Pod

```bash
# Copy harness to pod
kubectl cp tests/validation-harnesses/phase1-impulse-binding-e2e-validation-harness.py \
  metabob/devbob-xxx:/tmp/harness.py

# Execute
kubectl exec -n metabob devbob-xxx -- python3 /tmp/harness.py --verbose

# Retrieve results
kubectl cp metabob/devbob-xxx:/tmp/phase1-validation-results.json \
  ./validation-results/phase1-validation-results.json
```

### Direct Execution (if devbob has Python + requests)

```bash
kubectl exec -n metabob devbob-xxx -- bash -c '
export METABOB_API_URL="http://metabob-rpc-api:8080"
export METABOB_API_KEY="test-validation-key"
export PROJECT_ID="proj_phase1_validation"
python3 /tmp/harness.py --verbose
'
```

## Environment Variables

- `METABOB_API_URL`: API service URL (default: `http://metabob-rpc-api:8080`)
- `METABOB_API_KEY`: Authentication key (default: `test-validation-key`)
- `PROJECT_ID`: Multi-tenant project ID (default: `proj_phase1_validation`)

## Output

### Console Output
```
[2026-03-08 05:34:12] [INFO] ==========================================
[2026-03-08 05:34:12] [INFO] Phase 1 Impulse Binding E2E Validation Harness
[2026-03-08 05:34:12] [INFO] ==========================================
[2026-03-08 05:34:12] [INFO] API URL: http://metabob-rpc-api:8080
[2026-03-08 05:34:12] [INFO] Project ID: proj_phase1_validation
...
[2026-03-08 05:34:15] [INFO] ✅ PASS - Case 1 (245ms)
[2026-03-08 05:34:17] [INFO] ✅ PASS - Case 2 (198ms)
...
[2026-03-08 05:34:20] [INFO] Total Cases: 5
[2026-03-08 05:34:20] [INFO] Passed: 5
[2026-03-08 05:34:20] [INFO] Failed: 0
[2026-03-08 05:34:20] [INFO] Success Rate: 100.0%
[2026-03-08 05:34:20] [INFO] Average Response Time: 215ms
```

### JSON Results (`/tmp/phase1-validation-results.json`)

```json
{
  "timestamp": "2026-03-08T05:34:20.123456",
  "api_url": "http://metabob-rpc-api:8080",
  "project_id": "proj_phase1_validation",
  "total_cases": 5,
  "passed": 5,
  "failed": 0,
  "success_rate": 100.0,
  "average_response_time_ms": 215,
  "created_impulse_ids": [
    "val-test-results-pass-a1b2c3d4",
    "val-test-results-fail-e5f6g7h8",
    "val-task-summary-i9j0k1l2",
    "val-script-artifact-m3n4o5p6"
  ],
  "results": [
    {
      "case_id": "validation-phase1-impulse-binding-e2e-validation-case-1",
      "passed": true,
      "actual_output": {...},
      "expected_output": {...},
      "error_message": null,
      "response_time_ms": 245
    },
    ...
  ]
}
```

## Success Criteria

| Criterion | Validation |
|-----------|------------|
| All 3 impulse types round-trip | ✅ Cases 1-4 |
| Random test data survives | ✅ All cases use random data |
| Invalid data → HTTP 400 | ✅ Case 5 |
| API retrieval matches POST | ✅ Data integrity checks |
| No timeout errors | ✅ 10s timeout per request |

## Monitoring

### API Logs

```bash
# Follow RPC API logs during validation
kubectl logs -f metabob-rpc-api-xxx -n metabob

# Filter for impulse endpoints
kubectl logs metabob-rpc-api-xxx -n metabob | grep "/api/v2/impulses"
```

### SurrealDB Verification

```bash
# Connect to SurrealDB
kubectl exec -it surrealdb-0 -n metabob -- /bin/sh

# Query impulses
surreal sql --endpoint http://localhost:8000 \
  --namespace metabob --database devbob \
  --query "SELECT * FROM impulse_data WHERE project_id = 'proj_phase1_validation'"
```

## Troubleshooting

### Harness Fails to Connect

```bash
# Check RPC API service
kubectl get svc -n metabob | grep metabob-rpc-api

# Check RPC API pod
kubectl get pods -n metabob -l app=metabob-rpc-api

# Test connectivity from devbob
kubectl exec -n metabob devbob-xxx -- curl http://metabob-rpc-api:8080/health
```

### Missing Requests Module

```bash
# Install in devbob pod
kubectl exec -n metabob devbob-xxx -- pip install requests
```

### Permission Errors

```bash
# Ensure API key is valid
kubectl get secret -n metabob metabob-api-keys -o yaml

# Check project_id permissions in SurrealDB
```

## Integration with CI/CD

```yaml
# Example GitLab CI job
validate-phase1:
  stage: test
  script:
    - kubectl config use-context production
    - ./scripts/run-phase1-validation-in-devbob.sh
  artifacts:
    reports:
      junit: validation-results/phase1-validation-results.json
    when: always
  only:
    - main
    - develop
```

## Files

- **Harness**: `tests/validation-harnesses/phase1-impulse-binding-e2e-validation-harness.py` (743 lines)
- **Deployment Script**: `scripts/run-phase1-validation-in-devbob.sh`
- **Test Cases**: Defined in harness (5 cases)
- **Results**: `validation-results/phase1-validation-results.json`

## Related Documentation

- [Phase 1 Trace Analysis](../../TRACE_phase1-impulse-binding-e2e-validation.md)
- [Phase 1 Enforcement Summary](../../ENFORCEMENT_phase1-impulse-binding-e2e-validation.md)
- [E2E Validation Script](../../scripts/e2e-phase1-impulse-binding-validation.py)
