# Federation

How substrate instances share a namespace or federate as peers, and how a vessel
(local or behind NAT) joins over the libp2p relay.

This document holds the protocol and the concepts. The commands that launch a hub, a
spoke or a surface are in [README § Installation](../README.md#installation) (sequences
B, C and D), the only place setup commands appear.

## Point-and-go (the default join)

A node joins a network with **one** input: a **join token** the hub issues
(`docker exec <hub> substrate-key join <name>`). The token is
`sj1.<base64url of "<discovery endpoint>\n<api key>">` — the discovery endpoint the hub
advertises in its own `/bootstrap`, built from its `PUBLIC_IP` and published ports, and a
key issued for that node. Nobody types a port. The hub prints the token together with
the command the joiner runs, and the installer unpacks it into the two join inputs,
`DISCOVERY_ENDPOINT` and `METABOB_API_KEY`. Supplying those two directly is the
equivalent explicit form: underneath, a join is always one **discovery endpoint** and
one **API key**.

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

`discovery_endpoint` and `identity_endpoint` are the hub's public addresses, derived from
`PUBLIC_IP` and the published port prefix (or `DISCOVERY_PUBLIC_URL` /
`IDENTITY_PUBLIC_URL` when set). `substrate-key join` refuses to mint a token while the
advertised discovery endpoint is empty or loopback, because a joiner elsewhere could not
use it.

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

A hand-set relay multiaddr is an **optional override**, not a requirement — useful
only to pin a specific relay or when `/bootstrap` is unreachable. A pinned multiaddr
goes stale: a relay peer id changes on every relay restart, and the `/bootstrap` fetch
is what keeps the anchor current. Discovery is the anchor an operator points at; the
relay multiaddrs, identity endpoint, and preferred transport are returned *by*
`/bootstrap`.

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
namespace, no reconciliation code (`discovery/src/registry.ts isAccessibleTo`). The
namespace is therefore a property of the key, not of the network: a join token carries a
key in the hub operator's organisation, and a node meant to belong to a different
organisation on the same hub needs a key issued in that organisation.

### 2. Federation peers — separate substrates that fan out

Each instance runs its own full stack; a capability query with **no local producer**
fans out to configured peers.

```
  substrate A  ⇄  substrate B     (each: PEER_DISCOVERY_ENDPOINTS points at the other)
```

Set `PEER_DISCOVERY_ENDPOINTS=http://<peer>:<P100>` (the peer's discovery port, `P` its
port prefix; + optional shared `FEDERATION_SIGNING_SECRET`). Discovery forwards
unresolved `vesselCapability` queries, tags peer results `discoveredVia:"peer"`, and
goal-host routes those over the relay.

**A local producer shadows the network.** Fan-out fires only when there is *no* local
producer of the shape. A local vessel that advertises a shape but cannot serve it — a
goal-host with no reachable model, say — is still a local producer, so the query never
leaves the node and a working producer elsewhere is never asked. Every vessel a node
advertises must have its own consumed shapes produced locally or on the hub; one that
does not is worse than absent.

## Choosing a topology (decision rule)

- **Hub-registration (spoke)** — one vessel or a small *trusted* set joining an
  existing substrate: same org, same learning state, same trust domain, lowest
  latency. One join token (equivalently, `DISCOVERY_ENDPOINT` naming the hub + a
  hub-issued `METABOB_API_KEY`); the `spoke` role follows from it. The spoke's vessels
  are made reachable by the spoke's **own federation transport**, which mirrors each of
  them into the hub as a `<vessel>@<substrate-id>` row carrying that transport's libp2p
  peer id and circuit — reachability is the substrate's one overlay identity, not a host
  address advertised per vessel.
- **Peer-substrate (federation)** — separate org, separate learning state, an
  adversarial-tolerant boundary, or a whole fleet on a remote host: own
  store/identity + `PEER_DISCOVERY_ENDPOINTS` + `FEDERATION_SIGNING_SECRET`
  (+ the libp2p relay when NAT'd). Capability queries fan out; goal-host routes
  via `peerEndpoint`/libp2p, never the peer vessel's loopback `endpoint`.

Both remain supported; pick by trust domain and learning-state ownership, not
by geography.

## Where work runs in a hub + spoke network

Placement follows data locality, and a resolve's route depends on whether it names a
vessel:

- **A resolve that names a spoke vessel goes to that spoke.** On the hub, the federation
  transport's `/egress/resolve?vessel=<vessel>@spoke-<id>` (or a goal's
  `target_vessel_id`) is carried over the relay circuit to the spoke, whose transport
  hands it to the named vessel. The spoke answers from its own disk and tools.
- **A resolve that names no vessel goes to the hub's own producer first.** A hub that
  serves the shape answers it locally; that is data locality, not a routing failure.
- **A goal dispatched on a spoke runs on the spoke.** Its walk uses the spoke's own tools
  and resolvers, borrows the hub's model arms for `llm_completion` through discovery, and
  its execution trace lands in the hub's trace store, where the learning state lives.
- **A spoke needs no provider key.** It runs no model resolver of its own and reaches
  `usable` when its hub's arms answer.

A host's Obsidian vault joins the same space as an implicit-vessel surface through
`federation-relay/obsidian-passthrough.ts`: a sidecar that reserves on the hub relay,
registers `obsidian_*` shapes into hub discovery (`protocol:"libp2p"` + circuit
multiaddr), and proxies resolves to the plugin. A goal dispatched anywhere in the network
then reaches that vault with no pinning: goal-target inference picks the shape from the
peer-unioned shape vocabulary, and the resolve is carried over the relay circuit to the
sidecar and on to the plugin.

## The relay (NAT traversal)

A vessel behind NAT can't be dialed directly. The **libp2p Circuit Relay v2** relay runs
on a public address (the hub) and brokers connections; DCUtR then tries a direct
hole-punch, falling back to permanently-relayed for symmetric NAT. Noise encrypts
end-to-end — the relay never sees plaintext.

In the `hub` and `hub-minimal` profiles the relay runs **inside the container** and is
published at the prefix-derived host port `P333`, which `/bootstrap` advertises at the
hub's `PUBLIC_IP`. (The port it listens on inside the container is an internal detail;
`P333` is the address spokes dial.) That is why a hub cannot omit `PUBLIC_IP`: it is the
address spokes reach, and the relay announces nothing reachable without it.
`RELAY_PORT` (advanced) keeps an existing hub on the relay port its spokes already use.

## Two networks

A deployment involves two distinct networks. The **container network** is the engine's
bridge between a container and its host; the **federation network** is discovery,
identity, the relay and the libp2p overlay between instances. They have separate
lifecycles: tearing down one fleet's container network must never remove a relay or
network another fleet depends on.

## Running a hub

A hub is sequence B of the install page: `PROFILE=hub`, a provider key and `PUBLIC_IP`.
The profile carries the control plane, the stores and the relay, plus the compute a hub
needs to dispatch next to its posteriors; `hub-minimal` omits the compute.

**Open the firewall** on the hub for the ports the install page's port table marks
"spokes" (trace store, development-vessel, discovery, identity, concept-db, relay). On a
cloud VM the cloud firewall is usually the gate, not the host's own packet filter.

Verify before handing out a token — an empty array here is the whole failure,
and it looks identical to a healthy hub from every other angle:

```bash
curl -s http://<hub>:<P100>/bootstrap | jq '.relay_multiaddrs | length'   # must be > 0
```

Each joining node gets its own token from `docker exec <hub> substrate-key join <name>`;
the key inside it is printed once and never stored. `substrate-key issue <name>` mints a
bare key for the explicit two-value form, and `substrate-key list` /
`substrate-key revoke <key-id>` manage the fleet's keys (see [`SUBSTRATE.md`](SUBSTRATE.md)
§ "Keys and tokens").

**Addressing, if hub and joiner are on the same host.** The endpoint has to be
reachable from *inside* the joining container, which `localhost` is not — that
resolves to the container's own loopback and yields a container that boots, looks
healthy, and is joined to nothing. Under rootless Podman the host's LAN address is not
reachable from inside a container either, and the join is refused at boot; address the
hub by the engine's host name instead (`host.containers.internal` on Podman,
`host.docker.internal` on Docker). The hub's `PUBLIC_IP` can stay the LAN address: the
relay is dialled by the joiner's transport, which reaches it. Sequence C of the install
page carries the exact form.

## Running a spoke

The supported spoke topology is the **federated spoke**: a local registry
(discovery, role `registry`) + compute vessels here, with the hub supplying the
trace store and identity. Vessels register **locally**; the
federation-transport-vessel mirrors the local capability surface into the hub
as `<vessel>@<substrate-id>` rows dialable over the relay. This is what keeps a
NAT'd machine reachable and its Obsidian surface local-first. Setup is
point-and-go: one join token (install page, sequence C).

A remote `DISCOVERY_ENDPOINT` is what makes this container a spoke: `gen-env.sh`
infers `role=spoke` from the remote host and derives the hub discovery, activity
store, and identity endpoints from that one URL. At boot, `entrypoint.sh`
auto-enables the federation-transport-vessel whenever a hub is set, and the
transport self-derives its relay from `<hub-discovery>/bootstrap` — so the
ingress/egress fall out of the discovery anchor alone, with no relay multiaddr
or federation id to supply.

**The federation id is minted, not supplied.** A node's first boot mints
`FED_SUBSTRATE_ID=spoke-<hex>` and persists it in the workspace volume, so it survives
restarts and recreates. The id names the mirror rows — a spoke's vessels appear in the
hub registry as `<vessel>@spoke-<hex>` with `protocol: libp2p` and the spoke's circuit
multiaddr — and salts the transport's libp2p key, so two substrates sharing an id derive
the same peer id and fight over the relay reservation. Every node mints one, so a hub's
own transport mirrors the hub's vessels too, and the hub registry lists them as
`@spoke-<hex>` rows alongside their plain local rows. Read the value a running node
settled on:

```bash
docker exec <container> substrate-config | grep FED_SUBSTRATE_ID
```

Pinning a chosen id (a stable, readable mirror-row name) is **optional**, never required:
set `FED_SUBSTRATE_ID`, and optionally `RELAY_MULTIADDR`, in the fleet's `.env` as advanced
configuration, or run `docker exec <container> spoke-federate <container> <id>` on a
running spoke, which refuses an id already present in the hub registry.

To change a spoke's hub, credential, profile or federation overrides, edit its `.env`
and recreate it through the manifest (install page, usage patterns); the named volumes,
and with them the learning state and the persisted federation id, are kept.

A **thin spoke** — all control-plane calls pointed straight at the hub, no
local registry — remains available by passing the endpoints explicitly
(`ENABLED_ROLES=spoke DISCOVERY_ENDPOINT=... ACTIVITY_API_ENDPOINT=...
IDENTITY_VESSEL_URL=...`); outbound-only, since the hub cannot dial back.

A vessel **behind NAT** (e.g. a host Obsidian plugin) that can't be dialed directly uses
the **libp2p ingress sidecar** — the vessel stays plain HTTP, the sidecar carries libp2p.
The sidecar takes the two underlying join values, a **discovery endpoint** and an
**API key**, rather than a join token (Obsidian's `sidecar/federation-sidecar.ts` shown;
the generic `@avigopal/libp2p-federation-transport` sidecar takes the same inputs):

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

## Verifying a join

Process state is not readiness, and an advertised route or an HTTP 200 is not proof. A
node is joined when all of these hold:

- **The reservation is held.** Read it inside the container (the transport's health port
  is not published): `docker exec <container> curl -s http://127.0.0.1:8401/health`.
  `.transport.reservationsHeld` counts the reservations the relay actually granted and is
  the authoritative number. `.transport.activeReservations` counts circuit *listen
  addresses*, which can outlive the reservation behind them, and
  `.transport.phantomSuspected` is `true` when a circuit is advertised with no
  reservation held. `reservationsHeld` of `0` means not federated.
- **Identity came from the hub.** A spoke runs no identity-vessel, so a valid
  `docker exec <container> substrate-key whoami` can only have been answered by the hub.
- **The rows are on the hub, with a circuit.** The spoke's vessels are listed in the
  hub's registry as `<vessel>@spoke-<hex>` carrying a `/p2p-circuit` multiaddr. Read
  them through the `vesselCapability` shape (`POST /resolve`): discovery's
  `GET /vessels/:id` omits the `protocol` and libp2p fields, so it cannot show whether a
  row is dialable.
- **Both directions resolve.** From the hub, a resolve that names a spoke vessel
  (`/egress/resolve?vessel=<vessel>@spoke-<hex>`) is answered by the spoke; from the
  spoke, a hub-owned shape resolves.
- **A goal reaches.** A goal dispatched on the spoke is `reached`, and its execution trace
  is durable in the hub's trace store.

The same checks hold after a stop/start or a recreate: the persisted identity and
federation id mean a restarted node re-registers under the same rows. When judging that,
ask whether the hub's rows were *refreshed after* the restart, not whether they are
present — registry records outlive the process that wrote them by their TTL.

## Joining by multiaddr

A peer multiaddr is the anchor the transport prefers, because it survives a re-IP:
**a multiaddr names a peer identity, a URL names a host**. A launch still names
`DISCOVERY_ENDPOINT`: the image accepts `PEER_MULTIADDR` only alongside it and refuses the
launch otherwise, so a container's role is never guessed from an overlay address.

The join inputs are `DISCOVERY_ENDPOINT`, `METABOB_API_KEY` and
`PEER_MULTIADDR=/dns4/<peer>/tcp/<port>/p2p/<peerId>`; the multiaddr is the anchor the
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
on every boot, so a hand-carried `RELAY_MULTIADDR` there never survives a restart.
Freezing a value that changes is the bug, not the storage.

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

**The identity namespace is reached over HTTP.** Identity is validated through
`IDENTITY_VESSEL_URL`, not over the overlay, so the `DISCOVERY_ENDPOINT` a multiaddr join
still names is what gives the joiner the hub's `org_id`; the overlay alone federates
reachability, not the namespace.

## Known limitations

Read these before concluding a deployment is federated.

**A substrate has exactly one overlay identity.** Every `<vessel>@<substrate>`
row a transport mirrors carries *that transport's* libp2p peer id and circuit;
per-vessel addressing happens inside the request (`pointer._fedTargetVessel`, set from
`?vessel=`), not by giving each vessel its own multiaddr. A vessel registration loop
that omits `protocol` / `libp2p_peer_id` / `libp2p_multiaddr` is therefore behaving
correctly, not under-advertising. `VESSEL_ADVERTISE_ENDPOINT` /
`SUBSTRATE_ADVERTISE_HOST` exist in the registration client, but they are a
host-address override, not the supported mechanism — prescribing them would pin
a substrate to a host, which is exactly what the architecture forbids.

**Mirroring needs a live circuit, on both sides.** Discovery keeps only *dialable* peer
rows — a non-empty `libp2p_multiaddr`, or a non-loopback endpoint — and a vessel
registers itself on loopback with neither. What makes it dialable from elsewhere is its
substrate's federation transport mirroring it with that transport's circuit, which is
why a hub's own vessels also appear as `@spoke-<hex>` rows. The mirror is skipped
whenever the transport holds no live relay circuit: `registerAtHub` returns early and
publishes nothing. A node whose transport has no circuit is reachable outbound only.

**Direct-only federates nothing, and nothing loudly says so.** Since the transport does
not exit when it has no anchor, an anchorless node comes up `active`, answers `/health`
with `ok`, and mirrors **nothing** — `registerAtHub` is skipped for want of a circuit.
The self-recovery watchdog notices a crash loop, not this. The unit's state is therefore
not evidence of federation. Check the transport's health payload for a non-zero
`reservationsHeld` and a non-empty `libp2p_multiaddr`, or check that the substrate's rows
in the **hub's** registry carry a circuit multiaddr. The throttled journal line
`no relay anchor (direct-only) — remote visibility suspended` is the other signal.

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
it fires. Supply the value through the fleet's `.env` and a recreate rather than
appending it to `/etc/substrate/env`, which `gen-env` truncates on every boot.

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
| federation transport | `scripts/substrate/federation-relay/federation-transport-server.ts` | per-node mirror into the hub, `/egress/resolve`, health on `:8401` |
| relay | `scripts/substrate/federation-relay/relay.ts` | Circuit Relay v2 on a public IP; runs in-container in the `hub` and `hub-minimal` profiles |
| discovery federation | `repos/discovery-vessel` | `/bootstrap`, peer fan-out + libp2p multiaddr echo |
| goal-host egress | `repos/goal-host-vessel` | routes `protocol:libp2p` resolves via the transport egress |
| join token | `scripts/substrate/substrate-key.sh` (`join`), `scripts/substrate/substrate-install.sh` | mint and unpack the one-input join |
