# Deployment Verification - Production Cluster

## Current Cluster Status ✅

### Kubernetes Context
```
Current Context: metabob-production
Cluster: gke_metabob_us-west2_production
Region: us-west2
Control Plane: https://34.102.74.217
Status: ✅ Running
```

### Existing Namespaces

| Namespace | Purpose | Status | Age |
|-----------|---------|--------|-----|
| **metabob** | Legacy RPC API system | ✅ Active | 4+ years |
| **metabob-legacy** | Recently created | ✅ Active | 29 minutes |
| **istio-system** | Service mesh | ✅ Active | 212 days |
| **activity-system** | New activity system (target) | ❌ Not created | - |

### Infrastructure Components

**Istio Service Mesh:** ✅ Installed and Running
```
istio-ingressgateway    1/1 Running
istiod                  1/1 Running
prometheus              2/2 Running
```

**Legacy System (metabob namespace):**
```
metabob-rpc-api                2/2 Running (2 replicas)
metabob-rpc-api-dry-workers    2/2 Running (2 replicas)
redis-master                   2/2 Running
surrealdb                      2/2 Running
```

## Deployment Configuration

### Target Namespace
**Name:** `activity-system`
**Status:** Will be created by helmfile (createNamespace: true)

### Helmfile Configuration

**Location:** `repos/deployment/helmfiles/production.yaml.gotmpl`

**Deployment Order:**
1. **Infrastructure**
   - Valkey (Redis-compatible cache)
   - SurrealDB (Learning database)
2. **Services**
   - metabob-activity-api (activity.metabob.com)
   - metabob-analysis-api (api.metabob.com)
   - metabob-cloud-dashboard (app.metabob.com)
   - metabob-internal-dashboard (internal.metabob.com)
3. **Vessels**
   - minibob (autonomous development)
4. **Networking**
   - Istio Gateway

### Production Surfaces

| Surface | Domain | Service | Target |
|---------|--------|---------|--------|
| Activity API | activity.metabob.com | metabob-activity-api | Backend |
| Analysis API | api.metabob.com | metabob-analysis-api | Backend |
| Cloud Dashboard | app.metabob.com | metabob-cloud-dashboard | Frontend |
| Internal Dashboard | internal.metabob.com | metabob-internal-dashboard | Admin |

### Image Versions (from Helm charts)

| Service | Image | Tag | Status |
|---------|-------|-----|--------|
| metabob-activity-api | metabobapp/metabob-activity-api | 1.1.1 | ⏳ Needs build |
| metabob-analysis-api | metabobapp/metabob-analysis-api | 0.1.1 | ⏳ Needs build |
| minibob | metabobapp/minibob | 0.1.3 | ⏳ Needs build |
| metabob-cloud-dashboard | metabobapp/metabob-cloud-dashboard | 0.2.0 | ⏳ Needs build |
| metabob-internal-dashboard | metabobapp/metabob-internal-dashboard | 0.1.0 | ⏳ Needs build |

### Resource Allocation (Production)

**metabob-activity-api:**
- Replicas: 3 (blue/green enabled)
- CPU: 500m request, 1000m limit
- Memory: 1Gi request, 2Gi limit

**metabob-analysis-api:**
- Replicas: 3 (blue/green enabled)
- CPU: 500m request, 1000m limit
- Memory: 1Gi request, 2Gi limit

**minibob:**
- Replicas: 3 (blue/green enabled)
- CPU: 1000m request, 2000m limit
- Memory: 2Gi request, 4Gi limit

**metabob-cloud-dashboard:**
- Replicas: 2 (blue/green enabled)
- CPU: 250m request, 500m limit
- Memory: 512Mi request, 1Gi limit

**metabob-internal-dashboard:**
- Replicas: 2
- CPU: 250m request, 500m limit
- Memory: 512Mi request, 1Gi limit

**SurrealDB:**
- Persistence: 50Gi (standard-rwo)
- CPU: 1000m request, 2000m limit
- Memory: 2Gi request, 4Gi limit

**Valkey (Redis):**
- Persistence: 10Gi
- CPU: 100m request, 500m limit
- Memory: 256Mi request, 512Mi limit

## Pre-Deployment Checklist

### 1. Docker Images ❌

**Required Actions:**
```bash
# Build and push all vessel images with release tags
cd repos

# metabob-activity-api:1.1.1
docker build -f metabob-activity-api/Dockerfile -t metabobapp/metabob-activity-api:1.1.1 .
docker push metabobapp/metabob-activity-api:1.1.1

# metabob-analysis-api:0.1.1
docker build -f metabob-analysis-api/Dockerfile -t metabobapp/metabob-analysis-api:0.1.1 .
docker push metabobapp/metabob-analysis-api:0.1.1

# minibob:0.1.3
docker build -f minibob/Dockerfile -t metabobapp/minibob:0.1.3 .
docker push metabobapp/minibob:0.1.3

# metabob-cloud-dashboard:0.2.0
docker build -f metabob-cloud-dashboard/Dockerfile -t metabobapp/metabob-cloud-dashboard:0.2.0 .
docker push metabobapp/metabob-cloud-dashboard:0.2.0

# metabob-internal-dashboard:0.1.0
docker build -f metabob-internal-dashboard/Dockerfile -t metabobapp/metabob-internal-dashboard:0.1.0 .
docker push metabobapp/metabob-internal-dashboard:0.1.0
```

**Verification:**
```bash
docker pull metabobapp/metabob-activity-api:1.1.1
docker pull metabobapp/metabob-analysis-api:0.1.1
docker pull metabobapp/minibob:0.1.3
docker pull metabobapp/metabob-cloud-dashboard:0.2.0
docker pull metabobapp/metabob-internal-dashboard:0.1.0
```

### 2. Kubernetes Secrets ⏳

**Required Secrets:**

**Anthropic API Key:**
```bash
kubectl create secret generic anthropic-api-key \
  --from-literal=api-key=$ANTHROPIC_API_KEY \
  -n activity-system
```

**SurrealDB Password:**
```bash
kubectl create secret generic surrealdb-auth \
  --from-literal=password=$SURREALDB_PASSWORD \
  -n activity-system
```

**Docker Hub Credentials (for private images):**
```bash
kubectl create secret docker-registry docker-hub \
  --docker-server=docker.io \
  --docker-username=$DOCKER_USERNAME \
  --docker-password=$DOCKER_PASSWORD \
  -n activity-system
```

### 3. DNS Configuration ⏳

**Required DNS Records:**

| Domain | Type | Target | Status |
|--------|------|--------|--------|
| activity.metabob.com | A/CNAME | Istio Ingress IP | ⏳ Configure |
| api.metabob.com | A/CNAME | Istio Ingress IP | ⏳ Configure |
| app.metabob.com | A/CNAME | Istio Ingress IP | ⏳ Configure |
| internal.metabob.com | A/CNAME | Istio Ingress IP | ⏳ Configure |

**Get Istio Ingress IP:**
```bash
kubectl get svc istio-ingressgateway -n istio-system \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

### 4. SSL Certificates ⏳

**TLS Configuration:**
- Current: TLS disabled (tls.enabled: false)
- Required: SSL certificates for *.metabob.com

**Options:**
1. Let's Encrypt (cert-manager)
2. Google-managed certificates (GKE)
3. Manual certificate upload

### 5. Cluster Resources ✅

**Check available resources:**
```bash
kubectl top nodes
kubectl describe nodes | grep -A 5 "Allocated resources"
```

**Estimated resource usage:**
- CPU: ~7.5 cores (requests)
- Memory: ~12 Gi (requests)

### 6. Istio Gateway ✅

**Verify Istio:**
```bash
kubectl get gateway -n activity-system
kubectl get virtualservice -n activity-system
```

## Deployment Commands

### Option 1: Full Deployment (All Services)

```bash
cd repos/deployment

# Set image versions (optional - defaults to chart values)
export ACTIVITY_API_VERSION=1.1.1
export ANALYSIS_API_VERSION=0.1.1
export MINIBOB_VERSION=0.1.3
export CLOUD_DASHBOARD_VERSION=0.2.0
export INTERNAL_DASHBOARD_VERSION=0.1.0

# Deploy everything
helmfile -f helmfiles/production.yaml.gotmpl apply
```

### Option 2: Infrastructure Only (Test First)

```bash
# Deploy only Valkey and SurrealDB
helmfile -f helmfiles/production.yaml.gotmpl \
  -l tier=infrastructure \
  apply
```

### Option 3: Incremental Deployment

```bash
# 1. Deploy infrastructure
helmfile -f helmfiles/production.yaml.gotmpl -l tier=infrastructure apply

# 2. Deploy backend services
helmfile -f helmfiles/production.yaml.gotmpl -l tier=services apply

# 3. Deploy vessels
helmfile -f helmfiles/production.yaml.gotmpl -l tier=vessels apply

# 4. Configure networking
helmfile -f helmfiles/production.yaml.gotmpl -l tier=infrastructure,component=networking apply
```

### Option 4: Dry Run (Test Configuration)

```bash
helmfile -f helmfiles/production.yaml.gotmpl \
  --dry-run \
  --detailed-exitcode \
  diff
```

## Post-Deployment Verification

### 1. Check Namespace Creation

```bash
kubectl get namespace activity-system
```

### 2. Check Pod Status

```bash
kubectl get pods -n activity-system
kubectl get pods -n activity-system -w  # Watch mode
```

### 3. Check Services

```bash
kubectl get svc -n activity-system
```

### 4. Check Ingress Configuration

```bash
kubectl get gateway -n activity-system
kubectl get virtualservice -n activity-system
```

### 5. Test Health Endpoints

```bash
# Internal cluster DNS
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://metabob-activity-api.activity-system.svc.cluster.local:8080/health

# External domains (after DNS configured)
curl https://activity.metabob.com/health
curl https://api.metabob.com/health
curl https://app.metabob.com
curl https://internal.metabob.com
```

### 6. Check Logs

```bash
# Activity API
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=50

# Analysis API
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-analysis-api --tail=50

# MiniBob
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob --tail=50

# SurrealDB
kubectl logs -n activity-system -l app.kubernetes.io/name=surrealdb --tail=50
```

### 7. Verify Database Connectivity

```bash
# Port-forward SurrealDB
kubectl port-forward -n activity-system svc/surrealdb 8000:8000

# Test connection
curl http://localhost:8000/health
```

## Rollback Procedure

If deployment fails:

```bash
# Rollback specific release
helm rollback metabob-activity-api -n activity-system

# Rollback all releases
helmfile -f helmfiles/production.yaml.gotmpl \
  --state-values-set rollback=true \
  apply

# Or destroy and redeploy
helmfile -f helmfiles/production.yaml.gotmpl destroy
```

## Monitoring

### Resource Usage

```bash
# Pod resource usage
kubectl top pods -n activity-system

# Node resource usage
kubectl top nodes
```

### Events

```bash
# Watch events
kubectl get events -n activity-system --watch

# Recent events sorted by time
kubectl get events -n activity-system \
  --sort-by='.lastTimestamp' | tail -20
```

### Logs Streaming

```bash
# Stream all logs from activity-system
kubectl logs -n activity-system --all-containers=true -f -l tier=services
```

## Cost Estimation

**GKE Cluster Resources:**
- Nodes: ~2-3 n1-standard-4 instances (estimate)
- Cost: ~$200-300/month (estimate)

**Persistent Storage:**
- SurrealDB: 50Gi = ~$10/month
- Valkey: 10Gi = ~$2/month

**Load Balancer:**
- Istio Ingress: ~$20/month

**Total Estimated:** ~$250-350/month (before traffic costs)

## Next Steps

1. ✅ Verify cluster access and configuration
2. ⏳ Build and push Docker images with release tags
3. ⏳ Create Kubernetes secrets
4. ⏳ Configure DNS records
5. ⏳ Deploy infrastructure (Valkey + SurrealDB)
6. ⏳ Deploy services (APIs + Dashboards)
7. ⏳ Deploy vessels (MiniBob)
8. ⏳ Configure Istio Gateway
9. ⏳ Set up SSL certificates
10. ⏳ Monitor and validate deployment

## Current Blockers

1. **Docker Images:** Need to build and push release-tagged images to Docker Hub
2. **Secrets:** Need to create required secrets in activity-system namespace
3. **DNS:** Need to point domains to Istio ingress IP

## Deployment Strategy

**Recommended Approach:**
1. Start with infrastructure only (Valkey + SurrealDB)
2. Verify database connectivity
3. Deploy backend APIs
4. Test API health endpoints
5. Deploy frontends
6. Configure networking last
7. Set up SSL certificates
8. Update DNS to point to cluster

This incremental approach allows validation at each step and easier troubleshooting.
