# BoredomManager Code Quality Analysis

**Feature:** BoredomManager idle detection and auto-execution system  
**Purpose:** Document code quality issues found in data flow components  
**Date:** 2026-02-21  
**Status:** Manual analysis (no automated issues found in Metabob database)

---

## Metabob Search Results

**Query Results:**
- Error handling validation: 0 issues
- Session activity execution: 0 issues
- MCP client timeout: 0 issues
- Storage concurrent access: 0 issues
- Template variables validation: 0 issues
- Bus event errors: 0 issues
- Null/undefined handling: 0 issues
- Async promise rejections: 0 issues

**Conclusion:** No automated code quality issues found in existing codebase components that BoredomManager will integrate with.

---

## Manual Code Quality Analysis

Based on architectural analysis of the data flow components, here are potential code quality concerns for the **NEW** BoredomManager implementation:

### Category 1: Error Handling & Validation

#### Issue 1.1: Missing Session Deletion Event Listener
**Severity:** HIGH  
**Location:** BoredomManager.startMonitoring() (NEW FILE)  
**Description:**
```typescript
// MISSING: Subscribe to Session.Event.Deleted
// Currently only subscribes to Session.Event.Created
Bus.subscribe(Session.Event.Created, async (event) => {
  BoredomManager.startMonitoring(event.properties.info.id)
})

// NEEDED:
Bus.subscribe(Session.Event.Deleted, async (event) => {
  BoredomManager.stopMonitoring(event.properties.info.id)
})
```

**Impact on Data Flow:**
- Memory leak: ManagerInstance never cleaned up
- Timer continues running for deleted sessions
- Idle checks execute for non-existent sessions
- Storage.NotFoundError thrown repeatedly

**Mitigation:**
- Add Session.Event.Deleted subscription in BoredomManager initialization
- Cleanup timer, clear Map entry, abort current activity

**Priority:** Must fix before implementation

---

#### Issue 1.2: Missing AbortSignal Parameter
**Severity:** HIGH  
**Location:** executeActivityInline() at repos/metabob-opencode/packages/opencode/src/tool/activity.ts:1048  
**Description:**
```typescript
// CURRENT SIGNATURE (missing abortSignal):
export async function executeActivityInline(
  templateId: string,
  variables: Record<string, unknown>,
  parentSessionID: string,
  reason: string,
  parentMessageID: string
): Promise<{
  impulses: Record<string, ActivityTemplate.Impulse.Schema>
  success: boolean
  activityId: string
}>

// NEEDED:
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
```

**Impact on Data Flow:**
- Cannot cancel boredom activities gracefully when user returns
- User must wait for entire activity to complete (5+ minutes)
- Poor user experience
- Wasted API tokens/cost

**Mitigation:**
1. Add optional `abortSignal?: AbortSignal` parameter
2. Pass signal to `executeTemplate()`
3. Check `abortSignal.aborted` before each task
4. Return `cancelled: true` if aborted

**Priority:** Must fix before implementation

---

#### Issue 1.3: No Input Validation on BoredomActivity
**Severity:** MEDIUM  
**Location:** BoredomManager.executeBoredomActivity() (NEW FILE)  
**Description:**
```typescript
// NEEDED: Zod schema validation for backend response
const BoredomActivitySchema = z.object({
  activity_type: z.enum(["improve-template", "debug-failures", "optimize-performance"]),
  priority: z.number().min(0).max(1.5),
  template_id: z.string().min(1),
  improvement_gradient: z.number().min(0).max(1),
  reason: z.string(),
  estimated_effort: z.string(),
  metrics: z.object({
    success_rate: z.number().min(0).max(1),
    avg_cost: z.number().nonnegative(),
    avg_duration_ms: z.number().nonnegative(),
    execution_count: z.number().int().nonnegative(),
    // ... more fields
  })
})

// Validate backend response:
async function fetchBoredomActivities(sessionID: string): Promise<BoredomActivity[]> {
  const result = await mcpClient.callTool(...)
  const rawActivities = JSON.parse(result.content[0].text).activities
  
  // VALIDATE each activity:
  const activities = rawActivities.map((raw: unknown) => {
    const parsed = BoredomActivitySchema.safeParse(raw)
    if (!parsed.success) {
      log.warn("Invalid boredom activity from backend", { 
        sessionID, 
        error: parsed.error 
      })
      return null
    }
    return parsed.data
  }).filter(Boolean)
  
  return activities
}
```

**Impact on Data Flow:**
- Malformed backend response crashes frontend
- Runtime errors in priority sorting
- Template ID might not exist
- Metrics might have invalid types

**Mitigation:**
- Define Zod schema for BoredomActivity
- Validate backend response before processing
- Filter out invalid activities
- Log validation errors for debugging

**Priority:** Should fix before implementation

---

#### Issue 1.4: No Timeout on fetchBoredomActivities
**Severity:** MEDIUM  
**Location:** BoredomManager.checkIdleAndExecute() (NEW FILE)  
**Description:**
```typescript
// CURRENT (missing timeout):
const activities = await fetchBoredomActivities(sessionID)

// NEEDED:
const activities = await Promise.race([
  fetchBoredomActivities(sessionID),
  new Promise<BoredomActivity[]>((resolve) => 
    setTimeout(() => resolve([]), 30_000)  // 30 second timeout
  )
])
```

**Impact on Data Flow:**
- Idle check hangs indefinitely if backend slow
- Next idle check can't start (timer blocked)
- Multiple idle checks pile up
- Memory leak from pending promises

**Mitigation:**
- Wrap fetch in Promise.race with timeout
- Return empty array on timeout
- Log timeout for monitoring

**Priority:** Should fix before implementation

---

### Category 2: Concurrency & Race Conditions

#### Issue 2.1: Race Condition in checkIdleAndExecute
**Severity:** MEDIUM  
**Location:** BoredomManager.checkIdleAndExecute() (NEW FILE)  
**Description:**
```typescript
// POTENTIAL RACE:
async function checkIdleAndExecute(sessionID: string): Promise<void> {
  const manager = sessionManagers.get(sessionID)
  if (!manager) return

  const idleTime = Date.now() - manager.lastActivityTime

  if (idleTime < IDLE_THRESHOLD_MS) {
    return
  }

  // RACE: User could return between this check and setting isIdle
  if (manager.isIdle) {
    return
  }

  manager.isIdle = true  // Not atomic!

  // User returns here → trackActivity() sets isIdle = false
  // But we continue executing...

  const activities = await fetchBoredomActivities(sessionID)
  
  // GUARD NEEDED: Check isIdle again after async operation
  if (!manager.isIdle) {
    log.info("user returned while fetching, skipping")
    return
  }
  
  // ...
}
```

**Impact on Data Flow:**
- Activity executes even though user returned
- Wastes API tokens/cost
- User sees unexpected activity execution
- Activity aborted immediately after start

**Mitigation:**
- Add guard check after each async operation
- Check `manager.isIdle` before executing activity
- Document race condition in comments

**Priority:** Should fix before implementation

---

#### Issue 2.2: No Cleanup on stopMonitoring
**Severity:** MEDIUM  
**Location:** BoredomManager.stopMonitoring() (NEW FILE)  
**Description:**
```typescript
// CURRENT (incomplete cleanup):
export function stopMonitoring(sessionID: string): void {
  const manager = sessionManagers.get(sessionID)
  if (!manager) return

  // Clear timer
  clearInterval(manager.boredomTimer)
  
  // MISSING: Abort current activity if running
  if (manager.currentActivity) {
    manager.currentActivity.abortController.abort()
  }
  
  // Remove from map
  sessionManagers.delete(sessionID)
}
```

**Impact on Data Flow:**
- Activity continues executing after stopMonitoring
- Wasted API tokens/cost
- Activity completion reported for deleted session
- Storage errors when saving activity result

**Mitigation:**
- Abort current activity before cleanup
- Wait for abort to complete (with timeout)
- Log cleanup actions

**Priority:** Should fix before implementation

---

### Category 3: Performance & Resource Management

#### Issue 3.1: No Rate Limiting on MCP Calls
**Severity:** MEDIUM  
**Location:** BoredomManager.fetchBoredomActivities() (NEW FILE)  
**Description:**
```typescript
// MISSING: Rate limiter for MCP calls
// If idle checks fail fast, could spam backend

// NEEDED:
class RateLimiter {
  private calls: number[] = []
  
  async limit(fn: () => Promise<any>, maxCallsPerMinute: number): Promise<any> {
    const now = Date.now()
    this.calls = this.calls.filter(t => now - t < 60_000)
    
    if (this.calls.length >= maxCallsPerMinute) {
      const oldestCall = this.calls[0]
      const waitTime = 60_000 - (now - oldestCall)
      log.warn("rate limit reached, waiting", { waitTime })
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    
    this.calls.push(now)
    return fn()
  }
}

const rateLimiter = new RateLimiter()

async function fetchBoredomActivities(sessionID: string): Promise<BoredomActivity[]> {
  return rateLimiter.limit(async () => {
    const mcpClient = await MCP.getClient("metabob")
    // ... make call
  }, 10)  // Max 10 calls/minute
}
```

**Impact on Data Flow:**
- Backend DoS if errors occur
- IP banned by backend
- Cascading failures
- Affects all users/sessions

**Mitigation:**
- Add rate limiter class
- Limit to 10 calls/minute per endpoint
- Log when rate limit hit

**Priority:** Nice to have (low probability)

---

#### Issue 3.2: No Memory Limit on sessionManagers Map
**Severity:** LOW  
**Location:** BoredomManager module state (NEW FILE)  
**Description:**
```typescript
// UNBOUNDED MAP:
const sessionManagers = new Map<string, ManagerInstance>()

// NEEDED: LRU cache with max size
import { LRUCache } from "lru-cache"

const sessionManagers = new LRUCache<string, ManagerInstance>({
  max: 1000,  // Max 1000 sessions
  dispose: (manager, sessionID) => {
    // Cleanup on eviction
    clearInterval(manager.boredomTimer)
    if (manager.currentActivity) {
      manager.currentActivity.abortController.abort()
    }
  }
})
```

**Impact on Data Flow:**
- Memory leak if many sessions created
- Map grows unbounded over time
- Eventually causes OOM

**Mitigation:**
- Use LRU cache instead of Map
- Set max size to 1000 sessions
- Auto-cleanup on eviction

**Priority:** Nice to have (unlikely to hit 1000 sessions)

---

### Category 4: Security & Data Integrity

#### Issue 4.1: No Template ID Validation
**Severity:** LOW  
**Location:** BoredomManager.executeBoredomActivity() (NEW FILE)  
**Description:**
```typescript
// CURRENT: Trust backend template_id
const result = await executeActivityInline(
  activity.template_id,  // Not validated
  ...
)

// NEEDED: Validate template exists first
async function executeBoredomActivity(
  sessionID: string,
  activity: BoredomActivity
): Promise<void> {
  // Validate template exists
  const template = await TemplateRepository.get(activity.template_id)
  if (!template) {
    log.error("Template not found for boredom activity", { 
      sessionID, 
      templateId: activity.template_id 
    })
    return  // Skip execution
  }
  
  // Execute activity...
}
```

**Impact on Data Flow:**
- executeActivityInline throws TemplateNotFoundError
- Activity marked as failed
- Metrics reported as failure
- Backend recalculates priority (unnecessary)

**Mitigation:**
- Validate template exists before execution
- Return early if not found
- Don't report as failure (backend bug)

**Priority:** Nice to have (backend should only return valid templates)

---

#### Issue 4.2: No Activity ID Validation in reportActivityResult
**Severity:** LOW  
**Location:** BoredomManager.reportActivityResult() (NEW FILE)  
**Description:**
```typescript
// CURRENT: Trust activity ID from execution
await reportActivityResult(result.activityId, { ... })

// NEEDED: Validate activity ID format
function isValidActivityId(id: string): boolean {
  return /^act_[a-z0-9]{8,}$/.test(id)
}

async function reportActivityResult(activityId: string, ...): Promise<void> {
  if (!isValidActivityId(activityId)) {
    log.error("Invalid activity ID, skipping report", { activityId })
    return
  }
  // ... report to backend
}
```

**Impact on Data Flow:**
- Backend rejects invalid activity ID
- Metrics not updated
- Learning disabled for this execution

**Mitigation:**
- Validate activity ID format
- Log validation failures
- Skip reporting if invalid

**Priority:** Low (activity IDs generated by trusted code)

---

### Category 5: Observability & Monitoring

#### Issue 5.1: No Metrics on Idle Detection Performance
**Severity:** LOW  
**Location:** BoredomManager.checkIdleAndExecute() (NEW FILE)  
**Description:**
```typescript
// MISSING: Performance metrics
// - How long does fetchBoredomActivities take?
// - How often do idle checks succeed?
// - How often do users return during execution?

// NEEDED:
async function checkIdleAndExecute(sessionID: string): Promise<void> {
  const startTime = Date.now()
  
  try {
    // ... idle detection logic
    
    const fetchStartTime = Date.now()
    const activities = await fetchBoredomActivities(sessionID)
    const fetchDuration = Date.now() - fetchStartTime
    
    log.info("boredom activities fetched", {
      sessionID,
      count: activities.length,
      fetchDuration,
      totalDuration: Date.now() - startTime
    })
    
    // ... execution logic
    
  } catch (error) {
    log.error("idle check failed", {
      sessionID,
      error,
      duration: Date.now() - startTime
    })
  }
}
```

**Impact on Data Flow:**
- No visibility into system performance
- Can't detect slow backend calls
- Can't measure success rate

**Mitigation:**
- Add duration tracking
- Log success/failure metrics
- Add counters for monitoring

**Priority:** Nice to have

---

#### Issue 5.2: No Alerting on Repeated Failures
**Severity:** MEDIUM  
**Location:** BoredomManager.reportActivityResult() (NEW FILE)  
**Description:**
```typescript
// MISSING: Track consecutive failures and alert

// NEEDED:
const failureTracker = new Map<string, number>()  // sessionID -> consecutive failures

async function reportActivityResult(
  activityId: string,
  result: { success: boolean, ... }
): Promise<void> {
  const sessionID = getSessionIdFromActivity(activityId)
  
  if (!result.success) {
    const failures = (failureTracker.get(sessionID) || 0) + 1
    failureTracker.set(sessionID, failures)
    
    if (failures >= 3) {
      log.error("boredom activities failing repeatedly", {
        sessionID,
        consecutiveFailures: failures
      })
      // TODO: Disable boredom activities for this session?
      // TODO: Send alert to monitoring system?
    }
  } else {
    failureTracker.delete(sessionID)  // Reset on success
  }
  
  // ... report to backend
}
```

**Impact on Data Flow:**
- Backend metrics reporting disabled silently
- No visibility when system broken
- Wastes API tokens on failing activities

**Mitigation:**
- Track consecutive failures per session
- Alert after 3 failures
- Consider disabling boredom activities after 5 failures

**Priority:** Should add

---

## Summary

### Issues Found: 12

### High Priority (Must Fix Before Implementation):
1. **Missing Session Deletion Event Listener** - Memory leak, timer keeps running
2. **Missing AbortSignal Parameter** - Cannot cancel activities gracefully

### Medium Priority (Should Fix Before Implementation):
3. **No Input Validation on BoredomActivity** - Malformed responses crash frontend
4. **No Timeout on fetchBoredomActivities** - Hangs indefinitely on slow backend
5. **Race Condition in checkIdleAndExecute** - Activity executes after user returns
6. **No Cleanup on stopMonitoring** - Activity continues after cleanup
7. **No Rate Limiting on MCP Calls** - Could DoS backend
8. **No Alerting on Repeated Failures** - Silent failures

### Low Priority (Nice to Have):
9. **No Memory Limit on sessionManagers Map** - Memory leak with many sessions
10. **No Template ID Validation** - Execution fails if template missing
11. **No Activity ID Validation** - Metrics report fails if ID invalid
12. **No Metrics on Idle Detection Performance** - No visibility into performance

---

## Related Files to Review

Based on architectural analysis, these files should be reviewed when implementing BoredomManager:

### Critical Files (Direct Dependencies):
1. **repos/metabob-opencode/packages/opencode/src/session/index.ts**
   - Reason: Session lifecycle events (Created, Deleted)
   - Action: Subscribe to both events

2. **repos/metabob-opencode/packages/opencode/src/session/prompt.ts**
   - Reason: User activity tracking (prompt function)
   - Action: Call BoredomManager.trackActivity()

3. **repos/metabob-opencode/packages/opencode/src/tool/activity.ts**
   - Reason: Activity execution (executeActivityInline)
   - Action: Add AbortSignal parameter

4. **repos/metabob-opencode/packages/opencode/src/session/template-executor.ts**
   - Reason: Task execution with abort checks
   - Action: Verify abort signal handling

5. **repos/metabob-opencode/packages/opencode/src/mcp/index.ts**
   - Reason: MCP client for backend calls
   - Action: Verify timeout/error handling

### Supporting Files (Indirect Dependencies):
6. **repos/metabob-opencode/packages/opencode/src/session/activity.ts**
   - Reason: Activity tracking (Activity.create, Activity.save)
   - Action: Verify storage error handling

7. **repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts**
   - Reason: Template fetching (TemplateRepository.get)
   - Action: Verify fallback chain

8. **repos/metabob-opencode/packages/opencode/src/storage/storage.ts**
   - Reason: File system operations (Storage.write)
   - Action: Verify error handling (disk full, permissions)

9. **repos/metabob-opencode/packages/opencode/src/bus/index.ts**
   - Reason: Event bus (Bus.subscribe, Bus.publish)
   - Action: Verify error propagation

---

## Recommendations for Implementation

### 1. Start with High Priority Fixes
- Add Session.Event.Deleted subscription
- Add AbortSignal parameter to executeActivityInline

### 2. Add Input Validation
- Define Zod schema for BoredomActivity
- Validate backend responses
- Filter invalid activities

### 3. Add Concurrency Guards
- Check isIdle after async operations
- Abort current activity on stopMonitoring
- Handle race conditions gracefully

### 4. Add Observability
- Log idle detection events
- Track fetch duration
- Monitor success/failure rates

### 5. Add Rate Limiting
- Limit MCP calls to 10/minute
- Log when rate limit hit

### 6. Write Tests
- Unit tests for idle detection logic
- Unit tests for activity extraction
- Integration tests for full flow
- Mock MCP client for testing

---

## Next Steps

1. **Review this analysis** with team
2. **Prioritize fixes** (High → Medium → Low)
3. **Update design documents** with fixes
4. **Implement BoredomManager** with fixes included
5. **Write comprehensive tests**
6. **Monitor in production** for unexpected issues

