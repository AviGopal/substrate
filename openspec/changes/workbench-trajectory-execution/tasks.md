## 1. MiniBob: trajectoryExecution resolver

- [x] 1.1 In `repos/minibob/index.ts` around line 979, change the early-return guard from `if (pointer.type !== "goalExecution")` to a switch/else-if block that handles both `"goalExecution"` (existing path, unchanged) and `"trajectoryExecution"` (new path), keeping the HTTP 400 fallback for all other types
- [x] 1.2 In `repos/minibob/index.ts`, implement the `trajectoryExecution` branch: validate `pointer.activities` is an array (return 400 if missing), generate `executionId` and `wsUrl` identically to the `goalExecution` path, return the same `{ success: true, content: "executionId: <id>\nwsUrl: ..." }` response immediately
- [x] 1.3 In `repos/minibob/index.ts`, implement the background execution for `trajectoryExecution`: group `pointer.activities` by `column` (ascending), then for each column group call `Promise.all` over the activities in that group, fetching each template from activity-api by `templateId` via the existing HTTP client before executing; wrap in a fire-and-forget `Promise.resolve().then(...)` with error logging (same pattern as `goalExecution`)
- [x] 1.4 In `repos/minibob/index.ts` around line 719–725, add `"trajectoryExecution"` to the default shapes array in the discovery registration block (alongside `"goalExecution"`)

## 2. Workbench: trajectory store — discoveredShapes

- [x] 2.1 In `repos/workbench/src/stores/trajectoryStore.ts`, add `discoveredShapes: Set<string>` to the `TrajectoryState` interface, initialized to `new Set()` in the store initial state
- [x] 2.2 In `repos/workbench/src/stores/trajectoryStore.ts`, add `addDiscoveredShape(shape: string): void` to the `TrajectoryActions` interface and implement it as an idempotent `set((state) => { const next = new Set(state.discoveredShapes); next.add(shape); return { discoveredShapes: next }; })` — no-op if already present
- [x] 2.3 In `repos/workbench/src/stores/trajectoryStore.ts`, update `clearTrajectory()` to reset `discoveredShapes: new Set()` alongside the other cleared fields
- [x] 2.4 In `repos/workbench/src/stores/trajectoryStore.ts`, confirm `discoveredShapes` is NOT included in the `saveToLocalStorage` serialized data object (it should only persist `activities`, `goalText`, `requiredShapes` — no change needed if not already there, just verify)

## 3. Workbench: useTrajectoryExecution — submitTrajectory + discovered shapes

- [x] 3.1 In `repos/workbench/src/hooks/useTrajectoryExecution.ts`, add `submitTrajectory` to the `UseTrajectoryExecutionResult` interface: `submitTrajectory: (activities: TrajectoryActivity[], goal?: string) => Promise<string>`
- [x] 3.2 In `repos/workbench/src/hooks/useTrajectoryExecution.ts`, import `post` from `@/lib/api-client` and implement `submitTrajectory` as a `useCallback` that POSTs `{ pointer: { type: "trajectoryExecution", activities: activities.map(a => ({ templateId: a.templateId, column: a.column, row: a.row })), goal } }` to `/v2/impulses/resolve`, parses `executionId` with the same `parseExecutionId` helper used in `GoalSubmissionPanel`, and throws on failure
- [x] 3.3 In `repos/workbench/src/hooks/useTrajectoryExecution.ts`, import `useTrajectoryStore` selectors for `addDiscoveredShape` and `discoveredShapes`
- [x] 3.4 In `repos/workbench/src/hooks/useTrajectoryExecution.ts`, in the `impulse.resolved` handler branch, add: `if (data.shape && typeof data.shape === 'string') { addDiscoveredShape(data.shape); }` — update the `ImpulseResolvedEvent` interface to include `shape?: string`
- [x] 3.5 In `repos/workbench/src/hooks/useTrajectoryExecution.ts`, after calling `addDiscoveredShape(data.shape)`, fire-and-forget `post('/v2/activities/impulse-relevance', { shape: data.shape, source: 'impulse.resolved', executionId })` with `.catch((err) => console.warn('[trajectory] impulse-relevance POST failed:', err))`
- [x] 3.6 In `repos/workbench/src/hooks/useTrajectoryExecution.ts`, return `submitTrajectory` from the hook's return value object

## 4. Workbench: GoalSubmissionPanel — Run Trajectory button

- [x] 4.1 In `repos/workbench/src/components/trajectory/GoalSubmissionPanel.tsx`, update `GoalSubmissionPanelProps` to accept `submitTrajectory: (activities: TrajectoryActivity[], goal?: string) => Promise<string>` and `trajectoryActivities: TrajectoryActivity[]` as props (or read activities from store directly — per design D4, use `useTrajectoryStore` inside the component to read `activities`)
- [x] 4.2 In `repos/workbench/src/components/trajectory/GoalSubmissionPanel.tsx`, add a second `isSubmittingTrajectory` state and `handleRunTrajectory` async handler that calls `submitTrajectory(activities, goalText.trim() || undefined)`, calls `onExecutionStarted(executionId)` on success, and calls `setError(classifyError(err))` on failure
- [x] 4.3 In `repos/workbench/src/components/trajectory/GoalSubmissionPanel.tsx`, add the "Run Trajectory" `<Button>` below the existing "run" button; set `disabled` when `activities.length === 0 || isLiveConnected || isSubmittingTrajectory || isSubmitting`; show `<Loader2>` spinner when `isSubmittingTrajectory`; use `ListOrdered` icon from lucide-react; add `title` attribute "Add activities to the grid first" when `activities.length === 0`
- [x] 4.4 In `repos/workbench/src/pages/TrajectoryEditorPage.tsx`, update the `<GoalSubmissionPanel>` usage to pass `submitTrajectory` from the `useTrajectoryExecution` return value (the hook already returns it after task 3.6)

## 5. Workbench: CreateActivityDialog

- [x] 5.1 Create `repos/workbench/src/components/trajectory/CreateActivityDialog.tsx` — define the component props: `open: boolean`, `onClose: () => void`, `onCreated: (template: ActivityTemplate) => void`
- [x] 5.2 In `CreateActivityDialog.tsx`, build the form state with `useState`: `name` (string), `category` (ActivityCategory, default `'feature'`), `description` (string), `inputShapes` (string[]), `outputShapes` (string[]), `tasks` (Array<{ id: string, description: string, promptTemplate: string }>), initialized with one empty task row
- [x] 5.3 In `CreateActivityDialog.tsx`, implement the tag input for `inputShapes`: a controlled text input that on Enter key (or comma) trims the value, pushes to the array if non-empty, and clears the input; render each shape as a `<Badge>` with an `×` button that splices it from the array; duplicate the same component for `outputShapes`
- [x] 5.4 In `CreateActivityDialog.tsx`, implement the task list: render each task as a row with a `description` text input, a `promptTemplate` textarea, and a remove button; add an "Add Task" button that appends a new row with a fresh `crypto.randomUUID()` id; ensure at least one task row is always present (disable remove on the last row)
- [x] 5.5 In `CreateActivityDialog.tsx`, implement form validation: `name.trim().length > 0` and `tasks.length >= 1` and every task has non-empty `description`; the "Create" submit button is disabled when validation fails or `isSubmitting` is true
- [x] 5.6 In `CreateActivityDialog.tsx`, implement the submit handler: `isSubmitting` guard, assemble the `ActivityTemplate`-shaped payload, call `post<ActivityTemplate>('/v2/activities/templates', payload)`, on success call `onCreated(result)` then `onClose()`, on error set `submitError` state and display it as an inline `<Alert variant="destructive">`
- [x] 5.7 In `CreateActivityDialog.tsx`, wrap everything in `<Dialog open={open} onOpenChange={(o) => !o && onClose()}>`; use `DialogHeader`, `DialogTitle`, `DialogContent`, `DialogFooter` from `@/components/ui/dialog`; "Create" and "Cancel" buttons in footer
- [x] 5.8 In `repos/workbench/src/components/trajectory/index.ts`, add `export { CreateActivityDialog } from './CreateActivityDialog'`

## 6. Workbench: + New button in TrajectoryEditorPage

- [x] 6.1 In `repos/workbench/src/pages/TrajectoryEditorPage.tsx`, add `useState` for `createDialogOpen: boolean` (default `false`)
- [x] 6.2 In `repos/workbench/src/pages/TrajectoryEditorPage.tsx`, import `CreateActivityDialog` from `@/components/trajectory` and `Plus` from `lucide-react`; import `useQueryClient` from `@tanstack/react-query`
- [x] 6.3 In `repos/workbench/src/pages/TrajectoryEditorPage.tsx`, in the palette section header area (near where `<ActivityPalette>` is rendered), add a `<Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(true)}>` with `<Plus className="h-3.5 w-3.5 mr-1" />` and label `"New"`
- [x] 6.4 In `repos/workbench/src/pages/TrajectoryEditorPage.tsx`, render `<CreateActivityDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} onCreated={(template) => { addActivity(template); queryClient.invalidateQueries({ queryKey: ['templates'] }); }} />`

## 7. Workbench: ImpulseStatePanel — discovered shapes section

- [x] 7.1 In `repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx`, add selector: `const discoveredShapes = useTrajectoryStore((state) => state.discoveredShapes)`
- [x] 7.2 In `repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx`, inside the "Realized" tab content (the `TabsContent value="realized"` block), add a "Discovered Shapes" section after the existing realized impulse IDs list; only render when `discoveredShapes.size > 0`; render each shape as a `<Badge variant="outline" className="border-dashed font-mono text-xs">` with the shape name
- [x] 7.3 In `repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx`, add a section heading `<p className="text-xs font-medium mt-3 mb-1">Discovered Shapes</p>` above the dashed-border badges, and wrap the badges in a flex-wrap div

## 8. Verification

- [x] 8.1 Run `bun run typecheck` in `repos/workbench` — confirm zero TypeScript errors
- [x] 8.2 Run `bun test` in `repos/workbench` — confirm all existing tests pass
- [x] 8.3 Run `bun run typecheck` in `repos/minibob` — confirm zero TypeScript errors
- [ ] 8.4 Manual smoke test in workbench: add an activity to the trajectory grid, click "Run Trajectory", confirm a `trajectoryExecution` POST is sent to MiniBob and an executionId is returned
- [ ] 8.5 Manual smoke test: open the "New" dialog, fill in name + one task, submit, confirm the template appears in the grid and `POST /v2/activities/templates` was called
- [ ] 8.6 Manual smoke test: connect a live execution, confirm `impulse.resolved` events with a `shape` field cause dashed-border badges to appear in the ImpulseStatePanel Realized tab
