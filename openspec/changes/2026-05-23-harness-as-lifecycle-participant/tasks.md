# Tasks — Harness as Lifecycle Participant

VERIFY → DEBUG → SPEC (this doc + proposal.md + design.md) → DEV.

All work lands in `repos/development-vessel/` under the existing
discipline. Shape-dispatch lint + per-resolver tests + dry-run seed test
remain green at every commit boundary.

## §1 Aggregator resolver

- [ ] 1.1 `src/resolvers/failure-mode-matrix-score.ts` — new resolver.
  Pointer shape:
  ```typescript
  {
    type: "failure_mode_matrix_score",
    scenarios_dir: string,           // relative or absolute
    label?: string,                  // attached to the report
    out_path?: string                // optional shim file write
  }
  ```
  Behavior: read every `*.json` in `scenarios_dir`; for each, call
  `POST /v2/activities/discover-by-shapes` (forward mode) with the
  scenario's `expected_emergence.activity_signature.output_shapes_must_include`;
  aggregate into a `failureModeReport` body (per design §D).
  Returns `{ shape: "failureModeReport", body: {...} }`.

- [ ] 1.2 `test/resolvers/failure-mode-matrix-score.test.ts` — 4+ cases
  per the design §E test strategy:
  - all scenarios match → reuse counts correctly
  - mixed match/no-match → reuse + gap counts correctly
  - empty scenarios dir → report with `scenarios_run: 0`
  - non-200 from activity-api on one scenario → scenario marked gap with
    error note, others still scored
  Uses a scripted `globalThis.fetch` per existing resolver-test pattern.

- [ ] 1.3 Wire shape + dispatch:
  - Add `"failure_mode_matrix_score"` to `config.discovery.shapes`.
  - Add import + case in `src/routes/impulses.ts`.
  - `bun run lint` reports 19 shapes / 19 dispatch cases.

## §2 Aggregator seed template `harness-run-matrix`

- [ ] 2.1 `src/seed/harness-run-matrix.ts` — ActivityTemplate
  `development-vessel:harness-run-matrix`. One task using the new
  resolver:
  ```typescript
  {
    id: "score_matrix",
    resolver: "failure_mode_matrix_score",
    config: {
      type: "failure_mode_matrix_score",
      scenarios_dir: "{{scenarios_dir}}",
      label: "{{label}}",
      out_path: "{{out_path}}"
    },
    outputShapes: ["failureModeReport"]
  }
  ```
  Variables: `scenarios_dir`, `label`, `out_path` (latter two optional).

- [ ] 2.2 Register in `src/seed/index.ts`. Dry-run seed test extends
  automatically.

- [ ] 2.3 `bun test` green (124+ pass).

## §3 Lifecycle observer

- [ ] 3.1 `src/observers/registry-change-observer.ts` — mirrors the
  pattern from `repos/concept-db/src/observers/execution-observer.ts`:
  - Connect to `${METABOB_ENDPOINT}/ws` with the API key.
  - Send `{type: "authenticate", token: METABOB_API_KEY}` after open.
  - Filter incoming events for `lifecycle:execution:succeeded` AND
    `shouldRescore(event) === true` (design §B for the predicate).
  - On match: call the local `runActivity` function with template id
    `development-vessel:harness-run-matrix` and default variables.
  - Failures are logged, not thrown. Reconnect with exponential backoff
    1s → 30s (same constants as concept-db observer).

- [ ] 3.2 Wire into `src/index.ts` server bootstrap: start observer
  alongside `startDiscoveryRegistration()`. The observer must be
  cancellable for tests (export `stopRegistryChangeObserver()`).

- [ ] 3.3 `test/observers/registry-change-observer.test.ts`:
  - Stub WebSocket with a minimal event-emitter fake.
  - Inject a fake `runActivity` via the observer factory; assert call
    count after each synthetic event.
  - Cases per design §E integration plan:
    - `lifecycle:execution:succeeded` for `draft-gap-closing-activity`
      → `runActivity` called exactly once with the harness template id.
    - `lifecycle:execution:succeeded` for `git_status` task → NOT called.
    - `task.completed` event (wrong type) → NOT called.
    - `output_shapes` containing `activityRegistryChange` → called.
    - Two events in quick succession → called twice (no implicit
      debounce; we'll add later if needed).

## §4 `activity_create_variant` emits `activityRegistryChange`

Minimal wiring to make the lifecycle subscription verifiable end-to-end.

- [ ] 4.1 Update `src/resolvers/activity-create-variant.ts` to return
  TWO impulses (or one impulse whose body carries both shapes; ResolverResult
  currently returns a single shape — extend it if needed, or have the
  resolver emit a side-channel via the trace's `output_impulse_ids`). The
  minimum viable path: on success, the resolver POSTs a small synthetic
  trace to activity-api whose `output_shapes` includes
  `activityRegistryChange` and whose body matches design §D.

  If that adds too much footprint, simpler alternative: change the
  resolver to ALSO emit an impulse via a `POST /v2/impulses/relevance`
  call carrying the `activityRegistryChange` shape, and have the WS
  broadcaster pick it up. Decide during DEV based on what the activity-api
  side accepts without changes.

- [ ] 4.2 Update the resolver test to assert the emission happens on the
  success path and does NOT happen on the failure path.

## §5 Progression-driver consumes the impulse (transitional)

The aggregator writes a shim disk file in §1 so the existing
progression-driver continues to work without modification. The follow-up
ask is to migrate progression-driver to read directly from activity-api.

- [ ] 5.1 Document this transition in `validation/failure-modes/README.md`
  under a new "Migration to activity-driven harness" section. No code
  change required for §5 — this task is the doc note that defers the
  migration.

## §6 End-to-end verification on canary

- [ ] 6.1 Operator runs `bun run cli seed-templates` to upload
  `harness-run-matrix` (write-scope sufficient).
- [ ] 6.2 Manual one-off: `bun run cli run-activity
  development-vessel:harness-run-matrix --var scenarios_dir=... --var
  out_path=...`. Confirm: report file written, AET visible in
  activity-api via
  `GET /v2/activities/execution-traces?activity_template_id=...`.
- [ ] 6.3 Trigger a synthetic `draft-gap-closing-activity` run on canary
  with an artificial gap scenario. Confirm: observer fires, harness
  template runs, second AET appears in activity-api with the same
  template id, output_shapes includes `failureModeReport`.
- [ ] 6.4 Run the existing progression-driver against the shim file.
  Confirm `consecutive_zero_debt_cycles` increments from 4 → 5.

## §S Acceptance gates

- [ ] S.1 `bun test` green; ≥126 tests (current 122 + matrix-score +
  observer + create-variant emission update).
- [ ] S.2 `bun run lint` clean: 19 advertised shapes, 19 dispatch cases.
- [ ] S.3 Observer-test confirms the trigger predicate.
- [ ] S.4 Canary verification §6.1–6.3 green.
- [ ] S.5 After §6.3, the harness has fired in response to a non-human
  trigger AT LEAST ONCE on canary. This is the load-bearing assertion:
  it proves the loop closes without a person in it.

## Out of scope (next change)

- Per-scenario decomposition of the aggregator (requires iteration fix).
- Other loops (prune-activity, replace-activity) emitting
  `activityRegistryChange`.
- Debouncing the observer.
- Progression-driver reading impulses directly from activity-api.
- Novel-scenario lift test (the "given a new failure mode, can the
  system produce a viable closing template in one cycle?" criterion).
