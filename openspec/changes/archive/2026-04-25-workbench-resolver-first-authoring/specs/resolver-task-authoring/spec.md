## ADDED Requirements

### Requirement: CreateActivityDialog exposes resolver selection per task
Each task row in `CreateActivityDialog` SHALL include a resolver dropdown with options: `llm`, `bash`, `git`, `file`, `human`, `impulse-resolve`, `context-acquisition`. The default SHALL be `llm`.

#### Scenario: Default resolver is llm
- **WHEN** a new task row is added in CreateActivityDialog
- **THEN** the resolver dropdown defaults to `llm`

#### Scenario: Resolver dropdown shows all supported resolvers
- **WHEN** the resolver dropdown is opened
- **THEN** the list shows `llm`, `bash`, `git`, `file`, `human`, `impulse-resolve`, `context-acquisition` with a visual separator between `llm` and the deterministic group

### Requirement: LLM resolver shows prompt field; non-LLM resolver shows config field
When resolver is `llm`, the task row SHALL show a prompt textarea (optional, for the LLM hint/template). When resolver is anything other than `llm`, the task row SHALL show a config textarea for JSON resolver configuration instead of the prompt textarea.

#### Scenario: Prompt field shown for llm resolver
- **WHEN** the resolver dropdown is set to `llm`
- **THEN** a prompt textarea is visible and the config textarea is hidden

#### Scenario: Config field shown for non-llm resolver
- **WHEN** the resolver dropdown is set to `bash`
- **THEN** a config JSON textarea is visible and the prompt textarea is hidden

#### Scenario: Switching resolver toggles displayed fields
- **WHEN** the resolver is changed from `llm` to `git`
- **THEN** the prompt textarea disappears and the config textarea appears, and vice versa when switching back

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
