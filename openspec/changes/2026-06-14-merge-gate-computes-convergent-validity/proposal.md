# Merge gate computes convergent validity instead of trusting a fabricated score

## Why

`evaluate-pr-via-internal-idioms` is the substrate-internal merge gate that
replaces operator approval — it decides whether substrate-authored work ships.
Its `synthesize_evidence` task hardcoded `"convergent_validity_score": 0.7` into
the LLM prompt, and `gh_pr_merge`'s `checkEvidence` trusted that supplied value
against `CONVERGENT_VALIDITY_FLOOR` (0.4). Since 0.7 ≥ 0.4 always, the convergent-
validity check was a rubber stamp: the gate that exists to catch "is this real?"
asserted a certainty it never measured.

This is the exact self-deception class the substrate's own audit suite targets
(phantom-success, posterior drift, trace-outcome inconsistency) — except here it
lived inside the trust function itself. A self-reported validity score is not
evidence.

## What changes

- **`gh_pr_merge` resolver** (`repos/development-vessel/src/resolvers/gh-pr-merge.ts`):
  new exported `deriveConvergentValidity(ev)` computes the score deterministically
  from objective evidence the gate already holds — `phantom_trace_delta`,
  `precondition_rejection_delta`, and `produced_by_trace_ids` provenance — and
  **ignores any caller-supplied `convergent_validity_score`**. `checkEvidence`
  uses the derived value; refusal reasons cite the derivation basis for audit.
  Fail-closed: no provenance caps the score at 0.5 (still clears the 0.4 floor
  today, but makes the floor meaningful if an operator raises it).
- **`evaluate-pr-via-internal-idioms` seed**: prompt no longer emits the fabricated
  `convergent_validity_score`; instructs the model that the gate computes it.
- **`EvaluationEvidence.convergent_validity_score`** retained on the interface as
  deprecated-input only, so legacy callers typecheck.

Aligns with the vessel's foundation rule: resolvers compute, LLMs reason about
metadata. A validity score is a measurement, not a reasoning task.

## Done when

- [x] `deriveConvergentValidity` is the sole source of the gate's CV value.
- [x] Per-resolver tests cover: caller value ignored, no-provenance cap, provenance
      reward, multi-instance regression drives below floor. (`gh-pr-merge.test.ts`, 11 pass)
- [x] `bun run lint` green (118/118 shape-dispatch); no new suite failures.
- [x] Synced + restarted in substrate-live; template re-seeded to activity-api.

## Behavioral note (honest scope)

At the current floor (0.4) and delta maxes (0), this change does **not** alter any
merge decision for healthy artifacts (clean evidence → 0.5 ≥ 0.4, merges as before;
regressions were already blocked by the per-delta gates). Its value is integrity:
the score is computed not asserted, cannot be injected, is auditable, and sets up
provenance-gated tightening.

## Follow-on

True convergent validity = verify the artifact's `verifiable_claims[]` (cited
exec_ids / file paths / concept_ids actually resolve) rather than only counting
provenance length. Requires a claim-verifier resolver; tracked separately.
