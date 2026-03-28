# Activity Dashboard Analysis

## Dashboard Access

**URL**: `dashboard.minibob.local` (via `activity-dashboard` service)  
**Service**: `activity-dashboard.activity-system.svc:3000`  
**Status**: ✅ Running

**Access via port-forward**:
```bash
kubectl port-forward -n activity-system svc/activity-dashboard 3001:3000
# Then visit: http://localhost:3001
```

---

## Current Activity Structure

### Existing Activities in Backend

Query results from `http://metabob-activity-api.activity-system.svc:8080/v2/activities/templates`:

#### 1. fix-bug (bugfix)
- **Variant**: fix-bug-v1
- **Description**: Fix a bug in the codebase
- **Tasks**: 1 task (Analyze and fix the bug)
- **Metrics**:
  - Total executions: 1
  - Successful: 1
  - Success rate: 100%
  - Thompson α/β: 1/1 (new variant)
  - Last executed: 2026-03-20

**Task Structure**:
```
task-1: "Analyze and fix the bug"
  - Subagent: general
  - Max tokens: 8000
  - Variables: bugDescription, file, line, additionalContext
  - Retry: 3 attempts (simple strategy)
```

#### 2. add-function (feature)
- **Variant**: add-function-v1  
- **Description**: Add a simple function to the codebase
- **Tasks**: 1 task (Create function file)
- **Metrics**: Available (execution data exists)

**Task Structure**:
```
task-1: "Create function file"
  - Subagent: general
  - Max tokens: 4000
  - Variables: functionName (required)
  - Retry: 3 attempts
```

---

## Activity Template Schema

Based on the backend responses, the proper structure is:

```typescript
{
  activity_id: string          // Base activity identifier
  variant_id: string            // Specific variant (e.g., "fix-bug-v1")
  variant_name: string          // Human-readable name
  description: string
  category: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure"
  scope: "global" | "org" | "project"
  
  task_steps: [
    {
      id: string                // e.g., "task-1"
      description: string
      dependencies: string[]    // Task IDs this depends on
      subagent: string          // "general", "test", "doc", etc.
      
      prompt: {
        template: string        // With {{variable}} placeholders
        maxTokens: number
        compressionStrategy: "filter" | "summarize"
        variables: [
          {
            name: string
            type: "string" | "number" | "boolean"
            required: boolean
            description: string
          }
        ]
      }
      
      retry: {
        maxAttempts: number
        strategy: "simple" | "exponential"
      }
    }
  ]
  
  metrics: {
    total_executions: number
    successful_executions: number
    failed_executions: number
    success_rate: number | null
    avg_duration_ms: number | null
    avg_cost_usd: number | null
    thompson_alpha: number      // For Thompson Sampling
    thompson_beta: number
    last_executed_at: string
  }
}
```

---

## Activity Composition Tracking

The backend tracks:
1. **Activity Templates** - Base template definitions
2. **Variant Performance Metrics** - Success rates, Thompson Sampling parameters
3. **Activity Executions** - Individual execution records
4. **Composition Graph** - Which activities call which (Phase 1.1-1.2)
5. **Impulse Relevance** - Which impulses help/hurt (Phase 1.6, 1.8)
6. **Tool Usage Patterns** - Which tools are used (Phase 1.4)
7. **Execution Sequences** - Common execution patterns (Phase 1.5)
8. **Goal Paths** - Multi-activity paths for goals (Phase 1.7)

---

## Dashboard Visualization Capabilities

Based on the frontend structure, the dashboard likely visualizes:

### 1. Activity Templates List
- All registered activities
- Category filtering (feature, bugfix, etc.)
- Success rates
- Execution counts

### 2. Activity Composition Graph
- Visual graph of which activities call which
- Directed edges showing composition relationships
- Depth/breadth of composition trees

### 3. Performance Metrics
- Success rate over time
- Token usage trends
- Cost per execution
- Duration histograms

### 4. Thompson Sampling Visualization
- α/β parameters for each variant
- Exploration vs exploitation balance
- Recommendation probabilities

### 5. Impulse Relevance (Phase 1.8)
- Which impulses are loaded/skipped
- Token savings from filtering
- Relevance scores over time

---

## Creating a Trace Activity

To create a proper "trace minibob execution" activity for debugging, we need:

### Template Structure
```json
{
  "activity_id": "trace-minibob",
  "variant_id": "trace-minibob-v1",
  "variant_name": "Trace Minibob Execution",
  "description": "Comprehensive tracing of minibob execution for debugging",
  "category": "infrastructure",
  "scope": "global",
  "task_steps": [
    {
      "id": "log-environment",
      "description": "Log environment and configuration",
      "dependencies": [],
      "subagent": "general",
      "prompt": {
        "template": "Log the current minibob environment: 1) All environment variables starting with MINIBOB_, IMPULSE_, MCP_. 2) Current working directory. 3) Available templates. 4) Backend connectivity status.",
        "maxTokens": 2000,
        "compressionStrategy": "filter",
        "variables": []
      },
      "retry": { "maxAttempts": 1, "strategy": "simple" }
    },
    {
      "id": "test-execution",
      "description": "Execute test task",
      "dependencies": ["log-environment"],
      "subagent": "general",
      "prompt": {
        "template": "Execute a simple bash command: echo 'Minibob trace test: {{testMessage}}'. Verify the output matches expectations.",
        "maxTokens": 1000,
        "compressionStrategy": "filter",
        "variables": [
          {
            "name": "testMessage",
            "type": "string",
            "required": true,
            "description": "Test message to echo"
          }
        ]
      },
      "retry": { "maxAttempts": 3, "strategy": "simple" }
    },
    {
      "id": "check-impulse-filtering",
      "dependencies": ["test-execution"],
      "description": "Check impulse filtering status",
      "subagent": "general",
      "prompt": {
        "template": "Check impulse filtering configuration: 1) Query IMPULSE_* environment variables. 2) Verify MCP backend is reachable. 3) Check if filtering is active in logs.",
        "maxTokens": 2000,
        "compressionStrategy": "filter",
        "variables": []
      },
      "retry": { "maxAttempts": 1, "strategy": "simple" }
    },
    {
      "id": "generate-report",
      "description": "Generate execution summary",
      "dependencies": ["check-impulse-filtering"],
      "subagent": "general",
      "prompt": {
        "template": "Generate a summary report of the trace execution. Include: 1) Total duration. 2) Tokens used per task. 3) Any errors or warnings. 4) Backend connectivity status. 5) Impulse filtering status. 6) Overall health assessment (PASS/FAIL).",
        "maxTokens": 3000,
        "compressionStrategy": "filter",
        "variables": []
      },
      "retry": { "maxAttempts": 1, "strategy": "simple" }
    }
  ]
}
```

### Key Features
1. **Sequential dependencies** - Each task builds on previous
2. **Environment inspection** - Logs all relevant config
3. **Test execution** - Verifies basic functionality works
4. **Filtering check** - Confirms Phase 1.8 is active
5. **Summary report** - Comprehensive health status

---

## How to View in Dashboard

### Step 1: Access Dashboard
```bash
kubectl port-forward -n activity-system svc/activity-dashboard 3001:3000
```

Visit `http://localhost:3001`

### Step 2: Register Trace Activity
Use the activity registration endpoint or goal-seeking (once implemented in backend).

### Step 3: Execute Trace Activity
```bash
# Via minibob API
curl -X POST http://minibob.../run \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "trace-minibob-v1",
    "variables": {
      "testMessage": "Dashboard visualization test"
    }
  }'
```

### Step 4: View Results in Dashboard
- See activity appear in templates list
- View execution metrics
- Check composition graph (if it calls other activities)
- Monitor impulse filtering savings

---

## Expected Dashboard Views

### Activity List View
```
Name                    | Category       | Success Rate | Executions
------------------------|----------------|--------------|------------
trace-minibob-v1        | infrastructure | 100%         | 1
fix-bug-v1              | bugfix         | 100%         | 1
add-function-v1         | feature        | N/A          | 0
```

### Activity Detail View
```
Activity: trace-minibob-v1
Description: Comprehensive tracing of minibob execution
Category: infrastructure

Tasks (4):
  1. log-environment → 2. test-execution → 3. check-impulse-filtering → 4. generate-report

Metrics:
  Success Rate: 100% (1/1)
  Avg Duration: 15.3s
  Avg Cost: $0.042
  Thompson α/β: 2/1 (90% confidence)

Recent Executions:
  2026-03-21 02:30:15 - SUCCESS - 14.8s - $0.041
```

### Composition Graph View (if activity calls others)
```
[trace-minibob-v1]
       |
       └──> (no child activities)

[minibob-health-check-v1]  (if we create this)
       |
       ├──> [trace-minibob-v1]
       └──> [verify-backend-v1]
```

---

## Next Steps

1. ✅ Dashboard is running and accessible
2. ⏳ Register trace activity template
3. ⏳ Execute trace activity
4. ⏳ View results in dashboard
5. ⏳ Create composed activity that uses trace activity
6. ⏳ Visualize composition graph

**Recommendation**: Create the trace activity using the proper schema format and execute it to populate the dashboard with real data.
