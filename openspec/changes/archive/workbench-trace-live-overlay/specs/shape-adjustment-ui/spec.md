## ADDED Requirements

### Requirement: ActivityCard expanded view includes TagInput for editing template output_shapes
When an `ActivityCard` is expanded, the card body SHALL include a `TagInput` control (same pattern used in `CreateActivityDialog`) below the task list, labeled "output shapes". The control SHALL be pre-populated from the template's `output_shapes` array and allow adding, removing, and editing shape name tags.

#### Scenario: TagInput pre-populated from template
- **WHEN** an ActivityCard is expanded for a template with `output_shapes: ["file_content", "test_result"]`
- **THEN** the TagInput shows "file_content" and "test_result" as removable tags

#### Scenario: User removes a shape tag
- **WHEN** the user clicks the remove (×) button on a shape tag
- **THEN** that tag is removed from the TagInput control

#### Scenario: User adds a new shape tag
- **WHEN** the user types a new shape name and presses Enter or comma
- **THEN** the new shape appears as a tag in the TagInput control

### Requirement: Shape changes in TagInput persisted via PATCH to activity-api on blur
When the TagInput loses focus after a change, the system SHALL issue a `PATCH /v2/activities/templates/{id}` request with `{ output_shapes: string[] }` containing the current tag list. The template in the trajectory store SHALL be updated optimistically with the new shapes.

#### Scenario: PATCH fires on blur after edit
- **WHEN** the user adds a shape "memo" to a template's TagInput and clicks away
- **THEN** a PATCH request is sent with the updated `output_shapes` array
- **THEN** the template in the store reflects the new array without a page reload

#### Scenario: PATCH fails — warning logged, local state preserved
- **WHEN** the PATCH request returns a non-2xx response
- **THEN** a `console.warn` is emitted with the error
- **THEN** the TagInput retains the locally-edited tags (no revert)

#### Scenario: No PATCH when shapes unchanged
- **WHEN** the TagInput gains and loses focus without any edits
- **THEN** no PATCH request is sent

### Requirement: Discovered-shape badges in ImpulseStatePanel support context-menu rename
In the Realized tab of `ImpulseStatePanel`, each discovered-shape badge (rendered from `discoveredShapes`) SHALL support a right-click or long-press context menu with a "Rename shape" action. Selecting it opens an inline rename input.

#### Scenario: Context menu appears on right-click
- **WHEN** the user right-clicks on a discovered shape badge (e.g., "raw_output")
- **THEN** a context menu appears with a "Rename shape" option

#### Scenario: Rename input replaces badge
- **WHEN** the user selects "Rename shape"
- **THEN** the badge is replaced with a text input pre-filled with the current shape name

#### Scenario: Confirmed rename updates display label
- **WHEN** the user clears the input, types "processed_output", and presses Enter
- **THEN** the badge now displays "processed_output" (renamed label)
- **THEN** the original shape name "raw_output" is no longer shown

#### Scenario: Rename is ephemeral (session-only)
- **WHEN** the user renames a discovered shape and then reloads the page
- **THEN** the badge reverts to the original shape name from `discoveredShapes`

#### Scenario: Cancel rename restores original badge
- **WHEN** the user opens the rename input but presses Escape
- **THEN** the badge reverts to the original shape name without any change

### Requirement: TagInput in ActivityCard hidden when template is not editable
When the trajectory is in a read-only state (e.g., a trace is loaded but no authoring session is active), the output shapes TagInput SHALL be rendered as read-only badges instead of an interactive input.

#### Scenario: TagInput read-only in trace view
- **WHEN** a historical trace is loaded (activeTraceId is non-null) and no editing session is active
- **THEN** the output shapes are shown as non-interactive badge list, not a TagInput

#### Scenario: TagInput interactive in authoring mode
- **WHEN** no trace is loaded and the template is editable
- **THEN** the TagInput is fully interactive (add/remove tags, PATCH on blur)
