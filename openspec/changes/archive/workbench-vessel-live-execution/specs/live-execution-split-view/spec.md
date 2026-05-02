## REMOVED Requirements

### Requirement: LiveExecutionPanel displayed in right-side Sheet when execution is active
**Reason**: The Sheet overlay approach is superseded by inline-execution-bar and card-inline-resolution-trace. The Sheet hid the trajectory grid during execution, making it impossible to correlate running cards with their resolution traces.
**Migration**: The execution ID display, connection badge, and disconnect button move to `InlineExecutionBar` rendered above the trajectory grid. Per-task resolution events move into each `ActivityCard`'s expanded task rows via `TaskEditor`.

### Requirement: LiveExecutionPanel removed from left sidebar
**Reason**: `LiveExecutionPanel` is deleted entirely; this requirement no longer has a subject.
**Migration**: No left-sidebar changes needed. The sidebar layout (VesselSelectorPanel, GoalSubmissionPanel, ExecutionHistoryPanel, GoalInputBox, ActivityPalette) is unchanged.

### Requirement: Sheet width and scroll behavior
**Reason**: The Sheet is removed.
**Migration**: The `InlineExecutionBar` is a fixed-height row above the grid and does not scroll. Resolution trace overflow is handled by the card's existing expand/scroll behavior within the grid.
