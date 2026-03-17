# Validation Results: SurrealDB Namespace Configuration

**Validation Date:** 2026-03-17  
**Overall Status:** ❌ **FAIL**  
**Reason:** Code changes committed but Helm deployment not yet applied

---

## Executive Summary

The validation harness confirmed that the SurrealDB namespace misconfiguration issue **still exists in the deployed system**. This is expected because:

1. ✅ Code changes have been committed to repository
2. ✅ Helm chart values updated to use "activity-system"
3. ❌ Helm deployment has NOT been applied with `helmfile sync`
4. ❌ Running pods still use old configuration with "metabob" namespace

**Next Required Action:** Deploy updated Helm configuration to apply the fix.

---

## Test Results

### Test Case 1: ConfigMap Namespace Configuration
**Impulse:** `validation-surrealdb-namespace-configuration-case-1`

**Status:** ❌ **FAIL**

**Expected Output:**
```yaml
namespace: "activity-system"
```

**Actual Output:**
```
SURREALDB_NAMESPACE=metabob
```

**Difference:**
- Deployed configuration still uses legacy "metabob" namespace
- Helm chart source code updated but not deployed

**Diagnostic Information:**
```bash
$ kubectl get deployment -n activity-system metabob-activity-api -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="SURREALDB_NAMESPACE")].value}'
metabob
```

**Root Cause:** Helm chart not redeployed. The fix exists in:
- `helm/charts/metabob-activity-api/values.yaml:28` ✅ (committed)
- `helm/helmfile-activity-minimal.yaml:148` ✅ (committed)

But running deployment still references old values.

---

### Test Case 2: Pod Environment Variable
**Impulse:** `validation-surrealdb-namespace-configuration-case-2`

**Status:** ❌ **FAIL**

**Expected Output:**
```
SURREALDB_NAMESPACE=activity-system
```

**Actual Output:**
```
SURREALDB_NAMESPACE=metabob
```

**Difference:**
- Pod environment variable shows "metabob" instead of "activity-system"
- Confirms the Helm ConfigMap → Pod env var flow is working
- But ConfigMap itself needs to be updated via Helm deployment

**Diagnostic Information:**
```bash
$ kubectl exec -n activity-system deployment/metabob-activity-api -- env | grep SURREALDB_NAMESPACE
SURREALDB_NAMESPACE=metabob
```

**Data Flow Verification:**
- Helm values.yaml → helmfile → ConfigMap → Pod env var ✅ (flow working)
- But Helm values not yet deployed with fix ❌

---

### Test Case 3: Connection Success in Logs
**Impulse:** `validation-surrealdb-namespace-configuration-case-3`

**Status:** ⚠️ **INCONCLUSIVE**

**Expected Output:**
```
Connected to SurrealDB successfully
```

**Actual Output:**
No explicit connection success/failure messages in recent logs (only health checks)

**Observation:**
The application is running and responding to health checks, but we cannot confirm connection status from logs alone. The structured logging we added in surreal.ts hasn't been deployed yet.

**Diagnostic Information:**
Recent logs show only health check responses:
```
<-- GET /health
--> GET /health 200 0ms
```

No connection-related log lines visible, which suggests the enhanced logging from our fix (surreal.ts:44-48) is not yet deployed.

---

### Test Case 4: Templates Endpoint HTTP 200
**Impulse:** `validation-surrealdb-namespace-configuration-case-4`

**Status:** ❌ **FAIL** (PRIMARY SYMPTOM CONFIRMED)

**Expected Output:**
```
HTTP/1.1 200 OK
Content-Type: application/json
{
  "templates": [...],
  "total": <number>
}
```

**Actual Output:**
```
HTTP/1.1 500 Internal Server Error
{
  "error": "Failed to fetch templates",
  "message": "There was a problem with authentication"
}
```

**Difference:**
- HTTP 500 instead of 200 ✗
- Authentication error instead of successful template list ✗
- This is the EXACT symptom we're fixing

**Diagnostic Information:**
```bash
$ curl http://localhost:18080/v2/activities/templates
{"error":"Failed to fetch templates","message":"There was a problem with authentication"}
```

**Root Cause Analysis:**
The "authentication problem" message occurs because:
1. Activity API connects to SurrealDB in "metabob" namespace
2. Queries SELECT from `activity_template` table
3. But table doesn't exist in metabob namespace (it's in activity-system namespace)
4. SurrealDB returns table-not-found error
5. Activity API interprets this as authentication issue

This confirms the namespace mismatch is causing the HTTP 500 errors.

---

### Test Case 5: Namespace Verification in Logs
**Impulse:** `validation-surrealdb-namespace-configuration-case-5`

**Status:** ❌ **FAIL**

**Expected Output:**
```json
{
  "namespace": "activity-system",
  "database": "learning_loop",
  "verified": true
}
```

**Actual Output:**
```json
{
  "namespace": "metabob",
  "database": "learning_loop"
}
```

**Difference:**
- Logs show `namespace: "metabob"` ✗ (wrong)
- No `verified: true` field ✗ (namespace verification not deployed)
- URL correctly points to `surrealdb.activity-system.svc.cluster.local` ✓

**Diagnostic Information:**
```
{"timestamp":"2026-03-17T17:08:17.810Z","level":"INFO","message":"Connecting to SurrealDB","url":"http://surrealdb.activity-system.svc.cluster.local:8000","namespace":"metabob","database":"learning_loop"}
```

**Analysis:**
This log line perfectly illustrates the inconsistency:
- URL: `surrealdb.activity-system.svc.cluster.local` ✓ (correct service)
- Namespace: `metabob` ✗ (wrong namespace within that service)

The service endpoint is correct, but the namespace selection inside SurrealDB is wrong. This is why queries fail - they execute in metabob.learning_loop instead of activity-system.learning_loop.

---

## Summary

| Test Case | Status | Impact |
|-----------|--------|--------|
| Case 1: ConfigMap Namespace | ❌ FAIL | ConfigMap still has "metabob" |
| Case 2: Pod Environment | ❌ FAIL | Pod env var still "metabob" |
| Case 3: Connection Logs | ⚠️ INCONCLUSIVE | No connection logs visible |
| Case 4: Templates Endpoint | ❌ FAIL | HTTP 500 with auth error |
| Case 5: Namespace in Logs | ❌ FAIL | Logs show "metabob" namespace |

**Overall Result:** 0/5 tests passed, 4/5 failed, 1/5 inconclusive

---

## Root Cause Confirmed

The validation confirms our diagnosis:

**Problem:**
- Activity API connects to SurrealDB service in activity-system namespace (URL correct)
- But selects "metabob" namespace via `db.use({ namespace: "metabob" })`
- Queries execute in metabob.learning_loop tables
- Tables don't exist there → "authentication problem" errors → HTTP 500

**Solution Status:**
- ✅ Code changes committed to fix configuration
- ✅ Helm values updated in repository
- ❌ Helm deployment NOT applied to K8s cluster
- ❌ Running pods still use old configuration

---

## Required Actions to Pass Validation

### Step 1: Rebuild Activity API Image
```bash
cd repos/metabob-activity-api
docker build -t metabob-activity-api:latest .
```

**Why:** New code includes:
- Namespace validation in config.ts
- Namespace verification in surreal.ts
- Enhanced error logging

### Step 2: Deploy Updated Helm Configuration
```bash
helmfile -f helm/helmfile-activity-minimal.yaml sync
```

**Why:** This will:
- Apply updated namespace value to ConfigMap
- Trigger pod restart with new configuration
- Inject SURREALDB_NAMESPACE=activity-system

### Step 3: Wait for Rollout
```bash
kubectl rollout status -n activity-system deployment/metabob-activity-api
```

**Why:** Ensures new pods are running before validation

### Step 4: Re-run Validation Harness
```bash
ts-node tests/validation-harnesses/surrealdb-namespace-configuration-harness.ts
```

**Expected Result:** All 5 tests should pass

---

## Expected Post-Deployment Results

After deployment, validation should show:

**Test Case 1:** ✅ PASS
```
SURREALDB_NAMESPACE=activity-system
```

**Test Case 2:** ✅ PASS
```
SURREALDB_NAMESPACE=activity-system
```

**Test Case 3:** ✅ PASS
```
Connected to SurrealDB successfully
```

**Test Case 4:** ✅ PASS
```
HTTP/1.1 200 OK
{"templates":[...],"total":N}
```

**Test Case 5:** ✅ PASS
```json
{
  "namespace": "activity-system",
  "verified": true
}
```

---

## Lessons Learned

1. **Code Changes ≠ Deployed Changes**
   - Committing fixes doesn't automatically deploy them
   - K8s clusters need explicit helm/kubectl apply

2. **Validation Harnesses Catch This**
   - Running validation before deployment shows current state
   - Helps verify assumptions about deployed system
   - Documents expected vs actual behavior

3. **Namespace Verification is Critical**
   - URL can be correct but namespace can be wrong
   - Both must be validated for successful connection
   - Enhanced logging helps debug these issues

4. **Error Messages Can Be Misleading**
   - "Authentication problem" was actually "table not found"
   - Root cause was namespace mismatch, not auth failure
   - Context-rich errors would have made this obvious

---

## Related Documentation

- **Trace:** `impulses/trace-surrealdb-namespace-configuration.md`
- **Enforcement:** `impulses/enforcement-surrealdb-namespace-configuration.md`
- **Harness:** `impulses/harness-surrealdb-namespace-configuration.md`
- **Test Cases:** `impulses/validation-surrealdb-namespace-configuration-case-*.md`
