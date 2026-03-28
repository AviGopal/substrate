# Deploy Activity Dashboard + API to Docker Desktop Kubernetes

This guide deploys the Activity Dashboard and Activity API to Docker Desktop with Istio service mesh.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Docker Desktop Kubernetes                │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Istio Ingress Gateway                     │  │
│  │  dashboard.minibob.local → activity-dashboard:3000    │  │
│  │  api.minibob.local → metabob-activity-api:8080        │  │
│  └────────────────────────────────────────────────────────┘  │
│                      ↓              ↓                        │
│  ┌────────────────────────┐  ┌────────────────────────┐      │
│  │  activity-dashboard    │  │  metabob-activity-api  │      │
│  │  (React + Bun)         │  │  (Bun + Hono)          │      │
│  │  Port: 3000            │  │  Port: 8080            │      │
│  └────────────┬───────────┘  └───────┬────────────────┘      │
│               │                      │                        │
│               └──────────────────────┘                        │
│                          ↓                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Infrastructure                            │  │
│  │  ┌─────────────────┐   ┌─────────────────┐            │  │
│  │  │   SurrealDB     │   │     Redis       │            │  │
│  │  │   (Database)    │   │     (Cache)     │            │  │
│  │  │   Port: 8000    │   │   Port: 6379    │            │  │
│  │  └─────────────────┘   └─────────────────┘            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Namespace: activity-system                                  │
│  Istio Sidecar Injection: Enabled                            │
└──────────────────────────────────────────────────────────────┘
```

## Prerequisites

### 1. Docker Desktop with Kubernetes
```bash
# Enable Kubernetes in Docker Desktop settings
# Verify kubectl is connected
kubectl config current-context
# Should show: docker-desktop
```

### 2. Install Istio
```bash
# Download Istio (if not installed)
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=$PWD/bin:$PATH

# Install Istio with demo profile
istioctl install --set profile=demo -y

# Verify installation
kubectl get pods -n istio-system
```

### 3. Add Local DNS Entries
```bash
# Add to /etc/hosts (macOS/Linux)
echo "127.0.0.1  dashboard.minibob.local api.minibob.local" | sudo tee -a /etc/hosts

# Or manually edit /etc/hosts:
# 127.0.0.1  dashboard.minibob.local api.minibob.local
```

### 4. Build Docker Images
```bash
# Build activity-api image
cd repos/metabob-activity-api
docker build -t metabob-activity-api:latest .

# Build activity-dashboard image
cd ../activity-dashboard
docker build -t activity-dashboard:latest .

# Verify images
docker images | grep -E "activity-dashboard|metabob-activity-api"
```

## Deployment Steps

### Step 1: Enable Istio Injection
```bash
kubectl label namespace activity-system istio-injection=enabled --overwrite
kubectl get namespace activity-system --show-labels
```

### Step 2: Deploy Infrastructure + Applications
```bash
cd helm
helmfile -f helmfile-activity-dashboard-istio.yaml apply
```

This deploys:
- Redis (caching layer)
- SurrealDB (activity storage database)
- metabob-activity-api (backend API)
- activity-dashboard (frontend UI)

### Step 3: Deploy Istio Gateway and VirtualServices
```bash
kubectl apply -f ../kubernetes/istio-activity-system.yaml
```

This creates:
- Gateway: Routes HTTP traffic for *.minibob.local
- VirtualService: dashboard.minibob.local → activity-dashboard
- VirtualService: api.minibob.local → metabob-activity-api
- DestinationRules: Traffic policies

### Step 4: Get Istio Ingress Gateway External IP
```bash
export INGRESS_HOST=$(kubectl -n istio-system get service istio-ingressgateway \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "Istio Ingress: $INGRESS_HOST"
# For Docker Desktop, this should be 127.0.0.1 or localhost
```

### Step 5: Verify Deployment
```bash
# Check all pods are running
kubectl get pods -n activity-system

# Expected output:
# NAME                                      READY   STATUS    RESTARTS   AGE
# activity-dashboard-xxxxxxxxx-xxxxx       2/2     Running   0          2m
# metabob-activity-api-xxxxxxxxx-xxxxx     2/2     Running   0          2m
# redis-master-0                            2/2     Running   0          2m
# surrealdb-xxxxxxxxx-xxxxx                2/2     Running   0          2m

# Note: Each pod has 2 containers (app + istio-proxy sidecar)
```

### Step 6: Test Connectivity
```bash
# Test API health
curl http://api.minibob.local/health

# Expected: {"status":"ok","timestamp":...}

# Test Dashboard (returns HTML)
curl -I http://dashboard.minibob.local

# Expected: HTTP/1.1 200 OK
```

## Access Applications

### Dashboard
Open in browser: http://dashboard.minibob.local

Features:
- View activity templates
- Monitor executions
- Inspect task details
- Real-time WebSocket updates

### API
Access at: http://api.minibob.local

Endpoints:
- `GET /health` - Health check
- `GET /api/templates` - List templates
- `GET /api/executions` - List executions
- `POST /api/templates` - Create template
- `POST /api/executions` - Start execution

## Monitoring & Debugging

### View Logs
```bash
# Dashboard logs
kubectl logs -n activity-system -l app=activity-dashboard -c activity-dashboard -f

# API logs
kubectl logs -n activity-system -l app=metabob-activity-api -c metabob-activity-api -f

# Istio sidecar logs
kubectl logs -n activity-system -l app=activity-dashboard -c istio-proxy -f
```

### Check Istio Configuration
```bash
# List all VirtualServices
kubectl get virtualservices -n activity-system

# Describe VirtualService
kubectl describe virtualservice activity-dashboard -n activity-system

# Check Gateway
kubectl get gateway -n activity-system
kubectl describe gateway activity-system-gateway -n activity-system
```

### Debug Istio Routing
```bash
# Get Istio proxy config for dashboard
kubectl exec -n activity-system deploy/activity-dashboard -c istio-proxy -- \
  pilot-agent request GET config_dump | jq '.configs'

# Check if route is registered
kubectl exec -n activity-system deploy/activity-dashboard -c istio-proxy -- \
  pilot-agent request GET clusters | grep activity-dashboard
```

### Port Forward (Bypass Istio)
```bash
# Access dashboard directly
kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000
# Open: http://localhost:3000

# Access API directly
kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080
# Test: curl http://localhost:8080/health
```

## Troubleshooting

### Issue: Pods not starting
```bash
# Check pod status
kubectl get pods -n activity-system

# Describe pod for events
kubectl describe pod -n activity-system <pod-name>

# Check container logs
kubectl logs -n activity-system <pod-name> -c <container-name>
```

### Issue: Dashboard can't connect to API
```bash
# Verify API is accessible from dashboard pod
kubectl exec -n activity-system deploy/activity-dashboard -c activity-dashboard -- \
  curl http://metabob-activity-api.activity-system.svc.cluster.local:8080/health

# Check network policies
kubectl get networkpolicies -n activity-system
```

### Issue: DNS not resolving
```bash
# Verify /etc/hosts entry
cat /etc/hosts | grep minibob.local

# Flush DNS cache (macOS)
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

# Test DNS resolution
nslookup dashboard.minibob.local
# Should resolve to 127.0.0.1
```

### Issue: Istio Gateway not routing
```bash
# Check Gateway status
kubectl get gateway -n activity-system activity-system-gateway -o yaml

# Verify Istio ingress gateway is running
kubectl get pods -n istio-system -l istio=ingressgateway

# Check ingress gateway service
kubectl get svc -n istio-system istio-ingressgateway
```

## Clean Up

### Remove All Resources
```bash
# Delete all activity-system resources
helmfile -f helm/helmfile-activity-dashboard-istio.yaml destroy

# Delete Istio Gateway and VirtualServices
kubectl delete -f kubernetes/istio-activity-system.yaml

# Delete namespace (if needed)
kubectl delete namespace activity-system
```

### Uninstall Istio (Optional)
```bash
istioctl uninstall --purge -y
kubectl delete namespace istio-system
```

## Configuration Files

- **Helmfile**: `helm/helmfile-activity-dashboard-istio.yaml`
- **Istio Config**: `kubernetes/istio-activity-system.yaml`
- **Dashboard Helm**: `repos/activity-dashboard/helm/activity-dashboard/`
- **API Helm**: `helm/charts/metabob-activity-api/`

## Next Steps

1. ✅ Deploy to Docker Desktop (this guide)
2. Configure activity templates
3. Test activity execution flow
4. Set up monitoring (Prometheus + Grafana)
5. Add authentication/authorization
6. Deploy to production cluster

---

**Status**: Ready for deployment
**Last Updated**: 2026-03-18
