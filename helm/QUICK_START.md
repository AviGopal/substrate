# Activity Dashboard + API - Quick Start Guide

## 🎉 Your Setup is LIVE!

Everything is already deployed and running on Docker Desktop Kubernetes!

## 🌐 Access URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Dashboard** | http://dashboard.minibob.local | Main UI for activity monitoring |
| **API** | http://api.minibob.local | REST API for activity system |
| **Health Check** | http://api.minibob.local/health | API health status |

## 🚀 Quick Commands

### View Everything
```bash
# Check deployment status
cd helm && ./verify-deployment.sh

# Watch pods
kubectl get pods -n activity-system -w

# View all services
kubectl get all -n activity-system
```

### View Logs
```bash
# Dashboard logs (real-time)
kubectl logs -n activity-system -l app.kubernetes.io/name=activity-dashboard -f

# API logs (real-time)
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f

# All logs together
kubectl logs -n activity-system --all-containers=true -f
```

### Restart Services
```bash
# Restart dashboard
kubectl rollout restart deployment -n activity-system activity-dashboard

# Restart API
kubectl rollout restart deployment -n activity-system metabob-activity-api

# Watch restart progress
kubectl rollout status deployment -n activity-system activity-dashboard
kubectl rollout status deployment -n activity-system metabob-activity-api
```

### Rebuild and Deploy
```bash
# Rebuild dashboard image
cd repos/activity-dashboard
docker build -t activity-dashboard:latest .
kubectl rollout restart deployment -n activity-system activity-dashboard

# Rebuild API image
cd repos/metabob-activity-api
docker build -t metabob-activity-api:latest .
kubectl rollout restart deployment -n activity-system metabob-activity-api
```

### Redeploy Everything
```bash
# Full redeployment with helmfile
cd helm
helmfile -f helmfile-activity-dashboard-istio.yaml sync
```

## 🧪 Test API

```bash
# Health check
curl http://api.minibob.local/health

# List templates (example endpoint)
curl http://api.minibob.local/api/v1/templates

# Check activities (example endpoint)
curl http://api.minibob.local/api/v1/activities
```

## 🐛 Troubleshooting

### Dashboard not loading?
```bash
# 1. Check pod status
kubectl get pods -n activity-system

# 2. Check logs
kubectl logs -n activity-system -l app.kubernetes.io/name=activity-dashboard

# 3. Check service
kubectl describe svc -n activity-system activity-dashboard

# 4. Test internal connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://activity-dashboard.activity-system.svc.cluster.local:3000
```

### API not responding?
```bash
# 1. Check pod status
kubectl get pods -n activity-system -l app.kubernetes.io/name=metabob-activity-api

# 2. Check logs
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api

# 3. Check database
kubectl logs -n activity-system -l app.kubernetes.io/name=surrealdb

# 4. Check Redis
kubectl logs -n activity-system redis-master-0
```

### DNS not working?
```bash
# 1. Check /etc/hosts
cat /etc/hosts | grep minibob.local

# 2. Test DNS resolution
ping -c 1 dashboard.minibob.local
ping -c 1 api.minibob.local

# 3. Check Istio gateway
kubectl get svc -n istio-system istio-ingressgateway
```

## 📊 Architecture

```
Browser
   │
   ├─→ http://dashboard.minibob.local ──┐
   │                                     │
   └─→ http://api.minibob.local ────────┤
                                         │
                                         ▼
                              ┌──────────────────┐
                              │ Istio Gateway    │
                              │ (localhost:80)   │
                              └────────┬─────────┘
                                       │
                       ┌───────────────┴───────────────┐
                       │                               │
                       ▼                               ▼
            ┌─────────────────┐            ┌─────────────────┐
            │   Dashboard     │            │   API           │
            │   (React)       │───────────→│   (Rust)        │
            │   Port 3000     │            │   Port 8080     │
            └─────────────────┘            └────────┬────────┘
                                                    │
                                           ┌────────┴────────┐
                                           │                 │
                                           ▼                 ▼
                                    ┌──────────┐      ┌──────────┐
                                    │SurrealDB │      │  Redis   │
                                    │ :8000    │      │  :6379   │
                                    └──────────┘      └──────────┘
```

## 📦 Components

| Component | Image | Port | Purpose |
|-----------|-------|------|---------|
| Dashboard | activity-dashboard:latest | 3000 | React UI |
| API | metabob-activity-api:latest | 8080 | REST API |
| SurrealDB | surrealdb/surrealdb:v3.0.0 | 8000 | Database |
| Redis | bitnami/redis:20.5.0 | 6379 | Cache |

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `helm/helmfile-activity-dashboard-istio.yaml` | Main deployment config |
| `kubernetes/istio-activity-system.yaml` | Istio routing rules |
| `repos/activity-dashboard/helm/activity-dashboard/` | Dashboard Helm chart |
| `helm/charts/metabob-activity-api/` | API Helm chart |

## 📝 Common Tasks

### Update Dashboard Code
```bash
cd repos/activity-dashboard
# Make your changes...
docker build -t activity-dashboard:latest .
kubectl rollout restart deployment -n activity-system activity-dashboard
```

### Update API Code
```bash
cd repos/metabob-activity-api
# Make your changes...
docker build -t metabob-activity-api:latest .
kubectl rollout restart deployment -n activity-system metabob-activity-api
```

### Change Configuration
```bash
# Edit helmfile values
vim helm/helmfile-activity-dashboard-istio.yaml

# Apply changes
cd helm
helmfile -f helmfile-activity-dashboard-istio.yaml sync
```

### Scale Services
```bash
# Scale dashboard to 2 replicas
kubectl scale deployment -n activity-system activity-dashboard --replicas=2

# Scale API to 3 replicas
kubectl scale deployment -n activity-system metabob-activity-api --replicas=3
```

## 🎯 Next Steps

1. **Open Dashboard**: http://dashboard.minibob.local
2. **Explore API**: http://api.minibob.local
3. **Monitor Logs**: `kubectl logs -n activity-system -f --all-containers=true`
4. **Start Building**: Integrate with your workflows

## 🗑️ Cleanup

```bash
# Remove deployment (keeps namespace)
cd helm
helmfile -f helmfile-activity-dashboard-istio.yaml destroy

# Remove Istio config
kubectl delete -f kubernetes/istio-activity-system.yaml

# Remove everything (including namespace)
kubectl delete namespace activity-system
```

## 📚 Documentation

- Full Status: `helm/DEPLOYMENT_STATUS.md`
- Setup Guide: `helm/ACTIVITY_DASHBOARD_SETUP.md`
- Verification: `helm/verify-deployment.sh`

---

**Status**: ✅ **READY TO USE**  
**Dashboard**: http://dashboard.minibob.local  
**API**: http://api.minibob.local  
**Namespace**: activity-system  
**Context**: docker-desktop
