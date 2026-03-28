# Validation Test Case 3: SurrealDB v3.0.0 Flag Usage

**Impulse ID:** validation-surrealdb-v3-schema-init-case-3  
**Type:** memo  
**Purpose:** Expected values for SurrealDB v3.0.0 flags check

## Test Input
```bash
kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].spec.containers[0].args}'
```

## Expected Output
```
["start","--user","$(SURREAL_USER)","--pass","$(SURREAL_PASS)","--log","info","--default-namespace","metabob","--default-database","production","rocksdb:/data/database.db"]
```

## Validation Logic
- Args array must contain "--default-namespace"
- Args array must contain "--default-database"
- Must NOT use deprecated "--ns" or "--db" flags
- YAML indentation must render these as separate array items (not concatenated)

## Context
This is the core specification requirement: SurrealDB v3.0.0 must use correct flags to prevent CLI parsing errors and YAML formatting issues.
