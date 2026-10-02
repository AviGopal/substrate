# Spec — Vessel Pubkey Identity (Phase 2 deployment surface)

Normative requirements for Phase 2 of `2026-05-31-substrate-fleet-
federation`. The cryptographic surface for H2 is owned by
`2026-04-26-security-hardening-findings/specs/security-hardening/`
and the discovery-layer deployment is owned by
`2026-05-23-vessel-federation/specs/vessel-federation/§R1-R2`. This
spec delta exists to gate Phases 3–5 of fleet federation on H2
completion without coupling the gates to another change's task list.

## R0 — Authority

- **R0.1** The cryptographic construction `vessel_id =
  base32(multihash(SHA-256, pubkey))` SHALL be as specified in
  `2026-04-26-security-hardening-findings/design.md §H2` and
  `2026-05-23-vessel-federation/specs/vessel-federation/spec.md
  §R1`. This spec MUST NOT re-specify the construction.
- **R0.2** This spec extends those two by adding **fleet
  prerequisite** semantics: Phases 3, 4, and 5 of
  `2026-05-31-substrate-fleet-federation` SHALL NOT activate any
  cross-substrate codepath until R1 below is met for every vessel
  in the originating substrate.

## R1 — Substrate-wide H2 completion gate

- **R1.1** Every vessel that registers with the substrate's
  discovery-vessel — including the discovery-vessel itself — SHALL
  have an Ed25519 keypair persisted in its data directory and a
  `vessel_id` derived from the public key.
- **R1.2** The substrate's discovery-vessel SHALL be in `enforcement:
  "reject"` mode for vessel registrations (per vessel-federation
  §R1.6 / H2 task 2.6). Log-only mode SHALL NOT be sufficient for
  Phase 3 activation.
- **R1.3** identity-vessel SHALL issue attestations bound to the
  requesting vessel's pubkey rather than to an operator-provisioned
  API key. The pubkey-bound attestation is the credential that
  travels in subsequent H1 trace signatures (Phase 3) and H3 scope
  attestations (Phase 5).
- **R1.4** A `substrate-h2-status` impulse SHALL be resolvable from
  the substrate's discovery-vessel summarizing R1.1–R1.3 completion
  state. The impulse body SHALL include `{enforcement_mode, vessels:
  [{vessel_id, pubkey_present, attestation_pubkey_bound}]}`. Phase
  3, 4, and 5 activation flags SHALL read this impulse and refuse
  to activate if any vessel reports incomplete H2.

## R2 — Discovery-vessel as substrate identity anchor

- **R2.1** The substrate's discovery-vessel pubkey SHALL be the
  identity by which peer substrates address this substrate. There
  SHALL NOT be a separate "substrate id" pubkey distinct from the
  discovery-vessel pubkey.
- **R2.2** Rotation of the discovery-vessel pubkey is out of scope
  for this spec (and for H2 v1). A rotation SHALL be treated as a
  new substrate identity from peers' perspective; the operator
  MUST re-run the Phase 4 ratification flow.

## R3 — Non-requirements

- **R3.1** This spec SHALL NOT add new fields to the discovery-
  vessel registration payload, the heartbeat payload, or the
  resolve payload beyond what vessel-federation §R1–R2 already
  specifies.
- **R3.2** This spec SHALL NOT specify pubkey rotation procedures
  beyond R2.2. Operator-driven rotation under H2 v2 is the
  recovery path.

## R4 — Verification

- **R4.1** `substrate-h2-status` impulse resolves and reports all
  fields. The check is consumable by automated activation gates
  for Phases 3, 4, and 5.
- **R4.2** Attempting to activate Phase 3 (federated discovery
  with information flow) against a substrate where any vessel
  reports `pubkey_present: false` SHALL refuse with an explicit
  error referencing the offending `vessel_id`.
