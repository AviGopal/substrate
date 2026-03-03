# Metabob Stack - Local Kubernetes Deployment Guide

**Status:** ✅ Production Ready  
**Date:** February 26, 2026  
**Environment:** Local Kubernetes (Docker Desktop)

## Overview

This guide covers the complete deployment of the Metabob stack on local Kubernetes, including:
- **Redis** - Session storage and caching
- **SurrealDB** - Graph database for activities and sessions
- **DevBob** - AI agent with ACP server for multi-agent workflows

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Kubernetes Namespace: metabob           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐     ┌──────────┐  │
│  │   DevBob     │─────→│  SurrealDB   │     │  Redis   │  │
│  │              │      │              │     │          │  │
│  │ Port: 3000   │      │ Port: 8000   │     │Port: 6379│  │
│  │ (ACP Server) │      │ (In-Memory)  │     │(Master)  │  │
│  └──────────────┘      └──────────────┘     └──────────┘  │
│         │                                                   │
│         │ (Activities, Sessions, Templates)                │
│         ↓                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Persistent Volume (workspace)               │  │
│  │          /workspace (5Gi)                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Redis
- **Purpose:** Session storage, caching
- **Version:** 7.x (latest)
- **Mode:** Master-only (no replicas for local)
- **Persistence:** Disabled (in-memory)
- **Port:** 6379

### 2. SurrealDB
- **Purpose:** Graph database for activities, sessions, templates
- **Version:** 2.3.10
- **Mode:** In-memory (no persistence for local)
- **Port:** 8000
- **Auth:** root/root

### 3. DevBob
- **Purpose:** AI agent with ACP server
- **Version:** local-fixed (896MB)
- **Ports:** 3000 (ACP), 8083 (Data Bridge)
- **Dependencies:** Redis, SurrealDB, Anthropic API
- **Features:**
  - ACP (Agent Client Protocol) server
  - Bootstrap templates (6 templates)
  - Lifecycle hooks (7 hooks)
  - Plugin system (anthropic-auth, openauth)

## Prerequisites

1. **Kubernetes Cluster:** Docker Desktop with Kubernetes enabled
2. **kubectl:** Configured to use docker-desktop context
3. **helm:** Version 3.x
4. **helmfile:** For orchestrated deployments

Verify prerequisites:
```bash
kubectl config current-context  # Should show: docker-desktop
kubectl get nodes              # Should show: docker-desktop Ready
helm version                   # Should show: v3.x
helmfile version              # Should show: v0.x
```

## Quick Start

### Deploy Full Stack

```bash
# From the repository root
cd helm

# Deploy all components (Redis, SurrealDB, DevBob)
helmfile -f helmfile.yaml sync

# Wait for all pods to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=devbob -n metabob --timeout=120s
```

### Verify Deployment

```bash
# Run validation script
./scripts/validate-metabob-stack.sh

# Expected output:
# ✓ All checks passed!
# Metabob Stack Status:
#   - Redis:     Running
#   - SurrealDB: Running
#   - DevBob:    Running (ACP Ready)
```

### Check Pod Status

```bash
kubectl get pods -n metabob

# Expected output:
# NAME                         READY   STATUS    RESTARTS   AGE
# devbob-cccfc4478-jtsm5       1/1     Running   0          10m
# redis-master-0               1/1     Running   0          10m
# surrealdb-65576c4c47-jq8fn   1/1     Running   0          10m
```

## Step-by-Step Deployment

### 1. Deploy Redis

```bash
cd helm
helmfile -f helmfile.yaml sync --selector name=redis
```

**Verify:**
```bash
kubectl get pods -n metabob -l app.kubernetes.io/name=redis
kubectl logs -n metabob redis-master-0 --tail=10
```

### 2. Deploy SurrealDB

```bash
helmfile -f helmfile.yaml sync --selector name=surrealdb
```

**Verify:**
```bash
kubectl get pods -n metabob -l app=surrealdb
kubectl logs -n metabob -l app=surrealdb --tail=20

# Should see: "Started web server on 0.0.0.0:8000"
```

### 3. Deploy DevBob

```bash
helmfile -f helmfile.yaml sync --selector name=devbob
```

**Verify:**
```bash
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob
kubectl logs -n metabob -l app.kubernetes.io/name=devbob | grep "acp-command setup connection"

# Should see: "INFO service=acp-command setup connection"
```

## Configuration

### Environment-Specific Values

Configuration files are located in `helm/charts/`:

1. **redis.values.yaml** - Redis configuration
2. **surrealdb.values.yaml** - SurrealDB configuration
3. **devbob.values.yaml** - DevBob configuration

### Key Configuration Options

#### DevBob Environment Variables

```yaml
env:
  ANTHROPIC_API_KEY: "sk-ant-api03-..." # Required
  METABOB_API_URL: "http://metabob-rpc-api" # Optional (graceful fallback)
  SURREAL_HOST: "surrealdb"
  SURREAL_PORT: "8000"
  SURREAL_USER: "root"
  SURREAL_PASS: "root"
  WAIT_FOR_BACKEND: "false"  # Skip backend wait for faster startup
  SKIP_CONFIG: "true"         # Skip auto-configuration
  LOG_LEVEL: "INFO"
```

#### Resource Limits

```yaml
resources:
  limits:
    cpu: 2000m
    memory: 2Gi
  requests:
    cpu: 500m
    memory: 512Mi
```

## Testing End-to-End

### 1. Test SurrealDB Connectivity

```bash
kubectl port-forward -n metabob svc/surrealdb 8000:8000 &
curl http://localhost:8000/health
# Should return HTML (Surrealist UI)
```

### 2. Test Redis Connectivity

```bash
kubectl port-forward -n metabob svc/redis-master 6379:6379 &
redis-cli -h localhost ping
# Should return: PONG
```

### 3. Test DevBob ACP Server

```bash
kubectl port-forward -n metabob svc/devbob 3000:3000 &
curl http://localhost:3000/config | jq .username
# Should return: "unknown" (config endpoint works)
```

### 4. Test ACP Delegation

From a parent OpenCode instance with `acp_delegate` tool:

```typescript
const result = await acp_delegate({
  target: "docker://devbob",
  taskDescription: "Test DevBob connectivity",
  prompt: "Echo back: 'DevBob is operational!'"
})

console.log(result.response)
// Should echo back the message
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod -n metabob <pod-name>

# Check logs
kubectl logs -n metabob <pod-name> --previous

# Check events
kubectl get events -n metabob --sort-by='.lastTimestamp'
```

### DevBob Crash Loop

**Symptom:** Pod status shows `CrashLoopBackOff`

**Common Causes:**
1. Missing `ANTHROPIC_API_KEY`
2. Invalid image tag
3. Plugin installation failed

**Fix:**
```bash
# Check logs for error
kubectl logs -n metabob -l app.kubernetes.io/name=devbob

# If API key missing, update helm values:
# helm/charts/devbob.values.yaml
secrets:
  anthropicApiKey: "sk-ant-api03-..."

# Redeploy
cd helm && helmfile -f helmfile.yaml apply
```

### SurrealDB Connection Failed

**Symptom:** DevBob logs show "Cannot connect to SurrealDB"

**Fix:**
```bash
# Verify SurrealDB is running
kubectl get pods -n metabob -l app=surrealdb

# Check SurrealDB logs
kubectl logs -n metabob -l app=surrealdb

# Verify service exists
kubectl get svc -n metabob surrealdb

# If service missing, redeploy SurrealDB
cd helm && helmfile -f helmfile.yaml sync --selector name=surrealdb
```

### ACP Server Not Initializing

**Symptom:** No "acp-command setup connection" log

**Fix:**
```bash
# Check if pod is actually running
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob

# Check recent logs
kubectl logs -n metabob -l app.kubernetes.io/name=devbob --tail=100

# If plugins failed to load, verify image
kubectl describe pod -n metabob -l app.kubernetes.io/name=devbob | grep Image
# Should show: devbob:local-fixed
```

## Cleanup

### Remove Specific Component

```bash
cd helm

# Remove DevBob only
helmfile -f helmfile.yaml destroy --selector name=devbob

# Remove SurrealDB only
helmfile -f helmfile.yaml destroy --selector name=surrealdb

# Remove Redis only
helmfile -f helmfile.yaml destroy --selector name=redis
```

### Remove Entire Stack

```bash
cd helm
helmfile -f helmfile.yaml destroy

# Or manually:
kubectl delete namespace metabob
```

### Remove Persistent Volumes

```bash
kubectl delete pvc -n metabob --all
```

## Maintenance

### Upgrade Component

```bash
cd helm

# Update image tag in values file
# helm/charts/devbob.values.yaml
image:
  tag: new-version

# Apply changes
helmfile -f helmfile.yaml apply
```

### View Logs in Real-Time

```bash
# DevBob logs
kubectl logs -n metabob -f -l app.kubernetes.io/name=devbob

# SurrealDB logs
kubectl logs -n metabob -f -l app=surrealdb

# Redis logs
kubectl logs -n metabob -f redis-master-0
```

### Check Resource Usage

```bash
kubectl top pod -n metabob

# Expected:
# NAME                         CPU(cores)   MEMORY(bytes)
# devbob-xxx                   50m          512Mi
# redis-master-0               10m          64Mi
# surrealdb-xxx                30m          256Mi
```

## Production Considerations

### Current Setup (Local Development)
- ✅ In-memory databases (fast, no persistence)
- ✅ No replicas (single instance)
- ✅ Minimal resource allocation
- ✅ No TLS/authentication (within cluster)

### Production Requirements
- ❌ Enable persistence (PVCs)
- ❌ Add Redis replicas (HA)
- ❌ Use StatefulSet for SurrealDB (persistent volume)
- ❌ Enable TLS for external access
- ❌ Add authentication for services
- ❌ Deploy metabob-rpc-api (full MCP integration)
- ❌ Add monitoring (Prometheus/Grafana)
- ❌ Set resource quotas and limits

## Next Steps

1. **Test Multi-Agent Workflows**
   - Use `acp_delegate` to delegate tasks to DevBob
   - Test impulse sharing between agents
   - Build sequential and parallel workflows

2. **Deploy Additional Components** (Optional)
   - Metabob RPC API (requires Postgres, MinIO)
   - Metabob Dashboard
   - Slack Bot integration

3. **Production Hardening**
   - Enable persistence for Redis and SurrealDB
   - Add replicas for high availability
   - Configure TLS certificates
   - Set up monitoring and alerting

## References

- **DevBob ACP Documentation:** `DEVBOB_ACP_SUCCESS_SUMMARY.md`
- **DevBob Usage Guide:** `DEVBOB_ACP_USAGE_GUIDE.md`
- **Quick Status Check:** `DEVBOB_QUICK_STATUS.md`
- **Validation Script:** `scripts/validate-metabob-stack.sh`

## Support

For issues or questions:
1. Run validation script: `./scripts/validate-metabob-stack.sh`
2. Check pod logs: `kubectl logs -n metabob <pod-name>`
3. Review troubleshooting section above
4. Check component-specific documentation

---

**Deployment Status:** ✅ Validated and Working  
**Components:** Redis + SurrealDB + DevBob  
**Kubernetes:** Docker Desktop 1.34.1  
**Last Validated:** February 26, 2026
