## Context

The system has three trust-bearing surfaces today, all of which accept claims at face value:

1. **`POST /register`** at `repos/discovery-vessel/src/index.ts` (handler dispatched through `registry.ts`) — accepts `vesselId`, `shapes`, and resolver-contract metadata. Authentication is "valid org API key"; identity is "whatever string the caller put in `vesselId`".
2. **`POST /v2/activities/execution-traces`** at `repos/metabob-activity-api/src/routes/execution-traces.ts:856` — accepts the executor's narrative of an execution including which vessels were called, success/failure, costs, and per-task `impulse_resolutions`. The trace is the substrate for Thompson Sampling updates at `:1306` and `:1579`.
3. **Composition chain** carried on every trace as `composition_chain: string[]` (root-first) plus `parent_execution_id`. The chain encodes lineage but not scope; a descendant inherits no constraint from its ancestors beyond what each call site enforces ad-hoc.

The in-flight selection-layer change (`2026-04-26-impulse-binding-selection-layer`) makes both `impulse_pool_selection` and `producer_selection` Thompson-Sampled, with α/β tracked per `(shape, taskId)` for impulses and per `(producer_activity_id, predecessor_activity_id)` for producers. The posteriors are read from `impulseRelevance` and `compositionSuccess`; both ultimately derive from execution traces. A vessel that controls its own trace stream controls its routing weight.

This design proposes five primitives, each with a production precedent, that close these gaps. None of the primitives is novel — every cryptographic construction (Ed25519 signatures, multihash, append-only signed log, monotonic nonces, typed-data digests, k-of-n threshold) is what the cited system uses. We translate the construction into our data model and call out the friction.

## Goals / Non-Goals

**Goals**

- Make trace ingestion accountable: a trace that affects Thompson Sampling must be corroborated by both endpoints of every cross-vessel call it describes.
- Bind `vessel_id` to a cryptographic identity, so a registration payload claiming a vessel-id implies possession of the matching private key.
- Give scope claims an attestation chain: a child activity carrying a `scopeContext` impulse carries a signature proving the issuer authorised the scope for the named audience, with replay defense.
- Limit the blast radius of discovery-vessel compromise: registration changes for high-risk shapes must be cross-signed by customer-held authority keys.
- Prevent self-update from breaking selection globally: every resolver family has an immutable baseline, and Thompson Sampling cannot route around it permanently.
- Codify two cross-cutting invariants — scope narrowing on composition, and risk-graded dispatch — so future specs and code branches inherit the constraint.

**Non-Goals**

- Implementation. This is a spec-only change.
- Hardware-rooted attestation of vessels (TPM, Secure Enclave). Discussed under risk-graded dispatch as a destination state, not as the v1 contract.
- Adversarial-Thompson defense beyond two-sided traces (e.g. anomaly detection on posterior shifts).
- Key rotation procedures and recovery flows beyond the break-glass disablement secrets.
- Replacing API-key auth on read paths. The hardenings layer on top; existing API-key auth (per `repos/identity-vessel/`) remains the primary identity for human-driven calls.
- Defining the `toolRiskProfile` schema. This change *consumes* it as already-existing per `CLAUDE.md`'s impulse-shape list; refining the schema is left to its owner.

## Decisions

### H1: Two-sided execution traces

**Problem.** `POST /v2/activities/execution-traces` at `repos/metabob-activity-api/src/routes/execution-traces.ts:856` accepts the executor's word. The executor is also the writer. A misbehaving vessel can claim it called another vessel, or claim success for a call it never made, and the posterior reads it as ground truth. Under the in-flight selection layer, this turns into routing control: a vessel that lies about its own success rate sees more traffic.

**Borrowed mechanism.** BitTorrent private-tracker stat-fake detection. Private trackers (e.g. early IPTorrents, Demonoid implementations) detect uploaders falsifying upload counts by cross-correlating their reports with peers' download reports — both sides report what they exchanged, the tracker spots systematic mismatch and downgrades the cheater. The construction is symmetric reporting plus aggregate-statistical detection; no per-call cryptographic proof is required, only signed identity on each side.

**Translation.** Extend the trace schema:

- Each trace identifies the **invoker** (the vessel emitting the trace) and, for every entry in `impulse_resolutions`, the **invoked vessel** (`vessel_id` already present). Both endpoints carry an Ed25519 signature over a canonical-form digest of the per-call record (impulse_id, resolver_id, latency_ms, cost_usd, success, output_impulse_ids).
- Activity-api stores both views in two new tables (or, more cheaply, one table with a `view: "invoker" | "invoked"` discriminator): `execution_trace_views`. The existing `activity_execution_traces` row is the **invoker view** by default; the **invoked view** is submitted independently by the invoked vessel via the same endpoint with `view: "invoked"`.
- A pairing job (cron or on-write) joins views by `(correlation_id, impulse_id)` and computes per-pair discrepancy: success/failure mismatch, latency divergence beyond a tolerance, cost divergence beyond a tolerance.
- A `vessel_trust_score` field (per-vessel rolling discrepancy rate) gates Thompson eligibility. Posterior updates at `execution-traces.ts:1306` and `:1579` SHALL skip rows whose trust score falls below threshold; the rows persist for observability but do not move α/β.

**Friction.** Tracker stat-fake works at low call volume (BT swarms are seconds-to-minutes per piece); our cross-vessel call rate is much higher. Signing every call adds CPU and storage. **Mitigation**: signatures are Ed25519 (≈20 µs sign, ≈70 µs verify on commodity hardware); both sides amortise by signing a Merkle root per N calls and submitting the leaf-and-proof per row. The pairing job is asynchronous; latency on the hot path is just the signing cost.

**Migration.** New traces from updated vessels carry signatures; legacy traces are flagged `unsigned: true` and remain admissible to Thompson updates *only* if a feature flag allows them. Once flag is flipped, unsigned traces become observability-only.

**Open questions.**
- Threshold for `vessel_trust_score` discrepancy rate before downgrade — needs calibration data, not pickable up-front. Lean: log-only for first month, then start excluding rows above (say) 5% mismatch.
- What constitutes "the invoked vessel" for purely local resolutions (memo, file, gitDiff)? Lean: invoker self-pairs (signs both sides with the same key); pair pass-through.
- Does a single-sided trace count for activity-level success metrics that are *not* Thompson? Lean: yes — observability dashboards can show what was claimed; only the learning loop is gated.

### H2: Vessel-id derived from pubkey

**Problem.** `vesselId` in `repos/discovery-vessel/src/types.ts` is a free-form string. Registration in `registry.ts` is keyed on it. Any caller with a valid org API key can register claiming any vessel-id and any shape (prior audit, finding 1). The composability of impersonation with the Thompson posterior makes this a routing attack: register as the vessel for a high-traffic shape, drain calls.

**Borrowed mechanism.** IPFS PeerID and Tailscale node identity. Both derive their network-level identifier from a hash of the node's public key (`PeerID = multihash(pubkey)` in IPFS; `nodeKey = curve25519(pubkey)` in Tailscale). Any node can self-mint an identifier; the network protocol challenges proof-of-possession on first contact.

**Translation.**

- Vessels generate an Ed25519 keypair at provisioning time (or at first registration). The keypair is held by the vessel, not by identity-vessel.
- `vessel_id = base32(multihash(SHA-256, pubkey))`. The format mirrors libp2p PeerID: a self-describing multihash.
- The `POST /register` payload carries the public key and a self-signed challenge: a signature over `{vessel_id, current_unix_time, registry_endpoint, nonce}`. The registry verifies (a) `vessel_id` derives from `pubkey`, (b) signature verifies under `pubkey`, (c) `current_unix_time` is within ±60s of the registry's clock, (d) nonce has not been seen for this vessel-id in the last 10 minutes.
- Heartbeats and deregistrations include a fresh signed challenge. Re-registering with the same vessel-id but a different pubkey is rejected (TOFU on first registration; explicit pubkey rotation is a separate flow not covered here).

**Translation, code references.**
- `repos/discovery-vessel/src/types.ts` — extend `RegisterRequest` with `pubkey: string`, `signature: string`, `nonce: string`, `signed_at: number`.
- `repos/discovery-vessel/src/registry.ts` — add a `verifyVesselIdentity(req)` step before the existing TTL/heartbeat logic. Pubkey is stored alongside the vessel record so subsequent calls can verify against it without re-fetching.
- `repos/discovery-vessel/src/middleware/` — the existing API-key middleware stays; pubkey verification is a second gate, not a replacement (API key authorises *who* can register *for what org*; pubkey proves *which vessel* the registration is for).

**Friction.** Vessels need somewhere to store private keys. **Mitigation**: in-memory keys are acceptable for ephemeral vessels (e.g. minibob workers); persistent vessels use a file under the vessel's data directory, sealed with the existing API key as the encryption key. Long-term: integrate with k8s `Secret` for in-cluster vessels, with a hardware-backed store for off-cluster vessels.

**Migration.** Vessels register with both fields during the migration window. Discovery-vessel runs in `enforcement: "log_only"` mode first; offending registrations are logged but allowed. Flip to `enforcement: "reject"` when all known vessels have updated. The list of known vessels is the existing `registry/stats` output.

**Open questions.**
- Does the pubkey ever appear on the wire to other vessels (so they can verify signatures on cross-vessel calls), or does the registry mediate? Lean: pubkey is queryable from `/resolve` responses; verification is end-to-end, not registry-mediated.
- Pubkey rotation: how does a vessel re-key without losing its `impulseRelevance` history (which is keyed by the impulse-id, not the vessel, but adjacent metadata is)? Lean: out-of-scope here; designed-in-followup.

### H3: EIP-712-style signed scope attestations

**Problem.** Scope claims today are implicit in vessel metadata and untyped. The in-flight `shape-provider-goal-creation` and `impulse-binding-selection-layer` specs both push scope through the activity DAG as impulse-shaped data. Without typed signatures, scope claims can be forged by any vessel that writes impulses, and replay defense is absent.

**Borrowed mechanism.** Three converging precedents:

- **EIP-712** (Ethereum) — typed structured data signed with a domain separator (`{name, version, chainId, verifyingContract}`) and a message struct hash. Replay defense via per-account nonces. The signature commits to a precise type schema, not a free-form string.
- **BEP-44** (BitTorrent) — mutable DHT records signed by the publisher's key with a monotonic sequence number. The DHT enforces sequence monotonicity per `(salt, publisher)`.
- **Apple App Attest** — server issues an attestation that carries an audience binding (the server's app-id) and an expiry, and is single-use per challenge.

**Translation.** A `scopeContext` impulse SHALL carry an attestation envelope:

```
ScopeAttestation = {
  issuer: vessel_id,           // who is granting the scope
  audience: vessel_id,         // who may exercise it
  scope_hash: bytes32,         // sha256 of canonical-form scope claim
  nonce: uint64,               // monotonic per (issuer, audience)
  deadline: unix_timestamp,    // absolute expiry
  domain: {
    name: "metabob-scope",
    version: "1",
    issuer_org_id: string,
  },
  signature: bytes,            // Ed25519 over typed-data digest
}
```

The typed-data digest is computed exactly as EIP-712 prescribes: `keccak256("\x19\x01" || domain_separator_hash || struct_hash)`, except using SHA-256 to keep us inside the Ed25519 / multihash family already chosen for H2.

Verification happens at **impulse-write time**, not impulse-resolve time:
- The impulse-resolve path at `repos/metabob-activity-api/src/routes/impulses.ts` (and any future scope-aware path) reads the attestation and rejects the impulse if the signature is invalid, the audience does not match the consumer, the deadline has passed, or the nonce is not strictly greater than the last-seen nonce for `(issuer, audience)`.
- The "impulse-write time" framing matters: validating once on ingest is cheaper than re-validating on every read, and the alternative (validating on read) leaks scope to any reader that gains read access.

A new table `scope_nonce_state` (or a Redis structure) tracks `last_seen_nonce[(issuer, audience)]`. Long-lived sessions cannot reuse a single attestation: each child invocation needs its own attestation with a fresh nonce.

**Friction.** EIP-712's domain separator assumes a fixed contract verifier; we have a fleet of consumers. **Mitigation**: the domain separator is `{name: "metabob-scope", version, issuer_org_id}` — same separator across all consumers within an org. Cross-org scope attestation is intentionally out of scope (orgs are a tenancy boundary, not a trust boundary across).

**Friction.** BEP-44 monotonic-nonce enforcement assumes a single coordinator; we have multiple activity-api replicas. **Mitigation**: use a SurrealDB CAS update on `scope_nonce_state` keyed by `(issuer, audience)`; replicas compete fairly.

**Migration.** Scope attestation is opt-in for the first release: impulses without an attestation are processed as today. Once the in-flight scope-as-impulse spec lands, the attestation requirement flips to mandatory for shapes that name a scope (e.g. `scopeContext`, future shape names that the goal-creation spec defines). Other shapes are unaffected.

**Open questions.**
- What's the canonical form for the `scope_hash` preimage? Lean: a JSON-canonicalisation per RFC 8785 of the scope object, hashed with SHA-256. Concrete form pinned in the spec when the scope object schema is finalised by the goal-creation spec.
- Where does the signing key live for issuer = `user`? An end-user issuing scope to a vessel they invoke is the natural case. Lean: identity-vessel issues a short-lived "user signing key" tied to the user's session; the user's session key signs the attestation.

### H4: Tailnet-Lock-equivalent for vessel registration

**Problem.** Discovery-vessel is a singleton and the trust root for routing. Compromise of discovery-vessel = full fleet misroute, regardless of H2's vessel-id binding (an attacker who controls the registry can register a colluding vessel-id whose pubkey they hold). Routing attacks of this kind have been observed in production (BGP hijacks, package-registry compromises).

**Borrowed mechanism.** Tailscale Tailnet Lock (TKA). Customer-held Authority Keys cross-sign every node-key change; the key set evolves as an append-only log of cross-signed Authority Update Messages (AUMs). Every consumer verifies the log independently. Quorum (k-of-n) is required for AUMs that affect high-risk operations. Bootstrap requires the initial authority key set to be specified out-of-band; ≥2 disablement secrets serve as break-glass.

**Translation.**

- A new resource owned by identity-vessel: `org_authority_keys[(org_id)] = { keys: [...], threshold: k, n: total, disablement_secret_hashes: [...] }`. Defined out-of-band at org provisioning; rotated via signed AUMs.
- Discovery-vessel's `POST /register` accepts an additional field `authority_endorsements: AuthorityEndorsement[]` for high-risk registrations. Each endorsement is a signature by an authority key over `{vessel_id, shapes, resolver_contract_hash, registered_at}`. The registry verifies that endorsements meet the org's threshold before accepting the registration.
- "High-risk registration" is defined as: a registration whose `shapes` intersect with any shape marked `risk_tier: "high"` in `toolRiskProfile`. Other registrations proceed without endorsements (the rest of the system protects them via H1, H2, H3).
- Authority-key changes themselves are AUMs: a signed message saying "add key K", "remove key K", "raise threshold to k+1", "rotate key K to K'". The AUM log is an append-only table `authority_update_messages` queryable by every vessel; vessels verify the chain back to the bootstrap key set on first sync and incrementally afterward.
- Disablement: an emergency disable of the entire authority requires presenting a disablement secret pre-image whose hash is in `disablement_secret_hashes`. Two secrets are configured at bootstrap; presenting one suffices to enter "disabled" mode in which all high-risk registrations are blocked until an out-of-band recovery flow runs.

**Translation, code references.**
- `repos/identity-vessel/` — new tables for `org_authority_keys` and `authority_update_messages`; new endpoints `GET /org/:org_id/authority-state` and `POST /org/:org_id/authority-update`. Bootstrap flow extends the existing org-provisioning script.
- `repos/discovery-vessel/src/registry.ts` — `register()` takes the optional `authority_endorsements` field; calls a new `verifyAuthorityEndorsements(org_id, registration_payload, endorsements)` helper that fetches the org's authority state from identity-vessel (with cache).
- The cache TTL is short (≈30s) to bound the staleness of authority-key rotations.

**Friction.** Tailnet Lock assumes a small node count (dozens, hundreds). Our trace-write rate is much higher than node-key-change rate, but registrations are rare (~once per vessel per process lifetime). **Mitigation**: this hardening targets registrations and AUMs only — the trace ingest path is not gated. Authority key set is small (typically 3-5 keys); verification cost per registration is k Ed25519 verifies, not amortisable but tolerable on a rare path.

**Friction.** Customer-held keys assume the customer is operationally capable of holding keys. **Mitigation**: multiple deployment modes — (a) customer holds keys (highest assurance), (b) identity-vessel holds keys on the customer's behalf in a customer-scoped HSM-backed key (medium assurance), (c) operator holds the keys (lowest assurance, identical to today). Mode is per-org config; spec defines all three.

**Migration.** First release ships with mode (c) for all existing orgs (zero functional change, AUM log starts empty). New orgs default to mode (b). Migration to (a) is a customer-initiated rotation flow.

**Open questions.**
- Does the AUM log need its own consensus (e.g. published to a public transparency log) so a colluding identity-vessel + discovery-vessel pair cannot quietly rewrite history? Lean: yes for mode (a) — surface the AUM log via a customer-facing read endpoint and let customers run their own verifier. Out-of-scope for mode (c).
- What is "high risk" beyond `toolRiskProfile`? Are there registrations (e.g. `compositionSuccess` writer) that should require endorsement even though their shape isn't tagged high-risk? Lean: defer; allow per-org config to expand the gated-shape list.

### H5: Immutable-baseline selector with auto-regression

**Problem.** Self-update activities can ship variants of selection resolvers (e.g. `vessel_select`, the new `producer_selection` from the in-flight binding spec, the `variant_selection` resolver already in `repos/minibob/src/resolvers/variant-selection-resolver.ts`). If a variant has a high success rate in its training period but a failure mode that surfaces only at scale, Thompson Sampling will route to it before the failure is visible, and the system has no mechanism to fall back without human intervention.

**Borrowed mechanism.** Three converging precedents:

- **OpenZeppelin TimelockController** — every privileged action goes through a delay queue; a guardian role can cancel within the delay. Trust-but-verify pattern with a cooling-off window.
- **UUPS namespaced storage** — upgradeable contracts isolate storage in a dedicated namespace, with the upgrade mechanism guarded such that the prior storage layout (and prior logic baseline) cannot be erased.
- **Play Integrity server-side verdict** — the server, not the device, is the source of truth on whether a request is acceptable; the device cannot self-attest its way past server policy.

**Translation.**

- Every resolver family (e.g. `producer_selection`, `variant_selection`, `validator_dispatch`) has exactly one variant marked `baseline: true`. This variant is the immutable fallback. Its config and code are content-addressed (hash on registration); subsequent edits create a new variant, never mutate the baseline.
- New variants have `baseline: false` and `parent_variant_id` set to the variant they fork from. Promotion to `baseline: true` is a privileged action requiring authority-key signature (chains to H4).
- Auto-regression: a per-variant rolling-window metric (e.g. last 1000 invocations) tracks failure rate. If a non-baseline variant exceeds a threshold (configurable per family, default 25%), the variant is flagged `quarantined: true`. Thompson Sampling SHALL skip quarantined variants. Operators can un-quarantine after investigation.
- Quarantine is per-org for org-scoped variants; system-wide for system-scoped variants.
- The Thompson Sampling code path at `repos/metabob-activity-api/src/routes/execution-traces.ts:1306` and `:1579`, plus the variant-score read paths consumed by `getVariantFamilyScores` (per `CLAUDE.md` 2026-04-24 fix), SHALL exclude quarantined variants from the candidate set.
- Promotion-to-baseline is an AUM-signed action recorded in a new `baseline_promotion_log` for each resolver family. The current baseline at any point is the most recent log entry that has not been superseded.

**Translation, code references.**
- `repos/metabob-activity-api/src/models/schemas.ts` — extend the activity-template schema with `baseline: boolean`, `parent_variant_id?: string`, `quarantined: boolean`, `quarantined_at?: timestamp`, `quarantine_reason?: string`.
- New SurrealDB migrations for the schema fields and a `baseline_promotion_log` table.
- `repos/metabob-activity-api/src/routes/activities.ts` — `POST /v2/activities/recommend` and the variant-scores read paths filter out quarantined variants. The auto-regression scan is a periodic job (cron) reading rolling-window stats from `activity_execution_traces`.
- `repos/minibob/src/resolvers/variant-selection-resolver.ts` — its sampling pool consumes the filtered candidate set from the route; no change to the resolver beyond reading the new fields.

**Friction.** Auto-regression on a rolling window can oscillate at the threshold edge. **Mitigation**: hysteresis — a quarantined variant must demonstrate (say) 1000 invocations of human-driven re-test under the threshold before it un-quarantines. No automatic un-quarantine.

**Friction.** A bad baseline is unreachable by auto-regression (it never quarantines itself). **Mitigation**: baselines are the operator-vetted floor. If the baseline itself is bad, the only recovery is a baseline-promotion AUM. This is the design intent — the baseline cannot be auto-overridden, only ever replaced by an authority-signed promotion.

**Migration.** Existing variants are tagged `baseline: true` for the most-used variant in each family at migration time (one-time backfill). New variants henceforth inherit `baseline: false`. Quarantine is opt-in per family until calibrated.

**Open questions.**
- What's the right rolling-window size for auto-regression? Probably differs by family (selection resolvers fire often, validator-dispatch fires per task, producer-selection fires only on missing shapes). Lean: per-family default with override.
- Should promotion-to-baseline require a delay (TimelockController-style), not just an authority signature? Lean: yes — 24h delay between AUM submission and effect, so a colluding authority signer can be cancelled by another. Defer the delay-cancel mechanism design.

### Cross-cutting invariants

#### CC1: Scope-narrowing on composition

**Problem.** A child activity's `composition_chain` carries lineage but not scope. A descendant can in principle act with broader scope than its parent intended (prior audit, finding 3). Combined with the in-flight goal-creation spec, this means a child goal could carry a scope unrelated to (and broader than) the goal that spawned it.

**Borrowed mechanism.** UCAN (User Controlled Authorization Network) delegation chains and Solidity reentrancy guards. Both encode the invariant *child capability ⊆ parent capability*. UCAN does it via cryptographic delegation chains; Solidity does it locally via state guards that prevent a callee from re-entering the caller with elevated privilege.

**Translation.** Every activity execution carries a `scope_set: ScopeClaim[]` (defined by the in-flight goal-creation spec; this design adopts whatever schema that spec lands on). At child-activity creation, the executor SHALL verify `child.scope_set ⊆ parent.scope_set`. The verification is structural: for each scope claim in `child.scope_set`, an equal-or-broader claim must exist in `parent.scope_set`. Subset semantics are scope-claim-specific (this spec does not pin them).

The check happens at the same place the lifecycle event for nested-execution dispatch fires — currently per the nested-execution path discussed in `2026-04-26-impulse-binding-selection-layer/design.md` D1 — so it is automatic for every child invocation regardless of how the child is dispatched.

A scope-narrowing violation results in `failure_mode: { type: "safety_breach", context: { breach_type: "scope_widening", limit: <parent.scope_set>, ... } }` per the in-flight `validators-and-failure-modes` spec's taxonomy.

**Open question.** Subset semantics for scope claims need a real definition once the goal-creation spec finalises the scope schema. The invariant is what this spec asserts; the precise check is downstream.

#### CC2: Risk-graded dispatch

**Problem.** High-risk shapes (per `toolRiskProfile`) today dispatch to whichever vessel happens to advertise the shape. A vessel with weak attestation can claim a high-risk shape and act on it.

**Borrowed mechanism.** k8s Pod Security Standards (PSS) — Restricted, Baseline, Privileged tiers gate pods by capability. Tailscale exit-node two-party consent — accepting an exit-node route requires explicit consent on both sides.

**Translation.** Every vessel carries an `attestation_tier: "none" | "api_key" | "external_attested"`. The third tier is reached by:

- presenting a k8s service-account token that the discovery-vessel verifies against the cluster's TokenReview endpoint, OR
- presenting a git OIDC token signed by GitHub Actions / GitLab CI, OR
- presenting an identity-vessel-issued **member token** (an explicit per-user assertion that the human operating the vessel is a member of the org with sufficient role).

A shape's dispatch eligibility is `min_attestation_tier`. Shapes tagged `risk_tier: "high"` in `toolRiskProfile` SHALL set `min_attestation_tier: "external_attested"`. The discovery-vessel's `/resolve` endpoint filters returned vessels by this tier; minibob's contract-driven `callVesselResolve` (per `CLAUDE.md` 2026-04-24) honors the filter as an additional precondition.

**Friction.** Not every deployment has a k8s SA / git OIDC available. **Mitigation**: identity-vessel-issued member tokens are always available as a path — they require a human-in-the-loop assertion at issuance, which is the security property we want for high-risk shapes anyway.

**Migration.** Existing vessels start at `attestation_tier: "api_key"`. High-risk shapes are temporarily exempt from the gate (log-only enforcement) for a transition window; flip to enforce once known vessels have upgraded their attestation.

## Sequencing

Of the five hardenings, **H1 (two-sided traces) is a precondition for `2026-04-26-impulse-binding-selection-layer`**. The reason is direct: the selection layer makes routing decisions a function of α/β posteriors that the trace stream feeds. Without two-sided traces, a vessel that controls its own narrative controls its routing weight, and the selection layer ships the attack surface.

The other hardenings can land in parallel or after the binding spec:

- H2 (vessel-id from pubkey) addresses registration spoofing, which is orthogonal to selection. It can land before, during, or after the binding spec without coupling.
- H3 (signed scope attestations) addresses scope claims that the goal-creation spec is the first major consumer of. It can land alongside or after the goal-creation spec; not a precondition.
- H4 (Tailnet-Lock-equivalent) protects the registry against compromise. The binding spec does not change the registry's trust model in a way that worsens the gap, so H4 can land independently.
- H5 (immutable-baseline) protects against bad self-updates of selection resolvers. The binding spec defines new selection resolvers, which makes H5 *more valuable* to ship soon, but H5 is not a precondition for the binding spec to be safe in the short term — its protection compounds over time.

**CC1 (scope-narrowing)** is a precondition only for `2026-04-26-shape-provider-goal-creation` to be considered safe with respect to scope. Without CC1, child goal scope is unconstrained.

**CC2 (risk-graded dispatch)** is independent and can land at any time.

A practical ordering for implementation:

1. H2 (vessel-id from pubkey) — smallest blast radius, foundation for everything else, no dependencies.
2. H1 (two-sided traces) — enables binding-spec safety. Depends on H2 for signing identity (the keys are the vessel keys from H2).
3. CC1 (scope-narrowing) — paired with the goal-creation spec landing.
4. H3 (signed scope attestations) — paired with or after the goal-creation spec.
5. H4 (Tailnet-Lock-equivalent) — independent; ship when capacity allows.
6. H5 (immutable-baseline) — independent; ship when capacity allows. Higher value the longer the binding spec runs without it.
7. CC2 (risk-graded dispatch) — independent; relies on `toolRiskProfile` already populated.

## Risks / Trade-offs

- **Cumulative complexity.** Five primitives plus two invariants is a lot. **Mitigation**: each primitive has a single named precedent, single specific data-model change, and is independently shippable. The spec is unified; the implementation is not.
- **Performance regressions on trace ingest** (H1 signing, H3 verification). **Mitigation**: Ed25519 throughput is well-known; signing on the hot path is microseconds. Pairing-job latency is asynchronous and never blocks the executor.
- **Operational burden of authority keys** (H4). **Mitigation**: three deployment modes; default mode (operator-held) is identical to today's operational posture. Customer-held keys are an opt-in.
- **Migration window risk** — vessels not yet migrated could be excluded from Thompson updates (H1) or rejected at registration (H2). **Mitigation**: every hardening starts in `enforcement: "log_only"` mode; flip to enforce after a calibration window.
- **Spec drift against in-flight changes.** **Mitigation**: this change is explicitly standalone; a parallel agent owns the compatibility refactor of the in-flight specs. Sequencing-section pins which hardenings precede which in-flight changes.

## Open Questions

Collected from the per-decision sections plus a few cross-cutting ones:

- (H1) `vessel_trust_score` discrepancy threshold and downgrade curve — needs calibration data.
- (H1) Single-sided-trace policy for purely local resolutions.
- (H2) Pubkey-rotation flow and history continuity.
- (H3) Canonical form for `scope_hash` preimage; pinned once goal-creation lands.
- (H3) Issuer signing key for `issuer = user`.
- (H4) Whether AUM log needs external transparency.
- (H4) Per-org expansion of "high risk" beyond `toolRiskProfile`.
- (H5) Per-family rolling-window size for auto-regression.
- (H5) Promotion-to-baseline delay/cancel mechanism (TimelockController-equivalent).
- (CC1) Subset semantics for scope claims — depends on goal-creation spec's scope schema.
- Cross-cutting: how do these primitives compose with the existing API-key auth on read paths? Do scope attestations gate reads, or only writes? Lean: writes only in v1; reads continue to use API-key auth's PERMISSIONS-based isolation.
- Cross-cutting: a future "anomaly detection on Thompson posterior shifts" hardening was discussed but not included here — out of scope; flagged for follow-up.
