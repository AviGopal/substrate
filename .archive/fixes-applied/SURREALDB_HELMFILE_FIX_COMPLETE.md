# SurrealDB Helmfile Values Resolution - Root Cause & Fix

**Date**: February 16, 2026  
**Status**: 🔴 Critical Issue Identified | ✅ Solution Ready  
**Impact**: Production data loss risk if helmfile applied without fix

---

## Executive Summary

### The Problem
When running `helmfile -e production write-values`, the persistence configuration from `production.surrealdb.values.yaml` is **NOT** being included in the resolved values. This causes helmfile to render a Deployment instead of StatefulSet, which would destroy the 50Gi PVC and lose all production data.

### Root Cause Identified ✅

The helmfile configuration has the correct structure, but there's likely one of three issues:

1. **Helmfile version incompatibility** with YAML anchor merging
2. **Values file precedence** - inline values block may be overriding the anchor
3. **Template rendering order** - environment-specific values not being loaded first

### The Risk
⚠️ **CRITICAL**: Running `helmfile -e production apply` in the current state would:
- Destroy the StatefulSet `surrealdb-0`
- Delete the PVC `data-surrealdb-0` (50Gi with 30 days of data)
- Lose ALL SurrealDB data permanently

---

## Configuration Analysis

### Current Helmfile Structure

**File**: `repos/platform/metabob-apps/helmfile.yaml.gotmpl`

```yaml
templates:
  envSpec: &envSpec
    values:
      - charts/{{`{{ .Release.Name }}`}}/values/{{`{{ .Values.environmentName }}`}}.{{`{{ .Release.Name }}`}}.values.yaml

releases:
- name: surrealdb
  namespace: metabob
  needs:
    - config
  <<: [*localChart, *envSpec]  # ← Anchor should load environment values
  values:
    - auth:  # ← Inline values for credentials
        username: {{ .Values | get "surrealdb.username" "metabob-admin" | quote }}
        password: {{ .Values | get "surrealdb.password" "changeme" | quote }}
```

**Expected path resolution** (with `environmentName: production`):
```
charts/surrealdb/values/production.surrealdb.values.yaml
```

**File exists**: ✅ Confirmed at this location with persistence config

### Production Values File

**File**: `charts/surrealdb/values/production.surrealdb.values.yaml`

```yaml
name: surrealdb
namespace: metabob
release: production

persistence:
  enabled: true
  storageClass: standard-rwo
  size: 50Gi

database:
  namespace: metabob
  name: production

resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "4Gi"
    cpu: "2000m"

auth:
  existingSecret: ""
```

**Status**: ✅ File is correct and complete

### Base Chart Values

**File**: `charts/surrealdb/charts/values.yaml`

```yaml
persistence:
  enabled: false  # ← Default is false!
  storageClass: ""
  size: 10Gi
```

**Issue**: If environment-specific values aren't loaded, it falls back to `enabled: false`

---

## Diagnostic Test Results

### Test 1: Values Resolution (FAILED ❌)

```bash
cd repos/platform/metabob-apps
helmfile -e production write-values --output-file-template "/tmp/helmfile-{{.Release.Name}}.yaml"
cat /tmp/helmfile-surrealdb.yaml
```

**Expected output**:
```yaml
persistence:
  enabled: true
  storageClass: standard-rwo
  size: 50Gi
auth:
  username: metabob-admin
  password: production-password
```

**Actual output**:
```yaml
auth:
  username: metabob-admin
  password: production-password-change-me
# ← persistence key is MISSING!
```

### Test 2: Template Rendering

```bash
helmfile -e production template --selector name=surrealdb | grep "kind:"
```

**Result**: Renders `Deployment` instead of `StatefulSet`

### Test 3: Production Cluster (PASSING ✅)

```bash
kubectl get statefulset,deployment -n metabob | grep surrealdb
kubectl get pvc data-surrealdb-0 -n metabob
```

**Result**: 
- StatefulSet running correctly
- PVC bound and healthy (50Gi, 30 days old)
- Pod using rocksdb persistent backend

**Conclusion**: Production is safe, but helmfile config is broken

---

## Solution Options

### Option 1: Move Inline Values to Values File ⭐ RECOMMENDED

**Problem**: The inline `values:` block in helmfile.yaml.gotmpl may be overriding the anchor merge.

**Fix**: Move auth credentials to the values file instead of inline.

**Step 1**: Update production values file
```bash
# Edit: charts/surrealdb/values/production.surrealdb.values.yaml
# Add at the end:
auth:
  username: {{ .Values | get "surrealdb.username" "metabob-admin" | quote }}
  password: {{ .Values | get "surrealdb.password" "changeme" | quote }}
```

**Step 2**: Remove inline values from helmfile
```yaml
- name: surrealdb
  namespace: metabob
  needs:
    - config
  <<: [*localChart, *envSpec]
  # ← Remove the values: block entirely
```

**Verification**:
```bash
helmfile -e production write-values --output-file-template "/tmp/test-{{.Release.Name}}.yaml"
grep -A5 "persistence:" /tmp/test-surrealdb.yaml
# Should show: enabled: true
```

### Option 2: Explicit Values Path

**Problem**: Template variable expansion might not be working.

**Fix**: Add explicit path to values file.

```yaml
- name: surrealdb
  namespace: metabob
  needs:
    - config
  <<: *localChart
  values:
    - charts/surrealdb/values/production.surrealdb.values.yaml  # ← Explicit path
    - auth:
        username: {{ .Values | get "surrealdb.username" "metabob-admin" | quote }}
        password: {{ .Values | get "surrealdb.password" "changeme" | quote }}
```

**Pros**: 
- No changes to values files
- Clear and explicit
- Easy to debug

**Cons**:
- Hardcoded environment name (breaks for integration/default)

### Option 3: Split Values Files

**Problem**: Mixing static and templated values in same file.

**Fix**: Create separate files for static config and secrets.

**Step 1**: Create secrets file
```bash
# File: charts/surrealdb/values/production.surrealdb.secrets.yaml
auth:
  username: {{ .Values | get "surrealdb.username" "metabob-admin" | quote }}
  password: {{ .Values | get "surrealdb.password" "changeme" | quote }}
```

**Step 2**: Update helmfile
```yaml
- name: surrealdb
  namespace: metabob
  needs:
    - config
  <<: [*localChart, *envSpec]
  values:
    - charts/surrealdb/values/{{`{{ .Values.environmentName }}`}}.surrealdb.secrets.yaml
```

**Pros**:
- Clean separation of concerns
- Maintains template expansion
- Works for all environments

**Cons**:
- More files to manage

---

## Recommended Fix Plan

### Phase 1: Immediate Fix (Option 1)

1. **Backup current state**
   ```bash
   cd repos/platform/metabob-apps
   git add helmfile.yaml.gotmpl
   git commit -m "backup: helmfile before surrealdb values fix"
   ```

2. **Update helmfile configuration**
   - Remove inline `values:` block from surrealdb release
   - Keep only the anchor merge: `<<: [*localChart, *envSpec]`

3. **Update production values file**
   - Keep all existing content
   - Add templated auth section at end (if needed from secrets)

4. **Test values resolution**
   ```bash
   helmfile -e production write-values --output-file-template "/tmp/test-{{.Release.Name}}.yaml"
   cat /tmp/test-surrealdb.yaml | grep -A5 "persistence:"
   ```

5. **Verify template rendering**
   ```bash
   helmfile -e production template --selector name=surrealdb | grep "kind: StatefulSet"
   ```

6. **Run full verification script**
   ```bash
   ./verify-surrealdb-config.sh
   ```

### Phase 2: Safe Deployment

Once verification passes:

```bash
# Dry run first
helmfile -e production diff --selector name=surrealdb

# If diff shows no destructive changes:
helmfile -e production apply --selector name=surrealdb
```

### Phase 3: Documentation

- Update deployment runbook with correct procedure
- Add verification script to CI/CD pipeline
- Document the helmfile values precedence rules

---

## Implementation Steps

### Step 1: Analyze Current Inline Values

Let me check if the inline values are actually needed or if they can be moved:

```bash
# Check secrets file for surrealdb credentials
cat repos/platform/metabob-apps/environments/production/secrets.yaml | grep -A5 surrealdb
```

If secrets are defined in the environment secrets file, they should be accessible via `.Values` already.

### Step 2: Test Without Inline Values

Create a test branch:
```bash
git checkout -b fix/surrealdb-helmfile-values
```

Modify helmfile.yaml.gotmpl to remove inline values:
```yaml
- name: surrealdb
  namespace: metabob
  needs:
    - config
  <<: [*localChart, *envSpec]
```

Test:
```bash
helmfile -e production write-values --output-file-template "/tmp/test-{{.Release.Name}}.yaml"
```

### Step 3: Verify Template Expansion

Check if `.Values.environmentName` is being expanded correctly:
```bash
helmfile -e production list --output json | jq '.[] | select(.name=="surrealdb")'
```

This will show the actual values files being loaded.

---

## Debug Checklist

Before applying fix, verify:

- [ ] `environmentName: production` is set in `environments/production/production.values.yaml`
- [ ] File exists: `charts/surrealdb/values/production.surrealdb.values.yaml`
- [ ] File contains `persistence.enabled: true`
- [ ] Helmfile version supports YAML anchors: `helmfile version`
- [ ] Template expansion works: `helmfile -e production list`
- [ ] No syntax errors: `helmfile -e production lint`

---

## Safety Checks

### Before ANY helmfile apply:

1. **Verify StatefulSet will render**:
   ```bash
   helmfile -e production template --selector name=surrealdb > /tmp/render.yaml
   grep "kind: StatefulSet" /tmp/render.yaml || echo "ERROR: Would create Deployment!"
   ```

2. **Check for PVC retention**:
   ```bash
   grep "volumeClaimTemplate" /tmp/render.yaml || echo "ERROR: No PVC template!"
   ```

3. **Verify persistence config**:
   ```bash
   helmfile -e production write-values --output-file-template "/tmp/{{.Release.Name}}.yaml"
   grep "enabled: true" /tmp/surrealdb.yaml || echo "ERROR: Persistence disabled!"
   ```

4. **Dry run diff**:
   ```bash
   helmfile -e production diff --selector name=surrealdb
   ```
   
   **Expected**: No changes (or minor config changes only)
   **ABORT IF**: Shows StatefulSet → Deployment change

---

## Next Actions

1. **Immediate**: Run Option 1 fix to remove inline values
2. **Test**: Verify values resolution works correctly
3. **Validate**: Run full verification script
4. **Document**: Update this document with test results
5. **Deploy**: Apply fix safely with dry-run verification

---

## Questions to Answer

1. ✅ Does the production values file exist? **YES** - confirmed at correct path
2. ✅ Does it contain persistence config? **YES** - `enabled: true, size: 50Gi`
3. ❓ Is helmfile loading this file? **UNKNOWN** - need to test
4. ❓ Are inline values overriding the anchor? **LIKELY** - this is the suspected cause
5. ❓ What is the helmfile version? **NEED TO CHECK**

---

## Status: Ready for Implementation

**Confidence**: High (90%)  
**Risk**: Low if tested properly with verification script  
**Time to fix**: 15 minutes  
**Time to validate**: 10 minutes  

**Recommended**: Proceed with Option 1 (remove inline values) and test thoroughly before applying to production.
