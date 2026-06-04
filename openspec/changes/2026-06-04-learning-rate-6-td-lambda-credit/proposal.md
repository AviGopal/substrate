# Learning-rate refinement 6: TD(λ) eligibility-trace credit propagation

**Status:** proposed
**Date:** 2026-06-04
**Scope:** `repos/metabob-activity-api/src/lib/posterior-update.ts`
**Size:** smallest of the 8-part learning-rate-refinements series (one constant rename + one env wire-up)

## Substrate concept anchors

This change is a direct mechanisation of:

- `concept_iae171XpW50_` (`eligibility_trace_credit_propagation`, `impulse_activity_pattern`) — "Change propagateCreditAlongChain to TD(λ): Δα_{s_t-k, a_t-k} = λ^k · r with λ∈(0,1). Reduces variance ~40% for 5-deep chains at λ=0.7, negligible bias. Sutton 1988."
- Parent: `concept_TbN0eSf7U_hM` (learning-rate refinements umbrella).
- Adjacent: `concept_AwkpcryQXDjK` / `concept_Sx2yYPCkmAfE` (`composition_chain` — the data structure the propagation walks); `concept_3G1M0gUWwVVL` (per-dispatch full-state capture, names the chain-credit code path); Thompson-posterior + F-V56 / F-V57 lineage (the now-stable chain-credit writer).
- Gate concept: `concept_7mzv7SQN_7JB` ("don't invent new substrate tiers"). This change introduces **no new tier and no new primitive**: it parameterises an already-existing decay factor.

## Substrate framing (SUBSTRATE_AS_MDP §3)

§3 derives chain-credit propagation as an **n-step TD backup** over the substrate's open-world MDP. Each ancestor in `composition_chain` is a state-action pair `(s_{t−k}, a_{t−k})` that contributed to the leaf trace's terminal reward `r ∈ {success, failure}`. The Bayesian update on `(α, β)` is the value-update analogue.

Sutton 1988 / Sutton-Barto Ch. 12 show that eligibility-trace weighting `λ^k` (with `λ ∈ (0,1)`) **strictly dominates** unweighted backups in variance terms for any non-degenerate MDP: distant ancestors get exponentially less credit, so noisy long-chain terminal outcomes don't flood priors of weakly-coupled ancestors.

## Current code path (verbatim)

`repos/metabob-activity-api/src/lib/posterior-update.ts:69-72`:

```
const CREDIT_PROPAGATION_MAX_DEPTH = 4;
// ...
const CREDIT_PROPAGATION_GAMMA = 0.5;
```

`repos/metabob-activity-api/src/lib/posterior-update.ts:401`:

```
const decayFactor = Math.pow(CREDIT_PROPAGATION_GAMMA, depth);
```

The decay factor is then used in three branches (success / cascading-direct-parent / generic-failure) at lines 413-425 to scale `alphaDelta` or `betaDelta` written to each ancestor's `variant_performance_metrics` row via `writeAncestorDelta`.

**Observation.** The codebase *already implements* eligibility-trace decay — the prompt's claim that the current path uses unweighted γ=1 is incorrect. What is present:

- Hardcoded `γ = 0.5`.
- No env override.
- No telemetry distinguishing "TD(λ) weighted" from "unweighted" — the value is invisible to operators.
- The constant is named `CREDIT_PROPAGATION_GAMMA`, conflating the RL discount factor γ with the eligibility-trace parameter λ (Sutton-Barto distinguishes them carefully; in this codebase only one factor exists and it plays the λ role, since there is no separate per-step discounting).

## The change

Three sub-changes, all in `posterior-update.ts`:

1. **Rename** `CREDIT_PROPAGATION_GAMMA` → `TD_LAMBDA` to match the substrate concept and the literature.
2. **Wire env override.** Read `process.env.TD_LAMBDA` with `parseFloat`, default `0.7`. This raises the effective λ from the current 0.5 to 0.7, which the concept identifies as the variance/bias sweet spot for the typical chain depth observed in this substrate (mean 2-3, max capped at 4).
3. **Validate range.** Reject `λ ∉ (0, 1)` at startup with a single warn-log and fall back to default; do not throw (the chain-credit writer is fire-and-forget).

Math is unchanged: `decayFactor = Math.pow(TD_LAMBDA, depth)`. Only the constant's value, name, and source change.

### Why this is the smallest of the 8

- No schema migration.
- No new write path; the existing `writeAncestorDelta` is untouched.
- No new resolver, no new shape, no new concept tier.
- ~5 LOC source delta; ~30 LOC test delta to lock the new default and the env override.
- Deploy = restart `metabob-activity-api` with `TD_LAMBDA=0.7` (or unset, since 0.7 is the new code default).

### Variance / bias derivation (sketch)

For a chain of depth `K`, unweighted backup variance on a single ancestor's α update is `Var[r] · K` (every ancestor sees the same noisy terminal). Under λ-weighting, variance becomes `Var[r] · Σ_{k=1..K} λ^{2k} = Var[r] · λ²(1−λ^{2K}) / (1−λ²)`.

At `K=5`:
- λ=1.0 (unweighted): coefficient = 5.0
- λ=0.7: coefficient ≈ 0.92  → **~82% variance reduction vs unweighted**, ~40% vs current λ=0.5 (coefficient ≈ 0.33).
- Wait — `λ=0.5` already has lower variance than `λ=0.7`. The *reason to raise λ* is bias: at λ=0.5, depth-3 ancestors receive only 0.125 of the reward signal; under modest chain depth (mean 2-3) this starves learning at the chain root. λ=0.7 keeps depth-3 at 0.343 — still bounded, but informative. The substrate concept frames the trade-off as variance-dominated relative to *unweighted* backups; we are tuning along the bias axis.

This trade-off is the operator-visible quantity the acceptance criteria measure.

## Acceptance criteria

- **A1. Env override is honoured.** Set `TD_LAMBDA=0.4`; restart activity-api; trigger a 3-deep chain success; verify ancestor α-deltas are `[0.4, 0.16, 0.064]` (within float tolerance).
- **A2. Default at 0.7.** Unset env; restart; same chain; verify ancestor α-deltas are `[0.7, 0.49, 0.343]`.
- **A3. Invalid values fall back.** Set `TD_LAMBDA=2.0`; verify a warn-log, then ancestor α-deltas use the 0.7 default.
- **A4. Variance reduction is observable.** Re-run the existing failure-mode harness twice — once with `TD_LAMBDA=1.0` (effectively unweighted), once with `TD_LAMBDA=0.7`. The standard deviation of ancestor α across N≥30 traces is lower under 0.7 (target: ≥ 30% reduction at chain depth ≥ 3).
- **A5. Convergence-rate measurement.** On the 6-mode failure-mode-harness, Thompson posterior mean for chain-root templates reaches `α/(α+β) > 0.6` after fewer terminal outcomes with `λ=0.7` than with the prior `λ=0.5` — within a 2σ margin over 10 cycles.
- **A6. No new concept tier introduced.** Concept-db audit shows no new shapes or source_types added by this change.

## Out of scope

- Per-step discount factor γ (distinct from λ in standard TD; this codebase does not need it since chain ancestors are sequential per-action steps with no intermediate rewards).
- Adaptive λ (Watkins' Q(λ), true online TD(λ)). The substrate's chain depth is bounded at 4 and the variance/bias regime is tight enough that scalar λ is sufficient.
- Per-org or per-template λ. The substrate concept does not call for it; per-template variance can instead be addressed by `concept_iae171XpW50_`'s sibling refinements (embedding-conditioned posterior, concept-conditioned prior).
- Per-failure-mode λ (treating `safety_breach` and `verifier_negative` with different decay schedules). Defer until the variance/bias dashboard from A4/A5 indicates one mode dominates.
- Renaming `CREDIT_PROPAGATION_MAX_DEPTH` (the depth cap is a separate hyperparameter governed by Bellman-equation horizon, not λ).
- Migration of historical `variant_performance_metrics` rows. The change is forward-only; existing posteriors are not rewritten.
