# BoredomManager Dependency Chain Analysis

**Feature:** BoredomManager idle detection and auto-execution system  
**Purpose:** Trace the complete dependency chain from idle detection to activity execution  
**Date:** 2026-02-21

---

## Flow Chain Overview

```
User Activity
  ↓
Session.Event.Created / SessionPrompt.prompt()
  ↓
BoredomManager.trackActivity() / BoredomManager.startMonitoring()
  ↓
(5+ min idle) → BoredomManager.checkIdleAndExecute()
  ↓
MCP.getClient("metabob")
  ↓
metabob_fetch_boredom_activities (MCP Tool Call)
  ↓
BoredomActivity[] (sorted by priority)
  ↓
executeActivityInline() [tool/activity.ts]
  ↓
TemplateRepository.get(template_id)
  ↓
Activity.create() [session/activity.ts]
  ↓
TemplateExecutor.executeTemplate() [session/template-executor.ts]
  ↓
Task execution in parent session
  ↓
Activity completion → report result
  ↓
metabob_post_activity_result (MCP Tool Call)
```

---

## Detailed Component Chain

### 1. **Session.Event.Created** - Session initialization
**File:** `repos/metabob-opencode/packages/opencode/src/session/index.ts:97-103`  
**Purpose:** Bus event fired when new session is created  
**Input Type:**
```typescript
z.object({
  info: Session.Info  // Contains sessionID, directory, branch, etc.
})
```
**Output Type:** `void` (event broadcast)  
**Data Flow:**
- Session created via CLI (`opencode chat`)
- `Session.Event.Created` bus event fired
- BoredomManager subscribes and calls `startMonitoring(sessionID)`

---

### 2. **BoredomManager.startMonitoring()** - Initialize idle tracking
**File:** `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts` (NEW)  
**Purpose:** Register session for idle detection and start monitoring timer  
**Input Type:**
```typescript
sessionID: string
```
**Output Type:** `void`  
**Data Flow:**
```typescript
interface ManagerInstance {
  sessionID: string
  lastActivityTime: number  // Date.now()
  boredomTimer?: NodeJS.Timeout  // Periodic idle check (every 1 min)
  currentActivity?: {
    activityId: string
    abortController: AbortController
  }
  isIdle: boolean
}

// Store in Map
sessionManagers.set(sessionID, {
  sessionID,
  lastActivityTime: Date.now(),
  boredomTimer: setInterval(() => checkIdleAndExecute(sessionID), 60_000),
  isIdle: false
})
```

---

### 3. **SessionPrompt.prompt()** - User activity detection
**File:** `repos/metabob-opencode/packages/opencode/src/session/prompt.ts:369-400`  
**Purpose:** Create user message and track activity  
**Input Type:**
```typescript
SessionPrompt.PromptInput = {
  sessionID: string
  agent?: string
  parts: Array<{
    type: "text" | "image" | "tool_result"
    text?: string
    ...
  }>
  noReply?: boolean
  ...
}
```
**Output Type:** `Promise<MessageV2.Schema>`  
**Data Flow:**
```typescript
// In SessionPrompt.prompt():
const { BoredomManager } = await import("./boredom-manager")
BoredomManager.trackActivity(input.sessionID)

// Extract text and create user message
const userMsg = await createUserMessage(input)
await Session.touch(input.sessionID)
```

---

### 4. **BoredomManager.trackActivity()** - Reset idle timer
**File:** `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts` (NEW)  
**Purpose:** Update last activity timestamp and cancel boredom activity if running  
**Input Type:**
```typescript
sessionID: string
```
**Output Type:** `void`  
**Data Flow:**
```typescript
export function trackActivity(sessionID: string): void {
  const manager = sessionManagers.get(sessionID)
  if (!manager) return
  
  // Update timestamp
  manager.lastActivityTime = Date.now()
  
  // Cancel boredom activity if user returned
  if (manager.isIdle && manager.currentActivity) {
    log.info("user returned, cancelling boredom activity", {
      sessionID,
      activityId: manager.currentActivity.activityId
    })
    manager.currentActivity.abortController.abort()
    manager.currentActivity = undefined
  }
  
  // Reset idle state
  manager.isIdle = false
}
```

---

### 5. **BoredomManager.checkIdleAndExecute()** - Idle detection
**File:** `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts` (NEW)  
**Purpose:** Check if session is idle and execute boredom activity  
**Input Type:**
```typescript
sessionID: string
```
**Output Type:** `Promise<void>`  
**Data Flow:**
```typescript
async function checkIdleAndExecute(sessionID: string): Promise<void> {
  const manager = sessionManagers.get(sessionID)
  if (!manager) return
  
  const idleTime = Date.now() - manager.lastActivityTime
  
  // Check if idle threshold reached
  if (idleTime > IDLE_THRESHOLD_MS && !manager.isIdle) {
    manager.isIdle = true
    
    log.info("session idle, fetching boredom activities", {
      sessionID,
      idleTimeMs: idleTime
    })
    
    // Fetch activities
    const activities = await fetchBoredomActivities(sessionID)
    
    if (activities.length === 0) {
      log.info("no boredom activities available", { sessionID })
      return
    }
    
    // Sort by priority and execute highest
    const sorted = activities.sort((a, b) => b.priority - a.priority)
    const topActivity = sorted[0]
    
    await executeBoredomActivity(sessionID, topActivity)
  }
}
```

---

### 6. **MCP.getClient()** - Get Metabob MCP client
**File:** `repos/metabob-opencode/packages/opencode/src/mcp/index.ts:73-84`  
**Purpose:** Get MCP client for calling Metabob tools  
**Input Type:**
```typescript
clientName: "metabob"
```
**Output Type:** `MCPClient` (from @modelcontextprotocol/sdk)  
**Data Flow:**
```typescript
// In BoredomManager.fetchBoredomActivities():
const mcpClient = await MCP.getClient("metabob")
if (!mcpClient) {
  throw new Error("Metabob MCP client not configured")
}
```

---

### 7. **metabob_fetch_boredom_activities** - MCP Tool Call
**File:** Backend MCP server (metabob service)  
**Purpose:** Fetch prioritized boredom activities from backend  
**Input Type:**
```typescript
{
  max_activities: number        // 5
  priority_threshold: number    // 0.5
  exclude_recent_hours: number  // 24
}
```
**Output Type:**
```typescript
{
  activities: Array<{
    activity_type: "improve-template" | "debug-failures" | "optimize-performance"
    priority: number
    template_id: string
    improvement_gradient: number
    reason: string
    estimated_effort: string
    metrics: {
      success_rate: number
      avg_cost: number
      avg_duration_ms: number
      execution_count: number
      failure_patterns: Array<{...}>
      performance_trends: {...}
      last_execution: {...}
    }
  }>
}
```
**Data Flow:**
```typescript
// In BoredomManager.fetchBoredomActivities():
const result = await mcpClient.callTool({
  name: "metabob_fetch_boredom_activities",
  arguments: {
    max_activities: 5,
    priority_threshold: 0.5,
    exclude_recent_hours: 24
  }
})

const activities: BoredomActivity[] = result.content[0].text
  ? JSON.parse(result.content[0].text).activities
  : []

return activities
```

---

### 8. **executeActivityInline()** - Execute boredom activity
**File:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:1048-1230`  
**Purpose:** Execute activity template in parent session context  
**Input Type:**
```typescript
{
  templateId: string                       // From BoredomActivity.template_id
  variables: Record<string, unknown>       // Extracted from activity.metrics
  parentSessionID: string                  // Current session
  reason: string                           // From activity.reason
  parentMessageID: string                  // "boredom-system"
  abortSignal?: AbortSignal                // NEW: For cancellation
}
```
**Output Type:**
```typescript
{
  impulses: Record<string, ActivityTemplate.Impulse.Schema>
  success: boolean
  activityId: string
  cancelled?: boolean  // NEW
}
```
**Data Flow:**
```typescript
// In BoredomManager.executeBoredomActivity():
const abortController = new AbortController()

// Store for cancellation
manager.currentActivity = {
  activityId: "pending",
  abortController
}

const result = await executeActivityInline(
  activity.template_id,
  extractVariables(activity.metrics),
  sessionID,
  activity.reason,
  "boredom-system",
  abortController.signal  // Pass abort signal
)

manager.currentActivity.activityId = result.activityId
```

---

### 9. **TemplateRepository.get()** - Fetch activity template
**File:** `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`  
**Purpose:** Get activity template (tries Metabob MCP first, then local)  
**Input Type:**
```typescript
templateId: string  // e.g., "fix-type-errors", "optimize-imports"
```
**Output Type:**
```typescript
ActivityTemplate.Schema | undefined = {
  id: string
  name: string
  description: string
  category: "feature" | "bugfix" | "refactor" | ...
  tasks: Array<{
    id: string
    subagent: string
    description: string
    dependencies: string[]
    prompt: {...}
    validation: {...}
    retry: {...}
  }>
  version: {...}
  executions: number
  successRate: number
  avgCost: number
  avgDuration: number
  ...
}
```
**Data Flow:**
```typescript
// In executeActivityInline():
const template = await TemplateRepository.get(templateId)
if (!template) {
  throw ActivityTemplateError.notFound(templateId)
}

// Validate variables
const validationResult = validateTemplateVariables(template, variables)
if (!validationResult.valid) {
  throw ActivityValidationError.missingVariables(...)
}
```

---

### 10. **Activity.create()** - Create activity tracking
**File:** `repos/metabob-opencode/packages/opencode/src/session/activity.ts:100-180`  
**Purpose:** Create activity instance for tracking execution  
**Input Type:**
```typescript
{
  directory: string     // process.cwd()
  branch: string        // "lifecycle-hook"
  baseCommit: string    // "HEAD"
  title: string         // template.name
}
```
**Output Type:**
```typescript
Activity.Info = {
  id: string                        // Generated ID
  directory: string
  branch: string
  baseCommit: string
  status: "executing" | "done" | "failed" | "cancelled"
  templateId?: string
  templateVersion?: number
  variables: Record<string, unknown>
  reason?: string
  callingSessionId?: string
  stats: {
    duration: number
    cost: { total: number, perPrompt: [...] }
    tokens: { input, output, cache, reasoning }
    metabob: {...}
  }
  executionEvidence: {
    sessionsSpawned: [...]
    toolCalls: [...]
  }
  workArtifacts: {
    filesChanged: [...]
    commitsMade: [...]
  }
  ...
}
```
**Data Flow:**
```typescript
// In executeActivityInline():
const activity = await Activity.create({
  directory: process.cwd(),
  branch: "lifecycle-hook",
  baseCommit: "HEAD",
  title: template.name
})

// Set template info
activity.templateId = template.id
activity.templateVersion = template.version.generation
activity.variables = variables
activity.reason = reason
activity.callingSessionId = parentSessionID
activity.status = "executing"

// Link activity to parent session
await Session.update(parentSessionID, (draft) => {
  draft.activityId = activity.id
})

await Activity.save(activity)
```

---

### 11. **TemplateExecutor.executeTemplate()** - Execute tasks
**File:** `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts:67-180`  
**Purpose:** Execute activity tasks in dependency order  
**Input Type:**
```typescript
{
  template: ActivityTemplate.Schema
  activity: Activity.Info
  variables: Record<string, unknown>
  sessionID: string                  // Parent session ID
  abortSignal: AbortSignal           // For cancellation
  model: Provider.Model              // LLM model
  options: {
    onStatusUpdate: () => void
    parentSessionID: string
  }
}
```
**Output Type:**
```typescript
{
  success: boolean
  tasks: Array<TaskExecution>
  totalDuration: number
  totalCost: number
  totalTokens: { input, output, cache }
}
```
**Data Flow:**
```typescript
// In executeActivityInline():
const result = await executeTemplate(
  template,
  activity,
  variables,
  parentSessionID,  // Execute in parent session
  AbortSignal.timeout(300000),  // 5 min timeout
  parentModel,
  {
    onStatusUpdate: () => {},
    parentSessionID: parentSessionID
  }
)

// Check if aborted
if (abortSignal?.aborted) {
  activity.status = "cancelled"
  await Activity.save(activity)
  return {
    impulses: {},
    success: false,
    activityId: activity.id,
    cancelled: true
  }
}

// Mark activity complete
activity.status = result.success ? "done" : "failed"
activity.completedAt = Date.now()
activity.stats.duration = result.totalDuration
activity.stats.cost.total = result.totalCost
await Activity.save(activity)
```

---

### 12. **metabob_post_activity_result** - Report result to backend
**File:** Backend MCP server (metabob service)  
**Purpose:** Report activity execution result to update template metrics  
**Input Type:**
```typescript
{
  activityId: string
  result: {
    success: boolean
    duration: number    // milliseconds
    cost: number        // dollars
    tokens?: {
      input: number
      output: number
      cache: number
    }
    errors?: string[]
  }
}
```
**Output Type:**
```typescript
{
  success: boolean
  metrics_updated: boolean
  improvement_gradient: number  // Updated gradient
}
```
**Data Flow:**
```typescript
// In BoredomManager.executeBoredomActivity() after completion:
const mcpClient = await MCP.getClient("metabob")

await mcpClient.callTool({
  name: "metabob_post_activity_result",
  arguments: {
    activityId: result.activityId,
    result: {
      success: result.success,
      duration: activity.stats.duration,
      cost: activity.stats.cost.total,
      tokens: {
        input: activity.stats.tokens.input,
        output: activity.stats.tokens.output,
        cache: activity.stats.tokens.cache.read
      },
      errors: result.success ? undefined : [activity.error]
    }
  }
})

log.info("boredom activity result reported", {
  sessionID,
  activityId: result.activityId,
  success: result.success
})

// Clear current activity
manager.currentActivity = undefined
```

---

## Data Transformations

### Transformation 1: User Activity → Idle Detection
**Input:** User message via `SessionPrompt.prompt()`  
**Process:**
1. Extract sessionID from prompt input
2. Call `BoredomManager.trackActivity(sessionID)`
3. Update `lastActivityTime = Date.now()`
4. Cancel boredom activity if running
**Output:** Idle timer reset, `isIdle = false`

---

### Transformation 2: Idle State → BoredomActivity[]
**Input:** Idle session (5+ min no activity)  
**Process:**
1. Calculate idle time: `Date.now() - lastActivityTime`
2. Check if `idleTime > IDLE_THRESHOLD_MS`
3. Call MCP tool: `metabob_fetch_boredom_activities`
4. Parse JSON response
5. Sort activities by priority
**Output:** `BoredomActivity[]` sorted descending by priority

---

### Transformation 3: BoredomActivity → Activity Execution
**Input:** `BoredomActivity` (highest priority)  
**Process:**
1. Extract template_id from activity
2. Create variables from activity.metrics
3. Create AbortController for cancellation
4. Call `executeActivityInline()` with abort signal
5. Store activityId in manager state
**Output:** Activity execution in progress

---

### Transformation 4: Activity Result → Backend Metrics
**Input:** `Activity.Info` (completed/failed/cancelled)  
**Process:**
1. Extract execution metrics (duration, cost, tokens)
2. Call MCP tool: `metabob_post_activity_result`
3. Backend updates template success rate and improvement gradient
**Output:** Updated template metrics in backend

---

## Cancellation Flow

### Cancellation Trigger: User Returns
```
User sends message
  ↓
SessionPrompt.prompt() called
  ↓
BoredomManager.trackActivity(sessionID)
  ↓
Check if manager.currentActivity exists
  ↓
If exists: manager.currentActivity.abortController.abort()
  ↓
AbortSignal propagates through execution chain
  ↓
TemplateExecutor checks abortSignal.aborted before each task
  ↓
Throws AbortError → execution stops
  ↓
executeActivityInline() catches abort
  ↓
Sets activity.status = "cancelled"
  ↓
Reports cancellation to backend
  ↓
Clears manager.currentActivity
```

---

## Critical Dependencies

### Existing Components (No Changes)
1. ✅ **Session.Event.Created** - Bus event system
2. ✅ **SessionPrompt.prompt()** - User message handling
3. ✅ **MCP.getClient()** - MCP client access
4. ✅ **metabob_fetch_boredom_activities** - Backend tool (IMPLEMENTED)
5. ✅ **metabob_post_activity_result** - Backend tool (EXISTING)
6. ✅ **TemplateRepository.get()** - Template fetching
7. ✅ **Activity.create()** - Activity tracking
8. ✅ **TemplateExecutor.executeTemplate()** - Task execution

### Required Changes
1. ⚠️ **Add AbortSignal parameter to executeActivityInline()**
   - File: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:1048`
   - Add optional `abortSignal?: AbortSignal` parameter
   - Pass signal to `executeTemplate()`
   - Check `abortSignal.aborted` before completion

2. ⚠️ **Add cancellation support in TemplateExecutor**
   - File: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`
   - Check `abortSignal.aborted` before each task execution
   - Throw `AbortError` if aborted
   - Handle graceful cleanup

### New Components (To Implement)
1. 🆕 **BoredomManager class**
   - File: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`
   - All methods: startMonitoring, trackActivity, checkIdleAndExecute, etc.

---

## Summary

**Complete Dependency Chain:**

```
Session.Event.Created (line 98)
  → BoredomManager.startMonitoring()
  → setInterval(checkIdleAndExecute, 60_000)

SessionPrompt.prompt() (line 369)
  → BoredomManager.trackActivity()
  → Update lastActivityTime
  → Cancel boredom activity if running

(5 min idle) → BoredomManager.checkIdleAndExecute()
  → MCP.getClient("metabob")
  → metabob_fetch_boredom_activities (MCP)
  → Sort by priority

BoredomManager.executeBoredomActivity()
  → executeActivityInline() (line 1048)
  → TemplateRepository.get()
  → Activity.create() (line 111)
  → TemplateExecutor.executeTemplate() (line 67)
  → Task execution with AbortSignal
  → Activity completion

Report result:
  → metabob_post_activity_result (MCP)
  → Backend updates metrics
  → Clear manager.currentActivity
```

**Key Integration Points:**
- Session lifecycle events (Created, Updated)
- User message handling (prompt)
- MCP tool calls (fetch, post)
- Activity execution (executeActivityInline)
- Cancellation mechanism (AbortSignal)

**Next Step:** Implement BoredomManager using the propagate-change-through-flow activity.

