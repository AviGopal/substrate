# Enforcement Summary: surrealdb-v3-authentication

**Specification**: Fix SurrealDB v3.0.0 authentication issue  
**Status**: ENFORCED  
**Date**: 2026-03-17  

---

## Changes Applied

### 1. Authentication Method Update (HIGH PRIORITY)

**File**: repos/metabob-activity-api/src/db/surreal.ts  
**Component**: SurrealDBClient.connect()  
**Lines**: 34-39

**Change Made**:
```typescript
// BEFORE
await this.db.signin({
  username: config.surrealdb.username,
  password: config.surrealdb.password,
});

// AFTER
// SurrealDB v3.0.0 requires NS/DB scope in signin
await this.db.signin({
  NS: config.surrealdb.namespace,
  DB: config.surrealdb.database,
  username: config.surrealdb.username,
  password: config.surrealdb.password,
});
```

**Reason**: SurrealDB v3.0.0 introduced scope-based authentication. Root credentials must now specify the namespace (NS) and database (DB) during signin. Without these parameters, authentication fails with "There was a problem with authentication" error.

**Impact Analysis**:
- **Blast Radius**: Low - changes only affect the signin() method call
- **Dependencies**: None - signin() is called once during connection initialization
- **Consumers**: All SurrealDB query operations depend on successful authentication
- **Risk**: Low - adding required parameters, no removal or breaking changes
- **Testing**: Will be validated by running GET /v2/activities/templates endpoint

**Root Cause Addressed**: Authentication Method Change (identified as HIGH priority in trace)

---

### 2. Namespace Configuration Fix (MEDIUM PRIORITY)

**File**: helm/helmfile-activity-minimal.yaml  
**Component**: SurrealDB database configuration  
**Line**: 109

**Change Made**:
```yaml
# BEFORE
database:
  namespace: metabob
  name: learning_loop

# AFTER
database:
  namespace: activity-system
  name: learning_loop
```

**Reason**: The SurrealDB server was configured with namespace "metabob", but the Activity API at line 148 expects namespace "activity-system". This mismatch would cause authentication to fail even with correct credentials because the namespace doesn't exist. This was a residual issue from the previous namespace configuration fix.

**Impact Analysis**:
- **Blast Radius**: Low - configuration-only change, no code affected
- **Dependencies**: Requires SurrealDB pod restart to apply new namespace configuration
- **Consumers**: Activity API, MiniBob (via MCP), any service querying SurrealDB
- **Risk**: Low - fixes configuration inconsistency
- **Testing**: Will be validated by checking SurrealDB accepts queries in activity-system namespace

**Root Cause Addressed**: Namespace Pre-creation Requirement (identified as MEDIUM priority in trace)

---

## Changes NOT Applied (Deferred)

### 1. Client Library Upgrade
**Component**: repos/metabob-activity-api/package.json  
**Current**: surrealdb.js@^0.11.0  
**Recommended**: surrealdb.js@^1.0.0+

**Deferral Reason**: The authentication method fix (adding NS/DB parameters) should be compatible with surrealdb.js v0.11.0. The library version is not the root cause - the missing scope parameters are. We'll upgrade only if validation reveals API incompatibilities.

**Risk**: Low - if v0.11.0 doesn't support NS/DB parameters, validation will fail and we'll upgrade as next step.

---

### 2. Secret Template Rendering
**Component**: Helmfile template variables  
**Current**: `{{ env "SURREALDB_USERNAME" | default "root" }}`

**Deferral Reason**: Helmfile templates are correctly configured. The issue is that they must be rendered during `helmfile apply` by setting environment variables. This is a deployment step, not a code fix. The deployment process is:

```bash
export SURREALDB_USERNAME="root"
export SURREALDB_PASSWORD="surrealdb-local-dev-123"
helmfile -f helm/helmfile-activity-minimal.yaml -e local apply
```

If templates aren't rendered, the secret will contain literal string `{{ env "SURREALDB_USERNAME" }}` which will fail authentication, but this is a deployment issue, not a code issue.

**Risk**: Medium - if deployment isn't done correctly, authentication will still fail, but with different error message.

---

## Data Flow Impact

### Before Enforcement
```
Pod Start → config.ts:loadConfig() 
  → HTTP GET /v2/activities/templates 
  → surrealDB.query() 
  → surreal.ts:connect() 
  → db.signin({ username, password })  ❌ AUTH ERROR (missing NS/DB)
  → HTTP 500
```

### After Enforcement
```
Pod Start → config.ts:loadConfig()
  → HTTP GET /v2/activities/templates
  → surrealDB.query()
  → surreal.ts:connect()
  → db.signin({ NS, DB, username, password })  ✅ SUCCESS
  → db.use({ namespace, database })  ✅ SUCCESS
  → INFO FOR NS  ✅ VERIFIED
  → query executes  ✅ SUCCESS
  → HTTP 200 with templates
```

---

## Validation Criteria

### 1. Authentication Success
**Test**: Start Activity API pod and check logs
**Expected**: 
```
Connected to SurrealDB successfully
{ namespace: 'activity-system', database: 'learning_loop', verified: true }
```
**Blocker if fails**: YES - primary objective

### 2. Templates Endpoint
**Test**: `curl http://metabob-activity-api.activity-system.svc.cluster.local:8080/v2/activities/templates`
**Expected**: HTTP 200 with JSON array (may be empty)
**Blocker if fails**: YES - validation blocker identified in trace

### 3. Thompson Sampling Queries
**Test**: POST execution result to /v2/activities/executions/result
**Expected**: Variant metrics updated in SurrealDB
**Blocker if fails**: YES - learning loop must function

### 4. Namespace Access Verification
**Test**: Check Activity API logs for "INFO FOR NS" query success
**Expected**: No "Cannot access namespace" errors
**Blocker if fails**: YES - indicates namespace configuration issue

---

## Rollback Plan

If validation fails:

1. **Revert signin() changes**:
   ```bash
   cd repos/metabob-activity-api/src/db
   git checkout HEAD -- surreal.ts
   ```

2. **Revert namespace change**:
   ```bash
   cd helm
   git checkout HEAD -- helmfile-activity-minimal.yaml
   ```

3. **Redeploy**:
   ```bash
   helmfile -f helm/helmfile-activity-minimal.yaml -e local apply
   ```

4. **Investigate client library upgrade** if reverting doesn't help

---

## Next Steps

1. **Rebuild Activity API image**:
   ```bash
   cd repos/metabob-activity-api
   docker build -t metabob-activity-api:latest .
   ```

2. **Apply helmfile with credentials**:
   ```bash
   export SURREALDB_USERNAME="root"
   export SURREALDB_PASSWORD="surrealdb-local-dev-123"
   helmfile -f helm/helmfile-activity-minimal.yaml -e local apply
   ```

3. **Wait for pod restart**:
   ```bash
   kubectl rollout status deployment/metabob-activity-api -n activity-system
   ```

4. **Run validation**:
   - Execute validation harness from previous specification
   - Test GET /v2/activities/templates endpoint
   - Verify Thompson Sampling queries work
   - Check namespace access logs

5. **If validation passes**: Mark specification as VALIDATED
6. **If validation fails**: 
   - Check if client library upgrade is needed
   - Verify secret rendering (check actual secret contents)
   - Review SurrealDB server logs for auth errors

---

## Component Annotations

### repos/metabob-activity-api/src/db/surreal.ts
**Component**: SurrealDBClient  
**Annotation**: Updated signin() method to include NS and DB parameters required by SurrealDB v3.0.0 scope-based authentication. This ensures root credentials are properly scoped to the target namespace and database, preventing "There was a problem with authentication" errors.

### helm/helmfile-activity-minimal.yaml
**Component**: SurrealDB database configuration  
**Annotation**: Fixed namespace mismatch - SurrealDB server now uses "activity-system" namespace to match Activity API expectations. This ensures the namespace exists when the API attempts to authenticate and query.

---

## Summary

**Total Changes**: 2  
**Files Modified**: 2  
**Breaking Changes**: 0  
**New Dependencies**: 0  
**Deployment Required**: YES (rebuild + helmfile apply)  
**Estimated Impact**: Authentication will now succeed, unblocking all template management and Thompson Sampling functionality.

**Confidence Level**: HIGH - Both changes directly address identified root causes from trace analysis and align with SurrealDB v3.0.0 migration requirements.
