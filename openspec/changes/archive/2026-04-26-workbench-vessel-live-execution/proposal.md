## Why

The trajectory editor's live execution feature was non-functional due to three independent bugs: MiniBob's WebSocket broadcast functions were imported but never called (dead broadcast), the workbench `useWebSocket` hook recreated its `connect` callback on every render causing 100+ reconnects/second, and MiniBob emits events in a different envelope format than activity-api, so the workbench received events it could not parse. Additionally, a React 19 compose-refs crash prevented the panel from mounting. These fixes are already applied; this change commits them and closes the remaining gaps (execution history wiring, no-events fallback).

## What Changes

- **MiniBob broadcast fix**: `goalExecution` handler now calls `broadcastActivityStarted` before `processGoal` and `broadcastActivityTaskCompleted` in `.then()` — was imported but never invoked.
- **useWebSocket ref stabilization**: `onOpen`, `onClose`, `onMessage`, `onError` callbacks stored in refs; `connect` useCallback dependency array no longer changes on every render, eliminating the reconnect storm.
- **MiniBob event normalization**: `normalizeMiniBobEvent()` translates MiniBob's `{ type: "activity:task-completed", data: {...} }` envelope to the activity-api flat format `{ type: "task.completed", activityId, taskId, success }` so `LiveExecutionPanel` can process events from either source.
- **Synthetic task resolution**: When a MiniBob task-completed event arrives, a synthetic impulse-resolved entry is injected into `taskResolutions` so the resolution timeline renders something meaningful.
- **React 19 compose-refs patch**: `composeRefs` now always returns a cleanup function; React 19 no longer calls the original callback ref with `null` on unmount, preventing the crash.
- **Execution history wiring**: `ExecutionHistoryPanel` button in the left sidebar is connected to a store slice that lists past executions by `executionId` and outcome.
- **No-events fallback**: `LiveExecutionPanel` shows a "completed without events" notice when `isLiveConnected && taskResolutions.size === 0` for more than 30 seconds.

## Capabilities

### New Capabilities

- `ws-callback-ref-stabilization`: useWebSocket callback refs pattern — prevents reconnect storm by storing event callbacks in refs so connect's useCallback identity is stable.
- `minibob-event-normalization`: Event normalization layer between MiniBob's native WS envelope and the activity-api flat event format used by LiveExecutionPanel.
- `execution-history-panel`: Execution history UI — left-sidebar panel listing past executions with executionId, status, and timestamp, wired to trajectoryStore.
- `live-execution-no-events-fallback`: Graceful degradation notice in LiveExecutionPanel when a connected execution produces no task events within 30 seconds.

### Modified Capabilities

- `live-execution-panel`: Add no-events fallback requirement; execution history button wiring requirement.

## Impact

- `repos/workbench/src/hooks/useWebSocket.ts` — callback ref stabilization
- `repos/workbench/src/hooks/useTrajectoryExecution.ts` — normalizeMiniBobEvent, synthetic task resolution
- `repos/workbench/src/components/LiveExecutionPanel.tsx` — no-events fallback UI
- `repos/workbench/src/store/trajectoryStore.ts` — execution history slice
- `repos/workbench/src/components/ExecutionHistoryPanel.tsx` — wired to store
- `repos/minibob/index.ts` — broadcastActivityStarted / broadcastActivityTaskCompleted calls
- `repos/workbench/node_modules/@radix-ui/react-compose-refs/dist/index.mjs` and `index.js` — React 19 cleanup-function patch (vendor patch, to be committed)
- No API contract changes; no new endpoints; no schema migrations required.
