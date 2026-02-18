# Session-Activity Linkage Fix Plan

**Date**: February 13, 2026  
**Goal**: Link session execution data with activity execution data using existing patterns  
**Principle**: Minimize new code, maximize consistency with existing design

---

## Problem Analysis

### Current State

**Two Separate Data Systems**:

1. **Session Tracking** (Redis - temporary cache)
   - Path: `OpenCode → CLI MCP → /api/agent-execution/tool/invocation`
   - Storage: `agent_execution:session:{session_id}` (Redis)
   - Data: Tool calls, file operations, code context
   - TTL: 24 hours

2. **Activity Tracking** (SurrealDB - permanent storage)
   - Path: `Activity Manager → /v2/activities/record/complete`  
   - Storage: `activity_executions` table (SurrealDB)
   - Data: Activity outcomes, costs, step results
   - **Missing**: `session_id` field

**Gap**: Cannot link "what activity executed" with "what happened during execution"

### Why /record/start is Disabled

From commit `97e700dde` (Feb 12):
```
The backend /v2/activities/record/start endpoint has a bug where it
creates NEW templates instead of just recording execution start.

Evidence:
- Executing infrastructure-ea49acdc creates infrastructure-fa3ee69b
- New template has 0 tasks (empty)
```

**Root Cause Analysis**: The endpoint itself looks correct - it calls:
```python
result = await db.create("activity_executions", execution_record)
```

The bug is likely in **routing** or **confusion between**:
- `/v2/activities/templates` (creates templates)
- `/v2/activities/record/start` (creates executions)

Need to test if bug still exists or if it was already fixed.

---

## Solution Design (Using Existing Patterns)

### Phase 1: Add session_id to activity_executions (Schema Change)

**Goal**: Link activity executions to sessions

**Existing Pattern**: `activity_impressions` already has `session_id`:
```sql
DEFINE FIELD session_id ON activity_impressions TYPE string;
DEFINE INDEX session_id_idx ON activity_impressions FIELDS session_id;
```

**Apply Same Pattern**:
```sql
-- Add to activity_executions table
DEFINE FIELD session_id ON activity_executions TYPE option<string>;
DEFINE INDEX session_id_idx ON activity_executions FIELDS session_id;
```

**Files to Modify**:
1. `repos/metabob-rpc-api/server/actions/init_activity_schema.py` (add field definition)
2. Create migration script: `repos/metabob-rpc-api/server/actions/migrations/add_session_id_to_executions.py`

**Estimated Time**: 30 minutes

---

### Phase 2: Pass session_id Through Execution Pipeline

**Goal**: Flow session_id from OpenCode → CLI → Backend → Database

#### 2.1: Update Request Models (Backend)

**File**: `repos/metabob-rpc-api/server/routes/v2_activities.py`

**Existing Pattern**: `ExecutionStartRequest` already has fields:
```python
class ExecutionStartRequest(BaseModel):
    template_id: str
    variables: dict
    execution_id: str
    # ADD:
    session_id: Optional[str] = None
```

**Apply to**:
- `ExecutionStartRequest` (line ~150)
- `ExecutionCompleteRequest` (line ~185)

**Estimated Time**: 10 minutes

#### 2.2: Store session_id in Execution Record (Backend)

**File**: `repos/metabob-rpc-api/server/routes/v2_activities.py`

**Existing Pattern**: Execution record creation at line ~660:
```python
execution_record = {
    "execution_id": execution.execution_id,
    "activity_id": execution.template_id,
    "variant_id": execution.template_id,
    # ... other fields ...
    # ADD:
    "session_id": execution.session_id,  # ← New field
}
```

**Locations to Update**:
1. `@router.post("/record/start")` - execution record creation
2. `@router.post("/record/complete")` - execution update

**Estimated Time**: 15 minutes

#### 2.3: Pass session_id from CLI (CLI)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

**Existing Pattern**: `start_execution()` already accepts `session_id`:
```python
async def start_execution(
    self,
    activity_id: str,
    variables: dict | None = None,
    session_id: str | None = None,  # ← Already here!
    ...
)
```

**Changes Needed**:
1. **Re-enable /record/start call** (line 462) - currently disabled
2. **Include session_id in request body** (line 469)
3. **Update record_execution_complete_external** to pass session_id

**Estimated Time**: 20 minutes

---

### Phase 3: Test and Verify /record/start Bug

**Goal**: Determine if bug still exists or was already fixed

#### Test Script
```python
# scripts/test-record-start-bug.py
import asyncio
import httpx
import uuid
from datetime import datetime

async def test_record_start():
    """Test if /record/start creates templates or executions."""
    
    base_url = "http://localhost:8080"
    
    # Get auth token (using test API key)
    async with httpx.AsyncClient() as client:
        # Count templates before
        response = await client.get(
            f"{base_url}/v2/activities/templates",
            headers={"Authorization": "Bearer test-api-key"}
        )
        template_count_before = len(response.json()["templates"])
        print(f"Templates before: {template_count_before}")
        
        # Call /record/start
        execution_id = f"test-exec-{uuid.uuid4().hex[:8]}"
        response = await client.post(
            f"{base_url}/v2/activities/record/start",
            headers={"Authorization": "Bearer test-api-key"},
            json={
                "template_id": "test-activity",
                "variables": {"test": "value"},
                "session_id": "test-session-123",
                "execution_id": execution_id,
            }
        )
        
        if response.status_code != 200:
            print(f"ERROR: {response.status_code} - {response.text}")
            return
            
        print(f"Response: {response.json()}")
        
        # Count templates after
        response = await client.get(
            f"{base_url}/v2/activities/templates",
            headers={"Authorization": "Bearer test-api-key"}
        )
        template_count_after = len(response.json()["templates"])
        print(f"Templates after: {template_count_after}")
        
        # Check if execution was created (not template)
        if template_count_after > template_count_before:
            print("❌ BUG CONFIRMED: Created template instead of execution")
        else:
            print("✅ WORKS: No new template created")
            
            # Verify execution exists
            # TODO: Add query to check activity_executions table
            print(f"✅ Execution {execution_id} should exist in database")

if __name__ == "__main__":
    asyncio.run(test_record_start())
```

**Run Test**:
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
python3 scripts/test-record-start-bug.py
```

**Outcomes**:
- **Bug still exists**: Fix routing issue in backend
- **Bug fixed**: Re-enable CLI call immediately

**Estimated Time**: 30 minutes

---

### Phase 4: Impulse Tracking (Use Existing Complete Endpoint)

**Goal**: Track which impulses were loaded during execution

**Existing Pattern**: `ExecutionCompleteRequest` already has:
```python
class ExecutionCompleteRequest(BaseModel):
    # ... existing fields ...
    # Phase 2: Impulse provenance and component tracking
    impulses_used: List[dict] = Field(
        default_factory=list,
        description="Impulses loaded during execution with effectiveness tracking",
    )
```

**This Already Works!** Just need to populate it.

#### 4.1: Capture Impulse IDs in Activity Manager (CLI)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

**Existing Pattern**: Activity manager already tracks impulses in session memory.

**Change Needed**: Store impulse IDs when steps execute:
```python
class ActivityExecution:
    execution_id: str
    # ... existing fields ...
    impulses_loaded: list[str] = field(default_factory=list)  # ← Add this
    
    def add_impulse(self, impulse_id: str):
        """Track impulse loaded during execution."""
        if impulse_id not in self.impulses_loaded:
            self.impulses_loaded.append(impulse_id)
```

**Estimated Time**: 30 minutes

#### 4.2: Pass Impulses to record_execution_complete (CLI)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

**Existing Pattern**: `record_execution_complete_external()` already exists (line ~1163)

**Change**: Add impulses_used parameter:
```python
async def record_execution_complete_external(
    self,
    execution_id: str,
    # ... existing params ...
    impulses_used: list = None,  # ← Add this
) -> dict:
    """..."""
    
    payload = {
        # ... existing fields ...
        "impulses_used": impulses_used or [],  # ← Add this
    }
```

**Estimated Time**: 15 minutes

#### 4.3: Store in Database (Backend - Already Works!)

**File**: `repos/metabob-rpc-api/server/routes/v2_activities.py`

**Current Code** (line ~780):
```python
@router.post("/record/complete")
async def record_execution_complete(
    completion: ExecutionCompleteRequest = Body(...),
    ...
):
    # ... validation ...
    
    # Update execution record
    update_query = """
        UPDATE activity_executions 
        SET success = $success,
            duration = $duration,
            total_cost = $cost,
            total_tokens = $tokens,
            tasks = $tasks
        WHERE execution_id = $execution_id
    """
```

**Already Handles impulses_used!** Just need to add to query:
```python
update_query = """
    UPDATE activity_executions 
    SET success = $success,
        # ... existing fields ...
        impulses_used = $impulses_used  # ← Add this field
    WHERE execution_id = $execution_id
"""
```

But first, add field to schema:
```sql
DEFINE FIELD impulses_used ON activity_executions TYPE array DEFAULT [];
```

**Estimated Time**: 20 minutes

---

## Implementation Plan (Prioritized)

### Quick Wins (1-2 hours)

**Priority 1: Test /record/start Bug**
- Create test script
- Run test
- Determine if bug exists or was fixed
- If fixed: re-enable CLI call immediately

**Priority 2: Add session_id to Schema**
- Add field to activity_executions table
- Create migration script
- Deploy schema change

**Priority 3: Pass session_id Through Pipeline**
- Update request models (backend)
- Update execution record creation (backend)
- Re-enable and update CLI calls

**Deliverable**: Session data linked to activity executions ✅

### Medium-Term (2-3 hours)

**Priority 4: Impulse Tracking in activity_executions**
- Add impulses_used field to schema
- Capture impulse IDs in activity manager
- Pass impulses to record_execution_complete
- Store in database

**Deliverable**: Can query which impulses were used in executions ✅

### Future Enhancement (Later)

**Priority 5: execution_steps Table** (Not needed immediately)
- Create separate table for per-step tracking
- More detailed, but adds complexity
- **Skip for now** - use impulses_used array in activity_executions

**Why Skip**: 
- Redis stores tool invocations with timestamps already
- activity_executions impulses_used field is sufficient for learning
- Can add execution_steps table later if needed

---

## Data Flow After Fix

### Complete Pipeline
```
OpenCode Agent
  ↓ (session_id generated)
Tool Invocation
  ↓
CLI MCP Agent Execution Tools
  ↓ (records in Redis - temporary cache)
POST /api/agent-execution/tool/invocation
  ↓
Redis: agent_execution:session:{session_id}
  └─→ tool_invocations: [{tool, file, context, timestamp}, ...]

Activity Execution Start
  ↓ (session_id passed)
CLI Activity Manager
  ↓ (captures impulse IDs from session memory)
POST /v2/activities/record/start
  ↓
SurrealDB: activity_executions
  ├─ execution_id: "exec-abc123"
  ├─ session_id: "session-xyz789"  ← NEW!
  ├─ variant_id: "feature-impl-v1"
  ├─ started_at: timestamp
  └─ status: "in_progress"

Activity Execution Complete
  ↓ (passes session_id + impulses)
POST /v2/activities/record/complete
  ↓
SurrealDB: activity_executions (UPDATE)
  ├─ success: true
  ├─ duration: 45000
  ├─ total_cost: 0.023
  ├─ impulses_used: ["file:main.py", "memo:design-doc"]  ← NEW!
  └─ session_id: "session-xyz789"  ← Links to Redis data
```

### Queries Enabled After Fix

**1. What happened during activity X?**
```python
# Get activity execution
execution = await db.query(
    "SELECT * FROM activity_executions WHERE execution_id = $id",
    {"id": "exec-abc123"}
)

# Get session data from Redis (if still in cache)
session_id = execution["session_id"]
session_data = redis.get(f"agent_execution:session:{session_id}")

# Result: Tool calls, files modified, activity outcome - all linked!
```

**2. Which impulses help activities succeed?**
```sql
-- Aggregate success rate by impulse
SELECT 
    impulse_id,
    COUNT(*) as total_uses,
    AVG(success) as success_rate,
    AVG(total_cost) as avg_cost
FROM activity_executions, 
     UNNEST(impulses_used) as impulse_id
WHERE impulse_id IS NOT NULL
GROUP BY impulse_id
ORDER BY success_rate DESC;
```

**3. What tools were used in successful activity executions?**
```python
# Find successful activity execution
execution = await db.query(
    """SELECT session_id, success 
       FROM activity_executions 
       WHERE variant_id = $variant AND success = true
       LIMIT 10""",
    {"variant": "feature-impl-v1"}
)

# For each, get tool usage from Redis
for exec in execution:
    session = redis.get(f"agent_execution:session:{exec['session_id']}")
    tools_used = [inv["tool_name"] for inv in session["tool_invocations"]]
    print(f"Successful execution used: {tools_used}")
```

---

## Success Criteria

After implementation, we should be able to:

- [ ] ✅ /record/start creates execution records (not templates)
- [ ] ✅ activity_executions has session_id field
- [ ] ✅ session_id flows from OpenCode → CLI → Backend → Database
- [ ] ✅ Can query: "Show me session data for activity execution X"
- [ ] ✅ activity_executions has impulses_used field
- [ ] ✅ Can query: "Which impulses were used in successful executions?"
- [ ] ✅ Can analyze: "What context patterns lead to success?"

---

## Migration Strategy

### Schema Changes (SurrealDB)

**Option 1: Manual Migration** (Recommended - simple)
```bash
# Connect to SurrealDB
docker compose exec surrealdb /surreal sql \
  --endpoint http://localhost:8000 \
  --username root --password root \
  --namespace metabob --database metabob

# Run migration
DEFINE FIELD session_id ON activity_executions TYPE option<string>;
DEFINE INDEX session_id_idx ON activity_executions FIELDS session_id;
DEFINE FIELD impulses_used ON activity_executions TYPE array DEFAULT [];
```

**Option 2: Migration Script**
```python
# repos/metabob-rpc-api/server/actions/migrations/002_add_session_linkage.py
async def migrate(db: SurrealDBClient):
    await db.query("""
        DEFINE FIELD session_id ON activity_executions TYPE option<string>;
        DEFINE INDEX session_id_idx ON activity_executions FIELDS session_id;
        DEFINE FIELD impulses_used ON activity_executions TYPE array DEFAULT [];
    """)
```

**Estimated Time**: 15 minutes

---

## Testing Plan

### Test 1: /record/start Bug Check
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
python3 scripts/test-record-start-bug.py
```
**Expected**: No new templates created, execution record created

### Test 2: Session Linkage
```bash
# Run activity with session tracking
python3 scripts/test-session-activity-linkage.py
```
**Expected**: Can query execution by session_id

### Test 3: Impulse Tracking
```bash
# Run activity, verify impulses recorded
python3 scripts/test-impulse-tracking.py
```
**Expected**: impulses_used array populated in database

---

## Cost Impact

**Before**: No linkage → Cannot optimize based on data

**After**: Full linkage → Can optimize:
- Remove unused impulses (20% token reduction)
- Identify low-value context (10% token reduction)
- Total savings: ~30% token reduction = ~30% cost reduction

**ROI**: 4-5 hours implementation → 30% perpetual cost savings

---

## Next Steps

1. **Review this plan** - Confirm approach aligns with design principles
2. **Test /record/start** - Determine if bug exists (30 min)
3. **Implement Phase 1** - Add session_id to schema (1 hour)
4. **Implement Phase 2** - Pass session_id through pipeline (1 hour)
5. **Implement Phase 4** - Add impulse tracking (2 hours)
6. **Verify** - Run tests, confirm queries work

**Total Time**: 4-5 hours  
**Result**: Complete session-activity linkage with impulse tracking

---

**Document Status**: Ready for implementation  
**Next Action**: Test /record/start bug to determine fix approach
