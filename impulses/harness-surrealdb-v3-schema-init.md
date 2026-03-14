# Validation Harness: SurrealDB v3.0.0 Schema Initialization on K8s Deployment

**Impulse ID:** harness-surrealdb-v3-schema-init  
**Type:** file  
**Purpose:** Automated validation harness for SurrealDB v3.0.0 deployment specification

## File Pointer
```
tests/validation-harnesses/surrealdb-v3-schema-init-harness.sh
```

## Description

This validation harness runs 11 automated checks to verify the SurrealDB v3.0.0 Schema Initialization specification is correctly implemented in the K8s deployment.

## Checks Performed

1. **SurrealDB Pod Status** - Verify pod is Running
2. **SurrealDB v3.0.0 Image** - Verify correct image version
3. **SurrealDB v3.0.0 Flags** - Verify --default-namespace and --default-database usage
4. **Database Name** - Verify database name is 'production'
5. **Init-Schema ConfigMap** - Verify ConfigMap exists
6. **StatefulSet Usage** - Verify StatefulSet (not Deployment) for persistence
7. **RocksDB Storage** - Verify RocksDB backend (not memory)
8. **RPC API Database Alignment** - Verify SURREALDB_DATABASE env matches
9. **RPC API Pod Status** - Verify RPC API is Running
10. **Schema Table Permissions** - Verify ≥13 tables have PERMISSIONS FULL
11. **GAP-9 End-to-End Test** - Verify complete data flow

## Usage

### Human-Readable Output
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
./tests/validation-harnesses/surrealdb-v3-schema-init-harness.sh
```

### JSON Output (for CI/CD)
```bash
./tests/validation-harnesses/surrealdb-v3-schema-init-harness.sh --json
```

## Sample Output

### Success
```
[1] SurrealDB pod is Running... PASS
    ✓ Pod status: Running
[2] SurrealDB uses v3.0.0 image... PASS
    ✓ Image: surrealdb/surrealdb:v3.0.0
[3] SurrealDB uses --default-namespace and --default-database flags... PASS
    ✓ Found v3.0.0 flags (not deprecated --ns/--db)
...
[11] GAP-9 test: Store and retrieve activities... PASS
    ✓ Successfully posted and retrieved 5 activities

========================================
Validation Results
========================================
Total Checks: 11
Passed: 11
Failed: 0

✅ ALL CHECKS PASSED
Specification: SurrealDB v3.0.0 Schema Initialization is VALID
```

### Failure
```
[1] SurrealDB pod is Running... FAIL
    ✗ Pod not running
    Expected: Running
    Actual: Pending

========================================
Validation Results
========================================
Total Checks: 11
Passed: 10
Failed: 1

❌ VALIDATION FAILED
Failed checks:
  ✗ Check 1: SurrealDB pod status
```

## JSON Output Schema

```json
{
  "specificationName": "SurrealDB v3.0.0 Schema Initialization on K8s Deployment",
  "timestamp": "2026-03-13T21:00:00Z",
  "totalChecks": 11,
  "passedChecks": 11,
  "failedChecks": 0,
  "pass": true,
  "failures": [],
  "checks": {
    "surrealdbPodRunning": true,
    "surrealdbV3Image": true,
    "v3FlagsUsed": true,
    "databaseNameProduction": true,
    "initSchemaConfigMapExists": true,
    "usesStatefulSet": true,
    "usesRocksDB": true,
    "rpcApiDatabaseAligned": true,
    "rpcApiRunning": true,
    "tablesHavePermissionsFull": true,
    "gap9TestPassed": true
  }
}
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Validate SurrealDB Deployment
  run: |
    ./tests/validation-harnesses/surrealdb-v3-schema-init-harness.sh --json > validation-results.json
    jq -e '.pass == true' validation-results.json
```

### Exit Codes
- `0` - All checks passed
- `1` - One or more checks failed

## Related Impulses

- **Trace:** trace-surrealdb-v3-schema-init-on-k8s
- **Enforcement:** enforcement-surrealdb-v3-schema-init-on-k8s
- **Test Cases:** validation-surrealdb-v3-schema-init-case-1 through case-11

## Budget

**Token Budget:** 2000 tokens  
**Purpose:** Automated regression prevention and deployment validation

---

**Category:** validation-harness  
**Tags:** surrealdb, k8s, schema, gap-9, phase-2-deployment, automated-testing
