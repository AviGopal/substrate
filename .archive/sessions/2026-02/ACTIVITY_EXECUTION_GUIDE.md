# Activity Execution - What Actually Needs to Happen

**Status**: Backend works. OpenCode needs testing with real execution.

---

## What We've Proven Works

### Backend API (All endpoints tested)
1. GET /v2/activities/templates → Returns 27 activities
2. GET /v2/activities/templates/{id} → Returns template details
3. POST /v2/activities/record/start → Starts execution recording
4. POST /v2/activities/record/step → Records task completion
5. POST /v2/activities/record/complete → Completes execution

**Evidence**: `test-complete-flow.sh` executed successfully with all 4 tasks recorded.

---

## What the activity() Tool Must Do

When an agent calls:
```typescript
activity({
  activityId: "refactor-5fccfc17",
  variables: { scope: "entire repo", mode: "dryRun" },
  reason: "Test jiggle activity"
})
```

The tool must:

### 1. Fetch Template
```typescript
const template = await TemplateRepository.get("refactor-5fccfc17")
// This now works - we fixed the endpoint
```

### 2. Start Execution Recording
```typescript
const executionId = generateId()
await recordStart({
  template_id: "refactor-5fccfc17",
  variables: { scope: "entire repo", mode: "dryRun" },
  session_id: ctx.sessionID,
  execution_id: executionId
})
```

### 3. Execute Each Task
For each of the 4 tasks:
```typescript
const task = template.taskSteps[i]

// Interpolate variables in prompt
const prompt = interpolate(task.prompt.template, variables)
// e.g., "{{scope}}" becomes "entire repo"

// Call agent to execute the task
const result = await executeTask(prompt)

// Record the result
await recordStep({
  execution_id: executionId,
  step_order: i + 1,
  success: result.success,
  duration_ms: result.duration,
  cost: result.cost,
  tokens: result.tokens
})
```

### 4. Complete Execution
```typescript
await recordComplete({
  execution_id: executionId,
  success: allTasksSucceeded,
  duration_ms: totalDuration,
  cost: totalCost,
  tokens: totalTokens,
  outcome: "all_tasks_completed"
})
```

---

## Error We Found and Fixed

**Error 4: Wrong field names in complete request**

**Before**:
```json
{
  "total_duration_ms": 2000,
  "total_cost": 0.02,
  "total_tokens": 800
}
```

**After**:
```json
{
  "duration_ms": 2000,
  "cost": 0.02,
  "tokens": 800,
  "outcome": "completed_successfully"
}
```

Status: 422 → 200

---

## To Actually Test the Activity Tool

Need to run OpenCode with the rebuilt binary and execute:

```bash
# In OpenCode session
activity({
  activityId: "refactor-5fccfc17",
  variables: {
    scope: "entire repo",
    recentDays: 30,
    mediumDays: 90,
    obsoleteDays: 180,
    mode: "dryRun",
    archiveInsteadOfDelete: true
  },
  reason: "Test jiggle activity execution"
})
```

Expected result:
- Tool fetches template (works - endpoint fixed)
- Tool starts recording (works - API tested)
- Tool executes 4 tasks sequentially:
  1. analyze-docs-by-date
  2. percolate-content  
  3. delete-obsolete-docs
  4. create-jiggle-summary
- Tool records each step (works - API tested)
- Tool completes execution (works - API tested)
- Returns result to agent

**If this fails, we'll get the actual error from the agent.**

---

## Summary

Errors Fixed: 4
- Database empty → Registered activity
- Wrong variable format → Converted to strings
- Wrong endpoint → Changed to /v2/activities/templates
- Wrong field names → Fixed to duration_ms, cost, tokens, outcome

Backend Proven: 100% working
OpenCode Code: Fixed and rebuilt
Remaining: Actual execution test with agent

**No more speculation. Run it and capture the error.**
