# Tracing Intention Data Flows: Verifying Ontological Alignment

## The Three States in Execution Traces

Execution traces capture the complete transformation cycle:

```
VESSEL (Instructional State)
    ↓
    activity_template.json + impulses + variables
    ↓
BECOMING (Transient State)
    ↓
    execution_trace: { tasks[], tool_calls[], state_transitions[] }
    ↓
INSTANCE (Functional State)
    ↓
    activity_execution_traces: { success, artifacts, metrics }
    ↓
    Learning & Improvement (Thompson Sampling, ribosome)
    ↓
VESSEL (Updated) ← Cycle continues
```

## Mapping Execution Traces to Ontology

### 1. Vessel → Becoming (Instantiation)

**Captured in execution trace:**
```typescript
{
  // VESSEL IDENTITY
  "execution_id": "act_1774256554912_gwyhht",
  "variant_id": "explore-codebase-v1",
  "activity_id": "explore-codebase-v1",

  // INSTANTIATION CONTEXT
  "state_snapshot": {
    "input_state": {
      "filesAvailable": ["src/", "tests/", "package.json"],
      "environment": {"NODE_ENV": "development"},
      "impulses": ["file:package.json", "memo:recent-changes"],
      "variables": {"focus": "architecture", "depth": "comprehensive"}
    }
  }
}
```

**Verification Questions:**
- ✅ Were the right impulses loaded for this intent?
- ✅ Did the variables match the goal?
- ✅ Was the environment configured correctly?

### 2. Becoming → Instance (Actualization)

**Captured in execution trace:**
```typescript
{
  // TRANSIENT STATE (The Becoming)
  "tasks": [
    {
      "task_id": "analyze_structure",
      "description": "Analyze codebase structure",
      "status": "completed",
      "duration_ms": 15000,
      "tool_calls": [
        {"tool": "read", "duration_ms": 120, "success": true},
        {"tool": "grep", "duration_ms": 450, "success": true}
      ]
    },
    {
      "task_id": "identify_patterns",
      "description": "Identify architectural patterns",
      "status": "completed",
      "duration_ms": 12000,
      "tool_calls": [
        {"tool": "edit", "duration_ms": 2300, "success": true}
      ]
    }
  ],

  // ACTUALIZATION (Output State)
  "state_snapshot": {
    "output_state": {
      "filesModified": ["ARCHITECTURE_ANALYSIS.md"],
      "filesCreated": ["docs/patterns.md"],
      "filesDeleted": [],
      "exitCode": 0
    },
    "stateTransition": {
      "before": {"src/index.ts": "hash123"},
      "after": {"src/index.ts": "hash123"},  // Unchanged
      "workingDirectory": "/repo"
    }
  }
}
```

**Verification Questions:**
- ✅ Did tasks execute in the intended order?
- ✅ Were the right tools used for each task?
- ✅ Did the state transitions match expectations?
- ✅ Were the correct files modified/created?

### 3. Instance → Vessel (Learning Loop)

**Captured across tables:**
```typescript
// activity_execution_traces: Instance record
{
  "execution_id": "act_xyz",
  "success": true,
  "duration_ms": 43984,
  "cost": 0.0234,
  "tokens": {"input": 5000, "output": 3000}
}

// variant_performance_metrics: Learning aggregation
{
  "variant_id": "explore-codebase-v1",
  "total_executions": 15,
  "successful_executions": 12,
  "success_rate": 0.8,
  "thompson_alpha": 13,  // Bayesian learning
  "thompson_beta": 3
}

// activity_template: Updated vessel (via ribosome)
{
  "variant_id": "explore-codebase-v2",  // Improved variant
  "created_from": "act_xyz",
  "improvements": ["Better impulse selection", "Optimized task order"]
}
```

**Verification Questions:**
- ✅ Did successful executions update Thompson Sampling?
- ✅ Were patterns extracted via ribosome?
- ✅ Did new variants incorporate learnings?

## Intention Flow Queries

### Query 1: Trace Vessel Instantiation
```bash
# Get execution with full input state
curl 'http://api.minibob.local/v2/activities/execution-traces/act_1774256554912_gwyhht' | \
  jq '{
    vessel: .variant_id,
    intent: .state_snapshot.input_state,
    impulses_loaded: .impulses_used
  }'
```

**Expected Output:**
```json
{
  "vessel": "explore-codebase-v1",
  "intent": {
    "filesAvailable": ["src/", "package.json"],
    "variables": {"focus": "architecture"}
  },
  "impulses_loaded": ["file:package.json"]
}
```

### Query 2: Trace Becoming Transformation
```bash
# Get task sequence and tool usage
curl 'http://api.minibob.local/v2/activities/execution-traces/act_1774256554912_gwyhht' | \
  jq '.tasks[] | {
    task: .task_id,
    status: .status,
    tools: [.tool_calls[].tool],
    duration_ms: .duration_ms
  }'
```

**Expected Output:**
```json
[
  {
    "task": "analyze_structure",
    "status": "completed",
    "tools": ["read", "grep"],
    "duration_ms": 15000
  },
  {
    "task": "identify_patterns",
    "status": "completed",
    "tools": ["edit"],
    "duration_ms": 12000
  }
]
```

### Query 3: Trace Instance Actualization
```bash
# Get state transition (before → after)
curl 'http://api.minibob.local/v2/activities/execution-traces/act_1774256554912_gwyhht' | \
  jq '{
    files_modified: .state_snapshot.output_state.filesModified,
    files_created: .state_snapshot.output_state.filesCreated,
    success: .success,
    metrics: {
      duration_ms: .duration_ms,
      cost: .cost,
      tokens: .tokens
    }
  }'
```

**Expected Output:**
```json
{
  "files_modified": ["ARCHITECTURE_ANALYSIS.md"],
  "files_created": ["docs/patterns.md"],
  "success": true,
  "metrics": {
    "duration_ms": 43984,
    "cost": 0.0234,
    "tokens": {"input": 5000, "output": 3000}
  }
}
```

### Query 4: Trace Learning Loop
```bash
# Get variant evolution over time
curl 'http://api.minibob.local/v2/activities/execution-traces?variant_id=explore-codebase-v1&limit=10' | \
  jq '[.executions[] | {
    execution_id,
    success,
    duration_ms,
    executed_at
  }] | {
    total: length,
    successful: map(select(.success)) | length,
    success_rate: (map(select(.success)) | length) / length,
    avg_duration: (map(.duration_ms) | add / length)
  }'
```

**Expected Output:**
```json
{
  "total": 10,
  "successful": 8,
  "success_rate": 0.8,
  "avg_duration": 42000
}
```

## Verification Activities

### Activity 1: Trace Intention Flow

**Template:** `templates/trace-intention-flow.json`

```json
{
  "id": "trace-intention-flow",
  "name": "Trace Intention Data Flow",
  "category": "diagnostic",
  "description": "Analyze execution trace to verify intention alignment",
  "tasks": [
    {
      "id": "load-trace",
      "description": "Load execution trace by ID",
      "prompt": {
        "template": "Load execution trace {{execution_id}} from the backend API and extract:\n1. Vessel identity (variant_id, activity_id)\n2. Input state (impulses, variables, environment)\n3. Task sequence and tool usage\n4. Output state (files modified, success status)\n5. Metrics (duration, cost, tokens)\n\nProvide a structured analysis of the complete intention flow.",
        "variables": [
          {"name": "execution_id", "source": "variable", "type": "string"}
        ]
      }
    },
    {
      "id": "verify-alignment",
      "description": "Verify ontological alignment",
      "prompt": {
        "template": "Analyze the execution trace and verify:\n\n**Vessel → Becoming:**\n- Were the impulses appropriate for the goal?\n- Did variables capture the intent correctly?\n- Was the environment configured as expected?\n\n**Becoming → Instance:**\n- Did tasks execute in logical order?\n- Were tools used appropriately?\n- Did state transitions match expectations?\n\n**Instance → Vessel:**\n- Did the execution contribute to learning?\n- Were patterns identified for extraction?\n- Should this create a new variant?\n\nProvide YES/NO answers with explanations.",
        "variables": []
      }
    }
  ]
}
```

### Activity 2: Validate State Transitions

**Template:** `templates/validate-state-transitions.json`

```json
{
  "id": "validate-state-transitions",
  "name": "Validate State Transitions",
  "category": "diagnostic",
  "description": "Verify that file modifications match intent",
  "tasks": [
    {
      "id": "compare-states",
      "description": "Compare input and output states",
      "prompt": {
        "template": "For execution {{execution_id}}:\n\n1. List files in input_state.filesAvailable\n2. List files in output_state.filesModified\n3. Check if modified files were in available files\n4. Verify no unexpected files were changed\n5. Confirm exitCode = 0 for successful executions\n\nReport any anomalies or unexpected state changes.",
        "variables": [
          {"name": "execution_id", "source": "variable", "type": "string"}
        ]
      }
    }
  ]
}
```

### Activity 3: Audit Learning Loop

**Template:** `templates/audit-learning-loop.json`

```json
{
  "id": "audit-learning-loop",
  "name": "Audit Learning Loop",
  "category": "diagnostic",
  "description": "Verify that instances feed back into vessels",
  "tasks": [
    {
      "id": "check-thompson-sampling",
      "description": "Verify Thompson Sampling updates",
      "prompt": {
        "template": "For variant {{variant_id}}:\n\n1. Query all execution traces\n2. Calculate actual success rate\n3. Compare with Thompson Sampling alpha/beta values\n4. Verify that successful executions incremented alpha\n5. Verify that failed executions incremented beta\n\nReport if Thompson Sampling is tracking correctly.",
        "variables": [
          {"name": "variant_id", "source": "variable", "type": "string"}
        ]
      }
    },
    {
      "id": "check-ribosome",
      "description": "Verify ribosome pattern extraction",
      "prompt": {
        "template": "For successful executions of {{variant_id}}:\n\n1. Check if new variants were created via ribosome\n2. Verify that successful patterns were extracted\n3. Confirm new templates incorporate learnings\n4. Validate that the learning loop is continuous\n\nReport on the health of the ribosome pattern.",
        "variables": [
          {"name": "variant_id", "source": "variable", "type": "string"}
        ]
      }
    }
  ]
}
```

## Automated Alignment Verification

### Dashboard Component: Intention Flow Visualizer

A React component that queries execution traces and displays the three-state transformation:

```typescript
interface IntentionFlowProps {
  executionId: string;
}

function IntentionFlowVisualizer({ executionId }: IntentionFlowProps) {
  // Query execution trace
  const trace = useExecutionTrace(executionId);

  return (
    <div className="intention-flow">
      {/* VESSEL */}
      <StateCard title="Vessel (Instructional)">
        <p>Template: {trace.variant_id}</p>
        <p>Impulses: {trace.impulses_used?.length || 0}</p>
        <p>Variables: {Object.keys(trace.state_snapshot?.input_state?.variables || {}).join(', ')}</p>
      </StateCard>

      {/* BECOMING */}
      <StateCard title="Becoming (Transient)">
        <TaskTimeline tasks={trace.tasks} />
        <ToolUsageChart tools={extractTools(trace.tasks)} />
      </StateCard>

      {/* INSTANCE */}
      <StateCard title="Instance (Functional)">
        <p>Success: {trace.success ? '✅' : '❌'}</p>
        <p>Files Modified: {trace.state_snapshot?.output_state?.filesModified?.length || 0}</p>
        <p>Duration: {trace.duration_ms}ms</p>
        <p>Cost: ${trace.cost}</p>
      </StateCard>

      {/* LEARNING */}
      <StateCard title="Learning Loop">
        <ThompsonSamplingStatus variantId={trace.variant_id} />
        <RibosomeStatus executionId={executionId} />
      </StateCard>
    </div>
  );
}
```

## Next Steps

1. **Create the tracing activities** above in `templates/`
2. **Run trace-intention-flow** on recent executions to verify alignment
3. **Build dashboard visualizer** to make flows observable in real-time
4. **Add state transition validation** to catch unintended modifications
5. **Monitor learning loop** to ensure instances feed back into vessels

This creates a **continuous verification loop** where the system can observe and validate its own alignment with the ontological model.
