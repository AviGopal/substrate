## ADDED Requirements

### Requirement: Cross-vessel calls are corroborated by both endpoints (H1)
For every `impulse_resolutions[]` row in an execution trace that names a remote `vessel_id` distinct from the trace emitter, an **invoker view** and an **invoked view** SHALL be submitted to `POST /v2/activities/execution-traces`. Each view SHALL be signed with the submitting vessel's Ed25519 key over a canonical-form digest of the per-call record (`impulse_id`, `resolver_id`, `latency_ms`, `cost_usd`, `success`, `output_impulse_ids`).

#### Scenario: Both views ingested for a cross-vessel call
- **WHEN** vessel A invokes a resolver on vessel B and both vessels submit traces with `view: "invoker"` and `view: "invoked"` respectively, sharing the same `correlation_id` and `impulse_id`
- **THEN** both views persist; the pairing job joins them; `vessel_trust_score` reflects no discrepancy

#### Scenario: Single-sided trace under enforce mode
- **WHEN** vessel A submits an invoker view for a cross-vessel call but no invoked view arrives within the pairing window
- **THEN** the trace is persisted but flagged `unpaired: true`; the row is excluded from Thompson posterior updates while remaining queryable for observability

#### Scenario: Discrepant views downgrade trust score
- **WHEN** invoker view reports `success: true` and invoked view reports `success: false` for the same `(correlation_id, impulse_id)`
- **THEN** the pairing job records a discrepancy against both vessels' rolling trust score

### Requirement: Trace signatures use Ed25519 over a canonical-form digest (H1)
Each view's signature SHALL be Ed25519 over a SHA-256 digest of the canonical-JSON-serialised (RFC 8785) per-call record. The signing key SHALL be the vessel key whose pubkey-derived `vessel_id` (per H2) matches the view's claimed identity.

#### Scenario: Invalid signature rejected
- **WHEN** a trace view's signature does not verify under the vessel's registered pubkey
- **THEN** the ingest endpoint rejects the trace with HTTP 401 and the row is not persisted

### Requirement: Thompson updates skip rows below trust-score threshold (H1)
The Thompson Sampling α/β update path at `repos/metabob-activity-api/src/routes/execution-traces.ts:1306` and `:1579` SHALL skip rows whose vessel's `vessel_trust_score` is below the configured threshold. The rows SHALL persist for observability.

#### Scenario: Low-trust vessel's traces do not update posteriors
- **WHEN** vessel V's `vessel_trust_score` is below threshold and V emits a successful trace for variant X
- **THEN** variant X's α is unchanged by this trace; the trace remains queryable

### Requirement: Vessel-id is derived from a vessel-held public key (H2)
The `vessel_id` for every registered vessel SHALL satisfy `vessel_id == base32(multihash(SHA-256, vessel_pubkey))`. Discovery-vessel SHALL verify this equality on every register, heartbeat, and deregister request.

#### Scenario: Mismatched vessel-id and pubkey rejected
- **WHEN** a registration arrives with `vessel_id` that does not equal `base32(multihash(SHA-256, pubkey))`
- **THEN** discovery-vessel rejects the request

### Requirement: Registration is gated on a fresh signed challenge (H2)
`POST /register` SHALL include a signature over `{vessel_id, signed_at, registry_endpoint, nonce}`, valid under `pubkey`. `signed_at` SHALL be within ±60s of the registry's clock; `nonce` SHALL be unseen for this `vessel_id` within the previous 10 minutes.

#### Scenario: Stale signed_at rejected
- **WHEN** a register request carries `signed_at` outside the ±60s window
- **THEN** the registry rejects with HTTP 400

#### Scenario: Replayed nonce rejected
- **WHEN** a register request reuses a nonce that this vessel-id used in the previous 10 minutes
- **THEN** the registry rejects with HTTP 409

### Requirement: Pubkey is persisted and re-registration with a different pubkey is rejected (H2)
The registry SHALL store the `pubkey` alongside the vessel record. A subsequent registration for the same `vessel_id` carrying a different `pubkey` SHALL be rejected.

#### Scenario: Pubkey rotation attempt blocked in v1
- **WHEN** vessel V re-registers with the same `vessel_id` but a different pubkey
- **THEN** the registry rejects the request and the original pubkey remains the canonical one

### Requirement: Heartbeat and deregistration require fresh signed challenges (H2)
`POST /heartbeat` and `DELETE /vessels/:id` SHALL each include a fresh signed challenge under the vessel's stored pubkey. The same freshness and nonce-uniqueness rules as registration apply.

#### Scenario: Heartbeat without valid signature rejected
- **WHEN** a heartbeat lacks a valid signature
- **THEN** the registry returns HTTP 401 and the vessel's TTL is not refreshed

### Requirement: Scope-bearing impulses carry a signed attestation envelope (H3)
Impulses whose shape is in the configured scope-bearing list (initial value: `["scopeContext"]`) SHALL carry a `ScopeAttestation` of the form `{ issuer, audience, scope_hash, nonce, deadline, domain: { name: "metabob-scope", version, issuer_org_id }, signature }`. The signature SHALL be Ed25519 over the EIP-712-style typed-data digest `SHA-256("\x19\x01" || domain_separator_hash || struct_hash)`.

#### Scenario: Scope-bearing impulse without attestation rejected
- **WHEN** an impulse with shape `scopeContext` is written without a `ScopeAttestation`
- **THEN** the impulse-write endpoint rejects with HTTP 400

#### Scenario: Non-scope-bearing impulses unaffected
- **WHEN** an impulse with a non-scope-bearing shape (e.g. `file`, `gitDiff`) is written without an attestation
- **THEN** the impulse-write endpoint accepts the impulse normally

### Requirement: Scope attestations are verified at impulse-write time (H3)
The impulse-write path SHALL verify (a) the signature against the issuer's pubkey, (b) the `audience` matches the consumer of the impulse, (c) `deadline` has not passed, (d) `nonce` is strictly greater than the last-seen nonce for `(issuer, audience)`. Failure of any check SHALL reject the write.

#### Scenario: Wrong audience rejected
- **WHEN** an attestation's `audience` does not match the impulse's intended consumer
- **THEN** the write is rejected

#### Scenario: Expired deadline rejected
- **WHEN** an attestation's `deadline` is before the current time
- **THEN** the write is rejected

#### Scenario: Replayed nonce rejected
- **WHEN** an attestation's `nonce` is less than or equal to the last-seen nonce for `(issuer, audience)`
- **THEN** the write is rejected

### Requirement: Nonce state advances atomically across activity-api replicas (H3)
The `scope_nonce_state` table SHALL be updated via SurrealDB CAS keyed by `(issuer, audience)` so concurrent writes from multiple activity-api replicas cannot accept two attestations with the same nonce.

#### Scenario: Concurrent attestations with same nonce — one accepted
- **WHEN** two requests with the same `nonce` for the same `(issuer, audience)` arrive at different replicas simultaneously
- **THEN** exactly one succeeds; the other is rejected with a CAS-conflict error

### Requirement: High-risk vessel registrations require authority endorsements (H4)
A vessel registration whose advertised `shapes` intersects with any shape tagged `risk_tier: "high"` in `toolRiskProfile` SHALL include `authority_endorsements` whose distinct, valid signatures meet the org's threshold `k`. The endorsements SHALL be signatures over the canonical-form digest of the registration payload.

#### Scenario: High-risk registration with sufficient endorsements accepted
- **WHEN** a registration for a high-risk shape arrives with k or more valid endorsements (out of n authorised keys)
- **THEN** the registry accepts the registration

#### Scenario: High-risk registration with insufficient endorsements rejected under enforce mode
- **WHEN** a registration for a high-risk shape arrives with fewer than k valid endorsements and enforcement is `reject`
- **THEN** the registry rejects with HTTP 403

#### Scenario: Low-risk registration unaffected
- **WHEN** a registration whose shapes are all non-high-risk arrives without endorsements
- **THEN** the registry accepts the registration

### Requirement: Authority key state evolves via signed Authority Update Messages (H4)
Changes to an org's authority key set SHALL be expressed as Authority Update Messages (AUMs) signed by the current threshold of authority keys. The `authority_update_messages` log SHALL be append-only. Identity-vessel SHALL refuse AUMs that do not meet the current threshold.

#### Scenario: AUM with sufficient signatures accepted
- **WHEN** an AUM "add key K" is submitted with k valid signatures from the current key set
- **THEN** the AUM is appended to the log and the new key is active for subsequent operations

#### Scenario: AUM with insufficient signatures rejected
- **WHEN** an AUM is submitted with fewer than k valid signatures
- **THEN** the submission is rejected and the log is unchanged

### Requirement: A disablement secret pre-image disables high-risk operations (H4)
Presenting a pre-image whose hash is in the org's `disablement_secret_hashes` SHALL place the org in a disabled state in which all high-risk vessel registrations are blocked until an out-of-band recovery flow completes.

#### Scenario: Valid disablement pre-image disables the org
- **WHEN** a caller presents a pre-image whose SHA-256 is in `disablement_secret_hashes`
- **THEN** the org is flagged disabled and subsequent high-risk registrations are rejected

### Requirement: Each resolver family has exactly one immutable baseline variant (H5)
For every resolver family (e.g. `producer_selection`, `variant_selection`, `validator_dispatch`, `vessel_select`), exactly one variant SHALL carry `baseline: true` at any time. Variants with `baseline: true` SHALL be immutable; the storage layer SHALL refuse mutations.

#### Scenario: Baseline mutation rejected
- **WHEN** an authorised caller attempts to update fields on a variant where `baseline: true`
- **THEN** the update is rejected with HTTP 403; the existing record is unchanged

#### Scenario: New variants fork from baseline with parent_variant_id
- **WHEN** a new variant is created
- **THEN** it carries `baseline: false` and `parent_variant_id` referencing the variant it forked from

### Requirement: Quarantined variants are excluded from selection (H5)
A non-baseline variant whose rolling-window failure rate exceeds the family's threshold SHALL be flagged `quarantined: true` by the auto-regression scan. Quarantined variants SHALL be excluded from `POST /v2/activities/recommend` candidate sets, from `GET /v2/activities/:id/variant-scores` responses, and from Thompson α/β updates.

#### Scenario: Variant exceeding threshold gets quarantined
- **WHEN** non-baseline variant V's failure rate over the rolling window exceeds the configured threshold
- **THEN** the auto-regression scan sets `quarantined: true` with `quarantine_reason` set

#### Scenario: Quarantined variant invisible to recommend
- **WHEN** `POST /v2/activities/recommend` is called for a family whose variant V is quarantined
- **THEN** the response candidate set does not contain V

#### Scenario: Quarantined variant does not move posteriors
- **WHEN** an execution trace records a result for quarantined variant V
- **THEN** V's α and β are unchanged by this trace

### Requirement: Promotion to baseline requires authority-key signatures (H5)
Setting `baseline: true` on a variant SHALL require AUM-style signatures meeting the org's threshold. The promotion SHALL be appended to `baseline_promotion_log` and the baseline pointer SHALL flip atomically with the prior baseline becoming non-baseline.

#### Scenario: Promotion with sufficient signatures
- **WHEN** a promotion request for variant V arrives with k valid authority signatures
- **THEN** V becomes the baseline; the prior baseline becomes non-baseline; an entry is appended to `baseline_promotion_log`

#### Scenario: Promotion without sufficient signatures rejected
- **WHEN** a promotion request arrives with fewer than k valid signatures
- **THEN** the promotion is rejected; the baseline pointer is unchanged

### Requirement: Un-quarantine is operator-only (no automatic recovery) (H5)
A quarantined variant SHALL NOT be un-quarantined by the auto-regression scan. Un-quarantine SHALL require an explicit operator action recorded in the audit log.

#### Scenario: No automatic un-quarantine
- **WHEN** a quarantined variant subsequently receives invocations whose failure rate is below the threshold
- **THEN** `quarantined: true` remains set; the scan does not flip it

### Requirement: Child activity scope is a subset of parent activity scope (CC1)
At child-activity dispatch, the executor SHALL verify `child.scope_set ⊆ parent.scope_set`. Subset semantics are scope-claim-specific (defined by the in-flight `2026-04-26-shape-provider-goal-creation` spec). On violation, the child invocation SHALL be rejected.

#### Scenario: Child with subset scope dispatches
- **WHEN** every claim in `child.scope_set` is satisfied by an equal-or-broader claim in `parent.scope_set`
- **THEN** the child invocation proceeds

#### Scenario: Child with widening scope rejected
- **WHEN** any claim in `child.scope_set` is broader than every corresponding claim in `parent.scope_set`
- **THEN** the child invocation is rejected and a trace is written with `failure_mode: { type: "safety_breach", context: { breach_type: "scope_widening", limit, attempted, ancestor_chain } }`

### Requirement: High-risk shapes only dispatch to externally-attested vessels (CC2)
Shapes tagged `risk_tier: "high"` in `toolRiskProfile` SHALL set `min_attestation_tier: "external_attested"`. Discovery-vessel's `/resolve` endpoint SHALL filter responses by this tier. MiniBob's `callVesselResolve` SHALL not dispatch a high-risk resolution to a vessel below the required tier.

#### Scenario: api_key-only vessel cannot serve high-risk shape
- **WHEN** a vessel registered with `attestation_tier: "api_key"` advertises a high-risk shape
- **THEN** discovery-vessel does not return this vessel in `/resolve` responses for that shape under enforce mode

#### Scenario: External-attested vessel serves high-risk shape
- **WHEN** a vessel registered with `attestation_tier: "external_attested"` (k8s SA, git OIDC, or member token) advertises a high-risk shape
- **THEN** discovery-vessel returns this vessel for that shape

### Requirement: Three external attestation paths are accepted (CC2)
Discovery-vessel SHALL accept and verify three external attestation types when computing `attestation_tier: "external_attested"`: (a) k8s service-account token, verified via the cluster's TokenReview endpoint; (b) git OIDC token (e.g. GitHub Actions, GitLab CI), verified against the issuer's well-known JWKS; (c) identity-vessel-issued member token, verified against identity-vessel's signing key.

#### Scenario: k8s SA token grants external_attested tier
- **WHEN** a registration includes a valid k8s SA token verifiable via TokenReview
- **THEN** the resulting record carries `attestation_tier: "external_attested"`

#### Scenario: Invalid attestation token does not grant the tier
- **WHEN** a registration includes a malformed or unverifiable token of any of the three types
- **THEN** the resulting record carries `attestation_tier: "api_key"` (the next-lower tier reachable with API-key auth alone)

### Requirement: Enforcement modes default to log-only during migration
For every hardening (H1–H5, CC1, CC2), the introducing change SHALL ship a configuration flag with values `log_only` and `reject` (or equivalent for the specific check), defaulting to `log_only` for the first release. Operators SHALL flip to `reject` after a calibration window.

#### Scenario: Log-only mode does not block operations
- **WHEN** any hardening's check fails under `enforcement: "log_only"`
- **THEN** the operation proceeds and a structured log entry records the would-be rejection

#### Scenario: Reject mode blocks operations
- **WHEN** any hardening's check fails under `enforcement: "reject"`
- **THEN** the operation is rejected with the structured error type defined by that hardening
