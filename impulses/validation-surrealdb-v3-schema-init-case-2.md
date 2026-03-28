# Validation Test Case 2: SurrealDB v3.0.0 Image Version

**Impulse ID:** validation-surrealdb-v3-schema-init-case-2  
**Type:** memo  
**Purpose:** Expected values for SurrealDB image version check

## Test Input
```bash
kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].spec.containers[0].image}'
```

## Expected Output
```
surrealdb/surrealdb:v3.0.0
```

## Validation Logic
- Image tag must contain "v3.0.0"
- Exact match: `surrealdb/surrealdb:v3.0.0`
- Ensures v3.0.0-specific flags are available

## Context
SurrealDB v3.0.0 introduced --default-namespace and --default-database flags to replace deprecated --ns and --db flags.
