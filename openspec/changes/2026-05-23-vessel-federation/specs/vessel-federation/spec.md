# Spec — Vessel Federation

Normative requirements. Each is testable. All terminology aligned with
`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`; cryptographic
primitives align with
`openspec/changes/2026-04-26-security-hardening-findings/design.md` §H2
and §H4; canonical encoding aligns with
`openspec/changes/2026-05-17-state-space-signature-thompson-keying/specs/state-space-signature/spec.md`.

## R0 — Sequencing

- **R0.1** This spec is a post-lift sibling of
  `2026-04-26-impulse-activity-loop`. It MUST NOT be authored as a new
  IAL phase; the IAL terminates at Phase 27 by declaration
  (`IAL/tasks.md:1664-1675`).
- **R0.2** Sections R1 (vessel identity), R2 (discovery-vessel
  identity), and R3 (content-addressed templates) MAY be deployed
  independently. Sections R4 (peer registration) and R5 (peer-aware
  resolve) depend on R1 + R2. Section R6 (migration) depends on all
  prior sections.
- **R0.3** All R7 verification is in-substrate against a development
  substrate per `2026-05-23-single-container-substrate`; cross-
  substrate verification in §R7.4 requires two substrates.

## R1 — Vessel identity from pubkey

- **R1.1** Every vessel that registers with a discovery-vessel MUST
  derive its `vessel_id` from an Ed25519 public key it controls:
  `vessel_id = base32(multihash(SHA-256, pubkey))`. This is the
  libp2p PeerID construction; the spec is fixed.
- **R1.2** The `POST /register` payload MUST include `pubkey`,
  `signature`, `nonce`, and `signed_at`. The signature MUST verify
  under `pubkey` against the canonical-encoding of
  `{vessel_id, signed_at, registry_endpoint, nonce}`.
- **R1.3** The discovery-vessel MUST verify (a) the multihash
  binding, (b) the signature, (c) `signed_at` within ±60 seconds of
  the registry's wall clock, (d) the nonce has not been seen for
  this `vessel_id` in the last 10 minutes. Verification failure on
  any of (a)–(d) MUST short-circuit registration with a 4xx error
  in `enforcement: "reject"` mode, and MUST log a structured event
  in `enforcement: "log_only"` mode.
- **R1.4** Heartbeats (`POST /heartbeat`) and deregistrations
  (`DELETE /vessels/:id`) MUST carry a fresh signed challenge with
  a new nonce and current `signed_at`. The discovery-vessel MUST
  verify against the pubkey persisted at registration time.
- **R1.5** Re-registration where the submitted `vessel_id` matches
  an existing record but the pubkey differs MUST be rejected. TOFU
  semantics apply for this spec; explicit pubkey rotation is out
  of scope.
- **R1.6** This requirement set is the H2 subset shipped here. The
  H2 spec's tasks 2.1–2.10 (security-hardening-findings/tasks.md)
  close transparently when R1.1–R1.5 are implemented.

### Scenarios

#### Scenario: Forged registration rejected
- **GIVEN** an attacker submits `POST /register` with a `vessel_id`
  that does not match the multihash of the submitted pubkey
- **WHEN** discovery-vessel runs `verifyVesselIdentity`
- **THEN** the registration is rejected with a structured error
- **AND** no row is written to the registry

#### Scenario: Replayed challenge rejected
- **GIVEN** discovery-vessel has observed nonce N for `vessel_id` V
  within the last 10 minutes
- **WHEN** a second `POST /register` arrives for V with the same N
- **THEN** registration is rejected

## R2 — Discovery-vessel identity

- **R2.1** The discovery-vessel MUST itself have a pubkey-derived
  `vessel_id`. It MUST generate an Ed25519 keypair on first boot,
  persist it under its data directory (sealed under the existing
  API-key secret), and re-use it across restarts.
- **R2.2** `GET /health` and `GET /registry/stats` responses MUST
  include the discovery-vessel's own `vesselId`. This is the
  identifier other discovery-vessels use to refer to this one
  when establishing peer links (R4).

## R3 — Content-addressed template ids

- **R3.1** A new field `template_content_id: string` is defined on
  `activity_template`. It SHALL equal
  `"activity:" + sha256_hex(canonical_json(template_body))` where
  `canonical_json` is the same RFC 8785 (JCS) canonical-JSON
  encoding pinned by
  `state-space-signature/spec.md` §R1.1, and `template_body` is
  the deterministic subset of the template:
  `{name, input_shapes, output_shapes, tasks, version_tag}`. The
  exact field set is fixed at implementation time (tasks §3.1) and
  versioned by `version_tag`.
- **R3.2** `sha256_hex` is the full 64-character lowercase-hex
  digest. Template ids are NOT truncated. (The 16-char truncation
  used by `state_space_signature` is appropriate for cardinality-
  bounded binding contexts; template-body cardinality is unbounded
  and requires the full digest.)
- **R3.3** Template-write paths (`POST /v2/activities/templates`,
  ribosome `assembleTemplateFromExecution`, any other CREATE site
  in activity-api) MUST compute `template_content_id` at write
  time and persist it alongside the existing free-form `id`. The
  existing `id` is retained as a human-readable display alias.
- **R3.4** Minibob and activity-api MUST compute byte-identical
  `template_content_id` values for byte-identical `template_body`
  inputs. The test suites SHALL share a fixture vector exactly as
  `state-space-signature/spec.md` §R1.1 already requires.
- **R3.5** A one-time backfill SHALL compute `template_content_id`
  for all existing rows. The backfill is idempotent: running it on
  a fully-backfilled table is a no-op.
- **R3.6** Merging Thompson posteriors keyed on
  `template_content_id` across peers is OUT OF SCOPE for this spec.
  Such merging requires H1 two-sided traces; the merge spec is a
  separate future change.

### Scenarios

#### Scenario: Determinism across vessels
- **GIVEN** template_body T
- **WHEN** minibob computes `computeTemplateContentId(T)`
- **AND** activity-api computes `computeTemplateContentId(T)` for
  the same input
- **THEN** the results are byte-identical

#### Scenario: Field-order independence
- **GIVEN** template_body T1 and T2 that differ only in JSON key
  order
- **WHEN** the content id is computed for each
- **THEN** the two ids are byte-identical

## R4 — Peer discovery

- **R4.1** A discovery-vessel MAY hold a set of peer discovery-vessels.
  Each peer entry is `{vesselId, endpoint, label?, authority_endorsements?}`.
  Peer entries are operator-supplied; auto-discovery of peers is OUT
  OF SCOPE for this spec.
- **R4.2** On first contact with a configured peer, the discovery-
  vessel MUST verify reachability via `GET <peer.endpoint>/health` and
  confirm the returned `vesselId` matches the configured peer
  `vesselId`. On mismatch, the peer MUST be marked unhealthy; the
  configured entry MUST NOT be deleted (operator intent is preserved).
- **R4.3** Discovery-vessel MUST health-check peers on the same cadence
  as local vessel TTL (default 60 s). Three consecutive failures flip
  state to `unhealthy`; one success flips back to `healthy`.
- **R4.4** `GET /registry/stats` MUST include a `peers` array with
  `{vesselId, label, last_seen, healthy}` per peer.
- **R4.5** Peer entries MAY carry `authority_endorsements` per
  `security-hardening-findings/§H4`. In `enforcement: "log_only"` mode
  the endorsements are recorded but not enforced. In `enforcement:
  "reject"` mode (lit when H4 is operational), peers without
  endorsements meeting the org's authority threshold MUST be skipped
  in forwarding (R5).

## R5 — Peer-aware resolve

- **R5.1** `POST /resolve` MUST first attempt local resolution. If the
  local registry returns matches AND the matches satisfy the request's
  shape requirements, the handler returns immediately without forwarding.
- **R5.2** When local resolution returns zero matches (or below a
  configurable `min_candidates_for_shape` threshold for
  `vesselCapability` queries), the handler MUST forward to each healthy
  peer in parallel and merge responses. Forwarding MUST use an
  `X-Peer-Depth: <int>` request header (default 0 on initial request,
  incremented per hop) and a `max_peer_depth` configuration (default 1).
- **R5.3** A discovery-vessel receiving a request with
  `X-Peer-Depth >= max_peer_depth` MUST serve from its local registry
  only; it MUST NOT forward further.
- **R5.4** Forwarded vessels MUST be merged with local vessels and
  deduplicated by `vesselId`. Each returned `VesselCapability` MUST
  carry a `reachability` annotation:
  ```ts
  reachability: {
    direct: boolean
    via_peer?: string   // peer's vesselId when forwarded
    hops: number        // 0 for local, ≥1 for peer-routed
    last_seen: string
  }
  ```
  Local vessels MUST report `direct: true, hops: 0`. Peer-routed
  vessels MUST report `direct: false, via_peer: <peer.vesselId>,
  hops: <observed>`.
- **R5.5** The response MUST NOT include any field that names a
  substrate, cluster, or deployment unit. Callers consume vessels and
  reachability; they MUST NOT branch on topology identity. (Future
  consumers MAY use `reachability.hops` or `reachability.last_latency_ms`
  for preference, but the system does not name substrates.)
- **R5.6** Cycle protection: discovery-vessel MUST maintain an
  `X-Peer-Visited` request header (comma-joined `vesselId` list) and
  MUST skip peers whose `vesselId` already appears in the header. If
  the header exceeds `max_peer_visited_size` (default 16), the request
  is rejected with a structured error.
- **R5.7** Forwarded responses MAY be cached with a short TTL (default
  30 s) keyed by `(pointer-shape, peer.vesselId)`. A heartbeat from a
  peer MUST invalidate that peer's cache entries.

### Scenarios

#### Scenario: Upstream caller does not branch on locality
- **GIVEN** caller C invokes `callVesselResolve` for shape S
- **WHEN** C's local discovery-vessel has no local match but a peer P
  does
- **THEN** the returned vessel record carries the peer's resolve
  contract (endpoint, auth_scheme, resolve_endpoint)
- **AND** C dials that endpoint exactly as it would a local vessel
- **AND** no code in C inspects `reachability` to decide whether to
  call the vessel

#### Scenario: Cycle detected and rejected
- **GIVEN** discovery-vessel A forwards to B, which forwards to C, which
  has A configured as a peer
- **WHEN** C considers forwarding to A
- **THEN** A's `vesselId` is present in `X-Peer-Visited`
- **AND** C skips A and returns its local-only result

#### Scenario: Depth limit honoured
- **GIVEN** `max_peer_depth = 1` on every discovery-vessel
- **WHEN** A forwards to B, and B receives `X-Peer-Depth: 1`
- **THEN** B serves from local only; B does NOT forward to its own peers

## R6 — Migration and enforcement

- **R6.1** Both R1 and R5's authority gating SHALL initially deploy in
  `enforcement: "log_only"` mode. The flag is per-org configuration.
- **R6.2** A migration window of at least 7 days on the canary substrate
  SHALL precede the flip to `enforcement: "reject"`. During the window,
  structured logs collect any non-conforming registrations and any
  peer-forwarding attempts lacking H4 endorsements.
- **R6.3** The flip to `enforcement: "reject"` MAY proceed per-org when
  the log shows zero non-conforming registrations from known vessels.
  The flip is reversible by the same per-org configuration switch.
- **R6.4** Operator runbook
  `docs/runbooks/vessel-federation-bootstrap.md` SHALL document peer
  establishment, key generation, and endorsement collection (the last
  is a no-op until H4 ships).

## R7 — Tests

- **R7.1** Unit tests in `repos/discovery-vessel/test/` covering R1
  scenarios (forged registration, replayed challenge, pubkey mismatch)
  and R5 scenarios (locality not visible upstream, cycle detection,
  depth limit).
- **R7.2** Cross-vessel fixture tests for R3 determinism shared between
  `repos/metabob-activity-api/test/` and `repos/minibob/test/`,
  mirroring the fixture-sharing pattern of `state-space-signature`.
- **R7.3** In-substrate smoke per `single-container-substrate` Phase 26:
  one container running two discovery-vessels at distinct ports, each
  with a small local fleet, demonstrates R5.1–R5.6 end-to-end.
- **R7.4** Two-substrate smoke: two containers on the same host;
  substrate B's discovery-vessel is configured with substrate A's
  discovery-vessel as a peer. A goal on substrate B that requires a
  shape only A produces completes successfully via peer-routed
  `/resolve`. The trace on substrate B records the peer-routed call
  via the unmodified `callVesselResolve` path.

## R8 — Acceptance

- **R8.1** All §R1–§R7 requirements satisfied.
- **R8.2** R7.3 in-substrate smoke green on a development substrate.
- **R8.3** R7.4 two-substrate smoke green; substrate B's minibob trace
  shows it called the peer-routed vessel through the same
  `callVesselResolve` path as any local call.
- **R8.4** The IAL `tasks.md` "Gates & Dependencies" table contains a
  row referencing this spec; no IAL phase is modified.
- **R8.5** A TODO marker in `repos/discovery-vessel/src/registry.ts`
  records the H1 dependency for cross-peer Thompson posterior merging
  (separate future spec); this spec is acceptance-complete without H1.
