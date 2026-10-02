# Substrate Presentation — 2026-06

Eight slides. Minimal text. Speaker notes carry depth. Designed to convince
of technical feasibility and presenter competence, with differentiation
against frozen-LLM paradigms threaded through every slide.

## Design principles

- **Each slide = one load-bearing claim + one visual.** Slide text is anchor;
  the speaker carries the narrative.
- **Differentiation thread.** Every slide contrasts against the frozen-LLM
  paradigm at least implicitly.
- **The "doesn't work yet" bridge.** Carried on slide 4: this is a dynamical
  system whose trajectory is determined by initial conditions and interaction
  rules. Convergence is a mathematical consequence of well-posed primitives,
  not a hope. Same posture a physicist takes toward a well-posed simulation
  that hasn't finished running.
- **Competence signaling.** Precise citations dropped when asked depth
  questions: Borkar (two-timescale stochastic approximation), Amari
  (information geometry), Vamplew (Pareto-coverage limitation), Wagstaff
  (capacity lower bounds), Anthropic Circuit Tracing as the
  reverse-engineering target. Five names is sufficient.

---

## Slide 1 — Understanding LLM, ML and latent space embeddings

**On-slide text**

> Today's paradigm: optimize once, deploy frozen.
>
> Transformers · fixed `d_model` · pretrained embeddings · post-training: read-only.
>
> *Capability is paid up-front and amortized.*

**Visual**

A frozen lattice diagram. Rectangular grid labeled "residual stream — fixed
`d_model`"; behind the lattice, hatched shapes representing compiled-in
circuits (induction heads, attention patterns, MLP key-value memories). One
downward arrow above the lattice labeled "training (one-shot)"; many arrows
below labeled "inference (forever)."

**Alt-text**

> Diagram of a transformer as a fixed lattice representing the residual
> stream with `d_model` dimensions. Hatched shapes embedded behind the
> lattice depict pre-trained circuits — induction heads, attention patterns,
> MLP key-value memories — that are baked in at training time. One downward
> arrow labeled "training" enters the lattice once; many arrows labeled
> "inference" exit it, indicating the model is read-only after training.

**Speaker notes**

- LLMs are remarkable but structurally frozen. The graph of capabilities is
  compiled into the weight matrix during training and discoverable
  afterwards only by reverse engineering — that's the whole field of
  mechanistic interpretability.
- ML embeddings sit in this same regime: a fixed projection learned once,
  used indefinitely.
- This is the baseline I'll be comparing to. Everything else is just a
  different choice about *when* the structure gets fixed.

---

## Slide 2 — Reasoning over actions, not tokens

**On-slide text**

> Token prediction → action selection.
>
> Activities are typed, addressable, first-class.
>
> Composition graph is queryable at runtime — not buried in weights.

**Visual**

Side-by-side. Left: a horizontal token stream `t₁ → t₂ → t₃ → …` flowing
through an opaque dark rectangle labeled "implicit reasoning." Right: a
directed graph of activity nodes with typed input/output ports, edges
labeled with shape compatibilities, and Beta posteriors `(α, β)`
annotating each edge.

**Alt-text**

> Side-by-side comparison. Left panel: a horizontal sequence of token boxes
> with arrows flowing left to right, passing through an opaque dark
> rectangle labeled "implicit reasoning" — representing a transformer's
> token-by-token autoregressive generation. Right panel: a directed graph
> with circular activity nodes; each node has small colored ports for
> typed inputs and outputs; edges connect compatible ports and are labeled
> with Beta-distribution parameters alpha and beta — representing the
> substrate's queryable composition graph.

**Speaker notes**

- Token prediction is the wrong primitive for goal-directed work. It
  conflates *what to say next* with *what to do next*.
- The substrate's primitives are typed activities composed by shape
  compatibility. Selection is Thompson sampling over Beta posteriors per
  (state, activity) cell.
- Everything an LLM does implicitly inside weights, the substrate does
  explicitly in a graph it can introspect and edit.

---

## Slide 3 — The three states

**On-slide text**

> Informational · Transient · Observational
>
> Two motions: Recall (i→t→o) · Learning (o→t→i)
>
> The transient state is the steady state.

**Visual**

Three labeled circles in a triangle: top "Informational (i)" — structure,
templates, posteriors; bottom-left "Transient (t)" — execution in flight,
drawn larger and highlighted; bottom-right "Observational (o)" — recorded
traces. Two curved arrows: clockwise "Recall," counter-clockwise
"Learning." Both pass through the Transient circle, which is marked as
the invariant manifold.

**Alt-text**

> Three circles arranged in a triangle, labeled Informational at the top,
> Transient at the bottom-left (drawn larger and highlighted), and
> Observational at the bottom-right. Two curved arrows wrap the triangle:
> one clockwise labeled "Recall: informational to transient to
> observational," one counter-clockwise labeled "Learning: observational
> to transient to informational." Both arrows pass through the Transient
> circle, which is marked as the invariant manifold where the two motions
> intersect.

**Speaker notes**

- Three states, two motions. Recall consumes structure; learning produces
  it. Both pass through the transient.
- The system isn't trying to converge to a fixed point. It's trying to
  *stay in process* along the curve where forward learning and reverse
  learning agree.
- This is two-timescale stochastic approximation (Borkar 2008). It's a
  well-studied dynamical system — the invariant manifold exists, it's
  locally attracting, and we have decades of theory on it.

---

## Slide 4 — Learning as inferencing

**On-slide text**

> Every dispatch updates the posterior.
>
> α ← α + r,  β ← β + (1 − r)
>
> Conjugate update = natural gradient in Fisher–Rao metric.
>
> *Determined by initial conditions and interaction rules.*

**Visual**

Three Beta probability density plots across three frames (left to right):
broad uniform Beta(1,1) → moderate Beta(5,3) → sharp Beta(40,12). Below
each density, a small icon sequence: dispatch → update → next dispatch.

**Alt-text**

> Three Beta probability distribution plots arranged left to right showing
> posterior evolution. First plot: a broad nearly-uniform curve labeled
> Beta(1,1). Middle plot: a moderately peaked curve labeled Beta(5,3).
> Third plot: a sharply peaked curve labeled Beta(40,12). Below each plot
> is an icon sequence depicting a dispatch event, a posterior update arrow,
> and the next dispatch — illustrating that every execution refines the
> posterior.

**Speaker notes**

- There is no training-vs-inference split. Every dispatch is simultaneously
  a measurement and a learning step.
- The conjugate update for Beta-Bernoulli is provably the natural gradient
  under the Fisher–Rao metric — Fisher-efficient by construction. This is
  the Cramér-Rao optimal estimator for this problem; you cannot do better
  per sample.
- **Critical framing:** this is a dynamical system. Given the primitives
  (impulse, pointer, resolver, vessel) and the interaction rules (Thompson
  selection + Bayesian update + composition-chain credit propagation), the
  trajectory is *determined*. We are not waiting for emergence; we are
  running a well-posed system whose convergence properties follow from
  Borkar's TTSA theorem.

---

## Slide 5 — Self-Improvement

**On-slide text**

> Ribosome extracts templates from successful traces.
>
> Drafter authors variants on detected gaps.
>
> Variants compete via Thompson; topology grows monotonically.

**Visual**

Circular flow diagram. Four nodes around a circle: Trace → Ribosome →
Template → Dispatch → back to Trace. Off to the side: Drafter node
injecting new templates into the cycle, fed by Gap Detector. Each arrow
labeled (success pattern, registered template, sampled action, new trace).

**Alt-text**

> Circular flow diagram with four nodes arranged in a loop: Trace,
> Ribosome, Template, and Dispatch, connected by arrows in clockwise
> sequence. A fifth node, Drafter, sits outside the loop and injects new
> templates into the cycle via an arrow into the Template node. A sixth
> node, Gap Detector, feeds the Drafter with arrows representing unbound
> shapes and detected coverage gaps. Labels on the main loop arrows read
> "success pattern," "registered template," "sampled action," and "new
> trace."

**Speaker notes**

- Three mechanisms move structure from observed to informational: ribosome
  extracts templates from successful executions; drafter authors variants
  when the gap detector finds an unreachable shape; Thompson selection
  promotes what works.
- Once authored, every reuse increases prior confidence; ribosome-extracted
  templates ride the same posterior accumulation.
- Capacity grows monotonically. Frozen LLMs cannot do this; the substrate
  is doing it by construction.

---

## Slide 6 — Horizontal generalizability

**On-slide text**

> Same math at three scales.
>
> Trajectory · Vessel · Federation
>
> √k within dispatch · linear in vessels · √N in federation (shared cells)

**Visual**

Three concentric circles, each containing a copy of the same Bayesian
update primitive (a small Beta-distribution icon with α/β labels).
Innermost circle labeled "trajectory: parallel siblings"; middle
"substrate: vessels"; outermost "federation: peers." Arrows from the
primitive icon point outward at each scale.

**Alt-text**

> Three concentric circles depicting nested scales of the same primitive.
> The innermost circle is labeled "Trajectory — parallel siblings" and
> contains a small Beta-update icon. The middle circle is labeled
> "Substrate — vessels" and contains the same icon repeated. The outermost
> circle is labeled "Federation — peers" and again contains the same icon.
> Arrows radiate outward at each level, indicating the operation extends
> self-similarly across scales without new primitives.

**Speaker notes**

- The same factorization that makes within-substrate learning tractable
  applies recursively. Vessels add independent action subspaces; peer
  substrates add independent posteriors over shared signatures.
- Per-cell convergence accelerates as √k with parallel siblings, linearly
  with added vessels, √N with federated peers on shared cells.
- No new mathematics at any scale — this is the same Bayesian Q-learning
  all the way up. Federation is "vessel addition at one level up."

---

## Slide 7 — Scaling and compute complexity

**On-slide text**

> Substrate dispatch: ~10⁸ flops.
>
> LLM dispatch: ~10¹⁴ flops.
>
> Fleet of 10⁶ substrates < single frontier LLM serving compute.
>
> Capability grows in deployment; LLM is frozen.

**Visual**

Log-log axes. X = peer count N (10² to 10⁹). Y = aggregate annual compute
(flops, 10¹⁴ to 10²⁵). Two curves: substrate fleet rising linearly with N,
intersecting the horizontal "frontier LLM serving" line near N=10⁹. A
vertical dashed line at N=10⁴ labeled "coverage crossover." Annotation:
"fleet is online-improving; LLM is frozen."

**Alt-text**

> Log-log plot. Horizontal axis: peer count N from 10² to 10⁹. Vertical
> axis: aggregate annual flops from 10¹⁴ to 10²⁵. A diagonal line rises
> from lower-left to upper-right labeled "substrate fleet — N × per-
> substrate compute." A horizontal line near the top labeled "frontier
> LLM annual serving" sits at approximately 10²⁴ flops, intersecting the
> substrate fleet line near N=10⁹. A vertical dashed line at N=10⁴ is
> labeled "coverage crossover — fleet covers most structural
> decomposition." Annotation in the upper-left: "fleet capability grows
> in deployment; LLM is frozen post-training."

**Speaker notes**

- A million-substrate fleet uses roughly 4 orders of magnitude *less*
  compute per year than a single frontier LLM's serving. The fleet covers
  most structural decomposition at around 10,000 peers.
- The Beta-Bernoulli posterior update is Fisher-efficient — every flop
  reduces variance at the Cramér-Rao optimum. Transformer pretraining
  doesn't have this guarantee.
- Different cost regime entirely. LLM scaling is capital-intensive,
  centralized, one-shot. Substrate scaling is operating-intensive,
  distributed, continuous.

---

## Slide 8 — Risks and Constraints

**On-slide text**

> Frontier territory. Honest about open work.
>
> · Endogenous drafter quality bound
> · Heaps-tail dominates rare tasks
> · Locality routing must be informative
> · Coordination overhead at scale
> · LLM-free runtime; LLM-bootstrapped training

**Visual**

Two-column scorecard.

| Theorem-grounded (8) | Frontier (6) |
|---|---|
| Per-cell orthogonality measurement (ICA / pPCA) | Graph momentum as formal object |
| Revisit-based diagnostics (invariant causal prediction) | Runtime skill-graph expansion |
| Vector reward (Vamplew Pareto theorem) | Growing-action-set regret bounds |
| Two-timescale equilibrium (Borkar) | BNP-PSRL with state-action expansion |
| Natural gradient = conjugate update (Amari) | Authored-vs-trained distinction |
| Temporal-GNN message passing | Minimum-primitive-set closure proof |
| Manifold hypothesis with MDL minimum | |
| Lawvere-bounded closure | |

**Alt-text**

> Two-column scorecard. Left column header "Theorem-grounded — 8 items"
> lists: per-cell orthogonality measurement; composition-graph revisit
> diagnostics; Vamplew Pareto-coverage theorem for vector reward; Borkar
> two-timescale stochastic approximation for the dual-arm invariant
> manifold; Amari natural-gradient identification for Beta-Bernoulli
> updates; temporal-GNN message-passing structure; manifold hypothesis
> with MDL-minimum per-activity dimensionality; Lawvere-bounded closure
> of the four-primitive minimum. Right column header "Frontier — 6 items"
> lists: graph momentum as a formal object; runtime skill-graph node
> addition; growing-action-set regret bounds; Bayesian-nonparametric
> posterior-sampling RL with state-action expansion; authored-versus-
> trained vessel distinction; minimum-primitive-set closure proof. Below
> both columns, a footnote reads "frontier items share a common shape:
> runtime expansion of structured Bayesian objects."

**Speaker notes**

- Honest scorecard. Eight pieces have citable formal results behind them.
  Six pieces are at the research frontier — meaning we are operating
  without published Õ(√T)-style guarantees, but the structural arguments
  hold.
- The frontier items share a common shape: runtime expansion of structured
  Bayesian objects. This is the same gap across all six, which suggests
  one piece of theory closes them together.
- The runtime is LLM-free under the endgame. The bootstrap — training the
  endogenous drafter — uses an LLM once. After that, the fleet sustains
  itself on its own compute and its own observations. **The bet that has
  to be true is that most useful interpolation has structural form
  recoverable from grounded traces. The substrate is the way to find out.**

---

## Delivery notes

**The "doesn't work yet" bridge.** Don't apologize. Frame it on slide 4:
*"This is a dynamical system. Given the primitives and the interaction
rules, the trajectory is determined. We are running it — convergence
follows from Borkar's TTSA theorem. The mathematics is settled; what we
are doing is engineering the boundary conditions."* Same posture a
physicist takes about a well-posed simulation that hasn't finished running.

**Differentiation hooks** (one per slide):

| Slide | Hook |
|---|---|
| 1 | frozen vs live |
| 2 | tokens vs typed actions |
| 3 | forward pass vs invariant manifold |
| 4 | backprop vs Fisher-efficient conjugate update |
| 5 | post-training freeze vs monotone capacity growth |
| 6 | single-scale architecture vs scale-invariant recursion |
| 7 | 10⁴–10⁶× cheaper at fleet scale |
| 8 | honest scorecard (competence signal) |

**Citation cluster** to drop when asked depth questions:

- Borkar, *Stochastic Approximation: A Dynamical Systems Viewpoint* (2008) — two-timescale theorem
- Amari, *Methods of Information Geometry* (2000) — natural gradient identification
- Vamplew et al., *Scalar reward is not enough* (arXiv:2112.15422) — Pareto-coverage
- Wagstaff et al., *Universal Approximation of Functions on Sets* (arXiv:2107.01959) — capacity lower bounds
- Anthropic, *Circuit Tracing* (transformer-circuits.pub/2025/attribution-graphs/methods.html) — the reverse-engineering target

Five names is enough to demonstrate grounding without lecturing.

**Single-sentence summary to memorize and deploy under pressure:**

> "The substrate is the same Bayesian Q-learning math the field has been
> refining for thirty years, composed across three scales with a
> Fisher-efficient update rule, with the activities held as first-class
> objects instead of compiled into weights."

---

## Recent industry context (positioning hooks for the speaker)

The market posture as of mid-2026 is unusually favorable to a frozen-LLM
critique. Five concrete narratives the audience is already living in, each
with a specific anchor the speaker can drop:

### 1. Gigawatt compute centralization — concretizes "capital intensive vs distributed"

- **Anthropic Series H: $65B raise, ~$965B post-money (May 28, 2026).**
  Run-rate revenue ~$47B. Most valuable AI startup; IPO imminent.
  [CNBC](https://www.cnbc.com/2026/05/28/anthropic-open-ai-startup-value.html)
- **OpenAI $122B round at $852B post-money (March 2026)** — "IPO rehearsal."
- **Compute deals now measured in gigawatts:** Anthropic–SpaceX 300 MW /
  220k GPUs (May 2026); AWS 5 GW commitment to Anthropic; Google/Broadcom
  5 GW TPUs from 2027; Microsoft/NVIDIA $30B Azure capacity for OpenAI.
- **Concrete speaker line for Slide 7:** *"While Anthropic is buying 300
  megawatts of compute, a million-substrate fleet would use four orders of
  magnitude less per year — and improve in deployment rather than being
  frozen at training."*

### 2. ARC-AGI-3 brittleness — empirical evidence for "wrong primitive"

- **ARC-AGI-3 (March 2026):** humans 100%, frontier LLMs **<1%**, simple
  CNN baselines 12.58%. [arXiv 2603.24621](https://arxiv.org/pdf/2603.24621)
- **Sutskever (NeurIPS 2024):** "Pretraining as we know it will end... the
  2010s were the age of scaling, now we're back in the age of wonder and
  discovery." Still the most-cited cultural reference for the shift.
- **GPT-5 reception (Aug 2025):** widely characterized as the moment the
  "bigger is better" era ended. User-perceived 4→5 gap smaller than
  3.5→4 despite higher capability scores.
  [Frank's World](https://www.franksworld.com/2025/08/22/gpt-5-have-we-finally-hit-the-ai-scaling-wall/)
- **Concrete speaker line for Slide 2:** *"Frontier LLMs score under 1
  percent on ARC-AGI-3. A simple convolutional baseline scores 12. The
  primitive is wrong — token prediction conflates what to say with what
  to do."*

### 3. Post-LLM thesis just got serious capital — legitimizes alternatives

- **AMI Labs $1.03B seed at $3.5B pre-money (March 2026)** — NVIDIA,
  Samsung, Bezos Expeditions backing the JEPA / world-model thesis.
  Largest seed of the cycle.
- **LeWorldModel (LeWM, March 2026):** LeCun + Mila + NYU + Samsung SAIL —
  first JEPA that trains stably end-to-end from raw pixels.
  [le-wm.github.io](https://le-wm.github.io/)
- **LeCun (Spring School AI For Impact, March 2026):** "Any system modeling
  the world by trying to reconstruct pixels is doomed because most of what
  happens in a video is intrinsically unpredictable."
- **Concrete speaker line for Slide 1:** *"A billion dollars seeded into
  AMI Labs in March on the thesis that transformers are the wrong shape.
  The substrate is making a related bet — different mechanism, same posture
  about post-LLM architectures."*

### 4. Mechanistic interpretability as a $1.25B venture category

- **Goodfire Series B: $150M at $1.25B valuation (February 2026).** B
  Capital, Eric Schmidt, Salesforce Ventures, DFJ Growth. Follows
  Anthropic-participated $50M Series A (April 2025).
- **Anthropic Circuit Tracer (June 2025) open-sourced;** extended through
  2026 to Gemma-2-2B, Llama-3.1-1B, Qwen3-4B.
  [Anthropic](https://www.anthropic.com/research/open-source-circuit-tracing)
- **Cross-lab CLT (Cross-Layer Transcoders) collaboration:** Anthropic +
  Decode + EleutherAI + Goodfire + Google DeepMind reproducing attribution
  graphs on shared circuits.
- **Concrete speaker line for Slide 1:** *"Goodfire just raised $150
  million at a billion-and-a-quarter to reverse-engineer activities out of
  frozen weight matrices. We're proposing to keep those activities
  unfrozen — same primitives, different time-of-fixing."*

### 5. Regulation creates tailwind for auditable + decentralized

- **EU AI Act enforcement: August 2, 2026.** All general-purpose AI models
  must disclose training data sources, energy consumption, known
  limitations. Unacceptable-risk systems banned outright.
  [Holland & Knight](https://www.hklaw.com/en/insights/publications/2026/04/us-companies-face-eu-ai-acts-possible-august-2026-compliance-deadline)
- **Trump Executive Order, December 11, 2025:** conditions $42B of
  broadband infrastructure funding on state-AI-law repeal. Federal
  posture is anti-fragmentation; market posture is fragmenting anyway.
- **Apple Foundation Models, WWDC 2026:** 3B-param on-device LLM exposed to
  third-party Swift developers. Privacy + latency framed explicitly as the
  product, not the cost. Validates the on-device + composition direction.
  [ofox.ai](https://ofox.ai/blog/apple-foundation-models-3-wwdc-2026-developer-read/)
- **Concrete speaker line for Slide 8:** *"The substrate's auditable trace
  chain, per-cell posteriors, and explicit composition graph land naturally
  into the regulatory environment the EU AI Act is making mandatory in
  August. We're aligned with where the policy is going."*

### Bonus: agent-company benchmarks for the "is this category fundable" question

- **Cognition (Devin) raised >$1B at $26B valuation (2026)**; revenue $37M
  → $492M in 12 months. Goldman, Mercedes-Benz, US government as
  customers. Demonstrates: agent-system companies *are* being funded at
  scale; the category is live.
  [TNW](https://thenextweb.com/news/cognition-just-raised-1-billion-at-a-26-billion-valuation-and-90-of-its-own-code-is-written-by-its-ai)
- **Claude Computer Use (Opus 4.5):** 66.3% on OSWorld; new "Zoom Action."
  Palo Alto Networks reports 3,500 devs on Claude Code with 30% velocity
  gain. The "agents do real work" thesis is now a deployed reality, not a
  hypothetical.

### One-paragraph framing the speaker can open or close with

> *"AI compute is centralizing into gigawatt data centers. Anthropic and
> OpenAI valuations are at $965 billion and $852 billion. GPT-5 landed
> with the cultural verdict that scaling has fraying returns. ARC-AGI-3
> shows frontier LLMs score under 1% where simple CNN baselines score 12.
> AMI Labs raised a billion-dollar seed on the post-transformer thesis.
> Goodfire raised $150 million to recover activities from frozen weight
> matrices. Apple shipped on-device foundation models to third-party
> developers. The EU AI Act mandates training-data and energy-cost
> disclosure starting August. The market is open to a different shape
> of AI system. We are proposing the simplest one that survives the math:
> keep the activities unfrozen, let the substrate improve in deployment,
> and let federation handle scale. The architecture is determined; we are
> running it."*
