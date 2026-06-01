# Tasks — detect-merge-gate-no-rationale

Ordered for the main operator development agent. Each task lists the
implementation files, acceptance criterion, and the gate it unblocks.

## Phase A — Seed template + scan resolver (independent, ship first)

- [ ] **A.1** — Implement seed template
  `detect-merge-gate-no-rationale` in
  `repos/development-vessel/src/seed/detect-merge-gate-no-rationale.ts`.
  Immunity pattern verbatim (`inputShapes: []`, `variables: []`,
  single task `scan_and_emit`). Header cites
  `concept_9ldsmRgqSTd5`, `concept_qcctOLBT5-CL`,
  `concept_MNYEq7xc_46U` and the six motivating exec_ids.
  `outputShapes: ["substrateGap", "mergeGateNoRationaleReport"]`.
  Acceptance: format matches the four canonical family members;
  lint clean.
- [ ] **A.2** — Implement resolver
  `merge_gate_no_rationale_scan` in
  `repos/development-vessel/src/resolvers/merge-gate-no-rationale-scan.ts`.
  Input/defaults per proposal. Fetches failed traces via
  `executionTraceList`; filters to gate-class by tag `gate=true`
  or `gate_name_patterns`; classifies each failure into one of
  the four `failure_shape` values; exempts `failure_mode.type
  ∈ {budget_exhausted, user_abort}`; emits per-finding
  `substrateGap` via `substrateGap_write`; self-excludes the
  detector and `substrate-self-audit-meta`. Acceptance: unit
  tests cover (a) `null_failure_mode` (b)
  `missing_intervention_refused` (c) `missing_cited_evidence`
  (d) `f25_zero_task` (e) `budget_exhausted` exemption (f)
  self-exclusion.
- [ ] **A.3** — Three-place rule: add
  `merge_gate_no_rationale_scan` and `mergeGateNoRationaleReport`
  to `discovery.shapes` in `src/config.ts` AND matching `case`
  entries in `src/routes/impulses.ts`. Acceptance: `bun run
  lint` clean.
- [ ] **A.4** — Append `DETECT_MERGE_GATE_NO_RATIONALE_TEMPLATE`
  to `SEED_TEMPLATES` in `src/seed/index.ts` following the
  header-comment style at lines 100-106.
- [ ] **A.5** — Per-resolver test (spec R8.1):
  `test/resolvers/merge-gate-no-rationale-scan.test.ts` with
  scripted fixtures including the six cited exec_ids' shapes;
  assert idempotency.

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
  push-away credit. A gate-without-rationale refusal earns one
  S3 credit in `validation/state/lift-status.json` WHEN AND
  ONLY WHEN the same gate later emits a refusal with
  `failure_mode.context.{intervention_refused, cited_evidence}`
  populated. Acceptance: fixture sequence (opaque refusal →
  detector gap → fix → cited refusal → lift-status increment)
  walks end-to-end.
- [ ] **D.2** — Surface `merge_gate_no_rationale_24h` counts by
  `failure_shape` in the `substrate-health-tick` report.
- [ ] **D.3** — Acceptance gate: when
  `merge_gate_no_rationale_24h.total == 0` for three
  consecutive days AND ≥1 cited-rationale refusal landed in
  the same window, mark a "merge-gate-axis push-away" S3
  credit in `lift-status.json`.

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
