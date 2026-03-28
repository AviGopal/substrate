## ADDED Requirements

### Requirement: MiniBob selects component type based on data and intent
The system SHALL allow MiniBob to choose the appropriate visualization component based on data shape and query intent.

#### Scenario: Array of objects renders as table
- **WHEN** MiniBob receives query results as an array of objects
- **THEN** MiniBob creates a `table` component by default

#### Scenario: Relationship data renders as graph
- **WHEN** MiniBob receives data with nodes and edges (e.g., composition graph)
- **THEN** MiniBob creates a `graph` component

#### Scenario: Explanatory response renders as narrative
- **WHEN** user asks "why" or "explain" questions
- **THEN** MiniBob creates a `narrative` component with markdown text

#### Scenario: Raw inspection renders as JSON
- **WHEN** user asks to "show raw" or "inspect" data
- **THEN** MiniBob creates a `json` component with collapsible tree view

### Requirement: Components support streaming updates
The system SHALL render partial results as MiniBob streams data, rather than waiting for complete responses.

#### Scenario: Table rows appear incrementally
- **WHEN** MiniBob queries a large dataset
- **THEN** table rows appear as they are fetched, with a loading indicator for remaining rows

#### Scenario: Narrative text streams token by token
- **WHEN** MiniBob generates an explanation
- **THEN** text appears incrementally as tokens are generated

#### Scenario: Graph nodes appear as discovered
- **WHEN** MiniBob traverses a composition graph
- **THEN** nodes and edges appear as they are discovered, with layout adjusting dynamically

### Requirement: User can request visualization change
The system SHALL allow users to request a different visualization for the same data.

#### Scenario: Convert table to JSON view
- **WHEN** user says "show as JSON" after viewing a table
- **THEN** MiniBob updates the component type to `json` with the same underlying data

#### Scenario: Convert graph to table view
- **WHEN** user says "show as table" after viewing a graph
- **THEN** MiniBob creates a table with nodes/edges as rows

### Requirement: Components support interaction callbacks
The system SHALL allow components to send actions back to MiniBob when users interact with them.

#### Scenario: Table row click sends selection
- **WHEN** user clicks a table row
- **THEN** dashboard sends `{ type: 'action', componentId, action: 'select', data: rowData }` to MiniBob

#### Scenario: Action button triggers MiniBob command
- **WHEN** user clicks an action button component
- **THEN** dashboard sends the configured action to MiniBob for execution

#### Scenario: Graph node click focuses exploration
- **WHEN** user clicks a node in a graph component
- **THEN** dashboard sends selection to MiniBob which may expand or detail that node

### Requirement: Component positioning follows layout rules
The system SHALL position components according to MiniBob's instructions with sensible defaults.

#### Scenario: Default position is below input
- **WHEN** MiniBob creates a component without explicit position
- **THEN** component is positioned below the query input with appropriate spacing

#### Scenario: Multiple components stack vertically
- **WHEN** MiniBob creates multiple components
- **THEN** they stack vertically below the input in creation order

#### Scenario: Explicit positioning overrides defaults
- **WHEN** MiniBob specifies `position: { x: 100, y: 200 }`
- **THEN** component is positioned at those pixel coordinates relative to viewport
