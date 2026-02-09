# Activity System - Understanding and Next Steps

## What We've Validated

### ✅ Components Working
1. **V2 API Backend** - All endpoints operational
2. **Database** - Persistence verified  
3. **CLI Methods** - Added and tested (via Python scripts)
4. **Proto Compliance** - Format validated

### What We HAVEN'T Done Yet
**Execute an activity through the actual activity execution framework**

## The Real Goal

You correctly pointed out that:
> "We are an agent that operates on code. We should use these tools."
> "The goal is to enable us to offload our processing to activities."
> "We want to see the whole sequence of activity execution and validation run automatically and report back failures."

## The Actual Activity System Architecture

```
User Request
    ↓
OpenCode Activity Mode Agent
    ↓
MCP Tool Call: start_activity_execution_tool()
    ↓
metabob-cli ActivityManager.start_execution()
    ↓
V2 API: POST /v2/activities/record/start
    ↓
Activity Execution Framework
    ├─ Task 1: Execute → Report Result → Record
    ├─ Task 2: Execute → Report Result → Record
    ├─ Task 3: Execute → Report Result → Record
    └─ Complete → Record Metrics → Learn
    ↓
Database: activity_executions (with all metrics)
    ↓
Dashboard: Display results
```

## What's Different from What We Did

### What We Did (Bash Scripts)
- ✅ Validated API endpoints work
- ✅ Validated database persists data
- ✅ Validated CLI methods exist
- ❌ **Did NOT use the activity execution framework**
- ❌ **Did NOT let activities execute hierarchically**
- ❌ **Did NOT test automatic failure reporting**

### What We Should Do (Use Activity System)
- Execute an activity that validates the system
- Let the activity framework manage execution
- Have it automatically report failures
- Learn from the execution results
- Use hierarchical task execution

## The Missing Piece

We have:
1. ✅ MCP Server running (port 3100)
2. ✅ MCP Tools registered: `start_activity_execution_tool`, etc.
3. ✅ OpenCode methods: `MetabobCLI.startExecution()`, `getNextStep()`, etc.
4. ✅ Activity templates in database
5. ❌ **Integration between OpenCode and the activity execution**

## Current State Issues

### Issue 1: Tool Integration
- MCP tools exist in metabob-cli
- OpenCode expects these tools  
- But OpenCode container doesn't have updated CLI code
- Container needs CLI with new methods

### Issue 2: Activity Execution Loop
The activity execution should work like this:
```typescript
// OpenCode calls:
const execution = await MetabobCLI.startExecution({
  activityId: "bug-fix-v1",
  sessionId: session.id,
  variables: { bug_description: "..." },
  costBudget: 1.0
})

// Then iteratively:
while (!execution.complete) {
  const step = await MetabobCLI.getNextStep(execution.execution_id)
  
  // Execute step (OpenCode agent does the work)
  const result = await executeStep(step)
  
  // Report result
  await MetabobCLI.reportStepResult({
    executionId: execution.execution_id,
    stepId: step.id,
    success: result.success,
    output: result.output,
    cost: result.cost,
    tokens: result.tokens
  })
}

// Framework automatically records everything
```

### Issue 3: Validation Activity
We need an activity template that:
1. Validates the system components
2. Reports failures automatically
3. Uses the activity framework itself
4. Demonstrates hierarchical execution

## Next Steps

### Immediate: Create System Validation Activity

Create an activity template with tasks that validate:
1. **Task 1**: Validate V2 API endpoints
   - Call each endpoint
   - Verify response format
   - Report failures

2. **Task 2**: Validate CLI integration
   - Test search_activities()
   - Test get_activity()
   - Test execution recording
   - Report failures

3. **Task 3**: Validate database persistence
   - Create test record
   - Query database
   - Verify values
   - Report failures

4. **Task 4**: Validate end-to-end flow
   - Execute sub-activity
   - Verify metrics recorded
   - Report failures

5. **Task 5**: Report results
   - Summarize what passed/failed
   - Provide actionable fixes
   - Record learnings

### How to Execute This

**Option A: Via OpenCode** (Once container updated)
```typescript
// In OpenCode TypeScript
const execution = await MetabobCLI.startExecution({
  activityId: "system-validation-v1",
  sessionId: getCurrentSessionId(),
  variables: { test_scope: "full" },
  costBudget: 2.0
})

// Framework handles execution automatically
```

**Option B: Via MCP Tool Directly**
```python
# Via metabob-cli MCP server
result = await mcp_client.call_tool(
  "start_activity_execution",
  {
    "activity_id": "system-validation-v1",
    "session_id": session_id,
    "variables": json.dumps({"test_scope": "full"}),
    "cost_budget": 2.0
  }
)
```

**Option C: Via Activity Tool** (If available)
```
Use the activity tool with:
- activityId: system-validation-v1
- variables: { test_scope: "full" }
- reason: "Validate activity system end-to-end"
```

## The Key Insight

You're absolutely right - we need to **USE** the activity system, not just test individual components with bash scripts.

The activity system is designed for:
- **Hierarchical execution** - Activities can call sub-activities
- **Automatic tracking** - Framework records everything
- **Failure reporting** - Automatic capture and reporting
- **Learning** - System learns from executions

We validated the plumbing works, but we haven't used the actual system as intended.

## Concrete Action Items

1. **Update OpenCode container** with new CLI code
   - So it has record_execution_start_external() etc.
   
2. **Create system-validation activity** template
   - With proper task structure
   - Using activity framework

3. **Execute validation activity** through OpenCode
   - Let it run automatically
   - See hierarchical execution
   - Get automatic failure reporting

4. **Learn from results**
   - See what actually breaks
   - Fix the real issues
   - Iterate

## What We Learned

The bash script testing was useful to verify individual components, but it's not how the system is meant to be used. The real power is in:
- Activity-driven execution
- Automatic metrics collection
- Hierarchical task management
- Self-validating workflows

We need to "eat our own dog food" - use the activity system to validate itself.

