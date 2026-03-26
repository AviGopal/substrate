# Meta-Level Activity Execution Engine: Building Execution Engines from Activity Composition

## Executive Summary

**Key Insight**: Activity templates can invoke other activities, enabling you to build **execution engines as compositions of activities** rather than monolithic code.

**Result**: Self-improving, learnable execution systems where every workflow becomes a reusable template.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Three Composition Patterns](#three-composition-patterns)
3. [MiniBob Architecture Support](#minibob-architecture-support)
4. [Building a Complete Execution Engine](#building-a-complete-execution-engine)
5. [Real-World Example: CI/CD Engine](#real-world-example-cicd-engine)
6. [Self-Improvement Loop](#self-improvement-loop)
7. [Implementation Guide](#implementation-guide)

---

## Core Concepts

### Activities Calling Activities

The foundation is simple: **activity tasks can invoke other activities via the `activity` tool**.

```typescript
// Task in parent activity
{
  id: "run-sub-workflow",
  prompt: {
    template: `
      Use the activity tool to execute "child-activity":
      
      activity({
        templateId: "child-activity",
        variables: { 
          param1: "{{parentVar1}}",
          param2: "{{parentVar2}}"
        },
        reason: "Sub-workflow execution from parent activity"
      })
    `
  }
}
```

### Output Passing via Impulses

Sub-activity outputs are available to downstream tasks via `activityOutput` impulses:

```typescript
{
  id: "process-results",
  dependencies: ["run-sub-workflow"],
  impulseReferences: ["subWorkflowOutput"],
  contextRequirements: [
    {
      key: "subWorkflowOutput",
      impulseTypes: ["activityOutput"],
      hint: "Results from the sub-workflow execution"
    }
  ],
  prompt: {
    template: `
      The subWorkflowOutput impulse contains results from the previous activity.
      Process these results and continue the workflow.
    `
  }
}
```

### Unlimited Composition Depth

MiniBob supports **recursive composition** - activities can call activities that call activities, infinitely:

```
Meta-Executor Activity
  ├─> Workflow Activity A
  │     ├─> Build Activity
  │     ├─> Test Activity
  │     └─> Deploy Activity
  │           ├─> Health Check Activity
  │           └─> Rollback Activity (if needed)
  └─> Workflow Activity B
        ├─> Analysis Activity
        └─> Report Activity
```

---

## Three Composition Patterns

### Pattern 1: Direct Invocation (Explicit Orchestration)

**Use Case**: Known workflow with specific activities to call in sequence.

**Characteristics**:
- Hardcoded activity IDs in task prompts
- Explicit variable passing
- Predictable execution flow
- Best for stable, repeatable workflows

**Example**:
```typescript
{
  id: "deploy-workflow",
  tasks: [
    {
      id: "build-step",
      prompt: {
        template: `
          Execute activity "build-docker-image" with:
          - imageName: {{serviceName}}
          - version: {{version}}
        `
      }
    },
    {
      id: "test-step",
      dependencies: ["build-step"],
      prompt: {
        template: `
          Execute activity "run-integration-tests" with:
          - image: {{serviceName}}:{{version}}
          - environment: staging
        `
      }
    },
    {
      id: "deploy-step",
      dependencies: ["test-step"],
      prompt: {
        template: `
          Execute activity "deploy-to-kubernetes" with:
          - deployment: {{serviceName}}
          - image: {{serviceName}}:{{version}}
          - namespace: {{targetNamespace}}
        `
      }
    }
  ]
}
```

### Pattern 2: Goal-Seeking Decomposition (Autonomous)

**Use Case**: Complex, novel goals that need intelligent decomposition.

**Characteristics**:
- Uses `create_activity_goal_seeking` to generate plans
- Searches for existing activities to reuse
- Creates new tasks only for gaps
- Best for exploratory or evolving workflows

**Example**:
```typescript
{
  id: "autonomous-executor",
  tasks: [
    {
      id: "decompose-goal",
      prompt: {
        template: `
          Use create_activity_goal_seeking to break down:
          
          Goal: {{userGoal}}
          Category: {{goalCategory}}
          Variables: {{contextVariables}}
          
          This will:
          1. Decompose goal into sub-goals
          2. Search for existing activities to reuse
          3. Generate custom tasks for gaps
          4. Return executable activity template
        `
      }
    },
    {
      id: "execute-generated",
      dependencies: ["decompose-goal"],
      prompt: {
        template: `
          Execute the generated activity template:
          - Use variables from decomposition
          - Pass impulses for context
          - Monitor and report results
        `
      }
    }
  ]
}
```

### Pattern 3: Dynamic Discovery (Search-Based)

**Use Case**: Workflows where best activity is determined at runtime.

**Characteristics**:
- Uses `search_activities` to discover options
- Selects based on success rates, context, or criteria
- Adapts to available templates
- Best for Thompson sampling optimization

**Example**:
```typescript
{
  id: "adaptive-executor",
  tasks: [
    {
      id: "discover-options",
      prompt: {
        template: `
          Search for activities matching the task:
          
          search_activities({ 
            category: "{{taskCategory}}",
            verbose: true 
          })
          
          Evaluate results by:
          - Success rate (prefer >80%)
          - Average cost (prefer <$1)
          - Description match to intent
        `
      }
    },
    {
      id: "select-and-execute",
      dependencies: ["discover-options"],
      prompt: {
        template: `
          From discovered activities, select best match:
          
          Selection criteria:
          1. Highest success rate
          2. Matches required variables
          3. Fits within cost budget
          
          Execute selected activity with:
          - Variables: {{executionVariables}}
          - Reason: {{executionReason}}
          
          If no match found:
          - Fall back to create_activity_goal_seeking
        `
      }
    }
  ]
}
```

---

## MiniBob Architecture Support

MiniBob is **designed from the ground up** to support meta-level activity composition:

### 1. Activity-First Constraint

```typescript
// repos/minibob/src/activity.ts (lines 520-567)
private getDefaultSystemPrompt(): string {
  return `You are minibob, an autonomous vessel that creates and composes 
  activities instead of using direct tool calls.
  
  **CORE PRINCIPLE**: You learn by creating reusable activities, not by 
  executing one-off tool calls.
  
  For NON-TRIVIAL tasks:
    1. search_activities() to find existing templates
    2. If match found: Execute the activity
    3. If no match: create_activity_goal_seeking() to create new template
  `
}
```

**Implication**: MiniBob **enforces** composition thinking. Direct tool use is only allowed for trivial operations.

### 2. MCP Activity Callbacks

```typescript
// repos/minibob/src/activity.ts (lines 30-44)
export interface ExecutorConfig {
  provider: "anthropic" | "openai"
  apiKey: string
  model: string
  workingDirectory: string
  systemPrompt?: string
  
  // Activity management callbacks (for autonomous trailblazing)
  onSearchActivities?: (category?: string, verbose?: boolean) => 
    Promise<{ count: number; activities: unknown[] }>
  
  onCreateActivity?: (params: {
    goalDescription: string
    templateName: string
    category: string
    variables: Record<string, unknown>
  }) => Promise<{ templateId: string }>
}
```

**Implication**: MiniBob can wire into **backend learning systems** for:
- Template discovery from registry
- Goal-based template generation
- Thompson sampling for optimization

### 3. Nested Activity Execution

```typescript
// repos/minibob/src/activity.ts (lines 67-72)
onActivityExecute: async (templateId, variables, reason) => {
  // Nested activity execution
  const template = await loadTemplateFromMCPOrLocal(templateId)
  const nestedExecutor = new ActivityExecutor(config)
  return nestedExecutor.execute({ template, variables, reason })
}
```

**Implication**: Supports **unlimited recursion depth**. Activities calling activities calling activities works seamlessly.

### 4. Impulse-Based Context Threading

```typescript
// repos/minibob/src/activity.ts (lines 216-299)
private async createImpulsesFromRequirements(
  activityId: string,
  template: ActivityTemplate,
  variables: Record<string, unknown>
): Promise<Impulse[]> {
  // Creates impulses for:
  // - File context
  // - Glob patterns  
  // - Memos
  // - Custom resolvers
  // - Activity outputs
}
```

**Implication**: Sub-activity outputs automatically become impulses for downstream tasks.

---

## Building a Complete Execution Engine

### Architecture

```
┌─────────────────────────────────────────────────────┐
│         META-LEVEL EXECUTION ENGINE                 │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Stage 1: Discovery & Selection                │ │
│  │  - search_activities()                        │ │
│  │  - Evaluate options (success rate, cost)      │ │
│  │  - Select best match OR trigger decomposition │ │
│  └───────────────────────────────────────────────┘ │
│                      ↓                              │
│  ┌───────────────────────────────────────────────┐ │
│  │ Stage 2: Goal Decomposition (if needed)       │ │
│  │  - create_activity_goal_seeking()             │ │
│  │  - Decompose complex goals                    │ │
│  │  - Compose from existing activities           │ │
│  │  - Generate DAG for execution                 │ │
│  └───────────────────────────────────────────────┘ │
│                      ↓                              │
│  ┌───────────────────────────────────────────────┐ │
│  │ Stage 3: Context Gathering                    │ │
│  │  - Create impulses for required context       │ │
│  │  - impulse_create() for each requirement      │ │
│  │  - Budget-aware loading                       │ │
│  └───────────────────────────────────────────────┘ │
│                      ↓                              │
│  ┌───────────────────────────────────────────────┐ │
│  │ Stage 4: Execution                            │ │
│  │  - activity({ templateId, variables, reason })│ │
│  │  - Monitor progress                           │ │
│  │  - Capture activityOutput impulses            │ │
│  └───────────────────────────────────────────────┘ │
│                      ↓                              │
│  ┌───────────────────────────────────────────────┐ │
│  │ Stage 5: Learning & Evolution                 │ │
│  │  - Analyze execution metrics                  │ │
│  │  - Detect novel patterns                      │ │
│  │  - register_activity_template() if reusable   │ │
│  │  - Report to backend (Thompson sampling)      │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Result: SELF-IMPROVING EXECUTION ENGINE            │
└─────────────────────────────────────────────────────┘
```

### Key Properties

1. **Composition-First**: Searches for existing activities before creating new ones
2. **Goal-Driven**: Decomposes complex goals into executable DAGs
3. **Context-Aware**: Uses impulses to thread context through workflow
4. **Self-Improving**: Records metrics and creates templates from novel patterns
5. **Thompson Sampling**: Backend learns optimal activity selection over time

---

## Real-World Example: CI/CD Engine

See `examples/meta-cicd-execution-engine.json` for a complete implementation.

### What It Does

1. **Analyzes Changes**: Discovers and runs git diff analysis activity
2. **Builds Services**: Composes build activities for affected services
3. **Runs Tests**: Selects appropriate test suite based on scope
4. **Deploys**: Conditionally deploys based on test results
5. **Evolves**: Creates new templates from novel CI/CD patterns

### Key Features

- **Dynamic Composition**: Builds different pipelines based on change scope
- **Conditional Execution**: Only deploys if tests pass
- **Self-Learning**: Creates new pipeline templates from successful runs
- **Cost-Aware**: Tracks metrics for Thompson sampling optimization

### Execution Flow

```
User: "Deploy feature-auth to staging"
  ↓
Meta-Executor searches: "analyze git changes"
  → Finds: analyze-git-diff (95% success)
  → Executes with: branch=feature-auth, base=main
  ↓
Result: Changed files in auth service only
  ↓
Meta-Executor searches: "build docker image"
  → Finds: build-docker-image (92% success)
  → Executes for: auth-service only (not entire stack!)
  ↓
Result: Image built successfully
  ↓
Meta-Executor searches: "run tests"
  → Based on scope: runs "run-affected-tests" (not full suite)
  → Executes with: services=[auth-service]
  ↓
Result: All tests pass
  ↓
Meta-Executor searches: "deploy to staging"
  → Finds: deploy-to-k8s (88% success)
  → Executes with: service=auth-service, env=staging
  ↓
Result: Deployment successful
  ↓
Meta-Executor analyzes:
  - Pattern: "auth service only" pipeline
  - Duration: 3m 45s (faster than full pipeline!)
  - Cost: $0.12 (cheaper!)
  → Creates new template: "cicd-single-service-staging"
  → Registers for future reuse
  ↓
Next time: "Deploy profile-service to staging"
  → Meta-Executor finds: cicd-single-service-staging (100% success!)
  → Re-uses learned pattern
```

**Result**: The execution engine **improves itself** by learning efficient patterns!

---

## Self-Improvement Loop

### How It Works

```
┌─────────────────────────────────────────────────────┐
│ Execution N: Novel Pattern                         │
│  - User: "Deploy microservice A"                    │
│  - No exact match found                             │
│  - create_activity_goal_seeking() generates plan    │
│  - Composes: analyze → build → test → deploy        │
│  - Records: SUCCESS, 4m, $0.15                      │
│  - Registers template: "deploy-single-microservice" │
└──────────────┬──────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────┐
│ Backend Learning (Thompson Sampling)                │
│  - Template: deploy-single-microservice             │
│  - Executions: 1                                    │
│  - Success Rate: 100%                               │
│  - Avg Duration: 4m                                 │
│  - Avg Cost: $0.15                                  │
│  → Score: High (new but successful)                 │
└──────────────┬──────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────┐
│ Execution N+1: Similar Request                      │
│  - User: "Deploy microservice B"                    │
│  - search_activities() finds both:                  │
│    1. deploy-full-stack (50 execs, 85% success)     │
│    2. deploy-single-microservice (1 exec, 100%)     │
│  → Thompson Sampling selects #2 (exploration)       │
│  - Executes: SUCCESS, 3m 50s, $0.14                 │
│  - Updates: 2 execs, 100% success                   │
└──────────────┬──────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────┐
│ Execution N+10: Pattern Established                │
│  - Template: deploy-single-microservice             │
│  - Executions: 10                                   │
│  - Success Rate: 95%                                │
│  - Avg Duration: 3m 55s                             │
│  - Avg Cost: $0.14                                  │
│  → Score: Very High (proven + efficient)            │
│  → Becomes PREFERRED choice for this pattern        │
└─────────────────────────────────────────────────────┘
```

### Evolution Triggers

The execution engine creates new templates when:

1. **Novel Composition**: Unique combination of activities succeeds
2. **Optimization**: Discovers faster/cheaper path than existing templates
3. **Specialization**: Frequent pattern warrants dedicated template
4. **Generalization**: Similar templates can be merged with better parameterization

### Backend Integration

```typescript
// After each execution
if (isMCPEnabled()) {
  const mcp = getMCPClient()
  await mcp.reportExecution({
    templateId: executedTemplate,
    success: true,
    duration: 240000, // 4 minutes
    cost: 0.15,
    tokens: { input: 5000, output: 2000, cache: 0 }
  })
}

// Backend updates Thompson sampling scores
// Next execution benefits from learned metrics
```

---

## Implementation Guide

### Step 1: Create the Meta-Executor Template

```typescript
{
  "id": "your-meta-executor",
  "name": "Your Meta-Level Execution Engine",
  "category": "infrastructure",
  "tasks": [
    // Stage 1: Discovery
    { 
      "id": "discover",
      "prompt": {
        "template": "search_activities({ category: '{{category}}' })"
      }
    },
    
    // Stage 2: Execute or Decompose
    {
      "id": "execute-or-decompose",
      "dependencies": ["discover"],
      "prompt": {
        "template": `
          If exact match: activity({ templateId, variables, reason })
          Else: create_activity_goal_seeking({ goalDescription, ... })
        `
      }
    },
    
    // Stage 3: Learn
    {
      "id": "learn",
      "dependencies": ["execute-or-decompose"],
      "prompt": {
        "template": `
          If novel pattern:
            register_activity_template({
              file_path: generated_template,
              validate_before_register: true
            })
        `
      }
    }
  ]
}
```

### Step 2: Register the Template

```bash
# Save template to file
cat > meta-executor.json << EOF
{ ... your template ... }
EOF

# Register with backend
opencode activity register meta-executor.json
```

### Step 3: Execute via MiniBob

```bash
# Deploy minibob with MCP enabled
kubectl apply -f helm/minibob/

# Execute the meta-executor
curl -X POST http://minibob:3100/execute \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "your-meta-executor",
    "variables": {
      "userGoal": "Deploy auth service",
      "category": "infrastructure"
    },
    "reason": "User-initiated deployment"
  }'
```

### Step 4: Monitor Learning

```bash
# Check template metrics
opencode activity metrics your-meta-executor

# View execution history
opencode activity history --template your-meta-executor

# See Thompson sampling scores
opencode activity search --category infrastructure --verbose
```

---

## Advanced Patterns

### Parallel Composition

Execute multiple activities concurrently:

```typescript
{
  "id": "parallel-executor",
  "tasks": [
    {
      "id": "run-parallel-branch-1",
      "dependencies": [],
      "prompt": {
        "template": "Execute activity-a with {{varsA}}"
      }
    },
    {
      "id": "run-parallel-branch-2",
      "dependencies": [],
      "prompt": {
        "template": "Execute activity-b with {{varsB}}"
      }
    },
    {
      "id": "merge-results",
      "dependencies": ["run-parallel-branch-1", "run-parallel-branch-2"],
      "impulseReferences": ["outputA", "outputB"],
      "prompt": {
        "template": "Combine results from both branches"
      }
    }
  ]
}
```

### Conditional Branching

Different paths based on runtime conditions:

```typescript
{
  "id": "conditional-executor",
  "tasks": [
    {
      "id": "check-condition",
      "prompt": {
        "template": "Evaluate: {{condition}}"
      }
    },
    {
      "id": "branch-decision",
      "dependencies": ["check-condition"],
      "prompt": {
        "template": `
          If condition is true:
            activity({ templateId: "path-a", ... })
          Else:
            activity({ templateId: "path-b", ... })
        `
      }
    }
  ]
}
```

### Error Recovery

Graceful degradation with fallback activities:

```typescript
{
  "id": "resilient-executor",
  "tasks": [
    {
      "id": "try-primary",
      "retry": { "maxAttempts": 2 },
      "prompt": {
        "template": "Execute primary-activity with {{vars}}"
      }
    },
    {
      "id": "fallback-if-failed",
      "dependencies": ["try-primary"],
      "prompt": {
        "template": `
          Check previous task result.
          If failed:
            Execute fallback-activity with {{vars}}
            Record: primary failed, fallback succeeded
        `
      }
    }
  ]
}
```

---

## Benefits Summary

### 1. **Composability**
- Build complex workflows from simple building blocks
- Unlimited composition depth
- Reuse proven patterns

### 2. **Learnability**
- Every execution improves the system
- Thompson sampling optimizes selection
- Novel patterns become templates automatically

### 3. **Adaptability**
- Runtime discovery of best approach
- Dynamic composition based on context
- Graceful degradation with fallbacks

### 4. **Maintainability**
- Workflows are declarative templates, not code
- Changes to sub-activities propagate automatically
- Version control for activity templates

### 5. **Observability**
- Full execution traces
- Metrics for every activity
- Learning feedback loop visible

---

## Conclusion

By treating **execution engines as compositions of activities**, you create systems that:

1. ✅ **Learn** from every execution
2. ✅ **Improve** by creating better templates
3. ✅ **Adapt** to new patterns automatically
4. ✅ **Scale** through composition, not duplication
5. ✅ **Evolve** without manual intervention

This is the **"activities all the way down"** vision - where the execution engine itself is built from the same reusable building blocks it orchestrates.

**MiniBob embodies this philosophy**: It's an autonomous vessel that composes activities instead of executing tools directly, creating a self-improving execution system that gets better with every run.

---

## References

- **MiniBob Implementation**: `repos/minibob/src/activity.ts`
- **Activity Composition Tests**: `repos/metabob-opencode/packages/opencode/test/session/activity-composition.test.ts`
- **Trailblazing Architecture**: `TRAILBLAZING_ARCHITECTURE_SUMMARY.md`
- **Example CI/CD Engine**: `examples/meta-cicd-execution-engine.json`
- **Hierarchical Composition Spec**: Tag `spec-hierarchical-activity-composition-standard-v1`
