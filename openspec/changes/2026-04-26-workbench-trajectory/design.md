## Summary

This change unifies the workbench's fragmented execution, composition, monitoring, and goal surfaces into a single **Trajectory** page. The current `TrajectoryEditorPage` is renamed to `Trajectory` and promoted from an authoring tool into the canonical surface for all activity-related work: live monitoring of a connected vessel, historical trace inspection with multi-trace diff, composition of new templates, execution dispatch, and goal-resolution with predictive overlays.

The redesign is motivated by post-completion state of the 2026-04-26 sibling specs (`impulse-binding-selection-layer`, `validators-and-failure-modes`, `shape-provider-goal-creation`). Those specs produce a rich stream of per-task observable state — binding phase slots, validation verdicts, failure modes, impulse I/O arrays, lifecycle events — that cannot be represented coherently across five separate pages. Concentrating the surface eliminates context switching and makes the full execution story readable in one place.

## Context

After completion of the 2026-04-26 sibling specs, the system emits the following observable state during a single activity execution:

**Per task, before execution** (`lifecycle:task:preBinding` WS event):
- Shape slots with binding state: `{ taskId, slots: [{ shape, state: 'pending'|'bound'|'unbindable', impulseId? }] }`
- `presentShapesPre` — impulses in the pool before binding
- `missingShapesPre` — shapes declared in `inputShapes` with no pool candidate
- `parentGoalText`, `parentDepth`, `executionId` — lifecycle context fields

**Per task, during execution**: tool call events, LLM streaming, impulse resolution events

**Per task, after execution** (`lifecycle:task:completed` WS event):
- `status`, `outputShapes`, `durationMs`, `skip_validation`
- `allImpulseIds` — full cross-task pool the task saw
- `loadedImpulseIds` — subset actually materialized
- `toolCallRecords` — per-call `{ tool, arguments, result }` array

**Asynchronously, from validator-dispatch meta-activity** (`impulse.resolved` event, shape `validation_result`):
- `{ passed, confidence, validator_id, failure_mode?, evidence[], messages[] }`

**From activity-api broadcaster** (`impulse.resolved` WS event):
- Canonical flat shape: `{ execution_id, impulse_id, resolver_id, resolver_tier, vessel_id, latency_ms, cost_usd, task_id?, shape?, body? }`

**From execution trace (historical)**:
- `tasks[].input_impulse_ids` / `tasks[].output_impulse_ids` — per-task impulse grouping
- `tasks[].resolver_id`, `tasks[].resolver_tier`, `tasks[].success`, `tasks[].cost_usd`
- `failure_mode: { type, reason, context }` — structured taxonomy
- `parent_execution_id`, `composition_chain` — nested execution provenance
- `vessel_id`, `vessel_version` — vessel attribution

The workbench must render all of this in a single coherent surface. Distributing it across five pages makes the signal uninterpretable.

## Foundational Framing

The **informational state** contains all possible and impossible impulses — the complete space of everything that could ever be known or computed. Only a subset is reachable: the shapes producible by resolvers across vessels currently connected to the network. The connected network may span millions of vessels and trillions of resolvers. Only a further subset has been sampled: the paths the system has actually traversed, recorded as execution traces, and modeled as Thompson posteriors.

```
  INFORMATIONAL STATE (complete, infinite)
  ════════════════════════════════════════

              ░░░░░░░░░░░░░░░░░░░░░░░░░
            ░░░░░  ┌───────────────┐  ░░░░░
          ░░░░░░░  │   REACHABLE   │  ░░░░░░░
        ░░░░░░░░░  │ (resolvers in │  ░░░░░░░░░
        ░░░░░░░░░  │  connected    │  ░░░░░░░░░
        ░░░░░░░░░  │  vessels)     │  ░░░░░░░░░
        ░░░░░░░░░  │  ┌──────────┐ │  ░░░░░░░░░
        ░░░░░░░░░  │  │ LEARNED  │ │  ░░░░░░░░░
        ░░░░░░░░░  │  │ (traces, │ │  ░░░░░░░░░
        ░░░░░░░░░  │  │ Thompson │ │  ░░░░░░░░░
        ░░░░░░░░░  │  │ posts.)  │ │  ░░░░░░░░░
        ░░░░░░░░░  │  └──────────┘ │  ░░░░░░░░░
          ░░░░░░░  └───────────────┘  ░░░░░░░
            ░░░░░░░░░░░░░░░░░░░░░░░░░
```

The purpose of the impulse-activity system is to learn the **topology** of the composition graph — which activities connect which shapes, and which paths lead to goal-satisfying states, for any arbitrary goal. The composition graph is not static or known in advance; it is continuously discovered through execution. Every trace is a sample. Thompson Sampling is not optimizing over a known space; it is building a probability model over a topology that may never be fully mapped.

A trajectory is a **hypothesis about a path** through this graph. The three connection states formalize this:

| State | What it actually is |
|---|---|
| **Composed** | A hypothesis — an authored path through partial topology knowledge |
| **Attached** | Live exploration — discovering whether the hypothesis holds |
| **Recalled** | A recorded sample — evidence about local topology at the time of execution |

This framing has direct consequences for the workbench surface:
- Ghost tasks (D6) are the system's **topology prior**, not a prediction about known-activity performance
- Multi-trace diff (D5) is **comparing two explorations** of the same region of the graph
- Nesting depth (D3 Layer 2) is **exploration depth** into less-mapped territory
- The `unbindable` binding state is the system reaching the **edge of its reachable subgraph**
- Frontier indicators (D10) surface the boundary between well-sampled and lightly-sampled topology
- The `unbindable` state has two distinct failure modes (D11) that require different responses

---

## Decisions

### D1: Three connection states — Composed, Attached, Recalled

**Decision**: A trajectory is always in exactly one of three states. The `ViewModeStrip` already implements a three-way `compose | trace | live` pill indicator; this formalizes its semantics as a first-class state machine.

**Composed** — the trajectory is a locally-edited template sequence, not yet executed. Tasks show their declared `inputShapes` and `outputShapes` from the template. All editing operations (add, remove, reorder, edit task config) are available. The composition is authored via drag-and-drop from the activity palette and inline `TaskEditor` edits.

**Attached** — the trajectory is live-streaming from a connected vessel WebSocket. A `selectedVesselEndpoint` is active; `useTrajectoryExecution` is connected and routing events to store state. Binding phase overlays, live task status, impulse pool updates, and validation results arrive in real time. Editing operations are disabled; inspection controls are enabled.

**Recalled** — a historical execution trace is loaded from activity-api into the trajectory canvas. Task cards display per-task trace data (resolver tier, cost, duration, impulse I/O). A second trace can be loaded alongside for multi-trace diff. The trajectory can be forked into Composed state for editing.

**Transitions**:
- Composed → Attached: user clicks Run in `GoalSubmissionPanel` or `InlineExecutionBar`. The trajectory is dispatched to the connected executor; `activeExecutionId` and `activeWsUrl` are set; mode becomes Attached.
- Attached → Recalled: user clicks a trace row in `ExecutionHistoryPanel`. `handleLoadTrace` replaces trajectory activities with trace columns; `activeTraceId` and `loadedTrace` are set; mode becomes Recalled.
- Recalled → Composed: user clicks "Edit / Fork" on the Recalled trajectory. `activeTraceId` is cleared; template columns remain; mode becomes Composed with `isDirty = true`.
- Attached → Composed: user clicks Disconnect. `activeExecutionId` is cleared; mode becomes Composed.

**Rationale**: The three-state model is already partially implemented. `isLive` (Attached), `loadedTrace` (Recalled), and neither (Composed) map directly to the existing boolean checks in `TrajectoryEditorPage`. Formalizing the state machine makes the transitions explicit and eliminates partial states where both `loadedTrace` and `activeExecutionId` are set simultaneously.

### D2: Five capabilities unified in Trajectory

**Decision**: The following capabilities all live in the Trajectory page. Each is an aspect of the same surface, not a separate page.

**1. Live monitoring (Attached mode)**
Connect to any registered vessel endpoint via `VesselSelectorPanel`. Subscribe to its WebSocket. The trajectory canvas shows the currently executing activity in real time: task status pulses, binding phase slots populate before each task, impulse resolutions appear as badges on task edges, validation results appear on task card headers. The `ExecutionHistoryPanel` sidebar strip shows recent executions from the same vessel for quick navigation.

**2. Historical trace viewing with diffs (Recalled mode)**
Load any trace from `ExecutionHistoryPanel` into the canvas. Each task card shows the historical resolver tier, duration, cost, and per-task impulse I/O from `tasks[].input_impulse_ids` / `output_impulse_ids`. Load a second trace alongside (same activity template or variant) to enter multi-trace diff mode (D5).

**3. Composition (Composed mode)**
Author new activity templates by dragging from the palette, editing tasks inline via `TaskEditor` (resolver, inputShapes, outputShapes, validation rules, retry config), and connecting activities in sequence or parallel. Save to activity-api via `POST /v2/activities/templates`. The composition is the primary editing surface; the `CompositionBuilderPage` DAG editor is deprecated in favor of the inline trajectory editor.

**4. Execution (Composed → Attached transition)**
Run the composed trajectory by clicking Run. `submitTrajectory` posts the activity sequence to the selected vessel endpoint or to activity-api's `trajectoryExecution` resolver. On successful dispatch, `activeExecutionId` is returned and the trajectory transitions to Attached mode.

**5. Goal resolution with prediction (goal mode within Composed)**
Enter a goal text in `GoalInputBox`. The system queries `POST /v2/goal-paths/recommend` and `POST /v2/activities/recommend` to render a predictive overlay: ghost tasks derived from the top recommended path, duration estimate, shape flow prediction. As real execution proceeds, ghost tasks are replaced by live tasks. Divergence from prediction is annotated.

**Non-goals for D2**: The TemplatesPage (browse/search templates) remains separate. Clicking a template there opens it in Trajectory Composed mode, consistent with the existing `location.state.template` navigation. The ShapesPage (impulse shape catalog) remains separate.

### D3: Per-task layered display

**Decision**: Each task card in the trajectory has three expandable inline layers, visible in Attached and Recalled modes. In Composed mode only the authoring layer is visible.

**Layer 1 — Binding** (visible pre-task in Attached, from trace in Recalled):
Populated from `lifecycle:task:preBinding` WS events (Attached) or reconstructed from `tasks[].input_impulse_ids` + `impulseShapeMap` (Recalled). Displays:
- Per `inputShape` slot: binding state badge (`bound` / `bindable` / `unbindable`) from `BindingSlot.state`
- For bound slots: the concrete impulse instance — `impulseId`, shape, pointer summary. In Recalled mode, impulse IDs are cross-referenced to the trace's `impulse_resolutions` array to retrieve shape and resolver.
- For unbindable slots: the escalation that fired (whether `create-shape-provider-goal` was dispatched as a nested execution) and its outcome.
- For bound slots with multiple candidates: the pool alternatives, each showing shape, `impulseRelevance` α/β (from `useThompsonScores` backed by `POST /v2/impulses/resolve` with `pointer.type: "impulseRelevance"`), and a "use this one" button that writes `impulseRelevance_write`.

**Layer 2 — Execution**:
- Resolver tier badge (`deterministic` / `pattern` / `llm`) and resolver ID sourced from `impulse.resolved` events (Attached) or `tasks[].resolver_tier` / `tasks[].resolver_id` (Recalled).
- Tool call sequence: each tool call shows `{ name, arguments_summary, result_shape, cost_usd, duration_ms }`. Arguments and results show impulse references resolved to shape summaries, not raw content. Sub-activity dispatches (nested executions via the `activity` resolver) render as an inline nested trajectory node expandable in place.
- For Attached mode: tool calls arrive live via WS `tool.call` events and are appended as they fire.

**Layer 3 — Output**:
- Per `outputShape`, the concrete impulse produced: `impulse_id`, shape name, pointer type summary, optional body sample (for memo-pointer impulses where `body` is present in the `impulse.resolved` event per F-9's contract).
- Data source in Attached: `task.completed` `output_impulse_ids` + `impulse.resolved` events. Data source in Recalled: `tasks[].output_impulse_ids` + `impulse_resolutions` array from the trace.

**Validation indicator** (always visible on the card header, not a layer):
- Pass: green badge with `min(confidence)` across all validators for the task.
- Fail: red badge with `failure_mode.type` (e.g., `verifier_negative`).
- No validators: gray badge.
- Data source: `taskValidations` store map populated via `routeValidationResultImpulse` (Attached) or reconstructed from trace `output_impulses` with shape `validation_result` (Recalled).

**Rationale**: The three layers map directly to the three lifecycle phases the sibling specs define: pre-binding, execution, post-execution. The layered display makes the phases scannable (collapsed by default) without hiding any detail. Per-task content is co-located with its task card rather than scattered across the `ImpulseStatePanel` sidebar.

### D4: Impulse pool panel

**Decision**: `ImpulseStatePanel` (existing, right sidebar, hidden below `xl:`) is retained as the persistent accumulated pool view. Its role is clarified:

- The panel shows the **accumulated shape pool at the selected task column**, not just the current task. Shapes are types (strings), not instances. Per-shape entries list the concrete impulse instances available at that column: `{ impulse_id, shape, source_task_id, pointer_summary, relevance_alpha, relevance_beta }`.
- When a task is selected, the panel highlights which pool entries were consumed (`input_impulse_ids`) and which were produced (`output_impulse_ids`) by that task.
- Clicking an edge connector between tasks (shape flow connector) highlights all pool entries that flowed through that edge, tracing the impulse from its source task to its consuming task.
- The "Bindable Slots" card (Phase 6.1, already landed) is retained and promoted: it shows the live binding state per slot from `bindingPhase` store. Candidate list expansion shows each candidate impulse with its relevance α/β and the "use this one" override button.

**Key distinction — shapes vs instances**: The pool contains multiple impulses of the same shape (e.g., two `bash_output` impulses from two different tasks). The panel must show them as distinct entries, not collapsed to one shape label. The `impulseShapeMap` (`impulse_id → shape`) built from `impulse.resolved` events enables this.

**Data sources**:
- Accumulated pool: derived from `traceShapeContributions` (Recalled) or `taskResolutions` + `taskImpulseIds` (Attached).
- Relevance scores: loaded on demand from `POST /v2/impulses/resolve` with `pointer.type: "impulseRelevance"`, scoped to `impulse_id` and `task_id`.

### D5: Multi-trace diff

**Decision**: In Recalled mode, `ExecutionHistoryPanel` gains a "Load alongside" action on each trace row (in addition to the existing "Load" action that replaces). When a second trace is loaded alongside, the trajectory canvas enters multi-trace diff mode.

**Visual representation**:
- Tasks are displayed in parallel rows within each column: row 0 = trace A (primary), row 1 = trace B (secondary).
- Task pair comparison highlights:
  - **Binding diff**: which impulse instance was bound for the same shape slot — different `impulse_id` for same shape, shown as `id_A ≠ id_B` with pointer summaries both visible.
  - **Execution diff**: tool calls that differ — different arguments, different result shapes, or one trace skipped a tool the other used. Rendered as a side-by-side sequence of tool badges with `≠` markers.
  - **Output diff**: output impulse IDs that differ for the same `outputShape`.
  - **Outcome diff**: one task succeeded and the other failed — shown with the `failure_mode.type` from the failing trace.
- Diff data is computed by `computeTaskDivergences` (existing, in `trace-divergence.ts`) extended to accept two `TaskSummary` objects for pairwise comparison rather than one template + one trace.
- The `taskDivergences` map passed to `TrajectoryGridWithDnd` includes entries for both trace A and trace B rows.

**Entry points for multi-trace diff**:
1. `VariantComparisonPanel` (already exists, `trajectory/VariantComparisonPanel.tsx`) navigates to Trajectory with two trace IDs in URL query params (`?traceA=<id>&traceB=<id>`).
2. `ExecutionHistoryPanel` "Load alongside" action.
3. TemplatesPage "Compare variants" button with pre-selected activity template.

**Primary use case**: debugging why variant A succeeded and variant B failed; identifying which impulse binding decision caused the divergence. This is the human-assisted path for creating improved variants.

### D6: Goal resolution prediction

**Decision**: When goal mode is active (goal text set in Composed mode), the system renders a predictive trajectory overlay before execution starts.

**Prediction queries** (sequential, cacheable):
1. `POST /v2/goal-paths/recommend` with `{ goal_text, endpoint_output_shape }` → returns `path_activities[]` (ordered activity ids), Thompson α/β for the path, and `endpoint_output_shapes`.
2. `POST /v2/activities/recommend` with `{ expected_output_shapes, goal_text }` → returns top candidate activities with `composition_score`.
3. `GET /v2/activities/templates?id=<id>` for each activity in the recommended path → fetch full template structure (tasks, inputShapes, outputShapes).

**Overlay rendering**:
- Ghost tasks are rendered with 40% opacity on the trajectory canvas, positioned at the columns they would occupy if the predicted path executes.
- Ghost cards show: activity name, estimated task count, estimated duration (from `activityMetrics` impulse resolved via `pointer.type: "activityMetrics"`), Thompson confidence interval (from `ConfidenceInterval` component, already in `trajectory/ConfidenceInterval.tsx`).
- Shape flow connectors between ghost tasks are rendered in dashed style.

**Divergence highlighting**:
- As real execution proceeds in Attached mode, ghost tasks at the current column are replaced by live tasks.
- When the live activity ID at a column matches the predicted activity ID, the overlay collapses cleanly.
- When the live activity differs (Thompson Sampling selected a different variant, or the user manually chose a different activity), the ghost task at that column is shown struck-through alongside the live task, with a divergence annotation: `"predicted: <ghost_id>, actual: <live_id>"`.
- `DivergenceAnnotation` type (already defined in `types/index.ts`) carries this; the `taskDivergences` map already threads to `TrajectoryGridWithDnd`.

**Rationale**: Ghost tasks make goal-resolution transparent. Users can see what the system planned and where it deviated, without reading raw Thompson scores. This is the interaction surface for understanding whether the prior is calibrated.

### D7: Page consolidation

**Decision**: The following surfaces collapse into Trajectory. Routes are redirected; components are absorbed.

**Deprecated pages** (route redirects to `/trajectory-editor`):
- `ExecutionsPage` (`/executions`) — becomes a search/browse entry point only. Clicking any trace row opens it in Trajectory Recalled mode (`navigate('/trajectory-editor', { state: { traceId } })`). The trace list itself moves into `ExecutionHistoryPanel` inside Trajectory. `ExecutionsPage` becomes a thin shell with search + filter that navigates out on click rather than opening a dialog. This eliminates the duplicate execution-browsing UX.
- `GoalsPage` (`/goals`) — goal input moves into Trajectory's `GoalInputBox` (already present in the sidebar). `GoalsPage` redirects to `/trajectory-editor`. The `PathVisualization` and `PathPrediction` components migrate into the ghost-task overlay (D6).
- `LiveExecutionMonitor` component — absorbed into Trajectory Attached mode. The monitor's Gantt timeline and flame graph views become secondary views accessible from the task card header (collapse/expand buttons), not a separate page. `ExecutionsPage` retains the monitor for users navigating from deep links that lack a vessel connection.
- `CompositionBuilderPage` (`/compositions/builder`) — the React Flow node editor is deprecated as the primary authoring surface. Trajectory's inline TaskEditor is the replacement. `CompositionBuilderPage` is retained as a legacy URL (no redirect) but removed from the sidebar navigation.
- `CompositionPage` (`/composition`) — the composition graph view is retained as a read-only visualization of `compositionSuccess` edges, accessible via a "View composition graph" link from Trajectory. Route `/composition` is kept; the page becomes read-only.

**Pages that remain separate and unchanged**:
- `TemplatesPage` (`/templates`) — browse and search activity templates. Clicking a template opens it in Trajectory Composed mode via `location.state.template`.
- `ShapesPage` (`/shapes`) — impulse shape catalog. No change.
- `StudioPage` (`/studio`) — if present, no change.

**Sidebar navigation changes**:
- Remove: Executions link (or keep as shortcut to Trajectory with history panel expanded)
- Remove: Goals link
- Remove: Composition Builder link
- Keep: Templates, Shapes, Trajectory (renamed from "Trajectory Editor")
- Rename: "Trajectory Editor" → "Trajectory"

**Rationale**: The pages that are deprecated all represent partial views of execution state. A user watching a live execution must currently switch between GoalsPage (goal input), TrajectoryEditorPage (live overlay), and ExecutionsPage (trace details). Consolidation eliminates that context switching.

### D8: WebSocket contract

**Decision**: The Trajectory page consumes two WS streams simultaneously when in Attached mode:

**Stream 1 — Vessel WebSocket** (minibob direct, at `activeWsUrl` when vessel endpoint is selected):
Events emitted via minibob's `wsManager.broadcast(type, data)`, wrapped as `{ type, timestamp, data: <payload> }`.

| Event type | Payload fields (under `data`) | Consumed by |
|---|---|---|
| `lifecycle:task:preBinding` | `taskId, activityId, slots[{shape, state, impulseId?}], presentShapesPre, missingShapesPre, executionId, parentGoalText, parentDepth` | `setTaskBindingPhase(taskId, slots)` |
| `activity:task-completed` | `taskId, executionId, status, outputShapes` | `normalizeMiniBobEvent` → `task.completed` handler |
| `activity:started` | `templateId, executionId` | `normalizeMiniBobEvent` → `task.started` handler |
| `impulse:completed` | `impulseId` | `normalizeMiniBobEvent` → `impulse.resolved` handler |

**Stream 2 — Activity-API WebSocket** (`wss://activity.metabob.com/ws`, when vessel endpoint not set or as secondary stream for historical context):
Events emitted from activity-api's `wsManager.broadcast()`, sequence-numbered, with catchup protocol.

| Event type | Payload fields | Consumed by |
|---|---|---|
| `task.started` | `activityId, taskId, taskIndex` | `clearTaskBindingPhase`, `setActiveActivityId`, `updateExecutionProgress` |
| `task.completed` | `activityId, taskId, success, output_impulse_ids[], input_impulse_ids[]` | `addTaskShapeContribution`, `setTaskImpulseIds`, accumulated impulse set |
| `impulse.resolved` | `execution_id, impulse_id, resolver_id, resolver_tier, vessel_id, latency_ms, cost_usd, task_id?, shape?, body?` | `setImpulseShape`, `addDiscoveredShape`, `addTaskResolution`, `routeValidationResultImpulse` |
| `tool.call` | `execution_id, task_id, tool_name, arguments, result, cost_usd, duration_ms` | (new) per-task tool call log for Layer 2 display |

**Authentication**: WS connection sends `{ type: "authenticate", token: apiKey }` as the first message (existing handshake). Catchup: `{ type: "catchup", lastSeenSequence: n }` on reconnect.

**WS event gaps that require backend work**:
- `tool.call` events are defined in the WS types (`tool.call` event type referenced in concept-db's `ExecutionObserver`) but are not yet emitted with the per-task `tool_name/arguments/result` payload needed for Layer 2 display. Activity-api must emit `tool.call` events from `execution-traces.ts`'s per-task burst, sourcing from `tasks[].tool_calls`. This is a backend requirement.
- The vessel-direct stream (`activity:task-completed`) does not carry `input_impulse_ids` — it must be enriched from the per-task trace or the workbench must fall back to `impulseShapeMap` reconstruction.

### D9: Backend query contract

**Decision**: The Trajectory page queries activity-api for the following historical data. All endpoints are existing; fields marked (new) require backend work.

**Execution trace list** (drives `ExecutionHistoryPanel`):
- `POST /v2/impulses/resolve` with `pointer.type: "executionTraceList"`, `limit`, `activity_template_id`, `since`, `success_only` filters.
- Returns: `[{ executionId, activityName, success, durationMs, costUsd, tasks[{id, success, resolverTier, inputImpulseIds, outputImpulseIds}], failureMode? }]`

**Single trace detail** (drives Recalled mode task cards):
- `POST /v2/impulses/resolve` with `pointer.type: "executionTraceWithSignatures"`, `executionId`.
- Returns full trace with `impulses_by_id` map and per-task `input_impulse_ids` / `output_impulse_ids`.
- The `impulses_by_id` map enables the workbench to resolve concrete impulse instances for Layer 1 binding display without additional queries.

**Thompson scores for activity variants** (drives ghost task confidence and `ApplicableActivitiesPanel`):
- `GET /v2/activities/:id/variant-scores` (parallel fan-out per activity in the trajectory).
- Returns: `[{ variantId, alpha, beta, sample_count }]`

**Goal path recommendation** (drives D6 prediction):
- `POST /v2/goal-paths/recommend` with `{ goal_text, endpoint_output_shape?, limit }`.
- Returns: `[{ path_activities[], alpha, beta, sample_count, endpoint_output_shapes }]`

**Discover by shapes** (drives `ApplicableActivitiesPanel` and `BackwardChainingPanel`):
- `POST /v2/activities/discover-by-shapes` with `{ required_shapes, mode: "forward" | "backward" | "candidates_with_scores", output_shapes?, predecessor_activity_id? }`.
- Returns activities with optional `composition_score: { alpha, beta, sample_count }`.

**Impulse relevance** (drives pool candidate rankings in Layer 1):
- `POST /v2/impulses/resolve` with `pointer.type: "impulseRelevance"`, `impulse_id`, `task_id`.
- Returns `{ alpha, beta, last_used_at, times_execution_succeeded, times_execution_failed }`.

**Goal execution paths** (drives backward chaining and shape-provider escalation):
- `GET /v2/goal-paths?endpoint_output_shape=<shape>` — filter paths by terminal output shape (Phase 2.5, already landed).

**New backend query needed — trace comparison for multi-trace diff** (D5):
- The workbench needs two full traces simultaneously for diff. Current `executionTraceWithSignatures` returns one trace. Either: (a) fetch twice in parallel (acceptable — two sequential POST calls), or (b) a future `executionTraceBatch` shape that accepts `[executionId]` and returns an array. For now, parallel fetch.

**New backend query needed — nested execution children**:
- When a task dispatches a sub-activity (slot-binding's `escalate_unbindable` → `create-shape-provider-goal`), the workbench needs to load the child execution to render it as an inline nested trajectory node. Query: `POST /v2/activities/execution-traces?parent_execution_id=<id>` (filter by `parent_execution_id`, already a field on the trace schema). This endpoint filter does not yet exist on the list endpoint — it is a backend requirement.

### D10: Frontier indicators

**Decision**: Task card edge connectors and ghost task cards display a **frontier indicator** reflecting how well-sampled the current region of the composition graph is.

Three states:
- **Well-mapped** (solid green connector): `sample_count ≥ 10` and CI width `< 0.3`. The system has strong topology evidence; this path is reliable.
- **Lightly sampled** (amber dashed connector): `sample_count ∈ [1, 9]` or CI width `≥ 0.3`. Some evidence; path is plausible but not stable.
- **Frontier** (red dotted connector): `sample_count = 0` or activity ID not found in variant-scores. First execution here is improvisation; the system is extending into unmapped topology.

**Data source**: `sample_count` and CI width derived from the variant-scores fan-out (`GET /v2/activities/:id/variant-scores`), already performed for `ApplicableActivitiesPanel`. No additional queries required — reuse the same response per-activity.

**Display**: small colored indicator dot on each task card's left-edge connector. Tooltip: `{N} traces · CI {lower}–{upper}`. Ghost task cards always render frontier or lightly-sampled indicators (they are unexecuted hypotheses by definition).

**Rationale**: frontier indicators give users immediate topology legibility. A well-mapped trajectory is one the system knows and can learn from efficiently. A frontier trajectory is an experiment — high uncertainty, high discovery value, potentially high failure rate. Authors need this signal before committing to Run.

### D11: Unbindable state — two discriminated failure modes

**Decision**: The `unbindable` binding slot state distinguishes two failure modes that require different system responses.

**`unreachable`**: A producer for this shape exists in the known topology (execution traces confirm some vessel has produced it), but no vessel currently connected to the network can resolve it. The shape is in the reachable subgraph somewhere; the relevant vessel is offline or unregistered.
- UI: amber indicator, "shape producer not connected" tooltip, link to VesselSelectorPanel.
- System response: do not auto-escalate. Pause and surface to user for vessel connection or manual override.

**`unknown_producer`**: No resolver for this shape exists in the known topology. Either the shape has never been produced, or a producer exists somewhere in the informational state but has never registered with discovery-vessel.
- UI: red indicator with escalation badge, "dispatching shape-provider goal" label when `create-shape-provider-goal` fires.
- System response: escalate via the slot-binding meta-activity's escalation task. This is exploration into unmapped topology.

**Backend requirement**: `producer_selection` resolver must be extended to check both (a) discovery-vessel registry for currently registered producers and (b) execution traces for historical producers, then return `{ unbindable: true, reason: "no_connected_vessel" | "no_known_producer" }`. Without the `reason` field, the workbench cannot distinguish the two cases.

## Non-Goals

- No changes to activity-api SurrealDB schema. All new display data comes from existing fields (`tasks[].input_impulse_ids`, `failure_mode`, `parent_execution_id`, `composition_chain`).
- No changes to the `impulse.resolved` event contract beyond what F-9 landed (flat payload with optional `body`). The workbench's `parseValidationResult` defensive parser is retained.
- No new HTTP REST endpoints for the workbench to call. All data flows through existing `POST /v2/impulses/resolve` shapes, `POST /v2/activities/discover-by-shapes`, and `GET /v2/activities/templates`.
- No changes to minibob's WS broadcast format. The workbench's `normalizeMiniBobEvent` path (which converts minibob's `activity:task-completed` wrapping to `task.completed` flat form) is retained.
- No real-time collaborative editing. The trajectory is single-user; concurrent edits are not handled.
- No mobile breakpoints. The trajectory editor's CSS-grid layout is desktop-only; responsive design is deferred (previously noted as deferred in workbench v0.3.x notes).
- No E2E Playwright tests in this spec. Unit tests for new store actions and diff logic are required; E2E deferred per project pattern.
- No deprecation of activity-api's legacy `/v2/vessels/*` endpoints (those are separately tracked).
- The `StateDiffViewer` component (split/unified file diff) is not deprecated; it remains accessible from the Recalled mode trace view as a "file diff" tab within a task's execution layer.

## Resolved Questions

**OQ1 → Resolved**: Add `tool.call` burst universally to `execution-traces.ts` broadcaster. Tool calls are resolver invocations that probe the informational state — they are atomic topology-learning events that apply to all activity executions. Deferral to Recalled-only is rejected; Layer 2 live tool call display in Attached mode is a first-class requirement for observing live graph exploration.

**OQ2 → Resolved**: Nesting depth is exploration depth into less-mapped topology. The nested trajectory node uses the same `TrajectoryGrid` component recursively (trajectory = activity = same component at every level). Depth control: 1-level auto-expand inline; depth > 1 renders a "→ explore sub-trajectory" link navigating to `/trajectory-editor` with the child `executionId`. The link label reads "sub-exploration · depth {N}" sourced from `composition_chain.length`. No arbitrary cap on actual nesting depth — the display limit is a rendering heuristic, not an architectural constraint.

**OQ3 → Resolved**: Always dual-subscribe in Attached mode. The two streams serve non-overlapping lifecycle phases:
- Vessel stream → binding phase events (pre-task, before trace write; cannot come from activity-api)
- Activity-api stream → canonical post-task events (after trace write; authoritative)
If both streams emit `task.completed` for `(executionId, taskId)`, activity-api is authoritative; the vessel stream's `activity:task-completed` is discarded. This is the universal architecture for any activity execution — not trajectory-specific.

**OQ4 → Resolved**: Load-alongside primary; post-load filtered search secondary. Comparison scope: same `activity_template_id` — comparing two explorations of the same path through the graph. Cross-template comparison (different paths through different graph regions) belongs on CompositionPage, not Trajectory.

**OQ5 → Resolved**: Path-level CI (from `POST /v2/goal-paths/recommend` α/β) displayed in the trajectory header/prediction summary bar — answers "how well-explored is this entire path?" Per-activity CI (from variant-scores fan-out) displayed on individual ghost task cards — answers "how well-explored is this specific edge?" Both are served by existing data sources. The variant-scores fan-out is already performed for live activities; ghost tasks reuse the same parallel GETs.

**OQ6 → Resolved**: Fork invokes the ribosome pattern (`assembleTemplateFromExecution`). Copies activity template structure from the trace; produces a new activity template in Composed mode with `isDirty = true`. Automatic impulse carry-through is rejected: it conflates instructional state (the template — what the activity does) with functional state (specific impulse instances — what one execution happened to use). Users who want to reproduce specific starting conditions declare them explicitly as seed shapes in InitialPoolBar.

---

## UI Design Constraints and Guidelines

### Aesthetic system

The workbench uses a compact monospace aesthetic throughout. These rules are non-negotiable for any new components — maintain visual consistency with the existing surface.

**Typography**
- Primary font: `font-mono` for all labels, values, headings, and body text within the trajectory surface
- Heading: `text-sm font-mono font-medium tracking-tight`
- Label: `text-xs font-mono`
- Subtext / metadata: `text-[10px] font-mono text-muted-foreground/60`
- Do not use sans-serif or `font-sans` anywhere on the Trajectory page

**Density**
- Padding: `px-3 py-2` on cards, `px-4 py-2` on the header bar, `p-3` on sidebar sections
- Gap: `gap-2` between sibling controls, `gap-1` within control groups, `gap-0.5` for tightly packed badges
- Border radius: `rounded` (not `rounded-lg` or `rounded-xl`) for all data surfaces; `rounded-md` for dialogs and panels
- Height of control rows: `h-7` for secondary buttons, `h-5` for icon-only buttons, `h-4` for inline badges

**Color tokens — use semantic tokens, never raw colors**

| Token | Use |
|---|---|
| `bg-card` | Panel and sidebar backgrounds |
| `bg-background` | Page background |
| `bg-muted/20` | Subtle stripe or row highlight |
| `border-border/50` | Panel borders |
| `border-border/30` | Internal dividers |
| `text-muted-foreground` | Secondary labels |
| `text-muted-foreground/60` | Tertiary metadata |
| `text-muted-foreground/30` | Decorative separators |

**Accent colors — trajectory-specific semantic meanings**

| Color | Meaning |
|---|---|
| `green-400/70` (input shape) | Shapes flowing into a task |
| `violet-400/70` (output shape) | Shapes produced by a task |
| `blue-500` (live) | Active execution, WS connected |
| `yellow-500` (pattern tier) | Pattern resolver tier |
| `green-500` (deterministic tier) | Deterministic resolver tier |
| `blue-500` (llm tier) | LLM resolver tier |
| `green-500` (well-mapped) | Frontier indicator: high sample count |
| `amber-500` (lightly sampled) | Frontier indicator: few traces |
| `red-500` (frontier / unknown_producer) | Frontier indicator: no traces / unbindable |
| `amber-500` (unreachable) | Unbindable state: vessel not connected |

**Animation**
- Live execution pulse: `animate-pulse` on the live badge and active task indicator only
- No CSS transitions on data values (avoid motion sickness during rapid WS updates)
- `animate-pulse` must be removed when the execution completes or WS disconnects

### Layout primitives

The Trajectory page uses a three-region flex layout, fixed at full viewport height. Regions must not wrap.

```
┌──────────────────────────────────────────────────────────────────┐
│ HEADER  border-b border-border/50 bg-card px-4 py-2             │
├──────────────────────────────────────────────────────────────────┤
│ LEFT PANEL      │  CENTER CANVAS          │  RIGHT PANEL         │
│ w-64 shrink-0   │  flex-1 min-w-0         │  hidden xl:flex      │
│ border-r bg-card│  overflow-hidden        │  w-80 border-l       │
│ overflow-y-auto │                         │  bg-card             │
│                 │  ViewModeStrip          │                      │
│ VesselSelector  │  InlineExecutionBar     │  ImpulseStatePanel   │
│ GoalSubmission  │  TrajectoryGridWithDnd  │  (AccumulatedShapes  │
│ ActivityPalette │                         │   BindableSlots)     │
│ ─────────────   │                         │                      │
│ ExecutionHistory│                         │                      │
│ BackwardChaining│                         │                      │
└──────────────────────────────────────────────────────────────────┘
```

- The left panel (`w-64`) is fixed-width and does not resize
- The center canvas (`flex-1`) owns horizontal scroll for the trajectory grid
- The right panel is `hidden xl:flex` — only visible at ≥1280px viewport
- The header is always visible; it does not scroll

**Trajectory grid inner layout (center canvas)**

The grid is a horizontal CSS grid where each column is one activity (or one ghost activity). Columns are not fixed-width; they expand to fit their content. Tasks within a column are stacked vertically.

```
  col-1          col-2          col-3
  ┌───────────┐  ┌───────────┐  ┌───────────┐
  │ ActivityA │  │ ActivityB │  │ ActivityC │
  │ ─────── │  │ ─────── │  │ ─────── │
  │ task-1   │  │ task-1   │  │ task-1   │
  │ task-2   │  │ task-2   │  │ task-2   │
  │ task-3   │  │           │  │ task-3   │
  └───────────┘  └───────────┘  └───────────┘
       │ → shape-flow-connectors → │
```

### Component rules

1. **Use shadcn/ui primitives exclusively** for interactive elements: `Button`, `Badge`, `Separator`, `Select`, `Input`, `Tooltip`, `Dialog`, `Popover`, `Collapsible`. Do not reach for raw HTML `<button>` or `<input>`.
2. **Components must be ≤ 200 lines** (per workbench CLAUDE.md). Extract sub-logic to hooks or sub-components at 150 lines.
3. **No prop drilling beyond 2 levels**. Use Zustand (`trajectoryStore`) for cross-cutting trajectory state; use TanStack Query for server data.
4. **Strict TypeScript** — no `any`. All new types go in `src/types/index.ts` or a co-located `types.ts` file if the type is component-local.
5. **Server state via TanStack Query** — no `useEffect` + `fetch`. All API calls use `useQuery` / `useMutation` from `@tanstack/react-query`.
6. **Loading/error/empty states required** for every data-driven component. Use `<Skeleton />` for loading, `<Alert variant="destructive">` for errors, and a muted empty state label for empty.
7. **Keyboard navigation**: all interactive elements must be reachable by tab. Add `aria-label` to icon-only buttons. The existing `Ctrl+I` shortcut (toggle ImpulseStatePanel) must be preserved.

### Z-index budget

| Layer | Value | Used for |
|---|---|---|
| Base | — | Cards, panels |
| Sidebar | `z-10` | Left panel (above grid overflow) |
| Overlays | `z-20` | Task completion/failure overlays within ActivityCard |
| Tooltips | `z-30` | Frontier indicator tooltips, shape tooltips |
| Dialogs | `z-50` | Modal dialogs, popovers |

---

## Routing Migration (TanStack Router)

### Why migrate

The workbench currently uses `react-router-dom` v6. TanStack Router provides:
- **Type-safe search params** — trajectory state (traceId, executionId, traceA/B, templateId) lives in URL search params with Zod validation, enabling shareable URLs for any mode
- **File-based routing** — routes generated automatically from `src/routes/` directory structure via `@tanstack/router-plugin/vite`
- **Consistent with TanStack Query** — already in use; same ecosystem, compatible devtools

### Installation (commands to run at implementation time)

```bash
cd repos/workbench
bun add @tanstack/react-router @tanstack/router-plugin
bun add -d @tanstack/router-cli
```

Amend `vite.config.ts` to add the plugin:
```ts
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
plugins: [TanStackRouterVite(), react()]
```

Add scripts to `package.json`:
```json
"generate-routes": "tsr generate",
"watch-routes": "tsr watch"
```

### Route file structure

```
src/routes/
├── __root.tsx              ← root layout: AppShell + Sidebar + QueryProvider
├── index.tsx               ← redirect to /trajectory
├── trajectory/
│   ├── route.tsx           ← TrajectoryPage layout + search param schema (Zod)
│   └── index.tsx           ← Composed mode default entry
├── templates/
│   └── index.tsx           ← TemplatesPage (unchanged)
├── shapes/
│   └── index.tsx           ← ShapesPage (unchanged)
├── composition/
│   └── index.tsx           ← CompositionPage read-only (unchanged)
└── executions/
    └── index.tsx           ← thin shell; navigates to /trajectory on row click
```

Pages dissolved into Trajectory (D7): `GoalsPage`, `LiveExecutionMonitor` (as standalone page). Their routes redirect to `/trajectory`.

### Trajectory search param schema

The trajectory route declares all mode-driving params in a single Zod schema so any mode can be bookmarked and shared:

```ts
// src/routes/trajectory/route.tsx
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'

const trajectorySearch = z.object({
  traceId:     z.string().optional(),   // Recalled mode — load this trace
  traceA:      z.string().optional(),   // Multi-trace diff — primary trace
  traceB:      z.string().optional(),   // Multi-trace diff — secondary trace
  executionId: z.string().optional(),   // Attached mode — live execution
  templateId:  z.string().optional(),   // Composed mode — load this template
  vesselId:    z.string().optional(),   // Pre-select vessel endpoint
})

export const Route = createFileRoute('/trajectory')({
  validateSearch: trajectorySearch,
})
```

### Migration checklist (replaces react-router-dom calls)

| Old import | New import |
|---|---|
| `useNavigate` from `react-router-dom` | `useNavigate` from `@tanstack/react-router` |
| `useLocation` from `react-router-dom` | `useSearch` / `useRouterState` from `@tanstack/react-router` |
| `useParams` from `react-router-dom` | `useParams` from `@tanstack/react-router` |
| `Link` from `react-router-dom` | `Link` from `@tanstack/react-router` |
| `Navigate` from `react-router-dom` | `redirect` in `loader` or `<Navigate>` from `@tanstack/react-router` |
| `<Routes><Route>` in `App.tsx` | `RouterProvider` + generated `routeTree` |

URL param reads in `TrajectoryEditorPage` (currently `new URLSearchParams(location.search).get('executionId')`) become `const { executionId } = Route.useSearch()` — fully typed.

---

## Page and Component Map

### Route → Page mapping (post-migration)

| Route | Page | Notes |
|---|---|---|
| `/` | → `/trajectory` redirect | |
| `/trajectory` | `TrajectoryPage` | Composed/Attached/Recalled via search params |
| `/trajectory?templateId=<id>` | `TrajectoryPage` | Composed, template pre-loaded |
| `/trajectory?executionId=<id>` | `TrajectoryPage` | Attached mode |
| `/trajectory?traceId=<id>` | `TrajectoryPage` | Recalled mode |
| `/trajectory?traceA=<id>&traceB=<id>` | `TrajectoryPage` | Multi-trace diff |
| `/templates` | `TemplatesPage` | Unchanged; click → navigate to /trajectory?templateId |
| `/shapes` | `ShapesPage` | Unchanged |
| `/composition` | `CompositionPage` | Read-only graph; link from Trajectory header |
| `/executions` | `ExecutionsPage` (thin) | Search/filter shell; row click → /trajectory?traceId |
| `/goals` | → `/trajectory` redirect | GoalInputBox is now in left panel |
| `/compositions/builder` | → deprecated | Removed from sidebar nav; URL kept for legacy deep links |

### Component tree: TrajectoryPage

```
TrajectoryPage (src/routes/trajectory/route.tsx)
│
├── HEADER  (inline, not a separate component)
│   ├── BackButton → /templates
│   ├── Title + subtitle
│   ├── LiveBadge (Attached mode)
│   ├── ViewModeStrip          ← compose | trace | live pill
│   ├── ValidationErrorButton
│   ├── KeyboardShortcutsHelp
│   ├── ClearButton
│   └── SaveButton
│
├── LEFT PANEL  (w-64 shrink-0 border-r bg-card)
│   ├── VesselSelectorPanel    ← vessel connection, endpoint selection
│   ├── Separator
│   ├── GoalInputBox           ← goal text + prediction trigger (D6)
│   ├── GoalSubmissionPanel    ← Run button, execution dispatch
│   ├── Separator
│   ├── ActivityPalette        ← draggable activities (Composed mode only)
│   ├── Separator
│   ├── ExecutionHistoryPanel  ← trace list, Load / Load alongside
│   └── BackwardChainingPanel  ← missing shape resolution
│
├── CENTER CANVAS  (flex-1 min-w-0 overflow-hidden flex flex-col)
│   ├── InlineExecutionBar     ← live task status (Attached mode)
│   ├── ValidationErrorDisplay ← inline error list (Composed mode)
│   └── TrajectoryGridWithDnd  ← DnD wrapper
│       └── TrajectoryGrid     ← CSS grid renderer
│           ├── ActivityCard   (× N columns, existing activities)
│           │   ├── FrontierIndicator  [NEW — D10]
│           │   │   └── Tooltip: sample_count, CI range
│           │   ├── ActivityCardHeader (name, delete, Thompson editor)
│           │   ├── TaskEditor (× M tasks per activity)
│           │   │   ├── TaskSummaryRow (resolver tier, name)
│           │   │   ├── [expanded]
│           │   │   │   ├── BindingLayer          [Layer 1]
│           │   │   │   │   ├── BindingSlot (× inputShapes)
│           │   │   │   │   │   ├── state: bound | bindable
│           │   │   │   │   │   │         | unreachable [NEW — D11]
│           │   │   │   │   │   │         | unknown_producer [NEW — D11]
│           │   │   │   │   │   └── CandidateList (α/β, override button)
│           │   │   │   │   └── SpawnSubgoalPreview (unknown_producer only)
│           │   │   │   ├── ExecutionLayer         [Layer 2]
│           │   │   │   │   ├── ToolCallRow (× tool calls)
│           │   │   │   │   └── NestedTrajectoryNode [NEW — OQ2]
│           │   │   │   │       └── TrajectoryGrid (depth + 1, max inline = 1)
│           │   │   │   └── OutputLayer            [Layer 3]
│           │   │   │       └── ProducedImpulse (× outputShapes)
│           │   │   └── ValidationIndicator (header badge — pass/fail/none)
│           │   └── ShapeFlowConnector → next column
│           │
│           └── GhostActivityCard  (× N ghost columns, D6 prediction)
│               ├── FrontierIndicator  (always frontier state)
│               ├── ConfidenceInterval (per-activity CI from variant scores)
│               └── GhostTaskRow (× M tasks, 40% opacity)
│
└── RIGHT PANEL  (hidden xl:flex w-80 border-l bg-card)
    └── ImpulseStatePanel
        ├── AccumulatedShapesView  (pool at selected column)
        └── BindableSlots          (live binding state from preBinding events)
```

### New components required by this spec

| Component | File | Purpose |
|---|---|---|
| `FrontierIndicator` | `trajectory/FrontierIndicator.tsx` | Edge connector dot with sample_count + CI tooltip (D10) |
| `NestedTrajectoryNode` | `trajectory/NestedTrajectoryNode.tsx` | Recursive `TrajectoryGrid` wrapper at depth+1 (OQ2) |
| `BindingLayer` | `trajectory/BindingLayer.tsx` | Extract Layer 1 display from TaskEditor (D3) |
| `ExecutionLayer` | `trajectory/ExecutionLayer.tsx` | Extract Layer 2 display from TaskEditor (D3) |
| `OutputLayer` | `trajectory/OutputLayer.tsx` | Extract Layer 3 display from TaskEditor (D3) |
| `GhostActivityCard` | `trajectory/GhostActivityCard.tsx` | Ghost column card for D6 prediction overlay |
| `ToolCallRow` | `trajectory/ToolCallRow.tsx` | Single tool call display within ExecutionLayer |

### Components modified by this spec

| Component | File | Change |
|---|---|---|
| `ShapeSlotStateValue` type | `lib/state-space.ts` | Add `'unreachable'` and `'unknown_producer'` variants (D11) |
| `BindingSlot` type | `stores/trajectoryStore.ts` | Same discriminated union update |
| `ResolverTierBadge` | `trajectory/ResolverTierBadge.tsx` | Add `unreachable` visual (amber band) (D11) |
| `ShapeCompatibilityIndicator` | `trajectory/ShapeCompatibilityIndicator.tsx` | Split tooltip per D11 reason |
| `TaskEditor` | `trajectory/TaskEditor.tsx` | Wire BindingLayer / ExecutionLayer / OutputLayer; add D11 color logic |
| `ActivityCard` | `trajectory/ActivityCard.tsx` | Mount `FrontierIndicator` on edge connector |
| `TrajectoryEditorPage` | `pages/TrajectoryEditorPage.tsx` → `routes/trajectory/route.tsx` | Migrate to TanStack Router; replace `useNavigate`/`useLocation` with typed `Route.useSearch()` |
| `App.tsx` | `App.tsx` | Replace `<Routes>` with `<RouterProvider routerTree={routeTree} />` |
| `ExecutionsPage` | `pages/ExecutionsPage.tsx` | Thin shell: row click navigates to `/trajectory?traceId=<id>` |
| `useTrajectoryExecution` | `hooks/useTrajectoryExecution.ts` | Dual WS subscription (OQ3); `BindingSlot.state` type update |

### Deprecated (remove from sidebar nav, keep URL for deep links)

- `GoalsPage` (`/goals`) → redirect to `/trajectory`
- `CompositionBuilderPage` (`/compositions/builder`) → remove from nav, keep route shell
