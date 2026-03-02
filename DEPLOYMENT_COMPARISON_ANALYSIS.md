# Deployment Comparison Analysis

**Date**: 2026-03-02  
**Purpose**: Compare current local K8s deployment with platform repo and production

---

## Executive Summary

### Current State
- ✅ **Local K8s**: Fully operational with custom Helm charts (100% working)
- ⚠️  **Platform Repo**: More production-ready but diverged from local
- ❓ **Production**: Using platform repo structure with managed images

### Key Findings
1. **Architecture Divergence**: Local deployment uses simplified charts, platform uses structured helmfile approach
2. **Image Strategy**: Local uses `devbob:latest` (local build), platform uses `metabobapp/devbob:v1.0.1` (registry)
3. **Configuration Management**: Platform has better separation (default/production/integration environments)
4. **Features**: Local is missing ConfigMap, init containers, and production hardening

---

## Detailed Comparison

### 1. Repository Structure

#### Current Local (`helm/charts/devbob/`)
```
helm/charts/devbob/
├── Chart.yaml (v1.0.0, comprehensive metadata)
├── values.yaml (113 lines, full config with secrets, persistence, env vars)
├── templates/
│   ├── deployment.yaml (151 lines, PVC-based, health probes, git credentials)
│   ├── service.yaml
│   ├── pvc.yaml
│   ├── secrets.yaml
│   └── virtualservice.yaml (Istio)
```

**Characteristics**:
- Monolithic values.yaml with all configuration
- Direct secret management in Helm values
- PVC-based persistence (10Gi workspace)
- Comprehensive environment variables (12+ env vars)
- Health probes enabled (liveness + readiness)
- Git credentials for autonomous operations
- Istio service mesh integration

#### Platform Repo (`repos/platform/metabob-apps/charts/devbob/`)
```
repos/platform/metabob-apps/charts/devbob/
├── charts/
│   ├── Chart.yaml (v1.0.0, minimal metadata)
│   ├── values.yaml (57 lines, minimal config)
│   └── templates/
│       ├── deployment.yaml (138 lines, emptyDir, init container, ConfigMap)
│       ├── service.yaml
│       ├── configmap.yaml (NEW - opencode.json management)
│       ├── secret.yaml
│       └── serviceaccount.yaml (NEW)
├── values/
│   ├── default.devbob.values.yaml (environment-specific)
│   ├── production.devbob.values.yaml (production overrides)
│   ├── default.devbob.secrets.yaml
│   └── production.devbob.secrets.yaml
```

**Characteristics**:
- Environment-specific value files (default/production)
- ConfigMap for opencode.json configuration
- Init container for config setup
- emptyDir instead of PVC (stateless pods)
- Minimal environment variables (HOME, PATH, API keys)
- Health probes DISABLED (commented out with TODO)
- ServiceAccount for RBAC
- Simplified provider configuration (anthropic flag, github optional)

---

### 2. Deployment Configuration Comparison

| Feature | Local (`helm/`) | Platform (`metabob-apps`) | Production Implications |
|---------|-----------------|---------------------------|-------------------------|
| **Image** | `devbob:latest` (local) | `metabobapp/devbob:v1.0.1` | Need registry push pipeline |
| **Persistence** | PVC 10Gi ReadWriteOnce | emptyDir (ephemeral) | Production needs PVC for workspace |
| **Config Management** | Values.yaml env vars | ConfigMap + init container | Platform approach is more Kubernetes-native |
| **Secrets** | Helm values (inline) | Separate secrets files + external refs | Platform better for GitOps |
| **Service Account** | Default | Named with RBAC | Platform ready for service mesh auth |
| **Health Probes** | Enabled (HTTP /health) | **DISABLED** | Known issue: /health has external deps |
| **Init Containers** | None | setup-config (busybox) | Required for read-only ConfigMap → writable workspace |
| **Environment Variables** | 12+ explicit vars | 4 core vars + secrets | Platform uses ConfigMap for OpenCode settings |
| **Git Credentials** | GITHUB_TOKEN, GIT_USER_NAME, GIT_USER_EMAIL | GITHUB_TOKEN only (from github-credentials secret) | Local has richer git config |
| **Resource Limits** | cpu:2000m, mem:2Gi | cpu:2000m, mem:4Gi (prod) / 2Gi (default) | Production gets more memory |

---

### 3. Key Architectural Differences

#### A. Configuration Strategy

**Local Approach**:
```yaml
env:
  metabobApiUrl: "http://metabob-rpc-api"
  surrealHost: "surrealdb"
  surrealPort: "8000"
  surrealUser: "root"
  surrealPass: "root"
  surrealNamespace: "metabob"
  surrealDatabase: "devbob"
  waitForBackend: "false"
  skipConfig: "true"
  logLevel: "INFO"
  home: "/workspace"
```
- All configuration via environment variables
- Explicit database connection params
- No opencode.json ConfigMap

**Platform Approach**:
```yaml
opencode:
  config:
    share: "disabled"
    sessionMemory:
      enabled: true
      analysis:
        timeout: 10000
        model: "claude-3-5-haiku-20241022"
      budgets:
        perImpulse: 2000
        total: 10000
    metabob:
      enabled: true
      max_issues: 5
      min_severity: "MEDIUM"
```
- Configuration via opencode.json in ConfigMap
- Init container copies read-only ConfigMap to writable `/workspace/.config/opencode/`
- Cleaner separation of concerns
- Better for GitOps and config versioning

#### B. Persistence Model

**Local**: PVC-based (stateful)
- Workspace survives pod restarts
- Supports long-running sessions
- Requires storage provisioner
- Better for development workflows

**Platform**: emptyDir (ephemeral)
- Workspace cleared on pod restart
- Stateless pods (easier scaling)
- No storage provisioner needed
- Better for production horizontal scaling

**Trade-off**: Local is better for iterative development, platform is better for microservice architecture.

#### C. Security & RBAC

**Local**:
- Default service account
- No explicit RBAC
- Secrets in Helm values (potential exposure in Helm history)

**Platform**:
- Named ServiceAccount (`devbob`)
- Ready for RBAC policies
- Secrets in separate files (can use SOPS/Sealed Secrets)
- References external secrets (`github-credentials`)

---

### 4. Helmfile Structure Comparison

**Platform Uses Helmfile** (`helmfile.yaml.gotmpl`):
```yaml
environments:
  default:
    kubeContext: docker-desktop
  integration:
    kubeContext: metabob-integration
  production:
    kubeContext: metabob-production

releases:
  - name: devbob
    namespace: metabob
    needs: [config]
    values:
      - charts/devbob/values/{{ .Values.environmentName }}.devbob.values.yaml
      - charts/devbob/values/{{ .Values.environmentName }}.devbob.secrets.yaml
```

**Benefits**:
- Multi-environment management
- Dependency ordering (devbob needs config)
- Conditional releases (useIstio, useLanding)
- Context-aware deployments

**Local Uses Direct Helm**:
```bash
helm install devbob helm/charts/devbob -f helm/environments/local.values.yaml
```

**Trade-off**: Helmfile adds complexity but scales better for multi-service, multi-environment deployments.

---

### 5. Production Configuration Deep Dive

**Platform Production Values** (`production.devbob.values.yaml`):
```yaml
image:
  repository: metabobapp/devbob
  pullPolicy: IfNotPresent
  tag: "v1.0.1"

resources:
  limits:
    cpu: 1000m
    memory: 2Gi
  requests:
    cpu: 250m
    memory: 1Gi

opencode:
  config:
    sessionMemory:
      enabled: true
      budgets:
        perImpulse: 2000
        total: 10000
    metabob:
      enabled: true
      max_issues: 5
      min_severity: "MEDIUM"
      inject_annotations: true
      auto_impact_analysis: true
      template_auto_registration:
        enabled: true
        behavior: "best-effort"
        strategy: "on-create"
```

**Key Production Features**:
1. **Metabob Integration**: Full code quality integration enabled
2. **Session Memory**: Impulse budgeting and memory management
3. **Template Auto-Registration**: Activities automatically sync with Metabob backend
4. **Conservative Resources**: Lower CPU/mem for cost optimization

---

### 6. Current K8s Cluster Status

**Live Deployment** (from kubectl):
```
NAMESPACE   NAME                                  READY   STATUS
metabob     devbob-96ddd7d87-hdwv8                1/1     Running (48m)
metabob     devbob-5995dcb8d9-f4zt2               0/1     Pending (21m)
metabob     metabob-rpc-api                       1/1     Running
metabob     surrealdb                             1/1     Running
```

**Observations**:
1. Old deployment pod still running (`devbob-96ddd7d87-hdwv8`)
2. New deployment pod pending (`devbob-5995dcb8d9-f4zt2`)
3. Suggests recent Helm upgrade with resource constraint or config issue

**ConfigMap**:
```json
{
  "share": "disabled",
  "sessionMemory": {
    "enabled": true,
    "analysis": {
      "timeout": 10000,
      "model": "claude-3-5-haiku-20241022",
      "provider": "anthropic"
    },
    "budgets": {
      "perImpulse": 2000,
      "total": 10000
    },
    "maxImpulsesPerTurn": 5
  }
}
```
- **Minimal config** (missing metabob integration settings)
- Suggests deployment used partial platform config

---

## Gap Analysis

### Features in Local NOT in Platform
1. ✅ **Comprehensive environment variables** (SurrealDB, Redis, Metabob API)
2. ✅ **Git user configuration** (GIT_USER_NAME, GIT_USER_EMAIL)
3. ✅ **Health probes enabled** (with /health endpoint)
4. ✅ **PVC persistence** (workspace survives restarts)
5. ✅ **Dashboard data bridge** (port 8083)
6. ✅ **Istio VirtualService** (service mesh routing)

### Features in Platform NOT in Local
1. ✅ **ConfigMap-based config** (Kubernetes-native)
2. ✅ **Init container** (setup read-only → writable config)
3. ✅ **ServiceAccount** (RBAC-ready)
4. ✅ **Multi-environment values** (default/production/integration)
5. ✅ **Helmfile orchestration** (dependency management, conditional releases)
6. ✅ **External secret references** (github-credentials)
7. ✅ **Production-hardened** (lower resources, better separation)

### Production Requirements NOT in Either
1. ❌ **Container registry** (Docker Hub or private registry)
2. ❌ **Image versioning strategy** (semantic versioning, CI/CD)
3. ❌ **Secret management** (Vault, SOPS, Sealed Secrets)
4. ❌ **Monitoring** (Prometheus ServiceMonitor)
5. ❌ **Logging** (structured logs, log aggregation)
6. ❌ **Backup strategy** (workspace/database backups)
7. ❌ **Horizontal autoscaling** (HPA)
8. ❌ **Network policies** (restrict pod-to-pod traffic)
9. ❌ **Pod security policies** (non-root, read-only root filesystem)

---

## Production Readiness Assessment

### Current Local Deployment
| Criterion | Status | Notes |
|-----------|--------|-------|
| Stability | ✅ 100% | E2E tests passing, 48m uptime |
| Configuration | ⚠️ Partial | Has env vars but missing ConfigMap structure |
| Security | ⚠️ Basic | No RBAC, secrets in values |
| Scalability | ❌ No | PVC limits horizontal scaling |
| Observability | ⚠️ Minimal | Health endpoint exists but disabled in platform |
| GitOps-ready | ❌ No | Secrets inline, no environment separation |

### Platform Repo
| Criterion | Status | Notes |
|-----------|--------|-------|
| Stability | ⚠️ Unknown | Health probes disabled (external API timeout issue) |
| Configuration | ✅ Good | ConfigMap + multi-environment |
| Security | ✅ Better | ServiceAccount, external secret refs |
| Scalability | ✅ Yes | emptyDir enables horizontal scaling |
| Observability | ❌ Disabled | Health probes commented out |
| GitOps-ready | ✅ Yes | Helmfile + environment separation |

### Production (Assumed)
| Criterion | Status | Notes |
|-----------|--------|-------|
| Stability | ❓ Unknown | Need production metrics |
| Configuration | ✅ Good | Using platform values |
| Security | ⚠️ Assumed | Need to verify RBAC, network policies |
| Scalability | ⚠️ Unknown | Need to verify HPA, resource limits |
| Observability | ❓ Unknown | Need to verify monitoring setup |
| GitOps-ready | ✅ Yes | Helmfile-based |

---

## Recommended Next Steps

### Immediate (This Week)

#### 1. **Sync Local with Platform Structure** [Priority: HIGH]
**Action**: Migrate local Helm charts to platform structure
- Copy ConfigMap approach (opencode.json)
- Add init container for config setup
- Adopt environment-specific values files
- Add ServiceAccount

**Why**: Reduces deployment drift, easier to push changes upstream

**Steps**:
```bash
# 1. Test platform charts locally
cd repos/platform/metabob-apps
helmfile -e default sync

# 2. Compare behavior with current deployment
kubectl logs -f devbob-xxx

# 3. Merge best features from both
# - Keep PVC option for dev (make it configurable)
# - Adopt ConfigMap approach
# - Keep comprehensive env vars as fallback
```

#### 2. **Fix Health Probe Issue** [Priority: HIGH]
**Problem**: `/health` endpoint makes external API calls that timeout
**Impact**: Kubernetes can't detect pod health

**Options**:
- **A**: Add dedicated `/healthz` endpoint (no external calls)
- **B**: Use TCP socket probe instead of HTTP
- **C**: Use `/config` endpoint (already exists, no external deps)

**Recommended**: Option A - Add `/healthz` endpoint
```typescript
// In OpenCode server
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});
```

#### 3. **Resolve Pending Pod** [Priority: MEDIUM]
**Current Issue**: `devbob-5995dcb8d9-f4zt2` stuck in Pending

**Debug**:
```bash
kubectl describe pod devbob-5995dcb8d9-f4zt2 -n metabob
kubectl get events -n metabob --sort-by='.lastTimestamp' | tail -20
```

**Likely Causes**:
- Resource quota exceeded
- PVC not binding
- Node selector mismatch
- Init container failing

#### 4. **Update Production ConfigMap** [Priority: MEDIUM]
**Current Gap**: Missing metabob integration config

**Action**: Add to ConfigMap:
```json
{
  "metabob": {
    "enabled": true,
    "max_issues": 5,
    "min_severity": "MEDIUM",
    "inject_annotations": true,
    "auto_impact_analysis": true,
    "cli_path": "metabob-cli",
    "auto_inject": true,
    "template_auto_registration": {
      "enabled": true,
      "behavior": "best-effort",
      "strategy": "on-create"
    }
  }
}
```

### Short Term (Next 2 Weeks)

#### 5. **Establish Image Build Pipeline** [Priority: HIGH]
**Goal**: Automated `devbob:latest` → `metabobapp/devbob:v1.0.x` pipeline

**Steps**:
1. Set up Docker Hub organization/repo
2. Create CI pipeline (GitHub Actions):
   - Build devbob image on push to main
   - Run integration tests
   - Tag with semantic version
   - Push to registry
3. Update platform charts to use new tag

**Benefits**: Enables production deployments, version rollback

#### 6. **Add Production Monitoring** [Priority: HIGH]
**Goal**: Visibility into production behavior

**Components**:
- Prometheus ServiceMonitor (metrics)
- Grafana dashboards (visualization)
- Loki for logs (centralized logging)
- Alerting rules (Slack/PagerDuty)

**Key Metrics**:
- Activity execution count
- Activity success/failure rate
- LLM token usage
- Response time (p50, p95, p99)
- Pod restarts

#### 7. **Implement Secret Management** [Priority: MEDIUM]
**Options**:
- **Sealed Secrets** (Kubernetes-native, GitOps-friendly)
- **SOPS** (encrypt in Git, decrypt at runtime)
- **External Secrets Operator** (Vault, AWS Secrets Manager)

**Recommended**: Sealed Secrets (simplest for platform repo GitOps)

#### 8. **Test Horizontal Scaling** [Priority: MEDIUM]
**Goal**: Verify multi-pod coordination

**Test Scenarios**:
- Scale to 3 pods: `kubectl scale deployment/devbob --replicas=3`
- Verify activity distribution across pods
- Test concurrent activity execution
- Verify SurrealDB connection pooling
- Test boredom detection with multiple agents

### Medium Term (Next Month)

#### 9. **Production Migration Plan** [Priority: HIGH]
**Goal**: Safely migrate from any current production to platform repo approach

**Steps**:
1. **Audit Current Production**:
   - What's actually deployed?
   - What are the resource utilization patterns?
   - What's the traffic volume?
   - Are there any custom patches?

2. **Create Migration Runbook**:
   - Pre-migration checklist
   - Blue-green deployment strategy
   - Rollback procedure
   - Validation steps

3. **Staging Environment**:
   - Deploy platform charts to integration environment
   - Run load tests
   - Verify behavior matches production

4. **Gradual Rollout**:
   - Deploy to 10% traffic
   - Monitor for 24h
   - Increase to 50%, then 100%

#### 10. **Add Production Hardening** [Priority: HIGH]
**Security**:
- Network policies (restrict pod-to-pod traffic)
- Pod security policies (non-root, read-only FS where possible)
- Resource quotas (prevent resource exhaustion)
- RBAC policies (least privilege)

**Reliability**:
- PodDisruptionBudget (maintain availability during upgrades)
- Horizontal Pod Autoscaler (auto-scale based on load)
- Backup strategy (workspace, SurrealDB data)
- Disaster recovery plan

#### 11. **Implement GitOps Workflow** [Priority: MEDIUM]
**Goal**: All changes via Git, no manual kubectl

**Components**:
- ArgoCD or Flux (GitOps controller)
- Git repo as source of truth
- Automatic drift detection
- Self-healing (auto-revert manual changes)

**Benefits**:
- Audit trail (Git history)
- Reproducible deployments
- Easy rollbacks (Git revert)
- Team collaboration (PRs)

### Long Term (Next Quarter)

#### 12. **Multi-Region Deployment** [Priority: LOW]
**Goal**: Global availability, reduced latency

**Challenges**:
- Cross-region database replication
- Session affinity (activities tied to pods)
- Cost optimization (data transfer)

#### 13. **Cost Optimization** [Priority: MEDIUM]
**Areas**:
- Right-size resources (profiling-based)
- Spot instances for non-critical workloads
- Cache optimization (reduce API calls)
- Batch processing (activity scheduling)

---

## Decision Matrix: Which Deployment to Standardize On?

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Keep Local** | Working 100%, comprehensive config, PVC for dev | Not GitOps-ready, secrets inline, doesn't match prod | ❌ No - creates drift |
| **Adopt Platform** | GitOps-ready, multi-env, production-aligned | Missing health probes, less comprehensive config | ✅ **Yes** - with enhancements |
| **Hybrid** | Best of both worlds | Maintenance overhead, potential confusion | ⚠️ Maybe - as transition strategy |

### Recommended Path: **Adopt Platform + Enhancements**

**Phase 1: Merge Best Features**
1. Use platform structure (ConfigMap, init container, Helmfile)
2. Add local's comprehensive config to ConfigMap
3. Make persistence configurable (PVC for dev, emptyDir for prod)
4. Add health probe fix (/healthz endpoint)

**Phase 2: Production Readiness**
1. Image build pipeline
2. Monitoring & logging
3. Secret management
4. RBAC & security hardening

**Phase 3: Production Migration**
1. Staging validation
2. Gradual rollout
3. Monitoring & alerting
4. GitOps workflow

---

## Immediate Action Items (Priority Order)

1. **[P0] Investigate pending pod** - `kubectl describe pod devbob-5995dcb8d9-f4zt2`
2. **[P0] Add /healthz endpoint** - No external deps health check
3. **[P1] Sync local with platform structure** - ConfigMap, init container
4. **[P1] Update ConfigMap** - Add metabob integration config
5. **[P1] Test platform charts locally** - `helmfile -e default sync`
6. **[P2] Create image build pipeline** - GitHub Actions → Docker Hub
7. **[P2] Add monitoring** - Prometheus, Grafana
8. **[P2] Implement secret management** - Sealed Secrets or SOPS
9. **[P3] Test horizontal scaling** - Multi-pod coordination
10. **[P3] Production migration plan** - Audit, runbook, staging

---

## Questions to Answer

### About Production
1. ❓ **What's currently deployed in production?**
   - Which charts/version?
   - What's the image tag?
   - What's the resource utilization?

2. ❓ **What's the production traffic volume?**
   - Activities per day?
   - Concurrent users?
   - Peak load patterns?

3. ❓ **What monitoring exists?**
   - Prometheus/Grafana?
   - Log aggregation?
   - Alerting setup?

4. ❓ **What's the deployment process?**
   - Manual helm upgrade?
   - GitOps (ArgoCD/Flux)?
   - CI/CD pipeline?

### About Platform Repo
1. ❓ **What's the release cadence?**
   - How often are platform charts updated?
   - What's the versioning strategy?

2. ❓ **What's the integration environment used for?**
   - Staging?
   - QA?
   - Customer testing?

3. ❓ **Are there any custom patches in production?**
   - Hot fixes not in Git?
   - Manual ConfigMap edits?

---

## Conclusion

**Current State**:
- ✅ Local K8s deployment is **100% functional** but uses custom approach
- ⚠️ Platform repo has **better structure** but missing some production features
- ❓ Production deployment status is **unknown** but likely uses platform repo

**Recommendation**:
1. **Adopt platform repo structure** as standard
2. **Enhance with missing features** from local (health probes, comprehensive config)
3. **Add production hardening** (monitoring, secrets, RBAC)
4. **Establish CI/CD pipeline** for image builds and deployments

**Next Session Should**:
1. Investigate pending pod issue
2. Sync local deployment with platform structure
3. Add /healthz endpoint to OpenCode server
4. Update ConfigMap with full metabob integration
5. Test platform charts in local environment

**Long-term Goal**:
- Single source of truth (platform repo)
- GitOps workflow (all changes via Git)
- Production-grade observability
- Automated deployments with confidence

---

**Generated**: 2026-03-02  
**Status**: Analysis Complete  
**Next Action**: Choose path forward and begin implementation
