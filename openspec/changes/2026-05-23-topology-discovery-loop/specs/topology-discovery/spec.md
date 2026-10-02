# Spec — Topology-Discovery Loop

Normative requirements. Each is testable. All terminology aligned with
`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`; section references
are inline.

## R0 — Sequencing

- **R0.1** This spec is downstream of
  `2026-05-23-single-container-substrate` AND
  `2026-05-23-harness-as-lifecycle-participant`. DEV MUST NOT begin
  until both prerequisite changes have their R8 gates green inside the
  container.
- **R0.2** All R1–R8 verification is in-container against
  `http://localhost:8080`.

## R1 — Measurement resolvers

- **R1.1** Development-vessel MUST advertise three new shapes in
  `config.discovery.shapes`:
  `learned_topology_snapshot`, `reachable_unlearned_report`,
  `unknown_shape_report`. (After this change, combined with the
  `coverageReport` shape from R4 and the `substrateHealthReport` shape
  from R9: 23 shapes / 23 dispatch cases, given 19 from the prior spec
  + 3 measurement shapes here + 1 coverage + 1 substrate-health.)
- **R1.2** `learned_topology_snapshot` resolver MUST query exclusively
  the existing endpoints listed in tasks §1.1 (discovery-vessel
  `/registry/stats`, activity-api templates + execution-traces). No new
  activity-api endpoints are introduced.
- **R1.3** The emitted `learnedTopologySnapshot` body MUST contain the
  four cells per design §D and MUST count, for each shape, the number of
  execution traces in the lookback window. The default lookback is
  604800 seconds (7 days).
- **R1.4** `reachable_unlearned_report` MUST list every shape that
  appears in `advertised_shapes` (Reachable, foundation §799) AND has
  `trace_counts[shape] === 0` over the lookback window (Unlearned). The
  `priority` field on each entry MUST be a number in [0, 1].
- **R1.5** `unknown_shape_report` MUST scan the configured sources and
  return only shape candidates that are NEITHER in the snapshot's
  `advertised_shapes` NOR producible by any registered template.

## R2 — Probe seed templates

- **R2.1** Three seed templates MUST exist:
  `development-vessel:probe-reachable-unlearned`,
  `development-vessel:probe-untraversed-edge`,
  `development-vessel:escalate-unknown-shape`.
- **R2.2** Each template MUST reuse existing primitives — improvisation
  (foundation §548), composition dispatch, and `create-shape-provider-goal`
  respectively. No new "probe" primitive is introduced. The seed templates
  select an entry from a report and dispatch the existing primitive.
- **R2.3** Each probe execution MUST set
  `trace.tags ⊇ ["intent:topology_discovery"]`. Trace consumers can
  filter on this tag to distinguish substrate-initiated probes from
  user-goal-driven runs.
- **R2.4** Each probe MUST cause an `activityRegistryChange` event on
  success — either directly (when it spawned a variant via escalation)
  or indirectly (when its trace updated coverage statistics that the
  next snapshot will observe). Implementation choice is per design §D;
  the requirement is the externally observable signal.

## R3 — Observer extension

- **R3.1** The registry-change observer from
  `2026-05-23-harness-as-lifecycle-participant` §3 MUST be EXTENDED, not
  duplicated. No second observer process.
- **R3.2** Observer dispatch table MUST honor the chain in tasks §4.1:
  - `activityRegistryChange | draft-gap-closing-activity-completion`
    → `learned-topology-snapshot`
  - `learned-topology-snapshot-completion`
    → `reachable-unlearned-report` AND `unknown-shape-report`
  - `reachable-unlearned-report-completion` with `body.total > 0`
    → `probe-reachable-unlearned`
  - `learned-topology-snapshot-completion` with
    `untraversed_edges` non-empty → `probe-untraversed-edge`
  - `unknown-shape-report-completion` with `body.total > 0`
    → `escalate-unknown-shape`
  - any of the above completion events → `coverage-tick`
    (with ≥30s debounce per chain)
  - any of the above completion events → `substrate-health-tick`
    (with ≥30s debounce per chain)
- **R3.3** Observer failures MUST be logged and swallowed; the chain
  MUST NOT block on a single failed activity dispatch.
- **R3.4** The observer MUST be testable in isolation via injected
  `runActivity` mock (extension of the prior change's test harness).

## R4 — Coverage-tick

> Naming note: earlier drafts of this spec called this rule
> "Convergence-tick" with shape `convergenceReport` and boolean
> `lift_candidate`. The names overclaimed: the report measures
> cell-count progress, not convergence in a statistical sense, and not
> lift (which is the operator hand-over decision). The rule was renamed
> during spec work. See design.md §F for the rationale and design.md §G
> for the sibling `substrateHealthReport`.

- **R4.1** A `coverage-tick` resolver and seed template MUST exist.
- **R4.2** The emitted `coverageReport` body MUST include the three
  monotonicity booleans per design §F:
  `reachable_learned_strictly_increasing`,
  `reachable_unlearned_strictly_decreasing`,
  `unknown_strictly_decreasing`.
- **R4.3** `coverage_progress` MUST be set to true if and only if all three
  monotonicity booleans are true for the most-recent N snapshots (default
  N = 3) AND `consecutive_progressing_cycles ≥ 3`.
- **R4.4** The coverage-progress definition in R4.3 is the substrate's
  measured proxy for cell-count progress toward foundation §33's
  **Convergence**. Coverage progress is necessary but not sufficient
  for lift; lift additionally requires `substrateHealthReport.health_verdict.overall_passing = true`
  per R9 and an operator-written
  `validation/state/lift-status.json`. The progression-driver's prior
  debt-bookkeeping criterion remains for debugging but is no longer
  the authoritative coverage signal.

## R5 — Tag-based trace filtering

- **R5.1** `GET /v2/activities/execution-traces?tag=intent:topology_discovery`
  MUST return all and only the topology-discovery-tagged traces. (This
  uses the existing tag filter on the execution-traces endpoint; no
  endpoint change is required.)
- **R5.2** No more than 30% of execution traces in any rolling 1-hour
  window MAY be topology-discovery-tagged. This is a soft invariant;
  exceeding it indicates the probe-firing rate has overwhelmed
  user-driven activity. The observer SHOULD enforce this via
  rate-limiting per R6 of the prior spec; if absent, this requirement
  is observational only.

## R6 — Shape contracts (immutable)

- **R6.1** The shapes `learnedTopologySnapshot`,
  `reachableButUnlearnedReport`, `unknownShapeReport`,
  `coverageReport`, and `substrateHealthReport` are defined here per
  design §D, §F, and §G. Other vessels and follow-up changes MAY
  consume these shapes; they MUST NOT redefine the body structure
  without a new openspec change.
- **R6.2** This change MUST NOT modify any existing shape's body
  structure. `activityRegistryChange` is consumed but the contract is
  unchanged from the prior spec.

## R7 — Tests

- **R7.1** Per-resolver tests cover R1.2 through R1.5 with scripted
  fetch responses.
- **R7.2** Coverage-tick test feeds 3 synthetic snapshots and asserts
  monotonicity computation per R4.3.
- **R7.2a** Substrate-health-tick test feeds synthetic
  `variant_performance_metrics`, `activity_template`,
  `composition_success`, and stratified-harness inputs and asserts
  `health_verdict.*_passing` flags compute per R9.3.
- **R7.3** Observer test extends the prior spec's harness with the
  cases listed in tasks §4.2.
- **R7.4** Dry-run seed test covers the five new templates
  automatically (probes ×3, coverage-tick, substrate-health-tick).

## R8 — Acceptance gates

- **R8.1** `bun test` passes with all new suites; ≥131 tests, 0 fails.
- **R8.2** `bun run lint` clean: 23 advertised shapes, 23 dispatch cases.
- **R8.3** In-container verification per tasks §6 produces the full
  measurement → probe → coverage chain on a non-human trigger, with
  all six topology activities plus coverage-tick plus
  substrate-health-tick producing AETs in activity-api.
- **R8.4a** At least one `coverageReport` impulse has
  `coverage_progress = true` from natural in-container substrate
  activity (no external goal injection). This is the cell-count
  progress half of the load-bearing assertion.
- **R8.4b** The most recent `substrateHealthReport` emission has
  `health_verdict.overall_passing = true` at the time R8.4a is
  evaluated. This is the substrate-health half. The two together are
  the necessary inputs to a lift hand-over; the hand-over itself is the
  operator's decision (recorded in
  `validation/state/lift-status.json`) and is out of scope for this
  spec's acceptance gates.

## R9 — Substrate-health-tick

`coverageReport` measures cell-count progress; `substrateHealthReport`
measures properties `coverageReport` does NOT — posterior confidence,
graph stability, and (when available) optimality. Both are necessary
inputs to lift; neither alone is sufficient.

- **R9.1** A `substrate-health-tick` resolver and seed template MUST
  exist. The seed template MUST be registered in `src/seed/index.ts`
  and pass the dry-run seed test.
- **R9.2** The emitted `substrateHealthReport` body MUST conform to
  the schema in design §G. All three sub-blocks
  (`posterior_confidence`, `graph_stability`, `optimality`) MUST be
  present. `optimality.most_recent_harness_run_at` and
  `optimality.mean_optimality_ratio` MUST be `null` (not absent) when
  no stratified-harness report exists in `validation/results/` in the
  lookback window.
- **R9.3** `health_verdict.confidence_passing`,
  `health_verdict.stability_passing`, and
  `health_verdict.optimality_passing` MUST compute against the default
  thresholds in design §G unless overridden by substrate
  configuration. `health_verdict.optimality_passing` MUST be `null`
  when no harness data is available. `health_verdict.overall_passing`
  MUST be `confidence_passing AND stability_passing AND
  (optimality_passing OR optimality_passing IS NULL)`.
- **R9.4** `substrate-health-tick` MUST read exclusively from existing
  activity-api endpoints (`variant_performance_metrics`,
  `context_thompson_scores`, `activity_template`,
  `composition_success`) and the local filesystem
  (`validation/results/`). No new activity-api endpoints are
  introduced.
- **R9.5** Threshold defaults declared in design §G are
  operator-tunable per substrate. The resolver MUST surface them
  through its configuration so a substrate can override
  `confidence_passing` ratio, `stability_passing` ceiling, and
  `optimality_passing` ceiling without code changes. Mechanism (env
  var vs. config file) is implementation-defined.
- **R9.6** `substrate-health-tick` MUST be testable in isolation per
  R7.2a — synthetic inputs produce expected `*_passing` flags.
