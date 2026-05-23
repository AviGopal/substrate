# Design — Topology-Discovery Loop

All terminology aligned with `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`.
Where this spec uses a foundation term, the section reference is inline.

## A. The 4-cell table this spec operates on

From foundation §799–808 ("Reachability vs. Learnedness"):

```
                          | Demonstrated      | Not demonstrated
                          | (≥1 trace)        | (0 traces)
─────────────────────────────────────────────────────────────────
Reachable                 | Reachable+Learned | Reachable+Unlearned
(producer vessel online)  | "known knowns"    |
─────────────────────────────────────────────────────────────────
Not reachable             | Unreachable-but-  | Unknown
(no online producer)      | known             | (no producibility
                          |                   |  claim at all)
```

This spec adds **measurement** for the three non-trivial cells and
**probing** that moves entries leftward and upward (toward
Reachable+Learned). Reachable+Learned is the convergence target.

## B. Sequencing against existing primitives

Three foundation-doc primitives already exist; this spec wires them
together via measurement + observer, it does not re-implement them.

| Primitive             | Foundation §  | Role here                       |
|-----------------------|---------------|---------------------------------|
| Improvisation         | §548–600      | What `probe-reachable-unlearned`<br>and `probe-untraversed-edge`<br>ultimately dispatch when the<br>recommend path returns nothing |
| Ribosome              | §62, §604     | What extracts the resulting<br>trace back into a template,<br>moving entries leftward |
| Escalation            | §819–820      | What `escalate-unknown-shape`<br>dispatches via the existing<br>`create-shape-provider-goal` |

The spec writes no new improvisation logic, no new ribosome, no new
escalation. It writes the **measurement** (queries against the existing
trace store + discovery registry) and the **firing** (lifecycle observer
already specified in 2026-05-23-harness-as-lifecycle-participant §3).

## C. Why "topology discovery" not "curiosity"

The first draft of this work used "curiosity-driven dispatch." The
foundation doc already names the purpose **Topology Discovery** (§810,
§"Topology Discovery Is the Purpose"). Using a new term would fragment
vocabulary. The spec, the impulse shape names, the trace tags, and the
template ids all use *topology-discovery* exclusively.

Likewise:

- "Coverage gap" → **Reachable+Unlearned** (4-cell cell name).
- "Vocabulary gap" → **Unknown** (4-cell cell name).
- "Curiosity firing" → **substrate-initiated topology probe**.
- "Lift" (per-loop bookkeeping) → **Convergence** (foundation §33).
- "Self-directed execution" → not named in the foundation as a motion;
  this spec treats it as Recall (foundation's i→t→o motion) initiated by
  the substrate rather than by an external caller. The motion is the same;
  the caller is different.

## D. Impulse shape definitions

### `learnedTopologySnapshot`

```typescript
{
  shape: "learnedTopologySnapshot",
  body: {
    generated_at: string;        // ISO 8601
    lookback_window_seconds: number;

    // Reachable: union of shapes advertised by all online vessels
    advertised_shapes: Array<{
      shape: string;
      advertising_vessels: string[];     // vessel ids
      producing_templates: string[];     // template ids
    }>;

    // Learned: per-shape trace counts in the lookback window
    trace_counts: Record<string, number>;  // shape → count

    // Composition graph (foundation §789)
    composition_edges: Array<{
      from_activity: string;             // template id
      via_shape: string;                 // intermediate impulse shape
      to_activity: string;
      traversal_count: number;           // 0 = untraversed
    }>;
    untraversed_edges: Array<{
      from_activity: string;
      via_shape: string;
      to_activity: string;
    }>;

    // Counts for the 4-cell table
    counts: {
      reachable_learned: number;
      reachable_unlearned: number;
      unreachable_but_known: number;     // best-effort; may be 0 in v1
      unknown: number;                   // computed by unknown-shape-report
    };
  }
}
```

### `reachableButUnlearnedReport`

```typescript
{
  shape: "reachableButUnlearnedReport",
  body: {
    generated_at: string;
    snapshot_id: string;                 // trace id of source snapshot
    entries: Array<{
      shape: string;
      advertising_vessels: string[];
      producing_templates: string[];     // structurally capable
      best_template_id: string;          // highest Thompson α among producers
      priority: number;                  // 0–1; higher = more worth probing
    }>;
    total: number;
  }
}
```

Priority heuristic (v1): `priority = (# of advertising vessels) /
(advertised_shapes.length)`. Crude but observable; can be replaced once we
have data.

### `unknownShapeReport`

```typescript
{
  shape: "unknownShapeReport",
  body: {
    generated_at: string;
    sources: Array<{
      source_type: "goal_text" | "proposal_draft" | "scenario";
      source_id: string;
      shape_references: string[];        // shape names found in source
    }>;
    unknown_shapes: Array<{
      shape: string;
      first_observed_at: string;
      mention_count: number;             // times seen across sources
      sample_source_id: string;          // example for tracing
    }>;
    total: number;
  }
}
```

### `activityRegistryChange`

Already defined by 2026-05-23-harness-as-lifecycle-participant §D. This
spec extends emission: `probe-reachable-unlearned`,
`probe-untraversed-edge`, and `escalate-unknown-shape` MUST emit
`activityRegistryChange` on success (their work changed the registry's
trace coverage or, in the escalate case, may have spawned a new variant).
This means each probe firing automatically triggers a re-measurement on
the next cycle via the existing harness-lifecycle observer.

## E. The observer extension

The harness-lifecycle observer (R3.3 of the prior change) fires
`harness-run-matrix` on a small predicate set. This spec extends the
predicate to also fire:

- `learned-topology-snapshot` on the same triggers as `harness-run-matrix`
  (every `activityRegistryChange`, every `draft-gap-closing-activity`
  completion). Effect: every registry change re-measures the topology.
- `reachable-unlearned-report` on `lifecycle:execution:succeeded` of
  `learned-topology-snapshot`. Effect: every snapshot generates a diff.
- `unknown-shape-report` on the same trigger as
  `reachable-unlearned-report`. Effect: every snapshot generates a
  vocabulary-gap diff.
- `probe-reachable-unlearned` on
  `lifecycle:execution:succeeded` of `reachable-unlearned-report` with
  `body.total > 0`. Effect: one probe per non-empty report.
- `probe-untraversed-edge` on the same snapshot event but reading
  `untraversed_edges`. Effect: one edge probe per non-empty list.
- `escalate-unknown-shape` on `unknown-shape-report` with
  `body.total > 0`. Effect: one escalation per cycle.

The observer predicate becomes a small dispatch table mapping the
incoming event's `activity_template_id` (or `output_shapes`) to the
next-template-to-fire. No new infrastructure; just longer table.

## F. Convergence measurement

A new aggregator `convergence-tick` activity reads the most recent N
`learnedTopologySnapshot` impulses and emits a `convergenceReport` with:

```typescript
{
  cells_over_time: Array<{
    timestamp: string;
    reachable_learned: number;
    reachable_unlearned: number;
    unknown: number;
  }>;
  monotonic_progress: {
    reachable_learned_strictly_increasing: boolean;
    reachable_unlearned_strictly_decreasing: boolean;
    unknown_strictly_decreasing: boolean;
  };
  consecutive_converging_cycles: number;
  lift_candidate: boolean;   // all three monotonic & ≥ 3 consecutive cycles
}
```

This is the new lift criterion. The progression-driver script
(`validation/scripts/progression-driver.ts`) is left in place for the
6-scenario debt bookkeeping but no longer carries the lift call. The
`convergenceReport` is authoritative.

## G. Loop closure check

The full topology-discovery loop after this change:

```
[any activity completes / registry changes]
            │
            ↓
[learned-topology-snapshot]  ───→  learnedTopologySnapshot impulse + AET
            │
            ↓
[reachable-unlearned-report] ───→  reachableButUnlearnedReport impulse + AET
[unknown-shape-report]       ───→  unknownShapeReport impulse + AET
            │
            ↓
[probe-reachable-unlearned]  ───→  trace tagged intent=topology_discovery
[probe-untraversed-edge]     ───→  same
[escalate-unknown-shape]     ───→  may spawn new variant via create-shape-provider-goal
            │
            ↓
        (ribosome extracts template if improvise succeeded)
            │
            ↓
        activityRegistryChange emitted
            │
            └───→ back to top
```

The loop closes itself. After three cycles where all three monotonic
conditions hold, the `convergence-tick` activity stamps LIFT CANDIDATE
into its emitted report. Nothing external is required.

## H. Resolved

- *Why does this not just put everything inside `harness-run-matrix`?* —
  Each measurement activity emits a distinct shape so it can be observed,
  filtered, and re-fired independently. Bundling would couple them and
  prevent partial re-runs.
- *Why six activities instead of two (measure + act)?* — Each cell of the
  4-table has a distinct probe strategy. Bundling Reachable+Unlearned and
  Unknown into one activity would mean shared dispatch logic for two
  different existing primitives (recommend-and-execute vs. escalate via
  create-shape-provider-goal). Six small, single-purpose templates are
  easier to evolve.
- *Why does `escalate-unknown-shape` use create-shape-provider-goal
  instead of `scaffold-new-vessel`?* — Foundation §820 names
  create-shape-provider-goal as the canonical escalation mechanism.
  scaffold-new-vessel is for "I need a whole new vessel," which is a
  rarer move. The escalate activity may *internally* end up dispatching
  scaffold-new-vessel if create-shape-provider-goal fails, but the
  default first move is the documented canonical one.
- *Are probes safe?* — Probes dispatch existing activity templates. If
  those templates are unsafe, that is a registry-quality problem, not a
  topology-discovery problem. The substrate ships with the same safety
  posture (failure_mode taxonomy, budgets, validators) as user-goal runs.
