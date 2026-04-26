# Cross-Domain Patterns for Distributed Learning

> **Status**: Working notes for future consideration
> **Date**: 2026-03-26
> **Context**: Exploring how other domains solve distributed learning, coordination, and improvement propagation

---

## The Problem We're Solving

1. Collect data from many vessels (different domains, different capabilities)
2. Use it to improve vessels (only some can synthesize improvements)
3. Share improvements everywhere (epistemic necessity, not generosity)
4. Map outcomes at every abstractive layer (trace, activity, composition, goal)
5. Handle practical storage constraints

---

## Patterns from Biology

### Stigmergy (Ant Colonies)
- **Mechanism**: Pheromone trails in environment; no direct communication
- **Key insight**: Environment IS the coordination medium
- **Decay**: Unused paths fade naturally
- **Reinforcement**: Successful paths get strengthened
- **Application**: Trace store is the stigmergic medium. Vessels read/write traces, don't talk to each other.

### Clonal Selection (Immune System)
- **Mechanism**: B-cells with matching receptors proliferate
- **Affinity maturation**: Random mutations + selection of high-affinity variants
- **Memory cells**: Dormant high-affinity patterns activate on specific triggers
- **Application**: Thompson Sampling IS clonal selection. Trailblazing IS hypermutation.

### Memory Consolidation (Neural Systems)
- **Mechanism**: Hippocampus (fast) teaches Neocortex (slow) during sleep
- **Replay**: Successful experiences replayed during consolidation
- **Interleaving**: Mix new with old to prevent catastrophic forgetting
- **Application**: Vessels learn fast locally. Backend consolidates slowly. Boredom mode = sleep replay.

### Quorum Sensing (Bacteria)
- **Mechanism**: Behavior changes based on population density
- **Ratiometric decisions**: Ratio of signals determines action
- **Application**: Scale strategy based on active vessels. Decide propagation based on ratio of improved vs non-improved.

### Horizontal Gene Transfer (Bacteria)
- **Mechanism**: Share genetic material directly between organisms
- **Speed**: Much faster than vertical inheritance
- **Application**: Vessels can share successful patterns directly, not just through backend.

### Waggle Dance (Bees)
- **Mechanism**: Quality-weighted information sharing; competitive evaluation
- **Dance floor**: Dedicated space where recommendations compete
- **Application**: Activity recommendation endpoint is the dance floor. Better results get more visibility.

---

## Patterns from Socioeconomics

### Hayek's Knowledge Problem
- **Mechanism**: Knowledge is dispersed; no central authority has it all
- **Price signals**: Compress complex state into actionable metrics
- **Local decisions**: Those with local knowledge decide locally
- **Application**: Resolvers live where data lives. Success rate/cost/duration as price signals.

### Epistemic Communities
- **Mechanism**: Networks share norms, beliefs, evaluation criteria
- **Institutionalization**: Influence persists through created structures
- **Diffusion requirement**: Isolated knowledge becomes brittle
- **Application**: Patterns must spread across vessel boundaries. Siloed learning fails.

### Memetics / Cultural Evolution
- **Mechanism**: Ideas vary, compete, get selected
- **Horizontal transmission**: Faster than vertical
- **Active interpretation**: Receivers adapt, not just copy
- **Application**: Expect templates to be modified. Track variants, don't enforce conformity.

### Prediction Markets
- **Mechanism**: Aggregate dispersed information through staking
- **Quality over quantity**: Few informed signals > many uninformed
- **Aggregation matters**: Method of combining matters more than raw data
- **Application**: How we combine traces matters more than trace volume.

### Stigmergy (Again)
- **Mechanism**: Coordinate through environment modification
- **No planning needed**: Complex patterns emerge from simple local rules
- **Application**: Traces modify environment; subsequent behavior influenced. No orchestrator needed.

---

## Patterns from Mathematics

### Thompson Sampling
- **Mechanism**: Bayesian exploration-exploitation
- **Regret bounds**: Logarithmic regret (provably efficient)
- **Natural uncertainty**: Samples from posterior, automatically balances explore/exploit
- **Application**: Activity variant selection. Already in use.

### Information Bottleneck
- **Mechanism**: Compress while preserving task-relevant information
- **Formula**: minimize I(X;T) - β·I(T;Y)
- **Trade-off**: Compression vs relevance
- **Application**: Impulse metadata preserves relevance while compressing. Don't load full content until needed.

### Consensus Algorithms
- **Mechanism**: Agreement through local exchanges
- **Convergence**: Spectral properties determine speed
- **Byzantine tolerance**: Can handle faulty/malicious nodes
- **Application**: Vessels can converge on patterns without central coordinator.

### Category Theory
- **Mechanism**: Compositionality with guaranteed properties
- **Functors**: Structure-preserving transformations
- **Monoidal categories**: Parallel composition
- **Application**: Activities compose. Vessels compose. The algebra is consistent.

### Mechanism Design
- **Mechanism**: Design rules so self-interest yields good outcomes
- **Incentive compatibility**: Truth-telling is optimal strategy
- **Application**: Design learning incentives so vessels naturally contribute useful traces.

---

## Patterns from Physics

### Emergence from Local Interactions
- **Mechanism**: Global order from purely local rules
- **No central control**: Order parameter emerges
- **Maximum entropy**: Local pairwise interactions predict global behavior
- **Application**: Vessels interact locally (with trace store). Global coherence emerges.

### Landauer's Principle
- **Mechanism**: Erasing information costs energy (kBT ln 2 per bit)
- **Maxwell's demon**: Information storage has physical cost
- **Application**: Lazy loading is thermodynamically efficient. Don't process traces you don't need.

### Universality Classes
- **Mechanism**: Different systems, same critical behavior
- **Independence**: Macro behavior independent of micro details
- **What matters**: Symmetry, dimensionality, interaction range
- **Application**: Focus on topology and symmetry, not implementation details.

### Self-Organized Criticality
- **Mechanism**: Systems naturally evolve to critical state
- **Power laws**: Event sizes follow power-law distribution
- **Avalanches**: Most small, occasional large cascades
- **Application**: Don't suppress large changes. The system operates optimally at criticality.

### Renormalization Group
- **Mechanism**: Identify relevant degrees of freedom across scales
- **Coarse-graining**: Extract essential structure, discard irrelevant detail
- **Scale invariance**: Same patterns at every scale
- **Application**: Ribosome IS renormalization. Extract templates (coarse) from traces (fine).

---

## The Convergent Principles

### 1. Environment as Memory (Stigmergy)

**Seen in**: Ant pheromones, market prices, order parameters

Vessels don't communicate directly. They modify the shared environment (trace store). Coordination emerges from the accumulated modifications.

```
Vessel A writes trace → Trace field modified → Vessel B reads, behaves differently
```

No orchestrator. No direct messaging. Just the field.

### 2. Compress, Don't Centralize (Information Bottleneck)

**Seen in**: Antibody shapes, price signals, relevant operators

Transmit compressed signals (α, β, success rate), not raw data. The signal preserves task-relevant information while discarding noise.

```
Full trace (1000s of tokens) → Signal (α=45, β=3) → Selection decision
```

Metadata first, content later. Load only when needed.

### 3. Selection on Variants (Clonal Selection)

**Seen in**: B-cell competition, market competition, Bayesian bandits

Maintain diversity. Generate variants. Let them compete. Winners selected more often. Losers fade.

```
Variant A (α=45, β=3) competes with Variant B (α=12, β=8)
Thompson sample → A selected more often → A's traces reinforce A
```

Don't pick the "best" deterministically. Sample from posterior.

### 4. Fast Local, Slow Global (Memory Consolidation)

**Seen in**: Hippocampus/neocortex, local/global prices, fluctuations/order

Vessels learn fast with high variance. Backend consolidates slowly with high stability.

```
Vessel: "This worked!" (immediate local update)
Backend: "After 100 traces, this pattern is reliable" (slow consolidation)
```

Two timescales. Local for responsiveness. Global for stability.

### 5. Scale Invariance (Renormalization)

**Seen in**: Biological hierarchies, economic hierarchies, physical hierarchies

The same patterns apply at every scale. What works for traces works for activities works for compositions works for goals.

```
Trace → Activity → Composition → Goal → Domain
(same selection, same learning, same propagation)
```

Design once, apply everywhere.

### 6. Critical Operation (Self-Organized Criticality)

**Seen in**: Neural criticality, market dynamics, sandpile avalanches

The system naturally finds the edge between order and chaos. Most events small. Occasional cascades. This is optimal, not pathological.

```
99 small improvements, then 1 architectural change
(power law distribution of change sizes)
```

Don't over-regularize. Don't suppress large changes.

---

## Unified Architecture Vision

```
                     THE TRACE FIELD
    ┌─────────────────────────────────────────────────┐
    │  Traces accumulate (stigmergy)                  │
    │  Patterns emerge (price signals)                │
    │  Selection happens (clonal selection)           │
    │  Consolidation happens (memory formation)       │
    │  Structure crystallizes (phase transition)      │
    └─────────────────────────────────────────────────┘
              ↑↓              ↑↓              ↑↓
         ┌─────────┐     ┌─────────┐     ┌─────────┐
         │ Vessel  │     │ Vessel  │     │ Vessel  │
         │ Domain A│     │ Domain B│     │ Domain C│
         └─────────┘     └─────────┘     └─────────┘

    Each vessel:
    - Reads traces (like ants reading pheromones)
    - Maintains local posteriors (fast learning)
    - Selects activities (Thompson Sampling)
    - Executes with local resolvers
    - Writes traces (deposits pheromones)
    - Recovers from failure (tries other activities)

    No central controller.
    No direct vessel-to-vessel communication.
    Coordination through the field.
```

---

## Vessel Composition and State Distinction

### Key Insight

**Vessels are compositions of vessels.** To enable a capability at an instance, its vessel must necessarily be a composition of many sub-vessels.

**Vessels exist in the informational state.** They are organizations of instructions, blueprints, potential - not running processes.

**Traces come from the functional state.** The in-vivo runtime environment produces traces. Instances execute; vessels define.

### The Ontological Structure

```
INFORMATIONAL STATE (vessels)          FUNCTIONAL STATE (instances)
┌─────────────────────────────┐       ┌─────────────────────────────┐
│                             │       │                             │
│  Vessel A                   │       │  Instance of A              │
│  ├── Vessel B (file)        │  ───► │  (running, producing        │
│  ├── Vessel C (git)         │       │   traces in real env)       │
│  ├── Vessel D (llm)         │       │                             │
│  └── Vessel E (sql)         │       └──────────────┬──────────────┘
│                             │                      │
│  (composition of            │                      │ traces
│   capabilities)             │                      ▼
│                             │       ┌─────────────────────────────┐
└─────────────────────────────┘       │  Trace Field                │
                                      │  (records of functional     │
        ▲                             │   state executions)         │
        │ learning                    └─────────────────────────────┘
        │ (patterns extracted)                   │
        └────────────────────────────────────────┘
```

### Implications

1. **Vessels are not monolithic** - They're graphs of composed sub-vessels
2. **Shared sub-vessels** - Improving a sub-vessel improves all vessels that compose it
3. **Traces span compositions** - An execution trace may involve multiple sub-vessels
4. **Learning is informational** - Patterns extracted from traces update the vessel definitions
5. **Instances are ephemeral** - They exist only during execution; vessels persist

### The Composition Question

When we burrow into an application, we're not creating one vessel - we're creating a *composition*:

```
Burrowed Payment App Vessel
├── HTTP Resolver Vessel (handles API calls)
├── SQL Resolver Vessel (handles database)
├── Secrets Resolver Vessel (handles credentials)
├── Logging Vessel (handles observability)
└── [domain-specific activity vessels]
```

Each sub-vessel:
- Has its own resolver capabilities
- Can be shared across multiple parent vessels
- Contributes to traces when its capabilities are used
- Can be improved independently

### This Relates to the Convergent Principles

- **Scale invariance**: Vessels compose like activities compose like tasks compose
- **Renormalization**: Sub-vessels are coarse-grained from trace patterns
- **Stigmergy**: The trace field is shared across all instances of all vessel compositions
- **Horizontal transfer**: Improving a sub-vessel is horizontal transfer to all parents

---

## Open Questions for Later

1. **How do we implement the "trace field" efficiently?**
   - Tiered storage (hot/warm/cold)?
   - Sampling strategies (head + tail)?
   - Aggregation at ingestion?

2. **How do we handle cross-domain learning?**
   - Patterns from payment processing applicable to code editing?
   - What's the right level of abstraction for transfer?

3. **How do we detect criticality?**
   - Are we at the edge, or too ordered, or too chaotic?
   - What metrics indicate healthy criticality?

4. **How do we implement horizontal transfer (gossip)?**
   - When should vessels share directly vs through backend?
   - What triggers direct sharing?

5. **How do we handle the abstraction hierarchy?**
   - Trace → Activity → Composition → Goal → Domain
   - Is Thompson Sampling appropriate at all levels?
   - Different timescales for different levels?

6. **What's the minimal viable stigmergic system?**
   - What's the simplest trace field that enables emergence?
   - What can we strip away?

---

## References

### Biology
- Clonal selection and affinity maturation
- Memory consolidation (hippocampus-neocortex)
- Stigmergy and swarm intelligence
- Quorum sensing and horizontal gene transfer
- Waggle dance information sharing

### Socioeconomics
- Hayek's knowledge problem and price signals
- Epistemic communities
- Memetics and cultural evolution
- Prediction markets
- DAO coordination mechanisms

### Mathematics
- Thompson Sampling and multi-armed bandits
- Information bottleneck theory
- Consensus algorithms
- Category theory for composable systems
- Mechanism design

### Physics
- Statistical mechanics and emergence
- Landauer's principle (thermodynamics of information)
- Universality classes and critical phenomena
- Self-organized criticality
- Renormalization group

---

## Lessons from Story-Generator (Prior Attempt)

### Terminology Mapping

| Story-Generator | Metabob-DevBob | Meaning |
|-----------------|----------------|---------|
| Extension | Vessel | Isolated execution environment with capabilities |
| Shared State | Impulse | Data pointers with lazy loading |
| Task | Activity | Structured work unit |
| Execution Trace | Execution | Record of what happened |
| Capability Advertisement | Activity Registry | What can this thing do? |
| Gossip Protocol | (not yet) | Peer-to-peer coordination |

### What Worked (Carry Forward)

1. **State Pointer Pattern**
   - Pointers instead of copying data
   - Lazy loading, memory efficient
   - Prevents context duplication
   - **Already in our impulse system**

2. **Extension/Vessel Concept**
   - Process isolation is powerful
   - Capability advertisement cleaner than hardcoded routing
   - Self-contained packages scale well

3. **Tool-Based Coordination**
   - Tools instead of agent-to-agent communication
   - Execution-driven learning from real outcomes
   - State transitions more reliable than conversation
   - **Already in our foundation: "LLMs are tools, not controllers"**

4. **Rule-Driven Adaptation**
   - Domain structure from database, not code
   - Agents learn domain dynamically
   - No hardcoded assumptions
   - **Aligns with "metadata first, content later"**

### Why It Failed (Avoid)

1. **Distributed Too Early**
   - Tried distributed + multi-domain + learning + capability discovery simultaneously
   - Fundamental instability permeated everything
   - **Lesson**: Single-machine reliability first

2. **Over-Engineered From Start**
   - Elaborate extension lifecycle management
   - Gossip protocol, capability registries, shared memory IPC
   - Too much too soon
   - **Lesson**: Start simple, add sophistication when needed

3. **Test Infrastructure Neglected**
   - Tests were afterthought
   - Core system became unstable, tests couldn't keep up
   - **Lesson**: Tests first, or they'll fail catastrophically

4. **Architecture by Specification**
   - Extensive docs describing ideal system
   - Code tried to match aspirational design
   - Mismatch between spec and actual needs
   - **Lesson**: Let architecture emerge from working code

5. **Frequent Core Refactors**
   - ExtensionProcessManager → SharedMemoryExtensionManager → ...
   - Each refactor broke tests
   - **Lesson**: Get core interfaces right early, or pay dearly

### Key Technical Insight

Story-generator's state pointer pattern aligns remarkably with our impulse concept:

```
Story-Generator:                  Metabob-DevBob:
┌─────────────────────┐          ┌─────────────────────┐
│ State Pointer       │          │ Impulse             │
│ ├── key            │    ≈     │ ├── id              │
│ ├── version        │          │ ├── pointer         │
│ ├── metadata       │          │ ├── shape (metadata)│
│ └── resolver       │          │ └── resolver        │
└─────────────────────┘          └─────────────────────┘
```

Both systems recognized: **don't move data, move pointers with metadata**.

### What We're Doing Differently

| Story-Generator Approach | Our Approach |
|-------------------------|--------------|
| Distributed from start | Single-machine first (MiniBob) |
| Gossip protocol for coordination | Stigmergic trace field |
| Capability advertisement | Thompson Sampling on activities |
| Complex extension lifecycle | Simple vessel composition |
| Architecture by specification | Foundation doc + emergence |

### Integration Opportunities

1. **Versioned state entries** - Could enhance impulse system
2. **Capability advertisement** - Could inform activity recommendation
3. **Execution-driven learning** - Complements Thompson Sampling
4. **Extension isolation** - Informs vessel deployment

---

## Next Steps

When returning to this:
1. Review the convergent principles
2. Pick one to prototype (stigmergy is foundational)
3. Design minimal experiment to validate
4. Iterate based on observed behavior
5. Remember story-generator lessons: simple first, distribute later
