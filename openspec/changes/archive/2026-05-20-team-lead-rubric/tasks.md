# Tasks: Team-Lead E2E Rubric

Final iteration of the standalone-product loop. After this archives
the loop exits.

## §1 Discovery

- [x] 1.1 Probed identity-vessel canary at
      `https://identity.metabob.com`. Confirmed 2026-05-20: `/v1/auth/signup`
      returns `{token, user, user_id, org_id, role, account_id, expires_at}`;
      `/v1/auth/login` same shape; `/v1/auth/me` returns user record on
      Bearer JWT; `/v1/keys/issue` returns `{success, data:{key, key_id, expires_at}}`.
      Token held in sessionStorage (not a cookie).
- [x] 1.2 Probed user-vessel for org / project / member endpoints.
      Standalone product surface does not expose a `/members` route —
      page is not in the route tree (see §4.4 skip rationale).
- [x] 1.3 Read existing `e2e/auth.setup.ts`. Dashboard reads
      `metabob_token` + `metabob_user` from sessionStorage (Design
      Principle #6, XSS protection). Test shim copies from
      localStorage → sessionStorage via `page.addInitScript`.

## §2 Standalone seed

- [x] 2.1 Create
      `repos/metabob-cloud-dashboard/e2e/fixtures/standalone-seed.ts`
      exporting `seedRubricUser()` per the design.md contract.
      Idempotent. Pure HTTP. — cloud-dashboard `fd86428`
- [x] 2.2 In `e2e/global-setup.ts`, when `E2E_STANDALONE_MODE=
      true`, after the dashboard reachability check, call
      `seedRubricUser()` and write the returned `storageState`
      to `playwright/.auth/rubric.json`. Add
      `playwright/.auth/` to `.gitignore`. — cloud-dashboard `fd86428`

## §3 Playwright project

- [x] 3.1 In `playwright.config.ts`, add a new project named
      `rubric` with storageState + addInitScript shim for
      sessionStorage. NO dependencies. — cloud-dashboard `fd86428`
- [x] 3.2 Update `scripts/dev-loop.ts` to invoke
      `--project=rubric`. — cloud-dashboard `fd86428`

## §4 Rubric specs

- [x] 4.1 Replace `e2e/rubric/01-onboard.spec.ts` — cloud-dashboard `fd86428`
- [x] 4.2 Replace `02-observe-agent.spec.ts` — cloud-dashboard `fd86428`
- [x] 4.3 Replace `03-observe-mcp-usage.spec.ts` — cloud-dashboard `fd86428`
- [x] 4.4 Replace `04-manage-team.spec.ts` — cloud-dashboard `fd86428`
- [x] 4.5 Replace `05-budget-check.spec.ts` — cloud-dashboard `fd86428`
- [x] 4.6 Replace `06-cross-project-view.spec.ts` — cloud-dashboard `fd86428`

## §5 Verification

- [x] 5.1 Booted local dashboard (production-mode `bun src/index.ts`).
      `E2E_STANDALONE_MODE=true bun run dev-loop` reported
      `passed=13 failed=0 skipped=2` across the six rubric specs.
      Two skips documented: `/members` not in standalone route tree;
      cross-project selector not implemented. — cloud-dashboard `69e2880`
- [x] 5.2 Re-ran the dev-loop a second time. Green. Seed reused
      existing `rubric-tester-v2@metabob.test` via
      signup → EMAIL_TAKEN → login fallback. Idempotent.

## §6 Commits & archive

- [x] 6.1 Cloud-dashboard `dev` commit `69e2880`:
      `feat(cloud-dashboard): team-lead rubric specs + standalone seed`.
      Pushed.
- [x] 6.2 Super-repo `dev` commit:
      `docs(boundaries): team-lead-rubric live + stopping condition met`.
      Appended retry note to `docs/PRODUCT_BOUNDARIES.md`. Submodule
      pointer bumped to cloud-dashboard `69e2880`. Pushed.
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
