# memory-10 — operator memory cache, notes 676-750 (74 files)

Source: `/home/avi/.claude/projects/-home-avi-documents-work-substrate/memory/*.md | sort | sed -n '676,750p'`.
Per-note extraction (chronological order within the shard is alphabetical; dates in the titles). Grouped index by problem-class at the end.

## Per-note extraction

### 1. the-repair-path-discards-the-verbatim-anchor (2026-09-12)
- keys: drafter-quality, write-read-mismatch, hollow-landing, narrowing-duplicates, false-verification
- Attempt: operator claimed authoring reach capped by LLM credentials (447 exhaustion events/6h). Refuted n=3: prose -> apply_failed; prose+file -> no_unique_anchor (31x in 1.1MB file); verbatim once-only anchor -> LANDED b97e2d0. Outcome: retraction; the blocker was internal (information).
- Defect: local-tools-vessel/src/index.ts:333 fs_edit returns "closest real text ... VERBATIM"; feature-compose.ts blind-edit repair discarded it, dumped whole file. anchor_not_from_window 46/24h (largest refusal class), semantic_reject 30, no_unique_anchor 8. Sibling path safeAnchorLines() already did indexed-choice anchors ("fixed one call site, missed the sibling").
- Fix: 62da19fa hint interpolated before full-file dump (worked, verified git==runtime, 4->1 observable). But Substrate Autonomous landed bbae436/a23e1b8/81c08ea via mitosis — operator's replacement contained its own anchor -> NON-IDEMPOTENT unbounded growth 1->2->3 copies; closing parent gap didn't stop it (grew 3->4) because 5 carriers (recommit-*-anchor_not_found, -narrowed, route-edit-*) held the intent. grep -c counted lines not matches -> pre-registered observable read 1 while corrupted.
- Guard adopted: dispatch builder asserts `anchor not in repl` and no backslash (channel eats backslashes).
- 260 compose reports/24h: 60 cleanly applied patches rolled back by semantic gate vs 49 FAVORABLE; sampling 5, 4-5 rejections SOUND (hollow write-only additions). Gate = immune system. Real narrow defect filed: `the-semantic-gate-structurally-disfavours-information-availability-fixes` (prompt-content changes have no deterministic observable).
- Two-non-contiguous-edits hazard (declared var never used). Free-text operator goal fails semantic gate for "no gap context"; dispatch became fresh route-edit-* gap instead of binding to filed gap.
- A dispatch reporting rolled_back is not proof work didn't land. By-id gap read returned empty after "updated"; open-gap list truncated at exactly 400 rows.

### 2. the-repair-path-wrote-a-url-prompt-over-its-own-source (2026-08-12)
- keys: autonomous-regression, hollow-landing, dormant-mechanism, false-verification
- feature-compose.ts repairCreatedFile passed a producer URL as prompt (llmCall(FEATURE_COMPOSE_ENDPOINT, llmEndpointNew, model, false)) and wrote reply over file: 8 firings, 160 bytes over ~190KB compose resolver (catastrophic truncation from inside pipeline). Explains 'compose prepended hallucinated file' and 'failed compose truncated registry-vessel' incidents.
- Guard was absolute (body.length<8); fixed truncatingRewriteReason(before,after) in vacuous-edit.ts refusing whole-file write <50% original, one-sided — landed 92505c5.
- But path was ALREADY DEAD: substrate-authored 9972ecd (08-06) added produceFeatureCompose param that threw for false inside swallowed catch — 0 firings after, 1567 composes. "The destructive writes stopped because the path DIED, not because it was fixed."
- fs_write advertised by BOTH development-vessel and local-tools-vessel; truncation guard lived only on one -> now both. "A guard living with one producer of a shape is a coin flip."
- 37e584a (substrate) closed orphan-detector gap by adding an unused optional interface field activity_task_field; vacuousEditReason's stripTypeOnly only strips as/satisfies. Gap closed reopen_count 0; reopened by hand.
- 29d9b85 replaced file:../ias-executor-ts dep with "0.1.0" -> 404; recurring (previously reverted once). Nothing checks a changed dependency resolves.
- 67 substrate commits in 3 days, ~1 in 5 reverted; gates screen shapes of edit, not wrongness.

### 3. the-resolve-url-joiner-overshot (2026-09-22)
- keys: endpoint-routing, directed-overshoot, goal-walk-floor, write-read-mismatch
- goal-host index.ts:380 asResolvePath now returns ABSOLUTE url; rawResolve (:7470) and :6977, :8946, :12033, :12609 still prepend endpoint -> "http://127.0.0.1:18230http://localhost:8230/resolve" -> Invalid URL -> rawResolve null -> "no producer". Kills ReAct floor: llm_completion :8220, web_search/shellResult :8230, human-surface :8310 (absolute rows); relative rows (activity-api, dev-vessel, stateful-ui) unaffected -> invisible in aggregate.
- Surfaced by a human asking "What is happening in the world today?" -> 3 dispatches reached:false, goalReachReason null. Supersedes older asResolvePath note. Law: grep every call site; one named joiner over N concatenations.

### 4. there-was-no-collapse: operator specs 80%, autonomous 1% (2026-09-13)
- keys: gap-content, drafter-quality, false-verification, narrowing-duplicates, selection-learning, docs-drift
- The "6x reach collapse" = operator dispatches leaving the denominator. Operator 12/15=80% vs autonomous 1/106=0.9%, then 4/154=2.6%. Autonomous code-edit 0/194 (185 top-of-file anchor, 9 near-edit-site). Operator commits: 0672a4e, 44caeaa, 3023712, 6b88096, 7792c3e, 0f47d8a, 700c70f, 9428719, bd851ec, 170c3d6, 206f055, f375f10.
- gap-to-feature.ts mis-grounding: line regex requires digits; named edit sites (`:/conservation-audit`) -> startLine 0 -> top-of-file window of 11,645-line file; silent fallback. Fixed 19bbb8b (named site feeds region), then tier-3 symbol localization e670b69 (ported goal-host verbatimExcerptBlock index.ts:11137; reuse). Grounding 2.4% -> 71-81%, FAVORABLE 0/9 -> 0/5 -> 0/16. Information placement falsified as the lever (pre-registered).
- A/B identical code: spec wording "takes precedence" -> semantic gate refused 2/2 (e4e05504); tiered spec -> landed e670b69 (e7d6bc8a).
- 88% of code-edit gaps name a bare file path, no location (324/368); 9.5% named site; 2.4% line number.
- Funnel 191 code-edit composes: 11.5% anchor/apply, 49.7% typecheck fail (51.6% syntax/truncation TS1005/TS1128; 41.1% invented symbols TS2304/TS2554/TS2305), ~36% semantic_reject, 0.5% FAVORABLE. Over-escaped-newline (0/130) and smart-quote hypotheses refuted; truncation fits.
- 2x2 over 517 autonomous composes: code-edit child 6/220 2.73%, first 3/144 2.08%; other work child 3/35, first 46/118 38.98%. Simpson's paradox nearly drove a lane-admission policy change.
- Root finding: substrate APPLIES specified change (80%) but cannot DERIVE change from problem (2.5%). Experiment: gap route-edit-62647d4c/-73ea7b5c claimed /conservation-audit registered twice — didn't exist; real duplicate /conservation-residual-trend lines 5901/5962. Pre-derived replace_lines dispatch 2ebdee6e -> landed 9c1d56a (-60 lines). Semantic gate had objected correctly.
- Family: one false-localized gap spawned 31 gaps (58 rows "registered TWICE", 30 open, 12 composes) via -narrowed/route-edit-*/recommit-* nesting. Gap text predicted anchor edits impossible; lane tried by anchor 12 times.
- Lever 1 landed 9f222fb: PREMISE WARNING in anchorLabel (drafter reads it). Then measured: fired on 0 autonomous composes -> near-inert non-lever; drafter ignored advisory prose 2/2.
- Live gap store `/workspace/git/super-repo/gaps/gaps.json` (14.6MB, 7110 gaps); `/workspace/gaps/gaps.json` stale 819-row decoy (WORKSPACE_ROOT trap, 3rd instance).
- Retracted: "anthropic 401 sets no cooldown" — it does, 151 times (1541 cooldowns/40h); journalctl captured wrong unit (llm-resolver-vessel vs llm-opus/llm-haiku; 4 llm units).
- model-policy.ts:113 unevidenced arm prior 1/1 outranks measured arms (should be hierarchical). llmQuotaState reports key-presence not reachability. Drafting effectively openrouter-only.
- a325ef1 put `directed` in compose report: operator 4/5=80%, autonomous 1/23=4.3% — self-served.
- Every quoted reach baseline (15-24%/day, 19%, ~24%) operator-contaminated. Seven refuted causes; six instrument traps (window start, log-presence dates instrument, renamed probe, graded= vs graded, host-local timezone -7h, wrong unit).

### 5. the-rhythm-registry-was-empty and the mirror froze the gates (2026-09-07)
- keys: dormant-mechanism, spend-envelope-throughput, sync-deploy-drift, write-read-mismatch, selection-learning
- poolImpulse timeShapedRhythm count 0: rhythm-conductor-tick, rhythm-reality-sync, compute-state-signature existed with nothing registered -> unbounded boredomtargettemplate tag selection; six auditors = 61.6% of all executions/day. "Autonomy proven" was autonomy UNBOUNDED.
- Seeded 13 rhythms + meta-rhythm rhythm-management (budget 0.05). due_score = credit_mean*staleness/budget; affordable iff budget <= 1-load/3. FAMILY_GOALS map rhythm-conductor-tick.ts:125; new families via poolImpulse_write shape=rhythmFamilyGoal. Verified fire->decay->yield; auditors 241/day -> 1 per 10 min. Queue at $HOME/.minibob/boredom-queue.json.
- Gate mirror /workspace/git/super-repo/repos/development-vessel 396 commits behind since 08-16 — pull-sync skipped submodules with dirty porcelain; 2494/2526 entries were untracked build artifacts; 33 tracked files corrupt (config.ts 766->3 lines). Fix --untracked-files=no in scripts/substrate/substrate-pull-sync.sh, 9333f0f7, docker cp'd.
- P0: goal-host reach-patch NOT ATTEMPTED for synthetic id (feature_compose:) because refusal wrapper discarded refusalId. POST /reach sole VPM grader; applyOutcomeToPosteriors removed (2x beta inflation). Fix landed.
- Retracted claim: slice(0,800) probe landed via escalation lane before the fix (27b3e60). Post-fix n=3 clean.

### 6. the-runpod-arm-unblocked-the-spoke (2026-08-10)
- keys: federation-p2p, spend-envelope-throughput, env-gating
- LLM plane on spoke "credit-dead" declared operator-only for hours; fix: wire existing RunPod serverless endpoint (key in substrate-utils/.env; endpoint id via RunPod API vllm-izzg68pl80jly7, Qwen/Qwen3-Coder-Next-FP8). Registry 71 -> 371 shapes, llm_completion re-advertised.
- DEFAULT_MODEL fell back to claude-sonnet-5 (dead) -> set LLM_DEFAULT_MODEL. "Adding an arm does not route traffic to it."
- Endpoint saturated: 3 workers vs uncapped fleet, failures 28->289; timeout->exhausted 30s->de-advertise->retry cycle (compose-storm shape). Lesson: test whether capability already provisioned before declaring external blocker.

### 7. the-scalar-renderer-was-unreachable (2026-09-21)
- keys: human-surface-escalation, dormant-mechanism
- Census 126 live pool impulses via production planContent: 35 (28%) short values drawn as code blocks; scalar reachable only via JSON wrapper/fromEnvelope. Fix as rescue of DEFAULT_CONTENT_FORM, never on truncated content: misroutes 35->0.
- Own errors caught by probes: policy_revision wrong half; origin "browser" vs "machine" marker. RenderPlan.decidedBy required -> cheapest non-vacuous gate.
- human-surface-vessel ui/ ships no test runner; server can't import @avigopal/design-tokens (vite alias into super-repo) -> crash-loop in image (law 11).

### 8. the-seals-escape-valve-asked-1755-times (2026-08-28)
- keys: calibration-seal, human-surface-escalation, write-read-mismatch, dormant-mechanism
- hopeless() category seal's designed escape = human decision; 1755 uiQuestion_write needs-human-<gapId> in 48h, 84 panels; readback DEAD (boredom familyShapes["human-interacting"] dispatched bare -> "no solicitation_ids"; scan read obsidian:interaction_episode keyed solicitation_ids, answers land in stateful-ui keyed panel_id; nothing in obsidian-vessel produces solicitation_ids). interactor-log uiFeedback_write.jsonl 48 records, 0 panel_id.
- Fixed 421052c (solicitation-outcome-scan self-supply + match by panel_id): 0->84 outcomes, answered 0->1. solicitationOutcomeReport had no consumer.
- Built escalation_disposition_apply 9cb83d0 (openspec/changes/2026-08-28-escalation-disposition-executor/); bounded exemption human_exemption_attempts_remaining=3, bumpFailedAttempts spends; idempotent on answer record id; hopeless_excluded 79->78.
- History: d1bb37a 06-30 seal "leaving a re-test path"; 143212a 08-06 hard exclusion removed 106 gaps, human = designed escape; no spec existed.
- Corrections: dated comment wins; don't feed operator closures into predictLand calibration (wrong evidence class).
- feature_compose silent no-op: planned unique anchors, applied, workspace byte-identical to HEAD. Gap filed 22:43 -> -narrowed clone by 22:49.
- LATER (2026-09-22, from index): escalations post to pinned :8270 (replaced vessel), 248 needs-human, 0 answered -> seal permanent again (recurrence).

### 9. the-self-development-pipeline-is-untraced (2026-08-29)
- keys: trace-store-db, selection-learning, composition-crystallization, dormant-mechanism
- 12h: 119 composes (fc-plan) vs feature_compose traced 5 ever; 191 cutovers vs vessel_mitosis_cutover 0; 579 gap picks vs gap_to_feature 0; apply_proposal_as_patch/patch_with_tools 0 — in 19,757-row trace history. Violates "every execution is traced", law 2.
- Costs: journalctl diagnosis; 3 wrong diagnoses from co-occurring log lines; Thompson can't grade compose strategies; failed_attempts hit 4 with no compose report -> narrowing duplicate outranks parent; escalation lane landed destructive change + 2 inert fragments + deadlocking 4-word deletion, untraced.
- Fix partial: 4afd4c1 (trace per compose), e8e3fec (cutover refusals via softRefuse chokepoint covering 51 paths, and landings). Verified count 5->6 with route gated|escalation, linked_to_gap. Still untraced: apply_proposal_as_patch, gap_to_feature, patch_with_tools. No templates; ribosome should extract (law 4), don't hand-mint.

### 10. the-self-repair-test-it-fixed-its-own-inert-commit-inertly (2026-09-02)
- keys: hollow-landing, drafter-quality, endpoint-routing, false-verification
- Repair of own inert commit 776391aa0f landed 62e66a7: removed dead exports.substrateGap.emit, but wrote wrong host (ACTIVITY_API_ENDPOINT vs DEV_VESSEL_ENDPOINT), path /v2/impulses/substrateGap (404) vs /v2/impulses/resolve, body {id,category} vs {impulse:{type:"substrateGap_write",...}} — four correct exemplars in same file (index.ts:4157,5187,5284,15167). try/catch around fetch never runs on 404 -> inert AND silent again. Live inert emitter on origin/dev.
- Nothing in pipeline resolves ROUTES or ENVELOPES (shape-vocabulary resolves names; CJS-in-ESM gate resolves module semantics). Next splice: route/envelope resolution gate.
- Coverage gate 4495163: 0 refusals, 4 FAVORABLE/0 UNFAVORABLE in ~60 min — but the only commit let through was the inert repair.

### 11. the-shape-vocabulary-measured-by-reach-contribution (2026-09-05)
- keys: selection-learning, dormant-mechanism, trace-store-db, false-verification
- First pass omitted completion_shapes column -> wrong claims (35 reached shapes vs 66; "floor records no shapes" wrong — already fixed 08-09 at goal-host index.ts:4903-4915). Rediscovered closed finding.
- Advertised vocabulary n=390: 66 positively defined (16.9%), 86 negatively (22.1%), 21 undefined, 217 (55.6%) never executed in 36,633 executions. By traffic 59.3% on positive shapes. commandResult 2276 appearances 0 reached 1722 failed; mitosisPendingState 2588 never graded.
- shape_definition table EMPTY (0 rows). 147 shapes execute unadvertised (incl. highest traffic): advertised and executing vocabularies disjoint. failurePatternReport typo shape (34 appearances, 0 reached). 591 reaches from 40 activities, top 10 = 92.9%; five shapes at 65 = one ribosome-extract pipeline. reached=true 1.6%, false 19.2%, NULL 79.2%.
- Registry contains free-text strings as shape names (393 vs 390). :18100/shapes returns discovery's own 4. Hyphenated literals in shell SurrealQL parse as subtraction.

### 12. the-spoke-has-been-shouting-into-a-decommissioned-relay (2026-08-10)
- keys: federation-p2p, env-gating, node-locality, trace-store-db, endpoint-routing
- 19-agent audit; 8 of 12 high/critical findings refuted. Hub syzygy.host/104.236.0.175 contributing (2.04M executions); spoke federation egress dark; old droplet 138.197.116.56 :30333 still accepts reservations (decoy).
- RELAY frozen at module load (let RELAY in federation-transport-server.ts) from /bootstrap while DNS pointed at old droplet; egressNoReservationCount 3705->3794; ~2038 egress failures/24h; llm_completion, concept, executionReplicationPull dark. Comment claimed law-1 compliance while code froze it.
- Clash 2: local discovery advertises activity-api-local 127.0.0.1:8080 confidence 1 first for executionTraces — 9-day-stale store (hub 2.04M vs local 1.55M executions, 400 divergent names). Role-selection drift: masked units active again.
- Clash 3: hub rows advertise 127.0.0.1 ports; PEER_FANOUT_MODE=union would dial own localhost; arms when transport restarted.
- Registry alias proliferation: shellResult 3 producers for one process. CPUQuota on tmpfs removed silently by restart. Git wedge fixed (containment accidental). discovery registered:false reports heartbeat loop running (mislabeled instrument). Docker desktop-linux VM (14 vCPU) vs host 16 cores — prior CPU analysis crossed machine boundary. Trace queries pathologically slow both nodes (limit=1 43s). GITHUB_TOKEN/SUBSTRATE_GIT_PAT readable in /proc/<pid>/environ.

### 13. the-spoke-registry-drained-to-zero because identity lives on the hub (2026-08-10)
- keys: federation-p2p, node-locality, endpoint-routing
- registry/stats 0 vessels (was 15/305): heartbeat & register 401 because identity-vessel (role control) not on spoke and hub down. Hub outage silently unregisters healthy spoke; /health all 200. Sending auth header to discovery read endpoint routed into unreachable validator (INVALID_API_KEY). substrate-doctor check 4 (REG_FLOOR) would catch — cadence unconfirmed.

### 14. the-stale-gap-threshold-sits-past-the-fleets-cadence (2026-08-10)
- keys: false-verification, gap-content, memory-recall (split store)
- Task #27 premise (2666 rows/462 open/274 stale) came from dead /workspace/gaps/gaps.json. Live: 245 gaps/184 open/stale_open 0. Threshold sweep 12h:67, 24h:48, 36h:25, 48h(default):0 — structurally incapable of firing. Left for operator decision.

### 15. the-substrate-asked-175-questions-and-got-3-answers (2026-09-14)
- keys: human-surface-escalation, calibration-seal, write-read-mismatch, gap-content, docs-drift
- solicitation_outcome_scan 175 solicitations, 3 answered; escalations were findings the operator then re-derived (auto-minted-child-gaps-monopolize..., failed-attempts-counts-dispatches..., verify-failure-reason-lists-only-passing-checks).
- Loop: hopeless() (>=8 attempts/0 lands) -> four verbs (gap-to-feature.ts:831) -> uiFeedback_write panel_id=needs-human-<gapId>, pointer.value = verb -> solicitation_outcome_scan -> escalation_disposition_apply bounded exemption. Traps: executor reads pointer.value (answer field no-op but marked answered); ordered verb regexes (\bcredential hijack grant_access); uiFeedback_write refuses without panel_id (was a generic floor satisfier: 48 records, 0 panel_id).
- operator_verdict in classification_metadata has NO consumer (archive). human_disposition is the field with teeth.
- reach-rate category error: success~1.0, reach 0 (mitosis-tick 0/471, concept-usage-backfill 0/129) = non-goal-bearing maintenance ticks; reach_rate_scan mints unfixable gaps consuming cap=1 lane.
- Operator side silent 16 days (last disposition 08-29). f169ab1 operator-escalation-backlog self-report gap. 4bffab0: panel store stale — 49 of 147 moot; filter to open gaps -> 94 unanswered/30 answered.
- docs-drift escalations: 60 of 66 path claims false positives (live_truth.existing_paths incomplete); 6 real stale (check-shape-dispatch.ts, generate-secrets.sh, init-database.ts, validate-security.sh).
- orphaned-capability 46 open; 38 carry impossible ratio "394/389" — numerator/denominator from different populations.
- Answering a verb is an UNSEAL (3 attempts each); restraint. Dispatch landing graded failed while on origin/dev.

### 16. the-substrate-cannot-land-a-change-to-what-the-operator-reads (2026-09-14)
- keys: hollow-landing, false-verification, gap-content, human-surface-escalation
- patch-with-tools.ts:1309-1320 zero_behaviour_delta gate (stripCommentsAndStrings) refused string-only changes (gap summaries, escalation text): 8e981f62, dac8d603 refused. Gate's evidence a336a75 (09-05: 12 comment-only insertions graded reached:true).
- Symmetric blind spot: 3a97d2f (substrate) reordered replace chain in gapClassKey — measured no-op over 1,839 gap ids — accepted.
- RESOLVED ede0030 (substrate-landed, operator-authorised): nested stripCommentsOnly exemption; tsc 0, 12/12 tests, 9/9 behavioural. Unblocks reach-gap PRODUCER: interpolation (goal-host reach-gap minter fetches producerId/producerInputs and discards them; 23 escalations).
- Substrate landed 5668929, 93c9baf to goal-host index.ts same day. Host lacks bun; container has it.

### 17. the-substrate-decomposed-a-hard-gap-and-landed-a-404-dependency (2026-08-10)
- keys: autonomous-regression, false-verification, gap-content, trace-store-db, endpoint-routing
- route-edit-b989e088:1 substrate-minted decomposition landed ddffdee on 5th attempt — replaced file:../ias-executor-ts with ^0.1.0 (E404). Reverted 956e464. feature-compose.ts:3042 verify runs bun install only if node_modules absent -> manifest never exercised. Filed compose-verify-never-installs-so-a-broken-manifest-passes. (Recurred 08-12 as 29d9b85.)
- Operator summary "file: specifier is CORRECT" -> gap auto-closed already_resolved in 8 min. Law: gap summary describes DEFECT, never correct state; editing a gap is a dispatch. Re-filed hub-verify-sandbox-does-not-materialise-sibling-file-deps.
- Closed record: failed_attempts 14, mispredicted_lands 7, semantic gate rejected correctly 13x; one escape landed.
- Hub activity-api restart windows (ActiveEnterTimestamp moved, NRestarts=0); substrate-gap events fire-and-forget lost; 36% transport failure rate Aug 1-8. draft-activity-from-pattern hardcodes http://127.0.0.1:8080 (masked on spokes).

### 18. the-substrate-fixed-the-lane-leak-i-filed (2026-08-12)
- keys: spend-envelope-throughput, gap-content
- 82125c9 (substrate, from -narrowed gap): operatorOrigin: trigger === "operator" (was undefined||run-goal||operator -> all unattributed dispatches took operator slot). Validated per-dispatch trigger read. Absent REFUSING DIRECTED log uninformative.
- Scope: autonomy from a SPECIFIC gap works; operator's pathless dispatch on same defect failed (drafter action=fail).

### 19. the-substrate-relanded-my-reverted-regression because the gap stayed open (2026-08-10)
- keys: narrowing-duplicates, hollow-landing, autonomous-regression, directed-overshoot, gap-content
- Operator f38f1a3 (unconditional bun install in compose verify) pruned shared node_modules, broke composes for hours; reverted b90d6c4. Substrate relanded byte-for-byte 0797af4 from compose-verify-never-installs-...-narrowed; reverted 49f4c06. "A revert does not remove the demand" — teach at the site (comment at call site + gap manifest-install-check-must-not-run-inside-a-compose-worktree).
- Wallpaper: 1bee107 comment-only diff (MAX_REPAIR comment) FAVORABLE for a concurrency-cap gap; vacuous-edit gate ignores comment churn by design.
- 3f861b6: preferredEndpoint?: string field set to "" in unrelated branch, never read, for discovery-loopback gap — semantic judge fooled by naming.
- Operator-built write-only-identifier gate broke 2 existing tests (org_id writes) -> reverted; write-only-ness not decidable from diff. Filed three-wallpaper-classes-land-favorable-write-only-field-is-the-worst.

### 20. the-substrate-self-filed-the-refusal-grading-gap; sovereignty contract (2026-09-16)
- keys: selection-learning, docs-drift, spend-envelope-throughput
- Gap a-principled-decline-is-graded-identically-to-incompetence... substrate_detected 10:45Z before operator dispatch (session leak not ruled out); first compose failed verify -> recommit child.
- e1d6af5c docs/architecture/SUBSTRATE_AS_SOVEREIGN.md (expectation not description); concept concept_aMRXW6-xSfnX (refusal_outcome_pattern).
- Dispatch 9f02d9c7 (outcome:declined tag) refused retryably: compose lane cap=1 full of autonomous work; goal_status showed bare "(running)" — refusal visible only in journalctl. concept-db :8260 timeouts in walks during congestion.

### 21. the-substrate-spends-99.6-percent-of-cycles-on-metabolism (2026-08-29)
- keys: spend-envelope-throughput, codebase-bloat-fossils, trace-store-db, goal-walk-floor, selection-learning
- 1392 executions/60min: validator-dispatch 737 (53%, duration 1ms, metadata null — unauditable), mitosis-tick 292, slot-binding 158, auth_resolve_v1 153, feature_compose 6 (0.4%). 499 gaps open, grew 1405->1507/day.
- /vessels 71 dirs, 49 development-vessel-mitosis-<ISO> clones; nothing GCs them (10 on 08-04). Newest held coherent 4-file work.
- Investigation walks failed on infrastructure: concept-db recall starved; executor ran curl with unquoted & (backgrounded) 7x byte-identical "self-correction". Honesty machinery worked (refused hollow, graded HOLLOW, beta withheld). 31beb122 picked shape-compatible wrong activity (detect-concept-db-drift for calibration seal): selection imprecision routing on shape alone. goal-seek:no-trace — walk produced no trace.

### 22. the-summary-guard-is-one-comparison-short (2026-09-05)
- keys: write-read-mismatch, false-verification, trace-store-db, gap-content
- substrate-gap.ts:795 guard only fires on absent summary; closing writes echo truncated goal text (strict prefix) -> summaries destroyed 4781->11 chars etc. Fix proposal: keep stored if incoming is prefix. Resolver is a chokepoint. source field rewritten to varied values.
- feature-compose apply failures: trace records only apply_failed/ops_applied count; detail lives in /workspace/proposals/<gap>-compose-report.json .applied[].detail — apply-failure classes unlearnable.
- no_unique_anchor refusal correct; goal-writing rule: never quote a non-unique line even as context.

### 23. the-surface-probes-/resolve on a vessel that serves /v2/impulses/resolve (2026-08-19)
- keys: endpoint-routing, human-surface-escalation, federation-p2p
- substrate-ui proxy.ts servesGoalShapes probes ${base}/resolve (lines 231, 433, 568) on federation ingress 127.0.0.1:8401 -> 404; /v2/impulses/resolve 200. Registered resolve_endpoint field ignored -> silent hardcode. 404 from ingress looks like dead circuit.

### 24. the-surface-starters-read-the-wrong-registry (2026-08-10, 97867d1d)
- keys: node-locality, endpoint-routing, human-surface-escalation
- starters derived from local registry (16 plumbing shapes) not hub (187). Fixed as UNION with per-leg fail-soft; resolve probe also local-then-fleet (else confident false negatives). Rank regex matched "patch" in "dispatch" — match words on humanized form; single FAMILIES table. Fan-out gated on pointer.type==="vesselCapability" because POST /resolve EXECUTES.

### 25. the-system-drafted-the-correct-fix-and-discarded-it — RETRACTED (2026-08-11)
- keys: false-verification, drafter-quality, write-read-mismatch
- Semantic gate addresses:true confabulated for route-edit-9efe777a:3 targeting identity-vessel/src/index.ts which has no such predicate; 4 min later flipped false. Gate flips.
- Try 1 drafted infinite recursion; non-terminating-edit check refused; escalation suppressed (byte-anchored route lands ungraded).
- Fix 160b660: shared isTransientIdentityFailure() in activity-api auth.ts ('The operation timed out.' lacks 'timeout'; two copies; same class fixed earlier in llm-resolver provider-errors.ts). 13/13 timeouts transient:false; registry drained 14/386->0. Substrate pulled+restarted in ~7 min. Paired test control.

### 26. the-teaching-channel-anti-learns; flat write path destroys predicates (2026-09-09)
- keys: memory-recall, write-read-mismatch, dormant-mechanism, gap-content, false-verification, selection-learning
- compose_lesson concepts loaded into drafter (composeLessonsBlock, 3 sites), never credited: 36 lessons, 21 loaded, 0 succeeded, 0 failed. Relevance (s+1)/(l+2) decays with use (anchor lesson 0.00 after 422 loads) but inert for class-keyed FTS branch (concept.ts:363). credit-primed-concepts.ts (06-13) built as fix, wired to wrong drafter; feature-compose has zero usage-recording calls.
- 4th instance build-never-connect: rhythm registry empty; regionHint 0.6% producer coverage; this; learning_signal_health_observer gated by minLoadedVolume 50 while /concepts/search returns 55 regardless of limit (34 loaded) -> permanently "cold start"; no per-source_type breakdown (fleet 0.456 masks compose_lesson 0/21).
- gapFromFlatPointer() (substrate-gap.ts ~583-593) returns 7 fields, drops classification_metadata -> falsifier "none". MCP resolve_impulse flat pointer files unanchored gap; nest pointer:{gap:{...}}. Store: none=758, class1=7, class2=8, unstamped=161.
- Drafter ignores supplied verified-unique anchors (120 candidates).
- landed_vessels not populated before 09-06 -> 3 claims retracted; count landings with git log --author='Substrate Autonomous'. Substrate commits 34 (09-05) -> 12 (09-08) -> 0.
- Gaps filed: compose-lessons-are-loaded-but-never-credited..., the-flat-pointer-gap-write-path-silently-drops-every-measurement-predicate.

### 27. the-teaching-wire-ran-every-compose-and-returned-nothing (2026-08-09)
- keys: memory-recall, write-read-mismatch, endpoint-routing, test-residue-live-state
- consultPrinciples() returned "" every compose: filtered shape="architecturePrinciple" (0 concepts), AND-across-terms search with spec.slice(0,400), CONCEPT_DB_ENDPOINT unset -> 127.0.0.1:8260 refused on spokes. Fixed 1,2 (abead92, 0b5b279); 3 filed. Contract concept vessel_resolver_server existed since 07-30 at loaded=0 while trace-store-reconcile POSTed to nonexistent route (36 dispatches). Recall 0/4 -> 1/4; corpus thin.
- Operator probe of publish-time template guard (1baf8bb) overwrote real trace-store-reconcile template (holder:"probe") — republished. Use throwaway id when success path writes.
- Wrong calls from adjacent artifacts: 8934b6a ORDER BY commit (never slow); spoke read "rhythm registry empty fleet-wide" (hub had 52); 20-min window "86% reduction".

### 28. the-test-delta-gate-is-inert (2026-08-09) — RETRACTED parser cause
- keys: false-verification, test-residue-live-state, dormant-mechanism
- Original claim: bun (fail) regex obsolete -> fixed b21b309 (ANSI alternation + testFailureParseIsConsistent). RETRACTED: non-TTY bun emits (pass)/(fail); real defect: overlay tests resolved to live tree (../../vessels/local-tools-vessel/src/map-path.test.ts) -> staged break never exercised -> FAVORABLE. Fix: self-contained overlay; acceptance probe /tmp/mp-probe must return UNFAVORABLE.

### 29. the-test-gate-counted-two-failures-as-zero-introduced (2026-08-09)
- keys: autonomous-regression, false-verification, node-locality
- fce961b (substrate) commented out repos/ path regex in isEditIntentGoal -> "Add a note about my weekend" became edit intent routed to feature_compose. Reverted eac995e. Operator's own probe asked for it.
- goal-intent.test.ts had the right assertions (2 fail). Four absence diagnoses refuted; verdict record was on LOCAL container (searched hub journal). Gate computed "0 introduced" on 2-failure change (later traced to overlay resolving live tree, note 28).
- Post-land suite observational: d1d302ef21 fail=4 still stamped landed_verified.
- f1d79c3 appended doc line asserting opposite behaviour + "// Land it." -> reverted. Corollary: never dispatch a probe whose literal satisfaction weakens a safety property.

### 30. the-trace-evidence-is-split-across-two-disjoint-ledgers — REVISED (2026-09-06)
- keys: trace-store-db, selection-learning, false-verification, env-gating
- execution (36,125 rows, 1435 activity_ids, cap 150k, authoritative) vs activity_execution_traces (18,135, frozen dual-write shadow; DUAL_WRITE_ENABLED default false, paradigm.ts:30). execution truncated (was 303k vs 150k cap; 16 indexes 0.2 deletes/sec); nothing before Aug 1.
- Success-sampler TRACE_STORE_SUCCESS_SAMPLE_ACTIVITIES (env-gated) could bias zeros; inactive here.
- Retracted "create-shape-provider-goal never executed" (751 AET rows). Guard 3c7808a (refuse pinned target n>=100 & rate<0.01): 5 correct, 1 catastrophic (auth_resolve_v1 posterior 401,711 obs at 2.49e-6 vs traces 607/2652=22.9%, ~151x inflation), 7 unfalsifiable. Needs minimum real-trace count / re-entry path.
- SurrealQL: datetime conjunct silently drops partner predicate even parenthesized. execution.execution_id NULL; id in record id. Key variants (activity:⟨⟩, vessel prefix dropped).

### 31. the-trace-store-is-refusing-writes (2026-08-10) — SUPERSEDED IN PART
- keys: trace-store-db, spend-envelope-throughput, federation-p2p
- Hub activity-api SurrealDB write timeouts (INSERT execution/execution_trace_content), same PID, 20 min. Hub disk 99% full (77G, 1.1G avail; surrealdb 18G). Later: mostly an uncapped COMPOSE STORM (~30 concurrent typecheck+test runs on 8 vCPU); masking generator load 45 -> 1.8. Main lever: bounding concurrency on generator.
- Consequences: ribosome extraction blocked (reach re-read timed out -> SKIPPED), reaches ungraded, spoke traces dropped (TranslatingTraceSink), gap events lost (fire-and-forget), 36% transport failure Aug 1-8.
- /v2/events/publish highest volume but no DB write. 16 indexes; DELETE 2 rows 10.7s. Filed trace-store-write-timeouts-block-grading-and-extraction. Disk-headroom check belongs in doctor.

### 32. the-truncation-signal-is-emitted-and-nobody-reads-it (2026-08-10)
- keys: write-read-mismatch, drafter-quality
- llm-resolver returns stop_reason (:612 anthropic, :722 openai normalised to max_tokens); 0 reads in feature-compose, patch-with-tools, apply-proposal-as-patch, resolver-author, goal-host, local-tools. Truncated drafts credited as complete. Deferred (needs real truncation). (Later 09-13: 51.6% of typecheck failures look like truncation — note 4.) Blocker classification is a hypothesis (#59, #9, #12 misfiled as external).

### 33. the-unfound-blocker-was-a-store-list-read-counted-as-production (2026-08-10)
- keys: hollow-landing, goal-walk-floor, write-read-mismatch
- vesselResolveShape accepted any non-null body; activity-api store LIST (entries:[], rowCount 0) counted as production of code_modification_proposal -> HOLLOW; real drafter never reached. Fixed 5efe707 (empty-listing arm + gate on same predicate; narrow — route carries ~63.5% of pathway steps; 5/9 tests over-rejection guards). "A detector that logs is not a detector that gates."
- Live tree overwritten by pull-sync after substrate pushed 344f970 (autonomous landing de-prioritising loopback endpoints — autonomy criterion met).

### 34. the-ungated-second-landing-route and the five-site gap (2026-08-07)
- keys: hollow-landing, autonomous-regression, human-surface-escalation, drafter-quality, gap-content
- Harm loop: compose fails mechanically -> escalate to patch_with_tools (no semantic judge) -> self-lands via mitosis unjudged patches on human UI (046d754, 49421ae hide elapsed span); reach-patch MATCHED NO ROW -> ungraded; authoring-inflight marker defers pull-sync of the fix. Reverted 78c675d, 0022455. Fix 1fcefa0: suppress escalation when spec names a region.
- Five-site bug (sub-fleet-elapsed at 1321,1445,1470,1729,1752): every patch fixed one site. 130c431 region->line centres on last (atypical) occurrence.
- Multi-op plans self-interfere on anchors (op 1 ok; ops 2,3 fail) -> filed multi-op-plans-self-interfere-on-anchors. Clamped query at limit rows (466 vs 486).

### 35. the-vacuous-edit-gate-fires-in-production (2026-08-10)
- keys: hollow-landing
- 4ea5234 vacuous-edit.ts refuses plans adding only unused bindings: 11 firings day one; admits when bound name referenced. Converts silent no-op into failure recovery can act on. Comment-only and pure deletions deliberately allowed. Responsiveness check filed separately: a-typecheck-clean-edit-that-changes-no-behaviour-passes-the-verdict.

### 36. the-valve-was-running-all-along (2026-08-09)
- keys: trace-store-db, false-verification
- Global-ceiling valve (150k) looked never reached (+436 rows/hr, 0/21 negative deltas); instrumented: enters, counted 306,326, prunes batch 25 — ~6,250 iterations with no logging. 0e1fdb6 (delete batch 1000->25) let it run. Drain unbounded per sweep; orphan reap already has cap+budget+cursor. "A loop with no log is indistinguishable from a loop that never ran."

### 37. the-verdict-to-belief-junction-unfrozen (2026-09-07)
- keys: selection-learning, write-read-mismatch, trace-store-db
- POST /v2/activities/execution-traces/reach grades only when pre-tags classify 'ungraded'; another path writes reached:false first -> skipped forever. Census 1,134 compose rows: 7 (0.6%) ever moved posterior. Fix: widen to ungraded||not-reached||reached (reach_graded:true is the guard). beta 19.48 -> 31.48 monotone, implied 73.6% -> 63.3%, alpha frozen 54.39.
- gap-to-feature calls resolveFeatureCompose in-process (3 sites 2970, 3672, 3705) bypassing goal-host (sole verdict deliverer): 95.5% untagged. Patched 1 of 3 sites -> coverage 29% then 15%. Second time this session (goal-host 7 id-synthesis sites).
- Eight blockers on a two-line change (poisoned baseline, 401'd discovery from .substrate-secrets overriding key, lane cap=1, ambiguous region...). Concepts concept_CSRYyG8br70D, concept_zwOpElFCJ1fZ.
- Instrument errors: void fetch silent sender; uniq -c lines vs events; telemetry rows inflated graded 29.3% vs 12.5%.

### 38. the-vessel-admits-composes-it-has-already-decided-to-kill (2026-08-10)
- keys: sync-deploy-drift, spend-envelope-throughput, endpoint-routing, federation-p2p, goal-walk-floor, false-verification, directed-overshoot
- devDraining flag set but request handler never reads it -> composes admitted mid-drain lost. Deadline message counts markers not requests (2 lost reported 0). Fix: lame-duck admission.
- in_flight counter inflated 9x (substring-matching raw request body for feature_compose etc; 1 slot file vs 9) — drives drain never completing and pull-sync defer-then-restart. Correct signal: compose slot files. Operator's own second wrong counter.
- Region anchor doesn't narrow window (grounding_len 36629 both); it enables op budget 4 and containment gate (grounding_has_region null in 30/30 prior runs).
- Unattributed SIGTERM; systemd_restart resolver logs nothing on success.
- Discovery preferred federated producer 127.0.0.1:8401 (dead relay NO_RESERVATION) over healthy local 8090; operator's escalation suppression (branch on namedRegion) removed fallback on transport failure — own regression.
- Non-specific trial: target inference -> shellResult only (0.6) -> answered "46" graded reached. reached:yes at dispatch surface vs reached:false in trace tag. Learner withheld alpha.
- isPathlessCodeChangeGoal MUTATION_VERB lacks "should refuse/prefer" -> law 13 as lexical bug; added NORMATIVE_INTENT (73-test corpus green). Retraction: attributed another goal_hash's inference to own. Next blocker: extractSearchTerms can't localize to one file (symptom vocabulary not in code).
- make sync-goal-host-vessel hand-deploy poisoned baseline (live 902803B vs clone 904967B) -> pwt refuses that vessel.

### 39. the-walk-grades-into-a-table-nothing-reads (2026-08-10) — headline RETRACTED
- keys: selection-learning, composition-crystallization, trace-store-db, write-read-mismatch
- Primary grading path works (trace tags -> classifyReach -> applyOutcomeToPosteriors -> variant_performance_metrics -> enrichTemplatesWithMetrics); validator-dispatch alpha 151,324. Grep for activities/reach missed actual route.
- Real secondary dead end: /v2/activities/feedback writes impulse_shape_activity_score, read nowhere. 94.3% credits to satisfier pseudo-ids (satisfier:shellResult 78.5%) auto-admitted with empty shapes (invisible to discovery). Grant rate 74.1% -> 21.7%.
- execution has no correlation_id (0/150,000); variant_performance_metrics one mutable row, no history.
- Pathway bank recommendation zero information: on-bank 28.7% vs blind 29.6%; acceptance gate successful>=1&&total>=1; pathwayReusePolicy failed to resolve 511 times; 9,048 paths: 78% non-reaching, 51.2% satisfier pseudo-ids, 54.7% empty endpoint_output_shapes; 42.5% templates never executed; mitosis variants 89.5% hollow. Donor/rebind 1,231 attempts -> 0 adaptations.
- Thompson cannot exploit: untried arms default Beta(1,1); pool ~100, 97.1% <5 obs; .755 arm wins 0% at pool 100. Fix a2a7dfd UNTRIED_PRIOR_BETA=3 (total_executions===0) merged 12e811e deployed 08-11 00:40 — NOT behaviourally validated. Only 139 of 462 well-evidenced arms ever in selection log; ~14% corpus with evidence.
- Floor 21.9% vs ceiling learned_pathway 12.7% (0.58x); _rcHit never sets commandReuseFired (0 fires in 9 days; 23/24 reuses filed fresh). walk_tier last-write-wins.
- /v2/activities/scores returns total 0 (org-scope broken). Auditor printed GITHUB_TOKEN & SUBSTRATE_GIT_PAT to transcript — rotation needed.

### 40. thompson-posterior-time-decay (2026-07-29)
- keys: selection-learning, node-locality, federation-p2p
- Hub (12 arms) vs spoke (14) LLM policies siloed; mistral-small local alpha1/beta80 vs hub 7439/304 — stale poison from outage. Fix 8eb5e08 decayedCounts 3-day half-life at select and write — verified. Same bug in activity-api posterior-update.ts (no decay; checkAndRetireTemplate permanent retire) -> openspec/changes/2026-07-29-thompson-posterior-time-decay + gap activity-api-thompson-posterior-unbounded-accumulation-no-decay (substrate to implement).

### 41. threaded-two-op-routes-1-2-3-landed (2026-07-30)
- keys: goal-walk-floor, composition-crystallization
- Hand-landed goal-host 06b66d8 rank-then-aggregate (parse/build/verify triad, emitted==truth by construction); e874a19 two-source-compare and group-then-ratio. Single-op reach 14/14; compositional was 1/8. Specific per-class deterministic routes (not general).

### 42. three-instruments-disagreed-about-one-patch (2026-09-10)
- keys: test-residue-live-state, false-verification
- First test run in fresh tar copy 34 fail; subsequent 37 — tests leave state; baseline from 2nd run. Count vs set: comm on sorted failing names. development-vessel suite stably 37 red (resolveGapToFeature cooldown tests via @ts-ignore private, last changed 08-31) yet lands changes.
- verify_ok=[False] with goalReachReason 416 chars listing only passing checks — failing check never named (filed the-verify-failure-reason-lists-only-passing-checks).

### 43. three-leg-selection-and-causal-intent-stamp (2026-07-25)
- keys: composition-crystallization, selection-learning, hollow-landing, drafter-quality, dormant-mechanism
- Substrate landed goalSignature stamp on pool impulses: first vague dispatch c9e38e8 bound wrong value (goalSignature: shape) and passed reach gate (!!landedSha); precise correction 5b8812f correct. Filed gap-feature-compose-binds-wrong-value-hollow-correct.
- walk_tier frozen-default/Zod-stripped/DB-dropped/crosswired (4-file); execution_count CREATE-only. Successor features psi trains by default; SF_BLEND default off self-arms at >=200 cells; expected-vs-actual residual evaporates (gap-prediction-error-residual-evaporates). Accelerator tick double-scheduled. gap-composition-edge-unlabeled-by-intent.

### 44. three-watchers-failed-in-one-hour (2026-09-10)
- keys: false-verification
- Operator watcher failures: missing ")" -> empty dispatch id treated as retry; self-matching falsifier pattern matched original code -> false LANDED; status=gone treated terminal. /run-goal coalesces identical goal text (8 retries = 2 dispatches). Laws: test parser on real response; poll the artifact not the process; pattern must not match pre-change file.

### 45. thrown-dispatch-never-leaves-running (2026-08-05)
- keys: goal-walk-floor, sync-deploy-drift, false-verification, human-surface-escalation
- goal-host catch (~:9607) never set record.status -> immortal running records (14 of 16 = obsidian active-note assist rhythm goal, conduit unreachable). Drain zero-condition unreachable; operator raised GOAL_HOST_DRAIN_MS 80->240s (latent regression). Landed b3ad44a, df4b700 (freshness bound), 6f735c1 — via SUBSTRATE_ALLOW_DIRECT_EDIT=1 (bootstrap deadlock: 5 composes died to cutovers). Verified in_flight 15->0 sustained over 36-min rhythm.
- Oracle corpus biased: boot reconciler grades but doesn't feed recordDeterministicLabel -> 98/100 not_achieved; 2% was sampling artifact.
- T1.2 authority-ranked labels inert (zero executions with >1 label) — don't build. activity-api impulses.ts four duplicate case 'goal_verification_label' (tsc doesn't flag). Systemd drop-in live (unit convergence /usr/lib). feature-compose authoring marker written after plan (:2149) -> planning window unprotected (gap feature-compose-planning-window-unprotected). Self-interference: edit to development-vessel restarts it mid-compose; self-interference-scan only detects.
- git log --since interpreted local time.

### 46. time-bomb-test-fixtures-expire-into-red (2026-08-29)
- keys: test-residue-live-state, false-verification
- vessel-mitosis-evaluate.test.ts fixtures dated 2026-06-03 vs resolver now-30d window -> 4 tests red since 07-03. Fixed 2cf00d1 (24/4 -> 28/0). Blanket restamp of 17 files: 93->90 (fixed 4 broke 1) — don't. Nearly invented false noise floor from different trees. Detector to mint: literal timestamp fixture + relative window resolver. Dev-vessel baseline 1764 pass/95 fail/243 files at 264af65.

### 47. topology-grows-but-unbindable-inputshapes-leak (2026-07-26)
- keys: composition-crystallization, dormant-mechanism
- ~83 learned-composition templates persisted in `activity` table (not `activity_templates`, 2 stale rows); dev-vessel activity_fetch pointer-key bug returns variant_id undefined; activity-api needs Authorization: ApiKey.
- Minted composites' input_shapes leak extractor context (activity_template, goal, source_code, trace...) -> binding gate (goal-host :3506, 3554) never binds -> input-side reuse dead. Re-sourced version of ratchet-ceiling defect (27cc619 fixed walk-* scoped inputShapes). Minimal fix: synthesize_template emits explicit top-level input_shapes (activities.ts:441-443 skips infer). Not landed (cross-package ias-executor-ts ribosome-extract.json).

### 48. topology-growth-blocker-write-terminal (2026-07-26)
- keys: composition-crystallization, goal-walk-floor, hollow-landing
- Layer 1: "compute X then save as note" -> inference single [shellResult] -> no split -> chain 1 -> mint gate skips; BRIDGE (index.ts:4272) writes obsidian note post-reach, excluded from minting (4278); requested memoryNote never persisted (hollow-green).
- Layer 2: emit-first phrasing inference [shellResult, memoryNote_write] and split works, but goal-host classifies all _write shapes cold-unreachable by design (index.ts:1576) -> no pick. Fix direction (not landed): on-chain composed-write step generalizing the bridge.

### 49. total-executions-is-inflated-155x (2026-09-05)
- keys: selection-learning, trace-store-db, false-verification
- Σ total_executions 2,158,161 vs 34,314 execution rows; 66 arms >=500 claims: 440,228 vs 2,839 selections = 155x; slot-binding 243,063 from 5 (48,613x). Naive join 0 matches; normId -> 566.
- Retirement (checkAndRetireByPosterior per ingested trace) can't see untraced arms: 162 of 221 arms with >=100 executions have 0 execution rows; 4 worst at 0.00 mean selectable. Retirement works for traced arms (78/93); retired_reason None on all 3,886.
- Shipped 40395ba counterIntegrity() in learning-transfer-report.ts — production-confirmed. Operator decisions pending.

### 50. trace-plan-reconciliation-audit (2026-08-03)
- keys: false-verification, goal-walk-floor, gap-content
- Edit reaches sha-attested: 7 shas verified ancestors of origin/dev. Nine deterministic oracle families never fire (0 verified in 24h; 703 deterministic rejections). Self-submitted goals: 182 "Close substrate gap", 44 investigate-and-decompose, 0 verifiable questions. Plan->outcome: substrateGap_write 1.3%, feature_compose 6.2%, shellResult 23.3%. Planner directionally calibrated (88% at conf>=0.9 producible).
- verifyCountFilesReach: path dialect repos/ only, no language->ext fallback, non-recursive readdir — widening regex = regression (correct 7 vs truth 2 -> deterministic false rejection). Nine copies of repos/ anchor. Single-file questions unverifiable.

### 51. trace-store-is-unreclaimed-blobs; surface needs host browser (2026-09-25)
- keys: trace-store-db, human-surface-escalation, endpoint-routing, spend-envelope-throughput
- /var/lib/surrealdb/data.db 676 blobs = 40.8GB; enable_blob_garbage_collection=false; SurrealDB 2.3.3 no GC knob -> rebuild (export/import, /workspace/surreal-rebuild) or upgrade. surreal ~4 cores, 19.7GB RSS; retention DELETE 25 rows fails ~1000x/24h; trace-store-reconcile 89 runs/1 reach. Held gap the-trace-store-is-42gb-of-unreclaimed-rocksdb-blobs.
- Human surface human-surface-vessel 8310 container loopback; no browser in image; validation/human-participation/surface-state-probe.ts. Header "43 awaiting" counts only 50 displayed vs 178 unanswered.
- Cockpit: ~/.metabob/config.json apiKey != substrate-key -> identity 401 -> "could not find goal-host-vessel".
- Reach denominator: ~half failed dispatches = pre-admission refusals of pinned scaffold-and-publish-vessel (beta~8611) every ~90s; gap-drain pins phantom db_performance_slow_queries (39/day). Program doc validation/reports/self-development-program-2026-09-25/PROGRAM.md.

### 52. tracing-a-resolver-buys-visibility-not-extractability (2026-08-29)
- keys: composition-crystallization, trace-store-db, hollow-landing, drafter-quality
- Walk extraction loop closes: learned-composition-failurecountreport-to-prior-failed minted 14:15:29 (n_steps 3) and autonomously reused 16:02:17; learned-composition-* 538 executions.
- CONTAINS silently returns 0 (use string::starts_with); ORDER BY after GROUP BY alphabetical.
- c5f7efb chains reach grading off landing-trace emission; ribosome reads tags. But resolver-emitted summary records have completed=0 (ExecutionRecordSchema has no task field) -> allSucceeded false -> no extraction: self-dev pipeline resolver-implemented, must be decomposed into executor-run activity tasks (largest structural gap).
- feature_compose traces: op_count==ops_applied always (records attempted, not requested); 5/5 rolled_back; two-op dispatch 5b632e4d applied only edit 1. Filed feature-compose-applies-one-op-and-silently-drops-the-rest. Hand-landed 264af65 test file. -narrowed child competing (tied_at_top 72).

### 53. two-causes-of-lost-credit-not-one (2026-08-18)
- keys: trace-store-db, federation-p2p, selection-learning, node-locality
- Hub surrealdb degraded latency 30,263ms (visible only due to 16edacd latency grading). alpha-credit LOST: feedback POST to syzygy.host:18080 timed out; oracle-label write failed. Timeouts deliberately not raised. Retracted second cause: pull-sync quiesced (closed admission, drained 40s) correctly. Ladder: single fact/field/arithmetic valid; two-source compositional honest miss. "Composes, verifies, catches false reaches; does not yet remember."

### 54. two-degenerate-goal-families-are-half-of-all-execution (2026-08-05)
- keys: selection-learning, gap-content, composition-crystallization, drafter-quality
- Hub goal-paths 9744 execs 14.0%: scaffold+publish 0/2018 (unbound variable — gap-to-scenario-bridge.ts:283 capability_shape null dispatched anyway, catch{} swallowed; fixed guard); close-substrate-gap 157/3102 5.1% (goal_hash instance hash, 2,145 distinct paths); remainder 26.2%, singleton vs repeated identical (repetition buys nothing).
- Retirement requires successful_executions===0; 1 success in 3,710 = immunity. "A posterior cannot defend against a generator."
- normalizeGoal repair to elide hex ids /\b[0-9a-f]{8,}(?::\d+)?\b/g (don't touch goalHashOf).
- Deterministic drafting floor: synthesizeVerbatimEditOps (feature-compose.ts:1945) bypasses LLM planner for verbatim old->new goals; 4458130 monotonic cooldown landed this way.
- Templates listing clamps to 100; /v1/resolve-url doesn't exist on discovery -> discoverAll() always []. 

### 55. two-delete-cost-hypotheses-died (2026-08-09)
- keys: trace-store-db
- Dropping idx_execution_id: 3.52 -> 17.20 s/row (reverted 0da9c16); batch 25->1: 9.19 s/row (reverted f4d62bf). Delete cost lives in storage engine — design question. Intake ~325 rows/hr, surplus ~157k. applySQLFile 45s timeout must not be raised (300s caused restart loop 08-03). Index migrations need CONCURRENTLY. markMigrationApplied only on success.

### 56. two-file-corruption-vectors-in-the-apply-path (2026-08-02)
- keys: autonomous-regression, drafter-quality, sync-deploy-drift
- Vector 1: fs_edit empty old_string prepends at byte 0 (local-tools index.ts:90) — 44 malformed ops/24h; fixed b42db41. Vector 2: create_file overwrote existing (feature-compose.ts 2981 lines -> 39 bytes), no preEditContent; fixed c42410d. Vector 3: fs_write no guard -> truncated again 38/162 bytes; fixed 67a9e71 (refuse shrink <10% of >1000B) — caught 190,333->41 in production 19:33 via walk fileWriteResult rawResolve.
- Self-sustaining: patch-with-tools baseContent = live file -> rollback restores corruption. Top-level import -> restart loses whole vessel.
- Correction: feature-compose already on per-compose worktrees (8ec501b, f655c8d compose-workspace.ts); patch_with_tools NO isolation (270 starts/24h). Containment d4ae359/a2fc845/0e1de31: 19/425 refused, 0 false positives. Guards condition on target currently healthy — prior damage disables guard.

### 57. two-headline-attribution-defects-fixed-and-verified (2026-08-24)
- keys: selection-learning, trace-store-db, write-read-mismatch, dormant-mechanism
- B1 selection<->outcome join severed at 3 joints (gap selection-outcome-join-severed-at-three-joints-law12): producer — 0 of 9,614 executions carry correlation tag; ingest closed 755dca9 (deriveCorrelationIdFromTags); reader joined frozen activity_execution_traces + ANSI JOIN unsupported in SurrealDB 2.3 (4th joint) -> fixed 471febb/7413367 (JOIN-free vs live execution, bounded, 0.43s). posterior-update.ts no correlation consumer. 2 of 4 joints closed; producer/consumer filed. Operator initially overstated "resolved".
- B2 recency-only prefilter fixed a7182c9 (computeAdmissionLimit max(limit,1000)); ev column dead (reads activity.thompson_alpha/beta no writer sets — wrong-table).
- B3 validator-dispatch chain dies task1->task2 shape binding (1-of-5) — filed; task 5 hardcodes executionSucceeded:false. Retired-IS-NONE sub-fix inert (0/3,858).
- B4 trace-store pressure self-resolved by migrations 198 (db667c1)/199 (ffd75d0) removing boolean success indexes; ring 150k -> 9,242.
- Canonical dispatch landed inert interface-field partial be97c55 on B1; coverage gate blocked B2 (no test file). Compose-BUSY guard 2cc8af7 fired correctly. Report validation/reports/LEARNING_DB_ARCHITECTURE_AUDIT_2026-08-22.md.

### 58. two-memory-stores-and-a-battery-flood; lane's failed-falsifier protocol (2026-09-22)
- keys: memory-recall, env-gating, test-residue-live-state, narrowing-duplicates, hollow-landing, endpoint-routing, spend-envelope-throughput, trace-store-db
- development-vessel.service Environment=WORKSPACE_ROOT=/workspace but /etc/substrate/env EnvironmentFile /workspace/git/super-repo wins -> since Jul 25 notes written to super-repo/memory/notes.json while 680 notes unread at /workspace/memory/notes.json. Merged at file level.
- Battery flood: trendcheck-* and expectation:* notes minted every 120s never retired: 578/1077 (54%); recall newest-N by updated_at -> conventions displaced (0 feedback shown while 90 existed). Hook fetches by note_type.
- Undocumented failed-falsifier protocol: literal "BEHAVIORAL VERIFICATION FAILED" / regressed_by=<sha>, clear pending_outcome_verification. gap_to_feature drops `directed`; -narrowed child verbatim copy; failure_lessons reach drafter; MOVE fix needs constraint. Winning landing via EARLY EDIT-INTENT labelled route-edit-<goalhash> -> close-oracle can't attribute.
- Retire primitive 19ae84e (Substrate Autonomous) 6/6 falsifier. Report validation/reports/acceleration-baseline/MEMORY-SPLIT-AND-RETIRE-SELF-REPAIR-2026-09-22.md.
- OpenRouter credits exhausted (1399.69/1400) — operator blocker. Identity limiter bucket ip:keyprefix 100/min shared -> 6.5k 429/30min -> INVALID_API_KEY -> trace sinks spool; substrate relabelled 4fc5f80 (503 IDENTITY_UNAVAILABLE). Self-recovery restarts activity-api every 3 min (74% queries >10s starve loop). /workspace/trace-spool NO replayer: 17,587 files/119MB since 08-17 — learning blind a week.
- d4171b1 landed retire calls with bare {type,note} body -> 400 pointer.type required -> silent no-op; envelope inconsistency across vessels. 3 hollow_writes in one night (bbb83ff isDirected unused, d4171b1, b5ed109). JSON.stringify(undefined) in 7 digest sites aborted pool walk 91x/day; hardened 875e137. 552 stale battery notes retired.

### 59. two-recovery-paths-were-dead-at-once (2026-08-11)
- keys: sync-deploy-drift, false-verification
- Restart=on-failure cannot recover a clean stop (exit 0): goal-host stranded inactive after sync until manual start (intermittent n=1/1). self-recovery.timer next_elapse=0 dead both times (07:17 crash-loop from unparseable compose source; 08:12 clean stop). /health blind to both; need enabled-but-inactive + restart count.
- 94f4649 binds landing-evidence to goal not route; unit-verified, not yet observed in prod (n=0).

### 60. unpin-llm-model-literals (2026-07-31)
- keys: env-gating, selection-learning, endpoint-routing
- Pinned model bypasses selectArm. Landed 9d164de (goal-host), b0435f4, beec282 (dev-vessel; 31 seed-template literals -> auto), 58e538d (ias-executor retired model id). Remaining bypass: activity-api selectActivityForGoal.ts calls OpenAI directly; local-tools web_search hits openrouter directly; patch-with-tools fallbackModels list. Arm pool incomplete: self-hosted Qwen3 not in local modelClientMap.
- Direct-edit gate hook intercepts Write|Edit only, not Bash (sed bypass used with authorization).

### 61. untraced-dispatches-inflate-reach (2026-08-02)
- keys: trace-store-db, false-verification, goal-walk-floor
- goal-host index.ts:9571 goal-seek:no-trace placeholder on pre-execution early returns (no-producer 7644, secret-extraction 3667, activity-repair 7594, edit-intent nothing landed 6960/7328, template_repair FAVORABLE 7576 reached:true); no trace written; executionStore evicts at 100. Missing from numerator & denominator -> optimistic reach bias; learning loop blind to the class. operator-goal-signal.ts computes reach from goal_execution_paths.

### 62. validatability-readiness-assessment-and-harness (2026-07-27)
- keys: false-verification, selection-learning
- NOT YET VALIDATABLE. reached graded by reward-coupled Haiku; only deterministic positive oracle = landed sha. Harness validation/scripts/validatability-harness.py (a6524f8c). 9/9 everyday goals honest-correct; gaming_gap 0.08-0.17; nonexistent-entity confabulation. ~5 substantive autonomous commits/day, ~15% hollow tail, durability 0.

### 63. value-reality-gate-exists-but-is-off-the-apply-path (2026-08-03)
- keys: autonomous-regression, hollow-landing, false-verification, endpoint-routing
- detectArchitectureViolation Check C (feature-compose.ts:927-968, 07-29) catches fabricated hosts but advisory on feature-compose and absent from apply_proposal_as_patch path; 7ea7d52 fabricated https://new-llm-endpoint.com landed; 0b80f1b https://concept-db.com POSTs (reverted bba209f). Wired as hard L11 fail in patch-with-tools.ts -> 1a507d1; corpus 200 commits flags exactly 2, 0 FP; skips comment lines (so revert 3215e70 allowed).
- Refuted 5-predicate gate (14/14 finder claims refuted). verifyEditPostState subtractive; second edit-intent route at :7200 grades reached:!!landedSha without oracle.

### 64. variant-minting-blocked-silent-skip (2026-08-02) — CONTESTED
- keys: composition-crystallization, dormant-mechanism
- ribosome-extract dispatch_write_attempt gated on applyExtraction default false (ias-executor-ts ribosome-extract.json:165, :27-31); lifecycle subscriber (goal-host.ts ~605) passes no variables. 948d085 turned UNRESOLVABLE_GATE loud failure into silent skip. Ribosome-vessel double-locked (completed=0; ribosome_extract_route_unavailable). variant_promote has no implementation despite docs. activityTemplate_write needs admin scope (canary keys 401/403).

### 65. vessel-connect-contract (2026-07-19)
- keys: federation-p2p, endpoint-routing, env-gating
- Contract {discoveryEndpoint, apiKey}; key carries iss. Gaps: discovery must serve relay anchor (GET /bootstrap) — RELAY_MULTIADDR env at bootstrap only; issuer-aware key validation (local keys iss 127.0.0.1:8101 404 on hub); unify client config. (Later 08-10: /bootstrap existed but transport read it once at module load — note 12.)

### 66. vessel-startup-decoupling-requires-to-wants (2026-07-23)
- keys: sync-deploy-drift, federation-p2p
- Core units hard Requires= + fatal ExecStartPre -> cascades. Landed d08ebf5b/43d6d96/388c69a: Requires->Wants on 13 units, ExecStartPre=- , TimeoutStartSec=300, bounded init-database waits. pull-sync doesn't re-copy units (docker cp + daemon-reload). concept-db top-level await db.connect still kills process — listener-first gap filed.

### 67. walktier-blocker-self-closed-by-substrate (2026-07-25)
- keys: selection-learning, codebase-bloat-fossils, sync-deploy-drift
- e6bf483 (DevBob/substrate, 07-24) coordinated 3-file walk_tier persistence + migration 181; 476 rows tagged. Operator nearly duplicated (8c47914) — push rejected, reset. Lesson: git fetch/log origin/dev for self-authored fix before fixing. "40/40 null" was sampling artifact (limit=40 returned old rows).
- Latent: CREATE bind `?? null` on SCHEMAFULL option<string> fails whole create silently. Plugin dispatch-goal (:27182) returns success but drops goal after reload. Plugin note-generator can't reach trace store.

### 68. walktier-grounded-emitted-and-walkactivity-assessment (2026-07-25)
- keys: human-surface-escalation, goal-walk-floor, sync-deploy-drift, selection-learning
- goal-host d8d2603 emits walkTier + grounded on goalWalkState; obsidian panels 9284e74/6c33f5b/80f31d5. Dispatch failed (feature_compose old_string not found, patch_with_tools staged-not-landed) -> direct edit. Failed pwt left staged debris in container clone -> pull-sync ff-only failed -> deploy blocked (substrate can't self-recover).
- Model: two Beta loops (variant_performance_metrics; goal_execution_paths). 5 WalkStep sources declared, 3 emitted; recovery+improvise dead; universal-tool-fallback emits no WalkStep (ReAct floor invisible). Satisfier short-circuit starves reuse (no alpha/beta, no mint). walk_tier stripped by PathRecordRequestSchema.
- Lesson: emitting authoritative signal makes client heuristics contradict; retire scrapers (grounded, walkTier, goalReachReason).

### 69. walk-wallclock-llm-call-cuts (2026-07-24)
- keys: goal-walk-floor, spend-envelope-throughput
- Walk ~13-17 sequential LLM calls/compose ~10.7s each via hub relay. Landed via self-dev: 8a5e15e (kill double arg-extraction), 71e0161 (gate interim reach-judge), 1797a72 (honor model hint). 145s -> 35s. 1be9f4f executorGuidance interpreter facts (no python; use bun -e/perl/awk). goal-host coalesces identical in-flight goal text.

### 70. where-reach-actually-goes: gap-repair is 39% of denominator (2026-09-12)
- keys: selection-learning, drafter-quality, gap-content, false-verification, write-read-mismatch, dormant-mechanism
- Typecheck-repair prompt already includes verbatim window; ANCHOR-MISS = fidelity.
- Failover mislabels: sel.meta.selected never reassigned; walkFallbackModels returns fallback_from — gemini penalties landed on haiku. Fix: record no model when fallback_from present (ungraded not mis-graded).
- LLM selector graded on "call returned" (recordArmOutcome resolved===true); drafting task types excluded from immediate grading by design, deferred path never wired: gradeArmByExecution/recordArmOutcomeFromPending zero references; PENDING_ARM_OUTCOMES never created. feature_compose/patch_with_tools 0 posteriors. gemini alpha 8694/beta 60 EV .993 while work reaches 19%.
- Fixes: 6b880960 (log model), fec22cbc (llmArmOutcome_write -> recordArmOutcome), 7792c3e5 (report model/reached), 0f47d8ab (clear carry vars), 700c70f8 (seed task posterior neutral; inherited global prior 8690 made 13 penalties move .9931->.9917). decayedCounts clock reset every update -> busy arm never decays. Policy file /workspace/policies/llm-model-policy.json != what resolver uses (rev 9 vs 10).
- Structural: cross-file change cannot land (one-file-per-goal + gate refuses unconnected part 1) — filed a-cross-file-change-cannot-be-landed-because-staging-is-refused-and-multi-file-is-dropped. 35 pickups of 7 operator gaps, 0 commits vs 8 single-file landings.
- anchor fix 62da19fa displaced failures downstream: apply_failed 25%->15%, semantic_reject 23%->33%, typecheck 24%->33%, FAVORABLE 19%->17% (n=45).
- Label corpus: gap-repair 65 (39%) reaches 1.5%; edit-intent 10.6%; other 47%; compute 45%; non-edit 78.1%. Compose layer 53/273 = 19%; git 76 commits/60 route-edit hashes.
- Compose funnel 273/24h: typecheck failure 24%, apply_failed 23%, semantic_reject 23%, FAVORABLE 19%. Repair loop MAX_REPAIR=4 exists; probes 170c3d69, 0672a4e2, 44caeaaa, 30237122 lit ATTEMPT/NO-TARGET/ANCHOR-MISS; death modes ANCHOR-MISS, unparseable JSON, neither key — drafter-output quality. Response-shape mismatch recurrence. Don't widen created-file rewrite (160-byte scar).
- Recommit child summaries = previous failure raw output (90% <300 chars); fixed 206f055b (prepend parent spec, preserve phrase used by db-admin.ts:78 classifier); backfilled 56 gaps (median 253->1546). 7/10 falsifier.
- Goal phrasing "Replace this exact text" -> code_replace_lines no producer (floor violation; 14/24h, recorded not minted).
- Pending test: pin strong model for drafting and re-measure. Credential: anthropic 401 invalid; present:true means key string configured.

### 71. why-arbitrary-goals-never-compound (2026-09-02)
- keys: composition-crystallization, selection-learning, trace-store-db, write-read-mismatch
- 4/5 arbitrary goals reached and verified (Iceland population, tungsten, 7 .ts files, Neptune); miss = http_fetch infra. Fleet reach 6.4%.
- (A) satisfier reaches: reach-patch MATCHED NO ROW — 5/5 reached=true (success-selective alpha drain, p~1.5e-4). (B) ribosome reads column reached=false as terminal (attempts=1) while patch lags up to 586s; polling (75s) recovers 4/10 -> needs event-driven. 44 extraction SKIPPED, 0 extractions.
- Trace row self-contradiction (status success, tag reached:true, column false). Shipped 86aebdf ribosome read-side: tag wins over false column (one-directional). Write-side mechanism unidentified. LIST endpoint returns tags=null — use per-id.
- Pathway reuse via shape_signature WORKS (23 acceptances, cover 0.5 partial = first/last-mile) but donor record frozen (10/12 reached across 11 reuses); 19/23 no REUSE LINEAGE record; store has 8x optimism bias. Gap pathway-reuse-outcomes-never-update-the-donor-record; ribosome-treats-reached-false-as-terminal-losing-late-patched-reaches. Rebind tier 0/441 by design.

### 72. why-concept-db-cannot-build-optimize-or-prune-itself (2026-08-29)
- keys: trace-store-db, dormant-mechanism, false-verification, memory-recall, sync-deploy-drift, env-gating
- apply-schema.ts splits on ';' (shreds DEFINE FUNCTION), swallows errors, prints success unconditionally, verifies only table names, exits 0 if DB unreachable -> fn::island_concepts absent -> resolve-island dead. Indexes do exist.
- Upkeep Thompson state in-memory; UPKEEP_INTERVAL_MS 5min; pull-sync restarts concept-db 132x/day -> totalTrials 0 forever.
- Prune: only prune-per-execution-concepts, predicate times_loaded=0 unreachable (search increments); targets impulse_activity_pattern 0.8% while impulse_signature 86.4% (55,275) unpruned. 63,952 concepts; do not delete without establishing readers. Filtered count 26.1s. Dense leg fails on 2000ms budget.

### 73. windowed-reach-is-not-computable (2026-08-05)
- keys: false-verification, trace-store-db
- goal-paths lifetime counters per path -> bucketing by last_executed_at not windowed (retracted 44.1%/49.8% table). /v2/activities/executions has no reached field; success = template exit (96.3%). total field returns page size; status/since/activity_id filters silently ignored. reach 13.9% all-time only.

### 74. wiring-gaps-resolved-and-revalidated (2026-09-16)
- keys: sync-deploy-drift, federation-p2p, drafter-quality, codebase-bloat-fossils
- Five wiring gaps closed; miswired fleets 503 naming sink; DISABLED_VESSELS governs manifest units. Report validation/reports/wiring-green-vs-miswired-proof/.
- goal-host edit-intent route transforms spec so synthesizeVerbatimEditOps never fires (direct resolve_impulse feature_compose works) — gap-mu3f0s5a. Compose verify typecheck in transient checkout w/o node_modules (tsc exit 127) — fixed global typescript a07ea8b7. rolled_back:true with edit still in tree (gap-mu3f0yqu). In-tree vessels (not submodules, e.g. relevance-sink) have no mitosis landing path — operator landed d42910bc author=Substrate Autonomous committer=DevBob. Intermittent openai 400 on drafter-sized calls. doctor 4b first-boot false positives.

---

## Grouped by problem-class key (recurrence view)

### write-read-mismatch — producer writes where no consumer reads (MOST RECURRENT in this shard)
Recurrences (date: instance -> outcome):
- 07-25: walk_tier sent by goal-host, stripped by PathRecordRequestSchema/SCHEMAFULL -> self-closed e6bf483 (worked); expected-vs-actual residual evaporates (open).
- 08-02: activityTemplate variants — applyExtraction never passed by lifecycle dispatcher (dormant).
- 08-05: boot reconciler grades but never feeds oracle corpus (corpus 98% not_achieved = artifact).
- 08-09: consultPrinciples read wrong shape/AND search/unset endpoint -> contract concept loaded=0 while reconcile posted to nonexistent route (partial fix abead92/0b5b279).
- 08-10: stop_reason emitted, 0 consumers (open); /feedback -> impulse_shape_activity_score read nowhere (dead channel); devDraining flag never read by handler; vesselResolveShape ignored honesty checker (fixed 5efe707); resolve_endpoint registry field ignored by surface proxy (08-19).
- 08-28: needs-human answers written keyed panel_id, scan read obsidian solicitation_ids (fixed 421052c, 9cb83d0); solicitationOutcomeReport no consumer.
- 09-05: substrate-gap summary guard fires only on absent summary (closing writes destroy summaries); apply-failure detail written to report JSON not trace.
- 09-07: reach verdict tag written before grader checks 'ungraded' -> 0.6% rows graded (fixed widen); gap-to-feature in-process composes bypass goal-host verdict delivery (3 sites; patched 1 then more).
- 09-09: compose_lesson loaded never credited (credit-primed-concepts built 06-13, wired to wrong drafter); flat pointer gap write drops classification_metadata.
- 09-12: fs_edit returns verbatim closest text, feature-compose discarded it (fixed 62da19fa); gradeArmByExecution/PENDING_ARM_OUTCOMES never wired (fixed fec22cbc/7792c3e5 via existing recordArmOutcome); ev column reads activity.thompson_alpha no writer sets (08-24).
- 09-13: gap text said anchoring impossible, drafter strategy never read it; premise warning in anchorLabel fired 0 times on autonomous workload.
- 09-14: operator_verdict field on gaps has no consumer; reach-gap minter fetched producerId/producerInputs and discarded them (unblocked by ede0030).
- 09-22: resolve-URL joiner fixed at producer, 5 consumers still concatenate (Invalid URL -> "no producer"); memory notes written to super-repo path while 680 notes unread at /workspace path; d4171b1 retire calls bare envelope 400.
- Root cause (repeated verbatim in notes): "the substrate builds the correct mechanism and never connects it to the producer/consumer" (counted as 3rd, 4th, 12th, 14th instance by different sessions). Fixes are per-instance; no general detector of write-without-reader exists except the proposed "grep the new identifier for READS" hollow_write check (see index).

### hollow-landing — inert/check-satisfying commits
- 07-25 c9e38e8 bound wrong value (goalSignature: shape), passed !!landedSha gate.
- 08-07 046d754/49421ae hid UI span (ungated pwt route) — reverted; fix 1fcefa0 routing.
- 08-10 1bee107 comment-only diff FAVORABLE; 3f861b6 write-only preferredEndpoint field; 4ea5234 vacuous-edit gate refuses unused bindings (works, narrow).
- 08-12 37e584a dead optional interface field closed orphan-detector gap.
- 09-02 62e66a7 repair of own inert emitter was itself inert (wrong host/path/envelope; try/catch around fetch).
- 09-05 a336a75 12 comment-only lines graded reached:true -> zero_behaviour_delta gate; 09-14 gate blocked string-only product changes (fixed ede0030) and accepted no-op reorder 3a97d2f.
- 09-12 semantic gate rejected 60 cleanly-applied patches, 4-5/5 sampled sound (drafter emits hollow patches).
- 08-24 be97c55 inert interface-field partial on B1.
- 09-22 three hollow_writes in one night (bbb83ff, d4171b1, b5ed109), all passed typecheck+semantic gate.
- Recurs because gates judge edit SHAPE (typecheck, text delta, binding use), not whether the change does what was asked; write-only-ness not decidable from diff (08-10). Remedy stated repeatedly: execute the landed request against the live endpoint; read the diff vs request, never reached/sha.

### false-verification — false closes, wrong predicates, unmeasurable gaps, lying instruments
- 08-09 mitosis test-delta "0 introduced" on 2-failure change (overlay resolved live tree); post-land suite observational only.
- 08-10 stale_open threshold structurally 0; gap auto-closed already_resolved after operator described correct state; "verify never installs" (bun install only if node_modules absent).
- 08-03 deterministic oracles never fire (goal population unverifiable); widening count oracle regex = false rejection.
- 08-05 windowed reach not computable; endpoints lie (total = page size, filters ignored).
- 08-02 untraced pre-execution dispatches missing from numerator+denominator.
- 07-27 reached graded by reward-coupled Haiku; gaming gap 0.08-0.17.
- 08-11 semantic gate confabulated addresses:true then flipped.
- 09-06 retirement guard 5 right/1 catastrophic (auth_resolve_v1 151x inflated)/7 unknowable.
- 09-05 total_executions inflated 155x (retracted own guidance to quote it).
- 09-10 verify_failed reason lists only passing checks; watcher self-matching falsifier; status=gone terminal.
- 09-13 grep -c counts lines; every reach baseline operator-contaminated.
- 09-14 dispatch graded failed while change on origin/dev (false-negative verdict class); backlog self-report overstated 50% (panel store stale).
- 09-22 class1 arming guard never fires (index) — gaps born closable.

### gap-content — gaps born without edit site / correct premise / machine check
- 08-03: 182/230 self-submitted goals "Close substrate gap" — nothing checkable.
- 08-05: goal_hash instance hash (gap id in text) -> close-substrate-gap family 2,145 distinct paths, cannot learn; unbound variable in scaffold goal minted 2,018 unreachable executions.
- 08-10: summary describing correct state closes gap; editing a gap is a dispatch.
- 09-09: flat write path drops predicates (none=758 vs class1=7).
- 09-12/13: 88% of code-edit gaps name only a file; detector named wrong route (31-gap family); recommit children carry failure output not change (fixed 206f055b + backfill); operator specs 80% vs autonomous 0-4.3% — THE bottleneck is spec derivation (problem -> change).
- 09-14: orphaned-capability 38/46 impossible ratios (394/389); docs-drift 60/66 path claims false positives (existing_paths index incomplete).
- 09-22: `-narrowed` verbatim clones; failed-falsifier protocol undocumented.

### narrowing-duplicates
- 08-10 revert doesn't remove demand: substrate relanded reverted regression 0797af4 from -narrowed gap.
- 08-28 gap filed 22:43 -> -narrowed clone 22:49.
- 08-29 failed_attempts hit 4 without compose report -> narrowing duplicate outranks parent.
- 09-12 five carriers of one edit intent (recommit-, -narrowed, route-edit-*); closing parent doesn't stop; 76% of lane = children (later 47% at n=540); 153/154 children minted after narrowing guard (recommit/narrow alternation).
- 09-13 31-gap nested lineage "investigate and decompose gap X: investigate and decompose gap Y".
- 09-22 -narrowed = verbatim copy (law-3 duplicate).

### drafter-quality
- Anchor hallucination (anchor_not_from_window 46/24h largest refusal); invented symbols (41% of typecheck fails); truncation/malformed (52%); multi-op self-interference (08-07); applies one op drops rest (08-29); binds nearest symbol (07-25); cross-boundary calls wrong (09-02); ignores supplied verified anchors (09-09).
- Info fixes displaced failures downstream, didn't convert (09-12 n=45). Converged view 09-12: model capability + 38% free-tier pool; 09-13 superseded: gap-content correctness (operator-specified 80%). Deterministic verbatim floor (synthesizeVerbatimEditOps) bypasses LLM — works via direct resolve, but goal-host edit-intent route transforms spec so it never fires (09-16).

### selection-learning
- 07-29 LLM arm posteriors no decay (fixed 8eb5e08); activity-api same bug -> openspec + gap.
- 08-05 1 success grants retirement immunity; posterior can't defend against a generator.
- 08-10 Thompson can't exploit (uniform prior over ~100 arms, 97% <5 obs) -> UNTRIED_PRIOR_BETA=3 (12e811e) not behaviourally validated; 94% credit to satisfier pseudo-ids; bank recommendation zero information (28.7% vs 29.6%); _rcHit never sets commandReuseFired; no correlation_id.
- 08-24 selection<->outcome join severed at 3-4 joints, 2 closed.
- 09-05 total_executions 155x; untraced arms immortal; retired_reason never recorded.
- 09-07 verdict->belief junction 0.6% -> converging.
- 09-12 LLM selector graded on call-returned; drafting ungraded; failover mislabels; inherited priors; decay clock reset — fixed chain 6b880960..700c70f8.
- 07-31 pinned model literals bypass selection (unpinned; bypass resolvers remain).

### composition-crystallization
- 07-26 composites persist (83) but input_shapes leak -> unbindable (re-sourced ratchet-ceiling defect); _write terminals cold-unreachable; bridge off-chain not minted.
- 08-02 variant minting silent skip (applyExtraction false; variant_promote unimplemented).
- 08-10 mitosis variants 89.5% hollow; donor/rebind 0/1,231.
- 08-10 ribosome blocked by trace-store write timeouts.
- 08-29 walk extraction mint->select->execute closed (538 learned-composition executions); resolver-implemented self-dev pipeline unextractable (no task census).
- 09-02 satisfier MATCHED NO ROW + false-as-terminal -> 0 extractions; pathway reuse via shape_signature works but donor frozen.

### goal-walk-floor
- 07-24 wall-clock 145s->35s; python absent.
- 07-30 hand-landed deterministic compositional routes.
- 08-05 thrown dispatch immortal running.
- 08-10 target inference -> shellResult "46" graded reached; isPathlessCodeChangeGoal lexical (NORMATIVE_INTENT); extractSearchTerms can't localize.
- 08-29 investigation walks failed on infra (unquoted &).
- 09-02 arbitrary goals 4/5 verified.
- 09-22 resolve-URL overshoot kills ReAct floor for absolute rows (llm/web_search/shell/human-surface).
- 09-12 phrasing routes to producerless shape.

### trace-store-db
- 08-09 valve silent loop; delete cost in storage engine (3.5-17 s/row); 16 indexes.
- 08-10 write timeouts (disk 99% + compose storm) block grading/extraction; spoke stale store advertised first.
- 08-18 hub surrealdb 30s latency; credit lost.
- 08-24 migrations 198/199 removed boolean success indexes -> ring 150k -> 9,242.
- 09-06 execution authoritative, AET frozen shadow; datetime conjunct drops partner predicate.
- 09-22 trace-spool no replayer (17,587 files); identity limiter 429 -> INVALID_API_KEY.
- 09-25 40.8GB unreclaimed RocksDB blobs (GC disabled, no knob).
- 08-29 concept-db schema applier lies; 63,952 concepts unprunable.

### sync-deploy-drift
- 07-23 Requires->Wants; pull-sync doesn't re-copy units.
- 07-25 failed pwt staged debris blocks pull-sync ff-only.
- 08-02 corruption: rollback baseline = live corrupted file; restart loses vessel.
- 08-05 bootstrap deadlock -> SUBSTRATE_ALLOW_DIRECT_EDIT.
- 08-10 lame-duck admission missing; in_flight counter 9x inflated drives restarts; hand-deploy poisons baseline.
- 08-11 Restart=on-failure can't recover clean stop; self-recovery.timer dead.
- 09-07 gate mirror 396 commits behind (untracked artifacts counted dirty) fixed 9333f0f7.
- 09-14 commit inert until pull-sync restart (ActiveEnterTimestamp vs mtime).
- 09-16 in-tree non-submodule vessels have no landing path.

### endpoint-routing
- Hardcoded 127.0.0.1:8080/8260 on spokes (08-09, 08-10); surface /resolve vs /v2/impulses/resolve (08-19); discovery prefers federated dead-relay producer over local (08-10); /v1/resolve-url nonexistent (08-05); wrong host/path/envelope in autonomous emitter (09-02); resolve-URL joiner (09-22); envelope inconsistency across vessels (09-22); fabricated external hosts 7ea7d52/0b80f1b (08-03, gate 1a507d1).

### federation-p2p / node-locality
- 07-29 siloed LLM posteriors hub vs spoke (diagnostic).
- 08-10 relay frozen at module load to decommissioned droplet; spoke registry drained (identity on hub); spoke advertises stale 9-day trace store first; loopback rows arm on restart; starters read local registry (16 vs 187 shapes); RunPod arm wiring; Docker VM vs host CPU boundary.
- 08-09 searched hub journal for local container's commit (4 wrong diagnoses).
- 07-19 vessel connect contract {discoveryEndpoint, apiKey}; /bootstrap relay anchor.

### memory-recall
- 08-09/09-09 teaching channel empty/ungraded; 09-22 two memory stores (EnvironmentFile override) + battery flood displaced conventions (recency-window recall); 08-29 concept-db prune/optimize impossible; 08-10 & 09-13 dead /workspace/gaps/gaps.json decoy (WORKSPACE_ROOT trap, 3 instances).

### calibration-seal / human-surface-escalation
- 08-28 hopeless seal escape = human; 1755 asks, 0 readable answers -> fixed loop (421052c, 9cb83d0).
- 09-14 175 asks, 3 answered; operator silent 16 days; answering = unseal; backlog self-report f169ab1/4bffab0.
- 09-22 (index) escalations to pinned :8270 replaced vessel; 248 unanswered -> seal permanent (recurrence: writer pins a peer).
- 09-21 scalar renderer unreachable; 09-25 surface header counts only displayed 50.

### spend-envelope-throughput
- 08-10 compose storm (30 concurrent on 8 vCPU) was real fault; RunPod 3 workers vs uncapped fleet; 08-29 99.6% metabolism (validator-dispatch 53%, 1ms, unauditable); 09-07 unbounded tag-selection (auditors 61.6%) until rhythms seeded; 09-16 cap=1 lane full of autonomous work refuses directed; 09-22 OpenRouter credits 1399.69/1400; 09-25 half of failed dispatches = pinned scaffold refusals every 90s.

### test-residue-live-state
- 08-09 probe overwrote live trace-store-reconcile template; overlay tests ran against live tree; 08-29 time-bomb fixtures; 09-10 first run in fresh tree differs (tests leave state); 09-22 battery probes minted 578 never-retired notes.

### autonomous-regression / directed-overshoot
- Autonomous: fce961b disabled edit-intent guard (operator's probe asked); ddffdee/29d9b85 404 dependency (twice); 7ea7d52/0b80f1b fabricated hosts; repairCreatedFile URL-as-prompt truncation; apply-path corruption vectors (08-02); unparseable commit crash-loop (index 09-19).
- Directed/operator: f38f1a3 unconditional install pruned node_modules; GOAL_HOST_DRAIN_MS 80->240 latent; escalation suppression removed fallback on transport failure; second in_flight counter wrong; non-idempotent anchor replacement grew 1->4 copies; asResolvePath producer fix overshot consumers (09-22).

### env-gating
- RELAY_MULTIADDR/let RELAY frozen; CONCEPT_DB_ENDPOINT unset; DUAL_WRITE_ENABLED default false; TRACE_STORE_SUCCESS_SAMPLE_ACTIVITIES; LLM_DEFAULT_MODEL pointing at dead provider; WORKSPACE_ROOT EnvironmentFile override forked memory; UPKEEP_INTERVAL_MS in-memory; CPUQuota on tmpfs lost on restart; pinned model literals.

### dormant-mechanism
- rhythm registry empty (09-07); learning_signal_health_observer gated by unreachable volume floor (09-09); credit-primed-concepts wired to wrong drafter; gradeArmByExecution never called; variant_promote unimplemented; T1.2 authority labels inert; SF_BLEND self-arming; recovery/improvise WalkStep sources dead; detect-concept-db-drift exists but not run; resolve-island dead (missing fn); concept upkeep optimizer never trains; premise check near-inert; substrate-doctor REG_FLOOR cadence unconfirmed.

### docs-drift
- Undocumented protocols live only in code (failed-falsifier literal; seal escape verbs; lane rules). docs-drift detector 60/66 false positives. SUBSTRATE_AS_SOVEREIGN.md added as expectation (09-16). development-vessel CLAUDE.md documents variant_promote that doesn't exist.

### codebase-bloat-fossils
- 49 mitosis clones in /vessels never GC'd (08-29); four duplicate switch cases (08-05); /workspace/gaps/gaps.json 819-row decoy; activity_templates vs activity table (2 stale rows); AET frozen shadow table; impulse_shape_activity_score dead channel; registry alias proliferation (shellResult 3 producers for one process); fs_write advertised by two vessels; free-text strings as shape names; 217 advertised shapes never executed; shape_definition empty table; duplicate operator fix nearly landed (8c47914).

---

## Mechanisms (G = general capability at shared seam; S = specific path)
- G live-used: vacuous-edit gate (development-vessel src/vacuous-edit.ts, 4ea5234) + truncatingRewriteReason (92505c5) — refuses unused bindings / >50% shrink.
- G live-used: fs_write/fs_edit/create_file guards at local-tools writer (b42db41, c42410d, 67a9e71) — caught 190,333->41 truncation in prod; guard on both fs_write producers (08-12).
- G live-used: patch_with_tools containment (d4ae359/a2fc845/0e1de31) — 19/425 refused, 0 FP.
- G live-used: L11 fabricated-host hard gate in patch-with-tools (1a507d1) — corpus 2/200, 0 FP.
- G live-used: zero_behaviour_delta gate with string-literal exemption (patch-with-tools, ede0030); blind to no-op reorders.
- G live-used: semantic gate / refuter panel ("immune system", 4-5/5 sampled rejections sound; flips/confabulates occasionally).
- G live-used: per-compose git worktree isolation compose-workspace.ts (8ec501b/f655c8d); patch_with_tools unisolated.
- G live-used: deterministic verbatim floor synthesizeVerbatimEditOps (feature-compose.ts:1945) — works via direct resolve_impulse feature_compose; goal-host edit-intent route transforms spec so it never fires (gap-mu3f0s5a).
- G live-used: repair loop MAX_REPAIR=4 with lit outcomes (170c3d69, 0672a4e2, 44caeaaa, 30237122).
- G live-used: compose traces feature_compose/cutover (4afd4c1, e8e3fec) with route gated|escalation, linked_to_gap; apply_proposal_as_patch/gap_to_feature/patch_with_tools untraced.
- G live-used: reach grading POST /v2/activities/execution-traces/reach (sole VPM grader), widened 09-07; c5f7efb chains off landing traces.
- G live-used: LLM arm posteriors per task type + decay (8eb5e08) + drafting grading chain (6b880960, fec22cbc llmArmOutcome_write, 7792c3e5, 0f47d8ab, 700c70f8); decay clock reset on update (busy arms never decay).
- G live-used: rhythm conductor (rhythm-conductor-tick, FAMILY_GOALS :125, rhythmFamilyGoal writes) — was empty until 09-07 seeding.
- G live-used: escalation loop hopeless() -> needs-human panel -> uiFeedback_write(panel_id, pointer.value) -> solicitation_outcome_scan -> escalation_disposition_apply (bounded exemption 3) — built 421052c/9cb83d0; unattended; later pinned to replaced :8270 vessel.
- G live-used: operator-escalation-backlog self-report gap (f169ab1, 4bffab0).
- G live-used: counterIntegrity in learning_transfer_report (40395ba) — asserts total_executions vs selections.
- G live-used: pathway reuse via shape_signature (23 acceptances) — donor record frozen (no write-back).
- G live-used: ribosome walk extraction (learned-composition-* 538 executions); read-side contradiction fix 86aebdf; blocked for satisfier (MATCHED NO ROW) and resolver-implemented self-dev.
- G live-used: pull-sync quiesce/drain before restart (verified 08-18); --untracked-files=no fix 9333f0f7.
- G live-used: late-landing recheck (EDIT-INTENT LATE-LANDING found on origin/dev).
- G live-used: memoryNote retire primitive (19ae84e).
- G partial: selection-outcome correlation join — ingest 755dca9 + reader 471febb/7413367 closed; producer emits no tag (0/9,614); no credit consumer.
- G dormant: gradeArmByExecution/recordArmOutcomeFromPending (never called until wired via recordArmOutcome instead).
- G dormant: learning_signal_health_observer (volume floor 50 vs 55-row endpoint; no per-source_type).
- G dormant: credit-primed-concepts.ts (wired to wrong drafter; compose lessons never credited).
- G dormant: nine deterministic oracle families in goal-host (never fire on self-generated traffic; count oracle path/ext/recursion defects).
- G dormant: SF_BLEND successor features (self-arming at 200 cells; residual evaporates).
- G dormant: concept-db upkeep Thompson optimizer (state reset by 132 restarts/day); prune activity (unreachable predicate, 0.8% target).
- G dormant: variant_promote (documented, unimplemented); ribosome dispatch_write_attempt applyExtraction default false.
- G dormant: detect-concept-db-drift activity (exists, never run on real condition).
- G dormant: premise check PREMISE WARNING (9f222fb) — 0 fires on autonomous workload.
- G broken: /v2/activities/feedback -> impulse_shape_activity_score (write-only table).
- G broken: goal-host absolute resolve rows concatenated with endpoint (5 call sites) (09-22).
- G broken: trace-spool without replayer (17,587 files).
- G broken: concept-db apply-schema.ts (splits on ';', swallows errors, lies success).
- G broken: stale_open threshold 48h (structurally 0).
- G broken: Restart=on-failure + self-recovery.timer next_elapse=0 (no backstop for clean stop).
- G broken/fossil: activity_execution_traces (AET) frozen dual-write shadow; /workspace/gaps/gaps.json decoy; activity_templates plural table; 49 mitosis clones ungc'd.
- G duplicate: registry alias proliferation (hub re-federates own vessels via :8401; shellResult 3 producers); fs_write advertised by 2 vessels; four duplicate switch cases goal_verification_label.
- S live-used: threaded compositional routes rank-then-aggregate/two-source-compare/group-then-ratio (06b66d8, e874a19) — per-class hand-built deterministic routes.
- S live-used: NORMATIVE_INTENT in isPathlessCodeChangeGoal (lexical gate widening).
- S live-used: isTransientIdentityFailure (160b660) shared transient classifier.
- S live-used: UNTRIED_PRIOR_BETA=3 (12e811e) — not behaviourally validated.
- S live-used: interpreter facts in executorGuidance (1be9f4f).
- S live-used: scalar render rescue of default (09-21); RenderPlan.decidedBy required.
- S live-used: substrate-doctor registry floor (REG_FLOOR) and doctor 4b registration starvation (noisy).
- S fossil: probe-era instruments (watchers with inline parsers) — operator-side only.

## Principles / laws stated in this shard (with note #)
- Before declaring an EXTERNAL blocker, check whether supplying the information yourself made it work; a blocker classification is a hypothesis (1, 6, 32, 38).
- Encode laws as executable assertions in the dispatch builder (anchor not in replacement; no backslashes) — non-idempotent edit + retrying lane = unbounded growth (1).
- To stop a runaway edit close every CARRIER of the intent (enumerate by edit_site), not the gap you filed (1).
- The semantic gate is the immune system; fix the ambiguity it latched onto, don't relax it; one false rejection is not a rate (1, 4).
- A defect that stops appearing may have died, not been fixed — check the code still runs (2).
- A guard living with one producer of a shape is a coin flip (2).
- Gates screen shapes of edit; well-formed edits that do the wrong thing pass (2, 19).
- Grep EVERY call site; one named joiner over N concatenations; a fix can overshoot at the junction it repairs (3, 37).
- The substrate APPLIES a specified change reliably (80%) and cannot DERIVE the change from a problem (2.5%); the bottleneck is gap-content correctness (4).
- Never quote reach without splitting by author and by layer (compose/git/label); decompose the denominator by population before attributing a step (4, 70).
- Cross a well-powered split with the variable that drives the mix (Simpson) (4).
- Measure a check's firing rate on the actual workload before hardening it (4).
- Budget is cost; a scheduler that cannot run under load cannot recover the schedule (5).
- Autonomy unbounded is not autonomy proven (5).
- Adding an arm does not route traffic to it (6).
- Classify real content with the production classifier before theorising; "branch exists" != reachable; a REQUIRED field is the cheapest non-vacuous gate (7).
- When dated comments disagree the dated one wins; don't fix a metric by feeding it the wrong evidence class (8).
- Answering an escalation is an unseal; queue length is not the metric (15).
- A self-report built on a UI panel store inherits its staleness; count the store of record (15).
- A gap summary must describe the DEFECT, never the correct state; editing a gap is a dispatch (17).
- A repair that deletes the complaint is not a repair that keeps the invariant; checks after deps present cannot see dependency regressions (17).
- A revert does not remove the demand — teach at the site the next attempt reads (19).
- Write-only-ness is not decidable from a diff; run the existing suite before believing a new gate (19).
- Never substring-match a machine identifier for meaning; POST /resolve executes (24).
- A fluent reason is prose, not evidence (25).
- Check the CALLER SET of every mechanism; existence and wiring are independent; a detector reporting healthy/cold start — read its gate before its verdict; when a success counter is 0 read the failure counter (26).
- Use a throwaway id when the success path WRITES (27).
- An empty parse trusted as a measurement is a decorative gate (28).
- Absence of evidence arriving as evidence of absence is the most expensive reflex; when consecutive checks overturn you the fault is where you look (29).
- Never dispatch a probe whose literal satisfaction would weaken a safety property (29).
- A zero from one store is a routing question before it is a fact; datetime conjuncts eat partners in SurrealQL (30).
- A saturated resource is as often a symptom of an uncapped producer (31).
- A detector that logs is not a detector that gates (33).
- Count the occurrences of the region literal before gating patch quality (34).
- A loop with no log is indistinguishable from a loop that never ran; loops that exit for opposite reasons must say which (36).
- A counter must be validated against an independent census; a guard routing on request shape must read failure kind (38).
- When an audit's headline contradicts its own numbers, the numbers win (39).
- Divergent posteriors for the same resolver in two pools = staleness/poison signal (40).
- Test the parser against a real response; poll the artifact not the process; a falsifier pattern must not match the pre-change file (44).
- When a fallback path violates one obligation of the primary path, enumerate its other obligations (45).
- Size a class by intervention, not grep; a noise floor from two different trees is worse than none (46).
- Verify persistence by a store hit with correct auth+table (47).
- A posterior cannot defend against a generator (54).
- Test hard-fail predicates against REVERT commits (63).
- Execute the landed request against the live endpoint; never grade a diff (58).
- Recency-window recall + unbounded writer = amnesia by displacement; env-derived store paths silently fork (58).
- Restart=on-failure cannot recover a clean stop; only enabled-but-inactive + restart count sees all outage kinds (59).
- "Selected" is not "served"; a wrong label is worse than a missing one (70).
- "Fires" -> "moves the number" -> "moves the decision" are three claims (70).
- Decay keyed to time-since-last-touched never retires a busy arm's stale prior (70).
- Two individually-sound rules (one file per goal + refuse unconnected) can leave NO path for cross-file changes (70).
- A zero is not a refutation until the window exceeds the expected inter-arrival time (70).
- Read the comment explaining why a scope is narrow before widening it (the narrowness is often a scar) (70).
- A prose string in a summary can be an API (db-admin.ts:78) (70).
- A trace row can contradict itself; the later, better-informed value wins (one-directional) (71).
- Emitting an authoritative signal requires retiring client heuristics for the same fact (68).
- Env-facts must be in the PRIMARY prompt; steer to available tools, not just forbid missing ones (69).
- A field doing double duty (relevance denominator + prune predicate) makes the prune unreachable (72).
- A silently-ignored filter is worse than a 400; implausibly clean numbers are often windowing artifacts (73).
- Never commit operator work under Substrate Autonomous; honest split identity author=Substrate/committer=operator when landing substrate bytes whose push lane is missing (74).

## Coverage note
74 files (sorted positions 676-750 of memory/*.md), all read in full. Frontmatter description lines stripped during extraction; bodies were the source. Two files undated in title (reference-vessel-connect-contract.md ~07-19, reference-vessel-startup-decoupling-requires-to-wants.md 07-23). The 09-22 ":8270 pinned escalation" recurrence is cross-referenced from MEMORY.md index (in context), not from a shard file. No secret values present (env var NAMES only).

## Honest outcome corrections (fixed -> later found partial/broken)
- Escalation loop 421052c/9cb83d0 (08-28 worked) -> unattended 16 days (09-14) -> pinned to replaced :8270, 248 unanswered (09-22): superseded/broken.
- 62da19fa anchor hint, 19bbb8b/e670b69 grounding, 9f222fb premise check: mechanism fires, landing rate unchanged: partial/dormant.
- 92505c5 truncation guard: path already dead: partial. 8eb5e08 decay: busy arms never decay: partial.
- 12e811e untried prior, 94f4649 goal-bound landing evidence: never behaviourally validated: unknown.
- 948d085: loud failure -> silent skip: partial. 755dca9 correlation: 2/4 joints, producer 0/9,614: partial.
- b21b309: cause retracted: superseded. 4afd4c1/e8e3fec: 3 resolvers still untraced: partial.
- ddffdee reverted 956e464, recurred 29d9b85 (404 dependency, twice).
