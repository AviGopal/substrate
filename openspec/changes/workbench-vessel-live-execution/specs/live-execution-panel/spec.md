## REMOVED Requirements

### Requirement: Execution ID connection panel
**Reason**: `LiveExecutionPanel` is deleted. The execution ID display and disconnect button move to `InlineExecutionBar`. The manual-connect-by-ID input field is removed (execution is always started from `GoalSubmissionPanel`; there is no user-facing need to type a raw execution ID).
**Migration**: Execution ID, connection badge, and disconnect button are now rendered by `InlineExecutionBar` above the trajectory grid.

### Requirement: Live card animation and task progress
**Reason**: This requirement remains valid and is implemented via `ActivityCard`'s `executionProps` (unchanged). No migration needed — the requirement is fulfilled by an unchanged mechanism and is no longer scoped to `LiveExecutionPanel`.
**Migration**: Behavior unchanged. Requirement ownership moves to `card-inline-resolution-trace` and the existing `live-execution-panel` card-animation behavior.

### Requirement: Disconnect and reconnect
**Reason**: The disconnect button moves to `InlineExecutionBar`. Reconnect and catchup behavior in `useTrajectoryExecution` is unchanged.
**Migration**: `InlineExecutionBar` exposes the disconnect button. WebSocket reconnect behavior is owned by `useTrajectoryExecution` and is unaffected.

### Requirement: Per-task impulse resolution timeline in LiveExecutionPanel
**Reason**: The resolution timeline moves from `LiveExecutionPanel` to inline `TaskEditor` rows inside `ActivityCard`. See `card-inline-resolution-trace` spec.
**Migration**: `LiveExecutionPanel.tsx` is deleted. Resolution events now render inside each task row in the expanded `ActivityCard`. The `taskResolutions` store field and `addTaskResolution` action are unchanged.

### Requirement: No-events fallback when execution produces no task events within 30 seconds
**Reason**: The 30-second timer and fallback notice move from `LiveExecutionPanel` to `InlineExecutionBar`, where they are scoped to the connection-level bar rather than the panel.
**Migration**: See `inline-execution-bar` spec for the updated requirement.
