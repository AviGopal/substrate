# Constraint Remediation Guide

## Executive Summary
- **Status**: VIOLATIONS (1 critical failure, 1 warning)
- **Compliance**: 70% (7/10 passing)
- **Improvement**: +30% from previous 40% (metabob-rpc-api deployment fixed C2)

## Critical Violations

### ❌ Constraint 3: Workspace Isolation (CRITICAL)
**Issue**: 0 PVCs bound (need 3 for vessel isolation)  
**Impact**: Vessels share ephemeral storage, no data persistence  
**Root Cause**: PVC provisioning not enabled in Helm deployment

**Fix**:
```bash
# Option 1: Enable PVCs in helmfile
cd helm
cat >> helmfile.yaml <<'YAML'
  - name: devbob
    values:
      - values/devbob-local.yaml
      - persistence:
          enabled: true
          size: 10Gi
          storageClass: standard
YAML

helmfile -f helmfile.yaml -e local --selector name=devbob sync --wait

# Option 2: Manual PVC creation (temporary)
for i in {0..2}; do
  kubectl apply -f - <<YAML
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: devbob-workspace-$i
  namespace: metabob
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 10Gi
  storageClassName: standard
YAML
done

# Verify
kubectl get pvc -n metabob
```

## Warnings

### ⚠️ Constraint 9: Health Probes (WARNING)
**Issue**: No liveness/readiness probes configured  
**Impact**: Kubernetes can't detect unhealthy vessels or delay traffic during startup  

**Fix**:
```bash
cd helm
cat >> values/devbob-local.yaml <<'YAML'
livenessProbe:
  enabled: true
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  enabled: true
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
YAML

helmfile -f helmfile.yaml -e local --selector name=devbob sync --wait
```

## Info/Non-Blocking

### ℹ️ Constraint 8: Anti-Affinity (INFO)
**Status**: All vessels on single node (expected for Docker Desktop)  
**Action**: No fix needed for local development  
**Production**: Enable pod anti-affinity in multi-node clusters

## Passing Constraints ✅

1. ✅ **Multi-Vessel Requirement**: 3 vessels running
2. ✅ **Coordination Layer**: Redis + SurrealDB + metabob-rpc-api running
4. ✅ **ACP Communication**: Port 3000 exposed
5. ✅ **Vessel Registry**: Vessels registered in SurrealDB
6. ✅ **Backend Connectivity**: Vessels can reach backends
7. ✅ **Resource Allocation**: CPU/memory requests configured
10. ✅ **Dataflow Enforcement**: metabob-rpc-api is ClusterIP (internal only)

## Compliance Trend

| Validation | Date | Compliance | Status |
|------------|------|------------|--------|
| Initial | 2026-02-26 | 40% (4/10) | Coordination layer incomplete |
| Current | 2026-02-27 | 70% (7/10) | metabob-rpc-api deployed |
| Target | TBD | 90% (9/10) | Fix C3 + C9 |

**Next Steps**:
1. Fix C3 (Workspace Isolation) - enable PVCs in Helm
2. Fix C9 (Health Probes) - add liveness/readiness probes
3. Re-validate compliance (target: 90%)
