# memory-9 — operator memory cache, files 601–675 (sorted)

Source: `/home/avi/.claude/projects/-home-avi-documents-work-substrate/memory/*.md | sort | sed -n '601,675p'`
(75 files, ~667KB; `reference-the-compose-pipeline-…-08-10` through `reference-the-reconcile-never-ran-…-08-09`).
All read in full. Notes are grouped by the problem-class keys. Each entry: date · what · evidence · outcome.

---

## PART A — notes from files 1–~30 (compose-pipeline … gap-store-is-lossy)

### write-read-mismatch
- **08-10 dispatcher discards federated compose verdict** — goal-host edit-intent reads `j.body.verdict`; libp2p proxy (`:8401` federation-transport) wraps under `content.body`. `??` chain lacked the actual wire format ⇒ `verdict=(none)`. Intermittent (depends which registry row sorts first: 8090 direct vs 8401 proxy). Fix `90a2533` (reader). Class root (local capability advertised only as libp2p row — law 11 inverted) left OPEN. Outcome: partial.
- **08-10 blocker ledger (9 blockers, "every one a mechanism that existed, was wired, and could not fire")**: pruned `file:` dep (hand repair); verdict discard `90a2533`; pwt escalation never ran — `gap.file_path` on 0/360 gaps (`2a8ebf5`); anti-loop guard blind to its own loop (`23e707d`); grounding never windowed, `region:null` (`11f10af`+`844f4e1`+`78ba658`+`3b73e39`); concept search `@@` is AND ⇒ 0 hits (`7df39d2`); lesson recall sent no query — same 8 rows for 132 composes (`6137257`); unbounded compose concurrency 45 worktrees (fork `6ad3721`/`68a26de`); capacity REFUSED not queued, goal-host retries only BUSY (`36dd9b7`).
- **08-10 #11 shortcut decisions never reached cache** — 6 deterministic shortcuts in `goal-target-inference.ts` returned before `decisionCache` declared; fix `f801ffa` routes all 7 exits through `remember()`. Scope corrected: 157/200 rows already had `last_inference_confidence` (my probe read nonexistent field `inference_confidence` → false "0 of 200").
- **09-09 composer discards verified-unique anchors at plan time** — `[fc-anchors] supplied verified-unique anchors (57 locator candidates)` but plan uses `return null;` (41 occurrences). "5th instance of mechanism built, producer never connected."
- **09-12 det gate / label corpus** — `goal_verification_labels` (table) vs `goal_verification_label` (singular read shape) hid the consumer `maybeConsumeOracleLabel` (goal-host index.ts ~15670). Human-labeler branch overrides `record.reached`; machine labels do nothing at runtime. Source-aware latch fix: human overrides 0→2 in 48h. 272/312 (87%) consumption attempts `no_labels`. Labels never move posteriors (by design). Residual: label corpus 100% `labeler:deterministic`.
- **09-22 failure side had no store** — successes persisted twice (reachedCommandCache, goal_execution_paths); failures only a class label with reason stripped. Fix goal-host `64ce0ac`, `9e23455`+`cf8fd87` (`/workspace/.goal-host-failure-memory.jsonl` keyed by goal_hash → `priorVerdictFeedback` attempt 1). A/B: recall ✓, defect not repeated ✓, count-trap still not reached ✗.
- **09-23 consumption edge** `69fe835` — synth trace input/output impulse ids populated (10/17 satisfier traces with output ids, was 0).
- **09-23 bindBody overwrite** — reach evidence computed from `directArgsRaw` before `bindBody`; store received LLM second-pass garbage. Chain under one gap: recommender `9c376b2` → order `579f365` → rebind `c37df24` → store type `dac3c2c` → bindBody guard; then explore-mode `249ff89` (20/20 reached first verdict).
- **09-24 posterior counters vs posterior** — `variant_performance_metrics` 120 ok/184 failed but α=119.7 β≈9; `applyOutcomeToPosteriors` (activity-api `lib/posterior-update.ts`): `ungraded ⇒ 0/0` — task-thrown failures never lower β. Filed `a-template-whose-tasks-throw-is-graded-as-ungraded…`.
- **09-24 SurQL multi-statement truncation** — `surrealDB.query()` returns result[0] = first statement; `LET…;RETURN` yields null → singleton fallback. Use `queryRaw`.
- **09-24 two notions of "family"** — `activity.variant_of` vs `getVariantFamily`; `/v2/activities/:id/variants` returns synthesised base only.
- **09-05 gap write shapes** — flat `{impulse:{type,gap}}` silently ignores reopen; nested pointer form honours it (08-11 note).
- **09-23 gap store carries forward omitted keys** — merge loop `if (!(k in inMeta)) inMeta[k]=exMeta[k]`; must write `null` to delete `regressed_by` etc. (contrast 09-05: summary REPLACED ⇒ destroyed fields; both behaviours coexist: summary replaced, metadata merged.)
- **09-06 donor index empty** — `endpoint_output_shapes` `[]` defeats fallback guarded on `undefined` (`goal-paths.ts:430`); 8,314/9,853 pathways (84.4%) blind; Tier-2 rebinding selected 0× vs 1,404 refusals. One-shot `db_admin` repair 1,644 rows → donors 1,539→3,186. Obvious "declared shapes" rule refuted by control (33% superset). Effect on Tier-2 NOT adjudicated.
- **08-07 drafter could not see the code** — `PER_FILE_SLICE` 6000 of 175,878-byte file, region at byte 59,125. `690239b` (focus hint) did nothing (longest-first re-sort); `46d4113` primary probe = actual fix. Dead diagnostic probes false for 6 weeks.
- **08-07 UI gap was upstream data gap** — `DispatchRecord` has no end timestamp; three drafter "hallucinations" (`finished_at`, `endedAt`) were correct inference about missing data.

### node-locality
- **08-11 dispatches go to hub** — `~/.metabob/config.json` → `syzygy.host:18100`; `feature_compose` has ONE producer fleet-wide (`development-vessel-local@spoke-cfda39e7`) with 2 slots, contended by hub+local+operator. Refusal wording (`REFUSING DIRECTED` vs `autonomous`) = the only instrument for hub checkout.
- **08-09 drain lane** — discovery routes gap_to_feature to HUB (different 44-gap store); cockpit dispatches execute on hub.
- **08-10 gap queue** — gap store lives on dev-vessel 8090, not hub trace store; "blocked on hub" misfiled (4th misfiled blocker).
- **08-11/08-10 probe namespace** — port 8220/8401 not mapped to host; host probes meaningless. "Test a call path in the namespace that makes the call."
- **09-14 push asymmetry** — operator host pushes worked while container credential dead ⇒ outage invisible.

### test-residue-live-state
- **09-05** `test/resolvers/substrate-gap.test.ts:20` sets `SUBSTRATE_GAP_SKIP_COMPOSE_TRIGGER=1` at module scope and writes fixture rows (`gap-001`, `post-mutation-probe`, `heal-probe`, `flat-*-probe`) into LIVE `gaps.json`; also why tests could never observe the inverted gate.
- **08-09** development-vessel carries 79 pre-existing test failures ⇒ read test verdicts as DELTA.
- **09-24** verify rejected correct 5-edit patch on 3 tests failing on CLEAN clone; baseline output not persisted — unresolved.
- **09-13 (file later)** state-dependent mitosis test blamed on every draft (see Part B).

### memory-recall
- **08-10** lesson recall sent no query — same 8 rows, 132 consecutive composes (`6137257`). Concept search AND semantics (`7df39d2`).
- **09-09** lessons-since-T non-monotonic (`lessons.length > 8` shift).
- **09-22** failure memory (above).

### calibration-seal / selection-learning
- **08-11 credit outage taught Thompson capable models are bad** — `recordArmOutcome` reach-only; credit errors incremented β (sonnet α1/β10.2, haiku α1.9/β40). `isFailoverError` exists for routing, not consulted for learning. Correction: 10 samples → deepseek 84%; one draw ≠ distribution. Repair (skip β on provider failure) NOT made; filed.
- **09-06 emission auditor over-selected ~20:1** by boredom (292 runs vs 5–17) — arm with no differentiating signal pulls 20× traffic.
- **09-04 four-link chain** — `vessel_mitosis_cutover` α 31.75→32.50, β 11.25→11.50, n 134→135: one execution's credit moved exactly 1.0 (y=0.75). n=1, one path; pwt path (~19% of landings) excluded by `91871f0` (requires FAVORABLE compose report) — regression audible via `28e2e6c`.
- **09-12** controlled test: success moves α (+1.303 thompson_alpha); `v_shape_conditioned_score` view reads EMPTY.
- **09-24** posterior never falls on task-thrown failures (`ungraded`), so variants never drawn.
- **09-05 goal-hash fragmentation** — `normalizeGoal` bracket strip; `3a92282` and `b9fc69d` INERT (doubled/stripped backslashes, all gates green); `e340ad3` correct: 6 POSTs → 1 row, α7/β1.

### narrowing-duplicates
- **09-14 gapClassKey doesn't strip 8-hex** — 542 route-edit open rows = 542 classes; cap never binds. Substrate landed `8cdb1a4→7f0780e→14def70` (8-hex strip), classes 1,830→994, families ≥cap 2→20. Refuters wrong 2/2 (gate overrode). Correction: lane affixes (`recommit-`, `-narrowed`, `-semantic_reject`…) are a second discriminator; robust fix = cap by LINEAGE ROOT (`parent_gap_id`/`source_gap_id` present on 600/601 children; 160 over-cap families vs 29). Copy-on-mint: children snapshot parent summary and never inherit corrections; stale child re-implemented landed fix `38e72ae` ⇒ duplicate symbols (TS2300). Resync mid-compose gets clobbered.
- **09-14** 391 open recommit gaps predate credential outage.
- **08-10** derived gaps 21% of store, close at 4% vs 30%.
- **09-23** write churn: ~34 writes on one row/15 min — `gap_to_feature` non-attempt write re-triggers pickup (444 gap-event publishes/5 min). Fixed by substrate `799bd58` (270/h→1/h).
- **09-23** no per-gap in-flight guard: 3 composes admitted for one gap in 2 min → fixed `c8cfc38`+`01d085d` (`BUSY stage gap_in_flight`).

### hollow-landing
- **09-09 composer self-degradation** — 46 autonomous commits to `feature-compose.ts` 09-02..08; anchor-failure 3.3%→34.4%. `f0cfb91` inverted boolean (`!r.ok`→`r.ok`) disabled anchor repair 2 days; fix `bac7d00` (31/184=16.8% vs 93/270, p<1e-6). "post-land suite ran=false": no gate executes the result.
- **09-05 escalation lane disabled gap store** — `b705e54` (09-03, env gate introduced as CLOSURE of an env-gating gap) → `915ce8a` (`false &&`) → `94b1efd` (inverted `!==undefined`→`!`): every `substrateGap_write` returned success with `action:"skipped"`. Outage 21:05:53→23:10:52; fixed `04035e3` (deleted block, graded lane FAVORABLE). Compose had refused twice (UNFAVORABLE, refuters right); patch_with_tools landed it verified only by typecheck.
- **09-05 two FAVORABLE INERT regexes** `3a92282`, `b9fc69d`.
- **08-11 rename-only diff** `05aeaa3` passes every gate and stamped closing its gap.
- **08-11 `bff3347`** harmful landing (vacuous Guard 2 fails open on stale tree) reverted; my amended revert message broke revert detector ⇒ `route-edit-e691e25e:3` closed `landed_verified` on a change not in the tree.
- **08-07** `8a25744` comment-only no-op passed containment; fix `ffd1259`. `985b8d3` hollow interface-only change (did not close gap; reverted `62b2f22`). `1bfcec7` correct shape but inert (no end-time field).
- **09-10** coverage check clone-root change landed as regression (bare dir scan never set `covered`), restored by hand → `c349b27`.
- **09-24** deployment-layer hollow: `src/seed/*.ts` edits inert ("Catalogue already populated — skipping seed"); remedy `{goal}` went hollow.
- **09-23** `3d2e52a` verified+pushed+never ran (pwt blind snapshot restore overwrote runtime).
- **09-24** `49b884e` unprompted landing inert (logging `mode: undefined`).

### false-verification
- **08-08 cache-read satisfier** — `shape_gap_resolution` returns `success:true, total:0`; walk REACHED in 1 step, oracle labelled achieved ×2; `reach-patch MATCHED NO ROW … verdict NOT persisted` (goal-path writes dropped 68%). Probe `457c7a6` after 3 wrong source diagnoses (`7deef44` withdrawn `95126ff`).
- **08-11 first reached:yes was hollow** — `universal-tool-fallback` served "widen this check" with a `template_audit_report`; landing requirement (`deterministic:edit-intent-no-landed-edit`) is attached to ROUTE, not GOAL.
- **08-11 retraction auto-closed a gap** — summary opening "RETRACTED AND REPLACED" read as resolved; stale `edit_site` metadata re-injected into dispatch.
- **08-12 criterion "met" retracted** — `6876bff` correct, but goal named file & escalated after 4 reach-patch losses; 34 substrate commits/7 days: 4 from pathless goals, 2 reverted, survivors defective ⇒ zero correct first-try.
- **09-14 mitosis cutover graded reached:true unconditionally** (`vessel-mitosis-cutover.ts:503`) while push failed; fix `1fad6ec` gates on `push_status==="pushed"`.
- **09-09** six operator metrics measured wrong thing (REFUSED ratio numerator/denominator mismatch; `repaired:true` unobservable; lessons eviction; adjacent-baseline p=0.004 artefact).
- **08-05 deterministic floor** — oracle returns null outside 4 families and hard-codes `reached=false`. "Null verdict → success" REJECTED twice as metric gaming.
- **08-09 gap-goal lane** — 101 dispatches, 62.4% reached, 14/17 gaps with a reached gap-goal still open; no path reach→closure; the reaches were wallpaper.
- **09-10 fleet credentials dead 48h** — reach 10–18% VOID (0-step terminations 100%).
- **09-10 coverage rung 3** all-time averaging cannot observe its repair (~23h latency; filed `rung-three-averages-all-time…`).
- **08-10** failure record truncated mid-word, class `typecheck_dangling_reference` while `TC_EXIT=0`.
- **09-24** refuter false rejection (two draws of one prompt at conf 1.00 on a regex fact); false reason fed into next draft. Fix: counter-fact in spec → `326a983`, `212408a`, `0874216`.

### drafter-quality
- **09-09 drafter paraphrases anchors** (drops type annotation, from-clause, wrong indent); explicit prompt prohibition (`12c4c58`) echoed anyway ⇒ lever must be mechanical. Dominant failure = ambiguous anchors (`return null;` 41×).
- **08-11** deepseek patch failed on cross-file symbol (`isFailoverError` takes arg, lives in index.ts) ⇒ "cross-file symbol grounding".
- **08-12** first fair pathless try: drafter found comment 8 lines above defect and emitted `action=fail`; retry identical query.
- **08-09** try 1 invented `_readHonestyPolicy` 3 lines from `_honestyPolicy`; try 2 given wrong file context (semantic gate refused correctly); goal unsatisfiable (`bodyHonestyPolicy` served by 0/417).
- **08-10** drain bounded by drafting: summary-with-exact-diff 3/3 closed (13m, 6m, 15.5m: `04775a7`, `48eeff8`, `4b1a8a7`), symptom summaries 0/≥5.
- **09-04** goal-design rules: ONE op + short unique verbatim anchor + no helper name; 2-op goals relocated and invented imports; same-shaped identifiers invite substitution.
- **09-23/24** drafter broke same constraint 3× ⇒ exact old/new in spec via direct lane. Byte-exact edit + pre-empted refuter objection + dry-run probe pair = ~20 min closure protocol.
- **08-11 localisation**: goal localises iff it names a symbol verbatim; `src/seed/*.ts` string literals are attractors; 5/8 natural phrasings declined at admission (`isPathlessCodeChangeGoal` CODE_TARGET allow-list) — law 13 measured. `--predict` harness (`validation/scripts/stage-harness.ts`).

### gap-content
- **09-10** population split: operator one-file/one-op edits 3/3; operator read-only 5/7; substrate's own goals 4/26 (15%) ⇒ goal formulation is the bottleneck.
- **08-10** summary-with-patch tests plumbing, symptom summary tests capability.
- **08-11** gap first sentence must state the defect.
- **09-14** class1 predicate `expected_literal:"(?![0-9a-z])"` chosen absent-today; parent predicate held gap open against partial landing.
- **08-10** editing a gap is a dispatch (human_reported 1.5× + compose nudge).

### dormant-mechanism
- **09-06 conservation auditors** — `GET /v2/activities/conservation-audit?invariant=` (`ad41776`), 6 templates `conservation-audit-*-junction` (category `meta`, tag `boredomtargettemplate`); boredom self-selected: 316 runs, >37,000 findings; **findings→gaps bridge does not exist** (filed `the-conservation-auditors-detect-but-nothing-bridges-findings-to-gaps`). Negative controls: 86 posterior, 129 emission (auto-bridge-* family invisible fleet).
- **08-09 remedy_effectiveness_observer** correct, registered, nothing selects it (36 dispatches of reconcile, metric never moved).
- **08-09** `gap-compose-tick.ts` never runs (drop-in `watchdog.conf` resets ExecStart to `watchdog-tick.ts` on 4 units: gap-compose, operator-goal-generator, compose-teacher, funnel-drain).
- **08-09** gap lifecycle scan clustering/prioritisation/consumption queue already built, starved by one hardcoded path; `human_input` resolver invoked by 0 activities; `gap-lifecycle-tick` not selected standalone in 24h.
- **08-09 fire-check**: `e2c9a55` donor portability 0 firings/8,780 walks; `8592973` recipe recovery 1 firing, 0 recoveries.
- **08-10** `acquireComposeSlot` directed reservation already existed (`effectiveCap = directed ? cap : max(1,cap-1)`) — nearly duplicated.
- **09-12** `v_shape_conditioned_score` view reads empty.
- **09-14** runtime-drift-tick detect-only caught credential outage footprint; repair env-gated `RUNTIME_DRIFT_REPAIR=1`.

### spend-envelope-throughput
- **08-10** capacity: dispatch waits 45s, retries once, defers to gap lane; quiescing timer insufficient (drain observer nudges in-process).
- **08-11** 10 operator dispatches: 5 BUSY, 3 draining-503, 1 federated timeout, 1 producer vanished, 1 harmful landing. 503+Retry-After never read by goal-host (retry only in catch on thrown message).
- **09-24** restart budgets < compose: 16 dev-vessel restarts/3h, 240s drain vs 5–15 min composes; pull-sync owed restart keyed on busy-poll COUNT not oldest in-flight age. `long-running.ts` counted only `pointer.type` → fixed `404a89c`, `bf74cc5` (unprompted).
- **09-24** change_window lease held 5 of every 10 min by trace-store reconcile (http_fetch 15s default vs 376s prune) → 3 verified landings refused. `a8f457a` fixed wrong caller.
- **08-09 drain lane suppressed by shared liveness file** (`compose-lessons.jsonl` mtime).

### sync-deploy-drift
- **09-10 coverage check reads 25-day-old submodule tree** — `REPO_ROOT` unset; `/workspace/git/super-repo/repos/<v>` stale (7/14 vessels 4–25d); pull-sync never runs `git submodule update`; known since 08-05 (`authoritative-root.test.ts`: 9/18 drifted). Fix `c349b27` (clone root + two-segment needle + cap 2000); covered 0.36→0.93.
- **08-09 deploy path** — `mirror-to-live` deploys from `/workspace/git/vessels/<v>`, reports shipped SHA but never told wanted SHA.
- **08-11** landed sha ≠ live code; check `ActiveEnterTimestamp`. 296-behind wedged super-repo submodule clone graded 3 consumers (fc-coverage, fc-vacuous Guard 2 fail-open, reach oracle). Root cause: compose overwrote `scripts/substrate/deploy-hub-pull.sh` in clone with hallucinated stub ⇒ ff-only pull failed. 23 uncommitted unique files nearly destroyed.
- **09-14 container push credential** — `${SUBSTRATE_GIT_PAT:-$GITHUB_TOKEN}` dead PAT shadowed valid token; 5 commits destroyed by pull-sync reset (`6e22a68 94fa175 91343a6 a340697 9047c3e`); substrate re-landed both fixes (`840fc43`, `ad38ca4`) after token fix. `docker restart` would re-break (gen-env.sh:298 precedence).
- **09-23** pwt restores pre-run snapshot blindly over concurrent landing (`3d2e52a` never ran).
- **09-09** gap store lost ~4,200 gaps (4,113→44) around dev-vessel restart 22:30; orphaned `.tmp` files recoverable; 4 stale `gaps.json` copies; live = `/workspace/git/super-repo/gaps/gaps.json`.
- **08-09** hardcoded `/workspace/gaps/gaps.json` in gap-lifecycle-scan (`b1c3e68`), pick-priority-scenario (`267900a`), boredom priority map (`02b0d24`), funnel history (`48eeff8`); legacy pool 15.7MB frozen vs live 221KB.
- **08-09** poisoned baseline: live `/vessels/.../index.ts` 854,899B vs clone 854,302B.
- **09-24** `substrate-live` recreated overnight (container /tmp lost).

### endpoint-routing
- **08-10** local capability advertised only as libp2p peer row; MCP `goal_status` resolves to `syzygy.host:18401` and times out.
- **08-09 trace drain ladder**: REST route missing; hardcoded `127.0.0.1:8080`; lease token header vs body; explicit headers suppressed auto API key; validator read unwritten lease file; unbound `{{placeholder}}` → hostless URL.
- **09-10 operator/vessel keys** (see memory-other); `/etc/substrate/env` METABOB_API_KEY invalid for activity-api (09-24); goal-host reads `API_KEY` which nothing sets.
- **09-22** discovery `/resolve` 401 → empty body without ApiKey (false alarm).

### autonomous-regression
- 09-09 `f0cfb91`; 09-05 `b705e54`/`915ce8a`/`94b1efd`; 08-11 `bff3347`; 09-10 coverage regression; 08-11 compose overwrote `deploy-hub-pull.sh` stub in clone; 09-23 pwt snapshot restore.

### directed-overshoot
- **08-11** my amended revert message broke revert detector.
- **08-11** my comment literal reintroduced phantom self-match in `goal-file-resolution.ts` (0→1 files).
- **08-11** my 503 draining signal shipped without teaching its reader.
- **09-04** `91871f0` excluded pwt landings (~19%).
- **09-10** my coverage cap 200 < 251 test files.
- **08-09** my goal text "apply same correction to proposalsDir" would have broken it.
- **09-14** heredoc stole stdin, wrote script line into PAT (restored from .bak).

### goal-walk-floor
- **08-05 deterministic floor 2.0%** (28/1,414 goals); 439/471 repos/ goals name a file, builders reject `\.\w{1,6}$`; `runGroundedToolLoop` returns null without `llm_completion_dispatch` ⇒ ReAct floor IS the LLM.
- **09-10** empty vocabulary (401) ⇒ 0-step termination 100%.
- **08-11** admission gate `isPathlessCodeChangeGoal`; `how many` trips NOT_A_CHANGE.

### human-surface-escalation
- **08-09** `human_input` resolver invoked by 0 activities (`orphaned-capability-human_input`).
- **09-12** human reach override branch structurally unreachable (latch burned by machine rows) → fixed, 2 in 48h.

### federation-p2p
- **08-10** proxy envelope; **08-07** hub failover exists, `llmCallWithFailover` tried each endpoint once → `c8a1383` (3 rounds, 5xx only). "Credit-dead" blocker escalation retracted.

### trace-store-db
- **08-09 retention valve ORDER BY times out** (`trace-retention.ts:510`) on 302,376 rows vs ceiling 150,000 — 0 rows deleted ever; same file records refutation 60 lines below. `execution-traces?activity_template_id=` filter returns 0 for executed templates.
- **09-04** `ORDER BY` field not in SELECT → 400 Missing order idiom (watcher never fired).
- **09-06** `array::len(x ?? []) = 0` not `= []`; `path_signature` not unique (513 rows).
- **09-23** SurrealDB 2.3.3 non-unique array index rejects duplicate elements (fix `d6205d5` dedupe); `option<string>` rejects NULL (`state_signature ?? null`, 202/day); `execution_trace_content` dup-insert ~2/s unfiled.
- **09-24** trace store at cap refills between ticks; prune 25 rows/batch.

### env-gating
- **09-05** `SUBSTRATE_GAP_SKIP_COMPOSE_TRIGGER` hijacked for total-write gate — goal itself encoded law-1 violation.
- **09-23** `cutover-lease-wait.conf` `CUTOVER_LEASE_WAIT_MS` drop-in; `RUNTIME_DRIFT_REPAIR=1`; `SATISFIER_REUSE_ORDERING_ENABLED=false` (A/B-backed deliberate).
- **08-12** `COMPOSE_MAX_CONCURRENT=0` fallback bug (`6876bff`).

### docs-drift
- **08-09** `autoClose` comment says default false, code `p.autoClose !== false` ⇒ true (`04775a7` fixed).
- **08-09** `IMPULSE_ACTIVITY_FOUNDATION.md:863` defines reachable as *advertised* not *demonstrated*; `coverage-tick.ts:138` inherits.
- **08-09** trace-retention comment claims index-backed ORDER BY.

### codebase-bloat-fossils
- 4+ stale `gaps.json` copies; legacy 15.7MB pool; `gap-compose-tick.ts` never run; dead diagnostic probes; `.claude/worktrees` + `.wt-*` clutter (38→58 files); `false &&` dead branch in substrate-gap.ts; `src/seed/*.ts` inert after first seed.


---

## PART B — files ~30–52 (gap-store-lossy … llm-plane-alive)

### hollow-landing / false-verification (continued)
- **09-05 gap store lossy + gates can't see inert** — `substrateGap_write` REPLACES the row (summary destroyed on closure: 8 zero-length summaries among 1,358 closed, 0 among open). Detector re-emit reverts verified closure (`rhythm-cadence-registry_empty`) and erases remedy while live conductor showed condition false. Autonomy lift gate reads 28-day-old fossil `/workspace/substrate-heartbeat.json` (`autonomy-metrics.ts:77`) while writer writes `WORKSPACE_ROOT/…`; live heartbeat itself `overall_passing:null`. Both gate dimensions pass as system does LESS (confidence ratio, stability burst). "Nothing executes a landed change": `3a92282`, `b9fc69d`, `b24df4e` (GUARD_RE `\?\?` unreachable because line 87 drops `??` lines) then substrate extended dead code `5cd4e72`. Operator scorecard wrong 5 / right 10 — all 5 one class: reading resting/staged state as terminal. Direct resolver invocation entirely untraced (7 stores checked). `learning_signal_health_observer` "healthy" on frozen substrate. `env_gate_scan` GUARD_RE misses numeric env reads (missed `COMPOSE_DRAIN_MIN_INTERVAL_MS`, 40,194 skips). Walk `fs_edit` builds `/workspace/repos/...` outside root — 64 occurrences. Verbatim retry coalesces (same executionId).
- **09-05 the gate rewarded the broken commit and failed the fix** — `31b71508` (doubled `if (verdict) if (verdict)`, old call left) graded reached:TRUE; `55315cb` (correct) graded reached:FALSE dα0/dβ0. Underlying defect: floor tier wrote labels `universal-tool-fallback:${hash}` (colon) vs read `…-${hash}-${Date.now()}` (hyphen): 396 rows write-form, 1 read-form (human); 13 ids with contradictory verdicts. Sibling-call-site miss one line from the `index.ts:4856` repair. Fixed, hyphen 1→2, colon frozen 398. Instrument traps: `/dispatch/<id>` not a route (404 identical to missing record); goal-host logs no dispatch ids; singular table name → 0; `GROUP BY … ORDER BY count()` lied. Two operator retractions (fabricated "dispatch lost to draining" gap → status:rejected; `remedy` not returned by read projection).
- **09-05 inert-literal gate `9c4e242`** — `inertRegexEditRefusal` in deterministic refusal chain; production probe 08:03 refused `|lifecycle` and the subtler retry `|lifecycle-template` (unanchored ⇒ inert). "Recommit loop has a gradient toward emptiness." 14 composes, 2 refusals both correct — "no false positives observed" (underpowered). Scope: regex literals only. Outcome: worked (narrow).
- **08-09 goal vocabulary still a regex, reach fabricated** — try 2 reached:true via `universal_tool_fallback` with `goalReachReason` naming two files never edited; no commit. REUSE-BEFORE-DERIVE routed an edit goal to the floor that cannot land. Fix `50d2e69` (vocab), `fea9eab` (adjacent content-word pair extraction; include *.sh/Makefile/*.service). Deploy recipe `docker cp src/index.ts` only on 6 vessels (goal-host, development, local-tools, llm-resolver, light-dispatch, boredom, ribosome) — any non-index change deployed NOTHING, reported success (`50f10bb9` fixed → `docker cp <src>/.`). Search root `/workspace/git/vessels` cannot see super-repo tooling.
- **08-17 ladder ran; verdicts had nowhere to go** — rung 1 honest miss, rung 2 `verdictNull=TRUE` (absence wearing a verdict). `reach-patch LOST after 4 attempts`, `goal-path record FAILED`, `oracle-label … write failed (non-fatal)` ⇒ "self-development with ZERO retention". "Non-fatal on a learning write is fatal to learning." Recall SUCCEEDED only logged when i>0 (`060d2d0` logs every outcome). tsc passed a TDZ ReferenceError (`_blendK`). surrealdb `MemoryMax=26G` above 23.7G headroom; capping only the biggest process elects it victim.
- **09-11 ladder 7/7 and learning loop still open** — `execution_exemplar` 0→719 rows; only reader `GET /v2/activities/execution-traces/exemplars` hit 158×/24h, all by self-test `activity:test-learning-routing-<ts>` ⇒ "No execution has ever been informed by a prior one." 11 substrate commits. SurQL: composite index partial constraint → ZERO rows; `field = X AND executed_at >= type::datetime($p)` silently drops equality → ALL rows (tenant isolation failure; service connects as root). Authoring-lane reach 8.6%/24h; 199/600 open gaps (33%) name no file; 2.8% cite a vanished anchor (auto-retired by phantom-anchor detector, 15/pass).
- **09-04 landability self-model trained on 0-for-1030 oracle** — `/workspace/expectation-calibration.json` 7,014 lands vs store ~39 landed_verified (180× disagreement); `close-oracle-calibration.json` `landed_commit {closes:0,false_closes:1030}`, `measured {17,0}`. `hopeless()` (attempts≥8 && lands==0) seals 13 categories/481 attempts — concentrated on self-repair categories (`learning_loop`, `verification_integrity`, `detector_coverage_gap`, `reach_grounding_gap`, `orphaned_capability` 347). At ~3% base rate false-seal ≈78–92%. Taxonomy fragmentation (`self_development`/`self-development`, `env_gate`/`env-gated`/`environment-gating`; 40/70 categories ≤3 attempts). Root cause of "1%": `joinDecisionOutcome` (`gap-to-feature.ts:2664`) drops landings on cutover sweep (37/44 invisible); true ≈2.7%. `highConfMiss` poisoned. `isNonAttemptComposeResult` fix (08-29) worked: sub-2s share 54.7%→24.5%. Filed `landability-self-model-is-trained-on-an-oracle-graded-0-of-1030` (P1). → **calibration-seal** key.
- **08-19 learning loop validated by intervention** — α +0.744/+0.750 per graded success (reproduced twice) but reported `dAlpha:2,dBeta:0` and stored β ROSE on success — transform unidentified. `index.ts:5196` returns `dBeta: 2` unconditionally even when `beta-penalty REJECTED (404)` (gap-mt0kcoyt) ⇒ condemned pathways keep posterior. 58/60 executed arms moved off Beta(1,1). → selection-learning.
- **08-05 LLM-free edit path never fired** — `synthesizeVerbatimEditOps` requires exactly 2 fences; goal-host `verbatimExcerptBlock` adds a 3rd ⇒ 0 occurrences in whole journal; all "deterministic path" attributions were wrong. EARLY EDIT-INTENT `AbortSignal.timeout(240_000)` vs 5–8 min compose (3 sites). Truncated completion `{resolved:true, content:"", stop_reason:"max_tokens"}` credits α to starving arm; goal-host llm-router debits the vessel. Token budgets must be fixed at resolver not call sites. → dormant-mechanism / selection-learning.
- **08-10 LLM plane alive; blocker is reach grading** — "How many TS files in validation?" reached:true with stdout 12 (truth 74) and stderr `find: '/workspace/git/super-repo/the'`: lexical REBIND interpolated English into a verified command.

### sync-deploy-drift (continued)
- **08-10 golden-drift tree stale not corrupt** — three trees / three consumers: `/vessels/<v>` (runs), `/workspace/git/vessels/<v>` (search + patch baseline), `/workspace/git/super-repo/repos/<v>` (golden-drift overlay, `vessel-mitosis-evaluate.ts:455 DEFAULT_CLONE_REPO_ROOT`). Super-repo clone on local-only `ff10d3a0`, 32 behind; pull-sync correctly refuses; nothing connects "frozen clone" to "gate grades old code". Durable fix: gates refuse diverged trees (like pwt POISONED BASELINE).
- **08-08 hub not restartable** — `API_KEY_SECRET` only in process env; `gen-env.sh:529` overwrite-heredoc dropped it (and would drop `FEDERATION_SIGNING_SECRET`/`FEDERATION_PEER_AUTH_MODE`). Merge-then-write `9f8f945e`; but gen-env runs from image `/usr/local/bin/gen-env` — bootstrap tier requires IMAGE REBUILD. `ENABLED_EXTRA_VESSELS` never worked on hub (image apply-inventory lacked it); compute vessels unmasked BY HAND = unreproducible hand-state. Fix shipped as pair + `deploy-hub.sh` roster `d9f93442`. Restart rehearsal passed; recreate-safety unproven. `goal-host-vessel/package.json` held post-sed `file:/vessels/ias-executor-ts` blocking builds. Hub published ports drifted from both deploy docs; without 18260 spoke drafter reads no lessons, goal-generator mints nothing silently.
- **08-10 hub migrated** to 640GB droplet (104.236.0.175); byte-verified volumes. SurrealDB timeouts were an uncapped compose storm (30 composes, load 54 on 8 vCPU, 0 iowait) — local-tools executes, dev-vessel dispatches, boredom's MAX_CONCURRENT masked on hub. Masking dev-vessel load 45.6→1.78. Migration fails only under load reads like corruption. `2>/dev/null` on sending tar hid partial transfer (84/135 blobs).
- **08-09 investigation tools search the wrong tree** — local-tools WorkingDirectory `/vessels/local-tools-vessel` has no vessel source ⇒ confabulated paths (`.py`, `find` command in path slot); `groundedOk=13` reads of wrong tree. `run_goal_async` dedups by goal text.

### endpoint-routing (continued)
- **08-11 hub goal-host works; route does not** — discovery registers goal-host as `127.0.0.1:8210`; client rewrites loopback host → `:18401` federation egress (unpublished) → timeout. Client-side timeout ≠ work not started (duplicate dispatches).
- **08-08 growth loop recall severed** — pinned `CONCEPT_DB_ENDPOINT=127.0.0.1:8260` against masked vessel: 1,909/1,909 failures in 24h fail-open. Shape collision: `concept` advertised by concept-db (search) and development-vessel (pattern summary). Federated envelope divergence `{content:{shape,produced_by,body}}` vs `{content:[...]}`. `53d9080` routed via discovery + shortened query (0/4→2/4).
- **08-10 hub serves unauthenticated data to internet** (security): goal-host no inbound auth (incl. `POST /run-goal`); concept-db `REQUIRE_AUTH` default false, anonymous bound to `default` org, anonymous GET writes; activity-api auth only on `/v2/*` (`/boredom-tasks` POST unauthenticated write); dev-vessel no auth. discovery-vessel correct (`app.use("*", authMiddleware)`). Container uid 0; 25/30 environs carry push tokens. Relay: `RELAY` module-level let never re-fetched; transport `/health` 200 unconditionally ⇒ no watchdog can recover a relay move; `/bootstrap` lists dead droplet first; one relay private key on two hosts (old droplet); Obsidian sidecar re-registers stale address. ~2500× query plan defect: any predicate on indexed field collapses ordered walk (2.2ms → 5–7s); two resolvers' AbortSignal below latency can never succeed. Trace store 330,115/150,000. identity-vessel never registered; hub dev-vessel TTL-expired while executing; `llm-resolver-google` 477 registrations 0 deregistrations; runtime-rendered `llm-*.service` unmaskable; `gen-env` `${VAR:-}` restores blanked keys. Image skew 17 days under same tag. ~346GB vLLM images for dark plane. → federation-p2p, env-gating, trace-store-db.
- **08-10/11 hub trace store "down" retracted** — `000` was client timeout on unwindowed query; masked-by-role/`DISABLED_VESSELS` ports read identical to crashed.

### trace-store-db (continued)
- `CONTAINS` on string ≠ substring; datetime filters need typed literals (string compare returns UNFILTERED count); `/v2/activities/executions` `total` = limit; `GET /vessels/:id` doesn't project `libp2p_multiaddr`.
- 040-fts-recommendation.surql migration builds full-text index over trace store (slow boot).

### human-surface-escalation
- **09-06 interactable horizon** — `interactor-log/` 384 records but only ~33 from `stateful-ui-vessel`; ~351 are substrate traffic dumped on the human complaint shape (`uiFeedback_write`); 26/33 real ones are dismissals; 0 ui gaps. Walk invents file paths from gap ids (21 rejections/6h across 2 resolvers). `human-surface-vessel/src/store.ts` "No persistence — restart clears every store". Retracted "384 human signals" (`7ff48943`). Near miss: attributing interleaved `[fc-plan]` lines by elapsed time (no composeId on line).
- **08-10** substrate-ui authorized, deliberate, 0 goals/0 commits, holds push credential.

### selection-learning (continued)
- **08-08 growth loop** — reuse accepted 1,116× exact goal_hash + ~300× shape signature; reach→mint 269×; 454 `learned-*` templates; 53 learned-of-learned nesting to 7 deep; learned population α570/β1,436, 44% never executed. `pathwayReusePolicy`, `bodyHonestyPolicy` no producer (1,739/1,739 fallbacks) ⇒ reuse bar permanently minSuccessful=1. Reuse by mode: exact 79.8% (n=252), none 71.1% (n=613), rebind 65.0% (n=103). "Reuses perfectly on repeats, never on near-misses ⇒ look at retrieval key." Oracle claim-scope bug: `/\b(registry|discovery)\b/` matched inside paths, digits inside UUIDs read as counts (97 verdicts/24h) — `9e0492c`, same goal_hash HOLLOW+2β → REACHED+α. `c68233d` concept writeback on deterministically verified reach; hub recalled a concept local node wrote (cross-node transfer). → composition-crystallization, memory-recall.

### test-residue-live-state (continued)
- **08-29 live-services test class** — 9 dev-vessel test files call live services (violating vessel CLAUDE.md); 21/36 failures were 5s timeouts; pull-sync pre-cutover gate false-blocks on flaky tests; existence-only assertions pass on empty/unreachable deps (`error.test.ts` self-refuting); `code-locality-mining-tick` test WROTE `/workspace/locality/code-locality-index.json` each run; hermetic fixes `616ff68`, `7f5f454`, `93060ef`, oracle met `1cecf14` (1874 pass/1 fail, 0 timeouts). Worked.

### spend-envelope-throughput (continued)
- 09-05 compose-cap directed at 2, autonomous at 1; compose lane the only route to vessel code.
- 08-10 hub OOM: bun+node 24.3GB vs surreal 6.6GB; `MAX_CONCURRENT_COMPOSES = 4` real; CPU the saturated resource (psi avg300=29), CPUQuota throttled 60.9%.

---

## PART C — files ~52–57 (llm-plane-alive tail, local-trace-store, loopback, loop-closed-itself-once 09-10, loop-mints-never-alters 08-11, measurement-predicate 09-07 first half)

### false-verification
- **08-10 reach judge "despite an error"** — reach reason literally said "despite an error in the find command"; `exit_code:0` with stderr errors ⇒ exit-code gates can't catch. 7/7 common-assistant goals correct serially; under 10-way concurrency target inference degraded to `[]` (free-models-per-day exhausted; "no route" ≡ "LLM could not answer" in log). `WITHHELD alpha-credit … no in-chain producer-to-consumer edge` on every satisfier success ⇒ floor met, nothing banks.
- **09-10 class1 predicate satisfied by a comment** — gap closed 54 min after filing on `80ff131` adding `const subgroupSuccessCreditRatios = {}; // … per source_type` (declared, never read). ⇒ prefer class2 behavioural predicates; class1 only for literals absurd in comments. All 12 live class1 gaps share weakness.
- **09-10 learning_signal_health_observer false all-clear** — queries `/concepts/search` with no query ⇒ relevance-ordered top 5000 of 69,142 (success-heavy by construction): 5000/5000 ratio 1 "healthy" vs true 0.456; `compose_lesson` 17 loaded/0 succeeded. Previously abstained honestly (cold start). Fixed `fbf2a60` (per-source_type subgroups) + `cc3400e`: now "0/15 loaded concepts credited (0.000)".
- **09-10 `substrateGap_write` returns success:false when write succeeded** (post-write trigger failure) — dangerous with REPLACE semantics.
- **09-10 non-atomic refused landings** — 3/3 refused multi-op dispatches had a subset land via pwt: `6dc2005` (orphan decls), `76cef65`, `9267810` (dead import). "Refusal is non-binding and non-atomic." pwt mutates LIVE `/vessels` source before any gate (`resetTarget` only undo). Rollback skipped on concurrent edits while report says `rolled_back:true`.
- **09-10 ~half of self-modification lands unjudged** — staging route split (`apply mitosis-<ts>` = pwt vs `…-compose-report`): 09-07 78%, 09-08 53%, 09-09 44%, 09-10 50% pwt. Every documented regression came through unjudged lane: `f0cfb91`, `550f2f7` (inertRegexEditRefusal body → `return null`), `6fcdf40` (dead setTimeout awaits); repair `bac7d00` came via judged lane (3/3 at ~50% base, p≈0.125 suggestive). pwt region-containment gate (08-07) inert: region present on 113/4,357 gaps (2.6%). goal-host escalation suppression also gated on `namedRegion` ⇒ "one 2.6% field gates both ends". `7d97a0e` fixed `verdict &&` (no verdict ⇒ escalate). **Operator-authorized `21da981`**: pwt now calls `verifyPatchAddressesGap` (same fn as compose), fails open 3 ways. First firings: REFUSED syntactically invalid patch to `activity-api/src/routes/activities.ts`; REFUSED deletion of same-day fix `fbf2a60`; one PASSED was fail-open (0 LLM calls). Diagnostics `llm_consulted`+reason loaded 11:22:38. Outcome: worked (integrity), throughput cost unmeasured.
- **09-10 vacuous gate on pwt `0896a1c`** — shipped claiming it would have caught `6dc2005`/`9267810`; control AFTER shipping: covers neither (chained unused decls, dead imports). Retracted. Cheap root fix = `noUnusedLocals`/`noUnusedParameters` (survey: goal-host 12, ias-executor 19, dev-vessel 75, activity-api 159; clear first then enable).
- **09-10 newly-failing gate false-blocks on load timeouts** — mitosis cutover freshness tests fail 5001ms vs 5000ms on clean tree; reproduction re-run under same load; `computeNewlyFailing` fails open on empty baseline. Filed `the-newly-failing-gate-attributes-load-sensitive-timeouts-to-the-draft`.
- **09-10 goal-level reach convergence** — 4 figures/3 stores all 10–18%: goal-path success all-time 17.5% (10,658/24,987), since 09-08 11.5%, compose landing 9–16%, favorable share 12.5%. `execution.metadata.reached` is compose-outcome, not goal reach.
- **08-11 loop mints but never alters (25-agent audit)** — CREATE 95–97 templates/7d unguarded; ALTER 0 (`variant_generation`=0 on 2430/2430); RETIRE unmeasurable (listing filters `retired=false` at 8 sites). ≥92% executions `ungraded` ({0,0} deltas). Spool delivered nothing 5.2 days (26 `https://activity.test` fixtures at head of `sort().slice(0,25)` stranding ~7,391 executions). Floor `universal_tool_fallback` 30.1% vs ceiling learned_pathway 21.2% → 13.2% corrected (ceiling 0.44× floor); first/last-mile middle 82.3% (51/62) stored NOWHERE. `walk_tier` overwritten unconditionally (goal-paths.ts:526/546). Four audit headlines died on verify (trace writes dropped 70× overstated; "96.3% never graded" wrong denominator …). ribosome replay-observer 883 jobs 1 completed; ribosome-vessel registered `shapes:[]`; activity-api 816 restarts/48h; `self-recovery.timer` next_elapse=0; apply-inventory disables not masks. Identity timeout returned as revoked key (`'timeout'` vs "timed out") — lesson fixed in llm-resolver never reached auth.ts (2 copies).

### drafter-quality / composition
- **09-10 loop closed itself once and jammed once** — `b907922` closed flat-pointer predicate gap autonomously in 27 min (3-line spread in `coerceFlatGapPointer`); `f2aea65` re-applied identical fix 13 min after close (no idempotence; closed gap doesn't stop in-flight compose). Jammed: `compose-lessons-are-loaded-but-never-credited` maximally specified yet failed (anchor_not_found; TS2322 changed return type without call site) — discriminator = anchor tractability in 6,451-line `feature-compose.ts`. `anchor_index` enumerated-choice exists only in re-derivation block (4 lines 4880–4891); primary prompt asks model to reproduce anchors — 28.2% of composes die there. Judge refusal 24.9% and apply_failed 28.2% "two faces of same force" (root-cause fixes are bigger). Single-op plans land whole; 2-op plans shed edits; dynamic import collapses helper+import to one op. Applier strips leading whitespace (retracts reading of `6fcdf40` zero indent).
- `bac7d00` only partially restored composer: ~20–23% vs 10–12% baseline (09-05/06). Landing rate 15%→9.5% from 09-08 (two independent instruments agree). Git `--since` buckets local time (UTC-7) vs execution table UTC — retracted "declining commits" claim.

### dormant-mechanism
- **09-10** `inferGoalTargetShapes` (goal-target-inference.ts:87) imported, never invoked; `decideContinuation` (walk-continuation.ts:45) whole module no caller — found by `--noUnusedLocals`. Filed `two-named-capabilities-in-the-goal-host-are-exported-imported-and-never-invoked`.
- **09-11/09-10** rhythm-cadence timer runs: `considered=11 enqueued=0` — can't say why per family.
- **08-10 loopback** — `derivePublicEndpoint` (discovery resolvers.ts:41-52) rewrites port keeps loopback host ⇒ `127.0.0.1:18401`; `reachableFrom()` repair exists in exactly one consumer (`human-surface-vessel/src/routes/proxy.ts:133`). Deferred (hub down).
- **08-11** first/last-mile adaptation stored nowhere; ALTER path zero.

### mechanisms built by operator (09-10)
- `compose-drift-tick.ts` (bootstrap tier, timer) — reference = MEDIAN of preceding days (pooled baseline normalises to its own disease: 09-09 z=1.84 pooled vs 5.19 median); controls: 09-08 fires z=17.4, flat abstains, small-n abstains; first live run true positive (20% vs 11.1%), gap `compose-anchor-failure-rate-degraded` class2. Pushed `13176c29`, `614de014`.
- `gap-store-census-tick` (`d055f18e`, hourly) — asks resolver, high-water mark baseline, observes not guards. Store 4,312→4,318.
- `validator-liveness-tick.ts` & `compose-drift-tick.ts` initially filed unarmed gaps (`evidence_resolve` as string ⇒ falsifier none) — fixed to object `{shape:"activityExecutionTrace"}` ⇒ class2. Predicate positions: expected_literal+edit_site ⇒ class1; hardcoded_url+edit_site ⇒ class1; evidence_resolve.shape / verify_shape / evidence_resolve.type ⇒ class2; expected_literal without edit_site ⇒ unresolvable.
- `24ad682` substrate removed junk awaits via dispatched route-edit (one file, two ops, 53–55-char single-line anchors).

### sync-deploy-drift
- **09-10 glue layer frozen a day, reported `failed=0`** — ff-only pull failed on untracked files seeded into container (`validator-liveness.*`) then tracked by git; recurred within the hour (`rhythm-conduct-tick.ts`, `rhythm-seed-tick.ts` seeded by another session). "A tick that syncs nothing and a tick that CANNOT sync are the same line." pull-sync self-updates one tick behind (`/usr/local/bin/substrate-pull-sync`). `7f97df70` enable-converged-timers fix fired first time.
- **09-10** runtime lags git ≤ one pull-sync period (mirrors by content hash) — self-heals; mis-attribution (`2a5a305` carried my edit under another gap's message) never heals.
- **08-11 local trace store 9 days dead** — spoke trace store hub-owned by design; ~37 in-tree callers issue unwindowed reads that never return on hub (57–60s cut); `limit` capped at 100 server-side; `template-success-ranking-24h.ts` computes cutoff never sends it (18.7s vs 15s abort).

### endpoint-routing / env
- **09-10 MCP cockpit key revoked** — 401 INVALID_API_KEY; workaround: take key from vessel `/proc/<pid>/environ`, POST direct. goal-host has no status route.
- **09-10** activity-api `/v2/impulses/resolve` wants `{pointer:{…}}`, dev-vessel wants `{impulse:{…}}` — wrong envelope → opaque "Validation failed".
- **08-10** `llm-resolver-vessel` `/health` advertises `llmCompletion` but only `llm_completion` registered.
- **08-10** concept recall 4s budget vs 42s provider (BM25 IDF not persisted, SurrealDB 3.0) masquerading as masked vessel.

### spend-envelope-throughput
- **09-10** BUSY refusal stamps full 5-min per-gap cooldown (filed `capacity-refusal-stamps-the-full-compose-cooldown…`); cooldown drop is SILENT (dispatch accepted, no routing line). No naturally quiet window on continuous lane — contention experiment unrunnable without quiescing (`ROUTE_EDIT_INTENT_TO_COMPOSE=0`). ias-executor compose false block: bun test runs `dist/` tests; compose clone lacks built dist (leading hypothesis, unconfirmed).
- **08-10** "nothing applies back-pressure between dispatch concurrency and provider quota".

### gap-content
- **09-07 measurement predicate is the scarce resource** — 764/778 open gaps (98.2%) no predicate; closure dominated by expiry (905 `expired_not_redetected` vs 50 `landed_verified`). `pending_verification` is correct abstention. Four predicate classes (`verifyGapConditionAsync` gap-to-feature.ts:1680): Class 1 hardcoded_url, 1b expected_literal (inverse polarity), 3 provenance (only when no class2), 2 evidence_resolve/verify_shape; `runtimeRoot()`=`/vessels` (deployed tree). Census Class-1b blindness fixed autonomously `f36c851` (13 min, on origin/dev) — first act re-stamped its own gap class1; but posterior did not move (α54.39 β46.48) because gap-to-feature composes in-process bypassing goal-host verdict delivery ("95.5% seam"). Arming predicates on verified-landed gaps: landed_verified 50→53, pick no-op 84%→25%. Provenance (≥2 commits) produced FALSE human escalation (`escalateRelandToHuman`) refuted by measurement. Inert-land screen: `3ebfbfc` 2 insertions no reach lines. Recommit gap not retired when retry lands (257 recommit gaps). Region must ENCLOSE edit site.

---

## PART D — files ~57–75 (measurement-predicate tail … reconcile-never-ran, refusal-reason)

### false-verification / hollow-landing
- **09-07/08 measurement predicate (tail)** — `17b216f` (autonomous) truncated `const traceEndpoint = process;` in feature-compose.ts ⇒ trace POST to garbage URL ⇒ no execution_id ⇒ nothing gradeable; typecheck clean; α/β froze 1h+ while lane kept landing/closing. Filed class1 `hardcoded_url` = the broken line; repaired ~75s; β 56.74→59.74 after. `/conservation-audit` route registered TWICE (my landings `ad41776`, `776456c`), "verified" by 200 ⇒ interior anchors unaddressable; deduped `207c16a` (pure deletion dispatchable). `/conservation-residual-trend` also doubled (open). Duplicate block applied twice again in `47f73b7`. Count-type defect has no falsifier class.
- **09-08 my verdict source vacuous** — light-dispatch reachVerdict (shape coverage) graded 5,112 rows 95.5% true (deterministic ticks reach by construction); pre-registered guard fired; "fleet-graded 14.2%→27.7%" was mostly trivially-true verdicts. Damage to measurement not learning (`all_deterministic` skipped from posteriors).
- **09-08 six operator claims dissolved** — 77% single-exec (retention artifact of 150k-capped `execution`; durable: 39%/99.9% in ≥3 arms); 77.4% single-use pathways (wrong unit; goal-class: 4,420 classes, 5.62 exec/class, 84.5% reused); reach "fell" 14.9→4.6% (coverage composition shift); region effect p=0.002 (RCT: control 6.9% = treatment — selection bias); close-on-land 20× (1,630/1,744 are `auto_draft_decision:*`); "one gap 43% of picks" (`runner_up` field). "Every artifact pointed toward a more dramatic story."
- **09-08 gap triple measured** — latency ~150h → ~2h (improved); close rate 43→70–85% but `closed_reason` None 1,744 (provenance) + expiry 923 vs `landed_verified` 60; measured lane flat 6–10/day; durability: 0/2,811 reopened but `recommit-*` 312 total, 51/day on 09-08 ("gaps reappearing wearing different hats" — law 7's flattering fiction). Verdict: "improvements are all in SEEING; none are in DOING"; compose reach flat ~4.6%; α +5.91 vs β +364.
- **09-11/12 reach denominator textual** — `isGapRepairGoal` (goal-intent.ts:104) regex `close … gap` holds any "Close substrate gap X" goal to landed-edit bar; 49/83 (59%) had no edit_site = 24.1% of dominant failure class (205/246 `deterministic:edit-intent-no-landed-edit`). Deliberately not landed (flatters today); filed `reach-labeler-applies-landed-edit-bar-to-gaps-that-name-no-file`. 24h 20.5% vs 6h 9.1%. Fresh pwt failures: zero_behaviour_delta 28% (drafter edited commented-out line / error string), semantic_reject 19, poisoned baseline 12.5% (race), LLM starvation 12.5%.
- **09-12 falsifier field overloaded** — `merged["falsifier"] = c.falsifier` (substrate-gap.ts ~1006) overwrote free-text closure predicates with class label (18,402 updates/24h, 0.9% yield); comment "ADD BESIDE, NEVER REWRITE" directly above violation. `d312f43` copies >24-char predicate to `falsifier_predicate` (additive; rename would have broken `falsifierCoverage`). Preserves, doesn't derive; past predicates gone. `goal_verification_labels.grounded` false/null on all 4,398 rows (computed predicate never satisfied by deterministic labeller).
- **09-12 E4 identical-repeated-failure retirement detector** — first version 26% false positives (undistilled `== install ==` build-log reasons); cancelled dispatches still landed twice (`43bb297` + another) — "killing the client does not cancel the work" (gap is the durable unit); duplicate block shadowed fixes twice (`b05c41b` no-op, fixed `89d3dca`, `fa2b9d4`); pre-registered prediction caught the no-op. Now the duplicate is undeletable (vacuity gate: zero behaviour delta).
- **09-12 `rollupReachHistory` regression** — `52452e0` (Substrate Autonomous 08-28, pwt lane) replaced `(reached ?? 0) + $reached` (from `1150223`) with `= $reached`: week read 1/27 vs 11,608/19,412. Reverted `bc268e7`; accumulation 27→88 but stored 88 vs source 18,406 — structurally correct, still untrustworthy.
- **09-12 det gate inside `recordDeterministicLabel`** (`index.ts` ~3769 `if (!det) return`) — LLM-judged verdicts never labelled/credited; quoting decides whether compute oracle resolves note (`verifyNamedArtifactCarries` ~1531 requires quotes). 3-trial control: quoted→achieved, unquoted→none (same path). Fixed `559fd4c` (unquoted now labelled). Delivery constraints: no backslashes (4 refusals), no long single lines (TS1005 mangling), one contiguous span.
- **08-11 only symptom goal that reached landed a harmful edit** — `caa57646` (loosen dedup gate in activity-api) landed `b222d75` in goal-host walk satisfier (`_isRecentDuplicate` sets `direct=null` fleet-wide); reverted `c158bd0`. Region `"mint"` phantom (3rd instance). Semantic judge given human wording verbatim returned `addresses:true` — defect is judge reliability; recommend deterministic vessel-mismatch check + blast-radius bound on walk/satisfier/reach grader.
- **08-10 reach reason sometimes asserts** — 10/10 checkable correct across 2 runs but grader MODE (deterministic recompute vs LLM judge) flipped on 5/8 identical goals ⇒ auditability is a coin flip; LLM verdicts omit the value. First run 8/8 WRONG was my parser.
- **08-09 reconcile never ran and held the lock on all self-editing** — trace-store-reconcile http_fetch wrong 3 ways (nonexistent route, hardcoded `127.0.0.1:8080`, token header vs body) died after acquiring 15-min global `change_window` lease (no name dimension) needed by every cutover ⇒ no substrate edit could land fleet-wide. Five stacked defects incl. lease file path mismatch (`WORKSPACE_ROOT` vs hardcoded) (`67411fb`); after fixes template reports success task_count:5 but db_admin POST never arrives (loud → silent). Stored catalogue template stale (re-seed refuses by design; `activityTemplate_update` blocked by permission classifier). 65% of inserts = successful bookkeeping (`validator-dispatch` 55% + `slot-binding` 10%). `0fe5d83` (TTL 5 min, impulse plane, deferral logs, `classifyEnvironmentFailure` regex). `feature-compose.ts:3643` dead predicate (`c.refused` never exists) ⇒ no lesson/write-back for failed landings. Subagent probed credentials — output treated as tainted.
- **09-10 refusal reason in journal** — 5 refuted hypotheses about ias-executor compose env; actual: `vacuousEditReason` (`vacuous-edit.ts:428`) refused diagnostic-only edit; carve-out `_logBranches` counts `?` chars (log where silent ⇒ refused; same log with ternary ⇒ allowed). Gate sees only (before, after), not goal intent. Filed without falsifier deliberately.

### composition-crystallization / selection-learning
- **09-08 light-dispatch never graded** — 802/802 conservation rows ungraded; fleet newest 3000: light-dispatch 0/1072; no `/reach` call site. `59732fd` added reachVerdict (lines 988–1004) → graded (then vacuity, above). Compose failed because region-miner centred window at line 50 vs target 988; pwt succeeded because it can grep. `47f73b7` narrowed anchor veto to explicit regionHint (84% of plans `region:null`).
- **09-08 conservation auditor re-tag** — tags lost `boredomtargettemplate`; re-minted (upsert preserves posterior); kill criterion met (auditor share 21.2% > 15%) ⇒ tag removed from 6 auditors, kept on `conservation-bridge-tick` (pure-data template, http_fetch POST to `/v2/activities/conservation-audit-emit`). Detect→gap chain existed, bridge had no caller. Liveness invariant `986983b` (+ fix `417bdf0` for ORDER BY-not-in-projection 500 that broke `invariant=all`). Found `universal-tool-fallback` and `satisfier:substrateGap_write` dark 2.5–3h. All six posteriors identical (a=1.81 b=1.19) despite 8..701 executions.
- **09-08 failure_lessons distribution** (n=1,387/758 gaps): semantic_reject 29.1%, anchor_not_found 20.0%, verify_failed 16.9%, typecheck_dangling_reference 16.1%, syntax_break 13.5%, wrong_location 2.5% ⇒ ~52% edit-mechanics. Open gaps (808): 64.2% neither file nor anchor, 31.4% file no anchor, 3.0% file+verbatim anchor. "Reach tracks anchor quality, not author."
- **09-08 `66d268b`** picker `isPending` omitted `expected_literal` (same omission as classifyFalsifier). `chooseFirstActionable` fail-opens to `ranked[40]` unchecked ⇒ ranking race not permanent block.
- **09-11/12 exemplar supply** — `insertTraceDigest` single call site (POST / handler) ⇒ `feature_compose` 2,491 executions / 0 digests; fix `c241629` + `39e005a` (dynamic import, one edit) ⇒ digest rate 0.9/min → 9/min. Store 793 exemplars across 500+ activity_ids (I first reported 73 by summing truncated GROUP BY). Reuse DOES happen via command REBIND (14 events/24h) — retracts "no execution informed by prior one".
- **09-12 reached-command cache eviction on noise** — `evictReachedCommand` evicted on any false grade: 236/24h, 70 capacity, 18 connection, only 26 (11%) deterministic; retention ~5% (2,214 records vs 3,556 tombstones). Fix `77d318b` retains on infra reasons; entry `e1a13c0c`: 29 evictions → 3 retained. "Learning could not outrun noise."
- **09-16 path store keyed by goal hash** (corrected) — relative recognition built and wired (class-hash normaliser, shape-signature recommend, 88% new rows populated). Real defect: state signature empty on 0 of 96,959 execution rows; `v_shape_conditioned_score` 0 rows ⇒ contextual Thompson degenerates to context-free.
- **08-16 negative half severed** — blame lands (78/91 arms β>1, one β=113.59) but counterfeit Beta sampler `(rand**1/α)/(rand**1/β)` (goal-host index.ts:5636) collapses to increasing-in-credit, blind to failure: mean 0.142 arm passes `>0.5` reuse gate 99.8% (true Beta 0%) ⇒ the more an arm fails, the more reliably reused. Retirement 0/100 (`checkAndRetireTemplate` only caller in `POST /v2/activities/executions` which nothing posts to); `f2857fc` repaired an UPDATE with no caller; `penaliseHollowTemplate` returns literal `{dAlpha:0,dBeta:2}`; `success_rate` defaults 1; `total_selections` 0 on all; M4 `skipVariantUpdate` for all_deterministic suppresses blame; no tombstone on reached-command JSONL. Half-wired channels list (written-no-reader: `extracted_from`, `metadata.author`, `goalSignature`, `boredom-queue.json`, `lessons.json`, `_sf_successor_value`; read-no-writer: `walkBudget`, `lessonExecutionPolicy`, `sort:"disposition_scored"`, `state_signature` 16-hex guard vs 8-hex producer).
- **08-08 monoculture** — 98.5% shellResult (1178/1196); duplicate shell safety net before inference deleted `d5095b9`; residual = genuine inference preference. 2-step chain shellResult→memoryNote_write worked; generalization to unseen file/field first try.
- **08-10 mint-rate guard** exists (`MAX_NEW_RESOLVERS_PER_HOUR` default 2 in `apply-proposal-as-patch.ts:967/1186`), never fired; env-var = law-1 violation (fail direction is a design decision).
- **08-10 oracle authoring loop live** — `missing-verifier-gap.ts` (index.ts:251/:3009) files verifier gaps (6 incl. self-diagnosis `verifier-family-classifier-recognises-only-counting-questions`); in-process dedup `_filedVerifierGaps` never re-files after close.
- **08-11 loop mints but never alters** (see Part C).

### test-residue-live-state
- **09-13 newly-failing gate blame** — 4,027 compose reports: 251 blamed, 281 distinct tests, 55 blamed across ≥3 unrelated gaps own 69% of blame pairs (CLI tests 55 gaps; `resolveGapToFeature cooldown logic` 30). Re-run confirms determinism not causation (state-dependent). Self-referential blocker: fix for false-blame gate rejected by false-blame gate. Detector `state_dependent_test_blame` in self_interference_scan (`44904fa` + `fc7789c` cap fix `blameEmitted++ < 5`). Test fixtures in live store (`some-real-gap`, `dupe-1786176268999`, `class-b-…`). `@ts-ignore`×16 in substrate-authored `gap-to-feature.test.ts` (`50fc392`) never passed; seam `requeueAfterNonAttempt` unused. `TranslatingTraceSink … exec_test_1 at https://activity.test` 11,471/24h (fixture live network retry in prod).
- `self-interference-scan.ts` `void windowHours;` ⇒ 369 July rows reported as present (fixed `855b3f8`).

### narrowing-duplicates
- **09-13** of 186 open substrate_detected gaps, 96 are self-generated compose churn (48 recommit + 48 route-edit, nested 2–3 generations, mostly on `env-gate-scan.ts`) burying ~40 real self-reports (`pull-sync-diverged-super-repo`, `runtime-source-truncated-*`, `validator-cadence-severed`, `gap-backlog-unhealthy`, 23 `docs-drift-*`). Open gaps rise because mint rate > close rate; recommit depth-capped 2 (`feature-compose.ts:3148`) not breadth-capped; `-narrowed` ids reset backoff. Walk-invented shapes filed as capability gaps (`gap-dispatch`, `gap-success-message`).
- **09-13** "gap closer inert" retracted: 981 gaps `closed_by: gap_lifecycle_scan`; the 12 zero-closure `funnel_history` rows were read-only calls from `rhythm-reality-sync.ts:73`.

### sync-deploy-drift / codebase-bloat
- **09-13 runtime-drift watchdog** `63b48175`+`03dd7478` duplicated pull-sync's existing `mirror-to-live` call (`substrate-pull-sync.sh:1198`), missed via `| head -15` grep; credited mine for pull-sync's repair; repair defaulted OFF. Slot dir decoy `/workspace/compose-slots` (empty) vs `${WORKSPACE_ROOT}/compose-slots`. pull-sync exited non-zero 26/12h incl. `TEST GATE BLIND`. Container super-repo 1 behind/4 ahead (unpushed `obsidian-episode-vessel` merge) + 21 dirty paths.
- **08-12 pointer-currentness workflow** `.github/workflows/bump-submodules.yml` (cron 6h, `substrate-bot`) failed 11 consecutive runs since 08-10 on dead `SUBSTRATE_GIT_PAT` ("resolved 0 of 18"); operator absorbed the chore by hand (law 6 quietest form).
- **08-30 pre-cutover test saturation** — load 46–57, 39 `bun test`; cgroup = local-tools-vessel (`timeout 240 bun test` via shell resolver); mitosis-tick 341–426/hr × 2 suite runs; `runCheck` `proc.kill()` orphans (fixed `0fd7487` setsid group kill; `groupBounded` lesson in local-tools never propagated). local-tools never logs commands it executes. Saturation by design (cadence).
- **09-11** `git add -A validation/reports/` swept ~400 evidence files incl. 2 secrets (gitleaks blocked).

### endpoint-routing / auth
- **09-10 operator client key revoked** — MCP renders 401 as "could not find goal-host-vessel via discovery"; 404-vs-401 test on nonexistent route; key at `config.metabob.apiKey`. In-container dispatch workaround.
- **09-11 operator field not tag** — `body.operator` (index.ts 14695) sets trigger; `tags:["operator:…"]` is derived ⇒ operator dispatches ran autonomous lane cap 1. Host loadavg (Docker Desktop VM) ≠ container loadavg. `80e45a2a` posterior APPLIED log (4268 SKIPPED/0 APPLIED before); skip reasons 86% infrastructure (no defect).
- **09-08 producer index blind to activities** — `liveShapes()` = discovery ∪ peers, never `activity.output_shapes` ⇒ filed `gap-uilegibilityreport` to author a resolver while `development-vessel:ui-legibility-audit-tick` exists (law-3 dup mint). Filed `liveshapes-ignores-activity-output-shapes`. Activity row `total_executions:0` while 5 traces exist.

### gap-content
- **09-06 operator supplies one anchor** — 5,623-char summary with 6 fragments ⇒ op_count 3 fail; 1,320 chars/2 fragments ⇒ op_count 1 landed `9822a8e`. Evidence belongs in `evidence_ref`; `max_ops:1`, `single_file:true`. 82.5% of picks BUSY (3699/4482/48h).
- **09-12** 1 of ~13 operator gaps self-closed (`8efd578`, precise one-line remedy); second identical-shape gap not selected in 30 min (selection ≠ success). Operator raced substrate and overwrote better fix (`cc2354d` → my `a563096`).

### human-surface-escalation
- **09-07** provenance (≥2 commits) fired false `escalateRelandToHuman`.

---

## MECHANISMS (inventory from this shard)

| mechanism | location | general/specific | status (evidence) |
|---|---|---|---|
| Gap predicate classes / `verifyGapConditionAsync` + `sweepPendingLandVerifications` | dev-vessel `gap-to-feature.ts:1680`, runtimeRoot `/vessels` | general (shared seam: gap closure) | live-used; 50→60 landed_verified; starved by 98% predicate-less gaps |
| `classifyFalsifier` + `falsifier_predicate` preservation | dev-vessel `substrate-gap.ts` ~409–470, ~1006 (`d312f43`, `f36c851`) | general | live-used; census only, doesn't arm predicates |
| `gapClassKey` consumption gate (`GAP_CLASS_OPEN_CAP`) | `substrate-gap.ts:210/:746` | general | partly fixed (8-hex `14def70`); lineage-root capping NOT done |
| `pending_verification` abstention | gap-to-feature picker | general | live-used, correct |
| `vacuousEditReason` / inert-literal gate `inertRegexEditRefusal` | `vacuous-edit.ts`, feature-compose (`9c4e242`), pwt (`0896a1c`) | general (shared helper) | live; coverage gaps (chained decls, imports; `?`-count carve-out); `550f2f7` once killed it |
| `verifyPatchAddressesGap` semantic gate on pwt | pwt (`21da981`) | general (same fn both lanes) | live; fails open 3 ways |
| `regionContainmentVerdict` | pwt/compose | general | effectively dormant (region on 2.6% of gaps) |
| `anchor_index` enumerated anchor choice | feature-compose.ts 4880–4891 | specific | only in re-derivation path, not primary prompt (dormant for 28% failure path) |
| stage-harness `--predict` | `validation/scripts/stage-harness.ts` | general (operator tool) | used by operator 08-11 |
| compose-slot allocator / directed reservation | dev-vessel `compose-slots.ts` (O_EXCL files) | general | live; cap 1 autonomous/2 directed; per-gap in-flight guard `c8cfc38` |
| failure memory | goal-host `/workspace/.goal-host-failure-memory.jsonl` (`9e23455`,`cf8fd87`) | general | live 09-22 |
| reached-command cache + retain-on-infra-reason | goal-host (`77d318b`) | general (reuse) | live; retention was ~5% |
| command REBIND (first/last-mile) | goal-host walk | general | live, 14–145/24h; can interpolate English into commands |
| `execution_exemplar` + exemplars endpoint | activity-api | general | fossil-ish: no production consumer (only self-test) |
| `insertTraceDigest` dual-write | activity-api execution-traces (`c241629`,`39e005a`) | general | live; digest rate 10× |
| conservation-audit endpoint + invariants (incl. liveness `986983b`) | activity-api `routes/activities.ts` | general (detector seam) | live; duplicate routes (one deduped) |
| conservation-bridge-tick → conservation-audit-emit | pure-data template | specific | live (boredom-tagged) |
| 6 conservation auditor templates | activity-api catalogue | specific | untagged (duplicate of bridge) — fossil |
| compose-drift-tick, gap-store-census-tick, validator-liveness-tick | `scripts/substrate/*` bootstrap tier | specific operator detectors | live (timers) |
| runtime-drift-tick | `scripts/substrate/runtime-drift-tick.ts` | specific | detect-only; duplicate of pull-sync mirror (repair off) |
| substrate-pull-sync (ff pull + mirror-to-live + pre-cutover test gate) | `/usr/local/bin/substrate-pull-sync` (image) | general (deploy seam) | live; silent `failed=0` on blocked pull; self-updates one tick behind |
| mirror-to-live | scripts | general | live; not told wanted SHA (MIRROR_EXPECT_SHA added later via drift tick) |
| `gap_lifecycle_scan` (cluster/prioritise/consumption_queue/auto-close) | dev-vessel | general | live; closes via expiry mostly |
| `self_interference_scan` (+`state_dependent_test_blame`) | dev-vessel | general detector host | live |
| `reach_rate_scan` | dev-vessel | general | live; blended rate mislocalizes |
| `missing-verifier-gap` filer | goal-host | general | live; in-process dedup defect |
| phantom-anchor (E3) + identical-repeated-failure (E4) admission exclusions | gap-to-feature | general | live (duplicate E4 block) |
| `hopeless()` category seal / `predictLand` / calibration json | gap-to-feature ~993/~2427, `/workspace/expectation-calibration.json` | general | live-harmful (trained on 0/1030 oracle) |
| Thompson sampler in goal-host (`(rand**1/α)/(rand**1/β)`) | goal-host index.ts:5636 (08-16) | general | broken (as of 08-16; later state not in shard) |
| `applyOutcomeToPosteriors` (`ungraded ⇒ 0/0`) | activity-api `lib/posterior-update.ts` | general | live; task-thrown failures never lower β |
| light-dispatch reachVerdict | light-dispatch (`59732fd`) | general | live; vacuous (95.5% true) |
| `recordDeterministicLabel` det gate / `maybeConsumeOracleLabel` | goal-host ~3769 / ~15670 | general | live; LLM verdicts never labelled |
| deterministic command builders (6) | goal-host index.ts ~1274… | specific | cover 2% of goals (08-05) |
| `synthesizeVerbatimEditOps` LLM-free floor | feature-compose.ts:1263 | specific | never fired (08-05; fix proposed) |
| `inferGoalTargetShapes`, `decideContinuation` | goal-host | specific | fossil (imported, never invoked) |
| `reachableFrom()` loopback repair | human-surface proxy.ts:133 | should be general | exists in one consumer only |
| `groupBounded` process-group kill | local-tools index.ts:68-101 | should be general | duplicated later as `setsid` fix in mitosis `0fd7487` |
| `isFailoverError` + `isUnauthenticatedProviderError` | llm-resolver | general | live (08-12 fix 717→1 401s); not consulted for learning |
| `llm_api_health_observer` real-completion probe | llm-resolver | specific | nothing invokes on tick |
| `remedy_effectiveness_observer` | registered | specific | correct, unscheduled (08-09) |
| `goal-file-resolution.ts` (927 lines, symptom→identifier bridge, phrase-pair extraction `fea9eab`) | goal-host | general (localization) | live; prefers rare prose n-grams; seed-file literal attractors |
| `human_input` resolver | registered | general | invoked by 0 activities (08-09) |
| gen-env merge-then-write + apply-inventory ENABLED_EXTRA_VESSELS | image bootstrap tier (`9f8f945e`, `d9f93442`) | general | live after image rebuild |
| `.github/workflows/bump-submodules.yml` | super-repo CI | specific | dead (credential) as of 08-12 |
| `db_admin` vetted repair catalogue | activity-api | general | used 09-06 for donor backfill |
| rhythm-cadence timer (seed/conduct ticks) | scripts | specific | runs; enqueued=0 unexplained |
| `MAX_NEW_RESOLVERS_PER_HOUR` mint guard | apply-proposal-as-patch.ts | specific | env-gated, never fired |

---

## PRINCIPLES / LAWS stated in this shard

1. A capability that has never once executed looks exactly like one that does not work; the distinguishing evidence is a count, never a code reading (compose-pipeline 08-10).
2. Check whether the thing you are about to build already exists — run the existing thing with corrected inputs before scoping a build (08-10, 08-09 gap-closing).
3. Self-modification without execution is negative drift: every gate READS the diff, only a test RUNS it (09-09).
4. Prompt-level correction does not work on drafter paraphrase; the lever must be mechanical (enumerated anchors) (09-09).
5. Anchor on the smallest unique fragment; one operation per plan; single-op plans land atomically (09-09, 09-10).
6. A `${A:-$B}` fallback fails over on empty, never on invalid (09-14).
7. The cheapest way to make a class self-reporting is to make an existing metric honest (cutover reach gated on push_status) (09-14).
8. A checker pointed at a path nothing refreshes is the dominant instrument failure; name the tree (09-10, 08-10).
9. A performance bound smaller than the population is a correctness bug (09-10).
10. Billing/provider failures must not be recorded as quality failures in the learner (08-11).
11. Information at the moment of use: cross-file symbol grounding; when a drafter repeatedly invents the same missing thing, believe it (08-11, 08-07).
12. When you assert a cause, ship the measurement that would falsify it in the same commit; a diagnostic that cannot come out false teaches nothing (08-07).
13. Never escalate a blocker to the operator on an inferred cause; enumerate what the system should have done automatically and check whether that path ran (08-07, 08-12).
14. A gap whose summary contains the patch tests plumbing; a symptom summary tests capability (08-10).
15. Editing a gap is a dispatch (08-10); a gap's first sentence must state the defect; correct metadata not just prose (08-11).
16. A liveness signal shared with other flows cannot prove your flow is alive (08-09).
17. An unconditional early return is valid TypeScript; the graded lane's refusal must bind across lanes (09-05, 09-10).
18. Don't "fix" an inverted env gate by setting the env var — delete the gate (law 1) (09-05).
19. A live `updated_at` is not evidence the write API works; check `created_at` and run a control through the shape (09-05).
20. A negative is unattributed until a positive control shares its address; zeros across a whole table are a broken probe (many).
21. Correlating log lines by elapsed time is not attribution; attribute by explicit id or content only one actor could produce (09-06).
22. Match log events by PREFIX/field, never substring — in a self-modifying system the substring may be source code (09-10, 09-12).
23. Localisation determines what every downstream gate means; once restated onto the wrong file, no gate quality recovers it (08-11).
24. Rarity is not specificity (localizer) (08-11).
25. A reach judge that can say "despite an error" is not a gate; a fluent reach reason is prose, not evidence; after reached:true on an edit goal compare origin/dev (08-09, 08-10).
26. A satisfier that reports emptiness must not count as producing the shape (08-08).
27. Non-fatal on a learning write is fatal to learning (08-17).
28. A loop that stores only its successes cannot compound on failure (09-22).
29. Reuses perfectly on repeats, never on near-misses ⇒ look at the retrieval key first (08-08).
30. A shape collision cannot be resolved by preference order — resolve the producer by name (08-08).
31. "Nothing was found" and "nothing could be asked" must not log the same way (failure rendered as absence; nine subsystems in one day) (08-08, 09-10).
32. A claim predicate must never match inside a PATH token (08-08).
33. Measure what a guard CARRIES before tightening it; enumerate producers that must still pass a tightened predicate (09-04, 09-10).
34. When you TIGHTEN a metric, ask whether it can flatter you today — run per rung (09-11, 09-12).
35. A baseline that includes the disease cannot diagnose it (median not pooled) (09-10).
36. A health detector whose sample is selected by the health it measures cannot report ill health (09-10).
37. Arm class2 behavioural predicates; class1 literals are satisfiable by a comment (09-10).
38. Built, works, unreachable is a distinct failure class from broken — check for a CALLER before debugging the callee (09-08).
39. Exploration must add a candidate, never remove the best (09-23).
40. A write-triggered pickup that writes on a non-attempt feeds itself (09-23).
41. After every landing, diff the RUNTIME file against the commit; "runtime == commit" is necessary not sufficient — exercise the consumer (09-23, 09-24).
42. Killing the client does not cancel the work — the gap is the durable unit; retract by closing the gap (09-12).
43. State the expected effect before dispatching; a repair with no predicted observable is a story; pre-registration is the highest-yield habit (09-10, 09-12).
44. Before landing a detector, print the rows it would fire on and read them; a detector built on a corrupted field inherits the defect (09-12).
45. Never compute a reuse statistic over a truncated store; group at the unit that matters; split by subpopulation/determinism before reading a trend (09-08).
46. The improvements are all in SEEING, none in DOING — do not report convergence of instrumentation as capability improvement (09-08).
47. A re-run confirms determinism, not causation (09-13).
48. A truncated search is not an absence; take a path from the code that WRITES it (09-13).
49. A shared report shape is written by multiple callers with different intent — enumerate writers before reading a history table (09-13).
50. Retry discipline: after BUSY wait >5 min and reword; verbatim retries coalesce (09-10).
51. Two samples of one refuter prompt are not a quorum; put the executable counter-fact in the spec (09-24).
52. Before escalating a "design decision", check whether data answers it (09-12).
53. Check whether the gap is already fixed immediately before a dispatch lands (race with autonomous loop) (09-12).
54. Can this container reproduce its running state from config and volumes alone? Volume persistence ≠ restartability; bootstrap tier needs image rebuild (08-08).
55. An unconditional health handler disables every watchdog above it; `/health` green while the load-bearing route takes 42s (08-10).
56. Nothing applies back-pressure between dispatch concurrency and provider quota (08-10).
57. The trace store fills with bookkeeping (65%) — stop tracing lifecycle meta-dispatch rather than reconcile harder (08-09).
58. Check who authored the last N instances of any chore you are doing by hand (08-12).
59. A mechanism that works on the population it was written for while the population silently changed underneath (gapClassKey) — census the dominant families (09-14).
60. Children must reference the parent, not copy it (copy-on-mint) (09-14).

---

## RECURRENCE — same root, different hats (within this shard alone)

| root cause | hats worn (date · instance) |
|---|---|
| Path/tree not refreshed or wrong root (`WORKSPACE_ROOT` vs literal; submodule vs clone vs `/vessels`) | 08-09 gaps.json literal ×4 sites; 08-09 lease file path; 08-09 pool 15.7MB fossil; 08-10 golden-drift tree 32 behind; 09-05 heartbeat fossil (autonomy gate); 09-09 4 stale gaps.json; 09-10 coverage check 25-day tree; 08-11 wedged 296-behind clone grading 3 consumers; 09-13 compose-slots decoy; 09-22 unit WORKSPACE_ROOT vs env-file (index) |
| Gate reads the diff, nothing executes it → inert / broken landings pass | 08-07 comment no-op `8a25744`; 09-05 `3a92282`/`b9fc69d`/`b24df4e`/`5cd4e72`; 09-05 `94b1efd` env gate; 09-09 `f0cfb91`; 09-10 `6fcdf40`, `550f2f7`, `17b216f` (`traceEndpoint = process`); 09-12 `52452e0` reach history; 08-11 rename-only `05aeaa3`; 09-10 class1 closed by comment `80ff131` |
| Unjudged lane (patch_with_tools) lands what judged lane refused; refusal non-binding, non-atomic | 08-07 `985b8d3` / `046d754`; 09-05 escalation disabled gap store; 09-10 `6dc2005`, `9267810`; 09-23 pwt blind snapshot restore overwrote `3d2e52a`; fixed partly by `21da981` |
| Failure rendered as absence / "could not ask" == "nothing there" | 08-08 cache-read satisfier; 08-08 concept recall pinned masked endpoint 1,909 fails; 09-10 empty vocabulary 401 → 0-step; 09-10 MCP 401 → "not found"; 08-11 identity timeout → revoked key; 08-10 hub 000 = timeout; 08-17 verdictNull |
| Verdict / learning signal computed then lost or never delivered | 08-08 reach-patch MATCHED NO ROW (68% dropped); 08-17 zero retention; 09-04 joinDecisionOutcome drops landings; 09-07 in-process compose bypasses goal-host verdict; 09-08 light-dispatch never graded; 09-12 det gate drops LLM verdicts; 09-24 task-thrown = ungraded; 08-16 counterfeit sampler annihilates β; 09-22 failures stored reason-stripped |
| Sibling call site not fixed (lesson learned once, never propagated) | 08-11 timeout regex llm-resolver vs auth.ts ×2; 08-30 groupBounded vs mitosis runCheck; 09-05 execution id vs oracle-label id one line apart; 09-08 isPending vs classifyFalsifier both omit expected_literal; 08-10 reachableFrom one consumer; 08-09 docker cp index.ts only on 6 vessels |
| Credentials dead/shadowed, outage invisible | 08-07 Anthropic credit (failover exists); 08-12 401 not failover (717); 08-12 bump-submodules PAT dead 11 runs; 09-10 fleet per-vessel keys 48h; 09-10 operator key revoked; 09-14 SUBSTRATE_GIT_PAT shadows GITHUB_TOKEN |
| Gap churn outruns detection (recommit/-narrowed/route-edit families) | 08-10 derived gaps 21%; 09-08 recommit 51/day; 09-13 96/186 open are churn; 09-14 gapClassKey 542 classes; 09-23 non-attempt write loop |
| Goal formulation / anchor supply is the binding input, operator hand-supplies it (law 13) | 08-10 summary-with-diff 3/3 vs symptom 0/5; 08-11 localises iff symbol named; 09-06 one anchor; 09-08 95.6% gaps no anchor; 09-10 operator 3/3 vs autonomous 4/26; index 09-13 operator 80% vs autonomous 2.5% |
| Operator measurement error (resting state as terminal; loose grep; wrong field; truncated sample) | every note; explicit catalogues 09-05 (5 wrong/10 right), 09-08 (six claims dissolved), 09-10 (grep tally inflation), 09-12 (while-read drop ×2) |
