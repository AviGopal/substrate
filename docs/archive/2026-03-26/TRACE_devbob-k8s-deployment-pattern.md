# Trace Analysis: devbob-k8s-deployment-pattern

**Specification ID**: devbob-k8s-deployment-pattern  
**Date**: 2026-03-01  
**Status**: PARTIALLY_IMPLEMENTED (ACP server initialization issue)

## Specification Description

DevBob Kubernetes deployment using helmfile with local images (devbob:latest with pullPolicy Never), proper secrets management via Helm secretKeyRef, ACP server on port 8080, HOME=/workspace for .local directory creation, running as root for local development, with backend dependencies (redis, surrealdb, metabob-rpc-api) in the metabob namespace.

## Expected Behavior

1. **Deployment**: DevBob pod should start successfully with ACP server listening on configured port
2. **Probes**: Readiness probe passes on /health endpoint
3. **Secrets**: Secrets properly injected (ANTHROPIC_API_KEY available)
4. **Image**: Local devbob:latest image used without pull errors
5. **Backend**: All backend services accessible via cluster DNS (redis-master.metabob.svc, surrealdb.metabob.svc, metabob-rpc-api.metabob.svc)

## Current State Analysis

### Status: PARTIALLY_IMPLEMENTED

**Current Issue**: ACP server hangs after hook initialization without starting to listen - validation shows pod is Running but restarting (3 restarts observed with Exit Code: 0).

**Evidence**: 
- Pod `devbob-64866fb4d8-6ksdj` shows continuous restart pattern
- Logs show hooks initialized: `INFO service=turn-lifecycle name=impulse-learning-flush priority=120 totalHooks=7 hook registered`
- No "listening on port" or "ACP server ready" messages in logs
- Graceful shutdown (Exit Code: 0) suggests timeout rather than crash

## Component Analysis

### 1. Helm Chart Configuration (helm/charts/devbob/)

**File**: `helm/charts/devbob/values.yaml:6`

```yaml
image:
  repository: devbob
  tag: unified-test  # ⚠️ MISMATCH with deployed image
  pullPolicy: Never

service:
  port: 3000  # ⚠️ Different from current deployment (8080)
  
probes:
  httpGet:
    path: /health
    port: 3000
```

**Gap**: Image tag and port configuration don't match actual deployment

---

**File**: `helm/charts/devbob/templates/deployment.yaml:31`

- Creates standard Deployment (not StatefulSet)
- Uses HTTP health probes on `/health`
- Secrets injected via `secretKeyRef`
- **Missing**: No explicit `command` or `args` specification

**Gap**: Current deployment uses different command/args than Helm template expects

---

**File**: `helm/charts/devbob/templates/secrets.yaml:9`

```yaml
data:
  anthropic-api-key: {{ .Values.secrets.anthropicApiKey | b64enc }}
  github-token: {{ .Values.secrets.githubToken | b64enc }}
  git-user-name: {{ .Values.secrets.gitUserName | b64enc }}
  git-user-email: {{ .Values.secrets.gitUserEmail | b64enc }}
```

**Status**: ✅ CORRECTLY IMPLEMENTED

---

### 2. Alternative StatefulSet Manifest

**File**: `k8s-devbob-statefulset.yaml:43`

```yaml
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: devbob
        image: devbob:local-fixed  # Different tag
        command: ["/usr/local/bin/entrypoint.sh"]
        args:
        - acp
        - --port
        - "3000"
        - --hostname
        - "0.0.0.0"
        - --print-logs  # ⚠️ Missing in current deployment
        - --log-level
        - INFO
        
        livenessProbe:
          tcpSocket:  # ⚠️ Different from Helm (HTTP)
            port: 3000
```

**Gap**: 
- CONFLICT with Helm Deployment approach
- Different health probe strategy (TCP vs HTTP)
- Explicit entrypoint wrapper vs direct opencode command

---

### 3. Container Configuration

**File**: `docker/Dockerfile.devbob:67`

```dockerfile
FROM debian:12-slim AS runtime

# Install runtime dependencies + Bun
RUN apt-get install ca-certificates curl git python3 unzip

# Copy metabob-cli venv and opencode binary
COPY --from=opencode-binary /opt/opencode/bin/opencode /usr/local/bin/opencode

# Copy self-configuration entrypoint
COPY docker/entrypoint-self-config.sh /usr/local/bin/entrypoint.sh

EXPOSE 3000 8080 8082

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["acp", "--port", "3000", "--hostname", "0.0.0.0"]
```

**Status**: ✅ Image builds correctly and includes all required components

---

**File**: `docker/entrypoint-self-config.sh:1`

This script:
1. Detects environment (dev/staging/prod)
2. Validates backend connectivity
3. Checks ANTHROPIC_API_KEY
4. Runs `configure-vessel-for-environment` activity (if SKIP_CONFIG=false)
5. Executes `opencode "$@"`

**Gap**: Current k8s deployment BYPASSES this entrypoint and calls `opencode` directly

---

**File**: `docker/entrypoint.sh:1` (Alternative)

More complex entrypoint that:
1. Starts `metabob-cli dashboard` (SSE mode) on port 8001
2. Starts `opencode acp` server
3. Manages both processes with cleanup traps

**Gap**: NOT USED in any current k8s deployment

---

### 4. Deployment Tooling

**File**: `deploy-devbob-k8s-git.sh:1`

Script that:
1. Verifies `devbob:local-fixed` image exists
2. Creates/updates `devbob-secrets` secret
3. Applies `k8s-devbob-statefulset.yaml`
4. Waits for rollout
5. Validates git configuration in pods

**Gap**: Uses StatefulSet manifest, not Helm chart

---

### 5. Current Deployment (via opencode.ai)

Based on `kubectl describe pod`:

```yaml
command: ["opencode"]
args:
  - acp
  - --hostname=0.0.0.0
  - --port=8080  # ⚠️ Different from manifests (3000)
  
env:
  - HOME: /workspace
  
image: devbob:latest  # ⚠️ Different from both unified-test and local-fixed
```

**Key Differences**:
- Port 8080 (not 3000)
- Direct `opencode` command (bypasses entrypoint.sh)
- Missing `--print-logs` flag
- Image tag `latest` (unclear which version)

## Data Flow Tracing

```
┌─────────────────────────────────────────────────────────────────┐
│ Entry: kubectl apply -f <manifest>                              │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ Pod Creation: Kubernetes scheduler assigns pod to node          │
│ - Pulls image (or uses local with pullPolicy: Never)            │
│ - Mounts volumes (/workspace)                                   │
│ - Injects secrets as environment variables                      │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ Container Start: ENTRYPOINT execution                           │
│                                                                  │
│ Path A (Dockerfile default):                                    │
│   /usr/local/bin/entrypoint.sh acp --port 3000 ...              │
│   → Environment validation                                      │
│   → Backend connectivity check                                  │
│   → Self-configuration activity (if enabled)                    │
│   → exec opencode acp ...                                       │
│                                                                  │
│ Path B (Current k8s deployment):                                │
│   opencode acp --hostname=0.0.0.0 --port=8080                  │
│   → Direct execution, no wrapper                                │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ OpenCode Initialization:                                         │
│ 1. Load configuration (from /workspace/.opencode/opencode.json) │
│ 2. Initialize storage backend (SurrealDB)                       │
│ 3. Register turn lifecycle hooks                                │
│    - memory-management (priority 10)                            │
│    - activity-recommendation-injection (priority 15)            │
│    - metabob-context-preparation (priority 20)                  │
│    - post-turn-cleanup (priority 100)                           │
│    - session-memory-optimization (priority 110)                 │
│    - impulse-learning-init (priority 1)                         │
│    - impulse-learning-flush (priority 120)                      │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ HANG POINT: After hook registration                         │
│ Expected: ACP server binds to port and logs "listening on..."  │
│ Actual: Process appears to hang or timeout                      │
│ Result: Container exits with code 0 (graceful shutdown)         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ Health Probe Failure:                                            │
│ - Liveness probe: httpGet /health:3000 or tcpSocket:3000       │
│ - Readiness probe: same as liveness                             │
│ - Failure threshold exceeded → Pod restart                      │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ Restart Loop: Pod continuously restarts (CrashLoopBackOff)      │
└─────────────────────────────────────────────────────────────────┘
```

## Known Issues

### Issue 1: ACP Server Hang After Hook Initialization

**Severity**: HIGH (Blocks deployment)

**Evidence**:
- Last log line: `INFO service=turn-lifecycle name=impulse-learning-flush priority=120 totalHooks=7 hook registered`
- No subsequent "listening on port" message
- Pod exits with code 0 after timeout
- 3+ restart cycles observed

**Possible Root Causes**:

1. **Port Mismatch**: 
   - Manifests specify port 3000
   - Current deployment uses port 8080
   - Health probes check port 3000
   - Server might be trying to bind to wrong port or probe fails immediately

2. **Missing `--print-logs` Flag**:
   - StatefulSet manifest includes `--print-logs`
   - Current deployment missing this flag
   - Server might be running but not outputting status logs

3. **Configuration File Issue**:
   - `SKIP_CONFIG=true` prevents config generation
   - ACP server might require valid config to start
   - Config file location: `/workspace/.opencode/opencode.json`

4. **Entrypoint Bypass**:
   - Current deployment calls `opencode` directly
   - Dockerfile expects `entrypoint.sh` wrapper
   - Missing environment setup or validation steps

5. **SurrealDB Connection Blocking**:
   - Initialization might be waiting for SurrealDB connection
   - Connection might be timing out silently
   - No explicit error in logs

**Diagnostic Steps**:

```bash
# Check actual command/args in running pod
kubectl describe pod <pod-name> -n metabob | grep -A 10 "Command:\|Args:"

# Check if port is actually open
kubectl exec <pod-name> -n metabob -- netstat -tlnp | grep :3000

# Check config file
kubectl exec <pod-name> -n metabob -- cat /workspace/.opencode/opencode.json

# Test manual start
kubectl exec -it <pod-name> -n metabob -- /bin/bash
> opencode acp --port 3000 --hostname 0.0.0.0 --print-logs --log-level DEBUG
```

---

### Issue 2: Multiple Deployment Patterns

**Severity**: MEDIUM (Causes confusion)

**Evidence**:
- Helm Deployment in `helm/charts/devbob/`
- StatefulSet in `k8s-devbob-statefulset.yaml`
- StatefulSet in `repos/platform/deployments/metabob/charts/devbob/`
- Current deployment (unknown source)

**Impact**: 
- Unclear which is canonical
- Different configurations lead to inconsistency
- Maintenance burden across multiple files

**Recommendation**: Choose ONE pattern and deprecate others

---

### Issue 3: Image Tag Inconsistency

**Severity**: LOW (but causes confusion)

**Evidence**:
- `unified-test` in Helm values.yaml
- `local-fixed` in k8s-devbob-statefulset.yaml
- `latest` in current deployment

**Impact**: Difficult to track which image version is deployed

**Recommendation**: Standardize on single tag naming convention (e.g., `devbob:v1.0.0` or `devbob:local-dev`)

## Architectural Patterns

### ✅ Secrets Management (Implemented Correctly)

```yaml
env:
- name: ANTHROPIC_API_KEY
  valueFrom:
    secretKeyRef:
      name: devbob-secrets
      key: anthropic-api-key
```

**Status**: Working as designed across all deployment methods

---

### ✅ Service Discovery (Implemented Correctly)

Backend services accessible via Kubernetes DNS:
- `redis-master.metabob.svc.cluster.local`
- `surrealdb.metabob.svc.cluster.local`
- `metabob-rpc-api.metabob.svc.cluster.local`

Environment variables properly configured:
- `METABOB_API_URL=http://metabob-rpc-api`
- `SURREAL_HOST=surrealdb`

---

### ⚠️ Health Check Strategy (Inconsistent)

**Helm Deployment**:
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
```

**StatefulSet**:
```yaml
livenessProbe:
  tcpSocket:
    port: 3000
```

**Recommendation**: Standardize on HTTP probes (more informative)

---

### ⚠️ Entrypoint Strategy (Needs Decision)

**Option A**: Wrapper script with validation
- Pro: Environment validation, self-configuration, backend health checks
- Con: Additional complexity, longer startup time

**Option B**: Direct opencode command
- Pro: Simpler, faster startup
- Con: No environment validation, manual configuration required

**Current**: Mixed approach causing issues

**Recommendation**: 
- If using Dockerfile entrypoint.sh, ensure all k8s manifests use it
- If bypassing entrypoint, update Dockerfile CMD to match
- Document decision in deployment guide

## Validation Checklist

| Test | Current Status | Method |
|------|----------------|---------|
| Pod starts successfully | ❌ FAIL (restarts) | `kubectl get pods -n metabob \| grep devbob` |
| ACP server listens | ❌ FAIL (hangs) | `kubectl logs <pod> -n metabob \| grep listening` |
| Health probes pass | ❓ UNKNOWN | `kubectl describe pod <pod> -n metabob` |
| Secrets injected | ✅ LIKELY PASS | `kubectl exec <pod> -n metabob -- env \| grep ANTHROPIC` |
| Backend accessible | ❓ UNKNOWN | `kubectl exec <pod> -n metabob -- curl http://metabob-rpc-api/health` |

## Recommendations

### Priority: HIGH

1. **Fix ACP server hang**
   - Align command/args/flags across all deployment methods
   - Add `--print-logs` flag for visibility
   - Ensure port consistency (choose 3000 or 8080, update all configs)
   - Test with DEBUG log level

2. **Standardize deployment pattern**
   - Choose Helm or raw StatefulSet manifest
   - Deprecate unused configurations
   - Document canonical deployment method

### Priority: MEDIUM

3. **Align health probe strategy**
   - Use HTTP probes consistently
   - Implement `/health` endpoint if not already present
   - Document expected responses

4. **Document entrypoint strategy**
   - Decide on wrapper vs direct command
   - Update Dockerfile and manifests accordingly
   - Document environment requirements

### Priority: LOW

5. **Consolidate image tagging**
   - Choose single tag convention
   - Update build scripts
   - Document tagging strategy

## Next Steps for Downstream Tasks

1. **Validation Task**: Use this trace to create validation harness
   - Test each configuration independently
   - Compare results against expected behavior
   - Generate validation report

2. **Enforcement Task**: Use validation results to enforce correct pattern
   - Update non-compliant configurations
   - Remove deprecated patterns
   - Run enforcement verification

3. **Documentation Task**: Create deployment guide
   - Document chosen pattern
   - Provide troubleshooting steps
   - Include validation commands

## References

- Git commit: `ef64d67` - "Rename opencode-server to devbob in K8s deployment"
- Helm chart: `helm/charts/devbob/`
- StatefulSet: `k8s-devbob-statefulset.yaml`
- Deployment script: `deploy-devbob-k8s-git.sh`
- Dockerfile: `docker/Dockerfile.devbob`
- Entrypoints: `docker/entrypoint.sh`, `docker/entrypoint-self-config.sh`

---

**Trace completed**: 2026-03-01  
**Next action**: Create validation harness to test each configuration variant
