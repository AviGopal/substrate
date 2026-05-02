## ADDED Requirements

### Requirement: ActivityCard auto-expands when its activity is active or completed
`ActivityCard` SHALL monitor `executionProps.isActive` and `executionProps.isCompleted`. When either becomes `true`, the card SHALL set `isExpanded` to `true`. The card SHALL NOT auto-collapse when execution ends — the expanded state is retained so the user can inspect traces after the fact. The user may manually collapse at any time.

#### Scenario: Card expands when execution reaches it
- **WHEN** `executionProps.isActive` transitions from `false` to `true`
- **THEN** `isExpanded` becomes `true` and the card's task list is visible

#### Scenario: Card stays expanded after completion
- **WHEN** `executionProps.isCompleted` becomes `true` (activity finished)
- **THEN** `isExpanded` remains `true`

#### Scenario: Cards that are queued or not yet active do not auto-expand
- **WHEN** `executionProps.isActive === false` and `executionProps.isCompleted === false`
- **THEN** `isExpanded` is not modified by the auto-expand effect

#### Scenario: User can manually collapse an auto-expanded card
- **WHEN** the card has been auto-expanded and the user clicks "collapse"
- **THEN** `isExpanded` becomes `false`

### Requirement: ActivityCard passes per-task resolution events to TaskEditor
`ActivityCard` SHALL subscribe to `taskResolutions` from `trajectoryStore` and, for each task rendered in the expanded task list, pass `resolutionEvents={taskResolutions.get(task.id) ?? []}` to the corresponding `TaskEditor` component.

#### Scenario: Resolution events are passed for the active task
- **WHEN** `taskResolutions` has entries for `task.id = "task_abc"`
- **THEN** the `TaskEditor` for that task receives those events in its `resolutionEvents` prop

#### Scenario: Tasks with no resolution events receive an empty array
- **WHEN** `taskResolutions` has no entry for `task.id = "task_xyz"`
- **THEN** `TaskEditor` for that task receives `resolutionEvents={[]}`

### Requirement: TaskEditor renders inline resolution events below the task row
`TaskEditor` SHALL accept an optional `resolutionEvents?: ImpulseResolutionEvent[]` prop. When the prop is non-empty, the component SHALL render a compact sub-list below the task description row showing each event as: a color-coded tier dot (green = deterministic, yellow = pattern, blue = llm), the `shape` name in monospace, the `resolver` name in monospace, and `latency_ms` in milliseconds if present. When the prop is empty or absent, no sub-list is rendered.

#### Scenario: Two resolution events render as two sub-rows
- **WHEN** `resolutionEvents` contains two events for a task
- **THEN** two rows are visible below the task row, each with tier dot, shape, resolver, and latency

#### Scenario: No resolution events means no sub-list rendered
- **WHEN** `resolutionEvents` is empty or undefined
- **THEN** no resolution sub-list DOM element is present

#### Scenario: Tier determines dot color
- **WHEN** `event.tier === 'deterministic'`
- **THEN** the dot is green; `'pattern'` → yellow; `'llm'` → blue

#### Scenario: Absent latency_ms omits timing text
- **WHEN** `event.latency_ms` is undefined
- **THEN** no millisecond value is displayed in that row

### Requirement: Resolution events persist in expanded view after execution completes
Resolution events accumulated in `taskResolutions` SHALL remain visible in the expanded card after the execution ends, until a new execution starts or the user disconnects. This is satisfied by the store already retaining the map until cleared by `clearTraceData`.

#### Scenario: Events visible after execution_completed
- **WHEN** the execution reaches "completed" state and the card remains expanded
- **THEN** all previously accumulated resolution events for each task are still rendered in the task rows
