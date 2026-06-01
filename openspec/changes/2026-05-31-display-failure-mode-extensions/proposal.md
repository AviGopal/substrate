# Display failure-mode extensions (taxonomy + computeDeltas refinements)

## Why

`FailureModeSchema` (`repos/metabob-activity-api/src/models/schemas.ts:902-937`)
is a discriminated union of five types — `verifier_negative`,
`budget_exhausted`, `safety_breach`, `cascading`, `user_abort`. The
stratification table in `computeDeltas`
(`repos/metabob-activity-api/src/lib/posterior-update.ts:134-174`) maps
those five to fixed (Δα, Δβ) pairs.

Display perception + control introduces failure conditions that do not
cleanly map to any of the five. Forcing them through the existing types
either loses signal or, worse, applies the wrong Thompson update:

| New display-layer failure | Today's least-bad mapping | Why it fails |
|---|---|---|
| Operator hit global abort hotkey mid-action | `user_abort` (β=0) | Semantically: consent was *revoked*, not "task done early". Treating as neutral hides that the action was on a trajectory we should not re-pick on this signature |
| Substrate attempted rollback, rollback itself failed | (no fit) | Uniquely dangerous — needs β=2 + H5 immutable-baseline regression trigger; today this would be misclassified as a generic `verifier_negative` β=1 |
| Action executed outside attested region | `safety_breach.depth/cycle` (β=1) | Treatment is correct but reason channel is wrong — the regression-detector reads `breach_type` and would not engage on a non-depth-non-cycle breach |
| Continuous-consent token lapsed mid-action | (no fit) | Distinct from depth/cycle safety_breach; should not propagate to ancestors (it's environmental, not algorithmic) |
| Substrate has no display capability | `budget_exhausted` (β=0.5) | Wrong axis — not a resource budget, an absent capability. Selector should learn "don't pick this template on this substrate", not "this template's cost was too high" |
| OmniParser detection confidence below threshold | `verifier_negative` (β=1) | Sort of, but selector should distinguish "validator *rejected*" from "validator *was not confident*" — the second is closer to a `budget_exhausted` half-penalty |

Beyond the taxonomy gaps, the cascading rule
(`posterior-update.ts:~386-392`) propagates β only to depth-1 ancestors
for cascading failures. For perception→action chains, the actual cause
is frequently mid-chain (e.g., perception picked the wrong element →
binding chose a wrong target → action verified false). Depth-1 is the
wrong attribution target; **the trace already knows which step failed,
but the structure can't carry that information** because
`failure_mode.context` has no `root_cause_step` field.

## Empirical motivation

- 8-cycle probe (`concept_WikGVLa5d6kp`) — most cycle failures bottomed
  out on `gap-closing:test-valid-*` templates whose β-attribution went
  to the dispatcher rather than the misrouted selection step. The trace
  carried enough information to attribute correctly; the schema didn't.
- `concept_HKlz4FAc2cpf` (`substrate_self_fix_pattern`) — the substrate
  detects rollback-attempt-failed patterns by reading composition
  chains; without a typed `action_reversal_failed` failure-mode, those
  detections cannot feed Thompson with the right step size.
- Posterior asymmetry framing established by
  `2026-05-30-info-gain-bonus-on-success` — that proposal made success-
  side updates conditional on novelty; this proposal makes failure-side
  updates conditional on causality. Together they restore symmetry.

## What changes

### 1. Two new top-level failure-mode types

Extend the discriminated union in `schemas.ts:902-937` with:

```ts
z.object({
  type: z.literal("consent_revoked"),
  reason: z.string(),
  revocation_source: z.enum(["operator_hotkey", "session_timeout", "policy_engine"]),
  revoked_at_step: z.string().optional(),
}),
z.object({
  type: z.literal("action_reversal_failed"),
  reason: z.string(),
  rollback_resolver_id: z.string(),
  rollback_error: z.string(),
  irreversibility_evidence: z.array(z.string()),
}),
```

`computeDeltas` (`posterior-update.ts:134-174`) extends:

- `consent_revoked` → `{α=0, β=0}`. Distinct from `user_abort` because
  the **side effect** is different: emit a `consent_state_reset` impulse
  that the selector reads as a hard veto on re-picking the same
  `(template, signature)` for a configured cool-down window. Thompson
  signal stays neutral; the veto is the load-bearing mechanism.
- `action_reversal_failed` → `{α=0, β=2}` on the action template **plus**
  a parallel `{α=0, β=1}` write to the rollback resolver's variant
  posterior (via a small extension to `applyOutcomeToPosteriors` that
  reads `rollback_resolver_id` and dispatches a sibling write).
  Triggers an H5 immutable-baseline regression event when H5 ships;
  until then, emits a `h5_regression_stub` log event that operator
  monitoring can subscribe to.

### 2. Sub-mode extensions to existing types

- `safety_breach.breach_type` extends from `"depth" | "cycle"` to
  `"depth" | "cycle" | "region" | "attestation_expired"`. The two new
  values use the existing `{α=0, β=1}` treatment. The
  `attestation_expired` case carries an additional optional
  `attestation_id` field; `region` carries `attested_region` and
  `attempted_region`.
- `budget_exhausted.budget_type` extends from `"cost" | "duration"` to
  `"cost" | "duration" | "display"`. The `display` value means "the
  substrate this dispatch reached has no advertised display capability"
  — treated as a half-penalty so selector learns substrate-class
  associations without a full β on the template itself.
- `verifier_negative.failed_evidence[].check_id` accepts the new
  literal `"detection_confidence"` to mark OmniParser-type validators
  reporting low confidence rather than hard rejection. Paired with a
  new optional `confidence_tier: 1 | 2 | 3 | 4` field on the
  `verifier_negative` payload itself.

### 3. computeDeltas confidence-tier stratification

For `verifier_negative` with `confidence_tier` present:

- tier 1 (high-confidence rejection of clearly-wrong output) → `{α=0, β=1}` (today's full penalty)
- tier 2 (low-confidence rejection — validator unsure) → `{α=0, β=0.5}` (new half-penalty)
- tier 3 (high-confidence rejection on edge-case input) → `{α=0, β=0.5}` (new half-penalty)
- tier 4 (low-confidence rejection on edge-case input) → `{α=0, β=1}` (full — combined uncertainty raises the penalty back)

When `confidence_tier` is absent (legacy traces, non-confidence-aware
validators), the existing full-β treatment is preserved.

### 4. root_cause_step on failure_mode.context (cross-cutting)

Every variant of `failure_mode.context` gains an **optional
`root_cause_step: string`** field naming the specific
`composition_chain` step (or task id within the leaf execution) that
the cascading rule should blame.

`propagateCreditAlongChain` (`posterior-update.ts:324-410`) is extended:

- If `failure_mode.context.root_cause_step` is set AND the named step
  resolves to a known ancestor execution id, write the full β to that
  ancestor regardless of depth (capped at
  `CREDIT_PROPAGATION_MAX_DEPTH`). Skip the decayed β-to-all-ancestors
  default.
- If unset, fall back to today's behavior unchanged
  (`posterior-update.ts:386-392` — depth-1 only for cascading; decayed
  to all ancestors for other failure types).
- Acceptance: when set, the named ancestor's
  `variant_performance_metrics.thompson_beta` increments by the full
  step size; when unset, today's distribution holds.

## Out of scope

- The operator-hotkey-binding mechanism itself (`display-control`
  openspec). This proposal only defines what to record when the
  binding fires.
- The H5 immutable-baseline regression-mode implementation
  (`2026-04-26-security-hardening-findings/` H5). This proposal emits
  the trigger event; H5 consumes it.
- The continuous-consent token mechanism (covered by `display-control`
  + `consent` openspec). This proposal only defines the failure-mode
  for when the token has lapsed.
- `pattern-miner.ts` frequency-threshold tuning. Failure-mode stratification
  feeds the miner via tagged traces, but `minFrequency` adjustments are a
  separate optimization.

## Dependencies

- Ships before the display-action openspec writes any traces — the
  display-action layer is the primary writer of the new failure-mode
  types.
- Depends on `2026-05-31-display-signature-partitioning` for Phase B
  signature partitioning: the `consent_state_reset` veto operates on a
  `(template, signature)` key whose signature is well-defined only with
  the display-tier coarsener.
- The `action_reversal_failed` H5 trigger is a stub until
  `2026-04-26-security-hardening-findings/` H5 ships. Stub emits a
  log event subscribable by operator-side monitoring.

## Risk

- **β=2 on `action_reversal_failed` breaks Beta(α,β) interpretability**
  in the strict sense — a Beta distribution with non-integer parameters
  is well-defined, but β=2 doubles the effective sample weight of one
  failure. This is the intended treatment (reversal-failure is twice
  as load-bearing a signal as a verifier rejection), but it is the
  *only* failure-mode with non-unit weight today. Documenting
  prominently in `docs/architecture/POSTERIOR_UPDATE.md`.
- **`root_cause_step` requires writers to populate it correctly.**
  Misattribution (writer names a wrong step) would mis-credit the
  wrong ancestor. Mitigation: when set, validate the named step is
  actually in `composition_chain`; on mismatch, fall back to today's
  default + emit a `root_cause_step_invalid` warning.
- **Cool-down veto on `consent_revoked` could starve a genuinely-good
  template if consent revocations are noisy.** Mitigation: the veto is
  `(template, signature)`-keyed, not template-wide; a different
  signature on the same template is still selectable.
- **Confidence-tier half-penalty could collude with info-gain bonus**
  (`2026-05-30-info-gain-bonus-on-success`) to make low-confidence
  rejections vanishingly weak signals on high-`n` buckets. Acceptable —
  if the validator was unsure AND the bucket has many observations, the
  rare rejection should not move the posterior much.

## Companion concepts

- `concept_HKlz4FAc2cpf` — `substrate_self_fix_pattern` (rollback-
  attempt-failed detection feeds `action_reversal_failed`).
- `concept_WikGVLa5d6kp` — `selector_anchor_vocabulary_gate` (cascading
  misattribution surfaced by 8-cycle probe).
- `concept_MNYEq7xc_46U` — `architectural_asymmetry` (success-side vs
  failure-side step-size symmetry).

## Related openspecs

- `2026-05-30-info-gain-bonus-on-success/` — success-side novelty
  stratification, the dual of this proposal's failure-side causality
  stratification.
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` — Phase E push-
  away criteria depend on the substrate emitting
  `intervention_refused` impulses, which now carry typed
  `consent_revoked` semantics where applicable.
- `2026-04-26-security-hardening-findings/` — H5 immutable-baseline
  regression mode is the consumer of the `action_reversal_failed`
  trigger.
- `2026-05-31-display-signature-partitioning/` — sibling spec; the
  `consent_state_reset` veto is `(template, signature)`-keyed and
  depends on the display-tier signature partition.

## Graph-RL framing

- **`root_cause_step` = mediation analysis.** Today's cascading rule
  blindly blames depth-1; `root_cause_step` lets writers name the
  actual mediating node, restoring the causal-inference framing the
  graph-RL session described.
- **Confidence-tier half-penalty = outcome-conditional step size.**
  Stratifying the failure-side step by validator confidence is the
  failure-side analog of `2026-05-30-info-gain-bonus-on-success`'s
  novelty-conditional success step. The pair restores symmetric
  outcome-conditional learning rates.
- **`action_reversal_failed` β=2 + H5 trigger = adversarial-resistance
  signal.** Reversal-failure is uniquely dangerous because it indicates
  the action's effects exceeded the substrate's predicted blast
  radius; doubling the step is informationally justified, and the H5
  baseline regression is the structural defense.
- **`consent_revoked` veto = hard exclusion in the policy.** Distinct
  from a soft β update — the policy refuses to draw the
  `(template, signature)` arm for a cool-down window, equivalent to a
  hard mask on the action space rather than a soft probability shift.
