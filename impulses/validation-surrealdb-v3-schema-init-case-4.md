# Validation Test Case 4: Database Name Configuration

**Impulse ID:** validation-surrealdb-v3-schema-init-case-4  
**Type:** memo  
**Purpose:** Expected values for database name check

## Test Input
```bash
kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].spec.containers[0].args}' | grep -oP '(?<=--default-database )\w+'
```

## Expected Output
```
production
```

## Validation Logic
- Database name must be exactly "production"
- Must match RPC API SURREALDB_DATABASE env var
- Ensures data is stored in the correct database

## Context
Database name alignment between SurrealDB and RPC API is critical. Mismatched names cause query failures and data isolation issues.
