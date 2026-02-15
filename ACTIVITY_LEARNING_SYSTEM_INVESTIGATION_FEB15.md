# Activity Learning System Investigation - Feb 15, 2026

## Executive Summary

**Previous Assessment Was Incorrect**: The session summary claimed execution recording was disabled due to a backend bug. **This is FALSE** - execution recording is fully functional.

**Actual Status**:
- ✅ **Execution Recording**: WORKING (records to `metabob.production` DB)
- ⚠️  **Impulse Tracking**: NOT IMPLEMENTED (arrays always empty)
- ⚠️  **Component Tracking**: NOT IMPLEMENTED (arrays always empty)
- ✅ **Step Recording**: WORKING (execution_steps table populated)
- ❌ **Impulse Registry Tables**: DO NOT EXIST
- ✅ **Learning Infrastructure**: EXISTS (outcome models, learning actions)

## Key Findings

### Finding 1: Execution Recording Works Perfectly

**Evidence**:
```sql
SELECT execution_id, activity_id, success, total_cost 
FROM activity_executions 
ORDER BY timestamp DESC LIMIT 10;

-- Returns 10 executions from demo-315bfaf1
-- 3 successful ($0.02 each)
-- 7 failed (authentication issues before fix)
```

**Endpoint Status**:
- POST `/v2/activities/record/start` - ✅ Working
- POST `/v2/activities/record/step` - ✅ Working  
- POST `/v2/activities/record/complete` - ✅ Working

**Schema**: `activity_executions` table fully defined with all Phase 2 fields:
- `impulses_used: array DEFAULT []`
- `component_changes: array DEFAULT []`
- `session_id: option<string>`

### Finding 2: Wrong Database Was Queried

**Previous Error**: Queried `metabob.main` database  
**Correct Database**: `metabob.production` database

The backend is configured to use `production` DB but local queries were hitting `main` DB, making it appear that no data was being recorded.

### Finding 3: Impulse Tracking Not Implemented in CLI

**Backend Ready**: 
- `/v2/activities/record/step` accepts `impulses_loaded`, `impulses_created`
- `/v2/activities/record/complete` accepts `impulses_used`
- `persist_step_impulses()` function implemented in `impulse_registry.py`

**CLI Not Sending Data**:
```python
# repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py

async def _extract_impulses_used(self, session_id: str) -> list[dict]:
    """
    Extract which impulses were loaded during execution.
    
    Returns empty list with TODO comment:
    "TODO: Track actual usage via LLM calls"
    """
    return []  # ⚠️ ALWAYS RETURNS EMPTY
```

**Evidence from Database**:
```sql
SELECT impulses_loaded, impulses_created 
FROM execution_steps 
LIMIT 20;

-- ALL results: [], []
-- Even for successful multi-step executions
```

### Finding 4: Impulse Registry Tables Don't Exist

**Expected Tables** (from `impulse_registry.py`):
- `impulse_registry`: Stores unique impulses with content hashes
- `impulse_usage`: Tracks which impulses were used in which executions

**Actual Tables** (from `INFO FOR DB`):
```
tables: {
    execution_steps: 'DEFINE TABLE execution_steps TYPE ANY SCHEMALESS',
    [other tables...]
}
-- impulse_registry: MISSING
-- impulse_usage: MISSING
```

**Impact**: Even if CLI sent impulse data, backend would fail to persist it to registry tables.

### Finding 5: Component Tracking Not Implemented

**Backend Ready**:
- `store_component_changes()` in `component_tracking.py`
- Phase 2 schema fields in `activity_executions`

**CLI Not Sending Data**:
```python
async def _extract_component_changes(self, execution_id: str) -> list[dict]:
    """
    Extract components changed during execution using git diff.
    
    Implementation exists but:
    - Requires watcher to be initialized
    - Watcher often not available in CLI context
    - Returns [] on any error
    """
```

**Evidence**: All executions have `component_changes: []`

## Critical Gaps for Learning System

### Gap #1: No Impulse Data → No Context Learning

**Problem**: Learning system cannot determine which context/impulses lead to success

**Required Data** (missing):
```json
{
  "impulses_loaded": [
    {
      "id": "activity-system-status",
      "type": "file",
      "pointer": {"filePath": "ACTIVITY_SYSTEM_WORKING.md"},
      "tokens_loaded": 1835,
      "was_useful": true  // ⚠️ Cannot determine without tracking
    }
  ]
}
```

**Impact**: 
- Cannot recommend impulses for future executions
- Cannot auto-commission variants with successful impulse patterns
- Cannot measure impulse effectiveness

### Gap #2: No Component Tracking → No Impact Analysis

**Problem**: Learning system cannot correlate activity executions with actual code changes

**Required Data** (missing):
```json
{
  "component_changes": [
    {
      "file_path": "src/feature.ts",
      "component_name": "UserAuth.validate",
      "component_type": "method",
      "change_type": "modified",
      "lines_added": 15,
      "lines_removed": 3
    }
  ]
}
```

**Impact**:
- Cannot measure if activity modified expected components
- Cannot learn which activities are effective for specific components
- Cannot track component-level success patterns

### Gap #3: No Success Validation → Thompson Sampling Without Ground Truth

**Problem**: `success: bool` is set by agent self-assessment, not objective validation

**Current Logic**:
```python
execution.success = all(step.success for step in steps)
# Where step.success is agent's opinion, not validated outcome
```

**Required**: Goal-based validation per category:
- **Feature**: Does feature work? Tests pass? Component exists?
- **Bugfix**: Is bug fixed? Regression test added and passing?
- **Refactor**: Structure improved? No functionality broken?

**Impact**:
- Thompson Sampling optimizes for "agent thinks it worked"
- Not optimizing for "it actually worked"
- Variant effectiveness metrics unreliable

## Root Cause Analysis

### Why Was This Missed?

**Session Summary Error**: Claimed recording was "disabled" due to backend bug. This led to:
1. Assumption that fix was needed at backend level
2. No investigation into whether data was actually being recorded
3. No check of production database vs main database

**Actual Issue**: Implementation gap at CLI level, not backend bug.

### Design vs Implementation Gap

**Design Documents Show**:
- Impulse tracking was architected (Phase 1 & 2 schemas)
- Backend endpoints accept impulse data
- Learning actions ready to consume impulse data

**Implementation Reality**:
- CLI methods return empty arrays
- No integration between OpenCode impulse system and activity recording
- No watcher integration for component extraction

## Fixes Required

### Fix #1: Implement CLI Impulse Tracking (4-6 hours)

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

**Required Changes**:

1. **Extract impulses from OpenCode session**:
```python
async def _extract_impulses_used(self, session_id: str) -> list[dict]:
    # Option 1: Pass impulses via activity variables (CURRENT PARTIAL IMPL)
    impulses_from_vars = execution.variables.get("impulses_loaded", [])
    
    # Option 2: Query OpenCode MCP for session impulses (NEW - REQUIRES MCP EXTENSION)
    # Would need OpenCode to expose impulse registry via MCP
    
    # Option 3: Parse from step outputs (FRAGILE)
    # Look for impulse IDs in step prompts/outputs
```

2. **Send impulse data with steps**:
```python
await client.post("/v2/activities/record/step", json={
    "execution_id": execution_id,
    "step_order": step_index,
    "impulses_loaded": extracted_impulses,  # NEW
    "impulses_created": new_impulses,       # NEW
    "context_summary": {                    # NEW
        "total_tokens": sum(imp["tokens"] for imp in extracted_impulses),
        "impulse_count": len(extracted_impulses)
    }
})
```

**Validation**: Query execution_steps table after execution, verify arrays populated

### Fix #2: Create Impulse Registry Tables (30 minutes)

**Add to**: `repos/metabob-rpc-api/server/actions/init_activity_schema.py`

```python
# After activity_executions table definition:

await db.query("""
    DEFINE TABLE impulse_registry SCHEMAFULL;
    
    DEFINE FIELD impulse_id ON impulse_registry TYPE string;
    DEFINE FIELD content_hash ON impulse_registry TYPE string;
    DEFINE FIELD impulse_type ON impulse_registry TYPE string;
    DEFINE FIELD pointer ON impulse_registry TYPE object;
    DEFINE FIELD first_seen ON impulse_registry TYPE datetime;
    DEFINE FIELD usage_count ON impulse_registry TYPE int DEFAULT 0;
    DEFINE FIELD success_count ON impulse_registry TYPE int DEFAULT 0;
    DEFINE FIELD effectiveness_rate ON impulse_registry TYPE float DEFAULT 0.0;
    
    DEFINE INDEX impulse_id_idx ON impulse_registry FIELDS impulse_id UNIQUE;
    DEFINE INDEX content_hash_idx ON impulse_registry FIELDS content_hash;
""")

await db.query("""
    DEFINE TABLE impulse_usage SCHEMAFULL;
    
    DEFINE FIELD execution_id ON impulse_usage TYPE string;
    DEFINE FIELD step_id ON impulse_usage TYPE string;
    DEFINE FIELD impulse_id ON impulse_usage TYPE string;
    DEFINE FIELD was_useful ON impulse_usage TYPE bool;
    DEFINE FIELD tokens_loaded ON impulse_usage TYPE int;
    DEFINE FIELD timestamp ON impulse_usage TYPE datetime;
    
    DEFINE INDEX execution_idx ON impulse_usage FIELDS execution_id;
    DEFINE INDEX impulse_idx ON impulse_usage FIELDS impulse_id;
""")
```

**Run**: `docker exec metabob-rpc-api-server-dev-1 python -m server.actions.init_activity_schema`

### Fix #3: Implement Component Tracking (2-3 hours)

**Approach 1**: Git diff integration (current stub)
```python
async def _extract_component_changes(self, execution_id: str) -> list[dict]:
    # Get changed files from git
    changed_files = subprocess.run(["git", "diff", "--name-only", "HEAD"])
    
    # For each file, use tree-sitter to extract components
    # Requires watcher integration OR direct tree-sitter call
    
    # Return structured component changes
```

**Approach 2**: Metabob CPG integration (more reliable)
```python
# Use metabob_list_file_components for changed files
# Compare before/after snapshots to detect changes
```

**Approach 3**: Manual annotation (short-term workaround)
```python
# Activity variables can include expected component changes
component_changes = execution.variables.get("expected_components", [])
```

### Fix #4: Implement Goal-Based Validation (3-4 hours)

**Add to activity templates**:
```json
{
  "validation": {
    "type": "goal-based",
    "success_criteria": {
      "feature": {
        "tests_pass": true,
        "component_exists": true,
        "functionality_verified": true
      },
      "bugfix": {
        "regression_test_added": true,
        "regression_test_passes": true,
        "original_bug_fixed": true
      }
    }
  }
}
```

**Implement validator**:
```python
async def validate_execution_success(
    execution_id: str,
    activity_category: str,
    success_criteria: dict
) -> dict:
    """
    Objectively validate execution success.
    
    Returns:
        {
            "objective_success": bool,
            "criteria_met": dict[str, bool],
            "failure_reasons": list[str]
        }
    """
```

## Testing Plan

### Test 1: Impulse Tracking End-to-End

1. Create test activity with impulse requirements
2. Execute activity with impulses in variables
3. Query `execution_steps` - verify `impulses_loaded` populated
4. Query `impulse_registry` - verify impulses registered
5. Query `impulse_usage` - verify usage tracked

### Test 2: Component Tracking

1. Execute activity that modifies code
2. Query `component_changes` in `activity_executions`
3. Verify components detected and tracked

### Test 3: Learning Loop

1. Execute same activity 3 times with different impulses
2. Query `impulse_effectiveness` table
3. Verify effectiveness rates calculated
4. Test `recommend_impulses` returns high-effectiveness impulses

## Recommendations

### Immediate Actions (Week 1)

1. ✅ **Document current state** (this document)
2. ⚠️ **Create impulse registry tables** (30 min)
3. ⚠️ **Implement basic impulse tracking** (1 day)
   - Option 3 approach: activity variables
   - Allows testing without MCP changes
4. ⚠️ **Test with demo activity** (2 hours)

### Short-Term (Week 2-3)

1. **Component tracking via git diff** (2 days)
2. **Goal-based validation prototype** (3 days)
3. **Learning queries working** (1 day)
4. **Thompson Sampling using real data** (2 days)

### Medium-Term (Month 2)

1. **OpenCode MCP integration** for impulse access
2. **Metabob CPG integration** for component tracking
3. **Auto-variant commissioning** based on patterns
4. **Cross-project learning** queries

## Success Metrics

### Phase 1: Data Collection (Week 1-2)
- ✅ Impulse registry tables created
- ✅ 10+ executions with populated `impulses_loaded`
- ✅ 5+ executions with populated `component_changes`

### Phase 2: Learning Queries (Week 3-4)
- ✅ `recommend_impulses()` returns non-empty results
- ✅ `impulse_effectiveness` table has >50 entries
- ✅ Thompson Sampling uses impulse effectiveness data

### Phase 3: Variant Evolution (Month 2)
- ✅ Auto-commissioned variant created from pattern
- ✅ New variant outperforms parent template
- ✅ Cross-project impulse recommendations working

## Conclusion

**Previous Assessment**: "Activity execution mysteriously stops at line 741"
**Reality**: Execution works perfectly, we just weren't looking at the right database

**Previous Gap**: "Backend recording endpoint has bug"
**Reality**: Backend works perfectly, CLI just isn't sending the right data

**Next Steps**:
1. Fix impulse tracking in CLI (highest priority)
2. Create impulse registry tables
3. Test learning loop end-to-end
4. Iterate based on data quality

The infrastructure is 80% complete. The missing 20% is:
- CLI integration for impulse extraction
- Table creation for impulse registry
- Validation logic for objective success measurement

Estimated total effort: **2-3 weeks** for full learning loop functionality.
