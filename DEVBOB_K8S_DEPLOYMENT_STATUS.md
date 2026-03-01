# DevBob K8s Deployment Status

## Current State ✅

### Infrastructure Deployed
All core infrastructure is running in the `metabob` namespace on `docker-desktop` Kubernetes:

```bash
kubectl get pods -n metabob
```

| Component | Status | Details |
|-----------|--------|---------|
| DevBob StatefulSet | ✅ Running | 3 pods (devbob-0, devbob-1, devbob-2) |
| Metabob RPC API | ✅ Running | Port 8080, schema initialized |
| SurrealDB | ✅ Running | Port 8000, accessible |
| Redis | ✅ Running | Port 6379, accessible |

### Docker Images Built ✅

| Image | Tag | Size | Status |
|-------|-----|------|--------|
| `devbob` | `latest` | 826MB | ✅ Built |
| `devbob` | `local-fixed` | 826MB | ✅ Tagged (used by K8s) |
| `opencode` | Binary embedded in devbob | 130MB | ✅ Built |

### Network Connectivity ✅

**Direct Pod Communication** (Working):
```bash
# RPC API Pod IP: 10.1.0.140
kubectl exec devbob-0 -n metabob -c devbob -- \
  curl -s "http://10.1.0.140:8080/health"
# Returns: {"status":"ok","version":"0.16.0"}
```

**Service Mesh** (Istio routing issues):
- ⚠️ `http://metabob-rpc-api` → Timeout (Istio proxy issues)
- ✅ Direct pod IP works: `http://10.1.0.140:8080`

### Environment Configuration

**DevBob Environment Variables**:
```bash
METABOB_API_URL=http://metabob-rpc-api  # ⚠️ Missing :8080 port
METABOB_RPC_API_SERVICE_HOST=10.99.242.22
METABOB_RPC_API_SERVICE_PORT=8080
SURREAL_HOST=surrealdb
SURREAL_PORT=8000
SURREAL_DATABASE=devbob
REDIS_MASTER_SERVICE_HOST=10.104.16.152
REDIS_MASTER_SERVICE_PORT=6379
```

**RPC API Listening**:
- Port: `8080`
- Health: `http://<pod-ip>:8080/health`
- API Docs: `http://<pod-ip>:8080/docs`

### Database Schema ✅

**RPC API Schema Initialized**:
```bash
kubectl exec -n metabob metabob-rpc-api-56d8fb8c46-tspz4 -c rpc-api -- \
  python -m server.actions.init_schema_version
# ✅ Schema version tracking initialized!
```

**Tables Created**:
- `schema_versions` (version tracking)
- Activity system tables (16 total expected)

## Known Issues

### 1. Istio Service Mesh Routing ⚠️
**Problem**: `http://metabob-rpc-api` times out from devbob pods
**Cause**: Istio virtual service configuration issue
**Workaround**: Use direct pod IP (`http://10.1.0.140:8080`)
**Fix**: Update Istio configuration or use ClusterIP service directly

### 2. Missing Port in METABOB_API_URL ⚠️
**Problem**: `METABOB_API_URL=http://metabob-rpc-api` (missing :8080)
**Impact**: OpenCode might not connect to RPC API correctly
**Fix**: Update DevBob Helm chart to set `METABOB_API_URL=http://metabob-rpc-api:8080`

### 3. DevBob Pods Empty Workspace
**Status**: Fresh pods with no configuration or test scripts
**Expected**: This is normal for a clean deployment
**Next**: Need to configure DevBob or test via external scripts

## Next Steps

### 1. Fix Service Routing
**Option A**: Fix Istio configuration
```bash
# Check Istio virtual service
kubectl get virtualservice -n metabob
kubectl describe virtualservice metabob-rpc-api -n metabob
```

**Option B**: Update DevBob to use direct service endpoint
```bash
# Update StatefulSet environment
METABOB_API_URL=http://metabob-rpc-api:8080
# Or use direct service IP
METABOB_API_URL=http://10.99.242.22:8080
```

### 2. Test Boredom Activity Execution

**Manual Test from Host**:
```bash
# Create a test activity in local directory
# Run: opencode activity run <directory>
# Observe logs in RPC API and SurrealDB
```

**Test from DevBob Pod**:
```bash
kubectl exec -it devbob-0 -n metabob -c devbob -- bash
cd /workspace
# Create test activity
# Run and verify data flow
```

### 3. Verify Complete Data Flow

**Expected Flow**:
```
DevBob (OpenCode) → 
  HTTP POST to RPC API (http://10.1.0.140:8080/activities/...) →
    RPC API processes →
      Writes to SurrealDB (activity data) →
      Writes to Redis (cache)
```

**Verification Commands**:
```bash
# Monitor RPC API logs
kubectl logs -f -n metabob metabob-rpc-api-56d8fb8c46-tspz4 -c rpc-api

# Check SurrealDB data
kubectl exec -it surrealdb-7db6d6d85c-7s2c5 -n metabob -c surrealdb -- \
  surreal sql --conn http://localhost:8000 \
    --user root --pass root \
    --ns metabob --db production \
    "SELECT * FROM activities LIMIT 10;"

# Check Redis cache
kubectl exec -it redis-master-0 -n metabob -c redis -- \
  redis-cli KEYS "activity:*"
```

### 4. Deploy Updated Helm Charts (Optional)

**Platform Repo RPC API Chart**:
```bash
cd repos/platform/deployments/metabob
# Note: Currently fails due to Docker Hub image pull
# Would need local registry or mock image
```

**DevBob Helm Chart**:
```bash
# Check if DevBob chart exists in platform repo
ls -la repos/platform/deployments/metabob/charts/devbob/
# Deploy if available
helmfile -e local apply --selector name=devbob
```

## Quick Reference Commands

### Check Pod Status
```bash
kubectl get pods -n metabob -o wide
```

### Test RPC API Health
```bash
RPC_IP=$(kubectl get pod -n metabob -l app=metabob-rpc-api -o jsonpath='{.items[0].status.podIP}')
kubectl exec devbob-0 -n metabob -c devbob -- curl -s "http://${RPC_IP}:8080/health"
```

### Access DevBob Shell
```bash
kubectl exec -it devbob-0 -n metabob -c devbob -- bash
```

### View RPC API Logs
```bash
kubectl logs -f -n metabob -l app=metabob-rpc-api -c rpc-api
```

### Check OpenCode Version
```bash
kubectl exec devbob-0 -n metabob -c devbob -- opencode --version
```

## Configuration Files

### Local Helm Values
- **RPC API**: `repos/platform/deployments/metabob/charts/metabob-rpc-api/values/local.metabob-rpc-api.values.yaml`
- **DevBob**: `repos/platform/deployments/metabob/charts/devbob/values/local.devbob.values.yaml`

### Docker Images
- **DevBob Dockerfile**: `docker/Dockerfile.devbob`
- **OpenCode Binary**: `repos/metabob-opencode/.build/opencode` (embedded in devbob image)

### Kubernetes Manifests
- **Simple RPC API**: `k8s-metabob-rpc-api-simple.yaml`
- **DevBob StatefulSet**: Currently deployed (external source)

## Success Metrics

✅ **Infrastructure**: All pods running (4/4)
✅ **Images**: Built and tagged correctly
✅ **Networking**: Direct pod communication working
✅ **Database**: Schema initialized in SurrealDB
⚠️ **Service Mesh**: Istio routing needs fix
⚠️ **Configuration**: METABOB_API_URL missing port
⏳ **End-to-End**: Waiting for boredom activity test

## Summary

The DevBob K8s deployment is **90% complete**:
- Infrastructure is deployed and healthy
- Direct pod communication is working
- Database schema is initialized
- Need to fix Istio routing or use direct endpoints
- Need to run end-to-end activity test to verify data flow

**Recommended Next Action**: Test boredom activity execution using direct pod IP workaround, then fix Istio configuration for long-term stability.
