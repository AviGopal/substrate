# Constraint Remediation Guide

## Executive Summary

**Status**: VIOLATIONS (4 critical failures, 2 warnings, 1 info)
**Compliance**: 3/10 constraints passed
**Action Required**: Immediate remediation of critical infrastructure components

---

## Critical Violations (Must Fix)

### ❌ Constraint 1: Multi-Vessel Requirement
**Issue**: Only 1 vessel running (need 3+)
**Impact**: Single point of failure - no workload distribution or resilience
**Severity**: CRITICAL

**Fix**:
```bash
# Scale to 3 vessels
kubectl scale deployment/devbob -n metabob --replicas=3

# Wait for all vessels to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=devbob -n metabob --timeout=300s

# Verify
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob
```

---

### ❌ Constraint 2: Coordination Layer
**Issue**: Only 1/3 backend services running (Redis only)
**Impact**: SurrealDB and metabob-rpc-api missing - coordination layer incomplete
**Severity**: CRITICAL

**Fix**:
```bash
cd helm

# Deploy SurrealDB
helmfile -f helmfile.yaml -e local --selector name=surrealdb sync --wait

# Deploy metabob-rpc-api
helmfile -f helmfile.yaml -e local --selector name=metabob-rpc-api sync --wait

# Verify all backend services
kubectl get pods -n metabob -l 'app.kubernetes.io/name in (redis,surrealdb,metabob-rpc-api)'

# Initialize SurrealDB schema (if needed)
kubectl port-forward -n metabob svc/surrealdb 8000:8000 &
curl -X POST http://localhost:8000/sql \
  -H "Content-Type: text/plain" \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  -d "$(cat ../initialize-surrealdb-schema.sql)"
```

---

### ❌ Constraint 3: Workspace Isolation
**Issue**: No PVCs bound for workspace isolation
**Impact**: No persistent workspace storage - data loss risk on pod restart
**Severity**: CRITICAL

**Fix**:
```bash
# Check Helm chart configuration for PVC settings
cat helm/devbob/values.yaml | grep -A 10 persistence

# If persistence is disabled, enable it:
# Edit helm/devbob/values-local.yaml
cat >> helm/devbob/values-local.yaml <<YAML

persistence:
  enabled: true
  storageClass: "standard"  # or your cluster's storage class
  size: 10Gi
YAML

# Redeploy devbob with persistence
cd helm
helmfile -f helmfile.yaml -e local --selector name=devbob sync --wait

# Verify PVCs are created and bound
kubectl get pvc -n metabob
```

---

### ❌ Constraint 5: Vessel Registry
**Issue**: No vessels registered in SurrealDB (database not accessible)
**Impact**: Coordination layer cannot track vessel state
**Severity**: WARNING (depends on Constraint 2 fix)

**Fix**:
```bash
# This should auto-resolve after SurrealDB is deployed (Constraint 2)
# Verify vessel registration after backend deployment:

kubectl port-forward -n metabob svc/surrealdb 8000:8000 &

curl -X POST http://localhost:8000/sql \
  -H "Content-Type: text/plain" \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  -d "SELECT * FROM vessel_registry;"

# If vessels are not auto-registering, check vessel logs
kubectl logs -n metabob -l app.kubernetes.io/name=devbob --tail=50
```

---

## Warnings (Should Fix)

### ⚠️ Constraint 9: Health Probes
**Issue**: No liveness or readiness probes configured
**Impact**: Kubernetes cannot auto-recover failed vessels or manage traffic
**Severity**: WARNING

**Fix**:
```bash
# Add probes to Helm chart values
cat >> helm/devbob/values-local.yaml <<YAML

livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
YAML

# Redeploy
cd helm
helmfile -f helmfile.yaml -e local --selector name=devbob sync --wait

# Verify probes
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o json | \
  jq -r '.items[] | "\(.metadata.name): Liveness=\(.spec.containers[0].livenessProbe != null) Readiness=\(.spec.containers[0].readinessProbe != null)"'
```

---

### ⚠️ Constraint 10: Dataflow Enforcement
**Issue**: metabob-rpc-api not deployed
**Impact**: Cannot enforce dataflow boundaries
**Severity**: WARNING (covered by Constraint 2 fix)

**Fix**: Already covered in Constraint 2 remediation above.

---

## Informational (Optional)

### ℹ️ Constraint 8: Anti-Affinity
**Status**: INFO - All vessels on single node (expected for single-node cluster)
**Impact**: None for single-node clusters
**Action**: Configure anti-affinity when deploying to multi-node clusters

```yaml
# For multi-node production deployments, add to helm/devbob/values.yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: devbob
          topologyKey: kubernetes.io/hostname
```

---

## Remediation Priority

Execute in this order:

1. **Constraint 2** (Backend services) - FIRST
   - Deploy SurrealDB and metabob-rpc-api
   - Initializes coordination layer

2. **Constraint 3** (PVCs) - SECOND
   - Enable persistence in Helm values
   - Redeploy devbob with PVCs

3. **Constraint 1** (Multi-vessel) - THIRD
   - Scale to 3 replicas
   - Verify distribution

4. **Constraint 5** (Vessel registry) - AUTO-RESOLVES
   - Vessels will auto-register after SurrealDB is up

5. **Constraint 9** (Health probes) - FOURTH
   - Add probes to Helm values
   - Enables auto-recovery

6. **Constraint 10** (Dataflow) - AUTO-RESOLVES
   - Covered by Constraint 2 fix

---

## One-Shot Remediation Script

```bash
#!/bin/bash
# Complete remediation in correct order

cd /home/avi/documents/work/exp-repo/metabob-devbob

echo "=== Step 1: Deploy Backend Services ==="
cd helm
helmfile -f helmfile.yaml -e local --selector name=surrealdb sync --wait
helmfile -f helmfile.yaml -e local --selector name=metabob-rpc-api sync --wait

echo "=== Step 2: Initialize SurrealDB Schema ==="
kubectl port-forward -n metabob svc/surrealdb 8000:8000 >/dev/null 2>&1 &
PF_PID=$!
sleep 3
curl -X POST http://localhost:8000/sql \
  -H "Content-Type: text/plain" \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  -d "$(cat ../initialize-surrealdb-schema.sql)"
kill $PF_PID

echo "=== Step 3: Enable Persistence ==="
cat >> helm/devbob/values-local.yaml <<YAML
persistence:
  enabled: true
  storageClass: "standard"
  size: 10Gi
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
YAML

echo "=== Step 4: Redeploy DevBob with Persistence and Probes ==="
helmfile -f helmfile.yaml -e local --selector name=devbob sync --wait

echo "=== Step 5: Scale to 3 Vessels ==="
kubectl scale deployment/devbob -n metabob --replicas=3
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=devbob -n metabob --timeout=300s

echo "=== Step 6: Verify Compliance ==="
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob
kubectl get pvc -n metabob
kubectl get svc -n metabob

echo "✅ Remediation complete. Re-run validation to verify."
```

---

## Verification

After remediation, re-run validation:

```bash
# Use the validate-constraints activity
opencode activity execute validate-deployment-constraints \
  --variables '{"namespace":"metabob"}'

# Or manually verify each constraint
kubectl get pods -n metabob
kubectl get pvc -n metabob
kubectl get svc -n metabob
```

Expected outcome:
- 10/10 constraints PASS or INFO
- 0 critical violations
- All backend services running
- 3 vessels with PVCs bound

---

## Support

If issues persist after remediation:
1. Check logs: `kubectl logs -n metabob -l app.kubernetes.io/name=<component>`
2. Review Helm values: `cat helm/devbob/values-local.yaml`
3. Verify cluster resources: `kubectl describe nodes`
4. Check storage class: `kubectl get storageclass`
