# Next Steps: Deployment Synchronization

**Priority**: HIGH  
**Goal**: Sync local K8s with platform repo and prepare for production

---

## TL;DR

**Current Situation**:
- ✅ Local K8s deployment: 100% working but custom
- ⚠️ Platform repo: Better structure but diverged
- ❓ Production: Unknown status

**Recommended Path**: **Adopt platform structure + enhancements**

---

## Immediate Actions (This Session)

### 1. Debug Pending Pod [15 minutes]
```bash
# Check why new pod is stuck
kubectl describe pod devbob-5995dcb8d9-f4zt2 -n metabob
kubectl get events -n metabob --sort-by='.lastTimestamp' | tail -20

# Check old pod status
kubectl logs devbob-96ddd7d87-hdwv8 -n metabob --tail=100

# Decision: Keep old or fix new?
```

### 2. Test Platform Charts Locally [30 minutes]
```bash
cd repos/platform/metabob-apps

# Preview changes
helmfile -e default diff

# Apply if safe
helmfile -e default sync

# Verify
kubectl get pods -n metabob -w
```

### 3. Add /healthz Endpoint [45 minutes]
**Problem**: Current `/health` makes external API calls (times out)

**Solution**: Add dedicated health endpoint
```typescript
// repos/metabob-opencode/packages/opencode/src/server/server.ts
app.get('/healthz', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    version: process.env.npm_package_version 
  });
});
```

**Update deployment**:
```yaml
livenessProbe:
  httpGet:
    path: /healthz  # Changed from /health
    port: http
  initialDelaySeconds: 30
  periodSeconds: 30
```

---

## Short Term (This Week)

### 4. Merge Best Features [2-3 hours]
**Goal**: Combine local's comprehensive config with platform's structure

**Steps**:
1. Copy platform chart to new branch
2. Add metabob config to ConfigMap
3. Make persistence configurable (PVC vs emptyDir)
4. Test locally
5. PR to platform repo

**ConfigMap additions**:
```json
{
  "metabob": {
    "enabled": true,
    "max_issues": 5,
    "min_severity": "MEDIUM",
    "inject_annotations": true,
    "auto_impact_analysis": true,
    "template_auto_registration": {
      "enabled": true,
      "behavior": "best-effort"
    }
  },
  "mcp": {
    "metabob": {
      "type": "remote",
      "url": "http://metabob-rpc-api:8080",
      "enabled": true
    }
  }
}
```

### 5. Create Image Build Pipeline [4-6 hours]
**Goal**: Automate devbob:latest → metabobapp/devbob:v1.0.x

**GitHub Actions workflow**:
```yaml
name: Build and Push DevBob Image
on:
  push:
    branches: [main]
    paths:
      - 'repos/metabob-opencode/**'
      - 'docker/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build image
        run: docker build -t devbob:${{ github.sha }} .
      - name: Run tests
        run: docker run devbob:${{ github.sha }} npm test
      - name: Push to registry
        run: |
          docker tag devbob:${{ github.sha }} metabobapp/devbob:v1.0.${{ github.run_number }}
          docker push metabobapp/devbob:v1.0.${{ github.run_number }}
```

### 6. Update Production ConfigMap [30 minutes]
```bash
# Create new ConfigMap with full config
kubectl create configmap devbob-config -n metabob \
  --from-file=opencode.json=helm/configs/production-opencode.json \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up new config
kubectl rollout restart deployment/devbob -n metabob
```

---

## Medium Term (Next 2 Weeks)

### 7. Add Production Monitoring [1 day]
**Components**:
- Prometheus ServiceMonitor
- Grafana dashboards
- Alert rules

**Example ServiceMonitor**:
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: devbob
spec:
  selector:
    matchLabels:
      app: devbob
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

### 8. Implement Secret Management [1-2 days]
**Recommended**: Sealed Secrets

**Setup**:
```bash
# Install Sealed Secrets controller
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets -n kube-system

# Encrypt secrets
echo -n 'sk-ant-...' | kubectl create secret generic devbob-secrets \
  --dry-run=client --from-file=anthropic-api-key=/dev/stdin -o yaml | \
  kubeseal -o yaml > helm/charts/devbob/templates/sealed-secret.yaml
```

### 9. Test Horizontal Scaling [4 hours]
```bash
# Scale up
kubectl scale deployment/devbob --replicas=3 -n metabob

# Verify activity distribution
for i in 0 1 2; do
  kubectl exec devbob-$i -n metabob -- \
    curl -s http://metabob-rpc-api:8080/activity-recommendations/health
done

# Load test
kubectl run -it --rm load-test --image=busybox --restart=Never -- \
  sh -c 'while true; do wget -q -O- http://devbob:8080/health; sleep 1; done'

# Monitor
watch kubectl top pods -n metabob
```

---

## Long Term (Next Month)

### 10. Production Migration Plan [2-3 days]
**Phase 1: Audit**
- [ ] Document current production deployment
- [ ] Identify resource usage patterns
- [ ] List any custom patches
- [ ] Check for manual ConfigMap edits

**Phase 2: Staging**
- [ ] Deploy platform charts to integration environment
- [ ] Run load tests
- [ ] Verify behavior matches production
- [ ] Update runbook

**Phase 3: Rollout**
- [ ] Blue-green deployment (new deployment alongside old)
- [ ] Route 10% traffic to new deployment
- [ ] Monitor for 24 hours
- [ ] Increase to 50%, then 100%
- [ ] Decommission old deployment

### 11. Add Production Hardening [1 week]
**Security**:
- [ ] Network policies
- [ ] Pod security policies
- [ ] RBAC policies
- [ ] Resource quotas

**Reliability**:
- [ ] PodDisruptionBudget (min 1 pod during upgrades)
- [ ] HorizontalPodAutoscaler (2-10 pods based on CPU)
- [ ] Backup strategy (daily SurrealDB backups)
- [ ] Disaster recovery runbook

### 12. Implement GitOps [1 week]
**Tool**: ArgoCD or Flux

**Benefits**:
- All changes via Git (audit trail)
- Automatic drift detection
- Self-healing
- Easy rollbacks

---

## Decision Points

### A. Which Deployment Structure?
**Options**:
1. ❌ Keep local (custom) - Creates ongoing drift
2. ✅ **Adopt platform** - Better long-term, needs enhancements
3. ⚠️ Hybrid - Transition strategy only

**Recommendation**: Adopt platform + add missing features

### B. Persistence Strategy?
**Options**:
1. PVC (stateful) - Better for dev, limits scaling
2. emptyDir (ephemeral) - Better for prod, stateless
3. **Both** (configurable) - Best of both worlds ✅

**Recommendation**: Make it configurable via values.yaml

### C. Health Check Strategy?
**Options**:
1. Fix /health endpoint - Remove external calls
2. Add /healthz endpoint - Dedicated, simple ✅
3. TCP socket probe - Less informative
4. Disable probes - Reduces observability ❌

**Recommendation**: Add /healthz endpoint

---

## Success Criteria

### Immediate (This Session)
- [ ] Pending pod issue resolved
- [ ] Platform charts tested locally
- [ ] /healthz endpoint added and tested

### This Week
- [ ] Local deployment synced with platform structure
- [ ] ConfigMap updated with full metabob config
- [ ] Image build pipeline created
- [ ] Health probes re-enabled with /healthz

### Next 2 Weeks
- [ ] Monitoring deployed (Prometheus + Grafana)
- [ ] Secret management implemented
- [ ] Horizontal scaling tested
- [ ] Production migration plan created

### Next Month
- [ ] Production migration completed
- [ ] GitOps workflow implemented
- [ ] Production hardening complete
- [ ] Documentation updated

---

## Questions to Answer

### About Current Production
1. ❓ What's deployed? (chart version, image tag)
2. ❓ What's the traffic volume? (activities/day, concurrent users)
3. ❓ What monitoring exists? (Prometheus, logs)
4. ❓ What's the deployment process? (manual, GitOps, CI/CD)

### About Platform Repo
1. ❓ What's the release cadence?
2. ❓ What's integration environment for? (staging, QA)
3. ❓ Are there custom patches in production?

**Action**: Schedule sync with platform team to answer these

---

## Files to Review

Generated in this session:
- ✅ `DEPLOYMENT_COMPARISON_ANALYSIS.md` - Full comparison (5000+ words)
- ✅ `NEXT_STEPS_DEPLOYMENT_SYNC.md` - This file (actionable steps)

Existing documentation:
- `DEVBOB_K8S_COMPLETE_E2E_SUMMARY.md` - Local deployment status
- `repos/platform/metabob-apps/README.md` - Platform deployment guide
- `helm/` - Current local charts
- `repos/platform/metabob-apps/charts/devbob/` - Platform charts

---

## Quick Commands Reference

### Debug Current Deployment
```bash
# Check pod status
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob

# Check pending pod
kubectl describe pod devbob-5995dcb8d9-f4zt2 -n metabob

# Check logs
kubectl logs -f devbob-96ddd7d87-hdwv8 -n metabob

# Check events
kubectl get events -n metabob --sort-by='.lastTimestamp' | tail -20
```

### Test Platform Charts
```bash
cd repos/platform/metabob-apps

# Preview
helmfile -e default diff

# Apply
helmfile -e default sync

# Verify
kubectl get all -n metabob
```

### Rollback if Needed
```bash
# Rollback deployment
kubectl rollout undo deployment/devbob -n metabob

# Or scale down new, scale up old
kubectl scale deployment/devbob-5995dcb8d9 --replicas=0 -n metabob
kubectl scale deployment/devbob-96ddd7d87 --replicas=1 -n metabob
```

---

**Generated**: 2026-03-02  
**Status**: Ready for Action  
**Estimated Time**: 1-2 hours (immediate), 1 week (short-term), 1 month (full migration)
