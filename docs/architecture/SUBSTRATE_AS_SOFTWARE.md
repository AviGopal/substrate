# The substrate as software: three states, durability groups, and what is implementation detail

> Fourth companion to the three formal-lens docs:
> [`SUBSTRATE_AS_MDP.md`](SUBSTRATE_AS_MDP.md) (the learning *rule*),
> [`SUBSTRATE_AS_DEC.md`](SUBSTRATE_AS_DEC.md) (the *structure*), and
> [`SUBSTRATE_AS_DYNAMICS.md`](SUBSTRATE_AS_DYNAMICS.md) (the *flow in time*). Those
> three read the substrate as mathematics. This one reads the **same running
> system as software** — organized by the one axis the math charts abstract away:
> **durability**, i.e. *what persists, what is ephemeral, what is appended, and
> who is allowed to change each.* It introduces no new primitives. Two further
> companions extend this durability lens past the single-container boundary:
> [`SUBSTRATE_AS_FLEET.md`](SUBSTRATE_AS_FLEET.md) takes the four durability groups
> of §2 across a multi-container fleet (the cross-container algebra of each group),
> and [`SUBSTRATE_AS_NETWORK.md`](SUBSTRATE_AS_NETWORK.md) supplies the
> protocol/engineering layer that realizes those crossings.
>
> This doc is also the **canonical home for two naming decisions** the rest of the
> documentation should defer to: (1) the resolved three-state triad
> (§1), and (2) the reframe of `resolver_tier` as a continuous directional
> uncertainty (§4). Where earlier docs carry drifted names, those are *prior
> spellings of these canonical terms*, not different concepts.

## 0. One object, four lenses

The three math docs share a dictionary (the "one object, three lenses" table in
`SUBSTRATE_AS_DYNAMICS.md` §0). This doc adds the engineering column: for each
quantity, **where does it live, and how durable is it?** The math lenses say
*what is being learned* (MDP), *on what object* (DEC), and *how it moves in time*
(Dynamics). The software lens says *what it is made of and how long it lasts* —
which is the chart an operator actually deploys, backs up, and migrates.

The bridge between the math and the software is the **three-state triad**, which
turns out to *be* a durability classification once its scope is understood (§1–§2).

## 1. The three states, canonized

There is **one** three-state triad. Earlier docs name it two different ways; those
are the same three states seen through a changing understanding of the system, not
two ontologies. The canonical names are **Informational / Transient /
Observational**.

| Canonical state | Prior name (build-software framing) | What it is | Why the name drifted |
|---|---|---|---|
| **Informational** | *Instructional* (Vessel / blueprint) | the durable structure: vessel code **and** learned content — shapes, posteriors, composition topology, goal-paths | scope grew from "the instructions/code" to "all durable knowledge, including the learned weights" — for a learning system the weights are as load-bearing as the code |
| **Transient** | *Process-of-Becoming* (the becoming) | the execution in flight: an impulse being resolved, a binding being chosen, a trajectory stepping | invariant — the only name that did not move |
| **Observational** | *Functional* (Instance / artifact) | the recorded outcome: traces, validation results, realized artifacts | scope shifted from "the thing produced" to "the *observation* of it" — for a learning system the load-bearing aspect of an output is that it is observed and fed back |

The drift is not sloppiness; it is the documentation tracking a reframe from
*"we are building and running software"* (Instructional → Functional) to *"we are
running a learning system"* (Informational → Observational), with Transient as the
invariant middle. **Use Informational / Transient / Observational everywhere.**
`Instructional` and `Functional` are deprecated aliases retained only for reading
older docs.

### 1.1 The two motions

The triad is traversed in two directions, and naming both is what makes the
single-triad claim concrete:

- **Recall** (`Informational → Transient → Observational`): apply existing
  structure. Thompson selection, activity dispatch, composition flow run this way.
- **Learning** (`Observational → Transient → Informational`): mint structure from
  observation. The ribosome, α/β updates, impulse-relevance and composition-edge
  writes run this way. The Observational state of one cycle becomes the new
  Informational state of the next — the loop, not a line.

This is the same object the math docs describe: recall is the MDP *policy* and the
DEC *coboundary* applied forward; learning is the MDP *posterior update* and the
DEC *refinement of `⋆`* applied backward (`SUBSTRATE_AS_DYNAMICS.md` §1, the
fast/slow split, sits inside the Transient→Informational edge).

## 2. The durability bridge

Mapped to software, the three states are **four durability groups** — because the
Informational state splits in two by *who is allowed to change it*. This split is
the central engineering fact the math charts abstract away.

| Durability group | State | Changes via | What lives here | Backup / migration unit |
|---|---|---|---|---|
| **Authored-durable** | Informational | deploy / commit (operator or substrate-authored) | vessel code, resolver *implementations*, activity-template *definitions*, shape *contracts* | git (`repos/*`), container images |
| **Learned-durable** | Informational | the loop, continuously, every trace | Thompson posteriors (α/β), the shape lattice, composition-edge weights, goal-paths, impulse-relevance scores | SurrealDB snapshot (the learning state) |
| **Ephemeral** | Transient | per-execution, vanishes on completion | in-flight impulses, slot bindings, the executing trajectory, resolver call stack | (not persisted — reconstructable only from the Observational record) |
| **Recorded** | Observational | append on execution | execution traces, validation results, failure modes, realized artifacts | SurrealDB trace store; external artifacts (files, commits) |

Two consequences fall out immediately:

1. **The two Informational groups have different operational physics.**
   Authored-durable changes by a deliberate, reviewable, version-controlled act and
   is the operator's lever. Learned-durable changes autonomously and continuously
   and is the *substrate's* lever — it is what a backup must capture and what a
   fresh substrate lacks (see `docs/SUBSTRATE.md` on backing up learning state).
   Conflating them is the source of the "is a vessel code or is it a running
   service?" ambiguity (§3).

2. **The loop crosses durability boundaries in a fixed pattern.** Recall reads
   Authored-durable + Learned-durable → runs Ephemeral → writes Recorded. Learning
   reads Recorded → writes Learned-durable. **Nothing in the normal loop writes
   Authored-durable** — that is precisely the operator-authored boundary, and the
   S1→S2 lift is defined by the substrate beginning to write it too (CLAUDE.md
   "After lift").

## 3. Which primitives are implementation details

The foundation names four primitives — **impulse, pointer, resolver, vessel**.
Read through durability, these are **authored-durable software constructs**: they
are the substrate the learning runs *on*, not the learning itself. The
load-bearing learning state lives in the **learned-durable** group, which the flat
"four primitives" list under-represents.

| "Primitive" | Durability group | Is it the learning, or the scaffold for it? |
|---|---|---|
| **vessel** | authored-durable (as code) / also a deployment unit (runtime) | scaffold — a bundle that *hosts* resolvers; see the dual-sense note below |
| **resolver** | authored-durable (the implementation) | scaffold — a function `pointer → content`; its *learned trust* (§4) is the learning |
| **pointer** | authored-durable (a field shape) | scaffold — the addressing/dispatch key; "pointer-as-shape" is load-bearing as a *principle*, but the pointer object is plumbing |
| **impulse** | authored-durable (the envelope) / ephemeral (a loaded instance) | scaffold — the data envelope; the *content* is transient, the *relevance* is learned |

The genuinely load-bearing, irreducible learning state — the thing you would lose
if the database were wiped but the code survived — is **not** in this list. It is:
Thompson posteriors, the shape lattice, composition-edge weights, goal-paths, and
impulse-relevance — the **learned-durable** group. The engineering takeaway:
**treat the four primitives as the authored-software layer and the learned-durable
group as the system's actual state.** When planning, version, review, and test the
primitives like code; snapshot, migrate, and protect the learned-durable group
like a database — because that is what they each are.

### 3.1 Vessel has two senses; keep them apart

`vessel` is used two ways and both are legitimate:

- **Structural (foundation sense):** a *collection of activities and resolvers* —
  an authored-durable code construct.
- **Operational (deployment sense):** a *running service instance* (a systemd unit
  or pod) that hosts that collection — a runtime entity with health, a `vessel_id`,
  and quirks.

A structural vessel is *instantiated as* an operational vessel; the structural form
is authored-durable, the operational form is a runtime fact. Where ambiguity
matters, say "vessel (code)" vs "vessel (instance)."

## 4. `resolver_tier`, reframed: directional uncertainty on the shape hypersurface

`resolver_tier ∈ {deterministic, pattern, llm}` is a kludge: a static, categorical,
hand-assigned label standing in for a quantity that is continuous, geometric, and
learnable. The canonical reframe:

> **`resolver_tier` is a coarse binning of the expected directional uncertainty of
> a resolver's output** — the uncertainty that the information it produces lies
> *along the correct shape-axis with respect to the goal axis*: that the resolver's
> output is a well-defined **coplanar (tangent) direction to the shape hypersurface
> at the current position**, rather than a high-variance direction with a normal
> (off-manifold) component.

Unpacked. The state sits on the **shape hypersurface** — the manifold of reachable
shape-configurations (the DEC realized-cochain space; the Dynamics slow manifold).
The goal defines a target direction (the **goal axis** — the residual direction
`‖g − Π_{span(V_t)} g‖` of `SUBSTRATE_AS_MDP.md` §1.1). Running a resolver emits a
displacement. The tier is measuring the **concentration of that displacement's
direction around the goal-coplanar tangent**:

- **deterministic** — a sharp tangent vector in a known direction; near-zero
  directional uncertainty; output is reliably on-manifold and shape-correct.
- **pattern** — a learned direction; mostly tangent, moderate variance.
- **llm** — a high-variance direction that may carry a large normal component
  (off-manifold = wrong-shape / hallucinated output); high directional uncertainty.

This is the **same object every other lens already has**:

| Lens | Name for this quantity |
|---|---|
| DEC | sharpness of the edge's stalk map = the `⋆₁` precision (deterministic ⇒ delta / point mass) — `SUBSTRATE_AS_DEC.md` §0.2, §1.3 |
| MDP | determinism of `P(s′\|s,a)` (deterministic tier ⇒ delta transition) — `SUBSTRATE_AS_MDP.md` §4.3 |
| Dynamics | which directions are fast/sharp vs. noisy on the manifold — `SUBSTRATE_AS_DYNAMICS.md` §0 (resolver row) |

So the three named tiers are **coarse bands of one continuous, per-`(resolver,
signature)` scalar** — call it the resolver's **directional certainty** (its inverse
is the expected directional uncertainty). Crucially this scalar is **already being
learned**: the forward arm's competence map (`α` climbs where a resolver reliably
hits the goal shape-axis, `β` climbs where it does not — `SUBSTRATE_AS_MDP.md`
§12.8) *is* an empirical estimate of it, per signature. The kludge is not the
three buckets per se; it is that the label is **static and assigned** when the
honest object is **continuous and measured**.

### 4.1 What this changes, concretely

- **Keep** `resolver_tier`'s three values as **coarse bins / priors** — they are a
  fine warm-start and a readable UI label.
- **Read** the operative quantity from the learned forward-arm precision per
  `(resolver, signature)`, not from the static label, wherever a real decision
  (selection, cost-vs-confidence trade) depends on it.
- **Expect** a resolver's effective tier to be **signature-dependent**: an `llm`
  resolver can be locally near-deterministic on signatures where it has proven
  reliable, and a nominally `deterministic` resolver can be unreliable where its
  preconditions are unmet. The static label cannot express this; the learned
  precision can.
- This is also the precise statement of "models are resolvers, not alternatives"
  (`SUBSTRATE_AS_MDP.md` §12.8): a model is a resolver whose directional certainty
  is *low and unknown a priori* and is learned per-signature, then routed around
  where it stays low.

## 5. Scorecard — decision vs. established

Following the discipline of the companion docs.

**Canonical decisions (this doc's authority; deferred to elsewhere):**

- Three-state triad = **Informational / Transient / Observational**; `Instructional`
  / `Functional` are deprecated aliases. → §1
- The four primitives are the **authored-durable** software layer; the system's
  load-bearing state is the **learned-durable** group. → §3
- `resolver_tier` is a coarse binning of a continuous learned directional
  uncertainty; keep the bins, read the scalar. → §4

**Established (the reframe rests on results already cited by the companions):**

- The directional-uncertainty quantity is the DEC stalk-map sharpness / `⋆₁`
  precision and the MDP transition-determinism — same object, already load-bearing
  in both. → §4 (`SUBSTRATE_AS_DEC.md` §1.3; `SUBSTRATE_AS_MDP.md` §4.3)
- The forward arm empirically estimates it (Beta-Bernoulli competence map). → §4
  (`SUBSTRATE_AS_MDP.md` §12.8)

**Frontier (named, not asserted):**

- A goal-conditioned tangent/normal decomposition of resolver output as a *measured
  runtime quantity* (vs. its current implicit form in the forward-arm posterior) is
  not yet computed anywhere; §4 describes the object, not an implemented metric.

**Honest limit (carried):**

- Durability classification does not touch the non-constructibility ceiling
  (`SUBSTRATE_AS_MDP.md` §11). Knowing *where* state lives and *how durable* it is
  says nothing about whether the Informational state is complete — it is not.

## 6. Recap

The substrate, as software, is four durability groups: **authored-durable** (code
— the four primitives) and **learned-durable** (posteriors, shapes, edges,
goal-paths) together make the **Informational** state; **ephemeral** runtime is the
**Transient** state; the append-only trace store is the **Observational** state.
The recall motion reads Informational and writes Observational; the learning motion
reads Observational and writes the learned-durable half of Informational; nothing
in the normal loop writes the authored-durable half — that boundary is the operator
role, and crossing it is the lift. The four "primitives" are the authored-durable
scaffold, not the learning; the learning is the learned-durable group, and it
should be engineered like the database it is. And `resolver_tier` is not three
kinds of resolver but three coarse bands of one continuous, learnable scalar — the
directional certainty that a resolver's output lies along the goal-aligned tangent
of the shape hypersurface — which the forward arm already measures per signature.

None of this is new machinery. It is the same trace store, the same Thompson layer,
the same vessels and resolvers — sorted by how long they last and who is allowed to
change them. The math lenses say what is being learned, on what object, and how it
flows; this lens says **what it is made of, where it lives, and which parts are the
learning versus the scaffolding the learning runs on.**
