# memory-8 — operator memory cache notes 526–600 (sorted), read in full

Source: /home/avi/.claude/projects/-home-avi-documents-work-substrate/memory/*.md, `sort | sed -n '526,600p'` (75 notes, ~543KB), from
`reference-route-handler-gate-fix-unblocks-arbitrary-edits.md` through `reference-the-compose-kill-switch-halts-the-operator-lane-2026-08-12.md`.
Notes are operator-side cache (law 10: substrate memoryNote is authoritative). Dates are note dates; outcomes judged against later notes in this shard where available.

## Per-note digest (chronological-ish in reading order, batch 1: notes 1–15)

### N1 route-handler gate fix (2026-07-22) — hollow-landing / false-verification
- Semantic gate `enclosingSymbolsForHunks` (feature-compose.ts:332) walked column-0 with declRe/containerRe only; Hono route bodies attributed to nearest top-level helper (`filterByInputSchema`, 0 callers) → `dead-code-only` hard_fail → rollback → reached:no for correct route-body edits.
- Fix `99984ab` (dev-vessel, bootstrap-landed because it edits the grader): routeRe checked first; route path tail becomes the symbol → entrypoint grep → reachable.
- Live A/B: 43a2014e pre-fix reached:no; e8b4afe5 post-fix landed 513fb5a reached:yes; G2 b369f79f landed d3f538d. Outcome: worked (route-body class).
- Still blocked then: unique-but-wrong anchor (created_at appears 14×), multi-file (files[0] collapse), entrypoint verb set omits `patch`, `groundFileSymbols` shells inert `rg` (only grep in container) → empty symbol grounding.
- `intervention_evaluate` → ACCEPT: substrate did not gate its own grader code.

### N2 routing fixed, drafting is the gap (2026-08-09) — drafter-quality / goal-walk-floor
- Same NL symptom goal (discovery loopback) dispatched 4×: routing to `repos/discovery-vessel/src/index.ts` correct every time (law 13 satisfied).
- Drafts failed 4 ways: operator-poisoned baseline (`make restart-<v>`), TS2304 invented helper `_readHonestyPolicy`, identical old/new no-op, TS1184 syntax. All gates caught; nothing wrong landed.
- Two grounding hypotheses refuted by measurement: `region:null` also in successes; grounding 27,006 B > file 23,746 B. Conclusion: edit DIFFICULTY not information. Proposed: decompose hard edits into small verified ops.
- Fleet concurrently closed a human-filed gap autonomously: `04775a7` in 13 min.

### N3 seams that broke graded runs (2026-09-25/26) — spend-envelope-throughput / sync-deploy-drift / autonomous-regression
- Ledger graded runs failed all 09-25 on seams; runs 10/11/12 passed 10/10 on 09-26 05:10Z.
- Masking units doesn't quiet lane: dev-vessel auto-picks in-process after restart + 5 internal gap_to_feature triggers → `autonomous_pick` maintenanceLease (128f51f). Lease stops new picks only.
- Retry of already-landed edit → `no_unique_anchor` → counted as anchor failure → escalated patch_with_tools → edit applied TWICE (31d07cd, afea8de). Fix 5a4ef1a+4dec1bc (skip when goal-hash commit is file's latest commit). Same class via post-walk route (44a5efa).
- Walk executed write shapes named in edit goal falsifier text → rule: "done when" names no shapes.
- id-less shells: ufExecuteTool read execution_id from AsyncLocalStorage set only via enterWith, empty on feedback-retry → fix 959519e.
- runtime ≠ git ≠ process after failed compose; in-memory dedup Sets re-fire on restart (75 pending-verify questions for 25 gaps); 03d98c1 fixed only one sibling.
- 09-26 05:26–07:37: NO BRAKE ON RECURSION — goal targeting `goal_execution` resolves through goal-host's own /resolve; 4827ea1d drove load 26, surreal 13 cores, 588 id-less shells/min, 146 gaps/h, exhausted all LLM providers incl paid; container stopped.
- A walk's `code_replace_lines` satisfier can write LIVE /vessels source directly after edit route fails.
- Three writers of runtime ≠ git: walk bridge (`auto-bridge-fileEditResult`/local-tools `fs_edit`, no rollback), patch_with_tools (in-place edit then verify/rollback), compose staging. Operator restore-mode guard wiped a patch_with_tools edit 1s after it was made.
- local-tools `fs_edit` = `text.replace(old,new)` string replacement → `$'` etc. expand (whole-file duplication). One correct goal failed 3 ways misread as drafter/guard/compose quality. Fix: replacer function.
- Human surface: push_scope_refused on local bare remote → 48 verified cutovers parked 12h; github repo created, O(P+F) index hand-landed fb042e9 (/api/questions 20s→5ms); a test wrote 501 fake feedback records per run to LIVE journal.

### N4 security cluster resolved (2026-08-25) — env-gating / false-verification / docs
- SEC-1/2 identity `/v1/keys/generate`+`/revoke` unauthenticated → anonymous credential factory; fixed 0a89ebc (authorizeAdmin). SEC-3 activity-api Bearer fall-through → fcfb300 (`denyBearerUnlessPublic`). SEC-4 'unknown' IP bypassed every rate limiter (in 0a89ebc). SEC-6 hub key backup gitignored.
- Vacuous checks fixed: doctor check 6 read /etc/systemd/system but units in /usr/lib → always PASS (1d3785de → `systemctl cat`); pre-commit `exit 0` skipped SOPS+gitleaks on ~84% of commits (1d3785de); gitleaks rule `\bmb_` vs real `mb-` keys matched nothing.
- `SUBSTRATE_ALLOW_DIRECT_EDIT` was live 1 → restored 0.
- Filed gaps (source operator_audit_2026-08-25): SEC-5 jwt role not entitlement-gated (bootstrap-circular), `joint-liveness-detector-missing-write-read-class`, `peer-fanout-401-indistinguishable-from-no-producer` (discovery index.ts:83/93 swallow; HUB_API_KEY set by no deploy path), metric-collector-vessel unmanaged, nightly-image-build never fires.
- Method: pull-sync uses per-vessel clones `/workspace/git/vessels/<v>` → `/vessels/<v>`, NOT submodules. No tsc in prod image.

### N5 selector drift gate wired (2026-07-31) — false-verification / codebase-bloat (duplicate)
- goal-host had no `lint` script → mitosis gate fell back to pure tsc, blind to shell-vs-js selector drift → hollow greens possible. Fix goal-host `8478bc6` lint = typecheck + reach-routes-golden test. Parallel session `6bc12d5` had built the check but no wiring; subagent built a DUPLICATE file (discarded). Lesson: check origin/dev for parallel work before landing.
- Route-as-data: 3 ClassRows (avg-threshold, below-mean + ...); inline-selector plan for single-point append — not evidenced done.

### N6 self-code architecture conformance gate (2026-07-27) — env-gating
- `detectArchitectureViolation(diff)` fb9b1e1: flags non-bootstrap env read at a branch (law 1) and inline LLM provider calls; ADVISORY to semantic judge. 7/7 tests. Behavioural end-to-end never reproduced.
- Correction: concept-search not dead but slow (5–7s BM25; SurrealDB 3.0 IDF-not-persisted); per-step how-to consult (index.ts:2439) 4000ms timeout always aborts.
- Content-threading keystone f5827b1 INERT (fs_read fileContent lacks `path`).

### N7 self-confirming oracle two dimensions + dead CI lane (2026-08-05) — false-verification / selection-learning
- File-count builder and oracle share a parse → agree by construction; wrong in depth (-maxdepth 1: 10 vs 17) then extension ("TypeScript files" → ext null → 18). Both alpha-credited. Fixes dbdaa09, 6527e03, a9742a9 (verdict states assumptions). Six sibling sites (rank/threshold/aggregate) NOT fixed.
- `.github/workflows/ci-webhook.yml` had both branches and branches-ignore → 741/741 runs zero jobs since 2026-07-05; the only commit-keyed CI→Thompson path never executed. Fixed 304b3b6.
- Operator's own test gate (5930d8e) blind to tests VANISHING; fixed ca81f29 (pass-count regression).
- Adversarial pass refuted 14/16 first-pass findings (~88%).

### N8 self-confirming reach oracle maxdepth1 (2026-08-04) — false-verification
- goal-host index.ts:1060 verifyCountFilesReach + :1178 generator share `-maxdepth 1`; comment says "matches by construction". RULE: an oracle that generates what it grades is not an oracle; check must derive from goal text.
- Selection picked `learned-satisfier-reachability-gap-repair` for an unrelated goal; hollow gate refused.

### N9 self-dev audit metrics corrected (2026-07-31 AM) — false-verification / write-read-mismatch / selection-learning
- 20% honest reach = impulses.ts:2747 100-row cap artifact; true deduped lifetime 43.5%.
- Deterministic labeler NEVER wrote: goal-host sends `labeler:"deterministic"`, activity-api whitelist ['human','automated'] → 400, fetch doesn't throw → silent. 41 verdicts lost.
- performance-status counts only producer_now_exists as repair; true: 530 real closes, 75.7% expiry, ~5% repair.
- Composition-edge learning dead 17d: composition-edge-reconcile.ts:210 reads `activity_execution_traces` (last row 07-14) while live in `execution` (150k). 1998 edges all backfill.
- gap_priority_ranking computed but unconsumed; funnel-history.jsonl contaminated with a TS draft; 33/42 missing_capability = vocabulary mismatch; author-producer.ts:815 shape-equality gate rejects successes.

### N10 delta audit 07-31 PM + pickup — hollow-landing / directed-overshoot / selection-learning / write-read-mismatch
- Billing catch-22 FALSE: hub-egress lane (127.0.0.1:8401/egress) carried all 5 self-landings; drafter quality is binding. 27d02a2 = hollow `// Add logic...` stub that passed every gate.
- Walk selection IS learning (variant_performance_metrics via discover-by-shapes.ts:184). Admission cut `ORDER BY ev DESC LIMIT 10` over flat ev=0.5 = recency truncation before Thompson; fixed later 1d9701d.
- Miscredit: 1ac5f0e, af86945, 10052e9 are operator commits previously attributed to substrate.
- route-edit gap credit broken: apply-proposal-as-patch.ts has zero closeLandedGap; goal-host self-landings earn 0 gap credit.
- 13 formulaic expired gaps REOPENED same ids (durability).
- Probe leak `zzz_impossible_no_such_helper` in deployed /vessels/goal-host index.ts (test-residue).
- Evening: labeler revived 23e707f+migration183; land→close 10e10e9/0bd32ff; posterior admission 1d9701d; anchor-staleness 437e4e8; hollow-stub gate 1b5e7c9; off-target gate 15c611e; ribosome f88ba8f; edge persistence fc61e61/5b65456.
- c7fb5a67 NO-HANDS land (boredom goal-generation.ts:126 emit "author producer for shape X") was NET-NEGATIVE: reversed deliberate 5bd047b skip (walk-internal confabulated shapes) → hollow ticks every ~5s; REVERTED via 15347a77. Lesson: semantic gate doesn't check gap PREMISE. Premise-verification workflow institutionalized (wf_39f51f8e: 15 → 7 dispatchable/8 rejected).
- author-producer.ts:815 guard fixed (e61621db): compared to shape `llm_completion_result` never returned.
- Landed: #5 gap-drain backoff (__drainBackoff never .set, 3830 500-storm), #17 LLM_PINNED_PROVIDER quota, #18 obsidian settled row, #15 OUTPUT_TAIL_BYTES 1MiB, #2 reopen>=3 → needs_info, #12 transport-health field map. #20 llmCallWithFailover 4-site DRAFTER-BLOCKED twice but greened reached=true (verifyEditPostState abstains on REPLACE; value-blind judge). #13 multi-anchor seed registration failed.

### N11 self-development demonstrated repeatably (2026-08-07) — test-residue-live-state / hollow-landing
- 7271887, 6cfd349 (Substrate Autonomous) on development-vessel, 20 min apart; full boredom→series→compose→verify→cutover→push cycle.
- Real blocker: `resolveMemoryNoteWrite — empty body` tests; config.ts froze WORKSPACE_ROOT at load → unit test rewrote the LIVE memory store; baseline passes/post-draft fails. Fixed 5dc8ab8 (use-time read; law 1).
- `pool/standing.json` git-tracked and rewritten by every run (still open then).
- mitosis-tick template skip_tests:true and base root /vessels/<v> has no test/ → c0b665e repointed to push clone, baseline-delta fail-closed.
- seed-templates is seed-if-empty; re-seeding clobbers learned templates; use activityTemplate_update with evidence.reason.
- Audit record lied: `cited_check_names:["typecheck"]` while suite ran → fixed ad5d24a.
- Operator guards each failed once (lease too short → 3 dup goals in 67s; envelope tripwire matched its own docs; brace parity). Writer mis-attributed (satisfier:fs_edit not patch_with_tools). Corruption swept 1 file, actually 8 (7 in /workspace/proposals). Halt ≠ rollback. `git log --author --since` returned empty falsely.
- local-tools fs_write truncation refusal = undiscovered protection.
- Open: patch_with_tools poisoned-baseline detector false-positives on pull-sync lag; whole-file deletion undispatchable; nothing authors plans.

### N12 self-dev investigation 07-31 eve — false-verification / gap-content / composition-crystallization
- Credit wire severed (apply-proposal-as-patch.ts no closeLandedGap); feature_compose writes gap row only on FAILURE → success invisible. expiry 417 vs landing credit 21 (~20:1).
- Author loop aims at grader, not frontier: 122 open capability gaps got 0 landings.
- Gap closes ~95% non-repair (826 closed; repair 2.5–4.6%); 81 reopened same-id (max 7 cycles).
- Reach lifetime 42.3%, 7d 21.3% real regression. Automated labeler dead since 07-20.
- Self-repair holes: no deployed-vs-origin integrity audit, recycled-pid stale marker, reap gated on content divergence; self-repair corrective = timer allowlist only. "Detection over-built, remediation = operator."
- Route-as-data 3 ClassRows; RIBOSOME DORMANT (0 templates/24h; replay judge fails every fire); chain steps are resolvers not templates (law-2).
- Falsification metric defined: no-hands verified-repair gap closes/week ≈ 0.
- Filed: apply-proposal-as-patch-success-earns-no-gap-triple-credit, self-goal-generation-aims-at-reach-grader..., deployed-vessels-tree-vs-origin-integrity....

### N13 milestones 08-26/27 — autonomous landing
- a885631 substrate-authored from self-detected gap on origin/dev (autonomy criterion met 08-26). goal_status false-negatives; verify by artifact. Reliability size-dependent: ~2700L files UNFAVORABLE→TIMEOUT (keystone).
- de0a3b0 detectZeroBehaviorDelta rejects tautological tests. Investigation floor (citation oracle) 08-27. Recipe grounding 26f4ecb + f91f8f2 (three wrong fixes caught at consuming layer).
- a803852 autonomous loop landed the UNSOUND rescue clause the advisor rejected — INERT (call site unwired); rejection lived in a doc, not a runtime gate.

### N14 reliability instruments (2026-08-26) — false-verification / hollow-landing
- goal-expectation-harness.ts + self-dev-reliability.mjs. Structural 90% → file-level 30% → region-level 62%; per-symbol treadmills: registryFieldFor 8×, tryLexicalRebind 5×, deadStoreEditReason 4×, verifyRegistryInventoryReach 4×. 4eedb4de confabulated inert fly.dev URL scored CORRECT.
- Duplicate route-edit race filed (`duplicate-route-edit-application-gap-level-race`); consequence-verdict writer gap + openspec `2026-08-26-consequence-verdict-into-credit` (supersede recommended). goal_verification_labels UNREAD.

### N15 self-dev starves its own drafter grounding (2026-08-29) — memory-recall / sync-deploy-drift / trace-store-db
- pull-sync cutover restarts concept-db 132×/day (08-29), ~313/day rate 08-30; NRestarts=0 blind. Search 10–25s vs drafter 8s budget (feature-compose.ts:1883). `consultPrinciples` returns "" silently; compose_lesson channel rides same wire → lessons teach no one.
- Dense leg dead ≥4 days (15–19k "returned nothing" per day). BM25 all zero (IDF not persisted).
- Migration `fn::island_concepts()` in concept-db sql/upkeep/002-upkeep-views.surql:21 never applied since initial commit (runner splits on `;`); fail-open.
- Gaps 1405→1507 in a day; repair ~1.9%; creation ~7× repair. Calibration seal hard-continues 11+ categories at 8 attempts/0 lands.
- Unverified link: never traced a compose proving it received "".

## Per-note digest batch 2 (notes 16–29)

### N16 selfdev path live diagnosis (2026-08-04) — write-read-mismatch / trace-store-db / drafter-quality / false-verification
- Operator "VERIFIED LIVE" of `expected_output_shapes` reconciliation was HOLLOW: synthetic probe rows proved the column, not the producer; `recordGoalPath` (goal-host index.ts:3126) never sent the field. Lesson: verify the PRODUCER, not the column.
- Planner confabulated anchor for schemas.ts edit; semantic gate refused; walk fallback 500'd on unguarded `pointer.spec.split` (feature-compose.ts :1832/:2651/:2784; guard existed at :1935 unhoisted); fallback fileWriteResult whole-file write refused by catastrophic_truncation guard (0c50816).
- Bootstrap deadlock: SUBSTRATE_ALLOW_DIRECT_EDIT read from Claude Code process env; agent cannot set it.
- Resolved with contextual multi-line anchors; 6 edits landed no-hands: 7fa66cc, 23195c5, 4f07a70; f5f7a08 (pointer.spec entry guard), bc476b2 (chainProduced), 4d0f627 (the actual root: CREATE params object lacked `$expected_output_shapes` binding — earlier edit landed in UPDATE params).
- Hunt went through 4 wrong layers: migration 188 "not applied"; init-database `getAppliedMigrations()` returned empty Set on failed read → `bootstrapMigrationsTable()` marks ALL applied without running (fix b4d7b0e — real general bug); untracked slow/broken migrations (048 DEFINE-AS 45s timeout, 030 invalid `OVERWRITE IF EXISTS`) re-run every boot starving later ones (3a08e00 moved ensure first); response zod schema `GoalExecutionPathSchema` strips unknown keys; `OVERWRITE` keyword unparseable in deployed SurrealDB → migrations 030, 068, 074, 080, 085, 099 silently never applied (f5a372c, fe0eaf9; runSQL swallowed per-statement errors and logged ✓ unconditionally). Also reverted destructive per-startup `REMOVE FIELD` (ceff862).
- Mirrored ≠ running: goal-host self-edit cutover doesn't restart goal-host.
- Sibling `.split`-on-undefined crash in `json_path_extract`.
- Drafter boundary: add-after-data-anchor reliable; insert-guard-after-signature-`{` not. Unused-param refused by gate → multi-op self-complete goals needed. Goal-host cutovers interrupt in-flight dispatches.

### N17 self-goal compounding damage purge (2026-07-30) — gap-content / narrowing-duplicates
- Abstract recipe self-goals ("Reproduce and close the recurring X ... reach_by_construction_recipe") decomposed by walk into phantom shapes (shared_parse, operand_naming, ...) → 50 unactionable capability gaps (22% of 223) → mis_localized_path storm (110). Purged 12. Generator re-sourced d34d295.
- Dominant mis_localized source: confabulated "needs a producer for shape X" (walk-internal shapes) → localize to non-existent repos/<X>. Guard boredom 5bd047b (skip). Proper fix filed `capability-gap-localizer-targets-shape-name-as-vessel-path`.
- LAW: actionability (routes to a real producer) is a HARD precondition for generating a goal.

### N18 self-goal loop landed, first mint (2026-07-30) — selection-learning / gap-content
- boredom c1a474f (lesson-class candidates from compose-lessons.jsonl + pull_cutover stale-premise guard), goal-host f3d1627 (class_token). Hand-applied after 6 drafter failures (semantic judge misread spec).
- Candidates never selected (shapeless+cold); fd5dff4 added `gap-goal:lesson:` to GAP_DRAIN_ID_MARKERS → dispatched. "Observation→goal loop closed."
- Gotcha: super-repo submodule update DETACHED checkout → false dead-module alarm.

### N19 self-goals made actionable (2026-07-30) — directed-overshoot / gap-content
- N18's goals were NET-NEGATIVE: un-routable (named no file → ENOENT hollow), mis-sourced (drafter-quality classes vs recipe), and fd5dff4's drain floor made them win at 4.80 (~3×), capturing scarce dispatch slots (~6 real goals / 372 reservations per 2h), β-poisoning.
- Fix d34d295+3edd14d: source from concept-db reach_gate_lesson deterministic_* classes, goal text names goal-host index.ts; fail-open to NO candidates.
- LAW: a wrong-mint on the priority floor is maximally negative; don't floor a candidate class until it demonstrates closing.

### N20 self-observation repointed off frozen trace table (2026-08-25) — write-read-mismatch / trace-store-db
- `activity_execution_traces` frozen since 2026-07-14 (n=18135); 7 scripts/substrate/*.ts (composition reconciler, autonomy-metrics, operator-goal-generator, compose-teacher, model-reality-audit, coherence-recover, spectral-gap) read it for 42 days. Repointed 27 sites to `v_paradigm_execution_traces` (3c1bf965). Consuming-layer proof: batch_traces 0→50, graph 2200→2202; genuine_edges still 0.
- NOTE: N9 (07-31) already identified the composition-edge reconciler reading the dead table — recurrence 25 days later (first fix landed 07-31 edges fc61e61 addressed another path).
- scripts/ undispatchable via goal-host (edit-intent regex anchored on repos/).
- Durable fix still open: joint-liveness detector.

### N21 self-repair demonstration + schema-premise fault (2026-07-25) — write-read-mismatch / hollow-landing
- a8005bad (Substrate Autonomous) goalSignature stamp in activity-api: well-formed, deployed, but NO-OP — SELECTs top-level goalSignature while producer writes under trace.metadata (goal-host index.ts:1911). False premise from operator goal text (law 13).
- Self-detect dispatch fbe8a010 honestly reached:NO (no producer for audit).
- `activityTemplate` shape @:18080 renders markdown and drops metadata; `activity_fetch` @:18090 returns raw.
- Filed gap-ribosome-metadata-provenance-llm-transcribed; gap-servesintent-goalsignature-only-on-fresh-chains.

### N22 semantic gate verdicts anti-correlated with effect (2026-09-04) — false-verification
- activity-lifecycle-audit.ts: gate passed inert A (9fbb018) and B (672d7b9), refused effective D twice @0.90. Refuter INVERTED a supplied measurement sentence. Re-phrased positively, one claim per sentence → FAVORABLE, landed 84637dc; 4 pre-registered checks passed.
- Qualifies law 8: state facts positively and in isolation.
- Second-order ratchet: identical goal hash → refusals accumulate → `feature_compose:rejected:<hash>`; correct wrongly-refused fixes get harder to land.
- Repair direction: give the gate a MEASUREMENT (consumer arithmetic over real rows before/after), not an argument.

### N23 shape-flow closure geometry ledger (2026-07-19) — composition-crystallization / goal-walk-floor
- DEC/Hodge geometry is interpretation, not computed. Implemented: backward-chain closure (goal-host index.ts:2794-2856, 40-hop cap), cluster posterior coarsening (cluster-posterior.ts; activities.ts:5414 cold-leaf n<5 borrows), boredom UCB (index.ts:3294-3360).
- Gaps: pathway reuse gated on sampledScore>0.5 silently omitted; middle-mile has NO similarity index (exact FNV goal_hash); cross-vessel fan = hardcoded 3-step bridge (index.ts:3260); conceptLink_write/obsidian_frontmatter never walked; refine stubbed; TD(λ) doc-only, `decideContinuation` imported unused; findChains/selectNext single-hop stub; `goalContinuation` unbuilt.

### N24 similar-goal rebind Tier-2 (2026-07-25) — composition-crystallization / goal-walk-floor / endpoint-routing
- `tryLexicalRebind` goal-host d38eaa9 (zero-LLM diff-alignment, 9 guards, literal-in-command causal gate); multi-slot 831dafb (LCS); punctuation 0527471; persistence to `/workspace/.goal-host-reached-commands.jsonl` b21388a. Battery: 0 false reuses; LLM removed from answer path after one learning event.
- DB: `activity.thompson_*` DEAD denormalized (1/1/0 all 3726 rows); live posterior in context_thompson_scores + goal_execution_paths. `activity_execution_traces` + `trace_digest` DEAD. walk_tier null 97%, execution_count pinned at 1 → reuse invisible (fix not built).
- read-vs-compute inference non-determinism → hollow reach; compound "count AND store" fails (inference under-specifies arity). 6b238fb reach-judge rule compute≠raw material (applied inconsistently by haiku).
- df0f233 replaced substrate-authored HOLLOW retry loop (re-read same null verdict). 0b0e273 routedComplete retry 3× → b013f30 retry only on fast failure (amplification lesson).
- 4568125 fs_list resolved against process.cwd (law 11) and swallowed missing dir → count 0 rubber-stamped. 09d9baa6 gen-env WORKSPACE_ROOT durable. Hardcoded "/workspace" residuals: observe-orthogonal-refresh.ts:44, self-operational-health.ts.
- Conformance audit: 5 compose-report cutovers landed only an unread response header (x-arbwork2/3-probe etc.) → removed 04aa35e; `detectEffectlessHeaderOnlyDiff` 33b7d9e. Drafter model hardcode `claude-sonnet-5` → "auto" 47096a7 (llm-resolver selectArm Thompson). Reverted hollow 23745cbd2d. Hub ignores llmModelPolicy_WRITE.
- Residual: reachedCommandCache unbounded file.

### N25 six inert guards: runtime loads dist not src (2026-09-06) — sync-deploy-drift / dormant-mechanism
- ias-executor-ts package exports → dist/; 5 of 6 vessels have private REALCOPY dist in node_modules (analysis, development, goal-host, llm-resolver, local-tools); only ribosome symlinks. `dist:check` validates the shared dir only → OK while every vessel stale. Repo already shipped `verify-dist-fresh.ts` detector.
- After correct deploy: retirement refusal + posterior guard fired (scaffold-and-publish-vessel alpha=6.05 beta=8610.66, executed 2345× all failures → flat). Landed 3c7808a. 5 inert = deploy artifact; 1 (boredom vesselAdditionScaffoldDispatch) = wrong door.
- LAW: prove a log line can appear before trusting its absence.

### N26 six of eight novel goals reached; composition flattened (2026-08-10) — goal-walk-floor / false-verification
- 6/6 one-step novel goals genuinely reached (independent re-derivation). Two-step goal (rh2-e88b) flattened to one shape → real but non-responsive `stdout:"1"` reached=true. Fix proposed: per-target binding at `isGroundedHonestReach` (index.ts:4691-4700, :8679/:8692), preserve arity. Historical wallpaper fraction 68.4%.
- goal-host coalesces identical free-form goals (index.ts:12176-12183) → nonce mandatory. `/executions/<id>` keys dispatchId. goal-host NO inbound auth.

### N27 sixteen indexes (2026-08-09) — trace-store-db
- `execution` table 16 indexes; delete 0.2 rows/s vs +1015/h inflow (303,472 rows). Success-sampling 2c3f97a (rate 0.1 on validator-dispatch + slot-binding, 65% of rows) → ~+275/h (~73% reduction; range 144–375).
- Retractions: ORDER BY claim (8934b6a committed unmeasured); batch size; empty rhythm registry was spoke only. Stale process, broken `?activity_template_id=` filter, `count()+datetime` filter falsely 0 → retracted a working fix. T0.6 five-step misroute story disproved by one call to :8401/egress.
- f389389 substance gate substrate-authored. Rhythm registry seeded (spoke 0→4, hub 48→52), null-bodied placeholder retired. Probe overwrote a live template with holder:"probe".

### N28 skill-acquisition loop closed (2026-08-09) — selection-learning / composition-crystallization
- Auto-promote gated trace-store evidence on `empirical_samples < min_samples` → looser min_samples=3 (what boredom sends) promoted 0; 22 ticks promoted=0 while 214 proposals had 73+ executions. Fixed → promoted 3 (incl composed-cap-identify-shapes...). LAW: threshold gating WHICH evidence is consulted can invert.
- Token families could never mint recipes (numeric-only gate) → widened. Last-mile write binding loses computed values (12/22 notes carried goal-text narration).

### N29 split-brain state trees (2026-08-09) — node-locality / write-read-mismatch / memory-recall
- `substrate-gap.ts` writes workspaceRoot()/gaps/gaps.json; `gap-lifecycle-scan.ts:235` hardcodes `/workspace/gaps/gaps.json` (frozen 08-08, 4.76MB) → scan reports 2666/462 open vs live 197/153. Closing lane cannot see new gaps. Bidirectional split (gaps/pool/memory live in NEW; proposals live in OLD).
- Hardcoded `/workspace` in boredom index.ts (SCENARIOS_DIR, proposals_dir×3), vesselAdditionScaffoldDispatch.ts, dispatch-dropped-observer.ts.
- `gap_to_feature` 0 invocations/24h; closures observed were fossil gaps.
- LAW: when state moves behind an accessor, grep the literal prefix. Same root as retracted "98.3% phantom demand".
- Recurrence: MEMORY.md 09-22 "two memory stores" (WORKSPACE_ROOT=/workspace vs super-repo, EnvironmentFile wins) and 09-13 "LIVE store = /workspace/git/super-repo/gaps/gaps.json" — same class returning.

## Per-note digest batch 3 (notes 30–43)

### N30 spoke-hub federation relay LLM resolved (2026-07-24) — federation-p2p / env-gating
- Container recreate regenerated API_KEY_SECRET → stale per-vessel key 67dbee94 → 401 cascade → empty registry → goals fell to broken auto-bridges. Local LLM credit 402.
- Fix: hub-issued key (`substrate-key issue` inside hub container), whole spoke fleet re-pointed at hub's single identity, relay circuit via HUB_DISCOVERY_URL, PEER_FANOUT_MODE=union (env-gated behaviour; `?? "union"` does not catch empty string), unmasked hub llm-resolver.
- Residual: walk-routing "no pick — missing shapes [shape_gap_resolution]" loops; ~/.metabob stale key → cockpit unusable.

### N31 spoke→hub LLM egress fix + hollow walk reach (2026-07-23) — federation-p2p / hollow-landing / false-verification
- Egress target built from truncated advertisement (no destination peer). Fix 15340dba (federation-transport-server.ts egress repair against live circuits; commit also carried unrelated uncommitted working-tree changes) + 534189a (feature-compose fallback to egress). Self-update via pull-sync verified.
- Multi-file decompose already in code (goal-host index.ts:3920-3936).
- Walk substance grader rubber-stamped unapplied `fileEditResult` ("edits were attempted") reached:yes + α-credit. 8fd1c23 requires landed-sha for edit-effect reach (index.ts:3395). Drafter default deepseek → claude-sonnet-5 (5273bfa) — hardcode later replaced by "auto" (47096a7, N24).
- beb84c6 landed x-arbwork2-probe header — later identified (N24) as effect-less header class and removed 04aa35e.

### N32 staged_base_sha is patched hash → drift gate deadlock (2026-09-24) — autonomous-regression / false-verification
- 0a0d59f (substrate-authored) refused cutover when HEAD sha ≠ staged_base_sha, but feature-compose computes staged_base_sha from the PATCHED file → every isolated cutover refused, incl. the loop's own repair (18:23:30Z). Needs operator bootstrap.
- Method: hash file at every commit in `git log -80`; base matching no commit = artefact.
- local-tools `sh()` 30s default kill made baseline blame pre-existing reds on drafts (fixed in 4e40707, default 300s) — MEMORY.md 09-28 says post-land suite dead 08-31→09-28 on the same 30s kill (fixed 5e9a0b2) → the 09-24 fix did not cover the post-land suite (recurrence).
- 565dcfa "defer without rollback" leaves verified edit in /vessels; next compose commits it under ANOTHER gap id (4e40707, 996b841).
- Duplicate-first-line anchor → 13 broken drafts. Refuters invent code facts. Super-repo worktree frozen by draft residue (recurrence of 09-07 stash). `blocked_by` has no reader; `appendComposeLesson` wrote back stale snapshot and reopened superseded gaps (5.3 in 996b841).
- Spec: openspec/changes/2026-09-24-live-self-view/tasks.md.

### N33 stale key in .substrate-secrets → drafter 401 (2026-07-24) — env-gating / endpoint-routing
- development-vessel + federation-transport load `/workspace/.substrate-secrets` AFTER /etc/substrate/env (later wins) → stale METABOB_API_KEY → discovery 401 → drafters "no llm_completion vessel found". Re-key updated only one file.
- Class fixes proposed: key-freshness readiness probe; re-key reconcile all env sources; distinguish 401 from "no producer" (feature-compose.ts:1547, patch-with-tools.ts:377). Recurrence later: 08-25 `peer-fanout-401-indistinguishable-from-no-producer` gap (N4); MEMORY.md 09-22 "EnvironmentFile WINS" for WORKSPACE_ROOT (same mechanism, different variable).

### N34 starvation fixed in three places (2026-08-09) — node-locality / drafter-quality / goal-walk-floor
- 44375c6 local-tools mapPath (one vessel, two roots), 5a890c3 analysis-vessel (dead `/workspace/repos` fallback), 55f0ee1 goal-host investigation prompt demanded grounding without saying where source lives → confabulated filenames.
- LAW: an impossible instruction produces confabulation.
- Result reached=true with zero produced shapes, failure_mode=execution_error → unfalsifiable; answer unreadable by any reader. Filed.
- Restarting goal-host re-registered advertising fed-transport loopback → cockpit failed on unmapped :18401. run_goal_async dedupes by goal text.

### N35 step one of bootstrap closed — RETRACTED (2026-09-06) — false-verification
- Claim "graded exec_* rows 0 → 2 in 19 min" false: 988 rows since 08-29 (~10.8/h). Broken filter `id CONTAINS 'exec_'` returned 0. Actual: linkage repair be8ff83+ed86ab4 (operator) and 0c36ead+3d648ad (substrate).
- Traps: record id string match needs `string::contains(type::string(id),...)`; grep matches source text quoted in drafts; ORDER BY on `execution` returns EMPTY.
- Two-op goal halved by composer while gate said FAVORABLE.
- goal-host cutover kills in-flight dispatches including its own next fix.
- Step 3: feature-compose grades `success: verdict === "FAVORABLE"` ignoring `landed_vessels` in same trace.

### N36 stop recurring mistakes: detector loop blindspot (2026-07-31) — false-verification / dormant-mechanism
- detector-coverage-scan clusters only FAILURE traces → structurally blind to false-GREEN classes (hollow-green, clone drift). Needs ground-truth audit source.
- Reach recovery 5/6 = 83% on focused battery.
- Clone-freshness detector by reuse: extend host-container-source-drift-observer.ts (attempt 1 TS1011 rolled back clean).
- Top undetected: hollow-green value-blindness; gaps `systematic-llm-reachgate-greens-value-wrong`, `hollow-green-llm-judge-overrides-all-hollow-walklog`. Parallel session STEP 7 goal-host 5fa3fc8 inline selectors.

### N37 substance-honest reach credit (2026-07-22) — false-verification / selection-learning
- fbdac11 delegated credit to consumer_productivity_audit — found to be a BLANKET CLAMP (audit under-reports: scans only limit=100) → corrected d737edb in-chain consumption ledger (`consumedInChain`, goal-host index.ts:3370).
- `propagateCreditAlongChain` (activity-api posterior-update.ts:553) retroactive credit exists; gap filed: credit silently dropped on ancestor lookup miss (:611-615).
- 2386b7d + 0687ac2: `semantic_gate.verified` (code-set) + `reachable_symbols` required for deterministic:true. Semantic gate fails OPEN on judge outage (feature-compose.ts:789). Live: 5429436 landed mis-localized under judge outage.
- 5b415ae: edit-intent durable trace tagged reached:true on landedSha alone → now ungraded unless verified.
- Filed next rung: self-check activity for grader branches crediting off self-declared verdicts.

### N38 fleet topology + masked autonomy (2026-08-01) — dormant-mechanism / node-locality / sync-deploy-drift
- `autonomy` role group only in `full`; neither hub nor spoke uses full → all 14 autonomy units dead by construction (incl operator-goal-generator, surgical-gap-scan).
- entrypoint.sh:15-20 copies vessels.inventory.json only if absent → repo fixes never reach running substrate.
- ~11 timers disabled-never-enabled (compose-teacher, gap-compose, coherence-*, db-maintenance, trace-store-health-check...) absent from inventory and Dockerfile enable list.
- performance-status.ts TOPOLOGY shells local docker regardless of endpoint; honest reach 0.0% corpus failure-enriched.
- Hub :8090 not published → external gap/memory queries hang.

### N39 first cruft removal landed (2026-08-07) — hollow-landing / false-verification / autonomous-regression
- 225ab19 Substrate Autonomous removed `KNOWN_SHAPES_TTL_MS_UNUSED`. 4 plan failures all worklist errors (two-line anchor half-applied shipped broken sentence to origin/dev; comment-only zero delta; deletion inexpressible; flaky test).
- Chain: flake → correct draft rejected → rollback fails silently reporting rolled_back:true → /vessels diverges → "poisoned baseline". Fixes 5d69e1e (re-run to confirm new failure), 67370ee (rolled_back set unconditionally; now read-back), 88912df (balance check).
- Operator guards failed: lease (1ad00cc), envelope tripwire matched own docs (d8884b2), balance.
- Root of envelope corruption: both unwrap sites gated on `"llm_completion_result"` which producer never returns (`llmTextCompletion`) → b164b73 goal-host proxy + 2a12397 ias-executor. Same wrong-literal as author-producer.ts:815 (N10, e61621db) — THIRD site of same class.
- satisfier:fs_edit had no rollback and could never reach → bee05ca. 7 corrupted artifacts in /workspace/proposals since 07-29.

### N40 operator access recipes (updated 2026-09-03) — endpoint-routing / docs-drift
- MCP reads repo-local `.metabob/config.json` via METABOB_CONFIG_PATH, not ~/.metabob. Hub publishes only 18080/18100/18101/18210; 18250/18260 not published → cockpit concept recall severed against hub.
- Discovery advertises goal-host endpoints as loopback → cross-substrate misroute.
- Deploy trap dist vs src; resolve envelope drift (`pointer` vs `impulse`); db_admin repair surface; activity-api replays 169 migrations (~90s).
- Obsidian plugin :27182/:27183, sidecar :8402; gap `obsidian-vessel-registry-endpoint-drift` (advertised :18402 → 13 hollow assists).
- Discovery authMiddleware on all routes: unauthenticated INVALID_API_KEY misread as 0 producers.
- Google arm hand-placed on hub, NOT codified (law 11 reproducibility follow-up).

### N41 orchestrated series and corrupted a file (2026-08-07) — false-verification / hollow-landing
- change-series 11ebf40 + 157e662; step a LANDED verdict false: drafter wrote its LLM request envelope into source; predicate (anchor gone + replacement present) passed. Fixed 1932c7b. Halted before step targeting feature-compose.ts itself.
- Lease bug: 3 duplicate goals in 67s (1ad00cc). Architecture kept: one step per rhythm tick, host boredom, store poolImpulse `/workspace/pool/standing.json` (git-tracked — N11), reconcile from file. boredom queue 369 rows no consumer.
- 55% of edit-intent goals die in funnel. Whole-file deletion undispatchable.

### N42 suite pollution (2026-08-29) — test-residue-live-state
- 6/40 failing dev-vessel files pass alone; fetch-mock polluters fixed efe7cd3 (only 2 of 6 cleared; failing files 40→44 — redistributed). Bisection result invalid (baseline didn't reproduce; script printed header unconditionally). ddmin named `maintenance-lease.test.ts` leaving a LIVE lease that production fetchWithRetry deliberately honours (5s memo) → fbbfd9b. 3-file interaction for gap-to-feature-admission; multiple triggers per victim.
- `cmd 2>&1 > file` capture bug. Dropped response ≠ failed write (gap write committed despite HTTP:000 ×4).
- substrate-gap.ts:641 publish side effect ConnectionRefused aborts whole gap write (partial persistence). pull-sync redeploy per push caused the flapping.
- Detector to mint: test files assigning globalThis.fetch / process.env without restore.

### N43 SurrealDB thrash / readiness watchdog (2026-07-23/24) — trace-store-db
- Process-alive-but-query-hung SurrealDB 4+ h undetected (CPU 1220%, RSS 24GB); cascade to fleet auth failure (identity reads api_key). Restart re-thrashed in 3 min.
- Roots: execution_trace_content 339k–683k rows no created_at index; trace_digest 1.57M, key_session 1.34M 100% expired, concept_usage 614k unretained (trace-retention.ts:41 only reaps `execution`). Aux reap landed (50k/sweep), itself full-scanning until solo indexes migration 182 (f8ebf2c): 27s→3ms.
- QuerySemaphore 5dd2606 (activity-api, SURREAL_MAX_CONCURRENT_QUERIES default 16), c3e16a8 concept-db; identity-vessel blocked (clone had no node_modules; `file:` workspace dep; setup-git-push doesn't bun install/link).
- Operator's own 5-agent workflow triggered thrash. Surreal root password in argv (security). Compose fans ~2000 discover-by-shapes/30s for ephemeral autoDraftedOutput shapes. Floor fix 62b7a9d empirically-broken demotion.
- Recurrence: MEMORY.md 09-25 "trace store is unreclaimed blobs"; N27 16-index delete pathology (08-09).

## Per-note digest batch 4 (notes 44–58)

### N44 SurrealQL drops unparenthesized AND conjunct (2026-09-06) — trace-store-db (instrument)
- `WHERE created_at > d'…' AND activity_id = '…'` silently dropped second conjunct (3,706 vs real ~100). Parenthesize every conjunct. ORDER BY created_at on `execution` returns empty; GROUP BY ... ORDER BY ignored.
- Live gap store `/workspace/git/super-repo/gaps/gaps.json`; `/workspace/gaps/gaps.json` fossil last written 2026-08-30 (i.e. still being written until 08-30 — three weeks after N29 found the split on 08-09; heartbeat fossil path 8e59ae6c same class).

### N45 symbol-name search bridges symptom to file (2026-08-10) — goal-walk-floor
- 69be9f0: match goal words against DECLARED symbol names (definition sites only), corroboration ≥2 words, strict leader, >6 files dropped. Pure-symptom goal → schemas.ts first try.
- Blocked by dev-vessel saturation (103 compose lines/8 min); fall-through verdict "no template produces [fs_edit]; capability gap filed" misnames cause.

### N46 symbol resolution generalizes 3/6 (2026-08-10) — goal-walk-floor / false-verification
- 5/6 right vessel, 3/6 right file; vessel-prefix check would have reported 5/6. Misses = unnamed predicates inside large functions.

### N47 symptom-only goals route to right file (2026-08-10) — goal-walk-floor / sync-deploy-drift / narrowing-duplicates
- Vocabulary hint (tree tokens), content fallthrough, specificity ordering, write-context narrowing (CREATE/INSERT/UPDATE) → goal-paths.ts.
- Quoting live goal text in source comments poisons the resolver (happened twice). Write-intent regex `record\w*` fired on noun.
- pull-sync ~10 min restarts killed composes mid-draft; protection marker existed for EDITED vessel not RUNNING vessel → 379ef9f4 in_flight deferral (bounded 3). Drain 240s vs ceiling 540s mismatch by construction.
- Drafter ops:[] because grounding window missed region; resolved term now forwarded as anchor clause ("evidence discarded at a boundary").
- Detached HEAD push hazard.
- "Operation timed out" = busy serialized compose lane (1–19 compose starts/10 min autonomous) → ceiling 900s via `EDIT_INTENT_COMPOSE_TIMEOUT_MS` (env-gated); gap filed `directed-goals-have-no-priority-over-the-boredom-compose-stream` (recurs: MEMORY 09-23 directed flag, 09-28 `directed:true` hand-off).
- Mis-route has DELAYED WRITE PATH: gap `pwt-activity-api-seed-cleanup-test-data.ts-f9df528d` → autonomous 3fcb07c added unbound `$test_org_id` → reverted a9f4dbe. Filed `unbound-sql-parameter-passes-every-gate` (same class as N16 unbound CREATE param).

### N48 symptom→identifier translation wired, fails closed (2026-08-10) — goal-walk-floor
- 3f4421d `proposeSymbols` LLM hook after lexical routes fail; model snake_cased English (tenant_marking). Needs candidate vocabulary (law 8). Gate A `isPathlessCodeChangeGoal` requires code noun by design.

### N49 symptom vocabulary does not appear in code (2026-08-10) — goal-walk-floor
- c1985ec vessel-name rule matched only `<name>-vessel` (5 repos unnamable); unguarded multi-word rule minted `timestamps-come-vessel` etc. Phrase search 0 hits vs TimestampSchema 24×. 0482df4 fleet landed `_hasPayload` rewrite concurrently.

### N50 system autonomously closed failure-count disposition (2026-07-29) — narrowing-duplicates / spend-envelope-throughput
- d5b8968 (Substrate Autonomous) gap-lifecycle-scan closes gaps with failure_lessons.length >= 8 (`persistent_compose_failure`), matched independent adversarial design wf_316106c0.
- On-demand EARLY-EDIT-INTENT dispatches (240s budget) timed out because feature_compose was busy composing the same fix — contention; "~24h stall" was `git log -1` artifact.

### N51 system-side verification chain, four seams (2026-09-28) — write-read-mismatch / false-verification
- Gap `resolve-url-walk-path-sites-7457-15128` closed `landed_verified` close_basis absent via re-measured class2 evidence_resolve after 5ca51be.
- Seam 1: trace listing read `v_paradigm_execution_traces`, ABSENT since ~09-22 (the view N20 repointed 7 scripts onto on 08-25!) → b8671c9 reads `execution` directly. Seam 2: reporter counted only status failure (tool failures are status success + failure_mode) → 927bb26, 40a5c7f. Seam 3: sweep took first 25 of 156 in store order → 6583dd4. Seam 4: cutover stamps removed-line `hardcoded_url` literal (a0bee87) overriding evidence_resolve → guard.
- Caveat: 5ca51be directed (operator-scoped).

### N52 syzygy spoke federation relay identity restore (2026-07-27) — federation-p2p / sync-deploy-drift / env-gating
- Orphan manual `bun relay.ts` squatting :30333 → systemd relay EADDRINUSE crash-loop, different keyfile → different peerId. Stale RELAY_MULTIADDR in env (baked from docker -e). PUBLIC_IP unemitted by image-baked stale gen-env → bootstrap served loopback identity (law 11). deploy-hub.sh derives relay from stale ~/relay.log; deploy scripts pkill relay and respawn with wrong key.
- CI dead since 07-25: gitlink to ghost 5d05558. gen-env SUBSTRATE_ROOT unbound before default (edccdc2f). Gaps: gap-substrate-root-unbound-before-default-in-gen-env, gap-ci-image-build-fails-on-unpushed-submodule-gitlink, gap-genenv-image-baked-not-pullsync-converged, + orphan-process-squats, relay-log-derivation, frozen-bootstrap-env, identity-endpoint-loopback.
- goal-host masked by hub role.

### N53 target inference right; edit path dies on satisfier pseudo-id (2026-08-10) — goal-walk-floor / endpoint-routing
- Symptom goal inferred correct read shapes but no edit shape (#57 recurring on a closed task). Satisfier pseudo-ids (40% of path steps, 63.5% accepted pathways) pinned as targetTemplateId → `template 'satisfier:fs_edit' not found`. Fixed dd12c17 (decline to pin).
- Gate 1 was the inference PROMPT (only worked example teaches analysis) → 5b3ae9d counterweight rule gated on producible edit shape; confidence 0 → 0.95.
- Next blocker: `code_modification_proposal_write` advertised by activity-api-local at loopback 127.0.0.1:8080, masked on spoke → loopback-advertisement misroute (#60), fix lifted into vessel-discovery-client but wiring deferred.
- Deterministic regex shortcuts drop write clauses ("Write a memory note recording the count" → planned [shellResult], reached:true, no note).

### N54 teaching pivot: self-goal generation (2026-07-30) — memory-recall / dormant-mechanism / docs-drift
- Audit wf_43fb7008: only live teaching channel = concept-db `compose_lesson` (write feature-compose.ts:1507, read ~:1554). memoryNote store NO runtime reader; reach_gate_lessons written but unread (dead archive). operator-goal-generator.service dead by design.
- 7 teaching concepts written (3 silent write failures in first batch). CLAUDE.md amended 3d6db3ab (law-6 third question; "teach through the channel that is read"; "wrongness is a goal seed").
- Stale candidate burned 34 picks/6h on long-fixed premise → lesson: measurable-premise gaps should carry deterministic re-check and self-close.
- NOTE: N15 (08-29) later found the compose_lesson channel itself unread due to concept-db timeouts → the one live channel became dead too.

### N55 ten-rung goal ladder (2026-08-05) — goal-walk-floor / composition-crystallization / node-locality
- 8/10; deterministic spine 7/7 exact. substrateGap_write unreachable through walk (nested `{gap:{}}` envelope vs flat pointer; 4 minted arms all fail — law-3 negative mints). test_suite never selected: shell safety-net pre-empts purpose-built shapes ("advertised + 200 OK proves reachable, not SELECTABLE").
- Stored column is `endpoint_output_shapes` not produced_output_shapes (instrument trap).
- Hub and spoke run SEPARATE development-vessel instances; autonomous cutovers run on HUB; spoke test_suite organ doesn't observe hub landings; no SSH to hub logs (node-locality).
- Concept-db wire still severed (walk-concepts consult failed fail-open).

### N56 advertised-vs-resolvable audit needs listing endpoint (2026-08-10) — endpoint-routing
- discovery POST /resolve EXECUTES a shape; only vesselCapability/Endpoint/Health/Registry types list. Three probes died to controls. "Free" nemotron model routed to Anthropic client → bills Anthropic (credit dead) — model-policy learner sampling an arm that cannot execute.

### N57 anchor window centred away from edit site (2026-08-11) — drafter-quality / autonomous-regression
- `renderSafeAnchors` (cross-file-symbols.ts:281) ±80 band centred on first occurrence of mined term (often a comment) or midpoint. Substrate fix d95bf13 regressed empty-region case (`"x".includes("")` true → band moved to file top); restored 6e63247; substrate then landed right version 8b838d0→05aeaa3. dd7afb3 nearest-anchor + `locateRegion`; dcb4198 route paths as locators; 2ff42fe anchors to re-derivation; drafter STILL fabricated (`router.get` vs `app.get`) → e637523 pick-an-index; 5dfc141 fixed two gates refusing each other (provenance vs index).
- LAW: when a gap names TWO conditions, assert both. Two correct gates can compose into refusal of good work. Suite diffs under load are timeouts — paired back-to-back comparison.

### N58 antiloop guard cannot see its loop (2026-08-10) — drafter-quality / dormant-mechanism
- patch_with_tools: malformed turns (tool name in action slot) push no tool_result and `continue` silently; anti-search-loop guard (2026-06-17) breaks at first undefined tool_result → never fires. 24 consecutive code_read_lines → fail at MAX_ITERATIONS 30. Morning: done 2 vs fail 19. anchor_not_found 30 lessons.
- Operator's f38f1a3 prune emptied goal-host node_modules/@avigopal (TS2307 false "bad drafting").
- `GET /dispatch/<id>` 404 polled 45×. closed_reason nested. Reach verdict yes while tags reached:false (grep count "satisfied" implement goal).

## Per-note digest batch 5 (notes 59–65)

### N59 applier read a directory nobody writes to (2026-08-11) — write-read-mismatch / codebase-bloat-fossils / sync-deploy-drift
- apply-proposal-as-patch.ts read `$WORKSPACE_ROOT/proposals` (= /workspace/git/super-repo/proposals, nonexistent; 21× ENOENT/24h) while 3 writers hardcode `/workspace/proposals` (observe-and-author-from-gaps, code-locality-mining-tick, gap-lifecycle-scan): 4,138 entries / 2,257 pending stranded. Fixed by dispatch; verified functionally (dry_run → mitosisStaged). Same WORKSPACE_ROOT split as N29 (08-09) — recurrence 2 days later in another consumer.
- pull-sync self-heal recognizes only "Substrate Autonomous"; substrate also commits as "Substrate Bot" → clone ahead 2 behind 72 forever. Gap `pull-sync-self-heal-does-not-recognise-the-substrate-bot-identity`. Ordering trap: commit ff10d3a0 adds 476 root-level junk files (TCG pptx, NOTES.txt, .gitconfig).
- Container clone had NO placement hook (core.hooksPath unset) → junk commits possible. Installed.
- Corrections: boredom is a daemon (stale timer fields normal); rhythm registry not empty (4 timeShapedRhythm, conductor stale).
- Reset of wedged clone denied by permission classifier.

### N60 architecture prescribed activities-as-tests and counterfactual relevance (2026-08-30) — docs-drift / dormant-mechanism / spend-envelope-throughput
- IMPULSE_ACTIVITY_FOUNDATION :699/:746 "activities ARE tests / traces ARE test results"; reality: `timeout 240 bun test` per change (the rejected "Traditional" column); loadavg 41–57 on 14 CPUs, ~29 concurrent suites, untraced (why CPU was unattributable).
- Relevance prescribed per-(activity,impulse) counterfactual (times_success_when_not_loaded, irrelevance_score); implemented: global times_loaded/succeeded/failed/relevance only — law 12 violated at schema level; `times_loaded` reused as prune predicate.
- Architectural silences: no requirement that catch changes caller-visible status; no spec of what verification must check; no partial-application accounting; /health derivation; command recording. Drafter-empty-string is accepted design (SHAPE_ACTION_EVIDENCE_EXPECTATIONS.md:38).
- SUBSTRATE_AS_DYNAMICS master inequality λ1 ≳ ρ_grow; livelock "globally cyclic, locally acyclic, productive-gradient-free" = measured 1392 executions/h of which 6 feature_compose. Growth governor, mint gating on spectral gap, early-warning detector: NONE built. No decay/prune/GC for concept store; `impulse_signature` (86.4% of store) undocumented. SUBSTRATE_AS_SOFTWARE §6 names cost-aware selection as unbuilt frontier ("recorded-but-unread field").
- PATTERN: prescribed structure implemented as its cheaper observational shadow.

### N61 arguments amputated at four (five) layers (2026-08-17) — write-read-mismatch / composition-crystallization
- Learned compositions completed 6/61; every stored task config == {"type":"<resolver>"} (98/98). Five layers dropped resolver args: activity-api-trace-sink key-by-key payload, ias-executor ExecutionTaskRecord, normalizePersistedTask whitelist (2nd instance after 08-13 shapes fix), extractTasks reads `tt.config` while write lands `resolved_config`, ribosome prompt skeleton `"config":{}`. Fixed 9518d4e; mismatch recurred in own fix (f71bb56).
- LAW: explicit key-by-key projection is a silent dropper by construction.
- Live effect operator-gated: ACTIVITY_API_ENDPOINT = syzygy.host:18080 on every vessel; traces land on hub (node-locality).
- Masked-but-running trace store (4th instance). mock.module redis factories killed 53 test files at import; 509/114 → 769/136.
- Detectors filed not built: write-key/read-key agreement; no running unit masked; mock.module exports.

### N62 arithmetic false rejection repaired through substrate (2026-09-11) — false-verification / composition-crystallization / selection-learning
- `verifyDeterministicCompute` returned null on truth-present → LLM judge rejected correct 20413. Substrate landed 0c7f10e (standalone delivery green only). Reuse fired at pathwayReusePolicy minSuccessful=3/minTotal=5; REUSE-BEFORE-DERIVE 4s vs 60–90s; tier-2 rebind.
- Operator filed false-premise gap ("selection doesn't consume credit") and composer picked it up within 1s.
- cd011e3 rebind punctuation "149." vs "149)"; tombstones don't stop donors re-deriving poisoned adaptation. d8b1d92 compute-artifact oracle. Post-reach answer mirror clobbered goal-named note (gap `post-reach-answer-mirror-clobbers-the-goal-named-artifact`); abb07ea bridge sink clobber fix. 2-step ladder reuse 7s.
- "substrate-landed ≠ substrate-repaired": fixes operator-DRAFTED verbatim. Second concurrent session shares DevBob identity.
- Post-land suite `ran=false` on EVERY cutover → gap `autonomous-landings-are-never-post-verified` (high). MEMORY.md 09-28: post-land suite dead 08-31→09-28 (30s shell kill) — this 09-11 note already saw ran=false; not fixed for 17 more days.
- Qualification envelope docs/QUALIFICATION.md + rhythm family `qualification` seeded; first firing verified.

### N63 audit field discarded by SCHEMAFULL table (2026-09-05) — trace-store-db / false-verification / autonomous-regression
- cc81c2d `retired_reason` writes vanish: `activity` SCHEMAFULL missing 6 fields from migrations 048 and 055; 37 migrations recorded applied inside one second (2026-06-28T07:59:20) by init-database bootstrap pre-populate. SAME mechanism as N16 (08-04, fixed b4d7b0e for the failed-read path) — the fresh-DB bulk-bootstrap path still marks unapplied. `ExecStartPre=-` discards exit status.
- Substrate-authored repair a4b7f1b (unparseable 254-byte .surql) passed typecheck gate (tsc doesn't parse .surql); earlier draft 6ac1aa6 was VALID but created NON-optional fields on 3,886-row table → every write to `activity` rejected (156 errors/35 min) — AUTONOMOUS REGRESSION. Ledger then blocked repair (205 recorded applied) → 206 with DEFINE FIELD OVERWRITE (53d310d).
- Gate `surqlBreakingFieldRefusal` e8bc5ca (1 flagged/217, true positive). Detector `declarationDrift` in existing schema-assert-drift-scan (8636190, e85d3ab): 254 naive → 2 real after denominator (SCHEMAFULL only, row counts, backticks); emits stable-id gap only when finding.
- General `staticEvaluate` returns static_checks_pass for any unreadable extension — untouched (last fail-closed gate wedged landings).
- gaps/gaps.json and state/learning-mode-state.json tracked but substrate-rewritten.
- MEMORY.md 09-22: .surql landings dead since 09-16 because substrate-authored 54b7762 deleted the `^DEFINE FIELD` guard — this gate was later broken by the substrate (autonomous-regression recurrence).

### N64 authoring lane refuses 96–99% (2026-09-10) — spend-envelope-throughput / narrowing-duplicates / hollow-landing
- Field-extracted (457 reports): FAVORABLE 12.5%, apply_failed 28.2% (drafter), judge refusal 24.9%, no verdict 33.7%. Journal-grep 1–4% was lane-scoped wrong.
- Fix visible to substrate's own measurement only after substrate-bot submodule bump (~6h cadence); human-surface-vessel is plain directory.
- 30af71f import-based coverage fallback landed INERT: readdir on a file path → ENOENT → every target "untested". Proven by execution.
- Lane yield: route-edit 18.4% (48/261), recommit 0.8% (1/121, 26.5% of capacity), named-gap 10.7%. Lane is the discriminator.
- ~12,500 `feature_compose` execution rows are not composes (300ms, 0 tokens).
- Posterior moving (α 83.96/β 1080.87) not evidence (POST /reach separate grader). Pre-register observable; landed→deployed→inert recurred 3× in a day.
- Filed `semantic-refusal-cites-a-counter-example-nobody-executes`. fda568a substrate-authored id-namespace revert.

### N65 autonomy criterion met; log silence read as failure (2026-09-12) — false-verification / sync-deploy-drift / gap-content
- 2a54e9a + others Substrate Autonomous on origin/dev; operator ran git log in host checkout (unfetched). 25 substrate commits in ~11.5h while operator reported BLOCKED.
- walkFallbackModels logs nothing on success and nothing on non-failover errors; exhausted walk returns ORIGINAL model error.
- Interrupted mitosis rebase stranded runtime clone 3.5h, undetected (submodule .git is a file). Impact over-claimed 3× (composes stage from committed tree). Filed `an-interrupted-mitosis-rebase-strands-the-runtime-clone-with-no-detector`, `a-fixed-temp-filename-makes-the-model-policy-writer-lose-updates`. goal-host src/index.ts 3-line stub hazard; /vessels goal-host diverges +1298/−128; 14 uncommitted tracked files across 8 repos.
- False-premise gap (savePolicy RMW) retracted. Gap store silently dropped `severity`.
- MCP cockpit 401 (operator key revoked; fleet key valid).
- Reach 3/46 = 6.5%; 89% of failures one rule `edit-intent-no-landed-edit`; 9 satisfied by substrateGap_write; gaps with no edit_site manufacture permanent not_achieved. Column is `goal` not `goal_text`.
- git_status returns only {commitHash, repoPath, ref}; branch-health.ts probe has no assertion.

## Per-note digest batch 6 (notes 66–75)

### N66 bodyHonestyPolicy is host-local (2026-08-10) — node-locality / env-gating / false-verification
- Policy read at use time from `WORKSPACE_ROOT/policies/body-honesty-policy.json` in a HOST volume → spoke resolved:true, hub resolved:false after migration; walk logged law-1 fallback twice. #61 closed on spoke-only verification. Law 1 satisfied, law 11 violated. Fix must be substrate state seeded by bootstrap or served via discovery. Detector: fallback counter non-zero (log emitted, no reader).

### N67 build reproducible on exactly one machine (2026-08-09) — sync-deploy-drift / docs-drift
- `.gitmodules` HTTPS URLs for 18 private repos → fresh `clone --recursive` fails; relative URLs 93cd10f8. Super-repo pinned SHAs 30 commits behind 6 vessels; Dockerfile builds from working tree (0d22fb2e).
- host-pull-sync.timer unit vanished 08-07 (dead 2 days); substrate-doctor all via docker exec → host loop invisible. validate-build reproducibility gate 7481a497 (false positives on --depth 1 → 17973efc); doctor check 7 c8ffbae5.
- LAW: prove a check fires when violated AND stays quiet when property holds.

### N68 cadence layer scheduled by the thing it replaces (2026-09-09/10) — dormant-mechanism / selection-learning / env/cadence
- `rhythm_conductor_tick` is `satisfier:` Thompson-selected (11 executions ever, last 53.5h); 90/102 validator-shaped activities dormant >24h (advertised-shape-coverage-scan 15.4d, orphaned-capability-scan, detector-coverage-scan 9d, coverage_tick, substrate_health_tick...). Survivors are systemd-timed or high-frequency. Seeding rhythms 09-07 did NOT restore cadence.
- Registry lost in 09-09 power outage; restored from `/workspace/pool/standing.json` bodies (11 rhythms + 2 rhythmFamilyGoal); `rhythm-seed-tick.ts` + `rhythm-conduct-tick.ts` + rhythm-cadence.service/timer 22146522 (bootstrap tier, 15 min timer); enable fix 7f97df70 proved on convergence.
- `rhythm-reality-sync` 2000ms timeout vs 3.7–5.3s runtime → catch coerced unknown → 0 open gaps → gap-closing staleness 0 with 1,038 open. Timeout fix da6466a via patch_with_tools landed only half (abstention missing); re-dispatched single-concern e86bcd4 landed abstention (dispatch reported `failed` while work shipped).
- Scheduler coherent and inert: only gap-closing has staleness driver; its budget 0.4 > affordability 0.333 at bucket_load 2; 10/11 rhythms frozen. `skipped: []` with considered 11 = observability hole.
- Pool vs `impulse` table are different stores. Gap store restored post-outage (4,187 gaps, 984 open, 1,749 failure_lesson, 1,064 with edit_site); ~50 orphaned gaps.json.*.tmp ~300MB disk leak; `/workspace/gaps/gaps.json` mtime 09-07 but July contents.

### N69 ceiling always above floor (2026-08-08) — false-verification / selection-learning / composition-crystallization
- Retracted "learned 9.6% vs floor 100%": floor recordGoalPath only inside `if (uf?.reached)` → 172/172 by construction; honest floor 23.9% (205/859). `walk_tier` = name substring ("learned-"/"composed-cap"); 94% of learned_pathway rows executed once. Jackknife ceiling 47.7–60.5%.
- Gaps: `floor-records-only-its-wins` (site 1 fixed 550ce23 substrate-authored), `walk-tier-is-a-name-substring-not-reuse`, `minted-copy-of-the-floor-shadows-the-floor` (ribosome minted `learned-universal-tool-fallback`, 3/32), `zero-success-recommendations-are-discarded`.
- `pathwayReusePolicy` HAS NO PRODUCER (unresolved 1,708×/7d) → hardcoded {1,1}. (By 09-11, N62 shows it served with minSuccessful=3/minTotal=5 → resolved later.)

### N70 checked boundary audits clean n=4 (2026-09-02) — false-verification / gap-content
- `@shape-dispatch:private` opt-outs 4/4 clean; defects concentrate where nothing checks. Filed `boundary-contract-unverified-cross-vessel-field-names` with honest `falsifier: "none"` (check-shape-dispatch is a lint script not a resolvable shape). ~98.2% no-falsifier population saturates picker.

### N71 class-1 arming guard never fires (2026-09-22) — false-verification / gap-content / node-locality(paths)
- `predicateLiteralNotUnique` strips `repos/` then joins root that needs it → ENOENT in catch = "absent" → every class-1 expected_literal arms → gaps born closable. Stray partial tree `/workspace/git/super-repo/development-vessel/src` (Aug 16) masks it. Operator's own gap closed on "surface" literal already present 5×; landed fix put surface in METADATA not key.
- `source` flip human_reported → substrate_detected on one gap (conditional).

### N72 cockpit pointed at dead hub (2026-08-23) — endpoint-routing / node-locality
- `.mcp.json` → METABOB_CONFIG_PATH repo-local config → syzygy.host:18080; hub serves data plane but not self-development plane (goal_execution, substrateGap, memoryNote found:false; :18210 refused). Dead-plane discovery miss = "no producer". Repointed to localhost; MCP needs new session. Lead: .mcp.json mtime 08-01 coincides with activity minting collapse (79/wk → 4 in 21 days).

### N73 compose grading seam + system picked gap up (2026-09-06) — write-read-mismatch / selection-learning / hollow-landing
- feature_compose 899 rows, 894 reached NULL (0.56% graded): goal-host synthesises `feature_compose:<sha>` id; resolver `void fetch` discards minted exec_ id. `SYNTHETIC_EXECUTION_ID_PREFIXES` suppressed the warning on a wrong premise. Sibling precedent in vessel-mitosis-cutover.ts (awaited emit, EMIT_TIMEOUT_MS 1500).
- System picked the operator gap up autonomously, localized correctly, own adversarial gate refused wrong-artifact patch (correct).
- Operator fix read wrong response branch (`data.execution_id` vs top-level) → inert; substrate ed86ab4 extended the dead code (2nd instance, first b24df4e). Fixed be8ff83 → ed86ab4 → f611478 (INERT: patched late path; goal-host has SEVEN synth sites) → 0c36ead early path → first verdict on real exec_ row.
- UNFAVORABLE compose orphans its row → β signal lost; gap `an-unfavourable-compose-orphans-the-row-it-created-and-the-beta-signal-is-lost`.
- `vacuousEditReason(old,new)` counts refs in snippet not file → declaration repairs refused → pushed to ungraded patch_with_tools (architecture of "compose refused 2×, pwt landed worse"). Workaround: include a using line; fix = reconstructed-file like sibling `deadStoreEditReason`. Self-protecting defect.
- A gap closed 17s after falsifier pass with zero traced work (cause unidentified). Landed ≠ deployed (be8ff83). Journal "pwt edits" were proposed args, not applied. Load >12 → timeouts not refusals. 3-op goal landed 1/3 via pwt. `uniq -c` counts lines (359 → 8 ids).

### N74 compose host restarts faster than compose can finish (2026-08-11) — spend-envelope-throughput / sync-deploy-drift / drafter-quality
- development-vessel hosts feature_compose for fleet; restarted ~every 13 min by its own cutovers → 54 drain refusals/2h20; isolated activity-api composes (~1,250-test post-land suite) killed before cutover; last activity-api cutover 14.5h earlier. Self-starvation loop; biases posterior toward compose COST not quality.
- Wrong instrument: live tree for isolated vessel.
- Restart attribution breadcrumbs 644e7ee + super-repo 18a82bac (UNATTRIBUTED START). Real culprit: HOST `host-pull-sync.timer` `make restart-<vessel>` every 5 min on committed changes — outside container. Stopping timer doesn't stop running service.
- Quiet window: drafter still anchored in wrong region. In-place vessel: hallucinated `this.childProcess` over a doc-comment line (parses → invisible to bec9d8d unparseable check). `edit-provenance.ts` 6060ab7 (anchor from window + unknown member receiver); causal story retracted 6d3074d.
- Fix proposals: defer compose-host restart while in flight; drain deadline ≥ compose ceiling; separate feature_compose lifecycle; KILLED_BY_HOST_RESTART verdict. Detector: slot claimed/released without verdict.

### N75 compose kill switch halts operator lane (2026-08-12) — env-gating / directed-overshoot / spend-envelope-throughput
- compose-slots.ts:214 `effectiveCap = directed ? cap : Math.max(1, cap-1)` → COMPOSE_MAX_CONCURRENT=0 halts directed lane, autonomous keeps 1 slot. Emergency drop-in 99-emergency-compose-halt.conf. Earlier "✅ WORKS" validation only exercised directed lane. Gap `the-compose-kill-switch-halts-the-operator-lane-and-leaves-autonomous-work-running`. No test covers cap=0.

---

# SYNTHESIS BY PROBLEM CLASS (recurrences aligned across notes; "hats")

## write-read-mismatch (the dominant hat in this shard)
Same root each time: a producer writes a key/path/table/id/shape that the consumer does not read (or vice versa), failure is silent (optional chaining, SCHEMAFULL drop, `?? default`, fetch 400 swallowed, catch → empty).
Instances, chronological:
1. 07-22 route body attributed to wrong symbol (N1) — grader reads column-0 decl, route registrations not recognised.
2. 07-25 a8005bad selects top-level goalSignature, producer writes under trace.metadata (N21).
3. 07-31 deterministic labeler `labeler:"deterministic"` vs whitelist ['human','automated'] → 400 silent (N9, N12). Revived 23e707f.
4. 07-31 composition-edge reconcile reads `activity_execution_traces` (frozen 07-14) vs live `execution` (N9) → 08-25 SEVEN scripts still read it (N20, 3c1bf965 → `v_paradigm_execution_traces`) → 09-28 that view ABSENT since ~09-22 (N51, b8671c9 reads `execution`). Three hats, one class, ~2 months.
5. 07-31/08-07 unwrap sites gate on `"llm_completion_result"`, producer returns `llmTextCompletion` — author-producer.ts:815 (e61621db, 07-31), goal-host proxy b164b73 + ias-executor 2a12397 (08-07). Same wrong literal at 3 sites fixed on 2 different days.
6. 08-04 `expected_output_shapes`: recordGoalPath never sent it; CREATE params missing binding; response zod strips; migrations never applied (N16).
7. 08-09 gap-lifecycle-scan hardcodes `/workspace/gaps/gaps.json` vs writers via WORKSPACE_ROOT (N29) → 08-11 applier reads `$WORKSPACE_ROOT/proposals` vs writers hardcode `/workspace/proposals` (N59, 2,257 stranded) → 09-06 `/workspace/gaps/gaps.json` still a fossil written until 08-30 (N44) → 09-22 class-1 guard strips `repos/` (N71) → MEMORY 09-22 two memory stores (EnvironmentFile WORKSPACE_ROOT). One class: path accessor split, 6+ hats.
8. 08-10 bodyHonestyPolicy host-local file (N66).
9. 08-17 resolver args dropped at five layers; `tt.config` vs `resolved_config`; recurred inside own fix (N61).
10. 09-05 SCHEMAFULL drops undeclared `retired_reason` (N63).
11. 09-06 compose exec id: goal-host synthesises sha id, resolver discards minted id, operator read wrong response branch; 7 synth sites (N73).
12. 09-10 import-coverage fallback `readdir` on a file path (N64).
13. 09-10 rhythm-reality-sync correct field, wrong timeout → coerced 0 (N68).
14. 09-28 reporter counted status failure only (tool failures are status success + failure_mode) (N51).
Durable class fix repeatedly proposed, never built: `joint-liveness-detector-missing-write-read-class` (08-25), write-key/read-key agreement detector (08-17), unbound-sql-parameter detector (08-10), `declarationDrift` (09-05 — BUILT, the one that exists).

## false-verification (self-confirming / vacuous / fail-open gates)
- Shared-parse oracle agrees by construction (08-04/05, N7/N8); 6 sibling sites unfixed.
- Operator's test gate blind to vanishing tests (N7, ca81f29); rolled_back set unconditionally (N39, 67370ee); reconcile predicate "replacement appears somewhere" (N41, 1932c7b); cited_check_names lied (N11, ad5d24a); doctor check 6 vacuous, pre-commit early exit, gitleaks rule (N4); class-1 arming guard fail-open (N71); script prints header unconditionally (N42); `2>&1 > file` (N42); kill-switch validated on one lane only (N75); vessel-prefix scoring (N46).
- LLM semantic gate: anti-correlated with effect (N22), inverts negation-dense facts, second-order ratchet by goal hash; fails open on judge outage (N37); doesn't check gap premise (N10 c7fb5a67); greened no-op REPLACE (verifyEditPostState abstains, N10); greened header-only effect-less diffs (N24); halved two-op goals while FAVORABLE (N35); `vacuousEditReason` snippet scope refuses declaration repairs (N73).
- Typecheck gate certifies .surql it never parsed (N63); `staticEvaluate` returns pass for unreadable extensions (open).
- Reach grader: rubber-stamped unapplied fileEditResult (N31), fs_list 0 files (N24), flattened two-step goal (N26), reach with no produced shapes (N34), grep-count "satisfied" implement goal (N58), `verifyDeterministicCompute` null-on-truth (N62), post-reach mirror clobbered artifact (N62).
- Detector loop fed only by failure traces → blind to false greens (N36).
- Instrument traps (operator side): 100-row cap (N9), `id CONTAINS`, ORDER BY empty, unparenthesized AND, `goal` vs `goal_text`, `endpoint_output_shapes`, nested closed_reason, `uniq -c`, filtered counts, host checkout vs container clone (N65), dist vs src (N25), journal of proposed args (N73), log silence ≠ failure (N65).
- Retractions in shard: N16 "VERIFIED LIVE" hollow; N27 5-step misroute story; N35 "step one closed"; N42 combinatorial; N65 rebase impact ×3; N69 ceiling/floor; N74 causal story (6d3074d); N62/N65 false-premise gaps.

## hollow-landing
- 27d02a2 `// Add logic` stub passed every gate (N10/N12); c7fb5a67 net-negative (reverted 15347a77); a8005bad no-op (N21); 5 header-only compose-report cutovers (N24, removed 04aa35e); 4eedb4de inert fly.dev URL (N14); a803852 unsound rescue inert (N13); 30af71f coverage fallback inert (N64); f611478 inert (N73); ed86ab4/b24df4e extended dead code (N73); 5429436 mis-localized under judge outage (N37); drafter envelope written into source (N41, 7 artifacts in /workspace/proposals since 07-29); `this.childProcess` over a doc comment (N74).
- Mechanisms added: detectZeroBehaviorDelta tautological tests (de0a3b0), detectEffectlessHeaderOnlyDiff (33b7d9e), hollow-stub gate 1b5e7c9, off-target 15c611e, edit-provenance 6060ab7, surqlBreakingFieldRefusal e8bc5ca, bec9d8d unparseable_typescript.
- Principle repeated: "every gate READS the diff, only a test RUNS it."

## autonomous-regression
- 0a0d59f drift gate deadlocked every isolated cutover incl. its own repair (N32).
- 6ac1aa6 non-optional fields on 3,886-row SCHEMAFULL `activity` → every write rejected 35 min (N63); a4b7f1b unparseable .surql.
- d95bf13 renderSafeAnchors empty-region regression (N57).
- 3fcb07c unbound `$test_org_id` from a mis-routed gap (N47, reverted a9f4dbe).
- 225ab19 series: two-line anchor half-applied shipped broken sentence to origin/dev (N39).
- Substrate-authored hollow retry loop (df0f233 replaced, N24).
- 09-26 recursion storm through goal-host's own /resolve (N3) — no ancestry/depth brake.
- Walk satisfiers (fs_edit, code_replace_lines, auto-bridge-fileEditResult) write live /vessels source with no rollback (N3, N11, N39 bee05ca).
- MEMORY 09-22: substrate 54b7762 deleted the ^DEFINE FIELD guard of the gate built in N63 (recurrence).

## directed-overshoot
- c7fb5a67 operator goal reversed a deliberate skip (N10). fd5dff4 drain-floor made hollow lesson goals win 3× (N19). f5827b1 keystone inert. fbdac11 blanket clamp → d737edb (N37). 0b0e273 retry amplification → b013f30 (N24). Emergency compose halt drop-in inverted priority (N75). Operator restore-mode guard wiped a patch_with_tools edit (N3). Operator f38f1a3 prune emptied node_modules (N58). Operator `make restart-<v>` poisoned baseline (N2). Operator probe leaked `zzz_impossible_no_such_helper` into deployed tree (N10/N12). Operator host-pull-sync restarts killed composes measuring commits (N74). Operator's 5-agent workflow triggered DB thrash (N43).

## drafter-quality
- Confabulated anchors (N16, N57 `router.get`), invented helpers (N2), no-op identical edits, TS syntax, whole-file truncation (refused), envelope-in-source, hallucinated member access (N74), 2-op goal halved, multi-anchor edits (seed registration, 4-site llmCallWithFailover) blocked (N10), insert-after-signature unreliable (N16), invented minimal .surql syntax (N63).
- Information fixes built: contextual multi-line anchors; symbol/locator derivation (dcb4198); nearest-anchor (dd7afb3); anchors to re-derivation (2ff42fe); pick-an-index e637523; anchor clause from resolver term. Remaining: ADHERENCE (N57) — mechanical fix only.
- Model hardcode law-1: deepseek → sonnet-5 (5273bfa) → "auto" (47096a7).
- 08-09 N2 refutes information-starvation hypothesis for that case (grounding > file); 08-11 N57 shows information WAS missing (band) then fixed, adherence remains. Both true in different cases.

## gap-content
- Abstract self-goals decompose into phantom shapes (N17); "needs a producer for shape X" confabulated walk-internal shapes (N17, N10); gaps without edit_site manufacture permanent not_achieved (N65); ~98.2% no-falsifier population (N70); class-1 literal already present → born closable (N71); gap closed with zero traced work (N73); gap premise not checked by gates (N10); gap store drops severity (N65); mis-route files a gap that later lands bad code (N47); precise file-anchored gap summaries DO get picked up and worked (N73).

## narrowing-duplicates
- `-narrowed` ids appear (route-edit-e3061830-narrowed, N73); recommit lane 0.8% yield, 26.5% of capacity (N64); identical goal hash ratchet → `feature_compose:rejected:<hash>` (N22); goal-host coalesces identical goals (N26); in-memory dedup Sets refire on restart (N3); duplicate route-edit gap-level race filed (N14); retry of landed edit double-applied (N3); 13 formulaic gaps reopened same ids (N10); 81 reopened same-id max 7 cycles (N12); failure-count disposition d5b8968 (N50); reopen>=3 → needs_info (N10 #2).

## selection-learning
- Walk selection IS learning (variant_performance_metrics) but admission LIMIT 10 recency truncation (fixed 1d9701d) (N10). `activity.thompson_*` dead denormalized (N24). CI webhook (only commit-keyed CI→Thompson path) dead 741 runs (N7, fixed 304b3b6). Wrong answers alpha-credited (N7/N8). Hollow α leaks closed 8fd1c23, 5b415ae, d737edb (N31, N37). Auto-promote inverted threshold (N28). floor records only wins; walk_tier name substring (N69). pathwayReusePolicy no producer (N69) → later served 3/5 (N62). compose rows 0.56% graded (N73); UNFAVORABLE orphans β (N73). Posterior moving ≠ fix worked (N64). Compose-host restarts bias posterior to cost (N74). scaffold-and-publish-vessel α=6/β=8610 executed 2345× via pinned target bypassing selection (N25). Model-policy learner samples "free" arm that bills Anthropic (N56). Cadence rides Thompson (N68).

## composition-crystallization
- Tier-2 lexical rebind + multi-slot + persistence (N24) — worked. Reuse fired at policy bar (N62). Ribosome dormant 07-31 (N12); args amputated 5 layers → learned compositions 6/61 (N61); composed-cap promoted after inverted threshold fix (N28); middle-mile no similarity index (N23); multi-vessel compound composition blocked (N24); composition flattened (N26); change-series orchestrator works but edit path unsafe (N41); whole-file deletion undispatchable (N11, N39, N41); nothing authors plans.

## goal-walk-floor
- Symptom→file routing: vessel name rule (c1985ec), symbol search (69be9f0), proposeSymbols (3f4421d), write-context narrowing; 3/6 file accuracy (N45–N49). Inference prompt taught analysis only → 5b3ae9d (N53). Satisfier pseudo-id pinned (dd12c17). Shell safety-net pre-empts test_suite (N55). substrateGap_write envelope unreachable via walk (N55). walk fallback 500 on pointer.spec (N16). Starvation of file location (N34). ReAct floor 23.9% honest (N69). 11/11 arbitrary domains (N24).

## sync-deploy-drift
- dist vs src (N25); mirrored ≠ running (N16, N27); goal-host self-edit doesn't restart goal-host (N16); cutover interrupts in-flight dispatches (N16, N35); inventory seeded-if-absent (N38); image-baked gen-env stale (N52); submodule pointers 30 behind, HTTPS .gitmodules (N67); host-pull-sync timer vanished (N67); pull-sync restarts killing composes (N47 379ef9f4, N74); submodule bump ~6h lag for substrate's own measurement (N64); rebase stranded clone 3.5h (N65); three writers of runtime ≠ git (N3); push ≠ deploy (N42); landed ≠ deployed (N73); Substrate Bot identity not recognised by self-heal (N59); no placement hook in container clone (N59); setup-git-push doesn't bun install/link (N43).

## spend-envelope-throughput
- Compose lane serialized; directed has no priority (N47, N50); ceilings 240→540→900s env-tunable (N47); compose-slots kill switch inversion (N75); verification = full `bun test` per change → loadavg 41–57 (N60); dev-vessel compose host restart loop (N74); recursion storm exhausted all providers incl paid (N3); LLM credit dead episodes (N30, N31, N55, N56); retry amplification (N24); FAVORABLE only 12.5% (N64); recommit lane waste (N64).

## trace-store-db
- Thrash episodes 07-23/24 (N43), 16-index delete pathology 08-09 (N27), init-database mark-without-apply (N16 08-04 failed-read path; N63 09-05 fresh-DB bulk path — 37 migrations in 1 s), OVERWRITE unparseable migrations 030/068/074/080/085/099 (N16), island_concepts function shredded by `;` splitter (N15), SCHEMAFULL silent drop (N16, N63), QuerySemaphore (N43), success sampling 2c3f97a (N27), retention covers only `execution` (N43). Security: surreal root pw in argv (N43).

## memory-recall
- Only live teaching channel concept-db compose_lesson (N54) → itself starved by concept-db restarts + timeouts (N15); dense leg dead, BM25 zero (N15); memoryNote no runtime reader (N54); reach_gate_lessons unread (N54); counterfactual relevance never built, times_loaded doubles as prune predicate (N60); impulse_signature 86.4% of concept store undocumented, no decay/prune (N60); per-step how-to consult 4000ms < latency (N6); hub concept-db port unpublished (N38, N40); memory store split by WORKSPACE_ROOT (N29, MEMORY 09-22); unit test rewrote live memory store (N11).

## node-locality
- Hub vs spoke separate development-vessel instances, autonomous cutovers on hub, spoke organs don't observe (N55); traces all land on hub (N61); host-local policy file (N66); hub serves data plane not self-development plane (N72); hub ports unpublished (N38, N40); rhythm registry empty on spoke vs 52 on hub (N27); loopback advertisements undialable cross-node (N34, N53, N40); performance-status topology shells local docker (N38); host-side timers invisible to in-container doctor (N67, N74).

## federation-p2p
- Container recreate → stale keys → 401 cascade (N30); stale per-vessel key via .substrate-secrets EnvironmentFile order (N33); egress target truncated (N31); orphan relay squatting port, stale RELAY_MULTIADDR, loopback identity in bootstrap, relay.log derivation (N52); PEER_FANOUT_MODE env (N30); peer fan-out 401 swallowed (N4); google arm hand-placed on hub not codified (N40).

## env-gating
- SUBSTRATE_ALLOW_DIRECT_EDIT live 1 → 0 (N4) and unsettable by agent (N16); PEER_FANOUT_MODE (N30, N10 #8 law-1 violation needs design); COMPOSE_MAX_CONCURRENT kill switch (N75); EDIT_INTENT_COMPOSE_TIMEOUT_MS (N47); SURREAL_MAX_CONCURRENT_QUERIES (N43); config.ts froze WORKSPACE_ROOT at load (N11, 5dc8ab8); LLM_PINNED_PROVIDER (N10 #17); architecture-conformance gate flags env branches (N6, advisory only); EnvironmentFile ordering (N33).

## human-surface-escalation
- push_scope_refused on local bare remote parked 48 verified cutovers; github repo created, O(P+F) index hand-landed fb042e9; a test wrote 501 fake feedback records per run to LIVE journal (N3). Obsidian registry endpoint drift → 13 hollow assists (N40). goal-host no inbound auth (N26).

## test-residue-live-state
- Unit test rewrote live memory store (N11, 5dc8ab8); maintenance-lease test left live lease read by production fetchWithRetry (N42, fbbfd9b); human-surface test wrote 501 fake records per run to live journal (N3); probe leaked into deployed tree (N10); probe overwrote live template holder:"probe" (N27); pool/standing.json, gaps/gaps.json, state/learning-mode-state.json git-tracked and rewritten (N11, N63); mock.module killed 53 files (N61).

## dormant-mechanism
- 14 autonomy units dead by construction (N38); ~11 timers never enabled (N38); 90/102 validators dormant (N68); rhythm conductor selection-scheduled (N68); ribosome dormant 07-31 (N12); content-threading keystone inert (N6); gap_priority_ranking unconsumed (N9); goal_verification_labels consequence channel unread (N14); `decideContinuation` imported unused, findChains single-hop (N23); `goalContinuation` unbuilt; growth governor unbuilt (N60); anti-loop guard never fires (N58); reachedCommandCache (built, works); detector-based closure existed but pointed at wrong file (N29); host-container-source-drift-observer reused (N36); `dist:check` existed unused (N25); vessel-mitosis-cutover awaited-emit precedent unused (N73); operator-goal-generator dead by design (N54).

## docs-drift
- Architecture prescribes activities-as-tests and counterfactual relevance; implemented as shadows (N60). CLAUDE.md "timeless" rule vs operator memory. Documented bootstrap never run (N67). Cosmetic log strings lie ("super-repo rooted", "independently counted", "[fc-anchors] supplied verified-unique anchors") (N7, N55, N57). Stale concept-search "DEAD" corrected (N6).

## codebase-bloat-fossils
- Duplicate drift-gate test file discarded (N5); 4 minted substrateGap_write arms none can succeed (N55); minted copy of the floor shadows the floor (N69); 476 root junk files ff10d3a0 (N59); 7 poisoned artifacts in /workspace/proposals (N39); ~50 orphaned gaps.json tmp files ~300MB (N68); fossil /workspace/gaps/gaps.json (N29, N44); stray /workspace/git/super-repo/development-vessel/src tree (N71); funnel-history.jsonl contaminated (N9); boredom queue 369 rows no consumer (N41); dead tables activity_execution_traces, trace_digest, activity.thompson_* (N24); vestigial feature_compose @shape-dispatch:private annotation (N70); goal-host src/index.ts 3-line stub (N65); 14 uncommitted tracked files across 8 repos (N65); demo residue headers (N1, N31 — removed 04aa35e).

---

# MECHANISMS (keep / fossil assessment from this shard; "used now" = last evidence in shard)

| mechanism | location | general? | status (evidence) |
|---|---|---|---|
| feature_compose edit-intent route | goal-host index.ts EARLY EDIT-INTENT → dev-vessel feature-compose.ts | general seam | live-used; 12.5% FAVORABLE (N64), route-edit 18.4% |
| semantic cutover gate (LLM + deterministic floors) | feature-compose.ts SEMANTIC_CUTOVER_GATE | general | live-used; anti-correlated with effect on measured cases (N22); verified flag 2386b7d |
| detectZeroBehaviorDelta / detectEffectlessHeaderOnlyDiff / hollow-stub / edit-provenance | feature-compose.ts, edit-provenance.ts | general | live-used (de0a3b0, 33b7d9e, 1b5e7c9, 6060ab7) |
| surqlBreakingFieldRefusal | vessel-mitosis-evaluate.ts e8bc5ca | specific (.surql) | broken later by 54b7762 (MEMORY 09-22), then re-fixed |
| declarationDrift detector | schema-assert-drift-scan (8636190) | general for SurrealDB | live-used (prod-confirmed 09-05) |
| patch_with_tools escalation | dev-vessel patch-with-tools.ts | general | live-used; ungraded lane, no semantic judge, partial application (N68, N73) |
| mitosis cutover + pull-sync | vessel-mitosis-cutover.ts, substrate-pull-sync | general | live-used; restart storms (N74), in_flight deferral 379ef9f4 |
| change-series orchestrator (one step per rhythm tick) | 11ebf40 + 157e662, boredom host, poolImpulse store | general | built+demonstrated 225ab19; plans seeded, nothing authors plans (dormant beyond demo) |
| tryLexicalRebind Tier-2 + reachedCommandCache persistence | goal-host d38eaa9, 831dafb, b21388a | general (command-shaped goals) | live-used (N62 rebind fired 09-11) |
| pathway reuse (recommendReachingPath + pathwayReusePolicy) | goal-host / activity-api | general | live-used at 3/5 bar (N62); earlier no producer (N69) |
| in-chain consumption ledger + propagateCreditAlongChain | goal-host index.ts:3370; posterior-update.ts:553 | general | live (d737edb); retroactive drop on lookup miss filed |
| consumer_productivity_audit | dev-vessel | specific | exists; under-reports (limit=100) → removed from hot gate (duplicate/partial) |
| symbol/locator file resolution (resolvePathlessCodeChangeGoal, proposeSymbols) | goal-host goal-file-resolution | general | live; 3/6 file accurate |
| renderSafeAnchors + locateRegion + anchor index choice | cross-file-symbols.ts, feature-compose | general | live (dd7afb3, dcb4198, 2ff42fe, e637523) |
| restart attribution breadcrumbs | 644e7ee, 18a82bac | general | built (N74); use unknown after |
| autonomous_pick maintenanceLease | gap_to_feature (128f51f) | general | live-used for ledger windows (N3) |
| compose-slots cap (directed vs autonomous) | compose-slots.ts:214 | general | live; cap=0 inverted (N75) |
| QuerySemaphore | activity-api surreal.ts 5dd2606, concept-db c3e16a8 | general per client | live; identity-vessel + scripts bypass |
| trace retention + aux reap + success sampling | trace-retention.ts; 2c3f97a | general | live; covers subset of tables |
| init-database migration runner | activity-api scripts/init-database.ts | general | BROKEN class recurring (mark-without-apply 08-04, 09-05; ExecStartPre=- swallow) |
| gap_lifecycle_scan (expiry, failure-count disposition d5b8968, reopen>=3 needs_info) | dev-vessel gap-lifecycle-scan.ts | general | live; read fossil path until fixed; closes mostly by expiry |
| gap_to_feature closeLandedGap / land→close sweep | gap-to-feature.ts:1181; 10e10e9 | general | live; sweep ordering fixed 6583dd4 (09-28) |
| rhythm conductor + rhythm-cadence.service (bootstrap tier) | rhythm-conductor-tick.ts; 22146522 | general | coherent but inert (10/11 rhythms no staleness driver) |
| auto-promote (ribosome graduation) | boredom tick | general | fixed inverted threshold; promoted 3 (08-09) |
| ribosome mint / replay judge | ribosome | general | dormant 07-31; args amputated until 9518d4e |
| detector-coverage-scan / signature_cluster_scan | dev-vessel | general | dormant 9d (N68); failure-only source (N36) |
| host-container-source-drift-observer | dev-vessel | specific | reused for clone drift (N36) |
| boredom goal-generation (gap-goal:lesson / recipe candidates) | boredom goal-generation.ts | general | re-sourced d34d295; earlier net-negative |
| concept-db compose_lesson teaching channel | feature-compose.ts:1507/1554 | general | live-but-starved (N15) |
| goal-expectation-harness.ts / self-dev-reliability.mjs | validation/scripts | operator-side | operator instruments (not substrate activities) |
| validate-build reproducibility gate + doctor check 7 | 7481a497, c8ffbae5 | general | built |
| verify-dist-fresh.ts (dist:check) | ias-executor-ts | specific | existed, ignored; checks shared dir only |
| catastrophic_truncation guard / fs_write refusal | local-tools 0c50816 | general | live, did real work (N11, N16) |
| satisfier:fs_edit / code_replace_lines / auto-bridge-fileEditResult | walk satisfiers | general | hazardous — write live source without rollback (N3, N39) |
| architecture conformance advisory (law 1 env / inline LLM) | feature-compose detectArchitectureViolation fb9b1e1 | general | built, advisory only, behaviour never reproduced |
| selector drift gate (goal-host lint) | 8478bc6 | specific (route-as-data) | live gate; route-as-data 3 ClassRows (stalled) |
| operator-goal-generator, surgical-gap-scan, 14 autonomy units | inventory `autonomy` group | — | fossil/dead by construction (N38) |

---

# PRINCIPLES / LAWS stated in this shard (with source note)
- An oracle that generates the artifact it grades is not an oracle; "by construction" comment = the bug (N8).
- When generator and grader share a parse, state the assumptions, never assert independence (N7).
- Audit your own new gate adversarially; prove it fires when violated AND stays quiet when property holds (N7, N67).
- A guard that refuses valid work is only marginally better than one that admits corruption (N11, N39).
- A journal line naming a resolver/tool call is not evidence it did the write; diff artifacts (N11, N73).
- "I swept the fleet" is only as true as the paths swept; a halt is not a rollback (N11, N39).
- Verify the PRODUCER, not the column; a synthetic probe cannot catch a missing writer (N16).
- git-present ≠ applied; verify a new field with a live write / INFO FOR TABLE (N16, N63).
- `DEFINE FIELD IF NOT EXISTS` is not an ensure for a broken field; migration runner must surface per-statement errors (N16).
- Actionability (routes to a real producer) is a hard precondition for generating a goal (N17, N19).
- A wrong mint on the priority floor is maximally negative; don't floor a class until it demonstrates closing (N19).
- Verify a gap's premise before dispatching its fix; the semantic gate doesn't (N10).
- State decisive facts to an LLM judge positively, one claim per sentence (N22).
- Give the gate a measurement, not an argument (N22).
- Measure the specific claim, not something adjacent; exercise the path before theorising (N27).
- Before believing a null, compare ActiveEnterTimestamp to mirror time; query newest rows ordered, never trust a filtered count to prove absence (N27).
- A threshold that gates WHICH evidence is consulted can invert when loosened; test both directions (N28).
- When state moves behind an accessor, grep the literal prefix (N29).
- The binding constraint on task completion is the last mile (write binding) (N28).
- An impossible instruction produces confabulation (N34).
- A reach with no produced shapes is unfalsifiable (N34).
- A learning loop fed only by failures is blind to being wrong while green (N36).
- Advertised + 200 OK proves reachable, not selectable (N55).
- A fix that lives in a host file is verified only on the host you verified it on (N66).
- Correct producer with no consumer = archive (N66, N54 teaching law).
- An explicit key-by-key projection is a silent dropper by construction (N61).
- A test that reads the writer cannot detect that storage discards the write (N63).
- Naming the denominator turns a detector from noise to signal (254 → 2) (N63).
- Hazardous shape, zero blast radius for probes (N63).
- Every gate READS the diff, only a test RUNS it (N64).
- Pre-register the post-deploy observable in the falsifier; landed→deployed→inert is the dominant failure shape (N64).
- Lane is the discriminator: one file, one op route-edit goals (N64, N73).
- Log silence is not failure; name the positive that would refute (N65).
- A gap with no edit_site manufactures permanent not_achieved rows (N65).
- Separate null from zero; abstain on absence of evidence (N68).
- A check cannot be scheduled by the mechanism it exists to recover (CLAUDE.md, violated by rhythm conductor, N68).
- "Registry restored" ≠ "cadence restored": observable is enqueued > 0 (N68).
- When a comparison inverts expectation, verify both instruments (N69).
- Defects concentrate where nothing checks; the checked boundary holds (N70).
- A fail-open gate is worse than no gate; metadata is not a key (N71).
- Dead-plane discovery miss == "no producer" response; positive-control with a sibling shape (N72).
- Look for the repo's own prior solution to the class before designing one (N25, N73).
- Reading one branch of a function is not reading the function; optional chaining fails silently (N73).
- When you fix a bug class, grep the sibling call sites (N73 — violated again: 7 synth sites).
- Distinguish refused from never ran (load) (N73).
- A timeout names the caller's patience, not the callee's speed (N47).
- A mis-route has a delayed write path via gaps it files (N47).
- "Is this protected?" ≠ "is THIS one protected?" (N47).
- Two individually-correct gates can compose into refusal of good work (N57).
- When a gap names two conditions, assert both (N57).
- A plausible mechanism attached to a working fix is how a wrong causal story survives (N74).
- Stopping a timer doesn't stop a running service (N74).
- Testing a predicate is not testing its surrounding guards (N75).
- An architecture-prescribed structure implemented as its cheaper observational shadow loses exactly the specified property (N60).
- λ1 ≳ ρ_grow: capacity-adding work without throughput headroom moves toward livelock (SUBSTRATE_AS_DYNAMICS via N60).
- Read the prescription before diagnosing the deviation (N60).
- Autonomy hard criterion: substrate-authored commit on remote branch; verify in container clone not host (N65); "substrate-landed ≠ substrate-repaired ≠ substrate-verified" (N62).
- A self-edit of the grader must be bootstrap-landed, not dispatched through the broken grader (N1, N37).
- Don't compete with the productive autonomous loop via on-demand dispatch of the same fix (N50).
- Re-read the target immediately before any repair write; recovery looks like loss (N68); after a write with lost response, read state before retry (N42).
- Single-concern goals beat bundled (N68, N73).

# META-OBSERVATION for realignment
Across 75 notes (07-19 → 09-28) the recurring hats reduce to a few roots:
1. Write/read seam mismatch with silent failure (paths, keys, tables, ids, literal shape names) — at least 14 instances; the general detector (joint liveness / write-read agreement) has been filed 3+ times and never built; only `declarationDrift` exists for the schema slice.
2. Gates that read (diff, text, verdict strings, verdict of own producer) instead of running/measuring effect → hollow/inert landings and false closes; each new gate had its own hole found by running it.
3. Deploy topology: what runs ≠ what was edited (dist, /vessels vs clone vs host, hub vs spoke, image-baked glue, host timers), so "fixed" is repeatedly declared on the wrong artifact.
4. Throughput self-starvation: the compose host, verification suites, restarts and the recommit lane consume capacity; directed vs autonomous priority never resolved (kill switch inversion, busy lane timeouts, directed flag gaps continuing into 09-28).
5. Operator instruments are the dominant source of false claims (retractions in ≥9 notes) — the operator side is itself an unverified gate.
