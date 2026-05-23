# Spec — Harness as Lifecycle Participant

Normative requirements for the harness-as-lifecycle-participant change.
Each requirement is testable.

## R1 — Aggregator resolver

- **R1.1** Development-vessel MUST advertise a `failure_mode_matrix_score`
  shape in `config.discovery.shapes`.
- **R1.2** The resolver MUST accept a pointer of shape
  `{ type: "failure_mode_matrix_score", scenarios_dir: string,
  label?: string, out_path?: string }`.
- **R1.3** The resolver MUST read every `*.json` file in `scenarios_dir`
  and treat each as a Scenario per
  `validation/failure-modes/schema.json`. Files that fail to parse MUST
  be skipped with a note in the report, not throw.
- **R1.4** For each scenario, the resolver MUST query
  `POST {METABOB_ENDPOINT}/v2/activities/discover-by-shapes` with the
  scenario's
  `expected_emergence.activity_signature.output_shapes_must_include`
  list in `mode: "forward"`.
- **R1.5** A scenario MUST be classified `reuse` if the discovery call
  returns at least one activity whose `output_shapes` (or
  `output_schema.produces_shapes`) is a superset of the required shapes;
  `gap` otherwise.
- **R1.6** The resolver MUST return a `ResolverResult` with
  `shape: "failureModeReport"` and a body matching the schema in
  design §D.
- **R1.7** If `out_path` is provided, the resolver MUST also write the
  report body to that path as JSON for backward compatibility.
- **R1.8** Non-200 responses from activity-api MUST be tolerated per-scenario
  (mark that scenario gap with an error note; continue with the rest).
  A complete activity-api outage is allowed to fail the resolver call.

## R2 — Aggregator seed template

- **R2.1** A seed template
  `development-vessel:harness-run-matrix` MUST exist in
  `src/seed/harness-run-matrix.ts`.
- **R2.2** The template MUST consist of exactly one task using the
  `failure_mode_matrix_score` resolver.
- **R2.3** The template MUST declare `outputShapes: ["failureModeReport"]`.
- **R2.4** `src/seed/index.ts` MUST export the template and include it
  in `SEED_TEMPLATES`.

## R3 — Lifecycle observer

- **R3.1** Development-vessel MUST start a WebSocket subscription against
  `${METABOB_ENDPOINT}/ws` at server bootstrap.
- **R3.2** The observer MUST send `{type: "authenticate", token:
  METABOB_API_KEY}` after connection open.
- **R3.3** On receipt of an event with
  `type === "lifecycle:execution:succeeded"`, the observer MUST evaluate
  a `shouldRescore(event)` predicate. It MUST return true when ANY of:
  - `event.activity_template_id` contains `"draft-gap-closing-activity"`
  - `event.activity_template_id` contains `"prune-activity"`
  - `event.activity_template_id` contains `"replace-activity"`
  - `event.output_shapes?.includes("activityRegistryChange")` is true
- **R3.4** On a true predicate, the observer MUST invoke the dev-vessel's
  local `runActivity` for template id
  `development-vessel:harness-run-matrix`. Defaults: `scenarios_dir =
  validation/failure-modes/scenarios`, `label =
  "auto-rescore-<event.execution_id>"`, no `out_path` (impulse-only).
- **R3.5** Run failures MUST be logged and swallowed. The observer MUST NOT
  throw into the WebSocket message loop.
- **R3.6** The observer MUST reconnect on socket close with exponential
  backoff 1s → 30s, identical to the concept-db observer pattern.
- **R3.7** The observer MUST be cancellable via a
  `stopRegistryChangeObserver()` export for clean shutdown and tests.

## R4 — `activityRegistryChange` emission

- **R4.1** On successful invocation, the `activity_create_variant`
  resolver MUST cause an event observable on the WebSocket whose
  `output_shapes` includes `"activityRegistryChange"`. Implementation
  choice (extra trace POST vs. impulse-relevance call) is at the
  discretion of DEV; the requirement is the externally observable signal.
- **R4.2** On a failed `activity_create_variant` call (4xx/5xx from
  activity-api), the emission MUST NOT occur.
- **R4.3** The emission's body MUST include `template_id` and
  `change_type: "create_variant"` per design §D.

## R5 — Shape contract

- **R5.1** `failureModeReport` is a shape produced by the aggregator
  resolver. Body schema is design §D and MUST be backwards-compatible
  with `validation/scripts/failure-mode-harness.ts:HarnessReport`.
- **R5.2** `activityRegistryChange` is a shape carried in event
  `output_shapes` arrays. The shape MUST NOT (in this change) appear in
  `discovery.shapes` of any vessel — it is a marker shape on
  trace/event payloads only.
- **R5.3** No existing shape's schema MAY be modified by this change.

## R6 — Operational

- **R6.1** Triggering rate: on present canary (~1
  `draft-gap-closing-activity` per hour at most), the observer MUST NOT
  fire harness more than once per 5 seconds even if duplicate events
  arrive. (Trivial sliding-window guard in the observer; not full
  debouncing.)
- **R6.2** Untriggered runtime cost: when no event arrives, the observer
  MUST NOT consume CPU beyond keepalive pings.

## R7 — Tests

- **R7.1** Per-resolver test for `failure_mode_matrix_score` per
  design §E.
- **R7.2** Observer test asserts the predicate from R3.3 against synthetic
  events.
- **R7.3** `activity_create_variant` test asserts the emission from R4.1
  on success and its absence on failure.
- **R7.4** The dry-run seed test (existing) covers the new template's
  resolver reference automatically.

## R8 — Acceptance

- **R8.1** `bun test` passes with ≥126 tests, 0 fails.
- **R8.2** `bun run lint` reports 19 advertised shapes, 19 dispatch
  cases.
- **R8.3** Canary verification per tasks.md §6 produces an AET in
  activity-api whose `activity_template_id` is the harness aggregator AND
  which was NOT triggered by a human running `bun run`.
