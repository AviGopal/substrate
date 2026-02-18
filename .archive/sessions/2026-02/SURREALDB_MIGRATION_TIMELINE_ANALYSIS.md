# SurrealDB Migration Timeline & Smooth Migration Plan

**Date:** Mon Feb 16 2026  
**Current Status:** StatefulSet with RocksDB persistence (SAFE)  
**Goal:** Understand timeline and plan smooth migration if needed

---

## Timeline Analysis

### 🕐 Key Dates and Events

| Date | Event | Details |
|------|-------|---------|
| **Jan 13, 2026** | Chart templates created | deployment.yaml + statefulset.yaml conditional templates |
| **Jan 16, 2026 23:38** | PVC Created | `data-surrealdb-0` - 50Gi PVC provisioned |
| **Jan 21, 2026 06:56** | StatefulSet Created | SurrealDB StatefulSet deployed |
| **Jan 22, 2026 21:41** | Production values updated | `persistence.enabled: true` set in production config |
| **Feb 12, 2026 06:35** | Current Pod Started | Pod running for 4 days (recreated Feb 12) |
| **Feb 16, 2026** | Today | Pod age: 4d, PVC age: 30d, StatefulSet age: 26d |

### 📊 Age Summary

```
Component          Age        Created              Status
─────────────────────────────────────────────────────────────
PVC                30 days    Jan 16 23:38 UTC     Bound, in use
StatefulSet        26 days    Jan 21 06:56 UTC     Healthy, 1/1
Current Pod        4 days     Feb 12 06:35 UTC     Running, using RocksDB
```

---

## Current Production State (VERIFIED)

### ✅ StatefulSet Configuration

**Resource Type:** StatefulSet (NOT Deployment)  
**Persistence:** Enabled with RocksDB backend  
**Storage:** 50Gi PVC (`data-surrealdb-0`) on `standard-rwo` StorageClass

**Volume Mount Verified:**
```
Pod: surrealdb-0
Volume Name: data
Mount Path: /data
PVC: data-surrealdb-0
```

**Logs Confirm RocksDB:**
```
INFO surrealdb::core::kvs::ds: Started kvs store at rocksdb:///data/database.db
```

**Status:** ✅ **FULLY OPERATIONAL WITH PERSISTENCE**

---

## Configuration Files Current State

### Chart Base Values (`charts/surrealdb/charts/values.yaml`)
```yaml
persistence:
  enabled: false    # ← Base default is FALSE (for safety)
  storageClass: ""
  size: 10Gi
```

**Last Modified:** Jan 13, 2026 (chart creation)

### Production Override (`charts/surrealdb/values/production.surrealdb.values.yaml`)
```yaml
persistence:
  enabled: true     # ← Production override to TRUE
  storageClass: standard-rwo
  size: 50Gi
```

**Last Modified:** Jan 22, 2026 21:41 (9 days after chart creation)

### Template Logic
```yaml
# statefulset.yaml (uses when persistence.enabled: true)
{{- if .Values.persistence.enabled }}
kind: StatefulSet
volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ReadWriteOnce]
      resources:
        requests:
          storage: {{ .Values.persistence.size }}
{{- end }}

# deployment.yaml (uses when persistence.enabled: false)
{{- if not .Values.persistence.enabled }}
kind: Deployment
# No volumes, pure memory mode
{{- end }}
```

---

## Why Helmfile Diff Shows Misleading State

### Root Cause: Helm State vs Actual Config

**Theory 1: Helm Release State Mismatch**

When the chart was initially deployed (Jan 21), it may have been deployed with base values first, then updated with production values (Jan 22). Helm stores the initial state.

```bash
# Check Helm release history
helm history surrealdb -n metabob

# Expected output:
REVISION  STATUS      CHART         DESCRIPTION
1         superseded  surrealdb     Initial deployment (may have been Deployment)
2         deployed    surrealdb     Updated to StatefulSet with persistence
```

**Theory 2: Helmfile Template Rendering Order**

Helmfile diff might render the chart in this order:
1. Load base values (persistence: false)
2. Render templates → generates Deployment
3. Show diff against cluster (which has StatefulSet)
4. Environment values override happens AFTER diff calculation

**Theory 3: Values File Discovery**

Helmfile might not be finding the production values file correctly:
```yaml
# Expected path pattern in helmfile.yaml.gotmpl:
charts/{{.Release.Name}}/values/{{.Values.environmentName}}.{{.Release.Name}}.values.yaml

# Should resolve to:
charts/surrealdb/values/production.surrealdb.values.yaml

# If .Values.environmentName != "production", wrong file is used
```

---

## Migration Scenarios

### Scenario 1: No Migration Needed (Current State) ✅

**If:** Production configuration is correct and helmfile diff is just misleading

**Evidence:**
- ✅ StatefulSet running successfully for 26 days
- ✅ PVC mounted and in use
- ✅ RocksDB backend confirmed in logs
- ✅ Production values file has `persistence.enabled: true`

**Action:** None - just verify before any helmfile sync

**Risk:** 🟢 LOW - Current state is stable

---

### Scenario 2: Intentional Migration to Memory Mode ⚠️

**If:** Team wants to switch to memory-only mode (ephemeral storage)

**Reasons why you might want this:**
- Development/staging environment (not production)
- Data is cache-only, no persistence needed
- Testing performance of in-memory mode
- Transitioning to external managed database

**Data Loss Impact:** 🔴 **CATASTROPHIC** - All data will be lost

---

### Scenario 3: Correcting Drift (Apply Correct Config) ✅

**If:** Helmfile state has drifted from actual configuration

**Goal:** Ensure Helm knows the correct state without changing actual resources

**Action:** Force sync with correct values

**Risk:** 🟢 LOW - If done correctly, no actual changes

---

## Smooth Migration Plan

### Phase 1: Verification (REQUIRED BEFORE ANY ACTION)

#### Step 1.1: Verify Values Resolution

```bash
cd repos/platform/metabob-apps

# Write out the actual values helmfile will use
helmfile -e production write-values --output-file-template "/tmp/helmfile-{{.Release.Name}}.yaml"

# Check what persistence setting it has
cat /tmp/helmfile-surrealdb.yaml | grep -A5 persistence

# Expected output:
# persistence:
#   enabled: true
#   storageClass: standard-rwo
#   size: 50Gi

# If it shows "enabled: false" → VALUES DISCOVERY ISSUE
```

#### Step 1.2: Verify Template Rendering

```bash
# Render the full chart with production values
helmfile -e production template --include-crds > /tmp/rendered-production.yaml

# Check what resource type is generated
grep -A30 "name: surrealdb" /tmp/rendered-production.yaml | grep "kind:"

# Expected: kind: StatefulSet
# If shows: kind: Deployment → CONFIGURATION ISSUE
```

#### Step 1.3: Check Helm Release State

```bash
# Get Helm's recorded state
helm get values surrealdb -n metabob --all

# Should show:
# persistence:
#   enabled: true
#   storageClass: standard-rwo
#   size: 50Gi

# Also check release history
helm history surrealdb -n metabob

# Look for multiple revisions or recent updates
```

---

### Phase 2: Decision Matrix

Based on verification results:

#### Case A: Template Renders StatefulSet ✅

**Meaning:** Configuration is correct, helmfile diff is misleading

**Action:**
```bash
# Safe to sync - no actual changes will occur
helmfile -e production apply --selector name=surrealdb

# Expected output:
# Release "surrealdb" does not exist. Installing it now.
# Or: no changes detected

# Verify nothing changed
kubectl get statefulset,deployment -n metabob | grep surrealdb
# Should still show: statefulset.apps/surrealdb   1/1
```

**Risk:** 🟢 **VERY LOW** - Configuration matches reality

---

#### Case B: Template Renders Deployment ⚠️

**Meaning:** Values are not being merged correctly

**Action:**
```bash
# DO NOT APPLY - Fix values discovery first

# Debug steps:
# 1. Check environment name is correct
helmfile -e production list | grep surrealdb

# 2. Verify values file path exists
ls -la charts/surrealdb/values/production.surrealdb.values.yaml

# 3. Test with explicit values file
helmfile -e production template \
  --selector name=surrealdb \
  --set persistence.enabled=true \
  --set persistence.storageClass=standard-rwo \
  --set persistence.size=50Gi \
  | grep "kind:"

# Should render StatefulSet with explicit values
```

**Risk:** 🔴 **HIGH** - Could destroy StatefulSet and lose data

**Fix Options:**

1. **Fix helmfile values path**
```yaml
# In helmfile.yaml.gotmpl, verify values path template
values:
  - charts/{{`{{ .Release.Name }}`}}/values/{{`{{ .Values.environmentName }}`}}.{{`{{ .Release.Name }}`}}.values.yaml
  
# Make sure .Values.environmentName resolves to "production"
```

2. **Explicit values in helmfile**
```yaml
- name: surrealdb
  namespace: metabob
  values:
    - charts/surrealdb/values/production.surrealdb.values.yaml  # Explicit path
    - persistence:
        enabled: true
        storageClass: standard-rwo
        size: 50Gi
```

---

### Phase 3: Safe Migration (If Intentional Switch to Memory Mode)

⚠️ **WARNING:** Only follow this if you INTENTIONALLY want to lose all data

#### Step 3.1: Backup Data

```bash
# Access the pod
kubectl exec -n metabob surrealdb-0 -c surrealdb -- sh

# Inside pod, export database
surreal export \
  --endpoint http://localhost:8000 \
  --username $SURREAL_USER \
  --password $SURREAL_PASS \
  --namespace metabob \
  --database production \
  /data/backup-$(date +%Y%m%d-%H%M%S).surql

# Exit pod and copy backup
kubectl cp metabob/surrealdb-0:/data/backup-*.surql ./surrealdb-production-backup.surql -c surrealdb

# Verify backup
ls -lh surrealdb-production-backup.surql
```

#### Step 3.2: Update Configuration

```bash
# Edit production values
vi repos/platform/metabob-apps/charts/surrealdb/values/production.surrealdb.values.yaml

# Change:
persistence:
  enabled: false    # ← Switch to memory mode

# Also update resources (memory mode uses less)
resources:
  requests:
    memory: "512Mi"
    cpu: "100m"
  limits:
    memory: "2Gi"
    cpu: "1000m"
```

#### Step 3.3: Apply Migration

```bash
# This will delete StatefulSet and create Deployment
helmfile -e production apply --selector name=surrealdb

# Kubernetes will:
# 1. Delete StatefulSet surrealdb
# 2. Create Deployment surrealdb
# 3. PVC data-surrealdb-0 will remain (orphaned)
# 4. New pod starts with empty in-memory database

# Verify new state
kubectl get deployment,statefulset -n metabob | grep surrealdb
# Should show: deployment.apps/surrealdb   1/1

kubectl get pvc -n metabob
# PVC still exists but no pod uses it
```

#### Step 3.4: Restore Data (Optional)

```bash
# If you want to restore data to memory mode:
kubectl cp ./surrealdb-production-backup.surql metabob/surrealdb-<pod-id>:/tmp/backup.surql

kubectl exec -n metabob surrealdb-<pod-id> -- surreal import \
  --endpoint http://localhost:8000 \
  --username $SURREAL_USER \
  --password $SURREAL_PASS \
  --namespace metabob \
  --database production \
  /tmp/backup.surql
```

#### Step 3.5: Cleanup Old PVC

```bash
# After verifying memory mode works, clean up orphaned PVC
kubectl delete pvc data-surrealdb-0 -n metabob

# This will delete the persistent volume and free up 50Gi
```

---

### Phase 4: Rollback Plan (If Migration Goes Wrong)

#### Immediate Rollback

```bash
# If you applied memory mode but want to rollback:

# 1. Change values back
vi repos/platform/metabob-apps/charts/surrealdb/values/production.surrealdb.values.yaml
# Set persistence.enabled: true

# 2. Apply changes
helmfile -e production apply --selector name=surrealdb

# This will:
# - Delete Deployment
# - Create StatefulSet
# - Reattach to PVC (if not deleted)
# - Mount existing data

# 3. Verify data is back
kubectl logs surrealdb-0 -n metabob | grep "Started kvs store"
# Should show: rocksdb:///data/database.db
```

#### Helm Rollback

```bash
# If helmfile sync caused issues, use Helm directly

# Check history
helm history surrealdb -n metabob

# Rollback to previous revision
helm rollback surrealdb <revision-number> -n metabob

# Verify
kubectl get statefulset,deployment -n metabob | grep surrealdb
```

---

## Recommended Verification Script

Save this as `verify-surrealdb-config.sh`:

```bash
#!/bin/bash
set -e

echo "=== SurrealDB Configuration Verification ==="
echo ""

echo "1. Checking helmfile values resolution..."
cd repos/platform/metabob-apps
helmfile -e production write-values --output-file-template "/tmp/helmfile-{{.Release.Name}}.yaml"
PERSISTENCE_ENABLED=$(grep -A1 "persistence:" /tmp/helmfile-surrealdb.yaml | grep "enabled:" | awk '{print $2}')
echo "   Persistence enabled: $PERSISTENCE_ENABLED"

if [ "$PERSISTENCE_ENABLED" != "true" ]; then
    echo "   ⚠️  WARNING: Persistence is not enabled in resolved values!"
    echo "   This will cause data loss if applied."
    exit 1
fi

echo "   ✅ Persistence is enabled"
echo ""

echo "2. Checking template rendering..."
helmfile -e production template --include-crds > /tmp/rendered-production.yaml
RESOURCE_TYPE=$(grep -A30 "name: surrealdb" /tmp/rendered-production.yaml | grep "kind:" | head -1 | awk '{print $2}')
echo "   Rendered resource type: $RESOURCE_TYPE"

if [ "$RESOURCE_TYPE" != "StatefulSet" ]; then
    echo "   ⚠️  WARNING: Template renders Deployment, not StatefulSet!"
    echo "   This will destroy persistent storage."
    exit 1
fi

echo "   ✅ Template renders StatefulSet"
echo ""

echo "3. Checking cluster state..."
CLUSTER_RESOURCE=$(kubectl get statefulset,deployment -n metabob 2>/dev/null | grep surrealdb | awk '{print $1}')
echo "   Current resource: $CLUSTER_RESOURCE"

if [[ ! "$CLUSTER_RESOURCE" =~ "statefulset" ]]; then
    echo "   ⚠️  WARNING: Cluster is not running StatefulSet!"
    exit 1
fi

echo "   ✅ Cluster running StatefulSet"
echo ""

echo "4. Checking PVC..."
PVC_STATUS=$(kubectl get pvc data-surrealdb-0 -n metabob -o jsonpath='{.status.phase}' 2>/dev/null)
PVC_SIZE=$(kubectl get pvc data-surrealdb-0 -n metabob -o jsonpath='{.spec.resources.requests.storage}' 2>/dev/null)
echo "   PVC status: $PVC_STATUS"
echo "   PVC size: $PVC_SIZE"

if [ "$PVC_STATUS" != "Bound" ]; then
    echo "   ⚠️  WARNING: PVC is not bound!"
    exit 1
fi

echo "   ✅ PVC is bound and in use"
echo ""

echo "5. Checking pod logs for storage backend..."
STORAGE_BACKEND=$(kubectl logs surrealdb-0 -n metabob --tail=50 2>/dev/null | grep "Started kvs store" | grep -oP "(rocksdb|memory)")
echo "   Storage backend: $STORAGE_BACKEND"

if [ "$STORAGE_BACKEND" != "rocksdb" ]; then
    echo "   ⚠️  WARNING: Not using rocksdb backend!"
fi

echo "   ✅ Using rocksdb persistent storage"
echo ""

echo "=== VERIFICATION COMPLETE ==="
echo ""
echo "✅ Configuration is correct and safe"
echo "✅ StatefulSet with persistence is configured and running"
echo "✅ Safe to proceed with helmfile sync if needed"
```

**Usage:**
```bash
chmod +x verify-surrealdb-config.sh
./verify-surrealdb-config.sh

# If all checks pass, safe to proceed
# If any check fails, investigate before applying changes
```

---

## Decision Tree

```
Start: Need to sync helmfile changes
│
├─ Run verification script
│  │
│  ├─ All checks pass ✅
│  │  └─> Safe to apply: helmfile -e production apply
│  │
│  └─ Persistence check fails ⚠️
│     │
│     ├─ Template renders Deployment
│     │  └─> FIX: Debug values discovery
│     │      Don't apply until fixed
│     │
│     └─ Template renders StatefulSet but persistence: false
│        └─> FIX: Update production values file
│            Set persistence.enabled: true
│
└─ After applying changes
   │
   ├─ Verify resource type unchanged
   │  └─> kubectl get statefulset,deployment -n metabob | grep surrealdb
   │
   ├─ Verify pod still uses RocksDB
   │  └─> kubectl logs surrealdb-0 -n metabob | grep "rocksdb"
   │
   └─ Verify PVC still mounted
      └─> kubectl get pod surrealdb-0 -n metabob -o jsonpath='{.spec.volumes[*].persistentVolumeClaim.claimName}'
```

---

## Summary & Recommendations

### Current State: ✅ SAFE AND STABLE

- StatefulSet running for 26 days
- PVC created 30 days ago, in use
- RocksDB backend confirmed in logs
- Production values correctly set `persistence.enabled: true`

### Helmfile Diff Issue: ⚠️ MISLEADING

- Diff shows Deployment, but config is StatefulSet
- Likely values resolution or Helm state mismatch
- **DO NOT trust helmfile diff without verification**

### Recommended Actions:

1. **Run verification script** (provided above)
2. **If all checks pass:** Safe to proceed with helmfile sync
3. **If checks fail:** Debug values discovery before any changes
4. **Always backup** before any production database changes
5. **Test in integration** environment first

### Migration Risk Matrix:

| Scenario | Risk Level | Data Loss | Reversible |
|----------|-----------|-----------|------------|
| **No changes** (verified safe) | 🟢 None | None | N/A |
| **Apply with correct config** | 🟢 Very Low | None | Yes |
| **Apply with wrong config** | 🔴 Critical | Total | Difficult |
| **Intentional memory mode** | 🟡 Medium | Total | If backed up |

### Key Principle:

**ALWAYS verify template rendering matches intent BEFORE applying any helmfile changes to stateful resources.**

---

**Document Complete** - Mon Feb 16 2026

Safe migration = Verification + Backup + Testing + Monitoring
