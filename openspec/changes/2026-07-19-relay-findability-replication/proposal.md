# Relay findability — a vessel that dials discovery or the relay becomes findable by all peers, not just pullable by those pointing back

**Date:** 2026-07-19
**Vessels:** discovery-vessel (registration replication), libp2p-federation-transport (hub mirror refresh), scripts/substrate/gen-env.sh (hub-side peer wiring)
**Stage:** SPEC (grounded in a live probe of the running spoke's registry + a code trace of the push/pull paths)
**Lever:** the operator invariant — *"any vessel that dials into the discovery or the relay gets found by all other containers."* Today findability is a hub-star with two asymmetric synthetic paths (120s push mirror + query-time pull), so a dialed-in vessel is present only where someone happens to point back, and a lost relay reservation silently blanks a whole substrate's remote visibility.

## Problem (grounded live 2026-07-19)

Topology, verified in code + a live `registry_query`: a hub relay runs Circuit Relay v2 (TCP 30333, `scripts/substrate/federation-relay/relay.ts`); each spoke runs exactly **one** libp2p node, `federation-transport-vessel`, and every other vessel is plain HTTP reaching the overlay only through it. The local spoke's registry shows 6 `llm_completion` producers — 3 local + 3 `@syzygy-hub` libp2p mirrors — so the mirror path *works* for a healthy reservation. But the registry itself is an in-memory single-replica `Map` with a 5-min TTL and **no replication** (`repos/discovery-vessel/src/registry.ts:26-34`). Cross-substrate visibility is synthesized two ways, both asymmetric:

- **PUSH** — `registerAtHub()` polls the local registry every 120s and mirrors each plain-HTTP vessel as `<vesselId>@<substrate>` into the **hub** discovery, carrying this transport's circuit as reachability (`federation-transport-server.ts:351-408`). It **silently early-returns when the live circuit is empty** (`:372-374`), so a lost reservation blanks the substrate's entire remote presence until the next successful tick — with no gap signal.
- **PULL** — a querying discovery, on a local miss, fans the pointer to `PEER_DISCOVERY_ENDPOINTS` at use time (`index.ts:44-118`). `gen-env.sh:218` sets `PEER_DISCOVERY_ENDPOINTS=${HUB_DISCOVERY_URL}` on a **spoke**, so a spoke fans out to the hub — but a **hub/root has empty `HUB_DISCOVERY_URL`, hence empty `PEER_DISCOVERY`, hence no resolve-time fan-out**. The hub only sees spokes via the pushed mirror.

Net: a hub-star, not a mesh. Spoke→hub via fan-out; hub→spoke via push mirror; spoke-A→spoke-B **only** through the common hub. A vessel that dials a spoke's discovery is findable by that spoke and (after ≤120s) the hub, but **not** by sibling spokes until they pull through the hub — and not at all if the reservation is down. Also, `/bootstrap` emits loopback anchors (`identity_endpoint=127.0.0.1:8101`, `discovery_endpoint=''`) when `PUBLIC_IP`/`DISCOVERY_PUBLIC_URL` are unset (`index.ts:148-179`), so a vessel dialing an under-configured node silently "joins" to an unreachable identity authority.

## Key insight: findability must be a property of *joining*, not of static per-node peer wiring

The invariant "dial in → found by all" is a **replication** guarantee, not a query-time-luck guarantee. A `POST /register` should *propagate* the registration to known peers (bounded, deduped, TTL'd, last-writer-wins upsert), so the registry that all peers resolve through converges — rather than each node independently deciding whether to pull. Push-mirror + query-pull are optimizations layered on top, not the guarantee itself.

## Approach

1. **Registration replication (`discovery-vessel`).** On `POST /register`, forward the registration to `PEER_DISCOVERY_ENDPOINTS` (bounded fan-out, deduped by `libp2p_peer_id`, TTL'd, idempotent upsert). A dialed-in vessel becomes present in the fixed-point registry every peer resolves through — not merely pullable. This is the eventually-consistent anti-entropy the activity-api store already models (law: converge via upsert), applied to the registry.
2. **Loud reservation (`federation-transport-server.ts`).** `registerAtHub()` must not silently early-return on empty circuit: emit a de-advertise / gap signal and refresh the hub mirror **immediately on reservation (re)acquisition**, not only on the 120s tick — so a lost reservation degrades observably, not silently.
3. **Honest `/bootstrap` (`discovery-vessel/src/index.ts`).** Refuse to emit loopback identity/discovery anchors; derive public anchors from the registered relay circuit / announced addrs, or return an explicit `not-a-join-door` marker so a dialing vessel never joins to an unreachable authority.
4. **Hub-side peer wiring (`gen-env.sh`).** Give a hub/root a non-empty `PEER_DISCOVERY_ENDPOINTS` (spoke reflector) so hub-side resolve fan-out exists and cross-substrate findability does not depend solely on the push mirror.

## Decision (ratified by the operator 2026-07-19)

**Findability must not be relay-gated — a direct connection is equivalent to a relay punchthrough.** The operator: *"the relay won't always be available due to networking conditions, so internally a direct connection should be equivalent to a punchthrough."* So the transport's reachability is: **prefer a direct dial when the peer is directly reachable** (co-located on a host, same LAN, public addr), and fall back to the hub relay **circuit** only when NAT/firewall blocks a direct path — with DCUtR hole-punching upgrading a relayed connection to direct when possible (standard libp2p). Consequences:

- Every container that must be findable joins the overlay by running a federation transport and dialing discovery — one uniform join path (dial discovery ⇒ transport ⇒ registered), consistent with point-and-go. But its *reachability* is not "through the hub relay"; it is "directly if possible, relay-punchthrough if not, equivalent either way."
- Co-located containers on one host reach each other over a **direct** (loopback/host-bridge) connection with **no relay dependency**; the relay is irrelevant to same-host findability and is only the NAT fallback for cross-host peers.
- The registration-replication guarantee (above) is what makes a peer *findable*; direct-or-relay is how it is then *reached*. The two are separated: a relay outage degrades reachability for NATed cross-host peers only, never same-host findability, and never the registry.
- A container that is Caddy-fronted and never runs a transport is deliberately outside the overlay (a client, not a peer) — reachable via its HTTP surface, not findable as a resolver. That is a role choice, not a gap.

## Non-goals

Strong consensus (Raft) across registries — last-writer-wins upsert with TTL is sufficient for findability. Genre-correctness of replicated rows is the companion `vessel-duplicate-genres` change (a mirrored remote identity must not become a second local authority).
