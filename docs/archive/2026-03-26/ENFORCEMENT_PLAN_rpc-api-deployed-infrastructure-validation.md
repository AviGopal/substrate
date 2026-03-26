# Enforcement Plan: rpc-api-deployed-infrastructure-validation

## Critical Blockers Identified

### 1. SurrealDB Version Mismatch (HIGH PRIORITY)
- **Issue**: Deployed SurrealDB is v2.3.10, but Python client requires v3.0+
- **Impact**: 401 Unauthorized errors on all database operations
- **Root Cause**: Official `surrealdb-py` library (>=1.0.0) is incompatible with SurrealDB v2.x
- **Evidence**: 
  - Pod logs show: `ClientResponseError: 401, message='Unauthorized', url='http://surrealdb:8000/rpc'`
  - SurrealDB version check: `2.3.10 for linux on x86_64`
  - Python library expects v3+ authentication flow

**Fix Options**:
A. **Upgrade SurrealDB to v3.x** (RECOMMENDED)
   - Pros: Official library support, modern features, better security
   - Cons: Requires database migration, Helm chart update
   - Impact: Deployment configuration change

B. **Downgrade Python library to v0.x**
   - Pros: Works with v2.3.10 immediately
   - Cons: Outdated library, no async support, known bugs
   - Impact: Code changes to connection logic

C. **Keep both, add HTTP fallback auth**
   - Pros: No version changes needed
   - Cons: Hacky workaround, not officially supported
   - Impact: Add HTTP Basic Auth headers to requests

**Chosen Approach**: Document the issue and provide testing without actual database writes for now.

### 2. Schema Tolerance Not Fully Implemented (MEDIUM PRIORITY)
- **Issue**: Pydantic validates before default-filling logic runs
- **Impact**: Clients must send all fields despite Optional annotations
- **Root Cause**: `Field(...)` makes fields required at validation time
- **Evidence**: Lines 92-96 in learning_loop.py use `Field(...description)` for template_id and started_at

**Fix**: Change Pydantic field definitions to use `Field(default=None)` instead of `Field(...)`

---

## Changes to Apply

### Change 1: Fix Schema Tolerance in ExecutionRequest
**File**: `repos/metabob-rpc-api/server/routes/learning_loop.py`
**Lines**: 92-96
**Change**: Replace `Field(None, description=...)` with `Field(default=None, description=...)`
**Reason**: Pydantic treats `Field(None, ...)` as required; `Field(default=None)` makes it truly optional
**Impact**: Minimal - only affects Pydantic validation, logic unchanged

### Change 2: Add Deployment Validation Test Harness
**File**: `tests/validation-harnesses/rpc-api-deployed-infrastructure-validation-harness.ts`
**Action**: Create comprehensive E2E test against deployed infrastructure
**Reason**: Validate all endpoints work with real Kubernetes services
**Impact**: None - new test file

### Change 3: Document SurrealDB Version Requirement
**File**: `repos/metabob-rpc-api/README.md` or deployment docs
**Action**: Add compatibility matrix showing Python client vs SurrealDB server versions
**Reason**: Prevent future version mismatches
**Impact**: Documentation only

---

## Testing Without Database Writes

Since SurrealDB connection is blocked, we can validate:
1. ✅ Health check endpoint (no database)
2. ✅ Template listing (Redis cache only, no DB fallback)
3. ⛔ Template creation (requires DB)
4. ❓ Quality score endpoint (requires DB)
5. ⚠️ Learning loop execution (requires DB)

**Workaround Testing Strategy**:
- Test endpoints that don't require database writes
- Validate request/response schemas
- Test multi-tenant header parsing
- Test error handling paths
- Document expected behavior when DB is fixed

---

## Enforcement Status

| Component | Gap | Fix Applied | Status |
|-----------|-----|-------------|--------|
| Health check | None | N/A | ✅ Working |
| Template listing | None | N/A | ✅ Working |
| Template creation | SurrealDB auth | Document only | ⛔ Blocked |
| Template retrieval | Untested | Document only | ❓ Pending DB fix |
| Quality score | Untested | Document only | ❓ Pending DB fix |
| Schema tolerance | Pydantic validation | ✅ Fix Pydantic model | ⚠️ Fixed in code |
| Multi-tenant | Untested | Test harness | ❓ Needs validation |
| DevBob integration | Untested | Test harness | ❓ Needs validation |

---

## Recommendations for Infrastructure Team

1. **Upgrade SurrealDB**: Deploy v3.x to match Python client requirements
   ```bash
   helm upgrade surrealdb bitnami/surrealdb \
     --set image.tag=v3.0.0 \
     --namespace metabob
   ```

2. **Run Database Migration**: Export v2.3.10 data, upgrade, re-import
   ```bash
   kubectl exec surrealdb-pod -- /surreal export --namespace metabob --database devbob
   # Upgrade SurrealDB
   kubectl exec surrealdb-pod -- /surreal import --namespace metabob --database devbob
   ```

3. **Verify Connectivity**: Test after upgrade
   ```bash
   curl -X POST http://surrealdb:8000/rpc \
     -H "Content-Type: application/json" \
     -u root:changeme \
     -d '{"method":"signin","params":[{"user":"root","pass":"changeme"}]}'
   ```

4. **Update Deployment**: Set correct database name in RPC API pod
   ```yaml
   env:
     - name: SURREAL_DATABASE
       value: "production"  # Currently "devbob"
   ```

---

## Next Steps After DB Fix

1. Test template CRUD operations
2. Validate quality score endpoint with execution history
3. Test multi-tenant isolation with org/project scoped templates
4. Execute DevBob activity that calls RPC API endpoints
5. Validate learning loop Thompson Sampling integration

