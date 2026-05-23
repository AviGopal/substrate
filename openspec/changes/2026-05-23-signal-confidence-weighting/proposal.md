# Proposal: Signal Confidence Weighting on Learning-Loop Writes

## Why

The substrate's learning loop is a noisy-signal aggregation system. Thompson
posteriors weight observations, stratified failure modes discriminate
outcome types, validators-as-activities self-correct under their own α/β,
and "state is a projection over traces" makes the trace store the single
source of truth. Across this machinery, **every aggregated signal is
implicitly weighted 1.0**. The implicit weight is the source of three
distinct gaps:

1. **Insider robustness gap** (immediate). The Thompson-Sampling
   reward-poisoning literature (Wang et al., arXiv:2410.19705; Liu &
   Shroff, PMLR 2019) establishes that a single insider supplying
   fabricated trace outcomes can mislead Thompson and UCB into selecting
   a target arm in nearly all rounds at sublinear attack cost. The
   substrate's current α/β update path treats every trace as equally
   trustworthy regardless of source vessel reputation, attestation
   strength, or peer corroboration. Inside today's shared trust root,
   the worry is the compromised-vessel case; once a vessel's API key
   leaks or its container is breached, posteriors become forgeable.
2. **Federation gap** (deferred to H6). Cross-substrate signals from
   foreign vessels need a non-zero weight to participate in the loop,
   but the weight must reflect attestation strength rather than mere
   identity. The H6 framework
   (`openspec/changes/2026-05-23-zk-trace-attestations/`) supplies the
   cryptographic mechanism by which a foreign signal earns its weight;
   it needs a surface on the trace schema to write that weight into.
3. **Verifier-multiplicity gap** (deferred to H6 Phase 2+). Per-source
   peer-disagreement detection across verifier-vessel implementations
   produces a per-attestation confidence signal that has no place to
   land today.

A single field on the trace schema — `signal_confidence_weight: number`,
default 1.0 — gives every subsequent confidence-related work
(robust Thompson aggregation, H6 trace attestations, verifier
multiplicity, peer trust priors, federation admission throttling) a
common hook. The field carries the implicit-trust default today
(weight = 1.0 for in-substrate writes under shared trust root) and
the attestation-derived weight tomorrow (weight ∈ [0, 1] for foreign
writes under H6). The aggregation rule — α/β update magnitude
multiplied by `signal_confidence_weight` — is mathematically the
Wang et al. pseudo-posterior expressed in the system's native
vocabulary.

This change adds the field and the multiplication. It does NOT add
insider-robustness logic, H6 verification, peer-trust priors, or
verifier multiplicity. Those are downstream; this is the hook they
attach to.

## What Changes

1. **Schema migration**: add `signal_confidence_weight: number`
   (default 1.0, range [0, 1]) to `activity_execution_traces` in
   `repos/metabob-activity-api/`. A new migration writes the field
   onto existing rows at default 1.0; the schema is additive and
   forward-compatible per the §27.3.a.2 invariant.
2. **Update path**: `applyOutcomeToPosteriors` and
   `propagateCreditAlongChain` in
   `repos/metabob-activity-api/src/lib/posterior-update.ts` multiply
   each α and β increment by `signal_confidence_weight` before
   writing. Today every trace has weight 1.0, so behaviour is
   unchanged; the multiplication is a no-op identity transformation
   on the current substrate.
3. **Trace write contract**: `activity_execution_trace_write` impulse
   shape gains an optional `signal_confidence_weight` field in its
   body. Omitted → 1.0. Out-of-range or non-numeric → 400 with
   `verifier_negative` self-trace. Activity-api advertises the field
   in its discovery resolver-contract metadata so downstream callers
   know how to populate it.
4. **Observability**: workbench `ExecutionHistoryPanel` and
   `ExecutionFlameGraph` expose `signal_confidence_weight` per trace.
   The Phase 19 reuse-validation harness (`activity-reuse-validation-
   harness`) emits a new column in its weekly report for mean and
   p5/p95 of the field across the benchmark window. Today all rows
   are 1.0; the column documents the baseline so future drift is
   detectable.
5. **Hook for the chain-credit path**: the γ-discount ancestor
   credit at `propagate-credit.ts` already walks
   `composition_chain`. Each ancestor's α/β update inherits the
   leaf trace's `signal_confidence_weight` multiplied by γ^depth.
   A low-confidence leaf does not poison ancestors through the chain.
6. **CLAUDE.md update**: under "Execution Trace Model", document
   `signal_confidence_weight` as the confidence-weighting hook used
   by H6, robust Thompson aggregation, and verifier-multiplicity work.

## Why this is pre-federation, not deferred

Three reasons this lands ahead of H6 activation rather than at the same
time:

- **The schema migration is the hardest part.** Adding a field to
  `activity_execution_traces` is a SurrealDB schema change. Per IAL
  §27.3.a.2, schema breaking changes are not permitted post-lift; the
  field has to land while schema migrations are still operator-driven.
- **The multiplication is provably a no-op today.** All writes happen
  under shared trust root with implicit weight 1.0. The change is
  measurable as zero behavioural drift on the existing benchmark
  (Phase 19 reuse harness): MRR, improvise_share, Thompson CI width
  all unchanged after deployment. This is the safest possible time
  to introduce the field.
- **Downstream work needs the hook.** Robust Thompson aggregation
  against insider poisoning (independent of H6) lands as a future
  weight-assignment policy; it cannot land without this field. H6
  Phase 2 verifier integration also cannot land without it.

## Success criteria

1. **Schema migration applied**: `signal_confidence_weight` field
   present on every row of `activity_execution_traces` in canary,
   default 1.0.
2. **Zero behavioural drift**: Phase 19 reuse-validation harness
   weekly run after deployment shows search-MRR, recommend-MRR,
   improvise_share, reuse_rate within ±2% of the prior week's
   baseline. Memory note baselines (post-F-V58 MRR=0.2361,
   improvise_share=1.5%) are preserved.
3. **Chain credit invariant**: integration test 18.4.7 ported to
   exercise non-1.0 weights: a chain with leaf weight = 0.5
   produces ancestor α increments equal to 0.5 × γ^depth × baseline.
4. **Workbench surface**: ExecutionHistoryPanel renders the field;
   ExecutionFlameGraph tooltips include it. Visual regression test
   confirms current 1.0 default doesn't break the existing layout.
5. **Discovery advertisement**: `activity_execution_trace_write`
   resolver-contract metadata in discovery-vessel includes the new
   optional field with its constraint range.

## Capabilities

### New Capabilities

- `signal-confidence-weighting` (this change) — `signal_confidence_weight`
  field on AET schema with default 1.0; multiplication into α/β
  update path; chain-credit propagation respects the weight;
  workbench observability and harness telemetry. The hook that
  downstream confidence-related work (H6, robust Thompson
  aggregation, verifier multiplicity) attaches to.
  Spec: `specs/signal-confidence-weighting/spec.md`.

### Modified Capabilities

- IAL Phase 27.3 pre-lift checklist gains a §27.3.g.6 item: the
  `signal_confidence_weight` field is present and defaulted to 1.0
  with zero behavioural drift on the benchmark. This is a small
  addition; it slots under §27.3.g (explicit-vessel coverage) because
  the field's purpose is to give explicit-vessel cross-boundary trace
  writes a confidence hook even in-substrate.
- `2026-05-23-zk-trace-attestations` proposal updated to note this
  change as the precursor that supplies the schema hook H6 needs.

## Out of scope

- **Weight assignment policy**. This change establishes the field
  with default 1.0. Policies that compute non-1.0 weights —
  attestation-strength-derived (H6), peer-corroboration-derived
  (robust aggregation), trust-ancestry-derived (informative priors) —
  are downstream.
- **Verifier multiplicity**. Peer-disagreement detection across
  verifier-vessel implementations is H6 Phase 2+.
- **Hash-chain on AET rows**. Cryptographic trace-integrity chaining
  is a separate change
  (`openspec/changes/2026-05-23-trace-hash-chain/`, not yet drafted)
  that targets audit-log tampering rather than confidence weighting.
  The two changes are orthogonal — `signal_confidence_weight`
  protects against credit poisoning at the aggregation layer;
  hash-chained AET protects against trace forgery at the storage
  layer. Both pre-federation, both pre-lift.
