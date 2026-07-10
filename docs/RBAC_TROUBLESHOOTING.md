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

# Verify JWT claims — decode locally (no dedicated verify endpoint)
echo $JWT_TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .
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

**Fix:** Re-authenticate to get fresh token via identity-vessel:
```bash
# Dashboard / JWT login
curl -X POST https://identity.metabob.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "..."}'

# API key validation (used by service-to-service callers)
curl -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d '{"api_key": "mb_env-org-user-keyid-hmac"}'
```

> **Removed patterns (do not use):** `POST /v2/auth/minibob/signin` and `POST /v2/auth/apikey` on activity-api are removed. All auth goes through identity-vessel.

#### B. Wrong JWT Secret

The JWT secret must match between token issuer and validator.

**Check:** Verify SurrealDB is using consistent signing key.

#### C. ACCESS Definition Missing

```surql
-- Check if access method exists
INFO FOR DB;

-- Should show:
-- accesses: { jwt_external: ... }
-- (jwt_external is the only active access method; minibob_record and apikey_token
-- are defined for backward compatibility but are no longer issued against)
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

### 3. MiniBob / Goal-Host-Vessel Can't Execute Activities

**Symptoms:**
- MiniBob starts but can't fetch templates
- "Authentication failed" in logs
- Boredom activities don't run

**Diagnosis (local substrate):**

```bash
# Check goal-host-vessel logs inside substrate container
docker exec substrate-live journalctl -u goal-host-vessel --lines=50

# Or check boredom-vessel
docker exec substrate-live journalctl -u boredom-vessel --lines=50
```

**Possible Causes:**

#### A. METABOB_API_KEY Not Set or Invalid

MiniBob (and all substrate vessels) authenticate to activity-api via an HMAC API key.
The key must be registered with identity-vessel.

```bash
# Check the key configured for the local substrate
cat ~/.metabob/config.json | jq .metabob.apiKey

# Validate it against identity-vessel
curl -X POST http://localhost:18080/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d '{"api_key": "<your-key>"}'
```

If the key is not valid, re-run `scripts/substrate/configure-local.sh` to
regenerate and register a fresh key.

#### B. Activity-API Reachability

```bash
# From the host
curl http://localhost:18080/health

# From inside the container (goal-host-vessel uses this)
docker exec substrate-live curl http://localhost:8080/health
```

> **Removed patterns (do not use):** `minibob_instance` table, `MINIBOB_INSTANCE_ID` / `MINIBOB_INSTANCE_API_KEY` env vars, and the Helm values block for `minibob.instanceId` are removed. The current auth path is a plain HMAC API key (`METABOB_API_KEY`) validated via identity-vessel.

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
- Identity-vessel `/v1/keys/validate` returns `valid: false`
- Activity-api returns 401 on all requests
- "API key is invalid, expired, or revoked"

**Current key format:** `mb_<env>-<org>-<user>-<keyid>-<HMAC-SHA256>`
(e.g. `mb_local-orgabc-userabc-key01-a1b2c3d4...`)

**Diagnosis via identity-vessel:**

```bash
# Validate the key directly
curl -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d '{"api_key": "<your-key>"}'
```

**Possible Causes:**

#### A. Key Revoked

Use identity-vessel to check:
```bash
# key_id is the portion before the final HMAC segment
curl -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d '{"api_key": "<your-key>"}' | jq .data
# Look for: "valid": false, "error": "API key has been revoked"
```

#### B. Key Expired

The `validate` response includes `expires_at`. Check it:
```bash
curl ... | jq '.data.expires_at'
```

#### C. Wrong Key Format

Current HMAC API keys use the `mb_` prefix with dash-separated segments:
```
Valid:   mb_local-orgabc-userabc-key01-<hmac32hex>
Invalid: mk_prefix_abc123...   (old format — no longer issued)
Invalid: abc123...             (no prefix)
```

> **Removed pattern:** `POST /v2/auth/apikey` on activity-api is removed. Validate all keys via identity-vessel `POST /v1/keys/validate`.

#### D. Typo in Key

Re-copy the key from the dashboard (shown once at creation). Ensure no trailing whitespace.

---

### 6. Rate Limiting Errors

**Symptoms:**
- 429 Too Many Requests on auth endpoints
- "Rate limit exceeded"

**Rate Limits (identity-vessel):**

| Endpoint | Limit |
|----------|-------|
| `/v1/auth/login` | 10 requests/minute |
| `/v1/keys/validate` | 10 requests/minute |
| `/v1/keys/issue` | 5 requests/minute |

> **Removed endpoints:** `/v2/auth/minibob/signin` and `/v2/auth/apikey` on activity-api are removed. Rate-limiting now applies to identity-vessel endpoints only.

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
cd repos/activity-api
bun run sql/migrate.ts

# Analysis vessel schemas (formerly metabob-analysis-api)
cd repos/analysis-vessel
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

# 1. Validate API key via identity-vessel
VALIDATION=$(curl -s -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d '{"api_key": "'$API_KEY'"}')

echo "Valid: $(echo $VALIDATION | jq -r '.data.valid')"
echo "Org:   $(echo $VALIDATION | jq -r '.data.org_id')"

# 2. Test data access with the API key directly
curl -s -H "Authorization: ApiKey $API_KEY" \
  http://api.minibob.local/v2/activities/templates | jq '.templates | length'
```

> **Removed pattern:** activity-api no longer issues tokens via `/v2/auth/apikey`. Pass the HMAC API key directly as `Authorization: ApiKey <key>` to activity-api; identity-vessel validates it internally.

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
