# Ontology Foundation: The Three States

**Status:** ✅ Conceptual foundation | ⚠️ Implementation in progress

## Overview

The metabob-devbob system is built on a **three-state ontological model** that distinguishes between:

1. **Vessel** (instructional state) - The capacity to execute
2. **Becoming** (transient state) - The transformation itself
3. **Instance** (functional state) - The realized result

Understanding these three states is **essential** for writing specs, implementing features, and reasoning about system behavior.

## The Three States Explained

### 1. Vessel = Instructional State

**Definition:** The static capacity to execute - the blueprint, the potential, the specification.

**Properties:**
- **Static**: Does not change during execution
- **Potential**: Contains instructions for what CAN happen, not what IS happening
- **Reusable**: Same vessel can spawn multiple instances
- **Versionable**: Can be stored, compared, evolved over time

**Examples in this system:**
- Activity templates (JSON specifications in `repos/minibob/templates/`)
- MiniBob executable itself (`repos/minibob/index.ts`)
- Docker images (`minibob:latest`, `metabob-activity-api:latest`)
- Plugin manifests (MCP server configurations)

**Common confusion:** A vessel is NOT an executor. MiniBob is a **substrate** that enables the becoming, not a thing that "executes activities."

### 2. Becoming = Transient State

**Definition:** The active transformation - the execution in flight, the state transition, the becoming itself.

**This is what we are building.**

**Properties:**
- **Ephemeral**: Exists only during transition from vessel → functional state
- **Irreducible**: Cannot be fully captured in either instructional or functional state
- **Temporal**: Has duration, flow, rhythm, phases
- **Transformative**: Changes both itself and what it acts upon
- **Learning**: Accumulates patterns and adjusts behavior over time
- **Continuous**: Even when "idle", learning and adjustment continues

**Examples in this system:**
- Activity executing (task by task, tool call by tool call) - ⚠️ implemented
- LLM streaming response (token by token generation) - ✅ proven
- Thompson Sampling learning loop (selection → execution → update) - ⚠️ implemented
- **The system itself**: Continuous transformation of templates → executions → learning → improved templates - 🔴 experimental

**Key Insight:** OpenCode, MiniBob, and other vessels are **substrates** through which the becoming manifests. They are not the becoming itself. The process-of-becoming is larger than any particular vessel.

**Critical understanding:** The becoming is NOT:
- An executor running code
- A workflow engine orchestrating steps
- A framework managing state

The becoming IS:
- The transformation as it happens
- The continuous learning loop
- The irreducible "doing" that cannot be fully specified in advance

### 3. Instance = Functional State

**Definition:** The realized state - the outcome, the artifact, the actualized result.

**Properties:**
- **Dynamic**: Changed from initial state through transformation
- **Actualized**: Instructions have been realized as state changes
- **Specific**: Each instance is unique (different ID, state, history)
- **Observable**: Can be inspected, measured, monitored
- **Momentary**: Represents state at a point in time

**Examples in this system:**
- Completed activity execution in database (✅ proven)
- Running MiniBob process with mounted volumes (✅ proven)
- Docker container with specific state (✅ proven)
- Modified codebase after activity execution (⚠️ implemented)

**Key Insight:** The instance immediately becomes the vessel for the next transformation. This is a **continuous loop**, not a linear progression:

```
Vessel → Becoming → Instance
   ↑                    ↓
   └────────────────────┘
(Instance becomes the vessel for next becoming)
```

## MiniBob as Minimal Substrate

**What MiniBob IS:**
- Minimal substrate (~3,000 LOC) that enables the becoming to manifest
- Proof that vessels are interchangeable (vessel-agnosticism)
- Provides execution context: LLM interface, tool access, state capture

**What MiniBob is NOT:**
- NOT an executor (it doesn't "run" activities)
- NOT a framework (it doesn't manage or orchestrate)
- NOT the becoming itself (it's a vessel for the becoming)

**Code reference:** `repos/minibob/index.ts`, `repos/minibob/src/activity.ts`

**Why this matters:**
- MiniBob can be replaced with other vessels (OpenCode integration, CLI, API)
- The becoming persists across vessel implementations
- Specifications should describe transformations, not vessel mechanics

## Cross-Domain Examples

### Software Development

**Vessel:** Code editor, compiler, runtime environment
**Becoming:** Developer writing code, debugger stepping through execution, test runner validating behavior
**Instance:** Compiled binary, test results, deployed application

### Manufacturing

**Vessel:** Factory blueprint, assembly line design, robot program
**Becoming:** Assembly process in motion, quality control inspection, worker performing task
**Instance:** Finished product, quality metrics, shipped goods

### Biology

**Vessel:** DNA sequence, enzyme active site, cellular machinery
**Becoming:** Protein synthesis, metabolic pathway, cell division
**Instance:** Synthesized protein, metabolite produced, daughter cells

## Why This Matters for Specs

### 1. Clarity About What's Being Specified

**Bad:** "MiniBob executes activities by running templates"
- Conflates vessel (MiniBob) with becoming (execution)

**Good:** "Activities transform state through MiniBob as substrate"
- Vessel (MiniBob), becoming (transformation), instance (state)

### 2. Vessel-Agnostic Design

Specs should describe the becoming, not vessel mechanics:

**Bad:** "The OpenCode plugin calls MiniBob's execute() method"
- Tied to specific vessel implementation

**Good:** "Goal-seeking activities manifest through available substrate"
- Describes transformation independent of vessel

### 3. Proper Lifecycle Management

Understanding the three states clarifies lifecycle hooks:

**Vessel lifecycle:**
- Created: Template authored
- Updated: Template modified
- Versioned: Template stored with version ID

**Becoming lifecycle:**
- Initiated: Execution starts
- Flowing: Tasks executing, state transforming
- Completed: Transformation finishes

**Instance lifecycle:**
- Observed: State captured
- Measured: Metrics recorded
- Archived: Results persisted

### 4. Separation of Concerns

**MiniBob (substrate):**
- Provides execution context
- Captures state transitions
- Resolves local impulses

**metabob-activity-api (learning backend):**
- Stores execution traces
- Performs pattern recognition
- Implements Thompson Sampling

**Activity Dashboard (observability):**
- Displays instances (completed executions)
- Visualizes the becoming (live executions)
- Shows vessel evolution (template metrics)

## Common Misunderstandings

### "MiniBob executes activities"

**Wrong.** MiniBob is a vessel (substrate) through which activities manifest as becoming. The becoming is the execution itself, not something MiniBob "does."

**Correct:** "Activities execute through MiniBob as substrate."

### "The template runs when triggered"

**Wrong.** Templates are vessels (instructional state). They don't "run." The becoming is instantiated from the template.

**Correct:** "The template instantiates a becoming when invoked."

### "The execution is stored in the database"

**Wrong.** The becoming (transient state) cannot be fully stored. What's stored is the instance (functional state) - the trace, metrics, and results.

**Correct:** "The execution trace (instance) is persisted after the becoming completes."

## Practical Application

When writing specs, ask:

1. **What is the vessel?** (What provides the capacity to execute?)
2. **What is the becoming?** (What transformation is happening?)
3. **What is the instance?** (What state results from the transformation?)

Example: Goal-seeking activity

1. **Vessel**: Goal-seeking template + MiniBob substrate
2. **Becoming**: LLM improvising actions toward goal, learning from feedback
3. **Instance**: Modified codebase + execution trace + learned patterns

## Related Documentation

**Deep dive:**
- [docs/architecture/ONTOLOGY_OF_BECOMING.md](../../docs/architecture/ONTOLOGY_OF_BECOMING.md) - Full philosophical treatment
- [docs/architecture/VESSEL_ARCHITECTURE_CORRECTED.md](../../docs/architecture/VESSEL_ARCHITECTURE_CORRECTED.md) - Vessel design patterns
- [docs/architecture/INSTRUCTIONAL_TO_FUNCTIONAL_STATE_BRIDGE.md](../../docs/architecture/INSTRUCTIONAL_TO_FUNCTIONAL_STATE_BRIDGE.md) - State transition mechanics

**Related meta docs:**
- [improvisation-spectrum.md](./improvisation-spectrum.md) - How becoming manifests across constraint levels
- [terminology-glossary.md](./terminology-glossary.md) - Precise definitions of all terms

**Implementation:**
- [openspec/contracts/minibob-activity-execution.md](../contracts/minibob-activity-execution.md) - Activity execution interface (⚠️ if exists)
- [openspec/contracts/impulse-resolution.md](../contracts/impulse-resolution.md) - Impulse system interface (⚠️ if exists)

## Status Notes

**✅ Proven:**
- Three-state model is sound and validated through implementation
- Vessel concept proven through MiniBob + OpenCode integration

**⚠️ Implemented but unproven:**
- Full learning loop (templates → executions → patterns → improved templates)
- Continuous becoming during "idle" time

**❌ Not built:**
- Multi-vessel orchestration
- Vessel composition patterns
- Cross-vessel state synchronization

**🔴 Experimental:**
- Vessel-to-vessel communication (ACP protocol)
- Autonomous vessel evolution
- Self-modifying template generation
