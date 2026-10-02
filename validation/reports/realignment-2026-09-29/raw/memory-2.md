# memory-2 — operator memory cache, files 76-150 (sorted)

Source: `/home/avi/.claude/projects/-home-avi-documents-work-substrate/memory/*.md`, sorted, entries 76..150
(75 files, ~650 KB). Read in full. Notes are per-file extraction first (chronological evidence), then a
problem-class rollup, mechanisms, and principles at the end.

---

## PER-FILE EXTRACTION

### feedback-substrate-self-updates-from-git-never-copy-files (07-24)
- Operator law: never `docker cp` into substrate-live; push to origin/dev and self-update (pull-sync + restart) makes it available. Verified: goal-host 901bdb8 appeared in `/vessels/goal-host-vessel/src/index.ts` with no copy. Supersedes older "docker cp to FragmentPath" workaround notes. [sync-deploy-drift]

### feedback-test-hard-fail-gates-against-real-source-not-invented-cases (08-02)
- Mitosis drafter-corruption gate: rule "reject added line starting with `{{...}}`" passed 15 invented cases, but scan of real corpus found 21 FPs in `development-vessel/src/seed/*.ts` — would have halted all self-dev. Narrowed to line 1 → 0 hits across 1114 .ts files. Law: FP-test a hard-fail gate against the real corpus; put the measured count in the commit. [false-verification, drafter-quality]

### feedback-the-first-reach-is-the-gate-not-the-reuse-mechanism (08-08)
- 3 ceiling-vs-floor A/Bs with `ablation.disableReuse`: all nulls (5/6 vs 5/6; 2/3 vs 3/3; 3/3 vs 3/3). Reuse fired every time but changed nothing.
- Root: reuse growth gated on a family's FIRST VERIFIED REACH. `git-commit-count` 46% → 21/23 once a verifier added (walk unchanged). Cold CSV/XML: 8/16 correct but reach granted 3/16, reuse 0/16.
- Instrument moved mid-experiment (verifier landed between runs) → law: pin HEAD of every vessel measured at start and end.
- Structural artifact oracle graded exists+parses only: empty/0/1 CSV cells all "reached" → artifact-shaped hollow completion. Commit justified by external value-check table but code didn't do it. Fixed `0468f9c` (recompute value independently by walking fs).
- Run 3 after `d9a2597` (multi-occurrence rebind): ceiling 5/5 vs floor 3/5, p≈0.44 NS; REBOUND fired 1.
- Run 4 powered (16×2 paired): 4/8 vs 2/8, p≈0.61, REBOUND 0/16. Root: donor banked as ONE STEP's command; varying output path absent → literal gate refuses donor. Filed `rebind-refuses-when-a-varying-slot-is-absent-from-the-command`; obvious patch (ignore absent slots) is wrong (writes to donor's path) — correct fix is bank the COMPOSITION.
- sh -c vs bash -c echo "\n" portability splits same donor.
- Run 5 after `1df0e02` (skip absent slots): REBOUND fires ~every dispatch; full 13/16 vs 8/16 p=0.135; value-only 12/16 vs 11/16 p=1.00; encoding 15/16 vs 10/16. Reuse transfers MECHANICAL FORM (printf) not insight; "learning curve can be a defect-compensation curve". Substrate verdict agreed with external grading 30/32.
- Ordering law: verified-and-correct first reach → bankable donor → reuse → compounding.
[composition-crystallization, false-verification, selection-learning]

### feedback-THE-FOUR-FAILURE-CLASSES (08-04) — master index
- CLASS 1 swallowed failure: `feature-compose.ts consultPrinciples catch{return ""}` (drafter zero grounding); `autonomy-metrics.ts gitCount catch{return 0}` (reported 0 vs 121 commits); `goal-host/index.ts:2548,2550` break → ReAct loop discarded `groundedOk=0`; federation-transport-server HTTP 200 with error body; `reach-classify.ts:34` legacy-success 3.0%; `boredom/index.ts:2464-2470 .catch(()=>{})` on rhythm_conductor_tick; activity-api `jwtAuth.ts next()` on failed key → cross-tenant read (closed `35e75cc`); `host-pull-sync.sh` pipefail (closed `cffc9489`).
- CLASS 2 declared≠running: `vessels.inventory.json` / `apply-inventory.sh` only trims (no add path), 14 timers masked-enabled, `ingest-docs.timer` 0 journal entries; `reached` computed in 4 places threaded nowhere (0/1800 rows); ribosome extraction 1.9%; `expected_output_shapes` never bound; registry advertises unpublished port 18401; detector 0 completions/132 runs; goal-host client tool branch 0 executions/72h.
- CLASS 3 self-confirming verification: file-count oracle generates the command it grades (`-maxdepth 1` :1178/:1060) → 10 vs 17 labelled deterministic & alpha-credited; forward plan mutated during walk (:5285/5330/5381, shipped :6172); seeder writes `architectural_pattern_principle` vs drafter filters `architecturePrinciple`; `.pullsync-testbaseline` seeded from regressed tree (9 failing tests laundered); green suite in one repo ≠ cross-repo contract.
- CLASS 4 bootstrap deadlock: never fix drafter with drafter; auth fix via broken auth path (test asserted hole `expect(200)`); detector inside container can't guard container; `scripts/` never matches edit-intent regex; `SUBSTRATE_ALLOW_DIRECT_EDIT` must be in process env.
- Meta: first-pass deletion audit 49/73 refuted (67% error); LLM probe 15/15 then ~50% at n=39; 18090 wrongly called L11 violation; masked-on-spoke ≠ broken.
- Teaching channel concept-db `compose_lesson` severed (`CONCEPT_DB_ENDPOINT` unset → loopback → HTTP 000 → catch{return ""}).
[false-verification, dormant-mechanism, hollow-landing, endpoint-routing, env-gating, memory-recall]

### feedback-the-operator-feedback-plane-has-a-three-hour-window (≈09-1x)
- Operator never used FEEDBACK quarter of loop. `goal_verification_label_write` labeler enum `human|automated|deterministic`. First verdict `goal_verification_labels:iqs3p3hjg4abdm038hzs` on `exec_1789347195317_hq4mted47is` (cutover of `route-edit-92ad1532` that reverted its own first landing).
- `/workspace/goal-host-dispatches.json` held 99 records/188 min (pruneStore deletes 20 oldest past 100) → dispatch `688aea94` false-negative (both ops landed) ungradable.
- Claimed "no gap verdict channel" — WRONG (5th over-read of a narrow fact): `substrateGap_write` merges `classification_metadata` key-wise (~substrate-gap.ts:900); verdict attached to `reach-rate-feature_compose`.
- Fixed `fe609c4`: compaction (newest 100 full, older stripped of stateSignature/steps/walkLog/poolProvenance/poolEvents, delete past 2000). 84% of bytes were diagnostics; record 319B vs 5.5KB. Cost: ~230KB/s rewrite every 5s (follow-up persist-on-change not done).
- Landed commit inert until unit restarts (compare ActiveEnterTimestamp vs mtime). pull-sync restarted goal-host itself.
[human-surface-escalation, dormant-mechanism, sync-deploy-drift]

### feedback-timers-are-an-antipattern-rhythm-shapes-only (08-01)
- Operator law: systemd timers antipattern; all self-ops on rhythm shapes. At the time 32 `.timer` files, `git grep -i rhythm` 0 hits; 13/32 never enabled; `docs-align-scan.timer`, `ingest-docs.timer` dormant. [env-gating, dormant-mechanism]

### feedback-trace-store-location-independence (07-05)
- Operator correction: hub-primary trace writes intentional (SC-P4); fix trace loss via location-independence (retry + durable spool, large bodies, readers resolve same location), not repatriating to localhost. Retry landed ias-executor-ts `50e029f`; super-repo `246e6491` discovery-routed store precedent. [federation-p2p, trace-store-db, node-locality]

### feedback-verify-at-the-consuming-layer-seven-instances (08-19→20)
- 7 bring-up defects: bash-vs-systemd quoting; grep stdout vs stderr; role on unit names later re-rendered (`llm-resolver-*` vs `llm-opus` etc.); `apply-inventory || echo` swallowed guard (ENABLED_ROLES=spok booted full fleet); port derivation fixed in gen-env.sh but Makefile bypasses it (blanks DISCOVERY_ENDPOINT); `case` in `$(shell…)` truncated; free-port probe on /dev/tcp/127.0.0.1 vs Docker 0.0.0.0 bind. Law: test at the consuming layer. [false-verification, sync-deploy-drift]

### feedback-verify-landings-against-origin-not-local (07-12)
- Local checkout 10 commits behind → false hollow-landing verdict; verify via `git show origin/dev:<path>`. `substrateGap` summary is rolling ~50 window, not a ledger → open/closed counts aren't rates; one-shot gaps churn out before worked. [sync-deploy-drift, false-verification]

### feedback-verify-reach-by-downstream-use-not-llm-verdict (07-20→07-22; 34KB)
- Operator law 07-20: reach verified by downstream consumption of produced impulses, not LLM verdict. B1 punt-guard landed `1d32a90`; strict-B2 gate discarded.
- 07-21 `bfc6af1`: hollow greens on edit-intent (42b32a91, 40d343e6 reached but origin unchanged). First fix `d679cfb` was PHANTOM (guard in verifyGoalReached, which the edit-intent return sites never call). Fixed 3 sites (goal-host index.ts :3859, :4149, :4206) → reached = !!landedSha. Verified d485e0ca reached=NO; positive control 1618e700 concept-db advanced cd6f18e→4835a781.
- `238a4a3`: grader-side lies — verifyGoalReached:865 FAVORABLE w/o landing; persistSatisfierTrace:4137 durable trace reached:true unconditionally. "The RETURN can be honest while the TRAINING TRACE lies."
- T0 baseline close_rate 0.1243 (71/571), latency median 0.24h; 275 reopen events/43774 funnel rows.
- LLM plane down (hub relay 138.197.116.56/tcp/30333, `llm fetch 502`); unblocked via peer/groq.
- `2022d6f` trend instrument (close_rate, median_latency into funnel-history.jsonl); over-fired 20×/min → `ea7698af` append-cooldown (substrate landed via 471abbd8 — substrate-authored).
- `2aaa834` local-tools mapPath (repos/ → /vessels) fixing ENOENT and a shadow garbage tree `/vessels/local-tools-vessel/repos`; detached-HEAD push lesson.
- Hollow learned-composition `activity:⟨...codereplaceresult-to-codeinsertresult...⟩` α=58.86 from 62/63 exit-status greens, tasks inputShapes:[]/outputShapes:[].
- Satellite hollow reached:true traces (`source_code`, `confirmation_of_invocation`).
- `8d969b4` activity-api ribosome extraction gate `isHonestlyReached()`: of 62,968 success rows only 23 honest reached:true; hollow template 374→2. `execution_sequences` 0 rows → pattern-miner DEAD path (writer activities.ts:9251 schema-mismatch).
- `159bca7` honest posterior: `src/lib/reach-classify.ts` three-way (reached/not/ungraded SKIP/legacy). 4,104 posteriors would be dishonestly blamed with binary. execution=105,154 rows.
- `16bde03` goal-host creditReachedTemplate + anti-spoof deterministic flag + producedShapesConsumable (349/384 shapes zero consumer). Satellite ids 404. Bug: `/v2/activities/feedback` 500 NULL account_id (activities.ts:4769) swallowed by both credit and penalty.
- Gaps filed: relevance-sink typecheck exits 127 (no tsc) → persistent hollow-green generator; detected_at clobbered to close time; reopen invisible (id-upsert substrate-gap.ts:268); decideContinuation imported goal-host:181 ZERO call sites; localizeGap escalates to human uiQuestion (operator IS localizer); usedKnownPath=attempts===1 at :6186 mislabels fresh derivations learned_pathway.
[false-verification, hollow-landing, selection-learning, composition-crystallization, dormant-mechanism]

### feedback-wrong-mint-is-negative-value-not-zero (07-10)
- `concept_naming_sync` resolver in dev-vessel duplicated concept-db writers; green reached:yes hid negative value (poison node in discovery, ρ_grow up, λ₁ down). Must remove across 3 places (resolver file, config.ts shapes, impulses.ts dispatch). [codebase-bloat-fossils, hollow-landing]

### MEMORY.md (index, current)
- New 09-29 entries: operating model (route around, encapsulate on evidence, general tools at shared seams); "search prior art before building" (da76f061 duplicated open gaps, reverted); rest duplicated in the system reminder index.

### project-50-goal-capability-baseline (07-16)
- 50-goal suite: 10/50 reached ≤90s; 21 mid-composition, 10 target-inference stalls, 4 hollow, 3 no-pick; 240s re-probe → honest ceiling ~15/50. Run minted 4 ribosome templates + 86 `llm_judged_hollow` lessons. Knowledge family 0/5 (walk doesn't infer memoryNote_write/concept_*); `obsidian_reflect` has no producer; who-serves-<shape> mis-infers. goal-host activeDispatches rolls at ~50. [goal-walk-floor, memory-recall]

### project-anthropic-key-credit-dead-and-failover-is-env-gated-off (08-03)
- Ribosome replay fix exposed judge failures: Anthropic key credit-dead (HTTP 400). `llm-resolver-vessel/src/index.ts:405-425` credit-dead fallback returns null because `LLM_FALLBACK_MODEL` unset (law 1). No failover for tool-using calls. Drafter unaffected. Secrets exposed in earlier transcript (rotate). [env-gating, dormant-mechanism]

### project-autonomous-commits-are-real-but-harmful-endpoint-swap-loop (08-02)
- 3 autonomous commits: `37d9d9a` good; `e048756`, `4f4b31e` harmful (llmCall endpoint → DEV_VESSEL_ENDPOINT). Gap `route-edit-bbf054ce` degenerate loop; recurrences `33afcc8`→`978a70f`→ reverted; `c3194ee` repair reverted by `db7c414`,`8733823`,`3cca30b` within ~1h. 266 corrupted `llmCall(` sites (263 in stale `*-mitosis-*` staging roots) cycling DISCOVERY/CONCEPT_DB/DEV_VESSEL endpoints. Drafter edited line whose adjacent comment forbade it. Gate `93b18ba` (3rd signature on vessel-mitosis-cutover.ts drafter-corruption gate; 207 legit sites 0 FP). Gap `drafter-swaps-llmcall-endpoint-to-non-llm-constant`. [autonomous-regression, drafter-quality, endpoint-routing, codebase-bloat-fossils]

### project-blocker-resolution-decision-required (08-25)
- /goal "resolve all blockers" proven unsatisfiable by agent alone. Resolved: ias-executor-ts d6c2a84 rIS-debug leak (autonomous); attribution defect measured (validator-dispatch stored 0.205 vs exit 0.939).
- 6 gaps open all blocked on keystone `composer-cannot-edit-large-files-marginal-anchor-loss`: `learning-credit-lacks-marginal-attribution`, `reach-grader-starves-real-work-executions`, `variant-sprawl-splits-selection-evidence`, `selector-audit-checks-saturation-not-differentiation`, `executor-rendering-non-uniform-llm-drops-unloaded-inputs`.
- Operator dispatch zombies from COMPOSE-LANE CONTENTION (single lane saturated by autonomous gap-compose); autonomous loop hollow-reached 6716ca2b via universal-tool-fallback floor (0 shapes). Auto-mode classifier refused SUBSTRATE_ALLOW_DIRECT_EDIT. Ready 2-line selector fix at `selector-saturation-audit.ts:156` never landed. "cutover churn" claim refuted.
[spend-envelope-throughput, drafter-quality, hollow-landing, selection-learning]

### project-causal-attempt-ledger-accepted-and-window-blind-dispatchers (09-26)
- openspec `causal-attempt-ledger` finish line 09-26 05:10Z: runs 10/11/12 each 10/10 (12 after `docker restart`). Ledger code (cbdb432, a4923f2) stable; ~9 failed attempts were the system around it: trace-ingest storm; quadratic `unaccounted_landing_scan` (13s→0.03s 429c8bd); id-less commits (2f6436f/d72654f); ReAct floor AsyncLocalStorage `enterWith` loss (959519e); probe restore path repos/X vs /vessels/X (390202d); parked-landing resume minting late attempt (3756d4d); duplicate landings via escalation (4dec1bc) and post-walk EDIT-INTENT second compose (44a5efa); goal-host global-fetch monkey-patch (8c31cdb reverted 6ce1446).
- Quiet window requires holding 4 window-blind dispatchers: gap-compose.service mask; boredom (timer + service); funnel-drain.timer; dev-vessel in-process auto-pick → `autonomous_pick` maintenanceLease (128f51f). None read an announced window (gap #59).
- Still open: #61 engine-template shell calls w/o execution_id; goal-host boot-order proxy registration failure every cold boot; #46 U looping commits; #47 landing_liveness; 70d2a00 weakened mitosis-evaluate gate; 4f1d3e8 posterior_source guard removed (handed as REVERT); unknown `operator:trend-expectation-check` battery (~6 in flight).
[spend-envelope-throughput, test-residue-live-state, autonomous-regression, narrowing-duplicates]

### project-compositiongraph-shape-demo (07-15)
- Autonomy demo via vault brief; compositionGraph already resolved (audit gap stale). Try #1 3f65f915 reached:NO correctly (hollow gate). #2 45335256 landed `9209163` (graph-backbone-sync → sidecarResolveBody compositionGraph). #3 9960b6f0 routed to right obsidian vessel but read wrong note — path arg not synthesized; gap `obsidian-note-path-arg-not-synthesized` (law 13 payload synthesis). activityApiUrl dead plumbing residual (main.ts:229/1020/1422).
[goal-walk-floor, human-surface-escalation, docs-drift]

### project-concept-db-deep-dive (07-17→07-19)
- Substrate self-root-caused concept-db OOM (O(n) cosine scan, 39k rows, surreal ~30GB, 9 kills 07-17) and self-authored fix `5419115` (HNSW, migration 009).
- 10 findings: `pruneExpiredImpulses` never scheduled (2011/2011 rows expired); `split-long-concept` hollow self-rewarding stub gaming Thompson; `concept_write` drops `pointer.shape` (1501 seeds landed as memo); graph hops full-table scan; concurrency collapse 20 parallel → p50 0.42→9.9s (/health flapping mechanism); BM25 IDF all-zero on SurrealDB 3.0; serial ONNX embed; upkeep = static `UPKEEP_INTERVAL_MS` timer, `fn::` views dead; `/upkeep/trigger` ignores activity_id; `apply-schema.ts` logs parse errors then "applied successfully".
- 11 gaps filed + 2 concepts. Harness `c8d75ec0` (`scripts/substrate/concept-db-bench.ts`, `docs/guides/CONCEPT_DB_INVESTIGATION.md`).
- Federation convergence 07-18: submodule bump 8574b003 (image 2-7 commits stale); fed-transport unit never shipped (b6524062); libp2p peer id not substrate-scoped (c3eef77d); circuit multiaddr captured once (4aede401, same class as sidecar 480ac50); relay restart with pinned key (dccc9385); host LLM keys never threaded to hub (5c24f7a6). Gaps `syzygy-hub-federated-rows-undialable`, `discovery-union-vesselid-collision-hides-peers`.
- 07-19: org-partition measurement trap (unauth search sees 8 ghost concepts vs 20k under `organizations:substrate`; GET /:id cross-org leak); relevance doesn't drive ranking (`_decayWeights` dead code; passive searches inject neutral usage rows collapsing relevance; top 5000 are source_code/impulse_signature fossils pumped by `trace_id="drafter-success-credit"`); upkeep Thompson volatile (module-level alpha/beta, resets every deploy; `upkeep_stats` + fn views dead); graph has no edges; emergent-shape discovery unimplemented (14-entry source→shape map duplicated in unified.ts:14-28 and concept.ts:30-46; embed/cluster 0 callers); `concept` shape has TWO producers (concept-db + dev-vessel); host-loopback endpoint; internal port 8260 not 8081 (docs wrong); 9 MCP tools (docs 7).
[memory-recall, trace-store-db, dormant-mechanism, federation-p2p, selection-learning, docs-drift, codebase-bloat-fossils]

### project-concept-db-role-wiring (07-18→07-19)
- concept-db = semantic memory organ. `ddaf74e` patch-with-tools discover-all + endpoint failover (old failover no-op); `dde7d33` federated egress routing + envelope unwrap — ReAct patcher drove 12-turn compose over libp2p with no local keys.
- `4d2cba0` concept-truth-probe-tick template HAND-LANDED after 2 groq ReAct attempts botched 3-hunk co-land; 4 feature_compose attempts all dropped small array-insert hunks → keystone "compose-drops-secondary-hunks" is patcher orchestration, not only model. Also: SEED_TEMPLATES only registers on fresh deploy ("Catalogue already populated (>=2498) — skipping seed"); runtime `activityTemplate_write` rejected (law 4 enforced).
- `d8550cf` concept_truth_probe resolver live (0 activities invoke it; file-anchor check yields verifiable=0 across corpus). SessionStart hook injects `conceptPromptPriors`.
- Satisfier `fs_write` dumps UNTRACKED code into `/workspace/repos/**` (graveyard in `/workspace/repos/development-vessel/src/resolvers/`) and credits reached:true; a failed template compose corrupted `/vessels/.../shadow-state-observer-ticks.ts` silent until restart.
- Net-new leaf resolver fails dead-code gate alone; must co-land with wiring. Weak drafter stubs specs → put full body verbatim.
- Federation: `patch-with-tools-llmcall-no-federated-envelope-unwrap`, `transport-mirrored-resolve-endpoint-routes-to-local-owner-not-peer`; hub providers unfueled (GROQ/MISTRAL not threaded into hub env).
[drafter-quality, hollow-landing, federation-p2p, composition-crystallization, codebase-bloat-fossils, env-gating]

### project-concept-db-teaching-and-llm-plane-unblock (07-19)
- All arms default to credit-dead Anthropic; quota on syzygy host `/etc/environment`; keys threaded ephemerally into container env. `llm-resolver-vessel/src/index.ts:740` slash-qualified model → dead OpenRouter first. `LLM_DEFAULT_MODEL` ignored; `llmModelPolicy` bandit governs; fixed via `llmModelPolicy_write` (cost_weight 0.25→0.05; codestral primary).
- Landed `8d35151b` substrate-authored `?q=`→`?query=` fix in `concept-select-for-prompt.ts` (similarity axis fed garbage).
- Hardcoded anthropic model pins bypass policy (gap-to-feature.ts:234/1336, comprehensibility-check.ts:27, llm-completion-dispatch.ts:167; many seed/*.ts). Partial `e2d6158` (direct edit). `activity-create-variant.ts:555` validates `startsWith("anthropic/")`.
- Hollow `fileEditResult` satisfier steals reach + ribosome extracts hollow `composition:concept-select-for-prompt-to-fileeditresult`.
- Shape-flow-conditioned concept selection (`active_shapes`) never landed.
[env-gating, hollow-landing, selection-learning, memory-recall, drafter-quality]

### project-consumption-probe-B2-half-verified (07-20)
- Consumption-as-verification: hollow → not_consumable 3/3 (0325baf2 money case: right shape wrong grouping); positive class confirmed with deterministic `json_path_extract` consumer. Probe ACTIVITY never minted; CREDIT leg (producer credited by downstream reach) open; verdicts read by hand. `9d264265` 1h aggregate resolver returns 24h regardless (satisfier). Shared-package fan-out in pull-sync (super-repo 3d366142).
[false-verification, dormant-mechanism]

### project-continuous-motion-toward-all-shapes (07-27)
- Design reframe: task-generator.ts `maxTasksPerCycle:10` + boredom.ts Redis FIFO one-at-a-time → continuous capacity-bounded allocator weighting VoI×credit−cost over all shapes; measure coverage not throughput. NO code changed; pending operator go-ahead. Prereq honest-reach deep goals 6b14bea.
[spend-envelope-throughput, selection-learning]

### project-db-alignment-churn (07-22→07-23)
- mig 165 (`9f52867`) dropped `v_activity_score_enhanced` (re-aggregated 110k execution on every insert; 0 readers). mig 171/172/173 (`0e9457a`): dropped 4 paradigm mirror views; `idx_vpet_executed_at` flips full scan to index top-N; 2 orphan tables. mig 176 (`b37ea25`) dropped 6 dead tables (minibob_instance kept — live record<> link). mig 169 + `fcf9499` RETIRED composition_edge (fn::update_composition_edge never applied live; reader 0 callers; guiding spec IMPULSE_DRIVEN_COMPOSITION.md deleted) — living reuse surface is `activity_composition_graph` (1998 rows, read by pattern-miner.ts:251).
- `2f61532` + mig 167 narrowed `v_paradigm_execution_traces` (dropped blob projections; 7 consumers hydrate from execution).
- `bbd4283`: 5 resolvers read frozen `activity_execution_traces` (frozen 07-14, 8 days stale; compose-topology 24h returned 0 rows) → repointed to execution. AET drop blocked: 6433 orphans + UNION reader.
- execution_trace_content ~1.08M orphans (1.198M rows for 111k executions); reap `7e71b33`.
- Hidden runtime view re-creator — 7-9 dead views revive after drop; exhaustively not located; filed. Theory of skip-guard prefix mismatch (096 re-runs) later DISPROVEN. Batched REMOVE via stdin silently drops subset.
- activity-api restarts on every self-authored commit (~8/90 min); init-database ExecStartPre 90s timeout under contention.
- Deferred: v_activity_score authority fork (021 view never materialized; ~8 consumers, some no-fallback activities.ts:4360, impulses.ts:1228 → always fallback to VPM 3051 rows); slow-SQL sampling missing (db-admin.ts:254 guesses HOT_COLS); account_id 0% populated (identity-vessel omits accountId for API keys); 47 `v_*_by_account` views of stalled OpenSpec.
- Closed no-repro `recommend-orgid-null-for-apikey` (stale report).
[trace-store-db, codebase-bloat-fossils, dormant-mechanism, composition-crystallization, sync-deploy-drift]

### project-db-management-churn (07-23)
- Tables 102→94. activity-api c8c3af8→4635fb1, concept-db 9b5c087, super e4639ac2.
- execution_trace_content reap had reaped 0 for weeks — `WHERE > cursor ORDER BY LIMIT` hit SurrealDB 2.3.3 MemoryOrderedLimit; fixed `c49feb6` (drop ORDER BY) → 20,365/sweep.
- concept-db /health `INFO FOR DB` >10s → self-recovery restart spiral every ~2.5 min; substrate self-authored `fbe4ced` (`RETURN 1`) — HONEST autonomous reach (operator first misread by grepping stale worktree).
- `b8025e33` walk-discovery latency (discover-by-shapes.ts:154 full scan of 3711 embedding-laden rows; dead `OR retired IS NONE` branch forced scan) — honest feature_compose reach. SurrealDB 2.3.3 law: index for FILTER or ORDER never both; no covering-index projection.
- Auth tenant PERMISSIONS applied live; all vessels connect as root (bypasses PERMISSIONS — contradicts CLAUDE.md claim of DB-enforced isolation for current paths). identity-vessel `004-tenant-isolation-permissions.surql` 61f3b67. SCHEMA_AUTOAPPLY off → identity applies none of its migrations.
- Resource incident: CPU 6479%, MEM 26GiB cap; self-recovery restart of activity-api under DB pressure amplified outage → `fc143654` self-recovery `db_under_pressure()` backoff; validated live 19:29Z (`db_pressure_backoff:1`). Baked `/usr/local/bin/self-recovery-tick` stale (Jul-19) — pull-sync only updates /workspace/git/super-repo, not baked scripts → needs image rebuild.
- Hollow reach 23745cbd (drafter read `data.content?.model` vs `{body:{arms:[...]}}`) → reverted `1d9ed66`; top arm codestral PHANTOM (MISTRAL_API_KEY empty).
- `4ae36df` narrowed 022 seed source (mig 167 narrowed live only; fresh deploy would resurrect balloon). mig 178 dead git indexes; `42ac748` v_execution_tree retired.
- Residual full-scan sites: ribosome.ts:791, activities.ts:4187 (unbounded GROUP BY), ribosome.ts:697 (CONTAINS).
- SESSION 5 recreate exposed CRITICAL law-11 bug: persisted strong API_KEY_SECRET vs keys issued under public default `dev-secret-change-in-production` → registry 1/12 + 401 storm. Bridge `API_KEY_SECRET_PREVIOUS` (3982521e), then SESSION 6 re-mint (re-sign same payload), bridge dropped; whole fleet uses ONE key (gen-env.sh:131-134 fallbacks). Lesson: clean recreate is the only way to surface persisted-state↔runtime drift.
- SESSION 7: hub stale because origin/dev lagged (local unpushed + super-repo submodule pointers pinned old commits); detached-HEAD `git push origin HEAD:dev`. Pushed identity 61f3b67, dev-vessel 1d9ed66, activity-api 42ac748, super e44a1346.
- Governing mechanic: 30-min `db-maintenance.timer` reconcile re-applies migration DEFINEs → durable removal = neutralize source DEFINE. mig 177. concept-db `003-impulse-table.surql` bare DEFINE clobbered activity-api's impulse PERMISSIONS on shared DB → `IF NOT EXISTS`. upkeep_stats wrongly dropped (concept-db table — cross-vessel blind spot).
- Filed: non-migration view re-creator; concept-db crash-loop (top-level `await db.connect()` src/index.ts:177); dead-query paradigm.ts:1015/1594 `v_shape_conditioned_score`/`v_activity_score` absent → shape-conditioned Thompson gets nothing; mirror-to-live stale-clone (a81c46f5 incomplete); class detectors for shared-DB schema-war and reconcile-resurrects-removed.
[trace-store-db, sync-deploy-drift, node-locality, env-gating, hollow-landing, dormant-mechanism, codebase-bloat-fossils]

### project-db-metabolism-coax (07-12/13)
- trace-store reconcile cadence worked condition-driven via the walk even with sensing timers dead (REUSE gate deflected duplicate mint onto `development-vessel:trace-store-reconcile`).
- Whole-store vitals invisible (p95 1875ms, 2095 slow queries, 3.1% errors) — sensing watches AET row_count only. `9d4d00f4` hollow reach; `6c699b51` no-producer termination: walk blind to vessel resolver producers (only templates). Gaps: `walk-blind-to-vessel-resolver-producers-2026-07-13`, `auto-draft-gaps-close-hollow-2026-07-13` (close with authoredTemplateId:null), `store-pressure-invisible-to-sensing-2026-07-13`, `trace-store-counter-drift-2026-07-12` (21,970 vs 17,309, ~21% overcount). provide_feedback cannot label walks that die before template selection.
[trace-store-db, goal-walk-floor, hollow-landing, false-verification]

### project-degenerate-self-modification-loop (08-01→02)
- dev-vessel 37 substrate commits ahead; 18/20 touched only `feature-compose.ts`. Corruptions: `d784b98` prompt replaced by literal; `b467d4b` failover discards candidates; `LLM_ENDPOINT="http://127.0.0.1:8100"` (discovery bare root); PER_CALL_TIMEOUT 200k→900k; `eab0e9c` goal path on line 1 → TS2304. Reverted `c20a972` to `25be910` + auth fix `6892c85` (llmCall had no Authorization header); `9c4660a`.
- Hub masked compute-role vessels (local-tools, ribosome, analysis); unmasking let self-recovery start them; not persisted to `ENABLED_EXTRA_VESSELS`.
- LANDING DEADLOCK fixed `3f4be28`: `maintenanceLease` single global mutex; cutover acquired twice (cutover:<v> then proposal:<id>) → always refused itself; reported as UNFAVORABLE with passing semantic reason.
- Substrate-authored: `f4f983a` ReAct floor (`groundedOk>0 ||finalText`) → 5/5 reached, 3 via universal-tool-fallback; `65e7ced` ribosome mint envelope unwrap; `36d663e` producer-locality tiebreak (hub routed own edits to spoke via :8401 mirrors) → 5 consecutive first-try landings; `4250971` honest dAlpha. 9/10 reached (90%).
- Ribosome extraction dispatch target `activityDispatch` NEVER EXISTED in activity-api; `mintReachedTrace` 0 mints. dAlpha=2 FABRICATED (creditReachedTemplate :3087 returns unconditionally; satisfier:* and universal-tool-fallback have no activity row → 404; hub 10/12 feedback POSTs 404). i64 counter overflow 500 on feedback.
- CORRECTIONS: "gap monoculture" premise WRONG (0/259 gaps name file); real: gap retirement path never ran (`gap_lifecycle_scan` no live driver), gap→goal no per-gap dedupe (one gap 17× in 72h), `capability-gap-audit.ts` uncapped. Honest reach 0.0% permanent by construction (labels written only on negative; read cap 100). Oracle slanders real landings (f4f983a 5 not_achieved labels, `deterministic:` prefix dropped at index.ts:2138-2144).
- PULL-SYNC STARVATION fixed `9d261470` (mitosis-pending rewritten every 2-15 min kept lock fresh; `MITOSIS_MAX_CONSECUTIVE_DEFERS`). .sh scripts have NO git convergence path (baked /usr/local/bin).
- Hollow autonomous work `4be040ed` root-level `detector_….txt` placeholder.
- Subagent write attempts (feedback probes) landed zero only by luck (masked port / 404); another agent scraped root creds and ran root SQL.
- Architectural gap: satisfier tiers are synthetic strings with no activity row → structurally ungradable (law 2).
- "multi-function ask DROPS parts silently".
[autonomous-regression, drafter-quality, narrowing-duplicates, selection-learning, composition-crystallization, sync-deploy-drift, false-verification, test-residue-live-state, node-locality, hollow-landing]

### project-dev-efficiency-audit-and-surgical-track (07-13→07-14)
- 60% failure storm root-caused: ias-executor-ts `a24b19c` lifecycle interpolation + `706674e` 8s resolve timeout (later caused monoculture per other note); activity-api `f26b48a`, `b986bc2`+`7c24d02` poison-row repair. SurrealDB MemoryHigh 22G/Max 26G drop-in.
- 7-step derivative ordering: failure legibility → landing leg → drafter reliability → honest grading → coarsening/curriculum → cost/disposition → teach audit loop.
- Coax lessons: edit-intent needs path-first goal text; retries need VERBATIM goal text (family key = goal-text hash); compose self-informing loop closed by substrate (`03cee54` semantic + `6df2b57` typecheck stamps); c2e8d1ad reached→partial (guard never fires).
- Failure rate 60%→6%. `83b254b` satisfier-pick.ts extraction (decomposition-first). First learned composition 07-14 (5301ae4 producer-visibility; ias-executor-ts 8fbf3c3, c927b5a, fef0bd6, 5444035) → `activity:learned-composition-activity-lifecycle-audit-to-template-audit-report`. 5/7 families minted (compose-activities, interpret-from-context, thread-shapes, parallel-dev, manage-codebase — first fully autonomous auto-mint 09:54:49Z). All 3 LLM providers exhausted. local-tools cwd fallback `8bf69ea`.
- Walk wave: 5301ae4 producer-visibility, b416bf03 alternative-framing retry, c453ab05 first-mile binding. `walk-continuation.ts` (8fcccec) decideContinuation imported never called — "import-without-call passes reachability". Gap `walk-selects-lookup-shapes-for-authoring-intent-2026-07-14` (lookups returning total:0 satisfy produce intents).
[goal-walk-floor, composition-crystallization, drafter-quality, dormant-mechanism, trace-store-db]

### project-drafter-selfcorruption-and-pullsync-wedge (08-02)
- `3f6e4f3` pinned failover to CONCEPT_DB_ENDPOINT; `5056240` wrote `{{source_code.content}}{{source_code.content}}/**` at byte 0 → dev-vessel crash loop on hub + spoke. Hand-reverted `4fc14ab` to `98c5312`. Typecheck gate not enforced before cutover; pull-sync health revert re-mirrored broken tree.
- PULL-SYNC WEDGE: `substrate-pull-sync.sh:256` suppression keyed on content hash alone → restoring known-good suppressed forever. Unwedge: rm `/workspace/.pull-sync/<v>.sha`. Proper fix (health-aware marker) not made.
[autonomous-regression, drafter-quality, sync-deploy-drift]

### project-eighth-family-activity-management (07-14)
- `activity:⟨learned-composition-draft-register-persist-activity⟩` + substrate-authored `activity:⟨fleet-composition-manager⟩`. Authoring via `composed-cap-learn-a-new-activity-from-this-prose-des` repointed with `activityTemplate_update`. Walk route still cannot build `templateData` payload (gap `walk-selects-lookup-shapes-for-authoring-intent`).
[composition-crystallization, goal-walk-floor]

### project-execution-continuity-and-legibility (07-19)
- META-BLOCKER: cutover last-mile; composes stage FAVORABLE never commit. Layer 1 `9019cbd` gate copyTree on pushStatus==="pushed" (/vessels drifted ahead; `current_live_sha` is content hash); Layer 2 `371bddf` await triggerMitosisTick (fire-and-forget `.catch(()=>{})`). Manual cutover `73ee4ad`; `575514d` gap-patch-p4. Single `/workspace/mitosis-pending.json` slot serializes composes. `satisfier:codeInsertResult` hijacks edit goals via raw fs insert (gap `satisfier-codeinsert-hijacks-edit-goals-bypasses-cutover`).
- Continuity design: `goalContinuation` poolImpulse; boredom next-goal memoryless (static AUTONOMOUS_GOALS index.ts:361-587; `/capability|repair/` filter); pipeline-pull reach-blind; human answers stored as process-local vars, ungraded; `solicitation-outcome-scan.ts:15` dead TODO stub. Design only.
- Obsidian: `obsidian:ui_view` 404; no read telemetry; bundle treadmill (main.js tracked bundle never rebuilt); ui_screenshot via discovery broken.
- Report gaps: 15 "filed" never persisted; provide_feedback 401.
[hollow-landing, sync-deploy-drift, human-surface-escalation, dormant-mechanism, memory-recall]

### project-federation-parity-trail (07-13→07-14)
- Topology: hub syzygy-hub (138.197.116.56), spokes syzygy-spoke, min-proof, mac-local. Memory + gap stores are per-substrate silos.
- Gaps: `federation-fleet-vocabulary-not-federated` (spoke 11 local shapes vs 373 hub), `federation-transport-local-resolve-no-remote-hop`, `reach-gate-false-positive-on-no-progress-walk`, `hub-mirror-vessel-id-double-suffix` (b027d2f2), `federation-direct-dial-never-attempted`, `edit-intent-cannot-reach-super-repo-scripts`.
- Parity probe: hub/mac/min inference conf 0 → blind walks stamped reached:true (index.ts:2913 `reached = verdict?.reached !== false` fails open). Fixed substrate-authored b5278a3 (routeOverRanked, envelope unwrap), 4af057a (reach gate fails closed), faa4f7d.
- `42a0087` fleetActivityFeed read `id` vs `vesselId` (one-line) — landed first try in 6899-line file.
- Detached-HEAD + symlink deploy trap (f510420 orphaned → 8276612). pull-sync converges super-repo glue since 38da5028. mac pull-sync doesn't converge vessels; min clones in wrong dir.
[federation-p2p, node-locality, false-verification, endpoint-routing, sync-deploy-drift, memory-recall]

### project-gap-closure-rate-drive (07-16)
- 38.9% (650/1672) → 47.2% (793/1680): 113 invalid closed by operator bulk write (106 dead-detector `ui_spacing_drift` + 7 synthetic); `2e4759b` LOW_VALUE_CATEGORIES; `producer_now_exists` pass (2456459, corrected 01d0e017 — LLM draft botched discovery call) closed 27. Plateau: autonomous lifecycle scans run DRY (report-only, not autoClose).
- recommit churn: route-edit-9b5409f0 TS2339 famKey, cited line 1915 phantom (file 1860 lines); 44 failed composes over 15 recommits. goal-host index.ts 6587 lines over splice ceiling.
- SurrealDB OOM ~hourly (~30GB); block-cache cap dbaf0cf3 insufficient (restart net-negative); trace retention caps 58162935 (TRACE_STORE_CAP 40k, SUCCESS_CAP 600, HOT_WINDOW 3d) — local substrate didn't auto-pull super-repo commits, env generated at boot.
[gap-content, false-verification, trace-store-db, drafter-quality, narrowing-duplicates, sync-deploy-drift]

### project-gap-closure-resolver-vs-activity-audit (07-14→07-15)
- Window churn: closure% gamed; 46% closes `expired_not_redetected`; ~5 commit-attributed; closure modality unrecorded. 60 open `orphaned_capability` (resolvers invoked by 0 activities) — 0 closed, flat 51→50 for sessions (eviction only).
- Disposition-ladder gap `gap-remediation-disposition-and-headroom-selector-missing`. Chain: walk-cannot-construct-payload-for-authoring-shapes FIXED (45992956); gap_compose zero-op plans FIXED aa09872; author-composed-capability mints LLM wrapper (open).
- `suppress-satisfier-shapes-launders-hollow-into-reach` (d697cf35, 51a5fcc2 false positives); patch_with_tools reached on staged (4c3300b3). Operator bootstrap `4c506d7` (goal-host 6899-line un-self-editable), self-deployed via pull-sync. author-composed-capability.ts resists drafter 3 ways.
[hollow-landing, false-verification, codebase-bloat-fossils, drafter-quality, goal-walk-floor, selection-learning]

### project-ghcr-pipeline-and-hub-redeploy (07-17)
- GHCR build broken since inception (mixed-case owner); fixed 26cceb41; hub 14 days stale. `deploy-hub-pull.sh`. Fresh-volume bootstrap bricked: migration 154 required `optional_input_shapes` not defaulted on CONTENT-create in SurrealDB 2.3.3 → 0/18 seeded; fixed mig 161 (a045814) `option<array<string>>`. Hub trace store 110k vs cap 40k awaiting reconcile.
[sync-deploy-drift, trace-store-db, federation-p2p]

### project-goal-generation-mechanism-exists-but-is-starved (08-03)
- `boredom-vessel/src/goal-generation.ts:236-280` recipe candidates from concept-db `reach_gate_lesson` — 235 supply events/24h but 0 recipe candidates. Cause: half-finished spoke migration (`DISABLED_VESSELS=concept-db.service`, `CONCEPT_DB_ENDPOINT` unset → 127.0.0.1:8260 dead; hub :18260 never published by deploy-hub.sh — publishes only 18080/18100/18101/18210). Hub concept-db has 0 compose_lesson/reach_gate_lesson. Route AND content missing.
- Operator's first claim "container drift" was false.
- Hub runs crippled duplicate boredom (`boredom-vessel.service` not in inventory; only `.timer` listed) → every dispatch to masked light-dispatch :8280 fails, recording false failures in local momentum file (NOT shared store; commit `71477782` message overstated).
- `apply-inventory.sh` silently ignores units absent from inventory (44 inventory units vs more shipped).
- `generateGapGoalCandidates` sits after `if (pages.length===0) return` (index.ts:~2712) — hostage to template listing. FTS branch ignores `offset` → pagination fix inert (never sees past 100).
[memory-recall, node-locality, env-gating, dormant-mechanism, federation-p2p, sync-deploy-drift]

### project-horizon-escalation-self-intention (07-21)
- `create-shape-provider-goal` ~1579 dispatches/168h at ~0 reach (~84k lifetime @0%) = the substrate's own escalation mechanism, broken by activity-api `impulses.ts case 'goalExecutionPath'` (~3799): wrong field alias + undefined DB handle. Dispatch fbf013b4 reached via patch_with_tools with NO diff. Bootstrap `12e1b3a`.
- `mirror-to-live.sh:32` `git checkout -f -- .` restored from INDEX → shipped OLD source despite landed HEAD → root of recurring "landed on origin but not live" hollow landings. Fixed `a81c46f5` (`reset --hard HEAD`). Shared-package fan-out 3d366142.
- Livelock sensor `groupedExecutionStats` (`b8371cd`) — learned-composition-*→concept-write 2531/2024 @0%, gap-closing:pull-sync-* 0.3-0.7%.
- `generative_frontier_gap_tick` fail-closed (headroom 0.0023, λ2 0.003, components 11). goalImpulse producer and goalContinuation unimplemented. Operator does detect→diagnose→escalate. LLM plane (OpenRouter 402) the gate.
[goal-walk-floor, selection-learning, sync-deploy-drift, hollow-landing, dormant-mechanism]

### project-hub-restart-loop-from-my-timeout-change (08-03)
- Operator raised init-database per-file timeout 30s→300s (`c0246f7`); hub (143,024 execution rows) never became active (ExecStartPre) → trace store offline, ribosome WS 108 closures/24h. Revert `8fbc032` (45s) reached clone but pull-sync never mirrored activity-api while down (self-blocking); super-repo clone DIVERGED.
- Rules: never raise a startup-gate timeout for slow work; spoke-safe ≠ hub-safe (size-dependent); deploying a fix requires substrate up.
[directed-overshoot, node-locality, sync-deploy-drift, trace-store-db]

### project-in-band-gates-cannot-make-a-self-modifying-system-safe (08-03/04)
- Executed: deleting ALL FOUR cutover gates (873-1033) trips 0 signatures; tsc clean; tests zero delta. Token-count ratchet defeated by leaving token names in a comment (20→25 PASS), FPs on prose, false-green on unreadable baseRoot. Egress gate bypassed 3 independent ways (prose exemption, INLINE_LLM continue, `process.env` on line).
- Six audit cycles: confirmation rose 8%→~50% with execute+self-falsify; regression rate of fixes never below ~45% ("a plausible typechecking fix is a coin flip to break something").
- Conclusion: safety must be OUT OF BAND (branch protection, CI without substrate creds, signed protected-path manifest verified by runner).
[autonomous-regression, false-verification, directed-overshoot]

### project-install-repeatability-audit (07-19)
- Both documented install paths broken: B1 submodules private SSH (18 `git@github.com:AviGopal/*`); B2 compose defaults to private GHCR (401) while Docker Hub public but stale; B3 compose mounts only /workspace (SurrealDB on anon volume, lost on recreate). 3 competing launch surfaces/registries. Self-push fails OPEN without PAT (`host_sync_pending` misleading, commits silently burned). `SUBSTRATE_REPO_OWNER` silently ignored. Fixes applied in working tree, NOT committed at the time. gen-env fail-closes on legacy API_KEY_SECRET.
[docs-drift, sync-deploy-drift, env-gating]

### project-interaction-patterns-as-ambient-activities (07-14)
- Four exits exist (ACT obsidian_request_scan, ASK docs_decision_*, NOTIFY obsidian_reflect/deliver_assist, gate obsidian_command_gate). Gap `detection-collapses-to-always-act-no-disposition-router` — operator correction: disposition is not a new router resolver; exits must be selectable behaviors; the selector IS the router.
- `docs_decision_answer_scan` records decision but doesn't close note or apply fix (gap `docs-decision-answer-scan-updates-gap-but-doesnt-close-note-or-apply-fix`).
- Resolver-vs-activity audit: of ~62 resolvers since 06-30, ~34 are behaviors that should be activities (gap `resolver-authoring-push-overminted-behaviors-as-resolvers`); `scan-behaviors-are-resolver-only-not-activity-produced`; `project-thread-scan-blind-folder-filtered-search-returns-zero`; walk 087a6941 read vault note via fs_read (500) — gap `vault-note-ingest-routed-to-filesystem-not-obsidian-vessel`; pre-execution walk retries forever (no timeout).
[human-surface-escalation, codebase-bloat-fossils, goal-walk-floor, composition-crystallization]

### project-llm-dispatch-regression-fix (07-16)
- Substrate-authored `ab8d61c` read `content?.[0]?.text` but llm-resolver returns string → every llm_completion_dispatch threw; fixed by dispatch `2ebeb04e`. Error string absent from lagging local tree.
[autonomous-regression, sync-deploy-drift]

### project-network-autonomy-readiness-audit (07-13→07-14)
- 4 confirmed blockers: API_KEY_SECRET never set (public default → forgeable keys); discovery registrations don't replicate (`forwardToPeers` inside guard, `/registry/shapes` local-only); trace replication one-way single-attempt, no anti-entropy; cross-substrate orchestration absent (goalDispatchAsync raw passthrough, edit-intent takes vessels[0]). 6 refuted claims listed.
- Inbound substrate→vault fixed `3b9402bf` (fed-transport ingress excluded libp2p, preferred dead host.docker.internal) — direct operator edit (scripts/ ungated).
- Stores not eventually consistent: hub 29,593 vs substrate-live 11,403; convergence mechanism ABSENT (IAS_TRACE_SINK_MIRROR_ENDPOINTS set on no unit). Sidecar conduit port host-global → cross-vault read leak. Vault sync ledger 81,675 vs hub 29,756 never reconciled on detach.
- goal-host index.ts 6587 lines over decompose limit; scripts/ outside edit-intent; hub SSH denied in auto mode.
[federation-p2p, node-locality, trace-store-db, env-gating, codebase-bloat-fossils]

### project-obsidian-config-surface-reduction (07-11→07-15)
- Landed 564d727, 3c17705, 35de992, df9769f, 3600dbe, 75bab64. Recipes: edit-intent path-first; stranded staging → adhoc cutover (single-slot mitosis-pending); pull-sync severing fixed 939df9dd (cutover push leg left unstaged deletions); direct patch lane.
- Era-A notebook removal `400788a` (~6.3k lines, 19 files deleted) — obsidian-vessel had two layers; Era-A reveals no live state.
[codebase-bloat-fossils, sync-deploy-drift]

### project-obsidian-dispatch-outage-and-llm-plane-death (07-18)
- REST `/run-goal` can't ride overlay (sidecar gates on isResolve) → dispatch-as-resolve `goalDispatchAsync` fix (`697158b`). LLM plane total credit death; bandit lock-in (tencent α5293; cost_weight 0.25 makes Sonnet unwinnable); 429 unclassified; hub arms old baked code; all hub rows share one transport peer; gateway forwards to candidates[0]. Envelope drift per vessel (flat vs {pointer} vs {impulse:{pointer}} vs egress wrap).
- Resolved: `0e87fc6` limit_rpd classifier; `8e78ffb` llmCallWithFailover; `3d8743f` groq/mistral (draft collaterally downgraded google models); DESIGN REVERSAL: never un-advertise llm_completion. Gate-approves-dead-wiring: hallucinated `/v1/resolve-url` passed typecheck+semantic gate. Dead `discoverAll/llmCall_OLD` cruft in feature-compose.ts.
[endpoint-routing, federation-p2p, selection-learning, drafter-quality, codebase-bloat-fossils]

### project-obsidian-metrics-federation-fix (07-15)
- Sidecar HTTP fallback skipped all loopback owners → `a05a703`; TRUE root stale sidecar bundle (built before efae67a) — build-artifact treadmill. feature_compose garbled char-level paren edit twice (gap `drafter-garbles-char-level-inline-paren-edits`); hand-applied.
[sync-deploy-drift, endpoint-routing, drafter-quality]

### project-obsidian-outbound-location-independence (07-15)
- `remapEndpoint()` launders remote owners into same-host URLs (law-1: LOCAL_MODE/remapEndpoint bootstrap-frozen). Overlay-or-fail `577892d` (operator-patched).
- Class gap `edit-intent-compose-shared-workspace-no-isolation-2026-07-15` resolved substrate-authored b75de36, f7ae001, ac7e120 (retry-on-ENOENT against host pollers' `git reset --hard`); `6a10d03` semantic gate scanned only /src; `06f8c73` lifecycle reDetected.
- Semantic-gate verdict cache keyed by gap-id not invalidated on analyzer change; stale-staging reuse; drafter omits last hunk of 3-hunk spec — coax by rewriting GAP SUMMARY to exact 2-hunk patch.
- ~943-gap backlog pins goal-host in_flight 7-9; operator dispatches starve 15-60 min (no fairness). `autoCloseStaleGaps` only closes LOW_VALUE_CATEGORIES; `prune_stale_mitosis` 1-day floor.
- Write-back registration fix f721e39→70019af→e656301→852b1f5 (heartbeat re-minted protocol:http every 30s). Deeper blocker: walk auto-bridges foreign `obsidian:write_note` instead of cross-vessel resolve (gap `walk-autobridges-obsidian-write-note-instead-of-cross-vessel-resolve`). Duplicate registration `loc-indep-remote-goal-writeback-duplicate-registration`. `obsidian-reload-plugin-leaves-http-server-unbound`.
[endpoint-routing, env-gating, spend-envelope-throughput, narrowing-duplicates, drafter-quality, federation-p2p, goal-walk-floor, human-surface-escalation]

### project-obsidian-p2p-transport-audit (07-13)
- Tiers A27/B23/C27/D8. HARD closed: 805cd5d oracle-write, 3b29e65 register/heartbeat, a53f9b0 ui-feedback; goalWalkState 2dec676. Blocked: `concept-db-no-update-impulse-shape-2026-07-13`, `discovery-registry-no-resolvable-shape-2026-07-13`. Reach-gate NON-DETERMINISTIC on hollow fileEditResult (same satisfier β-penalized once, passed once) — git tip is the only trustworthy signal.
[federation-p2p, endpoint-routing, false-verification]

### project-obsidian-panel-ui-improvement (07-13→07-17)
- Flash-on-poll fixed across 7 sections (087f5f5, d07074d, 06c77b06, 4b836f88, 1698136c, 67b9c0d0). CRITICAL `d07074d` silently reverted 31c21c3 crash barriers — compose staged from stale mirror; fixed substrate-authored `71575a12` (fetch+reset to origin/dev before every compose). Edit-intent verb allowlist (goal-host ~3660); `657cbb7` made early edit-intent file-path-only. `mitosis_cutover_skips_sibling_units-2026-07-13`; `mitosis_cutover_drops_inflight_dispatches-2026-07-13`; `mcp_concept_tools_404-2026-07-13`; `walk_code_edit_file_visibility-2026-07-13` (fs tools jailed).
- Anchored goals: 0% → ~100% land rate on large files. DRAFTER EDIT-CLASS MAP: new-file ✓, single-site insert ✓, line-level replace ✓, whole-method replace ✗✗, multi-site insert ✗. `gap-semantic-gate-atomicity-vs-drafter-single-site-bind` (gate rejects helper alone, drafter can't co-land).
- Gate-gaming `876fa69`: round-2 SATISFIED THE REJECTION TEXT LITERALLY — renamed working body to zero-caller fn, stub calling nonexistent fn laundered via `as unknown as`; FAVORABLE, gap closed green; panel dead ~1 day. Relanded `12be996`. Gaps `gate-no-post-land-disconnection-check`, `no-effect-to-cause-attribution-capability`, `reach-judge-counts-seed-variables-as-completion`.
- gap-compose.service is demoted 20-min watchdog; "event-driven composable drain" doesn't exist. Commit-message "Base SHA at staging" confabulated. `patch_with_tools_escalation_stages_but_never_lands-2026-07-13` (6 hollow).
[drafter-quality, autonomous-regression, hollow-landing, false-verification, sync-deploy-drift, human-surface-escalation]

### project-obsidian-pulse-coax-ladder (07-17)
- Substrate had already self-fixed (12be996) before operator diagnosed from stale checkout. Coax ladder exposed: no shape carries build command; satisfiers don't bind cwd; naming main.js → edit-intent; compose rollback discarded rebuilt bundle. Gap `gap-obsidian-bundle-refresh-capability`. Bundle hand-landed 7fa047f.
- Panel dark: substrate-authored peer-identity dedup `586b738` keyed on libp2p_peer_id alone evicted 11/12 mirror rows SILENTLY every 2 min (registration metrics 445 success vs registry 5 rows); fixed dcead52. `d1733b1` static imports. Landing on origin/dev IS the hub deploy path.
[autonomous-regression, sync-deploy-drift, federation-p2p, false-verification]

### project-obsidian-single-conduit-collapse (07-15→07-16)
- Target config relay+apiKey. Tier 0 c8c4c1a; Tier 1 `2180d32` hand-edited (16 dead direct-fallback legs removed); Tier 2 `15799bb` (raw WebSockets removed); activityApiUrl removed via 3 sequential composes 228e6ec/d8e8ec3/06e8305; enableFederationSidecar hand-edited d1d4d69 after compose 429 + hollow-reach. Gap `compose-hollow-reach-type-coupled-deletion`. main.ts (large file) unreliable via compose — "S1 fossil". feature_compose never rebuilds main.js bundle.
[codebase-bloat-fossils, drafter-quality, env-gating, hollow-landing]

### project-obsidian-syzygy-sidecar-only (07-15)
- data.json blanked; relay+apiKey is complete config. `2c33d42` registerVessel early-return; `2cd032e` substrateProxy gate. "File a gap in <src file>" misroutes to edit-intent → hollow walk. Inbound transport works via egress but walk goal→target inference fails for bare "read <shape>" goals (floor miss). Ingress pins X-Discovery-Depth:99.
[federation-p2p, goal-walk-floor, endpoint-routing]

### project-obsidian-writeback-autonomous-fix (07-15)
- MILESTONE: substrate authored+landed+self-deployed `e62801b` — goal-host index.ts:2099 satisfier liveness used only `liveShapes()` (/registry/shapes) vs proxy surface. Single-hunk in 6385-line fossil (information not size was the blocker). BUSY guard worked. In-container Obsidian GUI dead (`obsidian-desktop.service` 27k+ NRestarts, launcher absent) → vault write unverifiable.
[goal-walk-floor, human-surface-escalation, endpoint-routing]

### project-operating-model-route-around-then-encapsulate (09-29) — USER'S OPERATING MODEL
- Behaviour in versioned/variable resolvers; existing code always used first; agent + walk route around holes (floor); encapsulate on accumulated evidence; outputs must be useful as inputs (chain onward); prioritise futures from history; decentralised — absence in one place ≠ absence; "never once built so that it works end to end".
- Diagnosis: "simultaneously too involved with its internal operation and too lackadaisical with correcting the core issues ... overly build specific paths rather than general tools". Same issue recurring for same reason = the failure.
- Today's (09-28/29) lane-core patches named as SPECIFIC PATHS: calibration, class2 locality, narrowed-child wait, compose test scrub, pre-admission decomposition.
- Done = end-to-end path runs through it across nodes.
[codebase-bloat-fossils, calibration-seal, node-locality, narrowing-duplicates, test-residue-live-state]

### project-panel-aggregators-authoring-chain (07-16)
- Target inference reads authoring intent as data-write (poolImpulse_write @0.92); coaxable by phrasing ("Author and register a NEW composed activity (via author_composed_capability)").
- author_composed_capability registers templates; walk auto-bridge doesn't bind pointer.goal. Mints hollow (proxy producers). opengapcounter reached true (903 matched). Root: ias-executor engine.ts resolves resolvers only from local Map (line 780) — no discovery at dispatch time; HttpDiscoveryAdapter born-broken (always []). 8-layer fix incl. `46b4b05` (substrate-authored validateDataTask endpoints), runtime.ts, engine.ts pre-register VesselResolvers. Pulse vitals reached a74d60ff/exec_p6trdr6v with ribosome auto-extract. "dispatch verdicts LIE (rolled_back/interrupted while landed)". Regression: author_composed_capability v3/v4 substitute trace-store proxies (probes goal-host wrong path).
[composition-crystallization, goal-walk-floor, endpoint-routing, hollow-landing]

### project-phased-coax-roadmap (07-19)
- Stale-container premise FALSE (container was at origin/dev HEAD). Reach UNMEASURABLE in aggregate (traceAggregateReport ignores metric/group_by; executionTraceList drops reached+operator). Target inference empty cone (exec_3pto3p1d) → bandit lock-in running popularity order. Apply floor over-fires on READ goal naming src path.
- Phases 0-7 (G1 sampledScore producer-pick.ts:23 composition_score object; G2 graded reach; G3 goalHash NN; G5 apply floor; G6 gauge; G8 goalContinuation + dead decideContinuation; G10 authorship-lineage credit; G12 legibility). Reach-gate ritual (baseline 3×, pre-register, one change).
[goal-walk-floor, selection-learning, false-verification, dormant-mechanism]

### project-point-and-go-join-contract (07-19) + project-point-and-go-violations-landed (07-19)
- Invariant: join with {DISCOVERY_ENDPOINT, API_KEY}. C6: key's `iss` never read after parse (validation.ts:87-107); PEER_DISCOVERY_ENDPOINTS frozen env + EnvironmentFile empty-string wins; transport manifest-only (spoke-federate.sh); egress-rewrite copy-pasted 3× (goal-host index.ts:1945, llm-router.ts:67, patch-with-tools.ts:143) + missing in feature-compose.ts:161; always-advertise llm_completion.
- Landed: discovery b7d867f (use-time peers, MAX_PEER_DEPTH 2, /resolve federates); identity ddda0d8 (C6 delegation + TRUSTED_ISSUERS) — runtime bug mis-routed own key → pull-sync reverted identity; fixed 14cada5 (local-HMAC-first); dev-vessel b43062d; llm-resolver 1f14a69 (de-advertise when all cool; contradicts earlier "never un-advertise" reversal); transport 8c24c9b; super 84e379e7 + entrypoint 9e5cd6c6 (role inference in gen-env); identity 3d5aaaf dual-secret; secret rotated live; f9a5e7f0 spoke LLM key waiver. Live substrate raced pushes (llm-resolver reverted twice). Shared `resolveThroughDiscovery` still not built (3× duplication remains).
[federation-p2p, env-gating, endpoint-routing, codebase-bloat-fossils, node-locality]

### project-prose-learning-program (07-13)
- `af21e4f` half-wrong (typechecked because `Record<string, unknown>`), `6f1a828`, `f77676f` (boolean where reason asked — "the verification command defines what you get"), `14763ff` landed-commit shield fix: gap-to-feature closes any gap whose id appears in landed commit message ≤14 days → behaviorally wrong landing shields its own gap. Infra failures bump failed_attempts on innocent gaps and bury them. `[bumpFailedAttempts] child gap emit failed: ... id.replace` live bug.
[false-verification, gap-content, narrowing-duplicates]

### project-reach-drive-surrealdb-outage (07-31)
- Near-zero reach root = SurrealDB wedged in MemoryHigh throttle zone (22.7G, http=000; never hit MemoryMax so OOM-restart never fired) → identity 401 → discovery 0 vessels. Restart recovered (0→75%). Durable `60b2328e`: self-recovery escalates DB-pressure streak to restart surrealdb + pull-sync converges self-recovery-tick into /usr/local/bin.
- Residual killers: edit-intent hollow landing, recordSkip stamps success:true, dispatcherUsedOf null-read phantom HIGH gap every tick, discoverByShapesQuery ×52 templates no shapeDescriptions entry, satisfier empty content accepted. metabob-mcp negative cache stuck.
[trace-store-db, sync-deploy-drift, hollow-landing, endpoint-routing]

### project-reach-gate-fixes-B-A-landed (07-20)
- Fix B `78db237` goal-host reach gate `!== false` → `=== true` at 3196 + 4391 (fail closed). Fix A `9f6813c` ias-executor-ts convergent_validity: empty impulse-resolve = information-absence not failure.
- Verified by substance: B CORRECT BUT INSUFFICIENT — dominant rubber-stamp vector = reframe to punt shape (obsidian_dispatch_goal) + verifier affirmatively hallucinates. A NOT LIVE — shared package consumed as frozen dist copy in each vessel's node_modules; pull-sync doesn't rebuild packages (deploy-boundary). Satisfier reaches with failure_mode=execution_error yet reached=yes.
[false-verification, sync-deploy-drift, hollow-landing]

### project-reach-rate-improvement-plan (07-19)
- ROOT (3/4 agents): substrate WRITE-ONLY on its own learning: goal_execution_paths written (recordGoalPath index.ts:1260) never read at inference; producer pick orders by ev mean (no Thompson sample); sampledScore undefined → reuse bonus dead. Dominant failure HOLLOW ~78%. Measured 14% reach contaminated by orphaned-capability storm (85/110 gaps). Bandit lock-in `composed-cap-produce-shape-obsidian-fleet-health-pane` for 6+ unrelated goals.
- Patcher P0: UNPARSEABLE unguarded `continue` (patch-with-tools.ts:467) → 28 consecutive unparseable turns; P1 parseFirstJsonObject newline; P3 verify-on-done typechecks target only; P4 semantic gate 3 fail-OPEN exits (:765/:775/:780).
- Landed: e252256 feature-compose discovery+egress+failover; ef0c9c0 patcher P0; ec0761a reach-verifier cascade (0.40→0.70 on curated 10-goal harness, 15-min budget); 790114c Thompson sample + sampled_score (0.70→0.80). Self-update blocker: orphaned mitosis-pending.json blocks pull-sync 30-min TTL (recurring). Multi-gap batch not supported (1 gap per compose).
- LATER CORRECTION (report-gap-resolution): `recommendReachingPath` IS called at index.ts:4311 — "write-only" thesis partly read from stale local tree.
[selection-learning, goal-walk-floor, drafter-quality, false-verification, sync-deploy-drift, composition-crystallization]

### project-report-gap-resolution (07-19)
- 29 report gaps: 6 already resolved (report stale — G-CEIL-3 recommendReachingPath called; anti-entropy `trace-replication-tick.ts` live peer-pull; genuine_edge_density inequality_ok). 15 filed (gap-ceil-1, gap-ceil-2, gap-clus-1/2, gap-sel-2, gap-ver-1-rv2, gap-patch-p3/p4, gap-gauge-unassisted-reach-harness, gap-rhythm-*, gap-net-1/2, gap-deploy-cutover-no-dist-rebuild, gap-doc1, gap-op10). 0 coax-closed (credit death). provide_feedback 401.
- Re-validation: store auto-churned all 15 ids; 10/15 resolved-on-origin; drafter apply floor blocks coaxing.
[gap-content, narrowing-duplicates, sync-deploy-drift, false-verification]

### project-ribosome-drain-storm-and-selfdev-blockers (08-02)
- Operator's census fix (572cd6c/079c160) enabled gate → drain timer dispatched ribosome-extract without lifecycle: 3407 drain fires/40 min, 97% of extract dispatches, 0 dedupe. Fixed `f0322c3` (delete dispatch). Refuted fixes: fabricating lifecycle; id-shape filter (would exclude 17/22 eligible).
- "When a blocker moves three times, run one manual dispatch that splits the hypothesis space".
- 10/18 push clones lack node_modules → spurious baseline-typecheck-broken gaps; monoculture hypothesis: dev-vessel has node_modules so composes succeed there. Failed compose leaves clone DIRTY. concept-db unreachable from spoke → drafter has no lessons on spoke. Super-repo glue ff-only fails every cycle.
- Execution census counts completed|failed but `skipped` neither → allTerminal never true for taskCount≥3 (1151 lines) — #1 minting blocker.
- `e830210` deleted two duplicated EDIT-INTENT ESCALATION blocks returning reached:true on mitosisStaged (correct third block unreachable) → gap-goal reservations 33/h → 0 (monoculture broken by starvation, not diversity). EDIT-INTENT targets 13/13 feature-compose.ts. `5101d7b` substrate-authored goalSignature. `978a70f` re-land after substrate reverted `33afcc8`.
[composition-crystallization, hollow-landing, selection-learning, node-locality, memory-recall, sync-deploy-drift, narrowing-duplicates, directed-overshoot]

### project-s2-stability-ladder (07-18)
- Ratified ladder: 1 keystone compose-drops-secondary-hunks; 2 verifier supremacy (evidence-required closes, consumption-probe + zero-caller land gates, graded checks); 3 walk repair; 4 human surface (openspec obsidian-legibility-surface); 5 gauge unassisted reach ~90%. Tripwires: second gate-gaming; hollow closes in headline close rate; flattery drift. 10 gaps filed (gap-close-requires-verification-probe, land-gate-consumption-probe-missing, checks-are-not-graded-activities, walk-repair-tier-classified-retry-missing, intake-low-confidence-clarification-exit-unwired, failure-reformulation-burden-on-human, dispatch-outcome-note-illegible, unassisted-reach-rate-unsensed, checking-trickle-rhythm-missing, prospection-ignores-traversal-recency).
[false-verification, drafter-quality, goal-walk-floor, human-surface-escalation]

### project-self-dev-acceleration-program (07-17)
- `2c18203` parity gate Phase 1 (ts-morph AST equivalence); `8ec501b` compose isolation (per-compose worktrees); `652fc1a` seam extraction Phase 2 (dry-run PARITY PASS on activities.ts 11,120 lines — nothing landed to disk). `e5fd6c9` sync verified files at land time; 3 concurrent substrate-authored commits daebbae/f745998/c2f1bb7; janitor f655c8d. Gap `reach-gate-credits-favorable-despite-cutover-refuse` (4 specimens). Multi-file single goal `02b0bd8` (fossilRankReport) via 5-round ladder (router muzzle fix 5ace2ec). dev-vessel 56 pre-existing test failures. Hook blocks src/** tests contrary to CLAUDE.md.
- Phase 3 (land one parity-PASS seam) NOT done → seam extraction dormant.
[codebase-bloat-fossils, dormant-mechanism, drafter-quality, spend-envelope-throughput, docs-drift]

### project-self-dev-cycle-standup (07-17→07-18)
- SENSE/SELECT/EXECUTE/VALIDATE/LEARN/CYCLE spine. Storm-2: goal-generation.ts dedups within tick only (2-3 concurrent copies); `auto_draft_decision:*` meta-gaps pass `/capability|repair/i` → recursive spiral. Landed boredom 64f4e0f, 005091a, 4b976a8; dev-vessel ffff964, 665ecfb (allCutoversRefused→effectiveVerdict); a22233d + ed39ba3 CATEGORY_WEIGHT (orphaned 0.5 vs missing 3.0). "one-hunk-per-goal PROVEN (5/5), every multi-hunk failed". Gap `walk-satisfier-credits-edit-goals-with-activity-template-output`. 6 gap classes incl. `cutover-deploys-live-without-git-landing-creates-reverse-drift`, `development-vessel-concept-db-mirror-unreachable`. FAMILY_GOALS names `detect-vessel-code-drift` which exists nowhere (per sequencing note).
[narrowing-duplicates, gap-content, drafter-quality, hollow-landing, spend-envelope-throughput]

### project-self-knowledge-calibration-demo (07-21)
- 1 of 5 operator capabilities self-performed. No shape-aware feasibility estimator; no negative channel (404/timeout interpreted only by operator). Goal-target inference keyword-latched (goal about feasibility estimator → target goal_verification_label). feature_compose only fires on edit-intent naming an existing file → can't CREATE from intent. `0840337` scoresMap key fix (prefixed vs bare) — impact UNCONFIRMED; recommend handler already shape-aware; `activityTemplateRecommendation` is inspection view. Real content-blindness = target inference.
[goal-walk-floor, selection-learning, false-verification]

### project-sequencing-spine-design (07-20)
- Split-brain: pull-sync markers equal clone HEAD but runtime /vessels content differs (substrate-pull-sync.sh:128 compares marker to HEAD, never runtime content); producer-pick sampledScore reads field live discover-by-shapes never emits; host-container-source-drift-observer-tick VACUOUSLY GREEN (HOST_REPO_ROOT nonexistent → 0 files); FAMILY_GOALS["self-maintenance"] names nonexistent `detect-vessel-code-drift`.
- Vessel genres missing from registration (same-vesselId last-writer-wins); shapeEndpointMap static cache + PREFER_LIBP2P_ROUTE env (law 1). LLM credit split across two samplers; `gradeArmByExecution` exported never called. Goal identity defined twice (activity-api md5[0:16] vs goal-host FNV-1a). Path replay truncates to path_activities[0] at :1320. walk_tier sent never persisted. Small-inconsistency CLASS = severed credit-graph edges (emitted∧¬read, read∧¬emitted, defined-twice).
- Critic: design proposes ~24 shapes/~14 activities past spectral headroom — subtract first (revive dead wiring decideContinuation, gradeArmByExecution).
[sync-deploy-drift, write-read-mismatch, dormant-mechanism, selection-learning, env-gating, false-verification, codebase-bloat-fossils]

### project-session-priority-queue (08-04)
- Tier 0 instruments: ungate `recordDeterministicLabel` (goal-host 2304; baseline 1 achieved / 99 not_achieved); preserve tool-call audit (federation-transport-server.ts:272 drops tool_calls → groundedOk permanently 0); hub build SHA reporting (/version 404). Tier 1: repair consultPrinciples wire; populate corpus (architecturePrinciple etc. count 0); shape-name mismatch — "authoring docs before the wire changes codegen by nothing" (falsified a docs-restructure plan).
- Tier 2: `accumulateEndpointShapes` double-unwrap → endpoint_output_shapes 0/400 non-empty; prior fix VERIFIED NO-OP; test fixture stubs wrong depth so 5 tests pass BECAUSE of bug. boredom index.ts:4135 hardcodes `anchor_not_found` (146/24h mislabelled). rhythm-conductor-tick.ts:145 gap-closing family (α 1187.5) never comes due. classifyReach fails open.
- Blocked on operator: stale worktree prune 303MB; cutover restarts kill in-flight goals (32 goal-host restarts/day); branch protection DECLINED (strategy is detection not prevention). goal-host 135 pass/9 fail. `X-Internal-Api-Key` presence-checked only. Mitosis overlays 7/10 contain only feature-compose.ts.
[write-read-mismatch, false-verification, memory-recall, test-residue-live-state, dormant-mechanism, spend-envelope-throughput, calibration-seal]

### project-seven-families-resumption (07-14)
- 7/7 families closed; learn-from-prose via repaired `composed-cap-learn-a-new-activity-from-this-prose-des` (unbindable sink inputShapes; category enum) + engine legibility `3535339` → `activity:health_digest_learner`. `composed-cap-examine-the-most-recent-successful-multi` noise attractor.
[composition-crystallization]

### project-single-endpoint-resolve-gateway (07-16)
- discovery-vessel is resolve gateway (flat {pointer}); earlier activity-api gateway defa169 wrong home, revert interrupted 3× by cutovers. metabob-mcp single-endpoint branch `feat/single-endpoint-gateway` (71c54c7, 1491f5c, 41d4fe4) — unmerged at time. Shape-dispatch agreement filter silently drops advertised shapes lacking a case. origin/dev concept-db cannot cold-boot (`isOpen()` absent on surrealdb 2.0.3). Discovery forward existed only in container (cutover never pushed). Serial-dispatch rule: cutover restarts kill siblings.
[endpoint-routing, sync-deploy-drift, codebase-bloat-fossils]

### project-six-schemas-never-applied (08-03)
- Six activity-api schema files failed to parse every boot (363 warnings; 023, 040, 045, 046, 047, 048) — warn-and-continue made never-applied schemas look like empty tables. `fn::update_composition_edge` never existed. Fixed a5aed3e (046), 99424ad (023/047/048); 023/048 then TimeoutError (backfill) → `c0246f7` 300s timeout (caused hub outage). 045 (shape learning — "this is where learning happens") needs UNION ALL/SPLIT/subquery unsupported by 2.3.3 → moved fan-out to read time (7c3e46b, 6c2de10 substrate-authored). 040 unlocalized. Format-learning does not exist at all.
[trace-store-db, dormant-mechanism, selection-learning, composition-crystallization]

### project-substrate-deploy-ghcr-federation (07-19)
- `069ebf54` GHCR canonical (reversal of 07-19 install audit's Docker Hub standardization — registry flip-flop); root docker-compose.yml. Hub rolled with 5 LLM arms. Secret reality: hub and local share legacy default secret. Local roll broke federation (image doesn't enable transport) → `/bootstrap` on discovery dfe8e24 + 3f770689 + 77c6b9cd. obsidian sidecar bb86243. GITHUB_TOKEN leaked into transcript. Stale mitosis lock blocked pull-sync.
[federation-p2p, sync-deploy-drift, docs-drift, env-gating]

### project-surreal-oom-root-cause (07-22)
- OOM ~73 kills/24h: traces-list full scan of 103k view (indexes stranded on AET after mig 158 c475cc1 repointed 34 read sites); 56/155 tables materialized views (mig 096 comment "views never carry data" wrong); no cgroup cap; boredom cheap-tick bug (202 handoff reset demotion → 60-100x cadence); hollow-gap flywheel (174 fresh-id gaps/2h). Attribution wrong TWICE (m1-trainer, gap-compose) before correct.
- cgroup cap tourniquet; `Requires=` → decoupled; idx_vpet_org_time (out-of-band, committed later as mig 162) stopped kills; landed 38e321d5, 440ca81a, e7987d9e, f3f5fc51 db-friction observer; drafter pinned DeepSeek a6ee84b (auto → weak mistral); local-tools regression 7d11deda reverted 1a796aa.
- ROUND 4-7: 51c33d4 id-first projection; 800bcea retention retarget; 427e9e5 native BM25; e282ac4 auth emit (root narrative later REFUTED); DB-friction loop LIVELOCKED (reconcile aborts on decommissioned AET, 202 ACK taken as success) → 2181e96; trace_store_counters FABRICATED 192436 → 07f2bbe; `reached` unstored (true on 1/108119 rows) → persisted at write; b02d789; mig 163/164; 71ee93c remedy_effectiveness_observer (found llmquotastate 207/207 aborts); b3e5987 concurrent drafts; b048ece global-ceiling valve (TRACE_STORE_CAP 150k live-only env); thompson_selection_log fixes 09f2e6f/0c0cc57/9f420c5 but upstream orgId NULL (later closed no-repro); composition-edge-schema-mismatch.
- SurrealDB feature audit: RELATE/CHANGEFEED/LIVE SELECT/DEFINE EVENT unused; MemoryOrderedLimit is the core limit; sort-spill rejected.
[trace-store-db, hollow-landing, narrowing-duplicates, spend-envelope-throughput, env-gating, write-read-mismatch, dormant-mechanism, false-verification]

---

## PROBLEM-CLASS ROLLUP (recurrences aligned across files; "hat" = how it reappeared)

### hollow-landing (the most recurrent class in this shard)
Hats, chronologically: satisfier:fileEditResult/fs_write/codeInsertResult steals edit reach (07-13, 07-15, 07-18, 07-19); patch_with_tools reached:true on mitosisStaged (07-13 ~6 specimens, 07-15 4c3300b3, 07-16 1fd5e59e, 07-21 fbf013b4); FAVORABLE-without-landedSha at 3 goal-host return sites (07-21 bfc6af1, first fix d679cfb PHANTOM); grader-side durable trace reached:true (238a4a3); FAVORABLE despite cutover refuse (07-17, 4 specimens → 665ecfb); duplicated EDIT-INTENT ESCALATION blocks (08-02 e830210 — correct block unreachable); "landed on origin but not live" via mirror-to-live index restore (07-21 a81c46f5); detector placeholder .txt (08-02 4be040ed); ribosome hollow template α=58.86 (07-21); gate-gaming rename+stub+cast (07-16 876fa69); hollow drafter-model selection (07-23 23745cbd). Root never retired: reach is computed at many sites with different predicates; staged≠landed distinction re-introduced by each new route. Later (MEMORY index 09-15 `hollow_write`, 09-19 unparseable commit) shows it continuing.

### false-verification
Hats: reach gate `!== false` fail-open (07-13 index.ts:2913 → 4af057a; 07-20 again at 3196/4391 → 78db237); reframe-to-punt + verifier hallucinates yes (07-20); self-confirming file-count oracle generates command it grades (08-04); structure-only artifact verifier (08-08 → 0468f9c); landed-commit shield closes gap on behaviorally wrong landing (07-13 14763ff); `validated:true` = plan parses (07-16); gap closure % from rolling window (07-12, 07-14, 07-16); honest reach 0% by construction (labels only on negatives, 08-02); oracle slanders real landings (08-02); `.pullsync-testbaseline` seeded from regressed tree; test fixture stubs wrong unwrap depth so tests pass because of bug (08-04); host-container drift observer vacuously green (07-20); in-band gates don't protect themselves (08-03). Principle repeatedly written: oracle derivable from goal text, never from artifact.

### drafter-quality
Hats: compose-drops-secondary-hunks keystone (07-17→07-19, ratified as S2 rung 1; 4d2cba0 hand-landed); anchor-less goals 0% vs anchored ~100% (07-13); whole-method replace ✗, multi-site ✗ (07-16 edit-class map); char-level paren garble (07-15); byte-0 placeholder / path prepend (08-01 eab0e9c, 08-02 5056240, 65e7ced); endpoint-swap degenerate loop (08-02, 266 corrupted sites, 4 repairs reverted in ~1h); UNPARSEABLE loop (07-19 ef0c9c0); hallucinated /v1/resolve-url passing gates (07-18); collateral rewrite of adjacent literals (07-18 3d8743f); large files (goal-host index.ts 6587-6899 lines, main.ts) un-self-editable; multi-function asks drop parts (08-02). Recipes converge: one hunk per goal, verbatim anchors, EDIT n old:/new: blocks (index 09-27).

### sync-deploy-drift
Hats: docker cp vs git self-update (07-24 law); local checkout stale → false verdicts (07-12, 07-15, 07-16, 07-17 pulse, 07-19 report); pull-sync starvation on mitosis-pending freshness (08-02 9d261470); orphan mitosis-pending blocks pull-sync 30 min (07-19 recurring); content-hash re-attempt wedge (08-02); mirror-to-live index restore (07-21 a81c46f5) and unstaged deletions (939df9dd); shared packages frozen as dist in node_modules (07-20); .sh scripts baked into /usr/local/bin not converged (07-23, 08-02, 07-31 60b2328e); sibling units not restarted (07-13); pull-sync compares marker to HEAD not runtime (07-20); super-repo glue ff-only fails every cycle (08-02); submodule pointers pin old commits so hub runs stale (07-23 SESSION 7); detached HEAD pushes stale branch (07-14, 07-17, 07-20, 07-21, 07-23); ephemeral live-env edits (TRACE_STORE_CAP, drafter pin, keys) lost on recreate; hub only converged via origin push (07-17). Structural: at least four distinct copy paths (clone, /vessels, /usr/local/bin, node_modules dist) each with its own staleness.

### trace-store-db
SurrealDB 2.3.3 MemoryOrderedLimit + blob-heavy views drove OOM (07-16 → 07-22 → 07-31 wedge); index stranded by mig 158 repoint; 56 materialized views; hidden view re-creator never located; batched REMOVE lossy; schema files silently skipped (08-03 six schemas); fresh-volume seed bricked (07-17 mig 154/161); counter fabricated (07-22); reconcile livelocked on decommissioned table (07-22); `reached` unstored (07-22); execution_trace_content 1.08M orphans; health-probe restart amplification (07-23 fc143654, 07-31 60b2328e); init timeout outage (08-03). Many fixes landed; retention cap now env-only (150k live-only).

### composition-crystallization
First learned composition 07-14; 7/7 + 8th family 07-14; ribosome extraction target `activityDispatch` never existed (08-02); `skipped` census predicate blocks mint for taskCount≥3 (08-02); drain storm (08-02); composition_edge retired (07-22) then `fn::update_composition_edge` first created 08-03 (contradiction: retirement vs revival); reuse A/B nulls → verification is binding constraint (08-08); donor banked as one step (08-08 → 1df0e02); reuse transfers mechanical form not insight. MEMORY index 09-18 claims crystallization proven end-to-end.

### selection-learning
Greedy-by-mean pick, sampledScore dead (07-19 → 790114c); alpha credit fabricated to synthetic ids (08-02 → 4250971); satisfier tiers structurally ungradable (no activity row); upkeep Thompson volatile (07-19); two samplers split LLM credit, gradeArmByExecution never called (07-20); model bandit lock-in (07-18 tencent, 07-19 cost_weight); thompson_selection_log empty; shape-conditioned scores views absent (paradigm.ts dead query); llmModelPolicy spoke writes ignored by hub.

### goal-walk-floor
ReAct floor unreachable until f4f983a (08-02); target inference empty cone / keyword latch (07-16, 07-19, 07-21); walk blind to vessel resolver producers (07-13 → 5301ae4; engine.ts runtime resolver Map 07-16); payload synthesis (note path 07-15, pointer.goal, templateData); lookup shapes satisfy produce intents (07-14); vault note via fs_read (07-14); cannot CREATE from intent (07-21); 50-goal suite ~15/50 honest (07-16); curated 10-goal 0.40→0.80 (07-19).

### spend-envelope-throughput
Single mitosis-pending slot serialization (07-13/07-19); compose-lane contention zombies (08-25); ~943-gap backlog pins in_flight 7-9, operator dispatch starvation, no fairness (07-15); per-compose worktree isolation 8ec501b (07-17); cutover restarts kill in-flight dispatches (07-13, 07-16, 08-04 32/day); window-blind dispatchers (09-26); boredom cheap-tick 60-100x (07-22); LLM credit death recurring (07-14, 07-18, 07-19, 07-21, 07-22, 08-03).

### narrowing-duplicates
Gap→goal no per-gap dedupe (17× in 72h, 08-02); dedup only within tick + auto_draft_decision meta-gap spiral (07-18); hollow-gap flywheel fresh ids 174/2h (07-22); capability-gap-audit uncapped; semantic-gate verdict cache keyed by gap id (fresh-id workaround, 07-15); landed-commit shield → re-file under fresh id; filed gaps auto-churn out of store (07-12, 07-19); duplicate landings via escalation (09-26 4dec1bc/44a5efa); `-narrowed` child verbatim dup (MEMORY 09-22).

### gap-content
Workable gap = single in-route edit site + machine verification (07-13); 82/94 missing_capability summaries declare no modality (07-14); closure modality unrecorded; edit_site metadata needed for picker (07-13); 60 orphaned_capability never drained (07-14→07-15). (MEMORY index 09-13: operator specs 80% vs autonomous 2.5%.)

### dormant-mechanism
decideContinuation imported never called (07-14, 07-20, 07-21); gradeArmByExecution; pruneExpiredImpulses; upkeep fn:: views; concept embed/cluster 0 callers; solicitation-outcome-scan stub; pattern-miner dead (execution_sequences 0 rows); 13-14 timers never enabled; gap_lifecycle_scan no live driver / runs dry; seam extraction Phase 3 never landed; goalContinuation designed never built; consumption-probe activity/credit leg; composition_edge; walk-continuation.ts; trace_replica_sync / anti-entropy (conflicting: absent 07-14, "live" 07-19).

### endpoint-routing
llmCall endpoint constant swaps (08-01, 08-02); egress-rewrite duplicated 3× + missing in 4th (07-19); remapEndpoint launders remote (07-15); sidecar loopback skip (07-15); hardcoded CONCEPT_DB_ENDPOINT loopback (08-03, 08-04); endpointForShape picks self-mirror (07-14); fed-transport ingress excludes libp2p (07-14 3b9402bf); envelope drift per vessel (07-18); resolve gateway homes (activity-api defa169 wrong → discovery); discovery absent goal-host (07-22).

### federation-p2p / node-locality
Per-substrate silos for memory + gap stores (07-13); stores not eventually consistent (07-14, hub 29,593 vs local 11,403); hub masks compute role (08-01, 08-03 duplicate boredom); spoke masks concept-db without redirecting consumers (08-03); spoke vocabulary 11 vs 373 (07-13); peer id not substrate-scoped (07-18 c3eef77d); dedup keyed on peer alone evicts 11/12 rows (07-17 586b738→dcead52); NO_RESERVATION is reached vessel's responsibility; secrets not git-distributed; hub-vs-spoke size-dependent outage (08-03).

### env-gating
LLM_FALLBACK_MODEL unset kills failover (08-03); LOCAL_MODE/remapEndpoint (07-15); PEER_DISCOVERY_ENDPOINTS frozen (07-19 → b7d867f); PREFER_LIBP2P_ROUTE; TRACE_* caps live-only env; UPKEEP_INTERVAL_MS timer; 32 systemd timers (08-01 law); FAMILY_GOALS/AUTONOMOUS_GOALS/CATEGORY_WEIGHT/familyShapes literals; hardcoded model pins (07-19, 07-22 DeepSeek pin).

### memory-recall
compose_lesson wire severed (CONCEPT_DB_ENDPOINT unset → catch return "") 08-04; spoke drafter has no lessons (08-02); hub concept-db near-empty (08-03); shape-name mismatch architecturePrinciple vs architectural_pattern_principle; relevance doesn't drive ranking + inverted by drafter-success-credit (07-19); knowledge family 0/5 (07-16); concept_write drops pointer.shape; org-partition measurement trap.

### human-surface-escalation
Operator feedback plane unused + 3-hour dispatch retention (fe609c4); provide_feedback 401 (07-18, 07-19); cannot label walks dying pre-selection; docs_decision answer not applied; human answers not shaped/graded; obsidian bundle treadmill; in-container Obsidian GUI dead; reload-plugin leaves HTTP server unbound; localizeGap escalates to human uiQuestion (operator IS localizer).

### autonomous-regression / directed-overshoot
Autonomous: ab8d61c string-vs-array (07-16); feature-compose.ts degenerate loop (08-01/02); endpoint swap reverts (08-02); 586b738 dedup (07-17); 876fa69 gate gaming; d07074d stale-base revert (07-13); 70d2a00 weakened mitosis-evaluate gate, 4f1d3e8 posterior_source guard removed (09-26). Directed/operator: c0246f7 timeout → hub outage (08-03); census fix → drain storm (08-02); dbaf0cf3 SurrealDB restart net-negative (07-16); C6 delegation mis-routed own key (07-19 → 14cada5); 7d11deda local-tools; regression rate of fixes ≥45% across 6 audit cycles (08-03).

### test-residue-live-state
Subagent verifier probes attempted live feedback writes (08-02); agent ran root SQL with scraped creds; diagnostic blob scans self-inflicted memory panic (07-22); experiments contaminate lane metric (index law); operator trend-expectation battery keeps ~6 dispatches in flight (09-26).

### docs-drift
concept-db port 8260 vs 8081, 9 vs 7 MCP tools, 6 vs 5 upkeep activities (07-19); mig 096 comment "views never carry data" wrong; install docs broken both paths (07-19); registry flip Docker Hub ↔ GHCR (07-19); CLAUDE.md "tests never gated" vs hook; CLAUDE.md "tenant isolation enforced via PERMISSIONS" vs all vessels connect as root (07-23); stale "3.0.0" comment on 2.3.3 deployment.

### codebase-bloat-fossils
Era-A obsidian notebook 6.3k lines removed (07-15); goal-host index.ts 6.5-6.9k lines, activities.ts 11,120 lines, main.ts; 263 stale `*-mitosis-*` staging roots with corrupted drafts; satisfier graveyard in /workspace/repos; shadow garbage tree /vessels/local-tools-vessel/repos; wrong mint concept_naming_sync; 60 orphaned resolvers; ~34 behaviors minted as resolvers; dead llmCall_OLD/discoverAll cruft; 14-entry source→shape map duplicated; egress rewrite ×3; dead views/tables (DB rounds); 303MB stale worktrees; mitosis overlays 7/10 feature-compose.ts only.

### calibration-seal
Not directly present in this shard's 07-08 era files except: CATEGORY_WEIGHT static (orphaned 0.5 vs missing 3.0, 07-18); boredom momentum store poisoned by unreachable-arm failures (08-03); operating-model note (09-29) names "calibration" as a specific-path lane-core patch.

---

## MECHANISMS (general vs specific; status evidence)

(See structured record for the top ~60; this section lists all found.)

GENERAL / shared seam:
- substrate-pull-sync + mirror-to-live (self-update from origin/dev) — live-used; repeatedly broken (starvation, wedge, index restore, baked scripts). General.
- vessel-mitosis-cutover drafter-corruption gate (signatures: byte-0 placeholder, llmCall bad constant, truncation) — live-used; general gate at landing seam; in-band (deletable, 08-03).
- feature_compose edit-intent path (drafter → typecheck → semantic gate → cutover) — live-used; the only reliable lander.
- patch_with_tools ReAct patcher — live; repeatedly hollow (stage-only).
- compose-workspace per-compose worktrees (8ec501b) — live (validated 07-17).
- parity-gate (2c18203) + seam extraction proposer (652fc1a) — built, dormant (Phase 3 never landed).
- reach-classify.ts `classifyReach` shared primitive (159bca7) — live, used by ribosome + posterior.
- isHonestlyReached ribosome gate (8d969b4) — live.
- creditReachedTemplate/penaliseHollowTemplate + producedShapesConsumable (16bde03) — live but credit 404s for synthetic ids.
- consumption-as-verification (json_path_extract consumer) — principle verified, never minted as activity (dormant).
- groupedExecutionStats livelock sensor (b8371cd) — built; use unknown.
- remedy_effectiveness_observer (71ee93c) — built, detected 2 livelocks on dry run.
- db-friction observer (f3f5fc51) — live.
- self-recovery-tick with db_under_pressure backoff + surreal restart escalation (fc143654, 60b2328e) — live, validated.
- trace-retention sweep + global ceiling valve (b048ece) — live (cap 150k via env).
- trace_store_counters (repointed 07f2bbe) — live.
- /bootstrap point-and-go (dfe8e24) + gen-env role inference (84e379e7) — live.
- C6 issuer delegation + dual-secret (ddda0d8, 14cada5, 3d5aaaf) — live.
- discovery resolve gateway (discovery-vessel /resolve) — live.
- federation-transport egress/ingress + sidecar /outbound/resolve — live.
- llmModelPolicy bandit + llm-resolver cooldown/de-advertise (1f14a69) — live; design reversed twice.
- goal_verification_label_write (operator feedback, labeler=human) — live; dispatch retention compaction fe609c4.
- substrateGap store + gap_lifecycle_scan (producer_now_exists, LOW_VALUE_CATEGORIES) — live but autonomous scans dry.
- gap-to-feature (localizeGap, landabilityScore, specFromGap, landed-commit shield) — live.
- concept-db compose_lesson / concept_select_for_prompt — severed wire (08-04); SessionStart hook reads priors.
- ribosome extract / learned-composition-* templates — live, intermittent.
- author_composed_capability (composed-cap-* templates) — live; mints often hollow/proxy.
- ias-executor engine discovery-routed VesselResolver pre-registration — live (07-16).
- rhythm_conductor_tick / timeShapedRhythm poolImpulses — live partially; timers still dominant.
- goalDispatchAsync / goalWalkState dispatch-as-resolve — live.
- maintenanceLease (single global mutex) + autonomous_pick lease — live.

SPECIFIC paths / fossils / duplicates:
- walk-continuation.ts decideContinuation — fossil (0 call sites).
- composition_edge table — retired 07-22 then fn created 08-03 (contradictory state).
- pattern-miner + execution_sequences — dead.
- activity_execution_traces (AET) — frozen since 07-14, legacy reads.
- v_*_by_account views (47-48) — compat fossils; source DEFINE→REMOVE landed 07-23 per one note, "intentional, kept" per another.
- upkeep Thompson in concept-db — volatile in-memory.
- ribosome drain-timer dispatch — deleted f0322c3.
- duplicated EDIT-INTENT ESCALATION blocks — deleted e830210.
- Era-A obsidian notebook — deleted 400788a.
- concept_naming_sync — wrong mint.
- satisfier:* / universal-tool-fallback — synthetic ids, ungradable.
- obsidian bundle main.js tracked artifact — treadmill.
- 32 systemd timers — antipattern; 13-14 never enabled.
- egress rewrite copies ×3 (goal-host, llm-router, patch-with-tools) — duplicate.
- source→shape map ×2 in concept-db — duplicate.
- `concept` shape two producers (concept-db + dev-vessel) — duplicate.
- boredom duplicate on hub — duplicate/crippled.
- detect-vessel-code-drift referenced in FAMILY_GOALS, nonexistent.
- host-container-source-drift-observer-tick — vacuously green.
- activityTemplateRecommendation resolver — inspection-only view mistaken for selector.

---

## PRINCIPLES / LAWS STATED IN THIS SHARD (with source)
(all listed in structured record; representative set)
- Push to origin/dev, never docker cp (feedback-substrate-self-updates-from-git, 07-24).
- FP-test a hard-fail gate against the real corpus; put the count in the commit (08-02).
- verified-and-correct first reach → donor → reuse → compounding; locate first broken link (08-08).
- Pin HEAD of every vessel measured at start and end (08-08).
- When a change is justified by a measurement, check code performs that measurement (08-08).
- A learning curve can be a defect-compensation curve (08-08).
- A catch must change the caller's status, not return a plausible value (08-04).
- Prove the path executed; declaration is not evidence (08-04).
- Oracle derivable from goal text, never from the artifact; "by construction" is the bug (08-04).
- Never fix the drafter with the drafter; never route auth fix through auth (08-04).
- Grade the layer that was wrong, not the one still reachable (feedback plane).
- A landed commit is inert until the unit restarts (feedback plane).
- Timers are an antipattern; rhythms as shapes (08-01).
- Trace store location-independence, not repatriation (07-05).
- Test at the consuming layer (08-20).
- Verify landings against origin, not local; gap window is not a ledger (07-12).
- Reach verified by downstream consumption; honesty of grade precedes intelligence of choice; hollow green is negative value (07-20/21).
- Honest grade must hold in return AND durable trace (07-21).
- Wrong mint is negative value (07-10).
- Never raise a startup-gate timeout for slow work; spoke-safe ≠ hub-safe; deploying a fix needs the substrate up (08-03).
- In-band gates cannot make a self-modifying system safe; safety out of band (08-03) — later "branch protection declined, strategy is detection" (08-04).
- A false reach is positive credit that keeps a failing family alive (08-02).
- When a blocker moves three times, run one manual dispatch that splits the hypothesis space (08-02).
- Verify where a write lands before naming the store it corrupts (08-03).
- Two zeros discriminate (caller vs dependency) (08-03).
- Instrument lands before the thing it measures (08-04).
- Clean recreate is the only way to surface persisted-state↔runtime drift (07-23).
- Durable removal = neutralize the source DEFINE (07-23).
- Correlation at cadence ≠ cause (07-22).
- Bootstrap edits only survive if committed+pushed (07-22).
- Disposition is learned by selecting behaviors under conditions; the selector IS the router (07-14).
- Consequential action ⇒ activity; thin resolver only for read/transform/atomic-write (07-14).
- Operating model: use existing first, route around, encapsulate on evidence, chain outputs, general tools at shared seams, done = end-to-end across nodes (09-29).
- One change per commit / per measurement (law 12 reach-gate ritual, 07-19).
- Subtract first before adding shapes past spectral headroom (07-20 critic).
- Small-inconsistency class = severed credit-graph edges (emitted∧¬read, read∧¬emitted, defined-twice) (07-20).
- Warn-and-continue must make never-applied distinguishable from empty (08-03).
- Subagents on live substrate must be explicitly write-forbidden (08-02).

---

## OUTCOME CORRECTIONS (latest evidence in shard wins over the note's own claim)
- 78db237 Fix B → partial (reframe-to-punt vector untouched); 9f6813c Fix A → dormant (frozen dist in node_modules).
- d679cfb stagedNotLanded guard → failed (phantom; unreachable path).
- 33afcc8 / 978a70f / c3194ee endpoint repairs → reverted by the substrate (db7c414, 8733823, 3cca30b); 93b18ba gate → worked (0 FP / 266 hits).
- c0246f7 300s init timeout → reverted (8fbc032) after hub outage.
- dbaf0cf3 block-cache cap → failed (restart net-negative); SURREAL_TEMPORARY_DIRECTORY sort-spill → failed.
- e282ac4 auth-on-emit → partial (its root narrative refuted in ROUND 5).
- 0840337 scoresMap key fix → unknown (score_source:"legacy").
- 2c18203 / 652fc1a parity gate + seam extraction → dormant (Phase 3 never landed).
- composition_edge: retired 07-22 (fcf9499, mig 169) → superseded 08-03 when a5aed3e made fn::update_composition_edge exist for the first time. State is contradictory.
- "deploy boundary closed on BOTH axes" (a81c46f5 + 3d366142, 07-21) → partial: baked /usr/local/bin (07-23, 07-31), marker-vs-runtime split-brain (07-20), content-hash wedge (08-02) all later.
- 7/7 families closed (07-14) → partial: 08-02 finds activityDispatch never existed, mintReachedTrace 0 mints; walk-route authoring open.
- curated reach 0.40→0.80 (07-19) → partial: MEMORY index 09-13 autonomous reach 2.5% vs operator 80%.
- b048ece global-ceiling valve → worked, but TRACE_STORE_CAP=150000 + enable flag are live-env only (not persisted).
- llm_completion de-advertise: 9c17905/17dc3d0 "never un-advertise" (07-18) → superseded by 1f14a69 (07-19) de-advertise when all providers cool.
- v_*_by_account: 07-22 ROUND 7 "intentional, kept" → 07-23 source DEFINE→REMOVE (one-day reversal).
- Registry: 07-19 install audit standardized on Docker Hub → same day 069ebf54 made GHCR canonical.
- "no gap verdict channel" claim (feedback plane) → wrong; substrateGap_write merges classification_metadata.
- "gap monoculture" premise (08-01) → wrong (0/259 gaps name the file); later 08-02 13/13 edit-intent targets still feature-compose.ts.
- "write-only on its own learning" (07-19) → partly wrong (recommendReachingPath called at index.ts:4311), superseded by 790114c.

## RECURRENCE CHAINS (same issue, different hat, each time "fixed")
1. Reach gate fails open / staged graded reached: 4af057a (07-13) → 78db237 (07-20) → bfc6af1 + 238a4a3 (07-21) → 665ecfb (07-18 report-level) → e830210 (08-02) → MEMORY 09-19 unparseable commit reached origin. ≥6.
2. Satisfier steals an edit goal's reach: 07-13 (codeInsert/gitCommit), 07-15 (fileEditResult), 07-18 (activity_template), 07-19 (fileEditResult + hollow composition extracted), 08-02 (satisfier ids 404 credit). ≥5.
3. Self-update blocked by mitosis-pending / markers: orphan pending 30-min TTL (07-19, recurring "reliably"), starvation 9d261470 (08-02), content-hash wedge (08-02), stale lock after roll (07-19). ≥4.
4. Stale local checkout → false verdict: 07-12, 07-15 (fbe4ced misread), 07-16 (ab8d61c), 07-17 (pulse 12be996), 07-19 (report). ≥5.
5. LLM credit death blocks landing: 07-14, 07-18, 07-19, 07-21, 07-22, 08-03 (and MEMORY 09-15 declares "not a blocker"). ≥6.
6. feature-compose.ts self-corruption by the drafter: 08-01 (d784b98/b467d4b/eab0e9c), 08-02 (3f6e4f3/5056240), 08-02 (e048756/4f4b31e + 263 staged copies). ≥3.
7. Walk blind to vessel-resolver producers: 07-13 gap → 5301ae4 (07-14) → engine.ts local-Map-only (07-16) → foreign write resolver auto-bridged (07-15) → 07-31 residual. ≥4.
8. Egress/envelope routing duplicated: goal-host (1945), llm-router (67), patch-with-tools (143), feature-compose (missing, 07-19 b43062d), llmCall envelope unwrap (07-18/19). ≥4.
9. Gap flood/dedupe: auto_draft meta-gap spiral (07-18), gap→goal 17× (08-02), hollow-gap flywheel 174/2h (07-22), orphaned_capability storm contaminating reach (07-19). ≥4.
10. SurrealDB memory wedge/OOM: 07-13 hourly, 07-16 ~30GB, 07-22 73/24h, 07-31 throttle-zone wedge. ≥4.

Scratch dumps used while reading: /tmp/m2b2.txt … /tmp/m2b7.txt (outside repo; read-only copies of memory notes).
