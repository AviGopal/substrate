## 1. MiniBob: Impulse Introspection Endpoint

- [x] 1.1 Add `getAllImpulses(): Impulse[]` public method to `ImpulseStore` in `repos/minibob/src/impulse.ts` that returns `Array.from(this.impulses.values())`
- [x] 1.2 Export the `globalImpulseStore` instance (or equivalent accessor) from `repos/minibob/src/impulse.ts` so `index.ts` can call `getAllImpulses()`
- [x] 1.3 Add `GET /impulses` route in `repos/minibob/index.ts` inside the `fetch` handler, after the `/status` route — serialize each impulse to `{ id, shape: i.metadata?.shape ?? "unknown", pointer_type: i.pointer.type, loaded: i.loaded, summary: i.metadata?.summary ?? null }` and return JSON with CORS headers (`Access-Control-Allow-Origin: *`, `Content-Type: application/json`)
- [x] 1.4 Add `OPTIONS /impulses` CORS preflight handler in `repos/minibob/index.ts` returning status 204 with `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Methods: GET, OPTIONS`

## 2. Workbench: Vessel Registry Hook

- [x] 2.1 Create `repos/workbench/src/hooks/useVesselRegistry.ts` — export `interface RegistryVessel { vesselId: string; name: string; endpoint: string; resolve_endpoint: string; shapes: string[]; health: "healthy" | "degraded" | "unknown"; lastSeen: string }` and `function useVesselRegistry(): { vessels: RegistryVessel[]; isLoading: boolean; error: Error | null }`
- [x] 2.2 In `useVesselRegistry`, read `VITE_DISCOVERY_ENDPOINT` from `import.meta.env`; if absent return `{ vessels: [], isLoading: false, error: null }` with no fetch
- [x] 2.3 Use `useQuery` (React Query) with key `["vessels", "registry"]`, `staleTime: 15_000`, `refetchInterval: 30_000` to POST to `${VITE_DISCOVERY_ENDPOINT}/resolve` with body `{ pointer: { type: "vesselRegistry" } }` and `Authorization: ApiKey <key>` header from `getApiKey()` (imported from `@/lib/api-client`)
- [x] 2.4 In the `queryFn`, parse the response and filter to vessels whose `shapes` array includes `"goalExecution"`; map raw registry entries to `RegistryVessel` shape (use `vesselId` as `name` fallback)
- [x] 2.5 Catch fetch/parse errors in the `queryFn` and rethrow so React Query surfaces them in the `error` field; return `[]` when the response body has no vessels array

## 3. Workbench: Trajectory Store Extension

- [x] 3.1 Add `selectedVesselId: string | null`, `selectedVesselEndpoint: string | null`, and `vesselScores: Record<string, { alpha: number; beta: number }>` to the `TrajectoryState` interface in `repos/workbench/src/stores/trajectoryStore.ts`
- [x] 3.2 Add `selectVessel: (id: string, endpoint: string) => void` and `recordVesselOutcome: (id: string, success: boolean) => void` to the `TrajectoryActions` interface
- [x] 3.3 Initialize new state fields in the `create` call: `selectedVesselId: null`, `selectedVesselEndpoint: null`, `vesselScores: {}`
- [x] 3.4 Implement `selectVessel` action: `set({ selectedVesselId: id, selectedVesselEndpoint: endpoint })` then `setTimeout(() => get().saveToLocalStorage(), 100)`
- [x] 3.5 Implement `recordVesselOutcome` action: read current entry from `get().vesselScores[id]`, increment alpha on success or beta on failure (init `{ alpha: 0, beta: 0 }` if absent), call `set({ vesselScores: { ...get().vesselScores, [id]: updated } })`
- [x] 3.6 Update `saveToLocalStorage` to include `selectedVesselId`, `selectedVesselEndpoint`, and `vesselScores` in the serialized v2 object
- [x] 3.7 Update `loadFromLocalStorage` to restore `selectedVesselId` (default `null`), `selectedVesselEndpoint` (default `null`), and `vesselScores` (default `{}`) from parsed data
- [x] 3.8 Update `clearTrajectory` to reset `selectedVesselId: null`, `selectedVesselEndpoint: null`, `vesselScores: {}`

## 4. Workbench: VesselSelectorPanel Component

- [x] 4.1 Create `repos/workbench/src/components/trajectory/VesselSelectorPanel.tsx` — import `useVesselRegistry` and trajectory store; define the component with no props
- [x] 4.2 Render a section header with `Server` icon (lucide) and label "executor vessel"
- [x] 4.3 Render skeleton rows (shadcn `Skeleton`, two rows) while `isLoading` is true
- [x] 4.4 Render the "No executor vessels online — start MiniBob to connect" empty state message when `vessels` is empty and `isLoading` is false
- [x] 4.5 For each vessel, render a row with: health dot (`div` with Tailwind color class: `bg-green-500` / `bg-yellow-500` / `bg-gray-400` based on health), truncated vessel name (20 chars + ellipsis), truncated vesselId (8 chars suffix), relative last-seen time, Thompson strength (α / (α + β) × 100 % or "—"), and Connect/Connected button
- [x] 4.6 Implement Thompson % computation: read `vesselScores[vessel.vesselId]` from store; display `Math.round(alpha / (alpha + beta) * 100) + "%"` or "—" when entry absent
- [x] 4.7 Implement "Connect" button: call `selectVessel(vessel.vesselId, vessel.endpoint)` on click; show "Connected" badge (shadcn `Badge` variant="secondary") on the selected row instead of the button
- [x] 4.8 Export `VesselSelectorPanel` from `repos/workbench/src/components/trajectory/index.ts`

## 5. Workbench: Wire VesselSelectorPanel into TrajectoryEditorPage

- [x] 5.1 Import `VesselSelectorPanel` in `repos/workbench/src/pages/TrajectoryEditorPage.tsx`
- [x] 5.2 Render `<VesselSelectorPanel />` inside the left sidebar `ScrollArea`, immediately before `<GoalSubmissionPanel />` (add a `<Separator />` between them if one does not already exist)

## 6. Workbench: GoalSubmissionPanel Routing

- [x] 6.1 In `repos/workbench/src/components/trajectory/GoalSubmissionPanel.tsx`, import `useTrajectoryStore` and read `selectedVesselId`, `selectedVesselEndpoint`, `recordVesselOutcome` from the store
- [x] 6.2 Import `useToast` from `@/hooks/use-toast`
- [x] 6.3 Add `"vessel-offline"` to the `SubmitError` union type
- [x] 6.4 Update `classifyError` to return `{ kind: "vessel-offline" }` when the error message includes "Failed to fetch", "ECONNREFUSED", or "ERR_CONNECTION_REFUSED"
- [x] 6.5 Update `ErrorMessage` to display "Executor vessel offline — select a different vessel or restart MiniBob" for `error.kind === "vessel-offline"`
- [x] 6.6 In `handleSubmit`, build the target URL: if `selectedVesselEndpoint` is set, use `${selectedVesselEndpoint}/v2/impulses/resolve` with a plain `fetch` call; otherwise call `post('/v2/impulses/resolve', ...)` (existing behavior) and fire the toast "No vessel selected — routing to default endpoint"
- [x] 6.7 After each submission attempt (in the `finally` block or after `catch`), call `recordVesselOutcome(selectedVesselId, success)` if `selectedVesselId` is non-null (where `success` is true on `onExecutionStarted` path, false in catch)
- [x] 6.8 When calling the vessel endpoint directly (step 6.6 direct-fetch path), use `Authorization: ApiKey <key>` header from `getApiKey()` and set a 30 s timeout via `AbortController`

## 7. Workbench: Vessel Impulse State in ImpulseStatePanel

- [x] 7.1 In `repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx`, import `useVesselRegistry`, `useWebSocket`, and trajectory store fields `selectedVesselId` and `selectedVesselEndpoint`
- [x] 7.2 Add local state `vesselShapes: Set<string>` (initialized empty) and `vesselSnapshotLoading: boolean`
- [x] 7.3 Use a `useEffect` that fires when `selectedVesselEndpoint` changes: clear `vesselShapes`; if `selectedVesselEndpoint` is non-null, fetch `${selectedVesselEndpoint}/impulses` immediately and then set up a `setInterval` at 10 s; cancel the interval and abort the fetch on cleanup
- [x] 7.4 In the polling callback, parse the response `impulses` array and call `setVesselShapes(new Set(impulses.map(i => i.shape)))` on success; silently swallow errors
- [x] 7.5 Use `useWebSocket` with `url: selectedVesselEndpoint ? selectedVesselEndpoint + "/ws" : null` (skip connection when null); in `onMessage`, check `data.type === "impulse:created"` and add `data.impulse?.metadata?.shape` to `vesselShapes` (use functional state update to avoid stale closures)
- [x] 7.6 Resolve vessel name from `useVesselRegistry().vessels.find(v => v.vesselId === selectedVesselId)?.name ?? selectedVesselId` for the section header
- [x] 7.7 Render the "Vessel State" collapsible section below the existing Tabs: show header "Live shapes on {vesselName}", render each unique shape in `vesselShapes` as a `Badge` (variant="outline", size compact); show "No shapes yet" when the set is empty; hide the section entirely when `selectedVesselId` is null

## 8. Verification

- [x] 8.1 Run `bun run typecheck` in `repos/workbench` — confirm zero type errors introduced by the new files and store changes
- [x] 8.2 Run `bun test` in `repos/workbench` — confirm existing tests pass (no regressions in trajectoryStore or GoalSubmissionPanel)
- [x] 8.3 Run `bun run typecheck` in `repos/minibob` — confirm the new `GET /impulses` route and `getAllImpulses` export have no type errors
- [x] 8.4 Smoke-test manually: start MiniBob locally, load the workbench, confirm `VesselSelectorPanel` shows the MiniBob instance, connect to it, submit a goal, and verify the POST goes to MiniBob's endpoint
- [x] 8.5 Confirm "Vessel State" section in `ImpulseStatePanel` populates after connecting and submitting a goal
