## ADDED Requirements

### Requirement: Resolver select is visible in the TaskEditor summary row
The `TaskEditor` summary row SHALL include a compact resolver `<Select>` that is always visible without expanding the detail panel. The select SHALL be positioned between the description input and the resolver-tier badge. The options SHALL be: `llm`, `bash`, `git`, `file`, `human`, `impulse-resolve`, `context-acquisition`. The default value SHALL be `llm` when `task.resolver` is absent.

#### Scenario: Resolver select visible on collapsed task row
- **WHEN** a task row is rendered in its default (collapsed) state
- **THEN** the resolver select is visible in the summary row without any expand action

#### Scenario: Default resolver shown when task has no resolver field
- **WHEN** `task.resolver` is `undefined`
- **THEN** the select displays `llm` as the selected value

#### Scenario: Current resolver shown when task has a resolver set
- **WHEN** `task.resolver` is `bash`
- **THEN** the select displays `bash` as the selected value

#### Scenario: All supported resolver options are present
- **WHEN** the resolver select in the summary row is opened
- **THEN** the dropdown contains: `llm`, `bash`, `git`, `file`, `human`, `impulse-resolve`, `context-acquisition`

### Requirement: Changing resolver in summary row calls onChange with updated resolver and cleared config
When the resolver select value changes in the summary row, the system SHALL call `onChange` with the updated task containing the new `resolver`, the derived `resolver_tier`, and `config: undefined`. The `resolver_tier` SHALL be derived using `resolverToTierMap` (`llm→llm`; `bash`, `git`, `file`, `exec→deterministic`; `pattern→pattern`; unknown resolver names default to `llm` tier).

#### Scenario: onChange called with new resolver and cleared config
- **WHEN** the resolver select in the summary row changes from `llm` to `git`
- **THEN** `onChange` is called with `{ ...task, resolver: "git", resolver_tier: "deterministic", config: undefined }`

#### Scenario: Switching back to llm sets tier to llm and clears config
- **WHEN** the resolver select changes from `bash` to `llm`
- **THEN** `onChange` is called with `{ ...task, resolver: "llm", resolver_tier: "llm", config: undefined }`

#### Scenario: Unknown resolver defaults resolver_tier to llm
- **WHEN** the resolver select is set to `human`
- **THEN** `onChange` is called with `resolver_tier: "llm"` (fallback for resolvers absent from resolverToTierMap)

### Requirement: Detail panel primary content adapts to the summary-row resolver value
The TaskEditor detail panel SHALL NOT contain a resolver picker. The detail panel's primary content area SHALL render `TaskPromptEditor` when the task resolver is `llm`, and `ConfigEditor` when the resolver is any other value. Only one of the two editors SHALL be rendered at a time.

#### Scenario: TaskPromptEditor shown when resolver is llm
- **WHEN** the task resolver is `llm` and the detail panel is expanded
- **THEN** `TaskPromptEditor` is visible and `ConfigEditor` is not rendered

#### Scenario: ConfigEditor shown when resolver is bash
- **WHEN** the task resolver is `bash` and the detail panel is expanded
- **THEN** `ConfigEditor` is rendered with bash-specific structured fields and `TaskPromptEditor` is not rendered

#### Scenario: Switching resolver from summary row updates detail panel content
- **WHEN** the resolver select in the summary row changes from `llm` to `git` while the panel is expanded
- **THEN** `TaskPromptEditor` disappears and `ConfigEditor` with git operation picker appears

#### Scenario: ConfigEditor is seeded with existing task.config on open
- **WHEN** a task with `config: { command: "bun test" }` and resolver `bash` is expanded
- **THEN** `ConfigEditor` renders with the command field pre-filled as `bun test`

#### Scenario: ConfigEditor key prop changes on resolver switch
- **WHEN** the resolver switches from `bash` to `git`
- **THEN** `ConfigEditor` remounts (via `key={task.resolver}`) so internal state is fresh for the new resolver

### Requirement: Resolver select in summary row does not trigger detail panel expand
Clicking the resolver select in the summary row SHALL NOT expand the detail panel. The expand/collapse behavior is controlled only by the existing expand button.

#### Scenario: Clicking resolver select does not expand panel
- **WHEN** the resolver select in the collapsed summary row is clicked
- **THEN** the detail panel remains collapsed and only the select dropdown opens
