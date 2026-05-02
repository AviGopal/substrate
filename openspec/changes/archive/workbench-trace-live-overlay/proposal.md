## Why

The trajectory editor can connect to live executions and load historical traces, but it shows only coarse activity-level status (green/red borders). Users cannot see which column produced which shapes, which task is currently running, where the trace diverged from the template, or correct a shape label when the system learned the wrong type — all of which are needed to close the authoring feedback loop.

## What Changes

- **Per-column impulse overlay**: After each column finishes executing, a shape-count badge appears below the column header listing the produced shape names. Updates incrementally as `task.completed` WS events add to `traceShapeContributions`.
- **Active task run marker**: During live execution, the task row currently pointed to by `activeTaskId` gets a pulsing left-border indicator inside the ActivityCard/TaskEditor — `activeTaskId` is already tracked by `useTrajectoryExecution` but is not forwarded to the card components.
- **Trace divergence markers**: When a historical trace is loaded, each task row is annotated with a divergence indicator when its recorded `resolverTier` differs from the template's expected resolver, or when the set of produced `output_impulse_ids` doesn't match the template's declared `output_shapes`.
- **Shape adjustment UI**: The ActivityCard expanded view gains a TagInput for editing `output_shapes` on a template (persisted via `PUT /v2/activities/templates/{id}`). Discovered shapes from live `impulse.resolved` events get a context-menu "rename shape" option so users can correct labels inline.

## Capabilities

### New Capabilities

- `column-impulse-overlay`: Per-column shape-count indicator beneath column headers; updates live from `traceShapeContributions`; static from `ImpulseStateSpace` when no trace is active.
- `active-task-run-marker`: Pulsing task-row highlight for the currently executing task; driven by `activeTaskId` forwarded from `useTrajectoryExecution` through `ActivityCard` to `TaskEditor`.
- `trace-divergence-markers`: Per-task divergence annotation comparing template resolver expectation vs trace recorded `resolverTier`, and template `output_shapes` vs trace `output_impulse_ids`.
- `shape-adjustment-ui`: TagInput control in ActivityCard expanded view for editing `output_shapes`; context-menu rename on discovered-shape badges in `ImpulseStatePanel`.

### Modified Capabilities

- `task-shape-contributions`: Adds the column-level aggregation view on top of the existing per-task contribution map — requirements expand to include column-scoped rollup display.
- `vessel-impulse-state-panel`: The Realized tab's discovered-shape badges gain a context-menu rename action — requirement change to the badge interaction model.

## Impact

- `repos/workbench/src/components/trajectory/TrajectoryGrid.tsx` — column header area
- `repos/workbench/src/components/trajectory/ActivityCard.tsx` — run marker prop threading, shape TagInput
- `repos/workbench/src/components/trajectory/TaskEditor.tsx` — active task highlight row
- `repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx` — shape badge context-menu
- `repos/workbench/src/hooks/useTrajectoryExecution.ts` — `activeTaskId` already exported, used by TrajectoryEditorPage
- `repos/workbench/src/pages/TrajectoryEditorPage.tsx` — forward `activeTaskId` down to ActivityCard
- `repos/workbench/src/lib/api-client.ts` / API — `PUT /v2/activities/templates/{id}` for shape persistence
- No new dependencies; no breaking changes to existing props (all new props optional with defaults)
