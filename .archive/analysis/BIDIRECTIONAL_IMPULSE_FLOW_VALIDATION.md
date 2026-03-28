# Bidirectional Impulse Flow Validation Report

**Date:** February 14, 2026  
**Status:** ✅ **FORWARD FLOW COMPLETE** | ⚠️ **REVERSE FLOW DESIGNED BUT NOT IMPLEMENTED**  
**Context:** Validation of complete impulse data round-trip for learning loop

---

## Executive Summary

This report documents the complete bidirectional flow of impulse data through the OpenCode learning system:

- **Forward Flow (Data Collection):** ✅ **FULLY IMPLEMENTED AND VALIDATED**
  - org_id and project_id correctly tracked from session creation
  - Impulse data flows from OpenCode → CLI → Backend → SurrealDB
  - Data isolation by organization and project works correctly
  
- **Reverse Flow (Context Pre-initialization):** ⚠️ **DESIGNED BUT NOT IMPLEMENTED**
  - Architecture defined in `LEARNING_LOOP_DATA_ARCHITECTURE.md`
  - MCP query tools designed but not yet created
  - Session memory agent integration planned but not built

---

## Part 1: Forward Flow Validation ✅

### 1.1 Session Creation and org_id/project_id Tracking

#### Source Location
**File:** `repos/metabob-cli/src/metabob_cli/mcp/server.py` (lines 754-807)

#### How It Works
```python
# Line 755: project_id from environment variable
project_id = os.environ.get("METABOB_PROJECT_ID", "default-project")

# Line 765: Sent to backend in session creation
v2_data = {"project_id": project_id}

# Lines 773-794: Backend returns session with org_id and project_id
async with session.post(f"{base_url}/v2/session", headers=headers, json=v2_data) as response:
    session_data = await response.json()
    session_id = session_data.get("session_id", session_token)
```

#### Backend Session Creation
**File:** `repos/metabob-rpc-api/server/routes/v2_session.py` (lines 222-279)

```python
# Lines 238-249: API key validation extracts org_id
api_key_data = await validate_api_key(surreal, api_key)
user_id = api_key_data.user_id  # org_id comes from api_key_data.org_id

# Lines 273-279: Session created with org_id and project_id
(token, session_data) = await create_session_model(
    redis, surreal,
    api_key=api_key,
    project_id=project_id_value,
    user_id=user_id,
)

# Lines 287-292: Proto response includes org_id and project_id
session_proto = {
    "session_id": session_data.session_id,
    "org_id": session_data.org_id,
    "project_id": session_data.project_id,
    # ...
}
```

**✅ VALIDATION:** org_id is derived from API key ownership, project_id from request body or environment.

---

### 1.2 Impulse Data Flow Through Activity Execution

#### Step 1: Activity Step Execution
**Source:** OpenCode activity execution → CLI MCP activity_manager

**File:** `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

**Data Structure (lines 54-75):**
```python
@dataclass
class StepResult:
    step_id: str
    success: bool
    output: Optional[str] = None
    error: Optional[str] = None
    cost: float = 0.0
    tokens: int = 0
    duration_ms: int = 0
    tool_calls: list = field(default_factory=list)
    
    # ✅ Phase 1: Impulse tracking for learning loop
    impulses_loaded: list[str] = field(default_factory=list)
    impulses_created: list[str] = field(default_factory=list)
    context_summary: dict = field(default_factory=dict)
```

**✅ VALIDATION:** StepResult contains all necessary impulse tracking fields.

---

#### Step 2: Backend API Receives Step Data
**File:** `repos/metabob-rpc-api/server/routes/v2_activities.py` (lines 804-900)

**Endpoint:** `POST /v2/activities/record/step`

**Request Schema (lines 184-193):**
```python
class StepRecordRequest(BaseModel):
    execution_id: str
    step_order: int
    success: bool
    output: Optional[str] = None
    # ... other fields ...
    
    # ✅ Phase 1: Impulse tracking
    impulses_loaded: List[str] = Field(default_factory=list)
    impulses_created: List[str] = Field(default_factory=list)
    context_summary: dict = Field(default_factory=dict)
```

**Step Recording Logic (lines 821-873):**
```python
# Lines 821-843: Write to execution_steps table
await db.create(
    "execution_steps",
    {
        "execution_id": step.execution_id,
        "step_id": f"step-{step.step_order}",
        "step_index": step.step_order,
        "success": step.success,
        "impulses_loaded": step.impulses_loaded,      # ✅ Persisted
        "impulses_created": step.impulses_created,    # ✅ Persisted
        "context_summary": step.context_summary,      # ✅ Persisted
        # ... other fields ...
    }
)

# Lines 848-873: Persist to impulse_registry and impulse_usage
if step.impulses_loaded or step.impulses_created:
    try:
        await persist_step_impulses(
            db=db,
            execution_id=step.execution_id,
            step_id=f"step-{step.step_order}",
            step_index=step.step_order,
            step_succeeded=step.success,
            impulses_loaded=step.impulses_loaded,
            impulses_created=step.impulses_created,
            context_summary=step.context_summary,
            org_id=session.org_id,          # ✅ org_id from session
            project_id=session.project_id,  # ✅ project_id from session
            session_id=session.session_id,
        )
```

**✅ VALIDATION:** Backend extracts org_id and project_id from authenticated session and passes them to impulse persistence.

---

#### Step 3: Impulse Persistence to SurrealDB
**File:** `repos/metabob-rpc-api/server/actions/impulse_registry.py` (lines 245-357)

**Main Function (lines 245-282):**
```python
async def persist_step_impulses(
    db: SurrealDBClient,
    execution_id: str,
    step_id: str,
    step_index: int,
    step_succeeded: bool,
    impulses_loaded: List[str],
    impulses_created: List[str],
    context_summary: dict,
    org_id: str,              # ✅ Received from backend
    project_id: str,          # ✅ Received from backend
    session_id: Optional[str] = None,
) -> None:
```

**Impulse Registry Creation (lines 77-102):**
```python
impulse_record = {
    "impulse_id": impulse_id,
    "session_id": session_id,
    "org_id": org_id,              # ✅ Stored with org_id
    "project_id": project_id,      # ✅ Stored with project_id
    "impulse_type": impulse_type,
    "pointer": pointer,
    "scope": scope,
    "budget": budget,
    "actual_tokens": None,
    "usage_count": 0,
    "success_when_used": 0,
    "success_rate": 0.0,
    "created_by": created_by,
    "created_for": created_for,
    "tags": tags,
    "related_impulses": [],
    "status": "active",
    "created_at": datetime.utcnow(),
    "last_used_at": None,
    "archived_at": None,
}

await db.create("impulse_registry", impulse_record)
```

**✅ VALIDATION:** All impulses persisted to `impulse_registry` with correct org_id and project_id for data isolation.

---

### 1.3 Data Isolation Verification

**Query Example (Data Isolation):**
```sql
-- Get impulses for specific organization and project
SELECT * FROM impulse_registry
WHERE org_id = 'test-org-001'
  AND project_id = 'my-project'
  AND status = 'active';

-- Get usage statistics scoped by org/project
SELECT 
    ir.impulse_id,
    ir.usage_count,
    ir.success_rate,
    ir.org_id,
    ir.project_id
FROM impulse_registry ir
WHERE ir.org_id = 'test-org-001'
  AND ir.project_id = 'my-project'
ORDER BY ir.success_rate DESC;
```

**✅ VALIDATION:** Forward flow correctly tracks org_id and project_id at every layer for proper multi-tenant data isolation.

---

## Part 2: Reverse Flow Analysis ⚠️

### 2.1 Planned Architecture (From LEARNING_LOOP_DATA_ARCHITECTURE.md)

#### Designed MCP Tools (Not Yet Implemented)

**Tool 1: `query_impulse_effectiveness`**
**Purpose:** Retrieve high-success-rate impulses for pre-initialization

**Design (lines 1137-1165):**
```python
@mcp.tool()
async def query_impulse_effectiveness(
    project_id: str,
    min_usage_count: int = 5
) -> dict:
    """Find most effective impulses by success rate."""
    
    query = """
        SELECT 
            ir.impulse_id,
            ir.impulse_type,
            ir.usage_count,
            ir.success_rate,
            array::group(iu.step_id) as steps_used_in
        FROM impulse_registry ir
        JOIN impulse_usage iu ON ir.impulse_id = iu.impulse_id
        WHERE ir.project_id = $project_id
          AND ir.usage_count >= $min_usage_count
        GROUP BY ir.impulse_id, ir.impulse_type, ir.usage_count, ir.success_rate
        ORDER BY ir.success_rate DESC
        LIMIT 10
    """
    
    return await surreal.query(query, {
        "project_id": project_id,
        "min_usage_count": min_usage_count
    })
```

**Status:** ⚠️ **DESIGNED BUT NOT IMPLEMENTED**

---

**Tool 2: `query_activity_recommendations_with_impulses`**
**Purpose:** Get activity recommendations with their most successful impulses

**Expected Design:**
```python
@mcp.tool()
async def query_activity_recommendations_with_impulses(
    project_id: str,
    activity_category: Optional[str] = None,
    min_success_rate: float = 0.7
) -> dict:
    """Get activities with their most effective impulses."""
    
    query = """
        SELECT 
            av.variant_id,
            av.name,
            av.category,
            av.effectiveness,
            (
                SELECT 
                    ir.impulse_id,
                    ir.impulse_type,
                    ir.success_rate,
                    ir.pointer
                FROM impulse_registry ir
                JOIN impulse_usage iu ON ir.impulse_id = iu.impulse_id
                JOIN execution_steps es ON iu.step_id = es.step_id
                WHERE es.execution_id IN (
                    SELECT execution_id FROM activity_executions 
                    WHERE variant_id = av.variant_id
                )
                  AND ir.success_rate >= $min_success_rate
                ORDER BY ir.success_rate DESC
                LIMIT 5
            ) as recommended_impulses
        FROM activity_variants av
        WHERE av.project_id = $project_id
    """
    
    if activity_category:
        query += f" AND av.category = '{activity_category}'"
    
    return await surreal.query(query, {
        "project_id": project_id,
        "min_success_rate": min_success_rate
    })
```

**Status:** ⚠️ **NOT DESIGNED OR IMPLEMENTED**

---

### 2.2 Session Memory Agent Integration (Missing)

#### Expected Flow
```
1. User starts OpenCode session
   ↓
2. Session Memory Agent initializes
   ↓
3. Agent calls MCP tool: query_impulse_effectiveness(project_id)
   ↓
4. Backend queries impulse_registry with org_id/project_id filter
   ↓
5. Returns top 10 impulses with success_rate >= 0.8
   ↓
6. Session Memory Agent pre-loads these impulses into context
   ↓
7. Activity execution begins with learned high-value context
```

**Current Status:** ⚠️ **NONE OF THIS IS IMPLEMENTED**

---

### 2.3 Lifecycle Hooks for Context Pre-initialization (Missing)

#### Expected Integration Points

**Hook 1: `session-memory-preparation`**
**Trigger:** Before activity selection
**Purpose:** Load learned impulses into session context

**Expected Implementation:**
```typescript
// repos/metabob-opencode/src/session/lifecycle-hooks.ts (hypothetical)

async function sessionMemoryPreparationHook(
    session: Session,
    mcpClient: MCPClient
): Promise<void> {
    // Query learned impulses from backend
    const learnedImpulses = await mcpClient.call(
        "query_impulse_effectiveness",
        {
            project_id: session.projectId,
            min_usage_count: 5
        }
    )
    
    // Pre-load high-success impulses into session memory
    for (const impulse of learnedImpulses) {
        if (impulse.success_rate >= 0.8) {
            await session.impulseManager.loadImpulse(
                impulse.impulse_id,
                { preloaded: true, source: "learned" }
            )
        }
    }
}
```

**Status:** ⚠️ **NOT IMPLEMENTED**

---

**Hook 2: `activity-recommendation`**
**Trigger:** During activity selection
**Purpose:** Suggest activities with their proven impulses

**Expected Implementation:**
```typescript
async function activityRecommendationHook(
    session: Session,
    category: string,
    mcpClient: MCPClient
): Promise<ActivityRecommendation[]> {
    // Get activities with their most effective impulses
    const recommendations = await mcpClient.call(
        "query_activity_recommendations_with_impulses",
        {
            project_id: session.projectId,
            activity_category: category,
            min_success_rate: 0.7
        }
    )
    
    // Attach learned impulses to each recommendation
    return recommendations.map(rec => ({
        activityId: rec.variant_id,
        name: rec.name,
        effectiveness: rec.effectiveness,
        learnedImpulses: rec.recommended_impulses,  // ← Learned context
        reasoning: `This activity has ${rec.effectiveness}% success rate. ` +
                   `Recommended impulses: ${rec.recommended_impulses.map(i => i.impulse_id).join(", ")}`
    }))
}
```

**Status:** ⚠️ **NOT IMPLEMENTED**

---

## Part 3: Implementation Gap Analysis

### What Works ✅

| Component | Status | Evidence |
|-----------|--------|----------|
| **Session org_id/project_id tracking** | ✅ Working | CLI server.py lines 754-807, backend v2_session.py lines 222-307 |
| **StepResult impulse fields** | ✅ Working | activity_manager.py lines 54-75 |
| **Backend impulse persistence** | ✅ Working | v2_activities.py lines 848-873, impulse_registry.py lines 245-357 |
| **Data isolation (org/project)** | ✅ Working | impulse_registry stores org_id/project_id, validated by tests |
| **impulse_registry table** | ✅ Exists | Created in Phase 1, validated Feb 14 2026 |
| **impulse_usage table** | ✅ Exists | Created in Phase 1, validated Feb 14 2026 |
| **execution_steps table** | ✅ Exists | With impulse fields, validated |

### What's Missing ⚠️

| Component | Status | Priority | Estimated Effort |
|-----------|--------|----------|------------------|
| **MCP tool: query_impulse_effectiveness** | ❌ Not implemented | HIGH | 2 hours |
| **MCP tool: query_activity_recommendations_with_impulses** | ❌ Not designed | HIGH | 3 hours |
| **Session memory agent integration** | ❌ Not implemented | HIGH | 4 hours |
| **Lifecycle hook: session-memory-preparation** | ❌ Not implemented | HIGH | 3 hours |
| **Lifecycle hook: activity-recommendation** | ❌ Not implemented | MEDIUM | 2 hours |
| **API endpoint: GET /v2/impulses/effectiveness** | ❌ Not implemented | MEDIUM | 2 hours |
| **Documentation: Reverse flow guide** | ❌ Not written | LOW | 1 hour |

**Total Estimated Effort:** ~17 hours for complete bidirectional flow

---

## Part 4: Recommended Implementation Plan

### Phase 1: MCP Query Tools (5 hours)

**Tasks:**
1. Create `query_impulse_effectiveness` MCP tool in CLI (2h)
   - File: `repos/metabob-cli/src/metabob_cli/mcp/learning_tools.py` (new)
   - Implement query against impulse_registry with org_id/project_id filtering
   - Return top N impulses by success_rate

2. Create `query_activity_recommendations_with_impulses` MCP tool (3h)
   - Complex query joining activity_variants, activity_executions, execution_steps, impulse_registry
   - Return activities with their proven impulses

**Deliverables:**
- New MCP tools file
- Unit tests for query logic
- Integration test with backend

---

### Phase 2: Backend API Endpoints (2 hours)

**Tasks:**
1. Add `GET /v2/impulses/effectiveness` endpoint (1h)
   - File: `repos/metabob-rpc-api/server/routes/v2_impulses.py` (new)
   - Query impulse_registry filtered by org_id/project_id
   - Return proto-formatted response

2. Add `GET /v2/activities/recommendations/with-impulses` endpoint (1h)
   - File: `repos/metabob-rpc-api/server/routes/v2_activities.py`
   - Join activities with their successful impulses
   - Return proto-formatted response

**Deliverables:**
- New endpoints
- API tests
- Proto schema updates if needed

---

### Phase 3: Session Memory Agent Integration (7 hours)

**Tasks:**
1. Implement session memory preparation hook (3h)
   - File: `repos/metabob-opencode/src/session/lifecycle-hooks.ts`
   - Call MCP query_impulse_effectiveness on session start
   - Pre-load high-success impulses into session context

2. Implement activity recommendation enhancement (2h)
   - File: `repos/metabob-opencode/src/session/activity-recommendations.ts`
   - Fetch learned impulses for each recommended activity
   - Attach to recommendation reasoning

3. Test end-to-end reverse flow (2h)
   - Create test: Start session → verify learned impulses loaded
   - Create test: Select activity → verify learned impulses suggested
   - Validate data flows from SurrealDB → Backend → CLI → OpenCode

**Deliverables:**
- Lifecycle hooks implementation
- End-to-end integration tests
- Session memory documentation

---

### Phase 4: Documentation and Testing (3 hours)

**Tasks:**
1. Document reverse flow architecture (1h)
2. Create end-to-end bidirectional test (1h)
3. Update user-facing documentation (1h)

**Deliverables:**
- Reverse flow documentation
- Bidirectional integration test
- User guide updates

---

## Part 5: Current Test Coverage

### Forward Flow Tests ✅

| Test | Status | File | Result |
|------|--------|------|--------|
| **Backend accepts impulse data** | ✅ Passing | `scripts/test-phase2-enrichment-direct.py` | All fields validated |
| **Impulse persistence to SurrealDB** | ✅ Passing | `scripts/test-impulse-persistence-simple.py` | 4 impulses, 8 usages |
| **org_id/project_id isolation** | ✅ Passing | Same script | Data scoped correctly |
| **Statistics calculation** | ✅ Passing | Same script | usage_count, success_rate correct |

### Reverse Flow Tests ⚠️

| Test | Status | Reason |
|------|--------|--------|
| **MCP query tools** | ❌ Not tested | Tools don't exist yet |
| **Session memory pre-loading** | ❌ Not tested | Integration not implemented |
| **Activity recommendations with impulses** | ❌ Not tested | Hook not implemented |
| **End-to-end bidirectional** | ❌ Not tested | Reverse flow incomplete |

---

## Part 6: Success Criteria

### Forward Flow ✅ COMPLETE

- [x] org_id tracked from API key to impulse persistence
- [x] project_id tracked from session creation to impulse persistence
- [x] Impulse data flows through all layers (OpenCode → CLI → Backend → DB)
- [x] Data isolation works correctly (queries filtered by org_id/project_id)
- [x] impulse_registry and impulse_usage tables populated
- [x] Statistics calculate correctly (usage_count, success_rate)

### Reverse Flow ⚠️ INCOMPLETE

- [ ] MCP query tools retrieve learned impulses
- [ ] Session memory agent pre-loads high-success impulses
- [ ] Activity recommendations include proven impulses
- [ ] Lifecycle hooks trigger at correct points
- [ ] End-to-end test validates complete round-trip
- [ ] Data flows backward: DB → Backend → CLI → OpenCode

---

## Conclusion

### Summary

**Forward Flow:** ✅ **FULLY VALIDATED AND OPERATIONAL**
- Complete data path from OpenCode through CLI and Backend to SurrealDB
- org_id and project_id correctly tracked for multi-tenant isolation
- All impulse metadata persisted with proper schema

**Reverse Flow:** ⚠️ **ARCHITECTURE DESIGNED, NOT IMPLEMENTED**
- MCP query tools designed but not coded
- Session memory integration points identified but not built
- ~17 hours estimated to complete reverse flow implementation

### Next Steps

1. **Immediate:** Create MCP query tools (Phase 1 - 5 hours)
2. **Short-term:** Add backend API endpoints (Phase 2 - 2 hours)
3. **Medium-term:** Integrate with session memory agent (Phase 3 - 7 hours)
4. **Long-term:** Document and test complete bidirectional flow (Phase 4 - 3 hours)

### Risks

**Low Risk:** Forward flow is solid and production-ready. Reverse flow is well-designed and straightforward to implement.

**Dependency:** Reverse flow depends on session memory agent architecture being stable. Any changes to impulse loading mechanism will require rework.

---

**Report Date:** February 14, 2026  
**Next Review:** After Phase 1 MCP tools implementation  
**Validation Status:** Forward flow validated ✅ | Reverse flow pending implementation ⚠️
