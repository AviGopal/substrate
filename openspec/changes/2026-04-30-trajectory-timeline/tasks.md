# Tasks: Trajectory Timeline

**Change ID**: `2026-04-30-trajectory-timeline`

Tasks are ordered by dependency. Work can begin on Groups 1–3 in parallel.

---

## Group 1: Connector Resolver Wires

### T1.1 — Extend `ShapeFlowConnector` props

Add `resolverWires` prop to `ShapeFlowConnector`:
```typescript
resolverWires?: Array<{
  shape: string;
  resolverName?: string;
  resolverTier?: 'deterministic' | 'pattern' | 'llm';
  impulseId?: string;
}>
```

Render: when `resolverName` is present, show `shape → resolverName [tier]●` using existing `ResolverTierBadge`. When absent, current shape-badge display unchanged.

**File**: `src/components/trajectory/TrajectoryGridWithDnd.tsx` (ShapeFlowConnector function)
**Acceptance**: connector shows resolver annotation when prop is provided; falls back to current display when absent.

---

### T1.2 — Compute cross-activity resolver wires for trace/live mode

In `TrajectoryGridWithDnd`, compute `resolverWires` for each connector when trace data is available:

- For each connector between column N and N+1:
  - Find the last task of column N's primary activity → get `output_impulse_ids`
  - Find the first task of column N+1's primary activity → get `input_impulse_ids` + `resolver_id` + `resolver_tier`
  - Intersection of output/input IDs → the crossing impulses
  - Map to `{ shape: impulseShapeMap[id], resolverName: task.resolver_id, resolverTier: task.resolver_tier, impulseId: id }`

**Data sources**: `taskImpulseIds` (store), `impulseShapeMap` (store), `traceCardData` (has resolver info per activity)
**File**: `src/components/trajectory/TrajectoryGridWithDnd.tsx`
**Acceptance**: in trace mode, connectors show actual resolver + impulse ID for shapes crossing the boundary.

---

### T1.3 — Compute inferred resolver wires for compose + connected mode

When `isLiveMode === false && isTraceMode === false` and a vessel is connected, use `useDiscoveryResolvers()` to infer resolver for each output shape of the left activity:

```typescript
const { byShape } = useDiscoveryResolvers();
// for each output shape of left activity:
resolverWires = outputShapes.map(shape => ({
  shape,
  resolverName: byShape.get(shape)?.vessels[0]?.vesselName,
  resolverTier: inferTierFromVesselShapes(byShape.get(shape)),
}));
```

**File**: `src/components/trajectory/TrajectoryGridWithDnd.tsx`
**Acceptance**: in compose mode with vessel connected, connectors show inferred resolver and tier. With no vessel, connectors show shapes only (no change).

---

## Group 2: Unfold Mechanism

### T2.1 — Add unfold toggle to activity card header

Add `isUnfolded` local state and `⊞/⊟` toggle button to each activity card in `TrajectoryGridWithDnd`. Toggle is adjacent to the existing `▾ expand` button. State is per-card, not persisted.

**File**: `src/components/trajectory/TrajectoryGridWithDnd.tsx` (card rendering section)
**Acceptance**: clicking ⊞ on any card sets `isUnfolded[activityId] = true`; clicking ⊟ sets it back.

---

### T2.2 — Create `ResolverSequence` component

New component (`src/components/trajectory/ResolverSequence.tsx`, ~150 lines):
- Props: `tasks: ActivityTask[]`, `mode: 'compose' | 'trace' | 'live'`, `impulseData?: { taskImpulseIds, impulseShapeMap, impulseContentMap }`
- Renders a horizontal row of resolver task nodes
- Each node: `TaskEditor` summary row, horizontal layout
- Inter-node connectors: mini shape-only connector (no resolver at this level — we are at resolver level)
- Handles `mode` to show appropriate data fidelity per node

**File**: `src/components/trajectory/ResolverSequence.tsx`
**Acceptance**: renders in isolation with mock task data; shows correct resolver badges based on mode.

---

### T2.3 — Create `SelectionMomentNode` component

New component (`src/components/trajectory/SelectionMomentNode.tsx`, ~80 lines):
- Props: `candidates: Array<{ name: string; probability: number; isSelected: boolean; alpha?: number; beta?: number }>`, `ciLower: number`, `ciUpper: number`, `resolverName: string`, `durationMs?: number`
- Visual: distinct diamond/highlighted border shape, ★ label
- Content: candidate probability bars (reuse pattern from `GhostActivityCard`)
- Thompson stats: α, β, CI

**Data**: parsed from `impulseContentMap[variant_selection_output_impulse_id]` — need to confirm content shape from actual trace data first (see OQ below).

**File**: `src/components/trajectory/SelectionMomentNode.tsx`
**Acceptance**: renders with mock data showing candidates, selection, CI.

---

### T2.4 — Wire `ResolverSequence` into unfolded card state

When `isUnfolded[activityId]` is true, replace the activity card body with `ResolverSequence`. The card header stays visible (with fold toggle). The surrounding connectors remain unchanged — they connect to the sequence's first and last resolver nodes.

Insert `SelectionMomentNode` for any task where `resolver_id === 'variant_selection'`.

**File**: `src/components/trajectory/TrajectoryGridWithDnd.tsx`
**Acceptance**: clicking ⊞ on a loaded trace card shows the resolver sequence inline; selection moment node appears for goal-processing.

---

## Group 3: Selection Moment Data

### T3.1 — Verify variant_selection impulse content shape

Before implementing `SelectionMomentNode` content parsing, load a trace with goal-processing (e.g. `goal_1777546582911_dfk0nv`) and inspect the actual content of the `variant-selection-TIMESTAMP-ID` impulse via `impulseContentMap`.

Query: does the content contain candidate activities with probabilities, α/β? What is the JSON structure?

**Acceptance**: design.md updated with confirmed content schema for `SelectionMomentNode` data parsing.

---

### T3.2 — Parse variant_selection impulse content

Add parser in `SelectionMomentNode` or a utility that extracts candidates from the impulse body. Handle missing/malformed content gracefully (show empty state).

**Acceptance**: `SelectionMomentNode` populated with real data from a loaded trace.

---

## Open Questions

**OQ-1**: Cross-activity impulse ID matching — do `output_impulse_ids` of activity A's last task match `input_impulse_ids` of activity B's first task in the existing trace data? Need to verify with `act_1777546582913_733bbi` (goal-processing) → `act_1777546660042_akl2d7` (execute-shell-command). If not (due to wrapper layer), T1.2 needs adjustment to walk the composition chain.

**OQ-2**: Compress vs scroll for many tasks in unfold — if an activity has 9 tasks at 120px each = 1080px, the unfolded section would overflow. Decide: compress each node narrower, or allow horizontal scroll within the section.

**OQ-3**: Compose + selection placeholder — should compose mode show a "★ selection will happen here" placeholder node when unfolded, to help users understand where Thompson Sampling will intervene? Or nothing?

---

## Resolved

*(none yet)*
