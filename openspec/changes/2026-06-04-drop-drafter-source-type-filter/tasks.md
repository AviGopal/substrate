# Tasks

## SPEC (this file)
- [x] Capture baseline counts at 2026-06-04T09:25Z (in proposal.md).
- [x] Write proposal articulating why the filter is a special case.

## DEV
- [ ] Edit `repos/development-vessel/src/seed/draft-gap-closing-activity.ts:196` — remove `?source_type=...` from URL; update description text on step `prime_substrate_concepts` to reflect that all source_types are now eligible.
- [ ] Edit `repos/development-vessel/src/seed/draft-activity-from-pattern.ts:161` — same change.
- [ ] `cd repos/development-vessel && bun run lint && bun test` — both green.

## DEPLOY
- [ ] Sync dev-vessel source into substrate-live container (`docker cp` or `make restart-development-vessel`).
- [ ] Restart development-vessel unit.
- [ ] Run `bun run cli seed-templates` inside the container so the new variant lands in activity-api.

## VERIFY
- [ ] Re-run the baseline query against `/concepts/search` with no source_type and confirm count delta is positive.
- [ ] Trigger a `draft-gap-closing-activity` execution against an existing scenario; inspect the `prime_substrate_concepts` task's output impulse. Confirm:
  - source_type distribution includes at least one of `architectural_pattern_principle / extracted / human_input`
  - The user-correction concept `concept_7mzv7SQN_7JB` (`source_type=human_input`, "don't invent new tiers") is reachable to the drafter prior under appropriate relevance.
- [ ] Capture trace id + per-task impulse counts for the operator record.
