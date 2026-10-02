# test-audit-loop Specification

## Purpose

Every test in the system is an activity producing a `test_report` impulse.
The same loop that audits system outputs SHALL audit those reports against two
criteria — representativeness and goal alignment — and SHALL dispatch an
autonomous debug activity when an audit fails. No test infrastructure
sub-system exists separately from the activity system; tests, audits, and
debug-failures are all ordinary activities executing in the canary
environment.

## Requirements

### Requirement: Every test_report MUST be accompanied by a test_registration

Every emitted `test_report` impulse SHALL carry a `test_registration_id`
referencing a `test_registration` impulse persisted in the activity-api
registry. When a `test_report` is emitted without a registration, the audit
machinery SHALL auto-tag the report with `caveats: ["unregistered"]` and the
test SHALL be added to `validation/scripts/registration-backlog.json`.

#### Scenario: Registered test emits a normal report

- **WHEN** a test with a stored `test_registration` runs and emits a
  `test_report`
- **THEN** the report's `test_registration_id` field is set
- **AND** the downstream audit dispatch proceeds without the `unregistered`
  caveat

#### Scenario: Unregistered test emits a caveated report

- **WHEN** a test without a `test_registration` runs and emits a `test_report`
- **THEN** the report is persisted with `caveats: ["unregistered"]`
- **AND** the test's path is appended to `registration-backlog.json` if not
  already present

#### Scenario: Registration backlog is itself audited

- **WHEN** the weekly harness runs
- **THEN** `registration-backlog.json` is emitted as an artefact that the audit
  loop consumes
- **AND** the count of unregistered tests appears in the weekly audit summary

---

### Requirement: Audit MUST run within 10 minutes of test_report emission

The `audit-test-report` activity SHALL begin execution within **10 minutes**
of the `lifecycle:execution:succeeded` event carrying the `test_report` shape.
Failure to dispatch within the window SHALL itself be persisted as a
`failure_mode = verifier_negative` trace with `validator_id =
"audit-test-report-dispatch"`.

#### Scenario: Audit runs in time

- **WHEN** a `test_report` is emitted at time T
- **THEN** the matching `audit-test-report` execution begins before T + 10 min
- **AND** the audit's `test_audit_report` is persisted before T + 15 min

#### Scenario: Audit misses the window

- **WHEN** no `audit-test-report` execution begins within 10 min of a
  `test_report` emission
- **THEN** a `verifier_negative` trace is persisted with
  `validator_id = "audit-test-report-dispatch"`
- **AND** the missed audit is retried on the next lifecycle tick

---

### Requirement: Sensitivity probe MUST run on the declared cadence

`run-sensitivity-probe` SHALL run on the cadence published in
`test_registration.perturbation_cadence`. The default cadence is **weekly**;
permitted values are `daily`, `weekly`, `monthly`. Cadence updates on a
`testRegistration_write` SHALL trigger an immediate probe in addition to
re-scheduling.

#### Scenario: Default cadence runs weekly

- **WHEN** a registration omits `perturbation_cadence`
- **THEN** `run-sensitivity-probe` is dispatched once per ISO week against
  that test

#### Scenario: Cadence update triggers immediate probe

- **WHEN** a `testRegistration_write` modifies `perturbation_schedule` or
  `perturbation_cadence`
- **THEN** a `lifecycle:test_registration:updated` event fires
- **AND** `run-sensitivity-probe` is dispatched against the updated
  registration on the next dispatch tick

---

### Requirement: debug-failing-audit MUST emit exactly one of three proposal shapes

For every failed `test_audit_report`, `debug-failing-audit` SHALL emit
exactly one of:
- `code_modification_proposal`
- `system_modification_proposal`
- `human_review_request`

The selection SHALL be determined by the LLM classifier's
`verification_confidence` and the scope of the proposed change, not by an
audit-specific routing layer. `human_review_request` SHALL be issued via the
same `verification_confidence < threshold` gate used by any other activity;
no audit-specific human-escalation path SHALL exist.

#### Scenario: High-confidence test-only modification

- **WHEN** the classifier returns `verification_confidence ≥ threshold` and
  the proposed change is confined to `validation/scripts/`
- **THEN** `code_modification_proposal` is emitted with
  `risk_tier: "test_only"`

#### Scenario: High-confidence system modification

- **WHEN** the classifier returns `verification_confidence ≥ threshold` and
  the proposed change touches code outside `validation/scripts/`
- **THEN** `system_modification_proposal` is emitted

#### Scenario: Low-confidence classification falls through to human

- **WHEN** the classifier returns `verification_confidence < threshold`
- **THEN** `human_review_request` is emitted
- **AND** the request is consumed by the standard `HumanResolver` tier as
  documented in `repos/minibob/src/resolvers/`, not by an audit-specific
  surface

---

### Requirement: Audits SHALL themselves be auditable, bounded by depth cap of 2

`audit-test-report` traces are subject to the same audit loop. The recursion
SHALL be bounded by a `composition_chain` depth cap of **2** (default). When
a dispatch occurs at depth ≥ 2, the activity SHALL emit
`failure_mode: { type: "safety_breach", context: { breach_type: "depth",
limit: 2, ancestor_chain: <chain> } }` and SHALL skip execution. The cap is
configurable per `test_registration` but defaults to 2 and SHALL NOT be
configurable to a value > 4.

#### Scenario: Meta-audit runs (depth 1)

- **WHEN** an `audit-test-report` trace is audited
- **THEN** the meta-audit dispatches and runs to completion

#### Scenario: Meta-meta-audit is rejected (depth 2 exceeded)

- **WHEN** a third-level audit (audit of meta-audit's audit) is dispatched
- **THEN** the dispatch is rejected with `failure_mode.type = "safety_breach"`
  and `breach_type = "depth"`
- **AND** the trace's `ancestor_chain` is recorded for diagnosis

#### Scenario: Cap configurability is bounded

- **WHEN** a `test_registration` declares `audit_depth_cap > 4`
- **THEN** the registration write is rejected with a schema validation error

---

### Requirement: All audit-related activities SHALL run in canary, with no isolation

Activities `audit-test-report`, `run-sensitivity-probe`, and
`debug-failing-audit` SHALL execute in the same canary environment
(`activity.metabob.com`) as the system they audit. No staging,
shadow-execution, or test-isolation environment SHALL be introduced.
Activities are safe by construction: validators, scope-narrowing per
`shape-provider-goal-creation`, and the depth cap above provide the
guarantees that an isolation layer would otherwise be assumed to provide.

Failure of the audit loop on canary SHALL itself be observable as a
`failure_mode = verifier_negative` event in the standard observability layer.

#### Scenario: Audit failure visible on canary

- **WHEN** `audit-test-report` itself fails (e.g. LLM resolver budget
  exhausted)
- **THEN** the trace is persisted with the canonical `failure_mode`
  (`budget_exhausted` in this example) on canary
- **AND** the workbench execution browser surfaces the failure with no
  special handling

#### Scenario: No isolation environment

- **WHEN** any audit-related activity executes
- **THEN** the executing `vessel_id` resolves to a canary-deployed vessel
  (the same `activity.metabob.com` pool used by user-driven traces)
- **AND** no separate `audit-isolation-*` namespace exists in the deployment

---

### Requirement: Witness types reference the multi-witness-verification contract verbatim

`test_registration.witness_types` SHALL contain only values defined by
`2026-05-17-stratified-goal-generator-harness/specs/multi-witness-verification/spec.md:58-122`
— specifically `differential_solve`, `oracle_label`, `validator_consensus`.
No additional witness types SHALL be defined for tests.

#### Scenario: Valid witness types accepted

- **WHEN** a registration declares
  `witness_types: ["differential_solve", "validator_consensus"]`
- **THEN** the write succeeds

#### Scenario: Unknown witness type rejected

- **WHEN** a registration declares
  `witness_types: ["test_specific_witness"]`
- **THEN** the write is rejected with a schema validation error citing the
  multi-witness-verification spec
