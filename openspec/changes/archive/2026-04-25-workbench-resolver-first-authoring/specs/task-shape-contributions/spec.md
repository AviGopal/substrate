## ADDED Requirements

### Requirement: ActivityTask type includes per-task input_shapes and output_shapes
The `ActivityTask` interface in `src/types/index.ts` SHALL include `input_shapes?: string[]` and `output_shapes?: string[]` fields. These fields are optional to maintain backward compatibility with existing trace and template data.

#### Scenario: ActivityTask with shape arrays is valid
- **WHEN** an ActivityTask object includes `input_shapes: ["file_content"]` and `output_shapes: ["test_result"]`
- **THEN** TypeScript compilation succeeds without type errors

#### Scenario: ActivityTask without shape arrays is valid
- **WHEN** an ActivityTask object has no `input_shapes` or `output_shapes` fields
- **THEN** TypeScript compilation succeeds without type errors

### Requirement: TaskEditor detail panel displays declared per-task shapes as read-only
When a task has non-empty `input_shapes` or `output_shapes`, the `TaskEditor` detail panel SHALL display them as read-only badge rows. Input shapes SHALL appear between the prompt section header and the prompt editor. Output shapes SHALL appear between the prompt editor and the validation section header.

#### Scenario: Input shapes displayed when present
- **WHEN** a task has `input_shapes: ["file_content", "git_diff"]` and the detail panel is expanded
- **THEN** a read-only row labeled "in:" shows `file_content` and `git_diff` as compact monospace badges

#### Scenario: Output shapes displayed when present
- **WHEN** a task has `output_shapes: ["test_result"]` and the detail panel is expanded
- **THEN** a read-only row labeled "out:" shows `test_result` as a compact monospace badge

#### Scenario: Shape rows hidden when shapes are absent
- **WHEN** a task has no `input_shapes` and no `output_shapes`
- **THEN** no shape rows are rendered in the TaskEditor detail panel

#### Scenario: Shape display does not interfere with existing prompt/validation editing
- **WHEN** shapes are shown in the detail panel
- **THEN** the prompt editor, validation rules editor, and retry config remain fully interactive
