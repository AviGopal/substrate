# Constraint Remediation Guide

## Summary
Total violations requiring immediate action: 3 critical failures

## Critical Violations

### ❌ Constraint 2: Coordination Layer
**Issue**: Only 1/3 backend services running (Redis: yes, SurrealDB: no, API: no)
**Fix**: 
```bash
# Deploy SurrealDB
cd helm
helmfile -f helmfile.yaml -e local --selector name=surrealdb sync --wait

# Verify SurrealDB is running
kubectl get pods -n metabob -l app.kubernetes.io/name=surrealdb

# Deploy metabob-rpc-api
helmfile -f helmfile.yaml -e local --selector name=metabob-rpc-api sync --wait

# Verify API is running
kubectl get pods -n metabob -l app.kubernetes.io/name=metabob-rpc-api
```

### ❌ Constraint 3: Workspace Isolation
**Issue**: Insufficient PVCs (0 < 3 vessels)
**Root Cause**: DevBob StatefulSet not using volumeClaimTemplates OR PVCs not being created
**Fix**:
```bash
# Check if DevBob is using StatefulSet with volumeClaimTemplates
kubectl get statefulset -n metabob

# If it's a Deployment (not StatefulSet), convert it:
# 1. Check current deployment
kubectl get deployment devbob -n metabob -o yaml > /tmp/devbob-deployment.yaml

# 2. Delete deployment
kubectl delete deployment devbob -n metabob

# 3. Create StatefulSet with PVCs
cat <<STATEFULSET | kubectl apply -f -
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: devbob
  namespace: metabob
spec:
  serviceName: devbob
  replicas: 3
  selector:
    matchLabels:
      app.kubernetes.io/name: devbob
  volumeClaimTemplates:
  - metadata:
      name: workspace
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
  template:
    metadata:
      labels:
        app.kubernetes.io/name: devbob
    spec:
      containers:
      - name: devbob
        image: ghcr.io/metabob-labs/devbob-local:latest
        volumeMounts:
        - name: workspace
          mountPath: /workspace
STATEFULSET

# 4. Verify PVCs are created
kubectl get pvc -n metabob
```

### ❌ Constraint 5: Vessel Registry
**Issue**: No vessels registered in SurrealDB (SurrealDB pod not running)
**Root Cause**: SurrealDB deployment missing
**Fix**: Deploy SurrealDB first (see Constraint 2 remediation above), then vessels will auto-register on startup


## Warnings (Non-Critical)

### ⚠️  Constraint 9: Health Probes
**Issue**: No liveness/readiness probes configured
**Recommendation**:
```bash
# Add probes to DevBob Helm values
cat <<VALUES >> helm/values/devbob.yaml
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
  initialDelaySeconds: 10
  periodSeconds: 5
VALUES

# Redeploy
helmfile -f helmfile.yaml -e local --selector name=devbob sync
```

### ⚠️  Constraint 10: Dataflow Enforcement
**Issue**: metabob-rpc-api not deployed
**Recommendation**: Deploy metabob-rpc-api (see Constraint 2 remediation)

## Execution Order

1. **Deploy SurrealDB** (fixes Constraints 2, 5)
2. **Deploy metabob-rpc-api** (fixes Constraint 2, 10)
3. **Convert DevBob to StatefulSet with PVCs** (fixes Constraint 3)
4. **Add health probes** (fixes Constraint 9)

## Verification Commands

After remediation, re-run validation:
```bash
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob
kubectl get pods -n metabob -l app.kubernetes.io/name=surrealdb
kubectl get pods -n metabob -l app.kubernetes.io/name=metabob-rpc-api
kubectl get pvc -n metabob
```
