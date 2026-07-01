# The substrate as software: the execution walk, its durability physics, and how every lens names each step

> Companion to the formal-lens documents, all reading one running system through
> different coordinate charts:
> [`SUBSTRATE_AS_MDP.md`](SUBSTRATE_AS_MDP.md) — the learning *rule* (factored-MDP
> Bayesian Q-learning);
> [`SUBSTRATE_AS_DEC.md`](SUBSTRATE_AS_DEC.md) — the *structure* (a weighted directed
> cell complex and its Hodge operators);
> [`SUBSTRATE_AS_DYNAMICS.md`](SUBSTRATE_AS_DYNAMICS.md) — the *flow in time* (a
> slow–fast dynamical system with a conditional-stability threshold);
> **this chart, `SUBSTRATE_AS_SOFTWARE.md`** — the *engineering* (the execution walk
> as software: which step runs where, what persists, who is allowed to change it);
> [`SUBSTRATE_AS_REPRESENTATION.md`](SUBSTRATE_AS_REPRESENTATION.md) — the
> *representation* (an open basis of shape-axes; the momentum-space dual of the
> transformer);
> [`SUBSTRATE_AS_FLEET.md`](SUBSTRATE_AS_FLEET.md) — the *fleet* (cross-container
> durability; what may cross the boundary);
> [`SUBSTRATE_AS_NETWORK.md`](SUBSTRATE_AS_NETWORK.md) — the *network* (the protocol
> layer; how the crossings are realized).
>
> The math charts read the substrate as mathematics. This one reads the **same
> running system as software**, organized along the one axis software actually runs
> on: **the execution walk** — the ordered steps a goal passes through from arrival
> to recorded outcome to learned update — cross-cut by **durability** (what persists,
> what is ephemeral, what is appended, and who may change each). It introduces no new
> primitives. Where the math charts each add a *column* to a shared dictionary (the
> "one object, lenses" table in `SUBSTRATE_AS_DYNAMICS.md` §0), this chart's two jobs
> are to **assemble those columns** and to **lay them along the execution steps**, so
> an operator can read, for any step, what it is in every lens, where it runs, and
> what it persists.
>
> This doc is the **canonical home for two naming decisions** the rest of the
> documentation defers to — now placed where they arise in the walk, not as
> standalone preambles: (1) the resolved three-state triad (§1), and (2) the reframe
> of `resolver_tier` as a continuous directional uncertainty (§4, at the resolution
> step). Where a sibling carries a drifted name, that is a *prior spelling of these
> canonical terms*, not a different concept.

## 0. One object, every lens — assembled along the walk

The math charts share a dictionary and each adds one column to it. The hub table
(`SUBSTRATE_AS_DYNAMICS.md` §0) reads, per quantity:

| Quantity in the substrate | MDP lens (the rule) | DEC lens (the structure) | Dynamics lens (the flow) |
|---|---|---|---|
| the learned content | Beta posterior `(α,β)` per `(s,a)` | Hodge star `⋆₁` = posterior precision | position of the **slow variable** |
| selection | Thompson `argmax` over `A(s)` | sampling against `⋆` | **fast variable** at quasi-equilibrium |
| credit propagation | n-step TD / Monte-Carlo backup | heat flow `e^{−tL}` under the Hodge Laplacian | transport along the slow flow |
| convergence rate | per-cell regret `O(√(T log T))` | `λ₁(L)·ρ_sample·κ(⋆)⁻¹` | **spectral gap = slowest mode = mixing time** |
| livelock | (not named) | harmonic component `ker L₁ ≅ H¹` | center/marginal mode — **loss of normal hyperbolicity** |
| runtime growth | open-world action-space expansion | subcomplex gluing; monotone `⋆` extension | the **drive term `ρ_grow`**; `L = L(t)` is non-autonomous |
| "the transient state is the steady state" | walks the dual-arm invariant manifold (TTSA) | tracks the moving harmonic subspace of `L(t)` | **slow-manifold tracking, not a fixed point** |
| coherence condition | (implicit in arm-symmetry) | `λ₁(L(t)) ≳ ρ_grow` | **normal-hyperbolicity / stability threshold** |

`SUBSTRATE_AS_REPRESENTATION.md` §0 adds the **representation column** (each quantity
as a direction in an open basis of shape-axes). `SUBSTRATE_AS_FLEET.md` §1 adds the
**cross-container algebra column**; `SUBSTRATE_AS_NETWORK.md` §0 the
**protocol-operation column**. The meta-claim every chart repeats (DYNAMICS §0):
*each row is one quantity named in each chart, and the companions add their columns
rather than duplicating the whole.*

This chart adds the **engineering columns** — *where does each step run, and how
durable is what it touches?* — and is the one chart that puts the rows back in
**execution order**. The bridge from the math to the software is the **three-state
triad**, which turns out to *be* a durability classification once its scope is
understood (§1, §4). The rest of the doc is the walk: §2 names the components the
walk moves through; §3 walks the steps and gives the assembled master table; §4
states the durability physics the walk obeys (and lands the resolver-tier reframe at
the step where it bites); §5 closes the walk into the self-* loop and ties each
mechanism to the live substrate unit that runs it.

## 1. The frame: three states, two motions

There is **one** three-state triad. A sibling may name it two ways; those are the
same three states seen through a changing understanding of the system, not two
ontologies. The canonical names are **Informational / Transient / Observational**.

| Canonical state | Prior name (build-software framing) | What it is | Why the name drifted |
|---|---|---|---|
| **Informational** | *Instructional* (Vessel / blueprint) | the durable structure: vessel code **and** learned content — shapes, posteriors, composition topology, goal-paths | scope grew from "the instructions/code" to "all durable knowledge, including the learned weights" — for a learning system the weights are as load-bearing as the code |
| **Transient** | *Process-of-Becoming* (the becoming) | the execution in flight: an impulse being resolved, a binding being chosen, a trajectory stepping | invariant — the only name that did not move |
| **Observational** | *Functional* (Instance / artifact) | the recorded outcome: traces, validation results, realized artifacts | scope shifted from "the thing produced" to "the *observation* of it" — for a learning system the load-bearing aspect of an output is that it is observed and fed back |

The drift tracks a reframe from *"we are building and running software"*
(Instructional → Functional) to *"we are running a learning system"* (Informational
→ Observational), with Transient as the invariant middle. **Use Informational /
Transient / Observational everywhere.** `Instructional` / `Functional` are deprecated
aliases retained only for reading older docs.

### 1.1 The two motions are the two halves of the walk

The triad is traversed in two directions, and the whole of §3 is these two motions
spelled out step by step:

- **Recall** (`Informational → Transient → Observational`): apply existing structure.
  Selection, resolution, binding, dispatch, stepping, the reach gate, and the trace
  write are all Recall. It is the MDP *policy* and the DEC *coboundary* applied
  forward. → §3 steps 0–7.
- **Learning** (`Observational → Transient → Informational`): mint structure from
  observation. α/β updates, credit propagation, ribosome extraction, composition-edge
  and goal-path writes are all Learning. It is the MDP *posterior update* and the DEC
  *refinement of `⋆`* applied backward. The Observational state of one cycle becomes
  the new Informational state of the next — the loop, not a line. → §3 step 8.

`SUBSTRATE_AS_DYNAMICS.md` §1 (the fast/slow split) sits inside the
Transient→Informational edge: selection is the fast variable, the posterior the slow
one.

## 2. The components the walk moves through (the intent view)

Read from intent, the substrate is a set of vessels each of which **owns some
shapes** and **wants others**: a vessel resolves the shapes whose data it holds, and
to do its work it asks — through the discovery contract — whichever vessel owns the
shapes it lacks. "Resolvers live where data lives" is, in the DEC lens, the
**sparsity of the Hodge Laplacian `L`** (DEC §2): no universal resolver, so no dense
coupling. The walk in §3 is a goal threading this graph of want-and-own.

The four foundation primitives — **impulse, pointer, resolver, vessel** — are, read
through durability, **authored-durable software constructs**: the scaffold the
learning runs *on*, not the learning itself (the load-bearing learning state is the
*learned-durable* group, §4). Treat them like code — version, review, test them. The
table below is the current fleet, each component tagged with the durability group it
predominantly touches and the walk-step it owns; ports are the local single-container
substrate's host-mapped ports.

| Component | Port | Owns / wants (intent) | Walk role | Durability touched |
|---|---|---|---|---|
| **discovery-vessel** | — | owns the registry; every vessel wants "who resolves shape X" | the fixed point all routing passes through | authored-durable (contracts) + ephemeral (TTL registry) |
| **goal-host-vessel** | 18210 | wants a goal; owns `goal_execution`/`activity_execution`; runs the **shape-graph walk** (backward-chain, bridge-author, data-flow bind) | steps 0–6: dispatch, selection, binding, stepping, reach gate | reads Informational, runs Transient, writes Recorded |
| **activity-api** | 18080 | owns traces, templates, posteriors, composition edges, goal-paths; wants nothing — it is the trace store + learner | step 1 selection inputs; step 7 trace write; step 8 learning | learned-durable + recorded (the database snapshot *is* the learning state) |
| **llm-resolver-vessel** | 18220 | owns `llm_completion`; wanted by any task whose resolver tier is `llm` | step 2/4: the high-directional-uncertainty resolver (§4) | authored-durable (impl) / ephemeral (a call) |
| **local-tools-vessel** | 18230 | owns filesystem/process resolvers + `code_verify_typecheck` | step 2/4: deterministic resolvers + verification | authored-durable / ephemeral |
| **concept-db** | 18260 | owns concept-graph shapes + dense (MiniLM) search | step 1 recall priors; step 8 concept promotion | learned-durable (concepts) |
| **analysis-vessel** | 18250 | owns `problem_detection`/`source_code`/`code_quality`/`cpg_query_result` (cpg-inference WASM, stateless) — **supersedes metabob-analysis-api** as the discovery-registered analyzer | step 2/4: code-analysis resolution | authored-durable (stateless) |
| **ribosome-vessel** | — | wants successful traces (activity-api WS); owns template extraction | step 8c: mint a template from a reached trace | writes structural learned-durable |
| **boredom-vessel** | — | wants idle time; owns the autonomous goal drive | step 0 generator — the substrate's heartbeat | drives Recall |
| **development-vessel** | 18090 | owns `memoryNote` (authoritative memory) + dev meta-activities (gap→feature, feature-compose, cutover) | the self-* machinery (§5); memory across sessions | authored-durable (it authors code) + learned-durable (memory) |
| **relevance-sink-vessel** | 18255 | owns impulse-relevance **penalty writes** — moved off the activity-api trace store to end write-contention | step 8a: the β-penalty path | writes learned-durable (decoupled) |
| **stateful-ui-vessel** | 18270 | owns `uiPanel`/`uiQuestion`/`interactor*` — the substrate's "face" | human-in-the-loop crossing (NETWORK) | recorded (interactor observations) |
| **light-dispatch-vessel** | 18280 | owns `light_dispatch_execution` — stateless oneshot dispatcher bypassing goal-host's full machinery for deterministic explicit-template chains | an alternate, low-machinery dispatch path | ephemeral (persists intermediates to disk) |
| **metric-collector-vessel** | 18300 | owns `metricSample` — a substrate-authored lift-test vessel (moved off 8280 to resolve an `EADDRINUSE` collision with light-dispatch) | observability sample collection | recorded |
| **clock-vessel** | — | owns `currentTimeReport` — the **first substrate-authored vessel end-to-end** (lift artifact) | proof-of-lift, not load-bearing | authored-durable (substrate-authored) |
| **identity-vessel** | — | owns auth (HMAC keys + JWT) — single source of truth | every cross-vessel step's attestation | authored-durable |

> **Operational notes (observed state, not asserted design):** `clock-vessel` and
> `metric-collector-vessel` are lift-test artifacts (substrate-authored end-to-end)
> rather than load-bearing fleet members — `metric-collector` was moved from 8280 to
> 8300 to clear an `EADDRINUSE` collision with `light-dispatch-vessel`.
> `relevance-sink-vessel` is load-bearing but was crash-looping in the audited
> session — its penalty writes fall back to / are dropped by activity-api when it is
> down.

### 2.1 Vessel has two senses; keep them apart

`vessel` is used two ways and both are legitimate:

- **Structural (foundation sense):** a *collection of activities and resolvers* — an
  authored-durable code construct (the rows above, as code).
- **Operational (deployment sense):** a *running service instance* (a systemd unit
  in the single-container substrate, or a pod downstream) with health, a `vessel_id`,
  and quirks (the rows above, as the live `:18xxx` services).

A structural vessel is *instantiated as* an operational vessel. Where ambiguity
matters, say "vessel (code)" vs "vessel (instance)."

## 3. The execution walk — each step in every lens

A goal threads the components of §2 in a fixed order. The Recall motion is steps 0–7;
the Learning motion is step 8. The master table assembles every lens's name for each
step (with section pointers so a reader can jump to the owning chart); the prose
after it carries the durability crossings and the two steps that are newest and most
load-bearing (the reach gate, step 6, and goal-path learning, step 8e).

| Step | MDP (rule) | DEC (structure) | DYNAMICS (flow) | REPRESENTATION | NETWORK (protocol) | FLEET (boundary) |
|---|---|---|---|---|---|---|
| **0 Goal arrives** | reward target: goal = direction `g`; reward = residual `r_t=‖g−Π_{span(V_t)}g‖` (§1.1) | goal-impulse = a 0-cochain / target potential; residual Hodge-decomposes (§1.4) | external drive the slow flow must reduce | a **target direction** in the shape-axis span (§1); intent = the unexplained residual (§4) | "dispatch a remote goal": goal-impulse + attestation + budget (§9 mode 2) | produced by operator-as-vessel; crosses as recorded recall (§4,§6) |
| **1 Selection** | policy `π(a\|s)`: Thompson `argmax θ_{s,a}` over `A(s)`; **state-conditioned** (C6) | sampling against `⋆`; `applicable(s)` = coboundary support at current 0-cochain (§0,§2) | the **fast variable** at quasi-equilibrium (§0,§1) | choosing a **tangent direction** in `A(s)`; signature = local frame (§0,§1) | local — single-owner, no crossing | reads authored+learned-durable (Informational) |
| **2 Impulse resolution** | observing a sample of `P(s′\|s,a)`; tier = determinism of `P` (delta for deterministic) (§4.3) | **restriction map** applied locally; tier = sharpness of the edge's stalk map = `⋆₁` precision (§0.2,§1.3) | resolving a sharp (fast) vs noisy direction (§0, resolver row) | output decomposes **tangent ⊕ normal**; tier = directional-certainty band (§3; **and §4 here**) | "resolve a remote impulse": pointer + scope-attestation + budget → resolved impulse, metadata-first (§9 mode 1) | ephemeral runs local **or remote**; only the *resolution* crosses (§4,§9) |
| **3 Binding / slot-fill** | reverse arm `P(activity\|pool-signature)` (§4.6) | `input_shapes ⊆ available_shapes` — **lattice/Tarski** layer, not linear (§1.5) | reverse-arm timescale; arm-symmetry = on-manifold condition (§1) | applicability containment `A(s)={a:input_shapes(a)⊆shapes(s)}` (§1,§7 L1) | local binding | ephemeral |
| **4 Resolver dispatch** | the action `a` executing; vessel = independent action subspace (§8) | the hyperedge fires; "resolvers live where data lives" = sparsity of `L` (§2) | a discrete action step on the complex | discrete-action hop in open representation (§5) | the capstone: **work does not move; resolution crosses** — capability-addressed, scope-attenuated (§9) | cross-container dispatch = recall-out / record-back; ephemeral stays remote (§1,§4) |
| **5 Trajectory stepping** | trajectory `τ=(s₀,a₀,…,sₙ)`; vertical (depth-first) along `composition_chain`, horizontal = breadth-first dual (§7) | a **1-chain** (directed path) (§0) | walking the slow manifold one step at a time (§2) | charting a manifold whose metric moves as charted (§0,§3) | tree of singly-owned executions linked by `parent_execution_id`+`composition_chain` (§9) | ephemeral stays in the running container (§1) |
| **6 Reach gate / verify** | the reward `R(s,a)`: binary success = degenerate scalarization of the vector residual (§1,§1.1,§12.6) | the realized-cochain check; validation integrity = precondition for `⋆` to mean anything | the reward signal that drives the metric update | **validity = measurement against the un-authorable referent** (§6,§7 L5) | validate result **locally** against validators; attestation tiers (§4,§9) | foreign trace folded only as attested evidence (§3,§6) |
| **7 Trace recorded** | each trace = one sampled `(s,a,s′,r)`; "the trace store is the empirical model" (§3,§10) | one sampled value of the flow 1-cochain on its edges (§2) | one sample of the slow manifold; `ρ_sample` = arrival rate (§0,§6) | the **Observational/Recorded** ground truth; reality's normal component is signal (§4) | append-only content-addressed store = Merkle-DAG/CRDT; typed attestation (§0,§6,§4) | **Recorded**: union-mergeable, trust-gated by two-sided signatures (§1,§6) |
| **8a α/β update** | `α←α+r, β←β+(1−r)` = natural gradient in Beta info-geometry, unit step (§2,§2.1) | natural gradient **refining `⋆`** (§2) | the slow variable updating; sharpens `⋆` (§1) | sharpen known directions / de-superpose (§1,§5.1) | "fold foreign evidence": `α+=w·s, β+=w·f`, `w`=attestation strength (§5) | quantitative learned-durable: moves only as folded signed evidence (§2,§3) |
| **8b Credit propagation** | n-step TD/MC backup; `α_{s_{t−k}}←α+γ^k r`, γ=1 (§3) | heat flow `e^{−tL}`; mixes at `λ₁` (§3,§4.1) | transport along the slow flow; broken chain-credit ⇒ `λ₁→0` (§6) | credit diffusion across axes | `propagateCreditAlongChain`; cross-substrate = tree of singly-owned execs (§9) | ephemeral compute, writes learned-durable |
| **8c Ribosome extraction** | active model expansion / open-world action growth (§5) | **active complex growth**: add cells at `Beta(1,1)` = uninformed `⋆` (§2) | a `ρ_grow` event; must satisfy `λ₁≳ρ_grow` (§3,§4) | **opening a new dimension** — minting a shape-axis (§0,§5); only for residual (§4) | new structure gossiped by reference (§0,§7) | **structural** learned-durable: mergeable by graph-union (§2) |
| **8d Composition-edge write** | crediting composition lineage vs the executed arm (§3) | adds an incidence raising `λ₁`; reuse sharpens vs mint raises `ρ_grow` (§2,§4.4) | improves the spectral gap (§4) | a new measured shared mode/edge (§5.1) | content-addressed edge identity (frontier) (§2) | structural learned-durable (§2) |
| **8e Goal-path record** | per-goal α/β keyed by `goal_hash`; path = attribution, success = *reached* (GOAL_EXECUTION_PATHS_SCHEMA) | a recorded curated 1-chain keyed by goal + `endpoint_output_shapes` | accumulates per-goal posterior across attempts | reuse of a reaching direction for a repeated goal-direction | recorded / folded | structural learned-durable (frontier: content-addressed identity) |

*(Section pointers are to the owning chart, in the column header order MDP / DEC /
DYNAMICS / REPRESENTATION / NETWORK / FLEET. `IMPULSE_ACTIVITY_FOUNDATION.md` "The
Execution Flow" and its 9-step "Topology Discovery Is the Purpose" loop are the
prose walk-throughs the table compresses.)*

### 3.1 The durability crossing, step by step

The walk obeys one fixed crossing pattern (consolidated in §4): **Recall reads
Informational, runs Transient, writes Recorded; Learning reads Recorded, writes the
learned-durable half of Informational; nothing in the normal loop writes the
authored-durable half.** Concretely along the steps:

- Steps 0–1 **read Informational** (the goal is fresh input; selection reads
  authored-durable templates + learned-durable posteriors).
- Steps 2–5 **run Transient** — in-flight impulses, bindings, the call stack, the
  stepping trajectory. None of it persists; it is reconstructable only from the
  Recorded trace. When a resolver dispatch (step 4) crosses a container boundary, the
  *ephemeral compute stays in the remote container* — only the resolution crosses
  back (FLEET §1: "ephemeral never crosses").
- Steps 6–7 **write Recorded** — the reach verdict and the trace are appended.
- Step 8 **writes learned-durable** — posteriors, edges, goal-paths, minted
  templates. This is the only motion that *changes* durable state in the normal loop,
  and it changes only the learned half.

### 3.2 The reach gate (step 6) and goal-path learning (step 8e): the newest load-bearing steps

Two June-2026 additions changed what "success" means and are not yet reflected in the
MDP/DEC charts (a known gap, §6 frontier):

- **The reach gate.** `verifyGoalReached` (goal-host `07feff5`) is an LLM-judge run
  **after** execution that emits `completion_shapes` and asks whether the goal was
  actually reached, not merely whether the activity exited cleanly. Hollow completion
  (e.g. a wrapper that produced an `activityExecutionSummary` instead of the asked
  artifact) → `reached:false` → β-penalty on the selected template. This makes the
  reward the residual-reduction of MDP §1.1 rather than exit-status — closing the
  "status=completed ≠ goal reached" hole that previously α-credited gaming.
- **In-flight recovery** (between steps 6 and 5, looping). On `reached:false` the
  `/resolve` loop β-penalises and **excludes** the failed approach
  (`recommendExcluding`) and retries with a genuinely different approach (goal-host
  `980240b`), until reached or exhausted. "Recovery is part of reaching the goal, not
  offline repair." The *reached* trace is what the ribosome (8c) mints.
- **Per-goal record & reuse** (step 8e). `recordGoalPath` writes to
  `goal_execution_paths` keyed by `goal_hash` (path = attribution, success = reached,
  per-goal α/β); `recommendReachingPath` reuses the reaching path for a repeated goal.
  This is the unified goal-learning mechanism — goals from the MCP surface
  (`mcp__metabob__run_goal`) and from the human Obsidian surface both dispatch through
  the same goal-host `/run-goal`+`/resolve`, both gated, both recorded. Canonical:
  [`GOAL_EXECUTION_PATHS_SCHEMA.md`](GOAL_EXECUTION_PATHS_SCHEMA.md).

### 3.3 Same walk, two timescales

The identical step structure governs **application runtime**, not just development
goals: an HTTP request is an input impulse, a route handler is an activity, the
functions it calls are resolvers, and the meta-trace levels are L1 `goal_resolve` /
L2 `activity_execute` / L3 per-resolver `impulse_resolutions`. Same model, same
infrastructure, **different timescale** (milliseconds vs minutes). See
[`RUNTIME_ACTIVITY_TRACING.md`](RUNTIME_ACTIVITY_TRACING.md). The walk in §3 is
timescale-invariant; this chart's durability classification applies unchanged at
either scale.

## 4. The durability physics the walk obeys

Mapped to software, the three states are **four durability groups** — because the
Informational state splits in two by *who is allowed to change it*. This split is the
central engineering fact the math charts abstract away, and it is what the §3.1
crossing pattern is built on.

| Durability group | State | Changes via | What lives here | Backup / migration unit |
|---|---|---|---|---|
| **Authored-durable** | Informational | deploy / commit (operator or substrate-authored) | vessel code, resolver *implementations*, activity-template *definitions*, shape *contracts* | version control; container images |
| **Learned-durable** | Informational | the loop, continuously, every trace | Thompson posteriors (α/β), the shape lattice, composition-edge weights, goal-paths, impulse-relevance | the trace-store database snapshot (the learning state) |
| **Ephemeral** | Transient | per-execution, vanishes on completion | in-flight impulses, slot bindings, the executing trajectory, resolver call stack | (not persisted — reconstructable only from Recorded) |
| **Recorded** | Observational | append on execution | execution traces, validation results, failure modes, realized artifacts | the trace store; external artifacts (files, commits) |

Two consequences:

1. **The two Informational groups have different operational physics.**
   Authored-durable changes by a deliberate, reviewable, version-controlled act — the
   operator's lever (and, post-lift, the substrate's, §5). Learned-durable changes
   autonomously and continuously — the *substrate's* lever; it is what a backup must
   capture and what a fresh substrate lacks. Conflating them is the source of the "is
   a vessel code or a running service?" ambiguity (§2.1).
2. **Nothing in the normal loop writes Authored-durable.** That is precisely the
   operator-authored boundary, and the lift to substrate-authored development (§5) is
   *defined* by the substrate beginning to write it too.

### 4.1 `resolver_tier`, reframed (the resolution step, §3 step 2)

This is where the tier reframe bites, so it lands here. `resolver_tier ∈
{deterministic, pattern, llm}` is a kludge: a static, categorical, hand-assigned
label standing in for a quantity that is continuous, geometric, and learnable.

> **`resolver_tier` is a coarse binning of the expected directional uncertainty of a
> resolver's output** — the uncertainty that the information it produces lies *along
> the correct shape-axis with respect to the goal axis*: that the output is a
> well-defined **coplanar (tangent) direction to the shape hypersurface at the current
> position**, rather than a high-variance direction with a normal (off-manifold)
> component.

The state sits on the **shape hypersurface** (the DEC realized-cochain space; the
Dynamics slow manifold). The goal defines the **goal axis** (the residual direction
`‖g − Π_{span(V_t)} g‖`, MDP §1.1). A resolver emits a displacement; the tier measures
the **concentration of that displacement around the goal-coplanar tangent**:

- **deterministic** — sharp tangent in a known direction; near-zero directional
  uncertainty; reliably on-manifold and shape-correct.
- **pattern** — a learned direction; mostly tangent, moderate variance.
- **llm** — high-variance, may carry a large normal component (off-manifold =
  wrong-shape / hallucinated); high directional uncertainty.

This is the **same object every other lens already has**: DEC's stalk-map sharpness /
`⋆₁` precision (deterministic ⇒ delta; §0.2, §1.3), MDP's transition-determinism of
`P(s′|s,a)` (§4.3), and the Dynamics fast/sharp-vs-noisy direction (§0, resolver row).
So the three named tiers are **coarse bands of one continuous, per-`(resolver,
signature)` scalar** — the resolver's **directional certainty** — and that scalar is
**already being learned**: the forward arm's competence map (`α` climbs where a
resolver reliably hits the goal shape-axis, `β` where it does not; MDP §12.8) *is* an
empirical estimate of it, per signature. The kludge is not the three buckets; it is
that the label is **static and assigned** when the honest object is **continuous and
measured**.

**What this changes, concretely:** keep the three values as coarse priors / UI labels
(a fine warm-start); read the operative quantity from the learned forward-arm
precision per `(resolver, signature)` wherever a real decision depends on it; expect a
resolver's effective tier to be **signature-dependent** (an `llm` resolver can be
locally near-deterministic where it has proven reliable; a nominally `deterministic`
resolver unreliable where preconditions are unmet). This is the precise statement of
"models are resolvers, not alternatives" (MDP §12.8): a model is a resolver whose
directional certainty is low and unknown a priori, learned per-signature, then routed
around where it stays low.

Read as representation, this certainty scalar is **mass**: in the Fisher
(natural-gradient) metric an impulse is a *momentum component along a shape-axis* —
posterior precision `⋆₁` as mass × flow as velocity (REPRESENTATION §2). A sharp
tangent (high certainty) is a heavy, well-aimed momentum component; a high-variance
normal direction (low certainty) a light, off-manifold one. This is the basis of the
**momentum-space dual of the transformer**: where a transformer fixes dimensionality
and snaps a continuous flow to a discrete *position* (the next token), the substrate
keeps dimensionality open, takes discrete actions, and works in *directions* —
modelling the topology of reachable motion toward a goal rather than committing to a
sampled point (full treatment: REPRESENTATION §2, §5).

### 4.2 Which primitives are implementation detail

The four primitives (impulse, pointer, resolver, vessel) are the **authored-durable
scaffold**; the genuinely load-bearing, irreducible learning state — the thing you
lose if the database is wiped but the code survives — is **not** among them. It is the
**learned-durable** group: posteriors, the shape lattice, composition-edge weights,
goal-paths, impulse-relevance.

| "Primitive" | Durability group | Learning, or scaffold for it? |
|---|---|---|
| **vessel** | authored-durable (code) / deployment unit (runtime) | scaffold — bundle hosting resolvers (§2.1) |
| **resolver** | authored-durable (impl) | scaffold — a function `pointer→content`; its *learned trust* (§4.1) is the learning |
| **pointer** | authored-durable (field shape) | scaffold — addressing/dispatch key; "pointer-as-shape" load-bearing as a *principle*, the object is plumbing |
| **impulse** | authored-durable (envelope) / ephemeral (loaded instance) | scaffold — the envelope; *content* is transient, *relevance* is learned |

Engineering takeaway: **version, review, and test the four primitives like code;
snapshot, migrate, and protect the learned-durable group like a database** — because
that is what they each are.

## 5. The walk, closed and iterated: the self-* loop

When step 8's Learning output becomes step 0's Informational input for the next goal,
the walk closes into a loop, and that loop is the substrate's autonomy. Each self-*
property is a named feature of the closed walk; below, each is tied to its **canonical
owner doc** (where the math lives) and to the **live substrate unit** that runs it
(systemd units in the single-container substrate; see
[`docs/SUBSTRATE.md`](../SUBSTRATE.md)).

The loop's overall shape is **detect → author → verify → land → recover → measure →
explore**. In a normal autonomous session all phases fire; in the audited session only
the *observe + drain* half (measurement core + `funnel-drain`) was active — the
authoring and immune timers were deliberately paused (they are outside the
`self-repair-operational` allowlist, so they are not auto-revived). The mechanisms
below exist regardless; what varies session-to-session is which are enabled.

- **Self-development (the S1→S2 lift).** *Owner:* §4 (durability) — the lift is
  *defined* as the substrate beginning to write **authored-durable** state (MDP §5/§11
  reads it as active model expansion; FLEET §4/§6 as the cross-container form behind
  quorum ratification). *Live units:* `gap-compose` (route an open `substrateGap`
  through the feature composer: detect→spec→author→verify→stage), `feature_compose` +
  `apply_proposal_as_patch` (development-vessel), the **mitosis cutover**
  (commit→push origin/dev→restart with typecheck-evidence), `funnel-drain` (fires the
  funnel entry on a steady cadence so the boredom selector doesn't starve it). The
  honest residual boundary: the substrate can author *surgical* edits and whole
  net-new vessels via feature-compose, but feature-authoring breadth is the live
  S1→S2 frontier.
- **Self-assembly / composition / topology growth.** *Owner:* DEC §0.2–§0.3 — a
  vessel is a subcomplex; growth is subcomplex gluing (pushout/colimit), the only
  growth operation, with new cells at `Beta(1,1)`; MDP §7–§9 gives the three scales
  (within-dispatch / within-substrate / cross-substrate). *Live units:*
  `compose-teacher` (bootstraps organic producer→consumer composites to break the star
  topology, gated on headroom `λ₂·(1−star_ratio) ≥ 0.35`), `composition-edge-reconcile`
  (derives `activity_composition_graph` edges from traces so they become measurable).
- **Failure-recovery (the immune system).** *Owner:*
  [`IMPULSE_ACTIVITY_FOUNDATION.md`](IMPULSE_ACTIVITY_FOUNDATION.md) "Adaptive Immune
  System" — IDS/IPS/SIEM/SOAR collapsed into one mechanism ("detection and resolution
  are activities"), four reversibility tiers, `resolutionRefused` = push-away applied
  to self. *Live units:* `self-recovery` (per-vessel health-check → restart → revert
  `/vessels` to last-good host source → escalate as a gap), `light-dispatch-healthcheck`
  (restart-if-hung), and the author-time typecheck **rollback** inside feature-compose.
  In-flight goal recovery (§3.2) is the per-goal form.
- **Improvement (convergence).** *Owner:* MDP §2 (per-cell Beta-Bernoulli; conjugate
  update = natural gradient, §2.1; regret `O(√(T log T))`), DEC §4.1 (the master rate
  `R_conv ∼ λ₁(L)·ρ_sample·κ(⋆)⁻¹`), DYNAMICS §3.1 (inertial acceleration capped by
  `λ₁`). *Live units:* `m1-trainer` (retrains the embedding prior for the recommender),
  `autonomy-metrics` + `model-reality-audit` (track whether the rate factors are
  rising). The MRR / lift-gate instrumentation lives here.
- **Topology exploration.** *Owner:* DYNAMICS §3–§4 (the master inequality
  `λ₁(L(t)) ≳ ρ_grow` as a stay-sub-critical / normal-hyperbolicity threshold; growth
  is a drive *toward* criticality, the inequality the condition for staying below it),
  DEC §4.4 (same inequality, structural). The decisive lever is **reuse-before-mint**
  (IMPULSE_ACTIVITY_FOUNDATION "Reuse Before Mint"; DEC §2): reuse sharpens an existing
  edge's `⋆₁` *and* adds an incidence raising `λ₁`; minting raises `ρ_grow` — reuse
  helps **both sides** of `λ₁ ≳ ρ_grow` and is simultaneously the DB-cost lever (a
  sparse complex keeps queries `O(edges)`, not `O(cells)`). Enforced at the mint
  chokepoint (dev-vessel `activity-create-variant`, `REUSE_BEFORE_MINT`) and at
  selection. *Live units:* `spectral-gap` (tracks live `λ₂` + star-ratio — the
  governor `compose-teacher` gates on), `coherence-metric` / `coherence-recover`
  (orthogonality maintenance; collapse byte-identical duplicates).

The **non-load-bearing operator** is the asymptote of all of the above
(REPRESENTATION §6.1): as the per-signature competence map fills in and the substrate
writes more of its own authored-durable state, the operator's interventions are either
refused with cited evidence (`interventionRefused`) or absorbed without harm — the S3
condition, measured by active push-away, not intervention-absence (CLAUDE.md "Toward
S3").

## 6. Scorecard — decision vs. established vs. frontier

Following the discipline of the companion charts.

**Canonical decisions (this doc's authority; deferred to elsewhere):**

- Three-state triad = **Informational / Transient / Observational**; `Instructional` /
  `Functional` are deprecated aliases. → §1
- The four primitives are the **authored-durable** software layer; the system's
  load-bearing state is the **learned-durable** group. → §4.2
- `resolver_tier` is a coarse binning of a continuous learned directional uncertainty;
  keep the bins, read the scalar. → §4.1
- The unifying organization of this chart: the **execution walk** (§3) cross-cut by
  the **four durability groups** (§4) is the software/intent coordinate; every lens's
  name for each step is assembled in the §3 master table. → §3, §4

**Established (rests on results cited by the companions):**

- The directional-uncertainty quantity is the DEC stalk-map sharpness / `⋆₁` precision
  and the MDP transition-determinism — same object, load-bearing in both. → §4.1
  (`SUBSTRATE_AS_DEC.md` §1.3; `SUBSTRATE_AS_MDP.md` §4.3)
- The forward arm empirically estimates it (Beta-Bernoulli competence map). → §4.1
  (`SUBSTRATE_AS_MDP.md` §12.8)
- The certainty scalar read as Fisher mass × flow is a momentum component along a
  shape-axis (natural-gradient velocity decomposition). → §4.1 ([Amari];
  `SUBSTRATE_AS_REPRESENTATION.md` §2)
- The crossing pattern (Recall reads Informational → runs Transient → writes Recorded;
  Learning writes learned-durable; nothing normal writes authored-durable) is the
  durability statement of the two motions (§1.1). → §3.1, §4

**Frontier (named, not asserted):**

- A goal-conditioned tangent/normal decomposition of resolver output as a *measured
  runtime quantity* (vs. its implicit form in the forward-arm posterior) is described,
  not computed. → §4.1
- The momentum-space dual of the transformer is assembled from established pieces, not
  an owned result; full statement and honesty bounds in `SUBSTRATE_AS_REPRESENTATION.md`
  §5. → §4.1
- *(Resolved 2026-07-01.)* The reach gate and per-goal `goal_execution_paths` (§3.2)
  are live in code **and folded into the MDP/DEC charts**: the MDP chart now defines
  the base reward bit as the reach verdict (`SUBSTRATE_AS_MDP.md` §2, developed in
  §12.6), and the DEC chart folds a hollow chain as a β sample on its edges
  (`SUBSTRATE_AS_DEC.md` §3). The successor-feature factorization Q = ⟨ψ, R⟩ and the
  signature-cluster pooling axis are folded alongside (`SUBSTRATE_AS_MDP.md` §2.2 and
  §4.2; `SUBSTRATE_AS_DEC.md` §4.1). Schema detail remains owned by
  `GOAL_EXECUTION_PATHS_SCHEMA.md`. → §3.2
- Several §2 components (`relevance-sink-vessel` health, the `metric-collector` /
  `light-dispatch` port-8280 collision, the lift-test micro-vessels `clock-vessel` /
  `metric-collector-vessel`) are operational facts of the current fleet, not settled
  architecture; treated as observed state, not asserted design.

**Honest limit (carried):**

- Durability classification and the execution walk do not touch the
  non-constructibility ceiling (`SUBSTRATE_AS_MDP.md` §11). Knowing *where* each step
  runs, *how durable* what it touches is, and *what every lens calls it* says nothing
  about whether the Informational state is complete — it is not, and no self-*
  mechanism in §5 closes that gap.

## 7. Recap

The substrate, as software, is **the execution walk over four durability groups**.
The walk: a goal arrives → selection (Thompson, state-conditioned, the shape-graph
walk) → per-task impulse resolution → binding → resolver dispatch (possibly across a
container boundary, where only the resolution crosses and the ephemeral compute stays
put) → trajectory stepping → the reach gate (LLM-judged *reached*, not exit-status,
with in-flight recovery on failure) → trace recorded → learning (α/β, credit
propagation, ribosome extraction, composition-edge and per-goal-path writes). The §3
master table gives every lens's name for each step; §4 states the durability physics
the walk obeys.

The first seven steps are **Recall** (`Informational → Transient → Observational`):
read durable structure, run ephemerally, append a record. Step eight is **Learning**
(`Observational → Transient → Informational`): read records, write the learned-durable
half of Informational. **Nothing in the normal loop writes the authored-durable half**
— that boundary is the operator role, and the substrate crossing it is the S1→S2 lift
(§5). The four "primitives" are the authored-durable scaffold, not the learning; the
learning is the learned-durable group, engineered like the database it is. And
`resolver_tier` is not three kinds of resolver but three coarse bands of one
continuous, learnable scalar — the directional certainty that a resolver's output lies
along the goal-aligned tangent of the shape hypersurface — which the forward arm
already measures per signature, and which the representation chart reads as the Fisher
mass of an impulse's momentum component (§4.1).

None of this is new machinery. It is the same trace store, the same Thompson layer,
the same vessels and resolvers — sorted by the order they run in and by how long what
they touch lasts. The math lenses say what is being learned, on what object, and how
it flows; this lens says **what each step is made of, where it runs, what it persists,
and how the closed walk develops, assembles, recovers, improves, and explores its own
topology.**

## References

- **[Amari]** Amari, S., *Natural Gradient Works Efficiently in Learning*, Neural Computation 10(2), 1998. — *verification: carried.*
- **[Nielsen]** Nielsen, F., *An Elementary Introduction to Information Geometry*, Entropy 22(10), 2020. — *verification: carried.*
- Companion charts: [`SUBSTRATE_AS_MDP.md`](SUBSTRATE_AS_MDP.md), [`SUBSTRATE_AS_DEC.md`](SUBSTRATE_AS_DEC.md), [`SUBSTRATE_AS_DYNAMICS.md`](SUBSTRATE_AS_DYNAMICS.md), [`SUBSTRATE_AS_REPRESENTATION.md`](SUBSTRATE_AS_REPRESENTATION.md), [`SUBSTRATE_AS_NETWORK.md`](SUBSTRATE_AS_NETWORK.md), [`SUBSTRATE_AS_FLEET.md`](SUBSTRATE_AS_FLEET.md).
- Execution detail: [`IMPULSE_ACTIVITY_FOUNDATION.md`](IMPULSE_ACTIVITY_FOUNDATION.md), [`GOAL_EXECUTION_PATHS_SCHEMA.md`](GOAL_EXECUTION_PATHS_SCHEMA.md), [`RUNTIME_ACTIVITY_TRACING.md`](RUNTIME_ACTIVITY_TRACING.md), [`RESOLVER_TRACKING.md`](RESOLVER_TRACKING.md).
