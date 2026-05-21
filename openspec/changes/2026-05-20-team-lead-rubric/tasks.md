# Tasks: Team-Lead E2E Rubric

Final iteration of the standalone-product loop. After this archives
the loop exits.

## §1 Discovery

- [ ] 1.1 Probe identity-vessel canary at
      `https://identity.metabob.com` for the signup / login
      contract. Confirm: endpoint paths, request shape, JWT cookie
      name set by the dashboard.
- [ ] 1.2 Probe user-vessel for org / project / member endpoints
      used during onboard + cross-project flows.
- [ ] 1.3 Read the existing `e2e/auth.setup.ts` to learn what
      `storageState` shape the rubric needs to mimic.

## §2 Standalone seed

- [ ] 2.1 Create
      `repos/metabob-cloud-dashboard/e2e/fixtures/standalone-seed.ts`
      exporting `seedRubricUser()` per the design.md contract.
      Idempotent. Pure HTTP.
- [ ] 2.2 In `e2e/global-setup.ts`, when `E2E_STANDALONE_MODE=
      true`, after the dashboard reachability check, call
      `seedRubricUser()` and write the returned `storageState`
      to `playwright/.auth/rubric.json`. Add
      `playwright/.auth/` to `.gitignore`.

## §3 Playwright project

- [ ] 3.1 In `playwright.config.ts`, add a new project named
      `rubric` with:
      ```ts
      {
        name: "rubric",
        testDir: "./e2e/rubric",
        use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/rubric.json" },
        // NO dependencies — explicitly standalone
      }
      ```
- [ ] 3.2 Update `scripts/dev-loop.ts` to invoke
      `--project=rubric` (replacing the current
      `--project=chromium --no-deps`).

## §4 Rubric specs

- [ ] 4.1 Replace `e2e/rubric/01-onboard.spec.ts` body per
      design.md. Assert API Keys page renders, create-key UX
      works, revoke works.
- [ ] 4.2 Replace `02-observe-agent.spec.ts`: assert
      `/execution-traces` route shows the standalone-mode
      placeholder and that the nav entry is absent.
- [ ] 4.3 Replace `03-observe-mcp-usage.spec.ts`: visit `/mcp`,
      verify tabs, exercise Usage tab against the seeded key,
      assert either success cards or the documented error card.
- [ ] 4.4 Replace `04-manage-team.spec.ts`: visit team page,
      assert seeded user listed. Best-effort exercise invite if
      UI exists.
- [ ] 4.5 Replace `05-budget-check.spec.ts`: assert
      `/usage-analytics` placeholder OR locate a non-gated
      budget surface.
- [ ] 4.6 Replace `06-cross-project-view.spec.ts`: best-effort
      project-selector exercise or org-scope assertion.

## §5 Verification

- [ ] 5.1 Boot a local dashboard. Run
      `E2E_STANDALONE_MODE=true bun run dev-loop`. Confirm
      `last-run.json` reports `passed: 6, failed: 0,
      skipped: 0`. If any spec fails because of partial UI
      (e.g., team / project routes don't exist yet), document
      and mark the spec as conditional (`test.skip(...)` with
      a clear reason) — don't force a green that lies.
- [ ] 5.2 Run the dev-loop a second time. Confirm green. Confirm
      seed remained idempotent (no new user / no new org).

## §6 Commits & archive

- [ ] 6.1 Cloud-dashboard `dev` commit:
      `feat(cloud-dashboard): team-lead rubric specs + standalone seed`.
      Push.
- [ ] 6.2 Super-repo `dev` commit:
      `docs(boundaries): team-lead-rubric spec + loop stopping condition met`.
      Append a "Stopping condition met" note to
      `docs/PRODUCT_BOUNDARIES.md` with the date + final SHAs.
      Bump submodule pointer. Push.
- [ ] 6.3 Archive: move change dir to
      `openspec/changes/archive/2026-05-20-team-lead-rubric/`
      and lift spec to `openspec/specs/team-lead-rubric/spec.md`.

## §7 Exit the loop

- [ ] 7.1 Confirm all five plan items from the original /loop
      input are archived under `openspec/changes/archive/`:
      - 2026-05-20-standalone-product-boundaries
      - 2026-05-20-playwright-dev-loop
      - 2026-05-20-mcp-info-surface
      - 2026-05-20-rpc-api-mcp-usage-adapter
      - 2026-05-20-team-lead-rubric
- [ ] 7.2 At end of the apply turn, omit `ScheduleWakeup` so
      the dynamic loop terminates cleanly.
