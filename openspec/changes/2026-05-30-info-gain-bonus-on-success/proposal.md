# Information-gain bonus on successes (symmetric novelty step)

## Why

The substrate's Thompson-Sampling learning rate is asymmetric **in only one
direction today.** Failure-side updates are stratified by `failure_mode.type`
(`posterior-update.ts:134-174`): `verifier_negative` → full β, `budget_exhausted`
→ half β, `cascading` → 0, `user_abort` → 0. Success-side updates are
unconditional: `success → α += 1` regardless of how informative the success is.

The shape-conditional partitioning (`v_shape_conditioned_score`,
`IMPULSE_STATE_SPACE_SPEC.md:341-355`) gives novel signatures an *implicit*
high effective learning rate because a fresh bucket starts at (α=1, β=1) and
posterior moves ~1/n_bucket. But once n_bucket grows, every additional
success contributes the same +1, regardless of whether the signature has been
seen 5 times or 5000.

**Operational consequence:** the substrate cannot distinguish a high-information
success (first time it landed `coverageReport` on a new signature class) from
a redundant one (the 80th `drain-pending-substrate-gaps` quick-no-op
"success"). The drain-pending-substrate-gaps sink the 8-cycle probe surfaced
empirically is partly built from this asymmetry — its α inflates linearly
with every misrouted dispatch that produces a 10ms task-level success, with no
discount for redundancy.

## Empirical motivation (2026-05-30)

- 8-cycle controlled probe via `mcp__metabob__run_goal` showed three different
  templates selected for the same goal-string across C7/C8/C9
  (`draft-spec-from-gap`, `gap-closing:fp-11-silent-semantic-failure`,
  `detect-stale-pointer`). Per-`(signature, template)` posteriors too sparse
  to discriminate — near-uniform draws.
- `drain-pending-substrate-gaps` selected on ≥3 of the cycles, succeeding at
  task level with 0 outputs (1 `http_fetch`, 10ms). Its α inflates from
  these quick "successes."
- Boredom-vessel timer was just shrunk 30 → 5 min (commit `26390d62`); 6×
  dispatch density makes the redundancy problem 6× worse without a
  saturating step-size correction.

## What changes

Extend `computeDeltas` in `repos/metabob-activity-api/src/lib/posterior-update.ts`
(~line 134) to apply an information-gain scaling factor on the success-side
α-update for the *signature-bucket* write (`context_thompson_scores`) only.

```ts
// success-side, applied at the per-signature posterior write
const n = posterior.n_observations ?? 0;
const infoGainFactor = 1 / (1 + n);   // 1.0 on first hit, 0.5 on second,
                                       // 0.1 on tenth, 0.02 on 50th
deltaAlpha_signature = base * infoGainFactor;
```

Conditions:

- Applies only to the **per-signature** posterior in `context_thompson_scores`.
  The variant-level `variant_performance_metrics.α` keeps the unscaled +1 so
  the variant-class population mean is unchanged.
- Applies only to `success` outcomes. Failures keep their existing
  stratification.
- Lifts the symmetry: novel-signature successes already get an *implicit*
  high effective rate via 1/n_bucket; this makes the rate *explicit and
  monotone-decaying* rather than relying on bucket creation alone.

## Out of scope

- Failure-side info-gain bonus. Failures are already stratified; adding a
  second multiplier risks compounding penalties on rare-but-real failures.
- Variant-level posterior scaling. Variant-level is the across-context
  policy; signature-level is the within-context policy. Only the latter
  should be info-gain-discounted.
- Adjustments to `chain_propagation_weight` (γ=0.5). Chain decay is a
  separate axis of asymmetry (depth, not count); orthogonal to this change.

## How this validates

Two-step:

1. After deploy, dispatch the same goal-string used in the 8-cycle probe
   (e.g. `failureModeMatrixScore` anchor with no variables) 20 times in
   sequence. Without this change: the same three templates compete with
   ~uniform draws indefinitely. With this change: the first 1-2 dispatches
   to a given variant produce large α-updates, and subsequent draws diverge
   measurably toward whichever variant succeeded *informatively* (output
   shapes produced, not just task-level success).
2. Measure `drain-pending-substrate-gaps`'s per-signature α growth across
   the 5-min boredom window. Pre-change: linear in dispatch count. Post-
   change: logarithmic — its high-α sink behavior on the empty-signature
   bucket should saturate, letting alternative templates win occasional
   draws.

## Dependencies

- `posterior-update.ts:134-174` — single function edit.
- `context_thompson_scores.n_observations` — needs to be present on the
  posterior row. Verify in `models/schemas.ts`; add as `DEFINE FIELD` if
  missing (migration cost: one column).

## Risk

- **Slows convergence on genuinely-stable signatures.** A signature that
  has 500 traces and a clean α-converged template gets near-zero updates
  on further successes. Mitigation: this is the desired behavior — once
  converged, *should* be stable. Variant-level posterior still updates
  unscaled, so policy-level learning continues.
- **Cold-start exploration shortened.** Novel-bucket bonus drops fast
  (0.5 at n=1, 0.33 at n=2). If a genuinely-good variant happens to be
  unlucky on the first dispatch and lose to a worse one, the recovery
  rate is slower. Mitigation: stratified failure-side updates already
  penalize the bad early winner aggressively; the asymmetric pair
  (full-step failure, decaying-step success) actually accelerates
  correction.
- **Confounded with credit propagation.** Ancestors at depth d get
  `α += γ^d`. Applying info-gain on top means ancestors get
  `γ^d / (1+n)`. Need to verify the chain-write path in
  `propagateCreditAlongChain` reads the same `n_observations` field as
  the leaf write, or apply info-gain only at the leaf.

## Companion concepts

- `concept_WikGVLa5d6kp` — `selector_anchor_vocabulary_gate` (8-cycle empirical finding)
- `concept_MNYEq7xc_46U` — `architectural_asymmetry` (F25 root cause)
- `openspec/changes/2026-05-30-event-driven-novelty-surface/` — companion proposal that ships a first-class novelty impulse so this asymmetry can be observed live
- `openspec/changes/2026-05-30-trace-to-concept-mining/` — provides the trace history this change needs to act on

## Graph-RL framing

Today's `(α += 1, β += {1, 0.5, 0})` is outcome-stratified TD with full step
size on the leaf. This proposal adds count-based novelty discounting on
successes: `α += 1/(1+n)` on the per-signature posterior, leaving variant-level
unchanged. This is the standard pseudo-count exploration bonus from
count-based RL applied symmetrically with the existing failure-side
stratification — the system gains a saturation curve on redundant successes
that mirrors the asymmetry it already has on failures.
