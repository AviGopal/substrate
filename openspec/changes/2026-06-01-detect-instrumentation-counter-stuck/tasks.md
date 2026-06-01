# Tasks — detect-instrumentation-counter-stuck

Ordered for the main operator development agent. Each task lists the
implementation files, acceptance criterion, and the gate it unblocks.

## Phase A — Seed template + scan resolver (ship first; trace-row fallback for log volume)

- [ ] **A.1** — Implement seed template
  `detect-instrumentation-counter-stuck` in
  `repos/development-vessel/src/seed/detect-instrumentation-counter-stuck.ts`.
  - Immunity pattern (`inputShapes: []`, `variables: []`,
    single task `scan_and_emit`).
  - Header cites `concept_9ldsmRgqSTd5` and
    `concept_GQOxmoGZ94z5` the way
    `repos/development-vessel/src/seed/detect-phantom-success-trace.ts:14-25`
    cites its concept. Document why the detector is
    structurally safe from the bug class it catches (its own
    emission count is verified via trace history, not the
    counter surface it scans).
  - `outputShapes: ["substrateGap",
    "instrumentationCounterStuckReport"]`.
  - Acceptance: file format matches the four canonical family
    members; lint clean (`bun run lint`).
- [ ] **A.2** — Implement resolver
  `instrumentation_counter_stuck_scan` in
  `repos/development-vessel/src/resolvers/instrumentation-counter-stuck-scan.ts`.
  - Input: `{ window_minutes?: number, min_divergence?: number,
    endpoints?: string[], max_emits?: number, dry_run?: boolean }`.
  - Defaults: `window_minutes = 30`, `min_divergence = 3`,
    `max_emits = 20`.
  - Built-in triples:
    - Activity-api templates → `thompson_alpha +
      thompson_beta` per template vs
      `activity_execution_traces` rows in window (trace-row
      fallback path, no new resolver).
    - Concept-db `/upkeep/status` →
      `activity_summary[].totalTrials` — Phase A ships a
      STUB reading counter only; emission deferred to B.
    - Discovery-vessel `/registry/stats` — same stub pattern.
  - On `divergence >= min_divergence`: emit `substrateGap`
    via `substrateGap_write` with the body specified in
    proposal §2.
  - Self-immunity: exclude
    `development-vessel:detect-instrumentation-counter-stuck`
    and `development-vessel:substrate-self-audit-meta`.
  - Aggregate report returned at task completion.
  - Acceptance: unit test with scripted (counter, trace-row)
    fixtures asserting: (a) divergence below threshold ⇒ no
    gap, (b) above threshold ⇒ gap with full evidence body,
    (c) two same-template triples ⇒ one gap not two, (d) own
    template_id excluded from iteration.
- [ ] **A.3** — Three-place rule. Add
  `instrumentation_counter_stuck_scan` to `discovery.shapes`
  in `repos/development-vessel/src/config.ts` AND matching
  `case` in `repos/development-vessel/src/routes/impulses.ts`.
  Add `instrumentationCounterStuckReport` as its own shape
  with same two-place wiring. Acceptance: `bun run lint`
  (runs `scripts/check-shape-dispatch.ts`) clean.
- [ ] **A.4** — Append
  `DETECT_INSTRUMENTATION_COUNTER_STUCK_TEMPLATE` to
  `SEED_TEMPLATES` in `src/seed/index.ts` with header comment
  matching the four family members' style.
- [ ] **A.5** — Per-resolver test (spec R8.1):
  `test/resolvers/instrumentation-counter-stuck-scan.test.ts`.
  Scripted fake fetch + scripted trace-row counts; assert
  idempotency under re-run and that stub triples post no
  gaps in Phase A.

## Phase B — vessel_logs_query resolver (depends on A)

- [ ] **B.1** — Choose path (a) or (b) from proposal
  Dependencies. Recommendation: (a) for concept-db and
  discovery-vessel triples. If non-trivial, open
  `2026-06-XX-vessel-logs-query` openspec (per-vessel
  `/logs` endpoint surface, auth scoping, result-size caps).
- [ ] **B.2** — Implement `vessel_logs_query` resolver
  (`repos/development-vessel/src/resolvers/vessel-logs-query.ts`).
  Acceptance: integration test pulling
  "Selected upkeep activity" lines from concept-db over a
  30-min window.
- [ ] **B.3** — Replace concept-db and discovery-vessel
  stubs in `instrumentation_counter_stuck_scan` (A.2) with
  real `vessel_logs_query` calls. Acceptance: regression
  test replaying the 2026-06-01 21:17–21:52Z scenario
  (counter at 0, 8 selection log lines) asserts one
  `instrumentation_counter_stuck` gap fires for the
  concept-db upkeep `totalTrials` path.
- [ ] **B.4** — Schema-drift guard: when the counter
  JSON-path is unreadable, emit
  `instrumentation_schema_drift` (separate `gap_class`)
  instead of `instrumentation_counter_stuck`. Acceptance:
  fixture test with malformed counter body asserts drift
  class fires and stuck class does not.

## Phase C — Audit-meta integration (depends on A; B optional)

- [ ] **C.1** — Once
  `2026-05-31-substrate-self-audit-meta` Phase A ships,
  add `detect-instrumentation-counter-stuck` to the
  `self_audit_fan_out` resolver's parallel dispatch list at
  `repos/development-vessel/src/resolvers/self-audit-fan-out.ts`
  alongside the four existing family members and
  `detect-resource-budget-violation`. Acceptance: existing
  audit-meta unit test extended to confirm new detector is
  dispatched and its return aggregated into
  `selfAuditReport`.
- [ ] **C.2** — Direct lifecycle subscription fallback (if
  audit-meta not yet deployed): subscribe to
  `lifecycle:execution:succeeded` in
  `registry-change-observer.ts` with
  `COUNTER_STUCK_DEBOUNCE_MS = 600_000` (10 min) so the
  detector runs periodically even without the meta-template.
  Acceptance: observer unit test asserts dispatch once per
  debounce window regardless of event frequency.

## Phase D — Expand triple catalogue (depends on A; iterative)

- [ ] **D.1** — Activity-api per-template Thompson α/β as
  a first-class triple. Acceptance: fixture with two
  templates, one advancing in line with traces and one
  stuck — only the stuck one emits a gap.
- [ ] **D.2** — `substrateGap` emission-count surface vs
  detector trace rows. Acceptance: fixture where 5 detector
  executions write 5 gaps but count surface reports 0 — gap
  emits.
- [ ] **D.3** — Per-resolver latency rollup surface vs raw
  trace `duration_ms`. Acceptance: fixture where per-task
  latencies sum to 1200ms but rollup reports 0 — gap emits.
- [ ] **D.4** — Operator review after 30 days: audit emitted
  gaps for false-positive rate; tighten `min_divergence`
  per-triple if needed (activity-api α/β drift may tolerate
  a different lag than concept-db upkeep).

## Gates

| Phase | Gates | Notes |
|---|---|---|
| A | None — ship as standalone | activity-api trace-row triple works without new infra; concept-db / discovery triples stub-only |
| B | Phase A deployed; separate `vessel_logs_query` openspec triaged | Path (a) requires per-vessel `/logs` design; (b) is structurally identical to A |
| C | Phase A deployed; audit-meta Phase A deployed | Detector becomes event-driven |
| D | Phase A or B deployed | Each new triple is independent |

## Cross-references

- `concept_9ldsmRgqSTd5` — `substrate_self_detection_principle`
- `concept_GQOxmoGZ94z5` —
  `detection_primitive_self_meta_check` (direct grounding)
- `2026-05-31-substrate-self-audit-meta/` — fan-out integration
- `2026-05-31-detect-resource-budget-violation/` — June cohort
  sibling
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` Phase
  E.2 — shared S3 push-away credit window
- `2026-04-26-security-hardening-findings/` H1 — counterparty
  signatures strengthen citation chain
- IAL `tasks.md` Post-lift siblings table — register this spec
