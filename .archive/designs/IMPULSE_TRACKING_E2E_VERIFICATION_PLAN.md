# Impulse Tracking End-to-End Verification Plan

**Date**: February 15, 2026  
**Status**: Ready for execution (when templates are registered)

## Current State

✅ **Bug Fix Complete**: `activity_manager.py` line 1069-1084 correctly reads from `execution.impulses_used`  
✅ **Unit Tests Pass**: Verified the fix works correctly (see previous session)  
✅ **Backend Running**: API server on port 8080, SurrealDB on port 8000  
❌ **Templates**: No templates currently registered in backend

## Why E2E Testing is Blocked

The backend database currently has 0 templates registered:

```bash
curl -s http://localhost:8080/v2/activities/templates | jq '.templates | length'
# Output: 0
```

**Previous session note**: Database had 17 templates but appears to have been reset/cleared.

**Impact**: Cannot execute activities without registered templates, so cannot test impulse tracking end-to-end.

## The E2E Verification Plan

Once templates are re-registered, follow these steps to verify impulse tracking works end-to-end:

### Step 1: Register a Simple Template

Use the built-in templates or register a minimal test template. Example:

```bash
# Option A: Use existing script to bootstrap templates
python3 scripts/bootstrap_activities.py

# Option B: Register via metabob-cli (if registration tool exists)
cd repos/metabob-cli
python3 -m metabob_cli.tools.register_template \
  ../../repos/metabob-opencode/packages/opencode/templates/built-in/create-activity-template.json
```

**Verify**:
```bash
curl -s http://localhost:8080/v2/activities/templates | jq '.templates | length'
# Should be > 0
```

### Step 2: Execute Activity with Impulses

Create a test script that:
1. Loads impulses into context
2. Starts activity execution
3. Passes impulses via the `startExecution()` call

**Example script** (`verify_impulse_tracking.py`):

```python
#!/usr/bin/env python3
"""
Verify impulse tracking works end-to-end.
"""
import sys
import json
import asyncio
sys.path.insert(0, "repos/metabob-cli/src")

from metabob_cli.mcp.activity_manager import get_activity_manager

# Load config and state
with open(".metabob/config.json") as f:
    config = json.load(f)
with open(".metabob/state") as f:
    state = json.load(f)

async def test_impulse_tracking():
    """Execute activity with impulses and verify tracking."""
    
    manager = get_activity_manager(
        base_url=config["base_url"],
        session_token=state["session_metadata"]["session_token"]
    )
    
    # Define test impulses
    test_impulses = [
        {
            "id": "test-impulse-1",
            "type": "memo",
            "pointer": {
                "type": "memo",
                "content": "Test context for impulse tracking verification"
            },
            "tokens_loaded": 50,
            "tokens_budget": 1000,
            "loaded_at": "2026-02-15T12:00:00Z"
        },
        {
            "id": "test-impulse-2", 
            "type": "file",
            "pointer": {
                "type": "file",
                "path": "/path/to/test/file.py"
            },
            "tokens_loaded": 200,
            "tokens_budget": 2000,
            "loaded_at": "2026-02-15T12:00:00Z"
        }
    ]
    
    print("=" * 60)
    print("Testing Impulse Tracking End-to-End")
    print("=" * 60)
    
    # Search for a simple activity template
    print("\n1. Searching for activity templates...")
    activities = await manager.search_activities(limit=5)
    if not activities:
        print("   ❌ No templates found. Register templates first.")
        return False
    
    activity_id = activities[0].get("id")
    activity_name = activities[0].get("name", "Unknown")
    print(f"   ✓ Found template: {activity_id} ({activity_name})")
    
    # Start execution WITH impulses
    print(f"\n2. Starting execution with {len(test_impulses)} impulses...")
    
    # Create execution object with impulses
    from metabob_cli.mcp.activity_manager import ActivityExecution
    execution = ActivityExecution(
        execution_id="",  # Will be set by start_execution
        activity_id=activity_id,
        status="pending",
        variables={},
        impulses_used=test_impulses  # ← KEY: Pass impulses here
    )
    
    execution_id = await manager.start_execution(
        activity_id=activity_id,
        variables={},
        execution=execution  # Pass execution with impulses
    )
    
    print(f"   ✓ Execution started: {execution_id}")
    print(f"   ✓ Impulses passed: {len(test_impulses)}")
    
    # Wait a moment for execution to process
    await asyncio.sleep(2)
    
    # Check database for impulse tracking
    print("\n3. Verifying impulses in database...")
    
    # Query database directly (SurrealDB)
    import httpx
    
    async with httpx.AsyncClient() as client:
        # Query activity_executions table
        surql_query = f"""
        SELECT 
            execution_id, 
            impulses_used,
            array::len(impulses_used) AS impulse_count
        FROM activity_executions 
        WHERE execution_id = '{execution_id}'
        """
        
        response = await client.post(
            "http://localhost:8000/sql",
            json={"query": surql_query},
            auth=("root", "root")
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("result") and len(result["result"]) > 0:
                execution_data = result["result"][0]
                impulses_count = execution_data.get("impulse_count", 0)
                impulses_data = execution_data.get("impulses_used", [])
                
                print(f"   ✓ Database query successful")
                print(f"   ✓ Impulses tracked: {impulses_count}")
                print(f"   ✓ Impulse data present: {len(impulses_data) > 0}")
                
                if impulses_count == len(test_impulses):
                    print("\n✅ SUCCESS: Impulse tracking verified end-to-end!")
                    print(f"   - Sent: {len(test_impulses)} impulses")
                    print(f"   - Tracked: {impulses_count} impulses")
                    print(f"   - Data integrity: ✓")
                    return True
                else:
                    print(f"\n⚠️  MISMATCH:")
                    print(f"   - Sent: {len(test_impulses)} impulses")
                    print(f"   - Tracked: {impulses_count} impulses")
                    return False
            else:
                print(f"   ❌ No execution found in database")
                return False
        else:
            print(f"   ❌ Database query failed: {response.status_code}")
            return False

if __name__ == "__main__":
    result = asyncio.run(test_impulse_tracking())
    sys.exit(0 if result else 1)
```

### Step 3: Verify Database Contents

**Direct database query**:

```bash
# Connect to SurrealDB
curl -X POST http://localhost:8000/sql \
  -u root:root \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT execution_id, impulses_used, array::len(impulses_used) AS impulse_count FROM activity_executions ORDER BY created_at DESC LIMIT 1;"
  }' | jq '.'
```

**Expected output**:
```json
{
  "result": [
    {
      "execution_id": "exec_abc123...",
      "impulse_count": 2,
      "impulses_used": [
        {
          "id": "test-impulse-1",
          "type": "memo",
          "pointer": { "type": "memo", "content": "..." },
          "tokens_loaded": 50,
          "tokens_budget": 1000,
          "loaded_at": "2026-02-15T12:00:00Z"
        },
        {
          "id": "test-impulse-2",
          "type": "file",
          "pointer": { "type": "file", "path": "/path/to/test/file.py" },
          "tokens_loaded": 200,
          "tokens_budget": 2000,
          "loaded_at": "2026-02-15T12:00:00Z"
        }
      ]
    }
  ]
}
```

### Step 4: Test Learning Loop APIs

Once impulses are tracked, verify the learning loop endpoints work:

**Query learned impulses**:
```bash
curl -s http://localhost:8080/v2/impulses/learned?min_success_rate=0.5 \
  -H "Authorization: Bearer mb_..." | jq '.'
```

**Query impulses for specific activity**:
```bash
curl -s http://localhost:8080/v2/impulses/for-activity/INFRASTRUCTURE-0013e379 \
  -H "Authorization: Bearer mb_..." | jq '.'
```

**Expected**: Should return impulses that have been successfully used in past executions.

## Success Criteria

The impulse tracking system is fully verified when:

- [x] Unit tests pass (completed in previous session)
- [ ] Templates are registered in backend
- [ ] Activity execution with impulses succeeds
- [ ] Database shows `impulses_used` field populated correctly
- [ ] Impulse count matches what was sent
- [ ] Impulse data structure is intact (no corruption)
- [ ] Learning loop APIs return meaningful results

## Current Blockers

1. **No templates registered** - Need to bootstrap templates in backend database
2. **Schema mismatch** - Built-in templates use `tasks` field but backend expects `task_steps`

## Recommended Next Steps

### Option 1: Bootstrap Templates (Recommended)
Run the bootstrap script to populate the database:

```bash
# Check if bootstrap script exists
ls scripts/bootstrap_activities.py
ls scripts/init_db.py

# Run whichever exists
python3 scripts/bootstrap_activities.py
# OR
python3 scripts/init_db.py
```

### Option 2: Schema Transformation
Create a script to transform `tasks` → `task_steps` in built-in templates:

```python
# transform_templates.py
import json
from pathlib import Path

template_dir = Path("repos/metabob-opencode/packages/opencode/templates/built-in")
for template_file in template_dir.glob("*.json"):
    with open(template_file) as f:
        template = json.load(f)
    
    # Transform tasks → task_steps
    if "tasks" in template and "task_steps" not in template:
        template["task_steps"] = template.pop("tasks")
    
    # Save transformed template
    output_file = Path("templates_transformed") / template_file.name
    output_file.parent.mkdir(exist_ok=True)
    with open(output_file, "w") as f:
        json.dump(template, f, indent=2)

print("✓ Templates transformed")
```

### Option 3: Wait for Database Rebuild
If database is being rebuilt/reset, wait for completion and then run E2E verification.

## Alternative: Simplified Verification

If full E2E is blocked, verify the fix at the CLI level:

```python
# test_cli_impulse_capture.py
import sys
sys.path.insert(0, "repos/metabob-cli/src")

from metabob_cli.mcp.activity_manager import ActivityExecution, ActivityManager

# Create test execution with impulses
execution = ActivityExecution(
    execution_id="test_exec_123",
    activity_id="test_activity",
    status="running",
    variables={},
    impulses_used=[
        {"id": "test1", "type": "memo", "tokens_loaded": 50},
        {"id": "test2", "type": "file", "tokens_loaded": 100}
    ]
)

# Test impulse capture (internal method)
manager = ActivityManager(base_url="http://localhost:8080", session_token="dummy")
impulses = manager._capture_session_impulses(execution)

print(f"Captured impulses: {len(impulses)}")
assert len(impulses) == 2, "Should capture 2 impulses"
assert impulses[0]["id"] == "test1", "First impulse ID should match"
assert impulses[1]["id"] == "test2", "Second impulse ID should match"

print("✅ CLI-level impulse capture works correctly")
```

## Conclusion

The impulse tracking fix is **code-complete and unit-tested**. End-to-end verification is ready to execute once templates are re-registered in the backend database.

The verification path is clear:
1. Register templates
2. Execute activity with test impulses  
3. Query database to confirm tracking
4. Test learning loop APIs

**Confidence**: High (fix verified via unit tests and code review)  
**Risk**: Low (isolated change to one method)  
**Blocker**: Template registration (infrastructure issue, not code issue)

---

**Next Session Action**: Run template bootstrap script, then execute E2E verification.
