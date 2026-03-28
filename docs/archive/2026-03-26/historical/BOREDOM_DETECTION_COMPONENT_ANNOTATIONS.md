# Boredom Activity Detection Mechanism - Component Annotations

## Overview

Key components documented for the Boredom Activity Detection Mechanism data flow. Components not yet indexed in CPG (metabob_list_file_components returned 0 results), so annotations created manually based on code analysis.

---

## Component 1: checkIdleAndExecute() - Entry Point

**File**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:156-197`

**Component Type**: Function (Entry Point)

### Purpose in Flow

`checkIdleAndExecute()` is the **primary entry point** for automatic boredom activity detection. It serves as the timer-based monitoring function that periodically checks if a session has been idle long enough to warrant autonomous improvement work.

### Data Transformation

**Input**: `ManagerInstance`
```typescript
{
  sessionID: string
  lastActivityTime: number  // Unix timestamp (ms)
  isExecutingBoredomActivity: boolean
  currentActivity?: { activityId: string, abortController: AbortController }
  intervalHandle?: NodeJS.Timeout
}
```

**Output**: `Promise<void>` (side effect: executes boredom activity if idle)

### Business Logic

**Core Rule**: Only execute boredom activities when session is genuinely idle (5+ minutes with no user interaction).

**Decision Flow**:
1. Check if already executing boredom activity → Skip (prevent concurrent execution)
2. Calculate idle time: `Date.now() - manager.lastActivityTime`
3. Compare to threshold: `idleTime >= IDLE_THRESHOLD_MS` (300000ms = 5 minutes)
4. If idle:
   - Fetch prioritized boredom activities from backend
   - Select highest priority activity
   - Execute activity
   - Report results back to backend

**Enforcement Points**:
- **Mutual Exclusion**: `isExecutingBoredomActivity` flag prevents concurrent boredom activities
- **User Priority**: Activity resets idle timer, so user work always takes precedence
- **Graceful Degradation**: Returns early if MCP client unavailable (no crash)

### Design Decisions

**Why Timer-Based Polling?**
- **Rationale**: Simple, reliable, doesn't require hooking every user action
- **Alternative Considered**: Event-driven (track every file change, command, etc.)
- **Trade-off**: 30-second polling interval vs real-time detection
  - Chosen for simplicity over precision
  - 30s delay acceptable for autonomous background work

**Why 5-Minute Idle Threshold?**
- **Too Short (1-2 min)**: Interrupts brief pauses (thinking, coffee, meetings)
- **Too Long (10+ min)**: Wastes productive idle time
- **Sweet Spot (5 min)**: User likely stepped away, but system still active

**Why Not Exponential Backoff?**
- Fixed 30-second interval chosen over adaptive polling
- **Rationale**: Background tasks should be consistent, not adaptive
- **Alternative**: Could increase interval if repeatedly idle (not implemented)

### Constraints

**Hard Constraints**:
1. **Single Activity**: Only one boredom activity per session at a time
2. **MCP Dependency**: Requires Metabob MCP client configured and running
3. **Network Dependency**: Requires Learning Loop API accessible

**Soft Constraints**:
1. **No Queueing**: Skips boredom work if already executing (doesn't queue)
2. **No Persistence**: Idle timer reset on restart (doesn't remember previous idle time)
3. **Session-Scoped**: Each session monitored independently (no cross-session coordination)

**Edge Cases**:
- **Session Created Idle**: New session immediately idle → Wait 5 min before first activity
- **Long-Running Activity**: Activity taking >30 min → Blocks new boredom activities
- **API Down**: Gracefully returns empty array, tries again in 30s

### Integration Points

**Upstream**:
- Called by: `setInterval()` every 30 seconds (started by `startMonitoring()`)
- Triggered by: Timer, not user action

**Downstream**:
- Calls: `fetchBoredomActivities()` → MCP backend
- Calls: `executeBoredomActivity()` → Activity execution

---

## Component 2: Activity.create() - Data Persistence Entry

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts:388-456`

**Component Type**: Function (Factory + Persistence)

### Purpose in Flow

`Activity.create()` is the **factory and persistence gateway** for all activities, including boredom activities. It initializes the activity data structure, injects detection markers for boredom activities, and persists immediately to storage.

### Data Transformation

**Input**: `CreateOptions`
```typescript
{
  directory: string
  branch: string           // "boredom-activity" for boredom activities
  baseCommit: string
  title: string            // "[BOREDOM] {template}" for boredom activities
  todos?: Todo[]
}
```

**Output**: `Activity.Info`
```typescript
{
  id: string                      // Generated: "act_" + timestamp + random
  directory: string
  branch: string                  // ← DETECTION MARKER #1
  title: string                   // ← DETECTION MARKER #2 (with prefix)
  status: "setup" | "running" | "completed" | "failed"
  startedAt: number
  stats: { ... }                  // Initialized to 0
  executionEvidence: { ... }      // New: correctness validation
  // ... 30+ other fields
}
```

**Critical Transformation**: Adds `[EVIDENCE_TEST]` prefix to title (line 443):
```typescript
activity.title = `[EVIDENCE_TEST] ${activity.title}`
```

### Business Logic

**Core Rule**: All activities must have unique IDs, initialized stats, and be immediately persisted to storage.

**Initialization Rules**:
1. Generate unique ID: `"act_" + Date.now() + randomBytes(4).toString("hex")`
2. Set initial status: `"setup"`
3. Initialize all stats to 0 (tokens, cost, duration)
4. Create empty collections (prompts, agentsUsed, sessionIDs, commits)
5. Initialize evidence tracking (for correctness validation)
6. Persist immediately via `Storage.write()`

**Detection Marker Injection** (for boredom activities):
- Caller sets `branch: "boredom-activity"` → Marker #1
- Caller sets `title: "[BOREDOM] ..."` → Marker #2
- No validation enforces consistency between markers

### Design Decisions

**Why Immediate Persistence?**
- **Rationale**: Activity exists from moment of creation (not just after execution)
- **Alternative**: Lazy persistence (save only when first updated)
- **Trade-off**: Simplicity vs orphaned activities on crash
  - Chosen simplicity: Persist immediately, accept orphans

**Why No `isBoredom` Field?**
- **Current Approach**: Convention-based (title prefix + branch name)
- **Alternative**: Explicit boolean field `Activity.Info.isBoredom: boolean`
- **Trade-off**: Simplicity vs validation
  - Chosen convention over schema enforcement
  - Likely reason: Avoid schema migration, maintain backward compatibility

**Why `[EVIDENCE_TEST]` Prefix?**
- **Appears to be debug code** (comment on line 442: "DEBUG: Add a marker to title to prove this code runs")
- **Should be removed** or made conditional (`if (process.env.DEBUG_EVIDENCE)`)
- **Impact**: Breaks boredom detection logic that relies on title prefix

**Why Initialize Stats to 0?**
- **Rationale**: Enables aggregation without null checks
- **Alternative**: Leave undefined until first prompt
- **Trade-off**: Memory overhead vs null safety
  - Chosen null safety: All stats initialized

### Constraints

**Hard Constraints**:
1. **ID Uniqueness**: Must generate unique IDs (timestamp + random ensures uniqueness)
2. **Storage Availability**: Must be able to write to storage (crashes if fails)
3. **Schema Compliance**: Must match `Activity.Info` Zod schema

**Soft Constraints**:
1. **No Rollback**: Once persisted, activity exists forever (no cleanup on failure)
2. **No Validation**: Title prefix and branch name not validated for consistency
3. **Synchronous Events**: Event publishing blocks save (not truly async)

**Edge Cases**:
- **Storage Full**: Create fails, throws error (no graceful degradation)
- **Concurrent Creates**: Unique ID ensures no collision (timestamp + random)
- **Debug Prefix**: `[EVIDENCE_TEST]` added to all activities (not just boredom)

### Integration Points

**Upstream**:
- Called by: `BoredomManager.executeBoredomActivity()` (boredom activities)
- Called by: User-initiated activity creation (normal activities)
- Called by: Template execution systems

**Downstream**:
- Calls: `Storage.write(["activity", activity.id], activity)` → File system
- Publishes: `Bus.publish(Event.Created, { activity })` → Event subscribers

---

## Component 3: Bus.publish() - Event Distribution Boundary

**File**: `repos/metabob-opencode/packages/opencode/src/bus/index.ts:50-68`

**Component Type**: Function (Event Bus)

### Purpose in Flow

`Bus.publish()` is the **event distribution mechanism** for activity lifecycle events. It enables loose coupling between activity creation and side effects (monitoring, logging, metrics).

### Data Transformation

**Input**: `EventDefinition` + `Properties`
```typescript
{
  type: "activity.created" | "activity.updated" | "activity.completed"
  properties: { activity: Activity.Info }
}
```

**Output**: `Promise<void>` (side effect: invokes all subscribers)

**Transformation Logic**:
1. Wraps event type and properties into payload
2. Looks up subscribers for specific event type (`"activity.created"`) AND wildcard (`"*"`)
3. Invokes all subscribers with payload
4. Returns `Promise.all(pending)` (waits for all subscribers to complete)

### Business Logic

**Core Rule**: All registered subscribers must be notified of events synchronously (not queued).

**Delivery Guarantees**:
- **At-Least-Once**: All subscribers invoked (unless error)
- **Ordered**: Subscribers invoked in registration order
- **Synchronous**: Publisher waits for all subscribers to complete

**Error Handling**:
- **Publisher Side**: Errors swallowed via `.catch(() => {})` in caller
- **Subscriber Side**: **No isolation** - one subscriber error fails `Promise.all()` → all subscribers fail

### Design Decisions

**Why Synchronous Event Bus?**
- **Rationale**: Simpler than async queue, adequate for in-process events
- **Alternative**: Async queue (Redis, RabbitMQ) for distributed systems
- **Trade-off**: Blocking vs eventual consistency
  - Chosen blocking for simplicity (not truly async)

**Why No Subscriber Isolation?**
- **Current Approach**: `Promise.all(pending)` fails if any subscriber fails
- **Alternative**: Wrap each subscriber in try-catch (recommended)
- **Trade-off**: Fail-fast vs fault tolerance
  - Chosen fail-fast (likely unintentional design)

**Why Wildcard Subscription?**
- **Rationale**: Allows global event listeners (logging, metrics)
- **Use Case**: `Bus.subscribe("*", logger)` → Log all events
- **Trade-off**: Flexibility vs performance
  - Chosen flexibility: Wildcard adds minimal overhead

**Why In-Memory Only?**
- **Current Approach**: Events not persisted (lost on restart)
- **Alternative**: Event sourcing (persist all events)
- **Trade-off**: Simplicity vs auditability
  - Chosen simplicity: Event bus is ephemeral

### Constraints

**Hard Constraints**:
1. **Single Process**: Event bus is in-memory, not distributed
2. **No Persistence**: Events lost on restart
3. **No Replay**: Can't replay events after crash

**Soft Constraints**:
1. **No Retry**: Failed event delivery not retried
2. **No Dead Letter Queue**: Failed events not queued
3. **No Priority**: All events processed in order (no prioritization)

**Edge Cases**:
- **Subscriber Throws**: `Promise.all()` fails → All subscribers fail (cascading failure)
- **Slow Subscriber**: Blocks all subscribers (no timeout)
- **No Subscribers**: `Promise.all([])` resolves immediately (no-op)

### Integration Points

**Upstream**:
- Called by: `Activity.create()` → `Bus.publish(Event.Created, { activity })`
- Called by: `Activity.save()` → `Bus.publish(Event.Updated, { activity })`
- Called by: `Activity.markCompleted()` → `Bus.publish(Event.Completed, { activity })`

**Downstream**:
- Invokes: `BoredomManager.startMonitoring()` (on `Session.Event.Created`)
- Invokes: `BoredomManager.stopMonitoring()` (on `Session.Event.Closed`)
- Invokes: Other subscribers (logging, metrics, etc.)

---

## Component 4: fetchBoredomActivities() - Backend Integration Point

**File**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:210-245`

**Component Type**: Function (MCP Client Wrapper)

### Purpose in Flow

`fetchBoredomActivities()` is the **backend integration gateway** that fetches prioritized improvement work from the Learning Loop API via MCP protocol. It transforms backend metrics into actionable `BoredomActivity` objects.

### Data Transformation

**Input**: None (implicit: requires MCP client configured)

**MCP Call**:
```typescript
metabobClient.callTool({
  name: "metabob_fetch_boredom_activities",
  arguments: {
    max_activities: 5,
    priority_threshold: 0.6,
    exclude_recent_hours: 24,
  }
})
```

**Output**: `BoredomActivity[]`
```typescript
[
  {
    activity_type: "improve-template" | "debug-failures" | "optimize-performance"
    priority: number           // 0.0-1.0 (inverted from improvement_gradient)
    template_id: string
    improvement_gradient: number
    reason: string             // Human-readable explanation
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
]
```

### Business Logic

**Core Rule**: Only fetch activities that need improvement (low improvement_gradient) and haven't been executed recently.

**Filtering Parameters**:
- `max_activities: 5` - Limit to top 5 priorities (avoid overwhelming agent)
- `priority_threshold: 0.6` - Only templates with improvement_gradient < 0.4
- `exclude_recent_hours: 24` - Don't re-execute templates run in last 24 hours

**Priority Inversion**:
- Backend returns `improvement_gradient` (0.0 = needs improvement, 1.0 = perfect)
- Inverted to `priority = 1.0 - improvement_gradient` for intuitive sorting
- Higher priority = more urgent improvement needed

**Graceful Degradation**:
- MCP client not configured → Return `[]` (no crash)
- API error → Return `[]` (logged, not thrown)
- Invalid response → Return `[]` (logged, not thrown)

### Design Decisions

**Why MCP Protocol?**
- **Rationale**: Decouples frontend (TypeScript) from backend (Python)
- **Alternative**: Direct HTTP calls, gRPC, REST API
- **Trade-off**: Protocol overhead vs language agnostic
  - Chosen MCP for standardization and tool discovery

**Why Not Cache Results?**
- **Current Approach**: Fresh fetch every 30 seconds (timer-based)
- **Alternative**: Cache for N minutes, reduce API load
- **Trade-off**: Staleness vs freshness
  - Chosen freshness: Always fetch latest priorities

**Why Limit to 5 Activities?**
- **Rationale**: Agent context window limited, focus on top priorities
- **Alternative**: Fetch all, let agent decide
- **Trade-off**: Network bandwidth vs decision quality
  - Chosen bandwidth optimization: Top 5 sufficient

**Why 24-Hour Exclusion?**
- **Rationale**: Give template time to accumulate new executions before re-analyzing
- **Alternative**: Shorter (6-12 hours) or longer (48 hours)
- **Trade-off**: Recency vs execution frequency
  - Chosen 24h: Balance between fresh data and avoiding spam

### Constraints

**Hard Constraints**:
1. **MCP Dependency**: Requires Metabob MCP server running
2. **Network Dependency**: Requires Learning Loop API accessible
3. **Response Format**: Assumes specific JSON structure (no schema validation)

**Soft Constraints**:
1. **No Retry**: Single attempt, returns `[]` on failure
2. **No Timeout Override**: Uses default MCP timeout (30s)
3. **No Pagination**: Fetches single page (max 5 activities)

**Edge Cases**:
- **API Down**: Returns `[]`, tries again in 30s (no exponential backoff)
- **Malformed Response**: JSON parse fails → Returns `[]` (should validate with Zod)
- **Empty Activities**: Returns `[]`, agent stays idle (correct behavior)

### Integration Points

**Upstream**:
- Called by: `checkIdleAndExecute()` (when session idle)

**Downstream**:
- Calls: `MCP.clients()` → MCP client registry
- Calls: `metabobClient.callTool("metabob_fetch_boredom_activities")` → Python backend
- Backend calls: Learning Loop API (`GET /api/v1/learning-loop/boredom-activities`)

---

## Component 5: executeBoredomActivity() - Main Business Logic

**File**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:250-373`

**Component Type**: Function (Orchestrator)

### Purpose in Flow

`executeBoredomActivity()` is the **core orchestrator** that transforms a prioritized `BoredomActivity` into an executed activity with detection markers injected. It handles the full lifecycle: create → execute → report.

### Data Transformation

**Input**: `(manager: ManagerInstance, boredomActivity: BoredomActivity)`

**Processing Stages**:

**Stage 1: Template Loading**
```typescript
const template = await TemplateRepository.get(boredomActivity.template_id)
// BoredomActivity.template_id → ActivityTemplate.Schema
```

**Stage 2: Variable Extraction**
```typescript
const variables = {
  success_rate: boredomActivity.metrics.success_rate,
  avg_cost: boredomActivity.metrics.avg_cost,
  // ... transform metrics → template variables
  failure_patterns: JSON.stringify(boredomActivity.metrics.failure_patterns || []),
}
// BoredomActivity.metrics → Record<string, unknown>
```

**Stage 3: Activity Creation (Marker Injection)**
```typescript
const activity = await Activity.create({
  branch: "boredom-activity",           // ← DETECTION MARKER #1
  title: `[BOREDOM] ${template.name}`,  // ← DETECTION MARKER #2
})
activity.reason = boredomActivity.reason  // ← DETECTION MARKER #3
// CreateOptions → Activity.Info (with markers)
```

**Stage 4: Execution**
```typescript
const result = await executeActivityInline(
  template.id,
  variables,
  manager.sessionID,
  `[BOREDOM] ${boredomActivity.reason}`,
  "boredom-manager",
  abortController.signal
)
// Template + Variables → ExecutionResult
```

**Stage 5: Results Reporting**
```typescript
await metabobClient.callTool({
  name: "metabob_post_activity_result",
  arguments: {
    activity_id: result.activityId,
    success: result.success,
    duration: duration,
    cost: activity.stats?.cost?.total || 0,
    tokens: { input, output, cache },
  }
})
// ExecutionResult → Backend API call (Learning Loop update)
```

### Business Logic

**Core Rule**: Execute boredom activity with proper markers, report results back to Learning Loop for continuous improvement.

**Marker Injection Strategy**:
1. **Branch Name**: `"boredom-activity"` → Isolates boredom work from user branches
2. **Title Prefix**: `"[BOREDOM] {template}"` → Human-readable, shows in UI/logs
3. **Reason Field**: `boredomActivity.reason` → Explains why this template was selected

**Detection Mechanisms**:
- **Convention-Based**: No explicit `isBoredom` field in schema
- **Validation Gap**: No enforcement that markers are consistent
- **Example Inconsistency**: Could create activity with `[BOREDOM]` title but `main` branch

**Error Handling**:
- **Try-Catch**: Errors logged but **activity left orphaned**
- **Finally Block**: `isExecutingBoredomActivity = false` always reset
- **No Cleanup**: Failed activity stays in storage with `status: "setup"`

### Design Decisions

**Why Inline Execution?**
- **Rationale**: Execute in current process, not spawned subprocess
- **Alternative**: Fork subprocess, isolate execution
- **Trade-off**: Simplicity vs isolation
  - Chosen simplicity: Inline execution shares context

**Why Report Results Asynchronously?**
- **Current Approach**: Fire-and-forget (no await)
- **Alternative**: Wait for confirmation (await)
- **Trade-off**: Non-blocking vs reliability
  - Chosen non-blocking: Don't wait for backend

**Why No Activity Cleanup on Failure?**
- **Current Approach**: Failed activities left in `"setup"` status
- **Alternative**: Update status to `"failed"`, add error message
- **Trade-off**: Simplicity vs data cleanliness
  - Chosen simplicity (likely unintentional): No cleanup

**Why JSON.stringify() for Complex Variables?**
- **Rationale**: Template variables must be flat key-value pairs
- **Alternative**: Support nested objects in templates
- **Trade-off**: Template complexity vs variable flexibility
  - Chosen simplicity: Flat variables, serialize complex data

### Constraints

**Hard Constraints**:
1. **Template Existence**: Must find template in repository (fails if missing)
2. **MCP Client**: Must have Metabob client configured (fails if missing)
3. **Storage Availability**: Must be able to save activity (fails if storage full)

**Soft Constraints**:
1. **No Concurrent Execution**: `isExecutingBoredomActivity` flag prevents concurrent activities
2. **No Queuing**: Skips execution if already running (doesn't queue pending work)
3. **No Transaction**: No rollback if execution fails (activity persisted but incomplete)

**Edge Cases**:
- **Template Not Found**: Logs warning, returns early (no crash)
- **Execution Timeout**: Handled by `executeActivityInline()` (abort signal)
- **Result Reporting Fails**: Logged but **results lost forever** (no retry queue)

### Integration Points

**Upstream**:
- Called by: `checkIdleAndExecute()` (when idle and activities available)

**Downstream**:
- Calls: `TemplateRepository.get()` → Template loading
- Calls: `Activity.create()` → Activity persistence
- Calls: `Activity.save()` → Activity update
- Calls: `executeActivityInline()` → Template execution
- Calls: `metabobClient.callTool("metabob_post_activity_result")` → Backend reporting

---

## Component 6: Storage.write() - Exit Point (Persistence)

**File**: `repos/metabob-opencode/packages/opencode/src/storage/storage.ts` (inferred implementation)

**Component Type**: Function (Storage Abstraction)

### Purpose in Flow

`Storage.write()` is the **persistence exit point** for all activity data. It provides file-based storage abstraction, ensuring activities are durably persisted to disk.

### Data Transformation

**Input**: `(key: string[], value: unknown)`
```typescript
key: ["activity", "act_1234567890"]
value: Activity.Info (cleaned of large impulse content)
```

**Output**: `Promise<void>` (side effect: writes JSON file to disk)

**File Path Construction**:
```typescript
const filePath = path.join(storageDir, ...key) + ".json"
// ["activity", "act_1234567890"] → "~/.local/share/opencode/storage/activity/act_1234567890.json"
```

**Serialization**:
```typescript
await fs.writeFile(filePath, JSON.stringify(value, null, 2))
// Activity.Info → JSON string (pretty-printed)
```

### Business Logic

**Core Rule**: All activities must be durably persisted to file system as JSON.

**Storage Layout**:
```
~/.local/share/opencode/storage/
  activity/
    {activity_id}.json        ← Activity.Info
  session/
    {project_id}/
      {session_id}.json       ← Session.Info
  message/
    {session_id}/
      {message_id}.json       ← Message
```

**Atomicity**:
- Uses `fs.writeFile()` → Atomic on most file systems (single system call)
- No explicit transaction (relies on file system atomicity)

**Cleaning Before Storage** (caller responsibility):
- `cleanImpulsesForStorage(activity)` removes large content
- Keeps only impulse metadata (not full content)
- Prevents storage bloat (impulses can be MB-sized)

### Design Decisions

**Why File-Based Storage?**
- **Rationale**: Simple, no database setup, easy to inspect/debug
- **Alternative**: SQLite, PostgreSQL, SurrealDB
- **Trade-off**: Simplicity vs query capabilities
  - Chosen simplicity: File system adequate for single-user tool

**Why JSON Format?**
- **Rationale**: Human-readable, version control friendly, widely supported
- **Alternative**: Binary format (Protobuf, MessagePack) for performance
- **Trade-off**: Readability vs storage efficiency
  - Chosen readability: JSON is standard

**Why No Write-Ahead Log?**
- **Current Approach**: Direct file writes, no WAL
- **Alternative**: WAL for crash recovery (like SQLite)
- **Trade-off**: Simplicity vs durability
  - Chosen simplicity: Crash = potential data loss accepted

**Why No Distributed Storage?**
- **Current Approach**: Local file system only
- **Alternative**: Cloud storage (S3, GCS), distributed file systems
- **Trade-off**: Simplicity vs multi-machine support
  - Chosen simplicity: Single-user tool, local storage sufficient

### Constraints

**Hard Constraints**:
1. **File System Availability**: Requires writable file system
2. **Disk Space**: Requires sufficient disk space (crashes if full)
3. **Permissions**: Requires write permissions to storage directory

**Soft Constraints**:
1. **No Distributed Support**: Can't run multiple OpenCode instances (file locking only works locally)
2. **No Replication**: Single point of failure (file corruption = data loss)
3. **No Backup**: No automatic backups (user must manually backup)

**Edge Cases**:
- **Disk Full**: `fs.writeFile()` throws `ENOSPC` → Crashes (no graceful degradation)
- **Concurrent Writes**: Last write wins (no optimistic locking)
- **File Corruption**: No checksums, no validation on read (corrupted file = parse error)

### Integration Points

**Upstream**:
- Called by: `Activity.save()` → Persists activity updates
- Called by: `Activity.create()` → Persists new activities
- Called by: `Session.save()`, `Message.save()`, etc. (all data persisted via Storage)

**Downstream**:
- Calls: `fs.mkdir()` → Create directory if doesn't exist
- Calls: `fs.writeFile()` → Write JSON to disk

---

## Summary of Annotations

### Components Documented: 6

1. **checkIdleAndExecute()** - Entry point (timer-based idle detection)
2. **Activity.create()** - Data persistence entry (factory + storage)
3. **Bus.publish()** - Event distribution boundary (pub/sub)
4. **fetchBoredomActivities()** - Backend integration point (MCP gateway)
5. **executeBoredomActivity()** - Main business logic (orchestrator)
6. **Storage.write()** - Exit point (file system persistence)

### Key Insights Documented

**Detection Mechanisms**:
- Convention-based markers (title prefix, branch name, reason field)
- No schema enforcement (`isBoredom` field missing)
- Debug code breaks detection (`[EVIDENCE_TEST]` prefix)

**Data Flow Transformations**:
- Priority inversion: `priority = 1.0 - improvement_gradient`
- Metrics → variables: JSON serialization for complex objects
- Activity → storage: Impulse content cleaning for optimization

**Design Decisions**:
- Timer-based polling over event-driven (simplicity)
- Immediate persistence over lazy (simplicity)
- Convention over schema enforcement (backward compatibility)
- File-based storage over database (simplicity)

**Critical Gaps**:
- No error isolation in event bus (cascading failures)
- No activity cleanup on failure (orphaned activities)
- No schema validation for MCP responses (fragile integration)
- No optimistic locking (concurrent write corruption)

### Business Context Documented

**Why Boredom Detection Exists**:
- Autonomous improvement during idle time
- Continuous learning loop (execute → measure → improve)
- Maximize productive use of idle sessions

**Why 5-Minute Threshold**:
- Balance between interrupting user vs wasting idle time
- Sweet spot for detecting genuine absence vs brief pause

**Why Inline Execution**:
- Share context with main process (impulses, session state)
- Simpler than subprocess spawning

**Why Report Results**:
- Feed learning loop (update template metrics)
- Enable continuous improvement (success rate, cost, duration)

### Constraints Documented

**Hard Constraints** (cannot violate):
- Single boredom activity per session (mutual exclusion)
- MCP client must be configured (no backend = no boredom)
- File system must be writable (no storage = crash)

**Soft Constraints** (design choices):
- No queueing (skips work if busy)
- No retry (single attempt for API calls)
- No distributed support (local file system only)

**Edge Cases** (documented for each component):
- API down, disk full, concurrent writes, malformed responses, etc.

---

## Recommendations for Future Annotations

When CPG indexing is available, annotate these additional components:

### High Priority

1. **executeActivityInline()** (`tool/activity.ts`)
   - Template execution orchestration
   - Variable validation
   - Impulse creation

2. **TemplateExecutor.execute()** (`template-executor.ts`)
   - Task-by-task execution
   - Validation logic
   - Metrics aggregation

3. **metabob_fetch_boredom_activities** (`activity_template_tools.py`)
   - Backend query logic
   - Filtering algorithm
   - Priority calculation

### Medium Priority

4. **BoredomManager.startMonitoring()** (`boredom-manager.ts`)
   - Timer initialization
   - Session lifecycle integration

5. **Activity.save()** (`activity.ts`)
   - Update logic
   - Event publishing
   - Impulse cleaning

6. **metabob_post_activity_result** (`activity_template_tools.py`)
   - Result reporting
   - Metrics update
   - Timestamp calculation

---

## Usage Notes

These annotations provide:
- **WHY each component exists** (business context)
- **WHAT transformations occur** (data flow)
- **HOW decisions were made** (design rationale)
- **WHAT constraints exist** (limitations and edge cases)

They do NOT duplicate code (code already shows WHAT), but explain WHY (design decisions, business rules, trade-offs).

Use these annotations to:
1. Understand the system architecture
2. Debug issues (know where to look)
3. Make changes safely (understand constraints)
4. Train new developers (business context)

---

## Files Not Yet Indexed in CPG

The following files need to be indexed before `metabob_annotate_component` can be used:

1. `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`
2. `repos/metabob-opencode/packages/opencode/src/session/activity.ts`
3. `repos/metabob-opencode/packages/opencode/src/bus/index.ts`
4. `repos/metabob-opencode/packages/opencode/src/session/prompt.ts`
5. `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
6. `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**Solution**: Trigger CPG file watcher or manually update files to trigger re-indexing.
