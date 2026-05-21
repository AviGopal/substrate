# Capability: team-lead-rubric

A six-spec end-to-end rubric that exercises the standalone
product surface from a team-lead's perspective. Lives at
`repos/metabob-cloud-dashboard/e2e/rubric/`; runs via
`bun run dev-loop`.

This capability closes the standalone-product loop: after these
specs pass green against canary, the dashboard is demonstrably
usable end-to-end without activity-impulse dependencies.

## Requirements

### R1 — Non-UI standalone seed

The dashboard SHALL provide
`e2e/fixtures/standalone-seed.ts` exporting `seedRubricUser()`
that idempotently creates a test user, org, and at least one
API key via HTTP calls to identity-vessel + user-vessel — no
browser. The function SHALL return a Playwright-compatible
`storageState` including the authentication cookie and any
localStorage entries the rubric needs (notably the raw API key
for the Usage tab via the iter-4 `metabob_raw_api_keys` stash).

`globalSetup` in `playwright.config.ts` SHALL invoke
`seedRubricUser()` when `E2E_STANDALONE_MODE=true` and write the
storageState to `playwright/.auth/rubric.json`.

The `playwright/.auth/` directory SHALL be gitignored.

### R2 — Standalone Playwright project

`playwright.config.ts` SHALL declare a project named `rubric`:

- `testDir: "./e2e/rubric"`
- `use.storageState: "playwright/.auth/rubric.json"`
- No `dependencies` (explicitly standalone — does NOT depend on
  the existing `setup` project / `auth.setup.ts`).

`scripts/dev-loop.ts` SHALL invoke `--project=rubric`.

### R3 — Six rubric specs

The six spec files under `e2e/rubric/` SHALL contain real,
non-skipped test bodies covering the team-lead journeys:

- **`01-onboard.spec.ts`** — API key list renders; create-key
  reveals the raw key in the new-key banner; revoke removes the
  key from the list.
- **`02-observe-agent.spec.ts`** — `/execution-traces` route
  renders the standalone-mode placeholder; the nav entry for
  execution traces is absent in standalone mode.
- **`03-observe-mcp-usage.spec.ts`** — `/mcp` shows Tools,
  Install, Usage tabs; Tools tab lists at least one tool;
  Install tab shows `npx metabob-mcp`; Usage tab fires
  `/api/mcp/usage` for the seeded key and renders summary cards
  OR the documented error card.
- **`04-manage-team.spec.ts`** — team page renders; the seeded
  user is listed.
- **`05-budget-check.spec.ts`** — `/usage-analytics` placeholder
  renders, OR an alternative non-gated budget surface is
  asserted.
- **`06-cross-project-view.spec.ts`** — project-selector
  exercise OR org-scope assertion on the API Keys page.

If any flow's UI doesn't yet exist (e.g., no team page) the
spec MAY use `test.skip(...)` with a clear reason and a
follow-up task — but the file MUST contain a real best-effort
test body, not the iteration-2 placeholder.

### R4 — Green against canary

A fresh `bun run dev-loop` against a locally-running dashboard
pointed at canary backends SHALL produce
`e2e/results/last-run.json` with `failed: 0`. The combination
of `passed + skipped` SHALL equal `total = 6`. Any
intentional `test.skip(...)` SHALL be documented in this spec
with a follow-up note.

### R5 — Stopping condition

After this capability archives, the standalone-product loop's
stopping condition is met:

- All five plan items archived under `openspec/changes/archive/`:
  `standalone-product-boundaries`, `playwright-dev-loop`,
  `mcp-info-surface`, `rpc-api-mcp-usage-adapter`,
  `team-lead-rubric`.
- The rubric is green against canary.
- The dashboard is demonstrably usable end-to-end with
  activity-impulse dependencies disabled.

The dynamic-mode loop SHALL exit (no `ScheduleWakeup`) after the
archive commit lands.

## Non-requirements

- Cross-browser parity (chromium only).
- Mocking rpc-api / identity-vessel / user-vessel — the rubric
  hits canary or fails.
- Modifying any vessel source.
- Pixel-diff screenshots.
