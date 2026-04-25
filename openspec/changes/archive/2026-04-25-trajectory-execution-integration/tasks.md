## 1. MiniBob: goalExecution resolve endpoint

- [x] 1.1 Add `POST /v2/impulses/resolve` route to MiniBob's HTTP server (`repos/minibob/index.ts`) — accept `{ pointer: { type: string, ...rest } }`, return HTTP 400 with `{ success: false, error: "unsupported pointer type: <type>" }` for unknown types
- [x] 1.2 Implement `goalExecution` pointer handler: extract `pointer.goal`, call `processGoal(goal)` in a detached async promise (fire-and-forget), generate an `executionId` (uuid), return immediately with `{ success: true, content: "executionId: <id>\nwsUrl: <wss-url>" }`
- [x] 1.3 Wire background failure logging: if the detached `processGoal` promise rejects, catch and log to stderr (do not throw into the HTTP handler)
- [x] 1.4 Update MiniBob's discovery registration payload in `repos/minibob/src/vessel-discovery.ts`: add `"goalExecution"` to the `shapes` array and add `resolve_endpoint: "/v2/impulses/resolve"`, `resolve_request_format: "pointer"`, `auth_scheme: "ApiKey"`, `resolve_timeout_ms: 30000` to the registration object
- [x] 1.5 Verify all existing endpoints remain unchanged with a brief smoke-test pass (no regression)

## 2. Workbench: Execution History Panel

- [x] 2.1 Create `repos/workbench/src/hooks/useExecutionHistory.ts` — React Query hook that calls `POST /v2/impulses/resolve` with `{ pointer: { type: "executionTraceList", limit: 20 } }` and returns parsed trace summaries (activity name, success, duration, cost, timestamp)
- [x] 2.2 Create `repos/workbench/src/components/trajectory/ExecutionHistoryPanel.tsx` — collapsible left-sidebar panel listing up to 20 traces; each row shows activity name, success/failure indicator, duration, cost, timestamp
- [x] 2.3 Add empty state to `ExecutionHistoryPanel`: "No executions yet — run a goal to get started"
- [x] 2.4 Wire `ExecutionHistoryPanel` into `TrajectoryEditorPage.tsx` left sidebar (below or above the activity palette section)

## 3. Workbench: Trace-to-Grid Mapping

- [x] 3.1 Create `repos/workbench/src/lib/trace-mapper.ts` — `mapTraceToColumns(trace, existingActivities)` function: activities in execution order become columns; match by `activity_id` to existing columns (highlight matched); append unmatched as ghost columns
- [x] 3.2 Add ghost-column rendering to `TrajectoryGrid`: read-only columns with a "from trace" badge and greyed card styling when `source === "trace"`
- [x] 3.3 Add a "Load Trace" action on each `ExecutionHistoryPanel` row that calls `mapTraceToColumns` and: (a) if grid is non-empty, show a modal offering "Replace" or "Append"; (b) if grid is empty, load directly without a modal
- [x] 3.4 Implement per-task result overlay on activity cards: when a loaded trace has task data, show a resolver-tier badge (deterministic / pattern / llm), success/failure badge, duration (ms), cost (USD) on each card — fail overlay shows error truncated to 80 chars

## 4. Workbench: Per-Task Shape Contributions in ImpulseStatePanel

- [x] 4.1 Extend `trajectoryStore` with `traceShapeContributions: Map<taskId, { produced: string[], consumed: string[] }>` and `activeTraceId: string | null`; add `setTraceShapeContributions` and `clearTraceData` actions
- [x] 4.2 Populate `traceShapeContributions` when a trace is loaded: iterate `trace.tasks`, extract `output_impulse_ids` (produced) and `input_impulse_ids` (consumed), resolve shape names from trace metadata or fall back to template `output_shapes` (mark as "estimated")
- [x] 4.3 Update `ImpulseStatePanel` Shape Provenance section to show task-level entries when `traceShapeContributions` is populated: sub-items under each activity showing "Task N: <description>" with produced (green) and consumed (dimmed) shape badges
- [x] 4.4 Update Shape Timeline in `ImpulseStatePanel` to show one event per task (not per column) when trace data is present: include task index, description, shapes added, resolver tier
- [x] 4.5 Add "estimated" visual marker in provenance when a task falls back to template `output_shapes` (no per-task impulse data in trace)

## 5. Workbench: Live Execution Connection Panel

- [x] 5.1 Create `repos/workbench/src/components/trajectory/LiveExecutionPanel.tsx` — collapsible sidebar panel with: executionId text input, "Connect" button, status badge (idle / connecting / live / completed / failed), "Disconnect" button when live
- [x] 5.2 Add URL param auto-connect: on page load, if `?executionId=<id>` is present, auto-connect without user interaction and show "live" badge
- [x] 5.3 Wire `LiveExecutionPanel` to existing `useTrajectoryExecution` hook — "Connect" sets the `executionId` prop; status badge reflects hook's connection state
- [x] 5.4 Implement exponential-backoff reconnect in `useTrajectoryExecution` (or a thin wrapper): on unexpected WS drop, retry with delays 1s, 2s, 4s … up to 30s; send `{ type: "catchup", lastSeenSequence: N }` on reconnect to replay missed events
- [x] 5.5 Accumulate `task.completed` WS events into `traceShapeContributions` in real time during live execution: each event with `output_impulse_ids` updates the store (same model as historical traces in task 4.2)
- [x] 5.6 Wire `LiveExecutionPanel` into `TrajectoryEditorPage.tsx` left sidebar

## 6. Workbench: Goal Submission Panel

- [x] 6.1 Create `repos/workbench/src/components/trajectory/GoalSubmissionPanel.tsx` — multi-line text input, "Run" button (disabled when empty or when live execution is connected), validation hint for empty submit
- [x] 6.2 On "Run" click: `POST /v2/impulses/resolve` with `{ pointer: { type: "goalExecution", goal: "<text>" } }` via activity-api client; show loading spinner while in flight
- [x] 6.3 On success: parse `executionId` from the `content` string (`"executionId: <id>\nwsUrl: ..."`) and auto-connect `LiveExecutionPanel` to that executionId (equivalent to user manually entering it and clicking Connect)
- [x] 6.4 On failure: show inline error message with retry button — distinguish "No execution vessel available — is MiniBob running?" (discovery found no vessel for goalExecution) vs. "Execution timed out" (30s exceeded) vs. generic network error
- [x] 6.5 Add `pointer-events: none` to the trajectory grid's scroll container CSS so sidebar panels at `z-10` are not blocked by grid overflow (fixes existing speculative-preview pointer event interception bug as a side effect)
- [x] 6.6 Wire `GoalSubmissionPanel` into `TrajectoryEditorPage.tsx` left sidebar above `LiveExecutionPanel`

## 7. Verification

- [x] 7.1 Run `bun run typecheck` in `repos/workbench` and `repos/minibob` — no new type errors
- [x] 7.2 Run `bun test` in `repos/workbench` — all existing tests pass; add unit tests for `trace-mapper.ts` (match / ghost column logic) and `traceShapeContributions` store actions
- [x] 7.3 Manual smoke-test: load a historical trace from the history panel onto an empty trajectory grid and verify columns, overlays, and provenance entries render correctly
- [x] 7.4 Manual smoke-test: connect `LiveExecutionPanel` to a known completed executionId and verify cards animate then settle with final status
- [x] 7.5 Manual smoke-test: submit a goal via `GoalSubmissionPanel`, confirm auto-connect fires, and observe trajectory columns populating as task.completed events arrive
- [x] 7.6 Playwright E2E: navigate to trajectory editor, open history panel, assert at least one trace row renders (or empty state shown), load trace, assert grid has columns with result overlays
