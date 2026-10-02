# Mechanism verdicts: chunk 40 (libp2p-federation-transport)

Input: `classes/_mech_chunks/40.json`, 7 collector items in area `libp2p-federation-transport`. Class history comes from `classes/federation-p2p.json`, which holds the attempts from 06-30 through 09-29.

I verified all of this read-only on 2026-09-29 between 05:15 and 05:25 UTC:

- **Node 1 (`substrate-live`):**
  - the clone at `/workspace/git/vessels/libp2p-federation-transport`
  - the unit states
  - a grep for importers
- **Node 2 (`compose2-live`):**
  - the unit file (`systemctl cat federation-transport-vessel`)
  - `/health` on `:8401`
  - the journal
  - the pool file `/workspace/git/super-repo/pool/standing.json`
- **Syzygy island (`syzygy-local-surface`, `syzygy-local-inventory`):**
  - transport `/health` and 24h journals
  - live read-only resolves through `127.0.0.1:38310` and `:38320` `/api/resolve` for the shapes `llmQuotaState` and `activeDispatches`
- **Super-repo:** `git ls-files scripts/substrate/federation-relay`.

**Deduplication:** the 7 items reduce to **5 mechanisms**. Collector items are cited as `#n`, 0-based in chunk order.

| # | Mechanism | Items merged |
|---|---|---|
| M1 | libp2p primitive (`createVesselLibp2p` / `resolveViaLibp2p` / `serveResolve[Http]` / `resolveViaHttp`), including `sendAll` chunking and forced TTL re-reservation | #4, #2 |
| M2 | federation-transport-vessel: relay reservation, ingress→libp2p forward, hub mirror (`scripts/substrate/federation-relay/federation-transport-server.ts`) | #5 |
| M3 | standalone ingress sidecar with phantom-reservation redial (`repos/libp2p-federation-transport/src/sidecar.ts:148-160`) | #3 |
| M4 | federation verification oracle (`federation-probe-tick.ts` → shapes `federation_probe` / `federation_verification_report`) | #1 |
| M5 | compiled `.js/.d.ts/.map` build output committed beside the `.ts` | #0, #6 |

## Live facts that change the collector claims

- **#5 "broken, NO_RESERVATION on every hub-only read" is now intermittent, and the failure is silent.**
  - `raw/syzygy.md` §4 recorded NO_RESERVATION on 38310/38320 at 04:22 UTC.
  - At 05:22 UTC the same read-only resolves returned `resolved:true`. The journal for `llmQuotaState` and `activeDispatches` shows `ingress→libp2p forward … to 6yz95okd7tjBHWkVAAdZ`, which is the hub peer.
  - The spoke transport has not restarted since 09-22 18:07.
  - The spoke journal at 04:22:39 shows only `ingress→libp2p forward llmQuotaState to 6yz95…`. There is no error line: `grep -c "ingress proxy failed"` over 24h returns 0 on the surface, and there are no NO_RESERVATION lines on the inventory.
  - So the path went down and came back within about 1h, and the transport logged neither event. `egressNoReservationCount` is blind to the ingress path, as `raw/syzygy.md` §5 already found.
  - This matches the recurrence chain in the class history: `c68b54b` (07-11), `a67706571f` (07-24), `494a990e` (07-25), `cfad41db` ("root fix", 07-31), `3dbbbeff` (09-14, "the phantom watchdog was manufacturing the outage"), `e1c06f60` (09-22 "joined means a live reservation"), then the 09-29 recurrence.
  - This is the same issue recurring for the same reason. The reason is that nothing measures reachability of the target through the relay from the caller's side. The 1h window fits the "unobservable 1h ttl" named in `c68b54b`, but the hub side was not inspected, so that is a hypothesis and not attributed.
- **The #1 oracle is "live-used", but only on node 2, and it has not changed its answer.**
  - The node-2 pool holds 18 `federationVerificationReport` items, all saying `blocking_reason: no_relay_anchor` with coverage 0.647 (`raw/federation-relay.md`). I recounted the 18 today.
  - On node 1 the shapes are unregistered. From `raw/live-activities.md:47`: `VesselResolver(federation_verification_report): fetch failed` ×159, `not registered` ×94, and `federation_probe` ×70 plus ×56.
  - The node-2 walks also produce `HOLLOW-CONTENT vessel_health_report` for `federation-transport-vessel@spoke-66684ac4` (journal 00:38, 00:42, 03:49, 03:51 on 09-29).
- **Nobody runs `sidecar.ts`.** The only hit for `libp2p-federation-sidecar` or `…/src/sidecar` in any unit, `/usr/local/bin` or scripts tree on any of the three containers is the package's own `package.json` `bin` entry.
- **The running code is the image copy, not the clone.**
  - On node 2, the unit's `ExecStartPre` copies `/vessels/libp2p-federation-transport/src/.` (the image layer) into `federation-relay/node_modules/@avigopal/libp2p-federation-transport/src/`.
  - `index.ts` hashes to `780acf97b80b` in the image, `node_modules` and the node-1 clone (HEAD `542e712`). They agree today.
  - **Node 2 has no clone** of the submodule: it is uninitialised (`raw/node2-runtime.md:109`). So on the one production node where the primitive runs, the substrate cannot author it.

## Verdicts

### M1: libp2p primitive (`repos/libp2p-federation-transport/src/index.ts`), including `sendAll` chunking and forced re-reservation

**Verdict:** keep-general. **Used now:** yes, on node 2 (direct-only) and on the syzygy island (relay).

**Evidence:**
- `package.json` sets `"exports": {".": "./src/index.ts"}`.
- It is imported by name `@avigopal/libp2p-federation-transport` in all five federation-relay scripts:
  - `federation-transport-server.ts:11`
  - `federation-probe-tick.ts:36`
  - `fed-federated-resolve.ts:6`
  - `fed-resolve-client.ts:4`
  - `obsidian-passthrough.ts:20`
- `obsidian-vessel/sidecar/package.json:11` also depends on it (via a GitHub URL).
- `sendAll` (`index.ts:87-90`) came from `7f2b6c9` (07-07). It fixed the "≥1KB payloads failed" truncation, and the class history rates that "worked".
- Forced TTL re-reservation (`index.ts:218, 290-304`, `reReserveAtTtlFraction` default 0.5) came from `c68b54b` (07-11). Its class outcome is "worked", but the reservation-liveness class it belongs to recurred on 09-29 (see M2), so its sufficiency is not proven.
- Syzygy forwards are live today, with 15 and 9 `forward` lines per 2h on the surface and the inventory.

**Why keep:** this is the only p2p seam. Under the decentralization rule ("everything reachable over p2p") it is load-bearing. It is a thin primitive, which is how resolvers should be.

**Availability:** it is a shared library resolved by package name, not a registry shape. That is appropriate for a transport. To make it authorable where it runs:
- initialise the submodule on node 2, or have pull-sync populate `/workspace/git/vessels/libp2p-federation-transport` there;
- stop relying on the `ExecStartPre` image-layer copy, a hand repair that `79cfbe9a` / `render-unit.sh` institutionalised on 08-19.

Class history also records the "22 vessels import it" claim being wrong in the 09-12 spec. The importer list is the one above.

### M2: federation-transport-vessel reservation + ingress→libp2p forward (`scripts/substrate/federation-relay/federation-transport-server.ts`, 1,412 lines)

**Verdict:** keep-general. The reservation-liveness seam inside it is **broken, intermittently and silently**. **Used now:** yes, on syzygy and on node 2. Node 1 has it `disabled` and `inactive`.

**Evidence:**
- The 04:22 failure and 05:22 recovery above, with the failure unlogged.
- `/health` still reports `activeReservations:1, phantomSuspected:false` on both spokes. `phantomSuspected` (`:657`) is `held===0 && circuit`, which measures only the spoke's own reservation and never the target's.
- Node 2 `/health`: `activeReservations:0, connections:[], libp2p_multiaddr:""`. It logs `no relay anchor (direct-only)` every tick. Its `register -> 201` appears every 2 min.
- Node 1: `systemctl is-enabled` is `disabled`. `federation-relay` is inactive and has no unit.
- History: about 10 "fix" commits in the reservation/phantom class between 07-11 and 09-22 (listed above). `abf60661` silently reverted `ea5882bd`. `6ec65736` was reverted by `0a535483`.

**What would stop the recurrence:**
- **A caller-side reach counter on the ingress path.** Today's failure increments no counter. When a hub-only read fails, the transport should emit a shaped impulse or file a gap keyed `fed:target_unreachable_via_relay`.
- **A foreign-vantage probe (M4)** that exercises a hub-only shape through the relay, rather than trusting the spoke's own reservation.

Adding another watchdog is not the fix: `3dbbbeff` showed a watchdog manufacturing the outage.

**Availability:** it lives in the scripts tier, where the substrate cannot author it (class attempt "Point-and-go /bootstrap join", docs-2). The general part should move into `repos/libp2p-federation-transport` as the package's transport server, so edit-intent goals can reach it. Every vessel already discovers it as the `federation-transport-vessel@<spoke>` row.

### M3: standalone ingress sidecar with phantom-reservation redial (`repos/libp2p-federation-transport/src/sidecar.ts`, bin `libp2p-federation-sidecar`)

**Verdict:** duplicate-of M2 (the ingress, owner-merge and phantom watchdog in `federation-transport-server.ts`). **Used now:** no.

**Evidence:**
- No unit or script on node 1, node 2 or syzygy invokes it. The only reference is its own `package.json` `bin` entry.
- Its phantom-strike redial (`:83, :148-162`, "reservation claims valid but no circuit peers for 2 ticks") is the same logic that transport-server grew and that `3dbbbeff` (09-14) found harmful: 14 redials in 3h against a healthy reservation.
- As the collector notes, it logs only and emits no gap signal.
- `raw/federation-relay.md:99` records a third copy of the same ingress/owner-merge logic in `repos/obsidian-vessel/sidecar/federation-sidecar.ts` (711 lines). That makes three implementations of one mechanism.

**Disposition:**
- Stop shipping it as a runnable `bin`.
- Keep the file only as history, under `repos/libp2p-federation-transport/archive/sidecar.ts`, with a pointer to M2.
- Once M2's server is moved into the package, collapse the obsidian sidecar's owner-merge logic onto M2's server as well.

### M4: federation verification oracle (`federation-probe-tick.ts`, 1,451 lines → `federation_probe` / `federation_verification_report`, rhythm `rhythm-federation-verification`)

**Verdict:** keep-general. It is the only cross-substrate reach detector. It needs re-vantaging. **Used now:** yes, on node 2 only.

**Evidence:**
- Node 2 has 18 identical sweeps from 09-26 07:16 to 09-29 03:46, all reading coverage 0.647, `no_relay_anchor`, and `degraded(controls_inert:NC4)`.
- I5 and I9 are `undecidable` on "no valid addresses for peer 12D3KooWNw7…", which is node 2's own transport. They should fail instead.
- `I1_foreign_vantage_reachable` passes with `witness_scope "same-network-namespace … NOT off-host"`.
- On node 1 it is unreachable: 159 fetch-failed and 94 not-registered executions.
- It closed 4 `fed:` classes by measurement between 09-18 and 09-25 (class history: `punchthrough_unavailable`, `stale_foreign_rows_advertised`, `relay_dial_failed`, `registry_lost_local_rows`). That makes it a real closer.
- It also had about 25 self-defect fixes from 09-11 to 09-15 (`a0c702bb`…`1ad7bacd`), including "a negative control that could not fail" and "oracle deleted by the workspace it measures".
- It did **not** see today's syzygy outage, because it does not run there.
- Repeating the same report 18 times without escalating or changing disposition is the "detected-never-repaired" pattern.

**Availability:**
- Register the shape where the caller is. Node 1's walk selects it and fails (`not registered`), so either run the transport on node 1, or let discovery route node 1's `federation_verification_report` to node 2's row over the overlay.
- Run the probe from a foreign vantage: node 1 probing node 2, and a syzygy spoke probing the droplet hub through a hub-only shape.
- Alias the 17 invented `gap-federation-*` target names to this shape as concept aliases (`raw/federation-relay.md:107`, `:166`), rather than closing them one by one.

### M5: compiled `.js/.d.ts/.map` build output committed next to the `.ts`

**Verdict:** fossil. **Used now:** no.

**Evidence:**
- `repos/libp2p-federation-transport`: `542e712` (09-19, Substrate Autonomous "vessel-code-commit-and-push") added 12 files and 697 lines: `src/index.{js,d.ts,*.map}`, `src/sidecar.*` and `federation-hub-e2e.*`.
- `package.json` `main`, `types` and `exports` all point at `./src/index.ts`, and the `bin` points at `sidecar.ts`, so nothing resolves the `.js`.
- Super-repo: 24 tracked `.js/.d.ts/.map` files in `scripts/substrate/federation-relay/`, from drift commits `4e4170a8` (09-07) and `796fac89` (09-19). Every unit `ExecStart` runs `bun …/federation-transport-server.ts`.
- These are residue of the autonomous "vessel code drift detected and committed" sweep, which commits whatever `tsc` leaves behind.

**Archive:** no archive is needed because the files are regenerable. Delete them in one commit per repo and add `*.js`, `*.d.ts` and `*.map` to `.gitignore` under those two directories.

The class-level fix belongs in the drift-commit activity: it should refuse build artefacts whose source sibling exists. Without that, the sweep will re-add them. That refusal is the "what detects the class without me" answer (law 6).

## Cross-cutting note on the class

`federation-p2p` has at least 8 "fixed" or "root fix" claims on the reservation and circuit liveness seam. Each was graded from the spoke's own state (`/health` counters, `register -> 201`, the `e1c06f60` "joined" predicate). Today's recurrence came and went with no log line and no counter change.

The mechanism to keep is **M1 plus M2 plus M4, re-vantaged**. The missing piece is not another watchdog. It is a caller-side measurement of target reachability through the relay that turns into a gap, together with authorability: the primitive has no clone on node 2, and the server lives in the scripts tier.
