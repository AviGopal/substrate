## Context

The trajectory editor was built (v0.1.0, 2026-04-22) with a horizontal CSS-Grid layout for activity composition. Current implementation uses `/goal-paths/recommend` which returns complete activity sequences upfront, violating the core idiom that "activities constrain search" iteratively. The system already captures all necessary data (Thompson parameters, composition edges, impulse resolutions) but the UI doesn't surface it for human-in-the-loop decision-making.

**Current State:**
- Activities displayed in columns (sequential) and rows (parallel)
- Shape validation checks input/output compatibility
- No impulse visibility (shapes are abstract concepts, not visual entities)
- No real-time execution integration
- No learning feedback display

**Constraints:**
- Must maintain backward compatibility with existing trajectory storage format
- Cannot break existing REST API contracts
- WebSocket server route not yet mounted in activity-api (broadcaster exists but `/ws` endpoint missing)
- All learning data exists in execution traces, just needs UI exposure

**Stakeholders:**
- Workbench users who compose activity chains manually
- MiniBob instances that execute trajectories
- Learning system that improves from traces

## Goals / Non-Goals

**Goals:**
1. **Embody core idioms** in UI: metadata-first reasoning, activities constrain search, resolvers live where data lives, record everything, learn from traces
2. **Iterative recommendation** replacing upfront path generation
3. **State space visibility** showing impulse accumulation at each step
4. **Learning transparency** surfacing Thompson Sampling, composition graphs, impulse relevance
5. **Speculative exploration** enabling "what if" branching before execution
6. **Real-time execution** with WebSocket integration for task-by-task progress

**Non-Goals:**
- Graphical node-based editor (React Flow) - chain UI is intentionally linear
- Automatic execution without user confirmation - human-in-the-loop is required
- Multi-user collaborative editing - single-user for v1
- Undo/redo beyond localStorage autosave rollback
- Activity template authoring UI - use existing template pages
- Advanced visualization (3D graphs, VR) - keep it minimal and snappy

## Decisions

### Decision 1: Impulse State Space as Computed Value

**Choice:** Compute accumulated shapes from activity sequence rather than storing separately

**Rationale:**
- Activities already declare `output_shapes` - no new backend data needed
- Zustand store can memoize with `shallow` equality checking
- Avoids sync issues between activities array and separate state tracker
- Enables time-travel debugging (recompute state at any column)

**Alternative Considered:**
Store state snapshots per column - **Rejected**: Redundant, prone to desyncs, harder to reason about

**Implementation:**
```typescript
const availableShapes = useMemo(() => {
  const shapes = new Set<string>(['goal', 'directoryTree']); // Initial state
  sortedActivities.forEach(activity => {
    activity.template.output_shapes?.forEach(s => shapes.add(s));
  });
  return shapes;
}, [sortedActivities]);
```

### Decision 2: Speculative Prediction via Local Computation

**Choice:** Predict state changes client-side using template metadata, not backend query

**Rationale:**
- Template `output_shapes` are already loaded (no extra fetch)
- Sub-100ms latency for hover interactions
- Works offline
- Backend still queried for Thompson scores and applicability filtering

**Alternative Considered:**
Server-side prediction endpoint - **Rejected**: Adds latency, requires network, unnecessary computation

**Implementation:**
Cache predictions in WeakMap keyed by (currentState, activityTemplate) tuple. Clear cache when trajectory changes.

### Decision 3: WebSocket Integration for Execution

**Choice:** Use existing WebSocket hook from `LiveExecutionMonitor`, overlay on trajectory grid

**Rationale:**
- Code already exists and works (`useWebSocket.ts` with reconnection + catchup)
- Consistent with other execution views (ExecutionsPage)
- Event-driven architecture aligns with real-time needs

**Alternative Considered:**
Long-polling - **Rejected**: Higher latency, more server load, worse UX

**Missing Piece:**
Activity-API needs to mount WebSocket route (`GET /ws` with upgrade handshake). Broadcaster service exists, just needs HTTP endpoint.

**Implementation:**
```typescript
// In TrajectoryEditorPage
const { messages } = useWebSocket({
  url: executionId ? `/executions/${executionId}/stream` : null,
  onMessage: (event) => {
    if (event.type === 'task.completed') {
      markTaskComplete(event.activityId, event.taskId);
      addRealizedImpulses(event.output_impulse_ids);
    }
  }
});
```

### Decision 4: Thompson Visualization via Existing GET Endpoints

**Choice:** Fan-out parallel GETs to `/v2/activities/:id/variant-scores` per activity family

**Rationale:**
- Endpoint exists and works (bug fixed 2026-04-24 to use parallel GETs)
- No new backend code needed
- Can batch with TanStack Query for caching

**Alternative Considered:**
New bulk endpoint - **Rejected**: Premature optimization, caching handles it

**Implementation:**
```typescript
const { data: thompsonScores } = useQueries({
  queries: uniqueActivityFamilies.map(familyId => ({
    queryKey: ['variant-scores', familyId],
    queryFn: () => fetch(`/v2/activities/${familyId}/variant-scores`).then(r => r.json()),
    staleTime: 60_000 // 1 minute cache
  }))
});
```

### Decision 5: Backward Chaining as New Backend Endpoint

**Choice:** Implement `POST /v2/activities/discover-by-shapes` for prerequisite discovery

**Rationale:**
- Cannot efficiently compute prerequisite chains client-side (requires full activity library)
- Backend has indexed access to `input_shapes`/`output_shapes`
- Enables caching and optimization (graph traversal algorithms)

**Alternative Considered:**
Send full activity library to client - **Rejected**: 1000+ activities = huge payload, poor performance

**Endpoint Contract:**
```typescript
POST /v2/activities/discover-by-shapes
Request: {
  available_shapes: string[],  // Current state
  desired_shapes: string[],    // Goal requirements
  mode: 'forward' | 'backward' // Discovery direction
}
Response: {
  activities: ActivityTemplate[],
  ranked_by: 'thompson_sampling',
  reasoning: string[]  // Why each was selected
}
```

### Decision 6: Cycle Detection Client-Side

**Choice:** DFS-based cycle detection in trajectory validation layer

**Rationale:**
- Trajectory is small (< 20 activities typically)
- DFS is fast (O(V+E) where V=activities, E=shape dependencies)
- No backend query needed
- Can run on every trajectory change with minimal overhead

**Alternative Considered:**
Server-side cycle detection - **Rejected**: Unnecessary network roundtrip

**Implementation:**
Extend existing `trajectory-validation.ts` with `detectCycles()` function using visited set + recursion stack pattern.

## Risks / Trade-offs

### Risk 1: WebSocket Server Route Not Implemented

**[Risk]** Activity-API doesn't expose `/ws` endpoint despite broadcaster being ready
**[Mitigation]** Fall back to polling (`GET /v2/executions/:id`) every 2 seconds if WebSocket unavailable. Display degraded mode indicator. **Priority:** High - implement WebSocket route in parallel with UI work.

### Risk 2: Thompson Score Fetch Overhead

**[Risk]** Fetching variant scores for 10+ activity families = 10+ parallel requests
**[Mitigation]** TanStack Query handles batching and deduplication. Consider adding `useQueries` with `staleTime: 60_000` to avoid refetches. Monitor network tab - if > 20 requests, consider bulk endpoint. **Likelihood:** Low

### Risk 3: Impulse State Space Computation Cost

**[Risk]** Recomputing accumulated shapes on every activity drag = O(n) per drag event
**[Mitigation]** Memoization with `useMemo` + shallow equality. Benchmark with 50+ activity trajectory - if > 16ms, optimize. **Likelihood:** Very Low (modern browsers handle this easily)

### Risk 4: Speculative Prediction Cache Growth

**[Risk]** WeakMap cache for predictions could grow unbounded
**[Mitigation]** Use WeakMap (GC handles cleanup when activities dereferenced). Clear cache on trajectory reset. Monitor memory in DevTools. **Likelihood:** Low

### Risk 5: Backward Chaining Complexity

**[Risk]** Prerequisite resolution might have multiple valid paths or cycles
**[Mitigation]** Return top-3 paths ranked by Thompson Sampling. Detect cycles and warn user. Limit max chain depth to 5 activities. **Likelihood:** Medium - needs testing with complex dependencies

### Risk 6: Learning Feedback Overload

**[Risk]** Post-execution panel showing Thompson updates + variants + edges might overwhelm users
**[Mitigation]** Default collapsed state, expandable sections, "Show Details" toggle. A/B test information density. **Likelihood:** Medium

## Migration Plan

**Phase 1: Additive Changes (Week 1-2)**
- Add new components without removing existing functionality
- Impulse state panel (sidebar, initially hidden behind feature flag)
- Thompson score cards (display only, no interaction)
- Goal completion indicator

**Phase 2: Recommendation Flow (Week 3-4)**
- Replace "Suggest Next Activity" to use `/v2/activities/recommend` instead of `/goal-paths/recommend`
- Show applicable/blocked activities dynamically
- Add speculative preview on hover

**Phase 3: Execution Integration (Week 5)**
- Implement WebSocket server route in activity-api
- Add live execution overlay to trajectory view
- Show realized vs speculative impulses

**Phase 4: Learning Feedback (Week 6)**
- Post-execution impact panel
- Inline variant creation
- Composition graph updates

**Rollback Strategy:**
- Feature flags control each phase (`ENABLE_IMPULSE_STATE_PANEL`, etc.)
- Can disable via config without code changes
- localStorage schema versioned (`trajectory_v2`) - fallback to `v1` if issues

**Data Migration:**
- No backend schema changes (additive only)
- Frontend localStorage: Add version field, migrate on read, preserve `v1` as backup

## Open Questions

1. **Q:** Should impulse state panel be always visible or collapsible sidebar?
   **Resolution Needed By:** Week 1 (before UI implementation)
   **Options:** (A) Always visible right sidebar, (B) Collapsible with keyboard shortcut (C) Bottom panel
   **Recommendation:** (B) - users can hide when not needed, keyboard shortcut for power users

2. **Q:** How to display Thompson confidence intervals - progress bar, chart, or text?
   **Resolution Needed By:** Week 2
   **Options:** (A) Horizontal bar with shaded confidence region (B) D3 mini-chart (C) Text only
   **Recommendation:** (A) - visual + text, no heavy charting library needed

3. **Q:** Should speculative preview be modal, tooltip, or inline expansion?
   **Resolution Needed By:** Week 3
   **Options:** (A) Modal dialog (B) Floating tooltip (C) Inline card below hovered activity
   **Recommendation:** (C) - less disruptive, can show more detail than tooltip

4. **Q:** Cycle detection: warn or block execution?
   **Resolution Needed By:** Week 4
   **Options:** (A) Warn only (B) Block with override (C) Block entirely
   **Recommendation:** (B) - prevent accidents, allow intentional loops

5. **Q:** WebSocket fallback polling interval?
   **Resolution Needed By:** Week 5
   **Options:** (A) 1 second (B) 2 seconds (C) 5 seconds
   **Recommendation:** (B) - balance between responsiveness and server load

## Implementation Notes

**Component Structure:**
```
TrajectoryEditorPage
├── GoalInputBox (existing - minor tweaks)
├── ImpulseStatePanel (new - right sidebar)
│   ├── AccumulatedShapesView
│   ├── ShapeProvenanceTree
│   └── GoalProgressIndicator
├── TrajectoryGrid (existing - add state tracking)
│   ├── ActivityCard (existing - add Thompson scores)
│   └── StateTransitionArrows (new)
├── ApplicableActivitiesPanel (new - replaces path suggestions)
│   ├── ThompsonScoreCard
│   ├── ShapeCompatibilityIndicator
│   └── SpeculativePreviewCard
└── LiveExecutionOverlay (conditionally rendered)
    ├── TaskProgressBar
    ├── ImpulseResolutionIndicator
    └── LearningFeedbackPanel
```

**Store Shape:**
```typescript
interface TrajectoryState {
  // Existing
  activities: TrajectoryActivity[];
  selectedActivityId: string | null;
  goalText: string;

  // New
  impulseStateSpace: Map<number, Set<string>>; // column → shapes
  speculativeCache: WeakMap<Activity, StatePreview>;
  executionState: {
    executionId: string | null;
    currentColumn: number;
    currentTaskId: string | null;
    realizedImpulses: Map<string, Impulse>; // id → impulse
  } | null;
  learningFeedback: {
    thompsonUpdates: ThompsonDelta[];
    variantsCreated: string[];
    compositionEdges: CompositionEdgeUpdate[];
  } | null;
}
```

**Backend Changes Required:**
1. Mount WebSocket route in activity-api `src/index.ts`
2. Implement `POST /v2/activities/discover-by-shapes` endpoint
3. Enhance `/v2/goal-paths/recommend` to return confidence intervals

**Testing Strategy:**
- Unit tests for state space computation
- Integration tests for WebSocket reconnection
- E2E tests for complete trajectory authoring → execution → learning feedback flow
- Load tests for 50+ activity trajectories
- A/B test information density in learning feedback panel
