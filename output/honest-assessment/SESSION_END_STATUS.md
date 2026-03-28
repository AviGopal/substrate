# Session End Status - K8s Migration

## Actions Taken

### ✅ Cleaned Up Environment
- Removed standalone Docker containers (metabob-rpc-api, metabob-redis, metabob-surreal)
- Now exclusively using K8s environment (docker-desktop context, metabob namespace)

### ✅ Updated Code
- Built image: `metabobapp/metabob-rpc-api:0.16.12` with metrics endpoint
- Fixed environment variable names in deployment template:
  - `SURREAL_URL` → `SURREALDB_URL` (changed to http://)
  - `SURREAL_USER` → `SURREALDB_USERNAME`
  - `SURREAL_PASS` → `SURREALDB_PASSWORD`
  
### ⚠️ Deployment Issues
- Helm upgrades timing out
- Pods crashing in CrashLoopBackOff
- Health probes failing

## Current K8s Status

```
NAME                                           STATUS
redis-master-0                                 Running ✅
surrealdb-65576c4c47-rbsvv                     Running ✅
metabob-rpc-api-*                              CrashLoopBackOff ❌
metabob-rpc-api-dry-workers-*                  CrashLoopBackOff ❌
```

## Files Modified

```
helm/charts/metabob-rpc-api.values.yaml              # Updated image tag to 0.16.12
helm/charts/metabob-rpc-api/templates/deployment-api.yaml  # Fixed env var names
repos/metabob-rpc-api/server/routes/activity.py      # Metrics endpoint (committed earlier)
repos/metabob-rpc-api/server/db/operations/template_metrics.py  # CREATE logic
```

## Next Session: Quick Fix Path

### Option 1: Force Clean Deploy (Recommended - 10 min)
```bash
# 1. Delete everything and start fresh
kubectl delete namespace metabob
kubectl create namespace metabob

# 2. Deploy from scratch
cd helm
helmfile -e local sync

# 3. Verify
kubectl get pods -n metabob
kubectl logs -n metabob <rpc-api-pod>
```

### Option 2: Debug Current Deployment (20-30 min)
```bash
# 1. Check why pods are crashing
kubectl logs -n metabob <rpc-api-pod> --previous

# 2. Check secrets exist
kubectl get secrets -n metabob | grep surreal

# 3. Manually apply fixed template
cd helm
helm upgrade metabob-rpc-api charts/metabob-rpc-api \
  -n metabob \
  -f charts/metabob-rpc-api.values.yaml \
  --set image.rpc_api.tag=0.16.12 \
  --force
```

## Outstanding Bug from Earlier

**variant_id field not persisting in SurrealDB**:
- Records created successfully
- Python logs show variant_id populated
- SurrealDB queries return variant_id=null
- Needs investigation in K8s environment (may be different SurrealDB version/config)

## Resume Commands

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Check environment
kubectl config current-context  # Should be: docker-desktop
kubectl get pods -n metabob

# Option 1: Clean slate
kubectl delete ns metabob && kubectl create ns metabob
cd helm && helmfile -e local sync

# Option 2: Debug
kubectl logs -n metabob $(kubectl get pods -n metabob -l app=metabob-rpc-api -o name | head -1)
```

## Key Learnings

1. ✅ Standalone Docker convenient but not reproducible
2. ✅ K8s + Helmfile = consistent, version-controlled deployment
3. ⚠️  Env var naming mismatch between code and helm charts
4. ⚠️  Helm upgrades can timeout/hang - may need clean redeploy

## Success Criteria

Once K8s deployment works:
1. Test metrics endpoint: `kubectl exec -n metabob devbob-0 -- curl http://metabob-rpc-api:8080/`
2. Test metrics update: POST to `/v2/activities/templates/test/metrics`
3. Verify SurrealDB storage
4. Test variant_id persistence (the outstanding bug)
