# Tasks: Trajectory Timeline

**Change ID**: `2026-04-30-trajectory-timeline`

---

## Group 1: Connector Resolver Wires ✅

### ✓ T1.1 — Extend `ShapeFlowConnector` props ✅
### ✓ T1.2 — Compute cross-activity resolver wires for trace/live mode ✅
### ✓ T1.3 — Compute inferred resolver wires for compose + connected mode ✅

*(See Resolved section for details.)*

---

## Group 2: Unfold Mechanism — SUPERSEDED by Group R

The T2.x tasks were implemented but used the wrong model: resolver steps were placed inside an inline scroll area within the activity card rather than as sibling columns in the main river. Group R replaces the T2.x implementation.

The `SelectionMomentNode` (T2.3) and `CompositionBridgeNode` (T2.5) components are **kept** — their visuals are correct. Only their wiring changes (they become sibling river columns, not nodes inside ResolverSequence).

`ResolverSequence.tsx` and the `⊞/⊟` card-header toggle are **removed** as part of Group R.

---

## Group 3: Selection Moment Data ✅

### ✓ T3.1 — Verify variant_selection impulse content shape ✅
### ✓ T3.2 — Parse variant_selection impulse content ✅

*(See Resolved section for details.)*

---

## Group R: River Model Redesign

Implements the flat-river layout described in the updated design.md. Activities become waypoints; resolver steps are sibling grid columns.

---

### ✓ R1 — `buildRiver` utility function ✅

Create `src/lib/trajectory-river.ts`:

```typescript
type RiverColumn =
  | { type: 'pool';      key: string; shapes: string[] }
  | { type: 'waypoint';  key: string; activityId: string; activity: ActivityDef }
  | { type: 'resolver';  key: string; taskId: string; activityId: string; task: ActivityTask }
  | { type: 'connector'; key: string; leftKey: string; rightKey: string }
  | { type: 'ghost';     key: string }

function buildRiver(
  activities: ActivityDef[],
  unfoldedActivities: Set<string>,
  mode: 'compose' | 'trace' | 'live'
): RiverColumn[]
```

Rules:
- Always emit `pool` at position 0
- For each activity: emit `waypoint`, then if unfolded emit a `resolver` per task (in `tasks[]` order)
- Emit `connector` between every adjacent pair
- Emit `ghost` at the end when mode is compose or live

**File**: `src/lib/trajectory-river.ts`
**Acceptance**: unit-testable pure function; produces correct column array for folded, unfolded, and mixed states.

---

### ✓ R2 — `ActivityWaypointNode` component ✅

New component (`src/components/trajectory/ActivityWaypointNode.tsx`, ~80 lines):

```typescript
interface ActivityWaypointNodeProps {
  activityId: string
  name: string
  tag?: string
  mode: 'compose' | 'trace' | 'live'
  taskCount?: number
  detCount?: number
  llmCount?: number
  isUnfolded: boolean
  onToggle: () => void
  traceStats?: { alpha?: number; beta?: number; durationMs?: number }
  className?: string
}
```

Visual: compact horizontal marker — `▶/▼  name  [tag]  5det 4llm  α2 β1`

No card border, no container. Width ~200px. The fold/unfold chevron (▶/▼) is the only interactive element on this node.

**File**: `src/components/trajectory/ActivityWaypointNode.tsx`
**Acceptance**: renders in trace and compose mode; toggle button calls `onToggle`.

---

### ✓ R3 — `ResolverStepNode` component ✅

New component (`src/components/trajectory/ResolverStepNode.tsx`, ~100 lines):

```typescript
interface ResolverStepNodeProps {
  task: ActivityTask
  activityId: string
  mode: 'compose' | 'trace' | 'live'
  impulseData?: { taskImpulseIds: Map<string, {...}>; impulseShapeMap: Map<string, string> }
  isRunning?: boolean
  className?: string
}
```

Visual: same compact column as the current regular-task nodes in the old ResolverSequence — `resolver_id [tier●]` plus output shape badges. Renders `SelectionMomentNode` for variant_selection tasks and `CompositionBridgeNode` for activity-resolver tasks (reusing existing components).

When `task.tool_calls` is non-empty: renders a `ToolSubDAG` below the node (collapsed by default, toggle on click).

**File**: `src/components/trajectory/ResolverStepNode.tsx`
**Acceptance**: renders correct node type per task; ToolSubDAG expands/collapses on click.

---

### ✓ R4 — `ToolSubDAG` component ✅

New component (`src/components/trajectory/ToolSubDAG.tsx`, ~80 lines):

```typescript
interface ToolCall {
  name: string
  args?: Record<string, unknown>
  result?: string
  durationMs?: number
}

interface ToolSubDAGProps {
  toolCalls: ToolCall[]
  expanded: boolean
  onToggle: () => void
}
```

Visual: vertical list below the resolver node. Each row: `⚙ tool_name  args_summary  ✓/✗  duration`. Indented with a connecting line to the parent resolver. Depth unbounded (each tool call can itself have nested calls via the same component).

Data source: `task.tool_calls[]` from trace data (when available).

**File**: `src/components/trajectory/ToolSubDAG.tsx`
**Acceptance**: renders with mock tool call data; expands/collapses; handles nested calls.

---

### ✓ R5 — Rework `TrajectoryGridWithDnd` to river layout ✅

Major rework of `TrajectoryGridWithDnd.tsx`:

1. **Replace** the `unfoldedCards: Set<string>` + `ResolverSequence` inline rendering with a call to `buildRiver(activities, unfoldedActivities, mode)` that produces the column array
2. **Render loop**: iterate `RiverColumn[]`; for each column type render the appropriate node:
   - `pool` → `InitialPoolBar` (existing)
   - `waypoint` → `ActivityWaypointNode` (new R2)
   - `resolver` → `ResolverStepNode` (new R3)
   - `connector` → `ShapeFlowConnector` (existing, adapted)
   - `ghost` → `GhostActivityCard` (existing)
3. **Remove** the old card-container rendering path, the `⊞/⊟` toggle buttons from `ActivityCard`, and the `ResolverSequence` import
4. **Keep** all existing drag-reorder, add/remove activity logic — only the render output changes
5. **Wire** `unfoldedActivities` state to `ActivityWaypointNode.onToggle`

**File**: `src/components/trajectory/TrajectoryGridWithDnd.tsx`
**Acceptance**: folded state shows one waypoint per activity (same visual footprint as current card); unfolded shows waypoint + resolver step columns inline; fold/unfold toggle on waypoint works.

---

### ✓ R6 — Remove `ResolverSequence`, clean up `ActivityCard` ✅

1. Delete `src/components/trajectory/ResolverSequence.tsx` (superseded by river layout)
2. Remove `isUnfolded` / `onToggleUnfold` props from `ActivityCard` — the card no longer needs to know about unfold state
3. Remove the `⊞/⊟` button from `ActivityCard` header
4. Keep `ActivityCard` for the compose-mode "add activity" ghost/empty card and the drag handle — it no longer renders task lists internally

**File**: `src/components/trajectory/ActivityCard.tsx`, `ResolverSequence.tsx`
**Acceptance**: `bun run typecheck` passes; no references to removed props.

---

### ✓ R7 — Live mode step classification ✅

In live mode, classify each resolver step as `completed | running | pending`:

- `completed`: task appears in the loaded trace with `success: true/false`
- `running`: task matches the active WS `task.started` event (no `task.completed` yet)
- `pending`: task is from the template but has no trace entry yet

Pass classification as a prop to `ResolverStepNode`:
- `completed` → normal display with tier dot
- `running` → amber pulse ring around the node
- `pending` → 40% opacity, no tier dot, resolver from template

**File**: `src/components/trajectory/TrajectoryGridWithDnd.tsx`, `ResolverStepNode.tsx`
**Acceptance**: in live mode with an active execution, completed tasks render normally, current task pulses, pending tasks are ghosted.

---

## Open Questions

**OQ-4**: When an activity is unfolded and has many tasks (e.g. 9 tasks × ~140px = 1260px), does the canvas scroll horizontally at the main grid level? Recommendation: yes — use `overflow-x-auto` on the main canvas container; the canvas is already a horizontal flow.

**OQ-5**: When the activity is folded, should the `ActivityWaypointNode` show the Thompson α/β and CI? Or only the name + task count summary? Recommendation: show α/β inline on the waypoint in trace mode; hide in compose mode (no data).

---

## Resolved

- **T1.1** (2026-04-29): `ShapeFlowConnector` extended with `resolverWires` and `compositionResolver` props.
- **T1.2** (2026-04-29): Trace/live mode computes resolver wires from right column's first task.
- **T1.3** (2026-04-29): Compose mode infers resolver wires from `useDiscoveryResolvers().byShape`.
- **T2.1** (2026-04-29): `⊞/⊟` toggle added to `ActivityCard` header. **Superseded by R5/R6.**
- **T2.2** (2026-04-29): `ResolverSequence` created. **Superseded by R5; component deleted in R6.**
- **T2.3** (2026-04-29): `SelectionMomentNode` created. Kept — wiring changes in R3/R5.
- **T2.4** (2026-04-29): `ResolverSequence` wired into unfolded card state. **Superseded by R5.**
- **T2.5** (2026-04-29): `CompositionBridgeNode` created. Kept — wiring changes in R3/R5.
- **T3.1** (2026-04-29): `variant_selection` impulse is local minibob memo; `parseSelectionContent()` added; `traceCardData.dispatchedByName` used as fallback.
- **T3.2** (2026-04-29): `SelectionMomentNode` populated with trace fallback data.
