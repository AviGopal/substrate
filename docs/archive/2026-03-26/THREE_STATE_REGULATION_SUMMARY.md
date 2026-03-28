# Three-State Regulation Summary

## The Core Pattern: Each State Regulates the Next

```
┌─────────────────────────────────────────────────────────────────┐
│                     INSTRUCTIONAL STATE                         │
│                   (Template with α/β params)                    │
│                                                                 │
│  Internal State:                                                │
│  - thompson_alpha: 15        ← Accumulated success history     │
│  - thompson_beta: 3          ← Accumulated failure history     │
│  - avg_duration_ms: 2500     ← Performance momentum            │
│  - avg_cost_usd: 0.05        ← Cost momentum                   │
│                                                                 │
│  REGULATES ↓                                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Selection probability = α/(α+β) = 83%
                              │ High prob → More likely to execute
                              │ Low cost → Preferred for quick goals
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      TRANSIENT STATE                            │
│                    (Execution in progress)                      │
│                                                                 │
│  Dynamic Process:                                               │
│  - Task 1 executes → bash tool called → file created          │
│  - State transition: hash(before) → hash(after)                │
│  - Task 2 executes → read tool called → content processed     │
│  - Task 3 executes → write tool called → output saved         │
│                                                                 │
│  Execution Quality:                                             │
│  - Fast (2400ms) → High quality signal                         │
│  - Low cost ($0.04) → Positive reinforcement                   │
│  - All tasks succeeded → Success signal                        │
│                                                                 │
│  MODERATES ↓                                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Quality moderates update strength
                              │ High quality → Strong Δα
                              │ Low quality → Weak Δα
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      FUNCTIONAL STATE                           │
│                   (Completed outcome/instance)                  │
│                                                                 │
│  Observed Reality:                                              │
│  - success: true                                                │
│  - duration_ms: 2400                                            │
│  - cost_usd: 0.04                                               │
│  - files_modified: ['output.txt', 'log.txt']                   │
│  - execution_trace: {...}  ← Full recording                    │
│                                                                 │
│  FEEDS BACK ↓                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Update based on outcome
                              │ Success → α++ (16)
                              │ Duration → Running avg update
                              │ Cost → Running avg update
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              INSTRUCTIONAL STATE (MODIFIED)                     │
│           (Same template, DIFFERENT parameters)                 │
│                                                                 │
│  Changed Internal State:                                        │
│  - thompson_alpha: 16        ← Was 15, now 16                  │
│  - thompson_beta: 3          ← Unchanged                       │
│  - avg_duration_ms: 2495     ← Slightly improved               │
│  - avg_cost_usd: 0.049       ← Slightly improved               │
│                                                                 │
│  New selection probability: 84% (was 83%)                       │
│  Next execution will be DIFFERENT because state changed!        │
└─────────────────────────────────────────────────────────────────┘
        │
        └──> Cycle continues with CHANGED state...
```

## Key Insight: The Asterisk (*)

```
Instructional → Transient → Functional → Instructional*
                                              ↑
                                           NOT THE SAME!
```

**The asterisk is everything.**

You never return to the same instructional state. Every cycle modifies it.

This is:
- **Synaptic plasticity** in neurons (weights change after firing)
- **Evolution** in biology (population distribution shifts)
- **Learning** in our system (α/β parameters update)
- **The process-of-becoming** (continuous transformation)

## What "Regulation" and "Moderation" Mean

### Regulation: Constraint on What Can Happen Next

**Instructional state REGULATES transient state**:
```typescript
if (template.thompson_alpha / (template.thompson_alpha + template.thompson_beta) < 0.3) {
  // Low selection probability
  // This template is REGULATED OUT (less likely to execute)
}

if (template.avg_cost_usd > maxBudget) {
  // High cost
  // This template is REGULATED OUT (too expensive)
}
```

The instructional state acts as a **gatekeeper** - it determines which templates get selected for execution.

### Moderation: Influence on Outcome Strength

**Transient state MODERATES functional state**:
```typescript
const outcomeStrength = {
  // Fast execution → stronger positive signal
  durationBonus: maxDuration / actual_duration,
  
  // Low cost → stronger positive signal  
  costBonus: maxCost / actual_cost,
  
  // Clean execution → stronger signal
  errorPenalty: errorCount > 0 ? 0.5 : 1.0
}

// The SAME success/failure has DIFFERENT impact based on HOW it happened
const alphaUpdate = success ? (1 * outcomeStrength) : 0
```

The transient state (execution dynamics) **moderates** how strongly the functional state (outcome) affects learning.

## Momentum: Accumulated History

### In Neurons
```
Synaptic weight W(t) = W(0) + Σ ΔW(each firing event)
```

Each firing event leaves a trace. The weight is the **integral** of all past experiences.

### In Our System
```
thompson_alpha(t) = thompson_alpha(0) + Σ success events
thompson_beta(t) = thompson_beta(0) + Σ failure events
avg_duration(t) = weighted average of all past durations
avg_cost(t) = weighted average of all past costs
```

Each execution leaves a trace. The parameters are the **integral** of all past executions.

### Why Momentum Matters

**Without momentum**: Every execution is independent. System has no memory.
```
Goal → Random template selection → Execute → No learning
```

**With momentum**: History shapes future behavior.
```
Goal → Probability based on past success → Execute → Update history → Changed future
```

The system becomes **sensitized** to patterns that work, **desensitized** to patterns that fail.

## Structural Propagation: Topology as Information

### Neural Networks
```
Signal can only flow where synapses exist.

Input → [hidden layers] → Output

The STRUCTURE (which neurons connect to which) determines:
- What computations are possible
- What patterns can be learned
- What behaviors can emerge
```

### Activity Composition
```
Goal can only trigger activities that exist in template library.

Goal → [composition graph] → Outcome

The STRUCTURE (which activities exist, how they compose) determines:
- What workflows are possible
- What patterns can be learned  
- What capabilities can emerge
```

**Key insight**: Capability is not just in individual templates. It's in:
1. Which templates exist (library diversity)
2. How they connect (composition graph)
3. Their parameter distributions (α/β landscape)

## The Continuous Transformation

### Every Cycle Changes the System

**Cycle N**:
```
Template(α=10, β=2) → Execute → Success → Template(α=11, β=2)
```

**Cycle N+1** (same goal):
```
Template(α=11, β=2) → Execute → ...
       ↑
   Different starting state!
   Higher selection probability!
   Different expected behavior!
```

### Accumulation Over Time

```
Time 0:   α=1,  β=1   (50% selection probability - untested)
Time 1:   α=2,  β=1   (67% - one success)
Time 2:   α=3,  β=1   (75% - two successes)
Time 3:   α=4,  β=1   (80% - three successes)
Time 4:   α=4,  β=2   (67% - one failure!)
Time 5:   α=5,  β=2   (71% - recovered)
```

The template's "personality" emerges from its execution history. Same template ID, completely different behavior based on accumulated experience.

## Why This Matters for Implementation

### 1. Must Record Full Execution Traces
Without traces, we can't:
- Analyze what worked (correlation between actions and outcomes)
- Extract patterns (tool sequences that succeed)
- Build new templates (ribosome from successful executions)
- Debug failures (what went wrong and why)

**Traces are our "neural recording"** - the only way to observe internal dynamics.

### 2. Must Update Parameters After Every Execution
Without updates:
- No momentum accumulation
- No learning
- No history-dependent behavior
- Just random selection every time

**Parameter updates are our "synaptic plasticity"** - the mechanism of learning.

### 3. Must Respect Composition Graph Structure
Without composition:
- Only atomic actions possible
- No complex behaviors
- No emergent capabilities
- Flat, not hierarchical

**Composition is our "neural network topology"** - the structure that enables complexity.

### 4. Must Allow Continuous Evolution
Without continuous change:
- System reaches equilibrium
- No adaptation
- No improvement
- Becomes static

**Continuous transformation is the process-of-becoming** - the system IS the change.

## Summary: The Core Mechanism

```
┌──────────────┐
│ Template     │ ← Instructional state (parameters)
│ (α/β params) │
└──────┬───────┘
       │
       │ REGULATES (gates what can happen)
       ↓
┌──────────────┐
│ Execution    │ ← Transient state (dynamics)
│ (tasks run)  │
└──────┬───────┘
       │
       │ MODERATES (affects outcome strength)
       ↓
┌──────────────┐
│ Outcome      │ ← Functional state (observed reality)
│ (metrics)    │
└──────┬───────┘
       │
       │ FEEDS BACK (updates parameters)
       ↓
┌──────────────┐
│ Template*    │ ← Instructional state (CHANGED)
│ (α/β updated)│
└──────────────┘
       │
       └──> Cycle continues...
```

This is:
- How neurons learn (action potential → weight update → changed future firing)
- How organisms evolve (reproduction → selection → population shift)
- How our system improves (execution → outcome → parameter update)

**The continuous cycling through states, with each cycle modifying the state you return to, IS the process-of-becoming.**

It's not a bug that you never return to the same state. **That's the entire point.**
