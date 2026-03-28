# DevBob Kubernetes Deployment Guide

**Specification**: devbob-k8s-deployment-pattern  
**Last Updated**: 2026-03-01  
**Status**: ENFORCED

This guide documents the **canonical deployment pattern** for DevBob on Kubernetes.

## Quick Start

```bash
# 1. Build the image
docker build -t devbob:latest -f docker/Dockerfile.devbob .

# 2. Deploy via Helm (CANONICAL METHOD)
./deploy-devbob-helm.sh

# 3. Verify deployment
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob
kubectl logs -f $(kubectl get pod -n metabob -l app.kubernetes.io/name=devbob -o name) -n metabob
```

## Canonical Deployment Pattern

### ✅ Helm Chart (RECOMMENDED)

**Location**: `helm/charts/devbob/`

**Why Helm?**
- Declarative configuration management
- Easy upgrades and rollbacks
- Environment-specific values files
- Secrets management via Helm values
- Industry standard for Kubernetes deployments

**Deployment Command**:
```bash
helm upgrade --install devbob helm/charts/devbob/ \
  --namespace metabob \
  --create-namespace \
  --set secrets.anthropicApiKey="$ANTHROPIC_API_KEY" \
  --set secrets.githubToken="$GITHUB_TOKEN" \
  --set secrets.gitUserName="Devbob Agent" \
  --set secrets.gitUserEmail="devbob@metabob.local"
```

### ⚠️ StatefulSet Manifest (DEPRECATED)

**Location**: `k8s-devbob-statefulset.yaml`

**Status**: Deprecated as of 2026-03-01

**Why deprecated?**
- Multiple configuration files to maintain
- No built-in upgrade/rollback mechanism
- Harder to customize per environment
- Conflicts with Helm chart configuration

**Migration**: Use `deploy-devbob-helm.sh` instead of `deploy-devbob-k8s-git.sh`

## Configuration Specification

Based on trace analysis (`TRACE_devbob-k8s-deployment-pattern.md`), the deployment must meet these requirements:

### Image Configuration
- **Repository**: `devbob`
- **Tag**: `latest` (for local development)
- **Pull Policy**: `Never` (use local image)

### Port Configuration
- **ACP Server Port**: `8080` (not 3000)
- **Service Port**: `8080`
- **Health Probe Port**: `8080`

### Command and Arguments
```yaml
command:
  - opencode
args:
  - acp
  - --hostname
  - "0.0.0.0"
  - --port
  - "8080"
  - --print-logs  # CRITICAL: Required for log visibility
  - --log-level
  - "INFO"
```

### Environment Variables

**Required Secrets** (via secretKeyRef):
- `ANTHROPIC_API_KEY` - Anthropic Claude API key
- `GITHUB_TOKEN` - GitHub PAT with repo, workflow scopes
- `GIT_USER_NAME` - Git commit author name
- `GIT_USER_EMAIL` - Git commit author email

**Configuration**:
- `HOME=/workspace` - Required for .local directory creation
- `METABOB_API_URL=http://metabob-rpc-api` - RPC API service
- `SURREAL_HOST=surrealdb` - SurrealDB service
- `SURREAL_PORT=8000`
- `SURREAL_USER=root`
- `SURREAL_PASS=root`
- `SURREAL_NAMESPACE=metabob`
- `SURREAL_DATABASE=devbob`
- `WAIT_FOR_BACKEND=false`
- `SKIP_CONFIG=true`
- `LOG_LEVEL=INFO`

### Health Probes

**Liveness Probe**:
```yaml
httpGet:
  path: /health
  port: 8080
initialDelaySeconds: 30
periodSeconds: 10
timeoutSeconds: 5
failureThreshold: 3
```

**Readiness Probe**:
```yaml
httpGet:
  path: /health
  port: 8080
initialDelaySeconds: 10
periodSeconds: 5
timeoutSeconds: 3
failureThreshold: 3
```

**Why HTTP probes?**
- More informative than TCP probes
- Can validate application health, not just port availability
- Better debugging (can curl /health endpoint manually)

### Persistence

**Volume**: `/workspace`
- **Size**: 10Gi (configurable)
- **Access Mode**: ReadWriteOnce
- **Purpose**: Stores session data, git repositories, activity results

### Security Context

**Pod Security Context**:
```yaml
fsGroup: 1000
```

**Container Security Context**:
```yaml
runAsNonRoot: false
runAsUser: 0  # Running as root for local development
```

**Note**: Running as root is acceptable for local development environments. For production, consider running as non-root user.

## Deployment Workflows

### Development (Local Cluster)

```bash
# Build local image
docker build -t devbob:latest -f docker/Dockerfile.devbob .

# Deploy via Helm with local values
./deploy-devbob-helm.sh

# Watch pod startup
kubectl logs -f -l app.kubernetes.io/name=devbob -n metabob
```

### Staging/Production

```bash
# Build and tag image
docker build -t devbob:v1.0.0 -f docker/Dockerfile.devbob .
docker tag devbob:v1.0.0 registry.example.com/devbob:v1.0.0
docker push registry.example.com/devbob:v1.0.0

# Deploy via Helm with custom values
helm upgrade --install devbob helm/charts/devbob/ \
  --namespace metabob \
  --values helm/charts/devbob/values-prod.yaml \
  --set image.repository=registry.example.com/devbob \
  --set image.tag=v1.0.0 \
  --set image.pullPolicy=IfNotPresent
```

## Troubleshooting

### Issue: ACP Server Hangs After Hook Initialization

**Symptom**: Pod restarts continuously, logs show hooks registered but no "listening on port" message

**Root Cause Analysis** (from trace):
1. Port mismatch between service (3000) and ACP server (8080)
2. Missing `--print-logs` flag prevents log visibility
3. Health probes on wrong port (3000 vs 8080)

**Solution** (ENFORCED in this deployment):
- ✅ Port standardized to 8080 across all configs
- ✅ `--print-logs` flag added to command args
- ✅ Health probes updated to port 8080
- ✅ Direct `opencode` command (no wrapper script)

**Validation Commands**:
```bash
# Check pod is running
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob

# Check logs for "listening on port"
kubectl logs -f $(kubectl get pod -n metabob -l app.kubernetes.io/name=devbob -o name) | grep -i "listening"

# Test health endpoint
kubectl exec $(kubectl get pod -n metabob -l app.kubernetes.io/name=devbob -o name) -n metabob -- curl -s http://localhost:8080/health

# Check if port is open
kubectl exec $(kubectl get pod -n metabob -l app.kubernetes.io/name=devbob -o name) -n metabob -- netstat -tlnp | grep 8080
```

### Issue: Image Pull Errors

**Symptom**: `ErrImageNeverPull` or `ImagePullBackOff`

**Solution**:
1. Verify image exists locally: `docker images | grep devbob`
2. Check pullPolicy is `Never` in values.yaml
3. Ensure image tag matches: `devbob:latest`

### Issue: Pod Crashes with CrashLoopBackOff

**Symptom**: Pod restarts > 5 times

**Diagnosis**:
```bash
# Check recent logs
kubectl logs $(kubectl get pod -n metabob -l app.kubernetes.io/name=devbob -o name) -n metabob --tail=100

# Check previous container logs
kubectl logs $(kubectl get pod -n metabob -l app.kubernetes.io/name=devbob -o name) -n metabob --previous

# Describe pod for events
kubectl describe pod -n metabob -l app.kubernetes.io/name=devbob
```

### Issue: Secrets Not Injected

**Symptom**: `ANTHROPIC_API_KEY` not found in environment

**Solution**:
```bash
# Verify secret exists
kubectl get secret devbob-secrets -n metabob

# Check secret data
kubectl get secret devbob-secrets -n metabob -o jsonpath='{.data}' | jq

# Verify env var in pod
kubectl exec $(kubectl get pod -n metabob -l app.kubernetes.io/name=devbob -o name) -n metabob -- env | grep ANTHROPIC
```

## Validation Checklist

After deployment, verify:

- [ ] Pod is Running (not CrashLoopBackOff)
- [ ] ACP server logs "listening on port 8080"
- [ ] Health probe passes: `curl http://localhost:8080/health`
- [ ] Secrets injected: `env | grep ANTHROPIC_API_KEY`
- [ ] Backend accessible: `curl http://metabob-rpc-api/health`
- [ ] Git configured: `git config --list`
- [ ] Workspace writable: `touch /workspace/test && rm /workspace/test`

## Migration from StatefulSet to Helm

If you have an existing StatefulSet deployment:

```bash
# 1. Scale down StatefulSet
kubectl scale statefulset devbob -n metabob --replicas=0

# 2. Backup workspace data (if needed)
kubectl exec devbob-0 -n metabob -- tar czf /tmp/workspace-backup.tar.gz /workspace
kubectl cp metabob/devbob-0:/tmp/workspace-backup.tar.gz ./workspace-backup.tar.gz

# 3. Delete StatefulSet (keeps PVCs)
kubectl delete statefulset devbob -n metabob --cascade=orphan

# 4. Deploy via Helm
./deploy-devbob-helm.sh

# 5. Restore workspace data (if needed)
# Note: Helm deployment creates new PVC, manual restore required if data needed
```

## References

- **Trace Analysis**: `TRACE_devbob-k8s-deployment-pattern.md`
- **Helm Chart**: `helm/charts/devbob/`
- **Dockerfile**: `docker/Dockerfile.devbob`
- **Deployment Script**: `deploy-devbob-helm.sh`
- **Enforcement Summary**: `ENFORCEMENT_devbob-k8s-deployment-pattern.md` (generated after enforcement)

## Architecture Decision Records

### ADR-001: Use Helm over Raw Manifests

**Decision**: Standardize on Helm chart as canonical deployment method

**Context**: 
- Multiple deployment patterns existed (Helm Deployment, StatefulSet, platform repo)
- Configuration drift between different manifests
- Maintenance burden of keeping multiple configs in sync

**Consequences**:
- ✅ Single source of truth for deployment configuration
- ✅ Easy environment-specific customization via values files
- ✅ Built-in rollback and upgrade capabilities
- ⚠️ Requires Helm CLI (acceptable for Kubernetes workflows)
- ⚠️ Deprecated StatefulSet manifest (backward compatibility maintained)

### ADR-002: HTTP Probes over TCP Probes

**Decision**: Use HTTP health probes on `/health` endpoint

**Context**:
- StatefulSet used TCP probes on port 3000
- TCP probes only check if port is open, not if application is healthy
- HTTP probes can validate application logic

**Consequences**:
- ✅ Better health visibility
- ✅ Can manually test health endpoint
- ✅ Application can return detailed health info
- ⚠️ Requires `/health` endpoint implementation

### ADR-003: Direct opencode Command (No Entrypoint Wrapper)

**Decision**: Call `opencode acp` directly, bypassing entrypoint.sh wrapper

**Context**:
- Dockerfile had entrypoint-self-config.sh wrapper
- Wrapper ran configure-vessel-for-environment activity
- Kubernetes deployment bypassed wrapper, causing confusion

**Consequences**:
- ✅ Simpler startup path (easier debugging)
- ✅ Faster startup (no self-config activity)
- ✅ Explicit command/args in manifest (clear what runs)
- ⚠️ No automatic vessel configuration (manual setup required)
- ⚠️ SKIP_CONFIG=true required to prevent config generation attempts

### ADR-004: Port 8080 as Standard

**Decision**: Standardize ACP server on port 8080

**Context**:
- Manifests specified port 3000
- Current deployment used port 8080
- Health probes checked port 3000 (mismatch)
- Port mismatch caused health probe failures

**Consequences**:
- ✅ Port consistency across all configurations
- ✅ Health probes aligned with actual server port
- ✅ Follows common convention (8080 for web services)
- ⚠️ Migration required for existing deployments on port 3000

---

**Last Enforced**: 2026-03-01  
**Next Review**: After first production deployment validation
