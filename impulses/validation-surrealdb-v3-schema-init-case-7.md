# Validation Test Case 7: RocksDB Storage Backend

**Impulse ID:** validation-surrealdb-v3-schema-init-case-7  
**Type:** memo  
**Purpose:** Expected values for storage backend check

## Test Input
```bash
kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].spec.containers[0].args[-1]}'
```

## Expected Output
```
rocksdb:/data/database.db
```

## Validation Logic
- Last argument must start with "rocksdb:"
- NOT "memory" (ephemeral, data lost on restart)
- Path: /data/database.db

## Context
RocksDB is the production-grade storage backend. Memory storage loses all data on pod restart.
