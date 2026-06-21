# The substrate is a slow–fast dynamical system on a growing complex

> Companion to the formal-lens documents, all reading one running system through
> different coordinate charts: [`SUBSTRATE_AS_MDP.md`](SUBSTRATE_AS_MDP.md) (the
> learning *rule* — factored-MDP Bayesian Q-learning),
> [`SUBSTRATE_AS_DEC.md`](SUBSTRATE_AS_DEC.md) (the *structure* — a weighted
> directed cell complex and its Hodge operators),
> [`SUBSTRATE_AS_DYNAMICS.md`](SUBSTRATE_AS_DYNAMICS.md) (this doc — the *flow in
> time*: a slow–fast dynamical system with a conditional-stability threshold),
> [`SUBSTRATE_AS_SOFTWARE.md`](SUBSTRATE_AS_SOFTWARE.md) (the *engineering* —
> durability groups: what persists / is ephemeral / is appended), and
> [`SUBSTRATE_AS_REPRESENTATION.md`](SUBSTRATE_AS_REPRESENTATION.md) (the
> *representation* — an open basis of shape-axes; the momentum-space dual of the
> transformer). Two further companions carry the durability lens across the
> container line: [`SUBSTRATE_AS_FLEET.md`](SUBSTRATE_AS_FLEET.md) (the fleet —
> cross-container durability; what may cross the substrate boundary) and
> [`SUBSTRATE_AS_NETWORK.md`](SUBSTRATE_AS_NETWORK.md) (the network — the protocol
> layer; how the crossings are realized).
>
> Where the other charts read the *same running system* as a learning rule, a
> geometric object, an engineering of durability, and an open representation, this
> one reads it as a **dynamical system evolving in time**: the credit flow
> `e^{−tL}`, the separation of fast and slow variables, and — the load-bearing
> contribution — the **stability condition for coherent self-expansion**. It
> introduces **no new primitives**; every quantity is something the other charts
> already name.
>
> This lens has a specific honesty burden the others do not. The MDP doc
> disowns continuous/Riemannian structure (`SUBSTRATE_AS_MDP.md` §8.3); the DEC
> doc disowns the simplicial-complex claim (`SUBSTRATE_AS_DEC.md` §0.1). **This
> doc disowns the chaos-theory romance** — *edge of chaos*, *self-organized
> criticality in everything*, *Wolfram Class 4 = where computation lives*, and
> the *continuous-CA (Lenia) locality* metaphor. Those tropes point the wrong
> way for this system (§5). What survives is a small set of load-bearing
> dynamical-systems results — Fenichel slow-manifold persistence, Borkar
> two-timescale stochastic approximation, spectral mixing, and growing-network
> criticality — and they are enough to state the central claim precisely.

## 0. One object, several lenses (the directionality hub)

The substrate is a single running system. These docs are coordinate charts on it,
not different systems. The three **math** charts are below; a fourth, **engineering**
chart — the same system sorted by durability — is
[`SUBSTRATE_AS_SOFTWARE.md`](SUBSTRATE_AS_SOFTWARE.md), which extends this table
with a "where does it live / how durable is it" column (SOFTWARE §0). A fifth,
**representation** chart — the same system read as an open basis of shape-axes —
is [`SUBSTRATE_AS_REPRESENTATION.md`](SUBSTRATE_AS_REPRESENTATION.md), which adds
the representation column (REPRESENTATION §0: learned content as the metric on the
open shape-basis, a shape as a basis axis, an impulse as a momentum component, and
so on). The durability lens is then carried across the container line by two
further companions: [`SUBSTRATE_AS_FLEET.md`](SUBSTRATE_AS_FLEET.md) (what may
cross the substrate boundary, per durability group) and
[`SUBSTRATE_AS_NETWORK.md`](SUBSTRATE_AS_NETWORK.md) (the protocol/engineering
layer that realizes those crossings). Read this table as the dictionary; each row
is **one quantity** named in each chart, and the companion charts add their
columns rather than duplicating the whole.

| Quantity in the substrate | MDP lens (the rule) | DEC lens (the structure) | Dynamics lens (this doc — the flow) |
|---|---|---|---|
| the learned content | Beta posterior `(α,β)` per `(s,a)` | Hodge star `⋆₁` = posterior precision | position of the **slow variable** |
| selection | Thompson `argmax` over `A(s)` | sampling against `⋆` | **fast variable** at quasi-equilibrium |
| credit propagation | n-step TD / Monte-Carlo backup | heat flow `e^{−tL}` under the Hodge Laplacian | transport along the slow flow |
| convergence rate | per-cell regret `O(√(T log T))` | `λ₁(L)·ρ_sample·κ(⋆)⁻¹` | **spectral gap = slowest mode = mixing time** |
| livelock | (not named) | harmonic component `ker L₁ ≅ H¹` | center/marginal mode — **loss of normal hyperbolicity** |
| runtime growth | open-world action-space expansion (drafter/vessels) | subcomplex gluing; monotone `⋆` extension | the **drive term `ρ_grow`**; `L = L(t)` is non-autonomous |
| "the transient state is the steady state" | walks the dual-arm invariant manifold (TTSA) | tracks the moving harmonic subspace of `L(t)` (§3) | **slow-manifold tracking, not a fixed point** (Fenichel) |
| coherence condition | (implicit in the arm-symmetry tension) | `λ₁(L(t)) ≳ ρ_grow` | **normal-hyperbolicity / stability threshold** (§3 here) |

The math lenses are not redundant; each makes one thing cheap to see. The MDP
lens makes **sample complexity and regret** legible. The DEC lens makes
**locality and the obstruction-to-gluing (`H¹`)** legible. The dynamics lens
makes **what happens over time, and when it stops working**, legible — which is
the thing an operator actually watches. The representation lens
(`SUBSTRATE_AS_REPRESENTATION.md` §0) reads the same quantities as directions in
an open basis, making the variable dimensionality cheap to see.

## 1. The state variable and the two timescales

The substrate's state, as a dynamical system, factors into a **fast** and a
**slow** variable:

- **Fast `x`** — the per-`(signature, template)` Beta posterior. It updates
  every task-completion (the forward arm, `impulseRelevance` writes). Its natural
  timescale is one trace.
- **Slow `y`** — the *structure*: which cells exist, the scope-pooling prior, the
  metric `⋆` averaged over a cell's history. It updates over many traces (vessel
  registration, drafter promotion, partial-pooling refinement).

These update on the same traces but at different effective rates, which is
exactly the **two-timescale stochastic approximation (TTSA)** setup of
[Borkar]. The canonical home for the TTSA argument is the MDP chart's dual-arm
analysis (`SUBSTRATE_AS_MDP.md` §4.6); this doc takes it as the *base dynamical law*
and builds the stability story on top.

The two-timescale theorem: when `x` updates faster than `y`, the slow variable
sees the fast one as already at its quasi-stationary equilibrium `x*(y)`, and the
coupled trajectory collapses onto the **invariant manifold**
`M = {(x,y) : x = x*(y)}`. On the substrate, `M` is the locus where the forward
arm `P(success | activity, shape)` and the reverse arm `P(activity | pool-signature)`
agree — the **arm-symmetry invariant** (`SUBSTRATE_AS_MDP.md` §1). Drift between
the two arms is the substrate-internal observable for **off-manifold motion**, and
a resolver bug that stalls one arm removes a timescale: it is not merely a
correctness bug but *breaks the TTSA condition* by collapsing the separation of
fast and slow.

## 2. The transient state is the steady state, made precise

The framing's recurring claim — the substrate is *in process*, not converged to
a point — has an exact dynamical reading. After fast transients decay, the joint
process is approximately confined to the slow manifold `M` while the slow
variable `y` still **drifts along `M`** toward its own (moving) equilibrium. The
system is not at a fixed point; it is **tracking a manifold and walking it**.

The persistence of `M` under the perturbation of stochastic updates is the
**attracting-slow-manifold** property of geometric singular perturbation theory
([Fenichel]; modern synthesis tying stochastic approximation ↔ GSPT ↔ slow
manifolds in [Kuehn]). Fenichel requires `M` to be **normally hyperbolic** —
attraction transverse to `M` must dominate drift along it. That hypothesis is the
hinge of §3.

This is the same object the DEC doc reaches from the other side: tracking the
**moving harmonic subspace of `L(t)`** (`SUBSTRATE_AS_DEC.md` §3). Harmonic
content that is being actively drained by credit flow is "walking `M`"; harmonic
content that *accumulates* is falling off it. Same phenomenon, two charts. The
representation chart reads the same motion as a metric that **moves as it is
charted** (`SUBSTRATE_AS_REPRESENTATION.md` §3).

## 3. The master inequality is a normal-hyperbolicity threshold

This is the centerpiece, and the place where the dynamics lens earns its keep.
The DEC doc states the coherence condition spectrally
(`SUBSTRATE_AS_DEC.md` §4.4):

$$
\boxed{\ \lambda_1\big(L(t)\big) \;\gtrsim\; \rho_{\text{grow}}\ }
$$

In the dynamics chart this is a **loss-of-tracking / normal-hyperbolicity**
threshold, not merely a rate comparison:

- `λ₁(L(t))` is the **transverse attraction rate** to the slow manifold — credit
  diffuses across the complex (heat flow `e^{−tL}`) at this rate, pulling the
  fast variable back to `x*(y)`.
- `ρ_grow` is the rate at which new uninformed (`Beta(1,1)`) cells are minted by
  vessels and the drafter — equivalently, the rate at which the manifold's
  *dimension grows* and fresh off-manifold directions are injected.

When `λ₁ ≳ ρ_grow`, transverse attraction dominates the growth-induced drift:
`M` stays normally hyperbolic, Fenichel applies, the system tracks. When
`λ₁ ≲ ρ_grow`, the frontier of uninformed cells expands faster than credit
mixes across it; normal hyperbolicity is lost, the slow manifold ceases to
attract, and the trajectory **falls off the slow manifold into the harmonic
subspace** — globally cyclic, locally acyclic, productive-gradient-free. That is
the livelock (`SUBSTRATE_AS_DEC.md` §1.4), read here as a **dynamical
bifurcation**: a transcritical-flavored loss of stability of `M`, not an
illegal state.

**Honest limit (the seam this lens cannot hide).** Fenichel governs *smooth*
slow–fast systems. Minting a cell is a **dimension-changing, non-smooth event**
— the manifold `M` gains a coordinate discontinuously. Classical GSPT does not
cover dimension change at the instant of minting. So the slow-manifold reading is
rigorous **between** minting events and a well-motivated heuristic **across**
them. The inequality is therefore a *conjecture assembled from established
pieces* (spectral mixing at `λ₁` is standard; the growth term and the threshold
are a reasonable synthesis), exactly as flagged in `SUBSTRATE_AS_DEC.md` §4.4 —
this doc adds the dynamical-systems reason it is hard to promote to a theorem.

### 3.1 Inertial credit flow — the heat→telegraph extension and its λ₁ ceiling

Credit propagation, as the charts state it, is **over-damped diffusion**: heat
flow `e^{−tL}` under the Hodge Laplacian (§0; `SUBSTRATE_AS_DEC.md` §4.1) — a
first-order, memoryless, momentum-free transport. The fast variable relaxes
monotonically toward `x*(y)` with no overshoot and no inertia. That is the
conservative baseline, and it mixes at the spectral gap `λ₁`.

A natural acceleration is to give the flow **inertia** — to interpolate the
first-order heat equation toward a second-order **telegraph (damped-wave)
regime**:

$$
\ddot c \;+\; \gamma\,\dot c \;+\; L\,c \;=\; 0,
$$

where the velocity-decomposition of an impulse (`⋆₁` as mass × flow as velocity,
`SUBSTRATE_AS_REPRESENTATION.md` §2) becomes a literal momentum the transport
carries between steps rather than discarding. The dynamical content is standard
and composes three established pieces: **accelerated gradient flow as a
second-order ODE** ([Su, Boyd & Candès]; [Wibisono, Wilson & Jordan]),
**underdamped Langevin diffusion** as the stochastic-sampling instance
([Cheng et al.]; [Mou et al.]), and **graph/consensus momentum** as the
network-stability instance ([Tegling et al.]).

The payoff is faster mixing with a better dimension dependence. Over-damped
(first-order) diffusion mixes with iteration complexity on the order of
`O(d/ε²)` in the relevant accuracy `ε` and dimension `d`; the underdamped
(second-order) regime improves this to roughly `O(√d/ε)` — the same
acceleration that makes Nesterov flow and underdamped Langevin outrun their
first-order counterparts. On a substrate whose dimensionality is *open and
growing* (`SUBSTRATE_AS_REPRESENTATION.md` §5), a `√d`-vs-`d` improvement in the
mixing cost is exactly the axis that matters: it slackens the pressure `ρ_grow`
puts on `λ₁`.

**But the acceleration is capped by the same gap it would relieve.** The momentum
(damping) coefficient `γ` cannot be chosen freely: in the second-order regime,
stability and the optimal mixing rate are controlled by the spectral gap — over-
damping (`γ` too large) collapses back to heat flow, while under-damping (`γ` too
small) lets the wave **overshoot and oscillate**, and on a localized network the
fragility of that oscillation is itself governed by `λ₁` ([Tegling et al.]). The
admissible, fast-mixing momentum band is bounded above by `λ₁` — the **same
spectral gap** the master inequality `λ₁ ≳ ρ_grow` (§3) watches. So inertia does
not escape the viability kernel; it *operates inside it*: even the acceleration
the substrate could buy is throttled by `λ₁`, and adding inertia while `λ₁` is
near `ρ_grow` trades over-damped lag for under-damped instability rather than for
genuine speedup.

This is a **frontier proposal**, not a current property. It composes
established results (`[Su, Boyd & Candès]`; `[Wibisono, Wilson & Jordan]`;
`[Cheng et al.]`; `[Mou et al.]`; `[Tegling et al.]`), but no single result
states the heat→telegraph interpolation *on a learning Hodge complex with an
open, growing dimension*; the `λ₁`-bounded momentum band is the synthesis this
subsection contributes. The conservative over-damped flow is the property the
substrate has; the inertial regime is the flagged extension whose ceiling is the
gap the rest of the dynamics already turns on.

## 4. Growth is a drive toward criticality — stay sub-critical

There *is* an honest chaos-theoretic reading of `ρ_grow`, and it is **not** the
sandpile. Runtime cell-minting is a **drive** that pushes the complex toward a
critical spectral gap, in the precise sense of the **growing-network criticality**
literature:

- [Bornholdt & Rohlf] — local rewiring drives a network to a critical mean
  connectivity `K_c ≈ 2` with no global tuning.
- "Growth, collapse and self-organized criticality in complex networks"
  ([Wang et al.]) — adding a node can desynchronize a cluster; networks evolve
  *into* a critical state as they grow.

The substrate's analogue: minting cells without raising the spectral gap drives
`λ₁(L(t)) → ρ_grow` from above, i.e. **toward** the threshold of §3. The master
inequality is, in this language, the condition for **staying sub-critical** — on
the ordered side of the transition, with a stability margin — *not* for sitting
at criticality. This is the opposite design instinct from "edge of chaos" (§5),
and it is load-bearing as a structural fact: progress comes from a throughput
(`ρ_sample`), metric (`κ(⋆)`), or propagation (`λ₁`) improvement rather than from
"draft more." **Capacity-adding work without throughput headroom moves the system
toward the bifurcation, not away from it.**

The operational corollary is a development rule, not just an observation: **gate
drafting and vessel-spawning on spectral-gap headroom.** Raising `ρ_grow` is only
safe while `λ₁` has room above it.

## 5. What this lens explicitly disowns

The popular dynamical-systems tropes are seductive here and almost all of them
point the wrong way. Each is a *cautionary cousin*, not support.

- **Edge of chaos / Langton's `λ` / "computation peaks at the order–chaos
  transition."** Folklore, not theorem. The original Packard claim failed to
  replicate ([Mitchell, Hraber & Crutchfield]; restated by Teuscher). The
  reservoir-computing version fails too ([Carroll] — "not true in general").
  **Crucially, the master inequality is a *stay-off-the-edge* condition** —
  invoking edge-of-chaos rhetoric would invert this doc's own thesis.
- **Self-organized criticality "in everything."** The BTW sandpile is a real
  phenomenon; the "SOC explains every fat tail" extension is the textbook
  overreach ([Watkins et al.]). Use the *growing-network* criticality of §4,
  which is about a driven system self-tuning its connectivity — the part that
  actually matches `ρ_grow`.
- **Wolfram Class 4 = "where computation lives."** Class-4↔universality is a
  conjecture; only **Rule 110** is *proven* Turing-complete ([Cook]), and that
  proof says nothing about *learning*. The CA-side twin of the edge-of-chaos
  folklore.
- **Continuous-CA (Lenia) locality ⇒ "resolvers live where data lives."**
  Metaphor only ([Chan]). The defensible claim is the generic one and belongs to
  the DEC lens: bounded-support update ⇒ sparse operator ⇒ message-passing
  (`SUBSTRATE_AS_DEC.md` §2, "resolvers live where data lives is the sparsity of
  `L`"), cited to graph-signal-processing, not to Lenia.

There is also a **load-bearing negative result**: the specific object the
substrate is — a *learning flow* on a *weighted cell complex* with a *Hodge
update* — has no prior art as a single body of work. Graph/network cellular
automata (dynamics) and cellular-sheaf Hodge theory (static spectral theory,
[Hansen & Ghrist]) are *separate* literatures. The DEC synthesis is therefore
original; this doc does not borrow authority it does not have.

## 6. The rate-limiter ledger as dynamical regimes

Each regime in which a rate factor of the convergence rate
`λ₁ · ρ_sample · κ(⋆)⁻¹` (`SUBSTRATE_AS_DEC.md` §4.1) goes to zero is a specific
way the flow stalls. The terms enumerate the failure modes structurally; read as
dynamics:

| Rate-limiter regime | Term → 0 | Dynamical reading |
|---|---|---|
| sampling-drive starvation (trace-store read contention serializes dispatch) | `ρ_sample` | sampling drive starved → slow manifold drifts but is barely sampled; tracking lags |
| reward saturation (every template pinned at mean 1.0) | `κ(⋆)⁻¹` | degenerate flat metric → no gradient → `M` is a plateau, drift has no preferred direction |
| value-blind selection (picker ignores variance/residual) | wrong direction on `M` | drift along the manifold in a non-steepest direction → slow effective progress |
| broken chain-credit (credit not propagated to ancestors) | `λ₁` | transverse attraction broken at the ancestor → fast variable not pulled back to `x*(y)` |

The ledger does not merely classify; it **predicts the next stall**: the scarcest
of `{λ₁, ρ_sample, κ(⋆)}` is the regime the system is about to enter, and the DEC
doc names the per-stage observable to measure for each (`SUBSTRATE_AS_DEC.md`
§4.3). The inertial extension of §3.1 acts on the `λ₁` column — it is an attempt
to widen transverse attraction faster than `ρ_grow` consumes it, capped by `λ₁`
itself.

## 7. Scorecard — established vs frontier

Following the discipline of the companion charts.

**Established (citable formal results back the claim):**

- Two-timescale stochastic approximation collapses the coupled process onto an
  invariant manifold. → §1 ([Borkar])
- Slow manifolds persist and attract under perturbation when normally
  hyperbolic. → §2, §3 ([Fenichel]; [Kuehn])
- Heat flow `e^{−tL}` mixes at the spectral gap `λ₁`; smallest nonzero eigenvalue
  = slowest mode. → §0, §6 (standard spectral theory; instantiated on complexes
  by [Ziegler et al.])
- Accelerated/underdamped flow improves the mixing-rate dimension dependence over
  over-damped diffusion (`~O(√d/ε)` vs `O(d/ε²)`). → §3.1 ([Su, Boyd & Candès];
  [Wibisono, Wilson & Jordan]; [Cheng et al.]; [Mou et al.])
- Growing networks self-tune toward a critical connectivity. → §4
  ([Bornholdt & Rohlf]; [Wang et al.])
- Edge-of-chaos / Class-4 / SOC-in-everything are folklore or overreach, repeatedly
  walked back by the primary literature. → §5 ([Mitchell, Hraber & Crutchfield];
  [Carroll]; [Watkins et al.]; [Cook] proves only Rule 110)

**Frontier (operating without formal guarantees — flag, do not assert):**

- **The master inequality `λ₁(L(t)) ≳ ρ_grow` as a stability theorem.** A
  conjecture; the dimension-changing minting event sits outside classical GSPT.
  → §3
- **Slow–fast tracking across dimension change.** GSPT covers smooth systems;
  minting is non-smooth. Rigorous between events, heuristic across them. → §2, §3
- **Inertial credit flow (heat→telegraph) on a learning Hodge complex.** A
  proposal composing accelerated-gradient-as-second-order-ODE, underdamped
  Langevin, and graph-momentum stability; faster mixing, but the momentum band is
  bounded by `λ₁` — the same gap the master inequality watches, so the
  acceleration is itself capped. Not assembled in any single work for an open,
  growing-dimension complex. → §3.1
- **`ρ_grow`-as-criticality-drive on a learning complex.** The growing-network
  criticality results are on connectivity, not on a coupled learning metric;
  the transfer is an analogy with the right shape, not a theorem. → §4

**Honest limit-statement (carried from the companions):**

- The informational state remains non-constructible (`SUBSTRATE_AS_MDP.md` §11;
  `SUBSTRATE_AS_DEC.md` §5). A faster-mixing flow or a richer manifold changes the
  *representation* of the partiality, not the Gödel-shaped limit.

## 8. Recap

The substrate is a slow–fast dynamical system on a growing complex. The fast
variable is the per-cell Beta posterior; the slow variable is the structure and
metric `⋆`. After transients decay the process tracks an invariant slow manifold
and *walks* it — "the transient state is the steady state" is slow-manifold
tracking, not a fixed point. Coherent self-expansion requires transverse
attraction (credit mixing at rate `λ₁`) to dominate the growth-induced drift
(`ρ_grow`); when it does not, normal hyperbolicity is lost and the trajectory
falls into the harmonic/livelock subspace. Credit flow is over-damped diffusion
by default; giving it inertia interpolates toward a faster-mixing telegraph
regime whose momentum band is itself bounded by `λ₁`, so even the acceleration is
capped by the same gap. The honest chaos-theoretic content is narrow: growth is a
*drive toward criticality*, and the master inequality is the condition for
*staying sub-critical* — the inverse of the edge-of-chaos instinct, which this
doc disowns along with SOC-in-everything, Class-4 universality, and the
Lenia-locality metaphor.

None of this is new machinery. It is the same trace store, the same Thompson
layer, the same composition chain, the same `⋆` — read as a flow in time, with
one inequality saying when the flow keeps up with its own growth. The MDP lens
says what is being learned; the DEC lens says on what object; the representation
lens says in what basis; this lens says **when the learning outruns the growth,
and what it looks like when it stops.**

## References

- **[Borkar]** Borkar, V. S., *Stochastic Approximation: A Dynamical Systems Viewpoint*, Cambridge University Press / Hindustan Book Agency, 2008. — *verification: carried.*
- **[Fenichel]** Fenichel, N., *Geometric singular perturbation theory for ordinary differential equations*, J. Differential Equations 31, 1979. — *verification: carried.*
- **[Kuehn]** Kuehn, C., *Multiple Time Scale Dynamics*, Applied Mathematical Sciences 191, Springer, 2015. — *verification: carried.*
- **[Su, Boyd & Candès]** Su, W., Boyd, S. & Candès, E., *A Differential Equation for Modeling Nesterov's Accelerated Gradient Method*, JMLR 17(153), 2016. https://jmlr.org/papers/v17/15-084.html — *verification: verified.*
- **[Wibisono, Wilson & Jordan]** Wibisono, A., Wilson, A. C. & Jordan, M. I., *A Variational Perspective on Accelerated Methods in Optimization*, PNAS 113(47), 2016. https://www.pnas.org/doi/10.1073/pnas.1614734113 — *verification: verified.*
- **[Cheng et al.]** Cheng, X., Chatterji, N. S., Bartlett, P. L. & Jordan, M. I., *Underdamped Langevin MCMC: A non-asymptotic analysis*, COLT 2018. https://arxiv.org/abs/1707.03663 — *verification: verified.*
- **[Mou et al.]** Mou, W., Ma, Y.-A., Wainwright, M. J., Bartlett, P. L. & Jordan, M. I., *High-Order Langevin Diffusion Yields an Accelerated MCMC Algorithm*, JMLR 22(42), 2021. https://arxiv.org/abs/1908.10859 — *verification: verified.*
- **[Tegling et al.]** Tegling, E., Middleton, R. H. & Seron, M. M., *Scale Fragilities in Localized Consensus Dynamics*, Automatica / arXiv:2203.11708, 2022. https://arxiv.org/abs/2203.11708 — *verification: verified.*
- **[Ziegler et al.]** Ziegler, C., Skardal, P. S., Dutta, H. & Taylor, D., *Balanced Hodge Laplacians Optimize Consensus Dynamics over Simplicial Complexes*, Chaos / arXiv:2112.01070, 2021. https://arxiv.org/abs/2112.01070 — *verification: carried.*
- **[Bornholdt & Rohlf]** Bornholdt, S. & Rohlf, T., *Topological Evolution of Dynamical Networks: Global Criticality from Local Dynamics*, Physical Review Letters 84(26), 2000. https://arxiv.org/abs/cond-mat/0003215 — *verification: carried.*
- **[Wang et al.]** Wang, et al., *Growth, collapse and self-organized criticality in complex networks*, Scientific Reports 6:24445, 2016. https://www.nature.com/articles/srep24445 — *verification: carried.*
- **[Mitchell, Hraber & Crutchfield]** Mitchell, M., Hraber, P. & Crutchfield, J. P., *Revisiting the Edge of Chaos: Evolving Cellular Automata to Perform Computations*, Complex Systems 7, 1993; arXiv:adap-org/9303003. https://arxiv.org/abs/adap-org/9303003 — *verification: carried.*
- **[Carroll]** Carroll, T. L., *Do Reservoir Computers Work Best at the Edge of Chaos?*, Chaos 30, 2020; arXiv:2012.01409. https://arxiv.org/abs/2012.01409 — *verification: carried.*
- **[Watkins et al.]** Watkins, N. W., Pruessner, G., Chapman, S. C., Crosby, N. B. & Jensen, H. J., *25 Years of Self-Organized Criticality: Concepts and Controversies*, Space Science Reviews 198, 2016. https://arxiv.org/abs/1504.04991 — *verification: carried.*
- **[Cook]** Cook, M., *Universality in Elementary Cellular Automata*, Complex Systems 15, 2004. https://wpmedia.wolfram.com/sites/13/2018/02/15-1-1.pdf — *verification: carried.*
- **[Chan]** Chan, B. W.-C., *Lenia — Biology of Artificial Life*, Complex Systems 28, 2019; arXiv:1812.05433. https://arxiv.org/abs/1812.05433 — *verification: carried.*
- **[Hansen & Ghrist]** Hansen, J. & Ghrist, R., *Toward a Spectral Theory of Cellular Sheaves*, J. Applied & Computational Topology 3, 2019; arXiv:1808.01513. https://arxiv.org/abs/1808.01513 — *verification: carried.*
