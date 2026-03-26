# RBAC Troubleshooting Guide

This guide helps diagnose and resolve common RBAC-related issues in the Metabob ecosystem.

## Quick Diagnostics

### Check Authentication Status

```bash
# Test API health
curl http://api.minibob.local/health

# Test with JWT
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://api.minibob.local/v2/activities/templates

# Verify JWT claims (via backend)
curl -X POST http://api.minibob.local/v2/auth/minibob/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "'$JWT_TOKEN'"}'
```

### Check SurrealDB Connection

```bash
# Direct SurrealDB query
surreal sql --conn http://localhost:8000 \
  --ns activity-system --db learning_loop \
  --user root --pass $PASSWORD \
  -q "INFO FOR DB"
```

---

## Common Issues

### 1. "Unauthorized" (401) on All Requests

**Symptoms:**
- All authenticated requests return 401
- Token appears to be rejected

**Possible Causes:**

#### A. Token Expired

```bash
# Check token expiry
# Decode JWT (without verification) to see claims
echo $JWT_TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .

# Look for: "exp": 1234567890 (Unix timestamp)
```

**Fix:** Re-authenticate to get fresh token:
```bash
# For MiniBob instance
curl -X POST http://api.minibob.local/v2/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{"instance_id": "mb-001", "api_key": "your-key"}'

# For API key
curl -X POST http://api.minibob.local/v2/auth/apikey \
  -H "Content-Type: application/json" \
  -d '{"api_key": "mk_prefix_key"}'
```

#### B. Wrong JWT Secret

The JWT secret must match between token issuer and validator.

**Check:** Verify SurrealDB is using consistent signing key.

#### C. ACCESS Definition Missing

```surql
-- Check if access method exists
INFO FOR DB;

-- Should show:
-- accesses: { jwt_external: ..., minibob_record: ..., apikey_record: ... }
```

**Fix:** Run migrations:
```bash
cd repos/metabob-proto
bun run surrealdb/lib/migrate.ts
```

---

### 2. "Permission Denied" on Specific Data

**Symptoms:**
- Authentication succeeds
- Some queries return data, others return empty or 403
- User can see some records but not others

**Diagnosis:**

```surql
-- Check your auth context
SELECT * FROM $auth;

-- Check record's org_id
SELECT org_id FROM activity_template WHERE id = 'template:xxx';

-- Compare: Does $auth.org_id match record's org_id?
```

**Possible Causes:**

#### A. org_id Mismatch

User is authenticated to org A but querying data owned by org B.

**Fix:** Ensure user is in correct org, or data should be `scope=global, public=true`.

#### B. Missing org_id on Record

Legacy data may not have org_id set.

```surql
-- Find records without org_id
SELECT id FROM activity_template WHERE org_id IS NONE;

-- Backfill to default org
UPDATE activity_template SET org_id = organizations:metabob_internal
  WHERE org_id IS NONE;
```

#### C. PERMISSIONS Clause Too Restrictive

```surql
-- Check table permissions
INFO FOR TABLE activity_template;

-- Should show PERMISSIONS with $auth.org_id checks
```

---

### 3. MiniBob Can't Execute Activities

**Symptoms:**
- MiniBob starts but can't fetch templates
- "Authentication failed" in MiniBob logs
- Boredom activities don't run

**Diagnosis:**

```bash
# Check MiniBob logs
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob --tail=100

# Look for:
# [MCP] Instance authentication failed: 401
# [MCP] No instance configuration provided
```

**Possible Causes:**

#### A. Instance Credentials Not Set

```bash
# Check environment variables
kubectl exec -n activity-system deployment/minibob -- env | grep MINIBOB

# Should see:
# MINIBOB_INSTANCE_ID=mb-xxx
# MINIBOB_INSTANCE_API_KEY=xxx
```

**Fix:** Set instance credentials in Helm values:
```yaml
# helm/charts/devbob/values.yaml
minibob:
  instanceId: mb-001
  apiKey: your-api-key
```

#### B. Instance Not in Database

```surql
-- Check if instance exists
SELECT * FROM minibob_instance WHERE instance_id = 'mb-001';
```

**Fix:** Create instance:
```surql
CREATE minibob_instance SET
  instance_id = 'mb-001',
  org_id = organizations:metabob_internal,
  api_key_hash = crypto::argon2::generate('your-api-key'),
  vessel_id = 'minibob:v2',
  is_active = true;
```

#### C. Instance Deactivated

```surql
-- Check is_active flag
SELECT is_active FROM minibob_instance WHERE instance_id = 'mb-001';

-- Reactivate if needed
UPDATE minibob_instance:mb-001 SET is_active = true;
```

---

### 4. Empty Query Results

**Symptoms:**
- Queries return `[]` when data exists
- RBAC seems to filter out everything

**Diagnosis:**

```surql
-- Query as root (bypasses PERMISSIONS)
-- Connect with root credentials
SELECT count() FROM activity_template;
-- Returns: 150

-- Query as authenticated user
-- Connect with JWT
SELECT count() FROM activity_template;
-- Returns: 0

-- The difference = PERMISSIONS filtering
```

**Possible Causes:**

#### A. All Data Belongs to Other Org

Check if any data has your org_id:
```surql
SELECT count() FROM activity_template
  WHERE org_id = organizations:your_org;
```

#### B. User Has Wrong org_id in JWT

```bash
# Decode JWT to check org_id claim
echo $JWT_TOKEN | cut -d'.' -f2 | base64 -d | jq .org_id
```

#### C. Table Uses project_id but User Has No Project

```surql
-- Check if table requires project_id
INFO FOR TABLE activity_template;

-- Check user's project membership
SELECT * FROM project_members WHERE user_id = $auth.id;
```

---

### 5. API Key Authentication Fails

**Symptoms:**
- POST /v2/auth/apikey returns 401
- "API key is invalid, expired, or revoked"

**Diagnosis:**

```surql
-- Check if API key exists (can't verify hash directly)
SELECT id, is_active, expires_at, scopes
  FROM api_keys
  WHERE is_active = true;

-- Check for expired keys
SELECT id, expires_at
  FROM api_keys
  WHERE expires_at < time::now();
```

**Possible Causes:**

#### A. Key Revoked

```surql
SELECT is_active FROM api_keys WHERE id = 'api_keys:xxx';
-- If false, key is revoked
```

#### B. Key Expired

```surql
SELECT expires_at FROM api_keys WHERE id = 'api_keys:xxx';
-- Check if expires_at < now
```

#### C. Wrong Key Format

API keys must start with `mk_`:
```
Valid:   mk_prefix_abc123def456...
Invalid: abc123def456...
Invalid: sk_prefix_abc123...
```

#### D. Typo in Key

Re-copy the key from dashboard, ensure no trailing whitespace.

---

### 6. Rate Limiting Errors

**Symptoms:**
- 429 Too Many Requests on auth endpoints
- "Rate limit exceeded"

**Rate Limits:**

| Endpoint | Limit |
|----------|-------|
| `/v2/auth/*` | 10 requests/minute |
| `/v2/auth/minibob/signin` | 5 requests/minute |
| `/v2/auth/apikey` | 5 requests/minute |

**Fix:** Wait 60 seconds and retry. If legitimate traffic, contact admin.

---

### 7. Schema Version Mismatch

**Symptoms:**
- "Table not found" errors
- Missing fields in responses
- PERMISSIONS clause errors

**Diagnosis:**

```surql
-- Check applied migrations
SELECT * FROM schema_version ORDER BY applied_at DESC;
```

**Fix:** Run migrations:
```bash
# Core schemas
cd repos/metabob-proto
bun run surrealdb/lib/migrate.ts

# Activity API schemas
cd repos/metabob-activity-api
bun run sql/migrate.ts

# Analysis API schemas
cd repos/metabob-analysis-api
bun run sql/migrate.ts
```

---

### 8. Cross-Org Data Leak (Security Issue)

**Symptoms:**
- User can see data from another organization
- PERMISSIONS not being enforced

**Immediate Action:**

1. **Identify scope**: Which table? What data?
2. **Check PERMISSIONS**: `INFO FOR TABLE table_name`
3. **Verify org_id field exists**: `SELECT org_id FROM table_name LIMIT 1`

**Root Causes:**

#### A. Table Missing PERMISSIONS

```surql
-- Check table definition
INFO FOR TABLE problematic_table;

-- If PERMISSIONS missing, add:
DEFINE TABLE problematic_table SCHEMAFULL
  PERMISSIONS
    FOR select, create, update, delete WHERE org_id = $auth.org_id;
```

#### B. Query Using Root Credentials

Application code may be using root credentials instead of user JWT.

**Audit:** Search for `username: 'root'` or `password:` in code.

#### C. org_id Field Missing

```surql
-- Add org_id field if missing
DEFINE FIELD org_id ON problematic_table TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

-- Backfill existing records
UPDATE problematic_table SET org_id = organizations:default
  WHERE org_id IS NONE;
```

---

## Debugging Tools

### 1. JWT Decoder

```bash
# Decode JWT without verification
decode_jwt() {
  echo "$1" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .
}

decode_jwt "$JWT_TOKEN"
```

### 2. SurrealDB Shell

```bash
# Interactive SQL shell
surreal sql \
  --conn http://localhost:8000 \
  --ns activity-system \
  --db learning_loop \
  --user root \
  --pass $PASSWORD
```

### 3. Test Authentication Flow

```bash
#!/bin/bash
# test-auth.sh

# 1. Get token
TOKEN=$(curl -s -X POST http://api.minibob.local/v2/auth/apikey \
  -H "Content-Type: application/json" \
  -d '{"api_key": "'$API_KEY'"}' | jq -r .token)

echo "Token: ${TOKEN:0:50}..."

# 2. Verify token
curl -s -X POST http://api.minibob.local/v2/auth/minibob/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "'$TOKEN'"}'

# 3. Test data access
curl -s -H "Authorization: Bearer $TOKEN" \
  http://api.minibob.local/v2/activities/templates | jq '.templates | length'
```

### 4. Check Pod Logs

```bash
# Activity API logs
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f

# MiniBob logs
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f

# SurrealDB logs
kubectl logs -n activity-system -l app.kubernetes.io/name=surrealdb -f
```

---

## Escalation Path

If unable to resolve:

1. **Collect diagnostics:**
   - Error message
   - JWT claims (decoded)
   - Table PERMISSIONS
   - schema_version entries
   - Relevant logs

2. **Check documentation:**
   - `docs/RBAC_GUIDE.md`
   - `docs/AUTH_JWT_CLAIMS.md`
   - `docs/MULTI_TENANT_ARCHITECTURE.md`

3. **File issue:**
   - Include all diagnostics
   - Tag with `rbac` and `auth`
