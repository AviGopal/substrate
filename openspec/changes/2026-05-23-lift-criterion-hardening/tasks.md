# Tasks — Lift-Criterion Hardening

Spec source: `specs/lift-criterion-hardening/spec.md`.
Design: `design.md`.

## §1 External-anchor shapes and activities

### §1.1 Held-out evaluation gate

- [ ] §1.1.1 Define `heldOutEvalReport` shape per design §A.1 in
  `repos/development-vessel/src/shapes/held-out-eval-report.ts`.
  Advertise via development-vessel's `config.discovery.shapes`.
- [ ] §1.1.2 Define `heldOutEvalSet` shape (operator-curated file
  format) per design §A.1; document on-disk format under
  `docs/LIFT_HANDOVER.md` (see §4.2).
- [ ] §1.1.3 Implement `held-out-eval-tick` resolver and seed template
  in `repos/development-vessel/src/seed/held-out-eval-tick.ts`. Reads
  `validation/held-out-eval-set/v<N>.json` (highest N), dispatches each
  goal via goal-host, hashes outputs canonically, compares to expected.
- [ ] §1.1.4 Soft-pass path: when no eval-set file exists, emit report
  with `report_unavailable: true`, `pass_rate: null`,
  `soft_pass_reason: "no held-out eval set curated under validation/held-out-eval-set/"`.
- [ ] §1.1.5 Wire cron via boredom-vessel's `cron-dispatch` (default
  weekly). Cadence operator-tunable via
  `validation/state/lift-criterion-config.json`.

### §1.2 Adversarial probe gate

- [ ] §1.2.1 Define `adversarialProbeReport` shape per design §A.2 in
  `repos/development-vessel/src/shapes/adversarial-probe-report.ts`.
  Advertise via development-vessel.
- [ ] §1.2.2 Define `adversarialProbeSet` shape (operator-authored
  probe-file format) per design §A.2.
- [ ] §1.2.3 Implement `adversarial-probe-tick` resolver and seed
  template. Iterates over probe files; dispatches each as a substrate
  goal; compares the resulting trace's `failure_mode.type` and
  optional `failure_mode.context.breach_type` to the probe's
  `expected_failure_classification` / `expected_breach_subtype`.
- [ ] §1.2.4 Soft-pass path: when no probe directory exists or it is
  empty, emit `report_unavailable: true`.
- [ ] §1.2.5 Wire cron (default weekly, operator-tunable).

### §1.3 CI agreement gate

- [ ] §1.3.1 Define `ciAgreementReport` shape per design §A.3.
  Advertise via development-vessel.
- [ ] §1.3.2 Implement `ci-agreement-tick` resolver and seed template.
  Queries `gitMergePR` traces in the lookback window; for each, locates
  the `verify-merge-candidate` trace and the `ciVerdict` impulse;
  computes per-merge agreement.
- [ ] §1.3.3 Soft-pass paths:
  - `total_merges_in_window == 0` → `agreement_rate: null`,
    `report_unavailable: true`,
    `soft_pass_reason: "no gitMergePR traces in window"`.
  - No `ciVerdict` impulses observed for any merge in the window →
    `report_unavailable: true`,
    `soft_pass_reason: "github-actions-observer not advertising ciVerdict"`.
- [ ] §1.3.4 Wire cron (default daily, operator-tunable).
- [ ] §1.3.5 Document the near-term `github-actions-observer-vessel`
  dependency in proposal.md (already drafted; cross-reference here).

### §1.4 Shared config & trust posture

- [ ] §1.4.1 Define `validation/state/lift-criterion-config.json`
  schema per design §A.4. Resolvers read on every tick.
- [ ] §1.4.2 Set `signal_confidence_weight = 1.0` on every external-
  anchor report's emitted AET (per
  `2026-05-23-signal-confidence-weighting`).
- [ ] §1.4.3 Substrate-self-deployment whitelist (per
  `2026-05-23-substrate-self-deployment` §8) MUST exclude any change
  under `validation/held-out-eval-set/`,
  `validation/adversarial-probes/`,
  `validation/state/lift-criterion-config.json`. File a cross-spec
  amendment ticket against the self-deployment spec to add these paths
  to its `forbidden_paths` list.
- [ ] §1.4.4 Closure-audit (per substrate-closure §27.3.j.7) extends
  its `--without=operator-authored-anchors` synthetic mode: under this
  mode, soft-pass behaviour is exercised by hiding the
  `validation/held-out-eval-set/` and `validation/adversarial-probes/`
  directories from the substrate's view.

## §2 Lifecycle liveness

- [ ] §2.1 Define `chainStallReport` shape per design §B.1 in
  `repos/development-vessel/src/shapes/chain-stall-report.ts`.
- [ ] §2.2 Implement `chain-stall-tick` resolver and seed template per
  design §B.2. Queries existing `activity_execution_traces`; no new
  activity-api endpoint introduced.
- [ ] §2.3 Wire cron (default every 30 minutes, operator-tunable via
  `chain_stall_window_seconds`).
- [ ] §2.4 `suspected_failure_point` heuristic per design §B.2 step 5.
  Document the best-effort character in the resolver implementation
  comments.
- [ ] §2.5 `chainStallReport` MUST NOT credit α/β to its emitting
  activity. Mark the resolver's trace with `signal_confidence_weight:
  0.0` OR set `applyOutcomeToPosteriors` skip flag (implementation
  choice; either satisfies the requirement).
- [ ] §2.6 `validation/scripts/progression-driver.ts` updated to
  surface `chainStallReport.stall_detected` as a WARNING line when a
  lift hand-over is being staged. Does not block; informational.

## §3 Probe-breadth refinement

- [ ] §3.1 Amend `repos/development-vessel/src/seed/reachable-unlearned-report.ts`
  (per topology-discovery-loop R1.4 implementation) to compute
  `priority` per design §C.1 — depth weighted 0.6, breadth weighted
  0.4, both operator-tunable.
- [ ] §3.2 Implement `breadth_score` query against activity-api's
  `variant_performance_metrics`. Reuses the same client path used by
  `substrate-health-tick`'s posterior-confidence query.
- [ ] §3.3 Read `probe_priority_depth_weight` and
  `probe_priority_breadth_weight` from
  `validation/state/lift-criterion-config.json`; defaults 0.6 / 0.4.
- [ ] §3.4 Update topology-discovery-loop spec via a follow-up
  in-spec note: append to TDL spec R1.4 a sentence pointing at
  lift-criterion-hardening R5 for the breadth-aware refinement. (Do
  NOT modify TDL's R1.4 in place; the v1 formula remains the
  canonical formula in TDL; this change layers on top.)
- [ ] §3.5 Per-resolver test in
  `repos/development-vessel/test/probe-priority.test.ts`: synthetic
  inputs with known depth and breadth values produce expected
  priority. Cover (α=1,β=0), (α=0,β=1), default (0.6,0.4).

## §4 IAL Phase 27 binding

Edits to `openspec/changes/2026-04-26-impulse-activity-loop/tasks.md`.

### §4.1 New §27.S items

- [ ] §4.1.1 Add §27.S.4a:
  > `heldOutEvalReport.pass_rate ≥ heldout_floor` (default 0.85) on
  > the most recent emission, OR `report_unavailable: true` with
  > `liftBlocker` impulse emitted at `severity: "warning"`
  > (soft-pass). Operator MAY require hard-pass on first lift attempt.
- [ ] §4.1.2 Add §27.S.4b:
  > `adversarialProbeReport.pass_rate ≥ adversarial_floor` (default
  > 0.80) on the most recent emission, OR `report_unavailable: true`
  > soft-pass with `liftBlocker` warning.
- [ ] §4.1.3 Add §27.S.4c:
  > `ciAgreementReport.agreement_rate ≥ agreement_floor` (default
  > 0.95) on the most recent emission, OR `report_unavailable: true`
  > soft-pass with `liftBlocker` warning. Soft-pass triggers include
  > github-actions-observer absence and zero merges in window.

### §4.2 New §27.3.d.4

- [ ] §4.2.1 Add §27.3.d.4:
  > The operator MUST NOT write `status: "confirmed"` to
  > `validation/state/lift-status.json` while
  > `chainStallReport.stall_detected = true` on the most-recent
  > emission. Writing `status: "reverted"` remains permitted (per
  > 27.2.4). The progression-driver script surfaces stall as a
  > WARNING when a lift hand-over is being staged.

### §4.3 New §27.3.f.4

- [ ] §4.3.1 Add §27.3.f.4:
  > `docs/LIFT_HANDOVER.md` enumerates the three external-anchor
  > gates (§27.S.4a/b/c) and the chain-stall constraint
  > (§27.3.d.4), including soft-pass semantics and the operator-
  > tunable thresholds under `validation/state/lift-criterion-config.json`.

### §4.4 Cross-reference notes

- [ ] §4.4.1 Update `2026-05-23-topology-discovery-loop` spec R1.4 to
  append a pointer note: "See `2026-05-23-lift-criterion-hardening`
  spec R5 for the breadth-aware priority refinement that supersedes
  this v1 formula in default operation."
- [ ] §4.4.2 Update `2026-05-23-topology-discovery-loop` spec R9 to
  append a pointer note under §R9.4: "`chainStallReport` (defined in
  `2026-05-23-lift-criterion-hardening` spec R3) provides a liveness
  signal complementary to substrateHealthReport; it informs the
  operator hand-over decision but does not affect health verdicts."

## §5 Tests

- [ ] §5.1 Per-resolver tests for each of the four new tick activities
  (held-out, adversarial, ci-agreement, chain-stall). Scripted inputs
  and expected report bodies. Cover soft-pass paths explicitly.
- [ ] §5.2 Probe-priority test per §3.5.
- [ ] §5.3 Integration test: end-to-end run inside the single-container
  substrate dispatches `held-out-eval-tick` with a 2-goal eval set;
  one goal passes, one fails; resulting `heldOutEvalReport` has
  `pass_rate: 0.5`.
- [ ] §5.4 Integration test: empty `validation/adversarial-probes/`
  directory → `adversarial-probe-tick` emits `report_unavailable:
  true`, §27.S.4b soft-passes, `liftBlocker` impulse emitted at
  warning severity.
- [ ] §5.5 Integration test: synthetic `gitMergePR` traces with
  paired `verify-merge-candidate` + `ciVerdict` impulses; assert
  `ci-agreement-tick` correctly computes `agreement_rate`.
- [ ] §5.6 Integration test: substrate idle for 31 minutes →
  `chain-stall-tick` emits `stall_detected: true`; operator
  hand-over staging surfaces stall as WARNING.
- [ ] §5.7 Substrate-self-deployment refusal test: attempted self-
  deployment of a file under `validation/held-out-eval-set/` MUST
  fail with `safety_breach.breach_type: "self_deployment_scope"`.

## §S Acceptance gates

- [ ] §S.1 All §1–§4 boxes ticked.
- [ ] §S.2 `bun test` passes inside development-vessel with all new
  suites; ≥ existing test count + new-tests-count, 0 fails.
- [ ] §S.3 `bun run lint` clean.
- [ ] §S.4 In-container verification: each of the four new tick
  activities produces an AET in activity-api with the expected output
  shape; consumed by Phase 27.S gates per §4.1.
- [ ] §S.5 Operator-curated artefacts present in the substrate at
  least once before the first lift attempt: at minimum one
  `validation/held-out-eval-set/v<N>.json` and at least one probe
  under `validation/adversarial-probes/v<N>/`. (Optional gate; the
  spec permits soft-pass.)
- [ ] §S.6 `docs/LIFT_HANDOVER.md` updated per §4.3.1.
- [ ] §S.7 IAL `2026-04-26-impulse-activity-loop/tasks.md` Phase 27
  edits applied (§4.1, §4.2, §4.3, §4.4 above) and reviewed.
