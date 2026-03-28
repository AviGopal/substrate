# Trace Analysis: dashboard-authentication-backend-fix

**Specification:** Authentication backend must properly handle user registration and login with correct JWT_SECRET_KEY configuration and database query handling.

**Analysis Date:** 2026-03-11  
**Analyst:** OpenCode Trace Agent  
**Impulse ID:** trace-dashboard-authentication-backend-fix  
**Impulse Location:** impulses/trace-dashboard-authentication-backend-fix.json

---

## Executive Summary

The dashboard authentication system is **completely non-functional** due to a critical deployment configuration issue and a secondary registration endpoint bug.

### Critical Issues Identified

1. **JWT_SECRET_KEY NOT CONFIGURED (CRITICAL)**
   - Location: `metabob-apps/charts/metabob-rpc-api/charts/templates/deployment-api.yaml:43-47`
   - Impact: JWT tokens use weak default secret, causing security vulnerabilities
   - Status: SECRET_KEY environment variable commented out, no JWT_SECRET_KEY set

2. **Registration Returns 400 for ALL Emails (HIGH)**
   - Location: `repos/metabob-rpc-api/server/routes/cloud_auth.py:418-442`
   - Impact: Users cannot create accounts
   - Root Cause: SurrealDB result parsing lacks robust structure handling (unlike login endpoint)

3. **Login Returns 401 for ALL Credentials (HIGH)**
   - Location: `repos/metabob-rpc-api/server/routes/cloud_auth.py:48-415`
   - Impact: Users cannot authenticate
   - Root Cause: Likely JWT_SECRET_KEY issue or missing test users in database

---

## Component Analysis

### 1. Kubernetes Deployment Configuration
**File:** `metabob-apps/charts/metabob-rpc-api/charts/templates/deployment-api.yaml`

**Current State (Lines 34-83):**
```yaml
env:
  - name: WORKERS
    value: '16'
  # ... other env vars ...
  # - name: SECRET_KEY          # <-- COMMENTED OUT
  #   valueFrom:
  #     secretKeyRef:
  #       name: {{ .Values.name }}-secrets
  #       key: SECRET_KEY
  # JWT_SECRET_KEY: NOT PRESENT
```

**Desired State:**
```yaml
env:
  - name: JWT_SECRET_KEY
    valueFrom:
      secretKeyRef:
        name: metabob-rpc-api-secrets
        key: jwt-secret-key
```

**Gap:** Environment variable not configured → container uses weak default from `jwt_auth.py`

---

### 2. JWT Authentication Utility
**File:** `repos/metabob-rpc-api/server/utils/jwt_auth.py`

**Current State (Lines 32-60):**
```python
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "development-secret-key-change-in-production")

if SECRET_KEY in WEAK_SECRETS or len(SECRET_KEY) < 32:
    logger.critical("CRITICAL SECURITY ERROR: JWT_SECRET_KEY is weak...")
    if os.getenv("ENVIRONMENT", "production").lower() == "production":
        sys.exit(1)  # Fail fast in production
    else:
        logger.warning("Running with weak JWT secret in non-production mode")
```

**Assessment:** ✅ Code is correct - validates secret strength, logs warnings, fails in production mode.

**Gap:** Kubernetes deployment doesn't set `JWT_SECRET_KEY` → uses weak default → security vulnerability

---

### 3. Registration Endpoint - Email Duplicate Check
**File:** `repos/metabob-rpc-api/server/routes/cloud_auth.py`

**Current State (Lines 434-442):**
```python
check_query = "SELECT user_id FROM users WHERE email = $email"
existing = await db.query(check_query, {"email": request.email})

if existing and len(existing) > 0 and len(existing[0]) > 0:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Email already registered",
    )
```

**Problem:** Naive result parsing assumes simple list structure. SurrealDB returns nested formats:
- `[{"status": "OK", "result": [...]}]` (official library format)
- `[[{...}]]` (list of records)
- `[{...}]` (direct records)

**Comparison with Login Endpoint (Lines 125-147):**
```python
# Login has ROBUST result parsing:
user_data = None
first_elem = result[0]

# Case 1: Official library format {"status": "OK", "result": [...]}
if isinstance(first_elem, dict) and "result" in first_elem:
    user_list = first_elem.get("result", [])
    user_data = user_list[0] if user_list else None

# Case 2: List of records [[{...}]]
elif isinstance(first_elem, list) and len(first_elem) > 0:
    user_data = first_elem[0]

# Case 3: Direct record (legacy format)
elif isinstance(first_elem, dict) and "email" in first_elem:
    user_data = first_elem
```

**Gap:** Registration endpoint lacks this robust parsing → returns false positives → always rejects as "Email already registered"

---

### 4. Login Endpoint
**File:** `repos/metabob-rpc-api/server/routes/cloud_auth.py:48-415`

**Assessment:** ✅ Implementation is **correct**:
- Robust SurrealDB result parsing (lines 125-147)
- bcrypt password verification (line 190)
- JWT token generation with SECRET_KEY (lines 241-248)
- Comprehensive structured logging
- Organization query and last_login_at update

**Why Login Fails:**
1. JWT_SECRET_KEY misconfiguration (primary cause)
2. Test users may not exist in database
3. Password hash mismatch (if users seeded incorrectly)

---

## Data Flow Tracing

### Registration Flow
```
Frontend POST /auth/register
    ↓
cloud_auth.py:register() (line 418)
    ↓
1. Check email exists (line 435-436)
   Query: SELECT user_id FROM users WHERE email = $email
   ❌ ISSUE: Naive result parsing → false positives
    ↓
2. Hash password with bcrypt (line 445)
    ↓
3. Generate UUIDs for org_id, user_id (lines 448-449)
    ↓
4. Create organization record (line 459)
    ↓
5. Create user record (line 473)
   - password_hash, email, name, org_id, role="owner"
    ↓
6. Create user_organizations junction (line 482)
    ↓
7. Generate JWT token with SECRET_KEY (lines 485-490)
   ⚠️ Uses weak default secret if JWT_SECRET_KEY not set
    ↓
8. Return RegisterResponse (token, user, organization)
```

### Login Flow
```
Frontend POST /auth/login
    ↓
cloud_auth.py:login() (line 48)
    ↓
1. Query user by email (line 91)
   Query: SELECT * FROM users WHERE email = $email AND is_active = true
    ↓
2. Parse nested SurrealDB result (lines 125-147)
   ✅ Handles multiple result formats robustly
    ↓
3. Verify password with bcrypt (line 190)
   verify_password(request.password, user_data["password_hash"])
    ↓
4. Generate JWT tokens (lines 241-248)
   - create_access_token(user_id, email, org_id, role)
   - create_refresh_token(user_id)
   ⚠️ Uses SECRET_KEY from jwt_auth.py
    ↓
5. Store refresh token in database (lines 263-272)
    ↓
6. Update last_login_at (lines 282-284)
    ↓
7. Query user organizations (line 316)
   Query: SELECT org_id, role FROM user_organizations WHERE user_id = $user_id
    ↓
8. Fetch organization details (lines 336-357)
    ↓
9. Return LoginResponse (token, refresh_token, user, organizations)
```

### JWT Validation Flow
```
Frontend request with Authorization: Bearer <token>
    ↓
jwt_auth.py:decode_token() (line 154)
    ↓
jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    ↓
If SECRET_KEY mismatch:
    ↓ ExpiredSignatureError or PyJWTError
    ↓
HTTPException 401 Unauthorized
```

---

## Root Cause Analysis

### Primary Cause
**JWT_SECRET_KEY environment variable not configured in Kubernetes deployment**

Evidence:
- File: `metabob-apps/charts/metabob-rpc-api/charts/templates/deployment-api.yaml`
- Lines 43-47 show SECRET_KEY commented out
- No JWT_SECRET_KEY environment variable present
- Container uses weak default: `"development-secret-key-change-in-production"`

Impact:
- JWT tokens signed with weak, predictable secret
- Token forgery vulnerability (OWASP A02:2021 Cryptographic Failures)
- All token validation fails or succeeds with forged tokens
- Complete authentication system compromise

### Secondary Cause
**Registration endpoint's email duplicate check has result parsing bug**

Evidence:
- File: `repos/metabob-rpc-api/server/routes/cloud_auth.py:434-442`
- Checks `len(existing[0])` without handling nested SurrealDB result structures
- Login endpoint (lines 125-147) has robust parsing for same database client
- Inconsistent implementation across endpoints

Impact:
- Registration always returns "Email already registered" (400 error)
- Users cannot create new accounts
- Onboarding flow completely blocked

---

## Fix Strategy

### Step 1: Create Kubernetes Secret (CRITICAL)
```bash
kubectl create secret generic metabob-rpc-api-secrets \
  -n metabob \
  --from-literal=jwt-secret-key=$(openssl rand -hex 32)
```

**Priority:** CRITICAL  
**Impact:** Enables secure JWT token generation

---

### Step 2: Update Deployment YAML (CRITICAL)
**File:** `metabob-apps/charts/metabob-rpc-api/charts/templates/deployment-api.yaml`

**Add after line 42:**
```yaml
- name: JWT_SECRET_KEY
  valueFrom:
    secretKeyRef:
      name: metabob-rpc-api-secrets
      key: jwt-secret-key
```

**Priority:** CRITICAL  
**Impact:** Injects strong secret into container environment

---

### Step 3: Fix Registration Email Check (HIGH)
**File:** `repos/metabob-rpc-api/server/routes/cloud_auth.py`

**Replace lines 434-442 with:**
```python
check_query = "SELECT user_id FROM users WHERE email = $email"
existing = await db.query(check_query, {"email": request.email})

# Robust result parsing (same as login endpoint)
user_exists = False
if existing and len(existing) > 0:
    first_elem = existing[0]
    
    # Case 1: Official library format {"status": "OK", "result": [...]}
    if isinstance(first_elem, dict) and "result" in first_elem:
        user_list = first_elem.get("result", [])
        user_exists = len(user_list) > 0
    
    # Case 2: List of records [[{...}]]
    elif isinstance(first_elem, list):
        user_exists = len(first_elem) > 0
    
    # Case 3: Direct record
    elif isinstance(first_elem, dict) and "user_id" in first_elem:
        user_exists = True

if user_exists:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Email already registered",
    )
```

**Priority:** HIGH  
**Impact:** Fixes false positive email checks, enables user registration

---

### Step 4: Verify/Create Test Users (MEDIUM)
```bash
kubectl exec -it deployment/surrealdb -n metabob -- \
  surreal sql --endpoint http://localhost:8000 --username root --password root --namespace metabob --database default
```

```sql
-- Check if test user exists
SELECT * FROM users WHERE email = 'test@metabob.com';

-- If not, seed test data (use bcrypt hash for password "testpassword")
INSERT INTO organizations {
  org_id: "test-org-001",
  name: "Test Organization",
  display_name: "Test Organization",
  created_at: time::now()
};

INSERT INTO users {
  user_id: "test-user-001",
  email: "test@metabob.com",
  password_hash: "<bcrypt-hash>",
  name: "Test User",
  org_id: "test-org-001",
  role: "owner",
  is_active: true,
  created_at: time::now()
};
```

**Priority:** MEDIUM  
**Impact:** Enables login validation testing

---

### Step 5: Deploy and Restart (CRITICAL)
```bash
cd metabob-apps
helmfile -e default apply
kubectl rollout restart deployment/metabob-rpc-api -n metabob
kubectl wait --for=condition=ready pod -l app=metabob-rpc-api -n metabob --timeout=120s
```

**Priority:** CRITICAL  
**Impact:** Activates all fixes in running cluster

---

## Validation Tests

### Test 1: Verify JWT_SECRET_KEY in Pod
```bash
kubectl exec -it deployment/metabob-rpc-api -n metabob -- env | grep JWT_SECRET_KEY
```
**Expected:** `JWT_SECRET_KEY=<64-char-hex-string>`

### Test 2: Test Registration with Unique Email
```bash
curl -X POST http://app.metabob.local/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"test$(date +%s)@example.com\",
    \"password\": \"TestPass123!\",
    \"name\": \"Test User\",
    \"org_name\": \"Test Org\"
  }"
```
**Expected:** `200 OK` with JSON containing `token`, `user`, `organization`

### Test 3: Test Login with Registered User
```bash
curl -X POST http://app.metabob.local/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"<registered-email>\",
    \"password\": \"<password>\"
  }"
```
**Expected:** `200 OK` with JSON containing `token`, `user`, `organizations`

### Test 4: Verify JWT Token Validation
```bash
TOKEN="<token-from-login>"
curl -H "Authorization: Bearer $TOKEN" \
  http://app.metabob.local/auth/session
```
**Expected:** `200 OK` with JSON containing `user_id`, `email`, `org_id`, `role`

---

## Compliance Checklist

- [ ] **Spec 1:** JWT_SECRET_KEY configured with strong secret (>=32 chars)
- [ ] **Spec 2:** Registration endpoint validates emails correctly and creates users in SurrealDB
- [ ] **Spec 3:** Login endpoint verifies credentials, queries users, returns valid JWT tokens
- [ ] **Spec 4:** User records include bcrypt-hashed passwords, organization linkage, proper timestamps

---

## File References

### Components Requiring Changes
1. `metabob-apps/charts/metabob-rpc-api/charts/templates/deployment-api.yaml:34-83`
2. `repos/metabob-rpc-api/server/routes/cloud_auth.py:418-442`

### Components Referenced (No Changes)
3. `repos/metabob-rpc-api/server/utils/jwt_auth.py:32-60` ✅ Correct implementation
4. `repos/metabob-rpc-api/server/routes/cloud_auth.py:48-415` ✅ Login endpoint correct
5. `repos/metabob-rpc-api/server/db/surrealdb_client.py:169-275` ✅ Database client correct

---

## Next Steps for Downstream Tasks

1. **Enforcement Task:** Use this trace to implement fixes
   - Create Kubernetes secret
   - Update deployment YAML
   - Fix registration endpoint parsing
   - Deploy changes

2. **Validation Task:** Use validation tests to verify fixes
   - Test JWT_SECRET_KEY presence
   - Test registration flow end-to-end
   - Test login flow end-to-end
   - Test token validation

3. **Documentation Task:** Update deployment docs
   - Document JWT_SECRET_KEY requirement
   - Document SurrealDB result parsing patterns
   - Add troubleshooting guide for auth issues

---

## Related Documentation

- **Dashboard Validation Results:** `DASHBOARD_VALIDATION_RESULTS.md`
- **SurrealDB Auth Fix Report:** `SURREALDB_AUTH_FIX_COMPLETION_REPORT.md`
- **Data Flow Diagram:** `docs/data-flows/surrealdb-authentication-fix-and-dashboard-live-test-flow.md`

---

**Impulse Created:** `impulses/trace-dashboard-authentication-backend-fix.json`  
**Budget:** 5000 tokens  
**Ready for:** Enforcement and Validation phases
