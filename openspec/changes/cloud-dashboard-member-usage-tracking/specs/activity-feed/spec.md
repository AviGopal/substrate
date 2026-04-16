## ADDED Requirements

### Requirement: Real-time execution updates
The system SHALL stream live updates of activity executions via WebSocket connection.

#### Scenario: Connect to activity feed
- **WHEN** user opens Activity Feed page or dashboard with feed widget
- **THEN** system establishes WebSocket connection to activity-api at /ws endpoint

#### Scenario: Receive execution started event
- **WHEN** MiniBob starts new activity execution
- **THEN** feed displays event: "MiniBob started [template_name] for goal: [goal_description]"

#### Scenario: Receive execution completed event
- **WHEN** MiniBob completes activity execution successfully
- **THEN** feed displays event: "[template_name] completed in [duration]ms - [cost_usd] USD"

#### Scenario: Receive execution failed event
- **WHEN** MiniBob execution fails
- **THEN** feed displays event with red indicator: "[template_name] failed: [error_message]"

### Requirement: Task-level progress updates
The system SHALL show task-by-task progress as activities execute.

#### Scenario: Receive task started event
- **WHEN** MiniBob starts task within running activity
- **THEN** feed displays sub-item: "  → Task [task_id]: [task_description]"

#### Scenario: Receive task completed event
- **WHEN** MiniBob completes task
- **THEN** feed updates task line with checkmark and duration

#### Scenario: Receive tool call event
- **WHEN** MiniBob executes tool during task
- **THEN** feed displays tool call: "    ⚙ [tool_name]([args_summary])"

### Requirement: WebSocket authentication
The system SHALL authenticate WebSocket connections using JWT or API key tokens.

#### Scenario: Authenticate with JWT token
- **WHEN** client sends authenticate message with valid JWT
- **THEN** WebSocket server validates token and sends authenticated confirmation

#### Scenario: Authenticate with API key
- **WHEN** client sends authenticate message with valid API key
- **THEN** WebSocket server validates via identity-vessel and sends authenticated confirmation

#### Scenario: Authentication failure
- **WHEN** client sends invalid or expired token
- **THEN** WebSocket server sends auth_error and closes connection with code 1008

#### Scenario: Unauthenticated message
- **WHEN** client sends message before authentication
- **THEN** WebSocket server ignores message and sends auth_required error

### Requirement: Organization-scoped feed
The system SHALL only show execution events for the authenticated user's organization.

#### Scenario: Filter by org_id from JWT
- **WHEN** WebSocket authenticates with JWT containing org_id claim
- **THEN** server only broadcasts events where execution org_id matches JWT org_id

#### Scenario: Filter by org_id from API key
- **WHEN** WebSocket authenticates with API key
- **THEN** server resolves org_id from API key owner and filters events

#### Scenario: Multi-tenant isolation
- **WHEN** two users from different organizations are connected
- **THEN** each user receives only their organization's execution events

### Requirement: Feed persistence and history
The system SHALL allow viewing recent feed events even after page refresh.

#### Scenario: Load last 50 events on connect
- **WHEN** client connects to WebSocket and authenticates
- **THEN** server sends last 50 execution events for organization as history

#### Scenario: Scroll through feed history
- **WHEN** user scrolls to top of feed widget
- **THEN** system loads previous 50 events from execution trace API

#### Scenario: Auto-scroll to new events
- **WHEN** new execution event arrives while user is viewing recent events
- **THEN** feed auto-scrolls to show new event at bottom

### Requirement: Connection resilience
The system SHALL automatically reconnect WebSocket on disconnection with exponential backoff.

#### Scenario: Network disconnection
- **WHEN** WebSocket connection drops (network issue, server restart)
- **THEN** client attempts reconnection after 1 second

#### Scenario: Exponential backoff on failures
- **WHEN** reconnection attempts fail repeatedly
- **THEN** client doubles wait time between attempts (1s, 2s, 4s, 8s, max 30s)

#### Scenario: Successful reconnection
- **WHEN** WebSocket reconnects successfully
- **THEN** client re-authenticates and loads missed events since last connection

#### Scenario: Display connection status
- **WHEN** WebSocket connection state changes
- **THEN** feed displays status indicator: green (connected), yellow (reconnecting), red (disconnected)

### Requirement: Event filtering
The system SHALL allow filtering feed events by execution status and category.

#### Scenario: Filter by status
- **WHEN** user selects "Show only failures" toggle
- **THEN** feed displays only execution failed events

#### Scenario: Filter by category
- **WHEN** user selects category=bugfix from dropdown
- **THEN** feed displays only events for bugfix activities

#### Scenario: Mute successful executions
- **WHEN** user enables "Mute successes" option
- **THEN** feed shows only running and failed executions
