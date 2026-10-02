**Status (2026-04-29)**: Not started. Blocking: impulse-activity-loop Phase 5 cutover. H1 is the highest-priority item.

**Status (2026-07-04, identity workstream)**: H2 is now the entry point (H2 → H1 → H3, per design §Sequencing). Survey findings that reshape the H2 tasks:

- **No `pubkey_hash` field exists** on the registration payload today. What exists is `libp2p_peer_id` / `libp2p_multiaddr` (federation transport advertisement) in `repos/discovery-vessel/src/types.ts` — stored and echoed verbatim, never verified.
- **The federation transport inverts H2.** `repos/libp2p-federation-transport/src/index.ts` derives the Ed25519 keypair deterministically from the vessel id (`seed = sha256(vesselId)`). Anyone who knows the id string can compute the private key. This was a transport-stability convenience; it must be superseded by the H2 keypair (random keygen, id/hash derived from the key, possession proven by challenge). Until then, `libp2p_peer_id` carries zero identity assurance.
- **All registration mutations are gated only by the shared seeded org API key** (identity-vessel `/v1/auth/resolve`); identity is whatever string the caller puts in `vesselId`. Container-network locality is the actual trust boundary — exactly the property this change removes.

**Slice decomposition for substrate authoring (advisory-first — record, never reject; enforcement is a later flip):**

- [x] S1 (`discovery-vessel`) — LANDED 2026-07-04, substrate-authored via feature_compose (dispatches 2f473718 / b2ebabf6 / 554f2b5b / b783bc3c / 3d27c4e6), operator-landed commits discovery-vessel `3685439` + `5fe6fb8`. E2E: development-vessel-local reads back `identity_status: "verified"` on GET /vessels/:vesselId; tampered sig → mismatch, absent pubkey → unverified, pubkey rotation → mismatch. Remaining sub-item: surface in /registry/stats aggregate + vesselCapability results. Advisory identity fields on registration: extend `RegisterRequest`/`VesselRegistration` with optional `pubkey` (base64 Ed25519), `identity_signature`, `identity_nonce`, `identity_signed_at`; registry computes `pubkey_hash = base64url(sha256(pubkey))` and an `identity_status: "verified" | "unverified" | "mismatch"` — `verified` when the signature over the canonical JSON `{vesselId, identity_signed_at, identity_nonce}` verifies under `pubkey`, `unverified` when fields absent, `mismatch` when verification fails or the pubkey differs from the first-seen pubkey for that vesselId (TOFU pin, in-memory like the rest of the registry). Never rejects. Surface `identity_status` in `/registry/stats` and vesselCapability results.
- [x] S2 — LANDED 2026-07-04 for the first client (development-vessel `3a9ea4c`, in `src/discovery-registration.ts` rather than `packages/vessel-discovery-client`, because the compose/fs workspace root excludes `packages/**` — capability gap concept_bynjw9r6YLrH; operator-authored direct edit after two substrate attempts failed on cutover-interruption + BUSY self-interference, dispatches cb21c798 / 3991ccbc). Remaining: same pattern in `packages/vessel-discovery-client` (blocked on the workspace-root gap) and other self-registering vessels (goal-host, concept-db, obsidian-vessel). Original slice: (`vessel-discovery-client`) Keypair at the client: generate an Ed25519 keypair at first start (persist under the vessel data dir when writable, in-memory otherwise), attach `pubkey` + fresh signed challenge on register and heartbeat. Opt-in via config so no consumer breaks.
- [ ] S3 (`discovery-vessel`) Challenge freshness: `identity_signed_at` within ±60s, nonce replay tracking per vesselId (10-min window) — still advisory, degrades `identity_status`, never rejects.
- [ ] S4 enforcement flip (`DISCOVERY_IDENTITY_ENFORCEMENT=log_only|reject`, default `log_only`) + heartbeat/deregister challenge verification against the pinned pubkey (subsumes 2.4/2.6).
- [ ] S5 supersede the seed-derived libp2p identity: the libp2p peerId becomes the multihash of the S2-generated pubkey, making the container↔host link and a federated peer the same trust problem with the same answer.
- H1 signing identity (1b.1) and H3 issuer keys then reuse the S2 keypair. Original tasks 2.1–2.10 remain the destination state; vessel_id itself staying a human-readable name with `pubkey_hash` as the cryptographic binding is the compatible intermediate (full `vessel_id = multihash(pubkey)` rename deferred with the rotation flow).

## 1. Hardening H1 — Two-sided execution traces

### 1a. Activity-API schema and ingest

- [ ] 1a.1 (`metabob-activity-api`) Extend `StoreExecutionTraceRequestSchema` in `repos/metabob-activity-api/src/models/schemas.ts` with `view: "invoker" | "invoked"` discriminator, `signature: string`, `signed_payload_digest: string`, and per-`impulse_resolutions[]` row fields `invoker_signature`, `invoked_signature`. Defaults preserve legacy single-sided behaviour.
- [ ] 1a.2 (`metabob-activity-api`) New SurrealDB migration `<next>-execution-trace-views.surql` adding `execution_trace_views` table keyed by `(correlation_id, view, vessel_id)`, plus `vessel_trust_score` table keyed by `vessel_id`.
- [ ] 1a.3 (`metabob-activity-api`) In `repos/metabob-activity-api/src/routes/execution-traces.ts:856` (`POST /v2/activities/execution-traces`), accept and persist either view; if `view: "invoked"`, write to `execution_trace_views` and trigger a pairing-job notification rather than to `activity_execution_traces`.
- [ ] 1a.4 (`metabob-activity-api`) Implement pairing job (cron or post-write hook) that joins invoker and invoked views by `(correlation_id, impulse_id)`, computes per-pair discrepancy (success-mismatch, latency-divergence, cost-divergence), and updates `vessel_trust_score` rolling stats.
- [ ] 1a.5 (`metabob-activity-api`) Gate Thompson updates at `execution-traces.ts:1306` and `:1579`: skip rows whose vessel's trust score is below threshold; rows persist for observability. Threshold and feature flag are configurable. Depends on 1a.4.
- [ ] 1a.6 (`metabob-activity-api`) Verify Ed25519 signatures on ingest. Pubkey is read from discovery-vessel's registry (depends on H2 / task 2.1). Until H2 lands, accept unsigned traces with `unsigned: true`.
- [ ] 1a.7 (`metabob-activity-api`) Tests: invoker-only view persists; invoked-only view persists; pair joins on `correlation_id`; discrepancy detection; trust score gate excludes posterior updates. Tests in `repos/metabob-activity-api/test/routes/execution-traces.test.ts`.

### 1b. MiniBob trace emission

- [ ] 1b.1 (`minibob`) In `repos/minibob/src/activity.ts` trace-emission path, sign the canonical-form digest of each `impulse_resolutions[]` row and the trace-level header. Use the vessel's Ed25519 key (introduced in H2).
- [ ] 1b.2 (`minibob`) Emit invoked-view traces from each cross-vessel resolver call site (e.g. `callVesselResolve`) — the local vessel that *received* the call submits its own view, signed.
- [ ] 1b.3 (`minibob`) Tests: invoker view emitted with correct signature; invoked view emitted with correct signature when vessel acts as invoker of another; legacy unsigned mode still works behind feature flag.

### 1c. Other vessels

- [ ] 1c.1 (cross-vessel) Each vessel that exposes resolvers (concept-db, conversation-vessel, identity-vessel, future vessels) emits an invoked-view trace per cross-vessel call it receives. Implementation is per-vessel; spec is here.

## 2. Hardening H2 — Vessel-id derived from pubkey

- [ ] 2.1 (`discovery-vessel`) Extend `RegisterRequest` in `repos/discovery-vessel/src/types.ts` with `pubkey: string`, `signature: string`, `nonce: string`, `signed_at: number`. Deprecate (but keep) the existing `vesselId` field — the deprecation path is "the value MUST equal the multihash of `pubkey`".
- [ ] 2.2 (`discovery-vessel`) In `repos/discovery-vessel/src/registry.ts` register handler, add `verifyVesselIdentity(req)` step before TTL/heartbeat: verify (a) `vessel_id == base32(multihash(SHA-256, pubkey))`, (b) signature verifies under `pubkey` over `{vessel_id, signed_at, registry_endpoint, nonce}`, (c) `signed_at` within ±60s of registry clock, (d) nonce unseen for this vessel-id in the last 10 min.
- [ ] 2.3 (`discovery-vessel`) Persist `pubkey` on the vessel record so heartbeat/deregister verification doesn't re-fetch.
- [ ] 2.4 (`discovery-vessel`) Heartbeat (`POST /heartbeat`) and deregistration (`DELETE /vessels/:id`) accept fresh signed challenges; verify against stored pubkey.
- [ ] 2.5 (`discovery-vessel`) Reject re-registration where `vessel_id` matches an existing record but `pubkey` differs (TOFU semantics for v1; explicit pubkey rotation deferred).
- [ ] 2.6 (`discovery-vessel`) Add `enforcement: "log_only" | "reject"` config; default `log_only` for first release, flip to `reject` after migration.
- [ ] 2.7 (`minibob`) Generate Ed25519 keypair at vessel start; persist in vessel data dir, sealed with API key. Compute `vessel_id` from pubkey; replace any hardcoded `vessel_id` with the derived value.
- [ ] 2.8 (`minibob`) Sign challenges for register / heartbeat / deregister.
- [ ] 2.9 (cross-vessel) Same key-management and signing pattern in concept-db, conversation-vessel, identity-vessel registration flows.
- [ ] 2.10 Tests: invalid pubkey-vesselid mismatch rejected; invalid signature rejected; expired challenge rejected; replayed nonce rejected; pubkey persisted across heartbeat; pubkey-mismatch on re-register rejected.

## 3. Hardening H3 — EIP-712-style signed scope attestations

- [ ] 3.1 (`metabob-activity-api`) Define the `ScopeAttestation` zod schema in `repos/metabob-activity-api/src/models/schemas.ts`: `{ issuer, audience, scope_hash, nonce, deadline, domain: { name, version, issuer_org_id }, signature }`. Domain separator constant `name: "metabob-scope"`, `version: "1"`.
- [ ] 3.2 (`metabob-activity-api`) Implement typed-data digest function: `SHA-256("\x19\x01" || domain_separator_hash || struct_hash)`. Adopts EIP-712 framing using SHA-256 to keep within the project's hash family.
- [ ] 3.3 (`metabob-activity-api`) New SurrealDB migration adding `scope_nonce_state[(issuer, audience)] = { last_seen_nonce: uint64 }`.
- [ ] 3.4 (`metabob-activity-api`) In the impulse-write path of `repos/metabob-activity-api/src/routes/impulses.ts`, when an impulse's shape is in the configured scope-bearing list (initially `["scopeContext"]`), require an attached `ScopeAttestation`; verify signature, audience binding, deadline, monotonic nonce. Reject with structured error on any failure.
- [ ] 3.5 (`metabob-activity-api`) Nonce update via SurrealDB CAS keyed by `(issuer, audience)` to handle multi-replica activity-api.
- [ ] 3.6 (`identity-vessel`) Issue a short-lived "user signing key" tied to the user's session for the `issuer = user` case. Endpoint shape and lifetime follow existing JWT issuance patterns in `repos/identity-vessel/`.
- [ ] 3.7 (`minibob`) When emitting a `scopeContext` impulse, attach a `ScopeAttestation` signed by the issuer's key. Issuer = activity-driving entity (vessel for vessel-issued, user-session-key for user-issued).
- [ ] 3.8 Tests: valid attestation accepted; bad signature rejected; wrong audience rejected; expired deadline rejected; replayed nonce rejected; missing attestation on scope-bearing shape rejected; non-scope-bearing shapes pass through unaffected.

## 4. Hardening H4 — Tailnet-Lock-equivalent for vessel registration

### 4a. Identity-vessel — authority key state and AUM log

- [ ] 4a.1 (`identity-vessel`) New schema in `repos/identity-vessel/sql/`: `org_authority_keys` (per-org current state: keys, threshold, n, disablement_secret_hashes), `authority_update_messages` (append-only log of AUMs).
- [ ] 4a.2 (`identity-vessel`) New endpoints `GET /org/:org_id/authority-state` (signed snapshot of current keys + threshold) and `POST /org/:org_id/authority-update` (submit AUM, verify against current threshold, append log entry, advance state).
- [ ] 4a.3 (`identity-vessel`) Bootstrap flow extension: org-provisioning script (existing scripts under `repos/identity-vessel/scripts/`) seeds initial authority keys and disablement secret hashes from out-of-band input.
- [ ] 4a.4 (`identity-vessel`) Disablement endpoint: present a pre-image whose hash is in `disablement_secret_hashes`; flag the org as disabled until manual recovery.
- [ ] 4a.5 (`identity-vessel`) Three deployment modes (customer-held, identity-vessel-held in HSM, operator-held). Mode is per-org config; spec defines all three; first release ships with operator-held for existing orgs.

### 4b. Discovery-vessel — endorsement gate

- [ ] 4b.1 (`discovery-vessel`) `RegisterRequest` extension: optional `authority_endorsements: AuthorityEndorsement[]` where each endorsement is `{ key_id, signature }` over the registration's canonical-form digest.
- [ ] 4b.2 (`discovery-vessel`) `verifyAuthorityEndorsements(org_id, payload, endorsements)` helper: fetch authority state from identity-vessel (cached ≤30s), verify each endorsement's signature, count distinct valid endorsements against threshold.
- [ ] 4b.3 (`discovery-vessel`) Determine "high-risk registration" by intersecting requested `shapes` with shapes tagged `risk_tier: "high"` in `toolRiskProfile`. High-risk registrations require endorsements meeting threshold; others proceed without endorsement.
- [ ] 4b.4 (`discovery-vessel`) Reject high-risk registration without sufficient endorsements; log + accept (depending on enforcement mode flag) for transition.

### 4c. Tests

- [ ] 4c.1 Tests: low-risk registration without endorsements accepted; high-risk without endorsements rejected (under enforce mode); high-risk with k-of-n endorsements accepted; AUM log append-only; bootstrap establishes initial state; disablement flag blocks high-risk registrations until cleared.

## 5. Hardening H5 — Immutable-baseline selector with auto-regression

- [ ] 5.1 (`metabob-activity-api`) Extend activity-template schema in `repos/metabob-activity-api/src/models/schemas.ts` with `baseline: boolean`, `parent_variant_id?: string`, `quarantined: boolean`, `quarantined_at?: timestamp`, `quarantine_reason?: string`.
- [ ] 5.2 (`metabob-activity-api`) New SurrealDB migration `<next>-baseline-and-quarantine.surql` adding the fields and a `baseline_promotion_log` table.
- [ ] 5.3 (`metabob-activity-api`) On variant creation, set `baseline: false`, `parent_variant_id: <forked_from>`. Forbid mutation of any variant where `baseline: true` (write-protected at PERMISSIONS layer).
- [ ] 5.4 (`metabob-activity-api`) Promotion endpoint `POST /v2/activities/:id/promote-to-baseline` requires AUM-style authority signatures meeting org threshold; appends to `baseline_promotion_log`; flips baseline pointer atomically.
- [ ] 5.5 (`metabob-activity-api`) Auto-regression scan (cron, e.g. every 5 min): for each non-baseline variant, compute rolling-window failure rate over last N invocations from `activity_execution_traces`; if above threshold, set `quarantined: true` with reason. Hysteresis on un-quarantine (manual operator action only in v1).
- [ ] 5.6 (`metabob-activity-api`) Filter quarantined variants out of `POST /v2/activities/recommend` and `GET /v2/activities/:id/variant-scores` candidate sets, and out of Thompson updates at `repos/metabob-activity-api/src/routes/execution-traces.ts:1306` / `:1579`.
- [ ] 5.7 (`metabob-activity-api`) One-time backfill: tag each family's most-used variant `baseline: true`. Backfill script under `repos/metabob-activity-api/scripts/`.
- [ ] 5.8 Tests: baseline write-protected; quarantine excludes from selection; promotion requires authority signatures meeting threshold; rolling-window scan flags variants above threshold; un-quarantine is operator-only.

## 6. Cross-cutting CC1 — Scope-narrowing on composition

- [ ] 6.1 (`minibob`) Adopt the `scope_set` schema as defined by sibling spec `2026-04-26-shape-provider-goal-creation`. At child-activity dispatch (the same hook in `repos/minibob/src/activity.ts` that fires the nested-execution lifecycle event), call `verifyScopeNarrowing(parent.scope_set, child.scope_set)`. Reject child invocation on violation.
- [ ] 6.2 (`minibob`) On violation, write the trace with `failure_mode: { type: "safety_breach", context: { breach_type: "scope_widening", limit: <parent.scope_set>, attempted: <child.scope_set>, ancestor_chain } }` per the in-flight `validators-and-failure-modes` taxonomy.
- [ ] 6.3 (`minibob`) Tests: child with subset scope dispatches; child with superset scope rejected; child with disjoint scope rejected; failure_mode populated correctly.

## 7. Cross-cutting CC2 — Risk-graded dispatch

- [ ] 7.1 (`discovery-vessel`) Add `attestation_tier: "none" | "api_key" | "external_attested"` field to vessel records. Computed at registration time based on the credentials presented.
- [ ] 7.2 (`discovery-vessel`) Accept and verify three external attestation types: k8s service-account token (verify via cluster TokenReview), git OIDC (verify against well-known JWKS for GitHub Actions / GitLab CI), identity-vessel-issued member token.
- [ ] 7.3 (`discovery-vessel`) Filter `/resolve` responses by `min_attestation_tier`. Shapes tagged `risk_tier: "high"` in `toolRiskProfile` set `min_attestation_tier: "external_attested"`.
- [ ] 7.4 (`identity-vessel`) Issue member tokens — short-lived assertions tied to a specific user/org/role. Verifiable by discovery-vessel.
- [ ] 7.5 (`minibob`) `callVesselResolve` already honors discovery-vessel filtering per `CLAUDE.md` 2026-04-24; no behaviour change required, but extend its tests to cover the attestation-tier filter.
- [ ] 7.6 Tests: vessel without attestation cannot serve high-risk shapes; vessel with k8s SA token can; vessel with git OIDC token can; vessel with member token can; api_key-only tier blocked from high-risk shapes under enforce mode.

## 8. Verification

- [ ] 8.1 `bun run typecheck` in each affected repo (`discovery-vessel`, `minibob`, `metabob-activity-api`, `identity-vessel`) — zero new errors.
- [ ] 8.2 `bun test` in each affected repo — all new tests pass; existing suites remain green.
- [ ] 8.3 Canary smoke (against `https://activity.metabob.com`): register a vessel under H2; emit a two-sided trace under H1; verify the pairing job populates `vessel_trust_score`; verify Thompson updates respect the gate when trust score is low.
- [ ] 8.4 Canary smoke (H4): register a high-risk shape without endorsements under enforce mode; expect rejection. Register with sufficient endorsements; expect acceptance.
- [ ] 8.5 Canary smoke (H5): create a variant; quarantine it via the auto-regression scan after enough failures; verify it is excluded from `recommend` output. Promote a new variant to baseline via signed AUM; verify the baseline pointer flips.
- [ ] 8.6 Integration: replay an existing failing scenario from the prior security audit (registration spoof, single-sided poisoned trace, scope-widening child) under enforcement mode; expect each path to be blocked with a structured error.

## 9. Sequencing notes (cross-task dependencies)

- H2 (§2) blocks H1 (§1): trace signatures need vessel keys.
- CC1 (§6) blocks `2026-04-26-shape-provider-goal-creation`'s safety story.
- H1 (§1) blocks `2026-04-26-impulse-binding-selection-layer` from being safe under adversarial vessels.
- H4 (§4) and H5 (§5) chain: promotion-to-baseline (H5) reuses the AUM-signature primitive from H4. Implement H4 first.
- H3 (§3) standalone but pairs naturally with the goal-creation spec's scope-as-impulse landing.
- CC2 (§7) standalone; ship in any order.
