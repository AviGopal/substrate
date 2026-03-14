# Validation Test Case 6: StatefulSet for Persistence

**Impulse ID:** validation-surrealdb-v3-schema-init-case-6  
**Type:** memo  
**Purpose:** Expected values for StatefulSet vs Deployment check

## Test Input
```bash
kubectl get statefulset,deployment -n metabob -l app=surrealdb -o jsonpath='{.items[0].kind}'
```

## Expected Output
```
StatefulSet
```

## Validation Logic
- Resource kind must be "StatefulSet"
- NOT "Deployment" (which uses ephemeral storage)
- StatefulSet ensures persistent volume claims are created

## Context
This validates the fix applied in enforcement phase: flattened values structure enables StatefulSet rendering with persistent storage.
