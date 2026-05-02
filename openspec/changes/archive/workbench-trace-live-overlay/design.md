## Context

The trajectory editor has three distinct data layers that are currently siloed:

1. **`traceShapeContributions`** — a `Map<taskId, {produced, consumed}>` accumulated from `task.completed` WS events; only visible in the ImpulseStatePanel sidebar, not on the grid itself.
2. **`activeTaskId`** — exported by `useTrajectoryExecution` and available in `TrajectoryEditorPage`, but not forwarded to `ActivityCard` or `TaskEditor`, so no per-task run indicator is possible today.
3. **`traceCardData`** — a `Map<templateId, TraceCardData>` used for column-level success/failure overlays; no task-level divergence logic.

The `discoveredShapes` set accumulates shape names from live `impulse.resolved` events but is read-only in the UI — users cannot correct mislabeled shapes.

All four features share a common theme: surfacing data that already exists in the store or hook at a finer-grained level of the UI, plus one write-back path for shape correction.

## Goals / Non-Goals

**Goals:**
- Show produced shape names beneath each column header using data already in the store (zero new API calls for the live path).
- Propagate `activeTaskId` from `TrajectoryEditorPage` → `ActivityCard` → `TaskEditor` without breaking existing prop contracts.
- Detect divergence between template expectations and trace actuals at the task level and render inline markers.
- Let users edit `output_shapes` on a template via TagInput; let users rename a discovered shape via context-menu.

**Non-Goals:**
- Reshaping the `traceShapeContributions` data model (we read it as-is).
- Adding divergence detection to the live execution path (historical traces only for divergence).
- Building a full shape-taxonomy editor; the TagInput writes one template's `output_shapes` only.
- Implementing shape propagation to other activities automatically when a shape is renamed.

## Decisions

**D1 — Column impulse overlay reads from two data sources, prioritizing trace data.**
When a trace is loaded, `traceShapeContributions` holds per-task data. The overlay aggregates: group tasks by column (via `activityColumnRef`), union all produced shapes for that column. When no trace is active, fall back to `ImpulseStateSpace.columnsAvailable[col]` to show statically expected shapes. This avoids a new store field and keeps the overlay reactive to the existing Zustand subscriptions.

Alternative considered: maintain a separate `Map<column, Set<string>>` in the store. Rejected — it's a derived value; computing it on the fly in a selector is cheaper than keeping it consistent.

**D2 — `activeTaskId` propagated via optional prop, not context.**
`TrajectoryEditorPage` already passes many props to `ActivityCard`. Adding `activeTaskId?: string | null` and `isActiveActivity?: boolean` as optional props keeps the component boundary explicit and avoids React Context overhead for a single value. Components that don't use it ignore it.

Alternative: trajectory store field. Rejected — `activeTaskId` is execution-session state already maintained by `useTrajectoryExecution`; duplicating it in the store would require sync logic.

**D3 — Divergence computed once when trace loads, stored in component state.**
Trace divergence is a static comparison (template snapshot vs trace snapshot). It is computed in a `useMemo` inside `TrajectoryEditorPage` when `activeTraceId` changes, producing a `Map<taskId, DivergenceAnnotation[]>`. This map is passed as an optional prop `taskDivergences` to `ActivityCard` and forwarded to `TaskEditor`. No new store fields needed.

`DivergenceAnnotation` shape:
```typescript
interface DivergenceAnnotation {
  kind: 'resolver-tier' | 'output-shapes';
  expected: string;
  actual: string;
}
```

**D4 — Shape TagInput writes via `PATCH /v2/activities/templates/{id}` only.**
The workbench already calls activity-api. The TagInput in `ActivityCard` edits `template.output_shapes` locally and on blur fires a PATCH with `{ output_shapes: string[] }`. No optimistic rollback is needed at this stage — the template is not the source of truth for running trajectories. If the PATCH fails, we log a warning and keep local state.

Alternative: PUT the full template. Rejected — PATCH is safer (idempotent for this field, other fields unchanged).

**D5 — Discovered shape rename is a local-only relabelling.**
Renaming a discovered shape (from `ImpulseResolutionEvent.shape`) changes the display label in `ImpulseStatePanel` only. It does not alter the template or any stored data. The rename is applied by maintaining a `Map<original, renamed>` in component state within `ImpulseStatePanel`. This is intentionally ephemeral — shapes are learned types and the "true" name should be corrected at the template level via D4, not retrofitted onto past events.

## Risks / Trade-offs

[Column overlay renders on every `traceShapeContributions` update] → The overlay is a selector on a `Map`; each `task.completed` event creates a new Map reference and triggers re-render of the column header row. For trajectories with many tasks this could cause 10–50 re-renders during an execution. Mitigation: wrap the column-shape derivation in `useMemo` keyed on `traceShapeContributions` size.

[Divergence detection uses `output_impulse_ids` as shape proxy] → Trace tasks record impulse IDs, not shape names directly. We must look up shape names from `ImpulseResolutionEvent`s in `taskResolutions`. If `taskResolutions` is empty (trace loaded without live WS replay), divergence detection has no actual shapes to compare. Mitigation: fall back to comparing impulse ID count vs `output_shapes.length` as a coarse divergence signal.

[TagInput PATCH may conflict with concurrent edits] → In single-user workbench use, this is acceptable. No locking mechanism is needed at this stage.

[Optional prop threading through ActivityCard] → `ActivityCard` already has ~12 props. Adding 2–3 more for execution state stays within reasonable bounds. If prop count becomes a concern, a single `executionOverlay?: ExecutionOverlayProps` object can be introduced later.
