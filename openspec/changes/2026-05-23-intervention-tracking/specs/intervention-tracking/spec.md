# Spec — Intervention Tracking

Normative requirements. Each is testable. All terminology aligned
with `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` and IAL
`2026-04-26-impulse-activity-loop/tasks.md` §27.S.6. Section
references are inline. This spec fills the emitter-ownership and
aggregation gap §27.S.6 leaves open; it does NOT amend §27.S.6.

## R0 — Sequencing and authority

- **R0.1** This spec is downstream of
  `2026-05-23-closure-replacement-suite` (development-vessel as the
  meta-vessel resolver) AND
  `2026-05-23-substrate-self-deployment` (defines
  `verify-merge-candidate` and the self-deployment whitelist
  consumed by R6.1 and R6.5).
- **R0.2** Soft dependency on
  `2026-05-23-lift-criterion-hardening` (defines
  `adversarialProbeReport` referenced by R8.4) and
  `2026-05-23-signal-confidence-weighting` (defines
  `signal_confidence_weight` referenced by R7.4).
- **R0.3** **Spec authority.** The four shape contracts in R1–R4
  are this spec's authority. Other specs MUST NOT redefine the
  fields inline. Future evolution of any of the four shapes lands
  via change-supersession of THIS change, not via inline edit by a
  consuming spec.

### ADDED Requirements

#### Requirement R1 — `operatorIntervention` shape contract

- **R1.1** development-vessel MUST advertise `operatorIntervention`
  in `config.discovery.shapes` with body schema per design §A.1.
- **R1.2** Required fields: `id`, `attempted_at`, `kind`, `target`,
  `classification_rationale`, `evidence.method`,
  `evidence.detection_hook_id`.
- **R1.3** `kind` MUST be one of `intervention | maintenance |
  redundant`. The `interventionRateReport` (R4) counts
  `intervention` toward the rate signal; `maintenance` is excluded;
  `redundant` is tracked separately.
- **R1.4** When the detection hook cannot determine kind, the
  emission MUST use `kind: "intervention"` (conservative default)
  with `classification_rationale: "indeterminate; awaiting operator
  reclassification"`.

##### Scenario: anchor rotation emits maintenance, not intervention

- WHEN the operator writes `validation/held-out-eval-set/v<N+1>.json`
- THEN development-vessel's `fs-watcher` hook emits an
  `operatorIntervention` with
  `target.target_type: "anchor_rotation"` and `kind: "maintenance"`.
- AND the next `interventionRateReport`'s
  `intervention_counts_by_kind.intervention` MUST NOT increment from
  this event.

##### Scenario: ambiguous detection defaults to intervention

- WHEN a detection hook fires with insufficient evidence to classify
- THEN the emission MUST use `kind: "intervention"` and
  `classification_rationale` MUST contain the string `"indeterminate"`.

#### Requirement R2 — `interventionRefused` shape contract

- **R2.1** development-vessel MUST advertise `interventionRefused`
  with body schema per design §A.2.
- **R2.2** Required fields: `id`, `refused_at`,
  `intervention_attempted`, `refusing_gate.vessel_id`,
  `refusing_gate.gate_id`, `refusing_gate.refusal_code`,
  `cited_evidence.trace_ids` (non-empty).
- **R2.3** When the refusal cites posterior state, validator output,
  or a foundation invariant, `cited_evidence` MUST carry the
  corresponding field. Empty `cited_evidence` (only the trace id) is
  permitted only when the refusal is purely structural.
- **R2.4** `related_intervention_id` SHOULD be populated when the
  refusal is correlatable to a preceding `operatorIntervention`.

##### Scenario: verify-merge-candidate refusal carries cited evidence

- WHEN `verify-merge-candidate` refuses a force-merge attempt
- THEN it MUST emit an `interventionRefused` with
  `refusing_gate.gate_id: "verify-merge-candidate"`,
  `cited_evidence.trace_ids` containing the harness verdict trace,
  AND `cited_evidence.validator_verdict` containing the harness
  failure summary.

#### Requirement R3 — `interventionAuditVerdict` shape contract

- **R3.1** development-vessel MUST advertise
  `interventionAuditVerdict` with body schema per design §A.3.
- **R3.2** Required fields: `id`, `audited_at`,
  `refused_intervention_id`, `verdict`, `operator_notes`.
- **R3.3** When `verdict: "unsound"`, the emission MUST set
  `follow_up_lift_blocker_ref` OR `operator_notes` MUST contain a
  rationale for omitting the lift-blocker.
- **R3.4** When `reclassified_kind` is set, the
  `intervention-rate-tick` aggregator MUST use the reclassified
  kind for the originating `operatorIntervention` in subsequent
  reports.

##### Scenario: unsound audit emits a lift-blocker

- WHEN the operator audits a refusal and finds the substrate's
  rationale incorrect
- THEN the `interventionAuditVerdict` MUST carry
  `verdict: "unsound"` AND either
  `follow_up_lift_blocker_ref` is set OR `operator_notes` explains
  why no lift-blocker is needed.

#### Requirement R4 — `interventionRateReport` shape contract

- **R4.1** development-vessel MUST advertise
  `interventionRateReport` with body schema per design §A.4.
- **R4.2** Required fields: `id`, `emitted_at`, `window.start`,
  `window.end`, `window.lookback_seconds`,
  `intervention_counts_by_kind`, `audit_sample_size`,
  `report_unavailable`, `trend.direction`.
- **R4.3** When no interventions were observed in the window, the
  report MUST set `report_unavailable: true`,
  `refusal_rate: null`, `refusal_soundness_rate: null`.
- **R4.4** When a `adversarialProbeReport` (from
  `2026-05-23-lift-criterion-hardening`) is the most-recent emission
  in the window, the report MUST set
  `adversarial_exposure_index_ref` to that report's id.
- **R4.5** The report is informational; its emission does NOT
  generate Thompson posterior updates against the emitting activity.

##### Scenario: empty window produces a soft-pass report

- WHEN `intervention-rate-tick` fires over a window with zero
  `operatorIntervention` impulses
- THEN it MUST emit an `interventionRateReport` with
  `report_unavailable: true`, `refusal_rate: null`,
  `refusal_soundness_rate: null`. No exception is raised.

#### Requirement R5 — Emitter ownership

- **R5.1** All four shapes (R1–R4) MUST be resolved by
  `development-vessel`.
- **R5.2** Each shape MUST satisfy development-vessel's
  three-place shape-dispatch agreement (resolver file +
  `config.discovery.shapes` entry + `impulses.ts` case in one
  commit; `bun run lint` green at the commit boundary).
- **R5.3** Five detection hooks MUST be implemented per design §C:
  `fs-watcher`, `orchestration-log`, `api-origin`, `db-audit`,
  `spec-attribution`. Each hook MUST be testable in isolation per
  R9.1.
- **R5.4** Detection hooks MUST degrade gracefully when their data
  source is absent (no crashes, no thrown exceptions; missing-source
  surfaces as absence of emission, not as resolver failure).

##### Scenario: missing orchestration vessel does not crash development-vessel

- WHEN the container-orchestration vessel is unreachable
- THEN the `orchestration-log` hook MUST log a degradation notice
  AND continue operation. The other four hooks MUST remain functional.

#### Requirement R6 — Refusal-emission integration

- **R6.1** `verify-merge-candidate` (from
  `2026-05-23-substrate-self-deployment`) MUST emit
  `interventionRefused` on every refusal, with
  `refusing_gate.gate_id: "verify-merge-candidate"`.
- **R6.2** `foundation-compliance` validator (from
  `2026-05-23-closure-replacement-suite` §B) MUST emit on every
  refusal with `refusing_gate.gate_id: "foundation-compliance"`.
- **R6.3** `posterior-anomaly-check` MUST emit on every refusal
  with `refusing_gate.gate_id: "posterior-anomaly-check"`. (Active
  once the check is implemented; spec lands ahead of the check.)
- **R6.4** `scope-narrowing` in `create-shape-provider-goal` (from
  `2026-04-26-shape-provider-goal-creation`) MUST emit on every
  refusal with `refusing_gate.gate_id: "shape-provider-scope"`.
- **R6.5** `self-deployment-whitelist` (from
  `2026-05-23-substrate-self-deployment` §8) MUST emit on every
  refusal with `refusing_gate.gate_id:
  "self-deployment-whitelist"`.
- **R6.6** Integration MUST be additive — each gate's existing
  refusal output is unchanged; the emission is in addition to it.
- **R6.7** Future substrate gates that refuse operator actions
  SHOULD emit `interventionRefused`. New gates are appended to
  design §D via change-supersession of this spec.

##### Scenario: refusal emits both the existing output and an interventionRefused

- WHEN `verify-merge-candidate` refuses a PR merge
- THEN the gate's existing refusal output (failure-mode
  `verifier_negative`) is emitted AS BEFORE,
- AND additionally an `interventionRefused` impulse is emitted with
  the contract per R2.

#### Requirement R7 — Audit workflow

- **R7.1** The `audit-intervention-refused` activity MUST be
  implementable per design §E. Input `auditScope` and output
  `interventionAuditVerdict_write` contracts are normative.
- **R7.2** The activity MUST sample `interventionRefused` impulses
  in the lookback window, dispatch via human-resolver for operator
  verdict, and emit one `interventionAuditVerdict` per sampled
  refusal.
- **R7.3** The operator UX surface (workbench, CLI, dashboard) is
  not specified by this spec. The activity contract specifies ONLY
  the impulse contract and the human-resolver field set.
- **R7.4** Audit verdict emissions MUST carry
  `signal_confidence_weight = 1.0` (per
  `2026-05-23-signal-confidence-weighting`; soft dependency).

##### Scenario: operator audits a sampled refusal

- WHEN the operator dispatches `audit-intervention-refused` with
  `auditScope.sample_size: 5`
- AND there are at least 5 `interventionRefused` impulses in the
  lookback window
- THEN the activity MUST emit exactly 5
  `interventionAuditVerdict` impulses, one per sampled refusal.

#### Requirement R8 — Aggregation

- **R8.1** The `intervention-rate-tick` activity MUST be
  implementable per design §F. Input `rateTickConfig` and output
  `interventionRateReport_write` contracts are normative.
- **R8.2** The aggregator MUST query `operatorIntervention`,
  `interventionRefused`, and `interventionAuditVerdict` impulses
  in the lookback window, compute the report fields per R4.2,
  and emit one `interventionRateReport`.
- **R8.3** The aggregator MUST honour `reclassified_kind` per R3.4
  when computing per-kind counts.
- **R8.4** The aggregator MUST cross-reference the most-recent
  `adversarialProbeReport` in the window per R4.4 when available.
- **R8.5** The aggregator MUST be wired via `cron-dispatch` (per
  `2026-05-23-closure-replacement-suite` §B). Default cadence
  daily; operator-tunable via
  `validation/state/intervention-tracking-config.json`.

#### Requirement R9 — Tests

- **R9.1** Per-resolver test per
  `repos/development-vessel/CLAUDE.md` discipline: one test file per
  detection hook, per shape resolver, per gate refusal-emission
  integration.
- **R9.2** Integration test asserting each detection hook produces
  the expected `operatorIntervention` emission for its corresponding
  event class.
- **R9.3** Integration test asserting each gate in R6 emits both
  its existing refusal output AND an `interventionRefused` impulse.
- **R9.4** Integration test asserting `audit-intervention-refused`
  with a fake human-resolver emits the expected
  `interventionAuditVerdict`.
- **R9.5** Integration test asserting `intervention-rate-tick`
  over a seeded window emits a report with correct counts, rates,
  and trend.
- **R9.6** Soft-pass test: empty window emits
  `report_unavailable: true`.

#### Requirement R10 — Acceptance gates

- **R10.1** `bun run lint` green in development-vessel after all
  four shapes register (R1.1, R2.1, R3.1, R4.1) and all detection
  hooks land (R5.3).
- **R10.2** All R9 tests green.
- **R10.3** First `operatorIntervention` emitted against this
  spec's authorship, with `target.target_type: "spec_authorship"`
  and `target.target_id` containing
  `"2026-05-23-intervention-tracking"`. The substrate's first datum
  of its own corpus.
- **R10.4** Spec authority (R0.3) preserved across deployment: no
  consuming spec amends the four shape contracts inline.
- **R10.5** No new external dependencies introduced. All hooks
  degrade gracefully when their data source is absent (per R5.4).
- **R10.6** **NON-GATE.** This spec does NOT declare S3 reached.
  The §27.S.6 measure and the S3 judgement remain operator-only.
  R10 success means the data is produced; it does NOT mean the
  substrate has crossed S3.
