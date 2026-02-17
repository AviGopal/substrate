# Impulse Tracking Implementation Status

**Date**: February 17, 2026  
**Status**: 🟡 **PARTIAL IMPLEMENTATION** - OpenCode changes complete, CLI MCP tool incomplete  
**Blocker**: MCP tool import complexity needs resolution

---

## Implementation Progress

### Completed ✅

#### 1. Diagnostic Script
**File**: `scripts/diagnose_impulse_tracking.sh`
- Confirms current state: 102 executions, 0 impulses  
- Queries database for execution and impulse counts
- Checks impulse_usage table existence
- **Result**: Validated the problem exists

####  2. OpenCode MetabobCLI Function
**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`
- Added `startActivityExecution()` function (lines 910-980)
- Extracts impulse data: id, type, pointer, tokens_loaded
- Calls MCP tool `activity/start` with impulse array
- Non-blocking: failures logged but don't break activity
- **Status**: Code complete and ready

#### 3. OpenCode Activity Tool Integration
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
- Added call to `startActivityExecution()` after context gathering (line ~450)
- Extracts impulses from `activity.impulses`
- Transforms to array format: `[{id, type, pointer, tokens_loaded}]`
- Passes to MCP via MetabobCLI
- **Status**: Code complete and ready

### In Progress ⚠️

#### 4. CLI MCP Tool
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_tools.py`
- Started adding `activity/start` MCP tool (lines 20-93)
- Accepts: activity_id, template_id, session_id, variables, impulses
- Should call `activity_manager.start_execution()` with impulses
- **Blocker**: Import complexity - need proper pattern for getting activity_manager instance
- **Options**:
  - Option A: Use `get_activity_manager()` with proper config loading
  - Option B: Access via `_get_server()` helper
  - Option C: Simplify by using lazy server import

---

## Architecture Analysis

### Data Flow (Intended)

```
OpenCode Activity Tool
  ↓ (gathers context)
activity.impulses populated
  ↓ (extract & transform)
MetabobCLI.startActivityExecution()
  ↓ (MCP call)
CLI MCP Tool: activity/start
  ↓ (call manager)
activity_manager.start_execution(impulses=...)
  ↓ (stores)
execution.impulses_used = impulses
  ↓ (later, on completion)
CLI sends to backend
  ↓
Backend: impulse_registry + impulse_usage populated
```

### Current Blocker

```
OpenCode ✅ → MCP Call ✅ → CLI MCP Tool ❌ → Activity Manager ✅ → Backend ✅
                                 ↑
                        Import/instantiation issue
```

The CLI activity_manager already accepts impulses (line 614 of activity_manager.py).
The CLI already sends impulses to backend (line 1538 of activity_manager.py).
**Only missing piece**: MCP tool to bridge OpenCode → CLI activity_manager.

---

## Code Locations

### OpenCode (Complete)

**repos/metabob-opencode/packages/opencode/src/util/metabob.ts**
- Lines ~910-980: `startActivityExecution()` function
- Accepts: `{ activityId, templateId, variantId, sessionId, variables, impulses }`
- Calls MCP tool: `activity/start`
- Returns: `{ status, execution_id, impulses_tracked }`

**repos/metabob-opencode/packages/opencode/src/tool/activity.ts**
- Lines ~448-480: Impulse extraction and MCP call
- After: Context gathering completes
- Before: Task execution begins
- Transforms: `activity.impulses` → `[{id, type, pointer, tokens_loaded}]`

###  CLI (Incomplete)

**repos/metabob-cli/src/metabob_cli/mcp/activity_tools.py**
- Lines 20-93: `activity/start` MCP tool (INCOMPLETE)
- Needs: Proper activity_manager instantiation
- Should call: `manager.start_execution(..., impulses=impulses)`

**repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py**
- Line 614: `start_execution()` already accepts impulses ✅
- Line 677: Stores impulses in execution.impulses_used ✅
- Line 1538: Sends impulses_used to backend ✅

---

## Next Steps

### Option A: Fix MCP Tool Import (Recommended)

Use the pattern from `learning_tools.py`:

```python
@mcp.tool(name="activity/start", description="...")
async def activity_start(
    activity_id: str,
    template_id: str,
    session_id: str,
    variables: dict,
    impulses: list[dict],
    variant_id: str | None = None,
    ctx: Context | None = None,
) -> dict:
    """Start activity execution with impulse tracking."""
    from .tools import _get_server
    
    try:
        # Get server and config
        server = _get_server()
        config = server.get_config_manager()
        base_url = config.get("api_base_url", "http://localhost:8080")
        
        # Get session token
        from .tools import _get_session_token
        session_token = await _get_session_token(config)
        
        # Get activity manager
        from metabob_cli.mcp.activity_manager import get_activity_manager
        manager = get_activity_manager(base_url, session_token)
        
        # Start execution with impulses
        result = await manager.start_execution(
            activity_id=activity_id,
            session_id=session_id,
            variables=variables,
            variant_id=variant_id,
            impulses=impulses,
        )
        
        logger.info(
            f"activity/start succeeded: execution_id={result['execution_id']}, "
            f"impulses_tracked={len(impulses)}"
        )
        
        return {
            "status": "success",
            "execution_id": result.get("execution_id"),
            "impulses_tracked": len(impulses),
        }
    except Exception as e:
        logger.error(f"activity/start failed: {e}", exc_info=True)
        return {
            "status": "error",
            "error": str(e),
        }
```

**Time Estimate**: 30 minutes to implement and test

### Option B: Alternative Approach

If MCP tool proves too complex, alternative is to enhance `reportExecutionStep` to include full impulse metadata instead of just IDs. This would require:
1. Change `reportExecutionStep` signature to accept impulse objects  
2. Update activity.ts calls to pass full impulse data
3. Update CLI to handle impulse metadata in step reporting

**Time Estimate**: 1 hour (more changes across codebase)

---

## Testing Plan

### Step 1: Unit Test MCP Tool

```bash
cd repos/metabob-cli
python -c "
from metabob_cli.mcp.activity_tools import activity_start
import asyncio

test_impulses = [
    {'id': 'test-1', 'type': 'file', 'pointer': {'path': 'test.ts'}, 'tokens_loaded': 100},
    {'id': 'test-2', 'type': 'memo', 'pointer': {'content': 'Test memo'}, 'tokens_loaded': 50},
]

result = asyncio.run(activity_start(
    activity_id='test-activity',
    template_id='test-template',
    session_id='test-session',
    variables={'test': 'value'},
    impulses=test_impulses
))

print(f'Result: {result}')
print(f'Impulses tracked: {result.get(\"impulses_tracked\")}')
"
```

Expected: `impulses_tracked: 2`, `status: success`

### Step 2: End-to-End Test

```bash
# Run diagnostic (should show 0 impulses)
./scripts/diagnose_impulse_tracking.sh

# Run an activity with impulses
cd repos/metabob-opencode  
npm test -- --grep "activity execution"

# OR use opencode CLI
opencode activity execute add-feature-complete --variables '{"feature_name":"test",...}'

# Re-run diagnostic (should show impulses_count > 0 for new execution)
./scripts/diagnose_impulse_tracking.sh
```

Expected: 
- New execution shows `impulse_count > 0`
- `impulse_registry` table has new entries
- `impulse_usage` records created

### Step 3: Pattern Detection Test

Run 3 similar executions:
```bash
for i in {1..3}; do
  opencode activity execute test-activity --variables '{"test":"value"}'
  sleep 2
done

# Check for auto-commissioned variant
docker exec -i metabob-surreal /surreal sql ... <<< '
SELECT variant_id, variant_name, description 
FROM activity_variants 
WHERE variant_name LIKE "auto-%"
ORDER BY created_at DESC 
LIMIT 1;
'
```

Expected: Auto-commissioned variant created after 3rd execution

---

## Success Criteria

- [ ] MCP tool `activity/start` implemented and working
- [ ] OpenCode → CLI → Backend data flow functional
- [ ] impulse_registry populated (count > 0)
- [ ] impulse_usage records created per execution
- [ ] Pattern detection can access impulse data
- [ ] Diagnostic shows impulse_count > 0 for new executions
- [ ] No regressions in existing activity execution

---

## Rollback Plan

If implementation causes issues:

```bash
# Revert OpenCode changes
cd repos/metabob-opencode
git checkout HEAD -- packages/opencode/src/util/metabob.ts
git checkout HEAD -- packages/opencode/src/tool/activity.ts

# Revert CLI changes
cd repos/metabob-cli
git checkout HEAD -- src/metabob_cli/mcp/activity_tools.py

# Rebuild if needed
cd repos/metabob-opencode && npm run build
cd repos/metabob-cli && pip install -e .
```

---

## Time Remaining

**Total Effort So Far**: ~4 hours (analysis + partial implementation)

**Remaining**:
- Fix MCP tool: 30 minutes
- Testing: 1 hour
- Validation: 30 minutes
- Documentation: 30 minutes

**Total**: ~2.5 hours to completion

**Original Estimate**: 20 hours (8 hours implementation + 12 hours validation)

**Ahead of Schedule**: Yes, by ~13.5 hours (if MCP tool fix is straightforward)

---

**Status**: Ready for final MCP tool implementation and testing
