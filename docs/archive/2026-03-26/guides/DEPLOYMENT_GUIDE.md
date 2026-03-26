# Deployment Guide - Metabob Platform

**Last Updated:** 2026-03-03  
**Deployment Method:** Helmfile + Environment-Specific Values  
**Source of Truth:** `repos/platform/metabob-apps/`

---

## Core Principles

### 1. **Single Source of Truth**
All deployment configuration lives in **`repos/platform/metabob-apps/`**

**DO:**
- ✅ Edit values in `charts/{service}/values/{environment}.{service}.values.yaml`
- ✅ Deploy via `helmfile sync` from `repos/platform/metabob-apps/`
- ✅ Test locally with `default` environment before production
- ✅ Use image tags tied to git commits for traceability

**DON'T:**
- ❌ Use raw `kubectl apply` (bypasses GitOps)
- ❌ Use `helm install` directly (bypasses dependency management)
- ❌ Edit manifests outside `repos/platform/metabob-apps/`
- ❌ Use `:latest` tag in production

### 2. **Environment Progression**
Test → Validate → Deploy

```
default (local K8s) → integration (staging) → production
```

**Workflow:**
1. Change values in `default.{service}.values.yaml`
2. Deploy locally: `helmfile -e default sync`
3. Validate functionality
4. Copy changes to `production.{service}.values.yaml`
5. Deploy production: `helmfile -e production sync`

### 3. **Zero Data Loss**
All stateful services must handle updates gracefully

**Database Updates:**
- ✅ SurrealDB: Persistent volumes retained across pod restarts
- ✅ Redis: AOF persistence enabled for production
- ✅ Migrations: Applied before new code deployment

**Configuration Updates:**
- ✅ ConfigMaps: Mounted as volumes, pods restart on change
- ✅ Secrets: Updated via sealed-secrets or SOPS, encrypted at rest

---

## Project Structure

```
repos/platform/metabob-apps/
├── helmfile.yaml.gotmpl                      # Main helmfile (environment + release config)
├── environments/
│   ├── environments.yaml                     # Environment definitions
│   ├── default/
│   │   └── default.values.yaml              # Local dev environment config
│   ├── integration/
│   │   └── integration.values.yaml          # Staging environment config
│   └── production/
│       └── production.values.yaml           # Production environment config
└── charts/
    ├── config/                               # ConfigMap and namespace setup
    │   └── values/
    │       └── {environment}.config.values.yaml
    ├── surrealdb/
    │   ├── charts/                          # Helm chart templates
    │   │   └── templates/
    │   │       ├── deployment.yaml
    │   │       ├── service.yaml
    │   │       └── pvc.yaml
    │   └── values/
    │       ├── default.surrealdb.values.yaml
    │       └── production.surrealdb.values.yaml
    ├── redis/
    │   └── values/
    │       ├── default.redis.values.yaml
    │       └── production.redis.values.yaml
    ├── metabob-rpc-api/
    │   ├── charts/
    │   │   └── templates/
    │   │       ├── deployment-api.yaml
    │   │       ├── deployment-worker.yaml
    │   │       └── service.yaml
    │   └── values/
    │       ├── default.metabob-rpc-api.values.yaml
    │       └── production.metabob-rpc-api.values.yaml
    ├── metabob-dashboard/
    │   └── values/
    │       ├── default.metabob-dashboard.values.yaml
    │       └── production.metabob-dashboard.values.yaml
    └── devbob/
        ├── charts/
        │   └── templates/
        │       ├── deployment.yaml
        │       ├── service.yaml
        │       ├── pvc.yaml
        │       └── configmap.yaml
        └── values/
            ├── default.devbob.values.yaml
            ├── default.devbob.secrets.yaml
            ├── production.devbob.values.yaml
            └── production.devbob.secrets.yaml
```

---

## Environment Configuration

### Environments Defined

File: `environments/environments.yaml`

```yaml
environments:
  default:
    values:
      - environments/default/default.values.yaml
    kubeContext: local-cluster

  integration:
    values:
      - environments/integration/integration.values.yaml
    kubeContext: metabob-integration

  production:
    values:
      - environments/production/production.values.yaml
    kubeContext: metabob-production
```

### Environment-Specific Values Pattern

Each service follows the pattern: `{environment}.{service}.values.yaml`

**Example: metabob-rpc-api**

`default.metabob-rpc-api.values.yaml` (local dev):
```yaml
image:
  repository: metabob/metabob-rpc-api
  tag: "dev-latest"
  pullPolicy: Always

replicas: 1

resources:
  limits:
    memory: "512Mi"
    cpu: "500m"

env:
  REDIS_HOST: "redis-master.metabob.svc.cluster.local"
  SURREALDB_URL: "ws://surrealdb:8000/rpc"
  LOG_LEVEL: "DEBUG"
```

`production.metabob-rpc-api.values.yaml`:
```yaml
image:
  repository: metabob/metabob-rpc-api
  tag: "v1.2.3"  # ← Specific version, not 'latest'
  pullPolicy: IfNotPresent

replicas: 3

resources:
  limits:
    memory: "2Gi"
    cpu: "1000m"

env:
  REDIS_HOST: "redis-master.metabob.svc.cluster.local"
  SURREALDB_URL: "ws://surrealdb:8000/rpc"
  LOG_LEVEL: "INFO"
```

---

## Deployment Workflow

### Prerequisites

```bash
# Install tools
brew install helmfile helm kubectl

# Verify kubectl context
kubectl config current-context
# Should show: local-cluster (for default) or metabob-production (for prod)

# Switch context if needed
kubectl config use-context local-cluster
```

### Clean Start Deployment (From Scratch)

```bash
cd repos/platform/metabob-apps

# 1. Create namespace
kubectl create namespace metabob

# 2. Deploy full stack (default environment)
helmfile -e default sync

# 3. Verify all pods running
kubectl get pods -n metabob

# Expected output:
# NAME                              READY   STATUS    RESTARTS   AGE
# redis-master-0                    1/1     Running   0          2m
# surrealdb-0                       1/1     Running   0          2m
# metabob-rpc-api-xxx               1/1     Running   0          1m
# metabob-dashboard-xxx             1/1     Running   0          1m
# devbob-0                          1/1     Running   0          1m
```

### Update Existing Deployment

#### Step 1: Modify Values File

```bash
# Edit service-specific values
vim charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml

# Example change: Update image tag
image:
  tag: "v1.2.4"  # ← Change this
```

#### Step 2: Preview Changes

```bash
# See what will change
helmfile -e default diff --selector name=metabob-rpc-api

# Output shows:
# - Old values (red)
# + New values (green)
```

#### Step 3: Apply Changes

```bash
# Apply to single service
helmfile -e default apply --selector name=metabob-rpc-api

# OR apply to all services
helmfile -e default sync
```

#### Step 4: Verify Deployment

```bash
# Check rollout status
kubectl rollout status deployment/metabob-rpc-api -n metabob

# Verify new pods running
kubectl get pods -n metabob -l app=metabob-rpc-api

# Check logs
kubectl logs -f deployment/metabob-rpc-api -n metabob
```

---

## CI/CD Integration

### Image Versioning Strategy

**Development:**
```bash
# Build and tag with commit SHA
export COMMIT_SHA=$(git rev-parse --short HEAD)
docker build -t metabob/metabob-rpc-api:dev-${COMMIT_SHA} .
docker push metabob/metabob-rpc-api:dev-${COMMIT_SHA}

# Update values file
sed -i "s/tag: \".*\"/tag: \"dev-${COMMIT_SHA}\"/" \
  charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml
```

**Production:**
```bash
# Tag with semantic version
docker build -t metabob/metabob-rpc-api:v1.2.3 .
docker push metabob/metabob-rpc-api:v1.2.3

# Update production values
sed -i "s/tag: \".*\"/tag: \"v1.2.3\"/" \
  charts/metabob-rpc-api/values/production.metabob-rpc-api.values.yaml

# Commit values file change
git add charts/metabob-rpc-api/values/production.metabob-rpc-api.values.yaml
git commit -m "chore: Update metabob-rpc-api to v1.2.3"
git push
```

### Automated Deployment Pipeline (GitHub Actions)

`.github/workflows/deploy-production.yaml`:
```yaml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Extract version from tag
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/}" >> $GITHUB_OUTPUT
      
      - name: Build and push Docker image
        run: |
          docker build -t metabob/metabob-rpc-api:${{ steps.version.outputs.VERSION }} .
          docker push metabob/metabob-rpc-api:${{ steps.version.outputs.VERSION }}
      
      - name: Update helmfile values
        run: |
          cd repos/platform/metabob-apps
          sed -i "s/tag: \".*\"/tag: \"${{ steps.version.outputs.VERSION }}\"/" \
            charts/metabob-rpc-api/values/production.metabob-rpc-api.values.yaml
      
      - name: Deploy to production
        run: |
          cd repos/platform/metabob-apps
          helmfile -e production apply --selector name=metabob-rpc-api
```

---

## Data Persistence & Migration

### Database Persistence

**SurrealDB:**
```yaml
# charts/surrealdb/values/production.surrealdb.values.yaml
persistence:
  enabled: true
  storageClass: "standard"
  size: 50Gi
  retain: true  # ← Keeps PVC even if pod deleted
```

**Redis:**
```yaml
# charts/redis/values/production.redis.values.yaml
master:
  persistence:
    enabled: true
    size: 10Gi
  
  # AOF persistence for durability
  configmap: |
    appendonly yes
    appendfsync everysec
```

### Database Migrations

**Strategy:** Run migrations as init containers before main app starts

```yaml
# charts/metabob-rpc-api/charts/templates/deployment-api.yaml
spec:
  template:
    spec:
      initContainers:
      - name: run-migrations
        image: metabob/metabob-rpc-api:{{ .Values.image.tag }}
        command: ["npm", "run", "migrate"]
        env:
          - name: SURREALDB_URL
            value: "ws://surrealdb:8000/rpc"
      
      containers:
      - name: api
        image: metabob/metabob-rpc-api:{{ .Values.image.tag }}
        # Main application starts after migrations complete
```

### Backup Strategy

**SurrealDB Backups:**
```bash
# Create backup CronJob
kubectl create -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: surrealdb-backup
  namespace: metabob
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: metabob/backup-tool:latest
            command:
            - /bin/sh
            - -c
            - |
              surreal export --conn ws://surrealdb:8000 \
                --user root --pass \$SURREAL_PASS \
                --ns production --db metabob \
                /backups/metabob-\$(date +%Y%m%d-%H%M%S).surql
            volumeMounts:
            - name: backups
              mountPath: /backups
          volumes:
          - name: backups
            persistentVolumeClaim:
              claimName: surrealdb-backups
EOF
```

---

## Rollback Procedures

### Rollback via Helmfile

```bash
# 1. Identify previous release
helmfile -e production list

# 2. Revert values file to previous version
git log charts/metabob-rpc-api/values/production.metabob-rpc-api.values.yaml
git checkout <previous-commit> -- charts/metabob-rpc-api/values/production.metabob-rpc-api.values.yaml

# 3. Apply rollback
helmfile -e production apply --selector name=metabob-rpc-api

# 4. Verify
kubectl rollout status deployment/metabob-rpc-api -n metabob
```

### Emergency Rollback (Kubectl)

```bash
# Rollback to previous revision
kubectl rollout undo deployment/metabob-rpc-api -n metabob

# Rollback to specific revision
kubectl rollout undo deployment/metabob-rpc-api -n metabob --to-revision=3

# Check rollout history
kubectl rollout history deployment/metabob-rpc-api -n metabob
```

---

## Troubleshooting

### Pod Fails to Start

```bash
# Check pod status
kubectl get pod <pod-name> -n metabob

# Check events
kubectl describe pod <pod-name> -n metabob

# Common issues:
# - ImagePullBackOff: Wrong image tag or registry credentials
# - CrashLoopBackOff: Application error, check logs
# - Pending: Insufficient resources or PVC mount failure
```

### Database Connection Failures

```bash
# Test connectivity from pod
kubectl exec -it <app-pod> -n metabob -- /bin/sh
nc -zv surrealdb 8000
nc -zv redis-master 6379

# Check service endpoints
kubectl get endpoints -n metabob
```

### Configuration Not Applied

```bash
# Force pod restart to pick up new ConfigMap
kubectl rollout restart deployment/<service-name> -n metabob

# Verify ConfigMap
kubectl get configmap <service-name>-config -n metabob -o yaml
```

---

## Summary

### Deployment Checklist

**Local Development:**
- [ ] Edit `default.{service}.values.yaml`
- [ ] `helmfile -e default diff`
- [ ] `helmfile -e default sync`
- [ ] Validate functionality
- [ ] Run tests

**Production Deployment:**
- [ ] Build and push image with version tag
- [ ] Edit `production.{service}.values.yaml`
- [ ] Commit values file change
- [ ] `helmfile -e production diff` (review changes)
- [ ] `helmfile -e production sync`
- [ ] Verify deployment: `kubectl get pods -n metabob`
- [ ] Check logs: `kubectl logs -f deployment/<service>`
- [ ] Monitor metrics and alerts

**Rollback (if needed):**
- [ ] `git checkout <previous-commit> -- charts/.../production.*.values.yaml`
- [ ] `helmfile -e production sync`
- [ ] Verify rollback successful

---

## References

- **Helmfile Docs:** https://helmfile.readthedocs.io/
- **Helm Docs:** https://helm.sh/docs/
- **Platform Repo:** `repos/platform/metabob-apps/`
- **Environment Config:** `repos/platform/metabob-apps/environments/`
- **Service Charts:** `repos/platform/metabob-apps/charts/`
