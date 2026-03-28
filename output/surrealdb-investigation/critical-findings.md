# SurrealDB Status & Critical Findings

## Pod Status
- **Pod Name**: surrealdb-d7f986df-jhg9c
- **Status**: Running (2/2 containers ready)
- **Restarts**: 3 times in the last 7h24m
- **IP Address**: 10.1.0.151
- **Service**: ClusterIP 10.99.198.243:8000
- **Endpoint**: http://surrealdb.metabob.svc.cluster.local:8000

## CRITICAL FINDING: In-Memory Storage Mode

From the SurrealDB logs:
```
[INFO] surrealdb::core::kvs::ds: Starting kvs store in memory
[INFO] surrealdb::core::kvs::ds: Started kvs store in memory
```

**This is the root cause of empty query results!**

### Problem Analysis
1. **SurrealDB is running in MEMORY mode** - not persistent storage
2. **Pod has restarted 3 times** (most recently 53m ago)
3. **Every restart wipes all data** stored in memory
4. **Activity templates registered via HTTP RPC are lost** on pod restart

### Why HTTP RPC Fix Appears to Work
- The HTTP RPC endpoints correctly register templates to SurrealDB
- Registration succeeds with 200 OK responses
- But the data only exists until the next pod restart
- Queries return empty because data was lost in the last restart

### Impact
- Activity templates: Lost on restart
- Activity instances: Lost on restart
- Impulse storage: Lost on restart
- Learning metrics: Lost on restart

## Connectivity Status
- **SurrealDB pod is healthy and running**
- **Service endpoint is properly configured**
- **RPC API pods are in CrashLoopBackOff** - cannot test end-to-end connectivity
- **Network connectivity should work** (service endpoints are correct)

## Next Steps
1. **Configure persistent storage for SurrealDB** (file or RocksDB backend)
2. **Update Helm values to use persistent volume**
3. **Restart SurrealDB with persistent storage**
4. **Re-register activity templates**
5. **Verify templates survive pod restarts**

## Configuration Fix Required
The SurrealDB deployment needs to be updated from:
```yaml
# Current (in-memory)
command: ["surreal", "start", "memory"]
```

To:
```yaml
# Persistent storage
command: ["surreal", "start", "file://data"]
# OR
command: ["surreal", "start", "rocksdb://data"]
```

With a PersistentVolumeClaim mounted at `/data`.
