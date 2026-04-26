## 1. Store: ImpulseResolutionEvent type and taskResolutions field

- [x] 1.1 In `repos/workbench/src/stores/trajectoryStore.ts`, add `ImpulseResolutionEvent` interface: `{ shape: string; resolver: string; tier: string; latency_ms?: number; cost_usd?: number; timestamp: number }`
- [x] 1.2 In `repos/workbench/src/stores/trajectoryStore.ts`, add `taskResolutions: Map<string, ImpulseResolutionEvent[]>` to `TrajectoryState` interface (runtime-only, not persisted)
- [x] 1.3 In `repos/workbench/src/stores/trajectoryStore.ts`, add `addTaskResolution(taskId: string, event: ImpulseResolutionEvent): void` to `TrajectoryActions` interface
- [x] 1.4 In `repos/workbench/src/stores/trajectoryStore.ts`, initialize `taskResolutions: new Map()` in the store's initial state object
- [x] 1.5 In `repos/workbench/src/stores/trajectoryStore.ts`, implement `addTaskResolution` action: append to existing array for `taskId`, or create a new array `[event]` if absent
- [x] 1.6 In `repos/workbench/src/stores/trajectoryStore.ts`, extend `clearTraceData` action to also reset `taskResolutions: new Map()` — ensures it clears on disconnect and new execution start
- [x] 1.7 In `repos/workbench/src/stores/trajectoryStore.ts`, extend `clearTrajectory` action to also reset `taskResolutions: new Map()`
- [x] 1.8 Verify `saveToLocalStorage` does NOT serialize `taskResolutions` (it is runtime-only and should remain absent from the `data` object written to localStorage)

## 2. WebSocket hook: extend ImpulseResolvedEvent and populate taskResolutions

- [x] 2.1 In `repos/workbench/src/hooks/useTrajectoryExecution.ts`, extend the local `ImpulseResolvedEvent` interface to add optional fields: `taskId?: string; resolver?: string; latency_ms?: number; cost_usd?: number`
- [x] 2.2 In `repos/workbench/src/hooks/useTrajectoryExecution.ts`, subscribe to `addTaskResolution` from the store (alongside existing `addDiscoveredShape`)
- [x] 2.3 In `repos/workbench/src/hooks/useTrajectoryExecution.ts`, in the `impulse.resolved` branch of `handleMessage`: when `data.taskId` is a non-empty string, call `addTaskResolution(data.taskId, { shape: data.shape ?? '', resolver: data.resolver ?? 'unknown', tier: data.resolverTier, latency_ms: data.latency_ms, cost_usd: data.cost_usd, timestamp: Date.now() })`
- [x] 2.4 In `repos/workbench/src/hooks/useTrajectoryExecution.ts`, ensure the existing `addDiscoveredShape(data.shape)` call is still made regardless of whether `taskId` is present (backward-compatible path)
- [x] 2.5 In `repos/workbench/src/hooks/useTrajectoryExecution.ts`, add `addTaskResolution` to the `useCallback` dependency array for `handleMessage`

## 3. Resolver contract routing fix in VesselSelectorPanel

- [x] 3.1 In `repos/workbench/src/components/trajectory/VesselSelectorPanel.tsx`, change the `onClick` handler on the Connect button (line 104) from `selectVessel(vessel.vesselId, vessel.endpoint)` to `selectVessel(vessel.vesselId, resolveUrl(vessel.endpoint, vessel.resolve_endpoint))` where `resolveUrl` handles the absolute-vs-relative guard
- [x] 3.2 In `repos/workbench/src/components/trajectory/VesselSelectorPanel.tsx`, add a local `resolveUrl(base: string, resolvePath: string): string` helper: if `resolvePath` starts with `http`, return `resolvePath` as-is; otherwise return `base + resolvePath`
- [x] 3.3 In `repos/workbench/src/components/trajectory/GoalSubmissionPanel.tsx`, confirm the POST fetch is `fetch(selectedVesselEndpoint, { method: 'POST', ... })` with NO path append — add a comment `// selectedVesselEndpoint is already the fully-qualified resolver URL` to document the contract
- [x] 3.4 In `repos/workbench/src/hooks/useVesselRegistry.ts`, confirm `resolve_endpoint` is mapped from `v.resolve_endpoint` with fallback `'/v2/impulses/resolve'` — no change needed, but add a comment confirming it is a path suffix starting with `/`

## 4. LiveExecutionPanel: per-task resolution timeline UI

- [x] 4.1 In `repos/workbench/src/components/trajectory/LiveExecutionPanel.tsx`, import `useTrajectoryStore` and subscribe to `taskResolutions`
- [x] 4.2 In `repos/workbench/src/components/trajectory/LiveExecutionPanel.tsx`, add `ImpulseResolutionEvent` import from `@/stores/trajectoryStore`
- [x] 4.3 In `repos/workbench/src/components/trajectory/LiveExecutionPanel.tsx`, add a `TaskResolutionRows` sub-component that accepts `events: ImpulseResolutionEvent[]` and renders a compact list: each row shows a colored dot (green=deterministic, yellow=pattern, blue=llm), shape name in monospace, resolver name in monospace muted, and `${latency_ms}ms` if present
- [x] 4.4 In `repos/workbench/src/components/trajectory/LiveExecutionPanel.tsx`, when `executionId` is set and connection is "live", render a task section below the status badge: for each entry in `taskResolutions`, render a collapsible task row header (taskId shortened) with `TaskResolutionRows` as its expandable content
- [x] 4.5 In `repos/workbench/src/components/trajectory/LiveExecutionPanel.tsx`, ensure task rows with no resolution events (taskId absent from `taskResolutions`) render nothing (no empty placeholder)

## 5. TrajectoryEditorPage: move LiveExecutionPanel to right-side Sheet

- [x] 5.1 In `repos/workbench/src/pages/TrajectoryEditorPage.tsx`, import `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` from `@/components/ui/sheet`
- [x] 5.2 In `repos/workbench/src/pages/TrajectoryEditorPage.tsx`, add `const [isLiveSheetOpen, setIsLiveSheetOpen] = useState(false)` to manage the Sheet open state
- [x] 5.3 In `repos/workbench/src/pages/TrajectoryEditorPage.tsx`, add a `useEffect` that sets `setIsLiveSheetOpen(true)` when `executionId` becomes non-null and `wsConnectionState === 'connected'`, and sets `setIsLiveSheetOpen(false)` when `executionId` becomes null
- [x] 5.4 In `repos/workbench/src/pages/TrajectoryEditorPage.tsx`, remove `<LiveExecutionPanel ... />` from the left sidebar `ScrollArea`
- [x] 5.5 In `repos/workbench/src/pages/TrajectoryEditorPage.tsx`, add a `<Sheet open={isLiveSheetOpen} onOpenChange={setIsLiveSheetOpen}>` wrapping a `<SheetContent side="right" className="w-[400px] sm:max-w-[480px]">` that contains `<LiveExecutionPanel executionId={executionId} connectionState={wsConnectionState} onConnect={...} onDisconnect={() => setActiveExecutionId(null)} />`
- [x] 5.6 In `repos/workbench/src/pages/TrajectoryEditorPage.tsx`, add a "Live" toggle button in the header bar (next to the "Live Execution" badge) that opens the Sheet when clicked: `<Button onClick={() => setIsLiveSheetOpen(true)}>` — visible only when `executionId !== null`

## 6. ImpulseStatePanel: per-task breakdown in Realized tab

- [x] 6.1 In `repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx`, subscribe to `taskResolutions` from `useTrajectoryStore`
- [x] 6.2 In `repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx`, import `ImpulseResolutionEvent` from `@/stores/trajectoryStore`
- [x] 6.3 In `repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx`, in the Realized tab content, add a "Per-task resolutions" section below the discovered shapes badges, rendered only when `taskResolutions.size > 0`
- [x] 6.4 In `repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx`, implement the per-task section as a list of collapsible rows (one per taskId), each showing the resolution events for that task: shape badge, resolver name, tier color, latency
- [x] 6.5 In `repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx`, verify the existing flat `discoveredShapes` dashed-badge block is unchanged and still renders when `taskResolutions` is empty

## 7. Smoke-test verification tasks (manual, not automated)

- [x] 7.1 Document in a comment block at the top of `repos/workbench/src/components/trajectory/VesselSelectorPanel.tsx`: "Smoke test: start MiniBob with `METABOB_ENDPOINT=https://activity.metabob.com VITE_DISCOVERY_ENDPOINT=https://discovery.metabob.com bun run dev`; verify vessel row appears within 30s"
- [x] 7.2 Document in tasks.md (or a `docs/smoke-tests/vessel-live-execution.md` in the workbench repo): how to start MiniBob locally — env vars required (`ANTHROPIC_API_KEY`, `METABOB_API_KEY`, `METABOB_ENDPOINT`), command (`bun run index.ts`), expected startup log line confirming discovery registration
- [x] 7.3 Describe in the smoke-test doc how to verify the vessel appears in `VesselSelectorPanel`: open Workbench at `/trajectory`, confirm vessel row with health dot and "Connect" button; confirm `selectedVesselEndpoint` in Zustand DevTools equals `http://<host>/v2/impulses/resolve` (not just `http://<host>`)
- [x] 7.4 Describe in the smoke-test doc: submit a one-line goal ("list files in /tmp"), confirm the POST goes to MiniBob's resolver URL (Network tab in DevTools), confirm `executionId` is returned and the right-side Sheet opens
- [x] 7.5 Describe in the smoke-test doc: with execution running, open Zustand DevTools and confirm `taskResolutions` is populated with at least one entry keyed by a taskId; confirm `LiveExecutionPanel` in the Sheet shows at least one resolution row

## 8. Type exports and index cleanup

- [x] 8.1 In `repos/workbench/src/stores/trajectoryStore.ts`, ensure `ImpulseResolutionEvent` is exported (used by `LiveExecutionPanel` and `ImpulseStatePanel`)
- [x] 8.2 In `repos/workbench/src/components/trajectory/index.ts`, verify no re-export changes are needed for the modified components (LiveExecutionPanel is already re-exported if present; check and add if missing)

## 9. Tests

- [x] 9.1 In `repos/workbench/src/stores/trajectoryStore.test.ts` (create if absent), add a test: `addTaskResolution` appends an `ImpulseResolutionEvent` to the correct `taskId` key
- [x] 9.2 In `repos/workbench/src/stores/trajectoryStore.test.ts`, add a test: `clearTraceData` resets `taskResolutions` to an empty Map
- [x] 9.3 In `repos/workbench/src/components/trajectory/LiveExecutionPanel.test.tsx` (create if absent), add a test: when `taskResolutions` has one entry for "task_1" with tier "deterministic", the rendered output contains a green indicator and the resolver name
- [x] 9.4 Run `bun test` in `repos/workbench/` and confirm all existing tests still pass with the store shape changes
