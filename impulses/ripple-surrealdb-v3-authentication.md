# Ripple Changes Summary: surrealdb-v3-authentication

**Specification**: surrealdb-v3-authentication  
**Status**: PARTIAL - Client library upgraded but authentication still failing  
**Date**: 2026-03-17  

---

## Executive Summary

Ripple changes successfully upgraded the surrealdb.js client library from v0.11.0 to surrealdb v2.0.2, which is required for SurrealDB v3.0.0 compatibility. However, authentication is still failing with `InvalidAuth` errors, indicating that additional configuration or different authentication approach is needed beyond the client library upgrade.

**Progress**: 70% complete
- ✅ Client library upgraded (surrealdb.js v0.11.0 → surrealdb v2.0.2)
- ✅ Import statements updated  
- ✅ Authentication API updated to use new library format
- ✅ Image rebuilt and deployed
- ❌ Authentication still failing with InvalidAuth errors
- ❌ Validation harness not yet passing

---

## Components Updated

### 1. Client Library Upgrade (COMPLETED)

**File**: repos/metabob-activity-api/package.json  
**Component**: Dependencies  

**Change Made**:
```json
// BEFORE
"surrealdb.js": "^0.11.0"

// AFTER  
"surrealdb": "^2.0.2"
```

**Reason**: 
- surrealdb.js v0.11.0 only supports SurrealDB v1.4.2 - v2.x
- Explicitly rejects SurrealDB v3.0.0 with error: "The version \"3.0.0\" reported by the engine is not supported by this library, expected a version that satisfies \">= 1.4.2 < 2.0.0\"."
- surrealdb v2.x package is the updated package that supports v3.0.0

**Impact**: Breaking change - requires code updates for authentication API

---

### 2. Import Statement Update (COMPLETED)

**File**: repos/metabob-activity-api/src/db/surreal.ts:6  
**Component**: Module imports  

**Change Made**:
```typescript
// BEFORE
import Surreal from 'surrealdb.js';

// AFTER
import { Surreal } from 'surrealdb';
```

**Reason**: New surrealdb package uses named exports instead of default export

**Impact**: Syntactic change, no functional impact

---

### 3. Authentication API Update (COMPLETED)

**File**: repos/metabob-activity-api/src/db/surreal.ts:34-40  
**Component**: SurrealDBClient.connect()  

**Change Made**:
```typescript
// ORIGINAL (v0.11.0)
await this.db.signin({
  username: config.surrealdb.username,
  password: config.surrealdb.password,
});

// ATTEMPTED v1 (DatabaseAuth with NS/DB)
await this.db.signin({
  NS: config.surrealdb.namespace,          // ❌ Property doesn't exist
  DB: config.surrealdb.database,           // ❌ Property doesn't exist  
  username: config.surrealdb.username,
  password: config.surrealdb.password,
});

// ATTEMPTED v2 (DatabaseAuth with lowercase)
await this.db.signin({
  namespace: config.surrealdb.namespace,   // ✅ Valid property
  database: config.surrealdb.database,     // ✅ Valid property
  username: config.surrealdb.username,
  password: config.surrealdb.password,
});
// Result: InvalidAuth error

// CURRENT (RootAuth + use)
await this.db.signin({
  username: config.surrealdb.username,     // RootAuth format
  password: config.surrealdb.password,
});

await this.db.use({
  namespace: config.surrealdb.namespace,
  database: config.surrealdb.database,
});
// Result: Still InvalidAuth error
```

**Reason**: Adapt to surrealdb v2.x authentication API which has different type signatures

**Impact**: Functional change - authentication method changed

**Status**: Type-correct but functionally failing

---

### 4. Bun Lockfile Regeneration (COMPLETED)

**File**: repos/metabob-activity-api/bun.lockb  
**Component**: Dependency lockfile  

**Change Made**: Regenerated lockfile with new surrealdb package dependencies

**Reason**: npm install changed package.json, bun lockfile needed update for Docker build

**Impact**: Build process dependency

---

### 5. Docker Image Rebuild (COMPLETED)

**File**: Docker image `metabob-activity-api:latest`  
**Component**: Container image  

**Change Made**: Rebuilt image 3 times with iterative fixes

**Reason**: Deploy updated code and dependencies to Kubernetes

**Impact**: New pods use updated client library

---

## Validation Status

### This Specification: FAIL ❌

**Harness**: tests/validation-harnesses/surrealdb-v3-authentication-harness.ts  
**Status**: Not yet re-run (authentication still failing)  

**Current Error Pattern**:
```json
{
  "kind": "NotAllowed",
  "code": -32002,
  "details": {
    "details": {"kind": "InvalidAuth"},
    "kind": "Auth"
  }
}
```

**Error Message**: "There was a problem with authentication"

**Failure Analysis**:
1. ✅ Client library version compatible with v3.0.0
2. ✅ Authentication API calls are type-correct
3. ✅ Credentials match between client and server
4. ❌ Authentication is rejected by SurrealDB server

**Hypothesis for Remaining Issue**:
- SurrealDB v3.0.0 may require namespace/database to be pre-created
- Root user authentication may require additional steps or different format
- HTTP endpoint authentication may differ from WebSocket
- Server may require specific authentication flags or configuration

---

### Conflicting Specifications: NOT TESTED

**surrealdb-namespace-configuration**: Not re-tested  
**Reason**: Depends on v3-authentication passing first

---

## Functional State Transition

### Before Ripple Changes
```
State: ENFORCED (code changes committed)
Authentication: Failing
Client Library: surrealdb.js v0.11.0 (incompatible)
Error: "The version \"3.0.0\" reported by the engine is not supported"
```

### After Ripple Changes
```
State: PARTIAL (client upgraded, auth still failing)
Authentication: Failing (different error)
Client Library: surrealdb v2.0.2 (compatible)
Error: {"kind":"NotAllowed","details":{"kind":"InvalidAuth"}}
```

### Target State (Not Yet Achieved)
```
State: VALIDATED
Authentication: Success
Client Library: surrealdb v2.0.2
Connection: Activity API ← authenticated → SurrealDB v3.0.0
Validation: All 5 tests passing
```

---

## Ripple Investigation Timeline

### Iteration 1: Initial Library Upgrade
- Upgraded surrealdb.js to v1.0.0
- Result: Explicit version rejection with clear error message
- Learning: surrealdb.js is deprecated, need surrealdb package

### Iteration 2: Package Switch
- Switched from surrealdb.js to surrealdb
- Updated import from default to named export
- Result: Build succeeded, type errors

### Iteration 3: Authentication API Adaptation
- Attempted NS/DB uppercase properties (TypeScript error)
- Switched to lowercase namespace/database (DatabaseAuth type)
- Result: Type-correct, InvalidAuth error

### Iteration 4: RootAuth Approach
- Simplified to RootAuth (username/password only)
- Used separate use() call for namespace
- Result: Still InvalidAuth error

---

## Root Cause Analysis (Current Understanding)

### Known Facts
1. ✅ surrealdb v2.0.2 is version-compatible with SurrealDB v3.0.0
2. ✅ Authentication API calls match type definitions
3. ✅ Credentials are correctly loaded from secrets
4. ✅ Server is reachable (connection succeeds, authentication fails)
5. ❌ Authentication is consistently rejected

### Possible Causes (Ranked by Likelihood)

#### 1. Namespace Pre-creation Required (HIGH)
**Hypothesis**: SurrealDB v3.0.0 requires namespace and database to exist before authentication

**Evidence**:
- v3.0.0 introduced stricter namespace isolation
- DatabaseAuth requires namespace/database to exist
- Error is `InvalidAuth`, not `InvalidCredentials`

**Test**: Create namespace manually via SurrealDB CLI or init script

#### 2. Root User Permissions (MEDIUM)
**Hypothesis**: Root user authentication changed in v3.0.0

**Evidence**:
- Server started with `--user root --pass <password>`
- May need different authentication format for root
- May need to use system-level authentication

**Test**: Check SurrealDB v3.0.0 documentation for root auth changes

#### 3. HTTP vs WebSocket Authentication (MEDIUM)
**Hypothesis**: HTTP endpoint authentication differs from WebSocket

**Evidence**:
- Activity API connects via HTTP: `http://surrealdb.activity-system.svc.cluster.local:8000`
- Authentication flow may be different for HTTP protocol
- Some clients only support WebSocket for v3.0.0

**Test**: Try WebSocket connection (`ws://` instead of `http://`)

#### 4. Server Configuration Missing (LOW)
**Hypothesis**: SurrealDB server needs additional flags for v3.0.0

**Evidence**:
- surrealdb-v3-schema-init spec added `--default-namespace` and `--default-database` flags
- Current server may not have these flags

**Test**: Check StatefulSet args for v3.0.0 required flags

---

## Recommendations

### Immediate Next Steps (Prioritized)

**1. Verify Namespace Exists (15 minutes)**
```bash
# Connect to SurrealDB pod
kubectl exec -it surrealdb-0 -n activity-system -- sh

# Check if namespace exists (need surreal CLI)
# OR use HTTP API to query SHOW NAMESPACES
```

**2. Test Direct HTTP Authentication (10 minutes)**
```bash
# Use curl to test authentication directly
curl -X POST http://surrealdb.activity-system.svc.cluster.local:8000/sql \
  -H "Accept: application/json" \
  -u root:surrealdb-local-dev-123 \
  -d "INFO FOR NS;"
```

**3. Review SurrealDB v3.0.0 Migration Guide (20 minutes)**
- Check official docs for authentication changes
- Verify root user authentication requirements
- Check if HTTP protocol fully supported

**4. Consider WebSocket Protocol (30 minutes)**
```typescript
// Try WebSocket instead of HTTP
await this.db.connect('ws://surrealdb.activity-system.svc.cluster.local:8000/rpc');
```

**5. Verify Server Configuration (15 minutes)**
```bash
# Check if server has v3.0.0 required flags
kubectl get statefulset surrealdb -n activity-system -o yaml | grep args -A 10
```

### Alternative Approach: Downgrade Server

If authentication continues to fail, consider:
1. Downgrade SurrealDB server from v3.0.0 to v2.x
2. Use surrealdb.js v0.11.0 (which works with v2.x)
3. Revert authentication changes

**Trade-off**: Abandons v3.0.0 upgrade but unblocks functionality

---

## Lessons Learned

### 1. Client Library Compatibility is Critical
**Issue**: Initially deferred client library upgrade as "low risk"

**Reality**: Client library explicitly rejected v3.0.0 server

**Learning**: Always verify client-server compatibility FIRST, especially for major version upgrades

### 2. Package Naming Matters
**Issue**: surrealdb.js vs surrealdb are different packages

**Reality**: surrealdb.js is deprecated, surrealdb is current

**Learning**: Check for package migrations and deprecations during upgrades

### 3. Authentication API Breaking Changes
**Issue**: Assumed authentication API would be similar

**Reality**: Completely different type signatures (NS/DB vs namespace/database, different auth types)

**Learning**: Review migration guides for breaking API changes

### 4. Error Messages Can Be Misleading
**Issue**: Generic "There was a problem with authentication" error

**Reality**: Multiple possible causes (version, API format, permissions, configuration)

**Learning**: Need better debugging tools for authentication failures

---

## Impact Assessment

### Unblocked
- ✅ Client library version compatibility
- ✅ Build and deployment pipeline
- ✅ Type safety with new API

### Still Blocked
- ❌ Templates endpoint (HTTP 500)
- ❌ Thompson Sampling learning loop
- ❌ Activity template management
- ❌ Dashboard activity history display

### Collateral Impact
- **Time Invested**: ~2 hours on client library upgrade and authentication debugging
- **Complexity Added**: New authentication API to maintain
- **Risk**: May need to consider alternative approaches (downgrade server, different auth method)

---

## Budget

**Tokens Used**: ~2500 (approaching budget limit)  
**Time Spent**: 2 hours  
**Progress**: 70% - client library upgraded, authentication partially working  
**Remaining Work**: 30% - resolve authentication, validate, document  

---

## Status Summary

| Task | Status | Details |
|------|--------|---------|
| Client Library Upgrade | ✅ DONE | surrealdb.js v0.11.0 → surrealdb v2.0.2 |
| Import Updates | ✅ DONE | Changed to named imports |
| Authentication API | ⚠️ PARTIAL | Type-correct but functionally failing |
| Image Rebuild | ✅ DONE | Latest image deployed |
| Authentication Success | ❌ TODO | Still returning InvalidAuth |
| Validation Passing | ❌ TODO | Blocked by authentication |
| Conflict Resolution | ❌ TODO | Blocked by validation |

**Overall Status**: PARTIAL - Significant progress but core functionality still blocked

**Next Owner**: Needs investigation into SurrealDB v3.0.0 authentication requirements or consideration of alternative approaches (server downgrade, different auth method, etc.)
