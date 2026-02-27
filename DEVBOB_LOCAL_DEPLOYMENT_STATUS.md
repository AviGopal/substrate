# DevBob Local Deployment Status

**Deployment Date:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Kubectl Context:** docker-desktop
**Namespace:** metabob
**Deployment Method:** Helm via helmfile

## Overview

DevBob has been successfully deployed to local Kubernetes using Helm charts with proper secret management. The deployment includes Redis for caching/queuing, SurrealDB for activity templates and metrics, and the DevBob agent container.

## Deployed Services

### Helm Releases

```bash
helm list -n metabob
```

Current releases:
- **devbob** - DevBob agent container (revision 8)
- **redis** - Redis master for caching (revision 4)
- **surrealdb** - Activity template and metrics database (revision 8)
- **metabob-rpc-api** - Backend API (revision 1, failed - non-critical)

### Running Pods

```
NAME                                           READY   STATUS             RESTARTS      AGE     IP          NODE             NOMINATED NODE   READINESS GATES
devbob-0                                       1/1     Running            0             47m     10.1.0.81   docker-desktop   <none>           <none>
devbob-1                                       1/1     Running            0             47m     10.1.0.80   docker-desktop   <none>           <none>
devbob-2                                       1/1     Running            0             48m     10.1.0.79   docker-desktop   <none>           <none>
devbob-5d489fd6dd-s8zjn                        1/1     Running            0             3m49s   10.1.0.89   docker-desktop   <none>           <none>
metabob-rpc-api-7fd68d5c75-7csgg               0/1     CrashLoopBackOff   5 (78s ago)   4m17s   10.1.0.88   docker-desktop   <none>           <none>
metabob-rpc-api-dry-workers-5cb7787bfb-gwsr8   0/1     CrashLoopBackOff   3 (43s ago)   9m55s   10.1.0.87   docker-desktop   <none>           <none>
redis-master-0                                 1/1     Running            0             17m     10.1.0.83   docker-desktop   <none>           <none>
surrealdb-65576c4c47-jq8fn                     1/1     Running            1             6h7m    10.1.0.50   docker-desktop   <none>           <none>
```

### Service Endpoints

```
NAME              TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)             AGE     SELECTOR
devbob            ClusterIP   10.106.45.198    <none>        3000/TCP,8083/TCP   2d4h    app.kubernetes.io/instance=devbob,app.kubernetes.io/name=devbob
devbob-headless   ClusterIP   None             <none>        3000/TCP,8083/TCP   3h2m    app.kubernetes.io/name=devbob
metabob-rpc-api   ClusterIP   10.99.242.22     <none>        8080/TCP            3h24m   app=metabob-rpc-api,release=local
redis-headless    ClusterIP   None             <none>        6379/TCP            17m     app.kubernetes.io/instance=redis,app.kubernetes.io/name=redis
redis-master      ClusterIP   10.104.16.152    <none>        6379/TCP            17m     app.kubernetes.io/component=master,app.kubernetes.io/instance=redis,app.kubernetes.io/name=redis
redis-replicas    ClusterIP   10.108.18.62     <none>        6379/TCP            17m     app.kubernetes.io/component=replica,app.kubernetes.io/instance=redis,app.kubernetes.io/name=redis
surrealdb         ClusterIP   10.102.105.199   <none>        8000/TCP            6h8m    app=surrealdb,release=local
```

### Service Details

- **devbob:3000** - DevBob HTTP API
- **devbob:8083** - DevBob data bridge
- **redis-master:6379** - Redis service
- **surrealdb:8000** - SurrealDB HTTP API

## Secret Management

DevBob secrets are managed via Kubernetes secrets:

```bash
kubectl get secret devbob-secrets -n metabob
```

**Configured Secrets:**
- `anthropic-api-key` - Anthropic Claude API key
- `github-token` - GitHub personal access token
- `git-user-name` - Git user name for commits
- `git-user-email` - Git user email for commits

### Updating Secrets

```bash
# Update secrets
kubectl create secret generic devbob-secrets \
  --from-literal=anthropic-api-key=YOUR_KEY \
  --from-literal=github-token=YOUR_TOKEN \
  --from-literal=git-user-name="Your Name" \
  --from-literal=git-user-email="your@email.com" \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart DevBob to pick up new secrets
kubectl rollout restart statefulset/devbob -n metabob
```

## Quick Access Commands

### View Status

```bash
# All pods
kubectl get pods -n metabob

# All services
kubectl get svc -n metabob

# Helm releases
helm list -n metabob

# Complete status (using access script)
./devbob-access.sh status
```

### View Logs

```bash
# DevBob agent logs (follow)
kubectl logs -n metabob -l app.kubernetes.io/name=devbob --tail=100 -f

# Specific pod logs
kubectl logs -n metabob devbob-0 --tail=100 -f

# Redis logs
kubectl logs -n metabob redis-master-0 --tail=50

# SurrealDB logs
kubectl logs -n metabob -l app.kubernetes.io/name=surrealdb --tail=50

# Using access script
./devbob-access.sh logs
./devbob-access.sh logs devbob-0
```

### Shell Access

```bash
# DevBob pod
kubectl exec -it -n metabob devbob-0 -- /bin/bash

# Redis CLI
kubectl exec -it -n metabob redis-master-0 -- redis-cli

# Using access script
./devbob-access.sh shell
./devbob-access.sh shell devbob-1
./devbob-access.sh redis
```

### Restart Services

```bash
# Restart DevBob StatefulSet
kubectl rollout restart -n metabob statefulset/devbob

# Restart DevBob Deployment
kubectl rollout restart -n metabob deployment/devbob

# Restart SurrealDB
kubectl rollout restart -n metabob deployment/surrealdb

# Using access script
./devbob-access.sh restart
./devbob-access.sh restart surrealdb
```

## Port Forwarding

### Using Access Script

```bash
# Set up all port forwards
./devbob-access.sh forward

# Access services on localhost:
# - Redis: localhost:6379
# - SurrealDB: localhost:8000
# - DevBob: localhost:3000

# Stop all port forwards
./devbob-access.sh stop-forward
```

### Manual Port Forwarding

```bash
# Redis
kubectl port-forward -n metabob svc/redis-master 6379:6379 &

# SurrealDB
kubectl port-forward -n metabob svc/surrealdb 8000:8000 &

# DevBob
kubectl port-forward -n metabob svc/devbob 3000:3000 &

# Stop port forwards
pkill -f "kubectl port-forward.*metabob"
```

## Redeploy

### Full Redeploy

```bash
cd helm
helmfile -e local sync --wait
```

### Individual Service

```bash
# DevBob only
cd helm
helmfile -e local -l name=devbob sync --wait

# Redis only
cd helm
helmfile -e local -l name=redis sync --wait
```

### Update Helm Chart Values

```bash
# Edit values
vi helm/charts/devbob.values.yaml

# Apply changes
cd helm
helmfile -e local -l name=devbob sync --wait
```

## Cleanup

### Remove Specific Release

```bash
# Remove DevBob
helm uninstall devbob -n metabob

# Remove all releases
helm uninstall devbob metabob-rpc-api surrealdb redis -n metabob
```

### Full Cleanup (using helmfile)

```bash
cd helm
helmfile -e local destroy
```

### Complete Cleanup (including namespace)

```bash
# WARNING: This removes ALL resources in the namespace
kubectl delete namespace metabob
```

### Interactive Cleanup (using access script)

```bash
./devbob-access.sh cleanup
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n metabob

# Check logs
kubectl logs <pod-name> -n metabob

# Check events
kubectl get events -n metabob --sort-by=.metadata.creationTimestamp
```

### Service Not Accessible

```bash
# Check endpoints
kubectl get endpoints -n metabob

# Test connectivity from another pod
kubectl run test-curl -n metabob --rm -i --restart=Never \
  --image=curlimages/curl:latest -- curl http://devbob:3000
```

### Image Pull Issues

```bash
# Check image pull secrets
kubectl get secrets -n metabob

# Pull image manually (on Docker Desktop)
docker pull metabobapp/devbob:latest
```

### Resource Constraints

```bash
# Check resource usage
kubectl top pods -n metabob

# Check node resources
kubectl top nodes

# Adjust resource limits in values files
vi helm/charts/devbob.values.yaml
```

## Architecture

### Helm Chart Structure

```
helm/
├── helmfile.yaml                    # Environment-specific deployment config
└── charts/
    ├── devbob.values.yaml           # Local environment values for DevBob
    ├── redis.values.yaml            # Local environment values for Redis
    ├── surrealdb.values.yaml        # Local environment values for SurrealDB
    ├── metabob-rpc-api.values.yaml  # Local environment values for RPC API
    └── devbob/                      # DevBob Helm chart
        ├── Chart.yaml
        ├── values.yaml
        └── templates/
            ├── deployment.yaml
            ├── service.yaml
            └── secret.yaml
```

### Service Dependencies

```
DevBob
  ├── Redis (caching/queuing)
  ├── SurrealDB (activity templates)
  └── metabob-rpc-api (optional, for backend API)
```

## Known Issues

### metabob-rpc-api CrashLoopBackOff

**Status:** Non-critical, DevBob functions without it

**Issue:** The RPC API container expects a different command/entrypoint than configured.

**Impact:** None for local DevBob development and testing.

**Resolution:** Not required for current use case. Can be addressed if backend API integration is needed.

### Multiple DevBob Pods

**Status:** Transitional state

**Issue:** Old StatefulSet pods (devbob-0, devbob-1, devbob-2) coexist with new Deployment pod.

**Impact:** No functional impact, but uses extra resources.

**Resolution:** 
```bash
# Scale down old StatefulSet
kubectl scale statefulset devbob --replicas=0 -n metabob

# Or delete it
kubectl delete statefulset devbob -n metabob
```

## Additional Resources

- **Access Script:** `./devbob-access.sh` - Quick access commands
- **Access Guide:** `DEVBOB_LOCAL_ACCESS.md` - Complete access documentation
- **Helm Charts:** `./helm/charts/` - Chart definitions
- **Values Files:** `./helm/charts/*.values.yaml` - Environment-specific values

## Quick Start

```bash
# Check status
./devbob-access.sh status

# View logs
./devbob-access.sh logs

# Open shell
./devbob-access.sh shell

# Port forward services
./devbob-access.sh forward

# Restart DevBob
./devbob-access.sh restart
```

---

**Last Updated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
