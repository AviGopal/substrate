# Design: Playwright Dev Loop

## Scope and rationale

Iteration 2 ships **scaffolding**, not test content. The reasons are:

- The rubric specs need real flows from the team-lead perspective
  (onboard a user, observe an agent's traces, observe MCP tool usage,
  manage team members, set a budget alert, switch projects). Each
  flow needs UI selectors, fixture data, and an assertion contract.
  That's iteration 4's work; piling it into iteration 2 inflates the
  change.
- A driveable contract (`bun run dev-loop` → exit code +
  `last-run.json`) is independent of what's in the specs. Shipping
  the contract first lets iteration 4 land specs incrementally
  without rewiring the runner each time.
- Decoupling `global-setup.ts` from activity-api is a small, isolated
  change with immediate value: it unblocks running *any* spec against
  a standalone dashboard.

## Standalone mode toggle: why a new env var

Two options were considered for the standalone toggle in
`global-setup.ts`:

- **Option A**: Reuse `VITE_ENABLE_ACTIVITY_VIEWS`. Setting it to
  `"false"` in the e2e environment also implies standalone-mode setup.
- **Option B (chosen)**: Introduce a separate `E2E_STANDALONE_MODE`
  env var.

Option B wins because:

1. `VITE_*` vars are normally consumed at Vite build time, not by
   Node-side scripts like `global-setup.ts`. Conflating the two
   would make the contract subtle.
2. There are valid permutations where the dashboard is built with
   activity views off (customer build) but the e2e suite *does* want
   to verify they stay disabled. Two flags keep those two intents
   independent.

Default `E2E_STANDALONE_MODE=false` preserves existing CI behavior
exactly — no risk of breaking what already works.

The implementation: a single `if (standaloneMode)` branch at the top
of `globalSetup()` that early-returns after the dashboard wait,
**after** logging a clear marker line (`🧊 Standalone mode — skipping
activity-api wait and seed`). Identity-vessel and user-vessel waits
*currently don't exist* in `global-setup.ts` (it only waits for the
dashboard + analysis-api + activity-api); we don't add them
opportunistically here. Identity-vessel/user-vessel availability is
verified by the first real onboarding spec in iteration 4.

## Rubric scaffolding shape

Each placeholder file looks exactly like this:

```ts
import { test } from "@playwright/test";

test.describe("Rubric: <flow name>", () => {
  test.skip(true, "iteration 4 — see openspec/specs/team-lead-rubric/spec.md");

  test("placeholder", async () => {
    // intentionally empty
  });
});
```

`test.skip(true, ...)` at the describe level marks every test inside
as skipped, so Playwright reports `skipped: 6` instead of `passed: 0`.
That's important: the dev loop's contract is "no failures = exit 0",
and skipped ≠ failed. When iteration 4 lands the real specs, it
flips the `test.skip(true, ...)` to a fixture-driven `test.beforeEach`
without renaming files.

## `dev-loop.ts` script contract

The script is **a thin orchestrator**. Decisions:

- **Does not start the dashboard.** Two reasons: (1) port-conflict
  handling is fiddly when the script is invoked repeatedly; (2)
  MiniBob's `bash` resolver runs scripts to completion and would
  block on a backgrounded `bun --hot`. The contract is: caller brings
  up the dashboard separately. The script verifies reachability and
  fails loud if not.
- **Uses `bunx playwright test e2e/rubric/ --reporter=json`** so the
  raw JSON is parseable. The script post-processes that into the
  compact `last-run.json` shape (the raw Playwright JSON is large
  and embeds machine details we don't want).
- **Writes to `e2e/results/last-run.json`**. Adds `e2e/results/` to
  `.gitignore` if not already there.
- **No retries.** A flake is information; the rubric needs to be
  green deterministically against canary backends, and re-runs on
  flake hide real coupling problems.

Shape of `last-run.json`:

```jsonc
{
  "timestamp": "2026-05-20T18:00:00.000Z",
  "exit_code": 0,
  "total": 6,
  "passed": 0,
  "failed": 0,
  "skipped": 6,
  "specs": [
    {
      "file": "e2e/rubric/01-onboard.spec.ts",
      "title": "Rubric: onboard › placeholder",
      "status": "skipped",
      "duration_ms": 0,
      "error": null
    }
    // ...
  ]
}
```

That shape is forward-compatible: when iteration 4 fills in specs,
fields stay the same; `status` moves from `skipped` to `passed` /
`failed`, `duration_ms` becomes nonzero, and `error` carries the
first assertion failure for failed specs.

## MiniBob invocation

The contract is plain bash. A future activity template will encode:

```
goal: "run the team-lead rubric against the local dashboard"
tasks:
  - id: ensure-dashboard-up
    resolver: bash
    command: "curl -sf http://localhost:3000/health"
  - id: run-rubric
    resolver: bash
    command: "cd repos/metabob-cloud-dashboard && bun run dev-loop"
  - id: parse-summary
    resolver: bash
    command: "cat repos/metabob-cloud-dashboard/e2e/results/last-run.json"
```

That template lives in iteration 4 (or later) — iteration 2 only
guarantees the bash contract.

## The `/api/activity` gap (documented, not fixed)

Iteration 1's audit found that `src/lib/api/activity-api.ts` uses
`BASE_URL = "/api/activity"` but `src/index.ts` only proxies
`/api/v2/activities`. In standalone mode the new 501 gate covers
both paths; in research mode `/api/activity/*` 404s today.

The Dev-loop section in `PRODUCT_BOUNDARIES.md` carries a "Known
gap" callout pointing readers to iteration 5 (adapter layer) for
the fix. We deliberately don't add a proxy forward here:

- The right fix is a BFF route in iteration 5, not a wholesale
  forward.
- A naive forward would mask the gap that iteration 5 is supposed
  to solve cleanly.

## Risks

- **Test data without seed.** When `E2E_STANDALONE_MODE=true` the
  seed is skipped. The placeholder specs don't need data, so this is
  fine for iteration 2. Iteration 4 will need a standalone-mode seed
  path against identity-vessel + user-vessel directly. That's
  iteration 4's problem, not this one.
- **Plugin lock-in.** The Playwright Claude Code plugin lives at
  `~/.claude/plugins/cache/claude-plugins-official/playwright/`. The
  dev loop does NOT depend on it (it shells to `bunx playwright`);
  the plugin is a convenience for agents that prefer the MCP-style
  browser surface. Keeping the contract bash-level avoids coupling
  to plugin internals.

## Out of scope

- Iteration 3 — `/mcp` info surface in the dashboard.
- Iteration 4 — actual rubric spec bodies + standalone-mode seed
  path.
- Iteration 5 — `/api/activity` adapter / rpc-api adapter layer.
