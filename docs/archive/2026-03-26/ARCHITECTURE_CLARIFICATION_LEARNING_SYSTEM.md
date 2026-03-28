# Architecture Clarification: Learning System

## Core Conceptual Framework

This document clarifies the fundamental concepts and idealizations that drive the learning system architecture.

---

## 1. Activities: Execution Sequences & Dataflows

### Definition
**Activities are execution sequences and dataflows for arbitrary processes**, similar to one execution path through a codebase.

### Execution Model
```
Activity Execution Path:
  Component 1 (receives data as arguments)
    → processes data
    → calls Component 2 with results
  Component 2 (receives results from Component 1)
    → processes data
    → calls Component 3 with results
  ...
  Component N (receives final inputs)
    → produces final output
```

### Key Properties
- Each component receives data as arguments
- Each component performs some process
- Each component calls the next task with results
- Forms a directed acyclic graph (DAG) of data flow

### Learning Goals
1. **Which activities need to run in which sequence to achieve a goal**
2. **Update/improve/split/merge activities based on historical data**

### Optimization Strategies
- **Update**: Improve prompts, parameters, tool selection
- **Improve**: Refine based on success metrics
- **Split**: Break complex activities into smaller, reusable ones
- **Merge**: Combine frequently-sequenced activities

---

## 2. Impulses: Pointers to Data

### Definition
**Impulses are pointers to data** used to learn what information is necessary to complete a task and how to get it.

### Pointer Types
Impulses point to various data sources:
- **File pointers**: Path to file content
- **Activity output pointers**: Results from previous activity
- **Memo pointers**: In-memory data
- **Template definition pointers**: Activity templates
- **Analysis result pointers**: Computed analysis
- **Tool call result pointers**: Output from tool executions

### Dual Nature
Impulses serve two purposes depending on context:

1. **Instructions to LLMs**: 
   - Loaded and formatted as context
   - Interpolated into prompts via `{{impulse:id}}`
   - Filtered based on relevance (Phase 1.8)

2. **Direct data to algorithmic processes**:
   - Passed as structured data to code
   - Used in validation, analysis, metrics
   - Enables hybrid LLM+code workflows

### Learning Goals
1. **What information is necessary to complete a task**
2. **How to get that information**
3. **What data is relevant or irrelevant** based on activity outcomes

### Storage & Replay
- **Store impulses and their outputs** to enable replay
- **Understand what information was present when**
- **Learn relevance patterns** (Phase 1.6, 1.8):
  - `relevance_score`: P(success | impulse loaded)
  - `irrelevance_score`: P(success | impulse NOT loaded)

---

## 3. Lifecycle Hooks: Vessel Extensions

### Definition
**Lifecycle hooks enable vessels to register additional behavior** that may need other functionality.

### Vessel Concept
**Vessel**: Logical container of functionality in the instructional state
- Encapsulates tools, data, execution environment
- Has lifecycle (start, execute, stop)
- Can register hooks for custom behavior

### Hook Types
- **Socket streams**: Real-time data connections
- **Webservers**: HTTP endpoints for external integration
- **Other integrations**: Database connections, external APIs
- **Impulse interpolation**: Custom data loading/formatting
- **Tool registration**: Dynamic tool availability

### Use Cases
- Register custom tool implementations
- Stream execution progress via WebSocket
- Expose activity execution API
- Integrate with external systems
- Custom impulse resolvers

---

## 4. The Ribosome Analogy

### Biological Parallel
Just as **ribosomes execute genetic instructions** to build proteins:
- **Activities** = execution sequences (like mRNA instructions)
- **Impulses** = data pointers (like tRNA bringing amino acids)
- **Tools** = building blocks (like amino acids)
- **Vessels** = execution environment (like ribosomes)
- **Composition** = protein synthesis (building complex results)

### Self-Optimization Through Reality
Like all dynamic systems, we **self-optimize by experimenting in reality and selecting working patterns based on outcomes**:

1. **Experiment**: Try activity variants
2. **Measure**: Track success rate, cost, speed, quality
3. **Select**: Thompson Sampling picks working patterns
4. **Compose**: Combine successful patterns
5. **Evolve**: Create variants based on metrics

---

## 5. Learning Through Experimentation

### Pre-emptive Execution
We **pre-emptively execute activities or load impulses** and measure if output has improved:
- **Execute activity variant A**: Measure success rate
- **Execute activity variant B**: Measure success rate
- **Compare**: Which variant performs better?
- **Select**: Thompson Sampling chooses based on history
- **Adapt**: Update α/β parameters

### Metrics Tracked
- **Success rate**: % of successful executions
- **Cost**: Token usage and LLM API costs
- **Speed**: Execution duration
- **Quality**: Output validation, human feedback

### Continuous Improvement
As data accumulates:
- Success rates converge to true values
- Thompson Sampling becomes more confident
- System automatically selects better patterns
- Rare exploration maintains adaptability

---

## 6. Boredom Activities: Autonomous Improvement

### Definition
**Boredom activities** periodically create new variants of existing activities based on metrics.

### Unified Mechanism
The **exact same mechanism** is used for:
1. **Creating new activities**
2. **Debugging failed tasks**
3. **Generating activity variants**

**Difference**: Different impulses or goals affect behavior.

### Boredom Triggers
When metrics indicate opportunity:
- **Low success rate** → Create debug variant (add logging, validation)
- **High cost** → Create optimized variant (reduce token usage)
- **Common failure** → Split into sub-activities
- **Slow execution** → Create parallel variant
- **Repetitive pattern** → Merge into single activity

### Example Flow
```
Original: add-feature-complete
  Success rate: 60%
  Cost: $0.50/execution

Boredom System Detects: Low success rate

Creates Variants:
  1. add-feature-debug (adds validation steps)
  2. add-feature-optimized (reduces prompt tokens)
  3. add-feature-split (separates implementation from tests)

Thompson Sampling: Tries each variant
  - add-feature-debug: 85% success ($0.55)
  - add-feature-optimized: 65% success ($0.30)
  - add-feature-split: 80% success ($0.45)

Selection: add-feature-debug becomes preferred (highest success)
```

---

## 7. Tool Calls as Impulses

### Treating Tools Like Data
**Tool calls are tracked like impulses**:
- Record which tools were called
- Store tool parameters and results
- Learn which tools are necessary for which tasks
- Track tool usage patterns (Phase 1.4)

### Vessel Requirements
**Keep track of**:
1. **What vessels need to be available**: Which execution environments?
2. **What tools need to be present**: Which capabilities?
3. **What data was present**: Which impulses were loaded?

### Tool Relevance Learning
Similar to impulse relevance:
- **Tool usage patterns**: Which tools are used together?
- **Tool effectiveness**: Does tool X improve success rate?
- **Tool necessity**: Can we skip tool Y without impact?

---

## 8. Activity Execution Flow

### Fetch and Execute
When executing an activity:

1. **Fetch from API**:
   ```
   GET /v2/activities/templates/{template_id}
   ```

2. **Run step by step**:
   ```
   For each task in sorted_tasks:
     - Load required impulses (filtered by relevance)
     - Interpolate impulses into prompt
     - Execute task with available tools
     - Store output as new impulse
     - Record metrics (tokens, duration, success)
     - Move to next task
   ```

3. **Until**:
   - Successful outcome achieved, OR
   - Hit limit for trailblazing improvisation

### Trailblazing Improvisation
When tasks fail:
- **Limited retry budget**: Don't improvise forever
- **Variant creation**: Generate debug variant
- **Pattern learning**: Record failure patterns
- **Boredom trigger**: Queue variant generation

---

## 9. Composition as a Weighted Graph

### Execution Paths
**Keep track of the order in which activities run** and build a composition graph:

```
Activity Graph (Directed, Weighted):

Nodes: Individual activities
Edges: "Activity A called Activity B"
Weights: Learned execution frequency

Example:
  implement-feature (weight: 0.8) → run-tests
  implement-feature (weight: 0.6) → generate-docs
  implement-feature (weight: 0.3) → deploy-to-staging
  
  run-tests (weight: 0.9) → commit-changes
  run-tests (weight: 0.5) → fix-failing-tests
```

### Edge Weights
Weights correspond to **learned execution paths**:
- **High weight**: Frequently executed together
- **Low weight**: Rarely executed together
- **Thompson Sampling**: Tries new paths occasionally

### Composition Patterns
Learn which activities **compose well**:
- Co-execution frequency
- Success rate when composed
- Common sequences for goals
- Failure patterns (avoid these compositions)

---

## 10. Unified Learning Architecture

### Data Flows
```
1. Activity Execution
   ↓
2. Record: Impulses loaded, Tools used, Outputs produced
   ↓
3. Metrics: Success, Cost, Duration, Quality
   ↓
4. Learning: Update α/β, Relevance scores, Composition weights
   ↓
5. Selection: Thompson Sampling chooses next execution
   ↓
6. Boredom: Periodically create variants based on metrics
   ↓
7. Composition: Learn which activities run together
   ↓
8. Goal Paths: Multi-activity sequences for complex goals
```

### Feedback Loops
1. **Impulse Relevance Loop** (Phase 1.6, 1.8):
   - Load impulses → Execute → Record success
   - Update relevance scores → Filter better next time

2. **Activity Variant Loop** (Phase 1.3, 1.4):
   - Execute variant → Record metrics
   - Update Thompson α/β → Recommend better variants

3. **Composition Loop** (Phase 1.1, 1.2):
   - Activity A calls B → Record composition
   - Update graph weights → Predict future compositions

4. **Tool Usage Loop** (Phase 1.4):
   - Use tools → Record which ones
   - Learn patterns → Optimize tool selection

5. **Execution Sequence Loop** (Phase 1.5):
   - Sequence of tasks → Record order
   - Learn patterns → Optimize sequences

6. **Goal Path Loop** (Phase 1.7):
   - Multi-activity path → Record outcome
   - Update path weights → Recommend better paths

7. **Boredom Loop** (Phase 1.9):
   - Monitor metrics → Detect issues
   - Create variants → Test improvements

---

## 11. Goal: Emergent Optimization

### The Vision
Through continuous learning across all dimensions:
- **Activities** learn to compose effectively
- **Impulses** learn to carry relevant data
- **Tools** learn when to be used
- **Sequences** learn optimal ordering
- **Variants** emerge that outperform originals
- **Compositions** form that achieve complex goals

### Self-Improvement
The system **automatically**:
1. Identifies underperforming patterns
2. Generates improved variants
3. Tests variants in production
4. Selects better approaches
5. Retires poor performers

No manual intervention required—**the system optimizes itself through experimentation and selection**, just like biological evolution or market dynamics.

---

## 12. Current Implementation Status

### Phases Complete (1.1-1.8)
- ✅ Activity execution recording
- ✅ Variant tracking and Thompson Sampling
- ✅ Composition graph learning
- ✅ Tool usage pattern tracking
- ✅ Execution sequence learning
- ✅ Impulse relevance learning
- ✅ Goal path optimization
- ✅ **Impulse filtering (deployed!)**

### Phase Pending (1.9)
- ⏳ **Boredom System**: Autonomous variant generation

### Integration
All phases work together to create a **unified learning system** that:
- Tracks what works
- Experiments with variations
- Selects better patterns
- Composes solutions
- **Self-optimizes through reality**

---

## 13. Key Architectural Principles

### 1. Data as Pointers (Impulses)
Store references, not copies. Load on demand. Learn relevance.

### 2. Execution as Dataflow (Activities)
Sequences of transformations. DAG of dependencies. Learn composition.

### 3. Selection Through Experimentation (Thompson Sampling)
Try variants. Measure outcomes. Pick winners probabilistically.

### 4. Autonomous Improvement (Boredom)
System generates its own improvements. No human in the loop required.

### 5. Unified Mechanisms
Creating activities, debugging failures, generating variants—**all use the same core mechanism** with different inputs.

### 6. Reality-Based Optimization
Don't predict what will work—**try it and measure**. Select based on actual outcomes.

---

## Conclusion

This is not just a "learning system"—it's a **self-optimizing execution engine** that:
- Treats activities as execution paths through a dataflow graph
- Uses impulses as learned pointers to necessary data
- Composes activities based on measured outcomes
- Generates variants when metrics suggest improvement
- Converges on effective patterns through experimentation

**The goal**: Build a system that **automatically discovers better ways to achieve goals** through continuous experimentation and selection, just like natural systems optimize through evolution.

---

**Status**: Architecture clarified and aligned with implementation (Phases 1.1-1.8)  
**Next**: Phase 1.9 (Boredom System) to complete the autonomous improvement loop
