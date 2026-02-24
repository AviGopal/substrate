# BoredomManager Architectural Boundaries Analysis

**Feature:** BoredomManager idle detection and auto-execution system  
**Purpose:** Document all architectural boundaries, contracts, coupling, and resilience patterns  
**Date:** 2026-02-21

---

## Boundary 1: Event Bus Boundary (Session → BoredomManager)

**Type:** Internal Event Bus  
**Location:** `Session.Event.Created` | `BoredomManager.startMonitoring()`

**Contract:**
```typescript
// Bus event definition
Session.Event.Created = Bus.event(
  "session.created",
  z.object({
    info: Session.Info  // Zod schema validation
  })
)

// Session.Info schema (partial)
{
  id: Identifier.schema("session"),  // string with "session_" prefix
  projectID: string,
  directory: string,
  branch: string,
  status: "active" | "archived" | ...
  createdAt: number,
  updatedAt: number
}

// BoredomManager subscription (NEW)
Bus.subscribe(Session.Event.Created, async (event) => {
  const { sessionID } = event.properties.info
  BoredomManager.startMonitoring(sessionID)
})
```

**Coupling:** **Loose**
- Event-driven architecture (publisher/subscriber decoupling)
- BoredomManager doesn't exist in `Session` code (no import)
- Session doesn't know who subscribes to events
- Zod schema provides runtime validation
- Breaking change detection via Zod parse errors

**Versioning:**
- Schema changes validated at runtime (Zod)
- No version field in event payload (implicit v1)
- Future: Add `version` field if event structure changes

**Resilience:**
```typescript
// Bus.publish() error handling
export async function publish<Definition extends EventDefinition>(
  def: Definition,
  properties: z.output<Definition["properties"]>,
) {
  const pending = []
  for (const key of [def.type, "*"]) {
    const match = state().subscriptions.get(key)
    for (const sub of match ?? []) {
      pending.push(sub(payload))  // Fire-and-forget
    }
  }
  return Promise.all(pending)  // Wait for all subscribers
}

// ❌ ISSUE: If BoredomManager.startMonitoring() throws, session creation continues
// ✅ SOLUTION: Wrap subscription in try-catch:
Bus.subscribe(Session.Event.Created, async (event) => {
  try {
    await BoredomManager.startMonitoring(event.properties.info.id)
  } catch (error) {
    log.error("Failed to start boredom monitoring", { 
      sessionID: event.properties.info.id, 
      error 
    })
    // Don't throw - session creation should succeed even if monitoring fails
  }
})
```

**Error Handling:** **Fire-and-forget with logging**
- Subscriber errors don't block session creation
- Log errors for debugging
- System degrades gracefully (session works, just no boredom detection)

---

## Boundary 2: Service Boundary (BoredomManager → MCP Backend)

**Type:** Remote Service (HTTP/MCP Protocol)  
**Location:** `BoredomManager.fetchBoredomActivities()` | Metabob Backend MCP Server

**Contract:**
```typescript
// MCP Tool Call
const mcpClient = await MCP.getClient("metabob")
const result = await mcpClient.callTool(
  {
    name: "metabob_fetch_boredom_activities",
    arguments: {
      max_activities: 5,          // number
      priority_threshold: 0.5,    // number (0.0-1.0)
      exclude_recent_hours: 24    // number
    }
  },
  CallToolResultSchema,           // Zod schema from MCP SDK
  {
    resetTimeoutOnProgress: true,
    timeout: 30_000               // 30 seconds
  }
)

// Response schema
{
  content: [
    {
      type: "text",
      text: JSON.stringify({
        activities: [
          {
            activity_type: "improve-template" | "debug-failures" | "optimize-performance",
            priority: number,              // 0.0-1.5
            template_id: string,
            improvement_gradient: number,  // 0.0-1.0
            reason: string,
            estimated_effort: string,
            metrics: {
              success_rate: number,
              avg_cost: number,
              avg_duration_ms: number,
              execution_count: number,
              failure_patterns: [...],
              performance_trends: {...},
              last_execution: {...}
            }
          }
        ]
      })
    }
  ]
}
```

**Coupling:** **Loose**
- Network boundary (HTTP)
- MCP protocol abstraction (no direct HTTP calls)
- Backend can be updated independently (as long as schema matches)
- Frontend doesn't know backend implementation details

**Versioning:**
- MCP tool names are versioned implicitly (e.g., could add `metabob_fetch_boredom_activities_v2`)
- No version field in request/response (v1 assumed)
- Schema changes would break compatibility (need careful planning)

**Resilience:**
```typescript
// Network error handling
async function fetchBoredomActivities(sessionID: string): Promise<BoredomActivity[]> {
  try {
    const mcpClient = await MCP.getClient("metabob")
    if (!mcpClient) {
      log.warn("Metabob MCP client not configured", { sessionID })
      return []  // Graceful degradation
    }

    const result = await mcpClient.callTool(
      { name: "metabob_fetch_boredom_activities", arguments: {...} },
      CallToolResultSchema,
      { timeout: 30_000 }
    )

    // Parse JSON response
    const activities = JSON.parse(result.content[0].text).activities
    return activities

  } catch (error) {
    if (error.name === "TimeoutError") {
      log.error("Boredom activity fetch timed out", { sessionID })
      return []  // Don't retry, just skip this idle cycle
    }
    if (error.name === "NetworkError") {
      log.error("Boredom activity fetch network error", { sessionID, error })
      return []  // Backend might be down, skip gracefully
    }
    log.error("Boredom activity fetch failed", { sessionID, error })
    return []  // Unknown error, skip gracefully
  }
}
```

**Error Handling:** **Graceful degradation**
- Timeouts → Return empty array (no boredom activities)
- Network errors → Return empty array (backend unavailable)
- Parse errors → Return empty array (malformed response)
- Never crash frontend due to backend issues

**Retry Strategy:** **No retries**
- Idle check runs every 1 minute
- Next idle cycle will try again
- No need for aggressive retries

---

## Boundary 3: Data Store Boundary (Session → Storage Layer)

**Type:** File System Storage  
**Location:** `Session.touch()` | `Storage.write()`

**Contract:**
```typescript
// Session touch (update timestamp)
export const touch = fn(Identifier.schema("session"), async (sessionID) => {
  await update(sessionID, (draft) => {
    draft.time.updated = Date.now()
  })
})

// Storage.write() implementation
export async function write<T>(key: string[], content: T) {
  const dir = await state().then((x) => x.dir)
  const target = path.join(dir, ...key) + ".json"
  return withErrorHandling(async () => {
    using _ = await Lock.write("storage")  // Write lock
    await Bun.write(target, JSON.stringify(content, null, 2))
  })
}

// File path structure
~/.local/share/opencode/storage/session/{projectID}/{sessionID}.json
```

**Coupling:** **Medium**
- Direct file system dependency
- JSON serialization format (could change)
- File path structure encoded in implementation
- Write lock prevents concurrent modifications

**Versioning:**
- No explicit version field in stored JSON
- Schema changes must maintain backward compatibility
- Migration system exists (see `Storage.MIGRATIONS`)

**Resilience:**
```typescript
// Error handling in Storage
async function withErrorHandling<T>(body: () => Promise<T>) {
  return body().catch((e) => {
    if (!(e instanceof Error)) throw e
    const errnoException = e as NodeJS.ErrnoException
    if (errnoException.code === "ENOENT") {
      throw new NotFoundError({ message: `Resource not found: ${errnoException.path}` })
    }
    throw e  // Re-throw other errors
  })
}

// Lock system prevents concurrent writes
import { Lock } from "../util/lock"
using _ = await Lock.write("storage")  // Blocks if another write is in progress

// BoredomManager should handle storage errors
async function trackActivity(sessionID: string): Promise<void> {
  const manager = sessionManagers.get(sessionID)
  if (!manager) return

  manager.lastActivityTime = Date.now()

  // Touch session (may fail if session deleted)
  try {
    await Session.touch(sessionID)
  } catch (error) {
    if (error instanceof Storage.NotFoundError) {
      log.warn("Session deleted, stopping monitoring", { sessionID })
      stopMonitoring(sessionID)  // Cleanup
      return
    }
    log.error("Failed to touch session", { sessionID, error })
    // Don't throw - activity tracking continues even if storage fails
  }
}
```

**Error Handling:** **Continue with logging**
- File not found → Session deleted, cleanup monitoring
- Other errors → Log and continue (don't crash)
- Write lock prevents data corruption

**Concurrency Control:** **Write locks**
- `Lock.write("storage")` ensures sequential writes
- No risk of corrupted JSON files
- May block if many concurrent writes (acceptable)

---

## Boundary 4: Data Store Boundary (Activity → Storage Layer)

**Type:** File System Storage  
**Location:** `Activity.save()` | `Storage.write()`

**Contract:**
```typescript
// Activity.save()
export async function save(activity: Info): Promise<void> {
  // Clear heavy content from unloaded impulses before saving
  const toSave = clearUnloadedImpulseContent(activity)
  await Storage.write(["activity", activity.id], toSave)
  Bus.publish(Event.Updated, { activity }).catch(() => {})
}

// File path structure
~/.local/share/opencode/storage/activity/{activityID}.json

// Activity.Info size: 2-10 KB (depends on impulse count)
```

**Coupling:** **Medium**
- Same as Session storage (file system, JSON)
- Impulse content cleared to reduce file size
- No foreign key constraints (activity.sessionIDs not validated)

**Versioning:**
- Activity.Info schema evolves over time
- Recent additions: `executionEvidence`, `workArtifacts`, `correctnessVerdict`
- Old activities may lack these fields (handled via optional fields)

**Resilience:**
```typescript
// BoredomManager should handle activity save errors
async function executeBoredomActivity(
  sessionID: string, 
  activity: BoredomActivity
): Promise<void> {
  try {
    const result = await executeActivityInline(...)
    
    // Save activity result
    await Activity.save(activityInfo)
    
  } catch (error) {
    log.error("Boredom activity execution failed", { sessionID, error })
    
    // Try to save failed state
    try {
      activityInfo.status = "failed"
      activityInfo.error = error.message
      await Activity.save(activityInfo)
    } catch (saveError) {
      log.error("Failed to save failed activity state", { activityInfo.id, saveError })
      // Continue - don't let storage errors prevent cleanup
    }
    
    // Report failure to backend
    await reportActivityResult(activityInfo.id, { success: false, error: error.message })
  } finally {
    // Always cleanup current activity reference
    manager.currentActivity = undefined
  }
}
```

**Error Handling:** **Try to save, continue if fails**
- Save errors logged but don't prevent cleanup
- Activity state may be lost (acceptable for boredom activities)
- Backend metrics updated separately (redundant data source)

---

## Boundary 5: Layer Boundary (BoredomManager → Activity Execution)

**Type:** Internal Layer Boundary (Business Logic → Execution Engine)  
**Location:** `BoredomManager.executeBoredomActivity()` | `executeActivityInline()`

**Contract:**
```typescript
// executeActivityInline() signature (with proposed AbortSignal)
export async function executeActivityInline(
  templateId: string,
  variables: Record<string, unknown>,
  parentSessionID: string,
  reason: string,
  parentMessageID: string,
  abortSignal?: AbortSignal  // NEW PARAMETER
): Promise<{
  impulses: Record<string, ActivityTemplate.Impulse.Schema>
  success: boolean
  activityId: string
  cancelled?: boolean  // NEW FIELD
}>

// Call from BoredomManager
const abortController = new AbortController()
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
  abortController.signal
)

manager.currentActivity.activityId = result.activityId
```

**Coupling:** **Tight**
- Direct function call (same process, same repo)
- Shared type definitions (`ActivityTemplate.Schema`, `Activity.Info`)
- No versioning boundary (both updated together)
- Breaking changes require updating both sides

**Versioning:**
- TypeScript compiler catches incompatible changes
- No runtime version checks needed
- Both compiled together (no separate deployment)

**Resilience:**
```typescript
// Error propagation from executeActivityInline()
async function executeBoredomActivity(
  sessionID: string,
  activity: BoredomActivity
): Promise<void> {
  const manager = sessionManagers.get(sessionID)
  if (!manager) return

  const abortController = new AbortController()
  manager.currentActivity = {
    activityId: "pending",
    abortController
  }

  try {
    const result = await executeActivityInline(
      activity.template_id,
      extractVariables(activity.metrics),
      sessionID,
      activity.reason,
      "boredom-system",
      abortController.signal
    )

    manager.currentActivity.activityId = result.activityId

    if (result.cancelled) {
      log.info("boredom activity cancelled by user", { sessionID, activityId: result.activityId })
      await reportActivityResult(result.activityId, { 
        success: false, 
        error: "Cancelled by user" 
      })
      return
    }

    if (result.success) {
      log.info("boredom activity completed successfully", { sessionID, activityId: result.activityId })
    } else {
      log.warn("boredom activity failed", { sessionID, activityId: result.activityId })
    }

    // Report result to backend
    const activityInfo = await Activity.load(result.activityId)
    await reportActivityResult(result.activityId, {
      success: result.success,
      duration: activityInfo.stats.duration,
      cost: activityInfo.stats.cost.total,
      tokens: {
        input: activityInfo.stats.tokens.input,
        output: activityInfo.stats.tokens.output,
        cache: activityInfo.stats.tokens.cache.read
      }
    })

  } catch (error) {
    if (error.name === "AbortError") {
      log.info("boredom activity aborted", { sessionID })
      return  // User cancelled, don't report as failure
    }

    log.error("boredom activity execution error", { sessionID, error })
    
    // Report error to backend
    if (manager.currentActivity?.activityId !== "pending") {
      await reportActivityResult(manager.currentActivity.activityId, {
        success: false,
        error: error.message
      })
    }

  } finally {
    // Always cleanup
    manager.currentActivity = undefined
  }
}
```

**Error Handling:** **Propagate with cleanup**
- AbortError → Expected cancellation, don't report as failure
- Other errors → Log and report to backend
- Always cleanup `currentActivity` (finally block)

---

## Boundary 6: Layer Boundary (Activity Execution → Template Executor)

**Type:** Internal Layer Boundary (Orchestration → Task Execution)  
**Location:** `executeActivityInline()` | `TemplateExecutor.executeTemplate()`

**Contract:**
```typescript
// executeTemplate() signature (from template-executor.ts)
export async function executeTemplate(
  template: ActivityTemplate.Schema,
  activity: Activity.Info,
  variables: Record<string, unknown>,
  sessionID: string,
  abortSignal: AbortSignal,
  model: Provider.Model,
  options: {
    onStatusUpdate: (status: TaskStatus) => void
    parentSessionID: string
  }
): Promise<{
  success: boolean
  tasks: Array<TaskExecution>
  totalDuration: number
  totalCost: number
  totalTokens: { input: number; output: number; cache: number }
}>

// Call from executeActivityInline()
const result = await executeTemplate(
  template,
  activity,
  variables,
  parentSessionID,
  abortController.signal,
  parentModel,
  {
    onStatusUpdate: () => {},  // No UI updates for boredom activities
    parentSessionID: parentSessionID
  }
)
```

**Coupling:** **Tight**
- Direct function call (same repo)
- Shared complex types (`ActivityTemplate.Schema`, `Activity.Info`)
- No serialization boundary (pass by reference)

**Versioning:**
- TypeScript ensures type safety
- Breaking changes caught at compile time

**Resilience:**
```typescript
// TemplateExecutor abort signal checks
export async function executeTemplate(
  template: ActivityTemplate.Schema,
  activity: Activity.Info,
  variables: Record<string, unknown>,
  sessionID: string,
  abortSignal: AbortSignal,
  model: Provider.Model,
  options: ExecutionOptions
): Promise<ExecutionResult> {
  const tasks = buildTaskGraph(template.tasks)
  const results: TaskExecution[] = []

  for (const task of tasks) {
    // CHECK ABORT SIGNAL BEFORE EACH TASK
    if (abortSignal.aborted) {
      log.info("template execution aborted", { 
        activityId: activity.id, 
        completedTasks: results.length,
        totalTasks: tasks.length
      })
      
      // Mark remaining tasks as pending
      for (const remainingTask of tasks.slice(results.length)) {
        results.push({
          taskId: remainingTask.id,
          status: "pending",
          attempts: 0,
          duration: 0,
          tokens: { input: 0, output: 0, cache: 0 },
          cost: 0
        })
      }
      
      // Return partial results
      return {
        success: false,
        tasks: results,
        totalDuration: results.reduce((sum, t) => sum + t.duration, 0),
        totalCost: results.reduce((sum, t) => sum + t.cost, 0),
        totalTokens: aggregateTokens(results)
      }
    }

    // Execute task
    const taskResult = await executeTask(task, variables, sessionID, model, abortSignal)
    results.push(taskResult)
    
    if (!taskResult.success && task.retry.maxAttempts <= taskResult.attempts) {
      log.warn("task failed, stopping execution", { 
        taskId: task.id, 
        attempts: taskResult.attempts 
      })
      break  // Stop on failed task
    }
  }

  return {
    success: results.every(t => t.status === "completed"),
    tasks: results,
    totalDuration: results.reduce((sum, t) => sum + t.duration, 0),
    totalCost: results.reduce((sum, t) => sum + t.cost, 0),
    totalTokens: aggregateTokens(results)
  }
}
```

**Error Handling:** **Graceful partial execution**
- Abort signal checked before each task
- Partial results returned on abort
- Task failures stop execution (unless retries available)

---

## Boundary 7: Repository Boundary (TemplateRepository → Local Storage)

**Type:** Data Access Layer  
**Location:** `TemplateRepository.get()` | `Storage.read()`

**Contract:**
```typescript
// TemplateRepository.get()
export async function get(
  id: string,
  backend: Backend = "all"
): Promise<ActivityTemplate.Schema | undefined> {
  const mappedBackend = mapBackend(backend)
  
  // Delegate to TemplateLoader (handles cache + metabob + local fallback)
  const result = await TemplateLoader.get(id, mappedBackend)
  
  return result.template  // undefined if not found
}

// TemplateLoader.get() fallback chain
1. Check TemplateCache (in-memory, 5-minute TTL)
2. If miss: Try Metabob TemplateService (HTTP)
3. If fail: Try local storage (bootstrap templates only)
4. Return undefined if all fail

// Local storage path
~/.local/share/opencode/storage/activity-template/{templateID}.json
```

**Coupling:** **Medium**
- Repository pattern (abstraction over storage)
- Multiple backends (cache, remote, local)
- Graceful degradation (fallback chain)

**Versioning:**
- Template schema versioned via `version.generation` field
- Migration system handles old template versions
- Schema changes require migration code

**Resilience:**
```typescript
// TemplateLoader error handling
export async function get(
  id: string,
  backend: "metabob" | "local" | "auto"
): Promise<{ template?: ActivityTemplate.Schema; source: string }> {
  // 1. Check cache
  const cached = TemplateCache.get(id)
  if (cached) {
    return { template: cached, source: "cache" }
  }

  // 2. Try Metabob (if backend allows)
  if (backend === "metabob" || backend === "auto") {
    try {
      const mcpClient = await MCP.getClient("metabob")
      if (mcpClient) {
        const result = await mcpClient.callTool({
          name: "metabob_get_activity_template",
          arguments: { id }
        })
        const template = JSON.parse(result.content[0].text).template
        
        // Cache for 5 minutes
        TemplateCache.set(id, template)
        
        return { template, source: "metabob" }
      }
    } catch (error) {
      log.warn("Failed to get template from Metabob", { id, error })
      // Continue to local fallback
    }
  }

  // 3. Try local storage (if backend allows)
  if (backend === "local" || backend === "auto") {
    try {
      const template = await Storage.read<ActivityTemplate.Schema>([
        "activity-template",
        id
      ])
      
      // Cache for 5 minutes
      TemplateCache.set(id, template)
      
      return { template, source: "local" }
    } catch (error) {
      if (error instanceof Storage.NotFoundError) {
        log.debug("Template not found in local storage", { id })
      } else {
        log.error("Failed to read template from local storage", { id, error })
      }
    }
  }

  // 4. Not found
  return { template: undefined, source: "none" }
}
```

**Error Handling:** **Fallback chain with caching**
- Cache hit → Return immediately (fast path)
- Metabob fail → Try local storage
- Local fail → Return undefined
- Caching reduces network calls

**Cache Invalidation:** **Time-based (5 minutes)**
- No explicit invalidation needed
- Template updates visible within 5 minutes
- Acceptable staleness for boredom activities

---

## Boundary 8: Service Boundary (BoredomManager → Backend Metrics Reporting)

**Type:** Remote Service (HTTP/MCP Protocol)  
**Location:** `BoredomManager.reportActivityResult()` | Metabob Backend MCP Server

**Contract:**
```typescript
// MCP Tool Call
const mcpClient = await MCP.getClient("metabob")
await mcpClient.callTool(
  {
    name: "metabob_post_activity_result",
    arguments: {
      activityId: string,
      result: {
        success: boolean,
        duration: number,    // milliseconds
        cost: number,        // USD
        tokens: {
          input: number,
          output: number,
          cache: number
        },
        errors?: string[]
      }
    }
  },
  CallToolResultSchema,
  { timeout: 30_000 }
)

// Response schema
{
  content: [
    {
      type: "text",
      text: JSON.stringify({
        success: boolean,
        metrics_updated: boolean,
        improvement_gradient: number,  // Updated value
        next_priority: number          // Recalculated priority
      })
    }
  ]
}
```

**Coupling:** **Loose**
- Network boundary (HTTP)
- Fire-and-forget semantics (don't wait for response)
- Backend can be unavailable without breaking frontend

**Versioning:**
- MCP tool name versioning (could add `_v2` suffix)
- Response schema changes would break compatibility

**Resilience:**
```typescript
// Metrics reporting with retry
async function reportActivityResult(
  activityId: string,
  result: {
    success: boolean
    duration?: number
    cost?: number
    tokens?: { input: number; output: number; cache: number }
    error?: string
  }
): Promise<void> {
  const maxRetries = 3
  const retryDelay = 1000  // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const mcpClient = await MCP.getClient("metabob")
      if (!mcpClient) {
        log.warn("Metabob MCP client not configured, skipping metrics report", { activityId })
        return  // No backend, skip gracefully
      }

      await mcpClient.callTool(
        {
          name: "metabob_post_activity_result",
          arguments: { activityId, result }
        },
        CallToolResultSchema,
        { timeout: 30_000 }
      )

      log.info("activity result reported to backend", { activityId, attempt })
      return  // Success

    } catch (error) {
      if (error.name === "TimeoutError") {
        log.warn("activity result report timed out", { activityId, attempt })
      } else if (error.name === "NetworkError") {
        log.warn("activity result report network error", { activityId, attempt })
      } else {
        log.error("activity result report failed", { activityId, attempt, error })
      }

      // Retry if not last attempt
      if (attempt < maxRetries) {
        log.info("retrying activity result report", { activityId, attempt, delay: retryDelay })
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
      } else {
        log.error("activity result report failed after max retries", { activityId, maxRetries })
        // Don't throw - metrics reporting failure is non-critical
      }
    }
  }
}
```

**Error Handling:** **Retry with exponential backoff**
- 3 retries with 1s, 2s, 3s delays
- Timeout/network errors → Retry
- Other errors → Retry anyway (may be transient)
- Final failure → Log and continue (non-critical)

**Why Retry for Metrics:** Metrics are valuable for learning, but not critical for execution

---

## Boundary 9: Concurrency Boundary (Idle Timer → Activity Execution)

**Type:** Async/Concurrency Control  
**Location:** `BoredomManager.checkIdleAndExecute()` | `executeBoredomActivity()`

**Contract:**
```typescript
// Timer setup
const manager: ManagerInstance = {
  sessionID: string,
  lastActivityTime: number,
  boredomTimer: NodeJS.Timeout,
  currentActivity?: {
    activityId: string,
    abortController: AbortController
  },
  isIdle: boolean
}

// Timer callback
manager.boredomTimer = setInterval(() => {
  checkIdleAndExecute(sessionID)
}, 60_000)  // Every 1 minute
```

**Coupling:** **Tight**
- Same process, shared memory
- No serialization needed
- Direct function calls

**Concurrency Issues:**
1. **Multiple timers for same session** → Store timer in ManagerInstance, clear on cleanup
2. **Idle check while activity executing** → Check `isIdle` flag before starting new activity
3. **User returns while fetching activities** → Check `isIdle` again before execution
4. **Concurrent activity execution** → Only one activity per session at a time

**Resilience:**
```typescript
// Prevent concurrent activity execution
async function checkIdleAndExecute(sessionID: string): Promise<void> {
  const manager = sessionManagers.get(sessionID)
  if (!manager) return

  const idleTime = Date.now() - manager.lastActivityTime

  // GUARD 1: Check if idle threshold reached
  if (idleTime < IDLE_THRESHOLD_MS) {
    return  // Not idle yet
  }

  // GUARD 2: Check if already idle (activity executing or queued)
  if (manager.isIdle) {
    return  // Already handling idle state
  }

  // GUARD 3: Set idle flag BEFORE async operations
  manager.isIdle = true

  try {
    log.info("session idle, fetching boredom activities", { sessionID, idleTime })

    // Fetch activities (async, may take 1-30 seconds)
    const activities = await fetchBoredomActivities(sessionID)

    // GUARD 4: Check if user returned while fetching
    if (!manager.isIdle) {
      log.info("user returned while fetching activities, skipping execution", { sessionID })
      return
    }

    if (activities.length === 0) {
      log.info("no boredom activities available", { sessionID })
      manager.isIdle = false  // Reset idle flag
      return
    }

    // GUARD 5: Check if already executing activity
    if (manager.currentActivity) {
      log.warn("activity already executing, skipping", { sessionID })
      return
    }

    // Sort and execute highest priority
    const sorted = activities.sort((a, b) => b.priority - a.priority)
    const topActivity = sorted[0]

    await executeBoredomActivity(sessionID, topActivity)

  } catch (error) {
    log.error("idle check failed", { sessionID, error })
  } finally {
    // Reset idle flag if no activity running
    if (!manager.currentActivity) {
      manager.isIdle = false
    }
  }
}
```

**Concurrency Control:** **Flags and guards**
- `isIdle` flag prevents duplicate idle handling
- `currentActivity` field prevents concurrent execution
- Guards at multiple points prevent race conditions

---

## Boundary 10: Process Boundary (Node.js Runtime → File System)

**Type:** System Boundary (I/O)  
**Location:** `Storage.write()` | File System

**Contract:**
```typescript
// File system operations
await Bun.write(filePath, JSON.stringify(content, null, 2))

// File paths
~/.local/share/opencode/storage/
  ├── session/
  │   └── {projectID}/
  │       └── {sessionID}.json
  ├── activity/
  │   └── {activityID}.json
  └── activity-template/
      └── {templateID}.json
```

**Coupling:** **Tight**
- Direct file system dependency (not portable to browser)
- JSON format hardcoded
- File paths hardcoded

**Resilience:**
```typescript
// Disk full error handling
export async function write<T>(key: string[], content: T) {
  const target = path.join(dir, ...key) + ".json"
  
  try {
    using _ = await Lock.write("storage")
    await Bun.write(target, JSON.stringify(content, null, 2))
    
  } catch (error) {
    if (error.code === "ENOSPC") {
      log.error("Disk full, cannot write", { key, target })
      throw new DiskFullError({ path: target })
    }
    if (error.code === "EACCES") {
      log.error("Permission denied", { key, target })
      throw new PermissionError({ path: target })
    }
    throw error
  }
}

// BoredomManager should handle disk full
async function executeBoredomActivity(...): Promise<void> {
  try {
    const result = await executeActivityInline(...)
    await Activity.save(activity)  // May throw DiskFullError
    
  } catch (error) {
    if (error instanceof DiskFullError) {
      log.error("Cannot save activity, disk full", { activityId: activity.id })
      // Stop boredom activities if disk full
      stopMonitoring(sessionID)
      return
    }
    // Other errors...
  }
}
```

**Error Handling:** **Stop on critical errors**
- Disk full → Stop boredom activities (critical)
- Permission denied → Stop boredom activities (critical)
- Other errors → Log and continue

---

## Summary of Architectural Boundaries

### Service Boundaries (External)
1. **BoredomManager → Metabob Backend** - Loose coupling, HTTP/MCP, graceful degradation
2. **TemplateRepository → Metabob Backend** - Loose coupling, HTTP/MCP, cache + fallback

### Layer Boundaries (Internal)
1. **BoredomManager → Activity Execution** - Tight coupling, direct calls, TypeScript types
2. **Activity Execution → Template Executor** - Tight coupling, direct calls, abort signal
3. **TemplateRepository → Storage** - Medium coupling, repository pattern, fallback chain

### Data Store Boundaries
1. **Session → Storage** - Medium coupling, file system, JSON, write locks
2. **Activity → Storage** - Medium coupling, file system, JSON, write locks

### Event Boundaries
1. **Session → BoredomManager** - Loose coupling, pub/sub, fire-and-forget

### Concurrency Boundaries
1. **Idle Timer → Activity Execution** - Tight coupling, shared memory, flags for guards

---

## Resilience Patterns

### Pattern 1: Graceful Degradation
- Backend unavailable → Return empty array, skip idle cycle
- Template not found → Log error, skip execution
- Storage error → Log error, continue without persistence

### Pattern 2: Retry with Exponential Backoff
- Metrics reporting → 3 retries with 1s, 2s, 3s delays
- Network errors → Retry
- Final failure → Log and continue (non-critical)

### Pattern 3: Guard Conditions
- Check `isIdle` before starting execution
- Check `currentActivity` before executing
- Check `abortSignal.aborted` before each task

### Pattern 4: Fire-and-Forget
- Bus events → Subscribers don't block publishers
- Metrics reporting → Don't wait for response

### Pattern 5: Write Locks
- Storage writes → Lock prevents concurrent modifications
- Prevents corrupted JSON files

---

## Coupling Analysis

**Loose Coupling (Good):**
- ✅ Event bus (Session → BoredomManager)
- ✅ MCP service calls (BoredomManager → Backend)
- ✅ Repository pattern (TemplateRepository → Storage)

**Medium Coupling (Acceptable):**
- ⚠️ Storage layer (direct file system access)
- ⚠️ Template fallback chain (cache → metabob → local)

**Tight Coupling (Acceptable for Internal):**
- ⚠️ BoredomManager → executeActivityInline (same repo, same process)
- ⚠️ Activity execution → Template executor (shared types)
- ⚠️ Idle timer → Activity execution (shared memory)

---

## Versioning & Compatibility

**Versioning Strategies:**
1. **MCP Tool Names** - Could add `_v2` suffix for breaking changes
2. **Schema Fields** - Add optional fields, don't remove
3. **Storage Migrations** - Migration system handles old data
4. **Template Schema** - `version.generation` field tracks versions

**Breaking Changes:**
- ❌ Removing MCP tool parameters
- ❌ Changing response schema structure
- ❌ Removing Storage fields
- ✅ Adding optional fields (backward compatible)
- ✅ Adding new MCP tools (new names)

---

## Critical Findings

### Issue 1: No Session Deletion Cleanup
**Problem:** BoredomManager doesn't listen for `Session.Event.Deleted`  
**Impact:** Stale ManagerInstance in memory, timer keeps running  
**Solution:**
```typescript
Bus.subscribe(Session.Event.Deleted, async (event) => {
  const { sessionID } = event.properties.info
  BoredomManager.stopMonitoring(sessionID)
})
```

### Issue 2: No AbortSignal Support in executeActivityInline
**Problem:** Can't cancel activities gracefully  
**Impact:** User must wait for current task to finish  
**Solution:** Add `abortSignal?: AbortSignal` parameter

### Issue 3: Metrics Reporting Failures Silent
**Problem:** No visibility when metrics fail to report  
**Impact:** Backend learning disabled silently  
**Solution:** Add monitoring/alerts for repeated failures

### Issue 4: No Rate Limiting on MCP Calls
**Problem:** Could spam backend if idle checks fail fast  
**Impact:** Backend DoS, frontend banned  
**Solution:** Add rate limiter (max 10 calls/minute per endpoint)

