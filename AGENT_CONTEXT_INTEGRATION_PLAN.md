# Agent Context Integration Plan

**Date**: February 13, 2026  
**Status**: Implementation in progress  
**Context**: Phase 1 completion - connecting OpenCode impulse tracking to CLI activity execution

---

## Problem Statement

We have:
- ✅ CLI activity manager with impulse tracking fields (`StepResult.impulses_loaded/created`)
- ✅ Backend schema with impulse tracking (`execution_steps.impulses_loaded/created`)
- ✅ OpenCode session state with impulse tracking (`Activity.impulses`, `SessionState.ImpulseState`)

But these systems are **disconnected**. When OpenCode executes an activity step, the impulse context is tracked in OpenCode's session state but **not propagated** to the CLI's activity manager.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ OpenCode Session (TypeScript)                               │
│                                                              │
│  ┌──────────────────┐     ┌───────────────────┐           │
│  │ Memory Agent     │────▶│ SessionState      │           │
│  │ (loads impulses) │     │ - impulses map    │           │
│  └──────────────────┘     │ - loadedCount     │           │
│                            │ - impulseState    │           │
│                            └───────────────────┘           │
│                                     │                       │
│                                     │ (currently missing)   │
│                                     ▼                       │
│                            ┌───────────────────┐           │
│                            │ MCP Tool Call     │           │
│                            │ activity_tool     │           │
│                            │ (step execution)  │           │
│                            └───────────────────┘           │
└─────────────────────────────────────────────────────────────┘
                                     │
                                     │ (RPC/IPC)
                                     ▼
┌─────────────────────────────────────────────────────────────┐
│ CLI Activity Manager (Python)                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ report_step_result()                                  │  │
│  │ - impulses_loaded: list[str] ← NEED TO POPULATE     │  │
│  │ - impulses_created: list[str] ← NEED TO POPULATE    │  │
│  │ - context_summary: dict ← NEED TO POPULATE          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                     │                       │
│                                     ▼                       │
│                            ┌───────────────────┐           │
│                            │ Backend API       │           │
│                            │ record_step       │           │
│                            └───────────────────┘           │
└─────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend Storage (SurrealDB)                                 │
│                                                              │
│  execution_steps table:                                     │
│  - impulses_loaded: array ✅                                │
│  - impulses_created: array ✅                               │
│  - context_summary: object ✅                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Approaches

### Approach 1: Explicit Parameter Passing (RECOMMENDED)

**How it works**: OpenCode activity tool explicitly passes impulse IDs when calling CLI MCP tools.

**Changes Required**:
1. **OpenCode**: Modify `activity_report_step_result` MCP tool call to include impulse metadata
2. **CLI**: Receive impulse data via tool parameters (already implemented)

**Implementation**:

```typescript
// In repos/metabob-opencode/packages/opencode/src/tool/activity.ts
// Around line 1575 (after step execution)

// Extract loaded impulses from activity state
const loadedImpulses = task.impulseReferences?.map(id => {
  const impulse = _activity.impulses[id]
  return {
    id,
    loaded: impulse && impulse.tokenCount !== undefined && impulse.tokenCount > 0,
    tokens: impulse?.tokenCount || 0
  }
}).filter(i => i.loaded) || []

// Call MCP tool with impulse data
await ctx.invoke("activity_report_step_result", {
  execution_id: activityID,
  step_id: currentTask.id,
  success: taskResult.success,
  output: taskResult.output,
  // NEW: Pass impulse tracking
  impulses_loaded: JSON.stringify(loadedImpulses.map(i => i.id)),
  context_summary: JSON.stringify({
    impulseCount: loadedImpulses.length,
    totalTokens: loadedImpulses.reduce((sum, i) => sum + i.tokens, 0),
    source: "activity-execution"
  })
})
```

**Pros**:
- ✅ Simple and direct
- ✅ No new infrastructure needed
- ✅ Works immediately
- ✅ Already supported by CLI (impulses_loaded parameter exists)

**Cons**:
- ❌ Requires modifying OpenCode activity tool
- ❌ Coupling between OpenCode and CLI schemas

**Effort**: ~1 hour

---

### Approach 2: Session State Query (FUTURE)

**How it works**: CLI queries OpenCode session state via MCP to get impulse information.

**Changes Required**:
1. **OpenCode**: Add MCP tool `get_session_impulses({ session_id })`
2. **CLI**: Call MCP tool before `report_step_result()`

**Implementation**:

```typescript
// In repos/metabob-opencode/packages/opencode/src/tool/session-tools.ts (new file)

@tool({
  name: "get_session_impulses",
  description: "Get currently loaded impulses for a session"
})
async function get_session_impulses(input: {
  session_id: string
}): Promise<{
  impulses: Array<{
    id: string
    type: string
    loaded: boolean
    tokens: number
    budget: number
  }>
  totalTokens: number
  loadedCount: number
}> {
  const session = await Session.get(input.session_id)
  const state = await SessionState.get(session)
  
  return {
    impulses: state.impulseState.impulses.map(imp => ({
      id: imp.id,
      type: imp.type,
      loaded: imp.tokenCount !== undefined && imp.tokenCount > 0,
      tokens: imp.tokenCount || 0,
      budget: imp.budget
    })),
    totalTokens: state.impulseState.usedTokens,
    loadedCount: state.impulseState.loadedCount
  }
}
```

```python
# In repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py

async def _capture_session_impulses(self, session_id: str) -> list[dict]:
    """Query OpenCode session state via MCP"""
    try:
        # Call OpenCode MCP tool to get impulse state
        response = await self._call_opencode_mcp("get_session_impulses", {
            "session_id": session_id
        })
        
        impulses = response.get("impulses", [])
        return [
            {
                "impulse_id": imp["id"],
                "tokens_used": imp["tokens"],
                "was_useful": True  # Default for now
            }
            for imp in impulses if imp["loaded"]
        ]
    except Exception as e:
        logger.warning(f"Failed to query session impulses: {e}")
        return []
```

**Pros**:
- ✅ Clean separation of concerns
- ✅ Works for any execution context (not just activities)
- ✅ No coupling between OpenCode and CLI

**Cons**:
- ❌ Requires bidirectional MCP communication (CLI → OpenCode)
- ❌ More complex infrastructure
- ❌ Higher latency (extra RPC call)

**Effort**: ~4 hours

---

### Approach 3: Event Stream (OVERKILL)

**How it works**: OpenCode emits events when impulses are loaded/unloaded, CLI subscribes.

**Not recommended** - too complex for current needs.

---

## Recommended Approach: **Approach 1 (Explicit Parameter Passing)**

**Why**:
1. Simple and direct
2. Lowest effort (~1 hour)
3. Already supported by CLI infrastructure
4. Sufficient for current needs

**Implementation Steps**:

### Step 1: Modify OpenCode Activity Tool (30 min)

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Location**: Around line 1575 (after step execution, before returning result)

**Changes**:
1. Extract loaded impulses from `_activity.impulses`
2. Calculate context summary (count, tokens)
3. Pass to `activity_report_step_result` MCP call

### Step 2: Test Integration (30 min)

**Test script**: `scripts/test-phase1-agent-context-integration.py`

**Test flow**:
1. Create activity template with impulseReferences
2. Execute activity
3. Verify impulses_loaded populated in StepResult
4. Verify data flows to backend
5. Query execution_steps table to confirm storage

---

## Integration Points

### OpenCode → CLI Data Flow

**When**: After each task execution (step complete)

**What gets passed**:
```json
{
  "execution_id": "exec-abc123",
  "step_id": "task-1",
  "success": true,
  "output": "Step completed successfully",
  "impulses_loaded": "[\"recentCommits\", \"errorFile\"]",
  "impulses_created": "[]",
  "context_summary": "{\"impulseCount\": 2, \"totalTokens\": 3500, \"source\": \"activity-execution\"}"
}
```

**How**: Via MCP tool call `activity_report_step_result`

### CLI → Backend Data Flow

**When**: Immediately after receiving step result

**What gets stored**:
```python
StepResult(
    step_id="task-1",
    success=True,
    output="...",
    impulses_loaded=["recentCommits", "errorFile"],
    impulses_created=[],
    context_summary={
        "impulseCount": 2,
        "totalTokens": 3500,
        "source": "activity-execution"
    }
)
```

**How**: Via backend API `POST /v2/activities/record/step`

---

## Success Criteria

**After implementation**:

1. ✅ OpenCode activity executions track loaded impulses
2. ✅ CLI receives impulse data per step
3. ✅ Backend stores impulse data in execution_steps
4. ✅ Data queryable via execution analytics
5. ✅ No performance impact (<10ms overhead per step)

**Validation**:
```bash
# Run test
python3 scripts/test-phase1-agent-context-integration.py

# Expected output:
# ✅ Step 1: impulses_loaded = ['recentCommits', 'configFile']
# ✅ Step 2: impulses_loaded = ['errorLog']
# ✅ Backend verification: execution_steps.impulses_loaded populated
# ✅ Context summary: {"impulseCount": 3, "totalTokens": 5200}
```

---

## Rollout Plan

### Phase 1a: OpenCode Changes (30 min)
- Modify activity.ts to pass impulse data
- Test with sample activity

### Phase 1b: Integration Testing (30 min)
- Create test script
- Run E2E test
- Verify backend storage

### Phase 1c: Documentation (30 min)
- Update architecture diagrams
- Document data flow
- Mark Phase 1 complete

**Total time**: ~90 minutes

---

## Alternatives Considered

### Why not use Approach 2 (Session State Query)?

**Reason**: Adds complexity without clear benefit for current needs.

**When to reconsider**: If we need impulse tracking for non-activity contexts (e.g., interactive sessions, ACP delegations).

### Why not track impulse *creation*?

**Reason**: Impulse creation happens at OpenCode level (via `impulse_create` tool). This is already tracked in session history and doesn't need activity-level tracking.

**When to reconsider**: If we want to track which steps *produce* reusable context for future activities.

---

## Next Steps After This Task

**Immediate** (Phase 1 completion):
1. Complete agent context integration ← **THIS TASK**
2. Run final E2E validation
3. Update GOALS_ALIGNMENT_ASSESSMENT.md to mark Phase 1 complete

**Phase 2** (Nice-to-have improvements):
1. Implement Approach 2 (session state query) for broader context tracking
2. Add impulse usefulness scoring (track which impulses led to successful steps)
3. Visualize impulse usage in dashboard

---

## References

**Key Files**:
- OpenCode activity tool: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
- CLI activity manager: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`
- Backend schema: `repos/metabob-rpc-api/server/actions/v2_activities.py`

**Related Docs**:
- `GOALS_ALIGNMENT_ASSESSMENT.md` - Overall Phase 1 goals
- `PHASE1_IMPULSE_TRACKING_COMPLETE.md` - Impulse tracking infrastructure
- `PHASE1_ISOLATED_WORKSPACE_COMPLETE.md` - Isolated workspace infrastructure

---

**Status**: Ready for implementation  
**Estimated completion**: 90 minutes  
**Risk**: Low - straightforward data plumbing
