# Execute System Validation Activity

## Activity Created ✅

**Activity ID:** `infrastructure-70fc0b15`  
**Name:** System Validation Activity  
**Tasks:** 5 hierarchical tasks  
**Purpose:** Validate the complete activity system through execution

## What This Activity Does

When executed, it will:

### Task 1: Validate V2 API Endpoints (0.5 cost budget)
- Test POST /v2/session
- Test GET /v2/activities/templates
- Test POST /v2/activities/record/start
- Test POST /v2/activities/record/complete
- **Report failures automatically**

### Task 2: Validate CLI Integration (0.5 cost budget)
- Test search_activities()
- Test get_activity()
- Test record_execution_start_external()
- Test record_execution_complete_external()
- **Report failures automatically**

### Task 3: Validate Database Persistence (0.3 cost budget)
- Create test execution
- Query database
- Verify field values
- **Report failures automatically**

### Task 4: Validate End-to-End Flow (0.5 cost budget)
- Execute complete activity flow
- Verify automatic tracking
- **Report failures automatically**

### Task 5: Report Summary (0.3 cost budget)
- Summarize all results
- List pass/fail for each component
- Provide actionable fixes
- **Learn from execution**

**Total Cost Budget:** 2.1 tokens (safe for validation)

## How to Execute

### Method 1: Via OpenCode Chat (Recommended)

1. **Start OpenCode:**
   ```bash
   opencode chat
   ```

2. **Execute the activity:**
   ```
   Execute activity infrastructure-70fc0b15 with variables {"test_scope": "full"}
   ```

3. **Watch hierarchical execution:**
   - OpenCode will execute each task in order
   - Each task will be given to Activity Mode agent
   - Results will be reported back
   - Failures will be captured automatically
   - Final summary will be generated

### Method 2: Via Activity Tool (From OpenCode Agent)

```typescript
// If you're in OpenCode TypeScript code
const result = await Activity.execute({
  activityId: "infrastructure-70fc0b15",
  variables: {
    test_scope: "full"
  },
  reason: "Validate activity system end-to-end"
})
```

### Method 3: Via MCP Tool (From CLI)

```python
# Via metabob-cli MCP tool
import asyncio
from metabob_cli.mcp.activity_manager import ActivityManager

async def execute():
    # This uses the internal execution, not the framework
    # But demonstrates the MCP tool exists
    manager = ActivityManager(base_url, session_token)
    execution = await manager.start_execution(
        activity_id="infrastructure-70fc0b15",
        session_id=session_id,
        variables={"test_scope": "full"},
        cost_budget=2.5
    )
    
    # Then iteratively get steps and report results
    while not execution.complete:
        step = await manager.get_next_step(execution.execution_id)
        # Execute step...
        await manager.record_step_result(...)

asyncio.run(execute())
```

## What You'll See

### During Execution

```
[Task 1/5] Validating V2 API Endpoints...
  - Testing POST /v2/session... ✓
  - Testing GET /v2/activities/templates... ✓
  - Testing POST /v2/activities/record/start... ✓
  - Testing POST /v2/activities/record/complete... ✓
  Result: All API endpoints operational

[Task 2/5] Validating CLI Integration...
  - Testing search_activities()... ✓
  - Testing get_activity()... ✓
  - Testing record_execution_start_external()... ✓
  - Testing record_execution_complete_external()... ✓
  Result: CLI integration working

[Task 3/5] Validating Database Persistence...
  - Creating test execution... ✓
  - Querying database... ✓
  - Verifying field values... ✓
  Result: Database persistence verified

[Task 4/5] Validating End-to-End Flow...
  - Searching for activity... ✓
  - Starting execution... ✓
  - Completing execution... ✓
  - Verifying in database... ✓
  Result: End-to-end flow working

[Task 5/5] Reporting Summary...
  
  VALIDATION SUMMARY
  ==================
  API Validation: ✅ PASS
  CLI Integration: ✅ PASS
  Database Persistence: ✅ PASS
  End-to-End Flow: ✅ PASS
  
  Overall Status: OPERATIONAL
  
  Learnings:
  - All core components functioning correctly
  - Execution tracking working automatically
  - Database persistence reliable
  - Proto compliance maintained
  
  Recommendations:
  - System ready for production use
  - Continue monitoring execution metrics
  - Add more validation scenarios
```

### Automatic Failure Reporting

If any component fails, the activity will:
1. **Capture the failure** - Error message, stack trace, context
2. **Report it clearly** - What failed, why, when
3. **Provide fixes** - Actionable steps to resolve
4. **Continue execution** - Test remaining components
5. **Learn from it** - Record patterns for improvement

Example failure report:
```
[Task 2/5] Validating CLI Integration...
  - Testing search_activities()... ✓
  - Testing get_activity()... ✓
  - Testing record_execution_start_external()... ❌ FAILED
  
  ERROR: AttributeError: 'ActivityManager' object has no attribute 'record_execution_start_external'
  
  CAUSE: Method not found in container's CLI installation
  
  FIX: Copy updated activity_manager.py to container:
    docker cp repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py \
             devbob-opencode:/opt/metabob-cli/src/metabob_cli/mcp/activity_manager.py
  
  Continuing with remaining validations...
```

## Benefits of This Approach

### vs Bash Scripts
- ❌ Bash: Manual execution, no tracking
- ✅ Activity: Automatic execution, full tracking

### vs Direct API Calls
- ❌ Direct: One-off tests, no learning
- ✅ Activity: Reusable, learns from failures

### vs Manual Testing
- ❌ Manual: Tedious, error-prone
- ✅ Activity: Automated, consistent

### Activity System Benefits
- **Hierarchical execution** - Tasks executed in order
- **Automatic tracking** - All metrics captured
- **Failure reporting** - Clear, actionable
- **Learning** - System improves over time
- **Reusable** - Can run anytime
- **Self-validating** - Validates itself

## Current Setup Status

✅ Activity template created in database  
✅ Template ID: infrastructure-70fc0b15  
✅ All 5 tasks defined with prompts  
✅ Variables configured  
✅ Cost budgets set  
✅ CLI methods available in container  
✅ MCP server running  
✅ V2 API operational  
⏳ Ready to execute!  

## Next Step

**Execute the activity through OpenCode** and let the activity system validate itself through hierarchical task execution with automatic failure reporting.

This demonstrates the full power of the activity framework:
- Activities can validate the system that runs them
- Failures are captured and reported automatically
- Hierarchical execution provides clear progress
- The system learns from each execution
- Results are tracked in the database

**This is using the activity system as intended!**

