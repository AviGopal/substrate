# Proposal: Concept-Conditioned Thompson Prior (Learning-Rate Mechanism 2)

## Why

The substrate is a factored Bayesian Q-learning MDP
(`docs/architecture/SUBSTRATE_AS_MDP.md` §1–§3). For each
`(state_signature, template)` cell — an arm in bandit terms — it
maintains a Beta posterior over P(success | s, a) and selects via
Thompson sampling. The update rule is the literal Bernoulli-Beta
conjugate step. Cell creation today uses an uninformative Beta(1, 1)
prior — see `repos/metabob-activity-api/src/lib/posterior-update.ts:545`
and `:313`, and the inline duplicates at
`repos/metabob-activity-api/src/routes/execution-traces.ts:2463-2464`
and `:2530-2531`. Every new cell starts as if no prior knowledge
existed.

This is the dominant source of slow learning. Concept
`concept_W9CzngXfixvh` (memo: `concept_learning_currently_cold_start_dominated`,
2026-06-01) records the empirical finding that across the live concept
graph "only one concept currently has non-zero empirical
success/failure signal" — the long tail is all cold-start. Every fresh
state signature dilutes Thompson sampling toward the uniform prior;
the selector behaviour degenerates to the
**picker_static_prior_vs_learned_posterior_bug**
(`concept_YdzaAAQGx4xC`) symptom: under-explored arms tied at Beta(1,1)
get picked by index order, not by belief.

The substrate already encodes prior knowledge in concept-db: dense
embeddings of impulse-activity patterns, vessel-construction patterns,
and trace-mined regularities, queryable via
`GET /concepts/search?query=…` against
`repos/concept-db/src/routes/concepts.ts:109`. Each returned concept
carries a `relevance` score derived from accumulated empirical
success/failure signal on related cells. **Empirical Bayes** says: when
a new cell appears, set its prior from the posterior of its
similarity-matched neighbors, scaled by a precision κ that controls how
much evidence the neighbor mean is worth.

`concept_uTVZPoaxMmo2` (shape:
`concept_conditioned_thompson_prior`, parent
`concept_TbN0eSf7U_hM` = `learning_rate_improvement_mechanisms`) is
the substrate's own articulation of this mechanism, labelled
"cheapest of the 8 mechanisms to ship". This proposal makes it real.

## Discipline alignment (concept_7mzv7SQN_7JB)

This change introduces **no new primitives**.

- **Impulse**: concept-db search results are already impulses (every
  concept is an impulse with shape, summary, relevance, embedding).
- **Activity**: prior-seed lookup is a side-effect of the existing
  `posterior-update` activity; no new activity registry entry.
- **Signature**: keying is unchanged — `(org_id, template_id,
  signature_version, context_bucket)`.
- **Thompson-per-arm**: the Beta posterior is unchanged. Only its
  initial value changes from (1, 1) to (κ · μ_α, κ · μ_β) where μ is
  the neighbor-weighted mean.

No new scope tier. No new vocabulary. The change is a numeric
substitution at one constant in four file locations.

## Mechanism

For each new cell at CREATE time:

1. Build a search query from the cell's `(template_id, context_bucket)`
   — concatenated as `"<template_id> <signature>"`.
2. Call `GET {CONCEPT_DB_URL}/concepts/search?query=…&limit=K`
   (K=5 default, env `PRIOR_SEED_K`).
3. For each returned concept c_i with relevance r_i, treat the
   relevance as a Beta(α_i, β_i) parametrization via:
   - α_i = relevance · loaded_count (succeeded behaves as α)
   - β_i = (1 − relevance) · loaded_count
   — fields already present in concept-db's `Concept` model and
   exposed in `/concepts/search` responses (`metrics: { loaded, succeeded }`).
4. Compute weighted means:
   - μ_α = Σ r_i α_i / Σ r_i
   - μ_β = Σ r_i β_i / Σ r_i
5. Scale by precision κ (env `PRIOR_SEED_KAPPA`, default 10):
   - α₀ = κ · μ_α / (μ_α + μ_β)
   - β₀ = κ · μ_β / (μ_α + μ_β)
   — so α₀ + β₀ = κ. The new cell starts with κ "virtual trials" at
   the neighbor mean rate.
6. Apply the observed delta on top: CREATE row with
   `alpha = α₀ + $alpha_delta`, `beta = β₀ + $beta_delta`.
7. If concept-db is unavailable, times out (default 500 ms,
   `PRIOR_SEED_TIMEOUT_MS`), or returns zero results, fall back to the
   current Beta(1, 1) baseline. The substrate never blocks on prior
   seeding.

The math is empirical Bayes / hierarchical-pooling with a fixed
shrinkage parameter. It is exactly equivalent to the substrate's
existing partial-pooling discipline across org/account/global scopes
(`SUBSTRATE_AS_MDP.md` §6), just with concept similarity as the
neighbor kernel instead of scope hierarchy.

## Existing surface (file-level grounding)

| File | Line(s) | What's there today |
|---|---|---|
| `repos/metabob-activity-api/src/lib/posterior-update.ts` | 540–550 | `context_thompson_scores` CREATE with `alpha: 1.0 + $alpha_delta, beta: 1.0 + $beta_delta` on first observation |
| `repos/metabob-activity-api/src/lib/posterior-update.ts` | 311–316 | Chain-credit duplicate of same CREATE pattern |
| `repos/metabob-activity-api/src/routes/execution-traces.ts` | 2463–2464 | Legacy inline write (parallel to posterior-update) |
| `repos/metabob-activity-api/src/routes/execution-traces.ts` | 2530–2531 | Second legacy inline write |
| `repos/concept-db/src/routes/concepts.ts` | 109–171 | `GET /concepts/search` endpoint — already returns relevance, supports `query`, `shape`, `source_type`, `min_relevance`, `limit` |

No new schema migration required. `context_thompson_scores.alpha` and
`.beta` are already `option<float>` (see migration where the table is
defined). The CREATE statement currently writes whatever literal we
choose.

## Acceptance criteria

1. New `context_thompson_scores` rows have `alpha + beta ≈ κ + |delta|`
   in steady state (not 2 + |delta|), measured by querying SurrealDB
   after a deployment with at least one new signature.
2. When concept-db is down (kill `concept-db.service` in the
   single-container substrate), new cells still write with Beta(1, 1)
   baseline — verified by integration test
   `posterior-update-prior-seed.test.ts`.
3. Mean trial-count-to-converge across signatures decreases by ≥ 20%
   over a 7-day window vs the pre-change baseline. Measured by
   `validation/scripts/learning-rate-window.ts`. Pre-change baseline
   captured before merge; post-change measured 7 days after canary
   activation.
4. The MRR on the FTS reuse benchmark
   (`validation/scripts/reuse-benchmark.ts`) does not regress by
   more than 2 percentage points from the current 0.2361 baseline
   (Phase 18, F-V58 fix). Improvement is expected but not required.
5. No regression in chain-credit propagation (Phase 18.4 integration
   test 18.4.7 must still PASS).
6. Operator-side closure-audit reporting unchanged — this is a numeric
   change inside an existing closure boundary.

## Out of scope

- **Hierarchical signature clustering**
  (`concept_skw2SmuLHZlN`) — different mechanism, K× speedup via
  cluster-level pooling; ship separately.
- **Successor-feature decomposition of Q**
  (`concept_49XNzJTL7E8V`) — separate transfer-learning mechanism.
- **Dynamic κ schedule** — κ stays fixed at 10. An adaptive schedule
  (κ scaled by neighbor variance, or annealed over observations) is a
  follow-up once we measure the fixed-κ regime.
- **Backfill** of existing Beta(1, 1) cells — only new CREATE paths
  are touched. Existing cells continue from their accumulated state;
  no retroactive shrinkage.
- **Writing back to concept-db** when a cell hits a confidence
  threshold — that's the closing leg of the loop and belongs in a
  separate "concept-db posterior emission" change.
- **Cross-scope priors** — the seed is org-scoped (the search call
  carries org auth). Account and global tiers already have their own
  partial-pooling path; concept seeding stacks on top of, not in place
  of, scope pooling.

## Citations

- `concept_uTVZPoaxMmo2` — the mechanism itself
  (shape: `concept_conditioned_thompson_prior`)
- `concept_TbN0eSf7U_hM` — parent: `learning_rate_improvement_mechanisms`
- `concept_7mzv7SQN_7JB` — discipline gate (no new primitives)
- `concept_YdzaAAQGx4xC` — `picker_static_prior_vs_learned_posterior_bug`
  (symptom that motivates this)
- `concept_W9CzngXfixvh` — `concept_learning_currently_cold_start_dominated`
  (empirical evidence)
- `concept_AIh9mrDEZcmJ` — `computed_thompson_scores`
  (the storage contract this respects)
- `concept_x9GZEMnbj2WZ` — `variant_system`
  (the arm definition this seeds)
- `concept_skw2SmuLHZlN` — adjacent mechanism, deliberately out of scope
- `concept_49XNzJTL7E8V` — adjacent transfer-learning mechanism, OOS
- `docs/architecture/SUBSTRATE_AS_MDP.md` §1–§3, §6 — math derivation
- `docs/architecture/LITERATURE_COMPARISON.md` — empirical-Bayes / partial-pooling positioning
- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` — primitives
