# Tasks — substrate-gap-drafter-wiring

## Phase A — Cross-check (read-only)

- [x] A.1 Locate drafter dispatch path in development-vessel + boredom-vessel.
      Probe: `grep -n draft-gap-closing-activity repos/{development,boredom}-vessel/src/`.
      Result: dispatched by boredom goal[8] with hardcoded SCENARIO_ROTATION;
      drafter reads `{{scenarios_dir}}/{{scenario_id}}.json`.
- [x] A.2 Confirm `resolveSubstrateGapWrite` emits no bus event.
      Probe: read `repos/development-vessel/src/resolvers/substrate-gap.ts`.
      Result: pure file write to `gaps/gaps.json`; no observer hook. Pull
      pattern is the correct choice for this iteration.
- [x] A.3 Confirm ribosome-vessel structure (bus-driven downstream dispatch).
      Probe: read `repos/ribosome-vessel/src/index.ts`. Result: WS-subscribed,
      dispatches via `POST /v2/impulses/resolve` with `activityDispatch`
      pointer. Pattern noted; not adopted this iteration.
- [x] A.4 Identify free boredom slot. Probe: read `AUTONOMOUS_GOALS` array.
      Result: 10 slots full; append as goal[10].
- [x] A.5 concept-db query for prior knowledge.
      Probe: `mcp__metabob__concept_search query="substrate gap"`.
      Result: no prior wiring concept; will mint one in Phase D.

## Phase B — Spec

- [x] B.1 Write `openspec/changes/2026-05-30-substrate-gap-drafter-wiring/proposal.md`.
- [x] B.2 Write `tasks.md` (this file).

## Phase C — Implementation

- [x] C.1 Create `repos/development-vessel/src/seed/drain-pending-substrate-gaps.ts`
      with the 4-task template (read_open_gaps → extract_gap_id →
      extract_gap_summary → dispatch_drafter). Acceptance probe:
      `grep -c outputShapes repos/development-vessel/src/seed/drain-pending-substrate-gaps.ts`
      returns ≥4.
- [x] C.2 Register the template in
      `repos/development-vessel/src/seed/index.ts`: add import, named
      export, and entry in `SEED_TEMPLATES`. Acceptance probe:
      `grep DRAIN_PENDING_SUBSTRATE_GAPS_TEMPLATE repos/development-vessel/src/seed/index.ts`
      returns 3 lines.
- [x] C.3 Append boredom goal[10] in `repos/boredom-vessel/src/index.ts`
      (both `AUTONOMOUS_GOALS` and `AUTONOMOUS_GOAL_TARGET_TEMPLATES`).
      Acceptance probe: `grep -c "AUTONOMOUS_GOALS\\|AUTONOMOUS_GOAL_TARGET_TEMPLATES" repos/boredom-vessel/src/index.ts`
      and visual confirm both arrays have 11 entries.
- [x] C.4 Typecheck both vessels. Probe: `cd repos/development-vessel
      && bun run typecheck` and same in `repos/boredom-vessel`. Both
      must exit 0.

## Phase D — Substrate dispatch + verification

- [x] D.1 Sync into substrate-live:
      `make -C scripts/substrate restart-development-vessel` and
      `make -C scripts/substrate restart-boredom-vessel` (or relevant
      target). Acceptance probe:
      `docker exec substrate-live journalctl -u development-vessel.service --since "1 min ago" | grep -i ready`.
- [x] D.2 Seed a synthetic substrateGap impulse via `POST
      /v2/impulses/resolve` with shape `substrateGap_write`. Acceptance
      probe: `docker exec substrate-live cat /workspace/gaps/gaps.json | jq '.[].id'`
      lists the seeded id.
- [x] D.3 Dispatch the drain via `mcp__metabob__run_goal` with
      `target_template_id: development-vessel:drain-pending-substrate-gaps`.
      Acceptance probe: returned `status` is `completed` and there is
      a child execution of `draft-gap-closing-activity`.
- [x] D.4 Mint concept describing the wiring (substrate-gap consumer
      via pull-pattern). Acceptance probe: `mcp__metabob__concept_create`
      returns a concept id.

## Phase E — Cleanup

- [x] E.1 `git status` clean except for the new files / edits listed above.
- [x] E.2 No new typecheck or lint errors.
