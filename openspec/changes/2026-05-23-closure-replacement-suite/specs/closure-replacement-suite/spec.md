# Spec — Closure Replacement Suite

Normative requirements. Each is testable. All shapes declared here
MUST appear in activity-api `config.discovery.shapes` and be owned by
the indicated vessel. All activity contracts MUST be present in
`repos/ias-executor-ts/src/seed/SHARED_TEMPLATES.ts` (concrete task
graphs deferred to per-activity follow-up implementation).

## R0 — Sequencing

- **R0.1** This spec depends on
  `2026-05-23-substrate-closure-properties` (names the gaps) and
  `2026-05-23-substrate-explicit-vessels` (provides
  development-vessel, ias-executor-ts toolkit, bootstrap-seeder).
- **R0.2** This spec MUST land before
  `2026-05-23-substrate-self-deployment` enters implementation
  because that spec consumes `verify-merge-candidate` and
  `propose-spec`.
- **R0.3** This spec MUST land before
  `2026-05-23-substrate-forge-vessel`'s promotion/rollback tasks
  reach implementation because those tasks consume `restart-vessel`
  and `restore-from-backup`.

## R1 — Memory closure

- **R1.1** Development-vessel MUST advertise shape `memoryNote` with
  body schema per design §A.
- **R1.2** Development-vessel MUST advertise admin-gated shape
  `memoryNote_write`.
- **R1.3** Activity `extract-memory-note` MUST exist as a contract
  stub in ias-executor-ts SHARED_TEMPLATES with input shape
  `executionTraceWithSignatures`, output shape `memoryNote_write`,
  and a lifecycle observer trigger on
  `lifecycle:execution:succeeded`.
- **R1.4** Confidence-weight defaults per design §A
  (`finding` 0.6, `feedback` 0.4, `reference` 0.7) MUST be applied
  by the resolver when emitting `memoryNote_write` impulses without
  an explicit weight.

## R2 — Skill mirror activity contracts

- **R2.1** Activity `propose-spec` MUST exist with input shape
  `changeIntent` and output shape `proposedSpec`.
- **R2.2** Activity `apply-spec` MUST exist with input shape
  `specReference` and output shape `applyReport`.
- **R2.3** Activity `archive-spec` MUST exist with input shape
  `specReference` and output shape `archiveReport`.
- **R2.4** Activity `cleanup-docs` MUST exist with input shape
  `docCleanupRequest` and output shape `cleanupReport`.
- **R2.5** Activity `review-pr` MUST exist with input shape
  `prReference` and output shape `prVerdict`.
- **R2.6** Activity `audit-security` MUST exist with input shape
  `securityScope` and output shape `securityFindings`. Co-owned by
  H6 verifier-vessel when shipped.
- **R2.7** Activity `deploy-substrate` MUST exist with input shape
  `deploymentRequest` and output shape `deploymentReport`.
- **R2.8** Activity `cron-dispatch` MUST exist with input shape
  `cronSpec` and output shape `cronDispatchResult`. Co-owned by
  boredom-vessel (timer) and development-vessel (catalog).

## R3 — Subagent equivalent activity contracts

- **R3.1** Activity `subagent-plan` MUST exist with input shape
  `planRequest`, output shape `executionPlan`, and MUST be implemented
  as a composition over llm-resolver-vessel + concept-db + activity-api
  (no new resolver primitives).
- **R3.2** Activity `subagent-explore` MUST exist with input shape
  `exploreRequest`, output shape `codebaseExplorationReport`, and
  MUST compose local-tools-vessel + concept-db + llm-resolver-vessel.
- **R3.3** Activity `subagent-general` MUST exist with input shape
  `generalSubgoal`, output shape `goalCompletionReport`, and MUST
  dispatch through goal-host-vessel.

## R4 — verify-merge-candidate

- **R4.1** Shapes `mergeCandidate` and `mergeVerdict` MUST be
  advertised in activity-api `config.discovery.shapes` with bodies
  per design §D.
- **R4.2** Activity `verify-merge-candidate` MUST exist with input
  shape `mergeCandidate` and output shape `mergeVerdict`.
- **R4.3** The activity's task graph (deferred to follow-up) MUST
  compose: substrate-forge-vessel fork-with-diff, failure-mode-harness,
  Phase 19 reuse-validation harness, and (when present)
  lift-criterion-hardening anchors.
- **R4.4** The activity MUST emit a `needs_human` verdict (rather
  than `fail`) when harness results contradict each other or when
  regression indicators include a §27.3.c.1-protected category.
- **R4.5** `mergeVerdict` MUST carry a `confidence_weight` per the
  signal-confidence-weighting field schema.

## R5 — Self-healing activities

- **R5.1** Shape `recoveryReport` MUST be advertised per design §E.
- **R5.2** Activity `restart-vessel` MUST exist with input shape
  `recoveryTarget` and output shape `recoveryReport`.
- **R5.3** Activity `restore-from-backup` MUST exist with input
  shape `recoveryTarget` (carrying `backup_ref`) and output shape
  `recoveryReport`.
- **R5.4** Activity `rerun-migration` MUST exist with input shape
  `migrationRequest` and output shape `recoveryReport`.
- **R5.5** Activity `inspect-vessel-logs` MUST exist with input
  shape `logQuery` and output shape `recoveryReport`. The report
  MUST embed a `log_excerpt` field as evidence.
- **R5.6** Activity `dispatch-debug-probe` MUST exist with input
  shape `probeRequest` and output shape `recoveryReport`.

## R6 — propose-spec + foundation-compliance

- **R6.1** The `propose-spec` activity contract from R2.1 is the
  authoritative source for spec authoring. This rule does not
  duplicate the contract; it asserts the spec-authoring role.
- **R6.2** A validator with id `foundation-compliance` MUST be
  registered in development-vessel's validator catalog.
- **R6.3** The validator MUST consume a `proposedSpec` impulse and
  emit a `validationResult` impulse (or equivalent existing
  validator-result shape per minibob convention).
- **R6.4** The validator MUST evaluate AT LEAST the three indicative
  checks: (a) introduction of any new primitive cites
  `IMPULSE_ACTIVITY_FOUNDATION.md`; (b) declared activities have
  explicit `input_shapes` and `output_shapes`; (c) declared shapes
  appear in some owning vessel's `config.discovery.shapes`.
- **R6.5** The full check list is explicitly deferred to a follow-up
  spec; this spec asserts only the minimum subset for the validator
  to function.

## R7 — Closure-audit script

- **R7.1** Shape `closureStatusReport` MUST be advertised per design
  §G.
- **R7.2** Activity `closure-audit-tick` MUST exist with input shape
  `cronTick` and output shape `closureStatusReport`.
- **R7.3** Script `validation/scripts/closure-audit.ts` MUST
  implement the parametric `(property, external_tool)` algorithm in
  design §G. Implementation is a tasks-level deliverable; the spec
  requirement is the script exists and is invokable by
  `closure-audit-tick`.
- **R7.4** The script MUST persist its result to
  `validation/state/closure-status.json` in addition to emitting the
  `closureStatusReport` impulse.
- **R7.5** A boredom-vessel cron entry MUST schedule
  `closure-audit-tick` for nightly run at substrate-local 02:00 with
  `audit_mode: "standard"`.
- **R7.6** The script MUST NOT actually modify the substrate during
  synthetic removal of an external tool; refusal is implemented by
  flagging resolvers, not by stopping vessels.

## R8 — Recursive closure (audit-of-audit)

- **R8.1** `closure-audit-tick` MUST support
  `audit_mode === "without-audit-itself"`.
- **R8.2** In that mode the script MUST consult AT LEAST the four
  alternative signals per design §H: chain-stall reports, lift
  anchors, adversarial probes, operator-quiescence.
- **R8.3** Reports in `without-audit-itself` mode MUST carry
  `confidence_weight: 0.7` (vs 1.0 for standard mode).
- **R8.4** A weekly boredom-vessel cron entry MUST schedule a
  `without-audit-itself` run.
- **R8.5** §27.3.j.7 lift acceptance counts ONLY standard-mode
  reports. `without-audit-itself` reports are reinforcing, not
  load-bearing for the lift gate.
- **R8.6** When standard-mode reports green but
  `without-audit-itself` mode disagrees within a 7-day window, the
  substrate MUST emit a `needs_human` lift signal to operator
  channels.

## R9 — Tests

- **R9.1** Each of R2.1-R2.8, R3.1-R3.3, R4.2, R5.2-R5.6, and R7.2
  MUST have a contract test that dispatches the activity with a
  minimal input impulse and asserts the declared output shape is
  produced (task graph may be a placeholder for follow-up).
- **R9.2** R1.3 (extract-memory-note) MUST have a lifecycle-wiring
  test: synthetic `lifecycle:execution:succeeded` event triggers at
  least one `memoryNote_write` dispatch.
- **R9.3** Audit dry-run test: on a substrate where ≥1 replacement
  is intentionally stubbed, `closure-audit-tick` MUST produce a
  report with at least one `verdict: "fail"` and a populated
  `missing_dependency`.
- **R9.4** Recursive-mode test: `closure-audit-tick` with
  `audit_mode: "without-audit-itself"` MUST produce a report with
  `confidence_weight: 0.7` and evidence that all four alternative
  signals were consulted.

## R10 — Acceptance gates

- **R10.1** *Load-bearing acceptance*: `closure-audit-tick` produces
  a `closureStatusReport` with `all_green: true` in standard mode for
  three consecutive nightly runs on a substrate where all
  replacements named in R1-R6 are implemented. This gate is the one
  §27.3.j.7 of substrate-closure-properties binds on.
- **R10.2** All shapes named in R1.1-R1.2, R2.*, R3.*, R4.1, R5.1-R5.2,
  R7.1 MUST be advertised in `config.discovery.shapes` and resolvable
  via `POST /v2/impulses/resolve` end-to-end.
- **R10.3** All activity contracts named in R1.3, R2.*, R3.*, R4.2,
  R5.2-R5.6, R7.2 MUST exist in
  `repos/ias-executor-ts/src/seed/SHARED_TEMPLATES.ts` and be
  seeded into activity-api by `bootstrap-seeder.service` at substrate
  boot.
- **R10.4** R10.1 may remain red until per-activity seed-template
  follow-up work lands; the gate must be *evaluable* (produce a
  non-vacuous report) here even when not yet green.
