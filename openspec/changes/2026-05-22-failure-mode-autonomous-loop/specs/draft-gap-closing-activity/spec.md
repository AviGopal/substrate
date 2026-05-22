# Spec — draft-gap-closing-activity

## Capability

A development-vessel activity template that, given a path to a
failure-mode harness report, autonomously drafts and registers candidate
closing-activity templates for each unclosed gap scenario.

## Inputs

| Var | Shape | Source |
|---|---|---|
| `report_path` | string (filesystem path) | activity-arg or `lifecycle:goal` impulse |

The activity reads the report file via `fs_read`. The report is expected
to match the JSON schema written by `failure-mode-harness.ts`:

```
{
  scenarios: [
    {
      scenario_id: string,
      emergence_class: "reuse" | "new" | "gap" | "gap_accepted",
      ...
    }
  ]
}
```

## Outputs

For each gap scenario without three or more existing proposal files in
the last 7 days, the activity emits:

1. A `activityTemplateProposal` impulse — the drafted template JSON,
   wrapped per the proposal-file format
   (`{proposal: {...}, template: {...}}`) with
   `proposal.authored_by = "make_activity_autonomous"`.
2. A file at
   `validation/failure-modes/proposals/proposal-<scenario_id>.json` with
   the proposal contents.
3. An `activityTemplateVariant` impulse representing the activity-api
   variant registration.

If the variant registration fails (LLM returned malformed JSON, or
shape contract doesn't match scenario's
`expected_emergence.activity_signature`), the activity records a
`failure_mode.type = "verifier_negative"` for that gap iteration and
continues to the next scenario.

## Behaviour contract

1. Activity does NOT mutate any existing activity-api template. Only
   variant creation is permitted (write-scope; CLAUDE.md §"Variant-first
   repair").

2. Activity does NOT invoke any LLM directly from dev-vessel TypeScript.
   The LLM call goes through discovery to an external vessel advertising
   the `llm_completion` shape.

3. Activity rate-limits itself: if there are already ≥ 3 proposal files
   for a given `scenario_id` in the past 7 days, the scenario is
   skipped. This bounds variant pollution.

4. Activity is idempotent on re-run within the same cycle: scenarios
   that already have a same-cycle proposal (matched by mtime within the
   report's window) are skipped.

5. Activity produces a single `activityExecutionTrace`. Per-gap
   sub-tasks are represented as child tasks within the trace (or child
   executions if iteration is fanned out via composition).

## Failure modes

| Mode | Trigger | Effect |
|---|---|---|
| `verifier_negative` | LLM returns invalid template JSON | Skip scenario, continue |
| `safety_breach` (cycle) | Detected re-attempt of a scenario over rate-limit | Skip scenario, log |
| `cascading` | Discovery returns no `llm_completion` provider | Entire activity fails; manifest as a degraded trace |
| `budget_exhausted` | Total token spend exceeds `MAX_BUDGET_USD` (config) | Halt after current scenario |

## Lift KPI consequence

Each successful run reduces the next cycle's
`manual_intervention_debt` by the number of subagent dispatches it
replaces (i.e. the number of proposals it authors with
`authored_by: "make_activity_autonomous"`). When that count equals the
gap count and persists for three consecutive cycles, the
progression-driver stamps `LIFT CANDIDATE` and the human operator can
step back.
