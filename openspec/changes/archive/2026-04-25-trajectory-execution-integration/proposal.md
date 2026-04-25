## Why

The trajectory editor can design and observe activity sequences but cannot yet show what actually happened during an execution — historical traces are invisible to the authoring surface, and live execution lacks per-task state-space contribution visibility. Closing this gap makes the trajectory editor a full authoring + observation loop, enabling the learning feedback cycle to be visible in one place.

## What Changes

- **New**: Execution history panel in the trajectory editor — lists recent traces, loads one onto the grid
- **New**: Per-task result overlay on activity cards (success/failure, duration, cost, resolver-tier badge)
- **New**: Per-task shape contribution in ImpulseStatePanel — provenance tree updated with what each task produced/consumed, both statically from historical traces and incrementally during live execution
- **New**: Live execution connection panel — accepts `executionId` (URL param or input), subscribes to activity-api WebSocket, shows task-by-task progress with real-time shape accumulation
- **New**: Goal submission panel — submits a goal via impulse resolution (activity-api → discovery → MiniBob), receives `executionId`, immediately connects to live view
- **New (MiniBob, additive)**: `POST /v2/impulses/resolve` endpoint on MiniBob HTTP server handling `goalExecution` pointer type
- **New (MiniBob, additive)**: `goalExecution` added to MiniBob's discovery-advertised shapes; resolve contract fields (`resolve_endpoint`, `resolve_request_format`, `auth_scheme`) added to registration payload

## Capabilities

### New Capabilities

- `trace-history-view`: Load and display a historical execution trace onto the trajectory grid — activity sequence mapped to columns, per-task overlays (success/failure, duration, cost, resolver tier)
- `task-shape-contributions`: Show per-task input/output shape contributions in the ImpulseStatePanel, updating the provenance tree for both static (historical) and live (streaming) execution modes
- `live-execution-panel`: Connect to an in-flight execution by ID, stream task.started/task.completed/tool.call events, animate cards and accumulate shapes in real time
- `goal-submission-panel`: Submit a goal from the trajectory editor via the impulse system (workbench → activity-api /v2/impulses/resolve → discovery → MiniBob goalExecution shape) and auto-connect to the resulting live execution
- `minibob-goal-execution-resolver`: Additive MiniBob changes — expose POST /v2/impulses/resolve, handle goalExecution pointer, advertise shape + resolve contract in discovery registration

### Modified Capabilities

## Impact

- `repos/workbench/src/pages/TrajectoryEditorPage.tsx` — new panels and hooks wired in
- `repos/workbench/src/hooks/` — new hooks: `useTraceHistory`, `useTraceReplay`, `useGoalExecution`
- `repos/workbench/src/components/trajectory/` — new components: `ExecutionHistoryPanel`, `TaskResultOverlay`, `LiveExecutionPanel`, `GoalSubmissionPanel`
- `repos/workbench/src/stores/trajectoryStore.ts` — new state: `replayTrace`, `liveExecutionId`, per-task shape contributions
- `repos/minibob/index.ts` — add `/v2/impulses/resolve` route
- `repos/minibob/src/vessel-discovery.ts` — add `goalExecution` shape + resolve contract to registration
- Activity-api: no changes (existing impulse resolution routing handles discovery-forwarding)
- Discovery-vessel: no changes (existing registration + heartbeat handles new shape)
