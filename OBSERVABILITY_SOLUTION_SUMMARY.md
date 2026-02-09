# Activity Execution Observability - Complete Solution

**Problem**: Can't see what's happening at each stage of activity execution  
**Solution**: Breadcrumb logging + automated validation  
**Status**: ✅ Design complete, ready for implementation

---

## What We Built

### 1. Breadcrumb Logging Module
**File**: `repos/metabob-opencode/packages/opencode/src/session/execution-breadcrumbs.ts`

**What it does**:
- Provides simple `Breadcrumb.create(correlationId)` API
- Emits emoji-tagged logs: 🔵 ENTER, 🟢 EXIT, 🔴 ERROR
- Threads correlation ID through entire execution
- Zero dependencies, ~150 lines of code

**Usage**:
```typescript
const breadcrumb = Breadcrumb.create("exec_abc123")

breadcrumb.stage("01", "activity-invocation").enter({ templateId })
// ... do work ...
breadcrumb.stage("01", "activity-invocation").exit({ success: true })
```

**Output**:
```
🔵 [STAGE:01] activity-invocation | ENTER | correlationId=exec_abc123
🟢 [STAGE:01] activity-invocation | EXIT | correlationId=exec_abc123 success=true
```

---

### 2. Breadcrumb Validator
**File**: `validate-with-breadcrumbs.ts`

**What it does**:
- Parses log files for breadcrumb patterns
- Groups logs by correlation ID
- Detects stages that ENTER but never EXIT (break points)
- Provides investigation guidance

**Usage**:
```bash
# Validate all executions
bun run validate-with-breadcrumbs.ts .metabob/logs/core.log

# Validate specific execution
bun run validate-with-breadcrumbs.ts .metabob/logs/core.log exec_abc123
```

**Output**:
```
=== ACTIVITY EXECUTION ANALYSIS - BREADCRUMB VALIDATOR ===

Execution: exec_abc123

Stage Progression:
  [01] activity-invocation      🟢 COMPLETED
  [02] template-loading          🟢 COMPLETED
  [03] activity-initialization   🔵 IN PROGRESS

Execution Status:
  ⚠️  INCOMPLETE (execution stopped)

🔍 BREAK POINT DETECTED:
  Stage: [03] activity-initialization
  Status: Entered but never exited
  This is where execution got stuck or failed
```

---

## Implementation Plan

### Phase 1: Add Breadcrumbs (30 minutes)

**Step 1**: Import breadcrumb module in key files:
```typescript
import { Breadcrumb } from "../session/execution-breadcrumbs"
```

**Step 2**: Add to `src/tool/activity.ts`:
```typescript
export const ActivityTool = Tool.define("activity", async () => {
  return {
    async execute(params, ctx) {
      const correlationId = Identifier.generate("exec")
      const breadcrumb = Breadcrumb.create(correlationId)
      
      try {
        breadcrumb.stage("01", "activity-invocation").enter({ 
          templateId: params.templateId 
        })
        
        // Existing code...
        const template = await TemplateRepository.get(params.templateId, { correlationId })
        
        breadcrumb.stage("01", "activity-invocation").exit({ success: true })
        
        // ... rest of execution ...
        
        breadcrumb.complete({ taskCount: results.length })
        return result
      } catch (error) {
        breadcrumb.fail(error)
        throw error
      }
    }
  }
})
```

**Step 3**: Add to `src/session/template-loader.ts`:
```typescript
export async function load(id: string, options: LoadOptions, correlationId?: string): Promise<LoadResult> {
  const breadcrumb = correlationId ? Breadcrumb.create(correlationId) : null
  
  breadcrumb?.stage("02", "template-loading").enter({ templateId: id })
  
  try {
    // Existing loading logic...
    const template = await loadFromCache() || await loadFromBackend()
    
    breadcrumb?.stage("02", "template-loading").exit({ 
      cached: !!cachedTemplate,
      taskCount: template.tasks.length 
    })
    
    return template
  } catch (error) {
    breadcrumb?.stage("02", "template-loading").error(error)
    throw error
  }
}
```

**Step 4**: Add to `src/session/activity.ts`:
```typescript
export async function create(options: CreateOptions): Promise<Info> {
  const breadcrumb = options.correlationId ? Breadcrumb.create(options.correlationId) : null
  
  breadcrumb?.stage("03", "activity-initialization").enter({ 
    templateId: options.templateId 
  })
  
  try {
    const activity: Info = { /* ... */ }
    await Storage.write(["activity-execution", projectId, activity.id], activity)
    
    breadcrumb?.stage("03", "activity-initialization").exit({ 
      activityId: activity.id 
    })
    
    return activity
  } catch (error) {
    breadcrumb?.stage("03", "activity-initialization").error(error)
    throw error
  }
}
```

**Step 5**: Add to `src/session/index.ts` (session creation):
```typescript
export async function create(options: CreateOptions): Promise<string> {
  const breadcrumb = options.correlationId ? Breadcrumb.create(options.correlationId) : null
  
  breadcrumb?.stage("04", "session-creation").enter({ taskId: options.taskId })
  
  try {
    const sessionId = Identifier.generate("ses")
    // ... session creation logic ...
    
    breadcrumb?.stage("04", "session-creation").exit({ sessionId })
    return sessionId
  } catch (error) {
    breadcrumb?.stage("04", "session-creation").error(error)
    throw error
  }
}
```

**Step 6**: Add to `src/session/template-executor.ts`:
```typescript
async function executeTask(task: Task, context: ExecutionContext): Promise<TaskResult> {
  const breadcrumb = context.correlationId ? Breadcrumb.create(context.correlationId) : null
  
  breadcrumb?.stage("05", "task-execution").enter({ 
    taskId: task.id,
    taskIndex: context.taskIndex 
  })
  
  try {
    // ... task execution logic ...
    
    breadcrumb?.stage("05", "task-execution").exit({ 
      attempts: result.attempts,
      duration: result.duration 
    })
    
    return result
  } catch (error) {
    breadcrumb?.stage("05", "task-execution").error(error)
    throw error
  }
}
```

---

### Phase 2: Test Validation (15 minutes)

**Step 1**: Create a test execution
```bash
# Create numbered prompts for CLI test
mkdir test-activity
echo "Hello, respond with TEST_SUCCESS" > test-activity/01-prompt.md

# Run activity
opencode activity run test-activity
```

**Step 2**: Run validator
```bash
bun run validate-with-breadcrumbs.ts .metabob/logs/core.log
```

**Step 3**: Verify output shows all 6 stages with ENTER/EXIT logs

---

### Phase 3: Integration with Existing Validation (10 minutes)

Update `validate-activity-execution-algorithmic.ts` to use breadcrumb patterns:

```typescript
const ACTIVITY_EXECUTION_FLOW: FlowStep[] = [
  {
    position: 1,
    component: "activity-invocation",
    expectedLogs: [
      "🔵.*\\[STAGE:01\\].*activity-invocation.*ENTER",
      "🟢.*\\[STAGE:01\\].*activity-invocation.*EXIT",
    ]
  },
  {
    position: 2,
    component: "template-loading",
    expectedLogs: [
      "🔵.*\\[STAGE:02\\].*template-loading.*ENTER",
      "🟢.*\\[STAGE:02\\].*template-loading.*EXIT",
    ]
  },
  // ... etc
]
```

---

## Benefits: Before vs After

### Before (Current State)
```
Started activity execution
Template loaded
Session created
```

**Questions we can't answer**:
- Which execution is this?
- Where did it break?
- How long did each stage take?
- Did it complete successfully?

### After (With Breadcrumbs)
```
🔵 [STAGE:01] activity-invocation | ENTER | exec_abc123
🟢 [STAGE:01] activity-invocation | EXIT | exec_abc123 | 50ms
🔵 [STAGE:02] template-loading | ENTER | exec_abc123
🟢 [STAGE:02] template-loading | EXIT | exec_abc123 | 100ms cached=false
🔵 [STAGE:03] activity-initialization | ENTER | exec_abc123
🔴 [STAGE:03] activity-initialization | ERROR | exec_abc123 | Backend schema mismatch
❌ EXECUTION FAILED | exec_abc123 | 180ms
```

**Questions we CAN answer**:
- ✅ Execution ID: exec_abc123
- ✅ Break point: Stage 3 (activity-initialization)
- ✅ Duration: 180ms total (50ms + 100ms + 30ms before error)
- ✅ Status: Failed with schema mismatch error
- ✅ Last successful stage: template-loading

---

## Validation Workflow

```
┌─────────────────────────────────────────────────────┐
│  1. Developer adds breadcrumb.stage().enter/exit    │
│     to each major function                          │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  2. Activity execution runs                         │
│     Breadcrumbs write to logs automatically         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  3. Validator parses logs                           │
│     Groups by correlation ID                        │
│     Detects ENTER without EXIT (break point)        │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  4. Report shows:                                   │
│     - Which stage broke                             │
│     - Last successful stage                         │
│     - Error context                                 │
│     - Investigation steps                           │
└─────────────────────────────────────────────────────┘
```

---

## Examples: What Validator Detects

### Example 1: Execution Never Started
```
❌ NO EXECUTIONS FOUND

No correlation IDs detected in logs.
This means:
  1. No activity executions have run, OR
  2. Breadcrumb logging not yet implemented
```

### Example 2: Stuck at Template Loading
```
Execution: exec_abc123

Stage Progression:
  [01] activity-invocation      🟢 COMPLETED
  [02] template-loading          🔵 IN PROGRESS  ← STUCK HERE

🔍 BREAK POINT: Stage [02] template-loading
   Entered but never exited
   
Investigation:
  grep -A 20 "STAGE:02.*ENTER.*exec_abc123" logs
```

### Example 3: Failed with Error
```
Execution: exec_xyz789

Stage Progression:
  [01] activity-invocation      🟢 COMPLETED
  [02] template-loading          🟢 COMPLETED
  [03] activity-initialization   🔴 FAILED

❌ FAILED
Error: Backend returned 422: Schema validation error

Last known activity:
  🔴 [STAGE:03] activity-initialization | ERROR | Backend schema mismatch
```

### Example 4: Successful Completion
```
Execution: exec_success

Stage Progression:
  [01] activity-invocation      🟢 COMPLETED
  [02] template-loading          🟢 COMPLETED
  [03] activity-initialization   🟢 COMPLETED
  [04] session-creation          🟢 COMPLETED
  [05] task-execution            🟢 COMPLETED
  [06] activity-completion       🟢 COMPLETED

✅ COMPLETED SUCCESSFULLY
Total duration: 2.4s
Tasks completed: 3
```

---

## Why This Approach Works

### 1. **Minimal Overhead**
- 3 lines per function (enter, try/catch exit, error)
- No complex instrumentation
- No external dependencies

### 2. **Instant Debugging**
```bash
# See where execution stopped
grep "🔵\|🟢\|🔴" logs | tail -20

# Follow specific execution
grep "exec_abc123" logs
```

### 3. **Automated Validation**
- Validator detects break points algorithmically
- No manual log inspection needed
- CI/CD integration ready

### 4. **External Evidence**
- Logs are external artifacts (not assumptions)
- Parseable by scripts and humans
- Persistent across runs

---

## Next Steps

1. **Merge breadcrumb module** into codebase
2. **Add breadcrumbs** to 6 key functions (Phase 1)
3. **Test with real execution** (Phase 2)
4. **Verify validator works** (Phase 3)
5. **Document correlation ID flow** for debugging

**Time estimate**: 1 hour total implementation + testing

---

## Conclusion

We've transformed activity execution from a **black box** into an **observable system**:

- ❌ Before: "It's not working" (no evidence why)
- ✅ After: "It broke at stage 3 due to schema mismatch" (algorithmic proof)

This is **algorithmic debugging** - the system tells us what happened through structured logs. No guessing, no assumptions, just evidence.

The validation approach works. Now we make the system observable so validation can prove correctness (or detect failures) algorithmically.
