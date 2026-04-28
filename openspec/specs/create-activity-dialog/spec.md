# create-activity-dialog Specification

## Purpose
Provides a workbench dialog for authoring a new `activity_template` impulse and posting it to the activity-api, then inserting the returned template into the trajectory grid so it is immediately available for composition.
## Requirements
### Requirement: CreateActivityDialog renders a form for a new ActivityTemplate
The `CreateActivityDialog` component (at `src/components/trajectory/CreateActivityDialog.tsx`) SHALL render a modal dialog with the following form fields:
- `name`: required text input
- `category`: required select with options `feature | bugfix | refactor | tool | infrastructure`
- `description`: optional textarea
- `input_shapes`: optional tag input (comma-separated or Enter-to-add); each entry is a trimmed non-empty string
- `output_shapes`: optional tag input (same behavior)
- `tasks`: dynamic list; each task row has a `description` text input (required) and a `prompt.template` textarea (optional); an "Add Task" button appends a new empty row; each row has a remove button; minimum one task row is required

The dialog SHALL be opened by a `open: boolean` prop and closed via an `onClose: () => void` prop.

#### Scenario: Form validates required fields before submit
- **WHEN** the user clicks "Create" with an empty name field
- **THEN** the submit button is disabled or a validation error is shown; POST is not sent

#### Scenario: Form validates at least one task
- **WHEN** the user removes all task rows and clicks "Create"
- **THEN** validation fails with message "at least one task is required"

#### Scenario: Tag input adds a shape on Enter key
- **WHEN** the user types "typescript_ast" in the input_shapes tag input and presses Enter
- **THEN** the tag "typescript_ast" appears as a chip and the text input clears

#### Scenario: Tag input removes a shape via close button
- **WHEN** the user clicks the X on an existing shape chip
- **THEN** that shape is removed from the list

### Requirement: CreateActivityDialog submits to POST /v2/activities/templates and adds to grid
On form submission, the dialog SHALL POST the assembled `ActivityTemplate` payload to `POST /v2/activities/templates` via the existing `post()` API client. The payload SHALL include all non-empty fields. On success, the dialog SHALL call `onCreated(template: ActivityTemplate)` callback; the caller SHALL add the returned template to the trajectory grid at the next available column. On failure, the dialog SHALL display the error inline (not close). The "Create" button SHALL show a spinner while the request is in flight and be disabled until the request completes.

#### Scenario: Successful creation closes dialog and adds template to grid
- **WHEN** the user fills in a valid form and clicks "Create"
- **THEN** POST /v2/activities/templates is called; on 200 response the dialog closes and the new template appears in the trajectory grid at the next column

#### Scenario: API error shown inline
- **WHEN** POST /v2/activities/templates returns an error
- **THEN** the dialog stays open and shows the error message below the form

#### Scenario: In-flight submit disables the Create button
- **WHEN** a POST is in progress
- **THEN** the Create button shows a spinner and is disabled; cancelling is not possible mid-flight

### Requirement: TrajectoryEditorPage exposes + New button that opens CreateActivityDialog
`TrajectoryEditorPage` SHALL render a small `+ New` button (icon: `Plus` from lucide-react) in the palette area header (adjacent to the existing palette section). Clicking it SHALL open `CreateActivityDialog`. On `onCreated`, the page SHALL call `addActivity(template)` on the trajectory store and invalidate the TanStack Query templates cache key (`['templates']`).

#### Scenario: + New button opens dialog
- **WHEN** the user clicks the + New button in the palette header area
- **THEN** `CreateActivityDialog` opens with an empty form

#### Scenario: Created template added to grid and palette
- **WHEN** `CreateActivityDialog` calls `onCreated(template)`
- **THEN** the new template appears in the trajectory grid and the template palette list is refreshed

