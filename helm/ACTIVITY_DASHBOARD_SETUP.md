# Activity Dashboard + API Setup Complete

## ✅ Deployment Status

All components have been successfully deployed to Docker Desktop Kubernetes:

- **Redis**: Cache layer for activity-api ✓
- **SurrealDB**: Activity storage database ✓
- **Activity API**: Backend API service ✓
- **Activity Dashboard**: Frontend UI service ✓
- **Istio Gateway**: Traffic routing configured ✓

## 🌐 Access URLs

Once /etc/hosts is configured (see below):

- **Dashboard UI**: http://dashboard.minibob.local
- **Activity API**: http://api.minibob.local

## 📋 Setup Steps

### 1. Fix /etc/hosts Entry

Your current /etc/hosts has a syntax error (commas instead of spaces). Fix it:

```bash
# Current (incorrect):
127.0.0.1  api.metabob.local app.metabob.local devbob.metabob.local, dashboard.minibob.local, api.minibob.local

# Should be (correct):
127.0.0.1  api.metabob.local app.metabob.local devbob.metabob.local dashboard.minibob.local api.minibob.local
```

Edit with:
```bash
sudo nano /etc/hosts
```

Or run this fix command:
```bash
sudo sed -i 's/, dashboard.minibob.local, api.minibob.local/ dashboard.minibob.local api.minibob.local/' /etc/hosts
```

### 2. Verify Services

```bash
# Check pods are running
kubectl get pods -n activity-system

# Check services
kubectl get svc -n activity-system

# Test health endpoints
curl http://api.minibob.local/health
curl http://dashboard.minibob.local/health
```

### 3. Access Dashboard

Open in browser:
```
http://dashboard.minibob.local
```

## 🔧 Deployment Commands

### Build Images

```bash
# Build dashboard
cd repos/activity-dashboard
docker build -t activity-dashboard:latest .

# Build API
cd repos/metabob-activity-api
docker build -t metabob-activity-api:latest .
```

### Deploy with Helmfile

```bash
cd helm
helmfile -f helmfile-activity-dashboard-istio.yaml sync
```

### Apply Istio Configuration

```bash
kubectl apply -f kubernetes/istio-activity-dashboard.yaml
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         Istio Ingress Gateway           │
│            (localhost:80)               │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌─────────────┐     ┌──────────────┐
│  dashboard  │     │  api         │
│  .minibob   │────▶│  .minibob    │
│  .local     │     │  .local      │
│             │     │              │
│  :3000      │     │  :8080       │
└─────────────┘     └──────┬───────┘
                           │
                    ┌──────┴──────┐
                    │             │
                    ▼             ▼
            ┌──────────┐   ┌──────────┐
            │ SurrealDB│   │  Redis   │
            │  :8000   │   │  :6379   │
            └──────────┘   └──────────┘
```

## 📦 Components

### Activity Dashboard
- **Image**: activity-dashboard:latest
- **Port**: 3000
- **Namespace**: activity-system
- **URL**: http://dashboard.minibob.local
- **Features**:
  - Real-time activity monitoring
  - Template library browser
  - Learning system metrics
  - WebSocket support for live updates

### Activity API
- **Image**: metabob-activity-api:latest
- **Port**: 8080
- **Namespace**: activity-system
- **URL**: http://api.minibob.local
- **Features**:
  - REST API for activity management
  - Template storage and retrieval
  - Execution history tracking
  - Thompson sampling optimization

### Infrastructure
- **Redis**: Caching layer (bitnami/redis:20.5.0)
- **SurrealDB**: Primary database (surrealdb:v3.0.0)
- **Istio**: Service mesh and ingress

## 🐛 Troubleshooting

### Pods not starting
```bash
kubectl describe pod -n activity-system <pod-name>
kubectl logs -n activity-system <pod-name> -c activity-dashboard
kubectl logs -n activity-system <pod-name> -c istio-proxy
```

### DNS not resolving
```bash
# Check /etc/hosts
cat /etc/hosts | grep minibob

# Fix syntax (remove commas)
sudo nano /etc/hosts
```

### Istio issues
```bash
# Check Istio gateway
kubectl get gateway -n activity-system

# Check virtual services
kubectl get virtualservice -n activity-system

# Check ingress gateway
kubectl get svc -n istio-system istio-ingressgateway
```

### Dashboard not loading
```bash
# Check pod logs
kubectl logs -n activity-system -l app.kubernetes.io/name=activity-dashboard

# Check API connectivity
kubectl exec -n activity-system -it <dashboard-pod> -- curl http://metabob-activity-api:8080/health
```

## 🔄 Rebuild and Redeploy

```bash
# Rebuild images
cd repos/activity-dashboard && docker build -t activity-dashboard:latest .
cd repos/metabob-activity-api && docker build -t metabob-activity-api:latest .

# Force pod restart
kubectl rollout restart deployment -n activity-system activity-dashboard
kubectl rollout restart deployment -n activity-system metabob-activity-api

# Or redeploy with helmfile
cd helm
helmfile -f helmfile-activity-dashboard-istio.yaml sync
```

## 📊 Monitoring

```bash
# Watch pods
kubectl get pods -n activity-system -w

# Stream dashboard logs
kubectl logs -n activity-system -l app.kubernetes.io/name=activity-dashboard -f

# Stream API logs
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f

# Check Istio metrics
kubectl top pods -n activity-system
```

## 🗑️ Cleanup

```bash
# Remove deployment
cd helm
helmfile -f helmfile-activity-dashboard-istio.yaml destroy

# Remove Istio resources
kubectl delete -f kubernetes/istio-activity-dashboard.yaml

# Remove namespace (optional)
kubectl delete namespace activity-system
```

## 📝 Next Steps

1. **Fix /etc/hosts** - Remove commas, use spaces
2. **Access dashboard** - http://dashboard.minibob.local
3. **Test API** - http://api.minibob.local/health
4. **Monitor logs** - Watch pod logs for any issues
5. **Configure integrations** - Connect dashboard to your activity workflows

## 🎯 Configuration

All configuration is managed through Helm values in:
- `helm/helmfile-activity-dashboard-istio.yaml` - Main deployment config
- `repos/activity-dashboard/helm/activity-dashboard/values.yaml` - Dashboard defaults
- `helm/charts/metabob-activity-api/values.yaml` - API defaults
- `kubernetes/istio-activity-dashboard.yaml` - Istio routing

Happy coding! 🚀
