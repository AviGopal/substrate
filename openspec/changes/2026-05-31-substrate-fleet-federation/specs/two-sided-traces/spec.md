# Spec — Two-Sided Traces

Normative requirements for the H1 deployment surface within
`2026-05-31-substrate-fleet-federation` Phase 3. The H1
cryptographic surface is owned by
`2026-04-26-security-hardening-findings/specs/security-hardening/`.
This delta adds the **strict-mode-for-foreign-traces** requirement
that fleet federation depends on.

## R0 — Authority

- **R0.1** The counterparty-signature construction (Ed25519 over
  canonical-form digest of `impulse_resolutions[]` rows; per-pair
  pairing job; `vessel_trust_score`) SHALL be as specified in
  `2026-04-26-security-hardening-findings/design.md §H1` and
  `tasks.md §1`. This spec MUST NOT re-specify the construction.
- **R0.2** This spec extends H1 by partitioning trace handling on
  provenance and asserting different gating rules for the two
  partitions.

## R1 — Provenance partition

- **R1.1** A trace SHALL be classified at ingest as either
  **local-provenance** or **foreign-provenance**:
  - Local-provenance: every vessel referenced in
    `impulse_resolutions[]` is locally registered with the
    substrate's discovery-vessel (`reachability.hops == 0`).
  - Foreign-provenance: at least one referenced vessel was
    routed via a peer per
    `2026-05-23-vessel-federation/specs/vessel-federation/spec.md
    §R5`.
- **R1.2** The classification SHALL be persisted on the trace
  record. Downstream Thompson update and pairing-job logic SHALL
  read this classification.

## R2 — Local-provenance gating (graceful)

- **R2.1** Local-provenance traces MAY follow H1's existing
  `enforcement: "log_only" | "reject"` flag as specified in the
  H1 spec. Operators MAY roll H1 out gradually on local traces;
  this spec does not require strict mode for local-provenance.

## R3 — Foreign-provenance gating (strict, non-optional)

- **R3.1** Foreign-provenance traces with missing H1 signatures on
  either endpoint SHALL be ingested for observability but SHALL
  NOT contribute to Thompson α/β updates. The
  `h1_signed: false` flag on the trace (and propagated to derived
  impulses per `federated-discovery/spec.md §R1.2`) is the
  load-bearing signal.
- **R3.2** Foreign-provenance traces with H1 signatures present
  but mismatched (invoker view and invoked view disagree on
  success / latency / cost beyond the H1 tolerance) SHALL:
  - Persist for observability.
  - SHALL NOT contribute to Thompson α/β updates.
  - SHALL penalize **both** endpoints' `vessel_trust_score` per
    H1's existing penalty mechanism. The same penalty applies to
    a foreign-side and a local-side vessel; foreign vessels are
    not exempted from the trust mechanism.
- **R3.3** R3.1 and R3.2 SHALL be enforced regardless of H1's
  per-substrate `enforcement` flag. The flag governs local-
  provenance handling only. For foreign-provenance traces, strict
  mode is non-optional.

## R4 — Pairing job extension

- **R4.1** The H1 pairing job (`security-hardening-findings/
  tasks.md §1a.4`) SHALL handle foreign-provenance traces. The
  invoker view and invoked view of a cross-substrate call may
  arrive at different substrates' activity-apis; the pairing job
  must run at the substrate where the invoker view lands and
  request the matching invoked view from the peer substrate via
  a federated-discovery resolve of the `executionTrace` shape on
  the peer.
- **R4.2** If the peer substrate cannot produce the matching
  invoked view within a configurable window (default 5 minutes),
  the trace SHALL be marked `pairing_unresolved` and held for a
  longer window before final classification. After a hard window
  (default 1 hour) without resolution, the trace SHALL be
  classified as missing-signature per R3.1.
- **R4.3** The pairing job SHALL emit a `pairingReport` impulse
  summarizing per-peer pairing latency, missing-view rate, and
  mismatch rate. This impulse feeds the §27.S.6 push-away ledger
  when produced by an audit substrate (per
  `2026-05-31-substrate-fleet-federation` proposal §"Phase 5").

## R5 — Verification

- **R5.1** A two-substrate fleet, peered, with H1 deployed on
  both. Substrate A invokes vessel V on B; both endpoints sign;
  the trace lands at A. A's pairing job requests B's invoked
  view; B serves it; pairing succeeds; A's Thompson updates from
  the trace under the peer-trust scaling factor per
  `federated-discovery/spec.md §R3.3`.
- **R5.2** Same scenario, B does not sign its invoked view. The
  trace persists at A with `h1_signed: false`; A's Thompson does
  not update from it; B's `vessel_trust_score` is penalized.
- **R5.3** Same scenario, B signs but with a payload that
  disagrees with A's view beyond tolerance. Both A's invoked-
  vessel and B's invoking-vessel (i.e. the vessel V itself) take
  trust-score penalties; the trace persists for observability;
  no Thompson update.
- **R5.4** R3.3 negative test: a substrate with H1 local-
  enforcement set to `log_only` still rejects unsigned foreign-
  provenance traces from posterior updates. The flag does not
  weaken foreign-trace handling.
