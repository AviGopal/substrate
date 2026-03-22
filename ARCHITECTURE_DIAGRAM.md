# Unified Impulse Architecture - Complete Flow

## End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER INTERACTION                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ goal({ goal: "Add feature", ... })
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         OPENCODE GOAL TOOL                               │
│  repos/metabob-opencode/packages/opencode/src/minibob-integration/      │
│                                                                           │
│  1. executeGoal(sessionID, goal, options)                               │
│     └─> Check if executor exists (line 435)                             │
│         └─> No? Call initialize(sessionID) (line 438) ✅                │
│                                                                           │
│  2. initialize(sessionID)                                                │
│     ├─> Get config: await Config.get()                                  │
│     ├─> Import: { initializeMCP } from "@metabob/minibob"               │
│     ├─> Get endpoint: config.minibob?.url || "http://localhost:8081" ✅ │
│     └─> Call: await initializeMCP({ endpoint, timeout }, true) ✅       │
│                                                                           │
│  3. Goal Loop (lines 513-550)                                            │
│     ├─> Check: isMCPEnabled() → TRUE ✅                                 │
│     ├─> Get client: getMCPClient() → mcpClient ✅                       │
│     └─> Call: mcpClient.recommendActivities(goal, category, impulses)  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP POST /v2/activities/recommend
                                    │ { task_description, category, limit }
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       MINIBOB BACKEND (k8s)                              │
│  http://localhost:8081 → svc/minibob-minibob-cluster:8080               │
│                                                                           │
│  POST /v2/activities/recommend                                           │
│  ├─> Parse task_description                                              │
│  ├─> Query SurrealDB for matching templates                             │
│  ├─> Apply Thompson Sampling (explore vs exploit)                       │
│  └─> Return top 3 recommendations with selection_metadata               │
│                                                                           │
│  Response: {                                                              │
│    recommendations: [                                                     │
│      { template_id: "add-function-v1", selection_metadata: {...} },     │
│      { template_id: "enhance-dashboard", selection_metadata: {...} },   │
│      { template_id: "trace-minibob-v1", selection_metadata: {...} }     │
│    ]                                                                      │
│  }                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Recommendations
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ACTIVITY EXECUTION (MiniBob)                          │
│  repos/minibob/src/activity.ts                                           │
│                                                                           │
│  1. For each recommendation:                                             │
│     ├─> Load template from backend or local                             │
│     ├─> Create execution context                                        │
│     ├─> Execute tasks with Claude                                       │
│     └─> Collect execution data                                          │
│                                                                           │
│  2. After execution (lines 180-210):                                     │
│     └─> storeExecutionTrace({                                            │
│           session_id,                                                    │
│           activity_variant_id: template.id,                             │
│           execution_data: { tasks, results, logs },                     │
│           cost_usd: execution.cost,  ✅ FIXED                           │
│           tokens_input,                                                  │
│           tokens_output,                                                 │
│           status: "success" | "failure",                                │
│           ...                                                             │
│         })                                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP POST /v2/activities/execution-traces
                                    │ { session_id, activity_variant_id, execution_data, ... }
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     DATABASE (SurrealDB)                                 │
│                                                                           │
│  Table: execution_traces (SCHEMALESS)                                   │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ trace_id: uuid                                                  │    │
│  │ session_id: string                                              │    │
│  │ activity_variant_id: string                                     │    │
│  │ execution_data: SCHEMALESS { tasks, results, logs }            │    │
│  │ cost_usd: decimal                                               │    │
│  │ tokens_input: int                                               │    │
│  │ tokens_output: int                                              │    │
│  │ status: string                                                  │    │
│  │ created_at: datetime                                            │    │
│  │ ...                                                              │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  Indexes:                                                                 │
│  - session_id (query traces by session)                                 │
│  - activity_variant_id (query traces by template)                       │
│  - created_at (temporal queries)                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Multiple executions over time
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   THOMPSON SAMPLING LEARNING                             │
│                                                                           │
│  As traces accumulate:                                                   │
│  1. Backend tracks success/failure rates per template                   │
│  2. Thompson Sampling adapts:                                            │
│     - High success → recommend more often (exploit)                     │
│     - Low success → recommend less, try others (explore)                │
│  3. Recommendations improve over time                                    │
│                                                                           │
│  Example Evolution:                                                       │
│  ┌────────────────────────────────────────────────────────┐             │
│  │ Execution #1: Random (no data)                         │             │
│  │   → add-function-v1 (success)                          │             │
│  │   → enhance-dashboard (failure)                        │             │
│  │                                                         │             │
│  │ Execution #10: Learning                                │             │
│  │   → add-function-v1 (high weight, proven)              │             │
│  │   → trace-minibob-v1 (medium weight, promising)        │             │
│  │   → enhance-dashboard (low weight, risky)              │             │
│  │                                                         │             │
│  │ Execution #100: Optimized                              │             │
│  │   → add-function-v1 (90% success rate, preferred)      │             │
│  │   → trace-minibob-v1 (80% success, reliable)           │             │
│  │   → new-template-v1 (0% known, explore)                │             │
│  └────────────────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ GET /v2/activities/execution-traces/:id
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     DEBUGGING WITH IMPULSES                              │
│                                                                           │
│  When activity fails:                                                    │
│  1. Create impulse pointing to execution trace                          │
│     {                                                                     │
│       id: "debug-auth-failure",                                          │
│       pointer: {                                                         │
│         type: "activityTrace",                                           │
│         trace_id: "trace_abc123"                                         │
│       },                                                                  │
│       budget: 3000                                                        │
│     }                                                                     │
│                                                                           │
│  2. Backend resolves via POST /v2/impulses/resolve                      │
│     - Fetches execution trace                                            │
│     - Converts to LLM-friendly markdown                                 │
│     - Returns formatted context                                          │
│                                                                           │
│  3. Next goal execution loads impulse                                    │
│     - Context includes previous failure details                         │
│     - LLM can learn from mistakes                                       │
│     - Ribosome can extract improved template                            │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Components Fixed

### ✅ OpenCode Config (.opencode/opencode.json)
```json
{
  "minibob": {
    "enabled": true,
    "url": "http://localhost:8081"  // ← Changed from "endpoint"
  }
}
```

### ✅ MCP Initialization (minibob-integration/index.ts)
```typescript
// Line 83-97
const { initializeMCP } = await import("@metabob/minibob")
const mcpEndpoint = config.minibob?.url || "http://localhost:8081"  // ← Uses "url"

await initializeMCP({
  endpoint: mcpEndpoint,
  timeout: config.minibob?.timeout || 30000,
}, true)
```

### ✅ MCP Client Singleton (minibob/src/mcp.ts)
```typescript
// Line 664-704
let mcpClient: MCPClient | null = null

export async function initializeMCP(config: MCPConfig, skipHealthCheck = false) {
  mcpClient = new MCPClient(config)  // ← Sets singleton
  return mcpClient
}

export function isMCPEnabled(): boolean {
  return mcpClient !== null  // ← Checked by goal loop
}

export function getMCPClient(): MCPClient | null {
  return mcpClient  // ← Used for recommendations
}
```

### ✅ Execution Trace Storage (minibob/src/activity.ts)
```typescript
// Line 180-210
await storeExecutionTrace({
  session_id: sessionID,
  activity_variant_id: template.id,
  execution_data: executionData,
  cost_usd: execution.cost,  // ← Fixed from "cost"
  // ...
})
```

## Port Forwards Required

```bash
# MiniBob Backend (for MCP client)
kubectl port-forward -n activity-system svc/minibob-minibob-cluster 8081:8080

# Keep running in background
```

## Success Validation

```bash
# Quick check - all should pass
curl -s http://localhost:8081/health | jq '.status'           # "healthy"
./validate-mcp-integration.sh                                 # All ✓
node test-mcp-init.mjs                                         # isMCPEnabled(): true
```

## What Happens on First Goal Call

```
goal({ goal: "Add feature", ... })
  ↓
executeGoal() → No executor → initialize(sessionID)
  ↓
initializeMCP() → Sets mcpClient singleton
  ↓
isMCPEnabled() = TRUE
  ↓
Goal loop runs → recommendActivities()
  ↓
Backend returns templates → Activities execute
  ↓
Traces stored → Learning begins
```

## The Complete Cycle

1. **User:** Calls goal tool with task
2. **OpenCode:** Initializes MCP (first time only)
3. **Backend:** Returns Thompson Sampling recommendations
4. **MiniBob:** Executes recommended activities
5. **Backend:** Stores execution traces
6. **Learning:** Success/failure rates update
7. **Next Goal:** Gets smarter recommendations
8. **Repeat:** System improves over time

**Status:** ✅ All components connected and working
**Ready:** 🧪 Manual testing in OpenCode session
**Next:** 📊 Collect data and verify learning loop
