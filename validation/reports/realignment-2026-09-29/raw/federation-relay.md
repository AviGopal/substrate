# Federation / relay / p2p: live state and history (realignment round 2, shard `federation-relay`)

Measured 2026-09-29 ~04:00-04:30 UTC (host date 2026-09-28 PDT). Read-only. No secrets or env values printed:
env keys were classified (set/empty, host type) rather than echoed. One authenticated registry read
(`vesselRegistry` via in-container key) was **refused by the permission classifier**, so per-row
registry contents on node 1/2 come from unauthenticated surfaces (`/registry/shapes`, `/metrics`,
`/vessels/:id`, `/bootstrap`, `/health`), transport logs, the node-2 pool and the gap store.

## 0. Answer to "how far is 'everything available from everywhere over p2p' true?"

**It's almost entirely false for the production pair.** Live, there are two federation islands
that don't touch each other:

| Island | Members | Transport | Actually crosses nodes over |
|---|---|---|---|
| **A: syzygy** | remote droplet `syzygy-hub` (104.236.0.175: discovery :18100 with 29 rows, relay :30333, peer `12D3KooWDcbTx…NAMgV`), `syzygy-local-surface`, `syzygy-local-inventory` | libp2p Circuit Relay v2. Both local containers hold 1 reservation on the droplet relay, publish circuit multiaddrs, and mirror per-vessel rows into the droplet hub (2 and 4 rows, `-> all ok` every 120s) | **libp2p, confirmed**: surface→hub forwards (`substrateGap`, `goalWalkState`, `activeDispatches`) 4,409 on 09-22, 485 on 09-25; inventory→hub `llm_completion` 179; surface→inventory `activeDispatches` still running 09-29 04:20. Traffic between two containers on the same laptop **hairpins through a DigitalOcean relay**: `holePunchSuccess 0`, and the only connection is to the relay |
| **B: substrate** | `substrate-live` (node 1, the "hub"), `compose2-live` (node 2) | Node 1: **no transport and no relay**. `federation-transport-vessel` is unit-file `disabled` and never ran this boot (journal "-- No entries --"); `federation-relay.service` doesn't exist; no probe. Node 2: transport active but **direct-only, no relay anchor, `libp2p_multiaddr:""`, 0 connections, hub mirror skipped** (log line every 10 min) | **HTTP only, pinned in env.** Node 2 reaches node 1 through `host.containers.internal:18xxx` URLs in 9 env keys (`ACTIVITY_API_ENDPOINT/URL`, `PRODUCER_DISCOVERY_ENDPOINT`, `METABOB_ENDPOINT`, `IDENTITY_VESSEL_URL/ENDPOINT`, `HUB_DISCOVERY_URL`, `PEER_DISCOVERY_ENDPOINTS`, `GAP_STORE_ENDPOINT`). Nothing crosses node1↔node2 over p2p |

Node 1 has **no** `@`-qualified foreign rows (metrics list only its 15 local ids). Node 2 has only its own
transport plus 28 `fedprobe-*-ephemeral` registration counters from its own in-container oracle. The
droplet hub has **0** rows for node 2 (`federation-transport-vessel@spoke-66684ac4` → "Vessel not found").
Node 1 used to federate with the droplet as `local-dev-spoke`: the hub's counters show 257 mirrored
registrations of `*@local-dev-spoke`, including `metabob-mcp-86e2629e6d87@local-dev-spoke`, which is node 1's
MCP id. That's about 8.6h of mirroring inside the hub's 7-day uptime. Those rows are gone now
(`goal-host-vessel@local-dev-spoke` → not found). Node 1 still receives `GET /vessels/federation-transport-vessel@local-dev-spoke` → 404
(2 in 24h): something still asks after its own former identity.

The two islands also split the human plane. `obsidian-intake` on node 1 logged
`SKIPPED: no vessel advertises obsidian:note — the human surface is not connected` **681 times in 24h**.
Neither island advertises `obsidian:note`.

Answer: **zero shapes cross the production node boundary over p2p. Three containers (the syzygy
island) do resolve over p2p, and only through a cloud relay.** Everything node 2 gets from node 1 comes
through frozen HTTP env URLs (law 1 and law 11 violations), not through discovery or the overlay.

## 1. Live measurements (per container)

### substrate-live (node 1)
- `PROFILE` unset, `PROFILE_EFFECTIVE=standalone`, **not `hub`**. `HUB_DISCOVERY_URL` empty, `PEER_MULTIADDR` empty, `RELAY_MULTIADDR` empty.
  `PEER_DISCOVERY_ENDPOINTS` is set (2 hosts). The entrypoint enables the transport only when
  `HUB_DISCOVERY_URL` or `PEER_MULTIADDR` is set (`scripts/substrate/entrypoint.sh` ~L135), and the relay only for `ENABLED_ROLES=hub` or `PROFILE=hub|hub-minimal` (~L175).
  So by construction node 1 runs no federation. The "hub" role in the task framing is HTTP-pinning only.
- `/bootstrap` = `{"relay_multiaddrs":[],"identity_endpoint":"http://127.0.0.1:8101","discovery_endpoint":""}`.
  That is **byte-identical to the 2026-09-12 proposal's Defect C measurement**, 17 days later.
- Docker publishes 8080/8090/8100/8101/8210/8250/8260/8270, and **no 30333**.
- Discovery: 11 vessels, 405 shapes. Image `ghcr.io/avigopal/substrate:dev` created 2026-09-23. Its `relay.ts` hash is `fdcdb44698` (old). The clone has `3d1695188b` (new). Irrelevant while no relay runs.

### compose2-live (node 2)
- `PROFILE=compute`. Image `localhost/substrate:compose-ownership` (created 09-26).
- **Publishes 30333→26333 and has `RELAY_ANNOUNCE_PORT` set, but `federation-relay.service` is `not-found`.** The launch manifest provisions a relay port that the profile never fills.
- Transport `/health`: `activeReservations 0, connections [], libp2p_multiaddr ""`. Log: `[federation] no relay anchor (direct-only) — remote visibility suspended (hub mirror skipped …)` every 10 min. Transport restarted 09-26 09:57, 12:00 and 13:05 (manual/deploy, `discovery-deregister removed …@spoke-66684ac4`).
- `/bootstrap` = `identity_endpoint:"http://host.containers.internal:18101"`, relays `[]`, discovery `""`. That is host-dependent, the thing invariant 2 of the 09-12 proposal forbids.
- **The federation oracle runs here**, through the `rhythm-federation-verification` rhythm → `federation_probe` / `federation_verification_report` shape on the node-2 transport. The pool (`/workspace/git/super-repo/pool/standing.json`, 1,044 items) holds **18 `federationVerificationReport`s from 09-26 07:16 to 09-29 03:46, all identical in substance**: coverage 0.588→0.647 (11/17 decided), `blocking_reason: no_relay_anchor`, `sweep_validity: degraded(controls_inert:NC4)`, 9 pass / 2 fail / 6 undecidable.
- Latest sweep verdicts (`sweep-2026-09-29T03:46:58.281Z`):
  - pass: I0 probe usable, I1_no_frozen_address, I2_anchor_precedence, I2_join_overlay (unit active), **I1_foreign_vantage_reachable (registered 8, with_circuit **1**, witness_scope "same-network-namespace … NOT off-host")**, I3_find_after_join, I7_leave_propagates, I11, I12.
  - fail: I3_join_door_honest (`join_door_host_dependent`), I2_relay_anchor (`no_relay_anchor`).
  - undecidable: I4_forced_relay, **I5_direct_preferred ("The dial request has no valid addresses for peer 12D3KooWNw7…" = node 2's own transport)**, **I9_ingress_authenticated (same dial error)**, I8 (no foreign rows), I10.
  - So the "direct-only" transport the 09-12 change ungated **announces no dialable address**. The direct rung it was meant to make healthy doesn't work at all, and the two invariants that would show it (I5, I9) sit in `undecidable` instead of `fail`.

### syzygy-local-surface / syzygy-local-inventory
- `DISABLED_VESSELS` contains `federation-relay` (correct for spokes). `HUB_DISCOVERY_URL` points at `syzygy.host`. Each holds 1 reservation (TTL ~1h, refreshed). `/bootstrap` advertises the droplet relay and `identity_endpoint: http://syzygy.host:18101`.
- Log errors over 7 days: surface `register -> 401` ×86 (09-22 20:12 → 09-28 18:30, still recurring), `hub-register … FAILED …:401` ×9, `getaddrinfo ETIMEOUT syzygy.host` ×3, reservation lost/reacquired ×5, `egressNoReservationCount 11`, last redial reason `egress could not reach goal-host-vessel@syzygy-hub over any live circuit`. Inventory: `register -> 401` ×48, reservation lost/reacquired ×3.
- Forward targets by day, surface: 09-22: 4,409 to hub peer `…6yz95okd7tjBHWkVAAdZ`; 09-23: 1; 09-25: 485 to hub + 271 to `…3PjfJCE62W8rdCu9aLSZ`; 09-29: 2 to inventory. Inventory: 09-24: 33; 09-25: 150. **P2P traffic has been near-idle since 09-25.**

### syzygy-hub droplet (104.236.0.175)
- TCP 30333/18100/18101/18210 open from the host. The old droplet `138.197.116.56:18100` still times out (the Defect A address).
- Discovery: 29 rows, 402 shapes, uptime ~7.06 days. `/bootstrap` is honest (public relay + public identity + discovery endpoint), because this node was hand-fed `PUBLIC_IP`.
- Metrics carry historical ids for **16 distinct `spoke-xxxxxxxx` substrates** plus `local-dev-spoke`, `syzygy-hub` (self-mirror rows such as `llm-resolver-opus@syzygy-hub`) and the two syzygy-local rows. Every ephemeral compose/demo run minted a fresh `spoke-<hex>` identity, so identity churn is visible in the hub's metric cardinality (codebase-bloat / residue).
- **Unauthenticated `GET /vessels/:id` and `/metrics` on a public IP** expose the fleet topology (vessel ids, shapes, endpoints). The 09-12 proposal lists the libp2p-ingress confused deputy as still open, and this adds an HTTP surface to the same exposure.

## 2. The untracked `scripts/substrate/federation-relay/.relay-pub-key.protobuf`

- 68 bytes, mtime 2026-09-16 09:39 PDT. **Not gitignored** (`git check-ignore` → nothing). Untracked.
- **Misnamed: it's an Ed25519 *private* key**, libp2p protobuf with KeyType=1 and a 64-byte data field (seed+pub). A public-key protobuf would carry 32 bytes. I derived its peer id locally without printing key material: `12D3KooWLvbz9cQddY2q8DZLYUMQ3ZQqJEAZXrERP7s15aMRREto`.
- Provenance: an operator session on 2026-09-16 (transcripts `faba5acd…`, `28f8c594…` and 4 others) ran an ad-hoc
  `docker run --name substrate-relay-pub -p 30333:30333 -v $PWD/scripts/substrate/federation-relay:/r -e RELAY_KEY_FILE=/r/.relay-pub-key.protobuf … bun relay.ts`
  to prove off-host reachability. The peer id appears in `validation/failure-modes/scenarios/fed-relay_unreachable_off_host.json`
  (announced `/ip4/10.0.0.104/tcp/30333/p2p/12D3KooWLvbz…`) and in `validation/human-participation/witness-excluded/diff-parent1-f17a81a0.diff`.
  `git log -S` finds it in `13c5d466` (Substrate Autonomous, 09-18, a `vessel-code-commit-and-push` of Obsidian project notes), so the id already leaked into an autonomous commit's content.
- The container `substrate-relay-pub` no longer exists. The key belongs to no running relay (the live relay is `12D3KooWDcbTx…`).
- **Disposition**: experiment residue holding a private key in the super-repo tree. It's one `git add -A` from being committed. By default `relay.ts` writes `./relay-key.protobuf` into its CWD, which is the tree, so the class is "relay identity persisted into the source tree". A detector would be a pre-commit refusal of `*.protobuf` under `scripts/`. Safe to delete (identity unused). Belongs to class `test-residue-live-state` / `codebase-bloat-fossils`.

## 3. OpenSpec federation changes: real status

| Change | Tasks | Real status |
|---|---|---|
| `2026-05-23-vessel-federation` | 0/43 checked | Never ticked. Superseded by later relay/transport work (`libp2p-federation-transport` 2026-06-30). Fossil spec, should be archived with a pointer, not implemented |
| `2026-05-31-substrate-fleet-federation` | 0/53 checked | Same: fossil, superseded |
| `2026-07-05-distributed-spoke-development` | 9/21 | Open items are mostly not federation (drafter stale base, pull schedule, spoke ownership). The federation item "2026-07-04-single-transport-story: cross-machine resolves ride the federation egress, not loopback" is **still false**: node 2 → node 1 is loopback-style `host.containers.internal` HTTP |
| `2026-07-19-relay-findability-replication` | proposal only | Items: (1) registration replication: **not landed** (discovery has no replicate/forward-on-register; 09-12 re-check still no match). (2) loud reservation: **landed** (logs "remote visibility suspended … refreshes immediately on reacquisition"). (3) honest `/bootstrap`: **not landed**, live-confirmed today on node 1 and node 2. (4) hub-side `PEER_DISCOVERY_ENDPOINTS`: partially (node 1 has it set by env) |
| `2026-09-12-host-independent-federation-join` | proposal + Outcome section | Outcome claims landed: transport ungate, anchor precedence, frozen address removal, cross-boundary de-advertise, sibling derivation, discovery over overlay, multiaddr-only anchor. **Not landed per its own text**: honest `/bootstrap` (3 compose dispatches refused, `grounding window (0 BYTES)`), identity over multiaddr join, confused deputy. Registration replication (step 5) isn't mentioned in the Outcome at all and is still absent. Live today: the ungated direct-only transport runs on node 2 but announces no dialable address (I5/I9 undecidable), so "a relay-less transport is a healthy transport" is true only at the level of `systemctl is-active` |

## 4. Git history of the federation subsystem

- `repos/libp2p-federation-transport`: 11 commits. The primitive and ingress sidecar date from 2026-06-30 (`2bb1189`), with fixes 07-07/07-11/07-19 (DevBob). Autonomous mitosis cutovers came 07-24..07-29 (`a677065`, `8d6a864`, `42e77b8`, `d459bba`). Then `542e712` (09-19, Substrate Autonomous "vessel-code-commit-and-push") **committed compiled `.js/.d.ts/.map` build output** (+362-line `src/index.js` etc.). That's hollow residue.
- `scripts/substrate/federation-relay`: ~45 commits. **About 40 hand-authored (DevBob) commits between 09-11 and 09-15**, almost all fixing the *oracle* (`federation-probe-tick.ts`): "a negative control that could not fail", "the flapping gap's closure predicate was instantaneous", "the phantom watchdog was manufacturing the outage it existed to catch", "the oracle lived in the workspace it measures, and the subject deleted it", "the oracle was littering the relay with reservations it could never reap", "stop advertising the echo instrument — it was outcompeting the shape it measures", "a close must close something — the close rate was inflatable". Then `aba286bd` (09-15, hub self-anchors) and `d8fed96f` (09-23, one role derivation / named profiles / in-container relay). **Zero substrate-authored federation fixes landed**; the one attempt (compose on `discovery/src/index.ts` for honest bootstrap) was refused three times on an empty grounding window.
- Tracked `.js/.d.ts/.map` beside every `.ts` in `scripts/substrate/federation-relay` (20 files). Units execute the `.ts` (`ExecStart=… bun …/federation-transport-server.ts`), so the `.js` are dead. They were committed by autonomous drift commits `4e4170a8` (09-07, "vessel code drift detected and committed") and `796fac89` (09-19). The `.js` versions are stale against the `.ts` (transport `.ts` last changed 09-14, `.js` 09-19 from an older compile).
- `fed-federated-resolve.ts` (29 lines), `fed-resolve-client.ts` (10) and `obsidian-passthrough.ts` (101) have **no callers** outside their own .d.ts. By the CLAUDE.md script-retention rule they're fossils.
- Third libp2p node implementation: `repos/obsidian-vessel/sidecar/federation-sidecar.ts` (711 lines; DevBob 07-20..07-30). It duplicates the ingress/owner-merge logic of `federation-transport-server.ts`.

## 5. Gap store (node 1 `/workspace/git/super-repo/gaps/gaps.json`, 6,279 rows): 112 federation-related (61 open / 51 closed)

- Oracle-filed `fed:*` (all created ≥ 09-18; the seven classes calibrated on 09-12 aren't in the store, so either a rebuild dropped them or they closed and were pruned):
  - `fed:join_door_host_dependent`: **open** since 09-18, 18 consecutive quiescent failing sweeps. Same defect as the 07-19 item 3 and 09-12 Defect C. Age since first spec: **72 days**.
  - `fed:no_relay_anchor`: **open** since 09-22. **Its evidence note is a frozen template that now lies**: "circuits need a transport, and the transport refuses to start without an anchor. The bootstrap is circular". The ungate landed 09-12 (`87e30952`). The current cause is topological (no relay exists on the B island), and the gap text sends a reader to a fixed cause (false-verification / docs-drift).
  - Closed by measurement: `fed:punchthrough_unavailable` (09-18→09-19), `fed:stale_foreign_rows_advertised` (09-19→09-20), `fed:relay_dial_failed` (09-21→09-22), `fed:registry_lost_local_rows` (09-25→09-26, proven by I12 with `own_rows 11, foreign_rows 1`). These closures are honest about the predicate, but they were measured on a vantage with **zero foreign peers**. `punchthrough_unavailable` "closed" while `holePunchSuccess` reads 0 on every live transport.
- **17 `gap-federation-*` capability gaps are the same hat**: the walk invented a new target shape name each time someone asked "report federation state": `federation_state_summary`, `federation_overlay_state`, `federation_invariants_status`, `federation_overlay_state_details`, `federation_verification_overlay_state`, `federation_overlay_state_report`, `federation_invariants_report`, `federation_status_report`, `federation_state_decomposition`, `federation_overlay_state_summary`, `federation_status`, `federation_overview_report`, `federation_state_report`, `federation_state_summary_report`, `federation_overlay_current_state`, `federation_overlay_report`, `detailed_federation_state` (09-19 → 09-29). The real shape `federation_verification_report` exists and is served. 16 were batch-closed 09-28 01:26-01:29. The 17th (`gap-detailed-federation-state`) was created 09-29 00:38 and closed, which means **the class recurred within 23 hours of the batch close**. Plus `reach-gap-federation-verification-report` and `reach-gap-federation-probe` (open, 09-24): the shape is advertised, but the walk cannot reach it. Class: goal-walk-floor (target inference), narrowing-duplicates.
- `gap-mu82wqoh` (open 09-19, `edit_site scripts/substrate/gen-env.sh`): "A reboot silently de-federates the fleet: the boot-time env generator regenerates … relay anchor, hub URL and the cross-domain key vanish while every unit reports healthy". **Live today, that's exactly node 1's state**: it was `local-dev-spoke`, and now `HUB_DISCOVERY_URL` is empty, no transport runs, and every unit reports healthy.
- `gen-env-re-quotes-an-already-quoted-persisted-secret-so-peer-discovery-endpoints-is-an-invalid-url` (open 09-20). `discovery-forwardtopeers-discards-per-peer-outcomes-so-a-misconfigured-peer-is-byte-identical-to-no-peers` (open 09-20) plus its `-narrowed` child, plus route-edit/recommit descendants on `repos/discovery-vessel`. Node 1's discovery journal has **0 "peer" lines in 24h**, so fan-out outcomes stay invisible.
- `an-operator-pause-and-rhythm-posteriors-are-node-local-so-a-peer-node-keeps-draining-a-paused-rhythm` (open, human_reported 09-26): node 2 drained node 1's paused project-intake goal (14 lines in hour 15, 17 in hour 18, all hollow). That's the node-locality class, carried by HTTP pinning because federation doesn't carry state.
- `when-a-local-producer-restarts-the-surface-reads-a-federated-peers-state-and-shows-another-substrates-findings-as-its-own` (open 09-25) plus narrowed/recommit/route-edit children (semantic_reject ×2). `while-goal-host-drains-the-surface-routes-a-goal-to-an-unreachable-federated-peer…` (open 09-25) plus narrowed/route-edit children. Federation fallback **leaks foreign state into the local surface** (identity/tenancy of rows).
- `docs-drift-docs-FEDERATION-md` (open 09-18, 4 invariant violations), `docs-drift-docs-operations-FEDERATION-GENRES-md` (open 09-20).
- The `auto_draft_decision:*` quadruplets (triggered/reused/authored/fallback_recommend) cover each federation dispatch, e.g. `health check for vessel federation-transport-vessel@local-dev-spoke` (09-21) and `…@spoke-40c731a3` (09-20). That's 4 bookkeeping gaps per dispatch (gap-store bloat).

## 6. Claims vs. later evidence

| When | Claim | Where | Later |
|---|---|---|---|
| 2026-06-30 | "libp2p Circuit Relay v2 federation transport — primitive + ingress sidecar" + e2e through a live hub relay | `repos/libp2p-federation-transport` `2bb1189`, `baa360c` | Primitive works (syzygy island uses it). Production pair never adopted it |
| 2026-07-19 | Operator-ratified "a direct connection should be equivalent to a punchthrough" | 07-19 proposal | 09-29: `holePunchSuccess 0` on every transport; same-host containers talk via a cloud relay; node 2's direct-only transport has no dialable address (I5 undecidable) |
| 2026-07-19 | Registration replication, honest bootstrap | 07-19 proposal (spec) | Still not landed after 72 days |
| 2026-09-12 | "A relay-less transport is a healthy transport" (`87e30952`) | transport + 09-12 Outcome | True by `systemctl` only. The relay-less transport on node 2 reports ok but is undialable and invisible (no mirror, no multiaddr) |
| 2026-09-12 Outcome | "Anchor precedence … anchors no longer persisted; `.substrate-secrets` can no longer outrank" | 09-12 Outcome | I2_anchor_precedence and I1_no_frozen_address pass on node 2. Consistent |
| 2026-09-12 Outcome | "Discovery over the overlay: a foreign peer fetched substrateBootstrap and vesselCapability over libp2p"; "Multiaddr-only anchor" | 09-12 Outcome | Demonstrated in the lab. No production node uses a multiaddr anchor (`PEER_MULTIADDR` empty on node 1 and 2) |
| 2026-09-15/16 | Network demo: "Add/remove hit the ideal contract exactly: one verb, zero config, network-wide propagation"; post-fix validation "hub resolves memoryNote from spoke … over libp2p" with ZERO interventions | `validation/reports/network-demo/REPORT.md`, `VALIDATION-POST-FIX.md` | Proven only in throwaway `val-hub`/`val-spoke` containers (torn down). The production pair created 09-23/09-26 never joined an overlay. The demo's own caveat, "spoke→hub fan-out returns found:false … capability queries mislead", is unresolved |
| 2026-09-16 | Off-host reachability "architecturally SATISFIED" (LAN 10.0.0.104); environmental part open | `validation/failure-modes/scenarios/fed-relay_unreachable_off_host.json` | Honest split. Left an untracked private key in the tree (§2) |
| 2026-09-18..26 | `fed:punchthrough_unavailable`, `fed:stale_foreign_rows_advertised`, `fed:relay_dial_failed`, `fed:registry_lost_local_rows` "CLOSED BY MEASUREMENT" | gap store | Closures measured on a vantage with ≤1 foreign row and no peers. Accurate on predicate, vacuous on the federation question |
| 2026-09-28 01:26 | 16 `gap-federation-*` capability gaps closed | gap store | 17th invented-name gap opened 09-29 00:38. Same hat |
| 2026-09-19 | "A reboot silently de-federates the fleet" (gap-mu82wqoh) | gap store | Still open. Node 1 is the live instance (was `local-dev-spoke`, now non-federated) |

## 7. Mechanisms inventory (keep / fossil)

| Mechanism | Location | Status | General? | Evidence |
|---|---|---|---|---|
| libp2p primitive (`createVesselLibp2p`, `resolveViaLibp2p`, `serveResolve`) | `repos/libp2p-federation-transport/src/index.ts` | live-used (syzygy island) | general, shared seam | imported by transport, probe, sidecar |
| Federation transport (one libp2p identity per substrate, per-vessel mirror rows, ingress proxy with `_fedTargetVessel`, egress) | `scripts/substrate/federation-relay/federation-transport-server.ts` (1,412 lines) | live-used on syzygy; live-unused on node 2 (no anchor); absent on node 1 | general | forwards logged on syzygy; node 2 0 connections |
| Circuit relay | `scripts/substrate/federation-relay/relay.ts` | live only on the droplet; not on node 1 or 2 | general | relay unit not-found on node 1/2 |
| Federation oracle (ephemeral nonce peer, NC1-8 controls, fed:<class> auto gaps, close-by-measurement) | `federation-probe-tick.ts` (1,451 lines) served as `federation_probe`/`federation_verification_report` | live-used on node 2 only (18 sweeps 09-26..29), stuck at 0.647 | general instrument, but vantage-limited | pool reports; witness_scope same-netns |
| Discovery peer fan-out (`forwardToPeers`, `forwardResolveToPeers`) | `repos/discovery-vessel/src/index.ts` | live but unobservable (0 peer log lines, open gap on discarded outcomes) | general | gap `discovery-forwardtopeers-discards…` |
| Registration replication | (none) | never built | – | 07-19 item 1, 09-12 step 5 |
| Hub self-anchor (entrypoint auto-enable of relay+transport for hub profile) | `scripts/substrate/entrypoint.sh` | dormant: no production node runs `PROFILE=hub` | specific | node 1 standalone, node 2 compute |
| Obsidian federation sidecar (third libp2p implementation) | `repos/obsidian-vessel/sidecar/federation-sidecar.ts` | unknown / likely dormant (no `obsidian:note` advertised anywhere; 681 intake skips/24h) | duplicate of transport ingress/owner-merge | – |
| `fed-federated-resolve.ts`, `fed-resolve-client.ts`, `obsidian-passthrough.ts` | federation-relay dir | fossil | – | no callers |
| Compiled `.js/.d.ts/.map` (20 files) + `542e712` build output | federation-relay dir, transport repo | fossil residue | – | units execute `.ts` |
| `.relay-pub-key.protobuf` (private key) | federation-relay dir | residue, security-relevant | – | §2 |
| HTTP env pinning node 2→node 1 (9 keys to `host.containers.internal`) | compose2 `/etc/substrate/env` | live-used, and it's what federation really is today | specific / anti-pattern (law 1, 11) | §0 |

## 8. Problem classes (recurring, different hats)

1. **federation-p2p / node-locality: production nodes aren't on the overlay.** Hats: 05-23 and 05-31 specs (0/96 tasks) → 06-30 primitive → 07-19 "relay findability" → 09-12 "host-independent join" → 09-15 network demo → 09-19 gap-mu82wqoh "reboot de-federates" → 09-26 "operator pause is node-local" → 09-29 node 1 with no transport at all. Root cause: federation is enabled by env presence (`HUB_DISCOVERY_URL`/`PEER_MULTIADDR`/`PROFILE=hub`) at boot. The production launch never sets those for the pair, and nothing measures federation **between the production nodes**. The oracle measures from inside one node and reports `I8 undecidable / no foreign rows` as a non-failure.
2. **false-verification: vantage-limited oracle.** Coverage is 0.647 with passes that are local-registry verdicts (I3_find_after_join, I7, I12) and an I1 "foreign_vantage_reachable" pass whose own witness_scope says "NOT off-host". I5/I9 are undecidable because the transport has no address. That's a failure reported as unknowable. Four fed:* gaps "closed by measurement" on a vantage with no peers.
3. **env-gating / endpoint-routing: HTTP host pinning stands in for discovery.** Node 2's 9 env URLs to `host.containers.internal:18xxx`. `/bootstrap` still derives anchors from `PUBLIC_IP`/`*_PUBLIC_URL` env (node 1 loopback, node 2 `host.containers.internal`, droplet honest only because hand-fed). 72 days open.
4. **goal-walk-floor / narrowing-duplicates: invented federation shape names.** 17 capability gaps in 10 days for one existing shape. Batch-closing them didn't stop the generator (recurred in <23h).
5. **dormant-mechanism: lab-proven, production-absent.** Network demo, multiaddr-only join, discovery over overlay, hub self-anchor. All proven once in throwaway containers, none running on node 1 or 2.
6. **codebase-bloat-fossils / test-residue: build output, orphan scripts, private key, spoke-id churn.** 16+ ephemeral `spoke-<hex>` identities in the droplet hub metrics.
7. **human-surface-escalation: the human surfaces sit on the other island.** Node 1's obsidian intake skips 681×/day. Surface-side forwards show foreign state as local (open gap).
8. **drafter-quality / gap-content: compose couldn't edit discovery `index.ts`** (grounding window 0 bytes ×3). Route-edit/narrowed/recommit (semantic_reject) chains pile up on discovery federation gaps.

## 9. Keep / organize recommendation (for realignment)

- **Keep (general, live-used)**: `libp2p-federation-transport` primitive; `federation-transport-server.ts` (single identity per substrate, mirror rows, `_fedTargetVessel` ingress); `relay.ts`; `federation-probe-tick.ts`, but **re-vantage it**: it needs a second, foreign vantage (run the probe on node 1 against node 2 and vice versa) and I5/I9 "no valid addresses" must grade `fail`, not `undecidable`.
- **Decide explicitly** whether node 1 is the hub. If yes, set it by profile (`PROFILE=hub`), which auto-brings relay+transport, and publish 30333. Then replace node 2's 9 pinned `host.containers.internal` URLs with discovery/overlay resolution. Until then, "hub" is a word, not a topology.
- **Land the two 72-day items**: honest request-derived `/bootstrap` and registration replication. The first is blocked on the compose grounding-window defect, which is itself the gap to fix.
- **Retire**: `2026-05-23-vessel-federation` and `2026-05-31-substrate-fleet-federation` (0/96, superseded); `fed-federated-resolve.ts`, `fed-resolve-client.ts`, `obsidian-passthrough.ts`; tracked `.js/.d.ts/.map` in `scripts/substrate/federation-relay` and the `542e712` output in the transport repo; delete `.relay-pub-key.protobuf` and gitignore `*.protobuf` under the relay dir (relay default `RELAY_KEY_FILE=./relay-key.protobuf` writes into the tree).
- **Fix the lying evidence template** in `fed:no_relay_anchor` ("transport refuses to start…"). It points readers at a cause fixed on 09-12.
- **Collapse the shape-name generator**: the 17 `gap-federation-*` names should alias to `federation_verification_report` in target inference (concept alias), not be closed one by one.
