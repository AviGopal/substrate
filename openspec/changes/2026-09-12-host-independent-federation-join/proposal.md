# Host-independent join — a substrate of any vessel inventory joins the common discovery+identity network with one anchor, and stays routable when punchthrough is unavailable

**Date:** 2026-09-12
**Vessels:** discovery-vessel (`src/index.ts` `/bootstrap`, registration replication), `scripts/substrate/federation-relay/federation-transport-server.ts` (startup gate, relay re-acquisition), `scripts/substrate/gen-env.sh` (anchor precedence, hub peer wiring)
**Stage:** SPEC — grounded in a live probe of `substrate-live` on 2026-09-12, plus a code trace of the join path
**Predecessor:** `openspec/changes/2026-07-19-relay-findability-replication/proposal.md`. Its operator-ratified decision — *"the relay won't always be available due to networking conditions, so internally a direct connection should be equivalent to a punchthrough"* — is the governing decision here. **Three of its four approach items never landed.** This change implements them and adds the two defects the live probe surfaced.

## The objective, restated as invariants

1. **Inventory independence.** A substrate container running *any* subset of vessels joins one common discovery + identity network. Nothing about which units are enabled changes how it joins.
2. **Host independence.** No joining path may depend on a host IP, a host workspace, or a hand-carried address. The single anchor is a discovery endpoint; everything else is read from it at use time (law 1), and the anchor itself must be expressible without knowing the host it lands on.
3. **Routability without punchthrough.** Reachability degrades in this order and never below the last rung: direct dial → DCUtR hole-punch → permanently-relayed circuit. A NAT that blocks punchthrough must cost latency, not reachability.

## Live probe (2026-09-12, `substrate-live`, up 2 days, healthy)

Every number below is from the running system, not from a document.

### Defect A — a dead host IP, pinned in a host workspace file, has removed this substrate's libp2p node entirely

```
$ docker exec substrate-live systemctl is-active federation-transport-vessel
activating                                  # Restart=always: never `failed`, restart counter 23

$ docker exec substrate-live journalctl -u federation-transport-vessel -n 25
[fed-transport] bootstrap fetch failed: The operation timed out.
[fed-transport] ERROR: set RELAY_MULTIADDR or point BOOTSTRAP_URL/HUB_DISCOVERY_URL at a discovery serving /bootstrap
```

The cause is an address, and it is exactly the thing invariant 2 forbids:

```
$ docker exec substrate-live grep -E '^HUB_DISCOVERY_URL=' /etc/substrate/env /workspace/.substrate-secrets
/etc/substrate/env:HUB_DISCOVERY_URL=""
/workspace/.substrate-secrets:HUB_DISCOVERY_URL=http://138.197.116.56:18100

$ curl -s --max-time 6 -o /dev/null -w '%{http_code}' http://138.197.116.56:18100/bootstrap
000                                          # unreachable, 6s timeout
```

The unit loads `/etc/substrate/env` first and `-/workspace/.substrate-secrets` second, so the **host workspace file wins** over the substrate's own env — a hardcoded droplet IP from a hub that no longer answers. `BOOTSTRAP_URL` resolves to that dead IP (`federation-transport-server.ts:47`, `HUB_DISCOVERY_URL` preferred over local `DISCOVERY`), the fetch times out, and the process exits 1. Meanwhile the **local** `/bootstrap` answers in 0.7ms from inside the same container:

```
$ docker exec substrate-live curl -s -o /dev/null -w '%{http_code} %{time_total}' http://127.0.0.1:8100/bootstrap
200 0.000667
```

Consequence: a stale host address in a host-workspace file silently deleted the whole overlay for this substrate, and the only symptom is a unit parked in `activating`. This is a direct violation of law 11 (location independence) and reproduces the operator-memory class *"a restart loop reports `activating`, never `failed`."*

### Defect B — the direct-dial path exists but is unreachable, because startup hard-gates on a relay anchor

```ts
// federation-transport-server.ts, as measured (see "Claim re-check": this gate is now
// removed in the working tree, and still present in the running image)
if (!RELAY) { console.error('[fed-transport] ERROR: set RELAY_MULTIADDR or point …'); process.exit(1) }
```

The transport already *announces* direct listen addresses alongside the circuit — the 2026-07-19 decision partially landed (`:326` "registration rows must announce the node's DIRECT listen…", `:524` and `:647` "circuit first, then direct listen addrs — direct ≡ punchthrough"). But none of that code can ever run on a substrate without a relay, because the process exits before constructing the node.

This makes the bootstrap **circular**. Discovery derives `relay_multiaddrs` from *registered circuit multiaddrs* when `RELAY_MULTIADDR` is unset (`discovery/src/index.ts:164-170`); circuits exist only once a transport reserves; the transport refuses to start without an anchor. A standalone substrate — the default inventory — therefore can never originate an overlay:

```
$ curl -s http://localhost:18100/bootstrap
{"relay_multiaddrs":[],"identity_endpoint":"http://127.0.0.1:8101","discovery_endpoint":"","prefer_transport":"libp2p"}
```

Invariant 3 says the relay is the *last* rung, not the entry condition. A relay-less transport is a fully useful peer on a LAN or a single host: it dials directly, it is dialed directly, and it acquires a circuit later if one appears.

### Defect C — `/bootstrap`, the one public join door, serves host-dependent anchors (2026-07-19 item 3, still open)

The response above is what a remote joiner receives. `identity_endpoint` is `http://127.0.0.1:8101` — on the joiner's machine that names the joiner's *own* loopback — and `discovery_endpoint` is empty. Verified that this is not a Host-header artifact:

```
$ curl -s -H 'Host: hub.example.net:18100' http://localhost:18100/bootstrap
{"relay_multiaddrs":[],"identity_endpoint":"http://127.0.0.1:8101","discovery_endpoint":"",…}
```

The handler (`index.ts:171-180`) derives both anchors from `PUBLIC_IP` / `IDENTITY_PUBLIC_URL` / `DISCOVERY_PUBLIC_URL`, falling back to `IDENTITY_VESSEL_URL` (loopback) and `""`. So the door is only honest on a node that was hand-fed its own public address — which is the host-dependence invariant 2 exists to eliminate. A joiner cannot tell a correctly-configured hub from an under-configured one: both return HTTP 200.

### Defect D — no vessel on this substrate is reachable from a foreign vantage

**The invariant at stake is foreign-vantage reachability of each vessel *through the substrate's one circuit* — not per-vessel multiaddrs.**

> **Correction, recorded rather than silently rewritten.** An earlier revision of this
> section framed the measurement below as a *per-vessel* defect: thirteen vessels with
> `libp2p_multiaddr: null` were read as thirteen missing multiaddrs, and the implied
> remedy was to give each vessel one. That diagnosis was wrong, it is in this change's
> git history, and it was reported to the operator — so it is corrected here in place.
> The measurement is unchanged and still true; only its meaning changes. Any repair that
> makes local vessels advertise their own multiaddrs is now explicitly out of scope.

There is exactly **one** libp2p identity per substrate: the transport. Its keypair is
derived deterministically from `sha256(<vesselId>@<substrateId>)`, which is why the id
must be substrate-scoped at all. Every other vessel reaches the overlay *through* it:

- `registerAtHub()` (`federation-transport-server.ts`, `async function registerAtHub`)
  mirrors a **per-vessel row** `<vesselId>@<substrate>` into the hub namespace for every
  plain-HTTP local vessel, and every one of those rows carries **the transport's**
  `libp2p_peer_id` and **the transport's** circuit as its reachability contract
  (`libp2p_multiaddr: [liveCircuit, ...currentDirectAddrs()]`). Duplicate vessels across
  the fleet stay distinct rows instead of collapsing onto one blob mirror.
- A remote caller that discovered such a row dials that one circuit and names its target
  with `pointer._fedTargetVessel`; the ingress proxy routes to exactly that vessel
  (`proxyToLocalOwner`, the `const wanted = String(pointer?._fedTargetVessel …)` branch),
  with shape-owner lookup as the fallback.

So the *local* registry rows correctly carry no multiaddr, and
`packages/vessel-discovery-client/src/registration-loop.ts` omitting
`protocol`/`libp2p_peer_id`/`libp2p_multiaddr` is **correct, not a gap** — thirteen
multiaddrs would mean thirteen libp2p nodes, thirteen reservations and thirteen NAT
mappings for no reachability gain, and thirteen peer ids to keep from colliding.

The live registry, which remains the symptom:

```
$ …/resolve -d '{"pointer":{"type":"vesselRegistry"}}'     # 13 vessels
development-vessel-local  http://localhost:8090    libp2p_multiaddr: null
relevance-sink-vessel     http://127.0.0.1:8255    libp2p_multiaddr: null
goal-host-vessel          http://127.0.0.1:8210    libp2p_multiaddr: null
…                         (13 of 13, no exceptions; 0 rows with a multiaddr)
```

What that measurement actually reports is that **the one circuit does not exist.** With
the transport down there is no `liveCircuit`, `registerAtHub()` early-returns before any
row is written, no `<vessel>@<substrate>` row is published anywhere, and the mirror that
carries every vessel's foreign-vantage reachability is empty. Discovery's peer dialability
filter (`index.ts:267-274`) would then drop all thirteen from any peer's fan-out — and
that filter is correct, it is reporting the truth. Defect B therefore does not merely
disable federation for this node: it makes **every vessel on it** unreachable from any
foreign vantage, by a mechanism no health check reports.

The repair target is accordingly a *substrate-level* one — the substrate holds a circuit,
and the per-vessel mirror rows carrying it are published and fresh — which is exactly what
the oracle's `I1_foreign_vantage_reachable` invariant asserts and its `no_circuit_advertised`
class reports.

`docs/FEDERATION.md` carries a measured warning: all nine spoke vessels mirrored into the hub, while the spoke resolving `llmCompletion` / `activityTemplate` from the hub returned `found:false`. The filter is `discovery/src/index.ts:267-274` — a peer row survives only with a non-empty `libp2p_multiaddr` **or** a non-loopback endpoint — and hub vessels register as `http://127.0.0.1:<port>` with neither. The documented cure (`SUBSTRATE_ADVERTISE_HOST`) is a host IP, so it satisfies the filter by violating invariant 2.

### Defect E — registration does not replicate (2026-07-19 item 1, still open)

```
$ grep -n 'replicat\|forwardRegister\|propagat' repos/discovery-vessel/src/*.ts
(no matches)
```

Findability remains hub-star: spoke→hub by query-time fan-out, hub→spoke by the 120s push mirror, spoke-A→spoke-B only through a common hub. A hub's own `PEER_DISCOVERY_ENDPOINTS` is still explicit-only (`gen-env.sh:986`), so a hub has no resolve-time fan-out at all.

## Approach

Ordered so each step is independently verifiable and the earlier ones unblock the later ones.

1. **Ungate the transport startup (Defect B).** Remove the `process.exit(1)` on a missing relay. Construct the libp2p node with direct listeners, register with the direct addrs it already knows how to announce, and re-attempt relay reservation on a backoff — adopting a circuit whenever one becomes discoverable and refreshing the hub mirror **on acquisition**, not only on the 120s tick (this is 2026-07-19 item 2, "loud reservation", which the same edit delivers). A relay-less transport is a healthy transport; the relay is an upgrade.

2. **Make the join anchor request-derived (Defect C).** `/bootstrap` must answer with anchors derived, in precedence order, from (a) explicit `*_PUBLIC_URL` env, (b) **the request's own origin** — the scheme/host/port the client demonstrably just reached us on, which is by construction routable *from that client*, (c) the registered rows for identity/discovery. Never loopback, never empty: when no honest anchor can be produced, say so in the body rather than returning a 200 that reads as success. Request-derived is the host-independent default `PUBLIC_IP` was standing in for.

   This **supersedes** item 3 of the 2026-07-19 proposal (derive from registered rows, or return a `not-a-join-door` marker); keep the refusal half, replace the derivation half. Two implementation constraints the implementing goal must honour: the response is a function of the request, so it must not be cached across clients (`Vary: Host` at minimum), and behind a TLS-terminating proxy the derivation must read `X-Forwarded-Proto` / `X-Forwarded-Host` rather than the raw connection origin. The Host header is client-controlled, which is harmless here — a client that lies about the host it reached us on only misdirects itself — but it is the reason the value can never be shared between clients.

3. **Anchor precedence must not let a host file outrank the substrate (Defect A).** `/workspace/.substrate-secrets` must not silently override `/etc/substrate/env` for routing anchors, and a `HUB_DISCOVERY_URL` that fails its `/bootstrap` probe must degrade to local discovery rather than killing the process — step 1 makes that degradation survivable. A pinned hub address becomes a *hint*, checked at use time, never a precondition.

4. **Symmetric dialability (Defect D).** Hub-native vessels get per-vessel mirror rows carrying the hub's *own* transport circuit, the same contract spoke vessels get — so the dialability filter passes on reachability the peer actually has, not on an advertised host IP. **Part of this mechanism already exists and is merely dark for want of a circuit:** the `SELF_MIRROR` branch no longer disables the mirror wholesale — it now skips only the transport's own anchor row and still publishes the per-vessel rows (`registerAtHub`'s `...(SELF_MIRROR ? [] : [{ vesselId: HUB_VESSEL_ID …}])`, landed in `5bbe50f9`). What remains is to verify it end-to-end once step 1 lets a circuit exist. The constraints to honour are in the transport's own comments — the `SELF_MIRROR` definition block, no ping-pong on mutual mirrors and prefer-direct-over-mirror ordering (the `_fedHop` block in `proxyToLocalOwner`), and the silent-disappearing-mirror failure documented above `currentCircuit`. Read all three before touching the guard.

5. **Registration replication (Defect E).** `POST /register` propagates to `PEER_DISCOVERY_ENDPOINTS` — bounded fan-out, deduped by `libp2p_peer_id`, TTL'd, idempotent last-writer-wins upsert — so dialing in *is* being findable, rather than being pullable by whoever happens to point back. Give a hub a non-empty default `PEER_DISCOVERY_ENDPOINTS` so hub-side fan-out exists.

## The grading instrument

**Every repair in this change is graded by an oracle that already exists, is calibrated
against the broken system, and was built before any repair** —
`scripts/substrate/federation-relay/federation-probe-tick.ts`. No step in this change is
graded by its own self-report.

Per sweep it mints an **ephemeral libp2p peer with a nonce identity** (`fedprobe-<random>`)
and dials in from outside, reading reachability off its own `getConnections()` — never off
the transport's `/health`, because a channel's own reporting is not evidence about the
channel. A nonce identity is simultaneously the join test and a standing demonstration
that an unknown peer is accepted. Verdicts travel loopback HTTP, so "the overlay is down"
stays reportable. Every sweep runs negative controls; a sweep whose controls did not fire
is reported `invalid`, not `pass` (a control whose precondition cannot exist — NC4 needs a
live connection to invert the path discriminator against — reports `skipped`, which is not
a failure to fire and does not invalidate the sweep).

Failures that persist across **2 consecutive quiescent sweeps** are auto-filed as
`substrateGap_write` under **stable derived ids `fed:<class>`**, so a re-fire updates the
existing row rather than flooding the store.

Calibrated against the broken substrate it reports **zero overlay passes** and these seven
failing classes:

| Class | Invariant it falsifies |
|---|---|
| `hardcoded_peer_endpoint_in_image` | `I1_no_frozen_address` |
| `bootstrap_env_precedence_inversion` | `I2_anchor_precedence` |
| `join_door_host_dependent` | `I3_join_door_honest` |
| `no_relay_anchor` | `I2_relay_anchor` |
| `no_circuit_advertised` | `I1_foreign_vantage_reachable` |
| `overlay_unjoinable` | `I2_join_overlay` |
| `transport_unit_flapping` | `I2_join_overlay` (unit vantage) |

Alongside: `coverage 60%` (9 of 15 applicable pairs decided), `blocking_reason:
no_relay_anchor`, `sweep_validity: valid`. The two passes — `I3_find_after_join` and
`I7_leave_propagates` — are **local-registry** verdicts and must never be read as
federation coverage; the cross-boundary invariants stay `undecidable / no_peer_substrate`
until a second substrate exists.

Mapping to the defects above: Defect A ⇒ `bootstrap_env_precedence_inversion`, Defect B ⇒
`no_relay_anchor` + `overlay_unjoinable` + `transport_unit_flapping`, Defect C ⇒
`join_door_host_dependent`, Defect D ⇒ `no_circuit_advertised`, plus
`hardcoded_peer_endpoint_in_image` for the address checked into the image. A repair is
accepted when the next sweep moves its class out of the failing set and coverage does not
fall — not when the edit typechecks. Repairs to unit drop-ins and `EnvironmentFile`
ordering are baked at image build, so their sweep only grades them after a recreate.

## Verification

Each numbered step has a check that fails today.

| Step | Check | Today |
|---|---|---|
| 1 | `systemctl is-active federation-transport-vessel` on a substrate with no relay | `activating`, restart counter climbing |
| 1 | `/bootstrap` `relay_multiaddrs` non-empty after the transport reserves, with no `RELAY_MULTIADDR` in env | `[]` |
| 2 | `curl -H 'Host: <foreign>' <disc>/bootstrap` returns anchors reachable from the caller | loopback identity, empty discovery |
| 3 | Unreachable `HUB_DISCOVERY_URL` ⇒ transport runs locally, emits a gap | process exits 1, 23 restarts |
| 4 | Spoke resolves a hub-owned `llmCompletion` | `found:false` (doc-measured) |
| 5 | Vessel dialing spoke-A's discovery is resolvable from sibling spoke-B without a hub round-trip | not implemented |

The end-to-end harness already exists: `repos/libp2p-federation-transport/federation-hub-e2e.ts`, plus the pre-flight `curl <hub>/bootstrap | jq '.relay_multiaddrs | length'` > 0. Add the missing direction — spoke resolving a hub-owned shape — as the closing assertion.

## Claim re-check

Every factual claim above was re-verified against the tree and the running substrate. The
findings that changed are recorded here rather than edited away, because the original
readings are the measurement record.

**Still true, re-confirmed:** the dead droplet at `138.197.116.56:18100` answers HTTP 000;
`/workspace/.substrate-secrets` still pins `HUB_DISCOVERY_URL` to it while
`/etc/substrate/env` has it empty, and the workspace file still wins; `/bootstrap` still
returns `{"relay_multiaddrs":[],"identity_endpoint":"http://127.0.0.1:8101","discovery_endpoint":""}`,
unchanged under a foreign `Host` header; the registry still lists 13 vessels with 0
multiaddrs; `grep -n 'replicat\|forwardRegister\|propagat' repos/discovery-vessel/src/*.ts`
still returns no matches (Defect E); a hub's `PEER_DISCOVERY_ENDPOINTS` is still
explicit-only (`gen-env.sh:986`); `repos/libp2p-federation-transport/federation-hub-e2e.ts`
exists.

**Changed — the unit is worse than measured.** The transport is still parked in
`activating`, but `systemctl show -p NRestarts` now reads **32**, not 23. Read the
counter from `show`, not from `is-active`: `is-active` can transiently print `active`
mid-restart while `ActiveState=activating`, `SubState=auto-restart`.

**Changed — two repairs are landed in the working tree but not yet in the running image,
so the oracle still reports their classes as failing.** Approach step 1's `process.exit(1)`
gate is gone from `federation-transport-server.ts`, replaced by a documented
direct-only warning; and the hardcoded peer endpoint is deleted from
`scripts/substrate/units/discovery-vessel.service.d/federation-peering.conf`. Neither is
graded until a recreate ships them into the container. The address still appears in two
operator scripts as documentation examples (`deploy-hub-pull.sh`, `bootstrap-remote-google-arm.sh`),
which the probe does not flag — only the shipped unit drop-in mattered.

**Line anchors have drifted, and will keep drifting.** `federation-transport-server.ts` is
under active edit; cite symbols, treat numbers as a snapshot. As of this writing:

| Cited as | Now | Anchor |
|---|---|---|
| `:61` (`process.exit(1)` startup gate) | **removed** | the `if (!RELAY) console.warn(…)` direct-only warning replaces it |
| `:326` "registration rows must announce the node's DIRECT listen…" | `:407-408` | above `advertisedAddrs` |
| `:524` "circuit first, then direct listen addrs" | `:611` | in `register()` |
| `:647` "direct ≡ punchthrough" | `:766` | in `registerAtHub()` |
| `:319` silent-disappearing-mirror failure | `:399-405` | above `const currentCircuit` |
| `:558` "self-mirror guard" | **never was that** | `SELF_MIRROR` is defined `:652-663`, consumed `:735`/`:751`; the `emitJoinHealth('auth_rejected', …)` the old anchor coincided with now sits at `:616` |
| `:197-199` prefer-direct-over-mirror | `:251-252` | the `_fedHop` block in `proxyToLocalOwner` |
| `:47` `HUB_DISCOVERY_URL` preferred over local `DISCOVERY` | `:47` | unchanged |
| `discovery/src/index.ts:164-170` relay-from-circuits | unchanged | — |
| `discovery/src/index.ts:171-180` anchors | `:172-176` identity, `:177-180` discovery | — |
| `discovery/src/index.ts:267-274` dialability filter | unchanged | `const usable = peerVessels.filter(…)` |

## Non-goals

Consensus across registries (last-writer-wins upsert with TTL suffices for findability). New inventory machinery: profiles, role selection, and transport auto-enable already cover "arbitrary vessel inventories" — the `apply-inventory` ungoverned-units caveat is a separate, known issue. The objective's word is *routability*, and routability is steps 1–4.

---

## Outcome

Every step below was graded by `federation-probe-tick`, the independent oracle, rather
than by assertion. The oracle files and closes its own gaps, so the ledger is a
measurement rather than a record of intent.

**Landed and verified**

| Step | Evidence |
|---|---|
| Transport ungate | Relay-less transport is healthy; verified adopting an anchor live (peer id and MainPID stable, direct listen port changed, proving a real node rebuild) |
| Anchor precedence | Six units reordered; anchors no longer persisted; `.substrate-secrets` can no longer outrank `/etc/substrate/env` |
| Frozen address removal | Checked-in droplet IP deleted from the shipped drop-in, and from `bootstrap-remote-google-arm.sh` where it lived in *executable* code and survived the first audit |
| Cross-boundary de-advertise | Per-vessel on the mirror tick; whole-substrate on SIGTERM — 7 hub rows to 0 in 8s against a 300s TTL |
| Sibling derivation | `gen-env` probes candidates instead of guessing; a two-input join against a container-internal hub now registers 201 with zero 401s |
| Discovery over the overlay | A foreign peer fetched `substrateBootstrap` and `vesselCapability` over libp2p with no HTTP endpoint |
| Multiaddr-only anchor | A substrate dialed a peer by multiaddr, learned the relay over libp2p, and obtained its own circuit |

**Not landed, and why**

`/bootstrap` still returns a loopback `identity_endpoint`. Three dispatches, two
formulations, identical refusal: `grounding window (0 BYTES) contains none of the target
file(s)`. The refusal is *correct* — compose confirms the file exists, sees it absent from
an empty window, and declines a blind edit. The defect is upstream, in the grounding
builder, and is filed as `fed:compose-grounding-window-empty-for-discovery-index`. The
change was not hand-landed: doing so would have converted a measurable lane defect into an
invisible one.

Off-host reachability is proven for peers outside the docker bridge but not for a
non-RFC1918 address, which needs a host with a public IP — deployment, not design.

Identity over a pure multiaddr join still reaches the hub by HTTP; the shim gives a local
address for the remote validator, but caller-credential threading needs a gated change.

**The confused deputy is still open.** The libp2p ingress performs no authorization and
authenticates remote-originated resolves with the transport's own key. Making discovery
reachable over the overlay raised the stakes on this without changing it.
