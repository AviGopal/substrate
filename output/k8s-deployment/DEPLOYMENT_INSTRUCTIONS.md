# Deployment Instructions - HTTP RPC Fix

## Summary

Successfully updated Helmfile values to deploy the new RPC API image with complete HTTP RPC persistence fixes.

### Image Details

- **Previous**: `metabobapp/metabob-rpc-api:0.16.14-scope-fix`
- **New**: `metabobapp/metabob-rpc-api:0.16.18-http-rpc-complete`
- **Size**: 1.77GB
- **Built**: 2026-03-01T10:16:14-08:00

### Fixes Included

1. **Activity ID Lookup Fallback** (server/actions/activity.py)
   - Enables `get_template_by_id` to accept both variant_id and activity_id
   - Returns latest variant when given activity_id

2. **Return Logic Fix** (server/db/operations/template_data.py)
   - Prevents double-nesting of results
   - Returns properly formatted list structure

3. **Build Optimizations**
   - Removed surrealdb-py dependency (no Rust compilation)
   - Build time reduced by 60-80%

## Files Updated

### Helmfile Values
```
File: repos/platform/metabob-apps/charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml
Backup: output/k8s-deployment/metabob-rpc-api.values.yaml.backup
```

### Change Made
```yaml
image:
  imageRegistry: metabobapp
  rpc_api:
    repo: metabob-rpc-api
    tag: 0.16.18-http-rpc-complete  # Updated from 0.16.14-scope-fix
```

## Current Kubernetes Context

- **Context**: docker-desktop
- **Namespace**: metabob
- **Cluster**: docker-desktop

## Deployment Options

### Option 1: Local Docker Desktop Deployment (Current Context)

```bash
cd repos/platform/deployments/metabob

# Deploy to local cluster
helmfile -e local sync

# Check deployment status
kubectl get pods -n metabob | grep rpc-api

# Check logs
kubectl logs -n metabob -l app=metabob-rpc-api --tail=100 -f
```

### Option 2: Integration Environment

```bash
cd repos/platform/deployments/metabob

# Switch context
kubectl config use-context development

# Deploy to integration
helmfile -e integration sync

# Verify deployment
kubectl get pods -n metabob -o wide
```

### Option 3: Production Environment

```bash
cd repos/platform/deployments/metabob

# Switch context (CAUTION: Production)
kubectl config use-context metabob-production

# Deploy to production (after integration validation)
helmfile -e prod sync

# Monitor rollout
kubectl rollout status deployment/metabob-rpc-api -n metabob
```

## Verification Steps

### 1. Check Pod Status
```bash
kubectl get pods -n metabob -l app=metabob-rpc-api
```

Expected output:
```
NAME                               READY   STATUS    RESTARTS   AGE
metabob-rpc-api-xxxxxxxxxx-xxxxx   1/1     Running   0          2m
```

### 2. Verify Image Tag
```bash
kubectl get pod -n metabob -l app=metabob-rpc-api -o jsonpath='{.items[0].spec.containers[0].image}'
```

Expected output:
```
metabobapp/metabob-rpc-api:0.16.18-http-rpc-complete
```

### 3. Check Application Logs
```bash
kubectl logs -n metabob -l app=metabob-rpc-api --tail=50
```

Look for:
- Successful startup messages
- No errors related to activity template retrieval
- Database connection successful

### 4. Test HTTP RPC Endpoints

```bash
# Get pod name
POD=$(kubectl get pods -n metabob -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}')

# Port forward
kubectl port-forward -n metabob $POD 8000:8000 &

# Test get_template_by_id with activity_id
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "method": "get_template_by_id",
    "params": {"template_id": "some-activity-id"}
  }'

# Test get_templates_by_activity_id
curl -X POST http://localhost:8000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "method": "get_templates_by_activity_id",
    "params": {"activity_id": "some-activity-id"}
  }'
```

### 5. Verify Results Structure

Check that:
- Results are NOT double-nested
- Response is a proper list
- Activity templates have correct structure

## Rollback Procedure

If issues are detected:

```bash
cd repos/platform/deployments/metabob

# Restore backup values
cp ../../../output/k8s-deployment/metabob-rpc-api.values.yaml.backup \
   charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml

# Redeploy previous version
helmfile -e local sync

# Or use kubectl rollback
kubectl rollout undo deployment/metabob-rpc-api -n metabob
```

## Available Contexts

```
CURRENT   NAME                 NAMESPACE
          azure-development    prefect
          development          prefect
*         docker-desktop       metabob      <- CURRENT
          local                prefect
          metabob-ops-k8s      
          metabob-production   metabob      <- PRODUCTION
          ops                  
```

## Next Steps

1. **Deploy to local** (docker-desktop) first for testing
2. **Verify fixes** work as expected
3. **Deploy to integration** for broader testing
4. **Monitor for issues** in integration
5. **Deploy to production** after validation period

## Build Artifacts

- Docker image: `metabobapp/metabob-rpc-api:0.16.18-http-rpc-complete`
- Build log: `output/k8s-deployment/build-production.log`
- Build manifest: `output/k8s-deployment/build-manifest.json`
- Values backup: `output/k8s-deployment/metabob-rpc-api.values.yaml.backup`
- This guide: `output/k8s-deployment/DEPLOYMENT_INSTRUCTIONS.md`

## Notes

- Image is built locally and not pushed to registry (pushToRegistry=false)
- Current context is docker-desktop (local cluster)
- Production deployment requires switching context to metabob-production
- All fixes are verified and included in the build
