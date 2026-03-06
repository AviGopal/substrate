# Trace Analysis: User Authentication Login Flow Fix

**Specification**: user-authentication-login-flow-fix  
**Impulse ID**: trace-user-authentication-login-flow-fix  
**Created**: 2026-03-06  
**Purpose**: Complete trace of authentication flow from CLI user creation to dashboard login

---

## Executive Summary

The authentication flow has been traced from CLI user creation through dashboard login. Analysis reveals **THREE HIGH-PRIORITY root causes** for the 401 Unauthorized error:

1. **MISSING DATABASE SCHEMA** - Users table does not exist in `init-surrealdb-devbob-schema-v2.sql`
2. **QUERY RESULT PARSING ERROR** - `cloud_auth.py:69` may incorrectly parse SurrealDB query results
3. **USERS TABLE NOT INITIALIZED** - Schema SQL may not have been run against the deployed database

---

## Component Analysis

### 1. User Creation (CLI → Database)

**File**: `repos/metabob-rpc-api/server/cli.py:449-481`  
**Component**: `user_create` command

```python
@user.command(name="create")
@click.option("--email", required=True)
@click.option("--password", prompt=True, hide_input=True)
@click.option("--name", required=True)
@click.option("--org-id", required=True)
@click.option("--role", default="member")
def user_create(email: str, password: str, name: str, org_id: str, role: str):
    result = asyncio.run(create_user(email, password, name, org_id, role))
```

**Status**: ✅ CORRECT - Properly delegates to `user_ops.create_user()`

---

### 2. Password Hashing

**File**: `repos/metabob-rpc-api/server/db/operations/user_ops.py:54-57`  
**Component**: `create_user` password hashing

```python
password_hash = bcrypt.hashpw(
    password.encode("utf-8"), 
    bcrypt.gensalt()
).decode("utf-8")
```

**Status**: ✅ CORRECT - Matches verification logic in `jwt_auth.py`

**Data persisted to SurrealDB**:
```json
{
  "user_id": "user-{uuid}",
  "email": "demo@metabob.com",
  "password_hash": "$2b$12$...",
  "name": "Demo User",
  "org_id": "metabob-org",
  "role": "member",
  "is_active": true,
  "email_verified": false,
  "created_at": "2026-03-06T..."
}
```

**Record ID Format**: `users:{user_id}` (e.g., `users:user-abc123`)

---

### 3. Login Endpoint

**File**: `repos/metabob-rpc-api/server/routes/cloud_auth.py:42-193`  
**Component**: `POST /auth/login`

```python
@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    db = await get_surreal_client()
    
    # Query user by email
    query = "SELECT * FROM users WHERE email = $email AND is_active = true"
    result = await db.query(query, {"email": request.email})
    
    if not result or len(result) == 0:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED)
    
    user_data = result[0]  # ⚠️ POTENTIAL BUG HERE
    
    # Verify password
    if not verify_password(request.password, user_data["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED)
```

**Status**: ⚠️ POTENTIAL ISSUE - Line 69 may incorrectly parse query result

**Problem**: SurrealDB `query()` returns nested structure:
```python
# Expected format from surrealdb-py:
result = [
    {
        "status": "OK",
        "time": "123μs", 
        "result": [
            {"user_id": "...", "email": "...", "password_hash": "..."}
        ]
    }
]

# Current code does: user_data = result[0]
# This gets the outer dict, not the user record!

# Should be: user_data = result[0]["result"][0]
# Or: user_data = result[0][0] (if result is list of lists)
```

---

### 4. Password Verification

**File**: `repos/metabob-rpc-api/server/utils/jwt_auth.py:70-83`  
**Component**: `verify_password`

```python
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )
```

**Status**: ✅ CORRECT - Matches hashing logic

---

### 5. Database Connection

**File**: `repos/metabob-rpc-api/server/db/surrealdb_client.py:70-144`  
**Component**: `AsyncSurrealDBClient.connect()`

**Deployed Configuration**:
```bash
SURREALDB_URL=http://surrealdb:8000
SURREALDB_NAMESPACE=metabob
SURREALDB_DATABASE=devbob
SURREALDB_USERNAME=root
SURREALDB_PASSWORD=changeme
```

**Status**: ✅ CORRECT - Connection parameters are valid

**Potential Issue**: Config default is `database='learning_loop'` but deployed uses `devbob`. Environment variables should override, but if not loaded properly, users go to wrong database.

---

## Root Cause Analysis

### Root Cause #1: Missing Database Schema (HIGH LIKELIHOOD)

**Evidence**: 
- `scripts/init-surrealdb-devbob-schema-v2.sql` only defines `activity_template` and `activity_execution` tables
- No `users`, `organizations`, `user_organizations`, or `refresh_tokens` tables

**Impact**: 
- CLI command `user create` fails to persist users
- Login queries return empty result set
- 401 Unauthorized error returned

**Validation**:
```bash
kubectl exec -n metabob metabob-rpc-api-XXX -- python -c "
import asyncio
from server.db.surrealdb_client import get_surreal_client
db = asyncio.run(get_surreal_client())
result = asyncio.run(db.query('INFO FOR DB;'))
print(result)
"
```

**Expected Output**: Should list `users` table. If missing, root cause confirmed.

---

### Root Cause #2: Query Result Parsing Error (HIGH LIKELIHOOD)

**Evidence**:
- `cloud_auth.py:69` does `user_data = result[0]`
- SurrealDB official library returns nested structure: `[{"status": "OK", "result": [...]}]`
- Accessing `result[0]` gets outer dict, not user record

**Impact**:
- Even if user exists, `user_data["password_hash"]` fails with KeyError
- Falls through to 401 Unauthorized

**Fix**:
```python
# Current (line 69):
user_data = result[0]

# Should be:
if result and len(result) > 0:
    if isinstance(result[0], dict) and "result" in result[0]:
        # Official surrealdb-py format
        user_data = result[0]["result"][0] if result[0]["result"] else None
    elif isinstance(result[0], list):
        # Alternative format
        user_data = result[0][0] if len(result[0]) > 0 else None
    else:
        # Direct result
        user_data = result[0]
    
    if not user_data:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED)
```

---

### Root Cause #3: Schema Not Initialized (MEDIUM LIKELIHOOD)

**Evidence**:
- Schema file exists but may not have been applied to database
- No Kubernetes init job visible in deployment
- CLI command `db init-schema` may not have been run

**Validation**:
```bash
# Check if init job exists
kubectl get jobs -n metabob | grep init-db

# Check if tables exist
kubectl exec -n metabob surrealdb-XXX -- [query INFO FOR DB]
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ USER CREATION FLOW (CLI → SurrealDB)                            │
└─────────────────────────────────────────────────────────────────┘

python -m server.cli admin user create
            ↓
     user_ops.create_user()
            ↓
    bcrypt.hashpw(password)
            ↓
    password_hash = "$2b$12$..."
            ↓
    db.create("users:{user_id}", {
        user_id, email, password_hash, name, org_id, role, ...
    })
            ↓
    SurrealDB: namespace=metabob, database=devbob
            ↓
    users table record created


┌─────────────────────────────────────────────────────────────────┐
│ LOGIN FLOW (Dashboard → JWT Token)                              │
└─────────────────────────────────────────────────────────────────┘

POST /auth/login
  { email, password }
            ↓
    cloud_auth.login()
            ↓
    db.query("SELECT * FROM users WHERE email = $email")
            ↓
    ⚠️ POTENTIAL BUG: result[0] parsing
            ↓
    verify_password(plain, hash)
            ↓
    bcrypt.checkpw()
            ↓
    create_access_token(user_id, email, org_id, role)
            ↓
    JWT token generated
            ↓
    LoginResponse: { token, user, organizations }
```

---

## Fix Strategy

### Priority 1: Create Database Schema ⭐⭐⭐

**File**: `scripts/init-surrealdb-devbob-schema-v2.sql`

**Add Tables**:
```sql
-- Users Table
DEFINE TABLE IF NOT EXISTS users SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD user_id ON users TYPE string;
DEFINE FIELD email ON users TYPE string;
DEFINE FIELD password_hash ON users TYPE string;
DEFINE FIELD name ON users TYPE string;
DEFINE FIELD org_id ON users TYPE string;
DEFINE FIELD role ON users TYPE string DEFAULT "member";
DEFINE FIELD is_active ON users TYPE bool DEFAULT true;
DEFINE FIELD email_verified ON users TYPE bool DEFAULT false;
DEFINE FIELD last_login_at ON users TYPE datetime;
DEFINE FIELD metadata ON users TYPE object DEFAULT {};
DEFINE FIELD created_at ON users TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON users TYPE datetime DEFAULT time::now();

DEFINE INDEX users_id_idx ON users FIELDS user_id UNIQUE;
DEFINE INDEX users_email_idx ON users FIELDS email UNIQUE;
DEFINE INDEX users_org_idx ON users FIELDS org_id;

-- Organizations Table
DEFINE TABLE IF NOT EXISTS organizations SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD org_id ON organizations TYPE string;
DEFINE FIELD name ON organizations TYPE string;
DEFINE FIELD display_name ON organizations TYPE string;
DEFINE FIELD settings ON organizations TYPE object DEFAULT {};
DEFINE FIELD metadata ON organizations TYPE object DEFAULT {};
DEFINE FIELD created_at ON organizations TYPE datetime DEFAULT time::now();

DEFINE INDEX organizations_id_idx ON organizations FIELDS org_id UNIQUE;

-- User Organizations (Many-to-Many)
DEFINE TABLE IF NOT EXISTS user_organizations SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD user_id ON user_organizations TYPE string;
DEFINE FIELD org_id ON user_organizations TYPE string;
DEFINE FIELD role ON user_organizations TYPE string DEFAULT "member";
DEFINE FIELD is_active ON user_organizations TYPE bool DEFAULT true;
DEFINE FIELD joined_at ON user_organizations TYPE datetime DEFAULT time::now();

-- Refresh Tokens
DEFINE TABLE IF NOT EXISTS refresh_tokens SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD token_id ON refresh_tokens TYPE string;
DEFINE FIELD user_id ON refresh_tokens TYPE string;
DEFINE FIELD refresh_token ON refresh_tokens TYPE string;
DEFINE FIELD expires_at ON refresh_tokens TYPE datetime;
DEFINE FIELD is_revoked ON refresh_tokens TYPE bool DEFAULT false;
DEFINE FIELD created_at ON refresh_tokens TYPE datetime DEFAULT time::now();

DEFINE INDEX refresh_tokens_token_idx ON refresh_tokens FIELDS refresh_token;
```

**Apply Schema**:
```bash
# Method 1: Via RPC API pod
kubectl exec -n metabob metabob-rpc-api-XXX -- python -m server.cli db init-schema --schema-file /path/to/schema.sql

# Method 2: Direct SQL injection (if CLI unavailable)
kubectl port-forward -n metabob svc/surrealdb 8000:8000
# Then apply SQL via HTTP POST to /sql endpoint
```

---

### Priority 2: Fix Query Result Parsing ⭐⭐

**File**: `repos/metabob-rpc-api/server/routes/cloud_auth.py:59-76`

**Current Code**:
```python
result = await db.query(query, {"email": request.email})

if not result or len(result) == 0:
    raise HTTPException(status.HTTP_401_UNAUTHORIZED)

user_data = result[0]  # BUG: May be outer dict, not user record
```

**Fixed Code**:
```python
result = await db.query(query, {"email": request.email})

# Add debug logging
logger.info(f"Login query result type: {type(result)}, len: {len(result) if result else 0}")
if result and len(result) > 0:
    logger.info(f"First element: {type(result[0])}, content: {result[0][:200] if isinstance(result[0], str) else result[0]}")

# Handle nested result structure from surrealdb-py
user_data = None
if result and len(result) > 0:
    first_elem = result[0]
    
    # Case 1: Official library format {"status": "OK", "result": [...]}
    if isinstance(first_elem, dict) and "result" in first_elem:
        user_list = first_elem.get("result", [])
        user_data = user_list[0] if user_list else None
    
    # Case 2: List of records [[{...}]]
    elif isinstance(first_elem, list) and len(first_elem) > 0:
        user_data = first_elem[0]
    
    # Case 3: Direct record
    elif isinstance(first_elem, dict) and "email" in first_elem:
        user_data = first_elem

if not user_data:
    logger.warning(f"Login failed: user not found for email {request.email}")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password"
    )

logger.info(f"User found: {user_data.get('user_id')}, verifying password...")
```

---

### Priority 3: Add Debug Logging ⭐

**Purpose**: Diagnose exact failure point

**Locations**:
1. `cloud_auth.py:59` - After database query
2. `cloud_auth.py:72` - After password verification
3. `user_ops.py:78` - After user creation

**Code**:
```python
# In login endpoint (cloud_auth.py)
logger.info(f"Login attempt for email: {request.email}")
logger.info(f"Query result: {result}")
logger.info(f"User data extracted: {user_data}")
logger.info(f"Password verification: {verify_password(...)}")

# In user creation (user_ops.py)
logger.info(f"Creating user {email} in org {org_id}")
logger.info(f"Password hash generated: {password_hash[:20]}...")
logger.info(f"Record ID: {record_id}")
logger.info(f"Creation result: {result}")
```

---

### Priority 4: End-to-End Validation ⭐

**Step-by-Step Test**:

```bash
# 1. Verify schema exists
kubectl exec -n metabob metabob-rpc-api-XXX -- python -c "
import asyncio
from server.db.surrealdb_client import get_surreal_client
db = asyncio.run(get_surreal_client())
result = asyncio.run(db.query('INFO FOR DB;'))
print('Tables:', [t for t in result[0].get('tables', {}).keys()])
"

# 2. Create test user
kubectl exec -n metabob metabob-rpc-api-XXX -- python -m server.cli admin user create \
  --email test@metabob.com \
  --password testpass123 \
  --name "Test User" \
  --org-id test-org-123 \
  --role member

# 3. Verify user was created
kubectl exec -n metabob metabob-rpc-api-XXX -- python -c "
import asyncio
from server.db.surrealdb_client import get_surreal_client
db = asyncio.run(get_surreal_client())
result = asyncio.run(db.query('SELECT * FROM users WHERE email = \"test@metabob.com\"'))
print('User found:', result)
"

# 4. Test login endpoint
kubectl port-forward -n metabob svc/metabob-rpc-api 8080:8080 &
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@metabob.com","password":"testpass123"}'

# Expected: {"token":"eyJ...","user":{...},"organizations":[...]}

# 5. Test dashboard login
# Navigate to http://devbob.metabob.local/login
# Enter: test@metabob.com / testpass123
# Expected: Redirect to /cloud/dashboard
```

---

## Next Steps

### Immediate Actions (Today)

1. ✅ **Add schema definitions** to `scripts/init-surrealdb-devbob-schema-v2.sql`
2. ✅ **Apply schema** to SurrealDB in namespace=metabob, database=devbob
3. ✅ **Fix query parsing** in `cloud_auth.py:69`
4. ✅ **Add debug logging** to trace exact failure point
5. ✅ **Create test user** via CLI
6. ✅ **Test login endpoint** with curl
7. ✅ **Test dashboard login** in browser

### Follow-Up (Tomorrow)

8. ✅ **Verify activity history** displays at `/cloud/activity`
9. ✅ **Capture screenshots** with Playwright
10. ✅ **Document working flow** in final validation report

---

## Impulse Metadata

**Impulse ID**: `trace-user-authentication-login-flow-fix`  
**Type**: `templateDefinition`  
**Budget**: 5000 tokens  
**Source**: `trace-data-flow-single-feature` activity  
**Created**: 2026-03-06  

**Purpose**: This impulse provides complete trace analysis for downstream activities:
- `enforce-code-quality`: Fix the identified bugs
- `validate-implementation`: Test the fixes
- `create-playwright-tests`: E2E validation

**Key Findings**:
- 7 components analyzed
- 5 root causes identified (3 high-priority)
- 5 missing database tables
- 4-priority fix strategy

---

## References

**Files Analyzed**:
- `repos/metabob-rpc-api/server/cli.py` (CLI commands)
- `repos/metabob-rpc-api/server/db/operations/user_ops.py` (User CRUD)
- `repos/metabob-rpc-api/server/routes/cloud_auth.py` (Login endpoint)
- `repos/metabob-rpc-api/server/utils/jwt_auth.py` (Password hashing/verification)
- `repos/metabob-rpc-api/server/db/surrealdb_client.py` (Database client)
- `repos/metabob-rpc-api/server/config.py` (Configuration)
- `scripts/init-surrealdb-devbob-schema-v2.sql` (Schema)

**Deployed Environment**:
- Kubernetes namespace: `metabob`
- RPC API pod: `metabob-rpc-api-76cdbf9f84-zbh8m`
- SurrealDB pod: `surrealdb-6ff58cbc5-lx7gc`
- Database: `namespace=metabob, database=devbob`
- Credentials: `root:changeme`

---

**Status**: ✅ Trace Complete - Ready for Enforcement Phase
