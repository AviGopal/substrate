# Shard: syzygy — the `syzygy-local-surface` and `syzygy-local-inventory` containers

Read-only investigation, 2026-09-29 ~04:20 UTC (host date 2026-09-28 PDT). Sources: `docs/guides/SYZYGY_LOCAL_SURFACE.md`,
`validation/reports/syzygy-local-bringup-2026-09-22/*`, container inspection (`vessel-ctl status`, journals,
workspace/surreal volumes, local `/health`), read-only HTTP GETs against the remote hub discovery
(`syzygy.host:18100`, via the spoke's own issued key, never printed), git history of the super-repo and
`repos/libp2p-federation-transport`, `repos/discovery-vessel`.

## 1. What these containers are

- **Spokes of the remote production hub `syzygy.host`** (resolves to `104.236.0.175`; July memory notes record
  the hub at `138.197.116.56` — the hub VM moved). They are **not** peers of the local `substrate-live` /
  `compose2-live` pair: the local `substrate-live` discovery returns `Vessel not found` for
  `goal-host-vessel@syzygy-local-inventory-20260922`, `human-surface-vessel@syzygy-local-surface-20260922`
  and `goal-host-vessel@syzygy-hub`; the remote hub returns `Vessel not found` for every `@local-dev-spoke`
  id (local `substrate-live` calls itself `FED_SUBSTRATE_ID=local-dev-spoke` and lists syzygy.host in
  `PEER_DISCOVERY_ENDPOINTS`, but is not registered at the hub). So the host runs **two disjoint
  federations**: {remote Syzygy hub + syzygy-local-* spokes} and {substrate-live (node 1, local hub) +
  compose2-live (node 2)}. The 9-23 install demo (`validation/reports/install-demo-2026-09-23/REPORT.md`,
  commit `2f002a09`) peered nine more fresh fleets against both hubs, then tore them down.
- Created by an operator agent on **2026-09-22** from a pinned local image
  `125775d713bcfb1011ff6516766f2bb807f1d50036aa678eb733f830b1bfb94e` (built 2026-09-22 09:04 UTC) via
  podman-compose: `validation/reports/syzygy-local-bringup-2026-09-22/compose.yaml` (surface, created
  11:07 PDT) and `inventory-compose.yaml` (inventory, created 12:27 PDT). Both `restart: unless-stopped`,
  `privileged: true`, up 6.4 days, `restarts=0` on every unit.
- **syzygy-local-surface**: `ENABLED_ROLES=spoke`, `ENABLED_VESSELS=surrealdb,valkey,discovery-vessel,
  human-surface-vessel,federation-transport-vessel,substrate-ready,journald-stdout-forwarder`;
  `DISABLED_VESSELS=identity-vessel,identity-seeder,federation-relay`; host port `127.0.0.1:38310 -> 8310`;
  `FED_SUBSTRATE_ID=syzygy-local-surface-20260922`; identity `syzygy.host:18101`; activity-api
  `syzygy.host:18080`. Purpose: a browser human surface on the laptop backed by the remote hub.
- **syzygy-local-inventory**: same plus `goal-host-vessel,local-tools-vessel`, no role; port 38320;
  `FED_SUBSTRATE_ID=syzygy-local-inventory-20260922`. Purpose: an "explicit inventory + idempotence" proof
  (`inventory-idempotence.json`, workspace marker `inventory-proof-v1`). It was a **proof fixture that was
  never torn down** and still runs a goal-host and local-tools that are advertised to the production hub.
- Both mount `surface-host.conf` (`Environment=HOST=0.0.0.0`) as a systemd drop-in because the baked
  human-surface unit binds container loopback (documented gap, worked around, not fixed in the image).
- Env flags set in compose: `MITOSIS_DIRECT_PUSH=0`, `ROUTE_EDIT_INTENT_TO_COMPOSE=0` (law-1 env gating;
  harmless here since no dev-vessel runs, but it is behavior behind env).
- Resource footprint: surface 316 MB / 162 PIDs, inventory 289 MB / 195 PIDs, ~1% CPU each; journals 40 MB
  and 56 MB; surreal volumes 17 MB and 15 MB.

## 2. Stores inside

| Store | surface | inventory |
|---|---|---|
| gaps (`gaps.json`) | none | none |
| memory (`memoryNote`) | none (no development-vessel) | none |
| pool | none | none |
| SurrealDB | running, `INFO FOR ROOT` → **zero namespaces** (16 MB of engine files only) | same, zero namespaces |
| valkey | running, no consumer observed | same |
| discovery registry | 2 local vessels | 4 local vessels |
| human-surface store | panels 0, feedback 0, observations 4, events 0 | all 0 |
| workspace files | `.substrate-secrets`, `fleet/vessels.manifest.json`, `fleet/installed.json` (`federation-transport-vessel`), `git/super-repo/interactor-log/interactorObservation_write.jsonl` (4 rows) | `.substrate-secrets`, `.substrate-secrets.prev`, `idempotence-marker`, `goal-host-dispatches.json` = `[]`, `.goal-host-mem-dump.json` (64 KB, rewritten on interval), `git/super-repo/policies/body-honesty-policy.json` (9-24 17:42), empty dir `test-exec-slots/` (9-25 01:06) |

- Interactor observations (exposure ticks from the browser UI) at 2026-09-22 18:12, 20:05, 09-23 02:07,
  09-25 02:48 UTC are written to the spoke's local jsonl only. No reader on the hub; the learning loop
  never sees them (write-read-mismatch / node-locality).
- The inventory goal-host has **zero dispatches in 6.4 days** (`goal-host-dispatches.json` = `[]`,
  pid 1207, `uptime_s` 550214). `policies/body-honesty-policy.json` and `test-exec-slots/` appeared 2–3 days
  after bring-up with no recorded dispatch; origin unattributed (goal-host startup/self-seeding is the
  likeliest writer; not proven to be test residue).
- The duplicated vessels here (discovery, surreal, valkey, human-surface, transport, goal-host, local-tools)
  duplicate the image's code only; they hold **no learning state** and share nothing with substrate-live.

## 3. Journals (6.4 days)

surface: discovery 67,771 lines / 631 err|warn; transport 19,569 / 14; human-surface 293 / **291**.
inventory: discovery 83,897 / 628; goal-host 65,206 / **10,169**; local-tools 18,539 / 192; human-surface 182 / 180.

Dominant patterns:
- `[human-surface] discovery register failed: 401 (identity_http_error: identity returned 429)` — 290
  (surface), 176 (inventory), every day 9-22 → 9-28 (22/96/14/47/57/50/5 per day on surface). The hub's
  identity rate-limits its own spokes; the error is reported as 401 (auth) though the cause is 429.
- discovery: `POST /register|/heartbeat|/resolve — identity_http_error: identity returned 429` (376+92
  surface; 246+224+57 inventory); `event bus publish failed` (timeouts / socket closed / later `HTTP 401`).
- transport: `hub-register per-vessel ... FAILED ...:401` and `getaddrinfo ETIMEOUT syzygy.host`
  intermittently; also latest inventory `hub-register per-vessel (4 rows) -> all ok` at 2026-09-29 04:22:09.
- surface transport reservation flapping: `relay reservation lost` 09-23 23:20, 09-25 02:00, 09-26 21:20,
  each reacquired within seconds–minutes.
- inventory goal-host: `failed to register dev-vessel proxies: Unable to connect` ×9,172 (~every minute);
  `[expectation-watchdog] check failed (non-fatal): Unable to connect` ×917 — both pinned to loopback
  endpoints of masked units (development-vessel, llm-resolver). Also
  `WS subscriber DISABLED via GOAL_HOST_WS_SUBSCRIBER=off (iter-8 ablation)` — an ablation flag still
  steering runtime (env-gating).
- 18,343 each of `[mem-probe]`, `[gc-tick]`, `[BoundedBusSink]` — diagnostic tick logging every ~30 s
  (journal bloat from debugging instrumentation left on).

## 4. The headline: the 9-22 "Recovered" verdict is falsified today (federation-p2p recurrence)

Live probes 2026-09-29 04:22 UTC, read-only shapes:

```
curl 127.0.0.1:38310/api/resolve {"type":"activeDispatches"}
 -> {"resolved":false,"error":"ingress proxy failed: failed to connect via relay with status NO_RESERVATION"}
curl 127.0.0.1:38310/api/resolve {"type":"llmQuotaState"}   -> same NO_RESERVATION
curl 127.0.0.1:38320/api/resolve {"type":"llmQuotaState"}   -> same NO_RESERVATION
curl 127.0.0.1:38320/api/resolve {"type":"activeDispatches"}
 -> {"resolved":true, ... "dispatches":[],"total":0}   (answered by its OWN local goal-host)
```

Meanwhile each spoke's transport `/health` reports `reservationsHeld:1, activeReservations:1,
phantomSuspected:false`, a live connection to relay `12D3KooWDcbT…` at 104.236.0.175:30333; and the hub
still answers HTTP (`syzygy.host:18100/health` 200, 29 vessels, 402 shapes; goal-host `:18210/health`
healthy) and accepted the inventory's hub-register (`all ok`). NO_RESERVATION is the **target's**
(hub transport's) status at the relay: the hub's circuit is not reachable while both spokes' own
reservation state and HTTP join look green. This is the exact "client-side reservation state vs observed
inbound reachability" disagreement the 9-22 REPORT recorded as "root cause not proven", recovered then by
`ssh … docker exec substrate-live systemctl restart federation-transport-vessel` on the hub. Hub-side
transport state was **not** inspected here (no SSH in scope), so root cause remains unattributed.

Chain of prior "fixed" claims in the same class (reservation/phantom/circuit liveness):
- `c68b54b` (libp2p, 2026-07-11) "force relay re-reservation before the unobservable 1h ttl lapses"
- `0fc8c4c2` (07-11) reservation renewal + egress vessel-targeting
- `4aede401` (07-18) derive the circuit multiaddr live, never from a one-shot startup capture
- `5e48a4e8` (07-31) disable self-mirror on the hub; log egress NO_RESERVATION increments
- `07d6096a` (08-03) raise ingress proxy deadline
- `a0c702bb`/`26a53fe0`/`9834bd95`/`5584bc3f` (09-11/12) an independent overlay oracle + fixes to it
- `1afd003f` (09-14) expose the reservation the relay client actually holds
- `3dbbbeff` (09-14) the phantom watchdog was manufacturing the outage it existed to catch
- `e1c06f60` (09-22 01:46) "joined means a live reservation"
- syzygy REPORT 09-22: "Recovered after restarting only the Syzygy federation transport … not proof that
  the underlying reservation liveness defect cannot recur. Monitor the reservation and egress counters."
- 2026-09-29: broken again on both spokes; nothing detected it (see §5).

## 5. Why nothing noticed (false-verification / dormant detector)

1. **The counter the report told operators to monitor is blind to the failing path.** Inventory
   `egressNoReservationCount` stayed **0** immediately after the NO_RESERVATION failure I triggered;
   its journal shows the request took `local/resolve -> llmQuotaState` then
   `ingress→libp2p forward llmQuotaState to 6yz95okd7tjBHWkVAAdZ` — the ingress-forward path does not
   increment the egress counter. The surface's counter is 11 (historical, from 9-22 and one later
   `lastRedialReason: egress could not reach goal-host-vessel@syzygy-hub over any live circuit`).
2. **"Joined" (e1c06f60) is measured on the spoke's own reservation + HTTP registration**, both green,
   while the function path to the hub is dead. A join predicate that passes on a spoke that cannot reach
   its hub is a gate that does not measure the property it names.
3. **Local-first resolution shadows hub loss.** `repos/discovery-vessel/src/index.ts` `/resolve` (~L209–231):
   fleet fan-out happens only when **no LOCAL producer** exists. The inventory runs its own goal-host, so
   `activeDispatches` returns a green, empty board locally. The REPORT's "spoke reached hub with HTTP 200
   and 50 dispatches" cannot be reproduced through this surface today; a green board is not a hub read.
4. `substrate-ready --once --json` reports `ready:true` on both — readiness does not include federation
   function reachability.
5. The probe harness (`operate.py probe`, `probe.ts`) is manual-only; no activity or timer runs it, so
   the "monitor" instruction had no runtime reader (teach-through-the-channel-that-is-read violation).

## 6. Hazards the spokes introduce into the production hub (registry rows, all `identity_status:"unverified"`)

Read from `GET syzygy.host:18100/vessels/<id>`:
- `goal-host-vessel@syzygy-local-inventory-20260922` advertises `goal_execution`, `goalDispatchAsync`,
  `activity_execution`, `poolImpulse_write`, `walkBudget`, … — yet its LLM is pinned
  `http-vessel:http://127.0.0.1:8220` with llm-resolver **masked**, and dev-vessel masked. An advertised
  executor that cannot execute (a goal routed there cannot reach). Whether the hub ever routes to it
  depends on local-first + distribution policy; other spokes without a goal-host would see two producers.
- `local-tools-vessel@syzygy-local-inventory-20260922` advertises `shell`, `bash`, `bounded_shell`,
  `fs_write`, `fs_edit`, `gitCommitResult`, … — the operator laptop's container exposes effectful tools
  to the production network (the REPORT probed the reverse direction: hub `shellResult` printf from here).
- `human-surface-vessel@syzygy-local-surface-20260922` advertises `uiQuestion`, `uiQuestion_write`,
  `uiPanel_write` — a human resolver on a loopback-only laptop port that nobody is watching (store panels 0).
  Same class as the memory finding "248 gap escalations asked of a vessel no human reads".
- All rows carry `endpoint: http://127.0.0.1:8401` (the transport ingress) — P2P-only reachability; when
  the circuit is dead these rows remain "healthy" in the hub's stats (`healthyCount:29` of 29).

## 7. Drift and duplication vs substrate-live

Source md5 over `src/**/*.ts` in `/vessels/<v>`:

| vessel | syzygy-local-* (image 125775d7, 9-22) | compose2-live (7f035a9f, 9-25) | substrate-live (204a0be9, 9-24) | repo working tree |
|---|---|---|---|---|
| human-surface-vessel | 1933d2a347 | 1933d2a347 | **8a8ad9567f** | 1933d2a347 |
| goal-host-vessel | a30ff17972 | 27c542ffe6 | 27c542ffe6 | 117351d047 |
| discovery-vessel | d6b98a0e12 | b84c59f71d | b84c59f71d | b84c59f71d |
| local-tools-vessel | 7b754c1b84 | 31e692c264 | 31e692c264 | – |

- The syzygy spokes run a frozen 9-22 image: no development-vessel, no pull-sync; goal-host repo has 31
  commits since 9-21. They cannot self-update (sync-deploy-drift by construction of the fixture).
- `substrate-live`'s human-surface differs from repo/compose2/syzygy; which side is newer is unattributed
  (human-surface is plain files in the super-repo, not a submodule — memory: "authorability = submodule
  membership").
- The REPORT itself records that `substrate-live` (then image `46d6397c…`) was resumed with no Syzygy
  topology and "does not establish that it joined Syzygy". That remains true: substrate-live is not in the
  hub registry.

## 8. Fossils and residue

- Exited predecessor containers with retained volumes: `spoke-syz` (created 2026-09-17, exited 09-18;
  volumes `spoke-syz-workspace`, `spoke-syz-surreal`; its join key was reused for the syzygy-local join),
  `mini-node` (exited 6 d), `verify-node`, `coldboot-node`, `coldboot2-node` (exited 9–10 d).
- The two syzygy containers themselves: a one-off verification fixture (surface) and an idempotence proof
  (inventory) left running 6+ days, both now non-functional for their stated purpose (NO_RESERVATION).
- `.substrate-secrets.prev`, `idempotence-marker` in the inventory workspace; `.env.syzygy-local` at repo
  root (gitignored credential file, 177 B, not read).
- **Untracked documentation and evidence**: `docs/guides/SYZYGY_LOCAL_SURFACE.md`,
  `docs/guides/CONTAINER_NETWORK_LIFECYCLE.md`, `docs/guides/HUMAN_PROJECT_LIFECYCLE.md`, and the whole
  `validation/reports/syzygy-local-bringup-2026-09-22/` directory are `??` in git — never committed —
  while `docs/README.md:150` (modified, uncommitted) and `HUMAN_PROJECT_LIFECYCLE.md:39` link them.
  The guide's lead "Observed result: local setup succeeds … The board now reads hub-owned dispatches" is
  false as of 9-29; it is also dated evidence living in `docs/` (law 9 says dated status belongs elsewhere;
  the doc half-acknowledges this: "retained as dated evidence … not portable configuration").
- Diagnostic tick logging (`mem-probe`, `gc-tick`, `BoundedBusSink`, 18k lines each) and the
  `GOAL_HOST_WS_SUBSCRIBER=off (iter-8 ablation)` flag are experiment residue baked into the image.

## 9. Relation to recurring classes (keys)

- federation-p2p: NO_RESERVATION recurs after ≥8 "fixed" commits and a 9-22 recovery; spoke reservation
  flaps every 1–2 days.
- false-verification: join/readiness/health/counter all green while function path is dead; blind counter.
- node-locality: local-first shadowing; interactor observations stranded on the spoke.
- endpoint-routing: goal-host pinned loopback LLM/dev-vessel; 9,172 futile proxy registrations.
- human-surface-escalation: uiQuestion producers nobody reads advertised to hub.
- identity rate limit (429 reported as 401) — auth errors wearing a hat; hub identity is a shared
  choke point for every spoke's discovery register/heartbeat/resolve.
- dormant-mechanism: empty SurrealDB + valkey per spoke; probe harness with no scheduled reader.
- sync-deploy-drift: frozen image, no pull-sync on spokes.
- docs-drift / codebase-bloat-fossils: untracked docs + evidence, stale verdict, orphan containers/volumes.
- env-gating: `ROUTE_EDIT_INTENT_TO_COMPOSE=0`, `MITOSIS_DIRECT_PUSH=0`, `GOAL_HOST_WS_SUBSCRIBER=off`.

## 10. Keep / retire recommendations (for the realignment)

Keep:
- The compose-based explicit-inventory launch pattern and the idempotence proof method (repeat-up,
  force-recreate, marker, registry presence, bidirectional read) — generic, reusable; belongs in the
  install acceptance, not in a laptop fixture.
- The REPORT's own falsifier: `/api/resolve {"type":"activeDispatches"}` checking `resolved`, not HTTP
  status — but it must target a shape with **no local producer** (e.g. `llmQuotaState`) or it is shadowed.
- The failure-boundary write-up (circuit ids, relay, recovery command) as evidence for the P2P gap.

Retire / fix:
- Stop or down the two syzygy fixtures (operator decision) or at minimum de-advertise their goal-host,
  local-tools and uiQuestion rows from the production hub.
- Replace "monitor egressNoReservationCount" with a scheduled activity that performs a function-path read
  to a non-locally-served hub shape and files a gap on failure; count ingress-forward failures.
- Make "joined"/"ready" require a round-trip function read, not reservation + HTTP register.
- Commit or delete the untracked guides/evidence; drop the false "succeeds" lead.
- Reap orphan containers/volumes (`spoke-syz*`, `*-node`).

## Coverage notes

- Covered: both containers' config, units, stores, SurrealDB contents, journals (pattern counts per unit,
  per-day error series), transport health, live function probes, hub registry rows for the spokes, local
  substrate-live registry cross-check, image/source drift, git history of the federation/reservation class,
  related docs and the 9-23 install demo.
- Not covered: hub-side (syzygy.host) transport/relay state and journals (would need SSH; out of scope),
  hub identity rate-limit configuration, contents of `.goal-host-mem-dump.json` beyond the header, the
  exited `spoke-syz` volume contents.
- Side effects: my probes caused read-only resolves (activeDispatches, llmQuotaState) through both spokes
  and hub registry GETs; I created and deleted `/tmp/hubreg.json` inside `syzygy-local-inventory`.
  `INFO FOR ROOT` output included the root user's argon2 PASSHASH in my terminal; it is not reproduced here.
