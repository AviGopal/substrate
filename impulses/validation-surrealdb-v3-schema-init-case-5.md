# Validation Test Case 5: Init-Schema ConfigMap Existence

**Impulse ID:** validation-surrealdb-v3-schema-init-case-5  
**Type:** memo  
**Purpose:** Expected values for init-schema ConfigMap check

## Test Input
```bash
kubectl get configmap -n metabob surrealdb-init-schema -o name
```

## Expected Output
```
configmap/surrealdb-init-schema
```

## Validation Logic
- ConfigMap must exist
- Name: "surrealdb-init-schema"
- Contains init_schema.py script for table creation

## Context
The init-schema ConfigMap is created by the Helm chart and contains the Python script that creates tables with PERMISSIONS FULL.
