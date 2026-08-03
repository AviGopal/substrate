# Glossary — canonical terms for the substrate

> The single term registry for this repo. Where a term drifted across docs, the
> **canonical** spelling is fixed here and prior spellings are listed as
> *deprecated aliases*. This file does not re-derive concepts — it points at the
> source-of-truth doc that owns each one.
>
> **Source-of-truth map.** Ontology (impulse/activity/vessel/resolver, the
> primitives) → [`architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](architecture/IMPULSE_ACTIVITY_FOUNDATION.md).
> The three states, durability groups, and what is implementation detail →
> [`architecture/SUBSTRATE_AS_SOFTWARE.md`](architecture/SUBSTRATE_AS_SOFTWARE.md).
> The three math lenses and their shared dictionary →
> [`architecture/SUBSTRATE_AS_MDP.md`](architecture/SUBSTRATE_AS_MDP.md),
> [`SUBSTRATE_AS_DEC.md`](architecture/SUBSTRATE_AS_DEC.md),
> [`SUBSTRATE_AS_DYNAMICS.md`](architecture/SUBSTRATE_AS_DYNAMICS.md) (dictionary in
> DYNAMICS §0). Idioms (named compositions) → [`CORE_IDIOMS.md`](CORE_IDIOMS.md).
> Shapes vocabulary → [`shapes/README.md`](shapes/README.md). Operational behavior
> → `CLAUDE.md`.

## 1. The three states (canonical)

One triad, canonical names **Informational / Transient / Observational**. Full
treatment + the durability bridge: `SUBSTRATE_AS_SOFTWARE.md` §1.

| Canonical | Definition | Deprecated aliases |
|---|---|---|
| **Informational state** | the durable structure — vessel/resolver **code** *and* learned content (shapes, posteriors, topology, goal-paths) | *Instructional state*, "the structure (i)" |
| **Transient state** | the execution in flight — an impulse being resolved, a binding being chosen | *Process-of-Becoming*, "the becoming (t)" |
| **Observational state** | the recorded outcome — traces, validation results, realized artifacts | *Functional state*, "Instance", "the recorded outcome (o)" |

- **Recall motion** = `Informational → Transient → Observational` (apply structure).
- **Learning motion** = `Observational → Transient → Informational` (mint structure).

## 2. Durability groups (the software bridge)

Canonical home: `SUBSTRATE_AS_SOFTWARE.md` §2. The Informational state splits in
two by change-authority.

| Group | State | Changes via | Holds |
|---|---|---|---|
| **Authored-durable** | Informational | deploy / commit | vessel code, resolver implementations, template definitions, shape contracts (= the four primitives) |
| **Learned-durable** | Informational | the loop, every trace | Thompson posteriors, shape lattice, composition-edge weights, goal-paths, impulse-relevance (= the system's load-bearing state) |
| **Ephemeral** | Transient | per-execution | in-flight impulses, bindings, executing trajectory |
| **Recorded** | Observational | append on execution | traces, validation results, failure modes, artifacts |

## 3. The four primitives (authored-durable scaffold)

Canonical: these four are the **authored-software layer**, not the learning itself
(`SUBSTRATE_AS_SOFTWARE.md` §3). Foundation: IMPULSE_ACTIVITY_FOUNDATION §"Minimum
Self-Stable Set".

| Term | Definition | Notes / aliases |
|---|---|---|
| **impulse** | a pointer + metadata + (lazily resolved) body — data in any form | the data envelope; *content* is ephemeral, *relevance* is learned |
| **pointer** | the shape of an impulse; the bootstrap key all resolution and learning are keyed on | "pointer-as-shape" (the principle); `pointer.type` dispatches resolution |
| **resolver** | a function from pointer → content; lives where the data is | tiers are a binning of its *directional certainty* (§5); implicit resolvers live inside executors |
| **vessel** | a collection of activities and resolvers | **two senses** — *structural* (code) vs *operational* (running service instance); see SUBSTRATE_AS_SOFTWARE §3.1 |

> Deprecated framing: "**The Two Primitives**" (impulse + activity). The canonical
> minimum set is these **four**; activity is *derived* (§4).

## 4. Derived constructs

| Term | Definition | Source / aliases |
|---|---|---|
| **activity** | a constrained state transition linking input-impulse sets to output-impulse sets; concretely "an impulse of shape `activity_template`" | FOUNDATION; *derived, not a primitive* |
| **shape** | the pointer's `type` + metadata, viewed as a **learned type**; observed/refined/pruned from traces, not declared in a global registry | FOUNDATION; "pointer-as-shape", `ImpulseShape` |
| **trace** / **execution trace** | the recorded set of impulses (in / intermediate / out) + state transition + outcome for one execution | canonical DB table: **`activity_execution_traces`** (plural); impulse shape: **`activityExecutionTrace`**; deprecated table aliases: `execution`, `activity_execution_trace` (singular) |
| **trajectory** | one path through the composition graph; structurally identical to an activity, differing only in granularity | FOUNDATION |
| **composition graph** | the graph of templates connected by input/output shapes; discovered through execution, not designed | edges carry α/β posteriors |
| **lifecycle event / hook** | an impulse of shape `lifecycle:*` broadcast to subscribed meta-activities | layers: `lifecycle:task:*`, `lifecycle:execution:*`, `lifecycle:impulse:*` |
| **state signature** | the canonical state key for contextual selection: `state_signature` (available-shape multiset, canonicalized) | `state_signature`; its sorted-dedup shape-array core is the **shape signature** (`ShapeSignature`); "state-space signature" (idiom 9) is a deprecated alias |
| **budget** | resource ceiling for loading an impulse (tokens / bytes / rows / time) | "resource budget" |

## 5. Learning-loop terms

| Term | Definition | Source / aliases |
|---|---|---|
| **Thompson Sampling** | per-candidate `Beta(α,β)` sample-and-argmax selection; scores computed from traces, not stored on the activity | canonical casing: **Thompson Sampling**; α = successes+1, β = failures+1 |
| **`thompson_alpha` / `thompson_beta`** | success / failure counts of the Beta posterior per `(signature, template)` | α / β |
| **forward arm** | `P(success \| activity resolves a pointer of shape Y)` — updated per task-completion | "two-direction learning duality"; also the empirical estimate of resolver directional certainty (§ below) |
| **reverse arm** | `P(success \| activity chosen given pool shapes {A,B,C})` — updated per recommendation | symmetry invariant: forward and reverse counts must converge |
| **composition-chain credit propagation** | γ-discounted α/β deltas written to ancestors along `composition_chain` on success/failure | `propagateCreditAlongChain` (impl in activity-api); MDP §3 = n-step TD backup |
| **ribosome** | a resolver: trace-shaped → template-shaped; extracts a reusable activity from a successful trace | `assembleTemplateFromExecution`; the canonical learning-motion edge |
| **improvisation** | running something new when no activity matches with confidence; **must be recorded** (`trace_type: "improvisation"`) | replaces the dead term *trailblazing* (§7) |
| **variant / variant family** | competing versions of an activity grouped by `activity_id`, selected via Thompson | `variant_id`; family keyed by original id |
| **failure-mode taxonomy** | stratified failure types: `verifier_negative \| budget_exhausted \| safety_breach \| cascading \| user_abort` | `failure_mode`; canonical `context` schema = `FailureModeSchema` (activity-api) |
| **impulse relevance** | per `(activity, impulse)`: `relevance = P(success \| loaded)` vs `P(success \| not loaded)`; the forward arm's implementation | `impulseRelevance` |
| **directional certainty (resolver)** | continuous, per-`(resolver, signature)` measure that a resolver's output lies along the goal-coplanar tangent of the shape hypersurface; **`resolver_tier` {deterministic, pattern, llm} is a coarse binning of it** | canonical reframe: `SUBSTRATE_AS_SOFTWARE.md` §4; = DEC `⋆₁` precision = MDP transition-determinism; estimated by the forward arm |

## 6. Execution / trace fields & disambiguations

| Term | Canonical meaning | Disambiguation |
|---|---|---|
| **`resolver_tier`** | `{deterministic, pattern, llm}` — coarse bins of directional certainty (§5) | **NOT** the dispatch-pathway set; see next row |
| **dispatch pathway** | which leg of resolution served the impulse: `LOCAL / CUSTOM / DISCOVERY / MCP / FALLBACK / ERROR` | a *routing* fact; previously mis-labeled `resolver_tier` in RESOLVER_TRACKING — they are different fields |
| **meta-trace layer** | `L1 = goal_resolve` (per goal), `L2 = activity_execute` (per activity), `L3 = leaf / per-resolver impulse_resolutions` | **NOT** the same numbering as *instrumentation level* |
| **instrumentation level** | tracing overhead tier: Level 1 request / Level 2 function / Level 3 full | distinct axis from meta-trace layer |
| **`composition_chain`** | denormalized root-first ancestor list on a trace | `parent_execution_id` = direct parent only |
| **`input_impulse_ids` / `output_impulse_ids`** | per-task impulses consumed / produced (for co-occurrence) | canonical def: CLAUDE.md "Execution Trace Model" |
| **`vessel_id`** | the vessel (instance) that executed; doubles as pod/instance id | structural vs operational vessel: SUBSTRATE_AS_SOFTWARE §3.1 |
| **goal execution path** | curated activity sequence achieving a goal; `path_activities`, `path_signature`, `endpoint_output_shapes` | table `goal_execution_paths` |

## 7. Deprecated & pruned terms

Do not use in new docs; listed so older docs remain readable.

| Dead / deprecated term | Status | Use instead |
|---|---|---|
| **trailblazing** | pruned (never canonical; superseded) | the **failure-mode taxonomy** + variant creation on failure |
| **improvisation outcome** | pruned | posterior variance + failure mode |
| **Instructional state** | deprecated alias | **Informational state** |
| **Functional state** | deprecated alias | **Observational state** |
| **process-of-becoming** | deprecated alias (live docs) | **Transient state** / "the becoming" |
| **"The Two Primitives"** | deprecated framing | the **four** primitives (activity is derived) |
| **`resolver_tier` as a fixed kind** | deprecated reading | a binning of **directional certainty** (§5) |
| table `execution` / `activity_execution_trace` | deprecated table aliases | **`activity_execution_traces`** |

### 7.1 Retired names

Product-era names carried over from before the substrate had its own identity. They are
supersessions, not synonyms: a new document, shape, repo, package, or identifier must never
introduce one, and encountering one in older material means the surrounding claim is worth
re-checking against the running system.

| Retired name | Status | Use instead |
|---|---|---|
| `metabob-*` as a prefix | retired across the codebase | the vessel's own name — e.g. `metabob-activity-api` → **`activity-api`** |
| `@metabob/*` packages | retired namespace | **`@avigopal/*`** — e.g. `@metabob/cpg-inference` → `@avigopal/cpg-inference` |
| `metabob-devbob` (super-repo) | retired | **`substrate`** |
| `minibob`, `MiniBob` | **removed, not renamed** | nothing — the CLI it named is gone. Its instance auth is retired; the signin routes answer `410 Gone` deliberately |
| `devbob` | retired | **`substrate`** — the self-developing deployment, not a separate agent |

**One surviving exception:** the **metabob MCP server** keeps its name. It is the agent-facing
cockpit — the tool surface an operator's agent calls into — and its tool identifiers
(`mcp__metabob__*`) are a published interface, not internal drift.

**A tombstone outlives the thing it marks.** Where a retired name appears in a refusal path — a
`410 Gone` body naming the removed method — that is a deliberate signal, not residue. Deleting it
degrades an informative refusal into a bare `404`. Retire such a route on telemetry showing no
callers, not on a name sweep.

## 8. The cross-lens dictionary (pointer)

Each substrate quantity is named in four charts. The full table is in
`SUBSTRATE_AS_DYNAMICS.md` §0 (math lenses) and `SUBSTRATE_AS_SOFTWARE.md` §0
(software lens). The spine:

| Substrate term | MDP | DEC | Dynamics | Software |
|---|---|---|---|---|
| learned content | Beta `(α,β)` | Hodge star `⋆₁` | slow variable | learned-durable group |
| selection | Thompson argmax | sampling against `⋆` | fast variable at `x*(y)` | recall motion |
| credit propagation | n-step TD | heat flow `e^{−tL}` | transport along slow flow | learning motion |
| convergence rate | regret `O(√(T log T))` | `λ₁·ρ_sample·κ(⋆)⁻¹` | spectral gap | throughput × headroom |
| resolver directional certainty | determinism of `P(s′\|s,a)` | stalk-map sharpness `⋆₁` | sharp vs noisy direction | `resolver_tier` bins (§5) |
| coherence condition | (implicit) | `λ₁(L(t)) ≳ ρ_grow` | normal-hyperbolicity threshold | learned-mixing > minting rate |
