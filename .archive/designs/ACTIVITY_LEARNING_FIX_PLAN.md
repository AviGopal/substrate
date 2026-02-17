# Activity Learning System - Implementation Fix Plan

**Status**: Investigation Complete (Feb 15, 2026)  
**Priority**: HIGH  
**Estimated Effort**: 2-3 weeks

## TL;DR

✅ **What Works**: Execution recording, step tracking, backend infrastructure  
❌ **What's Missing**: Impulse data extraction, component tracking, impulse registry tables  
🎯 **Goal**: Enable learning loop to recommend effective impulses and auto-commission variants

## Quick Wins (Day 1-2)

### 1. Create Impulse Registry Tables (30 minutes)

**File**: `repos/metabob-rpc-api/server/actions/init_activity_schema.py`

Add these tables after `activity_executions`:

```python
# Impulse Registry
await db.query("""
    DEFINE TABLE impulse_registry SCHEMAFULL;
    
    DEFINE FIELD impulse_id ON impulse_registry TYPE string;
    DEFINE FIELD content_hash ON impulse_registry TYPE string;
    DEFINE FIELD impulse_type ON impulse_registry TYPE string;
    DEFINE FIELD pointer ON impulse_registry TYPE object;
    DEFINE FIELD first_seen ON impulse_registry TYPE datetime;
    DEFINE FIELD last_used ON impulse_registry TYPE datetime;
    DEFINE FIELD usage_count ON impulse_registry TYPE int DEFAULT 0;
    DEFINE FIELD success_count ON impulse_registry TYPE int DEFAULT 0;
    DEFINE FIELD failure_count ON impulse_registry TYPE int DEFAULT 0;
    DEFINE FIELD effectiveness_rate ON impulse_registry TYPE float DEFAULT 0.0;
    DEFINE FIELD org_id ON impulse_registry TYPE string;
    DEFINE FIELD project_id ON impulse_registry TYPE string;
    DEFINE FIELD created_at ON impulse_registry TYPE datetime DEFAULT time::now();
    
    DEFINE INDEX impulse_id_idx ON impulse_registry FIELDS impulse_id UNIQUE;
    DEFINE INDEX content_hash_idx ON impulse_registry FIELDS content_hash;
    DEFINE INDEX org_project_idx ON impulse_registry FIELDS org_id, project_id;
    DEFINE INDEX effectiveness_idx ON impulse_registry FIELDS effectiveness_rate;
""")
logger.info("✓ Created impulse_registry table")

# Impulse Usage Tracking
await db.query("""
    DEFINE TABLE impulse_usage SCHEMAFULL;
    
    DEFINE FIELD execution_id ON impulse_usage TYPE string;
    DEFINE FIELD step_id ON impulse_usage TYPE string;
    DEFINE FIELD step_index ON impulse_usage TYPE int;
    DEFINE FIELD impulse_id ON impulse_usage TYPE string;
    DEFINE FIELD content_hash ON impulse_usage TYPE string;
    DEFINE FIELD was_useful ON impulse_usage TYPE bool DEFAULT true;
    DEFINE FIELD tokens_loaded ON impulse_usage TYPE int DEFAULT 0;
    DEFINE FIELD step_succeeded ON impulse_usage TYPE bool;
    DEFINE FIELD org_id ON impulse_usage TYPE string;
    DEFINE FIELD project_id ON impulse_usage TYPE string;
    DEFINE FIELD session_id ON impulse_usage TYPE string;
    DEFINE FIELD timestamp ON impulse_usage TYPE datetime DEFAULT time::now();
    
    DEFINE INDEX execution_idx ON impulse_usage FIELDS execution_id;
    DEFINE INDEX step_idx ON impulse_usage FIELDS execution_id, step_index;
    DEFINE INDEX impulse_idx ON impulse_usage FIELDS impulse_id;
    DEFINE INDEX session_idx ON impulse_usage FIELDS session_id;
    DEFINE INDEX org_project_idx ON impulse_usage FIELDS org_id, project_id;
""")
logger.info("✓ Created impulse_usage table")
```

**Run**:
```bash
docker exec metabob-rpc-api-server-dev-1 python -m server.actions.init_activity_schema
```

**Verify**:
```bash
docker exec -i metabob-surreal /surreal sql \
  --endpoint http://localhost:8000 \
  --username root --password root \
  --namespace metabob --database production \
  --pretty <<< 'INFO FOR DB;' | grep -E "impulse"
```

### 2. Implement Basic Impulse Tracking (4 hours)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

**Step 2.1**: Update `start_execution` to accept impulses parameter

```python
async def start_execution(
    self,
    activity_id: str,
    session_id: str,
    variables: dict = None,
    cost_budget: float = 1.0,
    variant_id: str = None,
    impulses: list = None,  # NEW
) -> dict:
    """Start executing an activity with impulse tracking."""
    
    # ... existing code ...
    
    # Store impulses for tracking
    if impulses:
        execution.impulses_available = impulses
        logger.info(f"Execution {execution_id} has {len(impulses)} available impulses")
```

**Step 2.2**: Update `_extract_impulses_used` to use stored impulses

```python
async def _extract_impulses_used(self, session_id: str) -> list[dict]:
    """
    Extract which impulses were loaded during execution.
    
    Now uses impulses passed during start_execution.
    """
    # Find execution for this session
    execution = None
    for exec_id, exec_obj in self._executions.items():
        if exec_obj.session_id == session_id:
            execution = exec_obj
            break
    
    if not execution:
        return []
    
    # Get impulses from execution state
    impulses_available = getattr(execution, 'impulses_available', [])
    if not impulses_available:
        return []
    
    # Convert to recording format
    return [
        {
            "impulse_id": imp.get("id", "unknown"),
            "content_hash": hashlib.sha256(
                str(imp.get("pointer", "")).encode()
            ).hexdigest()[:16],
            "tokens_used": imp.get("tokens_loaded", 0),
            "was_useful": True,  # Assume all loaded impulses were useful
        }
        for imp in impulses_available
    ]
```

**Step 2.3**: Update OpenCode activity tool to pass impulses

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

```typescript
// In activity tool handler
const execution = await activityManager.start_execution(
  activityId,
  sessionId,
  variables,
  costBudget,
  variantId,
  impulses  // NEW: Pass impulses from session memory
);
```

### 3. Test Impulse Tracking (1 hour)

**Test Script**: `scripts/test_impulse_tracking.py`

```python
import asyncio
import json
from metabob_cli.mcp.activity_manager import get_activity_manager
from metabob_cli.core.file_state import FileStateManager

async def test_impulse_tracking():
    """Test that impulse tracking works end-to-end."""
    
    # Get activity manager
    state = FileStateManager()
    config = state.get_config()
    manager = get_activity_manager(
        base_url=config.get("api_base_url"),
        session_token=state.get_session_token()
    )
    
    # Create test impulses
    test_impulses = [
        {
            "id": "test-impulse-1",
            "type": "memo",
            "pointer": {"content": "Test context 1"},
            "tokens_loaded": 100
        },
        {
            "id": "test-impulse-2",
            "type": "file",
            "pointer": {"filePath": "test.md"},
            "tokens_loaded": 200
        }
    ]
    
    # Start execution with impulses
    result = await manager.start_execution(
        activity_id="demo-315bfaf1",
        session_id="test-session-impulses",
        variables={},
        impulses=test_impulses
    )
    
    execution_id = result["execution_id"]
    print(f"✅ Started execution: {execution_id}")
    
    # Execute steps (simplified - would normally use get_next_step loop)
    # ... execution logic ...
    
    # Complete execution
    impulses_used = await manager._extract_impulses_used("test-session-impulses")
    print(f"✅ Extracted {len(impulses_used)} impulses")
    
    await manager.record_execution_complete(
        execution_id=execution_id,
        success=True,
        duration_ms=1000,
        cost=0.01,
        tokens=500,
        outcome="test_success",
        impulses_used=impulses_used
    )
    
    print(f"✅ Completed execution with impulse tracking")
    
    # Verify in database
    # TODO: Query impulse_registry and impulse_usage tables

if __name__ == "__main__":
    asyncio.run(test_impulse_tracking())
```

**Run**:
```bash
cd repos/metabob-cli
python3 scripts/test_impulse_tracking.py
```

**Verify**:
```sql
-- Check impulse_registry
SELECT impulse_id, usage_count, success_count, effectiveness_rate 
FROM impulse_registry;

-- Check impulse_usage
SELECT execution_id, impulse_id, was_useful, tokens_loaded
FROM impulse_usage
WHERE execution_id = 'exec_...';
```

## Medium Priority (Week 2)

### 4. Component Tracking via Git Diff (2 days)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

Implement `_extract_component_changes` properly:

```python
async def _extract_component_changes(self, execution_id: str) -> list[dict]:
    """
    Extract components changed during execution using git diff.
    """
    try:
        # Get changed files
        result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        
        if result.returncode != 0:
            return []
        
        changed_files = [f.strip() for f in result.stdout.split("\n") if f.strip()]
        
        # Get line counts per file
        diff_stat = subprocess.run(
            ["git", "diff", "--numstat", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        
        line_changes = {}
        for line in diff_stat.stdout.split("\n"):
            parts = line.split("\t")
            if len(parts) == 3:
                added, removed, filepath = parts
                line_changes[filepath] = {
                    "added": int(added) if added != "-" else 0,
                    "removed": int(removed) if removed != "-" else 0
                }
        
        component_changes = []
        
        for file_path in changed_files:
            # Use tree-sitter OR simple heuristics
            # For now: file-level tracking
            component_changes.append({
                "file_path": file_path,
                "component_name": file_path.split("/")[-1],
                "component_type": "file",
                "change_type": "modified",
                "lines_added": line_changes.get(file_path, {}).get("added", 0),
                "lines_removed": line_changes.get(file_path, {}).get("removed", 0)
            })
        
        return component_changes
        
    except Exception as e:
        logger.warning(f"Component extraction failed: {e}")
        return []
```

### 5. Goal-Based Validation (3 days)

**Add validation logic to activity templates**:

```json
{
  "validation": {
    "type": "goal-based",
    "feature": {
      "tests_pass": {
        "command": "npm test",
        "required": true
      },
      "component_exists": {
        "files": ["src/feature.ts"],
        "required": true
      }
    },
    "bugfix": {
      "regression_test": {
        "pattern": "test.*regression",
        "required": true
      },
      "tests_pass": {
        "command": "npm test",
        "required": true
      }
    }
  }
}
```

**Implement validator**:

```python
async def validate_execution_goal(
    execution_id: str,
    activity: dict,
    execution_result: dict
) -> dict:
    """
    Validate if execution achieved its goal.
    
    Returns:
        {
            "objective_success": bool,
            "validation_results": dict,
            "failure_reasons": list
        }
    """
    category = activity.get("category")
    validation = activity.get("validation", {})
    
    if validation.get("type") != "goal-based":
        # Fall back to agent self-assessment
        return {
            "objective_success": execution_result.get("success", False),
            "validation_results": {},
            "failure_reasons": []
        }
    
    # Run category-specific validation
    if category == "feature":
        return await validate_feature_goal(validation, execution_result)
    elif category == "bugfix":
        return await validate_bugfix_goal(validation, execution_result)
    # ... other categories
```

## Future Enhancements (Month 2+)

### 6. OpenCode MCP Integration

**Goal**: Direct access to OpenCode impulse registry via MCP

**Changes Needed**:
- Extend OpenCode MCP protocol with impulse query methods
- Add impulse registry endpoints to OpenCode
- Update CLI to query via MCP instead of activity variables

### 7. Metabob CPG Integration

**Goal**: Reliable component extraction using CPG

**Changes Needed**:
- Use `metabob_list_file_components` for changed files
- Compare before/after snapshots
- Track component-level changes (not just file-level)

### 8. Auto-Variant Commissioning

**Goal**: Automatically create variants from successful patterns

**Implementation**: Already partially exists in `variant_commissioning.py`

**Enable**:
- Ensure impulse data is available
- Lower threshold from 3 to 2 successful patterns
- Add logging/notifications when variants commissioned

## Validation Checklist

- [ ] Impulse registry tables created
- [ ] Test execution records impulses
- [ ] `impulse_registry` table populated
- [ ] `impulse_usage` table populated
- [ ] Component tracking extracts files
- [ ] Goal-based validation runs
- [ ] Thompson Sampling uses impulse data
- [ ] Variant commissioning triggers

## Success Metrics

**Week 1**:
- 10+ executions with `impulses_used` populated
- 50+ impulse_registry entries
- 100+ impulse_usage entries

**Week 2**:
- Component tracking working for 80% of executions
- Goal-based validation implemented for 3 categories
- Impulse effectiveness rates calculated

**Month 2**:
- First auto-commissioned variant created
- Impulse recommendations working
- Cross-execution learning queries functional

## Resources

- Investigation Report: `ACTIVITY_LEARNING_SYSTEM_INVESTIGATION_FEB15.md`
- Backend Code: `repos/metabob-rpc-api/server/`
- CLI Code: `repos/metabob-cli/src/metabob_cli/mcp/`
- Database: SurrealDB at `metabob.production` (not `metabob.main`!)
