# Validation Harness: SurrealDB Namespace Configuration

## Purpose
Automated validation harness that verifies the SurrealDB namespace configuration fix is working correctly in the deployed Activity API.

## Harness Location
`tests/validation-harnesses/surrealdb-namespace-configuration-harness.ts`

## What It Validates

### Critical Fix Verification
The harness validates that Activity API now connects to SurrealDB using the correct namespace ("activity-system" instead of legacy "metabob"), fixing the HTTP 500 errors on template endpoints.

### Test Coverage

1. **Infrastructure Layer**
   - ConfigMap has correct namespace configuration
   - Pod environment variable set correctly
   - Helm deployment applied successfully

2. **Application Layer**
   - Config validation prevents invalid namespace
   - Connection verification detects namespace issues
   - Queries execute in correct namespace

3. **API Layer**
   - /v2/activities/templates endpoint returns HTTP 200
   - No authentication or table-not-found errors
   - Templates can be retrieved successfully

### Test Cases

**Case 1: ConfigMap Namespace**
- Input: kubectl get configmap for Activity API
- Expected: namespace: "activity-system"
- Validates: Helm chart deployment

**Case 2: Pod Environment Variable**
- Input: kubectl exec to read SURREALDB_NAMESPACE
- Expected: SURREALDB_NAMESPACE=activity-system
- Validates: ConfigMap → Pod env var flow

**Case 3: Connection Success in Logs**
- Input: kubectl logs to check connection status
- Expected: "Connected to SurrealDB successfully"
- Validates: No authentication or namespace errors

**Case 4: Templates Endpoint HTTP 200**
- Input: curl http://localhost:8080/v2/activities/templates
- Expected: HTTP 200 with JSON response
- Validates: End-to-end query execution

**Case 5: Namespace Verification in Logs**
- Input: kubectl logs to check namespace usage
- Expected: namespace: "activity-system", verified: true
- Validates: Enhanced logging and namespace verification

## Usage

### Run Validation
```bash
# From repository root
ts-node tests/validation-harnesses/surrealdb-namespace-configuration-harness.ts
```

### Exit Codes
- `0` - All validations passed
- `1` - Validation failed (configuration issue)
- `2` - Setup error (K8s not accessible, pod not ready)

### Output Format
```
================================================================================
Validation Harness: SurrealDB Namespace Configuration
================================================================================

Pre-flight Checks:
--------------------------------------------------------------------------------
✓ kubectl access: PASS
✓ Pod running: PASS (Running)

Running Test Cases:
--------------------------------------------------------------------------------

Test: ConfigMap Namespace
  Description: Verify Helm-deployed ConfigMap has namespace: "activity-system"
  Status: ✓ PASS
  Expected: {"namespace":"activity-system"}
  Actual: namespace: "activity-system"
  Details: PASS: Using correct "activity-system" namespace

Test: Pod Environment Variable
  Description: Verify SURREALDB_NAMESPACE=activity-system in pod
  Status: ✓ PASS
  Expected: {"envVar":"SURREALDB_NAMESPACE=activity-system"}
  Actual: SURREALDB_NAMESPACE=activity-system
  Details: PASS: Correct namespace in environment

[... additional test cases ...]

================================================================================
Validation Summary
================================================================================
Total Tests: 5
Passed: 5
Failed: 0

✓ ALL VALIDATIONS PASSED
SurrealDB namespace configuration is correct.
```

## Integration with CI/CD

This harness can be integrated into deployment pipelines:

```yaml
# .github/workflows/validate-deployment.yml
- name: Validate SurrealDB Namespace Configuration
  run: |
    ts-node tests/validation-harnesses/surrealdb-namespace-configuration-harness.ts
```

## Programmatic Usage

The harness exports functions for integration:

```typescript
import { runValidation, ValidationResult } from './surrealdb-namespace-configuration-harness';

// Run all validations
await runValidation();

// Or use individual test functions
// (exported internally, can be extracted if needed)
```

## Historical Context

This harness was created to validate the fix for the critical namespace misconfiguration:

**Problem:**
- Activity API connected to wrong namespace ("metabob")
- All template queries failed with HTTP 500 "Table not found"
- Thompson Sampling learning loop blocked

**Solution Applied:**
- Fixed Helm values and helmfiles
- Added config validation
- Added connection verification
- Enhanced error logging

**This Harness Verifies:**
- All components of the fix are deployed correctly
- Data flows through the correct path
- API functionality is restored

## Related Documentation

- Trace: `impulses/trace-surrealdb-namespace-configuration.md`
- Enforcement: `impulses/enforcement-surrealdb-namespace-configuration.md`
- Test Cases: `impulses/validation-surrealdb-namespace-configuration-case-*.md`

## Maintenance

When to update this harness:
- Namespace changes (unlikely, but could happen)
- New validation requirements discovered
- Additional error cases to check
- Enhanced logging patterns to verify

Token budget: 2000 tokens for lazy loading
