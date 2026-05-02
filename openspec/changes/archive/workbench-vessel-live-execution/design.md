## Context

The trajectory editor currently routes all live-execution monitoring through a right-side Sheet. `TrajectoryEditorPage` owns `isLiveSheetOpen` state and auto-opens the Sheet when a WebSocket connection is established. Inside the Sheet, `LiveExecutionPanel` shows the execution ID, a disconnect button, and a collapsible per-task resolution timeline sourced from `taskResolutions` in `trajectoryStore`.

The problem: the Sheet covers a large portion of the trajectory grid, breaking the spatial mapping between "which card is running" (visible in the grid) and "what resolutions are happening" (visible only inside the Sheet). Users have to choose between seeing the grid and seeing the traces.

The `ActivityCard` already has most of the plumbing: `executionProps` drives pulse animation, progress bar, and task-level `activeTaskId` propagation to `TaskEditor`. The store's `taskResolutions: Map<string, ImpulseResolutionEvent[]>` is already populated by `useTrajectoryExecution`. The remaining work is to (a) wire store data into the card's expanded task rows, and (b) replace the Sheet machinery with a slim inline bar.

## Goals / Non-Goals

**Goals:**
- Eliminate the Sheet overlay and `isLiveSheetOpen` state entirely
- Render a compact `InlineExecutionBar` above the trajectory grid that shows execution ID, connection badge, and disconnect button
- Have `ActivityCard` auto-expand when its activity is the active one (`executionProps.isActive === true`) and stay expanded when the card completes
- Show per-task resolution events inside each `TaskEditor` row (below task prompt/config), sourced from `taskResolutions` keyed by `task.id`
- Keep resolution events visible after execution completes (data lives in store until next execution or explicit disconnect)
- Delete `LiveExecutionPanel.tsx` and `LiveExecutionPanel.test.tsx`

**Non-Goals:**
- Changes to `trajectoryStore` data shape or `useTrajectoryExecution` event handlers
- Changes to `LiveExecutionOverlay.tsx` (kept as-is)
- Changes to any API or WebSocket protocol
- Changes outside `repos/workbench/`
- Responsive breakpoint or mobile layout work

## Decisions

**Decision: Inline execution bar above the grid, not in the sidebar**

Options considered:
1. Move the Sheet controls into the left sidebar (among VesselSelectorPanel, GoalSubmissionPanel, etc.)
2. Fixed header bar above the trajectory grid
3. Floating badge overlaid on the grid

The sidebar is already dense and scrollable; adding execution controls there would bury them below the fold. A floating overlay would obscure cards. A fixed bar above the grid is always visible without scroll and clearly scoped to the grid surface it describes. Chosen: option 2.

**Decision: Auto-expand ActivityCard when isActive; do not auto-collapse on completion**

Auto-expand on `isActive` ensures the user sees resolution traces as they arrive without having to manually click "expand." Not auto-collapsing on completion lets the user inspect the full trace after the fact. The user can still manually collapse. The current `isExpanded` state in `ActivityCard` is a simple `useState` — we add a `useEffect` that sets it to `true` when `executionProps?.isActive` becomes true, and to `true` (stay expanded) when `executionProps?.isCompleted` becomes true.

**Decision: Pass taskResolutions into ActivityCard via a prop, not a direct store subscription inside ActivityCard**

`ActivityCard` is rendered inside `TrajectoryGridWithDnd`, which is several components removed from `TrajectoryEditorPage`. Subscribing to `taskResolutions` directly inside `ActivityCard` via `useTrajectoryStore` is the simplest path — it avoids prop-drilling a Map through the grid layers. This is consistent with the existing pattern: `ActivityCard` already calls `useTrajectoryStore((s) => s.activeTraceId)` directly. Chosen: direct store subscription inside `ActivityCard`.

**Decision: Render resolution events inside TaskEditor, not as a separate sibling section below the task list**

Placing resolution events as a collapsible section at the bottom of the expanded card (below all tasks) loses the task→resolution pairing that makes traces readable. Inline placement — each `TaskEditor` row followed by its resolution events — preserves the causal link. `TaskEditor` already receives `task.id` and `activeTaskId`; we add an `resolutionEvents?: ImpulseResolutionEvent[]` prop and render a compact sub-list beneath the task row when the prop is non-empty.

**Decision: Delete LiveExecutionPanel rather than keep it as dead code**

The component's full content is redistributed to `InlineExecutionBar` (ID + badge + disconnect) and `TaskEditor` (resolution rows). Keeping the file creates confusion about which surface is canonical. The test file (`LiveExecutionPanel.test.tsx`) covers behavior that has no equivalent once the component is gone; tests for the new surfaces will be written separately. Chosen: delete both files.

## Risks / Trade-offs

- **Auto-expand changes muscle memory** → Users accustomed to the card staying collapsed during execution will see it open automatically. Mitigation: the change is confined to `executionProps.isActive`; non-executing cards behave exactly as before.

- **Direct store subscription in ActivityCard increases render coupling** → If `taskResolutions` is updated frequently (many rapid events), all expanded cards re-render. Mitigation: the Map reference only changes when entries are added; Zustand's shallow-equality selector will limit re-renders to cards whose task IDs have new entries. In practice, resolution events arrive once per task, not in tight loops.

- **LiveExecutionPanel.test.tsx deletion** → Any regressions to connection-state display, the no-events fallback timer, or the reconnect flow that were previously caught by these tests will need coverage elsewhere. Mitigation: `InlineExecutionBar` will have its own unit tests; the fallback timer behavior is exercised by the existing integration test.

## Migration Plan

1. Add `InlineExecutionBar` component (new file)
2. Modify `TrajectoryEditorPage`: remove Sheet + `isLiveSheetOpen` + "Live" button; render `InlineExecutionBar` conditionally above the grid; remove `LiveExecutionPanel` import
3. Modify `ActivityCard`: subscribe to `taskResolutions`; add auto-expand effect; pass per-task events to `TaskEditor`
4. Modify `TaskEditor`: accept `resolutionEvents?` prop; render resolution sub-list
5. Delete `LiveExecutionPanel.tsx` and `LiveExecutionPanel.test.tsx`
6. Run `bun test` to confirm no regressions; verify build passes with `bun run typecheck`

No data migrations required. No API changes. Rollback: revert the five file edits and restore the two deleted files from git.

## Open Questions

- Should the `InlineExecutionBar` also surface the "no events received" notice (currently in `LiveExecutionPanel` after 30s), or should that notice move to the expanded card? Recommended: move the 30s timer to `InlineExecutionBar` since it is a connection-level concern, not a per-card concern.
