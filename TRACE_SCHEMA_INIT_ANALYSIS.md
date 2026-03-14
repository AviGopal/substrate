# Database Schema Initialization - Trace Analysis

**Specification**: Database Schema Initialization - Automatic Schema Creation on Fresh Deployment  
**Date**: March 13, 2026  
**Analysis Method**: trace-data-flow-single-feature  
**Status**: Root cause identified, fix strategy documented

---

## Executive Summary

### Current State ❌
- SurrealDB schema initialization **DISABLED** (initSchema.enabled=false)
- No guaranteed database schema on fresh deployments
- Schema created implicitly by RPC API on first request
- BackoffLimitExceeded errors when init-schema Job is enabled

### Root Cause 🎯
**Namespace/Database Configuration Mismatch**
- SurrealDB server starts WITHOUT namespace/database in startup args
- init-schema Kubernetes Job connects WITH specific namespace/database
- Mismatch causes Job to fail connecting to expected database

### Desired State ✅
- Automatic schema initialization via Kubernetes Job (post-install hook)
- All 13 tables created with PERMISSIONS FULL
- 8 indexes created for performance
- Guaranteed schema state before RPC API starts

---

## Components Analyzed

### 1. Configuration Control
**File**: `repos/platform/metabob-apps/charts/surrealdb/values/default.surrealdb.values.yaml:40`

**Current**: `initSchema.enabled: false`  
**Desired**: `initSchema.enabled: true`  
**Gap**: Disabled to prevent BackoffLimitExceeded errors (commit 731c717)

---

### 2. Kubernetes Job
**File**: `repos/platform/metabob-apps/charts/surrealdb/charts/templates/init-schema-job.yaml`

**Current**: Job defined but never runs (conditional on initSchema.enabled)  
**Desired**: Job runs as post-install/post-upgrade hook  
**Gap**: Environment variables SURREAL_NAMESPACE and SURREAL_DATABASE must match server

**Configuration**:
```yaml
env:
  - name: SURREAL_NAMESPACE
    value: "{{ .Values.database.namespace }}"  # metabob
  - name: SURREAL_DATABASE
    value: "{{ .Values.database.name }}"       # production
```

---

### 3. SurrealDB Deployment (In-Memory Mode)
**File**: `repos/platform/metabob-apps/charts/surrealdb/charts/templates/deployment.yaml:32-40`

**Current**: Starts with `memory` storage, NO namespace/database args  
**Desired**: Explicitly set namespace/database matching Job expectations  
**Gap**: Missing startup args

**Current Args**:
```yaml
args:
  - start
  - --user
  - $(SURREAL_USER)
  - --pass
  - $(SURREAL_PASS)
  - --log
  - info
  - memory
```

**Required Args**:
```yaml
args:
  - start
  - --user
  - $(SURREAL_USER)
  - --pass
  - $(SURREAL_PASS)
  - --log
  - info
  - --ns
  - "{{ .Values.database.namespace }}"
  - --db
  - "{{ .Values.database.name }}"
  - memory
```

---

### 4. SurrealDB StatefulSet (Persistent Mode)
**File**: `repos/platform/metabob-apps/charts/surrealdb/charts/templates/statefulset.yaml:47-56`

**Current**: Starts with RocksDB storage, NO namespace/database args  
**Desired**: Explicitly set namespace/database matching Job expectations  
**Gap**: Missing startup args (same as Deployment)

**Current Args**:
```yaml
args:
  - start
  - --user
  - $(SURREAL_USER)
  - --pass
  - $(SURREAL_PASS)
  - --log
  - info
  - rocksdb:/data/database.db
```

**Required Args**:
```yaml
args:
  - start
  - --user
  - $(SURREAL_USER)
  - --pass
  - $(SURREAL_PASS)
  - --log
  - info
  - --ns
  - "{{ .Values.database.namespace }}"
  - --db
  - "{{ .Values.database.name }}"
  - rocksdb:/data/database.db
```

---

### 5. Database Configuration Values
**File**: `repos/platform/metabob-apps/charts/surrealdb/charts/values.yaml:28-30`

**Current**: Values defined but not used by server  
**Desired**: Values used by both server and Job  
**Gap**: Templates don't reference these values

```yaml
database:
  namespace: metabob      # ← Defined but not used
  name: production        # ← Defined but not used
```

---

### 6. Schema Initialization Script
**File**: `repos/platform/metabob-apps/charts/surrealdb/charts/templates/init-schema-configmap.yaml:10-198`

**Status**: ✅ Script is correct - no changes needed

**What it does**:
1. Waits for SurrealDB health check
2. Authenticates with SURREAL_USER/SURREAL_PASS
3. Creates 13 tables with PERMISSIONS FULL
4. Creates 8 indexes
5. Verifies all tables have correct permissions
6. Exits with success/failure

**Tables Created**:
- activity_template, activity_execution, activity_variants
- variant_performance_metrics, vessel_registry
- users, sessions, organizations, projects, subscriptions
- api_keys, audit_logs, schema_versions

**Indexes Created**:
- activity_template_id_idx, activity_template_category_idx, activity_template_org_idx
- activity_execution_id_idx, activity_execution_template_idx, activity_execution_status_idx
- vessel_registry_pod_name_idx, vessel_registry_status_idx

---

### 7. Manual CLI Fallback
**File**: `repos/metabob-rpc-api/server/cli.py:56-110`

**Purpose**: Manual schema initialization command  
**Status**: Exists as fallback but doesn't solve automatic deployment  
**Usage**: `python -m server.cli db init-schema`

**Not part of automated deployment flow**

---

### 8. RPC API Application
**File**: `repos/metabob-rpc-api/server/app.py`

**Current**: No schema initialization in lifespan startup  
**Desired**: Continue to NOT initialize schema (separation of concerns)  
**Status**: ✅ Correct - schema is Job's responsibility

---

## Data Flow

### Current Flow (BROKEN)
```
helmfile apply
  ↓
SurrealDB Deployment starts
  • memory or rocksdb storage
  • NO --ns / --db args
  • Uses default namespace/database
  ↓
init-schema Job SKIPPED
  • initSchema.enabled=false
  • No tables created
  ↓
RPC API starts
  • Expects tables to exist
  • Creates tables implicitly on first request
  ↓
❌ Schema state unknown
❌ No guaranteed consistency
```

### Desired Flow (FIXED)
```
helmfile apply
  ↓
SurrealDB Deployment starts
  • WITH --ns metabob --db production
  • Uses configured namespace/database
  ↓
init-schema Job runs (post-install hook)
  • Connects to namespace=metabob database=production
  • Creates 13 tables with PERMISSIONS FULL
  • Creates 8 indexes
  • Verifies schema correctness
  • Exits with success
  ↓
RPC API starts
  • Schema guaranteed to exist
  • All tables ready
  ↓
✅ Schema state guaranteed
✅ Fully automated deployment
```

---

## Fix Strategy

### Step 1: Add namespace/database args to SurrealDB server
**Files**:
- `repos/platform/metabob-apps/charts/surrealdb/charts/templates/deployment.yaml`
- `repos/platform/metabob-apps/charts/surrealdb/charts/templates/statefulset.yaml`

**Change**: Add after `--log info` and before storage mode:
```yaml
- --ns
- "{{ .Values.database.namespace }}"
- --db
- "{{ .Values.database.name }}"
```

**Reason**: SurrealDB server must use same namespace/database as init-schema Job

---

### Step 2: Re-enable init-schema hook
**File**: `repos/platform/metabob-apps/charts/surrealdb/values/default.surrealdb.values.yaml`

**Change**:
```yaml
initSchema:
  enabled: true  # was: false
```

**Reason**: Once namespace/database is fixed, Job should work

---

### Step 3: Test fresh deployment
**Command**:
```bash
cd repos/platform/metabob-apps
helmfile -e default destroy
helmfile -e default apply
```

**Validation**:
```bash
kubectl get jobs -n metabob | grep init-schema
# Expected: surrealdb-init-schema   1/1    XX s
```

---

### Step 4: Verify schema created
**Command**:
```bash
kubectl logs -n metabob job/surrealdb-init-schema
```

**Expected Output**:
```
🚀 Running schema initialization from RPC API image...
⏳ Waiting for SurrealDB at http://surrealdb:8000...
✅ SurrealDB is ready!
🔌 Connecting to http://surrealdb:8000...
🔐 Signing in as root...
✅ Authenticated successfully
📂 Using namespace: metabob, database: production
📊 Creating 13 tables with PERMISSIONS FULL...
  ✅ activity_template
  ✅ activity_execution
  ... (all tables)
🔍 Creating 8 indexes...
  ✅ activity_template_id_idx
  ... (all indexes)
🔎 Verifying table permissions...
  ✅ activity_template: PERMISSIONS FULL
  ... (all tables verified)
✅ 13/13 tables have PERMISSIONS FULL
🎉 Schema initialization successful!
```

---

## Evidence

### Commit 731c717
```
fix: Disable SurrealDB initSchema hook to prevent BackoffLimitExceeded errors

The init schema job fails due to namespace/database mismatch.
Schema will be initialized by RPC API on first start.
```

### DRY_DEPLOYMENT_SUCCESS.md
> **Issue #2: SurrealDB Init Schema Hook**
> - **Problem**: BackoffLimitExceeded due to namespace/database mismatch
> - **Fix**: Disabled initSchema in `charts/surrealdb/values/default.surrealdb.values.yaml`

### DEPLOYMENT_DRY_ANALYSIS_AND_SOLUTION.md
> **Phase 2: Fix Database Schema Management (2-3 hours)**
> 
> **Tasks**:
> 1. Fix SurrealDB init schema job namespace/database config
> 2. Re-enable init schema hook
> 3. Test init schema job independently
> 4. Validate schema created correctly

---

## Impact Summary

### Tables Affected: 13
- Core Activity System: activity_template, activity_execution, activity_variants, variant_performance_metrics
- Vessel Registry: vessel_registry
- User Management: users, sessions, organizations, projects, subscriptions
- System: api_keys, audit_logs, schema_versions

### Indexes Affected: 8
- Performance-critical indexes for activity and vessel lookups

### Deployments Affected: All Fresh Deployments
- Any `helmfile apply` from clean state has unknown schema state
- Database consistency not guaranteed

---

## Next Steps

1. ✅ **COMPLETE**: Trace analysis documented
2. ⏭️ **TODO**: Implement fix (modify deployment/statefulset templates)
3. ⏭️ **TODO**: Re-enable initSchema hook
4. ⏭️ **TODO**: Test fresh deployment
5. ⏭️ **TODO**: Validate schema initialization success

---

**Impulse Created**: `trace-Database Schema Initialization - Automatic Schema Creation on Fresh Deployment`  
**Budget**: 5000 tokens  
**Type**: templateDefinition

This impulse can be used by downstream enforcement and validation tasks.
