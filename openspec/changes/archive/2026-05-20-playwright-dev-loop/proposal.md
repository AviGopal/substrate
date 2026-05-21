# Proposal: Playwright Dev Loop (standalone-product iteration 2)

## Why

Iteration 1 of the standalone-product loop established the boundary
contract: dashboard runs without activity-api when
`VITE_ENABLE_ACTIVITY_VIEWS != "true"`. The dashboard already has
Playwright wired (`playwright.config.ts`, `e2e/`, `bun test:e2e`), and
the official Playwright Claude Code plugin is installed at
`/home/avi/.claude/plugins/cache/claude-plugins-official/playwright/`.

What's missing is a **driveable dev loop**: a single script MiniBob (or
a developer) can invoke that runs a fixed set of UI specs against a
local dashboard pointed at canary backends, and emits a machine-
readable summary. Without that, "validate the standalone product"
stays a manual gate.

Two specific blockers today:

1. **`e2e/global-setup.ts` couples to activity-api.** It calls
   `seedTestData()` (under `scripts/seed-test-data.ts`) which writes to
   activity-api. In standalone mode (no activity-api), seeding fails
   and tests run against whatever happens to be in identity-vessel +
   user-vessel. The setup currently warns rather than blocks on
   activity-api itself, but the *seed* is the real coupling.
2. **There is no rubric.** Iteration 4 will write the team-lead E2E
   flows (onboard, observe-agent, observe-mcp-usage, manage-team,
   budget-check, cross-project-view). Iteration 2 needs to scaffold
   the directory and a runnable contract so the dev loop has shape
   even before specs are filled in.

## What Changes

This change is **scaffolding + one decoupling**. It does not write
the actual rubric (deferred to iteration 4) and does not fix the
`/api/activity` proxy gap (deferred to iteration 5).

1. **Decouple `e2e/global-setup.ts` from activity-api.** Introduce
   `E2E_STANDALONE_MODE` (default `false` so existing CI is
   unchanged). When `E2E_STANDALONE_MODE=true`:
   - Skip the activity-api wait.
   - Skip `seedTestData()` activity-api writes (the function already
     supports `SKIP_SEED=true`; we wire `E2E_STANDALONE_MODE=true`
     to imply `SKIP_SEED=true` if not explicitly set).
   - Keep identity-vessel and user-vessel waits.

2. **Add `e2e/rubric/` directory** with six placeholder specs, each
   containing a single `test.skip(true, "iteration 4")` so the
   playwright runner counts them but doesn't execute. File names:
   `01-onboard.spec.ts`, `02-observe-agent.spec.ts`,
   `03-observe-mcp-usage.spec.ts`, `04-manage-team.spec.ts`,
   `05-budget-check.spec.ts`, `06-cross-project-view.spec.ts`.

3. **Add a `dev-loop` script** at
   `repos/metabob-cloud-dashboard/scripts/dev-loop.ts` (Bun
   TypeScript), wired as `bun run dev-loop` in `package.json`. It:
   - Checks the dashboard is reachable on `BASE_URL` (default
     `http://localhost:3000`); does NOT start it (the runner is
     expected to bring up the server externally — simpler contract,
     avoids port collisions).
   - Runs `bunx playwright test e2e/rubric/ --reporter=json` with
     `E2E_STANDALONE_MODE=true`.
   - Writes `e2e/results/last-run.json` with shape:
     `{ timestamp, exit_code, total, passed, failed, skipped, specs:
     [{ file, title, status, duration_ms }] }`.
   - Stdout: one human-readable line per spec + a final summary
     line.
   - Exit code: 0 if no failures (skipped is not a failure); non-zero
     otherwise.

4. **Append "Dev loop" section to `docs/PRODUCT_BOUNDARIES.md`** with:
   - How to run it locally (`bun run dev-loop` after `bun --hot
     src/index.ts` in another terminal).
   - The MiniBob goal phrasing: `"run the team-lead rubric against
     the local dashboard"`.
   - The `last-run.json` shape contract.
   - A "known gap" note about the `/api/activity/*` proxy (research-
     mode-only, fixed in iteration 5).

5. **New spec capability**: `playwright-dev-loop` with four
   requirements (R1–R4 in spec.md).

## Non-Goals

- Writing actual rubric spec bodies. Iteration 4.
- Fixing the `/api/activity/*` proxy. Iteration 5.
- Building the dashboard's `/mcp` info surface. Iteration 3.
- Wiring the dev loop to a MiniBob goal-template. The contract is
  plain bash + exit code + `last-run.json`; the MiniBob-side template
  ships when the rubric specs do.
- Deploying anything. No deployable artifact changes here.

## Success Criteria

- `E2E_STANDALONE_MODE=true bun run test:e2e` from a fresh checkout
  with **no activity-api running** completes without hanging and
  reports six skipped specs.
- `bun run dev-loop` returns exit 0 (six skipped, zero failed) and
  writes a valid `e2e/results/last-run.json`.
- `docs/PRODUCT_BOUNDARIES.md` has a "Dev loop" section linked from
  its own ToC.
- Capability spec `openspec/specs/playwright-dev-loop/spec.md` exists
  after archive.
