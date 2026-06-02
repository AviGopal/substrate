# Orthogonal learning across activity-template executions — generalizable pattern

**Date:** 2026-06-02
**Author:** operator + substrate (operator-authored summary; substrate-authored decisions queued via observe-orthogonal-patterns activity)

The operator asked: *"How do we learn orthogonally across activity template executions and how is this a generalizable pattern?"* — paired with the meta-question of when to CREATE new vs MODIFY existing capabilities. This finding articulates the pattern the substrate is enacting.

## The orthogonal axes

Each activity-template execution produces a trace with several extractable dimensions:

| Dimension | What it tells us about | Aggregator already in substrate |
|---|---|---|
| `(resolver_id, output_shape)` success rate | resolver-level reliability across templates | `resolver_pattern_report` |
| `(template_id, first_failed_task_id)` cluster size | template-level systematic failure | `trace_failure_pattern_report` |
| `failure_mode.type` distribution | failure-class prevalence | `phantom_trace_scan`, `precondition_rejection_scan` |
| `MemoryCurrent` delta on cgroup of unit | per-vessel resource pathology | `service_oom_cascade_scan` |
| `dispatch_target_template_id` presence | observability schema completeness | `dispatch_target_drift_scan` |
| `output_impulse_shape` orphan check | unconsumed produced shapes | (not yet authored) |

These aggregators are themselves activity templates. The substrate uses its own activity infrastructure to observe its activity infrastructure — recursion at the trace-aggregation layer mirrors recursion at the artifact-authoring layer (concept_U1GbuEbgtcM7).

## The signal triad: CREATE vs MODIFY vs CATEGORIZE

For any aggregate observation, the substrate decides among three actions:

1. **MODIFY existing** — when the aggregator surfaces a regression on a SPECIFIC entity (one resolver, one template, one vessel) whose past success was high but recent success has dropped. The change targets the entity directly. Evidence: per-entity trend, attributable cause in recent traces.

2. **CREATE new detector** — when the aggregator surfaces a failure pattern that is REPEATING across multiple traces and isn't covered by any existing detector. The substrate authors a sibling-shaped detector (mirroring `service_oom_cascade_scan` pattern) for the new class. Evidence: ≥3 traces with the same signature, no current detector cites this concept_id.

3. **CREATE new consumer** — when the aggregator surfaces output shapes that are PRODUCED but never CONSUMED by another template. Either the producer should be retired or a new consumer should be authored. Evidence: shape appears in many output_impulse_shapes but in zero inputShapes across the catalogue.

The decision is asymmetric: it is easier (smaller-blast-radius) to CREATE a new template than to MODIFY an existing one. The substrate prefers create when the cost is similar.

## The generalizable pattern

```
                ┌────────────────────────────────────────────────┐
                │  Activity-template execution produces a trace  │
                │  with multiple orthogonal dimensions:          │
                │   (resolver_id, output_shape, failure_mode,    │
                │    duration_class, vessel_id, …)               │
                └────────────────┬───────────────────────────────┘
                                 │ N traces accumulate
                                 ▼
                ┌────────────────────────────────────────────────┐
                │  Cross-trace aggregator activities             │
                │  group by one orthogonal dimension at a time   │
                │  and surface deviation from expected baseline  │
                └────────────────┬───────────────────────────────┘
                                 │ deviation signals
                                 ▼
                ┌────────────────────────────────────────────────┐
                │  observe-orthogonal-patterns                   │
                │  composes multiple aggregator outputs +        │
                │  LLM synthesizes CREATE / MODIFY / CATEGORIZE  │
                │  decisions with evidence-trace IDs             │
                └────────────────┬───────────────────────────────┘
                                 │ structured decisions
                                 ▼
                ┌────────────────────────────────────────────────┐
                │  Drafter (CREATE)  OR  modify-activity (MODIFY)│
                │  authors the change. Substrate-as-git-author   │
                │  composition publishes + self-merges with      │
                │  internal-idiom evidence.                      │
                └────────────────────────────────────────────────┘
```

The pattern generalizes because:
- The orthogonal dimensions are properties of EVERY trace, not specific to a domain
- The aggregators are activities (re-runnable, schedulable, composable)
- The CREATE vs MODIFY decision is the SAME decision shape regardless of what's being created or modified
- The publication chain (substrate-as-git-author) is domain-agnostic

## Where this sits in the IAL lift trajectory

Pre-lift (S1 → S2): operator authors aggregators + drafters. Substrate executes them.

S2 (current state for this substrate): substrate authors gap-closing templates as side effect of operational goals. Aggregators exist. The MODIFY pathway is being implemented (this finding's companion: observe-orthogonal-patterns).

S3 (target, not yet operational): substrate dispatches its own observe-orthogonal-patterns on a boredom cadence, drafts the proposed change, publishes via composition, self-merges with internal-idiom evidence. Operator's role narrows to setting boredom cadence + audit-by-exception.

## How this connects to the queued bugs and findings

- #136 (LLM reuse calibration): orthogonal observation of "same template re-authored under paraphrased goals" is itself a CREATE-elimination signal — calibration of the reuse rubric IS the modify-existing-decision dial.
- #137 (observe-orthogonal-patterns activity): the substrate's first cross-trace decision-emitting activity.
- #134 (NONE-bias): rubric tuning is an orthogonal-learning signal applied to the reuse decision itself.
- #125 (engine failure_mode propagation): without this, the failure_mode dimension is null for many traces — orthogonal aggregation by failure_mode is incomplete.

The generalizable observation: every queued bug is a localized failure of one of the orthogonal dimensions. Closing the loop means each dimension has its aggregator, each aggregator's deviation triggers a decision, each decision lands in git as a substrate-authored change.

Substrate-Authored-By: substrate-live + operator (this summary)
Version-Format: `{ISO timestamp full Z (dashes)}-{variant-id}-{vessel}`
