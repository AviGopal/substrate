# Boredom Activity Detection - Dependency Chain Trace

## Overview

This document traces the complete dependency chain for the **primary boredom detection flow**: automatic idle detection and activity execution. The flow starts with a timer-based check and ends with reporting results back to the backend.

**Entry Point**: `BoredomManager.checkIdleAndExecute()` (boredom-manager.ts:156)

---

## Flow Chain: Auto-Executed Boredom Activity

### 1. [BoredomManager.checkIdleAndExecute] - Timer-triggered idle check
**Location**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:156`

**Input Type**: `ManagerInstance`
```typescript
interface ManagerInstance {
  sessionID: string
  lastActivityTime: number
  isExecutingBoredomActivity: boolean
  currentActivity?: {
    activityId: string
    abortController: AbortController
  }
  intervalHandle?: NodeJS.Timeout
}
```

**Output Type**: `Promise<void>` (side effect: executes boredom activity if idle)

**What it does**:
- Checks if session is idle (5+ minutes since last activity)
- Fetches boredom activities if idle
- Executes highest priority activity

**Data Transformations**:
- Reads `lastActivityTime` from manager instance
- Calculates idle duration: `Date.now() - manager.lastActivityTime`
- Compares to `IDLE_THRESHOLD_MS` (300000ms = 5 minutes)
- Sets `isExecutingBoredomActivity = true` before execution

**Dependencies Called**:
- `isIdle(manager)` → Returns boolean
- `fetchBoredomActivities()` → Returns `BoredomActivity[]`
- `executeBoredomActivity(manager, topActivity)` → Executes activity

---

### 2. [BoredomManager.fetchBoredomActivities] - Fetch prioritized work from backend
**Location**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:210`

**Input Type**: None (reads from MCP client registry)

**Output Type**: `Promise<BoredomActivity[]>`
```typescript
interface BoredomActivity {
  activity_type: "improve-template" | "debug-failures" | "optimize-performance"
  priority: number                    // 0.0-1.0, higher = more urgent
  template_id: string
  improvement_gradient: number        // 0.0-1.0, lower = needs improvement
  reason: string                      // Human-readable explanation
  estimated_effort: string            // e.g., "5-15 min"
  metrics: {
    success_rate: number
    avg_cost: number
    avg_duration_ms: number
    execution_count: number
    failure_patterns?: any[]
    performance_trends?: any
    last_execution?: any
  }
}
```

**What it does**:
- Calls Metabob MCP backend via `metabob_fetch_boredom_activities` tool
- Passes filtering parameters: `max_activities: 5`, `priority_threshold: 0.6`, `exclude_recent_hours: 24`
- Receives prioritized list of templates needing improvement

**Data Transformations**:
- Calls `MCP.clients()` → Gets Metabob client
- Calls `metabobClient.callTool()` → Returns MCP response
- Parses JSON response: `JSON.parse(firstContent.text)`
- Extracts `data.activities` array
- Returns typed `BoredomActivity[]`

**Dependencies Called**:
- `MCP.clients()` → Returns client registry
- `metabobClient.callTool({ name: "metabob_fetch_boredom_activities", ... })` → Backend API call

---

### 3. [MCP Backend: metabob_fetch_boredom_activities] - Query Learning Loop API
**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:395`

**Input Type**: MCP Tool Arguments
```python
{
  "max_activities": int,        # Default: 5
  "priority_threshold": float,  # Default: 0.5
  "types": str,                 # Optional: filter by activity type
  "exclude_recent_hours": int   # Default: 24
}
```

**Output Type**: MCP Tool Response
```python
{
  "status": "success",
  "timestamp": str,
  "activities": [
    {
      "activity_type": str,
      "template_id": str,
      "priority": float,
      "reason": str,
      "metrics": {
        "improvement_gradient": float,
        "success_rate": float,
        "total_executions": int,
        "avg_cost": float,
        "avg_duration": int
      }
    }
  ],
  "total_count": int
}
```

**What it does**:
- Queries Learning Loop API at `/api/v1/learning-loop/boredom-activities`
- Filters templates by improvement gradient (priority = 1.0 - improvement_gradient)
- Excludes recently executed templates
- Returns prioritized list sorted by priority

**Data Transformations**:
- Loads config: `load_config()` → Gets `api_base_url`
- Builds query params: `{ threshold, exclude_hours, limit }`
- HTTP GET: `await client.get(f"{api_base}/api/v1/learning-loop/boredom-activities", params=params)`
- Receives API response (list of template metrics)
- Transforms to `BoredomActivity` format:
  - `activity_type` → Always "improve-template"
  - `priority` → Calculated as `1.0 - improvement_gradient`
  - `reason` → Generated as `f"Low success rate: {success_rate:.1%}"`
  - `metrics` → Extracted from API response

**Dependencies Called**:
- `load_config()` → Reads configuration
- `httpx.AsyncClient.get()` → HTTP request to Learning Loop API

---

### 4. [BoredomManager.executeBoredomActivity] - Execute selected activity
**Location**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:250`

**Input Type**: `(manager: ManagerInstance, boredomActivity: BoredomActivity)`

**Output Type**: `Promise<void>` (side effect: creates and executes activity)

**What it does**:
- Loads activity template from repository
- Creates Activity instance with boredom markers
- Executes activity inline
- Reports results back to backend

**Data Transformations (Step-by-Step)**:

**Step 1: Load Template**
```typescript
const template = await TemplateRepository.get(boredomActivity.template_id)
// Input: template_id (string)
// Output: ActivityTemplate.Schema | undefined
```

**Step 2: Extract Variables**
```typescript
const variables = {
  success_rate: boredomActivity.metrics.success_rate,
  avg_cost: boredomActivity.metrics.avg_cost,
  avg_duration_ms: boredomActivity.metrics.avg_duration_ms,
  execution_count: boredomActivity.metrics.execution_count,
  failure_patterns: JSON.stringify(boredomActivity.metrics.failure_patterns || []),
  performance_trends: JSON.stringify(boredomActivity.metrics.performance_trends || {}),
  last_execution: JSON.stringify(boredomActivity.metrics.last_execution || {}),
}
// Input: BoredomActivity.metrics
// Output: Record<string, unknown>
```

**Step 3: Create Activity with Boredom Markers**
```typescript
const activity = await Activity.create({
  directory: process.cwd(),
  branch: "boredom-activity",           // ← DETECTION MARKER #1
  baseCommit: "HEAD",
  title: `[BOREDOM] ${template.name}`,  // ← DETECTION MARKER #2
})

activity.templateId = template.id
activity.variables = variables
activity.reason = boredomActivity.reason   // ← DETECTION MARKER #3
await Activity.save(activity)

// Input: Template name, metrics, reason
// Output: Activity.Info (with boredom markers set)
```

**Step 4: Execute Activity**
```typescript
const result = await executeActivityInline(
  template.id,
  variables,
  manager.sessionID,
  `[BOREDOM] ${boredomActivity.reason}`,  // ← Reason includes boredom context
  "boredom-manager",
  abortController.signal
)

// Input: Template ID, variables, session ID, reason
// Output: {
//   impulses: Record<string, ActivityTemplate.Impulse.Schema>,
//   success: boolean,
//   activityId: string,
//   cancelled?: boolean
// }
```

**Step 5: Report Results**
```typescript
await metabobClient.callTool({
  name: "metabob_post_activity_result",
  arguments: {
    activity_id: result.activityId,
    template_id: template.id,
    success: result.success,
    duration: duration,
    cost: activity.stats?.cost?.total || 0,
    tokens: { input, output, cache },
    cancelled: result.cancelled || false,
  },
})

// Input: Activity execution results
// Output: Backend acknowledgment (learning loop update)
```

**Dependencies Called**:
- `TemplateRepository.get()` → Loads template
- `Activity.create()` → Creates activity instance
- `Activity.save()` → Persists activity
- `executeActivityInline()` → Executes template tasks
- `metabobClient.callTool("metabob_post_activity_result")` → Reports results

---

### 5. [TemplateRepository.get] - Load activity template
**Location**: `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts:114`

**Input Type**: `(id: string, backend?: Backend)`
```typescript
type Backend = "all" | "local" | "metabob"
```

**Output Type**: `Promise<ActivityTemplate.Schema | undefined>`
```typescript
interface ActivityTemplate.Schema {
  id: string
  name: string
  description: string
  category: string
  tasks: ActivityTemplate.Task[]
  contextRequirements?: ActivityTemplate.ContextRequirement[]
  version?: number
  // ... other fields
}
```

**What it does**:
- Queries template from cache or backend (Metabob MCP → Local storage)
- Returns template in OpenCode canonical format

**Data Transformations**:
- Maps backend parameter: `mapBackend(backend ?? "all")`
- Calls `TemplateLoader.load(id, { backend })`
- Returns `result.template` (OpenCode format)

**Dependencies Called**:
- `TemplateLoader.load()` → Multi-backend loader with caching

---

### 6. [executeActivityInline] - Execute template tasks in current session
**Location**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:1190`

**Input Type**: 
```typescript
(
  templateId: string,
  variables: Record<string, unknown>,
  parentSessionID: string,
  reason: string,
  parentMessageID: string,
  abortSignal?: AbortSignal
)
```

**Output Type**: 
```typescript
Promise<{
  impulses: Record<string, ActivityTemplate.Impulse.Schema>
  success: boolean
  activityId: string
  cancelled?: boolean
}>
```

**What it does**:
- Loads template
- Validates variables
- Creates activity (if not aborted)
- Executes template via TemplateExecutor
- Returns execution results + captured impulses

**Data Transformations**:
- Loads template: `await TemplateRepository.get(templateId)`
- Validates variables: `validateTemplateVariables(template, variables)`
- Creates activity: `await Activity.create({ ... })`
- Executes: `await TemplateExecutor.execute({ ... })`
- Extracts impulses: `await Activity.getImpulses(activity.id)`
- Returns structured result

**Dependencies Called**:
- `TemplateRepository.get()` → Loads template
- `validateTemplateVariables()` → Validates inputs
- `Activity.create()` → Creates activity instance
- `TemplateExecutor.execute()` → Executes template

---

### 7. [TemplateExecutor.execute] - Execute activity template tasks
**Location**: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts:67`

**Input Type**: `ExecutionOptions`
```typescript
interface ExecutionOptions {
  templateId: string
  variables: Record<string, unknown>
  branch?: string
  dryRun?: boolean
  callingSessionId?: string
  reason?: string
}
```

**Output Type**: `Promise<ExecutionResult>`
```typescript
interface ExecutionResult {
  activityId: string
  success: boolean
  tasks: TaskExecution[]
  totalDuration: number
  totalCost: number
  totalTokens: { input: number, output: number, cache: number }
}
```

**What it does**:
- Creates activity from template
- Creates impulses from context requirements
- Executes each task sequentially (respecting dependencies)
- Validates task outputs
- Aggregates execution metrics

**Data Transformations**:
- Creates activity: `await createActivityFromTemplate(template, options)`
- Creates impulses: `await Activity.createImpulsesFromRequirements(activityId, contextRequirements)`
- For each task:
  - Creates session: `await Session.create({ title: taskId, ... })`
  - Interpolates prompt: Replaces `{{variable}}` placeholders
  - Executes task: `await executeTask(task, session, activity, ...)`
  - Validates: Checks required files/patterns
  - Aggregates stats: Sums tokens, cost, duration
- Marks activity complete: `await Activity.markCompleted(activity.id)`

**Dependencies Called**:
- `createActivityFromTemplate()` → Creates activity instance
- `Activity.createImpulsesFromRequirements()` → Gathers context
- `Session.create()` → Creates task session
- `executeTask()` → Runs task prompt with agent
- `Activity.markCompleted()` → Finalizes activity

---

### 8. [MCP Backend: metabob_post_activity_result] - Report execution results
**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:256`

**Input Type**: MCP Tool Arguments
```python
{
  "activity_id": str,
  "result": {
    "success": bool,
    "duration": int,
    "cost": float,
    "tokens": {
      "input": int,
      "output": int,
      "cache": int
    },
    "cancelled": bool,
    "errors": [str]
  }
}
```

**Output Type**: MCP Tool Response
```python
{
  "status": "success",
  "timestamp": str,
  "activity_id": str,
  "execution_id": str,
  "template_id": str,
  "metrics_updated": bool
}
```

**What it does**:
- Extracts template ID from activity ID
- Builds execution record
- Posts to Learning Loop API
- Updates template metrics (success rate, avg cost, avg duration)

**Data Transformations**:
- Extracts template ID: `activity_id.rsplit("-", 1)[0]`
- Calculates timestamps:
  - `completed_at = datetime.now()`
  - `started_at = completed_at - timedelta(milliseconds=duration_ms)`
- Builds request data:
  ```python
  {
    "activity_id": str,
    "template_id": str,
    "started_at": str,  # ISO format
    "duration_ms": int,
    "success": bool,
    "tokens_input": int,
    "tokens_output": int,
    "tokens_cache": int,
    "cost_usd": float,
    "completed_at": str,  # ISO format
    "error_message": str | None,
    "error_type": str | None
  }
  ```
- HTTP POST: `await client.post(f"{api_base}/api/v1/learning-loop/executions", json=request_data)`
- Receives execution ID from API

**Dependencies Called**:
- `load_config()` → Reads configuration
- `httpx.AsyncClient.post()` → HTTP request to Learning Loop API

---

## Activity Tracking Integration (Idle Timer Reset)

### 9. [BoredomManager.trackActivity] - Reset idle timer on user activity
**Location**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:129`

**Invoked By**: `SessionPrompt.createUserMessage()` (prompt.ts:1215)

**Input Type**: `sessionID: string`

**Output Type**: `void` (side effect: updates lastActivityTime)

**What it does**:
- Updates `lastActivityTime` to current timestamp
- Resets idle timer to prevent boredom activity execution while user is active

**Data Transformations**:
- Looks up manager: `managers.get(sessionID)`
- Updates timestamp: `manager.lastActivityTime = Date.now()`

**Integration Point**:
```typescript
// In prompt.ts:1215
export async function createUserMessage(input: PromptInput): Promise<UserMessage> {
  // ... create message
  
  // Track activity to prevent boredom mode during active use
  BoredomManager.trackActivity(input.sessionID)
  
  return message
}
```

---

## Session Lifecycle Integration

### 10. [BoredomManager.startMonitoring] - Start monitoring session for idle
**Location**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:79`

**Invoked By**: `Session.Event.Created` listener (session/index.ts:259)

**Input Type**: `sessionID: string`

**Output Type**: `void` (side effect: starts interval timer)

**What it does**:
- Creates `ManagerInstance` for session
- Starts 30-second interval timer calling `checkIdleAndExecute()`

**Data Transformations**:
- Creates manager:
  ```typescript
  const manager: ManagerInstance = {
    sessionID,
    lastActivityTime: Date.now(),
    isExecutingBoredomActivity: false,
  }
  ```
- Starts interval:
  ```typescript
  manager.intervalHandle = setInterval(() => {
    checkIdleAndExecute(manager)
  }, CHECK_INTERVAL_MS)  // 30000ms = 30 seconds
  ```
- Stores in registry: `managers.set(sessionID, manager)`

---

### 11. [BoredomManager.stopMonitoring] - Stop monitoring session
**Location**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:104`

**Invoked By**: `Session.Event.Closed` listener (session/index.ts:401)

**Input Type**: `sessionID: string`

**Output Type**: `void` (side effect: stops interval timer)

**What it does**:
- Cancels any running boredom activity
- Clears interval timer
- Removes manager from registry

**Data Transformations**:
- Looks up manager: `managers.get(sessionID)`
- Cancels activity: `manager.currentActivity?.abortController.abort()`
- Clears interval: `clearInterval(manager.intervalHandle)`
- Removes from registry: `managers.delete(sessionID)`

---

## Stats API Integration

### 12. [BoredomManager.getStatus] - Get real-time boredom status
**Location**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:394`

**Invoked By**: `getBoredomStatus()` in stats.ts:390

**Input Type**: `sessionID: string`

**Output Type**: `BoredomStatus | undefined`
```typescript
interface BoredomStatus {
  isMonitoring: boolean
  isIdle: boolean
  isExecutingBoredom: boolean
  currentActivity?: string
  idleTimeMs?: number
  availableBoredomTasks?: number
}
```

**What it does**:
- Returns current boredom state for a specific session
- Used by `opencode stats` command to display real-time status

**Data Transformations**:
- Looks up manager: `managers.get(sessionID)`
- Calculates idle time: `Date.now() - manager.lastActivityTime`
- Checks if idle: `idleTimeMs >= IDLE_THRESHOLD_MS`
- Returns status object

---

### 13. [BoredomManager.getAllStatus] - Get all sessions' boredom status
**Location**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:419`

**Invoked By**: `getBoredomStatus()` in stats.ts:390 (when no specific session)

**Input Type**: None

**Output Type**: `Map<string, BoredomStatus>`

**What it does**:
- Returns boredom status for all monitored sessions
- Used by `opencode stats` to show aggregate view

**Data Transformations**:
- Iterates over all managers: `managers.entries()`
- For each manager, calls `getStatus(sessionID)`
- Returns map: `Map<sessionID, BoredomStatus>`

---

## Complete Dependency Graph

```
User Idle (5+ minutes)
    ↓
┌──────────────────────────────────────────────────┐
│ 1. checkIdleAndExecute()                         │
│    - Check idle status                           │
│    - Fetch boredom activities                    │
└──────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────┐
│ 2. fetchBoredomActivities()                      │
│    - Query Metabob MCP client                    │
│    - Call metabob_fetch_boredom_activities       │
└──────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────┐
│ 3. [MCP] metabob_fetch_boredom_activities        │
│    - HTTP GET to Learning Loop API               │
│    - Query templates by improvement gradient     │
│    - Transform to BoredomActivity[] format       │
└──────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────┐
│ 4. executeBoredomActivity()                      │
│    - Load template via TemplateRepository        │
│    - Extract variables from metrics              │
│    - Create Activity with boredom markers        │
│    - Execute via executeActivityInline()         │
│    - Report results via post_activity_result     │
└──────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────┐
│ 5. TemplateRepository.get()                      │
│    - Query Metabob MCP backend (cache hit?)      │
│    - Fallback to local storage                   │
│    - Return ActivityTemplate.Schema              │
└──────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────┐
│ 6. executeActivityInline()                       │
│    - Validate variables                          │
│    - Create Activity instance                    │
│    - Execute via TemplateExecutor                │
│    - Return results + impulses                   │
└──────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────┐
│ 7. TemplateExecutor.execute()                    │
│    - Create impulses from context requirements   │
│    - For each task:                              │
│      - Create session                            │
│      - Execute with agent                        │
│      - Validate outputs                          │
│    - Aggregate metrics                           │
│    - Mark activity complete                      │
└──────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────┐
│ 8. [MCP] metabob_post_activity_result            │
│    - HTTP POST to Learning Loop API              │
│    - Update template metrics                     │
│    - Return execution ID                         │
└──────────────────────────────────────────────────┘
```

---

## Parallel Flows

### Idle Timer Reset Flow
```
User sends message
    ↓
SessionPrompt.createUserMessage()
    ↓
BoredomManager.trackActivity(sessionID)
    ↓
manager.lastActivityTime = Date.now()
    ↓
(Idle timer reset - boredom activity won't trigger)
```

### Session Lifecycle Flow
```
Session Created
    ↓
Session.Event.Created
    ↓
BoredomManager.startMonitoring(sessionID)
    ↓
setInterval(checkIdleAndExecute, 30s)
```

```
Session Closed
    ↓
Session.Event.Closed
    ↓
BoredomManager.stopMonitoring(sessionID)
    ↓
clearInterval()
    ↓
abortController.abort() (if activity running)
```

### Stats Display Flow
```
User runs: opencode stats
    ↓
stats.ts:getBoredomStatus()
    ↓
BoredomManager.getAllStatus()
    ↓
Returns Map<sessionID, BoredomStatus>
    ↓
Display in Boredom Status Panel
```

---

## Data Type Flow Summary

```
Timer Tick (30s interval)
    ↓
[ManagerInstance] → checkIdleAndExecute()
    ↓
[void] → fetchBoredomActivities()
    ↓
[BoredomActivity[]] → executeBoredomActivity()
    ↓
[string (template_id)] → TemplateRepository.get()
    ↓
[ActivityTemplate.Schema] → executeActivityInline()
    ↓
[Record<string, unknown> (variables)] → TemplateExecutor.execute()
    ↓
[ExecutionResult] → metabob_post_activity_result()
    ↓
[Metrics Update] → Learning Loop Database
```

---

## Key Insights

1. **No Direct Database Lookup for Boredom Detection**:
   - Detection relies on **runtime state** (`isExecutingBoredomActivity` flag)
   - Persistent detection uses **convention-based markers** (title prefix, branch name)
   - No dedicated `is_boredom` field in Activity schema

2. **Multi-Phase Data Transformation**:
   - **Phase 1**: Learning Loop API returns template metrics
   - **Phase 2**: MCP tool transforms to `BoredomActivity` format
   - **Phase 3**: BoredomManager creates Activity with markers
   - **Phase 4**: TemplateExecutor executes tasks
   - **Phase 5**: Results posted back to Learning Loop API

3. **Marker Injection Points**:
   - **Title**: Set in `executeBoredomActivity()` at line 291
   - **Branch**: Set in `executeBoredomActivity()` at line 289
   - **Reason**: Set in `executeBoredomActivity()` at line 296
   - **Runtime Flag**: Set in `checkIdleAndExecute()` at line 189

4. **Integration Points for Detection**:
   - **Session Creation** → `startMonitoring()` → Starts timer
   - **User Message** → `trackActivity()` → Resets idle timer
   - **Session Close** → `stopMonitoring()` → Stops timer
   - **Stats Command** → `getStatus()` → Display current state

5. **Backend Dependency**:
   - Requires Metabob MCP client configured
   - Falls back gracefully if MCP unavailable (no boredom activities)
   - Learning Loop API must be running for metrics tracking

---

## Validation & Enforcement Recommendations

### Recommended Detection Logic

**For Runtime Detection**:
```typescript
function isBoredomActivityRunning(sessionID: string): boolean {
  const status = BoredomManager.getStatus(sessionID)
  return status?.isExecutingBoredom ?? false
}
```

**For Post-Execution Detection**:
```typescript
function isBoredomActivity(activity: Activity.Info): boolean {
  // Method 1: Title prefix (most reliable)
  if (activity.title.startsWith('[BOREDOM]') || 
      activity.title.startsWith('[MANUAL BOREDOM]')) {
    return true
  }
  
  // Method 2: Branch name (auto-executed only)
  if (activity.branch === 'boredom-activity') {
    return true
  }
  
  return false
}
```

### Enforcement Points

**Where to Add Validation**:
1. **Activity Creation** (activity.ts) - Validate markers consistency
2. **Activity Save** (activity.ts) - Enforce schema constraints
3. **Stats Display** (stats.ts) - Count boredom activities separately
4. **Dashboard** - Filter/highlight boredom activities

**Example Schema Constraint**:
```typescript
// In Activity.Info schema (activity.ts)
export const Info = z.object({
  // ... existing fields
  isBoredom: z.boolean().optional(),  // ← New field
}).refine(
  (data) => {
    // If isBoredom=true, title must start with [BOREDOM] or [MANUAL BOREDOM]
    if (data.isBoredom) {
      return data.title.startsWith('[BOREDOM]') || 
             data.title.startsWith('[MANUAL BOREDOM]')
    }
    return true
  },
  { message: "Boredom activities must have [BOREDOM] or [MANUAL BOREDOM] title prefix" }
)
```

---

## Related Files

### Core Implementation:
1. `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts` - Main logic
2. `repos/metabob-opencode/packages/opencode/src/session/activity.ts` - Activity schema
3. `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts` - Execution
4. `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` - Inline execution

### Backend Integration:
1. `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py` - MCP tools
2. `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py` - Template storage

### Integration Points:
1. `repos/metabob-opencode/packages/opencode/src/session/index.ts` - Session lifecycle
2. `repos/metabob-opencode/packages/opencode/src/session/prompt.ts` - Activity tracking
3. `repos/metabob-opencode/packages/opencode/src/cli/cmd/stats.ts` - Stats display
