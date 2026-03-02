# K8s Deployment - SUCCESS! (With One Bug)

## ✅ MAJOR PROGRESS

### Infrastructure Fully Working
- ✅ K8s namespace clean and rebuilt
- ✅ Redis running (redis-master-0)
- ✅ SurrealDB running (version 2.3.10)
- ✅ metabob-rpc-api pod running (1/1 Ready)
- ✅ Service created and routing correctly

### Metrics Endpoint Working
- ✅ Endpoint accessible: `http://metabob-rpc-api:8080/v2/activities/templates/{id}/metrics`
- ✅ POST request succeeds
- ✅ Thompson Sampling parameters calculated (alpha, beta)
- ✅ Data persists to SurrealDB

### Test Results
```bash
# POST metrics
curl -X POST http://metabob-rpc-api:8080/v2/activities/templates/k8s-test-1772420741/metrics \
  -d '{"metrics": {"total_executions": 1, "success_rate": 1.0}}'

# Response
{
  "status": "success",
  "message": "Metrics updated for k8s-test-1772420741",
  "template_id": "k8s-test-1772420741",
  "updated_fields": ["total_executions", "success_rate", "successful_executions", 
                     "failed_executions", "thompson_alpha", "thompson_beta", ...]
}
```

### SurrealDB Record
```json
{
  "id": "template_metrics:uzk8e8enzchkwb4iea3m",
  "total_executions": 1,
  "success_rate": 1.0,
  "thompson_alpha": 2.0,
  "thompson_beta": 1.0,
  "avg_cost_usd": 0.1,
  "avg_duration_ms": 30000,
  "successful_executions": 1,
  "failed_executions": 0
}
```

## ⚠️ ONE CRITICAL BUG REMAINING

### variant_id Field Missing
**Problem**: The `variant_id` field is not being stored in SurrealDB.

**Evidence**:
- Python logs show: `Created record with variant_id: k8s-test-1772420741`
- SurrealDB record has NO `variant_id` field
- This prevents `get_metrics()` from finding existing records
- Results in duplicate creation on subsequent calls

**Impact**:
- Cannot UPDATE existing records (always creates new ones)
- Thompson Sampling cannot query by variant_id
- Learning system partially broken

**Attempted Fixes** (all failed):
1. JSON interpolation: `CREATE ... CONTENT json.dumps(data)`
2. Parameterized CONTENT: `CREATE ... CONTENT $data`
3. Explicit SET clauses: `CREATE ... SET field1=$val1, field2=$val2, ...`

**Next Steps to Debug**:
1. Test with different field name (`template_variant_id` instead of `variant_id`)
2. Check if "variant_id" is a reserved word in SurrealDB 2.3.10
3. Try using record ID as variant_id: `CREATE template_metrics:my-variant-id SET ...`
4. Check SurrealDB schema/constraints

## Files Modified During K8s Deployment

```
helm/charts/metabob-rpc-api.values.yaml
  - Updated image tag to 0.16.12

helm/charts/metabob-rpc-api/templates/deployment-api.yaml
  - Fixed env vars: SURREAL_* → SURREALDB_*
  - Added REDIS_URI env var
  - Fixed health probes: port 8080 → 80
  - Reduced WORKERS: 16 → 4

/tmp/rpc-api-service.yaml (created and applied)
  - ClusterIP service exposing port 8080 → 80
```

## Secrets/ConfigMaps Created

```
kubectl create configmap universal-config --from-literal=.env=""
kubectl create secret generic minio --from-literal=access-key=dummy --from-literal=secret-key=dummy
kubectl create secret generic postgres-client --from-literal=postgresql-username=dummy --from-literal=postgresql-password=dummy
```

## Key Learnings

1. **Worker process deaths are normal**: Uvicorn workers restart frequently
2. **Health probe ports matter**: Must match actual container port
3. **Service must exist**: VirtualService alone doesn't create Service
4. **Env var naming critical**: Code and deployment must match exactly
5. **Empty secrets OK for unused deps**: MinIO/Postgres not needed but secrets required

## Current State

**Pods**:
```
metabob-rpc-api-65bb884f7-nx5j8                1/1     Running
redis-master-0                                 1/1     Running
surrealdb-65576c4c47-5rmdv                     1/1     Running
```

**Services**:
```
metabob-rpc-api    ClusterIP   8080/TCP
redis-master       ClusterIP   6379/TCP
surrealdb          ClusterIP   8000/TCP
```

**Endpoints Working**:
- `http://metabob-rpc-api:8080/` → {"status": "ok"}
- `http://metabob-rpc-api:8080/v2/activities/templates/{id}/metrics` → Success!

## Next Session Plan

### Priority: Fix variant_id Bug (30-60 min)

**Option 1: Different Field Name**
```python
# In template_metrics.py
data = {
    "template_variant_id": template_id,  # Try different name
    ...
}
```

**Option 2: Use Record ID**
```python
# In template_metrics.py
query = f"CREATE template_metrics:{template_id} SET ..."
# This makes the variant_id part of the record ID
```

**Option 3: Debug SurrealDB**
```bash
# Check schema
kubectl exec surrealdb-xxx -- /surreal sql ... "INFO FOR TABLE template_metrics;"

# Test direct CREATE
kubectl exec surrealdb-xxx -- /surreal sql ... "CREATE template_metrics SET variant_id = 'test-123';"
```

### After Fix: Complete E2E Testing

1. Test create/update cycle (no duplicates)
2. Verify Thompson Sampling queries work
3. Deploy metabob-cli MCP tool
4. Test OpenCode integration

## Estimated Time to Completion

- Fix variant_id bug: 30-60 min
- Test E2E: 15 min
- Deploy metabob-cli: 15 min
- Final verification: 10 min

**Total**: 1-2 hours to fully working learning system
