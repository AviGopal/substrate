## Why

The live-execution Sheet overlay splits the user's attention: execution progress lives in a drawer that covers the trajectory grid, making it impossible to see which card is running while reading resolution events. Bringing execution inputs, outputs, wiring, progress, and per-task traces directly into the ActivityCard's expanded view closes that split and makes the trajectory grid the single authoritative surface during execution.

## What Changes

- Remove the right-side `Sheet` and `isLiveSheetOpen` state from `TrajectoryEditorPage`
- Remove the "Live" toolbar button that re-opens the Sheet
- Move the execution ID display and disconnect control into a compact inline execution bar rendered above the trajectory grid when an execution is active
- `ActivityCard` auto-expands when `executionProps.isActive === true` so resolution traces are visible without a user click
- Each `TaskEditor` row in the expanded card gains an inline resolution-events section sourced from `taskResolutions` in `trajectoryStore`; this section persists after execution completes so traces remain inspectable
- `LiveExecutionPanel.tsx` is removed (its content is fully distributed to the card level and the new inline execution bar)
- `LiveExecutionOverlay.tsx` is kept unchanged

## Capabilities

### New Capabilities

- `inline-execution-bar`: A compact bar rendered above the trajectory grid during an active or recently-completed execution, showing execution ID, connection-state badge, and a disconnect button; replaces the Sheet header controls

- `card-inline-resolution-trace`: Per-task resolution events (shape, resolver, tier, latency) rendered inside each `ActivityCard`'s expanded task list, sourced from `taskResolutions` in `trajectoryStore`; visible during and after execution

### Modified Capabilities

- `live-execution-split-view`: Sheet and `isLiveSheetOpen` are removed; the split-view requirement is superseded by the inline approach. The requirement that the Sheet auto-opens/closes on connection state change is removed.

- `live-execution-panel`: `LiveExecutionPanel` component is deleted. The requirement for a per-task resolution timeline in the panel is superseded by `card-inline-resolution-trace`. The execution ID input and disconnect button move to `inline-execution-bar`.

- `per-task-impulse-resolution-timeline`: The timeline rendering location changes from `LiveExecutionPanel` to inline `TaskEditor` rows inside `ActivityCard`; store shape (`taskResolutions` map, `addTaskResolution` action) is unchanged.

## Impact

- **Files deleted**: `repos/workbench/src/components/trajectory/LiveExecutionPanel.tsx`
- **Files modified**: `TrajectoryEditorPage.tsx`, `ActivityCard.tsx`, `TaskEditor.tsx`
- **Files added**: `repos/workbench/src/components/trajectory/InlineExecutionBar.tsx`
- **No API or store schema changes**: `taskResolutions`, `addTaskResolution`, and `buildLiveExecutionOverlay` are retained as-is
- **No minibob changes**
- **Existing tests**: `LiveExecutionPanel.test.tsx` will be deleted; `TaskEditor.test.tsx` gains resolution-event rendering tests
