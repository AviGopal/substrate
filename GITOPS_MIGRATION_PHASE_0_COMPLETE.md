# GitOps Migration - Phase 0 Implementation Complete

**Date**: 2026-04-17
**Status**: Phase 0 Complete - Ready for Local Deployment Testing
**Objective**: Replace push-based CI/CD with pull-based GitOps using activity-driven reconciliation

---

## Executive Summary

Phase 0 of the GitOps migration is complete. We have successfully created the k8s-activity-executor vessel with GitOps reconciliation capabilities, deployed it to helmfile, and designed 5 core reconciliation activities.

This represents the foundation for a **complete replacement** of the current 656-line push-based CI/CD workflow with a pull-based GitOps system that:

- Uses activities for all reconciliation (aligns with impulse-activity foundation)
- Eliminates GitHub Actions for deployment
- Enables Thompson Sampling for multi-variant traffic optimization
- Provides automatic promotion and emergency rollback capabilities
- Feeds all operations into the learning loop for continuous improvement

---

## Phase 0 Deliverables

### 1. k8s-activity-executor Dockerfile

**Location**: `repos/k8s-activity-executor/Dockerfile`

**Features**:
- Multi-stage build with Bun runtime
- Installs kubectl (latest stable), Helm (v3.14.0), helmfile (v0.162.0)
- Non-root user execution for security
- Health check endpoint built-in
- Build arguments for version embedding

**Image Build Command**:
```bash
cd repos/k8s-activity-executor
docker build -t metabobapp/k8s-activity-executor:1.0.0 .
```

### 2. Helm Chart for k8s-activity-executor

**Location**: `repos/k8s-activity-executor/helm/k8s-activity-executor/`

**Components Created**:
- `Chart.yaml` - Chart metadata (version 1.0.0)
- `values.yaml` - Configuration defaults with 3 RBAC modes
- `templates/_helpers.tpl` - Helm template helpers
- `templates/deployment.yaml` - Kubernetes Deployment manifest
- `templates/service.yaml` - ClusterIP Service
- `templates/serviceaccount.yaml` - ServiceAccount for RBAC
- `templates/rbac.yaml` - ClusterRole/ClusterRoleBinding configurations

**RBAC Modes**:
1. **cluster-admin**: Full cluster access (development/testing)
2. **minimal-cluster**: Read/write on core resources (recommended for production)
3. **namespace-restricted**: Limited to namespace only (highest security)

**Configuration Highlights**:
- 1 replica (single reconciler is sufficient)
- 500m CPU limit, 512Mi memory limit
- Discovery registration enabled (60s heartbeat)
- Authentication via identity-vessel
- Istio sidecar injection enabled

### 3. Helmfile Integration

**Location**: `repos/deployment/helmfile.yaml.gotmpl` (line 172)

**Release Configuration**:
```yaml
- name: k8s-activity-executor
  namespace: activity-system
  chart: ./vessels/k8s-activity-executor/helm/k8s-activity-executor
  labels:
    tier: infrastructure
    component: gitops
    vessel: k8s-activity-executor
  needs:
    - activity-system/discovery-vessel
```

**Dependency Order**:
1. Infrastructure (SurrealDB, Valkey, Discovery-Vessel)
2. **k8s-activity-executor** ← NEW
3. Application vessels (Activity-API, Analysis-API, MiniBob, etc.)

### 4. GitOps Reconciliation Activities

**Location**: `repos/k8s-activity-executor/activities/`

Created 5 core activity templates for GitOps operations:

#### a. watch-git-state.json

**Purpose**: Monitor Git repository for desired state changes

**Waking**: Scheduled every 60 seconds

**Tasks**:
1. Fetch latest commit SHA from Git
2. Read desired-state.yaml configuration
3. Detect changed vessels via git diff

**Output Impulses**:
- `gitCommitSha` - Latest commit SHA
- `desiredState` - Parsed YAML configuration
- `changedVessels` - List of vessels with code changes

**Integration**: Triggers reconcile-deployments when changes detected

---

#### b. reconcile-deployments.json

**Purpose**: Apply changes from desired state to Kubernetes

**Waking**: Triggered by watch-git-state (not scheduled)

**Tasks**:
1. Parse desired state from Git
2. Query current Kubernetes deployments via kubectl
3. Compute drift (missing, mismatched, deprecated)
4. Apply changes via helmfile sync
5. Verify reconciliation success

**Output Impulses**:
- `driftDetected` - Boolean indicating drift
- `reconciliationResult` - Helmfile sync output
- `verificationStatus` - Post-reconciliation deployment status

**Resolver Hints**: kubectl, helmfile

---

#### c. optimize-traffic-split.json

**Purpose**: Thompson Sampling for traffic optimization

**Waking**: Scheduled every 5 minutes

**Tasks**:
1. Query variant metrics (success rate, latency, error rate)
2. Compute Thompson Sampling weights (Beta distribution)
3. Get current Istio VirtualService configuration
4. Update VirtualService with new traffic split
5. Verify traffic split applied

**Output Impulses**:
- `variantMetrics` - Performance metrics per variant
- `trafficSplit` - Recommended traffic split percentages
- `updateResult` - VirtualService update result

**Integration**: Continuously optimizes traffic distribution based on observed performance

---

#### d. auto-promote-variants.json

**Purpose**: Automatically promote high-performing variants

**Waking**: Scheduled every 1 hour

**Tasks**:
1. Query candidate variants meeting promotion criteria:
   - Success rate >= 99%
   - Requests >= 1000
   - Uptime >= 24 hours
   - P95 latency <= 500ms
2. Get current production variant
3. Compare metrics (require >= 2% improvement)
4. Update desired-state.yaml in Git if promotion recommended
5. Send notification

**Output Impulses**:
- `candidateVariants` - List of eligible variants
- `promotionDecision` - Boolean promotion decision
- `gitCommitSha` - Commit SHA if promotion occurred

**Integration**: Automatically promotes winning variants to production after validation

---

#### e. emergency-rollback.json

**Purpose**: Immediate rollback on critical failures

**Waking**: Event-driven (Alertmanager alerts)

**Tasks**:
1. Verify alert severity (error rate > 50%, latency > 5s, CrashLoopBackOff, security)
2. Get previous successful Helm revision
3. Execute helm rollback with --wait
4. Verify post-rollback health
5. Update Git desired state
6. Send high-priority incident alert

**Output Impulses**:
- `rollbackDecision` - PROCEED or SKIP
- `rolledBackVersion` - Version restored
- `healthStatus` - Post-rollback health check

**Integration**: Triggered by Prometheus/Alertmanager on critical alerts

---

## Architecture Alignment

### Impulse-Activity Foundation ✅

All GitOps operations are **activities**:
- Git state monitoring → Activity
- Drift detection → Activity
- Traffic optimization → Activity
- Promotion decisions → Activity
- Emergency response → Activity

### Resolver Tracking ✅

Each activity specifies `resolverHint`:
- `kubectl` for Kubernetes operations
- `helm` for Helm operations
- `helmfile` for multi-vessel deployments
- `git` for repository operations

All executions will be traced with resolver performance metrics.

### Thompson Sampling ✅

Traffic optimization uses Thompson Sampling:
- Beta distribution modeling of success rates
- Automatic exploration/exploitation balance
- Minimum 5% traffic to each variant
- Statistically significant improvement required (>= 2%)

### Learning Loop ✅

All activities feed execution traces to metabob-activity-api:
- Success/failure rates
- Resolver performance
- Latency metrics
- Cost tracking

Enables continuous improvement of GitOps operations.

---

## Deployment Readiness

### Prerequisites

Before deploying k8s-activity-executor:

1. **Discovery-vessel must be running** (dependency in helmfile)
2. **Identity-vessel must be running** (authentication)
3. **SurrealDB must be running** (for activity storage)
4. **Docker image must be built and pushed**:
   ```bash
   cd repos/k8s-activity-executor
   docker build -t metabobapp/k8s-activity-executor:1.0.0 .
   docker push metabobapp/k8s-activity-executor:1.0.0
   ```

### Local Deployment Test

```bash
# 1. Build and push image
cd repos/k8s-activity-executor
docker build -t metabobapp/k8s-activity-executor:latest .
docker push metabobapp/k8s-activity-executor:latest

# 2. Deploy via helmfile
cd repos/deployment
helmfile -e local sync --selector vessel=k8s-activity-executor

# 3. Verify deployment
kubectl get pods -n activity-system -l app.kubernetes.io/name=k8s-activity-executor
kubectl logs -n activity-system -l app.kubernetes.io/name=k8s-activity-executor -f

# 4. Check health
kubectl exec -n activity-system deployment/k8s-activity-executor -- curl http://localhost:8080/health

# 5. Verify discovery registration
curl http://discovery.metabob.local/vessels | jq '.[] | select(.vesselName=="k8s-activity-executor")'
```

---

## Next Steps: Phase 1 (Parallel Operation)

### Week 2-3 Tasks

1. **Create desired-state.yaml structure**:
   ```yaml
   vessels:
     metabob-activity-api:
       variants:
         - id: main
           imageTag: "1.2.11-a3f8c2d"
           traffic: 100
   ```

2. **Deploy k8s-activity-executor to canary**:
   - Build image with SHA tag
   - Push to Docker Hub
   - Update `production.canary.values.yaml` with image tag
   - Deploy via helmfile

3. **Activate watch-git-state activity**:
   - Register activity template in metabob-activity-api
   - Configure waking trigger (60s interval)
   - Verify Git repository access from k8s-activity-executor pod

4. **Test reconciliation loop** (dry-run mode):
   - Modify desired-state.yaml (add test annotation)
   - Verify watch-git-state detects change
   - Verify reconcile-deployments computes drift
   - Run reconciliation in dry-run mode (helmfile diff)

5. **Parallel operation**:
   - Keep existing CI/CD pipeline active
   - Run GitOps reconciliation in shadow mode (no apply)
   - Compare CI/CD deployments vs GitOps drift detection
   - Validate correctness for 1 week

### Week 3-4 Tasks (Gradual Cutover)

6. **Enable reconciliation for non-critical vessel**:
   - Start with activity-dashboard (lowest risk)
   - Switch from CI/CD to GitOps for this vessel only
   - Monitor for 3 days

7. **Enable traffic optimization**:
   - Deploy 2 variants of activity-dashboard
   - Activate optimize-traffic-split activity
   - Verify Thompson Sampling adjusts traffic split
   - Monitor metrics for 3 days

8. **Enable auto-promotion**:
   - Activate auto-promote-variants activity
   - Set conservative thresholds (99.5% success rate, 48hr uptime)
   - Test promotion decision logic (should not promote unless clear winner)

9. **Enable emergency-rollback**:
   - Configure Alertmanager to trigger emergency-rollback activity
   - Test with simulated failure (deploy broken image)
   - Verify automatic rollback within 90 seconds

### Week 5-6 Tasks (Complete Replacement)

10. **Migrate all vessels to GitOps**:
    - Add all vessels to desired-state.yaml
    - Disable CI/CD auto-deployment (keep build pipeline only)
    - Reconciliation loop becomes source of truth

11. **Deprecate push-based CI/CD**:
    - Remove deploy-canary.yml workflow
    - Remove promote-to-production.yml workflow
    - Archive to `.github/workflows/archive/`

12. **Migration complete checklist**:
    - [ ] All vessels in desired-state.yaml
    - [ ] Reconciliation loop running for 7+ days without issues
    - [ ] Thompson Sampling actively optimizing traffic
    - [ ] Auto-promotion has executed at least 1 successful promotion
    - [ ] Emergency rollback tested and validated
    - [ ] CI/CD workflows archived
    - [ ] Documentation updated

---

## Image Build Pipeline (Future Phase)

Phase 0 does not include the image build pipeline. Current approach:

**Current** (manual/CI):
```bash
# Build locally or in CI
docker build -t metabobapp/vessel:tag .
docker push metabobapp/vessel:tag

# Update desired-state.yaml
git commit -m "chore: bump vessel to tag"
git push
```

**Future** (Activity-based Kaniko builds):
- Webhook → MiniBob → Create build-vessel-image activity
- Kaniko pod builds image in-cluster
- Push to registry → Update Git → ArgoCD sync
- No Docker daemon, no CI/CD build jobs

This will be implemented in a separate phase after GitOps reconciliation is stable.

---

## Success Metrics

### Phase 0 Deployment Success

- [ ] k8s-activity-executor pod Running
- [ ] Registered with discovery-vessel
- [ ] Health endpoint returns 200
- [ ] kubectl/helm/helmfile resolvers functional
- [ ] 5 activity templates loaded

### Phase 1-3 Migration Success

- [ ] watch-git-state detecting changes within 60s
- [ ] reconcile-deployments applying drift within 120s
- [ ] optimize-traffic-split adjusting splits every 5min
- [ ] auto-promote-variants promoting winners hourly
- [ ] emergency-rollback responding to alerts < 90s
- [ ] Zero CI/CD deployment runs for 7 consecutive days

### Learning Loop Integration

- [ ] All reconciliation activities traced
- [ ] Resolver performance metrics captured
- [ ] Thompson Sampling weights improving over time
- [ ] Activity dashboard showing GitOps operations

---

## Rollback Plan

If GitOps migration encounters critical issues:

1. **Disable reconciliation activities**: Set waking.enabled = false
2. **Revert to CI/CD**: Re-enable deploy-canary.yml workflow
3. **Manual deployments**: Use helmfile sync directly
4. **Investigation**: Analyze execution traces for root cause
5. **Fix and retry**: Address issues, resume migration

k8s-activity-executor can remain deployed as it doesn't affect existing deployments unless reconciliation activities are active.

---

## Files Created/Modified

### New Files

1. `repos/k8s-activity-executor/Dockerfile`
2. `repos/k8s-activity-executor/helm/k8s-activity-executor/Chart.yaml`
3. `repos/k8s-activity-executor/helm/k8s-activity-executor/values.yaml`
4. `repos/k8s-activity-executor/helm/k8s-activity-executor/templates/_helpers.tpl`
5. `repos/k8s-activity-executor/helm/k8s-activity-executor/templates/deployment.yaml`
6. `repos/k8s-activity-executor/helm/k8s-activity-executor/templates/service.yaml`
7. `repos/k8s-activity-executor/helm/k8s-activity-executor/templates/serviceaccount.yaml`
8. `repos/k8s-activity-executor/helm/k8s-activity-executor/templates/rbac.yaml`
9. `repos/k8s-activity-executor/activities/watch-git-state.json`
10. `repos/k8s-activity-executor/activities/reconcile-deployments.json`
11. `repos/k8s-activity-executor/activities/optimize-traffic-split.json`
12. `repos/k8s-activity-executor/activities/auto-promote-variants.json`
13. `repos/k8s-activity-executor/activities/emergency-rollback.json`
14. `GITOPS_MIGRATION_PHASE_0_COMPLETE.md` (this file)

### Modified Files

1. `repos/deployment/helmfile.yaml.gotmpl` - Added k8s-activity-executor release

---

## Documentation References

- **GitOps Design**: `docs/architecture/MINIBOB_GITOPS_DESIGN.md`
- **Foundation**: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
- **Deployment Workflow**: `repos/deployment/DEPLOYMENT_WORKFLOW.md`
- **k8s-activity-executor README**: `repos/k8s-activity-executor/README.md`
- **Discovery Integration**: `DISCOVERY_INTEGRATION.md`

---

## Conclusion

Phase 0 establishes the foundation for **complete replacement** of push-based CI/CD with activity-driven GitOps. All infrastructure is in place:

✅ k8s-activity-executor vessel
✅ Helm chart with RBAC
✅ Helmfile integration
✅ 5 core reconciliation activities
✅ Thompson Sampling traffic optimization
✅ Automatic promotion and emergency rollback

**Ready for local deployment testing.**

Next step: Build and deploy k8s-activity-executor to local environment, then proceed to Phase 1 (parallel operation).
