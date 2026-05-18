## ADDED Requirements

### Requirement: ui_component as proper impulse pointer type
The system SHALL represent UI components as impulses with pointer type `ui_component` following the impulse-pointer-mvp metadata pattern. UI impulses reference data impulses via `dataRef` rather than embedding raw data.

#### Scenario: Create a table component with dataRef
- **WHEN** MiniBob calls `create_ui_component` with type `table` and a `dataRef` pointing to a data impulse
- **THEN** a new impulse is created with:
  - `pointer.type = 'ui_component'`
  - `pointer.componentType = 'table'`
  - `pointer.dataRef = '<data-impulse-id>'`
  - `metadata` describing the visual state (componentType, position, rowCount from referenced data)
- **AND** the frontend resolves `dataRef`, loads data, and renders a table at the specified position

#### Scenario: Create component with embedded data (backward compatible)
- **WHEN** MiniBob calls `create_ui_component` with type `table` and embedded `data` array (no dataRef)
- **THEN** the component is created with data embedded in the impulse pointer (backward-compatible mode)
- **AND** the `metadata.summary` reflects "embedded data: N rows"

#### Scenario: Update component position
- **WHEN** MiniBob calls `update_ui_component` with new position coordinates
- **THEN** the impulse's position property is updated, `metadata.position` is updated to match
- **AND** the frontend animates the component to the new location

#### Scenario: Delete component impulse
- **WHEN** MiniBob calls `delete_ui_component` with a component ID
- **THEN** the impulse is removed and the frontend removes the component from the DOM

### Requirement: UI impulse metadata follows impulse-pointer-mvp pattern
UI component impulses SHALL include `metadata` field that enables LLM reasoning about displayed state without seeing raw data.

#### Scenario: UI impulse has visual metadata
- **WHEN** a ui_component impulse is created
- **THEN** the `metadata` field SHALL contain:
  - `componentType`: The visual component type (table, graph, json, etc.)
  - `position`: Current position ('center', 'below-input', or {x,y})
  - `dataShape`: Shape of referenced data (if any) - e.g., "array[12]", "object", "graph(nodes:5,edges:8)"
  - `summary`: Human-readable summary of what's displayed

#### Scenario: Pointer-mode formatting for LLM context
- **WHEN** `formatImpulsesForContext` is called with ui_component impulses
- **THEN** they SHALL render as: `<impulse_ref id="table-001" type="ui_component" component_type="table" position="below-input" data_shape="array[12]" summary="Activity executions from last hour" />`
- **AND** the LLM can reason about what's displayed without loading the visual data

#### Scenario: LLM updates component based on metadata
- **WHEN** the LLM sees an `<impulse_ref>` for a table with `data_shape="array[12]"`
- **THEN** the LLM can reason: "There's a table showing 12 rows" and decide to filter, expand, or replace it

### Requirement: Dashboard as visual resolver
The internal dashboard SHALL act as a "visual resolver" for `ui_component` pointer types. Instead of returning string content, resolution produces a visual side-effect (rendering a component).

#### Scenario: Dashboard resolves ui_component pointer
- **WHEN** a ui_component impulse is created by MiniBob
- **THEN** the dashboard acts as the resolver for this pointer type
- **AND** resolution produces a visual side-effect (mounted React component) rather than returning string content

#### Scenario: dataRef triggers data resolution
- **WHEN** a ui_component impulse has `pointer.dataRef` pointing to another impulse
- **THEN** the dashboard resolves the referenced data impulse first
- **AND** uses the resolved data content to populate the visual component

#### Scenario: Resolver produces metadata, not content
- **WHEN** MiniBob queries what UI components are displayed (pointer-mode context)
- **THEN** the resolver returns metadata about visual state, not the rendered pixels
- **AND** the metadata enables LLM reasoning: "table showing 12 execution traces"

### Requirement: Frontend synchronizes with impulse state
The system SHALL maintain a real-time synchronized view between MiniBob's impulse state and the rendered UI components.

#### Scenario: WebSocket delivers impulse creation
- **WHEN** MiniBob creates a UI component impulse
- **THEN** the frontend receives an `impulse_create` message within 100ms and renders the component

#### Scenario: Reconnection restores state
- **WHEN** the WebSocket connection is re-established after disconnect
- **THEN** MiniBob sends the full current impulse state and the frontend reconciles to match

#### Scenario: Concurrent updates are ordered
- **WHEN** MiniBob sends multiple impulse updates in rapid succession
- **THEN** the frontend applies them in order based on message sequence numbers

#### Scenario: Data impulse update triggers re-render
- **WHEN** a data impulse referenced by `dataRef` is updated
- **THEN** the dashboard re-resolves the data and re-renders the visual component
- **AND** updates the ui_component impulse metadata to reflect new data shape

### Requirement: Impulse lifecycle maps to component lifecycle
The system SHALL map impulse load/unload operations to component mount/unmount in React.

#### Scenario: Impulse creation mounts component
- **WHEN** a UI component impulse is created
- **THEN** the corresponding React component is mounted with impulse data as props

#### Scenario: Impulse deletion unmounts component
- **WHEN** a UI component impulse is deleted
- **THEN** the corresponding React component is unmounted and removed from the DOM

#### Scenario: Impulse update triggers re-render
- **WHEN** a UI component impulse's data property changes
- **THEN** the React component re-renders with the new data without unmounting

### Requirement: Component types support standard visualizations
The system SHALL support component types: `table`, `graph`, `json`, `narrative`, `action`, and `input`.

#### Scenario: Table component renders array data
- **WHEN** a component impulse has `componentType: 'table'` and data is an array of objects
- **THEN** the frontend renders a sortable, scrollable table with columns derived from object keys

#### Scenario: Graph component renders relationships
- **WHEN** a component impulse has `componentType: 'graph'` and data contains nodes and edges
- **THEN** the frontend renders an interactive graph visualization

#### Scenario: JSON component renders raw data
- **WHEN** a component impulse has `componentType: 'json'`
- **THEN** the frontend renders syntax-highlighted, collapsible JSON

#### Scenario: Narrative component renders markdown
- **WHEN** a component impulse has `componentType: 'narrative'` and data is a string
- **THEN** the frontend renders the string as formatted markdown

#### Scenario: Action component renders interactive button
- **WHEN** a component impulse has `componentType: 'action'` with label and action properties
- **THEN** the frontend renders a button that sends the action to MiniBob when clicked

### Requirement: Observation-hierarchy integration
The internal dashboard SHALL support visualizing observation-hierarchy data including system health, circuit breaker state, and multi-scale metrics.

#### Scenario: System health component type
- **WHEN** MiniBob creates a ui_component with `componentType: 'system_health'`
- **THEN** the frontend renders a status card showing:
  - Overall success rate gauge (green/yellow/red)
  - Template creation rate sparkline
  - Failure correlation indicator
  - Circuit breaker status badge (active/paused)

#### Scenario: Circuit breaker status visible
- **WHEN** the circuit breaker is in `paused` state
- **THEN** the system_health component shows a prominent "PAUSED" badge with reason
- **AND** MiniBob can create an action button to resume (if authorized)

#### Scenario: Multi-scale metrics table
- **WHEN** user asks "Show tool patterns from last week"
- **THEN** MiniBob queries `/v2/metrics/tool-patterns?window=7d`
- **AND** creates a table ui_component showing tool sequences with frequency and success rate

#### Scenario: Composition chain graph
- **WHEN** user asks "Show composition patterns"
- **THEN** MiniBob queries `/v2/metrics/composition-patterns?window=7d`
- **AND** creates a graph ui_component showing activity composition chains with success rates as edge weights

#### Scenario: Peer anomaly flags list
- **WHEN** user asks "Are there any anomalies?"
- **THEN** MiniBob queries peer comparison data from the backend
- **AND** creates a table ui_component showing flagged entities with their deviation metrics
