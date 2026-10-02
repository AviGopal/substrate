# Tasks — Intervention Tracking

Spec source: `specs/intervention-tracking/spec.md`.
Design: `design.md`.

## §1 Shape contracts and discovery advertisement

- [ ] §1.1 Define `operatorIntervention` shape per design §A.1 in
  `repos/development-vessel/src/shapes/operator-intervention.ts`.
  Advertise via development-vessel's `config.discovery.shapes`.
- [ ] §1.2 Define `interventionRefused` shape per design §A.2 in
  `repos/development-vessel/src/shapes/intervention-refused.ts`.
  Advertise.
- [ ] §1.3 Define `interventionAuditVerdict` shape per design §A.3.
  Advertise.
- [ ] §1.4 Define `interventionRateReport` shape per design §A.4.
  Advertise.
- [ ] §1.5 For each shape, add the matching `case` to
  `repos/development-vessel/src/routes/impulses.ts` per the
  three-place shape-dispatch agreement (resolver file + config +
  case). `bun run lint` MUST pass at the commit boundary.

## §2 Detection hooks in development-vessel

- [ ] §2.1 Implement `fs-watcher` detection hook per design §C.1.
  Watches `repos/`, `openspec/changes/`, `validation/state/`,
  `validation/held-out-eval-set/`, `validation/adversarial-probes/`,
  and `~/.metabob/config.json` (latter opt-out via config).
- [ ] §2.2 Implement `orchestration-log` hook per §C.2. Degraded mode
  when container-orchestration vessel absent.
- [ ] §2.3 Implement `api-origin` hook per §C.3. Reads activity-api
  request lifecycle stream; classifies origin via service-account
  JWT presence.
- [ ] §2.4 Implement `db-audit` hook per §C.4. SurrealDB audit-event
  listener (degraded when listener unavailable).
- [ ] §2.5 Implement `spec-attribution` hook per §C.5. Commit
  metadata check for `authored_by: substrate-self-deployment`
  frontmatter or known `propose-spec` execution-trace id.
- [ ] §2.6 Seed template `detect-and-emit-operator-intervention` —
  one task per hook, dispatched on the corresponding event.
- [ ] §2.7 Per-resolver test per spec §R8.1 — one test file per hook
  pinning the input event → emitted `operatorIntervention` contract.
- [ ] §2.8 Operator-tunable config file
  `validation/state/intervention-tracking-config.json` declaring
  watch paths, opt-out flags, debounce intervals. Schema documented
  in design §C.

## §3 Refusal-emission integration in existing gates

- [ ] §3.1 `verify-merge-candidate` (from
  `2026-05-23-substrate-self-deployment`) emits `interventionRefused`
  on every refusal. Add the emission call to the gate's refusal code
  path; do NOT modify the gate's existing refusal output.
- [ ] §3.2 `foundation-compliance` validator (from
  `2026-05-23-closure-replacement-suite` §B) emits on every refusal.
- [ ] §3.3 `posterior-anomaly-check` emits on every refusal. (Gate's
  spec may not yet exist; integration lands when the gate lands.)
- [ ] §3.4 `scope-narrowing` in `create-shape-provider-goal` (from
  `2026-04-26-shape-provider-goal-creation`) emits on every refusal.
- [ ] §3.5 `self-deployment-whitelist` (from
  `2026-05-23-substrate-self-deployment` §8) emits on every refusal.
- [ ] §3.6 Each integration includes a test asserting that the
  refusal triggers an `interventionRefused` emission with the
  required fields per design §D.

## §4 Audit workflow activity

- [ ] §4.1 Implement `audit-intervention-refused` activity contract
  per design §E in
  `repos/development-vessel/src/seed/audit-intervention-refused.ts`.
- [ ] §4.2 Implement `intervention-audit-verdict.ts` resolver. Reads
  the sampled `interventionRefused` impulses; dispatches via
  human-resolver for operator verdict; emits one
  `interventionAuditVerdict` per audit.
- [ ] §4.3 Per-resolver test pinning input → emitted verdict
  contract.
- [ ] §4.4 Document the operator UX contract (not the UX itself) —
  what fields the human-resolver request carries; what fields the
  human-resolver response is expected to include.

## §5 Aggregator (cron) activity

- [ ] §5.1 Implement `intervention-rate-tick` activity contract per
  design §F in
  `repos/development-vessel/src/seed/intervention-rate-tick.ts`.
- [ ] §5.2 Implement `intervention-rate-report.ts` resolver. Reads
  intervention/refused/verdict impulses in window; computes rate,
  soundness rate, trend; emits `interventionRateReport`.
- [ ] §5.3 Cross-reference adversarialProbeReport when present per
  design §F.
- [ ] §5.4 Wire cron via `cron-dispatch` (per
  `2026-05-23-closure-replacement-suite` §B). Default cadence daily,
  operator-tunable via the config file.
- [ ] §5.5 Per-resolver test pinning input traces → emitted report
  contract.
- [ ] §5.6 Soft-pass test: empty window emits `report_unavailable:
  true` without throwing.

## §6 Tests

- [ ] §6.1 Integration test: simulate one operator action per
  detection hook; assert `operatorIntervention` emission per hook.
- [ ] §6.2 Integration test: dispatch a refused merge through
  `verify-merge-candidate`; assert both the existing refusal output
  AND an `interventionRefused` impulse with correct
  `cited_evidence`.
- [ ] §6.3 Integration test: dispatch `audit-intervention-refused`
  with a fake human-resolver returning verdict `sound`; assert
  `interventionAuditVerdict` emission.
- [ ] §6.4 Integration test: dispatch `intervention-rate-tick` over
  a seeded window; assert `interventionRateReport` body matches
  expected counts and rates.
- [ ] §6.5 Cross-spec test: when `adversarialProbeReport` exists in
  the window, the rate report's
  `adversarial_exposure_index_ref` is set correctly.

## §S Acceptance gates

- [ ] §S.1 All shapes register without lint failure
  (`bun run lint` green in development-vessel).
- [ ] §S.2 All per-hook tests green (§2.7).
- [ ] §S.3 All refusal-emission integration tests green (§3.6).
- [ ] §S.4 Audit-workflow activity test green (§4.3).
- [ ] §S.5 Aggregator test green (§5.5, §5.6).
- [ ] §S.6 Integration tests green (§6.1 through §6.5).
- [ ] §S.7 First `operatorIntervention` recorded against this spec's
  own authorship (the substrate's first datum about its own corpus).
  Verified by querying for an emission with
  `target.target_type: "spec_authorship"`,
  `target.target_id` containing `"2026-05-23-intervention-tracking"`.
- [ ] §S.8 No new external dependencies. All hooks degrade gracefully
  when their data source is absent.
- [ ] §S.9 Spec authority preserved: no other spec amends the four
  shape contracts inline. Future evolution lands via
  change-supersession of this spec.
