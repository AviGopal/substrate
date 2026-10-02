# Proposal: Test-Audit Loop

## Why

Today every test in `validation/scripts/` reports a binary pass/fail and the harness
reports are taken at face value. `validation/scripts/reuse-harness.ts:1` writes
`validation/results/{date}-reuse-report.json` with the run's MRR; nothing inspects
whether that pass/fail is **meaningful**. `validation/scripts/test-22-forge-and-paths.ts:1`
asserts six dispatch paths succeed but publishes no perturbation schedule, no
sensitivity claim, and no mapping to the six success criteria in
`openspec/changes/2026-04-26-impulse-activity-loop/proposal.md:24-31`. There is no
record of which tests are insensitive (always pass), which are noisy (flap regardless
of input), and which are misaligned (the thing they measure is not what the IAL claims
to advance). The `validation/README.md` flow has no audit step — the report lands and
the loop ends.

The asymmetry is jarring: the impulse-activity loop already audits system outputs
via the validator-dispatch meta-activity
(`openspec/changes/archive/2026-04-26-validators-and-failure-modes/specs/failure-mode-taxonomy/spec.md:67`)
and stratifies failures by type; it has no analogue for test outputs. Tests are
exempt from the same scrutiny they enforce on the rest of the system.

The fix is to treat tests as first-class activities and run the audit machinery on
their reports. Tests emit a `test_report` impulse on each run. An `audit-test-report`
activity validates that report against two criteria (representativeness, goal
alignment), reusing the multi-witness contract already specified at
`openspec/changes/2026-05-17-stratified-goal-generator-harness/specs/multi-witness-verification/spec.md:18`.
When the audit fails, a `debug-failing-audit` activity proposes test or system
modifications. The whole chain runs in canary as ordinary activities — no special
dispatch path, no isolation, no test infrastructure sub-system.

## What Changes

- **`test_registration` shape and write resolver.** Every test publishes a
  registration impulse at first run with `id`, `inputs_schema`, `perturbation_schedule[]`,
  `goal_alignment[]`, `discrimination_claim`, `witness_types[]`. Stored in the existing
  `activity_template` table — tests are specialised activities. Existing tests
  grandfathered with `passed_with_caveat` until they register.
- **`audit-test-report` activity.** `inputShapes: ["test_report", "test_registration"]`,
  `outputShapes: ["test_audit_report"]`. Resolver chain: deterministic checks for
  record completeness and witness presence; LLM resolver for plausibility review of
  the `discrimination_claim`. Subscribes to `lifecycle:execution:succeeded` for
  shape `test_report`.
- **`run-sensitivity-probe` activity.** Takes a `test_registration` with its
  `perturbation_schedule`, executes each perturbation against the registered test,
  records outcomes, emits `sensitivity_evidence`. Dispatched on the cadence published
  in the registration (weekly default) or on test-modification trigger.
- **`debug-failing-audit` activity.** `inputShapes: ["test_audit_report"]` where
  audit failed. LLM resolver classifies failure (`audit_insensitive`, `audit_noisy`,
  `audit_misaligned`, `audit_record_incomplete`) and proposes a modification: emits
  `code_modification_proposal`, `system_modification_proposal`, or
  `human_review_request` (the last via the standard `verification_confidence <
  threshold` gate, same mechanism documented for any other activity in
  `repos/minibob/src/resolvers/`).
- **Failure-mode taxonomy extension.** Audit-specific failure modes
  (`audit_insensitive`, `audit_noisy`, `audit_misaligned`, `audit_record_incomplete`)
  are introduced as `verifier_negative` subtypes via `failed_evidence` rather than
  new top-level `failure_mode.type` values, preserving the closed enumeration in
  `failure-mode-taxonomy/spec.md:4`.
- **Harness integration.** `validation/scripts/reuse-harness.ts` and the other
  scripts in `validation/scripts/` are extended to emit a `test_report` impulse and
  to dispatch `audit-test-report` as a follow-up activity. Their JSON reports gain
  an `audit_summary` section. The weekly cron triggers `run-sensitivity-probe` runs.

## Success Criteria

1. **Registration coverage** — ≥ **80%** of registered tests in `validation/scripts/`
   carry both `perturbation_schedule` and `goal_alignment` within 30 days of spec
   landing. Coverage observable from the `test_registration` index.
2. **At least one autonomous test-modification PR** landed via `debug-failing-audit`
   within the same window. The PR's `code_modification_proposal` impulse SHALL link
   back to the originating `test_audit_report`.
3. **Audit-summary section** present in every harness report emitted after the
   spec lands.
4. **Insensitive-test detection rate** observable: the report SHALL surface the
   fraction of audits classified `audit_insensitive` over the trailing 30 days,
   so the rate can be tracked rather than guessed at.
5. **Recursive audit depth cap** enforced: no audit chain exceeds depth 2;
   violations are themselves `verifier_negative` events observable on canary.
6. **Witness reuse, not duplication** — the differential-solve, oracle, and
   validator-consensus witnesses defined in `multi-witness-verification/spec.md:58-122`
   are the only witness types referenced by `test_registration.witness_types`;
   no parallel witness machinery is introduced.

## Capabilities

### New Capabilities

- `test-registration-contract` — `test_registration` shape, write resolver, and
  the grandfathering rule that auto-tags unregistered tests with
  `passed_with_caveat`. Spec: `specs/test-audit-loop/spec.md`.
- `audit-test-report` — activity definition and resolver chain (deterministic
  checks + LLM alignment-claim review).
- `run-sensitivity-probe` — periodic perturbation runner emitting
  `sensitivity_evidence`.
- `debug-failing-audit` — LLM-classified failure handler with three proposal
  paths and the standard human-resolver gate.
- `test-audit-loop-recursion-cap` — depth-2 cap on audit-of-audit chains,
  enforced via the existing `safety_breach` depth guard at
  `failure-mode-taxonomy/spec.md:14`.

## Impact

- `validation/scripts/*` — each test gains a registration block at the top of the
  file and emits a `test_report` impulse at the end of its run. No new test
  infrastructure repository or package.
- `repos/metabob-activity-api` — one new write resolver (`testAuditReport_write`)
  following the existing 14 `*_write` resolvers documented at
  `docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`. No schema change beyond
  storing the four new impulse shapes (`test_report`, `test_registration`,
  `test_audit_report`, `sensitivity_evidence`) — `impulse_resolutions.*` is already
  `DEFINE FIELD OVERWRITE` per migration 093/094.
- `repos/minibob` — three new embedded meta-activities (`audit-test-report`,
  `run-sensitivity-probe`, `debug-failing-audit`) following the slot-binding /
  validator-dispatch / create-shape-provider-goal pattern.
- No new endpoints. Audits run on canary like any other activity. Cost: one extra
  LLM call per test run for the alignment-claim review (~$0.05/test), bounded by
  the existing audit-summary cadence.

## Dependencies

- **`2026-05-17-shape-dispatch-agreement`** — required so the four new shapes
  (`test_report`, `test_registration`, `test_audit_report`, `sensitivity_evidence`)
  are statically lint-verified against the `impulses.ts` dispatch table.
- **`2026-05-17-stratified-goal-generator-harness/specs/multi-witness-verification`**
  — witness types and decision-record contract are reused verbatim; this spec
  does not redefine them.
- **`archive/2026-04-26-validators-and-failure-modes/specs/failure-mode-taxonomy`**
  — audit-failure typing extends `verifier_negative.context.failed_evidence`; the
  closed five-type enumeration at `failure-mode-taxonomy/spec.md:4` is preserved.
