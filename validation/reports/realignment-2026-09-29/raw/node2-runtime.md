# Node 2 (compose2-live) runtime — realignment raw notes

Source shard: `node2-runtime`. Read-only survey taken 2026-09-29 ~03:40–04:30 UTC.
Container `compose2-live`: image `localhost/substrate:compose-ownership` (locally built 09-25 14:58 UTC,
`/etc/substrate/image-revision` = `unknown`; node 1 runs `ghcr.io/avigopal/substrate:dev`), created 09-26 09:57 UTC,
env `PROFILE=compute`, `SUBSTRATE_NAME=compose2`, `SUBSTRATE_PORT_PREFIX=26`, `HUB_DISCOVERY_URL=host.containers.internal:18100`.
Volumes: `compose2-workspace -> /workspace`, `compose2-surreal -> /var/lib/surrealdb` (surrealdb itself masked).

Method notes: journals counted with sed-normalised `uniq -c`; secrets never printed; env shown as host:port only.

---

## 1. Unit inventory

### 1.1 Running vessels (active)
analysis-vessel, boredom-vessel (daemon; unit `disabled` but running since 09-28 15:51), development-vessel,
discovery-vessel, federation-transport-vessel, goal-host-vessel, human-surface-vessel, light-dispatch-vessel,
llm-resolver-vessel (+ container-layer units llm-opus / llm-haiku / llm-google rendered from llm-arms.json),
local-tools-vessel. `federation-relay.service` = **not-found** (also MainPID=0 on node 1 per rhythm-change-state).

### 1.2 Masked (profile + hand)
Masked 09-26 13:05 (profile/apply-inventory, compute = DB-less): activity-api, concept-db, identity-vessel,
surrealdb, ribosome-vessel, relevance-sink-vessel, stateful-ui-vessel, bootstrap-seeder, all obsidian-*,
funnel-drain, operator-goal-generator, compose-teacher, db-maintenance, trace-store-health-check, m1-trainer,
self-recovery, runtime-drift, … (102 masked unit files total).

**Masked by hand 09-28 05:56 (symlinks in container-layer `/etc/systemd/system`, not image):**
`compose-drift`, `joint-liveness`, `learning-loop-selftest`, `validator-liveness` (.service + .timer). They remain
`failed` in `systemctl --failed`.

Evidence of the failures before the mask:
- compose-drift (6-hourly, 09-27 04:38 → 09-28 04:39): every run `[compose-drift] failed: Unable to connect`.
- validator-liveness (6-hourly): every run `Unable to connect`.
- joint-liveness (30-min): `fatal: TypeError: Unable to connect … at sql (joint-liveness-tick.ts:53)` — SURREALDB_URL on node 2 is `127.0.0.1:8000`, surrealdb masked.
- learning-loop-selftest (6-hourly, first run 09-27 04:43): `Module not found "/workspace/git/super-repo/scripts/substrate/learning-loop-selftest-tick.ts"` — **never ran successfully once on node 2.**

Chain (per WHY-THINGS-KEEP-BREAKING-2026-09-28 line 45 + pull-sync journal): pull-sync's unit convergence
**auto-enabled** these timers on the DB-less node on 09-26 12:56Z ("units: ENABLED validator-liveness.timer — it was
converged but disabled, so it had never fired"; same for rhythm-cadence). The 09-28 hand-mask is an instance patch:
the enabler in pull-sync is still live, and the masks, like the dev-vessel drop-in below, live in the container layer
and die on recreate. Node 2 is **not reproducible from image + env + volumes** (law 11 violation):
- `/etc/systemd/system/development-vessel.service.d/*`: "decentralized-compose-ownership 4.5(c) — operator claude-compose-ownership (2026-09-26). Boot-transient (recreate drops it)." sets `VESSEL_ID=development-vessel-compose2`, `VESSEL_ADVERTISE_ENDPOINT=host.containers.internal:26090`.
- The image is a local build, not the published dev image.

### 1.3 Timers and whether they fire
| timer | cadence | fires? | what it actually does |
|---|---|---|---|
| substrate-pull-sync | ~11 min | yes | converges super-repo + vessels; see §3 |
| gap-compose | 20 min | yes | **only action ever logged: `watchdog_restart`** (36 on node 2; 1417 on node 1 since 09-25), all `ok:true http:200`, `stalled_min` still climbs (node 1: 210→230 across 03:58–04:19; node 2 open_intents 65, stalled 22–61 min, six restarts in 4 min at 01:35–01:39). Acts without effect. |
| gap-store-census | hourly | yes | reads hub store through dev-vessel (6278 gaps, HWM 6273, OK) |
| rhythm-cadence | 15 min | yes | 68× "registry already holds 12 rhythm(s)"; 56× "nothing enqueued and nothing recorded as skipped … conductor does not report a per-family reason"; occasional enqueue of federation-verification/validation; `concept-management: no_goal_mapping` |
| boredom-vessel.timer | — | last 09-28 15:51, no NEXT | unused: boredom runs as daemon |
| compose-drift / joint-liveness / validator-liveness / learning-loop-selftest | — | masked | see 1.2 |

---

## 2. Journals — top patterns (last 24 h unless noted)

### development-vessel (113 process starts since 09-26 ≈ 38/day)
Restarts are mitosis cutovers: `/workspace/restart-requests/development-vessel.json` = `{"requester":"mitosis-cutover","reason":"cutover development-vessel-fc-2026-09-29T01-36-37-170Z", …}`.
- 868 + 316 + 82 + 60 … `[concept-bridge] usage record failed for <shape>: Unable to connect` — `CONCEPT_DB_ENDPOINT` unset on node 2 → default `http://127.0.0.1:8260` (config.ts:41); concept-db masked.
- 115 `[compose-lessons] concept-db mirror failed: Unable to connect` while `[compose-lessons] source=concept-db n=8 class=…` succeeds (70+45+13+7+3). **Lessons flow in; nothing node 2 learns flows out** (write-read-mismatch at node grain).
- 319 `backoff excluded 1 of 1 gaps`; 267 `lineage cap excluded N recommit gap(s) (lineage failed_attempts >= 6)`; 119 `compose lane full live=1 cap=1`; 73 `spend envelope exhausted: spent 2.x USD of 2 USD/h over 2 spend source(s)`.
- 117 `emitted narrowed child gap for chronically-stuck gap trace-store-reconcile-2026-09-24T11 → …-narrowed` (node 1 logs the same emission 178×/24 h — **both nodes re-emit the same child every pass**).
- 58 + 31 `[gap-decompose] trace-store-reconcile-… no valid step: step 1: repos/vessel/src/trace-store-reconcile.ts does not exist` — placeholder path `repos/vessel/…` invented by the decomposer; the gap has `classification_metadata.edit_site = null` on the hub.
- 85 `no existing edit targets found for gap db_performance_slow_queries_… — composer will scaffold new file`.
- 82 `REFUSING long-running request during drain` (cutover drain).
- 2873 (since 09-26) `[gap-escalation] pending-verify uiQuestion_write THREW … Unable to connect` — `resolveUiWritePassthrough` posts to `STATEFUL_UI_ENDPOINT` (default local :8270), stateful-ui-vessel masked on node 2. **Every needs-human escalation raised on node 2 is lost.**
- `[gap-verify] class2 check for failing-test-concept-db-… abstained on this node: the gap store is held elsewhere, so its sweep measures it` — node 2 lands but cannot verify.
- Latest admission (03:xx–04:xx): `863 candidates → 0 admitted {"not owned here":129,"needs_information":436,"autonomy_scope":271,"operator_hold":24,"no_groundable_target":3}`.
- `[fc-coverage] TARGET HAS NO TEST FILE` for self-fact-reconcile.ts (26), composer-interruption-sweep.ts (24), discovery-registration.ts (15).
- `[gap-sweep] … NOT closed: landed sha c4bb14df2ff2 was REVERTED` (20), `… e059a98d7b16 was REVERTED` (20).

Node 2 landings (reflog, `/workspace/git/vessels/*`): development-vessel 98 commit entries, goal-host 15, activity-api 10; nearly all `substrate-authored: apply route-edit-<hash>-compose-report via mitosis cutover` (+ self-fact-divergence, goal-target-inference, resolve-url-walk-path-sites, recommit-route-edit-…-semantic_reject).

### goal-host-vessel
- 2686 (since 09-26 12:06 boot, through 04:24 today) `[walk-concepts] recall SKIPPED — discovery named no concept-db row (neither a local http row nor a libp2p peer row)` + 119 `concept-db could not be asked`. **Node 2 walks have never had concept recall.**
- 1194 (all-time) `Failed to resolve SHA for goal '…': 401 Unauthorized` (goal-host → `${discoveryEndpoint}/resolve`); discovery-vessel logs 6844 `rejected: identity rejected the key (HTTP 401) (identity=host.containers.internal:18101)` since 09-26 12:22; hourly 24–208 → load-correlated, **unattributed** (no positive control run).
- **1036/24 h `refusing pinned target development-vessel:scaffold-and-publish-vessel: learned posterior is decisively negative (alpha=5.59 beta=7823.77 rate=7.13e-4 over 7829 observations)`**, every hour 09-28 04h → 09-29 03h. The pinner is **unattributed**: boredom-vessel carries `vesselAdditionScaffoldDispatch`, but boredom/dev-vessel/light-dispatch journals on node 2 have zero dispatch lines naming it; CHECKINS 09-26 10:00 already RETRACTED a boredom attribution ("the pinned sender stays unattributed until goal-host origin logging lands"). Three days on, still unattributed — the refusal works, the caller keeps burning calls.
- 241 `walk rawResolve goal_execution: HTTP 4xx {"error":"goal or target_template_id is required"}`; 63 `light_dispatch_execution … template_id required` (callers binding the wrong payload).
- 211 `floor: walkBudget resolve failed (HTTP 404) — FALLING BACK to literal budget iters=4 calls=8` (walk budget shape has no producer on node 2).
- 117 + 51 `SPEND-RATE REFUSED at handler entry … 6 dispatches of goal <hash> in the last N s (per_hash_max 6)`.
- 44 + 28 `RECURSION REFUSED goalHash=… already being walked through /resolve`.
- 30 `HOLLOW-CONTENT federation_verification_report` (produced by `federation-transport-vessel@spoke-66684ac4`).
- 26 `satisfier REFUSED filesystem-write shapes ["fs_edit"]`.
- 63 `reached-command cache: EVICTED 0ee…d0 (reach graded false: no reason recorded)`.

### boredom-vessel
`[gap-goal-supply] candidates=5 raw_gaps=N admitted=99/98`; cold-start picks of `detect-unclassified_failure_*` templates (ucb=cold picks=0) — dozens of one-off detector templates each picked with no posterior; `[pool-ws] closed, reconnecting` 11.

### local-tools-vessel
**2545 / 2545 shell requests in 24 h `WITHOUT execution_id`** — every local-tools shell call is untraced, including the mitosis staging writes `mkdir -p "/vessels/development-vessel/src/resolvers" && cp "/workspace/git/compose/fc-…"` (≈60/24 h) and the `git -C /workspace/git/vessels/<v> fetch origin dev` probes. The landing's file copy runs outside the trace.

### discovery-vessel / federation-transport
- discovery `/health`: `registeredVessels: 8` (analysis, development-vessel-compose2, federation-transport@spoke-66684ac4, goal-host, human-surface, light-dispatch, llm-resolver, local-tools per vessel-arrival-snapshot). No concept-db, no activity-api, no identity row.
- federation-transport: 144 `[federation] no relay anchor (direct-only) — remote visibility suspended (hub mirror skipped …)`. `federation-relay.service` not-found on node 2 and MainPID=0 on node 1. `fed:no_relay_anchor` and `fed:join_door_host_dependent` sit in node 2's fossil local gap store.
- Direct probe of `127.0.0.1:8100/vessels` with `ApiKey` auth → `404 Not Found` (registry contents not enumerated — coverage hole).

---

## 3. pull-sync on node 2

- 241 ticks with `failed=1` from 09-26 12:56 to 09-28 08:00. Causes: `cpg-inference-ts: BUILD FAILED -- keeping live dist` (42; build exit 127) and `src converged but dist stale (last-good != 19f24a5ae3) — re-running fan-out` **174 times over ~43 h** (a retry loop that re-ran the same failing build each tick). Ended 08:11 after `31f15baf fix(pull-sync): build declarations-only shared packages with their own build script` (+ `4bb21141` per CHECKINS). Confirmed: last BUILD FAILED 08:00:08, last "dist stale" 08:11:15.
- 09-28 07:27: `super-repo: ff-only pull FAILED — glue layer stays at 6f329e2e while origin is 31f15bafdf; … local changes … would be overwritten: scripts/substrate/substrate-pull-sync.sh, state/learning-mode-state.json` — **a hand-staged copy of the pull-sync fix wedged the pull that carried it** (directed-overshoot; rhymes with the 09-24 staged-base-sha deadlock). `state/` has since been gitignored (`.gitignore:243:/state/`).
- 3225 `parse error: Invalid numeric literal at line 1, column 8` (jq) — 0 in the last hour; co-terminous with the cpg loop, cause not attributed.
- 2026-09-26 12:55: `goal-host-vessel: !!! TEST GATE SKIPPED — per-tick budget 420s exhausted (560s elapsed); converging UNGATED`; `TEST GATE BLIND — no test runner available`; same for ias-executor-ts; `stateful-ui-vessel: TEST GATE BLIND — suite produced no countable result … converging ungated` (09-28 10:10).
- **Today every tick says `done — synced=0|1 skipped=0 failed=0` while:**
  - `scripts/substrate/learning-loop-selftest-tick.ts` is **deleted in the worktree** (463 lines; `.js/.d.ts` compiled residue still present 09-25 11:55). MECHANISM-AUDIT-2026-09-28 said "script missing from node 2's super-repo clone (clone behind, at ce1e4c5d)". The clone is now at HEAD `9c967329` and the file is still absent: the diagnosis named the wrong cause and the failure survived "the fix". Deleter unknown (before 09-27 04:43).
  - 14 submodules are **uninitialized** (`-` in `git submodule status`: analysis, boredom, concept-db, cpg, discovery, identity, libp2p, light-dispatch, llm-resolver, local-tools, metric-collector, obsidian, ribosome, stateful-ui); the log calls them "submodule worktrees left at old pointers (uncommitted work — NOT discarded)" — wrong description (empty dirs, not uncommitted work). `repos/development-vessel` in the super-repo sits at 2de0ae8 while the live clone is f451e42; `git -C repos/boredom-vessel` resolves to the super-repo root (9c967329).
  - Worktree also modified: `Substrate/Projects/*` (5 tracked test-project files rewritten at runtime), `leases/maintenance-autonomous_pick.json` (deleted), `leases/maintenance-trace_store.json` (tracked leases = runtime state in git), `scripts/substrate/vessels.inventory.json` (see §5).
  - **Converged HEAD ≠ tree matches HEAD.** pull-sync's green line is a false verification of tree state.
- Runtime source equality: for development-vessel, goal-host, boredom, activity-api, local-tools the md5 of runtime `src/*.ts` equals the clone on both nodes, and both nodes' clones = origin/dev. But `.last-good` markers disagree with running code: node 2 dev-vessel last-good 9c86aff (running f451e42), goal-host 5ca51be (running bc99f91), activity-api d98309e (running 39783b0); node 1 boredom 84cd2f2 (running 12bb26a), local-tools 6b0d86a (running 85b4c01). The rollback anchor is stale on both nodes.
- Leftover mitosis runtime dirs: `/vessels/*mitosis*` 4 on node 2, 11 on node 1 (e.g. `/vessels/development-vessel-mitosis-2026-09-28T13-00-10-710Z/`) — grep hits for runtime code land in them.

---

## 4. Node-local stores: what node 2 believes vs node 1

All of these are local JSON files at `/workspace/...` with a path constant `process.env[X] ?? "/workspace/…"` (env-gated path, law 1) — per-node **forks**, not replicas:

| store (writer) | node 1 | node 2 |
|---|---|---|
| `gap-class-posteriors.json` (gap-to-feature.ts:2775 `GAP_CLASS_POSTERIOR_PATH`) | route-edit α2 β198; recommit:route-edit α1 β75; … (updated 00:28) | route-edit α2 β42; recommit:route-edit α1 β14; **human α3 β73**; self-fact-divergence α8 β36; goal-target-inference α1 β15 (03:56) |
| `close-oracle-calibration.json` (:2845 `CLOSE_ORACLE_CALIB_PATH`) | landed_commit 0 closes / **2149 false_closes**; measured 237/0 | landed_commit 0/31; measured 9/0 |
| `expectation-calibration.json` (:2745 `EXPECTATION_CALIB_PATH`; also escalation-disposition-apply) | missing_capability 1064/54, systematic_failure 1211/61, orphaned_capability 345/0 … | **trace_store_reconciliation 400 attempts / 0 lands**, self_knowledge 25/0, reachability 24/1, edit_intent_route 21/0 … (last write 09-28 17:25) |
| `.goal-host-failure-memory.jsonl` (goal-host index.ts:3904) | 1772 lines | 277 |
| `.goal-host-reached-commands.jsonl` (:3827) | 10624 | 451 |
| `boredom-momentum.json` | 4 keys | 4 keys |
| `state/boredom-selector-state.json` | sampled_templates 5, **distinct_means 1, variance 0** (all at prior 0.2) | sampled 37, distinct_means 3, variance 0.0051 |
| `super-repo/memory/notes.json` (memory-note.ts `WORKSPACE_ROOT/memory/notes.json`) | **59 notes** (46 dated 09-26, 13 later); `.bak` files hold 1788 notes (09-22/23) that nothing reads | **3 notes** (expectation-scan-heartbeat, 2× projectThreadScanReport, all 09-26) |
| `super-repo/gaps/gaps.json` | 10.5 MB live store + 4 orphaned `.tmp` (1.9–7.9 MB, 09-20..09-25) | **70-entry fossil frozen 09-26 12:07** containing test residue (`some-real-gap`, `dupe-…`, `class-b-…`, `contract-conformance-probe`, `flat-{summary,detail,description,text,title}-probe`, `placeholder-scrub-probe`, `heal-probe`, `gap-001`, `post-mutation-probe`, `compose-trigger-guard-on/off-probe`) — unread because dev-vessel env has `GAP_STORE_ENDPOINT=host.containers.internal:18090/v2/impulses/resolve` (hub), but it is still on disk as a decoy |
| `/tmp/probe-ws/gaps/gaps.json` | — | 9.5 MB copy of a gap store (09-27 09:14) left by a probe |
| `state/learning-mode-state.json` | `/workspace/state/…` stale since 07-29 (fossil) + super-repo `state/…` live | super-repo copy only; both nodes identical content ("frontier(6 …) top=promotedConcept") |
| `push-policy.json` | set_by "unattributed" 09-24 | set_by "bootstrap" 09-25 |

Consequences:
- The gap posteriors and expectation-calibration that seal/unseal admission are **per node**. "node 2 pool unsealed 2 -> 59 via holder-held calibration (76bf256, 094c230)" (09-28 18:30) and "node 2 admits 7 verifiable gaps" (09-28 23:40) → at 04:xx on 09-29 node 2 admits **0 of 863**. Node 2's calibration still records trace_store_reconciliation 400/0 (the seal described at CHECKINS 09-27 10:58).
- Close-oracle calibration diverges by two orders of magnitude between nodes (2149 vs 31 false closes for `landed_commit`); a gap's close credibility depends on which node judged it.
- Goal-host failure memory ("a loop that stores only successes cannot compound on failure", 09-22 fix) is per node: a failure remembered on node 1 is unknown to node 2 and vice versa.
- Spend envelope: now read cross-node — gap-to-feature.ts:4084 sums `spendEnvelope` across every poolImpulse producer discovery lists ("a record written on either node binds both"); a general fix at the shared seam (after CHECKINS 09-27 08:56 "mirrored into node 2's own pool … readers fail open when the node holding the record is missing from discovery"). The two records were not diffed in this pass.

---

## 5. Inventory corruption both copies agree on

`/workspace/substrate/fleet/vessels.inventory.json` on node 2 (mtime 09-27 23:03) and the super-repo
`scripts/substrate/vessels.inventory.json` (worktree-modified 09-28 20:24, 133 bytes vs 19101 in HEAD) both contain
**one entry**: `{"repo":"obsidian-vessel","unit":"obsidian-vessel.service","manifest":false}`. Node 1: fleet 45, source 97.
Writer unknown (no source file under scripts/ or repos/*/src contains that literal).
`self-fact-reconcile.fleet_inventory_copy` compares exactly these two files for divergence — both are truncated
identically, so the check reports agreement: a reconcile check that compares two copies is blind to shared corruption.
pull-sync falls back to "every clone dir, unit <v>.service" when the inventory misses a vessel, so it degrades silently.

---

## 6. Test residue in live state (numbers)

- `/workspace/db-backups`: **391/391 files on node 2** (65 on 09-26, 82 on 09-27, 233 on 09-28, 11 on 09-29) and **1766/1769 on node 1** (since 09-06) are `affected_count:7, rows:[{c:7}]` fixture writes from `repos/activity-api/src/routes/db-admin-repair.test.ts` via `db-admin-repair.ts:408` (`/workspace/db-backups/${stamp}-${operation}-${pattern}.json`). The test's own header admits the stubbed ctx "dies on ENOENT first" — true on a dev box, false on a substrate box where the dir exists, so every suite run writes fake "pre-mutation backups". Node 2 has no DB at all yet holds 391 DB-repair backups.
- `/tmp`: 50,766 entries on node 2 (1.4 GB; 10,244 `apply-proposal-test-*`, 3,907 `mitosis*`, 789 each of `dev-vessel-test/fs-write/fs-list/fs-edit/dispatch/code/applied` ≈ 260 dev-vessel suite runs/day, 726 `dev-vessel-host-container-drift`, 715 `mp-bad`); node 1 46,159 entries, 4.8 GB.
- `Substrate/Projects/`: 68 tracked test-project files in the super-repo (`NewProjectWithOpenTodo.md`, `dummy_project.json`, …) rewritten at runtime by project-intake; node 1 has 11 more untracked ones plus stray root files (`fixed-census-report.ts`, `generated-goal.json`, `imports.txt`, `known-answer.txt`, `known_answer.txt`, `leases/maintenance.json`).
- node 2 fossil gaps.json probe rows (§4).
- Codebase residue: 48 tracked `.js` build outputs under `scripts/substrate/` (42 `.js` present in node 2 tree); boredom-vessel tracks 6 `.js` under `src/`; `.d.ts`/`.js.map` next to every tick script.

---

## 7. Node-locality issue list (node 2 vs hub)

1. DB watchdogs scheduled on a DB-less node (auto-enabled by pull-sync; hand-masked; enabler live).
2. `CONCEPT_DB_ENDPOINT` default `127.0.0.1:8260` on a node without concept-db → ~1300 usage records/24 h and 115 lesson mirrors lost; recall reads succeed via another path.
3. goal-host concept recall: discovery has no concept-db row on node 2; federation "no relay anchor" suspends hub mirror → 2686 skipped recalls since boot.
4. `STATEFUL_UI_ENDPOINT` default local :8270 → 2873 lost escalations (node 2 owns gaps whose needs-human questions never reach any surface; the 09-27 10:58 human-resolver intervention only touched node-1-raised panels).
5. Identity: node 2 keys rejected by hub identity 6844× (unattributed, load-correlated).
6. Gap verification abstains on node 2 ("gap store is held elsewhere") → the node that lands cannot verify.
7. Per-node calibration/posterior/failure-memory/memory forks (§4).
8. Container-layer config (drop-in, masks, local image) — node 2 not reproducible.
9. Both nodes run gap-compose watchdogs and both emit the same `-narrowed` child every pass.
10. `walkBudget` shape has no producer on node 2 → literal-budget fallback 211×/24 h.
11. Node-local `.last-good` anchors disagree with running code.
12. Node 2's fossil gaps.json and `/tmp/probe-ws` store — decoys for any reader that trusts a path over the vessel env (the census script's own docstring warns about exactly this: "several stale gaps.json copies exist on the box").

---

## 8. Claims vs later evidence

| when | claim | where | later |
|---|---|---|---|
| 09-26 14:54 | "routed landing works end to end (node 1 → ownership → node 2)" | CHECKINS | still true in mechanism: node 2 reflog shows 98 dev-vessel landings; but verification abstains on node 2 and escalations are lost |
| 09-26 23:00 / 09-27 06:05 | "node 2 resolver ≈ 0 spend" | CHECKINS | corrected 06:15 same day: node 2 $2.78 / 649 calls |
| 09-27 08:56 | node 2 reopened after scope/envelope mirroring | CHECKINS, 5ac90e4a | envelope reader later generalised to read every pool producer (gap-to-feature.ts:4084) — general fix |
| 09-27 22:11 | "hub watchdogs healthy; node 2 is profile mismatch + cpg build failure" | debc3da3, MECHANISM-AUDIT | cpg fixed 09-28 08:11 (confirmed); profile mismatch "fixed" by hand-mask 09-28 05:56 only; learning-loop-selftest cause misdiagnosed as "clone behind" — file still deleted at HEAD |
| 09-28 00:19 | pull-sync fix 31f15baf | git | wedged its own delivery at 07:27 (locally modified pull-sync.sh); effective 08:11 |
| 09-28 08:31 | "node 2 pull-sync failed=0 … first clean ticks since 09-26" | CHECKINS | true for the counter; false for tree state (deleted script, 14 uninitialized submodules, truncated inventory) |
| 09-28 16:00 | "node 2 gap-compose restored" | 3b0ca6d9 | gap-compose on node 2 logs only watchdog_restart (36), no compose actions |
| 09-28 18:30 | "node 2 pool unsealed 2 -> 59 via holder-held calibration (76bf256, 094c230)" | a50d1196 | 09-29 04:xx: 0 of 863 admitted |
| 09-28 23:40 | "node 2 admits 7 verifiable gaps under class1/class2" | 7c1ffc8e | 0 of 863 a few hours later |
| 09-26 10:00 | boredom attribution of the scaffold pin RETRACTED | CHECKINS | still unattributed 09-29; 1036 refusals/24 h |
| 09-22 | "248 escalations asked of a vessel no human reads" (memory index) | memory | on node 2 the same channel now throws before reaching any vessel (2873) — same class, worse hat |
| 09-28 | "POST-LAND SUITE DEAD … fixed 5e9a0b2" | memory | node 2 dev-vessel HEAD contains 5e9a0b2 (verified ancestor) |

---

## 9. Mechanisms seen from node 2

- **pull-sync (substrate-pull-sync.sh)** — general, live-used; its success line does not verify tree state; unit auto-enable is profile-blind.
- **gap-compose watchdog (gap-compose-tick.ts)** — live but acts without effect (1417 + 36 restarts, stall persists); the stall is admission starvation, not a hung process.
- **gap-store-census** — live, works via dev-vessel resolve (hub store).
- **rhythm-cadence conductor** — live, mostly idle; no per-family skip reason.
- **mitosis cutover landing** — live-used on node 2 (98 dev-vessel landings); leaves `/vessels/*mitosis*` dirs; its file copies are untraced local-tools calls.
- **decentralized compose ownership** (openspec `decentralized-compose-ownership`) — live-used ("owner":"compose2" picks 93/24 h; "not owned here" 129 exclusions); config lives in a boot-transient drop-in.
- **cross-node spend envelope** (gap-to-feature.ts:4084) — general shared-seam fix, live-used.
- **per-node calibration files** (gap-class-posteriors, close-oracle, expectation-calibration) — live-used but node-forked.
- **goal-host failure memory / reached-command cache** — live-used, node-forked.
- **self-fact-reconcile fleet_inventory_copy** — live, blind to shared corruption.
- **joint-liveness / validator-liveness / compose-drift / learning-loop-selftest** — hub-only by nature; on node 2 broken then masked.
- **concept-bridge observer** — broken on node 2 (default local endpoint).
- **needs-human escalation (resolveUiWritePassthrough)** — broken on node 2 (default local :8270).
- **db-admin-repair backup rail** — live code; its test pollutes /workspace/db-backups on both nodes.
- **federation relay** — absent (unit not-found on node 2, MainPID=0 on node 1).
