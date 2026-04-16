# Signup Debugging - Next Steps

**Date**: 2026-04-09
**Status**: Migration crash FIXED ✅ | Transaction parsing NEEDS DEBUGGING ⚠️
**Deployment**: user-vessel:0.1.0-609d154 (deploying)

---

## What We Just Fixed ✅

### Migration Crash (CRITICAL)

**Problem:**
```
Fatal error in 001-user-vessel-extensions.surql:
undefined is not an object (evaluating 'result.status')
```

**Root Cause:**
SurrealDB 3.0 returns `null` or `undefined` for statements with `IF NOT EXISTS` when the object already exists. The migration parser looped over results without checking if each result was null.

**Fix Applied:**
```typescript
// repos/deployment/vessels/user-vessel/index.ts:252-260
for (const result of results) {
  statements++

  // ADDED THIS CHECK:
  if (!result) {
    skipped++
    continue
  }

  // Now safe to access result.status
  if (result.status === "ERR" || result.error) {
    // ... handle errors
  }
}
```

**Commit:** `609d154` - fix(user-vessel): handle null results in migration parser

**Status:** Deployed to canary (deploying now)

**Impact:** Server will no longer crash during startup, unblocking signup attempts

---

## What Still Needs Debugging ⚠️

### Transaction Result Parsing

**Error:**
```json
{"error":"Signup failed - transaction did not complete"}
```

**Location:** `src/routes/auth.ts:119-125`

**Code:**
```typescript
const result = getLastRecord<{ org: Organization[], user: User[] }>(transactionResult)
if (!result || !result.org || !result.user) {
  return c.json({
    error: "Signup failed - transaction did not complete"
  }, 500)
}
```

**Issue:**
`getLastRecord()` is returning `null` or an object that doesn't have `org` and `user` properties.

**Hypothesis:**
The transaction RETURN statement might be returning data in a format that `getLastRecord()` doesn't handle correctly. SurrealDB 3.0 transaction results can vary:

```json
// Format 1: Array wrapping
[
  { "status": "OK", "result": null },  // BEGIN
  { "status": "OK", "result": null },  // LET $org
  { "status": "OK", "result": null },  // IF check
  { "status": "OK", "result": null },  // LET $user
  { "status": "OK", "result": null },  // IF check
  { "status": "OK", "result": null },  // COMMIT
  { "status": "OK", "result": { "org": [...], "user": [...] } }  // RETURN
]

// Format 2: Direct object
[
  { "status": "OK", "result": null },
  { "status": "OK", "result": null },
  { "status": "OK", "result": null },
  { "status": "OK", "result": null },
  { "status": "OK", "result": null },
  { "status": "OK", "result": null },
  { "status": "OK", "result": [{ "org": [...], "user": [...] }] }  // Array wrapper
]

// Format 3: Nested structure
[
  // ... null results ...
  { "status": "OK", "result": [[{ "org": [...], "user": [...] }]] }  // Double-wrapped
]
```

---

## Debugging Strategy

### Step 1: Add Comprehensive Logging

**Modify:** `src/routes/auth.ts` lines 115-135

```typescript
// After the transaction
const transactionResult = await db.query(/* ... */)

// ADD DETAILED LOGGING:
console.log("=== SIGNUP TRANSACTION DEBUG ===")
console.log("Transaction result length:", transactionResult?.length || 0)
console.log("Transaction result type:", typeof transactionResult)
console.log("Transaction result:", JSON.stringify(transactionResult, null, 2))

// Log each result
if (Array.isArray(transactionResult)) {
  transactionResult.forEach((item, index) => {
    console.log(`Result[${index}]:`, {
      type: typeof item,
      isArray: Array.isArray(item),
      status: item?.status,
      hasResult: 'result' in (item || {}),
      resultType: typeof item?.result,
      resultIsArray: Array.isArray(item?.result),
      keys: Object.keys(item || {})
    })
  })
}

// Now try getLastRecord
const result = getLastRecord<{ org: Organization[], user: User[] }>(transactionResult)

// Log what we got
console.log("After getLastRecord:")
console.log("  result:", result)
console.log("  result type:", typeof result)
console.log("  has org:", result && 'org' in result)
console.log("  has user:", result && 'user' in result)
console.log("  org value:", result?.org)
console.log("  user value:", result?.user)
console.log("=== END DEBUG ===")

// Continue with existing logic
if (!result || !result.org || !result.user) {
  // ... error handling
}
```

**Deploy and Test:**
```bash
# After adding logging, deploy
cd repos/deployment
rsync -av ../user-vessel/src/routes/auth.ts vessels/user-vessel/src/routes/
git add vessels/user-vessel/src/routes/auth.ts
git commit -m "debug(user-vessel): add comprehensive signup transaction logging"
git push origin dev

# Wait for deployment
gh run watch

# Test signup
curl -X POST https://app.metabob.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "debug-test@metabob.com",
    "password": "TestPassword123!",
    "org_name": "Debug Test Org",
    "name": "Debug Test User"
  }'

# Check logs immediately
kubectl logs -n activity-system -l app.kubernetes.io/name=user-vessel --tail=100 | grep -A 50 "SIGNUP TRANSACTION DEBUG"
```

### Step 2: Test Transaction Format Directly

**Execute the exact transaction in SurrealDB:**

```bash
# Port-forward to SurrealDB
kubectl port-forward -n activity-system svc/surrealdb 8000:8000

# Get password
SURREALDB_PASSWORD=$(kubectl get secret -n activity-system surrealdb-auth -o jsonpath='{.data.password}' | base64 -d)

# Execute transaction
curl -X POST http://localhost:8000/sql \
  -u "root:$SURREALDB_PASSWORD" \
  -H "surreal-ns: activity-system" \
  -H "surreal-db: learning_loop" \
  -H "Content-Type: application/json" \
  -d "BEGIN TRANSACTION;

LET \$org = CREATE organizations SET
  org_id = 'manual_test',
  name = 'Manual Test',
  subscription_tier = 'free',
  seat_usage = 1,
  created_at = time::now();

IF !\$org THEN
  THROW \"Failed to create organization\";
END;

LET \$user = CREATE users SET
  org_id = 'manual_test',
  email = 'manual@test.com',
  name = 'Manual Test',
  password_hash = crypto::argon2::generate('TestPassword123!'),
  role = 'admin',
  created_at = time::now(),
  last_login = time::now();

IF !\$user THEN
  THROW \"Failed to create user\";
END;

COMMIT TRANSACTION;

RETURN {
  org: \$org,
  user: \$user
};" | jq .
```

**Analyze the result structure** and compare with what `getLastRecord()` expects.

### Step 3: Fix getLastRecord() Based on Findings

**Current implementation** (`src/db/surreal.ts:185-210`):

```typescript
export function getLastRecord<T>(result: any[]): T | null {
  if (!result || result.length === 0) return null

  for (let i = result.length - 1; i >= 0; i--) {
    const item = result[i]
    if (!item) continue

    // New format: [{record}]
    if (Array.isArray(item) && item.length > 0) {
      return item[0] as T
    }

    // Old format: {result: ...}
    if (item.result !== undefined && item.result !== null) {
      if (Array.isArray(item.result)) {
        return item.result.length > 0 ? (item.result[0] as T) : null
      }
      // Handle single object result
      return item.result as T
    }
  }

  return null
}
```

**Potential fixes based on findings:**

```typescript
export function getLastRecord<T>(result: any[]): T | null {
  if (!result || result.length === 0) return null

  // Find the last non-null result
  for (let i = result.length - 1; i >= 0; i--) {
    const item = result[i]
    if (!item) continue

    // Format 1: Direct array
    if (Array.isArray(item) && item.length > 0) {
      return item[0] as T
    }

    // Format 2: Object with result property
    if (item.result !== undefined && item.result !== null) {
      // Double-wrapped array: {result: [[{...}]]}
      if (Array.isArray(item.result)) {
        // Check if first element is also an array (double-wrap)
        if (item.result.length > 0 && Array.isArray(item.result[0])) {
          const innerArray = item.result[0]
          return innerArray.length > 0 ? (innerArray[0] as T) : null
        }
        // Single-wrapped array: {result: [{...}]}
        return item.result.length > 0 ? (item.result[0] as T) : null
      }
      // Direct object: {result: {...}}
      return item.result as T
    }

    // Format 3: Direct object (no wrapping)
    if (typeof item === 'object' && !('status' in item)) {
      return item as T
    }
  }

  return null
}
```

### Step 4: Simplify for Debugging

**Alternative approach** - Bypass getLastRecord temporarily:

```typescript
// In src/routes/auth.ts after transaction
const transactionResult = await db.query(/* ... */)

// TEMPORARY DEBUG CODE:
let result: any = null

// Try to extract the RETURN result directly
if (Array.isArray(transactionResult)) {
  // Look for the last result with actual data
  for (let i = transactionResult.length - 1; i >= 0; i--) {
    const item = transactionResult[i]

    // Check all possible formats
    if (item?.result && typeof item.result === 'object') {
      if ('org' in item.result && 'user' in item.result) {
        result = item.result
        console.log("Found result in item.result:", result)
        break
      }

      // Check if nested in array
      if (Array.isArray(item.result) && item.result[0]) {
        if ('org' in item.result[0] && 'user' in item.result[0]) {
          result = item.result[0]
          console.log("Found result in item.result[0]:", result)
          break
        }
      }
    }

    // Check direct object
    if (item && 'org' in item && 'user' in item) {
      result = item
      console.log("Found result in item:", result)
      break
    }
  }
}

if (!result) {
  console.error("Could not find org/user in transaction result")
  console.error("Full result:", JSON.stringify(transactionResult, null, 2))
  return c.json({
    error: "Signup failed - transaction did not complete"
  }, 500)
}

// Extract org and user
const org = Array.isArray(result.org) ? result.org[0] : result.org
const user = Array.isArray(result.user) ? result.user[0] : result.user

// Continue with token generation...
```

---

## Testing Checklist

After deploying the logging:

- [ ] Deploy logging changes
- [ ] Test signup via API
- [ ] Capture full log output
- [ ] Analyze result structure
- [ ] Update getLastRecord() or signup route based on findings
- [ ] Test again with updated code
- [ ] Remove debug logging once working
- [ ] Document correct SurrealDB 3.0 transaction format

---

## Alternative: Manual User Creation (Workaround)

If signup continues to fail, create a test user manually to unblock dashboard testing:

```bash
# Port-forward SurrealDB
kubectl port-forward -n activity-system svc/surrealdb 8000:8000

# Get password
SURREALDB_PASSWORD=$(kubectl get secret -n activity-system surrealdb-auth -o jsonpath='{.data.password}' | base64 -d)

# Create organization
curl -X POST http://localhost:8000/sql \
  -u "root:$SURREALDB_PASSWORD" \
  -H "surreal-ns: activity-system" \
  -H "surreal-db: learning_loop" \
  -d "CREATE organizations SET
    org_id = 'test_org',
    name = 'Test Organization',
    subscription_tier = 'free',
    seat_usage = 1,
    created_at = time::now();"

# Create user
curl -X POST http://localhost:8000/sql \
  -u "root:$SURREALDB_PASSWORD" \
  -H "surreal-ns: activity-system" \
  -H "surreal-db: learning_loop" \
  -d "CREATE users SET
    org_id = 'test_org',
    email = 'test@metabob.com',
    name = 'Test User',
    password_hash = crypto::argon2::generate('TestPassword123!'),
    role = 'admin',
    created_at = time::now(),
    last_login = time::now();"

# Test login
curl -X POST https://app.metabob.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@metabob.com",
    "password": "TestPassword123!"
  }'
```

This gives you a working user to test the authenticated dashboard features while we debug signup.

---

## Timeline

1. **Now**: Migration fix deploying (resolves server crash)
2. **Next 5 min**: Add detailed logging to signup route
3. **Next 10 min**: Deploy and test signup with logging
4. **Next 15 min**: Analyze logs and update getLastRecord() or transaction parsing
5. **Next 20 min**: Deploy fix and verify signup works
6. **Next 30 min**: Complete authenticated dashboard testing with Playwright

---

## Success Criteria

- [ ] Server starts without migration crash ✅ (DONE)
- [ ] Signup request reaches transaction code ⚠️ (NEEDS VERIFICATION)
- [ ] Transaction executes successfully
- [ ] getLastRecord() extracts org and user correctly
- [ ] JWT token generated and returned
- [ ] User can login immediately after signup
- [ ] Dashboard shows authenticated pages

---

## Related Documents

- [CLOUD_DASHBOARD_COMPREHENSIVE_TEST_REPORT.md](./CLOUD_DASHBOARD_COMPREHENSIVE_TEST_REPORT.md) - Full dashboard analysis
- [SIGNUP_DEBUGGING_STATUS.md](./SIGNUP_DEBUGGING_STATUS.md) - Previous debugging history
- [repos/deployment/vessels/user-vessel/src/routes/auth.ts](./repos/deployment/vessels/user-vessel/src/routes/auth.ts:119) - Signup route
- [repos/deployment/vessels/user-vessel/src/db/surreal.ts](./repos/deployment/vessels/user-vessel/src/db/surreal.ts:185) - getLastRecord() function
