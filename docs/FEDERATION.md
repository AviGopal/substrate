# Federation

How substrate instances share a namespace or federate as peers, and how a vessel
(local or behind NAT) joins over the libp2p relay.

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
        │  ENABLED_ROLES=hub                            │
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
  latency. `ENABLED_ROLES=spoke` + hub endpoints + a hub-issued
  `METABOB_API_KEY`. The spoke's vessels must advertise endpoints the hub's
  callers can reach (`VESSEL_ADVERTISE_ENDPOINT` / `SUBSTRATE_ADVERTISE_HOST`).
- **Peer-substrate (federation)** — separate org, separate learning state, an
  adversarial-tolerant boundary, or a whole fleet on a remote host: own
  store/identity + `PEER_DISCOVERY_ENDPOINTS` + `FEDERATION_SIGNING_SECRET`
  (+ the libp2p relay when NAT'd). Capability queries fan out; goal-host routes
  via `peerEndpoint`/libp2p, never the peer vessel's loopback `endpoint`.

Both remain supported; pick by trust domain and learning-state ownership, not
by geography.

## Three-location operational space

The full topology this repo demonstrates: **hub** (a public VM) runs the shared
activity/learning surface (`ENABLED_ROLES=hub`: activity-api + discovery +
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
on a public IP (the hub) and brokers connections; DCUtR then tries a direct hole-punch,
falling back to permanently-relayed for symmetric NAT. Noise encrypts end-to-end — the
relay never sees plaintext. Run it with the VM's public IP:

```
PUBLIC_IP=<vm-ip> RELAY_KEY_FILE=~/relay-key.pb bun scripts/substrate/federation-relay/relay.ts
# → prints RELAY_MULTIADDR=/ip4/<ip>/tcp/30333/p2p/<relay-peerid>
```

## Deploying a hub

```
GITHUB_PAT=<repo-scope>  ANTHROPIC_API_KEY=sk-ant-...  SSH_KEY=~/.ssh/<key> \
  bash scripts/substrate/deploy-hub.sh root@<vm-ip> <vm-public-ip>
```

`deploy-hub.sh` **pulls the repo and builds on the VM** (no multi-GB image ship): clones
`AviGopal/substrate` (+ submodules), builds, runs `ENABLED_ROLES=hub`,
seeds the shared org, and starts the relay. Bare-Ubuntu deps (make/bun/unzip) are
auto-installed.

**Open the firewall** on the hub VM: TCP `18080` (activity-api), `18100` (discovery),
`18101` (identity), `18210` (goal-host), and `30333` (relay). On DigitalOcean this is the
**cloud firewall** (the droplet's ufw/iptables are not the gate).

## Running a spoke

The supported spoke topology is the **federated spoke**: a local registry
(discovery, role `registry`) + compute vessels here, with the hub supplying the
trace store and identity. Vessels register **locally**; the
federation-transport-vessel mirrors the local capability surface into the hub
as `<vessel>@<substrate-id>` rows dialable over the relay. This is what keeps a
NAT'd machine reachable and its Obsidian surface local-first. Setup is **one
command** — point-and-go:

```bash
make -C scripts/substrate up API_KEY=<hub-issued-key> \
  DISCOVERY_ENDPOINT=http://<hub-host>:18100
```

A remote `DISCOVERY_ENDPOINT` is what makes this container a spoke: `gen-env.sh`
infers `role=spoke` from the remote host, derives the hub discovery, activity
store, and identity endpoints from that one URL, and auto-generates + persists a
unique `FED_SUBSTRATE_ID` / `FED_VESSEL_ID`. At boot, `entrypoint.sh`
auto-enables the federation-transport-vessel whenever a hub is set, and the
transport self-derives its relay from `<hub-discovery>/bootstrap` — so the
ingress/egress fall out of the discovery anchor alone, with no relay multiaddr
or federation id to supply. A spoke also needs **no local LLM key**: it inherits
the hub's LLM arms through discovery.

`up` resumes a stopped container only when no launch settings are supplied. To
change its hub, credential, role selection, or federation overrides, preserve
the named volumes and recreate the container with the new inputs:

```bash
make -C scripts/substrate recreate API_KEY=<hub-issued-key> \
  DISCOVERY_ENDPOINT=http://<hub-host>:18100
```

**Optional override — pin a specific id or relay.** The auto-generated
`FED_SUBSTRATE_ID` is unique per substrate: it names the mirror rows AND salts
the transport's libp2p key — two substrates sharing an id derive the same peer
id and fight over the relay reservation. To pin a chosen id (or a specific
relay), enable the transport explicitly instead of relying on the boot default:

```bash
make -C scripts/substrate vessel-ctl enable federation-transport-vessel \
  FED_SUBSTRATE_ID=<unique-id> [RELAY_MULTIADDR=<addr>]
```

(The enable step refuses ids already present in the hub registry.)

A **thin spoke** — all control-plane calls pointed straight at the hub, no
local registry — remains available by passing the endpoints explicitly
(`ENABLED_ROLES=spoke DISCOVERY_ENDPOINT=... ACTIVITY_API_ENDPOINT=...
IDENTITY_VESSEL_URL=...`); outbound-only, since the hub cannot dial back.

**Getting the hub-issued key** is one command on the hub — no raw API calls:

```bash
# on the hub host
make -C scripts/substrate issue-key NAME=spoke-<location>
# → prints the key once; hand it to the spoke as METABOB_API_KEY
```

(`substrate-key issue` in-container does the same; `make list-keys` /
`make revoke-key KEY_ID=...` manage the fleet's keys. See
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
| relay | `scripts/substrate/federation-relay/relay.ts` | Circuit Relay v2 on a public IP |
| discovery federation | `repos/discovery-vessel` | peer fan-out + libp2p multiaddr echo |
| goal-host egress | `repos/goal-host-vessel` | routes `protocol:libp2p` resolves via the transport egress |
| `deploy-hub.sh` | `scripts/substrate` | pull-the-repo hub deploy |
