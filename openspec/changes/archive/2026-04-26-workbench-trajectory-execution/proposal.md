## Why

The trajectory editor lets users build precise activity sequences, but the built grid is never executed — the "Run" button only submits a plain goal string and ignores the grid entirely. This means the editor's core value (deterministic, ordered activity composition) is unreachable from the UI, and newly resolved shapes observed during execution are never fed back to the local state space model.

## What Changes

- **New MiniBob pointer type `trajectoryExecution`**: additive resolver that accepts an ordered `activities` array (by `templateId`, `column`, `row`) and runs them column-by-column (sequential) with within-column parallelism. Returns same `{ success: true, content: "executionId: <id>\nwsUrl: ..." }` contract as `goalExecution`.
- **Workbench: "Run Trajectory" button in `GoalSubmissionPanel`**: separate from "Run Goal"; enabled only when trajectory grid has ≥1 activity; submits `trajectoryExecution` pointer with grid contents + optional goal text; reuses `onExecutionStarted` callback.
- **Workbench: `submitTrajectory` method in `useTrajectoryExecution`**: exposes the submission path on the existing hook so the panel does not need its own fetch logic.
- **Workbench: `CreateActivityDialog`**: new dialog for authoring a brand-new `ActivityTemplate` from scratch with fields for name, category, description, input/output shapes, and a dynamic task list. Posts to `POST /v2/activities/templates`; on success adds the created template to the grid.
- **Workbench: `+ New` button in the trajectory palette section**: opens `CreateActivityDialog` directly from the palette header.
- **Workbench: discovered shapes feedback loop**: on each `impulse.resolved` WS event, extract `data.shape`, add to a new `discoveredShapes: Set<string>` in the trajectory store, and fire-and-forget POST to `POST /v2/activities/impulse-relevance`. `ImpulseStatePanel` renders discovered shapes with a dashed-border badge.

## Capabilities

### New Capabilities
- `trajectory-execution-resolver`: MiniBob `trajectoryExecution` pointer type — execution engine and endpoint contract
- `trajectory-submission-panel`: Workbench "Run Trajectory" button + `submitTrajectory` hook method
- `create-activity-dialog`: Workbench dialog for creating a new ActivityTemplate from the trajectory editor
- `discovered-shapes-feedback`: Runtime shape discovery from `impulse.resolved` WS events feeding back into the local state-space model and activity-api

### Modified Capabilities
- `goal-submission-panel`: adds "Run Trajectory" button alongside existing "Run Goal" button; requires trajectory store access
- `minibob-goal-execution-resolver`: adds `trajectoryExecution` case alongside existing `goalExecution` case

## Impact

- **repos/minibob**: add `trajectoryExecution` case to `POST /v2/impulses/resolve` handler (`index.ts` or `src/activity.ts`); no breaking changes to existing endpoint
- **repos/workbench/src/components/trajectory/GoalSubmissionPanel.tsx**: add "Run Trajectory" button; read activities from trajectory store
- **repos/workbench/src/hooks/useTrajectoryExecution.ts**: add `submitTrajectory` method; add shape-discovery logic for `impulse.resolved` events; POST to impulse-relevance endpoint
- **repos/workbench/src/stores/trajectoryStore.ts**: add `discoveredShapes: Set<string>` state and `addDiscoveredShape(shape: string)` action
- **repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx**: render discovered shapes with dashed-border badge in the Realized tab
- **repos/workbench/src/components/trajectory/CreateActivityDialog.tsx**: new file
- **repos/workbench/src/components/trajectory/index.ts**: export `CreateActivityDialog`
- **repos/workbench/src/pages/TrajectoryEditorPage.tsx**: wire `+ New` button and `CreateActivityDialog` into palette area
- No API schema changes to activity-api; uses existing `POST /v2/activities/templates` and `POST /v2/activities/impulse-relevance`
