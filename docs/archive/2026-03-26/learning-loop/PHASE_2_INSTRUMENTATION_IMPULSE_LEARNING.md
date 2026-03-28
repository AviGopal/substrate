# Phase 2 Addendum: Impulse-Driven Context Learning

**Critical Insight from Discussion**: The activity system learns **what context to provide** (via impulses), not just what to do. This is a learning system for context optimization, not just execution tracking.

---

## The Real Goal: Minimize Instructions, Maximize Success

### Traditional Approach (What We're NOT Doing)
```
❌ Build complex plan with all system knowledge
❌ LLM keeps everything in memory
❌ High token costs
❌ Brittle to system changes
❌ Doesn't scale to complex systems
```

### Our Approach (Impulse-Driven Context)
```
✅ Pre-load only relevant context (via impulses)
✅ Task knows just what it needs
✅ Minimal token costs
✅ Learns which impulses → successful outcomes
✅ Hierarchical: complex goal → focused activities → focused tasks
```

---

## What We're Actually Learning

### 1. Context Requirements Discovery
**Question**: What context does a task need to succeed?

**Learning Loop**:
```
Activity Template: "add-feature-complete"
  Task 1: "analyze-codebase"
    Impulses Provided: [codebase-structure, similar-features]
    Outcome: Success ✓
    
  Task 2: "implement-feature"  
    Impulses Provided: [analysis-from-task-1, api-conventions]
    Outcome: Success ✓
    
→ LEARNING: These impulse combinations work!
→ TEMPLATE EVOLUTION: Codify this in template.contextRequirements
```

### 2. Context Sufficiency vs. Excess
**Question**: Are we providing too much or too little context?

**Metrics to Track**:
- **Token Cost per Task**: High → too much context
- **Failure Rate**: High → too little context OR wrong context
- **Success with Minimal Impulses**: Optimal!

**Example**:
```
Version 1: Provide entire codebase (100K tokens) → Success, but expensive
Version 2: Provide only relevant modules (10K tokens) → Success, cheaper!
Version 3: Provide just interfaces (2K tokens) → Failure, too little

→ LEARNING: Version 2 is optimal for this task type
→ COST SAVINGS: 10x reduction in token cost
```

### 3. Impulse → Success Correlation
**Question**: Which impulses are actually useful?

**Analysis**:
```
Impulse: "similar-features"
  Used in: 50 executions
  Success when present: 45/50 (90%)
  Success when absent: 10/30 (33%)
  
→ LEARNING: This impulse is critical for success!
→ ACTION: Always include in template.contextRequirements
```

### 4. Task Decomposition Learning
**Question**: Should this be one big task or multiple small tasks?

**Comparison**:
```
Approach A: Single task "implement-feature" (no impulses)
  Token Cost: 20K
  Success Rate: 50%
  
Approach B: Three tasks with impulse chain
  Task 1: "analyze" → creates impulse "analysis"
  Task 2: "design" → uses "analysis", creates "design"  
  Task 3: "implement" → uses "design"
  Total Token Cost: 8K
  Success Rate: 85%
  
→ LEARNING: Decomposition + impulse chain is better!
→ TEMPLATE EVOLUTION: Split into 3-task pattern
```

---

## Instrumentation Updates Needed

### 1. Capture Impulse Usage Per Task

**CRITICAL ADDITION**: Track which impulses were loaded and whether task succeeded.

```typescript
interface TaskExecutionRecord {
  // ... existing fields ...
  
  // 🆕 IMPULSE TRACKING
  impulses_loaded: Array<{
    impulse_id: string
    impulse_type: string       // "memo", "file", "activityOutput", etc.
    token_count: number         // How much context this added
    was_used: boolean           // Did agent actually reference it?
  }>
  
  impulses_created: Array<{
    impulse_id: string
    impulse_type: string
    token_count: number
    created_for: string[]       // Which downstream tasks need this?
  }>
  
  // 🆕 CONTEXT METRICS
  total_context_tokens: number  // impulses + prompt
  prompt_tokens: number          // just the instruction
  context_ratio: number          // context / total (want this low!)
}
```

**Why This Matters**:
- High context_ratio → too much pre-loaded content
- Low success rate + low context → need more impulses
- High success + low context → optimal!

### 2. Track Context Requirements Evolution

**CRITICAL ADDITION**: Link template.contextRequirements to actual impulse usage.

```typescript
interface ActivityContentRecord {
  // ... existing fields ...
  
  // 🆕 CONTEXT REQUIREMENTS TRACKING
  context_requirements: Array<{
    key: string                   // Variable name (e.g., "codebaseContext")
    impulse_tags: string[]        // What to search for
    impulse_ids_found: string[]   // What was actually provided
    impulse_ids_used: string[]    // What tasks actually used
    required: boolean
    fulfilled: boolean
  }>
  
  // 🆕 MEMORY AGENT ACTIVITY
  memory_agent_session_id: string | null
  memory_agent_impulses_gathered: number
  memory_agent_cost: number
  memory_agent_duration_ms: number
}
```

**Learning Queries**:
```sql
-- Which contextRequirements are critical?
SELECT 
  cr.key,
  AVG(ae.success) as success_rate,
  COUNT(*) as executions
FROM activity_execution ae
JOIN activity_content ac ON ae.execution_id = ac.execution_id
WHERE ac.context_requirements->key = $requirement_key
  AND ac.context_requirements->fulfilled = true
GROUP BY cr.key;

-- Are we over-providing context?
SELECT 
  te.task_id,
  AVG(te.context_ratio) as avg_context_ratio,
  AVG(te.success) as success_rate
FROM task_execution te
GROUP BY te.task_id
HAVING avg_context_ratio > 0.7;  -- More than 70% context vs. instruction
```

### 3. Impulse Chain Analysis

**CRITICAL ADDITION**: Track how impulses flow between tasks.

```typescript
interface ImpulseChain {
  execution_id: string
  
  chain: Array<{
    task_id: string
    task_index: number
    impulses_consumed: string[]  // From previous tasks or memory agent
    impulses_produced: string[]  // Created by this task
    
    // 🆕 LEARNING: Did downstream tasks use what we produced?
    impulses_consumed_by_downstream: Record<string, string[]>
  }>
}
```

**Learning**: 
- Task creates impulse but no downstream tasks use it → wasted computation
- Task needs impulse that wasn't created → missing dependency
- Task chain efficiently passes context → optimal pattern!

---

## Updated Instrumentation Strategy

### Activity Start (Enhanced)

```typescript
async function storeActivityContent(activity, template, variables, reason) {
  // Existing: template, variables, reason
  
  // 🆕 ADD: Context requirements tracking
  const contextRequirements = template.contextRequirements?.map(req => ({
    key: req.key,
    impulse_tags: req.tags,
    impulse_ids_found: activity.impulses
      ? Object.keys(activity.impulses).filter(id => 
          activity.impulses[id].tags?.some(t => req.tags.includes(t))
        )
      : [],
    impulse_ids_used: [],  // Will be filled by task execution
    required: req.required,
    fulfilled: activity.impulses && Object.keys(activity.impulses).length > 0
  })) || []
  
  await fetch(`${API_URL}/v2/activities/content`, {
    method: 'POST',
    body: JSON.stringify({
      execution_id: activity.id,
      variant_id: hashVariant(template, variables),
      activity_id: template.name,
      template_definition: template,
      variable_bindings: variables,
      reason: reason,
      
      // 🆕 ADD: Context tracking
      context_requirements: contextRequirements,
      memory_agent_session_id: activity.memoryAgentSessionId || null,
      memory_agent_impulses_gathered: Object.keys(activity.impulses || {}).length,
      
      initial_state: await captureInitialState(),
      environment: captureEnvironment(),
      started_at: new Date().toISOString()
    })
  })
}
```

### Task Execution (Enhanced)

```typescript
async function updateTaskExecution(executionId, taskId, result) {
  // Existing: status, success, state_delta, metrics
  
  // 🆕 ADD: Impulse usage tracking
  const impulsesLoaded = task.impulseReferences?.map(id => {
    const impulse = activity.impulses[id]
    return {
      impulse_id: id,
      impulse_type: impulse.type,
      token_count: impulse.tokenCount || 0,
      was_used: checkIfUsedInSession(sessionID, id)  // Analyze session messages
    }
  }) || []
  
  const impulsesCreated = detectNewImpulses(
    impulsesBeforeTask, 
    impulsesAfterTask
  )
  
  const totalContextTokens = impulsesLoaded.reduce(
    (sum, imp) => sum + imp.token_count, 
    0
  )
  
  const contextRatio = totalContextTokens / 
    (totalContextTokens + result.tokens.input)
  
  await fetch(`${API_URL}/v2/activities/tasks/${taskExecutionId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      execution_id: executionId,
      task_id: taskId,
      status: result.success ? "success" : "failed",
      success: result.success,
      
      // 🆕 ADD: Impulse tracking
      impulses_loaded: impulsesLoaded,
      impulses_created: impulsesCreated,
      total_context_tokens: totalContextTokens,
      prompt_tokens: result.tokens.input,
      context_ratio: contextRatio,
      
      // Existing fields
      state_delta: computeDelta(stateBefore, stateAfter),
      validation: validationResults,
      duration_ms: result.duration,
      tokens_used: result.tokens,
      cost_usd: result.cost,
      completed_at: new Date().toISOString()
    })
  })
}
```

---

## Learning Queries We Can Now Run

### 1. Optimal Context Size per Task Type

```sql
-- What's the optimal context_ratio for each task type?
SELECT 
  task_id,
  AVG(context_ratio) as avg_context_ratio,
  AVG(success::bool::number()) as success_rate,
  AVG(cost_usd) as avg_cost,
  COUNT(*) as executions
FROM task_execution
GROUP BY task_id
ORDER BY success_rate DESC, avg_cost ASC;
```

**Use**: Identify tasks that succeed with minimal context (efficient) vs. tasks that need heavy context.

### 2. Critical Impulses Detection

```sql
-- Which impulses are most correlated with success?
SELECT 
  impulse_id,
  impulse_type,
  COUNT(*) as times_used,
  AVG(te.success::bool::number()) as success_when_used,
  AVG(te.cost_usd) as avg_cost
FROM task_execution te,
  te.impulses_loaded il
WHERE il.was_used = true
GROUP BY impulse_id, impulse_type
HAVING times_used > 5
ORDER BY success_when_used DESC;
```

**Use**: Discover which impulses are critical for success → codify in contextRequirements.

### 3. Wasted Context Detection

```sql
-- Which impulses are loaded but never used?
SELECT 
  il.impulse_id,
  COUNT(*) as times_loaded,
  SUM((NOT il.was_used)::bool::number()) as times_unused,
  AVG(il.token_count) as avg_tokens_wasted
FROM task_execution te,
  te.impulses_loaded il
WHERE il.was_used = false
GROUP BY il.impulse_id
HAVING times_unused > times_loaded * 0.5  -- Unused >50% of the time
ORDER BY avg_tokens_wasted DESC;
```

**Use**: Remove unnecessary impulses from contextRequirements → reduce cost.

### 4. Impulse Chain Efficiency

```sql
-- Are we creating impulses that downstream tasks actually use?
SELECT 
  creator.task_id as creator_task,
  consumer.task_id as consumer_task,
  ic.impulse_id,
  COUNT(*) as times_created,
  SUM((consumer.impulses_loaded->impulse_id IS NOT NULL)::bool::number()) as times_used,
  AVG(ic.token_count) as avg_token_cost
FROM task_execution creator,
  creator.impulses_created ic
LEFT JOIN task_execution consumer 
  ON consumer.execution_id = creator.execution_id
  AND consumer.task_index > creator.task_index
GROUP BY creator.task_id, consumer.task_id, ic.impulse_id
HAVING times_created > 3
ORDER BY (times_used / times_created) ASC;  -- Least efficient first
```

**Use**: Detect tasks creating impulses that no downstream tasks use → remove or redesign.

---

## Template Evolution Examples

### Example 1: Context Minimization

**Before** (No learning):
```json
{
  "name": "add-feature-complete",
  "tasks": [
    {
      "id": "implement",
      "prompt": "Implement {{featureName}}. Here's the entire codebase: {{codebase}}"
      // Problem: Loads entire codebase (100K tokens), expensive!
    }
  ]
}
```

**After** (Learning-driven):
```json
{
  "name": "add-feature-complete",
  "contextRequirements": [
    {
      "key": "relevantModules",
      "tags": ["module", "related-to:{{featureArea}}"],
      "required": true
      // Learning: Only 10K tokens needed, 90% success rate!
    }
  ],
  "tasks": [
    {
      "id": "implement",
      "prompt": "Implement {{featureName}} using patterns from {{relevantModules}}",
      "impulseReferences": ["relevantModules"]
      // Success: Same success rate, 10x cheaper!
    }
  ]
}
```

**Learning Data**:
- Old approach: 100K tokens, $0.50/execution, 90% success
- New approach: 10K tokens, $0.05/execution, 90% success
- **Result**: 10x cost reduction, same quality!

### Example 2: Impulse Chain Optimization

**Before**:
```json
{
  "tasks": [
    {
      "id": "task-1",
      "prompt": "Analyze the codebase",
      // Creates impulse "analysis" but task-2 doesn't use it!
    },
    {
      "id": "task-2", 
      "prompt": "Implement feature",
      "impulseReferences": []
      // Problem: Doesn't use "analysis" impulse, re-does work!
    }
  ]
}
```

**After** (Learning):
```json
{
  "tasks": [
    {
      "id": "task-1",
      "prompt": "Analyze the codebase and create architecture plan",
      // Creates "architecture-plan" impulse
    },
    {
      "id": "task-2",
      "prompt": "Implement feature following {{architecturePlan}}",
      "impulseReferences": ["architecture-plan"]
      // Learning: Reusing impulse reduced tokens by 40%!
    }
  ]
}
```

**Learning Data**:
- Impulse "analysis" created 50 times, used 0 times → removed
- Impulse "architecture-plan" created 50 times, used 48 times → keep!
- Token savings: 40% reduction by reusing context

---

## Updated Schema Requirements

### activity_content Table: Add Columns

```sql
ALTER TABLE activity_content ADD COLUMN context_requirements ARRAY;
ALTER TABLE activity_content ADD COLUMN memory_agent_session_id STRING;
ALTER TABLE activity_content ADD COLUMN memory_agent_impulses_gathered INT;
ALTER TABLE activity_content ADD COLUMN memory_agent_cost DECIMAL;
ALTER TABLE activity_content ADD COLUMN memory_agent_duration_ms INT;
```

### task_execution Table: Add Columns

```sql
ALTER TABLE task_execution ADD COLUMN impulses_loaded ARRAY;
ALTER TABLE task_execution ADD COLUMN impulses_created ARRAY;
ALTER TABLE task_execution ADD COLUMN total_context_tokens INT DEFAULT 0;
ALTER TABLE task_execution ADD COLUMN prompt_tokens INT DEFAULT 0;
ALTER TABLE task_execution ADD COLUMN context_ratio DECIMAL DEFAULT 0.0;
```

---

## Success Metrics (Updated)

**Phase 2 is successful when we can answer**:

1. ✅ Which impulses are critical for task success?
2. ✅ What's the optimal context size for each task type?
3. ✅ Are we loading impulses that tasks don't use?
4. ✅ Do impulse chains efficiently pass context between tasks?
5. ✅ Can we automatically evolve templates to minimize cost while maintaining success rate?

**Long-term Goal**: Template variants that converge toward minimal token cost while maintaining high success rates.

---

## Integration with Existing Design

This addendum **enhances** the existing Phase 2 design by:

1. **Adding impulse tracking** to state capture
2. **Adding context metrics** to task execution
3. **Enabling learning queries** for template optimization
4. **Clarifying the goal**: Learn what context to provide, not just what happened

The core instrumentation architecture remains the same, we're just capturing **more targeted data** about impulse usage and context efficiency.

---

**Next Steps**:
1. Update database schema with impulse tracking columns
2. Implement `checkIfUsedInSession()` helper (analyze session for impulse references)
3. Add context metrics to API endpoints
4. Build learning dashboards/queries
5. Test with real activity → measure context_ratio and impulse usage

**Impact**: This transforms the activity system from execution tracking into a **context optimization learning loop** that minimizes costs while maximizing success rates.
