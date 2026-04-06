## ADDED Requirements

### Requirement: Extract tool arguments as typed impulses
The system SHALL extract tool call arguments from LLM execution and create typed impulses with `ToolArgumentPointer` containing the tool name, arguments object, and argument schema.

#### Scenario: Read tool call extraction
- **WHEN** LLM calls `read` tool with `{path: "src/index.ts", offset: 0, limit: 100}`
- **THEN** system creates impulse with pointer type `toolArgument`, shape `file_read_args`, and the exact arguments

#### Scenario: Bash tool call extraction
- **WHEN** LLM calls `bash` tool with `{command: "npm test", timeout: 60000}`
- **THEN** system creates impulse with pointer type `toolArgument`, shape `bash_args`, and the exact arguments

#### Scenario: Git tool call extraction
- **WHEN** LLM calls `git` tool with `{command: "commit", message: "fix: bug"}`
- **THEN** system creates impulse with pointer type `toolArgument`, shape `git_args`, and the exact arguments

### Requirement: Generate stable argument IDs
The system SHALL generate stable, deterministic IDs for argument impulses based on tool name and key arguments to enable deduplication.

#### Scenario: Same read arguments produce same ID
- **WHEN** two executions call `read` with `{path: "src/index.ts"}`
- **THEN** both produce impulses with identical ID `arg:read:src/index.ts`

#### Scenario: Different paths produce different IDs
- **WHEN** one execution calls `read` with `{path: "src/a.ts"}` and another with `{path: "src/b.ts"}`
- **THEN** they produce different impulse IDs

#### Scenario: Bash commands are hashed for stability
- **WHEN** LLM calls `bash` with `{command: "npm test"}`
- **THEN** system generates ID `arg:bash:<hash-of-command>` where hash is deterministic

### Requirement: Infer argument shapes from tool names
The system SHALL infer shape identifiers from tool names to enable shape-based routing.

#### Scenario: Read tool maps to file_read_args shape
- **WHEN** extracting arguments from `read` tool call
- **THEN** impulse has shape `file_read_args`

#### Scenario: Write tool maps to file_write_args shape
- **WHEN** extracting arguments from `write` tool call
- **THEN** impulse has shape `file_write_args`

#### Scenario: Edit tool maps to file_edit_args shape
- **WHEN** extracting arguments from `edit` tool call
- **THEN** impulse has shape `file_edit_args`

#### Scenario: Bash tool maps to bash_args shape
- **WHEN** extracting arguments from `bash` tool call
- **THEN** impulse has shape `bash_args`

#### Scenario: Git tool maps to git_args shape
- **WHEN** extracting arguments from `git` tool call
- **THEN** impulse has shape `git_args`

#### Scenario: Glob tool maps to glob_args shape
- **WHEN** extracting arguments from `glob` tool call
- **THEN** impulse has shape `glob_args`

#### Scenario: Grep tool maps to grep_args shape
- **WHEN** extracting arguments from `grep` tool call
- **THEN** impulse has shape `grep_args`

### Requirement: Infer argument schema from tool arguments
The system SHALL infer type information for each argument field to enable validation and routing.

#### Scenario: Path argument typed as path
- **WHEN** extracting `{path: "src/index.ts"}` from read tool
- **THEN** argument schema includes `{path: "path"}`

#### Scenario: Command argument typed as command
- **WHEN** extracting `{command: "npm test"}` from bash tool
- **THEN** argument schema includes `{command: "command"}`

#### Scenario: Pattern argument typed as pattern
- **WHEN** extracting `{pattern: "*.ts"}` from glob tool
- **THEN** argument schema includes `{pattern: "pattern"}`

#### Scenario: Numeric arguments typed as number
- **WHEN** extracting `{offset: 100, limit: 50}` from read tool
- **THEN** argument schema includes `{offset: "number", limit: "number"}`
