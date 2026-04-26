## 1. Add InlineExecutionBar component

- [x] 1.1 Create `repos/workbench/src/components/trajectory/InlineExecutionBar.tsx` with props: `executionId: string | null`, `connectionState: 'connecting' | 'connected' | 'disconnected' | 'error'`, `onDisconnect: () => void`
- [x] 1.2 Render a compact bar (border-b row) with truncated monospace execution ID, a connection-state badge (idle / connecting / live / done / failed icons matching the existing StatusBadge pattern from LiveExecutionPanel), and a disconnect button
- [x] 1.3 Add the 30-second no-events timer inside `InlineExecutionBar`: start when `connectionState === 'connected'` and `taskResolutions.size === 0`; subscribe to `taskResolutions` from `trajectoryStore`; render the notice inline in the bar when the timer fires; cancel on events or disconnect
- [x] 1.4 Export `InlineExecutionBar` from `repos/workbench/src/components/trajectory/index.ts`

## 2. Update TrajectoryEditorPage to remove Sheet

- [x] 2.1 Remove `isLiveSheetOpen` state and both `useEffect` hooks that set it (`prevExecutionIdRef` auto-open effect and the `storeActiveExecutionId` sync effect that calls `setIsLiveSheetOpen(true)`)
- [x] 2.2 Remove the `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` import and the entire Sheet JSX block (lines 602–625 in current file)
- [x] 2.3 Remove the `LiveExecutionPanel` import and the "Live" toolbar button (`<Button ... onClick={() => setIsLiveSheetOpen(true)}>`)
- [x] 2.4 Remove the `MonitorPlay` lucide import (no longer used after button removal)
- [x] 2.5 Import and render `InlineExecutionBar` in the trajectory grid column, above `TrajectoryGridWithDnd`, passing `executionId`, `wsConnectionState`, and an `onDisconnect` handler that clears `activeExecutionId` and `activeWsUrl`

## 3. Update ActivityCard for auto-expand and resolution event pass-through

- [x] 3.1 Subscribe to `taskResolutions` from `trajectoryStore` inside `ActivityCard` using `useTrajectoryStore((s) => s.taskResolutions)`
- [x] 3.2 Add a `useEffect` that sets `isExpanded(true)` when `executionProps?.isActive` transitions to `true`, and another branch that keeps `isExpanded(true)` when `executionProps?.isCompleted` transitions to `true`
- [x] 3.3 Pass `resolutionEvents={taskResolutions.get(task.id) ?? []}` to each `TaskEditor` invocation inside the task list render

## 4. Update TaskEditor to render inline resolution events

- [x] 4.1 Import `ImpulseResolutionEvent` type from `@/stores/trajectoryStore` in `TaskEditor.tsx`
- [x] 4.2 Add `resolutionEvents?: ImpulseResolutionEvent[]` prop to the `TaskEditorProps` interface
- [x] 4.3 Render a `TierDot` + shape + resolver + optional latency sub-list below the task row when `resolutionEvents` is non-empty; reuse the `TierDot` helper already defined in `LiveExecutionPanel.tsx` (copy it to a shared location or inline it in `TaskEditor`)
- [x] 4.4 Ensure no sub-list DOM element is rendered when `resolutionEvents` is empty or undefined

## 5. Delete LiveExecutionPanel

- [x] 5.1 Delete `repos/workbench/src/components/trajectory/LiveExecutionPanel.tsx`
- [x] 5.2 Delete `repos/workbench/src/components/trajectory/LiveExecutionPanel.test.tsx`
- [x] 5.3 Remove `LiveExecutionPanel` from `repos/workbench/src/components/trajectory/index.ts` export list (if present)

## 6. Tests and typecheck

- [x] 6.1 Add unit tests for `InlineExecutionBar` in a new `InlineExecutionBar.test.tsx`: (a) renders execution ID and badge when `executionId` is set, (b) calls `onDisconnect` when disconnect button clicked, (c) does not render when `executionId` is null
- [x] 6.2 Update `TaskEditor.test.tsx`: add a test asserting that two resolution events render two sub-rows with correct tier dot color, shape, and resolver text; and that empty `resolutionEvents` renders no sub-list
- [x] 6.3 Run `bun run typecheck` in `repos/workbench/` and fix all TypeScript errors
- [x] 6.4 Run `bun test` in `repos/workbench/` and confirm all tests pass
