# The substrate is an open representation: shapes as axes, and the momentum-space dual of the transformer

> Companion to the formal-lens documents, all reading one running system through
> different coordinate charts: [`SUBSTRATE_AS_MDP.md`](SUBSTRATE_AS_MDP.md) (the
> learning *rule* — factored-MDP Bayesian Q-learning), [`SUBSTRATE_AS_DEC.md`](SUBSTRATE_AS_DEC.md)
> (the *structure* — a weighted directed cell complex and its Hodge operators),
> [`SUBSTRATE_AS_DYNAMICS.md`](SUBSTRATE_AS_DYNAMICS.md) (the *flow in time* — a
> slow–fast dynamical system with a conditional-stability threshold), and
> [`SUBSTRATE_AS_SOFTWARE.md`](SUBSTRATE_AS_SOFTWARE.md) (the *engineering* — durability
> groups). Two further companions carry the durability lens across the container line:
> [`SUBSTRATE_AS_FLEET.md`](SUBSTRATE_AS_FLEET.md) (the fleet — what may cross the
> substrate boundary) and [`SUBSTRATE_AS_NETWORK.md`](SUBSTRATE_AS_NETWORK.md) (the
> network — the protocol layer that realizes the crossings).
>
> This is the **representation** chart. Where the math charts ask what is learned, on
> what object, and how it flows, and the engineering chart asks what it is made of, this
> one asks: **as a representation of its world, what is the substrate, and how does it
> differ from the representation a transformer learns?** The answer is a single
> structural claim — the substrate is the **momentum-space dual of a transformer** — and
> a geometry that makes the claim precise: shapes are *axes*, an impulse is a *momentum
> component* along one, reality's unexplained motion is read as *intent*, and the object
> the substrate produces is the *topology of reachable motion* toward a goal rather than a
> sampled point. It introduces **no new primitives**; every quantity is one the other
> charts already name. Its contribution is to read them as directions in an open,
> growing basis, and to state — and bound — the duality with the fixed-basis,
> superposed representation a transformer learns.

## 0. One object, the representation column

The shared "one object, lenses" dictionary is distributed across the charts: the math
columns live in `SUBSTRATE_AS_DYNAMICS.md` §0, the engineering column in
`SUBSTRATE_AS_SOFTWARE.md` §0. This chart adds the **representation column** — the same
quantities read as directions in an open basis of shape-axes.

| Quantity in the substrate | Representation lens (this doc) |
|---|---|
| the learned content | the metric on the open shape-basis — per-axis **directional certainty** |
| selection | choosing a **tangent direction** within `A(s)` |
| a shape | a **basis axis** (direction) in the open representation |
| an impulse | a **momentum component** along a shape-axis (Fisher-mass × flow) — §2 |
| a goal | a target **direction** in the same span as the shape-axes — §1 |
| the state signature | the **local frame** that winnows `A(s)` to the locally-tangent axes — §1 |
| runtime growth | **opening a new dimension** — minting a shape-axis — §5 |
| livelock | a **residual stuck normal** at the current stratum — §3 |
| "the transient state is the steady state" | charting a manifold whose metric **moves as it is charted** — §3 |
| reality's unexplained motion | **intent** = the residual direction (Hodge-decomposed) — §4 |

The representation lens makes one thing cheap to see that the others do not: **the
dimensionality is a variable, not a constant**, and almost everything about the substrate
follows from that single difference from a transformer (§5).

## 1. Shapes are axes; a goal is an axis; the signature is the frame

A shape is a direction. The substrate's learned content lives in the metric `⋆` over a
basis of shapes (`SUBSTRATE_AS_DEC.md` §0); read as a representation, each shape is one
**axis** of that basis, and the impulse pool at a state is a point expressed in those
axes. A **goal** is not a different kind of object: it is a target *direction* `g` in the
same span, and the reward residual `‖g − Π_{span(V_t)} g‖` (`SUBSTRATE_AS_MDP.md` §1.1) is
the portion of that direction the basis-to-date does not yet cover. Shapes-as-axes and
goal-as-axis are one space; learning is the refinement of the basis and its metric, and
selection is the choice of a direction within it.

This is a **system of systems**: each axis can itself be a subsystem with its own
shape-basis, nested by the scope/partial-pooling order (`SUBSTRATE_AS_DEC.md` §0). The
nesting has no top (§3), which is the geometric form of the non-constructibility ceiling
the other charts carry (`SUBSTRATE_AS_MDP.md` §11).

The **state signature** is the **local coordinate frame**. It declares which shape-axes are
available at the current position, and the applicable set
`A(s) = { a : input_shapes(a) ⊆ shapes(s) }` winnows the action space to the directions
that are locally tangent — the formal content of "activities constrain search." A signature
that does not faithfully encode the available axes selects over the wrong action set; the
fidelity of the frame is a precondition for selection to mean anything (the operating
relationships, §7).

The two motions of the becoming (`SUBSTRATE_AS_SOFTWARE.md` §1.1) read here as the two
concerns of a representation: **sharpen known directions** (reduce the directional
uncertainty of the existing axes — the fast variable, the forward-arm precision) and
**find new directions** (mint new axes — the slow variable, structural growth). These are
the fast and slow timescales of `SUBSTRATE_AS_DYNAMICS.md` §1, read as exploitation and
expansion of the basis.

## 2. An impulse is a momentum component

Read dynamically, an impulse is not a static stalk value but a **component of the state's
motion along a shape-axis**. This earns a rigorous form in the Fisher (natural-gradient)
metric. In information geometry the Fisher information is the mass tensor of natural-gradient
flow, and the substrate's `⋆₁` weight on an edge is exactly that posterior precision
(`SUBSTRATE_AS_DEC.md` §1.3, §2). Therefore:

$$
\text{(momentum component along shape } s) \;=\; \underbrace{\star_1(s)}_{\text{precision = mass}} \;\times\; \underbrace{\dot c(s)}_{\text{flow = velocity}}
$$

The datum carries the mass (its learned weight), the flow carries the velocity, and their
product is the momentum component. An activity is then the **force** — the directed
hyperedge that imparts impulse (changes the components) by transforming an input set of
shape-components into an output set.

Two honesty bounds, in the discipline of the companion charts:

- The metric is **diagonal and discrete**, not Riemannian (`SUBSTRATE_AS_DEC.md` §1.3) and
  not a continuous manifold. "Momentum component" is the natural-gradient velocity
  decomposition, *not* a symplectic momentum with a conjugate position. There is no named
  conserved quantity, so the full Hamiltonian apparatus is not earned by this object alone.
- Credit propagation is **over-damped diffusion** (heat flow `e^{−tL}`,
  `SUBSTRATE_AS_DEC.md` §4.1; `SUBSTRATE_AS_DYNAMICS.md` §0): first-order, no inertia. A
  literal second-order momentum is therefore a *proposal* — to interpolate the dynamics
  toward a telegraph/wave regime — whose tradeoff and stability ceiling are stated in
  `SUBSTRATE_AS_DYNAMICS.md` (inertial credit flow). The intuition is rigorous as a velocity
  decomposition; the inertia is a flagged frontier, not a current property.

## 3. The hypersurface and its stratification

An interaction is representable by a hypersurface spanned by the shape-axes that determine
the field at each position — the **shape hypersurface** of `SUBSTRATE_AS_SOFTWARE.md` §4
(the manifold of reachable shape-configurations; the DEC realized-cochain space; the
DYNAMICS slow manifold). The substrate's state sits on it.

Relative to a hypersurface, a resolver's output decomposes into a **tangent** component
(on-manifold; a well-defined, shape-correct direction) and a **normal** component
(off-manifold; high-variance, the "impossible"/ungated direction). This is exactly the
directional-uncertainty reframe of `resolver_tier` (`SUBSTRATE_AS_SOFTWARE.md` §4): a sharp
tangent is the deterministic band, a high-variance normal is the band a model occupies until
its per-signature trust is learned.

The load-bearing structure is the **nesting**. Shapes form a lattice under set-inclusion
(`SUBSTRATE_AS_DEC.md` §1.5), which stratifies the representation into nested hypersurfaces:
a coarser stratum spans a *subset* of the shapes. The central fact:

> A direction that is **normal** (unreachable, "impossible," high directional uncertainty)
> at a **fine** stratum can be **tangent** (reachable, a gradient one can flow along) at a
> **coarser** stratum on a subset of the shapes — and the nesting recurses with no top.

This couples the two layers the structure chart keeps deliberately apart: the **linear
credit layer** (Hodge, where the tangent/normal decomposition lives) and the
**order-theoretic gating layer** (the Tarski Laplacian on lattice sheaves, where the
subset-nesting lives — `SUBSTRATE_AS_DEC.md` §1.5). The coupled object — set-containment
gating coupled to linear credit on a directed hypergraph, inside a learning loop — is named
as the frontier in §8.

The nesting is the representation's account of both the limit and the engine:

- **The limit.** The tower of strata has no top — the "and so on" of the subset-nesting is
  the geometric form of non-constructibility (`SUBSTRATE_AS_MDP.md` §11): no finite chart
  cuts the realizable variety out of the space of all arrangements.
- **The engine.** Because normal-at-fine is tangent-at-coarse, a residual **stuck** in the
  harmonic/normal subspace at a fine per-signature stratum (the livelock of
  `SUBSTRATE_AS_DEC.md` §1.4) becomes a *gradient* one can flow along at a coarser, pooled
  stratum. **Scope-escalation / partial-pooling is therefore livelock-escape**: move a stuck
  direction to a stratum where it is tangent, flow it there, push the result back down as a
  prior. The same toplessness that forbids completion guarantees there is always a coarser
  stratum on which a stuck direction becomes flowable.

One honesty bound: the metric `⋆` is **learned and moving** (`⋆ = ⋆(t)`,
`SUBSTRATE_AS_DYNAMICS.md` §1), so "orthogonal," "tangent," and "normal" are relative to the
current learned metric, and the strata **deform as they are charted**. The clean geometry
holds at a fixed metric; the substrate charts a manifold whose curvature changes under the
charting — which is the representation form of "the transient state is the steady state."

## 4. Intent is the residual

When the substrate observes reality's motion and projects it onto its current basis, the
consistent **unexplained residual** — the part of reality's motion the basis does not
capture — is read, via the intentional stance, as reality's **intent**. The ascription is
*instrumental*, not metaphysical: its value is that it converts "unexplained" into "a target
to be modelled," exactly the surprise-/free-energy-minimization move ([Friston 2006];
[Dennett 1987]).

The residual carries an epistemic-sign asymmetry that distinguishes it from a resolver's
normal component (§3): a *resolver's* normal component is **noise** (it should have stayed
on-manifold), but *reality's* normal component is **signal** — reality is the un-authorable
referent and cannot be wrong, so its off-basis motion means the **basis is incomplete**, not
that reality erred (`SUBSTRATE_AS_SOFTWARE.md` §2, the recorded/observational ground truth).

The residual **Hodge-decomposes** (`SUBSTRATE_AS_DEC.md` §1.4), and the decomposition is the
diagnostic for what perception must do:

- the **in-tangent** part (gradient ⊕ curl) → **recalibrate `⋆`**: the axes exist, their
  weights are wrong;
- the **normal/harmonic** part → **mint a new shape-axis**: a genuinely new direction.

The decomposition is admitted only under a **learnability gate**. Pure residual-chasing is
degenerate: minimizing surprise alone collapses to a featureless, perfectly-predictable
state (the dark-room problem, [Friston 2012]), and raw prediction-error is captured by
*aleatoric* noise (the noisy-TV trap, [Pathak 2017]). The fix is to ascribe intent only to
**persistent, learnable** residual — derivative-of-compression / learning-progress
([Schmidhuber 2010]), not raw error. The instrument that separates structured residual from
jitter is the persistence-/bottleneck-stability test (`SUBSTRATE_AS_DEC.md` §4.3): a
residual that persists across windows is signal; one that jitters near the diagonal is
noise. Minting a shape-axis for an aleatoric residual is the representation form of
metric-gaming — adding structure that does not correspond to a real shared direction — and is
forbidden by the same gate.

## 5. The momentum-space dual of the transformer

The single structural claim of this chart. A transformer and the substrate are duals along a
four-way inversion of where the discreteness, the continuity, and the openness sit.

| | Transformer | Substrate |
|---|---|---|
| **Dimensionality** | **fixed** a priori (`d_model`, vocabulary) | **open**, continuously grown (shape-axes minted; the drive `ρ_grow`) |
| **Internal dynamics** | **continuous** flow in a frozen `ℝᵈ` | **discrete** action steps (directed-hyperedge hops) |
| **Output** | **discrete** token, by autoregressive snapping (softmax/argmax) | **continuous**: the *topology* of reachable on-manifold flows toward a goal |
| **What is learned** | weights mapping a fixed-dim continuous flow | the **directions themselves** and their per-axis certainty |

The transformer commits to a **position** (the next token, a point), snapping a continuous
internal flow to a discrete output in a frozen space. The substrate works in **directions**:
it models the field of how motion can go — a model over the *transition/reachability
structure*, `P(success | direction, action)`, in an open space — rather than a generative
density over points. "Momentum-space dual" is the intuition; the rigorous statement is
**generative-density-over-configurations** (transformer) versus
**model-of-the-reachable-transition-topology** (substrate). The two place the discreteness
and the openness at dual layers: the transformer is continuous-and-frozen in representation,
discrete at the output; the substrate is discrete in action, continuous-and-open in
representation.

"Continuous mapping of the dimensionality" must be read precisely, in the no-continuous-
manifold discipline of `SUBSTRATE_AS_DEC.md` §1.3: the cells are **discrete and countable**,
their **count is unbounded**, and the metric `⋆` over them is **continuous-valued and
continuously refined**. The continuity is in the weights and in the openness of the count,
not in a dimensional continuum.

### 5.1 The mechanism that makes the duality bite: superposition vs the orthogonality moat

Both representations treat features as directions (the linear-representation hypothesis), but
they differ on what to do when features outnumber dimensions:

- A transformer's dimension is **fixed** and its features are not, so it **superposes** —
  packs many near-orthogonal, interfering, polysemantic directions into a space too small to
  hold them orthogonally, recoverable only by sparsity ([Elhage 2022]; SAE de-superposition,
  [Bricken 2023]; [Templeton 2024]).
- The substrate's "orthogonality is the moat" — block-diagonal `⋆` (`SUBSTRATE_AS_DEC.md`
  §2) — is the **refusal to superpose**: when a feature appears it **opens a dimension**
  rather than cramming the feature into the existing space with interference. "Decreasing the
  directional uncertainty of a shape" is, in this light, **de-superposition** — pulling a
  fuzzy interfering direction toward a clean orthogonal axis, the move a frozen-dimension
  model structurally cannot make.

This is a **trade, not a free win**, and the bound is quantified. Superposition is not only
storage but **computation**: a network computes *through* interference, and computation in
superposition is asymptotically more capacity-efficient — on the order of `O(n²/log n)`
features from `n` units, against `O(n)` for one-orthogonal-axis-per-feature ([Adler & Shavit
2024]; [Vaintrob 2024]), with quasi-orthogonal packing affording `~exp(d)` directions in `d`
dimensions against `d` strictly-orthogonal ones. So:

> Block-diagonal `⋆` is the **separability** pole of a **capacity↔separability trade**. It
> forgoes the exponential packing and super-linear compute that interference buys, in
> exchange for non-interfering, cleanly-transferable axes — paying `ρ_grow` (and the
> master-inequality constraint `λ₁ ≳ ρ_grow`, `SUBSTRATE_AS_DYNAMICS.md` §3) for the
> dimensions superposition would otherwise share.

It is a deliberate bet — separability over density — coherent only because the substrate
values clean grounding and clean transfer (transfer along *measured* shared modes, factored
through a grounded mediating concept-axis so the coupling stays sparse rather than dense)
over raw representational density. It is not a dominance claim; a fixed-dimensional
representation pays an interference/polysemanticity cost, and the substrate pays a capacity
cost.

### 5.2 The open basis is established; the inversion is the synthesis

A representation whose basis **grows by inference** is well-grounded: an unbounded array of
features added as data arrive ([Griffiths & Ghahramani 2005]), and its deep-learning
counterparts that expand representational capacity per new task ([Yan 2021]; [Rusu 2016]).
The deliverable — a *topology of reachable transitions toward a goal* rather than a sampled
point — has a direct analog in goal-conditioned reachability learned over a growing network
([Aubret et al.]). What is **not** named in that prior art is the **inversion-as-the-
transformer's-dual**; that framing is the synthesis this chart contributes, and "dual" is the
honest word — fixed-dimensional representations are not provably weaker, only differently
traded.

## 6. Composed, not opposed

The substrate is **not** the pure dual of a transformer; it is the open grounding loop that
**embeds** one. A model (an LLM, an embedding model) enters as **one resolver** — one
restriction map, one high-coherence dictionary atom whose per-signature trust is learned and
validated, held at arm's length (`SUBSTRATE_AS_DEC.md` §2). In representation terms the model
is the **dense, frozen, superposed** engine that supplies cheap **candidate-genesis** — it
can snap to a token for almost anything, a large prior — and the substrate is the **open,
orthogonal** loop that **grounds** those candidates and **extends** its basis toward the
residuals the frozen basis cannot express:

$$
\text{candidate-genesis (model — dense, superposed)} \;\subset\; \text{grounded-genesis (native — open, orthogonal, measured)}
$$

The composition is the reason the architecture works: the frozen-basis oracle cannot be
escaped — its superposed richness is what makes *proposing* a new direction cheap — so it is
internalized, and the open loop chases what it leaves on the table. The composition also
bounds the openness in practice: the basis grows toward intent the substrate can *detect*,
and detection runs through the borrowed prior plus a learnable residual signal — open in
principle, throttled to the union of what reality's residual surfaces and what the borrowed
prior can name.

### 6.1 The same move generalizes: the operator and any peer are modeled boundary entities

§6 holds an LLM "at arm's length" and learns its per-signature trust. That move is **not
special to models** — it is how the substrate represents *any* entity it meets only across a
boundary, the **human operator included**. `SUBSTRATE_AS_DEC.md` §0.2 states it geometrically:
an **explicit vessel** is glued in with *attested* restriction maps (discovery-registered
incidences, declared resolver contracts — the maps are handed to you); an **implicit vessel**
is one whose cells and flows are *observed* but whose restriction maps are **latent — inferred
from boundary behavior, not declared**. The **operator-as-vessel** (the producer of
`goalIntent`) is the canonical implicit vessel; a peer substrate known only through
behavioral-continuation replay is another. The human is therefore a **node in the complex**
whose interior the substrate reconstructs — not an external controller standing outside it.

The capacity to **assess the interaction characteristics across that boundary** is the §6 loop
generalized — one mechanism, four steps, each owned by a companion chart:

1. **Observe → infer the latent map.** What crosses the boundary (a `goalIntent`, a validation
   verdict, a peer's returned trace) is the only evidence; the entity's internal restriction
   map is reconstructed from it, never assumed. (`SUBSTRATE_AS_DEC.md` §0.2)
2. **Score per-signature competence.** Treat the entity as an **untrusted resolver**: the
   validation back-half measures its output against reality, and the forward arm learns a
   per-signature competence map — α climbs where the entity is reliable, β where it fails, and
   selection routes accordingly. The substrate ends up knowing the **empirical boundary of
   where the entity can be trusted**, something the entity need not know about itself.
   (`SUBSTRATE_AS_MDP.md` §12.8)
3. **Weight by attestation tier.** Identity is proven by possession, not assumed; the
   confidence on the entity's signals is its attestation tier, a number in `[0,1]`.
   (`SUBSTRATE_AS_NETWORK.md` §4)
4. **Fold as evidence, never as authority.** The entity's signals enter as counterparty-signed
   *offered-evidence* under a conservative prior — folded into *your* posteriors, never
   imported as owned state. **Trust escalates what an entity may offer, never what it may
   overwrite.** (`SUBSTRATE_AS_FLEET.md` §6)

So **operator ≡ peer ≡ embedded model**: all are implicit vessels, differing only in
attestation tier and in which durability groups they are permitted to influence
(`SUBSTRATE_AS_FLEET.md` §6). This is why the operator can be made **non-load-bearing** without
a rearchitecture — "non-load-bearing" is simply the asymptote of step 2. The substrate's
competence map of the operator sharpens until an operator intervention that contradicts a
grounded posterior is **refused with cited evidence** (the `interventionRefused` / push-away
signal of `SUBSTRATE_AS_FLEET.md` §6), exactly as low-α model output is routed away. The
operator never leaves the topology; the substrate's model of it simply tightens until the
operator's directives carry no more authority than any other peer's offered-evidence.

## 7. The operating relationships

The charts together specify the relationships that must hold for the system to operate —
where *operate* decomposes into three stacked conditions: **run at all** (a dispatch can
happen and mean something), **grow coherently** (expansion does not outrun mixing), and
**stay true** (what is learned tracks reality). The relationships form a dependency stack;
each layer presupposes the one below. Each is stated as a relation with the failure mode that
follows its violation, and cites the chart it belongs to.

**Layer 1 — representation is well-formed (run at all).**
- **Shape ∥ content.** Every impulse is `shape ⊕ content`, shape resolvable before content
  (metadata-first). *Violation:* lazy evaluation collapses. (`SUBSTRATE_AS_DEC.md` §2)
- **Applicability containment.** `A(s) = { a : input_shapes(a) ⊆ shapes(s) }` — the gating
  relation. *Violation:* dispatch with absent inputs. (§1; `SUBSTRATE_AS_DEC.md` §1.5)
- **Producer–consumer closure.** Every load-bearing shape-axis has both a producer and a
  consumer. *Violation:* an orphan axis is a divergence; an inert axis is dead capacity.
  (`SUBSTRATE_AS_DEC.md` §1.4)
- **Content-addressed identity.** Identity of a shape/template/vessel is the hash of its
  canonical form. *Violation:* dedup, merge, and transfer break. (`SUBSTRATE_AS_FLEET.md` §2)

**Layer 2 — the metric is faithful (selection means something).**
- **One number, three names.** `⋆₁(edge)` = forward-arm precision = directional certainty.
  *Violation:* value-blind selection. (§2; `SUBSTRATE_AS_SOFTWARE.md` §4)
- **Block-diagonality, as a chosen trade.** `⋆` stays block-diagonal across
  `shape × signature × tier × scope`; cross-block coupling is admitted only along a measured,
  grounded shared mode, factored through a concept-axis (sparse), never densified.
  *Violation:* entangled factors, posterior poisoning, metric-gaming. (§5.1;
  `SUBSTRATE_AS_DEC.md` §2)
- **Signature = faithful local frame.** *Violation:* selection over the wrong action set.
  (§1)
- **Arm symmetry = on-manifold.** Forward `P(success | a, shape)` and reverse
  `P(a | signature)` agree on the slow manifold. *Violation:* arm-drift is off-manifold
  motion; stalling one arm removes a timescale. (`SUBSTRATE_AS_DYNAMICS.md` §1)

**Layer 3 — the loop closes with the right write-discipline (learning accumulates).**
- **The durability motion.** Recall reads authored + learned → runs ephemeral → writes
  recorded; learning reads recorded → writes learned-durable; nothing in the normal loop
  writes authored-durable. *Violation:* untraced self-rewrite erases the anchor.
  (`SUBSTRATE_AS_SOFTWARE.md` §2)
- **Structure before weights.** A posterior write presupposes a stable key.
  *Violation:* weights indexed to drifting keys. (`SUBSTRATE_AS_FLEET.md` §2)
- **Evidence, not state; grounded write.** Foreign/learned influence enters only as
  two-sided/grounded recorded evidence folded under a conservative prior; a posterior write
  follows a verified trace. *Violation:* importing weights double-counts priors / admits
  unverified poison. (`SUBSTRATE_AS_FLEET.md` §3)
- **Absorption + chain-credit close.** Every recorded outcome is absorbable, and credit
  propagates back along the composition chain. *Violation:* absorption stalls, or ancestors
  are mis-credited. (`SUBSTRATE_AS_DEC.md` §4.3)

**Layer 4 — the dynamics stay viable (growth is coherent in time).**
- **The master inequality `λ₁(L(t)) ≳ ρ_grow`** — the viability kernel that keeps the system
  in the transient state. *Violation:* livelock. (`SUBSTRATE_AS_DYNAMICS.md` §3)
- **Two-timescale separation** — `rate(fast posterior) ≫ rate(slow structure)`.
  *Violation:* manifold-tracking collapses. (`SUBSTRATE_AS_DYNAMICS.md` §1)
- **Growth gated on headroom** — minting (shape / vessel / draft) requires spectral-gap
  headroom. *Violation:* capacity added drives toward the bifurcation.
  (`SUBSTRATE_AS_DYNAMICS.md` §4)

**Layer 5 — grounding holds (what is learned is true, not merely self-consistent).**
- **Shared factorization, self ∥ world (forced).** Reality enters as impulses; the transition
  model `P(s′|s,a)` is the world-model, learned by the same update as the forward arm;
  self-evidence and world-evidence are inseparable in a trace. *Violation:* an ungrounded
  world-model drifts from competence. (`SUBSTRATE_AS_MDP.md` §1)
- **Validity = measurement against the un-authorable (forced).** A candidate is grounded only
  by resolving against reality (the resolver whose `⋆₁ → delta`); measurement substitutes for
  proof. *Violation:* candidate-genesis mistaken for grounded-genesis. (§6;
  `SUBSTRATE_AS_SOFTWARE.md` §4)
- **Intent = learnable residual (gated).** §4's learnability gate. *Violation:* dark-room /
  noisy-TV / metric-gaming. (§4)
- **Composed, not controller.** `candidate-genesis ⊂ grounded-genesis`; the model's trust is
  learned per-signature, never inherited. *Violation:* the controller becomes the ungrounded
  oracle. (§6)

These are **operating** relationships, not **completion** conditions: no combination of them
finishes the informational state (`SUBSTRATE_AS_MDP.md` §11). They keep it running,
accumulating, growing without livelocking, and true, over an object that cannot be completed.
And they are not independent — the master inequality binds the rest in time, constraining how
fast the lower-layer structure may grow relative to how fast credit mixes. The two the whole
set turns on, **viability** (Layer 4) and **grounding** (Layer 5), are dual: viability needs
the structure grounding makes true (one cannot stay sub-critical on un-true structure — that
is metric-gaming), and grounding needs the viability that keeps the system on the manifold.
Persist-by-understanding, understand-by-persisting — which is, in this chart's terms, the
operational definition of remaining in the transient state.

## 8. Scorecard — decision vs. established vs. frontier

Following the discipline of the companion charts.

**Canonical decisions (this chart's authority):**
- Shapes (and goals) are axes of one open basis; the signature is the local frame. → §1
- An impulse is a momentum component in the Fisher metric (`⋆₁` as mass × flow as velocity);
  the inertial extension is a flagged frontier, not a current property. → §2
- The substrate is the momentum-space dual of the transformer: open dimensionality, discrete
  action, continuous reachable-topology output. → §5
- Block-diagonal `⋆` is the separability pole of a capacity↔separability trade, not a free
  win. → §5.1
- Intent = the model-residual under the intentional stance, Hodge-decomposed, learnability-
  gated. → §4
- The substrate composes with rather than opposes the transformer; candidate-genesis ⊂
  grounded-genesis. → §6

**Established (rests on results cited here or by the companions):**
- Features-as-directions; superposition forced by fixed dimension + (features > dimension);
  overcomplete sparse bases de-superpose. → §5.1 ([Elhage 2022]; [Bricken 2023];
  [Templeton 2024])
- Superposition is computation, with a quantified capacity advantage over a one-axis-per-
  feature design. → §5.1 ([Adler & Shavit 2024]; [Vaintrob 2024])
- An open/growing representational basis (infinite latent features; capacity expansion).
  → §5.2 ([Griffiths & Ghahramani 2005]; [Yan 2021]; [Rusu 2016])
- Surprise-/free-energy-minimization as residual-minimization; the intentional stance as
  instrumental; learning-progress curiosity; the dark-room and noisy-TV degeneracies. → §4
  ([Friston 2006; 2012]; [Dennett 1987]; [Schmidhuber 2010]; [Pathak 2017]; [Itti & Baldi
  2009])

**Frontier (named, not asserted):**
- The **inversion-as-the-transformer's-dual** as a stated framing — assembled from
  established pieces (open-dimensional learning; discrete-action models), not named as a
  single body of work. → §5, §5.2
- "**Reality's intent = the model-residual** via the intentional stance, as the engine of
  feature discovery" — a synthesis of established legs ([Friston]; [Dennett]; [Schmidhuber];
  [Itti & Baldi]), not an owned result. → §4
- The **coupled Tarski–Hodge object** — set-containment gating (a Tarski Laplacian on lattice
  sheaves, [Ghrist & Riess]) coupled to linear credit (a Hodge sheaf Laplacian) over a
  **directed hypergraph**, inside a learning loop — is not assembled in any single work; the
  directed-hypergraph sheaf Laplacian ([Mule et al.]) is purely linear, the lattice/Tarski
  layer is order-theoretic and used for consensus, and the reinforcement-learning sheaf
  bridge ([Riess & Ghrist]) is a prospectus. → §3
- A measured runtime **tangent/normal decomposition** of resolver output (vs its implicit
  form in the forward-arm posterior) is described, not computed. → §3 (carries
  `SUBSTRATE_AS_SOFTWARE.md` §5)

**Honest limit (carried):**
- The informational state is non-constructible (`SUBSTRATE_AS_MDP.md` §11). The representation
  lens reads this as the topless stratification (§3): an open, growing basis enlarges the
  charted region but never cuts the realizable variety out of the space of all arrangements.
  More axes are a larger chart, not a complete one.

## 9. Recap

The substrate, as a representation, is an **open basis of shape-axes**: a shape is an axis, a
goal is a target direction in the same span, the signature is the local frame, and an impulse
is a momentum component along an axis in the Fisher metric. Its state sits on a shape
hypersurface stratified by the shape lattice into nested sub-hypersurfaces with no top; a
direction normal at a fine stratum is tangent at a coarser one, which is why scope-escalation
escapes livelock and why the same toplessness is both the non-constructibility limit and the
engine of progress. Reality's unexplained motion is read, instrumentally, as **intent** — the
learnable residual, Hodge-decomposed into recalibrate-the-weights and mint-a-new-axis, gated
against the dark-room/noisy-TV degeneracy.

The structural claim is that this is the **momentum-space dual of a transformer**: where the
transformer fixes its dimensionality, runs a continuous internal flow, and snaps to a
discrete token, the substrate keeps its dimensionality open, takes discrete actions, and
emits the topology of reachable motion toward a goal. The mechanism that makes the duality
bite is **superposition versus the orthogonality moat** — a frozen dimension forces
interfering superposed features; an open dimension lets the substrate de-superpose by adding
orthogonal axes — and it is a **capacity↔separability trade**, not a dominance: the moat buys
clean, transferable axes at the price of the exponential packing and super-linear compute
that interference affords. And the substrate does not oppose the transformer so much as
**wrap** one: a model is a dense, frozen resolver supplying candidate directions, embedded in
the open loop that grounds them against the un-authorable referent and extends the basis
toward what the frozen basis cannot say — candidate-genesis inside grounded-genesis.

None of this is new machinery. It is the same shapes, the same `⋆`, the same forward arm,
the same trace store and Thompson layer — read as directions in an open, growing, deliberately
orthogonal basis, and set against the fixed, superposed basis a transformer learns.

## References

- **[Elhage 2022]** Elhage, N. et al., *Toy Models of Superposition*, Transformer Circuits Thread, 2022. https://transformer-circuits.pub/2022/toy_model/index.html — *verification: verified.*
- **[Bricken 2023]** Bricken, T. et al., *Towards Monosemanticity: Decomposing Language Models with Dictionary Learning*, Anthropic, 2023. https://transformer-circuits.pub/2023/monosemantic-features — *verification: verified.*
- **[Templeton 2024]** Templeton, A. et al., *Scaling Monosemanticity*, Anthropic, 2024. https://transformer-circuits.pub/2024/scaling-monosemanticity/ — *verification: verified.*
- **[Adler & Shavit 2024]** Adler, M. & Shavit, N., *On the Complexity of Neural Computation in Superposition*, 2024. https://arxiv.org/abs/2409.15318 — *verification: verified.*
- **[Vaintrob 2024]** Vaintrob, D. et al., *Mathematical Models of Computation in Superposition*, 2024. https://arxiv.org/abs/2408.05451 — *verification: verified.*
- **[Griffiths & Ghahramani 2005]** Griffiths, T. & Ghahramani, Z., *Infinite Latent Feature Models and the Indian Buffet Process*, NIPS 2005. https://cocosci.princeton.edu/tom/papers/ibpnips.pdf — *verification: verified.*
- **[Yan 2021]** Yan, S. et al., *DER: Dynamically Expandable Representation for Class-Incremental Learning*, CVPR 2021. https://openaccess.thecvf.com/content/CVPR2021/papers/Yan_DER_Dynamically_Expandable_Representation_for_Class_Incremental_Learning_CVPR_2021_paper.pdf — *verification: verified.*
- **[Rusu 2016]** Rusu, A. et al., *Progressive Neural Networks*, 2016. https://arxiv.org/abs/1606.04671 — *verification: verified.*
- **[Aubret et al.]** Aubret, A. et al., *DisTop: Discovering a Topological Representation to Learn Diverse and Rewarding Skills*, arXiv:2106.03853. https://arxiv.org/abs/2106.03853 — *verification: verified.*
- **[Friston 2006]** Friston, K., Kilner, J. & Harrison, L., *A free energy principle for the brain*, J. Physiology-Paris 100, 2006. https://www.fil.ion.ucl.ac.uk/~karl/A%20free%20energy%20principle%20for%20the%20brain.pdf — *verification: verified.*
- **[Friston 2012]** Friston, K. et al., *Free-energy minimization and the dark-room problem*, Frontiers in Psychology 3:130, 2012. https://www.frontiersin.org/articles/10.3389/fpsyg.2012.00130/full — *verification: verified.*
- **[Dennett 1987]** Dennett, D., *The Intentional Stance*, MIT Press, 1987. https://mitpress.mit.edu/9780262540537/the-intentional-stance/ — *verification: verified.*
- **[Schmidhuber 2010]** Schmidhuber, J., *Formal Theory of Creativity, Fun, and Intrinsic Motivation (1990–2010)*, IEEE TAMD 2(3), 2010. https://people.idsia.ch/~juergen/creativity.html — *verification: verified.*
- **[Pathak 2017]** Pathak, D. et al., *Curiosity-driven Exploration by Self-supervised Prediction*, ICML 2017. https://arxiv.org/abs/1705.05363 — *verification: verified.*
- **[Itti & Baldi 2009]** Itti, L. & Baldi, P., *Bayesian surprise attracts human attention*, Vision Research 49(10), 2009. https://pmc.ncbi.nlm.nih.gov/articles/PMC2782645/ — *verification: verified.*
- **[Ghrist & Riess]** Ghrist, R. & Riess, H., *Cellular Sheaves of Lattices and the Tarski Laplacian*, Homology, Homotopy and Applications, 2022; arXiv:2007.04099. https://arxiv.org/abs/2007.04099 — *verification: verified.*
- **[Riess & Ghrist]** Riess, H. & Ghrist, R., *Applied Sheaf Theory for Multi-agent AI Systems: A Prospectus*, 2025; arXiv:2504.17700. https://arxiv.org/abs/2504.17700 — *verification: verified.*
- **[Mule et al.]** Mule, et al., *Directional Sheaf Hypergraph Networks*, 2025; arXiv:2510.04727. https://arxiv.org/abs/2510.04727 — *verification: verified.*
- **[Hansen & Ghrist 2019]** Hansen, J. & Ghrist, R., *Toward a Spectral Theory of Cellular Sheaves*, J. Applied & Computational Topology, 2019; arXiv:1808.01513. https://arxiv.org/abs/1808.01513 — *verification: verified.*
- **[Amari]** Amari, S., *Natural Gradient Works Efficiently in Learning*, Neural Computation 10(2), 1998. — *verification: carried.*
