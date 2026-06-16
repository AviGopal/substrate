# The substrate is a slow–fast dynamical system on a growing complex

> Third companion to [`SUBSTRATE_AS_MDP.md`](SUBSTRATE_AS_MDP.md) (the learning
> *rule* — factored-MDP Bayesian Q-learning) and
> [`SUBSTRATE_AS_DEC.md`](SUBSTRATE_AS_DEC.md) (the *structure* — a weighted
> directed cell complex and its Hodge operators). Where those read the *same
> running system* as a learning rule and as a geometric object, this one reads it
> as a **dynamical system evolving in time**: the credit flow `e^{−tL}`, the
> separation of fast and slow variables, and — the load-bearing contribution —
> the **stability condition for coherent self-expansion**. It introduces **no new
> primitives**; every quantity is something the other two docs already name.
>
> This lens has a specific honesty burden the other two do not. The MDP doc
> disowns continuous/Riemannian structure (`SUBSTRATE_AS_MDP.md` §8.3); the DEC
> doc disowns the simplicial-complex claim (`SUBSTRATE_AS_DEC.md` §0.1). **This
> doc disowns the chaos-theory romance** — *edge of chaos*, *self-organized
> criticality in everything*, *Wolfram Class 4 = where computation lives*, and
> the *continuous-CA (Lenia) locality* metaphor. Those tropes point the wrong
> way for this system (§5). What survives is a small set of load-bearing
> dynamical-systems results — Fenichel slow-manifold persistence, Borkar
> two-timescale stochastic approximation, spectral mixing, and growing-network
> criticality — and they are enough to state the central claim precisely.

## 0. One object, three lenses (the directionality hub)

The substrate is a single running system. These docs are coordinate charts on it,
not different systems. The three **math** charts are below; a fourth, **engineering**
chart — the same system sorted by durability — is
[`SUBSTRATE_AS_SOFTWARE.md`](SUBSTRATE_AS_SOFTWARE.md), which extends this table
with a "where does it live / how durable is it" column (SOFTWARE §0). Read this
table as the dictionary; each row is **one quantity** named in each chart.

| Quantity in the substrate | MDP lens (the rule) | DEC lens (the structure) | Dynamics lens (this doc — the flow) |
|---|---|---|---|
| the learned content | Beta posterior `(α,β)` per `(s,a)` | Hodge star `⋆₁` = posterior precision | position of the **slow variable** |
| selection | Thompson `argmax` over `A(s)` | sampling against `⋆` | **fast variable** at quasi-equilibrium |
| credit propagation | n-step TD / Monte-Carlo backup | heat flow `e^{−tL}` under the Hodge Laplacian | transport along the slow flow |
| convergence rate | per-cell regret `O(√(T log T))` | `λ₁(L)·ρ_sample·κ(⋆)⁻¹` | **spectral gap = slowest mode = mixing time** |
| livelock | (not named) | harmonic component `ker L₁ ≅ H¹` | center/marginal mode — **loss of normal hyperbolicity** |
| runtime growth | open-world action-space expansion (drafter/vessels) | subcomplex gluing; monotone `⋆` extension | the **drive term `ρ_grow`**; `L = L(t)` is non-autonomous |
| "the transient state is the steady state" | walks the dual-arm invariant manifold (TTSA, §4.6) | tracks the moving harmonic subspace of `L(t)` (§3) | **slow-manifold tracking, not a fixed point** (Fenichel) |
| coherence condition | (implicit in §4.5 tension) | `λ₁(L(t)) ≳ ρ_grow` (§4.4) | **normal-hyperbolicity / stability threshold** (§3 here) |

The three lenses are not redundant; each makes one thing cheap to see. The MDP
lens makes **sample complexity and regret** legible. The DEC lens makes
**locality and the obstruction-to-gluing (`H¹`)** legible. The dynamics lens
makes **what happens over time, and when it stops working**, legible — which is
the thing an operator actually watches.

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
exactly the **two-timescale stochastic approximation (TTSA)** setup of Borkar
(*Stochastic Approximation: A Dynamical Systems Viewpoint*, 2008). The canonical
home for the TTSA argument is `SUBSTRATE_AS_MDP.md` §4.6; this doc takes it as
the *base dynamical law* and builds the stability story on top.

Borkar's theorem: when `x` updates faster than `y`, the slow variable sees the
fast one as already at its quasi-stationary equilibrium `x*(y)`, and the coupled
trajectory collapses onto the **invariant manifold** `M = {(x,y) : x = x*(y)}`.
On the substrate, `M` is the locus where the forward arm
`P(success | activity, shape)` and the reverse arm `P(activity | pool-signature)`
agree — the "symmetry invariant" named in `IMPULSE_ACTIVITY_FOUNDATION.md`. Drift
between the two arms is the substrate-internal observable for **off-manifold
motion**, and a resolver bug that stops one arm updating (e.g. F-39, the missing
`templateId` on validator-dispatch traces) is not merely a correctness bug — it
*breaks the TTSA condition* by removing one timescale.

## 2. The transient state is the steady state, made precise

The framing's recurring claim — the substrate is *in process*, not converged to
a point — has an exact dynamical reading. After fast transients decay, the joint
process is approximately confined to the slow manifold `M` while the slow
variable `y` still **drifts along `M`** toward its own (moving) equilibrium. The
system is not at a fixed point; it is **tracking a manifold and walking it**.

The persistence of `M` under the perturbation of stochastic updates is the
**attracting-slow-manifold** property of geometric singular perturbation theory
(Fenichel, *Geometric singular perturbation theory for ordinary differential
equations*, J. Diff. Eq. 31, 1979; modern synthesis tying SA ↔ GSPT ↔ slow
manifolds in Kuehn, *Multiple Time Scale Dynamics*, 2015). Fenichel requires `M`
to be **normally hyperbolic** — attraction transverse to `M` must dominate drift
along it. That hypothesis is the hinge of §3.

This is the same object the DEC doc reaches from the other side: tracking the
**moving harmonic subspace of `L(t)`** (`SUBSTRATE_AS_DEC.md` §3). Harmonic
content that is being actively drained by credit flow is "walking `M`"; harmonic
content that *accumulates* is falling off it. Same phenomenon, two charts.

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

## 4. Growth is a drive toward criticality — stay sub-critical

There *is* an honest chaos-theoretic reading of `ρ_grow`, and it is **not** the
sandpile. Runtime cell-minting is a **drive** that pushes the complex toward a
critical spectral gap, in the precise sense of the **growing-network criticality**
literature:

- Bornholdt & Rohlf, *Topological Evolution of Dynamical Networks: Global
  Criticality from Local Dynamics*, PRL 84 (2000) — local rewiring drives a
  network to a critical mean connectivity `K_c ≈ 2` with no global tuning.
- "Growth, collapse and self-organized criticality in complex networks," *Sci.
  Rep.* 6:24445 (2016) — adding a node can desynchronize a cluster; networks
  evolve *into* a critical state as they grow.

The substrate's analogue: minting cells without raising the spectral gap drives
`λ₁(L(t)) → ρ_grow` from above, i.e. **toward** the threshold of §3. The master
inequality is, in this language, the condition for **staying sub-critical** — on
the ordered side of the transition, with a stability margin — *not* for sitting
at criticality. This is the opposite design instinct from "edge of chaos" (§5),
and it is load-bearing: it is *why* every real win has been a throughput
(`ρ_sample`), metric (`κ(⋆)`), or propagation (`λ₁`) fix rather than "draft
more." **Capacity-adding work without throughput headroom moves the system
toward the bifurcation, not away from it.**

The operational corollary is a development rule, not just an observation: **gate
drafting and vessel-spawning on spectral-gap headroom.** Raising `ρ_grow` is only
safe while `λ₁` has room above it.

## 5. What this lens explicitly disowns

The popular dynamical-systems tropes are seductive here and almost all of them
point the wrong way. Each is a *cautionary cousin*, not support.

- **Edge of chaos / Langton's `λ` / "computation peaks at the order–chaos
  transition."** Folklore, not theorem. The original Packard claim failed to
  replicate (Mitchell, Hraber & Crutchfield, *Revisiting the Edge of Chaos*,
  Complex Systems 7, 1993, arXiv:adap-org/9303003; Teuscher, *Revisiting the
  Edge of Chaos: Again?*, BioSystems, 2022). The reservoir-computing version
  fails too (Carroll, *Do Reservoir Computers Work Best at the Edge of Chaos?*,
  Chaos, 2020, arXiv:2012.01409 — "not true in general"). **Crucially, the master
  inequality is a *stay-off-the-edge* condition** — invoking edge-of-chaos
  rhetoric would invert this doc's own thesis.
- **Self-organized criticality "in everything."** The BTW sandpile (Bak, Tang &
  Wiesenfeld, PRL 59, 1987) is a real phenomenon; the "SOC explains every fat
  tail" extension is the textbook overreach (Watkins, Pruessner, Chapman,
  Crosby & Jensen, *25 Years of Self-Organized Criticality*, Space Sci. Rev.,
  2016). Use the *growing-network* criticality of §4, which is about a driven
  system self-tuning its connectivity — the part that actually matches `ρ_grow`.
- **Wolfram Class 4 = "where computation lives."** Class-4↔universality is a
  conjecture; only **Rule 110** is *proven* Turing-complete (Cook, *Universality
  in Elementary Cellular Automata*, Complex Systems 15, 2004), and that proof
  says nothing about *learning*. The CA-side twin of the edge-of-chaos folklore.
- **Continuous-CA (Lenia) locality ⇒ "resolvers live where data lives."**
  Metaphor only (Chan, *Lenia*, 2019, arXiv:1812.05433). The defensible claim is
  the generic one and belongs to the DEC lens: bounded-support update ⇒ sparse
  operator ⇒ message-passing (`SUBSTRATE_AS_DEC.md` §2, "resolvers live where
  data lives is the sparsity of `L`"), cited to graph-signal-processing, not to
  Lenia.

There is also a **load-bearing negative result**: the specific object the
substrate is — a *learning flow* on a *weighted cell complex* with a *Hodge
update* — has no prior art as a single body of work. Graph/network cellular
automata (dynamics) and cellular-sheaf Hodge theory (static spectral theory,
Hansen & Ghrist 2019) are *separate* literatures. The DEC synthesis is therefore
original; this doc does not borrow authority it does not have.

## 6. The rate-limiter ledger as dynamical regimes

Every empirical rate-limiter the substrate has hit is one term of the
convergence rate `λ₁ · ρ_sample · κ(⋆)⁻¹` (`SUBSTRATE_AS_DEC.md` §4.1) going to
zero — i.e. a specific way the flow stalls. Read as dynamics:

| Empirical rate-limiter | Term → 0 | Dynamical reading |
|---|---|---|
| trace-store bloat (`/execution-traces` GET serializes dispatch) | `ρ_sample` | sampling drive starved → slow manifold drifts but is barely sampled; tracking lags |
| reward saturation (every template pinned at mean 1.0) | `κ(⋆)⁻¹` | degenerate flat metric → no gradient → `M` is a plateau, drift has no preferred direction |
| value-blind selection (picker ignored variance/residual) | wrong direction on `M` | drift along the manifold in a non-steepest direction → slow effective progress |
| chain-credit bugs (F-V56/F-V57) | `λ₁` | transverse attraction broken at the ancestor → fast variable not pulled back to `x*(y)` |

The framing does not just label the past; it **predicts the next stall**: the
scarcest of `{λ₁, ρ_sample, κ(⋆)}` is the regime the system is about to enter,
and §4.3 of the DEC doc names the per-stage observable to measure for each.

## 7. Scorecard — established vs frontier

Following the discipline of `SUBSTRATE_AS_MDP.md` §11 and
`SUBSTRATE_AS_DEC.md` §5.

**Established (citable formal results back the claim):**

- Two-timescale stochastic approximation collapses the coupled process onto an
  invariant manifold. → §1 (Borkar 2008)
- Slow manifolds persist and attract under perturbation when normally
  hyperbolic. → §2, §3 (Fenichel 1979; Kuehn 2015)
- Heat flow `e^{−tL}` mixes at the spectral gap `λ₁`; smallest nonzero eigenvalue
  = slowest mode. → §0, §6 (standard spectral theory; instantiated on complexes
  by Ziegler et al., *Balanced Hodge Laplacians Optimize Consensus Dynamics over
  Simplicial Complexes*, arXiv:2112.01070, 2021)
- Growing networks self-tune toward a critical connectivity. → §4 (Bornholdt &
  Rohlf 2000; Sci. Rep. 24445, 2016)
- Edge-of-chaos / Class-4 / SOC-in-everything are folklore or overreach, repeatedly
  walked back by the primary literature. → §5 (Mitchell et al. 1993; Carroll
  2020; Watkins et al. 2016; Cook 2004 proves only Rule 110)

**Frontier (operating without formal guarantees — flag, do not assert):**

- **The master inequality `λ₁(L(t)) ≳ ρ_grow` as a stability theorem.** A
  conjecture; the dimension-changing minting event sits outside classical GSPT.
  → §3
- **Slow–fast tracking across dimension change.** GSPT covers smooth systems;
  minting is non-smooth. Rigorous between events, heuristic across them. → §2, §3
- **`ρ_grow`-as-criticality-drive on a learning complex.** The growing-network
  criticality results are on connectivity, not on a coupled learning metric;
  the transfer is an analogy with the right shape, not a theorem. → §4

**Honest limit-statement (carried from both companions):**

- The informational state remains non-constructible (`SUBSTRATE_AS_MDP.md` §11,
  §12.8; `SUBSTRATE_AS_DEC.md` §5). A faster-mixing flow or a richer manifold
  changes the *representation* of the partiality, not the Gödel-shaped limit.

## 8. Recap

The substrate is a slow–fast dynamical system on a growing complex. The fast
variable is the per-cell Beta posterior; the slow variable is the structure and
metric `⋆`. After transients decay the process tracks an invariant slow manifold
and *walks* it — "the transient state is the steady state" is slow-manifold
tracking, not a fixed point. Coherent self-expansion requires transverse
attraction (credit mixing at rate `λ₁`) to dominate the growth-induced drift
(`ρ_grow`); when it does not, normal hyperbolicity is lost and the trajectory
falls into the harmonic/livelock subspace. The honest chaos-theoretic content is
narrow: growth is a *drive toward criticality*, and the master inequality is the
condition for *staying sub-critical* — the inverse of the edge-of-chaos instinct,
which this doc disowns along with SOC-in-everything, Class-4 universality, and
the Lenia-locality metaphor.

None of this is new machinery. It is the same trace store, the same Thompson
layer, the same composition chain, the same `⋆` — read as a flow in time, with
one inequality saying when the flow keeps up with its own growth. The MDP lens
says what is being learned; the DEC lens says on what object; this lens says
**when the learning outruns the growth, and what it looks like when it stops.**
