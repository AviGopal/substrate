## ADDED Requirements

### Requirement: TaskEditor expanded panel exposes resolver selection
The expanded detail panel in `TaskEditor` SHALL include a resolver `<Select>` rendered before the prompt/config section. The select SHALL offer the same resolver options as `CreateActivityDialog`: `llm`, `bash`, `git`, `file`, `human`, `impulse-resolve`, `context-acquisition`. The current resolver value SHALL be read from `task.resolver` (defaulting to `llm` when absent).

#### Scenario: Resolver select renders with current resolver pre-selected
- **WHEN** a task row is expanded in TaskEditor and `task.resolver` is `bash`
- **THEN** the resolver select shows `bash` as the selected value

#### Scenario: Resolver select defaults to llm when resolver is absent
- **WHEN** a task row is expanded in TaskEditor and `task.resolver` is undefined
- **THEN** the resolver select shows `llm` as the selected value

#### Scenario: All supported resolvers appear in the select
- **WHEN** the resolver select is opened in TaskEditor
- **THEN** the options include `llm`, `bash`, `git`, `file`, `human`, `impulse-resolve`, and `context-acquisition`

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
