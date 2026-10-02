# git-super-2 — super-repo git history, 2026-07-01 → 2026-09-28

Source: `/home/avi/documents/work/substrate` (super-repo only), `git log --since=2026-07-01`.
**2031 commits** (Jul 306, Aug 924, Sep 801). Subjects read for all 2031; bodies read for ~150
(the clusters below). Submodule-internal history NOT read — only visible through bump subjects.
Pre-07-01 is git-super-1. One report file (WHY-THINGS-KEEP-BREAKING-2026-09-28.md) was read as
commit-level evidence because it classifies these same commits.

Authors in window: DevBob Assistant 1375 · avi (operator via Claude Code sessions) 229 ·
substrate-bot 216 (CI submodule bumps) · Avi Gopal (operator bypass) 100 · Devbob Agent 57 ·
**Substrate Autonomous 35 + substrate-live 4** (super-repo autonomous) · others 15.

Subject-type mix: docs 707 · chore 489 · fix 345 · validation 217 · feat 127 · openspec 63.
Words: "retract/withdraw" in 45 subjects, "correct/correction" in 69 — i.e. **~1 in 18 commits
retracts or corrects an earlier commit's claim**. Reverts: 5 formal (`0a535483`, `07e32d38`,
`72f58abc`, `6b238b63`, `807b92ef`) plus ~10 in-body reverts (`9df01220`, `9fa6bd81`, …) and
~10 autonomous-landing reverts recorded in validation/reports check-ins (09-25 → 09-28).

---

## 0. The spine: recurrence chains (same class, new hat)

| # | Chain (class key) | Commits (date) | Count |
|---|---|---|---|
| R1 | pull-sync change-detector blind to a file kind (sync-deploy-drift) | `967e3d6e` .json (07-25) → `cb28e450` sql/.surql (07-25) → `66cc9185` scripts/ (09-24, body: "This is the third time the list fell behind the mirror") | 3 |
| R2 | pull-sync restart deferral never converges (sync-deploy-drift) | `379ef9f4` (08-10) → `ad535830` quiesce (08-11) → `25aad2cc` quiesce outlived unit (08-15) → `4b2d6410` "backstop is not a backstop" (08-16) → `73a3b54c` deferred restart permanent, goal-host 23h stale (08-19) → `85bc103c`+`fd3d6871` defer by age (09-24) → `421653ab` arms never restarted (09-23) | 7 |
| R3 | pull-sync test/regression gate dead or blind (false-verification / autonomous-regression) | `676cb859` introduced (08-04) → `cffc9489` 0/132 runs completed → `2e47b75e` blind (no bun on PATH) → `5ef2966f` masked guard never fired → `86491fec` "my own fix wedged the deploy loop" → `bb573355` blind to substrate commits (62 no-op ticks) → `0a62b058` gate on deploy channel → `6278a317` count≠regression, wedged → `24877839` unbound var took channel down → `4e79dd76` skip filed only as log → `7f29a61c` SIGTERM-ignoring suite hangs tick → `6c7c5b8a` attribution (08-28) → `5d9a7867` "test gate fails open" (09-24) → `b7dab713` post-land suite restored, dead 08-31→09-28 | 14 |
| R4 | self-recovery restarts the victim of DB pressure (spend/trace-store-db + autonomous regression of the immune system) | `9520a372` 3-strike (07-10) → `fc143654` db_under_pressure (07-23) → `44250006` restart mid-migration, 37 starts/3h (08-03) → `0b3f70b2` probe could only see a DEAD DB, 16 restarts/6h (08-08) → `337c3b81` "the same loop, again" (08-17) → `ad9da780` unbounded ladder, 36 identical escalations (09-16) | 6 |
| R5 | SurrealDB memory / trace growth (trace-store-db) — six hats | `2687fbe7` block cache "NOT a full fix" (07-16) → `ee9c1dc2` retention rhythm (07-16) → `6eda182a` retention cap 150k + cgroup cap (07-22) → `60b2328e` wedge at MemoryHigh (07-31) → `0b3f70b2` execution table 18GB (08-08) → `5a2074f7` 27GB traces, "maintenance detects without acting" (08-16) → `a78fcfd7`/`07e32d38` batch=1 probe then revert (08-16) → `9e8b931f` poison rows (08-16) → `e2ba1a69`→`9df01220` memory cap OOM-killed prod (08-17) → `8c862ef8`/`9fdb0b27` FTS rebuild (09-25) → `1178cc1a` 41GB, 89% unreclaimed blob garbage (09-25) | 11 |
| R6 | persisted secrets file clobbered/corrupted (env-gating / sync-deploy-drift) | `03720115` two writers truncate (08-07) → `b749a2a5`/`a030952b`/`38e4f79a` converge the writer (08-07/08) → `ae110fcd` overwritten from a changing list (08-08) → `fd9d1102` unquoted values corrupt JSON (08-22) → `f32b2274` heredoc comment runs as command (08-22) → `fdd5503f` quote-doubling on read (09-20) → `e31e28dd` two vars never reach env; node 2 reverted uncommitted fix (09-26) | 8 |
| R7 | fleet auth keys wrong / unset → silent 401 → empty vocabulary (endpoint-routing / goal-walk-floor) | `3982521e`→`b2a0a878` dual-secret bridge then retire (07-23) → `cf882aed` one key cannot span two trust domains (07-28) → `263ef893` seeder read 200 as "valid" (08-20) → `6d19c0a0` spoke joined wrong substrate → 401 (08-20) → `d60fcc81` unset API_KEY: discovery 401 → empty vocabulary → reach gated at step 0 (09-10) → `1322c71f` per-vessel keys printed not written (09-19) → `2e18b398` "unauthenticated query read 401 as empty" (09-22) | 7 |
| R8 | selection never reads the learned posterior (selection-learning, write-read-mismatch) | `3b8ba963` negative half severed in 4 places (08-16) → `6ac76284` blame annihilated at the draw (08-16) → `be2b9933` "real Beta draw, posterior retirement" (08-16) → `4bcb9f81` every draw is Beta(1,1): credit writes computeStateSpaceSignature (16 hex), selection reads computeContextBucket (8 hex), tier-3 view does not exist (08-22) → `b66201d6`/`a765c376`/`8ebcbb2a` org_id forms, half-revert (08-22) → `4921332d` posterior counts 184 failures never updates beta, write-key mismatch (09-24) → `382abd16` task-thrown failures graded 'ungraded' (09-24) → `72aad357` "fix 7 verified — selection now reads its learned posteriors" (09-25) → `5f01d5ef` lever 1 β on outcome (09-26) | 9 |
| R9 | composition/minting "demonstrated" then found inert (composition-crystallization, hollow-landing) | `31f0972a` minting demonstrated (08-13) → `4689117b` RETRACT, inert (08-13) → `f590ad76`/`94dc3d5f`/`4d417b6e` "dozens minted" (08-13) → `11859d57` whole ribosome output ever = two templates, `activity_templates` has 1 writer 0 readers, `activity_template` 6 readers 0 writers (08-21) → `cf5370e8` composition edges mint after "ten causes on one function" (08-21) → `debc3da3` ribosome dispatch targets a retired template (09-27) → `70254535` ribosome registration + extraction joints severed (09-27) | 7 |
| R10 | runtime state / scratch committed into git by autonomous or blanket `git add` (codebase-bloat-fossils, test-residue-live-state) | adds: `3142f140` 350 files (07-25), 6× "commit changes" policies/ (08-02), `4e4170a8` 2134 files (09-07), `e72a7fc8` 176k lines (09-13), `13c5d466` 1909 files (09-18), `796fac89` (09-19), `edc68d49` learning-mode-state (09-26). Cleanups: `8f8e87e7` (08-02), `a009e1d9` (09-15, "reset --hard was destroying operator feedback"), `d993b331` 191 files −192k lines (09-23), `f90dda1a` (09-26), `50830bec` (09-28: edc68d49 blocked node-1 super-repo ff; glue layer 130 commits behind) | 7 adds / 5 cleanups; **residue still at HEAD** (see §codebase-bloat) |
| R11 | Requires= coupling stops the fleet (sync-deploy-drift) | `d19124c8` 13 units (07-09) → `94d12ed8` missed goal-host (07-10) → `d08ebf5b` 13 core units again (07-23) → `a45c540e`/`699ad19c` seeding holds boot hostage (08-08) → `6bd4e1d0` "I moved the blocker instead of removing it" (08-08) → `c7b80f1f` boot units spoke-safe (08-03) | 6 |
| R12 | human-surface bound to loopback / not published / not baked (human-surface-escalation, sync-deploy-drift) | `cf8f419a` bind 0.0.0.0 in manifest (08-07) → `c47f3843` publish port (08-17, commit did not contain the change) → `e92d2e1b` real publish (08-17) → `937c54a6`/`9c39f411` bake into image (09-17) → `86436189` bake ui/dist (09-22) → `ddf8f289` baked unit still 127.0.0.1, same fix again (09-23) | 6 |
| R13 | human surface resolves by hardcoded address instead of by shape (endpoint-routing) | `e53b54a4` resolve on hub (08-07) → `264829cc` gap store by shape (08-07) → `d65a21e7` reverses e53b54a4: hub row not dialable (08-18) → `4e50f1fa` hardcoded `/resolve` (08-19) → `3b4f921a` dispatch as shapes over p2p (08-19); then autonomous `bb5d6b9` broke resolveGoalHostEndpoint via `as unknown as` cast (09-27, `80e44669`) | 6 |
| R14 | relay reservation / phantom partition (federation-p2p) | `494a990e` watchdog re-reserve every 40min (07-25) → `2c247adc` redial storm (07-29) → `ea5882bd` phantom detection (07-29) → `abf60661` silently reverted it → `9fa6bd81` restore (07-29) → `607fc6ef` drop 40-min teardown (07-29) → `824609c6` halve tick (07-30) → `6ec65736`→`0a535483` keep-alive revert → `cfad41db` churn-safe re-land (07-31) → `3dbbbeff` **phantom watchdog manufactured the outage it existed to catch** (09-14) → `1afd003f` expose held reservation (09-14) → `e1c06f60` "joined means a live reservation" (09-22) | 12 |
| R15 | loopback / port / endpoint derivation wrong for remote caller (endpoint-routing) | `f85f0536` full-URL resolve_endpoint (07-07) → `e975b0b2` imported peer loopback names wrong machine (08-02) → `4fdf5b91` loopback repair existed in ONE consumer (08-09) → `ada62cff` rewritten HTTP vs transport (08-10) → `6d19c0a0` join discards port (08-20) → `7736ac2f` "two layers of my own fix disagreed above port 47534" (08-20) → `965901e1` derivation guessed; guard bricked every spoke boot (09-14) → resolve-URL joiner overshoot `9531c5f` (vessel, 09-20) → 5ca51be (goal-host) system-landed fix at 2 of ~8 sites (09-28, bd1fb6d9) | 9 |
| R16 | truncated / half-written source reaches live or git (autonomous-regression) | `befbccdc` feature-compose.ts 190,111→38 bytes, 3×/day (08-02) → `2134839b` live-vs-clone drift heal (08-02) → `63b48175` runtime-drift watchdog (09-13, duplicate) → `7013d1cf` spectral-gap truncated **in git** by auto-drift commit `4e4170a8` (45 deletions, 0 additions) (09-16) → `4b73956e` "fourth walk-writes-live-source instance" (09-26) | 5 |

R-chains share one root, stated verbatim by the 09-28 history search (`bd1fb6d9`): **"fixes are
site-scoped and validated once; nothing re-checks the class."** The WHY-THINGS-KEEP-BREAKING
classification (`2ca586ba`, 09-27) puts numbers on it: 253 break cases Jan→Sep, 64% silence
(contract drift, half-built joints, residue, staleness), 20% autonomous self-edits, ~22% wrong-but-
flowing; **~247 of 253 detected by operator/assistant sessions, 2 by the system, 0 first-caught by
a named detector.**

---

## 1. By problem class

### sync-deploy-drift (largest single class in this repo: 73 pull-sync commits)
- Deploy path = `substrate-pull-sync` + `mirror-to-live`. It had, in turn: a marker-sha skip that
  lied (`596fd717`, 07-20: goal-host and activity-api ran stale code forever); index-vs-HEAD restore
  (`a81c46f5`, 07-21 — "a root cause of the recurring 'landed on origin but not actually live' hollow
  landings"); starvation by mitosis markers (`9d261470`, 08-01); masked vessels deadlocking the loop
  (`b0df07e3`, `cb5b0b24`, `e8da4bfe` one dirty vessel stopped 17 others, 08-08); a converger that
  could not converge itself (`f1625ff8`, 08-08; `392e1990` glue fix could never apply to its own
  commit, 08-05); fan-out crediting itself for bytes 5 of 6 consumers never received (`c6d2212a`,
  08-16: symlink premise held for 1 of 6); untracked build artifacts freezing development-vessel 396
  commits behind for 3 weeks (`9333f0f7`, 09-06); timers installed but never enabled (`7f97df70`,
  09-09 — which then auto-enabled DB timers on DB-less node 2 on 09-26, per 2ca586ba); arms never
  restarted (`421653ab`, 09-23); declarations-only package never built on node 2 since 09-26
  (`31f15baf`, `4bb21141`, 09-28).
- Stale-pointer confusion: `c0e42fa3` (08-09) claimed stale gitlinks "actively undoing deploys";
  `ce80875f` retracted: deploys come from `/workspace/git/vessels/*`, not super-repo submodules —
  **two clones of every vessel, easy to measure the wrong one**. `4ac80e01` (07-27) gitlink pointed
  at an unpushed commit → every CI image build failed since 07-25.
- Two vessel-management surfaces: `008f3ab9` (08-20) collapsed ~40 Makefile targets into
  `vessel-ctl`; `23042561` found 63 deleted targets still in `.PHONY` exiting 0 (silent success).
- Outcome: partial. Each defect fixed at its site; recurrences continue to 09-28.

### trace-store-db
- R5 above. Retention valve saga 08-16: batch width real (239ms vs 3,155ms) but batch=1 moved cost
  into the queue (320 in flight, p50 33.7s) → reverted `07e32d38`; real blocker was poison rows
  (`9e8b931f`, same 4 ids every sweep). DB restart alone fixed "three symptoms" (`afed9094`, 08-16:
  CPU 607%→0, latency 13,340→16ms). 09-25: 41 GB on disk, ~5.2 GB live; 30-min full-table FTS
  REBUILD INDEX with blob GC off (`1178cc1a`); rebuild deleted by substrate-authored activity-api
  9387ca7 (`9fdb0b27`) — **worked** (one of the few verified substrate landings on a root cause).
- Frozen table: `activity_execution_traces` stopped receiving writes 07-14; 8 self-observation
  scripts read it for 42 days (`3c1bf965`, 08-25). `v_activity_score` view missing, reads return
  OK+0 rows forever (`4bcb9f81`). 95.29% of `execution` rows are auth_resolve_v1 (`90341a81`).
- `e2ba1a69`→`9df01220`: an operator memory cap computed on the WRONG MACHINE (workstation 60.6G vs
  hub 32.8G) OOM-killed the production DB inside the cap write. Class: directed-overshoot + node-locality.

### selection-learning
- R8 above. Also: success_rate display field decoupled from α/β (`a3787863`); satisfier plane picked
  by priority only, never posterior (`303e2432` → ff2b518 (vessel) landed 08-14, per `e4697f0f`); decay half-life 3d→30d
  (`08f316b7`, 08-22); "the posterior decision logs only its refusal — 4268 skips, no denominator"
  (`edd80e5a`, 09-11); "19 of 21 belief updates are penalties" (`8bf19af8`).
- Four separate multi-agent audits (08-16, 08-16, 08-21, 08-22) each concluded "selection is
  memoryless / uniform prior" with a *different* named cause; the class (writer key ≠ reader key)
  was not named until R8's last links. Outcome of the chain: `72aad357` (09-25) claims fixed;
  `eb2b8fcf` (09-27) still lists "no reward → alpha=1 → random selection" as the loop keeping the
  operator load-bearing. Mark: **partial**.

### composition-crystallization
- R9. Additionally the compositional ladder (08-16/17): depth capped by `slice(0,3)` in
  goal-target-inference (`391e0da8`), then "three redundant constraints and the fix hit the wrong
  one" (`bd71a269`); arguments amputated at four/five layers in series (`34a11209`, `f203cb88`);
  pathway chain closed across five landings 09-23 (`9b929eb6`, 20/20 `0aca3cc8`) — **worked** at
  that time; recommender "pathways are recommended then discarded" (`33fa3ee0`, 08-28).
- 3,856 activities, 817 ever selected, trace corpus knows 274; promote-gate quality projection fires
  on 0.56% (`90341a81`, 08-21). Minting outruns execution; nothing gates it.

### hollow-landing
- `00ceef57` (08-13): every autonomous close-goal reached hollowly (scan satisfier stands in for
  the close artifact). `b68f3872` (08-11): rename-only diff passes every gate and is stamped as
  closing a gap. `dc3a2068` (09-06): 80 graded successes, 0 with non-empty landed_vessels. `37d5f9b0`
  (09-27): env-gated constant whose only reader is console.log, closed landed_verified. `32d68e9b`
  (09-28): inert landing system-credited. `hollow_write` class per memory index (09-15).
- Mechanisms added against it: vacuous-edit gate, dead-store gate (`91d3b69e`, `d6f7693a`),
  semantic gate rejects tautological self-tests (`5085b6d3`), inert-diff detector (`fb782910`),
  close-oracle "measurement not provenance" (`007163ab`, 980135a). Each fired correctly at least
  once; recurrence continued (09-27/28). Outcome: partial.

### false-verification
- Reach grader: eight false reaches (`952008e4`) → grader given provenance "closed the false-reach
  class" (`f51735cc`, 08-15); later rung-4 false reach via 'not available' denial pattern
  (`5d340112`, `2964496e`, 08-16), `missing:true` (`62d987fe`, 08-17). Recurrence → partial.
- Gap closure: `25d33255` (09-06) gap closed with a prose remedy that never happened; `015b31fa`
  (09-14) federation close path conjured closed rows → inflatable close rate (law 7 metric);
  `3a5387c2` close rewrote category/source (store re-derives omitted fields); `11afcd07` (09-27)
  class2 falsifier polarity inverted (divergence_count as nonzero_field) → reverted landing closed
  landed_verified; `3e43c23c` wrong-node close had prior art on 09-23 (a57dc30 INHERIT_NEVER never
  reached legacy rows).
- Instruments lying: `13ff9c4b` stage5 probe printed PASS and exited 1; `0baff728` doctor reported
  FAILURES with all 7 checks passing; `26ae3d94` "the two tools that answer 'is this fleet healthy'
  both answered wrongly"; `6452ee6f` active timer ≠ work; `8e59ae6c` lift gate read a fossil
  heartbeat path (Aug-8 snapshot) while the writer wrote elsewhere.

### autonomous-regression
- Autonomous super-repo commits (39) are overwhelmingly residue (§codebase-bloat). `4e4170a8`
  (09-07) also **truncated spectral-gap in git** (45 deletions, 0 additions) → service failed from
  09-14 (`7013d1cf`).
- Vessel landings (seen via reports in this repo): `8c31cdb` goal-host 52-line `globalThis.fetch`
  monkey-patch broke resolve routing, run 11 void (`99db7a9f`, 09-25; pointer moved past it
  `ba02be09`); `bb5d6b9` human-surface `as unknown as` cast broke every surface goal (`80e44669`,
  09-27); `9cfdea4` activity-api added `if (!process.env.CONCEPT_DB_URL) return null` and `af2c737`
  lowered a documented 30s timeout — stale tests satisfied by breaking prod (`914828a2`, 09-27);
  `a198907` env-gated constant (`37d5f9b0`). Note: two of these autonomous landings **re-introduce
  env gating (law 1)**.
- 09-27 containment: first four post-reopen autonomous landings all reverted (`80e44669`,
  `403f2d9a`, `522b47b0`, `37d5f9b0`); `af0b09f0` autonomy paused 13:00–21:47.
- Attribution contamination: `1b40f92e` (07-30, operator-style hub change) authored "Substrate
  Autonomous <substrate-autonomous@metabob.com>".

### directed-overshoot
- `9df01220` (memory cap OOM), `86491fec` ("my own fix wedged the deploy loop"), `24877839`
  (unbound var from own rewrite), `6bd4e1d0` (moved the blocker), `7736ac2f` (two layers of own fix
  disagree), `8de05562` ("my predicate broke every arm"), `30ebe24b` (every arm shipped twice on one
  port, half crash-looped), `25ee2162` (vessel-ctl surface shipped with five blockers incl. one that
  disabled every LLM arm), `a600a8b9` ("repair two fixes that overshot"), `f212b93c` ("six of the
  findings are damage the round-1 fixes did"), `6c689441`, `940dbfb7` (landed fix hung every shell
  call ~3h), `abf60661` (stale working tree silently reverted a parallel session's fix),
  `c47f3843` (commit didn't contain the claimed change). 2ca586ba: 28 category-F cases.

### test-residue-live-state
- `2b049b7a` (09-27): running local-tools' suite in compose2-live registered a dead 127.0.0.1:20236
  row in LIVE discovery → broke node-2 composes 20 min. `914828a2`: test runner inherits the full live
  env (DB creds, METABOB key) → event-bus bursts 8–16k/min, traces into live DB. `947c8729` (09-28):
  node-2 local gaps.json = 70 test-fixture rows. `c62651ba` (09-22): poisoned discovery row from an
  ephemeral verify instance emptied every grounding window. `a009e1d9`: `reset --hard` destroyed
  operator feedback log. `3feff283`/`9333f0f7`: compiler artifacts counted as dirt.

### node-locality
- `9df01220` measured workstation, deployed to hub. `a50d1196` (09-28): node-2's young node-local
  `expectation-calibration.json` sealed categories the fleet record shows landing (61/1195, 99/2656)
  → 2→59 unsealed by moving calibration to gap-store holder (76bf256, 094c230). `5d0788b`: store-
  forwarding node no longer measures class2 locally. `947c8729`: gap-lifecycle-tick dispatched 22×
  by node 2 on its fixture store, 0× by node 1 → falsify/decomposition never ran on the real store.
  `0862c4b6` per-node rhythm state; `9ee996b8` node-local pause gap; `e31e28dd` node 2 cloned and
  claimed every repo; `31f15baf` node 2 failed pull-sync every tick since 09-26.
- Class: every "store" that is a local file per node (calibration, gaps.json, rhythm, spend) forks
  when a second node exists. Recurs 09-26 → 09-28 in ≥5 hats.

### calibration-seal
- `a50d1196` (above), `b47626a3` (5.5(iv) category calibration held by holder), `d628779f`
  calibration contamination recorded, memory-index: hopeless() excluded all but 2 of 126–128.

### narrowing-duplicates
- `8954e46c` narrowed-child verbatim duplicate (09-22); `1bd6c614` recommit self-reopen loop;
  `2e5ccd46` lesson-writer gap reproduced its own recommit loop; `0add5b9d` recommit-* take 46% of
  picks, land 4% (4/92), 56 gaps took 200 picks; `8141b538` lineage cap (46 excluded);
  `d628779f`/3df8ddd narrowed children wait for parent verdict (09-28); `94f5b966` one goal minted
  77 capability gaps (08-11); `99300382` 23% of pool names never-advertised shapes;
  `6b578a12` 635 open gaps triaged to 277; `11cb50de` 693 walk artifacts closed (09-27).

### gap-content
- `eccda3cc` (09-06): 74 gaps excluded for naming their file in prose not metadata;
  `eb2b8fcf` (09-27): "gaps without falsifiers → unverifiable closure → no reward"; `e8d62764`
  producer_count unknown; `3b0ca6d9` siteless gaps decompose (09-28); `a172e235` identical-failure
  invariant (09-16).

### drafter-quality
- `ca1c48ad` grounding window excludes the target; `58ef8a13` edit applied 1602 lines from target;
  `560b9a6a`; `12bd74a3` anchor repair relocated onto a different statement; `bcb5c0dd` unique
  anchor ≠ right anchor; `0863e1f8` duplicated-line anchor class (09-28); `db6b984a`/`f8fe6dd1`
  fs_edit `$'` expansion root cause (09-26); `fa9185ed` "I shipped a regression to the drafter";
  `610bba72` drafter taught 27 generalities from 2955 failures; `2a7b91eb` "my evidence was
  degrading the drafter". 2.7 deterministic exact-edit application (`b1ab1f9b`, `11a655c8`, 09-26)
  — **worked** (byte-equal, no LLM plan); memory index: prose goals dropped 2/3 edits.

### goal-walk-floor
- `f70595f2` reach gated at step zero by failed LLM target inference (09-10) with root cause
  `d60fcc81` unset API_KEY; `391e0da8` depth cap constant; `beb19924` (09-28) ReAct floor broken,
  read-only questions routed as code edits; `9c967329` (09-28) memory need not reached — target
  inference found no shape for 'memory'/'recall'; `e06466db` floor reached web goal with zero tool
  calls, fabricated answer; `99ce97bd` walk-aborting c.slice TypeError killed product battery.
  External-data gamut 08-15/16 (Io 6.2757 AU) — floor **worked** for that class after ~45 dispatches.

### spend-envelope-throughput
- LLM plane: keys threaded 07-03/07-18/08-04/08-08; `15371e16` two funded providers never given
  keys (09-11); `19503794` plane exhausted (credits) 09-26 ~21:26; `3786e9cf` spend attribution;
  value-per-cost-selection openspec (09-26/27) — spend envelope 1→2 USD/h (`065510a7`, `4f830f37`);
  `3d4ce31e` undirected composes bypassed the paused envelope; `4ea6ddcb` lane livelocked on held
  gap. Lanes/leases: `5f385717` verified directed fix discarded by change-window lease (97:153
  deferred:landed); resumable-landings change (09-24) — park/resume/push observed end to end
  (`2f12cf01`) — **worked**.

### memory-recall
- `118d341f` (07-19) session hook injects conceptPromptPriors; `df11194a` concept recall fails
  ~80% on a 7.5s search (08-15); `0d71a55c` recall was LATE not absent; `079e6469` 4s vs 42s timeout
  mismatch; `1b68bb9e` only working concept store was a masked orphan on 34h-old code; `5300020a`
  lexical recall broken since 09-02 (09-25); `62559ca6` memory split/flood (09-22); `44ab5fd4`
  (09-28) system memory holds nothing before 09-26, recall ignores topic.

### human-surface-escalation
- R12/R13. `e5ad0f61` (08-22) livelock's real cause = write-only question channel; 248 escalations to
  a replaced vessel (memory index); `fb598747` obsidian asks whether the surface is there;
  `005448cd` "384 human signals" retracted — 91% substrate spillover; `08b4219e`; `bf2be1bb`
  setup path bifurcated, prior audits green only on this host (09-23).

### federation-p2p
- R14, R15. 114 federation/relay commits. Federation oracle built 09-11→09-15 (`a0c702bb`…`1ad7bacd`,
  ~25 commits) and itself had: a negative control that could not fail (`26a53fe0`), instantaneous
  closure predicate (`a29653e4`), four defects found by adversarial review (`9834bd95`), relay-
  policy mistaken for path (`5584bc3f`), unbounded leg killed sweep (`1c5b73e5`), I12 never invoked
  (`37650c2f`), I4 checked a different peer (`df6206e3`), oracle deleted by the workspace it measures
  (`e4fe46d1`), reservation litter (`64dc1b8d`), echo instrument outcompeting the shape it measures
  (`bf58a721`). Multiaddr-only join (`f483cdf1`, `ab2eab2e`) — worked as of 09-15.

### env-gating
- `b1dcd418` env-gate self-development route (08-13); `0968fd1c` shaped lessonExecutionPolicy
  replaces env gate; `f65556be` MAX_STEPS/HORIZONTAL_K read at use time; `16dd0571`, `442de3ff`,
  `b94fa5a4` (08-17); `28f78545` seven variables with no working delivery path (08-21);
  `42302670` kill switches reach the fleet (08-22). Autonomous re-introductions: `9cfdea4`,
  `a198907` (09-27). EnvironmentFile precedence: `b067bff5`, memory index WORKSPACE_ROOT split.

### docs-drift
- Mass deletions: `d1e60e40` docs/archive 1,866 files / 28 MB / 43% of tracked files (08-02);
  `3b5035d7` 31 openspec proposals retired, 929→238 files (08-02); `8d3e57ce` 38 scripts no caller;
  `f3f53cb7`, `902e5ec4`. Retraction genre: `72f58abc` (operational doc asserts what should be
  derived), `3c113703` ("I wrote measurements into docs — the defect in a new costume"), `047e11c5`
  FAILURE_MODES.md is a schema not a census (execution_error 93.5% not in union), `d63eb56e`
  RUNTIME_ACTIVITY_TRACING written-not-wired (0 of ~97k rows), `82d19398` observe-detect-resolve
  specified-not-implemented (9/10 shapes absent), `c7530bf2` rhythm mechanism asserted that did not
  exist. README/setup: ~15 commits 08-19→09-23 ending with `d043bde5` single setup page.
- **Regrowth after pruning**: openspec/changes now has 115 dated change dirs + 10 named (plus ~50
  autonomous residue files) vs 79 active after `3b5035d7`; `eb2b8fcf` reviewed 97 active specs.

### codebase-bloat-fossils
- **~4,400 of 6,667 tracked files at HEAD were added by autonomous "drift commits"**:
  `4e4170a8` 2,042 still at HEAD (1,120 validation/failure-modes, 208 validation/scripts compiled
  .js/.d.ts/.map, 148 scripts/substrate, 140 packages/interaction-conformance, 132 human-surface-vessel,
  79 openspec/changes); `13c5d466` 1,848 (1,785 failure-modes, 61 Substrate/Projects, run_scan.js,
  mitosis-applied-host-sync.jsonl); `796fac89` 253; `3142f140` 188; `6ced94dc` 71; `edc68d49` 7.
  validation/failure-modes = 3,342 tracked files (2,275 scenarios, 1,046 vessel-scenarios).
  validation/scripts: 291 tracked, 220 compiled artifacts.
- Root-level residue still at HEAD (outside the placement hook's ALLOWED_TOPLEVEL_DIRS):
  `Substrate/` (68 files, first 09-07), `history.txt`, `leases/` (2), `mitosis-applied-host-sync.jsonl`,
  `run_scan.js` — all Substrate Autonomous. `d993b331` (09-23) removed 191 root files and installed
  the hook in-container "so new launches reject new root files"; these five survived it.
- openspec/changes residue: 6 near-duplicate http-response resolvers (`http-response-resolver.ts`,
  `httpResponse.ts`, `http-response-camel.ts`, `new-http-response-resolver.ts`,
  `new-simple-http-response-resolver.ts`, `fix-http-response-resolver.ts`, each with .js/.d.ts/.map),
  `gap-msvqgv4y-*.json`, `route-edit-9077062c-*.json`, `add-goal-summary-*.json`.
- validation/scripts: ~58 non-compiled scripts untouched since 07-01 (May–June harnesses:
  thompson-compare, reuse-harness, progression-driver, substrate-narrator, …); the CLAUDE.md-named
  failure-mode harness has one commit in window (`e1306767`, 08-28, "report its own coverage
  instead of dying"). July–Aug harnesses touched 1–4 times then abandoned: eval-ablation (07-26),
  eval-composition (07-26), falsification (07-27), validatability (07-28), reach-generalization
  (08-07), complexity-ladder (08-12), conditioned-differentiation (08-12), goal-expectation (08-25),
  self-dev-reliability (08-26). Per CLAUDE.md script-retention law these are unobserved.
- Operator side also duplicated: `63b48175` runtime-drift watchdog duplicated pull-sync's repair
  (grep that justified it ended in `| head -15`) → `bb217e5e` default OFF; `9aa0b085` duplicate
  drop-in → `6b238b63`; `da76f061` surgical scan duplicated existing gaps + trace oracle →
  `807b92ef`; `70254535` vs `daa2632c` (one hardcoded binding 08-25→09-27).

### dormant-mechanism
- `daa2632c` joint-liveness detector: one binding (`decision_outcome`) 08-25→09-27, caught none of
  ~180 Aug–Sep breaks; `70254535` (09-27) made joints pool records, 6/6 checked, 3 severed found.
- `676cb859` regression detector: 0/132 completions (R3). `b2ff657b`: self-recovery timer dead 5
  days (relative-only schedule). `d0a3472f`→`60269b91`→`ad6ee8f5`: ablation lever "never fired"
  claim retracted then repaired, observable for first time 09-05. `8caad7d7`: deterministic edit
  path exists and has never fired (09-06). `164aab0e`: pass-regression un-latch cannot fire.
  `5a2074f7`: three detectors each correct, none can act. `82d19398`: detect-without-remediate is
  structural (no resolution channel). `cb58a473` (09-27): "self-correction mechanisms built, then
  decayed undetected". `947c8729`: lifecycle scan dormant on real store a day.
- Harnesses 07-26→08-26 (list above) touched ≤4 times.

---

## 2. Mechanisms (keep / fossil / duplicate)

| Mechanism | Location | General? | Status | Evidence |
|---|---|---|---|---|
| substrate-pull-sync (+ mirror-to-live) | scripts/substrate/pull-sync, mirror-to-live | general (the only deploy path) | live-used, brittle | 73 commits; R1–R3; `0a62b058` "the ONLY path by which committed code reaches the running fleet" |
| pull-sync test gate (delta by failing-name set) | pull-sync | general | live-used, repeatedly dead | R3; dead 08-31→09-28 (b7dab713) |
| content_hash fingerprint | pull-sync | general | live-used | R1, 3 extensions, list-based (will fall behind again) |
| restart deferral by in-flight age | pull-sync `85bc103c`/`fd3d6871` | general | live-used | R2 |
| self-recovery ladder / immune tick | scripts/substrate self-recovery-tick.sh | general | live-used, bounded 09-16 | R4; `ad9da780`; `8e935b13` in-tree revert rung |
| db_under_pressure probe | self-recovery | specific | live-used (3rd form) | `fc143654`→`0b3f70b2`→`337c3b81` |
| runtime-drift watchdog | `63b48175` | specific | duplicate (repair OFF, `bb217e5e`); warning-only reader `251a6b4d` | |
| joint-liveness detector / jointBinding pool records | scripts/substrate/joint-liveness-tick.ts | general | dormant 08-25→09-27; live-used after `70254535` | 1 binding → 6 |
| identical-failure invariant | `a172e235` | general | unknown (no later evidence in window) | |
| federation oracle / verification sweep | libp2p-federation-transport probe | specific-to-federation, shaped | live-used, self-sabotaging instances fixed | ~25 commits 09-11→09-15 |
| phantom-reservation watchdog | fed-transport | specific | live but manufactured outages until `3dbbbeff` | R14 |
| relay keep-alive ping | relay | specific | worked after re-land `cfad41db` | |
| discovery-client loopback repair (shared) | `4fdf5b91` | general | live-used | previously in 1 consumer |
| gen-env / .substrate-secrets persistence | scripts/substrate/gen-env.sh, secrets.env.sh | bootstrap tier | live-used, recurring defects | R6 |
| vessel-ctl single management surface | `008f3ab9` | general | live-used | replaced ~40 make targets |
| launch manifest / one role derivation / image readiness | `e375d716`, `d8fed96f`, `76d548d1` | general | live-used (09-23) | install acceptance CI `fa7e9189` |
| placement pre-commit hook | scripts/git-hooks/pre-commit | general | live but leaky (5 root residues at HEAD) | `d993b331` |
| bump-submodules CI + nightly dev build | .github | general | live-used (216 bot commits) | `851c4725`, `330da78c` |
| validate-build (git reproducibility) | `7481a497` | general | unknown | `17973efc` false alarm on shallow |
| substrate-doctor / readiness | `c8ffbae5` et seq. | general | live, had false results (`0baff728`, `26ae3d94`, `1d3785de` "un-vacuum check 6") | |
| autonomous drift-commit ("vessel-code-commit-and-push") | rhythm family "self-maintenance" goal text, repos/development-vessel/src/resolvers/rhythm-conductor-tick.ts:126 (a walked goal, not a coded committer; it wrote the super-repo) | general but harmful | **fossil-generator / broken**: ~4,400 residue files, truncation in git, blocked ff | R10, R16 |
| autonomy-status / performance-status scripts | scripts | specific | fossil candidates (read frozen table until `3c1bf965`) | |
| composition-edge-reconcile | scripts | specific | live-used? read frozen table 42 days | `3c1bf965` |
| ribosome extraction / minting | ias-executor / activity-api | general | broken repeatedly | R9 |
| selection posterior tiers | goal-host / activity-api | general | partial (R8) | |
| change-window lease / autonomous_pick lease / named trace_store lease | resumable-landings | general | live-used | `e3768a74`, `38508fad` |
| spend envelope + autonomyScope | value-per-cost / contained-self-development | general | live-used | 09-26/27 |
| deterministic exact-edit application (2.7) | development-vessel | general | live-used, worked | `b1ab1f9b`, `11a655c8` |
| failure memory keyed by goal_hash | goal-host 9e23455/cf8fd87 | general | live-used | `f9033212`, `27815bb3` |
| recursion guard on /resolve | goal-host | specific | worked (operator-landed) | `b192b726` |
| session-start memory hook | .claude/hooks/substrate-session-start.sh | operator-side | live-used | `118d341f`, `62559ca6` |
| harness family (ablation, composition, validatability, falsification, reach-generalization, complexity-ladder, stage-harness, goal-expectation, self-dev-reliability, learning-loop-selftest, failure-mode) | validation/scripts | specific instruments | mostly dormant/fossil (≤4 commits, none after 08-28 except selftest) | script-retention law |
| failure-modes scenario corpus | validation/failure-modes (3,342 files) | specific | residue (autonomous-added) | R10 |

---

## 3. Principles stated in commit bodies (with location)

- "A marker recording a git sha can lie about a tree it doesn't describe" — compare content (`596fd717`).
- "A loud failure nobody queries is a silent one" (`4e79dd76`).
- "Repeating a deterministic failure is not persistence, it is a refusal to conclude" (`ad9da780`).
- "A check cannot be scheduled by the mechanism it recovers" — bootstrap-tier exception (`b2ff657b`).
- "The cap did not prevent an OOM; the cap WAS the OOM"; measure the machine you deploy to (`9df01220`).
- "A green check on the working tree says nothing about what was committed" (`e92d2e1b`).
- "QUERYING A MASKED UNIT RETURNS DEFAULTS, NOT ITS SETTINGS" (`e2ba1a69`).
- "A close must close something" — close rates are inflatable in the flattering direction (`015b31fa`).
- "Everything must be available over the p2p connection … anything bespoke HTTP is unavailable to a federated peer by construction" (`3b4f921a`).
- "A document that asserts operational structure is a cache that keeps answering after it stops being true" (`72f58abc`); "writing measurements into docs is the defect in a new costume" (`3c113703`).
- "Advertised is a claim, demonstrated is a fact" (`d4b7421e`).
- "A configuration mistake is the one class this system cannot self-correct" (`28f78545`).
- "Fixes are site-scoped and validated once; nothing re-checks the class" (`bd1fb6d9`, 09-28).
- "Every change is validated locally and once … humans are the detector" (WHY-THINGS-KEEP-BREAKING via `2ca586ba`).
- "Not deduplication … collapsing N identical failures would make recurrence invisible" (`a172e235`).
- "A fix present in the repo and in the build but absent from behavior is a propagation question, not a logic question" (`33924f92`).
- "Script retention: basename grep is not sufficient in either direction" (`8d3e57ce`); the watchdog duplicate came from `| head -15` (`bb217e5e`).
- "The oracle lived in the workspace it measures" — instruments must live outside the subject (`e4fe46d1`).
- "Law 7 measures gap CLOSE RATE" — closure writes must restate category/source; the store re-derives omitted fields (`3a5387c2`).
- "Pre-register the falsifier / criteria before dispatching" (`efad388f`, `a5723cef` E1 VOID, `837cfe0e`).

---

## 4. What to keep (from this shard's evidence)

Keep and consolidate: pull-sync (make its file coverage derived from what mirror-to-live copies,
not a list); joint-liveness as pool-registered joints (70254535) as the class-level checker;
leases + spend envelope + autonomyScope; deterministic exact-edit (2.7); failure memory;
vessel-ctl + launch manifest; shared discovery-client loopback repair; relay keep-alive.

Retire / quarantine: the autonomous super-repo drift-commit path (or scope it to repos/ only
with the placement hook enforced in-container); the ~4,400 residue files (validation/failure-modes,
compiled .js/.d.ts/.map in validation/scripts, scripts/substrate, packages, openspec/changes
http-response variants, root `Substrate/ history.txt leases/ run_scan.js
mitosis-applied-host-sync.jsonl`); runtime-drift watchdog repair branch; the harness family not
invoked by any activity (script-retention law).

Open questions for cross-shard verification: 30s shell kill "closed" 08-15 (`0c8705cd`) vs memory
index "post-land suite dead 08-31→09-28 shell 30s default, fixed 5e9a0b2" — suspected recurrence of
the same class in a vessel; verify in the vessel-git shard.
