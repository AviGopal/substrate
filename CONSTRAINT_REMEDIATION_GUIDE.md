# Constraint Remediation Guide

## Executive Summary

**Status**: VIOLATIONS (6/10 passed, 3 failed)
**Critical Issues**: 3 constraints failing (Constraints 2, 3, 5)

---

## ❌ CRITICAL VIOLATIONS

### Constraint 2: Coordination Layer (FAIL)
**Issue**: Only 1/3 backend services running
- ✅ Redis: Running
- ❌ SurrealDB: NOT running
- ❌ metabob-rpc-api: NOT running

**Impact**: Vessel registry and dataflow coordination unavailable

**Remediation**:
```bash
# Check SurrealDB pod status
kubectl get pods -n metabob -l app.kubernetes.io/name=surrealdb

# Check SurrealDB logs
kubectl logs -n metabob -l app.kubernetes.io/name=surrealdb --tail=100

# Redeploy if needed
cd helm
helmfile -f helmfile.yaml -e local --selector name=surrealdb sync --wait

# Deploy metabob-rpc-api
helmfile -f helmfile.yaml -e local --selector name=metabob-rpc-api sync --wait

# Verify
kubectl get pods -n metabob -l app.kubernetes.io/name=surrealdb
kubectl get pods -n metabob -l app.kubernetes.io/name=metabob-rpc-api
```

---

### Constraint 3: Workspace Isolation (FAIL)
**Issue**: 0 PVCs bound for 3 vessels
**Impact**: Vessels have no persistent storage, workspaces not isolated

**Remediation**:
```bash
# Check PVC status
kubectl get pvc -n metabob

# Check StatefulSet configuration
kubectl get statefulset/devbob -n metabob -o yaml | grep -A 10 volumeClaimTemplates

# If StatefulSet exists but PVCs not created:
kubectl delete statefulset/devbob -n metabob
kubectl apply -f k8s-devbob-statefulset.yaml

# Wait for PVCs to be created and bound
kubectl get pvc -n metabob --watch

# Verify each vessel has a PVC
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o json | \
  jq -r '.items[] | "\(.metadata.name): \(.spec.volumes[] | select(.persistentVolumeClaim) | .persistentVolumeClaim.claimName)"'
```

---

### Constraint 5: Vessel Registry (FAIL)
**Issue**: 0 vessels registered in SurrealDB (expected: 3)
**Impact**: Vessels cannot coordinate, activity delegation will fail

**Root Cause**: SurrealDB not running (see Constraint 2)

**Remediation** (after fixing Constraint 2):
```bash
# 1. Ensure SurrealDB is running
kubectl get pods -n metabob -l app.kubernetes.io/name=surrealdb

# 2. Initialize schema
kubectl port-forward -n metabob svc/surrealdb 8000:8000 &
sleep 3
curl -X POST http://localhost:8000/sql \
  -H "Content-Type: application/json" \
  -u "root:root" \
  --data @initialize-surrealdb-schema.sql
killall kubectl

# 3. Restart vessels to trigger registration
kubectl rollout restart statefulset/devbob -n metabob
kubectl rollout status statefulset/devbob -n metabob

# 4. Verify registration
kubectl port-forward -n metabob svc/surrealdb 8000:8000 &
sleep 3
curl -X POST http://localhost:8000/sql \
  -H "Content-Type: application/json" \
  -u "root:root" \
  --data "USE NS metabob DB devbob; SELECT * FROM vessel_registry;" | jq .
killall kubectl
```

---

## ✅ PASSING CONSTRAINTS

1. **Multi-Vessel Requirement**: 3 vessels running ✅
4. **ACP Communication**: 2 ACP endpoints configured on port 3000 ✅
6. **Backend Connectivity**: SurrealDB connectivity verified ✅
7. **Resource Allocation**: CPU and memory requests configured ✅
9. **Health Probes**: Liveness and readiness probes configured ✅
10. **Dataflow Enforcement**: metabob-rpc-api is ClusterIP only ✅

---

## ℹ️ INFORMATIONAL

8. **Anti-Affinity**: All vessels on single node `docker-desktop` (expected for single-node cluster)

---

## Remediation Priority

1. **IMMEDIATE**: Fix Constraint 2 (SurrealDB + metabob-rpc-api)
2. **IMMEDIATE**: Fix Constraint 3 (PVCs for workspace isolation)
3. **AFTER 1&2**: Fix Constraint 5 (vessel registration)

---

## Validation After Remediation

```bash
# Re-run full constraint validation
./devctl.sh validate-constraints

# Expected outcome: 9/10 PASS (Constraint 8 will remain INFO on single-node)
```

---

## Notes

- **Constraint 8 (Anti-Affinity)** shows INFO status because the cluster is single-node. This is acceptable for local development.
- **Constraint 5** depends on Constraint 2 being fixed first (SurrealDB must be running).
- **Constraint 3** is critical for production deployments to ensure workspace isolation.
