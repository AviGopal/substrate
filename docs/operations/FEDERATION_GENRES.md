# Federation genres — which of N producers of a shape a caller gets

Discovery is the routing fixed point, and routing is capability-addressed: a caller asks
for a shape and gets a producer. The moment more than one vessel advertises the same shape,
somebody has to decide *which*. Left unstated, that decision is made independently by every
caller — one takes the first row, one balances, one pins a literal — and the vessel that
owns the data has no say in how its own duplicates are treated.

The genre taxonomy moves that decision out of the callers and into a field the producing
vessel declares about itself. "How should a duplicate of me be treated" is a property of
the producer, so it is advertised at registration and honoured by the router, where it is
observable and uniform. Declaring the genre fixes the *type* of choice; which arm of an
interchangeable set actually serves remains learned from traces.

The field is `distribution_policy` on a vessel registration, typed in
`repos/discovery-vessel/src/types.ts` and normalised in
`repos/discovery-vessel/src/registry.ts`.

## The taxonomy

Six values are declarable. They group into three genres by what they say about duplication.

| Value | Genre | What a second producer of the same shape means |
|---|---|---|
| `stateless` | interchangeable | Pure function of its input; duplicates are harmless and any live one is correct. This is the default. |
| `interchangeable` | interchangeable | Explicit synonym of `stateless`, for a vessel that wants to say so rather than inherit it. |
| `unique_authoritative` | unique | Exactly one row is authoritative; never load-balance across replicas. |
| `unique_target` | unique | Route to a single declared target — the instances are not substitutable, so the caller must address the one it means. |
| `stateful_data_owner_pin` | data owner | The state lives on one instance; always route to the owning row. |
| `stateful_data_owner_merge` | data owner | The state is sharded and eventually consistent; a caller fans out and merges across owners. |

The two data-owner sub-genres exist because the two cases behave oppositely under
duplication. A pinned owner must never be load-balanced — the second instance does not have
the data. A merge owner may be, because convergence is by upsert and anti-entropy, so
reaching either instance is legitimate and they reconcile afterwards.

## How a policy is declared and normalised

A vessel sends `distribution_policy` in its `POST /register` body. The registry normalises
it at write time: the first-class field wins, else a `duplicate_policy` key inside the
free-form `metadata` blob is honoured for vessels that already ship it there, else the
value defaults to `stateless`. Every stored row therefore carries a populated policy
regardless of what the vessel advertised, so no consumer has to model an absent one.

The normalised value is echoed on capability rows and in the registry dump. That echo is
load-bearing rather than cosmetic: capability responses deliberately do not echo
`metadata`, so a caller reading a capability row can see the first-class field and nothing
else — which is precisely why the policy had to become a first-class field instead of
remaining a metadata convention.

Registrations are held in memory with a five-minute TTL and are expected to be refreshed by
heartbeat about every two minutes, so a policy change takes effect on the next
registration. A separate deduplication pass evicts a re-registration of the *same physical
vessel* — same base logical name and same libp2p peer identity, keeping whichever row was
seen more recently — while deliberately leaving distinct base names behind one transport
peer alone, because a federation mirror legitimately registers many vessels through one
peer.

## Where the policy changes the pick

Three independent selection sites read the policy, and they agree on the rule so that a
walk's own pick cannot silently override what a vessel declared:

- **Discovery's `/resolve` gateway.** For a non-discovery shape, it collects the healthy
  producers, then prefers the first row declaring `unique_authoritative` or
  `stateful_data_owner_pin`. Among pinned rows, one additionally marked authoritative in
  its metadata wins. Failing any pinned owner, it prefers a direct non-libp2p local
  producer over a libp2p facade row, and only then falls back to the first candidate.
- **The goal-host satisfier pick.** It filters to the pinned producers when any exist, and
  otherwise keeps them all; within that pool it scores by the row's `priority`, weighted
  double, plus a point for being local rather than reached over libp2p.
- **The federation transport's ingress pick.** Among reachable local plain-HTTP candidates
  it prefers a pinned owner, else the first reachable one — so the cross-substrate path
  honours the declaration too, not only discovery's own gateway.

Only `unique_authoritative` and `stateful_data_owner_pin` steer these picks. A
row declaring `unique_target`, `interchangeable`, or `stateless` resolves through the
default path — capability resolution returns the full live producer set and the caller
selects within it. Treat the declaration as the producer's statement of intent, and check
the pick site before assuming a value is enforced there.

## The identity secret defines the namespace boundary

The ratified rule is that identity is what bounds a discovery namespace, and that sameness
of *secret* — not an election among candidates — decides how a second identity authority is
treated:

- **Same secrets → a replica of one authority.** Two identity vessels sharing the API-key
  signing secret are the same authority; failover between them is within one namespace and
  cannot split-brain, because either one validates the other's tokens.
- **Different secrets → a foreign namespace.** An identity vessel with different secrets is
  a peer network, not a competing authority in the local one. Its shapes are reachable only
  across the explicit federation boundary, and a mirrored remote identity must never be
  registered as a second local authority.

The bootstrap path enforces the premise. Identity refuses to boot on an unset or
publicly-known API-key secret unless the insecure-development override is set explicitly,
and environment generation refuses to fall back to the legacy public default on an existing
datastore — because two substrates that both fell back would silently share one trust
space, which is exactly the namespace collision the rule exists to prevent. A deliberate
rotation is expressed by naming previous secrets explicitly, never auto-derived.

Routing respects the same boundary. When discovery forwards a query to a peer, it presents
a hub-issued credential rather than the caller's own token, because a token issued by this
substrate's identity is meaningless at a peer that validates against a different secret —
forwarding it would simply 401 and the fan-out would return nothing.

## Query-time pull: bounds, dedup, and provenance

Cross-substrate resolution has two distinct legs. The pull leg lives in discovery itself
and is what a caller experiences on a local miss.

Peer endpoints are read from the environment **at use time**, not frozen at module load, so
a substrate federated after boot participates without a restart. Two forwarding paths
exist: a capability query fans out to every peer in parallel and merges the results, while
a general non-discovery shape is forwarded peer by peer and returns the first successful
resolution.

Both are bounded the same way. Each hop carries an incremented depth header, and a request
arriving at or beyond the maximum peer depth — two hops by default — is not forwarded
again, so peer-to-peer-to-peer can neither loop nor fan out unbounded. With no peer
endpoints configured, both paths are no-ops and single-substrate behaviour is unchanged.

Merged capability results are filtered and tagged rather than trusted wholesale:

- **Dedup.** Peer rows are deduplicated by vessel id as they are merged, and a local row
  always wins a collision with a peer row of the same id.
- **Dialability.** A peer row must be reachable from here — it needs a libp2p multiaddr, or
  a non-loopback endpoint. A peer's `127.0.0.1` is not this host's `127.0.0.1`.
- **Self-echo rejection.** A row whose libp2p peer id matches a locally registered vessel,
  or whose first multiaddr contains one, is this substrate's own registration coming back
  through the hub and is dropped.
- **Provenance.** Every surviving row is tagged `discoveredVia: "peer"` and stamped with the
  peer endpoint it came from, so a caller — and the learning loop — can tell a local
  producer from a peer-resolved one.

## Register-time propagation, and where it actually lives

Findability across substrates is a push as well as a pull, but the push is **not** performed
by discovery's `/register`: that handler writes the local registry only. The register-time
propagation is done by the federation transport
(`scripts/substrate/federation-relay/federation-transport-server.ts`), which mirrors this
substrate's capability surface into a peer discovery when a hub discovery URL is configured.

The mirror is per-vessel: each local plain-HTTP vessel is registered into the hub registry
under a substrate-qualified id of the form `<vesselId>@<substrate>`, advertising that
vessel's own shapes with the libp2p protocol and this transport's reachability — the relay
circuit first, then direct listen addresses, since a direct dial is equivalent to a relay
punchthrough. That is what makes each vessel individually addressable and health-scoreable
from another substrate instead of collapsing the fleet into one opaque row.

Its exclusions are what keep the namespace from degenerating. It skips the transport's own
row, any already-qualified `@`-suffixed id and any libp2p-protocol row (both are some
substrate's mirror, and re-exporting them would ping-pong namespaces), and any vessel whose
only endpoint is unreachable from other hosts — such a row would otherwise outlive the TTL
and shadow the vessel's real circuit.

A self-mirror guard (`SELF_MIRROR`) detects the case where the configured hub discovery
resolves to this substrate's own discovery — the hub's own transport — by comparing them as
loopback-normalised host:port. In that case `registerAtHub` omits the transport's own anchor
row, but it still registers the per-vessel rows, so hub-native vessels are advertised with
the circuit for inbound peer dials and do appear `@`-qualified in the hub's own registry.
Expect those rows when debugging apparent duplicates on a hub; the startup log line still
announces the mirror as disabled, which no longer describes what `registerAtHub` does.

Its failure mode is deliberately loud rather than silent. Without a live relay circuit the
mirror is skipped and the loss of remote visibility is logged as an error, throttled so a
persistent outage does not become log spam, and the registrations are refreshed
*immediately* when a reservation is reacquired rather than waiting out the periodic tick.
An authentication rejection from the hub is emitted as a shaped join-health observation, so
a stale key degrades queryably instead of blanking a downstream panel with no signal.
