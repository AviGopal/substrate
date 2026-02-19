# Helmfile Deployment Guide - DevBob v1.0.0

## Why Helmfile?

**Helmfile is the proper way to manage Kubernetes deployments** for this project. It provides:

- ✅ Version-controlled infrastructure as code
- ✅ Environment-specific configurations (production, integration, default)
- ✅ Dependency management between services
- ✅ Atomic deployments with rollback capability
- ✅ Diff preview before applying changes

**DO NOT** use raw `kubectl` commands for deployments. They bypass the GitOps workflow.

## Project Structure

```
repos/platform/metabob-apps/
├── helmfile.yaml.gotmpl                 # Main Helmfile config
├── environments/
│   └── production/
│       ├── production.values.yaml       # Production environment values
│       └── secrets.yaml                 # Production secrets
└── charts/
    ├── opencode-server/
    │   ├── charts/                      # Helm chart templates
    │   │   └── templates/
    │   │       └── deployment.yaml      # Deployment spec (with 'serve' command)
    │   └── values/
    │       ├── production.opencode-server.values.yaml   # ← IMAGE TAG HERE
    │       └── production.opencode-server.secrets.yaml  # API keys
    └── slack-bot/
        ├── charts/
        └── values/
            ├── production.slack-bot.values.yaml         # ← BACKEND URL HERE
            └── production.slack-bot.secrets.yaml
```

## Current v1.0.0 Configuration

### opencode-server values
File: `charts/opencode-server/values/production.opencode-server.values.yaml`

```yaml
image:
  repository: metabobapp/devbob
  pullPolicy: IfNotPresent
  tag: "v1.0.0"  # ← Updated to v1.0.0
```

### opencode-server deployment template
File: `charts/opencode-server/charts/templates/deployment.yaml`

```yaml
command: ["opencode"]
args:
  - "serve"  # ← Correct command (not 'acp')
  - "--hostname={{ .Values.opencode.hostname }}"
  - "--port={{ .Values.opencode.port }}"
```

### slack-bot values
File: `charts/slack-bot/values/production.slack-bot.values.yaml`

```yaml
backendUrl: "http://opencode-server:8080"  # ← Correct internal service URL
```

## Deployment Workflow

### Method 1: Automated (RECOMMENDED)

```bash
# This does everything: push to registry + helmfile deploy
./push-and-helmfile-deploy-v1.0.0.sh
```

### Method 2: Manual Steps

```bash
# 1. Push image to registry
docker push metabobapp/devbob:v1.0.0
docker push metabobapp/devbob:latest

# 2. Verify in registry
docker manifest inspect metabobapp/devbob:v1.0.0

# 3. Deploy with Helmfile
./helmfile-deploy-v1.0.0.sh
```

### Method 3: Direct Helmfile Commands

```bash
cd repos/platform/metabob-apps

# Preview changes
helmfile -e production diff --selector name=opencode-server

# Apply deployment
helmfile -e production apply --selector name=opencode-server

# Or deploy everything (not recommended for single-service updates)
helmfile -e production apply
```

## Helmfile Commands Reference

```bash
cd repos/platform/metabob-apps

# Show diff before deploying
helmfile -e production diff

# Deploy specific service
helmfile -e production apply --selector name=opencode-server
helmfile -e production apply --selector name=slack-bot

# Deploy with dependencies
helmfile -e production apply

# Sync (deploy if needed, no-op if up-to-date)
helmfile -e production sync

# Destroy deployment
helmfile -e production destroy --selector name=opencode-server

# List releases
helmfile -e production list

# Template (render manifests without deploying)
helmfile -e production template --selector name=opencode-server
```

## Making Changes

### To update the Docker image version:

1. **Edit values file**:
   ```bash
   # Update image tag in:
   repos/platform/metabob-apps/charts/opencode-server/values/production.opencode-server.values.yaml
   
   # Change:
   tag: "v1.0.0"
   # To:
   tag: "v1.0.1"
   ```

2. **Push new image**:
   ```bash
   docker push metabobapp/devbob:v1.0.1
   ```

3. **Deploy**:
   ```bash
   ./helmfile-deploy-v1.0.1.sh
   # Or manually:
   cd repos/platform/metabob-apps
   helmfile -e production apply --selector name=opencode-server
   ```

### To update deployment configuration:

1. **Edit template**:
   ```bash
   # Modify:
   repos/platform/metabob-apps/charts/opencode-server/charts/templates/deployment.yaml
   ```

2. **Preview changes**:
   ```bash
   cd repos/platform/metabob-apps
   helmfile -e production diff --selector name=opencode-server
   ```

3. **Apply**:
   ```bash
   helmfile -e production apply --selector name=opencode-server
   ```

## Verification

```bash
# Check deployment status
kubectl get deployment opencode-server -n metabob

# Check pod status
kubectl get pods -n metabob -l app.kubernetes.io/name=opencode-server

# View logs
kubectl logs -n metabob -l app.kubernetes.io/name=opencode-server --tail=50 -f

# Verify image
kubectl get deployment opencode-server -n metabob -o jsonpath='{.spec.template.spec.containers[0].image}'

# Should output: metabobapp/devbob:v1.0.0
```

## Rollback

```bash
# Rollback using Helm
helm rollback opencode-server -n metabob

# Or update values to previous version and redeploy
# Edit: charts/opencode-server/values/production.opencode-server.values.yaml
# Change tag back to previous version
# Then: helmfile -e production apply --selector name=opencode-server
```

## Common Mistakes to Avoid

❌ **DON'T** use `kubectl set image` - bypasses Helmfile
❌ **DON'T** use `kubectl apply -f` - not tracked in Helm
❌ **DON'T** edit deployments directly with `kubectl edit` - changes will be overwritten
❌ **DON'T** forget to push the Docker image before deploying

✅ **DO** update values files and use Helmfile
✅ **DO** preview changes with `helmfile diff`
✅ **DO** push images to registry before deploying
✅ **DO** verify image tag in values matches pushed image

## Troubleshooting

### Image pull errors
```bash
# Verify image exists in registry
docker manifest inspect metabobapp/devbob:v1.0.0

# Check pod events
kubectl describe pod -n metabob -l app.kubernetes.io/name=opencode-server
```

### Helmfile errors
```bash
# Check Helmfile syntax
cd repos/platform/metabob-apps
helmfile -e production lint

# Render templates to see generated YAML
helmfile -e production template --selector name=opencode-server
```

### Pod not starting
```bash
# Check logs
kubectl logs -n metabob -l app.kubernetes.io/name=opencode-server --tail=100

# Check events
kubectl get events -n metabob --sort-by='.lastTimestamp'
```

## Next Version Deployment

When bumping to v1.0.1:

1. Update `VERSION.md` with changes
2. Build new image: `docker build -f docker/Dockerfile.devbob -t metabobapp/devbob:v1.0.1 .`
3. Update values: `charts/opencode-server/values/production.opencode-server.values.yaml`
4. Create new deployment script: `cp helmfile-deploy-v1.0.0.sh helmfile-deploy-v1.0.1.sh`
5. Update script version number
6. Run: `./push-and-helmfile-deploy-v1.0.1.sh`
