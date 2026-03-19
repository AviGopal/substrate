# Activity System Data Flow Tracing

**Purpose**: Comprehensive data flow map for minibob → activity-api → dashboard integration  
**Date**: March 19, 2026  
**Status**: 🔄 Integration in progress

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Data Generation Points](#data-generation-points)
3. [Data Flow Paths](#data-flow-paths)
4. [API Endpoints](#api-endpoints)
5. [Missing Pieces](#missing-pieces)
6. [Implementation Plan](#implementation-plan)

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW OVERVIEW                            │
└──────────────────────────────────────────────────────────────────────┘

   MiniBob Vessel                 Activity API              Dashboard
   (TypeScript)                   (TypeScript/Bun)          (React)
        │                              │                         │
        │ 1. Execute Activity          │                         │
        ├──────────────────────────────┤                         │
        │                              │                         │
        │ 2. Register Template         │                         │
        │    POST /v2/activities/      │                         │
        │    templates                 │                         │
        │                              ├─────► SurrealDB         │
        │                              │       (activity_template)│
        │                              │                         │
        │ 3. Report Execution          │                         │
        │    POST /v2/activities/      │                         │
        │    executions                │                         │
        │                              ├─────► SurrealDB         │
        │                              │       (activity_executions│
        │                              │        variant_performance│
        │                              │        _metrics)         │
        │                              │                         │
        │ 4. Store Impulses            │                         │
        │    POST /v2/impulses         │                         │
        │                              ├─────► SurrealDB         │
        │                              │       (impulse_data)     │
        │                              │                         │
        │                              │ 5. Fetch Templates       │
        │                              │    GET /v2/activities/   │
        │                              │    templates             │
        │                              │◄─────┤                   │
        │                              │      │ Queries SurrealDB │
        │                              │      │ with Thompson     │
        │                              │      │ Sampling scores   │
        │                              │      │                   │
        │                              │      └─────────────────► Dashboard
        │                              │                         displays
        │                              │                         templates
        │                              │                         & metrics
```

---

## Data Generation Points

### 1. MiniBob Activity Execution

**File**: `repos/minibob/src/activity.ts`

**When**: Activity execution completes (success or failure)

**Data Generated**:
```typescript
// Line 104-231: ActivityExecutor.execute()
const execution: ActivityExecution = {
  id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  templateId: template.id,
  status: "completed" | "failed",
  variables: { /* user-provided variables */ },
  impulses: [ /* impulse IDs used */ ],
  taskResults: [
    {
      taskId: "task-1",
      status: "completed" | "failed",
      output: "LLM response text",
      startedAt: timestamp,
      completedAt: timestamp,
      tokens: { input: 5420, output: 1834 },
      error?: "error message"
    }
  ],
  startedAt: timestamp,
  completedAt: timestamp,
  metrics: {
    duration: 235000, // milliseconds
    cost: 0.14,       // USD
    totalTokens: { input: 5420, output: 1834 }
  }
}
```

**Triggers**:
1. **Template Registration** (Line 124-130)
2. **Execution Reporting** (Line 202-213)

---

### 2. MiniBob Template Registration

**File**: `repos/minibob/src/mcp.ts`

**When**: Activity execution starts (ensures template exists in backend)

**Function**: `MCPClient.registerTemplate()` (Line 88-128)

**Data Sent** (POST `/v2/activities/templates` OR POST `/templates`):
```typescript
{
  variant_id: "add-feature-complete",
  activity_id: "add-feature-complete",
  variant_name: "Add Feature with Tests and Commit",
  description: "Comprehensive feature addition workflow",
  category: "feature",
  task_steps: [
    {
      id: "implement",
      description: "Implement the feature",
      prompt: { template: "Add {{featureName}} to {{files}}" },
      dependencies: []
    },
    {
      id: "test",
      description: "Write comprehensive tests",
      dependencies: ["implement"]
    },
    {
      id: "commit",
      description: "Commit changes",
      dependencies: ["test"]
    }
  ],
  scope: "global"
}
```

**Backend Processing** (repos/metabob-activity-api/src/routes/activities.ts, Line 141-272):
1. Check if template exists (Line 161-170)
2. If exists, return 409 Conflict (graceful - MiniBob continues)
3. If not exists:
   - Insert into `activity_template` table (Line 180-214)
   - Create initial `variant_performance_metrics` (Line 218-240)
     ```sql
     thompson_alpha: 1.0  -- Bayesian prior (success)
     thompson_beta: 1.0   -- Bayesian prior (failure)
     total_executions: 0
     success_rate: 0.0
     ```

---

### 3. MiniBob Execution Reporting

**File**: `repos/minibob/src/mcp.ts`

**Function**: `MCPClient.reportExecution()` (Line 133-176)

**Data Sent** (POST `/v2/activities/executions` OR POST `/executions`):
```typescript
{
  variant_id: "add-feature-complete",
  success: true,
  duration_ms: 235000,
  cost: 0.14,
  tokens: {
    input: 5420,
    output: 1834,
    cache: 0
  },
  error_message?: "Task failed with...",  // if failed
  error_type?: "task_execution_error",
  failed_task_id?: "task-2",              // if failed
  impulses_used?: ["file:src/app.ts", "memo:requirements"]
}
```

**Backend Processing** (repos/metabob-activity-api/src/routes/activities.ts, Line 516-667):
1. Generate execution ID (Line 537)
2. Insert execution record into `activity_executions` (Line 539-584)
3. **Atomic metrics update** with Thompson Sampling (Line 596-622):
   ```sql
   UPDATE variant_performance_metrics SET
     total_executions += 1,
     successful_executions += (success ? 1 : 0),
     failed_executions += (success ? 0 : 1),
     success_rate = successful_executions / total_executions,
     avg_duration_ms = ((avg_duration_ms * (total_executions - 1)) + duration_ms) / total_executions,
     avg_cost_usd = ((avg_cost_usd * (total_executions - 1)) + cost) / total_executions,
     thompson_alpha = successful_executions + 1,  -- Bayesian update
     thompson_beta = failed_executions + 1,       -- Bayesian update
     last_executed_at = time::now()
   WHERE variant_id = $variant_id
   ```
4. Invalidate Redis cache (Line 630-632)
5. Return updated metrics

**Thompson Sampling Impact**:
- First success: `alpha=2, beta=1` → High selection probability
- First failure: `alpha=1, beta=2` → Low selection probability
- Proven template (95 success, 5 fail): `alpha=96, beta=6` → Very high probability
- Bad template (10 success, 90 fail): `alpha=11, beta=91` → Very low probability

---

### 4. MiniBob Impulse Storage

**File**: `repos/minibob/src/impulse.ts`

**When**: Impulse created during activity execution

**Data Structure** (Line 16-41):
```typescript
interface Impulse {
  id: string              // "file:src/app.ts" or "memo:requirements"
  pointer: ImpulsePointer // How to resolve content
  budget: number          // Token budget for this impulse
  priority: "critical" | "high" | "medium" | "low"
  loaded: boolean
  content?: string        // Actual content (after loading)
  tokenCount?: number     // Actual tokens used
  createdAt: number
  tags?: string[]
}

type ImpulsePointer = 
  | { type: "memo"; content: string }
  | { type: "file"; path: string; offset?: number; limit?: number }
  | { type: "activityOutput"; activityId: string; taskId?: string }
  | { type: "custom"; resolver: string; data: Record<string, unknown> }
```

**Backend Storage** (POST `/v2/impulses`):
- **Currently**: MiniBob stores in-memory only (no backend call yet)
- **TODO**: Add MCP call to `MCPClient.storeImpulse()` (already implemented, line 181-204)

---

## Data Flow Paths

### Path 1: Template Discovery (Dashboard → API → SurrealDB)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. User Opens Dashboard                                             │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. React Hook: useTemplates() Fetches Templates                     │
│    File: repos/activity-dashboard/src/hooks/useTemplates.ts         │
│    Line: 37-56                                                       │
│                                                                      │
│    useEffect(() => {                                                 │
│      api.listTemplates({ category, limit })                         │
│        .then(response => setTemplates(response.templates))          │
│    }, [category, limit])                                             │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. API Client: GET /v2/activities/templates                         │
│    File: repos/activity-dashboard/src/lib/api-client.ts             │
│    Line: 129-147                                                     │
│                                                                      │
│    async listTemplates(params) {                                    │
│      const query = new URLSearchParams(params)                      │
│      return fetch(`/v2/activities/templates?${query}`)              │
│    }                                                                 │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Activity API: Template Endpoint Handler                          │
│    File: repos/metabob-activity-api/src/routes/activities.ts        │
│    Line: 278-441                                                     │
│                                                                      │
│    Flow:                                                             │
│    a) Check Redis cache for template list (Line 305-307)            │
│    b) If cache HIT: Load templates from Redis                       │
│    c) If cache MISS: Load from SurrealDB (Line 342-385)             │
│       - Query with multi-tenant filtering                           │
│       - Populate Redis cache                                        │
│    d) Filter by category (Line 388-391)                             │
│    e) Apply limit (Line 394)                                        │
│    f) Filter by scope/org_id/project_id (Line 397-417)              │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. SurrealDB Query: Fetch Templates with Metrics                    │
│    File: repos/metabob-activity-api/src/routes/activities.ts        │
│    Line: 66-128 (listAllTemplatesFromDB function)                   │
│                                                                      │
│    SELECT * FROM activity_template                                  │
│    WHERE (                                                           │
│      scope IS NULL                                                   │
│      OR scope = 'global'                                             │
│      OR (scope = 'org' AND org_id = $org_id)                        │
│      OR (scope = 'project' AND project_id = $project_id)            │
│    )                                                                 │
│    ORDER BY created_at DESC                                         │
│    LIMIT $limit                                                      │
│                                                                      │
│    Returns:                                                          │
│    [                                                                 │
│      {                                                               │
│        variant_id: "add-feature-complete",                          │
│        activity_id: "add-feature-complete",                         │
│        variant_name: "Add Feature Complete",                        │
│        description: "...",                                           │
│        category: "feature",                                          │
│        metrics: {                                                    │
│          total_executions: 100,                                      │
│          success_rate: 0.9375,                                       │
│          avg_duration_ms: 242000,                                    │
│          avg_cost_usd: 0.14,                                         │
│          thompson_alpha: 94,  // 93 successes + 1 prior              │
│          thompson_beta: 7     // 6 failures + 1 prior                │
│        }                                                             │
│      }                                                               │
│    ]                                                                 │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. Dashboard Renders Template Library                               │
│    File: repos/activity-dashboard/src/components/ActivityLibrary.tsx│
│                                                                      │
│    Displays:                                                         │
│    - Template name and description                                  │
│    - Success rate (93.75%)                                           │
│    - Average duration (242s / 4.0 min)                               │
│    - Average cost ($0.14)                                            │
│    - Thompson score visualization                                   │
│    - Total executions (100)                                          │
│    - Category badge                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Path 2: Activity Execution (MiniBob → API → SurrealDB)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. MiniBob: User Triggers Activity Execution                        │
│    $ kubectl exec deployment/minibob-minibob-cluster -- \           │
│        bun run /app/index.ts run /app/templates/self-improve.json   │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. MiniBob: Load Template & Create Executor                         │
│    File: repos/minibob/src/activity.ts                              │
│    Line: 104-232 (ActivityExecutor.execute)                         │
│                                                                      │
│    const execution: ActivityExecution = {                           │
│      id: "act_1773814014942_tx4cx4",                                │
│      templateId: "self-improve",                                    │
│      status: "executing",                                           │
│      ...                                                             │
│    }                                                                 │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. MiniBob: Register Template with Backend (if MCP enabled)         │
│    File: repos/minibob/src/activity.ts                              │
│    Line: 124-130                                                     │
│                                                                      │
│    if (isMCPEnabled()) {                                             │
│      const mcp = getMCPClient()                                      │
│      await mcp.registerTemplate(template)  // POST /templates       │
│    }                                                                 │
│                                                                      │
│    Backend creates:                                                  │
│    - activity_template record (if not exists)                       │
│    - variant_performance_metrics record (alpha=1, beta=1)           │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. MiniBob: Execute Tasks (LLM calls, tool execution)               │
│    File: repos/minibob/src/activity.ts                              │
│    Line: 134-185                                                     │
│                                                                      │
│    for (const task of sortedTasks) {                                │
│      // Create impulses                                              │
│      const impulses = await createImpulsesFromRequirements(...)     │
│                                                                      │
│      // Load impulse content                                        │
│      const loadedImpulses = await loadImpulses(taskImpulseIds)      │
│                                                                      │
│      // Execute task with LLM                                       │
│      const result = await llm.completeWithTools(...)                │
│                                                                      │
│      // Store output for downstream tasks                           │
│      storeActivityOutput(activityId, task.id, result.content)       │
│                                                                      │
│      // Validate result                                             │
│      if (task.validation) {                                         │
│        await runValidation(task.validation)                         │
│      }                                                               │
│    }                                                                 │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. MiniBob: Calculate Metrics & Report Execution                    │
│    File: repos/minibob/src/activity.ts                              │
│    Line: 188-213                                                     │
│                                                                      │
│    execution.completedAt = Date.now()                               │
│    execution.status = "completed" | "failed"                        │
│    execution.metrics = {                                             │
│      duration: 235000,  // ms                                        │
│      cost: 0.14,        // USD                                       │
│      totalTokens: { input: 5420, output: 1834 }                     │
│    }                                                                 │
│                                                                      │
│    if (isMCPEnabled()) {                                             │
│      await mcp.reportExecution(execution)  // POST /executions      │
│    }                                                                 │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. API: Record Execution & Update Thompson Sampling                 │
│    File: repos/metabob-activity-api/src/routes/activities.ts        │
│    Line: 516-667                                                     │
│                                                                      │
│    a) Insert execution record:                                      │
│       INSERT INTO activity_executions {                             │
│         execution_id: "exec_1773814014942_abc123",                  │
│         variant_id: "self-improve",                                 │
│         success: true,                                               │
│         duration_ms: 235000,                                         │
│         cost_usd: 0.14,                                              │
│         tokens_input: 5420,                                          │
│         tokens_output: 1834,                                         │
│         executed_at: time::now()                                     │
│       }                                                              │
│                                                                      │
│    b) ATOMIC metrics update (prevents race conditions):             │
│       UPDATE variant_performance_metrics SET                        │
│         total_executions += 1,                    // 100 → 101       │
│         successful_executions += 1,               // 93 → 94         │
│         success_rate = 94 / 101 = 0.9307,         // Updated         │
│         thompson_alpha = 94 + 1 = 95,             // Bayesian update │
│         thompson_beta = 7 + 1 = 8                 // Stays same      │
│       WHERE variant_id = 'self-improve'                              │
│                                                                      │
│    c) Invalidate Redis cache:                                       │
│       del('activity:template:self-improve')                         │
│       srem('activity:templates:list', 'self-improve')               │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. Dashboard: Real-time Update (WebSocket or polling)               │
│    File: repos/activity-dashboard/src/hooks/useWebSocket.ts         │
│                                                                      │
│    useEffect(() => {                                                 │
│      api.connectWebSocket((message) => {                            │
│        if (message.type === 'execution_completed') {                │
│          // Refresh template metrics                                │
│          refreshTemplates()                                          │
│        }                                                             │
│      })                                                              │
│    }, [])                                                            │
│                                                                      │
│    OR polling (if WebSocket not connected):                         │
│                                                                      │
│    useEffect(() => {                                                 │
│      const interval = setInterval(() => {                           │
│        refreshTemplates()  // Re-fetch templates                    │
│      }, 30000)  // Every 30 seconds                                  │
│    }, [])                                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Path 3: Impulse Flow (Creation → Storage → Usage → Tracking)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. MiniBob: Create Impulse During Activity Execution                │
│    File: repos/minibob/src/activity.ts                              │
│    Line: 233-318 (createImpulsesFromRequirements)                   │
│                                                                      │
│    Example template with context requirements:                      │
│    {                                                                 │
│      "contextRequirements": [                                       │
│        {                                                             │
│          "id": "feature-file",                                       │
│          "type": "file",                                             │
│          "source": "src/{{fileName}}",  // Interpolated             │
│          "budget": 2000,                // Token limit               │
│          "priority": "high"                                          │
│        },                                                            │
│        {                                                             │
│          "id": "requirements",                                       │
│          "type": "memo",                                             │
│          "source": "{{description}}",                                │
│          "budget": 500,                                              │
│          "priority": "medium"                                        │
│        }                                                             │
│      ]                                                               │
│    }                                                                 │
│                                                                      │
│    Creates impulses:                                                 │
│    const impulse1 = createImpulse({                                 │
│      id: "feature-file",                                             │
│      pointer: { type: "file", path: "src/app.ts" },                 │
│      budget: 2000,                                                   │
│      priority: "high"                                                │
│    })                                                                │
│                                                                      │
│    const impulse2 = createImpulse({                                 │
│      id: "requirements",                                             │
│      pointer: { type: "memo", content: "Add user authentication" }, │
│      budget: 500,                                                    │
│      priority: "medium"                                              │
│    })                                                                │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. MiniBob: Store Impulse In-Memory                                 │
│    File: repos/minibob/src/impulse.ts                               │
│    Line: 23-33 (ImpulseStore.create)                                │
│                                                                      │
│    class ImpulseStore {                                              │
│      private impulses = new Map<string, Impulse>()                  │
│                                                                      │
│      create(impulse) {                                               │
│        const fullImpulse = {                                         │
│          ...impulse,                                                 │
│          loaded: false,                                              │
│          createdAt: Date.now()                                       │
│        }                                                             │
│        this.impulses.set(impulse.id, fullImpulse)                   │
│        return fullImpulse                                            │
│      }                                                               │
│    }                                                                 │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. MiniBob: Load Impulse Content (Lazy Loading)                     │
│    File: repos/minibob/src/impulse.ts                               │
│    Line: 44-75 (ImpulseStore.load)                                  │
│                                                                      │
│    async load(id: string): Promise<Impulse> {                       │
│      const impulse = this.impulses.get(id)                          │
│      if (impulse.loaded) return impulse                             │
│                                                                      │
│      // Resolve pointer based on type                               │
│      const content = await this.resolvePointer(impulse.pointer)     │
│      const tokenCount = estimateTokens(content)                     │
│                                                                      │
│      // Truncate if over budget                                     │
│      if (tokenCount > impulse.budget) {                             │
│        const ratio = impulse.budget / tokenCount                    │
│        content = content.substring(0, Math.floor(                   │
│          content.length * ratio * 0.9  // 10% safety margin         │
│        )) + "\n... (truncated to fit budget)"                        │
│      }                                                               │
│                                                                      │
│      return {                                                        │
│        ...impulse,                                                   │
│        loaded: true,                                                 │
│        content,                                                      │
│        tokenCount: Math.min(tokenCount, impulse.budget)             │
│      }                                                               │
│    }                                                                 │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. MiniBob: Inject Impulse Content into LLM Prompt                  │
│    File: repos/minibob/src/activity.ts                              │
│    Line: 332-344 (executeTask)                                      │
│                                                                      │
│    const loadedImpulses = await loadImpulses(taskImpulseIds)        │
│    const impulseContext = formatImpulsesForContext(loadedImpulses)  │
│                                                                      │
│    Formatted context:                                                │
│    <impulse_context>                                                 │
│      <impulse id="feature-file" type="file" tokens="1850/2000">     │
│        [Content of src/app.ts...]                                    │
│      </impulse>                                                      │
│      <impulse id="requirements" type="memo" tokens="450/500">       │
│        Add user authentication                                      │
│      </impulse>                                                      │
│    </impulse_context>                                                │
│                                                                      │
│    Final prompt sent to LLM:                                        │
│    prompt = impulseContext + "\n\n" + taskPrompt                    │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. TODO: Store Impulse in Backend (Not yet implemented)             │
│    File: repos/minibob/src/mcp.ts                                   │
│    Line: 181-204 (MCPClient.storeImpulse - READY but not called)    │
│                                                                      │
│    async storeImpulse(impulse: Impulse): Promise<boolean> {         │
│      const payload = {                                               │
│        id: impulse.id,                                               │
│        pointer: impulse.pointer,                                     │
│        budget: impulse.budget,                                       │
│        priority: impulse.priority,                                   │
│        content: impulse.content                                      │
│      }                                                               │
│      return this.request("POST", "/impulses", payload)              │
│    }                                                                 │
│                                                                      │
│    REQUIRED CHANGE:                                                  │
│    In repos/minibob/src/impulse.ts, add after line 32:             │
│                                                                      │
│    if (isMCPEnabled()) {                                             │
│      const mcp = getMCPClient()                                      │
│      await mcp.storeImpulse(fullImpulse)  // Store to backend       │
│    }                                                                 │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. API: Store Impulse with Multi-Tenant Isolation                   │
│    File: repos/metabob-activity-api/src/routes/impulses.ts          │
│    Line: 43-152                                                      │
│                                                                      │
│    POST /v2/impulses                                                 │
│    {                                                                 │
│      impulse_id: "feature-file",                                    │
│      project_id: "minibob-project",                                 │
│      impulse_data: {                                                 │
│        type: "file",                                                 │
│        path: "src/app.ts",                                           │
│        budget: 2000,                                                 │
│        priority: "high",                                             │
│        content: "[actual file content...]"                          │
│      }                                                               │
│    }                                                                 │
│                                                                      │
│    Backend inserts into impulse_data table with composite key:      │
│    (api_key, project_id, impulse_id)                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Activity API Endpoints (repos/metabob-activity-api)

#### 1. Session Management

| Endpoint | Method | Purpose | Implemented |
|----------|--------|---------|-------------|
| `/v2/session` | POST | Create session, get API key | ✅ Yes |
| `/v2/session` | GET | Get current session data | ✅ Yes |

#### 2. Template Management

| Endpoint | Method | Purpose | Implemented |
|----------|--------|---------|-------------|
| `/v2/activities/templates` | GET | List all templates with metrics | ✅ Yes |
| `/v2/activities/templates` | POST | Register new template variant | ✅ Yes |
| `/v2/activities/templates/:variantId` | GET | Get specific template | ✅ Yes |

**Response Format** (GET `/v2/activities/templates`):
```typescript
{
  templates: [
    {
      variant_id: "add-feature-complete",
      activity_id: "add-feature-complete",
      variant_name: "Add Feature Complete",
      description: "...",
      category: "feature",
      task_steps: [...],
      scope: "global",
      org_id: null,
      project_id: null,
      created_at: "2026-03-19T10:00:00Z",
      updated_at: "2026-03-19T10:00:00Z",
      metrics: {
        variant_id: "add-feature-complete",
        total_executions: 100,
        successful_executions: 94,
        failed_executions: 6,
        success_rate: 0.94,
        avg_duration_ms: 242000,
        avg_cost_usd: 0.14,
        thompson_alpha: 95,  // Used for Thompson Sampling
        thompson_beta: 7,
        total_selections: 100,
        last_executed_at: "2026-03-19T15:30:00Z",
        created_at: "2026-03-01T10:00:00Z",
        updated_at: "2026-03-19T15:30:00Z"
      }
    }
  ],
  total: 1
}
```

#### 3. Execution Recording

| Endpoint | Method | Purpose | Implemented |
|----------|--------|---------|-------------|
| `/v2/activities/executions` | POST | Record execution result | ✅ Yes |
| `/v2/activities/executions` | GET | List executions | ❌ **MISSING** |
| `/v2/activities/executions/:executionId` | GET | Get execution details | ❌ **MISSING** |

**Request Format** (POST `/v2/activities/executions`):
```typescript
{
  variant_id: "add-feature-complete",
  success: true,
  duration_ms: 235000,
  cost: 0.14,
  tokens: {
    input: 5420,
    output: 1834,
    cache: 0
  },
  error_message?: "...",
  error_type?: "task_execution_error",
  failed_task_id?: "task-2",
  impulses_used?: ["file:src/app.ts", "memo:requirements"],
  component_changes?: ["src/app.ts", "src/utils.ts"]
}
```

#### 4. Impulse Management

| Endpoint | Method | Purpose | Implemented |
|----------|--------|---------|-------------|
| `/v2/impulses` | POST | Store impulse | ✅ Yes |
| `/v2/impulses` | GET | List impulses | ✅ Yes |
| `/v2/impulses/:impulseId` | GET | Get specific impulse | ✅ Yes |

---

## Missing Pieces

### 1. Execution History Endpoint ❌

**Problem**: Dashboard cannot display execution history

**Required Endpoint**: `GET /v2/activities/executions`

**Query Parameters**:
- `variant_id` (optional): Filter by template
- `success` (optional): Filter by success/failure
- `limit` (default: 50, max: 100)
- `offset` (default: 0)

**Expected Response**:
```typescript
{
  executions: [
    {
      execution_id: "exec_1773814014942_abc123",
      variant_id: "add-feature-complete",
      success: true,
      duration_ms: 235000,
      cost_usd: 0.14,
      tokens_input: 5420,
      tokens_output: 1834,
      tokens_cache: 0,
      executed_at: "2026-03-19T15:30:00Z",
      error_message: null,
      error_type: null,
      failed_task_id: null
    }
  ],
  total: 100,
  limit: 50,
  offset: 0
}
```

**Implementation Location**: 
- File: `repos/metabob-activity-api/src/routes/activities.ts`
- Add after line 667

---

### 2. WebSocket Real-Time Updates ❌

**Problem**: Dashboard doesn't receive real-time execution updates

**Required**: WebSocket endpoint for live streaming

**Expected Endpoint**: `WS /ws`

**Message Types**:
```typescript
// Server → Client messages
type WebSocketMessage = 
  | {
      type: "execution_started"
      data: {
        execution_id: string
        variant_id: string
        started_at: string
      }
    }
  | {
      type: "execution_completed"
      data: {
        execution_id: string
        variant_id: string
        success: boolean
        duration_ms: number
        cost: number
        completed_at: string
      }
    }
  | {
      type: "template_metrics_updated"
      data: {
        variant_id: string
        metrics: {
          success_rate: number
          avg_duration_ms: number
          avg_cost_usd: number
          thompson_alpha: number
          thompson_beta: number
        }
      }
    }
```

**Implementation**:
1. Add WebSocket server in `repos/metabob-activity-api/src/index.ts`
2. Broadcast execution events from `POST /v2/activities/executions` handler
3. Dashboard connects via `repos/activity-dashboard/src/hooks/useWebSocket.ts` (already implemented)

---

### 3. MiniBob Impulse Backend Storage ❌

**Problem**: Impulses created in MiniBob are not persisted to backend

**Required Change**: Call `MCPClient.storeImpulse()` after creating impulse

**File**: `repos/minibob/src/impulse.ts`

**Current Code** (Line 23-33):
```typescript
create(impulse: Omit<Impulse, "loaded" | "createdAt">): Impulse {
  const fullImpulse: Impulse = {
    ...impulse,
    loaded: false,
    createdAt: Date.now(),
  }
  this.impulses.set(impulse.id, fullImpulse)
  return fullImpulse
}
```

**Required Addition** (after line 32):
```typescript
create(impulse: Omit<Impulse, "loaded" | "createdAt">): Impulse {
  const fullImpulse: Impulse = {
    ...impulse,
    loaded: false,
    createdAt: Date.now(),
  }
  this.impulses.set(impulse.id, fullImpulse)
  
  // Store in backend if MCP enabled
  if (isMCPEnabled()) {
    const mcp = getMCPClient()
    if (mcp) {
      mcp.storeImpulse(fullImpulse).catch(err => {
        console.warn(`[Impulse] Failed to store in backend: ${err.message}`)
      })
    }
  }
  
  return fullImpulse
}
```

---

### 4. Dashboard Execution History View ⏳

**Status**: Partially implemented (API client ready, UI not built)

**File**: `repos/activity-dashboard/src/lib/api-client.ts`

**Current Implementation** (Line 173-185):
```typescript
async listExecutions(_params?: {
  variant_id?: string;
  success?: boolean;
  limit?: number;
}): Promise<{ executions: Execution[]; total: number }> {
  // TODO: Implement this endpoint in metabob-activity-api
  console.warn('listExecutions endpoint not yet implemented in API');
  return { executions: [], total: 0 };
}
```

**Required**:
1. Implement backend endpoint (GET `/v2/activities/executions`)
2. Remove `console.warn` and implement actual fetch
3. Create React component to display execution history

---

### 5. Thompson Sampling Visualization ⏳

**Status**: Data available, UI visualization not implemented

**Current State**:
- Thompson parameters (`alpha`, `beta`) stored in SurrealDB ✅
- Parameters returned in template list API ✅
- Dashboard receives data ✅
- Visual representation **NOT implemented** ❌

**Required**:
- Add Thompson score calculation in dashboard
- Visualize selection probability (Beta distribution)
- Show confidence intervals
- Compare templates side-by-side

**Suggested Visualization**:
```
Template: add-feature-complete
┌─────────────────────────────────────────────┐
│ Thompson Score: 0.89                         │
│ Confidence: ████████████░░░░░░ 85%           │
│                                              │
│ Beta Distribution:                           │
│        ▁▂▄▆█████▆▄▂▁                         │
│     ┌──────────────────┐                     │
│  0.7  0.8  0.9  1.0                          │
│                                              │
│ Successes: 94 | Failures: 6                  │
│ Total Executions: 100                        │
└─────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Complete Data Flow (1-2 days) 🎯

**Priority**: HIGH - Enables end-to-end tracing

#### Task 1.1: Implement Execution History Endpoint
- **File**: `repos/metabob-activity-api/src/routes/activities.ts`
- **Action**: Add `GET /v2/activities/executions` handler
- **Estimate**: 2 hours

```typescript
app.get('/executions', async (c) => {
  const variantId = c.req.query('variant_id')
  const success = c.req.query('success')
  const limitStr = c.req.query('limit') || '50'
  const offsetStr = c.req.query('offset') || '0'
  
  let query = 'SELECT * FROM activity_executions WHERE 1=1'
  const params: Record<string, any> = {}
  
  if (variantId) {
    query += ' AND variant_id = $variant_id'
    params.variant_id = variantId
  }
  
  if (success !== undefined) {
    query += ' AND success = $success'
    params.success = success === 'true'
  }
  
  query += ' ORDER BY executed_at DESC LIMIT $limit START $offset'
  params.limit = Math.min(parseInt(limitStr), 100)
  params.offset = Math.max(parseInt(offsetStr), 0)
  
  const executions = await surrealDB.query(query, params)
  
  return c.json({
    executions,
    total: executions.length,
    limit: params.limit,
    offset: params.offset
  })
})
```

#### Task 1.2: Add MiniBob Impulse Backend Storage
- **File**: `repos/minibob/src/impulse.ts`
- **Action**: Call `MCPClient.storeImpulse()` after creating impulse
- **Estimate**: 1 hour

#### Task 1.3: Update Dashboard API Client
- **File**: `repos/activity-dashboard/src/lib/api-client.ts`
- **Action**: Remove TODO and implement actual fetch
- **Estimate**: 30 minutes

---

### Phase 2: Real-Time Updates (2-3 days) 🔄

**Priority**: MEDIUM - Enhances user experience

#### Task 2.1: Add WebSocket Server to Activity API
- **File**: `repos/metabob-activity-api/src/index.ts`
- **Action**: Add WebSocket endpoint `/ws`
- **Estimate**: 4 hours

#### Task 2.2: Broadcast Execution Events
- **File**: `repos/metabob-activity-api/src/routes/activities.ts`
- **Action**: Emit WebSocket messages on execution completion
- **Estimate**: 2 hours

#### Task 2.3: Connect Dashboard WebSocket
- **File**: `repos/activity-dashboard/src/hooks/useWebSocket.ts`
- **Action**: Connect to API WebSocket and handle messages
- **Estimate**: 2 hours

---

### Phase 3: Dashboard UI Enhancements (3-4 days) 🎨

**Priority**: MEDIUM - Visual improvements

#### Task 3.1: Execution History Component
- **File**: `repos/activity-dashboard/src/components/ExecutionHistory.tsx`
- **Action**: Create new component to display execution list
- **Estimate**: 4 hours

#### Task 3.2: Thompson Sampling Visualization
- **File**: `repos/activity-dashboard/src/components/ThompsonVisualization.tsx`
- **Action**: Add Beta distribution chart and confidence intervals
- **Estimate**: 6 hours

#### Task 3.3: Real-Time Metrics Updates
- **File**: `repos/activity-dashboard/src/components/SystemOverview.tsx`
- **Action**: Add live execution counter and recent activity feed
- **Estimate**: 3 hours

---

### Phase 4: Testing & Validation (1-2 days) 🧪

**Priority**: HIGH - Ensure correctness

#### Task 4.1: End-to-End Test: MiniBob → API → Dashboard
- Execute activity in MiniBob
- Verify template registration in SurrealDB
- Verify execution recording in SurrealDB
- Verify metrics update (Thompson Sampling)
- Verify dashboard displays updated data

#### Task 4.2: Load Testing
- Execute 100 activities in parallel
- Verify no race conditions in metrics updates
- Verify Redis cache performance
- Verify WebSocket scalability

---

## Summary: Connecting the Strands

### Current State ✅
1. **MiniBob** generates execution data ✅
2. **Activity API** stores data in SurrealDB ✅
3. **Dashboard** fetches template list ✅
4. **Thompson Sampling** calculations working ✅
5. **Redis caching** implemented ✅

### Missing Links ❌
1. Execution history endpoint (API)
2. WebSocket real-time updates (API + Dashboard)
3. Impulse backend storage (MiniBob)
4. Execution history UI (Dashboard)
5. Thompson Sampling visualization (Dashboard)

### Priority Order 🎯
1. **Execution history endpoint** - Enables data inspection
2. **MiniBob impulse storage** - Completes data flow
3. **WebSocket updates** - Enables real-time monitoring
4. **Dashboard UI** - Visualizes the system

### Total Effort Estimate
- **Phase 1** (Complete data flow): 1-2 days
- **Phase 2** (Real-time updates): 2-3 days
- **Phase 3** (UI enhancements): 3-4 days
- **Phase 4** (Testing): 1-2 days

**Total**: 7-11 days (1.5-2.5 weeks)

---

## Next Steps

1. **Implement execution history endpoint** (highest priority)
2. **Add MiniBob impulse storage** (completes loop)
3. **Test end-to-end flow** with real activity execution
4. **Document findings** and iterate

**Goal**: Achieve **full observability** from activity execution to dashboard visualization.

