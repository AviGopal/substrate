## Context

The trajectory editor's live execution feature connects the workbench to a MiniBob vessel via WebSocket to show real-time task progress. Three independent bugs prevented this from working end-to-end:

1. **Dead broadcast in MiniBob** (`repos/minibob/index.ts`): `broadcastActivityStarted` and `broadcastActivityTaskCompleted` were imported at the top of the file but never invoked inside `goalExecution` handler. MiniBob processed goals silently — no WS events were emitted.

2. **Reconnect storm in `useWebSocket`** (`repos/workbench/src/hooks/useWebSocket.ts`): The `connect` useCallback declared `onOpen`, `onClose`, `onMessage`, `onError` as dependencies. These are props passed inline from callers, so they have new identity on every render. This caused `connect` to change identity on every render → `useEffect` re-ran → connection torn down and rebuilt continuously (100+ times/second).

3. **Format mismatch in `useTrajectoryExecution`**: MiniBob emits `{ type: "activity:task-completed", data: { executionId, taskId, status } }` (namespaced envelope). The workbench expected the activity-api flat format `{ type: "task.completed", activityId, taskId, success }`. Events arrived but were silently dropped by `isTrajectoryEvent()`.

Two remaining gaps exist beyond the bug fixes: the execution history panel's `onLoadTrace` callback is wired but not connected to a store action that sets the active trajectory from a trace, and `LiveExecutionPanel` has no fallback when a connected execution produces no events (timeout case).

All bug fixes are already applied in the working tree. This design covers how to commit them and implement the two remaining gaps.

## Goals / Non-Goals

**Goals:**
- Commit the three already-applied bug fixes (broadcast, callback refs, event normalization) as discrete, reviewable commits
- Commit the React 19 compose-refs vendor patch (already in `node_modules`, needs git-tracking via patch or lockfile note)
- Wire `ExecutionHistoryPanel.onLoadTrace` to a `trajectoryStore` action that restores a past trace as the active trajectory
- Add a 30-second no-events timeout fallback to `LiveExecutionPanel` so the user gets feedback when a connected execution never emits task events

**Non-Goals:**
- Persistent execution history storage in trajectoryStore (the panel already fetches from activity-api via `useExecutionHistory`)
- Replay of entire execution from history into the live WS stream
- Catchup-protocol support beyond what `useWebSocket` already implements
- Responsive breakpoints or feature flags for `LiveExecutionPanel`

## Decisions

### Decision 1: Callback refs in useWebSocket (already applied)

Store `onOpen`, `onClose`, `onMessage`, `onError` in `useRef` inside the hook. The `connect` useCallback reads from refs instead of closing over the prop values directly. This means `connect`'s dependency array contains only stable values (`buildUrl`, `url`, `autoReconnect`, `maxReconnectAttempts`, `reconnectBaseDelayMs`) — all derived from primitive or stable inputs.

**Alternative considered**: Wrap caller-supplied callbacks in `useCallback` at the call sites. Rejected because it pushes the burden to every consumer of the hook; ref-inside-hook is self-contained.

### Decision 2: normalizeMiniBobEvent in useTrajectoryExecution (already applied)

A single normalization function runs on every incoming WS message before `isTrajectoryEvent()` is called. If normalization returns a non-null value, that normalized event is processed. If both the raw message and the normalized form fail `isTrajectoryEvent()`, the message is silently dropped (same as before).

**Alternative considered**: A separate MiniBob-specific hook. Rejected because the trajectory editor connects to exactly one WS endpoint at a time; a branching normalization layer in the same hook is simpler.

### Decision 3: Synthetic impulse-resolved entry for MiniBob tasks (already applied)

When a `activity:task-completed` MiniBob event is normalized to `task.completed`, the hook also synthesizes a corresponding `impulse.resolved` entry with `tier: "deterministic"` and `resolver: "minibob"`. This gives `LiveExecutionPanel`'s resolution timeline something to render for MiniBob-sourced executions without waiting for activity-api events.

**Alternative considered**: Leave the timeline empty for MiniBob executions. Rejected because users see a blank panel with no indication of what happened.

### Decision 4: No-events fallback via useEffect + setTimeout (remaining work)

Inside `LiveExecutionPanel`, a `useEffect` starts a 30-second timer when `isLiveConnected` transitions to `true` and `taskResolutions.size === 0`. If the timer fires and no events have arrived, set a local boolean state `showNoEventsNotice`. The notice renders above the resolution timeline area. The timer is cancelled when any event arrives (via `taskResolutions` dependency) or when the connection drops.

**Why 30 seconds**: Median MiniBob goal execution is 8–15 seconds. A 30s threshold means the notice only appears in genuine failure/silent cases, not slow executions.

### Decision 5: Execution history "load" connects executionId, not replay

`onLoadTrace` calls `setActiveExecutionId(trace.executionId)` on the trajectory store. This causes the existing WS connect flow to reconnect to the given execution — it doesn't attempt to replay historical events as if they were live. The resolved-task data may be sparse (no live events), but the user can see the executionId and navigate to the full execution in the Executions page.

**Alternative considered**: Restore the full task-resolution state from the trace's tasks array when loading. Deferred — requires mapping TraceSummary tasks to the `taskResolutions` Map format; can be done in a follow-on task.

### Decision 6: compose-refs patch strategy

The patch is already applied directly to `node_modules`. Since this is a Bun project, the correct long-term fix is a `patch` entry in `package.json` (bun supports `"patchedDependencies"`). For this change: create `patches/@radix-ui+react-compose-refs.patch` from the diff, add the `patchedDependencies` entry to `package.json`, and commit both. This survives `bun install`.

## Risks / Trade-offs

- **Ref-callback fire timing**: Using refs for WS callbacks means the callbacks read from refs at event time, not at subscription time. If a caller swaps `onMessage` after connection is established, the new callback takes effect immediately (no reconnect needed). This is the correct behavior but differs from the previous closed-over approach — could be surprising to future callers.

- **normalizeMiniBobEvent coverage**: The normalization only covers `activity:started`, `activity:task-completed`, and `impulse:completed`. Unknown MiniBob event types are dropped silently. If MiniBob adds new event types in the future, they will be ignored until normalization is updated.

- **30s timer granularity**: A 30-second wait in the UI feels long if the execution has already failed silently. Future improvement: expose a "no events after N seconds" prop so callers can tune the threshold. For now 30s is hardcoded.

- **Vendor patch fragility**: Patching `node_modules` directly is brittle. The `patchedDependencies` approach in `package.json` is more robust but requires that `bun install` is run with the patch present. If the patch is ever lost, React 19 compose-refs crashes return.

## Migration Plan

1. Commit MiniBob broadcast fix to `repos/minibob` branch and push (`repos/minibob` is a submodule; update pointer in super-repo).
2. Commit workbench useWebSocket ref stabilization.
3. Commit workbench normalizeMiniBobEvent + synthetic task resolution.
4. Create and commit compose-refs patch file; add `patchedDependencies` to `package.json`.
5. Implement and commit no-events fallback in `LiveExecutionPanel`.
6. Implement and commit execution history `onLoadTrace` wiring in `TrajectoryEditorPage`.
7. Validate on canary: submit a goal via trajectory editor, observe task cards animate in real time, verify 30s fallback appears when vessel is unreachable.

No schema migrations or API changes required. Rollback: revert individual commits; the three bug fixes are independent.

## Open Questions

- Should `onLoadTrace` also update the trajectory grid columns to reflect the activities in the loaded trace, or just set the executionId for WS connection? Current decision: WS connection only. Defer grid restore to a follow-on.
- Should the compose-refs patch be upstreamed to `@radix-ui/react-compose-refs`? Track as a separate issue; not blocking this change.
