# Validation Results: SurrealDB v3.0.0 Schema Initialization on K8s Deployment

**Impulse ID:** validation-results-surrealdb-v3-schema-init  
**Type:** memo  
**Timestamp:** 2026-03-14T04:16:01Z  
**Harness:** tests/validation-harnesses/surrealdb-v3-schema-init-harness.sh

## Overall Status

**PARTIAL PASS: 8/11 checks passing (72.7%)**

- **Passed:** 8 checks
- **Failed:** 3 checks
- **Reason for Failures:** Enforcement changes committed to git but not yet deployed via helmfile apply

## Test Case Results

### ✅ PASS: Test Case 1 - SurrealDB Pod Running Status

**Impulse:** validation-surrealdb-v3-schema-init-case-1  
**Check:** SurrealDB pod is Running  
**Expected:** `Running`  
**Actual:** `Running`  
**Status:** PASS

**Details:**
```bash
$ kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].status.phase}'
Running
```

Pod is successfully deployed and running in the cluster.

---

### ✅ PASS: Test Case 2 - SurrealDB v3.0.0 Image Version

**Impulse:** validation-surrealdb-v3-schema-init-case-2  
**Check:** SurrealDB uses v3.0.0 image  
**Expected:** `surrealdb/surrealdb:v3.0.0`  
**Actual:** `surrealdb/surrealdb:v3.0.0`  
**Status:** PASS

**Details:**
```bash
$ kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].spec.containers[0].image}'
surrealdb/surrealdb:v3.0.0
```

Correct SurrealDB v3.0.0 image is being used.

---

### ✅ PASS: Test Case 3 - SurrealDB v3.0.0 Flag Usage

**Impulse:** validation-surrealdb-v3-schema-init-case-3  
**Check:** SurrealDB uses --default-namespace and --default-database flags  
**Expected:** Args array contains both flags  
**Actual:** Args contain both `--default-namespace` and `--default-database`  
**Status:** PASS

**Details:**
```bash
$ kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].spec.containers[0].args}'
["start","--user","$(SURREAL_USER)","--pass","$(SURREAL_PASS)","--log","info","--default-namespace","metabob","--default-database","production","memory"]
```

**Analysis:**
- ✅ Uses `--default-namespace metabob` (not deprecated `--ns`)
- ✅ Uses `--default-database production` (not deprecated `--db`)
- ✅ YAML indentation is correct (separate array items, not concatenated)
- ✅ No YAML formatting errors

This is the **core specification requirement** and it **PASSES**.

---

### ❌ FAIL: Test Case 4 - Database Name Configuration

**Impulse:** validation-surrealdb-v3-schema-init-case-4  
**Check:** SurrealDB database name is 'production'  
**Expected:** `production`  
**Actual:** `` (empty string)  
**Status:** FAIL

**Details:**
```bash
$ kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].spec.containers[0].args}' | grep -oP '(?<=--default-database )\w+'
(empty output)
```

**Root Cause:**
The grep pattern fails because the args are returned as a JSON array, not space-separated text. The database name is correctly set in the args (as shown in Test Case 3), but the extraction pattern needs adjustment.

**Actual Database Name:** `production` (visible in full args output)

**Recommendation:**
This is a **false negative** caused by grep pattern mismatch. The database name is correctly configured. Fix the harness script to parse JSON array properly:

```bash
DB_NAME=$(kubectl get pods -n metabob -l app=surrealdb -o json | jq -r '.items[0].spec.containers[0].args' | jq -r '. as $arr | $arr | to_entries | map(select(.value == "--default-database")) | .[0].key as $idx | $arr[$idx + 1]')
```

---

### ✅ PASS: Test Case 5 - Init-Schema ConfigMap Existence

**Impulse:** validation-surrealdb-v3-schema-init-case-5  
**Check:** Init-schema ConfigMap exists  
**Expected:** `configmap/surrealdb-init-schema`  
**Actual:** `configmap/surrealdb-init-schema`  
**Status:** PASS

**Details:**
```bash
$ kubectl get configmap -n metabob surrealdb-init-schema -o name
configmap/surrealdb-init-schema
```

Init-schema ConfigMap is present and ready for table creation.

---

### ❌ FAIL: Test Case 6 - StatefulSet for Persistence

**Impulse:** validation-surrealdb-v3-schema-init-case-6  
**Check:** SurrealDB uses StatefulSet (not Deployment)  
**Expected:** `StatefulSet`  
**Actual:** `Deployment`  
**Status:** FAIL

**Details:**
```bash
$ kubectl get deployment,statefulset -n metabob -l app=surrealdb -o wide
NAME                        READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/surrealdb   1/1     1            1           22m
```

**Root Cause:**
The enforcement fix (flattened values structure in `default.surrealdb.values.yaml`) has been **committed to git** but **not yet deployed** via `helmfile apply`.

**Evidence:**
- Git commit `19e2eb9` flattened values to enable StatefulSet
- Pushed to branch `feat/replace-devbob-chart`
- Current deployment still uses old values (nested structure)
- Helm chart renders Deployment when `persistence.enabled` is not at root level

**Impact:**
- Data is stored in memory (ephemeral)
- Data will be lost on pod restart
- Not production-ready

**Remediation:**
```bash
cd repos/platform/metabob-apps
helmfile -e default apply
# This will recreate SurrealDB as StatefulSet with persistent storage
```

---

### ❌ FAIL: Test Case 7 - RocksDB Storage Backend

**Impulse:** validation-surrealdb-v3-schema-init-case-7  
**Check:** SurrealDB uses RocksDB storage (not memory)  
**Expected:** `rocksdb:/data/database.db`  
**Actual:** `memory`  
**Status:** FAIL

**Details:**
```bash
$ kubectl get pods -n metabob -l app=surrealdb -o jsonpath='{.items[0].spec.containers[0].args[-1]}'
memory
```

**Root Cause:**
Same as Test Case 6. The Deployment template (used when persistence is disabled) hard-codes `memory` as the storage backend. The StatefulSet template uses `rocksdb:/data/database.db`.

**Evidence:**
- Current deployment uses Deployment (not StatefulSet)
- Deployment template: `args: [..., "memory"]`
- StatefulSet template: `args: [..., "rocksdb:/data/database.db"]`

**Impact:**
- All data lost on pod restart
- No persistence across deployments
- Not suitable for production use

**Remediation:**
Same as Test Case 6 - deploy the fixed values structure.

---

### ✅ PASS: Test Case 8 - RPC API Database Name Alignment

**Impulse:** validation-surrealdb-v3-schema-init-case-8  
**Check:** RPC API SURREALDB_DATABASE env matches SurrealDB  
**Expected:** `production`  
**Actual:** `production`  
**Status:** PASS

**Details:**
```bash
$ kubectl get deployment -n metabob metabob-rpc-api -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="SURREALDB_DATABASE")].value}'
production
```

**Analysis:**
RPC API database name matches SurrealDB configuration. This is a **critical alignment requirement** and it **PASSES**.

---

### ✅ PASS: Test Case 9 - RPC API Pod Status

**Impulse:** validation-surrealdb-v3-schema-init-case-9  
**Check:** RPC API pod is Running  
**Expected:** `Running`  
**Actual:** `Running`  
**Status:** PASS

**Details:**
```bash
$ kubectl get pods -n metabob -l app=metabob-rpc-api -o jsonpath='{.items[0].status.phase}'
Running
```

RPC API is operational and ready to handle requests.

---

### ✅ PASS: Test Case 10 - Schema Tables with PERMISSIONS FULL

**Impulse:** validation-surrealdb-v3-schema-init-case-10  
**Check:** Schema tables have PERMISSIONS FULL  
**Expected:** `≥13/13 tables with PERMISSIONS FULL`  
**Actual:** `13/16 tables with PERMISSIONS FULL`  
**Status:** PASS

**Details:**
```python
# Executed in RPC API pod
Tables found: 16
Tables with PERMISSIONS FULL: 13
Result: 13/16
```

**Analysis:**
- ✅ Meets minimum requirement of 13 tables with PERMISSIONS FULL
- ℹ️ 3 extra tables exist without PERMISSIONS FULL:
  - `activity_executions`
  - `template_metrics`
  - `user_organizations`

**Note:**
The enforcement fix (adding 3 tables to init-schema) has been **committed to git** but **not yet deployed**. After deployment, this will show `16/16`.

**Current Status:** Meets specification minimum, but not optimal.

---

### ✅ PASS: Test Case 11 - GAP-9 End-to-End Test

**Impulse:** validation-surrealdb-v3-schema-init-case-11  
**Check:** GAP-9 test stores and retrieves 5 activities  
**Expected:** `Dashboard returns: 5 activities`  
**Actual:** `Dashboard returns: 5 activities`  
**Status:** PASS

**Details:**
```bash
$ bash gap9_demo_test.sh
✅ User: demo_1773464162@metabob.com
✅ Org ID: 3e641483-7b02-4dde-a062-c7779e160121
✅ API Key: mb_p_...
✅ Posted 5 activities
✅ Dashboard returns: 5 activities
```

**Analysis:**
Complete end-to-end data flow is operational:
1. User registration ✅
2. API key creation ✅
3. Activity storage via RPC API ✅
4. Activity retrieval from dashboard ✅
5. Correct counts ✅

This validates:
- SurrealDB is accessible
- Schema tables work correctly
- Database name alignment is correct
- RPC API can write and read data
- Complete integration is functional

---

## Summary by Specification Requirement

### Requirement 1: SurrealDB v3.0.0 with Correct Flags
**Status:** ✅ PASS

- Pod running with v3.0.0 image ✅
- Uses `--default-namespace metabob` ✅
- Uses `--default-database production` ✅
- YAML indentation correct ✅
- No deprecated `--ns`/`--db` flags ✅

### Requirement 2: Init-Schema Creates Tables with PERMISSIONS FULL
**Status:** ✅ PASS (meets minimum, improvement pending)

- Init-schema ConfigMap exists ✅
- 13/16 tables have PERMISSIONS FULL ✅ (meets ≥13 requirement)
- 3 tables pending PERMISSIONS FULL (fix committed, not deployed)

### Requirement 3: RPC API Database Name Matches SurrealDB
**Status:** ✅ PASS

- SurrealDB uses database 'production' ✅
- RPC API SURREALDB_DATABASE='production' ✅
- Names are aligned ✅

### Requirement 4 (Implicit): Data Persistence for Production
**Status:** ❌ FAIL (fix committed, not deployed)

- Uses Deployment (not StatefulSet) ❌
- Uses memory storage (not RocksDB) ❌
- Data lost on restart ❌

### Requirement 5 (Implicit): End-to-End Data Flow
**Status:** ✅ PASS

- GAP-9 test passes ✅
- Complete flow operational ✅

---

## Critical Findings

### ✅ Core Specification: VALIDATED

The **primary specification requirement** is **PASSING**:
- SurrealDB v3.0.0 with correct `--default-namespace` and `--default-database` flags ✅
- Database name alignment between SurrealDB and RPC API ✅
- YAML indentation fix prevents flag concatenation errors ✅

### ⚠️ Production Readiness: PENDING DEPLOYMENT

The **enforcement fixes** are ready but not deployed:
- StatefulSet with RocksDB persistence (committed, not applied)
- 16/16 tables with PERMISSIONS FULL (committed, not applied)

### 🔧 Action Required

Deploy enforcement changes:
```bash
cd repos/platform/metabob-apps
git pull origin feat/replace-devbob-chart
helmfile -e default apply
```

After deployment, expected results:
- Check 4: PASS (database name extraction fixed)
- Check 6: PASS (StatefulSet created)
- Check 7: PASS (RocksDB storage used)
- Check 10: IMPROVED (16/16 tables with PERMISSIONS FULL)
- **Overall: 11/11 checks PASSING**

---

## Diagnostic Information

### Failed Check Details

**Check 4: Database Name Extraction**
- **Issue:** Grep pattern fails on JSON array format
- **Actual Value:** `production` (confirmed in full args)
- **Fix:** Update harness to use `jq` for JSON parsing
- **Severity:** Low (false negative, value is correct)

**Check 6: StatefulSet Usage**
- **Issue:** Deployment used instead of StatefulSet
- **Root Cause:** Values structure not flattened (old deployment)
- **Fix:** Deploy commit `19e2eb9` via helmfile apply
- **Severity:** Medium (data loss risk)

**Check 7: RocksDB Storage**
- **Issue:** Memory storage instead of RocksDB
- **Root Cause:** Same as Check 6 (Deployment vs StatefulSet)
- **Fix:** Deploy commit `19e2eb9` via helmfile apply
- **Severity:** Medium (data loss risk)

### Environment Information

**Cluster:** docker-desktop  
**Namespace:** metabob  
**SurrealDB:**
- Resource: Deployment
- Image: surrealdb/surrealdb:v3.0.0
- Status: Running (1/1)
- Storage: memory (ephemeral)

**RPC API:**
- Resource: Deployment
- Status: Running (1/1)
- Database: production (aligned)

**Git Branch:** feat/replace-devbob-chart  
**Commits Pending Deployment:** 2
- `19e2eb9` - Flatten values for StatefulSet
- `cdebe34` - Add 3 tables to init-schema

---

## Recommendations

### Immediate Actions

1. **Deploy Enforcement Changes**
   ```bash
   cd repos/platform/metabob-apps
   helmfile -e default apply
   ```

2. **Verify Deployment**
   ```bash
   kubectl get statefulset -n metabob surrealdb
   kubectl get pvc -n metabob
   kubectl logs -n metabob job/surrealdb-init-schema
   ```

3. **Re-run Validation Harness**
   ```bash
   ./tests/validation-harnesses/surrealdb-v3-schema-init-harness.sh
   # Expected: 11/11 checks PASS
   ```

### Harness Improvements

1. **Fix Check 4 Database Name Extraction**
   - Replace grep with jq for JSON array parsing
   - Test with both JSON and text output formats

2. **Add Pre-flight Checks**
   - Verify kubectl connectivity before running checks
   - Confirm namespace exists
   - Check for required tools (kubectl, jq, python3)

3. **Enhanced Diagnostics**
   - Include full args output on failures
   - Show diff between expected and actual for complex checks
   - Add --verbose mode for detailed logging

### Long-term Improvements

1. **CI/CD Integration**
   - Add harness to pre-deployment validation
   - Run on every helmfile apply
   - Block deployments if critical checks fail

2. **Monitoring Integration**
   - Alert on validation failures
   - Track pass/fail trends over time
   - Detect regressions automatically

3. **Additional Test Cases**
   - Persistent volume claims creation
   - Data retention across pod restarts
   - Performance benchmarks (RocksDB vs memory)

---

**Budget:** 2000 tokens  
**Category:** validation-results  
**Tags:** surrealdb, k8s, schema, gap-9, phase-2-deployment, automated-testing, validation-run
