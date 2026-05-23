# Spec — Lift-Criterion Hardening

Normative requirements. Each is testable. All terminology aligned with
`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`,
`2026-05-23-topology-discovery-loop` spec, and
`2026-04-26-impulse-activity-loop/tasks.md` Phase 27. Section
references are inline.

## R0 — Sequencing

- **R0.1** This spec is downstream of
  `2026-05-23-topology-discovery-loop` (for R1.4 amendment and §R9
  cross-reference) AND
  `2026-05-23-substrate-closure-properties` (§4 CI closure defines
  the merge-gate verdict that R4 reads). DEV MUST NOT begin until
  both prerequisite changes have their R8 / equivalent gates green.
- **R0.2** Soft dependency on
  `2026-05-23-substrate-self-deployment` (defines `gitMergePR`
  shape consumed by R4) and `2026-05-23-signal-confidence-weighting`
  (defines `signal_confidence_weight` field set by R7).

## R1 — Shape advertisement

- **R1.1** Development-vessel MUST advertise four new shapes in
  `config.discovery.shapes`: `heldOutEvalReport`,
  `adversarialProbeReport`, `ciAgreementReport`, `chainStallReport`.
- **R1.2** All four shapes are READ shapes (resolved by
  development-vessel tick activities); no `*_write` variant is
  introduced.
- **R1.3** The operator-curated artefact shapes (`heldOutEvalSet`,
  `adversarialProbeSet`) are NOT advertised via discovery — they are
  filesystem artefacts, not impulse-system shapes. They are documented
  as on-disk formats only.

## R2 — Held-out evaluation gate

- **R2.1** A `held-out-eval-tick` resolver and seed template MUST
  exist. Seed template MUST be registered and pass the dry-run seed
  test.
- **R2.2** The resolver MUST read
  `validation/held-out-eval-set/v<N>.json` (highest `<N>`) when
  present; for each goal in the file, dispatch the goal via the
  standard goal-host path and compare the canonical SHA-256 of the
  resulting output impulse to the file's `expected_output_hash`.
- **R2.3** The emitted `heldOutEvalReport` body MUST conform to design
  §A.1. `pass_rate` MUST equal `passing_goals / total_goals` when
  `total_goals > 0`, and MUST be `null` when `total_goals = 0` (paired
  with `report_unavailable: true`).
- **R2.4** When no eval-set file exists, the resolver MUST still emit
  a report with `report_unavailable: true`,
  `soft_pass_reason: "no held-out eval set curated under validation/held-out-eval-set/"`,
  and `pass_rate: null`.
- **R2.5** The eval-set file is OPERATOR-CURATED. The substrate MUST
  NOT author, modify, rotate, or delete any file under
  `validation/held-out-eval-set/`. Per R7.

## R3 — Adversarial probe gate

- **R3.1** An `adversarial-probe-tick` resolver and seed template MUST
  exist.
- **R3.2** The resolver MUST enumerate probe files under
  `validation/adversarial-probes/v<N>/<probe_id>.json` (highest
  `<N>`); for each probe, dispatch its `goal_text` as a substrate
  goal; compare the resulting trace's `failure_mode.type` (and
  `failure_mode.context.breach_type` when present) to the probe's
  `expected_failure_classification` (and `expected_breach_subtype`).
- **R3.3** A probe that completes WITHOUT invoking the expected
  failure-mode classification is a FAIL (the substrate did not detect
  the adversary). Observed `failure_mode.type === null` AND expected
  non-null is a FAIL.
- **R3.4** The emitted `adversarialProbeReport` body MUST conform to
  design §A.2.
- **R3.5** When the probe directory is absent or empty, the resolver
  MUST emit `report_unavailable: true`, `pass_rate: null`,
  `soft_pass_reason: "no adversarial probes authored under validation/adversarial-probes/"`.
- **R3.6** Probe files are OPERATOR-AUTHORED. Per R7.

## R4 — CI agreement gate

- **R4.1** A `ci-agreement-tick` resolver and seed template MUST
  exist.
- **R4.2** The resolver MUST query `activity_execution_traces` for
  traces with `output_shapes CONTAINS "gitMergePR"` within the
  `lookback_window_seconds` (default 604800). For each, the resolver
  MUST locate the paired `verify-merge-candidate` trace and the
  `ciVerdict` impulse (from `github-actions-observer-vessel` or
  equivalent).
- **R4.3** Agreement is defined per merge: both verdicts `pass` OR
  both verdicts `fail` ⇒ agree. Otherwise ⇒ disagree.
- **R4.4** `agreement_rate = agreement_count / total_merges_in_window`
  when `total_merges_in_window > 0`; otherwise `null` with
  `report_unavailable: true`.
- **R4.5** When no `ciVerdict` impulses exist for any merge in the
  window, the resolver MUST emit `report_unavailable: true`,
  `agreement_rate: null`,
  `soft_pass_reason: "github-actions-observer not advertising ciVerdict"`.
- **R4.6** The emitted `ciAgreementReport` body MUST conform to
  design §A.3.

## R5 — Probe-breadth heuristic

- **R5.1** The `priority` field on `reachableButUnlearnedReport`
  entries (per topology-discovery-loop spec R1.4) MUST compute as:
  `priority = depth_weight × depth_score + breadth_weight × breadth_score`
  where:
  - `depth_score` is the topology-discovery-loop v1 formula
    (`(# advertising vessels) / advertised_shapes.length`).
  - `breadth_score = (1 - fraction_of_signature_pool_above_floor)`
    using `posterior_confidence.floor` from
    `substrateHealthReport` (default 10).
- **R5.2** `depth_weight` and `breadth_weight` MUST be read from
  `validation/state/lift-criterion-config.json` keys
  `probe_priority_depth_weight` and `probe_priority_breadth_weight`;
  absent file → defaults 0.6 and 0.4 respectively.
- **R5.3** Both scores MUST lie in [0, 1]; the weighted sum MUST lie
  in [0, 1] (the constraint from topology-discovery-loop R1.4
  `priority ∈ [0, 1]` is preserved).
- **R5.4** Operator MAY set `breadth_weight = 0.0` to recover the
  v1 (pure-depth) formula, or `depth_weight = 0.0` for pure-breadth
  bootstrap mode.
- **R5.5** This rule supersedes topology-discovery-loop spec R1.4's
  priority heuristic in default operation. The TDL R1.4 formula
  remains the canonical v1; this rule layers refinement on top per
  the operator-tunable weights.

## R6 — Chain-stall liveness

- **R6.1** A `chain-stall-tick` resolver and seed template MUST exist.
  Default cadence: every 1800 seconds (30 min), operator-tunable.
- **R6.2** The resolver MUST query existing
  `activity_execution_traces` for traces whose `output_shapes`
  intersect the set:
  `{ activityRegistryChange, learnedTopologySnapshot,
    reachableButUnlearnedReport, unknownShapeReport,
    probe-reachable-unlearned, probe-untraversed-edge,
    escalate-unknown-shape }`
  within the lookback window. No new activity-api endpoint is
  introduced.
- **R6.3** `stall_detected` MUST equal `(observed_registry_changes <
  expected_min_registry_changes_per_window) AND
  (observed_probe_dispatches < expected_min_probe_dispatches_per_window)`.
  Defaults: both expected minima = 1 in a 30-min window.
- **R6.4** `suspected_failure_point` is BEST-EFFORT per design §B.2
  step 5; MAY be `null`. The field is a diagnostic hint, not a
  diagnosis.
- **R6.5** The emitted `chainStallReport` body MUST conform to design
  §B.1.
- **R6.6** `chainStallReport` MUST NOT credit α/β to any activity.
  Implementations MAY achieve this by setting
  `signal_confidence_weight: 0.0` on the emitting AET OR by setting
  an explicit `skip_posterior_update: true` flag on the trace
  metadata (implementation-defined).

## R7 — Trust posture for operator-curated artefacts

- **R7.1** External-anchor reports (R2, R3, R4) MUST carry
  `signal_confidence_weight = 1.0` (per
  `2026-05-23-signal-confidence-weighting`). The operator is the
  trust anchor.
- **R7.2** Substrate-self-deployment's whitelist (per
  `2026-05-23-substrate-self-deployment` §8) MUST exclude any change
  under:
  - `validation/held-out-eval-set/`
  - `validation/adversarial-probes/`
  - `validation/state/lift-criterion-config.json`
  An attempted self-deployment of a file under these paths MUST fail
  with `safety_breach.breach_type: "self_deployment_scope"`.
- **R7.3** The `restart-vessel` and `restore-from-backup` recovery
  activities (per substrate-closure §5) MUST NOT modify or restore
  files under the paths in R7.2. (Restore-from-backup MAY restore
  these paths only if the backup itself came from a trusted operator
  source — implementation-defined; safe default is to skip them.)

## R8 — Phase 27 binding

- **R8.1** IAL `2026-04-26-impulse-activity-loop/tasks.md` Phase 27.S
  MUST gain three new gates:
  - §27.S.4a: `heldOutEvalReport.pass_rate ≥ heldout_floor` (default
    0.85) on most recent emission; soft-passes when
    `report_unavailable: true`.
  - §27.S.4b: `adversarialProbeReport.pass_rate ≥ adversarial_floor`
    (default 0.80); soft-passes when `report_unavailable: true`.
  - §27.S.4c: `ciAgreementReport.agreement_rate ≥ agreement_floor`
    (default 0.95); soft-passes when `report_unavailable: true`.
- **R8.2** IAL Phase 27.3.d MUST gain §27.3.d.4: the operator MUST
  NOT write `status: "confirmed"` to
  `validation/state/lift-status.json` while
  `chainStallReport.stall_detected = true` on the most-recent
  emission. Reverting (`status: "reverted"`) is unaffected.
- **R8.3** IAL Phase 27.3.f MUST gain §27.3.f.4:
  `docs/LIFT_HANDOVER.md` documents the three external-anchor gates,
  the chain-stall constraint, and the soft-pass semantics.
- **R8.4** Soft-pass behaviour MUST emit a `liftBlocker` impulse at
  `severity: "warning"` describing the missing artefact. The
  operator's hand-over decision (§27.S.3) is the ultimate authority.

## R9 — Tests

- **R9.1** Per-resolver tests for R2, R3, R4, R6 with scripted inputs
  and expected report bodies; cover soft-pass paths.
- **R9.2** Probe-priority test (R5) with synthetic depth/breadth
  inputs; covers default mix, pure-depth (β=0), pure-breadth (α=0).
- **R9.3** Integration test: 2-goal held-out set with one pass and
  one fail produces `pass_rate: 0.5`.
- **R9.4** Integration test: empty adversarial-probes directory →
  soft-pass, `liftBlocker` warning emitted.
- **R9.5** Integration test: synthetic `gitMergePR` traces paired
  with `verify-merge-candidate` and `ciVerdict` → R4 agreement
  computation correct.
- **R9.6** Integration test: substrate idle for 31 minutes →
  `chain-stall-tick` emits `stall_detected: true`.
- **R9.7** Self-deployment scope-refusal test: attempted self-deploy
  under R7.2 paths fails with the expected `failure_mode`.
- **R9.8** Posterior-neutrality test: a `chainStallReport` emission
  with `stall_detected: true` does NOT increment α or β on the
  emitting activity.

## R10 — Acceptance gates

- **R10.1** `bun test` passes for all new suites; 0 fails.
- **R10.2** `bun run lint` clean. Four new advertised shapes; four
  new dispatch cases in development-vessel.
- **R10.3** In-container verification: each of the four tick
  activities produces an AET in activity-api with the expected
  output shape.
- **R10.4** IAL Phase 27 edits applied per R8.1, R8.2, R8.3.
- **R10.5** `docs/LIFT_HANDOVER.md` updated per R8.3 with the
  external-anchor and chain-stall sections.
