# Tasks — detect-gap-queue-stalled

Ordered for the main operator development agent. Each task lists the
implementation files, acceptance criterion, and the gate it unblocks.

## Phase A — Seed template + scan resolver (independent, ship first)

- [ ] **A.1** — Implement seed template `detect-gap-queue-stalled`
  in `repos/development-vessel/src/seed/detect-gap-queue-stalled.ts`.
  - Follows the immunity pattern verbatim: `inputShapes: []`,
    `variables: []`, single task `scan_and_emit`. Mirrors
    `repos/development-vessel/src/seed/detect-precondition-rejection.ts:36-77`
    structurally.
  - Header comment cites `concept_9ldsmRgqSTd5` and the four
    immunity-pattern siblings (phantom-success,
    precondition-rejection, dispatch-target-drift, OOM-cascade)
    the same way they cite each other. Document why this
    detector is structurally safe from its own bug class
    (it emits at most one substrateGap per window per drain
    template_id, and self-excludes from the tally — so a stalled
    queue does not amplify its own signal).
  - `outputShapes: ["substrateGap", "gapQueueStalledReport"]`.
  - Tags: `["lift.autonomous.loop", "substrate.self.detection",
    "queue.stall.detection"]`.
  - Acceptance: file format matches the existing four canonical
    family members; lint clean (`bun run lint` runs
    `scripts/check-shape-dispatch.ts`).
- [ ] **A.2** — Implement resolver `gap_queue_stalled_scan` in
  `repos/development-vessel/src/resolvers/gap-queue-stalled-scan.ts`.
  - Input shape: `{ window_hours?: number,
    min_gap_emission_count?: number, min_queue_lag?: number,
    drain_template_id?: string, dry_run?: boolean }`.
  - Defaults: `window_hours = 4`, `min_gap_emission_count = 5`,
    `min_queue_lag = 3`, `drain_template_id =
    "development-vessel:drain-pending-substrate-gaps"`.
  - Reads two streams: `substrateGap` impulses (open + closed)
    in window, and `executionTraceList` filtered by
    `activity_template_id == drain_template_id` in window.
  - Computes `gap_emission_count`, `drain_success_count`,
    `drain_failure_count`, `queue_lag`, `oldest_gap_age_min`
    per the proposal §2.
  - Stall predicate per proposal §2.
  - On stall: emit one `substrateGap` (via `substrateGap_write`)
    with `classification_metadata.gap_class = "gap_queue_stalled"`
    and the body specified in the proposal. Returns the aggregate
    `gapQueueStalledReport`.
  - Self-exclusion: filters `template_id ==
    "development-vessel:detect-gap-queue-stalled"` out of the
    `gap_emission_count` tally before evaluating the predicate.
  - Per-window rate-limit: ≤1 emission per
    `(window_hours / 2)` per `drain_template_id` — read the most
    recent prior `gap_queue_stalled` substrateGap and short-circuit
    if its `updated_at` falls within the rate-limit window.
  - Acceptance: per-resolver test (spec R8.1) at
    `test/resolvers/gap-queue-stalled-scan.test.ts` with scripted
    fixtures asserting:
    (a) healthy queue (drain_success_count > 0) → no gap emitted;
    (b) stalled queue with `gap_emission_count = 6`,
        `drain_success_count = 0`, `queue_lag = 4` → one gap
        emitted with `violated` evidence populated;
    (c) the detector's own emissions are excluded from
        `gap_emission_count`;
    (d) rate-limit short-circuit fires when a prior
        `gap_queue_stalled` gap exists within window/2;
    (e) idempotent under re-run (same inputs, same emission set).
- [ ] **A.3** — Three-place rule registration:
  - Add `gap_queue_stalled_scan` to `discovery.shapes` in
    `repos/development-vessel/src/config.ts`.
  - Add the matching `case` in
    `repos/development-vessel/src/routes/impulses.ts`.
  - Add `gapQueueStalledReport` as its own shape with the same
    two-place wiring.
  - Acceptance: `bun run lint` (which runs
    `scripts/check-shape-dispatch.ts`) is clean.
- [ ] **A.4** — Wire template into `SEED_TEMPLATES`.
  Append `DETECT_GAP_QUEUE_STALLED_TEMPLATE` to the
  `SEED_TEMPLATES` array in
  `repos/development-vessel/src/seed/index.ts` following the
  header-comment style of the existing four detectors. Run
  `bun run cli seed-templates` against local substrate; assert
  the template appears in activity-api.

## Phase B — Audit-meta fan-out OR lifecycle subscription (depends on A)

- [ ] **B.1** — If `2026-05-31-substrate-self-audit-meta` has shipped
  by Phase A completion: add
  `development-vessel:detect-gap-queue-stalled` to the
  `family_members_dispatched` list in
  `repos/development-vessel/src/resolvers/self-audit-fan-out.ts`.
  Acceptance: integration test asserts the meta's `selfAuditReport`
  includes this detector's per-execution entry.
- [ ] **B.2** — If audit-meta has not shipped: subscribe the
  detector directly to `lifecycle:execution:succeeded` events for
  the drain template specifically. Add a `shouldRescore`-style
  predicate in
  `repos/development-vessel/src/observers/registry-change-observer.ts`
  that fires on `activity_template_id ==
  "development-vessel:drain-pending-substrate-gaps"`, debounced
  to ≤1 fire per `window_hours / 2` per drain template id.
  Acceptance: unit test against a scripted lifecycle event stream
  asserts exactly one detector dispatch per debounce window.
- [ ] **B.3** — Self-exclusion guard at the observer layer: this
  detector's own `lifecycle:execution:succeeded` must NOT
  re-trigger itself. Add an explicit `template_id` self-skip in
  whichever path (B.1 or B.2) ships. Acceptance: a scripted
  succession of two detector executions does not yield a third.

## Phase C — Report + concept mint (depends on A)

- [ ] **C.1** — Emit a structured `gapQueueStalledReport` impulse
  on every detector run (stall or not), carrying cited
  `trace_ids`, `queue_size`, and an age-distribution histogram
  (`{ p25, p50, p75, p95 }` minutes since open). Operator reads
  this as the canonical queue-health snapshot.
  - Acceptance: report impulse appears in
    `output_impulse_ids[]` of every detector trace; histogram
    populated even when `stall_detected = false`.
- [ ] **C.2** — On the first stall emission, mint a
  `concept_create_write` for the stall pattern with body
  `{ name: "gap_queue_stalled_pattern", gap_class:
  "gap_queue_stalled", drain_template_id, sample_evidence:
  trace_ids[] }`. Subsequent stall emissions link to the existing
  concept rather than re-minting (idempotent by `name`).
  - Acceptance: integration test asserts (a) first stall produces
    exactly one new concept; (b) second stall produces zero new
    concepts and one `concept_link` edge to the first.
- [ ] **C.3** — Update
  `feedback_substrate_gap_consumer_unwired.md` (substrate-side
  memoryNote — or operator-side cache if bridge-path applies) to
  reference the detector's first emission, closing the loop
  between human-language memory and substrate-emitted evidence.
  - Acceptance: the note's body cites at least one detector
    trace_id and the minted concept id.

## Gates

| Phase | Gates | Notes |
|---|---|---|
| A | `substrateGap` resolver + `substrateGap_write` shipped (already done) | All measurement infrastructure already exists |
| B | Phase A deployed; one of (audit-meta shipped) OR (lifecycle observer extensible) | B.1 and B.2 are mutually exclusive paths |
| C | Phase A deployed | C is independent of B; report + concept work on any dispatch path |

## Cross-references

- `concept_9ldsmRgqSTd5` — `substrate_self_detection_principle`
- `concept_qcctOLBT5-CL` — F25 (precondition-rejection) — the
  per-trace bug whose queue-aggregated form this detector catches
- `2026-05-31-substrate-self-audit-meta/` — fan-out destination
  once shipped
- `2026-05-31-detect-resource-budget-violation/` — sibling fifth
  family member in this same wave
- `2026-05-30-trace-to-concept-mining/` — complementary
  unknown-discovery arm
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` Phase E.2 —
  shared S3 push-away credit window
- IAL `tasks.md` Post-lift siblings table — register this spec
  alongside the other family members
