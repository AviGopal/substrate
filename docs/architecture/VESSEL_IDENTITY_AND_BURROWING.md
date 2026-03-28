# Vessel Identity and Burrowing

> **Status**: Working notes from architecture discussion
> **Date**: 2026-03-26
> **Context**: Clarifying vessel identity, burrowing, and the universality of the foundation model

---

## Key Insights

### 1. No Two Vessels Are Identical

Even vessels of the "same type" differ:
- Different resolver code versions
- Different local impulse state
- Different execution history
- Different environment

The impulse state entering an execution is **vessel-specific**. Same activity, different vessels, different starting conditions.

### 2. All Vessels Think

Every vessel performs the same functions:
- Select activity variants (Thompson Sampling)
- Execute activities
- Experiment with variants
- Recover from failure (try other activities given new impulse state)
- Report traces

There is no "dumb executor" vessel. The form and function are identical across all vessels. **Only the domain differs** - what resolvers the vessel has access to.

| Vessel | Domain | Resolvers |
|--------|--------|-----------|
| MiniBob-codebase | Source code | file, git, llm |
| Burrowed-payment-app | Payment processing | sql, http, secrets |
| Hardware-controller | Physical actuators | sensor, motor |

### 3. Burrowing Is Applying the Foundation Model

Burrowing = instrumenting a target application to emit traces.

When we burrow into an app:
- The app's function calls become **execution traces**
- The app's data flows become **impulses**
- Patterns are **derived from traces** (not stored separately)
- Activities are **extracted via ribosome**
- Control happens through **activity invocation**

The burrowed vessel is a full participant in the learning loop - it thinks, selects, experiments, recovers, reports. It just has resolvers for that app's domain.

### 4. Traces Are Source of Truth

From the foundation:
- **Record everything** - traces are the raw material
- **Derive patterns** - Thompson scores, composition patterns, impulse relevance
- **No separate storage** for patterns - they're queries over traces

```
Traces (append-only source of truth)
    │
    └─→ DERIVE: Thompson scores (α, β on activities)
    └─→ DERIVE: Composition patterns (what follows what?)
    └─→ DERIVE: Impulse relevance (correlation analysis)
    └─→ DERIVE: Failure patterns (where do things break?)
```

### 5. The Universal Vessel Loop

Every vessel, regardless of domain:

```
Receive impulses
    ↓
Select activity (Thompson Sampling from matching activities)
    ↓
Execute (using vessel's resolvers)
    ↓
Handle outcome
    ├─ Success → report trace, continue
    └─ Failure → try recovery (other activities given new impulse state)
    ↓
Report traces to backend
    ↓
Learning happens (patterns derived from accumulated traces)
```

---

## Storage Considerations

### The Volume Problem

Burrowing generates many traces (every function call). Considerations:

1. **Traces are the raw material** - don't discard prematurely
2. **Patterns derived, not stored** - the "composition graph" is a query, not a table
3. **Errors matter for comparison** - comparing failures to successes aids debugging
4. **Flat hierarchy** - traces are flat events, patterns emerge from them

### What We're NOT Doing

- NOT creating a separate "understanding" structure
- NOT storing pre-computed composition graphs
- NOT treating "dev vessels" differently from "runtime vessels"
- NOT assuming vessels are identical

---

## Implementation Notes

### To Burrow Into an Application

1. **Instrument** - wrap functions to emit traces
2. **Record** - traces go to backend (POST /v2/traces)
3. **Derive** - backend computes patterns from traces
4. **Extract** - ribosome creates activities from successful patterns
5. **Control** - invoke activities to trigger native behavior

### Trace Validation

Traces must conform to expectations:
- Vessel must have required resolvers
- Input impulses must match activity's inputSchema
- Output impulses must match activity's outputSchema
- Improvisation flagged appropriately

### Vessel Registry

Each vessel declares:
- `resolves: string[]` - impulse types it can handle
- Activities it can execute
- Its domain/context

---

## References

- `IMPULSE_ACTIVITY_FOUNDATION.md` - The canonical foundation
- `VESSEL_CONVERSION_ARCHITECTURE.md` - Burrowing mechanics (archived)

---

## Open Questions

1. How do we efficiently query traces to derive patterns at scale?
2. What's the instrumentation strategy for different language runtimes?
3. How do vessels discover each other for delegation (ACP)?
4. How do we handle trace validation for improvised executions?
