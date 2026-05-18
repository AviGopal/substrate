# API Changes Specification

## Overview

This spec defines the API changes needed in `metabob-activity-api` and `minibob` to support the new 4-table schema.

## metabob-activity-api Changes

### New Endpoints

#### POST /v2/impulses

Create a new impulse.

```typescript
// Request
interface CreateImpulseRequest {
  id?: string;                     // Optional, auto-generated if not provided
  pointer: ImpulsePointer;         // Required
  shape: string;                   // Required
  summary?: string;                // Optional
  token_estimate?: number;         // Optional
  content?: string;                // Optional (materialized content)
  project_id?: string;             // Optional
  vessel_id?: string;              // Optional
}

interface ImpulsePointer {
  type: 'file' | 'memo' | 'trace' | 'goal' | 'error' | 'activity' | string;
  [key: string]: unknown;          // Type-specific fields
}

// Response
interface CreateImpulseResponse {
  id: string;
  created_at: string;
}
```

**Example:**

```bash
curl -X POST http://api.metabob.local/v2/impulses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pointer": {
      "type": "goal",
      "text": "Fix the authentication bug in login flow",
      "category": "bugfix"
    },
    "shape": "goal",
    "summary": "Fix auth bug - null pointer in login"
  }'
```

#### POST /v2/impulses/query

Resolve impulse pointers and return content.

```typescript
// Request
interface QueryImpulsesRequest {
  impulse_ids?: string[];          // Specific impulses to resolve
  shapes?: string[];               // Filter by shape
  pointer_types?: string[];        // Filter by pointer type
  limit?: number;                  // Max results
  include_content?: boolean;       // Whether to load content
}

// Response
interface QueryImpulsesResponse {
  impulses: Impulse[];
}
```

#### POST /v2/activities

Create a new activity.

```typescript
// Request
interface CreateActivityRequest {
  id?: string;
  name: string;
  description?: string;
  input_shapes: string[];
  output_shapes: string[];
  execution_type: 'template' | 'tool' | 'composition' | 'vessel_function';

  // Type-specific fields
  tasks?: TaskDefinition[];            // For template
  tool_name?: string;                  // For tool
  child_activities?: string[];         // For composition
  source_location?: SourceLocation;    // For vessel_function

  // Lineage
  extracted_from?: string;
  variant_of?: string;

  // Scope
  scope?: 'global' | 'org' | 'project' | 'vessel';
  public?: boolean;
  project_id?: string;
}

// Response
interface CreateActivityResponse {
  id: string;
  created_at: string;
}
```

#### GET /v2/activities/recommend

Thompson Sampling recommendation (replaces existing endpoint).

```typescript
// Request (query params)
interface RecommendActivitiesRequest {
  input_shapes: string[];          // Required: What impulse shapes are available
  limit?: number;                  // Default: 5
  execution_type?: string;         // Optional filter
}

// Response
interface RecommendActivitiesResponse {
  recommendations: Array<{
    activity: Activity;
    score: {
      alpha: number;
      beta: number;
      expected_success: number;
      sample: number;              // Sampled value for ranking
    };
  }>;
}
```

**Implementation:**

```typescript
async function recommendActivities(req: RecommendActivitiesRequest) {
  // Find activities matching input shapes
  const candidates = await db.query(`
    SELECT a.*, s.*
    FROM activity AS a
    LEFT JOIN v_activity_score AS s ON a.id = s.activity_id
    WHERE a.input_shapes CONTAINSALL $input_shapes
      AND a.org_id = $auth.org_id
  `, { input_shapes: req.input_shapes });

  // Sample from Beta distribution for each
  const ranked = candidates.map(a => ({
    activity: a,
    score: {
      alpha: a.alpha || 1,
      beta: a.beta || 1,
      expected_success: (a.alpha - 1) / (a.alpha + a.beta - 2),
      sample: betaSample(a.alpha || 1, a.beta || 1)
    }
  })).sort((a, b) => b.score.sample - a.score.sample);

  return { recommendations: ranked.slice(0, req.limit || 5) };
}
```

#### POST /v2/executions

Record execution trace (unified endpoint).

```typescript
// Request
interface CreateExecutionRequest {
  id?: string;
  activity_id: string;
  input_impulses: string[];
  output_impulses: string[];
  success: boolean;
  error?: {
    message: string;
    type?: string;
    task_id?: string;
  };
  duration_ms: number;
  cost_usd: number;
  tokens_in?: number;
  tokens_out?: number;
  parent_execution_id?: string;
  trace?: Record<string, unknown>;
  vessel_id?: string;
  project_id?: string;
}

// Response
interface CreateExecutionResponse {
  id: string;
  created_at: string;
}
```

#### GET /v2/executions/:id

Get execution details.

```typescript
// Response
interface GetExecutionResponse {
  execution: Execution;
  activity: Activity;
  input_impulses: Impulse[];
  output_impulses: Impulse[];
  child_executions?: Execution[];  // If this is a composition
}
```

#### POST /v2/vessels

Register a new vessel (replaces minibob instance creation).

```typescript
// Request
interface CreateVesselRequest {
  id?: string;
  name: string;
  resolves?: string[];             // Default: ['file', 'memo']
  api_key: string;                 // Plain text, will be hashed
  project_id?: string;
}

// Response
interface CreateVesselResponse {
  id: string;
  api_key_hash: string;
  created_at: string;
}
```

### Deprecated Endpoints

These endpoints remain functional but are deprecated:

| Old Endpoint | New Endpoint | Notes |
|--------------|--------------|-------|
| `POST /v2/activities/templates` | `POST /v2/activities` | Set `execution_type: 'template'` |
| `POST /v2/activities/execution-traces` | `POST /v2/executions` | Unified execution recording |
| `POST /v2/impulses/resolve` | `POST /v2/impulses/query` | Renamed for clarity |
| `POST /v2/activities/composition` | `POST /v2/executions` | Compositions are executions |
| `POST /v2/activities/tool-usage` | `POST /v2/executions` | Tool calls are executions |
| `GET /v2/activities/composition/graph` | `GET /v2/executions?composition=true` | Query param |
| `POST /v2/activities/goal-paths` | `POST /v2/activities` | Set `execution_type: 'composition'` |

### Backward Compatibility Layer

```typescript
// Middleware to handle old endpoints
app.post('/v2/activities/execution-traces', async (c) => {
  const body = await c.req.json();

  // Transform old format to new
  const newBody: CreateExecutionRequest = {
    activity_id: body.template_id || body.activity_id,
    input_impulses: body.impulses_used || [],
    output_impulses: [],
    success: body.status === 'success',
    error: body.error_message ? {
      message: body.error_message,
      type: body.error_type,
      task_id: body.failed_task_id
    } : undefined,
    duration_ms: body.duration_ms,
    cost_usd: body.cost_usd,
    tokens_in: body.tokens_input,
    tokens_out: body.tokens_output,
    trace: body.execution_trace
  };

  // Forward to new endpoint
  return handleCreateExecution(c, newBody);
});
```

---

## MiniBob Changes

### Impulse Creation

```typescript
// Before: Create impulse_data
async function createImpulse(data: ImpulseData) {
  await mcpClient.call('impulse_store', {
    impulse_id: data.id,
    impulse_data: data,
    impulse_type: data.pointer.type
  });
}

// After: Create impulse with shape
async function createImpulse(data: ImpulseData) {
  await fetch(`${ACTIVITY_API_URL}/v2/impulses`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      id: data.id,
      pointer: data.pointer,
      shape: inferShape(data.pointer),
      summary: data.metadata?.summary,
      token_estimate: data.budget,
      content: data.loaded ? data.content : undefined
    })
  });
}

function inferShape(pointer: ImpulsePointer): string {
  switch (pointer.type) {
    case 'file': return 'source_code';
    case 'memo': return 'memo';
    case 'goal': return 'goal';
    case 'activityExecutionTrace': return 'trace';
    default: return pointer.type;
  }
}
```

### Execution Recording

```typescript
// Before: Multiple calls for different execution types
async function recordExecution(trace: ExecutionTrace) {
  await mcpClient.call('store_execution_trace', { trace });

  if (trace.tool_calls) {
    for (const call of trace.tool_calls) {
      await mcpClient.call('record_tool_usage', { ...call });
    }
  }

  if (trace.composition) {
    await mcpClient.call('record_composition', { ...trace.composition });
  }
}

// After: Single unified call
async function recordExecution(trace: ExecutionTrace) {
  // Create output impulses for any produced data
  const outputImpulses: string[] = [];
  for (const output of trace.outputs) {
    const impulse = await createImpulse({
      pointer: output.pointer,
      shape: output.shape,
      content: output.content
    });
    outputImpulses.push(impulse.id);
  }

  // Record the execution
  await fetch(`${ACTIVITY_API_URL}/v2/executions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      activity_id: trace.activity_id,
      input_impulses: trace.input_impulse_ids,
      output_impulses: outputImpulses,
      success: trace.success,
      error: trace.error,
      duration_ms: trace.duration_ms,
      cost_usd: trace.cost_usd,
      tokens_in: trace.tokens.input,
      tokens_out: trace.tokens.output,
      parent_execution_id: trace.parent_id,
      trace: {
        tasks: trace.tasks,
        state_transition: trace.state_transition
      }
    })
  });

  // Tool calls within template are child executions
  for (const toolCall of trace.tool_calls || []) {
    await fetch(`${ACTIVITY_API_URL}/v2/executions`, {
      method: 'POST',
      body: JSON.stringify({
        activity_id: `tool-${toolCall.tool_name}`,
        input_impulses: toolCall.input_impulses || [],
        output_impulses: toolCall.output_impulses || [],
        success: toolCall.success,
        duration_ms: toolCall.duration_ms,
        cost_usd: 0,
        parent_execution_id: trace.id  // Link to parent
      })
    });
  }
}
```

### Activity Selection

```typescript
// Before: Call recommend with template filters
async function selectActivity(goal: string, context: Context) {
  const templates = await mcpClient.call('recommend_templates', {
    goal_description: goal,
    context
  });
  return templates[0];
}

// After: Call with input shapes
async function selectActivity(inputImpulses: Impulse[]) {
  const inputShapes = inputImpulses.map(i => i.shape);

  const response = await fetch(
    `${ACTIVITY_API_URL}/v2/activities/recommend?` +
    `input_shapes=${inputShapes.join(',')}&limit=5`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  const { recommendations } = await response.json();
  return recommendations[0].activity;
}
```

### Goal Processing

```typescript
// Before: Goals stored separately
async function processGoal(goalText: string) {
  const paths = await mcpClient.call('get_goal_paths', {
    goal: goalText,
    category: 'bugfix'
  });
  // ...
}

// After: Goals are impulses
async function processGoal(goalText: string) {
  // Create goal as impulse
  const goalImpulse = await createImpulse({
    pointer: { type: 'goal', text: goalText, category: 'bugfix' },
    shape: 'goal',
    summary: goalText.slice(0, 100)
  });

  // Find activities that accept goal shape
  const { recommendations } = await fetch(
    `${ACTIVITY_API_URL}/v2/activities/recommend?input_shapes=goal&execution_type=composition`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  // Execute top recommendation with goal impulse as input
  const activity = recommendations[0].activity;
  return await executeActivity(activity, [goalImpulse.id]);
}
```

---

## MCP Tool Changes

### Updated Tool Definitions

```typescript
// Old tools (deprecated)
const oldTools = {
  'store_execution_trace': { /* ... */ },
  'record_tool_usage': { /* ... */ },
  'record_composition': { /* ... */ },
  'record_goal_path': { /* ... */ },
  'impulse_store': { /* ... */ },
  'impulse_load': { /* ... */ }
};

// New tools
const newTools = {
  'create_impulse': {
    description: 'Create a new impulse',
    inputSchema: {
      type: 'object',
      properties: {
        pointer: { type: 'object', required: true },
        shape: { type: 'string', required: true },
        summary: { type: 'string' },
        token_estimate: { type: 'number' },
        content: { type: 'string' }
      }
    }
  },

  'query_impulses': {
    description: 'Query and optionally load impulses',
    inputSchema: {
      type: 'object',
      properties: {
        impulse_ids: { type: 'array', items: { type: 'string' } },
        shapes: { type: 'array', items: { type: 'string' } },
        include_content: { type: 'boolean' }
      }
    }
  },

  'recommend_activities': {
    description: 'Get Thompson Sampling recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        input_shapes: { type: 'array', items: { type: 'string' }, required: true },
        execution_type: { type: 'string' },
        limit: { type: 'number' }
      }
    }
  },

  'record_execution': {
    description: 'Record execution trace (unified)',
    inputSchema: {
      type: 'object',
      properties: {
        activity_id: { type: 'string', required: true },
        input_impulses: { type: 'array', items: { type: 'string' } },
        output_impulses: { type: 'array', items: { type: 'string' } },
        success: { type: 'boolean', required: true },
        duration_ms: { type: 'number', required: true },
        cost_usd: { type: 'number', required: true },
        error: { type: 'object' },
        parent_execution_id: { type: 'string' },
        trace: { type: 'object' }
      }
    }
  }
};
```

---

## Type Definitions

### Shared Types

```typescript
// types/impulse.ts
export interface Impulse {
  id: string;
  pointer: ImpulsePointer;
  shape: string;
  summary?: string;
  token_estimate?: number;
  content?: string;
  org_id: string;
  project_id?: string;
  vessel_id?: string;
  created_by?: string;
  created_at: string;
  expires_at?: string;
}

export interface ImpulsePointer {
  type: string;
  [key: string]: unknown;
}

// types/activity.ts
export interface Activity {
  id: string;
  name: string;
  description?: string;
  input_shapes: string[];
  output_shapes: string[];
  execution_type: 'template' | 'tool' | 'composition' | 'vessel_function';
  tasks?: TaskDefinition[];
  tool_name?: string;
  child_activities?: string[];
  source_location?: SourceLocation;
  extracted_from?: string;
  variant_of?: string;
  scope: 'global' | 'org' | 'project' | 'vessel';
  public: boolean;
  org_id: string;
  project_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// types/execution.ts
export interface Execution {
  id: string;
  activity_id: string;
  input_impulses: string[];
  output_impulses: string[];
  success: boolean;
  error?: ExecutionError;
  duration_ms: number;
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
  parent_execution_id?: string;
  trace?: Record<string, unknown>;
  org_id: string;
  project_id?: string;
  vessel_id?: string;
  created_by?: string;
  executed_at: string;
  created_at: string;
}

export interface ExecutionError {
  message: string;
  type?: string;
  task_id?: string;
}

// types/vessel.ts
export interface Vessel {
  id: string;
  name: string;
  resolves: string[];
  api_key_hash: string;
  is_active: boolean;
  org_id: string;
  project_id?: string;
  created_at: string;
  last_active_at?: string;
  expires_at?: string;
}
```
