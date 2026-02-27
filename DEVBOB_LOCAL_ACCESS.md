# DevBob Local Access Guide

Quick reference for accessing and managing your local DevBob deployment on Kubernetes.

## 🚀 Quick Start

The default namespace is now set to `metabob`, so you can omit `-n metabob` from commands.

### Access Script

Use the `devbob-access.sh` script for common tasks:

```bash
./devbob-access.sh <command>
```

## 📋 Common Commands

### View Status

```bash
# All-in-one status view
./devbob-access.sh status

# List pods
./devbob-access.sh pods
# OR
kubectl get pods

# List services
./devbob-access.sh services
# OR
kubectl get svc

# List Helm releases
helm list
```

### View Logs

```bash
# Follow DevBob logs
./devbob-access.sh logs

# Follow specific pod logs
./devbob-access.sh logs devbob-0
# OR
kubectl logs -f devbob-0

# View recent logs (last 50 lines)
kubectl logs devbob-0 --tail=50
```

### Interactive Access

```bash
# Shell into DevBob pod
./devbob-access.sh shell
# OR
./devbob-access.sh shell devbob-1
# OR
kubectl exec -it devbob-0 -- /bin/bash

# Redis CLI
./devbob-access.sh redis
# OR
kubectl exec -it redis-master-0 -- redis-cli
```

### Restart Services

```bash
# Restart DevBob
./devbob-access.sh restart

# Restart specific service
./devbob-access.sh restart devbob
./devbob-access.sh restart surrealdb

# OR use kubectl directly
kubectl rollout restart statefulset/devbob
kubectl rollout restart deployment/devbob
```

### Port Forwarding

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
# Individual port forwards
kubectl port-forward svc/redis-master 6379:6379 &
kubectl port-forward svc/surrealdb 8000:8000 &
kubectl port-forward svc/devbob 3000:3000 &

# Stop specific port forward
kill %1  # Kill job 1 (first port-forward)
```

## 🔐 Secrets Management

```bash
# List DevBob secrets
./devbob-access.sh secrets
# OR
kubectl get secrets

# View secret details (base64 encoded)
kubectl get secret devbob-secrets -o yaml

# Decode a secret
kubectl get secret devbob-secrets -o jsonpath='{.data.anthropic-api-key}' | base64 -d

# Update a secret
kubectl create secret generic devbob-secrets \
  --from-literal=anthropic-api-key=YOUR_KEY \
  --from-literal=github-token=YOUR_TOKEN \
  --dry-run=client -o yaml | kubectl apply -f -
```

## 📦 Helm Operations

```bash
# List releases
helm list

# Get release values
helm get values devbob

# Upgrade release
helm upgrade devbob ./helm/charts/devbob -f ./helm/charts/devbob.values.yaml

# Redeploy using helmfile
cd helm && helmfile -e local sync

# Uninstall release
helm uninstall devbob
```

## 🔍 Debugging

```bash
# Describe pod (shows events and errors)
kubectl describe pod devbob-0
# OR
./devbob-access.sh describe pod/devbob-0

# Get pod YAML
kubectl get pod devbob-0 -o yaml

# Check resource usage
kubectl top pods

# View events
kubectl get events --sort-by=.metadata.creationTimestamp
```

## 🧹 Cleanup

```bash
# Interactive cleanup (with confirmation)
./devbob-access.sh cleanup

# Manual cleanup
helm uninstall devbob
helm uninstall metabob-rpc-api
helm uninstall surrealdb
helm uninstall redis

# Delete namespace (removes everything)
kubectl delete namespace metabob
```

## 📊 Current Deployment

**Services Running:**
- ✅ DevBob (4 pods) - Agent container
- ✅ Redis (1 pod) - Caching and queuing
- ✅ SurrealDB (1 pod) - Activity templates and metrics
- ⚠️ metabob-rpc-api (failing) - Not required for local DevBob

**Access Points:**
- DevBob HTTP: `devbob:3000` (internal) or `localhost:3000` (with port-forward)
- DevBob Data Bridge: `devbob:8083` (internal)
- Redis: `redis-master:6379` (internal) or `localhost:6379` (with port-forward)
- SurrealDB: `surrealdb:8000` (internal) or `localhost:8000` (with port-forward)

## 🔧 Troubleshooting

### Pod not starting

```bash
# Check events
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>

# Check previous container logs (if restarting)
kubectl logs <pod-name> --previous
```

### Service not accessible

```bash
# Check endpoints
kubectl get endpoints

# Check service
kubectl get svc <service-name>

# Test connectivity from another pod
kubectl run test-curl --rm -i --restart=Never --image=curlimages/curl:latest -- curl http://devbob:3000
```

### Helm deployment issues

```bash
# Preview changes before applying
cd helm && helmfile -e local diff

# Reinstall release
helm uninstall devbob
cd helm && helmfile -e local sync
```

## 📚 Additional Resources

- Helm charts: `./helm/charts/`
- Environment values: `./helm/charts/*.values.yaml`
- Helmfile config: `./helm/helmfile.yaml`

## 🎯 Quick Commands Reference

```bash
# Most common operations
./devbob-access.sh status    # Check everything
./devbob-access.sh logs      # Watch logs
./devbob-access.sh shell     # Open shell
./devbob-access.sh restart   # Restart DevBob
./devbob-access.sh forward   # Port forward services
```
