# Tasks — detect-resource-budget-violation

Ordered for the main operator development agent. Each task lists the
implementation files, acceptance criterion, and the gate it unblocks.

## Phase A — Seed template + scan resolver (independent, ship first)

- [ ] **A.1** — Implement seed template
  `detect-resource-budget-violation` in
  `repos/development-vessel/src/seed/detect-resource-budget-violation.ts`.
  - Follows the immunity pattern verbatim (`inputShapes: []`,
    `variables: []`, single task `scan_and_emit`).
  - Header comment cites `concept_9ldsmRgqSTd5` and the
    immunity-pattern siblings the same way
    `repos/development-vessel/src/seed/detect-service-oom-cascade.ts:30-33`
    does. Document why the detector is structurally safe from
    the bug class it catches (no inputShapes to pre-flight, no
    variables to seed).
  - `outputShapes: ["substrateGap", "resourceBudgetViolationReport"]`.
  - Acceptance: file format matches the existing four canonical
    family members; lint clean (`bun run lint` runs
    `scripts/check-shape-dispatch.ts`).
- [ ] **A.2** — Implement resolver `resource_budget_violation_scan`
  in `repos/development-vessel/src/resolvers/resource-budget-violation-scan.ts`.
  - Input shape: `{ window_hours?: number,
    cpu_p95_budget_ms?: number, wall_p95_budget_ms?: number,
    rss_p95_budget_mb?: number, min_sample_count?: number,
    max_emits?: number, dry_run?: boolean }`.
  - Reuses the aggregation logic from
    `repos/development-vessel/src/resolvers/load-attribution-report.ts`
    (or calls it directly) to fetch per-template aggregates.
  - Computes p95 (not just median) for cpu / wall / rss
    dimensions. Add a small `p95` helper alongside the existing
    `median` at `load-attribution-report.ts:30-38`.
  - For each template with `sample_count >= min_sample_count`
    AND any dimension exceeding budget: emit a `substrateGap`
    via `substrateGap_write` with the body specified in the
    proposal.
  - Aggregate report `resourceBudgetViolationReport` returned
    at task completion.
  - Self-immunity: exclude
    `development-vessel:detect-resource-budget-violation` and
    `development-vessel:substrate-self-audit-meta` from the
    group-by-template iteration so the detector cannot flag
    itself or its dispatcher.
  - Acceptance: unit test with a scripted load-attribution
    fixture asserting: (a) templates with `sample_count < 5`
    produce no gaps, (b) a template exceeding `cpu_p95_budget_ms`
    emits a gap with `violated_dimensions = ["cpu_ms"]`,
    (c) a template exceeding two dimensions emits a single gap
    with both in `violated_dimensions`, (d) the detector's own
    id is excluded from the iteration.
- [ ] **A.3** — Three-place rule.
  - Add `resource_budget_violation_scan` to `discovery.shapes`
    in `repos/development-vessel/src/config.ts`.
  - Add the matching `case` in
    `repos/development-vessel/src/routes/impulses.ts`.
  - Add `resourceBudgetViolationReport` as its own shape with
    the same two-place wiring.
  - Acceptance: `bun run lint` (which runs
    `scripts/check-shape-dispatch.ts`) is clean.
- [ ] **A.4** — Wire the template into `src/seed/index.ts`.
  Append `DETECT_RESOURCE_BUDGET_VIOLATION_TEMPLATE` to the
  `SEED_TEMPLATES` array following the header-comment style of
  the existing four detectors (see
  `repos/development-vessel/src/seed/index.ts:100-106` for the
  most recent example).
- [ ] **A.5** — Per-resolver test (spec R8.1):
  `test/resolvers/resource-budget-violation-scan.test.ts`.
  Scripted fake load-attribution data; assert idempotency
  under re-run.

## Phase B — Per-template budget overrides via discovery metadata (depends on A)

- [ ] **B.1** — Document the
  `resolver_contract.resource_budget` extension in
  `repos/discovery-vessel/docs/RESOLVER_CONTRACT.md` (or
  `repos/discovery-vessel/README.md` if no dedicated docs file
  exists yet). No code change in discovery-vessel — the field
  is arbitrary JSON.
- [ ] **B.2** — Extend `resource_budget_violation_scan` (A.2)
  to query discovery-vessel for each template_id under
  consideration and read `resolver_contract.resource_budget` if
  present. Per-template budgets win over defaults.
  - Implementation: one `fetch` to
    `${DISCOVERY_VESSEL_ENDPOINT}/resolve` per template-batch
    (cached for the scan duration).
  - Acceptance: unit test with one template carrying a discovery
    override of `cpu_p95_budget_ms = 1000` asserting that
    the smaller budget triggers a gap on data that the default
    `5000` would not flag.
- [ ] **B.3** — Documentation: add an example
  `resource_budget` block to the
  `repos/discovery-vessel/docs/RESOLVER_CONTRACT.md` example
  registration showing how operators set per-template overrides.

## Phase C — Coupling with the load-aware gate (depends on A)

- [ ] **C.1** — Modify the load-aware gate from super-repo
  `04441ca9` (boredom-vessel) to query activity-api for the most
  recent `resource_budget_violation` `substrateGap` per
  `template_id` before refusing. If found, include the gap
  impulse id in the refusal record's
  `failure_mode.context.cited_evidence` array.
  - Acceptance: integration test asserting a refusal record
    whose `cited_evidence` references a gap impulse id whose
    body matches the template the refusal targeted.
- [ ] **C.2** — Mutual `concept_link` edges: on emission of a
  `resource_budget_violation` gap, create an edge to the most
  recent refusal record for the same template_id if one
  exists; on emission of a refusal that cites a gap, create
  the inverse edge. Both edges use a new `edge_type:
  "cites_evidence"`.
  - Acceptance: walk the chain
    `(refusal → gap → attribution_report → record)` from an
    integration-test refusal and assert every hop resolves.
- [ ] **C.3** — Documentation note in
  `repos/development-vessel/docs/CASES_AND_FLOWS.md` (or the
  current docs home) describing the citation chain and how
  operators audit it.

## Phase D — Push-away credit accounting (depends on C)

- [ ] **D.1** — Each refusal whose `cited_evidence` includes a
  `resource_budget_violation` gap counts as one S3 push-away
  credit per IAL §27.S.6's sustained-push-away-window
  measurement. Record evidence into
  `validation/state/lift-status.json` as a sub-criterion of
  S3-readiness ("substrate refuses operator-style interventions
  with cited family-emitted evidence").
- [ ] **D.2** — Surface push-away credits in the
  `substrate-health-tick` report: include a
  `resource_budget_violation_refusals_24h` field with the count
  of refusals whose `cited_evidence` referenced a
  `resource_budget_violation` gap within the trailing 24h.
  Operator reads this as the leading indicator of S3 readiness
  on the load axis.
- [ ] **D.3** — Acceptance gate: when
  `resource_budget_violation_refusals_24h >= 3` for three
  consecutive observation days AND no operator override
  reversed any of those refusals, mark a "load-axis push-away"
  S3 credit in `lift-status.json`. This is one credit toward
  the sustained window; not a gate on its own.

## Gates

| Phase | Gates | Notes |
|---|---|---|
| A | Load-attribution stack shipped (super-repo `04441ca9` and prior) | All measurement infrastructure already exists |
| B | Phase A deployed | Per-template overrides need the detector to exist first |
| C | Phase A deployed + load-aware gate from `04441ca9` | Cross-vessel coordination between boredom-vessel and dev-vessel |
| D | Phase C deployed | Push-away credit requires the citation chain to walk |

## Cross-references

- `concept_9ldsmRgqSTd5` — `substrate_self_detection_principle`
- `2026-05-31-substrate-self-audit-meta/` — companion: fans this
  detector out alongside the other four family members
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` Phase E.2 —
  shared S3 push-away credit window
- `2026-05-31-display-failure-mode-extensions/` — the
  `budget_exhausted.budget_type = "display"` extension covers
  the failure-mode-side complement to this detector
- `2026-04-26-security-hardening-findings/` H1 — counterparty
  signatures strengthen the citation chain; until H1 ships, the
  chain is structurally complete but advisory
- IAL `tasks.md` Post-lift siblings table — this spec is
  registered there alongside the companion
