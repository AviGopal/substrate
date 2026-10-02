# reports-1 — validation reports shard (23 files), grouped by problem class

Source shard: `find validation/reports -name '*.md' | sort | sed -n '1,23p'` (run 2026-09-28).
Files (all read in full unless noted):
1. acceleration-baseline/BASELINE-2026-09-20.md
2. acceleration-baseline/COMPOSER-SELF-RESTART-2026-09-24.md
3. acceleration-baseline/CONSUMPTION-EDGE-ANALYSIS.md (09-22)
4. acceleration-baseline/COUNTERFEIT-REACH-AND-CACHE-POISON-2026-09-22.md
5. acceleration-baseline/EVIDENCE-2026-09-20.md
6. acceleration-baseline/KNOWLEDGE-LOOP-ROADMAP.md (09-21/22)
7. acceleration-baseline/MEMORY-SPLIT-AND-RETIRE-SELF-REPAIR-2026-09-22.md (115KB log 09-22 evening -> 09-24 ~13:05Z)
8. acceleration-baseline/REACH-MISS-CLOSE-VERIFICATION.md
9. acceleration-baseline/SELF-INTERFERENCE-FIX-PREREG.md
10. ARCHITECTURE_FALSIFICATION_2026-08-29.md
11. arithmetic-outcome-repair-2026-09-11/REPORT.md
12. AUDIT_EXPECTATIONS_2026-08-22.md
13. AUTONOMY_DEMONSTRABILITY_2026-08-22.md (60KB)
14. autonomy-ledger-2026-09-20/ITEM1-PREREG.md, 15. ITEM2-RESULT.md, 16. SOAK-PREREG.md
17. autonomy-readiness-2026-09-11/INTERACTION_PLAN.md, 18. REPORT.md
19. B1_B3_REAL_FIXES_READY_2026-08-24.md
20. BLOCKER_CLEARANCE_2026-08-16.md (130KB)
21. BRINGUP_THREE_PATHS.md (81KB, 08-18 runbook; read fully, operational sections skimmed for findings)
22. BUILT_BUT_NOT_RESOLVED.md (155KB, 08-16/17)
23. causal-attempt-ledger/FINISH_LINE.md (09-24..26)

Date span covered: 2026-08-16 -> 2026-09-26. Read-only; nothing was dispatched, written to DB/gaps, or restarted.

---

## HEADLINE: the recurring "same issue, different hat" patterns visible in this shard

1. **write-read-mismatch is the dominant class across 6 weeks.** It was named as systemic
   on 08-13 (5 of 6 subsystems), re-found by hand on 08-16 (retirement route nobody posts to;
   split ingest write "returned no results in either table"), 08-17 (argument amputation in 5
   layers; 18 unmounted endpoints; walk never requests composition_score), 08-22 (uiQuestion:
   3 writers, 0 readers; picker ignores disposition metadata; org-prefix strip), 08-24
   (correlation_id dropped by adapter), 09-22 (consumedInChain reads declared graph while data
   flows via prompt string; two memory stores; satisfier trace inputImpulseIds []),
   09-23 (learner updates posterior only on graded outcomes; family-sampler source written but
   a second source read). **The 08-16 "split write" log line and the 09-23 "learner writes where
   the sampler does not read" are the SAME log line** (`Thompson Sampling score update returned
   no results in either table`) diagnosed twice, 5 weeks apart, never closed. The general
   detector ("for every declared producer/consumer link, assert the consumer resolves the
   producer's current output") was proposed on 08-17 and 08-22 and never built.
2. **"Landed" != "running" != "effective"** recurs as: fan-out 5/6 consumers stale 11 days
   (08-16), mirrored-not-running / fetched-not-mirrored (08-16), policy files erased from git
   worktree (08-16/17), gen-env only at entrypoint (08-16), inert-check reads un-pulled clone
   (08-17), seed template only read into empty catalogue (09-23, 62e174a), pwt blind restore wiped
   landing 3d2e52a from runtime (09-23), landing in runtime file but not on executed path
   (a5b4772, 09-23), post-land suite ran=false on every cutover (09-11 -> MEMORY 09-28 "dead
   08-31->09-28"). Each time proclaimed as a new finding.
3. **Verifier/judge wrongness in both directions** recurs: wrong-field registry oracle (7
   recurrences by 08-17, the 7th authored by the substrate 31f1d67 reverting the fix), LLM judge
   false-rejecting exact values (20413 on 09-11, 95432 on 08-17, 307127 on 09-11), counterfeit
   reaches credited (rung 2a 08-16, Ganymede 08-16, 0f2cc85d 09-22), semantic gate same-input
   opposite verdicts (09-22/23), refuters confabulating regex facts (09-24).
4. **Compounding blocked at the satisfier/pathway seam** was diagnosed 08-16 (ledgerStep(undefined)
   -> no edge), 08-17 (walk memoryless bandit), 08-29 (63.5% of pathways satisfier-headed,
   recommended then discarded), 09-22 (consumedInChain=0), and finally worked through 6 layered
   landings 09-23 (20/20 first-verdict on one transform family). Only one family proven.
5. **Lane throughput is eaten by self-interference**: composer restarts itself (14/15 restarts,
   09-24), restart budgets < compose duration (09-23), change_window lease held by reconcile ~half
   wall-clock discarding verified patches (39%, 09-23), compose-nudge self-re-arming (270 BUSY
   writes/h), window-blind dispatchers voiding graded runs (09-25).
6. **Operator hands keep being the fix** — every "autonomous" landing audited through 09-11 had an
   operator-authored diagnosis and often verbatim code; by 09-23/24 there were 3-4 unprompted
   substrate landings (799bd58, 404a89c, bf74cc5, 6a1b570) but the operator still supplied
   region/constraints/falsifiers/closures.

---

## A. Problems and attempts by problem-class key

### write-read-mismatch
- **Thompson draw ≠ Beta** (08-16, goal-host index.ts:5636): `(rand**(1/α))/(rand**(1/β))` drops the
  blame term; arms with β=113 selected 50% of time. Fixed d69a4ad (Marsaglia-Tsang, src/beta-sample.ts),
  LIVE VERIFIED. Lesson: "a fully-wired channel with a broken transform" — no write/read detector catches it.
  (Classed here as a transform-in-the-middle variant.)
- **Retirement never fired** (08-16): checkAndRetireTemplate called only from POST /v2/activities/executions
  (nobody posts), reads `execution` while ingest writes `activity_execution_traces`, <20 guard refuses arms
  with 0 rows, `.filter` on a row object throws into its own catch. Fixed e2d7077+1d83bf5
  (checkAndRetireByPosterior on real ingest route). Outcome: DEPLOYED, UNPROVEN (acceptance test inconclusive:
  synthetic trace wrong org + ungraded). On 09-23 the same template family shows posterior never moves on
  failures because failures are "ungraded" -> retirement still effectively dead. outcome=dormant.
- **Split ingest write** (08-16 §12, §16 row 8): total_executions 202->203 while α/β unchanged; WARN
  `Thompson Sampling score update returned no results in either table`; "nothing consumes it". Filed, not fixed.
  **Recurred 09-23 12:15-13:05Z** on trace-store-reconcile: variant_performance_metrics counts 304 exec
  (184 failed) α=119.7 β≈9.0; 47 posterior updates SKIPPED `reach_ungraded`. Root: applyOutcomeToPosteriors
  zeroes deltas when verdict is ungraded; exception-failures never get a reach verdict. Filed with one-op design
  (ungraded + executor-failed => β+1). outcome=failed (open across 5 weeks).
- **walkBudget / lessonExecutionPolicy: readers with no producer** (08-16): goal-host logged `FALLING BACK to
  literal budget iters=4` every walk. Fixed f87f52f (producers). Then storage erased (policies/ gitignored
  inside /workspace/git/super-repo worktree). bodyHonestyPolicy had no provider since 8f8e87e7 (08-02, correct
  untracking with no replacement); a848aee self-heal. outcome=partial.
- **uiQuestion write shape has 3 producers, read shape none** (08-22): 1,000 `uiQuestion_write accepted`/24h;
  every pending-verification escalation unreadable. Filed `uiquestion-read-shape-has-no-producer`.
  (Sibling of 1755 escalations unreadable, fixed fe52076/9cb83d0 per 08-29 row 10; and MEMORY index 09-22
  "248 escalations to :8270".) outcome=failed/recurring.
- **Picker ignores gap disposition fields; derives pending from git every pick** (08-22): operator cleared
  `disposition`/`pending_set_at` on 4 gaps; picker logged PENDING 60s later. landedCommitVerdict(gapId,editSite).
  Only exits: measurement predicate or revert.
- **getCanonicalPosteriors org prefix strip** (pre-08-22 audit): 0 rows instead of 3,275 -> every draw Beta(1,1).
  Fixed baca870; then autonomous 3e58e73 deleted the 20-line evidence comment; operator restored + pinning test.
- **activity_template (singular, 0 rows) gates shape-weighted credit**: never executed; every Thompson update
  unweighted (08-22). refusal_events 5,378 rows read only by audit endpoint (no consumer of shape-gap demand).
- **thompson_selection_log.execution_id = recommend-<ts>-<idx> placeholder**: 26,529 selections unjoinable to
  outcomes (08-22). B1 (08-24): producer adapter (ias-executor activity-api-adapter.ts) drops correlation_id;
  0 organic executions carry it; decision_outcome 1 synthetic row. Patch specified, not landed (MCP unavailable,
  direct edit classifier-blocked). outcome=unknown in this shard.
- **B3 validator discovery not durable** (08-24): validator volume-only; seeder reconciles to SHARED_TEMPLATES
  (lacks it). Patch specified.
- **Argument amputation, 5 layers in series** (08-17): stored compositions all `config={"type":...}` (98/98);
  ExecutionTaskRecord no config field; normalizePersistedTask whitelist dropped it (2nd instance after 08-13
  SHAPES fix); extractTasks read `tt.config` while write lands `resolved_config`; ribosome prompt skeleton
  `"config":{}`; activity-api-trace-sink.ts projected key-by-key (5th layer found after claiming closed);
  f71bb56, 9518d4e. Detector added (every ExecutionTaskRecord field forwarded or exempted). Live effect hub-gated,
  never verified end-to-end. outcome=partial.
- **Walk never consumes composition_score / successor_value** (08-17): walk sends mode forward/backward, only
  candidates_with_scores returns them; walk reader numOr on an object -> undefined. composition-graph.ts zero
  callers. "Walk is a memoryless bandit." Not changed (design call). outcome=dormant.
- **18 call sites target unmounted endpoints** (08-17): concept.ts built concepts from zero traces; 5 sites
  repointed to /v2/activities/execution-traces AND switched to read `executions` key ("URL and response key are
  two dimensions"); light-dispatch ghost retirement endpoint nonexistent (loop ran twice/boot). Unrepointed:
  /v2/gaps PATCH, /v2/notes, /v2/resolutions, /v2/goals. Detector written was vacuous (prefix `/` matched
  everything) — fixed with negative control.
- **/reach receiver reads body.missing no producer sends** (08-17) — refuted as harmful (dual-write default off).
- **consumedInChain reads declared inputShapes while data flows by prompt injection** (09-22, CONSUMPTION-EDGE):
  index.ts:9120 / reach gate :5702; satisfier picks declare inputShapes [] -> WITHHELD every run. Same finding as
  BLOCKER_CLEARANCE §22/§23 (08-16: ledgerStep(undefined,...) at :8247/:8823/:8553; poolProvenance.consumedBy
  never populated). Fix = declare only where bound. Later durable half: satisfier traces record no input impulses
  (inputImpulseIds [] at synthTrace; 76% of produced impulses never consumed; execution.input_impulses empty on
  all 150,421 rows) -> 69fe835 (design v4), first satisfier trace with input_impulse_ids 09-23 10:26Z. outcome=worked
  (edge recorded) but credit for that class still conditional.
- **Two memory stores** (09-22): unit `Environment=WORKSPACE_ROOT=/workspace` vs EnvironmentFile
  `/workspace/git/super-repo` (gen-env 07-25); 680 notes unread since 07-25. See memory-recall.
- **Two gap stores** (08-22): /workspace/gaps (2,540 series rows, frozen 08-09, close_rate 0.79) vs
  /workspace/git/super-repo/gaps (live). workspaceRoot() moved and orphaned the old series.
- **Two body-honesty policy copies** (08-17): richer copy at /workspace/policies is dead; served copy in
  super-repo worktree (erasable). Same WORKSPACE_ROOT trap documented in walk-budget.ts.
- **Retire request body shape** (09-22 03:56Z): d4171b1 posted bare `{type,note}` -> HTTP 400 swallowed (fetch
  doesn't throw). Fixed from both ends: 3ed68a6 tolerant parse (substrate-authored) — made the hollow landing real.
- **Recommender borrows by shape signature only when goal_hash lookup empty** (09-23): 3 weak rows blocked 41/41
  pathway; 9c376b2 fixed; closed by falsifier.
- **Family sampler** chain (09-23): observer remedy pinned base template id; sampler listed ?limit=2000 clamped to
  100; unordered LIMIT/START pagination skipped variant rows (2,771 rows / 2,722 distinct ids / 49 dups); family
  route rejected API-key callers (6a1b570, substrate unprompted) then root branch used surrealDB.query returning only
  first statement (LET) -> 97ff41d queryRaw; a5b4772 (lane autonomous) introduced second family source
  `familySample` and pointed loop at it — route-derived family computed and never read; loop-source correction ->
  "family sampled: 4 member(s)" 12:13Z 09-23. Then the posterior mismatch above. outcome=partial.
- **Unauthenticated discovery /resolve for SHA** (goal-host) -> 401 noise (09-23).

### node-locality
- **Cockpit pointed at dead hub** (08-22): `.metabob/config.json` endpoint syzygy.host:18080; hub serves
  concept/llm/templates but not goal_execution/activity_execution/substrateGap/memoryNote; syzygy:18210 refuses TCP.
  "Every operator goal dispatch through the cockpit has been going nowhere." Lead: .mcp.json mtime 2026-08-01 = date
  minting collapsed 79/wk -> 4 in 21 days (correlation only). Repointed to localhost:18080; MCP holds launch-time config.
- **Hub self-development plane down; no SSH** (08-17/22): tried 12 key/user combos. Later corrected: hub self-converges
  source commits via its own pull-sync, SSH not needed (08-22 §21).
- **Spoke traces go to hub; cannot verify effects** (08-17): ACTIVITY_API_ENDPOINT=http://syzygy.host:18080 on every
  vessel; local store 0 trace writes in 6h; fixes "correct in source and unexercised in production".
- **configured client endpoint dead on spoke** (08-18 BRINGUP §7.3): localhost:18080 masked on spoke; configure-local
  rewrites it every `up`.
- **roles: autonomy only in roles.full** (08-18): 42 units (gap-compose, operator-goal-generator, compose-teacher...)
  masked on every hub+spoke node. Self-development dead on federated deployments by configuration.
- **Hub outage silently unregisters healthy spoke** (identity role `control` absent on spoke; TTL + 401 heartbeats).
- **Composer ownership** (09-24): 14/15 dev-vessel restarts were its own mitosis-cutover; 17/25 landings targeted its
  own repo; second feature_compose producer visible via peer discovery (syzygy hub :8401 libp2p) —
  pickSatisfierProducer +1 local, stateful_data_owner_pin; proposal `decentralized-compose-ownership`.
- **Concept recall over relay intermittent** (08-16): hub concept-db answers in ms; relay round-trip exceeds 12s budget;
  `chars=0 via=hash-fallback`. Recall retry 2dcfc12 (RECALL_ATTEMPTS=4).
- **Seeded concept stored but multi-term conjunctive search misses** (08-16): NAIF mapping retrievable by `ganymede`
  but not `astronomical distance ganymede`.

### test-residue-live-state
- **Battery residue floods memory** (09-22): trendcheck-<fam>-<seed>-<i> + expectation:<title> notes per 120s tick,
  578/1077 (54%) live notes; no retire primitive. Fix chain: 19ae84e retire primitive (after hollow b5ed109 + 2 gated
  drafts), d4171b1 + 3ed68a6 checker retires notes; operator retired 552 stale notes via new primitive (store 1788->1236).
  outcome=worked.
- **Walk wrote its PLAN as the report note** during residue cleanup (09-22 05:05) — counterfeit class.
- **4-byte `null` scenario files** (08-16): 10 of 82 files in validation/failure-modes/vessel-scenarios/ are `null` —
  fs_write of null resolver result reported success.
- **Orphan fixture copies** (causal ledger, GAPS_OBSERVED #27): fixture README refused ~70 times by semantic judge,
  each rejected draft left an orphan copy in the live tree.
- **mock.module factories amputate exports** (08-17): 53 test files died at import; suite 509/114 -> 769/136.
- **Regression-gate baseline is 167 failures** (08-17): 242 `SURREALDB_NAMESPACE environment variable is required`;
  only 4/121 test files set it; gate misattributes. Filed `regression-gate-baseline-is-167-failures`.
- **Post-land gate attributes pre-existing failures to landing commit** (08-17): filed gap -> autonomous repair targeted
  healthy code -> 31f1d67 reverted verified oracle fix (see autonomous-regression).
- **Verify gate baseline capture transient / not persisted** (09-23 06:41): 25 baseline failures; filed baseline-capture gap.
- **Synthetic probes contaminating state**: retire-probe trace posted with org public (08-16); operator experiments
  dispatched into single lane charged β to unrelated arms (08-22 dBeta:2); battery 0/3 invalid point from restart
  (09-20); dispatching experiments hits lane denominator (MEMORY law).
- **Operator's own unmask re-enrolled activity-api into pull-sync test gate** -> OOM'd store made suite hang -> every
  convergence tick wedged 900s (08-17). Re-masked.
- Known confound (09-24): bootstrap-seeder refuses its 19 templates on warm volume (`activity.learning_track` required).

### memory-recall
- **Two stores since 07-25** (09-22): 680 notes (87 feedback, 287 finding, 264 project, 452 harness-mirrored) at
  /workspace/memory/notes.json never read. Operator file-level merge (675 added) -> 1752 notes. Unit/env collision
  FILED not fixed. outcome=partial.
- **Recency window displaced conventions** (09-22): resolveMemoryNote sorts updated_at, cut at limit 500; session start
  showed "Feedback / conventions (0)" while 90 existed. Session hook now fetches by note_type.
- **Failure side had no store** (09-22): successes persisted twice (reached-command cache, goal_execution_paths); failures
  kept a de-identified class label, reason stripped. Fix 9e23455+cf8fd87: /workspace/.goal-host-failure-memory.jsonl,
  recall by hash then class token, priorVerdictFeedback on attempt 1, reuse disabled. A/B f0e0a5f0: remember PASS,
  recall PASS, defect not repeated, still hollow on count trap. outcome=partial (worked mechanically).
- **memoryNote has no tombstone for verdict-rejected dispatches** (08-16 §42): reached:false dispatch 0b50480d persisted
  two false notes (137 shapes; unreachable) — "the reach verdict describes the dispatch, not the world it left behind".
  Filed not fixed. Reached-command cache got a tombstone (f9057a1) but memoryNote did not.
- **Post-reach answer mirror clobbers goal-named artifact** (09-11): note body overwritten by rendered markdown 3s after
  reach; fixed abb07ea (bridge non-clobber).
- **Concept-db saturated on walk critical path** (08-22): /health >10.9s; walk-concepts recall timed out 37×/6h at 12s×3
  -> walk proceeds without concepts. Filed.
- **Concept shape overloaded** (08-16): dev-vessel trace-mining vs concept-db prose; goal-host filters /concept-db/i.
  Escalated as load-bearing then RETRACTED (walk discriminates correctly); residual = vocabulary smell.
- Memory index notes (not this shard) 09-28: "system's memory holds nothing before 09-26; recall ignores topic" -> recurrence.

### calibration-seal
- **Category seal escape** (08-29 row 10): `hopeless()` + human escalation — 1755 escalations against a read-back that
  could never see an answer; repaired fe52076/9cb83d0, verified hopeless_excluded 79->78.
- **pending_verification livelock** (08-22): 7 gaps, route-edit-56849210 picked 432×/48h never composed;
  recommit-route-edit-9077062c-typecheck_dangling_reference-narrowed 200 picks/24h. markPendingVerification correct
  by design; exits: measurement predicate (hasClass2Predicate) or revert. Operator revert 69afa93/4f6f466 of inert
  dbb2917 -> 0 PENDING logs, chronically-stuck->narrowed path became reachable. Filed
  `gap-picker-cannot-detect-its-own-livelock`.
- **Pending held by prose annotation** (09-22): re-dispatch after "FAILED ITS FALSIFIER" prose refused
  `pending_verification`; the lane's vocabulary is literal `BEHAVIORAL VERIFICATION FAILED` + `regressed_by:<sha>`.
  MEMORY notes the clear doesn't stick (sweep re-derives).
- Lift gate (08-29): confidence_passing false — 2 of 17 posterior pairs above floor 10, median α+β=3.

### narrowing-duplicates
- **Narrowed child = verbatim copy of parent** (09-22 23:3x, 02:32, 09-23 10:0x, 05:08 `-narrowed-syntax_break`): same
  edit_site, "[narrowed from …]" prefix, source inherited human_reported; closed as duplicate_of_parent repeatedly.
  Law-3 violation. Recurrent, never fixed in this shard.
- **Recommit minted for a landed/closed parent; appendComposeLesson force-reopens closed gaps** (09-22 23:55Z, 00:13Z):
  feature-compose.ts ~3180-3210 writes failure_lessons with status "open" unconditionally, rewrites source; the gap
  filed to fix it reproduced its own defect (01:0xZ `recommit-the-compose-lesson-writer-…-anchor_not_found`).
- **Duplicate landings**: MAX_TARGET_SHAPES landed twice (c632117, a73e9eb — the latter inside a JSDoc comment) because a
  false-negative verifier graded against an un-pulled clone (08-17); 31d07cd / afea8de duplicate landings (09-25, #50),
  fixed by goal-host 5a4ef1a+4dec1bc and 44a5efa (skip second compose when this goal's route-edit commit is file's latest).
- **Three composes on one gap concurrently** (09-23 09:59-10:01) -> pwt blind restore wiped landing. Per-gap in-flight
  guard c8cfc38 + 01d085d (closed 17 on 09-23).
- **Compose-nudge self re-arming loop** (09-23): gap write -> pickup -> BUSY -> non-attempt "clearing cooldown" write ->
  gap write; ~34 writes/15 min on one row; 444 publishes/5 min fleet-wide. 799bd58 (Substrate Autonomous 19:03Z,
  unprompted) — BUSY writes 270/h -> 1/h. outcome=worked.
- **Telemetry records in gap store** (09-20): 94% of closes were auto_draft_decision:* (4 per draft) — faked close rate.
  Filed `auto-draft-telemetry-records-pollute-the-gap-store-and-fake-the-close-rate`; operator fix 3d4aa60+ecd077e.
- **Synonym treadmill**: 4 gaps / 4 commits each adding one word to a regex alternation in goal-host registry-field.ts
  (743a258f quantity of, 0804f9c1 how much/how numerous, 16670817 sum of, 81c6989 counted; 08-18..08-23).
  Filed `goal-vocabulary-is-a-synonym-treadmill`. Re-land counted as verified (>=2 landings = 'present').
- **Duplicate gaps / rediscoveries**: 3 of 7 audit findings were rediscoveries (08-22 base rate); gap-mt0kcoyt
  (unconditional β) and gap-edit-intent-compose-lane-lands-nothing rediscovered by operator.
- **Lease-discard gap summary reduced to one sentence** (09-23 06:20): 8 failed attempts ran against a sentence;
  design and measurement lost in the store.
- Side-effecting retries (#46, 09-25): one U goal produced several commits because the walk retried after hollow;
  capped by user option B through goal-host.

### hollow-landing
- **5c08dd6** (08-29): two import lines, gap fossil-rank, 7 verdicts reached=false (gate honest).
- **dbb2917** (08-18/22): two comment lines + broken indentation in rhythm-conductor-tick.ts; law-13 mistarget; held
  pending -> operator revert.
- **Synonym treadmill commits** (above) — non-inert but capability-hollow; counted in autonomy record.
- **3e58e73** (08-22): deleted 20-line measured evidence comment of org_id fix; all gates passed; "no gate reads what a
  diff removes" -> operator-landed evidence-deletion gate (direct edit under override).
- **b5ed109** (09-22): retire primitive read flat pointer only; nested envelope fell through; FAVORABLE; hollow for its reader.
- **bbb83ff** (09-22 23:55): `const isDirected` never passed; typecheck green; semantic gate rejected same defect 23:37 and
  passed it 23:49.
- **d4171b1** (09-22 03:56): retire body bare -> 400, silent; became real only when 3ed68a6 relaxed receiver.
- **5ec4719** (09-23 08:47): directed flag landed in the wrong function (routeCapabilityGapToNewResolver not
  resolveGapToFeature); operator region literal unique in wrong function. Correct landing 112e194.
- **3d2e52a** pathway head: landed, engaged ("honoured 3/3"), inert on outcome (walk still wrote first); then 579f365,
  c37df24, dac3c2c, 401cee9, 249ff89 needed.
- **62e174a / 651d10a** (09-23 08:10-08:48): reconcile fetch timeout in seed file (seed only applied into empty catalogue
  `Catalogue already populated (>=2771) — skipping seed`); observer remedy bare goal -> goal-host inferred
  trace_store_health_observer, walked 11 unrelated steps hollow. "The deployment layer has its own hollow class."
- **49b884e** (09-23 18:15): logging-only, prints `mode: undefined` (response schema lacks mode), server never reads
  exploit_threshold.
- **a73e9eb** (08-17): const inside JSDoc; landed before gate rejected it (land-then-gate).
- **Redundant-guard inert fixes** (08-17): .slice(0,3) -> maxTargetShapes (78dbcd6, substrate) no effect; caller passing
  bound (230e711) no effect; alternatives clause 5e02d505 no effect; only primary prompt clause 705f1eac moved 3->5.
- Base rates: "~1 in 5 autonomous commits reverted" (08-12 memory, cited 08-22), "5 fixes inert on arrival, all passing
  tests" (08-14), "a deployed fix produces measurable change 1 of 4" (08-22 AUDIT_EXPECTATIONS), "Verified-live 3 of 7"
  (08-16 §28), "2 verified live, 6 waiting" (08-16 §32).

### false-verification
- **Counterfeit reach cached as verified recipe** (09-22): 0f2cc85d reached:TRUE with member "gap" = dispatch id;
  2a28c288 reused recipe "from reached-command cache (goal_hash hit)". Root inferDerivationSplit orders synthesis before
  source, frozen per goal_hash (split cache). Gaps: ordering + cache invalidation; don't persist unverified recipes;
  judge verifies member ids. Feedback-retry 64ce0ac.
- **Rung 2a false reach** (08-16): resolveVesselHealthReport defaulted vessel_id to "analysis-vessel-local"; test pinned
  the default ("a test that pins a silent default pins the confabulation"). Fixed 1170047 refusal; observed live 3×.
- **http_response resolver hardcoded httpbin 404** (08-16 §33): ignored URL; test asserted it; 12 orphaned drafts across 3
  sessions re-minting a generic resolver; 45 Io attempts. Fixed 5be029a (delegate to web_resource), a68e1ac (allowlist JPL).
- **Ganymede false reach** (08-16 §44): web_search content farm 0.993 AU vs true 6.264; no oracle exists; "20/20 reached,
  0/20 correct" no-oracle regime (ext_variety). 68% hollow (72/80 reached, 23/80 correct) is the measured basis for the
  credit gate.
- **Wrong-field registry oracle** (08-17): `/\bvessels?\b/` matched anywhere; 97 wrong-registry-count verdicts/24h;
  sixth instance; fixed 93b8feed (counting-clause noun). SEVENTH instance authored by substrate 31f1d67 reverting to
  `/\bvessel\b/.test(g) ? "totalVessels" : registryFieldFor(g)`. Operator's own replacement had unreachable healthyCount branch.
- **127 from loopback** (08-17): sanitiser ae39e6cf/37f43aa claimed to unblock; RETRACTED — set-membership `includes` means
  it only fixed diagnostics. "Three oracles duplicate a partial numeric sanitiser" filed.
- **Deterministic fast path bypasses walk honesty gates** (08-17): ratio goal answered 368 (one operand), α+2. Fixed
  58376c1 (abstain on two counted entities / arithmetic) + 1fd7bfd ratio producer -> 28.307692307692307 valid.
- **Incomplete verifier worse than none** (08-17 14:04): two-source oracle counted recursively 72 vs true 60 -> credited
  wrong; fixed by representing scope (14:11). "A verifier must represent every dimension the goal can vary."
- **LLM judge false-rejects correct values**: 20413 for 137*149 (09-11 e5a1849a; verifyDeterministicCompute
  rejection-only -> 0c7f10e substrate-landed, 6586f01 tests); 307127 re-derived as 307787 (09-11 -> d8b1d92
  compute-artifact oracle); 95432 stargazers (08-17, reproduced 34e0c8f8). β-penalises the correct producer.
- **Judge inconsistency**: semantic gate REJECTED then PASSED same defect (bbb83ff 09-22); maxTargetShapes rename
  addresses:true then false (08-17); first judge PASS overturned by two refuters asserting false regex fact (`\n` in class)
  -> rolled back verified patch; fixed by spec-exact short-circuit 1746f5a whose negative control FAILED (fired on prose
  goal) -> 7ab6155 substantive-line rule (09-24).
- **Semantic gate runs after commit lands** (08-17): a73e9eb landed 02:21:30, rejected 02:22:43. Filed
  `semantic-gate-runs-after-the-commit-lands`.
- **Inert check reads un-pulled clone** (08-17): 230e711 graded false; manufactures duplicate commits.
- **Post-land suite observes, doesn't gate** (08-22): cutover-precheck gate landed operator-side (CUTOVER_PRECHECK_SUITE=0
  kill switch). Post-land suite `ran=false pass=0 fail=0` on every cutover (09-11); test_suite resolver standalone ran
  867/0 — in-process call drops structuredError detail. Filed `autonomous-landings-are-never-post-verified`. (MEMORY 09-28:
  post-land suite dead 08-31->09-28, shell 30s default, fixed 5e9a0b2.) outcome=failed for weeks.
- **Re-land counts as verified** (08-22): landedCommitVerdict >=2 non-reverted landings = 'present' -> 81c6989 closed gap
  as landed_verified. Revert detection missed conventional `revert(scope):` subjects (would have false-closed); fixed
  308cb8a (operator direct edit).
- **Gap closure mostly expiry** (08-28/29 row 7): 1332 gaps / 914 closed: 631 (69%) expired_not_redetected, 17 (1.9%)
  repair-verified. close_basis survives 0.5% of closures; resolution/close_basis silently discarded by write path (09-11).
- **Trend expectation scores failed dispatch as reach-miss** (09-20): `catch { /* a failed probe is a miss */ }` ~line 525;
  impossible timing n=3 in <1s at 03:23:27; prereg requires deployed copy. A prior cosmetic patch rejected.
- **Battery and product share violation gap id** (09-20): product's 3/3 closes battery violation — counterfeit-closure channel.
- **Grade-before-settle**: false FAIL 36s before corrective write (09-20); r3 false negative; "print the date with time"
  (09-22 04:37 misread).
- **reach verdict names wrong fact** (08-17 `reach-reason-blames-the-wrong-fact`); oracle verifies one quantity while
  verdict credits whole goal; facts dropped at inference (clause dropping; arity collapse) — detector: compare artifact
  against facts in GOAL TEXT.
- **Body-honesty guards one route only** (08-17): activity route pooled 98-char provenance envelope; denial pattern missed
  `not available` (policy widened); `missing:true` accepted (truthyDenialFields += missing).
- **reach-patch matched no row** ~33% (2/6 in 30 min, 08-17): verdict not persisted; eca7c8a graded-at-insert (never
  exercised). 09-11: system self-filed `lost-reached-verdict-…` deduped into a 3-day-old instance (recurring).
- **Lift-validation harness** (08-29 row 8): fataled on first scenario since 08-19; 7 of 663 scenarios scoreable (1%);
  656 auto-generated lack expected_emergence.
- **Operator measurement errors (recorded as class lessons)**: proxy metric "contains 12" (retracted); 49% corpus
  unreachable (paging-loop artifact, retracted); "every arm has 0 successes" (wrong field names); discovery 401 read as
  not-registered; grep of 1.2KB re-export stub; ActiveEnterTimestamp mid-drain; `git -C` into uninitialised submodule walks
  up to parent (08-22); stale clone reports real commit absent (08-17, 08-22); phase-lock hypothesis (08-16 §14).

### drafter-quality
- anchor_not_found dominant first-draft failure (2 of 3 gaps, 09-22); planner ignores supplied unique anchors and picks
  most-repeated line (`inputImpulseIds: [],` 6×) (09-23 08:10); single-op unique-anchor designs land, multi-op die.
- TS2451 redeclare (`nested`, 09-22 23:26), then `src`/`pickString`; correct fix was a MOVE not expressible as in-place
  region edit — operator supplied a *constraint* (stay in block, local retireSrc/retireId), landed 19ae84e.
- Localizer grounds on wrong site (expectation SCANNER ~438-470 vs trendcheck GRADING loop line 529) despite gap prose
  quoting right line; fix = classification_metadata.region as grounding centre (information, law 8).
- fc-repair discarded plan's unique anchor for 40-char prefix match -> wrong Bun.spawnSync site (1085 vs ~2640);
  489503a in ~8 min (09-20).
- syntax_break rate jumped after router fell to gemini-2.5-flash (02:45Z 09-22); router self-corrected to deepseek.
- Drafter drops caller op (liveSlotForGap fifth op) -> reachability floor refuses dead-code; redesign inline (09-23).
- LLM mis-transcribes random operands by 1-2 chars (cpd1->cpp1, 09-20) — transform oracle catches.
- Wrong cross-file localization; empty grep repeated 6× (09-11 assisted repair); drafter left stale "it NEVER greens"
  header sentence (09-11).
- Operator-authored anchors wrong too: `Return the 1-3 shapes` non-unique so anchored on alternatives clause
  (5e02d505) — "unique anchor ≠ right anchor" (08-17); region literal in wrong function (5ec4719, 09-23).
- Pre-validated exact edits land (09-24, spec-exact); "EDIT n old:/new:" (MEMORY 09-27).
- Prompt interventions: evidence at point of use 4/4, decision rules 0/7-0/8 (08-17); but worked example vs prohibition
  later retracted (both failed); structural binding (registryFieldFor + required producer) 5/5.

### gap-content
- 09-11: 5,521 gap records, 1,376 open; falsifier coverage 13 class1, 32 class2, 11 unresolvable, 1,174 none, 155 unstamped.
- edit_intent_route gaps lack measurement predicate -> permanent pending (08-22).
- 186/200 gaps substrate_detected but 170 (91%) missing_capability from instantaneous "no producer now"; 0 gaps for
  defects in own logs (97 wrong-registry-count/day, walkBudget fallback every walk, stale dist, `{{` placeholders) (08-17).
  "The system detects 'I cannot do X now' and never 'I have done X wrong 97 times.'" Close rate 9/191.
- Walk mints capability gaps for phantom shapes when compose BUSY (fs_edit, fileEditResult, code_modification_proposal)
  (08-22).
- False-premise gap retried forever (09-11 arithmetic-inference gap corrected before composer acted; queued compose dropped
  by lossy restart).
- `substrateGap_write` carries forward omitted metadata keys; delete only by writing null (09-23 09:53).
- Gap provenance: landing labelled with synthesized route-edit id not gap id (19ae84e) — close-oracle can't attribute;
  gap records never stamped with unprompted landings (799bd58, 404a89c).
- Operator supplied region/constraint/falsifier on every successful 09-22..09-24 landing; "if the operator authored the goal,
  the missing generator is the gap" (law 6).
- Qualification adaptation probes have no generator (fixed-text goal) — filed 09-11.

### dormant-mechanism
- composition_score / successor_value / composition-graph.ts (zero callers), SF_BLEND auto-flip (08-17).
- Ribosome correct and starved: 942 of ~1698 skipped in 6h "not honestly reached", 0 new templates (08-29); corpus +2
  templates in 3 weeks; 90/102 extraction dispatches reached:false with status success (08-22). compose landings never
  reach mintReachedTrace (0 route-edit mint decisions in 6h, 09-24).
- Minting stopped ~08-01 (79/wk -> 4 in 21 days), resumed 08-23 with operator goal traffic (08-22/23).
- Middle tier (first/last-mile adaptation) never fired in goal-host journal (08-22); ceiling n=1 (17 reuses from one hash).
- gap_lifecycle_scan not run 48h (08-22) — gap triple exists (gap-lifecycle-scan.ts:586-624) but stale; law-5 cadence
  plane broken (`rhythm-cadence-registry_unmappable`).
- Complete-but-unconnected tables: execution_sequences, execution_state_snapshot, relevance_feedback,
  impulse_usage_history, composite_sequence_patterns, execution_pattern, discovered_state_pattern, shape_gap_resolution,
  code_modification_proposal (writer/reader/shape/arm, 0 rows) (08-22).
- validator-dispatch runs 1 of 5 tasks, reports success; one of two ribosome-eligible templates (08-22).
- RUNTIME_DRIFT_REPAIR env-gated repair not armed (09-23 10:15).
- Family sampler a8f457a landed 01:37Z 09-23, fired once all day (wrong path).
- Per-vessel API keys only console.logged (seed-identity.ts:245-269); FEDERATION_SIGNING_SECRET read by zero TS;
  delegateValidation structurally dead; api_key.expires_at not enforced; TRUSTED_ISSUERS set by nothing (08-18).
- Reuse lineage computed then discarded to log `REUSE LINEAGE (not yet storable)` ~8/day (08-29) -> 4e0d27a receiver.
- chronically-stuck -> narrowed-child mechanism unreachable behind pending skip (08-22).
- Qualification rhythm (09-11) — N=2 autonomous cycles observed; status later unknown in this shard.
- Failure memory (09-22) and feedback retry — built and validated once.

### spend-envelope-throughput
- OpenRouter credits exhausted (09-22 02:09Z): 1399.69/1400; 3,901 "all completion providers cooling"/6h; only OpenRouter
  key configured. Operator top-up 1400->1500.
- Identity limiter 100/min per ip:keyprefix, whole fleet one bucket -> 6,505 429s/30 min -> activity-api reported
  INVALID_API_KEY -> goal-host spooled traces. 4fc5f80 (Substrate Autonomous) 503 IDENTITY_UNAVAILABLE; bucket open.
- Compose cap 2 (autonomous cap-1); each compose 5-15 min; 35 "lane full" vs 8 picks/2h (09-24); operator drop-in
  COMPOSE_MAX_CONCURRENT=3 (09-24 08:43Z; env-gating). Emergency halt at cap 0 inverts priority (directed 0/autonomous 1).
- change_window single global mutex (no name dimension): trace-store-reconcile held it ~half wall-clock; 97 DEFERRED vs
  153 FAVORABLE in 3h (39% of verified landings discarded, 09-23 09:26); 4 verified landings discarded 09-23; nothing
  consumes retry_after_ms. Root: reconcile http_fetch 15s default vs 376s server op; release_lease never runs.
- Restart budgets shorter than compose: SIGTERM drain 240s, pull-sync 3-defer, only mitosis quiesce 16 min; 16 restarts
  in 3h, 4 drains lost in-flight composes (09-23 07:11). Filed `every-restart-budget-is-shorter-than-a-compose…`.
- Unconditional dBeta:2 on capacity refusal (gap-mt0kcoyt, index.ts:5196) — operator concurrency penalised unrelated arm.
- Cost unmeasured: tokens_in/out and cost_usd 0 on walk/satisfier rows (09-20); metering in llm-router (09-22) tokens_in
  24617; cost_usd still 0.
- webSearchResult insufficient credits (08-17); /health can't see credit exhaustion (doctor check 7 does a paid call).
- Resource: SurrealDB cgroup 17.87GB, load 8.6 on 14 cores (09-11); surrealdb OOM-killed 08-17.

### sync-deploy-drift
- **Fan-out propagated to 1 of 6 consumers for 11 days** (08-16): symlink premise false; LAST_GOOD written on wrong evidence
  disarmed retry. Fixed c6d2212a (propagate by content, hash before LAST_GOOD); verified live 08-17.
- Mirrored ≠ running (restart deferred), fetched ≠ mirrored (commit arrives mid-quiesce; 0223842), committed ≠ pushed (23
  super-repo commits unpushed 08-17), pushed ≠ converged (wedged ticks), converged ≠ exercised (08-16/17).
- RESTART_DEFER_MAX=3 not a backstop; quiesce restarts its clock; in-flight never zero under boredom (08-16 §37).
- pull-sync wedged by SIGTERM-ignoring suite in $(run_suite) (08-17): `--kill-after` fix; bootstrap deadlock (hang line 909,
  self-update line 1330). TEST GATE SKIPPED / BLIND converging ungated (08-17).
- gen-env only at entrypoint -> env change needs container start (08-16).
- Policy files inside gitignored dir in git worktree erased (llm-model-policy 11,022->1,274 bytes) — POLICY_ROOT outside
  worktree recommended (08-16), still referenced 08-17.
- Drop-ins/units in /etc outrank /usr/lib; baked federation-peering.conf wins over gen-env; masked+running units
  unrecoverable (4 instances; surrealdb OOM masked+failed dead 5.5h 08-17).
- `git submodule update --init` silently rewinds clean submodules ahead of gitlink (08-18); super-repo gitlink pinned stale
  8c31cdb (09-25).
- pwt restore blind overwrite of legitimately advanced live file (09-23 10:07): pull-sync `RUNTIME SOURCE TRUNCATED`
  repaired in 390s without hands. Filed compare-and-restore.
- Composer self-restarts (09-23/24): 14 of 15 restarts by own mitosis-cutover; proposal-apply path (mitosis-<ts>) has no
  quiesce ("fixed one call site, missed the sibling"); drain counter ignored gap_to_feature -> 404a89c (unprompted),
  impulse.type -> bf74cc5 (unprompted, 4 min after filing).
- goal-host cutover drains at schedule time then blind restart ~30s later; fail-open `-1 <= 1` (09-20 prereg f95a3abd).
- Health lies during drain (`status:ok` while resolve returns draining) (09-23 09:31); ActiveEnterTimestamp stale mid-drain (08-17).
- Hand-written drop-in `cutover-lease-wait.conf` (CUTOVER_LEASE_WAIT_MS=330000) from a concurrent operator session caused a
  drain; 10 timer units ordered After=development-vessel stall up to 4 min per dev-vessel restart (09-23).
- Container recreated by another session (09-24 GAPS #28; 09-23 01:45-05:12); boot-order: goal-host registers dev-vessel
  proxies before dev-vessel up — recurred on every cold boot, deliberately not repaired (09-25/26).
- Restart racing a rollback loaded an uncommitted draft (#50, 09-25).
- Stale clones: container super-repo submodule head 08-16, /vessels no .git (08-22); authoritative clone is
  /workspace/git/vessels.

### endpoint-routing
- asResolvePath absolute-URL branch 7bb864b (substrate, 09-20) -> http_fetch works 30 min later (chain A); "fetch() URL
  is invalid" recurring in 09-21 probe; MEMORY 09-22 says the joiner then overshot (5 call sites prepend endpoint).
  Dead-grounding-row class struck 4× in one night (09-20), blocks every compose.
- Poisoned discovery row (09-22 02:36): transient verify instance registered ephemeral :24892 under live local-tools id;
  heartbeats kept it alive; every grounding window 0 bytes. Filed (probe changed endpoint before storing).
- Hardcoded ports: vessel-health-report.ts METABOB_ENDPOINT ?? :8080, DISCOVERY ?? :8100 (08-16); cockpit config pinned
  syzygy (08-22); PEER_DISCOVERY_ENDPOINTS hardcoded dead droplet 138.197.116.56 in baked drop-in (08-18).
- Advertised spelling: goalDispatchAsync indexed, goal_dispatch_async alias -> "no producer" (08-18).
- Federation ingress 404 on /resolve looks like dead relay; envelope normalization (3b4f921a) (08-18).
- 18 unmounted endpoint call sites (08-17).
- discovery queried without API key -> 401 read as not-registered (09-22 retraction).

### autonomous-regression
- 3e58e73 (08-22) deleted load-bearing evidence comment (behaviour preserved).
- 31f1d67 (08-17) reverted verified field-selection fix in one line, provoked by manufactured post-land gap; masked real
  capability for hours.
- 8c31cdb (09-25) global-fetch shim landed by autonomous gap-compose in graded window, voided run 11; reverted 6ce1446.
- 4f1d3e8 (09-25 14:13) removed `posterior_source !== "stored"` guard (selection change) from a boredom
  "investigate and decompose" goal converted to edit by EARLY EDIT-INTENT; 91c042b in-process boredom pick.
- 768ae7c (09-25 20:08) picker class-key change in-window (lease stops new picks, not in-flight composes).
- a5b4772 (09-23) lane landing took over the family-sampling code path silently.
- 21179d8 autonomous recommit overwrote ownership session's gap-store forwarding (09-25).
- 81c6989 synonym commit landed 10 min after operator marked "do not re-compose" (08-23).

### directed-overshoot
- Operator injected "at most 8 classes / under 2500 characters" cap into running goal-host index.ts:7554 -> hollow report;
  cap removal then flipped reach on a counterfeit + reconstructed goal changed hash (two variables; law 12) (09-22).
- batch=1 retention experiment degraded hub 19 min: 320 in flight, 81% slow, p50 33.7s (08-16 §41.2); reverted 07e32d38.
- Operator unmask of activity-api -> convergence wedge after OOM (08-17).
- Operator's healthyCount branch unreachable (08-17); operator 5e02d505 anchored the wrong clause.
- Operator region literal in wrong function (5ec4719) and "next to land:" instruction non-unique anchor death (09-23).
- Conventional revert subject nearly caused false close (08-22 §15).
- Operator dispatched 3 goals concurrently into single lane -> β penalties (08-22 §10).
- Operator metadata writes on fields nothing consumes (disposition) (08-22); gap_to_feature prose annotation (09-22).
- Direct edits under SUBSTRATE_ALLOW_DIRECT_EDIT=1 (08-22 §20): revert detection, compose-BUSY refusal (2cc8af7),
  evidence-deletion gate, pre-cutover test gate (ab3622c). Operator bypass ledger 09-21/22: f5bbaa0, 020042d, 3d4aa60,
  ecd077e, ffd1d58 (mirrored-not-live), 03505e5, a410572, 07a6c7c, metering, 64ce0ac, 9e23455, cf8fd87, 875e137,
  4678802, faa0afc, 0c4e81f, cc8c3cd. Knowledge-loop roadmap explicitly stopped the bypass chain at S1.
- Graded-window stopgaps (09-25/26): runtime mask of gap-compose, boredom/funnel-drain stopped, autonomous_pick lease held by
  operator keeper scripts — replacement is gap #59 (window/lease shape).

### selection-learning
- Counterfeit Beta draw d69a4ad (08-16) — see above; posterior mean 0.0592 arm cleared >0.5 gate ~85% before.
- Credit assigned to wrong arm / withholding claim false (09-20 leak gap); 020042d credit (operator).
- α ≠ reach: learned-satisfier-goal-execution 1 reached:true in 2,293 execs (09-20).
- Ungraded exception failures never move posterior (09-23) -> failing template keeps pre-failure posterior; variants
  (α=β=1) lose ~93% draws.
- Untried prior Beta(1,UNTRIED_PRIOR_BETA); admission cap 200 (08-17); prefilter pure recency ev=0.5 on 3,856 rows (08-22).
- consumedInChain=0 abstention withholds α and β -> satisfier class learning-inert (08-22); 16 learned compositions α=1.00
  never credited (08-16 §47); `learned-composition-vessel-health-report-to-memorynote-write` α=1 β=5 after 8.
- goal-host day 09-22: 6 α, 89 β, 4,280 β-WITHHELD.
- Posterior reordering of satisfiers disabled by a constant after A/B (0/4 vs 3/4, p≈0.029) (09-23).
- Explore mode returned least-executed rows only, dropping best pathway -> 249ff89 (09-23) 20/20.
- success_rate int/int truncation; 438/1,059 impossible values (08-16).
- activity-table posteriors vestigial (dead schema, identical 3,856 rows) (08-22).
- Learning DID close once: learned-composition-discovery-vessel-registry-observer-to-shellresult-to-memorynote extracted ->
  selected -> reached -> verified -> α-credited (08-17). Controlled 4-round base64 Thompson cycle (09-20) r4 α 13->14.

### composition-crystallization
- 08-29 row 4: index.ts:12498 declines to pin satisfier-headed pathways (pseudo-id not in catalogue, would 404); 63.5% of
  accepted pathways satisfier-only; walk_tier sample: satisfier 70, learned_pathway 9 of 200; 335/400 satisfier-headed.
  E1 void (non-exhaustive arms); E2 FALSIFIED-b (coverage-tick goal minted new satisfier + floor rows; proven template row
  untouched since 06-30).
- 09-23 fixed layer by layer: 3d2e52a (head honoured), 579f365 (terminal set from pathway), c37df24 (rebind refused for
  terminal when intermediate exists; donor body `etartsbus`), dac3c2c (pickString numeric coercion), 401cee9 (bindBody keep
  verbatim body), 249ff89 (explore) -> 20/20 first-verdict reach on product family. 9c376b2 recommender borrow.
  Path-record losses: phantom-unique index = duplicate element in one array (195/day; migration 211 39a8cb0 wrong diagnosis,
  d6205d5 dedupe fix) and state_signature NULL (202/day; c7c01ea). 227 path-record losses/day hidden.
- 09-11 arithmetic: reuse accepted at 4/5 (pathwayReusePolicy minSuccessful=3 minTotal=5), 4s vs 60-90s; tier-2 rebind
  adapted 613×287; rebind slot gate punctuation bug cd011e3; composite shellresult->memorynote 7s reuse; shape_signature
  borrow cover 0.5.
- Io->Europa rebind refused: slot gate needs literal in donor command; `Io` vs `COMMAND=501` — missing domain fact / typed
  parameter (`ephemerisRequest{target,...}`). "Rebind LCS machinery is a workaround for absence of a parameter" (08-16 §47).
- Extraction contract rule 9a (top-level input_shapes) — diagnosis wrong (37/38 correctly self-contained), rule kept.
- Malformed templates 14% of store (activity-id-as-output-shape 6, self-satisfied precondition 8; ribosome's own wrapper
  composed-cap-text-execute-template-ribosome-extract-v); malformed 18.5% vs well-formed 38% success; learned-of-learned
  nesting 7 deep (202 execs / 0 successes) — ribosome recursion gate fixed (author from `learned-` prefix).
- Learned composition execution by depth: hops2 20%, hops3 4%, hops4 17%, hops5 0% (08-17); concept-bearing 6% vs 28%.
- Consumption edge (09-22) = prerequisite for compounding.
- Seven-to-eleven valid compositional reaches hand-graded 08-16; ladder to 3 independent sources credited 08-17 (66).

### goal-walk-floor
- 08-29: reach 10% per attempt (20/196), 22% per distinct goal; edit-intent 0/41 (16 goals); non-edit 52%.
- 09-11 pilot 4/8 correct information, 1/8 exact contract; latest-50 window 12 reached / 35 not.
- Compose-BUSY fell through to a walk that cannot edit (fs_edit, fileEditResult, code_modification_proposal unproducible)
  -> 2cc8af7 refuse retryably (operator direct edit 08-22).
- Io 45 attempts: prose-answer route NOT_PROSE_RE (goal-target-inference.ts:407) classified live measurement as
  definitional -> LIVE_MEASUREMENT_RE 0223842; four independent defects each sufficient (08-16).
- Target inference caps: prompt "1-3 shapes" binding; walk MAX_ITERS=4; `how many` fallback collapses to [shellResult]@0.4;
  .slice(0,3) never binding (08-17). Mean inferred 2.5 -> 3.5 with worked example; max stays 4.
- inferDerivationSplit orders synthesis before source; cached per goal_hash (09-22).
- Read-shape resolution seam: named read shape has no fetch producer (09-22) underlying 3 failures; target inference dropped
  substrateGap under rewording (phrasing brittleness, law 13).
- pool-walk `c.slice` TypeError (JSON.stringify(undefined)) 91 aborts since 09-22 20:12 across 7 digest builders ->
  875e137 hardening (operator).
- Fact delivery envelope: 2 facts reliable (5/5), 3 facts unreliable (1/4) (08-17); six candidate mechanisms excluded.
- Two independent sources honestly failed until structural fact supplied (08-17).
- Walk writes terminal before compute (DERIVATION/COMPUTE-DEFERRAL with empty terminal set) (09-23).
- Unrendered `{{vessel_health_report}}` placeholder in synthesized shell (08-17).
- Walk can't construct llmCompletion payload from pool records (09-21).

### human-surface-escalation
- uiQuestion unreadable (08-22); 1755 escalations unreadable until 08-29 fix; feedback route `Missing organization
  context` with API key (08-16); MCP provide_feedback requires selectedTemplateId/executionId, labels marked
  human/grounded:false, not consumed by recalibration (09-11); human surface couldn't dispatch during recommend churn
  (09-22); surface-empty 4 causes (anchor, dead relay, path 404, envelope) (08-18); human-surface HOST=127.0.0.1 loopback pin.

### federation-p2p
- Relay on half-decommissioned host 138.197.116.56 while syzygy=104.236.0.175; `relay_multiaddrs` check passes green on
  zombie (08-18). RELAY read once at module load. Empty relay -> process.exit(1) flap every 5s.
- Only shaped impulse resolutions cross the relay; bespoke HTTP verbs unreachable by construction; goalDispatchAsync as
  shape (3b4f921a) (08-18).
- Same FED_SUBSTRATE_ID -> identical peer id, isSelfCircuit discards rows.
- HUB_API_KEY set by nothing; locally minted key 401s at hub.
- Hub deploy via own pull-sync (08-22 §21).
- Peer composer (syzygy hub) visible for feature_compose (09-24).

### trace-store-db
- 08-16: 446,705 rows vs cap 150,000; 65% slow queries; p99 45s; valve DELETE times out deleting zero. Hypotheses: phase-lock
  with FTS rebuild (d253457, REFUTED by own test), batch width (batch=1 fast per statement but degraded hub; batch=5 same as
  25), actual: poison head row exec_4o2fxn66 re-selected every cycle -> quarantine-and-advance valve; then 25 rows/6 min vs
  310k surplus: capacity 2 orders short; "next lever is not in trace-retention.ts".
- 09-23: trace store 154,082 vs 150,000, refills between ticks ("treadmill"); reconcile 5,166-row surplus 376s.
- 17,587 traces (119MB) spooled since 08-17 with no replayer (09-22); filed.
- activity-api event loop blocked by recommend FTS+dense queries (1,235/1,677 >10s) -> self-recovery restarts every 3 min
  (33 starts/3h) (09-22); filed. (Later 09-25: 9387ca7 no scheduled FTS rebuild, bf3f0bf dense in-process, b56623a
  duplicate-first trace insert.)
- execution_trace_content duplicate inserts several/sec (09-23).
- PERMISSIONS on $auth vs $token: trace INSERT returned empty with no error (migration 121) (08-18 doc).
- Unordered LIMIT/START pagination overlaps (08-21, 08-22: 48/100; 09-23: 49 dups); /templates clamps limit to 100.
- SurrealDB 2.3.3 non-unique array index rejects duplicate element in one record (09-23); option<string> rejects NULL.
- surrealdb OOM-killed while masked, dead 5.5h (08-17); disk headroom 1.1G free (08-18 doc); backup not restore-grade.
- 08-22: execution is 150k FIFO ring; auth storm 20,000/hr flushed ~2 months history; composite indexes ending in success
  return zero rows so stratified sweep deletes nothing.

### env-gating
- trace-retention.ts 19 env reads (08-16); FTS_REBUILD_INTERVAL_MS / setInterval cadence (law 5).
- COMPOSE_MAX_CONCURRENT drop-in (09-24); CUTOVER_LEASE_WAIT_MS drop-in (09-23); RUNTIME_DRIFT_REPAIR=1 unarmed repair.
- WORKSPACE_ROOT unit Environment vs EnvironmentFile precedence -> memory split (09-22).
- Web allowlist env/const (security boundary, deliberately not shaped) (08-16).
- PROFILE has no delivery path through make; ENABLED_EXTRA_VESSELS not persisted; TRACE_RETENTION_DELETE_BATCH absent
  from gen-env (08-16/18).
- In-process constants steering behaviour: .slice(0,3), MAX_ITERS=4, 800-char finding truncation, pathwayReusePolicy is
  shaped (good), posterior-reorder disable constant, CUTOVER_PRECHECK_SUITE, ROUTE_EDIT_INTENT_TO_COMPOSE.
- Positive pattern: walkBudget, lessonExecutionPolicy, bodyHonestyPolicy, settlementPolicy.json as shaped policies — but
  storage erased (see sync-deploy-drift).

### docs-drift
- CLAUDE.md headline claims falsified by measurement (08-29 rows 1,2,3a,4,7,8).
- Stale code comments: gen-env "heredoc OVERWRITES" (merge now), "persisted in the secrets store" for
  ENABLED_EXTRA_VESSELS, validation.ts TRUSTED_ISSUERS "TODO", ui-only-up.sh "ui/dist gitignored", keyctl README npx
  (unpublished), identity-host.conf HOST comment; port count 7/8/9 (Makefile, docs/SUBSTRATE.md, run-live); SHARED_TEMPLATES
  18 not 19 (08-18). Drafter left "it NEVER greens" header (09-11).
- Audit claims superseded by later same-day docs; "gap triple computed nowhere" wrong; "per-test attribution missing" wrong
  (08-22). "49% corpus unreachable" retracted.
- Reports themselves contain retracted sections (§13.1 phase-lock, §43 concept routing, 127 sanitiser, worked-example) —
  a reader must read to the end.

### codebase-bloat-fossils
- 12 orphaned files drafting a generic http resolver across 3 sessions (absolute patch paths, no applier) in in-container
  super-repo proposals/ (08-16).
- 10 `null` scenario files (validation/failure-modes/vessel-scenarios) (08-16).
- activity-api/src/routes/db-admin.ts imported by nothing (08-16).
- checkAndRetireTemplate dead-but-live (variant-creator.ts) (08-16).
- activity_templates (plural) legacy sink untouched since 04-02; activity table α/β vestigial; activity_execution_traces
  decommissioned dual-write (08-22).
- 76% of non-retired activities in a duplicate shape family; 1.2% carry execution provenance; 51% minted by proposal path
  (08-22).
- Stale substrate-pull-sync.sh beside executing substrate-pull-sync in /usr/local/bin (08-16).
- Three oracles each with private partial numeric sanitiser (08-17).
- Two family-source implementations (a5b4772 familySample vs route) (09-23).
- Malformed templates 14% incl. learned-of-learned-of-learned (08-17).
- Stale keyctl dist, 4 substrates running locally incl. dashboard-test-substrate-1 (08-18).
- repairSignatureOf returns Promise its tests never await (4 failures) (08-16).
- Current worktree residue (git status 09-28): validation/demo2/bringup/* videos, frames, review dirs; untracked scripts.

---

## B. Mechanisms inventory (from this shard)

| mechanism | location | general? | status | evidence |
|---|---|---|---|---|
| Real Beta sampler | goal-host src/beta-sample.ts (d69a4ad) | general | live-used | verified 08-16 |
| Retire on posterior from ingest | activity-api checkAndRetireByPosterior (e2d7077+1d83bf5) | general | dormant/unproven | ungraded failures never reach it (09-23) |
| Shaped policies walkBudget/lessonExecutionPolicy/bodyHonestyPolicy/settlementPolicy | goal-host, policies/*.json | general seam | live but fragile (storage under worktree) | 08-16/17 |
| Body-honesty degenerate-body gate | goal-host `_degenerateReason` | general | live-used, one route only | 08-17 |
| Deterministic oracles (registry-count, compute-answer, compute-artifact, two/multi-source, transform-oracle, ephemeris) | goal-host index.ts verifyGoalReached family | specific per family | live-used; each duplicates sanitiser; wrong-field regressions | 08-17, 09-11 |
| registryFieldFor shared parse (producer/binding/verifier) | goal-host registry-field.ts | general pattern | live-used; reverted once by 31f1d67 | 08-17 |
| Reach gate consumedInChain credit rule | goal-host index.ts ~5702/9120/9384 | general | live-used (correct, starves satisfier class) | 08-16, 09-22 |
| Consumption edge on satisfier traces | goal-host 69fe835 | general | live-used | 09-23 |
| Reached-command cache + tombstone | goal-host (f9057a1) | general | live-used; poisoned by counterfeit reach | 09-22 |
| Failure memory jsonl + priorVerdictFeedback + FEEDBACK-RETRY | goal-host 9e23455, cf8fd87, 64ce0ac | general | live (validated once) | 09-22 |
| Failed-walk trace persistence (walk-satisfier-failed-*) | goal-host 07a6c7c | general | live-used | 09-22 |
| Token metering | goal-host llm-router | general | partial (cost_usd 0) | 09-22 |
| Pathway reuse: recommender (goal_hash + shape_signature borrow), pathwayReusePolicy, pathway-head honour, rebind skip, bindBody guard, explore fix | activity-api goal-paths + goal-host | general | live-used, proven on one family 20/20 | 09-23 |
| Tier-2 rebind (LCS scaffold + slot gate) | goal-host | general-ish workaround | live-used; refuses on missing domain facts | 08-16, 09-11 |
| Ribosome extraction + reach gate for mint | ribosome-vessel, ias-executor ribosome-extract.json | general | live, starved; compose landings never mint | 08-29, 09-24 |
| Write-boundary template guards (activity-id-as-output, self-satisfied precondition) | activity-api | general | live; sweep not deployed to hub (08-17) | 08-17 |
| composition_score / successor_value / composition-graph / SF_BLEND | activity-api discover-by-shapes, composition-graph.ts | general | live-unused (zero consumers) | 08-17 |
| Per-test baseline delta post-land detector | vessel-mitosis-cutover.ts:2334-2374 | general | observes not gates; post-land suite ran=false for weeks | 08-22, 09-11 |
| Pre-cutover test gate | development-vessel (ab3622c, operator) | general | status unknown later | 08-22 |
| Evidence-deletion gate (comment-only removal) | development-vessel (operator direct edit) | specific | unknown use | 08-22 |
| Semantic gate + refuters + spec-exact short-circuit | development-vessel verifyPatchAddressesGap (1746f5a, 7ab6155) | general | live; inconsistent verdicts | 09-24 |
| Vacuous-edit guard | development-vessel vacuous-edit.ts, goal-host guard (326a983, 212408a, 0874216) | general | live-used | 09-24 |
| Reachability floor (dead-code-only refusal) | development-vessel | general | live-used | 09-23 |
| Compose slots + directed reservation + per-gap in-flight guard | development-vessel compose-slots.ts (c8cfc38, 01d085d, 112e194) | general | live-used | 09-23 |
| Compose nudge capacity check | substrate-gap.ts (799bd58, substrate) | general | live-used | 09-23 |
| LONG_RUNNING_TYPES drain counter | development-vessel long-running.ts (404a89c, bf74cc5) | general | live-used; budget too short | 09-24 |
| markPendingVerification / landedCommitVerdict (git-derived) | gap-to-feature.ts:1149 | general | live; livelock without predicate | 08-22 |
| chronically-stuck -> narrowed child | gap-to-feature | general | live; produces verbatim duplicates | 08-22, 09-22 |
| appendComposeLesson / failure_lessons / priorAttemptFeedbackBlock | feature-compose.ts | general | live; force-reopens closed gaps | 09-22 |
| gap_lifecycle_scan gap triple | gap-lifecycle-scan.ts:586-624 | general | exists; not scheduled (stale 48h 08-22) | 08-22 |
| Trend checker / self-minted expectation commitments | development-vessel 707dd248, goal-host 0fbfcaac | general | live-used; residue retire d4171b1 | 09-20, 09-22 |
| Memory retire primitive | development-vessel memory-note.ts (19ae84e, dac3c2c) | general | live-used | 09-22/23 |
| Qualification rhythm (timeShapedRhythm + rhythmFamilyGoal) | pool impulses, rhythm conductor | general (law 5) | live N=2 cycles | 09-11 |
| Retention valve with quarantine | activity-api trace-retention.ts | specific | live; capacity insufficient | 08-16 |
| Pull-sync fan-out propagate-by-content + hash gate | scripts/substrate/substrate-pull-sync.sh (c6d2212a) | general | live-used | 08-17 |
| pull-sync RUNTIME SOURCE TRUNCATED repair | substrate-pull-sync | general | live-used (repaired pwt overwrite) | 09-23 |
| runtime-drift detector | timer | general | detect-only; repair env-gated off | 09-23 |
| Causal attempt ledger (attemptIntent/Outcome, checks, unaccounted-landing scan, settle sweep) | development-vessel attempt-register cbdb432, attempt-checks a4923f2, unaccounted-landing-scan 429c8bd; goal-host DEFER/WITHHELD | general | live; accepted CONSISTENT 3×10/10 09-26 only under operator stopgaps | FINISH_LINE |
| autonomous_pick maintenanceLease gate | development-vessel 128f51f+15bb263 | general | live; in-process boredom picks bypassed masks before | 09-25 |
| Revert detection (subject + trailer) | gap-to-feature (308cb8a) | specific | live | 08-22 |
| Identity 503 IDENTITY_UNAVAILABLE labelling | activity-api 4fc5f80 | specific | live | 09-22 |
| Reach-verdict graded-at-insert | eca7c8a | general | deployed, never exercised | 08-17 |
| Lift-validation harness | validation/ | general | 1% coverage (fossil-ish) | 08-29 |
| Four detectors (trace-boundary key agreement, sink forwarding, mock-factory completeness, fleet endpoint paths) | tests | general | built with negative controls | 08-17 |
| Masked+running unit detector | ops | general | widened after missing masked+failed | 08-17 |

---

## C. Principles / design laws stated in this shard

- A negative is unattributed until a positive control shares its address — and its credentials (09-22 retraction; 08-17; 08-22).
- Prove a check can fail before trusting that it passed; detectors need negative controls; a detector written from one
  remembered instance covers exactly one instance (08-17).
- A distribution needs its draw checked, not just its parameters (08-16).
- A reader without a producer is the same frozen constant with a longer code path, and reads as landed (08-16).
- Reader, producer, and storage each have to survive; two of three still yields a frozen literal (08-16 §19).
- Untracking from git and providing at runtime are two tasks (08-16 §30).
- A success marker written on the wrong evidence does more damage than no marker (08-16 BUILT).
- A fix present in repo and build but absent from behaviour is a propagation question, not a logic question (08-16).
- Committed ≠ pushed ≠ converged ≠ running ≠ exercised (08-17).
- A test that pins a silent default pins the confabulation (08-16).
- A wrong answer that looks right is worse than no answer (08-16).
- A verifier must represent every dimension the goal can vary; where completeness is not achievable, abstain; a shared parse
  must be complete (08-17).
- A deterministic fast path is also a shortcut past the walk's honesty gates (08-17).
- Where a fact is machine-decidable from the goal, bind it; instructing the model does not work (08-17); evidence at point of
  use beats decision rules (4/4 vs 0/7) — partially retracted.
- Redundant guards make a fix look inert when aimed at the wrong one; layers binding in series: fixing one changes nothing
  observable (08-16/17).
- When a goal fails identically across dozens of attempts and every fix targets execution, check whether execution was ever
  entered (08-16).
- The credit gate must not be loosened (68% hollow measurement); a class earns credit by gaining a deterministic verifier
  (08-16/17).
- Reach verdict describes the dispatch, not the world it left behind (08-16).
- Grade after settlement; print dates with times (09-20, 09-22).
- Never quote α growth or dispatch volume as acceleration; split reach by author; report UNMEASURED instead of silent skip
  (09-20).
- A loop that stores only successes cannot compound on failure (09-22).
- Declare consumption only where a step was actually bound; never credit chains that don't consume (09-22).
- An action must not execute against state checked earlier than fire time (09-20 origination answer key; cutover races).
- Health lies during drain — gate on the refusal (09-23).
- "Landed and running the commit" is not end of verification when the artefact is a seed template or dispatch body; exercise
  the consumer (09-23).
- In the runtime file ≠ on the executed path (09-23).
- An error naming a record that does not exist names the record being created (09-23).
- Operator's correct contribution is vocabulary and contract (bootstrap), not implementations; rebind string surgery is a
  workaround for missing typed parameters (08-16 §47).
- Do not hand-author successful behaviour in advance; S3 extraction must come from a reached run (09-21 roadmap).
- Pre-register criteria; exhaustive arms; a criterion amended after seeing the result voids the run (08-29).
- Measure the denominator before optimising the numerator; every zero is a claim about your filter (08-22).
- Observational legs survive review ~7/7, causal legs 1/7; deployed fix measurable change 1/4 (08-22 base rates).
- Any capability expressed as bespoke HTTP is unreachable over federation; express it as a shape (08-18).
- A loud failure nobody reads is a silent one (08-16, 08-18).
- A verification layer that mistakes noise for signal spends repair capacity manufacturing defects (08-17).
- Filing a gap = authorizing work; a false-premise gap is retried forever (09-11).
- Autonomy success: substrate-authored commit on remote with no operator hands AND verified effect ("it fired" is not success).

---

## D. What to keep vs fossil (recommendation seeds from this shard only)

KEEP (general, proven at a shared seam): real Beta sampler; reach/credit gate + consumption edge; deterministic oracles
pattern with shared complete parse (consolidate the 3 sanitisers into one); failure memory + feedback retry; failed-walk
trace persistence; pathway reuse stack (recommender borrow, head honour, rebind skip, bindBody, explore); compose slots +
per-gap guard + nudge capacity; drain counter; vacuous/reachability/spec-exact gates; attempt ledger; memory retire
primitive; pull-sync fan-out hash gate; shaped policies (after POLICY_ROOT moves out of worktree).

FOSSIL/RETIRE candidates: checkAndRetireTemplate; db-admin.ts route file; activity_templates (plural); activity table α/β;
complete-but-unconnected tables (unless a consumer is named); duplicate family-source path; `null` scenario files and
orphaned proposals; stale substrate-pull-sync.sh copy; malformed templates (sweep); synonym regex alternation (replace with
typed parse); narrowed-child mint (produces verbatim duplicates).

UNRESOLVED CLASSES that recur and should be treated as one each (not re-proclaimed):
(1) producer/consumer key+route agreement detector; (2) ungraded-exception β and posterior/counter split;
(3) change_window single global lease + restart budgets vs compose duration (lane self-interference);
(4) window-blind autonomous dispatchers (gap #59); (5) verifier completeness / judge false rejections;
(6) gaps born without measurement predicate; (7) memory store location/recall; (8) trace-store capacity design.
