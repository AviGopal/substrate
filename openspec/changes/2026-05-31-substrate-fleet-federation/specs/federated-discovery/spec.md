# Spec — Federated Discovery

Normative requirements for the **information-flow** half of Phase 3
in `2026-05-31-substrate-fleet-federation`. The routing-layer half
(peer-aware `/resolve` fan-out, depth limit, reachability
annotations) is owned by `2026-05-23-vessel-federation/specs/vessel-
federation/spec.md §R4–R5`. This delta builds the impulse-provenance
and concept-graph admission rules on top.

## R0 — Sequencing

- **R0.1** This spec SHALL NOT activate until
  `vessel-pubkey-identity/spec.md §R1` is met for the substrate.
- **R0.2** This spec SHALL NOT activate until
  `two-sided-traces/spec.md` is in enforce mode for foreign-
  provenance traces. §R3 below depends on H1 strict-mode for
  foreign traces.
- **R0.3** The routing-layer half (vessel-federation §R4–R5) MAY be
  active without this spec being active. In that intermediate
  state, foreign vessel records are reachable but foreign impulses
  arriving from those vessels are observability-only — they do
  not contribute to learning signal.

## R1 — Foreign-provenance annotation on impulses

- **R1.1** When the substrate's discovery-vessel returns a vessel
  record with `reachability.hops > 0` (i.e. routed via a peer per
  vessel-federation §R5), every impulse subsequently resolved by
  dispatching to that vessel SHALL carry a `foreign_provenance`
  annotation on the impulse record returned to upstream consumers.
- **R1.2** The `foreign_provenance` annotation SHALL have the
  following structure:
  ```
  foreign_provenance: {
    peer_vessel_id: string       // pubkey-derived id of the peer
                                 // discovery-vessel that surfaced
                                 // the producing vessel
    peer_trust_score: number     // last-observed peer trust score;
                                 // 0 if no traces yet exchanged
    hops: number                 // copied from reachability.hops
    h1_signed: boolean           // true if the trace from which
                                 // this impulse was produced
                                 // carries valid H1 signatures
                                 // (see two-sided-traces spec)
  }
  ```
- **R1.3** Impulses produced by vessels with `reachability.hops ==
  0` (i.e. locally registered) SHALL NOT carry `foreign_provenance`.

## R2 — Concept-db ingestion of foreign-provenance impulses

- **R2.1** `concept-db` SHALL store a `provenance` field on every
  observed-usage record. The field SHALL be either
  `{local: true}` or `{local: false, ...}` with the body matching
  R1.2's `foreign_provenance` schema.
- **R2.2** Concept-db relevance scores derived from
  foreign-provenance usage records SHALL be applied under a
  **separate, more conservative prior** than scores derived from
  local-provenance usage. The construction is implementation-
  defined; the testable property is R2.3.
- **R2.3** Given two posteriors fed identical-count evidence —
  one from local-provenance usage records and one from foreign-
  provenance records — the foreign-fed posterior SHALL NOT
  converge to the same point as the local-fed posterior until the
  source peer's `peer_trust_score` reaches parity with the
  locally-observed vessel trust baseline.
- **R2.4** Foreign-provenance usage records with `h1_signed:
  false` SHALL be admitted to concept-db for observability but
  SHALL NOT contribute to relevance scores at all. They remain
  queryable; they do not move learning state.

## R3 — Activity-API Thompson update gating

- **R3.1** Activity-API Thompson update paths (per CLAUDE.md, today
  at `repos/metabob-activity-api/src/routes/execution-traces.ts`
  α/β update points) SHALL read `foreign_provenance` before
  applying any α/β delta sourced from a trace.
- **R3.2** When `foreign_provenance.h1_signed == false`, Thompson
  α/β SHALL NOT update from the trace. The trace persists for
  observability under the existing schema.
- **R3.3** When `foreign_provenance.h1_signed == true`, Thompson
  α/β SHALL update under a per-peer scaling factor proportional to
  `foreign_provenance.peer_trust_score`. Traces from a peer with
  zero established trust contribute a discounted weight; traces
  from a peer at parity with local baseline contribute full
  weight. Construction is implementation-defined; the testable
  property is R3.4.
- **R3.4** A peer that has emitted N traces with all H1 signatures
  matching and zero pairing-job discrepancies (per two-sided-traces
  §R4) SHALL eventually reach peer-trust parity with local
  vessels. The convergence rate is implementation-defined; the
  spec requires that parity is reachable, not that it is reached
  on any specific timescale.

## R4 — Foreign vessel non-discoverability above the boundary

- **R4.1** No vessel above the discovery-vessel layer SHALL receive
  a `substrate_id` field, a `substrate_name` field, or any
  identifier that names the substrate a foreign vessel belongs to.
- **R4.2** Upstream consumers wishing to identify the source
  substrate SHALL derive it from
  `foreign_provenance.peer_vessel_id` (which is the discovery-
  vessel pubkey of the source substrate per
  `vessel-pubkey-identity/spec.md §R2.1`) via an operator-
  maintained client-side mapping. The mapping is NOT part of any
  vessel's runtime contract.

## R5 — Verification

- **R5.1** A two-substrate fleet (substrate A and substrate B,
  peered per vessel-federation): a vessel `V` registered in B that
  produces impulses of shape `S`. A resolve from A for shape `S`
  returns an impulse with `foreign_provenance.peer_vessel_id ==
  B.discovery_vessel_pubkey`.
- **R5.2** Under R3.2: a foreign trace arriving at A with
  `h1_signed: false` SHALL NOT move A's Thompson α/β; the trace
  is queryable but inert.
- **R5.3** Under R2.3: relevance scores in A's concept-db for a
  shape observed only via foreign-provenance impulses from B
  remain bounded away from the score the same shape would have
  if observed locally with equivalent volume, until B's trust
  score crosses parity.
- **R5.4** R4.1 negative test: no shape resolvable from any
  vessel above discovery-vessel exposes `substrate_id` or
  equivalent. Failing the test is a spec violation.
