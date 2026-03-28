# Deployment Activity Guide

## Overview

This guide documents the deployment workflow for Metabob platform applications. Until the activity template backend is fully operational, use the provided script. Once the backend is available, the activity template will provide the same workflow with better tracking and rollback capabilities.

## Quick Start

### Using the Script (Current Approach)

```bash
# Deploy all services to default environment
./scripts/deploy-with-validation.sh default

# Deploy specific service
./scripts/deploy-with-validation.sh default metabob-rpc-api

# Deploy with migrations
./scripts/deploy-with-validation.sh default "" --migrate

# Deploy with validation
./scripts/deploy-with-validation.sh default "" --migrate --validate
```

### Using Activity Template (Future - Once Backend is Available)

```bash
# Via OpenCode CLI
opencode activity deploy-helmfile-k8s \
  --var environment=default \
  --var service=metabob-rpc-api \
  --var runMigrations=true \
  --var validateDeployment=true
```

## Deployment Workflow

The deployment process follows these steps:

### 1. Validate Environment
- Check required tools (kubectl, helm, helmfile, kubectx)
- Verify kubernetes cluster connectivity
- Validate environment configuration
- Check secrets (if required for environment)

### 2. Show Deployment Plan
- Display target environment and services
- Generate configuration diff
- Summarize changes (creates, updates, deletes)
- Require confirmation for production deployments

### 3. Execute Deployment
- Create namespace if needed
- Run helmfile apply
- Monitor pod rollout status
- Capture deployment errors

### 4. Run Migrations (Optional)
- Execute database migration script
- Track which migrations were applied
- Verify migration success

### 5. Validate Deployment Health
- Wait for pods to be ready (5 min timeout)
- Check pod status (Running vs CrashLoopBackOff)
- Verify service endpoints
- Test application health endpoints
- Review recent logs

### 6. Generate Summary
- Create deployment summary document
- Include resource counts, health status
- Provide monitoring commands
- Document rollback instructions

## Deployment Scripts

### Main Scripts

| Script | Location | Purpose |
|--------|----------|---------|
| `deploy.sh` | `repos/platform/metabob-apps/` | Core helmfile deployment orchestrator |
| `validate-deployment.sh` | `repos/platform/metabob-apps/scripts/` | Pre-deployment validation |
| `run-migrations.sh` | `repos/platform/metabob-apps/scripts/` | Database migration runner |
| `deploy-with-validation.sh` | `scripts/` | Wrapper with complete workflow |

### Script Features

**deploy.sh**:
- Environment detection from k8s context
- Service-specific deployments
- Dry-run mode
- Migration execution
- Post-deployment validation
- Production safety confirmations

**validate-deployment.sh**:
- Tool installation checks
- Cluster connectivity verification
- Namespace validation
- Resource quota checks

**run-migrations.sh**:
- Idempotent migration execution
- Migration tracking in database
- Production safety mode
- Rollback capability

**deploy-with-validation.sh**:
- Combines all scripts into single workflow
- Generates deployment summary
- Provides next steps
- Structured logging

## Environment Configuration

### Environments

| Environment | K8s Context | Purpose |
|-------------|-------------|---------|
| `default` | `docker-desktop`, `local` | Local development |
| `integration` | `metabob-integration` | Integration testing |
| `production` | `metabob-production` | Production deployments |

### Configuration Files

```
repos/platform/metabob-apps/
├── helmfile.yaml.gotmpl        # Helmfile template
├── environments/
│   ├── default/
│   │   └── values.yaml         # Default environment values
│   ├── integration/
│   │   ├── values.yaml
│   │   └── secrets.yaml
│   └── production/
│       ├── values.yaml
│       └── secrets.yaml
└── charts/                     # Helm charts for each service
```

## Common Deployment Scenarios

### Scenario 1: Deploy Everything to Local

```bash
./scripts/deploy-with-validation.sh default
```

### Scenario 2: Deploy Single Service

```bash
./scripts/deploy-with-validation.sh default metabob-rpc-api --migrate
```

### Scenario 3: Deploy with Code Changes

```bash
# 1. Build new images
cd repos/metabob-rpc-api
docker build -t metabob-rpc-api:latest .

# 2. Deploy
cd /path/to/metabob-devbob
./scripts/deploy-with-validation.sh default metabob-rpc-api
```

### Scenario 4: Deploy After Database Schema Changes

```bash
./scripts/deploy-with-validation.sh default "" --migrate
```

### Scenario 5: Production Deployment

```bash
# 1. Switch context
kubectx metabob-production

# 2. Deploy (will require confirmation)
./scripts/deploy-with-validation.sh production metabob-rpc-api --migrate --validate
```

## Monitoring Deployments

### Watch Pod Status

```bash
watch kubectl get pods -n metabob
```

### Follow Logs

```bash
# RPC API
kubectl logs -n metabob -l app=metabob-rpc-api --tail=50 -f

# Dashboard
kubectl logs -n metabob -l app=metabob-dashboard --tail=50 -f

# All services
kubectl logs -n metabob -l app.kubernetes.io/instance=metabob --tail=20 -f
```

### Check Resource Usage

```bash
cd repos/platform/metabob-apps
./scripts/monitor.sh
```

## Rollback Procedures

### Automatic Rollback (via Helmfile)

```bash
cd repos/platform/metabob-apps

# Rollback all services
helmfile --environment default rollback

# Rollback specific service
helmfile --environment default --selector name=metabob-rpc-api rollback
```

### Manual Rollback (via kubectl)

```bash
# Rollback to previous deployment
kubectl rollout undo deployment/metabob-rpc-api -n metabob

# Rollback to specific revision
kubectl rollout undo deployment/metabob-rpc-api -n metabob --to-revision=2

# View rollout history
kubectl rollout history deployment/metabob-rpc-api -n metabob
```

## Troubleshooting

### Pods Stuck in ImagePullBackOff

```bash
# Check image name/tag
kubectl describe pod <pod-name> -n metabob

# Verify image exists
docker images | grep metabob

# Solution: Rebuild and push image
```

### Pods in CrashLoopBackOff

```bash
# Check logs
kubectl logs <pod-name> -n metabob --previous

# Check events
kubectl get events -n metabob --sort-by='.lastTimestamp'

# Solution: Fix application error, redeploy
```

### Service Not Accessible

```bash
# Check service
kubectl get svc -n metabob

# Check endpoints
kubectl get endpoints -n metabob

# Test from within cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://metabob-rpc-api.metabob:8080/health
```

### Database Connection Issues

```bash
# Check SurrealDB status
kubectl get pods -n metabob -l app=surrealdb

# Check SurrealDB logs
kubectl logs -n metabob -l app=surrealdb --tail=50

# Verify connection from RPC API
kubectl exec -n metabob <rpc-api-pod> -- \
  curl http://surrealdb:8000/health
```

## Activity Template Specification

Once the Metabob backend is deployed and operational, the activity template will be available:

**Template ID**: `deploy-helmfile-k8s`
**Category**: `infrastructure`
**Status**: Created, pending backend availability for registration

### Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `environment` | string | Yes | `default` | Target environment |
| `service` | string | No | `""` | Specific service (empty = all) |
| `runMigrations` | boolean | No | `false` | Run migrations after deploy |
| `validateDeployment` | boolean | No | `true` | Validate health after deploy |
| `skipDiff` | boolean | No | `false` | Skip diff before deployment |
| `skipBuild` | boolean | No | `true` | Skip building images |

### Tasks

1. **Validate Environment** - Check prerequisites and configuration
2. **Show Deployment Plan** - Display diff and changes
3. **Deploy Services** - Execute helmfile apply
4. **Run Migrations** - Execute database migrations (if requested)
5. **Validate Health** - Check pod status and application health
6. **Create Summary** - Generate deployment documentation

## Next Steps

### Immediate Actions

1. ✅ Use `./scripts/deploy-with-validation.sh` for deployments
2. ✅ Script provides same workflow as future activity template
3. ⏳ Wait for Metabob backend deployment (fixes from previous activity)
4. ⏳ Register activity template once backend is available

### After Backend Deployment

1. Run the auth retry fix deployment:
   ```bash
   ./scripts/deploy-with-validation.sh default metabob-rpc-api --migrate
   ```

2. Verify backend is operational:
   ```bash
   curl http://api.metabob.local/api/v1/templates
   ```

3. Register the deployment activity template:
   ```bash
   opencode register-activity-template \
     --file /tmp/activity-templates/deploy-helmfile-k8s.json
   ```

4. Test the activity:
   ```bash
   opencode activity deploy-helmfile-k8s \
     --var environment=default \
     --var validateDeployment=true
   ```

## References

- Helmfile Documentation: `repos/platform/metabob-apps/DEPLOYMENT_GUIDE.md`
- Deployment Scripts: `repos/platform/metabob-apps/scripts/README.md`
- Activity Template: `/tmp/activity-templates/deploy-helmfile-k8s.json`
- Auth Retry Fix: `impulses/final-activity-impulse-learning-loop-execution-validation.md`
