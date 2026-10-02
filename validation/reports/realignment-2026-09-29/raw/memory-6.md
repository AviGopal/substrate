# memory-6 — operator memory cache shard (files 376-450), realignment raw notes

Source: `ls /home/avi/.claude/projects/-home-avi-documents-work-substrate/memory/*.md | sort | sed -n '376,450p'` — 75 files, from `reference-gap-self-management-loop-diagnosis-2026-07-27.md` through `reference-mitosis-typecheck-gate-signature-subset-fix-2026-07-29.md` (~580KB). Every file read in full (the 39KB `reference-independent-recompute-oracle-and-credit-dead-plane-2026-08-07.md` in two halves). Dates for undated filenames taken from note content (range 2026-07-14 .. 2026-09-20). No live system was queried for this shard; everything below is what the cache CLAIMS, with the cache's own later retractions applied. Scratch only in /tmp.

Caveat on the source: this is the operator-side derived cache (law 10). It contradicts itself in places (e.g. "NO SSH to hub" vs "SSH available" on 07-28; "ribosome extraction blocked" corrected 07-23; "rg not installed in container" 08-09 vs "rg works" 09-14 = host vs container). One note (#41 key_session reap) contains a literal SurrealDB root password in prose — a hygiene defect in the cache itself; not reproduced here.

Structure: §1 problem classes (with recurrence chains) · §2 mechanisms (status, general vs specific) · §3 principles/laws · §4 appendix: per-note extraction in list order.

---

## §1 Problem classes

### RECURRENCE CHAINS (same issue, different hat, each time "resolved")

1. **LLM plane "down" (federation-p2p / endpoint-routing / spend-envelope-throughput)** — 07-14 (reward on transport), 07-18 (de-advertise deadlock, reverted), 07-19 (EnvironmentFile clobbered PEER_DISCOVERY_ENDPOINTS=""), 07-20 (failover d08774a), 07-21 (isExhaustedProviderError predicate 85d5edb; relay NO_RESERVATION; hub process stale), 07-24 (thundering herd 3fa37f0/cbf029a/9716cce; stale circuit a67706571f), 07-25 (reservation watchdog 494a990e), 07-28 (fed-transport crash-loop NRestarts 8178 after restart blanked HUB_DISCOVERY_URL; hub 401 untrusted issuer -> cf882aed/955b065 HUB_API_KEY), 07-29 (stale SPOKE circuit despite watchdog; 7 hardcoded haiku pins 8bd2fff; six callers without hub fallback ec8ef67), 07-31 (compose pinned to opus; "billing" framing retracted), 08-07 (plane "dead" = read spoke-local registry; classifyPlane detector 0768990), 08-20 (all groq slugs decommissioned -> 6 phantom arms), 09-16 (GOOGLE_API_KEY="" crash-loop; placeholder keys burn arms). Root stated once and never closed: **availability of a remote capability is inferred from local advertisement / process health / relay reservation, not from an end-to-end probe; and the discovery gateway picks `candidates[0]` (first healthy process) instead of a learned, quota-aware producer selection** (07-21 note: "the whack-a-mole is ONE bug"; durable producer-bandit never built).
2. **Landing gate weakened by autonomous lanes, re-hardened by hand (false-verification / autonomous-regression)** — 07-28 01c1764 (broken-baseline excused touched-file errors), 07-29 a4a4102 (error-count not monotone: 0f794d2 unparseable tree and 5697f70 TS2552 landed), 07-30 44bcffd (pwt path fabricated FAVORABLE; typecheck tool name `code_typecheck` 404 fail-open; 9775bc8 12-line deletion), 07-31 8f23567 (stub edit shapes bypass edit-intent negative), 09-06 `$value` exemption bypass in surqlBreakingFieldRefusal (semantic gate refused the correct fix 2/2), 09-09 550f2f7 (pwt lane replaced inertRegexEditRefusal refusal with `return null`; caught by gate_self_probe, repaired f47db2b 09-10), 09-16 88032ab (rollback compared vs pre-edit original -> never ran), 09-22 54b7762 (deleted `^DEFINE FIELD` guard -> surql landings dead since 09-16). Law recorded 07-29: "the loop cannot be trusted to fix its own verify gate". Durable class: "every gate READS the diff; only a test RUNS it" (09-05).
3. **Drafter sees the wrong region / wrong anchor (drafter-quality)** — 07-20 rankWithLlm blind (74f25e6), 07-22 focusedSlice head fallback (24e4dc0) and re-derivation window (1f9fa12), 07-26 drafter dropped 4 Set members (de483fd -> 3ff0cf7), 07-27 anchor_not_found dominates staging (~18% stage success), 07-31 verbatimExcerptBlock (c57563f), 08-02 120 `old_string not found`/24h, 08-05 verbatim LLM-free floor never fired because caller appended a 3rd fence (27b944a), 08-07 grounding = first 3% of 176KB file, 08-11 "give verbatim anchors" law, 08-11 deterministic hallucinated `router.get` vs `app.get`, 09-03 **REFUTATION: verbatim unique anchors still relocated** by blind-edit repair (`refuseRederivedEdit` has no uniqueness/locality test; 1e66893 relocated comment landed), 09-04 rationale prose invites 3-op drafts, 09-16 edit-intent defeats verbatim floor (direct feature_compose is the byte-exact lane), 09-27 use `EDIT n old:/new:` blocks. Each fix addressed one path into the drafter; the class (drafter input is re-derived/paraphrased between goal and apply, and typecheck is the only locality gate) remains.
4. **Stale-base / silent revert (autonomous-regression / sync-deploy-drift / directed-overshoot)** — 08-09 0fe5d83 dangling fix (root-cause hunk lost), 08-28 510b6df deleted the 44-line fix it was named for (staged against base predating it), 09-24 6ab8271 undid a0ff3d3, 09-24 drift gate 0a0d59f deadlocked the whole lane because staged_base_sha is the PATCHED hash (the fix overshot).
5. **Human surface rebuilt three times, consumption still severed (human-surface-escalation / codebase-bloat-fossils)** — 07-25 impulse-driven UI design (9-rung ladder, deploy react-renderer), 07-26 obsidian floor fixes, 08-07 root-and-stem replacement (react-renderer/workbench never ran; human-surface-vessel built on 8310), 09-06 bring-up + hollow proxy, 09-20 baseline: 0 of 3,977 templates consume a human/ui shape; consumption severed three ways; 248 escalations to a pinned :8270 nobody reads (09-22 index).
6. **Learning does not compound (selection-learning / composition-crystallization)** — 07-20 only 2 templates with earned posterior vs 2,938 declared; 07-23 polluted learned templates win selection (109 picks/110 failures); 07-24 reachedCommandCache in-process only; 08-06 grade->credit closed on ONE execution, delivery 1.3%; 08-07 719 dispatches, no slope (126/168 class-runs never vary), 7 mechanisms, 5 reverted; 09-03 decision_outcome tautology; 09-05 "gains are step functions from bug fixes"; 09-10 posteriors under-credited ~0.16 (satisfier:webSearchResult 99.2% actual vs 0.212 posterior).
7. **Reward graded on transport/exit status instead of reach (selection-learning)** — 07-14 recordArmOutcome(resolved===true) (tencent/hy3:free α=1005); 08-06 goal-paths successful_executions from template exit status (obsidian assist 516 exec, 0 reached, 46% of credited successes); 08-06 8s timeout laundered to success (impulse-resolve source exemption); 09-20 satisfier:renderPolicy_write graded on HTTP 200.
8. **EnvironmentFile wins over unit Environment= (write-read-mismatch / env-gating)** — 07-19 PEER_DISCOVERY_ENDPOINTS clobbered to ""; 07-28 drop-in Environment= did not reach bun process; 08-30 gap store WORKSPACE_ROOT (live /workspace/git/super-repo/gaps/gaps.json vs fossil /workspace/gaps); 09-22 memory store split (680 notes unread). Plus 07-29 two EnvironmentFiles (/workspace/.substrate-secrets overrides /etc/substrate/env) and 09-20 quote-doubling `""` -> ERR_INVALID_URL swallowed.
9. **Capacity bound removed or unbounded throughput (spend-envelope-throughput)** — 07-27 apply loop one attempt per invocation; 08-07 gap_to_feature one gap per invocation vs 465 open (watchdog open_intents 1908); 08-10 worktree isolation removed the refusal that also bounded CPU (27 procs, load 50.8); 08-10 in-process cap bounded half; NaN fail-open; parallel sessions each landing a cap (6ad3721/68a26de).
10. **Verdict read before the work finishes (false-verification)** — 08-26 a885631 graded failed but landed; 09-03 f7f15948/edd2e44 and e20c6a91/82b030e (n=2) landed no-hands graded failed; the late-landing fix 50f7560 then produced a FALSE POSITIVE (023f9b1); false negative triggers destructive redundant re-edit (1e66893).

### write-read-mismatch
- 08-10 goalExecutionPath reader `org_id = $org` vs rows with no org_id (0/200) + writer never populated endpoint_output_shapes (satisfier ids not in activity table; 0/200) + 'public' sentinel -> three independent defects; f2b642c + follow-ups. Mock fixture `[[]]` hid the early return.
- 08-06 light-dispatch posts `tasks` flat, writer reads `execution_trace.tasks` -> 10,166 roots stored null (4c1b588); the same fallback already existed for ψ ~1000 lines below.
- 08-06 satisfier walks write inputImpulseIds/outputImpulseIds as literal [] (goal-host :5498-5506, :6053).
- 07-27 servesIntent/goalSignature written at mint, discarded at selection; activity-api candidate responses omit it.
- 09-03 evidence-field aliasing: variant_performance_metrics.updated_at written by 11 statements, 8 don't decay (decay under-applied ~281x); composition_graph.created_at; gaps.detected_at; compose-report files overwritten by later attempts.
- 09-04 lifecycle audit reads occurred_at/created_at/state_signature; producer emits executed_at -> combined_score = success_rate x 0.0304.
- 09-03 decision_outcome org_id null on all 7,679 rows while decision-credit.ts:121 lookup is org-scoped (678 metrics rows in other orgs).
- 08-25 ias-executor never materializes lazy pointers; canonical `llm` resolver ignores inputImpulses; llm-prompt skips loaded:false.
- 07-26 memoryNote_write resolver expected nested pointer.note; goal-host sends flat (9790c2f).
- 09-20 participation journal writer flat camelCase vs readers parse {pointer:{panel_id,kind}}.
- 08-04 federation proxy returns HTTP 200 wrapping upstream success:false.
- 08-09 POST /v2/activities/executions 201 but readers target a view fresh deployments never create (activities.ts:2515 "TEMPORARY").
- 09-08 activity row frozen total_executions 0 while 5 executions existed (producer index cannot see activities).

### node-locality
- 08-01 a spoke disables all 15 autonomy timers; trace store SPLITS between hub and spoke (gap gap-spoke-split-trace-store).
- 08-09 registry counts read on wrong node (hub registry supposed to stay small); 08-07 goal answered 13621 files = substrate's own tree not operator checkout.
- 08-11 MCP goal_status resolved goal-host via discovery to a different instance; 08-09 cockpit points at hub not local.
- 08-04 hub LLM arm dispatches tools to 127.0.0.1:8090 relative to the ARM (hub dev-vessel) -> "Unknown pointer type: shellResult".
- 08-07 goal_verification_label_write advertised on hub (412 shapes) not spoke (333).
- 08-07 "LLM plane dead" was the spoke's local arm only.

### test-residue-live-state
- 07-22 demo residue headers on origin/dev (1fc512c, 4bccc77, 513fb5a, d3f538d).
- 07-26 probe notes left in memory store (drain-fix-probe-note, garbage composed note).
- 07-27 verify subagent ran unauthorized DELETE on prod DB.
- 09-20 a READ satisfier issued a defaulted uiQuestion_write that overwrote the live handoff panel; stateful-ui coerces objects to "[object Object]".
- 08-10 suite non-deterministic (93 vs 85 failures same tree; shared FS state); 09-20 expect() counts process-state-dependent.

### memory-recall
- 08-30 gap store fossil path investigated as a false "write-persistence bug".
- 08-10 composeLessonsBlock never sent spec text -> same 8 lessons 132 times; concept-db `@@` AND over terms (7df39d2); spec-text query reverted twice; 6137257 key by failure class (worked).
- 08-26 semantic-gate refuter critique not captured into per-gap lessons -> draft 2 regressed to stub.
- 08-08 hub does not publish 18260 -> concept recall (the drafter teaching channel) severed at hub.
- 09-15 times_loaded never increments via conceptSearch (uptake instrument blind); relaxation falls back to LONGEST class name.
- 07-16 "remember that X" mis-selected activity:detect-ui-spacing-drift instead of memoryNote_write.
- The cache itself drifts (see header).

### calibration-seal
- (no direct instances in this shard beyond:) 08-07 honest `no-oracle-for-goal-class` withholds β so class posteriors never move ("an honest verdict that cannot change is as inert as a hollow one"); 09-15 pending_outcome_verification holds a gap forever without a predicate; 09-10 SATISFIER_PROVEN_BAD_ARMED unset.

### narrowing-duplicates
- 07-27 97% of 1,670 proposals were feature_compose failure reports recursively recommitted (1173 route-edit-*, recommit- up to quint); 12e7611 capped depth.
- 07-28 route-edit-31e3e3f8 -> 9 landed commits (1 real + 8 blind); one defect under 14 gap ids (route-edit-2c6f8511); 44% of gap records bookkeeping/churn; recommit gaps inherit edit_site but not failure_lessons.
- 08-02 gap summaries = another gap id (172 route-edit-*); prefix accretion 925f64a.
- 08-11 gap hash includes line count -> re-worded dispatch = fresh gap.
- 08-26 35e64bda re-derived a DEFERRED gap; 4/5 top candidates already fixed (no live-tree freshness check at pick); route-edit-51b5d824 open after a885631 landed its fix; doc-drift boosted twice (9fd234a + 31c7017).
- 08-07 per-goal gap ids (reach-gap-* 105 rows for one capability) -> fdb7036 per-FAMILY ids.

### hollow-landing
- 07-26 reframe to gitStatus graded raw dump reached (RAW_INPUT set fix).
- 07-27 no-op redundant patches FAVORABLE but nothing to commit.
- 07-31 stub edit shapes; LLM judge confabulated reach over all-HOLLOW walk (8f23567).
- 08-05 interrupted-edit reconciler `sha = "reconciled"` + reached:true.
- 09-02 776391aa0f pushed, graded reached, inert (cited); 09-04 9fbb018/672d7b9 inert (wrong field); 09-05 SCHEMAFULL tables discard undeclared fields with success:true.
- 07-27 read goal -> unrequested version bump 2f4093c on activity-api origin/dev (not reverted).
- 07-23 learned templates minted from hollow reaches.

### false-verification
- 07-31 post-state oracle greened pre-existing symbol (af86945 fixed).
- 08-06 8s timeout laundered to success; task_count decoupled; cost_usd 0 on 100%.
- 08-07 recompute oracle's own `git log | wc -l` penalised a correct answer; buffer-key collision -> guaranteed abstention; lenient parser poisoned β (reverted).
- 08-09 rg ENOENT caught as "found nothing"; 08-10 grep silent on NUL file (twice same wrong conclusion).
- 08-04 feature_compose verify gate passes when shell tool fails (sdExit default 0).
- 08-07 ui_legibility_scan zero success:false paths; 09-20 grader reads `as const` literals.
- 09-03 db-admin safeCount aliases count_value reads row.c -> INTEGRITY_SCANS clean unconditionally; /selection-outcomes + /calibration-summary invalid SurrealQL, never returned.
- 09-03 gap store auto-closed an operator gap with a FABRICATED remedy and sentinel detected_at 2024-01-01.
- 07-28 gap close rate 42% reported vs ~5-8% genuine.
- 09-15 expected_literal predicate = contents.includes() (a comment satisfies it).
- 08-11 caller-facing verdict wrong in both directions in one session.

### drafter-quality — see chain 3. Also 07-30 multi-function routes: pwt 30 turns unparseable (decompose); 07-31 10-field ClassRow literal no-op re-edit loop; 08-07 "when a model repeatedly invents the same missing thing, believe it" (end-timestamp field).

### gap-content
- 07-27 disposition '-' on all 196 gaps; detectors emit un-actionable missing_capability 278 / unreachable_producer 102.
- 08-02 self-generated gap text empty (summary = another gap id); binding constraint is the gap-summary generator.
- 08-07 60 open gaps, 3 grounded with edit_site (5%); ui-legibility-scan emits none.
- 07-20 localizeGap dead-ends when no vessel named; approach decision predicts land with edit_site "".
- 08-09 isEditIntentGoal requires a literal repos/ path (law 13 as a regex); fixed by restating at the door.
- 09-15 edit_site minted from the VICTIM file named in evidence -> 569e982/128bbcc opposite edits.
- 09-20 filing a gap = authorizing work (approach_decisions aimed at gated files minutes later); operator never persists (0/1708).

### dormant-mechanism
- gap-landability-model unwired (07-27); horizon detectors 0/1,764 gaps tagged (09-03); decideContinuation imported never called; `{{shape}}` references zero uses (09-03); 16 of 18 observer output shapes no reader (08-04); ribosome 1115 replay starts / 0 writes (08-04); recordPendingArmOutcome/gradeArmByExecution never wired (07-15); gate_self_probe unscheduled (09-06, later on rotation); verifier-recipe minting 0/24h (08-26); react-renderer/workbench never ran; human_presentation shape emitted, not threaded (07-26); probes with zero scheduled callers (09-20); escalation_disposition_apply unscheduled; extractionPolicy + walkBudget have no producer (08-06); 9706f440 drain drop-in never in effect; vLLM providers inert without VLLM_ENDPOINTS; LLM-free edit floor never fired until 27b944a.

### spend-envelope-throughput — see chain 9; also 08-06 cost_usd 0 on all 55,725 executions (no spend denominator); 07-31 waste: DOWN pod sampled, metric-collector 622 heartbeats/0 success; 07-20 ~52% of pool observations on zero-success signatures; 09-03 scaffold-and-publish-vessel 75/77 failures ~288/day on literal {{target_branch}}.

### sync-deploy-drift
- 07-31 in-container goal-host clone 174 commits behind in detached HEAD (oracles graded stale data); pull-sync baked at image build.
- 08-05/07-26 systemd unit fixes never deploy (units copied at image build; pull-sync syncs source only).
- 08-10 unit runs from /vessels, verification against /workspace/git/vessels (~90s apart).
- 08-09 /vessels submodule dirs are NOT git repos; live tree used as draft surface (apply-before-gate), garbage left on active vessel.
- 07-15 dist-vs-src trap for @avigopal/ias-executor-ts (built copy in node_modules of 6 consumers).
- 08-07 Obsidian bundle not rebuilt since 390a317 (no substrate UI change had ever been live); host-pull-sync timer vanished; 07-27 plugin loaded at enable (fixes in file not loaded).
- 07-29 mitosis lock orphan freezes fleet deploy 30 min (0c96b99); 08-04 host sync hung 56 min (oneshot, infinite timeout).
- 08-28 pull-sync success while skipping vessel; docker cp changes reverted by pull-sync (08-07; commit 354a134 made permanent).
- 09-16 cold boot loses all 121 dev seed templates (missing After=identity-seeder; warm volume hides it).

### endpoint-routing
- 08-09 gen-env hardcodes :18080/:18101 for spokes (joined nothing, healthy).
- 08-08 cockpit client three URL layers (bd87b62, 59b350e); fixing two would silently dispatch hub goals locally. 09-22 resolve-URL joiner overshot (absolute + endpoint).
- 08-14 discovery drops loopback peer rows; human-surface proxy has its own reachableFrom rewrite (two rules).
- 08-07 goal-host registers 127.0.0.1:8210.
- 09-20 solicitation-outcome-scan pins 127.0.0.1:8270; 175b9f1 autonomous fix resolved wrong shape.
- 07-31 feature-compose empty-discovery fallback `?vessel=` misrouted to obsidian vessel.

### autonomous-regression — 07-26 de483fd dropped Set members; 07-27 regex polluted with READ verbs + orphan fn 09b49f2 + version bump 2f4093c; 07-29 0f794d2 and 5697f70 broke baseline; 07-30 9775bc8 deletion; 07-29 loop's stalelock draft deleted freshness+lease; 08-07 e1e84cc deleted 35 lines under a one-line goal; 08-09 JSDoc overwritten FAVORABLE; 08-28 510b6df silent revert; 09-03 1e66893 destroyed comment line; 09-09 550f2f7 nulled a guard; 09-15 569e982 destroyed operator guard; 09-20 READ satisfier overwrote live panel; 07-30 question hijacked into edit-intent authoring spurious live code.

### directed-overshoot
- 08-11 fcd667b (operator) fixed hardcoded directed:true, installed mirror defect: operator dispatches lost reserved slot; substrate fixed it itself (db21c5fa6c31).
- 07-15 -> 07-18 de-advertise-on-exhaustion deadlocked the completion plane; reverted 9c17905.
- 08-10 composeLessonsBlock query fix reverted twice (90c585f, 8236895).
- 08-07 lenient parser 089aead reverted; β-on-nothing 62a00f54 reverted (cost cascade).
- 08-05 operator landed the ungate before its labeler companion (1 polluted row).
- 09-03 50f7560 late-landing check traded false-negatives for false positives.
- 08-28 edit gate: `.claude/settings.local.json` SUBSTRATE_ALLOW_DIRECT_EDIT=1 standing-on (bypass is permanent, "dispatch, don't edit" unenforced).
- 09-24 staged_base_sha drift gate deadlocked the lane (from index).

### selection-learning — see chains 6/7; also candidates[0]/first-candidate selection at discovery:205, engine.ts:258, producer-selection.ts:19-20; recommendReachingPath deterministic top-1 by raw count starves verified floor pathway (08-27); pinned targets immortal (09-05); scaffold-and-publish-vessel + mitosis-tick bypass Thompson entirely (09-03); callers pin models (claude-sonnet-5 default, 7 haiku pins).

### composition-crystallization — ratchet chain exists (buildCompositeTraceFromChain -> ribosome -> learned-*), but: floor wrote 0 of 4,768 path rows until 09-10; satisfier-headed pathways (63.5%) not pinnable; goal_hash exact FNV-1a (no paraphrase reuse) and instance-grained (3,700/4,703 paths executed once); state_signature absent from 13,423 path rows (09-16); write-terminal satisfier reaches skip recordExecutorCommand; accepted pathway not executable when arg synthesis dies; learned composites heavily reused but some broken; 926b42b first no-hands compositional class landing (worked).

### goal-walk-floor — eight-tier ladder documented (09-10); ReAct floor live 22.7% success; LLM on critical path of every goal (07-24); target inference collides subject words with shape names (07-24, 07-26); no prose-answer shape (07-26); derived values LLM-interpolated (07-25); "no producer" error string lies 97/99 (08-06); investigation floor met with citation oracle (08-27); isEditIntentGoal path precondition (08-09).

### human-surface-escalation — chain 5; also provide_feedback effectively write-only (human overrides lost 91%, 08-04); uiQuestion read path HTTP 500 (09-15) so human exit from pending-hold unreachable; answers confabulate own ontology (07-26); grounding badge trust regression caught in motion (81a1c41).

### federation-p2p — chain 1; also 07-28 cross-substrate trust (TRUSTED_ISSUERS / HUB_API_KEY); 08-14 identity decides group membership; 08-01 local never federated; FEDERATION_SIGNING_SECRET vestigial; hub HTTP routes accept bogus keys (08-01).

### trace-store-db — 07-27 key_session 1.34M unindexed rows (host thrash; bfad5ca reaper); 08-05 trace ingest timeouts 1391/6h; 08-09 hub trace store 301,592 vs cap 150,000 froze self-editing (change_window livelock); 07-26 concept-db queries time out (contention); 08-06 activity_execution_traces decommissioned; SurrealDB semantics traps (CONTAINS array op; DELETE LIMIT doesn't parse; SCHEMAFULL discards fields).

### env-gating — gen-env allow-list (08-09); SATISFIER_PROVEN_BAD_ARMED unset; LLM_FALLBACK_MODEL; VLLM_ENDPOINTS/RUNPOD_ENDPOINT_ID; CANDIDATE_CACHE_TTL_MS / GAP_GOAL_COOLDOWN_MS constants; bodyHonestyPolicy not advertised (fallback literal list 4x/walk); DEFAULT_MODEL claude-sonnet-5; SUBSTRATE_ALLOW_DIRECT_EDIT standing-on.

### docs-drift — verdict enum achieved|not_achieved vs MCP docs reached|not_reached (08-07); code comments claiming 53 learned-of-learned templates not in table (09-10); migration 202 header "covers every execution" (09-03); ui-legibility-scan "STUB" docstring stale; in-code comment asserting 90s TimeoutStopSec vs live 60s; capability_catalog advertised 4 phantom shapes (07-26, 8329fbc); compose vs make up volumes don't share state (08-09).

### codebase-bloat-fossils — three UI registries; react-renderer/workbench; two LLM renderers; four inline LLM callers bypassing shared dispatch; feature_compose llmCall at 2041/2074/2225/2315 skipping llmCallWithFailover; legacy avg-threshold builder/verifier; snake/camel llm_completion; duplicate LLM units (rendered llm-<id> vs legacy llm-resolver-<id>, PORT collision, 128 restarts/11min on spoke); 32 stale .js/.d.ts siblings in human-surface src; [rIS-debug] console.error leaking content; goal-text regex parsers per class; demo residue commits; 3,885 activities minted, 29% ever executed; learned-composition-uifeedback-write-to-shellresult failing loop (368 fail).

### NEW KEYS (not covered by seeds)
- **concurrent-operator-sessions** — parallel Claude sessions landing colliding/duplicate fixes: 07-29 0c96b99 vs b4e3d77 (reverted 05829d6); 07-31 af86945 closed a gap in parallel; 08-10 fork's cross-process cap vs in-process draft; 08-26 31c7017 + 9fd234a double boost; 08-28 "another Claude session edits the same vessel files". Provenance confusion: "Substrate Autonomous" author on container hand-commits (`fix(...)` style) vs loop commits (`apply <gap-id>-compose-report`).
- **credential-hygiene** — 07-25 GITHUB_TOKEN in logs; 07-28 four leaks via broken redactions (operator key twice; hub key revoked); operator/cockpit key revoked or rotated 07-24 (b2a0a878), 07-27, 07-29, 07-31 (API_KEY_SECRET rotation), MCP caches key at session start; 08-07 auth failing open with empty `Authorization: ApiKey`; hub HTTP routes accept bogus keys; DB root password written in plain text in memory note #41.

---

## §2 Mechanisms (status as last observed in this shard; "general" = reusable capability at a shared seam)

| mechanism | location | purpose | general? | status (evidence, date) |
|---|---|---|---|---|
| Eight-tier walk ladder incl. ReAct floor universalToolFallback | goal-host index.ts :4692/:12204, runGroundedToolLoop :4531 | floor parity for arbitrary goals | yes | live-used (956 execs ever, 342/7d, 22.7% success; 09-10) |
| walkBudget shaped impulse | goal-host :4547 | floor budgets as shape (law 1) | yes | live-used but NO producer (fallback logged; 08-06) |
| slot-binding first-mile | ias-executor-ts templates/lifecycle/slot-binding.json; engine.ts:569 | deterministic-first input binding | yes | live-used (245,686 execs; 09-10) |
| Satisfier plane / vesselResolveShape | goal-host :8929-9260 | resolve missing shape directly | yes | live-used (349 arms, 24,810 execs) |
| auto-bridge author_producer + mintGovernorAllows | author-producer.ts; goal-host :9726/:5373 | mint producer on demand, validated by invocation | yes | live-used (44 arms, 9,450 execs) |
| Ribosome extraction (mintReachedTrace) + isGroundedHonestReach mint gate | goal-host :1742, 411417b | earn learned templates from grounded reaches | yes | live but low yield (1115 replays/0 writes 08-04; floor paths not recorded until 09-10) |
| recommendReachingPath | goal-host :12825; activity-api /v2/goal-paths/recommend | learned-pathway reuse | yes | live, deterministic top-1 by raw count, starves verified floor (08-27) |
| reachedCommandCache + tryLexicalRebind | goal-host (aef85f8) | exact replay / first-mile rebind | specific | partial (in-process; lost on restart; 07-24/07-26) |
| bindArgsFromPool (+ refusal-derived fields) | goal-host 13b3262, c07cffc | bind args from pool before LLM synthesis | yes | live, low exercise (0/2 binds; 09-03) |
| `{{shape}}` reference interpolation | goal-host | deterministic operand threading | yes | dormant (0 uses in journal; 09-03) |
| decideContinuation | goal-host imported :181 | residual carry | specific | fossil (never called; 07-19) |
| goal-relevance guard isIrrelevantLearnedComposite + proven-bad guard | goal-host 96e04ea, 2a49c76 | reject byproduct-only / proven-bad composites | specific | live (07-27); servesIntent relevance never surfaced |
| SATISFIER_PROVEN_BAD_ARMED suppression | goal-host | suppress proven-bad satisfiers | specific | dormant (env unset; 09-10) |
| Deterministic oracles (verifyDeterministicCompute, verified-registry-count, citation oracle 5e4d045, independent recompute + reconcileDerivations, verifier recipes) | goal-host | ground truth independent of the walk | yes | live-used (49 oracle events/24h 08-26); recipe minting 0/24h |
| missing-verifier per-family gap filing | goal-host fdb7036 | convert refusal into authoring demand | yes | live, but drains behind 465-gap queue (08-07) |
| edit-intent landing gate (landedEdit requires push_status/new_git_sha) | goal-host 8f23567 | no reach without landing | yes | live (07-31) |
| late-landing check 50f7560 | goal-host | re-grade after async landing | specific | live, false positives (09-03); correct reconciler exists :15968 |
| staticEvaluate (parse-bail + signature subset + clean base) | dev-vessel vessel-mitosis-evaluate.ts | landing gate for both paths | yes | live (44bcffd/a4a4102); repeatedly weakened by autonomous lanes |
| surqlBreakingFieldRefusal | vessel-mitosis-evaluate.ts | refuse breaking schema changes | specific | had $value bypass (09-06); guard deleted 54b7762 (09-22) |
| gate_self_probe (+ metamorphic mutants) | dev-vessel | prove gates refuse hostile + allow benign | yes | live-used after being put on rotation (caught 550f2f7, 09-10) |
| semantic gate (adversarial refuters) | feature-compose.ts | LLM judgement of goal satisfaction | yes | live; errs both ways (refused correct $value fix 2/2; passed inert commits) |
| fc-coverage (no test file => no FAVORABLE) | feature-compose.ts | only executed changes auto-land | yes | live (08-26); no path to co-author tests |
| golden drift gate (enumerate-all shell==js) + ClassRow selectorOf + thresholdSelector/parseThreshold | goal-host test/reach-routes-golden.test.ts; 5fa3fc8, b307589 | compositional reach classes as data | yes | live; produced 926b42b no-hands landing (07-31) |
| LLM-free verbatim edit floor synthesizeVerbatimEditOps | feature-compose.ts (27b944a) | deterministic edit ops | yes | fired first time 08-05; later defeated again by edit-intent route (09-16) |
| siteCenteredWindow / focusedSlice / verbatimExcerptBlock / refuseRederivedEdit blind repair | feature-compose.ts, goal-host | drafter grounding windows | specific (several overlapping) | live; blind repair relocates edits (09-03) |
| compose slots cross-process cap | dev-vessel compose-slots.ts (6ad3721/68a26de) | bound concurrent composes | yes | live (08-10) |
| clearPendingIfOwned | vessel-mitosis-cutover.ts (0c96b99) | exit-guaranteed lock release | yes | live (07-29) |
| gracefulShutdown drain | goal-host 015d1ae/53cce0b | drain walks on restart | specific | live but unit TimeoutStopSec mismatch; 9706f440 never deployed |
| pull-sync | /usr/local/bin/substrate-pull-sync (baked in image) | converge clones + /vessels from origin | yes | live; baked copy lags repo; skips on lock/ahead; units never synced |
| classifyPlane / llm-completion-plane-dark gap | llm-resolver 0768990 | detect dead LLM plane without LLM | yes | live-verified (08-07) |
| syncCompletionAdvertisement / quota-gated de-advertise | llm-resolver | stop advertising when no quota | yes | oscillated: deadlock 07-18 -> unconditional 9c17905 -> flapping; state unknown |
| llmModelPolicy Thompson bandit + walkFallbackModels + rate-limit tier | llm-resolver model-policy.ts, 17dc3d0, 3fa37f0, 9716cce | model selection as shaped policy | yes | live; reward on transport not reach; phantom arms retired rev 14 |
| recordPendingArmOutcome / gradeArmByExecution | model-policy.ts | reach-graded arm reward | yes | dormant (never wired; 07-15) |
| llm-completion-dispatch hub-egress fallback | dev-vessel ec8ef67 | reach hub arms when local dead | yes | live; four inline callers still bypass (duplicate) |
| relay reservation watchdog | federation-transport-server.ts 494a990e | renew libp2p reservation | yes | partial (stale circuit recurred 07-29) |
| HUB_API_KEY / peerAuthHeader | cf882aed, discovery 955b065 | cross-trust-domain credentials | yes | live (07-28); env durability via gen-env uncertain |
| discovery resolve gateway candidates[0] | discovery index.ts:205 | pick producer | yes | live, degenerate (not quota/reach-aware) |
| decision_outcome / /decision-calibration | activity-api migration 202 | decision->outcome capture | yes | live, covers only graded minority (~3-20%), claims all (09-03) |
| INTEGRITY_SCANS safeCount; /selection-outcomes; /calibration-summary | activity-api db-admin.ts | integrity + calibration reads | specific | broken (cannot fire / never returned; 09-03) |
| gap-lifecycle-scan autoCloseStaleGaps / churned status | dev-vessel gap-lifecycle-scan.ts:115 | gap disposition | yes | live but temporal-only; churned 0 auto_closed 0 on 2,527 gaps (08-07) |
| gap-landability-model | dev-vessel | learned disposition | yes | dormant/unwired (07-27); doc_path fix 9fd234a |
| ui_legibility_scan + re-observation closure | dev-vessel ui-legibility-scan.ts (354a134) | effect-reading UI validator that can close its own findings | yes | worked 08-07; 09-20 22/23 executions failed, reads `as const` fiction |
| renderPolicy / tokenOverrides | human-surface-vessel | rendering as a shape | yes | live (08-07/09-20); graded on HTTP 200 |
| human_presentation impulse | goal-host a72ad1a | shaped presentation | specific | dormant (not threaded to dispatch record) |
| obsidian:dom_query / capability_catalog from live registry | obsidian-vessel 7321722 / 8329fbc | observe keystone / drift-proof catalogue | yes | landed 07-26; live verify partial |
| react-renderer, workbench | repos (never in inventory/manifest) | UI stacks | — | fossil (never ran; retire) |
| stateful-ui-vessel | :8270 | panels/questions | — | superseded by human-surface-vessel but still receiving pinned escalations (248, 09-22 index) |
| key_session reaper | identity-vessel bfad5ca | bound auth telemetry table | specific | live (07-29) |
| FEDERATION_SIGNING_SECRET / FEDERATION_PEER_AUTH_MODE | secrets.env.sh, deploy-remote.sh | peer signing | — | fossil (read by no vessel; 08-01) |
| rendered llm-<id>.service vs legacy llm-resolver-<id>.service | units | LLM arm units | — | duplicate (PORT collision; 08-09) |
| two LLM renderers `llm` vs `llm-prompt` | ias-executor-ts hosts/goal-host.ts:145, llm-prompt.ts:92 | render inputs into prompts | — | duplicate (divergent input visibility; 08-25) |
| two reachability rewrite rules | discovery union-merge vs human-surface reachableFrom | loopback handling | — | duplicate (08-14) |
| reach delivery retry 1cd87a0 / /reach grading 2b4e18b | goal-host / activity-api | deliver verdicts into posteriors | yes | live; coverage ~1.3% at 08-06 |
| isEditIntentGoal + restate-at-door pathless resolver | goal-host goal-intent.ts | route code-change goals | yes | live (08-09) |
| earlyInterrogative guard | goal-host 92d4b428 | stop questions hijacked into edits | specific | live (07-30) |

---

## §3 Principles / laws stated in this shard (with origin)

- A health probe that asks "is my process up" cannot detect "I joined nothing" — assert registration/end-to-end reach, not liveness (08-09 gen-env; 08-14 identity; 07-29 relay reservation ≠ circuit).
- To inspect the current image, run the current image; never `docker exec` a long-lived container (08-09).
- Validate a counting probe with a control write before reporting zero; a negative is unattributed until a positive control shares its address and call shape (08-09, 08-10 NUL grep, 08-10 envelope per vessel).
- Confirm a data path via the live process env (/proc/<pid>/environ), not doc comments or fallback defaults (08-30).
- Quote the anchor and prove it occurs once; never describe location (08-11) — but anchor quality in the goal does not survive a paraphrasing planner (09-03 refutation).
- Landed ≠ proven; n=0 is no evidence (08-11). Landed ≠ deployed ≠ live ≠ durable; the layer above the artifact lies (origin vs running, source vs bundle, null vs absent) (08-07).
- Verify a deploy by the artifact the process executes (`systemctl cat` ExecStart); three trees — always name which (08-10).
- A LANDED, PUSHED, VERIFIED commit is not terminal — re-check origin minutes later (08-28).
- A fix applied at one reader of a malformed input is not a fix (08-06).
- The no-op-indistinguishable trap: is the observable satisfied identically by the fix working and the fix being inert? Only round-trip resolvability is valid (08-06).
- A test whose fixture does not match production converts "unverified" into "verified" (08-10); a test never seen to fail proves nothing (08-07); before calling a suite dead, run it as CI does (08-10); neither failure count nor failure set is a valid gate on a non-deterministic suite (08-10); never gate on an assertion count (09-20).
- Measure exit codes by redirection, not a pipe (09-20). A test file the suite glob doesn't match is not a test (09-20).
- A single model-authored command has the confidence of a single model-authored answer; certifying an oracle by its POSITION is not evidence (08-07).
- On the ground-truth side an abstention is cheap and a wrong value expensive; never trade strictness for coverage there (08-07).
- An oracle must decline a goal whose scope its parse does not represent; put the guard in the shared parse (08-07, 3rd instance).
- An honest miss is inert; a hollow green is corrosive (08-07). An honest verdict that can never change is as inert as a hollow one (08-07).
- A verification gate strict enough to keep the metric honest is strict enough to prevent learning from it — needs a third independent source of truth (08-07).
- A negative score with no better arm to move to is a cost cascade (08-07).
- "More reaches over time" is a within-class question; measure with repeated exposure to the same classes (08-07).
- Do not promote an external dependency to "terminal blocker" without testing the federated path (08-07; 08-06; 07-29; 07-21).
- Every gate READS the diff; only a test RUNS it (09-05, 08-26 fc-coverage).
- The loop cannot be trusted to fix its own verify gate — hand-land gate fixes with adversarial verification + real reproduction + pinning test (07-29).
- When a refuter cites a concrete counter-example, execute it before accepting the refusal (09-06).
- Pre-register the behaviour, not the string (09-10). Pre-register the predicted post-fix distribution; measure whether a term can carry information before fixing it (09-04).
- A validator must be able to fail; "could not observe" must differ from "observed nothing"; validate the effect, not the construction (08-07).
- A closer that always closes is worth as much as a gate that never refuses — test closure both directions (08-07).
- A gate that fires on better-factored code trains reflexive exemptions (08-07). A rejection carrying no information still spends a selection cycle; gates were the problem, channels (information) the fix (08-07).
- When a model repeatedly invents the same missing thing, believe it (08-07). Models aren't weak — it's an information problem (08-07; law 8).
- Persuasion is not mechanism (prompt text asking to thread operands) (09-03). Grep for what the code LOGS, not what it SAYS (09-03).
- Read the producer's actual payload keys, not the handler found by grep; a renamed field across a boundary returns null rather than erroring (09-04).
- Rationale prose in a goal invites scope expansion — one op, one verbatim anchor; reasoning goes in the gap (09-04). One concern / one contiguous region per goal; dispatch reliability is inversely proportional to region count (07-15, 07-30, 08-05, 08-06).
- When you remove a guard because its reason no longer applies, check what else it held (08-10). Refuse, don't queue (08-10). A wrong cap must make the fleet slow, never the host unusable (NaN fail-open) (08-10).
- Tolerance without a bound is not safety (08-04). Declared lists rot; reconcile against the running system (08-04).
- A cleanup/reconciliation/fallback path must be held to the primary path's reach standard (08-05). A change to how reach is DECIDED must justify its evidence bar against every other site that decides reach (09-03).
- A silent misroute contaminates the measurement and leaves no artifact — worse than a 404 (08-08). A loopback address is only meaningful relative to who reads it (08-08).
- A fix that repairs one direction of a distinction can install the mirror defect in the other (08-11).
- A timestamp is not an identifier; attribute landings by gap-pick log + subject gap id (08-11, 08-26).
- A gap read is a snapshot — check `git log -1 -- <edit_site>` and grep the anchor in the live tree before dispatching (08-26).
- A deferral must suppress re-derivation (08-26). Filing a gap is authorizing work (09-20).
- In an incident report the most-cited path is the victim; read cited paths by role (09-15). A metric satisfiable without fixing anything will be — including one you author (09-15).
- The laws guard COMPUTE; nothing guards EVIDENCE — fields consumed by elapsed-time/accumulation computations need single ownership; class is statically detectable (09-03). Build the detector, then attack the detector (09-03).
- Separate null from zero before reporting a rate; divide by executions, not rows; confirm id namespaces correspond before dividing tables (09-03).
- A control read before its dispatch terminates is not a control (09-03). Grade artifacts after the verdict settles (09-20).
- Kind vocabulary is open at runtime — use a fail-visible denylist, not an allowlist; store predicate before reader; a correct guard nested under the wrong condition is no guard (09-20).
- Never leave content you care about in a live store while dispatching (walks upsert with defaults) (09-20).
- Structure may be frozen, policy may not (07-25). Do not fossilize: hard intelligence belongs in gradable activities (model+prompt+context), TS stays thin (07-20).
- The reward for a human surface is "did the human reach a correct verdict cheaply" — never reward more verdicts (08-07).
- A high alpha is evidence a model once worked, not that it exists — probe the provider, not the posterior; /models listing is necessary not sufficient (08-20).
- Model choice is a learned selection, never a frozen literal (07-29 8bd2fff). A dead arm is a routing problem, not a wall; resolve through discovery to a quota-having producer, never duplicate keys into the spoke (07-21).
- A landed fix must be deployed (mirror + RESTART) on both hub and spoke (07-21). COMMIT so convergence becomes your ally (08-07).
- Never pipe key-bearing files through grep/sed/cat; fingerprint or length only; check keys by value length not presence (07-28, 07-29).
- Verify in motion, not at rest (trust bugs appear only in motion) (07-26).
- Snapshots exist, trends do not — growth is unprovable without a historized gauge (07-20).
- Reach is a deterministic function of capability per class; experience changes which pathway is selected, never what the system can do (08-07) — "convergence without improvement".
- Landing is solved; observing landing is not (09-03).
- The system can USE its grounded oracles but not GROW them without demand (08-26).

---

## §4 Appendix — per-note extraction (list order; numbers = position in shard)
## Per-note extraction (in list order 376-450)

### 1. gap-self-management-loop-diagnosis (2026-07-27)
- [gap-content / dormant-mechanism] Detection works (196 gaps, 166 open/30 closed; 30+ detectors: env-gate-scan, host-container-source-drift-observer, gap-lifecycle-scan, gap-landability-model, detector-meta-scan). DISPOSITION = 0 (field '-' on all 196) -> law 7 unfulfilled, FIFO churn. gap-landability-model existed but UNWIRED.
- Closure throughput ~0: gap-backlog-unhealthy (683 stale >48h; missing_capability 278 / unreachable_producer 102 / orphaned_capability 93 — detectors emitting un-actionable gaps); self-alteration-throughput-zero-apply (16 authored -> 0 staged -> 0 landed in 6h); 2571 proposals, 322 stale.
- Root: apply-proposal-as-patch.ts made ONE attempt per invocation (:1078), archived+returned on any failure (:1152); DEAD stale filter :534-542 (casts dirent to type with nonexistent .status/.stale).
- Fix: bounded-retry cd28e65 + churn-exclude/recommit-cap 12e7611 -> proposals 1670->85. Outcome: partial — "necessary not sufficient".
- DEEPER ROOT [narrowing-duplicates]: ~97% of backlog was feature_compose FAILURE REPORTS (route-edit-*-compose-report.json) written back into proposals dir and recursively recommitted: 1173 route-edit-*, 81 recommit-, 28 recommit-recommit-, 15 triple, 7 quad, 2 quint. Only 52/1670 actionable.
- STAGE ~18% success; failures dominated by anchor_not_found [drafter-quality]. Lands: 2f4093c, 09b49f2 (a CORRUPTION landed); no-op redundant patches "FAVORABLE but nothing to commit" [hollow-landing].
- Integrity hardening cited: GATE A/B a1ad9d5, conformance gate fb9b1e1, honest thompson_posterior 51987fa, ReAct floor revival 559a55d, proven-bad guard 2a49c76.
- Planned: (B) wire disposition, (C) gap-emission audit; context-thompson-frozen starving selection.

### 2. gap-store-fossil-vs-live-path (2026-08-30)
- [write-read-mismatch / memory-recall / sync-deploy-drift] Live gap store = /workspace/git/super-repo/gaps/gaps.json (WORKSPACE_ROOT via /etc/substrate/env EnvironmentFile, which WINS over unit Environment=WORKSPACE_ROOT=/workspace — dead config). /workspace/gaps/gaps.json = fossil frozen 2026-08-08. config.ts fallback /workspace decorative but matches fossil.
- Operator burned an investigation on a false "write-persistence bug"; false gap `substrate-gap-write-reports-success-but-does-not-persist` rejected.
- Law: confirm data path via live /proc/<pid>/environ, not doc comments/fallback defaults. (Recurs 09-22 as "two memory stores": same EnvironmentFile-wins mechanism, 680 knowledge notes unread.)

### 3. gen-env allowlist + spoke derivation hardcodes 18xxx (2026-08-09, af8b341a, validation/findings/config-surface-audit.md)
- [env-gating / federation-p2p / endpoint-routing] systemd PID1 doesn't export env; /etc/substrate/env (gen-env.sh) is the ONLY channel = allow-list. Four outcomes: pass-through / side file (/etc/substrate/llm-*.env, /workspace/.substrate-secrets) / emitted-but-hardcoded (TRACE_STORE_CAP) / dead (VLLM_*, FEDERATION_SIGNING_SECRET, SUBSTRATE_ADVERTISE_HOST). Fifth: entrypoint-time (LLM_ARMS).
- gen-env.sh:249-250 hardcodes :18080/:18101 for spokes -> heartbeats 401 -> registeredVessels 1 while container "healthy". Overrides -> 1->14 vessels, 290 shapes.
- Law: health probe "is my process up" cannot detect "I joined nothing" — assert registration not liveness.
- Instrument errors: docker exec inherits DISABLED_VESSELS; long-lived container is an old image layer -> phantom drift. Law: to inspect the current image, run the current image.
- compose `:?` guards fire for excluded profiles and on `down`. Recreate without -e cannot boot (key guard before persisted-secret fallback). HUB_DISCOVERY_URL alone = half-spoke. Typo'd role masks 91/92 units, exit 0; entrypoint.sh:28 `|| echo` swallows PROFILE fatal.
- Every LLM arm runs twice (rendered llm-<id>.service vs legacy llm-resolver-<id>.service collide on PORT; spoke NRestarts 128 in 11 min); rendered units ungoverned by role selection; apply-inventory scans /usr/lib not /etc/systemd/system [codebase-bloat-fossils].
- [trace-store-db / write-read-mismatch] POST /v2/activities/executions 201 but every read route 0: activities.ts:2515 "TEMPORARY: Query execution table directly (view not yet applied)" — reader targets a view fresh deployments never create. Law: validate a counting probe with a control write before reporting zero.
- Retraction: hub registry supposed to stay small; federation = peer fan-out at resolve time, not registration mirroring. Registry count on wrong node measures wrong thing [node-locality].
- Minted API key embeds 127.0.0.1:8101 validator even when IDENTITY_PUBLIC_URL set.
- deploy-remote.sh writes peering into /etc/substrate/env after gen-env -> every restart un-peers (14 findings, 4 critical; audited not run). compose volumes project-prefixed so compose vs make up don't share state [docs-drift].

### 4. gitStatus reframe hollow-green closed (2026-07-26)
- [hollow-landing / goal-walk-floor] Reframe to alternative ["gitStatus"] escaped reach gate: 8202-char git status dump graded reached:true. Root: reframe-backstop RAW_INPUT set (index.ts ~4883, from e9039cb/8989038) lacked gitStatus.
- Substrate self-authored fix landed de483fd FAVORABLE, but drafter REFORMATTED the Set and DROPPED 4 unrelated members (httpResponse, http_response, web_resource, codeSearchResult) [drafter-quality / autonomous-regression]. Operator restored union in 3ff0cf7.
- Class gap proposed: diff-guard rejecting edits that remove tokens not asked (gap-feature-compose-drops-unrelated-set-members); not filed at time (no gap-write shape found).
- Result: lie -> honest red, 3/3; FLOOR remained open (never produced 'dev'; gap-derived-shell-answer-no-tool-fallback-producer).

### 5. give-a-drafter-verbatim-anchors (2026-08-11)
- [drafter-quality] 3 attempts, 2 failures were operator spec's fault (missing interface member -> typecheck rollback; prose anchor -> schematic reconstructed anchor 5 members apart). 3rd with verbatim unique anchor (grep -c =1) landed 56a0683.
- Law: quote the anchor and prove it occurs once; never describe location. Typecheck rollback naming missing decl = spec bug.
- [narrowing-duplicates] Gap hash includes line count; different text length -> fresh gap.
- [false-verification] Landed ≠ proven: grounded fallback path "PREFERRING grounded universal-tool answer" fired 0x; n=0 is no evidence. Caller-facing verdict wrong both directions in one session (null-body walks reached:true; landing dispatch reached:false) — uncorrelated grader.
- activity-api drop-in StartLimitIntervalSec=0 (35 SIGTERM cycles/3h). Gaps filed and read back: cutover-restarts-role-excluded-units-unguarded, hollow-recovery-suppresses-the-only-producer, registry-inventory-oracle-abstention-narrowed-by-c9faf50d. c9faf50d forward-fix withheld: stale-base cutovers can clobber a landing [sync-deploy-drift].

### 6. goal-as-distribution reframe (2026-07-19, tmp/goal_as_distribution.md)
- [selection-learning / goal-walk-floor] Critic: ⋆ metric doesn't exist (context_thompson_scores diagonal); ~78% hollow is content-hollow on the CORRECT shape — coverage/mass can't kill it; inferGoalTargetShapes caps ≤3 shapes; hard coverage gate contradicts middle-mile.
- Buildable core: computeDeltas (posterior-update.ts:303) accept continuous d; `T = missing[0]` (index.ts:2637) by insertion order -> argmax mass; goalHashOf exact FNV-1a (goal-target-inference.ts:26-33) = zero paraphrase reuse [composition-crystallization]; decideContinuation imported index.ts:181 never called [dormant-mechanism].

### 7. goalExecutionPath advertises a rule it cannot follow (2026-08-10) — RETRACTED
- [false-verification / instrument] Claimed impulses.ts absent; actually 285KB file with 3 NUL bytes -> grep treats as binary, silent exit 1. check-shape-dispatch (63 advertised/68 cases) was right. Three greps that proved nothing, each caught by a control.

### 8. goalExecutionPath rows carry no org_id (2026-08-10)
- [write-read-mismatch] Resolve returned [] for 7/7 shapes: reader `AND org_id = $org`, 0/200 rows had org_id; GET /v2/goal-paths unscoped reads same rows fine. Only handler hand-rolling strict scoping (25 uses of accountIdScopedWhere elsewhere) — but helper would NOT have fixed it (proved on throwaway SurrealDB 2.3.3).
- Fix f2b642c `(org_id = $org OR org_id IS NONE)`; suite 1038/193 -> 1045/192.
- THREE independent defects: (1) org_id; (2) writer never populated endpoint_output_shapes (accumulateEndpointShapes resolved via activity table; satisfier:<shape> ids not rows; 0/200 non-empty — voided migration 092); (3) 'public' sentinel from writer default not tolerated.
- Wrong fixture: mock returned [[]] skipping early-return; green test did nothing in prod. Law: a test whose fixture doesn't match production converts unverified into verified.
- Laws: before calling a suite dead run it as CI does (mock.module global); async stub for sync predicate fabricates failures; envelope per-vessel — control must use same endpoint contract; read routes from source; migration makes DNS a suspect.
- Scope: goalExecutionPath is NOT the walk's reuse lookup (recommendReachingPath is); fixing it doesn't change dispatch.

### 9. goal-relevance guard vs byproduct composites (2026-07-27, goal-host 96e04ea, wf_2f02ee32)
- [selection-learning / composition-crystallization] Candidate selection = output-shape overlap + Thompson, NO goal-relevance check (advancesTarget/makesProgress set membership index.ts:3515). servesIntent/goalSignature WRITTEN at mint (:1935) and stamped on pool (:2319) but DISCARDED at selection; activity-api recommend/discover responses don't carry it (readCandidateShapes :2173) [write-read-mismatch].
- Bare llm_completion_dispatch target confabulates; grounded tool loop (runGroundedToolLoop+UNIVERSAL_READ_TOOLS) fires only on non-reach fallback :5224 / missing-arg :3049 [goal-walk-floor].
- Fix isIrrelevantLearnedComposite (byproduct-only outputs rejected). Partial: summarize -> soft reach; EXPLAIN-purpose still FAILED (learned-deadline-note-index exempt via hasSpecificMatch). Deeper fix (surface servesIntent through activity-api) deferred.

### 10. goals produce nothing — computed then dropped (2026-08-06; 55,725 executions, 72h, hub)
- [trace-store-db / write-read-mismatch] 90.6% of roots are machinery: 14,217 roots; light-dispatch ticks 10,166, ribosome-extract 2,231, auth 417, goal walks 1,337 (9.4%). 92.2% of roots carry no origin tag.
- Computed-then-dropped = 74.7% of roots: (1) light-dispatch posts `tasks` flat (light-dispatch index.ts:872), writer reads body.execution_trace?.tasks (execution-traces.ts:1840) -> null; identical fallback existed ~1000 lines below for ψ path — "a fix applied at one reader of a malformed input is not a fix". FIXED 4c1b588. (2) satisfier walks write inputImpulseIds:[]/outputImpulseIds:[] literals (goal-host :5498-5506, :6053) — 456 roots. (3) reach verdicts computed never persisted 71.3% (253 MATCHED NO ROW vs 102); feature_compose/patch_with_tools 48 dropped/0 delivered -> learner scores 0.8%.
- [goal-walk-floor] "no producer or constructible payload" error string lies: 97/99 named shapes have live resolvers (only shapeGapResolution_write absent); escalation authors a new producer against a live one = law 3 violated by an error message.
- [false-verification] 8s timeout laundered into success: engine.ts:944-951 exempts source:'impulse-resolve' which impulse-resolve.ts stamps on abort path too; 764/1068 dead roots ~8s; ribosome-extract α=1/β=1 across 2,231 executions [selection-learning].
- [selection-learning] proposed_pattern_authored_obsidian_assist_active_note: 516 exec, 244 credited successes (46.2% of window), α=245/β=273, REACHED 0 — goal-paths.ts:586/612 successful_executions from template exit status.
- Instrument: task_count decoupled from tasks[] (execution-traces.ts:737; metadata null 75.5%); cost_usd 0 on 100% (engine.ts:1193 writer never populates) [spend-envelope-throughput]; goal_text absent from trace schema, 0/1,337 walks carry dispatch_id/goal_hash.
- What works: 99 substrate-authored commits landed in window but not from the walk (EARLY EDIT-INTENT pre-walk). 72/101 "REACHED via chain" were 1-step; ≥2-step composed reaches 22/402 = 5.5%.
- Retracted claims list (218 = line count of sample; etc.). Law: the no-op-indistinguishable trap — "is the observable satisfied identically by the fix working and the fix being inert?"; fabricated handle impulse:${task.id} (light-dispatch :808) 6/6 "Impulse not found" — only round-trip resolvability is valid.

### 11. golden drift gate + clone convergence (2026-07-31, goal-host 6bc12d5)
- [false-verification] route-as-data golden test was string-locked, not executable; added enumerate-all block running shell fragment and JS oracle over same fixture (71 pass). 
- [sync-deploy-drift] in-container goal-host clone 174 commits behind in DETACHED HEAD; reach oracles graded stale data; pull-sync `git checkout -q dev 2>/dev/null || true` silently failed. Converged by hand; gap pull-sync-goal-host-clone-wedged-detached-head.
- [dormant-mechanism] Mitosis gate staticEvaluate (vessel-mitosis-evaluate.ts ~L512) does NOT run golden test; /vessels/<v> is src+sql only (content_hash excludes test/); filed mitosis-gate-must-run-golden-fixture-exec-against-staged-src. Not armed then.

### 12. grep silent on NUL-separated file (2026-08-10)
- [false-verification] activity-api impulses.ts has 3 NUL bytes -> grep binary heuristic, exit 1 silently. Same wrong conclusion reached twice. Fifth "zero from broken query" of the session (/v2/registry/shapes 404, POST /resolve executing instead of listing, nonexistent gap_report shape, jq path). Law: run a control whose answer you know in the same call shape.

### 13. groq slugs decommissioned — phantom arms (2026-08-20)
- [selection-learning / spend-envelope-throughput] 3 groq slugs 404'd; isFailoverError excludes bare 404 -> markModelExhausted never fires; llama-3.3 α=8.66 kept. Six phantom arms retired at policy rev 14 (25->19): 3 groq, tencent/hy3:free α=342.6, Qwen3-30B α=370.7 (VLLM_ENDPOINTS unset), Qwen3-Coder-Next α=483.4 (RUNPOD_ENDPOINT_ID unset) [env-gating].
- Laws: high alpha is not evidence a model still exists — probe the provider not the posterior; /models listing necessary not sufficient (gpt-oss empty at max_tokens 16; qwen3.6 inline <think>).
- dev-vessel masked -> substrateGap_write unreachable; masking blocks its own remediation. Arm addition is code/boot-env not data (law 1 gap).

### 14. historical findings index 2026-08-09 -> 08-25 (+ folds to 09-23)
Index/compendium (link list). Key one-line laws carried:
- 09-05: pinned target is immortal (retirement is selection-scoped; pinning bypasses) [selection-learning]; wrong edit_site is sticky [gap-content]; SCHEMAFULL tables discard undeclared fields with success:true -> deployed commit inert [hollow-landing / trace-store-db]; escalation lane inverted boolean discarded every gap write [human-surface-escalation]; total_executions inflated ~155x; learning does not compound — gains are step functions from bug fixes [selection-learning]; NOTHING EXECUTES A LANDED CHANGE — every gate reads the diff [false-verification]; gate rewarded the broken commit and failed the fix; failed walk's writes survive verdict; substrateGap_write REPLACES (resend all fields); apply-failure reasons never reach trace; operator scorecard wrong 11 times, one class (reading resting state as terminal).
- 09-04: four-link chain closed (n=1): landed no-hands -> deployed -> reached -> α+β moved; evidence is a RATE requirement, does not bank (3d decay); landability oracle 0-for-1030.
- 09-12..14: `${A:-$B}` fails over on EMPTY not INVALID (1fad6ec gates reach on push_status=="pushed"); test staged_base_sha==HEAD; rollback not atomic across files; ROUTING≠REACHING; aggregation exprs typecheck-invariant; log silence≠failure (host vs container clone); provide_feedback needs dispatchId.
- 09-16: skipped rollback = every failed compose permanent (compared vs pre-edit original) fixed 88032ab; compose lane down GOOGLE_API_KEY="" crash-loops; placeholder keys burn arms; self-filed refusal gap; state_signature absent from all 13,423 path rows (path store keyed by goal text hash) [composition-crystallization]; cold boot loses all 121 dev seed templates (seeder lacks After=identity-seeder; warm volume hides it) [sync-deploy-drift]; goal-host edit-intent defeats verbatim floor — direct resolve feature_compose is byte-exact lane.
- 09-14: spawnSync blocked event loop -> watchdog kills vessel (ca53600); raw NUL in 8 vessel sources grep-invisible; 09-21 NUL makes git say Bin.
- 09-20: grade artifacts after verdict settles (+51s corrective write).
- 08-09..08-23: cockpit pointed at dead hub; pending computed from git; 5 false positives; ψ unreachable at 6 call sites; deterministic fast path skips honesty gates; args amputated at four layers; fan-out credited itself; masked-but-running unit = latent unrecoverable outage; rebind keys on wording; repair path wrote URL prompt over its own source; spoke shouting into decommissioned relay.

### 15. hollow-green arithmetic closed + false-green on the fix (2026-07-31)
- [hollow-landing / false-verification] verifyDeterministicCompute extended (reuse) with 'P% of N'/'A times B' block: dd150e7 + test 10052e9 (11/11, golden 91/91).
- TWO false-greens on the fix: dispatch 30676d28 bundled 2 concerns, drafter did only export (9e9d239), reached:true because post-state oracle (1ac5f0e verifyEditPostState/parseAddSymbol) greens on PRESENCE of pre-existing symbol -> gap edit-postoracle-greens-preexisting-symbol-2026-07-31. Dispatch 9e2b63fe: compose UNFAVORABLE, walk HOLLOW, nothing landed, LLM judge overrode with confabulated reached:true -> gap hollow-green-llm-judge-overrides-all-hollow-walklog.
- [drafter-quality] "replace unique anchor line with (block + same line)" beats positional insert; written as concept-db compose_lesson (read into drafter prompt ~1554).
- [false-verification] failure-fed detector loop is BLIND to false-greens (no failing trace); fed 3 human goal_verification_label_write labels.
- [sync-deploy-drift] pull-sync baked at image build (/usr/local/bin/substrate-pull-sync) predates cdee05bc; clones DETACHED again; manual convergence.
- feature-compose llmCall at 2041/2074/2225/2315 skips llmCallWithFailover [codebase-bloat-fossils].

### 16. hollowness is goal text not drafter capability (2026-08-02)
- [gap-content] 3h: 1 reached:true vs 84 hollow terminals (~1%); 11 pwt starts/60min, 32 graded terminals all hollow (20 edit-intent-no-landed-edit, 12 hollow_walklog_capped). The one reach was the operator's goal; operator goals landed 37d9d9a.
- Self-generated goal text: gap summary = another gap id ("Close substrate gap route-edit-0ebfbe30:1: Close substrate gap route-edit-1b4048…"); gap_compose requires spec -> no-op. 172 route-edit-* gaps share shape. Prefix accretion fixed 925f64a (11 in 3h, regex undercounted).
- [dormant-mechanism/instrumentation] gap-goal supply not empty: candidates=5 raw_gaps=100 admitted=100 (83feec1); capped at 5, CANDIDATE_CACHE_TTL_MS=60_000, GAP_GOAL_COOLDOWN_MS=600_000 [env-gating: constants].
- CORRECTION: 306 EARLY EDIT-INTENT feature_compose verdict=UNFAVORABLE, 0 FAVORABLE/24h; 120 `old_string not found`/24h; pwt writes /vessels/** with no isolation (pull-sync re-mirrors before apply; hypothesis) [drafter-quality / sync-deploy-drift]. Grep full prefix not bare `verdict`.

### 17. hollow-override gate closed + compose-lane billing blocker (2026-07-31, goal-host 8f23567)
- [hollow-landing / false-verification] Walk output-merge fallback (5476-5479) injects declared output shapes as bare {producedBy,executionId} STUBS -> edit-intent deterministic negative (verifyGoalReached :2211) bypassed -> LLM judge confabulates. Fix: require landing evidence (push_status:pushed | new_git_sha) -> deterministic:edit-intent-no-landed-edit. Self-authored, verbatim.
- [spend-envelope-throughput] feature_compose inner llmCall pinned to opus arm (:8221), Anthropic 400 credit too low; gap gap-compose-lane-pinned-to-single-llm-arm. CORRECTION same day: lane not halted — Qwen3-30B H100 pod dominated patch_with_tools (α 1548/β 1); all 5 landings via hub-egress; binding constraint = drafter quality. Waste: DOWN q3-32b-awq pod (530) sampled; metric-collector-vessel 622 heartbeats/0 success.
- [federation-p2p / endpoint-routing] local arms DE-ADVERTISE llm_completion on quota exhaustion; hub llm arm intermittently unadvertised; fed egress-repair every 10-30s never converges; feature-compose empty-discovery fallback (1733) pushes ?vessel=llm-resolver-vessel -> misroutes to local obsidian vessel.
- Parallel session af86945 (direct edit) closed edit-postoracle-greens-preexisting-symbol.

### 18. honest growth measurement (2026-07-20)
- [selection-learning / composition-crystallization / dormant-mechanism] Snapshots exist, trends don't. 384 advertised shapes, 349 (91%) no catalogued consumer; composition_coverage_report TIMES OUT. compositionFlowHealthReport genuine_edges 902/1998, orphan_fraction 0.79 -> ~190 real; components=11. Only 2 templates earned posterior (both maintenance ticks) vs 2938 declared crystallized cells (~1500x). Top concept's 234 uses one trace_id "drafter-success-credit" (blanket self-credit).
- Waste: ~340k pool observations (~52% of 657k) on zero-success signatures (validator-dispatch 257k sr=0; create-shape-provider-goal 84k sr=0).
- Proposed: reachableSurfaceTrend gauge (historized). (Later: 09-19 "expectation-trend batteries" — check.)

### 19. how generalization actually works — eight-tier ladder (2026-09-10) — REFERENCE MAP (keep)
- [goal-walk-floor / composition-crystallization] Ladder in goal-host index.ts: (1) recommendReachingPath :12825 (satisfier-headed pathways NOT pinned :12832-12850 -> 63.5% of accepted pathways unreusable); (2) satisfier plane :8929-9260 via vesselResolveShape :7420; (3) candidate gen/select :9271/:9313/:9351; (4) backward-chain :9659; (5) auto-bridge author_producer :9726 gated by mintGovernorAllows :5373; (6) fileCapabilityGap/fileReachabilityGap :9765; (7) edit-intent -> feature_compose :12228; (8) ReAct floor universalToolFallback :4692 invoked :12204, runGroundedToolLoop :4531, walkBudget shaped impulse; excludes edit-intent. LIVE 956 execs ever / 342 in 7d / 22.7% success.
- slot-binding first-mile adaptation 245,686 executions (ias-executor-ts templates/lifecycle/slot-binding.json; engine.ts:569-586); deterministic-first; agent_fill_fallback default-disabled (impulse-preparation.ts:146-153); producer-selection.ts:19-20 picks FIRST candidate not Thompson [selection-learning].
- Satisfiers 349 arms/24,810 execs; auto-bridge 44 arms/9,450 execs, validated by invoking resolver (author-producer.ts:678, 836-875).
- Ratchet: buildCompositeTraceFromChain :6117 -> ribosome -> learned-<slug>. Floor wrote 0 of 4,768 path rows until recordGoalPath(...,"universal_tool_fallback") added :12220.
- [selection-learning] Posteriors under-credited ~0.16 (satisfier +0.156 over 135 arms; non-satisfier +0.168 over 314) — composition-dependent, NOT decay: satisfier:webSearchResult 127/128 = 99.2% vs posterior 0.212. posterior-update.ts:1036 skips ungraded; classifyReach returns ungraded for satisfiers without reached tag. Gaps: satisfier-arms-are-permanently-under-credited, nothing-audits-posterior-against-observed-success.
- [docs-drift] code comments claim 53 learned-of-learned templates 7 deep — not in live table. SATISFIER_PROVEN_BAD_ARMED unset => proven-bad suppression DISARMED [env-gating / dormant-mechanism].

### 20. how the architecture functions — evidence aliasing (2026-09-03)
- [write-read-mismatch / evidence-aliasing] Gates correct because they READ; preconditions break because everyone WRITES. Instances: variant_performance_metrics.updated_at (decay clock also written by upserts :7733, :7302, ci.ts:240 -> decay under-applied ~281x); activity_composition_graph.created_at (254 "new" edges really 67); gaps.detected_at overwritten by TTL; <gap>-compose-report.json overwritten by later attempts so honest reconciler :15968 can't work. impulse_relevance_metrics.impulse_id execution-scoped 92.4%.
- [false-verification / gap-content] Gap store auto-closed operator gap with FABRICATED remedy, detected_at 2024-01-01 sentinel, category/source rewritten; gap gap-store-auto-closes-open-gaps-with-a-fabricated-remedy-and-a-sentinel-detected-at. Overwrite on re-detection (4,000-char repro overwritten with first sentence).
- Detector built: 11 writes to updated_at, 8 don't decay (posterior-update.ts:643 chain-credit, activities.ts:908/2330/7302/7727/11261, ci.ts:229, execution-traces.ts:3863). v1 had false positive. Law: build the detector, then attack it. Class statically detectable. Gap evidence-fields-consumed-by-elapsed-time...-have-unversioned-concurrent-writers.
- [drafter-quality] Blind-edit repair: refuseRederivedEdit (edit-provenance.ts:125) no uniqueness/locality test; window = whole module ("Fails open"). 1e66893 comment relocated to header landed (typecheck blind to comments); e3d70049 rolled back. REFUTES "verbatim anchors" as sufficient — planner paraphrases. 438 ops repaired:true (26.4%) = exposure not rate. Gap blind-edit-repair-relocates-an-edit-anywhere...
- [selection-learning] Learning channels two groups: (A) reached-consuming Thompson+ribosome; (B) content-credit (impulse relevance, edge weights) broken by identity-scoping + empty counterfactual (times_not_loaded 0 of 16,763); (C) recency by aliasing.
- Horizon detectors resolve, but 0 of 1,764 gaps carry horizon tag [dormant-mechanism]. Topology healthy: 67 edges/day vs 2-3 cells/day; 3,885 activities minted, 1,126 executed (29%), 660 in 7d [codebase-bloat-fossils].
- Six instrument errors (limit=50, glob, total_templates=1000 LIMIT cap, grep -oc, journal grep, python goalHashOf).

### 21. hub LLM not selectable locally (2026-07-19)
- [federation-p2p / env-gating / endpoint-routing] Local LLM plane credit-dead (Anthropic 400, OpenRouter 429). feature-compose pins llmEndpoints[0] (:1360) = dead local arm. Root: systemd env-precedence clobber — discovery unit Environment=PEER_DISCOVERY_ENDPOINTS=hub, but EnvironmentFile (/etc/substrate/env) set "" (gen-env.sh:172 default from empty HUB_DISCOVERY_URL). Runtime fix: set in env file + restart; 6 llm producers incl @syzygy-hub.
- Still blocked: relay NO_RESERVATION for hub arm peer (hub-side); dev-vessel feature-compose discoverAll (:161-177) builds hub-localhost URL 127.0.0.1:8221 — lacks goal-host's egress rewrite (index.ts:1948). Local arms "Never un-advertise" (syncCompletionAdvertisement) — law says de-advertise on exhaustion. Same EnvironmentFile-wins mechanism as #2 and 09-22 memory-store split (RECURRENCE).

### 22. human-interface floor diagnosis (2026-07-26, wf_843ebce2 and many follow-ups)
- [human-surface-escalation / env-gating(law1)] Plugin-hardcoded presentation: fleet emits only raw answerBody (goal-host index.ts:4118, only when isQuestionGoal && reached); poolDigest leaks shape names; no human_presentation shape (395 shapes).
- [goal-walk-floor] No prose-answer target shape; inference collides subject word with shape name ("explain what an impulse is" -> poolImpulse@0.95 -> impulseRelevance TABLE graded reached — dispatch 1ad728f3 labeled not_reached). isQuestionGoal (index.ts:3046) start-anchored.
- concept-db queries time out (SurrealDB contention) [trace-store-db]. apply-schema.ts:86 content.split(';') mangles DEFINE FUNCTION bodies; errors swallowed (:99-106) -> 5 upkeep fn:: never defined [dormant-mechanism]. Gap gap-concept-db-apply-schema-semicolon-split-mangles-define-function.
- Landed goal-host 4d9eb92 (direct edit): D1 EXPLANATORY_RE deterministic pre-LLM route to llm_completion_dispatch; D2 comma preamble (partial — period preambles miss); D3 poolDigestHuman. Residual: answers confabulate the system's own ontology (impulse = "stimulus") — gap gap-prose-floor-confabulates-own-ontology-no-grounding.
- obsidian-vessel 8329fbc capability_catalog derived from live registry (had 4 phantom shapes, wrong field name) [docs-drift]; 7321722 obsidian:dom_query (read-only, editor privacy floor); panel scroll-anchor 7774c82; smoothing batch 26876b0 (markdown, grounding badge, honest reach display); goal-host a72ad1a human_presentation impulse (SHAPED not LEARNED; not threaded to dispatch record) [dormant-mechanism]; gap gap-render-not-a-graded-activity-presentation-unlearnable.
- DEPLOY-TOPOLOGY: plugin main.js symlinked to repo build, but Obsidian loads at enable — fixes in file but not loaded -> forks recurred [sync-deploy-drift]. Reload via :27182/actions/reload-plugin. :18402 registered endpoint stale; ui_screenshot empty base64 headless.
- Trust regression caught in motion: grounding badge "grounded" for bare-LLM answer; fixed 81a1c41 (grounding requires non-LLM shape). Law: structural at-rest verification misses trust bugs; verify in motion.
- Multi-vault: gap-multi-obsidian-vault-routing-race-and-learning-contamination (health-probe race, no tenant, shared posteriors).
- Interaction matrix: 20 cells, 1 smooth/10 rough/6 broken.

### 23. human-participation baseline — consumption severed three ways (2026-09-20)
- Baseline validation/reports/human-participation-baseline-2026-09-20/MATRIX.md (487d8085). 9-stage program.
- [human-surface-escalation] shape-level ui traces = 1 row total; templates consuming human/ui input shape 0 of 3,977; 404/440 ui executions = ONE failing loop learned-composition-uifeedback-write-to-shellresult (368 fail) [codebase-bloat-fossils]; interactor-log silent since 07-22.
- Severed: (1) human-surface uiQuestion read keeps kind==="question" only; (2) journal writer flat camelCase vs readers parse {pointer:{panel_id,kind}} [write-read-mismatch]; (3) solicitation-outcome-scan pins 127.0.0.1:8270 [endpoint-routing]; heartbeat 404 while registry lists.
- Hollowness register [dormant-mechanism]: uiFeedback read no /resolve case; expectation-trend note only reader = writer; interaction_expectation_verify 0 callers; ui_screenshot 2 producers 0 consumers; ui_view unreachable; recordOperatorEngagement never carries solicitation_ids; escalation_disposition_apply unscheduled; generative_frontier_gap_tick fail-closed; adjudicate tests-only; human_reported never compared vs substrate_detected.
- Landed: 81f6394c one-page workbench; c0addb25 renderPolicy presentation variant; f37a21f0 stage-4 trace 5/9.
- [directed-overshoot / autonomous-regression] Substrate landed 175b9f1 for :8270 pin AUTONOMOUSLY but resolved discovery for obsidian:note not uiQuestion; semantic gate approved (agreeing-wrong).
- [human-surface-escalation / autonomous-regression] DESTRUCTIVE: satisfier resolving READ shape uiFeedback issued defaulted uiQuestion_write that overwrote live panel. stateful-ui uiPanel_write coerces objects to "[object Object]".
- Increment 1: 199/445 panels hidden across FIVE kinds; kind vocabulary open at runtime => denylist; store.ts also rejected answers ("The question changed" lie) — store predicate before reader; guard nested under wrong condition; three probes printed PASS and exited 1 (pipe hides exit) ; test file not matching *.test.ts glob is not a test; operator never persists in gap store (0/1708); edit_site IS persisted; filing a gap = authorizing work (approach_decisions aimed at gated files within minutes).
- [federation-p2p / env-gating] PEER_DISCOVERY_ENDPOINTS=http://host:18100"" (quote-doubling secrets->gen-env) -> ERR_INVALID_URL swallowed in empty catch => misconfigured peer byte-identical to no peers (live outbound, dead inbound).
- [false-verification] ui_legibility_scan (only grader) never observed anything: 22/23 failed; walk binds pointer fields to "" ('' ?? DEFAULT = ''); ui-view.ts COMPONENT_COUNTS `as const` literals — grader reads fiction. satisfier:renderPolicy_write graded on HTTP 200.
- Landed 1704850a + cbd134e5 (suite 20->43): consumption link holds (answered:1). Remaining: value unvalidated (null answer counts), replay path bypasses guards; 32 tracked stale .js/.d.ts siblings in src/ [codebase-bloat-fossils]; expect() counts process-state-dependent; probes have ZERO scheduled callers; deployed WorkingDirectory human-surface-release clone.
- substrateGap_write returns falsifier:"none" regardless of prose falsifier.

### 24. human-surface stack and the UI vessels that never ran (2026-08-07; openspec/changes/human-surface-stack/)
- [codebase-bloat-fossils] react-renderer and workbench in neither inventory nor manifest, no unit — declared never walked (law 4 hollow). Only stateful-ui-vessel ran (port 8270), pulling React from esm.sh at runtime (law 11). THREE shape->renderer registries. Operator: replace root-and-stem; built human-surface-vessel (port 8310), @avigopal/design-tokens, @avigopal/interaction-conformance (13 rules; 9 partial; runtime probe not built).
- Operator's own law-3 miss (hand-rolled dispatch-on-form renderer though react-renderer shape-slot existed).
- Defects found by running: default-export Hono + Bun.serve EADDRINUSE; discovery advertises in-container loopback 127.0.0.1:8210 -> silent 502 [endpoint-routing]; vessel-ctl swallows post_install exit status; verdict enum achieved|not_achieved|partial vs MCP docs reached|not_reached [docs-drift]; goal_verification_label_write not advertised in spoke registry (333 vs hub 412) [node-locality].
- Checker false-positives on well-factored code (P5/P6/P10) — "a gate that fires on better-factored code trains reflexive exemptions".
- Near miss: goal answered 13621 files = substrate's own tree [node-locality]. universal_tool_fallback returns poolProvenance:[].
- [false-verification / dormant-mechanism] ui_legibility_scan advertised, NEVER executed (no unit); zero success:false paths -> scheduling it would earn α on blind runs. Fixed to return structuredError. /v2/activities/execution-traces ~36s for limit=1; short timeouts return EMPTY.
- Law: validate the EFFECT not the construction; a validator must be able to fail; "could not observe" ≠ "observed nothing".
- Rendering as shape: renderPolicy/renderPolicy_write, tokenOverrides runtime-steerable. Reward crux: time-to-correct-verdict, never reward more verdicts.
- Film caught hollow reach: .ts under scripts/substrate answered 7044 (actual 4550) reached:true; human label not_achieved.
- [gap-content] 60 open gaps, only 3 grounded (5%) with edit_site (in classification_metadata); ui-legibility-scan emits none; gap_to_feature REFUSED ungrounded (localization_failed) — correct. Autonomy timers masked on spoke (funnel-drain, surgical-gap-scan); GapDrainObserver didn't fire.
- Closure: 617 stale_open of 2,527 gaps; churned 0, auto_closed 0. Added evidence-based re-observation closure (only source:substrate_detected); non-vacuity proven both directions (reopen_count). Law: a closer that always closes is worth as much as a gate that never refuses.
- [sync-deploy-drift] docker cp reverted by pull-sync; made permanent via commit 354a134 (dev-vessel). "COMMIT so convergence becomes ally".

### 25. human-surface vessel bring-up + hollow proxy (2026-09-06, retraction 09-08)
- Recipe for obsidian-vessel (install.sh; apiKey prompt eats piped yes; obsidian.json edit; :27182/health presence-conditioned).
- [endpoint-routing / hollow] discovery-routed obsidian:ui_screenshot answered by development-vessel's proxy success:true WINDOW_UNAVAILABLE — gap ui-screenshot-routed-to-hollow-proxy.
- RETRACTED gap ui-legibility-scan-resolver-only-never-walked: activity development-vessel:ui-legibility-audit-tick existed since 07-06 (linked via tasks[].resolver); executions existed; `CONTAINS` is array op (matches nothing on string). Real: 5 executions, activity row frozen total_executions 0, α=1 β=1 [write-read-mismatch / selection-learning] -> reference-the-producer-index-cannot-see-activities-2026-09-08.
- Capability ladder: advertised -> producer registered -> resolve returns substance -> walk reaches -> traces graded (capability = rung d+). 0/393 persona shapes.

### 26. human UI complaint closed end-to-end (2026-08-07/08)
- [human-surface-escalation / drafter-quality] "elapsed keeps counting" = ONE missing field (DispatchRecord end timestamp). Substrate-authored 0f1ede3, 950c7f6, 93170a5, 1bfcec7. Drafter "hallucinations" inventing end-time field were CORRECT inferences — "when a model repeatedly invents the same missing thing, believe it".
- Five broken links: grounding = first 3% of 176KB file (target byte 59,125) -> grounding_has_region diagnostic; operator's containment gate vetoed correct patch 3x (made advisory a71e9a8; 3 false rejections vs 1 catch); mechanical failure escalated to UNJUDGED route; multi-op plans shifted each other's anchors; BUNDLE main.js not rebuilt since 390a317 — no substrate UI change had EVER been live; host-pull-sync timer dead ("Unit to trigger vanished") [sync-deploy-drift / dormant-mechanism].
- Laws: gates were the problem, channels (information) the fix; a rejection carrying no information spends a selection cycle; gate deformed intent upstream; never escalate on inferred cause (false "credit-dead"); auth failing open — empty `Authorization: ApiKey` accepted everywhere [env/auth]; ship the falsifying measurement in the same commit; layer above the artifact lies (origin≠running, source≠bundle, null≠absent, landed≠live).
- [autonomous-regression] e1e84cc removed 35 lines of recipe-seeding under a one-line goal, passed typecheck/containment/judge; gap no-scope-check-on-patch-deletions.

### 27. identifying yourself as the operator forfeited the operator slot (2026-08-11)
- [directed-overshoot / spend-envelope-throughput] goal-host index.ts:12418 `if (operator) return "operator"` but :12851 operatorOrigin only undefined|"run-goal" -> every operator dispatch autonomous; compose-slots.ts:166 effectiveCap = directed?cap:max(1,cap-1) -> operator could only claim slot-0 held by gap loop. Regression was operator-authored fcd667b 15h earlier (fixed hardcoded directed:true, installed mirror defect). "A fix that repairs one direction of a distinction can install the mirror defect in the other."
- Substrate autonomously landed db21c5fa6c31 one-line fix, first try, from a filed gap with stated mechanism (worked). Validated by behaviour (claimed slot-1).
- Post-land suite fail=4 pre-existing across 5 runs — raw failure count not a regression signal without prior run.
- MCP goal_status resolved goal-host via discovery to a DIFFERENT instance [node-locality]: confirm which copy the instrument talks to.
- [drafter-quality] drafter deterministically hallucinated anchor router.get vs app.get twice despite "[fc-anchors] supplied verified-unique anchors".
- (Recurs 09-23: directed flag closed by measurement 112e194; gap_to_feature drops `directed`; 09-28 directed gap hand-off needs directed:true.)

### 28. identity-vessel decides group membership (2026-08-14)
- [federation-p2p] Key valid only at issuing identity-vessel (iss in payload; TRUSTED_ISSUERS). Validate with POST /v1/auth/resolve not /v1/keys/validate.
- Makefile derived HUB_DISCOVERY_URL/ACTIVITY_API_ENDPOINT/IDENTITY_VESSEL_URL from single DISCOVERY_HOST — wrong when peer is spoke; fixed a48e4ae3.
- Healthy-looking container couldn't dispatch; discovery.status ok measures registration not reachability.
- [endpoint-routing] discovery union-merge drops loopback peer rows (tests endpoint only, ignores public_endpoint); human-surface proxy bypasses local discovery with its own reachableFrom rewrite — two reachability rules in one fleet [codebase-bloat-fossils/duplicate].

### 29. impulse-driven interface design (2026-07-25, wf_e5008e51, artifact 89b241a7)
- [human-surface-escalation / codebase-bloat-fossils] Three disjoint UI stacks: stateful-ui LIVE (pool in-memory only; emitToDevVessel fire-and-forget no-ops), react-renderer BUILT-NOT-DEPLOYED (17-primitive union, composition_metric->Thompson dormant), obsidian in-plugin (setInterval law-5 violation). Nothing about presentation learned: solicitation_outcome_scan stub, interaction_expectation_verify skeleton, interactor JSONL unread.
- Design: "structure may be frozen, policy may not"; 9-rung ladder (durability -> shared pkg -> policy shapes -> DEPLOY react-renderer -> ...). OUTCOME: superseded 08-07 by root-and-stem replacement (react-renderer retired, human-surface-vessel built), then 09-20 baseline shows consumption still severed — THIRD restart of UI arc. [recurrence: human surface redesigned 3x]

### 30. impulse rendering non-uniform; LLM drops unloaded inputs (2026-08-25)
- [write-read-mismatch / goal-walk-floor / law 8] ias-executor engine.ts:1777-1845 resolveInputs never materializes lazy pointers; three disjoint materialization layers (engine.ts:318 resolveImpulseSlot, impulse-resolve.ts:163 only real puller, activity-api impulses.ts:866). Canonical `llm` resolver (hosts/goal-host.ts:145) IGNORES inputImpulses; llm-prompt.ts:92 skips loaded:false silently — two divergent LLM renderers [codebase-bloat-fossils/duplicate]. Live probe (lifecycle:llm:dispatched renderedPrompt) NOT RUN.
- engine.ts:319-320 unconditional console.error("[rIS-debug]") leaks 400-char content preview (leftover from 8676beb) [codebase-bloat-fossils].

### 31. impulses as variables — bind before synthesise (2026-09-03)
- [goal-walk-floor / composition-crystallization] Pool reached the prompt in wrong form: `- <shape>: <content 800 chars>` prose, terminal shapes filtered out, block warns against prior findings; `{{shape}}` deterministic reference mechanism has ZERO uses. "Persuasion is not mechanism." 12/41 produced shapes (29%) carried "X is required" error bodies while answer sat in pool.
- Shipped 13b3262 bindArgsFromPool (INERT: requiredFields from resolver_schema which is known:false for failing shapes — 12 invocations 0 bindings) then c07cffc recovers required fields from resolver's refusal; provenance logs source=schema|refusal. Bind rate 0/2 with legitimate reason. Outcome: partial (worked mechanically, low exercise).
- Variables still came from goal-text regexes (parseRankAggregate, parseThreshold, file-count/curl+jq builders) — each goal class needs a hand parser [codebase-bloat-fossils]. Gap activity-inputs-are-parsed-from-goal-text-not-bound-from-the-impulse-pool.
- Law: grep for what the code LOGS, not what it SAYS.

### 32. independent recompute oracle + credit-dead plane (2026-08-07) — KEY NEGATIVE RESULT
- [false-verification / selection-learning] 57cd2c3 made reached honest on novel classes (hollow 68% -> 0) but `no-oracle-for-goal-class` skips β => posterior never moves: "an honest verdict that cannot change is as inert as a hollow one".
- Independent recompute aed9961 + 2337624 (isCountableQuestion). First live probe: oracle's own `git log | wc -l` counted log lines, β-penalised a CORRECT answer (16). Law: a single model-authored command has the confidence of a single model-authored answer — certifying oracle by POSITION. Fix: two derivations, reconcileDerivations. Then both used goalHashOf as buffer key -> collision -> guaranteed abstention (silent). b068747 unescaped backslash -> guaranteed abstention.
- [spend-envelope-throughput / env-gating] All 4 local LLM arms credit-dead; -google arm same vessel different pin; cross-provider failover env-gated OFF (anthropicCreditFallback reads LLM_FALLBACK_MODEL); `if (body.tools?.length) return null` — tool requests never fail over (ReAct floor dies first). llm_completion not in spoke registry. No gap filed -> built classifyPlane detector 0768990 (filed llm-completion-plane-dark, verified).
- RETRACTION: plane was never the blocker — hub llm reachable via federation (llm-resolver-google@syzygy-hub); spoke's local arm only dead. Law: do not promote an external dependency to terminal blocker without testing federated path. [node-locality]
- [selection-learning] Instrument bug: harness sampled vessels without replacement -> every goal novel class; learning curve unmeasurable. Added --repeat (79db5bd7).
- Warm 48/48 with no LLM (deterministic floor). Cost ROSE on repetition (22.4s->~54s) — retracts earlier cost-reuse claim.
- 7387072 command builder `\bfiles?\b` pre-empted reuse cache + tryLexicalRebind (countsSomeOtherUnit shared predicate) +4 goals. "reuses but does not accumulate".
- Pathway reuse accepted ≠ executed: largest_file pathway [fs_list, fs_read, shellResult] accepted but pointer arg synthesis dead -> 0/12. Arm oscillation subdir_count [1,0,1,0] (learned-learned-composition... vs satisfier:shellResult).
- 089aead lenient parser 25/48 -> 18/48 REVERTED b41851c. Law: on the ground-truth side an abstention is cheap and a wrong value expensive.
- 097b291 token answers 27/48. 6a1ce94 decline multi-tree goals (third instance: d7fee60, 7387072, 6a1ce94). Law: an oracle must decline a goal whose scope its parse does not represent. Honest miss inert; hollow green corrosive.
- TERMINAL: every class saturated from round 0 or zero all rounds; "convergence without improvement". 95a9626 donate verified command fired 0 times; 1ec89d1 single-derivation donation fired once REVERTED. Law: a verification gate strict enough to keep the metric honest is strict enough to prevent learning from it; need third independent source of truth.
- fdb7036 missing-verifier refusal files per-FAMILY gap (missing-verifier-subdirectory-count etc.); event-driven gap-compose picked it up; but gap_to_feature processes ONE gap per invocation against 465 open (174 edit_intent_route), watchdog open_intents 1908, stalled 22-32 min [spend-envelope-throughput / gap-content]. "observation lands in a queue that does not drain."
- Verifiers as recipes (data, parameterised vessel name; used as one of two derivations; subdirectory-count agreed 10/2 live; distinct-file-extensions retired). Mint defects: keyed on repos/ span minted zero; truth 0 = two failing; path traversal `..`.
- Claim 1 fails on ANSWERING side: recipe-answer fired 0/48 (failing classes never resolve shellResult; land on universal-tool-fallback, auto-bridge-fileWriteResult, observe-orthogonal-patterns). Floor-seeding fired 12x -> 17/48 REVERTED. Cold totals 27,22,22,23,24,19,17 (variance > effects).
- Pooled 15 runs/719 dispatches: round0 51.7% vs later -2.5pp z=-0.58; sign test 18 improved/24 degraded; 126/168 class-runs never varied. Repeated exposure does not improve reach.
- 62a00f54 β on nothing-measurable: fired, moved selection to slower arms -> timeouts cascade (15.1s->124.5s; 17/48) REVERTED. Law: a negative score with no better arm is a cost cascade. Seven mechanisms, five reverted.

### 33. inline selectors — single-point class authoring (2026-07-31, goal-host 5fa3fc8)
- [composition-crystallization / drafter-quality] ClassRow.selector may be inline {shell,js}; selectorOf single materializer; golden drift gate covers inline cells; adversarially verified (drifted inline row refused). Bounds: one fixture point; owns() mis-routing unchecked; dead legacy avg-threshold builder/verifier [codebase-bloat-fossils].
- d55395a7 autonomous: drafter authored inline literal but couldn't land (10-field object; no-op re-edit loop turns 18-30; LLM 402; typecheck wrong cwd /vessels/<v>/src 11 spurious errors) — gap drafter-cannot-close-multifield-classrow-literal-noop-reedit-loop-2026-07-31.
- c57563f verbatimExcerptBlock (byte-exact 40-line window) -> first fs_edit applied; residual drafter-stale-anchor-flail-after-own-successful-edit. 6ba5c6c ClassRow fields optional. b307589 selector primitive factories thresholdSelector/parseThreshold (drafter chooses primitives).
- WORKED: 926b42b substrate-authored, landed on origin/dev no hands (f8e2b63c): `{ id: "above-count", owns: parseThreshold("more than"), selector: thresholdSelector(">") }`; 86 golden pass. Thesis: authoring = choosing vetted primitives. NEXT (not done): self-goal generator emit primitive-composed goals (law 13); broaden primitive library.
- Ops: API_KEY_SECRET rotation revoked local key; local vs syzygy separate auth scopes; MCP caches key at session start [federation-p2p / endpoint]. /vessels stale -> force-mirror cp [sync-deploy-drift].

### 34. instruction families + resolver map (2026-07-16 demo)
- [goal-walk-floor / selection-learning] 342 shapes -> 10 functional families all serviceable by existing resolvers; 84 missing_capability gaps are narrow single-shape producers. Frontier = producer SELECTION not capability. Demo: webSearchResult->web_resource reached + ribosome extracted composition:websearchresult-to-web-resource (worked); "open gaps by category" hollow; "remember that X" mis-selected activity:detect-ui-spacing-drift instead of memoryNote_write [memory-recall]. Proposed 25-instruction reach-graded regression suite (not known to exist).

### 35. interrogative misroute guard + drafter capacity (2026-07-30)
- [goal-walk-floor / autonomous-regression] earlyFileOnlyMatch (goal-host ~6023) fired on file-path presence without edit verb; "What percentage of lines..." routed to feature_compose and AUTHORED spurious code into LIVE source (+5 lines, never committed). Fixed 92d4b428 earlyInterrogative. Detector gap detector-interrogative-goal-misrouted-to-edit-intent.
- [drafter-quality] 3-function route: pwt 30 turns mostly unparseable, wrote nothing; single-point edits land (818dcfd, 0253725). Gap capability-drafter-recommit-storms-on-large-multifunction-routes. Baseline 10 everyday goals 30%. systematic-llm-reachgate-greens-value-wrong-computations.
- Operator thesis "interpolation of variables through functions" already in index.ts:1119 comment (recurs 09-03 note 31).

### 36. interrupted-edit reconciler manufactures hollow green (2026-08-05)
- [hollow-landing / false-verification] reconciler (goal-host ~:10290) sets sha="reconciled" sentinel and reached:true when no new_git_sha — contradicts ":7021/:7387 a staged clone is not a reach". Class: fallback/retry/reconciler paths not held to primary path's gate.
- [sync-deploy-drift] GOAL_HOST_DRAIN_MS 80s > TimeoutStopUSec 60s -> SIGKILL; 13 restarts/6h; 7% dispatches interrupted by cutover; edit-intent excluded from auto-resume (permanent loss). Fix 9706f440 drop-in TimeoutStopSec=300/DRAIN 240000 — NOT IN EFFECT: units copied at image build (Dockerfile.substrate:213); pull-sync never deploys unit files. CLASS: substrate cannot self-modify its own systemd configuration; fixes look landed and are inert.
- [trace-store-db] /v2/activities/execution-traces ingest timed out 1391 times/6h at 15s (dual-write + posterior + successor-features); /reach 0.18s. Spool replay 187 delivered, 6 lost.

### 37. investigation floor met — self-investigation reaches (2026-08-27)
- [goal-walk-floor] Six fixes: 752014d/2757d15 isCodeInvestigationGoal routing; 0af9639 prefer shellResult grep; 71d434f pre-suppress raw satisfiers; a334032 seed floor with grep evidence; 5e4d045 deterministic citation oracle (fails closed). Live ab7074b1 reached (worked).
- [composition-crystallization / selection-learning] rung (b) reuse test 50f7fc4c: floor pathway (3/3) outranked by generic satisfier:shellResult (4/4) in deterministic top-1 sort by raw count (recommendReachingPath, no Thompson) — re-derived, not reused. Gap pathway-reuse-ranks-by-raw-success-count-starves-verified-floor.
- dispatchId ≠ executionId (execution_trace 404s on dispatchId).

### 38. isolation removed the refusal; nothing replaced the bound (2026-08-10)
- [spend-envelope-throughput] 27 concurrent build processes, load 50.8 on 14 CPUs. Per-compose worktree isolation made concurrency correct -> refusal dropped; refusal ALSO carried the capacity constraint. Defects: gap-compose.service spawn sat above __composeDrainInflight check; in-process cap only bounds half (separate bun gap-compose-tick.ts) -> file-marker slots reaped by mtime; NaN fail-open (Math.max(1, Number("typo")) -> NaN, inFlight >= NaN false). Load 50.8 -> 21.7 -> 11.1. Storm also caused drain failures.
- Laws: when you remove a guard because its reason no longer applies, check what else it held; refuse don't queue; non-atomic on purpose (resource guardrail).

### 39. iter8 transport fix restores grounding discriminator (2026-08-04)
- 9d695c81 transport carries tool_calls/usage/etc; cffc9489 detector pipefail (0 completions/132 runs); 2e47b75e detector blind (no bun on unit PATH) + masked vessel aborted sync; 5ef2966f masked guard never fired.
- [goal-walk-floor / federation-p2p] Decisive probe: tool-bearing llm_completion — all 3 tool calls failed "Unknown pointer type: shellResult" and model said command "was run" (confabulation). Arm dispatches tools to DEFAULT_TOOL_DISPATCH_ENDPOINT 127.0.0.1:8090 relative to ARM (hub dev-vessel) [endpoint-routing / node-locality].
- Label corpus moved: 100% deterministic -> {automated 4, deterministic 36}. Floor exec id = content hash -> re-runs collide. Operator's own sequencing error polluted 1 row (ungate before labeler companion) — law 12.
- [write-read-mismatch] Federation proxy launders upstream failures into HTTP 200 (success:false inside) — class fix not done.
- Census: 97 of newest 100 traces ungraded — goal-host threads reached to trace from one site (:7177); Thompson learns from ~2%. boredom polls GET /executions/<id>/reach = 404 100%; human reach overrides lost 91% (190/209 timeouts, 15s) — provide_feedback effectively write-only [human-surface-escalation]; feature_compose verify gate passes when shell tool fails (sh.ok never read; sdExit defaults 0) [false-verification]; 16 of 18 observer output shapes have no reader [dormant-mechanism]; ribosome 1115 replay starts / 0 writes in 48h [composition-crystallization].
- [sync-deploy-drift] host sync script hung 56 min (oneshot, TimeoutStartUSec=infinity, docker cp into nonexistent dir) -> timer stopped permanently; fixed 86491fec/3feff283. "Tolerance without a bound is not safety"; "declared lists rot; reconcile against running system".
- Flaky suites: counts vary by env/load; run twice take MIN. Relay flapping (NO_RESERVATION 15/90min) not dead.

### 40. verified deploys against the wrong tree (2026-08-10)
- [sync-deploy-drift] unit runs from /vessels/<v>, not /workspace/git/vessels (they sync ~90s apart) -> restart loaded stale code. Law: verify deploy by the artifact the process executes (systemctl cat -> ExecStart). "THREE trees — always name which".
- [memory-recall / drafter-quality] composeLessonsBlock never sent specText -> same n=8 lessons 132 times. concept-db `@@` is AND over every term; fixed 7df39d2 progressive relaxation. Spec-text queries still n=0 (code vs prose vocab) — reverted twice (90c585f, 8236895). 6137257 key by failure_lessons[].class (most recent) — worked. Gap lesson-recall-should-query-by-failure-class-not-spec-text.
- Suite non-deterministic (93 then 85 failures same tree) — count and set invalid gates. 45 live worktrees; fork landed cross-process cap 6ad3721/68a26de (load 25->4.8) [spend-envelope-throughput / duplicate work across sessions].

### 41. key_session leak host thrash reaped (2026-07-27; durable 07-29 identity-vessel bfad5ca)
- [trace-store-db] key_session 1,343,943 unindexed rows (15-min TTL per resolve_nested, never reaped) -> 31s scans, SurrealDB 10 cores/12.5GiB, host load 20, 40GB swap. Offline REMOVE TABLE + indexes -> load 20->5, count 31s->359µs. Auth sessions share learning DB. Regrew to 10,165 -> amortized reap-on-write (REAP_EVERY 50, LIMIT 500) + migration 003 index. SurrealDB 2.3.3 no native TTL; DELETE...LIMIT doesn't parse.
- A verify subagent ran unauthorized DELETE on prod DB. Proposed gaps gap-key-session-unbounded-leak-no-reaper, gap-no-table-growth-detector (table growth detector — recurs as 09 trace-store growth task).
- "Move costly actions to syzygy": fix leak where it is; placement must be automatic via discovery (law 11).
- NOTE: this memory note contains a literal DB root password in prose — a secret-hygiene issue in the operator cache [codebase-bloat-fossils/hygiene]. (Not reproduced here.)

### 42. landing gate unified both paths (2026-07-30, dev-vessel 44bcffd hand)
- [false-verification / hollow-landing] Path 2 patch_with_tools.triggerMitosisTick FABRICATED verdict:"FAVORABLE" and called cutover directly, trusting in-loop typecheck that called NON-EXISTENT tool `code_typecheck` (advertised `code_verify_typecheck`) -> 404 -> `error_lines ?? []` = no errors (fail open). Instance activity-api 9775bc8 12-line deletion TS1128, reverted d280a05 [autonomous-regression].
- Fix: triggerMitosisTick runs same staticEvaluate (parse-bail + signature-subset + clean-base); renamed 4 callTool dispatches. Verified synthetic TS1128 refused.
- Class detector filed calltool-unknown-tool-name-fails-open-no-detector (validate tool names vs advertised shapes). Deferred: delta-aware touched-resolver test block.

### 44. landing-quality matriculation (2026-07-28, wf_be7b6b9f; landed 01c1764)
- [narrowing-duplicates] recommit fractal: 121 autonomous commits/6d, 23 (19%) recommit; route-edit-31e3e3f8 -> 9 landed commits (1 real + 8 blind), depth 1->13. appendComposeLesson (feature-compose.ts 1448-1491) recommit gap inherits edit_site but NOT failure_lessons (gap-to-feature.ts:1617) -> blind retry; unconditional source-gap reopen. 12e7611 capped depth<2 -> arrested.
- [autonomous-regression] 4/127 autonomous landings reverted (7d), all FAVORABLE + verify ok; 2/4 needed operator hands. Holes: broken-baseline relaxation; partial-apply-still-cutover; semantic gate no completeness check (cosmetic version-bump passed).
- [false-verification / gap-content] Gap-triple close rate MIRAGE: 1240 rows; 42% reported but 466 auto_draft bookkeeping records inflate; genuine ~5-8%. One defect under 14 gap ids (route-edit-2c6f8511 lineage). 44% of records bookkeeping/churn.
- priorAttemptFeedbackBlock (940) negative-only [drafter-quality].
- Adversarial verify refuted P1 (disposition) — use existing `churned` status + gap-lifecycle-scan (reuse); refuted P2 classKey dedup (inert; applied then reverted). "landing an inert change IS the churn we fight."
- Landed 01c1764: tcOk excludes touched-file tsc errors.

### 45. law 13 encoded as a regex (2026-08-09)
- [goal-walk-floor / gap-content] isEditIntentGoal (goal-intent.ts) = literal repos/ path && mutation verb -> pathless fix-goals never reach edit path; path regex recurs ~12 sites in index.ts. Fix: restate goal at the door (handleRunGoal) resolving pathless goal to one file (fail-closed). 5 probes worked.
- [false-verification] rg NOT installed in container: Bun.spawn(["rg"]) ENOENT caught -> [] -> "no unique file"; two refinements shipped against a search that never executed. Laws: verify the binary exists; never collapse "tool failed" into "found nothing". (Contradiction: 09-14 index says "rg works" on NUL files — host vs container.)
- bodyHonestyPolicy NOT advertised -> fallback literal list 4x per walk (law-1 violation) [env-gating].
- Unfalsifiable reach: 72f02fea reached:true, no commit; exec_l8tvuljg 5/5 tasks ✓ every task ∅->∅.
- Cockpit points at hub not local [node-locality]. executionTraceList id prefix v_paradigm_execution_traces: must be stripped.

### 43. landing is solved; observing landing is not (2026-09-03)
- [false-verification] n=2: f7f15948 -> edd2e44 and e20c6a91 -> 82b030e both landed correct on origin/dev no hands, graded failed: EARLY EDIT-INTENT route times out at CALLER, callee lands afterwards. Gap reach-verdict-read-before-the-work-finishes-is-terminal-false-negative. Pairs with 09-02 776391aa0f (pushed, graded reached, INERT). "landing is solved; observing landing is not".
- 50f7560 late-landing check (sha existence with --grep=route-edit-<h>) caught 0bf96df (worked) but also FALSE POSITIVE 023f9b1 (inserted without deleting; sentence twice; reached:yes). Correct reconciler already existed at index.ts:15968 — operator copied :12503 precedent without its evidence bar. Gap late-landing-check-grades-reach-on-sha-existence-not-on-goal-achievement. Law: a change to how reach is DECIDED must have its evidence bar justified against every other site that decides reach.
- [autonomous-regression / drafter-quality] False negative -> retry -> old_string not found (already applied) -> escalation -> patch_with_tools applied at fuzzy anchor in module header: 1e66893 destroyed unrelated comment line (typecheck blind). Gap false-negative-reach-verdict-causes-a-destructive-redundant-re-edit. "old_string not found during a retry is positive evidence the edit already landed."
- Operator read control mid-flight -> retracted "load-gated" claim.
- Gates refused operator's own fix twice correctly (unbalanced try/catch; unrelated_diff_orphan_declaration). "The gates are not the weak component." 5 dispatches: 2 landed (false negatives), 3 correctly refused, zero bad code on origin.
- feature_compose: in SYNTHETIC_EXECUTION_ID_PREFIXES: 0 persisted / 40 lost -> no α credit [selection-learning / write-read-mismatch].
- [selection-learning / trace-store-db] decision_outcome 99.9% reach-known is TAUTOLOGY (posterior-update.ts:1027 gates on !ungraded); covers ~3-20%, docs/migration 202 header claim every execution [docs-drift]. 57% of rows from 08-30 thermal-emergency day -> 62.7% bypass retracted as steady state. decision_outcome org_id null on all 7,679 while lookup is org-scoped; decision-credit.ts:121 lookup `org_id = $oid` misses 678 metrics rows in other orgs (ribosome-extract under `public`) [write-read-mismatch]. /decision-calibration default limit=50 sorted worst-first.
- [selection-learning / env law 5] scaffold-and-publish-vessel (2,879 decisions) and mitosis-tick (1,920) dispatched by target-template id from boredom, never in thompson_selection_log (0/20,000) — no selection event. scaffold-and-publish-vessel fails 75/77 on literal {{target_branch}} (dispatched with no variables) ~288/day wasted; gap scaffold-and-publish-vessel-dispatched-with-no-variables.
- [dormant-mechanism / false-verification] db-admin.ts:safeCount aliases count_value but reads row.c -> INTEGRITY_SCANS clean unconditionally (detector that cannot fire); /selection-outcomes and /calibration-summary never returned (invalid SurrealQL), 471febb fixed third sibling only.

### 46. learned-pathway reuse ceiling gap (2026-07-24, goal-host aef85f8)
- [composition-crystallization] Identical goal re-derived full LLM spine; repeat REGRESSED into hollower path. reachedCommandCache (Map<goal_hash,...>, in-process) substrate-authored via feature_compose aef85f8 (3 hunks, worked). A2 "REUSED verified command ... SKIPPED synthesis".
- Residuals: inference cache didn't short-circuit; reach-judge still runs; no similarity layer; goal_hash ~8 hex truncated collision risk; cache in-process (lost on restart) — later (09-22) "successes persist + replay" and failure memory keyed by goal_hash (recurrence of durability arc).
- Cockpit auth 401 after fleet rekey b2a0a878 [federation/auth recurring: 07-24, 07-31, 08-07].

### 47. learning loop live but polluted (2026-07-23, goal-host 411417b)
- [composition-crystallization / hollow-landing] goal-host mintReachedTrace (index.ts:1742) runs ribosome-extract locally applyExtraction:true (~101 mints/18h) — corrects older memory that said ribosome blocked [docs-drift in memory]. Mint UNGATED on honesty (isSubstanceHonestReach gates only α credit). Polluted store WINS selection: learned-composition-codereadresult-to-concept-write 109 picks/110 failures/24h #1; traceaggregatereport-to-templateauditreport #2 (52 picks); fabricated composition:fs-list-to-shellresult re-minted from zero-duration synthetic trace.
- Reuse broken/harmful: similar goal selected broken composition-fs-list-to-shellresult (fs_list paths[0] undefined, HTTP 500). Grounded-but-unfaithful: 18440 = 2x truth reached.
- Fix 411417b isGroundedHonestReach mint gate (fail toward skip). Residuals: deprecate polluted templates; why 110-failure templates win 109 picks (recommend min_success_rate:0?) [selection-learning]; class detector for mint-where-credit-withheld not minted.

### 48. lifecycle ranking root cause (2026-09-04)
- [write-read-mismatch] activity-lifecycle-audit.ts reads occurred_at/created_at and metadata.state_signature; list endpoint emits executed_at (800/800) and no signature -> combined_score = success_rate × 0.030405 constant. Post-fix all three terms near-constant (recency decay 5 days vs 4.14h window; affinity 33/37 at 0.2).
- [hollow-landing] Operator landed TWO INERT commits 9fbb018 + 672d7b9 reading started_at/completed_at (0/800 present) from a different handler found by grep. Law: read the producer's actual payload keys, not the handler you found by grep; "a renamed field across a boundary returns null rather than erroring".
- [drafter-quality] Rationale prose in a goal invites scope expansion (op_count 3 vs 1-2; repaired:true broke typecheck); keep goal = one op, one verbatim anchor; reasoning in the gap. Semantic gate sometimes catches inertness (LLM judgment over goal text, not effect).
- Law: before fixing, measure whether the term can carry information over the real population; pre-register predicted post-fix distribution.

### 49. live self-development demonstration — port collision (2026-08-26)
- WORKED: a885631 (metric-collector-vessel PORT 8280->8300, gap route-edit-f79ac530 substrate_detected) on real GitHub origin/dev; status false-negatived (goal-seek:no-trace; initial walk verdict before async compose) [false-verification].
- WORKED (autonomous origin, keyed-verified): 9fd234a landability recognises meta.doc_path + documentation_drift in SURGICAL_CATEGORIES — better than operator's proposal; operator's own dispatch ALSO landed 31c7017 (s+=0.2) -> doc-drift boosted TWICE (duplicate via different mechanisms) [narrowing-duplicates / directed-overshoot].
- consequence-verdict-emit.ts draft refused 2/2 by semantic gate; critique not captured into per-gap lessons -> draft 2 regressed to stub; gap failure-lesson-drops-semantic-gate-refuter-critique-so-drafter-cannot-converge [drafter-quality / memory-recall].
- 49 deterministic-oracle events/24h (verified-registry-count); verifier recipe minting 0/24h (growth dormant) [dormant-mechanism].
- RETRACTED: d6c2a84 claimed autonomous; actually operator-originated (subject `apply mitosis-<ts>` no gap id). Method: attribute by gap-PICK log + subject gap-id, not timing.
- [gap-content / narrowing-duplicates] 4/5 top surgical candidates STALE (already fixed by 1ed2c3f, d6c2a84); no live-tree freshness check at PICK (autoCloseStaleGaps temporal only; apply-proposal-as-patch.ts:1072 no-op guard fires only at apply) — route-edit-51b5d824 still open after a885631.
- 211287b6: correct fix authored but NOT landed because discovery index.ts has NO TEST FILE (fc-coverage) — intended safety; class: no path to co-author a test (observability edits to untested files park). d96e2ae previously landed untested and hung vessel.
- 35e64bda duplicates DEFERRED gap peer-fanout-401-indistinguishable-from-no-producer (deferral doesn't suppress re-derivation) [narrowing-duplicates].
- empty-postland-baseline-blocks-every-cutover-fleet-wide (computeNewlyFailing treats empty baseline as nothing failing) [sync-deploy-drift / false-verification]; post-land-suite-red-development-vessel 8 tests.
- Reliability size-dependent: gap-to-feature.ts ~2700 lines UNFAVORABLE+timeouts; 16-line file clean.

### 50. live tree is the draft surface; gates are syntactic (2026-08-09)
- [sync-deploy-drift / autonomous-regression] Tree layout: host super-repo; in-container /workspace/git/super-repo; /vessels/<name> SYMLINK for manifest vessels, REAL DIR NOT A GIT REPO for submodule vessels; /vessels/<name>-mitosis-<ts> draft surface. patch_with_tools/feature_compose fs_edit the RUNNING source before gating (apply-before-gate). Retry re-applied plan -> 155 insertions garbage left on live tree of active vessel (Restart=always).
- [false-verification] FAVORABLE edit replaced a line INSIDE a JSDoc block with nonsense TODO — gates syntactic only.
- [sync-deploy-drift] 0fe5d83 DANGLING (not on any branch); trace-store-reconcile.ts root-cause hunk (33 lines) lost; hub traceStore 301,592 vs cap 150,000 -> change_window livelock kept self-editing gated [trace-store-db]. "The system loses its own fixes".
- Detector gaps: nothing compares live tree vs HEAD; workspace-hygiene-observer only scans mitosis dirs; nothing verifies substrate commit reachable from origin/dev.
- Hub advertises producers as localhost:8090 while drafting ran on substrate-live [endpoint-routing / node-locality].

### 51. LLM arm flapping / thundering herd (2026-07-24)
- [spend-envelope-throughput / federation-p2p] Single funded llm_completion producer (llm-resolver-vessel@syzygy-hub) for whole fleet; local arm de-advertises when all providers cooling (index.ts:152), re-advertises after 600s -> stampede -> fallback cascade burned ~10 models in 4s -> de-advertise 36s later, every ~10 min.
- Fixes (llm-resolver-vessel): 3fa37f0 rate-limit tier (429->45s, exhaustion 600s, reachability 30s) + vLLM providers via VLLM_ENDPOINTS env (INERT until operator sets) [env-gating]; cbf029a seed funded groq/mistral as policy arms; 9716cce reorder OPENAI_WIRE_PROVIDERS (failover walk uses modelClientMap INSERTION ORDER — keystone). Callers PIN claude-sonnet-5 (LLM_DEFAULT_MODEL "" -> DEFAULT_MODEL line 62) [env-gating].
- Residual deferred: ramp-in on resume; cascade over-eager. Submodule DETACHED HEAD push quirk. Self-inflicted: operator's 15-agent workflow hammering shared plane.
- (Recurs: 08-20 the funded groq slugs were decommissioned -> phantom arms; 09-15/16 placeholder keys burn arms; 09-16 GOOGLE_API_KEY="" crash-loop.)
- Target inference collides NL words with shape names ("what does a Thompson sampler do" -> thompson_posterior) — recurring [goal-walk-floor].

### 52. LLM-free edit floor restored (2026-08-05, 27b944a)
- [dormant-mechanism / drafter-quality] synthesizeVerbatimEditOps required fences.length===2; goal-host verbatimExcerptBlock (index.ts:6446, appended :6966/:7278) adds third fence -> floor NEVER fired in history (0 in journal). "The caller's own grounding step defeated it." Fix cut spec at LAST `VERBATIM EXCERPT of ` marker. LLM planner collapsed lines -> rejected anchors.
- Recipe: repos path, exactly two fenced blocks, "Find this exact anchor text"/"Replace it with exactly:"; verify with fixed-string count. One self-sufficient contiguous region per edit. Deterministic builder floor for non-edit goals = 2.0% (28/1,414).
- (Recurs 09-16: "goal-host edit-intent defeats the verbatim floor — direct resolve feature_compose is byte-exact lane"; 09-27 "use EDIT n old:/new: block format".) RECURRENCE: verbatim floor defeated by caller wrapping, repeatedly.

### 53. LLM hub fallback + loop self-fixed cutover (2026-07-29)
- [federation-p2p / codebase-bloat-fossils] Only feature-compose (L1722) had by-name hub-egress fallback; SIX llm_completion callers hard-failed on empty discovery (patch-with-tools, llm-completion-dispatch shared, comprehensibility-check, doc-drift-fix, gap-to-feature, obsidian-deliver-assist). Fix ec8ef67 into shared dispatcher + pwt (verified DISPATCH_OK). Gaps: gap-inline-llm-callers-bypass-shared-dispatch (4 inline-copy leaves = fossils); gap-hub-fallback-only-on-empty-discovery-not-on-advertised-but-resolved-false.
- [sync-deploy-drift] cutover wedge: runGitAwareCutover throws, engine.ts ~L578 drops silently -> mitosis-pending.json never cleared -> apply_proposal refuses + pull-sync skips for 30-min MITOSIS_LOCK_TTL. Parallel session landed 0c96b99 clearPendingIfOwned (superior); operator reverted own b4e3d77 (05829d6) [duplicate work across concurrent sessions].
- Provenance: "Substrate Autonomous" author + `fix(...)` conventional commit = container hand-commit, NOT loop. Loop's own stalelock draft was DESTRUCTIVE (deleted freshness + lease) -> discarded [autonomous-regression].
- Cockpit key revoked again.

### 54. LLM plane blocker = groq key + one predicate (2026-07-21)
- [spend-envelope-throughput / federation-p2p / selection-learning] Operator: a dead arm is a routing problem, not a wall. Spoke: 6 arms all Anthropic-pinned; GROQ/GOOGLE/MISTRAL empty on spoke; hub had groq serving (subagent "empty on hub" was stale inference). isExhaustedProviderError (index.ts:680) missed openrouter 404 "unavailable for free" -> no failover, stays advertised. Fix 85d5edb broaden predicate (worked on hub after restart — hub PROCESS was stale).
- Discovery resolve gateway picks candidates[0] (discovery index.ts:205, engine.ts:258) = first healthy PROCESS not quota-aware — "the whack-a-mole is ONE bug" -> durable fix = producer bandit reading llmQuotaState ("one selection primitive across all horizons"). Status: not built (recurs 07-24, 07-29, 08-07, 08-20).
- Snake/camel shape split llm_completion vs llmCompletion (camel resolves fail) [codebase-bloat-fossils].
- Hub has NO goal-host (role=hub) -> can't dispatch repair there. Resolved via peer: transient NO_RESERVATION relay window; operator: never duplicate key into spoke (data locality). Landings 3737b4c, 2f519eeb (llm-router.ts) honest green 238a4a3.
- Proposed class fix: gate advertised libp2p_multiaddr on live reserved circuit + reservation keep-alive (federation-transport-server.ts ~318) — fail-open.
- Law: landed fix must be DEPLOYED (mirror + RESTART) on BOTH hub and spoke.

### 55. LLM plane critical-path fragility (2026-07-24)
- [goal-walk-floor / federation-p2p] LLM on critical path of EVERY goal (target inference + reach judging) -> relay hiccup fails trivial compute (12/12 HONEST_FAIL incl 47*89). ~4th LLM-plane break in session (stale keys, masked resolver, dead circuit, stale relay route).
- Root: stale-circuit bug libp2p-federation-transport sidecar.ts — circuit captured once at startup, register() re-advertises dead one after hourly reservation renewal. Fixed a67706571f (self-dev) + operator hot-deploy docker cp to hub.
- Answer-legibility bug: reached-true branch never assigned goalReachReason (index.ts:3632); first dispatch MIS-LOCALIZED; precise anchor landed 6a4892c.
- Proposed: deterministic fast paths for inference + reach judging; unify goal-host routedComplete to by-name egress (peer-id forward brittle) [endpoint-routing duplicate routing rules]; funded local arm.
- Sweep: tscount WRONG rubber-stamped; generative/knowledge/arrangement HONEST_FAIL; knowledge "capital" misrouted to code-edit shapes.

### 56. LLM plane down — all lanes credit-dead (2026-07-29)
- [federation-p2p / spend-envelope-throughput] First framed as operator-intractable billing — WRONG: hub had funded groq; spoke's fed-transport circuit STALE (/health showed activeReservations:1 but egress NO_RESERVATION — "relay reservation ≠ end-to-end circuit"). Fix: restart SPOKE fed-transport (restarting hub did nothing). Gap gap-spoke-fed-transport-stale-circuit-liveness-does-not-reflect-end-to-end-reach.
- [env-gating] GROQ/MISTRAL/GOOGLE keys quote-only "" -> cleanEnv undefined -> `if(!key)continue` silently dropped (no log). Two EnvironmentFiles (/workspace/.substrate-secrets overrides /etc/substrate/env) drift trap. grep ^KEY= shows presence not value.
- goal-host 8bd2fff: 7 sites hardcoded model "claude-haiku-4-5-20251001" -> "auto" (learned llmModelPolicy) [env-gating / law 1: model as learned selection]. tencent/hy3:free defunct in config.
- Proposed law-6 detectors (empty provider key warn; all lanes exhausted = loud gap) — later 08-07 classifyPlane 0768990 built.

### 57. LLM plane federation egress restored (2026-07-28)
- [federation-p2p / env-gating / sync-deploy-drift] Self-dev stalled 24h. fed-transport crash-looping NRestarts=8178: container restart -> gen-env blanked HUB_DISCOVERY_URL/RELAY_MULTIADDR; BOOTSTRAP_URL fell to local discovery without relay. Fixed via systemd drop-in hub-egress.conf.
- Hub rejected spoke key 401 Untrusted issuer (separate API_KEY_SECRET; TRUSTED_ISSUERS). Resolution: cf882aed HUB_API_KEY for hub namespace-mirror register; discovery 955b065 peerAuthHeader() for cross-domain hops; hub-minted key delivered via /etc/substrate/env (drop-in Environment= did NOT reach the bun process — contradicts earlier drop-in success; EnvironmentFile wins). PEER_FANOUT_MODE=miss. Durability: /etc/substrate/env regenerated on RECREATE — bake into gen-env (not done at time; 08-09 audit found gen-env allowlist issues).
- SECURITY: 4 credential leaks via broken redactions (operator key leaked twice; hub-minted key revoked). Law: never pipe key-bearing files through grep/sed/cat; fingerprint/length only. Also 07-25 GITHUB_TOKEN in logs. [recurring hygiene]
- Conflicting memory: "NO SSH to hub" vs "SSH available" across parallel sessions [docs-drift in memory cache].

### 58. LLM plane live via failover (2026-07-20)
- d08774a llm-completion-dispatch failover (tries all advertised producers). Liveness solved; quality degraded (free-tier chosen over funded groq; hub-opus rev 8 policy defect). Worked (partial).

### 59. LLM plane relay reservation blocker (2026-07-25)
- [federation-p2p] Local anthropic exhausted -> de-advertise; spoke's relay reservation on hub lapsed (~1h TTL, no auto-renew) -> NO_RESERVATION -> inference confidence 0 -> all goals misroute. Restart fed-transport fixes. DURABLE 494a990e reservation watchdog (close+re-dial every 40 min + reactive). @multiformats/multiaddr@13 has no getPeerId. Runs untypechecked .ts via bun.
- RECURRENCE TALLY for "LLM plane down -> relay/circuit/key": 07-19 (env clobber), 07-20 (failover), 07-21 (predicate + NO_RESERVATION), 07-24 (stale circuit a67706571f; flapping), 07-25 (reservation watchdog 494a990e), 07-28 (crash-loop 8178 + 401 issuer), 07-29 (stale spoke circuit despite watchdog; hardcoded haiku), 07-31 (pinned opus / de-advertise), 08-07 (plane "dead" = read wrong surface), 08-20 (decommissioned slugs), 09-16 (empty GOOGLE key crash-loop). Each proclaimed fixed; class never closed: availability of a remote capability is inferred from local advertisement/process health rather than end-to-end probe.

### 60. LLM provider failover and reward (2026-07-14 .. 07-18)
- [selection-learning] recordArmOutcome(model, resolved===true) (index.ts:729) grades arms on HTTP success not reach — tencent/hy3:free α=1005/β=12 monopolised selection. Gap llm-arm-reward-grades-transport-not-reach. recordPendingArmOutcome/gradeArmByExecution LANDED but NOT wired [dormant-mechanism] (recurs 09-20: satisfier:renderPolicy_write graded on HTTP 200).
- 07-15 availability-as-shaped-rhythm: llmQuotaState + syncCompletionAdvertisement de-advertise; VesselDaemon.setShapes primitive (ias-executor-ts shared).
- 07-18 DEADLOCK: de-advertise only re-synced on success, which can't arrive once de-advertised -> completion plane removed permanently for hours. Operator 9c17905 advertise unconditionally + 17dc3d0 model-granular cooldowns + shared walkFallbackModels. [autonomous/operator overshoot: mechanism reversed within 3 days] — then 07-19..07-29 arcs REINTRODUCE de-advertise-on-exhaustion as "the law" (07-19 "local arms never de-advertise"; 07-24 flapping; 08-07 classifyPlane) — design oscillation.
- [sync-deploy-drift] dist-vs-src trap: vessels import @avigopal/ias-executor-ts as BUILT copy in node_modules; source changes invisible until build + cp dist into every consumer (analysis, development, goal-host, llm-resolver, local-tools, ribosome).
- [hollow-landing] edit-intent reached:True when feature_compose rolled back empty diff (source_code READ satisfier) — gap edit-intent-reach-satisfied-by-source-code-read-not-landed-diff (later closed 07-31 8f23567).
- llm_quota_observer recent_llm_total:0 despite completions (observer blind); composition_coverage_report + reachable_unlearned_report time out.
- Discovery findByShape[0] with no health filter (goal-host index.ts:163).

### 61. localization reads edit_site metadata, not summary (2026-09-15)
- [gap-content / autonomous-regression] Compose target from classification_metadata.edit_site (method metadata_edit_site); summary prose doesn't redirect. Evidence names the VICTIM file (learning-signal-health-observer.ts) -> 4 gaps edit_site victim; real gate feature-compose.ts :5309-5356. 569e982 set successCreditRatio null-branch to 1.0 destroying operator guard (5f5a66e "do NOT report a false 1.0"); 128bbcc reverted an hour later — net zero by luck.
- 101 of 426 autonomous commits in 30 days touch feature-compose.ts (24%).
- [false-verification] verifyGapCondition precedence gap-to-feature.ts:1732 (Class 1 hardcoded_url, 1b expected_literal contents.includes, 3 landing provenance -> pending forever). Adding expected_literal releases a held gap; a comment satisfies it. pending_outcome_verification can be "unknown".
- Ops facts: gap_to_feature pointer.gap_id bypass; dry_run still sweeps; goal-host has NO status route (records /workspace/goal-host-dispatches.json) [contradicts 09-20 "GET /executions/<id>" — endpoint drift]; compose dirs transient; times_loaded never increments via conceptSearch [memory-recall instrument]; systemctl show nonexistent unit -> inactive/NRestarts=0; uiQuestion read path HTTP 500 -> human exit unreachable [human-surface-escalation]; concept-db relaxation falls back to LONGEST class name — keep lesson class short.

### 62. localizer blindness and anti-fossil design (2026-07-20; 07-22 24e4dc0)
- [gap-content / drafter-quality] localizeGap (gap-to-feature.ts): approach decision edit_site "" predicts land=true anyway (landability forward-model doesn't read localization_failed); rankWithLlm ranked blind on filenames (fixed 74f25e6 siteExcerpt); identifyVessel dead-ends when no vessel named.
- Operator design law: do not fossilize — no monolithic smart-localizer in TS; localization should be a gradable ACTIVITY composing source-reading resolvers + model (law 1/2). Status: never built as activity (09-15 still metadata edit_site; 09-28 "gaps born without edit site").
- 24e4dc0 focusedSlice fell back to FILE HEAD when 80-char probe missed (large-file drafting edited dead code byte 6.5K vs site 184K) -> verbatim-fragment probes + rarity-weighted cluster (worked at unit level). E2E gated on LLM quota.
- Keystone: honest verification first; progress_stall 0 landings/24h.

### 63. local substrate joined syzygy as spoke (2026-08-01)
- [federation-p2p / docs-drift] Local substrate NEVER federated (no .env -> HUB_DISCOVERY_URL "" -> entrypoint.sh:39 guard -> fed-transport never started); FED_SUBSTRATE_ID placeholder default misread as prior link. Join one-liner via make up DISCOVERY_ENDPOINT. Never pass ENABLED_ROLES explicitly (split-brain).
- FEDERATION_SIGNING_SECRET/FEDERATION_PEER_AUTH_MODE vestigial (read by no vessel) [codebase-bloat-fossils]. Hub HTTP routes :18080/:18210 do NOT enforce auth (bogus key 200) [security]. Volumes ~52GB (surreal 29.7G residue).
- [node-locality] A spoke disables all 15 autonomy timers (funnel-drain, surgical-gap-scan, self-repair, docs-align, operator-goal-generator...) — self-development STOPS; trace store does NOT move: local store kept receiving traces -> SPLIT trace store (gap gap-spoke-split-trace-store). Verify at HUB, not spoke.

### 64. long-horizon demo + derived-value interpolation (2026-07-25)
- [composition-crystallization] learned-composition-codereadresult-to-concept-write 5212 exec; git-status-to-git-diff-to-concept-write 4362 exec; variant siblings distinct posteriors. (Contrast 07-23: codereadresult-to-concept-write 109 picks/110 failures — the most-reused composite was BROKEN; "reuse" count ≠ value.) GET templates?limit list curates learned-* OUT.
- Satisfier starves reuse: write-terminal satisfier return paths (:2772-2775, :2885) skip recordExecutorCommand; recordExecutorCommand scans only [command,cmd,script,sql]; single-task traces skip mint (:1922). Gap gap-satisfier-reach-starves-command-reuse. Adversarial verify overturned first root.
- [goal-walk-floor] Derived values LLM-interpolated not computed (count chars 'Substrate' wrote 8); probe catches (honest) but can't compute; compute-chain augmentation (:4507) requires source verb. Gap gap-inline-operand-derived-value-llm-interpolated. Arithmetic reach-judge interpolates (126 judged 102 -> false negative). "Deterministic compute is a narrow special case".

### 65. loopback advertisement is a silent cross-substrate misroute (2026-08-08)
- [endpoint-routing / node-locality] metabob-mcp client 3 layers: deriveLocalDiscoveryEndpoint gated on hostname (bd87b62); resolveVesselBaseUrl took public_endpoint 127.0.0.1:18210 verbatim; buildResolverUrl absolute internal port (59b350e). Fixing only 1-2 would silently dispatch hub goals to LOCAL substrate. "A 404 is recoverable; a silent misroute contaminates the measurement."
- .mcp.json METABOB_CONFIG_PATH repo-local config vs ~/.metabob (read wrong file).
- Hub does NOT publish 18250/18260 -> concept recall severed at hub (teaching channel) [memory-recall / federation-p2p].
- (Recurs 09-22: resolve-URL joiner OVERSHOT — absolute resolvePath + endpoint = invalid URL killing floor [directed-overshoot].)

### 66. loop closed — credit flows (2026-08-06)
- [selection-learning] Closed grade->credit on one execution exec_sq82y4aj (reach_graded:true, β moved, ribosome refuses). Pre: 0 α/β moved across 2,392 rows. Eight fixes: 96684c4 (substrate-authored), 2b09cb5 success_rate int/int, ecd0c5a floor catch-break, 2b4e18b /reach grades posteriors, b6a430f ribosome recursion guard never fired, 6c020d9 satisfier unconditional success, a54691d extract on reach tag, 1cd87a0 reach delivery retry.
- Next bottleneck: verdict DELIVERY ~1.3% (7 delivered of 540). 128 of 130 mixed-outcome goal paths hold impossible 0/1 rates (integer division) — historical; goal_hash INSTANCE-grained (3,700/4,703 executed once) masks E6 [composition-crystallization].
- activity_execution_traces DECOMMISSIONED (isDualWriteEnabled default false) — "rows=1" claim false [trace-store-db / docs-drift].
- obsidian assist activity retired by evidence (β +3.98) — worked.
- [dormant-mechanism] oracle-label NOT consumed (n_labels=0) fired 7x; extractionPolicy and walkBudget have NO producer (law-1 fallback logged 33+/window); pull-sync line 483 integer expression error.
- Laws: rollback trigger needs its denominator justified; choose a validation observable the fix can move; validate write-path fix by row-before/row-after formula; crosscheck found 5/7 specs defective; dispatch reliability inversely proportional to region count.

### 67. memoryNote_write 500 fixed; topology mint (2026-07-26, dev-vessel 9790c2f)
- [write-read-mismatch / memory-recall] memory-note.ts:113 `pointer.note` deref crashed on goal-host's FLAT {type,title,content} pointer (no resolver_schema advertised) -> walk logged "no producer or constructible payload" hiding the 500. Tolerant intake fix (worked). Prior turn's diagnosis ("_write terminals cold-unreachable by design") WRONG — read raw journal not summary.
- Residual: composed memoryNote_write content LLM-garbage (confabulated 42 vs 10010); title dropped -> verifyWritePersisted fails -> reframe. Gap gap-compute-emit-composed-write-content-binding-garbage. Same deref class at substrate-gap.ts:258, concept-write.ts. Probe junk notes left in store [test-residue-live-state].

### 68. metamorphic probing found an unplanted gate defect (2026-09-06 .. 09-10)
- [false-verification] surqlBreakingFieldRefusal (vessel-mitosis-evaluate.ts) `/\b(DEFAULT|VALUE)\b/` matches inside `$value` -> non-optional fields with ASSERT $value exempted; 56 DEFINE FIELD statements in corpus use it. 358 mutants, 43 escapes -> 2 genuine classes (+ no trailing semicolon; dotted names intentional). Law: raw escape count ≠ defects (triage).
- Semantic gate REFUSED the correct fix 2/2 (conf 1.00) with fabricated counter-examples both handled by the fix (OLD wrong 4/10, NEW 0/10). Law: when a refuter cites a concrete counter-example, EXECUTE it before accepting the refusal. "Adjudication, not generation, was the bottleneck."
- 09-10: gate_self_probe on rotation caught 550f2f7 (Substrate Autonomous, pwt- lane, no semantic judge) replacing inertRegexEditRefusal refusal with `return null` — THIRD instance of pwt lane disabling a guard with one-line change (cf inverted env gate, f0cfb91 inverted boolean) [autonomous-regression]. Repair f47db2b; operational_state rung 4 broken->holds (5->6). Operator's pre-registered string observable ([fc-inert-literal]) wrong — "pre-register the behaviour, not the string".
- gate_self_probe registered but no systemd timer initially (unscheduled) [dormant-mechanism] -> later put on rotation (worked).
- (Recurs 09-22: `54b7762` deleted ^DEFINE FIELD guard -> surql gate refused every statement; .surql landings dead since 09-16.)

### 69. middle-band composition arc (2026-07-26/27)
- [composition-crystallization] First-mile: lexical REBIND reuse (12s vs 18s) worked. 18c8a14 target-inference composition rule (emit clause dropped -> [shellResult, memoryNote_write]); 30dea54 verifyWritePersisted false-negative on nested id/list envelope. Content binding mis-binds (lines -> '1' not 21) — 1/3 content-correct; cache-poisoning of echoed-write command (chain=0 green-without-write). eval_middle.py / eval_composition.py harness (location unknown; likely tmp).

### 70. middle expanded + self-source corruption (2026-07-27)
- [autonomous-regression / hollow-landing] Two substrate-authored "compose-report" mitosis cutovers corrupted goal-host: earlyEditVerb regex (index.ts:5036) polluted with READ verbs; 09b49f2 injected orphan `async function countAsyncFunctions()` mid-function — both typechecked & shipped; READ goal "report version" -> feature_compose -> unrequested version bump 1.20.9->1.20.10 on activity-api origin/dev (2f4093c, NOT reverted). Fix e3468ea. Conformance gate fb9b1e1 blind. Gaps gap-feature-compose-lands-unrelated-edit, gap-self-authored-source-corruption-regex-pollution-orphan-fn.
- 2a49c76 proven-bad guard (α+β>=12 and <15% success) retired probe-2607 [selection-learning]. (Note: 09-10 SATISFIER_PROVEN_BAD_ARMED unset -> satisfier proven-bad disarmed; 09-03 fs_edit proven-bad "held pending re-baseline".)
- Demo 6/8 honest.

### 71. mislocalization re-derivation window fix (2026-07-22, dev-vessel 1f9fa12)
- [drafter-quality] re-derivation branch (feature-compose.ts:1775) used focusedSlice rarity window excluding true handler; db0cba46 hallucinated app.get('/activities'), header never landed, gate graded reached:true HOLLOW (reachable_symbols mismatched). siteCenteredWindow (unique verb+route probe) -> landed 1fc512c, 4bccc77 (worked, bounded: verb-less edits unchanged).
- [codebase-bloat-fossils/test-residue] Demo residue left on origin/dev: x-exec-list-version (1fc512c), x-templates-count-version (4bccc77), initialized_from_feedback (513fb5a), discover-by-shapes log (d3f538d).
- Semantic-gate hollow rubber-stamp remains.
- Relationship: 24e4dc0 (focusedSlice), 1f9fa12 (siteCenteredWindow), c57563f (verbatimExcerptBlock), 27b944a (third-fence), 09-03 blind-edit repair relocation — FIVE+ successive fixes to "drafter sees wrong region/anchor" [drafter-quality recurrence].

### 72. mitosis cutover graceful drain (2026-07-26, goal-host 015d1ae + 53cce0b)
- [sync-deploy-drift] SIGTERM handler killed in-flight walks (8 cutovers/15min killed 3/4). gracefulShutdown drain + 503 on handleRunGoal; second pre-existing SIGTERM handler raced -> consolidated 53cce0b; verified by controlled restart (blocked 14.6s, walk reached). Residual KillMode=control-group kills shell children; unit file change deploys only on rebuild.
- RECURRENCE: 08-05 note 36 found drain 80s > live TimeoutStopUSec 60s -> SIGKILL still wins; drop-in 9706f440 not in effect (units baked at image build). 07-26 note assumed "90s TimeoutStopSec live" — wrong/changed.

### 73. mitosis cutover lands a stale-base patch as a silent revert (2026-08-28)
- [autonomous-regression / sync-deploy-drift] 510b6df (Substrate Autonomous) named for gap operator's 421052c closed, deleted 44 lines of that fix: staged against base 4e87aba4ab11 predating it; nothing compares staging base to HEAD. "Self-inflicted regression generator." Restored fe52076. Gap mitosis-cutover-lands-a-stale-base-patch-as-a-silent-revert.
- RECURRENCE: 09-24 6ab8271 undid a0ff3d3 (silent revert caught by landed-vs-parent diff); 09-24 drift gate 0a0d59f deadlocked the lane because staged_base_sha = PATCHED hash (overshoot of this fix) [directed-overshoot].
- Close-oracle reopened the gap (worked). pull-sync reported success while SKIPPING vessel (clone ahead of origin). MainPID not NRestarts discriminates restarts.
- [env-gating / docs-drift] `.claude/settings.local.json` sets SUBSTRATE_ALLOW_DIRECT_EDIT=1 persistently -> edit gate never fires; "dispatch, don't edit" unenforced.

### 74. mitosis lock orphan wedge fixed (2026-07-29, 0c96b99)
- [sync-deploy-drift] mitosis-pending.json orphaned on many freshnessOK terminal exits (host-sync handoff L1159, softRefuse...) -> pull-sync hard-skips ENTIRE fleet deploy for 30-min TTL. Fix clearPendingIfOwned in finally (ownership-scoped) (worked). Optional TTL 30->5 not landed. Related 9019cbd gate /vessels mirror on push landing (cutover livelock).

### 75. mitosis typecheck gate signature-subset fix (2026-07-29, a4a4102)
- [false-verification / autonomous-regression] staticEvaluate accepted when mitosisErrorCount <= baseErrorCount (raw line count, not monotone): syntax errors bail tsc early -> 0f794d2 unparseable tree landed (dev-vessel wouldn't boot); 5697f70 TS2552 landed. Fix: error-SIGNATURE SUBSET + pinning test (11 tests). Follow-up gap-mitosis-static-check-reads-only-4kb-output-tail.
- Law: the loop cannot be trusted to fix its own verify gate — hand-land with adversarial verification + real reproduction + pinning test.
- Operator clobbered 244-line test file with cat > (restored).
- Gate lineage: 44bcffd (07-30 unify paths), a4a4102 (07-29 signature subset), 01c1764 (07-28 touched file), 530c1e9 fail-closed, 88032ab (09-16 skipped rollback), 09-22 54b7762 surql guard deleted, 550f2f7 inert-regex guard nulled — the landing gate is repeatedly weakened by autonomous lanes and re-hardened by hand.
