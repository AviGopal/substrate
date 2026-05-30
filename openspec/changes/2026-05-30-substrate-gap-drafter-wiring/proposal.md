# 2026-05-30 — Wire `substrateGap_write` impulses to `draft-gap-closing-activity`

## Motivation

Today the substrate has two halves of a gap-closing loop that don't touch
each other:

1. **The signal half (working).** `substrateGap_write` resolves and
   persists open gap statements to `gaps/gaps.json`
   (`repos/development-vessel/src/resolvers/substrate-gap.ts`). The
   2026-05-30 `vessel-resolve-contract-conformance` openspec emits
   `substrateGap` impulses as vessels discover conformance shortfalls.

2. **The drafter half (working).** `draft-gap-closing-activity`
   (`repos/development-vessel/src/seed/draft-gap-closing-activity.ts`)
   takes a `scenario_id` + filesystem paths to a failure-mode JSON
   scenario, primes substrate concept memory, drafts a candidate
   gap-closing template via `llm_completion_dispatch`, writes the
   proposal, and registers it as an `activity_create_variant`. The
   2026-05-28 lift percolation confirmed it produces variants
   end-to-end.

The drafter only consumes JSON files on disk under
`validation/failure-modes/scenarios/`. It does NOT consume
`substrateGap` impulses. Boredom goal[8] hardcodes a 6-element scenario
rotation (`SCENARIO_ROTATION`). As a result, every new substrateGap
landed in `gaps/gaps.json` since 2026-05-28 has sat as inert evidence —
the closure pathway exists in name only
(`finding_2026_05_28_substrate_gap_consumer_unwired`).

This proposal closes the loop by adding a substrate-resident drainer
that reads open substrateGap impulses and dispatches
`draft-gap-closing-activity` per gap.

## Proposal

Add one new seed template and one new boredom goal slot:

### 1. New seed template `drain-pending-substrate-gaps`

Lives at `repos/development-vessel/src/seed/drain-pending-substrate-gaps.ts`.
Modelled structurally on `close-health-gap.ts` (the precedent for
"read substrate-resident report → dispatch downstream activity via
`http_fetch` → goal-host-vessel `/run-goal`").

Task graph:

1. `read_open_gaps` — `substrateGap` resolver with
   `status: "open"`, `limit: 1`. Returns the single oldest open gap
   (sorted descending by `updated_at` by the resolver; we pick the
   first; one-gap-per-tick keeps the dispatch cheap and lets Thompson
   posteriors accumulate per scenario without batch contention).
2. `extract_gap_id` — `json_path_extract` to pull
   `gaps[0].id` out of the resolver response. This becomes the
   `scenario_id` for the drafter.
3. `extract_gap_summary` — `json_path_extract` to pull
   `gaps[0].summary` for diagnostic logging downstream.
4. `dispatch_drafter` — `http_fetch` POST to
   `http://127.0.0.1:8210/run-goal` with
   `targetTemplateId: "development-vessel:draft-gap-closing-activity"`
   and variables `{ scenario_id, scenarios_dir, report_path,
   proposals_dir, source: "drain-pending-substrate-gaps" }`. The
   drafter reads the scenario JSON by `scenario_id` — same path goal[8]
   uses today, except `scenario_id` now comes from a live substrateGap
   instead of the hardcoded rotation.

No-ops cleanly when `gaps.json` is empty (the resolver returns
`gaps: []`, `extract_gap_id` returns null, and goal-host-vessel
gracefully handles a null `scenario_id` — the drafter's `fs_read`
fails fast on a missing file, which becomes a normal trace).

### 2. New boredom goal[10]

Append to `AUTONOMOUS_GOALS` in `repos/boredom-vessel/src/index.ts`:

```
"run the drain-pending-substrate-gaps activity to convert open substrateGap impulses into gap-closing template variants"
```

with `AUTONOMOUS_GOAL_TARGET_TEMPLATES[10] = "development-vessel:drain-pending-substrate-gaps"`.

This gives the drain pathway one in eleven boredom ticks. At
`OnUnitActiveSec=5min` that is roughly one drain attempt every 55
minutes — fast enough to consume the current trickle of substrateGaps
without flooding the LLM dispatch budget.

### 3. Update the existing drafter prerequisite (optional follow-up)

Once the drain works, goal[8]'s hardcoded `SCENARIO_ROTATION` becomes
redundant. We leave it in place this cycle — it still drives drafts
when no substrateGaps are open and the per-tick rate is low enough not
to fight the drain.

## Cross-check findings (Phase 2 results)

- **Drafter today** (`draft-gap-closing-activity.ts`) consumes
  `failureModeReport` + `gapScenario` (loaded by `fs_read` from
  `{{scenarios_dir}}/{{scenario_id}}.json`). It is dispatched today by
  boredom goal[8] (`AUTONOMOUS_GOAL_TARGET_TEMPLATES[8]`).
- **Boredom slot** — all 10 existing slots (0..9) are full. We append
  goal[10]; no goal is replaced.
- **`resolveSubstrateGapWrite`** (`substrate-gap.ts`) ONLY persists to
  `gaps.json`; emits no bus event. **Bus-driven trigger (the ribosome
  pattern) is therefore NOT viable for this iteration** without
  modifying the resolver to emit a lifecycle event. We instead use a
  poll-pull pattern: the new template reads open gaps from the resolver
  on each boredom tick. This is the cheaper move and matches the
  `close-health-gap` precedent exactly.
- **Ribosome precedent** (`ribosome-vessel/src/index.ts`) is the right
  *structural* template for "consumer dispatches downstream activity",
  but its WebSocket plumbing is out of scope here. The pull-model
  delivers the same outcome (substrateGap → drafter execution) with
  zero new infrastructure.
- **concept-db query** for "substrate gap" returned no prior knowledge
  on the consumer wiring problem — knowledge worth minting after
  implementation.

## Out of Scope

- Modifying `resolveSubstrateGapWrite` to emit a bus event. A future
  iteration can add `lifecycle:gap:created` and let
  `drain-pending-substrate-gaps` become event-driven; for now the poll
  pattern is sufficient.
- Marking substrateGaps as `closed` after the drafter produces a
  variant. The drafter's `activity_create_variant` is the durable
  evidence; closing the gap requires either an operator verdict or a
  separate `lifecycle:variant:promoted` consumer. Out of scope.
- Removing boredom goal[8]'s `SCENARIO_ROTATION`. Leave as a backstop.
- Bus events on the resolver. Stays a pure write today.

## Dependencies

- `draft-gap-closing-activity` already registered in activity-api
  (lift percolation 2026-05-28 confirmed).
- `substrateGap_write` resolver shipping (it is; see config.ts shape
  list).
- goal-host-vessel `/run-goal` accepts `targetTemplateId` (it does;
  see boredom-vessel `requestBody.targetTemplateId` path).

## Acceptance

The change is complete when:

1. `repos/development-vessel/src/seed/drain-pending-substrate-gaps.ts`
   exists and is exported from `src/seed/index.ts`; it appears in
   `SEED_TEMPLATES`.
2. `bun run typecheck` passes in `repos/development-vessel/` and
   `repos/boredom-vessel/`.
3. `bun run cli seed-templates` uploads the new template to
   activity-api without 403.
4. With a synthetic `substrateGap` impulse written via `POST
   /v2/impulses/resolve` (shape `substrateGap_write`), the next
   boredom dispatch of goal[10] executes the drafter against that
   gap's id and produces a new `activityTemplateVariant` trace
   visible in `executionTraceList`.
5. The end-to-end run is repeatable via `mcp__metabob__run_goal`
   targeting `development-vessel:drain-pending-substrate-gaps`; the
   returned execution shows the drafter as a child execution via
   `parent_execution_id` linkage.
