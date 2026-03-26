# Activity System - Development Setup Guide

Complete guide for setting up local development environment with MiniBob, Activity API, and Dashboard.

## Overview

This setup enables:
- **Local domain access**: `dashboard.minibob.local`, `api.minibob.local`
- **Hot-reload development**: Edit code locally, see changes in cluster pods
- **MiniBob as dev agent**: Use MiniBob to develop itself and other vessels
- **Full observability**: Dashboard monitors all activity execution
- **Git integration**: All vessels pushed to separate GitHub repositories

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  Local Development Machine                             │
├────────────────────────────────────────────────────────┤
│                                                         │
│  Browser                 Code Editor                   │
│     ↓                        ↓                         │
│  dashboard.minibob.local   repos/*/src (live editing)  │
│  api.minibob.local            ↓                        │
│     ↓                    Volume Mounts                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Docker Desktop Kubernetes (activity-dev ns)    │   │
│  ├─────────────────────────────────────────────────┤   │
│  │                                                  │   │
│  │  ┌──────────────┐   ┌──────────────┐            │   │
│  │  │  Dashboard   │◄──│  Activity    │            │   │
│  │  │  (Bun dev)   │   │  API (Bun)   │            │   │
│  │  └──────────────┘   └──────┬───────┘            │   │
│  │                             │                    │   │
│  │         ┌───────────────────┴───────┐            │   │
│  │         │                           │            │   │
│  │    ┌────▼────┐               ┌─────▼──────┐     │   │
│  │    │ Redis   │               │ SurrealDB  │     │   │
│  │    │         │               │    3.x     │     │   │
│  │    └─────────┘               └────┬───────┘     │   │
│  │                                   │             │   │
│  │                            ┌──────▼───────┐     │   │
│  │                            │   MiniBob    │     │   │
│  │                            │ (dev agent)  │     │   │
│  │                            └──────────────┘     │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### 1. System Requirements
- Docker Desktop with Kubernetes enabled
- Bun v1.3.10+ installed
- kubectl configured for docker-desktop context
- Helm 3.x installed
- Helmfile installed
- Git configured with GitHub access

### 2. Environment Setup

```bash
# Verify prerequisites
docker --version       # Should be 20.x+
kubectl version        # Should connect to docker-desktop
helm version           # Should be v3.x
helmfile version       # Should be v0.x
bun --version          # Should be 1.3.10+

# Enable Kubernetes in Docker Desktop
# Settings → Kubernetes → Enable Kubernetes
```

### 3. Install NGINX Ingress Controller

```bash
# Install NGINX Ingress for local development
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer
```

### 4. Configure /etc/hosts

```bash
# Add local domain mappings
sudo bash -c 'cat >> /etc/hosts << EOF

# MiniBob Development Cluster
127.0.0.1  dashboard.minibob.local
127.0.0.1  api.minibob.local
127.0.0.1  minibob.minibob.local
EOF'

# Verify
cat /etc/hosts | grep minibob
```

---

## Repository Setup

### 1. Initialize Git Repositories

Each vessel needs its own GitHub repository:

```bash
# Navigate to metabob-devbob root
cd /path/to/metabob-devbob

# MiniBob
cd repos/minibob
git init
git remote add origin git@github.com:AviGopal/minibob.git

# Activity API
cd ../metabob-activity-api
git init
git remote add origin git@github.com:MetabobProject/metabob-activity-api.git

# Activity Dashboard
cd ../activity-dashboard
git init
git remote add origin git@github.com:MetabobProject/activity-dashboard.git

cd ../..
```

### 2. Create Initial Commits

```bash
# MiniBob
cd repos/minibob
git add .
git commit -m "Initial commit: MiniBob autonomous agent vessel"
git branch -M main
git push -u origin main

# Activity API
cd ../metabob-activity-api
git add .
git commit -m "Initial commit: TypeScript Activity System API with Thompson Sampling"
git branch -M main
git push -u origin main

# Activity Dashboard
cd ../activity-dashboard
git add .
git commit -m "Initial commit: Activity Dashboard observability UI"
git branch -M main
git push -u origin main

cd ../..
```

---

## Build Docker Images

### 1. Build All Vessel Images

```bash
# From metabob-devbob root

# Build MiniBob (dev tag for hot-reload)
docker build -t minibob:dev repos/minibob

# Build Activity API (dev tag for hot-reload)
docker build -t metabob-activity-api:dev repos/metabob-activity-api

# Build Activity Dashboard (dev tag for hot-reload)
docker build -t activity-dashboard:dev repos/activity-dashboard

# Verify images
docker images | grep -E "minibob|activity"
```

### 2. Development Dockerfiles (Optional)

For true hot-reload, you may want development-specific Dockerfiles that run `bun --hot`:

**repos/activity-dashboard/Dockerfile.dev**:
```dockerfile
FROM oven/bun:1.3.10-alpine
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install
COPY . .
EXPOSE 3000
CMD ["bun", "--hot", "src/index.ts"]
```

Build with: `docker build -f Dockerfile.dev -t activity-dashboard:dev .`

---

## Deploy Development Environment

### 1. Set Environment Variables

```bash
# Required: Anthropic API key for MiniBob
export ANTHROPIC_API_KEY="sk-ant-..."

# Optional: SurrealDB credentials (defaults provided)
export SURREALDB_USERNAME="root"
export SURREALDB_PASSWORD="surrealdb-dev-123"
```

### 2. Deploy with Helmfile

```bash
# From metabob-devbob root
helmfile -f helm/helmfile-activity-dev.yaml -e dev apply

# Monitor deployment
kubectl get pods -n activity-dev --watch

# Wait for all pods to be Running (Ctrl+C to stop watching)
```

### 3. Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n activity-dev

# Expected output:
# NAME                                      READY   STATUS    RESTARTS   AGE
# redis-master-0                            1/1     Running   0          2m
# surrealdb-...                             1/1     Running   0          2m
# metabob-activity-api-...                  1/1     Running   0          1m
# activity-dashboard-...                    1/1     Running   0          1m
# minibob-...                               1/1     Running   0          1m

# Check Ingress
kubectl get ingress -n activity-dev

# Expected output:
# NAME                     CLASS   HOSTS                      
# metabob-activity-api     nginx   api.minibob.local
# activity-dashboard       nginx   dashboard.minibob.local
```

### 4. Access Services

Open in browser:
- **Dashboard**: http://dashboard.minibob.local
- **API Health**: http://api.minibob.local/health
- **API Docs**: http://api.minibob.local/v2/activities/templates

You should see the dashboard UI (even if empty) and API responses.

---

## Development Workflow

### Scenario: Edit Dashboard Code

```bash
# 1. Open code in editor
code repos/activity-dashboard/src/App.tsx

# 2. Make changes to the file
# (The file is mounted into the pod via hostPath volume)

# 3. Bun's --hot flag detects changes and reloads
# Check logs:
kubectl logs -n activity-dev -l app.kubernetes.io/name=activity-dashboard -f

# 4. Refresh browser at http://dashboard.minibob.local
# Changes should be visible immediately
```

### Scenario: Edit Activity API Code

```bash
# 1. Edit API code
code repos/metabob-activity-api/src/routes/activities.ts

# 2. Bun auto-reloads the server
kubectl logs -n activity-dev -l app.kubernetes.io/name=metabob-activity-api -f

# 3. Test endpoint
curl http://api.minibob.local/v2/activities/templates
```

### Scenario: MiniBob Develops Itself

```bash
# 1. Create an activity template for "add feature to MiniBob"
# (Use activity-dashboard to create template or metabob-cli)

# 2. MiniBob picks up activity via boredom system
# Watch MiniBob logs:
kubectl logs -n activity-dev -l app.kubernetes.io/name=minibob -f

# 3. MiniBob executes activity, modifies code in repos/minibob/src
# 4. Changes appear in your local filesystem (volume mount)
# 5. Commit changes:
cd repos/minibob
git add .
git commit -m "Feature added by MiniBob"
git push
```

---

## Validation Steps

### 1. API Health Check

```bash
curl http://api.minibob.local/health

# Expected:
# {"status":"ok","service":"metabob-activity-api","version":"1.0.0",...}
```

### 2. List Templates

```bash
curl http://api.minibob.local/v2/activities/templates

# Expected:
# {"templates":[...],"total":...}
```

### 3. Dashboard Loads

```bash
# Open in browser
open http://dashboard.minibob.local

# Should see dashboard UI with:
# - Header with health indicator
# - Navigation tabs
# - Template list (if any templates exist)
```

### 4. MiniBob is Idle (Ready for Work)

```bash
kubectl logs -n activity-dev -l app.kubernetes.io/name=minibob --tail=50

# Should see:
# [Boredom] Checking for available activities...
# [Boredom] No activities found, staying idle
```

### 5. Hot-Reload Test

```bash
# Edit Dashboard
echo "console.log('Hot reload test');" >> repos/activity-dashboard/src/App.tsx

# Watch logs
kubectl logs -n activity-dev -l app.kubernetes.io/name=activity-dashboard -f

# Should see:
# [HMR] Reloading...
# [Bun] Compiled successfully

# Refresh browser, open console (F12), should see "Hot reload test"
```

---

## Running Your First Activity

### 1. Create a Simple Template

```bash
# Use metabob-cli or API to create template
# Example: "log-hello-world" template

cat > /tmp/hello-template.json << 'EOF'
{
  "name": "log-hello-world",
  "description": "Simple test activity that logs hello world",
  "category": "tool",
  "tasks": [
    {
      "id": "task-1",
      "subagent": "general",
      "description": "Log hello world message",
      "dependencies": [],
      "prompt": {
        "template": "Use the bash tool to run: echo 'Hello from MiniBob!'",
        "maxTokens": 1000,
        "compressionStrategy": "filter",
        "variables": []
      }
    }
  ]
}
EOF

# Register template (requires metabob-cli with register_activity_template tool)
# Or POST to API directly
```

### 2. MiniBob Picks Up Activity

```bash
# MiniBob's boredom system will poll for activities
# Watch logs:
kubectl logs -n activity-dev -l app.kubernetes.io/name=minibob -f

# Should see:
# [Boredom] Found activity: log-hello-world
# [Activity] Starting execution...
# [Task 1/1] Log hello world message
# [Bash] echo 'Hello from MiniBob!'
# Hello from MiniBob!
# [Activity] Execution complete (success: true)
```

### 3. View Results in Dashboard

```bash
# Refresh dashboard at http://dashboard.minibob.local
# Navigate to "Live Monitor" tab (when implemented)
# Should see execution entry with:
# - Template: log-hello-world
# - Status: Success
# - Duration: ~5 seconds
# - Cost: ~$0.01
```

---

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n activity-dev

# Describe failed pod
kubectl describe pod <pod-name> -n activity-dev

# Check logs
kubectl logs <pod-name> -n activity-dev

# Common issues:
# - Image pull failure: Rebuild with correct tag (dev)
# - Resource constraints: Increase Docker Desktop resources
# - Volume mount failure: Ensure PWD is set correctly in helmfile
```

### Ingress Not Working

```bash
# Check Ingress controller
kubectl get pods -n ingress-nginx

# Check Ingress resources
kubectl get ingress -n activity-dev

# Test direct port-forward bypass
kubectl port-forward -n activity-dev svc/activity-dashboard 3000:3000
# Open http://localhost:3000

# If port-forward works but Ingress doesn't:
# - Check /etc/hosts entries
# - Restart Ingress controller: kubectl rollout restart deployment -n ingress-nginx
```

### Hot-Reload Not Working

```bash
# Verify volume mount
kubectl exec -it -n activity-dev <pod-name> -- ls -la /app/src

# Should show your local source files

# Check if Bun is running with --hot
kubectl exec -it -n activity-dev <pod-name> -- ps aux | grep bun

# Manually restart pod to remount volumes
kubectl rollout restart deployment -n activity-dev <deployment-name>
```

### MiniBob Not Picking Up Activities

```bash
# Check boredom system config
kubectl get deployment -n activity-dev minibob -o yaml | grep -A5 boredom

# Check API connectivity from MiniBob pod
kubectl exec -it -n activity-dev <minibob-pod> -- \
  curl http://metabob-activity-api:8080/health

# Check for templates
kubectl exec -it -n activity-dev <minibob-pod> -- \
  curl http://metabob-activity-api:8080/v2/activities/templates
```

---

## Teardown

### Remove Development Environment

```bash
# Delete all resources
helmfile -f helm/helmfile-activity-dev.yaml -e dev destroy

# Or manually
kubectl delete namespace activity-dev

# Verify
kubectl get pods -n activity-dev
# Should return: No resources found
```

### Remove /etc/hosts Entries

```bash
# Edit /etc/hosts and remove:
# 127.0.0.1  dashboard.minibob.local
# 127.0.0.1  api.minibob.local
# 127.0.0.1  minibob.minibob.local
sudo nano /etc/hosts
```

---

## Next Steps

### Phase 1: Validate System ✅
- [x] Deploy all vessels
- [x] Access via local domains
- [x] Verify hot-reload
- [ ] Run first activity successfully
- [ ] View execution in dashboard

### Phase 2: Build Dashboard UI
- [ ] Implement Template Explorer component
- [ ] Implement Live Monitor component
- [ ] Implement System Health component
- [ ] Add real-time WebSocket updates

### Phase 3: MiniBob Self-Development
- [ ] Create activity templates for MiniBob development
- [ ] Have MiniBob add feature to itself
- [ ] Commit changes from within cluster
- [ ] Push to GitHub from MiniBob pod

### Phase 4: Full Dogfooding
- [ ] Use MiniBob to develop Activity API
- [ ] Use MiniBob to develop Dashboard
- [ ] Create meta-template: "improve activity system"
- [ ] Validate learning loop with real metrics

---

## Support Resources

- **Helmfile Reference**: helm/helmfile-activity-dev.yaml
- **Dashboard Code**: repos/activity-dashboard/
- **API Code**: repos/metabob-activity-api/
- **MiniBob Code**: repos/minibob/
- **Issues**: Each repo has its own GitHub Issues

---

**Ready to develop! Start with validation steps, then build your first activity.** 🚀
