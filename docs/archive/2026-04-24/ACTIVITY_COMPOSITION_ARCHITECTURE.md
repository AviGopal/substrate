# MiniBob Activity Composition Architecture

## Overview

MiniBob implements a sophisticated **activity composition system** that enables activities to call other activities, creating complex workflows from simpler building blocks. This document explains how activities are composed and how MiniBob handles traversal of the activity execution graph.

---

## Part 1: How Activities are Created by Composition

### 1.1 Composition Mechanism

Activities are composed through a **callback-based mechanism** where an activity can invoke another activity during its execution:

```typescript
// From activity.ts - ExecutorConfig
interface ExecutorConfig {
  /**
   * Callback when an activity is executed (for composition tracking)
   */
  onActivityExecute?: (
    templateId: string,
    variables: Record<string, unknown>,
    reason?: string,
  ) => Promise<ActivityExecution>;
}
```

**Key Points:**
- The `onActivityExecute` callback is invoked when an activity wants to execute another activity
- It receives the child activity's template ID, variables, and execution reason
- It returns an `ActivityExecution` object containing the child activity's results
- This is **non-blocking** and allows parent activities to use child activity outputs

### 1.2 Activity Execution Flow

When an activity calls another activity, the flow is:

```
Parent Activity (running)
    ↓
onActivityExecute callback invoked
    ↓
Child Activity Template loaded
    ↓
Child Activity Executor creates execution context
    ↓
Child Activity executes its tasks
    ↓
Results returned as ActivityExecution
    ↓
Parent continues with child's outputs in context
```

### 1.3 Built-in Activity Resolver

MiniBob provides a built-in **activity resolver** that enables activities to call other activities using tool calls:

```typescript
// From activity.ts - line 1296+
// Activity resolver for composition (enables activities to call other activities)
const activityResolver: Resolver = {
  name: "activity",
  enabled: true,
  resolve: async (impulseRefs, config) => {
    // Resolves activity_id from config
    // Loads the activity template
    // Executes it with provided variables
    // Returns outputs as impulses
  },
};
```

**Usage Pattern:**
Activities can directly invoke other activities by referencing them:

```yaml
# In an activity template
tasks:
  - id: invoke-child
    resolver: activity
    config:
      activity_id: "some-other-activity"
      variables:
        param1: "value1"
```

---

## Part 2: How MiniBob Handles Activity Execution Graph Traversal

### 2.1 Call Stack Tracking

MiniBob prevents infinite recursion and cycles through **call stack tracking**:

```typescript
// From activity.ts - ExecutorConfig
interface ExecutorConfig {
  /**
   * Activity call stack for cycle detection.
   * Tracks the chain of activity IDs from root to current execution.
   * Used to detect and prevent circular activity calls (A → B → A).
   *
   * Example: ["process-goal", "explore-codebase", "read-file"]
   *
   * Internal use only - populated automatically during composition.
   */
  activityCallStack?: string[];

  /**
   * Maximum nesting depth for nested activity execution.
   * Prevents runaway recursion when activities call other activities.
   * Default: 3
   */
  maxNestingDepth?: number;
}
```

**Key Features:**
- `activityCallStack`: Chain of activity IDs from root to current execution
- `maxNestingDepth`: Maximum nesting level (default: 3)
- Prevents circular dependencies (A → B → A)
- Prevents deep recursion chains

### 2.2 Composition Context Propagation

When executing a child activity, MiniBob propagates context to track the composition relationship:

```typescript
// From activity.ts - ExecuteOptions
interface ExecuteOptions {
  // Parent activity context for composition tracking
  parentActivityId?: string;
  parentExecutionId?: string;
  goalContext?: string;
  
  // ... other options
}
```

**Propagated Context:**
- `parentActivityId`: The activity that invoked this one
- `parentExecutionId`: The specific execution instance that invoked this
- `goalContext`: The original goal from the root activity
- `sessionId`: Session-level context for tracking

### 2.3 Composition Observer

MiniBob provides a **CompositionObserver** for real-time tracking of activity composition:

```typescript
// From composition-observer.ts
export class CompositionObserver {
  private events: CompositionEvent[] = [];
  private callStack: string[] = [];
  private activityMetrics = new Map<string, {
    calls: number;
    successes: number;
    failures: number;
    blocked: number;
    totalDuration: number;
  }>();

  /**
   * Records when a child activity is invoked
   */
  recordEvent(event: CompositionEvent): void;

  /**
   * Tracks the call depth
   */
  getCallDepth(): number;

  /**
   * Detects circular references
   */
  hasCycle(): boolean;

  /**
   * Returns metrics about activity composition
   */
  getMetrics(): ActivityMetrics[];
}
```

**Event Structure:**
```typescript
interface CompositionEvent {
  timestamp: number;
  parent: string;           // Parent activity ID
  child: string;            // Child activity ID
  depth: number;            // Call depth
  reason?: string;          // Why the call was made
  status?: "started" | "completed" | "failed" | "blocked";
  duration?: number;        // Execution time
  error?: string;           // Error message if failed
}
```

### 2.4 Resolver Graph Executor

For **complex workflows**, MiniBob provides a **ResolverGraphExecutor** that handles arbitrary DAGs:

```typescript
// From resolver-graph-executor-resolver.ts
export interface GraphNode {
  id: string;                    // Unique node ID
  resolver: string;              // Resolver to execute (e.g., "bash", "activity")
  config: Record<string, unknown>; // Resolver config
  inputImpulses: string[];       // Input impulses or node IDs
  condition?: {                   // Optional conditional execution
    expression: string;
    context: Record<string, unknown>;
  };
}

export interface GraphEdge {
  from: string;        // Source node ID
  to: string;          // Target node ID
  dataFlow?: {         // Optional data flow mapping
    outputKey: string;
    inputKey: string;
  };
}
```

**Graph Execution Strategy:**
1. **Validation**: Cycle detection via DFS, reference validation
2. **Planning**: Topological sort to determine execution order
3. **Grouping**: Independent nodes grouped for parallel execution
4. **Execution**: Sequential or parallel execution based on strategy
5. **Propagation**: Impulses flow between nodes via edges

### 2.5 Execution Trace Generation

All composition traversals are recorded in detailed execution traces:

```typescript
interface GraphExecutionTrace {
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  executionOrder: string[];        // Node IDs in execution order
  parallelGroups: string[][];      // Parallel execution batches
  nodeResults: NodeExecutionResult[];
  totalDuration: number;
  success: boolean;
  nodesExecuted: number;
  nodesSkipped: number;
  nodesFailed: number;
}
```

---

## Part 3: Detailed Traversal Algorithm

### 3.1 Depth-First Search for Cycle Detection

```typescript
// From resolver-graph-executor-resolver.ts
private detectCycles(nodes: GraphNode[], edges: GraphEdge[]): void {
  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  
  // DFS with recursion stack tracking
  const hasCycle = (nodeId: string): boolean => {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    for (const neighbor of adjacency.get(nodeId) || []) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;  // Cycle detected
      } else if (recursionStack.has(neighbor)) {
        return true;  // Back edge - cycle found
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };
}
```

### 3.2 Topological Sort for Execution Order

```
Input:  Graph with nodes A, B, C and edges A→B, A→C
        ┌─→ B
    A ─┤
        └─→ C

Algorithm:
1. Start with nodes having no incoming edges (A)
2. Add to execution order: [A]
3. Remove A and its outgoing edges
4. Find next nodes with no incoming edges: [B, C]
5. Add to execution order: [B, C]
6. Can execute B and C in parallel

Output: executionOrder = [A], parallelGroups = [[B, C]]
```

### 3.3 Impulse Flow Through Graph

Impulses flow between nodes via edges:

```
Node A executes
    ↓
Output impulses created
    ↓
Edges map outputs to inputs
    ↓
Node B receives impulses as inputs
    ↓
Node B executes with propagated context
```

**Data Flow Mapping Example:**
```typescript
{
  from: "node-a",
  to: "node-b",
  dataFlow: {
    outputKey: "result",      // Extract from node-a output
    inputKey: "input_file"    // Map to node-b input
  }
}
```

---

## Part 4: Composition Learning & Recording

### 4.1 Composition Edge Recording

When a child activity completes successfully, MiniBob records the composition relationship:

```typescript
// From activity.ts - Line 2906+
// COMPOSITION LEARNING: Record composition edge to backend
if (execution.success && config.onCompositionEdge) {
  try {
    // Record: parent activity → child activity
    await config.onCompositionEdge({
      fromActivity: parentActivity.activity_id,
      toActivity: execution.templateId,
      reason: execution.reason,
      success: true,
      durationMs: execution.durationMs,
      outputShapes: execution.outputShapes,
      inputShapes: execution.inputShapes,
    });
  } catch (error) {
    log.error("Failed to record composition edge", error);
  }
}
```

### 4.2 Shape Overlap Detection

MiniBob learns which activities compose well together by tracking **shape overlap**:

```typescript
// When Activity A calls Activity B:
// A's output shapes ∩ B's input shapes = overlap
// High overlap → activities compose well
// Low overlap → indicates possible issues

const overlapScore = calculateShapeOverlap(
  parentActivity.outputShapes,  // What A produces
  childActivity.inputShapes      // What B consumes
);
```

### 4.3 Composition Metrics

The system tracks composition metrics for all activities:

```typescript
interface ActivityMetrics {
  activityId: string;
  calls: number;              // How many times called
  successes: number;          // Successful executions
  failures: number;           // Failed executions
  blocked: number;            // Blocked due to cycle/depth
  totalDuration: number;      // Total execution time
  avgDuration: number;        // Average execution time
  successRate: number;        // Success percentage
}
```

---

## Part 5: Error Handling in Composition

### 5.1 Cycle Detection Prevention

```typescript
// Before executing child activity:
if (callStack.includes(childActivityId)) {
  // Circular dependency detected
  throw new Error(`Circular activity dependency: ${callStack.join(' → ')} → ${childActivityId}`);
}
```

### 5.2 Depth Limit Enforcement

```typescript
const maxDepth = config.maxNestingDepth || 3;
if (callStack.length >= maxDepth) {
  throw new Error(`Maximum activity nesting depth (${maxDepth}) exceeded`);
}
```

### 5.3 Fallback Mechanisms

If a child activity fails:
1. Parent can handle the failure (if error handling is defined)
2. Partial results are propagated
3. Execution trace captures the failure
4. Composition edge is NOT recorded (learning only from successes)

---

## Part 6: Practical Examples

### Example 1: Simple Linear Composition

```yaml
# Activity A calls Activity B
activities:
  - id: activity-a
    name: "Process Data"
    tasks:
      - id: invoke-b
        resolver: activity
        config:
          activity_id: activity-b
          variables:
            data: "input"

  - id: activity-b
    name: "Analyze Data"
    tasks:
      - id: analyze
        resolver: bash
        config:
          command: "echo 'analyzing...'"
```

**Execution Flow:**
```
activity-a starts
  ↓
invoke-b executes
  ↓
activity-b loaded and executed
  ↓
results returned to activity-a
  ↓
activity-a completes
```

### Example 2: Graph Composition

```yaml
# Complex workflow with parallel execution
graph:
  nodes:
    - id: setup
      resolver: bash
      config:
        command: "mkdir -p output"
    
    - id: build
      resolver: activity
      config:
        activity_id: compile
      inputImpulses: ["setup"]
    
    - id: test
      resolver: activity
      config:
        activity_id: run-tests
      inputImpulses: ["build"]
    
    - id: deploy
      resolver: activity
      config:
        activity_id: deploy-app
      inputImpulses: ["test"]

  edges:
    - from: setup
      to: build
    - from: build
      to: test
    - from: test
      to: deploy
```

**Execution Trace:**
```
[setup] (executes)
  ↓
[build] (executes with setup outputs)
  ↓
[test] (executes with build outputs)
  ↓
[deploy] (executes with test outputs)

Execution Order: [setup, build, test, deploy]
Parallel Groups: [[setup], [build], [test], [deploy]]
```

### Example 3: Parallel Composition

```yaml
graph:
  nodes:
    - id: prepare
      resolver: bash
      config:
        command: "echo 'preparing'"
    
    - id: task-a
      resolver: activity
      config:
        activity_id: parallel-a
      inputImpulses: ["prepare"]
    
    - id: task-b
      resolver: activity
      config:
        activity_id: parallel-b
      inputImpulses: ["prepare"]
    
    - id: aggregate
      resolver: activity
      config:
        activity_id: aggregate-results
      inputImpulses: ["task-a", "task-b"]

  edges:
    - from: prepare
      to: task-a
    - from: prepare
      to: task-b
    - from: task-a
      to: aggregate
    - from: task-b
      to: aggregate

execution:
  strategy: "parallel"
  maxParallelism: 2
```

**Execution Trace:**
```
[prepare]
  ↓
[task-a] ────┐
             ├→ [aggregate]
[task-b] ────┘

Execution Order: [prepare, task-a, task-b, aggregate]
Parallel Groups: [[prepare], [task-a, task-b], [aggregate]]
```

---

## Part 7: Key Architectural Decisions

### 7.1 Why Composition via Callbacks?

**Advantages:**
- Decouples parent and child activities
- Allows composition tracking at execution level
- Enables non-blocking async composition
- Supports custom composition handlers

**Trade-offs:**
- Requires config injection
- Limits some static analysis capabilities
- Runtime cycle detection (not compile-time)

### 7.2 Why Graph-based Execution?

**Advantages:**
- Supports arbitrary DAG topologies
- Enables parallel execution
- Clear impulse flow semantics
- Detailed execution tracing
- Composable with other resolvers (not just activities)

**Use Cases:**
- Multi-stage pipelines
- Parallel workloads
- Data transformation chains
- Orchestration workflows

### 7.3 Why Shape-based Learning?

**Advantages:**
- Learns which activities compose naturally
- Detects shape mismatches early
- Enables composition recommendations
- Improves activity placement

---

## Part 8: Best Practices

### 8.1 Designing Composable Activities

1. **Clear Inputs & Outputs**
   - Define expected input shapes
   - Specify output shapes
   - Use consistent naming

2. **Error Handling**
   - Don't assume child activities succeed
   - Implement fallbacks
   - Propagate errors appropriately

3. **Depth Awareness**
   - Be conscious of nesting depth
   - Avoid deep recursion
   - Consider graph-based execution for complex workflows

### 8.2 Composition Optimization

1. **Parallel Execution**
   - Use graph executor for independent tasks
   - Set maxParallelism appropriately
   - Monitor resource usage

2. **Shape Alignment**
   - Match output shapes to input shapes
   - Use shape transformations when needed
   - Document shape contracts

3. **Fallback Paths**
   - Define conditional execution
   - Implement retry logic
   - Handle partial failures gracefully

---

## Summary

MiniBob's activity composition system provides:

1. **Simple Composition**: Activities call other activities via `onActivityExecute` callback
2. **Graph Execution**: Complex workflows via DAG with topological sorting
3. **Safety**: Cycle detection, depth limits, call stack tracking
4. **Learning**: Composition edge recording and shape-based recommendations
5. **Traceability**: Detailed execution traces for debugging and analysis

The system is designed to be flexible, safe, and learnable - supporting both simple linear composition chains and complex parallel workflows while preventing runaway recursion and circular dependencies.
