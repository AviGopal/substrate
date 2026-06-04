# Successor-feature decomposition of Q (learning-rate mechanism #7)

## Substrate concept anchors

- **Primary mechanism — `concept_49XNzJTL7E8V`** (`successor_feature_decomposition_of_q`):
  > Learn ψ(s,a)=expected discounted shape-occupancy and R(s,a) separately;
  > Q=⟨ψ,R⟩. Decouples reward estimation from transition estimation. Transfer
  > becomes free across reward functions; critical for federation trust-free
  > signal.

- **Umbrella initiative — `concept_TbN0eSf7U_hM`** (`learning_rate_improvement_mechanisms`):
  parent grouping concept for the rate-improvement family. This proposal is
  mechanism #7 — the "cross-cell information sharing under reward change"
  spoke of the rate-improvement star.

- **Vocabulary gate — `concept_7mzv7SQN_7JB`** (user_preference, "don't invent
  new substrate tiers"). Restated under the four primitives:

  | Primitive | Used as |
  |---|---|
  | **impulse** | ψ is stored as a `successorFeatures` impulse — a vector of expected discounted shape-occupancy counts, keyed by `(signature, template)`. Resolved like any other impulse via `/v2/impulses/resolve`. |
  | **activity** | No new activity tier. Existing templates remain the action space `A(s)`. ψ is a *posterior summary* over what they produce, not a new kind of action. |
  | **signature** | ψ keys the same `(signature, template)` cells the Thompson posterior keys. One-to-one with `variant_performance_metrics` rows. |
  | **Thompson-per-arm** | Q is now `⟨ψ_a, R⟩`; the Beta posterior on `R(s,a)` (success/failure) remains. The α/β contract on `variant_performance_metrics` is unchanged. ψ is an *added* statistic, not a replacement. |
  | **scope (org/account/global, peer for federation)** | ψ inherits the same scope hierarchy. Federation peer-scope ψ aggregates trust-free; reward R does not. This asymmetry is the whole point. |

- **Adjacent / consequent concepts** (cited, not re-minted):
  - `concept_DQWZPkvnhxhO` (`per_task_input_impulse_shapes`) — the raw signal ψ
    is computed from. Every task in a trace already carries `input_impulse_shapes`
    and `output_impulse_shapes`; ψ is the per-trajectory expectation of the
    shape-occupancy vector aggregated over the discounted trace prefix.
  - `concept_aWoG_VMt-EhV` / `concept_EaAYU3p6LsxT` (`thompson_posterior`) —
    the reward posterior R-side. Unchanged. ψ rides alongside.
  - `concept_stBIhX6Fouku` (`layered_abstraction_hierarchy_grounded_in_traces`)
    — ψ is the dual of layered abstraction: instead of grouping activities by
    output-shape *vocabulary*, group by *expected shape-occupancy density*.
    Layers fall out of ψ as a quotient by reward.
  - `concept_eSoms8g__1oP` (`federation_learning_at_scale_dynamics`) — names
    behavioral-continuation as the federation trust signal. ψ is the
    statistic behavioral-continuation reduces to: replay-success on a novel
    reward function is exactly `argmax_a ⟨ψ_a, R_new⟩`.
  - `concept_s5ea1xUxhG-4` (`topology_discovery_is_the_purpose`) — ψ is the
    direct estimator of the substrate's local topology around each cell.
  - Adjacent learning-rate mechanisms in the same umbrella:
    `concept_vugylIHzIMvk` (#1 embedding-conditioned posterior) — orthogonal
    on prior parameterization; `concept_uTVZPoaxMmo2` (#2 concept-conditioned
    prior) — orthogonal on cold-cell warm-start;
    `concept_u9KSvyDVjxoO` (information-directed sampling) — replaces the
    *selection rule* over Q, not Q's factorization. All compose with #7.

## The math, in substrate vocabulary

### Background: Dayan (1993) successor representation; Barreto et al. (2017) successor features

For a finite MDP `(S, A, P, R, γ)`, the standard action-value function is

```
Q^π(s, a)  =  E_π[ Σ_{k=0..∞} γ^k r_{t+k}  |  s_t = s, a_t = a ]
```

Dayan's insight: if `r_t` is **linear** in a feature map `φ : S × A → R^d`,
i.e. `r(s, a) = φ(s, a) · w` for some reward weights `w ∈ R^d`, then

```
Q^π(s, a)  =  E_π[ Σ_k γ^k φ(s_{t+k}, a_{t+k})  |  s_t = s, a_t = a ]  ·  w
          =  ψ^π(s, a)  ·  w
```

`ψ^π(s, a) ∈ R^d` is the **successor feature**: the expected discounted
*occupancy* of the feature vector under the trajectory rolled out from `(s, a)`
under policy `π`. It is a property of `(π, P, φ, γ)` only — **independent of
the reward weights `w`**.

Barreto et al. (2017, arXiv:1606.05312) extend this to transfer across tasks
sharing dynamics: if task `i` has weight vector `w_i` and task `j` has `w_j`,

```
Q^π_i(s, a) = ψ^π(s, a) · w_i
Q^π_j(s, a) = ψ^π(s, a) · w_j        — same ψ, different w
```

so a policy trained on task `i` can be evaluated on task `j` with **zero new
trajectory samples** — only `w_j` needs to be estimated. They prove (Theorem 1
of the paper) a regret bound where the suboptimality of acting greedily under
`(ψ, w_j)` is `O(‖w_j − w_i‖_∞ · max_a ‖φ(s, a)‖₁ / (1 − γ))`. Transfer is
*free* in samples, *bounded* in suboptimality by the task-distance in reward
weights.

### Mapping onto the substrate

The substrate's `(s, a)` is `(signature, template)`. The reward is per-trace
success — a Bernoulli — so `R(s, a) = p_succ(s, a) ∈ [0, 1]`. The natural
feature map `φ` is **the output shape vector** of the cell:

```
φ : (signature, template) → R^{|Σ|}        Σ = vocabulary of shapes
φ_k(s, a) = 1 if shape_k ∈ output_shapes(s, a) else 0
```

`|Σ|` ≈ low thousands (concept-db's shape vocabulary, growing per Heaps' law).

Then for a fixed policy `π` (here: Thompson posterior + selection rule),

```
ψ^π(s, a)  =  E_π[ Σ_{k=0..∞} γ^k φ(s_{t+k}, a_{t+k})  |  (s, a) ]
```

is the **expected discounted shape-occupancy** of the trace continuation
rooted at `(s, a)`. The substrate already records every task's
`input_impulse_shapes` and `output_impulse_shapes`
(`repos/metabob-activity-api/src/models/schemas.ts:297-298`,
`schemas.ts:432-433`, `schemas.ts:450-452`,
migration `045-composition-graph-extended-fields.surql:32-33`). Every
completed trace is one Monte-Carlo sample of ψ.

The reward decomposition is

```
R(s, a) ≈ p_succ(s, a) = w · φ(s, a)
```

where `w ∈ R^{|Σ|}` is the reward-weight vector — *which output shapes
correlate with success*. The Beta posterior on `p_succ` is then a posterior
on `w · φ` for the *observed* φ; transfer is the act of evaluating
`w_new · φ` for novel `w_new` (a novel goal) using the same ψ.

### Estimator

For each completed trace `τ = (s_0, a_0, s_1, a_1, …, s_T)` with per-task
output-shape vectors `φ_t`, the trace's contribution to `ψ(s_0, a_0)` is

```
ψ̂_τ(s_0, a_0) = Σ_{t=0..T} γ^t φ_t
```

The substrate's online estimator is the Robbins-Monro update

```
ψ̂_{n+1}(s, a) = ψ̂_n(s, a) + η_n · ( ψ̂_τ(s, a) − ψ̂_n(s, a) )
```

with `η_n = 1/n` for the empirical-mean variant (Bayes-optimal under
exchangeable traces), or a fixed small `η ∈ (0, 1)` for a
recency-weighted variant tracking drift.

Reward-weight estimation is the existing Thompson posterior on `p_succ` with
the inversion

```
ŵ = argmin_w  Σ_traces ( y_τ − w · φ_τ )²       y_τ = success ∈ {0, 1}
```

solved as ridge regression with regularization `λ` over the cells already
visited. `λ` defaults to 1 to keep cold cells at a neutral prior.

### Convergence

Per Barreto et al. Theorem 1, evaluating `(ψ̂, ŵ_new)` is suboptimal by at
most

```
Δ ≤ 2 · ‖ŵ_new − ŵ‖_∞ · (max_a ‖φ_a‖_1) / (1 − γ)
```

versus the optimum on the new task, plus the standard Bayesian regret bound
on `w_new` itself. The substrate already pays the `O(√(T log T))` Beta-Bernoulli
regret per cell for `w`; ψ adds **no new regret term** for shared transitions
— it is a sufficient statistic over shape-occupancy that converges at
`O(1/√n)` per cell under i.i.d. trace sampling, faster (square-root in trace
count, not in cells) than independent per-cell estimation of `Q`.

The transfer guarantee compounds with the substrate's existing scope
hierarchy: `ψ_org` partial-pools over `ψ_global` exactly like the Beta
posterior partial-pools today (`SUBSTRATE_AS_MDP.md:539-545`). No new
mechanism; the existing pooling rule applies coordinate-wise on ψ.

## Why this enables federation trust-free transfer

`SUBSTRATE_AS_MDP.md:281-299` names horizontal composition (and at one level
up, federation) as posterior aggregation across independent action subspaces
sharing a signature schema.
`SUBSTRATE_AS_MDP.md:614-616` and `:617-620` flag two limits behavioral-continuation
alone cannot cross: (a) abstract templates whose effects aren't observable
locally, and (b) novel signatures unique to one peer.

ψ relaxes (a) and (b) for the *intersection* case — when peer `j` has
explored a signature `s` peer `i` has never seen, but the *output shapes*
under `(s, a)` are in the shared vocabulary:

- Peer `j` ships `ψ_j(s, a)` to peer `i`. ψ is **only output-shape occupancy** —
  no private rewards, no goal-specific success labels, no operator messages.
  It is structurally identical to a `concept_usage_stats` count, just
  weighted and discounted. Trust-free under H1/H2: if shape signatures are
  schema-attestable (H2: pubkey-bound), peer `i` can verify ψ refers to a
  shape-vector it recognizes.
- Peer `i` evaluates `Q_i(s, a) = ψ_j(s, a) · w_i` where `w_i` is **peer
  `i`'s own reward weights** — learned on peer `i`'s own behavioral-
  continuation traces. Reward is *never* shared; only the transition-side
  statistic is.
- `SUBSTRATE_AS_MDP.md:499` ("Cross-substrate (federation) | … aggregate
  posterior under provenance weighting | √N_peers per cell for shared
  signatures") quantifies the speedup. The √N_peers acceleration applies
  to ψ coordinate-wise; w stays per-substrate. This is the **factorization**
  §9 of SUBSTRATE_AS_MDP names but doesn't operationalize.

Concretely, the federation rule for ψ at peer `i` aggregating from N peers is

```
ψ_i^{fed}(s, a) = Σ_j (n_j / Σ_k n_k) · ψ_j(s, a)        (provenance-weighted)
```

with `n_j` = peer `j`'s sample count at `(s, a)`. The variance bound is

```
Var[ψ_i^{fed}(s, a)] = O(1 / Σ_j n_j)
```

i.e. **pooled across peers**. Reward stays local:

```
Q_i^{fed}(s, a) = ψ_i^{fed}(s, a) · ŵ_i
```

The peer that contributes ψ never sees `ŵ_i`. The peer that consumes ψ never
trusts `ŵ_j`. Behavioral-continuation gates the import (`SUBSTRATE_AS_MDP.md:652`):
if `Q_i^{fed}(s, a) · π_greedy` outperforms peer `i`'s local baseline on
peer `i`'s own held-out traces, ψ_j is empirically validated; otherwise
discarded with `provenance_penalty++`. This is the **only** federation
mechanism that gives the √N speedup §9.2 promises without leaking reward
signal.

§9.5's empirical lift criterion ("behavioral-continuation replay-success of
cross-imported templates stays above each peer's local baseline" for 3
windows) becomes operationalizable: the import unit is ψ, not whole templates.

## Existing surface ψ rides on

| Concern | Existing location | Δ for ψ |
|---|---|---|
| Per-task output shapes | `repos/metabob-activity-api/src/models/schemas.ts:297-298` (ExecutionRecordSchema), `:432-433` (CompositionEdgeSchema), `:450-452` (CompositionRecordRequestSchema); migration `045-composition-graph-extended-fields.surql:32-33` | **None.** ψ is computed from these fields. Read-only consumer. |
| Per-cell Thompson α/β | `variant_performance_metrics` table; resolver `repos/metabob-activity-api/src/routes/impulses.ts` `thompson_posterior` case | **None.** ψ is a *sibling* statistic, not a replacement. |
| `composition_chain` denormalization | already on `activity_execution_traces` | Used by ψ-estimator to walk a trace's discounted prefix. Read-only. |
| Discovery shapes | `repos/metabob-activity-api/src/config.ts` `config.discovery.shapes` | Add one entry: `successorFeatures`. |
| Impulse dispatch | `repos/metabob-activity-api/src/routes/impulses.ts` shape-switch | Add one `case 'successorFeatures'`. |
| Shape vocabulary | concept-db `shape` records | **None.** ψ indexes by existing shape ids. |

The pattern is identical to mechanism #1 (embedding-conditioned posterior)
and #2 (concept-conditioned prior): one shape, one resolver case, one
storage table, no new tier.

## ψ shape contract

```ts
// successorFeatures impulse — resolver returns the estimated ψ vector for a cell
{
  shape: 'successorFeatures',
  pointer: {
    type: 'successorFeatures',
    signature: '<state-space-signature>',      // see concept_state_space_signature
    template_id: 'activity:<id>',              // arm key
    discount?: number,                          // γ, default 0.9
    scope?: 'org' | 'account' | 'global' | 'peer'   // partial-pool level
  }
}

// Resolver response body:
{
  signature: string,
  template_id: string,
  discount: number,
  scope: string,
  vector: { [shape_id: string]: number },       // sparse map — shapes with ψ_k > ε
  sample_count: number,                          // n traces contributing
  last_updated: string,                          // ISO 8601
  variance_estimate?: number                     // optional Welford variance
}
```

Sparse-map encoding (not dense `R^{|Σ|}`) because ψ over a vocabulary of
thousands is empirically sparse — a trace prefix touches O(10–50) shapes
out of O(10³). Storage and wire cost stay O(occupied shapes) per cell.

## Storage schema

Add **one table**, `successor_features`, mirroring the
`variant_performance_metrics` row shape:

```sql
DEFINE TABLE successor_features SCHEMAFULL
  PERMISSIONS FOR select, update, delete WHERE org_id = $token.org_id;

DEFINE FIELD signature ON successor_features TYPE string;
DEFINE FIELD template_id ON successor_features TYPE string;
DEFINE FIELD discount ON successor_features TYPE float DEFAULT 0.9;
DEFINE FIELD scope ON successor_features TYPE string DEFAULT 'org';
DEFINE FIELD org_id ON successor_features TYPE option<string>;
DEFINE FIELD account_id ON successor_features TYPE option<string>;
DEFINE FIELD vector ON successor_features FLEXIBLE TYPE object;   -- sparse {shape: float}
DEFINE FIELD sample_count ON successor_features TYPE int DEFAULT 0;
DEFINE FIELD variance_estimate ON successor_features TYPE option<float>;
DEFINE FIELD updated_at ON successor_features TYPE datetime DEFAULT time::now();

DEFINE INDEX sf_cell_idx ON successor_features
  FIELDS signature, template_id, scope UNIQUE;
```

One row per `(signature, template, scope)` — matches the Thompson cell
cardinality exactly. Federation `peer-scope` ψ is **the same table**, with
`scope = 'peer'` and a `peer_id` field on the vector — identical pattern to
how scope is overloaded on `variant_performance_metrics` today.

## Implementation choice: **observer**, not resolver-only

The resolver case (`successorFeatures` read) is necessary for binding-layer
consumption — the selector needs to query ψ for `argmax`. But ψ itself must
be **updated on every trace completion** without coupling the trace-write
path to the math. The clean shape is:

- **Observer**: a new lifecycle subscriber on `trace.completed` events
  (analogous to the ribosome-vessel pattern: WebSocket client to
  `activity-api:8080/ws`, subscribes to `task.completed` /
  `execution:succeeded`, processes asynchronously). For each completed trace
  it (a) walks the trace's discounted prefix, (b) accumulates per-task
  output-shape vectors, (c) emits a `successorFeatures_write` impulse with
  the Robbins-Monro delta.
- **Resolver**: the existing `/v2/impulses/resolve` dispatcher gets a
  `successorFeatures` case (read) and a `successorFeatures_write` case
  (write — admin-scope, idempotent UPSERT). Read serves the selector;
  write serves the observer.

Why observer over inline-on-trace-write: ψ math is hot-path-irrelevant for
the trace-store contract (which must accept *any* trace, ψ-computable or
not). Decoupling means a broken ψ-estimator never blocks trace ingestion —
identical to ribosome's relationship to template extraction. The observer
can be implemented as a small substrate vessel (`successor-features-vessel`,
port 8270, follows the TYPESCRIPT_VESSEL_TEMPLATE pattern) or as a
systemd unit inside the single-container substrate.

**Recommendation**: ship as a substrate-hosted observer vessel
(`successor-features-vessel`) to keep the activity-api blast radius zero
during rollout. Migrate the resolver case into activity-api once ψ has
stabilized in canary, *if* the read-side hot-path requires it; otherwise
the observer vessel can serve reads too via its own discovery-advertised
shape.

## Acceptance

The behavioral-continuation criterion is the right gate; it is also exactly
what §9.5 of SUBSTRATE_AS_MDP requires for federation-grade evidence.

1. **Replay-success on novel reward functions with shared transitions.**
   Construct an offline replay harness that:
   - takes a window of completed traces with goals `G_old`,
   - holds out 20% as a test set,
   - trains `ψ̂` and `ŵ_old` on the 80%,
   - synthesizes a novel goal `G_new` whose output-shape weights `w_new` differ
     from `w_old` by a controlled L1 distance (e.g. swap two high-weight
     shapes),
   - measures `argmax_a ⟨ψ̂_a, w_new⟩` selection accuracy on the held-out
     traces vs. (a) Beta-Thompson alone, (b) uniform-random.
   The criterion passes if SF selection outperforms Beta-Thompson selection
   by ≥ 15% on top-1 template accuracy across ≥ 3 distinct (`w_old`, `w_new`)
   pairs with `‖w_new − w_old‖_1 / ‖w_old‖_1 ≥ 0.3`.

2. **No regression on existing reward function.** SF selection must
   match Beta-Thompson selection on `G_old` itself (i.e. when `w_new = w_old`)
   within ± 2% top-1 accuracy. ψ adds capacity, never subtracts.

3. **ψ cells converge.** Per-cell `variance_estimate` should fall below
   `0.05` for cells with `sample_count ≥ 30`. Cells that don't converge
   indicate non-stationary `(P, R)` at that cell — a useful detector in
   its own right.

4. **Memory and storage budget.** ψ storage stays under 2× the size of
   `variant_performance_metrics` (sparse-map encoding sees the vector
   compress to O(10–50) non-zero entries per cell at observed shape
   vocabularies).

Acceptance is offline-replay-driven. Live federation eval is out of scope
(see below).

## Out of scope

- **R-only changes** — the reward decomposition `R = w · φ` is approximated;
  improvements to `ŵ` estimation (richer regressors, embedding-conditioned
  ŵ priors) belong in mechanism #1 (embedding-conditioned posterior, already
  proposed).
- **Federation-share protocol** — H1/H2/H3/H4 (signed attestations, vessel
  pubkey identity, scope attestations, quorum ratification) are
  prerequisites for cross-substrate ψ sharing. This proposal lands the
  *primitive*; the wire protocol for shipping ψ between peers belongs in a
  separate vessel-federation-extension spec (parent:
  `openspec/changes/2026-05-23-vessel-federation/`).
- **Information-directed sampling over (ψ, w)** — IDS as a selection rule
  over Q-decomposed factors is a follow-up; this proposal lands the
  decomposition itself. The selector keeps Thompson semantics (sample
  `w ~ Posterior(w | history)`, evaluate `argmax_a ψ̂_a · w_sample`).
- **Dense-ψ encoding / neural successor features** — Barreto's deep-SF
  variants (DSF, USFAs) trade tractability for capacity. Substrate's
  vocabulary is small enough that sparse-map storage is sufficient for
  the relevant regime.
- **Selector wiring** — `successorFeatures` consumption by the binding
  layer is a separate change (the binding layer's `argmax` call needs
  to know it can ask for ψ). This proposal ships the producer; the
  consumer follows once ψ has trace-window coverage.
