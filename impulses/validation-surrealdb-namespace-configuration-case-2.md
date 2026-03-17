# Validation Test Case 2: Pod Environment Variable

## Test Input
Check SURREALDB_NAMESPACE environment variable in running Activity API pod

## Command
```bash
kubectl exec -n activity-system deployment/metabob-activity-api -- env | grep SURREALDB_NAMESPACE
```

## Expected Output
```
SURREALDB_NAMESPACE=activity-system
```

## Expected Behavior
- Environment variable exists in pod
- Value is "activity-system" (not "metabob")
- Variable is injected from Helm ConfigMap

## Success Criteria
- Output exactly matches `SURREALDB_NAMESPACE=activity-system`
- No other SURREALDB_NAMESPACE variables with different values

## Historical Context
This test verifies the data flow:
- Helm values.yaml → helmfile override → K8s ConfigMap → Pod env var

The environment variable is read by config.ts:62 which now includes validation.
Previously had unsafe default of "metabob" that is now removed.
