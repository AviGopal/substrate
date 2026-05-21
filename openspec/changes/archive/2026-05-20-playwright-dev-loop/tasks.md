# Tasks: Playwright Dev Loop

Iteration 2 of the standalone-product loop. Scaffolding only — rubric
spec bodies land in iteration 4.

## §1 Decouple global-setup from activity-api

- [x] 1.1 In `repos/metabob-cloud-dashboard/e2e/global-setup.ts`, read
      `process.env.E2E_STANDALONE_MODE === "true"` into a local
      `standaloneMode` flag at the top of `globalSetup()`.
- [x] 1.2 When `standaloneMode` is true: log
      `🧊 Standalone mode — skipping activity-api wait and seed`,
      keep the dashboard reachability check, and early-return after
      it. Do NOT call `waitForApi(activityApiUrl)` or
      `seedTestData()`.
- [x] 1.3 When `standaloneMode` is false: existing behavior unchanged
      (waits for analysis-api + activity-api with warnings, calls
      `seedTestData()` unless `SKIP_SEED=true`).

## §2 Rubric scaffolding

- [x] 2.1 Create `repos/metabob-cloud-dashboard/e2e/rubric/` directory.
- [x] 2.2 Create six placeholder spec files (`01-onboard.spec.ts`
      through `06-cross-project-view.spec.ts`). Each contains:
      ```ts
      import { test } from "@playwright/test";

      test.describe("Rubric: <flow>", () => {
        test.skip(true, "iteration 4 — see openspec/specs/team-lead-rubric/spec.md");
        test("placeholder", async () => {});
      });
      ```
      Use the flow names: `onboard`, `observe-agent`,
      `observe-mcp-usage`, `manage-team`, `budget-check`,
      `cross-project-view`.

## §3 Dev-loop script

- [x] 3.1 Create `repos/metabob-cloud-dashboard/scripts/dev-loop.ts`.
      Behavior:
      - Read `BASE_URL` (default `http://localhost:3000`).
      - Probe `${BASE_URL}/health` with a 5s timeout; if not reachable,
        exit 2 with a message pointing at `bun --hot src/index.ts`.
      - Spawn `bunx playwright test e2e/rubric/ --reporter=json`
        with `E2E_STANDALONE_MODE=true` in env, capture stdout.
      - Parse the JSON, emit a compact summary to `e2e/results/last-run.json`:
        `{ timestamp, exit_code, total, passed, failed, skipped, specs: [...] }`.
      - Print per-spec lines to stdout + one final summary line.
      - Exit 0 if `failed === 0`; otherwise propagate child exit code.
- [x] 3.2 Add `"dev-loop": "bun run scripts/dev-loop.ts"` to the
      `scripts` section of `repos/metabob-cloud-dashboard/package.json`.
- [x] 3.3 Add `e2e/results/` to
      `repos/metabob-cloud-dashboard/.gitignore` if not already
      present.

## §4 Documentation

- [x] 4.1 Append a `## Dev loop` section to
      `docs/PRODUCT_BOUNDARIES.md` covering: how to run locally
      (start dashboard + `bun run dev-loop`), env-var contract
      (`E2E_STANDALONE_MODE`, `BASE_URL`), `last-run.json` shape, and
      the MiniBob goal phrasing.
- [x] 4.2 In the same section, add a "Known gap" callout: the
      `/api/activity/*` BFF proxy is not wired; research mode 404s on
      paths under that prefix today; fix lands in iteration 5
      (adapter layer).

## §5 Verification

- [x] 5.1 Run `E2E_STANDALONE_MODE=true bun test:e2e` from the
      cloud-dashboard repo with no activity-api running. Confirm:
      setup log shows the 🧊 standalone marker, suite reports
      `6 skipped`, exit 0.
- [x] 5.2 Run `bun run dev-loop` against a locally-running dashboard.
      Confirm: exit 0, `e2e/results/last-run.json` exists with
      `failed: 0, skipped: 6`.

## §6 Archive prep

- [x] 6.1 Two commits: one inside cloud-dashboard
      (`feat(cloud-dashboard): scaffold rubric e2e + dev-loop script`),
      one in super-repo (`docs(boundaries): dev-loop section +
      playwright-dev-loop spec`).
- [x] 6.2 Both pushed to `origin/dev`.
- [x] 6.3 Archive moves change dir to
      `openspec/changes/archive/2026-05-20-playwright-dev-loop/` and
      lifts `specs/playwright-dev-loop/spec.md` to
      `openspec/specs/playwright-dev-loop/spec.md`.
