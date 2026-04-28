# Scope and Governance Considerations

> **Status**: Working notes from exploration session
> **Date**: 2026-03-27
> **Context**: Continuing exploration of vessel composability and shared impulse state spaces

---

## Current State Summary

Based on codebase investigation, here's what currently exists:

### Scope Implementation
- **Scope is metadata**, not infrastructure
- Database fields: `org_id` (required), `project_id` (optional), `scope` enum, `public` bool
- RBAC enforced at database level via SurrealDB PERMISSIONS
- Four scope levels: `global`, `org`, `project`, `vessel`

### Scope Hierarchy
- Fixed hierarchy: Org → Project → Session/Connection
- Users belong to exactly one org (hard boundary)
- Projects are optional subdivisions
- Vessels bound to single org, optionally single project

### Cross-Scope Learning
- Thompson Sampling is per-org only
- NO mechanism for promoting patterns up the hierarchy
- NO cross-org aggregation
- Identified as open question in architecture docs

### Vessel Multi-Homing
- Vessels are single-scoped (one org_id, optional one project_id)
- Workaround: same vessel code → multiple instances for different scopes
- Each instance has isolated auth token, traces, heartbeat

---

## Three Practical Constraints

### Constraint 1: Overlapping Non-Identical Capabilities

Multiple vessels may provide the same resolver type but with different scope:
- MiniBob-A has `file` resolver for Project X
- MiniBob-B has `file` resolver for Project Y
- Same capability type, different accessible data

**Implication**: Resolution must be scoped. An impulse `{ type: "file", path: "src/auth.ts" }` resolves differently depending on which vessel/scope handles it.

### Constraint 2: Private Information / Access Control

Vessels have access to sensitive data:
- Phone call transcripts (PII)
- Credentials and secrets
- Proprietary code

External constraints (legal, contractual, ethical) prevent us from ignoring access control.

**Implication**: Scope boundaries must be enforced. Not everything can flow everywhere.

### Constraint 3: State Space Tractability

The learning loop requires:
- Traces to find patterns
- Manageable state space to learn from
- Clear signal, not noise

If the impulse space grows too large before we have effective winnowing, we can't bootstrap the learning that would help us manage it.

**Implication**: Start with tight scopes (session, project), expand as learning proves reliable.

---

## Scoped Impulse State Spaces

The ideal of "one big shared space" doesn't work. Instead:

```
                    ┌─────────────────────────┐
                    │    Global Patterns      │
                    │    (learned, promoted)  │
                    └───────────┬─────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
    ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
    │   Org Space   │   │   Org Space   │   │   Org Space   │
    └───────┬───────┘   └───────────────┘   └───────────────┘
            │
    ┌───────┴───────┬───────────────┐
    │               │               │
    ▼               ▼               ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│ Project │   │ Project │   │ Project │
│ Space   │   │ Space   │   │ Space   │
└────┬────┘   └─────────┘   └─────────┘
     │
     └── Session Spaces (transient)
```

Each scope level has:
- Its own impulse set
- Its own vessel membership
- Its own access rules
- Its own learning state (Thompson Sampling)

Learning can flow UP (generalized patterns). Raw data stays DOWN (in its scope).

---

## Parallel Sampling: A Future Governance Capability

### The Requirement

At some point, the governance system will need to **sample different vessels, activities, and impulses in parallel**.

### Why Parallel Sampling?

1. **Thompson Sampling Requires Variation**

   To learn which variant is better, you must try multiple variants:
   ```
   Activity: "debug-null-pointer"
   Variants:
     v1: α=45, β=3  (tried many times)
     v2: α=2, β=1   (new variant, uncertain)

   Thompson Sampling says: sometimes pick v2 to learn more about it.

   If we could run BOTH in parallel, we learn faster.
   ```

2. **Exploration vs Exploitation**

   Sequential execution forces a choice: explore new approaches OR exploit known-good ones.

   Parallel execution allows: explore AND exploit simultaneously, compare results.

3. **Redundancy and Fault Tolerance**

   If a vessel fails mid-execution, parallel instances can continue.

   Critical activities might run on multiple vessels simultaneously.

4. **Comparative Evaluation**

   How do we know if Activity A is better than Activity B for a goal?

   Run both, compare outcomes. This requires parallel execution.

5. **Stateful Vessel Isolation**

   A vessel handling a phone call can't simultaneously handle a different call.

   Parallel sampling of "phone call analysis" requires multiple vessel instances.

### How This Implies Multiple Instances

```
PARALLEL SAMPLING SCENARIO
────────────────────────────────────────────────────────────

    Goal: "Fix the authentication bug"

    Governance decides to sample:
    - Activity variant A (debug-stack-trace)
    - Activity variant B (debug-with-tests)
    - Different impulse contexts (with/without previous attempts)


    REQUIRES:

    ┌─────────────────────────────────────────────────────┐
    │              Parallel Execution Space               │
    │                                                     │
    │   ┌─────────────┐   ┌─────────────┐               │
    │   │ Executor 1  │   │ Executor 2  │               │
    │   │             │   │             │               │
    │   │ Activity A  │   │ Activity B  │               │
    │   │ Impulses X  │   │ Impulses Y  │               │
    │   └──────┬──────┘   └──────┬──────┘               │
    │          │                 │                       │
    │          ▼                 ▼                       │
    │      Outcome A         Outcome B                   │
    │                                                     │
    │   Governance compares, learns, selects winner      │
    └─────────────────────────────────────────────────────┘


    IMPLICATIONS:

    1. Multiple activity executors must exist
       (can't run A and B on same executor simultaneously)

    2. Impulse resolution must handle parallel access
       (both executors might resolve same file)

    3. Trace recording must distinguish parallel runs
       (which execution produced which outcome?)

    4. Stateful vessels need multiple instances
       (can't share state across parallel executions)
```

### The Multiplicity Requirement

Parallel sampling **implicitly requires** that we have multiples of:

| Component | Why Multiples? |
|-----------|----------------|
| **Vessels** | Can't run parallel executions on single instance (state conflict) |
| **Activity Executors** | Each parallel branch needs its own execution context |
| **Impulse Copies** | Parallel executions might mutate impulses differently |
| **Trace Streams** | Must record what happened in each parallel branch |

This aligns with the current architecture's pattern of:
- Same vessel code → multiple instances
- Each instance single-scoped
- Instances can be spun up/down as needed

### Governance as Orchestrator

The governance system would:

1. **Decide what to sample**
   - Which activity variants to try
   - Which impulse contexts to compare
   - How many parallel branches

2. **Provision execution contexts**
   - Spin up vessel instances as needed
   - Allocate to appropriate scopes
   - Set up parallel impulse spaces (possibly copy-on-write)

3. **Collect and compare outcomes**
   - Wait for parallel executions to complete
   - Compare success/failure, cost, duration
   - Update Thompson Sampling scores

4. **Learn and adapt**
   - Promote successful patterns
   - Retire failing variants
   - Adjust sampling strategy

---

## Open Questions

1. **Scope of parallel sampling**: Within a session? Across projects? Across orgs?

2. **Resource allocation**: Who pays for parallel executions? How do we bound exploration costs?

3. **Determinism**: If we sample the same activity twice in parallel, should we expect same results? (Probably not, given LLM non-determinism)

4. **Conflict resolution**: What if parallel branches produce conflicting outputs (both try to write same file)?

5. **Learning attribution**: When parallel executions have different contexts, how do we attribute success to the right variable?

---

## Relationship to Vessel Composability

Parallel sampling reinforces the model where:

- Vessels are **resolution domains**, not singular actors
- Multiple instances of the same vessel type is **normal**, not exceptional
- The shared impulse space is the **coordination mechanism**
- Governance orchestrates **which vessels participate** in which executions

Vessels don't compose by calling each other. They compose by:
1. Participating in shared impulse spaces
2. Being sampled by governance for parallel execution
3. Contributing resolution capabilities to aggregate pools

---

## Security Implications (Future Governance)

Parallel sampling has security implications for a future governance system:

### Verification Through Redundancy
- Run same task on multiple independent vessels
- Compare outputs - divergence is a signal
- Analogous to Byzantine fault tolerance (2f+1 nodes to tolerate f malicious actors)

### Detecting Anomalous Behavior
- Compare traces across parallel executions
- Unexpected file access, network calls, credential access become visible
- Behavioral comparison reveals vessels that act differently from peers

### Trust Gradients (Future)
- New vessels run in parallel with established ones
- Trust earned through consistent behavior over time
- Critical operations could require consensus across multiple vessels

### Audit Trail Multiplication
- Multiple parallel executions = multiple independent records
- Compromising audit requires compromising ALL parallel vessels

---

## Current Trust Model (Practical Scoping)

**For now, trust is simple: valid authentication = trusted.**

```
CURRENT REGIME
────────────────────────────────────────────────────────────

    Scoped RBAC + User Access Keys

    IF vessel authenticates properly with valid credentials
    THEN vessel is trusted within its scope

    Key compromise is a human problem:
    - Users are responsible for their keys
    - We don't have activities to detect/remediate key compromise
    - Not our problem to solve at this time


    FUTURE (when governance exists):

    - Parallel sampling enables verification
    - Trust gradients become possible
    - Anomaly detection through behavioral comparison
    - But this requires activities we don't have yet
```

The security considerations above are **forward-looking** - relevant when we build governance capabilities. The current system relies on authentication as the trust boundary.
