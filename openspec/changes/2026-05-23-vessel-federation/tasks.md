# Tasks — Vessel Federation

> Sibling of `2026-04-26-impulse-activity-loop` (post-lift); applies the
> subset of `2026-04-26-security-hardening-findings/§H2` that is load-
> bearing for discovery-vessel peering and reuses the canonical-
> encoding from `2026-05-17-state-space-signature-thompson-keying`.

## Sequencing

Items are grouped 1–6 in dependency order. §1 and §2 are the H2 subset
shipped here. §3 is the content-addressed template id. §4 and §5 are
peering. §6 is migration + enforcement.

§1 → §2 → §4 (peering identity depends on §1 + §2)
§3 standalone but ships in the same change so peering payloads can
include `template_content_id` from day one.
§5 depends on §4. §6 depends on all prior.

---

## 1. Vessel keypairs (subset of H2 §2)

- [ ] 1.1 (`discovery-vessel`) Extend `RegisterRequest` in
  `repos/discovery-vessel/src/types.ts` with required `pubkey: string`,
  `signature: string`, `nonce: string`, `signed_at: number`. Deprecate
  the free-form `vesselId` field — it MUST equal
  `base32(multihash(SHA-256, pubkey))` on every new registration.
- [ ] 1.2 (`discovery-vessel`) Add `verifyVesselIdentity(req)` in
  `repos/discovery-vessel/src/registry.ts` before TTL/heartbeat logic.
  Verify (a) multihash binding, (b) Ed25519 signature over
  `{vessel_id, signed_at, registry_endpoint, nonce}`, (c) `signed_at`
  within ±60s of registry clock, (d) nonce unseen for this `vessel_id`
  in the last 10 minutes.
- [ ] 1.3 (`discovery-vessel`) Persist `pubkey` on the vessel record
  so heartbeat / deregister verification does not re-fetch.
- [ ] 1.4 (`discovery-vessel`) Heartbeat (`POST /heartbeat`) and
  deregistration (`DELETE /vessels/:id`) accept fresh signed
  challenges; verify against stored pubkey.
- [ ] 1.5 (`discovery-vessel`) Add `enforcement: "log_only" | "reject"`
  config. Default `log_only` for first release; flip to `reject` per-
  org when migration is complete. Coordinate with H2's identical flag.
- [ ] 1.6 (per vessel: `minibob`, `metabob-activity-api`,
  `identity-vessel`, `concept-db`, `conversation-vessel`,
  `development-vessel`) Generate Ed25519 keypair at vessel start;
  persist under the vessel's data directory, sealed with the existing
  API key as the symmetric encryption key. Compute `vessel_id` from
  the public key; replace any hardcoded `vessel_id` with the derived
  value.
- [ ] 1.7 (per vessel) Sign register / heartbeat / deregister challenges
  with the vessel's private key. Include the challenge fields exactly
  as specified in 1.2.
- [ ] 1.8 Tests in `repos/discovery-vessel/test/`: pubkey-vessel-id
  mismatch rejected; invalid signature rejected; expired challenge
  rejected; replayed nonce rejected; pubkey persisted across heartbeat;
  pubkey-mismatch on re-register rejected.

> If `security-hardening-findings/§2 (H2)` lands first, this section
> closes its tasks 2.1–2.10 transparently. If this section lands first,
> H2's task list inherits these as completed.

## 2. Discovery-vessel identity

- [ ] 2.1 (`discovery-vessel`) Discovery-vessel self-registration uses
  the pubkey-derived `vessel_id`. The self-registration path in
  `repos/discovery-vessel/src/index.ts` generates the discovery-
  vessel's own keypair on first boot, persists it under
  `/data/discovery/keypair`, and re-uses it across restarts.
- [ ] 2.2 (`discovery-vessel`) `GET /health` and `GET /registry/stats`
  responses include the discovery-vessel's own `vesselId`. This is the
  identifier peers use to refer to this discovery-vessel.

## 3. Content-addressed template ids

- [ ] 3.1 (`metabob-activity-api`) Define `template_body` field
  schema: the deterministic subset
  `{name, input_shapes, output_shapes, tasks, version_tag}`. Add
  `template_content_id: string | null` column to `activity_template`
  via a new SurrealDB migration `<next>-template-content-id.surql`.
  Index on `template_content_id` for peer-lookup joins.
- [ ] 3.2 (`metabob-activity-api`) Implement
  `computeTemplateContentId(template_body): string` reusing the
  canonical-JSON encoding from
  `repos/metabob-activity-api/src/utils/canonical-encoding.ts` (the
  same module that powers `state_space_signature`; create the shared
  utility if it does not already exist). Return
  `"activity:" + sha256_hex(canonical_json(template_body))`.
- [ ] 3.3 (`metabob-activity-api`) Template-write paths
  (`POST /v2/activities/templates`, ribosome extraction in
  `assembleTemplateFromExecution`, any other CREATE site) compute
  `template_content_id` at write time and store it alongside the
  existing free-form `id`.
- [ ] 3.4 (`metabob-activity-api`) Backfill script under
  `repos/metabob-activity-api/scripts/backfill-template-content-id.ts`
  iterating existing rows, computing the id, writing back. Idempotent
  (re-running on a fully-backfilled table is a no-op).
- [ ] 3.5 (`minibob`) When emitting an `activity_template`-shaped
  impulse or recording a `recordImprovisationOutcome` trace, compute
  `template_content_id` locally and include it on the trace metadata.
  Use the same shared `canonical-encoding` utility (port from
  activity-api or share via a workspace package — implementation
  choice in `repos/minibob/src/utils/`).
- [ ] 3.6 Tests in `repos/metabob-activity-api/test/` and
  `repos/minibob/test/`: same `template_body` produces byte-identical
  `template_content_id` across the two implementations; differing
  field order produces identical ids (canonical encoding); differing
  body produces different ids; backfill is idempotent.
- [ ] 3.7 Spec test: a fixture vector
  `template_body → expected template_content_id` is shared between
  minibob and activity-api test suites (mirror the fixture-sharing
  pattern from `state-space-signature`).

## 4. Peer registration in discovery-vessel

- [ ] 4.1 (`discovery-vessel`) Define the peer schema in
  `repos/discovery-vessel/src/types.ts`:
  ```ts
  interface PeerDiscoveryVessel {
    vesselId: string
    endpoint: string
    label?: string
    authority_endorsements?: AuthorityEndorsement[]
    last_seen?: number
    last_latency_ms?: number
    failure_count?: number
  }
  ```
- [ ] 4.2 (`discovery-vessel`) Persist peers under
  `/data/discovery/peers.json` (flat file initially; a SurrealDB peer
  table is a follow-up). Load on startup; reload on SIGHUP.
- [ ] 4.3 (`discovery-vessel`) Verify peer identity on first contact:
  fetch the peer's `GET /health`, confirm the `vesselId` in the
  response matches the configured peer `vesselId`. On mismatch, mark
  the peer as unhealthy and log; do not delete the peer entry (the
  configured value is operator intent, runtime mismatch is data).
- [ ] 4.4 (`discovery-vessel`) Health-check peers on the same cadence
  as local vessel TTL (60s). Record `last_seen`, `last_latency_ms`.
  Three consecutive failures flip `unhealthy`; one success flips back.
- [ ] 4.5 (`discovery-vessel`) Extend `GET /registry/stats` with a
  `peers` array listing `{vesselId, label, last_seen, healthy}`.
- [ ] 4.6 Tests: peer establishment with matching vesselId/pubkey
  succeeds; mismatched vesselId marks unhealthy; SIGHUP reloads peers
  file; health-check transitions healthy→unhealthy→healthy.

## 5. Peer-aware `/resolve`

- [ ] 5.1 (`discovery-vessel`) Extend `POST /resolve` handler to
  forward to peers under depth limit. Define:
  - Request header `X-Peer-Depth: <int>` (default 0).
  - Configurable `max_peer_depth` (default 1).
  - A peer receiving a request with `X-Peer-Depth >= max_peer_depth`
    serves from local only; it MUST NOT forward.
- [ ] 5.2 (`discovery-vessel`) Forwarding policy:
  - Local result is empty (or below a configurable
    `min_candidates_for_shape` for `vesselCapability` queries) →
    fan out to peers in parallel, merge responses, dedupe by
    `vesselId`.
  - Each forwarded response's vessels carry an added `reachability`
    object: `{direct: false, via_peer, hops, last_seen}`.
  - Local vessels carry `reachability: {direct: true, hops: 0, …}`.
- [ ] 5.3 (`discovery-vessel`) Forward-response cache: short TTL
  (default 30s) keyed by `(pointer-shape, peer_vesselId)`. Peer
  heartbeat invalidates the cache for that peer.
- [ ] 5.4 (`discovery-vessel`) Authority gating (log-only mode initially):
  - Without authority endorsements meeting threshold, log the peer
    forwarding but allow it. Acceptance criterion is structured-log
    presence, not behavioural difference.
  - In `enforcement: "reject"` mode (per-org config; lit when H4
    lands), peers without sufficient endorsements are skipped and a
    counter increments.
- [ ] 5.5 (`discovery-vessel`) Cycle protection: `vesselId`s observed
  in the current `/resolve` chain are tracked via an `X-Peer-Visited`
  header (comma-joined list); peers that appear in `X-Peer-Visited`
  are skipped on forward. Header is bounded; if it grows past
  `max_peer_visited_size` (default 16) the request is rejected.
- [ ] 5.6 Tests:
  - Local-only resolve returns vessels with `direct: true`.
  - Empty-local + healthy-peer returns peer vessels with `direct:
    false, hops: 1`.
  - Depth limit prevents recursive forwarding (peer-of-peer at
    depth 2 not visited with default config).
  - `X-Peer-Visited` prevents cycles (A → B → A skipped).
  - Cache hit on second request within TTL.
  - Authority log-only mode: forwarding without endorsements
    logs but proceeds.

## 6. Migration and enforcement

- [ ] 6.1 (cross-vessel) Deploy `enforcement: "log_only"` on all
  vessels' registration paths. Run for ≥7 days on canary substrate;
  collect logs for non-conforming registrations.
- [ ] 6.2 (cross-vessel) Promote `enforcement: "reject"` after the
  log shows zero non-conforming registrations from known vessels
  (per-org; see H2 §2.6).
- [ ] 6.3 (`discovery-vessel`) Operator runbook
  `docs/runbooks/vessel-federation-bootstrap.md`: how to generate a
  discovery-vessel keypair on a second substrate, register it as a
  peer on the first substrate, verify reachability, and (once H4 is
  live) collect authority endorsements.
- [ ] 6.4 (CLAUDE.md) Update CLAUDE.md "Substrate-Aware Development"
  section to note that with peering live, "known substrate endpoints"
  may include peer-routed vessels from other substrates. Substrate
  remains a deployment-vocabulary term; the system continues to
  reason about vessels, not substrates.

## 7. Verification

- [ ] 7.1 `bun run typecheck` zero new errors in `discovery-vessel`,
  `minibob`, `metabob-activity-api`, `identity-vessel`, `concept-db`,
  `conversation-vessel`, `development-vessel`.
- [ ] 7.2 `bun test` all suites green in the same repos; new tests in
  §§1–5 included.
- [ ] 7.3 In-substrate smoke: a single container with two
  discovery-vessels (a primary at `:8100` and a peer at `:8101`),
  each with a small set of local vessels, demonstrates that a
  `/resolve` on the primary returns vessels from the peer with
  correct `reachability` annotations.
- [ ] 7.4 Two-substrate smoke: a second container started on the same
  host with `make substrate-run` + a `peers.json` referencing the
  first substrate's discovery-vessel. `minibob --single "<goal>"`
  on the second substrate completes a goal that depends on a vessel
  only present on the first substrate.
- [ ] 7.5 Negative: peer with mismatched `vesselId` marked unhealthy
  within one health-check cycle; cycle-detection header rejects
  A→B→A loops; `X-Peer-Depth >= max_peer_depth` is not forwarded.

## 8. Acceptance gates

- [ ] 8.1 All §1–§5 tasks ticked; tests green.
- [ ] 8.2 §7.3 in-substrate smoke green on a development substrate
  per Phase 26.
- [ ] 8.3 §7.4 two-substrate smoke green; demonstrates that the
  rest of the system (minibob, activity-api) called the remote
  vessel via the same `callVesselResolve` path as a local vessel —
  i.e. no upstream branch on local-vs-remote.
- [ ] 8.4 H1 dependency captured: a TODO comment in
  `repos/discovery-vessel/src/registry.ts` next to the
  reachability annotation construction notes "merging Thompson
  posteriors across peers requires H1 two-sided traces (see
  `2026-04-26-security-hardening-findings/§H1`)." This spec
  is acceptance-complete without H1; merging is acceptance-
  complete in a follow-up spec.
- [ ] 8.5 The IAL `tasks.md` "Gates & Dependencies" table contains
  a row for this spec; no IAL phase is modified.

## 9. Sequencing notes

- §1 + §2 may merge upstream into H2 if H2 ships first. The work is
  the same; the spec ownership is the question.
- §3 may ship independently of peering — content-addressed template
  ids are useful inside a single substrate too (template deduplication
  via ribosome) — but ship together so the peering payloads carry
  the new id from day one.
- §4 + §5 are this spec's load-bearing new surface.
- §6 enforcement flip is per-org and may lag the spec's merge by
  weeks; that is expected.
