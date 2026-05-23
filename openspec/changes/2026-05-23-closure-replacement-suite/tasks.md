# Tasks: Closure Replacement Suite

All tasks define contracts and validator names; concrete JSON task
graphs and validator check lists are out of scope per proposal.md.
Tasks are independently deployable. Phase ordering reflects only
contract-level dependencies (verify-merge-candidate before
self-deployment can consume it, etc.).

## §1 Memory closure

- [ ] 1.1 Land `memoryNote` shape definition (body schema per design §A)
  in activity-api `config.discovery.shapes`.
- [ ] 1.2 Land `memoryNote_write` admin-gated write shape.
- [ ] 1.3 Define `extract-memory-note` activity contract in
  ias-executor-ts `SHARED_TEMPLATES` (input shape, output shape,
  lifecycle trigger; task array left as a placeholder for follow-up).
- [ ] 1.4 Wire `extract-memory-note` as a
  `lifecycle:execution:succeeded` observer in development-vessel.
- [ ] 1.5 Document confidence-weight defaults per type in
  `repos/development-vessel/CLAUDE.md`.

## §2 Skill mirror activity contracts

- [ ] 2.1 Draft contract stubs (input shape, output shape, owning
  vessel, one-sentence task summary) for the eight activities in
  design §B:
  - `propose-spec`
  - `apply-spec`
  - `archive-spec`
  - `cleanup-docs`
  - `review-pr`
  - `audit-security`
  - `deploy-substrate`
  - `cron-dispatch`
- [ ] 2.2 Add each contract stub to
  `repos/ias-executor-ts/src/seed/SHARED_TEMPLATES.ts` with a TODO
  marker for the task graph.
- [ ] 2.3 Declare the new output shapes
  (`proposedSpec`, `applyReport`, `archiveReport`, `cleanupReport`,
  `prVerdict`, `securityFindings`, `deploymentReport`,
  `cronDispatchResult`) in activity-api `config.discovery.shapes`.
- [ ] 2.4 Co-ownership wire-up: `cron-dispatch` lives in development-
  vessel's catalog but dispatches via boredom-vessel's timer surface.

## §3 Subagent equivalent activity contracts

- [ ] 3.1 Draft contract stubs for `subagent-plan`, `subagent-explore`,
  `subagent-general` per design §C.
- [ ] 3.2 Declare output shapes (`executionPlan`,
  `codebaseExplorationReport`, `goalCompletionReport`) in activity-api
  config.
- [ ] 3.3 Document that each is a composition over existing vessels;
  no new resolver primitives.

## §4 verify-merge-candidate contract

- [ ] 4.1 Declare `mergeCandidate` and `mergeVerdict` shapes in
  activity-api `config.discovery.shapes`.
- [ ] 4.2 Draft `verify-merge-candidate` activity contract stub per
  design §D.
- [ ] 4.3 Document the harness composition contract: the activity
  MUST invoke (in order) failure-mode-harness, Phase 19 reuse-
  validation harness, and (if available) lift-criterion-hardening
  anchors. Aggregation rules per design §D.
- [ ] 4.4 Cross-reference: `substrate-self-deployment` task §5
  consumes this verdict (no edits to that spec; consumption is via
  shape).
- [ ] 4.5 Document the `needs_human` verdict routing rule.

## §5 Self-healing activity contracts

- [ ] 5.1 Declare `recoveryReport` shape in activity-api config.
- [ ] 5.2 Declare input shapes `recoveryTarget`, `migrationRequest`,
  `logQuery`, `probeRequest`.
- [ ] 5.3 Draft contract stubs for the five self-healing activities
  (design §E):
  - `restart-vessel`
  - `restore-from-backup`
  - `rerun-migration`
  - `inspect-vessel-logs`
  - `dispatch-debug-probe`
- [ ] 5.4 Document cross-references: substrate-self-deployment uses
  `restart-vessel`; substrate-forge-vessel uses `restart-vessel` +
  `restore-from-backup`. No edits to those specs.

## §6 propose-spec spec-authoring role + foundation-compliance validator

- [ ] 6.1 Confirm `propose-spec` contract from §2.1 covers the
  spec-authoring role; document the §F role in
  `repos/development-vessel/CLAUDE.md`.
- [ ] 6.2 Name (do not define) the `foundation-compliance` validator;
  reserve its id in development-vessel's validator catalog.
- [ ] 6.3 Provide 3-5 indicative checks per design §F as a starting
  set; mark the full enumeration as deferred to a follow-up spec.
- [ ] 6.4 Declare `validationResult` output shape (or reuse existing
  validator validation_result shape per minibob convention).

## §7 Closure-audit algorithm + closure-audit-tick activity

- [ ] 7.1 Declare `closureStatusReport` shape per design §G.
- [ ] 7.2 Declare `cronTick` input shape (if not already present from
  cron-dispatch §2.1).
- [ ] 7.3 Draft `closure-audit-tick` activity contract stub.
- [ ] 7.4 Specify the audit script's per-(property, external_tool)
  algorithm in `validation/scripts/closure-audit.ts` (algorithm in
  design §G; TypeScript implementation is a tasks item, not a spec
  requirement).
- [ ] 7.5 Build the per-property → external-tool dependency table
  (design §G.1) referenced by the algorithm. This is a tasks-level
  deliverable; not pinned in the spec.
- [ ] 7.6 Configure boredom-vessel cron entry for nightly run at
  substrate-local 02:00, mode "standard".
- [ ] 7.7 Persist results to `validation/state/closure-status.json`
  for operator-visible diagnosis.

## §8 Recursive closure (audit-of-audit)

- [ ] 8.1 Implement `audit_mode === "without-audit-itself"` branch in
  closure-audit-tick.
- [ ] 8.2 Wire the four alternative-signals checks per design §H:
  chain-stall reports, lift anchors, adversarial probes,
  operator-quiescence.
- [ ] 8.3 Configure a second boredom-vessel cron entry: weekly run
  with mode "without-audit-itself".
- [ ] 8.4 Document the layer-1 / layer-2 / layer-3 defence model in
  `repos/development-vessel/CLAUDE.md`.
- [ ] 8.5 §27.3.j.7 acceptance counts only standard-mode reports;
  document this so the lift gate is not gameable by Layer 2 alone.

## §9 Tests

- [ ] 9.1 Contract test per skill mirror activity: dispatch with a
  minimal input impulse, assert output shape is produced (task graph
  is allowed to be a placeholder).
- [ ] 9.2 Contract test for `verify-merge-candidate`: dispatch with a
  toy `mergeCandidate`; assert `mergeVerdict` is produced and
  harness-results sub-fields are populated.
- [ ] 9.3 Contract test for each self-healing activity against a
  forked sandbox vessel.
- [ ] 9.4 Contract test for `extract-memory-note` lifecycle wiring:
  emit a synthetic `lifecycle:execution:succeeded` event, assert at
  least one `memoryNote_write` is dispatched.
- [ ] 9.5 Audit dry-run test: invoke `closure-audit-tick` against a
  substrate where ≥1 replacement is intentionally stubbed; assert
  the corresponding `(property, external_tool)` cell verdict is
  `fail` with a populated `missing_dependency`.
- [ ] 9.6 Recursive-mode test: invoke `closure-audit-tick` with
  `audit_mode: "without-audit-itself"`; assert that the four
  alternative signals are consulted and a `confidence_weight: 0.7`
  report is emitted.

## §10 Acceptance gates

- [ ] 10.1 All contract stubs for §1-§7 land in
  `repos/ias-executor-ts/src/seed/SHARED_TEMPLATES.ts` with their
  declared input/output shape contracts.
- [ ] 10.2 All new shapes are advertised in activity-api
  `config.discovery.shapes`.
- [ ] 10.3 `closure-audit-tick` is dispatched by boredom-vessel cron
  and produces a `closureStatusReport` impulse end-to-end.
- [ ] 10.4 §27.3.j.7 acceptance becomes evaluable: at least one
  nightly run produces a non-`not-applicable` verdict for every
  `(property, external_tool)` cell defined in the §G.1 dependency
  table.
- [ ] 10.5 Three consecutive `all_green: true` standard-mode reports
  on a substrate where all replacements are implemented. (This gate
  may not be achievable until per-activity seed-template
  implementations land in follow-up work; the gate is *evaluable*
  here even when red.)
