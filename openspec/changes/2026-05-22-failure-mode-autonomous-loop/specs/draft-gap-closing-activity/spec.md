## ADDED Requirements

### Requirement: draft-gap-closing-activity template exists in development-vessel

The development-vessel SHALL ship a seed template `draft-gap-closing-activity` that, given a path to a failure-mode harness report, drafts and registers candidate closing-activity templates for each unclosed gap scenario.

#### Scenario: Operator runs the template against a fresh report

- **WHEN** operator invokes `bun run cli execute draft-gap-closing-activity` with `report_path=validation/failure-modes/reports/<latest>.json`
- **THEN** the template reads the report via `fs_read`
- **AND** iterates scenarios whose `emergence_class="gap"`
- **AND** for each unclosed gap dispatches a draft request to a vessel advertising `llm_completion`
- **AND** writes a `validation/failure-modes/proposals/proposal-<scenario_id>.json` with `proposal.authored_by="make_activity_autonomous"`
- **AND** calls `activity_create_variant` to register the drafted template as a candidate variant

#### Scenario: LLM returns malformed template

- **WHEN** the `llm_completion` dispatch returns JSON that does not parse into a valid `ActivityTemplate`
- **THEN** the template records `failure_mode.type="verifier_negative"` with `context.validator_id="template_parse"` for that scenario
- **AND** continues to the next scenario without aborting the run

#### Scenario: Rate limit on repeated drafts

- **WHEN** a `scenario_id` already has three or more proposal files written within the last 7 days
- **THEN** the template skips that scenario
- **AND** records the skip in the trace without emitting a new proposal

#### Scenario: Discovery returns no LLM provider

- **WHEN** no vessel advertises the `llm_completion` shape at execution time
- **THEN** the template records `failure_mode.type="cascading"` with `context.upstream_failure_mode.reason="no_llm_completion_provider"`
- **AND** the entire activity execution is marked failed

### Requirement: Template does not mutate live activity-api templates

The `draft-gap-closing-activity` template SHALL only create variants via `activity_create_variant`. It MUST NOT call `activityTemplate_update` or `activityTemplate_deprecate` on existing templates.

#### Scenario: Variant-only writes

- **WHEN** the template completes successfully for a scenario
- **THEN** the activity-api write path used is `activity_create_variant`
- **AND** no `activityTemplate_update` or `activityTemplate_deprecate` calls are recorded in the trace

### Requirement: Template does not invoke LLMs from dev-vessel TypeScript

The `draft-gap-closing-activity` template SHALL route every LLM call through a discovered vessel advertising `llm_completion`. The development-vessel TypeScript source MUST NOT import or invoke any LLM SDK directly.

#### Scenario: Static-import audit

- **WHEN** `repos/development-vessel/src/` is grepped for imports of `@anthropic-ai/sdk`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, or `openai`
- **THEN** no matches are found

### Requirement: Lift KPI consequence

Each successful `draft-gap-closing-activity` run SHALL reduce the next cycle's `manual_intervention_debt` by the number of proposals it authors with `authored_by="make_activity_autonomous"`. When `manual_intervention_debt` reaches zero and `baseline_gap_count` strictly decreases for three consecutive cycles, the progression-driver SHALL stamp `LIFT CANDIDATE` in its cycle report.

#### Scenario: Three-cycle clean run triggers lift stamp

- **WHEN** three consecutive cycle-N.json reports show `manual_intervention_debt=0` and strictly decreasing `baseline_gap_count`
- **THEN** the latest cycle report contains `lift_kpi.lift_candidate=true`

#### Scenario: One bad cycle resets the counter

- **WHEN** a cycle reports non-zero `manual_intervention_debt` after a streak of clean cycles
- **THEN** `lift_kpi.consecutive_zero_debt_cycles` resets to zero in that cycle report
