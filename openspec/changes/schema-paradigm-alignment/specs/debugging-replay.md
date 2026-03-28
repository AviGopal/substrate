# Debugging and Replay Flows

## Overview

This specification defines how execution traces enable debugging failed activities, testing alternative resolvers, A/B testing activity variants, and implementing the improvement loop.

## 1. Debugging Failed Executions

### Data Requirements

To debug a failed execution, we need:

```typescript
interface DebugContext {
  // The failed execution with full trace
  execution: {
    id: string;
    activity_id: string;
    success: false;
    error: {
      message: string;
      type: string;
      task_id?: string;  // Which task failed
    };

    // Full trace for analysis
    trace: {
      tasks: ExecutedTask[];
      impulses_created: string[];
      files_modified: string[];
    };
  };

  // State at failure point
  failed_task: {
    id: string;
    input_state: {
      files_available: string[];
      environment: Record<string, string>;
      impulses: string[];
      variables: Record<string, unknown>;
    };
    output_state: {
      files_modified: string[];
      exit_code?: number;
      stderr?: string;
    };
    tool_calls: ToolCall[];
    actual_prompt: string;
    response: string;
  };

  // Loaded impulses for context
  impulses: Impulse[];
}
```

### Debug Activity Template

```typescript
const debugFailedExecution = {
  id: "debug-failed-execution",
  name: "Debug Failed Activity",
  execution_type: "template",
  input_shapes: ["trace"],  // Requires execution trace impulse
  output_shapes: ["analysis", "recommendation"],

  tasks: [
    {
      id: "load-context",
      description: "Load full execution context",
      prompt: {
        template: `Load the failed execution trace:
{{ impulse:execution-trace }}

Identify:
1. Which task failed (task_id)
2. What the error message says
3. What state existed at failure point`
      }
    },
    {
      id: "analyze-failure",
      description: "Analyze root cause",
      prompt: {
        template: `Analyze the failure:

Failed Task: {{failedTaskId}}
Error: {{errorMessage}}
Input State: {{ impulse:input-state }}
Tool Results: {{ impulse:tool-results }}

Determine:
1. Root cause (most likely reason)
2. Contributing factors
3. What assumption failed`
      }
    },
    {
      id: "suggest-fix",
      description: "Recommend fixes",
      prompt: {
        template: `Based on the analysis, suggest fixes:

Root Cause: {{rootCause}}
Failed Task: {{ impulse:failed-task }}

Options:
1. Modify activity template
2. Change input impulses
3. Use different resolver
4. Try alternative activity

Provide specific recommendations.`
      }
    }
  ]
};
```

### Debug Impulse Pointer

```typescript
// Create impulse pointing to execution trace
const debugImpulse = {
  id: "debug-trace-123",
  pointer: {
    type: "activityExecutionTrace",
    executionId: "exec-failed-456",
    includeImpulses: true,  // Load full impulse content
    loadToolResults: true,   // Include tool outputs
    taskIds: ["task-3"]      // Focus on failed task
  },
  shape: "trace",
  budget: 8000,
  priority: "critical"
};
```

## 2. Testing Alternative Resolvers

### Use Case

When an impulse fails to resolve or provides low-quality content, test alternative resolvers.

### Comparison Structure

```typescript
interface ResolverComparison {
  impulse_id: string;
  impulse_shape: string;

  original: {
    resolver_type: string;
    pointer: ImpulsePointer;
    content: string;
    tokens: number;
    latency_ms: number;
    success: boolean;
  };

  alternatives: Array<{
    resolver_type: string;
    pointer: ImpulsePointer;
    content: string;
    tokens: number;
    latency_ms: number;
    success: boolean;
    quality_vs_original: number;  // -1 to +1
  }>;

  recommendation: {
    preferred_resolver: string;
    confidence: number;
    reason: string;
  };
}
```

### Test Activity

```typescript
const testAlternativeResolvers = {
  id: "test-alternative-resolvers",
  execution_type: "template",
  input_shapes: ["trace", "impulse_metadata"],
  output_shapes: ["comparison", "recommendation"],

  tasks: [
    {
      id: "identify-alternatives",
      description: "Find alternative resolvers",
      prompt: {
        template: `Impulse: {{ impulse:impulse-metadata }}
Current resolver: {{originalType}}

Available resolvers: file, memo, llm, sql, api, cache

Which alternatives make sense for {{impulseShape}}?`
      }
    },
    {
      id: "test-alternatives",
      description: "Test each alternative",
      // Uses tools to actually resolve with alternatives
    },
    {
      id: "compare-results",
      description: "Compare quality",
      prompt: {
        template: `Compare resolver outputs:

Original ({{originalType}}):
{{ impulse:original-content }}

Alternative 1 ({{alt1Type}}):
{{ impulse:alt1-content }}

Score each on: completeness, relevance, token efficiency.
Recommend best resolver.`
      }
    }
  ]
};
```

### Recording Comparison Results

```typescript
// POST /v2/activities/resolver-comparison
interface RecordComparisonRequest {
  execution_id: string;
  impulse_id: string;
  impulse_shape: string;

  original_resolver: {
    type: string;
    success: boolean;
    tokens: number;
    latency_ms: number;
  };

  tested_alternatives: Array<{
    type: string;
    success: boolean;
    tokens: number;
    latency_ms: number;
    quality_score: number;
  }>;

  recommended_resolver: string;
  reason: string;
}
```

## 3. A/B Testing Activity Variants

### Use Case

Compare multiple activity templates for the same goal to learn which performs best.

### Test Structure

```typescript
interface ActivityVariantTest {
  test_id: string;
  goal_description: string;

  // Shared inputs
  input_impulses: Impulse[];

  // Variants tested
  variants: Array<{
    activity_id: string;
    execution_id: string;
    success: boolean;
    quality_score: number;
    duration_ms: number;
    cost_usd: number;
  }>;

  // Winner
  winner: {
    activity_id: string;
    reason: string;
    confidence: number;
  };

  // Thompson update
  updates: Array<{
    activity_id: string;
    alpha_increment: number;
    beta_increment: number;
  }>;
}
```

### Test Activity

```typescript
const testActivityVariants = {
  id: "test-activity-variants",
  execution_type: "template",
  input_shapes: ["goal"],
  output_shapes: ["comparison", "winner"],

  tasks: [
    {
      id: "select-variants",
      description: "Choose variants to test",
      prompt: {
        template: `Goal: {{goalDescription}}

Available variants:
{{ impulse:candidate-activities }}

Select 2-3 variants that could address this goal.`
      }
    },
    {
      id: "execute-variant-1",
      description: "Run first variant",
      // Executes activity and measures results
    },
    {
      id: "execute-variant-2",
      description: "Run second variant",
      // Executes activity and measures results
    },
    {
      id: "compare-outcomes",
      description: "Compare and rank",
      prompt: {
        template: `Results:

Variant 1 ({{v1Name}}):
{{ impulse:v1-results }}

Variant 2 ({{v2Name}}):
{{ impulse:v2-results }}

Score on: correctness, efficiency, robustness.
Rank best to worst with reasoning.`
      }
    }
  ]
};
```

### Recording Test Results

```typescript
// POST /v2/activities/variant-test
interface RecordVariantTestRequest {
  test_id: string;
  goal_description: string;

  variants: Array<{
    activity_id: string;
    execution_id: string;
    rank: number;  // 1 = best
    success: boolean;
    quality_score: number;
    duration_ms: number;
    cost_usd: number;
  }>;

  winner_activity_id: string;
  winner_reason: string;
}
```

## 4. Replay Requirements

### What Must Be Captured

```typescript
interface ReplayCapture {
  // Task context
  task: {
    id: string;
    prompt: string;  // After interpolation
    tool_definitions: ToolDefinition[];
    validation_rules?: TaskValidation;
  };

  // Input state
  input_state: {
    files_available: string[];
    environment: Record<string, string>;
    impulses: string[];  // IDs
    impulse_hashes: Record<string, string>;  // ID → content hash
    variables: Record<string, unknown>;
  };

  // Execution record
  execution: {
    tool_calls: Array<{
      tool: string;
      params: Record<string, unknown>;
      result: ToolResult;
      timestamp: number;
    }>;
    llm_input: {
      system_prompt: string;
      messages: Message[];
    };
    llm_output: {
      content: string;
      finish_reason: string;
      tokens: { input: number; output: number };
    };
  };

  // Output state
  output_state: {
    files_modified: string[];
    files_created: string[];
    files_deleted: string[];
    file_hashes: Record<string, string>;
    exit_code?: number;
  };
}
```

### Immutable vs Modifiable

| Data | Status | Reason |
|------|--------|--------|
| execution_id | Immutable | Identity |
| activity_id | Immutable | What was executed |
| original_llm_response | Immutable | Historical record |
| impulse_content | Modifiable | Test alternatives |
| tool_results | Modifiable | Inject mocks |
| variables | Modifiable | Test variations |
| llm_parameters | Modifiable | Test temperature |

### Non-Determinism Handling

```typescript
interface ReplayStrategy {
  // LLM responses
  llm: "original" | "regenerate" | "sample";

  // File system
  filesystem: "restore" | "preserve" | "pristine";

  // Tool calls
  tools: "record" | "replay" | "mock";
}

// Example: Debug replay
const debugReplay: ReplayStrategy = {
  llm: "original",      // Use exact LLM response
  filesystem: "restore", // Reset to pre-execution state
  tools: "replay"        // Use recorded tool results
};

// Example: A/B test replay
const abTestReplay: ReplayStrategy = {
  llm: "regenerate",    // Get fresh LLM response
  filesystem: "pristine", // Clean environment
  tools: "record"        // Execute tools for real
};
```

## 5. Improvement Activity Pattern

### The Loop

```
1. DETECT: Failed execution identified
     ↓
2. ANALYZE: Debug activity runs on trace
     ↓
3. SUGGEST: Alternative approaches generated
     ↓
4. TEST: Alternatives executed with same inputs
     ↓
5. COMPARE: Results ranked
     ↓
6. RECORD: Thompson Sampling updated
     ↓
7. EXTRACT: Successful approach → new template (ribosome)
     ↓
8. REPEAT: New template available for future goals
```

### Improvement Activity

```typescript
const improveFailedActivity = {
  id: "improve-failed-activity",
  execution_type: "composition",
  input_shapes: ["trace"],  // Failed execution trace
  output_shapes: ["improved_template", "comparison"],

  child_activities: [
    "debug-failed-execution",     // Analyze failure
    "search-alternative-activities", // Find alternatives
    "test-activity-variants",      // A/B test
    "extract-successful-template"  // Ribosome extraction
  ],

  execution_strategy: "sequential"
};
```

### Recording Improvement

```typescript
// POST /v2/activities/improvement
interface RecordImprovementRequest {
  original_execution_id: string;  // What failed
  improved_execution_id: string;  // What succeeded

  improvement_type: "resolver" | "activity" | "parameters" | "composition";

  original_activity_id: string;
  improved_activity_id: string;

  quality_improvement: number;  // Percentage points
  cost_change: number;          // Percentage change in cost

  extracted_template_id?: string;  // If ribosome created new template
}
```

## 6. API Contracts

### Retrieve Execution for Debugging

```typescript
// GET /v2/activities/execution-traces/:id?include=impulses,tools
interface DebugTraceResponse {
  execution_id: string;
  activity_id: string;
  success: boolean;

  // Full state snapshots
  state_snapshots: {
    input: InputState;
    output: OutputState;
    transition: StateTransition;
  };

  // Task details
  tasks: Array<{
    id: string;
    status: string;
    tool_calls: ToolCall[];
    input_state: InputState;
    output_state: OutputState;
  }>;

  // Loaded impulse content (if include=impulses)
  impulses?: Array<{
    id: string;
    shape: string;
    content: string;
  }>;

  // Error details
  error?: {
    message: string;
    type: string;
    task_id: string;
    stack?: string;
  };
}
```

### Create Replay Execution

```typescript
// POST /v2/activities/replay
interface ReplayRequest {
  original_execution_id: string;

  strategy: ReplayStrategy;

  // Optional overrides
  overrides?: {
    impulses?: Record<string, string>;  // ID → new content
    tool_results?: Record<string, ToolResult>;
    variables?: Record<string, unknown>;
    llm_params?: { temperature?: number; model?: string };
  };

  // What to test
  hypothesis: string;  // "What if we used resolver X?"
}

interface ReplayResponse {
  replay_execution_id: string;
  original_execution_id: string;

  success: boolean;
  comparison: {
    original_success: boolean;
    replay_success: boolean;
    quality_change: number;
    cost_change: number;
  };
}
```

## Performance Targets

| Operation | Target Latency |
|-----------|----------------|
| Load execution trace | < 500ms |
| Load with impulses | < 2s |
| Replay execution | Same as original |
| Record comparison | < 100ms |
| Thompson update | < 50ms |
