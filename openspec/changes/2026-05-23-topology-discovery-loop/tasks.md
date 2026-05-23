# Tasks — Topology-Discovery Loop

VERIFY → DEBUG → SPEC (this doc + proposal + design + spec) → DEV.

All work in `repos/development-vessel/`. Shape-dispatch lint + per-resolver
tests + dry-run seed test remain green at every commit boundary.

## §0 Prerequisite gates

- [ ] 0.1 `2026-05-23-single-container-substrate` Phase 1 + Phase 6 green.
- [ ] 0.2 `2026-05-23-harness-as-lifecycle-participant` R8 acceptance gates
  green inside the container. In particular: the observer pattern from
  R3.x exists and is verified to fire `harness-run-matrix` on
  `lifecycle:execution:succeeded` of `draft-gap-closing-activity`.
- [ ] 0.3 `coverage-tick` (cell-count progress) and
  `substrate-health-tick` (posterior confidence, graph stability,
  optimality) are the two measurement sources that feed the lift
  hand-over decision. Lift itself is the operator decision recorded
  in `validation/state/lift-status.json`. The bookkeeping
  progression-driver remains running for debug only.

## §1 Measurement resolvers (read-only against existing endpoints)

Each resolver dispatches one query path. No new activity-api endpoints
are added; existing ones are reused.

- [ ] 1.1 `src/resolvers/learned-topology-snapshot.ts` — pointer shape
  `{ type: "learned_topology_snapshot", lookback_window_seconds?: number }`.
  Implementation: fan-out queries against
  - `GET {DISCOVERY_ENDPOINT}/registry/stats` for advertised shapes per
    vessel,
  - `GET {METABOB_ENDPOINT}/v2/activities/templates` for the template
    set,
  - `GET {METABOB_ENDPOINT}/v2/activities/execution-traces?since=...`
    paginated for trace counts.
  Aggregate into `learnedTopologySnapshot` body per design §D.
  Composition-edge derivation: pair `producing_template.output_shapes`
  with `consuming_template.input_shapes` to enumerate all `(A, S, B)`
  edges; mark each as untraversed iff no AET shows A executed and B
  executed with at least one impulse of shape S flowing between them.
  (v1 simplification: traversal = both endpoints have ≥1 trace AND the
  intermediate shape appears in at least one of A's traces' output_shapes
  within 60s of B's traces' input_shapes. False negatives acceptable.)

- [ ] 1.2 `src/resolvers/reachable-unlearned-report.ts` — pointer shape
  `{ type: "reachable_unlearned_report", snapshot_path?: string,
  snapshot_impulse_id?: string }`. Consumes a `learnedTopologySnapshot`
  either from disk or via `GET /v2/impulses/{id}`. Emits a
  `reachableButUnlearnedReport` per design §D. Priority heuristic from
  design §D (v1 form).

- [ ] 1.3 `src/resolvers/unknown-shape-report.ts` — pointer shape
  `{ type: "unknown_shape_report", goal_text_glob?: string,
  proposals_dir?: string, scenarios_dir?: string }`. Scans the named
  sources for shape-name candidates (regex over CamelCase tokens; cross-
  check against `learnedTopologySnapshot.advertised_shapes`). Emits
  `unknownShapeReport`.

- [ ] 1.4 Per-resolver tests (`test/resolvers/*.test.ts`) — scripted
  fetch with fixture responses. Each test asserts shape contract, not
  implementation detail.

- [ ] 1.5 Wire shape + dispatch: `config.discovery.shapes` += three new
  measurement shapes, `routes/impulses.ts` += three cases. Combined
  with §3a.4 (which adds `coverageReport` + `substrateHealthReport`),
  `bun run lint` reports 23 shapes / 23 dispatch cases (current 19 +
  3 measurement + 1 coverage + 1 substrate-health).

## §2 Probe activities (re-use existing dispatch primitives)

Each probe is a seed template with ONE task that wraps an existing
mechanism. No new resolvers required.

- [ ] 2.1 `src/seed/probe-reachable-unlearned.ts` —
  `development-vessel:probe-reachable-unlearned`. Two-task template:
  1. `fs_read` (or impulse fetch) of the most recent
     `reachableButUnlearnedReport`.
  2. `activity_recommend` against the synthetic goal text
     `"produce shape <X>"` where `<X>` is the highest-priority entry from
     task 1. Trace is tagged `intent: "topology_discovery"`.
  (The actual "execute the recommended activity" step uses the standard
  recommendation→execution path that already exists in the dev-vessel
  CLI. The seed template does the recommend; firing the recommendation
  is downstream of this template's completion via existing pathways.)

- [ ] 2.2 `src/seed/probe-untraversed-edge.ts` —
  `development-vessel:probe-untraversed-edge`. Pulls `untraversed_edges`
  from the snapshot and dispatches a composition by chaining the two
  template ids via the standard dispatch path. (Same caveat as 2.1: the
  composition execution itself is the existing path; this template
  selects and tags.)

- [ ] 2.3 `src/seed/escalate-unknown-shape.ts` —
  `development-vessel:escalate-unknown-shape`. Single task: dispatch
  `create-shape-provider-goal` (the existing primitive — see
  `repos/minibob/src/embedded-templates/create-shape-provider-goal.ts`)
  via `activity_fetch` + recommend chain. Argument: one shape from
  `unknownShapeReport`.

- [ ] 2.4 Register all three in `src/seed/index.ts`. Dry-run seed test
  extends automatically.

## §3 Coverage-tick

> Renamed from "Convergence-tick" during spec work. The aggregator
> measures cell-count progress in the 4-cell table, not convergence in
> a statistical sense and not lift. See design.md §F for the rename
> rationale.

- [ ] 3.1 `src/resolvers/coverage-tick.ts` — pointer shape
  `{ type: "coverage_tick", lookback_cycles?: number }`. Pulls the N
  most recent `learnedTopologySnapshot` impulses from activity-api and
  computes monotonicity per design §F.

- [ ] 3.2 `src/seed/coverage-tick.ts` — wraps the resolver.

- [ ] 3.3 Per-resolver test asserting monotonicity computation: feed
  three synthetic snapshots, assert `coverage_progress` is true when
  all three monotonic and false otherwise.

## §3a Substrate-health-tick

Sibling aggregator to coverage-tick. Measures the properties
coverage-tick does NOT — posterior confidence, graph stability, and
(when available) optimality — per design §G.

- [ ] 3a.1 `src/resolvers/substrate-health-tick.ts` — pointer shape
  `{ type: "substrate_health_tick", lookback_window_seconds?: number }`.
  Queries `variant_performance_metrics` and `context_thompson_scores`
  for posterior confidence; queries `activity_template` and
  `composition_success` for graph stability over the lookback window;
  reads the most recent stratified-harness report from
  `validation/results/` for optimality (nullable). Emits a
  `substrateHealthReport` per design §G.

- [ ] 3a.2 `src/seed/substrate-health-tick.ts` — wraps the resolver.

- [ ] 3a.3 Per-resolver test feeds synthetic
  `variant_performance_metrics`, template-count deltas, edge-count
  deltas, and harness inputs. Asserts each `*_passing` boolean
  computes per the default thresholds in design §G, and asserts
  `optimality_passing` is `null` when no harness data is supplied.

- [ ] 3a.4 Wire shape + dispatch: `config.discovery.shapes` += two new
  shapes (`coverageReport`, `substrateHealthReport`),
  `routes/impulses.ts` += two cases (`coverage_tick`,
  `substrate_health_tick`). Combined with §1.5: `bun run lint` reports
  23 shapes / 23 dispatch cases (current 19 + 3 measurement + 1
  coverage + 1 substrate-health).

## §4 Observer extension

Extend the lifecycle observer from
`2026-05-23-harness-as-lifecycle-participant` §3 — do NOT create a
parallel observer.

- [ ] 4.1 Extend `shouldRescore` predicate in
  `src/observers/registry-change-observer.ts` to dispatch the topology
  chain on the relevant events:
  ```
  activityRegistryChange OR draft-gap-closing-activity completion
    → learned-topology-snapshot

  learned-topology-snapshot completion
    → reachable-unlearned-report AND unknown-shape-report (parallel)

  reachable-unlearned-report completion (total > 0)
    → probe-reachable-unlearned

  learned-topology-snapshot completion (untraversed_edges non-empty)
    → probe-untraversed-edge

  unknown-shape-report completion (total > 0)
    → escalate-unknown-shape

  any of the above completion
    → coverage-tick (debounced ≥30s)
    → substrate-health-tick (debounced ≥30s)
  ```
- [ ] 4.2 Observer test extends `test/observers/registry-change-observer.test.ts`:
  - synthetic `learnedTopologySnapshot` event with non-empty
    `untraversed_edges` → both `reachable-unlearned-report` and
    `probe-untraversed-edge` get dispatched.
  - empty report bodies → no probe firing.
  - 30s debounce on `coverage-tick`.
  - 30s debounce on `substrate-health-tick`.

## §5 Trace tagging

- [ ] 5.1 Each of the six topology activities populates
  `trace.tags = ["intent:topology_discovery", "phase:<measure|probe>"]`
  via the existing trace-sink path (dev-vessel's trace writer; no
  activity-api change required).
- [ ] 5.2 Verification: `GET /v2/activities/execution-traces?tag=intent:topology_discovery`
  returns ≥1 row after one full loop cycle has run inside the container.

## §6 In-container verification (per R0)

- [ ] 6.1 Inside the substrate container, seed all six templates via
  `bun run cli seed-templates`. Verify by `activity_fetch` on each id.

- [ ] 6.2 Manually trigger one `learned-topology-snapshot` run. Confirm
  the AET appears in activity-api with `output_shapes: ["learnedTopologySnapshot"]`.

- [ ] 6.3 Observer-driven cascade: trigger ONE `draft-gap-closing-activity`
  run. Confirm via `journalctl` that the chain
  snapshot → report × 2 → probe × N → coverage-tick AND
  substrate-health-tick all fire within 5 minutes WITHOUT human
  invocation.

- [ ] 6.4 Inspect three consecutive `coverageReport` impulses
  produced over an hour. Confirm:
  - reachable_learned strictly increases (or holds at steady-state if
    no advertised shapes are Reachable+Unlearned), AND
  - reachable_unlearned strictly decreases (or holds at 0).
  When all three monotonic conditions hold for three reports, the
  `coverage_progress` field flips to true.

- [ ] 6.5 Inspect the most recent `substrateHealthReport` emission
  produced during the same window. Confirm
  `health_verdict.overall_passing = true` (or document which
  sub-block is failing and why). Both 6.4 (`coverage_progress=true`)
  and 6.5 (`overall_passing=true`) are required for §S.4.

## §S Acceptance gates

- [ ] S.1 `bun test` green; tests added in §1.4, §3.3, §3a.3, §4.2.
  ≥131 tests, 0 fails (current 122 + 5 new resolver tests + 1
  coverage test + 1 substrate-health test + 4 observer cases ≈ 133).
- [ ] S.2 `bun run lint` clean: 23 advertised shapes, 23 dispatch cases.
- [ ] S.3 In-container §6 chain runs end-to-end on a non-human trigger.
- [ ] S.4a At least one `coverageReport` impulse has
  `coverage_progress=true` from natural substrate activity. This is
  the cell-count progress half of the load-bearing assertion.
- [ ] S.4b The most recent `substrateHealthReport` emission at the
  time S.4a is evaluated has
  `health_verdict.overall_passing=true`. This is the substrate-health
  half. The two together are necessary inputs to lift; the hand-over
  itself (writing `validation/state/lift-status.json`) is the
  operator's decision and is out of scope for this spec.

## Out of scope (next change)

- Unreachable-but-known distinction (foundation 4-cell, fourth cell).
  Requires distinguishing offline-vessel from never-invoked. Folded into
  Reachable+Unlearned in v1.
- Improvisation dispatch when escalate-unknown-shape fails. Bold closure:
  when no producer exists and no scaffold succeeds, dispatch raw
  improvisation per foundation §548–600.
- Probe budgeting / quotas.
- Workbench surface for the convergence report. Adding a viewer is
  observability-side, not loop-closure-side.
