# Trajectory Live State Visualization

Aligns trajectory editor with 2026-04-26-impulse-activity-loop spec requirements.
Shows the pointer space, live shape deltas, cross-scope resolution, and three-mode goal preview.

## Three behaviors

### B1: Connected to running minibob — trajectory shows full execution state

**Left panel (Impulse State Panel)**:
- Pool grouped into: seed shapes | in-scope produced | cross-scope sourced
- Cross-scope: impulses whose resolver `vessel_id` is not the local vessel
- Signal strength delta (Δα/Δβ) per activity card after execution

**Canvas middle**:
- Shape delta indicator per task: "+N shapes" after each task.completed event
- Nested hook activities (slot-binding, validator-dispatch) visible as sub-nodes at depth 0

**Data sources** (all frontend-only):
- `taskImpulseIds` + `impulseShapeMap` → shape delta per task
- `vessel_id` from `impulse.resolved` WS event → cross-scope detection
- `NestedTrajectoryNode` depth-0 expansion for hooks

### B2: Three-mode goal ghost preview

- **Compose**: existing `goalPathRecs` → GhostActivityCard at canvas right edge (already shipped)
- **Live**: `POST /v2/activities/discover-by-shapes` with current pool shapes → applicable activities preview
- **Trace**: restore `trace.metadata.goal_message` → omnibar + expected shapes (already shipped)

### B3: Signal strength delta

- After trace loads or execution completes: show Δα+1 (success) / Δβ+1 (failure) on ActivityCard
- Source: `traceOverlay.success` (already in TraceCardData) → compute delta from activity.template.metrics
- Backend `learning.signal-updated` WS event: deferred (requires activity-api change)

## Implementation plan

### F1: vessel_id in ImpulseResolutionEvent (workbench store)
Add `vesselId?: string` to `ImpulseResolutionEvent` interface. Capture from WS event. Mark impulses as cross-scope when vesselId != selectedVesselId.

### F2: Cross-scope badge in ImpulsePoolView
When `entry.resolverVesselId` differs from local vessel pattern: show a small `↗ext` badge.
- `ImpulseEntry` gains `resolverVesselId?: string`
- In the `useMemo` that builds groups, pass `vesselId` from the first resolution event for the task.
- Badge renders inline next to the resolver tier badge.

### F3: Shape delta per task in ActivityCard health strip
Count new shapes produced per activity from task impulse IDs:
- Iterate `localActivity.template.tasks`, look up `taskImpulseIds.get(task.id)?.outputIds`
- Map each output ID through `impulseShapeMap` to get a shape name
- Count unique shape names → render `+N sh` in the health strip when count > 0

### F4: Live mode discover-by-shapes ghost preview
When `isLive && discoveredShapes.size > 0`: query `POST /v2/activities/discover-by-shapes` with
current `discoveredShapes` as `available_shapes`. Render top-3 results as ghost cards in the
canvas after the goal-path ghost column (or replacing it when live). Keyed separately so compose
and live ghost columns can coexist.

### F5: Trace mode goal restoration
When `handleLoadTrace` is called and `trace.metadata?.goal_message` is defined:
- Set `goalText` in the store
- Compute `inferExpectedShapes(goalMsg)` and call `setExpectedShapes` + `setRequiredShapes`
This was partially implemented (goalText set) but expected shapes were not updated. Full wiring now.

### F6: Δα/Δβ badge on ActivityCard (already shipped)
`traceOverlay?.executionId && !traceOverlay.isGhost` → show `Δα+1` (green) if success,
`Δβ+1` (red) if failure. Already in the health strip IIFE — no changes needed.

### F7: Nested hooks visible
`NestedTrajectoryNode`: annotate child executions whose `activity_name` contains
`slot-binding`, `validator-dispatch`, or `shape-provider` with a `[hook]` label.
Visually distinguishes lifecycle hooks from regular dispatched activities.

## Out of scope (deferred)

- Backend `learning.signal-updated` WS event (requires activity-api change)
- Security hardening H1/H2/H4 (tracked separately)
- Pool grouping into seed/in-scope/cross-scope sections in ImpulseStatePanel (F2 adds per-entry badges instead)
- AUM attestation for auto-dispatch gates (H4)
