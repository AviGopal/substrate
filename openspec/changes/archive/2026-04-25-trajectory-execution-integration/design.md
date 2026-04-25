## Context

The trajectory editor (`repos/workbench/src/pages/TrajectoryEditorPage.tsx`) has a complete authoring surface: activity palette, state-space computation, impulse-state panel, live execution overlay infrastructure (`useTrajectoryExecution`, `LiveExecutionOverlay`). However:

- `useTrajectoryExecution` only activates when given an `executionId` from a URL param — there is no UI to connect, load history, or initiate a new execution
- The `ImpulseStatePanel` computes shapes from the trajectory template structure, not from actual execution data — it has no concept of "what this task actually produced at runtime"
- MiniBob has `POST /goal` but no standard impulse resolve contract, so the workbench cannot route through the discovery layer

Key existing infrastructure to build on:
- Activity-api WebSocket at `wss://activity.metabob.com/ws` — authenticated, with catchup protocol, broadcasts `task.started`, `task.completed`, `tool.call`, `execution_started`, `execution_completed`
- `GET /v2/activities/execution-traces` / `POST /v2/impulses/resolve` with `executionTraceList` and `activityExecutionTrace` pointer types — returns full trace including per-task `input_impulse_ids`, `output_impulse_ids`, `resolver_id`, `resolver_tier`, `success`, `duration_ms`, `cost_usd`
- `useWebSocket` hook with sequence-based catchup already in workbench
- `trajectoryStore` with `activities`, `requiredShapes`, `getAvailableShapesAtColumn` — extensible

## Goals / Non-Goals

**Goals:**
- Load any recent execution trace onto the trajectory grid: activities mapped to columns in execution order, per-task overlays on each card
- ImpulseStatePanel updates provenance with actual task-level shape contributions (from trace data or live WS events)
- Live execution panel: connect by executionId, animate card progress, accumulate shapes in real time as tasks complete
- Goal submission: one input → impulse resolve → MiniBob → executionId → live view auto-connects
- MiniBob changes are strictly additive (new endpoint + registration fields, no existing behavior changed)

**Non-Goals:**
- Trajectory editor does not become a general execution dashboard (keep workbench focused on authoring + correction)
- No changes to activity-api, discovery-vessel, or identity-vessel
- No replay/scrubbing of historical traces (static snapshot only, not time-travel)
- No parallel execution visualization (single execution at a time)

## Decisions

### D1: Trace-to-grid mapping strategy
**Decision**: Map trace activities to trajectory columns by execution order (column 0 = first activity executed, column N = Nth). If a trace activity matches a template already in the grid by `activity_id`, highlight the match; otherwise append as a new column.

**Why**: Avoids requiring the trajectory to pre-exist. A user can load any trace onto a blank grid and see the full execution path. Matching existing cards enables the "I designed this, let me see how it ran" workflow.

**Alternative considered**: Require the trajectory to pre-match the trace's activity sequence. Rejected: too rigid, breaks the "load any trace" UX.

### D2: Shape contributions source of truth
**Decision**: For historical traces, parse `tasks[].output_impulse_ids` from the trace response. For live execution, accumulate shapes from `task.completed` WS events' `output_impulse_ids`. Both paths update the same `traceShapeContributions: Map<taskId, { produced: string[], consumed: string[] }>` in trajectoryStore.

**Why**: Single accumulation model works for both modes. The ImpulseStatePanel reads `traceShapeContributions` when a trace or live execution is active, falling back to template-computed shapes otherwise.

**Alternative**: Resolve each task's output impulses to get their shapes. Rejected: extra API calls per task, and `output_shapes` from the template is already the authoritative shape list — the task-level impulse IDs are for provenance only.

### D3: MiniBob impulse resolve endpoint
**Decision**: Add `POST /v2/impulses/resolve` to MiniBob's HTTP server. Request: `{ pointer: { type: "goalExecution", goal: string, context?: object } }`. Response: `{ success: true, content: "executionId: exec_xxx\nwsUrl: wss://..." }` as a text payload (matching activity-api's resolver contract format).

**Why**: Follows the standard vessel resolve contract that `callVesselResolve()` in minibob already understands. The workbench calls activity-api, which routes via discovery to MiniBob's resolve endpoint using the advertised contract. No new protocol.

**Alternative**: Add a dedicated `POST /execute` endpoint and route workbench there directly. Rejected: violates the "workbench shouldn't know MiniBob exists" principle.

### D4: goalExecution resolver implementation in MiniBob
**Decision**: The `goalExecution` handler calls existing `processGoal(goal)`, generates a `execution_id` (uuid or from backend), starts the execution asynchronously, and returns immediately with the executionId. The execution runs in the background and emits WS events to activity-api.

**Why**: Non-blocking response allows the workbench to subscribe to WS immediately without waiting for completion.

### D5: Live execution panel placement
**Decision**: Add a collapsible "Execution" panel below the goal input area in the left sidebar. Contains: executionId text input + "Connect" button, status badge (connecting/live/completed/failed), and a "Run Goal" shortcut that submits via goal-submission panel. On connect, the existing `useTrajectoryExecution` hook activates.

**Why**: Keeps the trajectory editor layout stable. The existing live overlay infrastructure handles per-card animation — we just need a UI surface to trigger it.

## Risks / Trade-offs

- **Risk**: MiniBob's `processGoal()` is synchronous and may block the HTTP handler → **Mitigation**: Run `processGoal()` in a detached promise, return executionId immediately; log errors to stderr
- **Risk**: Trace activity IDs may not match template activity IDs (templates evolve, traces reference older versions) → **Mitigation**: Show unmatched trace activities as new "ghost" columns (read-only, grey) with a "from trace" badge
- **Risk**: `output_impulse_ids` in traces may not carry enough shape metadata to reconstruct shapes → **Mitigation**: Fall back to `output_shapes` from the matched template when per-task impulse shape data is absent; mark as "estimated" in provenance
- **Risk**: Grid overflow bug (pointer events interception on sidebar) may affect new panels → **Mitigation**: Add `pointer-events: none` on the trajectory grid scroll container; sidebar panels use `z-10` to sit above

## Open Questions

- Should "Load Trace" clear the current trajectory or merge? → Default: offer both options via modal confirm
- Should live goal submission show the generated trajectory before executing, or execute immediately? → Execute immediately, trajectory populates from trace as activities run
