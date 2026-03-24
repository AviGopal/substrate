# Terminology Glossary

**Status:** ✅ Canonical reference for all system terminology

## Purpose

This glossary provides **precise, canonical definitions** for all terms used across the metabob-devbob system. Use this as the authoritative reference when writing specs, code, or documentation.

**Rules:**
- Use these exact terms (case-sensitive where noted)
- Do NOT use synonyms or variations
- When in doubt, reference this glossary

## Core Ontological Terms

### Vessel

**Definition:** Instructional state - the static capacity to execute, the blueprint, the potential.

**What it IS:**
- Static specification (does not change during execution)
- Reusable (same vessel → multiple instances)
- Versionable (can be stored, compared, evolved)
- A collection of instructions that CAN execute

**What it is NOT:**
- NOT an executor (doesn't "run" things)
- NOT a framework (doesn't manage or orchestrate)
- NOT the execution itself (that's the becoming)

**Examples:**
- Activity template (JSON specification)
- MiniBob executable (Bun application)
- Docker image
- MCP server configuration

**Code references:**
- Activity templates: `repos/minibob/templates/*.json`
- MiniBob vessel: `repos/minibob/index.ts`

**Status:** ✅ Proven through multiple vessel implementations

---

### Becoming

**Definition:** Transient state - the active transformation, the execution in flight, the state transition itself.

**What it IS:**
- Ephemeral (exists only during transition)
- Irreducible (cannot be fully captured in static state)
- Temporal (has duration, flow, phases)
- Transformative (changes both itself and what it acts upon)
- Learning (accumulates patterns, adjusts behavior)
- Continuous (even when "idle", learning continues)

**What it is NOT:**
- NOT stored in database (only traces/instances are stored)
- NOT a process (more fundamental than process)
- NOT deterministic (learns and adapts)

**Examples:**
- Activity executing (task by task, tool call by tool call)
- LLM generating response (token by token streaming)
- Thompson Sampling loop (select → execute → update)
- **The system itself**: Continuous transformation templates → executions → learning → improved templates

**Code references:**
- Activity execution: `repos/minibob/src/activity.ts` (executeActivity)
- Improvisation: `repos/minibob/src/improviser.ts`

**Status:** 🔴 The core focus of this entire project - partially manifested, continuously evolving

**Critical insight:** OpenCode, MiniBob, and other vessels are **substrates** through which the becoming manifests. They are not the becoming itself.

---

### Instance

**Definition:** Functional state - the realized outcome, the artifact, the actualized result.

**What it IS:**
- Observable (can be inspected, measured)
- Specific (unique ID, state, history)
- Momentary (represents state at a point in time)
- Dynamic (changed from initial state through becoming)

**What it is NOT:**
- NOT the same as the becoming (becoming is the transformation, instance is the result)
- NOT static (represents a specific point in state evolution)

**Examples:**
- Completed activity execution record
- Running MiniBob process with mounted volumes
- Docker container in specific state
- Modified codebase after activity execution

**Code references:**
- Execution traces: `repos/metabob-activity-api/src/routes/activities.ts`
- Database records: SurrealDB `activity_execution`, `impulse_relevance` tables

**Status:** ✅ Proven - instances captured and stored

**Key insight:** The instance immediately becomes the vessel for the next transformation (continuous loop, not linear progression).

---

### MiniBob

**Definition:** Minimal substrate (~3,000 LOC) that enables the becoming to manifest.

**What it IS:**
- Substrate (provides execution context)
- Proof of vessel-agnosticism (interchangeable with other vessels)
- Lightweight integration layer (LLM + tools + state capture)
- A vessel implementation (not the only possible one)

**What it is NOT:**
- NOT an executor (doesn't "run" activities - it's a substrate for the becoming)
- NOT a framework (doesn't manage or orchestrate)
- NOT the becoming itself (it's a vessel through which becoming manifests)
- NOT the only vessel (OpenCode, CLI, API are also vessels)

**Capabilities:**
- Execute activities with LLM
- Capture execution traces
- Resolve LOCAL impulses (`memo`, `file`)
- Delegate to backend for other impulse types
- Self-development via ribosome pattern

**Code references:**
- Entry point: `repos/minibob/index.ts`
- Activity execution: `repos/minibob/src/activity.ts`
- Goal processing: `repos/minibob/src/goal-processor.ts`

**Status:** ✅ Proven as minimal substrate

**Common misuse:** "MiniBob executes activities" → Correct: "Activities execute through MiniBob as substrate"

---

## Activity System Terms

### Activity

**Definition:** Structured, measured, and validatable recipe for sequences of state mutations (functional state transformations).

**What it IS:**
- A vessel (instructional state)
- Sequence of tasks with specific structure
- Measured (success rate, duration, cost tracked)
- Validatable (required files, patterns, forbidden patterns)
- Versionable (variants created from failures)

**What it is NOT:**
- NOT a script (more structured, with validation and measurement)
- NOT a workflow (workflows orchestrate, activities specify transformations)
- NOT ad-hoc commands (activities are reusable and measured)

**Schema:**
```typescript
{
  id: string
  name: string
  category: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure"
  tasks: Task[]
  metadata: {
    successRate: number
    avgDuration: number
    avgCost: number
  }
}
```

**Code references:**
- Schema: `repos/minibob/src/types.ts` (ActivityTemplate)
- Execution: `repos/minibob/src/activity.ts`
- Storage: `repos/metabob-activity-api/src/routes/activities.ts`

**Status:** ✅ Proven - templates executing successfully

---

### Task

**Definition:** Single step within an activity, representing one state transformation.

**What it IS:**
- Atomic unit of work
- Has description, impulses, validation rules
- Can retry on failure
- Produces output state

**What it is NOT:**
- NOT a bash command (tasks may use bash, but they're higher-level)
- NOT a function call (tasks describe transformations)

**Schema:**
```typescript
{
  id: string
  description: string
  prompt: {
    template: string
    variables: Variable[]
  }
  impulseRefs: string[]
  validation: {
    requiredFiles?: string[]
    requiredPatterns?: string[]
    forbiddenPatterns?: string[]
  }
  retry: {
    maxAttempts: number
    strategy: "exponential" | "linear"
  }
}
```

**Code references:**
- Schema: `repos/minibob/src/types.ts` (Task)
- Execution: `repos/minibob/src/activity.ts` (executeTask)

**Status:** ✅ Proven

---

### Impulse

**Definition:** Dynamic context injection mechanism - lazy-loaded pointer to content with token budget and priority.

**What it IS:**
- Pointer to content (not the content itself)
- Lazy-loaded (only resolved when needed)
- Token-budgeted (max tokens specified)
- Prioritized (high/medium/low)
- Managed by memory agent

**What it is NOT:**
- NOT instructions (impulses are context data, not directives)
- NOT always loaded (lazy loading conserves context window)
- NOT static (can be loaded/unloaded dynamically)

**Lifecycle:**
```typescript
// 1. CREATE: Define pointer (unloaded state)
{
  id: "errorFile",
  pointer: { type: "file", path: "src/tool/bash.ts", offset: 40, limit: 20 },
  budget: 2000,
  priority: "high",
  loaded: false,
  content: null
}

// 2. LOAD: Resolve pointer, load content
const loaded = await ImpulseResolver.load(impulse)

// 3. INJECT: Format for prompt
const context = formatImpulsesForContext(taskImpulses)

// 4. UNLOAD: Free memory
const unloaded = ImpulseResolver.unload(impulse)
```

**Pointer Types:**

**Local (MiniBob resolves):**
- `memo`: Embedded content
- `file`: Read from filesystem

**Backend (metabob-activity-api resolves via MCP):**
- `activityExecutionTrace`: Full execution trace with state
- `activityTemplate`: Template structure and metadata
- `activityMetrics`: Performance data
- *Any new type*: Backend can add types without MiniBob changes

**Code references:**
- Schema: `repos/minibob/src/types.ts` (Impulse, ImpulsePointer)
- Resolution: `repos/minibob/src/impulse.ts`
- Backend resolution: `repos/metabob-activity-api/src/routes/impulses.ts`

**Status:** ✅ Local resolution proven | ⚠️ Backend resolution implemented

**Common misuse:** "Load all impulses at start" → Correct: "Load impulses lazily based on task needs and priority"

---

## Execution Modes

### Template-Driven Execution

**Definition:** Execute a pre-defined sequence of tasks with known structure and minimal variation.

**Characteristics:**
- Highest constraint
- Fastest execution
- Highest reliability
- Lowest creativity

**When to use:** Repetitive tasks with known solutions

**Status:** ✅ Proven

**See also:** [improvisation-spectrum.md](./improvisation-spectrum.md#1-template-driven-execution)

---

### Goal-Seeking

**Definition:** Given a goal description and context (impulses), adaptively find a path to achieve the goal.

**Characteristics:**
- Medium-high constraint
- Medium speed
- Medium reliability
- Medium creativity

**What it IS:**
- Adaptive path-finding toward goal
- Meso-level improvisation (task sequence emerges)
- Intent-driven (goal specifies destination, not path)

**What it is NOT:**
- NOT search (doesn't search for templates, improvises path)
- NOT template-driven (no pre-defined task sequence)
- NOT pure improvisation (goal provides constraint)

**When to use:** Known goal, unknown or varying path

**Code references:**
- Implementation: `repos/minibob/src/goal-processor.ts`
- API: `repos/minibob/src/improviser.ts` (mesoscale)

**Status:** 🔴 Experimental - implemented but not validated

**See also:** [improvisation-spectrum.md](./improvisation-spectrum.md#2-goal-seeking-execution)

---

### Improvisation

**Definition:** Emergent approach to achieving goals without predetermined structure.

**Three levels:**
1. **Microscale**: Within a task (adapt tool calls, handle edge cases)
2. **Mesoscale**: Task sequence (determine which tasks needed for goal)
3. **Macroscale**: Problem structure (discover entirely new approaches)

**What it IS:**
- Creative emergence
- Adaptation to context
- Discovery of novel patterns
- Foundation for ribosome pattern

**What it is NOT:**
- NOT random (guided by intent and feedback)
- NOT undirected (goal or intent provides direction)
- NOT inefficient (improvisation → template extraction via ribosome)

**Code references:**
- Implementation: `repos/minibob/src/improviser.ts`
- Used by: Goal-seeking, pure improvisation modes

**Status:** ⚠️ Mesoscale implemented | 🔴 Macroscale experimental

**See also:** [improvisation-spectrum.md](./improvisation-spectrum.md)

---

## Learning System Terms

### Ribosome Pattern

**Definition:** Activities that create activities - extraction of successful executions into reusable templates.

**How it works:**
1. Execute goal-seeking or improvisation
2. Capture full execution trace with state transitions
3. If successful, extract task sequence
4. Generate activity template from sequence
5. Store template for future reuse

**What it IS:**
- Bridge between improvisation and template-driven execution
- Self-improvement mechanism
- Template extraction pipeline
- Learning from successful executions

**What it is NOT:**
- NOT automatic yet (extraction implemented, triggers not automated)
- NOT perfect (extracted templates may need refinement)
- NOT the only learning mechanism (Thompson Sampling also learns)

**Code references:**
- Implementation: `repos/minibob/src/activity.ts` (assembleTemplateFromExecution)
- State tracking: Enhanced execution traces with before/after state

**Status:** 🔴 Experimental - basic extraction works, advanced features not built

**See also:** [improvisation-spectrum.md](./improvisation-spectrum.md#the-ribosome-pattern)

---

### Thompson Sampling

**Definition:** Probabilistic template selection algorithm that learns which variants perform best over time.

**How it works:**
1. Maintain success/failure counts for each template variant
2. Sample from Beta distribution for each variant
3. Select variant with highest sampled value
4. Execute selected variant
5. Update counts based on execution result

**What it IS:**
- Multi-armed bandit algorithm
- Exploration/exploitation balance
- Data-driven template selection
- A/B testing without explicit configuration

**What it is NOT:**
- NOT deterministic (probabilistic selection)
- NOT greedy (explores suboptimal variants sometimes)
- NOT static (continuously updates probabilities)

**Code references:**
- Implementation: `repos/metabob-activity-api/src/routes/activities.ts` (recommend endpoint)
- Algorithm: Beta distribution sampling with success/failure counts

**Status:** ⚠️ Implemented in backend, needs production validation

**See also:** Backend API `/v2/activities/recommend` endpoint

---

### Execution Trace

**Definition:** Complete record of an activity execution, including inputs, outputs, state transitions, and metadata.

**What it IS:**
- Instance (functional state after becoming completes)
- Observable record of transformation
- Input for learning algorithms
- Foundation for ribosome pattern

**What it is NOT:**
- NOT the execution itself (trace is the record, not the becoming)
- NOT real-time (captured after execution completes)
- NOT complete (irreducible becoming cannot be fully captured)

**Schema:**
```typescript
{
  id: string
  activityId: string
  success: boolean
  duration: number
  cost: number
  inputState: {
    filesAvailable: string[]
    environment: Record<string, string>
    impulses: string[]
    variables: Record<string, unknown>
  }
  outputState: {
    filesModified: string[]
    filesCreated: string[]
    filesDeleted: string[]
    exitCode?: number
    stderr?: string
  }
  stateTransition: {
    before: Record<string, string>  // File → hash
    after: Record<string, string>   // File → hash
    workingDirectory: string
  }
  tasks: TaskExecution[]
  metadata: Record<string, unknown>
}
```

**Code references:**
- Capture: `repos/minibob/src/activity.ts` (captureExecutionTrace)
- Storage: `repos/metabob-activity-api/src/routes/activities.ts` (POST /execution-traces)

**Status:** ✅ Basic trace capture proven | ⚠️ Enhanced state tracking implemented

---

## Integration Terms

### MCP (Model Context Protocol)

**Definition:** Protocol for connecting LLM applications to external data sources and tools.

**What it IS:**
- Standard protocol (not metabob-specific)
- Client-server architecture
- Tool discovery and invocation mechanism
- Resource access protocol

**What it is NOT:**
- NOT our invention (industry standard from Anthropic)
- NOT the only integration method (also REST API, direct calls)

**Usage in this system:**
- MiniBob uses MCP client to connect to metabob-activity-api
- Backend exposes impulse resolution via MCP
- Backend provides activity recommendations via MCP

**Code references:**
- Client: `repos/minibob/src/mcp.ts`
- Server: `repos/metabob-activity-api/src/index.ts` (MCP endpoints)

**Status:** ✅ MCP client proven | ⚠️ MCP server implemented

---

### ACP (Activity Composition Protocol)

**Definition:** Protocol for vessel-to-vessel communication and coordination.

**What it IS:**
- Custom protocol for this system
- Vessel-agnostic communication
- Activity invocation across vessels
- State synchronization mechanism

**What it is NOT:**
- NOT implemented yet (experimental code only)
- NOT proven (no production usage)

**Code references:**
- Experimental: `repos/minibob/src/acp.ts`

**Status:** 🔴 Experimental - concept defined, minimal implementation

---

## Infrastructure Terms

### Substrate

**Definition:** Execution environment that provides context for the becoming to manifest.

**What it IS:**
- Execution context (LLM access, tools, filesystem)
- Interchangeable (MiniBob, OpenCode, CLI all substrates)
- Enabler (makes becoming possible)

**What it is NOT:**
- NOT the executor (doesn't "run" things)
- NOT the becoming (provides context for becoming)
- NOT a framework (simpler, more fundamental)

**Examples:**
- MiniBob (Bun application)
- OpenCode library integration
- CLI wrapper
- HTTP API server

**Status:** ✅ Proven through multiple substrate implementations

---

### Boredom Activity

**Definition:** Autonomous improvement activity triggered when system is idle (5+ minutes).

**What it IS:**
- Self-improvement mechanism
- Idle-time utilization
- Continuous becoming even when "not working"
- Template optimization and creation

**What it is NOT:**
- NOT user-directed (system-initiated)
- NOT critical path (can be interrupted)
- NOT always successful (exploratory by nature)

**Examples:**
- Debug failed templates
- Optimize slow templates
- Create variants from errors
- Clean up old executions

**Code references:**
- Detection: `repos/minibob/src/activity.ts` (boredom threshold logic)
- Templates: `templates/fix-boredom-activities-v1.json`

**Status:** ⚠️ Implemented but needs tuning (currently too aggressive)

---

## Common Misuses to Avoid

### "MiniBob executes activities"
**Wrong.** MiniBob is a substrate through which activities manifest as becoming.
**Correct:** "Activities execute through MiniBob as substrate."

### "The template runs"
**Wrong.** Templates are vessels (instructional state). They don't "run."
**Correct:** "The template instantiates a becoming when invoked."

### "Load all impulses"
**Wrong.** Impulses are lazy-loaded based on priority and token budget.
**Correct:** "Load high-priority impulses first, others as needed."

### "Goal-seeking searches for templates"
**Wrong.** Goal-seeking is adaptive path-finding, not search.
**Correct:** "Goal-seeking improvises a path to the goal using provided context."

### "MiniBob is the executor"
**Wrong.** MiniBob is a substrate, not an executor.
**Correct:** "MiniBob provides substrate for the becoming to manifest."

### "Store the execution in the database"
**Wrong.** The becoming (transient state) cannot be stored. The trace (instance) is stored.
**Correct:** "Store the execution trace (instance) after the becoming completes."

### "The ribosome creates templates automatically"
**Wrong.** Basic extraction works, but triggers are not automated.
**Correct:** "The ribosome can extract templates from successful executions; automation is planned."

### "Thompson Sampling optimizes templates"
**Wrong.** Thompson Sampling selects templates, not optimizes them.
**Correct:** "Thompson Sampling learns which template variants perform best through probabilistic selection."

## Related Documentation

**Foundation:**
- [ontology-foundation.md](./ontology-foundation.md) - Three-state model explained
- [improvisation-spectrum.md](./improvisation-spectrum.md) - Execution modes detailed
- [alignment-checklist.md](./alignment-checklist.md) - Verify usage of terms

**Architecture:**
- [docs/architecture/ONTOLOGY_OF_BECOMING.md](../../docs/architecture/ONTOLOGY_OF_BECOMING.md) - Philosophical foundation
- [docs/architecture/VESSEL_ARCHITECTURE_CORRECTED.md](../../docs/architecture/VESSEL_ARCHITECTURE_CORRECTED.md) - Vessel patterns

**Implementation:**
- `repos/minibob/src/types.ts` - TypeScript type definitions
- `repos/metabob-activity-api/src/models/schemas.ts` - Database schemas
