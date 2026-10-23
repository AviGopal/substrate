# RBAC Troubleshooting Guide

This guide helps diagnose and resolve common RBAC-related issues across the vessel fleet.

Every diagnosis here runs with the caller's own credential. Root credentials bypass
PERMISSIONS, so a root session cannot show what a caller sees, and a fix made through one
is a hand-edit of the database. Schema and data repairs land as migrations in the vessel
that owns the table ([SCHEMA_OWNERSHIP.md](SCHEMA_OWNERSHIP.md)) and apply when its unit
starts.

## Quick Diagnostics

### Check Authentication Status

```bash
# Test API health
curl http://localhost:18080/health

# Test with JWT
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:18080/v2/activities/templates

# Verify JWT claims — decode locally (no dedicated verify endpoint)
echo $JWT_TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .
```

### Check Data Access as the Caller

```bash
# With an API key, the default template list comes from a catalogue that
# activity-api reads on its own connection and filters by organisation in
# application code, so this count shows that filter, not PERMISSIONS.
curl -s -H "Authorization: ApiKey $API_KEY" \
  http://localhost:18080/v2/activities/templates | jq '.templates | length'
# A user JWT's reads run under the caller's own credential; read with that
# token to see what PERMISSIONS let the caller see.
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
# Dashboard / JWT login (identity-vessel, at its fleet address)
curl -X POST http://localhost:18101/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "..."}'

# API key validation (used by service-to-service callers)
curl -X POST http://localhost:18101/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d '{"api_key": "mb_env-org-user-keyid-hmac"}'
```

#### B. Wrong JWT Secret

The JWT secret must match between token issuer and validator.

**Check:** Verify SurrealDB is using consistent signing key.

#### C. ACCESS Definition Missing

```surql
-- Check if access method exists
INFO FOR DB;

-- Should show:
-- accesses: { apikey_token: ... }
-- (the one JWT access method both in-fleet signers issue against; see RBAC_GUIDE.md)
```

**Fix:** Schema changes are migrations applied when the owning vessel's unit starts, so the
remedy is to restart that vessel rather than to run a migration tool by hand. See
[SCHEMA_OWNERSHIP.md](SCHEMA_OWNERSHIP.md) for which vessel owns which tables.
```bash
docker exec <container> vessel-ctl restart <vessel>
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
RETURN $token;

-- Check record's org_id
SELECT org_id FROM activity_template WHERE id = 'template:xxx';

-- Compare: does $token.org_id match the record's org_id?
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

```

**Fix:** a backfill is a data migration in the owning vessel, applied on unit start —
never an `UPDATE` typed into a live session.

#### C. PERMISSIONS Clause Too Restrictive

```surql
-- Check table permissions
INFO FOR TABLE activity_template;

-- Should show PERMISSIONS scoped on $token.org_id (see RBAC_GUIDE.md: $auth is NONE
-- under both in-fleet signers, so a clause on $auth.* filters everything out)
```

---

### 3. Goal-Host-Vessel Can't Execute Activities

**Symptoms:**
- The vessel starts but can't fetch templates
- "Authentication failed" in logs
- Boredom activities don't run

**Diagnosis (local substrate):**

```bash
# Check goal-host-vessel logs inside substrate container
docker exec <container> journalctl -u goal-host-vessel --lines=50

# Or check boredom-vessel
docker exec <container> journalctl -u boredom-vessel --lines=50
```

**Possible Causes:**

#### A. METABOB_API_KEY Not Set or Invalid

Substrate vessels authenticate to activity-api via an HMAC API key.
The key must be registered with identity-vessel.

```bash
# Check the key configured for the local substrate
cat ~/.metabob/config.json | jq .metabob.apiKey

# Validate it against identity-vessel (the validator; activity-api mounts only /v2/*)
curl -X POST http://localhost:18101/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d '{"api_key": "<your-key>"}'
```

If the key is not valid, re-emit the client configuration from the fleet with
`substrate-connect` (README § Installation), which prints a key that passes the
`seeded` check.

#### B. Activity-API Reachability

```bash
# From the host
curl http://localhost:18080/health

# From inside the container (goal-host-vessel uses this)
docker exec <container> curl http://localhost:8080/health
```

---

### 4. Empty Query Results

**Symptoms:**
- Queries return `[]` when data exists
- RBAC seems to filter out everything

**Diagnosis:**

An empty result under PERMISSIONS looks exactly like an empty table, so start from the
claims PERMISSIONS evaluate, not from a root count:

```bash
# The org and projects the caller's token carries
echo $JWT_TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq '{org_id, project_ids}'
```

If the claims name the wrong org, or none, the filtering is working as designed. Whether
the rows exist in another org is a question for a caller of that org, asked with that
caller's credential — not for root credentials, which bypass PERMISSIONS.

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
SELECT * FROM project_members WHERE user_id = $token.user_id;
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
curl -X POST http://localhost:18101/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d '{"api_key": "<your-key>"}'
```

**Possible Causes:**

#### A. Key Revoked

Use identity-vessel to check:
```bash
# key_id is the portion before the final HMAC segment
curl -X POST http://localhost:18101/v1/keys/validate \
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
| `/v1/auth/signup` | 5 requests/minute |
| `/v1/auth/password/hash`, `/v1/auth/password/verify` | 5 requests/minute |
| `/v1/keys/validate` | 100 requests/minute |
| `/v1/auth/resolve` | 100 requests/minute |

**Fix:** Wait 60 seconds and retry. If legitimate traffic, contact admin.

---

### 7. Schema Version Mismatch

**Symptoms:**
- "Table not found" errors
- Missing fields in responses
- PERMISSIONS clause errors

**Diagnosis:**

```surql
-- Check applied migrations (activity-api records each applied file here)
SELECT * FROM init_migrations;
```

**Fix:** Most schemas are migrations applied when the owning vessel's unit starts, so restarting
that vessel is the remedy; see [SCHEMA_OWNERSHIP.md](SCHEMA_OWNERSHIP.md) for which vessel owns
which tables. (activity-api's older `sql/migrate.ts` runner is not the substrate's schema
path; SCHEMA_OWNERSHIP says why.)

```bash
# Apply on unit start
docker exec <container> vessel-ctl restart <vessel>
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

-- If PERMISSIONS are missing, the repair is a migration in the owning vessel
-- (SCHEMA_OWNERSHIP.md), applied on unit start; it defines, for example:
DEFINE TABLE problematic_table SCHEMAFULL
  PERMISSIONS
    FOR select, create, update, delete WHERE org_id = $token.org_id;
```

#### B. Query Using Root Credentials

Application code may be using root credentials instead of user JWT.

**Audit:** Search for `username: 'root'` or `password:` in code.

#### C. org_id Field Missing

```surql
-- In a migration of the owning vessel, not a live session:
DEFINE FIELD org_id ON problematic_table TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $token.org_id;

-- Backfill existing records (same migration)
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

### 2. Test Authentication Flow

```bash
#!/bin/bash
# test-auth.sh

# 1. Validate API key via identity-vessel
VALIDATION=$(curl -s -X POST http://localhost:18101/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d '{"api_key": "'$API_KEY'"}')

echo "Valid: $(echo $VALIDATION | jq -r '.data.valid')"
echo "Org:   $(echo $VALIDATION | jq -r '.data.org_id')"

# 2. Test data access with the API key directly
curl -s -H "Authorization: ApiKey $API_KEY" \
  http://localhost:18080/v2/activities/templates | jq '.templates | length'
```

> **Removed pattern:** activity-api no longer issues tokens via `/v2/auth/apikey`. Pass the HMAC API key directly as `Authorization: ApiKey <key>` to activity-api; identity-vessel validates it internally.

### 3. Check Vessel Logs

```bash
# Activity API logs
docker exec <container> journalctl -u activity-api -f

# development-vessel logs
docker exec <container> journalctl -u development-vessel -f

# SurrealDB logs
docker exec <container> journalctl -u surrealdb -f
```

---

## Escalation Path

If unable to resolve:

1. **Collect diagnostics:**
   - Error message
   - JWT claims (decoded)
   - Table PERMISSIONS
   - `init_migrations` entries
   - Relevant logs

2. **Check documentation:**
   - [RBAC_GUIDE.md](RBAC_GUIDE.md)
   - [AUTH_JWT_CLAIMS.md](AUTH_JWT_CLAIMS.md)
   - [SCHEMA_OWNERSHIP.md](SCHEMA_OWNERSHIP.md)

3. **File issue:**
   - Include all diagnostics
   - Tag with `rbac` and `auth`
