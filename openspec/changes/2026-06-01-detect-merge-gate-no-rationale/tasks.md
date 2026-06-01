# Tasks — detect-merge-gate-no-rationale

Ordered for the main operator development agent. Each task lists the
implementation files, acceptance criterion, and the gate it unblocks.

## Phase A — Seed template + scan resolver (independent, ship first)

- [ ] **A.1** — Implement seed template
  `detect-merge-gate-no-rationale` in
  `repos/development-vessel/src/seed/detect-merge-gate-no-rationale.ts`.
  - Immunity pattern verbatim: `inputShapes: []`, `variables: []`,
    single task `scan_and_emit`, deterministic resolver.
  - Header comment cites `concept_9ldsmRgqSTd5`,
    `concept_qcctOLBT5-CL`, `concept_MNYEq7xc_46U` and explains
    why the detector is structurally safe from the bug class it
    catches (no inputShapes, no variables, no multi-task chain —
    so it cannot produce a `null_failure_mode` or `f25_zero_task`
    failure of its own).
  - `outputShapes: ["substrateGap", "mergeGateNoRationaleReport"]`.
  - Cites exec_ids in the description: `exec_bdi43hzm`,
    `exec_meur43e0`, `exec_hpw8n07m`, `exec_q4xlw1vd`,
    `exec_imbmjn3f`, `exec_u7xeinm9` as the empirical motivation
    fixture so the seed itself is auditable.
  - Acceptance: file format matches the existing four canonical
    family members; lint clean (`bun run lint` runs
    `scripts/check-shape-dispatch.ts`).
- [ ] **A.2** — Implement resolver
  `merge_gate_no_rationale_scan` in
  `repos/development-vessel/src/resolvers/merge-gate-no-rationale-scan.ts`.
  - Input shape: `{ window_hours?: number,
    gate_name_patterns?: string[], min_duration_ms?: number,
    max_emits?: number, dry_run?: boolean }`.
  - Defaults: `window_hours = 24`,
    `gate_name_patterns = ["evaluate-pr-*", "*-gate",
    "verify-iteration-by-*"]`, `max_emits = 50`.
  - Fetches recent failed traces via the same activity-api
    `executionTraceList` fetch pattern
    `detect-phantom-success-trace` uses.
  - Filters to gate-class templates by metadata `tags`
    containing `gate=true` first; falls back to
    `gate_name_patterns` glob match on `template_name`.
  - For each gate-class failed trace classifies into one of:
    `null_failure_mode`, `missing_intervention_refused`,
    `missing_cited_evidence`, `f25_zero_task`. Exempts
    `failure_mode.type ∈ {"budget_exhausted", "user_abort"}`
    from the cited-evidence requirement.
  - Emits a `substrateGap` per finding via `substrateGap_write`
    with the body specified in the proposal.
  - Self-immunity: excludes
    `development-vessel:detect-merge-gate-no-rationale` and
    `development-vessel:substrate-self-audit-meta` from
    iteration.
  - Acceptance: unit tests with mocked traces for each
    `failure_shape` variant. (a) `failure_mode: null` trace
    → `null_failure_mode` gap. (b) `failure_mode.context = {}`
    → `missing_intervention_refused`. (c) context with
    `intervention_refused: true` but no `cited_evidence`
    → `missing_cited_evidence`. (d) `task_count: 0` trace
    → `f25_zero_task`. (e) `failure_mode.type:
    "budget_exhausted"` → no gap (exemption).
    (f) detector's own template_id is excluded.
- [ ] **A.3** — Three-place rule.
  - Add `merge_gate_no_rationale_scan` to `discovery.shapes` in
    `repos/development-vessel/src/config.ts`.
  - Add the matching `case` in
    `repos/development-vessel/src/routes/impulses.ts`.
  - Add `mergeGateNoRationaleReport` as its own shape with the
    same two-place wiring.
  - Acceptance: `bun run lint` clean.
- [ ] **A.4** — Wire the template into `src/seed/index.ts`.
  Append `DETECT_MERGE_GATE_NO_RATIONALE_TEMPLATE` to
  `SEED_TEMPLATES` following the header-comment style at lines
  100-106 (most recent family-member entry).
- [ ] **A.5** — Per-resolver test (spec R8.1):
  `test/resolvers/merge-gate-no-rationale-scan.test.ts`.
  Scripted fake `executionTraceList` fixture including the six
  cited exec_ids' trace shapes; assert idempotency under re-run.

## Phase B — Audit-meta fan-out integration (depends on A + companion ship)

- [ ] **B.1** — Once `2026-05-31-substrate-self-audit-meta`
  ships, append `development-vessel:detect-merge-gate-no-rationale`
  to the canonical fan-out list in
  `repos/development-vessel/src/resolvers/self-audit-fan-out.ts`.
  - Acceptance: integration test asserting the
    `selfAuditReport.family_members_dispatched` array contains
    the merge-gate detector and any gaps it emits are re-emitted
    at the meta-execution's `output_impulse_ids`.
- [ ] **B.2** — Self-exclusion: the meta-template's
  `template_id` and this detector's `template_id` are excluded
  from the merge-gate-no-rationale scan's group-by iteration
  (extending A.2's exclusion list). Prevents meta-recursion if
  the meta-template ever fails opaquely.
  - Acceptance: unit test asserting that a fixture trace whose
    `template_id == "development-vessel:substrate-self-audit-meta"`
    with `failure_mode: null` produces no gap.

## Phase C — `gate=true` metadata tag convention (independent of B)

- [ ] **C.1** — Document the `gate=true` tag convention in
  `repos/development-vessel/docs/CASES_AND_FLOWS.md` (or current
  docs home). Define: a gate-class template is one whose
  refusal must carry
  `failure_mode.context.{intervention_refused, cited_evidence}`.
  Tag with `"gate"` in the `tags` array.
- [ ] **C.2** — Add the `gate` tag to `evaluate-pr-via-internal-idioms.ts`
  (`tags` array at lines 38-43) and any other gate-class seeds.
  This is a per-seed edit, no schema change.
- [ ] **C.3** — Extend `merge_gate_no_rationale_scan` to emit
  a second gap class `gate_missing_tag` for any template whose
  name matches `gate_name_patterns` but whose `tags` array does
  NOT contain `"gate"`. The convention becomes self-policing:
  the detector that reads the tag also reports templates that
  should-but-don't carry it.
  - Acceptance: unit test asserting a fixture template with a
    matching name but no `gate` tag produces a
    `gate_missing_tag` gap.

## Phase D — Push-away credit hook (depends on B + C)

- [ ] **D.1** — Couple emissions with
  `2026-05-30-vessel-binary-redeploy-on-source-drift` Phase E.2
  push-away credit accounting. Each gate-without-rationale
  refusal cited as evidence in
  `validation/state/lift-status.json` WHEN AND ONLY WHEN the
  same gate later emits a trace with full
  `failure_mode.context.{intervention_refused, cited_evidence}`
  populated for the same template family. The pre-fix refusal
  is observability bankruptcy; the post-fix refusal closes the
  loop and earns the credit.
  - Acceptance: integration test asserting that a fixture
    sequence (gate fails opaquely → detector emits gap → gate
    fixed → gate fails with cited rationale → lift-status.json
    increments a sub-criterion under S3-load-axis-push-away)
    walks the full chain.
- [ ] **D.2** — Surface in `substrate-health-tick` report a
  `merge_gate_no_rationale_24h` field with counts by
  `failure_shape`. Operator reads this as the leading
  indicator of merge-gate rationale hygiene.
- [ ] **D.3** — Acceptance gate: when
  `merge_gate_no_rationale_24h.total == 0` for three consecutive
  observation days AND at least one gate refusal WITH cited
  evidence landed in the same window, mark a
  "merge-gate-axis push-away" S3 credit in `lift-status.json`.
  One credit toward the sustained window; not a gate on its own.

## Gates

| Phase | Gates | Notes |
|---|---|---|
| A | None — ship as standalone | Closes the rationale-absence detector gap; resolves directly off existing executionTraceList |
| B | Phase A deployed + `2026-05-31-substrate-self-audit-meta` shipped | Fan-out join requires the meta-template to exist |
| C | Phase A deployed | Tag convention is detector-readable once A ships |
| D | Phase B + Phase C deployed | Push-away credit requires both lifecycle-driven dispatch and the tag convention |

## Cross-references

- `concept_9ldsmRgqSTd5` — `substrate_self_detection_principle`
- `concept_qcctOLBT5-CL` — F25 phantom-success signature
- `concept_MNYEq7xc_46U` — F25 architectural asymmetry
- `2026-05-31-substrate-self-audit-meta/` — companion: fans this
  detector out alongside the other family members
- `2026-05-31-detect-resource-budget-violation/` — sibling family
  member; same Phase A/B/C/D shape
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` Phase E.2
  — shared S3 push-away credit window
- `2026-05-31-display-failure-mode-extensions/` — defines the
  `failure_mode.context` schema fields the detector reads
- IAL `tasks.md` Post-lift siblings table — register this spec
  alongside the companions
