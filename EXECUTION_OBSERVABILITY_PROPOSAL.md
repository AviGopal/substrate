# Activity Execution Observability Proposal

**Problem**: Can't see what's happening at each stage of activity execution  
**Solution**: Structured stage logging with correlation IDs and progress markers

---

## Current State (Evidence)

**What exists**:
- `log.info("started activity execution via MCP")` in activity.ts
- `log.info("created activity")` in activity.ts  
- `log.info("completed activity")` in activity.ts
- Various debug logs scattered throughout

**Problems**:
1. **No stage markers** - Can't grep for "Position 2: template loading"
2. **Inconsistent patterns** - Hard to build automated validators
3. **Missing correlation** - Can't trace single execution through all stages
4. **No progress indication** - Don't know where execution is stuck
5. **Mixed log levels** - Critical stages use debug instead of info

---

## Proposal: Structured Stage Logging

### Key Principles

1. **Every stage has ENTER and EXIT logs**
2. **Consistent format** for automated parsing
3. **Correlation ID** threads through entire execution
4. **Progress percentage** shows completion
5. **Timing information** for performance analysis
6. **Error context** at every stage boundary

### Log Format

```
[STAGE] stage_name | correlationId | progress% | action | context
```

**Example**:
```
[STAGE:01] activity-invocation | exec_abc123 | 0% | ENTER | templateId=my-template
[STAGE:01] activity-invocation | exec_abc123 | 10% | EXIT | duration=50ms success=true
[STAGE:02] template-loading | exec_abc123 | 10% | ENTER | templateId=my-template
[STAGE:02] template-loading | exec_abc123 | 20% | EXIT | duration=100ms cached=false
```

---

## Implementation: Add Stage Markers to Each Component

### Stage 1: Activity Tool Invocation
**File**: `src/tool/activity.ts`

```typescript
// ENTER log
log.info("[STAGE:01] activity-invocation | ENTER", {
  correlationId: executionId,
  progress: "0%",
  templateId,
  variables: Object.keys(params.variables || {}),
  reason: params.reason,
  sessionId: ctx.sessionID
})

try {
  // ... existing execution logic ...
  
  // EXIT log (success)
  log.info("[STAGE:01] activity-invocation | EXIT", {
    correlationId: executionId,
    progress: "10%",
    success: true,
    duration: Date.now() - startTime
  })
} catch (error) {
  // EXIT log (failure)
  log.error("[STAGE:01] activity-invocation | EXIT", {
    correlationId: executionId,
    progress: "0%",
    success: false,
    error: error.message,
    duration: Date.now() - startTime
  })
  throw error
}
```

### Stage 2: Template Loading
**File**: `src/session/activity-template-repository.ts` or `src/session/template-loader.ts`

```typescript
export async function get(id: string, options?: ...): Promise<...> {
  const correlationId = options?.correlationId || "unknown"
  const startTime = Date.now()
  
  log.info("[STAGE:02] template-loading | ENTER", {
    correlationId,
    progress: "10%",
    templateId: id,
    skipCache: options?.skipCache,
    sessionId: options?.sessionID
  })

  try {
    const result = await TemplateLoader.load(id, { skipCache }, sessionID)
    
    log.info("[STAGE:02] template-loading | EXIT", {
      correlationId,
      progress: "20%",
      success: true,
      cached: result.cached,
      source: result.source,
      taskCount: result.template?.tasks.length,
      duration: Date.now() - startTime
    })
    
    return result.template
  } catch (error) {
    log.error("[STAGE:02] template-loading | EXIT", {
      correlationId,
      progress: "10%",
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    })
    throw error
  }
}
```

### Stage 3: Activity Initialization
**File**: `src/session/activity.ts`

```typescript
export async function create(options: CreateOptions): Promise<Info> {
  const correlationId = options.correlationId || Identifier.generate("exec")
  const startTime = Date.now()
  
  log.info("[STAGE:03] activity-initialization | ENTER", {
    correlationId,
    progress: "20%",
    directory: options.directory,
    hasIntent: !!options.intent,
    templateId: options.templateId
  })

  const activity: Info = {
    id: Identifier.generate("act"),
    // ... other fields ...
    metadata: {
      ...options.metadata,
      correlationId  // Store for downstream stages
    }
  }

  await Storage.write(["activity-execution", projectId, activity.id], activity)

  log.info("[STAGE:03] activity-initialization | EXIT", {
    correlationId,
    progress: "30%",
    success: true,
    activityId: activity.id,
    duration: Date.now() - startTime
  })

  return activity
}
```

### Stage 4: Session Creation
**File**: `src/session/index.ts`

```typescript
export async function create(options: CreateOptions): Promise<string> {
  const correlationId = options.correlationId || "unknown"
  const startTime = Date.now()
  
  log.info("[STAGE:04] session-creation | ENTER", {
    correlationId,
    progress: "30%",
    taskId: options.taskId,
    activityId: options.activityId
  })

  const sessionId = Identifier.generate("ses")
  
  // ... session creation logic ...

  log.info("[STAGE:04] session-creation | EXIT", {
    correlationId,
    progress: "40%",
    success: true,
    sessionId,
    duration: Date.now() - startTime
  })

  return sessionId
}
```

### Stage 5: Task Execution
**File**: `src/session/template-executor.ts`

```typescript
async function executeTask(task: Task, context: ExecutionContext): Promise<...> {
  const correlationId = context.correlationId || "unknown"
  const startTime = Date.now()
  
  log.info("[STAGE:05] task-execution | ENTER", {
    correlationId,
    progress: `${context.taskIndex / context.totalTasks * 50 + 40}%`,  // 40-90%
    taskId: task.id,
    taskIndex: context.taskIndex,
    totalTasks: context.totalTasks,
    agent: task.agent
  })

  try {
    // ... task execution logic ...
    
    log.info("[STAGE:05] task-execution | EXIT", {
      correlationId,
      progress: `${(context.taskIndex + 1) / context.totalTasks * 50 + 40}%`,
      success: true,
      taskId: task.id,
      attempts: result.attempts,
      duration: Date.now() - startTime,
      cost: result.cost,
      tokens: result.tokens
    })
    
    return result
  } catch (error) {
    log.error("[STAGE:05] task-execution | EXIT", {
      correlationId,
      progress: `${context.taskIndex / context.totalTasks * 50 + 40}%`,
      success: false,
      taskId: task.id,
      error: error.message,
      duration: Date.now() - startTime
    })
    throw error
  }
}
```

### Stage 6: Activity Completion
**File**: `src/tool/activity.ts` (at the end)

```typescript
// After all tasks complete
log.info("[STAGE:06] activity-completion | ENTER", {
  correlationId: executionId,
  progress: "90%",
  activityId: template.id,
  taskCount: taskResults.length,
  overallSuccess
})

try {
  // Record outcome, update storage, etc.
  
  log.info("[STAGE:06] activity-completion | EXIT", {
    correlationId: executionId,
    progress: "100%",
    success: true,
    totalDuration,
    totalCost,
    totalTokens,
    taskResults: taskResults.map(t => ({ id: t.taskId, status: t.status }))
  })
} catch (error) {
  log.error("[STAGE:06] activity-completion | EXIT", {
    correlationId: executionId,
    progress: "90%",
    success: false,
    error: error.message
  })
  throw error
}
```

---

## Usage: Automated Validation

With this structure, validation becomes trivial:

```typescript
// validate-activity-execution-v2.ts

function validateExecution(correlationId: string, logLines: string[]): ValidationReport {
  const stages = [
    { id: "01", name: "activity-invocation", enterPattern: /\[STAGE:01\].*ENTER.*exec_abc123/ },
    { id: "02", name: "template-loading", enterPattern: /\[STAGE:02\].*ENTER.*exec_abc123/ },
    { id: "03", name: "activity-initialization", enterPattern: /\[STAGE:03\].*ENTER.*exec_abc123/ },
    { id: "04", name: "session-creation", enterPattern: /\[STAGE:04\].*ENTER.*exec_abc123/ },
    { id: "05", name: "task-execution", enterPattern: /\[STAGE:05\].*ENTER.*exec_abc123/ },
    { id: "06", name: "activity-completion", enterPattern: /\[STAGE:06\].*ENTER.*exec_abc123/ },
  ]

  for (const stage of stages) {
    const enterLog = logLines.find(line => stage.enterPattern.test(line))
    const exitLog = logLines.find(line => 
      new RegExp(`\\[STAGE:${stage.id}\\].*EXIT.*${correlationId}`).test(line)
    )

    if (!enterLog) {
      return {
        breakPoint: stage,
        reason: `Stage ${stage.id} never started (no ENTER log)`
      }
    }

    if (!exitLog) {
      return {
        breakPoint: stage,
        reason: `Stage ${stage.id} started but never completed (no EXIT log)`
      }
    }

    // Parse duration, progress, etc. for analysis
  }

  return { success: true }
}
```

---

## Benefits

### 1. **Instant Break Point Detection**
```bash
$ grep "\[STAGE:" activity.log | tail -1
[STAGE:03] activity-initialization | EXIT | exec_abc123 | 30% | success=false

# Immediately know: Execution broke during stage 3
```

### 2. **Progress Tracking**
```bash
$ grep "exec_abc123" activity.log | grep -o "progress: [0-9]*%"
progress: 0%
progress: 10%
progress: 20%
progress: 30%   # <-- Stopped here

# Know exactly how far execution progressed
```

### 3. **Performance Analysis**
```bash
$ grep "EXIT" activity.log | grep "exec_abc123" | jq '.duration'
50
100
150
# <-- Stage 4 never finished

# Identify slow stages
```

### 4. **Correlation Across Systems**
```bash
# Frontend logs
[STAGE:01] activity-invocation | ENTER | exec_abc123

# Backend logs (Metabob CLI)
exec_abc123: Starting template execution

# Can correlate across process boundaries
```

### 5. **Automated Monitoring**
```typescript
// Monitor stuck executions
const inProgress = await detectStuckExecutions()
// Returns: [{ correlationId: "exec_abc123", stuckAt: "stage-03", duration: 300000 }]
```

---

## Alternative: Lightweight "Breadcrumb" Approach

If full structured logging is too heavyweight, add minimal breadcrumbs:

```typescript
// Just add one line at start of each major function
log.info("🔵 activity-tool.execute", { correlationId, templateId })
log.info("🔵 template-loader.load", { correlationId, templateId })
log.info("🔵 activity.create", { correlationId, activityId })
log.info("🔵 session.create", { correlationId, sessionId })
log.info("🔵 executor.executeTask", { correlationId, taskId })
log.info("🟢 activity.complete", { correlationId, success: true })
```

**Validation**:
```bash
$ grep "🔵\|🟢" logs | grep "exec_abc123"
🔵 activity-tool.execute
🔵 template-loader.load
🔵 activity.create
# <-- Missing session.create, so that's where it broke
```

---

## Recommendation: Staged Rollout

**Phase 1**: Add breadcrumb logs (🔵 enter, 🟢 exit, 🔴 error)  
**Phase 2**: Add correlation ID threading  
**Phase 3**: Add progress percentages  
**Phase 4**: Add detailed context and timing  

Start with Phase 1 - takes 30 minutes, provides 80% of the value.

---

## Implementation Checklist

- [ ] Choose approach (full structured vs breadcrumb)
- [ ] Generate correlation ID at entry point (activity tool)
- [ ] Thread correlationId through all function calls
- [ ] Add ENTER logs at start of each stage
- [ ] Add EXIT logs at end (success path)
- [ ] Add ERROR logs at end (failure path)
- [ ] Update validation scripts to use new patterns
- [ ] Test with real execution
- [ ] Verify logs appear and are parseable
- [ ] Document correlation ID flow for debugging

---

## Visual: What Observability Looks Like

### Before (Current State)
```
Started activity execution via MCP
Template loaded
Session created
Task completed
```
**Question**: Which execution? Which task? How long? Where did it break?

### After (With Stage Markers)
```
[STAGE:01] activity-invocation | ENTER | exec_abc123 | 0%
[STAGE:01] activity-invocation | EXIT | exec_abc123 | 10% | ✅ 50ms
[STAGE:02] template-loading | ENTER | exec_abc123 | 10%
[STAGE:02] template-loading | EXIT | exec_abc123 | 20% | ✅ 100ms cached=false
[STAGE:03] activity-initialization | ENTER | exec_abc123 | 20%
[STAGE:03] activity-initialization | ERROR | exec_abc123 | 20% | ❌ Backend schema mismatch
```
**Answer**: exec_abc123 broke at stage 3 (initialization) due to schema mismatch, after 150ms total

---

## Conclusion

**Observability = External Evidence**

By adding structured stage logging, we make the system **self-documenting** through logs. No need to guess what happened - the logs tell us:
- Which stage
- When (timestamp)
- Duration
- Success/failure
- Error context
- Correlation across stages

This is **algorithmic debugging** - the system provides the evidence we need to validate itself.
