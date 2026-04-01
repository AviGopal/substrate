# MiniBob ↔ Backend Operational Flow

**Purpose**: Document how MiniBob actually interacts with metabob-activity-api via impulses and direct API calls.

---

## Flow Overview

```
User Goal → GoalProcessor → Backend (Recommend) → Template Load → Execute → Store Trace → Learn
     ↓                              ↓                    ↓             ↓          ↓           ↓
  "Add auth"              Thompson Sampling    Template JSON    LLM+Tools   Execution   Pattern Mining
```

---

## Phase 1: Goal Processing

### User Input
```typescript
User: "Add authentication to the API"
```

### Goal Analysis (MiniBob)
```typescript
// goal-processor.ts:50-61
interface Goal {
  message: "Add authentication to the API"
  type: "feature"  // Inferred
  intent: "Implement auth system with JWT tokens"  // Enriched by LLM
  context: {}  // Files, variables from workspace
  createdAt: timestamp
}
```

---

## Phase 2: Activity Recommendation

### 2.1: Create Goal Impulse (NEW - Phase 1)

```typescript
// goal-processor.ts:510-551
const goalImpulseId = createGoalImpulse(goal.intent, {
  category: "feature",
  limit: 3,
  excludeActivities: [],
  priority: "high"
})

// Creates impulse:
{
  id: "goal-1234567890-abc123",
  type: "goal",
  pointer: {
    type: "goal",
    content: "Implement auth system with JWT tokens",
    category: "feature",
    impulseRefs: [],
    limit: 3,
    excludeActivities: []
  },
  budget: 4000,
  priority: 2
}
```

### 2.2: Resolve Goal Impulse

```typescript
// goal-processor.ts:554-578
const resolved = await loadImpulse(goalImpulseId)
// Tries to resolve via vessel discovery -> MCP -> Backend

// If resolution succeeds:
{
  loaded: true,
  content: JSON.stringify({
    recommendations: [
      {
        template_id: "add-auth-complete",
        selection_metadata: {
          method: "thompson_sampling",
          alpha: 12,
          beta: 3,
          sampled_value: 0.78,
          score: 0.82
        }
      }
    ],
    metadata: { impulse_context_size: 2048 }
  })
}
```

### 2.3: Fallback to Direct API Call (DEPRECATED)

```typescript
// goal-processor.ts:600-634
// If impulse resolution fails (404), fall back to:

const recommendations = await mcp.recommendActivities(
  goal.intent,
  "feature",  // category
  [],         // loaded_impulses
  3,          // limit
  []          // exclude_activities
)

// Backend API Call:
POST /v2/activities/recommend
{
  "task_description": "Implement auth system with JWT tokens",
  "category": "feature",
  "loaded_impulses": [],
  "limit": 3,
  "exclude_activities": []
}

// Backend Response:
{
  "recommendations": [
    {
      "template_id": "add-auth-complete",
      "template_name": "Add Authentication (Complete)",
      "selection_metadata": {
        "method": "thompson_sampling",
        "thompson_alpha": 12,
        "thompson_beta": 3,
        "sampled_value": 0.78,
        "success_rate": 0.80,
        "total_executions": 15
      }
    },
    {
      "template_id": "setup-auth-basic",
      "selection_metadata": { ... }
    }
  ]
}
```

---

## Phase 3: Template Loading

### 3.1: Load Template from Backend

```typescript
// activity.ts:1917-1945
const template = await loadTemplateFromMCPOrLocal(
  "add-auth-complete"  // templateId from recommendation
)

// Backend API Call:
GET /v2/activities/templates/add-auth-complete

// Backend Response:
{
  "template": {
    "variant_id": "add-auth-complete",
    "variant_name": "Add Authentication (Complete)",
    "description": "Implement JWT-based authentication with middleware",
    "category": "feature",
    "task_steps": [
      {
        "id": "install-deps",
        "description": "Install auth dependencies",
        "prompt": { "template": "Install jsonwebtoken and bcrypt..." }
      },
      {
        "id": "create-middleware",
        "description": "Create auth middleware",
        "dependencies": ["install-deps"],
        "prompt": { "template": "Create src/middleware/auth.ts..." }
      }
    ],
    "variables": [
      { "name": "secretKey", "type": "string", "required": true }
    ],
    "impulses": [],
    "thompson_alpha": 12,
    "thompson_beta": 3
  }
}

// Transformed to MiniBob format:
{
  id: "add-auth-complete",
  name: "Add Authentication (Complete)",
  category: "feature",
  tasks: [ ... ],  // Transformed from task_steps
  variables: [ ... ]
}
```

### 3.2: Alternative: Load from Local File

```typescript
// If backend returns 404, try local:
const template = await loadTemplate(
  "repos/metabob-proto/activities/bootstrap/add-auth-complete.json"
)

// Then register with backend:
await mcp.registerTemplate(template)

// Backend API Call:
POST /v2/activities/templates
{
  "variant_id": "add-auth-complete",
  "variant_name": "Add Authentication (Complete)",
  "category": "feature",
  "task_steps": [ ... ],
  "variables": [ ... ]
}
```

---

## Phase 4: Activity Execution

### 4.1: Execute Template

```typescript
// activity.ts:ActivityExecutor.execute()
const execution = await executor.execute(template, {
  secretKey: "my-secret-key-123"
})

// For each task:
for (const task of template.tasks) {
  // Load impulses for task
  const taskImpulses = await loadTaskImpulses(task)

  // Execute with LLM
  const result = await llm.generateWithTools(
    task.prompt.template,
    tools,
    { impulses: taskImpulses, variables }
  )

  // Validate result
  if (task.validation) {
    validateTaskResult(result, task.validation)
  }

  // Record in execution trace
  execution.taskResults.push(result)
}
```

### 4.2: Execution Trace Structure

```typescript
const execution: ActivityExecution = {
  id: "exec-1234567890",
  templateId: "add-auth-complete",
  status: "completed",
  startTime: timestamp,
  endTime: timestamp,

  taskResults: [
    {
      taskId: "install-deps",
      status: "completed",
      output: "✓ Installed jsonwebtoken, bcrypt",
      toolCalls: [
        { tool: "bash", args: { command: "npm install..." } }
      ]
    },
    {
      taskId: "create-middleware",
      status: "completed",
      output: "✓ Created src/middleware/auth.ts",
      toolCalls: [
        { tool: "write", args: { path: "src/middleware/auth.ts", content: "..." } }
      ]
    }
  ],

  metrics: {
    duration: 45000,  // ms
    cost: 0.0234,     // USD
    totalTokens: {
      input: 5234,
      output: 1823
    }
  },

  executionTrace: {
    tasks: [ ... ],  // Full task details
    impulsesCreated: ["file:src/middleware/auth.ts"],
    filesModified: ["package.json", "src/middleware/auth.ts"]
  }
}
```

---

## Phase 5: Store Execution Trace

### 5.1: Send Trace to Backend

```typescript
// mcp.ts:837-919
await mcp.storeExecutionTrace(execution)

// Backend API Call:
POST /v2/activities/execution-traces
{
  "execution_id": "exec-1234567890",
  "template_id": "add-auth-complete",
  "activity_id": "add-auth-complete",
  "status": "success",
  "success": true,
  "duration_ms": 45000,
  "cost_usd": 0.0234,
  "tokens": {
    "input": 5234,
    "output": 1823,
    "cache": 0
  },
  "execution_trace": {
    "tasks": [
      {
        "task_id": "install-deps",
        "status": "completed",
        "tool_calls": [ ... ],
        "output": "..."
      },
      {
        "task_id": "create-middleware",
        "status": "completed",
        "tool_calls": [ ... ],
        "output": "..."
      }
    ],
    "impulsesCreated": ["file:src/middleware/auth.ts"],
    "filesModified": ["package.json", "src/middleware/auth.ts"]
  },
  "input_impulses": [],
  "output_impulses": ["file:src/middleware/auth.ts"],
  "vessel_id": "minibob-local-001",
  "parent_execution_id": null,
  "org_id": "metabob_internal",
  "project_id": "default"
}
```

### 5.2: Update Thompson Sampling

```typescript
// Backend updates template metrics:
UPDATE activity_template
SET
  thompson_alpha = thompson_alpha + 1,  // 12 → 13 (success)
  total_executions = total_executions + 1
WHERE template_id = 'add-auth-complete'

// If execution failed:
UPDATE activity_template
SET
  thompson_beta = thompson_beta + 1,  // 3 → 4 (failure)
  total_executions = total_executions + 1
WHERE template_id = 'add-auth-complete'
```

---

## Phase 6: Pattern Learning (Backend)

### 6.1: Composition Pattern Mining

```typescript
// If execution has parent_execution_id:
INSERT INTO composition_edges (
  parent_activity_id,
  child_activity_id,
  success,
  execution_count
) VALUES (
  'setup-auth-middleware',
  'add-auth-routes',
  true,
  1
)
ON CONFLICT (parent_activity_id, child_activity_id)
DO UPDATE SET
  success_count = success_count + 1,
  execution_count = execution_count + 1
```

### 6.2: Tool Usage Pattern Mining

```typescript
// Extract from execution_trace.tasks[].tool_calls:
INSERT INTO tool_usage_patterns (
  activity_id,
  tool_name,
  frequency,
  success_rate
) VALUES (
  'add-auth-complete',
  'bash',
  2,
  1.0
)
```

### 6.3: Sequence Pattern Mining

```typescript
// If execution is part of a sequence (composition):
INSERT INTO execution_sequences (
  sequence,
  goal_category,
  success,
  frequency
) VALUES (
  ['setup-auth-middleware', 'add-auth-routes', 'test-auth-flow'],
  'feature',
  true,
  1
)
```

---

## Phase 7: Next Iteration (Learning Loop)

### 7.1: Same Goal, Better Recommendation

```typescript
// User: "Add authentication to another API"

// Backend now knows:
- 'add-auth-complete' has higher success rate
- Thompson alpha = 13, beta = 3
- Sampled value will be higher

// Recommendation will rank it higher:
POST /v2/activities/recommend
Response: [
  {
    "template_id": "add-auth-complete",
    "selection_metadata": {
      "sampled_value": 0.82  // Higher than before (0.78)
    }
  }
]
```

---

## Impulse Flow (Phase 1 - NEW)

### How Impulses Work

```typescript
// 1. CREATE: MiniBob creates goal impulse
const impulse = createImpulse({
  id: "goal-123",
  type: "goal",
  pointer: {
    type: "goal",
    content: "Add authentication",
    category: "feature"
  },
  loaded: false,
  content: null
})

// 2. RESOLVE: MiniBob tries to load impulse
const resolved = await loadImpulse("goal-123")
// -> Tries vessel resolvers first (none for "goal" type)
// -> Falls back to MCP backend

// 3. BACKEND RESOLVES:
// Backend sees impulse type "goal"
// Runs Thompson Sampling recommendation
// Returns recommendations as impulse content

// 4. MINIBOB RECEIVES:
{
  id: "goal-123",
  loaded: true,
  content: JSON.stringify({
    recommendations: [ ... ]
  })
}
```

### Impulse Types MiniBob Uses

| Type | Resolver | Purpose |
|------|----------|---------|
| `memo` | MiniBob (local) | Embedded content |
| `file` | MiniBob (local) | File on disk |
| `goal` | Backend (MCP) | Get activity recommendations |
| `activityExecutionTrace` | Backend (MCP) | Load execution trace |
| `activityTemplate` | Backend (MCP) | Load template |
| `activityMetrics` | Backend (MCP) | Get performance metrics |

---

## API Calls Summary

### MiniBob → Backend APIs Used

1. **Authentication**
   - `POST /v2/auth/minibob/signin`
   - Frequency: Once per session
   - Purpose: Get JWT token

2. **Get Recommendations**
   - `POST /v2/activities/recommend` (DEPRECATED)
   - Frequency: Once per goal
   - Purpose: Thompson-sampled activity selection
   - **NEW**: Should use impulse resolution instead

3. **Load Template**
   - `GET /v2/activities/templates/:id`
   - Frequency: Once per activity execution
   - Purpose: Get template JSON

4. **Register Template** (if loaded from local file)
   - `POST /v2/activities/templates`
   - Frequency: Once per new local template
   - Purpose: Add to backend registry

5. **Store Execution Trace**
   - `POST /v2/activities/execution-traces`
   - Frequency: Once per activity execution
   - Purpose: Record for learning

6. **Resolve Impulse** (NEW - Phase 1)
   - `POST /v2/impulses/resolve` (or similar)
   - Frequency: Many times per execution
   - Purpose: Load impulse content (traces, templates, recommendations)

---

## What Backend Actually Needs

Based on this operational flow, the backend must provide:

### Core Endpoints

1. ✅ **POST /v2/auth/minibob/signin**
   - Authenticate MiniBob instance
   - Return JWT token with org_id

2. ✅ **POST /v2/activities/recommend** (or impulse resolution)
   - Thompson Sampling recommendation
   - Input: goal description, category, context
   - Output: Ranked template IDs with selection metadata

3. ✅ **GET /v2/activities/templates/:id**
   - Load template by ID
   - Transform backend schema → MiniBob schema

4. ✅ **POST /v2/activities/templates**
   - Register new template
   - Triggered when MiniBob loads local template

5. ✅ **POST /v2/activities/execution-traces**
   - Store execution trace
   - Update Thompson Sampling scores
   - Trigger pattern mining

6. ⚠️ **POST /v2/impulses/resolve** (NEW)
   - Resolve ANY impulse type
   - Input: impulse pointer
   - Output: impulse content
   - **This is the future - should replace direct endpoints**

### Backend Responsibilities

1. **Store traces** - All execution data
2. **Thompson Sampling** - Activity selection algorithm
3. **Pattern Mining**:
   - Composition edges (activity A → activity B)
   - Tool usage patterns
   - Execution sequences
4. **Template Registry** - Store and serve templates
5. **Impulse Resolution** - Resolve trace-type impulses

### NOT Backend Responsibilities

- ❌ LLM resolution (vessels have LLM clients)
- ❌ File resolution (vessels have filesystems)
- ❌ Budget management (vessels track their own costs)
- ❌ Vessel registration (vessels self-register)
- ❌ State space exploration (vessels explore, backend stores outcomes)
- ❌ Template extraction (ribosome runs in vessels)
- ❌ Semantic tagging (vessels do reasoning)

---

## Conclusion

The backend's actual operational role is:

1. **Authenticate MiniBob instances**
2. **Recommend activities** (Thompson Sampling)
3. **Serve templates**
4. **Store execution traces**
5. **Learn patterns** from traces
6. **Resolve historical data** as impulses

Everything else (LLM, files, exploration, extraction, reasoning) happens in vessels.

This aligns perfectly with IMPULSE_ACTIVITY_FOUNDATION.md:
> "The backend is not a universal resolver. It's a trace store. When a vessel 'resolves' something from the backend, it's accessing historical execution data."
