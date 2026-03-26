# Trace Analysis: surrealdb-user-persistence-and-query-flow

## Specification Overview

**Name**: surrealdb-user-persistence-and-query-flow

**Description**: Complete data persistence specification for user authentication and data hierarchy in SurrealDB. Users registered via metabob-cli or dashboard must be created with proper schema (user_id, email, password_hash, org_id, role, is_active, created_at, metadata) and must be queryable by email for login. Data organized hierarchically: user → org → projects → components.

**Current Blocker**: Registration succeeds (HTTP 200 OK) but login query `SELECT * FROM users WHERE email = $email` returns empty list, suggesting schema/index issue with SurrealDB v3.

## Data Flow

```
POST /auth/register or /auth/login
    ↓
FastAPI Router (cloud_auth.py)
    ↓
Auth Handler (register() or login())
    ↓
AsyncSurrealDBClient (surrealdb_client.py)
    ↓
SurrealDB (HTTP protocol: http://surrealdb:8000)
    ↓
Query Response
    ↓
HTTP Response (JWT token or 401 error)
```

## Component Analysis

### 1. Registration Endpoint ✅ WORKING
**File**: `repos/metabob-rpc-api/server/routes/cloud_auth.py:434-557`

**Current Behavior**:
- Creates user records using `db.insert()` or `db.create()`
- Uses datetime objects (not isoformat strings)
- Returns 200 OK with JWT token
- No errors reported in logs

**Gap**: None - registration is functioning correctly

### 2. Login Endpoint ❌ BROKEN
**File**: `repos/metabob-rpc-api/server/routes/cloud_auth.py:48-431`

**Current Behavior**:
- Queries: `SELECT * FROM users WHERE email = $email AND is_active = true`
- Query returns empty result (length 0) immediately after registration
- Structured logging shows: `result_count=0, result_structure='[]'`
- Returns 401 Unauthorized: "Invalid email or password"

**Expected Behavior**:
- Query should return the user record created during registration
- Should find user by email index and proceed to password verification
- Should return 200 OK with JWT token

**Gap**: CRITICAL - Query returns empty despite record creation

### 3. SurrealDB Client ⚠️ SUSPICIOUS
**File**: `repos/metabob-rpc-api/server/db/surrealdb_client.py`

**Current Behavior**:
- Uses official surrealdb-py library (v1.0+)
- HTTP protocol: `http://surrealdb:8000`
- `insert()` completes without errors
- `query()` completes without errors but returns empty results
- Proper authentication and namespace/database selection

**Expected Behavior**:
- `insert()` should create records immediately queryable by any field
- `query()` should return records matching WHERE clause

**Gap**: Query does not return records inserted via same client

**Possible Causes**:
1. HTTP protocol eventual consistency
2. Missing table schema definition
3. Missing field indexes
4. Client library bug with HTTP transport

### 4. Database Schema ⚠️ UNAPPLIED
**File**: `scripts/init-surrealdb-devbob-schema-v2.sql:45-60`

**Current State**:
```sql
DEFINE TABLE IF NOT EXISTS users SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD user_id ON users TYPE string;
DEFINE FIELD email ON users TYPE string;
DEFINE FIELD password_hash ON users TYPE string;
-- ... other fields ...

DEFINE INDEX users_id_idx ON users FIELDS user_id UNIQUE;
DEFINE INDEX users_email_idx ON users FIELDS email UNIQUE;
DEFINE INDEX users_org_idx ON users FIELDS org_id;
```

**Gap**: CRITICAL - Schema may not be applied to production database

**Evidence**:
- Schema file exists and looks correct
- Registration works without schema (SCHEMAFULL not enforced)
- Queries on non-ID fields might require explicit indexes
- Projects work (queried by ID), users fail (queried by email)

### 5. Configuration ✅ FIXED
**File**: `repos/platform/metabob-apps/charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml`

**Current State**:
- Protocol: HTTP (`http://surrealdb:8000`)
- Database: `metabob` (fixed in revision 34, was `default`)
- Namespace: `metabob`

**Consideration**: WebSocket protocol (`ws://surrealdb:8000`) untested

## Root Cause Analysis

### Primary Hypothesis: Missing Database Schema
**Confidence**: HIGH (90%)

**Evidence**:
1. ✅ Registration succeeds without errors using `db.insert()` or `db.create()`
2. ❌ Login query returns 0 results immediately after registration
3. ❌ Query `SELECT * FROM users WHERE email = $email` returns empty list
4. ✅ Structured logging confirms: `result_count=0, result_structure='[]'`
5. ⚠️ Schema file exists but may not be applied to running database
6. ✅ Projects work fine (queried by `project_id` in record ID)
7. ❌ Users fail (queried by `email` which is regular field)

**Explanation**: SurrealDB v3 might require explicit `DEFINE INDEX` on fields used in WHERE clauses. Without indexes, queries on regular fields may not work even if the table exists.

### Secondary Hypothesis: HTTP Protocol Consistency
**Confidence**: MEDIUM (40%)

**Evidence**:
1. Using HTTP protocol (`http://surrealdb:8000`)
2. Official surrealdb-py library v1.0+ with HTTP transport
3. No errors during insert or query operations
4. WebSocket protocol not tested as alternative

**Explanation**: HTTP protocol might have eventual consistency behavior where writes are not immediately visible to reads. WebSocket might provide stronger consistency.

## Validation Tests

### Test 1: Direct Database Verification
```bash
kubectl exec -n metabob surrealdb-0 -- /surreal sql \
  --endpoint http://localhost:8000 \
  --username root \
  --password changeme \
  --namespace metabob \
  --database metabob \
  --command 'SELECT * FROM users;'
```
**Expected**: Should show user records if data exists

### Test 2: Check Applied Schema
```bash
kubectl exec -n metabob surrealdb-0 -- /surreal sql \
  --endpoint http://localhost:8000 \
  --username root \
  --password changeme \
  --namespace metabob \
  --database metabob \
  --command 'INFO FOR TABLE users;'
```
**Expected**: Should show defined fields and indexes including `email_idx`

### Test 3: Registration and Login Flow
1. Register user via `POST /auth/register`
2. Immediately query via `POST /auth/login` with same email
3. Check structured logs for `DB_QUERY_USER_COMPLETE` stage

**Current Result**: `result_count=0`  
**Expected Result**: `result_count=1` with user record

## Remediation Steps

### Priority 1: Apply Schema Definition (HIGH) ⭐⭐⭐
**Action**: Execute schema SQL against running SurrealDB

```bash
kubectl exec -n metabob surrealdb-0 -- /surreal sql \
  --endpoint http://localhost:8000 \
  --username root \
  --password changeme \
  --namespace metabob \
  --database metabob \
  < scripts/init-surrealdb-devbob-schema-v2.sql
```

**Expected Outcome**: Email index created, queries on email field work immediately

### Priority 2: Verify Index Creation (HIGH) ⭐⭐⭐
**Action**: Check that email_idx was created

```sql
INFO FOR TABLE users;
```

**Expected Outcome**: Shows email field with UNIQUE index

### Priority 3: Test WebSocket Protocol (MEDIUM) ⭐⭐
**Action**: Change `SURREALDB_URL` and redeploy

**File**: `repos/platform/metabob-apps/charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml`

```yaml
surrealdb:
  url: "ws://surrealdb:8000"  # Changed from http://
```

**Expected Outcome**: If HTTP has consistency issues, WebSocket provides immediate consistency

### Priority 4: Add Retry Logic (LOW) ⭐
**Action**: Implement exponential backoff retry for user queries

**File**: `repos/metabob-rpc-api/server/routes/cloud_auth.py`

**Expected Outcome**: Handles eventual consistency if present

## Impact Analysis

### Blocked Features (CRITICAL) 🔴
- ❌ Dashboard login (complete blocker)
- ❌ User authentication flow
- ❌ E2E dashboard testing
- ❌ CLI integration testing (Gap 1)
- ❌ Multi-session workflows

### Working Features ✅
- ✅ User registration
- ✅ Token generation
- ✅ Project CRUD operations
- ✅ Dashboard UI rendering
- ✅ Direct API calls with pre-generated tokens

**Severity**: CRITICAL - Production blocker

## Related Files

1. `repos/metabob-rpc-api/server/routes/cloud_auth.py` - Auth endpoints
2. `repos/metabob-rpc-api/server/db/surrealdb_client.py` - Database client
3. `repos/metabob-rpc-api/server/models/auth.py` - Data models
4. `repos/metabob-rpc-api/server/utils/jwt_auth.py` - JWT utilities
5. `scripts/init-surrealdb-devbob-schema-v2.sql` - Schema definition
6. `repos/platform/metabob-apps/charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml` - Configuration

## Summary for Downstream Tasks

**CURRENT STATE**: Registration works, login fails due to empty query results

**ROOT CAUSE**: Likely missing or unapplied database schema with email index

**FIX APPROACH**: 
1. Apply schema SQL to running database
2. Verify indexes are created
3. Test login flow
4. If still failing, try WebSocket protocol

**VALIDATION**: E2E test - register user, immediately login, verify 200 OK

**DEPLOYMENT**: Schema application requires kubectl access to SurrealDB pod

---

**Trace Completed**: 2026-03-12T06:25:00Z  
**Traced By**: OpenCode Trace Agent  
**Next Step**: Create validation and enforcement activities
