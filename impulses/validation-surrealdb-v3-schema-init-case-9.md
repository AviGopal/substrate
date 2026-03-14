# Validation Test Case 9: RPC API Pod Status

**Impulse ID:** validation-surrealdb-v3-schema-init-case-9  
**Type:** memo  
**Purpose:** Expected values for RPC API pod status check

## Test Input
```bash
kubectl get pods -n metabob -l app=metabob-rpc-api -o jsonpath='{.items[0].status.phase}'
```

## Expected Output
```
Running
```

## Validation Logic
- Pod status must be exactly "Running"
- Required for end-to-end test to work
- Ensures API is available for activity storage/retrieval

## Context
RPC API must be running to execute GAP-9 test and validate complete data flow.
