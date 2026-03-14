# Validation Test Case 1: SurrealDB Pod Running Status

**Impulse ID:** validation-surrealdb-v3-schema-init-case-1  
**Type:** memo  
**Purpose:** Expected values for SurrealDB pod status check

## Test Input
```bash
kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].status.phase}'
```

## Expected Output
```
Running
```

## Validation Logic
- Pod status must be exactly "Running"
- Any other status (Pending, Failed, CrashLoopBackOff, etc.) is a failure
- NotFound indicates deployment issue

## Context
This validates that the SurrealDB pod is successfully deployed and running in the K8s cluster after helmfile apply.
