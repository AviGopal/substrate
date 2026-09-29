# Dossier: federation-p2p

**The class in one line:** the substrate is meant to be decentralized, with every shape reachable over the libp2p overlay. In practice federation is switched on by env present at boot, and it is judged healthy by each node's own view (unit active, "my reservation held", "my registration accepted", "my registry has a row"). No one measures whether a shape served by *another* node can actually be reached from here. So the production nodes run with no overlay at all, and the lab overlays die silently. Each fix repairs the observed instance: restart the transport, re-reserve, add a watchdog, set one more env value. Then the class comes back wearing a new hat.

Sources: `classes/federation-p2p.json` (56 attempts, 26 problems, 19 claims); `raw/federation-relay.md`, `raw/syzygy.md`; and the rows keyed to this class in `raw/git-super-2.md`, `raw/memory-5.md`, `raw/memory-6.md`, `raw/memory-10.md`, `raw/transcripts-2.md`, `raw/transcripts-3.md` and `raw/reports-1.md`. The same claims are also in records `reports-3..8`. Principles come from `classes/_principles.json`. **Live checks** were made by me on 2026-09-29 between 04:54 and 05:00 UTC, all read-only. They cover `substrate-live` (node 1), `compose2-live` (node 2), `syzygy-local-surface`, `syzygy-local-inventory`, the public health endpoint of the `syzygy.host` hub, the node-1 gap store (6,279 rows), and the node-2 pool (1,047 items). No secrets were printed; env keys were classified as set or empty only.

---

## 1. Timeline (dated; every "fixed / first / works" claim is paired with what later showed)

| Date | Event | Claimed at the time | What later showed |
|---|---|---|---|
| 2026-05-23 | openspec `2026-05-23-vessel-federation` (pubkey ids, content-addressed templates, peer-aware `/resolve`), 43 tasks | full federation design | **0/43 ticked**; superseded. Only an advisory Ed25519 key exists (dev-vessel `discovery-registration.ts`) |
| 05-31 | openspec `2026-05-31-substrate-fleet-federation` (5 phases + audit-vessel + network-guardian), 53 tasks | "Ship the LOOP, not the LOG: detection and resolution are Thompson-graded activities" | **0/53 ticked**. The Phase-1 image exists. The guardians (the detect-and-resolve loop for federation) were **never built**. That loop is the capability still missing today (§3) |
| 06-30 | `repos/libp2p-federation-transport` `2bb1189`, `baa360c`: Circuit Relay v2 primitive + ingress sidecar, e2e through a live hub relay | primitive works | Holds as a primitive and is used by the syzygy island. The production pair **never adopted it** |
| 07-02 → 08-10 | "Spoke consumes from hub but is not seen; federated arm never selected" (4 recurrences, memory-adjacent) | — | Reservation staleness plus prefer-local routing |
| 07-04 | Security hardening H1-H5: advisory pubkey `identity_status` (discovery `3685439`, `5fe6fb8`, dev-vessel `3a9ea4c`) | 2/67 tasks | Nothing gates on it. On 09-22 only 1 of 11 vessels was identity-`verified`, and all syzygy spoke rows at the hub are `unverified` |
| 07-07 | libp2p `7f2b6c9`: sendAll chunking (payloads ≥1 KB failed) | fixed | Held. But docs-2 still lists "HTTP-over-libp2p fails above 1 B across a circuit" as an open limit |
| **07-11** | libp2p `c68b54b` + super `0fc8c4c2`: **force re-reservation before the unobservable 1 h TTL lapses** (inbound died ~1 h after start while `/health` said `activeReservations:1`) | fixed | First instance of "health says reserved, circuit is dead". NO_RESERVATION recurred 07-21, 07-24, 07-25, 07-29, 08-10, 09-22 and 09-29 |
| 07-12 | Deploy-anywhere spoke from the bare image federated to the syzygy hub (11 mirror rows, spoke traces landed in the hub) | worked | Toy goal `reached:false` |
| 07-14 | super `3b9402bf`: ingress prefers libp2p, excludes `host.docker.internal` owners. activity-api `3a4c045..0e128ca`: pull-based trace replication over egress (4 bugs fixed) | worked; "bidirectional rows proven" | Replication cadence is `setInterval` + env (a law 1/5 gap, never closed). On 08-10 the relay anchor was stale with 7,333 egress failures. Its status now is unknown |
| 07-17 | discovery `586b738`: dedup on `libp2p_peer_id` | — | It silently evicted 11/12 mirror rows and every Obsidian panel 502'd. Rekeyed in `dcead52` |
| 07-18 | super `4aede401`: derive the circuit multiaddr live, "never from a one-shot startup capture" | fixed | 07-24 the stale circuit came back (`a67706571f`); 07-29 again |
| **07-19** | openspec `2026-07-19-relay-findability-replication`, with 4 items: (1) registration replication, (2) loud reservation loss, (3) honest `/bootstrap`, (4) hub-side peer wiring. The operator ratified **"a direct connection is equivalent to a punchthrough"** | spec + operator decision | Only (2) landed. (1) and (3) are **still absent on 09-29, 72 days later**. `holePunchSuccess` is 0 on every transport. Node 2's direct-only transport has **no dialable address** (verified 09-29) |
| 07-19 | Point-and-go join: discovery `b7d867f`, identity `ddda0d8`/`14cada5`/`3d5aaaf`, super `84e379e7`, `dfe8e24` `/bootstrap` | worked ("federated with only HUB_DISCOVERY_URL") | `/bootstrap` is "the single point-and-go door" (discovery CLAUDE.md). **On 09-29 both production nodes return `relay_multiaddrs:[]`, `discovery_endpoint:""`** (verified) |
| 07-19 | `PEER_DISCOVERY_ENDPOINTS` clobbered by the EnvironmentFile (`gen-env.sh:172`) | runtime-only fix | Same EnvironmentFile-wins mechanism as the 09-22 memory-store split. Recurred as `gap-mu82wqoh` (09-19) |
| 07-21 → 07-31 | LLM plane "down" from the spoke, re-fixed each time: `85d5edb` 404 predicate, NO_RESERVATION, `a67706571f` stale circuit, `cf882aed` HUB_API_KEY, `ec8ef67` hub-egress fallback, `dd13b69`/`6815f82e`/`cc192274`/`2e10fde9`/`46b3304d` location-independence chain | "12/12 spill to hub arm; 0 NO_RESERVATION in storm window" (07-31) | memory-6 counts 13 recurrences between 07-14 and 09-16. Its root cause: "remote capability availability inferred from local advertisement, process health or relay reservation rather than end-to-end probe" |
| **07-25 → 09-22** | **Relay-reservation / phantom-partition chain (R14):** `494a990e` watchdog (40 min re-dial) → `2c247adc` redial storm → `ea5882bd` phantom detection → `abf60661` **silently reverted it** → `9fa6bd81` restore → `607fc6ef` drop teardown → `824609c6` halve tick → `6ec65736` keep-alive → `0a535483` revert → **`cfad41db` "root fix" (07-31)** → `3dbbbeff` (09-14) | each "fixed". cfad41db was called the root fix | **3dbbbeff: "the phantom watchdog was manufacturing the outage it existed to catch"** (14 redials in 3 h against a healthy reservation). 12 recurrences (git-super-2) |
| 07-30 | Redial-storm stabilization (`2c247adc`, `96949a64`, `607fc6ef`, `15a31681`, `ea5882bd`; system `8d6a864`, `51c6c96`, `5839489`) | drops ~223/h → 0 | The relay HOP/RESERVE inconsistency was left as an "operator-tier upgrade" and never done |
| 07-31 | Hub→spoke one-way break: discovery `ea7f342`, super `5bbe50f9` | outcome unknown | **"No cross-substrate reach detector exists"** (memory-5). This is the first time the missing capability is named in writing |
| 07-31 | `5e48a4e8`: count `egressNoReservationCount` | instrumented | **09-29: the counter stays 0 after a NO_RESERVATION on the ingress→libp2p forward path** (syzygy §5). It counts the wrong path |
| 07-31 | `distribution_policy` on the pick paths (discovery `7e051d7`, `6ab2e24`; transport `24ac13e2`; goal-host `9225c54`) | partial | Fan-out is still first-response-wins. Placement is env-frozen |
| 07-31 | "Spoke→hub one-way broken" diagnosed over several rounds | — | **Wrong door.** Discovery :8100 is local-only; fan-out lives at :8401 |
| 08-08 | `validation/results/substrate-cycle-resync-2026-08-08.md`: 2 spokes × 2 cycles | "substrates cycle freely and resync 4/4" | Spokes only; the hub was not covered. **The resync script is invoked by nothing** |
| 08-09 | Autonomy units masked on federated roles (42 units incl. gap-compose) | one-line inventory fix diagnosed | Outcome unknown. "pickup triggered" was logged into a masked unit |
| 08-10 | Relay anchor frozen at module load; libp2p row rewritten to HTTP (`ada62cff`); transport restarted | routes 200 in ~1 s | The durable fix (read the relay at use time) was not made. **09-07 → 09-11: self-recovery restarted federation-transport 19,348 times** (1,071 ESCALATE lines, ~7.5 CPU-h) with empty `HUB_DISCOVERY_URL`/`RELAY_MULTIADDR` |
| 08-10 | "Hub relay port 30333 closed; needs droplet SSH" | blocker | Retracted 14 minutes later: transient and self-healed |
| 08-18 | Spoke could not reach hub LLMs, 4 defects in series (llm-resolver `3ea2136`, dev-vessel `f8a2ede`, inventory `7886d3a5`, manual transport install). `3b4f921a`: "everything must be available over p2p; bespoke HTTP is unavailable to a federated peer by construction" | worked (`5d29f1f` landed over federation) | The transport install gap stayed open until `installed.json` on 09-22 |
| 08-19 | Transport crash-loop in fresh containers: `79cfbe9a`, render-unit ExecStartPre | partial | The working repair lived as a hand-edit on one container |
| 08-20 | `models` role split for LLM arms | partial | It governed unit names that nothing renders |
| 09-11 → 09-15 | **Federation oracle** `federation-probe-tick.ts` (`a0c702bb`..`1ad7bacd`: `26a53fe0`, `a29653e4`, `9834bd95`, `5584bc3f`, `37650c2f`, `df6206e3`, `e4fe46d1`, `64dc1b8d`, `bf58a721`, `251382f9`). About 40 DevBob commits | "independent ephemeral-peer oracle; closes when the probe says so" | Its own defects included a negative control that could not fail, a call site never invoked, an oracle deleted by the workspace it measures, and an echo instrument outcompeting its shape. **Today it runs only on node 2, from inside node 2, with no foreign peer** (§4) |
| **09-12** | openspec `2026-09-12-host-independent-federation-join`: transport ungate (`87e30952`), anchor precedence, frozen-IP removal, de-advertise, sibling derivation, discovery over overlay, multiaddr-only anchor | **"A relay-less transport is a healthy transport"**; "discovery reachable over the overlay" | True only at the level of `systemctl is-active`. Node 2's relay-less transport announces `libp2p_multiaddr:""` with 0 connections (verified 09-29), and I5/I9 grade **undecidable** instead of fail. No production node uses `PEER_MULTIADDR` |
| 09-12 | `/bootstrap` request-derived anchor via compose (3 dispatches, 2 formulations) | — | Refused "grounding window (0 BYTES)". The edit never landed through the substrate |
| 09-14 | `1afd003f` exposes the reservation the relay client actually holds; `3dbbbeff` phantom watchdog fix | fixed | Only the caller's **own** reservation is exposed. On 09-29 the surface reports `reservationsHeld/activeReservations:1, phantomSuspected:false` while every hub-bound forward returns NO_RESERVATION (verified) |
| 09-15/16 | `aba286bd` hub self-anchors (role=hub brings its own relay + transport, derives PUBLIC_IP, persists RELAY_MULTIADDR); network demo `validation/reports/network-demo/REPORT.md` + `VALIDATION-POST-FIX.md` | **"zero-config hub+spoke, add/remove propagates network-wide, hub resolves spoke memoryNote over libp2p with ZERO interventions"** | Proven only in `val-hub`/`val-spoke`, which were torn down. **No production node runs the hub profile** (node 1 standalone, node 2 compute, verified) |
| 09-16 | discovery `0b7db2d`: `/bootstrap` reads `RELAY_MULTIADDR` from the env **file** per request (a workaround for frozen `process.env`). Operator-landed after 3 substrate attempts: misroute, fail-closed semantic gate, protected-vessel cutover refusal | worked | The value it reads is empty on node 1 and node 2, so the door is still hollow |
| 09-16 | Off-host relay reachability (`substrate-relay-pub`, `-p 30333`, LAN 10.0.0.104). `faba5acd` P1 "federation stack independent of workspace clone" | LAN "architecturally SATISFIED" | Public-IP part open. The falsifier failed (vendored transport in the image is a stub). **Left an untracked Ed25519 *private* key `scripts/substrate/federation-relay/.relay-pub-key.protobuf`** (peer `12D3KooWLvbz…`, already in autonomous commit `13c5d466`'s content) |
| 09-18 | `80ab9659`: federate local ↔ syzygy.host (relay on syzygy, socat bridge, HUB_API_KEY, MAX_PEER_DEPTH 1→2) | **02:41 "Goal met"**; 06:16 "Proof complete: any inventory, any container…" | 03:32: reach from spokes refused 4/4 (ReAct floor dark on spokes, `gap-mu6ejfac`). The 09-22 audit found every arrangement `reached:false` |
| 09-18 → 09-26 | Oracle `fed:*` gaps closed by measurement: `punchthrough_unavailable` (09-19), `stale_foreign_rows_advertised` (09-20), `relay_dial_failed` (09-22), `registry_lost_local_rows` (09-26) | "CLOSED BY MEASUREMENT" | Measured on a vantage with ≤1 foreign row. `punchthrough_unavailable` "closed" while `holePunchSuccess` is 0 everywhere (verified 09-29 on node 2) |
| 09-19 | `gap-mu82wqoh`: "A reboot silently de-federates the fleet … while every unit reports healthy" (edit_site `gen-env.sh`) | filed | **Still open, never updated** (verified). Node 1 is the live instance: it was `local-dev-spoke` (257 mirrored registrations at the droplet hub) and is now non-federated |
| 09-21/22 | Isolated container lifecycle audit: 21/26 → rerun 26/26 MET (image `125775d7` from `254bf8c9`) | "relay installs out of box" | WAN/NAT and long-run liveness were untested. Every probe `reached:false` with no explanation |
| **09-22** | syzygy-local bring-up (surface + inventory spokes of `syzygy.host`). First run NO_RESERVATION; "recovered" by `ssh … systemctl restart federation-transport-vessel` on the hub. `e1c06f60` "joined means a live reservation". Inventory idempotence proof "both directions complete activeDispatches over libp2p, 50 dispatches" | **"Recovered … 10/11 P2P probes return 200"**. The report itself says "not proof that the underlying reservation liveness defect cannot recur" | **09-29: broken again with nothing filed** (syzygy §4, re-verified by me, §4 below). `docs/guides/SYZYGY_LOCAL_SURFACE.md` (untracked) still leads with "local setup succeeds" |
| 09-22 | discovery `ffd1d58` registrant identity + `/registry/events` (operator bypass) | worked | Exposed a node-2 stray registrant with a k8s DNS endpoint |
| 09-23 | `d8fed96f` one role derivation, named profiles, in-container relay. Install demo `2f002a09`: 9 fresh fleets peered with syzygy.host + substrate-live | **"9/9 usable in 49-113 s"** | Torn down, so it says nothing about how long a federation stays alive. Node 2 publishes `30333→26333` with **no relay unit** (verified: `federation-relay` inactive) |
| 09-23 → 09-26 | Surface spoke's own reservation lost/reacquired at 09-23 23:20, 09-25 02:00, 09-26 21:20 | — | Flapping every 1-2 days. Nothing grades it |
| 09-26 | Decentralized compose ownership (node 2 owns dev-vessel/goal-host/activity-api composes). Claims at 14:48Z and 14:54 "ownership routing works end to end" | worked | Carried over **HTTP env pins** (`host.containers.internal`), not the overlay. Node 2 cannot verify its own landings ("gap store is held elsewhere"); 2,873 escalations throw. `an-operator-pause-and-rhythm-posteriors-are-node-local…` (open): node 2 drained node 1's paused rhythm |
| 09-19 → 09-29 | 17 `gap-federation-*` capability gaps, each an invented target-shape name for "report federation state"; 16 batch-closed 09-28 01:26-01:29 | closed | The 17th (`gap-detailed-federation-state`) appeared 09-29 00:38, **within 23 h**. `reach-gap-federation-verification-report` and `reach-gap-federation-probe` are **open** (verified) |
| 09-29 03:46 | Latest oracle sweep on node 2 (`sweep-2026-09-29T03:46:58.281Z`) | 9 pass / 2 fail / 6 undecidable, coverage 0.647, `blocking_reason: no_relay_anchor` | Identical in substance across all 18 sweeps 09-26 → 09-29 (verified 18 in the pool). A stuck instrument that grades nothing new |

**Recurrence count.** Collector tallies overlap, but they include: 12 (phantom/reservation chain), 13 (LLM-plane-down via relay), 8 (scripts-tier oracle/phantom), 6 (production nodes not on the overlay), plus ≥ 9 dated NO_RESERVATION episodes between 07-11 and 09-29. At least 14 separate "fixed / root fix / recovered / proof complete / goal met" declarations were later falsified.

## 2. Root causes

1. **Topology is env present at boot, not a shape.** The entrypoint enables the transport only if `HUB_DISCOVERY_URL` or `PEER_MULTIADDR` is set (`scripts/substrate/entrypoint.sh` ~L135), and enables the relay only for `PROFILE=hub|hub-minimal` / `ENABLED_ROLES=hub` (~L175). `gen-env` does not carry federation values across a regenerate (`gap-mu82wqoh`), and values are read once at module load (08-10, 19,348 restarts). `/bootstrap` derives anchors from env (`0b7db2d` reads the env file per request, and the file is empty). The result: a recreate silently de-federates a node while every unit is healthy, and the production launch never set any of these values for node 1/node 2. This violates law 1, and law 11 via the HTTP pins.
2. **Health is judged from the near side.** Every green signal is local: `systemctl is-active` (09-12 "relay-less is healthy"), "my reservation held" (`1afd003f`, `e1c06f60`), "my hub-register returned ok", "my registry has 29/29 healthy rows", `substrate-ready ready:true`, `egressNoReservationCount` on the egress path only. NO_RESERVATION is the **target's** status at the relay, and no near-side signal can see it. Principle (memory-6): *"A health probe asking 'is my process up' cannot detect 'I joined nothing'."*
3. **The one far-side instrument has no far side.** `federation-probe-tick` runs inside node 2, with an ephemeral peer in the same network namespace (`witness_scope "same-network-namespace … NOT off-host"`). No foreign peer exists, so the invariants that would fail are graded `undecidable` (I5, I8, I9), and the `fed:*` closures were measured with ≤1 foreign row.
4. **Fixes target the instance, in a tier the substrate cannot author.** The transport, relay and oracle live in `scripts/substrate/federation-relay/` (≈45 commits, ~40 hand-authored, **zero substrate-authored federation fixes**). The one substrate attempt (honest `/bootstrap` in `repos/discovery-vessel`) was refused 3× on an empty grounding window (09-12), and again 3× on 09-16. Recovery is an operator `systemctl restart`, which teaches the system nothing (law 6).
5. **Lab proof is taken for deployment.** Network demo, multiaddr-only join, discovery over overlay, hub self-anchor, install demo 9/9, cycle-resync 4/4: each was proven in throwaway containers that were then torn down. The production pair was created 09-23/09-26 and never joined an overlay. HTTP pinning (`host.containers.internal`) stood in and was reported as "routed landing works end to end".
6. **Specs outrun landing.** 0/96 tasks on the May specs. The 07-19 items (1) replication and (3) honest bootstrap are still open after 72 days; the 09-12 Outcome doesn't mention replication at all. Findability stays a hub star: discovery fans out only when **no local producer exists** (`repos/discovery-vessel/src/index.ts` ~L209-231), so a local producer shadows hub loss. The syzygy inventory's local goal-host answers `activeDispatches` with an empty board.
7. **The request path conflates errors.** The hub's identity rate-limits spokes (429), and discovery reports the 429 as 401. That produced ~290/day on the surface and ~176/day on the inventory from 09-22 to 09-28: 466 occurrences, never investigated.

## 3. Why it recurs: the missing shared capability

**Missing capability: a far-side reachability witness, with topology held as a shape.** Concretely, a scheduled, Thompson-graded activity runs **on every node** and does the following:

- It reads the intended topology (who is my hub or peers, which anchors) from a shaped impulse such as `federationTopology`, not from boot env.
- It performs a **function-path round-trip** to a shape that has **no local producer** and is served only by each named peer, through the overlay (not `host.containers.internal` HTTP).
- It emits a keyed `federationReach` observation per (vantage, target) pair.
- It files or updates **one** keyed gap per failing pair and drives the variant-selected repair (re-reserve, redial, restart the target transport over the overlay, re-derive anchors), then re-measures.

**The seam** is the federation transport's ingress/egress (`federation-transport-server.ts`) together with discovery's join door (`/bootstrap`, `/register`). A "joined / healthy / ready" verdict must be defined as the output of this witness, and nothing else may define it.

Without this capability:
- each outage is found by an operator probing by hand (09-22, 09-29), not by the system;
- "recovered" means an operator restarted something, and no trace records it;
- every near-side indicator stays green, so each fix is closed on a proxy that the next outage walks around.

The same absence also produces the node-locality and false-verification hats (paused rhythm drained by the peer node; foreign state shown as local on the surface).

## 4. Every prior attempt at this same capability, and why it did not hold

| Attempt | Date / ref | What it measured | Why it did not hold |
|---|---|---|---|
| Guardians / network-guardian (fleet-federation spec, phase 5) | 05-31 | intended: observe-detect-resolve as graded activities | Never built (0/53) |
| Forced re-reservation | 07-11 `c68b54b`, `0fc8c4c2` | nothing (blind renewal) | Treats the near-side reservation as the property. Recurred 07-21 onward |
| Live circuit multiaddr | 07-18 `4aede401` | own circuit address | Near side. Stale circuit returned 07-24 and 07-29 |
| Reservation watchdog / phantom detection / keep-alive (R14) | 07-25 → 09-14, 10 commits | inferred liveness from circuit traffic | Wrong on DCUtR/LAN. It manufactured outages (`3dbbbeff`), was silently reverted once (`abf60661`), and its "root fix" (`cfad41db`) was falsified |
| `egressNoReservationCount` | 07-31 `5e48a4e8` | egress failures | The failing path is ingress→libp2p forward: 0 after a real failure (09-29). The 09-22 report told operators to "monitor" it, but no runtime reader exists |
| "No cross-substrate reach detector exists" | 07-31 memory-5 | — | Named but not built |
| cycle-resync script | 08-08 | spoke resync after stop/start | Invoked by nothing. Hub not covered |
| self-recovery restart of transport | 09-07 → 09-11 | unit liveness | Restarted 19,348× on an empty anchor. ESCALATE terminates in a log line |
| Federation oracle `federation-probe-tick` (NC1-8, `fed:*` auto gaps, close-by-measurement, quiescence check) | 09-11 → 09-15, ~40 commits | invariants I0-I12 from an ephemeral in-namespace peer | **Closest attempt, and the one to keep.** It is vantage-limited (same netns, no foreign peers), grades "no dialable address" as `undecidable`, runs only on node 2, and its gap evidence is a frozen template: `fed:no_relay_anchor` still says "the transport refuses to start without an anchor", a cause fixed 09-12 by `87e30952`. Classifier marks its falsifier `none` (verified). It never ran against syzygy, so it missed 09-22 and 09-29 |
| `1afd003f` expose held reservation | 09-14 | own reservation | Near side. `phantomSuspected:false` while the hub circuit is dead (verified 09-29) |
| Network demo / VALIDATION-POST-FIX | 09-15/16 | hub resolves spoke memoryNote over libp2p | One-shot in throwaway containers. No runtime reader |
| `e1c06f60` "joined means a live reservation" | 09-22 | own reservation + HTTP register | Passes on a spoke that cannot reach its hub (09-29) |
| syzygy REPORT falsifier `/api/resolve activeDispatches` + `operate.py probe` / `probe.ts` | 09-22 | a function path, the right kind of check | Manual only. `activeDispatches` is shadowed by a local goal-host (local-first). Nothing schedules it |
| Install demo | 09-23 `2f002a09` | usable at launch | Torn down, so it measured launch, not liveness |
| `substrate-ready --once` | ongoing | readiness | Federation reach is not part of readiness (`ready:true` on the broken spokes) |

The topology-as-shape half has its own list of attempts, each of which left the value in env: 07-19 point-and-go (`b7d867f`, `dfe8e24`), 07-19 `PEER_DISCOVERY_ENDPOINTS` runtime fix, 07-19 honest-bootstrap spec, 08-10 "read relay at use time" (not made), 09-12 anchor precedence, 09-15 `aba286bd` / 09-23 `d8fed96f` profiles (dormant: no node runs the hub profile), 09-16 `0b7db2d` env-file per-request read, and 09-19 `gap-mu82wqoh` (open, untouched).

## 5. Current verified state (2026-09-29 04:54-05:00 UTC, read-only)

**Node 1 `substrate-live`**
- `federation-transport-vessel`: `disabled` / `inactive`. `federation-relay`: inactive (no unit running).
- `HUB_DISCOVERY_URL`, `PEER_MULTIADDR`, `RELAY_MULTIADDR`, `PROFILE`: all empty. `PEER_DISCOVERY_ENDPOINTS` has 2 entries, but discovery logged **0 "peer" lines in 24 h**.
- `/bootstrap` = `{"relay_multiaddrs":[],"identity_endpoint":"http://127.0.0.1:8101","discovery_endpoint":"","prefer_transport":"libp2p"}`. That advertises libp2p while offering no anchor, and it is loopback identity: the same Defect C measured 09-12.

**Node 2 `compose2-live`**
- Transport `enabled`/`active`, peer `12D3KooWNw7E…35vy`: `activeReservations 0`, `connections []`, `holePunchSuccess 0`, `libp2p_multiaddr ""`. `federation-relay` inactive, even though the container publishes 30333→26333.
- `/bootstrap` identity is `http://host.containers.internal:18101`, which is host-dependent.
- **9 env keys pin node 1 over `host.containers.internal`:** `ACTIVITY_API_ENDPOINT`, `ACTIVITY_API_URL`, `PRODUCER_DISCOVERY_ENDPOINT`, `METABOB_ENDPOINT`, `IDENTITY_VESSEL_URL`, `IDENTITY_ENDPOINT`, `HUB_DISCOVERY_URL`, `PEER_DISCOVERY_ENDPOINTS`, `GAP_STORE_ENDPOINT`. **Everything node 2 gets from node 1 arrives over pinned HTTP. Zero shapes cross the production pair over p2p.**
- The pool holds 18 `federationVerificationReport`s. The latest, `sweep-2026-09-29T03:46:58.281Z`, has 17 planned, 11 decided, 9 pass, 2 fail, 6 undecidable, coverage 0.647, `blocking_reason: no_relay_anchor`, and quiescent.

**Syzygy island** (`syzygy-local-surface`, `syzygy-local-inventory` → `syzygy.host`, up 6 days, image of 09-22)
- Both transports report `status ok`, `activeReservations 1` (TTL ~59 min), and connections to relay `12D3KooWDcbT…NAMgV` at 104.236.0.175:30333. The surface and inventory see each other's circuits.
- `syzygy.host:18100/health` is 200 with **34** registered vessels (29 on 09-22).
- Function path `llmQuotaState` (a hub-only shape), 6 tries per spoke, both forwarding to hub peer `…dmj8FhWwCd4MCvZG4nm1`:
  - **surface: 0/6 ok, 6/6 `ingress proxy failed: failed to connect via relay with status NO_RESERVATION`**;
  - **inventory: 6/6 ok**.
  - At 04:22 the inventory also failed (syzygy shard). So the failure is **intermittent and per-caller** against the same target. Root cause is unattributed; the hub side was not inspected, since that needs SSH.
- `activeDispatches` from the surface forwards to the inventory's local goal-host (a local shadow), not the hub.
- **No gap in the node-1 store mentions NO_RESERVATION or `syzygy-local`**, so the 09-29 outage is unfiled.

**Gap store** (node 1, 6,279 rows; 31 federation-keyed, 9 open)
- Open: `fed:join_door_host_dependent` (since 09-18, updated 09-29 03:47); `fed:no_relay_anchor` (since 09-22; stale evidence template; falsifier classified `none`); `gap-mu82wqoh` (09-19, never updated); `discovery-forwardtopeers-discards-per-peer-outcomes…` + `-narrowed`; `reach-gap-federation-verification-report`; `reach-gap-federation-probe`; `while-goal-host-drains-the-surface-routes-a-goal-to-an-unreachable-federated-peer…` + `-narrowed` (plus `route-edit-c5a9ab65` + `-narrowed`).
- Closed by measurement: `fed:punchthrough_unavailable`, `fed:stale_foreign_rows_advertised`, `fed:relay_dial_failed`, `fed:registry_lost_local_rows`. All four were measured on a vantage with no peers.

**Residue** (from the federation-relay shard, not re-verified): an untracked private key `scripts/substrate/federation-relay/.relay-pub-key.protobuf` (in the git status snapshot as `??`); 20 tracked dead `.js/.d.ts/.map` files beside the `.ts`; `542e712` build output in the transport repo; 3 caller-less scripts (`fed-federated-resolve.ts`, `fed-resolve-client.ts`, `obsidian-passthrough.ts`); a third libp2p implementation in `repos/obsidian-vessel/sidecar/federation-sidecar.ts` (711 lines); 16+ churned `spoke-<hex>` ids in the droplet hub metrics.

## 6. Keep / organize

- **Keep (general, live-used):**
  - the `libp2p-federation-transport` primitive (`createVesselLibp2p`, `resolveViaLibp2p`, `serveResolve`);
  - `federation-transport-server.ts` (one identity per substrate, per-vessel mirror rows, `_fedTargetVessel` ingress);
  - `relay.ts`;
  - `federation-probe-tick.ts`, as the **seed of the witness**. It needs re-vantaging: run it on each node against the other nodes, grade "no dialable address" as `fail`, measure its evidence per sweep, and make the function-path round-trip to a non-locally-served shape its primary invariant.
- **Keep as method:** the syzygy REPORT's falsifier (`resolved`, not HTTP status), restricted to shapes with no local producer; the compose explicit-inventory + idempotence pattern, moved into install acceptance.
- **Decide explicitly** whether node 1 is the hub. If it is, set it by profile, which brings up relay + transport. Then replace node 2's 9 pinned URLs with discovery/overlay resolution. Until that happens, "hub" names a word, not a topology.
- **Move the transport, relay and oracle into an authorable submodule** (or accept that this class stays operator-only).
- **Retire:** `2026-05-23-vessel-federation` and `2026-05-31-substrate-fleet-federation` (archive with a pointer); caller-less scripts; tracked build output; the private key (delete, and gitignore `*.protobuf` under the relay dir; default `RELAY_KEY_FILE` should point into the volume); the syzygy fixtures, or at least de-advertise their goal-host / local-tools / uiQuestion rows from the production hub.
- **Collapse the invented-name generator:** add a concept alias `federation_*` → `federation_verification_report` in target inference, instead of closing gaps one name at a time.

## 7. Retire condition (measurable, checked continuously)

This class is retired when **all** of the following hold, as measured by the witness itself (its `federationReach` observations and the gap store), not by operator report:

1. **Production reach.** For every ordered pair of production nodes (node 1→node 2, node 2→node 1, and any declared spoke→hub), a scheduled function-path resolve of a shape with **no local producer** succeeds over libp2p in **≥ 95 % of probes over 7 consecutive days**, with ≥ 1 probe per 15 min per pair. Traffic over `host.containers.internal`/HTTP pins does not count.
2. **No pins.** The node-2 env holds **0** `host.containers.internal` endpoint keys, and cross-node calls resolve through discovery or overlay.
3. **Honest door.** Node 1 `/bootstrap` returns a non-empty `relay_multiaddrs` or a dialable direct multiaddr, and a non-loopback identity endpoint. `fed:join_door_host_dependent` and `fed:no_relay_anchor` are closed by measurement and stay closed for 14 days.
4. **Survives recreate.** After a `--force-recreate` of both production containers with no operator env edits, criterion 1 is met again within 30 minutes. `gap-mu82wqoh` is closed by that measurement.
5. **Self-detection, proven by intervention.** A deliberate, recorded outage (stop the target transport on one node for 20 min) produces a keyed gap within one sweep ≤ 15 min, and the gap auto-closes after recovery, with no operator filing. Run once per release (law 12: change one thing, record it).
6. **No new hats.** 14 days with no new `gap-federation-*` invented-name gap. `reach-gap-federation-verification-report` and `reach-gap-federation-probe` are closed.

It **reopens automatically** if any 24-hour window has pair reach below 90 %, or if an outage longer than 15 min occurs with no gap filed.
