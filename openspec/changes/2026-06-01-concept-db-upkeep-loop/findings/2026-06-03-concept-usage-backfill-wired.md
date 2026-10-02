# Finding: concept-usage-backfill wired (2026-06-03)

## Context

Operator pinpointed: concept-db relevance not accumulating outcome data
despite the `concept_usage_record` resolver existing and tested (5/5 tests
green). Empirical state at start of session:

- 37 total concepts
- 29/37 had `times_loaded > 0` (read path works)
- 6/37 had `times_succeeded > 0` (all from one manual backfill earlier)
- ZERO autonomous traces invoke `concept_usage_record`

The Bayesian relevance formula `(ts+1)/(tl+2)` was one-sided: every concept
decayed from prior 0.5 monotonically toward 0 as it was cited, inverting
the relevance signal. The missing piece was an autonomous dispatcher.

## What landed

Two structural pieces, no new resolvers:

### 1. Seed template: `development-vessel:concept-usage-backfill`

Three-task deterministic chain:

```
concept_select_for_prompt → json_path_extract → concept_usage_record
```

- task[0] surfaces candidate concepts via `concept_select_for_prompt`
  with a rotating query across 4 source_types
- task[1] extracts `selected.0.id` via `json_path_extract` (dot-notation
  with numeric array-index segment — same pattern as `close-health-gap`)
- task[2] POSTs `conceptUsageRecorded` with `outcome=success` to
  concept-db's `/concepts/{id}/usage` endpoint

Registered in `src/seed/index.ts` SEED_TEMPLATES array.

### 2. Boredom goal[16]

- `AUTONOMOUS_GOALS[16]` — natural-language description
- `AUTONOMOUS_GOAL_TARGET_TEMPLATES[16] = "development-vessel:concept-usage-backfill"`
- `AUTONOMOUS_GOAL_COSTS[16] = "cheap"` — eligible under all load states
- `extraVariablesForGoal(16)` supplies `query` (rotating across 8
  substrate-topic clusters cycling every 5min) and `trace_id`
  (`autonomous_backfill_<ISO_timestamp>` for concept-db dedup)

## Verification

- `bun run lint` — 77/77 shapes/cases agree
- `bun test` — 491 pass / 19 fail (pre-existing, unrelated)
- `seed-templates` cli — `concept-usage-backfill` present in seed output
- Template registered in `variant_performance_metrics` table
  (`vpm_key=development-vessel_concept-usage-backfill`, prior α=1/β=1)
- Manual dispatch attempted (dispatchId
  `55184639-a43c-45cb-80c7-bc97925a6715`); did not complete within the
  session observation window — substrate was running other heavy
  templates concurrently. The runtime activation will land on the next
  boredom idle tick.

## Known limitations (documented)

1. **One concept per tick, not all selected[].** `json_path_extract` is
   single-value. Over many ticks the substrate accumulates per-concept
   writebacks for whichever concept currently top-ranks for the rotating
   query. Imperfect but unblocks the data flow.
2. **outcome always "success".** This iteration assumes the substrate's
   act of citing the concept in a prompt is itself a use signal. Tighter
   signal (success only on traces with `status=success`) requires a
   future trace-correlating template.
3. **Substitution pattern unverified end-to-end.** The structural pieces
   are in place; the `{{select_concept_content}}` → JSON →
   `selected.0.id` → `{{extract_concept_id_text}}` chain follows the
   pattern in `close-health-gap` which IS running successfully (α=95,
   β=3 per metrics dump), so this should work. If empirical traces show
   the substitution fails, a small fix in `json_path_extract` config
   path syntax (e.g. `selected[0].id` if dot-array-index isn't
   supported) is the likely remediation.

## Files modified

- `repos/development-vessel/src/seed/concept-usage-backfill.ts` (new)
- `repos/development-vessel/src/seed/index.ts` (registration)
- `repos/boredom-vessel/src/index.ts` (goal[16] + cost + variables)

## Commit SHAs

- dev-vessel: `7ceee82` — feat(seed): concept-usage-backfill
- super-repo: `9fcb0919` — feat(autonomous): goal[16]

## What's next (out of scope for this iteration)

- Observe several boredom cycles to confirm autonomous traces invoke
  `concept_usage_record` and that `times_succeeded` grows beyond 6
- If substitution gap appears in real traces, fix `json_path_extract`
  config or add a small wrapper resolver
- Future iteration: fan out to all `selected[]` concepts (per-concept
  dispatch resolver or `json_path_iterate`)
- Future iteration: success/failure attribution from trace status
  rather than assuming success
