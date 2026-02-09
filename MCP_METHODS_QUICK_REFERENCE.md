# MCP Activity Execution Methods - Quick Reference

## 🚀 Quick Start

```typescript
import { MetabobCLI } from "./src/util/metabob"

// 1. Start execution
const exec = await MetabobCLI.startExecution({
  activityId: "bug-fix-v1",
  sessionId: "session-123",
  variables: { bug_description: "..." },
  costBudget: 1.0,
})

// 2. Get next step
const step = await MetabobCLI.getNextStep(exec.execution_id)

// 3. Execute step (your code here)
// ...

// 4. Report result
await MetabobCLI.reportStepResult({
  executionId: exec.execution_id,
  stepId: step.current_step.id,
  success: true,
  cost: 0.05,
  tokens: 1000,
  toolCalls: [],
})

// 5. Check state
const state = await MetabobCLI.getExecutionState(exec.execution_id)
```

## 📋 Method Reference

### `startExecution(options)`
Creates execution tracking in SurrealDB.

**Parameters**:
```typescript
{
  activityId: string       // Variant ID from search results
  sessionId: string        // Current session ID
  variables: Record<string, unknown>  // Template variables
  costBudget: number       // Max cost allowed (e.g., 1.0 for $1)
}
```

**Returns**:
```typescript
{
  execution_id: string     // Use this for all subsequent calls
  state: string            // "pending", "running", "completed", "failed"
  activity_id: string      // Base activity ID
  variant_id: string       // Specific variant being executed
}
```

**Throws**: Error if MCP unavailable or start fails

---

### `getNextStep(executionId)`
Gets current step (incremental delivery - one step at a time).

**Parameters**:
```typescript
executionId: string  // From startExecution()
```

**Returns**:
```typescript
{
  current_step?: {
    id: string                   // Step identifier
    description: string          // What this step does
    prompt: {
      template: string           // Prompt template
      variables: string[]        // Required variables
      maxTokens?: number         // Token limit
    }
    tools?: {
      required?: string[]        // Must have these tools
      optional?: string[]        // Nice to have
      disabled?: string[]        // Don't use these
    }
    validation?: any             // Validation rules
  }
  complete: boolean              // true if no more steps
  trailblazing: boolean          // true if validation failed, needs fix
}
```

**Note**: Returns ONLY current step, not all future steps

---

### `reportStepResult(options)`
Sends metrics to backend for Thompson Sampling learning.

**Parameters**:
```typescript
{
  executionId: string      // From startExecution()
  stepId: string           // From getNextStep()
  success: boolean         // Did step complete successfully?
  output?: string          // Step output (optional)
  error?: string           // Error message if failed (optional)
  cost: number             // Cost in dollars (e.g., 0.05 for $0.05)
  tokens: number           // Total tokens used
  duration?: number        // Duration in milliseconds (optional)
  toolCalls: Array<{       // Tools used during step
    tool: string           // Tool name
    args?: any             // Tool arguments (optional)
    command?: string       // Command if bash tool (optional)
  }>
}
```

**Returns**:
```typescript
{
  continue: boolean           // true to continue, false to stop
  next_step_index?: number    // Index of next step
  validation_passed?: boolean // Did validation pass?
}
```

**Impact**: Updates Thompson Sampling alpha/beta for learning

---

### `getExecutionState(executionId)`
Queries current execution progress (for debugging/monitoring).

**Parameters**:
```typescript
executionId: string  // From startExecution()
```

**Returns**:
```typescript
{
  execution_id: string         // Execution ID
  activity_id: string          // Base activity ID
  variant_id: string           // Variant ID
  state: string                // "pending", "running", "completed", "failed"
  current_step_index: number   // Which step we're on (0-based)
  total_cost: number           // Total cost so far ($)
  total_tokens: number         // Total tokens so far
  step_results?: Array<{       // History of completed steps
    step_id: string
    success: boolean
    cost?: number
  }>
}
```

**Use Case**: Check progress, debug issues, monitor costs

---

## 🔄 Typical Execution Flow

```typescript
// Start execution
const exec = await MetabobCLI.startExecution({ ... })

// Loop through steps
while (true) {
  // Get next step
  const stepResponse = await MetabobCLI.getNextStep(exec.execution_id)
  
  // Check if done
  if (stepResponse.complete) {
    console.log("Activity completed!")
    break
  }
  
  // Execute step
  const step = stepResponse.current_step!
  try {
    // Your execution logic here
    const result = await executeStep(step)
    
    // Report success
    await MetabobCLI.reportStepResult({
      executionId: exec.execution_id,
      stepId: step.id,
      success: true,
      cost: result.cost,
      tokens: result.tokens,
      toolCalls: result.toolCalls,
    })
  } catch (error) {
    // Report failure
    await MetabobCLI.reportStepResult({
      executionId: exec.execution_id,
      stepId: step.id,
      success: false,
      error: error.message,
      cost: 0,
      tokens: 0,
      toolCalls: [],
    })
    break // Stop on failure
  }
}

// Check final state
const finalState = await MetabobCLI.getExecutionState(exec.execution_id)
console.log("Final state:", finalState.state)
console.log("Total cost:", finalState.total_cost)
```

## 🧪 Testing

Run the test script:
```bash
cd repos/metabob-opencode
bun run test-mcp-activity-execution.ts
```

Verify in SurrealDB:
```bash
# Check execution created
./admin-cli.sh db query "SELECT * FROM executions WHERE id = 'exec_xxx'"

# Check step results
./admin-cli.sh db query "SELECT * FROM executions FETCH step_results"

# Verify Thompson Sampling updates
./admin-cli.sh db query "SELECT * FROM activity_variants WHERE variant_id = 'xxx'"
```

## 🐛 Troubleshooting

### MCP Not Available
```typescript
const available = await MetabobCLI.isAvailable()
if (!available) {
  console.error("Metabob MCP not available")
  // Fall back to direct execution
}
```

### Execution Fails
```typescript
try {
  const exec = await MetabobCLI.startExecution({ ... })
} catch (error) {
  console.error("Failed to start execution:", error.message)
  // Check MCP server is running
  // Verify activity exists in backend
}
```

### Step Results Not Recording
```typescript
// Check execution state
const state = await MetabobCLI.getExecutionState(executionId)
console.log("Current step:", state.current_step_index)
console.log("Step results:", state.step_results)
```

## 📚 See Also

- **Implementation**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` (lines 1161-1438)
- **Test Script**: `repos/metabob-opencode/test-mcp-activity-execution.ts`
- **Integration Guide**: `INTEGRATION_GUIDE_MCP_EXECUTION.md`
- **Full Documentation**: `MCP_EXECUTION_IMPLEMENTATION_DELIVERABLE.md`

## 🔑 Key Points

1. **Always call in order**: startExecution → getNextStep → reportStepResult (repeat) → getExecutionState
2. **Incremental delivery**: Agent sees ONE step at a time, not all steps
3. **Metrics matter**: reportStepResult() enables Thompson Sampling learning
4. **Error handling**: Methods throw errors if MCP fails - handle gracefully
5. **Fallback**: If MCP unavailable, fall back to direct execution

---

**Last Updated**: February 6, 2026  
**Status**: Methods Implemented ✅ | Integration Pending ⏳
