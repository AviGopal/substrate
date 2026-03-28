# Validation Harness: Database Schema Initialization

**Specification**: Database Schema Initialization - Automatic Schema Creation on Fresh Deployment

## Overview

This validation harness tests that the SurrealDB init-schema Kubernetes Job runs successfully on fresh deployments and creates all required database tables and indexes automatically.

## What It Validates

### Configuration Changes (Non-Destructive)
1. ✅ `initSchema.enabled=true` in values file
2. ✅ SurrealDB Deployment has `--ns` and `--db` args
3. ✅ SurrealDB StatefulSet has `--ns` and `--db` args

### Deployment Tests (Destructive - Requires Confirmation)
4. ✅ Clean deployment succeeds (`helmfile destroy && apply`)
5. ✅ init-schema Job is created
6. ✅ init-schema Job completes successfully (within 5 minutes)
7. ✅ init-schema Job logs show success message

### Runtime Validation
8. ✅ SurrealDB pod is running and ready
9. ✅ All 13 tables exist in database
10. ✅ All 8 indexes exist in database

## Expected Database Schema

### Tables (13)
- `activity_template`
- `activity_execution`
- `activity_variants`
- `variant_performance_metrics`
- `vessel_registry`
- `users`
- `sessions`
- `organizations`
- `projects`
- `subscriptions`
- `api_keys`
- `audit_logs`
- `schema_versions`

### Indexes (8)
- `activity_template_id_idx`
- `activity_template_category_idx`
- `activity_template_org_idx`
- `activity_execution_id_idx`
- `activity_execution_template_idx`
- `activity_execution_status_idx`
- `vessel_registry_pod_name_idx`
- `vessel_registry_status_idx`

## Prerequisites

- kubectl configured for target cluster
- helmfile CLI installed
- metabob-apps repository cloned
- Cluster access with appropriate permissions

## Usage

```bash
# Run the validation harness
./tests/validation-harnesses/schema-init-harness.sh
```

### Interactive Flow

1. **Configuration Tests** (automatic, non-destructive)
   - Validates templates have correct configuration
   - No cluster changes made

2. **Confirmation Prompt**
   - User must confirm before destructive tests
   - Type "yes" to proceed with clean deployment
   - Type "no" to skip deployment tests

3. **Deployment Tests** (if confirmed)
   - Destroys existing deployment
   - Applies fresh deployment
   - Validates init-schema Job runs
   - Verifies database schema created

## Output Format

```
========================================
Database Schema Initialization Validation
========================================

• INFO: Test 1: Verify initSchema.enabled=true in values
✓ PASS: initSchema.enabled is set to true

• INFO: Test 2: Verify SurrealDB Deployment has --ns and --db args
✓ PASS: Deployment template has --ns and --db args

... (all tests)

========================================
Validation Results
========================================
Total Tests: 10
Passed: 10
Failed: 0

✓ ALL TESTS PASSED

Database Schema Initialization specification is VALID
```

## Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

## Test Case Details

### Test 1: initSchema Enabled
**Purpose**: Verify init-schema hook is enabled in values  
**Method**: Parse YAML and check `initSchema.enabled` value  
**Pass Criteria**: Value is `true`

### Test 2: Deployment Args
**Purpose**: Verify SurrealDB Deployment has namespace/database args  
**Method**: Parse template YAML for `--ns` and `--db` flags  
**Pass Criteria**: Both flags present in args

### Test 3: StatefulSet Args
**Purpose**: Verify SurrealDB StatefulSet has namespace/database args  
**Method**: Parse template YAML for `--ns` and `--db` flags  
**Pass Criteria**: Both flags present in args

### Test 4: Clean Deployment
**Purpose**: Verify fresh deployment succeeds  
**Method**: Run `helmfile destroy && helmfile apply`  
**Pass Criteria**: Exit code 0, no errors

### Test 5: Job Exists
**Purpose**: Verify init-schema Job was created  
**Method**: Query Kubernetes API for Job  
**Pass Criteria**: Job exists with name matching `*init-schema*`

### Test 6: Job Completion
**Purpose**: Verify Job completes successfully  
**Method**: Wait for Job condition=complete (5 min timeout)  
**Pass Criteria**: Job status.succeeded=1 within timeout

### Test 7: Job Logs
**Purpose**: Verify Job logs show successful schema creation  
**Method**: Parse Job logs for success messages  
**Pass Criteria**: Logs contain "Schema initialization successful" and "13/13 tables with PERMISSIONS FULL"

### Test 8: SurrealDB Running
**Purpose**: Verify SurrealDB pod is running and ready  
**Method**: Wait for pod condition=ready (2 min timeout)  
**Pass Criteria**: Pod is ready within timeout

### Test 9: Tables Exist
**Purpose**: Verify all 13 tables exist in database  
**Method**: Query SurrealDB using `INFO FOR DB;`  
**Pass Criteria**: All expected tables found in output

### Test 10: Indexes Exist
**Purpose**: Verify all 8 indexes exist in database  
**Method**: Query SurrealDB using `INFO FOR DB;`  
**Pass Criteria**: All expected indexes found in output

## Troubleshooting

### Job Not Created
- Check values file: `initSchema.enabled` should be `true`
- Check helm release: `helm list -n metabob`
- Check Job template: `helm template charts/surrealdb | grep -A 50 "kind: Job"`

### Job Failed to Complete
- Check Job status: `kubectl describe job <job-name> -n metabob`
- Check Job logs: `kubectl logs job/<job-name> -n metabob`
- Common issues:
  - BackoffLimitExceeded: namespace/database mismatch
  - ImagePullBackOff: RPC API image not available
  - CrashLoopBackOff: SurrealDB not ready or auth failure

### Tables Not Found
- Check SurrealDB logs: `kubectl logs deployment/surrealdb -n metabob`
- Verify namespace/database: Should be `metabob` / `production`
- Manual query: `kubectl exec -it deployment/surrealdb -n metabob -- surreal sql --endpoint http://localhost:8000 --username root --password root --namespace metabob --database production --command "INFO FOR DB;"`

### Deployment Failed
- Check helmfile logs: `/tmp/helmfile-apply.log`
- Check resource events: `kubectl get events -n metabob --sort-by='.lastTimestamp'`
- Verify prerequisites: PVC, secrets, RBAC

## Related Documents

- **Trace Analysis**: `TRACE_SCHEMA_INIT_ANALYSIS.md`
- **Enforcement Summary**: `ENFORCEMENT_SUMMARY_schema_init.md`
- **Deployment Guide**: `DEPLOYMENT_DRY_ANALYSIS_AND_SOLUTION.md`

## Historical Test Cases (Impulses)

Test case data is stored as impulses for reproducibility:

- `validation-schema-init-case-1` through `validation-schema-init-case-10`

These impulses contain input/expected output pairs that can be run without LLM assistance.

## Integration with CI/CD

This harness can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Schema Init Validation
  run: |
    ./tests/validation-harnesses/schema-init-harness.sh << EOF
    yes
    EOF
```

For automated runs, pipe "yes" to skip confirmation prompt.

## Success Criteria

All 10 tests must pass for the specification to be considered valid:

- ✅ Configuration correct (tests 1-3)
- ✅ Deployment succeeds (test 4)
- ✅ Job runs and completes (tests 5-7)
- ✅ Database state correct (tests 8-10)

---

**Last Updated**: March 13, 2026  
**Specification**: Database Schema Initialization - Automatic Schema Creation on Fresh Deployment  
**Phase**: Phase 2 - Database Schema Management
