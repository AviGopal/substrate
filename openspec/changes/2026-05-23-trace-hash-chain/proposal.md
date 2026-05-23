# Proposal: Trace Hash Chain

**Date:** 2026-05-23
**Status:** Draft
**Relates to:** `2026-05-23-signal-confidence-weighting/` (downstream
consumer; reward-poisoning defense at the aggregation layer assumes
trace immutability at the storage layer); `2026-04-26-security-
hardening-findings/` H1 (two-sided signed traces; the hash chain is
the underlying immutability primitive that H1's corroboration layers
on top of); `2026-05-17-state-space-signature-thompson-keying/`
(reuses RFC 8785 canonical-JSON + SHA-256 construction);
`2026-05-23-vessel-federation/` (chain head per `vessel_id` becomes
the verification anchor once `vessel_id` is pubkey-derived under H2).

## Why

The substrate's learning loop is "state is a projection over
traces": every Thompson posterior, every relevance metric, every
composition-chain credit derives from rows in
`activity_execution_traces`. Trace integrity is therefore a
foundational property of the loop — not a downstream concern.

Today nothing prevents a trace row from being rewritten in place.
The schema permits UPDATE; SurrealDB permissions filter by `org_id`
but do not enforce historical immutability. A compromised activity-api
process — or a buggy migration, or an operator with root credentials
running a one-off REPL — can silently modify a past trace's success
flag, failure-mode bucket, or impulse-resolution chain. Downstream
posteriors shift to match. The Phase 19 reuse harness would not
detect the shift because the harness compares behaviour against
the trace store, not the trace store against itself.

`signal_confidence_weight` is the *aggregation-layer* defense against
this class of attack: it caps how much a low-trust signal can move
posteriors. But the weighting assumes the trace it weights is the
trace that was written. Without an immutability primitive, an
adversary modifying a past trace silently shifts the substrate's
posteriors even when every new write is weight-clamped. The two
changes are complementary — confidence weighting protects the
aggregation step; the hash chain protects the storage step.

This change adds a per-vessel append-only cryptographic chain
linking every trace a vessel emits to its prior trace. Tampering
with any past trace breaks the chain at that point and is detected
on the next verification walk. The chain head is published in
discovery-vessel registration and heartbeats, so any peer can
fetch the head and verify the vessel's trace history end-to-end.

## What Changes

1. **Schema migration**: add two fields to `activity_execution_traces`
   in `repos/metabob-activity-api/`:
   - `prev_chain_hash: string` — the `trace_hash` of the previous
     trace emitted by the same vessel; literal `"ROOT"` for the
     vessel's first trace.
   - `trace_hash: string` — `SHA-256(canonical_json({...trace_body,
     prev_chain_hash}))`, encoded lowercase hex. Computed at write
     time; stored verbatim.
2. **Per-vessel chain ownership**: the chain is keyed by `vessel_id`
   (the emitting vessel). Each vessel maintains its own chain;
   chains do not interleave across vessels. The chain head for
   `vessel_id = V` is the `trace_hash` of the most recently
   admitted trace where `emitting_vessel_id = V`.
3. **Ingestion validation**: on `POST /v2/activities/execution-traces`,
   activity-api looks up the current `chain_head` for the emitting
   vessel and rejects the write with `failure_mode.type =
   "verifier_negative"` and a new sub-type `chain_break` when:
   - `prev_chain_hash` does not equal the stored head, AND
   - `prev_chain_hash != "ROOT"` (the vessel's first trace) is not
     a bootstrap exemption with no prior head.
   Two distinct traces submitted with the same `prev_chain_hash`
   are a `chain_fork`: the first admitted, the second rejected
   with `verifier_negative` and sub-type `chain_fork`.
4. **Discovery integration**: extend the existing register/heartbeat
   payload schema in `repos/discovery-vessel/src/types.ts` with an
   optional `chain_head: string` field on `RegisterRequest` and
   `HeartbeatRequest`. The registry stores it alongside the vessel
   record. Peers querying `/resolve` receive the chain head in the
   vessel record so they can verify any past trace from that vessel
   without contacting activity-api first. No new shape is added;
   the field is additive on existing shapes.
5. **Verification utility**: a new script `scripts/verify-trace-
   chain.ts` walks the chain from `ROOT` forward (or from a given
   trace backward) for a specified `vessel_id`, recomputing each
   `trace_hash` from the stored row and comparing to the stored
   value. Mismatch at any link is a tamper report. The script is
   off-line and operator-driven; ingestion-time validation is the
   primary gate.
6. **Bootstrap**: a vessel emitting its first trace under this
   capability uses `prev_chain_hash = "ROOT"`. Existing traces
   written before this capability lands carry `prev_chain_hash =
   null` and `trace_hash = null`; they are flagged
   `legacy_unchained: true` in a view filter. New traces from
   the same vessel chain from `"ROOT"` at first post-migration
   write; legacy rows are never retroactively chained.
7. **CLAUDE.md update**: under "Execution Trace Model", document
   `prev_chain_hash` and `trace_hash` as the immutability primitive
   used by signal-confidence-weighting and H1.

## Self-application

The chain mechanism is substrate-resident. Every vessel emitting
traces under this capability — minibob, activity-api itself
(self-traces from posterior updates), identity-vessel
(authentication traces), development-vessel (lift-cycle traces),
concept-db, conversation-vessel — maintains its own chain. The
chain is verified by every consumer: discovery-vessel exposes
the head; activity-api validates on ingest; the verification
script walks the chain for any operator audit. There is no
privileged actor outside the substrate.

## Success criteria

1. **Schema migration applied**: `prev_chain_hash` and `trace_hash`
   fields present on every row of `activity_execution_traces` in
   canary. Legacy rows null; new rows populated and chained.
2. **Chain validates end-to-end for one vessel**: the verification
   script walks a real vessel's chain from `ROOT` forward,
   recomputes every `trace_hash`, and reports zero mismatches
   over the canary trace volume (≈10⁴ traces).
3. **Tamper detection**: an integration test modifies one trace's
   `success` field in place (bypassing the API) and confirms the
   verification script reports a chain break at the exact position.
4. **Chain-break and chain-fork rejection**: two integration tests
   verify that (a) a trace with a stale `prev_chain_hash` returns
   400 with `failure_mode.type = "verifier_negative"` and
   `failure_mode.sub_type = "chain_break"`; (b) two concurrent
   traces claiming the same `prev_chain_hash` see the second
   rejected as `chain_fork`.
5. **Discovery integration**: registering a vessel with a
   `chain_head` field returns 200; the field appears in
   `/resolve` responses for that vessel. Heartbeats update it.
6. **Zero behavioural drift on the harness**: Phase 19 reuse
   harness after this change runs identically to the prior week
   on MRR, recommend-MRR, improvise_share, reuse_rate within
   ±2%. The chain adds writes only, no reads on the hot path.

## Capabilities

### New Capabilities

- `trace-hash-chain` (this change) — per-vessel append-only
  cryptographic chain over emitted traces; chain head published
  in discovery; ingestion-time validation of `prev_chain_hash`;
  off-line verification utility; rejection sub-types `chain_break`
  and `chain_fork` under the existing `verifier_negative`
  failure-mode taxonomy. Spec: `specs/trace-hash-chain/spec.md`.

### Modified Capabilities

- `signal-confidence-weighting` proposal acknowledges this change
  as the storage-layer immutability primitive its aggregation-layer
  defense composes with. The combined property: posteriors cannot
  be poisoned by either fabricated high-confidence writes (clamped
  by weight) or post-hoc rewrites of past traces (broken by chain
  verification).
- H1 (two-sided traces, in
  `2026-04-26-security-hardening-findings/design.md`) builds on the
  chain: the Ed25519 per-call signatures it introduces sign the
  per-trace digest *plus the chain link*, so an attacker forging
  both endpoints of a single call still cannot rewrite past
  history without breaking the chain at every subsequent vessel-
  internal trace.

## Dependencies

- **State-space-signature** (`2026-05-17-state-space-signature-
  thompson-keying/`): canonical-JSON construction (RFC 8785 / JCS)
  and SHA-256 invocation pattern are reused verbatim. This change
  imports the canonical-JSON encoder; the two share fixture vectors
  in test.
- **Vessel-federation** (`2026-05-23-vessel-federation/`): the
  chain is keyed by `vessel_id`. While `vessel_id` remains a
  free-form string (today), chain ownership is operator-trusted.
  Once H2 lands and `vessel_id = base32(multihash(SHA-256, pubkey))`,
  chain ownership becomes cryptographically bound: only the
  pubkey-holding vessel can extend the chain because every trace's
  ancestor signature (under H1) must verify against that pubkey.
  This change is forward-compatible: nothing in the chain
  construction assumes a particular `vessel_id` format.

## Out of scope

- **Cross-vessel chain interleaving**. `composition_chain` (the
  ancestor execution-id list on a trace) and the per-vessel hash
  chain are independent. A composed execution spanning vessels A
  and B writes one trace to A's chain and a separate trace to B's
  chain; neither chains into the other. The composition lineage
  remains in `composition_chain`; this change does not alter it.
- **Operator-curated trace deletion**. Deleting a past trace
  breaks the chain at that point. Operators with admin scope can
  still hard-delete via the existing `activityExecutionTrace_delete`
  write resolver; the resulting chain break is logged and reported
  by the verification script. A "redact-and-rechain" flow that
  preserves chain continuity through deletions is deferred.
- **Chain history compression / pruning**. Long chains grow O(N)
  with trace volume. Periodic checkpointing (sign a chain head at
  fixed intervals, allow older links to be GC'd after the
  checkpoint is observed by peers) is a future optimisation. The
  v1 chain stores every link.
- **Cross-substrate chain merging**. Federation (this change's
  forward consumer) lets a peer fetch another substrate's vessel
  chain head and verify their trace stream; it does NOT merge
  the chains into a single chain. Each vessel's chain remains
  independent.
- **H1 corroboration signatures**. This change is the immutability
  primitive; H1 is the per-call cross-vessel agreement primitive.
  Both pre-federation. They land in either order; the chain does
  not require H1 to be useful.
