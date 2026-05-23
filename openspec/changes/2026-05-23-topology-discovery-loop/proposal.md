# 2026-05-23 — Topology-Discovery Loop

## Sequencing

This change is downstream of, in order:

1. `openspec/changes/2026-05-23-single-container-substrate/` — provides the
   in-container substrate where this work is exercised.
2. `openspec/changes/2026-05-23-harness-as-lifecycle-participant/` — provides
   the observer pattern (`lifecycle:execution:succeeded` → dispatch via
   dev-vessel CLI) and the `activityRegistryChange` emission contract this
   change reuses verbatim.

DEV begins only after both prerequisite changes have their R8 acceptance
gates green inside the container.

## Why this exists

`IMPULSE_ACTIVITY_FOUNDATION.md` (line 810) names **Topology Discovery** as
the system's purpose: *"probing the informational state to expand the
learned topology."* The same document defines **Convergence** as the lift
criterion: *"recall reliably succeeds without learning needing to add new
structure for known goal classes"* (line 33).

The substrate already has the primitives for topology discovery:

- **Improvisation** (foundation §"Improvisation: Wing It With Recording")
  — try something not in the registry, record the trace.
- **Ribosome** (foundation §62, §604) — trace-shaped → template-shaped
  extraction; closes the loop from a successful improvise into a learned
  template.
- **Escalation** via `create-shape-provider-goal` (foundation §819) — the
  binding layer escalates when a slot is `unbindable`, recursively producing
  the missing shape.
- The 4-cell **Reachability × Learnedness** table (foundation §799–808):
  `{Reachable+Learned, Reachable+Unlearned, Unreachable-but-known, Unknown}`.

What is missing is the **measurement** that locates the substrate in that
4-cell table, and the **firing wiring** that dispatches improvise/escalate
*from the measurement* rather than only from a user goal hitting an
unbindable slot.

Today's substrate fires topology-discovery activities reactively: a user
goal needs a shape that nothing produces, slot-binding escalates. There is
no proactive firing — nothing in the substrate observes that some
advertised shape has zero traces in N cycles and dispatches a probe against
it. The Reachable+Unlearned and Unknown cells of the table grow unobserved
and unshrunken between explicit user goals.

The harness-as-lifecycle-participant change established that activities can
fire in response to lifecycle events from other activities. This change
uses the same pattern to fire topology-discovery activities in response to
**measurement** activities that report on the 4-cell table. The result is
a closed loop: measurement → reachability/learnedness report → autonomous
probe → trace → next measurement.

## Proposal

Six activities, in two layers. Each follows the same template structure as
`harness-run-matrix`: a single resolver dispatch producing a single AET
plus a single report impulse.

### Measurement layer (three activities)

Each one snapshots one facet of the 4-cell table:

1. **`learned-topology-snapshot`** — queries discovery-vessel and
   activity-api for the complete advertised-shape set + activity-template
   set + per-shape execution count. Emits a `learnedTopologySnapshot`
   impulse whose body is the 4-cell table populated with current counts.
   This is the foundation-doc's "learned topology" made concrete (foundation
   §770: *"the sampled portion discovered through execution traces"*).

2. **`reachable-unlearned-report`** — diffs the snapshot. Lists every shape
   in the **Reachable + Unlearned** cell — i.e. claimed by some vessel,
   present in at least one template's `output_shapes`, but with zero
   execution traces in the lookback window. Emits a
   `reachableButUnlearnedReport`.

3. **`unknown-shape-report`** — scans recent goal text and the
   `make_activity_autonomous`-authored proposals in the proposals/
   directory for shape names that do NOT appear in
   `discovery-vessel/shapes` and have NO template producer. Emits an
   `unknownShapeReport` whose body is the **Unknown** cell.

### Probe layer (three activities)

Each one consumes a report and dispatches the existing primitive against
one cell entry:

4. **`probe-reachable-unlearned`** — fires on
   `lifecycle:execution:succeeded` of `reachable-unlearned-report` with a
   non-empty body. Picks the highest-priority entry (one per cycle), wraps
   it in a synthetic goal `"produce shape <X>"`, and dispatches the existing
   recommend → execute path. The resulting trace moves the shape from
   Reachable+Unlearned to Reachable+Learned.

5. **`probe-untraversed-edge`** — fires on a non-empty
   `learnedTopologySnapshot.untraversed_edges` field. Picks one composition
   edge `(activity A, output shape S, activity B)` that exists structurally
   but has never executed end-to-end, and dispatches a synthetic composition
   trace. Exercises a `trajectory` (foundation §793).

6. **`escalate-unknown-shape`** — fires on `unknownShapeReport`. For each
   unknown shape, invokes the existing `create-shape-provider-goal`
   primitive (foundation §819–820: *"escalate when needed → probe unmapped
   topology"*). This is the existing escalation path the binding layer
   already uses; this change just adds a second caller (the substrate's
   own measurement) on top of the existing caller (user-goal slot binding).

### Tag

All six activities tag their traces with `intent: "topology_discovery"` so
Thompson sampling can distinguish them from user-goal-driven runs. The
tag carries no special privilege; it is observational, so trace analysis
can answer questions like "what fraction of recent traces were
substrate-initiated probes?" without recomputing.

## Convergence criterion (operational definition of lift)

Foundation §33's convergence definition becomes measurable:

> The substrate is **converging** when, across consecutive measurement
> cycles, the count in the Reachable+Unlearned cell strictly decreases AND
> the count in the Unknown cell strictly decreases AND the count in the
> Reachable+Learned cell strictly increases — without external goal input.

The prior bookkeeping lift criterion (debt=0, 6/6 reuse on a hand-picked
matrix) is replaced by a topology-level criterion that is computable from
the snapshot impulses alone. Three consecutive cycles meeting the
strictly-monotonic condition is the new LIFT CANDIDATE marker.

## Out of scope

- **Modifying the foundation doc.** This spec uses its vocabulary; it does
  not change it.
- **Reachable-but-Unknown vs. Unreachable-but-Known distinction.** The
  foundation table has a fourth cell ("Unreachable but known"). It is not
  measured separately in this change; entries there appear as
  Reachable+Unlearned in the report (we don't yet distinguish "vessel
  exists but is offline" from "vessel exists but never invoked"). Follow-up.
- **Auto-improvisation when escalation fails.** If
  `escalate-unknown-shape` cannot produce the shape through any composition,
  the next move would be to dispatch raw improvisation (foundation
  §548–600). That is the boldest closure of the topology-discovery loop
  and warrants its own spec.
- **Budgeting / quota for probes.** The substrate could run unbounded
  probes. We assume the firing observer is rate-limited per
  harness-as-lifecycle-participant R6.1 and address quotas only if observed
  load demands it.
- **Cross-substrate topology comparison.** Two substrates with different
  trace histories will have different Reachable+Learned cells. Reconciling
  them (e.g. for promotion canary→prod) is a separate concern.
