# Tasks — detect-drafter-stuck-at-llm

Ordered for the main operator development agent. Each task lists
the implementation files, acceptance criterion, and the gate it
unblocks.

## Phase A — Seed template + scan resolver (independent, ship first)

- [ ] **A.1** — Implement seed template
  `detect-drafter-stuck-at-llm` in
  `repos/development-vessel/src/seed/detect-drafter-stuck-at-llm.ts`.
  - Follows the immunity pattern verbatim (`inputShapes: []`,
    `variables: []`, single task `scan_and_emit`).
  - Header comment cites `concept_9ldsmRgqSTd5`,
    `concept_qcctOLBT5-CL` (F25 adjacency), and the immunity
    siblings the same way
    `repos/development-vessel/src/seed/detect-precondition-rejection.ts:16-25`
    and `detect-service-oom-cascade.ts:30-33` do. Document why
    the detector is structurally immune: no LLM dispatch in its
    own chain, so it cannot exhibit the bug class it detects.
  - `outputShapes: ["substrateGap", "drafterStuckAtLlmReport"]`.
  - Acceptance: file format matches the existing four canonical
    family members; `bun run lint` (which runs
    `scripts/check-shape-dispatch.ts`) is clean.
- [ ] **A.2** — Implement resolver `drafter_stuck_at_llm_scan` in
  `repos/development-vessel/src/resolvers/drafter-stuck-at-llm-scan.ts`.
  - Input: `{ window_hours?: number,
    drafter_template_ids?: string[],
    expected_min_task_count?: number, max_emits?: number,
    dry_run?: boolean }`. Defaults per the proposal.
  - Fetches recent traces via the activity-api
    `/v2/activities/execution-traces?since=…` surface (same
    `fetch` pattern as `phantom_trace_scan` and
    `precondition_rejection_scan`).
  - Filter predicate: `status=failure` AND `failure_mode=null`
    AND all recorded tasks `success=true` AND
    `tasks.length < expected_min_task_count` AND
    `last_task.resolver = "llm_completion_dispatch"` AND
    `template_id ∈ drafter_template_ids`.
  - Group by `(template_id, last_task_resolver, last_task_id)`;
    require `sample_count >= 3` per group before emitting.
  - Emit one `substrateGap` per group via `substrateGap_write`
    with the body specified in the proposal.
  - Self-immunity: exclude
    `development-vessel:detect-drafter-stuck-at-llm` and
    `development-vessel:substrate-self-audit-meta` from the
    iteration.
  - Acceptance: unit test in
    `test/resolvers/drafter-stuck-at-llm-scan.test.ts` with a
    scripted fake fetch asserting:
    (a) traces with `failure_mode != null` are skipped,
    (b) traces with all-ok tasks whose last resolver is
    `llm_completion_dispatch` and length < threshold match,
    (c) groups with `sample_count < 3` produce no gap,
    (d) the detector's own template_id is excluded,
    (e) idempotency under re-run (same window → same gaps).
- [ ] **A.3** — Three-place rule.
  - Add `drafter_stuck_at_llm_scan` to `discovery.shapes` in
    `repos/development-vessel/src/config.ts`.
  - Add the matching `case` in
    `repos/development-vessel/src/routes/impulses.ts`.
  - Add `drafterStuckAtLlmReport` as its own shape with the same
    two-place wiring.
  - Acceptance: `bun run lint` clean.
- [ ] **A.4** — Wire the template into
  `repos/development-vessel/src/seed/index.ts`. Append
  `DETECT_DRAFTER_STUCK_AT_LLM_TEMPLATE` to the `SEED_TEMPLATES`
  array following the header-comment style of the existing four
  detectors (see `src/seed/index.ts:100-106` for the most recent
  example).
- [ ] **A.5** — Per-resolver test (spec R8.1):
  `test/resolvers/drafter-stuck-at-llm-scan.test.ts` with
  scripted fake fetch + scripted trace fixtures including
  `exec_ismvwtia`-shaped and `exec_co9y5sfr`-shaped rows.
  Assert both fixtures produce the expected gap and group key.

## Phase B — Lifecycle subscription (depends on A; superseded by audit-meta when shipped)

- [ ] **B.1** — Until `2026-05-31-substrate-self-audit-meta`
  ships, subscribe `detect-drafter-stuck-at-llm` directly to
  `lifecycle:execution:succeeded` events scoped to drafter
  template_ids. Reuse the predicate pattern in
  `repos/development-vessel/src/observers/registry-change-observer.ts:260-268`.
  Debounce per `template_id` with a 5-minute window (drafter
  runs are slower than the audit-meta's 1-minute window).
  - Acceptance: integration test driving a fake drafter
    `lifecycle:execution:succeeded` event through the observer
    and asserting `drafter_stuck_at_llm_scan` dispatches at
    most once per template_id within the debounce window.
- [ ] **B.2** — Once `substrate-self-audit-meta` ships, remove
  the direct subscription from B.1 and register the detector
  in the audit-meta's fan-out list. The detector's own
  per-invocation rate-limit becomes redundant once the
  meta's global rate-limit owns the cadence.
- [ ] **B.3** — Record the transition in
  `repos/development-vessel/docs/CASES_AND_FLOWS.md` (or
  current docs home) — drafter-stuck-at-llm moves from
  direct-subscriber to meta-fan-out citizen, no semantic
  change in what it detects.

## Phase C — Concept-bridge integration (depends on A; independent of B)

- [ ] **C.1** — On `drafterStuckAtLlmReport.per_stop_point_summary`
  showing the same `(template_id, last_resolver, last_task_id)`
  recurring across ≥ 3 audit windows, mint an `extracted`
  concept of the form `drafter_stop_after_<resolver_id>` via
  the concept-bridge. Concept body cites the most recent gap
  impulse ids as evidence.
  - Acceptance: integration test simulating 3 windows with a
    matching stop-point group asserts one concept emerges
    via `concept_create_write`.
- [ ] **C.2** — Extend the drafter's pre-execution concept-query
  (the F26 concept-prior lookup already performed by
  `draft-gap-closing-activity` per
  `repos/development-vessel/src/seed/draft-gap-closing-activity.ts`)
  to include `drafter_stop_after_*` concepts in the prior set.
  The drafter's next prompt incorporates "you've stopped at
  this point N times — author downstream tasks more defensively."
  - Acceptance: drafter execution log shows the
    stuck-at-LLM priors in its prompt context when matching
    concepts exist.
- [ ] **C.3** — Concept-bridge denylist tier: the
  `drafterStuckAtLlmReport` aggregate is bridge-eligible
  (operator + concept-db should know audits ran), but the
  underlying `substrateGap` payloads it carries do **not**
  auto-promote — they already have their own bridge path via
  `substrateGap_write`. Same two-tier discipline as
  `2026-05-31-substrate-self-audit-meta/tasks.md` D.2.

## Gates

| Phase | Gates | Notes |
|---|---|---|
| A | None — ship as standalone | Detector + resolver are self-contained; family members already exist |
| B | Phase A deployed | Subscription requires the resolver + template id to exist |
| C | Phase A deployed + concept-bridge surface | Bridge integration depends on the report shape being emitted |

## Cross-references

- `concept_9ldsmRgqSTd5` — `substrate_self_detection_principle`
- `concept_qcctOLBT5-CL` — F25 phantom-success anchor (adjacent class)
- `2026-05-31-substrate-self-audit-meta/` — meta-fan-out home once shipped
- `2026-05-31-detect-resource-budget-violation/` — sibling detector
  (same immunity pattern, different axis)
- `2026-05-30-trace-to-concept-mining/` — companion unknown-arm
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` Phase E.2 —
  shared S3 push-away credit window
- IAL `tasks.md` Post-lift siblings table — register this spec
  there alongside the existing family members
