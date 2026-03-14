# Validation Test Case 8: RPC API Database Name Alignment

**Impulse ID:** validation-surrealdb-v3-schema-init-case-8  
**Type:** memo  
**Purpose:** Expected values for RPC API database alignment check

## Test Input
```bash
kubectl get deployment -n metabob metabob-rpc-api -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="SURREALDB_DATABASE")].value}'
```

## Expected Output
```
production
```

## Validation Logic
- SURREALDB_DATABASE env var must be "production"
- Must match SurrealDB --default-database value
- Ensures RPC API connects to correct database

## Context
Database name mismatch causes RPC API to query wrong database, resulting in empty results and data isolation failures.
