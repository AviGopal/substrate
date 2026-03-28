# Learning System Fix - Final Status

## Environment Clarification

**Working Environment**: Standalone Docker containers
- metabob-rpc-api (port 8080) - ✅ RUNNING & UPDATED
- metabob-redis (port 6379) - ✅ RUNNING
- metabob-surreal (port 8000) - ✅ RUNNING

**K8s Environment**: docker-desktop context, metabob namespace
- K8s pods exist but rpc-api pods are failing (not used for this work)

## Current Bug Investigation

### Symptom
Records created with `variant_id` in Python logs, but `variant_id = None` when queried from SurrealDB.

### What We Tested

1. **JSON interpolation**: `CREATE ... CONTENT {json.dumps(data)}` → variant_id = None
2. **Parameterized CONTENT**: `CREATE ... CONTENT $data` → variant_id = None  
3. **Explicit SET clauses**: `CREATE ... SET field1=$val1, field2=$val2...` → variant_id = None

### Evidence

**Python logs say**:
```
Created record with variant_id: learning-system-e2e-1772413323
```

**SurrealDB RPC query returns**:
```json
{"id": "template_metrics:3htt0t2nq0nr7npkcqbd", "variant_id": null}
```

### Hypothesis

The issue might be:
1. **Two different SurrealDB databases** - Logs show one thing, queries show another
2. **Field name conflict** - "variant_id" might be a reserved word or conflicting with schema
3. **Python client bug** - The `sanitize_record()` or query parsing drops the field
4. **SurrealDB version issue** - v2.6.0 might have a bug with certain field names

### Next Debugging Steps

1. **Verify namespace/database**:
   ```bash
   # Check what NS/DB the Python client is using
   docker logs metabob-rpc-api | grep "namespace\|database"
   
   # Manually query with explicit NS/DB
   curl -X POST http://localhost:8000/rpc \
     -u root:root \
     -H "Surreal-NS: metabob" \
     -H "Surreal-DB: metabob" \
     -d '{"method": "select", "params": ["template_metrics:3htt0t2nq0nr7npkcqbd"]}'
   ```

2. **Test with different field name**:
   - Change `variant_id` to `template_variant_id`  
   - If it works → field name conflict
   - If it fails → deeper issue

3. **Check SurrealDB schema**:
   ```bash
   curl -X POST http://localhost:8000/rpc \
     -H "Surreal-NS: metabob" \
     -H "Surreal-DB: metabob" \
     -d '{"method": "query", "params": ["INFO FOR TABLE template_metrics;"]}'
   ```

4. **Direct SQL CREATE test**:
   ```sql
   CREATE template_metrics SET 
     variant_id = "test-direct",
     total_executions = 999;
   
   SELECT * FROM template_metrics WHERE variant_id = "test-direct";
   ```

## What We've Accomplished

✅ **Infrastructure complete**:
- REST endpoint `/v2/activities/templates/{id}/metrics` works
- Receives metrics, calculates Thompson parameters
- Creates records in SurrealDB
- MCP tool code committed (needs deployment)

⚠️ **Final blocker**:
- Records missing `variant_id` field
- Prevents `get_metrics()` from finding records
- Causes duplicate creation instead of updates

## Time Estimate

If bug is fixable: **30 minutes**
If SurrealDB bug: **2-4 hours** (need workaround like using record IDs as variant IDs)

## Resume Commands

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# 1. Check which environment
docker ps | grep metabob
kubectl get pods -n metabob | grep -E "rpc|surreal"

# 2. Debug variant_id issue
docker logs metabob-rpc-api | grep "variant_id\|namespace"

# 3. Test field name hypothesis
# Edit template_metrics.py: variant_id → template_variant_id
# Rebuild and test

# 4. Or try storing variant_id as record ID
# CREATE template_metrics:my-variant-id SET ...
```
