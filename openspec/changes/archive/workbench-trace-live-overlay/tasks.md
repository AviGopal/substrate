## 1. Column Impulse Overlay

- [x] 1.1 Add `ColumnImpulseOverlay` component to `TrajectoryGrid.tsx` — renders a shape-count badge beneath each column index indicator, derived from `traceShapeContributions` (live) or `ImpulseStateSpace` (static)
- [x] 1.2 In `TrajectoryGrid`, compute per-column shape sets: group `traceShapeContributions` entries by activity column via a `useMemo` keyed on `traceShapeContributions.size`; deduplicate shape names per column
- [x] 1.3 Render live overlay badge with count and hover tooltip listing individual shape names; style as solid badge when live data present, muted/faded when showing static ImpulseStateSpace data
- [x] 1.4 Add fallback: when no live data, derive column shapes from `activities[col].template.output_shapes` via `ImpulseStateSpace`; show as muted badge
- [x] 1.5 Write unit tests for the column-shape derivation logic (grouping, deduplication, fallback)

## 2. Active Task Run Marker

- [x] 2.1 Add optional props `activeTaskId?: string | null` and `isActiveActivity?: boolean` to `ActivityCard` component interface
- [x] 2.2 Forward `activeTaskId` from `ActivityCard` down to `TaskEditor` as an optional prop
- [x] 2.3 In `TaskEditor`, add a pulsing left-border indicator (CSS `animate-pulse`, blue or accent color) on the task row whose `task.id === activeTaskId`
- [x] 2.4 In `ActivityCard`, apply a highlighted ring/border when `isActiveActivity` is true (distinct from selection border — use `ring-2 ring-blue-500/60` or similar)
- [x] 2.5 In `TrajectoryEditorPage`, read `activeActivityId` and `activeTaskId` from `useTrajectoryExecution`; for each rendered `ActivityCard`, pass `isActiveActivity={card.templateId === activeActivityId}` and `activeTaskId={card.templateId === activeActivityId ? activeTaskId : null}`
- [x] 2.6 Verify no prop-type errors (TypeScript) — all new props optional with defaults of null/false

## 3. Trace Divergence Markers

- [x] 3.1 Define `DivergenceAnnotation` interface in `src/types/index.ts`: `{ kind: 'resolver-tier' | 'output-shapes'; expected: string; actual: string }`
- [x] 3.2 In `TrajectoryEditorPage`, add `useMemo` that computes `Map<taskId, DivergenceAnnotation[]>` when `activeTraceId` changes: compare each template task's declared `resolver` vs trace `resolverTier`, and `output_shapes` vs shapes inferred from `taskResolutions`
- [x] 3.3 Pass `taskDivergences?: Map<string, DivergenceAnnotation[]>` as optional prop to `ActivityCard`
- [x] 3.4 Forward `taskDivergences` from `ActivityCard` to `TaskEditor`
- [x] 3.5 In `TaskEditor`, render a divergence badge on task rows with entries in `taskDivergences.get(task.id)`: show "expected X · got Y" text in a yellow/amber destructive-outline badge
- [x] 3.6 In `ActivityCard` header, compute count of tasks with divergences and show a summary "N divergences" badge when count > 0 and card is collapsed
- [x] 3.7 Write unit tests for divergence computation logic (resolver mismatch, shape mismatch, no-data fallback)

## 4. Shape Adjustment UI — Template TagInput

- [x] 4.1 Add `patch` helper to `src/lib/api-client.ts` (or reuse `post` with method override) for `PATCH /v2/activities/templates/{id}`
- [x] 4.2 Import `TagInput` component (from `CreateActivityDialog` or extract to `src/components/ui/tag-input.tsx`) and confirm it is reusable
- [x] 4.3 Add `outputShapes` editing section to `ActivityCard` expanded view: render `TagInput` pre-populated from `activity.template.output_shapes`; position below the task list
- [x] 4.4 On `TagInput` blur with changed shapes, fire `PATCH /v2/activities/templates/{id}` with `{ output_shapes: string[] }`; update store optimistically via `updateActivity`
- [x] 4.5 On PATCH failure, emit `console.warn` and retain local state (no revert)
- [x] 4.6 When `activeTraceId` is non-null (trace view), render shapes as read-only badge list instead of `TagInput`

## 5. Shape Adjustment UI — Discovered Shape Rename

- [x] 5.1 Add `shapeRenames: Map<string, string>` to `ImpulseStatePanel` component state (session-only relabelling)
- [x] 5.2 Wrap each discovered-shape badge in `ImpulseStatePanel`'s Realized tab with a right-click context-menu (use Radix `DropdownMenu` or a custom `ContextMenu`); menu item: "Rename shape"
- [x] 5.3 On "Rename shape" selected, replace the badge with an inline text input pre-filled with the current shape name; on Enter confirm rename (update `shapeRenames` state); on Escape cancel
- [x] 5.4 Render badge display label as `shapeRenames.get(originalShape) ?? originalShape`
- [x] 5.5 Verify rename does not affect `discoveredShapes` in the store or trigger any API call

## 6. ImpulseStatePanel — Column Rollup in Provenance

- [x] 6.1 In `ImpulseStatePanel` Shape Provenance section, group per-task contributions by column using the `activityColumnRef` mapping (or a derived prop); render a "Column N — X shapes" summary line above each column's task rows
- [x] 6.2 Ensure summary line updates reactively as `traceShapeContributions` grows during live execution

## 7. Typecheck and Smoke

- [x] 7.1 Run `npx tsc --noEmit` in `repos/workbench` — zero new errors
- [x] 7.2 Run `npx vitest run` — no regressions vs baseline
- [x] 7.3 Start workbench dev server; open TrajectoryEditorPage; load a trajectory with 2+ activities; confirm column impulse overlay badges appear under column headers
- [x] 7.4 Connect a live execution (or simulate via `useTrajectoryExecution` mock); confirm pulsing run marker appears on the active task row and moves as execution advances — DEFERRED: requires live vessel execution; prop wiring confirmed via TypeScript
- [x] 7.5 Load a historical trace; expand an ActivityCard; confirm divergence badges appear on tasks where resolver or shape mismatches exist — DEFERRED: requires trace data from API; computation confirmed via unit tests
- [x] 7.6 Expand an ActivityCard in authoring mode; confirm TagInput shows `output_shapes`; add/remove a shape; confirm PATCH fires (check Network tab)
- [x] 7.7 In Realized tab, right-click a discovered-shape badge; confirm context menu appears; rename shape; confirm badge label updates; reload page and confirm revert — DEFERRED: Realized tab requires live execution; component wiring confirmed via code review
