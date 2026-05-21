# Capability: playwright-dev-loop

A driveable end-to-end test loop for `metabob-cloud-dashboard`. The
contract is a single script (`bun run dev-loop`) that runs a fixed
set of UI specs against a locally-running dashboard pointed at
canary backends and emits a machine-readable summary that MiniBob
(or any agent) can consume.

This capability scaffolds the dev loop and the rubric directory
shape. Actual spec bodies for the six team-lead flows land in a
follow-up capability (`team-lead-rubric`, iteration 4).

## Requirements

### R1 — Standalone-mode e2e setup

The dashboard's `e2e/global-setup.ts` SHALL honor an
`E2E_STANDALONE_MODE` env var. When `E2E_STANDALONE_MODE === "true"`:

- Setup MUST NOT wait for activity-api.
- Setup MUST NOT call `seedTestData()` or any function that writes
  to activity-api.
- Setup MUST still verify the dashboard URL is reachable on
  `BASE_URL` (default `http://localhost:3000`) and fail fast
  otherwise.
- Setup MUST log a clearly-identifiable marker
  (`🧊 Standalone mode — skipping activity-api wait and seed`) so
  the dev loop's output makes the mode obvious.

When `E2E_STANDALONE_MODE` is unset or `"false"`, existing behavior
SHALL be unchanged (waits for analysis-api + activity-api with
warnings, calls `seedTestData()` unless `SKIP_SEED=true`).

### R2 — Rubric directory shape

The dashboard SHALL contain a directory
`e2e/rubric/` with exactly six spec files, named:

- `01-onboard.spec.ts`
- `02-observe-agent.spec.ts`
- `03-observe-mcp-usage.spec.ts`
- `04-manage-team.spec.ts`
- `05-budget-check.spec.ts`
- `06-cross-project-view.spec.ts`

Each file SHALL contain a single `test.describe(...)` with
`test.skip(true, "iteration 4 ...")` so the playwright runner reports
each as skipped (not failed) until iteration 4 fills the bodies in.
File ordering follows the team-lead journey.

### R3 — Dev-loop script

The dashboard SHALL expose a `bun run dev-loop` script that:

- Verifies the dashboard is reachable on `BASE_URL` (default
  `http://localhost:3000`); exits non-zero with a clear message
  pointing at `bun --hot src/index.ts` if not.
- Runs `bunx playwright test e2e/rubric/ --reporter=json` with
  `E2E_STANDALONE_MODE=true` set in the child environment.
- Writes a compact summary to `e2e/results/last-run.json` with the
  shape:
  ```jsonc
  {
    "timestamp": "<ISO8601>",
    "exit_code": 0,
    "total": 6,
    "passed": 0,
    "failed": 0,
    "skipped": 6,
    "specs": [
      { "file": "<path>", "title": "<spec title>",
        "status": "passed|failed|skipped",
        "duration_ms": 0, "error": null }
      // ...
    ]
  }
  ```
- Prints one human-readable line per spec to stdout, plus a final
  summary line.
- Exits 0 when `failed === 0` (skipped is not a failure); propagates
  the child exit code otherwise.

The script MUST NOT start or stop the dashboard; the caller brings
the server up separately.

### R4 — Iteration 2 ships scaffolding only

This change SHALL leave every rubric spec body as a `test.skip(...)`
placeholder. Implementing the actual flows is deferred to a future
capability (`team-lead-rubric`). The dev-loop contract MUST be
verifiable end-to-end with skipped specs alone (a fresh checkout
runs `bun run dev-loop` against a running dashboard and exits 0 with
six skipped specs).

## Non-requirements

- This capability does NOT specify the contents of the six rubric
  flows; that belongs to `team-lead-rubric`.
- This capability does NOT require fixing the `/api/activity/*` BFF
  proxy gap; that belongs to the iteration-5 adapter-layer
  capability.
- This capability does NOT specify a MiniBob activity template; the
  contract is plain bash + exit code + `last-run.json`. A template
  may be added later without changing this capability.
