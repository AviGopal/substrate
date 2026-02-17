# Cold-Start Bootstrap Plan

**Date**: February 11, 2026  
**Goal**: Enable cold-start capability and activity-first template creation  
**Status**: 🟡 In Progress

---

## Problem Statement

We need to ensure:
1. **Cold-start capability**: Backend can start from empty database and load bootstrap templates
2. **Activity-first creation**: New templates are created by running `activity-create` activity in metabob-opencode
3. **No manual intervention**: System should bootstrap itself automatically
4. **MCP connectivity**: search_activities and activity tools must work

---

## Current State

### ✅ What's Working

1. **Backend Running**: metabob-rpc-api healthy on port 8080
2. **Database Populated**: 17 templates in backend currently
3. **Templates Migrated**: All 9 bootstrap templates are V2 format
4. **Container Ready**: devbob-opencode container running with metabob-cli 1.8.0
5. **Scripts Created**: Migration and registration scripts available

### 🟡 What Needs Verification

1. **MCP Connection**: search_activities returns empty from host
2. **Activity Execution**: End-to-end workflow untested
3. **activity-create**: Can we create templates via activity?
4. **Cold-start**: Can backend bootstrap from scratch?

### ❌ What's Broken

1. **MCP search_activities Tool**: Returns empty results despite templates in backend
2. **Root Cause Unknown**: Need to investigate MCP server connection

---

## Cold-Start Bootstrap Strategy

### Approach 1: Database Init Script (CURRENT)

**How it works**:
```
1. docker-compose up
2. db-init container runs
3. Executes init-db.py script
4. Registers bootstrap templates to backend
5. Backend ready with core templates
```

**Files**:
- `scripts/init-db.py` - Database initialization
- `scripts/register-bootstrap-templates.py` - Template registration
- `docker-compose.yaml` - db-init service

**Pros**:
- Automatic on startup
- No manual intervention
- Fast (< 30 seconds)

**Cons**:
- Requires docker-compose
- Not tested yet
- May have schema mismatches

**Status**: 🟡 Needs testing

---

### Approach 2: Backend Auto-Registration (FUTURE)

**How it works**:
```
1. Backend starts
2. Checks if templates table is empty
3. Loads bootstrap templates from metabob-proto volume
4. Registers them automatically
5. Backend ready with core templates
```

**Implementation**:
```python
# In metabob-rpc-api startup
async def bootstrap_templates():
    template_count = await db.count("templates")
    if template_count == 0:
        bootstrap_dir = Path("/opt/app/bootstrap")
        for template_file in bootstrap_dir.glob("*.json"):
            template = json.loads(template_file.read_text())
            await register_template(template)
```

**Pros**:
- No external dependencies
- Backend-native
- Always available

**Cons**:
- Requires backend code changes
- Not implemented yet

**Status**: ❌ Not implemented

---

### Approach 3: Activity-First Creation (IDEAL)

**How it works**:
```
1. Backend starts with minimal bootstrap (just activity-create template)
2. Agent runs activity-create activity to create feature-impl
3. Agent runs activity-create activity to create bug-fix
4. Agent runs activity-create activity to create refactor
... etc
5. All templates created via activities
```

**Benefits**:
- "Build the system with itself"
- Dog-fooding the activity system
- Templates are validated by execution
- Self-documenting (activity records)

**Challenges**:
- Chicken-and-egg: Need activity-create to create itself
- Requires working MCP connection
- Requires activity execution to work

**Status**: 🎯 Target state

---

## Implementation Plan

### Phase 1: Verify Current Bootstrap ✅

**Goal**: Confirm backend has templates and they're accessible

```bash
# Check backend templates
curl -H "x-api-key: ..." -H "Authorization: Bearer ..." \
  http://localhost:8080/v2/activities/templates | jq '.templates | length'
# Expected: 17

# Check core templates present
curl -H "x-api-key: ..." -H "Authorization: Bearer ..." \
  http://localhost:8080/v2/activities/templates | \
  jq '[.templates[] | select(.tasks != null and (.tasks | length) > 0)] | length'
# Expected: 13+
```

**Status**: ✅ Complete - 17 templates, 13 with tasks

---

### Phase 2: Fix MCP Connection 🔧

**Goal**: Get search_activities tool working

**Investigation**:
1. Test MCP server directly in container
2. Check metabob-cli MCP mode
3. Verify API endpoint connectivity
4. Test search_activities RPC call

**Commands**:
```bash
# Test MCP in container
docker exec devbob-opencode sh -c '
  cd /workspace && \
  METABOB_API_URL=http://api-server-dev:8080 \
  METABOB_API_KEY=mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs \
  METABOB_PROJECT_ID=exp-repo-dev \
  metabob-cli mcp --transport stdio' <<< '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_activities",
      "arguments": {"category": "feature", "verbose": true}
    }
  }'
```

**Expected Issues**:
- MCP server not exposing search_activities tool
- API endpoint not implemented
- Authentication/session issues
- Backend search endpoint missing

**Status**: 🟡 In Progress

---

### Phase 3: Test Activity Execution 🚀

**Goal**: Execute a simple activity end-to-end

**Test Case**: Run `feature-impl` activity
```javascript
activity({
  activityId: "feature-impl-v1",
  variables: {
    feature_name: "test-bootstrap",
    feature_description: "Test activity execution",
    target_location: "src/test"
  },
  reason: "Verify activity system works end-to-end"
})
```

**Success Criteria**:
- Activity starts execution
- Tasks execute sequentially
- Results recorded in backend
- Success/failure reported correctly

**Status**: ⏸️  Pending (needs MCP fix first)

---

### Phase 4: Test activity-create Template 🎯

**Goal**: Create a new template using activity-create activity

**Test Case**: Create a simple hello-world template
```javascript
activity({
  activityId: "activity-create-v1",
  variables: {
    template_name: "hello-world",
    template_description: "Simple hello world activity",
    tasks: [
      {
        id: "greet",
        description: "Print hello world",
        subagent: "general",
        guidance: ["Use bash tool to echo hello"]
      }
    ]
  },
  reason: "Test self-hosting: create template via activity"
})
```

**Success Criteria**:
- New template created
- Registered to backend
- Available via search_activities
- Executable

**Status**: ⏸️  Pending (needs Phase 3 complete)

---

### Phase 5: Document Cold-Start Procedure 📝

**Goal**: Create runbook for starting from scratch

**Deliverables**:
1. `COLD_START_RUNBOOK.md` - Step-by-step guide
2. `scripts/cold-start-bootstrap.sh` - Automated script
3. Update docker-compose.yaml with db-init
4. Testing procedure

**Status**: ⏸️  Pending

---

## Minimal Bootstrap Template Set

For cold-start, we need at minimum:

### Tier 1: Creation Template (Required First)
1. **activity-create** - Create new templates via activity
   - Status: ✅ In backend (INFRASTRUCTURE-57327686, 5 tasks)
   - Purpose: Bootstrap all other templates

### Tier 2: Core Development Templates
2. **feature-impl** - Implement new features
   - Status: ✅ In backend (FEATURE-d3f6c989, 5 tasks)
3. **bug-fix** - Fix bugs
   - Status: ✅ In backend (BUGFIX-69d6ab39, 4 tasks)
4. **refactor** - Refactor code
   - Status: ✅ In backend (REFACTOR-9c629da6, 4 tasks)

### Tier 3: Meta Templates (Self-Improvement)
5. **activity-debug** - Debug activity failures
   - Status: ✅ In backend (INFRASTRUCTURE-99a2e10c, 5 tasks)
6. **activity-evolve** - Evolve existing templates
   - Status: ✅ In backend (INFRASTRUCTURE-0013e379, 5 tasks)

### Tier 4: Quality & Analysis
7. **code-analysis** - Analyze code quality
   - Status: ✅ In backend (INFRASTRUCTURE-c0b9dfaa, 4 tasks)
8. **boredom-task-processor** - Handle idle time
   - Status: ✅ In backend (INFRASTRUCTURE-d3b89954, 6 tasks)

**All 8 core templates are present in backend** ✅

---

## Database Schema for Bootstrap

### Templates Table
```sql
CREATE TABLE templates (
  variant_id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  variant_name TEXT,
  name TEXT,
  category TEXT,
  description TEXT,
  version INTEGER,
  tasks JSONB,  -- V2 format with 'tasks' key
  variables JSONB,
  prompt_strategy TEXT,
  context_budget_tokens INTEGER,
  expected_duration_ms INTEGER,
  expected_cost REAL,
  expected_quality_score REAL,
  status TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Bootstrap SQL Script
```sql
-- Load from JSON files
INSERT INTO templates (variant_id, activity_id, ...)
SELECT * FROM json_populate_recordset(NULL::templates, 
  readfile('/opt/app/bootstrap/feature-impl.json')
);
```

**Status**: ❌ SQL script not created yet

---

## Testing Checklist

### Database Bootstrap
- [ ] Backend starts with empty database
- [ ] db-init container runs
- [ ] Templates registered automatically
- [ ] Backend API returns templates
- [ ] search_activities tool finds templates

### MCP Connection
- [ ] metabob-cli MCP server starts
- [ ] tools/list returns activity tools
- [ ] search_activities returns results
- [ ] activity execution starts

### Activity Execution
- [ ] feature-impl activity executes
- [ ] Tasks run sequentially
- [ ] Results recorded
- [ ] Success reported

### Activity Creation
- [ ] activity-create activity executes
- [ ] New template created
- [ ] Template registered to backend
- [ ] Template available for execution

### Container Testing
- [ ] devbob-opencode can search activities
- [ ] devbob-opencode can execute activities
- [ ] devbob-opencode can create templates
- [ ] All via activity tool (not manual)

---

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Backend templates | 8+ | 17 | ✅ |
| Templates with tasks | 8+ | 13 | ✅ |
| MCP tools available | 3+ | ? | 🟡 |
| search_activities works | Yes | No | ❌ |
| Activity execution works | Yes | ? | 🟡 |
| activity-create works | Yes | ? | 🟡 |
| Cold-start time | < 60s | ? | 🟡 |

---

## Next Actions

1. **Fix MCP Connection** ← **DO THIS FIRST**
   - Investigate why search_activities returns empty
   - Test MCP server in container directly
   - Verify API endpoint exists
   - Fix authentication if needed

2. **Test Activity Execution**
   - Run feature-impl activity
   - Verify end-to-end workflow
   - Check results in backend

3. **Test activity-create**
   - Create hello-world template
   - Verify registration
   - Test execution of created template

4. **Document Cold-Start**
   - Create runbook
   - Test from scratch
   - Automate bootstrap

5. **Commit Documentation**
   - COLD_START_BOOTSTRAP_PLAN.md (this file)
   - COLD_START_RUNBOOK.md (to be created)
   - Update README with bootstrap instructions

---

## Risk Assessment

### Low Risk ✅
- Backend is working
- Templates are migrated
- Container is healthy
- Scripts are ready

### Medium Risk ⚠️
- MCP connection untested
- Activity execution untested
- Cold-start never tested from scratch

### High Risk ❌
- None identified (all restorable from git)

---

**Status**: 🟡 Phase 1 Complete, Phase 2 In Progress  
**Blocker**: MCP connection not returning results  
**Next**: Investigate MCP search_activities tool

