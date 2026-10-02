# 2026-05-22 — Failure-Mode Autonomous Loop (development-vessel)

## Motivation

The failure-mode validation harness (`validation/scripts/failure-mode-harness.ts`,
landed 2026-05-22) reads the 63-mode failure matrix from
`validation/failure-modes/scenarios/` and reports per-cycle how many
scenarios end as `gap` — i.e. no existing or emergent activity addresses
them. The cycle-0 baseline against canary returned **6/6 gaps**, confirming
that the system today does NOT autonomously close failure-mode gaps.

The progression-driver (`validation/scripts/progression-driver.ts`)
quantifies how much manual work each cycle requires
(`manual_intervention_debt`) and stamps `LIFT CANDIDATE` when three
consecutive cycles report zero debt while gap count strictly decreases.

For `manual_intervention_debt` to fall to zero, the substrate needs an
activity that, given a failure-mode report, autonomously drafts and
registers candidate closing-activity templates. Per development-vessel
discipline (`repos/development-vessel/CLAUDE.md`), this activity belongs
in development-vessel as a seed template, NOT in minibob's embedded
templates. The execution path is ias-executor-ts (per
`openspec/changes/2026-05-19-ias-executor-as-canonical-host`).

## Proposal

Add a seed template `draft-gap-closing-activity` to development-vessel
that:

1. Loads the latest failure-mode-report.json (via `fs_read`).
2. Enumerates `emergence_class='gap'` scenarios with no corresponding
   proposal file yet.
3. For each, loads the scenario JSON + its `subagent_investigation` block
   (via `fs_read`).
4. Discovers a vessel that advertises a `llm_completion` shape (via
   discovery-vessel `vesselCapability` lookup) and dispatches the draft
   request through that vessel's `POST /v2/impulses/resolve` — keeping
   the LLM call OUT of dev-vessel TypeScript per layering discipline.
5. Writes the resulting template JSON to
   `validation/failure-modes/proposals/proposal-<scenario_id>.json` with
   `authored_by: "make_activity_autonomous"`.
6. Calls `activity_create_variant` to register the drafted template as a
   candidate variant in activity-api (write-scope sufficient).

Each successful invocation reduces that cycle's
`manual_intervention_debt` by one (replaces a subagent dispatch with an
autonomous activity execution).

## Out of Scope

- Operator-gated registrations (admin scope to mutate live templates).
  Variant creation is sufficient for the lift signal — Thompson sampling
  promotes the better variant over time.
- New infrastructure required by individual closing-activity proposals
  (e.g. `POST /v2/activities/execution-traces/correct` for FM-43, durable
  outbox in ias-executor-ts for FM-44, input-signature fingerprint for
  FP-11). Each is tracked under its own openspec when scheduled.
- Expanding the failure-mode matrix beyond the 6 seed scenarios. The
  loop closes existing gaps; new scenarios are added as separate work.
- Cron / scheduler. For now the seed template runs on operator demand
  via `bun run cli execute draft-gap-closing-activity`. Scheduling is a
  later iteration.

## Non-Goals

This proposal does NOT claim lift. It builds one of the mechanisms
required for lift. The `LIFT CANDIDATE` stamp can only fire after this
template ships AND runs for three consecutive weekly cycles with
strictly-decreasing gap count AND zero manual intervention.

## Dependencies

- Some vessel must advertise `llm_completion` (or equivalent). Candidate:
  conversation-vessel (`repos/conversation-vessel`) which already wraps
  `@ai-sdk/anthropic` and `@ai-sdk/openai`. If not currently advertised
  as a shape via discovery-vessel registration, that registration must be
  added first.
- The failure-mode harness and progression-driver already exist on disk
  in `validation/scripts/`. The seed template reads their output, not
  the other way round.

## Acceptance

The change is complete when:

1. `repos/development-vessel/src/seed/draft-gap-closing-activity.ts`
   exists and is exported from `src/seed/index.ts`.
2. `bun run lint` passes (typecheck + shape-dispatch agreement).
3. `bun test` passes; the new template has a per-template unit test
   that validates its task graph (input/output shape contract).
4. `bun run cli seed-templates` uploads it to activity-api without 403.
5. Operator invocation `bun run cli execute draft-gap-closing-activity`
   produces at least one new proposal file under
   `validation/failure-modes/proposals/` with
   `authored_by: "make_activity_autonomous"`.
6. Running `validation/scripts/progression-driver.ts` against the next
   cycle's harness report shows the autonomous proposal counted in
   `proposals_by_author.make_activity_autonomous`.
