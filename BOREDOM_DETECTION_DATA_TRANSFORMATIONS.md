# Boredom Activity Detection - Data Transformations Trace

## Overview

This document traces **every data transformation** in the boredom activity detection flow, documenting what changes, why it changes, validation rules applied, and side effects produced.

---

## Transformation 1: Timer Tick → Idle Check

**Component Flow**: `setInterval()` → `checkIdleAndExecute()`

**Location**: `boredom-manager.ts:59-63`

### What Changes:
- **Input**: Time elapsed (30 seconds)
- **Output**: Invocation of `checkIdleAndExecute(manager)`
- **Type Conversion**: None (trigger event)

### Why This Exists:
- **Business Requirement**: Periodic polling for idle sessions without blocking main thread
- **Design Decision**: 30-second interval balances responsiveness vs performance
  - Too frequent: Wastes CPU cycles
  - Too infrequent: Delays boredom activity execution

### Validations:
- None (unconditional timer trigger)

### Side Effects:
- Async function call to `checkIdleAndExecute(manager)`
- Error logged if check fails (non-blocking)

---

## Transformation 2: Idle Status Calculation

**Component Flow**: `ManagerInstance` → `isIdle()`

**Location**: `boredom-manager.ts:202-205`

### What Changes:
```typescript
// Input
interface ManagerInstance {
  sessionID: string
  lastActivityTime: number  // Unix timestamp (ms)
  isExecutingBoredomActivity: boolean
  currentActivity?: { ... }
}

// Transformation
const idleTime = Date.now() - manager.lastActivityTime
const isIdle = idleTime >= IDLE_THRESHOLD_MS  // 300000ms = 5 minutes

// Output
boolean  // true if idle, false if active
```

### Why This Exists:
- **Business Requirement**: Only execute boredom activities when user is genuinely absent
- **Threshold Rationale**: 5 minutes chosen as sweet spot:
  - Not too short: Avoids interrupting brief pauses (thinking, meetings, coffee)
  - Not too long: Doesn't waste productive idle time
- **Alternative Approach**: Could use exponential backoff, but fixed threshold is simpler

### Validations:
- `IDLE_THRESHOLD_MS` constant: `5 * 60 * 1000` (300000ms)
- No validation on `lastActivityTime` (assumed valid Unix timestamp)

### Side Effects:
- None (pure function)

---

## Transformation 3: MCP Tool Call Preparation

**Component Flow**: `checkIdleAndExecute()` → `fetchBoredomActivities()`

**Location**: `boredom-manager.ts:210-245`

### What Changes:
```typescript
// Input
// None (implicit: requires MCP client configured)

// Transformation
const clients = await MCP.clients()
const metabobClient = clients["metabob"]

const result = await metabobClient.callTool({
  name: "metabob_fetch_boredom_activities",
  arguments: {
    max_activities: 5,
    priority_threshold: 0.6,
    exclude_recent_hours: 24,
  },
})

// Output
BoredomActivity[]  // Parsed from JSON response
```

### Why This Exists:
- **Business Requirement**: Fetch prioritized work from centralized backend (Learning Loop API)
- **MCP Integration**: Decouples frontend from backend API details
- **Parameter Rationale**:
  - `max_activities: 5` - Limit to avoid overwhelming idle agent
  - `priority_threshold: 0.6` - Focus on medium-low quality templates (improvement_gradient < 0.6)
  - `exclude_recent_hours: 24` - Prevent re-executing same template too frequently

### Validations:
- MCP client existence check: `if (!metabobClient) return []`
- JSON parsing: `JSON.parse(firstContent.text)`
- Status check: `if (data.status === "success" && Array.isArray(data.activities))`

### Side Effects:
- HTTP request to backend API (via MCP)
- Logs debug/warn messages

---

## Transformation 4: Backend API Response → BoredomActivity[]

**Component Flow**: Learning Loop API → `metabob_fetch_boredom_activities` → OpenCode

**Location**: `activity_template_tools.py:433-455`

### What Changes:
```python
# Input (from Learning Loop API)
[
  {
    "template_id": str,
    "improvement_gradient": float,  # 0.0-1.0
    "success_rate": float,          # 0.0-1.0
    "total_executions": int,
    "avg_cost_usd": float,
    "avg_duration_ms": int,
    ...
  }
]

# Transformation
activities = []
for template_metrics in activities_data:
    activities.append({
        "activity_type": "improve-template",  # ← Always this type
        "template_id": template_metrics.get("template_id"),
        "priority": 1.0 - template_metrics.get("improvement_gradient", 0.5),  # ← INVERSION
        "reason": f"Low success rate: {template_metrics.get('success_rate', 0.0):.1%}",
        "metrics": {
            "improvement_gradient": template_metrics.get("improvement_gradient"),
            "success_rate": template_metrics.get("success_rate"),
            "total_executions": template_metrics.get("total_executions"),
            "avg_cost": template_metrics.get("avg_cost_usd"),
            "avg_duration": template_metrics.get("avg_duration_ms"),
        },
    })

# Output
BoredomActivity[] (TypedDict)
```

### Why This Exists:
- **Business Requirement**: Convert backend metrics to actionable task format
- **Priority Inversion**: `priority = 1.0 - improvement_gradient`
  - **Why**: improvement_gradient near 0 = needs improvement = high priority
  - **Alternative**: Could expose gradient directly, but "priority" is more intuitive
- **Reason Generation**: Auto-generate human-readable explanation
  - **Why**: Provides context for execution logs and debugging

### Validations:
- `.get()` with defaults: `improvement_gradient` defaults to `0.5` if missing
- Type assertions: API response assumed to be list of dicts

### Side Effects:
- None (pure transformation)

---

## Transformation 5: BoredomActivity → Activity.Info (Marker Injection)

**Component Flow**: `executeBoredomActivity()` → `Activity.create()`

**Location**: `boredom-manager.ts:286-297`

### What Changes:
```typescript
// Input
interface BoredomActivity {
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
    failure_patterns?: any[]
    performance_trends?: any
    last_execution?: any
  }
}

// Transformation
const activity = await Activity.create({
  directory: process.cwd(),
  branch: "boredom-activity",           // ← DETECTION MARKER #1
  baseCommit: "HEAD",
  title: `[BOREDOM] ${template.name}`,  // ← DETECTION MARKER #2
})

activity.templateId = template.id
activity.variables = {
  success_rate: boredomActivity.metrics.success_rate,
  avg_cost: boredomActivity.metrics.avg_cost,
  avg_duration_ms: boredomActivity.metrics.avg_duration_ms,
  execution_count: boredomActivity.metrics.execution_count,
  failure_patterns: JSON.stringify(boredomActivity.metrics.failure_patterns || []),
  performance_trends: JSON.stringify(boredomActivity.metrics.performance_trends || {}),
  last_execution: JSON.stringify(boredomActivity.metrics.last_execution || {}),
}
activity.reason = boredomActivity.reason  // ← DETECTION MARKER #3
await Activity.save(activity)

// Output
Activity.Info (with boredom markers injected)
```

### Why This Exists:
- **Business Requirement**: Mark activities as boredom-generated for tracking and detection
- **Marker Strategy**:
  - **Title Prefix `[BOREDOM]`**: Human-readable, shows in UI/logs
  - **Branch Name `boredom-activity`**: Isolates boredom work from user branches
  - **Reason Field**: Captures why this activity was selected (metrics-driven)

### Why No Dedicated `isBoredom` Field?
- **Current Design**: Convention-based (title prefix, branch name)
- **Trade-offs**:
  - ✅ **Pros**: Simple, human-readable, backward compatible
  - ❌ **Cons**: Requires string matching for detection, not schema-enforced
- **Alternative**: Add `Activity.Info.isBoredom: boolean` field
  - **Why not implemented**: Likely to avoid schema changes and maintain simplicity

### Validations:
- None (markers are convention-based strings, not validated)

### Side Effects:
- `Activity.create()` → Persists to storage
- `Bus.publish(Event.Created)` → Notifies listeners
- `Activity.save()` → Persists updated activity with markers

---

## Transformation 6: Activity.Info Creation (Schema Initialization)

**Component Flow**: `Activity.create(options)` → `Activity.Info`

**Location**: `activity.ts:388-456`

### What Changes:
```typescript
// Input
interface CreateOptions {
  directory: string
  branch: string
  baseCommit: string
  title: string
  todos?: Todo[]
}

// Transformation
const activity: Info = {
  id: generateID(),  // ← "act_" + timestamp + random
  directory: options.directory,
  branch: options.branch,
  baseCommit: options.baseCommit,
  title: `[EVIDENCE_TEST] ${options.title}`,  // ← DEBUG PREFIX ADDED!
  status: "setup",  // ← Initial status
  todos: options.todos || [],
  prompts: [],
  agentsUsed: [],
  sessionIDs: [],
  commits: [],
  startedAt: Date.now(),  // ← Timestamp capture
  stats: {  // ← Initialize all metrics to 0
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    cost: { total: 0, perPrompt: [] },
    metabob: { enabled: false, issuesResolved: 0, issuesAdded: 0, ... },
    duration: 0,
  },
  impulses: {},
  agentDecisions: [],
  acpAgents: [],
  
  // Correctness validation fields (NEW)
  executionEvidence: {
    sessionsSpawned: [],
    toolCalls: [],
  },
  validationEvidence: undefined,
  workArtifacts: {
    filesChanged: [],
    commitsMade: [],
  },
  correctnessVerdict: undefined,
}

// Output
Activity.Info (fully initialized)
```

### Why This Exists:
- **Business Requirement**: Initialize all required fields for activity tracking
- **Schema Design Decisions**:
  - **Stats Initialization**: Start at 0 for accurate aggregation
  - **Status = "setup"**: Indicates activity not yet executing
  - **Evidence Fields**: Support correctness validation (new feature)
  - **DEBUG PREFIX**: `[EVIDENCE_TEST]` added to title (line 443) - **likely unintentional debug code**

### Why Evidence Fields?
- **Purpose**: Track execution correctness for learning loop feedback
- **Fields**:
  - `executionEvidence`: Proves activity actually ran (sessions, tool calls)
  - `validationEvidence`: Proves validation rules passed
  - `workArtifacts`: Proves work was done (files changed, commits made)
  - `correctnessVerdict`: Computed verdict based on evidence

### Validations:
- `generateID()`: Generates unique ID with timestamp + random bytes
- All fields initialized to match `Activity.Info` schema (Zod validation)

### Side Effects:
- Calls `save(activity)` → Persists to storage
- Publishes `Event.Created` → Notifies listeners

---

## Transformation 7: Activity.Info → Storage Format (Impulse Cleaning)

**Component Flow**: `Activity.save(activity)` → Storage

**Location**: `activity.ts:555-569`

### What Changes:
```typescript
// Input
Activity.Info (with full impulse content in memory)

// Transformation
const cleanedActivity = cleanImpulsesForStorage(activity)

// What cleanImpulsesForStorage does (not shown in snippet):
// - Removes large impulse content to prevent memory leaks
// - Keeps impulse pointers/metadata
// - Reduces storage size

await Storage.write(["activity", activity.id], cleanedActivity)

// Output
Activity.Info (persisted to disk/storage with cleaned impulses)
```

### Why This Exists:
- **Business Requirement**: Prevent storage bloat from large impulse content
- **Problem**: Impulses can contain large file contents, API responses, etc.
- **Solution**: Clean content before persisting, keep only references
- **Trade-off**: Must re-resolve impulses when loading activity (lazy loading)

### Validations:
- Logs debug info before save (line 560-565):
  - `hasExecutionEvidence`
  - `hasWorkArtifacts`
  - `sessionsSpawnedCount`

### Side Effects:
- Writes to storage: `Storage.write(["activity", activity.id], cleanedActivity)`
- Publishes event: `Bus.publish(Event.Updated, { activity })`

---

## Transformation 8: Template Variables Extraction (Metrics → Variables)

**Component Flow**: `BoredomActivity.metrics` → `Record<string, unknown>`

**Location**: `boredom-manager.ts:273-281`

### What Changes:
```typescript
// Input
interface BoredomActivity.metrics {
  success_rate: number
  avg_cost: number
  avg_duration_ms: number
  execution_count: number
  failure_patterns?: any[]
  performance_trends?: any
  last_execution?: any
}

// Transformation
const variables: Record<string, unknown> = {
  success_rate: boredomActivity.metrics.success_rate,       // ← Direct copy
  avg_cost: boredomActivity.metrics.avg_cost,               // ← Direct copy
  avg_duration_ms: boredomActivity.metrics.avg_duration_ms, // ← Direct copy
  execution_count: boredomActivity.metrics.execution_count, // ← Direct copy
  failure_patterns: JSON.stringify(boredomActivity.metrics.failure_patterns || []),     // ← JSON serialization
  performance_trends: JSON.stringify(boredomActivity.metrics.performance_trends || {}), // ← JSON serialization
  last_execution: JSON.stringify(boredomActivity.metrics.last_execution || {}),         // ← JSON serialization
}

// Output
Record<string, unknown> (template variables)
```

### Why This Exists:
- **Business Requirement**: Pass metrics as variables to template for analysis
- **Why JSON.stringify()**:
  - Template variables must be flat key-value pairs
  - Complex objects (arrays, nested objects) must be serialized
  - Template prompts can use `{{failure_patterns}}` to access serialized data
- **Why Default to Empty**:
  - Optional fields may be missing from API response
  - `|| []` and `|| {}` prevent serializing `undefined` (which becomes `"undefined"` string)

### Validations:
- Default values: `|| []` for arrays, `|| {}` for objects
- Type assertion: All values coerced to `unknown` for template flexibility

### Side Effects:
- None (pure transformation)

---

## Transformation 9: Execution Results → Backend Report Format

**Component Flow**: `ExecutionResult` → `metabob_post_activity_result` arguments

**Location**: `boredom-manager.ts:331-346`

### What Changes:
```typescript
// Input (ExecutionResult from executeActivityInline)
interface ExecutionResult {
  impulses: Record<string, ActivityTemplate.Impulse.Schema>
  success: boolean
  activityId: string
  cancelled?: boolean
}

// Additional context from Activity.Info
activity.stats = {
  cost: { total: number },
  tokens: { input: number, output: number, cache: { read: number } }
}

// Transformation
await metabobClient.callTool({
  name: "metabob_post_activity_result",
  arguments: {
    activity_id: result.activityId,
    template_id: template.id,  // ← Not in ExecutionResult, from context
    success: result.success,
    duration: duration,  // ← Calculated: Date.now() - startTime
    cost: activity.stats?.cost?.total || 0,  // ← From activity stats
    tokens: {
      input: activity.stats?.tokens?.input || 0,
      output: activity.stats?.tokens?.output || 0,
      cache: activity.stats?.tokens?.cache?.read || 0,
    },
    cancelled: result.cancelled || false,
  },
})

// Output
MCP tool call (async, no return value used)
```

### Why This Exists:
- **Business Requirement**: Report execution results to Learning Loop for metrics tracking
- **Why Aggregate Stats**:
  - Execution result doesn't include cost/tokens (calculated separately)
  - Must pull from `activity.stats` which aggregates prompt costs
- **Why Duration Calculation**:
  - Track execution time for performance metrics
  - Used to calculate `started_at` timestamp in backend (line 280)

### Validations:
- Default to `0` if stats missing: `|| 0` for cost/tokens
- Default to `false` if cancelled missing: `|| false`

### Side Effects:
- HTTP POST to Learning Loop API (via MCP)
- Updates template metrics in backend database

---

## Transformation 10: Backend Execution Report Preparation

**Component Flow**: MCP arguments → Learning Loop API request

**Location**: `activity_template_tools.py:282-308`

### What Changes:
```python
# Input (MCP tool arguments)
{
  "activity_id": str,
  "result": {
    "success": bool,
    "duration": int,  # milliseconds
    "cost": float,    # USD
    "tokens": { "input": int, "output": int, "cache": int },
    "cancelled": bool,
    "errors": [str]
  }
}

# Transformation
template_id = activity_id.rsplit("-", 1)[0]  # ← Extract template ID

completed_at = datetime.now()
started_at = completed_at - timedelta(milliseconds=duration_ms)  # ← Reverse calculate

request_data = {
  "activity_id": activity_id,
  "template_id": template_id,
  "started_at": started_at.isoformat() + "Z",  # ← ISO format + UTC
  "duration_ms": duration_ms,
  "success": result.get("success", False),
  "tokens_input": result.get("tokens", {}).get("input", 0),
  "tokens_output": result.get("tokens", {}).get("output", 0),
  "tokens_cache": result.get("tokens", {}).get("cache", 0),
  "cost_usd": result.get("cost", 0.0),
  "completed_at": completed_at.isoformat() + "Z",
}

# Add error fields if failed
if not result.get("success"):
  errors = result.get("errors", [])
  request_data["error_message"] = errors[0] if errors else "Execution failed"
  request_data["error_type"] = "execution_error"

# Output
HTTP POST to /api/v1/learning-loop/executions
```

### Why This Exists:
- **Business Requirement**: Record execution in Learning Loop for template metrics
- **Timestamp Calculation**:
  - Frontend only sends duration, not start time
  - Backend reverse-calculates `started_at` for consistency
  - **Why**: Simplifies frontend, centralizes timestamp logic
- **Template ID Extraction**:
  - Activity ID format: `{template_id}-{timestamp}`
  - Extracts template ID by splitting on last `-`
  - **Assumption**: Template IDs don't contain trailing `-{digits}`

### Validations:
- Default values: `result.get("success", False)`, `tokens.get("input", 0)`, etc.
- ISO timestamp format: `.isoformat() + "Z"` for UTC

### Side Effects:
- HTTP POST to Learning Loop API
- Database write: Inserts execution record
- Metrics update: Updates template success rate, avg cost, avg duration

---

## Transformation 11: User Activity Tracking (Idle Timer Reset)

**Component Flow**: `SessionPrompt.createUserMessage()` → `BoredomManager.trackActivity()`

**Location**: `prompt.ts:1215` → `boredom-manager.ts:72-80`

### What Changes:
```typescript
// Input
sessionID: string

// Transformation
const manager = sessionManagers.get(sessionID)
if (!manager) return  // Not being monitored

const wasIdle = isIdle(manager)  // Check if was idle before update
manager.lastActivityTime = Date.now()  // ← RESET TIMER

// Output
Side effect: lastActivityTime updated to current timestamp
```

### Why This Exists:
- **Business Requirement**: Prevent boredom activities from triggering while user is actively working
- **Why Track on User Message**:
  - User sending message = clear signal of active engagement
  - Most frequent activity indicator (every user interaction)
- **Alternative Approaches**:
  - Could track on every tool call (too frequent, noisy)
  - Could track on file saves (too infrequent)
  - User message is the sweet spot

### Validations:
- Existence check: `if (!manager) return` (session not monitored)

### Side Effects:
- Updates in-memory state: `manager.lastActivityTime = Date.now()`
- Prevents boredom activity trigger on next check (30s later)

---

## Transformation 12: Session Lifecycle → Monitoring State

**Component Flow**: `Session.Event.Created` → `BoredomManager.startMonitoring()`

**Location**: `session/index.ts:259` → `boredom-manager.ts:46-67`

### What Changes:
```typescript
// Input
sessionID: string (from Session.Event.Created)

// Transformation
const manager: ManagerInstance = {
  sessionID,
  lastActivityTime: Date.now(),  // ← Initialize to now
  isExecutingBoredomActivity: false,  // ← Start inactive
}

manager.checkTimer = setInterval(() => {
  checkIdleAndExecute(manager).catch(...)
}, CHECK_INTERVAL_MS)  // 30000ms

sessionManagers.set(sessionID, manager)

// Output
ManagerInstance (in-memory, tracked in Map)
```

### Why This Exists:
- **Business Requirement**: Auto-start monitoring when session created
- **Why Immediate Timestamp**:
  - Session creation = user activity (just started session)
  - Prevents immediate boredom trigger (would be wrong)
- **Why setInterval**:
  - Periodic polling is simple, reliable
  - Alternative (event-based) would be complex (track every user action)

### Validations:
- Duplicate check: `if (sessionManagers.has(sessionID)) return`

### Side Effects:
- Creates interval timer (runs every 30s)
- Stores manager in Map (in-memory state)

---

## Transformation 13: Session Close → Cleanup

**Component Flow**: `Session.Event.Closed` → `BoredomManager.stopMonitoring()`

**Location**: `session/index.ts:401` → `boredom-manager.ts:104-130`

### What Changes:
```typescript
// Input
sessionID: string (from Session.Event.Closed)

// Transformation
const manager = sessionManagers.get(sessionID)
if (!manager) return

// Cancel any running boredom activity
if (manager.currentActivity) {
  manager.currentActivity.abortController.abort()  // ← Cancel execution
}

// Stop monitoring
if (manager.checkTimer) {
  clearInterval(manager.checkTimer)  // ← Stop timer
}

sessionManagers.delete(sessionID)  // ← Remove from tracking

// Output
Side effects: Timer stopped, activity cancelled, manager removed
```

### Why This Exists:
- **Business Requirement**: Clean up resources when session no longer needs monitoring
- **Why Cancel Activity**:
  - Session closed = user no longer needs boredom work
  - Prevent wasted execution
- **Why Clear Interval**:
  - Prevent memory leak (timer would run forever)
- **Why Delete Manager**:
  - Free memory, prevent stale state

### Validations:
- Existence checks: `if (!manager)`, `if (manager.currentActivity)`, `if (manager.checkTimer)`

### Side Effects:
- Cancels running activity: `abortController.abort()`
- Clears interval timer: `clearInterval()`
- Removes from Map: `sessionManagers.delete()`

---

## Transformation 14: Status Query (Real-Time Display)

**Component Flow**: `stats.ts:getBoredomStatus()` → `BoredomManager.getStatus()`

**Location**: `stats.ts:390` → `boredom-manager.ts:394-419`

### What Changes:
```typescript
// Input
sessionID: string

// Transformation
const manager = sessionManagers.get(sessionID)
if (!manager) return undefined

const idleTimeMs = Date.now() - manager.lastActivityTime
const isIdle = idleTimeMs >= IDLE_THRESHOLD_MS

const status: BoredomStatus = {
  isMonitoring: true,  // ← Manager exists = monitoring
  isIdle: isIdle,      // ← Calculated from idle time
  isExecutingBoredom: manager.isExecutingBoredomActivity,  // ← Runtime flag
  currentActivity: manager.currentActivity?.activityId,    // ← Optional
  idleTimeMs: idleTimeMs,  // ← For display
  availableBoredomTasks: undefined,  // ← Not tracked (could fetch from backend)
}

// Output
BoredomStatus (for UI display)
```

### Why This Exists:
- **Business Requirement**: Show real-time boredom status in `opencode stats` command
- **Why Expose idleTimeMs**:
  - User can see how long until boredom activity triggers
  - Useful for debugging
- **Why currentActivity**:
  - Shows which activity is running (for visibility)

### Validations:
- Existence check: `if (!manager) return undefined`

### Side Effects:
- None (read-only query)

---

## Key Transformation Patterns

### Pattern 1: Convention-Based Markers (No Schema Enforcement)

**Where**: Activity creation (transformation 5)

**Problem**: Detection relies on string matching rather than schema fields

**Trade-offs**:
- ✅ Simple, human-readable, backward compatible
- ❌ Not validated, can be inconsistent, requires string matching

**Enforcement Gap**: No validation that `[BOREDOM]` prefix matches `branch: "boredom-activity"`

**Recommendation**: Add optional `Activity.Info.isBoredom: boolean` field with Zod refinement:
```typescript
Activity.Info.refine(
  (data) => {
    if (data.isBoredom) {
      return data.title.startsWith('[BOREDOM]') || data.title.startsWith('[MANUAL BOREDOM]')
    }
    return true
  },
  { message: "Boredom activities must have [BOREDOM] title prefix" }
)
```

---

### Pattern 2: Metrics-Driven Priority Inversion

**Where**: Backend response transformation (transformation 4)

**Formula**: `priority = 1.0 - improvement_gradient`

**Why Invert**:
- `improvement_gradient` near 0 = needs improvement
- `priority` should be high for low-quality templates
- More intuitive for sorting/display

**Alternative**: Expose gradient directly, let frontend invert
- **Why not**: Centralizes logic, reduces frontend complexity

---

### Pattern 3: Timestamp Reverse Calculation

**Where**: Backend execution report (transformation 10)

**Formula**: `started_at = completed_at - timedelta(milliseconds=duration_ms)`

**Why**:
- Frontend only tracks duration, not start time
- Backend needs both for analytics
- Reverse calculation is accurate enough (single-threaded execution)

**Trade-off**: Assumes frontend duration is accurate (could drift if clock skew)

---

### Pattern 4: Impulse Content Cleaning (Storage Optimization)

**Where**: Activity save (transformation 7)

**What**: Removes large impulse content before persisting

**Why**:
- Impulses can be MB-sized (file contents, API responses)
- Storing full content causes storage bloat
- Keep pointers/references, lazy-load when needed

**Trade-off**: Must re-resolve impulses when loading activity (performance hit)

---

### Pattern 5: JSON Serialization for Template Variables

**Where**: Metrics → variables (transformation 8)

**What**: `JSON.stringify()` for arrays and objects

**Why**:
- Template variables must be flat key-value pairs
- Complex objects can't be passed directly
- Template prompts can parse JSON strings

**Alternative**: Support nested variables
- **Why not**: Increases template complexity, harder to validate

---

## Validation Gaps Identified

### Gap 1: No Validation of Boredom Markers

**Location**: Activity creation (transformation 5)

**Issue**: Title prefix and branch name are not validated for consistency

**Example Inconsistency**:
```typescript
// Valid boredom activity
{ title: "[BOREDOM] Fix auth", branch: "boredom-activity" }

// Invalid but accepted (title prefix missing)
{ title: "Fix auth", branch: "boredom-activity" }

// Invalid but accepted (branch name wrong)
{ title: "[BOREDOM] Fix auth", branch: "main" }
```

**Impact**: Detection logic must check both title and branch, can miss inconsistencies

**Recommendation**: Add Zod refinement or runtime validation

---

### Gap 2: Debug Code in Production (EVIDENCE_TEST Prefix)

**Location**: Activity creation (transformation 6, line 443)

**Issue**: `activity.title = "[EVIDENCE_TEST] ${activity.title}"` hardcoded

**Impact**: All activities (including boredom activities) have `[EVIDENCE_TEST]` prefix

**Example**:
```
Expected: "[BOREDOM] Improve template success rate"
Actual:   "[EVIDENCE_TEST] [BOREDOM] Improve template success rate"
```

**Recommendation**: Remove debug prefix or make conditional (env var)

---

### Gap 3: No Persistent Boredom Flag

**Location**: Activity.Info schema (transformation 6)

**Issue**: No `isBoredom: boolean` field in schema

**Impact**: Detection after execution requires string matching on title/branch

**Alternative**: Add field and set during creation:
```typescript
activity.isBoredom = options.branch === "boredom-activity" || 
                     options.title.startsWith("[BOREDOM]")
```

**Trade-off**: Schema change, backward compatibility concerns

---

### Gap 4: Template ID Extraction Assumption

**Location**: Backend execution report (transformation 10, line 273)

**Issue**: `template_id = activity_id.rsplit("-", 1)[0]` assumes format

**Problem**: If template ID contains `-`, extraction fails

**Example**:
```
activity_id: "my-template-id-1234567890"
Expected template_id: "my-template-id"
Actual template_id: "my-template-id-1234567890".rsplit("-", 1)[0] = "my-template-id"

But if template_id is "my-complex-template-name":
activity_id: "my-complex-template-name-1234567890"
Expected: "my-complex-template-name"
Actual: "my-complex-template-name" ✓ (works)

Edge case:
activity_id: "act_abc123_def456"  (actual generateID format)
Expected: "act_abc123"
Actual: "act_abc123"  ✓ (works because uses `_` separator)
```

**Recommendation**: Use more robust ID format (e.g., `{template_id}:{timestamp}`) or pass template_id explicitly

---

## Summary of Transformations

| # | Transformation | Type | Validation | Side Effects |
|---|---------------|------|-----------|--------------|
| 1 | Timer Tick → Idle Check | Trigger | None | Async call |
| 2 | Idle Status Calculation | Boolean | Threshold check | None |
| 3 | MCP Tool Call Prep | API Request | Client existence | HTTP call |
| 4 | API Response → BoredomActivity[] | DTO Transform | JSON parsing | None |
| 5 | BoredomActivity → Activity.Info | Marker Injection | None | DB write, event |
| 6 | Activity.Info Creation | Schema Init | Zod validation | DB write, event |
| 7 | Activity.Info → Storage | Content Cleaning | None | DB write, event |
| 8 | Metrics → Variables | Serialization | Default values | None |
| 9 | ExecutionResult → Report | Aggregation | Default values | HTTP call |
| 10 | Report → API Request | Timestamp Calc | ISO format | DB write |
| 11 | User Activity → Timer Reset | State Update | Existence check | In-memory update |
| 12 | Session Create → Monitoring | State Init | Duplicate check | Timer start |
| 13 | Session Close → Cleanup | Resource Release | Existence checks | Timer stop, cancel |
| 14 | Status Query | Read-Only | Existence check | None |

---

## Recommendations for Enforcement

### High Priority:
1. **Remove `[EVIDENCE_TEST]` debug prefix** (transformation 6, line 443)
2. **Add `isBoredom` boolean field** to Activity.Info schema
3. **Add Zod refinement** to validate title prefix matches `isBoredom` flag

### Medium Priority:
4. **Improve template ID extraction** (use explicit field, not rsplit)
5. **Add validation** for boredom marker consistency (title + branch)

### Low Priority:
6. **Consider tracking** `availableBoredomTasks` in status query (transformation 14)
7. **Add metrics** for boredom activity execution count in stats display
