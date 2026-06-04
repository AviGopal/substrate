# Learning-Rate Refinement M5 — Information-Directed Sampling over Thompson

> **Status:** spec-only — no implementation in this change.
> **Anchor concept:** `concept_u9KSvyDVjxoO` (information_directed_sampling_over_thompson)
> **Parent concept:** `concept_TbN0eSf7U_hM` (substrate-as-MDP learning-rate refinements)
> **Discipline gate:** `concept_7mzv7SQN_7JB` — no new tiers; this refines the **selection step** only, leaves the four substrate primitives and three scopes intact.
> **Hard dependency:** **M1** — `concept_vugylIHzIMvk` (embedding-conditioned posterior). Without M1, EIG computation is significantly more expensive (Monte Carlo over posterior samples). M1 must ship first.

---

## 1. Substrate framing

The substrate (see `docs/architecture/SUBSTRATE_AS_MDP.md`, `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`, `docs/architecture/LITERATURE_COMPARISON.md`) is factored Bayesian Q-learning on an open-world MDP. Activities are arms; their α/β posteriors (`concept_EaAYU3p6LsxT`, `concept_AIh9mrDEZcmJ`) parameterise per-template success-rate beliefs. Selection today is **pure Thompson Sampling**: draw one sample from each arm's Beta, pick argmax.

Thompson is provably near-optimal on **independent-arm** bandits. The substrate's regime is the opposite: templates **share resolvers**, signatures **share shapes**, variants share parent template lineage. Observing one arm's outcome propagates Bayesian information to its correlated neighbours — information Thompson never spends a pull to collect. The substrate already encodes this correlation structure as concept-graph edges and (post-M1) as embedding-conditioned posteriors.

**Information-Directed Sampling** (Russo & Van Roy, JMLR 2018) is the principled fix: at each step, pull the arm that minimises the ratio of squared expected regret to expected information gain. On correlated-arm benchmarks IDS achieves **2–5× regret reduction** over Thompson while preserving Thompson's no-prior-tuning property. The substrate's correlation regime is exactly where IDS dominates.

This change is M5 in the learning-rate refinement series:

| M | Refinement | Anchor concept | Depends on |
|---|------------|----------------|------------|
| M1 | Embedding-conditioned posterior | `concept_vugylIHzIMvk` | — |
| M2 | Hierarchical signature clustering | `concept_skw2SmuLHZlN` | M1 |
| M3 | Per-step bus conditioning | `concept_CD8s3H1N_0G8` | — |
| M4 | Stratified posteriors by failure-mode | (planned) | — |
| **M5** | **Information-directed sampling** | **`concept_u9KSvyDVjxoO`** | **M1 (strongly preferred)** |

M5 does **not** introduce a new posterior, store, scope, or primitive. It replaces a single function — the selection rule used inside `POST /v2/activities/recommend` — with one that consumes posterior moments + an EIG estimator and emits the same `recommendations[]` payload.

---

## 2. Information-Directed Sampling — mathematical derivation

### 2.1 Setup

Let `A = {a_1, …, a_K}` be the candidate activity templates after compatibility filter (`repos/metabob-activity-api/src/services/recommendation.ts:74` `applyCompatibilityFilter`). Let `θ` be the (joint) latent parameter — template-level Bernoulli means under Thompson, embedding-conditioned posterior under M1. Let `Q(a; θ) = E[reward | a, θ]` be the per-arm value.

Define under the current posterior `p(θ)`:

- **Expected value:** `μ(a) = E_θ[Q(a; θ)]`
- **Optimal value:** `V* = E_θ[max_a Q(a; θ)]`
- **Expected regret of arm a:** `Δ(a) = V* − μ(a)`
- **Information gain of arm a:** `g(a) = E_θ,o[ H(p(θ)) − H(p(θ | a, o)) ]`
  where `o` is the observed outcome (success/failure for Bernoulli; full task trace for the substrate). This is the **expected reduction in posterior entropy** about `θ` from observing arm `a`'s outcome.

### 2.2 IDS objective

IDS selects:

```
a* = argmin_a  Ψ(a)         where  Ψ(a) = Δ(a)² / g(a)
```

Intuition: an arm is worth pulling either because it has low expected regret (exploit) **or** because pulling it teaches a lot about the joint posterior (explore, weighted by how that knowledge reduces future regret). The squared regret in the numerator is what gives IDS its sub-linear regret bound (Russo & Van Roy 2018, Theorem 1: Bayesian regret ≤ √(K · T · log K) · sup_t Ψ_t).

### 2.3 Randomised IDS

The clean form draws a distribution `π` over arms to minimise `Δ(π)² / g(π)` over the simplex. The optimum is supported on at most two arms (Russo & Van Roy 2018, Prop. 6). We adopt the **two-arm randomised IDS**:

1. Compute `Δ(a)` and `g(a)` for every `a ∈ A`.
2. Find the pair `(a, a')` and mixing weight `q ∈ [0,1]` minimising
   `[q·Δ(a) + (1−q)·Δ(a')]² / [q·g(a) + (1−q)·g(a')]`.
3. Sample `a*` from `Bernoulli(q)`.

The 2-arm search is O(K²); K ≤ ~50 in substrate `/recommend` payloads so this is trivially affordable.

### 2.4 Why correlated arms favour IDS

Under Thompson with **independent** Beta posteriors, observing a's outcome doesn't shift `p(θ_{a'})` for `a' ≠ a`. So `g(a) = H(Beta(α_a, β_a)) − E[H(Beta(α_a + r, β_a + (1−r)))]` is local and similar across arms; the `argmin` collapses to roughly `argmax μ(a)`, recovering Thompson up to noise.

Under **correlated arms** — which is the substrate's regime once M1's embedding-conditioned posterior is live — observing arm `a` shifts beliefs about all arms whose embedding is near `a`'s. `g(a)` becomes large for arms that are *central* in the correlation graph and small for *isolated* arms with high `μ`. IDS pulls the central arm when its squared-regret/info ratio dominates, collecting information that reduces *future* regret across the whole correlated cluster. Thompson cannot do this — it has no notion of how informative an outcome is.

Russo & Van Roy 2018 §5 reports 2–5× cumulative-regret reduction on linear bandits, Gaussian process bandits, and graph bandits — all correlated-arm structures. The substrate's templates-share-resolvers / signatures-share-shapes / variants-share-lineage structure is the same family.

---

## 3. Existing selector path (file:line citations)

Activity-API `/recommend` flow (`repos/metabob-activity-api/src/routes/activities.ts:5691`):

1. Body parsed (`activities.ts:5692–5710`), semantic analysis run (`:5752`).
2. Candidates fetched from FTS + dense + metrics paths (downstream of `:5780`).
3. `applyCompatibilityFilter` (`services/recommendation.ts:74`) re-ranks by `_compatibility_score = thompsonScore(α, β) × shape-coverage-discount`. The Thompson score here is the **posterior mean** `α/(α+β)`, not a sample (`services/recommendation.ts:343` `function thompsonScore(alpha?, beta?): number`).
4. The Phase 11 helpers `recommendPointerImpulses` (`services/recommendation.ts:180–187`) and `identifyBlockingShapes` (`services/recommendation.ts:222`) consume the same `thompsonScore`.
5. Goal-paths uses true Beta sampling (`routes/goal-paths.ts:123` `function sampleBeta(alpha, beta)`, `:775` `sampleBeta(p.thompson_alpha || 1, p.thompson_beta || 1)`).
6. Posterior writes via `lib/posterior-update.ts:275` and `:479` are unchanged by this proposal.

The hot selection surface is **`thompsonScore` + the sort at `services/recommendation.ts:186` and `:210`**. M5 replaces this with `idsScore`, computed once per `/recommend` call and applied to the same candidate list.

`POST /v2/goal-paths/recommend` (`routes/goal-paths.ts:5691`-region, `sampleBeta` user at `:775`) is a **second** Thompson site. M5 covers it identically.

---

## 4. Computing EIG — three options

`Δ(a)` is cheap: closed-form from current α/β under Thompson, or from posterior moments under M1.

`g(a)` (expected information gain) is the load-bearing cost.

### Option A — Analytic EIG via M1 parametric posterior (preferred, requires M1)

Under M1 (`concept_vugylIHzIMvk`), the posterior over template-level reward is conditioned on a learned embedding `e_a ∈ ℝ^d` with a parametric form (e.g. Bayesian linear regression `μ = w^⊤ e_a`, `p(w) = N(m, Σ)`). Then for any candidate arm:

- Predictive variance: `σ²(a) = e_a^⊤ Σ e_a + σ_n²`.
- Expected entropy reduction (Gaussian outcome): `g(a) ≈ ½ · log(1 + e_a^⊤ Σ e_a / σ_n²)`.
- For Bernoulli outcome with Laplace approximation: `g(a) ≈ ½ · log(1 + p(1−p) · e_a^⊤ Σ e_a / σ_n²)` with `p = σ(μ(a))`.

**Cost:** one matvec per arm; Σ is `d×d` and shared across the request. For typical `d ≤ 64` and `K ≤ 50` this is microseconds. **This is the path the substrate should ship.**

### Option B — Monte Carlo EIG over Thompson posterior samples (fallback)

With independent Beta posteriors only (pre-M1), `g(a)` reduces to single-arm entropy reduction:

```
g(a) = H(Beta(α_a, β_a)) − E_{r ~ Beta(α_a, β_a)}[ r · H(Beta(α_a+1, β_a)) + (1−r) · H(Beta(α_a, β_a+1)) ]
```

This has a closed form via digamma, but it is **single-arm** — it captures no cross-arm correlation, so IDS collapses toward Thompson. To get the correlated form pre-M1 the substrate would need an MC estimator over a joint sampler (e.g. drawing posterior samples conditioned on the concept-graph correlation matrix). Cost: O(S · K) per arm for S samples, S ≥ 200 for stable estimates. Order ~10ms per `/recommend` call.

**Verdict:** Option B is viable but yields a smaller win than Option A. Ship M5 only after M1 if at all possible.

### Option C — Hybrid (transition path)

While M1 rolls out per-shape, M5 can run Option A on shapes whose embedding-conditioned posterior is healthy (`min_observations_threshold` already enforced at `activities.ts:5723`) and fall back to Option B for cold-start shapes. The selector emits a `selection_method` field in the recommendation payload (`thompson | ids_analytic | ids_mc`) for observability.

---

## 5. Acceptance criteria

A1. The `/v2/activities/recommend` and `/v2/goal-paths/recommend` endpoints emit `selection_method: "ids_analytic" | "ids_mc" | "thompson"` in each recommendation record.

A2. **No new primitive, scope, or store.** The proposal mutates exactly the **selection function** and adds an EIG estimator. α/β writes (`lib/posterior-update.ts`), trace storage, concept-db, scopes (org / account / system) are untouched. Discipline-gate check: `grep -r "new.*Scope\|new.*Primitive" openspec/changes/2026-06-04-learning-rate-5-*` returns empty.

A3. **Math correctness:** unit tests verify `Ψ(a) = Δ(a)²/g(a)`, two-arm randomised search returns a valid `(a, a', q)` triple summing-to-one weights, and Russo-Van Roy regret bound holds on a synthetic correlated-arm benchmark (`K=10`, `T=2000`, correlation matrix from concept-graph fixture): mean cumulative regret of IDS ≤ 0.5 × Thompson over 100 seeds.

A4. **Substrate regression gate:** on a live 7-day window, IDS cumulative-regret-proxy (sum of `1 − weighted_success_score`, definition at `services/thompson-sampling.ts:83`) is **≤ 0.7×** Thompson baseline. If above, auto-revert (feature flag `RECOMMEND_SELECTION_METHOD=thompson`).

A5. **Cold-start safety:** with α=β=1 priors (`services/recommendation.ts:344`), IDS reduces to Thompson up to numerical noise. Concretely, on K templates with no observations, the IDS marginal selection distribution equals uniform within ±3%.

A6. **Observability:** every `/recommend` response includes per-candidate `regret`, `eig`, `psi` (= `Δ²/g`) fields when `RECOMMEND_DEBUG_IDS=true`.

A7. **M1 dependency declared explicitly:** spec, tasks, and runtime config refuse to enable `ids_analytic` mode until M1's `embedding_conditioned_posterior` shape is registered in discovery-vessel.

---

## 6. Out of scope

- **No** rewrite of posterior writes — α/β-via-trace remains canonical (`concept_AIh9mrDEZcmJ`).
- **No** new persistence — IDS state is per-request, computed from posteriors at call time.
- **No** new selection method for variant-internal arms (Thompson stays inside variant-creator at `services/variant-creator.ts`); M5 is recommendation-layer only.
- **No** changes to `min_observations_threshold` semantics or exploration_ratio escape hatch (`activities.ts:5723`).
- **No** changes to the failure-mode penalty path (`failure_mode_stratified_thompson`, F-V56/F-V57 fixes); that is M4's surface.
- Theoretical extension to non-Bernoulli rewards (cost-weighted, latency-weighted) is **deferred** — the substrate's `weightedSuccessScore ∈ [0,1]` (`services/thompson-sampling.ts:83`) is treated as Bernoulli for M5.

---

## 7. Risk + mitigation

- **Risk:** EIG underestimates correlations and IDS collapses to Thompson on cold templates. **Mitigation:** A5 cold-start test + A4 regression gate.
- **Risk:** Two-arm search picks pathological pairs when one arm has `g(a) → 0`. **Mitigation:** floor `g(a) ≥ ε = 1e-6`; spec'd in DEV task.
- **Risk:** Without M1, MC-EIG is too noisy to beat Thompson. **Mitigation:** A4 gate auto-reverts; ship M5 only after M1 unless an Option-B-only experiment shows positive Δ on a held-out window.
- **Risk:** Ψ computation adds latency to `/recommend`. **Mitigation:** Option A is < 1ms; Option B is gated behind `RECOMMEND_SELECTION_METHOD=ids_mc` and disabled by default.

---

## 8. References

- Russo, D. & Van Roy, B. (2018). *Learning to Optimize via Information-Directed Sampling.* JMLR 19(64), 1–62.
- `docs/architecture/SUBSTRATE_AS_MDP.md` — factored Bayesian Q-learning framing.
- `docs/architecture/LITERATURE_COMPARISON.md` — substrate vs. classical RL/bandit literature.
- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` — primitives and scopes the discipline gate protects.
- Substrate concepts: `concept_u9KSvyDVjxoO` (this), `concept_TbN0eSf7U_hM` (parent), `concept_vugylIHzIMvk` (M1 dependency), `concept_EaAYU3p6LsxT` / `concept_AIh9mrDEZcmJ` (current Thompson posterior), `concept_skw2SmuLHZlN` (M2 sibling), `concept_CD8s3H1N_0G8` (M3 sibling), `concept_7mzv7SQN_7JB` (discipline gate).
