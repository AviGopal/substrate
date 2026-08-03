# Impulse-Activity Foundation

> **Status**: Canonical reference document. Foundational model is **hypothesis under test**, not declaration. The system is not yet self-stable; we test the minimum set by observing what breaks.
> **Purpose**: The foundational model for the entire system. All other architecture documents derive from this.
> **Companions**: this document is the conceptual model; four lenses read the *same
> system* in other vocabularies, and you should prefer cross-referencing them over
> restating their content here:
> - [`SUBSTRATE_AS_MDP.md`](SUBSTRATE_AS_MDP.md) — the **learning rule** (Bayesian
>   Q-learning): Thompson mechanics (§2), credit propagation (§3),
>   orthogonality/factorization (§4), the dual-arm invariant manifold (§4.6), the
>   theorem-vs-frontier scorecard (§11).
> - [`SUBSTRATE_AS_DEC.md`](SUBSTRATE_AS_DEC.md) — the **structure** (discrete
>   exterior calculus / Hodge): shapes as cells, activities as hyperedges, the
>   learned metric `⋆`, livelock as harmonic residual.
> - [`SUBSTRATE_AS_DYNAMICS.md`](SUBSTRATE_AS_DYNAMICS.md) — the **flow in time**
>   (slow–fast dynamics): the transient-as-steady-state slow manifold and the
>   `λ₁(L(t)) ≳ ρ_grow` stability threshold for self-expansion.
> - [`SUBSTRATE_AS_SOFTWARE.md`](SUBSTRATE_AS_SOFTWARE.md) — the **engineering**
>   view (durability): the three states as durability groups, which primitives are
>   implementation detail, and `resolver_tier` as binned directional certainty.
>
> **Term registry**: [`../GLOSSARY.md`](../GLOSSARY.md) fixes canonical spellings
> and lists deprecated aliases. Where a name here drifted (the three states; "The
> Two Primitives"), the glossary and the canonical notes below are authoritative.

---

## Core Premise

We are building a system that can understand arbitrary workflows by observing how intents match to outcomes. The goal is to progressively convert stages of any workflow into increasingly programmatic components that we can route to, rather than building new things from scratch every time.

The system collapses the gap between:
- **Intent → Code**: Understanding what needs to be done
- **Code → Outcome**: Understanding what happened and why

By recording the full trace of how inputs transform to outputs, we learn patterns. By constraining the search space with activities, we make execution tractable. By allowing improvisation with recording, we enable the system to grow its own capabilities.

---

## Three States, Two Motions

> **Canonical triad.** These three — **Informational / Transient / Observational** —
> are the canonical state names. The "Relating to the Three-State Ontology" section
> below describes the *same triad* under older names (Instructional / Functional);
> those are deprecated aliases. Durability bridge: [`SUBSTRATE_AS_SOFTWARE.md`](SUBSTRATE_AS_SOFTWARE.md).

The system rotates through three states, each with a single rotation:

- **Informational (i)** — the structure: shapes, templates, posteriors, learned topology. What the system knows about *how things go*.
- **Transient (t)** — the becoming: an execution in flight, an impulse being resolved, a binding being chosen.
- **Observational (o)** — the recorded outcome: traces, validation results, success/failure signals.

Two named motions traverse these states:

- **Recall** (i → t → o): apply existing structure. The system retrieves an activity template (i), executes it (t), and observes the outcome (o). Thompson Sampling, activity dispatch, and composition all flow recall-direction.
- **Learning** (o → t → i): mint structure from observation. The system reads traces (o), reasons about patterns (t), and updates posteriors / extracts templates / discovers shapes (i). The ribosome, β/α updates, impulse-relevance writes, and composition-edge updates all flow learning-direction.

The system is building a **topology of the informational state** by alternating between these two motions. Recall consumes structure; learning produces it. Convergence is when recall reliably succeeds without learning needing to add new structure for known goal classes.

---

## Pointer-as-Shape: The Bootstrap Principle

**The pointer is the shape of an impulse.** All resolution and all learning are keyed on the pointer. Without a pointer, no other primitive has a learnable address — no resolver knows what to dispatch on, no Thompson posterior has a key, no trace has a co-occurrence signal.

This is the bootstrap concept: pointer-as-shape is what makes everything else addressable. Resolvers dispatch on `pointer.type`. Activity matching compares `inputSchema.required` shapes against the pointer types in the available pool. Impulse-relevance posteriors are keyed on `(activity, pointer-shape)`. Composition edges are typed by output-shape → input-shape compatibility.

When this document refers to a "shape" in the abstract, the concrete artifact is always the pointer's type field plus its metadata. Shapes are not declared in a global registry; they are learned types — observed when vessels advertise resolvers, refined when traces show co-occurrence patterns, and pruned when no resolver claims them.

---

## Minimum Self-Stable Set (Hypothesis Under Test)

A system is **self-stable** if it can describe and modify itself using only its own primitives. The conjectured minimum set is four primitives:

1. **Impulse** — substrate. A pointer plus metadata plus (lazily resolved) body.
2. **Pointer** — shape. The bootstrap key for resolution and learning.
3. **Resolver** — function from pointer to content. Some resolvers are explicit (registered, advertised by vessels). Some are **implicit** (live inside executors and never appear in the registry — see "Implicit Vessels" below).
4. **Vessel** — a bundling of resolvers, including the implicit ones inside executors.

**Everything else should be derivable from these four:**

- **Activity** = an impulse of shape `activity_template`, resolved by an activity-resolver.
- **Lifecycle event** = an impulse of shape `lifecycle:*`, routed through an executor's implicit vessel to subscribed meta-activities.
- **Validator** = a resolver whose output is `validation_result`-shaped.
- **Trace** = a recorded set of impulses (inputs, intermediates, outputs).
- **Ribosome** = a resolver: trace-shaped → template-shaped.
- **Thompson posterior** = *should be* a shape (`thompson_posterior`); currently REST-only. This is a known structural gap (see "Known Gaps").

**Status:** This is a **hypothesis under test**, not a declaration. The system is not yet self-stable. We test the minimum by observing what breaks — places where one of the four primitives fails to express something the system needs (e.g., the missing `thompson_posterior` shape, the implicit vessels lacking discovery presence). Each break is data about whether the minimum is correct or whether something must be added. Top-level activity execution is no longer one of these breaks: the unified execution path is the chosen direction (see "Unified Execution Path" below). The refactor that routes goal-shaped and activity-template-shaped pointers through the standard impulse → resolver dispatch is pending, not unresolved.

The minimum may include primitives in informational state that lack shapes; those gaps surface as forced REST endpoints, hardcoded routing, or non-impulse state shared between subsystems. We treat each such case as evidence about the minimum.

**The data-plane invariant (2026-07-02).** Every vessel-to-vessel *data-plane*
exchange is a typed impulse: the caller resolves the target by shape via
discovery and POSTs the typed-pointer envelope
`{ "impulse": { "pointer": { "type": "<shape>", … } } }` to the target's
discovery-advertised `resolve_endpoint`. The endpoint *path* is per-vessel
advertised data, not part of the contract. Control-plane exchanges (discovery
register/heartbeat, identity auth, health probes) and a vessel accessing *its
own* store are exempt. Known violations, per-seam migration decisions, and the
dual-parse conformance prerequisite are tracked in
[`IMPULSE_CONFORMANCE_LEDGER.md`](IMPULSE_CONFORMANCE_LEDGER.md).

---

## The Two Primitives

> **Canonical (2026-06).** "The Two Primitives" (impulse + activity) is the legacy
> framing. The canonical minimum set is **four** — impulse, pointer, resolver,
> vessel — from which **activity is derived** ("an impulse of shape
> `activity_template`"). See the "Minimum Self-Stable Set" section and
> [`../GLOSSARY.md`](../GLOSSARY.md) §3. Read this section as the introduction to
> the two *most visible* primitives, not the closed set.

### Impulses: Data In Any Form

An **impulse** is a pointer to data with metadata that describes its shape. The data can be anything:

| Example | Shape | Resolver |
|---------|-------|----------|
| Text generated by LLM | `llm_response` | llm |
| Rows from SQL query | `user_table` | sql |
| HTML from React renderer | `ui_component` | render |
| Email received | `email_message` | email |
| Transcript of a call | `call_transcript` | telephony |
| Structured JSON | `json_object` | parse |
| Start signal for process | `process_trigger` | workflow |
| Voltage reading from sensor | `sensor_reading` | hardware |
| Command to motor | `motor_command` | actuator |
| File on disk | `file_content` | filesystem |
| Previous execution trace | `execution_trace` | trace_store |

All of these are conceptually identical: a pointer with metadata and a resolver that knows how to access the actual data.

```typescript
interface Impulse {
  id: string

  // The pointer - describes WHERE the data is
  pointer: {
    type: string           // resolver type
    [key: string]: unknown // type-specific params
  }

  // The metadata - describes WHAT the data looks like
  metadata: {
    shape: string          // semantic type
    rowCount?: number      // for collections
    columns?: string[]     // for tabular data
    summary?: string       // human/LLM readable description
    sample?: unknown[]     // representative examples
    availableOps?: string[] // what can be done with this data
    producedBy?: string    // lineage - what created this
  }

  // Resolution state
  loaded: boolean
  content?: unknown        // actual data when loaded

  // Resource management
  budget?: number          // max tokens/bytes to load
  priority?: string        // for memory management
}
```

**Key insight**: The metadata allows reasoners (LLM or otherwise) to understand the current state without loading all the raw data. The reasoner sees the shape, decides what to do, and lets the resolver do the actual data work.

### Activities: Constrained State Transitions

An **activity** is a structured execution pattern that links input impulse sets to output impulse sets. Activities exist to solve the search problem: given potentially infinite capabilities, which ones are relevant right now?

```typescript
interface Activity {
  id: string
  name: string

  // What inputs this activity accepts
  inputSchema: {
    required: ImpulseShape[]   // must have these shapes
    optional?: ImpulseShape[]  // may have these shapes
  }

  // What outputs this activity produces
  outputSchema: {
    produces: ImpulseShape[]   // will create these shapes
  }

  // The execution steps
  tasks: Array<{
    id: string
    description: string

    // Which resolver to use for this step
    resolver: string  // llm, sql, file, transform, etc.

    // How to configure the resolver
    params: {
      // resolver-specific configuration
    }

    // Validation
    validation?: {
      required?: string[]
      forbidden?: string[]
    }
  }>

  // Learning state (Thompson Sampling)
  thompson: {
    alpha: number  // successes + 1
    beta: number   // failures + 1
  }
}
```

**Key insight**: Activities constrain the search space. Instead of "what should I do with infinite capabilities?", the question becomes "which of these 3 matching activities should I use?". Thompson Sampling ranks them by learned success rate.

---

## Implementation Patterns

The interfaces above describe the **logical model**. Implementations may optimize for query performance, learning flexibility, and evolution. This section documents the intentional patterns used in production.

### Variant System

Activities may have multiple variants that compete via Thompson Sampling:

Variants are not extra dimensions added to a fixed tangent space —
tangent spaces have fixed dimensionality and that framing is a category
error. Each variant carries its own **MDL-minimum manifold**, with
dimensionality discovered from the horizons (temporal, conceptual,
scope) the variant has actually been exposed to. Variant competition
under Thompson is a competition between *per-activity manifolds at
their information-theoretic minimum dimensionalities*, not between
points on a shared manifold. See arXiv 2504.00395 (MDL representation
learning) and arXiv 2602.22873 (autoencoder atlases / multi-chart
manifold construction) for the formal apparatus; the substrate's
"patchwork of locally-learned activity manifolds" framing names
exactly this structure.

- **`activity_id`**: Groups related variants (e.g., `"debug-null-pointer"`)
- **`variant_id`**: Identifies a specific template version (e.g., `"debug-null-pointer:v3"`)

When an activity is recommended, the system probabilistically selects the best-performing variant based on learned success rates. New variants can be created through:
- Manual authoring
- Ribosome extraction from successful improvisations
- Automated optimization based on failure patterns

**Rationale**: This enables A/B testing of activity templates without explicit configuration. Variants compete; the best one naturally rises to the top through Thompson Sampling.

### Shape Matching Optimization

For query performance, `inputSchema.required` may be stored as a flat array:

```sql
input_shapes: array<string>  -- ["error_log", "source_code", "goal"]
```

This enables efficient matching using set operators:

```sql
WHERE input_shapes ALLINSIDE $available_shapes
```

The full `ImpulseShape` metadata (descriptions, collection hints) exists at extraction time but is not persisted in the query-optimized projection.

**Rationale**: Structured objects would require custom matching logic. Flat arrays with ALLINSIDE enable sub-millisecond activity matching even with thousands of templates.

### Computed Thompson Scores

Thompson parameters (`alpha`, `beta`) are computed from execution traces rather than stored directly on activities:

- **Views** (`v_activity_score`, `v_shape_conditioned_score`) aggregate success/failure counts at query time
- **Shape-conditioned learning** enables goal-aware success rates (activity X performs better when input includes shape Y)
- **Flexible grouping** allows per-user, per-vessel, or per-context learning without schema changes

**Rationale**: Storing α/β on the activity record would create update race conditions under concurrent execution. Computing from traces ensures consistency and enables richer conditioning without modifying the core activity schema.

---

## Vessels: Bundles of Capabilities

A **vessel** is a collection of activities and impulse resolvers that, when bundled together, provide capabilities in a specific context. The vessel exists where the data and execution happen.

> **Two senses, kept apart.** "Vessel" is used both *structurally* (this definition —
> a collection of activities + resolvers, an authored-durable code construct) and
> *operationally* (a running service instance with a `vessel_id`, health, and
> quirks). The structural vessel is *instantiated as* the operational one. See
> [`SUBSTRATE_AS_SOFTWARE.md`](SUBSTRATE_AS_SOFTWARE.md) §3.1.

```
VESSEL (an execution host, an editor integration, a hardware controller, etc.)
│
├── IMPULSE RESOLVERS
│   │
│   │  Resolvers live WHERE THE DATA IS
│   │
│   ├── file      → vessel has filesystem access
│   ├── sql       → vessel has database credentials
│   ├── llm       → vessel has API keys
│   ├── git       → vessel has repository
│   ├── sensor    → vessel has hardware connection
│   ├── motor     → vessel has actuator control
│   ├── trace     → queries trace store (backend)
│   └── [custom]  → domain-specific resolvers
│
├── ACTIVITIES
│   │
│   │  Activities define what this vessel CAN DO
│   │
│   ├── debug-failing-test
│   ├── implement-feature
│   ├── analyze-sensor-data
│   ├── control-robot-arm
│   └── [domain-specific activities]
│
└── TRACE RECORDING
    │
    │  Everything executed is recorded
    │
    └── Sent to trace store for learning
```

**Key insight**: The backend is not a universal resolver. It's a trace store. When a vessel "resolves" something from the backend, it's accessing historical execution data for replay and reflection. The actual data work happens in vessels, where the data lives.

### Implicit Vessels

Not every vessel advertises itself. **Implicit vessels** are bundles of resolvers that live inside executors but are not registered with the discovery-vessel and do not advertise shapes. They are vessels structurally — they bundle resolvers, dispatch by pointer shape, and serve content — but they are not addressable from the outside.

Two *internal* implicit vessels currently exist in the system (the boundary sense — operator, peer — is covered below):

1. **The ActivityExecutor on the execution host.** Runs activity templates task-by-task. It is the dispatch engine for both top-level activities and lifecycle subscribers (slot-binding, validator-dispatch, create-shape-provider-goal). It is not registered with discovery; it does not advertise shapes. Top-level activity execution today is invoked via in-process call (`executor.execute(template)`) from `goal-processor.ts`; the **unified execution path** refactor (see "Unified Execution Path" below) is the confirmed direction — goal-shaped and activity-template-shaped pointers will resolve through the standard impulse → resolver dispatch, with the activity resolver running the activity to resolve the pointer.

   **Shipped lifecycle events** emitted by the ActivityExecutor (all are `lifecycle:*`-shaped impulses routed to subscribed meta-activities):

   | Event | When fired | Key payload fields |
   |---|---|---|
   | `lifecycle:task:preBinding` | Before a task's input slots are bound | `taskId`, `requiredShapes`, `availablePool` |
   | `lifecycle:task:completed` | After a task resolves successfully | `taskId`, `templateId`, `outputShapes`, `resolverTier` |
   | `lifecycle:execution:succeeded` | After the full activity completes | `executionId`, `templateId`, `outputShapes` |
   | `lifecycle:gap:classified` | When the engine classifies a missing shape (gap) in the execution pool | `gapShape`, `executionId`, `classifiedAs` (`unreachable` \| `unknown`) — part of the coverage/topology-discovery loop (shipped `31eeeb2f`, engine commit `49bfb43`) |
   | `lifecycle:llm:dispatched` | When an LLM resolver task is dispatched | `taskId`, `resolver_id`, `model`, `estimated_cost_usd` (shipped `41382521`) |

2. **Thompson Sampling vessel inside activity-api**. Computes α/β/sample_count posteriors from execution traces; serves them via REST (`variantMetricsSummary`, `GET /v2/activities/:id/variant-scores`); does **not** emit `thompson_posterior` impulses. This is the structural blocker that prevents the system from reasoning about its own decision state via the impulse mechanism — see "Known Gaps".

Both of the above are *internal* implicit vessels — bundles of resolvers that live inside an executor. `SUBSTRATE_AS_DEC.md` §0.2 generalises the term to a third, **boundary** sense: an implicit vessel is any subcomplex whose cells and flows are *observed* but whose restriction maps are **latent — inferred from boundary behavior, not declared**. By that reading the **operator is itself an implicit vessel** — the canonical one, the producer of `goalIntent` — and so is a peer substrate known only through behavioral-continuation replay. The human is not outside the system giving it commands; the human is a **node in the topology** whose interior the substrate reconstructs from what crosses the boundary, and whose per-signature trust it learns exactly as it learns any resolver's. The mechanism by which the substrate assesses these boundary entities is `SUBSTRATE_AS_REPRESENTATION.md` §6.1.

**Impulse-layer lifecycle events (environment-driven).** Beyond the task-layer and execution-layer events above, the system recognises a third layer of lifecycle events: changes to the impulse pool itself. These are emitted by `ImpulseStore` on pool mutations and are the substrate's interface to external environment changes — the mechanism through which the outside world drives the substrate without a *standing* human in the loop. (When the driver *is* a human, that human is not outside the system either: it enters as the operator-as-vessel boundary entity described above, modeled per `SUBSTRATE_AS_REPRESENTATION.md` §6.1.)

| Event | When fired | Key payload fields |
|---|---|---|
| `lifecycle:impulse:created` | A new impulse enters the pool | `impulseId`, `shape`, `pointer.type` |
| `lifecycle:impulse:loaded` | A pointer is resolved; content is now available | `impulseId`, `shape`, `resolver_id`, `latency_ms` |
| `lifecycle:impulse:consumed` | An impulse was used as input to a task and an output impulse was produced | `impulseId`, `taskId`, `outputImpulseIds` |
| `lifecycle:impulse:stale` | An external change (file system, peer API, time) has made content potentially out of date | `impulseId`, `reason`, `detector_vessel_id`, `detected_at` |
| `lifecycle:impulse:invalidated` | The pointer target no longer exists | `impulseId`, `pointer`, `reason` |
| `lifecycle:impulse:expired` | The impulse exceeded its budget or TTL | `impulseId`, `budget_type`, `consumed`, `allowed` |
| `lifecycle:impulse:unloaded` | An impulse was evicted from active memory | `impulseId`, `eviction_reason` |

Activities and meta-activities subscribe to these events exactly as they do to `lifecycle:task:*` events. The `stale` event in particular is how time-sensitive or externally-mutated data surfaces without requiring the substrate to poll — a connected vessel detects the change and emits the event, and the execution pool reacts.

Implicit vessels are not a sin; they are evidence about the minimum set. Each one represents a place where the system currently uses a privileged side channel rather than the impulse-resolver-vessel mechanism. Naming them functionally and tracking their limitations is how we test whether the four-primitive minimum is sufficient.

### Vessels Contribute Learning Parameters Arbitrarily

The model is open. Different vessels own different parts of the learned topology, and they update those parts independently. There is no central learning service that owns all parameters; learning is **decentralized across vessels**.

| Vessel | Learning parameters owned |
|---|---|
| activity-api | Trace patterns, template Thompson posteriors, composition-edge α/β, impulse-relevance scores |
| concept-db | Concept usage counts, conceptGraph relationships, conceptSequence patterns (text-formatted data, labeled knowledge graph leveraging impulse learning) |
| Thompson Sampling implicit vessel | α/β/sample_count posteriors (currently REST-only — should resolve `thompson_posterior` shape) |
| (future) any new vessel | Any parameters its resolvers learn from observed traces |

Vessels can advertise new shape-typed parameters as they learn them. The system's openness means a new vessel can join the network and contribute learning signal without coordination — provided it advertises its shapes through discovery and emits its updates as impulses.

---

## Vessel Discovery

Vessels are NOT discovered through a registry. They are **introspected** at the point of use.

### The Codebase as Vessel

When an execution host operates in a codebase, that codebase IS a vessel with its own resolvers:

| Source | Discovered Resolvers |
|--------|---------------------|
| `package.json` scripts | `npm:test`, `npm:build`, `npm:lint` |
| `Makefile` targets | `make:deploy`, `make:clean` |
| CI configuration | `ci:validate`, `ci:release` |
| Git repository | `git:status`, `git:stash`, `git:commit` |

### Discovery Pattern

```typescript
// Introspect package.json for npm scripts
const pkg = await fs.readJSON('package.json')
for (const [name, command] of Object.entries(pkg.scripts || {})) {
  vessel.registerResolver(`npm:${name}`, {
    type: 'command',
    command: `npm run ${name}`,
    canProduce: inferOutputs(name)  // test → test_results, build → artifacts
  })
}
```

### Vessels Collaborate, Not Nest

Vessels don't "contain" other vessels - they **collaborate**:

```
Execution host (vessel)  ←→  Codebase (vessel)
   │                      │
   ├─ llm resolver        ├─ npm:test resolver
   ├─ git resolver        ├─ npm:build resolver
   ├─ file resolver       ├─ make:deploy resolver
   └─ mcp resolver        └─ [project-specific]
```

Activities compose resolvers from BOTH vessels. The codebase provides local tools; the host provides LLM reasoning and backend access.

### External Resolver Vesselization

Stable external call targets — HTTP APIs, databases, shell commands, MCP servers — are first-class vesselization candidates. When N successful invocations of an external endpoint accumulate consistent input/output shape patterns in the trace store, those traces constitute an implicit contract for that endpoint. The substrate can read that contract out of the trace store and register the endpoint as a provisional vessel with its own `vessel_id`, `input_shapes`, and `output_shapes`, joining the discovery registry without manual configuration.

This is the external counterpart to ribosome. The ribosome extracts activity templates from successful activity executions; endpoint vesselization extracts vessel shape contracts from successful external calls. Both are "learning → informational" direction flows that grow the reachable subgraph without operator intervention. Once vesselized, the endpoint's Thompson posteriors accrue normally — the substrate learns which inputs produce reliable outputs just as it does for any other vessel.

### Performance Tracking

Local resolvers are measured like any other:

```typescript
// After npm:test execution
await backend.recordResolverMetrics('npm:test', {
  latency_ms: 3421,
  success: true,
  context: { files_modified: ['src/auth.ts'] }
})

// Backend learns: npm:test succeeds 87% in this repo
```

---

## The Execution Flow

### 1. Intent Arrives (as impulses)

```
Input impulses:
  { type: "goal", shape: "user_request", summary: "Fix the auth bug" }
  { type: "file", shape: "error_log", summary: "12 stack frames, null pointer" }
  { type: "file", shape: "source_code", summary: "245 lines, auth.ts" }
```

### 2. Search for Matching Activity

Query the activity registry: "Which activities accept (goal + error_log + source_code)?"

Results are Thompson-ranked by learned success rate:

```
1. debug-null-pointer     α=45, β=3  → 93% historical success
2. analyze-stack-trace    α=12, β=2  → 85% historical success
3. generic-debug          α=8,  β=5  → 61% historical success
4. [improvise]            fallback if nothing matches
```

### 3. Execute Activity

The selected activity defines steps. Each step uses a resolver:

```
Task 1: Analyze error
  resolver: llm (reasoning about ambiguous input)
  input:    error_log.metadata + source_code.metadata
  output:   { shape: "analysis", likely_cause: "...", confidence: 0.85 }

Task 2: Locate bug
  resolver: code_search (deterministic)
  input:    analysis + source_code
  output:   { shape: "location", file: "auth.ts", line: 42 }

Task 3: Generate fix
  resolver: llm (needs to produce text)
  input:    location + analysis
  output:   { shape: "patch", diff: "..." }

Task 4: Apply fix
  resolver: file_write (deterministic)
  input:    patch + source_code
  output:   { shape: "file", path: "auth.ts", modified: true }

Task 5: Validate
  resolver: test_runner (deterministic)
  input:    modified_file
  output:   { shape: "test_result", passed: true }
```

### 4. Record Trace

```typescript
{
  trace_id: "exec-abc123",
  activity_id: "debug-null-pointer",

  // What went IN
  input_impulses: [
    { id: "imp-1", type: "goal", shape: "user_request" },
    { id: "imp-2", type: "file", shape: "error_log" },
    { id: "imp-3", type: "file", shape: "source_code" }
  ],

  // What HAPPENED
  tasks: [
    { id: "t1", resolver: "llm", input_refs: [...], output_ref: "..." },
    { id: "t2", resolver: "code_search", input_refs: [...], output_ref: "..." },
    { id: "t3", resolver: "llm", input_refs: [...], output_ref: "..." },
    { id: "t4", resolver: "file_write", input_refs: [...], output_ref: "..." },
    { id: "t5", resolver: "test_runner", input_refs: [...], output_ref: "..." }
  ],

  // What came OUT
  output_impulses: [
    { id: "imp-4", type: "file", shape: "source_code", modified: true },
    { id: "imp-5", type: "result", shape: "test_result", passed: true }
  ],

  // State transition
  state_transition: {
    before: { "auth.ts": "hash-abc" },
    after: { "auth.ts": "hash-def" }
  },

  // Outcome
  outcome: {
    success: true,
    duration_ms: 45000,
    cost_usd: 0.12
  },

  // Composition (for nested/meta-activities)
  parent_execution_id: "exec-parent-123",           // Direct parent in composition tree
  composition_chain: ["exec-root-42", "exec-parent-123", "exec-abc123"]
  // Denormalized ancestor chain, ordered root-first. Populated by the
  // activity-api write path (v1.5.5+, April 2026) so queries can filter
  // by root goal or any intermediate ancestor without recursive joins.
}
```

**Composition fields** (added April 2026, activity-api v1.5.5):
- `parent_execution_id` — the direct caller. Set when one activity invokes another (e.g. orchestrator → worker).
- `composition_chain` — root-first list of all ancestors including self. Written atomically alongside the execution row; lets the learning loop answer "which root goals triggered resolver X" cheaply.

Both fields are optional for backward compatibility. Existing traces without them remain valid; queries must handle null values.

**Trace integrity — hash chain.** The trace store maintains a per-vessel hash chain: each execution trace record carries a `prev_hash` field containing the SHA-256 of the canonical JSON of the previous trace from the same vessel. This makes the store append-only-verifiable — silently modifying a past trace breaks the chain for every subsequent trace from that vessel, and the break is detectable without access to the original data. This is a foundation property for the learning loop. The claim "state is a projection over traces" requires traces to be immutable; the hash chain enforces that requirement at the storage layer rather than relying on application-level discipline.

### 5. Learn

- **Success**: Increment α for this activity variant
- **Failure**: Increment β, record failure pattern
- **Improvisation succeeded**: Extract as new activity template
- **Improvisation failed**: Record what not to try for similar inputs

---

## The Learning Loop

### Two-Direction Learning Duality

Learning updates the same composition graph from two directions. The two arms must stay symmetric — drift between them breaks the recall/learning cycle.

**Forward arm — `P(success | activity X resolves pointer of shape Y)`**

When activity X executes successfully with an impulse of shape Y in its input pool, the forward arm credits the (activity, shape) edge. Implementation: `impulseRelevance` writes from the execution host to activity-api after execution. Used by impulse-pool selection (which impulses are worth loading for activity X).

**Reverse arm — `P(success | activity X chosen given pool has shapes {A, B, C})`**

When the binding layer selects activity X given a pool with shape signature {A, B, C} and X succeeds, the reverse arm credits the (shape-signature, activity) edge. Implementation: slot-binding writes and Thompson recommendation writes update composition-edge posteriors. Used by activity recommendation (which activity is worth running given the pool we have).

**Symmetry invariant:** The two arms update the same edge from opposite directions. After N executions, the forward and reverse counts on each edge should be consistent. If they drift — e.g., forward arm records 100 successes but reverse arm records 80 — the recall side will sample inconsistently and the learning loop degrades.

**The forward arm writes correctly.** Previously, the learning-signal writer failed on every validator-dispatch iteration because `lifecycle:task:completed` omitted `templateId` and the resolver's structural check rejected empty strings. Both emit sites in `activity.ts` now populate `templateId`, and the resolver no-ops gracefully on missing payload. After the canary deploy that includes this fix, the two arms converge; pre-deploy traces remain skewed and should be filtered out of any retroactive analysis.

### Reduce Search Space

Over time, traces reveal patterns:

```
Pattern: When input has (error_log with "null") + (source_code):
  → debug-null-pointer succeeds 94%
  → generic-debug succeeds only 45%

Pattern: For debug-null-pointer:
  → impulse "previous_fix_attempts" helps (relevance: 0.87)
  → impulse "deployment_logs" rarely helps (relevance: 0.12)
```

The search space shrinks:
- **All activities** → Activities matching input shapes
- **All impulses** → Impulses with high relevance for this activity

### Suggest Next Steps

Traces reveal composition patterns:

```
Pattern: After debug-null-pointer succeeds:
  → 78% of the time, write-tests comes next
  → 15% of the time, commit-changes comes next
  → 7% of the time, deploy comes next
```

The system can proactively suggest: "Bug fixed. Write tests for this fix?"

### Impulse Relevance Learning

For each (activity, impulse) pair, track:

```typescript
{
  activity_variant_id: "debug-null-pointer:v3",
  impulse_shape: "previous_fix_attempts",

  times_loaded: 45,
  times_success_when_loaded: 42,
  times_failure_when_loaded: 3,
  times_success_when_not_loaded: 12,
  times_failure_when_not_loaded: 8,

  relevance_score: 0.87,  // P(success | loaded)
  irrelevance_score: 0.60 // P(success | not loaded)
}
```

When relevance_score >> irrelevance_score, always load this impulse.
When irrelevance_score >= relevance_score, skip it (saves tokens/cost).

---

## Improvisation: Wing It With Recording

When no activity matches with sufficient confidence, the system can improvise. Improvisation MUST be recorded.

> **Note**: Older documents used the terms **"Improvisation Outcome"** and **"Trailblazing"** for what is now handled by the failure-mode taxonomy plus posterior variance. Those terms have no current code path and should be replaced where encountered. See "Known Gaps → Class-(c) Terms Pruned".

### When to Improvise

```
Input impulses: { shape: "never_seen_before", ... }
Matched activities: none with confidence > 0.3

Options:
  1. REFUSE: "I don't have an activity for this"
     → Safe but no learning

  2. IMPROVISE: Use available capabilities with LLM guidance
     → Risky but enables learning
```

### Recording Improvisation

```typescript
{
  trace_type: "improvisation",

  // WHAT: The actual steps taken
  steps: [
    { tool: "read_file", params: {...}, result: {...} },
    { tool: "llm_generate", params: {...}, result: {...} },
    { tool: "write_file", params: {...}, result: {...} }
  ],

  // WHY: The reasoning at each decision point
  reasoning: [
    "No activity matched, exploring based on input shape",
    "File appears to be config, trying to understand structure",
    "Found pattern, generating fix based on similar patterns"
  ],

  // OUTCOME: Did it work?
  outcome: {
    success: true,
    validation: "tests pass"
  },

  // LEARNING: What to do with this?
  learning: {
    if_successful: "extract as activity template",
    if_failed: "record failure pattern to avoid"
  }
}
```

### The Ribosome: Extracting Activities from Traces

When improvisation succeeds, the **ribosome** extracts a reusable activity:

1. Analyze the successful trace
2. Identify the input impulse shapes that triggered it
3. Extract the step sequence as activity tasks
4. Create a new activity template with α=1, β=0
5. Register it for future matching

Next time similar inputs arrive, this activity is available.

---

## Self-Instrumentation: Activities As Tests

When adding new resolvers or capabilities, **create validation activities that instrument them**. We don't write separate tests - activities ARE tests.

### The Pattern

```typescript
// 1. Add new resolver
vessel.registerResolver('npm:test', new NpmTestResolver())

// 2. Create validation activity
const validationActivity = {
  id: 'validate-resolver:npm:test',
  intent: 'Verify npm:test resolver works as expected',

  tasks: [
    {
      id: 'test-success-case',
      resolver: 'npm:test',
      inputImpulses: [{ fixture: 'passing-tests' }],
      validation: {
        expectation: { exitCode: 0, passed: true },
        aligns_with_intent: (actual) => actual.exitCode === 0
      }
    },
    {
      id: 'test-failure-case',
      resolver: 'npm:test',
      inputImpulses: [{ fixture: 'failing-tests' }],
      validation: {
        expectation: { exitCode: 1, passed: false },
        aligns_with_intent: (actual) => actual.exitCode === 1
      }
    }
  ]
}

// 3. Execute and measure
const trace = await vessel.execute(validationActivity)
const allPassed = trace.tasks.every(t => t.validation.aligns_with_intent)

// 4. Update resolver confidence
vessel.updateResolverConfidence('npm:test', allPassed ? 1.0 : 0.0)
```

### Key Insight

| Traditional | Self-Instrumenting |
|-------------|-------------------|
| Write code → Write tests → Hope coverage is enough | Add resolver → Create validation activity → Execute → Measure |
| Tests are separate from system | Activities ARE tests |
| Test results in CI logs | Traces ARE test results |
| Manual test maintenance | System validates itself by using itself |

### Hidden State Discovery

Self-instrumentation also discovers **side effects** - the "yet-unseen portions" of state:

```typescript
// Capture state before/after execution
const before = await captureFileHashes(workingDir)
await resolver.resolve(inputs)
const after = await captureFileHashes(workingDir)

// Discover hidden changes
const learned = {
  'npm:test creates coverage/': { always: true },
  'npm:test modifies .cache/': { always: true },
  'npm:test never modifies src/': { always: true }
}
```

This enables better rollback, conflict detection, and prediction of resolver behavior.

---

## LLMs Are One Component Among Many

LLMs are not special. They're a resolver type, used when the task requires reasoning about ambiguous input or generating novel text.

| Resolver | When to Use |
|----------|-------------|
| llm | Reasoning about ambiguous input, generating text |
| sql | Fetching structured data from database |
| file | Reading/writing filesystem |
| transform | Deterministic data transformation |
| render | Producing UI components |
| test_runner | Executing test suites |
| git | Version control operations |
| http | External API calls |
| sensor | Reading hardware sensors |
| motor | Controlling actuators |

The activity decides which resolver to use for each step. The trace records which was used so we can learn.

**Key insight**: If a step can be done deterministically without LLM reasoning, it should be. LLMs are expensive and non-deterministic. Use them only where their capabilities are needed.

---

## Transformers Are Frozen Substrates

A transformer is the substrate's primitives frozen at training time. The composition graph is baked into the weight matrices; the activities are implicit in the attention patterns and MLP circuits; the variants are superpositions in the residual stream. From the substrate's standpoint, a pretrained transformer is a substrate-shaped object whose graph topology was learned once, off-line, and is now read-only — discoverable only by post-hoc reverse-engineering.

**Mechanistic interpretability is the discipline of recovering activities from frozen substrates.** Circuits like induction heads (Olsson et al., arXiv 2209.11895), the IOI algorithm in GPT-2-small (Wang et al., arXiv 2211.00593), and the Fourier-multiplication circuit Nanda et al. recovered from grokking dynamics (arXiv 2301.05217) are activities authored by gradient descent and compiled into weights. Anthropic's 2025 Circuit Tracing work (transformer-circuits.pub/2025/attribution-graphs/methods.html) makes the framing explicit: trained models are computational graphs to be reverse-engineered.

The live substrate this codebase implements is the converse: same primitives (impulse / pointer / resolver / vessel), but the graph is grown online, the activities are first-class and addressable, and the topology is queryable at runtime rather than recoverable only by probing weights. The same math underlies both — Bayesian Q-learning over a factored MDP, with Beta-Bernoulli updates that are natural gradients in Beta information geometry. Only the time-of-fixing differs. Where transformers must reverse-engineer their activities at inference, the substrate inspects its composition graph directly.

This is also why fixed-distribution embedding models (currently `all-MiniLM-L6-v2`) only **bootstrap** the substrate's geometry: they sit entirely in the frozen-substrate regime, riding a graph whose topology was fixed by someone else's training corpus. As the substrate's own composition graph diverges from that corpus, the borrowed embedding becomes structurally wrong (not just imprecise). The fix is the substrate's own embedding flowing with grounded observation — itself a substrate-authored activity rather than a borrowed one-shot.

---

## The Backend's Role

The backend is NOT a universal resolver. It is:

### A Trace Store
- Receives execution traces from vessels
- Stores: input impulses, steps, output impulses, state transitions
- Enables replay and reflection

### A Pattern Learner
- Analyzes traces to find patterns
- Computes Thompson Sampling scores
- Calculates impulse relevance metrics
- Identifies composition patterns

### A Historical Data Source
- When a vessel resolves a "trace" type impulse, it queries the backend
- This is the same as any other resolver querying its data source
- The backend serves its stored data (traces, metrics, patterns)

```
Minimal Backend API:

POST /v2/traces
  Store execution trace from vessel

POST /v2/traces/query
  Resolve trace-type impulse pointers:
    { type: "executionTrace", traceId: "..." }
    { type: "recentExecutions", activityId: "...", limit: N }
    { type: "failurePatterns", activityId: "..." }
    { type: "compositionPatterns", goalCategory: "..." }
    { type: "systemHealth", window: "1h" }

POST /v2/activities/recommend
  Thompson-sampled activity recommendation for goal + context
```

Everything else is either:
- A query type passed to `/v2/traces/query`
- Derived from stored traces
- Not a separate endpoint

---

## The Composition Graph and Informational State

### The Informational State

The system operates against an unbounded backdrop, but the backdrop is not a constructible set. The **informational state** is a *limit-statement*: the assertion that **no single latent space suffices to contain all true relationships among impulses**. This is the manifold hypothesis posture made explicit about its own incompleteness — Gödel-shaped, not Russell-shaped. The system never represents the informational state as an object; it represents the *fact that any chosen representation is provably partial*. File contents that have never been read, results of computations not yet run, causal links that would only become legible in a richer representation — all of these sit beyond any specific latent space the substrate constructs, and the substrate's job is to keep discovering accessible local patches rather than to converge on a global embedding.

The system has access to two bounded subsets:

**Reachable subgraph** — the shapes producible by resolvers across vessels currently connected to the network. A shape is reachable if some connected vessel advertises a resolver contract for producing it. The reachable subgraph may span millions of vessels and trillions of resolvers; vessel registration with discovery-vessel makes resolver contracts visible without requiring any single vessel to enumerate all possibilities.

**Learned topology** — the sampled portion of the reachable subgraph. Every execution trace is a data point. Composition edges between activities carry α/β posteriors derived from trace outcomes. Thompson Sampling models the probability that a given path leads to a goal-satisfying state. The learned topology grows with each execution.

```
  INFORMATIONAL STATE (no single latent space suffices)
  ════════════════════════════════════════════════════

    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  ░░░░░░  ┌──────────────────────────────┐  ░░░░░░
  ░░░░░░  │  REACHABLE SUBGRAPH          │  ░░░░░░
  ░░░░░░  │  (connected vessel resolvers)│  ░░░░░░
  ░░░░░░  │   ┌──────────────────────┐   │  ░░░░░░
  ░░░░░░  │   │  LEARNED TOPOLOGY    │   │  ░░░░░░
  ░░░░░░  │   │  (traces, Thompson   │   │  ░░░░░░
  ░░░░░░  │   │   posteriors)        │   │  ░░░░░░
  ░░░░░░  │   └──────────────────────┘   │  ░░░░░░
  ░░░░░░  └──────────────────────────────┘  ░░░░░░
    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

### The Composition Graph

The composition graph is the graph of all activity templates connected by their input and output shapes — every activity that produces shape X is connected by an edge to every activity that consumes shape X. This graph is not a designed structure. It is **discovered** through execution. Every successful trace confirms an edge exists. Every failure provides evidence about edge quality.

A **trajectory** is one path through this graph: a specific sequence of activities whose output shapes feed subsequent activities' input shapes. A trajectory is structurally identical to an activity — same tasks, same shapes, same resolver contracts. The distinction is a matter of granularity: a single-activity execution traverses one node; a multi-activity trajectory traverses a path of nodes.

Thompson Sampling does not optimize over a known space. It builds a probability model over a topology that may never be fully mapped. The system's goal is not to find the optimal path through a known graph; it is to discover the topology well enough to reliably reach goal-satisfying states.

### Reachability vs. Learnedness

Two distinct states affect what the system can do:

| Concept | Meaning | When it changes |
|---|---|---|
| **Reachable** | A resolver for this shape exists in currently connected vessels | Vessel connects or disconnects |
| **Learned** | The system has traces showing this shape being produced (and with what success rate) | After executions; never decreases |
| **Unreachable but known** | Traces confirm the shape CAN be produced, but no vessel currently provides it | Vessel goes offline |
| **Unknown** | No traces; shape may or may not be producible | Before first successful execution |

The `unbindable` state in binding slots can represent either **unreachable** (the vessel that produces this shape is not connected) or **unknown** (no evidence this shape can be produced at all). These require different responses: wait for vessel connection vs. escalate via `create-shape-provider-goal` to explore new topology.

### Reachability Across Substrates

A single substrate's reachable subgraph is bounded by the vessels its
own discovery-vessel knows about. The post-lift agenda extends this
boundary: peer substrates make additional vessels reachable, and
foreign-provenance impulses flow into the local concept graph under
explicit signature-gated trust weighting. The structural mechanism is
fleet federation — see `openspec/changes/2026-05-23-vessel-federation`
for the peer-aware discovery primitive and
`openspec/changes/2026-05-31-substrate-fleet-federation` for the
information-flow, image-artifact, self-install, and adversarial-audit
layers built on top.

The invariant that survives: no vessel above the discovery layer
learns about substrates as routing targets. Substrate identity
surfaces only as a discovery-vessel pubkey (per H2) and as a
`foreign_provenance` annotation on cross-substrate impulses. From
inside any reasoning vessel, the system is still "vessels and
shapes" — the reachable subgraph is just larger.

The (a)/(b)/(c) inter-substrate adversary-model progression
(operator-trusted peers → semi-trusted federation → open federation)
is the structural mechanism by which the post-lift agenda items
named in `openspec/changes/2026-04-26-impulse-activity-loop/tasks.md`
§27.S.5 — security, authenticity, cooperation, federation,
self-recovery — get realized. Open federation (c) is the
inter-substrate operationalization of S3: the substrate may admit
untrusted peers only once the §27.S.6 push-away rubric measures
sustained refusal of hostile-peer probes with sound cited rationale.

### Adaptive Immune System: Observe, Detect, Resolve

Conventional security postures decompose into four boxes — IDS
(intrusion detection), IPS (prevention), SIEM (event aggregation),
SOAR (automated response). Humans sit at the SIEM and read; humans
configure the SOAR. The substrate collapses the four boxes into one
mechanism: **detection and resolution are activities**. They consume
ingestion impulses, emit findings and resolution impulses,
accumulate Thompson posteriors, and are extracted into reusable
templates by the ribosome. Static rules become learned activity
chains. The operator is a downstream affordance, not the design
center.

Four shape families implement the loop:

| Family | Examples | Role |
|---|---|---|
| Ingestion impulses | `auditEvent`, `httpRequest`, `connectionEvent`, `tlsHandshakeEvent`, `peerInteraction`, `dependencyAdded`, `llmResponse` (with `taint` metadata), `operatorAction`, `hostSyscallAnomaly` | Surface-specific events translated into common vocabulary by guardian-vessels. |
| Findings | `securityFinding`, `anomalyFinding` | Detector activities emit these when ingestion patterns cross thresholds; carry supporting evidence impulse ids. |
| Resolution impulses | `resolutionProposal` (dry-run), `resolutionAction` (state-changing), `resolutionRefused` (push-away applied to self) | The resolver activity's output. Proposal precedes action; refusal is a positive Thompson outcome. |
| Baselines | `fileBaseline`, `behaviorBaseline`, `peerBaseline` | Reference distributions detectors compare current state against. Rebaselining is itself an activity, triggered by legitimate state-change events. |

The guardian-vessel pattern is the general extension mechanism: one
vessel per external surface (HTTP, federation, package registry,
LLM output, operator input, host syscalls), translating surface-
native events into the common ingestion vocabulary. Downstream
detectors do not need to know surface specifics. The pattern is the
same separation-of-concerns principle that makes "vessels and
shapes" work for the rest of the substrate, applied to the security
surface. A `detect-novel-source-ip` detector consumes `httpRequest`
impulses without caring whether they came from the substrate's own
HTTP surface, a Kubernetes ingress, or a federated peer's
forwarding layer.

Authority to emit a `resolutionAction` is gated by four
reversibility tiers (dry-run, reversible, semi-reversible,
irreversible) and earned via Thompson promotion. The substrate's
Phase 1 ships a small allowlist of reversible resolvers (rate-limit
an erroring resolver, quarantine a malformed-responding vessel,
refuse an invalid peer, reject an overbudget resolution) under
operator-issued standing attestations; everything else is
proposal-only until promotion. The §27.S.6 push-away rubric applies
to the substrate's own firings: before any resolution, the
resolver checks whether the detection is suspect (operator-induced
anomaly during deploy, recent rebaseline, adversarial induction,
foreign-evidence-only) and refuses with cited rationale if so.
Refusals feed the §27.S.6 `interventionRefused` ledger with
`source: "observe-detect-resolve"` provenance.

See `openspec/changes/2026-05-31-substrate-fleet-federation/specs/
observe-detect-resolve/spec.md` for the full requirements. The
foundation-level invariant: from inside any reasoning vessel, the
security loop is still "vessels and shapes" — guardian-vessels
ingest, detector activities classify, resolver activities (gated by
the four tiers) act. No separate detection plane, no parallel
control mechanism.

### Topology Discovery Is the Purpose

The impulse-activity loop is not a recipe executor. It is a **topology discovery engine**:

1. **Goal arrives** → identify which shapes would constitute a goal-satisfying state
2. **Search learned topology** → find activities that have reliably produced those shapes. A goal that has been reached before short-circuits this: `recommendReachingPath` looks up the prior reaching path by `goal_hash` (per-goal α/β on `goal_execution_paths`) and replays it rather than re-searching (goal-host `5d0f741`).
3. **Bind impulses** → establish which shapes are reachable from the current pool
4. **Execute** → traverse the candidate path; observe whether it leads where predicted
5. **Validate the reach, not just the status** → `status=completed` is not evidence the goal was reached. An LLM-judge (`verifyGoalReached`, goal-host `07feff5`) inspects the produced impulses against the goal *after* execution and emits the `completion_shapes` that would actually satisfy it. A **hollow completion** — an activity that ran cleanly but produced a wrapper/summary instead of the asked-for output — is judged `reached:false` and **β-penalised** on the selected template. This is the goal-reaching **gate**: reward attaches to reaching the goal, not to exiting without error, so gaming and wrapper-dispatch cannot accrue α-credit.
6. **Recover in-flight** → on `reached:false`, the goal-host `/resolve` loop does not stop: it β-penalises and **excludes** the failed approach, asks for a *different* producer (`recommendExcluding`), and retries until the goal is reached or candidates are exhausted (goal-host `980240b`). Recovery is part of reaching the goal, not offline repair — the **reached** trace is what the ribosome mints into a new activity.
7. **Escalate when needed** → probe unmapped topology via `create-shape-provider-goal`
8. **Learn** → update posteriors on traversed edges and consumed impulses; `recordGoalPath` writes the reaching path (or the β-penalty) to `goal_execution_paths` keyed by `goal_hash`, so the per-goal posterior accumulates across attempts (path = attribution, success = *reached*).
9. **Extract patterns** → ribosome converts successful explorations into reusable templates

Each iteration reduces uncertainty about the composition graph in the vicinity of the goal. Convergence — reliably reaching goal-satisfying states — is evidence that enough topology has been learned, not that the graph is fully known.

> **Schema and mechanism detail:** [`GOAL_EXECUTION_PATHS_SCHEMA.md`](GOAL_EXECUTION_PATHS_SCHEMA.md). The same gate fires whether a goal is dispatched via `mcp__metabob__run_goal` (MCP `/resolve` path) or the human obsidian-vessel surface — both route through goal-host `/run-goal`, both are reach-gated and recorded.

### Reuse Before Mint

When a goal needs an output shape, the substrate prefers an **existing producer** of that shape over minting a fresh activity. Find the producer via `discover-by-shapes` forward mode, then compose/route to it. Minting a duplicate creates a fresh `Beta(1,1)` cell that raises `ρ_grow` (the rate of new uninformed cells) and splits selection traffic across redundant cells; reusing routes flow onto an existing hyperedge, sharpens its posterior, and adds a composition edge that raises `λ₁` (the spectral gap / credit-mixing rate). The substrate's stability inequality is `λ₁(L(t)) ≳ ρ_grow` ([`SUBSTRATE_AS_DYNAMICS.md`](SUBSTRATE_AS_DYNAMICS.md) §3) — reuse pushes both sides the right way and keeps DB queries `O(edges)` rather than `O(cells)`.

Minting is the **justified exception**, not the default: legitimate only when it expands reachable topology with closure (a true gap with no existing producer) or is variant-first repair of a measured weak family. The principle is enforced at the mint chokepoint (development-vessel `activity-create-variant`, `REUSE_BEFORE_MINT`) and at selection (the interposable selector preferring an existing producer over the improvise slot).

---

## Relating to the Three-State Ontology

This model is the operational implementation of the three-state ontology.

> **Canonical naming (2026-06).** This is the **same triad** as "Three States, Two
> Motions" above — not a second ontology. The names below drifted: **Instructional
> → Informational** and **Functional → Observational** (Transient is invariant), as
> the framing matured from "building software" to "running a learning system" and
> the scope of each state widened. The canonical names are **Informational /
> Transient / Observational**; `Instructional` and `Functional` are deprecated
> aliases kept only for reading older docs. The durability bridge (why these are
> the right three) is [`SUBSTRATE_AS_SOFTWARE.md`](SUBSTRATE_AS_SOFTWARE.md) §1–§2;
> the term registry is [`../GLOSSARY.md`](../GLOSSARY.md) §1.

### Instructional State (Vessel) — *canonical: Informational State*

The vessel IS the instructional state: the capacity to execute, the blueprint, the potential.

- Activity templates define what CAN happen
- Impulse pointers reference data that CAN be loaded
- Resolvers provide capabilities that CAN be invoked

### Transient State (Process-of-Becoming) — *canonical: Transient State*

Execution IS the transient state: the active transformation, the becoming.

- Activity executing task by task
- Impulses being resolved
- State transitioning from before to after
- This is where the work happens

### Functional State (Instance) — *canonical: Observational State*

The outcome IS the functional state: the realized result, the actualized artifact.

- Output impulses created
- Files modified
- State transitioned
- Trace recorded

### The Continuous Loop

The instance immediately becomes input to the next transformation:

```
Output impulses from Activity A
        ↓
Input impulses for Activity B
        ↓
Output impulses from Activity B
        ↓
Input impulses for Activity C
        ↓
  ... continuous becoming ...
```

The trace records each transformation. Learning extracts patterns. New activities emerge. The system develops itself.

---

## Known Gaps (System Not Yet Self-Stable)

The following gaps are evidence about the minimum set. Each represents a place where the four-primitive hypothesis is currently insufficient — either because the system uses a privileged side channel, or because a piece of learnable state lacks a shape, or because two arms of the duality have drifted.

### Class-(b) Shape Gap: `thompson_posterior`

The α/β/sample_count posterior data already exists in activity-api: it is computed for `variantMetricsSummary` REST responses and `GET /v2/activities/:id/variant-scores`. The improvised solution is the REST surface; the structural fix is to expose this same data as a shape via the Thompson implicit vessel. We need to collect the data from the activity-api as a `thompson_posterior` shape — what is currently REST-only is a workaround for the structurally missing shape.

**Repair direction (Phase 9 of `2026-04-26-impulse-activity-loop`):** the Thompson implicit vessel advertises `thompson_posterior` and resolves it through the standard `POST /v2/impulses/resolve` path. The existing REST handler becomes a thin wrapper over the new shape resolver. After this, the implicit vessel becomes explicit — it can be discovered, observed, and its posteriors composed into other activities. Likely follow-on shapes: `composition_edge_posterior`, `shape_relevance_posterior`.

### Unified Execution Path

Unified execution path is the chosen direction. Goal-shaped and activity-template-shaped pointers will resolve through the standard impulse → resolver dispatch — the activity resolver runs the activity to resolve the pointer. Today, top-level activity execution is invoked via `executor.execute(template)` from the execution host; this is current-state, not a "privileged path" in target architecture.

When the refactor lands, the goal-processor emits a `goal`-shaped impulse (and downstream an `activity_template`-shaped impulse), and the executor is dispatched as the resolver for the resulting shape pair. This collapses the structural distinction between "top-level" and "nested" activity execution: both flow through the same impulse → resolver dispatch.

The 5 specs that already describe this unified surface (`goal-execution-resolver`, `trajectory-execution-resolver`, `goal-submission-panel`, `trajectory-submission-panel`, `vessel-wsurl-propagation`) describe target state.

**Async dispatch (shipped `ac0d75b5`, 2026-05-27):** `POST /run-goal` on goal-host-vessel (port 8210) now returns `202 Accepted` immediately with `{ executionId, status: "accepted" }` and runs the execution asynchronously. Callers (goal-host-vessel clients, boredom-vessel) must poll `GET /executions/:executionId` or subscribe to the activity-api WebSocket for `task.completed` / `execution:succeeded` events to observe the outcome. The synchronous response that previously blocked until completion is retired; any code that assumes a blocking `/run-goal` call must be updated to the poll/subscribe pattern.

### Forward-Arm Breakage: F-39 (resolved)

The forward arm writes correctly. The learning-signal writer previously failed on every validator-dispatch iteration because `lifecycle:task:completed` omitted `templateId` and the resolver's structural check rejected empty strings via truthiness. Both lifecycle emit sites in the execution host now populate `templateId: template.id`, and the resolver no-ops gracefully (emitting `metadata.skipped_reason: "missing_template_id"`) instead of throwing on malformed payloads. The two arms converge after the canary deploy that includes this fix; pre-deploy traces remain skewed and should be excluded from retroactive Thompson-posterior analysis.

### Class-(c) Terms Pruned

The following terms appear in older documents and should be removed when encountered. They have no code path:

- **"Improvisation Outcome"** — superseded by variance + failure-mode tracking.
- **"Trailblazing"** — never implemented; remains only in archived docs.

The active replacement is the failure-mode taxonomy (`verifier_negative`, `budget_exhausted`, `safety_breach`, `cascading`, `user_abort`) plus posterior variance, which together capture what these older terms gestured at. The full deprecated-term list (these plus the drifted state names and "The Two Primitives") is [`../GLOSSARY.md`](../GLOSSARY.md) §7.

---

## Design Principles

### 1. Impulses Are Universal Data

Everything is an impulse: text, structured data, signals, commands. The shape describes what it is. The resolver knows how to access it.

### 2. Activities Constrain Search

Without activities, infinite options. With activities, ranked finite options. Learning improves the ranking.

### 3. Resolvers Live Where Data Lives

Don't centralize resolution. The vessel with database credentials resolves SQL. The vessel with filesystem access resolves files. The backend resolves traces.

### 4. Metadata First, Content Later

Reasoners see metadata to decide. Resolvers load content to execute. This minimizes data movement and token usage.

### 5. Record Everything

Every execution is traced. What went in, what happened, what came out. This is the raw material for learning.

### 6. Learn From Traces

Thompson Sampling for activity selection. Relevance scores for impulse filtering. Composition patterns for next-step suggestion. Ribosome for activity extraction.

### 7. Reserve Improvisation

When nothing matches, try something new. But record it. Learn from it. Extract successful patterns. Avoid failed patterns.

### 8. LLMs Are Tools, Not Controllers

LLMs are one resolver type. Use them for reasoning and generation. Use deterministic resolvers for everything else.

---

## Implementation Alignment Checklist

When implementing any feature, verify alignment with this foundation:

- [ ] Does it treat data as impulses with metadata?
- [ ] Is the **pointer the shape** of every learnable artifact (not a side-channel REST field)?
- [ ] Does it use activities to constrain the search space?
- [ ] Do resolvers live where the data is?
- [ ] Does it record traces for learning?
- [ ] Does it avoid unnecessary LLM usage?
- [ ] Does it allow improvisation with recording?
- [ ] Does it preserve the **two-direction learning duality** (forward arm and reverse arm both update on outcomes)?
- [ ] Is the backend limited to trace storage and pattern learning?
- [ ] Can this pattern be extracted and reused?
- [ ] Does it route through the standard impulse → resolver dispatch? (Top-level activity execution is on a refactor track — see "Unified Execution Path" — but new features should not introduce new in-process bypasses.)

---

## References

This document supersedes and synthesizes:
- `ONTOLOGY_OF_BECOMING.md` (three-state model)
- `VESSEL_ARCHITECTURE_CORRECTED.md` (vessel design)
- `UNIFIED_IMPULSE_DRIVEN_ARCHITECTURE.md` (impulse system)
- `RIBOSOME_ARCHITECTURE.md` (activity extraction)

All other architecture documents should derive from and align with this foundation.
