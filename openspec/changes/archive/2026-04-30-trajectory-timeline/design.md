# Design: Trajectory Timeline — The River Model

**Change ID**: `2026-04-30-trajectory-timeline`

---

## Mental Model: The River

The trajectory is a **flat river** of execution steps flowing left to right. Time increases left to right. Activities are **waypoints** in the river — small labeled markers — not containers. The impulse pool evolves at each step.

```
[seed pool] ──► [goal-processing •] ──► [impulse_state Det.●] ──► [context_acq Det.●]

──► [goal_enrich LLM●]  ──► [activity_rec LLM●]  ──► [★ variant_select]  ──► [◈ dispatch]
         │
         ▼  tool calls (vertical drop, no horizontal columns)
    [bash: run script]
    [file_read: output]

──► [exec-shell-cmd •] ──► [bash Det.●] ──► [goal_verify Det.●] ──► [llm●] ──► [llm●]

──► [slot-binding •]   (lifecycle hook — takes its place in the river at execution point)

──► [final pool]
```

**Activities are waypoints, not containers.** When an activity is folded, you see just its waypoint node. When unfolded, its resolver steps appear inline to its right as sibling columns in the same grid — not scrolled inside a card.

---

## Composition Model

**Any task whose `resolver` field is `"activity"` is a composition event.** This is not special to `dispatch_activity` in goal-processing. The ◈ dispatch node is the bridge: the composed sub-activity's waypoint appears immediately to its right in the river.

Tasks run before and after the dispatch point:
- pre-dispatch tasks: appear left of ◈
- post-dispatch tasks: appear right of ◈ (after the sub-activity's column group)

---

## River Nodes

All nodes are **sibling columns** in the main grid. There are no container cards.

| Node Type | Visual | When present |
|---|---|---|
| `InitialPoolNode` | Seed shapes list | Leftmost — always |
| `ActivityWaypointNode` | `• name [tag]` small marker | Start of each activity's step group |
| `ResolverStepNode` | `resolver_id [tier●]` column | Each task in an unfolded activity |
| `SelectionMomentNode` (★) | Yellow border, probability bars | Task with `resolver_id === "variant_selection"` |
| `CompositionBridgeNode` (◈) | Amber marker | Task with `resolver === "activity"` |
| `LifecycleHookNode` | `[hook] name` dimmed | slot-binding, validator-dispatch at their execution point |
| `GhostActivityNode` | 40% opacity | Predicted next activity (compose/live) |
| `FinalPoolNode` | Accumulated shapes | Rightmost — always |

---

## Tool Sub-DAG (Vertical)

An LLM resolver (or any resolver) that calls tools creates a local sub-DAG rooted at that resolver node. This sub-DAG renders **vertically below** the resolver's column — it does not occupy additional horizontal grid columns.

```
[goal_enrich LLM●]         ← horizontal river column
        │
        ├─ bash: <cmd>      ← vertical sub-DAG
        ├─ file_read: <path>
        └─ bash: <cmd2>
```

Sub-DAG depth is unbounded. Each level is indented below its parent. Collapsed by default; clicking the resolver node expands/collapses the sub-DAG.

Data source: `task.tool_calls[]` from the execution trace.

---

## Layout Algorithm

The main grid computes a `RiverColumn[]` array:

```typescript
type RiverColumn =
  | { type: 'pool';       key: string; shapes: string[] }
  | { type: 'waypoint';   key: string; activityId: string }
  | { type: 'resolver';   key: string; taskId: string; activityId: string }
  | { type: 'connector';  key: string; leftKey: string; rightKey: string }
  | { type: 'ghost';      key: string }

function buildRiver(
  activities: ActivityDef[],
  unfoldedActivities: Set<string>,
  mode: 'compose' | 'trace' | 'live'
): RiverColumn[]
```

For each activity in order:
1. Emit `connector` (pool → first waypoint, then between all adjacent columns)
2. Emit `waypoint` for the activity
3. If `unfoldedActivities.has(activityId)`: emit `resolver` for each task (in canonical call order)

Folded activity: `[waypoint]` only.
Unfolded activity: `[waypoint] → [task1] → [task2] → ... → [taskN]`

---

## Mode-Specific Behaviour

### Compose Mode (no trace)
- Waypoints show template-declared name and tag
- Resolver steps show template-declared `resolver` field; no tier dot (tier unknown pre-execution)
- No tool sub-DAG (no trace data)
- Ghost node appears at the end

### Compose Mode (vessel connected)
- Resolver steps show inferred tier from `useDiscoveryResolvers().byShape`
- Connector wires show inferred resolver per shape (T1.3)

### Trace Mode
- All steps are historical; displayed left→right in call order
- Resolver steps show actual `resolver_id`, `resolver_tier`, duration
- Tool sub-DAG populated from `task.tool_calls[]`
- ★ node shows Thompson data from impulse content (or traceCardData fallback)
- Connector wires show actual resolver + impulse ID (T1.2)

### Live Mode
- Completed steps: same as trace
- Current step: animated running indicator (pulse ring)
- Pending steps: ghosted (40% opacity, no resolver data)
- The current activity waypoint is the focal point; completed to its left, pending to its right

---

## Fold State

`unfoldedActivities: Set<string>` — per-session, not persisted. Lives in the trajectory store or local state.

The fold toggle control lives **on the `ActivityWaypointNode`**. A single chevron button (▶ folded / ▼ unfolded). The old `▾ expand` (vertical task list inside a card) is **removed**.

---

## Component Map

### Removed / Replaced
- `ActivityCard` container pattern — replaced by `ActivityWaypointNode` + sibling resolver columns
- `ResolverSequence` (inline card scroll) — removed; resolver steps are now main-grid columns
- `⊞/⊟` unfold toggle inside card header — replaced by waypoint chevron

### Kept and Adapted
- `SelectionMomentNode` — unchanged visually; now rendered as a sibling river column
- `CompositionBridgeNode` — unchanged visually; now rendered as a sibling river column
- `ShapeFlowConnector` — adapted to connect between any adjacent pair of river columns, not just activity cards
- `ResolverTierBadge` — unchanged

### New Components

**`ActivityWaypointNode`** (`src/components/trajectory/ActivityWaypointNode.tsx`, ~80 lines)
- Props: `activityId`, `name`, `tag`, `mode`, `taskCount`, `detCount`, `llmCount`, `isUnfolded`, `onToggle`, `traceStats?`
- Visual: compact inline marker — `▶/▼ name [tag]  5det 4llm`
- No card border, no collapse-to-nothing — always visible as a waypoint

**`ResolverStepNode`** (`src/components/trajectory/ResolverStepNode.tsx`, ~100 lines)
- Props: `task`, `activityId`, `mode`, `impulseData?`, `isRunning?`
- Visual: same column shape as the current regular task node in `ResolverSequence`
- Contains: `ToolSubDAG` when `task.tool_calls` is non-empty and sub-DAG is expanded

**`ToolSubDAG`** (`src/components/trajectory/ToolSubDAG.tsx`, ~80 lines)
- Props: `toolCalls: ToolCall[]`, `expanded: boolean`
- Visual: vertical list of tool call rows below the resolver node
- Each row: tool name, truncated args, outcome icon

**`buildRiver`** utility (`src/lib/trajectory-river.ts`, ~80 lines)
- Pure function: `(activities, unfoldedActivities, mode, traceData) => RiverColumn[]`
- Tested in isolation (unit tests)

---

## Connector Wire States (unchanged from T1.x)

| Context | Display |
|---|---|
| Compose, no vessel | Shape name only |
| Compose, vessel connected | `shape → inferredResolver [tier●]` |
| Trace / Live | `shape:#id → resolver [tier●]` |

The connector between a waypoint and its first resolver step shows the shapes entering the activity. The connector between the last resolver step and the next waypoint shows the shapes the activity produced.

---

## Open Questions (Resolved)

- **OQ-1**: Cross-activity impulse ID matching — uses right column's first task resolver_id (confirmed T3.1).
- **Expand vs unfold conflict** — resolved by removing the container card pattern entirely. Single fold/unfold per activity via waypoint chevron.
- **Compose directionality** — everything flows left→right regardless of mode. Trace = historical record, compose = predictive sequence, live = split at current step.
