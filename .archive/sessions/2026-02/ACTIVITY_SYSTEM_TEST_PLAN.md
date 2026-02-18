# Activity System Test Plan

**Date**: 2026-02-16  
**Status**: Ready for Execution  
**Prerequisites**: Docker Desktop running + healthy containers

---

## Test Execution Order

### Phase 1: Infrastructure Validation (5 min)
Verify all services are healthy and database has templates loaded.

### Phase 2: Activity Discovery (10 min)
Test search_activities from OpenCode CLI and MCP server.

### Phase 3: Activity Execution (15 min)
Execute an existing activity template end-to-end.

### Phase 4: Activity Creation (20 min)
Create a new activity template and verify registration.

### Phase 5: E2E Validation (10 min)
Execute the newly created activity template.

---

## Phase 1: Infrastructure Validation

```bash
# Start services
cd /home/avi/documents/work/exp-repo/metabob-devbob
docker compose -f configs/docker-compose.devbob.yaml up -d

# Wait for healthy (30 seconds)
sleep 30

# Check service health
docker compose -f configs/docker-compose.devbob.yaml ps

# Expected output:
# devbob-opencode          running
# redis                    running (healthy)
# surreal                  running
# metabob-rpc-api-server   running

# Verify database templates
docker exec -it devbob-opencode bash -c '
  cd /workspace/repos/metabob-rpc-api && \
  SURREAL_URL=ws://surreal:8000 \
  SURREAL_USER=root \
  SURREAL_PASS=root \
  SURREAL_NAMESPACE=dev \
  SURREAL_DATABASE=dev \
  python3 -m admin.cli activities list
'

# Expected: 8 activity variants listed
```

**Success Criteria**:
- ✅ All 4 services running
- ✅ 8 activity variants in database
- ✅ No connection errors

---

## Phase 2: Activity Discovery

### Test 2.1: MCP Server Discovery

```bash
# Test MCP activity search
docker exec -it devbob-opencode bash -c '
  cd /workspace && \
  METABOB_API_URL=http://metabob-rpc-api-server:8080 \
  python3 << "EOF"
import asyncio
import sys
sys.path.insert(0, "/workspace/repos/metabob-cli/src")

from metabob_cli.mcp.activity_manager import ActivityManager

async def test():
    mgr = ActivityManager(base_url="http://metabob-rpc-api-server:8080")
    activities = await mgr.search_activities(limit=10)
    print(f"\nFound {len(activities)} activities")
    for a in activities:
        print(f"  - {a.get(\"variant_id\", \"unknown\")}: {a.get(\"name\", \"unknown\")}")
    return len(activities)

result = asyncio.run(test())
sys.exit(0 if result == 8 else 1)
EOF
'
```

**Expected Output**:
```
Found 8 activities
  - bug-fix-v1: Bug Fix (Complete)
  - feature-impl-v1: Feature Implementation (Complete)
  - refactor-with-tests-v1: Refactor with Tests
  - create-activity-template-v1: Create Activity Template
  - commit-organized-changes-v1: Commit Organized Changes
  - add-rest-endpoint-v1: Add REST Endpoint
  - add-unit-tests-v1: Add Unit Tests
  - api-docs-generator-v1: API Documentation Generator
```

### Test 2.2: OpenCode CLI Discovery

```bash
# Test via OpenCode CLI
docker exec -it devbob-opencode bash -c '
  cd /workspace && \
  opencode run "Search for activities in the feature category" 2>&1 | \
  grep -E "(activity|template|variant)" | head -20
'
```

**Expected**: Agent should use `search_activities` tool and find templates.

**Success Criteria**:
- ✅ MCP server returns 8 activities
- ✅ OpenCode CLI can invoke search_activities
- ✅ All expected variants present

---

## Phase 3: Activity Execution

### Test 3.1: Execute add-unit-tests Activity

```bash
# Create test file to add tests for
docker exec -it devbob-opencode bash -c '
  cat > /workspace/test-target.js << "EOF"
function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

module.exports = { add, multiply };
EOF
'

# Execute activity
docker exec -it devbob-opencode bash -c '
  cd /workspace && \
  opencode run "Use the add-unit-tests activity to add tests for test-target.js. Use Jest framework." 2>&1 | \
  tee /tmp/activity-execution.log
'

# Verify results
docker exec -it devbob-opencode bash -c '
  echo "=== Activity Execution Results ===" && \
  ls -la /workspace/test-target.test.js 2>&1 && \
  echo "" && \
  cat /workspace/test-target.test.js
'
```

**Expected Outcome**:
- ✅ Agent uses `activity` tool with `add-unit-tests-v1`
- ✅ Test file created at `/workspace/test-target.test.js`
- ✅ Tests cover `add` and `multiply` functions
- ✅ Activity completion reported

**Success Criteria**:
- ✅ Activity executes without errors
- ✅ Output files created as expected
- ✅ Agent reports success

---

## Phase 4: Activity Creation

### Test 4.1: Create Simple Activity Template

```bash
# Create new activity via create-activity-template
docker exec -it devbob-opencode bash -c '
  cd /workspace && \
  opencode run "Create a new activity template called \"add-logging\" that adds console.log statements to JavaScript functions. The activity should:
1. Read target file
2. Parse functions
3. Add console.log at function entry
4. Write modified file

Use the create-activity-template activity to create this." 2>&1 | \
  tee /tmp/activity-creation.log
'
```

**Expected Outcome**:
- ✅ Agent uses `activity` tool with `create-activity-template-v1`
- ✅ New template JSON created
- ✅ Template registered in backend
- ✅ New variant_id returned (e.g., `add-logging-v1`)

### Test 4.2: Verify Template Registration

```bash
# Check database for new template
docker exec -it devbob-opencode bash -c '
  cd /workspace/repos/metabob-rpc-api && \
  SURREAL_URL=ws://surreal:8000 \
  SURREAL_USER=root \
  SURREAL_PASS=root \
  SURREAL_NAMESPACE=dev \
  SURREAL_DATABASE=dev \
  python3 -m admin.cli activities list | grep -i logging
'

# Expected: add-logging-v1 listed
```

**Success Criteria**:
- ✅ Template creation activity completes
- ✅ New template appears in database (9 total)
- ✅ Template has valid variant_id

---

## Phase 5: E2E Validation

### Test 5.1: Execute Newly Created Activity

```bash
# Create test file
docker exec -it devbob-opencode bash -c '
  cat > /workspace/sample-functions.js << "EOF"
function greet(name) {
  return "Hello, " + name;
}

function farewell(name) {
  return "Goodbye, " + name;
}

module.exports = { greet, farewell };
EOF
'

# Execute new activity
docker exec -it devbob-opencode bash -c '
  cd /workspace && \
  opencode run "Use the add-logging activity to add logging to sample-functions.js" 2>&1 | \
  tee /tmp/new-activity-execution.log
'

# Verify results
docker exec -it devbob-opencode bash -c '
  echo "=== Modified File ===" && \
  cat /workspace/sample-functions.js
'
```

**Expected Outcome**:
- ✅ Agent discovers new `add-logging-v1` activity
- ✅ Activity executes successfully
- ✅ Functions have console.log statements added
- ✅ File is modified as expected

**Success Criteria**:
- ✅ New activity is discoverable
- ✅ New activity executes without errors
- ✅ Output matches template logic

---

## Success Metrics

### Infrastructure
- [ ] All 4 services healthy
- [ ] Database persistent across restarts
- [ ] 8 base templates + 1 new template = 9 total

### Discovery
- [ ] MCP server returns all templates
- [ ] OpenCode CLI can search activities
- [ ] Activity recommendations work

### Execution
- [ ] Existing activity executes successfully
- [ ] Output files created correctly
- [ ] Activity tracking works

### Creation
- [ ] New template created via activity
- [ ] Template registered in backend
- [ ] Template appears in searches

### E2E
- [ ] New activity is executable
- [ ] Full workflow (create → register → execute) works
- [ ] Activity system is self-sustaining

---

## Failure Scenarios

### Scenario 1: Backend Endpoint 404
**Symptom**: `GET /v2/activities/templates → 404`  
**Fix**: Verify `activity_manager.py` has `/activity-recommendations/variants`  
**Test**: `grep "/activity-recommendations/variants" repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

### Scenario 2: Authentication Error
**Symptom**: `401 Unauthorized` or `403 Forbidden`  
**Fix**: Verify `X-Internal-Request: true` header in `activity_manager.py` line 116  
**Test**: `grep "X-Internal-Request" repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

### Scenario 3: Database Empty
**Symptom**: `Found 0 activities`  
**Fix**: Load templates via `load-templates.sh` script  
**Test**: `docker exec devbob-opencode bash /workspace/scripts/activity-templates/load-templates.sh`

### Scenario 4: MCP Not Configured
**Symptom**: `Metabob MCP client not found`  
**Fix**: Verify `METABOB_API_URL` env var set in container  
**Test**: `docker exec devbob-opencode env | grep METABOB_API_URL`

---

## Quick Validation Script

```bash
#!/bin/bash
# File: test-activity-system.sh

set -e

echo "=== Phase 1: Infrastructure ==="
docker compose -f configs/docker-compose.devbob.yaml ps
docker exec devbob-opencode bash -c 'cd /workspace/repos/metabob-rpc-api && SURREAL_URL=ws://surreal:8000 SURREAL_USER=root SURREAL_PASS=root SURREAL_NAMESPACE=dev SURREAL_DATABASE=dev python3 -m admin.cli activities list | wc -l'

echo ""
echo "=== Phase 2: Activity Discovery ==="
docker exec devbob-opencode bash -c 'cd /workspace && METABOB_API_URL=http://metabob-rpc-api-server:8080 python3 << "EOF"
import asyncio, sys
sys.path.insert(0, "/workspace/repos/metabob-cli/src")
from metabob_cli.mcp.activity_manager import ActivityManager
async def test():
    mgr = ActivityManager(base_url="http://metabob-rpc-api-server:8080")
    activities = await mgr.search_activities(limit=10)
    print(f"Found {len(activities)} activities")
    return len(activities)
result = asyncio.run(test())
sys.exit(0 if result >= 8 else 1)
EOF
'

echo ""
echo "=== Phase 3: Activity Execution ==="
docker exec devbob-opencode bash -c '
  echo "function test() { return 42; }" > /workspace/test.js &&
  cd /workspace &&
  opencode run "Add tests for test.js using add-unit-tests activity" 2>&1 | grep -q "activity" &&
  echo "Activity execution successful" || echo "Activity execution failed"
'

echo ""
echo "=== All Tests Complete ==="
```

---

## Next Actions

1. **Start Docker Desktop** (when stable)
2. **Run Phase 1** - Verify infrastructure
3. **Run Phase 2** - Test discovery
4. **Run Phase 3** - Test execution
5. **Run Phase 4** - Test creation
6. **Run Phase 5** - Test E2E

**Estimated Total Time**: 60 minutes  
**Blocker**: Docker Desktop stability

---

**Ready for execution when Docker is stable.**
