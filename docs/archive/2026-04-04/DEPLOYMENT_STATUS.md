# Deployment Status - Ready for Production

## ✅ Cluster Verification Complete

### Kubernetes Cluster: CONNECTED

```
Context:      metabob-production
Platform:     Google Kubernetes Engine (GKE)
Region:       us-west2
Control Plane: https://34.102.74.217
Status:       ✅ READY
```

### Infrastructure: VERIFIED

| Component | Status | Details |
|-----------|--------|---------|
| **Istio Service Mesh** | ✅ Running | v1.27, 212 days uptime |
| **Istio Ingress Gateway** | ✅ Running | Ready for traffic routing |
| **Prometheus** | ✅ Running | Metrics collection active |
| **Cluster DNS** | ✅ Running | KubeDNS operational |
| **Cluster Resources** | ✅ Available | Sufficient for deployment |

### Existing Namespaces

| Namespace | Age | Purpose | Status |
|-----------|-----|---------|--------|
| metabob | 4+ years | Legacy RPC API (running) | ✅ Active |
| metabob-legacy | 29 min | Recently created | ✅ Active |
| istio-system | 212 days | Service mesh infrastructure | ✅ Active |
| **activity-system** | N/A | **Target for new deployment** | ⏳ Will be created |

### Helmfile Configuration: VALIDATED

```bash
$ helmfile -f helmfiles/production.yaml.gotmpl list

✅ 8 releases configured and ready:
  - valkey (infrastructure/cache)
  - surrealdb (infrastructure/database)
  - metabob-activity-api (services/backend)
  - metabob-analysis-api (services/backend)
  - metabob-cloud-dashboard (services/frontend)
  - metabob-internal-dashboard (services/frontend)
  - minibob (vessels/autonomous)
  - istio-gateway (infrastructure/networking)
```

### Template Rendering: PASSED

```bash
$ helmfile template

✅ All Helm charts render successfully
✅ No syntax errors
✅ Dependencies resolved
✅ Values properly interpolated
```

## Deployment Architecture

### Target Namespace
**activity-system** (new namespace, will be created automatically)

### Deployment Topology

```
┌─────────────────────────────────────────────────────────────┐
│                   Istio Ingress Gateway                     │
│              (istio-system namespace)                       │
│                                                             │
│  activity.metabob.com  →  metabob-activity-api             │
│  api.metabob.com       →  metabob-analysis-api             │
│  app.metabob.com       →  metabob-cloud-dashboard          │
│  internal.metabob.com  →  metabob-internal-dashboard       │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│             activity-system namespace                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  INFRASTRUCTURE TIER                                        │
│  ├─ Valkey (Redis cache)      10Gi persistence              │
│  └─ SurrealDB (database)      50Gi persistence              │
│                                                             │
│  SERVICES TIER                                              │
│  ├─ metabob-activity-api      3 replicas (blue/green)       │
│  ├─ metabob-analysis-api      3 replicas (blue/green)       │
│  ├─ metabob-cloud-dashboard   2 replicas (blue/green)       │
│  └─ metabob-internal-dashboard 2 replicas                   │
│                                                             │
│  VESSELS TIER                                               │
│  └─ minibob                   3 replicas (blue/green)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Resource Allocation Summary

**Total Requested Resources:**
- CPU: ~7.5 cores
- Memory: ~12 GiB
- Storage: 60 GiB (persistent volumes)

**By Component:**
```
metabob-activity-api:   3 × (500m CPU, 1Gi RAM) = 1.5 CPU, 3Gi RAM
metabob-analysis-api:   3 × (500m CPU, 1Gi RAM) = 1.5 CPU, 3Gi RAM
minibob:                3 × (1 CPU, 2Gi RAM)    = 3 CPU, 6Gi RAM
cloud-dashboard:        2 × (250m CPU, 512Mi)   = 500m CPU, 1Gi RAM
internal-dashboard:     2 × (250m CPU, 512Mi)   = 500m CPU, 1Gi RAM
surrealdb:              1 × (1 CPU, 2Gi RAM)    = 1 CPU, 2Gi RAM
valkey:                 1 × (100m CPU, 256Mi)   = 100m CPU, 256Mi RAM
```

### Blue/Green Deployment Strategy

**Services with Blue/Green:**
- metabob-activity-api
- metabob-analysis-api
- metabob-cloud-dashboard (disabled initially)
- minibob

**Initial State:**
- Blue variant: Active (3 replicas for APIs, 2 for dashboards)
- Green variant: Disabled (ready for future deployments)

**Deployment Flow:**
1. Deploy green variant with new version
2. Scale green to 1 replica
3. Monitor for stability (2 minutes)
4. Switch traffic to green if stable
5. Scale green to full capacity
6. Scale blue down to 1 replica (kept for quick rollback)

## Deployment Readiness Checklist

### ✅ READY

- [x] Kubernetes cluster accessible
- [x] Istio service mesh running
- [x] Helmfile configuration valid
- [x] Helm charts render successfully
- [x] Namespace will be auto-created
- [x] Resource allocation planned
- [x] Deployment order defined
- [x] Rollback procedure documented

### ⏳ PENDING

- [ ] **Docker Images Built and Pushed**
  - metabobapp/metabob-activity-api:1.1.1
  - metabobapp/metabob-analysis-api:0.1.1
  - metabobapp/minibob:0.1.3
  - metabob-cloud-dashboard:0.2.0
  - metabobapp/metabob-internal-dashboard:0.1.0

- [ ] **Kubernetes Secrets Created**
  - anthropic-api-key (for LLM calls)
  - surrealdb-auth (database password)
  - docker-hub (if using private images)

- [ ] **DNS Records Configured**
  - activity.metabob.com → Istio Ingress IP
  - api.metabob.com → Istio Ingress IP
  - app.metabob.com → Istio Ingress IP
  - internal.metabob.com → Istio Ingress IP

- [ ] **SSL Certificates**
  - Option 1: Let's Encrypt (cert-manager)
  - Option 2: Google-managed certificates
  - Option 3: Manual upload

### 🔍 TO VERIFY

- [ ] Get Istio Ingress external IP
- [ ] Test local image pulls from Docker Hub
- [ ] Validate SurrealDB schema compatibility
- [ ] Review production environment variables

## Quick Start Commands

### 1. Get Istio Ingress IP (for DNS)

```bash
kubectl get svc istio-ingressgateway -n istio-system \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

### 2. Create Secrets (before deployment)

```bash
# Activity system namespace will be created by helmfile
# But we can create it manually first to add secrets

kubectl create namespace activity-system

# Anthropic API key
kubectl create secret generic anthropic-api-key \
  --from-literal=api-key=$ANTHROPIC_API_KEY \
  -n activity-system

# SurrealDB password
kubectl create secret generic surrealdb-auth \
  --from-literal=password=$SURREALDB_PASSWORD \
  -n activity-system
```

### 3. Test Deployment (Dry Run)

```bash
cd repos/deployment

# See what would be deployed
helmfile -f helmfiles/production.yaml.gotmpl \
  --dry-run \
  diff
```

### 4. Deploy Infrastructure Only (Safe Test)

```bash
# Deploy just Valkey and SurrealDB first
helmfile -f helmfiles/production.yaml.gotmpl \
  -l tier=infrastructure,component!=networking \
  apply

# Verify infrastructure is healthy
kubectl get pods -n activity-system
kubectl logs -n activity-system -l app.kubernetes.io/name=surrealdb
```

### 5. Full Deployment (After Infrastructure Test)

```bash
# Set image versions (match Helm chart values)
export ACTIVITY_API_VERSION=1.1.1
export ANALYSIS_API_VERSION=0.1.1
export MINIBOB_VERSION=0.1.3
export CLOUD_DASHBOARD_VERSION=0.2.0
export INTERNAL_DASHBOARD_VERSION=0.1.0

# Deploy everything
helmfile -f helmfiles/production.yaml.gotmpl apply

# Watch deployment progress
kubectl get pods -n activity-system -w
```

### 6. Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n activity-system

# Check services
kubectl get svc -n activity-system

# Check Istio configuration
kubectl get gateway,virtualservice -n activity-system

# Test internal connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://metabob-activity-api.activity-system:8080/health
```

## Current Blockers

### Critical Path (Must Complete)

1. **Build Docker Images** ⏰ BLOCKING
   - Images with release tags don't exist on Docker Hub
   - Deployment will fail with ImagePullBackOff
   - Action: Run build script for all vessels

2. **Create Secrets** ⏰ BLOCKING
   - Anthropic API key required for MiniBob and LLM features
   - SurrealDB password required for database access
   - Action: Create secrets in activity-system namespace

### Post-Deployment (Can Do After)

3. **Configure DNS** 🔜 NEEDED FOR EXTERNAL ACCESS
   - Domains won't resolve until DNS updated
   - Can test with port-forwarding initially
   - Action: Point domains to Istio Ingress IP

4. **SSL Certificates** 🔜 NEEDED FOR HTTPS
   - Currently disabled (tls.enabled: false)
   - HTTP works but production should use HTTPS
   - Action: Set up cert-manager or Google-managed certs

## Risk Assessment

### Low Risk ✅

- Deploying to NEW namespace (activity-system)
- Legacy system (metabob namespace) unaffected
- Blue/green deployments allow safe rollback
- Istio already running and stable
- Helmfile has atomic deployments (auto-rollback on failure)

### Medium Risk ⚠️

- First deployment to production GKE cluster
- Resource usage ~7.5 CPU cores (verify node capacity)
- Persistent volumes will be created (can't easily delete)
- DNS changes affect production domain

### Mitigation

- Test infrastructure tier first (Valkey + SurrealDB)
- Deploy services incrementally
- Monitor pod status and logs continuously
- Keep legacy system running during migration
- Have rollback commands ready

## Deployment Timeline (Estimated)

**Phase 1: Preparation** (30-60 min)
- Build and push Docker images
- Create Kubernetes secrets
- Get Istio Ingress IP

**Phase 2: Infrastructure** (10-15 min)
- Deploy Valkey and SurrealDB
- Wait for PVCs to bind
- Verify database connectivity

**Phase 3: Services** (15-20 min)
- Deploy activity-api and analysis-api
- Deploy dashboards
- Test health endpoints

**Phase 4: Vessels** (10 min)
- Deploy MiniBob
- Verify MCP connectivity

**Phase 5: Networking** (5-10 min)
- Deploy Istio Gateway and VirtualServices
- Test internal routing

**Phase 6: External Access** (30-60 min)
- Configure DNS (propagation delay)
- Set up SSL certificates
- Test public endpoints

**Total: 2-3 hours** (first deployment)

## Success Criteria

### Deployment Successful If:

- [ ] All pods in activity-system namespace are Running
- [ ] No pods have restarts or errors
- [ ] Health endpoints return 200 OK
- [ ] SurrealDB accepts connections
- [ ] Valkey (Redis) cache is accessible
- [ ] Istio Gateway routes traffic correctly
- [ ] Internal service-to-service communication works
- [ ] No resource constraints or OOM errors

### Ready for Production If:

- [ ] All deployment success criteria met
- [ ] DNS resolves to Istio Ingress IP
- [ ] SSL certificates installed and valid
- [ ] External endpoints accessible via HTTPS
- [ ] Application functions correctly
- [ ] Monitoring and logs available
- [ ] Rollback procedure tested and documented

## Next Step Recommendation

**RECOMMENDED: Infrastructure Test Deployment**

Deploy only infrastructure components first to validate:
1. Namespace creation
2. PVC provisioning
3. SurrealDB startup
4. Valkey startup
5. Resource allocation

**Command:**
```bash
helmfile -f helmfiles/production.yaml.gotmpl \
  -l tier=infrastructure,component!=networking \
  apply
```

This low-risk test will verify the cluster can handle our workload before deploying application services.

## Support and Documentation

- **Full Verification:** `DEPLOYMENT_VERIFICATION.md`
- **Build Context:** `DOCKER_BUILD_VERIFICATION.md`
- **Vessel Tags:** `VESSEL_TAG_STRATEGY.md`
- **GitHub Setup:** `GITHUB_SETUP.md`
- **Helm Tags:** `../helm/TAG_UPDATE_SUMMARY.md`

---

**Status:** ✅ READY TO DEPLOY (pending Docker images and secrets)
**Last Verified:** 2026-03-28
**Cluster:** metabob-production (GKE us-west2)
