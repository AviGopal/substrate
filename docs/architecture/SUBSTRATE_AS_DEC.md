# The substrate is a weighted cell complex under discrete exterior calculus

> Companion to [`SUBSTRATE_AS_MDP.md`](SUBSTRATE_AS_MDP.md). Where that document
> reads the substrate in reinforcement-learning notation (factored-MDP Bayesian
> Q-learning), this one reads the *same running system* in discrete exterior
> calculus (DEC) and combinatorial Hodge theory. It introduces **no new
> primitives**. Every quantity below is something the substrate already computes
> or stores; the contribution is to name the trace store, the Thompson layer, the
> composition chain, the shape lattice, and vessel/federation growth as one
> object — a **weighted directed cell complex** carrying cellular-sheaf data — so
> that convergence, scaling, and self-optimization rates read off as spectral
> properties of a single discrete Laplacian.
>
> **One object, four lenses.** This is the *structure* chart. The MDP doc is the
> *learning-rule* chart; [`SUBSTRATE_AS_DYNAMICS.md`](SUBSTRATE_AS_DYNAMICS.md) is
> the *flow-in-time* chart, which takes the spectral master inequality of §4.4 and
> reads it as a normal-hyperbolicity / stability threshold for runtime growth; and
> [`SUBSTRATE_AS_SOFTWARE.md`](SUBSTRATE_AS_SOFTWARE.md) is the *engineering* chart,
> reading the system as software sorted by durability. The dictionary mapping each
> quantity across the charts is `SUBSTRATE_AS_DYNAMICS.md` §0. Two later companions
> take the durability lens across the container line:
> [`SUBSTRATE_AS_FLEET.md`](SUBSTRATE_AS_FLEET.md) (durability across a multi-container
> fleet — what may cross the boundary) and
> [`SUBSTRATE_AS_NETWORK.md`](SUBSTRATE_AS_NETWORK.md) (the protocol/engineering layer
> that realizes the crossings). The sparsity-of-`L` argument of §2 is what FLEET §3
> invokes to forbid a dense global posterior merge across substrates.
>
> The MDP doc disowns continuous/Riemannian structure (`SUBSTRATE_AS_MDP.md`
> §8.3) and already leans on combinatorial Hodge theory (§8.4). This document is
> the load-bearing version of that lean. The reconciliation it depends on — that
> a Hodge star is a *diagonal matrix of weights*, not a continuous metric — is
> stated and cited in §1.3.

## 0. One operation: a vessel is a subcomplex

The substrate is a single discrete object. Read it as a **weighted directed
cell complex** — more precisely a directed/chemical hypergraph carrying
cellular-sheaf data on its cells.

| Substrate primitive | DEC object | Where it lives |
|---|---|---|
| shape | 0-cell | shape DAG, `discover-by-shapes` |
| impulse pool at a state | 0-cochain (stalk data on present 0-cells) | input impulses of a trace |
| activity (`{in_shapes} → {out_shapes}`) | directed/chemical hyperedge | `activity_template`, `applicable(s)` |
| trace count / credit on an edge | 1-cochain (edge flow) | `activity_execution_traces` |
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
published formalism is the **chemical hypergraph** of Jost & Mulas (*Hypergraph
Laplace Operators for Chemical Reaction Networks*, Advances in Mathematics 351,
2019; arXiv:1804.01474): each hyperedge is a reaction; vertices carry input,
output, or both (catalyst) roles; the Laplace operator computes differences
between input and output vertices. This is an almost-exact structural match to
"activity = `{input_shapes} → {output_shapes}`," with **catalyst = a shape that
is required-but-preserved** (consumed and reproduced).

Caveat (honest): a *simplicial* complex requires downward closure (every face
of a present cell is present) and symmetry. Activities satisfy neither — an
activity does not imply that all sub-tuples of its inputs are also activities,
and it is directed. So the honest combinatorial substrate is a
**directed/chemical hypergraph** or a general **combinatorial complex** (Hajij
et al., *Topological Deep Learning: Going Beyond Graph Data*, arXiv:2206.00606,
2022), not a simplicial complex. The Hodge-Laplacian machinery still applies
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
the monotone-capacity property of `SUBSTRATE_AS_MDP.md` §8.2, now read as
"extend `⋆` by zero-information on the new cells."

The substrate's **explicit/implicit vessel** distinction is, in DEC, the
question *are the restriction maps part of the data, or recovered from the
boundary?*

- An **explicit vessel** is a subcomplex glued in with *attested restriction
  maps* — discovery-registered incidences, declared resolver contracts. The
  gluing maps are handed to you.
- An **implicit vessel** is a subcomplex whose cells and flows are *observed*
  but whose restriction maps are *latent* — inferred from boundary behavior, not
  declared. The operator-as-vessel (sole producer of `goalIntent`; see the
  operator-vessel card) is implicit. A peer substrate known only through
  behavioral-continuation replay is implicit: you observe its boundary behavior
  and infer its internal maps.

This recovers the federation trust tier of `SUBSTRATE_AS_MDP.md` §9.1
(`local-verified` / `peer-attested` / `unattested`) as a *geometric* statement
about whether the restriction maps are given or reconstructed.

### 0.3 Federation is vessel addition, not a separate scale

The MDP doc's §7/§8/§9 ladder — within-dispatch, within-substrate,
cross-substrate — is one operation seen three times. In DEC there is only one
scale: **the complex and its subcomplexes.** Gluing any subcomplex (a resolver,
a vessel, or a whole peer substrate) is the **pushout / colimit of cell
complexes**, and the obstruction to coherent gluing is always the same
cohomological object: **H¹ of the union**, with the Mayer–Vietoris connecting
map `∂` measuring whether two locally-consistent pieces agree on their shared
interface.

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
`⋆`, the same Laplacian, the same `H¹`. The §8.7 "three scales" table of the
MDP doc collapses to a single row: *glue a subcomplex; the obstruction is `H¹`;
the rate is set by the spectral gap (§3).*

Sources: Hansen & Ghrist, *Toward a Spectral Theory of Cellular Sheaves*, J.
Applied & Computational Topology, 2019 (arXiv:1808.01513); Ghrist, *Elementary
Applied Topology*, 2014; Riess & Ghrist, *Applied Sheaf Theory for Multi-Agent
AI Systems: A Prospectus*, arXiv:2504.17700, 2025. (Provenance caveat: the
1808.01513 sign/orientation conventions and the 2504.17700 framing were read
through summarizers during research; verify against the primary PDFs before
treating any exact formula here as canonical.)

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

This is the crux for reconciling DEC with the MDP doc's disowning of Riemannian
structure. In DEC the Hodge star `⋆_k` is realized as a (typically **diagonal**)
inner-product / mass matrix on `k`-cochains — a choice of **weights**, not a
continuous metric. With circumcentric duality the entries are ratios of dual to
primal cell measure; combinatorially they are simply per-cell positive weights.
There is **no continuous manifold and no Riemannian structure** anywhere in the
construction.

Therefore the substrate may use the entire Hodge apparatus while remaining a
purely discrete object on the cells — exactly the stance of
`SUBSTRATE_AS_MDP.md` §8.3. The weights are the learned content: set `⋆₁` on an
edge to that edge's posterior precision.

Sources: Bell & Hirani, *PyDEC: Software and Algorithms for Discretization of
Exterior Calculus*, arXiv:1103.3076, 2011; Kazhdan, DEC lecture notes (JHU);
Desbrun, Hirani, Leok & Marsden, *Discrete Exterior Calculus*, arXiv:math/0508341,
2005.

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

Two precise consequences the MDP doc asserts but does not derive:

- An **orphaned shape** (no producer or consumer) is a point of nonzero
  divergence, `B₁ x ≠ 0`, living in the *gradient* component. (`SUBSTRATE_AS_MDP.md`
  §8.4 horizon class 1.)
- A **global livelock** is the *harmonic* component, distinct from curl; a local
  triangular inconsistency is *curl* only. The MDP doc's parenthetical at §8.4
  ("use 'cyclic/harmonic residual' for global livelock; curl is local
  triangular inconsistency only") is exactly the harmonic-vs-curl distinction,
  now formal.

Which cycles count as curl (local) versus harmonic (global) depends on **which
activity-triangles you fill** — a modeling decision, not an intrinsic fact. The
substrate's choice of 2-skeleton (which composition triangles it materializes)
determines what it can localize.

Sources: Lim, *Hodge Laplacians on Graphs*, SIAM Review 2020 (arXiv:1507.05379);
Jiang, Lim, Yao & Ye, *Statistical Ranking and Combinatorial Hodge Theory*,
Math. Programming 2011 (arXiv:0811.1067); Schaub et al., *Signal Processing on
Higher-Order Networks*, arXiv:2101.05510, 2021.

### 1.5 The typed-shape gate is lattice-theoretic, not linear

One honesty correction the linear Hodge story glosses. The applicability
predicate `input_shapes ⊆ available_shapes` is **order-theoretic (set
containment), not linear**. Linear cellular-sheaf cohomology (Hansen & Ghrist
2019) supplies the right *vocabulary* — `H⁰` = globally-consistent states, `H¹`
= obstruction-to-gluing — but the *faithful algebra* for a containment predicate
is the **Tarski Laplacian on lattice sheaves** (Ghrist et al., *Cellular Sheaves
of Lattices and the Tarski Laplacian*, arXiv:2007.04099, 2020), where a global
section is a fixed point rather than a kernel element.

Practical rule: **split the layer by stalk type.**

- **Vector stalks** — impulse embeddings, costs, Beta posteriors → linear sheaf
  / Hodge Laplacian. The `⋆`, `L`, `H¹` story of §1.3–§1.4 applies directly.
- **Availability sets** — the typed-shape gating predicate → lattice sheaf /
  Tarski Laplacian. Here `H¹` is the right *intuition* but the wrong *algebra*;
  consistency propagates by a fixed-point/diffusion semantics, not an exact
  sequence.

Do not conflate them. The linear apparatus carries the learning/credit layer;
the lattice apparatus carries the gating layer.

## 2. The design principles, in DEC

| Principle (CLAUDE.md) | DEC object |
|---|---|
| Impulses are universal data | k-cochains; **shape = which cell, content = stalk value** |
| Metadata first, content later | **lazy stalk evaluation** — orientation/incidence known before the stalk is resolved |
| Activities constrain search | hyperedges; `applicable(s)` = coboundary support at the current 0-cochain — **the sparse dictionary vs. the free module** |
| Resolvers live where data lives | restriction maps are **local per-incidence**; `L` is a *sparse local operator* → message passing, no central resolver |
| Record everything | each trace = one **sampled value of the flow 1-cochain** on its edges |
| Learn from traces | posterior update = **natural gradient refining `⋆`** (the metric is the learned precision) |
| Reserve improvisation | the drafter = **active complex growth**: add cells/hyperedges at Beta(1,1) = uninformed `⋆` weight |
| LLMs are tools, not controllers | a model = **one restriction map / one high-coherence dictionary atom**; its `⋆₁` weight (trust) is learned + validated per-signature |
| Backend = store + learner, not universal resolver | backend holds the empirical cochain and estimates `⋆`; it is **not** the coboundary operator `d` |
| Orthogonality is the moat | **block-diagonal `⋆`** → `L` decouples → local, cheap, parallel updates |

Two of these carry most of the weight:

**"Resolvers live where data lives" is the sparsity of `L`.** The Hodge
Laplacian couples only incident cells, so every update is a local message-pass
costing `O(edges)` per step, not `O(cells²)`. This — not any clever algorithm —
is what makes the system scale. Centralizing resolution would densify `L` and
destroy locality. "Don't centralize resolution" is, in DEC, "keep `L` sparse."

**"Orthogonality is the moat" is block-diagonality of `⋆`.** The MDP doc's §4
factorization (shape × signature × tier × scope) is exactly the statement that
`⋆` — and hence `L` — is block-diagonal across those blocks. Per-block sample
complexity is `O(1/ε²)`; flatten any axis and `L` gains off-diagonal coupling,
pushing it to `O(|history|/ε²)`. The moat is literally the sparsity pattern of
the metric.

This also re-states `SUBSTRATE_AS_MDP.md` §12.8 ("models are resolvers, not
alternatives") cleanly: a transformer or embedding model is **one restriction
map** — a high-coherence dictionary atom (high coherence because its outputs
overlap many shapes; cf. §4.2 and the OMP-coherence caveat in the MDP doc
§12.3). Its `⋆₁` weight is the substrate's *learned trust* in it per signature.
The model's failure modes enter the trace store but are quarantined by the
validation back-half and the forward arm rather than inherited — the substrate
holds the model at arm's length and learns the empirical boundary of where it
can be trusted.

## 3. The three states, in DEC

- **Instructional (vessel)** — the complex's *topology*: cells, incidences,
  restriction maps. Static structure.
- **Transient (becoming)** — *flow on the complex*: the heat/diffusion
  `e^{−tL}`, the cochain in motion, credit propagating.
- **Functional (instance)** — a *realized cochain*: a completed trace is a
  1-chain with concrete stalk values, which immediately folds into the empirical
  `⋆` for the next flow.

"The transient state is the steady state" gets a sharp reading in §4: because
the complex itself grows (`L = L(t)`), the system never reaches the harmonic
steady state of a *fixed* `L`. It tracks the *moving* harmonic subspace — and it
can only track it while the spectral gap outpaces growth (§4.4). The dual reading
— slow-manifold tracking under two-timescale stochastic approximation, "walking
the manifold, not a fixed point" — is `SUBSTRATE_AS_DYNAMICS.md` §2.

## 4. Convergence, scaling, and self-optimization rates — and their bottlenecks

This is the analytical payoff. Each rate is governed by a DEC quantity, and each
bottleneck is a *named, measurable parameter*. They line up exactly with the
rate-limiters the substrate has hit empirically — which is the strongest
evidence the lens is the right one.

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
  dispatch is serialized — the **trace-store-bloat rate-limiter**
  (`/execution-traces` GET blocking every dispatch drives `ρ → 0`). The
  horizontal-dispatch lever of `SUBSTRATE_AS_MDP.md` §7 raises `ρ` by `√k`.
  *Throughput bottleneck.*
- **`κ(⋆)` — condition number of the metric.** A degenerate `⋆` (all weights
  equal) is a *flat metric* = no gradient = the **reward-saturation
  rate-limiter** (every template pinned at mean 1.0, uniform allocation). Wildly
  heterogeneous precisions give ill-conditioned natural-gradient steps. *Metric
  bottleneck.* The graded-information-yield reward fix was, in this language,
  **restoring a non-degenerate `⋆`.**

### 4.2 Scaling rate (coverage as vessels glue in)

Governed by the **interface rank `r`** (how many shared shapes the new vessel
bonds on) and the **`H¹` obstruction**:

- `r = 0` → an isolated subcomplex: adds cells but no reachability (an unclosed
  *bridge horizon* — divergence in the gradient component).
- `H¹ ≠ 0` after gluing → the peers were each locally consistent but disagree on
  the interface = **posterior poisoning**; net-negative capacity if verification
  lags. Validation integrity (the two-sided trace, `SUBSTRATE_AS_MDP.md` §12.6)
  is the *precondition*, not polish — it keeps the glued `⋆` from corruption.
  The literature is, if anything, stronger than "can be net negative": a single
  Byzantine peer breaks standard federated-bandit aggregation outright; recovery
  needs median-of-means-style defenses and a <50% malicious bound (Demirel et
  al., *Federated Multi-armed Bandits Under Byzantine Attacks*, 2025).
- **Heaps' law** (`V ~ N^β`, `β ≈ 0.5`): novel-signature coverage grows
  sublinearly — the coverage term saturates (the MDP doc's "~10 peers" figure is
  illustrative, not a bound, and holds only under peer homogeneity). *Coverage
  bottleneck.*
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

This is the substrate's lived experience — fix one rate-limiter, the next
surfaces. The DEC observable for each stage tells you *which* is currently
scarce:

| Stage | DEC observable | Detector / mechanism | Empirical rate-limiter hit |
|---|---|---|---|
| detect | Morse critical-cell coverage; fraction of horizons found | discrete Morse theory (Forman 1998) | detector-authoring recursion |
| select | is selection the steepest residual-reduction-per-cost direction? | natural-gradient acquisition | value-directed picker (was value-blind) |
| author | drafter valid-emit rate | drafter | drafter emit-path fixes |
| exercise | `ρ_sample` | dispatch throughput | trace-store bloat |
| promote/prune | `⋆`-update / auto-promote latency | absorption loop | absorption-loop close |
| propagate | `λ₁(L)` | chain credit | F-V56/F-V57 chain-credit fixes |

Every logged win is a `min`-stage fix. The framing predicts the next bottleneck
is whichever stage's observable is currently smallest, and names the quantity to
measure for each.

**Detection, made rigorous.** "Where is structure missing or changing" reduces
to **which cells are critical** in the discrete gradient field induced by the
value/credit function (Forman, *Morse Theory for Cell Complexes*, Advances in
Mathematics 134, 1998). Critical 0-cells ↔ components / sources / sinks;
critical 1-cells ↔ loop generators; critical 2-cells ↔ voids. A *change* in the
critical-cell set is a change in homotopy type — a non-heuristic "a horizon
opened here." (Minimizing the number of critical cells is NP-hard, but any valid
discrete gradient field yields a correct critical set; you do not need the
optimum.)

**"Converged vs. chasing noise," made rigorous.** Track persistence diagrams of
the complex over a sliding time-window; the **bottleneck-stability theorem**
(Cohen-Steiner, Edelsbrunner & Harer, *Stability of Persistence Diagrams*, 2007)
bounds diagram movement by the input perturbation, so features that persist are
genuine and features that jitter near the diagonal are noise. `d_B → 0` across
windows ⇒ the learned topology has converged; persistent nonzero `d_B` ⇒ still
chasing noise. This is a stronger observable than the MDP doc's §9.4 "spectral
drift of `(P, R)`," and it comes with a stability guarantee. (Edelsbrunner &
Harer, *Computational Topology*, 2010; Ghrist, *Barcodes*, BAMS 2008.)

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
throughput is self-defeating.** This is *why* every real win has been a
throughput, selection, or metric fix (`λ₁`, `ρ_sample`, `κ(⋆)`) rather than
"draft more." It also gives "the transient state is the steady state" its
precise form: the system tracks the moving harmonic subspace of `L(t)`, and can
only track it while `λ₁ ≳ ρ_grow`; past that threshold it falls off the slow
manifold — which is the timescale-separation / Fenichel picture of
`SUBSTRATE_AS_MDP.md` §4.6, now with an explicit threshold on the gap.

(Status: this inequality is a *conjecture assembled from established pieces* —
Hodge heat-flow mixing at rate `λ₁` is standard; the growth term and the
threshold are a reasonable synthesis, not a proved bound. See §5. The
dynamical-systems reading — why the threshold is hard to promote to a theorem,
namely that minting a cell is a dimension-changing event outside classical
geometric singular perturbation theory — is `SUBSTRATE_AS_DYNAMICS.md` §3.)

### 4.5 What DEC sharpens about the federation contradiction

The MDP doc's open tension (§12.2) — `√N` acceleration for *shared* signatures
needs cross-cell *correlation*, while the cheap factorized regret bound needs
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
the MARL literature names as central, not vanishing: surveys arXiv:1810.05587,
arXiv:2312.10256; federated-bandit `√(KT/N)` speedup holds only under homogeneous
peers + a communication protocol.)

## 5. Scorecard — established vs frontier

Following the discipline of `SUBSTRATE_AS_MDP.md` §11.

**Established (citable formal results back the claim):**

- Discrete Hodge star = diagonal weight matrix; DEC needs no Riemannian
  structure. → §1.3 (Bell & Hirani 2011; Desbrun et al. 2005)
- `L₀` = graph Laplacian, `L₁` = graph Helmholtzian; `C¹` = gradient ⊕ harmonic
  ⊕ curl, `ker L₁ ≅ H¹`. → §1.4 (Lim 2020; Jiang–Lim–Yao–Ye 2011)
- Orphaned shape = divergence (gradient component); livelock = harmonic
  component, distinct from curl. → §1.4
- Activity = directed/chemical hyperedge with catalyst roles. → §0.1 (Jost &
  Mulas 2019)
- Credit propagation = heat flow / resolvent of the Hodge Laplacian;
  `(L+εI)⁻¹` = discounted infinite-horizon propagation. → §3, §4.1 (Lim 2020)
- Gap/horizon detection = discrete Morse critical cells. → §4.3 (Forman 1998;
  Mischaikow & Nanda 2013)
- Converged-vs-noise = persistence + bottleneck stability. → §4.3
  (Cohen-Steiner–Edelsbrunner–Harer 2007)
- Federation gluing obstruction = `H¹` via Mayer–Vietoris over cellular sheaves.
  → §0.3 (Hansen & Ghrist 2019)
- Natural gradient = Fisher–Rao steepest descent; Beta conjugate update is a
  natural-parameter step. → §0, §2 (Amari; Nielsen 2020; carries
  `SUBSTRATE_AS_MDP.md` §2.1)
- The typed-shape gate is order-theoretic; the faithful operator is the Tarski
  Laplacian on lattice sheaves. → §1.5 (Ghrist et al. 2020)

**Frontier (operating without formal guarantees — flag, do not assert):**

- **`⋆₁` = Beta posterior precision** *exactly*. A linearized design choice. The
  general information-geometry ↔ Hodge bridge is published (Kobayashi et al.,
  *Information Geometry of Dynamics on Graphs and Hypergraphs*, arXiv:2211.14455,
  2022, derive an IG-generalized Helmholtz–Hodge decomposition tied to natural
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
  object the substrate wants) are 2025-era research (e.g. *Directional Sheaf
  Hypergraph Networks*, arXiv:2510.04727), not settled theory. → §0.1

**Honest limit-statement (carried from the MDP doc):**

- The informational state remains non-constructible; a better resolver or a
  richer complex does not constitute a constructive completion. DEC changes the
  *representation* of the partiality (which cells/modes are uninformed), not the
  Gödel-shaped limit itself. → `SUBSTRATE_AS_MDP.md` §11, §12.8

## 6. Recap

The substrate is a weighted directed cell complex (a chemical hypergraph
carrying cellular-sheaf data). Shapes are 0-cells; activities are hyperedges;
trace counts are the 1-cochain flow; the learned content is the Hodge star `⋆`
(posterior precision). A vessel is a subcomplex; explicit vs implicit is whether
its restriction maps are given or inferred; federation is subcomplex gluing with
an `H¹` obstruction — one operation at every scale, not three.

The design principles read off as discrete-geometric facts: *resolvers live
where data lives* is the sparsity of `L`; *orthogonality is the moat* is the
block-diagonality of `⋆`; *activities constrain search* is the sparse dictionary
versus the free module; *LLMs are tools* is "a model is one restriction map with
a learned trust weight."

Convergence is `λ₁(L) · ρ_sample · κ(⋆)⁻¹`; scaling is gated by interface rank
and `H¹`; self-optimization is the scarcest pipeline stage; and all three are
bound by the master inequality `λ₁(L(t)) ≳ ρ_grow` — coherent growth requires
credit to mix faster than cells are minted. Every empirical rate-limiter the
substrate has hit — trace-store bloat (`ρ_sample`), reward saturation (`κ(⋆)`),
value-blind selection (wrong natural-gradient direction), chain-credit bugs
(`λ₁`) — is one of these terms going to zero. The lens does not just describe the
system; it predicts where the next bottleneck will be and names the quantity to
measure for it.

None of these are renames of new machinery. They are the same trace store, the
same Thompson layer, the same composition chain, the same shape lattice, the
same vessel-and-federation growth — read as one discrete Laplacian.
