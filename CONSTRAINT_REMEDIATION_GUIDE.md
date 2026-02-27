# Constraint Remediation Guide

## Violations Found

### ❌ Constraint 2: Coordination Layer
**Issue**: Only 1/3 backend services running
**Fix**:
```bash
cd helm
helmfile -f helmfile.yaml -e local --selector name=redis sync --wait
helmfile -f helmfile.yaml -e local --selector name=surrealdb sync --wait
helmfile -f helmfile.yaml -e local --selector name=metabob-rpc-api sync --wait
```

### ❌ Constraint 3: Workspace Isolation
**Issue**: Insufficient PVCs (0 < 3)
**Fix**:
```bash
# StatefulSet should auto-create PVCs from volumeClaimTemplates
kubectl get pvc -n metabob
kubectl describe statefulset/devbob -n metabob
```

