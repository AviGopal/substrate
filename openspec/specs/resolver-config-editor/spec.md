# resolver-config-editor Specification

## Purpose
TBD - created by archiving change workbench-resolver-first-authoring. Update Purpose after archive.
## Requirements
### Requirement: ConfigEditor renders structured bash config
When the resolver is `bash`, `ConfigEditor` SHALL render a `command` textarea and a `timeout` number input instead of a raw JSON textarea. The `command` field SHALL be required (non-empty) for the config to be non-empty. The `timeout` SHALL default to empty (no constraint) and accept positive integers only.

#### Scenario: Bash command field visible
- **WHEN** `resolver` prop is `bash`
- **THEN** a labeled `command` textarea is rendered and no raw JSON textarea is visible

#### Scenario: Bash timeout field visible
- **WHEN** `resolver` prop is `bash`
- **THEN** a labeled `timeout` number input is rendered alongside the command field

#### Scenario: Bash config produces correct object
- **WHEN** `command` is `bun test` and `timeout` is `5000`
- **THEN** `onChange` is called with `{ command: "bun test", timeout: 5000 }`

#### Scenario: Bash config omits timeout when empty
- **WHEN** `command` is `bun test` and `timeout` input is empty
- **THEN** `onChange` is called with `{ command: "bun test" }` (no `timeout` key)

### Requirement: ConfigEditor renders structured file config
When the resolver is `file`, `ConfigEditor` SHALL render a `path` text input, an `operation` select (options: `read`, `write`, `edit`, `append`), and a `content` textarea. The `content` textarea SHALL be hidden when `operation` is `read`.

#### Scenario: File path field visible
- **WHEN** `resolver` prop is `file`
- **THEN** a labeled `path` text input is rendered

#### Scenario: File operation picker visible
- **WHEN** `resolver` prop is `file`
- **THEN** an `operation` select with options read/write/edit/append is rendered

#### Scenario: Content field hidden for read operation
- **WHEN** `resolver` is `file` and `operation` is `read`
- **THEN** the `content` textarea is not rendered

#### Scenario: Content field visible for write operation
- **WHEN** `resolver` is `file` and `operation` is `write`
- **THEN** a labeled `content` textarea is rendered

#### Scenario: File config produces correct object
- **WHEN** `path` is `src/index.ts`, `operation` is `read`, and `content` is empty
- **THEN** `onChange` is called with `{ path: "src/index.ts", operation: "read" }`

### Requirement: ConfigEditor renders structured git config
When the resolver is `git`, `ConfigEditor` SHALL render an `operation` select with options: `diff`, `log`, `commit`, `push`, `status`. No free-text fields are required beyond the operation picker.

#### Scenario: Git operation picker visible
- **WHEN** `resolver` prop is `git`
- **THEN** an `operation` select with options diff/log/commit/push/status is rendered

#### Scenario: Git config produces correct object
- **WHEN** `operation` is `diff`
- **THEN** `onChange` is called with `{ operation: "diff" }`

### Requirement: ConfigEditor falls back to raw JSON for unknown resolvers
When the resolver is anything other than `bash`, `file`, or `git` (e.g., `human`, `impulse-resolve`, `context-acquisition`, or any future resolver), `ConfigEditor` SHALL render a raw JSON textarea identical to the previous inline behavior. JSON validation on blur and submission SHALL follow the existing rules in the `resolver-task-authoring` spec.

#### Scenario: Raw JSON shown for human resolver
- **WHEN** `resolver` prop is `human`
- **THEN** a raw JSON textarea is rendered with placeholder `{"…"}`

#### Scenario: Raw JSON shown for unknown resolver
- **WHEN** `resolver` prop is `my-custom-resolver`
- **THEN** a raw JSON textarea is rendered

### Requirement: ConfigEditor resets state on resolver change
When the `resolver` prop changes, `ConfigEditor` SHALL reset its internal field values to defaults so stale field values from a previous resolver type are not carried forward.

#### Scenario: Switching from bash to git clears command
- **WHEN** `resolver` changes from `bash` to `git`
- **THEN** internal bash command and timeout values are cleared and the git operation picker starts at its default

#### Scenario: Switching from file to bash clears path
- **WHEN** `resolver` changes from `file` to `bash`
- **THEN** internal file path, operation, and content values are cleared

