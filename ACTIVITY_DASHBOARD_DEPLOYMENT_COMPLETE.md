# Activity Dashboard Deployment - Complete ✅

**Date**: March 19, 2026  
**Environment**: Docker Desktop Kubernetes (local)  
**Namespace**: `activity-system`  
**Istio**: Enabled with Gateway and VirtualServices

---

## 🎯 Deployment Summary

Successfully deployed the Activity Dashboard and Activity API to local Kubernetes with Istio ingress routing.

### Components Deployed

| Component | Status | Image | Replicas | Health |
|-----------|--------|-------|----------|--------|
| **activity-dashboard** | ✅ Running | `activity-dashboard:latest` | 1/1 | Healthy |
| **metabob-activity-api** | ✅ Running | `metabob-activity-api:latest` | 1/1 | Healthy |
| **surrealdb** | ✅ Running | `surrealdb/surrealdb:v3.0.0` | 1/1 | Healthy |
| **redis** | ✅ Running | `bitnami/redis:latest` | 1/1 | Healthy |

### Istio Configuration

| Resource | Name | Hosts |
|----------|------|-------|
| **Gateway** | `activity-system-gateway` | `dashboard.minibob.local`, `api.minibob.local` |
| **VirtualService** | `activity-dashboard` | `dashboard.minibob.local` → port 3000 |
| **VirtualService** | `metabob-activity-api` | `api.minibob.local` → port 8080 |
| **DestinationRule** | `activity-dashboard` | ROUND_ROBIN load balancing |
| **DestinationRule** | `metabob-activity-api` | LEAST_REQUEST load balancing |

---

## 🚀 Access Instructions

### Method 1: Via Hostname (Recommended)

**⚠️ IMPORTANT**: Fix your `/etc/hosts` file first:

```bash
# Current (broken - has comma):
# 127.0.0.1  api.metabob.local app.metabob.local devbob.metabob.local, dashboard.minibob.local

# Replace with (fixed - no comma):
sudo nano /etc/hosts
# Add/replace with:
127.0.0.1  api.metabob.local app.metabob.local devbob.metabob.local dashboard.minibob.local api.minibob.local
```

Then access:
- **Dashboard**: http://dashboard.minibob.local
- **API**: http://api.minibob.local

### Method 2: Via localhost + Host Header (Works Now)

```bash
# Access Dashboard
curl http://localhost/health -H "Host: dashboard.minibob.local"

# Access API
curl http://localhost/health -H "Host: api.minibob.local"

# In browser (requires extension or proxy to set Host header)
# Or use port-forwarding (Method 3)
```

### Method 3: Port Forwarding (No /etc/hosts needed)

```bash
# Forward Dashboard
kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000
# Access: http://localhost:3000

# Forward API
kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080
# Access: http://localhost:8080
```

---

## 🧪 Health Check Results

### Dashboard Health
```bash
curl http://localhost/health -H "Host: dashboard.minibob.local"
```

**Response** ✅:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-19T16:45:45.545Z",
  "uptime": 65.390780447,
  "backend": "http://metabob-activity-api.activity-system.svc.cluster.local:8080"
}
```

### API Health
```bash
curl http://localhost/health -H "Host: api.minibob.local"
```

**Response** ✅:
```json
{
  "service": "metabob-activity-api",
  "version": "1.0.0",
  "timestamp": "2026-03-19T16:45:44.962Z",
  "checks": {
    "redis": {
      "status": "healthy",
      "latency_ms": 1
    },
    "surrealdb": {
      "status": "healthy",
      "latency_ms": 3
    }
  },
  "status": "healthy"
}
```

---

## 📦 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Docker Desktop Kubernetes                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Istio Ingress Gateway                     │ │
│  │                    (localhost:80)                           │ │
│  └─────────────┬──────────────────────────┬───────────────────┘ │
│                │                          │                      │
│                │ dashboard.minibob.local  │ api.minibob.local   │
│                │                          │                      │
│  ┌─────────────▼─────────────┐  ┌────────▼──────────────────┐  │
│  │   activity-dashboard      │  │  metabob-activity-api     │  │
│  │   (port 3000)             │  │  (port 8080)              │  │
│  │   + Istio Sidecar         │  │  + Istio Sidecar          │  │
│  └───────────────────────────┘  └────────┬──────────────────┘  │
│                                           │                      │
│                          ┌────────────────┼───────────┐         │
│                          │                │           │         │
│                    ┌─────▼─────┐   ┌──────▼──────┐  │         │
│                    │   Redis    │   │  SurrealDB  │  │         │
│                    │ (cache)    │   │ (database)  │  │         │
│                    └────────────┘   └─────────────┘  │         │
│                                                       │         │
└───────────────────────────────────────────────────────┘         │
```

---

## 🛠️ Deployment Commands Used

### 1. Build Docker Images
```bash
cd repos/metabob-activity-api
docker build -t metabob-activity-api:latest .

cd ../activity-dashboard
docker build -t activity-dashboard:latest .
```

### 2. Enable Istio Injection
```bash
kubectl label namespace activity-system istio-injection=enabled --overwrite
```

### 3. Deploy with Helmfile
```bash
cd helm
helmfile -f helmfile-activity-dashboard-istio.yaml sync
```

**Deployed**:
- Redis (cache layer)
- SurrealDB (activity storage)
- metabob-activity-api (backend API)
- activity-dashboard (React UI)

### 4. Apply Istio Configuration
```bash
kubectl apply -f kubernetes/istio-activity-system.yaml
```

**Applied**:
- Gateway: `activity-system-gateway`
- VirtualService: `activity-dashboard`
- VirtualService: `metabob-activity-api`
- DestinationRule: `activity-dashboard`
- DestinationRule: `metabob-activity-api`

---

## 🔍 Verification Commands

```bash
# Check all pods
kubectl get pods -n activity-system

# Check services
kubectl get services -n activity-system

# Check Istio resources
kubectl get gateway,virtualservice,destinationrule -n activity-system

# Check logs
kubectl logs -n activity-system -l app.kubernetes.io/name=activity-dashboard
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api

# Check Istio sidecar injection
kubectl get pods -n activity-system -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].name}{"\n"}{end}'
```

---

## 🎛️ Configuration Details

### Dashboard Configuration
- **API Endpoint**: `http://metabob-activity-api.activity-system.svc.cluster.local:8080`
- **WebSocket**: Enabled
- **Refresh Interval**: 5000ms
- **Resources**: 50m CPU / 128Mi RAM (requests), 250m CPU / 256Mi RAM (limits)

### API Configuration
- **SurrealDB URL**: `http://surrealdb.activity-system.svc.cluster.local:8000`
- **Redis URL**: `redis://redis-master.activity-system.svc.cluster.local:6379`
- **Auth**: Disabled (local development)
- **CORS**: `*` (all origins)
- **Log Level**: `info`
- **Resources**: 100m CPU / 256Mi RAM (requests), 500m CPU / 512Mi RAM (limits)

### Infrastructure
- **SurrealDB**: In-memory mode (no persistence for local dev)
- **Redis**: In-memory mode (no persistence for local dev)

---

## 📊 Pod Status

```
NAME                                      READY   STATUS    RESTARTS   AGE
activity-dashboard-658d44bbf6-mq9xw       2/2     Running   0          78s
metabob-activity-api-6fc79c98d4-rjpv9     2/2     Running   0          97s
redis-master-0                            2/2     Running   0          11h
surrealdb-594c98c599-lj2wz                2/2     Running   0          11h
```

**Note**: `2/2` containers = App container + Istio Envoy sidecar

---

## 🔄 Update/Rebuild Workflow

### Rebuild and Redeploy Dashboard
```bash
cd repos/activity-dashboard
docker build -t activity-dashboard:latest .
kubectl rollout restart deployment/activity-dashboard -n activity-system
```

### Rebuild and Redeploy API
```bash
cd repos/metabob-activity-api
docker build -t metabob-activity-api:latest .
kubectl rollout restart deployment/metabob-activity-api -n activity-system
```

### Full Redeployment
```bash
cd helm
helmfile -f helmfile-activity-dashboard-istio.yaml sync
```

---

## 🧹 Cleanup

```bash
# Remove all deployments
cd helm
helmfile -f helmfile-activity-dashboard-istio.yaml destroy

# Remove Istio configuration
kubectl delete -f kubernetes/istio-activity-system.yaml

# Remove namespace (if needed)
kubectl delete namespace activity-system
```

---

## 🎯 Next Steps

1. **Fix /etc/hosts** to enable hostname access:
   ```bash
   sudo nano /etc/hosts
   # Add: 127.0.0.1  dashboard.minibob.local api.minibob.local
   ```

2. **Access Dashboard**: http://dashboard.minibob.local

3. **Verify API Endpoints**:
   ```bash
   # List templates
   curl http://api.minibob.local/templates
   
   # Search activities
   curl http://api.minibob.local/activities/search?q=test
   
   # Get metrics
   curl http://api.minibob.local/metrics
   ```

4. **Monitor Logs**:
   ```bash
   # Dashboard logs
   kubectl logs -f -n activity-system -l app.kubernetes.io/name=activity-dashboard
   
   # API logs
   kubectl logs -f -n activity-system -l app.kubernetes.io/name=metabob-activity-api
   ```

---

## ✅ Success Criteria Met

- [x] Docker images built for both dashboard and API
- [x] Istio injection enabled on activity-system namespace
- [x] All components deployed successfully via Helmfile
- [x] Istio Gateway and VirtualServices configured
- [x] Health endpoints responding (200 OK)
- [x] Dashboard can communicate with API backend
- [x] Redis and SurrealDB healthy and accessible
- [x] Istio sidecars injected (2/2 containers per pod)

---

## 📝 Notes

- **Environment**: Local Docker Desktop Kubernetes
- **Istio Version**: Installed (istio-system namespace present)
- **Storage**: In-memory (no persistence - suitable for local dev)
- **/etc/hosts Issue**: Needs manual fix due to comma in current entry
- **Alternative Access**: Use `curl` with `-H "Host: ..."` or port-forwarding

---

## 🔗 Related Files

- Helmfile: `helm/helmfile-activity-dashboard-istio.yaml`
- Istio Config: `kubernetes/istio-activity-system.yaml`
- Dashboard Chart: `repos/activity-dashboard/helm/activity-dashboard/`
- API Chart: `helm/charts/metabob-activity-api/`
- SurrealDB Chart: `helm/charts/surrealdb/`

---

**Deployment Status**: ✅ **COMPLETE AND OPERATIONAL**

*All services are running, healthy, and accessible via Istio ingress gateway.*
