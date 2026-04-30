# Design: Trajectory Timeline — Resolver-Aware Continuous Flow

**Change ID**: `2026-04-30-trajectory-timeline`

---

## Composition Model

**Any task whose `resolver` field is `"activity"` is a composition event.** This is not special to `dispatch_activity` in goal-processing — any task in any activity can compose a sub-activity using the `activity` resolver, in the same way it might use `bash`, `file`, or `llm`. Examples:

- `goal-processing` task 6: `activity` resolver → spawns `exec-shell-command`
- `slot-binding` task: `activity` resolver → spawns `create-shape-provider-goal` when a shape is missing
- `validator-dispatch` task: `activity` resolver → spawns a validator activity
- `ribosome-extract` task: `activity` resolver → spawns `make-activity`

**Consequence for temporal layout**: tasks in an activity run **before and after** the composed sub-activity. The composed activity is nested inside the parent, not parallel to it:

```
T=0                        T=35s              T=63s      T=90s
│──── goal-processing ─────────────────────────────────────────│
│  t1  t2  t3  t4  t5  │                   │  t7  t8  t9       │
│              ↓ t6: activity resolver      │                   │
│                       │──exec-shell-cmd──│                   │
│                            (composed)                         │
```

The **composition point** (task using `activity` resolver) is the bridge between the parent activity's pre-dispatch tasks and the composed sub-activity. Post-dispatch tasks (like `goal_verification`) run after the composed activity completes. An activity can have multiple composition events — each `activity` resolver task spawns a separate sub-activity.

This means columns in the trajectory editor are not independent parallel activities — they represent composed sub-activities at successive nesting depths. The column boundary IS the `activity` resolver call.

---

## Practical UI Shape

### The Timeline Strip (per activity boundary)

The connector between columns now explicitly represents the **`activity` resolver call** that composed the right column's activity. It carries:
1. The shapes that flowed from the left activity into the composed activity (inputs)
2. The resolver annotation showing the `activity` resolver as the mechanism
3. Optionally (when unfolded): which specific task in the left activity made the call

```
┌──────────────────┐      ┌───────────────────────────────────┐      ┌──────────────────┐
│  goal-processing │      │  COMPOSITION POINT (task 6)        │      │  exec-shell-cmd  │
│  [unfold ▾]      │──────│  activity [Det.]●                  │──────│  [unfold ▾]      │
│                  │      │  ├─ source_code → bash [Det.]●     │      │                  │
│  α:2 β:1 · 67%  │      │  └─ config_file → file [Det.]●     │      │                  │
└──────────────────┘      └───────────────────────────────────┘      └──────────────────┘
```

The connector header shows `activity [Det.]●` — the resolver that composed the sub-activity. Below it, the shapes flowing into the composed activity are annotated with the resolver that will consume them inside the sub-activity (same as before, but now grouped under the composition point).

**Width of connector region**: fixed at ~88px. The resolver annotation fits above the shape wires.

**Shape wire states:**
- `shape_name → resolver [Tier]●` — when resolver is known (trace/live or compose+connected)
- `shape_name ────────────────` — when resolver unknown (compose+disconnected)
- `shape_name (→ later)` — shape passes through, consumed by a later activity (dimmed)
- `⚠ shape_name (missing)` — shape needed by next activity but absent (red)

---

### The Unfold Toggle

Each activity card header gets an unfold button alongside the existing expand/collapse:

```
┌───────────────────────────────────────────────────────┐
│  ○ Goal Processing (Activity-Driven)  [goal]    ▾ ⊞  │
│    Default goal-resolution meta-activity...           │
└───────────────────────────────────────────────────────┘
         ↑ existing collapse    ↑ NEW: unfold (⊞/⊟)
```

**⊞ = unfold** (expand to show resolver sequence inline)
**⊟ = fold** (collapse back to activity card)

---

### Unfolded State

When unfolded, the activity card is replaced by a horizontal sequence of resolver task nodes. Any task whose `resolver` is `"activity"` is identified as the **composition bridge** (`[◈]`) — it connects the pre-dispatch resolver tasks on its left to the composed sub-activity column on its right, and the post-dispatch resolver tasks continue after it:

```
  ── pre-dispatch tasks ──────────────── [◈ activity] ──▶ [next column]
                                                    │
                                         ── post-dispatch tasks ──
```

Full example for goal-processing:

```
 {goal,dir} ─[1:impulse_state Det.●5s]─{+scan}─[2:context_acq Det.●20s]─{+ctx}
             ─[3:goal_enrich LLM●10s]─{+enriched}─[4:activity_rec LLM●5s]─{+recs}
             ─[5:variant_select ★ Det.●2s]─{+selection}
             ─[6:activity Det.●<1s ◈]────────────────────────▶ [exec-shell-cmd column]
             ─[7:goal_verify Det.●5s]─[8:human? skipped]─[9:decompose LLM●8s]
```

The `◈` bridge node (task 6) is the column boundary. The column to its right (exec-shell-command) is what that `activity` resolver composed. Tasks t7-t9 run after the composed sub-activity completes — they appear after the bridge in the same unfolded section.

**Multiple composition events**: if an activity has two tasks with `resolver: "activity"`, it composes two sub-activities sequentially. Both appear as `◈` nodes, each bridging to a separate column.

**Layout**: horizontal scroll within the unfolded section. Each resolver task node is ~120px wide. Inter-task connectors show the shape produced and passed to the next node.

---

### Selection Moment Node (★)

The `variant_selection` resolver task renders with a diamond shape and Thompson Sampling annotation. This appears inline when the activity is unfolded:

```
        ┌─────────────────────────────────────┐
        │  ★ variant_selection  Det. ● 2s     │
        │─────────────────────────────────────│
        │  Pool: {goal, dir, tmpl, rec, ...}  │
        │                                     │
        │  ████████████ 67% exec-shell-cmd    │ ← selected
        │  ████         23% add-feature       │
        │  ██            8% hello-world       │
        │                                     │
        │  [α:3 β:1] · CI[42–89]             │
        └─────────────────────────────────────┘
```

**Data source**: the `variant-selection-TIMESTAMP-ID` impulse output of the variant_selection task. Content from `impulseContentMap` (already fetched by `executionTraceWithSignatures`).

**Component**: new `SelectionMomentNode` wrapping existing `FrontierIndicator` + Thompson bar display already in `GhostActivityCard`.

---

## Mode-Specific Behavior

### Compose Mode (no vessel)

```
CONNECTOR:
  source_code ─────────────────────
  config_file ─────────────────────
  (shape names only, no resolver)

UNFOLD:
  Shows template-declared tasks from activity.template.tasks[]
  resolver shown as the declared resolver field (e.g. "llm", "bash")
  No tier dot (tier only known at execution time)
  
SELECTION NODE:
  Not shown in compose mode (no Thompson data available)
  GhostActivityCard shown instead at trajectory end
```

### Compose Mode (vessel connected)

```
CONNECTOR:
  source_code → bash [Det.]●
  config_file → file [Det.]●
  (resolver inferred from useDiscoveryResolvers)
  
  Inference: for each output shape of activity A,
  find which resolver in the connected vessel handles it
  → useDiscoveryResolvers().byShape.get(shape)?.vessels[0]
  → map to resolver tier via vessel's advertised shapes

UNFOLD:
  Same as disconnected, but resolver field auto-populated
  from discovery if task resolver_id is not explicit

SELECTION NODE:
  Not shown — no Thompson data without an actual trace
```

### Trace Mode

```
CONNECTOR:
  src:#g7h8 → bash [Det.]●
  cfg:#k1l2 → file [Det.]●
  (actual impulse IDs + resolver_id + resolver_tier from trace)
  
  Data: tasks[i].input_impulse_ids → tasks[i].resolver_id
  Connects: output of task X in activity A → input of task Y in activity B
  Cross-activity: the last task of A's output_impulse_ids 
                  = the first task of B's input_impulse_ids

UNFOLD:
  Shows actual trace tasks with resolver_id badges
  Already implemented in TaskEditor — reuse directly
  
SELECTION NODE:
  Shown when variant_selection task is present and has output impulse
  Content from impulseContentMap[variant_selection_output_id]
```

### Live Mode

```
CONNECTOR:
  Completed tasks: same as trace (actual resolver + impulse ID)
  In-progress tasks: from WS impulse.resolved events
    → setImpulseShape / setImpulseContent already handle this
  Upcoming tasks: same as compose+connected (inferred)
  
UNFOLD:
  Same as trace for completed tasks
  TaskEditor "isRunning" state for current task
  Ghost resolver nodes for upcoming tasks

SELECTION NODE:
  Shown when variant_selection WS event arrives
  Can show live (before activity completes) because WS 
  broadcasts impulse.resolved for each task output
```

---

## Component Map

### Modified Components

**`ShapeFlowConnector`** (in `TrajectoryGridWithDnd.tsx`)
- Add `resolverWires` prop: `Array<{ shape: string; resolverName?: string; resolverTier?: ResolverTier; impulseId?: string }>`
- Render resolver label + `ResolverTierBadge` when `resolverName` is present
- Fall back to current shape-only display when `resolverName` is absent
- `passing` shapes shown as dimmed, without resolver annotation (already exists)

**`ActivityCard`** (or its parent in `TrajectoryGridWithDnd.tsx`)
- Add unfold toggle button `⊞/⊟` to card header
- When unfolded: replace card body with horizontal `ResolverSequence` component
- `isUnfolded` state: local per-card (does not affect store)

### New Components

**`ResolverSequence`** (new, ~150 lines)
- Horizontal row of resolver task nodes
- Each node: compact `TaskEditor` variant (summary row only, expandable inline)
- Inter-node connectors: mini `ShapeFlowConnector` (shape only, no resolver — we're already at resolver level)
- `SelectionMomentNode` rendered for tasks where `resolver_id === 'variant_selection'`

**`SelectionMomentNode`** (new, ~80 lines)
- Diamond visual shape
- Thompson Sampling bar chart (reuse pattern from `GhostActivityCard`)
- Shows: candidates, selected, α, β, CI
- Data: parsed from `impulseContentMap[task.output_impulse_ids[0]]`

---

## Data Wiring for Connector Resolver Inference

### Trace/Live (actual data)

The cross-activity resolver wire requires knowing: "which resolver in activity B consumed shape X from activity A?"

```typescript
// Already in store:
taskImpulseIds: Map<taskId, { inputIds: string[], outputIds: string[] }>
impulseShapeMap: Map<impulseId, shape>

// Wire computation (per connector):
const lastTaskOfA = activities[colA].template.tasks.at(-1);
const firstTaskOfB = activities[colB].template.tasks[0];

const outputsOfA = taskImpulseIds.get(lastTaskOfA.id)?.outputIds ?? [];
const inputsOfB  = taskImpulseIds.get(firstTaskOfB.id)?.inputIds ?? [];

// Intersection: which impulses flow across
const crossing = outputsOfA.filter(id => inputsOfB.includes(id));
// → these get resolver_id from the CONSUMING task (firstTaskOfB)
```

**Note**: this is cross-task within the trace. The resolver shown on the wire is the resolver of the CONSUMING task in the next activity.

### Compose + Connected (inferred)

```typescript
// useDiscoveryResolvers already built:
const { byShape } = useDiscoveryResolvers();

// For each output shape of activity A:
const wire = activityA.template.output_shapes?.map(shape => ({
  shape,
  resolverName: byShape.get(shape)?.vessels[0]?.vesselName,
  resolverTier: inferTier(byShape.get(shape)),
}));
```

---

## Open Questions

1. **Unfold scroll**: if goal-processing has 9 tasks × ~120px = 1080px wide, does it scroll horizontally within its section or does it compress? Recommendation: compress to fit viewport width, each node narrower when many tasks.

2. **Selection moment in compose**: in compose mode there's no Thompson data. The `GhostActivityCard` at the end already fills the prediction role. Should compose mode show a "selection will happen here" placeholder in the unfolded view, or nothing?

3. **Cross-task impulse matching**: the impulse IDs that flow from activity A to activity B go through the wrapper layer (`_activity_execute`). The actual input_impulse_ids of B's first task may not directly match the output_impulse_ids of A's last task. Need to verify with actual trace data before implementing the cross-connector wiring.
