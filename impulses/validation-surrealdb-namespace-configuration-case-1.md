# Validation Test Case 1: ConfigMap Namespace Configuration

## Test Input
Check Kubernetes ConfigMap for Activity API service in activity-system namespace

## Command
```bash
kubectl get configmap -n activity-system -l app=metabob-activity-api -o yaml | grep -A5 surrealdb | grep namespace
```

## Expected Output
```yaml
namespace: "activity-system"
```

## Expected Behavior
- ConfigMap should exist in activity-system namespace
- SurrealDB namespace configuration should be "activity-system"
- No references to legacy "metabob" namespace

## Success Criteria
- Output contains `namespace: "activity-system"`
- Output does NOT contain `namespace: "metabob"`
- ConfigMap is deployed and accessible

## Historical Context
This test verifies the Helm chart deployment applied the fix from:
- helm/charts/metabob-activity-api/values.yaml:28
- helm/helmfile-activity-minimal.yaml:148

Legacy value was "metabob" which caused all queries to execute in wrong namespace.
