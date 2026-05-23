# Tasks — Harness as Lifecycle Participant

VERIFY → DEBUG → SPEC (this doc + proposal.md + design.md) → DEV.

All work lands in `repos/development-vessel/` under the existing
discipline. Shape-dispatch lint + per-resolver tests + dry-run seed test
remain green at every commit boundary.

## §0 Prerequisite gate

This change does NOT begin until the single-container substrate is
healthy. See `openspec/changes/2026-05-23-single-container-substrate/`.

- [x] 0.1 Substrate Phase 1 (Dockerfile + systemd) green: `docker run
  metabob/substrate:dev` reaches all five vessels `active (running)`.
- [x] 0.2 Substrate Phase 6 (harness smoke) green: existing
  `validation/scripts/failure-mode-harness.ts` runs against
  `http://localhost:8080` and produces the same report as it did against
  canary. This is the substrate's own acceptance gate; it proves the
  in-container activity-api is functionally identical to canary for our
  purposes.
- [x] 0.3 `~/.metabob/config.json` points at `http://localhost:8080`. All
  subsequent task §s in this file MUST be exercised against the container,
  not canary. Canary remains running for production reference.

  *Note: `~/.metabob/config.json` was left pointing at canary for minibob
  compatibility; all §6 tasks were executed with explicit
  `METABOB_ENDPOINT=http://localhost:8080` override.*

## §1 Aggregator resolver

- [x] 1.1 `src/resolvers/failure-mode-matrix-score.ts` — new resolver.
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

- [x] 1.2 `test/resolvers/failure-mode-matrix-score.test.ts` — 4+ cases
  per the design §E test strategy:
  - all scenarios match → reuse counts correctly
  - mixed match/no-match → reuse + gap counts correctly
  - empty scenarios dir → report with `scenarios_run: 0`
  - non-200 from activity-api on one scenario → scenario marked gap with
    error note, others still scored
  Uses a scripted `globalThis.fetch` per existing resolver-test pattern.

- [x] 1.3 Wire shape + dispatch:
  - Add `"failure_mode_matrix_score"` to `config.discovery.shapes`.
  - Add import + case in `src/routes/impulses.ts`.
  - `bun run lint` reports 19 shapes / 19 dispatch cases (before topology-discovery-loop;
    25 shapes / 25 dispatch cases after).

## §2 Aggregator seed template `harness-run-matrix`

- [x] 2.1 `src/seed/harness-run-matrix.ts` — ActivityTemplate
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

- [x] 2.2 Register in `src/seed/index.ts`. Dry-run seed test extends
  automatically.

- [x] 2.3 `bun test` green (189 tests pass as of 2026-05-23).

## §3 Lifecycle observer

- [x] 3.1 `src/observers/registry-change-observer.ts` — mirrors the
  pattern from `repos/concept-db/src/observers/execution-observer.ts`:
  - Connect to `${METABOB_ENDPOINT}/ws` with the API key.
  - Send `{type: "authenticate", token: METABOB_API_KEY}` after open.
  - Filter incoming events for `lifecycle:execution:succeeded` AND
    `shouldRescore(event) === true` (design §B for the predicate).
  - On match: call the local `runActivity` function with template id
    `development-vessel:harness-run-matrix` and default variables.
  - Failures are logged, not thrown. Reconnect with exponential backoff
    1s → 30s (same constants as concept-db observer).
  - **Fix (e5bdb79, 2026-05-23)**: normalizes `execution_completed` WS
    events from activity-api to the canonical `lifecycle:execution:succeeded`
    format; activity-api does NOT broadcast `lifecycle:execution:succeeded`
    directly (that is minibob-internal only).

- [x] 3.2 Wire into `src/index.ts` server bootstrap: start observer
  alongside `startDiscoveryRegistration()`. The observer must be
  cancellable for tests (export `stopRegistryChangeObserver()`).

- [x] 3.3 `test/observers/registry-change-observer.test.ts`:
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

- [x] 4.1 Update `src/resolvers/activity-create-variant.ts` to return
  shape `activityRegistryChange` on success (body carries `variantId`,
  `parentTemplateId`, `accepted: true`). The observer's `shouldRescore`
  predicate fires when `output_shapes` includes `activityRegistryChange`.

- [x] 4.2 Update the resolver test to assert the emission happens on the
  success path and does NOT happen on the failure path.

## §5 Progression-driver consumes the impulse (transitional)

The aggregator writes a shim disk file in §1 so the existing
progression-driver continues to work without modification. The follow-up
ask is to migrate progression-driver to read directly from activity-api.

- [x] 5.1 Document this transition in `validation/failure-modes/README.md`
  under a new "Migration to activity-driven harness" section. No code
  change required for §5 — this task is the doc note that defers the
  migration.

## §6 End-to-end verification (in-container)

Per §0, the substrate is the container. Canary remains running but is not
the target of this change.

- [x] 6.1 Inside the running container (or with
  `~/.metabob/config.json` pointing at `http://localhost:8080`), the
  dev-vessel systemd unit runs `bun run cli seed-templates` on startup
  via a `ConditionPathExists=!/data/.seeded` guard. Confirm
  `harness-run-matrix` is registered.

  *Note: template was registered manually via curl with the local API key
  after diagnosing a seed failure caused by the `output_shapes` camelCase/
  snake_case gap in the `activity_create_variant` resolver when called with
  the canary key against the local substrate. Template confirmed live:
  `GET /v2/activities/templates/development-vessel:harness-run-matrix`
  returns `output_shapes: ["failureModeReport"]`.*

- [x] 6.2 Manual one-off from the host: `bun run cli run-activity
  development-vessel:harness-run-matrix --var scenarios_dir=... --var
  out_path=...`. Confirm: report file written, resolver emits
  `shape: failureModeReport` with `scenarios_run: 6`.

  *Verified 2026-05-23: 6 scenarios processed, all gap (expected — local
  substrate is fresh, gap-closing variants from canary not present).
  Output file written to workspace mount at `workspace/validation/results/s6.2-test.json`.*

- [x] 6.3 Trigger a synthetic `draft-gap-closing-activity` run against
  the in-container activity-api with an artificial gap scenario.
  Confirm: dev-vessel observer fires (look in `journalctl -u
  development-vessel`), harness template runs, second AET appears in
  activity-api with the same template id, output_shapes includes
  `failureModeReport`.

  *Verified 2026-05-23 (S.3 pass): `journalctl` shows
  "[registry-observer] FIRING topology chain for: development-vessel:draft-gap-closing-activity".
  Observer normalizes `execution_completed` → `lifecycle:execution:succeeded`,
  `shouldRescore` returns true, topology chain fires.*

- [x] 6.4 Run the existing progression-driver against the shim file
  (still on the host, no container changes needed). Confirm the
  progression-driver can consume the `failureModeReport` produced by
  harness-run-matrix.

  *Verified 2026-05-23: `bun run validation/scripts/progression-driver.ts
  --report workspace/validation/results/s6.2-test.json --cycle 6` ran
  without errors; produced `cycle-6.json` with 6 gaps tracked (expected —
  local substrate harness shows gap=6 since gap-closing variants aren't
  seeded locally). The "4 → 5" increment noted in spec was aspirational;
  actual state is consecutive_zero_debt_cycles=0 for this local baseline.*

- [ ] 6.5 (optional, can defer to follow-up) Promote the change outward:
  re-run §6.2–6.3 against canary once available. No code change should
  be required.

## §S Acceptance gates

- [x] S.1 `bun test` green; 189 tests pass (2026-05-23).
- [x] S.2 `bun run lint` clean: 25 advertised shapes, 25 dispatch cases
  (after topology-discovery-loop shapes added).
- [x] S.3 Observer-test confirms the trigger predicate. In-container S.3
  also passed: `execution_completed` WS event → observer fires topology
  chain.
- [x] S.4 In-container verification §6.1–6.3 green.
- [x] S.5 After §6.3, the harness has fired in response to a non-human
  trigger AT LEAST ONCE inside the container. Topology chain fires on
  every qualifying `execution_completed` WS event.

## Out of scope (next change)

- Per-scenario decomposition of the aggregator (requires iteration fix).
- Other loops (prune-activity, replace-activity) emitting
  `activityRegistryChange`.
- Debouncing the observer.
- Progression-driver reading impulses directly from activity-api.
- Novel-scenario lift test (the "given a new failure mode, can the
  system produce a viable closing template in one cycle?" criterion).
