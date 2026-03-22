# MiniBob Self-Learning Implementation Plan

## Problem Statement
MiniBob GoalProcessor currently lacks the improvisation/self-learning mechanism:
- When recommended activities fail, it retries the same activity
- No fallback to alternative recommendations
- No on-the-fly activity creation
- No execution-to-template conversion

## Root Cause Analysis
1. **GoalProcessor.executeGoal()** line 284-367:
   - Gets recommendations from backend
   - Executes top recommendation
   - If fails, continues loop but gets **same recommendation** again
   - No improvisation logic

2. **MCPActivityBridge.createActivity()** exists but is **never called**

3. **Backend missing `/v2/activities/create-goal-seeking` endpoint**

## Solution Architecture

### Phase 1: Add Improvisation to GoalProcessor
```typescript
// In goal-processor.ts executeGoal() loop:

if (execution.status === "failed") {
  console.log("[GoalProcessor] Activity failed, attempting improvisation")
  
  // Try to create a new activity tailored to this specific goal
  const newTemplate = await MCPActivityBridge.createActivity({
    goalDescription: goal.intent,
    templateName: `improvised-${goal.type}-${Date.now()}`,
    category: goal.type === "other" ? "feature" : goal.type,
    variables: goal.context,
    constraints: {
      maxTasks: 5,
      maxCost: maxCost - totalCost,
      preferComposition: true,
    }
  })
  
  // Execute the newly created template
  // ... (execution logic)
}
```

### Phase 2: Implement Backend Endpoint
```typescript
// In metabob-activity-api/src/routes/activities.ts

router.post("/v2/activities/create-goal-seeking", async (req, res) => {
  const { goal_description, template_name, category, variables, constraints } = req.body
  
  // 1. Use LLM to decompose goal into tasks
  // 2. Generate activity template JSON
  // 3. Register template in SurrealDB
  // 4. Initialize Thompson Sampling (alpha=1, beta=1)
  // 5. Return template_id
})
```

### Phase 3: Record Executions for Learning
- Activity executions already recorded via `/v2/activities/executions`
- Thompson Sampling already updates based on success/failure
- New templates automatically enter the learning loop

## Expected Behavior After Fix

```
User: "Trace minibob execution paths..."

1. GoalProcessor parses goal → type="infrastructure"
2. Backend recommends "trace-minibob-v1"
3. Execute fails (missing variables)
4. **[NEW]** GoalProcessor calls createActivity():
   - goalDescription: "Trace minibob execution paths..."
   - category: "infrastructure"
   - variables: {files: [...]}
5. Backend generates new template: "improvised-infrastructure-1774090XXX"
6. GoalProcessor executes new template
7. If succeeds → recorded, available for future reuse
8. If fails → recorded failure, try next recommendation
```

## Implementation Steps

1. ✅ Fix goal categorization (add "infrastructure" and "tool" types) - DONE
2. ⬜ Add improvisation logic to GoalProcessor
3. ⬜ Implement /v2/activities/create-goal-seeking endpoint
4. ⬜ Test self-learning loop end-to-end
5. ⬜ Validate Thompson Sampling learns from created activities

## Files to Modify

1. `repos/minibob/src/goal-processor.ts` - Add improvisation after failure
2. `repos/metabob-activity-api/src/routes/activities.ts` - Add create-goal-seeking endpoint
3. `repos/metabob-activity-api/src/services/activity-generator.ts` (new) - LLM-based activity generation

## Success Criteria

✅ When recommended activity fails, MiniBob creates new activity
✅ Created activity is executed and recorded
✅ Future similar goals reuse the created activity
✅ Thompson Sampling learns from execution results
✅ Self-healing: system bootstraps new capabilities autonomously
