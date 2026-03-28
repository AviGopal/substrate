# DevBob Deployment Standard

**Date:** 2026-02-27  
**Definition:** DevBob deployment now officially means **kubectx local deployment** (docker-desktop)

## What This Means

When we say "deploy devbob" or "devbob deployment", we specifically mean:
- **Target:** Local Kubernetes cluster (docker-desktop context)
- **Namespace:** metabob
- **Method:** Helmfile with local environment configuration
- **Verification:** Always verify kubectl context before deployment

## Quick Deploy

### Using Activity Template (Recommended)

```bash
opencode activity execute deploy-devbob-to-local-kubernetes
```

This activity will:
1. ✅ Verify kubectl context is docker-desktop
2. ✅ Deploy complete stack via helmfile
3. ✅ Validate all services are healthy
4. ✅ Configure local access shortcuts
5. ✅ Generate deployment documentation

### Manual Deployment

If you prefer manual control:

```bash
# 1. Verify context
kubectl config current-context  # Should be: docker-desktop
kubectl config use-context docker-desktop  # If needed

# 2. Navigate to helm directory
cd helm

# 3. Deploy
helmfile -e local sync --wait

# 4. Verify
kubectl get pods -n metabob
kubectl get svc -n metabob
```

## Configuration

### Kubectl Context
- **Context Name:** `docker-desktop`
- **Cluster:** Docker Desktop Kubernetes
- **Namespace:** `metabob`

### Helmfile Environment
- **Environment:** `local`
- **Values File:** `helm/environments/local.values.yaml`
- **Helmfile:** `helm/helmfile.yaml`

### Deployed Services
- **redis-master** - Redis cache and queue
- **surrealdb** - Activity templates and metrics database
- **metabob-rpc-api** - Backend RPC API service
- **devbob** - DevBob agent container

## Access Patterns

### Quick Access Script

The deployment creates `devbob-access.sh`:

```bash
# View pods
./devbob-access.sh pods

# View logs
./devbob-access.sh logs

# Get shell in devbob container
./devbob-access.sh shell

# Access Redis CLI
./devbob-access.sh redis

# Restart devbob
./devbob-access.sh restart
```

### Port Forwarding

Access services locally:

```bash
# Redis
kubectl port-forward -n metabob svc/redis-master 6379:6379

# SurrealDB
kubectl port-forward -n metabob svc/surrealdb 8000:8000

# RPC API
kubectl port-forward -n metabob svc/metabob-rpc-api 8080:8080
```

## Verification Commands

### Check Context
```bash
kubectl config current-context
# Expected: docker-desktop
```

### Check Pods
```bash
kubectl get pods -n metabob
# All should be Running with 1/1 READY
```

### Check Services
```bash
kubectl get svc -n metabob
# All should have endpoint IPs
```

### Check Logs
```bash
# DevBob logs
kubectl logs -n metabob -l app.kubernetes.io/name=devbob --tail=50

# All services
kubectl logs -n metabob --all-containers --tail=50
```

## Troubleshooting

### Wrong Context

If you accidentally target the wrong cluster:

```bash
# Check current context
kubectl config current-context

# Switch to local
kubectl config use-context docker-desktop

# Verify
kubectl cluster-info
```

### Pods Not Running

```bash
# Check pod status
kubectl get pods -n metabob

# Describe problematic pod
kubectl describe pod -n metabob <pod-name>

# Check logs
kubectl logs -n metabob <pod-name>

# Restart deployment
kubectl rollout restart -n metabob deploy/<service-name>
```

### Helmfile Errors

```bash
# Preview changes
cd helm
helmfile -e local diff

# Apply specific service
helmfile -e local -l name=redis sync

# Destroy and recreate
helmfile -e local destroy
helmfile -e local sync --wait
```

## Related Contexts

We have other kubectl contexts for different purposes:

| Context | Purpose | Usage |
|---------|---------|-------|
| `docker-desktop` | **Local devbob deployment** (DEFAULT) | Development, testing |
| `local` | Docker Desktop (Prefect namespace) | Separate local experiments |
| `azure-development` | Azure dev cluster | Remote development |
| `development` | DigitalOcean dev cluster | Remote development |
| `metabob-production` | GKE production | **⚠️ PRODUCTION - Use extreme caution** |

**Important:** Always verify your context before running kubectl or helmfile commands!

## Why This Standardization?

### Before
- "Devbob deployment" was ambiguous
- Could mean docker-compose, K8s, or various contexts
- Risk of deploying to wrong environment

### After
- "Devbob deployment" = kubectx local (docker-desktop)
- Clear, standardized process via activity template
- Built-in context verification
- Reduced risk of mistakes

## Activity Template Details

**Template ID:** `deploy-devbob-to-local-kubernetes`  
**Category:** infrastructure  
**Tasks:** 5 (verify-context → deploy-stack → validate-deployment → configure-access → document-deployment)

### Execute Activity

```bash
opencode activity execute deploy-devbob-to-local-kubernetes
```

### Activity Variables

None required - template uses sensible defaults for local deployment.

### Activity Output

Creates:
- `DEVBOB_LOCAL_DEPLOYMENT_STATUS.md` - Deployment status and access guide
- `devbob-access.sh` - Quick access script

## See Also

- [Helmfile Configuration](helm/helmfile.yaml)
- [Local Environment Values](helm/environments/local.values.yaml)
- [Activity Template](templates/infrastructure/deploy-devbob-local.json)
