# Activity Composition System: Complete Overview

## What We've Built

A comprehensive understanding of how MiniBob activities compose, how to observe them, how to prevent loops, and how to extend sequences through hooks.

## Documents Created

### 1. **MINIBOB_VM_ARCHITECTURE.md**
- Core VM responsibilities (~4,800 LOC)
- Control flow: how activities execute
- Task processing: LLM + tools loop
- Activity composition mechanics
- What belongs in VM vs activities

**Key Insight**: MiniBob is a VM that executes activities, not a framework with built-in features.

### 2. **ACTIVITY_BASED_IMPROVISATION.md**
- Code-based (9,145 LOC) vs Activity-based (4,800 LOC)
- How improvisation works as an activity template
- Benefits of activity-based approach
- Migration path from code to activities

**Key Insight**: Features should be discoverable activities, not hidden VM code.

### 3. **COMPOSITION_AND_CONTROL_FLOW.md**
- How composition works (A calls B calls C)
- Backend composition graph tracking
- Loop prevention strategies
- Extending sequences (4 patterns)
- Hooks system and value
- Complete composition observability

**Key Insight**: Composition is observable, trackable, and learnable through backend integration.

### 4. **CYCLE_DETECTION_IMPLEMENTATION.md**
- Problem: Depth limiting allows cycles
- Solution: Call stack tracking
- Implementation details with code
- Testing strategy
- Backend integration for cycle learning

**Key Insight**: Cycles can be detected immediately with call stack tracking, not after multiple iterations.

### 5. **OBSERVABLE_WORKFLOW_EXAMPLE.md**
- Complete end-to-end workflow
- All hooks in action
- Full composition tracking
- Metrics collection
- Real output examples

**Key Insight**: Hooks enable complete observability without modifying VM code.

## Key Concepts

### 1. Composition

Activities can call other activities:

```
process-goal (depth 0)
  → explore-codebase (depth 1)
    → read-file (depth 2)
  → improvise-goal (depth 1)
  → extract-template (depth 1)
```

**Mechanisms**:
- LLM calls `activity` tool with template ID
- Child activity executes in isolated context
- Summary returned (not full trace)
- Composition recorded in backend

### 2. Loop Prevention

**Current**: Depth limiting (max 3 levels)
- ✅ Prevents deep recursion
- ❌ Allows cycles (wastes executions)

**Needed**: Call stack tracking
- ✅ Detects cycles immediately
- ✅ Clear error messages
- ✅ Backend learns problematic patterns

**Implementation**:
```typescript
if (callStack.includes(templateId)) {
  throw new Error(`Cycle detected: ${callStack.join(' → ')} → ${templateId}`)
}
```

### 3. Extending Sequences

**Pattern 1: Sequential Tasks**
```json
{
  "tasks": [
    {"id": "step1", "dependencies": []},
    {"id": "step2", "dependencies": ["step1"]},
    {"id": "step3", "dependencies": ["step2"]}
  ]
}
```

**Pattern 2: Dynamic Composition**
```
LLM decides which activities to call based on context
```

**Pattern 3: Data Passing**
```json
{
  "tasks": [
    {"id": "analyze", "outputImpulses": ["analysis"]},
    {"id": "implement", "impulseReferences": ["analysis"]}
  ]
}
```

**Pattern 4: Parallel (Future)**
```
Multiple activities execute concurrently
```

### 4. Hooks System

**VM-Level Hooks** (ExecutorConfig):
- `onActivityExecute`: When child activity called
- `onSearchActivities`: When searching for activities
- `onCreateActivity`: When creating new activity

**Execution-Level Hooks** (ExecuteOptions):
- `onTaskStart`: Before each task
- `onTaskComplete`: After each task

**Value**:
- ✅ Observability without VM changes
- ✅ Real-time progress tracking
- ✅ Metrics collection
- ✅ Dashboard integration
- ✅ Debugging and tracing
- ✅ Custom behavior injection

### 5. Backend Integration

**What Gets Recorded**:
```typescript
{
  parent_activity_id: "A",
  child_activity_id: "B",
  execution_id: "exec_123",
  success: true,
  timestamp: "2025-03-23T10:00:00Z"
}
```

**Composition Graph**:
```
Nodes: Activity templates
Edges: A → B with weight = success_rate
```

**Learning**:
- Thompson Sampling uses composition success rates
- Recommends activities that work well together
- Identifies problematic compositions (cycles, failures)

## The Complete Picture

### Activity Lifecycle

```
1. TEMPLATE (Vessel)
   ↓
2. LOAD template.json
   ↓
3. CREATE impulses (context)
   ↓
4. SORT tasks (dependencies)
   ↓
5. FOR EACH TASK:
   ├─ onTaskStart hook fires
   ├─ Build prompt (impulses + variables)
   ├─ LLM + tools execute
   │  └─ IF LLM calls activity tool:
   │     ├─ onActivityExecute hook fires
   │     ├─ Check for cycle (call stack)
   │     ├─ Check depth limit
   │     ├─ Execute child activity (isolated)
   │     ├─ Record composition (backend)
   │     └─ Return summary
   ├─ Capture output state
   ├─ Create output impulses
   └─ onTaskComplete hook fires
   ↓
6. COMPLETE execution
   ↓
7. REPORT to backend
   ↓
8. INSTANCE (execution trace)
   ↓
9. LEARN (Thompson Sampling)
   ↓
10. IMPROVE (new variants)
```

### Observability Flow

```
Hooks → Local Metrics → Console Logs
  ↓
Composition Events → Backend → Database
  ↓
Dashboard → Visualization → Analysis
  ↓
Learning → Thompson Sampling → Recommendations
```

### Control Flow Decisions

**Sequential Execution**:
- VM executes tasks in dependency order
- No parallelism (yet)
- Clear, predictable flow

**Composition Control**:
- LLM decides when to delegate
- VM handles mechanics (isolation, tracking)
- Depth and cycle limits prevent runaway

**State Management**:
- Impulses pass data between tasks
- Output impulses from parent available to children
- Context isolation prevents interference

## Practical Guidelines

### When to Use Composition

✅ **Good uses**:
- Break complex workflow into logical steps
- Reuse existing capabilities
- Separate concerns (explore, implement, test)
- Create flexible orchestrators

❌ **Avoid**:
- Tiny activities (overhead not worth it)
- Cycles (use sequential tasks instead)
- Deep nesting (keep ≤ 3 levels)
- Passing large state (use impulses with budgets)

### When to Use Hooks

✅ **Good uses**:
- Progress tracking for user
- Metrics collection
- Dashboard updates
- Debugging complex compositions
- Integration with external systems

❌ **Avoid**:
- Modifying execution logic (use activities)
- Heavy computation in hooks (blocks execution)
- Storing large state (use backend)

### When to Use Sequential Tasks vs Composition

**Sequential Tasks** (within one activity):
- Fixed workflow
- Simple dependencies
- Fast execution (no activity call overhead)
- Clear structure

**Composition** (calling activities):
- Dynamic workflow (LLM decides)
- Reuse existing activities
- Complex dependencies
- Need isolation

## Implementation Status

### ✅ Implemented
- Activity execution
- Composition mechanics
- Depth limiting
- Backend composition recording
- Hooks system (onActivityExecute, onTaskStart, onTaskComplete)
- Context isolation
- Impulse passing

### 🔄 Designed (Ready to Implement)
- Cycle detection with call stack tracking
- Cycle recording in backend
- Enhanced composition visualization

### 📋 Future Enhancements
- Parallel activity execution
- More hooks (onImpulseLoad, onToolCall, etc.)
- Composition pattern recommendations
- Auto-fix for detected cycles
- Loop constructs (while, repeat-until)

## Quick Reference

### Check for Cycles
```typescript
if (callStack.includes(templateId)) {
  throw new Error(`Cycle: ${callStack.join(' → ')} → ${templateId}`)
}
```

### Track Composition
```typescript
onActivityExecute: async (templateId, variables, reason) => {
  console.log(`${parent} → ${templateId}`)
  compositionLog.push({ parent, child: templateId, timestamp })
  // ... execute
}
```

### Collect Metrics
```typescript
onTaskStart: (taskId) => {
  startTimes.set(taskId, Date.now())
}
onTaskComplete: (taskId, result) => {
  const duration = Date.now() - startTimes.get(taskId)
  metrics.record(taskId, duration, result.status)
}
```

### Query Composition Graph
```bash
curl "http://api.minibob.local/v2/activities/composition/graph" | jq .
```

### Visualize Call Stack
```typescript
console.log(`Call stack: ${callStack.join(' → ')} → ${templateId}`)
console.log(`Depth: ${callStack.length + 1}`)
```

## Summary

The composition system enables:

1. **Observable**: Full visibility into which activities call which
2. **Safe**: Cycle detection and depth limiting prevent runaway execution
3. **Extensible**: Multiple patterns for chaining activities
4. **Coordinated**: Activities work together through composition
5. **Valuable**: Hooks provide observability and integration points
6. **Learnable**: Backend learns optimal composition patterns

**Core Philosophy**: The VM provides the execution environment. Activities define behavior. Hooks enable observation. Backend enables learning. Together, they create an autonomous, self-improving system.

## Next Steps

1. **Implement cycle detection**: Add call stack tracking to `src/activity.ts`
2. **Test thoroughly**: Verify cycles are caught immediately
3. **Build dashboard**: Visualize composition graphs in real-time
4. **Document patterns**: Create library of composition patterns
5. **Extract features**: Move understanding, goal-processing, etc. to activities
6. **Measure impact**: Compare VM size before/after (9,145 → 4,800 LOC)

The foundation is solid. The architecture is clear. The path forward is well-defined.
