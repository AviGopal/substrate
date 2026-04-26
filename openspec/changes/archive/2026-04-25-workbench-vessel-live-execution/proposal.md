## Why

`VesselSelectorPanel` and `GoalSubmissionPanel` exist but have never been smoke-tested against a live MiniBob — there are two latent bugs (wrong endpoint field stored in `selectVessel`, discovery `resolve_endpoint` not plumbed through to the POST) that would surface immediately on first use. Separately, `impulse.resolved` WS events carry rich per-task resolver metadata that is currently discarded after being folded into a flat `discoveredShapes` Set; surfacing this inline in the live panel would close the observability gap on resolver selection during execution. Finally, `LiveExecutionPanel` lives in the left sidebar scroll area and is visually buried when the execution is the primary focus of the session.

## What Changes

- **Resolver contract routing fix**: `VesselSelectorPanel` currently calls `selectVessel(vessel.vesselId, vessel.endpoint)` — the second argument is the base URL, not the resolver contract path. The store action signature `selectVessel(id, endpoint)` stores this as `selectedVesselEndpoint`. `GoalSubmissionPanel` then POSTs to `${selectedVesselEndpoint}/v2/impulses/resolve`, which double-suffixes the path when `resolve_endpoint` is already `/v2/impulses/resolve`. Fix: `VesselSelectorPanel` must pass the fully-qualified resolver URL, and `GoalSubmissionPanel` must use it directly without appending a path suffix.

- **`taskResolutions` map in trajectoryStore**: New runtime-only field `taskResolutions: Map<string, ImpulseResolutionEvent[]>` (not persisted). `ImpulseResolutionEvent = { shape: string; resolver: string; tier: string; latency_ms?: number; cost_usd?: number; timestamp: number }`. New store action `addTaskResolution(taskId, event)` appends to the map.

- **`useTrajectoryExecution` populates per-task resolutions**: The `impulse.resolved` handler currently only calls `addDiscoveredShape`. The event shape already carries `taskId` — the handler must also call `addTaskResolution(data.taskId, { ... })`.

- **`LiveExecutionPanel` shows per-task resolver timeline**: For each task row in the executing activity, render the accumulated `taskResolutions` entries inline — shape badge, resolver name, resolver-tier color dot, and latency.

- **Layout: `LiveExecutionPanel` promoted to main content area**: When a live execution is connected (`isLiveConnected === true`), the `LiveExecutionPanel` moves from the left sidebar scroll area to a right-side sliding drawer (or a persistent top section of the grid area). The left sidebar remains visible for vessel selection and goal entry.

- **Vessel smoke-test procedure**: Explicit verification steps documented in tasks.md describing how to start MiniBob, verify panel population, connect, submit a goal, and confirm per-task impulse resolution events appear.

## Capabilities

### New Capabilities

- `per-task-impulse-resolution-timeline`: Inline display of `impulse.resolved` WS events per executing task, showing shape, resolver, tier, and latency in the live execution view.
- `live-execution-split-view`: Promotion of `LiveExecutionPanel` from left sidebar to a dedicated right-side drawer in `TrajectoryEditorPage` when an execution is active.

### Modified Capabilities

- `goal-submission-panel`: Resolver contract routing fix — `selectedVesselEndpoint` must hold the fully-qualified POST URL (`vessel.endpoint + vessel.resolve_endpoint`), not just the base vessel endpoint. `GoalSubmissionPanel` then uses it as-is without appending `/v2/impulses/resolve`.
- `live-execution-panel`: Gains per-task impulse resolution timeline rows and moves to the split-view position when active.
- `task-shape-contributions`: `ImpulseResolutionEvent` is a richer sibling to `TaskShapeContribution`; the existing `discoveredShapes` flat-Set approach is supplemented (not replaced) by the per-task map.

## Impact

- `repos/workbench/src/stores/trajectoryStore.ts` — new state field and action
- `repos/workbench/src/hooks/useTrajectoryExecution.ts` — `impulse.resolved` handler extended; `ImpulseResolvedEvent` type updated to include `taskId`, `resolver`, `latency_ms`, `cost_usd`
- `repos/workbench/src/components/trajectory/VesselSelectorPanel.tsx` — `selectVessel` call fixed
- `repos/workbench/src/components/trajectory/LiveExecutionPanel.tsx` — task resolution timeline UI added
- `repos/workbench/src/pages/TrajectoryEditorPage.tsx` — layout change (LiveExecutionPanel position), live drawer state
- `repos/workbench/src/hooks/useVesselRegistry.ts` — read-only; `resolve_endpoint` field already present, no change required
- No API schema changes; no new backend endpoints
