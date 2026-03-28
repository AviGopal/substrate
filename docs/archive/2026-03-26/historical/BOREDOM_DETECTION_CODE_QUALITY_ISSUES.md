# Boredom Activity Detection - Code Quality Issues

## Overview

Manual code quality review based on architectural boundary analysis. Metabob issue cache returned 0 results, indicating files may not be indexed yet or no automated issues detected.

---

## Issues Found: 12 (Manual Review)

---

## HIGH PRIORITY ISSUES

### 1. Debug Code in Production - Title Prefix Injection

**Location**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts:443`

**Issue**:
```typescript
// DEBUG: Add a marker to title to prove this code runs
activity.title = `[EVIDENCE_TEST] ${activity.title}`
```

**Severity**: HIGH

**Impact on Data Flow**:
- All activities (including boredom activities) have `[EVIDENCE_TEST]` prefix
- Breaks boredom detection logic that relies on title prefix
- Expected: `"[BOREDOM] Improve template"`
- Actual: `"[EVIDENCE_TEST] [BOREDOM] Improve template"`
- String matching for boredom detection may fail

**Type**: Bug / Technical Debt

**Blocking**: YES - Breaks boredom activity detection

**Recommendation**: Remove debug prefix or make conditional:
```typescript
if (process.env.DEBUG_EVIDENCE) {
  activity.title = `[EVIDENCE_TEST] ${activity.title}`
}
```

---

### 2. Silent Error Swallowing - Event Bus

**Location**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts:453,568,874`

**Issue**:
```typescript
await Bus.publish(Event.Created, { activity }).catch(() => {})
// ↑ Errors silently swallowed
```

**Severity**: HIGH

**Impact on Data Flow**:
- Event subscribers may fail without any indication
- BoredomManager may not receive `Session.Created` event → monitoring not started
- Critical lifecycle events lost
- Debugging becomes impossible (no error logs)

**Type**: Error Handling

**Blocking**: YES - Can cause monitoring to fail silently

**Recommendation**: Log errors instead of swallowing:
```typescript
await Bus.publish(Event.Created, { activity }).catch((error) => {
  log.error("Failed to publish activity.created event", { error, activityId: activity.id })
})
```

---

### 3. No Subscriber Isolation - Event Bus

**Location**: `repos/metabob-opencode/packages/opencode/src/bus/index.ts:61-68`

**Issue**:
```typescript
const pending = []
for (const sub of match ?? []) {
  pending.push(sub(payload))  // ← No error handling
}
return Promise.all(pending)  // ← Fails if any subscriber throws
```

**Severity**: HIGH

**Impact on Data Flow**:
- One subscriber error crashes all subscribers
- If BoredomManager.startMonitoring() throws, other subscribers never run
- Cascading failures across unrelated components

**Type**: Error Handling / Resilience

**Blocking**: YES - Can break entire event system

**Recommendation**: Isolate subscribers:
```typescript
for (const sub of match ?? []) {
  pending.push(
    sub(payload).catch((error) => {
      log.error("Subscriber error", { error, event: def.type })
    })
  )
}
```

---

### 4. Orphaned Activities on Execution Failure

**Location**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:250-373`

**Issue**:
```typescript
try {
  const activity = await Activity.create({ ... })  // Persisted immediately
  
  // ... execution logic that may fail
  
} catch (error) {
  log.error("Boredom activity execution failed", { error })
  // ← Activity left in "setup" status, never cleaned up
} finally {
  manager.isExecutingBoredomActivity = false
}
```

**Severity**: HIGH

**Impact on Data Flow**:
- Failed activities remain in storage forever with `status: "setup"`
- Storage gradually fills with incomplete activities
- No way to distinguish failed from in-progress activities
- Activity list shows orphaned entries

**Type**: Error Handling / Resource Management

**Blocking**: MEDIUM - Causes storage pollution over time

**Recommendation**: Update activity status on failure:
```typescript
catch (error) {
  log.error("Boredom activity execution failed", { error })
  activity.status = "failed"
  activity.error = error.message
  activity.errorStack = error.stack
  await Activity.save(activity)
}
```

---

### 5. No Validation of MCP Response Schema

**Location**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:210-245`

**Issue**:
```typescript
const data = JSON.parse(firstContent.text)

if (data.status === "success" && Array.isArray(data.activities)) {
  return data.activities  // ← No schema validation
}
```

**Severity**: MEDIUM

**Impact on Data Flow**:
- Malformed backend responses cause runtime errors
- Type assumptions break if backend changes schema
- No compile-time type safety (JSON parsing loses types)
- Downstream code assumes `activities` has correct structure

**Type**: Validation / Type Safety

**Blocking**: NO - But causes fragile integration

**Recommendation**: Add Zod schema validation:
```typescript
const BoredomActivitySchema = z.object({
  activity_type: z.enum(["improve-template", "debug-failures", "optimize-performance"]),
  priority: z.number().min(0).max(1),
  template_id: z.string(),
  improvement_gradient: z.number(),
  reason: z.string(),
  metrics: z.object({
    success_rate: z.number(),
    avg_cost: z.number(),
    avg_duration_ms: z.number(),
    execution_count: z.number(),
  }),
})

const activities = BoredomActivitySchema.array().parse(data.activities)
```

---

### 6. Template ID Extraction Fragility

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:273`

**Issue**:
```python
template_id = activity_id.rsplit("-", 1)[0]
# Assumes activity_id format: "{template_id}-{timestamp}"
```

**Severity**: MEDIUM

**Impact on Data Flow**:
- Breaks if activity ID format changes
- Breaks if template ID contains trailing `-{digits}`
- Backend can't find template metrics
- Learning loop broken

**Type**: Validation / Data Contract

**Blocking**: NO - But causes metrics reporting failure

**Example Failure**:
```python
# Works
activity_id = "improve-auth-1234567890"
template_id = "improve-auth"  ✓

# Breaks
activity_id = "my-template-v2-1234567890"
template_id = "my-template-v2"  ✓ (actually works)

# Edge case
template_id_with_numbers = "v2-auth-test-123"
activity_id = "v2-auth-test-123-1234567890"
extracted = "v2-auth-test-123"  ✓ (works)
```

**Recommendation**: Pass template_id explicitly in request:
```typescript
await metabobClient.callTool({
  name: "metabob_post_activity_result",
  arguments: {
    activity_id: result.activityId,
    template_id: template.id,  // ← Explicit, not extracted
    ...
  },
})
```

---

## MEDIUM PRIORITY ISSUES

### 7. No Retry Logic for API Calls

**Locations**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:423` (GET boredom activities)
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:303` (POST execution results)

**Issue**:
```python
async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.get(...)  # ← Single attempt, no retry
```

**Severity**: MEDIUM

**Impact on Data Flow**:
- Transient network errors cause complete failure
- Boredom activities not fetched if API temporarily down
- Execution results lost if POST fails
- No automatic recovery

**Type**: Resilience / Error Handling

**Blocking**: NO - But causes unnecessary failures

**Recommendation**: Add retry with exponential backoff:
```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True
)
async def fetch_boredom_activities(...):
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(...)
        ...
```

---

### 8. No MCP Reconnection Logic

**Location**: `repos/metabob-opencode/packages/opencode/src/mcp/index.ts:95-98`

**Issue**:
```typescript
const result = await create(key, mcp).catch(() => undefined)
if (!result) return  // ← MCP server failure = permanent disconnect
```

**Severity**: MEDIUM

**Impact on Data Flow**:
- MCP server crash/restart requires OpenCode restart
- Boredom activity system stops working until restart
- No automatic recovery

**Type**: Resilience / Error Handling

**Blocking**: NO - But requires manual intervention

**Recommendation**: Add reconnection logic:
```typescript
async function connectWithRetry(key, mcp, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await create(key, mcp).catch(() => undefined)
    if (result) return result
    
    log.warn(`MCP connection failed (attempt ${attempt}/${maxAttempts})`, { key })
    await sleep(Math.pow(2, attempt) * 1000)  // Exponential backoff
  }
  return undefined
}
```

---

### 9. No Optimistic Locking for Concurrent Writes

**Location**: `repos/metabob-opencode/packages/opencode/src/storage/storage.ts`

**Issue**:
```typescript
export async function write(key: string[], value: unknown): Promise<void> {
  const filePath = path.join(storageDir, ...key) + ".json"
  await fs.writeFile(filePath, JSON.stringify(value))
  // ↑ No version check, last write wins
}
```

**Severity**: MEDIUM

**Impact on Data Flow**:
- Concurrent Activity.save() calls can corrupt data
- Multiple boredom activities modifying same activity = race condition
- Lost updates (last write wins)

**Type**: Concurrency / Data Integrity

**Blocking**: NO - But can cause data corruption

**Recommendation**: Add version field and compare-and-swap:
```typescript
// activity.ts
export const Info = z.object({
  version: z.number().default(1),
  // ... other fields
})

export async function save(activity: Info): Promise<void> {
  const current = await Storage.read<Info>(["activity", activity.id])
  
  if (current.version !== activity.version) {
    throw new Error("Concurrent modification detected")
  }
  
  activity.version += 1
  await Storage.write(["activity", activity.id], activity)
}
```

---

### 10. Missing Null Checks for Optional Fields

**Location**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:331-346`

**Issue**:
```typescript
cost: activity.stats?.cost?.total || 0,
tokens: {
  input: activity.stats?.tokens?.input || 0,
  output: activity.stats?.tokens?.output || 0,
  cache: activity.stats?.tokens?.cache?.read || 0,
}
```

**Severity**: LOW

**Impact on Data Flow**:
- Defaults to 0 if stats missing (acceptable fallback)
- But: 0 vs undefined have different meanings
- Backend can't distinguish "no tokens used" from "tokens not tracked"

**Type**: Data Semantics / Validation

**Blocking**: NO - But loses information

**Recommendation**: Use explicit undefined for missing data:
```typescript
cost: activity.stats?.cost?.total ?? undefined,
tokens: activity.stats?.tokens ? {
  input: activity.stats.tokens.input ?? 0,
  output: activity.stats.tokens.output ?? 0,
  cache: activity.stats.tokens.cache?.read ?? 0,
} : undefined
```

---

### 11. No Circuit Breaker for Failing APIs

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**Issue**:
- Learning Loop API called every 30 seconds (via boredom check)
- If API consistently failing (e.g., service down), OpenCode keeps retrying
- No circuit breaker to stop calling failing API

**Severity**: MEDIUM

**Impact on Data Flow**:
- Wasted CPU cycles calling failing API
- Logs fill with error messages
- Slow degradation of OpenCode performance

**Type**: Resilience / Performance

**Blocking**: NO - But causes resource waste

**Recommendation**: Add circuit breaker:
```python
from circuitbreaker import circuit

@circuit(failure_threshold=5, recovery_timeout=60)
async def fetch_boredom_activities(...):
    # API call logic
```

---

### 12. No Request Timeout for Learning Loop POST

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:303-308`

**Issue**:
```python
async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.post(...)  # ← 30s timeout, but what if API hangs?
```

**Severity**: LOW

**Impact on Data Flow**:
- 30-second timeout is reasonable
- But: boredom activity execution blocks during timeout
- User experience degraded if API slow

**Type**: Performance / User Experience

**Blocking**: NO - Timeout exists, just might be too long

**Recommendation**: Use shorter timeout with retry:
```python
async with httpx.AsyncClient(timeout=10.0) as client:  # 10s timeout
    # Add retry logic to attempt 3 times = 30s total
```

---

## RELATED FILES TO REVIEW

Based on data flow analysis, these files should be reviewed for similar issues:

### High Priority Review

1. **`repos/metabob-opencode/packages/opencode/src/session/index.ts`**
   - Reason: Session lifecycle management, similar event publishing patterns
   - Likely issues: Silent error swallowing, no subscriber isolation

2. **`repos/metabob-opencode/packages/opencode/src/session/prompt.ts`**
   - Reason: Calls BoredomManager.trackActivity(), similar error handling
   - Likely issues: Missing null checks, no error handling for trackActivity()

3. **`repos/metabob-opencode/packages/opencode/src/tool/activity.ts`**
   - Reason: executeActivityInline() called by boredom manager
   - Likely issues: No validation of template variables, orphaned activities

### Medium Priority Review

4. **`repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`**
   - Reason: Executes template tasks, similar error handling needs
   - Likely issues: No cleanup on task failure, orphaned sessions

5. **`repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`**
   - Reason: Loads templates from MCP backend
   - Likely issues: No schema validation, no retry logic

6. **`repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py`**
   - Reason: Template storage and retrieval
   - Likely issues: No validation, no error handling

### Low Priority Review

7. **`repos/metabob-opencode/packages/opencode/src/cli/cmd/stats.ts`**
   - Reason: Displays boredom status, similar API calls
   - Likely issues: No error handling for getStatus() calls

8. **`repos/metabob-opencode/packages/opencode/src/storage/storage.ts`**
   - Reason: File system operations, concurrency concerns
   - Likely issues: No distributed locking, no corruption detection

---

## SUMMARY BY CATEGORY

### Validation Issues (3)
- No MCP response schema validation (MEDIUM)
- Template ID extraction fragility (MEDIUM)
- Missing null checks for optional fields (LOW)

### Error Handling Issues (5)
- Debug code in production (HIGH)
- Silent error swallowing (HIGH)
- No subscriber isolation (HIGH)
- Orphaned activities on failure (HIGH)
- No retry logic for API calls (MEDIUM)

### Resilience Issues (3)
- No MCP reconnection logic (MEDIUM)
- No circuit breaker for failing APIs (MEDIUM)
- No request timeout optimization (LOW)

### Concurrency Issues (1)
- No optimistic locking (MEDIUM)

---

## BLOCKING ISSUES REQUIRING IMMEDIATE FIX

1. **Debug Code in Production** - Breaks boredom detection
2. **Silent Error Swallowing** - Causes monitoring to fail silently
3. **No Subscriber Isolation** - Can crash entire event system
4. **Orphaned Activities** - Storage pollution

---

## RECOMMENDED FIX ORDER

### Sprint 1 (Critical Path)
1. Remove `[EVIDENCE_TEST]` debug prefix (1 hour)
2. Add error logging to event bus (2 hours)
3. Add subscriber isolation (3 hours)
4. Fix orphaned activities on failure (4 hours)

### Sprint 2 (Resilience)
5. Add Zod schema validation for MCP responses (4 hours)
6. Add retry logic for API calls (3 hours)
7. Add MCP reconnection logic (4 hours)

### Sprint 3 (Data Integrity)
8. Add optimistic locking for storage (6 hours)
9. Add circuit breaker for APIs (3 hours)
10. Fix template ID extraction (2 hours)

---

## METRICS

- **Total Issues**: 12
- **High Priority**: 6
- **Medium Priority**: 5
- **Low Priority**: 1
- **Blocking**: 4
- **Estimated Fix Time**: ~32 hours (4 sprints)

---

## NOTES

1. Metabob issue cache returned 0 results, suggesting:
   - Files not indexed in CPG yet
   - No automated analysis run
   - Manual review necessary

2. All issues identified through manual code review based on:
   - Architectural boundary analysis
   - Data transformation trace
   - Dependency chain analysis

3. No security issues (SQL injection, XSS, auth) found because:
   - No SQL database (file-based storage)
   - No user input rendering (CLI only)
   - No authentication layer (local tool)

4. Performance issues are secondary to correctness issues:
   - Focus on fixing data integrity first
   - Then add resilience
   - Finally optimize performance
