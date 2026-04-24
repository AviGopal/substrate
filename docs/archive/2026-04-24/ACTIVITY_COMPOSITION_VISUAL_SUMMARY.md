# MiniBob Activity Composition - Visual Reference

## Quick Reference Diagrams

### 1. Basic Composition Flow

```
┌─────────────────────────────────────────────────────┐
│        Parent Activity Executes                      │
│  ┌───────────────────────────────────────────────┐  │
│  │ Task 1: Do something                          │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │ Task 2: Invoke Child Activity                 │  │
│  │  resolver: activity                           │  │
│  │  config:                                      │  │
│  │    activity_id: "child-activity"              │  │
│  │    variables: {param: "value"}                │  │
│  └───────┬───────────────────────────────────────┘  │
│          │                                            │
│          │ onActivityExecute callback                │
│          ↓                                            │
│  ┌───────────────────────────────────────────────┐  │
│  │    ☐ Child Activity Execution Context        │  │
│  │    ├─ parentActivityId: "parent-activity"    │  │
│  │    ├─ activityCallStack: [..., "parent"]     │  │
│  │    └─ variables: {param: "value"}            │  │
│  └───────┬───────────────────────────────────────┘  │
│          │                                            │
│          ↓ Load & Execute                            │
│  ┌───────────────────────────────────────────────┐  │
│  │    Child Activity Tasks Run                   │  │
│  │    [Child Task 1] → [Child Task 2] → ...     │  │
│  └───────┬───────────────────────────────────────┘  │
│          │                                            │
│          ↓ ActivityExecution returned                │
│  ┌───────────────────────────────────────────────┐  │
│  │    Results Available:                         │  │
│  │    ├─ success: boolean                        │  │
│  │    ├─ output: string                          │  │
│  │    ├─ cost: number                            │  │
│  │    └─ taskResults: TaskResult[]               │  │
│  └───────┬───────────────────────────────────────┘  │
│          │                                            │
│          ↓ Continue parent execution                 │
│  ┌───────────────────────────────────────────────┐  │
│  │ Task 3: Use child results                     │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │ Task 4: Complete                              │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 2. Call Stack Tracking for Cycle Detection

```
Scenario A: Valid Linear Chain
─────────────────────────────
Activity A                           Activity B                    Activity C
│                                    │                             │
│ Invokes B                          │ Invokes C                   │
├─ callStack: [A]        ────────→  ├─ callStack: [A, B]  ───→  │
│                                    │ if B in [A,B]? NO ✓         │
└─ Allowed ✓                         └─ Allowed ✓                 └─ Allowed ✓


Scenario B: Circular Dependency (BLOCKED)
──────────────────────────────────────────
Activity A                           Activity B
│                                    │
│ Invokes B                          │ Invokes A
├─ callStack: [A]        ────────→  └─ callStack: [A, B]
│                                       Check: is A in [A,B]? YES ✗
│                                       ERROR: Circular dependency detected!
│                                       Block execution
└─ BLOCKED ✗


Scenario C: Depth Limit (maxNestingDepth: 3)
────────────────────────────────────────────
Call Stack       Length    Status
─────────────────────────────────
[A]              1         ✓ OK
[A, B]           2         ✓ OK
[A, B, C]        3         ✓ OK (at limit)
[A, B, C, D]     4         ✗ BLOCKED (exceeds maxNestingDepth)
```

### 3. Graph Execution with Topological Sort

```
Input Graph:
─────────────
     ┌─→ [B] ──┐
     │         │
[A] ─┤         ├→ [D]
     │         │
     └─→ [C] ──┘


Step 1: Build Dependency Map
──────────────────────────────
A: no dependencies  → Can execute immediately
B: depends on [A]
C: depends on [A]
D: depends on [B, C]


Step 2: Topological Sort
──────────────────────────
Level 1 (no deps):   [A]
Level 2 (depend[A]): [B, C]
Level 3 (depend[B,C]): [D]


Execution Plan:
───────────────
Sequential:  A → B → C → D  (4 steps)
Parallel:    A → (B || C) → D  (3 steps)


Output Execution Trace:
────────────────────────
executionOrder:  [A, B, C, D]
parallelGroups:  [[A], [B, C], [D]]
nodesExecuted:   4
nodesFailed:     0
totalDuration:   452ms
```

### 4. Composition Observer Tracking

```
Real-Time Composition Tracking
───────────────────────────────

Parent Activity: "process-data"
│
├─ Child 1: "validate-input"
│  ├─ Status: completed
│  ├─ Duration: 123ms
│  ├─ Depth: 1
│  └─ Success: ✓
│
├─ Child 2: "transform-data"
│  ├─ Status: completed
│  ├─ Duration: 456ms
│  ├─ Depth: 1
│  └─ Success: ✓
│
└─ Child 3: "save-results"
   ├─ Status: started
   ├─ Depth: 1
   └─ Success: (pending)


Activity Metrics:
─────────────────
Activity           Calls  Success  Failures  Blocked  Avg Duration
────────────────────────────────────────────────────────────────
validate-input       5       5         0        0       105ms
transform-data       5       5         0        0       425ms
save-results         5       4         0        1       210ms
────────────────────────────────────────────────────────────────
```

### 5. Impulse Flow Through Graph

```
Graph with Data Flow:
─────────────────────

┌──────────┐
│ [Node A] │──output→ output_file: "/tmp/data.json"
│ executes │
└──────────┘
     │
     │ Edge: A→B, dataFlow: {outputKey: "output_file", inputKey: "input_path"}
     ↓
┌──────────────────────────────────────────┐
│ [Node B]                                 │
│ receives impulse:                        │
│   id: "node-a-output"                    │
│   content: {output_file: "/tmp/data.json"}│
│ maps to input: input_path                 │
│ executes bash: "cat /tmp/data.json"      │
└──────────────────────────────────────────┘
     │
     │ Output impulse
     ↓
┌──────────┐
│ [Node C] │ receives [output-of-b] as input
└──────────┘
```

### 6. Shape-Based Composition Learning

```
Shape Overlap Determines Compatibility
─────────────────────────────────────

Activity A Output Shapes:        Activity B Input Shapes:
├─ source_code                   ├─ source_code  ✓ MATCH
├─ config_file                   ├─ test_results
├─ dependency_list               └─ logs
└─ test_results        ✓ MATCH

Overlap Score: 2/4 = 50%
Verdict: MODERATE - Can compose with shape transformation


Activity C Outputs:              Activity D Inputs:
├─ database_state    ✗           ├─ source_code
├─ metrics_report    ✗           ├─ config_file
└─ logs                          └─ git_status

Overlap Score: 0/3 = 0%
Verdict: POOR - These activities don't naturally compose


Learning Edge Recorded:
┌──────────────────────────────────────┐
│ A → B                                │
├──────────────────────────────────────┤
│ success: true                        │
│ durationMs: 5234                     │
│ outputShapes: [source_code, ...]     │
│ inputShapes: [source_code, ...]      │
│ shapeOverlap: 0.50                   │
└──────────────────────────────────────┘
```

### 7. Error Handling in Composition

```
Composition Error Scenarios
───────────────────────────

Scenario A: Child Activity Fails
─────────────────────────────────
Parent executes
  ↓
Invokes Child
  ↓
Child encounters error
  ↓
onActivityExecute returns: {success: false, error: "..."}
  ↓
Parent decision:
  ├─ Fail & propagate up (default)
  │  └─ Execution stops
  │
  ├─ Handle gracefully
  │  └─ Implement fallback
  │
  └─ Retry with different params
     └─ Re-invoke child


Scenario B: Cycle Detected
───────────────────────────
callStack = [A, B]
Child = A
  ↓
Check: A in [A, B]? YES
  ↓
Throw: "Circular dependency: A→B→A"
  ↓
Execution blocked
  ↓
Activity marked as: blocked
  ↓
Metrics updated
  ↓
Error propagated to parent


Scenario C: Depth Exceeded
──────────────────────────
callStack = [A, B, C]
depth = 3, maxDepth = 3
Try to invoke D:
  ↓
Check: depth < maxDepth? 3 < 3? NO
  ↓
Throw: "Max nesting depth (3) exceeded"
  ↓
Execution blocked
```

### 8. Composition Resolver Architecture

```
Activity Executor
│
├─ Task 1: resolver=bash
│  └─ Execute bash command
│
├─ Task 2: resolver=activity    ←─ COMPOSITION
│  │
│  ├─ Load child template
│  ├─ Create execution context:
│  │  ├─ parentActivityId
│  │  ├─ activityCallStack
│  │  ├─ variables
│  │  └─ session context
│  │
│  ├─ onActivityExecute callback
│  │  │
│  │  └─→ Child Activity Executor
│  │      ├─ Task A
│  │      ├─ Task B
│  │      └─ Returns ActivityExecution
│  │
│  └─ Process results:
│     ├─ Extract output impulses
│     ├─ Check success
│     ├─ Update metrics
│     └─ Record composition edge (if MCP enabled)
│
└─ Task 3: resolver=bash
   └─ Use child activity output
```

## Key Metrics & Thresholds

```
Configuration Parameters
────────────────────────

Parameter              Default   Range       Purpose
─────────────────────────────────────────────────────
maxNestingDepth        3         1-10        Prevent deep recursion
compositionTimeoutMs   60000     1-300000    Timeout for child execution
maxParallelism         4         1-32        Max concurrent graph nodes
shapeOverlapThreshold  0.30      0.0-1.0     Min overlap for auto-compose

Tracked Metrics
────────────────

Metric                  Type      Purpose
──────────────────────────────────────────────────────
calls                   counter   Total invocations
successes               counter   Successful executions
failures                counter   Failed executions
blocked                 counter   Blocked by cycle/depth
totalDuration           gauge     Cumulative execution time
avgDuration             gauge     Average execution time
successRate             ratio     success/calls percentage
```

## Execution Flow Comparison

```
Simple Task vs. Composed Activity
──────────────────────────────────

SIMPLE TASK (resolver: bash)
─────────────────────────────
Task starts
  ↓
Execute bash command
  ↓
Capture output
  ↓
Duration: ~50ms


COMPOSED ACTIVITY (resolver: activity)
──────────────────────────────────────
Task starts
  ↓
Load child template
  ↓
Create execution context
  ↓
Initialize executor
  ↓
Execute child tasks (recursive)
  ↓
Capture child output/execution
  ↓
Record composition edge
  ↓
Return to parent
  ↓
Duration: ~1000ms (typically higher due to overhead)
```

## Decision Tree: When to Use Composition Types

```
Need to execute another activity?
│
├─ YES: Is it a single child activity?
│  │
│  ├─ YES: Use onActivityExecute callback
│  │  ├─ Simple composition
│  │  ├─ Parent waits for child
│  │  ├─ Good for: sequential workflows
│  │  └─ Example: "Fix TypeScript Errors" → "Run TypeScript Check"
│  │
│  └─ NO: Multiple activities with dependencies?
│     │
│     ├─ YES: Use ResolverGraphExecutor
│     │  ├─ Define nodes and edges
│     │  ├─ Supports parallelization
│     │  ├─ Good for: complex pipelines
│     │  └─ Example: Build → Test → Deploy
│     │
│     └─ NO: Simple sequential chain?
│        └─ Use nested onActivityExecute calls
│
└─ NO: End composition
```

## Summary Comparison Table

```
Feature                  Simple       Graph        Notes
─────────────────────────────────────────────────────────
Setup Complexity         Low          Medium       Graph needs DAG definition
Parallelization         No           Yes          Graph executor enables parallel
Cycle Detection         Yes          Yes          Both track dependencies
Max Depth               Yes          Yes          Both enforce limits
Impulse Mapping         Auto         Explicit     Graph has explicit dataFlow
Learning Support        Yes          Yes          Both record composition edges
Error Handling          Per-call     Per-node     Graph allows partial failure
Debugging              Simpler      Detailed      Graph provides full trace
Typical Use             Sequential   Orchestration
```

---

## Visual State Machines

### Activity Execution States

```
            ┌─────────────────┐
            │   INITIALIZING  │
            └────────┬────────┘
                     │
                     ↓
            ┌─────────────────┐
            │   EXECUTING     │
            └────┬────────────┘
                 │
        ┌────────┴─────────┐
        │                  │
        ↓                  ↓
┌──────────────┐   ┌──────────────┐
│  COMPLETED   │   │   FAILED     │
└──────────────┘   └──────────────┘
        │                  │
        └────────┬─────────┘
                 │
                 ↓
        ┌─────────────────┐
        │  COMPOSITION    │
        │  EDGE RECORDED  │
        └─────────────────┘
        (if success + MCP enabled)
```

### Graph Node States

```
┌──────────┐    Ready (no deps)    ┌──────────┐
│  PENDING │ ────────────────────→ │ EXECUTING│
└──────────┘                       └────┬─────┘
    ↑                                   │
    │                          ┌────────┼────────┐
    │                          │        │        │
    │                  ┌───────┴────┐   │   ┌────┴──────┐
    │                  ↓            │   │   ↓           │
    │            ┌──────────┐   ┌──────────┐  ┌─────────┐
    │            │COMPLETED │   │ SKIPPED  │  │ FAILED  │
    │            └──────────┘   └──────────┘  └─────────┘
    │                   │              │           │
    └───────────────────┴──────────────┴───────────┘
           (ready next dependent nodes)
```

---

## Performance Characteristics

```
Composition Overhead
─────────────────────

Single Task Execution:        50ms   baseline
+ Composition Invocation:     150ms  (context setup, callback)
+ Child Activity Load:        100ms  (template + config)
+ Child Task Execution:       400ms  (depends on task complexity)
+ Results Propagation:        50ms   (impulse creation)
+ Composition Edge Record:    200ms  (MCP call, non-blocking)
─────────────────────────────────────────
Total Estimated Time:         950ms  for one composition call

Scaling with Depth:
Depth 1: ~1000ms
Depth 2: ~2000ms (activities serial)
Depth 3: ~3000ms
Depth 4+: Blocked (default maxNestingDepth=3)

Scaling with Parallelism (3 independent nodes):
Sequential: 1000ms + 1000ms + 1000ms = 3000ms
Parallel:   max(1000ms, 1000ms, 1000ms) = 1000ms
Speedup:    3x with graph parallelization
```

---

This visual reference guide should help you understand MiniBob's activity composition architecture at a glance!
