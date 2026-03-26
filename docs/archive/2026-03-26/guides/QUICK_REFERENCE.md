# DevBob Quick Reference

## The Only Commands You Need

### Deploy Everything
```bash
cd repos/platform/metabob-apps
helmfile -e production apply
```

### Deploy OpenCode Server Only
```bash
cd repos/platform/metabob-apps
helmfile -e production apply --selector name=opencode-server
```

### Preview Changes Before Deploying
```bash
cd repos/platform/metabob-apps
helmfile -e production diff --selector name=opencode-server
```

## Release New Version

```bash
# 1. Build
docker build -f docker/Dockerfile.devbob -t metabobapp/devbob:v1.0.2 .
docker push metabobapp/devbob:v1.0.2

# 2. Update versions
vim repos/platform/metabob-apps/charts/opencode-server/charts/Chart.yaml
# version: 1.0.2, appVersion: "1.0.2"

vim repos/platform/metabob-apps/charts/opencode-server/values/production.opencode-server.values.yaml
# tag: "v1.0.2"

# 3. Deploy
cd repos/platform/metabob-apps
helmfile -e production apply --selector name=opencode-server
```

## Change Configuration (No Rebuild!)

```bash
# 1. Edit config
vim repos/platform/metabob-apps/charts/opencode-server/values/production.opencode-server.values.yaml

# 2. Deploy
cd repos/platform/metabob-apps
helmfile -e production apply --selector name=opencode-server
```

## Troubleshooting

```bash
# Check pods
kubectl get pods -n metabob -l app.kubernetes.io/name=opencode-server

# Check logs  
kubectl logs -n metabob -l app.kubernetes.io/name=opencode-server --tail=50

# Check config
kubectl get configmap opencode-server -n metabob -o yaml

# Restart deployment
kubectl rollout restart deployment/opencode-server -n metabob
```

## That's It!

Don't use:
- ❌ `kubectl apply` directly
- ❌ Custom deployment scripts
- ❌ Version-specific scripts

Just use:
- ✅ `helmfile -e production apply`
