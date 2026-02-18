# Quick Start: V2 Template Testing

**Ready for**: Integration testing once auth is configured

---

## Prerequisites Checklist

- [x] Backend running on `localhost:8080`
- [x] V2 endpoints available (`/v2/activities/templates`)
- [x] CLI updated to use proto schema
- [x] ActivityManager updated to v2 endpoint
- [ ] Valid API key created in SurrealDB
- [ ] Session token obtained

---

## Step 1: Verify Backend is Running

```bash
curl http://localhost:8080/
# Expected: {"status":"ok","message":"Metabob RPC API is running"}

curl http://localhost:8080/docs
# Expected: OpenAPI documentation HTML
```

---

## Step 2: Create API Key (One-Time Setup)

### Option A: Using SurrealDB SQL (Recommended)

```bash
# Connect to SurrealDB
docker exec -it metabob-surreal /surreal sql \
  --endpoint http://localhost:8000 \
  --username root \
  --password root \
  --namespace metabob \
  --database devbob

# In SQL prompt:
CREATE organization:exp-repo SET
  org_id = 'exp-repo',
  name = 'Experimental Repository',
  plan = 'free',
  created_at = time::now(),
  updated_at = time::now();

CREATE user:test-user SET
  user_id = 'test-user',
  org_id = 'exp-repo',
  email = 'test@example.com',
  name = 'Test User',
  role = 'owner',
  created_at = time::now();

# Generate API key (replace with your own random string)
LET $raw_key = 'mb_test_YOUR_RANDOM_STRING_HERE';
LET $key_hash = crypto::sha256($raw_key);

CREATE apikey:test-key SET
  key_id = 'apikey:test-key',
  org_id = 'exp-repo',
  user_id = 'test-user',
  name = 'Test API Key',
  key_hash = $key_hash,
  scopes = ['read', 'write'],
  status = 'active',
  created_at = time::now(),
  last_used_at = time::now();
```

Save the `$raw_key` value - you'll need it in Step 3.

### Option B: Using Python Script (if fixed)

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
python test_create_api_key_direct.py
# Save the API key from output
```

---

## Step 3: Create Session

```bash
export METABOB_API_KEY="mb_test_YOUR_RANDOM_STRING_HERE"

curl -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "exp-repo-dev"}' | jq .

# Expected output:
# {
#   "session_token": "c2Vzc2lvbnM6Li4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4=",
#   "session_id": "...",
#   "project_id": "exp-repo-dev",
#   "organization": "exp-repo",
#   "expires_at": "2026-02-12T..."
# }

export SESSION_TOKEN="<session_token from above>"
```

---

## Step 4: Test Template Registration

### Using Direct API Test

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
python test_register_v2.py
# Should now succeed with the session token
```

### Using CLI Command

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli

# Set environment for CLI
export METABOB_API_URL="http://localhost:8080"
export METABOB_PROJECT_ID="exp-repo-dev"
export METABOB_SESSION_TOKEN="$SESSION_TOKEN"

# Register template
python -m metabob_cli.commands register-template \
  ../../test-template-simple.json \
  --base-url http://localhost:8080

# Expected output:
# Successfully registered template: test-simple-feature
#   Template ID: <generated-id>
#   Category: feature
#   Tasks: 2
#   ✓ Template verified in backend
```

---

## Step 5: Verify Template in Backend

```bash
curl -H "Authorization: Bearer $SESSION_TOKEN" \
  http://localhost:8080/v2/activities/templates | jq .

# Should list all templates including the one just registered
```

---

## Step 6: Test Template Search

### Using CLI MCP Tool

```bash
# In OpenCode session with metabob-cli MCP server running:
search_activities({ verbose: true })

# Should return templates including:
# - test-simple-feature (just registered)
# - Built-in templates (add-feature-complete, fix-bug-complete, etc.)
```

### Using Direct API

```bash
curl -H "Authorization: Bearer $SESSION_TOKEN" \
  "http://localhost:8080/v2/activities/search?category=feature" | jq .
```

---

## Step 7: Test Activity Execution (Optional)

```bash
# In OpenCode session:
activity({
  activityId: "test-simple-feature",
  variables: {
    feature_name: "User Authentication"
  },
  reason: "Test template execution with v2 endpoint"
})

# Verify:
# 1. Activity uses v2 endpoint
# 2. Proto schema is sent correctly
# 3. Tasks execute in order
# 4. Lifecycle hooks work (temp dir, cleanup, etc.)
```

---

## Troubleshooting

### Issue: 401 Unauthorized

**Cause**: Session token expired or invalid

**Fix**:
```bash
# Create new session (Step 3)
curl -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "exp-repo-dev"}'
```

### Issue: 404 Not Found on /v2/activities/templates

**Cause**: Backend not running or old image

**Fix**:
```bash
# Check backend status
docker ps | grep api-server

# Should see: api-server-dev-new (not api-server-dev)
# If old container, rebuild:
cd /home/avi/documents/work/exp-repo/metabob-devbob
docker-compose build metabob-rpc-api-server
docker-compose up -d metabob-rpc-api-server
```

### Issue: Invalid API Key

**Cause**: API key not in database or hash mismatch

**Fix**: Re-create API key (Step 2) and ensure:
- Hash is computed correctly: `crypto::sha256($raw_key)`
- Organization and user exist
- Key status is 'active'

### Issue: Template already exists (409)

**Cause**: Template name already registered

**Fix**:
```bash
# Delete existing template:
curl -X DELETE \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  http://localhost:8080/v2/activities/templates/<template-id>

# Or change template name in test-template-simple.json
```

---

## Files Reference

### Test Files
- `test-template-simple.json` - Simple test template
- `test_register_v2.py` - Direct API registration test

### Modified Files
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` (line 998)
- `repos/metabob-cli/src/metabob_cli/commands.py` (lines 1115-1186)

### Documentation
- `V2_API_STANDARDS.md` - Complete v2 schema reference
- `V2_MIGRATION_COMPLETE.md` - Migration details
- `SESSION_SUMMARY_V2_MIGRATION_COMPLETE.md` - Session summary

---

## Success Criteria

✅ Session created successfully  
✅ Template registered via CLI  
✅ Template verified in backend  
✅ Template searchable via search_activities  
✅ Template executable via activity tool  
✅ Lifecycle hooks work (temp dir, cleanup, error handling)

Once all criteria pass, the v2 migration is fully validated!
