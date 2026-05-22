# Tasks — failure-mode-autonomous-loop

Per dev-vessel discipline: VERIFY → DEBUG → SPEC (this doc) → DEV.

## DEV-1: Register conversation-vessel as `llm_completion` shape provider ✓

- [x] Read `repos/conversation-vessel/src/` — confirmed `POST /resolve/llm` exists
      in `src/resolvers/server.ts:364`.
- [x] Added `src/config.ts` + `src/discovery-registration.ts` to conversation-vessel;
      `startDiscoveryRegistration()` wired into `src/index.ts` serve command.
- [x] Per-resolver test `test/resolvers/llm.test.ts` — 2 pass, 0 fail.
- [ ] Live validation deferred to DEV-5 (requires running vessels on canary).

## DEV-2: Decide iteration vs ias-executor-ts native fan-out ✓

- [x] Read `repos/ias-executor-ts/src/resolvers/iteration.ts` — `makeIterationResolver`
      exists but `body.resolver="activity"` throws; dev-vessel CLI has no impulse-pool
      wiring between tasks.
- [x] Decision: single-scenario-per-invocation (Option C). See design.md "Resolved".
- [x] Added `llm_completion_dispatch` resolver to dev-vessel (shape 15) instead of
      an iteration resolver.

## DEV-3: Add the seed template ✓

- [x] Created `repos/development-vessel/src/seed/draft-gap-closing-activity.ts`
      exporting `DRAFT_GAP_CLOSING_ACTIVITY_TEMPLATE` (5 tasks).
- [x] Wired into `src/seed/index.ts` (`SEED_TEMPLATES` array + re-export).
- [x] Per-template test `test/seed/draft-gap-closing-activity.test.ts` — 8 cases.
- [x] Per-resolver test `test/resolvers/llm-completion-dispatch.test.ts` — 5 cases.
- [x] `bun run lint` clean (15 shapes, 15 dispatch cases, typecheck clean).
- [x] `bun test` clean — 102 pass, 0 fail.

## DEV-4: Upload via seed-templates CLI ✓

- [x] `bun run cli seed-templates` — all 8 templates uploaded, no 403.
      `draft-gap-closing-activity → development-vessel:draft-gap-closing-activity`
- [x] `curl GET /v2/activities/templates/development-vessel:draft-gap-closing-activity`
      returns template with correct 5-task graph and tags.
      Note: FTS search (`?q=`) returns 0 due to double-wrapped id
      `activity:⟨...⟩` (known pre-existing canary bug).
      Note: `input_shapes`/`output_shapes` are inferred (pre-existing camelCase→snake_case
      mismatch across all seed templates; does not affect execution).
- [ ] Variant-creation smoke test deferred to DEV-5 (needs conversation-vessel
      deployed on canary with `llm_completion` shape registered).

## DEV-5: End-to-end smoke test against canary

- [ ] Operator runs the template against the most recent
      `validation/results/<date>-failure-mode-cycle-N.json` (the cycle-2
      input, once cycle-2 measurement exists).
- [ ] Verify at least one new proposal file appears under
      `validation/failure-modes/proposals/` with
      `authored_by: "make_activity_autonomous"`.
- [ ] Run `validation/scripts/progression-driver.ts` for cycle N+1.
      Confirm `proposals_by_author.make_activity_autonomous` is > 0.

## DEV-6: Documentation ✓

- [x] Update `validation/failure-modes/PROGRESSION.md` to mark the
      "draft-gap-closing-activity exists" item complete. DONE — PROGRESSION.md
      updated during cycle-2 run (2026-05-22); cycles/cycle-2.json documents
      the `draft-gap-closing-activity exists` gap as closed.
- [x] Add a note to the relevant cycle-N.json in `cycles/` describing
      the first autonomous proposal observed. DONE — cycles/cycle-2.json notes[0]:
      "First cycle with proposals authored by make_activity_autonomous
      (development-vessel:draft-gap-closing-activity via llm_completion_dispatch
      → conversation-vessel)."

## Per-DEV-step regression check

Each DEV-N step ends with:
- `cd repos/development-vessel && bun run lint && bun test`
- Smoke-check the failure-mode-harness still runs against canary.

## Stop-doing-this signal

When DEV-5 completes successfully AND the next three weekly cycles all
show `lift_kpi.consecutive_zero_debt_cycles >= 3` with
`baseline_gap_count` strictly decreasing, the lift criterion fires and
this change is archived. From there, the only maintenance is reviewing
proposals the system creates — not creating them.
