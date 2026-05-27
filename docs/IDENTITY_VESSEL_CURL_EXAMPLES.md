# Identity Vessel - Quick Reference (curl Examples)

**Quick reference for testing identity-vessel endpoints.**

## Base URLs

- **Canary/Production:** `https://identity.metabob.com`
- **Local (if running):** `http://localhost:8080`

---

## Health Check

```bash
curl https://identity.metabob.com/health | jq
```

**Expected Response:**
```json
{
  "status": "ok",
  "service": "identity-vessel",
  "version": "0.1.0",
  "timestamp": "2026-04-08T20:35:22.863Z"
}
```

---

## Generate API Key

> **Current key format:** `mb_<env>-<org>-<user>-<keyid>-<HMAC-SHA256>` (e.g. `mb_canary-orgabc-userabc-key01-a1b2c3d4...`). The example response below shows an older base64 blob form — actual issued keys follow the HMAC format. The generate endpoint is admin-only (`/v1/keys/issue`); the examples below use the older `/v1/keys/generate` path for illustration.

```bash
curl -X POST https://identity.metabob.com/v1/keys/generate \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "test_org",
    "user_id": "test_user",
    "name": "My Test Key",
    "scopes": ["read", "write"],
    "expires_in_days": 30
  }' | jq
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "key": "bWJfdGVzdC10ZXN0X29yZy10ZXN0X3VzZXIta2V5X2FiY2RlZmdoaWprbG1ub3AtYTFiMmMzZDRlNWY2ZzdoOGk5ajBrMWwybTNuNA",
    "key_id": "key_abcdefghijklmnop",
    "prefix": "mb_test",
    "expires_at": "2026-05-08T20:35:22.863Z",
    "metadata": {
      "id": "key_abcdefghijklmnop",
      "org_id": "test_org",
      "user_id": "test_user",
      "key_prefix": "mb_test",
      "name": "My Test Key",
      "scopes": ["read", "write"],
      "created_at": "2026-04-08T20:35:22.863Z",
      "expires_at": "2026-05-08T20:35:22.863Z",
      "is_active": true,
      "usage_count": 0
    }
  }
}
```

**Save the API key for testing:**
```bash
API_KEY=$(curl -s -X POST https://identity.metabob.com/v1/keys/generate \
  -H "Content-Type: application/json" \
  -d '{"org_id":"test_org","user_id":"test_user"}' | jq -r '.data.key')

echo "Generated API Key: $API_KEY"
```

---

## Validate API Key

### Valid Key

```bash
curl -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d "{
    \"api_key\": \"$API_KEY\"
  }" | jq
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "org_id": "test_org",
    "user_id": "test_user",
    "key_id": "key_abcdefghijklmnop",
    "scopes": ["read", "write"],
    "role": "user"
  }
}
```

### Invalid Key (Malformed)

```bash
curl -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "invalid-key"
  }' | jq
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "valid": false,
    "error": "Invalid API key format"
  }
}
```

### Invalid Key (Tampered Signature)

```bash
curl -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "bWJfdGVzdC10ZXN0X29yZy10ZXN0X3VzZXIta2V5X2FiY2RlZmdoaWprbG1ub3AtdGFtcGVyZWQxMjM0NTY3ODkwMTIzNDU2Nzg5MDEy"
  }' | jq
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "valid": false,
    "error": "Invalid API key signature"
  }
}
```

---

## Revoke API Key

### Revoke by key_id

```bash
KEY_ID=$(curl -s -X POST https://identity.metabob.com/v1/keys/generate \
  -H "Content-Type: application/json" \
  -d '{"org_id":"test_org","user_id":"test_user"}' | jq -r '.data.key_id')

curl -X POST https://identity.metabob.com/v1/keys/revoke \
  -H "Content-Type: application/json" \
  -d "{
    \"key_id\": \"$KEY_ID\"
  }" | jq
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "revoked": true,
    "key_id": "key_abcdefghijklmnop"
  }
}
```

### Revoke by api_key

```bash
curl -X POST https://identity.metabob.com/v1/keys/revoke \
  -H "Content-Type: application/json" \
  -d "{
    \"api_key\": \"$API_KEY\"
  }" | jq
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "revoked": true,
    "key_id": "key_abcdefghijklmnop"
  }
}
```

### Validate Revoked Key

```bash
curl -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d "{
    \"api_key\": \"$API_KEY\"
  }" | jq
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "valid": false,
    "error": "API key has been revoked"
  }
}
```

---

## Auth Resolve (service-to-service)

Idiomatic vessels validate incoming credentials by calling identity-vessel's resolver:

```bash
curl -X POST https://identity.metabob.com/v1/auth/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "impulse": {
      "type": "authentication",
      "pointer": { "type": "apiKey", "value": "'$API_KEY'" }
    }
  }' | jq
```

**Expected Response:**
```json
{
  "authenticated": true,
  "orgId": "organizations:acme",
  "userId": "users:alice",
  "keyId": "key_abcdefghijklmnop",
  "scopes": ["read", "write"]
}
```

> **Removed endpoints (do not use):**
> - `POST /v1/auth/minibob/signin` — the `minibob_record` ACCESS pattern is removed
> - `POST /v2/auth/minibob/signin` — same
>
> Vessel-to-vessel auth now uses a plain HMAC API key (`mb_<env>-<org>-<user>-<keyid>-<hmac>`) passed as `Authorization: ApiKey <key>`. The key is validated by the receiving vessel via `POST /v1/auth/resolve`.

---

## Complete Workflow Example

```bash
#!/bin/bash

echo "=== Identity Vessel API Key Workflow ==="
echo

# 1. Generate API key
echo "1. Generating API key..."
RESPONSE=$(curl -s -X POST https://identity.metabob.com/v1/keys/generate \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "demo_org",
    "user_id": "demo_user",
    "name": "Demo Key"
  }')

API_KEY=$(echo "$RESPONSE" | jq -r '.data.key')
KEY_ID=$(echo "$RESPONSE" | jq -r '.data.key_id')

echo "Generated key: $KEY_ID"
echo

# 2. Validate the key
echo "2. Validating API key..."
VALIDATION=$(curl -s -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d "{\"api_key\": \"$API_KEY\"}")

echo "$VALIDATION" | jq
echo

VALID=$(echo "$VALIDATION" | jq -r '.data.valid')
ORG_ID=$(echo "$VALIDATION" | jq -r '.data.org_id')

if [ "$VALID" = "true" ]; then
  echo "✓ Key is valid for org: $ORG_ID"
else
  echo "✗ Key is invalid"
  exit 1
fi
echo

# 3. Use the key (simulate making authenticated requests)
echo "3. Using key for authenticated request..."
echo "   Authorization: Bearer $API_KEY"
echo "   Org ID: $ORG_ID"
echo

# 4. Revoke the key
echo "4. Revoking API key..."
curl -s -X POST https://identity.metabob.com/v1/keys/revoke \
  -H "Content-Type: application/json" \
  -d "{\"key_id\": \"$KEY_ID\"}" | jq
echo

# 5. Verify revocation
echo "5. Verifying key is revoked..."
REVOKE_CHECK=$(curl -s -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d "{\"api_key\": \"$API_KEY\"}")

echo "$REVOKE_CHECK" | jq
echo

STILL_VALID=$(echo "$REVOKE_CHECK" | jq -r '.data.valid')
if [ "$STILL_VALID" = "false" ]; then
  echo "✓ Key successfully revoked"
else
  echo "✗ Key is still valid (unexpected)"
  exit 1
fi

echo
echo "=== Workflow Complete ==="
```

**Save as `test-workflow.sh` and run:**
```bash
chmod +x test-workflow.sh
./test-workflow.sh
```

---

## Performance Testing

### Single Request Timing

```bash
time curl -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d "{\"api_key\": \"$API_KEY\"}" -o /dev/null -s
```

### Load Testing (100 requests)

```bash
#!/bin/bash

# Generate a test key
API_KEY=$(curl -s -X POST https://identity.metabob.com/v1/keys/generate \
  -H "Content-Type: application/json" \
  -d '{"org_id":"load_test","user_id":"load_user"}' | jq -r '.data.key')

echo "Running 100 validation requests..."
START=$(date +%s%N)

for i in {1..100}; do
  curl -s -X POST https://identity.metabob.com/v1/keys/validate \
    -H "Content-Type: application/json" \
    -d "{\"api_key\": \"$API_KEY\"}" > /dev/null &
done

wait

END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))
AVG=$(( DURATION / 100 ))

echo "Total time: ${DURATION}ms"
echo "Average per request: ${AVG}ms"
```

### Using Apache Bench

```bash
# Generate a test key first
API_KEY=$(curl -s -X POST https://identity.metabob.com/v1/keys/generate \
  -H "Content-Type: application/json" \
  -d '{"org_id":"bench_test","user_id":"bench_user"}' | jq -r '.data.key')

# Create request body file
echo "{\"api_key\": \"$API_KEY\"}" > validate_request.json

# Run 100 requests with 10 concurrent
ab -n 100 -c 10 -p validate_request.json -T application/json \
  https://identity.metabob.com/v1/keys/validate
```

---

## Error Cases

### Missing api_key Field

```bash
curl -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Required field missing: api_key"
  }
}
```

### Invalid JSON

```bash
curl -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d 'not valid json' | jq
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid JSON in request body"
  }
}
```

---

## Tips

### Pretty Print with jq

Always pipe to `jq` for readable output:
```bash
curl ... | jq
```

### Save Response to File

```bash
curl ... | jq > response.json
```

### Extract Specific Fields

```bash
# Get just the org_id
curl ... | jq -r '.data.org_id'

# Get just the valid status
curl ... | jq -r '.data.valid'
```

### Using Variables

```bash
# Store base URL
ENDPOINT="https://identity.metabob.com"

# Generate key
API_KEY=$(curl -s -X POST $ENDPOINT/v1/keys/generate \
  -H "Content-Type: application/json" \
  -d '{"org_id":"test","user_id":"user"}' | jq -r '.data.key')

# Validate key
curl -X POST $ENDPOINT/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d "{\"api_key\": \"$API_KEY\"}" | jq
```

### Debug Mode

Add `-v` flag to see full request/response headers:
```bash
curl -v -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d "{\"api_key\": \"$API_KEY\"}"
```

---

## Common Patterns

### Check if Service is Running

```bash
if curl -s https://identity.metabob.com/health | jq -e '.status == "ok"' > /dev/null; then
  echo "Service is healthy"
else
  echo "Service is down or unhealthy"
fi
```

### Validate Key and Extract org_id

```bash
ORG_ID=$(curl -s -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d "{\"api_key\": \"$API_KEY\"}" | jq -r '.data.org_id')

if [ "$ORG_ID" != "null" ]; then
  echo "Authenticated as org: $ORG_ID"
else
  echo "Invalid API key"
fi
```

### Check if Key is Valid

```bash
VALID=$(curl -s -X POST https://identity.metabob.com/v1/keys/validate \
  -H "Content-Type: application/json" \
  -d "{\"api_key\": \"$API_KEY\"}" | jq -r '.data.valid')

if [ "$VALID" = "true" ]; then
  echo "Key is valid"
else
  ERROR=$(curl -s -X POST https://identity.metabob.com/v1/keys/validate \
    -H "Content-Type: application/json" \
    -d "{\"api_key\": \"$API_KEY\"}" | jq -r '.data.error')
  echo "Key is invalid: $ERROR"
fi
```
