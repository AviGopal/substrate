# Drafting strategy measurement preregistration

Registered: **2026-10-28 02:10:34Z**, before the v2 module or activity exists.

This plan is frozen before the `drafter-v2-contract` module or its activity row exists. The live
`activityTemplate` read returned 404 for `development-vessel:drafter-v2-contract`; `thompson_posterior`
reported `row_found: false` for both `development-vessel:draft-edit` and `development-vessel:draft-check`.
If a v2 execution is found before this file is committed, treat this registration as post hoc and do not
use it to support the autonomy claim.

## Population and assignment

- Arms are the `floor` control and `drafter-v2-contract`.
- An attempt is counted once by its stable compose attempt id when drafting ran and the closed settlement
  is terminal. BUSY, admission refusal before drafting, and missing drafter attribution are not attempts.
- If v2 was selected but the open module fell back, retain the attempt in v2's denominator and count its
  deterministic fallback debit against v2. Never transfer that debit to `floor`.
- Do not pool `test_writing` attempts with fix attempts. The primary comparison uses only `test_writing`
  attempts. Report all exclusions and missing settlements separately.

## Outcomes

For each arm, report the durable posterior (`alpha`, `beta`) and the number of distinct terminally settled
attempts (`N`). The posterior is evidence only when its deltas came from Decision 6's deterministic,
idempotent settlement; FAVORABLE alone, semantic-gate/refuter verdicts, and LLM reach labels contribute
neither alpha nor beta.

The primary metric is:

```text
contract_mismatch_share = attempts settled as check_asserts_contract_mismatch / eligible test_writing attempts
```

The secondary metric is:

```text
semantic_only_unresolved_share = eligible test_writing attempts left unresolved by the semantic gate,
                                 with no deterministic refusal or failure label / eligible test_writing attempts
```

An attempt with more than one refusal is counted once in the primary numerator if any deterministic
`check_asserts_contract_mismatch` settlement is present. The full refusal set remains available for audit.

## Decision rule

- Do not compare arms until each has at least **50 eligible `test_writing` attempts** with terminal,
  deterministic settlement.
- At that point, if v2's observed contract-mismatch share is equal to or greater than floor's, v2 fails
  the preregistered criterion and is retired by its grade. No operator may waive the result based on
  semantic-gate verdicts, selected drafts, or favorable compose counts.
- If v2's share is lower, retain both arms and report the counts and raw numerators. This pilot supports
  continued measurement only; it does not by itself establish autonomy or statistical superiority.
- The autonomy claim still requires the system-authored variant to be selected by Thompson and to
  out-grade floor on the deterministic settlement, with evidence that no operator authored or landed its
  code.

Do not change the population, denominator, threshold, or decision rule after observing either arm's
outcomes. Any revision requires a new version dated before the next variant begins its measurement.
