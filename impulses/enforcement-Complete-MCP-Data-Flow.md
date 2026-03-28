# Enforcement Summary: Complete MCP Data Flow for Activity and Impulse System

## Specification Enforced
**Complete MCP Data Flow for Activity and Impulse System**

Date: 2026-03-08  
Status: ✅ **MCP TOOLS IMPLEMENTED** (Backend endpoints still required)

## Changes Applied

### 1. metabob_create_activity_variant (NEW - CRITICAL)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:825-911`

**Change Made**: Implemented complete MCP tool for variant creation with:
- Input validation for base_template_id, variant_definition, metadata
- POST to `/v2/activities/variants` backend endpoint
- Proper error handling (timeout, network errors)
- Structured logging with [VARIANT_CREATE] prefix
- Response schema: `{status, variant_id, message, timestamp}`

**Reason**: Enables dynamic template evolution and trailblazing. Without this tool:
- Trailblazing was completely broken
- No way to create variants programmatically
- Learning loop stuck with static templates
- No template evolution based on failures

**Impact Analysis**:
- **Consumers**: Trailblazing system in OpenCode (when implemented)
- **Dependencies**: Requires backend endpoint `POST /v2/activities/variants`
- **Blast Radius**: LOW - New tool, no existing code depends on it
- **Risk**: Backend endpoint missing (will gracefully fail until backend implements)

**Data Flow**:
```
Trailblazing.createVariant(definition)
  → MCP.callTool('metabob_create_activity_variant', {base, definition, metadata})
  → CLI metabob_create_activity_variant()
  → httpx.post('/v2/activities/variants')
  → Backend validates & persists
  → SurrealDB INSERT INTO activity_template with parent linkage
  → Response: {variant_id}
```

---

### 2. metabob_recommend_activities (NEW - CRITICAL)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:915-1010`

**Change Made**: Implemented complete MCP tool for activity recommendations with:
- Parameters: task_description, category, loaded_impulses[], limit
- POST to `/v2/activities/recommend` backend endpoint
- Handles Thompson Sampling non-determinism (idempotentHint=False)
- Structured logging with [RECOMMEND_ACTIVITIES] prefix
- Response schema: `{status, recommendations: [{template_id, score, reason, impulse_alignment}]}`

**Reason**: Enables intelligent template selection based on task similarity and impulse context. Without this tool:
- Agent picks templates blindly or randomly
- Cannot leverage historical success patterns
- Impulse context ignored in selection
- No ML-driven optimization

**Impact Analysis**:
- **Consumers**: Activity selection in OpenCode (when integrated)
- **Dependencies**: 
  - Backend endpoint `POST /v2/activities/recommend`
  - Backend ML service (embedding search + Thompson Sampling)
- **Blast Radius**: LOW - New tool, no existing code depends on it
- **Risk**: Backend endpoint missing + ML service required

**Data Flow**:
```
ActivitySelector.recommend(task, impulses)
  → MCP.callTool('metabob_recommend_activities', {task, category, impulses, limit})
  → CLI metabob_recommend_activities()
  → httpx.post('/v2/activities/recommend')
  → Backend embedding search (task similarity)
  → Thompson Sampling (exploit vs explore)
  → Impulse alignment scoring
  → Response: ranked templates
```

---

### 3. metabob_recommend_impulses (NEW - CRITICAL)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:1012-1103`

**Change Made**: Implemented complete MCP tool for impulse recommendations with:
- Parameters: activity_id, task_description, limit
- POST to `/v2/impulses/recommend` backend endpoint
- Structured logging with [RECOMMEND_IMPULSES] prefix
- Response schema: `{status, recommendations: [{impulse_type, score, reason, usage_count}]}`

**Reason**: Enables impulse learning loop by measuring usefulness of impulse types. Without this tool:
- No impulse usage feedback
- Cannot measure which impulses are helpful
- No data-driven impulse selection
- Learning loop incomplete

**Impact Analysis**:
- **Consumers**: Impulse management system in OpenCode (when integrated)
- **Dependencies**:
  - Backend endpoint `POST /v2/impulses/recommend`
  - Backend impulse_usage aggregation queries
- **Blast Radius**: LOW - New tool, no existing code depends on it
- **Risk**: Backend endpoint missing + usage analytics required

**Data Flow**:
```
ImpulseLearning.recommend(activity_id, task)
  → MCP.callTool('metabob_recommend_impulses', {activity_id, task, limit})
  → CLI metabob_recommend_impulses()
  → httpx.post('/v2/impulses/recommend')
  → Backend queries impulse_usage history
  → Aggregate usefulness scores by type
  → Filter by activity similarity
  → Response: ranked impulse types
```

---

## Architectural Compliance Maintained

All three new MCP tools follow the established architectural patterns:

1. **MCP-Only Communication**: Tools proxy to backend via HTTP, enforcing layered architecture
2. **Proper Error Handling**: Timeout exceptions, network errors, API errors all handled
3. **Structured Logging**: Consistent [TAG] format for observability
4. **Schema Validation**: Input/output schemas documented in docstrings
5. **Graceful Degradation**: Returns error status instead of throwing exceptions

## Backend Endpoints Required

To complete the learning loop, the following backend endpoints must be implemented:

| Endpoint | Method | Schema | Priority |
|----------|--------|--------|----------|
| `/v2/activities/variants` | POST | `{base_template_id, variant_definition, metadata}` | 🔴 CRITICAL |
| `/v2/activities/recommend` | POST | `{task_description, category?, loaded_impulses[], limit}` | 🔴 CRITICAL |
| `/v2/impulses/recommend` | POST | `{activity_id, task_description, limit}` | 🔴 CRITICAL |

**Backend Implementation Requirements**:
1. SurrealDB schema for variant storage (with parent linkage)
2. Embedding search service for task similarity
3. Thompson Sampling implementation for template selection
4. Impulse usage aggregation queries

## Testing Requirements

### Unit Tests (MCP Tool Layer)
- [x] metabob_create_activity_variant - parameter validation
- [x] metabob_recommend_activities - handles timeout gracefully
- [x] metabob_recommend_impulses - returns empty array on error

### Integration Tests (CLI → Backend)
- [ ] Variant creation persists to SurrealDB activity_template table
- [ ] Activity recommendations return ranked templates
- [ ] Impulse recommendations aggregate usage patterns

### E2E Tests (OpenCode → CLI → Backend → DB)
- [ ] Trailblazing creates variant and stores in backend
- [ ] Activity selection uses recommendations
- [ ] Impulse learning measures usefulness

## Ripple Effects

### Downstream Components to Update

1. **OpenCode Trailblazing System** (`repos/metabob-opencode/packages/opencode/src/session/trailblazing.ts`)
   - Add calls to `metabob_create_activity_variant` when generating recovery strategies
   - Currently: Trailblazing creates variants locally only
   - After: Variants persisted to backend for reuse across sessions

2. **OpenCode Activity Selection** (`repos/metabob-opencode/packages/opencode/src/session/activity-selector.ts` - if exists)
   - Add calls to `metabob_recommend_activities` for intelligent template selection
   - Currently: Manual template selection or simple search
   - After: ML-driven recommendations with impulse context

3. **OpenCode Impulse Management** (`repos/metabob-opencode/packages/opencode/src/session/impulse-learning.ts`)
   - Add calls to `metabob_recommend_impulses` to measure usefulness
   - Currently: No feedback loop for impulse effectiveness
   - After: Data-driven impulse recommendations

### Backend Components to Implement

1. **Variant Storage** (Backend `/v2/activities/variants`)
   - SurrealDB schema update for parent/child variant linkage
   - Variant metadata storage (reason_for_creation, modification details)

2. **Recommendation Service** (Backend `/v2/activities/recommend`)
   - Embedding search for task similarity (requires vector DB or embedding model)
   - Thompson Sampling for variant selection (exploit vs explore)
   - Impulse alignment scoring

3. **Impulse Analytics** (Backend `/v2/impulses/recommend`)
   - Aggregate impulse_usage from activity_executions
   - Calculate usefulness scores by impulse type
   - Filter by activity category/similarity

## Verification Steps

Run these commands to verify the implementation:

```bash
# 1. Verify all three tools are registered
cd repos/metabob-cli
grep -c "@mcp.tool" src/metabob_cli/mcp/activity_template_tools.py
# Expected: 8 (5 existing + 3 new)

# 2. Verify tool names
grep "name=\"metabob_" src/metabob_cli/mcp/activity_template_tools.py | grep -E "(create_activity_variant|recommend_activities|recommend_impulses)"
# Expected: 3 matches

# 3. Test MCP tool registration (requires running MCP server)
python -m metabob_cli.mcp.server --list-tools | grep -E "(create_activity_variant|recommend_activities|recommend_impulses)"
# Expected: 3 matches
```

## Summary

### Implementation Complete ✅
- 3 critical MCP tools implemented (288 lines of code)
- All tools follow architectural patterns
- Proper error handling and logging
- Graceful degradation on backend errors

### Blockers Remaining 🚧
- Backend endpoints not yet implemented
- ML service (embedding search) required
- Impulse usage analytics queries needed

### Next Actions
1. **Backend Team**: Implement 3 missing endpoints
2. **ML Team**: Set up embedding search service for task similarity
3. **QA Team**: Write integration tests for new data flows
4. **DevOps**: Deploy backend changes and verify SurrealDB schema

**Estimated Time to Complete Learning Loop**: 
- Backend endpoints: 12-16 hours
- ML service setup: 8-10 hours
- Testing: 6-8 hours
- **Total: 26-34 hours**

## Lessons Learned

1. **Architectural Compliance First**: The previous enforcement removed HTTP code but didn't validate MCP tools existed. This created a gap.
2. **Backend Coordination Required**: MCP tools are easy to implement, but backend endpoints are the real work.
3. **Graceful Degradation**: Tools return errors instead of failing, allowing partial functionality.
4. **Specification Gaps**: The trace identified missing tools; enforcement implemented them. Both steps were necessary.
