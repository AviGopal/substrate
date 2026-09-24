# Federation

How substrate instances share a namespace or federate as peers, and how a vessel
(local or behind NAT) joins over the libp2p relay.

This document holds the protocol and the concepts. The commands that launch a hub, a
spoke or a surface are in [README § Installation](../README.md#installation) (sequences
B, C and D), the only place setup commands appear.

## Point-and-go (the default join)

A spoke or vessel joins by pointing at **one** endpoint — a **discovery
endpoint** — and presenting **one** credential — an **API key**. Nothing else is
required.

Discovery serves a public, pre-auth `GET /bootstrap` that returns the routing
anchors a fresh, keyless client needs before it holds anything else:

```json
{
  "relay_multiaddrs": ["..."],
  "identity_endpoint": "<identity-endpoint>",
  "discovery_endpoint": "<discovery-endpoint>",
  "prefer_transport": "libp2p"
}
```

The federation transport (and the Obsidian sidecar), when no relay is
configured, fetches `<discovery-endpoint>/bootstrap`, takes the relay anchor,
reserves a p2p circuit (preferring the libp2p overlay), and registers itself. A
valid API key is the **sole** gate.

**An anchorless start is not a fatal start.** If the configured bootstrap URL is
unreachable or serves no relay anchor, the transport falls back to the *local*
discovery's `/bootstrap`, and if that is also anchorless it starts **direct-only**:
it builds its libp2p node, serves resolves, registers locally, and logs a
direct-only warning instead of exiting. It then polls for an anchor on a widening
backoff and, when one appears, adopts it and acquires a circuit **without a unit
restart** — the peer id is derived from the stored identity, so it survives the
adoption. Direct-only is a degraded steady state, not a crash: see
*Known limitations* below for what it does and does not buy you.

**This applies to the in-container transport, not to the Obsidian sidecar.** The
sidecar has no direct-only mode: with no relay override and no anchor from
`/bootstrap` it exits, so on a surface host an unrelayed hub still shows up as a
sidecar that will not stay running. Fix the hub's relay rather than pinning a
multiaddr.

A hand-set relay multiaddr is now an **optional override**, not a requirement —
useful only to pin a specific relay or when `/bootstrap` is unreachable. Pinning
one by hand is what used to break: a relay peer id changes on every relay
restart, so a pinned multiaddr goes stale; the `/bootstrap` fetch is what keeps
it current. Discovery is the anchor an operator points at; the relay multiaddrs,
identity endpoint, and preferred transport are returned *by* `/bootstrap`.

## Two topologies

### 1. Shared namespace (hub + spokes) — recommended

One **hub** runs the control plane + store + relay; **spokes** register against it and
land in the same namespace because they authenticate with keys issued by the **one**
identity-vessel.

```
                 <hub-host> (public)  =  HUB
        ┌──────────────────────────────────────────────┐
        │  discovery + identity + activity-api + relay  │
        │  PROFILE=hub                                  │
        └──────▲───────────────▲──────────────▲─────────┘
               │ register       │ register     │ relay reservation
        ┌──────┴──────┐  ┌──────┴──────┐  ┌────┴─────────────┐
        │ local subst.│  │ host obsidian│  │ any edge vessel  │
        │  (spoke)    │  │ + sidecar    │  │  + sidecar       │
        └─────────────┘  └──────────────┘  └──────────────────┘
```

Why a single hub makes the namespace automatic: `org_id` is generated per identity-vessel
(`seed-identity.ts`), so two independently-seeded instances get **different** namespaces.
A spoke that authenticates with a hub-issued key inherits the hub's `org_id` — same
namespace, no reconciliation code (`discovery/src/registry.ts isAccessibleTo`).

### 2. Federation peers — separate substrates that fan out

Each instance runs its own full stack; a capability query with **no local producer**
fans out to configured peers.

```
  substrate A  ⇄  substrate B     (each: PEER_DISCOVERY_ENDPOINTS points at the other)
```

Set `PEER_DISCOVERY_ENDPOINTS=http://<peer>:18100` (+ optional shared
`FEDERATION_SIGNING_SECRET`). Discovery forwards unresolved `vesselCapability` queries,
tags peer results `discoveredVia:"peer"`, and goal-host routes those over the relay.

## Choosing a topology (decision rule)

- **Hub-registration (spoke)** — one vessel or a small *trusted* set joining an
  existing substrate: same org, same learning state, same trust domain, lowest
  latency. `DISCOVERY_ENDPOINT` naming the hub + a hub-issued
  `METABOB_API_KEY` (the `spoke` profile follows from them). The spoke's vessels are made reachable by the spoke's **own
  federation transport**, which mirrors each of them into the hub as a
  `<vessel>@<substrate>` row carrying that transport's libp2p peer id and circuit
  — reachability is the substrate's one overlay identity, not a host address
  advertised per vessel.
- **Peer-substrate (federation)** — separate org, separate learning state, an
  adversarial-tolerant boundary, or a whole fleet on a remote host: own
  store/identity + `PEER_DISCOVERY_ENDPOINTS` + `FEDERATION_SIGNING_SECRET`
  (+ the libp2p relay when NAT'd). Capability queries fan out; goal-host routes
  via `peerEndpoint`/libp2p, never the peer vessel's loopback `endpoint`.

Both remain supported; pick by trust domain and learning-state ownership, not
by geography.

## Three-location operational space

The full topology this repo demonstrates: **hub** (a public VM) runs the shared
activity/learning surface (the `hub` profile: activity-api + discovery +
identity + relay); the **spoke** (local `substrate-live`) runs goal-host and
the compute fleet, with its discovery peer-fanning-out to the hub
(`PEER_DISCOVERY_ENDPOINTS`) and goal-host's trace/learning writes pointed at
the hub (`/etc/substrate/goal-host-hub.env` loaded via a unit drop-in
`EnvironmentFile` — NOT `Environment=` lines, which `/etc/substrate/env` is
read after and silently overrides); the **operator host** contributes its live
Obsidian plugin as an implicit-vessel surface via
`federation-relay/obsidian-passthrough.ts` — a sidecar that reserves on the
hub relay, registers `obsidian_*` shapes into hub discovery
(`protocol:"libp2p"` + circuit multiaddr), and proxies resolves to the plugin.

A goal dispatched at the spoke then reaches the operator's vault with no
pinning: goal-target inference picks `obsidian_status` from the peer-unioned
shape vocabulary (goal-host `fetchPeerRegistryShapes`), the walk's
vessel-resolve satisfier routes via peer fan-out → the local
federation-transport egress → the relay circuit → the host sidecar → the
plugin, and the execution trace lands on the HUB's activity-api — one
operational space across three locations, spoking (shared org/learning) and
peering (discovery fan-out) at once.

## The relay (NAT traversal)

A vessel behind NAT can't be dialed directly. The **libp2p Circuit Relay v2** relay runs
on a public address (the hub) and brokers connections; DCUtR then tries a direct
hole-punch, falling back to permanently-relayed for symmetric NAT. Noise encrypts
end-to-end — the relay never sees plaintext.

In the `hub` and `hub-minimal` profiles the relay runs **inside the container**, is
published at the prefix-derived port `P333`, and is advertised by `/bootstrap` at the
hub's `PUBLIC_IP`. That is why a hub cannot omit `PUBLIC_IP`: it is the address spokes
reach, and the relay announces nothing without it. `RELAY_PORT` (advanced) keeps an
existing hub on the relay port its spokes already use.

## Running a hub

A hub is sequence B of the install page: `PROFILE=hub`, a provider key and `PUBLIC_IP`.
The profile carries the control plane, the stores and the relay, plus the compute a hub
needs to dispatch next to its posteriors; `hub-minimal` omits the compute.

**Open the firewall** on the hub for the ports the install page's port table marks
"spokes" (trace store, development-vessel, discovery, identity, concept-db, relay). On a
cloud VM the cloud firewall is usually the gate, not the host's own packet filter.

Verify before pointing a spoke at it — an empty array here is the whole failure,
and it looks identical to a healthy hub from every other angle:

```bash
curl -s http://<hub>:<disc-port>/bootstrap | jq '.relay_multiaddrs | length'   # must be > 0
```

**Addressing, if hub and spoke are on the same host.** The endpoint has to be
reachable from *inside* the spoke container, which `localhost` is not — that
resolves to the spoke's own loopback and yields a container that boots, looks
healthy, and is joined to nothing. Use an address that answers from both
positions; on a single host that is usually the machine's LAN IP, not
`127.0.0.1` and not the docker bridge gateway.

## Running a spoke

The supported spoke topology is the **federated spoke**: a local registry
(discovery, role `registry`) + compute vessels here, with the hub supplying the
trace store and identity. Vessels register **locally**; the
federation-transport-vessel mirrors the local capability surface into the hub
as `<vessel>@<substrate-id>` rows dialable over the relay. This is what keeps a
NAT'd machine reachable and its Obsidian surface local-first. Setup is
point-and-go: two install inputs, `DISCOVERY_ENDPOINT` and a hub-issued
`METABOB_API_KEY` (install page, sequence C).

A remote `DISCOVERY_ENDPOINT` is what makes this container a spoke: `gen-env.sh`
infers `role=spoke` from the remote host, derives the hub discovery, activity
store, and identity endpoints from that one URL, and auto-generates + persists a
unique `FED_SUBSTRATE_ID` / `FED_VESSEL_ID`. At boot, `entrypoint.sh`
auto-enables the federation-transport-vessel whenever a hub is set, and the
transport self-derives its relay from `<hub-discovery>/bootstrap` — so the
ingress/egress fall out of the discovery anchor alone, with no relay multiaddr
or federation id to supply. A spoke is **designed** to need no local LLM key — it is meant to inherit the
hub's LLM arms through discovery.

> ⚠ **Federation is one-directional until the hub side is anchored too.** A
> spoke's vessels mirror into the hub and refresh on the ~2-minute heartbeat,
> while a spoke resolving a *hub-owned* shape gets `found:false` — the same
> query answered directly by the hub returns `found:true`, so this is a real
> negative and not a query-form artifact. **Give a spoke its own provider key**
> if it must resolve models. The diagnosis and the correct direction are in
> *Known limitations* below; the short version is that the hub must be running
> its own federation transport over a live relay circuit, and that the fix is
> **not** an advertised host address per vessel.

To change a spoke's hub, credential, profile or federation overrides, edit its `.env`
and recreate it through the manifest (install page, usage patterns); the named volumes,
and with them the learning state and the persisted federation id, are kept.

**Optional override — pin a specific id or relay.** The auto-generated
`FED_SUBSTRATE_ID` is unique per substrate: it names the mirror rows AND salts
the transport's libp2p key — two substrates sharing an id derive the same peer
id and fight over the relay reservation. To pin a chosen id (or a specific
relay), enable the transport explicitly instead of relying on the boot default:

`FED_SUBSTRATE_ID` is generated and persisted on first boot, so a spoke needs nothing
here. To pin it (a stable mirror-row name across recreates), set `FED_SUBSTRATE_ID`, and
optionally `RELAY_MULTIADDR`, in the `.env` as advanced configuration; gen-env reads them
before systemd starts. Read the value a running spoke settled on:

```bash
docker exec <container> substrate-config | grep FED_SUBSTRATE_ID
```

(The enable step refuses ids already present in the hub registry.)

A **thin spoke** — all control-plane calls pointed straight at the hub, no
local registry — remains available by passing the endpoints explicitly
(`ENABLED_ROLES=spoke DISCOVERY_ENDPOINT=... ACTIVITY_API_ENDPOINT=...
IDENTITY_VESSEL_URL=...`); outbound-only, since the hub cannot dial back.

**Getting the hub-issued key** is one command on the hub — no raw API calls:

```bash
# on the hub host
docker exec <container> substrate-key issue spoke-<location>
# → prints the key once; hand it to the spoke as METABOB_API_KEY
```

(`substrate-key issue` in-container does the same; `docker exec <container> substrate-key list` /
`docker exec <container> substrate-key revoke ...` manage the fleet's keys. See
`docs/SUBSTRATE.md` § "Keys and tokens".)

A vessel **behind NAT** (e.g. a host Obsidian plugin) that can't be dialed directly uses
the **libp2p ingress sidecar** — the vessel stays plain HTTP, the sidecar carries libp2p.
The complete federated config is **two values** — a **discovery endpoint** and an
**API key** (Obsidian's `sidecar/federation-sidecar.ts` shown; the generic
`@avigopal/libp2p-federation-transport` sidecar takes the same inputs):

```
METABOB_API_KEY=<api-key> \
DISCOVERY_ENDPOINT=<discovery-endpoint> \
bun sidecar/federation-sidecar.ts
```

Everything else is resolved from `<discovery-endpoint>/bootstrap` (an explicit env
always wins as an override): the relay anchor and identity endpoint come from the
bootstrap response, the vessel id from the machine hostname
(`obsidian-<hostname>-vessel` — host-unique, so libp2p identities never collide),
and the plugin URL / health port use their fixed defaults. A hand-set
`RELAY_MULTIADDR` is an **optional override** that pins a specific relay — it can go
stale on a relay restart, which is exactly what the `/bootstrap` fetch avoids.

The sidecar reserves on the relay, serves resolves over libp2p (proxying to the local
vessel), and registers `protocol:"libp2p"` with the hub discovery. The hub
then resolves those shapes over the relay — the vessel never learns libp2p is involved.

## Joining by multiaddr

A peer multiaddr is the anchor the transport prefers, because it survives a re-IP:
**a multiaddr names a peer identity, a URL names a host**. A launch still names
`DISCOVERY_ENDPOINT`: the image accepts `PEER_MULTIADDR` only alongside it and refuses the
launch otherwise, so a container's role is never guessed from an overlay address.

The join inputs are `DISCOVERY_ENDPOINT`, `METABOB_API_KEY` and
`PEER_MULTIADDR=/dns4/<peer>/tcp/4001/p2p/<peerId>`; the multiaddr is the anchor the
transport tries first.

The transport dials that peer over libp2p and asks it for `substrateBootstrap`,
which the peer answers from its own discovery. The relay anchor, identity endpoint
and discovery endpoint come back over the overlay, and the joiner never needs an
HTTP endpoint for the peer.

This inverts the URL path deliberately. A URL join derives the relay *from* a
discovery endpoint; a multiaddr join learns it *through* a peer already reachable,
because the multiaddr is itself the reachability. When both are supplied the peer
anchor is tried first — an operator who gave a multiaddr chose a peer, not a host.

Anchors learned this way are held in memory and served at `:8401/anchors`. They are
deliberately **not** written to `/etc/substrate/env`: `gen-env` truncates that file
on every boot, which is exactly why the documented hand-carry of `RELAY_MULTIADDR`
never survived a restart. Freezing a value that changes is the bug, not the storage.

**Discovery itself is reachable over the overlay**, which is what makes this
possible. It needs a special case, because `discovery-vessel` does not register
itself into its own registry — so a `vesselCapability` lookup for `vesselRegistry`
finds no owner, and the one vessel every joiner must reach is the one vessel that
cannot be found by the mechanism used to find vessels. The transport ingress
answers `vesselRegistry`, `vesselCapability`, `vesselEndpoint`, `vesselHealth` and
`substrateBootstrap` directly rather than through shape-owner lookup.

`substrateBootstrap` is unauthenticated over the overlay, matching discovery's own
public treatment of `GET /bootstrap`: a joiner has not yet been told the identity
authority, so requiring a credential to learn where that authority lives is a
chicken-and-egg. It returns routing anchors only — never registry contents. The
four registry shapes remain credentialed.

**Not yet complete.** The identity namespace still reaches the hub over HTTP via
`IDENTITY_VESSEL_URL`, so a multiaddr-only join currently federates at the overlay
layer without inheriting the hub's `org_id`. The identity shim and caller-credential
threading are the remaining pieces of the three-input contract.

## Known limitations

Read these before concluding a deployment is federated.

**A substrate has exactly one overlay identity.** Every `<vessel>@<substrate>`
row a transport mirrors carries *that transport's* libp2p peer id and circuit;
per-vessel addressing happens inside the request (`pointer._fedTargetVessel`),
not by giving each vessel its own multiaddr. A registration loop that omits
`protocol` / `libp2p_peer_id` / `libp2p_multiaddr` is therefore behaving
correctly, not under-advertising. `VESSEL_ADVERTISE_ENDPOINT` /
`SUBSTRATE_ADVERTISE_HOST` exist in the registration client, but they are a
host-address override, not the supported mechanism — prescribing them would pin
a substrate to a host, which is exactly what the architecture forbids.

**Why hub-owned shapes do not resolve from a spoke.** Discovery keeps only
*dialable* peer rows — a non-empty `libp2p_multiaddr`, or a non-loopback
endpoint — and a hub vessel registers itself on loopback with neither. What
would make it dialable is the **hub's own** federation transport mirroring it
with the hub transport's circuit. That mirror is skipped whenever the transport
holds no live relay circuit: `registerAtHub` returns early and publishes
nothing. So the missing piece is a relay the hub transport can reserve on, plus
that transport running — not an address advertised per vessel. Until then,
resolution works spoke → hub only.

**Direct-only federates nothing, and nothing loudly says so.** Since the
transport no longer exits when it has no anchor, an anchorless spoke comes up
`active`, answers `/health` with `ok`, and mirrors **nothing** — `registerAtHub`
is skipped for want of a circuit. The previous behaviour was a crash loop, which
the self-recovery watchdog noticed; the current one is quiet. The unit's state
is therefore no longer evidence of federation. Check the transport's health
payload for a non-zero `activeReservations` and a non-empty `libp2p_multiaddr`,
or check that the substrate's rows in the **hub's** registry carry a circuit
multiaddr. The throttled journal line `no relay anchor (direct-only) — remote
visibility suspended` is the other signal.

**Direct-only reachability is narrower than it sounds.** Without a circuit the
transport advertises only its direct listen addresses, on an ephemeral port that
no deployment publishes. Those addresses are reachable from inside the
container's own network and not from another host, so a relay-less transport is
usable for *egress* to a relayed peer, but is not itself remotely dialable.

**Over a circuit, only the lpStream path carries real payloads.** Measured across
a live relay, per payload class: the lpStream path (`resolveViaLibp2p`) round-trips
every class byte-identically — 1 B, the 1023/1024/1025 B chunk boundary, 64 KB,
unicode, base64 binary, and 64-level nested JSON. The HTTP-over-libp2p path
(`resolveViaHttp`) carries the 1-byte case and fails every class above it. The same
matrix over a *direct* connection passes on both paths, so the ceiling is
specifically HTTP-over-libp2p **across a circuit**. Callers that must move more
than a token payload cross-substrate should use the lpStream path; the HTTP path
remains only for peers that have not migrated.

**`limits` tells you the relay's policy, not the path.** A connection's
`limits != null` means the circuit is byte/time capped, and a relay run with
`applyDefaultLimit: false` — which `scripts/substrate/federation-relay/relay.ts`
does — produces uncapped circuits, so a genuinely relayed connection reports
"not limited". To tell relayed from direct, look for a `/p2p-circuit` component in
the connection's negotiated `remoteAddr`; treat `limits` as information about the
relay, not about the route.

**A federation unit that hard-exits is invisible.** `federation-relay` exits
non-zero when `PUBLIC_IP` is unset, and under `Restart=always` that parks it in
`activating` forever — it never reaches `failed`, so no `ActiveState` check above
it fires. Supply the value as a unit drop-in rather than appending it to
`/etc/substrate/env`, which `gen-env` truncates on every boot; that truncation is
why the documented hand-carry of `RELAY_MULTIADDR` never survived a restart.

## End-to-end harness

`repos/libp2p-federation-transport/federation-hub-e2e.ts` exercises the full loop
against a hub: a NATed node reserves on the public relay → registers into the hub
namespace → hub discovery echoes the circuit multiaddr → a second node resolves the
shape **through the public relay**. Run it with `RELAY_MULTIADDR`, `DISCOVERY_URL`,
`HUB_KEY` set to confirm the mechanism against any live deployment.

## Components

| Piece | Where | Role |
|---|---|---|
| `@avigopal/libp2p-federation-transport` | `repos/libp2p-federation-transport` | the libp2p primitive + ingress sidecar |
| relay | `scripts/substrate/federation-relay/relay.ts` | Circuit Relay v2 on a public IP; runs in-container in the `hub` and `hub-minimal` profiles |
| discovery federation | `repos/discovery-vessel` | peer fan-out + libp2p multiaddr echo |
| goal-host egress | `repos/goal-host-vessel` | routes `protocol:libp2p` resolves via the transport egress |
