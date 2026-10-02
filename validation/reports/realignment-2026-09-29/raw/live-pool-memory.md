# Live pool + memory + concept-db — realignment raw notes (shard: live-pool-memory)

Measured 2026-09-29 ~04:00 UTC, read-only. Node 1 = `substrate-live` (hub, standalone), node 2 = `compose2-live` (PROFILE=compute).
Files were copied out with `docker cp` and parsed on the host (containers have no python3). Nothing was written to any live store.

## Coverage

- **Memory:** every `notes.json` on both nodes plus the three `.bak` files on node 1 (`/workspace/memory/notes.json`, `/workspace/git/super-repo/memory/{notes.json, *.bak, t2-rev-*, orphaned_capabilities_scan_summary.md}`, node 2 `/workspace/git/super-repo/memory/notes.json`). The resolver source is `development-vessel/src/resolvers/memory-note.ts`, read from the live clone. The development-vessel journal was searched from 09-25 13:10, which is where journald retention starts, through 09-26 05:13. One live read went through node 2's memory resolver.
- **Pool:** `pool/standing.json` on both nodes, read from disk. Node 1 also has 21 orphaned `standing.json.tmp.*` snapshots. I parsed four of them and three were unparseable. `drain-log.jsonl` was aggregated in full on both nodes. `watchdog-log.jsonl` was aggregated on node 1. `discarded-landings.*` were read at the tail only. I replayed boredom's two read requests against node 1's `:8090` once each.
- **Runtime state files:** `policies/`, `state/` and `leases/` on both nodes.
- **Concept-db:** SQL counts and group-bys on `concept` and `concept_usage` (ns activity-system, db learning_loop). I listed the 57 compose_lesson concepts.
- **Not read:** the contents of node 1's `gaps/` (118 MB; another shard covers it), `/workspace/trace-spool`, `concept_edge` beyond a count, `mitosis-applied.jsonl` (704 KB), and node 2's watchdog log beyond its size. The remaining 17 tmp snapshots were not parsed.

---

## Assets to keep available (recoverable knowledge)

| Asset | Where (node 1) | Contents | Status |
|---|---|---|---|
| **Pre-wipe memory store** | `/workspace/git/super-repo/memory/notes.json.pre-op-retire.1790140094.bak` (09-23 05:08 UTC, 4.16 MB) | 1788 notes, dated 2026-05-27 to 09-23. 604 are battery residue (trendcheck-/expectation:/parity-). **1184 are knowledge notes: 518 reference, 295 finding, 281 project, 90 feedback.** By month: May 1, Jun 369, Jul 305, Aug 167, Sep 342. | Nothing reads it. It is the **only complete copy** of the system's pre-09-26 memory. |
| Pre-residue-cleanup bak | `…/notes.json.pre-residue-cleanup.1790138390.bak` (09-23 04:39) | 1780 notes | Superseded by the file above. |
| Pre-merge bak | `…/notes.json.pre-merge.1790118911018.bak` (09-22 23:15) | 1077 notes dated 08-17 to 09-22, 578 of them battery | This is the super-repo store as it stood before the 09-22 merge. |
| **May–July store** | `/workspace/memory/notes.json` (mtime 09-07, 3.1 MB) | 680 notes dated 05-27 to 07-23: 287 finding, 264 project, 87 feedback, 40 reference | Unread since 07-25, when the unit/env WORKSPACE_ROOT fork happened. 676 of its ids were merged into the 09-23 bak, so it is a duplicate of that subset. |
| Operator cache | `~/.claude/projects/-home-avi-documents-work-substrate/memory/` | 750 files: 592 reference, 85 feedback, 70 project | Derived cache (law 10). It is now far larger than the authoritative store. |
| Concept graph | SurrealDB `concept` | 88,545 concepts across 1,517 shapes, with 22,365 edges | Live. See the concept-db section below. |

**Recommendation for the realignment:** the 1184 knowledge notes in the 09-23 bak, together with the operator cache, are the "fossils to organize". They exist on disk today, but no recall path can reach them.

---

## Problems and attempts by problem-class key

### memory-recall — 3 recurrences, and each fix's output was destroyed by the next event

**The timeline, from measured sizes:**
1. **07-25:** the unit sets `Environment=WORKSPACE_ROOT=/workspace` but `/etc/substrate/env` sets `/workspace/git/super-repo`, and EnvironmentFile wins. The vessel switched stores silently, leaving 680 notes unread at `/workspace/memory/notes.json`. This was found on 09-22 (operator note `reference-two-memory-stores-…-2026-09-22`). The live unit still carries **both** settings today: `Environment=WORKSPACE_ROOT=/workspace` alongside `EnvironmentFile=/etc/substrate/env` holding the super-repo path. The process env today is `/workspace/git/super-repo`. The ambiguity has not been removed.
2. **09-22:** battery flood. 578 of 1077 notes (54%) were trendcheck-/expectation: probe notes that nothing retired. Recall returns the newest N by `updated_at`, so the probes displaced the conventions ("amnesia by displacement").
   - Attempt: merge the two stores at file level into 1788 notes (09-22 23:15). Outcome: **reverted**, because its output was wiped on 09-26.
   - Attempt: retire primitive `b5ed109`/`19ae84e` (Substrate Autonomous; 6/6 behavioral falsifier). Outcome: **worked** as a primitive, but became moot after the wipe.
   - Attempt: retire 552 battery notes by operator loop (1788 to 1236, 09-23 05:08). Outcome: worked, then wiped.
   - Attempt: gap 2 "the checker retires its probe notes", landed as `d4171b1`. Outcome: **failed**. It posted a bare `{type,note}` body, `/v2/impulses/resolve` answered 400, and the call was a silent no-op (a hollow write).
3. **09-26 05:11:20–05:12:02 UTC: TOTAL WIPE of node 1's authoritative store, from about 1236 notes to 0.**
   - Evidence: the journal shows `memoryNote_write` calls at 05:11:20 whose notes are absent from the store. The oldest surviving note is `trendcheck-product-muhxb3tx-0` at 05:12:02. Only 4 of the 59 live ids also appear in the 09-23 bak, and those were rewritten after the wipe.
   - Context: development-vessel was being restarted by mitosis cutovers at 04:30, 04:37, 04:48 and 05:04, each logged as `restart … was LOSSY`. A compose, `fc-muhxlif8-xnsvna`, started its env-baseline test run at 05:10:37–05:10:41. Compose test runs were not scrubbed until `f451e42` on 09-29. The container restart was later, at 09-26 07:43 UTC, so it is **not** the cause.
   - **Cause: UNVERIFIED.** `memory-note.ts` has two candidate mechanisms and no journal line evidences either one:
     - (a) `loadNotes()` catches every error, including a JSON parse failure, and returns `[]`. The next `saveNotes()` then persists `[]` plus one note, so a single failed read becomes a total wipe.
     - (b) All writers, including separate processes such as test runs that inherit `WORKSPACE_ROOT`, share one fixed `notes.json.tmp` path. Concurrent writes can tear the file. Four writes landed in the same second at 05:02:31, and the store was about 4 MB.
     - Corroboration of class only: the pool writer on the same node left 21 orphaned `standing.json.tmp.*` files, and 3 of the 4 I parsed are torn ("Invalid control character"). Torn writes do happen in this process family.
4. **Today:** the node-1 store holds 59 notes, the oldest dated 09-26 05:12. They break down as 29 battery, 15 "Investigation of Slow Queries" LLM notes for one gap, 7 operator mirrors, and 8 others (including a note titled `{{goal.title}}`). Recall by topic returns the newest notes regardless of topic (CHECKINS 09-29 03:15).
   - Attempt: need-level dispatch `879c4bc6`, which asked the system to recover its own memory. Outcome: **failed**. Target inference found no shape for "memory"/"recall", with confidence 0 (see goal-walk-floor).
   - Attempt: `5dc8ab8`, which reads WORKSPACE_ROOT at use time because the unit test was poisoning the real store. Outcome: **worked** for test self-poisoning. It left the single shared tmp path and the swallow-to-`[]` untouched.
   - Attempt: `7761f47` (an empty write blanked a note) and `9790c2f` (tolerant intake). Outcome: worked, but narrow.
   - Attempt: `dac3c2c` (09-23, numeric body rejected). One line. Outcome unknown.
- **Root cause (class):** memory is a flat JSON file with an env-derived path, a newest-N recall, no durability (no append log, no fail-closed read), and one store per node. Each incident was fixed at the instance (merge, retire, test isolation), and the storage primitive's own fragility was never addressed.

### node-locality — memory, rhythms, policies and bindings all fork per node

- **Memory fork:** node 2 runs its own development-vessel (`development-vessel-compose2`) that serves `memoryNote` from a local store of **3 notes**, all dated 09-26. Node 2's `expectation-scan-heartbeat` note has the same id as node 1's but different content. A memory write or recall on node 2 never reaches node 1's store.
- **Rhythm posteriors diverged:**
  - gap-closing: node 1 α67/β23 after the operator rebaseline of 09-27 03:32; node 2 α755.5/β2 (never rebaselined).
  - project-intake: node 1 budget 1.5 with `operator_pause`; node 2 budget 0.2, α40/β5.5, no pause.
  - self-maintenance: node 1 α1/β5; node 2 α9.5/β3.5.
  - The operator's containment and rebaseline were applied to node 1 only.
- **jointBinding:** 5 records, node 1 only (operator:claude-avi, 09-28 06:11). Node 2 has none.
- **LLM model policy:** node 1 `policies/llm-model-policy.json` is at rev 25; node 2 is at rev 9. Arm posteriors are learned per node.
- **Policy files missing on node 2:** `extractionPolicy.json` (maxExtractionDepth 7), `pathwayReusePolicy.json` (min 3/5), `walk-budget.json` (max_iters 8) and `lesson-execution-policy.json` do not exist there, so node 2 runs on code defaults.
- **Gap store:** node 2's `gaps/gaps.json` was last written 09-26 12:07 and holds 70 test-fixture rows (per CHECKINS 09-29 01:35). Node 2's boredom dispatched `gap-lifecycle-tick` 22 times a day against it.
- **Pool contents differ:** node 1 has no federation records. Node 2 has 288 `federationProbeVerdict` plus 18 each of canary, report and roster.

### write-read-mismatch

- **boredomSelectionSnapshot is hollow (CONFIRMED).** The "Law 5 observability" writer (`boredom-vessel/src/index.ts:57-115`) reads `gapBody.total ?? gapBody.gaps` and `rhythmBody.items ?? rhythmBody.results` at the top level. The dev-vessel response nests the data under `.body.gaps` and `.body.impulses`, which I confirmed by replaying both requests. The gap query also sends `limit:1`. As a result, **all 1191 (node 1) and 614 (node 2) snapshots record `open_gap_count: 0` and `rhythms_consulted: []`**, while the gap store holds hundreds of open gaps. The actual scorer at `index.ts:2549-2616` reads `rh.body.impulses` correctly. The bug is two readers of the same seam with divergent envelopes, so the observability record lies and selection does not. The last commit on the file is `f28bc06` (09-27, a substrate route-edit).
- **`operator_pause` has no reader.** The field's own text, on the project-intake rhythm, says: "operator_pause is recorded for provenance (no reader today)". Containment actually works through `budget>1` being unaffordable.
- **The envelope inconsistency is still live.** `[resolve] bare pointer body accepted (deprecated form) type=memoryNote_write` repeats throughout the 09-26 journal. It is the same inconsistency that taught the drafter the wrong shape in `d4171b1` (09-22).
- **compose_lesson `times_succeeded` is 0 on all 57 lessons.** 42 of them have `times_loaded>0`, including 85, 45 and 28. By contrast, 23,222 concepts overall have `times_succeeded>0`. Lesson efficacy is never credited. PLAUSIBLE; I did not trace which writer increments it.
- `concept_usage` has 3,726 rows, all from September: 3,586 neutral, 76 success, 64 failure. Usage grading carries almost no signal.

### stale-whole-rewrite (new key: a lost-update from rewriting a whole record or file off a stale or failed read; none of the seed keys fits, since this is a storage-primitive class that spans shapes)

- `329fc5c` (development-vessel, Substrate Autonomous, 09-26 16:51) was the fix for gap `rhythm-reality-sync-rewrites-the-whole-rhythm-body-from-a-stale-read-so-concurrent-alpha-beta-settlements-are-lost-narrowed`. After it landed, its "staleness-only sync writes" **wiped the 09-26 containment** (project-intake budget 1.5 and its pause). The rhythm-seed tick then re-seeded defaults (budget 0.2, α38.5/β1), and project-intake drove the "05:26 recursion storm". The operator re-contained it at 09-27 03:03 and restored values from `rebaseline-snapshot-20260926T092807Z.json`. That snapshot file no longer exists under `/workspace` (maxdepth 4). See also autonomous-regression.
- The memory store wipe (whole-array save after a `[]` load; UNVERIFIED mechanism) is a second instance.
- The gap store "carries forward omitted keys" (operator MEMORY 09-23) is a third.
- The torn pool tmp snapshots show the atomic-write pattern breaking in practice.

### autonomous-regression

- `329fc5c` (above): an autonomous fix for a lost-update caused a lost-update of the operator's containment.
- The self-maintenance rhythm is on **hold** (node 1 and node 2, user-approved 09-28 14:53). Its detect-drift → commit-and-push goal committed 422 `.bun/install/cache` binaries plus `gaps/gaps.json` and `state/learning-mode-state.json` into development-vessel (`9d839e0`, 09-28 11:26). The hold notes the same family as `4e4170a8` (09-07), so it recurs. The lift condition is "the commit step stages only src/".
- `autonomyScope` ledger: "Since the 06:08 widening, 8 autonomous landings: 1 improvement, the rest hollow or wrong-then-undone, none measurable by the system" (09-28 23:30Z). `a198907` was a hollow, env-gated constant read only by a log, and the sweep closed it as verified.

### calibration-seal / spend-envelope-throughput — containment oscillation recorded in one field

The `autonomyScope` pool record (node 1 injected 09-27 08:43, node 2 08:50, both from operator:claude-avi) keeps its whole history in `reason`:
- 09-27: stage 1. Autonomous work may not land on what lands, verifies, grades or constrains autonomy. 09:15Z: admission requires a class1/class2 falsifier. 13:10Z: auto-revert inputs excluded. 13:15Z: self-fact-reconcile excluded. 22:36Z: vessel-mitosis-evaluate excluded, because an autonomous compose targeted it with a literal-only class1. **23:45Z: class1 dropped** after `a198907` was hollow.
- **09-28 05:55Z: widened to every class.** The earlier rules had cut admission from about 250 to about 17, and then to 2–5.
- **09-28 23:30Z: re-tightened to [class1, class2]**, because of the 8 landings and 1 improvement cited above.
- `excluded_paths` lists 27 paths, covering the whole landing, verification and selection core (feature-compose, mitosis-cutover/evaluate, gap-to-feature, substrate-gap, pool-impulse, goal-host index, posterior-update, boredom index, discovery, identity, scripts/substrate, and others).
- `spendEnvelope`: $2/h. Paused at 09-27 13:00 after 3 autonomous landings that the operator refuted, then reopened. CHECKINS 09-29 00:35 records node 1's envelope exhausted from 23:34 to 00:28 (85 refusals), with operator directed landings drawing from the same $2/h. "Not built: automatic revert."
- This is the circulating pattern the user named: admission is widened for supply, then tightened for quality, twice in 48 hours, with no machine-measurable criterion deciding between the two.

### narrowing-duplicates / gap-content — the redispatch livelock is current

- `drain-log.jsonl` on node 1 is 180 MB, 1,086,379 lines, dated 08-16 to 09-29. Since 09-22 it records 2,256 `dispatched` actions, and **2,248 of them (99.6%) went to 3 gaps**:
  - `trace-store-reconcile-2026-09-24T11`: 1,168
  - `db_performance_slow_queries_2026-09-18T16`: 790
  - `trace-store-reconcile-2026-09-23T04`: 290
- Daily dispatches on node 1 for `trace-store-reconcile-…T11`: 09-25 104, 09-26 132, 09-27 146, **09-28 767**, 09-29 18 (partial day). For `db_performance…`: 09-20 95, 09-21 123, 09-27 **359**, 09-28 134, 09-29 24.
- Node 2 (1,028 dispatches in total) dispatches the same two gaps: 09-28 had 550 and 88.
- Also since 09-22: 246,254 `compose_skipped_cooldown` and 180,114 `compose_skipped_inflight` actions.
- Attempt: `remedy-livelock-db-performance-slow-queries-2026-09-18T16-2026-09-25` and `remedy-livelock-trace-store-reconcile-2026-09-23T04-2026-09-25`, both filed 09-25 and dispatched 4 times each. Outcome: **failed**. The livelock went on and peaked on 09-28.
- Measurement note: CHECKINS 09-29 00:15 says the ~970-call **decompose** loop is not current. That was a different measurement, of decomposition calls. The **gap_to_feature dispatch** livelock on the same gaps was current through 09-29, at a lower rate.
- `db_performance_slow_queries_2026-09-18T16` is re-detected every tick (`detected_at 2026-09-29T03:58:44`, slow_queries 5226, `falsifier: none`). It has been open for 11 days, and each dispatch writes another LLM "Investigation of Slow Queries" memory note: 15 are in the 59-note live store.
- The pool's `substrateGap` records on node 1 number 1,152 (393 open, 759 retired). Most-repeated families: `goal-target-inference-rewrote-a-repo-relative-path…` ×5 (+3 recommit-), `seven-more-resolve-url-sites…` ×3 (+3 recommit-), `trace-outcome-inconsistency-variantPromoteResult…` ×3, `the-trace-sink-spools-rejected-traces-to-disk-and-nothing-ever-replays` ×2, and `trace-persistence-and-retention-are-steered-by-environment-variables` ×2.

### dormant-mechanism — detectors that fire while nothing changes

- **Gap-compose watchdog:** node 1's `watchdog-log.jsonl` has 5,097 rows from 08-18 to 09-29: gap-compose watchdog_restart 3,339, funnel-drain 892, deferred_lease_held 732, operator-goal-generator 96, compose-teacher 15. Since 09-28, `stalled_min` ranges from 20 to 241 across 711 rows. The latest rows (09-29 03:51 and 03:58) show `open_intents:383` with stalled_min 202 then 210. The restart reports `ok:true` and the stall continues.
- **expectation-scan-heartbeat** reads `{"checked":0,"violations_found":0}` on both nodes, every minute. It is a scan that checks nothing.
- `discardedLandingReport` on node 1 reports total 0 every hour (704 rows). I did not investigate whether 0 is true.
- Leases: `leases/maintenance.json` (trace-store-reconcile) expired 09-25 00:02, and `maintenance-autonomous_pick.json` (operator-compose-ownership-hold) expired 09-26 14:49. The expired lease files remain on disk.

### goal-walk-floor

- Need `879c4bc6` (09-29 03:15) described a memory capability without naming a component. Target inference returned **no target shapes (confidence 0)**. The walk ran pool leftovers (`learned-summarize-and-emit-concept`, a multitask test activity, two June-era gap-closing activities), then ended HOLLOW with an unfilled `{{cwd}}`. The feedback retry repeated with different leftovers. The ReAct floor did not engage (CHECKINS 09-29 03:35).
- Contrast: need `9d5ed75c` named "the gap-lifecycle scan" and routed correctly.

### hollow-landing / false-verification (live-store evidence)

- Battery walks satisfy `memoryNote_write` counterfeitly by writing **files named after the shape** into the super-repo root: `memoryNote` (09-24), `memoryNote-trendcheck-product-muhx0tes-1.txt` (09-26), `memoryNote:trendcheck-product-mudflqdz-0` (09-23), and `memoryNote_trendcheck-product-mugnm89b-0.txt` (09-25, 0 bytes). The same root holds `known-answer.txt`, `known_answer.txt`, `test_file.txt`, `test_output.txt`, `temp_json_generator.js`, `process_project.js`, `run_scan.js`, `run_trace_scan.js`, `substrate-node.zip` (9 bytes) and `selftest_output.log`, all from 09-20 to 09-26: residue from shellResult satisfiers.
- 12 pool records on node 1 are schema echoes: `shape:""` with `body:null`, or `id:"string"` with `body:"object"` (09-27 02:53–02:55).
- Template placeholders leak into data. There is a memory note titled `{{goal.title}}` (node 1, 09-26 06:11). A note in the 09-23 bak has `created_at` of `{{now}}`. On node 2, files named `{{out_path}}` and `{{target_path}}` sit in the super-repo root.

### test-residue-live-state

- `memory/t2-rev-a` and `t2-rev-c` (09-18) are test-revision residue in the live memory dir.
- The 09-23 bak contains 18 `t2*` and 17 `probe*` notes.
- The concept store holds shape `test` concepts, a lesson titled "PROBE do not use" (compose_lesson, 08-31), and 13 concepts with source_type `operator_write_probe`.
- The memory-note unit test wrote to the real store until `5dc8ab8` (see memory-recall). Compose test runs inherited live endpoints until `f451e42` (09-29).

### codebase-bloat-fossils (live runtime side)

- `pool/`: 21 orphaned `standing.json.tmp.*` files from 08-29 to 09-24, about 100 MB, never cleaned. `drain-log.jsonl` is 180 MB and unbounded; about 80% of its lines since 09-22 are `compose_skipped_*`. Node 2's drain log is 25 MB.
- 1,191 (node 1) and 614 (node 2) boredomSelectionSnapshot records are never retired, and they are hollow (see above). They make up 50% and 59% of the standing pools.
- `boredom-vessel/src/` contains compiled `index.js`, `index.d.ts` and `.map` files beside `index.ts`, and both the `.js` and `.ts` carry the snapshot bug.
- `memory/orphaned_capabilities_scan_summary.md` (08-22) is a report file in the memory dir.
- The super-repo root holds 30+ residue files (listed under hollow-landing).

### sync-deploy-drift

- `50830bec` (operator, 09-28, untracking `state/learning-mode-state.json`) deleted that file in node 1's clone on pull. The runtime recreated it fresh, which **reset learning-mode state** (CHECKINS 09-29 03:15, law-12 note). Today's file reads mode `develop`, driver `frontier(6 necessary-but-unavailable; top=promotedConcept)`.
- The node 1 pool's oldest `injected_at` is 09-27 01:06, and all 12 rhythms share the same timestamp, consistent with the re-seed after `329fc5c`. `pool-impulse.ts` has no retention or compaction rule that I could find by grep. The 09-22 tmp snapshot held 9,582 records (5,144 substrateGap, 2,439 boredom snapshots, 1,727 federationProbeVerdict). **Why the 09-22 through 09-26 records are absent is unexplained**; it could be a retention elsewhere or a rewrite.

### env-gating

- The memory store path is env-derived (`WORKSPACE_ROOT`), and the unit and env file disagree on it (see memory-recall).
- `BOREDOM_DISPATCHER_EXPLORATION_RATE` is read from env (`boredom-vessel/src/index.ts:40`).
- The 27 `SUBSTRATE_PUSH_VESSELS` entries and `COMPOSE_MAX_CONCURRENT=3` sit in the unit file.
- `policies/*.json` are runtime files, not pool shapes. `walk-budget.json` and `pathwayReusePolicy.json` were last written in August and do not exist on node 2 (see node-locality).

---

## Concept-db (high level)

- **88,545 concepts across 1,517 distinct shapes, with 22,365 concept_edge rows.** By month of creation: Jun 4,436, Jul 46,635, Aug 13,826, Sep 23,648. From 09-15 onward, between 131 and 2,621 are created per day.
- Top shapes: source_code 39,369, mechanismHealthFinding 7,149, problem_detection 5,860, unknown 3,714, goal_host_behavior 3,134, error_log 2,841, code_quality 2,460, docSection 1,276, reach_gate_lesson 1,032, failure_mode_taxonomy 1,007, architecturePrinciple 719, surrealdb_gotcha 582, user_preference 326, verification_gate_blindspot 300.
- Since 09-22 only 23 shapes are active. source_code (6,462), problem_detection (1,834) and error_log (1,262) make up about 90% of new concepts, which is machine-extracted volume rather than lessons.
- By source_type: impulse_signature 76,794, extracted 6,515, doc_expectation 1,887, goal_finding 685, recurring_code_problem 642, reach_gate_lesson 270, memoryNote 75 (mostly 08-31 orphaned-capability notes, plus a character-per-line exploded SurrealDB error string), human_input 68, compose_lesson 45.
- 53,497 concepts have been loaded at least once, and 23,222 have succeeded at least once.
- **compose_lessons (57 records whose shape or source_type is compose_lesson):** Jul 30, Aug 6, Sep 21. The class-grain lessons are heavily duplicated:
  - anchor_not_found: at least 5 variants (08-26, 08-31, 09-10, 09-15, 09-23)
  - syntax_break: 3 variants
  - typecheck_dangling_reference: 3 variants
  - hollow_write: 2 duplicates (09-15)
  - semantic_reject: 2 variants
  - Empty boilerplate: "avoid repeating this failure class" for compose_execution_failure, env_change_window_held, scope_refused ×2 and park_stale.
  - None of the 57 has a success credit.
- The concept graph stores many copies of each lesson and has no feedback loop saying which lesson helps.

---

## Mechanisms (live)

| Mechanism | Location | General / specific | Status | Evidence |
|---|---|---|---|---|
| memoryNote store (flat JSON, newest-N recall, swallow-to-[] load, shared tmp) | dev-vessel `src/resolvers/memory-note.ts` | general seam | **broken** | wiped 09-26; 59 notes; topic recall ignores topic; per-node |
| memory retire primitive (`retire:true` by id) | memory-note.ts:166-190 (`19ae84e`) | general | live-used | 552 retired 09-23 |
| session-hook memory mirror (operator file → memoryNote_write) | .claude hooks | general | live-used | 8 operator files since 09-26 and 7 operator-mirror notes live |
| timeShapedRhythm pool records + boredom due-score scorer | pool + boredom `index.ts:2549-2616` | general | live-used, but posteriors fork per node | node 1 and node 2 α/β diverge |
| rhythm-reality-sync | dev-vessel `rhythm-reality-sync.ts` | general | **broken** (`329fc5c` wiped containment) | pool rebaseline notes |
| boredomSelectionSnapshot (law-5 observability) | boredom `index.ts:57-115` | specific | **broken / hollow** | 1,805 snapshots all 0/[] |
| autonomyScope (excluded_paths, require_falsifier_classes) | pool shape; operator-authored | general | live-used, oscillating | reason ledger |
| spendEnvelope ($/h cap, pause) | pool shape | general | live-used | 85 refusals 09-28 23:34–00:28 |
| jointBinding (severed-joint detectors: sql_newest, gap_count, discovery_registered, discovery_health) | pool shape, node 1 only | general | live-used on node 1, **missing on node 2** | 5 records; boredom selects `gap-goal:severed-joint-*` 9 times |
| operator_pause on a rhythm | pool body field | specific | fossil (no reader, self-declared) | rhythm body |
| gap-compose / funnel-drain watchdog | dev-vessel → `pool/watchdog-log.jsonl` | general | dormant-in-effect (fires, and the stall continues) | stalled_min up to 241 |
| drain-log | `pool/drain-log.jsonl` | specific | live but unbounded (180 MB) | 1.09M lines |
| remedy-livelock gaps | gap store | specific | failed | livelock peaked 09-28 |
| expectation-scan heartbeat | memory note | specific | dormant (checked:0) | both nodes |
| discardedLandingReport | `pool/discarded-landings.json(l)` | specific | live, always total 0 | 704 rows |
| policies/*.json (walk-budget, pathwayReuse, extraction, llm-model-policy) | super-repo `policies/` | general | live on node 1; node 2 has only 2 of 6 | ls |
| learning-mode-state | `state/learning-mode-state.json` | general | live; **reset 09-28** by `50830bec` untrack | CHECKINS 03:15 |
| maintenance leases | `leases/*.json` | general | stale expired files left on disk | expired 09-25 and 09-26 |
| compose_lesson concepts (drafter lessons) | concept-db | general | live-used (loaded), **never credited**, duplicated | times_succeeded 0 on 57 |
| concept_usage grading | concept-db | general | weak (96% neutral) | 3,726 rows |
| pool standing.json atomic write (unique tmp + rename) | dev-vessel pool-impulse | general | partially broken (21 orphan or torn tmps) | pool dir |

---

## Principles (as stated in the live records)

- "autonomous work may not land on what lands, verifies, grades or constrains autonomy. The learner earns its core after landing cleanly on the periphery." (`autonomyScope.reason`, 09-27)
- "a landing without a pre-existing machine check cannot be credited" (`autonomyScope`, 09:15Z)
- "A landing on an unfalsified gap is judged by the operator, not the sweep." (`autonomyScope`, 09-28 05:55Z)
- "budget>1 is never affordable (the effective pause)." Containment works through budget, not through a pause field (project-intake rhythm).
- "Law 5 observability: each tick's condition-driven selection is published as a boredomSelectionSnapshot pool impulse" (boredom `index.ts:53`). This was the intent, and it is hollow in practice.
- "READ WORKSPACE_ROOT AT USE TIME, NOT AT MODULE LOAD … behaviour frozen into a module const at process start is invisible to traces" (`memory-note.ts:55-73`)
- self-maintenance lift_when: "the commit step stages only src/ (and other source trees), never runtime or cache paths"
- Operator 09-22: "a store whose path is env-derived can silently fork; find every notes.json and compare newest timestamps" and "recency-window recall + an unbounded writer = amnesia by displacement."
- Derived from this shard: **a store that turns a failed read into an empty write converts any transient fault into total loss.** A fix for a class that leaves the storage primitive unchanged gets undone by the next incident: the merge and the retire were both wiped within three days.
