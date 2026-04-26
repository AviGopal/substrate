## Why

`GoalSubmissionPanel` correctly extracts a vessel-provided `wsUrl` from the goal-execution response and passes it to `onExecutionStarted` — but `submitTrajectory` (used by the "run trajectory" button) only returns the `executionId` string, silently discarding the `wsUrl`. This means trajectory executions dispatched to a vessel always fall back to the activity-api WebSocket stream instead of the vessel's own stream, breaking live monitoring when the vessel is the authoritative source of events.

## What Changes

- Change `submitTrajectory` return type from `Promise<string>` to `Promise<{ executionId: string; wsUrl?: string }>` and extract `wsUrl` from the vessel response using the same regex pattern as `GoalSubmissionPanel`
- Update `GoalSubmissionPanel.handleRunTrajectory` to destructure `{ executionId, wsUrl }` and pass `wsUrl` to `onExecutionStarted`
- Add `parseWsUrl` helper to `useTrajectoryExecution.ts` alongside the existing `parseExecutionId` pattern (or import from a shared util)

## Capabilities

### New Capabilities
- `vessel-wsurl-propagation`: Vessel-provided WebSocket URL is correctly propagated through trajectory execution dispatch

### Modified Capabilities
<!-- none — no existing spec covers this execution flow -->

## Impact

- `src/hooks/useTrajectoryExecution.ts` — return type change for `submitTrajectory`, add wsUrl parsing
- `src/components/trajectory/GoalSubmissionPanel.tsx` — destructure wsUrl from `submitTrajectory` result, pass to `onExecutionStarted`
- `src/hooks/useTrajectoryExecution.test.ts` (new) — unit test for wsUrl extraction from response content
