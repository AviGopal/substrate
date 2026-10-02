# memory-7 — operator memory cache, files 451-525 (sorted)

Source: `/home/avi/.claude/projects/-home-avi-documents-work-substrate/memory/*.md | sort | sed -n '451,525p'` — 75 notes,
alphabetical span `reference-multiplicative-posterior…` → `reference-route-as-data-foundation…`. Dates 2026-07-13 → 2026-09-28.
Read-only. Notes below are per-file digests (batch order), then a cross-file index by problem-class key, mechanisms, principles.

## Per-file digests

### Batch A (files 1-25)

**multiplicative-posterior-and-ungradable-floor (08-02)** [selection-learning, composition-crystallization]
- Thompson updates were MULTIPLICATIVE (`alpha = ceil(alpha*2.5)`, activities.ts ~:5069/:5099) → int64 saturation after ~48 verdicts (29 feedback 500s/6h on one activity) and variance collapse (exploration stops). Fix: additive; migration 186 (`6f19696`) deflates `v→1+ln(v)/ln(2.5)`.
- Satisfier tier had NO activity rows: 6h census feedback 113x200 / 490x404 / 29x500 → ~78% of grading discarded (`satisfier:gap_compose` 85, `satisfier:orphaned_capability_scan` 80 …). Fix `2fdd71e` lazy admission of `satisfier:` ids (shapes left EMPTY so the row is not a selectable hollow producer). Deployed but "not yet observed firing".
- Ribosome gate keyed on WS `completedTasks` counter always 0 (ribosome-vessel index.ts:156) → extraction never dispatched. Fixed via durable task census (`572cd6c`,`a5390db`) → 0→7 dispatches/15min; then exposed 3 more stacked defects: duplicate dispatch up to 4x, no recursion safety (rule lived in LLM rubric task 3), `ribosome-extract` task 1 gated on `{{lifecycle.qualityEligible}}` never passed → 1051 executions success_rate 0 yet thompson_alpha 8.5 ("a template can fail 1000+ times and keep positive credit"). Fixed `079c160`. Working reach→mint reference: goal-host `mintReachedTrace` (~:3340).
- Traps: activity-api is trace store NOT an executor; wrapped id `activity:⟨…⟩` falls to stale DB copy running 0-task no-op; SurrealQL no param interpolation inside record-id brackets; `math::min` takes ONE array (`fd8cfd6`); task status two vocabularies ('completed' declared vs 'success' written) — filter returns 0 silently (`98ac098`). "A TS union no writer enforces is a comment." Dispatch registry in-memory capped ~100 → long goals invisible.
- Correction: `1d9701d` is candidate admission (ADMISSION_CAP 200), not posterior admission; pwt gap-id collapse not monoculture cause (52/60 onto feature-compose.ts upstream cause unidentified).

**my-verify-gate-pruned-shared-node-modules (08-10)** [directed-overshoot, drafter-quality misdiagnosis]
- Operator commit `f38f1a3` made compose verify run `bun install` unconditionally; worktree node_modules symlinks to shared clone → pruned `file:../ias-executor-ts` dep → every compose broke every other (TS2307 in src/seed/*). Read for hours as "drafter hallucinates". Also coded "absent => fail" (INSTALL_EXIT=null) fixed `086d5d0`. Reverted `b90d6c4`. Counterfactual: next gap filed 07:38 → landed `2156d21` 07:47 → closed landed_verified 07:55; closed_total 63→74.
- Law: when every gap fails the same way, suspect the environment; a gate on a shared resource must be evaluated against the SHARING.

**new-capability-stub-gate-and-cutover-wedge (07-29)** [hollow-landing, false-verification, sync-deploy-drift]
- Self-authored hollow resolver `9a019a0` shellResult (constant return, ignores pointer) shipped LIVE via `apply_proposal_as_patch` path which ran NEITHER stub gate NOR semantic judge. `detectNewCapabilityStub` had ONE caller (feature-compose.ts:902). Fix `3641a1b`: `constantReturnStub` detector + wired into apply-proposal paths; revert `29b6a2b`. Hand-landed (safety gate file).
- Mitosis cutover reaches freshnessOK then never finalizes → orphan `/workspace/mitosis-pending.json` freezes ALL pull-sync for 30-min TTL; gap filed.

**nine-layers-between-pathless-goal-and-landed-change (08-11)** [goal-walk-floor, drafter-quality, hollow-landing, autonomous-regression]
- 12+ trials of pathless code-change goals failed at 9 distinct layers (target inference, pathless gate, producer routing, file locator, decl vs call site, export collapse, cross-file symbols, type grounding, anchor uniqueness); 17 fixes. 5 of the operator's own fixes INERT on arrival (passed tests).
- Four autonomous landings, four distinct wrongnesses, zero caught by a gate: `d96e2ae` infinite self-call (vessel hung reporting healthy), `bc0ba3f3` deleted a log line (judge fabricated rationale; stale gap already fixed by 4ba7bbd/702c92a manufactured hollow work), `2dbb4a6` silently reverted newer work (freshness gate samples one sentinel), `067b3f46` wrong invariant (staged_base_sha = sentinel hash). "reached:true + landed sha worth nothing on 4/4."
- Negative result: an execute-the-exports smoke gate is inert (base case guards) AND unsafe (exports restart units). Tractable: coverage requirement (flag changes to modules with no test file). Recommendation: stage harness with known-answer fixtures per layer instead of end-to-end bits. Routing nondeterminism claim (n=2) later corrected (3/3 correct).

**no-hands-classrow-3x-anchor-grounding (07-31)** [drafter-quality, gap-content]
- 3 attempts at no-hands ClassRow append, none landed: LLM outage; planner anchor hallucinated away type annotation; patch_with_tools stale-anchor flail; edit-intent SPEC BUILDER emits schematic anchors ("a lesson channel cannot override a wrong spec"). Lesson recall fell back to jsonl (concept-db not primary). 4 gaps filed. `performance-status.ts` landed (bdb27d5d): honest reach 21% vs self-reported ~50%; closes: verified-repair 2.9% vs expiry 53.2%, latency median 6.3d, reopen 7.3%.

**nothing-restarts-the-containers (08-08)** [sync-deploy-drift, env-gating, federation-p2p, false-verification]
- First deliberate stop/start found 4 blockers: two writers `cat >` truncating `/workspace/.substrate-secrets` (API_KEY_SECRET lost → container could not restart); image-side copy re-broke; converged the wrong same-named file (`/usr/local/share/substrate/secrets.env.sh`); `FED_SUBSTRATE_ID` not persisted → identity churn. gen-env `${SUBSTRATE_ROOT}` unbound under set -u on README raw docker run. Eventually 4/4 self-resync.
- Law: "A property nothing exercises is not a property the system has." Instruments wrong 3x flatteringly (presence vs freshness; every() over empty set; quota-gated shape).

**nova-battery-fetch-compute (07-25)** [goal-walk-floor, false-verification]
- Pure-compute floor robust via 1-step `satisfier:shellResult`; fetch+compute unreliable: auto-bridge-source_code (templateInputShapes=[goal]) universally bindable out-selects satisfier; reframe-to-raw hollow-green. Fixes `e771b76` (inference collapse fetch-only), `e9039cb` (shape-based reframe backstop, verified firing). 0 hollow-greens post-fix across 3 runs; fetch+compute ~1/3 genuine. Gap filed for selection priority.

**obsidian-build-artifact-treadmill (07-13)** [sync-deploy-drift, human-surface]
- obsidian main.js tracked bundle never rebuilt by cutovers → deployed panel lags source; manual rebuild commits. Gap `build_artifact_not_rebuilt_on_land-2026-07-13`.

**obsidian-dag-trust-signals (07-25)** [human-surface-escalation] — obsidian `aa2fce1`: usefulness bar, grounding opacity, confidence header, reuse chip. walk_tier ~97% null (needs goal-host emission).

**obsidian-disconnect-wrong-image-flavour (07-29)** [human-surface-escalation, env-gating, dormant-mechanism] — obsidian-desktop.service crash-looped 58,875x (launch script absent in standard flavour); intake/collaborate/learn timers fire every 2min against absent backend → β-poisoning of working obsidian template. Later SUPERSEDED for this host by goal-tracking note (real Obsidian runs on host).

**obsidian-findability-stale-secret-root (07-23/24)** [env-gating, federation-p2p, endpoint-routing] — `.substrate-secrets` stale key (loaded after /etc/substrate/env, later wins) → federation register 401 every 120s → hub found:false for goal shapes → blank panel. Fixed by aligning key + restart; class fix: `federation_join_health` shaped emission on 401 (super-repo `aadb1c1c`). Same "EnvironmentFile later wins" root recurs 09-22 (two memory stores).

**obsidian-goal-tracking-loss (07-29)** [node-locality, federation-p2p, human-surface] — sidecar routes per-goal-host IN-MEMORY state shapes (activeDispatches/goalWalkState) to first dialable owner → wrong-owner flap; renderer blanks on one empty poll; guard-less sidecar. Fix `f5255ad` (operator bypass): owner-merge + dispatchId→owner pinning + crash guards. Composer's correct draft rolled back because semantic gate call-graph indexer blind outside src/ (gap). discovery forward never dials libp2p rows (gap). Closure demo 07-30 passed. Phantom watchdog `824609c6`; self-heal `ea5882bd` fired in production.

**obsidian-graph-view-dispatch-gate (07-25)** [codebase-bloat-fossils, human-surface] — two writers, no pruning of Substrate/Dispatches; retention gate landed (2189057→41567f8); syncAll un-try/caught silently skipped syncDispatches.

**obsidian-live-execution-validated (07-25)** [human-surface, goal-walk-floor] — headless :27182 action surface; auto-expand `3bf48bc`; EADDRINUSE bind retry `e8a8576`; panel pinned ENTIRE vault shape catalog as expected_output_shapes → inference suppressed → random tasks (fixed `44c6563`, law 13). WalkStep has no consumedShapes (binding edge thrown away at index.ts:3634).

**obsidian-panel-dead-via-stale-ingress-pin (07-20)** [federation-p2p, env-gating] — stale pinned `federationIngressMultiaddr` in data.json; no dial timeout → hang. Fixed obsidian `0da7490`,`803ed65`: discovery supersedes pin, timeouts, ttl:300, sidecar started unconditionally, registration retry.

**obsidian-panel-legibility-and-catalogpin (07-24)** — verified 44c6563 live; vault goals reached=NO 3x because satisfier short-circuit drops "report the count" half → re-walk wanders into auto-bridge-source_code (same short-circuit class). Legibility `2509800`. CSS not reloaded by plugin reload.

**obsidian-panel-legibility-rebuild (08-05)** — "UI regression" was substrate: 85/100 dispatches with NO goal text, zero-step walks. Real defects: grade panel refused thin rows; trace-archive fallback keyed by dispatchId vs executionId store (never hit yet printed "(from trace archive)" — self-confirming) `90506ea`. Vessel count 33→24 / peers 2→1 by dedup rules.

**obsidian-panel-liveness-four-fixes (07-24)** — operator-goal-generator posted bare {goal} → trigger null (fixed `293020bd`); fleet freeze on expand (cf92bac); hub peer absent (goal-host `1ecf873`, PEER_DISCOVERY_ENDPOINTS env); peers self-count. Deploy model: pull-sync ~11 min ff-only to clone origin/dev.

**obsidian-panel-metrics-boredom-failover (07-15)** [endpoint-routing, node-locality] — sidecar took first (loopback) discovery row → invalid URL; fix `efae67a` ranked owners + failover. Deeper: fleetActivityFeed single-substrate content (gap `loc-indep-fleetfeed-not-federated`).

**obsidian-parity-full-tour (07-24)** — 5 panel fixes (3ac0845): INSPECT unroutable shape; operator attribution; alphaBetaDelta array read as object (silently dropped); feedback activity_id='' → 400; failure meaning scanned whole walkLog. Note-driven loop had no producer.

**obsidian-parity-gaps-closed-via-substrate (07-24)** — 4 gaps landed via drafter (eb992d8, e395391, a1cdf1b) + federation_join_health direct (aadb1c1c). Drafter weak at multi-part section insertion on large files (duplicated section).

**obsidian-reach-parity-and-feedback (07-28)** [goal-walk-floor, write-read-mismatch, sync-deploy-drift] — oracle-label consumer ran only in GET /executions/:id, not goalWalkState → human override never applied on read path (`3cd7019`, shared maybeConsumeOracleLabel). Prose Q&A route gated on `llm_completion_dispatch` while hub advertises raw `llm_completion` (`7721fe8`). llm-resolver 429 stampede darkening (substrate-authored `3fa37f0`). rawResolve payload wrapped vs top-level `prompt` (`cd1127d`). "Paris." REACHED. `summar` missing from EXPLANATORY_RE (`5153704`) — detector-set divergence vs isQuestionGoal. HAZARD: local goal-host clone 131 commits behind origin/dev. Sidecar reap race (`1770e1a`). Approach-feedback design (not built) — context_thompson_scores already reach-graded → double count.

**obsidian-self-explanation-surface (07-24)** — capture complete, surfacing gap; obsidian `7a37a09`, goal-host `6df5fca`. failure_mode typed field never routed into walkState body; disposition derived at read time.

**obsidian-tier2-shapeflow-dag (07-25)** — obsidian `0516232`; inline paint + WAAPI survives JS-only reload.

**obsidian-why-now-trigger (07-24)** [write-read-mismatch] — trigger field fixed in 3 serializers; panel reads the THIRD (fleetActivityFeed) — keystone `987cb7b`. "Trace which SHAPE the panel actually fetches."

### Batch B (files 26-40)

**one-orphaned-arm-holds-97pct-failure-credit (09-01)** [selection-learning, codebase-bloat-fossils]
- `gap-closing:self-recovery-failed-activity-api-1784279833897`: 4040 executions, 16 successes, α 32.5 / β 7068.1 = 96.8% of all 7304 β credits; its gap is no longer in the store (orphaned arm outlived its gap). Not firing live — historical distortion.
- 13/53 arms reach 10-sample evidence gate; 25 never graded. Auto-minted compositions (`learned-composition-*`, `auto-bridge-*`) 0.05–0.14 vs seeded 0.54–0.92; mint ~2.2/day — law 3 measured. "Its input is poisoned, not learning broken." Quote total_executions, never α+β (chain-inflated).

**on-non-filesystem-work-only-the-floor-answers (08-10)** [goal-walk-floor, false-verification]
- 8 inline non-FS goals: `universal_tool_fallback` 4/4 correct; satisfier/learned_pathway/fresh_derivation/feature_compose 0/4. cap-08 within-goal A/B. REACH-CONTENT artifacts were 80–106 chars of metadata (`{"producedBy":…}`), no regex existed; reached:true with body None.
- The reach→mint detector ("SKIP ungrounded reach — bare-LLM-yes") fires but is wired ONLY to the learner: 4/4 ungrounded skips still reported reached=true and oracle wrote `achieved`. Method: grader controls positive/negative/ECHO; pre-registered prediction. Score 26/33 across 4 rounds; non-FS 4/8. Debug question routed to feature_compose. Coalescing key = exact goal text, running only (index.ts:12217).

**open-arm-pool-and-drafter-quality (07-31)** [selection-learning, env-gating, endpoint-routing, drafter-quality]
- LLM arm "willing" set was hardcoded closed subset; `b9b68d8` isModelWilling from policy (landed, not deployed — classifier-blocked). A3 VLLM self-hosted providers INERT because VLLM_* env unset (env-gated capability). patch-with-tools frozen dead `fallbackModels` → derived from discovery `fd144a7`. 5 compose_lessons posted to concept-db. Grounding-hoist `83bb498` (grounding skipped for short schematic specs). `31fb735` groundedUniqueAnchor in spec builder; `15c611e` target-file-scope gate.
- Root "reliant on one provider": 4 local llm resolvers are cosmetic clones on the same keys → de-advertise atomically; Qwen3 pod in no selectable set on spoke; federation transport mirrors LOCAL→HUB only (no importHubShapes); 3 consumers hardcode `?vessel=llm-resolver-vessel` (feature-compose:1737, patch-with-tools:586, llm-completion-dispatch:182) misrouting to obsidian. Reference correct impl: goal-host `llm-router.ts` — extract to packages/vessel-discovery-client (duplicate-implementation class).

**oracle-clone-drift-fleet-convergence (07-31)** [sync-deploy-drift, false-verification, codebase-bloat-fossils]
- Reach oracles enumerate `/workspace/git/super-repo/repos/<v>/src`; ~12 clones detached+behind+dirty (activity-api 42 behind …) with confab-era cruft files → deterministic oracles graded wrong denominators (253 files/55529 lines vs true 244/55407). Honest reach 20% → ≥50% after convergence. pull-sync `git checkout -q dev || true` fails silently on dirty tree; durable fix `cdee05bc` (reset --hard + clean -fd) but image-baked script → effective only next deploy. `d1bc9ab7` submodule-update after ff (recurrence path). Gap: hollow-green-llm-judge-overrides-all-hollow-walklog. Interrogative guard `92d4b428` held 0/10.

**oracle-corpus-guard-commented-out-and-dead-switch-arms (08-25)** [false-verification, write-read-mismatch, codebase-bloat-fossils]
- `recordDeterministicLabel` (goal-host index.ts:3504) guard `// if (!det) return;` commented out → LLM-judge verdicts enter `goal_verification_labels` (~0.6 conf) contradicting "NEVER the LLM judge".
- Oracle corpus has NO read-at-use-time consumer; drafter corpus-write commented out (feature-compose.ts:3068) — archive not teaching.
- activity-api impulses.ts: EIGHT `case 'goal_verification_label':` arms, 7 unreachable (dead duplicates).
- Credit path clean: keys on execution_id with reach_graded idempotence (execution-traces.ts:5061); real α/β write at POST /reach :4951. decision_outcome read only by /decision-calibration; nothing recalibrates from it.

**organ-parity-and-write-shape-target-defect (08-03)** [goal-walk-floor, write-read-mismatch, dormant-mechanism]
- 24h walk calls: development-vessel 603, others tiny; ribosome/analysis/stateful-ui/light-dispatch ZERO; 84% of walk traffic one organ. light_dispatch/activityDispatch/cpgQueryResult have no producer.
- 447/990 terminations at chain.length=0: write shapes resolved bare (`substrateGap_write` 584 missing, rawResolve fail x1061). `resolver_schema` negotiation exists in goal-host but ONLY concept-db implements it (the unreachable organ). Fix `f57fd03` flat-pointer lift for substrateGap_write; durable fix (resolver_schema in dev-vessel) owed. Planned 317 / produced 4 (1.3%). Real fix = payload binding / compute-then-emit ordering.

**patch-with-tools-live-source-truncation (07-30)** [autonomous-regression, sync-deploy-drift, hollow-landing]
- earlyFileMatch regex corrupted by autonomous `bd21771` (stray space), half-fixed by `5b1959a`; mangled 3x → fixed `4cd03af`. Gap `detector-mitosis-predicate-golden-corpus-gate`.
- patch-with-tools edits LIVE `/vessels/<v>` source in place: fs_write truncated goal-host index.ts 9386→213 lines. Guard `af54cc8` (refuse shrink <50%). Structural overlay isolation still open (gap `critical-patch-with-tools-edits-live-vessel-source-truncation`). fileCapabilityGap confab storm ~44 false "no producer" gaps (incl served memoryNote). Cockpit key revoked at discovery; dev-vessel/goal-host fail open.

**pathway-reuse-died-in-a-zod-strip (08-06)** [write-read-mismatch, composition-crystallization, false-verification]
- `successful_executions` absent from `RecommendedPathSchema` → Zod stripped → 0/5 reuse accepted in 48h reported as "no reusable pathway". Fixed `activity-api@48bc174`. Law: "a field is only load-bearing if it survives serialization." Nearby-match arm (shape cover ≥0.5): 78% of fresh goal hashes rediscovered existing path_signatures. First cross-goal reuse in production 08-06T20:45Z (borrowed a063afb0…, 6/6). 2/4 accepted after.
- False red: `parseFileExtension` needed literal "files" → β-penalised correct answer (fixed `e07364b`, extracted file-extension.ts because index.ts boots a server on import).
- Terminal write before compute (memoryNote placeholder while shellResult correct; nondeterministic) — "reached graded the COMPUTE not the ARTIFACT". Bridge hardcoded `obsidian:write_note` sink → `bf818b7` resolve goal's own write shape; `c41f365` duplicate note from slug of goal text → parseGoalNoteTitle. Ordering race NOT fixed.
- `recommendReachingPath` has ONE call site (recovery loop index.ts:8091); primary pool walk never consults it → covers ~34% of traffic. Gap `pathway-reuse-not-consulted-by-pool-walk`. Unpushed substrate commit froze goal-host deploy ~6h.

**pending-verification-is-computed-from-git (08-23)** [false-verification, write-read-mismatch, human-surface-escalation]
- 7 gaps PENDING; picker re-selects/skips ~600/day (432 picks of route-edit-56849210 in 48h). Operator wrote `disposition`+`pending_set_at` — picker still PENDING: `verifyGapCondition` (gap-to-feature.ts:1149) re-derives from git via `landedCommitVerdict` (one landing→pending). Metadata was a field nothing consumes. Exits: measurement predicate (evidence_resolve/verify_shape) or revert. Reverted inert `dbb2917` via `69afa93`. "The substrate has no path that REVERTS."
- Escalation broken: `uiQuestion_write` 3 producers/1000 writes/24h; read shape `uiQuestion` NONE → unmeasurable gap also unaskable.

**persistent-source-gap-age-immune-churn (07-29)** [narrowing-duplicates, gap-content, docs-drift/instruments]
- Corrections: LLM plane UP (gateway body-map drops top-level prompt); autonomy healthy (use `git log --author='Substrate Autonomous'`, not -1: dev-vessel 93 autonomous commits/14d); recommit fractal arrested by `12e7611` (_recommitDepth<2).
- appendComposeLesson (feature-compose.ts ~1457) unconditionally reopens SOURCE gap → fresh updated_at → age-immune to lifecycle scan; `unlandable` computed but never acted on. Gap store REBUILT ~1h prior (81 open, 0 closed) → failure-count disposition would match 0 rows; route-edit/recommit ids ephemeral, never in gaps.json. Landed instrument instead: substrate-authored `9b2cbdc` (open_persistent_fresh etc. in funnel-history.jsonl). Correct seam = feature-compose.ts:1457.

**plumbing-reconciliation-6-items (07-31 eve)** [false-verification, selection-learning, trace-store-db, gap-content]
- `23e707f` + migration 183: deterministic labeler allowlist + SCHEMAFULL assert — dead oracle feed (0 rows since 07-20) revived. `1d9701d` sample-then-truncate candidate admission. `10e10e9` land→close credit via `pending_outcome_verification` + already-applied guard narrowed.
- WITHHELD: composition-edge reconcile reads DEAD `activity_execution_traces` table (edges frozen ~1998 rows since 07-28; live = `execution`); drafted swap would fail SCHEMAFULL assert swallowed by try/catch. Generator gaps: detector-coverage-scan clusters only failure traces (blind to false greens); ops scripts image-baked (only 2 self-refresh). perf-view 100-row cap mislabels reach 20% vs 42.3% lifetime.

**plumbing-wires-deployed (07-31)** — ff04a17 landed_verified close sweep; c57563f deterministic label feed + hollow-walklog cap; 1b0c693 mint dedup + posterior time-decay (half-life shaped row); 0ccfadf boredom consecutive-failure debit; 43a6d0b ribosome gated on route resolvability (ended 78 fails/hr storm); da80965d marker reap + divergence auto-push; d1bc9ab7 submodule update. WATCH: sweep fails OPEN on unknown verifyGapCondition; maybeConsumeOracleLabel limit:1 latch lets deterministic label pre-empt human. Residue: substrate writing README truncation + gaps.json into tracked files.

**poisoned-baseline-detector-reported-and-continued (08-05)** [autonomous-regression, sync-deploy-drift, false-verification, spend-envelope-throughput]
- Live mirror gap-to-scenario-bridge.ts corrupt (15,853→11,501B) → dev-vessel crash-loop while clone clean. patch-with-tools logged "POISONED BASELINE" 2 min before and proceeded; rollback writes corrupt baseline. Fix: refuse when base <75% of clone. Recovery: `mirror-to-live` + restart.
- Substrate cannot self-modify systemd units (image-baked at Dockerfile.substrate:213): drain-timeout drop-in `9706f440` in git, absent in container → changed nothing.
- Failure paths misdirect: every tool failure relabelled "poisoned baseline" (`0f351f1`); "RUNTIME SOURCE TRUNCATED" 18 false/6h each filing systematic_failure gaps (`25907d96`).
- Shared vessel-daemon `server.stop(true)` force-closes in-flight → no vessel drains; dev-vessel restarts kill 5-8 min composes (5 consecutive failed dispatches). Walk edit fallback is whole-file fs_write (40,135B→1,633B blocked by local-tools guard).
- change_window lease leak: self-cutover restarts the process whose `finally` releases the lease → pull-sync deferred ~40 min, logging "Finished". Bootstrap deadlock. Hollow RED: `af5e3a3e` reached:no while `b15e1df` landed.

**pool-continuity-two-horizons (07-25)** [composition-crystallization, dormant-mechanism] — within-walk pool reuse real (c57dc5ea reached 14 correctly after 2 hollow rejections); cross-dispatch standing pool (`pool/standing.json`) carries only gap-mirror records, flat recency, no decay; pool Thompson ranking stubbed `degraded:true` in ias-executor-ts impulse-pool-selection.ts:9. relevance_score consumed only in /recommend. Gap `standing-pool-flat-unranked-no-momentum`.

**posterior-ratchet-1612-beta-zero-alpha (08-03)** [selection-learning, autonomous-regression]
- 24h: 1612 penalties, 0 α credits, 48 reaches. Gate `consumedInChain.size>0` impossible for 1-step reaches (31/48). Instrument `c84dbf9`, gate `ec243fd` (commandEvidence anchor) → 3/3 credited. Substrate self-commit `d65f8bd` narrowed the instrument (`deterministic===false` on optional field → silenced) — reverted `24d46fe`. "A green plausible self-edit that degrades an OBSERVABILITY surface."
- β lands on `satisfier:*` pseudo-arms which steer no decision (selection reads liveness only) — domain mismatch: reach-classify marks satisfier ungraded while penaliseHollowTemplate grades them. Refuted claims (variant_promote exists — grep both spellings). Template-literal interpolation corruption `${opts.surface>`; single-line replacement form lands. Line-number specs 0.9% of reports — not binding constraint.

### Batch C (files 41-55)

**post-land-suite-silently-dead-since-08-31 (09-28)** [false-verification, dormant-mechanism]
- `mitosis-applied.jsonl` post_land_suite ran=true for dev-vessel/activity-api 08-17→08-30 (~60), then ran=false on every landing 08-31→09-28 (~600). local-tools shell 30s group-kill unless `timeout_sec` (b4766ff 08-11; caller-specifiable e4d604c 08-29; `test_suite` never passed it); suites ~39s. Fix dev-vessel `5e9a0b2` timeout_sec min(budget+30,900) → ran=true 2314 pass / 25 fail. 25 failing tests accumulated unobserved for a month. Law: "didn't run" as a neutral value decays silently — count ran=false rate. Operator first blamed `verification_spec` which never had a writer.

**practice-lens-audit-posteriors-undifferentiated (08-25)** [selection-learning, narrowing-duplicates/codebase-bloat-fossils]
- validator-dispatch α 151,324.78 β 585,779.84 (mean 0.205), 791,334 samples vs empirical recent 0.952 — ancestor in all chains absorbs global chain reach rate (no marginal/counterfactual attribution). Revision 08-26: FROZEN not ongoing (ungraded executions). ~2% of executions graded. activityExecutionSummary served by 15+ near-duplicate producers (`…_v3/v4/v5/v5_improved/v5_hardened`, some minted ~78s apart). selector_saturation_audit distinct_means 1 across 14 templates yet verdict "healthy" (checks saturation not differentiation). Funnel 6h: authored 2 → staged 1 → landed 0; backlog 3495 gaps. "Synonym treadmill" route-edit-a95b959a: 3 autonomous landings adding one regex synonym each to registry-field.ts, each closing its gap, no capability gain.

**pre-validated-exact-edit-goals-land (09-24, +09-27)** [drafter-quality, autonomous-regression, hollow-landing]
- Multi-item prose goals came back partial/drift-refused/anchor_not_found. `EDIT n old:/new:` blocks with each old text unique (count==1), pre-validated with tsc on scratch copy + gate's `detectNewCapabilityStub` + behavioural falsifier land first try. Landed-vs-parent+edits diff caught `6ab8271` silently reverting `a0ff3d3` (restored `7994841`). Dispatch gate: dev-vessel process started after newest commit, up ≥60s, in_flight≤2. 503 fall-through corrupts super-repo repos clone. 09-27: since value-per-cost 2.7 (`f70160f`) strict block format applies edits verbatim with NO LLM plan; prose landed `3cced35` with 1 of 3 edits and still reached (hollow-partial); block form landed `1669ac8` byte-equal.

**prose-floor-satisfier-flap-fix (07-27)** [goal-walk-floor, endpoint-routing]
- dev-vessel advertises llm_completion_dispatch but proxies to quota-gated llmCompletion (advertisement ≠ resolvability). satisfierTried.add before resolve → one transient null blacklists shape; last-chance scan skips it. Fixes goal-host `a1e9c12`: GENERIC_NOISE_SHAPES rejection of learned composites that advance nothing; one bounded retry on transient. 3/3 verified. Residual: reached answer confabulated (GraphQL resolver definition) — reach ≠ grounded; Fix C (ground ontology prose via concept_search) not landed.

**psi-was-unreachable-at-six-call-sites (08-17)** [write-read-mismatch, selection-learning, docs-drift, node-locality, test-residue-live-state]
- ψ/successor_value (the ONLY multi-step structure per SUBSTRATE_AS_MDP §12.1) dead at 6 call sites: walk sent `state_signature`/`expected_output_shapes`; reader destructures `signature`/`completion_shapes` — near-miss onto sibling real fields. Each defect alone zeroes ψ. One shared helper; exemption keyed on payload (exactly one). "Wiring an input is not enabling a behaviour."
- Dispatch path unavailable: activity-api masked ACTIVE RUNNING, surrealdb masked failed (masked-but-running class 5th instance, no detector). Walk env PRODUCER_DISCOVERY_ENDPOINT/ACTIVITY_API_ENDPOINT point at HUB (node-locality); hub partially down (discovery/identity 200; activity-api/goal-host/dev-vessel/concept-db connect never). Two wrong escalations from single probes. `substrate_tuning_param` in dead DB → getTuningParam falls back to env (law-1 channel inert). Test fixture `https://activity.test`/`exec_test_1` durable in production store; goal-host retries every ~10s forever.

**pull-sync-deadlock-masked-vessel (08-08)** [sync-deploy-drift]
- pull-sync override for "not active" units redid full mirror of MASKED activity-api each tick → SIGKILL timeout → vessels after it starved (goal-host 2 pushes stale). substrate-pull-sync itself in no convergence list (repair couldn't deploy itself). In-flight guard `${INFLIGHT:-0}` in case subject never normalised → never evaluated. Second fix `cb5b0b24` skip masked entirely → 16s vs 15-min SIGKILL. Laws: is-active vs is-enabled; guard must normalise the value; verify deploy by reading the executing artifact; lesson learned in one place not generalized. concept-db masked on spoke → compose_lesson channel served on hub.

**pull-sync-precutover-gate-false-blocks-flaky-test (08-24)** [sync-deploy-drift, false-verification]
- Pre-cutover test gate refused `578b831` due to flaky parity-gate test (18-36s); refusal logged only to journald ("runtime keeps running its current code"). Gaps: per-test flake quarantine; refused convergence must be visible. Workaround docker cp + vessel-ctl restart.

**ratchet-ceiling-unbindable-composite-templates (07-25)** [composition-crystallization, write-read-mismatch]
- Composite learned templates carried walk-scoped impulse ids (`walk-codeReadResult-3`) as inputShapes (buildCompositeTraceFromChain omitted inputShapes; trace sink dropped canonical shapes; ribosome rule-7 latched onto ids) → unbindable dead nodes. Fix `27cc619` (bootstrapped; drafter declined, and the walk selected a corrupted template). A/B proof pre-fix crash / post-fix bound. template_repair preserves the broken contract. Walk-collapse (satisfier short-circuit) dominant blocker to organic composition: 8 goals, 4 collapsed to chain=1.

**ratchet-works-but-satisfier-starves-reuse (07-24)** [composition-crystallization, goal-walk-floor, false-verification]
- `activity` table: 380 learned-* + 67 composed-cap-*; `source-code-to-fileeditresult` 143 succ/5 fail. ribosome-vessel path dead (0 exec); live path goal-host mintReachedTrace. Satisfier short-circuit grabs first target shape → partial reach marked reached + reuse starved. walk_tier NULL for all 5829 rows; extracted_from NULL. Fixes activity-api `e6bf483` (+migration 181; SCHEMAFULL silently dropped walk_tier) and goal-host `6d64e62` (commingled by parallel session's git add): partial-coverage guard, composition-preference probe, walk_tier recording.

**reach-approach-feedback-loop (07-27)** [human-surface-escalation, write-read-mismatch, selection-learning, node-locality]
- Once-flag latch bug: oracleLabelWritten set before fetch → human grades after first terminal poll never consumed (whole reach-feedback path dead). Reach must not β-penalise (v_shape_conditioned_score already folds reach — double count). Spoke cannot steer selection: /feedback moves impulse_shape_activity_score never sampled; /relevance-feedback has no _write wrapper. 8 duplicate label cases. Fixed goal-host `d9dc600`, activity-api `e6f85d0`, obsidian `b717c4b`. Consumer only in GET /executions not goalWalkState. Label write via overlay while local :8080 down → routes to hub → federation read/write split. Stage B approach feedback not built.

**reach-gate-dishonest-both-directions (07-20)** [false-verification, gap-content]
- create-shape-provider-goal 0%/751 traces = honest failures; empty `prior_paths_with_endpoint` lookup graded as hard failure (missing info, no producer of endpoint_output_shapes). Negative controls REACHED 3/3 — gate re-framed impossible goal to trivial fileContent and stamped reached with null body. progress_stall: 0 landings/24h; funnel 3/1/0/0; stale-proposal backlog 2228.

**reach-generalization-measured-202-goals (08-07)** [false-verification, composition-crystallization, selection-learning]
- Harness `validation/scripts/reach-generalization-harness.py`: reached 86.4% / correct 83.9% / hollow 10.8%; no learning curve (stable band). Similar goals share pathways (count_single 19 classes → 2 signatures). Reuse ~110 acceptances (91%), but 109/120 borrows from ONE donor (`a063afb0026cbaed`; /recommend ranks by total_executions). Aggregate family counted every file (313,359 vs 76,325) — fixed `bcfc4ed`; SIX copies of the extension parse (`2504fb0`). Floor graded on scratchpad; fix over-corrected (reach 92→33, reached<correct) then `06bf2da`. Cold-family experiment: 90% reach / 29% correct / 68% hollow — reach is a property of hand-written verifiers. `0eb3231` commandEvidence no longer credits alone. `57cd2c3` `deterministic:no-oracle-for-goal-class` (skip β) + `d7fee60` → reached==correct 25%, hollow 0. Harness must separate undispatched/timeout/verdict.

**reach-grading-closed-and-oracles-certified-wrong-answers (08-06)** [false-verification, goal-walk-floor]
- classifyReach `legacy-success` fail-open = 38% of executions (α 38.5%→0.6%, `activity-api@cfb455e`), blocked honest late verdicts. Floor fabricated execution ids, wrote 0/4,768 path rows → persisted now (`8ee6c66`,`c033664`). Reuse-before-derive for floor path (`2d980fe`, `56ce793`); `\bwrit\b` dead regex. Three oracles computed truth and certified wrong answers (bag-of-integers `054b2d0`; verdict string overclaim `6e6aa7c`; sum inexpressible `6c59f15`). memoryNote_write could blank a good note (`7761f47`). Bridge sink ordering `17efbee`.

**reach-is-only-defined-on-4pct-of-executions (09-02)** [false-verification, selection-learning, goal-walk-floor]
- 24h: 2910 executions, 111 graded (3.8%), 9 reached; 8/9 self-maintenance (ribosome-extract 4, mitosis cutover 4); 1 genuine floor reach. Walk reach 7/99 = 7.1% (count at reach-patch site, one line per walk; earlier 17% wrong from 5 emit sites). Ribosome column fix `7f142af` bounded by tags. Pre-registered falsifier made UNJUDGEABLE by own intervention (disabled obsidian-learn.timer mid-window).

**reach-oracle-counted-the-stale-submodule (08-05)** [false-verification, sync-deploy-drift]
- Oracle used `/workspace/git/super-repo/repos/*` (submodules, only advance on gitlink bump) → 392 vs true 377; detector noticed mirror said 377 and rationalized ("git clone is authoritative"). 9/18 vessels drift (dev-vessel 150 commits/6 days). Third dimension of self-confirming oracle (scope, filter, tree). Fix `d833cdc` authoritativeRoots (clone first); 12 golden tests had pinned the defect. Substrate picked up the gap within seconds but drafter confabulated anchors twice → operator hand-land. concept-db wire severed (`[walk-concepts] consult failed`).

### Batch D (files 56-66)

**reach-rate-13pct-root-causes (08-05)** [goal-walk-floor, selection-learning, gap-content, node-locality, trace-store-db]
- CORRECTION first: "spoke has NO LLM" was WRONG — LLM alive via federation (hub 7 lanes; wrong auth/envelope in probes). Masked activity-api/concept-db/identity/surrealdb on spoke BY DESIGN; measure against hub.
- /v2/goal-paths paginated: overall 13% (9,704 exec); fresh_derivation 34%, satisfier 8%, learned_pathway 1%; default limit=2000 window ordered by success_rate → 29% (lying window). close-substrate-gap family 3,090 execs @4%.
- walk_tier is a name heuristic (`id.includes("learned-")`). Fixes: `4cfef87` withhold never-reaching paths (3,727 execs = 38% went to 352 never-reached paths); `514f25b` COALESCE not a SurrealDB function → cts CREATE never parsed, 172 non-blocking errors/2h; `80f7249` phantom reach-gaps (105 `reach-gap-*` minted during LLM outage fed the 4% family).
- Hub load 16.2, surreal 360% CPU; trace spool exists. "A probe that saturates the system measures the probe."

**reach-rate-low-four-root-causes (07-29)** [goal-walk-floor, false-verification, composition-crystallization]
- 24h lesson classes: 128 llm_judged_hollow (~110 genuine), 20 edit_intent_no_edit_result, 14 unknown_registry_entity (correct rejects), 10 file_count_mismatch; 165 reach-gap-source-code filings. #1 walk backward-chains into unbindable inputs (self-referential `learned-auto-bridge-source-code`, `learned-understand-source-file-demo`), mislabeled log; #2 non-executing templates; #3 oracle graded stale clone (138 behind); #4 edit-intent routed to code_modification_proposal dead-end; infra: obsidian-deliver-assist unreachable graded hollow → β-poisons working template (needs `infra:` verdict).

**reach-rate-low-llm-plane-dead-oracle-expansion (07-28)** [goal-walk-floor, false-verification, env-gating, federation-p2p]
- Local LLM plane: Anthropic credit-dead; groq/mistral present:false (OPENAI_BASE_URL empty locally but set on hub); fed egress down. Validatability harness self_reported 0.333 / external honest 1.0 / gaming_gap -0.667. Landed `a92b895` (clone-authoritative count + dep-list oracle), `4c2d56c` (deterministic overrides partial-coverage), `ec3bdf9` (bare-digit match against digest false-greened; restrict to produced shellResult). After plane restored, INVERTED to hollow-greens (gaming_gap +0.083) → `2d759a2`/`79849a9` authoritative count; harness fixes. Stale reached-command cache counts drifted /vessels (gap). SECURITY: broad env grep printed GitHub tokens. Router cascade capped at 2.

**react-floor-federated-envelope-blocker (07-23)** [goal-walk-floor, federation-p2p, write-read-mismatch]
- Walk reach ~19%; Fibonacci timed out. Tools exist; root = llm-completion-dispatch.ts:269 parsed content only as string/array; federated envelope `{content:{shape,value}}` discarded → every LLM-tier walk step 500s. Fix `da08516`. Class fix (normalize envelope at egress / detector) FILED not done. Residuals: stochastic command synthesis; judge rubber-stamped Fib(12)=55.

**react-parity-floor-revived (07-27)** [goal-walk-floor, env-gating]
- universalToolFallback dead: `if (!LLM_VESSEL_ENDPOINT) return null` with var unset (law-1 env gate), + groundedOk===0 discarded internally grounded answers. Fixed goal-host `559a55d`. Bad test goals named non-existent files.

**reconciliation-live-and-walktier-stripped (08-04)** [write-read-mismatch, endpoint-routing, trace-store-db]
- Discovery advertises goalExecutionPath at hub-loopback 127.0.0.1:18401 (law-11 bug). Auth scheme differs per route (Bearer vs ApiKey). Hub /health reports surrealdb unhealthy while queries work.
- recordGoalPath never sent plan set → 998/1000 expected null; substrate landed its own fix; operator delta `4be4f36`. walk_tier stored but STRIPPED by Zod response schema (`8351780`) → reuse actually ~55% learned_pathway among derivation walks (reversed verdict). 23 timestamp sites serialized as `{}` (4421/4421 rows) fixed `de6b409` — blocked gap latency metric. Adversarial verify refuted 18/20 findings. host-pull-sync runs tests as detector not gate.

**repairs-not-gaps-lifecycle-and-the-lying-rate (08-05)** [write-read-mismatch, selection-learning, dormant-mechanism, codebase-bloat-fossils]
- Operator: "Filing gaps is not sufficient, only repairs … purpose of the system is to write resolvers usable for general purposes by changing the activity and the threaded impulse data from the shape set."
- `success_rate` is a LYING field: 398 templates success_rate 0 with successes>0 (validator-dispatch 67,855 successes). Sweep retired 21 working arms; restored via `7947f79` (retired clearable). `348053d` resolver_schema in dev-vessel (contract publication; 08-03 note said owed). `8b76d56` deprecation set `deprecated` but selection filters on `retired` (documented lifecycle never removed losers). light-dispatch ghost sweep POSTed to non-existent route, never retired anything (`7f3a81f`→`66b95e1`). `6e049cc` named-shape route. Templates listing clamps limit to 100 silently. 16 genuinely-dead arms retired.

**resource-detectors-calibrated-to-miss (09-01)** [dormant-mechanism, env-gating, docs-drift]
- systemLoadReport fires at loadavg >2x cores (32; actual ~6); db_contention_observer p95>2000ms/err>5% vs incident 1875ms/3.1%. Static constants at process start (law 1). `behaviorBaseline` specced (openspec 2026-05-31 fleet federation R1.4.2), implemented nowhere. `trace_store_health_observer` is the one worked example. `store-pressure-invisible-to-sensing-2026-07-13` filed 6 weeks earlier; recurrence is the finding. `openspec/changes/2026-05-31-detect-resource-budget-violation` cited 4x and does not exist.

**retry-forks-a-new-gap (08-10)** [narrowing-duplicates, gap-content]
- 421 gaps; 89 derived children (21%) close 4/89 (4%) vs originals 98/332 (30%). Worst fan-out 15 children (route-edit-060857b4:3); `feature-compose-has-no-concurrency-cap` 8 attempts, 12 children, 0 closures. Children inherit summary frozen at first filing. "A retry that forks is not a retry." Failure moved from anchor_not_found to syntax_break (TS1472/TS1005). Regex over prose is not an index.

**reuse-donors-96pct-one-shape-lexical-rebind-dead (08-10)** [composition-crystallization]
- 635/661 cached donors shellResult; rebind 0 fires in 12h; scaffold ratio 0.00–0.15 vs threshold 0.15 (0/112 above). Threshold already lowered 0.5→0.25→0.15; refuse third lowering. Refusal tally `7b3e308` made it answerable.

**reuse-gate-transition-proven-and-backfill-hazard (07-26)** [composition-crystallization, codebase-bloat-fossils]
- A/B twins prove bindable input_shapes=[] passes feasibleProducer; 383 of 472 composite templates LEAKED (dead-on-reuse). Bulk re-POST would wipe metadata.goalSignature (UPSERT CONTENT full replace) → need surgical reconciler activity. Probe twins left as junk.

### Batch E (files 67-75)

**reuse-grows-and-the-8s-timeout-monoculture (08-08)** [node-locality, endpoint-routing, composition-crystallization, trace-store-db]
- PRODUCER_DISCOVERY_ENDPOINT = hub; discover-by-shapes 55–77s vs 8s timeout + fail-open null → "no producer" while 2 exist; reached-command cache 98.5% shellResult. 68% of goal-path writes dropped (15s timeout + empty catch). Law: a lookup that failed must ABSTAIN not report absence.
- Reuse growth pre-registered: 0/5 before donor, 10/10 after (Fisher p=0.00033); transfer to unseen file/field. "Reuse growth is gated on a family's FIRST REACH." After hub fix: discover 0.17–0.25s, write loss 13%, REUSE-BEFORE-DERIVE alive; system reuse 0.21%→5.54% (z=15.2). walk_tier learned_pathway 26.7% → 93% substring bug, genuine 1.8%. File-writing goals never terminalize (6/9 hang >600s, p=9.3e-05). Handlebars template written verbatim to disk. Concept recall severed 100% on spoke. 7 gaps filed.

**reuse-is-real-verifier-certifies-partial-answers (08-06)** [composition-crystallization, false-verification, federation-p2p, endpoint-routing]
- Cross-family reuse (git commits via shellResult arm) and 2-step compositional reuse (6 execs α7) proven; operator's "composition never recorded" was a ranked-window artifact (`?limit=400`), `f84a7d9` inert else-branch (repeats predicate). Instrumentation `36e9612`,`3913d4a7` localized the reader, not writer.
- Verifier certifies the sub-goal the builder chose (winner+difference for "and combined total") — `d7e58d6` declines. Detector: N conjuncts vs evidence mentions. Paraphrase fragmentation (class hash on surface form). Ribosome depth-bound already self-authored by substrate (`extractionPolicy` impulse), but extractionPolicy has NO producer (1,374 fallback warnings/6h → hardcoded literal). Pinned transport target-less `/egress/resolve?vessel=` lands on obsidian sidecar (502). Exemplar file bound as edit target (law 13). Concept usage recorder pinned `CONCEPT_DB_ENDPOINT=127.0.0.1:8260` on spoke where masked; development-vessel squats `concept_usage_record`. concept_write fallback reports primary's error. Retractions: 67% duplicates → 13%; "58% unregistered resolver" → 20 failures/24h.

**ribosome-compounding-fix-and-cheap-path-deploy (07-31)** [composition-crystallization, sync-deploy-drift, dormant-mechanism]
- mintReachedTrace stamped `lifecycle.status="success"` vs ribosome-extract hard gate `status==='completed'` → ELIGIBLE_FALSE → ~0 extraction (1/1000 templates ribosome-earned). Fix `f88ba8f`.
- draft-gap-closing-activity 4546 failed/0 success (dispatched bare, fs_read of literal `{{report_path}}`); substrate fix `966c7a3` LANDED BUT INERT because `seed-templates` is SEED-IF-EMPTY no-op; only deploy path for DB-seeded templates is runtime `activityTemplate_update`. Audit: gap close 65% flat, backlog 270→289, honest reach ~21%, capability grows as DECLARED stubs (gap-closing:* 63.6%, ribosome 0.1%, auto-promote promoted=0) — law-4 violation.

**ribosome-deadgate-three-layer-root (07-23)** [composition-crystallization, endpoint-routing]
- Ribosome fired 0x in 25,862 execution_completed events. Substrate-authored `ff292c6` fixed field nesting (`msg.data`) → gate fires. Next: dispatchRibosomeExtract POSTs directly to activity-api → `use_vessel_discovery` 220 + auth 40 → zero dispatches. applyExtraction defaults FALSE (shadow). Only 2 earned templates vs thousands declared.

**ribosome-extraction-verified (08-25)** [composition-crystallization]
- 7-task pipeline; 436 learned-* of 3866 activities; 112 with `{{}}`; 43 hollow (legacy). Binds impulse data but bakes config literals (holder, ttl_ms) → weak input generalization. Lifetime 14,303 executions (67% on two compositions) vs live 16 learned execs/24h. Large fraction of executions UNGRADABLE → never extraction fuel. Near-miss reuse test not yet run.

**ribosome-goalsignature-consumer-and-two-deploy-gaps (07-25)** [sync-deploy-drift]
- `6bf628b` goalSignature stamp in synthesize_template (LLM-transcribed, unconfirmed). Detached-HEAD submodule push silent no-op; pull-sync content_hash only `*.ts` → .json template edits undeployable (fixed `967e3d6e`); fan-out rollback src/dist skew (`53e81301`). Guardrail: reading /proc environ for DB creds blocked (note: the 08-25 note later did read creds from /proc/<pid>/environ — inconsistent practice).

**ribosome-replay-dead-on-a-15s-timeout (08-03)** [trace-store-db, composition-crystallization]
- replay-observer historical backfill 760/771 fetch fails (98.6%) — 15s timeout vs 15.4–16.9s unindexed scan over ~143k rows; raised to 60s; index build 94s with write conflict → out-of-band materialization owed. Reach attestation 5.5h: 21 reached, 7 sha-attested, 14 LLM-only; `129a35fa` reached:true with null reason. 25 audit claims, 23 refuted.

**route-as-data-dispatcher-and-new-class (07-31)** [composition-crystallization, false-verification]
- `ef5c645` resolveClassRow data-driven dispatcher; new class countBelowMean as pure data (79+174=253 cross-check). Autonomous `5839489` closed semantic-gate-callgraph-narrowed gap cleanly. Mitosis gate runs typecheck not tests → autonomous new selector could drift shell≠js; need golden test at gate.

**route-as-data-foundation-plus-drift-fix (07-31)** [autonomous-regression, sync-deploy-drift]
- Live /vessels goal-host index.ts drifted (duplicate walkTerminationReason) — patch-with-tools edits live source; LLM-exhaustion terminal returned after an edit without reset. `fd701d9` multi-file snapshots + try/finally restoreAllSnapshots. Stale authoring-inflight markers (2 days) wedged pull-sync (gap filed). `e8caa37` route-as-data foundation: SELECTORS colocate shell+js (cannot drift); golden test 35 assertions; `if (import.meta.main)` boot guard.

---

## Cross-file index by problem-class key (recurrences aligned)

### write-read-mismatch (the most recurrent class in this shard — at least 14 distinct instances)
- 07-24 trigger field fixed in 2 serializers; panel read the 3rd (fleetActivityFeed) — `987cb7b`.
- 07-24 alphaBetaDelta array read as object (3ac0845).
- 07-25 composite template inputShapes = walk impulse ids; trace sink dropped canonical shapes (`27cc619`).
- 07-27/28 oracle-label consumer only on GET /executions, not goalWalkState (`d9dc600`, `3cd7019`); once-flag latch set before fetch.
- 07-28 rawResolve wrapped `{impulse:{pointer}}` while llm-resolver reads top-level `prompt` (`cd1127d`); gateway drops top-level prompt (07-29).
- 07-23 federated envelope `{content:{value}}` vs string/array parser (`da08516`).
- 08-02 task status 'completed' declared vs 'success' written (`98ac098`); 07-31 lifecycle.status 'success' vs gate 'completed' (`f88ba8f`).
- 08-03 write shapes resolved bare; resolver_schema asked but not served (`f57fd03`, `348053d`).
- 08-04 walk_tier/inference_confidence stripped by Zod response schema (`8351780`); timestamps serialized `{}` at 23 sites (`de6b409`).
- 08-05 deprecate sets `deprecated`; selection reads `retired` (`8b76d56`).
- 08-05 trace-archive fallback keyed dispatchId vs store keyed executionId (`90506ea`).
- 08-06 `successful_executions` stripped by RecommendedPathSchema (`48bc174`).
- 08-17 ψ: `state_signature`/`expected_output_shapes` sent, `signature`/`completion_shapes` read — 6 call sites.
- 08-23 pending derived from git; operator wrote metadata nothing reads. uiQuestion_write has producers, uiQuestion read has none.
- 08-25 oracle corpus written, no runtime reader; 8 duplicate switch arms.
Root: no contract conformance test between writer and reader; each fixed per-instance. Principle surfaced repeatedly: "a field is only load-bearing if it survives serialization"; "a field written and stored but unreadable is indistinguishable from one never written".

### false-verification (second most recurrent)
- 07-20 negative controls reached 3/3 (gate re-framed to trivial target). 07-23 Fib(12)=55 certified. 07-24 partial-coverage reach (satisfier short-circuit) certified. 07-25 reframe-to-raw hollow green (`e9039cb`). 07-28 bare-digit match against digest (`ec3bdf9`). 07-31 oracle clone drift inflated denominators; 08-05 oracle counted stale submodule (`d833cdc`) — "detector fires then rationalizes". 08-05/07 self-confirming oracle in 4 dimensions (scope, filter, tree, sub-goal). 08-06 bag-of-integers compare, overclaiming verdict string, legacy-success fail-open 38% (`cfb455e`). 08-07 cold-family 90% reach / 29% correct → `57cd2c3` no-oracle-for-goal-class. 08-10 floor only plane answering; ungrounded-reach detector wired only to learner. 08-11 four landings wrong, 0 caught by gates; semantic judge fabricated rationale. 08-24 flaky pre-cutover gate false-blocks. 08-25 LLM-judge labels in "ground truth" corpus (guard commented out). 09-02 reach defined on 3.8% of executions. 09-28 post-land suite ran=false for a month.
- Outcome pattern: each fix made verification stricter in one dimension; the next found a new dimension. Only durable pattern: deterministic verdicts + explicit "no oracle" (ungraded) instead of LLM judge.

### sync-deploy-drift
- 07-13 obsidian bundle never rebuilt. 07-25 content_hash only .ts; detached-HEAD push no-op. 07-28 local clone 131 behind. 07-29 mitosis lock orphan freezes pull-sync. 07-31 pull-sync `checkout || true` on dirty tree (`cdee05bc`, image-baked); stale authoring markers; submodule oracle worktrees detached (`d1bc9ab7`). 08-02 source template fixes don't deploy (seed-if-empty). 08-05 systemd units image-baked (drop-in in git absent in container); change_window lease leak = bootstrap deadlock. 08-06 unpushed substrate commit froze goal-host deploy 6h. 08-08 masked-vessel starvation; pull-sync not in its own convergence list; in-flight guard never evaluated (`cb5b0b24`). 08-08 restart never exercised (secrets truncation, identity churn). 08-24 flaky test gate silent refusal. 09-24 landing silently reverted newer work (6ab8271).
- Recurring root: four copies (origin/dev, clone, mirror /vessels, running process) + image-baked glue; convergence failures are silent.

### autonomous-regression / directed-overshoot
- Autonomous: `bd21771`/`5b1959a` earlyFileMatch mangled 3x; patch-with-tools truncated live index.ts 9386→213; `9a019a0` hollow shellResult resolver live; `d96e2ae` infinite loop; `bc0ba3f3` deleted log; `2dbb4a6` reverted newer work; `067b3f46` wrong invariant; `d65f8bd` narrowed instrument; live mirror corruption 08-05; `6ab8271` silent revert 09-24; synonym treadmill route-edit-a95b959a.
- Directed/operator: `f38f1a3` bun install pruned shared node_modules (08-10); `2504fb0` answer-only grading over-corrected reach 92→33; 5 inert fixes of 17 (08-11); `f84a7d9` inert else-branch; wrong escalations (08-17); retirement sweep retired 21 working arms via lying success_rate (08-05); `4c2d56c` clone-authoritative removed drift abstention exposing bare-digit bug.

### selection-learning
- Multiplicative posteriors (`6f19696` mig 186); satisfier ungradable 78% (`2fdd71e`); ribosome-extract 1051 fails with α 8.5; 1612 β / 0 α ratchet (`ec243fd`); satisfier:* graded but steer nothing (domain mismatch); never-reached paths recommended (`4cfef87`); cts CREATE COALESCE parse fail (`514f25b`); validator-dispatch posterior 0.205 vs empirical 0.952 (no marginal attribution); distinct_means 1; one orphan arm 96.8% of β; auto-minted 0.05–0.14 vs seeded 0.54–0.92; walk_tier substring heuristic; spoke cannot steer selection; approach feedback not built.

### composition-crystallization
- Ribosome: WS counter gate (08-02), field nesting (07-23 `ff292c6`), direct activity-api dispatch refused (07-23), lifecycle status vocab (07-31 `f88ba8f`), qualityEligible gate (08-02 `079c160`), replay 15s timeout (08-03), unbindable composites 383/472 (07-25/26), config literals baked (08-25), ungradable fuel.
- Reuse: satisfier short-circuit starves reuse (07-24); Zod strip (08-06); recommendReachingPath one call site (recovery only, 34% of traffic); donor concentration 109/120 one donor; lexical rebind 0/112 above threshold; 8s timeout monoculture (98.5% shellResult); reuse growth proven 0/5→10/10; route-as-data ClassRows.

### goal-walk-floor
- Federated envelope parse (07-23), env-gated floor (07-27 `559a55d`), satisfierTried blacklist (07-27 `a1e9c12`), prose route gated on unadvertised shape (07-28 `7721fe8`), EXPLANATORY_RE vs isQuestionGoal divergence (`5153704`), panel pinned whole vocabulary (07-25 `44c6563`), 0-step deaths on bare write shapes (08-03), nine layers pathless goals (08-11), non-FS only floor answers (08-10), write goals never terminalize (08-08), target inference [] for report/convert goals (no shape exists), walk reach 7.1% (09-02).

### node-locality / federation-p2p / endpoint-routing
- Per-goal-host in-memory state routed to first owner (07-29); discovery forward never dials libp2p rows; hub-loopback addresses advertised (08-04); fleetActivityFeed single-substrate (07-15); transport mirrors LOCAL→HUB only; hardcoded `?vessel=llm-resolver-vessel` in 3 consumers; stale ingress pin (07-20); stale secrets file 401 (07-24); PRODUCER_DISCOVERY_ENDPOINT/ACTIVITY_API_ENDPOINT → hub (08-08, 08-17) making every walk depend on a saturated/partially-down hub; masked concept-db on spoke → lesson channel severed 100% (08-05, 08-08); CONCEPT_DB_ENDPOINT pinned loopback; label write routed to hub while reader reads local (07-27); FED_SUBSTRATE_ID churn.

### human-surface-escalation
- 248-class precursor: uiQuestion read shape has no producer (08-23); obsidian-desktop crash-loop 58,875x (07-29); intake timers against absent backend; many obsidian panel fixes (07-15→08-05); note-driven loop missing producer; approach feedback stage B not built; CSS needs full app reload; plugin not self-updating.

### narrowing-duplicates
- Recommit fractal (12e7611 cap); derived children close 4% vs originals 30% (08-10); age-immune source reopen (07-29); variant sprawl 15+ producers (08-25); duplicate label switch arms; retry label collision; `-narrowed` children.

### dormant-mechanism
- resolver_schema only in concept-db (08-03); ribosome-vessel path dead (07-24); pool Thompson ranking stubbed degraded:true; behaviorBaseline specced not implemented; detectors calibrated to miss (09-01); approach_feedback designed not built; applyExtraction default false; VLLM providers env-inert; extractionPolicy no producer; organs ribosome/analysis/stateful-ui/light-dispatch zero walk calls; decision_outcome read by nothing that recalibrates; post-land suite dead a month.

### env-gating
- LLM_VESSEL_ENDPOINT gated floor; VLLM_* unset; PEER_DISCOVERY_ENDPOINTS positional env; resource thresholds static constants; tuning params fall back to env when DB dead; COMPOSE_DRAIN_MIN_INTERVAL_MS env-tunable landed (2156d21) — env knob added by the loop itself; secrets EnvironmentFile ordering.

### test-residue-live-state
- `https://activity.test` / `exec_test_1` durable in production store, retried every ~10s (08-17); probe twins `learned-composition-reuseproof-*-2607` left in activity table (07-26); probe labels in 100-window (07-31); operator probe dispatches contaminating measurement (08-05 "probe that saturates measures the probe").

### trace-store-db
- Multiplicative saturation int64; COALESCE non-function; math::min one array; no param interpolation in record-id; SCHEMAFULL silently drops undeclared fields (walk_tier mig 181, labeler mig 183); composition edges read dead `activity_execution_traces` (frozen ~1998 rows); unindexed success=true scan 15-17s over 143k rows; hub surreal 360% CPU; /health misreports; ranked windows; limit clamp 100.

### codebase-bloat-fossils
- Confab-era cruft files in clones (`successful-cutover-*.ts`, `card-price-data.ts`, `ping-response.ts`); 8 duplicate switch arms; six copies of extension parse; 4 cosmetic-clone llm resolvers; llm-router correct but other consumers diverge; ribosome-vessel dead path vs mintReachedTrace; 383 leaked composite templates; orphan arm; 43 hollow learned templates; libp2p-federation-transport sidecar.ts unrun npm pkg vs federation-sidecar.ts; `f84a7d9` inert branch to revert; obsidian Dispatches notes unpruned.

### docs-drift
- openspec detect-resource-budget-violation cited 4x, does not exist; SUBSTRATE_AS_MDP §2.2 already answered ψ blend question (docs ahead of code); behaviorBaseline spec unimplemented; README raw docker run path broken (SUBSTRATE_ROOT unbound).

### gap-content
- Stale gap already fixed manufactures hollow work (bc0ba3f3); spec builder schematic anchors; children inherit frozen summary; phantom reach-gaps during outage (105); fileCapabilityGap confab storm (~44 false); gap without measurement predicate enters PENDING forever; fileReachabilityGap skip regex omits source_code.

### spend-envelope-throughput
- change_window lease 10-min TTL for 1-min work; compose slot race voiding directed reservation; dev-vessel restart kills 5-8 min composes; dispatch registry capped ~100/50; hub saturation 55–77s; 68% path writes dropped under load.

### memory-recall
- concept-db lesson channel severed on spoke (fallback jsonl; `[walk-concepts] consult failed`); oracle corpus teaches no runtime reader; compose_lessons posted but drafter obeys spec over lesson.

### calibration-seal — not directly present in this shard (only related: pending-verification from git blocks forever).

---

## Mechanisms (status as recorded in these notes; "now" = as of note date unless stated)

- Deterministic ClassRow / SELECTORS route-as-data (goal-host `e8caa37`, `ef5c645`) — GENERAL at reach-grading seam; live-used 07-31; colocated shell+js prevents drift; golden test not run by mitosis gate.
- Exact-edit block format `Apply exactly these N edits` / `EDIT n old:/new:` (dev-vessel `f70160f`, value-per-cost 2.7) — GENERAL landing seam; live-used 09-24→27; bypasses LLM planner.
- Pre-validated landed-diff check (operator practice, 09-24) — operator-only, not a substrate activity.
- `mintReachedTrace` reach→mint (goal-host ~:3340) — live path for extraction; `ribosome-vessel` WS path dead/duplicate.
- ribosome-extract 7-task activity + extractionPolicy impulse — live but starved by ungradable executions; extractionPolicy has no producer (fallback literal).
- replay-observer historical backfill — broken 98.6% (08-03), timeout raised to 60s; index owed.
- satisfier lazy admission (`2fdd71e`) — specific; unobserved firing at time.
- resolver_schema contract negotiation — goal-host asks; concept-db and (after `348053d`) dev-vessel serve; general seam.
- `recommendReachingPath` + nearby-match shape-signature arm (`48bc174`) — only in recovery loop (1 call site), partial.
- tryLexicalRebind (LCS scaffold ≥0.15 + literal gate) — live but 0 fires where rich (08-10); reached-command cache 98.5% shellResult.
- universalToolFallback (ReAct floor) — general; revived `559a55d`, persisted as gradable execution `8ee6c66`; the only plane answering non-FS work (08-10).
- partial-coverage guard + composition-preference probe (`6d64e62`) — live.
- `deterministic:no-oracle-for-goal-class` ungraded refusal (`57cd2c3`) — general honesty seam.
- reach-classify `classifyReach` (untagged success ⇒ ungraded, `cfb455e`; telemetry ungraded).
- land→close credit via `pending_outcome_verification` + `sweepPendingLandVerifications` (`10e10e9`,`ff04a17`) — live; fails open on unknown; post-land suite dead 08-31→09-28.
- `landedCommitVerdict` pending-from-git — live; no revert path in the substrate.
- constantReturnStub/detectNewCapabilityStub gate (`3641a1b`) — wired into feature-compose and apply-proposal; false-positive on call+ternary (09-24).
- fs_write shrink guard (`af54cc8`, local-tools >90% guard) — load-bearing.
- patch-with-tools snapshots+finally (`fd701d9`), poisoned-baseline refuse <75% — specific; overlay isolation still owed.
- pull-sync: masked skip (`cb5b0b24`), dirty-clone reset (`cdee05bc`), json hash (`967e3d6e`), fan-out retry (`53e81301`), marker reap (`da80965d`), submodule update (`d1bc9ab7`), pre-cutover flaky test gate (false-blocks), change_window lease (leaks on self-cutover).
- mirror-to-live — shared deploy tool; recovery recipe.
- activityTemplate_update runtime impulse — only deploy path for DB-seeded template fixes.
- federation_join_health shaped emission on 401 (`aadb1c1c`) — class detector.
- llm-router.ts (willing×able Thompson, cascade) — correct reference; other consumers duplicate/diverge (feature-compose:1737, patch-with-tools:586, llm-completion-dispatch:182 name pins).
- isModelWilling (`b9b68d8`), patch-with-tools fallbackModels from discovery (`fd144a7`).
- compose_lessons in concept-db — channel severed on spoke; drafter obeys spec over lesson.
- groundedUniqueAnchor spec builder (`31fb735`), grounding hoist (`83bb498`), target-file-scope gate (`15c611e`).
- gap funnel instrument `open_persistent_fresh` (`9b2cbdc`, substrate-authored).
- WITHHELD alpha-credit instrument (`c84dbf9`), gate `ec243fd`, tightened `0eb3231`.
- Posterior time-decay with shaped half-life, mint dedup (`1b0c693`); boredom consecutive-failure debit (`0ccfadf`).
- systemLoadReport / load-aware boredom gate / db_contention_observer — built, calibrated to miss (static thresholds).
- trace_store_health_observer — the one worked detector→gap example.
- standing pool (`pool/standing.json`) — only gap-mirror records; pool Thompson ranking stubbed (dormant).
- Obsidian panel: self-explanation block, shape-flow DAG, grade panel, owner-merge sidecar, headless :27182 action surface — live on host plugin, manual build treadmill.
- validation/scripts/reach-generalization-harness.py; scripts/substrate/performance-status.ts; validatability harness — operator instruments, not substrate activities.
- `verification_spec` — never had a writer (fossil).
- Oracle corpus `goal_verification_labels` — write-only archive; polluted by LLM-judge labels.
- `decision_outcome` / `/decision-calibration` — read-only, nothing recalibrates.
- approach_feedback_scores — designed, not built.

---

## Principles / laws stated in these notes (with source note)

1. A TS union no writer enforces is a comment, not a constraint. (multiplicative-posterior 08-02)
2. A template can fail 1000+ times and keep positive credit. (08-02)
3. When every gap fails the same way, suspect the environment, not the model; a gate on a shared resource must be evaluated against the SHARING. (verify-gate-pruned 08-10)
4. Measure pipeline stages independently against known-answer fixtures; a binary end-to-end criterion yields one bit per trial. (nine-layers 08-11)
5. `reached:true` + a landed sha is worth nothing without a diff read (0/4 correct). (08-11)
6. A single dispatch cannot establish a routing property; test pure routing functions directly, n≥3 for live. (08-11)
7. An execute-the-exports smoke gate is inert and unsafe; tractable version is a coverage requirement. (08-11)
8. A property nothing exercises is not a property the system has; freshness not presence. (nothing-restarts 08-08)
9. A lesson channel cannot override a wrong spec — the wrong anchor arrives AS the task. (no-hands-classrow 07-31)
10. Its input is poisoned, not learning broken; quote total_executions not α+β. (orphan arm 09-01)
11. Grade whether the artifact answers THIS goal, never its form; control the grader positive/negative/ECHO; pre-register. (non-FS 08-10)
12. A field is only load-bearing if it survives serialization. (Zod strip 08-06)
13. A right answer punished is worse than a wrong one credited; watch reached < correct. (08-06, 08-07)
14. `reached` grades the compute, not the artifact — read the artifact back by the id the goal named. (08-06)
15. Pending is a function of commit history; metadata is decoration; the revert is the operative act; substrate has no revert path. (08-23)
16. A detector that reports and continues is not a detector; failure paths misdirect — verify the named condition first. (poisoned-baseline 08-05)
17. "The cleanup is in a finally" is not proof of release when something can kill the process. (08-05)
18. Dispatch a batch then STOP so pull-sync converges. (08-05)
19. `is-active` cannot distinguish crashed from deliberately off; `is-enabled` can; skip unrun vessels entirely. (pull-sync-deadlock 08-08)
20. A guard must normalise the value it tests. (08-08)
21. Verify a deploy by reading the artifact that executes for content only new code contains; origin/dev, clone, mirror, process are four different things. (08-08)
22. A lesson learned in one place and not generalized — the same defect sat one function away. (08-08)
23. A check that reports "didn't run" as neutral decays silently — count ran=false rate. (post-land suite 09-28)
24. Look up the history of the mechanism that ACTUALLY ran before declaring what was always missing. (09-28)
25. Write the detector before believing the enumeration; getting it right in N-1 of N places is the recurring failure — one shared helper. (psi 08-17)
26. An exemption must be keyed on its payload, not skipped. (08-17)
27. Wiring an input is not enabling a behaviour. (08-17)
28. Separate time_connect from time_total; enumerate which dependencies are local before declaring external gating. (08-17)
29. A lookup that FAILED must ABSTAIN, not report absence. (8s timeout 08-08)
30. Reuse growth is gated on a family's FIRST REACH. (08-08)
31. Convergence without correctness is memorizing a bad habit; ~90% warm reach is a property of hand-written verifiers. (202 goals 08-07)
32. A measurement that cannot tell "I could not ask" from "it could not answer" manufactures the trend. (08-07)
33. A verifier that computes ground truth is not thereby enforcing it — check the CLAIM; verdict string must name the check that carried it. (08-06)
34. When an oracle agrees by construction, enumerate every shared parameter (scope, filter, tree, sub-goal). (stale submodule 08-05)
35. A detector that fires then rationalizes is worse than no detector. (08-05)
36. Golden tests can pin the defect. (08-05)
37. A pre-registered threshold assumes a stable population; intervening inside the window makes the test unjudgeable, not falsified; count at the ONE site that fires once per event. (09-02)
38. Always split the window at the intervention. (09-02)
39. A written, stored but unreadable field is indistinguishable from one never written; never conclude "never fires" when only success path logs. (08-04)
40. Verify a DB is down with a QUERY, not /health; ranked windows are not recency. (08-04)
41. Always adversarially verify; first-pass findings are usually wrong (18/20, 23/25 refuted). (08-04, 08-03)
42. Verify every field a decision READS, not just its path/coverage/outcome; bound coverage by the RESPONSE not the request; defaults are policy. (lying success_rate 08-05)
43. A retry that forks is not a retry — enrich the existing gap; a regex over free text is not an index. (08-10)
44. Detectors catch a cliff; sustained degradation is a plateau; static thresholds violate law 1; recurrence is the finding. (09-01)
45. Landed source template fixes don't deploy via seed/restart — mutate the live row. (07-31)
46. An `else if` that repeats the predicate it compensates for cannot compensate. (08-06)
47. Measure a mechanism from the error string the mechanism itself emits, not by set-differencing registries. (08-06)
48. When writer-side instruments come back clean, suspect the query next. (08-06)
49. A green, typechecking, plausible self-edit can degrade an OBSERVABILITY surface — read every autonomous diff. (08-03)
50. Pick one of "open α" or "withhold β" deliberately; doing both is incoherent. (08-03)
51. Dump, then grep; don't trust compound `journalctl --grep`; rg when grep returns empty. (08-03, 09-02)
52. Honest reach ceiling = advertised-capacity fraction; never fake reach during outage. (07-27)
53. Reach must not β-penalise the arm (double count, law 12); keep reach and approach orthogonal. (07-27)
54. A cause that explains the symptom is not thereby the cause. (08-17)
55. Independent-oracle content checks must match a distinctive token tied to the producer, never a bare small integer. (07-28)
56. available_shapes (what can be produced) ≠ expected_output_shapes (what this goal should produce) — law 13. (07-25)
57. "0-of-X mechanism" bugs have layered roots; read-in-repo vs observed-live contradiction is the signal. (07-23)
58. Colour reserved for status; inline paint + WAAPI survives JS-only reload. (panel 07-25)
59. Trace which SHAPE a consumer actually fetches — do not assume. (07-24)
60. When a substrate edit goal needs a template literal, use concatenation; single-line replacement lands; one site per goal; ASCII; no `{{…}}`. (08-03, 09-24)
61. Operator mandate: "Filing gaps is not sufficient, only repairs … the purpose of the system is to write resolvers that can be used for general purposes by changing the activity and the threaded impulse data from the shape set." (08-05)
62. "I have the same failure mode as the system I am repairing": building something correct and not connecting it to the case at hand. (08-11)

## Honest meta-observation for the realignment
The shard shows the user's complaint concretely: write-read-mismatch was "fixed" ≥14 times as separate instances (serializer, Zod strip, key near-miss, status vocab, deprecated vs retired, consumer on one endpoint) with no shared contract-conformance mechanism; false-verification was tightened along ≥6 axes one at a time; deploy drift re-appeared through ≥10 different doors (image-baked scripts, units, markers, leases, masked units, submodules, seed-if-empty, detached HEAD, flaky gate). Each note typically ends "filed gap, class fix owed" — the class fixes (contract conformance, envelope normalisation at egress, overlay isolation, resolver_schema everywhere, measurement predicates, revert path, per-test flake quarantine) are the durable asks that recur unimplemented.
