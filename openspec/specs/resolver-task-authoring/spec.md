# resolver-task-authoring Specification

## Purpose
TBD - created by archiving change workbench-resolver-first-authoring. Update Purpose after archive.
## Requirements
### Requirement: CreateActivityDialog exposes resolver selection per task
Each task row in `CreateActivityDialog` SHALL include a resolver dropdown with options: `llm`, `bash`, `git`, `file`, `human`, `impulse-resolve`, `context-acquisition`. The default SHALL be `llm`.

#### Scenario: Default resolver is llm
- **WHEN** a new task row is added in CreateActivityDialog
- **THEN** the resolver dropdown defaults to `llm`

#### Scenario: Resolver dropdown shows all supported resolvers
- **WHEN** the resolver dropdown is opened
- **THEN** the list shows `llm`, `bash`, `git`, `file`, `human`, `impulse-resolve`, `context-acquisition` with a visual separator between `llm` and the deterministic group

### Requirement: LLM resolver shows prompt field; non-LLM resolver shows config field
When resolver is `llm`, the task row SHALL show a prompt textarea (optional, for the LLM hint/template). When resolver is anything other than `llm`, the task row SHALL show a `ConfigEditor` component for resolver configuration instead of a raw JSON textarea. The `ConfigEditor` renders structured fields for `bash`, `file`, and `git`; it falls back to a raw JSON textarea for other resolvers.

#### Scenario: Prompt field shown for llm resolver
- **WHEN** the resolver dropdown is set to `llm`
- **THEN** a prompt textarea is visible and no `ConfigEditor` is rendered

#### Scenario: Structured config shown for bash resolver
- **WHEN** the resolver dropdown is set to `bash`
- **THEN** `ConfigEditor` is rendered with `command` and `timeout` fields visible and the prompt textarea is hidden

#### Scenario: Structured config shown for file resolver
- **WHEN** the resolver dropdown is set to `file`
- **THEN** `ConfigEditor` is rendered with `path`, `operation`, and (conditionally) `content` fields and the prompt textarea is hidden

#### Scenario: Structured config shown for git resolver
- **WHEN** the resolver dropdown is set to `git`
- **THEN** `ConfigEditor` is rendered with an `operation` picker and the prompt textarea is hidden

#### Scenario: Raw JSON fallback for unstructured resolvers
- **WHEN** the resolver dropdown is set to `human`
- **THEN** `ConfigEditor` is rendered showing the raw JSON textarea fallback

#### Scenario: Switching resolver toggles displayed fields
- **WHEN** the resolver is changed from `llm` to `git`
- **THEN** the prompt textarea disappears and `ConfigEditor` appears, and vice versa when switching back

### Requirement: Config field validates JSON on blur and submission
The config textarea SHALL parse its value as JSON on blur and on form submission. If the value is non-empty and invalid JSON, an inline error badge SHALL appear. On submission, invalid JSON SHALL cause the config to be omitted from the payload with a warning toast; valid JSON SHALL be sent as a parsed object.

#### Scenario: Valid JSON config passes submission
- **WHEN** the config textarea contains `{"command": "bun test"}` and the form is submitted
- **THEN** the task payload includes `config: { command: "bun test" }` as an object

#### Scenario: Invalid JSON shows inline error
- **WHEN** the config textarea value is `{invalid}` and the field is blurred
- **THEN** an inline error indicator appears next to the config field

#### Scenario: Invalid JSON is omitted on submission
- **WHEN** the config textarea contains malformed JSON and the form is submitted
- **THEN** the task is submitted without a `config` field and a warning toast is shown

### Requirement: Task payload sent to API includes resolver and config
On form submission, each task object in the POST payload to `/v2/activities/templates` SHALL include `resolver` (always), `config` (when non-empty valid JSON), and `prompt` (when resolver is `llm` and prompt text is non-empty). Tasks with resolver `llm` and empty prompt SHALL omit the `prompt` field.

#### Scenario: Bash task payload
- **WHEN** a task has resolver `bash` and config `{"command": "bun test"}`
- **THEN** the submitted task object is `{ id, description, resolver: "bash", config: { command: "bun test" } }` with no `prompt` field

#### Scenario: LLM task payload with prompt
- **WHEN** a task has resolver `llm` and prompt "Implement the failing test"
- **THEN** the submitted task object includes `resolver: "llm"` and `prompt: { template: "Implement the failing test", variables: [] }`

#### Scenario: LLM task payload without prompt
- **WHEN** a task has resolver `llm` and an empty prompt field
- **THEN** the submitted task object includes `resolver: "llm"` with no `prompt` field

### Requirement: Task rows in CreateActivityDialog include per-task input/output shape inputs
Each task row SHALL include compact `TagInput` controls for `input_shapes` and `output_shapes`. Both SHALL default to empty arrays. The shapes SHALL be included in the task payload on submission.

#### Scenario: Per-task shapes included in submission
- **WHEN** a task row has input_shapes `["file_content"]` and output_shapes `["test_result"]`
- **THEN** the submitted task object includes `input_shapes: ["file_content"]` and `output_shapes: ["test_result"]`

#### Scenario: Empty shapes omitted from submission
- **WHEN** a task row has no input or output shapes entered
- **THEN** the submitted task object has `input_shapes: []` and `output_shapes: []`

### Requirement: Validation rules section available in CreateActivityDialog task rows
Each task row in `CreateActivityDialog` SHALL include an expandable validation section that exposes `requiredPatterns` and `forbiddenPatterns` tag inputs (matching the fields in `ValidationRulesEditor`). The section SHALL be collapsed by default.

#### Scenario: Validation section is collapsed by default
- **WHEN** a new task row is rendered
- **THEN** the validation section is collapsed and not visible

#### Scenario: Validation section expands on toggle
- **WHEN** the user clicks the validation expand toggle
- **THEN** the requiredPatterns and forbiddenPatterns tag inputs appear

#### Scenario: Validation rules included in submission
- **WHEN** a task has requiredPatterns `["test passed"]` and the form is submitted
- **THEN** the task payload includes `validation: { requiredPatterns: ["test passed"], forbiddenPatterns: [] }`

### Requirement: TaskEditor expanded panel exposes resolver selection
The expanded detail panel in `TaskEditor` SHALL NOT contain a resolver `<Select>`. Resolver selection is handled exclusively by the summary-row select (see `resolver-first-task-row` spec). The detail panel's primary content area SHALL adapt its content (prompt vs config) based on the `task.resolver` value set by the summary row. All other behavior in the detail panel (validation rules editor, retry config, input/output shape display) is unchanged.

#### Scenario: No resolver picker in expanded detail panel
- **WHEN** a task row is expanded in TaskEditor
- **THEN** no resolver `<Select>` is rendered inside the detail panel body

#### Scenario: Detail panel shows prompt editor when resolver is llm
- **WHEN** a task row is expanded and `task.resolver` is `llm`
- **THEN** `TaskPromptEditor` is visible in the detail panel

#### Scenario: Detail panel shows ConfigEditor when resolver is bash
- **WHEN** a task row is expanded and `task.resolver` is `bash`
- **THEN** `ConfigEditor` is rendered in the detail panel with bash fields; `TaskPromptEditor` is not rendered

#### Scenario: Resolver change in summary row reflects in detail panel without closing it
- **WHEN** the resolver select in the summary row is changed while the detail panel is open
- **THEN** the detail panel switches between `TaskPromptEditor` and `ConfigEditor` without collapsing

### Requirement: TaskEditor shows ConfigEditor for non-llm resolvers and TaskPromptEditor for llm
In the expanded panel of `TaskEditor`, when the selected resolver is `llm` the system SHALL render `TaskPromptEditor` (existing behavior). When the selected resolver is any non-`llm` value the system SHALL render `ConfigEditor` instead, seeded with the existing `task.config` value. Only one of the two editors SHALL be visible at a time.

#### Scenario: TaskPromptEditor shown when resolver is llm
- **WHEN** a task with `resolver: "llm"` is expanded in TaskEditor
- **THEN** `TaskPromptEditor` is visible and `ConfigEditor` is not rendered

#### Scenario: ConfigEditor shown when resolver is bash
- **WHEN** a task with `resolver: "bash"` is expanded in TaskEditor
- **THEN** `ConfigEditor` is rendered with `bash` structured fields and `TaskPromptEditor` is not rendered

#### Scenario: Switching resolver from llm to bash replaces TaskPromptEditor with ConfigEditor
- **WHEN** the resolver select is changed from `llm` to `bash`
- **THEN** `TaskPromptEditor` disappears and `ConfigEditor` with bash fields appears

#### Scenario: ConfigEditor is seeded with existing task.config on open
- **WHEN** a task with `config: { command: "bun test" }` is expanded and resolver is `bash`
- **THEN** `ConfigEditor` renders with the `command` field pre-filled as `bun test`

### Requirement: Changing resolver in TaskEditor resets config and propagates via onChange
When the resolver select value changes in `TaskEditor`, the system SHALL call `onChange` with the updated task object containing the new `resolver`, the derived `resolver_tier`, and `config: undefined`. The `resolver_tier` SHALL be derived from the resolver name using the same `resolverToTierMap` as elsewhere (`llm→llm`, `bash/git/file/exec→deterministic`, `pattern→pattern`; unknown resolvers default to `llm` tier).

#### Scenario: onChange called with updated resolver and cleared config
- **WHEN** the resolver select changes from `llm` to `git`
- **THEN** `onChange` is called with `{ ...task, resolver: "git", resolver_tier: "deterministic", config: undefined }`

#### Scenario: Switching back to llm sets resolver_tier to llm and clears config
- **WHEN** the resolver select changes from `bash` to `llm`
- **THEN** `onChange` is called with `{ ...task, resolver: "llm", resolver_tier: "llm", config: undefined }`

#### Scenario: Unknown resolver defaults resolver_tier to llm
- **WHEN** the resolver select is set to `human`
- **THEN** `onChange` is called with `resolver_tier: "llm"` (fallback for unknown resolvers)

### Requirement: ConfigEditor accepts an optional value prop for seeding
`ConfigEditor` SHALL accept an optional `value?: Record<string, unknown>` prop. When provided, internal state SHALL be initialized from that value on mount. When absent, behavior is unchanged (starts with empty state). The `key` prop in `TaskEditor` SHALL be set to `task.resolver` so ConfigEditor remounts when resolver changes.

#### Scenario: ConfigEditor initializes from value prop
- **WHEN** ConfigEditor is rendered with `value={{ command: "make test" }}` and resolver `bash`
- **THEN** the command input field is pre-filled with `make test`

#### Scenario: ConfigEditor remounts on resolver change via key prop
- **WHEN** the resolver changes from `bash` to `git` in TaskEditor
- **THEN** ConfigEditor unmounts and remounts with a fresh state seeded from the new (undefined) config

