# Istio Configuration - Current State Analysis

**Date**: 2026-03-28
**Cluster**: Production

## Executive Summary

❌ **Critical Issue Found**: No VirtualService exists for `ide.metabob.com`
⚠️ **Configuration Issue**: Legacy RPC API deployed to wrong namespace
✅ **Good News**: Gateway is configured correctly and RPC API is running

## Current Production State

### 1. Istio Gateway ✅

**Gateway**: `metabob-gateway` (namespace: `metabob`)

```yaml
spec:
  selector:
    istio: ingressgateway
  servers:
    - port: 80 (HTTP → HTTPS redirect)
      hosts:
        - metabob.com
        - *.metabob.com          # ✅ Includes ide.metabob.com
        - production.metabob.com
        - *.production.metabob.com

    - port: 443 (HTTPS with TLS)
      hosts: [same as above]
      tls:
        credentialName: istio-ingressgateway-certs
```

**Status**: ✅ Gateway correctly configured to accept `ide.metabob.com`

### 2. VirtualServices ❌

**Currently Deployed VirtualServices**:

| Name | Namespace | Host(s) | Backend |
|------|-----------|---------|---------|
| metabob-dashboard | metabob | app.metabob.com | metabob-dashboard + metabob-rpc-api |
| metabob-site | metabob | metabob.com, www.metabob.com | metabob-site |
| amphitheatre-demo | metabob | demo.metabob.com | amphitheatre |
| devbob-debug | metabob | devbob.metabob.com | devbob |

**Missing**: ❌ **NO VirtualService for `ide.metabob.com`**

**Special Note**: The `metabob-dashboard` VirtualService (app.metabob.com) routes several paths to the RPC API:
- `/auth/` → metabob-rpc-api
- `/events` → metabob-rpc-api
- `/api/auth/` → metabob-rpc-api (rewrite)
- `/api/projects` → metabob-rpc-api
- `/api/analytics` → metabob-rpc-api (rewrite)

### 3. RPC API Deployment ⚠️

**Actual State**:
```
Namespace: metabob (NOT metabob-legacy!)
Helm Release: metabob-rpc-api-legacy (in metabob-legacy)
Status: Running (4 pods)
```

**Deployments**:
- `metabob-rpc-api` - 2/2 pods running (API server)
- `metabob-rpc-api-dry-workers` - 2/2 pods running (Celery workers)

**Service**:
- `metabob-rpc-api.metabob.svc.cluster.local:8080`

**ConfigMap**:
- `universal-config` (managed by metabob-rpc-api-legacy release)

**Issue**: The Helm values have `namespace: metabob` which overrides the helmfile's `namespace: metabob-legacy`. This caused resources to be created in the wrong namespace.

### 4. Namespace State

**metabob namespace**:
```
✅ metabob-rpc-api deployment (2 replicas)
✅ metabob-rpc-api-dry-workers deployment (2 replicas)
✅ metabob-rpc-api service
✅ universal-config ConfigMap
✅ 4 pods running
```

**metabob-legacy namespace**:
```
❌ Empty (no pods, services, deployments)
✅ Helm release metadata only
✅ Istio CA certificates (injected automatically)
```

## Root Cause Analysis

### Issue 1: Missing VirtualService for ide.metabob.com

**Root Cause**:
- Legacy helmfile has `istio.enabled: false` (we set this)
- No separate VirtualService created for ide.metabob.com
- istio-gateway chart not updated to include legacy service

**Impact**:
- Traffic to ide.metabob.com gets 404 (no route configured)
- Only app.metabob.com can access RPC API (via metabob-dashboard VirtualService)

### Issue 2: Wrong Namespace

**Root Cause**:
```yaml
# helm/legacy-rpc-api.yaml
releases:
  - name: metabob-rpc-api-legacy
    namespace: metabob-legacy  # Helm release namespace

    values:
      - namespace: metabob     # ← OVERRIDES helmfile namespace!
```

**Impact**:
- Resources created in `metabob` instead of `metabob-legacy`
- Namespace isolation not achieved
- Conflicts with existing metabob-rpc-api release

## Recommendations

### Option 1: Use Existing Deployment (Simplest) ⭐ RECOMMENDED

**Accept that RPC API lives in `metabob` namespace and create VirtualService for ide.metabob.com**

**Pros**:
✅ No migration needed
✅ RPC API already running and stable
✅ Just add routing configuration

**Cons**:
❌ No namespace isolation
❌ Both old and new RPC API in same namespace

**Implementation**:
1. Add `legacy-rpc-api` service to `helm/charts/istio-gateway/values.yaml` (already done)
2. Update namespace reference from `metabob-legacy` → `metabob`
3. Deploy updated istio-gateway chart

```yaml
# helm/charts/istio-gateway/values.yaml
services:
  legacy-rpc-api:
    subdomain: ide
    service: metabob-rpc-api
    namespace: metabob  # ← Change from metabob-legacy
    port: 8080
    enabled:
      development: false
      production: true
```

### Option 2: Fix Namespace and Migrate (Complex)

**Move RPC API to metabob-legacy namespace properly**

**Pros**:
✅ Proper namespace isolation
✅ Clean separation of legacy vs new

**Cons**:
❌ Requires downtime
❌ Need to migrate running workload
❌ Need to create all required secrets in metabob-legacy
❌ Risk of breaking existing traffic

**Implementation**:
1. Create secrets in metabob-legacy namespace
2. Fix values to use `namespace: metabob-legacy`
3. Uninstall old release from metabob
4. Deploy new release to metabob-legacy
5. Update VirtualService routing

### Option 3: Create Separate VirtualService Manually (Quick Fix)

**Create standalone VirtualService without updating gateway chart**

**Pros**:
✅ Quickest fix
✅ No changes to existing deployments

**Cons**:
❌ Configuration not managed by centralized gateway
❌ Manual resource management

**Implementation**:
```bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: legacy-rpc-api-ide
  namespace: metabob
spec:
  hosts:
    - ide.metabob.com
  gateways:
    - metabob-gateway
  http:
    - route:
        - destination:
            host: metabob-rpc-api.metabob.svc.cluster.local
            port:
              number: 8080
      timeout: 300s
      retries:
        attempts: 3
        perTryTimeout: 100s
EOF
```

## Immediate Action Plan

### Step 1: Fix istio-gateway values (5 min)

Update namespace reference in gateway configuration:

```bash
# Edit helm/charts/istio-gateway/values.yaml
# Change legacy-rpc-api namespace from metabob-legacy → metabob
```

### Step 2: Deploy VirtualService (10 min)

```bash
cd helm

# Option A: Deploy via istio-gateway chart
helmfile -f activity-system-minimal.yaml.gotmpl \
  -l name=istio-gateway \
  -e production \
  sync

# Option B: Quick manual fix
kubectl apply -f <virtualservice-manifest>
```

### Step 3: Verify (5 min)

```bash
# Check VirtualService created
kubectl get virtualservice -n metabob | grep ide

# Test routing
curl -v https://ide.metabob.com/

# Check Istio proxy config
istioctl proxy-config routes deploy/istio-ingressgateway.istio-system | grep ide.metabob.com
```

### Step 4: Monitor (Ongoing)

```bash
# Watch for 502/503 errors
kubectl logs -n istio-system -l app=istio-ingressgateway --tail=100 -f | grep ide.metabob.com

# Check backend pod logs
kubectl logs -n metabob -l app=metabob-rpc-api --tail=50 -f
```

## Long-Term Fixes

1. **Decide on namespace strategy**:
   - Keep in `metabob` (simpler)
   - OR migrate to `metabob-legacy` (cleaner separation)

2. **Clean up Helm releases**:
   - If keeping in metabob: uninstall metabob-rpc-api-legacy release
   - If migrating: properly configure namespace values

3. **Centralize routing**:
   - All VirtualServices managed by istio-gateway chart
   - Remove standalone/manual VirtualServices

4. **Documentation**:
   - Update all docs to reflect actual deployment topology
   - Document the app.metabob.com → RPC API routing

## Testing Checklist

Before considering this done:

- [ ] VirtualService for ide.metabob.com exists
- [ ] `curl https://ide.metabob.com/` returns 200 (or expected response)
- [ ] No 404 errors for ide.metabob.com in ingress logs
- [ ] Istio proxy config shows route for ide.metabob.com
- [ ] Backend pods receiving traffic
- [ ] TLS certificate valid for ide.metabob.com
- [ ] CORS headers configured correctly

## Current Service Topology

```
Internet
  │
  ▼
[Istio Ingress Gateway]
  │
  ├─ app.metabob.com ──→ [VirtualService: metabob-dashboard]
  │                        ├─ /auth/* → metabob-rpc-api
  │                        ├─ /events → metabob-rpc-api
  │                        ├─ /api/auth/* → metabob-rpc-api
  │                        ├─ /api/projects → metabob-rpc-api
  │                        └─ /* → metabob-dashboard
  │
  ├─ ide.metabob.com ──→ [MISSING VirtualService] ❌
  │
  ├─ metabob.com ──────→ [VirtualService: metabob-site]
  │
  └─ demo.metabob.com ─→ [VirtualService: amphitheatre-demo]

Backends (all in metabob namespace):
  - metabob-rpc-api (2 pods)
  - metabob-rpc-api-dry-workers (2 pods)
  - metabob-dashboard
  - metabob-site
```

## Files to Update

1. `helm/charts/istio-gateway/values.yaml`
   - Change: `legacy-rpc-api.namespace: metabob-legacy` → `metabob`

2. `helm/legacy-rpc-api.yaml` (optional cleanup)
   - Consider removing or documenting that resources go to metabob

3. `helm/charts/metabob-rpc-api/values.yaml`
   - Fix default namespace if we want it in metabob-legacy

## Summary

**Current Reality**:
- ✅ Gateway configured correctly
- ✅ RPC API running in `metabob` namespace
- ❌ No VirtualService for ide.metabob.com
- ⚠️ Namespace mismatch (intended: metabob-legacy, actual: metabob)

**Immediate Fix**:
- Add VirtualService for ide.metabob.com → metabob-rpc-api.metabob

**Decision Needed**:
- Accept metabob namespace (simpler)
- OR migrate to metabob-legacy (cleaner)
