# Spec — Substrate Identity Resolution

Normative requirements. Each is testable. Terminology aligned with
`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`. Section refs
inline. This spec is a member of the post-lift-acceleration cluster
and operates at the substrate-maintenance horizon.

## ADDED Requirements

### Requirement: R0 — Sequencing and horizon framing

This spec MUST be sequenced behind its prerequisites and MUST operate at the substrate-maintenance horizon with sub-intent `substrate_identity_resolution`. The horizon framing places identity resolution alongside external-resolver-vesselization and substrate-self-replacement as sibling activities on the same horizon.

- **R0.1** This spec is downstream of `2026-05-23-signal-confidence-weighting`. DEV MUST NOT begin until that change's acceptance gate is green on the active substrate.
- **R0.2** Every activity introduced by this spec MUST tag its traces with `intent:substrate_maintenance` and `intent:substrate_identity_resolution`, plus an activity-specific sub-intent (`intent:mint`, `intent:issue_credentials`, `intent:resolve_context`).
- **R0.3** This spec does not modify the foundation document. New shapes are advertised by identity-vessel; new activities are dispatched via the existing activity-api mechanism.
- **R0.4** Impulses resolved against `substrateIdentity` (the substrate's own identity record) MUST carry `signal_confidence_weight = 1.0`, the substrate-authoritative tier, distinct from the external-source ceiling (0.7) defined in `2026-05-23-signal-confidence-weighting`.

#### Scenario: Prerequisite signal-confidence-weighting is green

- **WHEN** the operator runs the acceptance-gate query for `2026-05-23-signal-confidence-weighting`
- **THEN** it reports green before any task in this change is dispatched

#### Scenario: Trace tags carry both horizon and sub-intent

- **WHEN** any activity introduced by this spec completes
- **THEN** its trace's `tags` includes `intent:substrate_maintenance` and `intent:substrate_identity_resolution`
- **AND** also includes an activity-specific sub-intent

#### Scenario: Substrate-authoritative weight

- **WHEN** a vessel resolves an impulse against `substrateIdentity`
- **THEN** the returned impulse's `signal_confidence_weight` is exactly 1.0

### Requirement: R1 — `substrateIdentity` shape and identity-vessel ownership

The substrate SHALL have exactly one `substrateIdentity` record, owned by identity-vessel, advertised via discovery-vessel, and resolvable through identity-vessel's `/v2/impulses/resolve` dispatch. The record SHALL be immutable after mint (no in-place rotation in this spec; rotation is a follow-on).

- **R1.1** identity-vessel MUST advertise the shape `substrateIdentity` in its discovery-vessel registration.
- **R1.2** The `substrateIdentity` body MUST conform to:
  ```typescript
  {
    substrate_id: string;
    name: string;
    domain: string;
    jwt_issuer: string;
    signing_key_fingerprint: string;
    federation_membership: string[];
    established_at: string;
  }
  ```
- **R1.3** The identity-vessel backing store MUST enforce singleton semantics on the `substrate_identity` table (at most one row).
- **R1.4** Once the singleton row exists, further `mint-substrate-identity` invocations MUST fail with `failure_mode.type="verifier_negative"` and `context.validator_id="substrate_identity_already_minted"`.
- **R1.5** `substrateIdentity` MUST be resolvable via discovery: a `POST /v2/impulses/resolve` with `pointer.type="substrateIdentity"` returns the current record without requiring vessel credentials (it is the bootstrap-time anchor).

#### Scenario: Discovery returns substrateIdentity resolver

- **WHEN** a consumer queries discovery-vessel `/resolve` for shape `substrateIdentity`
- **THEN** the response includes identity-vessel as the resolver

#### Scenario: Second mint refused

- **WHEN** `mint-substrate-identity` is dispatched against a substrate that already has a `substrateIdentity` record
- **THEN** the activity fails with `failure_mode.type="verifier_negative"` and `context.validator_id="substrate_identity_already_minted"`

#### Scenario: Unauthenticated substrateIdentity read

- **WHEN** a vessel queries `POST /v2/impulses/resolve` with `pointer.type="substrateIdentity"` carrying only a bootstrap key (not full credentials)
- **THEN** identity-vessel returns the `substrateIdentity` record successfully

### Requirement: R2 — `vesselCredentials` shape and issuance contract

identity-vessel SHALL issue `vesselCredentials` impulses via the `issue-vessel-credentials` activity, bound to the substrate via the substrate's signing key. Issued credentials carry an explicit scope list and an optional expiry.

- **R2.1** identity-vessel MUST advertise the shape `vesselCredentials`.
- **R2.2** The `vesselCredentials` body MUST conform to:
  ```typescript
  {
    vessel_id: string;
    api_key: string;
    api_key_expires_at: string | null;
    scopes: string[];
    issued_at: string;
    issued_by: string;
  }
  ```
- **R2.3** `api_key` MUST be derived via HMAC over the substrate's signing key with the vessel_id and a random nonce; the credential MUST be verifiable offline against `substrateIdentity.signing_key_fingerprint`.
- **R2.4** The scope list MUST be a subset of the scopes the requesting `bootstrapAttestation` declared. Requested scopes exceeding the bootstrap key's permitted scope MUST be silently dropped (not granted); the issued credential's `scopes` field reflects the effective intersection.

#### Scenario: Issued credential is substrate-bound

- **WHEN** `issue-vessel-credentials` produces a `vesselCredentials` impulse
- **THEN** the `api_key` validates against the current `substrateIdentity.signing_key_fingerprint`

#### Scenario: Scope intersection enforcement

- **WHEN** a bootstrap key permitting `["read"]` is used to request `["read", "write"]`
- **THEN** the issued credential's `scopes` is `["read"]`
- **AND** the activity does NOT raise a `failure_mode`

### Requirement: R3 — Minimum-bootstrap-credential pattern

Every vessel that requires substrate-issued credentials SHALL bootstrap with exactly two environment variables: `SUBSTRATE_IDENTITY_URL` and `VESSEL_BOOTSTRAP_KEY`. Hardcoded defaults for substrate identity, JWT issuer, or peer endpoints SHALL NOT exist in vessel source.

- **R3.1** Every vessel that needs credentials MUST read `SUBSTRATE_IDENTITY_URL` and `VESSEL_BOOTSTRAP_KEY` at boot.
- **R3.2** If either env var is missing, the vessel MUST exit with non-zero status within 5 seconds of start, logging a clear error message naming the missing variable. The vessel MUST NOT fall back to any hardcoded default.
- **R3.3** Vessel source MUST NOT contain string literals matching `https?://identity\.metabob\.com`, `\.svc\.cluster\.local`, `activity-system\.svc`, or any other deployment-specific endpoint. (Test fixtures and archived directories are excluded.)
- **R3.4** The bootstrap key MUST be consumable exactly once. A second use of the same key MUST be refused with `failure_mode.type="safety_breach"` and `context.breach_type="bootstrap_key_replay"`.
- **R3.5** Bootstrap keys MUST carry an expiry; default expiry is 15 minutes from issuance. Use of an expired key MUST be refused with `failure_mode.type="verifier_negative"` and `context.validator_id="bootstrap_key_expiry"`.

#### Scenario: Missing env var causes loud exit

- **WHEN** a vessel is started without `SUBSTRATE_IDENTITY_URL` set
- **THEN** the vessel exits within 5 seconds
- **AND** the exit message names `SUBSTRATE_IDENTITY_URL` as the missing variable
- **AND** the exit status is non-zero

#### Scenario: No hardcoded substrate identity in source

- **WHEN** `grep -rn "metabob.com\|svc.cluster.local" repos/<vessel>/src` is run for any vessel migrated by this change
- **THEN** zero matches are returned (excluding test fixtures)

#### Scenario: Replay refusal

- **WHEN** a bootstrap key has already been consumed once
- **AND** a vessel attempts to use it a second time
- **THEN** `issue-vessel-credentials` records `failure_mode.type="safety_breach"` with `context.breach_type="bootstrap_key_replay"`
- **AND** does NOT issue credentials

### Requirement: R4 — `mint-substrate-identity` activity

The substrate SHALL ship an activity `mint-substrate-identity` that runs once per substrate to generate the `substrateIdentity` record. The activity is dispatched against identity-vessel; subsequent dispatches against an already-minted substrate refuse per R1.4.

- **R4.1** The activity MUST exist as an identity-vessel-owned activity template, dispatchable via the standard activity-api mechanism.
- **R4.2** The activity MUST generate an ed25519 signing keypair and compute `substrate_id` as a multihash of the public key. This makes substrate identity self-referencing — the substrate_id is derived from the key, not assigned externally.
- **R4.3** The activity MUST construct `jwt_issuer` as `https://<domain>` (or `http://` if the domain is `localhost`) per design §D; the `domain` is supplied in the `substrateMintRequest` input.
- **R4.4** The mint activity MUST persist the singleton `substrateIdentity` row in identity-vessel's backing store; the signing key's private half MUST be persisted in identity-vessel's secret store and never returned in any impulse.
- **R4.5** The activity MUST emit one `substrateIdentity` impulse upon completion; this is the canonical record consumers query.

#### Scenario: First mint succeeds

- **WHEN** the operator dispatches `mint-substrate-identity` against a substrate with no existing `substrateIdentity` record
- **THEN** the activity completes successfully
- **AND** emits a `substrateIdentity` impulse with all required fields populated

#### Scenario: substrate_id is key-derived

- **WHEN** the activity completes
- **THEN** the emitted `substrateIdentity.substrate_id` is a deterministic multihash of the generated signing public key

### Requirement: R5 — `issue-vessel-credentials` activity and `resolve-substrate-context` endpoint

identity-vessel SHALL expose `POST /v1/auth/resolve-context`, which validates a bootstrap key, dispatches `issue-vessel-credentials`, and returns the `(substrateIdentity, vesselCredentials)` tuple in one round trip.

- **R5.1** identity-vessel MUST expose `POST /v1/auth/resolve-context`.
- **R5.2** The endpoint MUST accept `Authorization: Bearer <bootstrap-key>` and a JSON body containing `vessel_id`, `advertised_shapes`, and `requested_scopes`.
- **R5.3** On success, the endpoint MUST return a JSON tuple `{ substrate_identity, vessel_credentials }` matching shapes R1.2 and R2.2.
- **R5.4** On any failure (missing key, invalid key, replay, expiry), the endpoint MUST return 401 with a body identifying the failure class (one of `missing_key`, `invalid_key`, `replay`, `expiry`).
- **R5.5** The endpoint's underlying activity MUST emit a trace tagged with `intent:substrate_maintenance` and `intent:substrate_identity_resolution` and `intent:resolve_context`.

#### Scenario: Successful resolution returns tuple

- **WHEN** a vessel POSTs `/v1/auth/resolve-context` with a valid bootstrap key and registration body
- **THEN** the response is 200 with `substrate_identity` and `vessel_credentials` objects

#### Scenario: Invalid key returns 401 with class

- **WHEN** a vessel POSTs with an invalid bootstrap key
- **THEN** the response is 401
- **AND** the body's failure class is `invalid_key`

### Requirement: R6 — Boot-path failure handling

Every vessel migrated by this change SHALL implement explicit, fast-failing boot-path failure handling. Vessels SHALL NOT silently fall back to any default endpoint or credential when bootstrap fails.

- **R6.1** Missing required env vars: exit within 5s with status 1.
- **R6.2** Identity-vessel unreachable: retry with exponential backoff (1s, 2s, 4s, 8s) up to 4 attempts; if all fail, exit with status 2.
- **R6.3** Bootstrap key rejected (any failure class from R5.4): exit within 5s with status 3.
- **R6.4** `substrateIdentity` record not yet minted (identity-vessel reachable but record absent): exit within 5s with status 4; the operator must run `mint-substrate-identity` before retrying.
- **R6.5** Each exit MUST be accompanied by a log message naming the failure class and the operator remediation.

#### Scenario: Network retry then exit

- **WHEN** identity-vessel is unreachable from boot
- **THEN** the vessel retries with exponential backoff
- **AND** after the fourth failed attempt exits with status 2 within 16 seconds total

#### Scenario: Pre-mint exit

- **WHEN** a vessel boots before `mint-substrate-identity` has run
- **THEN** the vessel exits with status 4
- **AND** the log names `substrate_not_minted` as the failure class

### Requirement: R7 — Substrate bootstrap integration

The single-container substrate's bootstrap MUST use the new flow. `scripts/substrate/seed-identity.ts` MUST dispatch `mint-substrate-identity` rather than write directly to SurrealDB; `scripts/substrate/gen-env.sh` MUST emit `SUBSTRATE_IDENTITY_URL` and per-vessel `VESSEL_BOOTSTRAP_KEY` values rather than the legacy env vars.

- **R7.1** `seed-identity.ts` MUST dispatch the activity by name, not write to the database directly.
- **R7.2** `gen-env.sh` MUST emit `SUBSTRATE_IDENTITY_URL` set to the substrate's identity-vessel address (e.g. `http://localhost:8090`) and one `VESSEL_BOOTSTRAP_KEY` per vessel systemd unit.
- **R7.3** `make -C scripts/substrate substrate-run` MUST produce a substrate where every vessel boots via the new flow with no legacy env vars present in the systemd Environment files.

#### Scenario: Fresh substrate-run uses new flow

- **WHEN** `make -C scripts/substrate substrate-run` is executed against a fresh build
- **THEN** every vessel's systemd unit Environment file contains `SUBSTRATE_IDENTITY_URL` and `VESSEL_BOOTSTRAP_KEY`
- **AND** no Environment file contains literal `metabob.com` or `.svc.cluster.local` references

### Requirement: R8 — Acceptance

The change MUST be accepted only when R1–R7 contract tests pass, the deletion of hardcoded defaults is verified by grep, the fresh-substrate canary boots end-to-end, and the closure-audit reports the expected results.

- **R8.1** R1–R7 contract tests all green.
- **R8.2** **Default-deletion grep**: `grep -rn "metabob.com\|svc.cluster.local" repos/identity-vessel/src repos/discovery-vessel/src repos/metabob-activity-api/src repos/concept-db/src repos/metabob-analysis-api/src repos/minibob/src` returns zero matches outside test fixtures and archived files.
- **R8.3** **Fresh-substrate canary**: `make -C scripts/substrate substrate-run` against a fresh DB produces a substrate where all six core vessels (identity-vessel, discovery-vessel, activity-api, concept-db, conversation-vessel, development-vessel) boot, register via discovery, and serve their advertised shapes within 30 seconds.
- **R8.4** **Boot-failure canary**: omitting `SUBSTRATE_IDENTITY_URL` from one vessel's systemd unit causes that vessel to exit within 5 seconds with a clear error.
- **R8.5** **Closure-audit**: `closure-audit --without=operator-shell` against a fresh-substrate launch succeeds, with the only operator-shell invocation being the operator running `substrate-run` itself.
- **R8.6** **Backward-compatibility**: existing JWTs and API keys issued before this change continue to validate against the new identity-vessel without re-issuance.

#### Scenario: Fresh substrate-run boots all vessels

- **WHEN** the operator runs `substrate-run` against a fresh build
- **THEN** within 30 seconds, all six core vessels are registered with discovery
- **AND** each is serving its advertised shapes

#### Scenario: Closure audit passes

- **WHEN** `closure-audit --without=operator-shell` runs against the fresh substrate
- **THEN** the audit reports zero failures
- **AND** the only operator-shell invocation is `substrate-run` itself

#### Scenario: Pre-existing credentials still valid

- **WHEN** a vessel presents an API key issued before this change ships
- **THEN** identity-vessel validates the key successfully
- **AND** no migration of stored credentials is required

## Status

Post-`signal-confidence-weighting`. Precondition for
`provider-credentials-as-impulse`, the credential-bootstrap path
of `substrate-self-replacement-pipeline`, and any honest claim
about deployment-agnosticism. Sibling to
`external-resolver-vesselization` and
`substrate-self-replacement-pipeline` at the
substrate-maintenance horizon.
