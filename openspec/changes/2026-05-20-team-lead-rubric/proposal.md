# Proposal: Team-Lead E2E Rubric

## Why

The final plan item of the standalone-product loop. Iterations 1-4
shipped the boundary doc, the dev-loop scaffolding, the `/mcp`
route, and the rpc-api BFF adapter. The six rubric specs at
`repos/metabob-cloud-dashboard/e2e/rubric/` are still
`test.skip(true, ...)` placeholders.

**Filling them in is blocked by `e2e/auth.setup.ts`** — the existing
Playwright setup project requires a seeded test user, logs in via
the UI, and stores the session cookie. Without it, no
authenticated spec works. With it, every spec requires
identity-vessel + user-vessel + a seed pipeline. The rubric needs
to run in **standalone mode**: against identity-vessel +
user-vessel only, with seed performed via HTTP (no UI loop), so
MiniBob can drive the loop against canary without a manual
browser session.

This change ships:

1. A non-UI seed helper that creates the test user + test org +
   one test API key via identity-vessel HTTP endpoints
   (`/v1/auth/signup` or equivalent, `/v1/keys/issue`). No
   browser. Idempotent: existing test user is fine.
2. A second Playwright project `rubric` in `playwright.config.ts`
   that has NO `dependencies: ["setup"]` and uses a
   programmatically-stored auth state set up by the new seed
   helper.
3. Real bodies for all six rubric specs, exercising the
   team-lead journey end-to-end against the local dashboard
   pointed at canary backends.
4. A small extension to the dev-loop script so it runs the
   `rubric` project specifically (already does via
   `--project=chromium --no-deps`; verify still correct).

After this lands, `bun run dev-loop` runs six **passing** specs
end-to-end against canary, the stopping condition is met, and the
loop exits.

## What Changes

1. **New file**:
   `repos/metabob-cloud-dashboard/e2e/fixtures/standalone-seed.ts`
   — HTTP-only seed:
   - Idempotent signup of a test user
     (`rubric-tester+<org>@metabob.test`) against
     identity-vessel canary.
   - Login → JWT.
   - Create / reuse an API key.
   - Returns a Playwright `storageState` JSON (cookies + the
     localStorage entries the dashboard expects).
   - The returned state can be written to `playwright/.auth/
     rubric.json` and consumed by the rubric project.

2. **`playwright.config.ts`**: add a new `rubric` project with
   `use: { storageState: "playwright/.auth/rubric.json" }`,
   `testDir: "./e2e/rubric"`, `testMatch: "*.spec.ts"`, and NO
   `dependencies`. The standalone-seed runs in
   `globalSetup` when `E2E_STANDALONE_MODE=true`: after the
   dashboard reachability check, seed via HTTP and write
   `playwright/.auth/rubric.json`.

3. **Update `e2e/global-setup.ts`**: in standalone mode, also
   invoke `standalone-seed.ts` instead of just early-returning.

4. **Six rubric spec bodies** — real test code under
   `e2e/rubric/`. Each spec asserts the team-lead can observe
   the corresponding flow without errors. See design.md for
   per-spec contract.

5. **Update `dev-loop.ts`** if needed (currently invokes
   `--project=chromium --no-deps`; switch to `--project=rubric`
   so the new project is exercised).

6. **Spec capability** `team-lead-rubric` documenting the six
   flows + the standalone-seed contract.

## Non-Goals

- Cross-browser rubric. The rubric runs only on chromium for
  speed; browser-parity is out of scope.
- Activity-impulse-mode rubric. The rubric runs in standalone
  mode only; research-mode is a separate concern.
- Mocking rpc-api. Specs hit canary `ide.metabob.com`. If canary
  is down the rubric fails legitimately.
- Modifying rpc-api / mcp / identity-vessel / user-vessel.
- Browser screenshots / pixel diffing. The rubric uses
  semantic assertions only.

## Success Criteria

- `bun run dev-loop` against a locally-running dashboard exits 0
  with `passed: 6, failed: 0, skipped: 0`.
- `e2e/results/last-run.json` reports all six specs as
  `status: "passed"`.
- The standalone seed is idempotent: running it twice produces
  identical state.
- Capability spec archived at
  `openspec/specs/team-lead-rubric/spec.md`.
- The standalone-product loop's stopping condition is met:
  all five plan items archived (boundaries, playwright loop,
  /mcp surface, rpc-api adapter, rubric), rubric specs green
  against canary, dashboard demonstrably usable end-to-end
  without activity-impulse dependencies. **Loop exits after
  this iteration archives.**
