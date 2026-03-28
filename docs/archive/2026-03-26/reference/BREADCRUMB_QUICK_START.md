# Breadcrumb Logging - Quick Start Guide

**Goal**: Make every stage of activity execution visible through simple log markers

---

## The Pattern (Copy-Paste This)

```typescript
import { Breadcrumb } from "../session/execution-breadcrumbs"

async function yourFunction(args, correlationId?: string) {
  const breadcrumb = correlationId ? Breadcrumb.create(correlationId) : null
  
  breadcrumb?.stage("NN", "your-stage-name").enter({ /* context */ })
  
  try {
    // YOUR EXISTING CODE HERE
    const result = await doWork()
    
    breadcrumb?.stage("NN", "your-stage-name").exit({ success: true })
    return result
  } catch (error) {
    breadcrumb?.stage("NN", "your-stage-name").error(error)
    throw error
  }
}
```

Replace:
- `NN` = Stage number (01, 02, 03, etc.)
- `your-stage-name` = Descriptive name (e.g., "template-loading")
- `{ /* context */ }` = Useful debug info (templateId, taskId, etc.)

---

## The 6 Stages

| Stage | Name | File | Function |
|-------|------|------|----------|
| 01 | `activity-invocation` | `src/tool/activity.ts` | `ActivityTool.execute()` |
| 02 | `template-loading` | `src/session/template-loader.ts` | `load()` |
| 03 | `activity-initialization` | `src/session/activity.ts` | `create()` |
| 04 | `session-creation` | `src/session/index.ts` | `create()` |
| 05 | `task-execution` | `src/session/template-executor.ts` | `executeTask()` |
| 06 | `activity-completion` | `src/tool/activity.ts` | End of `execute()` |

---

## How to Add (5 Steps)

### 1. Import the module
```typescript
import { Breadcrumb } from "../session/execution-breadcrumbs"
```

### 2. Accept correlationId parameter
```typescript
async function myFunction(options: Options & { correlationId?: string })
```

### 3. Create breadcrumb tracker
```typescript
const breadcrumb = options.correlationId ? Breadcrumb.create(options.correlationId) : null
```

### 4. Add ENTER at start
```typescript
breadcrumb?.stage("01", "my-stage").enter({ templateId: options.templateId })
```

### 5. Add EXIT/ERROR at end
```typescript
try {
  // work
  breadcrumb?.stage("01", "my-stage").exit({ success: true })
} catch (error) {
  breadcrumb?.stage("01", "my-stage").error(error)
  throw error
}
```

---

## Threading Correlation ID

**Start** (in activity tool):
```typescript
const correlationId = Identifier.generate("exec")
const breadcrumb = Breadcrumb.create(correlationId)
```

**Pass to next function**:
```typescript
const template = await TemplateRepository.get(templateId, { correlationId })
```

**Receive in next function**:
```typescript
export async function get(id: string, options?: { correlationId?: string }) {
  const breadcrumb = options?.correlationId ? Breadcrumb.create(options.correlationId) : null
  // ...
}
```

**Rule**: Every function that's part of execution flow should accept `correlationId` parameter

---

## What Logs Look Like

### Before Adding Breadcrumbs
```
Loading template my-template
Template loaded
Creating activity
```

### After Adding Breadcrumbs
```
🔵 [STAGE:01] activity-invocation | ENTER | correlationId=exec_abc123 templateId=my-template
🟢 [STAGE:01] activity-invocation | EXIT | correlationId=exec_abc123 elapsed=50
🔵 [STAGE:02] template-loading | ENTER | correlationId=exec_abc123 templateId=my-template
🟢 [STAGE:02] template-loading | EXIT | correlationId=exec_abc123 elapsed=150 cached=false
```

---

## How to Validate

### Option 1: Manual Grep
```bash
# See all stages for one execution
grep "exec_abc123" .metabob/logs/core.log

# See where it stopped
grep "🔵\|🟢\|🔴" .metabob/logs/core.log | grep "exec_abc123" | tail -5
```

### Option 2: Automated Validator
```bash
# Run validator
bun run validate-with-breadcrumbs.ts .metabob/logs/core.log

# Output shows break point automatically:
🔍 BREAK POINT: Stage [03] activity-initialization
   Entered but never exited
```

---

## Common Mistakes

### ❌ Forgot to pass correlationId
```typescript
// BAD: Lost correlation
const template = await TemplateRepository.get(templateId)

// GOOD: Preserved correlation
const template = await TemplateRepository.get(templateId, { correlationId })
```

### ❌ Only added ENTER, no EXIT
```typescript
// BAD: Validator will think it's stuck
breadcrumb?.stage("01", "my-stage").enter()
return result  // NO EXIT LOG

// GOOD: Clear completion
breadcrumb?.stage("01", "my-stage").enter()
const result = doWork()
breadcrumb?.stage("01", "my-stage").exit()
return result
```

### ❌ Wrong stage name in EXIT
```typescript
// BAD: Parser won't match
breadcrumb?.stage("01", "template-loading").enter()
breadcrumb?.stage("01", "template-load").exit()  // Different name!

// GOOD: Exact match
breadcrumb?.stage("01", "template-loading").enter()
breadcrumb?.stage("01", "template-loading").exit()
```

---

## Testing Your Changes

### 1. Add breadcrumbs to one function
```typescript
// Example: src/session/template-loader.ts
export async function load(id: string, options?: { correlationId?: string }) {
  const breadcrumb = options?.correlationId ? Breadcrumb.create(options.correlationId) : null
  breadcrumb?.stage("02", "template-loading").enter({ templateId: id })
  
  try {
    const result = await loadTemplate(id)
    breadcrumb?.stage("02", "template-loading").exit({ taskCount: result.tasks.length })
    return result
  } catch (error) {
    breadcrumb?.stage("02", "template-loading").error(error)
    throw error
  }
}
```

### 2. Run a test execution
```bash
# Trigger any activity execution
opencode activity run test-prompts/
```

### 3. Check logs
```bash
# Look for your breadcrumb
grep "template-loading" .metabob/logs/core.log | tail -5

# Should see:
# 🔵 [STAGE:02] template-loading | ENTER
# 🟢 [STAGE:02] template-loading | EXIT
```

### 4. Verify validator detects it
```bash
bun run validate-with-breadcrumbs.ts .metabob/logs/core.log

# Should show:
# [02] template-loading    🟢 COMPLETED
```

---

## Real Example: Activity Tool

```typescript
// src/tool/activity.ts
export const ActivityTool = Tool.define("activity", async () => {
  return {
    description: "Execute activity template",
    parameters: z.object({
      templateId: z.string(),
      variables: z.record(z.unknown()).optional(),
      reason: z.string(),
    }),
    
    async execute(params, ctx) {
      // STEP 1: Generate correlation ID
      const correlationId = Identifier.generate("exec")
      const breadcrumb = Breadcrumb.create(correlationId)
      
      try {
        // STEP 2: Stage 1 - Tool invocation
        breadcrumb.stage("01", "activity-invocation").enter({ 
          templateId: params.templateId,
          sessionId: ctx.sessionID
        })
        
        // STEP 3: Load template (passes correlationId)
        const template = await TemplateRepository.get(params.templateId, { correlationId })
        
        breadcrumb.stage("01", "activity-invocation").exit({ success: true })
        
        // STEP 4: Execute template (internal stages 02-05 happen here)
        const result = await TemplateExecutor.execute({
          templateId: template.id,
          variables: params.variables,
          reason: params.reason,
          correlationId  // Pass through
        })
        
        // STEP 5: Stage 6 - Completion
        breadcrumb.stage("06", "activity-completion").enter({ 
          taskCount: result.tasks.length 
        })
        
        // Save results, etc.
        
        breadcrumb.stage("06", "activity-completion").exit({ 
          success: result.success,
          duration: result.totalDuration 
        })
        
        // STEP 6: Mark overall success
        breadcrumb.complete({ 
          taskCount: result.tasks.length,
          totalCost: result.totalCost 
        })
        
        return formatResult(result)
        
      } catch (error) {
        // STEP 7: Mark overall failure
        breadcrumb.fail(error, { 
          templateId: params.templateId 
        })
        throw error
      }
    }
  }
})
```

---

## Debugging Tips

### "I don't see breadcrumbs in logs"
1. Check: Did you import `Breadcrumb`?
2. Check: Did you pass `correlationId` to functions?
3. Check: Is `breadcrumb` null? (only logs if correlationId provided)

### "Validator says execution never started"
1. Check: Did first function create correlationId?
2. Check: Is correlationId being logged? `grep "correlationId" logs`
3. Check: Looking at correct log file?

### "Validator shows wrong break point"
1. Check: Did you call `.exit()` on success path?
2. Check: Did you call `.error()` in catch block?
3. Check: Stage name matches exactly in enter/exit?

---

## Rollout Strategy

### Week 1: Core Path (Stages 01-03)
- Add breadcrumbs to activity tool, template loader, activity initialization
- Test with simple execution
- Verify validator works

### Week 2: Execution Path (Stages 04-06)
- Add breadcrumbs to session creation, task execution, completion
- Test with multi-task execution
- Verify all stages show up

### Week 3: Error Paths
- Test failure scenarios
- Verify error breadcrumbs appear
- Tune error context information

---

## Summary

**3 Simple Steps:**
1. Import `Breadcrumb`
2. Add `.enter()` at start, `.exit()` at end
3. Pass `correlationId` through calls

**Result:**
- Every execution is traceable
- Break points detected automatically
- No more guessing where execution failed

**Time per function:** 2-5 minutes  
**Total for 6 stages:** 30 minutes  
**Payoff:** Permanent observability
