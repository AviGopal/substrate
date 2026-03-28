## ADDED Requirements

### Requirement: Floating centered text input for queries
The system SHALL display a floating, centered text input field as the primary interface for entering natural language queries.

#### Scenario: Initial page load shows centered input
- **WHEN** user navigates to internal.metabob.local
- **THEN** the page displays an empty screen with only a centered text input field

#### Scenario: Input remains visible during responses
- **WHEN** MiniBob renders response components
- **THEN** the query input remains visible and accessible (repositioned if needed)

#### Scenario: Input cannot be deleted by MiniBob
- **WHEN** MiniBob calls `clear_ui_components` or `delete_ui_component`
- **THEN** the query input impulse is preserved (has `deletable: false` property)

### Requirement: Query submission triggers MiniBob processing
The system SHALL send user queries to MiniBob via WebSocket for natural language processing and response generation.

#### Scenario: Enter key submits query
- **WHEN** user types a query and presses Enter
- **THEN** the query is sent to MiniBob as a `{ type: 'query', text: string }` message

#### Scenario: Query appears in conversation context
- **WHEN** user submits a query
- **THEN** the query text is displayed above the response area as user context

#### Scenario: Loading state during processing
- **WHEN** query is submitted and MiniBob is processing
- **THEN** the input shows a loading indicator and "thinking" messages stream from MiniBob

### Requirement: Query history is accessible
The system SHALL maintain a history of recent queries for quick re-execution.

#### Scenario: Up arrow recalls previous query
- **WHEN** user presses up arrow in empty input
- **THEN** the previous query is populated in the input field

#### Scenario: Query history persists across sessions
- **WHEN** user returns to the dashboard after closing browser
- **THEN** query history from localStorage is restored (last 50 queries)

### Requirement: Input supports query refinement
The system SHALL allow users to refine queries based on displayed results.

#### Scenario: Follow-up query maintains context
- **WHEN** user submits "Show failed activities" then "Why did the first one fail?"
- **THEN** MiniBob interprets "first one" in context of the previous response

#### Scenario: Clear context command resets state
- **WHEN** user types "/clear" or clicks clear button
- **THEN** all response components are removed and conversation context is reset
