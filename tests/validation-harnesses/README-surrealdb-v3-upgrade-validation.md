# SurrealDB v3.0+ Upgrade and Cross-Vessel Type Validation Harness

## Overview

This validation harness executes a comprehensive upgrade of SurrealDB from v2.x to v3.0+ and validates that cross-vessel type preservation works correctly across TypeScript → Python → FastAPI → SurrealDB boundaries.

## Purpose

Fix the runtime blocker (SurrealDB v2.3.10/v2.6.0 incompatibility) that prevents validation of cross-vessel type preservation. The upgrade ensures that:
- Python `surrealdb-py` client authenticates successfully (no 401 Unauthorized errors)
- Type preservation works: `int=42` stays `int` (not `"42"`), `bool=True` stays `bool` (not `"true"`)
- No false "already exists" errors for unique impulse IDs
- All data flows correctly through the full stack

## Files

### Main Harness
- **Location**: `tests/validation-harnesses/surrealdb-v3-upgrade-and-type-validation-harness.ts`
- **Language**: TypeScript
- **Executable**: `chmod +x` and run with `ts-node`

### Supporting Files
- **Python Harness**: `tests/validation-harnesses/cross-vessel-type-preservation-harness.py`
  - Referenced by Phase 4, Test 4.6
  - Runs 7 comprehensive type preservation tests

## Test Phases

### PHASE 1: Check Current State (3 tests)
**Purpose**: Document baseline state before upgrade

1. **Check Deployed SurrealDB Version**
   - Verifies current deployment is v2.x
   - Uses: `kubectl get deployment`

2. **Check Helm Values Configuration**
   - Reads Helm chart configuration
   - File: `repos/platform/metabob-apps/charts/surrealdb/values/default.surrealdb.values.yaml`

3. **Check Python Requirements**
   - Verifies `surrealdb` or `surrealdb-py` in requirements.txt
   - File: `repos/metabob-rpc-api/requirements.txt`

### PHASE 2: Upgrade SurrealDB (5 tests)
**Purpose**: Execute upgrade from v2.x to v3.0+

1. **Update Helm Values to v3.0.0**
   - Modifies `image.tag` in Helm values file
   - Creates backup: `*.backup`

2. **Update Python Requirements**
   - Ensures `surrealdb-py>=0.3.0` or compatible version
   - Creates backup: `*.backup`

3. **Deploy with Helmfile**
   - Runs: `helmfile --environment default -l name=surrealdb apply`
   - Timeout: 5 minutes

4. **Wait for Rollout**
   - Monitors: `kubectl rollout status deployment/surrealdb -n metabob`
   - Timeout: 5 minutes

5. **Verify New Version**
   - Confirms: `surreal version` shows 3.x.x
   - Uses: `kubectl exec`

### PHASE 3: Database Migration (2 tests)
**Purpose**: Verify database connectivity and basic CRUD

1. **Test Database Connectivity**
   - Endpoint: `/health`
   - Expected: `{ status: "healthy" }`

2. **Test Basic CRUD - Create Impulse**
   - Endpoint: `POST /v2/impulses`
   - Expected: 201 Created

3. **Test Basic CRUD - Read Impulse**
   - Endpoint: `GET /v2/impulses/{id}`
   - Expected: 200 OK

### PHASE 4: Validate Fix (6 tests)
**Purpose**: Confirm type preservation and no false positives

1. **Type Preservation - Integer**
   - Input: `{ int_field: 42 }`
   - Expected: `typeof === 'number'` AND `Number.isInteger()` AND `value === 42`

2. **Type Preservation - Boolean**
   - Input: `{ bool_field: true }`
   - Expected: `typeof === 'boolean'` AND `value === true`

3. **Type Preservation - Float**
   - Input: `{ float_field: 3.14 }`
   - Expected: `typeof === 'number'` AND `!Number.isInteger()` AND `value ≈ 3.14`

4. **Type Preservation - Complex Nested Structure**
   - Input: Nested object with int, bool, float, string, array, nested object
   - Expected: All types preserved, all values matched

5. **No False "Already Exists" Errors**
   - Input: 5 impulses with unique IDs
   - Expected: No "already exists" errors

6. **Run Python Cross-Vessel Type Preservation Harness**
   - Command: `python tests/validation-harnesses/cross-vessel-type-preservation-harness.py`
   - Expected: "ALL TESTS PASSED" (7/7)

## Prerequisites

### Environment Variables
```bash
export API_BASE_URL="http://localhost:8000"  # or your API URL
export API_KEY="your-api-key"                # or test API key
```

### Dependencies
- `kubectl` (Kubernetes CLI)
- `helmfile` (Helm deployment tool)
- `python3` (for Python validation harness)
- `ts-node` (TypeScript execution)
- `node` and `npm` (Node.js runtime)

### Kubernetes Access
- Must have access to the `metabob` namespace
- Must be able to execute commands in pods
- Must be able to apply Helm releases

## Usage

### Basic Execution
```bash
# Set environment variables
export API_BASE_URL="http://api.metabob.local"
export API_KEY="test-api-key"

# Run harness
cd /home/avi/documents/work/exp-repo/metabob-devbob
ts-node tests/validation-harnesses/surrealdb-v3-upgrade-and-type-validation-harness.ts
```

### Programmatic Usage
```typescript
import { runValidation } from './tests/validation-harnesses/surrealdb-v3-upgrade-and-type-validation-harness';

const result = await runValidation();
if (result.pass) {
  console.log('✅ Validation PASSED');
} else {
  console.log('❌ Validation FAILED');
  console.log(result.actual);
}
```

## Expected Output

### Success (All Tests Pass)
```
================================================================================
SurrealDB v3.0+ Upgrade and Cross-Vessel Type Validation Harness
================================================================================

PHASE 1: Check Current State
================================================================================

Running: Check Deployed SurrealDB Version...
✅ PASS: Check Deployed SurrealDB Version

Running: Check Helm Values Configuration...
✅ PASS: Check Helm Values Configuration

Running: Check Python surrealdb Package...
✅ PASS: Check Python surrealdb Package

PHASE 2: Upgrade SurrealDB
================================================================================

Running: Update Helm Values to v3.0.0...
✅ PASS: Update Helm Values to v3.0.0

...

PHASE 4: Validate Fix
================================================================================

Running: Type Preservation - Integer...
✅ PASS: Type Preservation - Integer

Running: Type Preservation - Boolean...
✅ PASS: Type Preservation - Boolean

Running: Type Preservation - Float...
✅ PASS: Type Preservation - Float

Running: Type Preservation - Complex Nested Structure...
✅ PASS: Type Preservation - Complex Nested Structure

Running: No False "Already Exists" Errors...
✅ PASS: No False "Already Exists" Errors

Running: Run Python Cross-Vessel Type Preservation Harness...
✅ PASS: Run Python Cross-Vessel Type Preservation Harness

================================================================================
VALIDATION SUMMARY
================================================================================

PHASE 1: Check Current State: 3/3 PASS
PHASE 2: Upgrade SurrealDB: 5/5 PASS
PHASE 3: Database Migration: 2/2 PASS
PHASE 4: Validate Fix: 6/6 PASS

Total: 16/16 PASS (0 FAILED)

✅ ALL TESTS PASSED - SurrealDB v3.0+ upgrade and type preservation validated!

Report written to: validation-results/surrealdb-v3-upgrade-validation-report.json
```

### Failure (Some Tests Fail)
```
================================================================================
SurrealDB v3.0+ Upgrade and Cross-Vessel Type Validation Harness
================================================================================

...

Running: Type Preservation - Integer...
❌ FAIL: Type Preservation - Integer
  Type Mismatches: Expected integer, got string
  Value Mismatches: Expected 42, got "42"

...

================================================================================
VALIDATION SUMMARY
================================================================================

PHASE 1: Check Current State: 3/3 PASS
PHASE 2: Upgrade SurrealDB: 5/5 PASS
PHASE 3: Database Migration: 2/2 PASS
PHASE 4: Validate Fix: 4/6 PASS

Total: 14/16 PASS (2 FAILED)

❌ VALIDATION FAILED - See details above

Report written to: validation-results/surrealdb-v3-upgrade-validation-report.json
```

## Validation Report

The harness generates a JSON report at:
```
validation-results/surrealdb-v3-upgrade-validation-report.json
```

### Report Structure
```json
{
  "timestamp": "2026-03-08T...",
  "totalTests": 16,
  "passed": 16,
  "failed": 0,
  "phases": {
    "PHASE 1: Check Current State": {
      "total": 3,
      "passed": 3,
      "failed": 0,
      "tests": [...]
    },
    ...
  }
}
```

## Rollback

If the upgrade fails, rollback procedures are available:

### Revert Helm Chart
```bash
# Restore backup
mv repos/platform/metabob-apps/charts/surrealdb/values/default.surrealdb.values.yaml.backup \
   repos/platform/metabob-apps/charts/surrealdb/values/default.surrealdb.values.yaml

# Redeploy
helmfile --environment default -l name=surrealdb apply
```

### Revert Python Requirements
```bash
# Restore backup
mv repos/metabob-rpc-api/requirements.txt.backup \
   repos/metabob-rpc-api/requirements.txt
```

### Verify Rollback
```bash
kubectl exec deployment/surrealdb -n metabob -- surreal version
# Should show v2.x again
```

## Success Criteria

All of the following must be true:

1. ✅ All 16 tests pass
2. ✅ SurrealDB v3.0+ deployed and running
3. ✅ No 401 authentication errors
4. ✅ Type preservation validated:
   - `int=42` returns as `number (integer)`
   - `bool=true` returns as `boolean`
   - `float=3.14` returns as `number (float)`
5. ✅ Complex nested structures preserved
6. ✅ No false "already exists" errors for unique IDs
7. ✅ Python validation harness: 7/7 PASS

## Troubleshooting

### Issue: Helmfile fails with "release not found"
**Solution**: Ensure you're in the correct directory and helmfile.yaml exists
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
helmfile --environment default list
```

### Issue: kubectl cannot connect to cluster
**Solution**: Verify kubectl context
```bash
kubectl config current-context
kubectl get pods -n metabob
```

### Issue: Python harness not found
**Solution**: Verify file exists
```bash
ls -la tests/validation-harnesses/cross-vessel-type-preservation-harness.py
```

### Issue: Type preservation still failing after upgrade
**Solution**: Check Python client version
```bash
kubectl exec deployment/metabob-rpc-api -n metabob -- pip list | grep surrealdb
# Should show surrealdb-py or surrealdb>=1.0.0
```

## Related Documentation

- [Trace Analysis](../../TRACE_SurrealDB_v3_Upgrade_and_Cross_Vessel_Type_Validation.md)
- [Enforcement Summary](../../ENFORCEMENT_SUMMARY_SurrealDB_v3_Upgrade_and_Cross_Vessel_Type_Validation.md)
- [Python Validation Harness](./cross-vessel-type-preservation-harness.py)

## Impulse References

Test case impulses are stored with the following IDs:
- `validation-surrealdb-v3-upgrade-case-1` through `validation-surrealdb-v3-upgrade-case-11`
- `harness-surrealdb-v3-upgrade-and-type-validation` (harness file pointer)

## Estimated Duration

- **Phase 1**: 30 seconds (checking current state)
- **Phase 2**: 8-10 minutes (upgrade and deployment)
- **Phase 3**: 1 minute (database migration)
- **Phase 4**: 3-5 minutes (validation tests)
- **Total**: 15-20 minutes

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed
- `2`: Fatal error (harness execution failure)

---

**Created**: 2026-03-08  
**Version**: 1.0  
**Maintainer**: OpenCode Activity System
