# Design — failure-mode-autonomous-loop

## Where the seed template lives

```
repos/development-vessel/src/seed/draft-gap-closing-activity.ts
```

Exports `DRAFT_GAP_CLOSING_ACTIVITY_TEMPLATE: ActivityTemplate` (from
`@avigopal/ias-executor-ts`). Re-exported through
`src/seed/index.ts`; added to `SEED_TEMPLATES` array so
`bun run cli seed-templates` uploads it.

## Why a seed template and not new resolvers

The dev-vessel CLAUDE.md is explicit: TypeScript is for deterministic
resolvers + dispatch only; orchestration goes in activity templates.
The loop is pure composition over existing resolvers — no new resolver
is required:

| Step | Resolver | Owner |
|------|----------|-------|
| 1 | `fs_read` | dev-vessel |
| 2 | `fs_read` | dev-vessel |
| 3 | `fs_read` (loop) | dev-vessel |
| 4 | discovered LLM | external vessel (conversation-vessel) |
| 5 | `fs_write` | dev-vessel |
| 6 | `activity_create_variant` | dev-vessel |

The LLM step (4) is dispatched via discovery, not invoked inline,
satisfying the "no LLM in vessel code" rule.

## Task graph (sketch)

```
{
  id: "draft-gap-closing-activity",
  name: "Draft gap-closing activity proposals",
  description: "Read failure-mode report; for each unclosed gap, draft a
                candidate activity template and register as variant.",
  tags: ["lift.autonomous_loop", "validation.failure_modes"],
  input_shapes: ["failureModeReport"],
  output_shapes: ["activityTemplateProposal", "activityTemplateVariant"],
  tasks: [
    {
      id: "read-report",
      resolver: "fs_read",
      config: { path: "{{var.report_path}}" },
      output_shape: "failureModeReport"
    },
    {
      id: "iterate-gaps",
      resolver: "iteration",
      config: { source_shape: "failureModeReport.scenarios",
                filter: "emergence_class == 'gap'" },
      output_shape: "gapScenario[]"
    },
    {
      id: "read-scenario-files",
      resolver: "fs_read",
      config: { path_template:
                "validation/failure-modes/scenarios/{{scenario_id}}.json" },
      output_shape: "scenarioDetail"
    },
    {
      id: "draft-template-via-llm",
      resolver: "discovered:llm_completion",
      config: { prompt_template: "<draft-template prompt>",
                impulses: ["scenarioDetail"] },
      output_shape: "draftedTemplate"
    },
    {
      id: "write-proposal",
      resolver: "fs_write",
      config: { path_template:
                "validation/failure-modes/proposals/proposal-{{scenario_id}}.json",
                content_shape: "draftedTemplate",
                wrapper: { proposal: {
                  authored_by: "make_activity_autonomous",
                  registration_status: "draft" } } },
      output_shape: "activityTemplateProposal"
    },
    {
      id: "register-as-variant",
      resolver: "activity_create_variant",
      config: { parent_template_id: null,
                variant: "{{draftedTemplate}}" },
      output_shape: "activityTemplateVariant"
    }
  ]
}
```

**Resolved (DEV-2, 2026-05-22):**

ias-executor-ts already ships `makeIterationResolver` at
`src/resolvers/iteration.ts`. However, `body.resolver = "activity"` is
explicitly blocked (sub-activity dispatch not yet ported — spec §4 note).
The dev-vessel CLI's `run-activity` command also has no impulse-pool
wiring between tasks, so iteration at the template level would only work
when ias-executor-ts `GoalHost` is the executor.

**Decision — single-scenario-per-invocation (Option C):**
Rather than iteration, the seed template runs once per scenario, with
the operator (or a future cron/scheduler) supplying `--var scenario_id=<id>`.
This keeps the task graph linear (5 tasks), uses only resolvers that
work in the current `run-activity` CLI path, and produces at least one
`authored_by: "make_activity_autonomous"` proposal per invocation.
Iteration can be added in a follow-up when GoalHost dispatch is wired.

**New resolver: `llm_completion_dispatch`** added to dev-vessel
(`src/resolvers/llm-completion-dispatch.ts`, shape 15 in config). It:
1. Queries discovery for `llm_completion` shape.
2. Picks the highest-health-score vessel.
3. POSTs to that vessel's `resolve_endpoint` (conversation-vessel `/resolve/llm`).
4. Returns `llm_completion_result` or `structuredError` with failure_mode tag.

This keeps LLM calls OUT of dev-vessel TypeScript while still dispatching
through discovery — satisfying the CLAUDE.md layering rule.

## LLM dispatch via discovery

Step 4 (`discovered:llm_completion`) is the load-bearing piece. Today,
no vessel under `repos/` advertises an `llm_completion` shape:

- conversation-vessel has `@ai-sdk/anthropic` + `@ai-sdk/openai` but
  exposes `/resolve/llm` rather than registering a discoverable shape.
- minibob has LLM resolvers but is the substrate we're migrating AWAY
  from.

Two paths:

**Path 1** — register conversation-vessel's `/resolve/llm` endpoint with
discovery-vessel under shape `llm_completion`. Smallest delta; existing
code, just add discovery registration.

**Path 2** — add a new LLM-tier resolver to dev-vessel itself. This
violates the "no LLM in vessel code" rule and is rejected by CLAUDE.md.

Choose Path 1.

## Trace shape

Each execution of the seed template produces a normal
`activityExecutionTrace` written via the standard ias-executor-ts
TraceSink. The trace carries:

- `output_impulse_ids` pointing at the proposal files created.
- `composition_chain` empty (top-level execution).
- `failure_mode` set if any step failed (likely `verifier_negative` if
  the LLM returns invalid JSON, or `cascading` if discovery couldn't
  find an llm_completion provider).

The failure-mode harness can be re-pointed at these proposals' parent
template; over time, Thompson Sampling promotes the variants whose
proposals actually close gaps when the harness re-measures.

## Risks

- **LLM produces invalid template JSON.** Mitigated by step 6's
  `activity_create_variant` validation (rejects malformed templates) and
  by the harness's `matchSignature` check (rejects proposals whose
  shape contract doesn't match the scenario's
  `expected_emergence.activity_signature`).
- **LLM hallucinates resolver names.** The drafted template might
  reference resolvers that don't exist. Detection comes the first time
  someone tries to execute the variant — the executor returns
  `unknown shape`. Counts as a failure trace; Thompson penalty applies;
  the loop discards the bad variant naturally.
- **Variant pollution** — dozens of bad LLM drafts in activity-api.
  Bound this by adding a quota: the seed template refuses to create
  more than 3 variants per scenario per week. (Implemented as a
  precondition check in task 1: read existing proposal files, skip
  scenarios with ≥ 3 prior attempts in last 7 days.)

## Open questions — all resolved (DEV-2/DEV-3, 2026-05-22)

1. **Iteration** → see above; single-scenario-per-invocation chosen.
2. **conversation-vessel discovery registration** → added
   `src/config.ts` + `src/discovery-registration.ts` to conversation-vessel;
   `startDiscoveryRegistration()` called in `serve` command on startup;
   advertises `llm_completion` with `resolve_endpoint = /resolve/llm`.
3. **`activity_create_variant` parent_template_id=null** → resolver at
   `src/resolvers/activity-create-variant.ts:10-14` uses `pointer.parentTemplateId`
   optionally; when omitted the template is posted without
   `parent_template_id`. Confirmed: null/omitted is accepted.
