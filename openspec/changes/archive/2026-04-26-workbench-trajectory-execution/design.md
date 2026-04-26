## Context

The trajectory editor in the workbench already renders a full activity grid, supports drag-reorder, computes the impulse state space column-by-column, and displays live execution overlays via WebSocket. However, the "Run" path bypasses the grid entirely: `GoalSubmissionPanel` posts a plain `goalExecution` pointer that carries only a text string. MiniBob then selects templates via Thompson Sampling — ignoring the user-curated grid.

Three additional gaps:
1. There is no in-editor flow to create a brand-new `ActivityTemplate`; users must author templates outside the workbench.
2. The `impulse.resolved` WS event carries a `shape` field, but the current handler only records the impulse ID — the shape string is discarded and never feeds back into the local state-space model.
3. The trajectory store and `ImpulseStatePanel` have no concept of "discovered" shapes (shapes that appeared at runtime but were not predicted from template metadata).

## Goals / Non-Goals

**Goals:**
- Let users execute the trajectory grid they built, not just a text goal
- Expose trajectory submission as a first-class hook method (`submitTrajectory`)
- Give users a path to create templates without leaving the editor
- Feed runtime-resolved shapes back into the local state-space model as "discovered" entries

**Non-Goals:**
- Changing the existing `goalExecution` path (no behavior change for "Run Goal")
- Server-side trajectory scheduling or priority queuing (MiniBob executes inline)
- Template editing from the Create dialog (edit is a separate workflow via `VariantCreationDialog`)
- Cross-session persistence of discovered shapes (they reset per execution)
- Changing how MiniBob selects which template variant to use within each activity slot

## Decisions

### D1: `trajectoryExecution` as a new pointer type alongside `goalExecution`

**Decision**: Add a new `pointer.type === "trajectoryExecution"` case to MiniBob's `POST /v2/impulses/resolve` handler. The handler accepts `{ activities: [{ templateId, column, row }], goal?: string }` and executes them without modifying the `goalExecution` path.

**Why not reuse `goalExecution` with an activities field?** The `goalExecution` flow goes through the goal processor and Thompson Sampling — the whole point of trajectory execution is to bypass template selection and run the user-specified sequence. Conflating them would require conditional logic throughout the goal processor.

**Why not a separate endpoint (e.g., `POST /v2/trajectories/execute`)?** The discovery contract advertises a single resolve endpoint per vessel. Adding a second endpoint would require a second shape registration and break the `callVesselResolve()` routing pattern already in place. Using the same resolve endpoint with a new pointer type is additive and consistent.

### D2: Column-ordered execution with within-column parallelism in MiniBob

**Decision**: Group activities by column (ascending), then within each column run all activities with `Promise.all`. Sequential between columns (await each column group before starting the next).

**Why not full sequential?** The trajectory editor already allows users to express parallelism by placing multiple activities in the same column. Ignoring row/column metadata would discard the user's intent.

**Why not a DAG scheduler?** The column model is a simplified DAG (column = topological level). A general DAG scheduler is significantly more complex and not needed for the current use case; columns already encode the dependency order the user intended.

### D3: `submitTrajectory` lives on `useTrajectoryExecution`, not a separate hook

**Decision**: Add `submitTrajectory(activities, goal?)` as a returned method from the existing `useTrajectoryExecution` hook.

**Why not a separate `useTrajectorySubmit` hook?** `useTrajectoryExecution` already owns the WebSocket connection and the post-submission state initialization (`initExecutionState`). Keeping submission alongside the WS setup avoids the caller having to coordinate two hooks and ensures the execution state is initialized as soon as the executionId is known.

### D4: `GoalSubmissionPanel` reads trajectory store directly (no prop drilling)

**Decision**: `GoalSubmissionPanel` imports `useTrajectoryStore` to read `activities` for the "Run Trajectory" button, rather than receiving activities as a prop.

**Why not props?** The panel is already a leaf component wired via `TrajectoryEditorPage`. Adding an `activities` prop to it (and the page must pass it down) adds indirection with no benefit — the store is the canonical source.

### D5: `discoveredShapes` as a `Set<string>` in trajectory store, reset on clear

**Decision**: Add `discoveredShapes: Set<string>` to `TrajectoryState` initialized to empty set, plus `addDiscoveredShape(shape: string)` action. Serialization: excluded from `saveToLocalStorage` (ephemeral, per-execution).

**Why not a separate local state in the hook?** The `ImpulseStatePanel` and potentially other components need to read discovered shapes. Centralizing in the store avoids prop drilling and lets components subscribe independently.

**Why reset on `clearTrajectory`?** Discovered shapes are runtime artifacts of a specific execution — they are meaningless without the execution context. On new execution or grid clear, they should start fresh.

### D6: Discovered shapes POSTed to `impulse-relevance` fire-and-forget from the hook

**Decision**: When a new shape is discovered, `useTrajectoryExecution` fires `POST /v2/activities/impulse-relevance` with `{ shape, source: "impulse.resolved", executionId }` and swallows any error (never throws into the WS message handler).

**Why not batch?** Shapes arrive infrequently per execution (typically <20); individual POSTs are fine and simpler. Batching adds state and a flush timer for marginal benefit.

### D7: `CreateActivityDialog` is a new component in `src/components/trajectory/`

**Decision**: New file `CreateActivityDialog.tsx` in the trajectory components directory. The `+ New` button lives in `TrajectoryEditorPage` alongside the palette, not inside `ActivityPalette` (which is shared with `CompositionBuilderPage`).

**Why not modify `ActivityPalette`?** `ActivityPalette` is used in both the trajectory editor and the composition builder. The composition builder has no trajectory store, so injecting trajectory-specific create behavior would break the separation. The button lives in `TrajectoryEditorPage`'s palette area instead.

## Risks / Trade-offs

- **MiniBob template lookup at execution time**: `trajectoryExecution` must fetch each template from activity-api by ID. If a template was deleted after being added to the grid, the resolver fails that activity. Mitigation: return a partial success trace and log the missing template ID; do not fail the whole trajectory.
- **`impulse.resolved` shape field is optional**: the current WS event contract does not guarantee a `shape` field on every `impulse.resolved` event. Mitigation: guard with `if (data.shape)` before calling `addDiscoveredShape`; silently skip events without a shape.
- **Column ordering assumes contiguous integers**: activities at column 0, 2 (no column 1) would skip a column. This is an existing store invariant; document that `trajectoryExecution` sorts by column value and groups by exact column number.
- **`CreateActivityDialog` task ordering**: the dialog uses a client-side array with "Add Task" / delete buttons. Drag-reorder within the dialog adds implementation complexity; deferred to a follow-on change (tasks can be reordered via `TrajectoryGrid` after creation).

## Migration Plan

All changes are additive:
1. Deploy MiniBob with new `trajectoryExecution` case — existing `goalExecution` behavior unchanged
2. Deploy workbench with new panel button, dialog, and hook method — no removal of existing UI
3. No database schema changes; `POST /v2/activities/templates` and `POST /v2/activities/impulse-relevance` already exist

Rollback: redeploy previous MiniBob image; workbench changes are frontend-only and do not affect backend state.

## Open Questions

- Should `trajectoryExecution` advertise the `trajectoryExecution` shape in MiniBob's discovery registration alongside `goalExecution`? (Recommend yes, for routing correctness — add to shapes array in registration payload.)
- Should `CreateActivityDialog` validate that `input_shapes` / `output_shapes` match known shapes from the discovery registry, or accept free-text? (Recommend free-text for now; validation is a follow-on.)
