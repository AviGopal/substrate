# Cross-Instance Storage Verification Checklist

Use this checklist to verify that cross-instance storage is working correctly in your environment.

---

## 1. Infrastructure Verification

### SurrealDB
```bash
# Check if SurrealDB is running
docker ps | grep surrealdb
# Expected: Container running on port 8000

# Test SurrealDB connectivity
curl -X POST http://localhost:8000/sql \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  -d "INFO FOR DB"
# Expected: JSON response with database info
```
- [ ] SurrealDB container is running
- [ ] Port 8000 is accessible
- [ ] Database "devbob" exists in namespace "metabob"

### Metabob-RPC-API
```bash
# Check if RPC API is running
docker ps | grep metabob-api
# Expected: Container running on port 8080

# Test health endpoint
curl http://localhost:8080/health
# Expected: {"status": "healthy"}

# Test impulse endpoint (should fail without auth, but 401 means it's working)
curl -v http://localhost:8080/v2/impulses \
  -H "Content-Type: application/json"
# Expected: 401 or 400 (endpoint exists, auth required)
```
- [ ] Metabob-RPC-API container is running
- [ ] Port 8080 is accessible
- [ ] Health endpoint responds
- [ ] API endpoints exist (even if auth fails)

### Metabob-CLI
```bash
# Check if metabob-cli is installed
which metabob-cli
# Expected: Path to metabob-cli binary

# Check MCP server status
ps aux | grep "metabob-cli.*mcp"
# Expected: MCP server process running

# List available MCP tools
metabob-cli mcp list-tools | grep impulse
# Expected: metabob_impulse_store, metabob_impulse_load, metabob_impulse_list
```
- [ ] metabob-cli is installed
- [ ] MCP server is running
- [ ] Impulse and activity tools are available

---

## 2. Configuration Verification

### API Key
```bash
# Check environment variable
echo $METABOB_API_KEY
# Expected: Non-empty string (e.g., "mb_devbob_test_simple_2026_v2")

# Or check config file
cat ~/.metabob-config.json | grep metabob_api_key
# Expected: "metabob_api_key": "your-api-key"
```
- [ ] METABOB_API_KEY is set (environment or config)
- [ ] API key matches across all vessels in same org

### Project ID
```bash
# Check environment variable
echo $METABOB_PROJECT_ID
# Expected: Unique project identifier (not "default-project")

# Generate recommended project ID
RECOMMENDED="$(basename $(git rev-parse --show-toplevel))-$(git rev-parse HEAD | head -c 12)"
echo "Recommended: $RECOMMENDED"
echo "Current: $METABOB_PROJECT_ID"
```
- [ ] METABOB_PROJECT_ID is set explicitly
- [ ] Project ID is unique and descriptive
- [ ] Same project ID across vessels in same project

### Base URL
```bash
# Check config
cat ~/.metabob-config.json | grep metabob_url
# Expected: "metabob_url": "http://localhost:8080"
```
- [ ] metabob_url points to correct RPC API instance

---

## 3. Functional Verification

### Test 1: Store Impulse
```bash
# Store a test impulse
TEST_IMPULSE_ID="verify-$(date +%s)"

metabob-cli mcp call metabob_impulse_store \
  --impulse_id "$TEST_IMPULSE_ID" \
  --project_id "$METABOB_PROJECT_ID" \
  --impulse_data '{
    "id": "'$TEST_IMPULSE_ID'",
    "type": "memo",
    "pointer": {"type": "memo", "content": "Verification test"},
    "budget": 1000
  }'

# Expected output:
# {
#   "status": "success",
#   "impulse_id": "verify-1234567890",
#   "created_at": "2026-02-27T...",
#   "message": "Impulse stored in backend - accessible from any instance"
# }
```
- [ ] metabob_impulse_store succeeds
- [ ] Returns "status": "success"
- [ ] Returns created_at timestamp

### Test 2: Load Impulse
```bash
# Load the test impulse
metabob-cli mcp call metabob_impulse_load \
  --impulse_id "$TEST_IMPULSE_ID" \
  --project_id "$METABOB_PROJECT_ID"

# Expected output:
# {
#   "status": "success",
#   "impulse_id": "verify-1234567890",
#   "impulse_data": {
#     "id": "verify-1234567890",
#     "type": "memo",
#     "pointer": {"type": "memo", "content": "Verification test"},
#     "budget": 1000
#   },
#   "created_at": "...",
#   "updated_at": "..."
# }
```
- [ ] metabob_impulse_load succeeds
- [ ] Returns exact data that was stored
- [ ] impulse_data.pointer.content matches "Verification test"

### Test 3: List Impulses
```bash
# List all impulses for project
metabob-cli mcp call metabob_impulse_list \
  --project_id "$METABOB_PROJECT_ID" \
  --limit 10

# Expected output:
# {
#   "status": "success",
#   "impulses": [
#     { "impulse_id": "verify-1234567890", ... },
#     ...
#   ],
#   "total": 1,
#   "limit": 10
# }
```
- [ ] metabob_impulse_list succeeds
- [ ] Returns list containing test impulse
- [ ] total >= 1

### Test 4: Activity Storage
```bash
# Store a test activity
TEST_ACTIVITY_ID="act_verify_$(date +%s)"

metabob-cli mcp call metabob_activity_save \
  --activity_id "$TEST_ACTIVITY_ID" \
  --project_id "$METABOB_PROJECT_ID" \
  --activity_data '{
    "id": "'$TEST_ACTIVITY_ID'",
    "template": "test-template",
    "status": "done",
    "tasks": [{"id": "task-1", "status": "done"}],
    "impulses": {},
    "metrics": {"cost": 0.01, "duration": 1000}
  }'

# Expected output:
# {
#   "status": "success",
#   "activity_id": "act_verify_1234567890",
#   "created_at": "...",
#   "message": "Activity stored in backend - accessible from any instance"
# }
```
- [ ] metabob_activity_save succeeds
- [ ] Returns "status": "success"

### Test 5: Activity Retrieval
```bash
# Load the test activity
metabob-cli mcp call metabob_activity_load \
  --activity_id "$TEST_ACTIVITY_ID" \
  --project_id "$METABOB_PROJECT_ID"

# Expected output:
# {
#   "status": "success",
#   "activity_id": "act_verify_1234567890",
#   "activity_data": {
#     "id": "act_verify_1234567890",
#     "template": "test-template",
#     "status": "done",
#     ...
#   }
# }
```
- [ ] metabob_activity_load succeeds
- [ ] Returns exact activity data that was stored
- [ ] activity_data.status matches "done"

---

## 4. Cross-Instance Verification

### Setup: Two Vessels
```bash
# Terminal 1: Vessel A (repos/metabob-cli)
cd /path/to/metabob-devbob/repos/metabob-cli
export METABOB_API_KEY="mb_test_cross"
export METABOB_PROJECT_ID="cross-test-$(date +%s)"

# Terminal 2: Vessel B (repos/metabob-opencode)
cd /path/to/metabob-devbob/repos/metabob-opencode
export METABOB_API_KEY="mb_test_cross"  # SAME
export METABOB_PROJECT_ID="cross-test-1234567890"  # SAME (copy from Terminal 1)
```

### Test: Store from A, Load from B
```bash
# Terminal 1 (Vessel A): Store
CROSS_TEST_ID="cross-$(date +%s)"
metabob-cli mcp call metabob_impulse_store \
  --impulse_id "$CROSS_TEST_ID" \
  --project_id "$METABOB_PROJECT_ID" \
  --impulse_data '{
    "id": "'$CROSS_TEST_ID'",
    "type": "memo",
    "pointer": {"type": "memo", "content": "Cross-instance test from Vessel A"},
    "budget": 1000
  }'

# Terminal 2 (Vessel B): Load
metabob-cli mcp call metabob_impulse_load \
  --impulse_id "$CROSS_TEST_ID" \
  --project_id "$METABOB_PROJECT_ID"

# Expected: Vessel B retrieves data stored by Vessel A
```
- [ ] Vessel A stores impulse successfully
- [ ] Vessel B loads impulse successfully
- [ ] Content matches: "Cross-instance test from Vessel A"

---

## 5. Isolation Verification

### Test: Different API Keys
```bash
# Terminal 1: Org A
export METABOB_API_KEY="mb_org_a_$(date +%s)"
export METABOB_PROJECT_ID="isolated-test"

ISOLATED_TEST_ID="isolated-$(date +%s)"
metabob-cli mcp call metabob_impulse_store \
  --impulse_id "$ISOLATED_TEST_ID" \
  --project_id "$METABOB_PROJECT_ID" \
  --impulse_data '{"id":"'$ISOLATED_TEST_ID'","type":"memo","pointer":{"type":"memo","content":"Org A secret"},"budget":1000}'

# Terminal 2: Org B (different API key)
export METABOB_API_KEY="mb_org_b_$(date +%s)"  # DIFFERENT
export METABOB_PROJECT_ID="isolated-test"      # SAME project name

# Try to load Org A's impulse
metabob-cli mcp call metabob_impulse_load \
  --impulse_id "$ISOLATED_TEST_ID" \
  --project_id "$METABOB_PROJECT_ID"

# Expected: {"status": "not_found", "error": "...not found or access denied"}
```
- [ ] Org A stores impulse successfully
- [ ] Org B receives "not_found" or "access denied"
- [ ] Multi-tenant isolation is enforced

### Test: Different Project IDs
```bash
# Same API key, different project IDs
export METABOB_API_KEY="mb_shared_key"

# Project A
export METABOB_PROJECT_ID="project-a"
PROJECT_A_IMPULSE="project-a-data-$(date +%s)"
metabob-cli mcp call metabob_impulse_store \
  --impulse_id "$PROJECT_A_IMPULSE" \
  --project_id "$METABOB_PROJECT_ID" \
  --impulse_data '{"id":"'$PROJECT_A_IMPULSE'","type":"memo","pointer":{"type":"memo","content":"Project A data"},"budget":1000}'

# Project B (try to access Project A's data)
export METABOB_PROJECT_ID="project-b"  # DIFFERENT
metabob-cli mcp call metabob_impulse_load \
  --impulse_id "$PROJECT_A_IMPULSE" \
  --project_id "$METABOB_PROJECT_ID"

# Expected: {"status": "not_found", "error": "...not found or access denied"}
```
- [ ] Project A stores impulse successfully
- [ ] Project B receives "not_found" when accessing with different project_id
- [ ] Project-level isolation is enforced

---

## 6. Database Verification

### Direct SurrealDB Query
```bash
# Query impulse_data table
curl -X POST http://localhost:8000/sql \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  -d "SELECT * FROM impulse_data LIMIT 5"

# Expected: JSON array with impulse records
```
- [ ] impulse_data table exists
- [ ] Records have api_key, project_id, impulse_id fields
- [ ] impulse_data field contains full impulse object

```bash
# Query activity_data table
curl -X POST http://localhost:8000/sql \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  -d "SELECT * FROM activity_data LIMIT 5"

# Expected: JSON array with activity records
```
- [ ] activity_data table exists
- [ ] Records have api_key, project_id, activity_id fields
- [ ] activity_data field contains full activity object

---

## 7. Performance Verification

### Response Times
```bash
# Measure impulse store time
time metabob-cli mcp call metabob_impulse_store \
  --impulse_id "perf-test-$(date +%s)" \
  --project_id "$METABOB_PROJECT_ID" \
  --impulse_data '{"id":"perf-test","type":"memo","pointer":{"type":"memo","content":"Performance test"},"budget":1000}'

# Expected: < 1 second
```
- [ ] Impulse store completes in < 1 second
- [ ] Impulse load completes in < 1 second
- [ ] Activity save completes in < 2 seconds

### Concurrent Operations
```bash
# Store 10 impulses concurrently
for i in {1..10}; do
  (metabob-cli mcp call metabob_impulse_store \
    --impulse_id "concurrent-$i-$(date +%s)" \
    --project_id "$METABOB_PROJECT_ID" \
    --impulse_data '{"id":"concurrent-'$i'","type":"memo","pointer":{"type":"memo","content":"Concurrent test '$i'"},"budget":1000}' &)
done
wait

# Expected: All succeed, no errors
```
- [ ] All concurrent stores succeed
- [ ] No race conditions or deadlocks
- [ ] Data integrity maintained

---

## 8. Error Handling Verification

### Missing API Key
```bash
# Unset API key
unset METABOB_API_KEY

metabob-cli mcp call metabob_impulse_store \
  --impulse_id "error-test" \
  --project_id "$METABOB_PROJECT_ID" \
  --impulse_data '{"id":"error-test","type":"memo","pointer":{"type":"memo","content":"Test"},"budget":1000}'

# Expected: {"status": "error", "error": "Missing metabob_api_key in configuration"}
```
- [ ] Graceful error message
- [ ] No crash or exception

### Missing Project ID
```bash
# Unset project ID
unset METABOB_PROJECT_ID

# Expected: Uses "default-project" or returns error
```
- [ ] Defaults to "default-project" (warning) or returns error

### Invalid API Key
```bash
export METABOB_API_KEY="invalid_key_12345"

metabob-cli mcp call metabob_impulse_list \
  --project_id "$METABOB_PROJECT_ID" \
  --limit 10

# Expected: Empty list or 401 error (depending on backend validation)
```
- [ ] Graceful error handling
- [ ] Clear error message

---

## Summary Checklist

### Infrastructure
- [ ] SurrealDB running and accessible
- [ ] Metabob-RPC-API running and healthy
- [ ] Metabob-CLI MCP server running

### Configuration
- [ ] METABOB_API_KEY set correctly
- [ ] METABOB_PROJECT_ID set explicitly
- [ ] Same config across vessels in same project

### Functionality
- [ ] Impulse store/load/list works
- [ ] Activity save/load works
- [ ] Cross-instance access works
- [ ] Multi-tenant isolation enforced
- [ ] Project-level isolation enforced

### Performance
- [ ] Operations complete in < 1-2 seconds
- [ ] Concurrent operations succeed
- [ ] No race conditions

### Error Handling
- [ ] Graceful error messages
- [ ] No crashes on invalid input

---

## If Any Checks Fail

1. **Infrastructure Issues:**
   - Restart Docker containers: `docker-compose restart`
   - Check logs: `docker logs <container-name>`

2. **Configuration Issues:**
   - Verify environment variables: `env | grep METABOB`
   - Check config file: `cat ~/.metabob-config.json`

3. **Connectivity Issues:**
   - Test network: `curl http://localhost:8080/health`
   - Check firewall rules

4. **Data Issues:**
   - Query SurrealDB directly
   - Check table schemas: `INFO FOR TABLE impulse_data`

---

**Verification Date:** ___________  
**Verified By:** ___________  
**Environment:** [ ] Local [ ] Dev [ ] Staging [ ] Production  
**Overall Status:** [ ] PASS [ ] FAIL

**Notes:**
_____________________________________________________________________
_____________________________________________________________________
_____________________________________________________________________
