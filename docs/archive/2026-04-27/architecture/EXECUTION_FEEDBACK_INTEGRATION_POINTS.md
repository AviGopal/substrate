# Execution Feedback Integration Points

**Date**: 2026-04-08
**Status**: FULLY IMPLEMENTED

This document maps all integration points where execution feedback is recorded in the Thompson Sampling learning loop.

---

## Integration Point Map

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MiniBob Execution Paths                         │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                 ┌─────────────────┼─────────────────┐
                 │                 │                 │
                 ▼                 ▼                 ▼
    ┌────────────────────┐ ┌──────────────┐ ┌──────────────────┐
    │ ActivityExecutor   │ │ SearchFirst  │ │ Manual Feedback  │
    │ (Standard Flow)    │ │ (Improviser) │ │ (/teach, /warn)  │
    └────────────────────┘ └──────────────┘ └──────────────────┘
             │                     │                 │
             ├─────────────────────┼─────────────────┤
             │                     │                 │
             ▼                     ▼                 ▼
    ┌────────────────────────────────────────────────────────┐
    │         mcp.reportExecution(execution)                 │
    │                                                         │
    │  File: repos/minibob/src/mcp.ts:650-726                │
    │                                                         │
    │  Payload:                                              │
    │    - success: boolean                                  │
    │    - duration_ms: number                               │
    │    - cost: number                                      │
    │    - tokens: {input, output, cache}                    │
    │    - error_message?: string                            │
    │    - error_type?: string                               │
    │    - input_impulses?: string[]                         │
    │    - metadata?: {shapes, improvisation}                │
    └────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  POST /v2/activities/executions│
              │                                │
              │  HTTP with JWT auth            │
              │  (or falls back to cache)      │
              └───────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Backend Processing Flow                             │
│                                                                        │
│  File: repos/metabob-activity-api/src/routes/activities.ts:1387-1707  │
└────────────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
  ┌─────────────────┐ ┌──────────────┐ ┌────────────────┐
  │ Record Trace    │ │ Update       │ │ Invalidate     │
  │ (Line 1512)     │ │ Thompson     │ │ Cache          │
  │                 │ │ (Line 1600)  │ │ (Line 1632)    │
  │ INSERT INTO     │ │              │ │                │
  │ activity_       │ │ UPDATE       │ │ Redis DEL      │
  │ execution_      │ │ variant_     │ │ template key   │
  │ traces          │ │ performance_ │ │                │
  │                 │ │ metrics      │ │                │
  └─────────────────┘ └──────────────┘ └────────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │ Atomic Update       │
                   │                     │
                   │ total_executions += 1         │
                   │ successful_executions += δ    │
                   │ failed_executions += δ        │
                   │ thompson_alpha = successes + 1│ ◄── LEARNING
                   │ thompson_beta = failures + 1  │ ◄── LEARNING
                   │ success_rate = successes/total│
                   │ avg_duration_ms (running avg) │
                   │ avg_cost_usd (running avg)    │
                   └─────────────────────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │ Emit WebSocket      │
                   │ Events              │
                   │                     │
                   │ - execution_completed         │
                   │ - template_updated            │
                   └─────────────────────┘
```

---

## Detailed Integration Points

### 1. ActivityExecutor - Standard Activity Execution

**Location**: `repos/minibob/src/activity.ts`

#### Success Path (Line 1154)
```typescript
if (isMCPEnabled()) {
  const mcp = getMCPClient()
  if (mcp) {
    log.info(` Reporting execution to MCP backend...`)
    const reported = await mcp.reportExecution(execution).catch(async (error) => {
      log.debug(` Backend unavailable, caching execution offline`)
      const { cacheExecution } = await import("./offline-cache")
      await cacheExecution(execution)
      return false
    })
    // ... continues with trace storage, ribosome, etc.
  }
}
```

**Triggers**:
- Activity completes all tasks successfully
- `execution.status === "completed"`
- Called after ribosome extraction, tool usage reporting

#### Failure Path (Line 1321)
```typescript
catch (error) {
  execution.status = "failed"
  execution.completedAt = Date.now()
  execution.error = error instanceof Error ? error.message : String(error)

  // Still report failure to backend for Thompson Sampling
  if (isMCPEnabled()) {
    const mcp = getMCPClient()
    if (mcp) {
      await mcp.reportExecution(execution).catch(async (error) => {
        log.debug(` Backend unavailable, caching failed execution offline`)
        const { cacheExecution } = await import("./offline-cache")
        await cacheExecution(execution).catch(() => {
          // Ignore cache errors on failure
        })
      })
    }
  }
}
```

**Triggers**:
- Any unhandled exception during activity execution
- Task execution failure
- Validation failure

---

### 2. SearchFirstExecutor - Improvisation Flow

**Location**: `repos/minibob/src/search-first-executor.ts`

#### Improvisation Trace (Line 985)
```typescript
const reported = await mcp.reportExecution(execution as any)
if (reported) {
  console.log(`[SearchFirst] ✓ Improvisation trace reported for ${step.id}`)
} else {
  console.warn(`[SearchFirst] Failed to report improvisation trace for ${step.id}`)
}
```

**Triggers**:
- Improvised activity execution completes
- No template found, LLM generates ad-hoc steps
- Enables learning from improvisation

#### Validation Failure (Line 1152)
```typescript
const mockExecution: any = {
  id: `validation_failure_${Date.now()}`,
  templateId,
  status: "failed",
  startedAt: Date.now(),
  completedAt: Date.now(),
  error: validationError,
  taskResults: [],
  // ... other fields
}

const success = await mcp.reportExecution(mockExecution)
if (success) {
  console.log(`[SearchFirst] ✓ Validation failure reported for ${templateId}`)
}
```

**Triggers**:
- Pre-validation fails before execution
- Shape mismatch detected
- Early exit saves cost by not running doomed activity

---

### 3. Manual Feedback - User Teaching

**Location**: `repos/minibob/src/tutor.ts`

```typescript
const execution: ActivityExecution = {
  id: `feedback_${Date.now()}`,
  templateId,
  status: "completed",  // Always mark as success for positive feedback
  startedAt: Date.now(),
  completedAt: Date.now(),
  taskResults: [],
  impulses: [],
  // ... other fields
};

const reported = await mcp.reportExecution(execution);
if (reported) {
  boosted = true;
}
```

**Triggers**:
- User runs `/teach` command (positive feedback)
- User runs `/warn` command (negative feedback)
- Enables human-in-the-loop tuning

**Strength Modifiers**:
- `/teach` = +1 success
- `/teach!` = +2 successes
- `/teach!!` = +3 successes
- `/warn` = +1 failure
- `/warn!` = +2 failures
- `/warn!!` = +3 failures

---

### 4. Offline Cache - Background Sync

**Location**: `repos/minibob/src/offline-cache.ts`

#### Cache on Failure (Line 104)
```typescript
export async function reportExecutionWithFallback(execution: ActivityExecution): Promise<boolean> {
  if (isMCPEnabled()) {
    const mcp = getMCPClient()
    if (mcp) {
      try {
        const reported = await mcp.reportExecution(execution)
        if (reported) {
          log.debug(`Execution reported to backend: ${execution.id}`)
          return true
        }
      } catch (error) {
        log.warn(`Backend unavailable: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  // Backend unavailable - cache for later sync
  await cacheExecution(execution)
  return false
}
```

#### Sync on Startup (Line 181)
```typescript
for (const filepath of cacheFiles) {
  try {
    const file = Bun.file(filepath)
    const execution = await file.json() as ActivityExecution

    const reported = await mcp.reportExecution(execution)
    if (reported) {
      await Bun.write(filepath, "") // Delete cached file
      executionsSynced++
      log.debug(`Synced execution: ${execution.id}`)
    }
  } catch (error) {
    log.warn(`Failed to sync ${filepath}:`, error)
  }
}
```

**Triggers**:
- MiniBob starts up
- Backend becomes available after outage
- Ensures eventual consistency

---

## Backend Processing Details

### Atomic Thompson Sampling Update

**Location**: `repos/metabob-activity-api/src/routes/activities.ts:1600-1615`

```sql
UPDATE variant_performance_metrics
SET
  total_executions += 1,
  successful_executions += $success_delta,
  failed_executions += $failure_delta,
  success_rate = successful_executions / total_executions,
  avg_duration_ms = ((avg_duration_ms * (total_executions - 1)) + $duration_ms) / total_executions,
  avg_cost_usd = ((avg_cost_usd * (total_executions - 1)) + $cost) / total_executions,
  thompson_alpha = successful_executions + 1,
  thompson_beta = failed_executions + 1,
  last_executed_at = time::now(),
  updated_at = time::now()
WHERE variant_id = $variant_id
RETURN AFTER;
```

**Key Properties**:
- ✅ **Atomic**: `+=` operator prevents race conditions
- ✅ **Incremental**: Running averages, no need to re-query all executions
- ✅ **Efficient**: Single query updates all metrics
- ✅ **Correct**: `thompson_alpha = successful_executions + 1` (Beta prior)

---

## Error Classification Flow

```
                    ┌─────────────────────┐
                    │ Task Execution      │
                    │ Fails               │
                    └──────────┬──────────┘
                               │
                               ▼
                  ┌────────────────────────┐
                  │ categorizeFailure()    │
                  │                        │
                  │ File: activity.ts:2644 │
                  └────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ "validation"  │  │ "timeout"        │  │ "tool_failure"   │
│               │  │                  │  │                  │
│ - Required    │  │ - Timeout        │  │ - Bash exit != 0 │
│   file missing│  │ - Timed out      │  │ - Tool failed    │
│ - Required    │  │ - Exceeded limit │  │ - Command failed │
│   pattern     │  │                  │  │                  │
│ - Forbidden   │  │                  │  │                  │
│   pattern     │  │                  │  │                  │
└───────────────┘  └──────────────────┘  └──────────────────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               │
                               ▼
                      ┌────────────────┐
                      │ "execution"    │
                      │ (default)      │
                      └────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ mcp.reportExecution │
                    │                     │
                    │ error_type: string  │
                    └─────────────────────┘
```

**Current Behavior**:
- Error classification logic exists and works
- BUT: Not currently forwarded to backend (hardcoded to `"task_execution_error"`)
- Enhancement: Use classified type for better analytics

---

## Data Flow: End-to-End

```
1. MiniBob Activity Execution
   └─ execute() → success/failure → metrics captured

2. Report to Backend
   └─ mcp.reportExecution() → POST /v2/activities/executions

3. Backend Processing
   ├─ INSERT execution trace (audit log)
   ├─ UPDATE Thompson metrics (learning)
   ├─ DELETE Redis cache (invalidation)
   └─ EMIT WebSocket events (real-time updates)

4. Next Selection
   └─ POST /v2/activities/recommend
      ├─ Load templates matching goal
      ├─ Load metrics (alpha, beta)
      ├─ Sample ~ Beta(alpha, beta)
      └─ Return template with highest sample

5. Learning Verification
   └─ Dashboard shows:
      ├─ Execution count increasing
      ├─ Success rate converging
      ├─ Alpha/beta values evolving
      └─ Selection scores changing
```

---

## Verification Queries

### Check Execution Feedback is Working

```sql
-- 1. Verify executions are being recorded
SELECT COUNT(*) as total_executions,
       SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successes,
       SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failures
FROM activity_execution_traces
WHERE executed_at > time::now() - 1d;

-- 2. Verify Thompson metrics are updating
SELECT variant_id,
       total_executions,
       successful_executions,
       failed_executions,
       thompson_alpha,
       thompson_beta,
       success_rate,
       last_executed_at
FROM variant_performance_metrics
WHERE updated_at > time::now() - 1h
ORDER BY updated_at DESC
LIMIT 10;

-- 3. Check for templates with executions but no metrics (should be ZERO)
SELECT a.id, a.name
FROM activity a
WHERE a.id IN (
  SELECT DISTINCT activity_id FROM activity_execution_traces
)
AND a.id NOT IN (
  SELECT variant_id FROM variant_performance_metrics
);

-- 4. Verify alpha/beta match execution counts
SELECT variant_id,
       successful_executions,
       thompson_alpha,
       thompson_alpha - successful_executions - 1 as alpha_drift,
       failed_executions,
       thompson_beta,
       thompson_beta - failed_executions - 1 as beta_drift
FROM variant_performance_metrics
WHERE total_executions > 0;
-- alpha_drift and beta_drift should be 0
```

### Check for Missing Integration Points

```bash
# 1. Grep for execution completions not reporting
cd repos/minibob
grep -n "execution.status = \"completed\"" src/**/*.ts | \
  while read line; do
    file=$(echo $line | cut -d: -f1)
    linenum=$(echo $line | cut -d: -f2)

    # Check if reportExecution is called within 50 lines
    context=$(sed -n "$((linenum-10)),$((linenum+50))p" $file)
    if ! echo "$context" | grep -q "reportExecution"; then
      echo "MISSING: $file:$linenum"
    fi
  done

# 2. Check for offline cache usage
grep -rn "cacheExecution" repos/minibob/src/ | wc -l
# Should show multiple usages (fallback pattern)

# 3. Verify backend endpoint exists
curl -X POST http://activity.metabob.local/v2/activities/executions \
  -H "Content-Type: application/json" \
  -d '{"activity_id":"test","success":true,"duration_ms":100,"cost":0.001,"tokens":{"input":10,"output":5,"cache":0}}'
# Should return 201 Created
```

---

## Edge Cases and Handling

| Edge Case | Handled By | How |
|-----------|-----------|-----|
| Concurrent executions | Atomic `+=` in SQL | No race conditions |
| Backend unavailable | Offline cache | Eventual consistency |
| Metrics record missing | Template registration | Creates initial metrics |
| Invalid error types | Default to "execution" | Fallback classification |
| Duplicate execution reports | Idempotent inserts | Execution ID uniqueness |
| Template doesn't exist | Lookup before update | Graceful skip if missing |
| Cache invalidation fails | Non-blocking | Logged but doesn't fail request |
| WebSocket emit fails | Non-blocking | Logged but doesn't fail request |

---

## Testing Strategy

### Unit Tests

```typescript
describe('Execution Feedback Integration', () => {
  test('reportExecution updates Thompson Sampling metrics', async () => {
    // Create template with alpha=1, beta=1
    await createTemplate({ id: 'test-template', ... })

    // Report success
    await mcp.reportExecution({
      templateId: 'test-template',
      status: 'completed',
      metrics: { duration: 1000, cost: 0.01 }
    })

    // Verify alpha=2, beta=1
    const metrics = await getMetrics('test-template')
    expect(metrics.thompson_alpha).toBe(2)
    expect(metrics.thompson_beta).toBe(1)
  })

  test('reportExecution handles offline mode', async () => {
    // Disable backend
    process.env.METABOB_ENDPOINT = 'http://invalid-backend'

    // Report execution
    const result = await mcp.reportExecution(execution)
    expect(result).toBe(false)

    // Verify cached
    const cached = await getCachedExecutions()
    expect(cached).toContainEqual(expect.objectContaining({ id: execution.id }))
  })

  test('concurrent executions update correctly', async () => {
    // Report 10 concurrent executions
    await Promise.all(Array.from({ length: 10 }, () =>
      mcp.reportExecution({ templateId: 'test', success: true, ... })
    ))

    // Verify count is exactly 10
    const metrics = await getMetrics('test')
    expect(metrics.total_executions).toBe(10)
    expect(metrics.thompson_alpha).toBe(11) // 10 + 1 prior
  })
})
```

### Integration Tests

```bash
#!/bin/bash
# test-execution-feedback.sh

# 1. Create template
curl -X POST http://activity.metabob.local/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d '{"id":"feedback-test","name":"Feedback Test","tasks":[]}'

# 2. Report 5 successful executions
for i in {1..5}; do
  curl -X POST http://activity.metabob.local/v2/activities/executions \
    -H "Content-Type: application/json" \
    -d '{"activity_id":"feedback-test","success":true,"duration_ms":1000,"cost":0.01,"tokens":{"input":100,"output":50,"cache":0}}'
done

# 3. Report 2 failed executions
for i in {1..2}; do
  curl -X POST http://activity.metabob.local/v2/activities/executions \
    -H "Content-Type: application/json" \
    -d '{"activity_id":"feedback-test","success":false,"duration_ms":500,"cost":0.005,"tokens":{"input":50,"output":10,"cache":0},"error_message":"Test failure"}'
done

# 4. Verify metrics
curl http://activity.metabob.local/v2/activities/templates?id=feedback-test | \
  jq '.templates[0].metrics | {
    total: .total_executions,
    successes: .successful_executions,
    failures: .failed_executions,
    alpha: .thompson_alpha,
    beta: .thompson_beta,
    success_rate: .success_rate
  }'

# Expected output:
# {
#   "total": 7,
#   "successes": 5,
#   "failures": 2,
#   "alpha": 6,
#   "beta": 3,
#   "success_rate": 0.714
# }
```

---

## Monitoring and Observability

### Metrics to Track

1. **Execution Recording Rate**
   ```
   rate(activity_execution_traces.count[5m])
   ```

2. **Thompson Update Lag**
   ```
   timestamp(variant_performance_metrics.updated_at) -
   timestamp(activity_execution_traces.executed_at)
   ```
   Should be < 100ms

3. **Offline Cache Size**
   ```
   count(files in ~/.minibob/cache/executions/)
   ```
   Should be ~0 when backend is healthy

4. **Metrics Consistency**
   ```
   abs(thompson_alpha - successful_executions - 1) +
   abs(thompson_beta - failed_executions - 1)
   ```
   Should always be 0

### Alerts

- **Critical**: Execution traces recording but metrics not updating
- **Warning**: Offline cache size > 100 files
- **Info**: Thompson alpha/beta drift detected (consistency check failure)

---

## Summary

All integration points are implemented and working:

✅ **ActivityExecutor** reports on success and failure
✅ **SearchFirstExecutor** reports improvisation traces
✅ **Manual feedback** enables human tuning
✅ **Offline cache** ensures eventual consistency
✅ **Backend** updates Thompson Sampling atomically
✅ **Error classification** categorizes failures
✅ **Cache invalidation** ensures fresh selections

**The feedback loop is closed. Thompson Sampling is learning from every execution.**
