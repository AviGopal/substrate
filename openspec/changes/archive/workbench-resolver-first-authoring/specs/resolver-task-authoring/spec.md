## MODIFIED Requirements

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
