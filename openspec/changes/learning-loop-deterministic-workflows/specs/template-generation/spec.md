## MODIFIED Requirements

### Requirement: Generate resolver tasks with shape contracts
When extracting templates from execution traces, the ribosome SHALL generate resolver-based tasks with `inputShapes` and `outputShapes` for single-tool patterns.

#### Scenario: Single read tool becomes file resolver task
- **WHEN** executed task used only `read` tool
- **THEN** generated task has `resolver: "file"`, `inputShapes: ["file_read_args"]`, `outputShapes: ["file_content"]`

#### Scenario: Single bash tool becomes bash resolver task
- **WHEN** executed task used only `bash` tool
- **THEN** generated task has `resolver: "bash"`, `inputShapes: ["bash_args"]`, `outputShapes: ["stdout"]`

#### Scenario: Single git tool becomes git resolver task
- **WHEN** executed task used only `git` tool
- **THEN** generated task has `resolver: "git"`, `inputShapes: ["git_args"]`, `outputShapes: ["git_output"]`

#### Scenario: Multi-tool task remains LLM task
- **WHEN** executed task used multiple different tools
- **THEN** generated task has no `resolver` field (uses LLM)

### Requirement: Wire inferResolver to task generation
The `assembleTemplateFromExecution()` function SHALL use `inferResolver()` output to populate resolver fields on generated tasks.

#### Scenario: inferResolver returns resolver config
- **WHEN** `inferResolver([{name: "read", arguments: {...}}])` is called
- **THEN** returns `{resolver: "file", inputImpulses: ["filePath"], config: {operation: "read"}}`

#### Scenario: Resolver config applied to generated task
- **WHEN** `assembleTemplateFromExecution()` processes single-tool task
- **THEN** task includes `resolver`, `inputShapes`, `outputShapes`, and `config` from `inferResolver()`

#### Scenario: Prompt kept as fallback
- **WHEN** generating resolver-based task
- **THEN** task also includes `prompt` field for LLM fallback when resolver unavailable

### Requirement: Infer output shapes from tool results
The template generator SHALL infer `outputShapes` based on tool types and result patterns.

#### Scenario: Read tool produces file_content shape
- **WHEN** read tool succeeds
- **THEN** output shape is `file_content`

#### Scenario: Bash tool produces stdout shape
- **WHEN** bash tool succeeds
- **THEN** output shape is `stdout` (plus `stderr` if present)

#### Scenario: Write tool produces file_written shape
- **WHEN** write tool succeeds
- **THEN** output shape is `file_written`

#### Scenario: Git tool produces git_output shape
- **WHEN** git tool succeeds
- **THEN** output shape is `git_output`
