## 1. Commit MiniBob Broadcast Fix

- [x] 1.1 Verify `repos/minibob/index.ts` calls `broadcastActivityStarted` before `processGoal` and `broadcastActivityTaskCompleted` in `.then()` and catch branches of `goalExecution` handler
- [x] 1.2 Commit the broadcast fix in `repos/minibob` with message `fix(minibob): call broadcastActivityStarted and broadcastActivityTaskCompleted in goalExecution handler`

## 2. Commit Workbench useWebSocket Ref Stabilization

- [x] 2.1 Verify `repos/workbench/src/hooks/useWebSocket.ts` stores `onOpen`, `onClose`, `onMessage`, `onError` in `useRef` values and that `connect` reads from refs — not from closed-over props
- [x] 2.2 Commit the ref-stabilization fix with message `fix(workbench): store ws callbacks in refs to prevent reconnect storm`

## 3. Commit MiniBob Event Normalization

- [x] 3.1 Verify `repos/workbench/src/hooks/useTrajectoryExecution.ts` exports `normalizeMiniBobEvent` and that it is called on each incoming WS message before `isTrajectoryEvent` guard
- [x] 3.2 Verify that a synthetic `impulse.resolved` entry with `resolver: "minibob"` and `tier: "deterministic"` is injected into `taskResolutions` when a normalized `task.completed` is processed
- [x] 3.3 Commit the normalization + synthetic resolution with message `fix(workbench): normalize MiniBob WS events and inject synthetic resolution entry`

## 4. Commit React 19 compose-refs Vendor Patch

- [x] 4.1 Generate patch file: `cd repos/workbench && git diff node_modules/@radix-ui/react-compose-refs/dist/index.mjs node_modules/@radix-ui/react-compose-refs/dist/index.js > patches/@radix-ui+react-compose-refs.patch` (adjust command to match bun patch tooling)
- [x] 4.2 Add `"patchedDependencies": { "@radix-ui/react-compose-refs": "patches/@radix-ui+react-compose-refs.patch" }` to `repos/workbench/package.json`
- [x] 4.3 Commit patch file and package.json change with message `fix(workbench): patch @radix-ui/react-compose-refs for React 19 cleanup-function crash`

## 5. Add No-Events Fallback to LiveExecutionPanel

- [x] 5.1 In `repos/workbench/src/components/trajectory/LiveExecutionPanel.tsx`, add a `useEffect` that starts a 30-second `setTimeout` when `isLiveConnected` becomes `true` and `taskResolutions.size === 0`; cancel the timer when any event arrives or `isLiveConnected` becomes `false`
- [x] 5.2 Add `showNoEventsNotice` boolean state; set to `true` when the timer fires; set to `false` when any resolution event arrives or the execution disconnects
- [x] 5.3 Render the notice text "No task events received — the execution may have completed silently or the vessel is unreachable" in the panel body when `showNoEventsNotice` is `true`
- [x] 5.4 Commit with message `feat(workbench): add 30s no-events fallback notice to LiveExecutionPanel`

## 6. Wire Execution History onLoadTrace to Store

- [x] 6.1 In `repos/workbench/src/pages/TrajectoryEditorPage.tsx` (or equivalent trajectory editor root), locate the `<ExecutionHistoryPanel>` usage and ensure `onLoadTrace` calls `useTrajectoryStore().setActiveExecutionId(trace.executionId)`
- [x] 6.2 Verify `trajectoryStore` exposes `setActiveExecutionId` (add if missing); confirm `LiveExecutionPanel` reads `activeExecutionId` from the store and auto-connects when it changes
- [x] 6.3 Commit with message `feat(workbench): wire ExecutionHistoryPanel load button to trajectoryStore.setActiveExecutionId`
