# Dossier: sync-deploy-drift

**Class in one line:** code that has landed is not what runs, and what runs is not what landed. Every artefact exists in several copies, and nothing checks, for each reader, that the copy it reads equals the authoritative one or treats a difference as a failure. Every fix so far has covered one pair of copies or one artefact type.

Sources: `classes/sync-deploy-drift.json` (137 attempts, 70 problem records, 19 claims), `classes/_mech_chunks/*.json`, `raw/*.md`, and live read-only checks on 2026-09-29 between 04:11Z and 04:55Z against node 1 `substrate-live` (container c951b44f4a99) and node 2 `compose2-live` (c9b0a6b539b3). The collector records hold about 330 summed recurrences across 70 problem records, the largest being git-deployment at 65, live-gaps at 45 and git-super-2 at 25. This is the largest class in the realignment.

---

## 1. The copies (why "which copy?" is the whole class)

For one vessel, the following copies can each drift independently:

| # | Copy | Who writes it | Who reads it |
|---|---|---|---|
| 1 | `origin/dev` on GitHub | mitosis cutover push, operator push | pull-sync fetch |
| 2 | push clone `/workspace/git/vessels/<v>` | cutover, pull-sync ff | compose gates (after `targetFileOnDisk`), runtime-drift, self_fact_reconcile v1.2 |
| 3 | super-repo gitlink + worktree `/workspace/git/super-repo/repos/<v>` | bump commits, pull-sync `submodule update`, walks' `bounded_shell` (cwd default) | compose gates before 09-24, detectors, operator |
| 4 | runtime tree `/vessels/<v>` (image layer + mirror) | `mirror-to-live` (5 callers), `preLiveSync` drafts, `patch_with_tools`, walks | the running process |
| 5 | `node_modules/@avigopal/ias-executor-ts/dist` per consumer | fan-out | 5–6 consumer vessels |
| 6 | image-baked `/usr/local/bin/*`, `/etc/systemd/system/*` units/timers | Dockerfile at build, pull-sync `converge_units` (added 09-10) | systemd |
| 7 | fleet files `/workspace/substrate/fleet/vessels.{inventory,manifest}.json` + `.converged` markers | pull-sync "fleet" step, vessel-ctl | vessel-ctl, self_fact_reconcile |
| 8 | secrets/env `/etc/substrate/env`, `.substrate-secrets` | gen-env.sh, secrets.env.sh (two writers) | every unit |
| 9 | markers `/workspace/.pull-sync/<v>.sha`, `/workspace/.last-good/<v>` | pull-sync | pull-sync (skip decisions, rollback) |
| 10 | host operator checkout `repos/<v>` | operator `git pull` | operator greps, `make restart-*` docker cp (pre-08-09) |
| 11 | the running image | operator `docker build` from a dirty host tree | everything at boot |
| 12 | runtime state tracked in git (`gaps/`, `state/`, `leases/`) | runtime **and** git pulls | the runtime |

The 70 problem records all come back to this table. Their own root-cause fields say so in 15 different wordings: "three trees", "four copies", "multiple sources of truth", "no single desired-state reconciler", "nothing asserts runtime == committed".

---

## 2. Timeline (each claim paired with what later showed)

| Date | Event | Claimed | Later |
|---|---|---|---|
| 2026-02-17..03-10 | 56fa618c, 7858dc4a, 1394012d: diagnosed stale code in long-running processes (module/bun caching) | Diagnosed | The runtime-vs-source class carried straight into the substrate era (git-super-1) |
| 2026-05-23..29 | F-014 → inv-077: committed fixes inactive in the container; src/dist split; coordination file claims a reverted resolver deployed (9 recurrences) | — | Same symptoms on 09-28 |
| 2026-05-24 | activity-api 93cd621 cache fix; EMBEDDING_MODEL_DIR missing from gen-env (Dockerfile ENV vs env file diverged) | "fixed" | The cache fix needed a container restart; the env fix was hand-appended to `/etc/substrate/env` (openspec-2 D-001/D-004) |
| 2026-05-30 | openspec `2026-05-30-vessel-binary-redeploy-on-source-drift`: `detect_binary_source_drift` resolver + `redeploy-vessel-on-drift` activity | Spec'd **the general capability** | 0/16 tasks; none of its identifiers exist in live code. `run_goal "restart concept-db"` picked an unrelated gap-closer and finished in 1.2 s without restarting anything |
| 2026-06-04..06-17 | host-sync-poller / host-pull-sync (057ba013, b04330b8, c4d4045c) | Host mirrors commits into container | Units deleted 06-25, re-added 06-26, all deleted 08-11 (a267367e). Violated law 11 (depended on the host location) |
| 2026-06-16 | MITOSIS_DIRECT_PUSH (dev-vessel 2cad89c): container pushes its own landings | Worked | Still live. Copy 1 became authoritative for substrate landings |
| 2026-06-17 | 542e2dc7 bakes side-loop scripts into the image | "`systemd_unit_health_observer` now catches the class" | Same class 06-19 (2600dab3: timers not enabled at build) and 06-29 (c0a61d47: relevance-sink never COPY'd) |
| 2026-06-19..08-11 | Mitosis pending-lock / freshness livelock fixed ≥6 times: 2cfc6b0, db30efa, 9019cbd, b4e3d77→05829d6 revert→0c96b99, 3f4be28, c8b2e6e, 76c5ed0/24060e3 | Each "fixed" | Each fix named a new exit path. Same class again 09-24 (staged_base_sha deadlock) |
| 2026-07-05 | `pull_cutover` resolver (dev-vessel d245022/0ed07cd), used by boredom as doom-signal repair | Worked | Live, but its output shape mismatches (`pull_cutover` vs `pullCutoverReport`, edb4ba3); "extend to all vessels" still open |
| 2026-07-09..08-08 | Requires→Wants (d19124c8, 94d12ed8, d08ebf5b, a45c540e, 699ad19c, 6bd4e1d0, c7b80f1f) | Done | d19124c8 missed goal-host; 13-unit fix redone 07-23; 6bd4e1d0 "moved the blocker instead of removing it" |
| 2026-07-13 | dev-vessel 71575a12: fetch+reset to origin before every compose | Worked | Stopped the d07074d silent revert across 6 landings (one copy-pair only) |
| 2026-07-15 | ias-executor-ts `substrate:deploy` hook (0dcf370, 58c5638) | Library self-deploys | Fan-out left 5/6 consumers on stale dist for **11 days** until c6d2212a (08-16) |
| 2026-07-20 | 596fd717: mirror decided by src content md5, not marker sha | Worked | Coverage is a list: .json added 07-25 (967e3d6e), sql/.surql, units, selector, gen-env, timers, scripts/ (66cc9185, 09-24), declarations-only packages (31f15baf, 09-28). **10+ fixes for "type X silently does not deploy"** |
| 2026-07-21 | a81c46f5 mirror-to-live restores to HEAD | "Deploy boundary closed" | Split-brain 07-20 marker vs runtime, baked /usr/local/bin 07-23/07-31, hash wedge 08-02 all recurred (memory-2) |
| 2026-07-24 | `WORKSPACE_ROOT=/workspace/git/super-repo` in `/etc/substrate/env` | Worked (satisfier .sh 0→39) | Same variable split the memory stores (09-22) and fs_read/fs_edit roots: 313 "path outside workspace root" refusals in 5 days (live-resolvers) |
| 2026-07-24, 08-24, 09-24 | Stale-base full-file cutover reverts a concurrent landing (9a93e21/ca52631; 1be9f4f reverting 7fcbaba; 6ab8271 undoing a0ff3d3) | Each re-landed | Freshness gate hashes the `/vessels` mirror, not origin; 096c517 reverted operator fix 33afcc8 |
| 2026-08-02 | 8f8e87e7 untracks runtime state from super-repo | "Runtime state untracked" | WORKSPACE_ROOT moved by 08-08 → split brain; `leases/*.json` re-added by autonomous e72a7fc8 (09-13) and edc68d49 (09-26); still tracked today |
| 2026-08-02 | 9d261470 starvation break; 41182490 .timer remap; c8b2e6e dirty-index unstage | Worked | Clone had been 10 commits/11 h behind with 37 silent ff-only failures |
| 2026-08-05 | 9706f440 TimeoutStopSec=300 drain drop-in committed | Committed | **Never in effect**: units were image-baked, pull-sync did not sync units |
| 2026-08-08 | cb5b0b24 skip masked vessels; first restart exercise, 4 gen-env/secrets fixes | Worked | Secrets class recurs to 09-26 (9 fixes: two writers, quoting, node 2 reverted an uncommitted gen-env fix through pull-sync) |
| 2026-08-09 | c0e42fa3 bump 5 gitlinks, "stale pointers were reverting deploys" | Diagnosis | ce80875f retracted: deploys come from `/workspace/git/vessels`; the same commit moved obsidian-vessel **backwards** 3364d47→aa4ae90 |
| 2026-08-09 | 50f10bb9 deploy recipe copied only index.ts → `docker cp <src>/.` | Worked | 6 vessels had shipped nothing for non-index changes "while reporting success" |
| 2026-08-10 | ff10d3a0: deploy channel wedged by committed runtime state (45 commits stale) | Reset | Recurred 09-22 (12 stranded commits, 16 h wedge). No divergence alarm was built |
| 2026-08-15 | Dev-vessel `/etc` shadow unit removed; masked-but-running units unmasked | Worked | Dev-vessel crash-looped 13 days (2622 restarts, exit 0). The "running unit not masked" detector was never built |
| 2026-08-16 | 25aad2cc quiesce deadlock (900 s wait inside a 900 s timeout); c6d2212a fan-out hash gate | Worked | 25aad2cc first landed at `scripts/` while the unit ran `/usr/local/bin`: the converger was in none of its own convergence lists |
| 2026-08-19 | Tier 0–4 learning fixes landed, but goal-host kept running 5be4cfa | — | Marker written **before** restart, so the next tick short-circuits; deferral counter frozen 1/3 (reports-5) |
| 2026-08-20..22 | vessel-ctl replaces ~40 Makefile targets (008f3ab9 + 4 follow-ups) | Worked | Live; one follow-up had disabled every LLM arm; 63 `.PHONY` ghosts exited 0 (23042561) |
| 2026-08-24 | Pull-sync pre-cutover test gate | Gate | Refused correct 578b831 silently; operator used docker cp. Gate dead 08-31→09-28 (shell 30 s default, fixed 5e9a0b2); on 09-24..27 skipped 7× on tick budget (`pull-sync-testgate-skipped-*`, open) |
| 2026-09-07 | Rhythm self-maintenance "vessel code drift detected and committed" (4e4170a8) | "Automated commit" | Swept 2134 files, truncated spectral-gap source; service failed 09-14, found 09-16. Same family 13c5d466 (1909 files), 796fac89 (412), 9d839e0 (09-28, 422 `.bun` cache binaries + gaps.json) |
| 2026-09-07 | 9333f0f7 dirty check ignores untracked | Worked | Gate mirror 396→0 behind. Class recurred 09-10 (unblocked by hand twice in 43 min, `synced=0 failed=0` while frozen) |
| 2026-09-13 | runtime-drift-tick 63b48175: a second repairer restoring `/vessels` | Watchdog | Raced pull-sync's mirror (a `| head -15` grep had hidden the existing caller); bb217e5e set repair **OFF behind `RUNTIME_DRIFT_REPAIR`** (env gating) |
| 2026-09-14 | Container push restored (35537c7e) | "Push restored" | 09-18 03:08 PAT dead again; gen-env.sh:298 prefers the stale env value over the persisted secret |
| 2026-09-22 | 12 stranded unpushed autonomous commits wedged super-repo pull 16 h; one had an unparseable store.ts | Reset to evidence branch | The divergence alarm is still missing |
| 2026-09-23 | 76d548d1: image reports its own readiness/revision/connection | "Image self-reports" | No running container has it: node 1 runs 204a0be9 (built 09-24 04:11Z, no revision label, no substrate-status); node 2 revision "unknown" |
| 2026-09-23 | self_fact_reconcile (983ca92, bad7993, 4e70cbb) | Closed obsidian divergence by predicate | Fact table in code (law 1 debt). On node 2 both fleet copies were truncated to one identical entry, so it sees agreement |
| 2026-09-24 | `targetFileOnDisk` + sites A/B/D (20a668b, a0ff3d3, 13841a4, 1d4ac1c) | "Falsifier MET 16:49" | Only "which copy" resolver that exists, and it covers compose readers only; co-located-test-discovery sibling still open; super-repo worktree refroze within 5 h |
| 2026-09-24 13:15Z | fdb2fa6: substrate landed its own migration-runner fix with no operator hands | "First no-hands landing" | Never deployed: pull-sync didn't fingerprint `scripts/` ("third time this exact class has recurred", 66cc9185) |
| 2026-09-24 | 46d252c restart coalescing `selfRestartAlreadyOwed` | Worked (4 coalescings) | ≥10 distinct open restart-class gap ids 09-29 (consecutive-landings, cutover-restart-fires-blind, every-restart-budget-shorter…) |
| 2026-09-26..28 | Node 2 cpg-inference-ts build loop: 174 "dist stale" re-runs, 42 BUILD FAILED, 241 failed=1 ticks | — | 31f15baf fixed it, but the fix was first blocked 07:27 by a locally modified pull-sync.sh in node 2's clone (ff-only FAILED); healthy from 08:11 |
| 2026-09-28 | 50830bec untracks `state/learning-mode-state.json` | "Untracked" | The pull **deleted** the file in node 1's clone and the runtime recreated it fresh, resetting learning-mode state; dev-vessel repo still tracks `gaps/gaps.json` + `state/learning-mode-state.json` (dirty on node 1 today) |
| 2026-09-25..28 | Host image built from an uncommitted tree (ledger hooks installer, Dockerfile COPY, gen-env, setup-git-push, units, Makefile) | — | Still uncommitted in the host tree on 09-29 (`git status`) |

---

## 3. Root causes

1. **There are N copies and no declared authority for each reader.** Every gate, detector, instrument and process reads whichever copy is nearest. Three records name the same four-copy topology in different words (memory-2, memory-4, reports-4).
2. **The only converger decides by allowlist.** `substrate-pull-sync.sh` is 1,777 lines with 65 commits since 06-01. It decides "changed?" with a hand-extended list of file kinds and "restart what?" with a hand-maintained unit→source map. Each new kind or unit is a new instance (R1 fingerprint ×3+, R2 restart deferral ×7, .timer remap, R11 Requires).
3. **Refusals do not count as failures.** Skip-and-log ("modified locally — leaving it alone", "dirty", "deferred", "testgate skipped") still ends in `done — synced=0 skipped=0 failed=0`. Nothing consumes the refusal, so a silent skip reads as a pass.
4. **Success markers are written on the wrong evidence.** The `.sha` marker was written before the restart (08-19). `.last-good` is not advanced on cutover landings. The fleet `.converged` marker is rewritten to match a truncated file (node 2, verified today).
5. **The deployer deploys itself one tick late, or never.** pull-sync, units and gen-env are image-baked. 25aad2cc and 9706f440 landed in `scripts/` while `/usr/local/bin` and `/etc/systemd` ran the old copy.
6. **Several writers act on the same trees.** `preLiveSync` drafts, `patch_with_tools`, walk `bounded_shell sed -i` (cwd = super-repo), mitosis whole-file cutover from a stale base, rhythm drift-commit sweeps, runtime-drift repair and pull-sync all write copies 3 and 4. The duplicates race each other (bb217e5e).
7. **Runtime state lives inside git clones.** `gaps/`, `state/`, `leases/` and the fleet files sit inside clones that pulls mutate, so pulls delete live state (50830bec) and the drift-commit family re-tracks it (edc68d49, e72a7fc8, 9d839e0).
8. **Image provenance cannot be verified.** Images are built from a dirty host tree and carry no revision label, or carry "unknown". No running container can be proven equal to any commit (law 11).

## 4. Why it recurs: the missing shared capability

The substrate has no **desired-state reconciler**: one activity that, for each (node, unit, reader), derives the set of copies from the same source that performs the copy (what `mirror-to-live`, fan-out, unit install and fleet install actually write), compares each loaded copy with its authority **under declared transforms** (for example the install-time rewrite `"file:../ias-executor-ts"` → `"file:/vessels/ias-executor-ts"` observed in dev-vessel and goal-host `package.json` today; byte identity alone would false-alarm), and emits a shaped `deployDrift` impulse that is graded. The reconciler must treat any unconverged copy as `failed`, whether it came from a skip, a refusal, a local modification or a missing clone. It should be reachable over discovery, so that node 2's state can be read from node 1, since absence in one place is not absence (law 11).

Every attempt in the record is one row of that matrix (one copy-pair or one artefact type) or a duplicate of another row. The class respawns wherever a copy exists that no row covers, and it respawns silently because refusals exit 0.

**Where the seam is:** the seam between "landed" (git) and "loaded" (process + files it reads). `mirror-to-live` is already the single copy primitive with 5 callers (pull-sync, feature-compose.ts, patch-with-tools.ts, pull-cutover.ts, goal-host). The reconciler belongs next to it and should derive its coverage from it.

## 5. Prior attempts at that same general capability, and why each did not hold

| Attempt | Date / ref | Why it did not hold |
|---|---|---|
| Vessel-binary redeploy-on-source-drift spec (`detect_binary_source_drift` + activity) | 2026-05-30 openspec | Never built (0/16). This was the right shape: an activity, graded, with rollback |
| Host-side pollers (host-sync-poller, host-pull-sync, bb573355 per-submodule SHA detector) | 06-04..08-12 | Depended on the host (law 11), had no quiesce, and cycled through add, delete and re-add before being retired by a267367e |
| `systemd_unit_health_observer` "catches the class" | 542e2dc7, 06-17 | Watched unit health, not source==loaded. Refuted 06-19 and 06-29 |
| `pull_cutover` resolver | d245022, 07-05 | Per-vessel, operator/boredom triggered, output-shape mismatch (edb4ba3). Not a continuous check |
| Content-hash mirror decision | 596fd717, 07-20 | Right idea, but its coverage is an allowlist and has fallen behind the mirror ≥3 times (json, sql, scripts, decl packages) |
| mirror-to-live restore to HEAD | a81c46f5, 07-21 | One pair (clone→/vessels). "Deploy boundary closed" was refuted within 2 weeks |
| host-container-source-drift-observer-tick | dev-vessel | Vacuously green: `HOST_REPO_ROOT` does not exist (mech chunk 00) |
| Fan-out hash gate before LAST_GOOD | c6d2212a, 08-16 | Works, but only for the ias-executor dist copy |
| vessel-ctl `apply`/`drift` verbs | 008f3ab9, 08-20 | A management surface, not a watcher. Units installed dynamically are lost on recreate unless in installed.json (337c9226) |
| `converge_units` + drift census in pull-sync | 09-10 | Adds units to the list; list-driven; fleet files now refused on node 1 for 22 days |
| runtime-drift-tick watchdog | 63b48175, 09-13 | Duplicated pull-sync's repair and raced it. Repair is now OFF behind `RUNTIME_DRIFT_REPAIR` (env gating, law 1). It detects but cannot cover in-tree vessels (demo-vessel, relevance-sink have no clone) |
| Rhythm "vessel-sync-and-health" | rhythm-conductor-tick.ts:127 | Duplicate of pull-sync (mech chunk 05) |
| Rhythm self-maintenance drift-commit ("vessel code drift detected and committed") | 4e4170a8 09-07 → 9d839e0 09-28 | **Harmful**: it resolves drift by committing the runtime into git, sweeping 2134, 1909, 412 and 422 files, truncating source and re-tracking runtime state. The drift direction is backwards |
| self_fact_reconcile | 983ca92/4e70cbb, 09-23 | Closest to general, but facts are a hard-coded table (law 1). Node 2 has both copies truncated identically, so it sees agreement. On node 1 it detects the fleet divergence (reopen_count 24) while pull-sync reports `failed=0`, and no reader reconciles the two |
| `targetFileOnDisk` | 20a668b et al., 09-24 | The only "which copy" resolver. It covers compose readers only; siblings are still open |
| Image self-reports revision (install contract) | 76d548d1, 09-23 | Correct at the image layer, but no running container was recreated from a published image, so nothing reads the label |

## 6. Current verified state (2026-09-29 04:11–04:55Z)

**Green right now:**
- The vessel `src` layer. For every vessel with a clone on both nodes (19 on node 1, 16 on node 2), `diff -rq <clone>/src /vessels/<v>/src` shows 0 differences and the clone is 0 ahead/0 behind its local `origin/dev` ref.
- Units were started after their newest commit for activity-api, goal-host, development-vessel, local-tools, llm-resolver, boredom, concept-db and discovery on node 1 (e.g. dev-vessel started 01:43:20Z vs last commit 01:37:14Z).
- runtime-drift 04:49:14Z: "18 vessels checked, runtime matches committed source (2 not coverable)". The `runtime-drift-boredom-vessel` gap (02:58Z) was repaired by the 03:17Z `synced=1` tick.

**Drifted right now:**
- **Node 1 fleet files unconverged for 22 days.** `/workspace/substrate/fleet/vessels.inventory.json` is 5977 B (Sep 7 04:33) against 425 lines in git, and the manifest also differs. pull-sync logs "modified locally — leaving it alone" **270 times in 24 h (2 per tick × 135 ticks)**, and every tick ends `failed=0`.
- **Node 2's damaged copy is marked converged.** The super-repo working tree `scripts/substrate/vessels.inventory.json` has 9 lines (obsidian only) against 425 at HEAD. `.vessels.inventory.json.converged` (rewritten 04:48Z, 133 B) is byte-equal to the truncated file. `scripts/substrate/learning-loop-selftest-tick.ts` is deleted. Tick result: `done — synced=0 skipped=0 failed=0`.
- **Two instruments disagree and nobody reconciles them.** `self-fact-divergence-fleet-inventory-copy-{boredom,human-surface,obsidian}-vessel` is open with reopen_count 24 (last 04:23Z), while pull-sync reports clean.
- **Rollback pins are wrong.** `/workspace/.last-good/<v>` differs from the running HEAD for 10/19 vessels on node 1 (e.g. llm-resolver db8af1d vs 3c83a33) and 4/13 on node 2 (dev-vessel 9c86aff vs f451e42, activity-api d98309e vs 39783b0).
- **The test gate flagged a regression and converged anyway.** `pull-sync-test-regression-activity-api` at 39783b0 (22:02Z 09-28) names the exact HEAD now running on both nodes. `pull-sync-testgate-skipped-*` has 7 open gaps (converged with no suite).
- **Runtime state is tracked in git again.** Super-repo `leases/maintenance-{autonomous_pick,trace_store}.json` was added by autonomous e72a7fc8/edc68d49. It is modified on both nodes and deleted on node 2. The dev-vessel repo tracks `gaps/gaps.json` and `state/learning-mode-state.json` (dirty on node 1).
- **No running container has verifiable image provenance.** Node 1 runs image 204a0be9 (created 09-24 04:11Z, no revision label, no `/etc/substrate/image-revision`, no `substrate-status`). The host's current `ghcr.io/avigopal/substrate:dev` tag db159674 (rev 772f760e, which contains 76d548d1) runs nowhere. Node 2 runs `localhost/substrate:compose-ownership` with revision `unknown`. syzygy containers also lack substrate-status. The host tree has uncommitted `Dockerfile.substrate`, `Makefile`, `gen-env.sh`, `setup-git-push.sh` and two unit files.
- **Host operator checkouts lag the super-repo gitlink:** activity-api by 44, development-vessel by 299, goal-host by 51 and concept-db by 7 commits. The node-1 super-repo gitlink for dev-vessel is 1 behind the live clone.
- **Node 1 super-repo clone:** 1629 porcelain lines, mostly walk scratch under `Substrate/Projects/`. `/vessels` holds 15 un-GC'd `*-mitosis-*` overlay dirs.
- **Open gap families:** `runtime-drift` 13 open (first 09-18; 2 uncoverable in-tree vessels), `runtime-source-truncated` 10 open (latest dev-vessel 09-28 22:05Z), and ≥10 restart-class ids. Across the id families matched, 173 are open, 27 closed and 7 superseded.
- **Node 2 masks:** four detector timers (compose-drift, joint-liveness, learning-loop-selftest, validator-liveness) are hand-masked in the failed state, so node 2 is not reproducible from image + env + volumes.

## 7. What to keep, what to retire

**Keep (reuse first):**
- `mirror-to-live`, the single copy primitive. The reconciler derives its coverage from it.
- The content-hash decision (596fd717).
- The fan-out hash gate (c6d2212a).
- `vessel-ctl` + `installed.json`.
- `targetFileOnDisk`, generalised from compose readers into the "authoritative copy for reader X" resolver.
- `pull_cutover`, which walks can reach. Fix its output shape.
- `self_fact_reconcile` as the detector half, with its fact table moved into shaped impulses.
- The image-revision label (76d548d1), once containers are recreated from a published image.
- `selfRestartAlreadyOwed` coalescing.
- The 09-24 parked-landing and restart-budget specs.

**Retire:**
- The runtime-drift-tick repair half (duplicate, env-gated).
- Rhythm `vessel-sync-and-health` (duplicate).
- Rhythm self-maintenance drift-commit (`rhythm-conductor-tick.ts:126`). It is harmful and reverses the direction of authority.
- `host-container-source-drift-observer-tick` (vacuous).
- Host pollers and PR-based self-deploy (already fossils).
- `preLiveSync` staging of drafts into `/vessels` before judgment (mech chunk 02, "harmful").
- The pattern of adding artefact kinds to pull-sync's fingerprint list one at a time.

## 8. Retire condition (measurable, checked continuously by the reconciler itself)

The class is retired when **all** of the following hold on **every node** for **14 consecutive days**, as reported by a graded `deployDrift` activity that is reachable over discovery from any node:

1. For every running unit, the content it loads equals `origin/dev` for its source set, modulo declared transforms. The source set is **derived from what mirror-to-live / fan-out / unit-install / fleet-install copy**, not from an allowlist. Zero unexplained differences.
2. Zero pull-sync ticks end with `failed=0` while any clone it manages is dirty, refused, skipped or "modified locally". Measured: count of "modified locally" lines = 0 (today 270/24 h on node 1).
3. No new gaps and no reopen_count growth in `runtime-drift`, `runtime-source-truncated`, `pull-sync-testgate-skipped`, `pull-sync-test-regression` (converged anyway), `self-fact-divergence-fleet-inventory-copy` or the restart-kills-in-flight families.
4. `/workspace/.last-good/<v>` equals the running HEAD for every vessel (today 10/19 and 4/13 mismatched).
5. Every running container carries an `org.opencontainers.image.revision` equal to a commit reachable from `origin/dev`, and a clean checkout at that revision builds the same image (today 0/4 containers).
6. `git ls-files gaps/ state/ leases/` is empty in every repo, and no autonomous commit touches runtime paths.

## 9. Related classes

dormant-mechanism (redeploy spec 0/16, repair OFF), env-gating (`RUNTIME_DRIFT_REPAIR`, gen-env precedence), false-verification (skip = pass, markers on wrong evidence), hollow-landing (fdb2fa6 landed, never deployed), autonomous-regression (drift-commit sweeps), node-locality (node 2 truncated fleet, provenance), codebase-bloat-fossils (mitosis overlays, host pollers), test-residue-live-state (preLiveSync drafts, Substrate/Projects scratch), credential-hygiene (push PAT shadowing), docs-drift (README install contract vs running image).
