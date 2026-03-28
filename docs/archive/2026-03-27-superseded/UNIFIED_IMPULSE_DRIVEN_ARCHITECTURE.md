# Unified Impulse-Driven Architecture: Debugging, Improvement, and Creation

**Date**: 2026-03-20  
**Phase**: 1.8+ (Post-Impulse Filtering)  
**Author**: Activity Mode Agent

---

## Executive Summary

All activity workflows (creation, debugging, improvement, variant generation) use the **SAME mechanism**:

```typescript
create_activity_goal_seeking({
  goalDescription: <varies by use case>,
  variables: <varies by use case>,
  impulseRefs: <THIS IS THE KEY DIFFERENTIATOR>
})
```

**The difference between use cases is ONLY in the impulses provided and the goal description.**

This document explains:
1. How execution traces become impulses
2. How metabob-activity-api resolves all non-local impulse types
3. How the ribosome (`assembleTemplateFromExecution`) uses enhanced state tracking
4. How to use this unified mechanism for debugging, improvement, and creation

---

## Architecture Principles

### 1. **Separation of Concerns**

**MiniBob (Execution Environment)**:
- ✅ Execute activities with LLM
- ✅ Capture execution traces with state snapshots
- ✅ Create impulses from executions
- ✅ Resolve LOCAL impulse types only (memo, file)
- ❌ **NOT**: Store executions persistently
- ❌ **NOT**: Implement non-local impulse resolution
- ❌ **NOT**: Pattern recognition/learning

**metabob-activity-api (Storage/Learning Backend)**:
- ✅ Store execution traces
- ✅ Store impulses
- ✅ Resolve ALL impulse pointer types
- ✅ Pattern recognition
- ✅ Thompson sampling
- ✅ Provide impulse content to minibob

**Key Insight**: MiniBob delegates non-local impulse resolution to the backend via MCP. This keeps minibob flexible - the backend can introduce new pointer types without requiring minibob code changes.

### 2. **Flexible Impulse Pointer System**

**Old Approach (WRONG - Hardcoded Types)**:
```typescript
// minibob/src/types.ts - HARDCODED
export type ImpulsePointer =
  | { type: "memo"; content: string }
  | { type: "file"; path: string }
  | { type: "activityOutput"; activityId: string }
  // Adding new types requires minibob code changes ❌
```

**New Approach (CORRECT - Flexible)**:
```typescript
// minibob/src/types.ts - OPEN FOR EXTENSION

/**
 * Local pointer types (minibob resolves these)
 */
export type LocalImpulsePointer =
  | { type: "memo"; content: string }
  | { type: "file"; path: string; offset?: number; limit?: number }

/**
 * Backend pointer types (metabob-activity-api resolves via MCP)
 * Examples - NOT exhaustive. Backend can add new types without minibob changes.
 */
export type BackendImpulsePointer =
  | { type: "activityOutput"; activityId: string; taskId?: string }
  | { type: "activityExecutionTrace"; executionId: string; [key: string]: unknown }
  | { type: "activityTemplate"; templateId: string; [key: string]: unknown }
  | { type: "activityMetrics"; templateId: string; [key: string]: unknown }
  | { type: string; [key: string]: unknown }  // ✅ Catch-all for backend-defined types

export type ImpulsePointer = LocalImpulsePointer | BackendImpulsePointer
```

**Benefits**:
- Backend introduces new types → No minibob changes needed ✅
- Offline mode still works (memo/file types) ✅
- Backend controls resolution logic ✅

### 3. **Enhanced State Tracking for Ribosome**

The ribosome (`assembleTemplateFromExecution`) needs rich execution traces to generate quality templates. We've enhanced `ExecutedTask` with:

```typescript
export interface ExecutedTask {
  id: string
  description: string
  actualPrompt: string
  toolCalls: ToolCall[]
  response: string
  validationResults?: { ... }
  result: TaskResult
  
  // NEW: Phase 1.8+ State Tracking
  inputState?: {
    filesAvailable: string[]
    environment: Record<string, string>
    impulses: string[]
    variables: Record<string, unknown>
  }
  
  outputState?: {
    filesModified: string[]
    filesCreated: string[]
    filesDeleted: string[]
    exitCode?: number
    stderr?: string
  }
  
  stateTransition?: {
    before: Record<string, string>  // File → hash
    after: Record<string, string>   // File → hash
    workingDirectory: string
  }
}
```

**Why This Matters**:
- Enables task-by-task differential analysis
- Captures what changed (for variant generation)
- Preserves error context (for debugging)
- Supports quality assessment of each stage

---

## The Unified Flow

All workflows follow this pattern:

```
User Request
    ↓
Create Impulses (execution traces, templates, metrics, etc.)
    ↓
create_activity_goal_seeking({ goalDescription, impulseRefs })
    ↓
Activity Template Generated (compose existing OR create new tasks)
    ↓
Execute Activity
    ↓
Execution Trace with State Snapshots
    ↓
assembleTemplateFromExecution (Ribosome)
    ↓
New/Improved Activity Template
    ↓
Register to metabob-activity-api
    ↓
Available for Future Composition
```

---

## Implementation Details

### Component 1: State Capture (MiniBob)

**File**: `repos/minibob/src/activity.ts`

Utility functions added:
```typescript
async function captureInputState(
  workingDirectory: string,
  impulseIds: string[],
  variables: Record<string, unknown>
): Promise<ExecutedTask["inputState"]>

async function captureOutputState(
  workingDirectory: string,
  beforeFiles: string[],
  toolCalls: ToolCall[]
): Promise<ExecutedTask["outputState"]>

async function captureFileHashes(
  workingDirectory: string,
  files: string[]
): Promise<Record<string, string>>
```

**Integrated into `executeTask()`**:
```typescript
// BEFORE task execution
inputState = await captureInputState(...)
beforeHashes = await captureFileHashes(...)

// Execute LLM with tools
const result = await this.llm.completeWithTools(...)

// AFTER task execution
outputState = await captureOutputState(...)
afterHashes = await captureFileHashes(...)
stateTransition = { before: beforeHashes, after: afterHashes, workingDirectory }

// Include in TaskResult.metadata
return {
  taskId: task.id,
  status: "completed",
  output: result.content,
  metadata: {
    inputState,
    outputState,
    stateTransition,
    toolCalls: this.toolCallRecords,
    actualPrompt: prompt,
  }
}
```

### Component 2: Flexible Impulse Resolution (MiniBob)

**File**: `repos/minibob/src/impulse.ts`

```typescript
private async resolvePointer(pointer: ImpulsePointer): Promise<string> {
  // LOCAL: memo (embedded content)
  if (pointer.type === "memo" && "content" in pointer) {
    return pointer.content as string
  }

  // LOCAL: file (read from minibob's filesystem)
  if (pointer.type === "file" && "path" in pointer) {
    const file = Bun.file(pointer.path as string)
    const content = await file.text()
    return content  // (with offset/limit handling)
  }

  // BACKEND: Delegate ALL other types to metabob-activity-api via MCP
  if (isMCPEnabled()) {
    const mcp = getMCPClient()
    const content = await mcp.resolveImpulse(pointer)  // ← Backend handles resolution
    return content
  }

  // Fallback: Only memo/file work offline
  throw new Error(
    `Impulse type "${pointer.type}" requires backend connection. ` +
    `Only "memo" and "file" types work offline.`
  )
}
```

### Component 3: MCP Client Extensions (MiniBob)

**File**: `repos/minibob/src/mcp.ts`

**New Methods**:

```typescript
/**
 * Resolve impulse pointer via backend
 * Backend controls ALL resolution logic for non-local types
 */
async resolveImpulse(pointer: any): Promise<string> {
  const response = await this.request("POST", "/v2/impulses/resolve", {
    pointer: pointer,
  })
  const data = await response.json()
  return data.content
}

/**
 * Store execution trace in backend
 * Enables traces to be referenced as impulses in future activities
 */
async storeExecutionTrace(execution: ActivityExecution): Promise<boolean> {
  const response = await this.request("POST", "/v2/activities/execution-traces", {
    execution_id: execution.id,
    template_id: execution.templateId,
    status: execution.status,
    execution_trace: execution.executionTrace,  // Full trace with state
    // ... other fields
  })
  return response.ok
}
```

### Component 4: Backend API (metabob-activity-api)

**New Endpoints Needed**:

#### POST `/v2/impulses/resolve`
```json
Request:
{
  "pointer": {
    "type": "activityExecutionTrace",
    "executionId": "exec_abc123",
    "includeTasks": true,
    "includeStateSnapshots": true
  }
}

Response:
{
  "content": "# Execution Trace: exec_abc123\n\n**Status**: failed\n..."
}
```

**Backend Resolution Logic**:
```typescript
function resolveImpulse(pointer: ImpulsePointer): string {
  switch (pointer.type) {
    case "activityExecutionTrace":
      return formatExecutionTrace(loadExecution(pointer.executionId), pointer)
    
    case "activityTemplate":
      return formatTemplate(loadTemplate(pointer.templateId), pointer)
    
    case "activityMetrics":
      return formatMetrics(queryMetrics(pointer.templateId), pointer)
    
    // Backend can add new types here without minibob changes
    case "patternAnalysis":
      return formatPatternAnalysis(analyzePatterns(pointer.activityId))
    
    default:
      throw new Error(`Unknown impulse type: ${pointer.type}`)
  }
}
```

#### POST `/v2/activities/execution-traces`
```json
Request:
{
  "execution_id": "exec_abc123",
  "template_id": "auth-jwt-v1",
  "status": "failed",
  "duration_ms": 45000,
  "cost": 0.12,
  "execution_trace": {
    "tasks": [
      {
        "id": "task-1",
        "inputState": { "filesAvailable": [...], ... },
        "outputState": { "filesModified": [...], ... },
        "stateTransition": { "before": {...}, "after": {...} },
        ...
      }
    ],
    "filesModified": [...],
    "impulsesCreated": [...]
  }
}

Response:
{
  "success": true,
  "stored_at": "2026-03-20T10:30:00Z"
}
```

**Database Schema**:
```sql
CREATE TABLE activity_execution_traces (
  execution_id TEXT PRIMARY KEY,
  template_id TEXT,
  status TEXT,
  duration_ms INTEGER,
  cost REAL,
  execution_trace JSONB,  -- Full trace with enhanced state
  stored_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_traces_template ON activity_execution_traces(template_id);
CREATE INDEX idx_traces_status ON activity_execution_traces(status);
```

---

## Use Cases

### Use Case 1: Debug Failed Activity

```typescript
// Step 1: Activity fails
const execution = await executor.execute({
  template: authTemplate,
  variables: { method: "jwt" },
})
// execution.status === "failed"
// execution.error === "Required file missing: config/jwt.json"

// Step 2: Store execution trace in backend
const mcp = getMCPClient()
await mcp.storeExecutionTrace(execution)

// Step 3: Create impulse referencing the trace
createImpulse({
  id: `trace-${execution.id}`,
  pointer: {
    type: "activityExecutionTrace",
    executionId: execution.id,
    includeTasks: true,
    includeToolCalls: true,
    includeStateSnapshots: true,  // Full detail for debugging
  },
  budget: 8000,
  priority: "high",
  tags: ["failed", "debug"]
})

// Step 4: Use goal-seeking to create debug activity
const debugActivity = await createActivityGoalSeeking({
  goalDescription: 
    `Analyze the failed execution of "${authTemplate.name}" and create a corrected version. ` +
    `The failure was: ${execution.error}. ` +
    `Review the execution trace to understand what went wrong, ` +
    `then generate an improved activity template that addresses the root cause.`,
  templateName: `${authTemplate.name}-debug-fix`,
  category: "bugfix",
  variables: {},
  impulseRefs: [
    `trace-${execution.id}`,  // ← Backend resolves this via MCP
  ]
})

// Step 5: Execute debug activity (LLM analyzes trace and creates fix)
const debugExecution = await executor.execute({
  template: debugActivity,
  variables: {},
  reason: "Debug failed authentication activity"
})

// Step 6: If successful, ribosome creates fixed template
if (debugExecution.status === "completed") {
  const fixedTemplate = assembleTemplateFromExecution(
    debugExecution,
    `${authTemplate.name}-v2`,
    authTemplate.category
  )
  await mcp.registerTemplate(fixedTemplate)
}
```

**What happened**:
1. Original activity failed ❌
2. Trace stored in metabob-activity-api 💾
3. Impulse created pointing to trace 📝
4. Goal-seeking generated debug activity 🔍
5. Backend resolved trace impulse → formatted markdown for LLM 📄
6. LLM analyzed trace, created fix ✅
7. Ribosome extracted successful execution → new template 🧬

### Use Case 2: Optimize Based on Metrics

```typescript
// Step 1: Create metrics impulse
createImpulse({
  id: `metrics-${template.id}`,
  pointer: {
    type: "activityMetrics",
    templateId: template.id,
    timeRange: { start: Date.now() - 7 * 86400000, end: Date.now() }  // Last 7 days
  },
  budget: 2000,
  priority: "medium"
})

// Step 2: Get best execution as reference
const bestExecution = await mcp.getBestExecution(template.id)
await mcp.storeExecutionTrace(bestExecution)

createImpulse({
  id: `best-execution-${bestExecution.id}`,
  pointer: {
    type: "activityExecutionTrace",
    executionId: bestExecution.id,
    includeTasks: true,
    includeStateSnapshots: false,  // Don't need full detail
  },
  budget: 3000,
  priority: "high"
})

// Step 3: Goal-seeking for optimization
const optimizedActivity = await createActivityGoalSeeking({
  goalDescription:
    `Create an optimized variant of "${template.name}" that reduces execution time and cost. ` +
    `Analyze the metrics and best execution to identify patterns, ` +
    `then generate an improved template with optimizations applied.`,
  templateName: `${template.name}-optimized`,
  category: template.category,
  variables: {},
  impulseRefs: [
    `metrics-${template.id}`,           // Performance data
    `best-execution-${bestExecution.id}`,  // What worked well
  ]
})

// Execute and register if successful
// ... (same pattern as debugging)
```

### Use Case 3: Create Variant with Different Approach

```typescript
// Step 1: Create template impulse
createImpulse({
  id: `template-${originalTemplate.id}`,
  pointer: {
    type: "activityTemplate",
    templateId: originalTemplate.id,
    includeMetadata: true,
    includeTasks: true,
  },
  budget: 3000,
  priority: "high"
})

// Step 2: Goal-seeking for variant
const variantActivity = await createActivityGoalSeeking({
  goalDescription:
    `Create a variant of "${originalTemplate.name}" using OAuth instead of JWT. ` +
    `Use the original template as a base and replace JWT logic with OAuth2 flow, ` +
    `while maintaining the same validation and error handling patterns.`,
  templateName: `${originalTemplate.name}-oauth`,
  category: originalTemplate.category,
  variables: { authMethod: "oauth2" },
  impulseRefs: [
    `template-${originalTemplate.id}`,  // Original design
  ]
})
```

### Use Case 4: Create New Activity from Requirements

```typescript
// Step 1: Create requirements impulses
createImpulse({
  id: "requirements-user-auth",
  pointer: {
    type: "file",
    path: "docs/requirements/user-authentication.md"
  },
  budget: 3000,
  priority: "high"
})

createImpulse({
  id: "codebase-structure",
  pointer: {
    type: "file",
    path: "src/index.ts"  // Entry point to understand structure
  },
  budget: 2000,
  priority: "medium"
})

// Step 2: Goal-seeking for new activity
const newActivity = await createActivityGoalSeeking({
  goalDescription: "Implement user authentication with JWT tokens and secure password hashing",
  templateName: "user-authentication-jwt",
  category: "feature",
  variables: {},
  impulseRefs: [
    "requirements-user-auth",
    "codebase-structure",
  ]
})

// Same unified mechanism - different impulses!
```

---

## Key Insights

### 1. **Same Mechanism, Different Impulses**

| Use Case | Goal Description | Impulses | Output |
|----------|------------------|----------|--------|
| Debug Failed | "Analyze failure and fix" | execution-trace, error-log | Fixed template |
| Optimize | "Reduce time and cost" | metrics, best-execution | Optimized template |
| Create Variant | "Variant with X approach" | original-template, requirements | New variant |
| Create New | "Implement feature X" | requirements, codebase-structure | New template |

**All use `create_activity_goal_seeking` - just with different inputs!**

### 2. **Backend Flexibility**

metabob-activity-api can introduce new impulse types without minibob changes:
- `type: "patternAnalysis"` - Co-change patterns
- `type: "securityAudit"` - Security findings
- `type: "performanceProfile"` - Profiling data
- `type: "userFeedback"` - Issue reports

MiniBob automatically delegates resolution to backend → No code changes needed ✅

### 3. **Ribosome Quality**

The ribosome (`assembleTemplateFromExecution`) benefits from enhanced state tracking:
- **Input state**: What files/impulses/variables were available?
- **Output state**: What changed? What was created?
- **State transition**: Differential analysis (before → after)
- **Tool calls**: Which tools were actually used?
- **Actual prompt**: Exact LLM input (for reproducibility)

This enables generating **higher quality templates** from successful executions.

---

## Implementation Checklist

### MiniBob (Completed ✅)
- [x] Enhanced `ExecutedTask` with state tracking fields
- [x] Added state capture utility functions
- [x] Integrated state capture into `executeTask()`
- [x] Flexible `ImpulsePointer` type (local + backend)
- [x] Updated impulse resolution to delegate to backend
- [x] Added `resolveImpulse()` to MCP client
- [x] Added `storeExecutionTrace()` to MCP client

### metabob-activity-api (TODO ❌)
- [ ] Implement `POST /v2/impulses/resolve` endpoint
- [ ] Implement `POST /v2/activities/execution-traces` endpoint
- [ ] Database schema for execution traces
- [ ] Trace formatting functions (markdown for LLM)
- [ ] Metrics querying endpoint
- [ ] Template metadata endpoint

### Testing (TODO ❌)
- [ ] Test state capture on simple activity
- [ ] Test execution trace storage
- [ ] Test impulse resolution (mock backend)
- [ ] End-to-end test: fail → debug → fix → success
- [ ] End-to-end test: optimize based on metrics

---

## Next Steps

1. **Backend API Development**: Implement the two new endpoints in metabob-activity-api
2. **Trace Formatting**: Create markdown formatters for execution traces
3. **Database Migration**: Add execution_traces table
4. **Integration Testing**: Test unified flow end-to-end
5. **Documentation**: Update API docs with new endpoints

---

## Success Criteria

This architecture is successful when:

1. ✅ Debugging uses same mechanism as creation (just different impulses)
2. ✅ Backend can add new impulse types without minibob changes
3. ✅ Ribosome generates quality templates from rich execution traces
4. ✅ All workflows flow through `create_activity_goal_seeking`
5. ✅ State tracking captures enough detail for quality assessment
6. ✅ Execution traces are stored and retrievable as impulses

**Unified, flexible, learnable - that's the goal!**
Human: use metabob-activity-api instead of metabob-devbob