## Context

The Workbench trajectory editor has three execution-related panels that have grown independently: `VesselSelectorPanel` (discovery registry browser), `GoalSubmissionPanel` (goal dispatch), and `LiveExecutionPanel` (WS connection monitor). These panels were each implemented and tested in isolation; the first end-to-end smoke-test of a live MiniBob vessel reveals two bugs and a layout awkwardness.

**Bug 1 — Wrong field stored in `selectVessel`**: `VesselSelectorPanel.tsx` line 104 calls `selectVessel(vessel.vesselId, vessel.endpoint)`. The second argument is `vessel.endpoint` (the vessel's base HTTP origin, e.g., `http://minibob:8080`). `GoalSubmissionPanel` then constructs the POST URL as `${selectedVesselEndpoint}/v2/impulses/resolve`. When the vessel advertises a `resolve_endpoint` of `/v2/impulses/resolve`, this is correct by coincidence — but when a vessel advertises a full absolute URL (e.g., `http://minibob:8080/v2/impulses/resolve`), it will double-path. The correct call is `selectVessel(vessel.vesselId, vessel.endpoint + vessel.resolve_endpoint)` so `GoalSubmissionPanel` can POST to it verbatim.

**Bug 2 — `impulse.resolved` WS events carry `taskId` but hook ignores it**: The `ImpulseResolvedEvent` type in `useTrajectoryExecution.ts` lacks `taskId`, `resolver`, `latency_ms`, and `cost_usd` fields even though the activity-api broadcaster emits them. These fields are silently dropped when the event arrives; only `shape` is preserved (into the flat `discoveredShapes` Set). A per-task map indexed by `taskId` is required to display resolution events inline in the live view.

**Layout problem**: `LiveExecutionPanel` is buried inside the 255px-wide left sidebar `ScrollArea`. During live execution it becomes the most important panel, but the user cannot see it alongside the trajectory grid. Moving it to a right-side drawer — symmetric with `ImpulseStatePanel` — puts it in view without sacrificing the left sidebar's vessel/goal controls.

## Goals / Non-Goals

**Goals:**

- Fix the resolver contract routing bug so goal submission POSTs to the vessel's advertised resolver URL, not a reconstructed URL.
- Add `taskResolutions: Map<string, ImpulseResolutionEvent[]>` to trajectoryStore and populate it from `impulse.resolved` WS events keyed by `taskId`.
- Render per-task resolution events inline in `LiveExecutionPanel` rows: shape badge + resolver name + tier color + latency_ms.
- Move `LiveExecutionPanel` from the left sidebar to a right-side sliding drawer shown when a live execution is connected, keeping the left sidebar always visible.
- Document a MiniBob smoke-test procedure that a developer can run to verify end-to-end connectivity.

**Non-Goals:**

- Changing the activity-api WebSocket event schema — we consume what it already emits.
- Persisting `taskResolutions` to localStorage — this is runtime-only, intentionally ephemeral.
- Replacing `discoveredShapes` — it remains as a flat Set for `ImpulseStatePanel`'s Realized tab; `taskResolutions` is additive.
- Supporting per-task resolution display in historical trace loads — that path goes through `ExecutionHistoryPanel` / REST, not WS events.
- Responsive breakpoints or mobile layout for the new drawer.

## Decisions

### Decision 1: Store fully-qualified resolver URL in `selectedVesselEndpoint`

**Chosen**: `VesselSelectorPanel` calls `selectVessel(vessel.vesselId, vessel.endpoint + vessel.resolve_endpoint)`. `GoalSubmissionPanel` uses `selectedVesselEndpoint` as a complete URL and POSTs to it directly (no path append).

**Alternative A**: Add a separate `selectedVesselResolveEndpoint` field to the store. Rejected — two fields for the same logical concept; callers would need to know which to use.

**Alternative B**: Keep `endpoint` in the store and let `GoalSubmissionPanel` concatenate. Rejected — responsibility for URL construction is split between store update and panel render; the resolver contract lives in the vessel registration object, which only `VesselSelectorPanel` holds.

**Rationale**: `GoalSubmissionPanel` already treats `selectedVesselEndpoint` as a POST-ready URL (`fetch(selectedVesselEndpoint, { method: 'POST' })`). Keeping that contract and fixing the call site is the minimal-change path.

### Decision 2: `taskResolutions` Map keyed by `taskId` string

**Chosen**: `taskResolutions: Map<string, ImpulseResolutionEvent[]>` in trajectoryStore; runtime-only (not serialized to localStorage). Action `addTaskResolution(taskId: string, event: ImpulseResolutionEvent)` appends.

**Alternative**: Reuse `traceShapeContributions` and extend `TaskShapeContribution`. Rejected — `traceShapeContributions` carries impulse ID arrays (from `task.completed` events) and serves `ImpulseStatePanel`'s provenance tree. Conflating it with resolver-timing events from `impulse.resolved` would make the type ambiguous and break the trace-load path.

**Rationale**: A separate Map keeps concerns cleanly separated. `ImpulseResolutionEvent` is a distinct type owned by the `per-task-impulse-resolution-timeline` capability.

### Decision 3: `LiveExecutionPanel` moves to a right-side sheet/drawer

**Chosen**: In `TrajectoryEditorPage`, add a boolean `isLiveDrawerOpen` state (auto-opens when `executionId` becomes non-null, auto-closes on disconnect). Render `LiveExecutionPanel` inside a `Sheet` (shadcn) from the right side. The Sheet overlays the `ImpulseStatePanel` (which is `hidden xl:flex`); on xl screens both can coexist via z-index.

**Alternative A**: Inline top banner above the grid. Rejected — takes vertical space away from the grid; can't show growing task resolution lists without scrolling.

**Alternative B**: Fixed right panel always visible. Rejected — adds permanent width cost when no execution is active. The majority of time in the editor is composition, not live observation.

**Alternative C**: Move it to the existing `ImpulseStatePanel`. Rejected — `ImpulseStatePanel` is already complex; mixing execution control (connect/disconnect) with state observation would require significant refactor.

**Rationale**: The Sheet is already used in shadcn-ui and requires no new dependencies. It auto-opens when needed and does not disturb the layout otherwise.

### Decision 4: `ImpulseResolvedEvent` type extended in `useTrajectoryExecution`

The local `ImpulseResolvedEvent` interface in `useTrajectoryExecution.ts` is extended with `taskId`, `resolver`, `latency_ms`, `cost_usd`. These fields are optional (`?`) to stay backward-compatible with older activity-api versions that may not emit them. When `taskId` is absent, the event is still forwarded to `addDiscoveredShape` only, matching current behavior.

## Risks / Trade-offs

[Risk: `taskId` missing from older activity-api instances] → Mitigation: `taskId` is optional on `ImpulseResolvedEvent`. When absent, `addTaskResolution` is not called; the flat `discoveredShapes` path still fires. No regression.

[Risk: Drawer covers `ImpulseStatePanel` on xl screens] → Mitigation: The Sheet is a floating overlay with a close button and auto-closes on disconnect. The `ImpulseStatePanel` (hidden on < xl) remains accessible when the Sheet is closed.

[Risk: Double-pathfix breaks existing MiniBob integrations with absolute `resolve_endpoint`] → The current MiniBob registration sends `resolve_endpoint: "/v2/impulses/resolve"` (relative path). `vessel.endpoint + vessel.resolve_endpoint` produces `http://minibob:8080/v2/impulses/resolve` — correct. If a future vessel advertises an absolute URL as `resolve_endpoint`, the concatenation breaks. Mitigation: document in code that `resolve_endpoint` is expected to be a path (starting with `/`), and add a guard: if `resolve_endpoint` starts with `http`, use it as-is.

[Risk: `taskResolutions` Map unbounded during long executions] → Mitigation: The Map is cleared in `clearExecutionState` (called on disconnect and on new execution start). No pagination needed for the panel — resolution events per task are bounded by the number of impulses in the task.

## Migration Plan

1. Land the store changes (`taskResolutions` field + `addTaskResolution` action) — additive, no migration needed.
2. Fix `VesselSelectorPanel` call site — backward-compatible (same state field, better value).
3. Update `useTrajectoryExecution` `ImpulseResolvedEvent` type and handler — additive fields, no store shape changes.
4. Update `LiveExecutionPanel` UI to render task resolution rows.
5. Update `TrajectoryEditorPage` layout to use Sheet for `LiveExecutionPanel`.
6. Verify end-to-end with MiniBob smoke-test procedure.

No rollback complexity — all changes are frontend-only with no API contract changes.

## Open Questions

- Should `LiveExecutionPanel` also show a "Connect to existing execution" input inside the Sheet (current behavior) or move the manual-connect input somewhere else? Current plan: keep it inside the Sheet — the Sheet opens empty and shows the connect input until an execution is attached.
- The `ImpulseStatePanel` vessel-impulse polling at line 88-91 of `ImpulseStatePanel.tsx` uses `${endpoint}/impulses` but MiniBob's endpoint is base URL; does MiniBob expose a `/impulses` GET? If not, the snapshot will 404 silently — acceptable for this change (already in production), but worth noting in the smoke-test.
