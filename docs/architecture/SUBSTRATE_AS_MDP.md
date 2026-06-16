# The substrate is a Bayesian Q-learning MDP

> This document derives the math the substrate already implements,
> in standard reinforcement-learning notation. It does **not** introduce
> new primitives. Every quantity below is something the running system
> already computes or stores. The point is to make explicit that the
> trace store + Thompson layer + composition-chain credit + scope
> hierarchy form a single coherent Bayesian RL system whose object of
> learning is the underlying MDP itself.
>
> **One object, four lenses.** This doc is the *learning-rule* chart. The same
> running system is read as a geometric object — a weighted directed cell complex
> and its Hodge operators — in [`SUBSTRATE_AS_DEC.md`](SUBSTRATE_AS_DEC.md); as a
> flow in time — a slow–fast dynamical system whose self-expansion is
> conditionally stable — in [`SUBSTRATE_AS_DYNAMICS.md`](SUBSTRATE_AS_DYNAMICS.md);
> and as software organized by durability — what persists, what is ephemeral, and
> which parts are implementation detail — in
> [`SUBSTRATE_AS_SOFTWARE.md`](SUBSTRATE_AS_SOFTWARE.md). The shared dictionary
> mapping each quantity across the charts is the table in
> `SUBSTRATE_AS_DYNAMICS.md` §0 (math) extended in `SUBSTRATE_AS_SOFTWARE.md` §0
> (engineering). Where this doc makes sample complexity and regret legible, DEC
> makes locality and the gluing obstruction `H¹` legible, the dynamics chart makes
> *when the learning stops keeping up with the growth* legible, and the software
> chart makes *what it is made of and how durable it is* legible.

## 1. The MDP, in the substrate's own primitives

A finite-horizon Markov Decision Process is the tuple **(S, A, P, R, γ)**.
Mapped to the substrate:

| MDP element | Substrate primitive | Where it lives |
|---|---|---|
| **S** (state space) | `state_signature` ⊕ available-impulse-shape multiset | computed server-side in `execution-traces.ts` from a trace's input impulses |
| **A(s)** (actions) | `applicable(s) = { template t : input_shapes(t) ⊆ shapes(s) }` | `/v2/activities/discover-by-shapes` already returns this set |
| **P(s′ \| s, a)** (transitions) | empirical distribution of `output_impulse_shapes` grouped by `(signature, template)` | rows of `activity_execution_traces` |
| **R(s, a) ∈ ℝᵈ** (vector reward) | projection residual `‖g − proj_{span(traces)} g‖` where g is the goal direction and traces are observed work vectors; the binary success bit currently written is the degenerate scalarization | `convergent-validity` produces the scalar projection today; vector residual is the structural form, currently collapsed at write-time. See §1.1 |
| **γ** (discount) | implicit 1 along `composition_chain` | `propagateCreditAlongChain` writes |
| **π(a \| s)** (policy) | Thompson sample-and-argmax over applicable a | template selector in `/v2/activities/recommend` |

Every column on the right is a thing the substrate already does at runtime.
No new machinery is introduced.

### 1.1 Why vector reward, not scalar

The binary R column above is a deliberate scalarization, not the
structural form. The MDP this substrate is solving is multi-objective:
every goal is a direction `g` in some space of outcomes, and the work
the substrate has done is a basis spanned by trace vectors `V_t`.
The structural reward is the residual

$$
r_t = \| g - \Pi_{\text{span}(V_t)}\, g \|
$$

the portion of the goal direction the work to date has not yet covered.
The Beta-Bernoulli α/β update remains a valid projection of this signal
onto a success axis; the substrate today writes only that projection.
The directional residual is recoverable from existing trace metadata
once a goal direction is supplied — it is structural form, currently
collapsed at write-time.

Vamplew et al. (*Scalar reward is not enough*) motivate the move to
vector reward: a single scalar reward is insufficient to express
genuinely multi-objective goals. The Pareto-coverage limitation invoked
here — linear scalarization of a vector reward recovers only policies on
the **convex hull** of the Pareto front; non-convex regions are
unreachable by any scalar reward — is the load-bearing theorem. (The
convex-hull-coverage limitation is originally Das & Dennis 1997, 'A
closer look at drawbacks of minimizing weighted sums of objectives…',
Structural Optimization; carried into MORL by Roijers et al. 2013, 'A
Survey of Multi-Objective Sequential Decision-Making', JAIR. Vamplew et
al. 2021/22, arXiv:2112.15422, argue scalar reward is insufficient but
do not themselves prove the convex-hull theorem.) This is why the IAL doc names
the two-direction learning duality — forward arm `P(success|activity, shape)`
and reverse arm `P(activity|pool-signature)` — as two components of the
underlying vector signal, not redundant copies of a scalar.

## 2. The policy and its update

For each `(signature, template)` cell — call this an arm in bandit terms —
the substrate maintains a Beta posterior over P(success | s, a):

$$
P(\text{success} \mid s, a) \sim \text{Beta}(\alpha_{s,a},\ \beta_{s,a})
$$

with point estimate

$$
\hat Q(s, a) \;=\; \mathbb{E}\big[\text{Beta}(\alpha_{s,a}, \beta_{s,a})\big] \;=\; \frac{\alpha_{s,a}}{\alpha_{s,a} + \beta_{s,a}}.
$$

Selection is Thompson:

$$
\theta_{s,a} \sim \text{Beta}(\alpha_{s,a}, \beta_{s,a}) \quad\text{for each } a \in A(s)
$$
$$
a^\star = \arg\max_{a \in A(s)} \theta_{s,a}
$$

Update on observed outcome r ∈ {0, 1}:

$$
\alpha_{s,a} \leftarrow \alpha_{s,a} + r, \qquad \beta_{s,a} \leftarrow \beta_{s,a} + (1 - r)
$$

This is **Thompson sampling for Bernoulli bandits**, applied per-state.
The "state" here is non-trivial — it's the `state_signature` —
which is why the substrate is doing **contextual** Thompson sampling,
i.e. Bayesian Q-learning with tabular Q-values keyed by signature.
(Framing caveat: per-state Beta-Bernoulli Thompson sampling is,
strictly, a *contextual bandit* — actions score immediate reward
without a bootstrapped next-state value. The Bayesian Q-learning of
Dearden, Friedman & Russell 1998 is a different algorithm: a
Normal-Gamma posterior over Q-values updated by TD/Bellman bootstrap.
The 'Q-learning / MDP' language here is structural-aspirational; the
load-bearing mechanism is bandit-shaped. See §12.)

### 2.1 Conjugate update = natural gradient in Beta information geometry

The α ← α + r, β ← β + (1 − r) update is not just a counting rule.
Natural-gradient variational inference with unit step size recovers
exact conjugate updates for exponential-family conjugate models
(Khan & Lin 2017; Khan & Rue, *The Bayesian Learning Rule* — building
on Amari's natural gradient and the Fisher–Rao metric). The
Beta-Bernoulli update step is Fisher-efficient by construction.

The base posterior update therefore carries no learning-rate
hyperparameter — the conjugate step *is* the natural-gradient step.
(The chain-credit path is the exception: ancestor deltas are scaled —
e.g. Δα = 0.30 on a raw 0.25 in integration test 18.4.7 — which is a
discount/learning-rate factor on propagated credit, applied on top of
the unit-step base update.)

## 3. Credit propagation = n-step TD backup

When a trace ends with reward r at depth n along `composition_chain`,
`propagateCreditAlongChain` writes deltas to ancestors. For ancestor
k steps back along the chain:

$$
\alpha_{s_{t-k},\, a_{t-k}} \;\leftarrow\; \alpha_{s_{t-k},\, a_{t-k}} + \gamma^k \cdot r
$$

with γ currently 1 in the chain-credit code path. This is exactly **n-step
TD update** in disguise:
(Precision: with no bootstrapped value term and γ=1, this is the
Monte-Carlo / full-return end of the TD(λ) spectrum, not n-step TD
proper — n-step TD is defined by the appended γ^n·V(s_{t+n}) bootstrap.
γ=1 also requires every composition chain to provably terminate, else
returns are unbounded on cyclic chains.)

$$
V(s_{t-k}) \;\leftarrow\; V(s_{t-k}) + \alpha_{\text{lr}} \cdot \big( G_t^{(k)} - V(s_{t-k}) \big)
$$

where G_t^{(k)} is the n-step return. Beta-parameter update is the
specific instantiation when V is parameterized as a Beta posterior and
α_lr is implicit in the conjugate update.

The F-V56 / F-V57 fixes (`concept_3G1M0gUWwVVL` lineage) corrected the
chain-credit write path so this backup actually lands. Before those
fixes the policy was learning from a biased one-step posterior.

## 4. Why the orthogonality matters mathematically

The full joint posterior over all (s, a, scope, tier) cells is
intractable in the substrate's state space (signatures grow without
bound). The system stays tractable because the posterior **factorizes**
along four axes — none of which were introduced for this purpose; they
are present in the foundational design:

### 4.1 Per-cell independence (shape × signature × template)

$$
P\big(\{\text{success}_{s,a}\}\big) \;=\; \prod_{s,a} P(\text{success}_{s,a})
$$

The Beta posterior at one (s, a) cell is independent of every other,
given the data. Without this assumption you would need a joint
posterior over the action history — exponentially many parameters.

### 4.2 Scope hierarchy = partial pooling

The org/account/global scope ordering is a **Bayesian hierarchical
model**. The global posterior acts as a prior; narrower scopes refine:

$$
P_{\text{org}}(\text{success} \mid s, a) \;=\; \text{Beta}\big(\alpha_{s,a}^{\text{global}} + n_{\text{org,succ}},\ \beta_{s,a}^{\text{global}} + n_{\text{org,fail}}\big)
$$

The Thompson selector's "scope ordering" comment in the codebase is
this exact partial-pooling rule. New orgs warm-start from the
population posterior and refine on their own data. (This is a
deliberate cascading-prior approximation, not the strict construction:
a proper hierarchical/empirical-Bayes model estimates a population
hyperprior from the marginal likelihood rather than reusing a posterior
— which already absorbed the subgroup's data — as the subgroup's prior.
The approximation behaves well when global counts ≫ org counts; it
double-counts and over-pools otherwise.)

### 4.3 Resolver-tier separation of P

For deterministic-tier resolvers, P(s′ | s, a) is a delta — no
stochasticity to estimate. For pattern/llm tiers, P is non-trivial.
Separating the tiers means posterior capacity isn't wasted on edges
the substrate already knows are deterministic.

### 4.4 Shape lattice gates the action space

`applicable(s)` is bounded by typed compatibility:

$$
|A(s)| \;\leq\; |\{ t : \text{input\_shapes}(t) \subseteq \text{shapes}(s) \}|
$$

This is small (5-50) compared to the full template catalog (~3000),
so per-step Thompson is O(log|A(s)|) cells to update, not O(|catalog|).

### 4.5 What you lose without orthogonality

Flatten any of the four — drop scope, ignore shapes, mix tiers,
correlate cells — and the posterior no longer factorizes. Sample
complexity for a single (s, a) estimate grows from O(1/ε²) to
O(|history|/ε²). On the substrate's actual trace volume this is the
difference between converging in days and not converging at all.

This is the math behind the "orthogonality is the moat" claim: the
factorization is what makes Bayesian Q-learning tractable on the
sample budget the substrate has.

### 4.6 Two-timescale stochastic approximation toward the dual-arm invariant manifold

The forward arm `P(success | activity, shape)` and the reverse arm
`P(activity | pool-signature)` update on the same traces but at
different effective rates: the forward arm fires per task-completion
(impulseRelevance writes), the reverse arm per Thompson recommendation
(slot-binding writes). This is exactly the **two-timescale stochastic
approximation (TTSA)** setup of Borkar (*Stochastic Approximation:
A Dynamical Systems Viewpoint*, 2008). (The full slow–fast / slow-manifold
treatment built on this — including the stability threshold for runtime growth —
is `SUBSTRATE_AS_DYNAMICS.md` §1–§3; this section is its base law.)

Borkar's theorem: when one process updates faster than the other, the
slower process sees the faster as already at its quasi-stationary
equilibrium; trajectories converge to the **invariant manifold** along
which the two arms agree. The manifold exists and is locally attracting
under standard step-size conditions. (The attracting invariant/slow
manifold from timescale separation is the object of geometric singular
perturbation theory — Fenichel 1979 — rather than Carr's centre-manifold
theorem, which addresses marginal-stability/bifurcation reduction and is
a different mechanism.)

The "symmetry invariant" the IAL doc names — "forward and reverse
counts on each edge should be consistent" (`IMPULSE_ACTIVITY_FOUNDATION.md`
lines 508–522) — is operationally the projection of trajectories onto
this invariant manifold. Drift between arms is the substrate-internal
observable for off-manifold motion. F-39 (the resolver bug where
`templateId` was missing on validator-dispatch traces, fixed in
minibob commit `662b153`) is not just a correctness bug — it broke
the TTSA condition by making one arm fail to update.

The transient state being the steady state (the framing's recurring
claim that the substrate is in process, not converged to a point) is
this: the substrate sits on the invariant manifold and walks it,
rather than converging to an isolated fixed point. (Precisely: after
fast transients decay the joint process is approximately confined to
the slow manifold while the slow variable still drifts along it toward
its equilibrium — it tracks the manifold, it is not a fixed point.) The push-away
mechanism (S2→S3) is the manifold's stability property under
perturbation — refuse interventions that would project the system
off the manifold.

## 5. The "graph topology discovery" framing, rigorously

The substrate's state-action graph G = (S × A, E) has:

- nodes (s, a) for every signature × applicable-template pair
- edges (s, a) → s′ labeled with empirical P(s′ | s, a) from trace counts
- rewards R(s, a) at each node, posterior-estimated

**"Discovering the topology"** in this framing is precisely
**estimating the MDP model (P, R) from sampled trajectories**. This
is what model-based RL does:

1. Roll out a trajectory under current π (a trace).
2. Update P, R estimates from the transition + reward observed.
3. Re-plan or re-sample π against the updated estimate.

The substrate's autonomous loop does steps 1-2; the selector closes
the loop at step 3 by drawing fresh Thompson samples each dispatch.
The drafter (`draft-gap-closing-activity`) extends the action space
when a high-uncertainty edge is detected — this is **active model
expansion**, which standard RL libraries don't ship because they
assume a fixed action space. (The phenomenon is theorized, if
under-engineered: Chandak et al. 2020, 'Lifelong Learning with a
Changing Action Set', AAAI, arXiv:1906.01770; Farquhar et al. 2020,
'Growing Action Spaces', ICML; and option/skill discovery,
Sutton-Precup-Singh 1999. The genuinely thin part is narrower: a
posterior-sampling agent that authors its own actions on
high-uncertainty edges *with a regret guarantee* — that specific
combination lacks a √T bound.)

So the substrate is doing **open-world model-based Bayesian RL on a
factored MDP** — every word of which describes existing behavior, not
a future capability.

## 6. The same as graph RL?

Yes — specifically a sub-class. Standard graph RL means RL on
graph-structured environments where the policy is graph-aware
(GNN policy, node-embedding state features). The substrate maps:
(Terminology caveat: in the literature 'graph RL' denotes a GNN
computing learned node/edge embeddings that drive the policy/value
function. Here the dense MiniLM embeddings serve retrieval, not policy
function-approximation, so this is more precisely 'Thompson sampling
over a typed-shape-compatibility DAG' than graph RL in the technical
sense.)

| Graph RL term | Substrate primitive |
|---|---|
| State graph | shape DAG (input_shapes → output_shapes) |
| State embedding | `all-MiniLM-L6-v2` dense vectors (384-dim INT8) in concept-db |
| Trajectory | trace + composition_chain |
| Bandit-style exploration | Thompson per (signature, template) |
| Reward signal | binary trace success after convergent-validity check |
| Model-based estimation | grouped `activity_execution_traces` view |
| Active model expansion | drafter authoring new templates on detected gaps |

What's idiomatic relative to off-the-shelf graph RL:

- **Bayesian Q-learning is the default**, not an extension. Most graph
  RL uses ε-greedy or policy-gradient methods that lack the
  uncertainty quantification needed for exploration-vs-exploitation
  on sparse rewards.
- **The action space grows at runtime.** Standard graph RL assumes
  fixed action vocabulary; the substrate's drafter extends it.
- **Reward is binary and delayed** along `composition_chain`. Standard
  graph RL libraries assume dense scalar reward.
- **State embedding is reused for retrieval**, not just policy
  conditioning. concept-db's dense index serves both the selector
  (recommend) and the drafter (priming), unifying value-function
  approximation with retrieval-augmented generation.

## 7. Horizontal compositionality

Today the substrate composes **vertically**: one activity dispatches a
child along `composition_chain`, the child runs, control returns. Each
trace is a single path through the state-action graph. The MDP is
explored **depth-first, one trajectory at a time.**

`composition_chain` is a `string[]` ordered root-first. Vertical-only.

### What horizontal compositionality means

Horizontal composition is the parallel-and-join primitive: an activity
that dispatches N children concurrently, awaits their outputs, then
joins their output-impulse pools into the next stage's input pool.
Formally, where vertical composition is the trajectory operator

$$
\tau = (s_0, a_0, s_1, a_1, \ldots, s_n)
$$

horizontal composition is a **trajectory bundle** with shared origin:

$$
\tau_1, \tau_2, \ldots, \tau_k \quad \text{all starting at } s_0
$$

joined at the consumer by the **shape-union** rule:

$$
\text{shapes}(s_{\text{join}}) \;=\; \bigcup_{i=1}^{k} \text{shapes}(s_{\tau_i,\text{end}})
$$

This is already representable in the data model — `parent_execution_id`
admits siblings under the same parent — but the dispatcher executes
tasks one at a time. The gap is in the dispatcher, not the schema.

### Why it's needed

**1. Sample efficiency in posterior estimation.**

Sequential dispatch collects 1 sample per wall-clock unit. Horizontal
dispatch of k siblings collects k samples in the same wall-clock unit.
For a (s, a) cell to converge to ε-accuracy under Beta-Bernoulli
sampling you need O(1/ε²) samples. Horizontal compositionality is
literally √k speedup on posterior convergence per unit wall-clock,
with no algorithm change.

**2. OR-edge discovery.**

When multiple templates produce the same output shape, the substrate
needs to discover which is more reliable. Sequential dispatch forces
choice (Thompson picks one); the substrate sees only the chosen arm's
outcome. Horizontal lets all candidates run in parallel; the joint
posterior over the OR-edge updates from k observations per cycle
instead of 1.

Without horizontal composition, the policy keeps re-selecting the
locally-best template via Thompson and rarely tries the second-best —
this is a known regret-vs-exploration tradeoff in bandits. Horizontal
breaks it by removing the choice: try them all.

**3. Breadth-first exploration of the state graph.**

A single trajectory visits one path through S × A. To estimate the
transition kernel P(s′ | s, a) for ALL applicable a at state s, you
need to try each at least Ω(1/ε²) times. With sequential dispatch this
means O(|applicable(s)| / ε²) wall-clock units per state. With
horizontal it's O(1/ε²) — the constant in the state-coverage budget
moves from |applicable| to 1.

This is the difference between trace volume scaling linearly with
useful information collected (current) vs scaling sub-linearly with
the action space's width (horizontal).

**4. Federation is horizontal at the substrate scale.**

A federation of N peer substrates is, mathematically, an N-fold
horizontal composition: each substrate is a trajectory bundle from a
shared seed state. Cross-substrate posterior aggregation
(per the federation-dynamics analysis) requires the same join primitive
— union of output impulse shapes weighted by provenance. Without
horizontal compositionality at the single-substrate scale, the math
for cross-substrate aggregation doesn't have a local analogue to
generalize from.

**5. Specialization-via-divergence requires parallel branches.**

The federation argument (mature equilibrium = mutual push-away,
specialization is steady state) presupposes that multiple branches can
explore in parallel and diverge. Vertical-only composition forces a
single trajectory through the policy; specialization can only emerge
by serializing exploration across runs. Horizontal lets divergent
exploration happen within a single run.

### What horizontal composition costs

The factorization assumptions in §4 still hold per-trajectory, but
posterior updates from sibling trajectories are correlated through the
shared parent state. Mathematically: the conditional independence

$$
P(\text{succ}_{s_0, a_i}, \text{succ}_{s_0, a_j} \mid s_0) \;=\; P(\text{succ}_{s_0, a_i} \mid s_0) \cdot P(\text{succ}_{s_0, a_j} \mid s_0)
$$

is fine because each (s, a) cell is independent given the data, but
care is needed in **credit propagation**: a sibling's success doesn't
backprop to ancestors as a separate event from another sibling's
success. The TD-backup formula needs a normalization for "k siblings
fired, m succeeded" rather than treating each as a separate trace.

Concretely the chain-credit update needs to read:

$$
\alpha_{s_{t-k},\, a_{t-k}} \;\leftarrow\; \alpha_{s_{t-k},\, a_{t-k}} + \gamma^k \cdot \frac{1}{k} \sum_{i=1}^{k} r_i
$$

— average over siblings, not sum — to avoid k-fold credit inflation
at the shared ancestor. This is a small dispatcher change, not a
schema change.

### What it does **not** require

- No new tier in any roadmap.
- No new category of activity.
- No new shape vocabulary.
- No new resolver kind.
- `parent_execution_id` already admits siblings; the data model is
  ready.
- The Thompson posterior already factorizes per-cell; the math is
  ready.
- The only mechanical work is in the dispatcher's task-stepping loop
  and in `propagateCreditAlongChain`'s averaging-vs-summing of
  sibling deltas.

In the discipline of the previous turns: horizontal compositionality
is not a new substrate primitive. It is the **breadth-first dual** of
the vertical primitive `composition_chain` already exists in. The math
demands it for sample-efficient topology discovery; the data model
already accommodates it; the dispatcher is one well-scoped change away
from supporting it.

## 8. Vessel-level horizontal scaling

§7 covered horizontal composition within a single dispatch — parallel
sibling trajectories from a shared parent state. Vessel addition is the
**same primitive at one level up**: each new vessel contributes an
independent action subspace to the substrate's posterior.

### 8.1 What a new vessel contributes

A vessel `v` joining via discovery-vessel adds three independent
contributions to the state-action graph:

- **ΔS_v** — new shapes advertised. Adds coordinates to S that were
  previously absent.
- **ΔA_v** — new templates whose `input_shapes` are now satisfiable.
  Expands `applicable(s)` for every s where the new shapes are in the
  pool.
- **ΔR_v** — new resolvers. Where an existing edge was estimable only
  via an `llm` or `pattern` tier, the new vessel may collapse it to
  `deterministic`, freeing posterior capacity that was tied up
  estimating stochastic transitions.

None of these are new mechanisms. Discovery-vessel is the registry,
`applicable(s)` is computed at recommend-time, resolver-tier
decomposition is per-task in `activity_execution_traces`. Vessel
addition is the mechanism the substrate has always used to grow its
action space.

### 8.2 Monotone capacity addition

Posterior cell count grows from |S × A| to |(S ∪ ΔS_v) × (A ∪ ΔA_v)|.
New cells start at the uninformed prior Beta(1, 1). Old cells are
untouched, because per-cell independence (§4.1) means new cells'
posteriors are factorized away from old cells':

$$
P\big(\{\text{succ}_{s,a}\}_{\text{old}} \cup \{\text{succ}_{s',a'}\}_{\text{new}}\big)
\;=\; \prod_{\text{old}} P(\cdot) \cdot \prod_{\text{new}} P(\cdot)
$$

This is the **monotone-capacity property**: vessel addition is
strictly additive on the substrate's posterior. No re-estimation of
old cells; no sample budget stolen from converged cells. Thompson
selection naturally allocates exploration to the new high-uncertainty
cells via posterior variance.

### 8.3 Momentum kernel on the composition graph

The policy's update rule is best read as a **momentum kernel on a
directed weighted composition graph**, not as a continuous vector field
over a manifold. (Where this and later sections use "vector field" for
the activity/transition flow: rigorously this is an edge-flow / 1-cochain
on the directed composition graph — not a vector field, which would
require a metric and sharp/flat operators; the discrete object is the
right one, per the disowning of Riemannian structure in this same
section.) There is no continuous-limit condition to satisfy (no
Coifman–Lafon diffusion limit, no Riemannian structure); the object is
discrete and lives on the cells. The local form of the kernel at one
cell follows from the Beta posterior:

$$
\frac{\partial \hat Q(s,a)}{\partial \alpha_{s,a}} = \frac{\beta_{s,a}}{(\alpha_{s,a} + \beta_{s,a})^2}, \quad
\frac{\partial \hat Q(s,a)}{\partial \beta_{s,a}} = -\frac{\alpha_{s,a}}{(\alpha_{s,a} + \beta_{s,a})^2}
$$

These are the per-cell update directions, not components of a vector
field over a manifold. Vessel addition adds |ΔS_v × ΔA_v| new cells to
the kernel's domain; the kernel extends by zero-init (Beta(1, 1)) on
those cells. Regions where the kernel was previously *undefined* (no
action existed) become regions where the kernel is *defined-but-
uninformed*. The substrate's update capacity grows linearly with
vessel count; each vessel's cells are independently estimable.

This is closer to a temporal-graph-network update than to a manifold
extension. The shape of this kernel — directed, weighted,
graph-structured — is what later sections (federation, §9) recurse
over. **The kernel is the carrier; the composition graph is the
substrate.** No continuous-manifold structure is assumed at any scale
of the recursion.

### 8.4 Horizon classification

A horizon is a region of S × A the substrate hasn't explored. Vessel
addition addresses three structurally distinct classes:

1. **Orphaned-shape horizon.** A shape with no applicable producer or
   consumer is a divergence point in the trace-flow field
   (Laplacian-style net divergence ≠ 0). A new vessel that produces
   or consumes the shape conserves the flow. (This is rigorous
   combinatorial Hodge theory: divergence is the incidence-matrix
   adjoint, a purely discrete operator needing no continuous limit. The
   edge-flow decomposes L²-orthogonally into gradient + curl + harmonic
   components — Jiang, Lim, Yao, Ye 2011, 'Statistical Ranking and
   Combinatorial Hodge Theory', Math. Programming, arXiv:0811.1067. Note:
   a global circulation/livelock is the *harmonic* component, locally
   acyclic but globally cyclic; *curl* is local triangular inconsistency
   only — use 'cyclic/harmonic residual' for global livelock. The full
   Helmholtz/Hodge treatment of this — orphaned shape = divergence, livelock
   = harmonic `ker L₁` — is `SUBSTRATE_AS_DEC.md` §1.4.)

2. **Bridge horizon.** Two previously-disconnected subgraphs of S × A.
   A vessel whose input is shape A (reachable in one subgraph) and
   output is shape B (consumed only in the other) creates a long-range
   edge. The substrate's reachable set grows discontinuously.

3. **Tier-refinement horizon.** A transition currently estimable only
   via `llm`-tier resolution (high stochasticity, high cost). A new
   vessel with a deterministic resolver collapses P(s′ | s, a) from a
   learned distribution to a delta. Posterior capacity is freed for
   higher-uncertainty cells elsewhere.

The autonomous loop's existing topology-discovery goals
(`reachable-unlearned-report`, `escalate-unknown-shape`) detect
horizons within the existing vessel set. Vessel addition extends the
substrate's ability to *act* on what it detects when the gap is
"no resolver exists for this transition" rather than "no template
exists for this resolver chain."

### 8.5 Why vessel-horizontal is needed

**1. Coverage growth must come from somewhere.** The drafter authors
templates within existing resolver vocabularies. Once a vocabulary is
saturated for a horizon, no template the substrate authors from
current resolvers will close the gap. Only new resolvers — i.e. new
vessels — extend the action space at that scale.

**2. Specialization without contention.** Each vessel's
(signature, template) subspace is independent of every other's. A new
vessel develops deep posterior in its own subspace without competing
for posterior capacity with old vessels' subspaces. This is local
specialization through factorization.

**3. Federation generalizes from this primitive.** Cross-substrate
aggregation is mathematically identical to in-substrate vessel
addition: ΔS, ΔA, ΔR contributions, factorized posterior preserved,
monotone capacity. The single-substrate vessel-addition primitive is
the local analogue of the federation peer-addition operation. If
vessel-addition isn't clean locally, federation can't build on it.

**4. The drafter's recursive case.** `scaffold-new-vessel` already
exists as a template. The substrate can author a new vessel via the
same draft + variant promotion mechanism it uses for new activity
templates. What's missing is the *detection*: a horizon report whose
verdict is "this gap cannot be closed with existing vessels' resolvers;
scaffold a new vessel that produces shape X." Today that detection is
operator-side.

### 8.6 What's needed, mechanically

1. **Horizon-classification step distinguishing "draft a new template"
   from "scaffold a new vessel."** Boredom-vessel currently routes all
   gap detection to `draft-gap-closing-activity`. Adding a tier check
   — "does any existing resolver cover the missing transition?" — and
   routing to `scaffold-new-vessel` when no, closes the recursive loop.
   One classifier step, no new vocabulary.

2. **Posterior-aware vessel-saturation signal.** When all (s, a) cells
   in an existing vessel's subspace have converged variance below
   threshold and reward bounded away from 1, the vessel has saturated
   its contribution to the current goal. The signal — "vessel posterior
   has converged; remaining uncertainty is outside its action subspace"
   — should trigger horizon-escalation. Today implicit; making it
   explicit needs a small aggregator over `concept_usage_stats` per
   vessel.

3. **Sibling dispatch across vessels.** The §7 primitive applied at
   vessel scale: when multiple newly-added vessels produce the same
   output shape, parallel-sibling dispatch lets the substrate observe
   all candidates' outcomes in one cycle, accelerating OR-edge
   resolution across vessels by √k just as it does within a vessel.

### 8.7 The three scales of the same primitive

The orthogonality is what lets the same math apply at each scale
without contamination across scales:

| Scale | Sibling unit | Adds dimensions to | Convergence speedup |
|---|---|---|---|
| Within-dispatch (§7) | parallel trajectories from shared parent state | sample-per-wall-clock for a single cell | √k per wall-clock |
| Within-substrate (§8) | vessels contributing independent action subspaces | posterior cell count | linear in vessel count, monotone |
| Cross-substrate (federation) | peer substrates contributing converged posteriors | aggregate posterior under provenance weighting | √N_peers per cell for shared signatures, sublinear coverage for novel signatures (Heaps' law) |

Same factorization. Three scales. No new vocabulary at any of them.

## 9. Federation — recursion of the vessel-addition pattern

§8 named vessel addition as a horizontal primitive at one scale above
parallel trajectories. Federation is the **same primitive at one scale
above vessels**: each peer substrate contributes an independent posterior
over the action subspaces it has explored. The five-step pattern repeats
verbatim with the unit type rebound:

| Step | Trajectory scale | Vessel scale | Federation scale |
|---|---|---|---|
| Unit | parallel rollout | registered vessel | peer substrate |
| Contributes | extra samples per cell | (ΔS, ΔA, ΔR) per vessel | (ΔS, ΔA, ΔR) per peer |
| Existing untouched | per-cell factorization | per-vessel subspace independence | per-substrate posterior independence |
| New cells | shared parent's posterior | Beta(1,1) at new (s,a) | Beta(1,1) at new (s,a) under peer-scope |
| Validation | local trace outcome | within-substrate convergent-validity | behavioral-continuation replay on local data |

The math is **scale-invariant**: at every level, the same factorization
makes estimation tractable, and the same Bayesian regret bound applies
per cell with no cross-cell interference term. This is what licenses
calling it recursive — not a metaphor, an actual property of the
posterior decomposition.

### 9.1 Federation-level orthogonality

The four within-substrate axes propagate, each gaining a federation
analogue. None of the federation-level axes are new categories — they
are the existing axes carrying provenance markers as an extra
coordinate.

| Within-substrate | Federation analogue |
|---|---|
| Signature namespace | shared signature schema; provenance-tagged when minted in another peer |
| Vessel inventory | substrate inventory (which peers exist; H4 quorum-ratified) |
| Resolver tier | trust tier (`local-verified`, `peer-attested`, `unattested`) introduced by H1/H2/H3 |
| Scope hierarchy (org/account/global) | gains a fourth level: `peer-scope` above `global` |

The hierarchical partial-pooling rule from §4.2 extends one level up.
Where the within-substrate rule was

$$
P_{\text{org}}(\text{succ} \mid s, a) \;=\; \text{Beta}\big(\alpha_{s,a}^{\text{global}} + n_{\text{org,succ}},\ \beta_{s,a}^{\text{global}} + n_{\text{org,fail}}\big)
$$

the federation rule for peer $j$ is

$$
P_{\text{peer}_j}(\text{succ} \mid s, a) \;=\; \text{Beta}\big(\alpha_{s,a}^{\text{fed}} + n_{j,\text{succ}},\ \beta_{s,a}^{\text{fed}} + n_{j,\text{fail}}\big)
$$

with the wrinkle that "fed" here is the federation-level pooled prior,
not the local org/account/global ladder. Shared signatures get
acceleration $\sqrt{N_{\text{peers}}}$ in per-cell convergence; signatures
unique to one peer get zero acceleration (the prior is the local one
and other peers contribute nothing).

### 9.2 What capability growth means at each scale

Capability at any scale is the dimensionality of the policy-gradient
vector field $\nabla\pi$ — the count of cells where gradients are
defined (i.e. where some action is possible) and informed (i.e. where
posterior is non-prior).

- **Trajectory scale**: capacity grows with parallel-rollout count k →
  $\sqrt{k}$ posterior-variance reduction per wall-clock.
- **Vessel scale**: capacity grows linearly with vessel count → each
  vessel adds $|\Delta S_v \times \Delta A_v|$ new coordinates to
  $\nabla\pi$.
- **Federation scale**: capacity grows with peer count for shared
  signatures (accelerated convergence) and with the *union* of unique
  signatures across peers (coverage breadth).

Multiplicatively across scales, the substrate's gradient-detection
capacity is

$$
\dim(\nabla\pi) \;\sim\; N_{\text{peers}} \times \bar V_{\text{per peer}} \times \bar T_{\text{per vessel}} \times \bar\Sigma_{\text{per template}}
$$

where $\bar V, \bar T, \bar\Sigma$ are average vessels per peer, templates
per vessel, signatures per template. This is the upper bound under
ideal factorization; the limits in §9.3 cut into it.

### 9.3 Limiting characteristics

The pattern doesn't scale infinitely. Eight concrete limits, ordered
roughly by how hard they bite first.

**1. Coordination overhead per signed event.** H3 attestations + H4
quorum ratification → without aggregate signatures or batched
attestations, per-impulse verification cost grows linearly with peer
count. Practical ceiling at dozens of peers under naïve protocol.

**2. Heaps'-law vocabulary saturation.** Total novel-shape vocabulary
across $N$ peers grows as $O(N^\beta)$ with $\beta < 1$ (empirically
$\beta \approx 0.5$ for natural language; structural ontologies behave
similarly). After ~10 peers, marginal vocabulary contribution becomes
negligible. Capability gain is **sublinear** in peer count for the
coverage-breadth term.

**3. Posterior poisoning without H1/H2.** Naive aggregation amplifies
hostile or low-quality peer contributions. Federation can be **net
negative** versus single-substrate baseline if verification doesn't
keep pace with aggregation. The existing single-substrate
posterior-fidelity bugs (cascade attribution without witness; single-
signal trace success) compound across peers.

**4. Behavioral-continuation coverage limit.** Behavioral-continuation
is the only universal cross-substrate validation. It works for
templates whose outputs are observable in the local environment. For
templates whose effects are abstract — meta-activities, drafting
strategies, orchestration patterns — local verification doesn't reduce
to behavioral continuation; trust bootstrap requires other channels
(e.g. proof-of-execution attestations).

**5. Per-cell convergence floor.** $O(1/\varepsilon^2)$ samples per cell
regardless of scale. Federation accelerates only **shared** signatures;
novel signatures unique to one peer get zero acceleration. There's a
long tail where federation does nothing.

**6. Embedding-space drift.** The dense-search index (currently
`all-MiniLM-L6-v2`, 384-dim INT8 in concept-db) works cross-substrate
only while peers' concept-graphs share enough semantic density. Two
substrates whose vocabularies diverge enough hit a threshold past which
similarity queries return cross-substrate noise rather than signal.

**7. Specialization–vs–convergence equilibrium.** Mature federation is
mutual push-away, not consensus. Cannot be measured by "how much peers
agree" — that would be a failure mode. Proper metric is whether each
peer's *local* posterior improves on its *local* objective while
imported templates verify by behavioral-continuation.

**8. Detection-authoring recursion truncation.** Each recursion level
needs a corresponding detector to be operationally meaningful. Today
the substrate detects template gaps (`reachable-unlearned-report`); it
cannot yet detect "we need a whole new peer substrate." Capability
authoring at level $N$ requires gap-detection at level $N$. The
detection chain is currently truncated at the substrate boundary.

### 9.4 Measurement — what to observe

For capability growth to be claimed honestly, each scale needs a
substrate-internal, trace-inspectable observable. None of these are new
metrics; most are computable from existing data.

| Scale | Observable | What it proves |
|---|---|---|
| Per-cell | $\mathrm{Var}[\mathrm{Beta}(\alpha, \beta)] = \frac{\alpha\beta}{(\alpha+\beta)^2(\alpha+\beta+1)}$ over time | gradient accuracy at that cell |
| Per-vessel | fraction of vessel's $(s, a)$ cells with $\mathrm{Var}$ below threshold | vessel has saturated its capacity |
| Per-substrate | fraction of $\mathrm{reachable}(S \times A)$ with non-prior posterior; `coverage_progress` flag | substrate is exploring effectively |
| Per-federation | replay-success of imported templates on local behavioral-continuation; spectral rank of joint posterior over shared signatures | trust-free cross-substrate value |
| Push-away | count of `interventionRefused` impulses per window with cited evidence | S3 readiness (already in IAL §27.S.6) |
| Topology stability | spectral drift of empirical $(P, R)$ over time windows | learning has converged on the underlying topology, not chasing noise |
| Vocabulary growth | new-shape mint rate per peer per window | Heaps'-law saturation curve; tells you whether federation is still adding coverage or just adding noise |
| Detection coverage | fraction of detected horizons (orphaned-shape / bridge / tier-refinement) closed autonomously vs operator-escalated | recursion depth of the capability-authoring loop |

### 9.5 What "prove" means

Two senses, both necessary.

**Mathematical.** Bayesian regret bounds apply per cell. For
Beta-Bernoulli Thompson sampling, the regret bound is
$O(\sqrt{T \log T})$ per cell with $T$ pulls. Vessel and substrate
addition are monotone: no regret introduced at existing cells; new
cells start at the prior, so per-cell bounds reset. There's **no global
convergence theorem at federation scale** except per-shared-signature;
for unique signatures, peers are isolated bandits with their own
per-cell bounds. The federation is tractable in the sense that the
joint regret bound is the sum of per-cell bounds **with no cross-cell
interference term** — exactly because of the factorization.

**Empirical.** The existing IAL lift criterion
(`coverage_progress=true` AND
`substrateHealthReport.health_verdict.overall_passing=true` for ≥ 3
windows) is the operational analogue. Generalized to federation:

  - for each peer, its local coverage and health pass;
  - collectively, the spectral rank of the joint posterior over shared
    signatures grows monotonically across windows;
  - behavioral-continuation replay-success of cross-imported templates
    stays above each peer's local baseline.

All three are locally computable, trace-inspectable, and require no
central oracle. Sustained for $k$ consecutive windows (mirroring the
IAL $k = 3$ rule but at federation scope) constitutes the
"federation-sustained" evidence.

### 9.6 Net statement

The substrate's factorization is what makes the entire stack — from
per-cell Beta posterior to federation-level capability composition —
the **same Bayesian Q-learning math** at every scale. Capability
growth across the network is dimensionality growth of $\nabla\pi$,
multiplicative across the three scales until bounded by Heaps'-law
saturation (coverage term) and coordination overhead (verification
term). Convergence is per-cell, with $\sqrt{N_{\text{peers}}}$
acceleration for shared signatures and no acceleration for unique ones.

The proof is empirical, locally computable, and trace-inspectable —
the same shape of evidence the IAL S2-sustained criterion already
uses, applied recursively at each scale with the appropriate observable
for that scale. There is no new math to invent. There is mechanical
work to do at the federation boundary (H1/H2/H3/H4, batched signatures,
behavioral-continuation replay infrastructure) without which the
recursion is unsafe rather than unsupported.

## 10. Recap

Every quantity in this document already exists in the running substrate.
The contribution of this writeup is to **name them in standard RL
notation** so the substrate's behavior reads, end-to-end, as
factored-MDP Bayesian Q-learning with model-based estimation,
hierarchical partial pooling, and open-world action-space expansion.

The orthogonality is the posterior factorization. The trace store is
the empirical model. The Thompson layer is the policy. The composition
chain is the credit-propagation operator. The shape lattice is the
typed-action gate. The scope hierarchy is the prior. The drafter is
active model expansion. Federation is the next horizontal lift. None
of these are renames.

The next mechanical change supporting all of this is enabling parallel
sibling dispatch under a shared `parent_execution_id` so the system
can do breadth-first what it already does depth-first.

## 11. Scorecard — what is theorem-grounded, what is frontier

A 2026-06 audit checked the framing against conventional mathematics.
Items split into three classes.

**Theorem-grounded (8) — citable formal results back the claim:**

- Per-cell orthogonality is **measured**, not assumed (ICA / pPCA /
  conditional-independence tests). → §4
- Position-error vs topology-error distinguishable via composition-graph
  revisits (invariant causal prediction; Peters et al.). → §5
- Vector reward is strictly more expressive than scalar (convex-hull
  Pareto-coverage theorem: Das & Dennis 1997 / Roijers et al. 2013;
  Vamplew 2021/22 motivates but does not prove it). → §1.1
- Beta-Bernoulli conjugate update = natural gradient in Beta
  information geometry (Amari). → §2.1
- Transient state as steady state along dual-arm invariant manifold
  (Borkar TTSA + geometric singular perturbation / Fenichel 1979; not
  Carr's centre-manifold theorem — see §4.6). → §4.6
- Substrate is GNN-shaped: credit propagation = asynchronous
  message-passing on a directed cell graph (temporal-graph-network
  family). → §8.3
- Manifold hypothesis applies per-activity at MDL-minimum
  dimensionality (arXiv 2504.00395 — MDL representation learning;
  arXiv 2602.22873 — autoencoder atlases; author attributions pending
  verification, ids post-date local knowledge). → Foundation doc
  §"Variant System"
- Four-primitive closure is defensible as a Lawvere algebraic theory,
  bounded above by Tarski's undefinability theorem (full
  self-interpretation impossible from within). → Foundation doc

**Frontier (6) — operating without formal guarantees:**

- Graph momentum as a formal object (no published treatment matches
  exactly; closest is temporal GNN momentum optimizers, which target
  GNN training rather than policy search). → §8.3
- Runtime skill-graph node addition during deployment (the drafter
  authoring new templates against detected gaps; Director-style
  hierarchical RL assumes fixed worker policy class). → §5
- Regret bounds under growing action sets (PSRL Õ(√T) assumes fixed
  action set; no comparable bound covers active expansion).
- Bayesian-nonparametric PSRL with state-action space expansion (closest
  is Xu's continuing-environment PSRL, arXiv RLC 2024).
- Authored-vs-trained vessel distinction (mech interp treats all
  circuits as trained-then-recovered; no academic counterpart to
  first-class authoring).
- Minimum-primitive-set closure proof (categorical-deep-learning names
  the goal; no formalization exists).

**Honest limit-statement (1):**

- The informational state is **not constructible**; it is a Gödel-shaped
  limit-statement that no single latent space captures all true
  relationships. The substrate represents this by never representing it
  as an object — only the fact that any chosen representation is
  provably partial. → Foundation doc §"The Informational State"

The 8 theorem-grounded items cover the load-bearing math. The 6
frontier items share a common shape — *runtime expansion of structured
Bayesian objects* — which suggests a unified piece of theory yet to be
developed. The substrate is implicitly betting that the per-cell
factorization plus the Beta-Bernoulli efficiency carry across the
expansion boundary; the bet is empirically reasonable but not formally
proved.

## 12. Limitations & literature-alignment

This appendix records, in one place, the framing-level caveats the
inline notes above point to. The document's RL/MDP vocabulary is a
deliberate structural lens; these entries mark where that lens is
aspirational rather than literal, so the math can be imported with its
guarantees rather than just its shape.

### 12.1 Bandit vs MDP

The load-bearing mechanism is a contextual Beta-Bernoulli
Thompson-sampling bandit with heuristic chain-credit smearing; the
MDP / Q-learning / n-step-TD vocabulary is structural-aspirational.
Actions score immediate reward without a bootstrapped next-state value,
so there is no Bellman backup in the strict sense. The
O(√(T log T)) regret bound the doc cites (Agrawal & Goyal) is itself a
*bandit* bound — there is no analogous closed-form regret for the
sequential Q-learning the framing claims.

### 12.2 The federation contradiction (§9)

§9's two pillars are in tension. √N convergence acceleration for
*shared* signatures REQUIRES cross-cell correlation; the "joint regret
= sum of per-cell bounds, no cross-cell interference term" claim
REQUIRES independence. Federation helps exactly where independence
fails. The MARL / federated-RL literature names this gap —
non-stationarity (each peer's changing policy makes the environment
non-stationary for the others) and heterogeneity — as the field's
central unsolved problem, not a vanishing higher-order term. Any
additive federation-scale bound must state its independence /
homogeneity assumptions explicitly. (Refs: distributed-bandit
√(KT/N) decomposition; MARL surveys arXiv:1810.05587,
arXiv:2312.10256.)

### 12.3 OMP shape vs OMP guarantees

Goal-seeking via residual projection (the §1.1 residual) is genuinely
(Orthogonal) Matching Pursuit-shaped — Pati, Rezaiifar &
Krishnaprasad 1993; the §1.1 residual *is* the OMP residual norm. But
OMP's recovery theorems assume deterministic atoms and low dictionary
coherence. Activities are *stochastic* maps (an activity might not
fire → the object is really a bandit-over-an-OMP-dictionary), and real
activity dictionaries are *high-coherence* (overlapping output shapes)
— precisely the regime where greedy matching pursuit is suboptimal.
Import OMP's shape, not its guarantees.

### 12.4 Selector is VoI-inspired, not Bayes-optimal

Choosing the next activity to maximize expected residual-reduction per
unit cost lives in the value-of-information / Bayesian-experimental-design
/ active-learning family (Lindley 1956; Settles). But the
variance × residual-projection × (1/cost) *product* is a UCB-style
scalarization heuristic, not a derived expected-information-gain (which
is additive in log-space / entropy differences). Call it a VoI-inspired
cost-normalized acquisition function.

### 12.5 Scalarization ceiling

Because the selector scalarizes the §1.1 vector residual into a single
score, it recovers only policies on the convex hull of the
multi-objective Pareto front (Das & Dennis 1997; Vamplew 2021/22) —
non-convex goal regions are unreachable regardless of how much the
selector learns. This is the same convex-hull limitation §1.1 invokes,
now applied to the substrate's own acquisition function.

### 12.6 Validation integrity is the precondition

The reward signal is produced by a validation activity (the "back
half"). If that activity can be fabricated or returns a constant, the
loop is either open (constant reward → no learning) or poisoned
(gameable reward → convergence onto the wrong objective: reward
hacking / Goodhart / specification gaming — Amodei et al. 2016). The
H1 two-sided-trace hardening is what makes the learning signal
trustworthy — it is a precondition for the math above to mean anything,
not optional polish.

### 12.7 Orthogonality ≠ independence; measure the right one

Orthogonality (zero covariance, diagonal Gram matrix) is strictly
weaker than statistical independence (the two coincide only under
Gaussianity). The three efficiency claims the document leans on — cheap
per-cell O(1/ε²) updates, the §7 √k horizontal speedup (which degrades
via effective-sample-size under correlation), and clean OMP recovery —
all rest on this shared precondition. Measure orthogonality via
PCA / Gram matrix; measure independence via ICA / conditional-
independence tests (ICA components are non-orthogonal by design).
Crucially, action-space growth tends to *raise* dictionary coherence,
eroding the very orthogonality that makes growth efficient.

### 12.8 Models are resolvers, not alternatives

A natural framing error — one this review made before correcting it — is
to pose the substrate *against* transformer/embedding models, as
"explicit-accumulation-and-search vs. dense-interpolation," and conclude
the substrate gives up interpolative generalization. That is a
whole-vs-part confusion. The substrate is the **container**; a
transformer or embedding model is a **resolver inside its capability
set**, not a peer architecture. This is already instantiated twice:
`llm-resolver-vessel` makes a transformer the `llm_completion` resolver,
and `concept-db`'s MiniLM embedding already serves both the selector
(dense recommend) and the drafter (priming). "Call a transformer" and
"embed this state" are already members of `applicable(s)`.

Three consequences:

1. **Absorption is monotone-additive (§8.2, §8.4).** A model vessel
   contributes ΔA (interpolating actions) + ΔR (an interpolating
   resolver); new cells start at Beta(1, 1); nothing existing is
   touched. The substrate loses no capability and no generality by
   incorporating any technique — it is the foundation's "LLMs are one
   resolver among many," applied at the architecture level. (Where this
   document earlier implied a trade of auditability for generalization,
   that step does not exist; it is one more resolver.)

2. **The move is recursive — it applies to the value function, not just
   to content.** The residual worry that the *policy over cells* stays
   tabular (no generalization of *confidence* to unvisited signatures)
   dissolves by the identical primitive: use the embedding as an
   interpolating resolver *over signatures* — which the dense recommend
   path already does. The substrate interpolates both the content (the
   model's answer) and the policy (nearest converged cell) by the same
   mechanism.

3. **What is *not* free is measurement — and that is the advantage, not
   a cost.** A standalone transformer trusts itself globally and inherits
   its own walls (hallucination is provably unavoidable). The substrate
   treats it as an **untrusted resolver**: the validation back-half
   (§12.6) measures its output against the goal, and the forward arm
   learns a per-signature **competence map** — where the model is
   reliable, α climbs; where it fails, β climbs and selection routes
   away. Cost is priced by the cost-aware selector (§12.4), not paid
   blindly. The model's failure modes enter the trace store but are
   *quarantined* by the existing forward-arm + validation + cost
   machinery rather than inherited. The substrate ends up knowing
   something the model does not know about itself: the empirical
   boundary of where it can be trusted.

The §11 non-constructibility ceiling is unchanged either way — a better
resolver is not a constructive completion of the informational state,
but it does not worsen the limit either; resolver quality is orthogonal
to that ceiling. Net: the substrate is a thing that can hold any model
at arm's length and learn its trust-boundary; it is not a thing any
single model can hold.
