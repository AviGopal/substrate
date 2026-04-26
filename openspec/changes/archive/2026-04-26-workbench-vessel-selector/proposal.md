## Why

The workbench trajectory editor has no way to route goal execution to a specific MiniBob vessel — every submission POSTs to a single hardcoded `/v2/impulses/resolve` path on the activity-api base URL. When multiple MiniBob instances are registered with discovery-vessel, the user cannot choose which executor receives the goal, cannot see what impulse state is loaded on that executor, and has no feedback on per-vessel reliability when selecting where to run.

## What Changes

- **New hook** `useVesselRegistry` queries discovery-vessel for registered executor vessels and polls every 30 s.
- **New component** `VesselSelectorPanel` renders the registry list with health dots, last-seen timestamps, and per-vessel Thompson α/β scores; placed at the top of the left sidebar above `GoalSubmissionPanel`.
- **Trajectory store** gains `selectedVesselId`, `selectedVesselEndpoint`, `vesselScores` state and `selectVessel` / `recordVesselOutcome` actions; persisted to localStorage v2.
- **`GoalSubmissionPanel`** reads `selectedVesselEndpoint` from the store and POSTs to `{endpoint}/v2/impulses/resolve` when a vessel is selected; falls back to the current hardcoded URL with a warning toast when none is selected.
- **MiniBob** gains a read-only `GET /impulses` endpoint returning the current in-memory impulse list (id, shape, pointer_type, loaded, summary).
- **`ImpulseStatePanel`** grows a "Vessel State" section that subscribes to the selected vessel's WebSocket (`{endpoint}/ws`) for `impulse:created` events and polls `GET /impulses` every 10 s for the initial snapshot.
- **Executor Thompson scores** are tracked in the store and displayed in `VesselSelectorPanel`.

## Capabilities

### New Capabilities

- `vessel-registry-hook`: React Query hook that fetches registered executor vessels from discovery-vessel, returning vesselId, endpoint, resolve_endpoint, shapes, health, and lastSeen with 30 s polling.
- `vessel-selector-panel`: Left-sidebar component for picking an executor vessel from the registry; shows health, timestamps, Thompson scores, and a "Connect" button that writes selection to the trajectory store.
- `vessel-execution-routing`: Trajectory store extension and `GoalSubmissionPanel` changes that route goal POSTs to the selected vessel's resolve endpoint, with fallback and toast warning.
- `minibob-impulse-introspection`: `GET /impulses` endpoint in MiniBob that exposes the current in-memory impulse list for workbench polling.
- `vessel-impulse-state-panel`: `ImpulseStatePanel` extension that subscribes to the selected vessel's WS and polls `GET /impulses`, rendering a "Vessel State" section of live shapes.

### Modified Capabilities

<!-- No existing spec-level requirement changes -->

## Impact

- `repos/workbench/src/hooks/useVesselRegistry.ts` — new file
- `repos/workbench/src/components/trajectory/VesselSelectorPanel.tsx` — new file
- `repos/workbench/src/stores/trajectoryStore.ts` — additive state/actions
- `repos/workbench/src/components/trajectory/GoalSubmissionPanel.tsx` — routing logic update
- `repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx` — new "Vessel State" section
- `repos/workbench/src/pages/TrajectoryEditorPage.tsx` — mount `VesselSelectorPanel`
- `repos/minibob/index.ts` — add `GET /impulses` route
- `repos/minibob/src/impulse.ts` — export `getAllImpulses()` helper (or equivalent public method)
- New env var `VITE_DISCOVERY_ENDPOINT` already present in workbench `.env.example`; consumed in `useVesselRegistry`.
- No new dependencies required; discovery-vessel contract already supports `vesselRegistry` pointer type.
