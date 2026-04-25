## MODIFIED Requirements

### Requirement: Stream execution events via WebSocket
The system SHALL stream task-by-task execution progress via WebSocket connection with automatic reconnection and catchup protocol.

#### Scenario: Real-time task progress
- **WHEN** trajectory execution starts
- **THEN** WebSocket connects to `/executions/:id/stream`
- **AND** receives `task.started`, `task.completed`, `impulse.resolved` events in real-time

#### Scenario: Reconnection with catchup
- **WHEN** WebSocket disconnects during execution
- **THEN** client reconnects with exponential backoff
- **AND** sends `{type: "catchup", lastSeenSequence: N}`
- **AND** server sends missed events since sequence N

### Requirement: Display live state transitions
The system SHALL update impulse state space in real-time as execution progresses and impulses are resolved.

#### Scenario: Realized impulse displayed
- **WHEN** `impulse.resolved` event received with new impulse ID
- **THEN** impulse state panel updates to show realized impulse (solid border)
- **AND** speculative impulse (dashed border) is replaced

### Requirement: Overlay execution progress on trajectory
The system SHALL display execution progress directly on the trajectory grid showing current activity and task.

#### Scenario: Current task highlighted
- **WHEN** `task.started` event received
- **THEN** active activity card highlighted with pulse animation
- **AND** current task shown with spinner
- **AND** progress bar shows task N of M
