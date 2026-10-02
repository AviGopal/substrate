# Tasks — display-failure-mode-extensions

Ordered for the main operator development agent. Each task lists the
implementation files, acceptance criterion, and the gate it unblocks.

## Phase A — root_cause_step (independent, ship first)

- [ ] **A.1** — Extend every variant of `FailureModeSchema` in
  `repos/metabob-activity-api/src/models/schemas.ts:902-937` with an
  optional `root_cause_step?: z.string()` at the variant level (not at
  the discriminator level — each variant gets its own optional field so
  the discriminated-union machinery keeps inferring correctly).
  - Mirror the field in the `FailureMode` TypeScript union
    (`schemas.ts:939-970`).
  - Acceptance: `bun run typecheck` clean; round-trip parse of a
    fixture with `root_cause_step` set returns the field intact.
- [ ] **A.2** — Migration: no SurrealDB schema change required since
  `failure_mode` is a `flexible object` field on
  `activity_execution_traces`. Add a documentation note in
  `repos/metabob-activity-api/docs/schemas.md` recording that
  `root_cause_step` is now a recognized field.
- [ ] **A.3** — Modify `propagateCreditAlongChain` in
  `repos/metabob-activity-api/src/lib/posterior-update.ts:324-410`:
  - At the top of the function, after the early-return guard, read
    `failure_mode?.context?.root_cause_step` (typed via the extended
    `FailureMode`).
  - If present and the step resolves to an ancestor `execution_id` in
    `composition_chain`, write the full β = `1.0` to *that* ancestor
    only; skip the depth-decay loop.
  - If present but does not resolve, fall back to today's behavior
    AND emit a `root_cause_step_invalid` warning log.
  - If absent, today's behavior unchanged.
  - Acceptance: unit test in `posterior-update.test.ts` with three
    cases — set+valid, set+invalid, unset — asserting the correct
    write distribution per case.
- [ ] **A.4** — Document the new attribution rule in
  `docs/architecture/POSTERIOR_UPDATE.md` (cross-linked from
  `CLAUDE.md`).

## Phase B — Two new top-level failure types (independent of A)

- [ ] **B.1** — Add `consent_revoked` and `action_reversal_failed`
  variants to `FailureModeSchema` and the `FailureMode` TypeScript
  union in `schemas.ts`.
  - Acceptance: zod parse round-trip per variant; typecheck clean.
- [ ] **B.2** — Extend `computeDeltas`
  (`posterior-update.ts:134-174`) with the two new cases:
  - `consent_revoked` → `{α=0, β=0}` + side-effect: emit
    `consent_state_reset` impulse via a new helper
    `emitConsentStateReset(trace, db, orgId)` that writes a row to
    `consent_veto` table (new — migration in B.3) keyed on
    `(template_id, signature, expires_at = now + COOL_DOWN_WINDOW)`.
  - `action_reversal_failed` → `{α=0, β=2}` on the action variant;
    additionally enqueue an `applyOutcomeToPosteriors`-style write
    on the `rollback_resolver_id` named in the failure-mode payload,
    treated as `{α=0, β=1}` for that resolver's variant posterior.
  - Acceptance: unit tests for each case asserting the correct deltas
    and side-effect rows.
- [ ] **B.3** — Migration:
  `repos/metabob-activity-api/sql/migrations/<next>-consent-veto.surql`
  defines `consent_veto { id, org_id, template_id, signature,
  revoked_at, expires_at }` with PERMISSIONS matching the
  `context_thompson_scores` table.
  - Selector read-path
    (`src/services/thompson-sampling.ts` or equivalent) gains a veto
    check: any `(template_id, signature)` with a non-expired
    `consent_veto` row returns score `-Infinity` (or is filtered out
    pre-draw).
  - Acceptance: integration test asserting a vetoed
    `(template, signature)` pair is not selected; after `expires_at`,
    selection resumes.
- [ ] **B.4** — H5 trigger stub. When `action_reversal_failed`
  fires, emit a structured log event `h5_regression_stub` with
  fields `{template_id, rollback_resolver_id, irreversibility_evidence,
  trace_id}`. Document the event name in
  `repos/metabob-activity-api/docs/events.md`.
  - Acceptance: integration test asserts the event fires on a
    fixture `action_reversal_failed` trace.

## Phase C — Sub-mode extensions (depends on B)

- [ ] **C.1** — Extend `safety_breach.breach_type` enum in
  `schemas.ts:920` to include `"region"` and `"attestation_expired"`.
  Add optional fields:
  - `attested_region?: string`, `attempted_region?: string` (for
    `region`).
  - `attestation_id?: string` (for `attestation_expired`).
  - `computeDeltas` treatment unchanged — both new values inherit the
    existing `safety_breach` `{α=0, β=1}` row.
  - Acceptance: zod round-trip; unit test asserts the correct delta
    for each new breach_type.
- [ ] **C.2** — Extend `budget_exhausted.budget_type` enum in
  `schemas.ts:913` to include `"display"`.
  - `computeDeltas` treatment: same as `cost` / `duration` half-
    penalty `{α=0, β=0.5}`.
  - Acceptance: zod round-trip; unit test asserts the half-penalty.
- [ ] **C.3** — Extend `verifier_negative` with optional
  `confidence_tier?: 1 | 2 | 3 | 4`. No new top-level type — this is
  a refinement of the existing one.
  - Update `computeDeltas` to read `confidence_tier` when present and
    apply the stratification table from the proposal (tier 1→β=1,
    tier 2→β=0.5, tier 3→β=0.5, tier 4→β=1). When absent, today's
    full β=1 unchanged.
  - Acceptance: unit tests for all 4 tiers plus the "absent" path;
    typecheck clean.
- [ ] **C.4** — Document `check_id: "detection_confidence"` as a
  recognized validator-side check id in
  `docs/architecture/VALIDATORS.md` (or
  `repos/metabob-activity-api/docs/validators.md` if that's the more
  current location). Tie to OmniParser-class detectors.
- [ ] **C.5** — Add a `bun test` integration scenario covering the
  full new surface: synthesize one trace per new failure-mode variant
  / sub-mode, run through `applyOutcomeToPosteriors`, assert the
  expected posterior writes and side-effect rows.

## Gates

| Phase | Gates | Notes |
|---|---|---|
| A | None — closes the cascading-misattribution gap standalone | Can land before B/C |
| B | None — new types are additive | H5 trigger is a stub until security-hardening H5 ships |
| C | Phase B deployed | Sub-mode extensions complete the display-layer failure coverage; B's new types take priority because they unblock the display-action openspec |

## Cross-references

- `2026-05-30-info-gain-bonus-on-success/` — success-side novelty
  stratification; this proposal is the failure-side dual
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` — Phase E
  push-away criteria consume `intervention_refused` impulses that now
  carry typed `consent_revoked` semantics
- `2026-04-26-security-hardening-findings/` — H5 immutable-baseline
  regression mode consumes the `action_reversal_failed` trigger
  (stubbed until H5 ships)
- `2026-05-31-display-signature-partitioning/` — sibling spec; the
  `consent_state_reset` veto is `(template, signature)`-keyed and
  depends on the partitioned signature
