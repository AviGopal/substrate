# Design — Vessel Federation

> All references to the foundation are to
> `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`. Security primitives
> (H2, H4) are defined in
> `openspec/changes/2026-04-26-security-hardening-findings/design.md`;
> the canonical-JSON+SHA-256 construction is defined in
> `openspec/changes/2026-05-17-state-space-signature-thompson-keying/`.

The design has three sections, in build order. Each section ships an
independently observable primitive; together they let two
discovery-vessels know about each other without leaking the topology
into the rest of the system.

---

## §A — Vessel identity (apply H2)

### Problem

Today `VesselRegistration.vesselId` (`repos/discovery-vessel/src/types.ts`)
is a free-form string. Two substrates that happen to launch a vessel
under the same name produce indistinguishable identifiers; one substrate
cannot ask another "do you know vessel X" without ambiguity. The H2
design (`security-hardening-findings/design.md` §H2) already specifies
the cryptographic fix; we apply the relevant subset here.

### Construction

```
vessel_id = base32(multihash(SHA-256, ed25519_pubkey))
```

This is the libp2p PeerID construction. A vessel generates an Ed25519
keypair at provisioning time, derives its `vessel_id` from the public
key, and keeps the private key in the vessel's data directory (sealed
with the API key per H2's mitigation guidance).

The registration payload carries `{pubkey, signature, nonce, signed_at}`
exactly as H2 §2 specifies (`security-hardening-findings/tasks.md` 2.1
– 2.6). The discovery-vessel verifies the multihash binding and the
signature on a `{vessel_id, signed_at, registry_endpoint, nonce}`
challenge. Heartbeats and deregistrations carry fresh challenges.

### Subset of H2 shipped by this spec

This spec is responsible for the H2 work that is *load-bearing for
peering*, not the full H2 surface. Specifically:

| Task scope | Owned here | Owned by H2 spec |
|---|---|---|
| `vessel_id = multihash(pubkey)` for every vessel including discovery-vessel | yes | yes (same primitive) |
| Keypair generation in vessels | yes | yes |
| Registration challenge signature + nonce + clock-skew window | yes | yes |
| `enforcement: "log_only" | "reject"` flag on registration | yes (log-only by default in peering paths) | yes |
| Pubkey rotation flow | no | deferred to H2 |
| Cross-vessel call signatures | no (gated on H1, not H2) | gated on H1 |

If H2's tasks land before this spec, this spec inherits them. If this
spec lands first, H2's task list closes the items marked "yes" above
when it lands; H2 then ships rotation and any cross-vessel signature
work that is out of scope here.

### Discovery-vessel's own identity

The discovery-vessel self-registers as a system vessel (existing
behaviour; see `repos/discovery-vessel/src/registry.ts`). With H2
applied, the discovery-vessel's own `vessel_id` is the multihash of
its Ed25519 pubkey. **Peering identifies discovery-vessels by this
same id.** The peer relation is between two pubkeys, not between two
endpoints — endpoints may move; identity does not.

---

## §B — Content-addressed template ids

### Problem

`activity_template.id` is a free-form string today. Different substrates
that authored the same template (whether by hand, ribosome extraction
from analogous traces, or copy-and-paste) produce different ids. After
peering, the caller cannot tell whether "vessel V on peer P advertises
template T" refers to the same template as one we already know locally.
Thompson posteriors on a free-form id are not comparable across
substrates even when the underlying template body is byte-identical.

### Construction

Reuse the canonical-JSON construction already specified in
`state-space-signature/spec.md` §R1. Concretely:

```
template_id = "activity:" + sha256_hex(canonical_json(template_body))
```

Where:

- `canonical_json(body)` is RFC 8785 (JCS) canonical-JSON serialization
  of `template_body` — the same encoding pinned by
  `state-space-signature/spec.md` for cross-vessel determinism.
- `template_body` is the deterministic subset of the template:
  `{name, input_shapes, output_shapes, tasks, version_tag}` (the exact
  field set is finalized in tasks §3.1).
- `sha256_hex` is the full 64-char lowercase hex digest. Template ids
  are not truncated; the 16-char truncation used for
  `state_space_signature` is appropriate for cardinality-bounded
  binding contexts, not for content addressing template bodies whose
  cardinality is unbounded.

The `"activity:"` prefix preserves the existing `record_id`-style
namespacing used by activity-api's SurrealDB schema. Existing free-form
ids continue to be accepted on read; only newly minted templates carry
the content-addressed form.

### Why the same construction as `state_space_signature`

The two are different keys at different scopes (a binding-context key
vs. a template-body key), but the canonicalisation and hash family are
shared deliberately so that any implementation already producing one
correctly can produce the other with no new cryptographic surface.
`state-space-signature/spec.md` §R1.1 already requires byte-identical
output across minibob and activity-api; tests for content-addressed
template ids share the same fixture infrastructure.

### Migration

- Existing templates retain their current ids. activity-api stores
  the new content-addressed id alongside as `template_content_id`
  (nullable; populated at write time by both new mints and a one-time
  backfill). Queries that join templates across peers use
  `template_content_id` when present, falling back to `id` otherwise.
- The ribosome's template-extraction path (`activity-api`,
  `assembleTemplateFromExecution`) emits the content-addressed id for
  every new extraction. Free-form id remains as a human-readable
  display alias.

### Out of scope (deliberately)

- **Merging Thompson posteriors across peers** for the same
  `template_content_id`. That requires H1 two-sided traces to prevent
  posterior poisoning (federation-security-hardening Attack Family 1).
  This spec only fixes the key; the merge mechanism is a separate
  future spec, gated on H1.
- **Cross-account scope handling for shared template ids**. Account-
  scope federation (IAL `design.md` §"Federation as Scope Delegation")
  decides *whether* a caller may invoke a remote template; this spec
  only defines its identifier. The two interlock at IAL's account-
  scoped composition graph: an edge attribution to
  `template_content_id` does not change who is allowed to traverse it.

---

## §C — Peer-aware discovery-vessel

### Problem

Two substrates today have no way to learn about each other's vessels.
Each runs its own discovery-vessel; each discovery-vessel sees only its
own local registrations. The system has no concept of "two vessels in
different containers can answer the same resolve".

### Peer registration

A discovery-vessel persists a small peer set:

```typescript
interface PeerDiscoveryVessel {
  // pubkey-derived id (see §A)
  vesselId: string

  // Where to reach it. May change over a peer's lifetime; identity does
  // not.
  endpoint: string

  // Operator-supplied human label, for logs only. Not used in routing.
  label?: string

  // Operator-supplied authority endorsements (per H4) for this peer.
  // In log-only mode these are recorded but not enforced; in enforce
  // mode the peer is ignored unless endorsements meet the org's
  // authority threshold.
  authority_endorsements?: AuthorityEndorsement[]

  // Reachability state (computed; not part of operator config)
  last_seen?: number
  last_latency_ms?: number
  failure_count?: number
}
```

Peer establishment is **out of band**: an operator writes to the
discovery-vessel's peer table (initially a flat file under
`/data/discovery/peers.json`; eventually a SurrealDB table). The
discovery-vessel verifies on first contact that the peer's pubkey
matches the configured `vesselId`. There is no auto-discovery of peers
in this spec.

### Peer-aware `/resolve`

The existing `POST /resolve` handler
(`repos/discovery-vessel/src/registry.ts`) gains a depth-limited peer
fan-out:

1. Resolve locally exactly as today. If the local registry has any
   matching vessels, return them.
2. If the local result set is empty (or below a configurable minimum,
   e.g. for `vesselCapability` queries that want at least N candidates),
   iterate the peer set. For each peer with a healthy `last_seen`:
   forward the resolve request with a `peer_depth` header
   (incremented). Peers that receive a request with `peer_depth >=
   max_depth` SHALL respond from local registrations only — they MUST
   NOT recursively forward.
3. Merge responses. Each returned `VesselCapability` carries an added
   field:

   ```typescript
   reachability: {
     direct: boolean              // true if local registration
     via_peer?: string            // peer's vesselId if forwarded
     hops: number                 // 0 for direct, 1 for one-hop peer, …
     last_seen: string
   }
   ```

   No `substrate_id`, no topology label. The caller sees a vessel and
   its reachability annotations.

4. Cache forwarded results with a short TTL (configurable, default 30s)
   keyed by `(shape, peer_vesselId)`. Heartbeats from peers can
   invalidate the cache.

### What the rest of the system sees

`callVesselResolve` (`repos/minibob/src/`, the unified vessel-call
helper) does not need to know whether a vessel record is local or
peer-routed. The vessel record carries `endpoint`, `auth_scheme`,
`resolve_endpoint`, and the existing resolve contract; the caller
dials the endpoint as it always has. If the endpoint is a peer's
discovery-vessel that needs to in turn proxy to its registered vessel,
the peer's discovery-vessel is responsible — not the caller.

This is the load-bearing invariant: **upstream code never branches
on whether a vessel is local or remote.** The branch lives in
discovery-vessel, where it belongs.

### Trust model

- **Within one discovery-vessel's local registrations,** the trust
  boundary is whatever wrapped them. In a single container that is the
  container; in a cluster that is the cluster's pod-to-pod boundary.
  This spec does not change those boundaries.
- **Across peer discovery-vessels,** H1 and H4 are the cross-boundary
  primitives. H4 gates which peers may be added at all in enforce mode
  (operator-side: authority endorsements on the peer establishment).
  H1 gates whether traces produced by cross-peer call chains feed the
  learning loop (callee-side: signed two-sided traces).
- **This spec ships the peering plumbing without gating on H4 in
  log-only mode.** Once H4 lands, the discovery-vessel flips to
  enforce mode and rejects peer registrations without sufficient
  endorsements. The flip is per-org configuration; first release ships
  log-only.

### Operational notes

- Heartbeats to peers run independently of local heartbeats; a peer
  that fails N consecutive health checks is marked `unhealthy` and
  excluded from forwards until it recovers.
- Cycle detection: `peer_depth` header is the depth limit; depth 1 is
  the default and likely sufficient for all foreseeable two-substrate
  topologies. Higher depths require explicit configuration and exist
  only so the design extends naturally to multi-substrate fleets.
- The peer set is observable: `GET /registry/stats` extends to include
  a `peers` field with `{vesselId, label, last_seen, healthy}` per
  peer.

---

## §D — Interactions with sibling specs

### H1 (`security-hardening-findings/§H1`)
Two-sided traces are required before posteriors on a
`template_content_id` can be safely merged across peers. This spec
does **not** depend on H1 to ship; merging is out of scope. When H1
lands, the merge spec (separate future change) reuses this spec's
`template_content_id` as the merge key.

### H2 (`security-hardening-findings/§H2`)
This spec ships the H2 subset needed for peering identity (vessel
keypair, registration challenge, vessel_id from pubkey). H2's
remaining surface (pubkey rotation, hardware-backed key storage) is
deferred to its own spec.

### H4 (`security-hardening-findings/§H4`)
H4 is the authority primitive that gates peer establishment in
enforce mode. This spec ships log-only by default; enforce mode lights
up when H4 is operational.

### IAL account federation (`IAL/design.md §Federation as Scope Delegation`)
Orthogonal. The IAL's account federation decides *whether* a caller's
key scope authorises a cross-account resolve; this spec decides *how*
the caller's discovery-vessel learns about the remote vessel in the
first place. Both checks happen on the same `/resolve` call: the peer
is reachable (this spec) AND the caller's key has scope on the peer's
account (IAL federation). Either gate failing makes the resolve fail.

### Topology-discovery loop (`2026-05-23-topology-discovery-loop`)
The topology-discovery-loop's measurement resolvers
(`learned-topology-snapshot`, etc.) scan local discovery-vessel today.
With peering live, those resolvers can naturally scan the peer set as
well — but this spec does not require the change. A follow-up
("topology-discovery-federation") can extend the resolvers when there
is an actual cross-substrate operation to measure.

### Single-container-substrate (`2026-05-23-single-container-substrate`)
The substrate spec's "Substrate Model" notes that "when the cross-
substrate blockers eventually land they extend the trust model outward
from this container boundary." This spec is the first such extension.
Nothing inside the container changes; only the discovery-vessel grows
a new peer set.

### IAL Phase 27 (Lift)
Phase 27 is the IAL's terminal phase by declaration
(`IAL/tasks.md:1664`). Lift is achievable on a single substrate
without federation: the substrate runs its own topology-discovery loop
inside one container. This spec therefore lives outside the IAL phase
sequence as a post-lift sibling. The IAL `tasks.md` "Gates &
Dependencies" table grows a row for this spec, but no IAL phase is
created or modified.

---

## §E — Why this isn't "substrate routing"

The constraint that drove this design: **substrate is a deployment
artifact, not a system primitive.** From inside any vessel above
discovery, the question "which substrate is this vessel in?" never
arises and cannot arise. The only system-level facts are: a vessel
exists, it advertises shapes, it has an identity, it has an endpoint,
it has reachability annotations.

The federation surface defined here is therefore narrow:

- New: pubkey-derived vessel ids (apply H2).
- New: content-addressed template ids (apply canonical-JSON+SHA-256).
- New: discovery-vessel knows about other discovery-vessels and
  forwards `/resolve` under depth limit.
- *Not* new: any "substrate" field; any "routing topology" structure
  visible above discovery; any system-wide concept that two vessels
  inhabit different deployments.

A future operator looking at logs may see "this vessel record came
back from peer P at hops=1". That information lives in reachability
annotations, not in a substrate identifier. If a future feature
genuinely needs the deployment distinction (e.g. "prefer local vessels
for low-latency calls"), it computes the preference from
`reachability.hops` and `reachability.last_latency_ms` — the system
still does not name substrates.
