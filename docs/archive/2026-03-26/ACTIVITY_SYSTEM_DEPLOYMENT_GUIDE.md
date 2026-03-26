# Activity System - Minimal Deployment Guide

## Overview

Complete single-file Helm deployment for MiniBob boredom activities system with:
- **Valkey** (cache layer - Redis-compatible, Linux Foundation open source)
- **SurrealDB** (learning database with Thompson Sampling)
- **metabob-activity-api** (backend API, 2 replicas)
- **activity-dashboard** (React UI on port 3000)
- **minibob** (AI agent for boredom execution)
- **Istio Gateway** (local host networking via *.minibob.local)

**File**: `helm/activity-system-minimal.yaml`

---

## Prerequisites

### 1. System Requirements
```bash
# Kubernetes cluster (Docker Desktop, Minikube, or cloud)
kubectl version

# Helm 3+
helm version

# Helmfile
helmfile --version

# Istio (required for local networking)
istioctl version || echo "Istio not installed"
```

### 2. Install Istio (if needed)
```bash
istioctl install --set profile=demo -y
```

### 3. Configure Local Host Access
```bash
# Add to /etc/hosts
sudo bash -c 'echo "127.0.0.1  api.minibob.local dashboard.minibob.local" >> /etc/hosts'

# Verify
cat /etc/hosts | grep minibob
```

### 4. Build Docker Images
```bash
# MetaBob Activity API
cd repos/metabob-activity-api
docker build -t metabob-activity-api:latest .
cd ../../

# Activity Dashboard
cd repos/activity-dashboard
docker build -t activity-dashboard:latest .
cd ../../

# MiniBob
cd repos/minibob
docker build -t minibob:latest .
cd ../../

# Make images available to Docker Desktop/Minikube
# (Usually automatic if using local Docker daemon)
```

---

## Secret Management

This deployment uses **presync hooks** to securely manage credentials:

### Required Environment Variables

```bash
# REQUIRED: Anthropic API Key (no default)
export ANTHROPIC_API_KEY="sk-ant-..."

# OPTIONAL: Database credentials
export SURREALDB_USERNAME="root"              # default: root
export SURREALDB_PASSWORD="surrealdb-dev-123"  # default: surrealdb-local-dev-123

# OPTIONAL: LLM configuration
export LLM_PROVIDER="anthropic"               # default: anthropic
export LLM_MODEL="claude-sonnet-4-20250514"   # default: claude-sonnet-4-20250514
```

### Secrets Created Automatically

The presync hook creates three Kubernetes secrets:

1. **minibob-secrets**
   - `anthropic-api-key` - From `$ANTHROPIC_API_KEY`
   - `github-token` - Empty (optional for git operations)

2. **database-secrets**
   - `username` - From `$SURREALDB_USERNAME`
   - `password` - From `$SURREALDB_PASSWORD`

3. **llm-config** (ConfigMap)
   - `provider` - From `$LLM_PROVIDER`
   - `model` - From `$LLM_MODEL`

**Note**: Secrets are never stored in Git - they're created at deploy time from environment variables.

---

## Deployment Steps

### Step 1: Prepare Environment

```bash
# Set required variables
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Optional: Custom database password
export SURREALDB_PASSWORD="my-secure-password"

# Verify variables are set
echo "API Key set: ${ANTHROPIC_API_KEY:0:20}..."
```

### Step 2: Validate Prerequisites

```bash
# Check Kubernetes
kubectl cluster-info

# Check Istio
kubectl get namespace istio-system

# Check images are available
docker images | grep -E "metabob-activity-api|activity-dashboard|minibob"
```

### Step 3: Deploy

```bash
# Deploy the stack (takes 2-5 minutes)
helmfile -f helm/activity-system-minimal.yaml apply

# Watch deployment progress
watch kubectl -n activity-system get pods
```

### Step 4: Verify Deployment

```bash
# Check all pods are running
kubectl -n activity-system get pods

# Check secrets were created
kubectl -n activity-system get secrets
# Expected: minibob-secrets, database-secrets

# Check ConfigMaps
kubectl -n activity-system get configmaps
# Expected: llm-config

# Test API connectivity
curl http://api.minibob.local/health
```

### Step 5: Access Services

```
Dashboard:   http://dashboard.minibob.local
API Health:  http://api.minibob.local/health
API Status:  http://api.minibob.local/status
```

---

## Monitoring & Debugging

### View Logs

```bash
# MiniBob agent
kubectl -n activity-system logs -f deployment/minibob

# Activity API
kubectl -n activity-system logs -f deployment/metabob-activity-api --all-containers=true

# Activity Dashboard
kubectl -n activity-system logs -f deployment/activity-dashboard

# All services
kubectl -n activity-system logs -f -l app=minibob --all-containers=true
```

### Check Service Health

```bash
# Port-forward to test directly
kubectl -n activity-system port-forward svc/metabob-activity-api 8080:8080 &
curl http://localhost:8080/health

# Test database connectivity
kubectl -n activity-system exec -it deployment/metabob-activity-api -- \
  curl http://surrealdb:8000/health

# Test Redis connectivity
kubectl -n activity-system exec -it deployment/metabob-activity-api -- \
  redis-cli -h redis-master ping
```

### Verify Secret Injection

```bash
# Check secret in running pod
kubectl -n activity-system exec deployment/minibob -- env | grep ANTHROPIC

# Check if secret key is properly mounted
kubectl -n activity-system describe pod -l app=minibob | grep -A 20 "Mounts:"
```

---

## Internal Service Networking

All services are automatically configured to communicate internally:

```
minibob (Port 8080)
  ├─> metabob-activity-api (Port 8080)
  │    ├─> surrealdb (Port 8000)
  │    └─> valkey (Port 6379)
  └─> (LLM API via ANTHROPIC_API_KEY)

activity-dashboard (Port 3000)
  └─> metabob-activity-api (Port 8080)
```

### Internal DNS Names
- API: `http://metabob-activity-api.activity-system.svc.cluster.local:8080`
- Database: `http://surrealdb.activity-system.svc.cluster.local:8000`
- Cache: `redis://redis.activity-system.svc.cluster.local:6379` (Valkey)

---

## Updating Configuration

### Update LLM Model

```bash
# Change model for next deployment
export LLM_MODEL="claude-opus-4-20250514"

# Re-deploy (presync hook updates ConfigMap)
helmfile -f helm/activity-system-minimal.yaml apply
```

### Update Database Credentials

```bash
# Change password
export SURREALDB_PASSWORD="new-secure-password"

# Re-deploy (presync hook creates new secret)
helmfile -f helm/activity-system-minimal.yaml apply

# Note: Existing data persists (volume mount)
```

### Update Resource Limits

Edit `helm/activity-system-minimal.yaml`:

```yaml
resources:
  limits:
    cpu: 2000m      # Increase for minibob
    memory: 4Gi
  requests:
    cpu: 500m
    memory: 1Gi
```

Then re-deploy:
```bash
helmfile -f helm/activity-system-minimal.yaml apply
```

---

## Cleanup & Teardown

### Graceful Shutdown

```bash
# Destroy the entire stack (keeps namespace, configmaps)
helmfile -f helm/activity-system-minimal.yaml destroy

# Delete namespace (removes everything including PVCs)
kubectl delete namespace activity-system
```

### Cleanup Local /etc/hosts

```bash
# Remove from /etc/hosts manually or:
sudo sed -i '/minibob.local/d' /etc/hosts
```

---

## Troubleshooting

### "ANTHROPIC_API_KEY not set" Error

```bash
# Cause: Environment variable not exported
# Fix:
export ANTHROPIC_API_KEY="sk-ant-..."
helmfile -f helm/activity-system-minimal.yaml apply
```

### "Istio not found" Warning

```bash
# Cause: Istio not installed
# Fix:
istioctl install --set profile=demo -y
# Or skip Istio and use port-forward:
kubectl -n activity-system port-forward svc/metabob-activity-api 8080:8080 &
kubectl -n activity-system port-forward svc/activity-dashboard 3000:3000 &
```

### Pods stuck in "Pending"

```bash
# Check resource availability
kubectl describe node

# Check pod events
kubectl -n activity-system describe pod <pod-name>

# Common fix: not enough disk space for SurrealDB PVC
kubectl get pvc -n activity-system
kubectl describe pvc -n activity-system
```

### Database connection timeout

```bash
# Check SurrealDB is running
kubectl -n activity-system get pod -l app=surrealdb

# Check database logs
kubectl -n activity-system logs -f svc/surrealdb

# Verify credentials in secret
kubectl -n activity-system get secret database-secrets -o yaml
```

### Istio Gateway not working

```bash
# Check Gateway is created
kubectl -n activity-system get gateway

# Check VirtualServices
kubectl -n activity-system get vs

# Check Istio Ingress pod is running
kubectl -n istio-system get pods -l app=istio-ingressgateway

# Test with port-forward instead:
kubectl -n istio-system port-forward svc/istio-ingressgateway 8080:80 &
curl -H "Host: api.minibob.local" http://localhost:8080/health
```

---

## Architecture Overview

### Data Flow

```
User Browser
    ↓
Istio Gateway (Port 80)
    ├─ dashboard.minibob.local → activity-dashboard:3000
    └─ api.minibob.local → metabob-activity-api:8080

MiniBob Agent
    ├─ Fetches activities from metabob-activity-api
    ├─ Reads/writes metrics to SurrealDB via API
    ├─ Caches templates via Valkey (through API)
    └─ Executes LLM calls to Anthropic API (external)

metabob-activity-api
    ├─ Queries activity templates from SurrealDB
    ├─ Maintains Thompson Sampling metrics
    ├─ Caches results in Valkey (24hr, 1hr, 5min TTLs)
    └─ Serves activities to Dashboard & MiniBob

Database Layer
    ├─ SurrealDB: activity_template, metrics, execution traces
    └─ Valkey: session cache, query results
```

### Network Topology

```
┌─────────────────────────────────────────────────┐
│ Kubernetes Cluster (activity-system namespace)  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ Istio Ingress Gateway                    │  │
│  │ (Selector: istio: ingressgateway)        │  │
│  │ Port 80 → api.minibob.local              │  │
│  │ Port 80 → dashboard.minibob.local        │  │
│  └──────────────────────────────────────────┘  │
│          ↓                           ↓          │
│   ┌─────────────┐          ┌─────────────────┐ │
│   │ API         │          │ Dashboard       │ │
│   │ Port 8080   │←─────────│ Port 3000       │ │
│   │ (2 replicas)│          │ (1 replica)     │ │
│   └─────────────┘          └─────────────────┘ │
│          │                                      │
│          ├─→ ┌──────────────┐                   │
│          │   │ Valkey       │                   │
│          │   │ Port 6379    │                   │
│          │   │ (cache)      │                   │
│          │   └──────────────┘                   │
│          │                                      │
│          └─→ ┌──────────────┐                   │
│              │ SurrealDB    │                   │
│              │ Port 8000    │                   │
│              │ (database)   │                   │
│              └──────────────┘                   │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ MiniBob Agent (1 replica)                │  │
│  │ Port 8080                                │  │
│  │                                          │  │
│  │ - Polls activity-api every 30s (boredom)│  │
│  │ - Loads impulses by relevance           │  │
│  │ - Executes with Claude (Anthropic API)  │  │
│  │ - Stores execution traces in SurrealDB  │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
         │
         └─→ Anthropic API (external)
             (ANTHROPIC_API_KEY)
```

---

## Configuration Reference

### Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `ANTHROPIC_API_KEY` | — | YES | Anthropic API key for LLM calls |
| `SURREALDB_USERNAME` | `root` | NO | Database username |
| `SURREALDB_PASSWORD` | `surrealdb-local-dev-123` | NO | Database password |
| `LLM_PROVIDER` | `anthropic` | NO | LLM provider name |
| `LLM_MODEL` | `claude-sonnet-4-20250514` | NO | LLM model to use |

### Component Replicas

| Component | Default | Configurable |
|-----------|---------|--------------|
| Valkey | 1 (standalone) | Edit values.architecture |
| SurrealDB | 1 | Edit values.persistence |
| API | 2 | Edit values.replicaCount |
| MiniBob | 1 | Edit values.replicaCount |
| Dashboard | 1 | Edit values.replicaCount |

### Resource Limits

Default values in `helm/activity-system-minimal.yaml`:

- **API**: 1000m CPU, 1Gi memory
- **MiniBob**: 2000m CPU, 4Gi memory
- **Dashboard**: 500m CPU, 512Mi memory
- **Valkey**: 500m CPU, 512Mi memory (cache layer)
- **SurrealDB**: 1000m CPU, 2Gi memory

---

## Support & Debugging

### Generate Diagnostic Bundle

```bash
mkdir -p diagnostic
kubectl -n activity-system get all > diagnostic/resources.txt
kubectl -n activity-system get secrets > diagnostic/secrets.txt
kubectl -n activity-system get configmaps > diagnostic/configmaps.txt
kubectl -n activity-system logs -l app=minibob > diagnostic/minibob.log 2>&1
kubectl -n activity-system logs -l app=metabob-activity-api > diagnostic/api.log 2>&1
kubectl -n activity-system logs -l app=activity-dashboard > diagnostic/dashboard.log 2>&1
tar -czf diagnostic.tar.gz diagnostic/
```

### Check MiniBob Boredom Configuration

```bash
# View annotations that control boredom behavior
kubectl -n activity-system get pod -l app=minibob \
  -o jsonpath='{.items[0].metadata.annotations}' | jq . | grep -i boredom
```

Expected output:
```json
{
  "minibob.metabob.com/boredom-enabled": "true",
  "minibob.metabob.com/boredom-poll-interval": "30000",
  "minibob.metabob.com/boredom-idle-threshold": "60000",
  "minibob.metabob.com/capabilities": "activities,impulses,git,boredom,learning"
}
```

---

## Next Steps

1. **Monitor first deployment**: Watch logs as services come online
2. **Verify connectivity**: Test API and dashboard endpoints
3. **Execute test activities**: Create boredom activity from dashboard
4. **Review traces**: Check execution traces in SurrealDB
5. **Scale up**: Increase replicas for production use

---

**Last Updated**: March 21, 2026
**Configuration File**: `helm/activity-system-minimal.yaml`
