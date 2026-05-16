# Proposal: Trajectory Timeline — Resolver-Aware Continuous Flow

**Change ID**: `2026-04-30-trajectory-timeline`

---

## Problem

The trajectory editor currently renders activities as a horizontal list of card columns. While this is functional, it hides the most important information:

1. **The state transition** — what changed between activities (shapes consumed/produced) is buried in tiny connector badges
2. **The resolver context** — which resolver consumed each shape is invisible in compose mode and trace mode alike
3. **The selection moment** — Thompson Sampling's decision (`variant_selection` task) is hidden inside an activity card, not surfaced as a first-class event on the timeline
4. **The hierarchical nature** — activities are composed of resolver sequences, and the trajectory is itself an activity at a higher level. This self-similarity is invisible; you cannot "unfold" an activity to see its internal resolver chain in the same timeline

The result: viewing a trajectory tells you *what ran*, not *why*, *how*, or *what it did to the impulse state*.

---

## Proposed Solution

Treat the trajectory as a **resolver-sequence timeline** — a continuous flow where:

- The **primary visual element** is the impulse pool and how it changes at each step
- **Activities** are named resolver bundles — visually they are collapsible sections of the same timeline
- **Connectors** between activities show the shapes flowing across, annotated with the resolver that will consume them (inferred from discovery in compose mode, actual from trace data in trace/live mode)
- **Unfolding** an activity slots its internal resolver tasks inline as first-class timeline nodes — no mode change, no navigation, just a zoom into the activity's resolver sequence
- **Selection moments** (`variant_selection` resolver tasks) are rendered with a distinct node type showing Thompson Sampling context (candidates, α/β, CI)

---

## Scope

**In scope:**
- Connector region redesign: resolver-annotated wires (three states: shape-only, shape+inferred resolver, shape+actual resolver+impulse ID)
- Unfold mechanism: activity → inline resolver task sequence
- Selection moment node: distinct visual for Thompson Sampling decision tasks
- Pool bar left side: show consumed resolver for each shape (trace/live), inferred resolver (compose+connected), shape only (compose+disconnected)
- Mode parity: same structural idioms in compose, trace, and live modes

**Out of scope (deferred):**
- Latent shape visualization (shapes in pool not consumed by anything downstream)
- Temporal proportionality (activities scaled to actual duration)
- Full Sankey diagram for the impulse flow
- Multi-level zoom (beyond one unfold level)

---

## Key Design Decisions

### D1: Resolver-Annotated Wires

The connector between activities shows three levels of detail based on available context:

| Context | What's shown |
|---|---|
| Compose, no vessel | Shape name only (`source_code`) |
| Compose, vessel connected | Shape + inferred resolver tier dot (`source_code → bash [Det.]`) |
| Trace / Live | Shape + impulse ID + actual resolver (`src:#g7h8 → bash [Det.]`) |

The resolver tier dot is the same `ResolverTierBadge` component already used in `TaskEditor` rows.

### D2: Unfold Is a Zoom, Not Navigation

Unfolding an activity replaces its single card with N resolver-task nodes inline in the same timeline. The surrounding activities and connectors are unaffected. Fold/unfold is a toggle on the activity card header.

Unfolded resolver tasks use the same `TaskEditor` row format as today, just rendered horizontally in the timeline rather than vertically inside a card.

### D3: Selection Moment Node

When an activity is unfolded and contains a `variant_selection` resolver task, that task renders as a diamond/branch node (★) showing:
- Top candidates with probability bars
- Selected activity name
- α, β, confidence interval

This is the moment the trajectory was decided and should be visually prominent.

### D4: Latent Shapes Deferred

Shapes in the pool that no downstream resolver consumes are not rendered in the connector. Only shapes that flow to a specific consumer are shown.

---

## Reuse Strategy

This change is designed to **minimize new code** by reusing existing wiring:

| Existing | Used For |
|---|---|
| `ResolverTierBadge` | Tier dot on connector wires |
| `TaskEditor` (row variant) | Unfolded resolver task nodes |
| `useDiscoveryResolvers` | Infer resolver for compose+connected |
| `taskImpulseIds`, `impulseShapeMap` | Actual impulse wire data in trace/live |
| `taskResolutions` (WS events) | Live resolver info |
| `traceCardData.relativeStartSec` | Timing labels on connector |
| `GhostActivityCard` | Predicted next activity (unchanged) |
| `stateSpace`, `getNewShapesAtColumn` | Pool delta computation |

---

## Success Criteria

1. In trace mode, loading a completed `goal_` trace shows resolver-annotated wires between activities — the shape and the resolver that consumed it are visible without expanding any card
2. Unfolding goal-processing slots 9 resolver tasks inline; the `variant_selection` task renders as a selection moment node with Thompson Sampling context
3. In compose mode with vessel connected, connectors show inferred resolver for each shape from discovery
4. In compose mode without vessel, connectors show shape names only — no speculative resolver info
5. All three modes render with the same structural idioms — the same components, the same visual language, different data fidelity
