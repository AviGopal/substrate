# Metabob-CLI V2 Migration - Quick Start Guide

**TL;DR**: Test that metabob-cli uses v2 endpoints correctly and database records are created properly.

## Quick Test (5 minutes)

### 1. Prerequisites Check
```bash
# Check backend is running
curl http://localhost:8080/health

# Expected: {"status":"ok",...}
```

### 2. Test Session Creation
```bash
# Create a session (get Bearer token)
curl -X POST http://localhost:8080/v2/session \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "org_id": "test-org",
    "project_id": "test-project",
    "agent_name": "test-agent",
    "session_type": "development"
  }'

# Expected: {"session_id": "...", "metadata": {"session_token": "..."}}
# Save the session_token for next steps
```

### 3. Test List Templates
```bash
# Replace <TOKEN> with session_token from step 2
curl http://localhost:8080/v2/activities/templates?limit=5 \
  -H "Authorization: Bearer <TOKEN>"

# Expected: {"templates": [...], "total": X, ...}
```

### 4. Test metabob-opencode Integration
```bash
# In one terminal: Start CLI MCP server
cd repos/metabob-cli
metabob-cli mcp

# In another terminal: Start OpenCode
cd repos/metabob-opencode
opencode

# In OpenCode prompt:
> search_activities({"query": "feature", "limit": 3})

# Expected: Returns list of 3 activities, no errors
```

## What to Verify

### ✅ Endpoints Work
- POST /v2/session → Creates session, returns token
- GET /v2/activities/templates → Lists templates
- POST /v2/activities/record/start → Records execution start
- POST /v2/activities/record/complete → Records execution completion

### ✅ Database Records Created
```sql
-- In SurrealDB (http://localhost:8000)
SELECT * FROM session ORDER BY created_at DESC LIMIT 5;
SELECT * FROM impression ORDER BY created_at DESC LIMIT 5;
SELECT * FROM conversion ORDER BY created_at DESC LIMIT 5;
```

### ✅ Authentication Works
- CLI uses Bearer tokens (not X-Internal-Request)
- Session creation requires X-API-Key
- All other endpoints require Bearer token

### ✅ OpenCode Integration
- search_activities() returns results
- activity() can execute templates
- No authentication errors

## Test Files

### Automated Test
```bash
python3 test_cli_v2_endpoints_comprehensive.py
```
Tests all 9 v2 endpoints + database verification.

### Full Test Suite
```bash
./run_v2_migration_tests.sh
```
Builds CLI, runs tests, generates report.

## API Key Setup

The backend requires a valid API key. Options:

### Option 1: Set in Environment
```bash
export METABOB_API_KEY="your-key-here"
```

### Option 2: Use Test Key (Dev Only)
Check `.env` file in `repos/metabob-rpc-api`:
```bash
cat repos/metabob-rpc-api/.env | grep API_KEY
```

### Option 3: Disable Auth (Dev Only)
Edit `repos/metabob-rpc-api/server/routes/v2_session.py`:
```python
# Comment out API key validation (TEMPORARY!)
# if api_key != VALID_API_KEY:
#     raise HTTPException(...)
```

## Troubleshooting

### "Invalid API key"
- Set correct API key in environment
- Check `.env` file in backend
- Use X-API-Key header (not Authorization)

### "Connection refused"
- Backend not running: `docker ps | grep metabob-rpc-api`
- Start with: `cd repos/metabob-rpc-api && docker-compose up`

### "Template not found"
- Database empty, need to seed templates
- Use POST /v2/activities/templates to create test template

### OpenCode can't find activities
- CLI MCP server not running
- Check `opencode.json` metabob configuration
- Verify Bearer token is being passed

## Success Indicators

✅ **All green checkmarks in test output**  
✅ **Database records visible in SurrealDB**  
✅ **OpenCode can search and execute activities**  
✅ **No X-Internal-Request headers in logs**  
✅ **Bearer authentication works**

## Next Steps

1. Run automated tests
2. Verify database records
3. Test OpenCode integration manually
4. Review test report
5. Deploy if all tests pass

## Full Documentation

- **Detailed Test Plan**: `V2_ENDPOINT_TEST_PLAN.md`
- **Migration Summary**: `CLI_V2_MIGRATION_COMPLETE.md`
- **Backend Routes**: `repos/metabob-rpc-api/server/routes/v2_activities.py`
- **CLI Manager**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

---

**Need help?** Check the full test plan or review backend logs:
```bash
docker logs metabob-rpc-api-server-dev-1 | tail -100
```
