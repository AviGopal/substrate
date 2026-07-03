# The substrate is a weighted cell complex under discrete exterior calculus

> Companion to the formal-lens documents, all reading one running system through
> different coordinate charts:
> - [`SUBSTRATE_AS_MDP.md`](SUBSTRATE_AS_MDP.md) — the learning *rule* (factored-MDP
>   Bayesian Q-learning).
> - [`SUBSTRATE_AS_DEC.md`](SUBSTRATE_AS_DEC.md) — the *structure* (a weighted directed
>   cell complex and its Hodge operators). **This document.**
> - [`SUBSTRATE_AS_DYNAMICS.md`](SUBSTRATE_AS_DYNAMICS.md) — the *flow in time* (a
>   slow–fast dynamical system with a conditional-stability threshold).
> - [`SUBSTRATE_AS_SOFTWARE.md`](SUBSTRATE_AS_SOFTWARE.md) — the *engineering* (durability
>   groups: what persists / is ephemeral / is appended).
> - [`SUBSTRATE_AS_REPRESENTATION.md`](SUBSTRATE_AS_REPRESENTATION.md) — the *representation*
>   (an open basis of shape-axes; the momentum-space dual of the transformer).
> - [`SUBSTRATE_AS_FLEET.md`](SUBSTRATE_AS_FLEET.md) — the *fleet* (cross-container
>   durability; what may cross the substrate boundary).
> - [`SUBSTRATE_AS_NETWORK.md`](SUBSTRATE_AS_NETWORK.md) — the *network* (the protocol
>   layer; how the crossings are realized).
>
> This is the **structure** chart. It reads the *same running system* in discrete
> exterior calculus (DEC) and combinatorial Hodge theory. It introduces **no new
> primitives**. Every quantity below is something the substrate already computes
> or stores; the contribution is to name the trace store, the Thompson layer, the
> composition chain, the shape lattice, and vessel/federation growth as one
> object — a **weighted directed cell complex** carrying cellular-sheaf data — so
> that convergence, scaling, and self-optimization rates read off as spectral
> properties of a single discrete Laplacian. The dictionary mapping each quantity
> across the charts is `SUBSTRATE_AS_DYNAMICS.md` §0; the representation column is
> `SUBSTRATE_AS_REPRESENTATION.md` §0. The sparsity-of-`L` argument of §2 is what
> `SUBSTRATE_AS_FLEET.md` §3 invokes to forbid a dense global posterior merge
> across substrates.
>
> The MDP doc disowns continuous/Riemannian structure and already leans on
> combinatorial Hodge theory; this document is the load-bearing version of that
> lean. The reconciliation it depends on — that a Hodge star is a *diagonal matrix
> of weights*, not a continuous metric — is stated and cited in §1.3.

## 0. One operation: a vessel is a subcomplex

The substrate is a single discrete object. Read it as a **weighted directed
cell complex** — more precisely a directed/chemical hypergraph carrying
cellular-sheaf data on its cells.

| Substrate primitive | DEC object | Where it lives |
|---|---|---|
| shape | 0-cell | shape DAG, `discover-by-shapes` |
| impulse pool at a state | 0-cochain (stalk data on present 0-cells) | input impulses of a trace |
| activity (`{in_shapes} → {out_shapes}`) | directed/chemical hyperedge | `activity_template`, `applicable(s)` |
| trace count / credit on an edge | 1-cochain (edge flow) | execution traces |
| Beta(α,β) posterior on `(signature, template)` | weight on the corresponding 1-cell | Thompson layer |
| composition chain | 1-chain (directed path) | `composition_chain` |
| resolver tier (det/pattern/llm) | sharpness of an edge's stalk map | per-task resolver fields |
| org/account/global scope | partial-pooling prior on cochain weights | scope ordering |

The single most important object is the **Hodge star `⋆`**, the metric on
cochains. `⋆₀` weights shapes; `⋆₁` weights activities. The substrate's learned
content lives entirely in `⋆`: an edge's `⋆₁` weight *is* that edge's Beta
posterior precision (its Fisher information). Learning is refinement of `⋆`;
selection is Thompson sampling against `⋆`; credit propagation is diffusion
under the Laplacian that `⋆` induces.

### 0.1 Activities are hyperedges, not edges

An activity consumes a *set* of input shapes and produces a *set* of output
shapes, so it is a **directed hyperedge**, not a simple edge. The faithful
published formalism is the **chemical hypergraph** of [Jost & Mulas]: each
hyperedge is a reaction; vertices carry input, output, or both (catalyst)
roles; the Laplace operator computes differences between input and output
vertices. This is an almost-exact structural match to "activity =
`{input_shapes} → {output_shapes}`," with **catalyst = a shape that is
required-but-preserved** (consumed and reproduced).

Caveat (honest): a *simplicial* complex requires downward closure (every face
of a present cell is present) and symmetry. Activities satisfy neither — an
activity does not imply that all sub-tuples of its inputs are also activities,
and it is directed. So the honest combinatorial substrate is a
**directed/chemical hypergraph** or a general **combinatorial complex** ([Hajij
et al.]), not a simplicial complex. The Hodge-Laplacian machinery still applies
once incidence/boundary operators are fixed; we simply may not claim a
simplicial complex where there is none.

### 0.2 A vessel is a subcomplex; explicit vs implicit is "are the maps given?"

A **vessel is a subcomplex.** A vessel `v` joining via discovery contributes:

- **ΔS_v** — new 0-cells (advertised shapes), adding coordinates to the complex.
- **ΔA_v** — new hyperedges (templates whose inputs are now satisfiable),
  extending `applicable(s)`.
- **ΔR_v** — new resolvers, which *reweight* `⋆`: a deterministic resolver
  collapses a stochastic edge's stalk map to a delta, i.e. sharpens that edge's
  `⋆₁` weight toward a point mass.

This is the only growth operation the substrate has. It is monotone-additive on
the metric: new cells enter at the uninformed weight Beta(1,1); existing cells
are untouched because `⋆` is block-diagonal across cells (§1.4). This is exactly
the monotone-capacity property the MDP doc records — capacity only ever grows —
now read as "extend `⋆` by zero-information on the new cells."

The substrate's **explicit/implicit vessel** distinction is, in DEC, the
question *are the restriction maps part of the data, or recovered from the
boundary?*

- An **explicit vessel** is a subcomplex glued in with *attested restriction
  maps* — discovery-registered incidences, declared resolver contracts. The
  gluing maps are handed to you.
- An **implicit vessel** is a subcomplex whose cells and flows are *observed*
  but whose restriction maps are *latent* — inferred from boundary behavior, not
  declared. The operator-as-vessel (sole producer of `goalIntent`) is implicit. A
  peer substrate known only through behavioral-continuation replay is implicit:
  you observe its boundary behavior and infer its internal maps.

This recovers the federation trust tier (`local-verified` / `peer-attested` /
`unattested`) as a *geometric* statement about whether the restriction maps are
given or reconstructed. The operator and a peer substrate are thus the same kind
of object as an embedded model — a boundary entity whose interior is inferred,
not declared; the four-step mechanism by which the substrate assesses such an
entity's interaction characteristics is `SUBSTRATE_AS_REPRESENTATION.md` §6.1.

### 0.3 Federation is vessel addition, not a separate scale

The within-dispatch / within-substrate / cross-substrate ladder is one operation
seen three times. In DEC there is only one scale: **the complex and its
subcomplexes.** Gluing any subcomplex (a resolver, a vessel, or a whole peer
substrate) is the **pushout / colimit of cell complexes**, and the obstruction
to coherent gluing is always the same cohomological object: **H¹ of the union**,
with the Mayer–Vietoris connecting map `∂` measuring whether two
locally-consistent pieces agree on their shared interface.

$$
H^0(X \cup Y) \to H^0(X) \oplus H^0(Y) \to H^0(X \cap Y)
  \xrightarrow{\ \partial\ } H^1(X \cup Y) \to \cdots
$$

Two locally-consistent peers (one global section each) glue into a global
section over the union **iff** they agree on the overlap `X ∩ Y` (the shared
shapes). When they disagree, `∂` pushes that disagreement into `H¹` of the
union — federation produces a *new* obstruction class that neither peer had
alone. This is the rigorous form of "two independently-consistent substrates
whose local consistencies don't glue."

A federation of `N` peers is therefore not a new mathematical regime; it is an
`N`-fold subcomplex gluing, governed by the same incidence structure, the same
`⋆`, the same Laplacian, the same `H¹`. The "three scales" picture collapses to
a single row: *glue a subcomplex; the obstruction is `H¹`; the rate is set by
the spectral gap (§3).*

Sources: [Hansen & Ghrist 2019]; [Riess & Ghrist].

## 1. The discrete apparatus

### 1.1 Cochains and the coboundary

A `k`-cochain is a function on oriented `k`-cells: 0-cochains on shapes,
1-cochains on activities, 2-cochains on the chosen activity-triangles. The
**discrete exterior derivative / coboundary** `d_k` raises degree with
`d ∘ d = 0`. `d₀` is the incidence/gradient (a potential on shapes induces a
flow on activities); `d₁` is the discrete curl (a flow on activities induces a
circulation on triangles). The boundary operators `B₁` (edges→nodes) and `B₂`
(triangles→edges) are `d₀ᵀ` and `d₁ᵀ` up to orientation.

### 1.2 Orientation and directedness

DEC handles oriented cells natively; an activity's input→output direction is the
1-cell orientation. The framework does **not** require the complex to be a DAG —
oriented edges and cycles are admissible, which matters because composition
chains can be cyclic (the livelock case, §3). Cyclicity is represented, not
forbidden; it surfaces as nonzero harmonic content rather than as an illegal
state.

### 1.3 The discrete Hodge star is a diagonal weight matrix (the reconciliation)

This is the crux for reconciling DEC with the disowning of Riemannian structure.
In DEC the Hodge star `⋆_k` is realized as a (typically **diagonal**)
inner-product / mass matrix on `k`-cochains — a choice of **weights**, not a
continuous metric. With circumcentric duality the entries are ratios of dual to
primal cell measure; combinatorially they are simply per-cell positive weights.
There is **no continuous manifold and no Riemannian structure** anywhere in the
construction.

Therefore the substrate may use the entire Hodge apparatus while remaining a
purely discrete object on the cells. The weights are the learned content: set
`⋆₁` on an edge to that edge's posterior precision.

Sources: [Bell & Hirani]; [Desbrun et al.].

### 1.4 The Hodge Laplacian and the Helmholtz decomposition

The **Hodge `k`-Laplacian** is `L_k = d_{k-1} δ_k + δ_{k+1} d_k`, where
`δ = ⋆ d ⋆` is the codifferential (adjoint of `d` under `⋆`). Then:

- `L₀ = B₁ᵀ B₁` is the ordinary (weighted) **graph Laplacian** on shapes.
- `L₁ = B₁ᵀ B₁ + B₂ B₂ᵀ` is the **graph Helmholtzian** = down-Laplacian +
  up-Laplacian on activities.

The space of 1-cochains decomposes `L²`-orthogonally:

$$
C^1 \;=\; \underbrace{\operatorname{im}(d_0)}_{\text{gradient}} \;\oplus\;
          \underbrace{\ker(L_1)}_{\text{harmonic}} \;\oplus\;
          \underbrace{\operatorname{im}(\delta_2)}_{\text{curl}}
$$

with `ker(L₁) ≅ H¹` (first cohomology) and `dim ker(L₁) = b₁` (the first Betti
number). Read on the substrate's flow:

- **gradient** = flow derivable from a global shape-potential — a consistent
  value function; credit that comes from somewhere and goes somewhere.
- **curl** = *local* circulation around a filled activity-triangle — a local
  triangular inconsistency (`A→B→C→A` where the triangle is present).
- **harmonic** = flow that is simultaneously divergence-free and curl-free:
  **globally cyclic but locally acyclic** — circulation around a hole that no
  single triangle reveals. **This is the livelock.**

Two precise consequences:

- An **orphaned shape** (no producer or consumer) is a point of nonzero
  divergence, `B₁ x ≠ 0`, living in the *gradient* component.
- A **global livelock** is the *harmonic* component, distinct from curl; a local
  triangular inconsistency is *curl* only. "Cyclic/harmonic residual" is the
  right name for a global livelock; curl names only a local triangular
  inconsistency. This harmonic-vs-curl distinction is formal.

Which cycles count as curl (local) versus harmonic (global) depends on **which
activity-triangles you fill** — a modeling decision, not an intrinsic fact. The
substrate's choice of 2-skeleton (which composition triangles it materializes)
determines what it can localize.

Sources: [Lim]; [Jiang–Lim–Yao–Ye]; [Schaub et al.].

### 1.5 The typed-shape gate is lattice-theoretic, not linear

One honesty correction the linear Hodge story glosses. The applicability
predicate `input_shapes ⊆ available_shapes` is **order-theoretic (set
containment), not linear**. Linear cellular-sheaf cohomology ([Hansen & Ghrist
2019]) supplies the right *vocabulary* — `H⁰` = globally-consistent states, `H¹`
= obstruction-to-gluing — but the *faithful algebra* for a containment predicate
is the **Tarski Laplacian on lattice sheaves** ([Ghrist & Riess]), where a
global section is a fixed point rather than a kernel element.

Practical rule: **split the layer by stalk type.**

- **Vector stalks** — impulse embeddings, costs, Beta posteriors → linear sheaf
  / Hodge Laplacian. The `⋆`, `L`, `H¹` story of §1.3–§1.4 applies directly.
- **Availability sets** — the typed-shape gating predicate → lattice sheaf /
  Tarski Laplacian. Here `H¹` is the right *intuition* but the wrong *algebra*;
  consistency propagates by a fixed-point/diffusion semantics, not an exact
  sequence.

Do not conflate them. The linear apparatus carries the learning/credit layer;
the lattice apparatus carries the gating layer.

These two layers are not independent: the shape lattice stratifies the linear
geometry, and a **direction that is normal (unreachable) at a fine stratum
becomes tangent (reachable) at a coarser subset-stratum** on a subset of the
shapes — so the lattice gate (Tarski) and the credit decomposition (Hodge) are
coupled, not merely adjacent. This normal-at-fine = tangent-at-coarse coupling is
the formal content of scope-escalation / partial-pooling as livelock-escape; its
full treatment, including why the toplessness of the stratification makes it both
the non-constructibility limit and the engine of progress, is
`SUBSTRATE_AS_REPRESENTATION.md` §3.

## 2. The design principles, in DEC

| Principle | DEC object |
|---|---|
| Impulses are universal data | k-cochains; **shape = which cell, content = stalk value** |
| Metadata first, content later | **lazy stalk evaluation** — orientation/incidence known before the stalk is resolved |
| Activities constrain search | hyperedges; `applicable(s)` = coboundary support at the current 0-cochain — **the sparse dictionary vs. the free module** |
| Resolvers live where data lives | restriction maps are **local per-incidence**; `L` is a *sparse local operator* → message passing, no central resolver |
| Record everything | each trace = one **sampled value of the flow 1-cochain** on its edges |
| Learn from traces | posterior update = **natural gradient refining `⋆`** (the metric is the learned precision) |
| Reserve improvisation | the drafter = **active complex growth**: add cells/hyperedges at Beta(1,1) = uninformed `⋆` weight |
| Reuse before minting | route flow onto an **existing** producing hyperedge instead of minting a duplicate — sharpens that edge's `⋆₁` and adds an incidence that raises `λ₁`, vs. a new Beta(1,1) cell that raises `ρ_grow`. Helps both sides of `λ₁ ≳ ρ_grow` (§4.4); mint only for a true gap (no producer) or variant-first repair |
| LLMs are tools, not controllers | a model = **one restriction map / one high-coherence dictionary atom**; its `⋆₁` weight (trust) is learned + validated per-signature |
| Backend = store + learner, not universal resolver | backend holds the empirical cochain and estimates `⋆`; it is **not** the coboundary operator `d` |
| Orthogonality is the moat | **block-diagonal `⋆`** → `L` decouples → local, cheap, parallel updates |

Two of these carry most of the weight:

**"Resolvers live where data lives" is the sparsity of `L`.** The Hodge
Laplacian couples only incident cells, so every update is a local message-pass
costing `O(edges)` per step, not `O(cells²)`. This — not any clever algorithm —
is what makes the system scale. Centralizing resolution would densify `L` and
destroy locality. "Don't centralize resolution" is, in DEC, "keep `L` sparse."

**"Orthogonality is the moat" is block-diagonality of `⋆`.** The
shape × signature × tier × scope factorization is exactly the statement that
`⋆` — and hence `L` — is block-diagonal across those blocks. Per-block sample
complexity is `O(1/ε²)`; flatten any axis and `L` gains off-diagonal coupling,
pushing it to `O(|history|/ε²)`. The moat is literally the sparsity pattern of
the metric.

This is the **separability** pole of a **capacity↔separability trade**, not a
free win. A frozen-dimension representation that superposes — packing many
near-orthogonal, interfering features into a space too small to hold them
orthogonally — buys exponential quasi-orthogonal packing (`~exp(d)` directions
in `d` dimensions) and super-linear *computation through interference*; the
substrate's block-diagonal `⋆` forgoes both in exchange for non-interfering,
cleanly-transferable axes, paying `ρ_grow` (and the master-inequality constraint
`λ₁ ≳ ρ_grow`, §4.4) for the dimensions superposition would otherwise share.
It is a deliberate bet — separability over density — coherent because the
substrate values clean grounding and clean transfer over raw representational
density, not a dominance claim. The full treatment of the trade and its
quantified bound is `SUBSTRATE_AS_REPRESENTATION.md` §5.1.

This also states cleanly that **models are resolvers, not alternatives**: a
transformer or embedding model is **one restriction map** — a high-coherence
dictionary atom (high coherence because its outputs overlap many shapes). Its
`⋆₁` weight is the substrate's *learned trust* in it per signature. The model's
failure modes enter the trace store but are quarantined by the validation
back-half and the forward arm rather than inherited — the substrate holds the
model at arm's length and learns the empirical boundary of where it can be
trusted.

## 3. The three states, in DEC

- **Informational (vessel)** — the complex's *topology and metric*: cells,
  incidences, restriction maps, and the learned `⋆`. Durable structure.
- **Transient (becoming)** — *flow on the complex*: the heat/diffusion
  `e^{−tL}`, the cochain in motion, credit propagating.
- **Observational (instance)** — a *realized cochain*: a completed trace is a
  1-chain with concrete stalk values, which immediately folds into the empirical
  `⋆` for the next flow. **Which way it folds is decided by the goal-reaching
  gate**: the gate tests whether the realized chain actually
  closes onto the goal 0-cochain — whether the produced shapes contain the goal's
  `completion_shapes` — and a chain that *terminated* but did not *reach* folds as
  a β (failure) sample on its edges, not an α. Without that test, a hollow
  chain (one ending in a generic summary cell rather than the goal cell) would
  fold as success and corrupt `⋆` — the structural form of the reward-poisoning
  `SUBSTRATE_AS_MDP.md` §12.6 guards against. See `SUBSTRATE_AS_SOFTWARE.md` §3.2.

"The transient state is the steady state" gets a sharp reading in §4: because
the complex itself grows (`L = L(t)`), the system never reaches the harmonic
steady state of a *fixed* `L`. It tracks the *moving* harmonic subspace — and it
can only track it while the spectral gap outpaces growth (§4.4). The dual reading
— slow-manifold tracking under two-timescale stochastic approximation, "walking
the manifold, not a fixed point" — is `SUBSTRATE_AS_DYNAMICS.md` §2.

## 4. Convergence, scaling, and self-optimization rates — and their bottlenecks

This is the analytical payoff. Each rate is governed by a DEC quantity, and each
bottleneck is a *named, measurable parameter*. The structural value of the lens
is that each term, when it goes to zero, is a distinct failure mode the lens
predicts and names.

### 4.1 Convergence rate (posterior/value over the existing complex)

$$
R_{\text{conv}} \;\sim\;
\underbrace{\lambda_1(L)}_{\text{mixing}} \;\cdot\;
\underbrace{\rho_{\text{sample}}}_{\text{throughput}} \;\cdot\;
\underbrace{\kappa(\star)^{-1}}_{\text{conditioning}}
$$

- **`λ₁(L)` — the spectral gap of the Hodge Laplacian.** Heat flow `e^{−tL}`
  mixes at rate `λ₁`; credit propagates across the complex no faster than this.
  A small gap means **bottleneck edges in the shape DAG** (a low Cheeger
  constant — a poorly-connected capability graph). *Topological bottleneck.*
- **`ρ_sample` — per-cell sample arrival rate.** Throughput. It collapses when
  dispatch is serialized — when reading the trace store blocks every dispatch,
  `ρ → 0`. The horizontal-dispatch lever raises `ρ` by `√k`. *Throughput
  bottleneck.*
- **`κ(⋆)` — condition number of the metric.** A degenerate `⋆` (all weights
  equal) is a *flat metric* = no gradient: every template pinned at the same
  posterior mean, uniform allocation, no signal to select on. Wildly
  heterogeneous precisions give ill-conditioned natural-gradient steps. *Metric
  bottleneck.* A graded-information-yield reward is, in this language,
  **restoring a non-degenerate `⋆`.**

**Coarsening is a write path on the metric: the signature-cluster
posterior.** Signatures are embedded and clustered by a background job on the
trace store, and the cluster is a
**coarse cell whose 1-cochain accumulates the flows of its fibers**: every leaf
`(signature, template)` posterior delta is write-through-applied to the shared
cluster cell, and a cold leaf (fewer than 5 observations) reads the
coarse cell's `⋆₁` weight instead of the uninformed Beta(1,1). **Contamination
is the disqualification of a coarse cell whose fibers disagree**: when member
success rates spread by more than 0.4 the cluster is excluded from both the
write and the read — the coarsening map is trusted only where the fibration is
approximately flat. In the rate language of this section this is a `ρ_sample`
lever for cold cells, and it shrinks the frontier of uninformed cells that
`ρ_grow` mints (§4.4): coarse cells let new leaves enter the complex already
partially informed. The learning-rule reading of the same mechanism (the
coarsening write and the partial-pooling read) is `SUBSTRATE_AS_MDP.md` §4.2.

### 4.2 Scaling rate (coverage as vessels glue in)

Governed by the **interface rank `r`** (how many shared shapes the new vessel
bonds on) and the **`H¹` obstruction**:

- `r = 0` → an isolated subcomplex: adds cells but no reachability (an unclosed
  *bridge horizon* — divergence in the gradient component).
- `H¹ ≠ 0` after gluing → the peers were each locally consistent but disagree on
  the interface = **posterior poisoning**; net-negative capacity if verification
  lags. A two-sided (counterparty-signed) trace is the *precondition*, not
  polish — it keeps the glued `⋆` from corruption. The literature is, if
  anything, stronger than "can be net negative": a single Byzantine peer breaks
  standard federated-bandit aggregation outright; recovery needs
  median-of-means-style defenses and a <50% malicious bound ([Demirel et al.]).
- **Heaps' law** (`V ~ N^β`, `β ≈ 0.5`): novel-signature coverage grows
  sublinearly — the coverage term saturates, and any "~N peers" figure for
  diminishing returns is illustrative, holding only under peer homogeneity.
  *Coverage bottleneck.*
- **Coordination overhead** per attested gluing grows ~linearly in vessel count
  without aggregate signatures. *Verification bottleneck.*

### 4.3 Self-optimization rate (the complex curating itself)

The drafter + detectors + promote/prune form a **pipeline**: detect critical
cells → select the highest-value gap → author a cell → exercise (sample) →
promote/prune (update `⋆`) → propagate (diffuse credit). By Liebig's law the
rate is set by the *scarcest* stage:

$$
R_{\text{self}} \;\approx\;
\Big(\min_{\text{stage}} r_{\text{stage}}\Big)\;\cdot\;
\lambda_1(L)\;\cdot\;\kappa(\star)^{-1}
$$

Because the rate is a `min` over stages, each stage has a distinct starvation
mode: when that stage's term goes to zero the whole rate does, regardless of the
others. The DEC observable for each stage tells you *which* is scarce at a given time:

| Stage | DEC observable | Detector / mechanism | Failure mode (when this stage starves) |
|---|---|---|---|
| detect | Morse critical-cell coverage; fraction of horizons found | discrete Morse theory ([Forman]) | the detector cannot find missing structure → horizons go unseen |
| select | is selection the steepest residual-reduction-per-cost direction? | natural-gradient acquisition | value-blind selection samples the wrong cell → no residual reduction |
| author | drafter valid-emit rate | drafter | the drafter emits invalid cells → no candidate enters the pipeline |
| exercise | `ρ_sample` | dispatch throughput | serialized dispatch starves sampling → `ρ → 0` |
| promote/prune | `⋆`-update / auto-promote latency | absorption loop | absorption stalls → outcomes never reach `⋆` |
| propagate | `λ₁(L)` | chain credit | broken chain-credit → ancestors mis-credited, `λ₁` term wasted |

The framing predicts the next bottleneck is whichever stage's observable is
smallest at a given time, and names the quantity to measure for each.

**Detection, made rigorous.** "Where is structure missing or changing" reduces
to **which cells are critical** in the discrete gradient field induced by the
value/credit function ([Forman]). Critical 0-cells ↔ components / sources /
sinks; critical 1-cells ↔ loop generators; critical 2-cells ↔ voids. A *change*
in the critical-cell set is a change in homotopy type — a non-heuristic "a
horizon opened here." (Minimizing the number of critical cells is NP-hard, but
any valid discrete gradient field yields a correct critical set; you do not need
the optimum.)

**"Converged vs. chasing noise," made rigorous.** Track persistence diagrams of
the complex over a sliding time-window; the **bottleneck-stability theorem**
([Cohen-Steiner et al.]) bounds diagram movement by the input perturbation, so
features that persist are genuine and features that jitter near the diagonal are
noise. `d_B → 0` across windows ⇒ the learned topology has converged; persistent
nonzero `d_B` ⇒ still chasing noise. This is a stronger observable than a bare
"spectral drift of `(P, R)`," and it comes with a stability guarantee.

### 4.4 The master inequality: coherent growth requires mixing to outpace growth

Because the complex grows (`L = L(t)`), credit diffusion races cell creation.
Coherent growth requires:

$$
\boxed{\ \lambda_1\big(L(t)\big) \;\gtrsim\; \rho_{\text{grow}}\ }
$$

where `ρ_grow` is the rate of new uninformed (Beta(1,1)) cells minted by vessels
+ the drafter. **If the complex grows faster than credit diffuses across it, the
frontier of uninformed cells expands faster than it converges** — the system
accumulates un-mixed capacity: it looks busy, it is not learning. The DEC
signature is the harmonic component `ker L₁` filling up (global circulation with
no productive gradient) — i.e. livelock.

The actionable corollary: **drafting or vessel-spawning without raising
throughput is self-defeating.** A throughput, selection, or metric fix
(`λ₁`, `ρ_sample`, `κ(⋆)`) raises the achievable rate; "draft more" alone moves
the system toward the bifurcation. It also gives "the transient state is the
steady state" its precise form: the system tracks the moving harmonic subspace of
`L(t)`, and can only track it while `λ₁ ≳ ρ_grow`; past that threshold it falls
off the slow manifold — which is the timescale-separation / Fenichel picture of
`SUBSTRATE_AS_DYNAMICS.md`, now with an explicit threshold on the gap.

(Status: this inequality is a *conjecture assembled from established pieces* —
Hodge heat-flow mixing at rate `λ₁` is standard; the growth term and the
threshold are a reasonable synthesis, not a proved bound. See §5. The
dynamical-systems reading — why the threshold is hard to promote to a theorem,
namely that minting a cell is a dimension-changing event outside classical
geometric singular perturbation theory — is `SUBSTRATE_AS_DYNAMICS.md` §3.)

### 4.5 What DEC sharpens about the federation contradiction

The open federation tension — `√N` acceleration for *shared* signatures needs
cross-cell *correlation*, while the cheap factorized regret bound needs
*independence* — gets its crispest statement here.

In DEC, **independence is block-diagonal `⋆`**; the `√N` speedup lives in
**shared harmonic modes across blocks**, i.e. in the *off-block-diagonal
coupling* of `L` that the tractability argument assumes away.

> Federation accelerates exactly on the interface modes — the off-diagonal
> couplings — and those are precisely the entries the block-diagonal "moat"
> deletes for tractability.

You get `√N` only on the shared-interface harmonic subspace; on each peer's
private (block-diagonal) modes you get nothing and pay full per-cell `O(1/ε²)`.
This is not a paradox to resolve but a *quantity to measure*: the spectral rank
of the interface coupling tells you how much of the federation is genuinely
shared versus private. (This is the same non-stationarity/heterogeneity problem
the multi-agent-RL literature names as central, not vanishing; the
federated-bandit `√(KT/N)` speedup holds only under homogeneous peers + a
communication protocol.)

## 5. Scorecard — established vs frontier

**Established (citable formal results back the claim):**

- Discrete Hodge star = diagonal weight matrix; DEC needs no Riemannian
  structure. → §1.3 ([Bell & Hirani]; [Desbrun et al.])
- `L₀` = graph Laplacian, `L₁` = graph Helmholtzian; `C¹` = gradient ⊕ harmonic
  ⊕ curl, `ker L₁ ≅ H¹`. → §1.4 ([Lim]; [Jiang–Lim–Yao–Ye])
- Orphaned shape = divergence (gradient component); livelock = harmonic
  component, distinct from curl. → §1.4
- Activity = directed/chemical hyperedge with catalyst roles. → §0.1 ([Jost &
  Mulas])
- Credit propagation = heat flow / resolvent of the Hodge Laplacian;
  `(L+εI)⁻¹` = discounted infinite-horizon propagation. → §3, §4.1 ([Lim])
- Gap/horizon detection = discrete Morse critical cells. → §4.3 ([Forman])
- Converged-vs-noise = persistence + bottleneck stability. → §4.3
  ([Cohen-Steiner et al.])
- Federation gluing obstruction = `H¹` via Mayer–Vietoris over cellular sheaves.
  → §0.3 ([Hansen & Ghrist 2019])
- Natural gradient = Fisher–Rao steepest descent; Beta conjugate update is a
  natural-parameter step. → §0, §2 ([Amari])
- The typed-shape gate is order-theoretic; the faithful operator is the Tarski
  Laplacian on lattice sheaves. → §1.5 ([Ghrist & Riess])

**Frontier (operating without formal guarantees — flag, do not assert):**

- **`⋆₁` = Beta posterior precision** *exactly*. A linearized design choice. The
  general information-geometry ↔ Hodge bridge is published ([Kobayashi et al.]
  derive an IG-generalized Helmholtz–Hodge decomposition tied to natural
  gradient / mirror descent), but the IG metric there is generally non-diagonal
  and flow-dependent; a clean diagonal `⋆₁` is the linearized regime, not an
  equality. → §0, §1.3
- **The master inequality `λ₁(L(t)) ≳ ρ_grow`.** Predictive and well-motivated,
  but a conjecture, not a theorem. → §4.4
- **`R_self = min-of-stages`.** Operational (Liebig's law), not a derived bound.
  → §4.3
- **Lattice-sheaf gating in a live learning loop.** The Tarski Laplacian is an
  established object; its use as the gating operator *coupled to* a linear-sheaf
  credit layer is novel here. → §1.5
- **Directed-hypergraph sheaves** (directed + multi-arity + sheaf, the exact
  object the substrate wants) are active research ([Mule et al.]; [Duta et al.]),
  not settled theory. → §0.1

**Honest limit-statement (carried):**

- The informational state remains non-constructible; a better resolver or a
  richer complex does not constitute a constructive completion. DEC changes the
  *representation* of the partiality (which cells/modes are uninformed), not the
  Gödel-shaped limit itself. The representation lens reads the same limit as the
  topless stratification of the shape lattice — `SUBSTRATE_AS_REPRESENTATION.md`
  §3.

### Absorbable mechanisms — what the world already offers

Several of the frontier items do not have to be built from scratch: published
tooling already computes the relevant quantity. Each of these enters the
substrate through an **existing primitive** — a resolver, a detector activity, a
hygiene activity, or a retrieval refinement — never as a new tier or a new
algebra. For each: what it offers toward the aspirations above, how it enters,
and what it does *not* solve.

- **Sheaf / hypergraph neural networks** ([Duta et al.]; [Mule et al.]).
  *Offers:* learned restriction-map estimators for **implicit vessels** —
  boundary entities (the operator, a peer substrate, an embedded model) whose
  restriction maps are latent and must be inferred from boundary behavior
  (§0.2). *Enters as:* one more resolver; its per-signature trust is a `⋆₁`
  weight learned exactly like any other model's — the estimator is itself held
  at arm's length by the validation back-half. *Does not solve:* it estimates
  the maps; it does not become the gating algebra. The lattice-sheaf gating
  layer (§1.5) stays order-theoretic regardless of how the linear-layer maps
  are estimated.
- **Persistent-homology tooling** ([Cohen-Steiner et al.]). *Offers:* the
  converged-vs-chasing-noise test of §4.3 as a computation, with a stability
  guarantee (bottleneck distance bounded by input perturbation). *Enters as:* a
  detector activity running over the trace store on a sliding window, emitting
  horizon/stability impulses that the select stage of the §4.3 pipeline
  consumes. *Does not solve:* it tells you *whether* the learned topology has
  stabilized, not *what* to author when it has not.
- **Spectral sparsification** ([Spielman & Teng]). *Offers:* prune redundant
  edges while preserving `λ₁` within `(1±ε)` — the principled form of registry
  hygiene/dedup, keeping the complex sparse (the §2 cost lever) without
  degrading credit mixing (§4.4). *Enters as:* a hygiene activity at the prune
  chokepoint of the §4.3 pipeline. *Does not solve:* it identifies which edges
  are *spectrally* redundant, not which *semantic* duplicates to collapse —
  the reuse-before-mint judgment stays with the mint/prune chokepoints.
- **Graph ANN indexes (HNSW-family)** ([Malkov & Yashunin]). *Offers:*
  sublinear dense retrieval for the recommend/priming paths — a direct
  `ρ_sample` lever where candidate retrieval is the serialized step (§4.1).
  *Enters as:* a refinement of the retrieval resolver feeding selection. *Does
  not solve:* it accelerates the *inputs* to selection; the posterior math —
  Thompson sampling against `⋆` — is unchanged.
- **Discrete Morse tooling** ([Forman]). *Offers:* critical-cell computation as
  the formal core of gap/horizon detection — any valid discrete gradient field
  yields a correct critical set without solving the NP-hard minimization
  (§4.3). *Enters as:* the detect stage of the §4.3 pipeline. *Does not solve:*
  criticality flags *where* structure is missing or changing; valuing and
  closing the gap remain the select and author stages.

## 6. Recap

The substrate is a weighted directed cell complex (a chemical hypergraph
carrying cellular-sheaf data). Shapes are 0-cells; activities are hyperedges;
trace counts are the 1-cochain flow; the learned content is the Hodge star `⋆`
(posterior precision). A vessel is a subcomplex; explicit vs implicit is whether
its restriction maps are given or inferred; federation is subcomplex gluing with
an `H¹` obstruction — one operation at every scale, not three.

The design principles read off as discrete-geometric facts: *resolvers live
where data lives* is the sparsity of `L`; *orthogonality is the moat* is the
block-diagonality of `⋆` — the separability pole of a capacity↔separability trade
(`SUBSTRATE_AS_REPRESENTATION.md` §5.1); *activities constrain search* is the
sparse dictionary versus the free module; *LLMs are tools* is "a model is one
restriction map with a learned trust weight."

Convergence is `λ₁(L) · ρ_sample · κ(⋆)⁻¹`; scaling is gated by interface rank
and `H¹`; self-optimization is the scarcest pipeline stage; and all three are
bound by the master inequality `λ₁(L(t)) ≳ ρ_grow` — coherent growth requires
credit to mix faster than cells are minted. Every rate-limiter — trace-store
serialization (`ρ_sample`), a flat reward metric (`κ(⋆)`), value-blind selection
(wrong natural-gradient direction), broken chain-credit (`λ₁`) — is one of these
terms going to zero. The lens does not just describe the system; it predicts
where the next bottleneck will be and names the quantity to measure for it.

None of these are renames of new machinery. They are the same trace store, the
same Thompson layer, the same composition chain, the same shape lattice, the
same vessel-and-federation growth — read as one discrete Laplacian.

## References

- **[Jost & Mulas]** Jost, J. & Mulas, R., *Hypergraph Laplace Operators for Chemical Reaction Networks*, Advances in Mathematics 351, 2019; arXiv:1804.01474. https://arxiv.org/abs/1804.01474 — *verification: carried.*
- **[Hajij et al.]** Hajij, M. et al., *Topological Deep Learning: Going Beyond Graph Data*, arXiv:2206.00606, 2022. https://arxiv.org/abs/2206.00606 — *verification: carried.*
- **[Bell & Hirani]** Bell, N. & Hirani, A., *PyDEC: Software and Algorithms for Discretization of Exterior Calculus*, ACM TOMS, 2012; arXiv:1103.3076. https://arxiv.org/abs/1103.3076 — *verification: carried.*
- **[Desbrun et al.]** Desbrun, M., Hirani, A., Leok, M. & Marsden, J., *Discrete Exterior Calculus*, arXiv:math/0508341, 2005. https://arxiv.org/abs/math/0508341 — *verification: carried.*
- **[Lim]** Lim, L.-H., *Hodge Laplacians on Graphs*, SIAM Review 62(3), 2020; arXiv:1507.05379. https://arxiv.org/abs/1507.05379 — *verification: carried.*
- **[Jiang–Lim–Yao–Ye]** Jiang, X., Lim, L.-H., Yao, Y. & Ye, Y., *Statistical Ranking and Combinatorial Hodge Theory*, Mathematical Programming 127, 2011; arXiv:0811.1067. https://arxiv.org/abs/0811.1067 — *verification: carried.*
- **[Schaub et al.]** Schaub, M. et al., *Signal Processing on Higher-Order Networks: Hodge Laplacians and Beyond*, arXiv:2101.05510, 2021. https://arxiv.org/abs/2101.05510 — *verification: carried.*
- **[Forman]** Forman, R., *Morse Theory for Cell Complexes*, Advances in Mathematics 134, 1998. https://doi.org/10.1006/aima.1997.1650 — *verification: carried.*
- **[Cohen-Steiner et al.]** Cohen-Steiner, D., Edelsbrunner, H. & Harer, J., *Stability of Persistence Diagrams*, Discrete & Computational Geometry 37, 2007. https://doi.org/10.1007/s00454-006-1276-5 — *verification: carried.*
- **[Hansen & Ghrist 2019]** Hansen, J. & Ghrist, R., *Toward a Spectral Theory of Cellular Sheaves*, J. Applied & Computational Topology 3, 2019; arXiv:1808.01513. https://arxiv.org/abs/1808.01513 — *verification: verified.*
- **[Ghrist & Riess]** Ghrist, R. & Riess, H., *Cellular Sheaves of Lattices and the Tarski Laplacian*, Homology, Homotopy and Applications, 2022; arXiv:2007.04099. https://arxiv.org/abs/2007.04099 — *verification: verified.*
- **[Riess & Ghrist]** Riess, H. & Ghrist, R., *Applied Sheaf Theory for Multi-agent AI Systems: A Prospectus*, 2025; arXiv:2504.17700. https://arxiv.org/abs/2504.17700 — *verification: verified.*
- **[Mule et al.]** Mule, et al., *Directional Sheaf Hypergraph Networks*, 2025; arXiv:2510.04727. https://arxiv.org/abs/2510.04727 — *verification: verified.*
- **[Duta et al.]** Duta, I. et al., *Sheaf Hypergraph Networks*, NeurIPS 2023; arXiv:2309.17116. https://arxiv.org/abs/2309.17116 — *verification: verified.*
- **[Kobayashi et al.]** Kobayashi, T. et al., *Information Geometry of Dynamics on Graphs and Hypergraphs*, arXiv:2211.14455, 2022. https://arxiv.org/abs/2211.14455 — *verification: carried.*
- **[Amari]** Amari, S., *Natural Gradient Works Efficiently in Learning*, Neural Computation 10(2), 1998. https://doi.org/10.1162/089976698300017746 — *verification: carried.*
- **[Demirel et al.]** Demirel, I. et al., *Federated Multi-armed Bandits Under Byzantine Attacks*, 2025; arXiv:2205.04134. https://arxiv.org/abs/2205.04134 — *verification: carried.*
- **[Spielman & Teng]** Spielman, D. & Teng, S.-H., *Spectral Sparsification of Graphs*, SIAM Journal on Computing 40(4), 2011; arXiv:0808.4134. https://arxiv.org/abs/0808.4134 — *verification: carried.*
- **[Malkov & Yashunin]** Malkov, Y. & Yashunin, D., *Efficient and Robust Approximate Nearest Neighbor Search Using Hierarchical Navigable Small World Graphs*, IEEE TPAMI 42(4), 2020; arXiv:1603.09320. https://arxiv.org/abs/1603.09320 — *verification: carried.*
