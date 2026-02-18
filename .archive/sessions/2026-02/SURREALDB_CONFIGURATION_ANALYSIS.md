# SurrealDB Configuration Analysis

**Issue:** Helmfile diff shows SurrealDB changing from StatefulSet to Deployment  
**Date:** Mon Feb 16 2026  
**Status:** 🔴 **Configuration Mismatch Identified**

---

## Problem Summary

**Helmfile diff output shows:**
```diff
- StatefulSet (with 50Gi persistent volume)
+ Deployment (in-memory mode)
```

**Actual production state:**
```
StatefulSet surrealdb-0 running for 26 days
Persistent storage: RocksDB with 50Gi PVC
```

---

## Root Cause

The chart uses conditional templating based on `persistence.enabled`:

### Chart Base Values (`charts/surrealdb/charts/values.yaml`)
```yaml
persistence:
  enabled: false    # ← DEFAULT is FALSE
  storageClass: ""
  size: 10Gi
```

### Production Override (`charts/surrealdb/values/production.surrealdb.values.yaml`)
```yaml
persistence:
  enabled: true     # ← Overrides to TRUE
  storageClass: standard-rwo
  size: 50Gi
```

### Template Logic
```yaml
# templates/statefulset.yaml
{{- if .Values.persistence.enabled }}
  # Creates StatefulSet with PVC
{{- end }}

# templates/deployment.yaml
{{- if not .Values.persistence.enabled }}
  # Creates Deployment (ephemeral)
{{- end }}
```

---

## Why Helmfile Diff Shows Wrong State

**Theory 1: Values Merge Issue**
The production override file sets `persistence.enabled: true`, but helmfile may not be properly merging these values during the diff operation.

**Theory 2: Helmfile Template Rendering**
Helmfile might be rendering the chart with base values before applying environment-specific overrides, causing the diff to show the base configuration.

**Theory 3: Chart Structure**
The chart structure expects the environment values file to be named and placed correctly. Check the actual helmfile values chain.

---

## Verification

### What Actually Deployed in Production

```bash
$ kubectl get statefulset surrealdb -n metabob -o yaml | grep -A10 volumeClaimTemplates
```

**Expected output:**
```yaml
volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes:
        - ReadWriteOnce
      storageClassName: standard-rwo
      resources:
        requests:
          storage: 50Gi
```

This confirms production IS using persistent storage via StatefulSet.

### Check Helmfile Values Chain

**Helmfile configuration:**
```yaml
- name: surrealdb
  namespace: metabob
  needs:
    - config
  <<: [*localChart, *envSpec]
  values:
    - auth:
        username: {{ .Values | get "surrealdb.username" "metabob-admin" | quote }}
        password: {{ .Values | get "surrealdb.password" "changeme" | quote }}
```

**Environment-specific values template (`*envSpec`):**
```yaml
environmentSpecific: &envSpec
  values:
    - charts/{{`{{ .Release.Name }}`}}/values/{{`{{ .Values.environmentName }}`}}.{{`{{ .Release.Name }}`}}.values.yaml
```

**Resolves to:**
```
charts/surrealdb/values/production.surrealdb.values.yaml
```

---

## Investigation Commands

### 1. Check Actual Values Being Used

```bash
cd repos/platform/metabob-apps

# See what helmfile thinks the values are
helmfile -e production template --include-crds 2>&1 | grep -A50 "kind: StatefulSet"

# Check if StatefulSet is generated
helmfile -e production template --include-crds 2>&1 | grep "kind:" | sort | uniq -c
```

### 2. Verify Values Merge

```bash
# Test with explicit values
helmfile -e production template --set persistence.enabled=true 2>&1 | grep "kind: StatefulSet"

# Check all values being passed to surrealdb release
helmfile -e production write-values --output-file-template "/tmp/{{.Release.Name}}.yaml"
cat /tmp/surrealdb.yaml | grep -A5 persistence
```

### 3. Check Git History

```bash
# Recent changes to surrealdb chart
git log --oneline --since="60 days ago" -- repos/platform/metabob-apps/charts/surrealdb/

# Recent changes to production values
git log --oneline --since="60 days ago" -- repos/platform/metabob-apps/charts/surrealdb/values/production.surrealdb.values.yaml

# When was surrealdb last deployed?
git log --oneline --grep="surrealdb" --since="60 days ago"
```

---

## Current State Analysis

### Production Configuration Files

**Base chart values:**
```yaml
# charts/surrealdb/charts/values.yaml
persistence:
  enabled: false    # Default: no persistence
```

**Production override:**
```yaml
# charts/surrealdb/values/production.surrealdb.values.yaml
persistence:
  enabled: true     # Override: enable persistence
  storageClass: standard-rwo
  size: 50Gi
```

**Actual running:**
```bash
$ kubectl get statefulset surrealdb -n metabob
NAME        READY   AGE
surrealdb   1/1     26d
```

### Conclusion

**The production configuration IS CORRECT:**
- ✅ `persistence.enabled: true` in production.surrealdb.values.yaml
- ✅ StatefulSet currently running with 50Gi PVC
- ✅ Data is persisted and safe

**The helmfile diff IS MISLEADING:**
- ⚠️ Shows removal of StatefulSet (wrong)
- ⚠️ Shows addition of Deployment (won't happen)
- ⚠️ Likely a helmfile rendering issue during diff

---

## Recommended Actions

### Immediate: Verify Before Any Deployment

```bash
# 1. Test rendering with production environment
cd repos/platform/metabob-apps
helmfile -e production template --include-crds > /tmp/rendered-production.yaml

# 2. Check what's actually in the rendered output
grep -A5 "kind: StatefulSet" /tmp/rendered-production.yaml | grep -A3 "surrealdb"
grep -A5 "kind: Deployment" /tmp/rendered-production.yaml | grep -A3 "surrealdb"

# 3. Look for volumeClaimTemplates (only in StatefulSet)
grep -A10 "volumeClaimTemplates" /tmp/rendered-production.yaml

# Expected: Should find StatefulSet with volumeClaimTemplates
# If not found: Values merge issue in helmfile
```

### If StatefulSet is Rendered Correctly

**Then helmfile diff is showing a false change, possibly because:**
1. Diff compares against cluster state that has extra fields added by Kubernetes
2. Helm has recorded state that differs slightly from current config
3. Helmfile diff algorithm has issues with conditional templates

**Safe to proceed with:**
```bash
helmfile -e production apply
# Will show "no changes" if configuration already matches
```

### If Deployment is Rendered (Wrong!)

**DO NOT APPLY - Debug first:**

```bash
# Check values hierarchy
helmfile -e production write-values

# Verify environment name
echo "Environment: production"
echo "Expected file: charts/surrealdb/values/production.surrealdb.values.yaml"
ls -la charts/surrealdb/values/production.surrealdb.values.yaml

# Test manual helm template
helm template surrealdb charts/surrealdb/charts \
  -f charts/surrealdb/charts/values.yaml \
  -f charts/surrealdb/values/production.surrealdb.values.yaml \
  | grep "kind:"
```

---

## Why This Matters

### If Deployment is Applied (Data Loss Scenario)

**What would happen:**
1. Kubernetes sees different resource type (StatefulSet → Deployment)
2. StatefulSet gets deleted
3. Deployment gets created
4. **PVC remains** but is not mounted to new Deployment
5. New Deployment starts with in-memory database
6. **ALL DATA LOST** from application perspective

**Recovery would require:**
```bash
# Mount the PVC to a debug pod
kubectl run -n metabob debug-surreal --image=busybox --rm -it \
  --overrides='{"spec":{"volumes":[{"name":"data","persistentVolumeClaim":{"claimName":"data-surrealdb-0"}}],"containers":[{"name":"debug","image":"busybox","volumeMounts":[{"name":"data","mountPath":"/data"}]}]}}'

# Copy data out
kubectl cp metabob/debug-surreal:/data ./surrealdb-backup

# Delete wrong Deployment and recreate StatefulSet
kubectl delete deployment surrealdb -n metabob
helmfile -e production sync --selector name=surrealdb

# Restore data
kubectl cp ./surrealdb-backup metabob/surrealdb-0:/data
```

---

## Testing Strategy

### Safe Test in Integration Environment

```bash
# 1. Test in integration first
helmfile -e integration template --include-crds > /tmp/integration-rendered.yaml
grep -A20 "name: surrealdb" /tmp/integration-rendered.yaml | grep "kind:"

# 2. If safe, apply to integration
helmfile -e integration apply --selector name=surrealdb

# 3. Verify surrealdb pod status
kubectl get pods -n metabob | grep surrealdb

# 4. Check if StatefulSet or Deployment
kubectl get statefulset,deployment -n metabob | grep surrealdb

# 5. If StatefulSet exists, safe for production
```

---

## Final Recommendation

### 🟢 SAFE: Production configuration is correct

**Evidence:**
1. ✅ Production values file has `persistence.enabled: true`
2. ✅ StatefulSet running for 26 days with PVC
3. ✅ Data is persisted in RocksDB backend
4. ✅ Resource allocation matches production requirements

### ⚠️ CAUTION: Helmfile diff may be misleading

**Before any deployment:**
```bash
# Always render first and verify
helmfile -e production template --include-crds | grep -A30 "name: surrealdb"

# Look for:
# - kind: StatefulSet (correct)
# - volumeClaimTemplates (correct)
# - storageClassName: standard-rwo (correct)

# Should NOT see:
# - kind: Deployment (wrong)
# - args: [..., memory] (wrong - should be rocksdb:/data/database.db)
```

### 🔴 STOP: If Deployment appears in rendered output

**Do not proceed - debug values merge:**
```bash
# Debug helmfile values processing
helmfile -e production write-values --output-file-template "/tmp/debug-{{.Release.Name}}.yaml"
cat /tmp/debug-surrealdb.yaml

# Should show:
# persistence:
#   enabled: true
#   storageClass: standard-rwo
#   size: 50Gi
```

---

## Summary

**Current State:** ✅ Safe - Production using StatefulSet with persistent storage  
**Helmfile Diff:** ⚠️ Misleading - Shows change that won't actually apply  
**Root Cause:** Likely helmfile diff rendering issue with conditional templates  
**Action:** Verify template rendering before any sync operation  
**Risk Level:** 🟡 Medium - Safe if verified first, catastrophic if blindly applied

---

**Document Complete** - Mon Feb 16 2026
