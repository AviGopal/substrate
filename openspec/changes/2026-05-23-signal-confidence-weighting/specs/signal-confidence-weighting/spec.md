# Capability: signal-confidence-weighting

## Definition

Every execution trace in `activity_execution_traces` carries a
`signal_confidence_weight: number` field, default 1.0, range [0, 1],
representing the substrate's confidence in the signal the trace
provides to the learning loop. Posterior update operations multiply
each α and β increment by this field; chain-credit propagation
multiplies ancestor updates by the leaf's weight × γ^depth. The
stratified failure-mode multiplier (Phase 18) composes multiplicatively
with the confidence weight, failure-mode multiplier applied first.

Today every trace has weight 1.0 (implicit trust under shared trust
root). The field exists so that downstream work — H6 trace
attestations, robust Thompson aggregation against insider poisoning,
peer-trust priors, verifier-multiplicity peer-disagreement detection,
federation admission throttling — has a common surface to write into.
Those downstream policies compute non-1.0 weights from their own
sources; this capability defines only the field, the multiplication,
and the chain-credit propagation invariant.

## Field semantics

`signal_confidence_weight`:
- Type: `number`.
- Range: `[0, 1]`. Out-of-range values cause the write to be rejected
  with `verifier_negative` self-trace.
- Default: `1.0`. Omitted in a write → defaulted at the API surface.
- Semantics: 1.0 means "trust this signal as much as an in-substrate
  signal under the shared trust root." 0 means "exclude this signal
  from aggregation entirely." Intermediate values denote partial
  trust; the aggregation rule treats them as scaling factors on the
  per-trace α/β update magnitude.
- Persistence: stored on the trace row; immutable after write. A
  later re-evaluation of confidence (e.g., a vessel's trust score
  drops after-the-fact) does NOT retroactively modify prior traces.
  This is a deliberate constraint: posterior updates depend on the
  trace at the time it was written; revisionism breaks reproducibility.

## Aggregation invariants

For a trace T with outcome o, failure-mode multiplier m_f (the
stratified failure-mode table from Phase 18), and confidence weight
w_c = `T.signal_confidence_weight`:

- α update: `α += m_f^success × w_c × baseline_unit` (where
  baseline_unit = 1 for success).
- β update: `β += m_f^failure × w_c × baseline_unit` (where
  m_f^failure ∈ {1.0 for verifier_negative, 0.5 for
  budget_exhausted, 0 for cascading, neutral for user_abort}).
- Composition: failure-mode multiplier applies first, then
  confidence weight. Order matters when w_c = 0: even a positive
  failure-mode signal yields zero update.

For chain credit (Phase 18.4) with leaf trace L, ancestor at depth
d, decay γ ∈ (0, 1):

- Ancestor α update: `α_ancestor += γ^d × m_f^success × w_c × baseline_unit`.
- Ancestor β update: `α_ancestor += γ^d × m_f^failure × w_c × baseline_unit`.

The leaf's confidence weight propagates through the chain unchanged
in form; γ-discount and confidence weight multiply. A low-confidence
leaf does not poison ancestors through the chain. A zero-confidence
leaf produces zero credit at every ancestor, regardless of γ or m_f.

## Discovery advertisement

`activity_execution_trace_write` advertised in `discovery.shapes`
includes the new field in its contract metadata:

```typescript
{
  shape: "activity_execution_trace_write",
  fields: {
    // ... existing fields ...
    signal_confidence_weight: {
      type: "number",
      range: [0, 1],
      default: 1.0,
      optional: true,
      description: "Substrate confidence in this trace as a learning signal."
    }
  }
}
```

Downstream vessels reading this contract know they may omit the
field (defaulting to 1.0) or supply a non-1.0 value if they have a
policy for computing one.

## Observability

- Workbench `ExecutionHistoryPanel` renders the field per row as a
  badge. Default 1.0 styled neutral; non-1.0 styled with a confidence
  bar showing the weight visually.
- Workbench `ExecutionFlameGraph` tooltip includes the field per
  invocation node.
- Phase 19 reuse-validation harness emits a new column in its weekly
  report: mean and p5/p95 of `signal_confidence_weight` across the
  benchmark window. Baseline: all 1.0 until downstream policies
  compute non-1.0 values.

## Acceptance

The capability is shipped when:

1. The schema migration is applied on canary; every row of
   `activity_execution_traces` has `signal_confidence_weight = 1.0`
   (defaulted).
2. `applyOutcomeToPosteriors` and `propagateCreditAlongChain` in
   activity-api multiply by the field. Behaviour with default 1.0 is
   identical to pre-deployment (zero drift on the Phase 19 harness).
3. The chain-credit integration test 18.4.7 ported to non-unit
   weights passes:
   - Leaf weight 0.5 produces ancestor α = 0.5 × γ^depth × baseline.
   - Multiple leaves with different weights compose linearly.
   - Leaf weight 0 produces zero ancestor credit.
4. `activity_execution_trace_write` impulse and the equivalent REST
   endpoint accept the field; out-of-range values are rejected with
   `verifier_negative` self-trace.
5. The field is advertised in discovery-vessel's resolver contract
   for the write shape.
6. Workbench renders the field; Playwright visual regression test
   confirms layout unchanged from pre-deployment with all-1.0 data.

## Status

This change is **pre-federation, pre-lift**. The field's default
keeps behaviour identical today; the capability is provisioning a
hook for downstream work. It is included in the IAL §27.3.g
explicit-vessel coverage checklist as item §27.3.g.6 — the field is
present and defaulted with zero behavioural drift on the benchmark.
