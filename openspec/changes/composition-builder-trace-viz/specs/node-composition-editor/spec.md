## ADDED Requirements

### Requirement: User can create activity compositions visually

The system SHALL provide a node-based editor where users can drag activities onto a canvas and connect them by wiring output shapes to input shapes.

#### Scenario: Adding activity to canvas
- **WHEN** user drags an activity from the palette onto the canvas
- **THEN** system creates a node with input ports (required shapes) and output ports (produced shapes)

#### Scenario: Connecting compatible shapes
- **WHEN** user drags from an output port producing `error_log` to an input port requiring `error_log`
- **THEN** system creates a valid edge and highlights it in green

#### Scenario: Preventing incompatible connections
- **WHEN** user attempts to drag from an output port producing `source_code` to an input port requiring `error_log`
- **THEN** system prevents the connection and shows a red indicator with error message

### Requirement: System validates compositions in real-time

The system SHALL validate the composition graph continuously as the user builds it, checking for missing inputs, cycles, and type mismatches.

#### Scenario: Detecting missing required inputs
- **WHEN** user adds an activity requiring `error_log` but no upstream activity produces it
- **THEN** system highlights the input port in red and shows warning "Missing required shape: error_log"

#### Scenario: Detecting circular dependencies
- **WHEN** user creates a connection that would form a cycle (A → B → C → A)
- **THEN** system prevents the connection and shows error "Circular dependency detected"

#### Scenario: Showing validation summary
- **WHEN** user views the composition
- **THEN** system displays validation status showing all errors and warnings with count

### Requirement: User can save compositions as templates

The system SHALL allow users to export validated compositions as reusable activity templates with all connections preserved.

#### Scenario: Exporting valid composition
- **WHEN** user clicks "Save as Template" on a valid composition with 3 connected activities
- **THEN** system creates a new activity template with tasks referencing the 3 activities in execution order

#### Scenario: Preventing export of invalid composition
- **WHEN** user clicks "Save as Template" on a composition with missing required inputs
- **THEN** system shows error dialog listing validation issues and prevents export

### Requirement: Composition persists across sessions

The system SHALL automatically save the composition state to browser local storage and restore it on page reload.

#### Scenario: Auto-save during editing
- **WHEN** user adds a node or connection
- **THEN** system saves the graph state to localStorage within 1 second

#### Scenario: Restore on page load
- **WHEN** user refreshes the page or navigates back to composition builder
- **THEN** system restores the exact graph state including node positions and connections

### Requirement: User can manipulate graph layout

The system SHALL provide controls for panning, zooming, and auto-layout of the composition graph.

#### Scenario: Panning the canvas
- **WHEN** user drags the background
- **THEN** system pans the viewport to show different areas of the graph

#### Scenario: Auto-layout
- **WHEN** user clicks "Auto Layout" button
- **THEN** system arranges nodes left-to-right in topological order with even spacing

#### Scenario: Minimap navigation
- **WHEN** graph contains more than 10 nodes
- **THEN** system displays a minimap in the corner showing full graph overview
